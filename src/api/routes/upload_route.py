"""Upload route — accept CSV/XLSX data and run ETL pipeline."""
from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter(prefix="/upload", tags=["upload"])

# ── In-memory job store (single-process demo) ─────────────────────────────────
jobs: dict[str, dict[str, Any]] = {}

# ── Required CSV column names ─────────────────────────────────────────────────
REQUIRED_COLS = {
    "InvoiceNo", "StockCode", "Description",
    "Quantity", "InvoiceDate", "UnitPrice", "CustomerID", "Country",
}

# ── Stage labels ──────────────────────────────────────────────────────────────
STAGE_LABELS = [
    "資料驗證與上傳",
    "資料清理過濾",
    "建立資料表",
    "RFM 特徵計算",
    "K-Means 客戶分群",
    "購物籃關聯分析",
    "同期群留存分析",
    "流失預測（MLP）",
    "時序銷售預測",
    "個人化推薦引擎",
    "洞察彙整完成",
]

UPLOADS_DIR = Path("data/uploads")


def _create_job() -> str:
    job_id = uuid.uuid4().hex[:8]
    jobs[job_id] = {"stage": 0, "status": "running", "message": STAGE_LABELS[0]}
    return job_id


async def _run_pipeline(job_id: str, data_path: str) -> None:
    """Drive the 11-stage pipeline, running real ETL in a background thread."""
    j = jobs[job_id]
    try:
        # Stage 0: validation done — brief pause
        await asyncio.sleep(0.4)

        # Stage 1: start real ETL in a non-blocking thread
        j["stage"] = 1
        j["message"] = STAGE_LABELS[1]
        from ingestion.loader import run_etl  # local import to avoid startup cost
        etl_task = asyncio.create_task(asyncio.to_thread(run_etl, data_path))

        # Stages 2-5: simulate progress while ETL runs in the background
        for i in range(2, 6):
            await asyncio.sleep(1.0)
            j["stage"] = i
            j["message"] = STAGE_LABELS[i]

        # Wait for ETL to fully complete before proceeding
        await etl_task

        # Stages 6-10: simulated downstream analytics (ML models pre-trained)
        for i in range(6, 11):
            await asyncio.sleep(0.7)
            j["stage"] = i
            j["message"] = STAGE_LABELS[i]

        j["status"] = "done"

    except Exception as exc:  # noqa: BLE001
        j["status"] = "error"
        j["error"] = str(exc)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/file")
async def upload_file(file: UploadFile = File(...)) -> dict:
    """Accept a user-uploaded CSV and run the pipeline."""
    allowed_types = {
        "text/csv", "text/plain", "application/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
    }
    if file.content_type not in allowed_types:
        raise HTTPException(400, detail="Unsupported file type. Please upload a CSV file.")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(413, detail="File too large (max 50 MB).")

    # Validate CSV headers
    filename = (file.filename or "upload.csv").lower()
    if filename.endswith(".csv"):
        first_line = content.split(b"\n")[0].decode("utf-8", errors="replace").strip()
        cols = {c.strip().strip('"').strip("'") for c in first_line.split(",")}
        missing = REQUIRED_COLS - cols
        if missing:
            raise HTTPException(
                422,
                detail=f"Missing required columns: {', '.join(sorted(missing))}",
            )

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex[:8]}_{Path(file.filename or 'upload.csv').name}"
    dest = UPLOADS_DIR / safe_name
    dest.write_bytes(content)

    job_id = _create_job()
    asyncio.create_task(_run_pipeline(job_id, str(dest)))
    return {"job_id": job_id}


@router.post("/sample")
async def use_sample() -> dict:
    """Run the pipeline using the built-in sample dataset."""
    sample_path = "data/sample/sample_transactions.csv"
    if not Path(sample_path).exists():
        raise HTTPException(404, detail="Sample data file not found.")
    job_id = _create_job()
    asyncio.create_task(_run_pipeline(job_id, sample_path))
    return {"job_id": job_id}


@router.get("/status/{job_id}")
def get_status(job_id: str) -> dict:
    """Poll pipeline progress for a given job."""
    if job_id not in jobs:
        raise HTTPException(404, detail="Job not found.")
    return jobs[job_id]

.PHONY: install install-dl sample-data etl evaluate api app test lint clean help \
        train-cf train-nlp train-ts train-dl train-embeddings train-all train-tree \
        evaluate-cf \
        frontend-install frontend frontend-build \
        docker-build docker-up docker-down

PYTHONPATH_SRC := PYTHONPATH=src

help:
	@echo "RetailPulse BI + Recommendation Platform"
	@echo ""
	@echo "Backend:"
	@echo "  make install          Install Python dependencies via uv"
	@echo "  make install-dl       Install PyTorch CPU + sentence-transformers"
	@echo "  make sample-data      Generate synthetic sample data"
	@echo "  make etl              Run full ETL pipeline (ingest → features → models)"
	@echo "  make evaluate         Evaluate recommender (Precision@K, Recall@K, Coverage)"
	@echo "  make api              Start FastAPI server on port 8010"
	@echo "  make app              Start Streamlit dashboard on port 8501"
	@echo "  make test             Run pytest test suite"
	@echo "  make lint             Run ruff linter"
	@echo ""
	@echo "Phase 4 Training (run after make etl):"
	@echo "  make train-cf         Train ALS collaborative filtering"
	@echo "  make train-nlp        Train TF-IDF/LSA product clustering"
	@echo "  make train-ts         Train SARIMA + ETS time-series forecasters"
	@echo "  make train-dl         Train DL models (CLV, Churn, Autoencoder)"
	@echo "  make train-embeddings Train Item2Vec + SBERT product embeddings"
	@echo "  make train-all        Run all Phase 4 training targets"
	@echo "  make evaluate-cf      Evaluate CF recommender (NDCG@10)"
	@echo ""
	@echo "Frontend:"
	@echo "  make frontend-install Install Node.js dependencies"
	@echo "  make frontend         Start Next.js dev server on port 3000"
	@echo "  make frontend-build   Build Next.js for production"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build     Build Docker images"
	@echo "  make docker-up        Start API + Frontend containers"
	@echo "  make docker-down      Stop containers"
	@echo ""
	@echo "  make clean            Remove generated data and cache files"

install:
	uv sync

install-dl:
	uv run pip install torch --index-url https://download.pytorch.org/whl/cpu
	uv run pip install sentence-transformers
	@echo "PyTorch CPU + sentence-transformers installed"

sample-data:
	$(PYTHONPATH_SRC) uv run python scripts/generate_sample.py

etl:
	$(PYTHONPATH_SRC) uv run python -m ingestion.loader

evaluate:
	$(PYTHONPATH_SRC) uv run python -m evaluation.evaluate_recommender

api:
	$(PYTHONPATH_SRC) uv run uvicorn api.main:app --reload --host 0.0.0.0 --port 8010

app:
	$(PYTHONPATH_SRC) uv run streamlit run src/app/streamlit_app.py --server.port 8501

test:
	uv run pytest tests/ -v

lint:
	uv run ruff check src/ tests/

frontend-install:
	cd frontend && npm install

frontend:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

docker-build:
	docker compose build

docker-up:
	docker compose up api frontend

docker-down:
	docker compose down

train-cf:
	$(PYTHONPATH_SRC) uv run python -m training.train_cf

train-nlp:
	$(PYTHONPATH_SRC) uv run python -m training.train_nlp

train-ts:
	$(PYTHONPATH_SRC) uv run python -m training.train_ts

train-dl:
	$(PYTHONPATH_SRC) uv run python -m training.train_dl

train-embeddings:
	HF_HOME=$(HOME)/.cache/huggingface $(PYTHONPATH_SRC) uv run python -m training.train_embeddings

train-tree:
	@echo "Training tree-based ML models (DT/RF/GBT)..."
	PYTHONPATH=src uv run python src/scripts/train_tree.py
	@echo "✓ Tree models trained"

train-all: train-cf train-nlp train-ts train-dl train-embeddings

evaluate-cf:
	$(PYTHONPATH_SRC) uv run python -m evaluation.evaluate_cf

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	rm -f data/retailpulse.duckdb
	rm -f data/models/*.pkl data/models/*.pt data/models/*.json data/models/*.model
	@echo "✓ Database and model artifacts removed (raw data preserved)"

all: install install-dl etl train-all
	@echo "✓ Full pipeline complete. Run: make api && make frontend"

status:
	@echo "=== RetailPulse BI Status ==="
	@ls -lh data/retailpulse.duckdb 2>/dev/null && echo "  ✓ Database ready" || echo "  ✗ Database not built (run: make etl)"
	@echo "=== Models ===" && ls data/models/*.pkl data/models/*.pt data/models/*.model data/models/*.json 2>/dev/null | wc -l | xargs -I{} echo "  {} artifact(s) found" || echo "  ✗ Not trained (run: make train-all)"
	@curl -s http://localhost:8010/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✓ API running v{d[\"version\"]}')" 2>/dev/null || echo "  ✗ API not running (run: make api)"
	@curl -s -o /dev/null -w "  ✓ Frontend running (HTTP %{http_code})\n" http://localhost:3000/ 2>/dev/null || echo "  ✗ Frontend not running (run: make frontend)"

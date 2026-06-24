FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv

# Copy dependency manifest first (layer cache optimization)
COPY pyproject.toml ./

# Install production dependencies (source is copied in the next layer)
RUN uv sync --no-group dev --no-install-project

# Copy source code and configs
COPY src/ ./src/
COPY configs/ ./configs/
COPY scripts/ ./scripts/

# Copy env example (ETL/API uses this as fallback)
COPY .env.example ./.env

# Create data directories
RUN mkdir -p data/raw data/sample data/models

EXPOSE 8000 8501

# Default: start FastAPI server
CMD ["uv", "run", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM python:3.12-slim-bookworm

COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /uvx /bin/

WORKDIR /opt
COPY Services/Historical-Data-Ingester /opt/Services/Historical-Data-Ingester
WORKDIR /opt/Services/Historical-Data-Ingester

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/opt/Services/Historical-Data-Ingester/.venv/bin:$PATH"

RUN uv sync --frozen --no-dev

ENTRYPOINT ["python", "-m", "historical_data_ingest.cli"]

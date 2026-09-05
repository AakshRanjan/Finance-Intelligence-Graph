FROM python:3.12-slim-bookworm

COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /uvx /bin/

WORKDIR /opt
COPY FMP-SDK /opt/FMP-SDK
COPY APIs/Historical-Data /opt/APIs/Historical-Data
WORKDIR /opt/APIs/Historical-Data

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/opt/APIs/Historical-Data/.venv/bin:$PATH" \
    HISTORICAL_DATA_ROOT=/opt/APIs/Historical-Data

RUN uv sync --frozen --no-dev

EXPOSE 8000

CMD ["uvicorn", "historical_data_api.main:app", "--host", "0.0.0.0", "--port", "8000"]

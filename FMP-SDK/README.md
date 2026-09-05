# financialmodelingprep-sdk

Async Python SDK for the [Financial Modeling Prep](https://site.financialmodelingprep.com/) stable API. Responses are validated with Pydantic; HTTP calls retry through a shared session.

## Install

```bash
pip install financialmodelingprep-sdk
```

Requires Python 3.12+. You need an FMP API key.

## Usage

```python
import asyncio

from fmp_sdk import FMPSession


async def main() -> None:
    async with FMPSession("YOUR_API_KEY") as session:
        bars = await session.chart("AAPL").historical_price_eod_light()
        print(bars[0].date, bars[0].price)
        dividends = await session.corporate_actions("AAPL").dividends()
        print(dividends[0].date, dividends[0].dividend)


asyncio.run(main())
```

`FMPSession.chart(symbol)` and `FMPSession.corporate_actions(symbol)` bind a symbol so you do not pass it on every call. You can also pass `symbol=` per request.

## Versioning

Releases are cut automatically from Conventional Commits that touch this package:

- `feat:` — minor
- `fix:` / `perf:` — patch
- `feat!:` or a `BREAKING CHANGE:` footer — major (stays 0.x until 1.0)

See [CHANGELOG.md](CHANGELOG.md) for published versions.

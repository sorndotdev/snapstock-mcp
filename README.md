# Snapstock MCP Server

A read-only, keyless [Model Context Protocol](https://modelcontextprotocol.io/) server for
[Snapstock](https://learn.snapstock.app/)'s free dividend safety dataset.

Snapstock publishes 0-10 dividend safety scores, red flags, payout ratios, dividend streaks,
and annual dividend history for 1,912 US-listed dividend payers. This server bundles a dated
CSV snapshot and exposes it as six tools for Claude, Cursor, and other MCP clients. Tool calls
run locally and make no network requests.

- **No API key.**
- **No backend.** The data ships with the server.
- **Read-only.** Six tools, no writes, no account.
- **Free data.** The snapshot is published under CC BY 4.0.

## Quick start

### Claude Code

```bash
claude mcp add snapstock -- npx -y github:sorndotdev/snapstock-mcp
```

### Claude Desktop / Cursor

Add this to your MCP configuration (`claude_desktop_config.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "snapstock": {
      "command": "npx",
      "args": ["-y", "github:sorndotdev/snapstock-mcp"]
    }
  }
}
```

Node.js 18 or newer is required. The first launch downloads the package from GitHub; after that,
the bundled snapshot is used offline.

### From a clone

```bash
git clone https://github.com/sorndotdev/snapstock-mcp.git
cd snapstock-mcp
npm install
npm run build
node dist/index.js
```

## Tools

| Tool | What it returns |
| --- | --- |
| `get_ticker_score` | 0-10 safety score, label, five component scores, streak, yield, and links for one ticker. |
| `get_red_flags` | Red-flag list, five- and ten-year dividend-decline flags, and earnings/FCF payout ratios. |
| `get_dividend_history` | Annual dividends per share, year-over-year changes, current yield, streak, and next ex-date. |
| `search_tickers` | Search by ticker, company name, sector, and score range. Up to 100 results. |
| `list_below_threshold` | Tickers scoring below a threshold, sorted weakest first. Default threshold: 4. |
| `get_dataset_info` | Coverage counts, data date, snapshot checksum, license, citation, and source links. |

Example prompts:

- "What is Snapstock's dividend safety score for Realty Income?"
- "Show me the red flags and payout ratios for MO."
- "Find utilities scoring above 7 with a yield above 4%."
- "List ETFs scoring below 4 and summarize the common red flags."

## Data snapshot

| Field | Value |
| --- | --- |
| Data date | **2026-11-15** |
| Tickers | 1,912 (1,901 scored) |
| Below 4.0 | 451 |
| FCF payout above 100% | 92 |
| Five-year dividend-decline flags | 192 |
| Ten-year dividend-decline flags | 202 |
| Bundled file | `data/dividend-safety.csv` |
| SHA-256 | `41f949b8b4ea03d2e3c48a1d9c28f8496033f6d6d746bd837e8d544c05c3b1f5` |

Source page and corrections log:
<https://learn.snapstock.app/data/dividend-safety/#corrections>

Bulk CSV:
<https://learn.snapstock.app/data/dividend-safety.csv>

Per-ticker JSON:
`https://learn.snapstock.app/stocks/{TICKER}/facts.json`

The snapshot is static. The live site may be newer. To bundle a newer snapshot, replace
`data/dividend-safety.csv`, update the date, counts, and checksum in this README, then run
`npm test`. The server computes coverage counts from the CSV at load time.

### Attribution

Data: Snapstock, *Snapstock Dividend Safety Index*, data as of 2026-11-15,
<https://learn.snapstock.app/data/dividend-safety/>. Licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Every tool response includes the data date, source URL, license, and a ready-to-use citation.

## License

- **Code:** MIT. See [LICENSE](LICENSE).
- **Bundled data:** CC BY 4.0. See [DATA-LICENSE.md](DATA-LICENSE.md).

## Development

```bash
npm install
npm test        # builds and runs an end-to-end smoke test over stdio
npm start       # runs the server on stdio
```

The smoke test starts the built server, lists tools, and calls each one. It checks the
published coverage counts and the error path for an unknown ticker.

## Disclaimer

Snapstock scores and red flags are research aids. They are not investment advice, predictions,
or guarantees against a dividend cut. Data is delayed and may contain errors. Do not present
tool output as investment advice.

## About

Built and maintained by the Snapstock team. The free learn site is
<https://learn.snapstock.app/>; the Snapstock app is <https://snapstock.app/>.

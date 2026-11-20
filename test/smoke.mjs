import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath]
});
const client = new Client({ name: "snapstock-mcp-smoke", version: "1.0.0" });

function payload(result) {
  assert.ok(Array.isArray(result.content), "tool result has content");
  assert.equal(result.content[0]?.type, "text", "first content item is text");
  return JSON.parse(result.content[0].text);
}

try {
  await client.connect(transport);

  const tools = await client.listTools();
  const names = tools.tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    "get_dataset_info",
    "get_dividend_history",
    "get_red_flags",
    "get_ticker_score",
    "list_below_threshold",
    "search_tickers"
  ]);
  assert.ok(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true));

  const score = payload(
    await client.callTool({ name: "get_ticker_score", arguments: { ticker: "a" } })
  );
  assert.equal(score.ticker, "A");
  assert.equal(score.score, 6.03);
  assert.equal(score.scoreLabel, "Above Average");
  assert.equal(score.scoreComponents.debt, 7.7);
  assert.equal(score.dataDate, "2026-11-15");
  assert.equal(score.attribution.license, "CC BY 4.0");

  const flags = payload(
    await client.callTool({ name: "get_red_flags", arguments: { ticker: "A" } })
  );
  assert.equal(flags.ticker, "A");
  assert.equal(flags.redFlagCount, 6);
  assert.equal(flags.dividendDeclined5y, false);

  const history = payload(
    await client.callTool({ name: "get_dividend_history", arguments: { ticker: "A" } })
  );
  assert.equal(history.ticker, "A");
  assert.ok(history.annualDividendHistory.length >= 9);
  assert.equal(history.annualDividendHistory[0].year, 2025);

  const search = payload(
    await client.callTool({
      name: "search_tickers",
      arguments: { query: "Johnson", limit: 5 }
    })
  );
  assert.ok(search.totalMatches > 0);
  assert.ok(search.results.length <= 5);

  const screened = payload(
    await client.callTool({
      name: "search_tickers",
      arguments: { sector: "Utilities", minScore: 7, minYield: 4, limit: 10 }
    })
  );
  assert.equal(screened.totalMatches, 1);
  assert.equal(screened.results[0].ticker, "SBS");

  const below = payload(
    await client.callTool({
      name: "list_below_threshold",
      arguments: { maxScore: 4, limit: 10 }
    })
  );
  assert.equal(below.totalMatches, 451);
  assert.equal(below.returned, 10);
  assert.ok(below.results.every((row) => row.score <= 4));

  const info = payload(
    await client.callTool({ name: "get_dataset_info", arguments: {} })
  );
  assert.equal(info.name, "Snapstock Dividend Safety Index");
  assert.equal(info.coverage.tickerCount, 1912);
  assert.equal(info.coverage.scoredCount, 1901);
  assert.equal(info.coverage.below4Count, 451);
  assert.equal(info.dataDate, "2026-11-15");
  assert.equal(info.license.data, "CC BY 4.0");
  assert.equal(
    info.snapshot.bundledCsvSha256,
    "41f949b8b4ea03d2e3c48a1d9c28f8496033f6d6d746bd837e8d544c05c3b1f5"
  );

  const missing = await client.callTool({
    name: "get_ticker_score",
    arguments: { ticker: "ZZZZZ" }
  });
  assert.equal(missing.isError, true);

  console.log("smoke test passed: 6 tools, score/flags/history/search/threshold/info/error paths");
} finally {
  await client.close();
}

#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { APP_URL, CSV_URL, DATASET, DATA_DATE, DISCLAIMER, LEARN_URL, LICENSE, LICENSE_URL, SNAPSHOT_SHA256, SOURCE_URL, citation, findSimilarTickers, getTicker, listBelowThreshold, searchTickers } from "./data.js";
const SERVER_NAME = "snapstock-mcp";
const SERVER_VERSION = "0.1.0";
function attribution() {
    return {
        source: "Snapstock Dividend Safety Index",
        dataDate: DATA_DATE,
        license: LICENSE,
        licenseUrl: LICENSE_URL,
        sourceUrl: SOURCE_URL,
        citation: citation()
    };
}
function tickerSummary(record) {
    return {
        ticker: record.ticker,
        name: record.name,
        securityType: record.securityType,
        sector: record.sector,
        score: record.score,
        scoreLabel: record.scoreLabel || (record.score === null ? "Not scored" : ""),
        dividendYield: record.dividendYield,
        streakYears: record.streakYears,
        category: record.category || null,
        redFlagCount: record.redFlags.length,
        learnUrl: record.learnUrl
    };
}
function jsonResult(payload) {
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(payload, null, 2)
            }
        ]
    };
}
function missingTicker(raw) {
    const similar = findSimilarTickers(raw);
    const hint = similar.length > 0
        ? ` Closest tickers in the dataset: ${similar.join(", ")}.`
        : " Use search_tickers to find a ticker.";
    return {
        content: [
            {
                type: "text",
                text: `Ticker "${raw}" was not found in the Snapstock dataset.${hint}`
            }
        ],
        isError: true
    };
}
const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
});
server.registerTool("get_ticker_score", {
    title: "Get dividend safety score",
    description: "Get Snapstock's 0-10 dividend safety score, label, five component scores, streak, and yield for one US-listed dividend payer. The score is a research aid, not investment advice. Dataset snapshot: " +
        DATA_DATE +
        " (CC BY 4.0).",
    inputSchema: {
        ticker: z
            .string()
            .min(1)
            .describe("Ticker symbol, for example A, AAPL, KO, or JNJ.")
    },
    annotations: {
        readOnlyHint: true,
        openWorldHint: false
    }
}, async ({ ticker }) => {
    const record = getTicker(ticker);
    if (!record)
        return missingTicker(ticker);
    return jsonResult({
        ticker: record.ticker,
        name: record.name,
        score: record.score,
        scoreLabel: record.scoreLabel || (record.score === null ? "Not scored" : ""),
        scoreDate: record.scoreDate || null,
        scoreComponents: record.components,
        streak: {
            years: record.streakYears,
            label: record.streakLabel || null,
            category: record.category || null
        },
        dividendYield: record.dividendYield,
        annualDividend: record.annualDividend,
        sector: record.sector,
        securityType: record.securityType,
        dataDate: record.dataDate,
        learnUrl: record.learnUrl,
        factsJsonUrl: record.factsJsonUrl,
        attribution: attribution(),
        disclaimer: DISCLAIMER
    });
});
server.registerTool("get_red_flags", {
    title: "Get dividend red flags",
    description: "List Snapstock's red flags for one ticker, including explicit five- and ten-year dividend-decline flags, earnings and free-cash-flow payout ratios, and the current score. Research aid, not investment advice. Dataset snapshot: " +
        DATA_DATE +
        ".",
    inputSchema: {
        ticker: z
            .string()
            .min(1)
            .describe("Ticker symbol, for example A, AAPL, KO, or JNJ.")
    },
    annotations: {
        readOnlyHint: true,
        openWorldHint: false
    }
}, async ({ ticker }) => {
    const record = getTicker(ticker);
    if (!record)
        return missingTicker(ticker);
    return jsonResult({
        ticker: record.ticker,
        name: record.name,
        score: record.score,
        scoreLabel: record.scoreLabel || (record.score === null ? "Not scored" : ""),
        redFlags: record.redFlags,
        redFlagCount: record.redFlags.length,
        dividendDeclined5y: record.dividendDeclined5y,
        dividendDeclined10y: record.dividendDeclined10y,
        payoutRatios: {
            earnings: record.earningsPayout,
            earningsFiscalYear: record.earningsFiscalYear || null,
            freeCashFlow: record.fcfPayout,
            freeCashFlowFiscalYear: record.fcfFiscalYear || null
        },
        dataDate: record.dataDate,
        learnUrl: record.learnUrl,
        attribution: attribution(),
        disclaimer: DISCLAIMER
    });
});
server.registerTool("get_dividend_history", {
    title: "Get annual dividend history",
    description: "Get annual dividends per share, year-over-year changes, current yield, streak, and the next ex-date for one ticker. Annual totals include special dividends. Dataset snapshot: " +
        DATA_DATE +
        ".",
    inputSchema: {
        ticker: z
            .string()
            .min(1)
            .describe("Ticker symbol, for example A, AAPL, KO, or JNJ.")
    },
    annotations: {
        readOnlyHint: true,
        openWorldHint: false
    }
}, async ({ ticker }) => {
    const record = getTicker(ticker);
    if (!record)
        return missingTicker(ticker);
    return jsonResult({
        ticker: record.ticker,
        name: record.name,
        annualDividend: record.annualDividend,
        dividendYield: record.dividendYield,
        annualDividendHistory: record.annualDividendHistory,
        streak: {
            years: record.streakYears,
            label: record.streakLabel || null,
            category: record.category || null
        },
        nextExDate: record.nextExDate,
        nextAmount: record.nextAmount,
        dataDate: record.dataDate,
        learnUrl: record.learnUrl,
        factsJsonUrl: record.factsJsonUrl,
        attribution: attribution(),
        disclaimer: DISCLAIMER,
        note: "Annual totals include special dividends."
    });
});
server.registerTool("search_tickers", {
    title: "Search dividend payers",
    description: "Search or screen the Snapstock dataset by ticker, company name, sector, score range, and minimum yield. Returns up to 100 matches with score, yield, streak, and red-flag count. Dataset snapshot: " +
        DATA_DATE +
        ".",
    inputSchema: {
        query: z
            .string()
            .optional()
            .describe("Ticker or company-name fragment, for example 'yield', 'Realty', or 'KO'."),
        sector: z
            .string()
            .optional()
            .describe("Exact sector name, for example Financial Services, Utilities, or Real Estate."),
        minScore: z.number().min(0).max(10).optional().describe("Minimum safety score (0-10)."),
        maxScore: z.number().min(0).max(10).optional().describe("Maximum safety score (0-10)."),
        minYield: z
            .number()
            .min(0)
            .max(25)
            .optional()
            .describe("Minimum trailing dividend yield in percent, for example 4 for 4%."),
        limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe("Maximum results to return. Default 20, maximum 100.")
    },
    annotations: {
        readOnlyHint: true,
        openWorldHint: false
    }
}, async (params) => {
    const { totalMatches, results } = searchTickers(params);
    return jsonResult({
        totalMatches,
        returned: results.length,
        results: results.map(tickerSummary),
        availableSectors: DATASET.sectors,
        dataDate: DATA_DATE,
        attribution: attribution()
    });
});
server.registerTool("list_below_threshold", {
    title: "List tickers below a score",
    description: "List dividend payers scoring below a safety-score threshold, sorted from weakest upward. Useful for screening for elevated dividend-cut risk. Dataset snapshot: " +
        DATA_DATE +
        ".",
    inputSchema: {
        maxScore: z
            .number()
            .min(0)
            .max(10)
            .default(4)
            .describe("Return tickers scoring strictly below this value. Default 4."),
        sector: z
            .string()
            .optional()
            .describe("Optional exact sector filter, for example Utilities."),
        limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe("Maximum results to return. Default 25, maximum 100.")
    },
    annotations: {
        readOnlyHint: true,
        openWorldHint: false
    }
}, async ({ maxScore, sector, limit }) => {
    const { totalMatches, results } = listBelowThreshold({ maxScore, sector, limit });
    return jsonResult({
        maxScore,
        sector: sector ?? null,
        totalMatches,
        returned: results.length,
        results: results.map((record) => ({
            ...tickerSummary(record),
            topRedFlags: record.redFlags.slice(0, 3)
        })),
        dataDate: DATA_DATE,
        attribution: attribution(),
        disclaimer: DISCLAIMER
    });
});
server.registerTool("get_dataset_info", {
    title: "Get dataset metadata",
    description: "Describe the bundled Snapstock snapshot: coverage counts, data date, license, source and changelog URL, and how to cite it. Use this before citing any figure.",
    inputSchema: {},
    annotations: {
        readOnlyHint: true,
        openWorldHint: false
    }
}, async () => {
    return jsonResult({
        name: DATASET.name,
        description: "Free, dated snapshot of Snapstock's 0-10 dividend safety scores, red flags, payout ratios, streaks, and annual dividend history for US-listed dividend payers.",
        dataDate: DATA_DATE,
        coverage: {
            tickerCount: DATASET.tickerCount,
            scoredCount: DATASET.scoredCount,
            unscoredCount: DATASET.unscoredCount,
            below4Count: DATASET.below4Count,
            fcfPayoutOver100Count: DATASET.fcfPayoutOver100Count,
            dividendDeclined5yCount: DATASET.dividendDeclined5yCount,
            dividendDeclined10yCount: DATASET.dividendDeclined10yCount
        },
        sectors: DATASET.sectors,
        securityTypes: DATASET.securityTypes,
        snapshot: {
            bundledCsvSha256: SNAPSHOT_SHA256,
            csvUrl: CSV_URL,
            factsJsonPattern: "https://learn.snapstock.app/stocks/{TICKER}/facts.json"
        },
        license: {
            data: LICENSE,
            dataUrl: LICENSE_URL,
            code: "MIT"
        },
        links: {
            learn: LEARN_URL,
            dataAndChangelog: SOURCE_URL,
            app: APP_URL
        },
        citation: citation(),
        attribution: attribution(),
        disclaimer: DISCLAIMER,
        note: "The snapshot is bundled with the server; tool calls do not make network requests. The free learn site publishes the same data. The paid Snapstock app adds portfolio monitoring and alerts."
    });
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`snapstock-mcp failed to start: ${message}`);
    process.exit(1);
});

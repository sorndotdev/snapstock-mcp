import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
const CSV_PATH = fileURLToPath(new URL("../data/dividend-safety.csv", import.meta.url));
export const SOURCE_URL = "https://learn.snapstock.app/data/dividend-safety/";
export const CSV_URL = "https://learn.snapstock.app/data/dividend-safety.csv";
export const LEARN_URL = "https://learn.snapstock.app/";
export const APP_URL = "https://snapstock.app/";
export const LICENSE = "CC BY 4.0";
export const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
function numberOrNull(value) {
    if (value === undefined)
        return null;
    const trimmed = value.trim();
    if (trimmed === "")
        return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}
function booleanFromCsv(value) {
    return (value ?? "").trim().toLowerCase() === "true";
}
function parseRedFlags(value) {
    return (value ?? "")
        .split("|")
        .map((flag) => flag.trim())
        .filter((flag) => flag.length > 0);
}
function parseHistory(value) {
    if (!value || value.trim() === "")
        return [];
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed))
            return [];
        return parsed
            .filter((item) => {
            return (typeof item === "object" &&
                item !== null &&
                typeof item.year === "number" &&
                typeof item.dividends_per_share === "number");
        })
            .map((item) => ({
            year: item.year,
            dividends_per_share: item.dividends_per_share,
            change_percent: typeof item.change_percent === "number" && Number.isFinite(item.change_percent)
                ? item.change_percent
                : null
        }));
    }
    catch {
        return [];
    }
}
function toRecord(row) {
    const ticker = (row.ticker ?? "").trim().toUpperCase();
    return {
        ticker,
        name: (row.name ?? "").trim(),
        securityType: (row.security_type ?? "").trim(),
        sector: (row.sector ?? "").trim(),
        score: numberOrNull(row.score),
        scoreLabel: (row.score_label ?? "").trim(),
        scoreDate: (row.score_date ?? "").trim(),
        components: {
            growth: numberOrNull(row.growth_score),
            profitability: numberOrNull(row.profitability_score),
            debt: numberOrNull(row.debt_score),
            dividendsAndBuybacks: numberOrNull(row.dividends_and_buybacks_score),
            capitalEfficiency: numberOrNull(row.capital_efficiency_score)
        },
        redFlags: parseRedFlags(row.red_flags),
        dividendDeclined5y: booleanFromCsv(row.dividend_declined_5y),
        dividendDeclined10y: booleanFromCsv(row.dividend_declined_10y),
        earningsPayout: numberOrNull(row.earnings_payout),
        earningsFiscalYear: (row.earnings_fiscal_year ?? "").trim(),
        fcfPayout: numberOrNull(row.fcf_payout),
        fcfFiscalYear: (row.fcf_fiscal_year ?? "").trim(),
        dividendYield: numberOrNull(row.dividend_yield),
        annualDividend: numberOrNull(row.annual_dividend),
        streakYears: numberOrNull(row.streak_years),
        streakLabel: (row.streak_label ?? "").trim(),
        category: (row.category ?? "").trim(),
        nextExDate: row.next_ex_date?.trim() || null,
        nextAmount: numberOrNull(row.next_amount),
        dataDate: (row.data_date ?? "").trim(),
        annualDividendHistory: parseHistory(row.annual_dividend_history),
        learnUrl: `https://learn.snapstock.app/stocks/${encodeURIComponent(ticker)}/`,
        factsJsonUrl: `https://learn.snapstock.app/stocks/${encodeURIComponent(ticker)}/facts.json`
    };
}
const csvText = readFileSync(CSV_PATH, "utf8");
const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_quotes: true
}).map(toRecord);
const byTicker = new Map(records.map((record) => [record.ticker, record]));
const scoredRecords = records.filter((record) => record.score !== null);
const dataDates = [...new Set(records.map((record) => record.dataDate))].sort();
export const DATA_DATE = dataDates[dataDates.length - 1] ?? "";
export const SNAPSHOT_SHA256 = createHash("sha256").update(csvText).digest("hex");
export const DATASET = {
    name: "Snapstock Dividend Safety Index",
    tickerCount: records.length,
    scoredCount: scoredRecords.length,
    unscoredCount: records.length - scoredRecords.length,
    below4Count: scoredRecords.filter((record) => (record.score ?? 10) < 4).length,
    fcfPayoutOver100Count: records.filter((record) => record.fcfPayout !== null && record.fcfPayout > 100).length,
    dividendDeclined5yCount: records.filter((record) => record.dividendDeclined5y).length,
    dividendDeclined10yCount: records.filter((record) => record.dividendDeclined10y).length,
    dataDate: DATA_DATE,
    sectors: [...new Set(records.map((record) => record.sector).filter(Boolean))].sort(),
    securityTypes: [...new Set(records.map((record) => record.securityType).filter(Boolean))].sort()
};
export function normalizeTicker(raw) {
    return raw.trim().replace(/^\$/, "").toUpperCase();
}
export function getTicker(raw) {
    return byTicker.get(normalizeTicker(raw));
}
export function findSimilarTickers(raw, limit = 5) {
    const query = normalizeTicker(raw);
    if (query === "")
        return [];
    const startsWith = records
        .filter((record) => record.ticker.startsWith(query))
        .slice(0, limit)
        .map((record) => record.ticker);
    if (startsWith.length > 0)
        return startsWith;
    const contains = records
        .filter((record) => record.name.toUpperCase().includes(query))
        .slice(0, limit)
        .map((record) => record.ticker);
    return contains;
}
export function searchTickers(params) {
    const query = (params.query ?? "").trim().toLowerCase();
    const sector = (params.sector ?? "").trim().toLowerCase();
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const matches = records.filter((record) => {
        if (sector && record.sector.toLowerCase() !== sector)
            return false;
        if (params.minScore !== undefined || params.maxScore !== undefined) {
            if (record.score === null)
                return false;
            if (params.minScore !== undefined && record.score < params.minScore)
                return false;
            if (params.maxScore !== undefined && record.score > params.maxScore)
                return false;
        }
        if (params.minYield !== undefined) {
            if (record.dividendYield === null || record.dividendYield < params.minYield)
                return false;
        }
        if (query === "")
            return true;
        return record.ticker.toLowerCase().startsWith(query) || record.name.toLowerCase().includes(query);
    });
    const rank = (record) => {
        if (query === "")
            return 0;
        if (record.ticker.toLowerCase() === query)
            return 0;
        if (record.ticker.toLowerCase().startsWith(query))
            return 1;
        if (record.name.toLowerCase().startsWith(query))
            return 2;
        return 3;
    };
    matches.sort((a, b) => {
        const rankDiff = rank(a) - rank(b);
        if (rankDiff !== 0)
            return rankDiff;
        if (a.score === null && b.score === null)
            return a.ticker.localeCompare(b.ticker);
        if (a.score === null)
            return 1;
        if (b.score === null)
            return -1;
        return b.score - a.score || a.ticker.localeCompare(b.ticker);
    });
    return { totalMatches: matches.length, results: matches.slice(0, limit) };
}
export function listBelowThreshold(params) {
    const sector = (params.sector ?? "").trim().toLowerCase();
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
    const matches = records
        .filter((record) => record.score !== null && record.score < params.maxScore)
        .filter((record) => (sector ? record.sector.toLowerCase() === sector : true))
        .sort((a, b) => (a.score ?? 10) - (b.score ?? 10) || a.ticker.localeCompare(b.ticker));
    return { totalMatches: matches.length, results: matches.slice(0, limit) };
}
export function citation() {
    return `Snapstock Dividend Safety Index, data as of ${DATA_DATE}, ${SOURCE_URL}`;
}
export const DISCLAIMER = "Research aid only. Scores and flags are not investment advice, predictions, or guarantees against a dividend cut.";

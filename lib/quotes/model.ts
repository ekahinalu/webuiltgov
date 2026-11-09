import { formatMoney, parseMoney } from "../bids/model";
import { cleanText } from "../text";

export const VENDOR_LIMIT = 80;
export const QUOTE_LIMIT = 80;

export type QuoteComparison = {
  id: string;
  vendorName: string;
  trade: string | null;
  amountCents: number;
  covers: string;
};

export function vendorName(value: string): string | null {
  return cleanText(value, 200);
}

export function vendorTrade(value: string): string | null {
  return cleanText(value, 200);
}

export function quoteCovers(value: string): string | null {
  return cleanText(value, 500);
}

export function quoteAmount(value: string): number | null | "invalid" {
  return parseMoney(value);
}

export function compareQuotes(quotes: QuoteComparison[]): QuoteComparison[] {
  return [...quotes].sort((left, right) => left.amountCents - right.amountCents || left.vendorName.localeCompare(right.vendorName) || left.id.localeCompare(right.id));
}

export function comparisonSummary(quotes: QuoteComparison[]): string {
  if (quotes.length === 0) return "No quotes are entered for this bid.";
  if (quotes.length === 1) return "One quote is entered.";
  const ordered = compareQuotes(quotes);
  const lowest = ordered[0]?.amountCents;
  const tied = ordered.filter((quote) => quote.amountCents === lowest).length;
  if (lowest === undefined) return "No quotes are entered for this bid.";
  if (tied > 1) return `Lowest entered amount: ${formatMoney(lowest)}, on ${tied} quotes.`;
  return `Lowest entered amount: ${formatMoney(lowest)}.`;
}

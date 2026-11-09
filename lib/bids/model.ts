export const COST_LINES = [
  "labor",
  "materials",
  "equipment",
  "subcontractors",
  "overhead",
  "contingency",
  "profit",
] as const;

export type CostLine = (typeof COST_LINES)[number];

export const MONEY_COLUMNS = ["low", "expected", "high"] as const;
export type MoneyColumn = (typeof MONEY_COLUMNS)[number];

export const COST_LABEL: Record<CostLine, string> = {
  labor: "Labor",
  materials: "Materials",
  equipment: "Equipment",
  subcontractors: "Subcontractors",
  overhead: "Overhead",
  contingency: "Contingency",
  profit: "Profit",
};

export const COLUMN_LABEL: Record<MoneyColumn, string> = {
  low: "Low",
  expected: "Expected",
  high: "High",
};

export const BID_STAGES = [
  "identified",
  "review",
  "qualification",
  "bid_no_bid",
  "pursuit_approved",
  "estimating",
  "proposal_drafting",
  "submitted",
  "closed",
] as const;

export type BidStage = (typeof BID_STAGES)[number];

export const MAIN_BID_STAGES = [
  "identified",
  "review",
  "qualification",
  "bid_no_bid",
  "pursuit_approved",
  "estimating",
  "proposal_drafting",
] as const;

export const LATER_BID_STAGES = ["submitted", "closed"] as const;

export const BID_STAGE_LABEL: Record<BidStage, string> = {
  identified: "Identified",
  review: "Review",
  qualification: "Qualification",
  bid_no_bid: "Bid/no-bid",
  pursuit_approved: "Pursuit approved",
  estimating: "Estimating",
  proposal_drafting: "Proposal drafting",
  submitted: "Submitted",
  closed: "Closed",
};

export type LineAmounts = Record<MoneyColumn, number | null>;
export type EstimateAmounts = Record<CostLine, LineAmounts>;

export type ColumnTotal = {
  entered: number;
  totalCents: number | null;
  complete: boolean;
};

const MONEY_PATTERN = /^(?:\d{1,3}(?:,\d{3})+|\d{1,12})(?:\.\d{1,2})?$/;

export function isBidStage(value: unknown): value is BidStage {
  return typeof value === "string" && (BID_STAGES as readonly string[]).includes(value);
}

export function fieldName(line: CostLine, column: MoneyColumn): string {
  return `${line}${column[0]?.toUpperCase() ?? ""}${column.slice(1)}`;
}

export function emptyEstimate(): EstimateAmounts {
  const amounts = {} as EstimateAmounts;
  for (const line of COST_LINES) amounts[line] = { low: null, expected: null, high: null };
  return amounts;
}

export function parseMoney(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!MONEY_PATTERN.test(trimmed)) return "invalid";
  const [whole, fraction = ""] = trimmed.replace(/,/g, "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return "invalid";
  return cents;
}

export function moneyInput(cents: number | null): string {
  if (cents === null) return "";
  const whole = Math.trunc(cents / 100);
  const fraction = Math.abs(cents % 100);
  if (fraction === 0) return String(whole);
  return `${whole}.${String(fraction).padStart(2, "0")}`;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function columnTotal(amounts: EstimateAmounts, column: MoneyColumn): ColumnTotal {
  let entered = 0;
  let totalCents = 0;
  for (const line of COST_LINES) {
    const value = amounts[line][column];
    if (value === null) continue;
    entered += 1;
    totalCents += value;
  }
  return {
    entered,
    totalCents: entered === 0 ? null : totalCents,
    complete: entered === COST_LINES.length,
  };
}

export function describeTotal(total: ColumnTotal): string {
  if (total.entered === 0 || total.totalCents === null) return "No amounts entered";
  const money = formatMoney(total.totalCents);
  if (total.complete) return money;
  return `${money} from ${total.entered} of ${COST_LINES.length} amounts`;
}

export function readAmounts(fields: Record<string, string>): EstimateAmounts | "invalid" {
  const amounts = emptyEstimate();
  for (const line of COST_LINES) {
    for (const column of MONEY_COLUMNS) {
      const parsed = parseMoney(fields[fieldName(line, column)] ?? "");
      if (parsed === "invalid") return "invalid";
      amounts[line][column] = parsed;
    }
  }
  return amounts;
}

export function amountsEqual(left: EstimateAmounts, right: EstimateAmounts): boolean {
  return COST_LINES.every((line) => MONEY_COLUMNS.every((column) => left[line][column] === right[line][column]));
}

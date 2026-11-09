import { parseMoney } from "../bids/model";
import { isRealIsoDate } from "../dates";
import { cleanText } from "../text";

export const INVOICE_LIMIT = 80;
export const PAYMENT_LIMIT = 80;

export function invoiceNumber(value: string): string | null {
  return cleanText(value, 80);
}

export function invoiceAmount(value: string): number | null | "invalid" {
  return parseMoney(value);
}

export function paymentDate(value: string): string | null | "invalid" {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return isRealIsoDate(trimmed) ? trimmed : "invalid";
}

export function invoiceIsPaid(amountCents: number, paymentCents: number[]): boolean {
  if (paymentCents.length === 0) return false;
  return paymentCents.reduce((sum, cents) => sum + cents, 0) >= amountCents;
}

export function sumCents(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, cents) => sum + cents, 0);
}

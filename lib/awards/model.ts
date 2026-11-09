import { parseMoney } from "../bids/model";
import { isRealIsoDate } from "../dates";
import { cleanText } from "../text";

export const ITEM_LIMIT = 80;
export const ITEM_KINDS = ["milestone", "obligation"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export function isItemKind(value: string): value is ItemKind {
  return (ITEM_KINDS as readonly string[]).includes(value);
}

export function awardAmount(value: string): number | null | "invalid" {
  return parseMoney(value);
}

export function awardDate(value: string): string | null | "invalid" {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return isRealIsoDate(trimmed) ? trimmed : "invalid";
}

export function awardSource(value: string): string | null {
  return cleanText(value, 300);
}

export function itemName(value: string): string | null {
  return cleanText(value, 200);
}

export function itemDue(value: string): string | null | "invalid" {
  return awardDate(value);
}

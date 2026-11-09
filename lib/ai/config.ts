import { and, eq, gte } from "drizzle-orm";
import { AppError } from "../auth/roles";
import { assertRole } from "../auth/roles";
import type { Principal } from "../auth/principal";
import type { AppDatabase } from "../db/client";
import { aiAnswers, aiRequests, aiSettings } from "../db/schema";
import { isUuid, type Plane } from "../domain";
import { asDate } from "../dates";
import { getOpportunity } from "../opportunities/detail";
import { redactSecret } from "../text";

export const XAI_BASE_URL = "https://api.x.ai/v1";
export const DEFAULT_XAI_MODEL = "grok-4.7";
const REQUEST_LIMIT = 8;
const WINDOW_MS = 10 * 60 * 1000;

export function sanitizeModel(value: string): string | null {
  const model = value.trim();
  if (!/^[A-Za-z0-9._:-]{1,64}$/.test(model)) return null;
  return model;
}

export function xaiKey(): string | null {
  const key = process.env.XAI_API_KEY?.trim() ?? "";
  return key === "" ? null : key;
}

export async function getModel(db: AppDatabase, plane: Plane): Promise<string> {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.plane, plane)).limit(1);
  return sanitizeModel(row?.model ?? "") ?? sanitizeModel(process.env.XAI_MODEL ?? "") ?? DEFAULT_XAI_MODEL;
}

export async function setModel(db: AppDatabase, principal: Principal, modelInput: string): Promise<void> {
  assertRole(principal.role, "admin");
  const model = sanitizeModel(modelInput);
  if (!model) throw new AppError("invalid-model", "Model name must be 1-64 letters, numbers, dots, underscores, colons, or hyphens.", 400);
  await db
    .insert(aiSettings)
    .values({ plane: principal.plane, model, updatedAt: new Date() })
    .onConflictDoUpdate({ target: aiSettings.plane, set: { model, updatedAt: new Date() } });
}

export type AiAnswer = {
  prompt: string;
  answer: string | null;
  error: string | null;
  opportunityId: string | null;
  createdAt: Date;
};

export async function latestAnswer(db: AppDatabase, principal: Principal): Promise<AiAnswer | null> {
  const [row] = await db
    .select()
    .from(aiAnswers)
    .where(and(eq(aiAnswers.plane, principal.plane), eq(aiAnswers.userId, principal.userId)))
    .limit(1);
  if (!row) return null;
  return {
    prompt: row.prompt,
    answer: row.answer,
    error: row.error,
    opportunityId: row.opportunityId,
    createdAt: asDate(row.createdAt),
  };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function askModel(
  db: AppDatabase,
  principal: Principal,
  input: { prompt: string; opportunityId: string; fetchImpl?: FetchLike; apiKey?: string | null },
): Promise<void> {
  const prompt = input.prompt.trim();
  if (prompt.length === 0) throw new AppError("invalid-prompt", "Enter a question.", 400);
  if (prompt.length > 2000) throw new AppError("invalid-prompt", "Keep the question under 2000 characters.", 400);
  const apiKey = input.apiKey === undefined ? xaiKey() : input.apiKey?.trim() || null;
  if (!apiKey) throw new AppError("missing-key", "XAI_API_KEY is not set.", 409);

  let opportunity: Awaited<ReturnType<typeof getOpportunity>> = null;
  const opportunityId = input.opportunityId.trim();
  if (opportunityId !== "") {
    if (!isUuid(opportunityId)) throw new AppError("not-found", "That opportunity is not in this catalog.", 404);
    opportunity = await getOpportunity(db, principal, opportunityId);
    if (!opportunity) throw new AppError("not-found", "That opportunity is not in this catalog.", 404);
  }

  const since = new Date(Date.now() - WINDOW_MS);
  const recent = await db
    .select({ id: aiRequests.id })
    .from(aiRequests)
    .where(and(eq(aiRequests.plane, principal.plane), eq(aiRequests.userId, principal.userId), gte(aiRequests.createdAt, since)));
  if (recent.length >= REQUEST_LIMIT) {
    throw new AppError("ai-limit", "AI is limited to 8 requests every 10 minutes.", 429);
  }
  await db.insert(aiRequests).values({
    id: crypto.randomUUID(),
    plane: principal.plane,
    userId: principal.userId,
    createdAt: new Date(),
  });

  const model = await getModel(db, principal.plane);
  const fetchImpl = input.fetchImpl ?? fetch;
  const record = opportunity
    ? {
        title: opportunity.title,
        agency: opportunity.agency,
        solicitationNumber: opportunity.solicitationNumber,
        description: opportunity.description,
        governmentLevel: opportunity.governmentLevel,
        location: opportunity.location,
        naics: opportunity.naics,
        deadline: opportunity.deadline,
        deadlineRaw: opportunity.deadlineRaw,
        recordKind: opportunity.recordKind,
        source: opportunity.source,
        sourceUrl: opportunity.sourceUrl,
        sourceFacts: opportunity.sourceFacts,
        yourPipelineStatus: opportunity.pipelineStatus,
      }
    : null;
  let answer: string | null = null;
  let error: string | null = null;
  try {
    const response = await fetchImpl(`${XAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content:
              "You help a user read government opportunity records already stored in WeBuiltGov. Use only the record in the user message. If a field was not provided, say it was not provided. Do not invent solicitations, awards, deadlines, amounts, or agencies.",
          },
          {
            role: "user",
            content: record
              ? `Record:\n${JSON.stringify(record)}\n\nQuestion:\n${prompt}`
              : `No opportunity record was selected.\n\nQuestion:\n${prompt}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(25000),
      redirect: "manual",
    });
    const body = await response.text();
    if (response.status < 200 || response.status >= 300) {
      error = publicAiError(response.status, body, apiKey);
    } else {
      const parsed = JSON.parse(body) as { choices?: { message?: { content?: unknown } }[] };
      const content = parsed.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim() === "") error = "The model returned an empty response.";
      else answer = content.trim().slice(0, 8000);
    }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "The AI request failed.";
    error = redactSecret(message, apiKey) || "The AI request failed.";
  }

  await db
    .insert(aiAnswers)
    .values({
      plane: principal.plane,
      userId: principal.userId,
      opportunityId: opportunity?.id ?? null,
      prompt,
      answer,
      error,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [aiAnswers.plane, aiAnswers.userId],
      set: {
        opportunityId: opportunity?.id ?? null,
        prompt,
        answer,
        error,
        createdAt: new Date(),
      },
    });
}

const STORED_DRAFT_SYSTEM =
  "You draft a note from stored WeBuiltGov records supplied in the user message. Cite only those fields. If a value is null, say it was not stored. Do not invent awards, competitors, credentials, past performance, or a win probability. Do not choose a recommendation.";

export async function askStoredDraft(
  db: AppDatabase,
  principal: Principal,
  input: { packet: unknown; fetchImpl?: FetchLike; apiKey?: string | null },
): Promise<{ model: string; draft: string | null; error: string | null }> {
  assertRole(principal.role, "member");
  const apiKey = input.apiKey === undefined ? xaiKey() : input.apiKey?.trim() || null;
  if (!apiKey) throw new AppError("missing-key", "XAI_API_KEY is not set.", 409);
  const since = new Date(Date.now() - WINDOW_MS);
  const recent = await db
    .select({ id: aiRequests.id })
    .from(aiRequests)
    .where(and(eq(aiRequests.plane, principal.plane), eq(aiRequests.userId, principal.userId), gte(aiRequests.createdAt, since)));
  if (recent.length >= REQUEST_LIMIT) throw new AppError("ai-limit", "AI is limited to 8 requests every 10 minutes.", 429);
  await db.insert(aiRequests).values({
    id: crypto.randomUUID(),
    plane: principal.plane,
    userId: principal.userId,
    createdAt: new Date(),
  });
  const model = await getModel(db, principal.plane);
  const fetchImpl = input.fetchImpl ?? fetch;
  let draft: string | null = null;
  let error: string | null = null;
  try {
    const response = await fetchImpl(`${XAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          { role: "system", content: STORED_DRAFT_SYSTEM },
          { role: "user", content: `Stored records:\n${JSON.stringify(input.packet)}` },
        ],
      }),
      signal: AbortSignal.timeout(25000),
      redirect: "manual",
    });
    const body = await response.text();
    if (response.status < 200 || response.status >= 300) {
      error = publicAiError(response.status, body, apiKey);
    } else {
      const parsed = JSON.parse(body) as { choices?: { message?: { content?: unknown } }[] };
      const content = parsed.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim() === "") error = "The model returned an empty response.";
      else draft = content.trim().slice(0, 8000);
    }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "The AI request failed.";
    error = redactSecret(message, apiKey) || "The AI request failed.";
  }
  return { model, draft, error };
}

function publicAiError(status: number, body: string, apiKey: string): string {
  const redacted = redactSecret(body, apiKey);
  if (redacted !== body || /api_key|bearer|sk-/i.test(body)) return `xAI returned HTTP ${status}.`;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string };
    const message = typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
    if (message && message.length < 240 && !/api_key|bearer|sk-/i.test(message)) return message;
  } catch {
    // The body was not JSON.
  }
  return `xAI returned HTTP ${status}.`;
}

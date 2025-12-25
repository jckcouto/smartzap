import "server-only";

import { getWhatsAppCredentials } from "@/lib/whatsapp-credentials";
import { normalizePhoneNumber } from "@/lib/phone-formatter";
import { fetchWithTimeout, safeJson, safeText } from "@/lib/server-http";

type WhatsAppCredentials = {
  accessToken: string;
  phoneNumberId: string;
};

export type ResolveRecipientInput = {
  to?: string;
  toSource?: string;
  triggerData?: Record<string, unknown>;
};

export function resolveRecipient(input: ResolveRecipientInput): {
  ok: true;
  to: string;
} | {
  ok: false;
  error: string;
} {
  const source = input.toSource || "manual";
  const triggerData = input.triggerData ?? {};
  const inbound =
    (triggerData.from as string | undefined) ||
    (triggerData.to as string | undefined) ||
    (triggerData.phone as string | undefined) ||
    "";
  const rawTo = source === "inbound" ? inbound : input.to || "";
  const normalized = normalizePhoneNumber(rawTo);
  if (!normalized) {
    return { ok: false, error: "Recipient phone number is required" };
  }
  return { ok: true, to: normalized };
}

export async function getCredentials(): Promise<WhatsAppCredentials | null> {
  const credentials = await getWhatsAppCredentials();
  if (!credentials?.accessToken || !credentials?.phoneNumberId) {
    return null;
  }
  return {
    accessToken: credentials.accessToken,
    phoneNumberId: credentials.phoneNumberId,
  };
}

export async function sendWhatsAppPayload(
  credentials: WhatsAppCredentials,
  payload: unknown
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; data?: unknown }> {
  const response = await fetchWithTimeout(
    `https://graph.facebook.com/v24.0/${credentials.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      timeoutMs: 8000,
    }
  );

  const data = await safeJson(response);
  if (!response.ok) {
    const details = data ?? (await safeText(response));
    return {
      ok: false,
      error: "WhatsApp send failed",
      data: details ?? undefined,
    };
  }

  return { ok: true, data };
}

export function parseJsonArray<T>(
  raw: unknown,
  fallback: T[] = []
): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw !== "string" || raw.trim().length === 0) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

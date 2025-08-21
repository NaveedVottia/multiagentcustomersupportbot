export type ZapierEvent = {
  eventType: string;
  data: unknown;
  timestamp?: string;
};

export async function sendZapierEvent(
  eventType: string,
  data: unknown,
  options?: { abortSignal?: AbortSignal }
): Promise<void> {
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (!webhookUrl) return; // Silently no-op if not configured

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const secret = process.env.ZAPIER_WEBHOOK_SECRET;
  if (secret) headers["X-Webhook-Secret"] = secret;

  const body: ZapierEvent = {
    eventType,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options?.abortSignal,
    });
  } catch {
    // Do not throw to avoid disrupting tool logic; logging handled by server logger
  }
}



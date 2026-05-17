import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const defaultAiBaseUrl = "https://api.deepseek.com";

export async function callChatCompletions({
  apiKey,
  baseUrl,
  jsonMode,
  messages,
  model,
  temperature
}: {
  apiKey: string;
  baseUrl: string;
  jsonMode: boolean;
  messages: Array<{ content: string; role: string }>;
  model: string;
  temperature: number;
}) {
  return fetch(`${baseUrl}/chat/completions`, {
    body: JSON.stringify({
      messages,
      model,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      temperature
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });
}

export function extractJson(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI 输出不是有效 JSON。");
  return match[0];
}

export function resolveAiConfig(input: unknown) {
  const config = (input || {}) as { apiKey?: string; baseUrl?: string; model?: string };
  return {
    apiKey: config.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "",
    baseUrl: trimTrailingSlash(config.baseUrl || process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || defaultAiBaseUrl),
    model: config.model || process.env.AI_MODEL || process.env.OPENAI_MODEL || "deepseek-v4-flash"
  };
}

export function simplifyAiError(text: string) {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string; type?: string }; message?: string };
    return parsed.error?.message || parsed.message || text.slice(0, 500);
  } catch {
    return text.slice(0, 500);
  }
}

export function loadLocalEnv() {
  const candidates = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index <= 0) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

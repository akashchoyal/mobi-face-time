/**
 * External Python FastAPI backend integration — DISABLED by default.
 *
 * The app only calls the external backend when BOTH secrets are configured:
 *   - PY_BACKEND_URL       e.g. https://api.yourschool.com
 *   - PY_BACKEND_API_KEY   shared bearer token the FastAPI server checks
 *
 * Expected endpoint contract (implemented by the external FastAPI server):
 *   POST {PY_BACKEND_URL}/v1/face-match
 *   Headers: Authorization: Bearer <PY_BACKEND_API_KEY>
 *   Body:    { "reference_image": "<data url>", "selfie_image": "<data url>" }
 *   200:     { "same_person": boolean, "confidence": 0-1, "reason": string }
 *
 * Until those secrets exist this module is never called and face matching
 * keeps using the built-in Lovable AI gateway check.
 */
export type MatchResult = { same_person: boolean; confidence: number; reason: string };

export function isPyBackendConfigured(): boolean {
  return Boolean(process.env["PY_BACKEND_URL"] && process.env["PY_BACKEND_API_KEY"]);
}

export async function compareFacesViaBackend(
  reference: string,
  selfie: string,
): Promise<MatchResult> {
  const baseUrl = process.env["PY_BACKEND_URL"]!.replace(/\/+$/, "");
  const apiKey = process.env["PY_BACKEND_API_KEY"]!;

  const response = await fetch(`${baseUrl}/v1/face-match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ reference_image: reference, selfie_image: selfie }),
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status === 401 || response.status === 403)
    throw new Error("The face-check backend rejected the app's key.");
  if (response.status === 429)
    throw new Error("Too many checks right now — try again in a moment.");
  if (!response.ok) throw new Error(`Face check failed (${response.status})`);

  const payload = (await response.json()) as Partial<MatchResult>;
  return {
    same_person: Boolean(payload.same_person),
    confidence: Math.max(0, Math.min(1, Number(payload.confidence ?? 0))),
    reason: String(payload.reason ?? ""),
  };
}

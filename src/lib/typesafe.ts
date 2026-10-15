const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const TIMEOUT_MS = 8000;
/** Pinned, not "jev-latest": the alias moves on TypeSafe's schedule, and the user's threshold
 * is tuned against one version's scores. 1.14 mainly improves non-English titles. Bumping
 * this also starts a fresh score cache (see background). */
export const JEV_MODEL = "jev-1.14.0";

interface NoulAnswer {
  type: "noul";
  noul: number;
}

interface SystemOneResponse {
  model: string;
  answers: {
    on_topic: NoulAnswer;
  };
}

export class TypeSafeError extends Error {}

/**
 * Asks Jev (TypeSafe's System One model) a single Noul question: does this video
 * match the user's configured focus-mode topics? Returns a 0..1 score, no text parsing.
 */
export async function classifyVideoOnTopic(
  apiKey: string,
  state: string,
  topicDescription: string,
): Promise<number> {
  const instructions = `The video matches the user's approved focus-mode topics: ${topicDescription}`;
  const res = await fetch(TYPESAFE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    // A hung request would otherwise leave the "checking" card up until the worker dies.
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      state,
      model: JEV_MODEL,
      questions: {
        on_topic: {
          type: "noul",
          instructions,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[focus-mode][jev] API error", res.status, body);
    throw new TypeSafeError(`TypeSafe API error: ${res.status}`);
  }

  const data = (await res.json()) as Partial<SystemOneResponse>;
  const noul = data.answers?.on_topic?.noul;
  if (typeof noul !== "number" || !Number.isFinite(noul)) {
    throw new TypeSafeError("TypeSafe returned an unexpected response");
  }
  return noul;
}

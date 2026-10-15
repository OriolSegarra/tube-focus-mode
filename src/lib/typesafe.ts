const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

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
  console.log("[focus-mode][jev] calling TypeSafe", { state, instructions, hasApiKey: !!apiKey });

  const res = await fetch(TYPESAFE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      state,
      model: "jev-latest",
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
    throw new TypeSafeError(`TypeSafe API error: ${res.status} ${body}`);
  }

  const data = (await res.json()) as SystemOneResponse;
  console.log("[focus-mode][jev] response", data);
  return data.answers.on_topic.noul;
}

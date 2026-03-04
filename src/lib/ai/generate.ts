import type { EndpointType, Model, Provider } from "./config";

export interface GenerateInput {
  prompt: string;
  model: Model;
  provider: Provider;
  params?: Record<string, unknown>;
}

export interface GenerateResult {
  content: string;
  type: "text" | "url" | "binary";
  raw?: unknown;
}

export type Adapter = (input: GenerateInput) => Promise<GenerateResult>;

function buildHeaders(provider: Provider): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${provider.apiKey}`,
  };
}

async function handleError(
  response: Response,
  context: string,
): Promise<never> {
  const text = await response.text();
  throw new Error(
    `${context}: ${response.status} ${response.statusText} - ${text}`,
  );
}

async function chatCompletionsAdapter(
  input: GenerateInput,
): Promise<GenerateResult> {
  const { prompt, model, provider, params } = input;
  const url = `${provider.baseUrl}/v1/chat/completions`;

  const messages = (params?.messages as Array<{
    role: string;
    content: unknown;
  }>) ?? [{ role: "user", content: prompt }];

  const payload: Record<string, unknown> = {
    model: model.id,
    messages,
    ...params,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(provider),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await handleError(response, "Chat completions API error");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return { content, type: "text", raw: data };
  }

  const images = data.choices?.[0]?.message?.images;
  if (Array.isArray(images) && images.length > 0) {
    const imgUrl = images[0]?.image_url?.url ?? images[0]?.url ?? "";
    if (!imgUrl) {
      throw new Error("No image URL in chat completions response");
    }
    return { content: imgUrl, type: "url", raw: data };
  }

  throw new Error("Invalid response from chat completions API");
}

async function imagesGenerationsAdapter(
  input: GenerateInput,
): Promise<GenerateResult> {
  const { prompt, model, provider, params } = input;
  const url = `${provider.baseUrl}/v1/images/generations`;

  const payload: Record<string, unknown> = {
    model: model.id,
    prompt,
    n: 1,
    size: "1024x1024",
    response_format: "url",
    sse: true,
    ...params,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(provider),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await handleError(response, "Images generations API error");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body from images generations API");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let resultUrl = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      if (!chunk.startsWith("data: ")) continue;
      const dataStr = chunk.slice(6);
      if (dataStr === "[DONE]" || dataStr === ": keepalive") continue;

      try {
        const data = JSON.parse(dataStr);
        const url = data.data?.[0]?.url ?? data.url;
        if (url) resultUrl = url;
      } catch {
        // Skip unparseable SSE data
      }
    }
  }

  if (!resultUrl) {
    throw new Error("No URL found in images generations SSE stream");
  }

  return { content: resultUrl, type: "url" };
}

async function audioSpeechAdapter(
  input: GenerateInput,
): Promise<GenerateResult> {
  const { prompt, model, provider, params } = input;
  const url = `${provider.baseUrl}/v1/audio/speech`;

  const payload: Record<string, unknown> = {
    model: model.id,
    input: prompt,
    voice: params?.voice ?? "alloy",
    ...params,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(provider),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await handleError(response, "Audio speech API error");
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    content: base64,
    type: "binary",
    raw: { size: arrayBuffer.byteLength, mimeType: "audio/mpeg" },
  };
}

const adapters: Record<EndpointType, Adapter> = {
  "chat/completions": chatCompletionsAdapter,
  "images/generations": imagesGenerationsAdapter,
  "audio/speech": audioSpeechAdapter,
};

export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const adapter = adapters[input.model.endpoint];
  if (!adapter) {
    throw new Error(`No adapter for endpoint: ${input.model.endpoint}`);
  }
  return adapter(input);
}

/**
 * AI Unified Proxy — Client Helpers + Test Runner
 *
 * ── Client helpers (copy-paste ready):
 *   generateText, generateImage, generateImageWithRefs,
 *   generateVideo, generateVideoWithRef, generateSpeech,
 *   generateMusic, transcribe, fileToDataUri, readSse
 *
 * ── Test runner:
 *   bun tests/tests.ts <type>
 *   Types: all, text, image, voice, music, video, transcription
 *
 * No dependencies — uses fetch only.
 */

// const BASE_URL = process.env.BASE_URL || "https://api.louzlabs.com.br";
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const API_KEY = process.env.ACCESS_KEY || "YOUR_API_KEY";

const authHeaders = () => ({
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
});

// ── SSE Reader ─────────────────────────────────────────────────

async function readSse(res: Response, timeoutMs = 300_000): Promise<string | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const chunks = buf.split("\n\n");
    buf = chunks.pop() ?? "";

    for (const chunk of chunks) {
      if (!chunk.startsWith("data: ")) continue;
      const data = chunk.slice(6).trim();
      if (data === "[DONE]" || data.startsWith(": ")) continue;
      try {
        const parsed = JSON.parse(data) as { url?: string; error?: string };
        if (parsed.url) return parsed.url;
        if (parsed.error) return null;
      } catch { /* skip */ }
    }
  }

  return null;
}

// ── Text Generation ────────────────────────────────────────────

async function generateText(prompt: string, model = "gemini-3.1-flash-lite-preview") {
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ prompt, model }),
  });
  if (!res.ok) throw new Error(`Text failed (${res.status}): ${await res.text()}`);
  const { text } = (await res.json()) as { text: string };
  return text;
}

// ── Image Generation ───────────────────────────────────────────

async function generateImage(prompt: string, opts?: { aspect_ratio?: string; size?: string; model?: string }) {
  const res = await fetch(`${BASE_URL}/v1/images/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ prompt, ...opts }),
  });
  if (!res.ok) throw new Error(`Image failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as { url: string | null; b64_json: string | null };
}

async function generateImageWithRefs(
  prompt: string,
  images: string[],
  opts?: { aspect_ratio?: string; size?: string; model?: string },
) {
  const res = await fetch(`${BASE_URL}/v1/images/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ prompt, images, ...opts }),
  });
  if (!res.ok) throw new Error(`Image failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as { url: string | null; b64_json: string | null };
}

// ── Video Generation (SSE) ─────────────────────────────────────

async function generateVideo(prompt: string, opts?: { aspect_ratio?: string; model?: string }) {
  const res = await fetch(`${BASE_URL}/v1/video/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ prompt, ...opts }),
  });
  return readSse(res, 600_000);
}

async function generateVideoWithRef(
  prompt: string,
  image: string,
  opts?: { aspect_ratio?: string; model?: string },
) {
  const res = await fetch(`${BASE_URL}/v1/video/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ prompt, images: [image], ...opts }),
  });
  return readSse(res, 600_000);
}

// ── Text-to-Speech ─────────────────────────────────────────────

async function generateSpeech(prompt: string, voice?: string) {
  const res = await fetch(`${BASE_URL}/v1/audio/speech`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ prompt, voice }),
  });
  if (!res.ok) throw new Error(`Speech failed (${res.status}): ${await res.text()}`);
  return res.arrayBuffer();
}

// ── Music Generation (SSE) ─────────────────────────────────────

async function generateMusic(prompt: string, opts?: { style?: string; instrumental?: boolean }) {
  const res = await fetch(`${BASE_URL}/v1/music/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ prompt, ...opts }),
  });
  return readSse(res, 600_000);
}

// ── Transcription ──────────────────────────────────────────────

async function transcribe(audioFilePath: string) {
  const file = Bun.file(audioFilePath);
  const form = new FormData();
  form.append("file", new Blob([await file.arrayBuffer()], { type: file.type }), audioFilePath);

  const res = await fetch(`${BASE_URL}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as { words: Array<{ text: string; startMs: number; endMs: number }> };
}

// ── Utility ────────────────────────────────────────────────────

async function fileToDataUri(filePath: string) {
  const file = Bun.file(filePath);
  const bytes = await file.arrayBuffer();
  return `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;
}

// ═══════════════════════════════════════════════════════════════
// Test Runner (executed only when run as CLI)
// ═══════════════════════════════════════════════════════════════

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RESULTS_DIR = "tests-results";
const DEMOS_DIR = join(import.meta.dir, "..", "demos");

async function saveTestResult(name: string, data: unknown, media?: { buffer: Buffer | ArrayBuffer | Uint8Array; extension: string }) {
  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(join(RESULTS_DIR, `${name}.json`), JSON.stringify(data, null, 2));
  if (media) {
    await writeFile(join(RESULTS_DIR, `${name}.${media.extension}`), Buffer.from(media.buffer as ArrayBuffer));
  }
}

const VALID_TYPES = ["all", "text", "image", "voice", "music", "video", "transcription"] as const;
type TestType = (typeof VALID_TYPES)[number];

function log(type: string, msg: string, status: "pending" | "ok" | "fail" | "info") {
  const icons = { pending: "⏳", ok: "✅", fail: "❌", info: "ℹ️" };
  console.log(`${icons[status]} [${type.padEnd(5)}] ${msg}`);
}

async function testText(): Promise<boolean> {
  log("text", "POST /v1/chat/completions", "pending");
  try {
    const text = await generateText("Say 'hello' in one word");
    if (typeof text !== "string") {
      log("text", `No text in response`, "fail");
      return false;
    }
    await saveTestResult("text", { text });
    log("text", `OK: "${text.slice(0, 50)}..."`, "ok");
    return true;
  } catch (e) {
    log("text", `Error: ${e}`, "fail");
    return false;
  }
}

async function testImage(): Promise<boolean> {
  log("image", "POST /v1/images/generations (with ref images)", "pending");
  try {
    const ref1 = await fileToDataUri(join(DEMOS_DIR, "image-example.png"));
    const ref2 = await fileToDataUri(join(DEMOS_DIR, "generated.jpg"));
    const data = await generateImageWithRefs(
      "Blend these two images into a surreal composition",
      [ref1, ref2],
      { aspect_ratio: "16:9", size: "2K" },
    );
    if (!data.url && !data.b64_json) {
      log("image", `No url or b64_json`, "fail");
      return false;
    }
    const buffer = data.url ? await fetch(data.url).then(r => r.arrayBuffer()) : Buffer.from(data.b64_json!, "base64");
    await saveTestResult("image", data, { buffer, extension: "png" });
    log("image", `OK: ${data.url ?? "(b64)"}`, "ok");
    return true;
  } catch (e) {
    log("image", `Error: ${e}`, "fail");
    return false;
  }
}

async function testVoice(): Promise<boolean> {
  log("voice", "POST /v1/audio/speech", "pending");
  try {
    const buffer = await generateSpeech("Test voice synthesis.", "nPczCjzI2devNBz1zQrb");
    if (buffer.byteLength < 1000) {
      log("voice", `Audio too small: ${buffer.byteLength}B`, "fail");
      return false;
    }
    await saveTestResult("voice", { size: buffer.byteLength }, { buffer, extension: "mp3" });
    log("voice", `OK: ${buffer.byteLength} bytes`, "ok");
    return true;
  } catch (e) {
    log("voice", `Error: ${e}`, "fail");
    return false;
  }
}

async function testMusic(): Promise<boolean> {
  log("music", "POST /v1/music/generations", "pending");
  try {
    const url = await generateMusic("A short brazilian funk", { style: "brazilian funk", instrumental: true });
    if (!url) {
      log("music", "No url received from SSE stream", "fail");
      return false;
    }
    const buffer = await fetch(url).then(r => r.arrayBuffer());
    await saveTestResult("music", { url }, { buffer, extension: "mp3" });
    log("music", `OK: ${url}`, "ok");
    return true;
  } catch (e) {
    log("music", `Error: ${e}`, "fail");
    return false;
  }
}

async function testVideo(): Promise<boolean> {
  log("video", "POST /v1/video/generations (with ref image)", "pending");
  try {
    const refImage = await fileToDataUri(join(DEMOS_DIR, "image-example.png"));
    const url = await generateVideoWithRef(
      "Animate this scene: a bird taking flight from a tree branch at golden hour",
      refImage,
      { aspect_ratio: "16:9" },
    );
    if (!url) {
      log("video", "No url received from SSE stream", "fail");
      return false;
    }
    const buffer = await fetch(url).then(r => r.arrayBuffer());
    await saveTestResult("video", { url }, { buffer, extension: "mp4" });
    log("video", `OK: ${url}`, "ok");
    return true;
  } catch (e) {
    log("video", `Error: ${e}`, "fail");
    return false;
  }
}

async function testTranscription(): Promise<boolean> {
  log("trans", "POST /v1/audio/transcriptions", "pending");
  try {
    const audio = await generateSpeech("Hello world, this is a test.", "nPczCjzI2devNBz1zQrb");
    const tmpPath = join(RESULTS_DIR, "_trans_input.mp3");
    await mkdir(RESULTS_DIR, { recursive: true });
    await writeFile(tmpPath, Buffer.from(audio));
    const result = await transcribe(tmpPath);
    if (!result.words || result.words.length === 0) {
      log("trans", `No words in response`, "fail");
      return false;
    }
    await saveTestResult("transcription", result);
    log("trans", `OK: Found ${result.words.length} words`, "ok");
    return true;
  } catch (e) {
    log("trans", `Error: ${e}`, "fail");
    return false;
  }
}

const tests: Record<TestType, () => Promise<boolean>> = {
  all: async () => {
    const results: boolean[] = [];
    const run = async (fn: () => Promise<boolean>) => results.push(await fn());
    await run(testText);
    await run(testImage);
    await run(testVoice);
    await run(testTranscription);
    await run(testMusic);
    await run(testVideo);
    return results.every(Boolean);
  },
  text: testText,
  image: testImage,
  voice: testVoice,
  transcription: testTranscription,
  music: testMusic,
  video: testVideo,
};

async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(maxMs = 10_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await checkServer()) return true;
    await Bun.sleep(200);
  }
  return false;
}

async function startServer(): Promise<ReturnType<typeof Bun.spawn> | null> {
  const proc = Bun.spawn(["bun", "src/server.ts"], {
    env: { ...process.env },
    stdout: "ignore",
    stderr: "ignore",
  });
  const ready = await waitForServer();
  if (!ready) {
    proc.kill();
    return null;
  }
  return proc;
}

async function main() {
  const arg = process.argv[2]?.toLowerCase() as TestType | undefined;

  if (!arg || !VALID_TYPES.includes(arg)) {
    console.log(`\nUsage: bun tests/tests.ts <type>\n`);
    console.log(`Types: ${VALID_TYPES.join(", ")}\n`);
    console.log(`Examples:`);
    console.log(`  bun tests/tests.ts all            # Run all tests`);
    console.log(`  bun tests/tests.ts text           # Test chat completions`);
    console.log(`  bun tests/tests.ts image          # Test image generation (with refs)`);
    console.log(`  bun tests/tests.ts voice          # Test speech synthesis`);
    console.log(`  bun tests/tests.ts transcription  # Test audio transcription`);
    console.log(`  bun tests/tests.ts music          # Test music generation`);
    console.log(`  bun tests/tests.ts video          # Test video generation (with ref)\n`);
    process.exit(1);
  }

  console.log(`\nTarget: ${BASE_URL}\n`);

  let spawned: ReturnType<typeof Bun.spawn> | null = null;

  if (!await checkServer()) {
    log("setup", "Server not running — starting...", "info");
    spawned = await startServer();
    if (!spawned) {
      log("setup", `Server failed to start at ${BASE_URL}`, "fail");
      process.exit(1);
    }
    log("setup", "Server started", "ok");
  } else {
    log("setup", "Server is up", "ok");
  }

  const ok = await tests[arg]();
  console.log();

  if (spawned) {
    spawned.kill();
    log("setup", "Server stopped", "info");
  }

  process.exit(ok ? 0 : 1);
}

main();

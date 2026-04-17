const { LOUZLABS_BASE_URL, LOUZLABS_API_KEY } = process.env;

async function transcribe(audioFilePath: string) {
  const file = Bun.file(audioFilePath);
  const form = new FormData();
  form.append("file", new Blob([await file.arrayBuffer()], { type: file.type }), audioFilePath);

  const res = await fetch(`${LOUZLABS_BASE_URL}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOUZLABS_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as { words: Array<{ text: string; startMs: number; endMs: number }> };
}

const path = Bun.argv[2];
if (!path) {
  console.error("Usage: bun run stt.ts <audio-file-path>");
  process.exit(1);
}

const result = await transcribe(path);
console.log(JSON.stringify(result, null, 2));
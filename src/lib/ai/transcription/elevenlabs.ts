import fs from "fs";
import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { executeWithAnonymousProxy } from "@/lib/networking/proxy-service";

interface ElevenLabsWord {
  text: string;
  start: number;
  end: number;
  type: string;
  speaker_id?: string;
}

interface ElevenLabsResponse {
  language_code: string;
  language_probability: number;
  text: string;
  words: ElevenLabsWord[];
}

function postMultipart(
  url: string,
  formData: FormData,
  agent: InstanceType<typeof HttpsProxyAgent>
): Promise<{ status: number; body: string }> {
  return new Promise(async (resolve, reject) => {
    const boundary = `----BunBoundary${Date.now()}${Math.random().toString(36).slice(2)}`;
    const fileBuffer = fs.readFileSync(
      (formData as any)._filePath as string
    );
    const fileName = (formData as any)._fileName as string;

    const fields: Record<string, string> = {};
    formData.forEach((value, key) => {
      if (typeof value === "string") fields[key] = value;
    });

    let body = "";
    for (const [key, value] of Object.entries(fields)) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      body += `${value}\r\n`;
    }

    const fileHeader =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: audio/mpeg\r\n\r\n`;
    const fileFooter = `\r\n--${boundary}--\r\n`;

    const headerBuf = Buffer.from(fileHeader, "utf-8");
    const footerBuf = Buffer.from(fileFooter, "utf-8");
    const fieldsBuf = Buffer.from(body, "utf-8");
    const fullBody = Buffer.concat([fieldsBuf, headerBuf, fileBuffer, footerBuf]);

    const parsed = new URL(url);
    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": fullBody.length,
      },
      agent,
    };

    const timeout = setTimeout(() => reject(new Error("Request timeout")), 120000);

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        clearTimeout(timeout);
        resolve({ status: res.statusCode || 0, body: data });
      });
    });

    req.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    req.write(fullBody);
    req.end();
  });
}

export const transcribeWithElevenLabs = async (
  filePath: string
): Promise<{ text: string; startMs: number; endMs: number }[]> => {
  const fileName = filePath.split("/").pop() ?? "audio.mp3";

  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("tag_audio_events", "true");
  form.append("diarize", "true");
  (form as any)._filePath = filePath;
  (form as any)._fileName = fileName;

  console.log(`[ElevenLabs STT] Transcribing ${fileName} via anonymous proxy...`);

  const result = await executeWithAnonymousProxy(async (agent) => {
    const res = await postMultipart(
      "https://api.elevenlabs.io/v1/speech-to-text?allow_unauthenticated=1",
      form,
      agent
    );

    if (res.status !== 200) {
      throw new Error(
        `ElevenLabs STT failed: ${res.status} - ${res.body}`
      );
    }

    return res;
  });

  const data: ElevenLabsResponse = JSON.parse(result.body);

  console.log(
    `[ElevenLabs STT] Got ${data.words.length} tokens, language: ${data.language_code}`
  );

  return data.words
    .filter((w) => w.type === "word")
    .map((w) => ({
      text: w.text.replace(/[.,;:!?…]/g, ""),
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
    }))
    .filter((w) => w.text.length > 0);
};

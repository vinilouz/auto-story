import fs from "fs/promises";
import path from "path";
import { createLogger } from "@/lib/logger";

const log = createLogger("anondrop");
const ANONDROP_BASE = "https://anondrop.net";

/**
 * Extrai URL de uma resposta do AnonDrop e garante que é o link DIRETO para o arquivo.
 */
function extractAnonDropUrl(text: string, filename: string): string | null {
  // 1. Tenta JSON primeiro (caso a API mude no futuro)
  try {
    const data = JSON.parse(text);
    const url = data.url || data.download_url || data.direct_url;
    if (url) return url;
    const fileId = data.id || data.fileId || data.file_id;
    if (fileId) return `${ANONDROP_BASE}/${fileId}/${filename}`;
  } catch {
    // ignorar erro de JSON, fallback para texto
  }

  // 2. Resposta Texto/HTML: Isola a URL ignorando aspas ou tags HTML (<, >, ', ")
  const match = text.match(/https?:\/\/[^\s"'<>]+/);
  if (!match) return null;

  const extractedUrl = match[0].replace(/[.,;]+$/, ""); // limpa pontuação

  // 3. Verifica se a URL retornada é apenas a Landing Page (ex: /1481306518379823280)
  try {
    const urlObj = new URL(extractedUrl);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);

    // Se a URL tiver apenas 1 parte no caminho (o ID), anexamos o nome do arquivo
    if (pathParts.length === 1) {
      return `${ANONDROP_BASE}/${pathParts[0]}/${filename}`;
    }
  } catch {
    // Falha silenciosa no URL parser, segue em frente com a extractedUrl
  }

  return extractedUrl;
}

/**
 * Uploads a Buffer directly to AnonDrop and returns the public URL.
 * More efficient than converting local files back-and-forth from base64.
 */
export async function uploadBufferToAnonDrop(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const key = process.env.ANONDROP_KEY;
  if (!key) throw new Error("ANONDROP_KEY not set");

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(`${ANONDROP_BASE}/upload?key=${key}`, {
    method: "POST",
    body: form,
  });

  const responseText = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(
      `AnonDrop upload failed: HTTP ${res.status} — ${responseText.substring(0, 200)}`,
    );
  }
  const url = extractAnonDropUrl(responseText, filename);
  if (!url) {
    throw new Error(
      `AnonDrop: não foi possível extrair URL da resposta: "${responseText.substring(0, 200)}"`,
    );
  }
  // Single, clean log line with size, filename, and final URL
  const sizeKb = Math.round(buffer.length / 1024);
  log.success(`AnonDrop: Uploaded ${filename} (${sizeKb}kb) -> ${url}`);

  return url;
}

/**
 * Uploads a base64 image to AnonDrop and returns the public URL.
 */
export async function uploadToAnonDrop(
  base64Data: string,
  filename?: string,
): Promise<string> {
  // Strip data URL prefix if present
  let raw = base64Data;
  let mimeType = "image/png";
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    raw = match[2];
  }

  const buffer = Buffer.from(raw, "base64");
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const name = filename || `ref-${Date.now()}.${ext}`;

  return uploadBufferToAnonDrop(buffer, mimeType, name);
}

/**
 * Upload from a remote URL via AnonDrop's remote upload.
 */
export async function remoteUploadToAnonDrop(
  sourceUrl: string,
  filename?: string,
): Promise<string> {
  const key = process.env.ANONDROP_KEY;
  if (!key) throw new Error("ANONDROP_KEY not set");

  const name = filename || `ref-${Date.now()}.png`;
  const res = await fetch(
    `${ANONDROP_BASE}/remoteuploadurl?key=${key}&url=${encodeURIComponent(sourceUrl)}&filename=${encodeURIComponent(name)}`,
  );

  const responseText = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(
      `AnonDrop remote upload failed: HTTP ${res.status} — ${responseText.substring(0, 200)}`,
    );
  }

  const url = extractAnonDropUrl(responseText, name);
  if (!url) {
    throw new Error(
      `AnonDrop: não foi possível extrair URL: "${responseText.substring(0, 200)}"`,
    );
  }

  return url;
}

/**
 * Ensures a URL is a hosted public URL (not base64).
 * If it's base64, uploads to AnonDrop first.
 * If it's already a URL, returns as-is.
 * If it's a local /path, reads and uploads directly using Buffer.
 */
export async function ensureHostedUrl(urlOrBase64: string): Promise<string> {
  if (urlOrBase64.startsWith("http://") || urlOrBase64.startsWith("https://")) {
    return urlOrBase64;
  }

  // Handle Base64
  if (
    urlOrBase64.startsWith("data:") ||
    (!urlOrBase64.includes(" ") && urlOrBase64.length > 200)
  ) {
    return uploadToAnonDrop(urlOrBase64);
  }

  // Handle Local Paths gracefully (without unnecessary string conversions)
  if (urlOrBase64.startsWith("/")) {
    const filePath = path.join(process.cwd(), "public", urlOrBase64);
    const buf = await fs.readFile(filePath);

    const ext = path.extname(urlOrBase64).replace(".", "");
    const mime = ext === "jpg" ? "image/jpeg" : `image/${ext || "png"}`;
    const filename = path.basename(urlOrBase64);

    // Direct buffer upload instead of `toString('base64')` overhead
    return uploadBufferToAnonDrop(buf, mime, filename);
  }

  throw new Error(
    `Cannot resolve to hosted URL: ${urlOrBase64.substring(0, 80)}`,
  );
}

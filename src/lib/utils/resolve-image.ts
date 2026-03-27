import fs from "node:fs/promises";
import path from "node:path";

export async function resolveImage(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  )
    return url;
  if (url.startsWith("/")) {
    try {
      const buf = await fs.readFile(path.join(process.cwd(), "public", url));
      const ext = path.extname(url).replace(".", "");
      return `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${buf.toString("base64")}`;
    } catch {
      return undefined;
    }
  }
  return url;
}

export async function resolveImages(
  urls?: string[],
): Promise<string[] | undefined> {
  if (!urls?.length) return undefined;
  const resolved = await Promise.all(urls.map(resolveImage));
  return resolved.filter((u): u is string => !!u);
}

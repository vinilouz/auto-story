import fs from "fs/promises";
import path from "path";
import { execute } from "@/lib/ai/providers";
import { createLogger } from "@/lib/logger";

const log = createLogger("image");

export interface GenerateImageRequest {
  imagePrompt: string;
  referenceImage?: string;
  referenceImages?: string[];
  imageConfig?: { aspect_ratio?: string; image_size?: string };
  systemPrompt?: string;
}

async function resolveImage(url?: string): Promise<string | undefined> {
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

export async function generateSingleImage(
  req: GenerateImageRequest,
): Promise<string> {
  const prompt = req.imagePrompt.replace(/Scene \d{1,3}:\s*/gi, "").trim();
  const finalPrompt = req.systemPrompt
    ? `${req.systemPrompt}\n${prompt}`
    : prompt;

  let refs: string[] | undefined;
  if (req.referenceImages?.length) {
    refs = (await Promise.all(req.referenceImages.map(resolveImage))).filter(
      (u): u is string => !!u,
    );
  } else if (req.referenceImage) {
    const r = await resolveImage(req.referenceImage);
    if (r) refs = [r];
  }

  log.info(
    `Generating image (${refs?.length || 0} refs, prompt: ${finalPrompt.substring(0, 80)}...)`,
  );

  const { imageUrl } = await execute("generateImage", {
    prompt: finalPrompt,
    config: req.imageConfig,
    referenceImages: refs,
  });
  return imageUrl;
}

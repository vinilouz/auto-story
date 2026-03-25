import type { BatchResult } from "@/lib/ai/queue";
import type { ImageRequest, ImageResponse } from "@/lib/ai/registry";
import { StorageService } from "@/lib/storage";
import { createLogger } from "@/lib/logger";

const log = createLogger("image-service");

export interface SingleImageInput {
  imagePrompt: string;
  referenceImage?: string;
  referenceImages?: string[];
  imageConfig?: { aspect_ratio?: string; image_size?: string };
  index?: number;
  entityName?: string;
  projectId?: string;
  projectName?: string;
}

export interface BatchImageItem extends SingleImageInput {
  index: number;
}

function generateFileName(
  index: number | undefined,
  entityName: string | undefined,
  ext: string,
): string {
  if (entityName) {
    const cleanName = entityName.replace(/[^a-zA-Z0-9_-]/g, "");
    return `entity-${cleanName}.${ext}`;
  }
  if (index !== undefined) {
    return `img-${index + 1}.${ext}`;
  }
  return `img-${Date.now()}.${ext}`;
}

async function saveAndPatchImage(
  imageUrl: string,
  input: SingleImageInput,
): Promise<string> {
  if (
    !input.projectId ||
    !input.projectName ||
    !imageUrl.startsWith("data:image/")
  ) {
    return imageUrl;
  }

  const m = imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
  if (!m) return imageUrl;

  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  const fileName = generateFileName(input.index, input.entityName, ext);

  const localUrl = await StorageService.saveBase64Image(
    input.projectId,
    fileName,
    m[2],
    input.projectName,
  );

  if (!localUrl) return imageUrl;

  // Atomic patch: write to config.json immediately so progress is never lost
  if (input.entityName) {
    await StorageService.patchEntityImage(
      input.projectId,
      input.projectName,
      input.entityName,
      localUrl,
    );
    log.success(`Entity image saved: ${input.entityName} → ${localUrl}`);
  } else if (input.index !== undefined) {
    await StorageService.patchSegmentImage(
      input.projectId,
      input.projectName,
      input.index,
      localUrl,
    );
  }

  return localUrl;
}

export async function processSingleImage(
  input: SingleImageInput,
  executeBatchFn: typeof import("@/lib/ai/queue").executeBatch,
): Promise<{ imageUrl: string; id: number }> {
  const request: ImageRequest = {
    prompt: input.imagePrompt,
    referenceImages:
      input.referenceImages ||
      (input.referenceImage ? [input.referenceImage] : undefined),
    config: input.imageConfig,
  };

  const results = await executeBatchFn("generateImage", [request]);
  const result = results[0];

  if (result.status === "error") {
    throw new Error(result.error || "Image generation failed");
  }

  const imageUrl = await saveAndPatchImage(
    (result.data as ImageResponse).imageUrl,
    input,
  );

  return { imageUrl, id: result.id };
}

export function createBatchHandler(
  items: BatchImageItem[],
  executeBatchFn: typeof import("@/lib/ai/queue").executeBatch,
  encoder: TextEncoder,
) {
  const requests: ImageRequest[] = items.map((item) => ({
    prompt: item.imagePrompt,
    referenceImages:
      item.referenceImages ||
      (item.referenceImage ? [item.referenceImage] : undefined),
    config: item.imageConfig,
  }));

  return {
    requests,
    processResult: async (r: BatchResult<ImageResponse>) => {
      if (r.status === "error") {
        return {
          id: r.id,
          status: "error" as const,
          error: r.error,
          errorKind: r.errorKind,
        };
      }

      const item = items[r.id];
      const imgRes = r.data as ImageResponse;
      let imageUrl = imgRes.imageUrl;

      if (item?.projectId && item?.projectName) {
        imageUrl = await saveAndPatchImage(imageUrl, item);
      }

      return { id: r.id, status: "success" as const, data: { imageUrl } };
    },
  };
}

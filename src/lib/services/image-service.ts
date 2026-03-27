import type { BatchResult } from "@/lib/ai/queue";
import type { ImageRequest, ImageResponse } from "@/lib/ai/registry";
import { StorageService } from "@/lib/storage";
import { createLogger } from "@/lib/logger";
import { resolveImage, resolveImages } from "@/lib/utils/resolve-image";

const log = createLogger("image-service");

export interface SingleImageInput {
  imagePrompt: string;
  referenceImage?: string;
  referenceImages?: string[];
  imageConfig?: { aspect_ratio?: string; image_size?: string };
  index?: number;
  entityName?: string;
  projectId?: string;
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
  if (!input.projectId || !imageUrl.startsWith("data:image/")) {
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
  );

  if (!localUrl) return imageUrl;

  if (input.entityName) {
    await StorageService.patchEntityImage(
      input.projectId,
      input.entityName,
      localUrl,
    );
    log.success(`Entity image saved: ${input.entityName} → ${localUrl}`);
  } else if (input.index !== undefined) {
    await StorageService.patchSegmentImage(
      input.projectId,
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
  let resolvedRefs: string[] | undefined;
  if (input.referenceImages?.length) {
    resolvedRefs = await resolveImages(input.referenceImages);
  } else if (input.referenceImage) {
    const r = await resolveImage(input.referenceImage);
    if (r) resolvedRefs = [r];
  }

  const request: ImageRequest = {
    prompt: input.imagePrompt,
    referenceImages: resolvedRefs,
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

export async function createBatchHandler(
  items: BatchImageItem[],
  executeBatchFn: typeof import("@/lib/ai/queue").executeBatch,
  encoder: TextEncoder,
) {
  const requests: ImageRequest[] = await Promise.all(
    items.map(async (item) => {
      let resolvedRefs: string[] | undefined;
      if (item.referenceImages?.length) {
        resolvedRefs = await resolveImages(item.referenceImages);
      } else if (item.referenceImage) {
        const r = await resolveImage(item.referenceImage);
        if (r) resolvedRefs = [r];
      }

      return {
        prompt: item.imagePrompt,
        referenceImages: resolvedRefs,
        config: item.imageConfig,
      };
    }),
  );

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

      if (item?.projectId) {
        imageUrl = await saveAndPatchImage(imageUrl, item);
      }

      return { id: r.id, status: "success" as const, data: { imageUrl } };
    },
  };
}

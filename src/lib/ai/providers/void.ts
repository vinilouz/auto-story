import {
  type ImageRequest,
  type ImageResponse,
  registerProvider,
  type TextRequest,
  type TextResponse,
} from "@/lib/ai/registry";

registerProvider({
  name: "void",

  async generateText(model, req: TextRequest, creds): Promise<TextResponse> {
    const res = await fetch(`${creds.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: req.prompt }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.substring(0, 300)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty text response");
    return { text };
  },

  async generateImage(model, req: ImageRequest, creds): Promise<ImageResponse> {
    const content: any[] = [{ type: "text", text: req.prompt }];
    
    if (req.referenceImages?.length) {
      for (const urlOrPath of req.referenceImages) {
        if (urlOrPath.startsWith("http")) {
           content.push({ type: "image_url", image_url: { url: urlOrPath } });
        } else if (urlOrPath.startsWith("/")) {
            // Read local file from absolute path in public folder and convert to base64
            const filePath = require("path").join(process.cwd(), "public", urlOrPath);
            const ext = require("path").extname(filePath).replace(".", "");
            const mime = ext === "jpg" ? "image/jpeg" : `image/${ext || "png"}`;
            try {
              const buf = require("fs").readFileSync(filePath);
              const b64 = `data:${mime};base64,${buf.toString("base64")}`;
              content.push({ type: "image_url", image_url: { url: b64 } });
            } catch (e) {
              require("@/lib/logger").createLogger("void").warn(`Failed to buffer ${filePath}:`, e);
            }
        } else if (urlOrPath.startsWith("data:")) {
           content.push({ type: "image_url", image_url: { url: urlOrPath } });
        }
      }
    }

    const payload: any = {
      model,
      messages: [{ role: "user", content }],
      responseModalities: ["IMAGE"],
    };
    if (req.config) {
      payload.image_config = {
        aspect_ratio: req.config.aspect_ratio || "16:9",
        image_size: req.config.image_size || "2K",
      };
    }

    const res = await fetch(`${creds.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.substring(0, 300)}`);
    }

    const data = await res.json();
    const img = data.choices?.[0]?.message?.images?.[0];
    const imageUrl = img?.image_url?.url || img?.url;
    if (!imageUrl)
      throw new Error(
        `No image in response: ${JSON.stringify(data).substring(0, 300)}`,
      );
    return { imageUrl };
  },
});

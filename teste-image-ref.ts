import { readFileSync, writeFileSync } from "fs";

const API_URL = `${process.env.LOUZLABS_BASE_URL}/v1/images/generations`;
const API_KEY = `${process.env.LOUZLABS_API_KEY}`;

async function generateImage(prompt: string, localImagePath: string) {
  // Read local image and convert to data URI
  const imageBytes = readFileSync(localImagePath);
  const base64 = imageBytes.toString("base64");
  const ext = localImagePath.split(".").pop() ?? "png";
  const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;
  const imageDataUri = `data:${mimeType};base64,${base64}`;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      prompt,
      image_ref: imageDataUri,
      aspect_ratio: "16:9",
      size: "2K",
    }),
  });

  const data = (await res.json()) as {
    url?: string | null;
    b64_json?: string | null;
  };

  // Save result
  if (data.url) {
    const imgRes = await fetch(data.url);
    const bytes = await imgRes.arrayBuffer();
    writeFileSync("output.png", Buffer.from(bytes));
  } else if (data.b64_json) {
    writeFileSync("output.png", Buffer.from(data.b64_json, "base64"));
  }

  return data;
}

// Usage
generateImage(
  "Transform this into a watercolor painting",
  "./public/projects/b3dc7bcd-303f-41e5-a5af-3efe3e9c3aae/images/entity-EthelDeityCorpse.png",
);

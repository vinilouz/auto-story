import fs from "fs";

export async function textVoid(prompt: string, model: string = "gemini-3-pro-preview"): Promise<string> {
  const response = await fetch(`${process.env.VOID_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOID_API_KEY}`
    },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] })
  });

  if (!response.ok) throw new Error(`Text API Error: ${response.statusText}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function imageVoid(prompt: string, model: string = "gemini-3-pro-image-preview", imageUrls?: string[]): Promise<string> {
  const content: any[] = [{ type: "text", text: prompt }];
  if (imageUrls) imageUrls.forEach(url => content.push({ type: "image_url", image_url: { url } }));

  const response = await fetch(`${process.env.VOID_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOID_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      responseModalities: ["IMAGE"]
    })
  });

  if (!response.ok) throw new Error(`Image API Error: ${response.statusText}`);
  const data = await response.json();
  const img = data.choices?.[0]?.message?.images?.[0];
  return img?.image_url?.url || img?.url || "";
}

export async function voiceNaga(prompt: string, model: string = "eleven-multilingual-v2:free", voice: string = "nPczCjzI2devNBz1zQrb"): Promise<ArrayBuffer> {
  const response = await fetch(`${process.env.NAGA_BASE_URL}/v1/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NAGA_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, voice, input: prompt })
  });

  if (!response.ok) throw new Error(`Voice API Error: ${response.statusText}`);
  return response.arrayBuffer();
}

export async function videoAir(prompt: string, imageUrl?: string): Promise<string> {
  const response = await fetch(`${process.env.AIR_BASE_URL}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AIR_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "wan-2.6",
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "url",
      sse: true,
      aspectRatio: "16:9",
      duration: 15,
      resolution: "1080P",
      sound: true,
      wan_image_url: imageUrl
    })
  });

  if (!response.ok) throw new Error(`Video API Error: ${response.statusText}`);
  if (!response.body) throw new Error("Video API Error: No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalUrl = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value);
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6);
        if (dataStr === "[DONE]" || dataStr === ": keepalive") continue;
        try {
          const data = JSON.parse(dataStr);
          if (data.url) finalUrl = data.url;
        } catch { }
      }
    }
  }
  return finalUrl;
}

if ((import.meta as any).main) {
  try {
    console.log("🚀 Starting demo-generations test...");

    // console.log("\n--- TEST: TEXT ---");
    // console.log("Sending text request to VOID...");
    // const text = await textVoid("Hello, who are you?");
    // console.log("Result:", text);

    console.log("\n--- TEST: IMAGE ---");
    console.log("Sending image request to VOID (Chat Modality)...");
    const imageUrl = await imageVoid("A futuristic city at sunset");
    console.log("Result:", imageUrl);

    // console.log("\n--- TEST: VOICE ---");
    // console.log("Sending voice request to NAGA...");
    // const audioContent = await voiceNaga("Testing the voice generation.");
    // if (!fs.existsSync("audio")) fs.mkdirSync("audio");
    // const audioPath = `audio/demo-naga-${Date.now()}.mp3`;
    // fs.writeFileSync(audioPath, Buffer.from(audioContent));
    // console.log(`Result: Saved to ${audioPath}`);

    // console.log("\n--- TEST: VIDEO ---");
    // console.log("Sending video request to AIRFORCE (SSE)...");
    // const videoUrl = await videoAir("A cat playing", "https://anondrop.net/1468768949653999738/img.png");
    // console.log("Result:", videoUrl);

    console.log("\n✅ Demo completed successfully!");

  } catch (error) {
    console.error("Test failed:", error);
  }
}

const imagePrompt = process.argv[2] || "anime";

fetch(`${process.env.VOID_BASE_URL}/v1/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.VOID_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gemini-3.1-flash-image-preview",
    messages: [
      { role: "user", content: [{ type: "text", text: imagePrompt }] },
    ],
    responseModalities: ["IMAGE"],
    image_config: { aspect_ratio: "16:9", image_size: "4K" },
  }),
}).then(async (response) => {
  if (!response.body) throw new Error("No response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulatedData = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    accumulatedData += decoder.decode(value, { stream: true });
    const lines = accumulatedData.split("\n\n");
    accumulatedData = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6);
        if (dataStr === "[DONE]") continue;
        if (dataStr === ": keepalive") continue;
        console.log(JSON.parse(dataStr));
      }
    }
  }
});

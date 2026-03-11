const BASE_URL = process.env.AIR_BASE_URL;
const API_KEY = process.env.AIR_API_KEY;

fetch(`${BASE_URL}/v1/images/generations`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "grok-imagine-video",
    prompt: "styled anime ",
    n: 1,
    size: "1024x1024",
    response_format: "url",
    sse: true,
    mode: "spicy",
    resolution: "720p",
    image_urls: ["https://anondrop.net/1481011475181998293/img.png"],
  }),
}).then(async (response) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulatedData = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    accumulatedData += decoder.decode(value, { stream: true });
    const lines = accumulatedData.split("\n\n");
    accumulatedData = lines.pop();

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

/* RESPONSE: */
// ▶ bun run demos/air-video-grok.js
// {
//   created: 1773233696,
//   data: [
//     {
//       url: "https://anondrop.net/1481274222474166425/vid.mp4",
//       b64_json: null,
//     }
//   ],
// }

const BASE_URL = process.env.AIR_BASE_URL;
const API_KEY = process.env.AIR_API_KEY;

const response = await fetch(`${BASE_URL}/v1/images/generations`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    "model": "wan-2.6",
    "prompt": Bun.argv[2],
    "n": 1,
    "size": "1024x1024",
    "response_format": "url",
    "sse": true,
    "aspectRatio": "16:9",
    "duration": 15,
    "resolution": "1080P",
    "sound": true,
    "wan_image_url": "https://anondrop.net/1468768949653999738/img.png"
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value);
  const lines = buffer.split('\n\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data !== '[DONE]' && data !== ': keepalive') console.log(JSON.parse(data));
    }
  }
}
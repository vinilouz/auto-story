fetch("https://api.airforce/v1/images/generations", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-air-oEsZcLAAz9KOqACw1mNjap9XlEloHtuqLS1VVQCR19ZpvpgYeALVPgH6g309WBEX",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    "model": "nano-banana-pro",
    "prompt": "anime",
    "n": 1,
    "size": "1024x1024",
    "response_format": "url",
    "sse": true,
    "aspectRatio": "16:9",
    "resolution": "4K",
    "image_urls": [
      "https://anondrop.net/1468749069710004275/img.png"
    ]
  })
}).then(async response => {
  if (!response.body) throw new Error("No response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulatedData = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    accumulatedData += decoder.decode(value, { stream: true });
    const lines = accumulatedData.split('\n\n');
    accumulatedData = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6);
        if (dataStr === '[DONE]') continue;
        if (dataStr === ': keepalive') continue;
        console.log(JSON.parse(dataStr));
      }
    }
  }
});

/* Response */
// {
//   created: 1772565823,
//   data: [
//     {
//       url: "https://anondrop.net/1478472960070385758/img.png",
//       b64_json: null,
//     }
//   ],
// }
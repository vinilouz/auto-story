const prompt = Bun.argv[2];
if (!prompt) process.exit(1);

const res = await fetch(`${process.env.VOID_BASE_URL}/v1/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.VOID_API_KEY}`,
  },
  body: JSON.stringify({
    model: "gemini-3.1-flash-image-preview",
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    responseModalities: ["IMAGE"],
    image_config: { aspect_ratio: "16:9", image_size: "4K" },
  }),
});

const data = await res.json();
const img = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

if (typeof img === "string" && img.startsWith("data:")) {
  await Bun.write("output.png", Buffer.from(img.split(",")[1], "base64"));
  console.log("Salvo em: output.png");
} else {
  console.log(img || JSON.stringify(data, null, 2));
}

export {};

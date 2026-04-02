"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import Link from "next/link";

type Endpoint =
  | "images"
  | "audio"
  | "music"
  | "split"
  | "descriptions"
  | "video-clips";

interface TestResult {
  status: number;
  data: unknown;
  duration: number;
}

const ENDPOINTS: Record<
  Endpoint,
  {
    label: string;
    fields: { name: string; label: string; type: "text" | "textarea" }[];
    defaultValues: Record<string, string>;
  }
> = {
  split: {
    label: "Text Split",
    fields: [
      { name: "text", label: "Text", type: "textarea" },
      { name: "segmentLength", label: "Segment Length", type: "text" },
    ],
    defaultValues: {
      text: "Num país muito distante, havia uma floresta encantada onde as árvores falavam e os rios cantavam. Uma jovem chamada Luna decidiu explorar esse mistério. Ela encontrou um portal brilhante entre duas árvores antigas.",
      segmentLength: "200",
    },
  },
  images: {
    label: "Image Generation",
    fields: [{ name: "imagePrompt", label: "Image Prompt", type: "textarea" }],
    defaultValues: {
      imagePrompt:
        "A mystical enchanted forest with glowing trees, a young woman standing before a shimmering portal between two ancient oak trees, fantasy art style, cinematic lighting",
    },
  },
  descriptions: {
    label: "Scene Descriptions",
    fields: [
      { name: "segments", label: "Segments (JSON array)", type: "textarea" },
    ],
    defaultValues: {
      segments: '["Uma floresta encantada com árvores que falam e rios que cantam.", "Uma jovem chamada Luna encontra um portal brilhante."]'}
    ,
  },
  audio: {
    label: "Audio Generation",
    fields: [
      { name: "text", label: "Text", type: "textarea" },
      { name: "voice", label: "Voice ID (optional)", type: "text" },
    ],
    defaultValues: {
      text: "Num país muito distante, havia uma floresta encantada onde as árvores falavam e os rios cantavam.",
      voice: "",
    },
  },
  music: {
    label: "Music Generation",
    fields: [
      { name: "prompt", label: "Prompt (optional)", type: "textarea" },
    ],
    defaultValues: {
      prompt: "",
    },
  },
  "video-clips": {
    label: "Video Clip",
    fields: [
      { name: "prompt", label: "Prompt", type: "textarea" },
    ],
    defaultValues: {
      prompt:
        "A mystical forest with glowing trees, camera slowly moving forward through the enchanted woods",
    },
  },
};

export default function TestPage() {
  const [selected, setSelected] = useState<Endpoint>("images");
  const [forms, setForms] = useState<Record<Endpoint, Record<string, string>>>(
    Object.fromEntries(
      Object.entries(ENDPOINTS).map(([key, val]) => [
        key,
        val.defaultValues,
      ]),
    ) as Record<Endpoint, Record<string, string>>,
  );
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sseMessages, setSseMessages] = useState<unknown[]>([]);

  const currentForm = forms[selected];
  const config = ENDPOINTS[selected];

  const updateField = (name: string, value: string) => {
    setForms((prev) => ({
      ...prev,
      [selected]: { ...prev[selected], [name]: value },
    }));
  };

  const buildBody = () => {
    const raw = { ...currentForm };
    if (raw.segmentLength) raw.segmentLength = Number(raw.segmentLength) as any;
    if (selected === "descriptions" && typeof raw.segments === "string") {
      try {
        raw.segments = JSON.parse(raw.segments);
      } catch {
        alert("Invalid JSON for segments");
        return null;
      }
    }
    Object.keys(raw).forEach((k) => {
      if (raw[k] === "" || raw[k] === undefined) delete raw[k];
    });
    return raw;
  };

  const isSSE = selected === "music";

  const runTest = async () => {
    const body = buildBody();
    if (!body) return;

    setLoading(true);
    setResult(null);
    setSseMessages([]);
    const start = performance.now();

    try {
      const res = await fetch(`/api/generate/${selected}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const duration = Math.round(performance.now() - start);

      if (isSSE && res.ok) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const messages: unknown[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() || "";

          for (const chunk of chunks) {
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const raw = line.slice(6).trim();
              if (!raw) continue;
              try {
                const parsed = JSON.parse(raw);
                messages.push(parsed);
                setSseMessages([...messages]);
              } catch {
                messages.push(raw);
                setSseMessages([...messages]);
              }
            }
          }
        }

        setResult({ status: res.status, data: messages, duration });
      } else {
        const data = await res.json();
        setResult({ status: res.status, data, duration });
      }
    } catch (e: any) {
      setResult({
        status: 0,
        data: { error: e.message },
        duration: Math.round(performance.now() - start),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">API Test Page</h1>
            <p className="text-muted-foreground mt-1">
              Test generation endpoints in isolation
            </p>
          </div>
          <Link href="/">
            <Button variant="outline">Back to App</Button>
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {(Object.keys(ENDPOINTS) as Endpoint[]).map((key) => (
            <Button
              key={key}
              variant={selected === key ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelected(key);
                setResult(null);
                setSseMessages([]);
              }}
            >
              {ENDPOINTS[key].label}
            </Button>
          ))}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>POST /api/generate/{selected}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.fields.map((field) =>
              field.type === "textarea" ? (
                <div key={field.name}>
                  <label className="text-sm font-medium mb-1 block">
                    {field.label}
                  </label>
                  <Textarea
                    value={currentForm[field.name] || ""}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
              ) : (
                <div key={field.name}>
                  <label className="text-sm font-medium mb-1 block">
                    {field.label}
                  </label>
                  <Input
                    value={currentForm[field.name] || ""}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              ),
            )}

            <Button
              onClick={runTest}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Running..." : "Run Test"}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span
                  className={`text-sm font-mono px-2 py-0.5 rounded ${
                    result.status >= 200 && result.status < 300
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {result.status || "ERR"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {result.duration}ms
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-sm font-mono whitespace-pre-wrap break-words">
                {JSON.stringify(result.data, null, 2)}
              </pre>

              {sseMessages.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold mb-2">
                    SSE Events ({sseMessages.length})
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-auto">
                    {sseMessages.map((msg, i) => (
                      <div
                        key={i}
                        className="text-xs font-mono bg-muted/50 px-2 py-1 rounded"
                      >
                        {JSON.stringify(msg)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {result?.data && typeof result.data === "object" && result.data !== null && "imageUrl" in (result.data as Record<string, unknown>) && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Generated Image</CardTitle>
            </CardHeader>
            <CardContent>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={(result.data as { imageUrl: string }).imageUrl}
                alt="Generated"
                className="max-w-full rounded-lg"
              />
            </CardContent>
          </Card>
        )}

        {result?.data && typeof result.data === "object" && result.data !== null && "audioBase64" in (result.data as Record<string, unknown>) && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Generated Audio</CardTitle>
            </CardHeader>
            <CardContent>
              <audio
                src={`data:audio/mpeg;base64,${(result.data as { audioBase64: string }).audioBase64}`}
                controls
                className="w-full"
              />
            </CardContent>
          </Card>
        )}

        {result?.data && typeof result.data === "object" && result.data !== null && "videoUrl" in (result.data as Record<string, unknown>) && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Generated Video</CardTitle>
            </CardHeader>
            <CardContent>
              <video
                src={(result.data as { videoUrl: string }).videoUrl}
                controls
                className="max-w-full rounded-lg"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

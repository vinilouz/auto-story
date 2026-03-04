export type AssetType = "text" | "image" | "audio" | "video";

export type EndpointType =
  | "chat/completions"
  | "images/generations"
  | "audio/speech";

export interface Model {
  id: string;
  name: string;
  assetType: AssetType;
  providerId: string;
  endpoint: EndpointType;
  priority: number;
  active: boolean;
}

export interface Provider {
  id: string;
  baseUrl: string;
  apiKey: string;
  rpm: number;
  active: boolean;
}

export const providers: Record<string, Provider> = {
  void: {
    id: "void",
    baseUrl: process.env.VOID_BASE_URL || "",
    apiKey: process.env.VOID_API_KEY || "",
    rpm: 30,
    active: true,
  },
  air: {
    id: "air",
    baseUrl: process.env.AIR_BASE_URL || "",
    apiKey: process.env.AIR_API_KEY || "",
    rpm: 3,
    active: true,
  },
  naga: {
    id: "naga",
    baseUrl: process.env.NAGA_BASE_URL || "",
    apiKey: process.env.NAGA_API_KEY || "",
    rpm: 30,
    active: true,
  },
};

export const models: Model[] = [
  {
    id: "gpt-5.2",
    name: "GPT 5.2",
    assetType: "text" as AssetType,
    providerId: "void",
    endpoint: "chat/completions" as EndpointType,
    priority: 1,
    active: true,
  },
  {
    id: "gemini-3.1-flash-image-preview",
    name: "Gemini 3.1 Flash Image",
    assetType: "image" as AssetType,
    providerId: "void",
    endpoint: "chat/completions" as EndpointType,
    priority: 1,
    active: true,
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    assetType: "image" as AssetType,
    providerId: "air",
    endpoint: "images/generations" as EndpointType,
    priority: 2,
    active: true,
  },
  {
    id: "eleven-multilingual-v2:free",
    name: "Eleven Multilingual v2",
    assetType: "audio" as AssetType,
    providerId: "naga",
    endpoint: "audio/speech" as EndpointType,
    priority: 1,
    active: true,
  },
  {
    id: "grok-imagine-video",
    name: "Grok Video",
    assetType: "video" as AssetType,
    providerId: "air",
    endpoint: "images/generations" as EndpointType,
    priority: 1,
    active: true,
  },
  {
    id: "veo-3.1-fast",
    name: "Veo 3.1 Fast",
    assetType: "video" as AssetType,
    providerId: "air",
    endpoint: "images/generations" as EndpointType,
    priority: 2,
    active: true,
  },
  {
    id: "wan-2.6",
    name: "Wan 2.6",
    assetType: "video" as AssetType,
    providerId: "air",
    endpoint: "images/generations" as EndpointType,
    priority: 3,
    active: true,
  },
].sort((a, b) => a.priority - b.priority);

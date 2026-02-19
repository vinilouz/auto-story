import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { PROXY_SOURCES } from "./proxy-sources";

const TEST_URL = "https://api.ipify.org?format=json";
const TIMEOUT = 8000;
const MAX_TEST = 300;

export interface ProxyResult {
  ip: string;
  agent: HttpsProxyAgent<string>;
  proxyUrl: string;
}

let cachedProxy: ProxyResult | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 5;

function httpsGet(url: string, agent?: HttpsProxyAgent<string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), TIMEOUT);
    const req = https.get(url, agent ? { agent } : {}, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
    req.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function httpsHead(url: string, agent: HttpsProxyAgent<string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), TIMEOUT);
    const parsed = new URL(url);
    const req = https.request(
      { hostname: parsed.hostname, port: 443, path: parsed.pathname, method: "HEAD", agent },
      (res) => {
        clearTimeout(timeout);
        resolve(res.statusCode || 0);
      }
    );
    req.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    req.end();
  });
}

async function checkProxy(proxyUrl: string, baselineIp: string | null): Promise<string | null> {
  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    const body = await httpsGet(TEST_URL, agent);
    const data = JSON.parse(body);
    const ip = data.ip;
    if (!ip || ip === baselineIp) return null;

    const status = await httpsHead("https://api.elevenlabs.io/v1/models", agent);
    if (status === 302 || status === 403) return null;

    return ip;
  } catch {
    return null;
  }
}

async function getBaselineIp(): Promise<string | null> {
  try {
    const body = await httpsGet(TEST_URL);
    const data = JSON.parse(body);
    return data.ip || null;
  } catch {
    return null;
  }
}

export async function getVerifiedProxy(): Promise<ProxyResult> {
  const now = Date.now();
  if (cachedProxy && now - lastFetchTime < CACHE_DURATION) {
    return cachedProxy;
  }

  console.log("[ProxyService] Finding verified anonymous proxy...");
  const baselineIp = await getBaselineIp();
  console.log(`[ProxyService] Baseline IP: ${baselineIp}`);

  const fetchWithTimeout = async (url: string) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  };

  const results = await Promise.allSettled(
    PROXY_SOURCES.map(async (s) => {
      try {
        const res = await fetchWithTimeout(s.url);
        const txt = await res.text();
        const list = s.parser(txt) || [];
        console.log(`[ProxyService] [${s.name}] +${list.length}`);
        return list;
      } catch (e) {
        console.warn(`[ProxyService] Failed to fetch from ${s.name}`, e);
        return [];
      }
    })
  );

  const candidates = [
    ...new Set(
      results.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    ),
  ]
    .filter(
      (p) => /^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(p) && !p.startsWith("0.")
    )
    .slice(0, MAX_TEST);

  console.log(`[ProxyService] Testing ${candidates.length} candidates...`);

  const shuffled = candidates.sort(() => Math.random() - 0.5);

  const CONCURRENCY = 20;
  let found: ProxyResult | null = null;
  let currentIndex = 0;

  const checkNext = async (): Promise<void> => {
    while (currentIndex < shuffled.length && !found) {
      const proxy = shuffled[currentIndex++];
      if (!proxy) break;

      const proxyUrl = `http://${proxy}`;
      const ip = await checkProxy(proxyUrl, baselineIp);

      if (ip && !found) {
        console.log(
          `[ProxyService] Verified proxy: ${proxy} (IP: ${ip}) — anonymous + ElevenLabs OK`
        );
        found = {
          ip,
          proxyUrl,
          agent: new HttpsProxyAgent(proxyUrl),
        };
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }).map(checkNext));

  if (found) {
    const result = found as ProxyResult;
    cachedProxy = result;
    lastFetchTime = Date.now();
    return result;
  }

  throw new Error("No working anonymous proxies found.");
}

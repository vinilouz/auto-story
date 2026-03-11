import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { PROXY_SOURCES } from "./proxy-sources";

const ANONYMITY_URL = "https://httpbin.org/ip";
const TIMEOUT = 8000;
const MAX_TEST = 300;
const CONCURRENCY = 20;

function httpsGet(
  url: string,
  agent?: HttpsProxyAgent<string>,
): Promise<string> {
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

async function getBaselineIp(): Promise<string | null> {
  try {
    const body = await httpsGet(ANONYMITY_URL);
    const data = JSON.parse(body);
    return data.origin || data.ip || null;
  } catch {
    return null;
  }
}

async function fetchAllCandidates(): Promise<string[]> {
  const results = await Promise.allSettled(
    PROXY_SOURCES.map(async (s) => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), TIMEOUT);
        const res = await fetch(s.url, { signal: controller.signal });
        clearTimeout(id);
        const txt = await res.text();
        const list = s.parser(txt) || [];
        console.log(`[ProxyService] [${s.name}] +${list.length}`);
        return list;
      } catch {
        console.warn(`[ProxyService] Failed: ${s.name}`);
        return [];
      }
    }),
  );

  return [
    ...new Set(
      results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
    ),
  ]
    .filter((p) => /^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(p) && !p.startsWith("0."))
    .sort(() => Math.random() - 0.5)
    .slice(0, MAX_TEST);
}

export async function executeWithAnonymousProxy<T>(
  execute: (agent: HttpsProxyAgent<string>) => Promise<T>,
): Promise<T> {
  console.log("[ProxyService] Finding anonymous proxies...");
  const baselineIp = await getBaselineIp();
  console.log(`[ProxyService] Baseline IP: ${baselineIp}`);

  const candidates = await fetchAllCandidates();
  console.log(
    `[ProxyService] Testing ${candidates.length} candidates for anonymity...`,
  );

  const anonymousAgents: HttpsProxyAgent<string>[] = [];
  let producerDone = false;
  let pendingResolve: (() => void) | null = null;

  const signal = () => {
    if (pendingResolve) {
      const r = pendingResolve;
      pendingResolve = null;
      r();
    }
  };

  const waitForChange = () =>
    new Promise<void>((r) => {
      pendingResolve = r;
    });

  let index = 0;

  const testWorker = async () => {
    while (index < candidates.length) {
      const proxy = candidates[index++];
      if (!proxy) break;
      try {
        const agent = new HttpsProxyAgent(`http://${proxy}`);
        const body = await httpsGet(ANONYMITY_URL, agent);
        const data = JSON.parse(body);
        const ip = data.origin || data.ip;
        if (ip && !(baselineIp && ip.includes(baselineIp))) {
          console.log(`[ProxyService] Anonymous: ${proxy} (IP: ${ip})`);
          anonymousAgents.push(agent);
          signal();
        }
      } catch {}
    }
  };

  const producerPromise = Promise.all(
    Array.from({ length: CONCURRENCY }).map(testWorker),
  ).then(() => {
    producerDone = true;
    signal();
  });

  let consumed = 0;

  while (true) {
    if (consumed < anonymousAgents.length) {
      const agent = anonymousAgents[consumed++];
      try {
        console.log(
          `[ProxyService] Attempting request (proxy ${consumed}/${anonymousAgents.length})...`,
        );
        return await execute(agent);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[ProxyService] Proxy ${consumed} failed: ${msg}`);
      }
    } else if (producerDone) {
      break;
    } else {
      await waitForChange();
    }
  }

  await producerPromise;
  throw new Error(
    `All ${consumed} anonymous proxies exhausted. None could complete the request.`,
  );
}

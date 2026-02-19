import { PROXY_SOURCES } from "./proxies.ts";

const TEST_URL = "https://api.ipify.org?format=json";
const TIMEOUT = 8000;
const CONCURRENCY = 30; // Increased concurrency
const MAX_TEST = 300;

const fetchWithTimeout = async (url, opts = {}) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

async function getIp(proxy = null) {
  const res = await fetchWithTimeout(
    TEST_URL,
    proxy ? { proxy: `http://${proxy}` } : {}
  );
  return (await res.json()).ip;
}

async function main() {
  const baseline = await getIp().catch(() => null);
  console.log(`Baseline: ${baseline}`);

  // Fetch all sources in parallel
  const results = await Promise.allSettled(
    PROXY_SOURCES.map(async (s) => {
      const res = await fetchWithTimeout(s.url);
      const txt = await res.text();
      const list = s.parser(txt) || [];
      console.log(`[${s.name}] +${list.length}`);
      return list;
    })
  );

  const proxies = [
    ...new Set(
      results.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    ),
  ]
    .filter((p) => /^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(p) && !p.startsWith("0."))
    .slice(0, MAX_TEST);

  console.log(`Testing ${proxies.length} candidates...`);

  const ok = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < proxies.length) {
        const p = proxies[i++];
        try {
          const ip = await getIp(p);
          if (ip && ip !== baseline) {
            ok.push({ p, ip });
            console.log(`OK  ${p} => ${ip}`);
          }
        } catch {}
      }
    })
  );

  console.log(`\nOK total: ${ok.length}`);
  ok.forEach((r) => console.log(`- ${r.p} => ${r.ip}`));
}

main();

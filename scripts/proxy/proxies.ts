// proxies.ts
// (Mínimas alterações: corrigi FreeProxyList + HidemyName; mantive as outras fontes.)

const PROXY_REGEX =
  /<tr>\s*<td>(\d{1,3}(?:\.\d{1,3}){3})<\/td>\s*<td>(\d+)<\/td>\s*<td>[^<]*<\/td>\s*<td[^>]*>[\s\S]*?<\/td>\s*<td>(transparent|anonymous|elite proxy)<\/td>\s*<td[^>]*>[\s\S]*?<\/td>\s*<td[^>]*>(yes|no)<\/td>/gi;

const PROXY_SOURCES = [
  {
    name: "FreeProxyList",
    url: "https://free-proxy-list.net/",
    parser: (html: string) => {
      const matches = Array.from(html.matchAll(PROXY_REGEX));
      return (
        matches
          // m[3] = Anonymity, m[4] = Https yes/no
          .filter((m) => m[4] === "yes" && m[3] !== "transparent")
          .map((m) => `${m[1]}:${m[2]}`)
          .filter(
            (p) => p && !p.startsWith("0.0.0.0:") && !p.startsWith("127.0.0.")
          )
      );
    },
  },
  {
    name: "ProxyScrape",
    url: "https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&protocol=http&proxy_format=protocolipport&format=json&anonymity=Elite,Anonymous&limit=500",
    parser: (text: string) => {
      try {
        const json = JSON.parse(text);
        return (json.proxies || []).map((p: any) => `${p.ip}:${p.port}`);
      } catch {
        return [];
      }
    },
  },
  {
    name: "ProxyNova",
    url: "https://www.proxynova.com/proxy-server-list/anonymous-proxies/",
    parser: (html: string) => {
      const rowRegex = /<tr data-proxy-id="\d+">([\s\S]*?)<\/tr>/gi;
      const out: string[] = [];

      for (const rowMatch of html.matchAll(rowRegex)) {
        const row = rowMatch[1];
        const tds = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(
          (m) => m[1].trim()
        );

        if (tds.length >= 2) {
          // IP is in first TD, often after a script or inside an abbr
          // The IP is usually the last thing in the TD or preceded by a script
          const ip = tds[0].match(/(\d{1,3}(?:\.\d{1,3}){3})/)?.[1];
          // Port is in second TD, often inside an <a> tag
          const port = tds[1].match(/(\d+)/)?.[1];

          if (ip && port) {
            out.push(`${ip}:${port}`);
          }
        }
      }
      return out;
    },
  },
  {
    name: "Geonode",
    url: "https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=upTime&sort_type=desc&protocols=http%2Chttps",
    parser: (text: string) => {
      try {
        const json = JSON.parse(text);
        return (json.data || [])
          .filter(
            (p: any) =>
              (p?.anonymityLevel === "elite" ||
                p?.anonymityLevel === "anonymous") &&
              typeof p?.upTime === "number" &&
              p.upTime >= 98 &&
              typeof p?.upTimeTryCount === "number" &&
              p.upTimeTryCount >= 10 &&
              typeof p?.responseTime === "number" &&
              p.responseTime > 0 &&
              p.responseTime <= 2000
          )
          .map((p: any) => `${p.ip}:${p.port}`)
          .filter(
            (p: string) =>
              p && !p.startsWith("0.0.0.0:") && !p.startsWith("127.0.0.")
          );
      } catch {
        return [];
      }
    },
  },
  {
    name: "PubProxy",
    url: "http://pubproxy.com/api/proxy?format=txt&type=http&https=true&limit=5",
    parser: (text: string) =>
      text
        .trim()
        .split("\n")
        .filter((p) => p && p.includes(":")),
  },
];

export { PROXY_SOURCES };

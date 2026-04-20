const https = require("https");
const http = require("http");
const { URL } = require("url");

function doRequest(urlStr, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers,
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          let data;
          try { data = JSON.parse(body); } catch { data = body; }
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            data,
          });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("Timeout")));
    req.end();
  });
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  try {
    const { endpoint, apiKey, region, params } = JSON.parse(event.body || "{}");

    if (!endpoint || !apiKey || !region) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ ok: false, error: "Missing endpoint, apiKey, or region" }),
      };
    }

    const base = region.replace(/\/+$/, "");
    const ep   = "/" + endpoint.replace(/^\/+/, "");
    const filtered = Object.fromEntries(
      Object.entries(params || {}).filter(([, v]) => v != null && v !== "")
    );
    const qs = Object.keys(filtered).length
      ? "?" + new URLSearchParams(filtered).toString()
      : "";

    const url = `${base}${ep}${qs}`;
    console.log("[proxy]", url);

    const result = await doRequest(url, {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: result.ok, status: result.status, data: result.data }),
    };
  } catch (err) {
    console.error("[proxy] error:", err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
const https = require("https");
const http = require("http");
const { URL } = require("url");

function request(urlStr, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === "https:" ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers,
    };
    const req = lib.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        let data;
        try { data = JSON.parse(body); } catch { data = body; }
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data });
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(new Error("Request timed out")); });
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  try {
    const { endpoint, apiKey, region, params } = JSON.parse(event.body || "{}");

    if (!endpoint || !apiKey || !region) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Missing required fields: endpoint, apiKey, region" }),
      };
    }

    // Safely join base URL + endpoint (prevent double slashes)
    const base = region.replace(/\/+$/, "");
    const ep = "/" + endpoint.replace(/^\/+/, "");

    // Build query string, filtering empty values
    const filteredParams = Object.fromEntries(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "")
    );
    const query = Object.keys(filteredParams).length
      ? "?" + new URLSearchParams(filteredParams).toString()
      : "";

    const url = `${base}${ep}${query}`;
    console.log("[proxy] GET", url);

    const result = await request(url, {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        ok: result.ok,
        status: result.status,
        data: result.data,
      }),
    };
  } catch (err) {
    console.error("[proxy] Error:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
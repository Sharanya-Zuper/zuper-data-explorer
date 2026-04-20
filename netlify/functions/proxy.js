exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
  }

  try {
    const { endpoint, apiKey, region, params } = JSON.parse(event.body);

    if (!endpoint || !apiKey || !region) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Missing required fields: endpoint, apiKey, region" }),
      };
    }

    // Safely join region base URL + endpoint (avoid double slashes)
    const base = region.endsWith("/") ? region.slice(0, -1) : region;
    const ep   = endpoint.startsWith("/") ? endpoint : "/" + endpoint;

    const query =
      params && Object.keys(params).length
        ? "?" + new URLSearchParams(
            // Filter out null/undefined/empty values
            Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""))
          ).toString()
        : "";

    const url = `${base}${ep}${query}`;

    console.log("[proxy] GET", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = await response.text();
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: response.ok,
        status: response.status,
        data,
      }),
    };
  } catch (err) {
    console.error("[proxy] Error:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: err.message,
      }),
    };
  }
};
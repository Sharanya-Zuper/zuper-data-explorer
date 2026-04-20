exports.handler = async (event) => {
  try {
    const { endpoint, apiKey, region, params } = JSON.parse(event.body);

    const query =
      params && Object.keys(params).length
        ? "?" + new URLSearchParams(params).toString()
        : "";

    const url = `${region}${endpoint}${query}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: response.ok,
        status: response.status,
        data,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: err.message,
      }),
    };
  }
};
// deno.ts - 增强版代理，支持多个目标主机
const TARGET_HOST = Deno.env.get("DENO_TARGET_HOST") ?? "api.groq.com";
const TARGET_PROTOCOL = Deno.env.get("DENO_TARGET_PROTOCOL") ?? "https";
const ENABLE_CORS = Deno.env.get("ENABLE_CORS") === "true";

Deno.serve({ hostname: "0.0.0.0", port: 8000 }, async (request) => {
  try {
    // 处理 CORS preflight
    if (request.method === "OPTIONS" && ENABLE_CORS) {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, *",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const incoming = new URL(request.url);
    const targetUrl = `${TARGET_PROTOCOL}://${TARGET_HOST}${incoming.pathname}${incoming.search}`;

    const headers = new Headers(request.headers);
    headers.set("host", TARGET_HOST);
    
    // 补充 User-Agent（某些目标可能需要）
    if (!headers.has("user-agent")) {
      headers.set("user-agent", "Mozilla/5.0 (compatible; ProxyBot/1.0)");
    }

    let body: ArrayBuffer | undefined;
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      try {
        const buf = await request.arrayBuffer();
        body = buf.byteLength ? buf : undefined;
      } catch (e) {
        console.error("error reading request body:", e);
        body = undefined;
      }
    }

    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
      redirect: "manual",
    });

    const respHeaders = new Headers(upstreamResponse.headers);
    
    // 删除 hop-by-hop headers
    ["connection", "keep-alive", "transfer-encoding", "upgrade", "proxy-authenticate", "proxy-authorization"].forEach(h => {
      respHeaders.delete(h);
    });

    // 添加 CORS headers（如果启用）
    if (ENABLE_CORS) {
      respHeaders.set("Access-Control-Allow-Origin", "*");
      respHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS");
      respHeaders.set("Access-Control-Expose-Headers", "*");
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: respHeaders,
    });
  } catch (err) {
    console.error("proxy error:", err);
    return new Response("Bad gateway", { status: 502 });
  }
});

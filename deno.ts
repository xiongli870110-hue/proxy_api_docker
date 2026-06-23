// deno.ts - 简单 HTTP 代理：把请求转发到固定的目标主机（使用 http，不带原始端口）
const TARGET_HOST = Deno.env.get("DENO_TARGET_HOST") ?? "api.groq.com";
const TARGET_PROTOCOL = "http"; // 固定使用 http（按你要求暂不考虑 https）

Deno.serve({ hostname: "0.0.0.0", port: 8000 }, async (request) => {
  try {
    const incoming = new URL(request.url);

    // 构造目标 URL：使用固定的 TARGET_HOST 和 http 协议，保留 path 与 query（不携带原始端口）
    const targetUrl = `${TARGET_PROTOCOL}://${TARGET_HOST}${incoming.pathname}${incoming.search}`;

    // 复制并调整请求头，确保 Host 指向上游目标主机
    const headers = new Headers(request.headers);
    headers.set("host", TARGET_HOST);

    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "follow",
    });

    // 移除不应透传的 hop-by-hop headers
    const respHeaders = new Headers(upstreamResponse.headers);
    respHeaders.delete("connection");
    respHeaders.delete("keep-alive");
    respHeaders.delete("transfer-encoding");
    respHeaders.delete("upgrade");

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

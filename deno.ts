// deno.ts - proxy that returns upstream redirects to client (does not follow them)
const TARGET_HOST = Deno.env.get("DENO_TARGET_HOST") ?? "api.groq.com";
const TARGET_PROTOCOL = Deno.env.get("DENO_TARGET_PROTOCOL") ?? "https"; // 你指定要用 http 时保留为 "http"

Deno.serve({ hostname: "0.0.0.0", port: 8000 }, async (request) => {
  try {
    const incoming = new URL(request.url);
    const targetUrl = `${TARGET_PROTOCOL}://${TARGET_HOST}${incoming.pathname}${incoming.search}`;

    // 复制并调整请求头，确保 Host 指向上游目标主机
    const headers = new Headers(request.headers);
    headers.set("host", TARGET_HOST);

    // 如果请求有 body，预先读取为 ArrayBuffer（方便重用/传递）；若无 body，则为 undefined
    let body: ArrayBuffer | undefined;
    // HTTP methods that may have a body:
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      try {
        // 注意：这会把 body 缓存到内存，通常请求体不会非常大；如有大体积上传请改用 stream 方案并禁用自动跟随重定向
        const buf = await request.arrayBuffer();
        body = buf.byteLength ? buf : undefined;
      } catch (e) {
        console.error("error reading request body:", e);
        body = undefined;
      }
    }

    // 不在代理端自动跟随重定向 —— 把上游的 3xx 原样返回给客户端
    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
      redirect: "manual",
    });

    // 透传上游响应（删除 hop-by-hop headers）
    const respHeaders = new Headers(upstreamResponse.headers);
    respHeaders.delete("connection");
    respHeaders.delete("keep-alive");
    respHeaders.delete("transfer-encoding");
    respHeaders.delete("upgrade");

    // 返回给客户端（包含 3xx 的 Location，如果上游返回重定向，客户端会收到并可自行跟随）
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

// deno.ts (只示意需要改动的部分)
const OPENAI_API_HOST = Deno.env.get("DENO_TARGET_HOST") ?? "api.groq.com";

Deno.serve(async (request) => {
  const url = new URL(request.url);
  url.host = OPENAI_API_HOST;

  const newRequest = new Request(url.toString(), {
    headers: request.headers,
    method: request.method,
    body: request.body,
    redirect: "follow",
  });
  return await fetch(newRequest);
});

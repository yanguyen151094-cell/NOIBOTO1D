Deno.serve((req) => {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  const isGet = req.method === "GET";
  const isSubscribe = mode === "subscribe";
  const isTokenOk = token === "T01D2026";
  const hasChallenge = !!challenge;

  console.log("[FB-DEBUG] method:", req.method, "| mode:", mode, "| token:", JSON.stringify(token), "| challenge:", JSON.stringify(challenge));
  console.log("[FB-DEBUG] isGet:", isGet, "| isSubscribe:", isSubscribe, "| isTokenOk:", isTokenOk, "| hasChallenge:", hasChallenge);

  if (isGet && isSubscribe && isTokenOk && hasChallenge) {
    console.log("[FB-DEBUG] => 200 OK, challenge:", challenge);
    return new Response(challenge, { status: 200 });
  }

  console.log("[FB-DEBUG] => 403 WHY? missing:", [!isGet && "method", !isSubscribe && "mode", !isTokenOk && "token", !hasChallenge && "challenge"].filter(Boolean).join(", "));
  return new Response("Forbidden", { status: 403 });
});

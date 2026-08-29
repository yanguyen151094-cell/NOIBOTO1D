import { AccessToken } from "npm:livekit-server-sdk@2.17.0";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const { roomName, identity, name } = await req.json();

    if (!roomName || !identity) {
      return new Response(
        JSON.stringify({ error: "Thiếu roomName hoặc identity" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const url = Deno.env.get("LIVEKIT_URL");

    if (!apiKey || !apiSecret || !url) {
      return new Response(
        JSON.stringify({ error: "Chưa cấu hình LiveKit keys" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: name || identity,
      ttl: "2h",
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return new Response(
      JSON.stringify({ token, url }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Lỗi tạo token" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const bin = String.fromCharCode(...bytes);
  return btoa(bin);
}

function base64url(data: string): string {
  return utf8ToBase64(data)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function createJWT(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = encoder.encode(`${headerB64}.${payloadB64}`);

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, data);
  const signatureB64 = base64url(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

function cleanSecret(value: string | undefined): string | undefined {
  if (!value) return value;
  // Bỏ prefix KEY= nếu vô tình copy cả dòng, rồi trim khoảng trắng & xuống dòng
  return value
    .replace(/^LIVEKIT_API_KEY=/, "")
    .replace(/^LIVEKIT_API_SECRET=/, "")
    .replace(/^LIVEKIT_URL=/, "")
    .trim();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { roomName, identity, name } = body;

    if (!roomName || !identity) {
      return new Response(
        JSON.stringify({ error: "Thiếu roomName hoặc identity" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = cleanSecret(Deno.env.get("LIVEKIT_API_KEY"));
    const apiSecret = cleanSecret(Deno.env.get("LIVEKIT_API_SECRET"));
    const url = cleanSecret(Deno.env.get("LIVEKIT_URL"));

    if (!apiKey || !apiSecret || !url) {
      return new Response(
        JSON.stringify({
          error: "Chưa cấu hình đủ LiveKit keys trong Edge Function Secrets (cần LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL)",
          missing: {
            apiKey: !apiKey,
            apiSecret: !apiSecret,
            url: !url,
          },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chẩn đoán nhẹ: trả về độ dài để anh tự kiểm tra, KHÔNG lộ giá trị secret
    const diag = {
      apiKeyLength: apiKey.length,
      apiSecretLength: apiSecret.length,
      url: url,
    };

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 2 * 60 * 60; // 2 giờ

    const payload = {
      iss: apiKey,
      sub: identity,
      nbf: now,
      exp: exp,
      name: name || identity,
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    };

    const token = await createJWT(
      { alg: "HS256", typ: "JWT" },
      payload,
      apiSecret
    );

    return new Response(
      JSON.stringify({ token, url, diag }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lỗi tạo token";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

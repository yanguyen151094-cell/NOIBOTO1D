const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function cleanSecret(value: string | undefined): string | undefined {
  if (!value) return value;
  return value
    .replace(/^AGORA_APP_ID=/, "")
    .replace(/^AGORA_APP_CERTIFICATE=/, "")
    .trim();
}

function certToBytes(cert: string): Uint8Array {
  // Thử hex trước
  if (cert.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(cert)) {
    const bytes = new Uint8Array(cert.length / 2);
    for (let i = 0; i < cert.length; i += 2) {
      bytes[i / 2] = parseInt(cert.slice(i, i + 2), 16);
    }
    return bytes;
  }
  // Thử base64
  try {
    const binStr = atob(cert);
    return Uint8Array.from(binStr, (c) => c.charCodeAt(0));
  } catch {
    // Fallback UTF-8
    return new TextEncoder().encode(cert);
  }
}

async function hmacSha256(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message);
  return new Uint8Array(signature);
}

function uint32ToBytesLE(value: number): Uint8Array {
  const arr = new Uint8Array(4);
  arr[0] = value & 0xff;
  arr[1] = (value >> 8) & 0xff;
  arr[2] = (value >> 16) & 0xff;
  arr[3] = (value >> 24) & 0xff;
  return arr;
}

function uint16ToBytesLE(value: number): Uint8Array {
  const arr = new Uint8Array(2);
  arr[0] = value & 0xff;
  arr[1] = (value >> 8) & 0xff;
  return arr;
}

function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function bytesToBase64(bytes: Uint8Array): string {
  const binStr = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binStr);
}

async function buildAgoraToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string,
  role: number,
  expireInSeconds: number
): Promise<string> {
  const version = "007";
  const appIdBytes = stringToBytes(appId);
  const appCertBytes = certToBytes(appCertificate);
  
  const now = Math.floor(Date.now() / 1000);
  const expire = now + expireInSeconds;
  const salt = Math.floor(Math.random() * 0xFFFFFFFF);
  
  const uidNum = isNaN(Number(uid)) ? 0 : Number(uid);
  
  const message = concatBytes(
    uint32ToBytesLE(now),
    uint32ToBytesLE(salt),
    uint16ToBytesLE(0xFFFF),
    uint32ToBytesLE(expire),
    uint32ToBytesLE(0xFFFF),
    uint32ToBytesLE(role === 1 ? 1 : 0),
    stringToBytes(channelName),
    uint32ToBytesLE(uidNum),
  );
  
  const signature = await hmacSha256(appCertBytes, concatBytes(appIdBytes, message));
  
  const tokenContent = concatBytes(
    uint32ToBytesLE(signature.length),
    signature,
    message
  );
  
  return version + appId + bytesToBase64(tokenContent);
}

Deno.serve(async (req: Request) => {
  console.log("[agora-token] Request:", req.method, req.url);
  
  if (req.method === "OPTIONS") {
    console.log("[agora-token] Handling OPTIONS");
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let channelName = "";
    let uid = "";

    if (req.method === "GET") {
      const url = new URL(req.url);
      channelName = url.searchParams.get("channelName") || "";
      uid = url.searchParams.get("uid") || "";
      console.log("[agora-token] GET params:", { channelName: channelName.substring(0, 20), uid: uid.substring(0, 8) });
    } else if (req.method === "POST") {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        body = {};
      }
      channelName = String(body.channelName ?? "");
      uid = String(body.uid ?? "");
      console.log("[agora-token] POST body:", { channelName: channelName.substring(0, 20), uid: uid.substring(0, 8) });
    } else {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!channelName || !uid) {
      return new Response(
        JSON.stringify({ error: "Thiếu channelName hoặc uid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appId = cleanSecret(Deno.env.get("AGORA_APP_ID"));
    const appCertificate = cleanSecret(Deno.env.get("AGORA_APP_CERTIFICATE"));

    console.log("[agora-token] appId present:", !!appId, "cert present:", !!appCertificate, "cert length:", appCertificate?.length);

    if (!appId || !appCertificate) {
      return new Response(
        JSON.stringify({
          error: "Chưa cấu hình AGORA_APP_ID và AGORA_APP_CERTIFICATE trong Edge Function Secrets",
          missing: {
            appId: !appId,
            appCertificate: !appCertificate,
          },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await buildAgoraToken(
      appId,
      appCertificate,
      channelName,
      uid,
      1,
      3600
    );

    console.log("[agora-token] Token built successfully for channel:", channelName.substring(0, 20));

    return new Response(
      JSON.stringify({ token, appId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lỗi tạo token";
    console.error("[agora-token] Error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

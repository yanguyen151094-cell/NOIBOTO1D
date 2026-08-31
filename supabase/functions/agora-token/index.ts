import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { RtcTokenBuilder, RtcRole } from "npm:agora-access-token@2.0.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function cleanSecret(value: string | undefined): string | undefined {
  if (!value) return value;
  return value
    .replace(/^AGORA_APP_ID=/, "")
    .replace(/^AGORA_APP_CERTIFICATE=/, "")
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
    const channelName = String(body.channelName ?? "");
    const uid = String(body.uid ?? "");

    if (!channelName || !uid) {
      return new Response(
        JSON.stringify({ error: "Thiếu channelName hoặc uid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appId = cleanSecret(Deno.env.get("AGORA_APP_ID"));
    const appCertificate = cleanSecret(Deno.env.get("AGORA_APP_CERTIFICATE"));

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

    const expirationTimeInSeconds = 3600;

    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      expirationTimeInSeconds
    );

    return new Response(
      JSON.stringify({ token, appId }),
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

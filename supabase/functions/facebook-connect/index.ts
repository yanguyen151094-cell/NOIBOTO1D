import { createClient } from "npm:@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v22.0";

// ===== Logging an toàn =====
// TUYỆT ĐỐI KHÔNG log: FACEBOOK_APP_SECRET, SUPABASE_SERVICE_ROLE_KEY,
// Page Access Token, User Access Token.
function log(label: string, data: unknown): void {
  console.log(`[facebook-connect] ${label}:`, JSON.stringify(data));
}

// ===== Callback URL cố định từ Secrets — KHÔNG tự suy ra từ req.url =====
function getCallbackUrl(): string {
  const callbackUrl = Deno.env.get("FACEBOOK_REDIRECT_URI");
  if (!callbackUrl) {
    throw new Error("Thiếu FACEBOOK_REDIRECT_URI trong Supabase Secrets.");
  }
  return callbackUrl.replace(/\/+$/, "");
}

// ===== URL app (Vercel) dùng để redirect sau OAuth =====
function getAppUrl(): string {
  return (Deno.env.get("APP_URL") || "").replace(/\/+$/, "");
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders() });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const ownerId = url.searchParams.get("owner") || null;

    // Callback URL cố định từ FACEBOOK_REDIRECT_URI
    const callbackUrl = getCallbackUrl();

    // ===== Debug mode =====
    if (url.searchParams.get("debug") === "1") {
      return new Response(
        JSON.stringify(
          {
            callbackUrl,
            hasAppId: !!Deno.env.get("FACEBOOK_APP_ID"),
            hasAppSecret: !!Deno.env.get("FACEBOOK_APP_SECRET"),
            hasRedirectUri: !!Deno.env.get("FACEBOOK_REDIRECT_URI"),
            appUrl: getAppUrl() || "undefined",
          },
          null,
          2
        ),
        {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() },
        }
      );
    }

    const appId = Deno.env.get("FACEBOOK_APP_ID");
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");

    if (!appId || !appSecret) {
      log("config-error", { hasAppId: !!appId, hasAppSecret: !!appSecret });
      return new Response(
        "Chưa cấu hình FACEBOOK_APP_ID / FACEBOOK_APP_SECRET trong Supabase Secrets.",
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders() } }
      );
    }

    // ===== BƯỚC 1: chưa có code → redirect sang Facebook authorize =====
    if (!code) {
      // Scopes đủ để: lấy Page, lấy Page Access Token, nhận/gửi Messenger,
      // và subscribe webhook cho Page.
      const scope =
        "pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement";
      // state chỉ chứa ownerId (KHÔNG chứa redirect để tránh mismatch)
      const state = ownerId || "none";

      const fbUrl =
        `${GRAPH}/oauth/authorize?client_id=${encodeURIComponent(appId)}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&response_type=code` +
        `&state=${encodeURIComponent(state)}`;

      log("authorize", { callbackUrl, scope, hasOwner: !!ownerId });
      return Response.redirect(fbUrl, 302);
    }

    // ===== BƯỚC 2: có code → exchange token =====
    const stateValue = url.searchParams.get("state") || "";
    const finalOwnerId = stateValue && stateValue !== "none" ? stateValue : ownerId;

    log("callback-received", { hasCode: true, hasOwner: !!finalOwnerId, callbackUrl });

    // Exchange code → short-lived user token
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(appId)}` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&code=${encodeURIComponent(code)}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      // Log lỗi nhưng KHÔNG log token / secret
      log("token-exchange-error", {
        httpStatus: tokenRes.status,
        errorCode: tokenData?.error?.code ?? "unknown",
        errorMessage: tokenData?.error?.message ?? "Không lấy được access token",
      });
      return new Response(
        `Lỗi trao đổi mã OAuth: ${tokenData?.error?.message ?? "Không lấy được access token."}`,
        { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders() } }
      );
    }

    const userToken = tokenData.access_token as string;
    log("token-exchange-ok", { hasAccessToken: true });

    // Long-lived token
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
        `&client_id=${encodeURIComponent(appId)}` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&fb_exchange_token=${encodeURIComponent(userToken)}`
    );
    const longData = await longRes.json();
    const longToken = (longData.access_token as string) || userToken;
    log("long-lived-token", { ok: !!longData.access_token });

    // /me/accounts — lấy danh sách Page + Page Access Token
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?access_token=${encodeURIComponent(longToken)}&fields=id,name,access_token`
    );
    const pagesData = await pagesRes.json();

    if (pagesData?.error) {
      log("me-accounts-error", {
        errorCode: pagesData.error.code ?? "unknown",
        errorMessage: pagesData.error.message ?? "",
      });
    }
    const pages = pagesData?.data ?? [];
    log("me-accounts", { pageCount: pages.length });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      log("supabase-config-error", { hasUrl: !!supabaseUrl, hasKey: !!serviceKey });
      return new Response(
        "Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong Secrets.",
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders() } }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const results: Array<{ pageId: string; pageName: string; subscribe: string }> = [];

    for (const page of pages) {
      const pageId = page.id as string;
      const pageName = page.name as string;
      const pageToken = page.access_token as string;

      // ===== Lưu Page vào channels =====
      const { data: existing } = await admin
        .from("channels")
        .select("id")
        .eq("platform", "facebook")
        .eq("external_id", pageId)
        .maybeSingle();

      let channelId: string;
      if (existing) {
        channelId = existing.id;
        const upd: Record<string, unknown> = {
          name: pageName,
          status: "connected",
          last_sync: new Date().toISOString(),
        };
        if (finalOwnerId) upd.owner_id = finalOwnerId;
        await admin.from("channels").update(upd).eq("id", channelId);
      } else {
        const ins: Record<string, unknown> = {
          name: pageName,
          platform: "facebook",
          external_id: pageId,
          status: "connected",
          last_sync: new Date().toISOString(),
        };
        if (finalOwnerId) ins.owner_id = finalOwnerId;
        const { data: created, error: cErr } = await admin
          .from("channels")
          .insert(ins)
          .select("id")
          .single();
        if (cErr || !created) {
          log("channel-insert-error", { pageId, error: cErr?.message ?? "unknown" });
          continue;
        }
        channelId = created.id;
      }

      // ===== Lưu Page Access Token (KHÔNG lưu App Secret) =====
      await admin.from("channel_credentials").upsert(
        {
          channel_id: channelId,
          platform: "facebook",
          token: pageToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "channel_id" }
      );

      // ===== Subscribe app cho Page (webhook) =====
      const subRes = await fetch(
        `${GRAPH}/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,messaging_optins&access_token=${encodeURIComponent(pageToken)}`,
        { method: "POST" }
      );
      const subData = await subRes.json().catch(() => null);

      if (!subRes.ok || subData?.error) {
        log("subscribe-page-error", {
          pageId,
          httpStatus: subRes.status,
          errorCode: subData?.error?.code ?? "unknown",
          errorMessage: subData?.error?.message ?? "không rõ",
        });
        results.push({
          pageId,
          pageName,
          subscribe: `lỗi: ${subData?.error?.message ?? "không rõ"}`,
        });
      } else {
        log("subscribe-page-ok", { pageId, success: subData?.success ?? true });
        results.push({ pageId, pageName, subscribe: "ok" });
      }
    }

    log("done", { results });

    // ===== Redirect về trang channels trên Vercel =====
    const appUrl = getAppUrl();
    const redirectTarget = appUrl ? `${appUrl}/channels` : "/channels";
    return Response.redirect(redirectTarget, 302);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi máy chủ.";
    console.error("[facebook-connect] fatal:", message);
    return new Response(message, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders() },
    });
  }
});

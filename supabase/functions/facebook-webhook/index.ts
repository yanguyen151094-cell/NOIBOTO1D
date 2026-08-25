const GRAPH = "https://graph.facebook.com/v22.0";
const HARDCODED_VERIFY_TOKEN = "T01D2026";

async function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string | null
): Promise<boolean> {
  if (!secret || !signature) return true;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return signature === `sha256=${hex}`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ===== FAST PATH: Facebook webhook verification (GET) =====
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    const envToken = (Deno.env.get("FACEBOOK_VERIFY_TOKEN") || "").trim();
    const verifyToken = envToken || HARDCODED_VERIFY_TOKEN;

    if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
      const encoder = new TextEncoder();
      const body = encoder.encode(challenge);
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": String(body.length),
        },
      });
    }
    return new Response("Xác thực webhook thất bại.", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // ===== POST: nhận tin nhắn thật =====
  try {
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const appSecret = (Deno.env.get("FACEBOOK_APP_SECRET") || "").trim();
    const valid = await verifySignature(rawBody, signature, appSecret || null);
    if (!valid) {
      return new Response("Chữ ký không hợp lệ.", {
        status: 401,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const body = JSON.parse(rawBody);
    const entries = body?.entry ?? [];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    for (const entry of entries) {
      const messagingEvents = entry?.messaging ?? [];
      for (const evt of messagingEvents) {
        const senderId = evt?.sender?.id;
        const recipientId = evt?.recipient?.id;
        const message = evt?.message;
        if (!senderId || !recipientId || !message) continue;

        const mid = message.mid as string;
        const text = (message.text as string) || "";

        const { data: channel } = await admin
          .from("channels")
          .select("id")
          .eq("platform", "facebook")
          .eq("external_id", recipientId)
          .maybeSingle();
        if (!channel) continue;

        let { data: customer } = await admin
          .from("customers")
          .select("id")
          .eq("platform", "facebook")
          .eq("external_id", senderId)
          .maybeSingle();

        if (!customer) {
          let customerName = "Khách Facebook";
          try {
            const { data: cred } = await admin
              .from("channel_credentials")
              .select("token")
              .eq("channel_id", channel.id)
              .maybeSingle();
            if (cred?.token) {
              const profRes = await fetch(
                `${GRAPH}/${senderId}?fields=name&access_token=${encodeURIComponent(cred.token)}`
              );
              const prof = await profRes.json();
              if (prof?.name) customerName = prof.name;
            }
          } catch {
            // ignore
          }
          const { data: created } = await admin
            .from("customers")
            .insert({
              name: customerName,
              platform: "facebook",
              external_id: senderId,
              username: senderId,
              first_contact_at: new Date().toISOString(),
              last_interaction_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          customer = created;
        } else {
          await admin
            .from("customers")
            .update({ last_interaction_at: new Date().toISOString() })
            .eq("id", customer.id);
        }

        let { data: conversation } = await admin
          .from("conversations")
          .select("id, assigned_staff_id")
          .eq("channel_id", channel.id)
          .eq("customer_id", customer.id)
          .maybeSingle();

        if (!conversation) {
          const { data: created } = await admin
            .from("conversations")
            .insert({
              channel_id: channel.id,
              customer_id: customer.id,
              status: "unread",
              last_message: text,
              last_message_at: new Date().toISOString(),
            })
            .select("id, assigned_staff_id")
            .single();
          conversation = created;
        }

        if (mid) {
          const { data: existingMsg } = await admin
            .from("messages")
            .select("id")
            .eq("external_id", mid)
            .maybeSingle();
          if (existingMsg) continue;
        }

        await admin.from("messages").insert({
          conversation_id: conversation.id,
          sender: "customer",
          sender_name: null,
          content: text,
          type: "text",
          status: "sent",
          external_id: mid,
          sent_at: new Date().toISOString(),
        });

        const newStatus = conversation.assigned_staff_id ? "unanswered" : "unread";
        await admin
          .from("conversations")
          .update({
            last_message: text,
            last_message_at: new Date().toISOString(),
            status: newStatus,
          })
          .eq("id", conversation.id);
      }
    }

    return new Response("EVENT_RECEIVED", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Lỗi máy chủ.", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
});

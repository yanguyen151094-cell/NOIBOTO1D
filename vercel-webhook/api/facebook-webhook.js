const { createClient } = require('@supabase/supabase-js');

const GRAPH = "https://graph.facebook.com/v22.0";
const HARDCODED_VERIFY_TOKEN = "T01D2026";

module.exports = async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);

  // ===== GET: Facebook webhook verification =====
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") ?? "";

    if (mode === "subscribe" && token === HARDCODED_VERIFY_TOKEN && challenge) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  // ===== POST: Receive messages from Facebook =====
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers["x-hub-signature-256"];
    const appSecret = process.env.FACEBOOK_APP_SECRET || "";

    // Verify signature (optional, skip if no secret)
    if (appSecret && signature) {
      const crypto = require('crypto');
      const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      if (signature !== `sha256=${expected}`) {
        return res.status(401).send("Invalid signature");
      }
    }

    const body = req.body;
    const entries = body?.entry ?? [];

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const admin = createClient(supabaseUrl, serviceKey);

    for (const entry of entries) {
      const messagingEvents = entry?.messaging ?? [];
      for (const evt of messagingEvents) {
        const senderId = evt?.sender?.id;
        const recipientId = evt?.recipient?.id;
        const message = evt?.message;
        if (!senderId || !recipientId || !message) continue;

        const mid = message.mid;
        const text = message.text || "";

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
              const profRes = await fetch(`${GRAPH}/${senderId}?fields=name&access_token=${cred.token}`);
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

    return res.status(200).send("EVENT_RECEIVED");
  } catch (e) {
    return res.status(500).send(e instanceof Error ? e.message : "Server error");
  }
};
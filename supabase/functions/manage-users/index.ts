import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_DOMAIN = "cskh.local";
const OFFLINE_SECRET = "TO1D-2024-OFFLINE";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json();
    const { action } = body;

    // Check if offline admin request
    const isOfflineAdmin = body.offlineAdmin === true && body.offlineSecret === OFFLINE_SECRET;

    let isAdmin = false;

    if (!isOfflineAdmin) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return json({ error: "Chưa xác thực." }, 401);
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: authData, error: userError } = await userClient.auth.getUser();
      if (userError || !authData.user) {
        return json({ error: "Chưa xác thực." }, 401);
      }

      const { data: profile } = await userClient
        .from("profiles")
        .select("role, active")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (!profile || profile.role !== "admin" || !profile.active) {
        return json({ error: "Bạn không có quyền quản trị." }, 403);
      }

      isAdmin = true;
    } else {
      isAdmin = true;
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "create_user") {
      const { username, name, password, role, channelIds } = body;
      if (!username || !password) {
        return json({ error: "Thiếu tên đăng nhập hoặc mật khẩu." }, 400);
      }
      const cleanUsername = String(username).trim().toLowerCase();
      if (!/^[a-z0-9._-]+$/.test(cleanUsername)) {
        return json({ error: "Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm, gạch ngang." }, 400);
      }
      if (String(password).length < 6) {
        return json({ error: "Mật khẩu phải có ít nhất 6 ký tự." }, 400);
      }
      const email = `${cleanUsername}@${EMAIL_DOMAIN}`;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: String(password),
        email_confirm: true,
        user_metadata: {
          username: cleanUsername,
          name: name || cleanUsername,
          role: role === "admin" ? "admin" : "staff",
        },
      });
      if (createError) {
        return json({ error: createError.message }, 400);
      }
      if (Array.isArray(channelIds) && channelIds.length > 0) {
        const rows = channelIds.map((cid: string) => ({
          user_id: created.user.id,
          channel_id: cid,
        }));
        await admin.from("channel_access").insert(rows);
      }
      return json({ ok: true, userId: created.user.id });
    }

    if (action === "reset_password") {
      const { userId, password } = body;
      if (!userId || !password) {
        return json({ error: "Thiếu thông tin." }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: String(password),
      });
      if (error) {
        return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === "set_active") {
      const { userId, active } = body;
      if (!userId) {
        return json({ error: "Thiếu thông tin." }, 400);
      }
      await admin.from("profiles").update({ active: !!active }).eq("id", userId);
      if (active) {
        await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      } else {
        await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      }
      return json({ ok: true });
    }

    if (action === "revoke_sessions") {
      const { userId } = body;
      if (!userId) {
        return json({ error: "Thiếu thông tin." }, 400);
      }
      await admin.rpc("revoke_user_sessions", { uid: userId });
      return json({ ok: true });
    }

    if (action === "delete_user") {
      const { userId } = body;
      if (!userId) {
        return json({ error: "Thiếu thông tin." }, 400);
      }

      const { data: assigned } = await admin
        .from("conversations")
        .select("id")
        .eq("assigned_staff_id", userId)
        .limit(1);
      if (assigned && assigned.length > 0) {
        return json(
          { error: "Tài khoản này còn khách hàng đang phụ trách. Hãy chuyển dữ liệu cho người khác trước khi xóa." },
          400
        );
      }

      await admin.from("notifications").delete().eq("user_id", userId);
      await admin
        .from("staff_evaluations")
        .delete()
        .or(`staff_id.eq.${userId},evaluator_id.eq.${userId}`);
      await admin.from("account_vault").update({ created_by: null }).eq("created_by", userId);
      await admin.from("customer_notes").update({ updated_by: null }).eq("updated_by", userId);
      await admin.from("customer_accounts").update({ created_by: null }).eq("created_by", userId);

      const { error: profErr } = await admin.from("profiles").delete().eq("id", userId);
      if (profErr) {
        return json({ error: profErr.message }, 400);
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(userId);
      if (delErr) {
        return json({ error: delErr.message }, 400);
      }

      return json({ ok: true });
    }

    return json({ error: "Hành động không hợp lệ." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Lỗi máy chủ." }, 500);
  }
});

import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_DOMAIN = "cskh.local";

Deno.serve(async () => {
  const headers = { "Content-Type": "application/json" };
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ ok: true, message: "Tài khoản admin đã tồn tại." }), {
        status: 200,
        headers,
      });
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: `admin@${EMAIL_DOMAIN}`,
      password: "admin123",
      email_confirm: true,
      user_metadata: {
        username: "admin",
        name: "Quản trị viên",
        role: "admin",
      },
    });

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 400,
        headers,
      });
    }

    return new Response(JSON.stringify({ ok: true, userId: data.user.id }), {
      status: 200,
      headers,
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers,
    });
  }
});
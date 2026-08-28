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

    const { data: existingProfiles } = await admin
      .from("profiles")
      .select("id, name, username")
      .eq("role", "admin")
      .limit(1);

    if (existingProfiles && existingProfiles.length > 0) {
      const adminId = existingProfiles[0].id;
      const { data: authUser } = await admin.auth.admin.getUserById(adminId);

      if (authUser && authUser.user) {
        const { error: updateErr } = await admin.auth.admin.updateUserById(adminId, {
          password: "admin123",
        });
        if (updateErr) {
          return new Response(
            JSON.stringify({ ok: false, error: updateErr.message }),
            { status: 400, headers }
          );
        }
        return new Response(
          JSON.stringify({ ok: true, message: "Admin đã tồn tại, mật khẩu đã được đặt lại." }),
          { status: 200, headers }
        );
      }

      await admin.from("profiles").delete().eq("id", adminId);
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
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 400, headers }
      );
    }

    await admin.from("profiles").insert({
      id: data.user.id,
      username: "admin",
      name: "Quản trị viên",
      role: "admin",
      active: true,
      presence: "offline",
      avatar: null,
    });

    return new Response(
      JSON.stringify({ ok: true, userId: data.user.id, message: "Tài khoản admin đã được tạo lại." }),
      { status: 200, headers }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers }
    );
  }
});

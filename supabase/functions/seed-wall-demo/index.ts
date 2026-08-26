import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const headers = { "Content-Type": "application/json" };
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // --- Ensure admin exists ---
    const { data: existingAdmins } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    let adminId = existingAdmins?.[0]?.id;

    if (!adminId) {
      const { data: au, error: auErr } = await admin.auth.admin.createUser({
        email: "admin@cskh.local",
        password: "admin123",
        email_confirm: true,
        user_metadata: { username: "admin", name: "Nguyễn Văn Anh", role: "admin" },
      });
      if (auErr) throw auErr;
      adminId = au.user.id;
      await admin.from("profiles").upsert({
        id: adminId,
        name: "Nguyễn Văn Anh",
        username: "admin",
        role: "admin",
        active: true,
        presence: "online",
        last_active: new Date().toISOString(),
        avatar: null,
      });
    }

    // --- Ensure sample staff users exist ---
    const staffDefs = [
      { email: "staff1@cskh.local", name: "Nguyễn Văn Bình", username: "binh", password: "123456" },
      { email: "staff2@cskh.local", name: "Trần Thị Hương", username: "huong", password: "123456" },
      { email: "staff3@cskh.local", name: "Lê Minh Tú", username: "tu", password: "123456" },
      { email: "staff4@cskh.local", name: "Phạm Thảo Linh", username: "linh", password: "123456" },
    ];

    for (const s of staffDefs) {
      const { data: exProf } = await admin
        .from("profiles")
        .select("id")
        .eq("username", s.username)
        .limit(1);
      if (exProf && exProf.length > 0) continue;
      const { data: u, error: uErr } = await admin.auth.admin.createUser({
        email: s.email,
        password: s.password,
        email_confirm: true,
        user_metadata: { username: s.username, name: s.name, role: "staff" },
      });
      if (uErr) throw uErr;
      await admin.from("profiles").upsert({
        id: u.user.id,
        name: s.name,
        username: s.username,
        role: "staff",
        active: true,
        presence: "offline",
        last_active: new Date().toISOString(),
        avatar: null,
      });
    }

    // --- Get ALL existing active profiles for seeding posts ---
    const { data: allProfiles } = await admin
      .from("profiles")
      .select("id, name, role")
      .eq("active", true);

    const users = (allProfiles ?? []).filter((p: { role: string }) => p.role !== "admin");
    const firstAdmin = (allProfiles ?? []).find((p: { role: string }) => p.role === "admin");
    const seedAuthorId = firstAdmin?.id ?? adminId;
    const seedAuthorName = firstAdmin?.name ?? "Admin";

    // --- Seed posts if none exist ---
    const { count: postCount } = await admin
      .from("staff_posts")
      .select("*", { count: "exact", head: true });

    if ((postCount ?? 0) === 0) {
      const postsSeed = [] as Array<{
        staff_id: string;
        author_id: string;
        author_name: string;
        author_avatar: null;
        content: string;
        image_url: null;
      }>;

      for (const u of users) {
        postsSeed.push({
          staff_id: u.id,
          author_id: seedAuthorId,
          author_name: seedAuthorName,
          author_avatar: null,
          content: `Chào mừng ${u.name} đến với tổ CSKH! Hãy cùng nhau chinh phục KPI tháng này nhé! 🚀`,
          image_url: null,
        });
      }

      postsSeed.push({
        staff_id: seedAuthorId,
        author_id: seedAuthorId,
        author_name: seedAuthorName,
        author_avatar: null,
        content: "Thông báo: tuần này tổ mình đạt KPI 120%. Cảm ơn cả nhà đã nỗ lực! 🎉",
        image_url: null,
      });
      postsSeed.push({
        staff_id: seedAuthorId,
        author_id: seedAuthorId,
        author_name: seedAuthorName,
        author_avatar: null,
        content: "Chia sẻ tips xử lý khiếu nại: luôn lắng nghe trước, đồng cảm sau, đưa giải pháp cuối cùng.",
        image_url: null,
      });

      for (const p of postsSeed) {
        const { error: pErr } = await admin.from("staff_posts").insert(p);
        if (pErr) console.error("Post seed error:", pErr);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, message: "Dữ liệu mẫu đã sẵn sàng." }),
      { status: 200, headers }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers }
    );
  }
});

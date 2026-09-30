// Shared access gate. PostgreSQL RLS is the source of truth for data access.
(function () {
  "use strict";
  const db = supabase.createClient(
    "https://woolaaiunapsaowheifj.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2xhYWl1bmFwc2Fvd2hlaWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMjAyNDEsImV4cCI6MjA5NTU5NjI0MX0.eBebW92-UHQVM8asBA6SwJql9s5DHgqhd0BlC00bUkc"
  );
  const landing = {
    owner: "owner-dashboard.html",
    trainer: "trainer-dashboard.html",
    parent: "parent-dashboard.html"
  };

  async function roles() {
    const { data: authData, error: authError } = await db.auth.getUser();
    if (authError || !authData.user) return { user: null, roles: [] };
    const { data, error } = await db.from("school_members")
      .select("role, school_id")
      .eq("user_id", authData.user.id)
      .eq("status", "active");
    if (error) throw error;
    return {
      user: authData.user,
      roles: (data || []).filter(item => Object.hasOwn(landing, item.role))
    };
  }

  function allowedRole() {
    const page = location.pathname.split("/").pop();
    if (page.startsWith("owner-")) return "owner";
    if (page.startsWith("parent-")) return "parent";
    if (page.startsWith("trainer-")) return "trainer";
    const queryRole = new URLSearchParams(location.search).get("role");
    if (page === "dogs.html" || page.startsWith("dog-")) {
      return ["owner", "trainer", "parent"].includes(queryRole) ? queryRole : "owner";
    }
    return null;
  }

  async function guard() {
    if (/\/join-(parent|trainer)\.html$/.test(location.pathname)) return;
    document.documentElement.style.visibility = "hidden";
    try {
      const account = await roles();
      if (!account.user) {
        const next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
        location.replace("login.html?next=" + next);
        return;
      }
      if (!account.roles.length && !location.pathname.endsWith("/school-onboarding.html")) {
        location.replace("access-pending.html");
        return;
      }
      const expected = allowedRole();
      if (expected && !account.roles.some(member => member.role === expected || (expected === 'trainer' && member.role === 'owner'))) {
        location.replace(landing[account.roles[0].role]);
        return;
      }
      document.documentElement.style.visibility = "";
    } catch (error) {
      console.error("Barkly access check failed", error);
      document.documentElement.style.visibility = "";
      const banner = document.createElement("div");
      banner.textContent = "Could not verify your account. Please reload and try again.";
      banner.setAttribute("role", "alert");
      banner.style.cssText = "position:fixed;z-index:9999;top:0;left:0;right:0;padding:16px;background:#0f1f2e;color:#fff;text-align:center";
      document.body.append(banner);
    }
  }

  window.BarklyAuth = { db, roles, landing, guard };
  guard();
})();

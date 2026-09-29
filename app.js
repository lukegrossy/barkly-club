// Authentication for the Barkly entry screens. PostgreSQL RLS controls records.
(function () {
  "use strict";
  if (typeof supabase === "undefined") return;
  const db = supabase.createClient(
    "https://woolaaiunapsaowheifj.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvb2xhYWl1bmFwc2Fvd2hlaWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMjAyNDEsImV4cCI6MjA5NTU5NjI0MX0.eBebW92-UHQVM8asBA6SwJql9s5DHgqhd0BlC00bUkc"
  );
  const destinations = {
    owner: "owner-dashboard.html",
    trainer: "trainer-dashboard.html",
    parent: "parent-dashboard.html"
  };
  const message = document.getElementById("authMessage");
  function show(text) { if (message) message.textContent = text; }
  async function route() {
    const { data: authData } = await db.auth.getUser();
    if (!authData.user) {
      if (location.pathname.endsWith("/choose-role.html")) location.replace("login.html");
      return;
    }
    const { error: profileError } = await db.from("profiles").upsert(
      { id: authData.user.id, email: authData.user.email },
      { onConflict: "id", ignoreDuplicates: true }
    );
    if (profileError) { show("Could not prepare your account. Please try again."); return; }
    const { data, error } = await db.from("school_members")
      .select("role").eq("user_id", authData.user.id).eq("status", "active");
    if (error) { show("Could not check your school access. Please try again."); return; }
    const role = (data || []).map(item => item.role).find(item => Object.hasOwn(destinations, item));
    if (!role) { location.replace("access-pending.html"); return; }
    const next = new URLSearchParams(location.search).get("next");
    if (next && /^[a-z0-9-]+\.html(?:\?[^#]*)?$/i.test(next)) {
      location.replace(next);
      return;
    }
    location.replace(destinations[role]);
  }
  const login = document.getElementById("loginForm");
  if (login) login.addEventListener("submit", async event => {
    event.preventDefault();
    const button = login.querySelector("button[type=submit]");
    button.disabled = true;
    show("");
    const { error } = await db.auth.signInWithPassword({
      email: login.elements.email.value.trim(),
      password: login.elements.password.value
    });
    button.disabled = false;
    if (error) { show("Could not log in. Check your email and password."); return; }
    await route();
  });
  const signup = document.getElementById("signupForm");
  if (signup) signup.addEventListener("submit", async event => {
    event.preventDefault();
    const button = signup.querySelector("button[type=submit]");
    button.disabled = true;
    show("");
    const { data, error } = await db.auth.signUp({
      email: signup.elements.email.value.trim(),
      password: signup.elements.password.value,
      options: { emailRedirectTo: new URL("login.html", location.href).href }
    });
    button.disabled = false;
    if (error) { show("Could not create the account. Please check the details and try again."); return; }
    if (data.session) { await route(); return; }
    show("Check your email to confirm your account, then log in. Your school will connect your role.");
  });
  if (location.pathname.endsWith("/choose-role.html")) route();
  document.getElementById("signOut")?.addEventListener("click", async () => {
    await db.auth.signOut();
    location.replace("login.html");
  });
})();

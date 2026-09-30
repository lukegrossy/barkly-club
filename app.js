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
  const params=new URLSearchParams(location.search);
  if(params.get('next')==='school-onboarding.html'||params.get('intent')==='school')localStorage.setItem('barkly-start-school','1');
  const startingSchool=()=>localStorage.getItem('barkly-start-school')==='1';
  let recovery=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery';
  function showRecovery(){
    recovery=true;
    document.getElementById('loginForm')?.setAttribute('hidden','');
    document.getElementById('forgotPassword')?.setAttribute('hidden','');
    const panel=document.getElementById('recoveryPanel');if(panel)panel.hidden=false;
    const heading=document.querySelector('h1');if(heading)heading.textContent='Choose a new password';
    show('Enter and confirm your new password below.');
  }
  db.auth.onAuthStateChange?.((event)=>{if(event==='PASSWORD_RECOVERY')showRecovery();});
  if(recovery)showRecovery();
  if(new URLSearchParams(location.hash.slice(1)).has('error_description'))show('This email link has expired or could not be verified. Request a new link below.');
  async function route() {
    if(recovery)return;
    const { data: authData } = await db.auth.getUser();
    if (!authData.user) {
      if (location.pathname.endsWith("/choose-role.html")) location.replace("login.html");
      return;
    }
    const invitePage=window.BarklyPendingInvite?.() || (/^join-(parent|trainer)\.html$/.test(new URLSearchParams(location.search).get('next')||'')?new URLSearchParams(location.search).get('next'):null);
    if (invitePage) { location.replace(invitePage); return; }
    const { error: profileError } = await db.from("profiles").upsert(
      { id: authData.user.id, email: authData.user.email },
      { onConflict: "id", ignoreDuplicates: true }
    );
    if (profileError) { show("Could not prepare your account. Please try again."); return; }
    const { data, error } = await db.from("school_members")
      .select("role").eq("user_id", authData.user.id).eq("status", "active");
    if (error) { show("Could not check your school access. Please try again."); return; }
    const role = (data || []).map(item => item.role).find(item => Object.hasOwn(destinations, item));
    if(startingSchool()&&!invitePage){location.replace('school-onboarding.html');return;}
    if (!role) { location.replace("access-pending.html"); return; }
    const next = new URLSearchParams(location.search).get("next");
    if (next && /^[a-z0-9-]+\.html(?:\?[^#]*)?$/i.test(next)) {
      location.replace(next);
      return;
    }
    location.replace(destinations[role]);
  }
  const login = document.getElementById("loginForm");
  if (login && window.BarklyPendingInvite?.() && !recovery) db.auth.getUser().then(({ data }) => { if (data?.user&&!recovery) location.replace(window.BarklyPendingInvite()); }).catch(() => {});
  document.getElementById('forgotPassword')?.addEventListener('click',()=>{document.getElementById('resetPanel').hidden=false;document.querySelector('#resetForm [name=email]').value=login.elements.email.value;document.querySelector('#resetForm [name=email]').focus();});
  document.getElementById('requestNewReset')?.addEventListener('click',()=>{document.getElementById('resetPanel').hidden=false;document.querySelector('#resetForm [name=email]').focus();});
  document.getElementById('resetForm')?.addEventListener('submit',async ev=>{
    ev.preventDefault();const b=ev.submitter;b.disabled=true;
    try{const {error}=await db.auth.resetPasswordForEmail(ev.target.elements.email.value.trim(),{redirectTo:new URL('login.html',location.href).href});if(error)throw error;show('If an account matches that email, a reset link is on its way. Check your inbox and spam folder. Use the newest link.');}
    catch(error){show(error.message||'Could not request a reset. Please try again.');}finally{b.disabled=false;}
  });
  document.getElementById('recoveryForm')?.addEventListener('submit',async ev=>{
    ev.preventDefault();const f=ev.target,b=ev.submitter;if(f.elements.password.value!==f.elements.confirmPassword.value){show('Your passwords do not match.');return;}b.disabled=true;
    try{const {data,error:authError}=await db.auth.getUser();if(authError||!data?.user)throw Error('This reset link has expired. Request a new link.');const {error}=await db.auth.updateUser({password:f.elements.password.value});if(error)throw error;await db.auth.signOut();history.replaceState(null,'',location.pathname);recovery=false;f.reset();document.getElementById('recoveryPanel').hidden=true;login.hidden=false;document.getElementById('forgotPassword').hidden=false;document.querySelector('h1').textContent='Welcome back';show('Password updated. Log in with your new password.');}
    catch(error){show(error.message||'Could not update your password.');}finally{b.disabled=false;}
  });
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
  if(signup&&!window.BarklyPendingInvite?.()){
    const choice=document.createElement('div');choice.className='auth-copy';choice.innerHTML='<label for="accountPurpose">I’m here to</label><select id="accountPurpose" style="width:100%;padding:14px;border-radius:14px;margin:10px 0 20px;font:inherit"><option value="family">Join my puppy’s school</option><option value="school">Set up my puppy school</option><option value="trainer">Join as a trainer</option></select>';
    signup.before(choice);const purpose=document.getElementById('accountPurpose');purpose.value=startingSchool()?'school':'family';purpose.onchange=()=>{if(purpose.value==='school')localStorage.setItem('barkly-start-school','1');else localStorage.removeItem('barkly-start-school');};
  }
  if(startingSchool())document.querySelectorAll('a[href="login.html"],a[href="create-account.html"]').forEach(a=>a.href+='?intent=school');
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
    show(window.BarklyTrainerInvite?.get() ? "Check your email to confirm your account, then return to accept your trainer invitation." : window.BarklyInvite?.get() ? "Check your email to confirm your account, then return here to connect your puppy." : startingSchool() ? "Check your email to confirm your account, then log in to create your school. Check spam if it hasn’t arrived; use the newest confirmation link." : "Check your email to confirm your account, then log in. Open the family or trainer invitation shared by your school to connect your account.");
    document.getElementById('resendConfirmation').hidden=false;
  });
  document.getElementById('resendConfirmation')?.addEventListener('click',async ev=>{const b=ev.target,email=signup?.elements.email.value.trim();if(!email||!signup.elements.email.checkValidity()){show('Enter your email above first.');return;}b.disabled=true;try{const {error}=await db.auth.resend({type:'signup',email,options:{emailRedirectTo:new URL('login.html',location.href).href}});if(error)throw error;show('Confirmation requested. Check your inbox and spam folder, then use the newest link.');}catch(error){show(error.message||'Could not resend. Please try again.');}finally{b.disabled=false;}});
  if (location.pathname.endsWith("/choose-role.html")) route();
  document.getElementById("signOut")?.addEventListener("click", async () => {
    await db.auth.signOut();
    location.replace("login.html");
  });
})();

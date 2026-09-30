(async function(){
 const $=id=>document.getElementById(id),db=BarklyAuth.db;
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let token=new URLSearchParams(location.hash.slice(1)).get('invite');
 if(token){if(!/^[a-f0-9]{64}$/.test(token)){$('message').textContent='This connection link is incomplete or invalid. Ask your school for a new one.';return;}if(!BarklyInvite.set(token)){$('message').textContent='Please allow browser storage, then reopen your school’s connection link.';return;}history.replaceState(null,'',location.pathname+location.search);}
 token=BarklyInvite.get();
 try{
  const {data,error}=await db.auth.getUser();if(error&&data?.user)throw error;
  if(!token){$('content').innerHTML='<section class="wf-card"><h2>Ask your school for a connection link</h2><p>Your school can create one from your family record. Open it here to connect your puppy.</p><a class="wf-btn" href="login.html">Back to log in</a></section>';return;}
  if(!data?.user){$('content').innerHTML='<section class="wf-hero"><h2>Your puppy’s progress, all together.</h2><p>Log in or create an account using the email you gave your school. Then connect to see class dates, home practice and achievements.</p><div class="wf-actions"><a class="wf-btn" href="login.html?next=join-parent.html">Log in</a><a class="wf-btn" href="create-account.html?next=join-parent.html">Create account</a></div></section>';return;}
  $('content').innerHTML=`<section class="wf-card"><h2>Connect your family</h2><p>Signed in as <strong>${escape(data.user.email)}</strong>.</p><p>This must match the email your school used for the invitation.</p><button id="connect" class="wf-btn">Connect to my puppy</button><div class="wf-actions"><button id="switchAccount" class="wf-btn secondary">Use another account</button><button id="leaveInvite" class="wf-btn secondary">Back to my account</button></div></section>`;
  $('leaveInvite').onclick=()=>{BarklyInvite.clear();location.href='choose-role.html';};
  $('switchAccount').onclick=async()=>{await db.auth.signOut();location.href='login.html?next=join-parent.html';};
  $('connect').onclick=async()=>{const button=$('connect');button.disabled=true;$('message').textContent='';try{
   const {error}=await db.rpc('barkly_accept_parent_invite',{p_token:token});if(error)throw error;
   BarklyInvite.clear();location.replace('parent-dashboard.html');
  }catch(error){$('message').textContent=error.message||'Could not connect. Please ask your school for a new link.';button.disabled=false;}};
 }catch(error){$('message').textContent=error.message||'Could not check your account. Please reload.';}
})();

(async function(){
 const db=BarklyAuth.db,$=id=>document.getElementById(id);
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function fail(text){$('message').textContent=text;$('content').innerHTML='<a class="wf-btn secondary" href="login.html">Back to log in</a>';}
 let token=new URLSearchParams(location.hash.slice(1)).get('invite');
 if(token){if(!/^[a-f0-9]{64}$/.test(token)){fail('This invitation is incomplete. Ask your school for a new link.');return;}if(!BarklyTrainerInvite.set(token)){fail('Allow browser storage and reopen your invitation.');return;}history.replaceState(null,'',location.pathname);}
 token=BarklyTrainerInvite.get();
 if(!token){fail('Open the trainer invitation shared by your school owner.');return;}
 try{
  const {data}=await db.auth.getUser();
  if(!data?.user){$('content').innerHTML='<section class="wf-hero"><h2>Your teaching workspace awaits.</h2><p>Use the email your school invited. Once connected, you’ll see the classes and puppies assigned to you.</p><div class="wf-actions"><a class="wf-btn" href="login.html?next=join-trainer.html">Log in</a><a class="wf-btn" href="create-account.html?next=join-trainer.html">Create account</a></div></section>';return;}
  $('content').innerHTML=`<section class="wf-card"><h2>Join your school’s team</h2><p>Signed in as <strong>${e(data.user.email)}</strong>.</p><p>This invitation adds trainer access, not school-owner access.</p><button id="accept" class="wf-btn">Accept trainer invitation</button><div class="wf-actions"><button id="switch" class="wf-btn secondary">Use another account</button><button id="leave" class="wf-btn secondary">Back to my account</button></div></section>`;
  $('switch').onclick=async()=>{await db.auth.signOut();location.href='login.html?next=join-trainer.html';};
  $('leave').onclick=()=>{BarklyTrainerInvite.clear();location.href='choose-role.html';};
  $('accept').onclick=async()=>{$('accept').disabled=true;$('message').textContent='';try{const {error}=await db.rpc('barkly_accept_trainer_invite',{p_token:token});if(error)throw error;BarklyTrainerInvite.clear();location.replace('trainer-dashboard.html');}catch(error){$('message').textContent=error.message||'Could not accept the invitation.';$('accept').disabled=false;}};
 }catch(error){fail(error.message||'Please reload and try again.');}
})();

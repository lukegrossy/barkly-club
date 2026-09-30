/* Links are created on demand and shared by the school, never sent automatically. */
(function(){
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 document.addEventListener('toggle',async event=>{
  const panel=event.target;if(!panel.matches?.('[data-parent-link]')||!panel.open||panel.dataset.loaded)return;
  panel.dataset.loaded='true';const target=panel.querySelector('[data-link-content]'),owner=panel.dataset.parentLink;
  async function run(action){const {data,error}=await BarklyAuth.db.rpc('barkly_parent_invite',{p_owner:owner,p_action:action});if(error)throw error;return data;}
  function render(data){
   if(data.status==='linked'){target.innerHTML='<p class="wf-success">Parent account connected.</p>';return;}
   const pending=data.status==='pending';
   target.innerHTML=`<p class="wf-small">The parent must confirm and log in with <strong>${esc(panel.dataset.email)}</strong>. Links expire after 7 days.</p><p class="wf-small muted">${pending?'A link is awaiting acceptance. Creating a new one replaces it.':'No current connection link.'}</p><div class="wf-actions"><button type="button" class="wf-btn" data-create-link>${pending?'Create new link':'Create connection link'}</button>${pending?'<button type="button" class="wf-btn secondary" data-revoke-link>Revoke link</button>':''}</div><div data-link-result role="status"></div>`;
   target.querySelector('[data-create-link]').onclick=async event=>{
    if(pending&&!confirm('Replace the previous connection link? The old link will stop working.'))return;
    const button=event.currentTarget;button.disabled=true;const result=target.querySelector('[data-link-result]');
    try{const created=await run('create');if(!created.token){render(created);return;}
     const url=new URL('join-parent.html',location.href);url.hash='invite='+created.token;
     render(created);const result=target.querySelector('[data-link-result]');
     result.innerHTML='<label class="wf-label">Connection link<input readonly data-invite-url aria-label="Parent connection link"></label><button type="button" class="wf-btn secondary" data-copy-link>Copy link</button><p class="wf-small muted" data-copy-status>Copy this link and share it with this parent. No message has been sent.</p>';
     const input=result.querySelector('input');input.value=url.href;
     result.querySelector('[data-copy-link]').onclick=async()=>{try{await navigator.clipboard.writeText(url.href);result.querySelector('[data-copy-status]').textContent='Link copied. Ready to share with this parent.';}catch(_){input.focus();input.select();result.querySelector('[data-copy-status]').textContent='Select and copy the link above.';}};
    }catch(error){result.textContent=error.message||'Could not create a link.';}finally{button.disabled=false;}
   };
   target.querySelector('[data-revoke-link]')?.addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await run('revoke');render({status:'revoked'});}catch(error){target.querySelector('[data-link-result]').textContent=error.message;button.disabled=false;}});
  }
  try{render(await run('status'));}catch(error){target.textContent=error.message||'Could not check access.';panel.dataset.loaded='';}
 },true);
})();

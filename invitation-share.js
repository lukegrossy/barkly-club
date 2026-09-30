(function(){
 window.BarklyShareInvitation=function(target,url,email,kind){
  const actions=document.createElement('div');actions.className='wf-actions';
  const share=document.createElement('button');share.type='button';share.className='wf-btn';share.textContent='Share invitation';
  const draft=document.createElement('a');draft.className='wf-btn secondary';draft.textContent='Open email draft';
  const title=kind==='trainer'?'Join our Barkly teaching team':'Connect your puppy on Barkly';
  const text=`${title}. Open this link and sign up or log in with ${email}. Confirm your email, then return to this invitation. The link expires in 7 days.\n\n${url}`;
  draft.href='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(title)+'&body='+encodeURIComponent(text);
  const status=document.createElement('p');status.className='wf-small muted';status.setAttribute('role','status');status.textContent='Choose Messages, email or another app. Nothing is sent until you send it.';
  share.onclick=async()=>{try{if(navigator.share){await navigator.share({title,text,url});status.textContent='Share menu closed. Check your chosen app to confirm delivery.';}else{await navigator.clipboard.writeText(text);status.textContent='Invitation message copied. Paste it into your preferred app.';}}catch(error){if(error.name!=='AbortError')status.textContent='Use Open email draft or copy the link above.';}};
  actions.append(share,draft);target.append(actions,status);
 };
})();

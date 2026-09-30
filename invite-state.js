/* Keep a pending connection across login and email confirmation in this browser. */
(function(){
 function state(key,otherKey){return {
  get(){try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value&&/^[a-f0-9]{64}$/.test(value.token)&&Date.now()-value.savedAt<7*864e5)return value.token;localStorage.removeItem(key);}catch(_){}return null;},
  set(token){if(!/^[a-f0-9]{64}$/.test(token))return false;try{localStorage.setItem(key,JSON.stringify({token,savedAt:Date.now()}));localStorage.removeItem(otherKey);localStorage.removeItem('barkly-start-school');return true;}catch(_){return false;}},
  clear(){try{localStorage.removeItem(key);}catch(_){}}
 };}
 window.BarklyInvite=state('barkly-parent-invite','barkly-trainer-invite');
 window.BarklyTrainerInvite=state('barkly-trainer-invite','barkly-parent-invite');
 window.BarklyPendingInvite=()=>BarklyTrainerInvite.get()?'join-trainer.html':BarklyInvite.get()?'join-parent.html':null;
})();

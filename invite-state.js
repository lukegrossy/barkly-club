/* Keep a pending connection across login and email confirmation in this browser. */
(function(){
 const key='barkly-parent-invite';
 window.BarklyInvite={
  get(){try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value&&/^[a-f0-9]{64}$/.test(value.token)&&Date.now()-value.savedAt<7*864e5)return value.token;localStorage.removeItem(key);}catch(_){}return null;},
  set(token){if(!/^[a-f0-9]{64}$/.test(token))return false;try{localStorage.setItem(key,JSON.stringify({token,savedAt:Date.now()}));return true;}catch(_){return false;}},
  clear(){try{localStorage.removeItem(key);}catch(_){}}
 };
})();

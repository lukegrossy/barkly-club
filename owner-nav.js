(function(){
 const page=location.pathname.split('/').pop(),role=new URLSearchParams(location.search).get('role');
 if(!page.startsWith('owner-') && !(page.startsWith('dog')&&(!role||role==='owner')))return;
 const active=page.includes('class')||page.includes('program')?'Classes':page.includes('dog')||page.includes('famil')?'Families':page.includes('school')?'School':'Home';
 const icons=['M3 11 12 3l9 8v10h-6v-7H9v7H3Z','M5 5h14v16H5ZM8 2v6m8-6v6M5 11h14','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8 2a4 4 0 0 1 5 4v4','M4 21V5l8-3 8 3v16ZM9 21v-6h6v6M8 7h1m6 0h1M8 11h1m6 0h1'];
 const markup=['Home','Classes','Families','School'].map((name,i)=>`<a class="bottom-nav-item ${name===active?'active':''}" href="${['owner-dashboard.html','owner-classes.html','owner-dogs.html','owner-school.html'][i]}" ${name===active?'aria-current="page"':''}><div class="bottom-nav-icon"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[i]}"/></svg></div>${name}</a>`).join('');
 function update(){let nav=document.querySelector('.bottom-nav');if(!nav){nav=document.createElement('nav');nav.className='bottom-nav';document.body.append(nav)}if(nav.innerHTML!==markup)nav.innerHTML=markup;nav.setAttribute('aria-label','Owner navigation')}
 update();const observer=new MutationObserver(()=>{observer.disconnect();update();observer.observe(document.body,{childList:true,subtree:true})});observer.observe(document.body,{childList:true,subtree:true});
})();

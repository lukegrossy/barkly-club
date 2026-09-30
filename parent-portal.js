(async function(){
 'use strict';
 const db=BarklyAuth.db,$=id=>document.getElementById(id),page=location.pathname.split('/').pop(),params=new URLSearchParams(location.search);
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rows=result=>{if(result.error)throw result.error;return result.data||[];};
 const out=$('content');let dog,school,account;
 const link=(path,text,primary=false)=>`<a class="wf-btn ${primary?'':'secondary'}" href="${esc(path)}?dog=${encodeURIComponent(dog.id)}">${esc(text)}</a>`;
 const date=value=>new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:school.time_zone||'Australia/Melbourne'}).format(new Date(value));
 const day=value=>new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:school.time_zone||'Australia/Melbourne'}).format(new Date(value));
 const empty=(title,text)=>`<section class="wf-empty"><img src="assets/barkly-icon.png" alt=""><h2>${esc(title)}</h2><p>${esc(text)}</p></section>`;
 function heading(title,intro){document.querySelector('h1').textContent=title;$('intro').textContent=intro;}
 function message(text,ok=false){$('message').textContent=text;$('message').classList.toggle('wf-success',ok);}
 async function action(button,run){button.disabled=true;message('');try{await run();}catch(error){message(error.message||'Could not save. Please try again.');}finally{button.disabled=false;}}
 function nav(){
  const items=[['parent-dashboard.html','Home','M3 11 12 3l9 8v10h-6v-7H9v7H3Z'],['parent-classes.html','Classes','M5 5h14v16H5ZM8 2v6m8-6v6M5 11h14'],['parent-homework.html','Practice','M5 3h14v18H5ZM8 8h8M8 12h8M8 16h5'],['parent-badges.html','Badges','m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1Z'],['parent-school.html','School','M4 21V5l8-3 8 3v16ZM9 21v-6h6v6']];
  const active=page==='parent-updates.html'?'parent-dashboard.html':page;
  $('parentNav').innerHTML=items.map(([path,label,icon])=>`<a class="bottom-nav-item ${active===path?'active':''}" href="${path}?dog=${dog.id}" ${active===path?'aria-current="page"':''}><div class="bottom-nav-icon"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icon}"/></svg></div>${label}</a>`).join('');
 }
 async function loadWork(){return rows(await db.from('homework_assignments').select('id,title,instructions,status,assigned_at').eq('school_id',school.id).eq('dog_id',dog.id).order('assigned_at',{ascending:false}));}
 async function loadBadges(){return rows(await db.from('dog_badges').select('id,trainer_comment,awarded_at,badge_templates(name,icon,description)').eq('school_id',school.id).eq('dog_id',dog.id).order('awarded_at',{ascending:false}));}
 async function loadUpdates(){return rows(await db.from('parent_updates').select('id,title,update_text,published_at').eq('school_id',school.id).eq('dog_id',dog.id).order('published_at',{ascending:false}));}
 async function loadClasses(){
  const enrolments=rows(await db.from('class_enrolments').select('class_id,status,classes(id,name,location)').eq('school_id',school.id).eq('dog_id',dog.id));
  const active=enrolments.filter(e=>e.status==='active');
  const sessions=active.length?rows(await db.from('sessions').select('id,class_id,starts_at,ends_at,status,classes(name,location),program_stages(name,description)').eq('school_id',school.id).in('class_id',active.map(e=>e.class_id)).in('status',['scheduled','in_progress']).order('starts_at')):[];
  return {enrolments,sessions:sessions.filter(s=>s.status==='in_progress'||new Date(s.starts_at)>=new Date())};
 }
 function badgeCard(b){return `<article class="wf-card"><div class="wf-award-art">${BarklyBadges.render(b.badge_templates?.icon,b.badge_templates?.name)}</div><h3>${esc(b.badge_templates?.name||'Achievement')}</h3><p class="wf-small muted">${esc(day(b.awarded_at))}</p>${b.trainer_comment?`<p class="wf-note">${esc(b.trainer_comment)}</p>`:''}</article>`;}
 async function home(){
  heading(`Hello, ${dog.name}.`,'Small steps at home. Big moments together.');
  const [group,work,badges,updates]=await Promise.all([loadClasses(),loadWork(),loadBadges(),loadUpdates()]);
  const next=group.sessions[0],open=work.filter(w=>w.status!=='completed'),latest=updates[0];
  out.innerHTML=(next?`<section class="wf-hero"><div class="wf-step" style="color:#dce6df">${next.status==='in_progress'?'Class is in progress':'Your next class'}</div><h2>${esc(next.classes?.name||'Puppy school')}</h2><p>${esc(date(next.starts_at))}<br>${esc(next.program_stages?.name||'Your next lesson')}</p>${link('parent-classes.html','See class details')}</section>`:`<section class="wf-hero"><h2>A little practice goes a long way.</h2><p>${group.enrolments.length?'Your school will share the next class date here.':'Your school will add your class schedule here when you’re enrolled.'}</p>${link('parent-homework.html','Open home practice')}</section>`)+`<div class="wf-stats"><a href="parent-homework.html?dog=${dog.id}"><strong>${open.length}</strong><span>To practise</span></a><a href="parent-homework.html?dog=${dog.id}"><strong>${work.length-open.length}</strong><span>Completed</span></a><a href="parent-badges.html?dog=${dog.id}"><strong>${badges.length}</strong><span>Badges earned</span></a></div><section class="wf-card"><div class="wf-step">Make a little time</div><h2>${open.length?esc(open[0].title):'You’re up to date'}</h2><p class="wf-note">${open.length?esc(open[0].instructions||'Open your practice instructions from school.'):'New practice will appear after your trainer publishes class homework.'}</p>${link('parent-homework.html',open.length?'Let’s practise':'View home practice',true)}</section>${badges.length?`<section class="wf-card"><div class="wf-row"><h2>Look how far you’ve come</h2></div><div class="wf-mini-badges">${badges.slice(0,3).map(b=>`<div>${BarklyBadges.render(b.badge_templates?.icon,b.badge_templates?.name)}<span>${esc(b.badge_templates?.name)}</span></div>`).join('')}</div><div class="wf-actions">${link('parent-badges.html','Open badge collection')}</div></section>`:''}<section class="wf-card"><div class="wf-step">From your trainer</div><h2>${esc(latest?.title||'We’re glad you’re here')}</h2><p class="wf-note">${esc(latest?.update_text||'Your trainer’s updates will appear here, ready to revisit at home.')}</p>${link('parent-updates.html','Read family updates')}</section>`;
 }
 async function practice(){
  heading('A little practice, together.',`Home activities chosen by ${school.name} for ${dog.name}.`);
  const work=await loadWork(),done=work.filter(w=>w.status==='completed').length;
  out.innerHTML=`<section class="wf-card"><div class="wf-row"><h2>Your progress</h2><span class="wf-pill">${done} / ${work.length} completed</span></div><progress class="parent-progress" value="${done}" max="${Math.max(1,work.length)}" aria-label="Completed homework"></progress><p class="muted wf-small">Mark an activity complete when you’ve practised it. You can reopen it at any time. Your trainer can see these updates.</p></section><div class="wf-filter"><label for="practiceFilter">Show</label><select id="practiceFilter"><option value="open">To practise</option><option value="completed">Completed</option><option value="all">Everything</option></select></div><div id="practiceList"></div>`;
  function render(){const filter=$('practiceFilter').value,visible=work.filter(w=>filter==='all'||(filter==='open'?w.status!=='completed':w.status==='completed'));
   $('practiceList').innerHTML=visible.map(w=>`<section class="wf-card"><span class="wf-pill">${w.status==='completed'?'Completed':'Ready to practise'}</span><h2>${esc(w.title)}</h2><p class="wf-note">${esc(w.instructions||'Ask your trainer for the practice instructions.')}</p><p class="wf-small muted">Added ${esc(day(w.assigned_at))}</p><button class="wf-btn ${w.status==='completed'?'secondary':''}" data-homework="${w.id}" data-done="${w.status!=='completed'}">${w.status==='completed'?'Practise again':'Mark complete'}</button></section>`).join('')||empty(work.length?'All clear in this view':'Your practice starts here',work.length?'Try another filter to revisit your activities.':'Your school will share home activities after class.');
   $('practiceList').querySelectorAll('[data-homework]').forEach(button=>button.onclick=()=>action(button,async()=>{const {error}=await db.rpc('barkly_parent_homework',{p_assignment:button.dataset.homework,p_done:button.dataset.done==='true'});if(error)throw error;const filter=$('practiceFilter').value;await practice();$('practiceFilter').value=filter;$('practiceFilter').dispatchEvent(new Event('change'));message('Practice progress saved.',true);}));
  }
  render();$('practiceFilter').onchange=render;
 }
 function calendarFile(session){
  const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const clean=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Barkly//Puppy School//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+session.id+'@barkly','DTSTAMP:'+stamp(new Date()),'DTSTART:'+stamp(session.starts_at),'DTEND:'+stamp(session.ends_at||new Date(new Date(session.starts_at).getTime()+3600000)),'SUMMARY:'+clean(session.classes?.name||'Puppy school'),'DESCRIPTION:'+clean(`${dog.name} · ${session.program_stages?.name||'Class session'}`),'LOCATION:'+clean(session.classes?.location||school.location),'END:VEVENT','END:VCALENDAR'];
  const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='barkly-class.ics';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function classes(){
  heading('See you at class.',`Upcoming dates and attendance for ${dog.name}.`);
  const [group,attendanceResult]=await Promise.all([loadClasses(),db.from('session_attendance').select('id,status,sessions(starts_at,classes(name),program_stages(name))').eq('school_id',school.id).eq('dog_id',dog.id)]);
  const attendance=rows(attendanceResult).sort((a,b)=>new Date(b.sessions?.starts_at)-new Date(a.sessions?.starts_at));
  out.innerHTML=`<h2>Coming up</h2>${group.sessions.map(s=>`<section class="wf-card"><div class="wf-step">${esc(date(s.starts_at))}</div><h2>${esc(s.classes?.name||'Class')}</h2><p><strong>${esc(s.program_stages?.name||'Your next lesson')}</strong></p><p class="muted">${esc(s.classes?.location||school.location||'Ask your school for the location.')}</p><p class="wf-small muted">Times shown in ${esc(school.time_zone)}.</p><button class="wf-btn secondary" data-calendar="${s.id}">Add to calendar</button></section>`).join('')||empty('No upcoming dates','Your school’s next scheduled class will appear here.')}<h2>Class memories</h2>${attendance.map(a=>`<section class="wf-card"><div class="wf-row"><h3>${esc(a.sessions?.program_stages?.name||a.sessions?.classes?.name||'Class session')}</h3><span class="wf-pill">${a.status==='present'?'Attended':'Absent'}</span></div><p class="wf-small muted">${a.sessions?.starts_at?esc(date(a.sessions.starts_at)):''}</p></section>`).join('')||'<p class="muted">Your attendance history will grow with every class.</p>'}`;
  out.querySelectorAll('[data-calendar]').forEach(button=>button.onclick=()=>calendarFile(group.sessions.find(s=>s.id===button.dataset.calendar)));
 }
 async function badges(){
  heading('Little wins. Lasting memories.',`${dog.name}’s achievements, awarded by your trainer.`);const awards=await loadBadges();
  out.innerHTML=`<p class="muted">${awards.length} ${awards.length===1?'achievement':'achievements'} to celebrate</p><div class="wf-badge-gallery">${awards.map(badgeCard).join('')}</div>${!awards.length?empty('Their first badge is ahead','Your trainer awards badges when they see each achievement. They’ll appear in this collection.'):''}`;
 }
 async function updates(){
  heading('A note from your trainer.',`Encouragement and guidance for ${dog.name}.`);const notes=await loadUpdates();
  out.innerHTML=notes.map(n=>`<article class="wf-card"><p class="wf-step">${esc(day(n.published_at))}</p><h2>${esc(n.title||'Family update')}</h2><p class="wf-note">${esc(n.update_text)}</p></article>`).join('')||empty('You’re connected','Updates from your trainer will appear here after they publish them.');
 }
 async function schoolPage(){
  heading('Your puppy school.','Your school connection and account details.');
  out.innerHTML=`<section class="wf-hero"><h2>${esc(school.name)}</h2><p>${esc(school.location||'Ask your trainer for school location details.')}</p><p class="wf-small">${esc(school.time_zone)}</p></section><section class="wf-card"><h2>Your puppy</h2><p><strong>${esc(dog.name)}</strong><br>${esc(dog.breed||'Breed not recorded')}</p><p class="wf-small muted">Need to update their details or add another carer? Ask your school to update your family record and create a connection link.</p></section><section class="wf-card"><h2>Your account</h2><p class="wf-note">${esc(account.user.email)}</p><p class="wf-small muted">You can see the puppies your school has connected to this account. Use the puppy selector above to switch between them.</p><button id="signOut" class="wf-btn secondary">Log out</button></section>`;
  $('signOut').onclick=()=>action($('signOut'),async()=>{const {error}=await db.auth.signOut();if(error)throw error;location.href='login.html';});
 }
 try{
  account=await BarklyAuth.roles();if(!account.user)return;
  const schools=account.roles.filter(r=>r.role==='parent').map(r=>r.school_id);
  if(!schools.length){location.replace('access-pending.html');return;}
  const dogs=rows(await db.from('dogs').select('id,school_id,name,breed,schools(id,name,location,time_zone)').in('school_id',schools).order('name'));
  if(!dogs.length){heading('Your account is connected.','Your school still needs to attach a puppy to your family record.');out.innerHTML=empty('Ask your school to add your puppy','Once they connect the record, refresh this page to see your classes and progress.')+'<button class="wf-btn secondary" id="emptyLogout">Log out</button>';$('emptyLogout').onclick=async()=>{await db.auth.signOut();location.href='login.html';};return;}
  dog=dogs.find(d=>d.id===(params.get('dog')||localStorage.getItem('barkly-parent-dog')))||dogs[0];school=dog.schools;if(!school)throw Error('School details are not available.');localStorage.setItem('barkly-parent-dog',dog.id);
  $('puppySelector').innerHTML=dogs.length>1?`<label class="wf-label" for="puppyChoice">Your puppy</label><select id="puppyChoice">${dogs.map(d=>`<option value="${d.id}" ${dog.id===d.id?'selected':''}>${esc(d.name)} · ${esc(d.schools?.name||'School')}</option>`).join('')}</select>`:`<span class="wf-pill">${esc(dog.name)} · ${esc(school.name)}</span>`;
  if($('puppyChoice'))$('puppyChoice').onchange=()=>{location.href=page+'?dog='+$('puppyChoice').value;};nav();
  await ({'parent-dashboard.html':home,'parent-homework.html':practice,'parent-classes.html':classes,'parent-badges.html':badges,'parent-updates.html':updates,'parent-school.html':schoolPage})[page]();
 }catch(error){out.innerHTML='<section class="wf-card"><h2>Let’s try that again</h2><p>We couldn’t load your puppy’s information.</p><button id="retry" class="wf-btn">Reload</button></section>';message(error.message||'Please try again.');$('retry').onclick=()=>location.reload();}
})();

/* School-owned family records. All reads and writes remain subject to database RLS. */
(async function () {
  'use strict';
  const db = BarklyAuth.db, $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search), page = location.pathname.split('/').pop();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const out = $('content');
  let school, dog, account;
  const read = result => { if (result.error) throw result.error; return result.data; };
  const rows = result => read(result) || [];
  const link = (url, label, primary = false) => `<a class="wf-btn ${primary ? '' : 'secondary'}" href="${esc(url)}">${esc(label)}</a>`;
  const empty = text => `<div class="wf-empty"><img src="assets/barkly-icon.png" alt=""><p>${esc(text)}</p></div>`;
  const pill = text => `<span class="wf-pill">${esc(text)}</span>`;
  const profileUrl = id => `owner-dog-detail.html?dog=${encodeURIComponent(id)}`;
  const date = value => value ? new Intl.DateTimeFormat('en-AU', {dateStyle:'medium',timeStyle:'short',timeZone:school.time_zone}).format(new Date(value)) : 'Date not recorded';
  const born = value => value ? new Intl.DateTimeFormat('en-AU', {dateStyle:'medium',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')) : 'Not recorded';
  function message(text, success = false) { $('message').textContent = text; $('message').classList.toggle('wf-success', success); }
  function heading(title, intro) { document.querySelector('h1').textContent = title; $('intro').textContent = intro; }
  async function save(button, action) {
    button.disabled = true; message('');
    try { await action(); } catch (error) { message(error.message || 'Could not save. Please try again.'); $('message').scrollIntoView({block:'center',behavior:'smooth'}); }
    finally { button.disabled = false; }
  }
  async function update(table, id, values) {
    const result = rows(await db.from(table).update(values).eq('id',id).eq('school_id',school.id).select('id'));
    if (result.length !== 1) throw Error('This record could not be updated. Reload to check your access.');
  }
  async function insertOnce(table, values) {
    const result = await db.from(table).insert(values).select('id');
    if (result.error?.code === '23505') {
      const existing = rows(await db.from(table).select('id').eq('id',values.id).eq('school_id',school.id));
      if (existing.length === 1) return;
    }
    rows(result);
  }
  function validName(id) { const value = $(id).value.trim(); if (!value) throw Error('Please enter a name.'); return value; }
  function birthValue(id) { const value = $(id).value; if (value && value > new Intl.DateTimeFormat('sv-SE',{timeZone:school.time_zone}).format(new Date())) throw Error('Date of birth cannot be in the future.'); return value || null; }
  function dogFields(value = {}) {
    return `<div class="wf-grid"><div><label for="dogName">Puppy’s name</label><input id="dogName" value="${esc(value.name)}" required maxlength="120" autocomplete="off"></div><div><label for="breed">Breed</label><input id="breed" value="${esc(value.breed)}" maxlength="120"></div></div><label for="birth">Date of birth</label><input id="birth" type="date" value="${esc(value.date_of_birth)}">`;
  }
  function contactFields(value = {}, prefix = '') {
    return `<label for="${prefix}ownerName">Owner name</label><input id="${prefix}ownerName" value="${esc(value.full_name)}" required maxlength="120" autocomplete="name"><label for="${prefix}ownerEmail">Email</label><input id="${prefix}ownerEmail" value="${esc(value.email)}" type="email" maxlength="254" autocomplete="email"><label for="${prefix}phone">Phone</label><input id="${prefix}phone" value="${esc(value.phone)}" type="tel" maxlength="40" autocomplete="tel">`;
  }
  function contactActions(owner) {
    const phone = (owner.phone || '').replace(/[^+\d]/g,'');
    return `<div class="wf-contact">${owner.email ? `<a href="mailto:${esc(encodeURIComponent(owner.email))}">${esc(owner.email)}</a>` : '<span class="muted">No email recorded</span>'}${phone ? `<a href="tel:${esc(phone)}">${esc(owner.phone)}</a>` : '<span class="muted">No phone recorded</span>'}</div>`;
  }
  async function init() {
    account = await BarklyAuth.roles(); if (!account.user) return false;
    const ids = account.roles.filter(r => r.role === 'owner').map(r => r.school_id);
    if (!ids.length) { location.replace('school-onboarding.html'); return false; }
    const schools = rows(await db.from('schools').select('id,name,time_zone').in('id',ids).order('created_at'));
    if (page.startsWith('owner-dog-')) {
      if (!params.get('dog')) throw Error('Choose a puppy from Families first.');
      dog = read(await db.from('dogs').select('id,school_id,name,breed,date_of_birth,status').eq('id',params.get('dog')).single());
      school = schools.find(s => s.id === dog?.school_id);
    } else if (page === 'owner-class-enrolments.html') {
      const c = read(await db.from('classes').select('id,school_id').eq('id',params.get('class')).single());
      school = schools.find(s => s.id === c?.school_id);
    } else school = schools.find(s => s.id === (params.get('school') || localStorage.getItem('barkly-school'))) || schools[0];
    if (!school) throw Error('This record is not in a school you manage.');
    localStorage.setItem('barkly-school',school.id);
    $('schoolSelect').innerHTML = page === 'owner-dogs.html' && schools.length > 1 ? `<label class="wf-label" for="schoolSwitcher">School</label><select id="schoolSwitcher">${schools.map(s => `<option value="${s.id}" ${s.id===school.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select>` : pill(school.name);
    if ($('schoolSwitcher')) $('schoolSwitcher').onchange = () => { location.href = 'owner-dogs.html?school='+$('schoolSwitcher').value; };
    return true;
  }
  async function directory() {
    heading('Families','Every puppy and their people, together in one place.');
    const [d,c,en] = await Promise.all([
      db.from('dogs').select('id,name,breed,date_of_birth,status,dog_owners(owners(id,full_name,email,phone))').eq('school_id',school.id).order('name'),
      db.from('classes').select('id,name,capacity').eq('school_id',school.id).eq('status','active').order('name'),
      db.from('class_enrolments').select('dog_id,class_id').eq('school_id',school.id).eq('status','active')
    ]);
    const dogs = rows(d), classes = rows(c), enrolments = rows(en);
    const count = id => enrolments.filter(x => x.class_id === id).length;
    out.innerHTML = `<div class="wf-row"><p class="muted">${dogs.length} puppy ${dogs.length===1?'record':'records'}</p><button class="wf-btn" id="addFamily">Add family</button></div><section class="wf-card wf-form"><label for="familySearch">Find a family</label><input type="search" id="familySearch" placeholder="Puppy, owner, email or phone"><div class="wf-grid"><div><label for="classFilter">Class</label><select id="classFilter"><option value="">All classes</option><option value="none">Not enrolled</option>${classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div><label for="statusFilter">Puppy status</label><select id="statusFilter"><option value="active">Active</option><option value="all">All records</option><option value="inactive">Inactive</option></select></div></div></section><p id="familyCount" class="muted wf-small" role="status"></p><div id="familyList"></div><details class="wf-card" id="add" ${location.hash==='#add'?'open':''}><summary>Add a family</summary><form id="familyForm" class="wf-form">${dogFields()}${contactFields()}<label for="enrolClass">First class</label><select id="enrolClass"><option value="">Add to school only</option>${classes.map(c=>`<option value="${c.id}" ${count(c.id)>=c.capacity?'disabled':''} ${params.get('class')===c.id && count(c.id)<c.capacity?'selected':''}>${esc(c.name)} · ${count(c.id)}/${c.capacity} places${count(c.id)>=c.capacity?' · Full':''}</option>`).join('')}</select><p class="muted wf-small">After saving, open their contact to create a parent connection link. No invitation is sent automatically.</p><button class="wf-btn">Save family</button></form></details>`;
    function render() {
      const query = $('familySearch').value.trim().toLowerCase(), group = $('classFilter').value, status = $('statusFilter').value;
      const filtered = dogs.filter(d => {
        const active = enrolments.filter(x=>x.dog_id===d.id);
        const searchable = [d.name,d.breed,...(d.dog_owners||[]).flatMap(x=>[x.owners?.full_name,x.owners?.email,x.owners?.phone])].join(' ').toLowerCase();
        return searchable.includes(query) && (status==='all'||d.status===status) && (!group || (group==='none' ? !active.length : active.some(x=>x.class_id===group)));
      });
      $('familyCount').textContent = `${filtered.length} of ${dogs.length} puppy records`;
      $('familyList').innerHTML = filtered.map(d=>`<section class="wf-card wf-family-card"><div class="wf-row"><div class="wf-identity"><span class="wf-avatar" aria-hidden="true">${esc(d.name.slice(0,1))}</span><div><h2>${esc(d.name)}</h2><p class="muted wf-small">${esc(d.breed||'Breed not recorded')}</p></div></div>${pill(d.status||'active')}</div><p>${esc((d.dog_owners||[]).map(x=>x.owners?.full_name).filter(Boolean).join(' & ')||'No owner connected')}</p><p class="muted wf-small">${esc(enrolments.filter(x=>x.dog_id===d.id).map(x=>classes.find(c=>c.id===x.class_id)?.name||'Enrolled class').join(' · ')||'Ready to enrol in a class')}</p>${link(profileUrl(d.id),'View family →')}</section>`).join('') || empty(dogs.length?'No families match these filters. Try another name or class.':'Your first family starts here. Add a puppy and their owner to get ready for class.');
    }
    ['familySearch','classFilter','statusFilter'].forEach(id => $(id).addEventListener(id==='familySearch'?'input':'change',render)); render();
    $('addFamily').onclick=()=>{ $('add').open=true; $('add').scrollIntoView({behavior:'smooth'}); $('dogName').focus({preventScroll:true}); };
    const request = crypto.randomUUID();
    $('familyForm').onsubmit = event => { event.preventDefault(); save(event.submitter,async()=>{
      const id = read(await db.rpc('barkly_add_family',{p_school:school.id,p_dog:validName('dogName'),p_breed:$('breed').value.trim(),p_birth:birthValue('birth'),p_owner:validName('ownerName'),p_email:$('ownerEmail').value.trim(),p_phone:$('phone').value.trim(),p_class:$('enrolClass').value||null,p_request:request}));
      location.href=profileUrl(id);
    }); };
  }
  const sections = [['detail','Overview'],['sessions','Classes'],['homework','Homework'],['badges','Badges'],['notes','Updates']];
  function frame(active, intro) {
    heading(dog.name, intro);
    out.innerHTML = `<div class="wf-actions">${link('owner-dogs.html','← Families')}</div><nav class="wf-record-tabs" aria-label="Puppy record">${sections.map(([key,label])=>`<a href="owner-dog-${key}.html?dog=${dog.id}" ${key===active?'aria-current="page"':''}>${label}</a>`).join('')}</nav><div id="recordContent"></div>`;
    return $('recordContent');
  }
  async function overview() {
    const target=frame('detail','Puppy details, family contacts and a snapshot of progress.');
    const [o,en,a,h,b,allOwners] = await Promise.all([
      db.from('dog_owners').select('owner_id,relationship,owners(id,full_name,email,phone,user_id)').eq('school_id',school.id).eq('dog_id',dog.id),
      db.from('class_enrolments').select('id,status,classes(id,name)').eq('school_id',school.id).eq('dog_id',dog.id),
      db.from('session_attendance').select('status').eq('dog_id',dog.id).eq('school_id',school.id),
      db.from('homework_assignments').select('status').eq('dog_id',dog.id).eq('school_id',school.id),
      db.from('dog_badges').select('id,badge_templates(name,icon)').eq('dog_id',dog.id).eq('school_id',school.id).order('awarded_at',{ascending:false}),
      db.from('owners').select('id,full_name,email').eq('school_id',school.id).eq('status','active').order('full_name')
    ]);
    const contacts=rows(o).filter(x=>x.owners), enrolments=rows(en), attendance=rows(a), homework=rows(h), badges=rows(b);
    const otherOwners=rows(allOwners).filter(o=>!contacts.some(c=>c.owner_id===o.id));
    target.innerHTML=`<section class="wf-hero"><div class="wf-row"><h2>${esc(dog.name)}</h2>${pill(dog.status||'active')}</div><p>${esc(dog.breed||'Breed not recorded')}<br>Born ${esc(born(dog.date_of_birth))}</p><p>${esc(enrolments.filter(x=>x.status==='active').map(x=>x.classes?.name).join(' · ')||'No active class yet')}</p>${link('owner-dog-sessions.html?dog='+dog.id,'Manage classes')}</section><div class="wf-stats"><a href="owner-dog-sessions.html?dog=${dog.id}"><strong>${attendance.filter(x=>x.status==='present').length}</strong><span>Classes attended</span></a><a href="owner-dog-homework.html?dog=${dog.id}"><strong>${homework.filter(x=>x.status!=='completed').length}</strong><span>Home practice</span></a><a href="owner-dog-badges.html?dog=${dog.id}"><strong>${badges.length}</strong><span>Badges earned</span></a></div>${badges.length?`<section class="wf-card"><h3>Recent achievements</h3><div class="wf-mini-badges">${badges.slice(0,3).map(b=>`<div>${BarklyBadges.render(b.badge_templates?.icon,b.badge_templates?.name)}<span>${esc(b.badge_templates?.name||'Badge')}</span></div>`).join('')}</div></section>`:''}<h2>Their people</h2>${contacts.map((rel,i)=>`<section class="wf-card"><div class="wf-row"><h3>${esc(rel.owners.full_name)}</h3>${pill(rel.relationship||'Owner')}</div>${contactActions(rel.owners)}<p class="wf-small muted">${rel.owners.user_id?'Parent account linked':'Parent account not linked yet'}</p>${!rel.owners.user_id?`<details data-parent-link="${rel.owners.id}" data-email="${esc(rel.owners.email)}"><summary>Connect parent account</summary><div data-link-content><p class="muted">Checking connection…</p></div></details>`:''}<details><summary>Edit contact details</summary><form class="wf-form" data-contact="${i}">${contactFields(rel.owners,'contact'+i)}<p class="wf-small muted">Contact changes apply wherever this owner is linked. Changing the email does not change their login.</p><button class="wf-btn">Save contact</button></form></details></section>`).join('')||empty('No owner is connected to this puppy yet.')}<details class="wf-card"><summary>Add a family contact</summary><form id="contactForm" class="wf-form"><label for="existingContact">Contact</label><select id="existingContact"><option value="">Add a new person</option>${otherOwners.map(o=>`<option value="${o.id}">${esc(o.full_name)}${o.email?' · '+esc(o.email):''}</option>`).join('')}</select><div id="newContactFields">${contactFields({},'new')}</div><p class="muted wf-small">Links this person to ${esc(dog.name)}. You can then create a parent connection link from their contact.</p><button class="wf-btn">Add contact</button></form></details><details class="wf-card"><summary>Edit puppy details</summary><form id="dogForm" class="wf-form">${dogFields(dog)}<label for="dogStatus">Status</label><select id="dogStatus"><option value="active" ${dog.status==='active'?'selected':''}>Active</option><option value="inactive" ${dog.status==='inactive'?'selected':''}>Inactive</option></select><p class="wf-small muted">Inactive puppies remain in your records. End any active enrolments separately from Classes.</p><button class="wf-btn">Save puppy details</button></form></details>`;
    $('existingContact').onchange=()=>{const existing=!!$('existingContact').value;$('newContactFields').hidden=existing;$('newownerName').required=!existing;};
    const contactId=crypto.randomUUID(), relationId=crypto.randomUUID();
    $('contactForm').onsubmit=event=>{event.preventDefault();save(event.submitter,async()=>{
      let ownerId=$('existingContact').value;
      if(!ownerId){ownerId=contactId;await insertOnce('owners',{id:ownerId,school_id:school.id,full_name:validName('newownerName'),email:$('newownerEmail').value.trim(),phone:$('newphone').value.trim(),status:'active'});}
      await insertOnce('dog_owners',{id:relationId,school_id:school.id,dog_id:dog.id,owner_id:ownerId,relationship:'owner'});
      await overview();message('Family contact added.',true);
    });};
    $('dogForm').onsubmit=event=>{event.preventDefault();save(event.submitter,async()=>{
      const values={name:validName('dogName'),breed:$('breed').value.trim(),date_of_birth:birthValue('birth'),status:$('dogStatus').value};
      await update('dogs',dog.id,values); Object.assign(dog,values); await overview(); message('Puppy details saved.',true);
    });};
    target.querySelectorAll('[data-contact]').forEach(form=>form.onsubmit=event=>{event.preventDefault();save(event.submitter,async()=>{
      const i=Number(form.dataset.contact), prefix='contact'+i;
      await update('owners',contacts[i].owners.id,{full_name:validName(prefix+'ownerName'),email:$(prefix+'ownerEmail').value.trim(),phone:$(prefix+'phone').value.trim()});
      await overview();message('Contact details saved.',true);
    });});
  }
  async function enrol(dogId, classId) {
    const prior=rows(await db.from('class_enrolments').select('id,status').eq('school_id',school.id).eq('dog_id',dogId).eq('class_id',classId));
    if(prior.length) await update('class_enrolments',prior[0].id,{status:'active'});
    else rows(await db.from('class_enrolments').insert({school_id:school.id,dog_id:dogId,class_id:classId,status:'active'}).select('id'));
  }
  async function sessions() {
    const target=frame('sessions','Manage enrolments and see every recorded class visit.');
    const [en,cl,att,counts]=await Promise.all([
      db.from('class_enrolments').select('id,class_id,status,classes(id,name)').eq('school_id',school.id).eq('dog_id',dog.id),
      db.from('classes').select('id,name,capacity').eq('school_id',school.id).eq('status','active').order('name'),
      db.from('session_attendance').select('id,status,sessions(id,starts_at,classes(name),program_stages(name))').eq('school_id',school.id).eq('dog_id',dog.id),
      db.from('class_enrolments').select('class_id').eq('school_id',school.id).eq('status','active')
    ]);
    const enrolled=rows(en), classes=rows(cl), attendance=rows(att), totals=rows(counts);
    const options=classes.filter(c=>!enrolled.some(x=>x.class_id===c.id&&x.status==='active'));
    target.innerHTML=`<h2>Class enrolments</h2>${enrolled.map(x=>`<section class="wf-card"><div class="wf-row"><h3>${esc(x.classes?.name||'Class')}</h3>${pill(x.status)}</div><div class="wf-actions">${link('owner-class-detail.html?class='+x.class_id,'Open class')}${x.status==='active'?`<button class="wf-btn secondary" data-withdraw="${x.id}">End enrolment</button>`:''}</div></section>`).join('')||empty('Not enrolled yet. Choose a class below.')}<form id="enrolForm" class="wf-card wf-form"><label for="enrolClass">Enrol in a class</label><select id="enrolClass" required><option value="">Choose a class</option>${options.map(c=>{const n=totals.filter(x=>x.class_id===c.id).length;return `<option value="${c.id}" ${n>=c.capacity?'disabled':''}>${esc(c.name)} · ${n}/${c.capacity}${n>=c.capacity?' · Full':''}</option>`}).join('')}</select><button class="wf-btn" ${!options.length||dog.status==='inactive'?'disabled':''}>Enrol puppy</button>${dog.status==='inactive'?'<p class="muted wf-small">Make this puppy active in Overview before enrolling.</p>':''}</form><h2>Attendance history</h2>${attendance.sort((a,b)=>new Date(b.sessions?.starts_at)-new Date(a.sessions?.starts_at)).map(a=>`<section class="wf-card"><div class="wf-row"><h3>${esc(a.sessions?.classes?.name||'Class')}</h3>${pill(a.status)}</div><p>${esc(a.sessions?.program_stages?.name||'Class session')}</p><p class="muted wf-small">${esc(date(a.sessions?.starts_at))}</p>${a.sessions?link('class-session.html?session='+a.sessions.id,'View session'):''}</section>`).join('')||empty('Attendance will appear after you mark this puppy present or absent in a class.')}`;
    $('enrolForm').onsubmit=event=>{event.preventDefault();save(event.submitter,async()=>{await enrol(dog.id,$('enrolClass').value);await sessions();message('Puppy enrolled.',true);});};
    target.querySelectorAll('[data-withdraw]').forEach(button=>button.onclick=()=>{if(!confirm('End this enrolment? Past attendance, homework and badges will stay in the record.'))return;save(button,async()=>{await update('class_enrolments',button.dataset.withdraw,{status:'inactive'});await sessions();message('Enrolment ended. History has been kept.',true);});});
  }
  async function homework() {
    const target=frame('homework','Follow home practice and add tailored exercises when needed.');
    const [a,t]=await Promise.all([
      db.from('homework_assignments').select('id,title,instructions,status,assigned_at,sessions(starts_at,classes(name))').eq('dog_id',dog.id).eq('school_id',school.id).order('assigned_at',{ascending:false}),
      db.from('homework_templates').select('id,title,instructions,program_stages(name)').eq('school_id',school.id).eq('is_active',true).order('title')
    ]);
    const work=rows(a),templates=rows(t);
    target.innerHTML=`<p class="wf-small muted">Class homework appears here automatically when you publish the session.</p><div class="wf-filter"><label for="workFilter">Show</label><select id="workFilter"><option value="all">All homework</option><option value="open">Still practising</option><option value="completed">Completed</option></select></div><div id="workList"></div><details class="wf-card" id="addHomework"><summary>Add home practice</summary><form id="homeworkForm" class="wf-form"><label for="homeworkTemplate">Start with</label><select id="homeworkTemplate"><option value="">Write my own</option>${templates.map(t=>`<option value="${t.id}">${esc(t.title)}${t.program_stages?.name?' · '+esc(t.program_stages.name):''}</option>`).join('')}</select><label for="workTitle">Title</label><input id="workTitle" required maxlength="160"><label for="instructions">Instructions for the family</label><textarea id="instructions" required maxlength="6000"></textarea><p class="muted wf-small">Visible in the linked parent account. No email is sent.</p><button class="wf-btn">Assign home practice</button></form></details>`;
    function render() {
      const filter=$('workFilter').value, filtered=work.filter(w=>filter==='all'||(filter==='completed'?w.status==='completed':w.status!=='completed'));
      $('workList').innerHTML=filtered.map(w=>`<section class="wf-card"><div class="wf-row"><h3>${esc(w.title)}</h3>${pill(w.status==='completed'?'Completed':'Practising')}</div><p class="wf-note">${esc(w.instructions||'No instructions recorded.')}</p><p class="muted wf-small">Assigned ${esc(date(w.assigned_at))}${w.sessions?.classes?.name?' · '+esc(w.sessions.classes.name):''}</p><button class="wf-btn secondary" data-work="${w.id}" data-status="${w.status==='completed'?'assigned':'completed'}">${w.status==='completed'?'Reopen practice':'Mark completed'}</button></section>`).join('')||empty('No homework in this view. Assign an exercise below or publish homework from class.');
      $('workList').querySelectorAll('[data-work]').forEach(button=>button.onclick=()=>save(button,async()=>{await update('homework_assignments',button.dataset.work,{status:button.dataset.status});await homework();message('Homework progress updated.',true);}));
    }
    render();$('workFilter').onchange=render;
    $('homeworkTemplate').onchange=()=>{const t=templates.find(t=>t.id===$('homeworkTemplate').value);$('workTitle').value=t?.title||'';$('instructions').value=t?.instructions||'';};
    const id=crypto.randomUUID();
    $('homeworkForm').onsubmit=event=>{event.preventDefault();save(event.submitter,async()=>{
      if(!$('instructions').value.trim())throw Error('Add the practice instructions.');
      await insertOnce('homework_assignments',{id,school_id:school.id,dog_id:dog.id,homework_template_id:$('homeworkTemplate').value||null,title:validName('workTitle'),instructions:$('instructions').value.trim(),status:'assigned'});
      await homework();message('Home practice assigned.',true);
    });};
  }
  async function badges() {
    const target=frame('badges','Celebrate progress with a badge for each achievement.');
    const [a,t]=await Promise.all([
      db.from('dog_badges').select('id,badge_template_id,trainer_comment,awarded_at,badge_templates(name,icon,description)').eq('school_id',school.id).eq('dog_id',dog.id).order('awarded_at',{ascending:false}),
      db.from('badge_templates').select('id,name,icon,description,unlock_criteria,program_stages(name)').eq('school_id',school.id).eq('is_active',true).order('name')
    ]);
    const awarded=rows(a),templates=rows(t), available=templates.filter(t=>!awarded.some(a=>a.badge_template_id===t.id));
    target.innerHTML=`<h2>${awarded.length} ${awarded.length===1?'badge':'badges'} earned</h2><div class="wf-badge-gallery">${awarded.map(a=>`<article class="wf-card"><div class="wf-award-art">${BarklyBadges.render(a.badge_templates?.icon,a.badge_templates?.name)}</div><h3>${esc(a.badge_templates?.name||'Badge')}</h3><p class="wf-small muted">${esc(date(a.awarded_at))}</p>${a.trainer_comment?`<p class="wf-note">${esc(a.trainer_comment)}</p>`:''}</article>`).join('')}</div>${!awarded.length?empty('Their collection starts with the first achievement. Choose an earned badge below.'):''}<section class="wf-card"><h2>Award an achievement</h2><label class="wf-label" for="badgeSearch">Find a badge</label><input id="badgeSearch" type="search" placeholder="Name or lesson"><form id="badgeForm" class="wf-form"><fieldset class="wf-badge-grid" id="badgeOptions"><legend class="wf-sr-only">Choose a badge</legend></fieldset><div id="badgePreview" class="wf-note" aria-live="polite">Choose a badge to see its achievement.</div><label for="badgeComment">A note for the family (optional)</label><textarea id="badgeComment" maxlength="2000"></textarea><p class="muted wf-small">Award after you have observed the achievement. The badge appears in the linked parent account.</p><button class="wf-btn" id="awardButton" disabled>Award badge</button></form></section>`;
    let selected=null;
    function render(){const query=$('badgeSearch').value.toLowerCase();const filtered=available.filter(b=>(b.name+' '+(b.program_stages?.name||'')).toLowerCase().includes(query));$('badgeOptions').innerHTML=filtered.map(b=>`<label class="wf-badge-option"><input type="radio" name="badge" value="${b.id}" ${selected===b.id?'checked':''}>${BarklyBadges.render(b.icon,b.name)}<strong>${esc(b.name)}</strong><span>${esc(b.program_stages?.name||'School badge')}</span></label>`).join('')||'<p class="muted">No unearned badges match. Manage designs in your course library.</p>';}
    render();$('badgeSearch').oninput=render;
    $('badgeOptions').onchange=event=>{selected=event.target.value;const b=available.find(b=>b.id===selected);$('badgePreview').textContent=b?.unlock_criteria||b?.description||'Confirm this achievement before awarding.';$('awardButton').disabled=!b;};
    const id=crypto.randomUUID();
    $('badgeForm').onsubmit=event=>{event.preventDefault();save(event.submitter,async()=>{if(!selected)throw Error('Choose a badge first.');const r=await db.from('dog_badges').insert({id,school_id:school.id,dog_id:dog.id,badge_template_id:selected,trainer_comment:$('badgeComment').value.trim()||null});if(r.error&&r.error.code!=='23505')throw r.error;await badges();message(r.error?'This badge was already awarded.':'Badge awarded.',true);});};
  }
  async function notes() {
    const target=frame('notes','Trainer updates shared with this puppy’s family.');
    const updates=rows(await db.from('parent_updates').select('id,title,update_text,published_at').eq('school_id',school.id).eq('dog_id',dog.id).order('published_at',{ascending:false}));
    target.innerHTML=`<section class="wf-card"><h2>Add a family update</h2><form id="noteForm" class="wf-form"><label for="noteTitle">Title</label><input id="noteTitle" required maxlength="160" placeholder="A lovely breakthrough today"><label for="noteText">Update</label><textarea id="noteText" required maxlength="6000" placeholder="What went well, what to practise and anything the family should know."></textarea><p class="wf-note">Shared with the linked parent account. This is not a private staff note. No email is sent.</p><button class="wf-btn">Publish family update</button></form></section><h2>Previous updates</h2>${updates.map(n=>`<article class="wf-card"><h3>${esc(n.title||'Trainer update')}</h3><p class="muted wf-small">${esc(date(n.published_at))}</p><p class="wf-note">${esc(n.update_text)}</p></article>`).join('')||empty('Published updates will appear here and in the linked parent account.')}`;
    const id=crypto.randomUUID();$('noteForm').onsubmit=event=>{event.preventDefault();save(event.submitter,async()=>{if(!$('noteText').value.trim())throw Error('Write an update first.');await insertOnce('parent_updates',{id,school_id:school.id,dog_id:dog.id,title:validName('noteTitle'),update_text:$('noteText').value.trim(),published_at:new Date().toISOString()});await notes();message('Family update published.',true);});};
  }
  async function classEnrolments() {
    const classId=params.get('class');
    const [c,d,en]=await Promise.all([
      db.from('classes').select('id,name,capacity,status').eq('school_id',school.id).eq('id',classId).single(),
      db.from('dogs').select('id,name,breed,status,dog_owners(owners(full_name))').eq('school_id',school.id).order('name'),
      db.from('class_enrolments').select('id,dog_id,status').eq('school_id',school.id).eq('class_id',classId)
    ]);
    const group=read(c),dogs=rows(d),enrolments=rows(en),active=enrolments.filter(x=>x.status==='active');
    heading(group.name,'Build your class list and open each family’s record.');
    out.innerHTML=`<div class="wf-actions">${link('owner-class-detail.html?class='+classId,'← Class schedule')}${link('owner-dogs.html?class='+classId+'#add','Add a new family',true)}</div><section class="wf-hero"><h2>${active.length} of ${group.capacity} places filled</h2><p>${Math.max(0,group.capacity-active.length)} places remaining</p></section><h2>Enrolled puppies</h2><div id="enrolledList">${active.map(en=>{const d=dogs.find(d=>d.id===en.dog_id);return `<section class="wf-card"><h3>${esc(d?.name||'Puppy')}</h3><p class="muted">${esc((d?.dog_owners||[]).map(x=>x.owners?.full_name).filter(Boolean).join(' & '))}</p><div class="wf-actions">${link(profileUrl(en.dog_id),'View family')}<button class="wf-btn secondary" data-remove="${en.id}">End enrolment</button></div></section>`}).join('')||empty('Add existing puppies below, or create a new family.')}</div><h2>Add from your school</h2><label class="wf-label" for="dogSearch">Find a puppy</label><input id="dogSearch" type="search" placeholder="Puppy or owner name"><div id="availableDogs" style="margin-top:16px"></div>`;
    function render(){const query=$('dogSearch').value.toLowerCase();const available=dogs.filter(d=>d.status==='active'&&!active.some(x=>x.dog_id===d.id)&&[d.name,...(d.dog_owners||[]).map(x=>x.owners?.full_name)].join(' ').toLowerCase().includes(query));$('availableDogs').innerHTML=available.map(d=>`<section class="wf-card wf-row"><div><h3>${esc(d.name)}</h3><p class="muted wf-small">${esc(d.breed||'Breed not recorded')}</p></div><button class="wf-btn" data-enrol="${d.id}" ${active.length>=group.capacity||group.status!=='active'?'disabled':''}>${active.length>=group.capacity?'Full':'Enrol'}</button></section>`).join('')||empty('No other active puppies match. You can add a new family above.');$('availableDogs').querySelectorAll('[data-enrol]').forEach(button=>button.onclick=()=>save(button,async()=>{await enrol(button.dataset.enrol,classId);await classEnrolments();message('Puppy enrolled.',true);}));}
    render();$('dogSearch').oninput=render;out.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{if(!confirm('End this enrolment? Past attendance and progress will be kept.'))return;save(button,async()=>{await update('class_enrolments',button.dataset.remove,{status:'inactive'});await classEnrolments();message('Enrolment ended.',true);});});
  }
  try {
    if(!await init())return;
    const routes={'owner-dogs.html':directory,'owner-dog-detail.html':overview,'owner-dog-sessions.html':sessions,'owner-dog-homework.html':homework,'owner-dog-badges.html':badges,'owner-dog-notes.html':notes,'owner-class-enrolments.html':classEnrolments};
    await routes[page]();
  } catch(error) {
    out.innerHTML=`<section class="wf-card"><h2>We couldn’t open this record</h2><p>Your saved information has not changed.</p>${link('owner-dogs.html','Back to Families')}<button class="wf-btn secondary" id="retry">Try again</button></section>`;
    message(error.message||'Please reload and try again.');$('retry').onclick=()=>location.reload();
  }
})();

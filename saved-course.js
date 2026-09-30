(async function(){
 'use strict';const db=BarklyAuth.db,$=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('program');let dirty=false,request=crypto.randomUUID();
 const read=r=>{if(r.error)throw r.error;return r.data;};
 window.onbeforeunload=ev=>{if(dirty){ev.preventDefault();ev.returnValue='';}};
 try{
  const program=read(await db.from('programs').select('id,school_id,name').eq('id',id).single());
  const original=read(await db.rpc('barkly_course_plan',{p_program:id})),plan=structuredClone(original);
  $('intro').textContent='Edit lessons, home practice and badge artwork. Reordering affects new class schedules; existing dates stay booked. Already-issued homework stays unchanged. Badge edits also update the artwork and name shown on earned badges.';
  $('content').innerHTML='<a class="wf-link" id="back">← Course overview</a><form id="editForm" class="wf-card wf-form" novalidate style="margin-top:20px"><div id="editor"></div><div class="wf-actions"><button class="wf-btn" id="saveCourse">Save changes</button><button class="wf-btn secondary" id="copyCourse" type="button">Save as new course</button></div><p class="muted wf-small">Use a new course for a different lesson sequence or achievements without changing current groups. General course resources without a lesson stay in the original course.</p></form>';
  $('back').href='owner-program-detail.html?program='+encodeURIComponent(id);
  BarklyCourseEditor($('editor'),plan,()=>{dirty=true;});
  async function save(copy){
   const invalid=[...$('editForm').querySelectorAll('input,textarea')].find(el=>!el.checkValidity());if(invalid){let p=invalid.parentElement;while(p){if(p.tagName==='DETAILS')p.open=true;p=p.parentElement;}invalid.reportValidity();return;}
   if(!confirm(copy?'Create a separate course for future classes?':'Save this course? Upcoming lessons use these resources. Already-issued homework stays unchanged; earned badges reflect any name or artwork edits.'))return;
   $('saveCourse').disabled=$('copyCourse').disabled=true;$('message').textContent='';
   try{const draft=structuredClone(plan);if(copy){draft.name=plan.name.slice(0,113)+' (copy)';draft.stages.forEach(s=>{delete s.id;s.homework.forEach(h=>delete h.id);s.badges.forEach(b=>delete b.id);});}
    const saved=read(await db.rpc('barkly_save_course',{p_school:program.school_id,p_program:copy?null:id,p_original:copy?null:original,p_plan:draft,p_request:request}));dirty=false;location.href='owner-program-detail.html?program='+saved;
   }catch(error){$('message').textContent=error.message||'Could not save. Your draft is still here.';$('message').scrollIntoView({block:'center'});$('saveCourse').disabled=$('copyCourse').disabled=false;}
  }
  $('editForm').onsubmit=ev=>{ev.preventDefault();save(false);};$('copyCourse').onclick=()=>save(true);
 }catch(error){$('message').textContent=error.message||'Could not load this course.';$('content').innerHTML='<a class="wf-btn" href="owner-programs.html">Back to courses</a>';}
})();

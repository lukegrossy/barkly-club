-- Owner-only course editing. Existing work stays attached to stable template IDs.
create or replace function public.barkly_course_plan(p_program uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.programs%rowtype; result jsonb;
begin
 select * into p from public.programs where id=p_program;
 if p.id is null or private.member_role(p.school_id) is distinct from 'owner' then raise exception 'School owner access required';end if;
 select jsonb_build_object('name',p.name,'description',p.description,'stages',coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,
 'homework',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'title',h.title,'instructions',h.instructions) order by h.created_at,h.id) from public.homework_templates h where h.stage_id=s.id and h.program_id=p.id and h.is_active),'[]'::jsonb),
 'badges',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'description',b.description,'icon',b.icon,'unlock_criteria',b.unlock_criteria) order by b.sort_order,b.id) from public.badge_templates b where b.stage_id=s.id and b.program_id=p.id and b.is_active),'[]'::jsonb)) order by s.sort_order,s.created_at,s.id),'[]'::jsonb)) into result from public.program_stages s where s.program_id=p.id;
 return result;
end $$;

create or replace function public.barkly_save_course(p_school uuid,p_program uuid,p_plan jsonb,p_original jsonb,p_request uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare pid uuid:=p_program; stage uuid; item uuid; s jsonb; h jsonb; b jsonb; n integer:=0; k integer; kept uuid[]:='{}'; hw uuid[]:='{}'; badges uuid[]:='{}'; prior_stage uuid;
begin
 if private.member_role(p_school) is distinct from 'owner' then raise exception 'School owner access required';end if;
 if p_request is null or jsonb_typeof(p_plan->'stages') is distinct from 'array' or coalesce(length(trim(p_plan->>'name')),0) not between 1 and 120 then raise exception 'Add a course name and lessons';end if;
 if jsonb_array_length(p_plan->'stages') not between 1 and 20 then raise exception 'A course needs 1–20 lessons';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(pid,p_request)::text,0));
 if pid is null then
  pid:=p_request;
  if exists(select 1 from public.programs where id=pid and school_id=p_school) then return pid;end if;
  insert into public.programs(id,school_id,name,description,status) values(pid,p_school,trim(p_plan->>'name'),p_plan->>'description','active');
 else
  perform 1 from public.programs where id=pid and school_id=p_school for update;
  if not found then raise exception 'Course not found';end if;
  if public.barkly_course_plan(pid) is distinct from p_original then raise exception 'This course changed since you opened it. Reload before editing again';end if;
 end if;
 for s in select value from jsonb_array_elements(p_plan->'stages') loop
  n:=n+1;stage:=nullif(s->>'id','')::uuid;
  if coalesce(length(trim(s->>'name')),0) not between 1 and 160 then raise exception 'Every lesson needs a name';end if;
  if stage is not null then
   if stage=any(kept) or not exists(select 1 from public.program_stages where id=stage and program_id=pid and school_id=p_school) then raise exception 'Invalid or repeated lesson';end if;
   update public.program_stages set name=trim(s->>'name'),description=s->>'description',sort_order=n where id=stage;
  else
   insert into public.program_stages(school_id,program_id,name,description,sort_order) values(p_school,pid,trim(s->>'name'),s->>'description',n) returning id into stage;
  end if;
  kept:=array_append(kept,stage);hw:='{}';badges:='{}';k:=0;
  if jsonb_typeof(s->'homework') is distinct from 'array' or jsonb_typeof(s->'badges') is distinct from 'array' then raise exception 'Invalid lesson resources';end if;
  for h in select value from jsonb_array_elements(s->'homework') loop
   item:=nullif(h->>'id','')::uuid;
   if coalesce(length(trim(h->>'title')),0) not between 1 and 160 then raise exception 'Every homework activity needs a title';end if;
   if item is not null then
    if item=any(hw) or not exists(select 1 from public.homework_templates where id=item and stage_id=stage and program_id=pid and school_id=p_school) then raise exception 'Invalid homework item';end if;
    update public.homework_templates set title=trim(h->>'title'),instructions=h->>'instructions',is_active=true where id=item;
   else
    insert into public.homework_templates(school_id,program_id,stage_id,title,instructions,is_active) values(p_school,pid,stage,trim(h->>'title'),h->>'instructions',true) returning id into item;
   end if;
   hw:=array_append(hw,item);
  end loop;
  update public.homework_templates set is_active=false where program_id=pid and stage_id=stage and not(id=any(hw));
  for b in select value from jsonb_array_elements(s->'badges') loop
   k:=k+1;item:=nullif(b->>'id','')::uuid;
   if coalesce(length(trim(b->>'name')),0) not between 1 and 160 then raise exception 'Every badge needs a name';end if;
   if item is not null then
    if item=any(badges) or not exists(select 1 from public.badge_templates where id=item and stage_id=stage and program_id=pid and school_id=p_school) then raise exception 'Invalid badge item';end if;
    update public.badge_templates set name=trim(b->>'name'),description=b->>'description',unlock_criteria=b->>'unlock_criteria',icon=b->>'icon',sort_order=k,is_active=true where id=item;
   else
    insert into public.badge_templates(school_id,program_id,stage_id,name,description,unlock_criteria,icon,sort_order,is_active) values(p_school,pid,stage,trim(b->>'name'),b->>'description',b->>'unlock_criteria',b->>'icon',k,true) returning id into item;
   end if;
   badges:=array_append(badges,item);
  end loop;
  update public.badge_templates set is_active=false where program_id=pid and stage_id=stage and not(id=any(badges));
 end loop;
 for prior_stage in select id from public.program_stages where program_id=pid and not(id=any(kept)) loop
  if exists(select 1 from public.sessions where stage_id=prior_stage) then raise exception 'A removed lesson is already scheduled. Save as a new course to preserve class history';end if;
  update public.homework_templates set is_active=false where stage_id=prior_stage;
  update public.badge_templates set is_active=false where stage_id=prior_stage;
  delete from public.program_stages where id=prior_stage;
 end loop;
 update public.programs set name=trim(p_plan->>'name'),description=p_plan->>'description' where id=pid;
 return pid;
end $$;
revoke all on function public.barkly_course_plan(uuid),public.barkly_save_course(uuid,uuid,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.barkly_course_plan(uuid),public.barkly_save_course(uuid,uuid,jsonb,jsonb,uuid) to authenticated;
grant delete on public.program_stages to authenticated;
create policy stages_owner_delete_unused on public.program_stages for delete to authenticated using (private.member_role(school_id)='owner' and not exists(select 1 from public.sessions s where s.stage_id=program_stages.id) and not exists(select 1 from public.homework_templates h where h.stage_id=program_stages.id and h.is_active) and not exists(select 1 from public.badge_templates b where b.stage_id=program_stages.id and b.is_active));

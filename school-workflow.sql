-- Owner onboarding, atomic weekly scheduling and repeat-safe session delivery.
alter table public.schools add column if not exists time_zone text not null default 'Australia/Melbourne';
alter table public.schools add column if not exists location text;
alter table public.sessions add column if not exists stage_id uuid references public.program_stages(id) on delete set null;
create index if not exists sessions_stage_idx on public.sessions(stage_id);
grant update(name, time_zone, location) on public.schools to authenticated;
create policy schools_owner_update on public.schools for update to authenticated
using ((select private.member_role(id))='owner') with check ((select private.member_role(id))='owner');

-- Privilege is required only to bootstrap ownership of a NEW school.
-- This function cannot grant membership in an existing school or to another user.
create or replace function private.create_owned_school(p_name text,p_timezone text,p_location text,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); email_address text; sid uuid;
begin
 select email into email_address from auth.users where id=u and email_confirmed_at is not null;
 if u is null or email_address is null then raise exception 'Confirm your email before creating a school'; end if;
 if p_request is null or length(trim(p_name)) not between 2 and 120 then raise exception 'Enter a school name (2–120 characters)'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Choose a valid time zone'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,0));
 select s.id into sid from public.schools s join public.school_members m on m.school_id=s.id where s.slug='school-'||p_request::text and m.user_id=u and m.role='owner';
 if sid is not null then return sid; end if;
 insert into public.profiles(id,email) values(u,email_address) on conflict(id) do nothing;
 insert into public.schools(name,slug,time_zone,location) values(trim(p_name),'school-'||p_request::text,p_timezone,left(nullif(trim(p_location),''),200)) returning id into sid;
 insert into public.school_members(school_id,user_id,role,status) values(sid,u,'owner','active');
 return sid;
end $$;
revoke all on function private.create_owned_school(text,text,text,uuid) from public,anon;
grant execute on function private.create_owned_school(text,text,text,uuid) to authenticated;
create or replace function public.barkly_create_school(p_name text,p_timezone text,p_location text,p_request uuid)
returns uuid language sql security invoker set search_path='' as $$ select private.create_owned_school(p_name,p_timezone,p_location,p_request) $$;

create or replace function public.barkly_schedule_course(p_school uuid,p_name text,p_location text,p_capacity integer,p_trainer uuid,p_start timestamp,p_minutes integer,p_program uuid,p_plan jsonb,p_request uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare pid uuid:=p_program; cid uuid; sid uuid; item jsonb; hw jsonb; badge jsonb; i integer:=0; tz text; start_time timestamptz; st record;
begin
 if private.member_role(p_school) is distinct from 'owner' then raise exception 'School owner access required'; end if;
 if p_request is null or length(trim(p_name)) not between 1 and 120 or p_capacity not between 1 and 100 or p_minutes not between 15 and 240 or p_start is null then raise exception 'Check class name, capacity, start and duration'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request::text,0));
 select id into cid from public.classes where id=p_request and school_id=p_school;
 if cid is not null then return cid; end if;
 select time_zone into tz from public.schools where id=p_school;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=tz) then raise exception 'Set a valid school time zone first'; end if;
 if p_trainer is not null and not exists(select 1 from public.school_members where school_id=p_school and user_id=p_trainer and role in ('owner','trainer') and status='active') then raise exception 'Choose a trainer from this school'; end if;
 if pid is null then
  if p_plan is null or jsonb_typeof(p_plan->'stages') is distinct from 'array' then raise exception 'Choose a course template or add lessons'; end if;
  if jsonb_array_length(p_plan->'stages') not between 1 and 20 or length(trim(p_plan->>'name')) not between 1 and 120 then raise exception 'Provide 1–20 lessons and a program name'; end if;
  insert into public.programs(school_id,name,description,status) values(p_school,p_plan->>'name',p_plan->>'description','active') returning id into pid;
  for item in select value from jsonb_array_elements(p_plan->'stages') loop
   i:=i+1;
   if coalesce(length(trim(item->>'name')),0)=0 then raise exception 'Every lesson needs a name'; end if;
   insert into public.program_stages(school_id,program_id,name,description,sort_order) values(p_school,pid,item->>'name',item->>'description',i) returning id into sid;
   for hw in select value from jsonb_array_elements(coalesce(item->'homework','[]'::jsonb)) loop
    if coalesce(length(trim(hw->>'title')),0)=0 then raise exception 'Homework needs a title'; end if;
    insert into public.homework_templates(school_id,program_id,stage_id,title,instructions,is_active) values(p_school,pid,sid,hw->>'title',hw->>'instructions',true);
   end loop;
   for badge in select value from jsonb_array_elements(coalesce(item->'badges','[]'::jsonb)) loop
    if coalesce(length(trim(badge->>'name')),0)=0 then raise exception 'Badges need names'; end if;
    insert into public.badge_templates(school_id,program_id,stage_id,name,description,icon,unlock_criteria,sort_order,is_active) values(p_school,pid,sid,badge->>'name',badge->>'description',badge->>'icon',badge->>'unlock_criteria',i,true);
   end loop;
  end loop;
 elsif not exists(select 1 from public.programs where id=pid and school_id=p_school) then raise exception 'Program must belong to this school';
 end if;
 if (select count(*) from public.program_stages where program_id=pid and school_id=p_school) not between 1 and 20 then raise exception 'Program needs 1–20 lessons before scheduling'; end if;
 insert into public.classes(id,school_id,program_id,name,location,capacity,trainer_id,status,start_date) values(p_request,p_school,pid,trim(p_name),nullif(trim(p_location),''),p_capacity,p_trainer,'active',p_start::date) returning id into cid;
 i:=0;
 for st in select id from public.program_stages where program_id=pid and school_id=p_school order by sort_order,created_at,id loop
  start_time:=(p_start + i*interval '7 days') at time zone tz;
  insert into public.sessions(school_id,class_id,stage_id,starts_at,ends_at,status) values(p_school,cid,st.id,start_time,start_time+p_minutes*interval '1 minute','scheduled');
  i:=i+1;
 end loop;
 update public.classes set end_date=(p_start+(i-1)*interval '7 days')::date where id=cid;
 return cid;
end $$;

create or replace function public.barkly_deliver_session(p_session uuid,p_stage uuid,p_attendance jsonb,p_badges jsonb,p_homework boolean,p_complete boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.sessions%rowtype; pid uuid; item jsonb; dog uuid; badge uuid; hw_count integer:=0; badge_count integer:=0; changed integer;
begin
 select * into s from public.sessions where id=p_session for update;
 if s.id is null or not (coalesce(private.member_role(s.school_id)='owner',false) or coalesce(private.assigned_trainer(s.school_id,s.class_id),false)) then raise exception 'Class staff access required'; end if;
 if s.status='cancelled' then raise exception 'Cancelled sessions cannot be delivered'; end if;
 select program_id into pid from public.classes where id=s.class_id and school_id=s.school_id;
 if p_stage is null or not exists(select 1 from public.program_stages where id=p_stage and program_id=pid and school_id=s.school_id) then raise exception 'Choose a lesson from this class program'; end if;
 if s.stage_id is not null and s.stage_id<>p_stage and (exists(select 1 from public.homework_assignments where session_id=s.id) or s.status='completed') then raise exception 'This lesson already has published work; keep its current lesson'; end if;
 if jsonb_typeof(p_attendance) is distinct from 'array' or jsonb_typeof(p_badges) is distinct from 'array' then raise exception 'Attendance and badges must be lists'; end if;
 if (select count(*) from jsonb_array_elements(p_attendance))<>(select count(distinct x->>'dog_id') from jsonb_array_elements(p_attendance) x) then raise exception 'Duplicate attendance entries'; end if;
 if exists(select 1 from public.class_enrolments e where e.class_id=s.class_id and e.school_id=s.school_id and e.status='active' and not exists(select 1 from jsonb_array_elements(p_attendance) x where x->>'dog_id'=e.dog_id::text)) then raise exception 'Mark each enrolled dog present or absent'; end if;
 for item in select value from jsonb_array_elements(p_attendance) loop
  dog:=(item->>'dog_id')::uuid;
  if item->>'status' not in ('present','absent') or item->>'status' is null or not exists(select 1 from public.class_enrolments where class_id=s.class_id and school_id=s.school_id and dog_id=dog and status='active') then raise exception 'Invalid attendance selection'; end if;
  insert into public.session_attendance(school_id,session_id,dog_id,status,checked_in_at) values(s.school_id,s.id,dog,item->>'status',case when item->>'status'='present' then now() else null end)
  on conflict(session_id,dog_id) do update set status=excluded.status,checked_in_at=case when excluded.status='present' then coalesce(public.session_attendance.checked_in_at,now()) else null end;
 end loop;
 if p_homework then
  insert into public.homework_assignments(school_id,dog_id,session_id,homework_template_id,title,instructions,status)
  select s.school_id,(a->>'dog_id')::uuid,s.id,h.id,h.title,h.instructions,'assigned' from jsonb_array_elements(p_attendance) a cross join public.homework_templates h
  where a->>'status'='present' and h.school_id=s.school_id and h.program_id=pid and h.stage_id=p_stage and h.is_active=true
   and not exists(select 1 from public.homework_assignments old where old.session_id=s.id and old.dog_id=(a->>'dog_id')::uuid and old.homework_template_id=h.id);
  get diagnostics hw_count=row_count;
 end if;
 for item in select value from jsonb_array_elements(p_badges) loop
  dog:=(item->>'dog_id')::uuid;badge:=(item->>'badge_id')::uuid;
  if not exists(select 1 from jsonb_array_elements(p_attendance) a where a->>'dog_id'=dog::text and a->>'status'='present') or not exists(select 1 from public.badge_templates b where b.id=badge and b.school_id=s.school_id and b.program_id=pid and b.stage_id=p_stage and b.is_active=true) then raise exception 'Only attending dogs and this lesson’s badges can be selected'; end if;
  insert into public.dog_badges(school_id,dog_id,badge_template_id,trainer_comment) values(s.school_id,dog,badge,'Achievement checked by class staff') on conflict(dog_id,badge_template_id) do nothing;
  get diagnostics changed=row_count;badge_count:=badge_count+changed;
 end loop;
 update public.sessions set stage_id=p_stage,started_at=coalesce(started_at,now()),status=case when p_complete or status='completed' then 'completed' else 'in_progress' end,completed_at=case when p_complete then coalesce(completed_at,now()) else completed_at end where id=s.id;
 return jsonb_build_object('homework',hw_count,'badges',badge_count,'completed',p_complete or s.status='completed');
end $$;

create or replace function public.barkly_add_family(p_school uuid,p_dog text,p_breed text,p_birth date,p_owner text,p_email text,p_phone text,p_class uuid,p_request uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare did uuid;oid uuid;
begin
 if private.member_role(p_school) is distinct from 'owner' then raise exception 'School owner access required'; end if;
 if p_request is null or coalesce(length(trim(p_dog)),0)=0 or coalesce(length(trim(p_owner)),0)=0 then raise exception 'Enter dog and owner names'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request::text,0));
 select id into did from public.dogs where id=p_request and school_id=p_school;
 if did is not null then return did; end if;
 if p_class is not null and not exists(select 1 from public.classes where id=p_class and school_id=p_school) then raise exception 'Choose a class from this school'; end if;
 insert into public.dogs(id,school_id,name,breed,date_of_birth,status) values(p_request,p_school,trim(p_dog),nullif(trim(p_breed),''),p_birth,'active');
 did:=p_request;
 insert into public.owners(school_id,full_name,email,phone,status) values(p_school,trim(p_owner),nullif(trim(p_email),''),nullif(trim(p_phone),''),'active') returning id into oid;
 insert into public.dog_owners(school_id,dog_id,owner_id,relationship) values(p_school,did,oid,'owner');
 if p_class is not null then insert into public.class_enrolments(school_id,class_id,dog_id,status) values(p_school,p_class,did,'active'); end if;
 return did;
end $$;

revoke all on function public.barkly_create_school(text,text,text,uuid),public.barkly_schedule_course(uuid,text,text,integer,uuid,timestamp,integer,uuid,jsonb,uuid),public.barkly_deliver_session(uuid,uuid,jsonb,jsonb,boolean,boolean),public.barkly_add_family(uuid,text,text,date,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.barkly_create_school(text,text,text,uuid),public.barkly_schedule_course(uuid,text,text,integer,uuid,timestamp,integer,uuid,jsonb,uuid),public.barkly_deliver_session(uuid,uuid,jsonb,jsonb,boolean,boolean),public.barkly_add_family(uuid,text,text,date,text,text,text,uuid,uuid) to authenticated;
create or replace function public.barkly_reschedule_session(p_session uuid,p_local_start timestamp)
returns void language plpgsql security invoker set search_path='' as $$
declare s public.sessions%rowtype;tz text;start_time timestamptz;duration interval;
begin
 select * into s from public.sessions where id=p_session for update;
 if s.id is null or private.member_role(s.school_id) is distinct from 'owner' then raise exception 'School owner access required';end if;
 if s.status in ('completed','cancelled','in_progress') then raise exception 'Only upcoming scheduled sessions can be rescheduled';end if;
 if p_local_start is null then raise exception 'Choose a new date and time';end if;
 select time_zone into tz from public.schools where id=s.school_id;
 start_time:=p_local_start at time zone tz;duration:=coalesce(s.ends_at-s.starts_at,interval '60 minutes');
 update public.sessions set starts_at=start_time,ends_at=start_time+duration where id=s.id;
end $$;
revoke all on function public.barkly_reschedule_session(uuid,timestamp) from public,anon;
grant execute on function public.barkly_reschedule_session(uuid,timestamp) to authenticated;

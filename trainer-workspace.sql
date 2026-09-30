-- Narrow owner controls for trainer invitations, assignment and deactivation.
-- Raw invitation tokens never persist; privileged functions stay in private.
create table private.trainer_invites (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 email text not null,
 full_name text not null,
 token_hash text not null unique,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 revoked_at timestamptz,
 accepted_at timestamptz,
 accepted_by uuid references auth.users(id)
);
create index trainer_invites_school_idx on private.trainer_invites(school_id);
alter table private.trainer_invites enable row level security;
create policy trainer_invites_no_direct_access on private.trainer_invites for all to authenticated using(false) with check(false);
revoke all on private.trainer_invites from public,anon,authenticated;

create or replace function private.trainer_team(p_school uuid,p_action text,p_target uuid,p_email text,p_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare token text; email_address text:=lower(trim(p_email)); member public.school_members%rowtype; result jsonb;
begin
 if auth.uid() is null or private.member_role(p_school) is distinct from 'owner' then raise exception 'School owner access required'; end if;
 -- Serialize team mutations, invitation acceptance and assignment in this school.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trainer-team-'||p_school::text,0));
 if p_action='list' then
  return jsonb_build_object('members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'role',m.role,'status',m.status,'name',p.full_name,'email',p.email) order by m.role,p.full_name) from public.school_members m join public.profiles p on p.id=m.user_id where m.school_id=p_school and m.role in ('owner','trainer')),'[]'::jsonb),
   'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.full_name,'email',i.email,'expires_at',i.expires_at,'status',case when i.expires_at<=now() then 'expired' else 'pending' end) order by i.created_at desc) from private.trainer_invites i where i.school_id=p_school and i.accepted_at is null and i.revoked_at is null),'[]'::jsonb));
 elsif p_action='invite' then
  if email_address is null or email_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(email_address)>254 or coalesce(length(trim(p_name)),0) not between 1 and 120 then raise exception 'Enter a trainer name and valid email'; end if;
  if exists(select 1 from public.school_members m join auth.users u on u.id=m.user_id where m.school_id=p_school and lower(trim(u.email))=email_address and (m.status='active' or m.role<>'trainer')) then raise exception 'This email already has a role at your school'; end if;
  update private.trainer_invites set revoked_at=now() where school_id=p_school and email=email_address and accepted_at is null and revoked_at is null;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into private.trainer_invites(school_id,email,full_name,token_hash,created_by) values(p_school,email_address,trim(p_name),encode(extensions.digest(token,'sha256'),'hex'),auth.uid());
  return jsonb_build_object('token',token,'email',email_address,'expires_at',now()+interval '7 days');
 elsif p_action='revoke' then
  update private.trainer_invites set revoked_at=now() where id=p_target and school_id=p_school and accepted_at is null;
  if not found then raise exception 'Pending invitation not found'; end if;
  return jsonb_build_object('status','revoked');
 elsif p_action='deactivate' then
  select * into member from public.school_members where id=p_target and school_id=p_school and role='trainer' for update;
  if member.id is null or member.user_id=auth.uid() then raise exception 'Choose another trainer in this school'; end if;
  update public.school_members set status='inactive' where id=member.id;
  update public.classes set trainer_id=null where school_id=p_school and trainer_id=member.user_id;
  update private.trainer_invites set revoked_at=now() where school_id=p_school and email=(select lower(trim(email)) from auth.users where id=member.user_id) and accepted_at is null and revoked_at is null;
  return jsonb_build_object('status','inactive');
 end if;
 raise exception 'Unknown team action';
end $$;

create or replace function private.accept_trainer_invite(p_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); verified_email text; inv private.trainer_invites%rowtype; sid uuid;
begin
 select lower(trim(email)) into verified_email from auth.users where id=u and email_confirmed_at is not null;
 if u is null or verified_email is null then raise exception 'Confirm your email and log in first'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'This trainer link is not valid. Ask your school for a new one'; end if;
 select school_id into sid from private.trainer_invites where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if sid is null then raise exception 'This trainer link is not valid. Ask your school for a new one'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trainer-team-'||sid::text,0));
 select * into inv from private.trainer_invites where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if inv.accepted_by=u and exists(select 1 from public.school_members where school_id=sid and user_id=u and role='trainer' and status='active') then return sid; end if;
 if inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at<=now() then raise exception 'This trainer link has expired or is no longer available'; end if;
 if verified_email<>inv.email then raise exception 'Use the verified email your school invited'; end if;
 if not exists(select 1 from public.school_members where school_id=sid and user_id=inv.created_by and role='owner' and status='active') then raise exception 'Ask the school owner for a new invitation'; end if;
 if exists(select 1 from public.school_members where school_id=sid and user_id=u and role<>'trainer') then raise exception 'This email already has a different role at this school. Use a separate trainer email'; end if;
 insert into public.profiles(id,email,full_name) values(u,verified_email,inv.full_name) on conflict(id) do nothing;
 insert into public.school_members(school_id,user_id,role,status) values(sid,u,'trainer','active') on conflict(school_id,user_id,role) do update set status='active';
 update private.trainer_invites set accepted_by=u,accepted_at=now() where id=inv.id;
 return sid;
end $$;

-- Existing RLS is retained. The owner can assign only an active trainer/owner
-- belonging to the SAME school. Clearing an assignment is explicit.
create or replace function public.barkly_assign_trainer(p_class uuid,p_trainer uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare sid uuid;
begin
 select school_id into sid from public.classes where id=p_class;
 if sid is null or private.member_role(sid) is distinct from 'owner' then raise exception 'School owner access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trainer-team-'||sid::text,0));
 if p_trainer is not null and not exists(select 1 from public.school_members where school_id=sid and user_id=p_trainer and role in ('owner','trainer') and status='active') then raise exception 'Choose an active trainer from this school'; end if;
 update public.classes set trainer_id=p_trainer where id=p_class and school_id=sid;
end $$;
create or replace function public.barkly_trainer_team(p_school uuid,p_action text,p_target uuid default null,p_email text default null,p_name text default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.trainer_team(p_school,p_action,p_target,p_email,p_name) $$;
create or replace function public.barkly_accept_trainer_invite(p_token text)
returns uuid language sql security invoker set search_path='' as $$ select private.accept_trainer_invite(p_token) $$;
revoke all on function private.trainer_team(uuid,text,uuid,text,text),private.accept_trainer_invite(text),public.barkly_assign_trainer(uuid,uuid),public.barkly_trainer_team(uuid,text,uuid,text,text),public.barkly_accept_trainer_invite(text) from public,anon;
grant execute on function private.trainer_team(uuid,text,uuid,text,text),private.accept_trainer_invite(text),public.barkly_assign_trainer(uuid,uuid),public.barkly_trainer_team(uuid,text,uuid,text,text),public.barkly_accept_trainer_invite(text) to authenticated;

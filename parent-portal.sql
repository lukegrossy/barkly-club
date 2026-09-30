-- Email-bound, expiring parent invitations. Raw tokens are returned once, never stored.
-- Private definer functions are required for narrowly scoped membership creation;
-- public wrappers are invoker functions and anonymous callers have no access.
create table private.parent_invites (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 owner_id uuid not null references public.owners(id) on delete cascade,
 email text not null,
 token_hash text not null unique,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 revoked_at timestamptz,
 accepted_at timestamptz,
 accepted_by uuid references auth.users(id)
);
create index parent_invites_owner_idx on private.parent_invites(owner_id);
alter table private.parent_invites enable row level security;
revoke all on private.parent_invites from public,anon,authenticated;

create or replace function private.manage_parent_invite(p_owner uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.owners%rowtype; inv private.parent_invites%rowtype; token text; expiry timestamptz;
begin
 if auth.uid() is null then raise exception 'Log in first'; end if;
 select * into o from public.owners where id=p_owner for update;
 if o.id is null or private.member_role(o.school_id) is distinct from 'owner' then raise exception 'School owner access required'; end if;
 if p_action not in ('status','create','revoke') or p_action is null then raise exception 'Unknown invitation action'; end if;
 if p_action='revoke' then
  update private.parent_invites set revoked_at=now() where owner_id=o.id and accepted_at is null and revoked_at is null;
  return jsonb_build_object('status','revoked');
 end if;
 if o.user_id is not null then return jsonb_build_object('status','linked'); end if;
 if p_action='status' then
  select * into inv from private.parent_invites where owner_id=o.id order by created_at desc,id desc limit 1;
  return jsonb_build_object('status',case when inv.id is null then 'none' when inv.revoked_at is not null then 'revoked' when inv.expires_at<=now() or inv.email<>lower(trim(coalesce(o.email,''))) then 'expired' else 'pending' end,'expires_at',inv.expires_at);
 end if;
 if o.status is distinct from 'active' then raise exception 'Make this contact active first'; end if;
 if o.email is null or trim(o.email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Save a valid parent email in the contact details first'; end if;
 if not exists(select 1 from public.dog_owners where owner_id=o.id and school_id=o.school_id) then raise exception 'Connect a puppy to this contact first'; end if;
 token:=encode(extensions.gen_random_bytes(32),'hex'); expiry:=now()+interval '7 days';
 update private.parent_invites set revoked_at=now() where owner_id=o.id and accepted_at is null and revoked_at is null;
 insert into private.parent_invites(school_id,owner_id,email,token_hash,created_by,expires_at)
 values(o.school_id,o.id,lower(trim(o.email)),encode(extensions.digest(token,'sha256'),'hex'),auth.uid(),expiry);
 return jsonb_build_object('status','pending','token',token,'expires_at',expiry,'email',o.email);
end $$;

create or replace function private.accept_parent_invite(p_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); verified_email text; inv private.parent_invites%rowtype; o public.owners%rowtype; owner_key uuid;
begin
 select lower(trim(email)) into verified_email from auth.users where id=u and email_confirmed_at is not null;
 if u is null or verified_email is null then raise exception 'Confirm your email and log in before connecting'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'This connection link is not valid. Ask your school for a new one'; end if;
 select owner_id into owner_key from private.parent_invites where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 -- Keep owner -> invitation lock ordering identical to creation and revocation.
 select * into o from public.owners where id=owner_key for update;
 select * into inv from private.parent_invites where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if inv.id is null or o.id is null or inv.school_id<>o.school_id then raise exception 'This connection link is not valid. Ask your school for a new one'; end if;
 if inv.accepted_by=u and o.user_id=u and exists(select 1 from public.school_members where school_id=o.school_id and user_id=u and role='parent' and status='active') then return o.school_id; end if;
 if inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at<=now() or o.status is distinct from 'active' then raise exception 'This link has expired or is no longer available. Ask your school for a new one'; end if;
 if verified_email<>inv.email or lower(trim(coalesce(o.email,'')))<>inv.email then raise exception 'Log in using the verified email your school has recorded for this invitation'; end if;
 if o.user_id is not null and o.user_id<>u then raise exception 'This contact is already connected to another account'; end if;
 if exists(select 1 from public.school_members where school_id=o.school_id and user_id=u and role<>'parent') then raise exception 'This email is already used by school staff. Ask your school to invite a separate parent email'; end if;
 if exists(select 1 from public.owners where school_id=o.school_id and user_id=u and id<>o.id) then raise exception 'Your account already has a family contact at this school. Ask the school to link this puppy to that existing contact'; end if;
 insert into public.profiles(id,email,full_name) values(u,verified_email,o.full_name) on conflict(id) do nothing;
 update public.owners set user_id=u where id=o.id;
 insert into public.school_members(school_id,user_id,role,status) values(o.school_id,u,'parent','active')
 on conflict(school_id,user_id,role) do update set status='active';
 update private.parent_invites set accepted_at=now(),accepted_by=u where id=inv.id;
 return o.school_id;
end $$;

-- Parents can change only completion status of work attached to their own puppies.
create or replace function private.parent_homework_progress(p_assignment uuid,p_done boolean)
returns text language plpgsql security definer set search_path='' as $$
declare h public.homework_assignments%rowtype; next_status text;
begin
 if auth.uid() is null or p_done is null then raise exception 'Log in to update your home practice'; end if;
 select * into h from public.homework_assignments where id=p_assignment for update;
 if h.id is null or private.member_role(h.school_id) is distinct from 'parent' or not coalesce(private.can_read_dog(h.school_id,h.dog_id),false) then raise exception 'This homework is not available to your account'; end if;
 next_status:=case when p_done then 'completed' else 'assigned' end;
 update public.homework_assignments set status=next_status where id=h.id;
 return next_status;
end $$;

create or replace function public.barkly_parent_invite(p_owner uuid,p_action text)
returns jsonb language sql security invoker set search_path='' as $$ select private.manage_parent_invite(p_owner,p_action) $$;
create or replace function public.barkly_accept_parent_invite(p_token text)
returns uuid language sql security invoker set search_path='' as $$ select private.accept_parent_invite(p_token) $$;
create or replace function public.barkly_parent_homework(p_assignment uuid,p_done boolean)
returns text language sql security invoker set search_path='' as $$ select private.parent_homework_progress(p_assignment,p_done) $$;
revoke all on function private.manage_parent_invite(uuid,text),private.accept_parent_invite(text),private.parent_homework_progress(uuid,boolean),public.barkly_parent_invite(uuid,text),public.barkly_accept_parent_invite(text),public.barkly_parent_homework(uuid,boolean) from public,anon;
grant execute on function private.manage_parent_invite(uuid,text),private.accept_parent_invite(text),private.parent_homework_progress(uuid,boolean),public.barkly_parent_invite(uuid,text),public.barkly_accept_parent_invite(text),public.barkly_parent_homework(uuid,boolean) to authenticated;

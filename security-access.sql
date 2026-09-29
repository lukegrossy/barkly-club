-- Barkly Schools access repair. Review with the matching frontend changes.
-- Existing rows are preserved; no user is assigned a role by this script.
-- Applied to the existing Supabase project as secure_barkly_school_access.
-- Link an owner to a verified Auth account before opening the protected UI.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.owners add column if not exists user_id uuid references auth.users(id);
create unique index if not exists owners_school_user_unique
  on public.owners (school_id, user_id) where user_id is not null;

-- These functions return booleans/roles only. They never return contact details.
create or replace function private.member_role(p_school_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select sm.role from public.school_members sm
  where sm.school_id = p_school_id
    and sm.user_id = (select auth.uid())
    and sm.status = 'active'
  limit 1
$$;

create or replace function private.assigned_trainer(p_school_id uuid, p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select private.member_role(p_school_id)) = 'trainer'
    and exists (
      select 1 from public.classes c
      where c.id = p_class_id and c.school_id = p_school_id
        and c.trainer_id = (select auth.uid())
    )
$$;

create or replace function private.can_read_class(p_school_id uuid, p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select private.member_role(p_school_id)) = 'owner'
    or (select private.assigned_trainer(p_school_id, p_class_id))
    or (
      (select private.member_role(p_school_id)) = 'parent'
      and exists (
        select 1 from public.class_enrolments ce
        join public.dog_owners rel on rel.dog_id = ce.dog_id
        join public.owners o on o.id = rel.owner_id
        where ce.class_id = p_class_id and ce.school_id = p_school_id
          and rel.school_id = p_school_id and o.school_id = p_school_id
          and o.user_id = (select auth.uid())
      )
    )
$$;

create or replace function private.can_read_dog(p_school_id uuid, p_dog_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.dogs d where d.id = p_dog_id and d.school_id = p_school_id)
    and (
      (select private.member_role(p_school_id)) = 'owner'
    or (
      (select private.member_role(p_school_id)) = 'trainer'
      and exists (
        select 1 from public.class_enrolments ce
        join public.classes c on c.id = ce.class_id
        where ce.dog_id = p_dog_id and ce.school_id = p_school_id
          and c.school_id = p_school_id and c.trainer_id = (select auth.uid())
      )
    )
    or (
      (select private.member_role(p_school_id)) = 'parent'
      and exists (
        select 1 from public.dog_owners rel
        join public.owners o on o.id = rel.owner_id
        where rel.dog_id = p_dog_id and rel.school_id = p_school_id
          and o.school_id = p_school_id and o.user_id = (select auth.uid())
      )
    ))
$$;

create or replace function private.can_manage_dog(p_school_id uuid, p_dog_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.dogs d where d.id = p_dog_id and d.school_id = p_school_id)
    and (
      (select private.member_role(p_school_id)) = 'owner'
    or (
      (select private.member_role(p_school_id)) = 'trainer'
      and exists (
        select 1 from public.class_enrolments ce
        join public.classes c on c.id = ce.class_id
        where ce.dog_id = p_dog_id and ce.school_id = p_school_id
          and c.school_id = p_school_id and c.trainer_id = (select auth.uid())
      )
    ))
$$;

create or replace function private.can_manage_session_dog(p_school_id uuid, p_session_id uuid, p_dog_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
      select 1 from public.sessions s
      join public.classes c on c.id = s.class_id
      join public.dogs d on d.id = p_dog_id
      where s.id = p_session_id and s.school_id = p_school_id
        and c.school_id = p_school_id and d.school_id = p_school_id
    ) and (
      (select private.member_role(p_school_id)) = 'owner'
    or (
      (select private.member_role(p_school_id)) = 'trainer'
      and exists (
        select 1 from public.sessions s
        join public.classes c on c.id = s.class_id
        join public.class_enrolments ce on ce.class_id = c.id
        where s.id = p_session_id and s.school_id = p_school_id
          and c.school_id = p_school_id and c.trainer_id = (select auth.uid())
          and ce.dog_id = p_dog_id and ce.school_id = p_school_id
      )
    ))
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- No anonymous API access, including through a view. Future tables remain private by default.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- Remove broad authenticated grants and regrant only operations the app needs.
revoke all privileges on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update on public.programs, public.program_stages,
  public.classes, public.sessions, public.dogs, public.owners,
  public.dog_owners, public.class_enrolments, public.session_attendance,
  public.parent_updates, public.homework_templates,
  public.homework_assignments, public.badge_templates, public.dog_badges,
  public.trainer_notes to authenticated;
grant delete on public.session_attendance, public.class_enrolments,
  public.dog_badges, public.homework_templates, public.badge_templates to authenticated;

-- Existing views keep their columns, but evaluate underlying table policies as the caller.
do $$
declare item record;
begin
  for item in select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
  loop
    execute format('alter view public.%I set (security_invoker = true)', item.relname);
  end loop;
end $$;

do $$
declare item record;
begin
  for item in select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', item.relname);
  end loop;
end $$;

create policy profiles_self_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_self_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy schools_member_select on public.schools for select to authenticated
  using ((select private.member_role(id)) is not null);
create policy members_select on public.school_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.member_role(school_id)) = 'owner');

create policy programs_member_select on public.programs for select to authenticated
  using ((select private.member_role(school_id)) is not null);
create policy programs_owner_insert on public.programs for insert to authenticated
  with check ((select private.member_role(school_id)) = 'owner');
create policy programs_owner_update on public.programs for update to authenticated
  using ((select private.member_role(school_id)) = 'owner')
  with check ((select private.member_role(school_id)) = 'owner');

create policy stages_member_select on public.program_stages for select to authenticated
  using ((select private.member_role(school_id)) is not null);
create policy stages_owner_insert on public.program_stages for insert to authenticated
  with check ((select private.member_role(school_id)) = 'owner');
create policy stages_owner_update on public.program_stages for update to authenticated
  using ((select private.member_role(school_id)) = 'owner')
  with check ((select private.member_role(school_id)) = 'owner');

create policy classes_visible_select on public.classes for select to authenticated
  using ((select private.can_read_class(school_id, id)));
create policy classes_owner_insert on public.classes for insert to authenticated
  with check ((select private.member_role(school_id)) = 'owner');
create policy classes_owner_update on public.classes for update to authenticated
  using ((select private.member_role(school_id)) = 'owner')
  with check ((select private.member_role(school_id)) = 'owner');

create policy sessions_visible_select on public.sessions for select to authenticated
  using ((select private.can_read_class(school_id, class_id)));
create policy sessions_owner_insert on public.sessions for insert to authenticated
  with check ((select private.member_role(school_id)) = 'owner');
create policy sessions_staff_update on public.sessions for update to authenticated
  using ((select private.member_role(school_id)) = 'owner' or (select private.assigned_trainer(school_id, class_id)))
  with check ((select private.member_role(school_id)) = 'owner' or (select private.assigned_trainer(school_id, class_id)));

create policy dogs_visible_select on public.dogs for select to authenticated
  using ((select private.can_read_dog(school_id, id)));
create policy dogs_owner_insert on public.dogs for insert to authenticated
  with check ((select private.member_role(school_id)) = 'owner');
create policy dogs_owner_update on public.dogs for update to authenticated
  using ((select private.member_role(school_id)) = 'owner')
  with check ((select private.member_role(school_id)) = 'owner');

-- Trainers never receive an owners row, so email and phone stay unavailable.
create policy owners_private_select on public.owners for select to authenticated
  using ((select private.member_role(school_id)) = 'owner' or user_id = (select auth.uid()));
create policy owners_owner_insert on public.owners for insert to authenticated
  with check ((select private.member_role(school_id)) = 'owner');
create policy owners_owner_update on public.owners for update to authenticated
  using ((select private.member_role(school_id)) = 'owner')
  with check ((select private.member_role(school_id)) = 'owner');
create policy dog_owners_private_select on public.dog_owners for select to authenticated
  using ((select private.member_role(school_id)) = 'owner' or (
    (select private.member_role(school_id)) = 'parent' and exists
    (select 1 from public.owners o where o.id = owner_id and o.user_id = (select auth.uid()))));
create policy dog_owners_owner_insert on public.dog_owners for insert to authenticated
  with check ((select private.member_role(school_id)) = 'owner');
create policy dog_owners_owner_update on public.dog_owners for update to authenticated
  using ((select private.member_role(school_id)) = 'owner')
  with check ((select private.member_role(school_id)) = 'owner');

create policy enrolments_visible_select on public.class_enrolments for select to authenticated
  using ((select private.can_read_dog(school_id, dog_id)));
create policy enrolments_owner_insert on public.class_enrolments for insert to authenticated
  with check ((select private.member_role(school_id)) = 'owner');
create policy enrolments_owner_update on public.class_enrolments for update to authenticated
  using ((select private.member_role(school_id)) = 'owner')
  with check ((select private.member_role(school_id)) = 'owner');
create policy enrolments_owner_delete on public.class_enrolments for delete to authenticated
  using ((select private.member_role(school_id)) = 'owner');

create policy attendance_visible_select on public.session_attendance for select to authenticated
  using ((select private.can_read_dog(school_id, dog_id)));
create policy attendance_staff_insert on public.session_attendance for insert to authenticated
  with check ((select private.can_manage_session_dog(school_id, session_id, dog_id)));
create policy attendance_staff_update on public.session_attendance for update to authenticated
  using ((select private.can_manage_session_dog(school_id, session_id, dog_id)))
  with check ((select private.can_manage_session_dog(school_id, session_id, dog_id)));
create policy attendance_staff_delete on public.session_attendance for delete to authenticated
  using ((select private.can_manage_session_dog(school_id, session_id, dog_id)));

create policy notes_staff_select on public.trainer_notes for select to authenticated
  using ((select private.can_manage_dog(school_id, dog_id)));
create policy notes_staff_insert on public.trainer_notes for insert to authenticated
  with check ((select private.can_manage_dog(school_id, dog_id)));
create policy notes_staff_update on public.trainer_notes for update to authenticated
  using ((select private.can_manage_dog(school_id, dog_id)))
  with check ((select private.can_manage_dog(school_id, dog_id)));

create policy updates_visible_select on public.parent_updates for select to authenticated
  using ((select private.can_read_dog(school_id, dog_id)));
create policy updates_staff_insert on public.parent_updates for insert to authenticated
  with check ((select private.can_manage_dog(school_id, dog_id)));
create policy updates_staff_update on public.parent_updates for update to authenticated
  using ((select private.can_manage_dog(school_id, dog_id)))
  with check ((select private.can_manage_dog(school_id, dog_id)));

create policy homework_templates_member_select on public.homework_templates for select to authenticated
  using ((select private.member_role(school_id)) is not null);
create policy homework_templates_owner_insert on public.homework_templates for insert to authenticated
  with check ((select private.member_role(school_id)) = 'owner');
create policy homework_templates_owner_update on public.homework_templates for update to authenticated
  using ((select private.member_role(school_id)) = 'owner')
  with check ((select private.member_role(school_id)) = 'owner');
create policy homework_templates_owner_delete on public.homework_templates for delete to authenticated
  using ((select private.member_role(school_id)) = 'owner');
create policy homework_visible_select on public.homework_assignments for select to authenticated
  using ((select private.can_read_dog(school_id, dog_id)));
create policy homework_staff_insert on public.homework_assignments for insert to authenticated
  with check ((select private.can_manage_dog(school_id, dog_id)));
create policy homework_staff_update on public.homework_assignments for update to authenticated
  using ((select private.can_manage_dog(school_id, dog_id)))
  with check ((select private.can_manage_dog(school_id, dog_id)));

create policy badge_templates_member_select on public.badge_templates for select to authenticated
  using ((select private.member_role(school_id)) is not null);
create policy badge_templates_owner_insert on public.badge_templates for insert to authenticated
  with check ((select private.member_role(school_id)) = 'owner');
create policy badge_templates_owner_update on public.badge_templates for update to authenticated
  using ((select private.member_role(school_id)) = 'owner')
  with check ((select private.member_role(school_id)) = 'owner');
create policy badge_templates_owner_delete on public.badge_templates for delete to authenticated
  using ((select private.member_role(school_id)) = 'owner');
create policy dog_badges_visible_select on public.dog_badges for select to authenticated
  using ((select private.can_read_dog(school_id, dog_id)));
create policy dog_badges_staff_insert on public.dog_badges for insert to authenticated
  with check ((select private.can_manage_dog(school_id, dog_id)));
create policy dog_badges_staff_update on public.dog_badges for update to authenticated
  using ((select private.can_manage_dog(school_id, dog_id)))
  with check ((select private.can_manage_dog(school_id, dog_id)));
create policy dog_badges_staff_delete on public.dog_badges for delete to authenticated
  using ((select private.can_manage_dog(school_id, dog_id)));

-- Owner roster visibility and class enrolment integrity.
-- Applied as the secure_barkly_class_enrolments migration.

create policy profiles_school_owner_select on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.school_members sm
    where sm.user_id = profiles.id
      and (select private.member_role(sm.school_id)) = 'owner'
  )
);

create unique index class_enrolments_one_dog_per_class
  on public.class_enrolments (class_id, dog_id);

create or replace function public.check_class_enrolment()
returns trigger language plpgsql security invoker
set search_path = ''
as $$
declare
  class_school uuid;
  class_capacity integer;
  dog_school uuid;
  enrolled_count integer;
begin
  select c.school_id, c.capacity into class_school, class_capacity
  from public.classes c where c.id = new.class_id for update;
  select d.school_id into dog_school from public.dogs d where d.id = new.dog_id;

  if class_school is null or dog_school is null
    or new.school_id is distinct from class_school
    or new.school_id is distinct from dog_school then
    raise exception 'Dog and class must belong to the same school';
  end if;

  if coalesce(new.status, 'active') = 'active' then
    select count(*) into enrolled_count from public.class_enrolments ce
    where ce.class_id = new.class_id
      and coalesce(ce.status, 'active') = 'active'
      and ce.id is distinct from new.id;
    if enrolled_count >= class_capacity then
      raise exception 'Class is full';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.check_class_enrolment() from public, anon, authenticated;

create trigger enforce_class_enrolment
before insert or update of class_id, dog_id, school_id, status
on public.class_enrolments
for each row execute function public.check_class_enrolment();

-- Step 5.2e · The classes of past years, closed (docs/PLAN.md §2.3, D-082).
-- Seed: 1.º DAW A of this year (class c...001) is Marta's (...002); Lucía (...011) is in it. The
-- test adds 2.º DAW Z of 2020/21, always a past year: by Marta, with her group in subject ...001 and
-- Lucía in it, and an empty class of that year. The administrator is ...001.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

create function pg_temp.changed_rows(statement text) returns bigint language plpgsql as $$
declare
  changed bigint;
begin
  execute statement;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

insert into school_class (id, name, school_year, created_by) values
  ('c0000000-0000-4000-8000-0000000000f1', '2.º DAW Z', '2020/21', '10000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-0000000000f2', '2.º DAW Y', '2020/21', '10000000-0000-4000-8000-000000000002');
insert into class_group (id, class_id, subject_id, teacher_id) values
  ('20000000-0000-4000-8000-0000000000f1', 'c0000000-0000-4000-8000-0000000000f1',
   'b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
insert into class_member (class_id, user_id) values
  ('c0000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000011');
insert into enrollment (group_id, user_id) values
  ('20000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000011');

-- The year -----------------------------------------------------------------------------------------
select matches(current_school_year(), '^\d{4}/\d{2}$', 'the current school year is like 2026/27');
select is(
  current_school_year(),
  (select y || '/' || lpad(((y + 1) % 100)::text, 2, '0')
   from (select extract(year from now() at time zone 'Europe/Madrid')::integer
     - (extract(month from now() at time zone 'Europe/Madrid') < 9)::integer as y) start),
  'and it starts on 1 September, in the time of the school'
);

-- Marta, in her class of a past year ------------------------------------------------------------------
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

select results_eq(
  $$ select is_open, reopened from managed_classes()
     where id in ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000f1')
     order by school_year desc $$,
  $$ values (true, false), (false, false) $$,
  'a class of this year is open; one of a past year, closed'
);
select throws_ok(
  $$ select enroll_class_members('c0000000-0000-4000-8000-0000000000f1',
       array['10000000-0000-4000-8000-000000000012']::uuid[]) $$,
  '42501', null,
  'nobody is enrolled in a closed class'
);
select throws_ok(
  $$ select remove_class_member('c0000000-0000-4000-8000-0000000000f1',
       '10000000-0000-4000-8000-000000000011') $$,
  '42501', null,
  'nor taken out of it'
);
select throws_ok(
  $$ select * from enroll_students('20000000-0000-4000-8000-0000000000f1',
       array['10000000-0000-4000-8000-000000000012']::uuid[]) $$,
  '42501', null,
  'nor enrolled in one of its groups'
);
select is(
  pg_temp.changed_rows($$ delete from enrollment
    where group_id = '20000000-0000-4000-8000-0000000000f1' $$),
  0::bigint,
  'nor unenrolled from it'
);
select throws_ok(
  $$ select add_class_group('c0000000-0000-4000-8000-0000000000f1',
       'b0000000-0000-4000-8000-000000000003', null, '10000000-0000-4000-8000-000000000002') $$,
  '42501', null,
  'a closed class takes no subject'
);
select is(
  pg_temp.changed_rows($$ update class_group set label = 'Desdoble 1'
    where id = '20000000-0000-4000-8000-0000000000f1' $$),
  0::bigint,
  'its groups do not change'
);
select is(
  pg_temp.changed_rows($$ delete from class_group
    where id = '20000000-0000-4000-8000-0000000000f1' $$),
  0::bigint,
  'nor are deleted'
);
select is(
  pg_temp.changed_rows($$ update school_class set name = '2.º DAW X'
    where id = 'c0000000-0000-4000-8000-0000000000f1' $$),
  0::bigint,
  'a closed class is not renamed'
);
select is(
  pg_temp.changed_rows($$ delete from school_class
    where id = 'c0000000-0000-4000-8000-0000000000f2' $$),
  0::bigint,
  'nor deleted, even empty'
);
select throws_ok(
  $$ update school_class set school_year = '2020/21'
     where id = 'c0000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'nor is an open class moved to a past year'
);
select throws_ok(
  $$ select create_class('3.º DAW Z', '2020/21', '{}', '10000000-0000-4000-8000-000000000002') $$,
  '42501', null,
  'nobody creates a class of a past year'
);
select throws_ok(
  $$ select create_class('2.º daw z', '2020/21', array['b0000000-0000-4000-8000-000000000003']::uuid[],
       '10000000-0000-4000-8000-000000000002') $$,
  '42501', null,
  'nor joins a closed one'
);
-- Into next year: Lucía is in a class of this one already (one class a year, 5.2g)
select isnt(
  duplicate_class('c0000000-0000-4000-8000-0000000000f1', '2.º DAW Z',
    (select y + 1 || '/' || lpad(((y + 2) % 100)::text, 2, '0')
     from (select left(current_school_year(), 4)::integer as y) start),
    array['20000000-0000-4000-8000-0000000000f1']::uuid[], false, false, true),
  null,
  'a closed class is duplicated into a later year, with its students'
);
select throws_ok(
  $$ select duplicate_class('c0000000-0000-4000-8000-000000000001', '2.º DAW Y', '2020/21',
       array['20000000-0000-4000-8000-000000000001']::uuid[], false, false, false) $$,
  '42501', null,
  'but nothing is duplicated into a closed one'
);
select throws_ok(
  $$ select reopen_class('c0000000-0000-4000-8000-0000000000f1', true) $$,
  '42501', null,
  'a teacher does not reopen a class'
);
select throws_ok(
  $$ update school_class set reopened = true where id = 'c0000000-0000-4000-8000-0000000000f1' $$,
  '42501', null,
  'not even writing the row'
);

-- The administration ---------------------------------------------------------------------------------
select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');

select throws_ok(
  $$ select enroll_class_members('c0000000-0000-4000-8000-0000000000f1',
       array['10000000-0000-4000-8000-000000000012']::uuid[]) $$,
  '42501', null,
  'the administration does not enroll in a closed class either'
);
select throws_ok(
  $$ select reopen_class('c0000000-0000-4000-8000-0000000000ff', true) $$,
  'P0002', null,
  'nor reopens a class that does not exist'
);
select lives_ok(
  $$ select reopen_class('c0000000-0000-4000-8000-0000000000f1', true) $$,
  'but reopens one of a past year'
);

select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select lives_ok(
  $$ select enroll_class_members('c0000000-0000-4000-8000-0000000000f1',
       array['10000000-0000-4000-8000-000000000012']::uuid[]) $$,
  'and then its teachers change it'
);

select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');
select reopen_class('c0000000-0000-4000-8000-0000000000f1', false);

select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select results_eq(
  $$ select is_open, reopened from managed_classes()
     where id = 'c0000000-0000-4000-8000-0000000000f1' $$,
  $$ values (false, false) $$,
  'until the administration closes it again'
);

select * from finish();
rollback;

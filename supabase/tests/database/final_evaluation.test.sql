-- Step 5.2g · The final evaluation (docs/PLAN.md §2.3, D-084).
-- Seed: 1.º DAW A of this year (class c...001) is Marta's (...002), and Javier (...003) teaches a
-- split in it; Lucía (...011) and the students ...012 to ...015 are in it. The test adds 2.º DAW Z of
-- 2020/21, always a past year, by Marta, with Lucía in it and ...016 only in its group; and 1.º DAW Z
-- of 2099/00, a later year, to choose students for. The administrator is ...001.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

create function pg_temp.sign_out() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

insert into school_class (id, name, school_year, created_by) values
  ('c0000000-0000-4000-8000-0000000000f1', '2.º DAW Z', '2020/21', '10000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-0000000000f2', '1.º DAW Z', '2099/00', '10000000-0000-4000-8000-000000000002');
insert into class_group (id, class_id, subject_id, teacher_id) values
  ('20000000-0000-4000-8000-0000000000f1', 'c0000000-0000-4000-8000-0000000000f1',
   'b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
insert into class_member (class_id, user_id) values
  ('c0000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000011');
insert into enrollment (group_id, user_id) values
  ('20000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000011'),
  ('20000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000016');
-- ...013 has no class at all
delete from class_member where user_id = '10000000-0000-4000-8000-000000000013';

-- Evaluating, in a closed class -------------------------------------------------------------------
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

select is(
  set_class_outcomes('c0000000-0000-4000-8000-0000000000f1',
    array['10000000-0000-4000-8000-000000000011']::uuid[], 'graduates'),
  1,
  'a teacher of a closed class evaluates its students'
);
select is(
  (select outcome::text from class_member
   where class_id = 'c0000000-0000-4000-8000-0000000000f1'
     and user_id = '10000000-0000-4000-8000-000000000011'),
  'graduates',
  'and the outcome is kept'
);
select is(
  set_class_outcomes('c0000000-0000-4000-8000-0000000000f1',
    array['10000000-0000-4000-8000-000000000011']::uuid[], 'graduates'),
  0,
  'the same outcome again changes nothing'
);
select is(
  set_class_outcomes('c0000000-0000-4000-8000-0000000000f1',
    array['10000000-0000-4000-8000-000000000011']::uuid[], null),
  1,
  'and none takes it back'
);
select throws_ok(
  $$ select set_class_outcomes('c0000000-0000-4000-8000-0000000000f1',
       array['10000000-0000-4000-8000-000000000016']::uuid[], 'promotes') $$,
  'P0002', null,
  'who is only in one of its groups is evaluated in their own class'
);
select throws_ok(
  $$ select set_class_outcomes('c0000000-0000-4000-8000-0000000000f1', '{}'::uuid[], 'promotes') $$,
  '22023', null,
  'nobody is not a list'
);
select throws_ok(
  $$ select set_class_outcomes('c0000000-0000-4000-8000-0000000000f1',
       array['10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000011']::uuid[],
       'promotes') $$,
  '22023', null,
  'nor the same student twice'
);

select results_eq(
  $$ select id, is_member, outcome::text from class_roster('c0000000-0000-4000-8000-0000000000f1')
     order by id $$,
  $$ values ('10000000-0000-4000-8000-000000000011'::uuid, true, null::text),
            ('10000000-0000-4000-8000-000000000016'::uuid, false, null::text) $$,
  'the roster says the outcome of each student of the class, none yet'
);

-- In the class of this year: some finish, some leave, one repeats
select is(
  set_class_outcomes('c0000000-0000-4000-8000-000000000001',
    array['10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000015']::uuid[],
    'graduates'),
  2,
  'several students are evaluated at once'
);
select is(
  set_class_outcomes('c0000000-0000-4000-8000-000000000001',
    array['10000000-0000-4000-8000-000000000012']::uuid[], 'repeats'),
  1,
  'one repeats'
);
select is(
  set_class_outcomes('c0000000-0000-4000-8000-000000000001',
    array['10000000-0000-4000-8000-000000000014']::uuid[], 'leaves'),
  1,
  'and one leaves the school'
);
select is(
  (select outcome::text from class_roster('c0000000-0000-4000-8000-000000000001')
   where id = '10000000-0000-4000-8000-000000000012'),
  'repeats',
  'the roster of the class says so'
);
select pg_temp.sign_out();
insert into enrollment (group_id, user_id) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000041');
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select results_eq(
  $$ select is_member, other_class_name from class_roster('c0000000-0000-4000-8000-000000000001')
     where id = '10000000-0000-4000-8000-000000000041' $$,
  $$ values (false, '1.º DAM B') $$,
  'and of who takes one subject from another class, which class of the year it is'
);

-- Choosing the students of a later year -----------------------------------------------------------
select results_eq(
  $$ select id, last_class_name, last_school_year, last_outcome::text
     from class_candidates('c0000000-0000-4000-8000-0000000000f2')
     where id in ('10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000013',
       '10000000-0000-4000-8000-000000000016')
     order by id $$,
  $$ values ('10000000-0000-4000-8000-000000000012'::uuid, '1.º DAW A', '2026/27', 'repeats'),
            ('10000000-0000-4000-8000-000000000013'::uuid, null, null, null),
            ('10000000-0000-4000-8000-000000000016'::uuid, '1.º DAW A', '2026/27', null) $$,
  'a student without a class says their last one and its outcome, if they had them'
);
select is_empty(
  $$ select id from class_candidates('c0000000-0000-4000-8000-0000000000f2')
     where id in ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000014',
       '10000000-0000-4000-8000-000000000015') $$,
  'who finished the cycle or left the school there is not chosen again'
);
select results_eq(
  $$ select id, last_class_name, last_school_year, last_outcome::text
     from search_class_students('Lucía', 'c0000000-0000-4000-8000-0000000000f2') $$,
  $$ values ('10000000-0000-4000-8000-000000000011'::uuid, '1.º DAW A', '2026/27', 'graduates') $$,
  'but is still found by searching for them, with the class where they finished'
);
select results_eq(
  $$ select entry, last_class_name, last_outcome::text
     from match_students('c0000000-0000-4000-8000-0000000000f2', array['lucia.martin@tutoria.test']) $$,
  $$ values ('lucia.martin@tutoria.test', '1.º DAW A', 'graduates') $$,
  'and a pasted list says it too, for the screen to leave them out'
);
select results_eq(
  $$ select name, last_class_name, last_school_year, last_outcome::text
     from search_students('Cabrera Méndez', '20000000-0000-4000-8000-000000000001') $$,
  $$ values ('Rubén Cabrera Méndez', '1.º DAM B', '2026/27', null::text) $$,
  'the search of a group says where each student is this year'
);

-- One class a year ---------------------------------------------------------------------------------
select pg_temp.sign_out();
insert into school_class (id, name, school_year, created_by) values
  ('c0000000-0000-4000-8000-0000000000f3', '1.º DAW Z', '2026/27', '10000000-0000-4000-8000-000000000002');
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

select throws_ok(
  $$ select enroll_class_members('c0000000-0000-4000-8000-0000000000f3',
       array['10000000-0000-4000-8000-000000000012']::uuid[]) $$,
  '23505', null,
  'a student of a class of this year is not enrolled in another one of the same year'
);
select lives_ok(
  $$ select enroll_class_members('c0000000-0000-4000-8000-0000000000f2',
       array['10000000-0000-4000-8000-000000000012']::uuid[]) $$,
  'but is in one of another year'
);
select lives_ok(
  $$ select enroll_class_members('c0000000-0000-4000-8000-0000000000f3',
       array['10000000-0000-4000-8000-000000000013']::uuid[]) $$,
  'and who has no class this year is, as always'
);

-- Who may evaluate --------------------------------------------------------------------------------
select pg_temp.sign_in('10000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ select set_class_outcomes('c0000000-0000-4000-8000-0000000000f1',
       array['10000000-0000-4000-8000-000000000011']::uuid[], 'promotes') $$,
  'P0002', null,
  'a teacher who does not look after the class does not evaluate it'
);
select is(
  set_class_outcomes('c0000000-0000-4000-8000-000000000001',
    array['10000000-0000-4000-8000-000000000016']::uuid[], 'promotes'),
  1,
  'any teacher of the class does, as Javier with his split'
);
select throws_ok(
  $$ select * from finished_students() $$,
  '42501', null,
  'only the administration lists the accounts left to disable'
);

select pg_temp.sign_in('10000000-0000-4000-8000-000000000011');
select throws_ok(
  $$ select set_class_outcomes('c0000000-0000-4000-8000-000000000001',
       array['10000000-0000-4000-8000-000000000011']::uuid[], 'promotes') $$,
  'P0002', null,
  'nor a student'
);

-- The accounts left to disable --------------------------------------------------------------------
select pg_temp.sign_out();
update app_user set status = 'disabled' where id = '10000000-0000-4000-8000-000000000015';
select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');

select results_eq(
  $$ select id, outcome::text, class_name, school_year from finished_students()
     where id between '10000000-0000-4000-8000-000000000011' and '10000000-0000-4000-8000-000000000016'
     order by id $$,
  $$ values ('10000000-0000-4000-8000-000000000011'::uuid, 'graduates', '1.º DAW A', '2026/27'),
            ('10000000-0000-4000-8000-000000000014'::uuid, 'leaves', '1.º DAW A', '2026/27') $$,
  'the active students whose last class says they finished or left, with that class'
);
select is(
  set_class_outcomes('c0000000-0000-4000-8000-0000000000f1',
    array['10000000-0000-4000-8000-000000000011']::uuid[], 'promotes'),
  1,
  'the administration evaluates any class'
);
select pg_temp.sign_out();
insert into class_member (class_id, user_id) values
  ('c0000000-0000-4000-8000-0000000000f2', '10000000-0000-4000-8000-000000000011');
select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');
select is_empty(
  $$ select id from finished_students() where id = '10000000-0000-4000-8000-000000000011' $$,
  'and who came back, in a class of a later year, is not left to disable'
);

select * from finish();
rollback;

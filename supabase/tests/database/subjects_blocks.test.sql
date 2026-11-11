-- Step 2.5c · Subjects, blocks and what students do not see (docs/PLAN.md §2.3, D-046).
-- Seed: Lucía (...011) is in both groups of 1.º DAW A, taught by Marta (...002): basic programming
-- (...001), with eight blocks, and web client (...003), with four. Block 6 («Repaso
-- final») is hidden, and so is assignment ...502, exercise 2 in the resit (block 5). The
-- administrator is ...001.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

-- Lucía: `is_hidden` is what the teacher marks; the policies make it hold on the server
select pg_temp.sign_in('10000000-0000-4000-8000-000000000011');

select is((select count(*) from subject), 3::bigint, 'every signed-in user reads the subjects');
select throws_ok(
  $$ insert into subject (name) values ('Matemáticas') $$,
  '42501', null,
  'only administrators manage the subjects'
);
select is(
  (select count(*) from class_block),
  11::bigint,
  'a student reads the visible blocks of each of their groups'
);
select is(
  (select count(*) from class_block where id = 'a0000000-0000-4000-8000-000000000006'),
  0::bigint,
  'a student does not see a hidden block'
);
select is(
  (select count(*) from exercise_assignment where block_id = 'a0000000-0000-4000-8000-000000000006'),
  0::bigint,
  'nor the exercises of a hidden block'
);
select is(
  (select count(*) from exercise_assignment where id = '60000000-0000-4000-8000-000000000502'),
  0::bigint,
  'a student does not see a hidden assignment of a visible block'
);
select is((select count(*) from exercise_subject), 0::bigint, 'students do not read the bank');

-- Marta
reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

select is(
  (select count(*) from exercise_assignment
   where id in ('60000000-0000-4000-8000-000000000502', '60000000-0000-4000-8000-000000000605')),
  2::bigint,
  'a teacher sees what is hidden from their students'
);
select is((select count(*) from exercise_subject), 45::bigint, 'teachers read the subjects of the bank');
select lives_ok(
  $$ update class_block set is_hidden = false where id = 'a0000000-0000-4000-8000-000000000006' $$,
  'a teacher shows a hidden block'
);

reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000011');
select is(
  (select count(*) from exercise_assignment where block_id = 'a0000000-0000-4000-8000-000000000006'),
  2::bigint,
  'the students see the block and its exercises once shown'
);

-- Administrator
reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');

select lives_ok(
  $$ insert into subject (name, translations) values ('Matemáticas', '{"en": {"name": "Maths"}}') $$,
  'an administrator creates subjects, with their translations'
);
select throws_ok(
  $$ insert into subject (name, translations) values ('Física', '{"es": {"name": "Física"}}') $$,
  '23514', null,
  'a translation cannot repeat the source language'
);
select throws_ok(
  $$ insert into subject (name, translations) values ('Física', '{"en": {"name": " "}}') $$,
  '23514', null,
  'a translation cannot be blank'
);
select throws_ok(
  $$ insert into class_block (group_id, position, title, translations)
     values ('20000000-0000-4000-8000-000000000001', 9, 'Examen', '{"en": {"title": "Exam", "x": 1}}') $$,
  '23514', null,
  'the translation of a block only has its title'
);
select throws_ok(
  $$ insert into class_block (group_id, position) values ('20000000-0000-4000-8000-000000000001', 9) $$,
  '23502', null,
  'every block has a title'
);
select throws_ok(
  $$ insert into exercise_assignment (group_id, block_id, exercise_id) values
     ('20000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007',
      '40000000-0000-4000-8000-000000000005') $$,
  '23503', null,
  'an assignment is in a block of its own group'
);
select throws_ok(
  $$ insert into class_group (name, school_year, teacher_id)
     values ('2.º DAW A', '2026/27', '10000000-0000-4000-8000-000000000002') $$,
  '23502', null,
  'every group belongs to a subject'
);

select * from finish();
rollback;

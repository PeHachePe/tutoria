-- Step 5.2c · Setting up a new school year (docs/PLAN.md §2.3, D-079): the dates of another year and
-- copying the blocks of a group into another. Duplicating a class moved to `shared_classes` (5.2d).
-- Seed: Marta (...002) teaches groups ...001 (subject ...001, 9 blocks) and ...003 (subject ...003)
-- of 1.º DAW A 2026/27 (class c...001); Javier (...003) teaches 1.º DAM B (...002).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

select is(school_year_shift_days('2026/27', '2027/28'), 364, 'a year later is 52 weeks later');
select is(school_year_shift_days('2026/27', '2026/27'), 0, 'and the same year, no change');
select is(school_year_shift_days('2026/27', '2024/25'), -728, 'also backwards');

select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

-- A group of Marta in another class of the next year, without blocks yet
create temp table target as
select add_class_group(create_class('1.º DAW A', '2027/28', '{}', null),
  'b0000000-0000-4000-8000-000000000001', null, '10000000-0000-4000-8000-000000000002') as id;

select is(
  copy_blocks('20000000-0000-4000-8000-000000000001', (select id from target), true, 'Europe/Madrid'),
  9,
  'a teacher copies the blocks of a group into another'
);
select is(
  (select to_char(min(a.due_at) at time zone 'Europe/Madrid', 'Dy DD/MM/YYYY HH24:MI')
   from exercise_assignment a join class_block b on b.id = a.block_id
   where a.group_id = (select id from target) and b.title = 'Tema 4: Cadenas y formato'),
  'Fri 05/11/2027 23:59',
  'with the dates moved to the year of its class (Fri 06/11/2026 23:59)'
);
select is(
  copy_blocks('20000000-0000-4000-8000-000000000003', (select id from target), false, 'Europe/Madrid'),
  (select count(*)::integer from class_block where group_id = '20000000-0000-4000-8000-000000000003'),
  'and of another'
);
select is(
  (select array_agg(position order by position) from class_block
   where group_id = (select id from target) and position > 9),
  (select array_agg(9 + n::integer) from generate_series(1,
    (select count(*)::integer from class_block where group_id = '20000000-0000-4000-8000-000000000003')) n),
  'after those it already had'
);
select throws_ok(
  $$ select copy_blocks('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', true) $$,
  'P0002', null,
  'not from a group of another teacher'
);
select throws_ok(
  $$ select copy_blocks('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', true) $$,
  '22023', null,
  'nor into the same group'
);

select * from finish();
rollback;

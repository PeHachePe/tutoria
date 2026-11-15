-- Step 4.3d · Opening date of a block, archived exercises and moving an exercise (D-060).
-- Seed: Marta (...002) teaches 1.º DAW A (group ...001) and wrote exercises 1 to 30. «Tema 1»
-- (...001) has attempts; nobody has started «Tema 5» (...013). Javier (...003) teaches 1.º DAM B
-- (group ...002). Lucía (...011) is a student of 1.º DAW A.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

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

-- Opening date: Marta schedules «Tema 5» for tomorrow
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

select is(
  pg_temp.changed_rows($$ update class_block set opens_at = now() + interval '1 day'
     where id = 'a0000000-0000-4000-8000-000000000013' $$),
  1::bigint,
  'a teacher gives a block of their group an opening date'
);
select is(
  (select opens_at from create_block('20000000-0000-4000-8000-000000000001', 'Examen', 'es', '{}',
     false, '2030-01-07T08:00:00Z')),
  '2030-01-07T08:00:00Z'::timestamptz,
  'a new block may have one'
);
select is(
  (select count(*) from class_block where id = 'a0000000-0000-4000-8000-000000000013'),
  1::bigint,
  'the teacher sees the block before it opens'
);

-- Lucía
reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000011');

select is(
  (select count(*) from class_block where id = 'a0000000-0000-4000-8000-000000000013'),
  0::bigint,
  'a student does not see a block before it opens'
);
select is(
  (select count(*) from exercise_assignment where block_id = 'a0000000-0000-4000-8000-000000000013'),
  0::bigint,
  'nor its exercises'
);
select is(
  can_open_assignment('60000000-0000-4000-8000-000000000011'),
  false,
  'nor opens attempts at them'
);

reset role;
update class_block set opens_at = now() - interval '1 minute'
where id = 'a0000000-0000-4000-8000-000000000013';
select pg_temp.sign_in('10000000-0000-4000-8000-000000000011');

select is(
  (select count(*) from exercise_assignment where block_id = 'a0000000-0000-4000-8000-000000000013'),
  4::bigint,
  'once it opens, the student sees its exercises'
);

-- Archiving
reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000003');

select is(
  pg_temp.changed_rows($$ update exercise set archived_at = now()
     where id = '40000000-0000-4000-8000-000000000001' $$),
  0::bigint,
  'a teacher does not archive the exercises of another'
);

reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

select is(
  pg_temp.changed_rows($$ update exercise set archived_at = now()
     where id = '40000000-0000-4000-8000-000000000001' $$),
  1::bigint,
  'its author archives an exercise with attempts'
);
select is(
  (select count(*) from exercise_assignment where exercise_id = '40000000-0000-4000-8000-000000000001'),
  1::bigint,
  'and its assignment in the group stays'
);

-- Moving «Tema 1»'s first exercise, which students started, to the second place of «Tema 5»
select is(
  (select block_id from move_assignment('60000000-0000-4000-8000-000000000001',
     'a0000000-0000-4000-8000-000000000013', 2)),
  'a0000000-0000-4000-8000-000000000013'::uuid,
  'a teacher moves an exercise somebody started to another block of the group'
);
select is(
  (select array_agg(exercise_id order by position)
   from exercise_assignment where block_id = 'a0000000-0000-4000-8000-000000000013'),
  array['40000000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000001',
        '40000000-0000-4000-8000-000000000012', '40000000-0000-4000-8000-000000000014',
        '40000000-0000-4000-8000-000000000017']::uuid[],
  'in the place given'
);
select is(
  (select array_agg(position order by position)
   from exercise_assignment where block_id = 'a0000000-0000-4000-8000-000000000001'),
  array[1],
  'closing the gap it leaves'
);
select is(
  (select count(*) from attempt where assignment_id = '60000000-0000-4000-8000-000000000001') > 0,
  true,
  'with its attempts'
);
select throws_ok(
  $$ select move_assignment('60000000-0000-4000-8000-000000000003',
       'a0000000-0000-4000-8000-000000000005', 1) $$,
  '23505', null,
  'an exercise is only once in a block'
);
select throws_ok(
  $$ select move_assignment('60000000-0000-4000-8000-000000000003',
       'a0000000-0000-4000-8000-000000000013', 7) $$,
  '22023', null,
  'nor goes beyond its last place'
);
select throws_ok(
  $$ select move_assignment('60000000-0000-4000-8000-000000000003',
       'a0000000-0000-4000-8000-000000000007', 1) $$,
  'P0002', null,
  'nor to a block of another group'
);

-- Javier, with an exercise of a group of Marta
reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000003');

select throws_ok(
  $$ select move_assignment('60000000-0000-4000-8000-000000000003',
       'a0000000-0000-4000-8000-000000000013', 1) $$,
  'P0002', null,
  'a teacher does not move the exercises of the groups of another'
);

select * from finish();
rollback;

-- Step 2.5b · The translations of an exercise (docs/PLAN.md §2.3, D-045): the shape the check of
-- `exercise.translations` accepts. Exercise 3 of the seed is written in Spanish.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select is(
  (select count(*)::integer from exercise where translations ?& array['en', 'ca']),
  (select count(*)::integer from exercise),
  'every exercise of the seed is in English and in Catalan'
);

select lives_ok(
  $$ update exercise set translations = '{}' where id = '40000000-0000-4000-8000-000000000003' $$,
  'an exercise can have no translation: the app shows its source texts'
);

select lives_ok(
  $$ update exercise
     set translations = '{"en": {"title": "Sum", "statement": "Write `sum`.", "topics": ["Arrays"]}}'
     where id = '40000000-0000-4000-8000-000000000003' $$,
  'an exercise can be translated into some languages only'
);

select throws_ok(
  $$ update exercise
     set translations = '{"es": {"title": "Suma", "statement": "Escribe `sum`.", "topics": []}}'
     where id = '40000000-0000-4000-8000-000000000003' $$,
  '23514', null,
  'the source language is not repeated among the translations'
);

select lives_ok(
  $$ update exercise
     set source_locale = 'en',
         translations = '{"es": {"title": "Suma", "statement": "Escribe `sum`.", "topics": []}}'
     where id = '40000000-0000-4000-8000-000000000003' $$,
  'an exercise can be written in any language, Spanish being a translation then'
);

select throws_ok(
  $$ update exercise
     set source_locale = 'es',
         translations = '{"fr": {"title": "Somme", "statement": "Écris `sum`.", "topics": []}}'
     where id = '40000000-0000-4000-8000-000000000003' $$,
  '23514', null,
  'only the languages of the interface'
);

select throws_ok(
  $$ update exercise
     set translations = '{"en": {"title": " ", "statement": "Write `sum`.", "topics": []}}'
     where id = '40000000-0000-4000-8000-000000000003' $$,
  '23514', null,
  'a translation needs a title'
);

select throws_ok(
  $$ update exercise
     set translations = '{"en": {"title": "Sum", "statement": "Write `sum`.", "topics": [1]}}'
     where id = '40000000-0000-4000-8000-000000000003' $$,
  '23514', null,
  'the topics are texts'
);

select * from finish();
rollback;

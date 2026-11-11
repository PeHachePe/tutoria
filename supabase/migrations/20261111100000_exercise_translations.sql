-- Step 2.5b · Exercises in the three languages of the interface (docs/PLAN.md §2.3, D-045).
--
-- `title`, `statement` and `topics` are written in `source_locale`, which the teacher chooses, and
-- `translations` keeps them in the other languages: `{"en": {"title", "statement", "topics"}, …}`.
-- Any translation can be missing: the app shows the source texts then, never a gap. The code of the
-- exercise (its function and what it returns) is the same in every language.

create type public.app_locale as enum ('es', 'en', 'ca');

-- Whether `translations` has the right shape: an object whose keys are languages other than the
-- source one, each with a non-blank title and statement and a list of topics.
create function public.is_valid_exercise_translations(
  translations jsonb,
  source_locale public.app_locale
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(translations) <> 'object' then false
    when translations ? source_locale::text then false
    else coalesce((
      select bool_and(
        locale = any (enum_range(null::public.app_locale)::text[])
        and jsonb_typeof(translation) = 'object'
        and translation ?& array['title', 'statement', 'topics']
        and (select count(*) from jsonb_object_keys(translation)) = 3
        and jsonb_typeof(translation -> 'title') = 'string'
        and btrim(translation ->> 'title') <> ''
        and jsonb_typeof(translation -> 'statement') = 'string'
        and btrim(translation ->> 'statement') <> ''
        and jsonb_typeof(translation -> 'topics') = 'array'
        and not jsonb_path_exists(translation -> 'topics', '$[*] ? (@.type() != "string")')
      )
      from jsonb_each(translations) as each_translation (locale, translation)
    ), true)
  end
$$;

alter table public.exercise
add column source_locale public.app_locale not null default 'es',
add column translations jsonb not null default '{}'
constraint exercise_translations_shape
check (public.is_valid_exercise_translations(translations, source_locale));

-- The teacher edits every language of an exercise (step 4.3).
grant update (source_locale, translations) on public.exercise to authenticated;

-- Step 4.3e · «Probar como alumno» (docs/PLAN.md §2.3, D-061): the teacher tries an exercise as it is
-- in the form, saved or not, with the tutor in preview mode. Nothing of it is kept (no attempt, no
-- tutor interaction, no process event), so its limit per minute counts a request of the staff of its
-- own kind, like checking a solution or translating (D-059).

alter type public.staff_request_kind add value 'tutor';

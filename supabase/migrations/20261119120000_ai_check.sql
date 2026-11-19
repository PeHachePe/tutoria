-- Step 5.3a · «Probar la conexión» (docs/PLAN.md §2.3, RF-19, CU-07): the administration asks each
-- model of a setting of the AI provider, saved or not, for a minimal answer before saving it. Nothing
-- of it is kept, so its limits count a request of the staff of its own kind, like translating.

alter type public.staff_request_kind add value 'ai_check';

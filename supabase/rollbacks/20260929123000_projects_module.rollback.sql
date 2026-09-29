begin;

drop function if exists public.create_project_with_plan(jsonb, jsonb, jsonb, jsonb);
drop function if exists public.convert_enquiry_to_project(uuid, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.update_project_with_plan(uuid, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.move_project(uuid, text, integer);
drop function if exists public.set_project_milestone_completed(uuid, boolean);
drop function if exists public.set_project_task_completed(uuid, boolean);
drop function if exists public.set_project_deliverable_status(uuid, text);
drop function if exists public.set_project_archived(uuid, boolean);
drop function if exists public.replace_project_plan(uuid, jsonb, jsonb, jsonb);

drop table if exists public.project_deliverables;
drop table if exists public.project_tasks;
drop table if exists public.project_milestones;

drop trigger if exists guard_project_contact_before_write on public.projects;
drop function if exists public.guard_project_contact();

alter table public.projects
  drop constraint if exists projects_status_check,
  drop constraint if exists projects_project_type_check,
  drop constraint if exists projects_payment_status_check,
  drop constraint if exists projects_delivery_status_check,
  drop constraint if exists projects_dates_check,
  drop constraint if exists projects_budget_min_check,
  drop constraint if exists projects_budget_max_check,
  drop constraint if exists projects_budget_range_check,
  drop constraint if exists projects_currency_check,
  drop constraint if exists projects_stage_position_check,
  drop column if exists enquiry_id,
  drop column if exists client_contact_id,
  drop column if exists project_type,
  drop column if exists services,
  drop column if exists location,
  drop column if exists start_date,
  drop column if exists end_date,
  drop column if exists people_resources,
  drop column if exists budget_min,
  drop column if exists budget_max,
  drop column if exists currency,
  drop column if exists payment_status,
  drop column if exists delivery_status,
  drop column if exists stage_position;

grant all on public.projects to anon;

commit;

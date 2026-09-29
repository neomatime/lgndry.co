"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { projectInputSchema, type ParsedProjectInput } from "@/features/projects/schemas";
import { DELIVERABLE_STATUSES, PROJECT_STATUSES } from "@/features/projects/types";
import type { ProjectActionState } from "@/features/projects/types";
import { requireOpsUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/db/server";

const UUID = z.uuid();
const FAILED = "We couldn't save this project just now. Please try again.";
const rpcResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), project_id: z.uuid() }),
  z.object({ status: z.literal("not-found") }),
  z.object({ status: z.literal("conflict"), project_id: z.uuid() }),
  z.object({ status: z.literal("invalid"), message: z.string().optional() }),
]);

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

function payload(input: ParsedProjectInput) {
  return {
    project: {
      name: input.name,
      client_id: input.clientId,
      client_contact_id: input.clientContactId,
      project_type: input.projectType,
      services: input.services,
      overview: input.overview,
      location: input.location,
      start_date: input.startDate,
      end_date: input.endDate,
      schedule_notes: input.scheduleNotes,
      people_resources: input.peopleResources,
      budget_min: input.budgetMin,
      budget_max: input.budgetMax,
      currency: input.currency,
      payment_status: input.paymentStatus,
      delivery_status: input.deliveryStatus,
      status: input.status,
    },
    milestones: input.milestones.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      due_date: item.dueDate,
      status: item.status,
    })),
    tasks: input.tasks.map((item) => ({
      id: item.id,
      title: item.title,
      due_date: item.dueDate,
      is_completed: item.isCompleted,
    })),
    deliverables: input.deliverables.map((item) => ({
      id: item.id,
      title: item.title,
      due_date: item.dueDate,
      status: item.status,
    })),
  };
}

function revalidateProject(projectId: string) {
  revalidatePath("/ops/projects");
  revalidatePath(`/ops/projects/${projectId}`);
  revalidatePath(`/ops/projects/${projectId}/edit`);
}

function parseRpc(operation: string, data: unknown, error: { message?: string } | null) {
  if (error) {
    console.error(`projects: ${operation} failed`, error.message ?? "database error");
    return { status: "error", message: FAILED } satisfies ProjectActionState;
  }
  const parsed = rpcResultSchema.safeParse(data);
  if (!parsed.success) {
    console.error(`projects: ${operation} returned an invalid response`);
    return { status: "error", message: FAILED } satisfies ProjectActionState;
  }
  if (parsed.data.status === "not-found") {
    return { status: "not-found", message: "That project is no longer available." } as const;
  }
  if (parsed.data.status === "conflict") {
    return {
      status: "conflict",
      projectId: parsed.data.project_id,
      message: "This enquiry already has a project.",
    } as const;
  }
  if (parsed.data.status === "invalid") {
    return {
      status: "invalid",
      message: parsed.data.message ?? "Check the project details and try again.",
    } as const;
  }
  revalidateProject(parsed.data.project_id);
  return { status: "success", projectId: parsed.data.project_id } as const;
}

function invalid(error: z.ZodError): ProjectActionState {
  return {
    status: "invalid",
    message: "Check the highlighted project details and try again.",
    fieldErrors: fieldErrors(error),
  };
}

export async function createProject(input: unknown): Promise<ProjectActionState> {
  await requireOpsUser();
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createSupabaseServerClient();
  const shaped = payload(parsed.data);
  const { data, error } = await supabase.rpc("create_project_with_plan", {
    p_project: shaped.project,
    p_milestones: shaped.milestones,
    p_tasks: shaped.tasks,
    p_deliverables: shaped.deliverables,
  });
  return parseRpc("create", data, error);
}

export async function convertEnquiryToProject(
  enquiryId: string,
  input: unknown,
): Promise<ProjectActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(enquiryId).success) return { status: "error", message: FAILED };
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createSupabaseServerClient();
  const shaped = payload(parsed.data);
  const { data, error } = await supabase.rpc("convert_enquiry_to_project", {
    p_enquiry_id: enquiryId,
    p_project: shaped.project,
    p_milestones: shaped.milestones,
    p_tasks: shaped.tasks,
    p_deliverables: shaped.deliverables,
  });
  const result = parseRpc("convert", data, error);
  revalidatePath("/ops/enquiries");
  revalidatePath(`/ops/enquiries/${enquiryId}`);
  if (result.status === "success") revalidatePath(`/ops/clients/${parsed.data.clientId}`);
  return result;
}

export async function updateProject(
  projectId: string,
  input: unknown,
): Promise<ProjectActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(projectId).success) return { status: "error", message: FAILED };
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createSupabaseServerClient();
  const shaped = payload(parsed.data);
  const { data, error } = await supabase.rpc("update_project_with_plan", {
    p_project_id: projectId,
    p_project: shaped.project,
    p_milestones: shaped.milestones,
    p_tasks: shaped.tasks,
    p_deliverables: shaped.deliverables,
  });
  const result = parseRpc("update", data, error);
  revalidatePath(`/ops/clients/${parsed.data.clientId}`);
  return result;
}

export async function moveProject(
  projectId: string,
  status: unknown,
  stagePosition: unknown,
): Promise<ProjectActionState> {
  await requireOpsUser();
  const parsed = z
    .object({
      projectId: UUID,
      status: z.enum(PROJECT_STATUSES),
      stagePosition: z.number().int().nonnegative(),
    })
    .safeParse({ projectId, status, stagePosition });
  if (!parsed.success) return { status: "invalid", message: "Choose a valid project stage." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("move_project", {
    p_project_id: parsed.data.projectId,
    p_status: parsed.data.status,
    p_stage_position: parsed.data.stagePosition,
  });
  return parseRpc("move", data, error);
}

async function quickAction(
  operation: string,
  rpc: string,
  args: Record<string, unknown>,
): Promise<ProjectActionState> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(rpc, args);
  return parseRpc(operation, data, error);
}

export async function setProjectMilestoneCompleted(
  milestoneId: string,
  completed: boolean,
): Promise<ProjectActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(milestoneId).success) return { status: "error", message: FAILED };
  return quickAction("milestone", "set_project_milestone_completed", {
    p_milestone_id: milestoneId,
    p_completed: completed,
  });
}

export async function setProjectTaskCompleted(
  taskId: string,
  completed: boolean,
): Promise<ProjectActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(taskId).success) return { status: "error", message: FAILED };
  return quickAction("task", "set_project_task_completed", {
    p_task_id: taskId,
    p_completed: completed,
  });
}

export async function setProjectDeliverableStatus(
  deliverableId: string,
  status: unknown,
): Promise<ProjectActionState> {
  await requireOpsUser();
  const parsed = z.enum(DELIVERABLE_STATUSES).safeParse(status);
  if (!UUID.safeParse(deliverableId).success || !parsed.success) {
    return { status: "invalid", message: "Choose a valid deliverable status." };
  }
  return quickAction("deliverable", "set_project_deliverable_status", {
    p_deliverable_id: deliverableId,
    p_status: parsed.data,
  });
}

export async function setProjectArchived(
  projectId: string,
  archived: boolean,
): Promise<ProjectActionState> {
  await requireOpsUser();
  if (!UUID.safeParse(projectId).success) return { status: "error", message: FAILED };
  return quickAction(archived ? "archive" : "restore", "set_project_archived", {
    p_project_id: projectId,
    p_archived: archived,
  });
}

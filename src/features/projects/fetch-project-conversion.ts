import "server-only";

import { cache } from "react";
import {
  buildConversionDefaults,
  type EnquiryConversionSource,
} from "@/features/projects/conversion-view-model";
import type { ProjectClientOption, ProjectInput } from "@/features/projects/types";
import { createSupabaseServerClient } from "@/lib/db/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EnquiryRecord = {
  id: string;
  client_id: string | null;
  full_name: string;
  project_type: string;
  location: string;
  timeline: string;
  description: string;
  budget: string | null;
  status: string;
  archived: boolean;
};

type ContactRecord = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_primary: boolean;
};

export type ProjectConversionResult =
  | {
      status: "ok";
      enquiryId: string;
      client: ProjectClientOption;
      values: ProjectInput;
      sourceTimeline: string;
      sourceBudget: string;
    }
  | { status: "not-found" }
  | { status: "conflict"; projectId: string }
  | { status: "invalid"; message: string }
  | { status: "error" };

export const fetchProjectConversion = cache(
  async (enquiryId: string): Promise<ProjectConversionResult> => {
    if (!UUID_RE.test(enquiryId)) return { status: "not-found" };

    try {
      const supabase = await createSupabaseServerClient();
      const [enquiryResult, projectResult] = await Promise.all([
        supabase
          .from("enquiries")
          .select(
            "id, client_id, full_name, project_type, location, timeline, description, budget, status, archived",
          )
          .eq("id", enquiryId)
          .maybeSingle(),
        supabase.from("projects").select("id").eq("enquiry_id", enquiryId).maybeSingle(),
      ]);
      if (enquiryResult.error) throw enquiryResult.error;
      if (projectResult.error) throw projectResult.error;
      if (projectResult.data) {
        return { status: "conflict", projectId: projectResult.data.id as string };
      }
      if (!enquiryResult.data || enquiryResult.data.archived) return { status: "not-found" };

      const enquiry = enquiryResult.data as EnquiryRecord;
      if (enquiry.status === "Completed" || enquiry.status === "Closed") {
        return { status: "invalid", message: "This enquiry can no longer become a project." };
      }
      if (!enquiry.client_id) {
        return { status: "invalid", message: "This enquiry is not linked to a client." };
      }

      const [clientResult, contactsResult] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name")
          .eq("id", enquiry.client_id)
          .eq("archived", false)
          .maybeSingle(),
        supabase
          .from("client_contacts")
          .select("id, full_name, email, phone, is_primary")
          .eq("client_id", enquiry.client_id)
          .eq("archived", false)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true }),
      ]);
      if (clientResult.error) throw clientResult.error;
      if (contactsResult.error) throw contactsResult.error;
      if (!clientResult.data) {
        return { status: "invalid", message: "The enquiry client is unavailable." };
      }

      const client: ProjectClientOption = {
        id: clientResult.data.id as string,
        name: (clientResult.data.name as string | null) ?? "Unnamed client",
        contacts: ((contactsResult.data ?? []) as ContactRecord[]).map((contact) => ({
          id: contact.id,
          fullName: contact.full_name,
          email: contact.email,
          phone: contact.phone ?? "",
          isPrimary: contact.is_primary,
        })),
      };
      const source: EnquiryConversionSource = {
        id: enquiry.id,
        clientId: enquiry.client_id,
        fullName: enquiry.full_name,
        projectType: enquiry.project_type,
        location: enquiry.location,
        timeline: enquiry.timeline,
        description: enquiry.description,
        budget: enquiry.budget ?? "",
      };
      const defaults = buildConversionDefaults(source, client);
      return {
        status: "ok",
        enquiryId,
        client,
        values: defaults.values,
        sourceTimeline: defaults.sourceTimeline,
        sourceBudget: defaults.sourceBudget,
      };
    } catch (error) {
      console.error("Could not load project conversion", enquiryId, error);
      return { status: "error" };
    }
  },
);

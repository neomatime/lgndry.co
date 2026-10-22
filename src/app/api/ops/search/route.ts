import { NextResponse } from "next/server";
import { fetchClients } from "@/features/clients/fetch-clients";
import { fetchEnquiries } from "@/features/enquiries/fetch-enquiries";
import { fetchFollowUps } from "@/features/follow-ups/fetch-follow-ups";
import { johannesburgDate } from "@/features/follow-ups/list-view-model";
import { fetchInvoices } from "@/features/invoices/fetch-invoices";
import { buildOpsSearchResults } from "@/features/ops-search/search-records";
import { fetchProjects } from "@/features/projects/fetch-projects";
import { resolveOpsAccess } from "@/lib/auth/server";

export async function GET(request: Request) {
  const access = await resolveOpsAccess();
  if (access.status === "anonymous") {
    return NextResponse.json({ message: "Authentication required" }, { status: 401 });
  }
  if (access.status === "forbidden") {
    return NextResponse.json({ message: "OPS access required" }, { status: 403 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });

  const [clients, enquiries, projects, invoices, followUps] = await Promise.all([
    fetchClients(),
    fetchEnquiries(),
    fetchProjects(),
    fetchInvoices(johannesburgDate(new Date())),
    fetchFollowUps(),
  ]);

  if (!clients || !enquiries || !projects || !invoices || !followUps) {
    return NextResponse.json({ message: "Search is temporarily unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    results: buildOpsSearchResults(query, { clients, enquiries, projects, invoices, followUps }),
  });
}

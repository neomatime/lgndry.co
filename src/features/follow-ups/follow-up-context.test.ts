import { describe, expect, it } from "vitest";
import { CONTEXT_NOTICE, resolveFollowUpContext } from "@/features/follow-ups/follow-up-context";
import type { FollowUpClientOption } from "@/features/follow-ups/types";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONTACT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ENQUIRY = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PROJECT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OTHER_ENQUIRY = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const clients: FollowUpClientOption[] = [
  {
    id: A,
    name: "Blackridge",
    contacts: [{ id: CONTACT, fullName: "Thandi", email: "t@example.com", phone: "", role: "" }],
    enquiries: [{ id: ENQUIRY, label: "Film" }],
    projects: [{ id: PROJECT, label: "Autumn" }],
  },
  {
    id: B,
    name: "Lumen",
    contacts: [],
    enquiries: [{ id: OTHER_ENQUIRY, label: "X" }],
    projects: [],
  },
];

describe("resolveFollowUpContext", () => {
  it("returns empty defaults and no notice when nothing was supplied", () => {
    expect(resolveFollowUpContext({}, clients)).toEqual({
      clientId: "",
      contactId: "",
      enquiryId: "",
      projectId: "",
    });
    expect(resolveFollowUpContext({ clientId: "" }, clients).notice).toBeUndefined();
  });

  it("accepts consistent records that exist for the client", () => {
    expect(
      resolveFollowUpContext({ clientId: A, contactId: CONTACT, enquiryId: ENQUIRY }, clients),
    ).toEqual({ clientId: A, contactId: CONTACT, enquiryId: ENQUIRY, projectId: "" });
    expect(resolveFollowUpContext({ clientId: A, projectId: PROJECT }, clients).projectId).toBe(
      PROJECT,
    );
  });

  it.each([
    ["related record without a client", { enquiryId: ENQUIRY }],
    ["malformed id", { clientId: "not-a-uuid" }],
    ["unknown client", { clientId: "99999999-9999-4999-8999-999999999999" }],
    ["enquiry from another client", { clientId: A, enquiryId: OTHER_ENQUIRY }],
    ["contact from another client", { clientId: B, contactId: CONTACT }],
    ["project from another client", { clientId: B, projectId: PROJECT }],
    ["unknown enquiry", { clientId: A, enquiryId: "99999999-9999-4999-8999-999999999999" }],
    ["enquiry and project together", { clientId: A, enquiryId: ENQUIRY, projectId: PROJECT }],
    ["repeated parameter", { clientId: [A, B] }],
  ])("pre-fills nothing and explains calmly for %s", (_name, params) => {
    expect(resolveFollowUpContext(params, clients)).toEqual({
      clientId: "",
      contactId: "",
      enquiryId: "",
      projectId: "",
      notice: CONTEXT_NOTICE,
    });
  });
});

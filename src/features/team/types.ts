export type TeamMember = {
  id: string;
  email: string;
  isYou: boolean;
};

export type TeamFetchResult = { status: "ok"; members: TeamMember[] } | { status: "error" };

export type TeamActionResult =
  | { status: "success"; message: string }
  | { status: "invalid"; message: string; fieldErrors: Record<string, string[]> }
  | { status: "error"; message: string };

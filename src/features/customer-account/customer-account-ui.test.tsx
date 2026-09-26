import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountApp } from "@/features/customer-account/components/account-app";
import { AuthCallback } from "@/features/customer-account/components/auth-callback";
import { AuthPage } from "@/features/customer-account/components/auth-page";
import type { AccountOrder } from "@/features/customer-account/orders";

let query = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query) }));

const replaceLocation = vi.fn();
vi.mock("@/features/customer-account/navigate", () => ({
  replaceLocation: (url: string) => replaceLocation(url),
}));

const auth = {
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  resend: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  setSession: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
};
const upsert = vi.fn();
vi.mock("@/lib/db/client", () => ({
  createSupabaseBrowserClient: () => ({ auth, from: () => ({ upsert }) }),
}));

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  query = "";
  vi.clearAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  auth.signOut.mockResolvedValue({});
  window.location.hash = "";
});

describe("AuthPage", () => {
  it("shows log in by default and the other views by ?mode=", () => {
    const { unmount } = render(<AuthPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Log in." })).toBeInTheDocument();
    unmount();

    for (const [mode, heading] of [
      ["signup", "Create account."],
      ["forgot", "Reset password."],
      ["reset", "Secure your account."],
      ["verify", "Verify your email."],
      ["nonsense", "Log in."],
    ] as const) {
      query = `mode=${mode}`;
      const view = render(<AuthPage />);
      expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
      view.unmount();
    }
  });

  it("logs a confirmed customer in and sends them to the account", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { email_confirmed_at: "2026-01-01" } },
      error: null,
    });
    render(<AuthPage />);
    type("Email address", "  t@example.com ");
    type("Password", "hunter22");
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => expect(replaceLocation).toHaveBeenCalledWith("/account#orders"));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "t@example.com",
      password: "hunter22",
    });
  });

  it("returns to the page they came from, but only if it is on this site", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { email_confirmed_at: "x" } },
      error: null,
    });
    query = "next=%2Fcheckout";
    const { unmount } = render(<AuthPage />);
    type("Email address", "t@example.com");
    type("Password", "pw");
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));
    await waitFor(() => expect(replaceLocation).toHaveBeenCalledWith("/checkout"));
    unmount();

    replaceLocation.mockClear();
    query = "next=" + encodeURIComponent("//evil.example");
    render(<AuthPage />);
    type("Email address", "t@example.com");
    type("Password", "pw");
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));
    await waitFor(() => expect(replaceLocation).toHaveBeenCalledWith("/account#orders"));
  });

  it("refuses an unverified email and signs them out again", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { email_confirmed_at: null } },
      error: null,
    });
    render(<AuthPage />);
    type("Email address", "t@example.com");
    type("Password", "pw");
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(
      await screen.findByText("Please verify your email before logging in."),
    ).toBeInTheDocument();
    expect(auth.signOut).toHaveBeenCalled();
    expect(replaceLocation).not.toHaveBeenCalled();
  });

  it("shows the reason when sign-in fails, and lets them try again", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: "Invalid login credentials" },
    });
    render(<AuthPage />);
    type("Email address", "t@example.com");
    type("Password", "wrong");
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByText("Invalid login credentials")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log In" })).toBeEnabled();
  });

  it("sends a signed-in visitor straight on from the log in page", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: {} } } });
    render(<AuthPage />);
    await waitFor(() => expect(replaceLocation).toHaveBeenCalledWith("/account#orders"));
  });

  it("creates an account with the name as metadata and asks them to verify", async () => {
    query = "mode=signup";
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthPage />);
    type("Full name", " Thandi Mokoena ");
    type("Email address", "t@example.com");
    type("Password", "longenough1");
    type("Confirm password", "longenough1");
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() =>
      expect(replaceLocation).toHaveBeenCalledWith("/auth?mode=verify&email=t%40example.com"),
    );
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "t@example.com",
        password: "longenough1",
        options: expect.objectContaining({
          data: { full_name: "Thandi Mokoena" },
          emailRedirectTo: expect.stringMatching(/\/auth-callback\.html$/),
        }),
      }),
    );
  });

  it("won't sign up when the passwords differ", () => {
    query = "mode=signup";
    render(<AuthPage />);
    type("Full name", "T");
    type("Email address", "t@example.com");
    type("Password", "longenough1");
    type("Confirm password", "different11");
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("emails a reset link that returns through the callback page", async () => {
    query = "mode=forgot";
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<AuthPage />);
    type("Email address", "t@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(
      await screen.findByText("Reset link sent. Please check your inbox."),
    ).toBeInTheDocument();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("t@example.com", {
      redirectTo: expect.stringMatching(/\/auth-callback\.html\?next=reset$/),
    });
  });

  it("sets a new password from the recovery link", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    query = "mode=reset";
    auth.updateUser.mockResolvedValue({ error: null });
    render(<AuthPage />);
    type("New password", "brandnew123");
    type("Confirm password", "brandnew123");
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(
      await screen.findByText("Password updated. Redirecting to your account..."),
    ).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(replaceLocation).toHaveBeenCalledWith("/account#settings");
    vi.useRealTimers();
  });

  it("switches to the reset form when a recovery session starts", async () => {
    let notify: (event: string) => void = () => {};
    auth.onAuthStateChange.mockImplementation((callback: (event: string) => void) => {
      notify = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    render(<AuthPage />);
    act(() => notify("PASSWORD_RECOVERY"));
    expect(
      screen.getByRole("heading", { level: 1, name: "Secure your account." }),
    ).toBeInTheDocument();
  });

  it("offers to resend the verification email to the address they used", async () => {
    query = "mode=verify&email=t%40example.com";
    auth.resend.mockResolvedValue({ error: null });
    render(<AuthPage />);
    expect(screen.getByLabelText("Email address")).toHaveValue("t@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Resend Verification Email" }));
    expect(await screen.findByText(/A new verification email has been sent/)).toBeInTheDocument();
    expect(auth.resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", email: "t@example.com" }),
    );
  });

  it("starts Google sign-in with the account chooser", async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: null });
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalled());
    expect(auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        options: expect.objectContaining({ queryParams: { prompt: "select_account" } }),
      }),
    );
  });
});

describe("AuthCallback", () => {
  it("confirms the account after a sign-in code is exchanged", async () => {
    query = "code=abc";
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    render(<AuthCallback />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Your account is verified." }),
    ).toBeInTheDocument();
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(screen.getByRole("link", { name: "Continue to My Account" })).toHaveAttribute(
      "href",
      "/account#orders",
    );
  });

  it("offers the new-password step after a recovery link", async () => {
    query = "code=abc&next=reset";
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    render(<AuthCallback />);
    expect(await screen.findByRole("link", { name: "Choose New Password" })).toHaveAttribute(
      "href",
      "/auth?mode=reset",
    );
  });

  it("verifies an emailed token", async () => {
    query = "token_hash=h&type=signup";
    auth.verifyOtp.mockResolvedValue({ error: null });
    render(<AuthCallback />);
    await screen.findByText("Your account is verified.");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "h", type: "signup" });
  });

  it("explains a link that failed and offers a new one", async () => {
    query = "code=used";
    auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("Code already used") });
    render(<AuthCallback />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "We could not verify this link." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Code already used")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request New Link" })).toHaveAttribute(
      "href",
      "/auth?mode=verify",
    );
  });

  it("reports an error the address itself carries", async () => {
    query = "error_description=Link+has+expired";
    render(<AuthCallback />);
    expect(await screen.findByText("Link has expired")).toBeInTheDocument();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("fails when there is nothing to verify", async () => {
    render(<AuthCallback />);
    expect(
      await screen.findByText("No verification credentials were found in this link."),
    ).toBeInTheDocument();
  });
});

const ORDER: AccountOrder = {
  id: "o1",
  orderNumber: "ORD-20260901-000001",
  customerName: "Thandi Mokoena",
  customerEmail: "t@example.com",
  customerPhone: "076",
  items: [
    {
      title: "Alpha",
      image: "x.jpg",
      size: "50 × 70 cm",
      quantity: 2,
      unitPrice: 20000,
      lineTotal: 40000,
    },
  ],
  itemSummary: "2 x Alpha",
  quantity: 2,
  subtotal: 40000,
  grandTotal: 40250,
  deliveryMethod: "Deliver to my address",
  deliveryAddress: "1 Main Rd",
  deliveryCity: "Polokwane",
  postalCode: "0700",
  notes: null,
  submittedAt: "2026-09-01T10:00:00Z",
  status: "Preparing",
  statusHistory: [
    { status: "New", at: "2026-09-01T10:00:00Z" },
    { status: "Confirmed", at: "2026-09-02T10:00:00Z" },
  ],
};
const USER = { id: "u1", email: "t@example.com", fullName: "Thandi Mokoena" };

describe("AccountApp", () => {
  it("lists orders by default with their total", async () => {
    render(<AccountApp user={USER} profile={null} orders={[ORDER]} />);
    expect(await screen.findByRole("heading", { name: "My Orders" })).toBeInTheDocument();
    expect(screen.getByText("ORD-20260901-000001")).toBeInTheDocument();
    expect(screen.getByText("R 40 250")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Order" })).toHaveAttribute("href", "#order=o1");
  });

  it("invites a customer with no orders to the collection", async () => {
    render(<AccountApp user={USER} profile={null} orders={[]} />);
    expect(await screen.findByRole("heading", { name: "No orders yet." })).toBeInTheDocument();
  });

  it("follows the address fragment between sections", async () => {
    render(<AccountApp user={USER} profile={null} orders={[ORDER]} />);
    await screen.findByRole("heading", { name: "My Orders" });

    act(() => {
      window.location.hash = "#tracking";
    });
    expect(await screen.findByRole("heading", { name: "Order Tracking" })).toBeInTheDocument();
    expect(screen.getByText("Preparing", { selector: ".tracker-step strong" })).toBeInTheDocument();

    act(() => {
      window.location.hash = "#order=o1";
    });
    expect(await screen.findByRole("heading", { name: "Order Details" })).toBeInTheDocument();
    expect(screen.getByText("Quantity: 2")).toBeInTheDocument();

    act(() => {
      window.location.hash = "#order=someone-elses";
    });
    expect(await screen.findByRole("heading", { name: "Order unavailable" })).toBeInTheDocument();
  });

  it("saves the profile against the customer's own account", async () => {
    upsert.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    window.location.hash = "#profile";
    render(<AccountApp user={USER} profile={null} orders={[]} />);
    await screen.findByRole("heading", { name: "Profile" });

    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: " 0761234567 " } });
    fireEvent.click(screen.getByRole("button", { name: "Save Profile" }));

    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        email: "t@example.com",
        full_name: "Thandi Mokoena",
        phone: "0761234567",
      }),
    );
  });

  it("changes the password only when both boxes match", async () => {
    auth.updateUser.mockResolvedValue({ error: null });
    window.location.hash = "#settings";
    render(<AccountApp user={USER} profile={null} orders={[]} />);
    await screen.findByRole("heading", { name: "Account Settings" });
    const panel = screen.getByText("Password", { selector: ".account-eyebrow" }).closest("form")!;

    fireEvent.change(within(panel).getByLabelText("New password"), {
      target: { value: "brandnew123" },
    });
    fireEvent.change(within(panel).getByLabelText("Confirm password"), {
      target: { value: "different" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Update Password" }));
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(auth.updateUser).not.toHaveBeenCalled();

    fireEvent.change(within(panel).getByLabelText("Confirm password"), {
      target: { value: "brandnew123" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Update Password" }));
    expect(await screen.findByText("Password updated.")).toBeInTheDocument();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "brandnew123" });
  });

  it("logs out and returns to the home page", async () => {
    render(<AccountApp user={USER} profile={null} orders={[]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Log Out" }));
    await waitFor(() => expect(replaceLocation).toHaveBeenCalledWith("/"));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("says so when the account could not be loaded", async () => {
    render(<AccountApp user={USER} profile={null} orders={[]} loadError="permission denied" />);
    expect(
      await screen.findByRole("heading", { name: "We could not load your account." }),
    ).toBeInTheDocument();
    expect(screen.getByText("permission denied")).toBeInTheDocument();
  });
});

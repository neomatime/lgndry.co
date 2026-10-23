import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/features/auth/components/login-form";

vi.mock("@/features/auth/actions/sign-in", () => ({
  signInAction: vi.fn(),
}));

describe("LoginForm", () => {
  it("renders the complete accessible sign-in experience", () => {
    render(<LoginForm next="/ops/inbox" />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("checkbox", { name: "Keep me signed in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/auth?mode=forgot",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("reveals and hides the password without changing the field value", () => {
    render(<LoginForm />);
    const password = screen.getByLabelText("Password");
    fireEvent.change(password, { target: { value: "temporary-password" } });

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("temporary-password");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("announces a server-side access error", () => {
    render(<LoginForm initialError="That account does not have access." />);
    expect(screen.getByRole("alert")).toHaveTextContent("That account does not have access.");
  });
});

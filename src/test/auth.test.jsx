import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), getUser: vi.fn(),
  navigate: vi.fn(), cancel: vi.fn(), clear: vi.fn(), invalidate: vi.fn(), save: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {
  signUp: mocks.signUp, signInWithPassword: mocks.signIn, signOut: mocks.signOut, getUser: mocks.getUser,
} } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }) => <a>{children}</a>, useNavigate: () => mocks.navigate,
  createFileRoute: () => (options) => ({ options }), redirect: (options) => ({ redirect: options.to }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ cancelQueries: mocks.cancel, clear: mocks.clear, invalidateQueries: mocks.invalidate }),
  useSuspenseQuery: () => ({ data: { email: "account@example.com", displayName: "Member" } }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.save }));
vi.mock("../components/AccountAuth", () => ({ useAccountAuth: () => ({ user: null, loading: false, error: "" }) }));
vi.mock("@/lib/account.functions", () => ({ getAccount: vi.fn(), saveProfile: vi.fn() }));
import AuthPage from "../components/AuthPage";
import AccountPage from "../components/AccountPage";
import { Route } from "../routes/_authenticated/route";

beforeEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Supabase accounts", () => {
  it("does not treat an unconfirmed signup as a signed-in session", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Member" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "member@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "temporary-test-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form"));
    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith({ email: "member@example.com", password: "temporary-test-password", options: { emailRedirectTo: window.location.origin, data: { display_name: "Member" } } }));
    await screen.findByRole("status");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("signs in with Supabase email and password and opens the account", async () => {
    mocks.signIn.mockResolvedValue({ data: { session: { user: { id: "member" } } }, error: null });
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "member@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "temporary-test-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form"));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/account", replace: true }));
    expect(mocks.signIn).toHaveBeenCalledWith({ email: "member@example.com", password: "temporary-test-password" });
  });
  it("rejects account access without a verified user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(Route.options.beforeLoad()).rejects.toEqual({ redirect: "/auth" });
  });
  it("admits a verified user to account pages", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "member" } }, error: null });
    await expect(Route.options.beforeLoad()).resolves.toBeUndefined();
  });
  it("clears protected data before logout and replaces browser history", async () => {
    mocks.cancel.mockResolvedValue(); mocks.signOut.mockResolvedValue({ error: null });
    render(<AccountPage />);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/auth", replace: true }));
    expect(mocks.cancel.mock.invocationCallOrder[0]).toBeLessThan(mocks.clear.mock.invocationCallOrder[0]);
    expect(mocks.clear.mock.invocationCallOrder[0]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]);
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(mocks.navigate.mock.invocationCallOrder[0]);
  });
});
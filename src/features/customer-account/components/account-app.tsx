"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { imageSrc } from "@/features/shop/catalogue/artwork";
import {
  cancelledAt,
  firstItem,
  historyFor,
  orderTotal,
  PRE_FULFILMENT,
  trackerSteps,
  type AccountOrder,
} from "@/features/customer-account/orders";
import { formatMoney } from "@/features/shop/money";
import { replaceLocation } from "@/features/customer-account/navigate";
import { createSupabaseBrowserClient } from "@/lib/db/client";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils/cn";

export type AccountProfile = {
  full_name: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
};

export type AccountUser = { id: string; email: string; fullName: string };

type Page = "profile" | "orders" | "tracking" | "settings" | "order";
const PAGES: Exclude<Page, "order">[] = ["profile", "orders", "tracking", "settings"];
const NAV: { page: Exclude<Page, "order">; label: string }[] = [
  { page: "profile", label: "Profile" },
  { page: "orders", label: "My Orders" },
  { page: "tracking", label: "Order Tracking" },
  { page: "settings", label: "Account Settings" },
];

const FALLBACK_IMAGE = "assests/images/collection/thumbs/still-point.jpg";

// The current section lives in the address fragment (#orders, #order=<id>), so
// existing links keep working and the browser's back button moves between sections.
const subscribeHash = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};
const readHash = () => window.location.hash;

function routeFor(hash: string): { page: Page; id?: string } {
  const value = hash.slice(1) || "orders";
  if (value.startsWith("order=")) return { page: "order", id: decodeURIComponent(value.slice(6)) };
  return { page: (PAGES as string[]).includes(value) ? (value as Page) : "orders" };
}

function formatDate(value: string | null | undefined, withTime: boolean): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(
    "en-ZA",
    withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" },
  );
}

function Heading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <header className="account-heading">
      <div>
        <span className="account-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <p>{intro}</p>
    </header>
  );
}

type Feedback = { text: string; success?: boolean };

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  return (
    <p
      className={cn("auth-feedback", feedback.success && "auth-feedback--success")}
      role="status"
      aria-live="polite"
    >
      {feedback.text}
    </p>
  );
}

function useBrowserClient() {
  return useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);
}

const NOT_CONFIGURED = "This is not available right now. Please try again later.";

function ProfileView({ user, profile }: { user: AccountUser; profile: AccountProfile | null }) {
  const client = useBrowserClient();
  const [form, setForm] = useState({
    full_name: profile?.full_name || user.fullName,
    phone: profile?.phone ?? "",
    city: profile?.city ?? "",
    address: profile?.address ?? "",
    postal_code: profile?.postal_code ?? "",
  });
  const [feedback, setFeedback] = useState<Feedback>({ text: "" });
  const set =
    (name: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [name]: event.target.value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client) return setFeedback({ text: NOT_CONFIGURED });
    const payload = {
      user_id: user.id,
      email: user.email,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      postal_code: form.postal_code.trim(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from("customer_profiles").upsert(payload);
    if (error) return setFeedback({ text: error.message });
    const updated = await client.auth.updateUser({
      data: { full_name: payload.full_name, phone: payload.phone },
    });
    setFeedback(
      updated.error ? { text: updated.error.message } : { text: "Profile saved.", success: true },
    );
  };

  return (
    <>
      <Heading
        eyebrow="Personal details"
        title="Profile"
        intro="Keep your delivery and contact details current for future order requests."
      />
      <form className="account-panel" autoComplete="on" onSubmit={save}>
        <div className="account-grid">
          <label className="auth-field">
            <span>Full name</span>
            <input
              name="full_name"
              autoComplete="name"
              value={form.full_name}
              onChange={set("full_name")}
              required
            />
          </label>
          <label className="auth-field">
            <span>Email</span>
            <input value={user.email} disabled readOnly />
          </label>
          <label className="auth-field">
            <span>Phone</span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={set("phone")}
            />
          </label>
          <label className="auth-field">
            <span>City / town</span>
            <input
              name="city"
              autoComplete="address-level2"
              value={form.city}
              onChange={set("city")}
            />
          </label>
          <label className="auth-field auth-field--wide">
            <span>Delivery address</span>
            <textarea
              name="address"
              autoComplete="street-address"
              value={form.address}
              onChange={set("address")}
            />
          </label>
          <label className="auth-field">
            <span>Postal code</span>
            <input
              name="postal_code"
              autoComplete="postal-code"
              value={form.postal_code}
              onChange={set("postal_code")}
            />
          </label>
        </div>
        <div className="account-savebar">
          <FeedbackLine feedback={feedback} />
          <button className="auth-button" type="submit">
            Save Profile
          </button>
        </div>
      </form>
    </>
  );
}

function OrdersView({ orders }: { orders: AccountOrder[] }) {
  return (
    <>
      <Heading
        eyebrow="Collection requests"
        title="My Orders"
        intro="Every order shown here belongs exclusively to your verified customer account."
      />
      {orders.length ? (
        <div className="orders-list">
          {orders.map((order) => {
            const item = firstItem(order);
            return (
              <article className="order-card" key={order.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="order-card__image"
                  src={imageSrc(item.image || FALLBACK_IMAGE)}
                  alt={item.title || order.itemSummary || "Collection artwork"}
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <small>{order.orderNumber}</small>
                  <h3 className="order-card__title">
                    {item.title || order.itemSummary || "Collection order"}
                  </h3>
                  <span className="order-status">{order.status}</span>
                </div>
                <div className="order-card__meta">
                  <small>Date submitted</small>
                  <strong>{formatDate(order.submittedAt, false)}</strong>
                </div>
                <div className="order-card__meta">
                  <small>Quantity</small>
                  <strong>{order.quantity || 1}</strong>
                </div>
                <div className="order-card__meta">
                  <small>Order total</small>
                  <strong>{formatMoney(orderTotal(order))}</strong>
                </div>
                <a className="order-view" href={`#order=${encodeURIComponent(order.id)}`}>
                  View Order
                </a>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="account-panel account-empty">
          <h3>No orders yet.</h3>
          <p>Your collection requests will appear here after they are submitted.</p>
          <Link
            className="auth-button"
            href="/collection"
            style={{ display: "inline-block", marginTop: 20, textDecoration: "none" }}
          >
            Explore Collection
          </Link>
        </div>
      )}
    </>
  );
}

function Tracker({ order }: { order: AccountOrder }) {
  const cancelled = order.status === "Cancelled";
  if (cancelled) {
    const at = cancelledAt(order);
    return (
      <div className="tracker-cancelled">
        Order cancelled{at ? ` — ${formatDate(at, true)}` : ""}
      </div>
    );
  }
  return (
    <>
      {PRE_FULFILMENT.includes(order.status) ? (
        <p className="tracker-pre">
          Your request is in the <strong>{order.status}</strong> stage. The fulfilment timeline
          begins once availability is confirmed.
        </p>
      ) : null}
      <div className="tracker">
        {trackerSteps(order).map((step) => (
          <div key={step.name} className={cn("tracker-step", step.state && `is-${step.state}`)}>
            <strong>{step.name}</strong>
            {step.at ? <time>{formatDate(step.at, true)}</time> : null}
          </div>
        ))}
      </div>
    </>
  );
}

function TrackingView({ orders }: { orders: AccountOrder[] }) {
  const current = orders.filter((order) => order.status !== "Completed");
  return (
    <>
      <Heading
        eyebrow="Status updates"
        title="Order Tracking"
        intro="Status reflects the latest stage selected by the LGNDRY.Co team. This is not live GPS tracking."
      />
      {current.length ? (
        current.map((order) => (
          <section className="account-panel" style={{ marginBottom: 24 }} key={order.id}>
            <div className="account-heading" style={{ marginBottom: 12 }}>
              <div>
                <span className="account-eyebrow">{order.orderNumber}</span>
                <h2 style={{ fontSize: "2.5rem" }}>
                  {firstItem(order).title || order.itemSummary}
                </h2>
              </div>
              <a className="order-view" href={`#order=${encodeURIComponent(order.id)}`}>
                View Order
              </a>
            </div>
            <Tracker order={order} />
          </section>
        ))
      ) : (
        <div className="account-panel account-empty">
          <h3>No active tracking.</h3>
          <p>Orders in progress will appear here.</p>
        </div>
      )}
    </>
  );
}

function OrderDetail({ order }: { order: AccountOrder }) {
  const items = Array.isArray(order.items) ? order.items : [];
  return (
    <>
      <a className="order-detail__back" href="#orders">
        ← Back to My Orders
      </a>
      <Heading
        eyebrow={order.orderNumber}
        title="Order Details"
        intro={`Submitted ${formatDate(order.submittedAt, true)}`}
      />
      <section className="account-panel" style={{ marginBottom: 28 }}>
        <span className="account-eyebrow">Current progress</span>
        <Tracker order={order} />
        <div className="status-history">
          {historyFor(order)
            .slice()
            .reverse()
            .map((event, index) => (
              <div className="status-history__item" key={`${event.status}-${event.at}-${index}`}>
                <span className="status-history__dot" />
                <strong>{event.status}</strong>
                <time>{formatDate(event.at, true)}</time>
              </div>
            ))}
        </div>
      </section>
      <div className="order-summary-grid">
        <section className="account-panel">
          <span className="account-eyebrow">Order summary</span>
          <div className="order-items" style={{ marginTop: 28 }}>
            {items.map((item, index) => (
              <article className="order-item" key={index}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc(item.image || "")}
                  alt={item.title || "Artwork"}
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <h3>{item.title || "Artwork"}</h3>
                  <small>{(item.size || "") + (item.details ? ` · ${item.details}` : "")}</small>
                  <small>Quantity: {item.quantity || 1}</small>
                </div>
                <strong>
                  {formatMoney(
                    item.lineTotal || Number(item.unitPrice || 0) * Number(item.quantity || 1),
                  )}
                </strong>
              </article>
            ))}
            <div className="account-savebar">
              <span>Total</span>
              <strong className="order-total">{formatMoney(orderTotal(order))}</strong>
            </div>
          </div>
        </section>
        <aside className="account-panel order-info">
          <div className="order-info__row">
            <span className="order-meta-label">Customer</span>
            {order.customerName}
            <br />
            {order.customerEmail}
            <br />
            {order.customerPhone}
          </div>
          <div className="order-info__row">
            <span className="order-meta-label">Delivery</span>
            {order.deliveryMethod}
            <br />
            {order.deliveryAddress}
            <br />
            {order.deliveryCity} {order.postalCode}
          </div>
          <div className="order-info__row">
            <span className="order-meta-label">Notes</span>
            {order.notes || "None"}
          </div>
          <div className="order-info__row">
            <span className="order-meta-label">Tracking note</span>
            Status updates only. Live GPS tracking is not provided.
          </div>
        </aside>
      </div>
    </>
  );
}

function SettingsView({ user }: { user: AccountUser }) {
  const client = useBrowserClient();
  const [email, setEmail] = useState(user.email);
  const [emailFeedback, setEmailFeedback] = useState<Feedback>({ text: "" });
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>({ text: "" });

  const changeEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client) return setEmailFeedback({ text: NOT_CONFIGURED });
    const { error } = await client.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: `${window.location.origin}/account#settings` },
    );
    setEmailFeedback(
      error
        ? { text: error.message }
        : { text: "Check both email addresses to confirm the change.", success: true },
    );
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    if (password !== (form.elements.namedItem("confirm") as HTMLInputElement).value) {
      return setPasswordFeedback({ text: "Passwords do not match." });
    }
    if (!client) return setPasswordFeedback({ text: NOT_CONFIGURED });
    const { error } = await client.auth.updateUser({ password });
    if (error) return setPasswordFeedback({ text: error.message });
    form.reset();
    setPasswordFeedback({ text: "Password updated.", success: true });
  };

  return (
    <>
      <Heading
        eyebrow="Security"
        title="Account Settings"
        intro="Change your email address or password. Email changes require verification."
      />
      <div className="account-grid">
        <form className="account-panel auth-form" autoComplete="on" onSubmit={changeEmail}>
          <span className="account-eyebrow">Email address</span>
          <label className="auth-field">
            <span>New email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <FeedbackLine feedback={emailFeedback} />
          <button className="auth-button" type="submit">
            Update Email
          </button>
        </form>
        <form className="account-panel auth-form" autoComplete="on" onSubmit={changePassword}>
          <span className="account-eyebrow">Password</span>
          <label className="auth-field">
            <span>New password</span>
            <input
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="auth-field">
            <span>Confirm password</span>
            <input
              name="confirm"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
          <FeedbackLine feedback={passwordFeedback} />
          <button className="auth-button" type="submit">
            Update Password
          </button>
        </form>
      </div>
    </>
  );
}

export function AccountApp({
  user,
  profile,
  orders,
  loadError,
}: {
  user: AccountUser;
  profile: AccountProfile | null;
  orders: AccountOrder[];
  /** Set when the account data could not be loaded. */
  loadError?: string;
}) {
  const hydrated = useHydrated();
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const client = useBrowserClient();
  const route = routeFor(hash);

  const signOut = async () => {
    await client?.auth.signOut();
    replaceLocation("/");
  };

  const body = () => {
    // The page reads the browser's address fragment, so it fills in once it is running.
    if (!hydrated) {
      return (
        <div className="account-empty">
          <p>Loading your account…</p>
        </div>
      );
    }
    if (loadError) {
      return (
        <>
          <Heading
            eyebrow="Account unavailable"
            title="We could not load your account."
            intro={loadError}
          />
          <div className="account-panel">
            <p>Please refresh or contact neomokgwadi@lgndry-co.co.za.</p>
          </div>
        </>
      );
    }
    switch (route.page) {
      case "profile":
        return <ProfileView user={user} profile={profile} />;
      case "tracking":
        return <TrackingView orders={orders} />;
      case "settings":
        return <SettingsView user={user} />;
      case "order": {
        const order = orders.find((o) => o.id === route.id);
        return order ? (
          <OrderDetail order={order} />
        ) : (
          <>
            <Heading
              eyebrow="Private order"
              title="Order unavailable"
              intro="This order does not exist or does not belong to your account."
            />
            <div className="account-panel account-empty">
              <a className="auth-button" href="#orders" style={{ textDecoration: "none" }}>
                Return to My Orders
              </a>
            </div>
          </>
        );
      }
      default:
        return <OrdersView orders={orders} />;
    }
  };

  return (
    <>
      <header className="account-topbar">
        <Link className="account-brand" href="/">
          LGNDRY.Co
        </Link>
        <Link className="account-topbar__link" href="/collection">
          Visit collection
        </Link>
      </header>
      <div className="account-shell">
        <aside className="account-sidebar">
          <span className="account-eyebrow">Private client area</span>
          <h1>My Account</h1>
          <select
            className="account-mobile-nav"
            aria-label="Account section"
            value={route.page === "order" ? "orders" : route.page}
            onChange={(event) => {
              window.location.hash = event.target.value;
            }}
          >
            {NAV.map(({ page, label }) => (
              <option key={page} value={page}>
                {label}
              </option>
            ))}
          </select>
          <nav className="account-nav">
            {NAV.map(({ page, label }) => (
              <a key={page} href={`#${page}`} className={cn(route.page === page && "is-active")}>
                {label}
              </a>
            ))}
            <button type="button" onClick={() => void signOut()}>
              Log Out
            </button>
          </nav>
        </aside>
        <main className="account-main" id="main-content">
          {body()}
        </main>
      </div>
    </>
  );
}

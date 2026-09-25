"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/db/client";

export type CustomerSession = "loading" | "signed-out" | "signed-in";

/**
 * Whether the visitor is signed in as a customer. Starts as "loading" (so the
 * nav renders nothing extra until it knows) and follows sign-in/out live.
 * If Supabase isn't configured the visitor is simply treated as signed out.
 */
export function useCustomerSession(): CustomerSession {
  const [session, setSession] = useState<CustomerSession>("loading");

  useEffect(() => {
    let active = true;
    let client: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      client = createSupabaseBrowserClient();
    } catch {
      // Not configured: resolve asynchronously, like the real lookup would.
      void Promise.resolve().then(() => {
        if (active) setSession("signed-out");
      });
      return () => {
        active = false;
      };
    }

    void client.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session ? "signed-in" : "signed-out");
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next ? "signed-in" : "signed-out");
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return session;
}

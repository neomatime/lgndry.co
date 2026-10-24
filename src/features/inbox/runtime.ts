type DeploymentEnvironment = {
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
};

function requestHost(value: string | null) {
  const host = value?.split(",")[0]?.trim();
  return host && /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host) ? host : null;
}

/** Resolves a public asset origin without tying email content to the marketing website. */
export function resolveInboxAssetOrigin(
  requestHeaders: Headers,
  environment: DeploymentEnvironment,
  fallbackUrl: string,
) {
  const host =
    requestHost(requestHeaders.get("x-forwarded-host")) ?? requestHost(requestHeaders.get("host"));
  if (host) {
    const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol =
      forwardedProtocol === "http" || forwardedProtocol === "https"
        ? forwardedProtocol
        : /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(host)
          ? "http"
          : "https";
    return `${protocol}://${host}`;
  }

  const deploymentHost =
    requestHost(environment.VERCEL_PROJECT_PRODUCTION_URL ?? null) ??
    requestHost(environment.VERCEL_URL ?? null);
  return deploymentHost ? `https://${deploymentHost}` : new URL(fallbackUrl).origin;
}

function payloadError(data: unknown) {
  if (!data || typeof data !== "object" || !("error" in data)) return "";
  const detail = data.error;
  return typeof detail === "string" ? detail : "";
}

/** Supabase stores a non-2xx Edge Function body on the error response context. */
export async function readEdgeFunctionError(data: unknown, error: unknown) {
  const direct = payloadError(data);
  if (direct) return direct;

  if (error && typeof error === "object" && "context" in error) {
    const context = error.context;
    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as unknown;
        const contextual = payloadError(body);
        if (contextual) return contextual;
      } catch {
        // Fall through to the SDK's error message when the response is not JSON.
      }
    }
  }

  if (error && typeof error === "object" && "message" in error) {
    return typeof error.message === "string" ? error.message : "";
  }
  return "";
}

export function inboxSyncErrorMessage(detail: string) {
  return /AUTHENTICATIONFAILED|AccountNotFound|AuthenticationError|invalid credentials|login failed/i.test(
    detail,
  )
    ? "Titan rejected the mailbox sign-in. Enable third-party email access and refresh the stored IMAP password."
    : "The mailbox could not be synchronized just now.";
}

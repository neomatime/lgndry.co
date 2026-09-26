/**
 * Loads a page in place of this one, as a full page load. After signing in or
 * out this makes the whole site (menu, server pages) pick up the new session.
 * A function of its own so tests can observe it.
 */
export function replaceLocation(url: string): void {
  window.location.replace(url);
}

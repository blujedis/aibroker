import type { SessionUser } from "$lib/server/auth/session";

declare global {
  namespace App {
    interface Locals {
      user: SessionUser | null;
      pendingUser: SessionUser | null;
      sessionId: string | null;
    }
    interface PageData {
      user?: SessionUser | null;
    }
    // interface Error {}
    // interface Platform {}
  }
}

// biome-ignore lint/complexity/noUselessEmptyExport: needed to mark as module
export { };

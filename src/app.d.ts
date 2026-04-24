import type { SessionUser } from '$lib/server/auth/session';

declare global {
  namespace App {
    interface Locals {
      user: SessionUser | null;
      sessionId: string | null;
    }
    interface PageData {
      user?: SessionUser | null;
    }
    // interface Error {}
    // interface Platform {}
  }
}

export { };

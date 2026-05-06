import { createHash } from 'node:crypto';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '$lib/server/db/postgres.js';
import type { User } from '$lib/server/db/schema.postgres.js';

const DEFAULT_INVITE_EXPIRY_HOURS = 72;

export function getInviteExpiryHours(): number {
  const value = Number(process.env.INVITE_EXPIRY_HOURS ?? DEFAULT_INVITE_EXPIRY_HOURS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_INVITE_EXPIRY_HOURS;
}

export function getInviteExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + getInviteExpiryHours() * 60 * 60 * 1000);
}

export function createInvitationToken(): string {
  return nanoid(48);
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function findInvitationByToken(token: string) {
  const rows = await db
    .select()
    .from(schema.userInvitations)
    .where(eq(schema.userInvitations.tokenHash, hashInvitationToken(token)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findActiveInvitationByEmail(email: string) {
  const rows = await db
    .select()
    .from(schema.userInvitations)
    .where(
      and(
        eq(schema.userInvitations.email, email.toLowerCase()),
        isNull(schema.userInvitations.acceptedAt),
        isNull(schema.userInvitations.revokedAt),
        gt(schema.userInvitations.expiresAt, new Date())
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createInvitation(input: {
  email: string;
  role: User['role'];
  profileId: string;
  invitedByUserId: string;
  customMessage?: string | null;
  expiresAt?: Date;
}) {
  const rawToken = createInvitationToken();
  const invitationId = nanoid();
  const now = new Date();
  const expiresAt = input.expiresAt ?? getInviteExpiresAt(now);

  await db.insert(schema.userInvitations).values({
    id: invitationId,
    email: input.email.toLowerCase(),
    role: input.role,
    profileId: input.profileId,
    tokenHash: hashInvitationToken(rawToken),
    customMessage: input.customMessage?.trim() || null,
    invitedByUserId: input.invitedByUserId,
    acceptedByUserId: null,
    expiresAt,
    acceptedAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now
  });

  return {
    id: invitationId,
    rawToken,
    expiresAt
  };
}

export function isInvitationExpired(invitation: {
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}): boolean {
  return !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt.getTime() <= Date.now();
}

export function isInvitationUsable(invitation: {
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}): boolean {
  return !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt.getTime() > Date.now();
}

export async function acceptInvitation(invitationId: string, acceptedByUserId: string): Promise<void> {
  await db.update(schema.userInvitations)
    .set({ acceptedByUserId, acceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.userInvitations.id, invitationId));
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  await db.update(schema.userInvitations)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.userInvitations.id, invitationId));
}

export async function listVisibleInvitations(actor: Pick<User, 'id' | 'role'>) {
  if (actor.role === 'admin') {
    return db.select().from(schema.userInvitations);
  }

  return db
    .select()
    .from(schema.userInvitations)
    .where(
      or(
        eq(schema.userInvitations.invitedByUserId, actor.id),
        and(eq(schema.userInvitations.role, 'operator'), eq(schema.userInvitations.invitedByUserId, actor.id))
      )
    );
}

// Dev-only seed: creates (or refreshes) a single verified demo user so the
// documented test credentials work in any environment and survive a
// `prisma migrate reset`.
//
// IMPORTANT — Definition of Done compliance:
//   * This is NEVER run on the default startup path (no `prisma migrate deploy`
//     / boot hook calls it). A fresh DB still starts with schema + migration
//     metadata only. Run it explicitly with `npm run seed`.
//   * No password is hard-coded here. The demo credentials come from the
//     gitignored `.env` (`DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`). If they are
//     absent the script exits with guidance instead of inventing a default.
//
// Idempotent: re-running upserts the same user (hash refreshed, verified true).

import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const rawEmail = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;

  if (!rawEmail || !password) {
    throw new Error(
      'Set DEMO_USER_EMAIL and DEMO_USER_PASSWORD in your .env to seed the demo user. ' +
        'They are intentionally not hard-coded (no committed secret).',
    );
  }

  // Match the signup normalization (trim + lowercase) so login lookups hit.
  const email = rawEmail.trim().toLowerCase();
  const passwordHash = await hash(password); // @node-rs/argon2 → Argon2id

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, emailVerified: true },
    create: { email, passwordHash, emailVerified: true },
  });

  console.log(`Seeded verified demo user: ${user.email} (${user.id})`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

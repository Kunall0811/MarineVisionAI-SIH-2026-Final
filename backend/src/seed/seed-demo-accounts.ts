import * as bcrypt from 'bcrypt';
import { UsersService } from '../modules/users/users.service';

/**
 * Seeds the two ready-to-use demo accounts on startup in development/demo
 * mode (guarded by AUTO_SEED_DEMO, default "true" outside production).
 * Passwords are hashed the same way as normal registration; this is not a
 * backdoor, it's a convenience for local/demo environments only.
 *
 *   Admin:    admin@marinevision.ai    / Admin@12345
 *   Operator: operator@marinevision.ai / Operator@12345
 */
export async function seedDemoAccounts(usersService: UsersService, logger: { log: (msg: string) => void }) {
  const accounts: { fullName: string; email: string; password: string; role: 'ADMIN' | 'OPERATOR' }[] = [
    {
      fullName: process.env.DEMO_ADMIN_NAME || 'Admin Operator',
      email: process.env.DEMO_ADMIN_EMAIL || 'admin@marinevision.ai',
      password: process.env.DEMO_ADMIN_PASSWORD || 'Admin@12345',
      role: 'ADMIN',
    },
    {
      fullName: process.env.DEMO_OPERATOR_NAME || 'Field Operator',
      email: process.env.DEMO_OPERATOR_EMAIL || 'operator@marinevision.ai',
      password: process.env.DEMO_OPERATOR_PASSWORD || 'Operator@12345',
      role: 'OPERATOR',
    },
  ];

  for (const acct of accounts) {
    const existing = await usersService.findByEmail(acct.email);
    if (existing) continue;

    const passwordHash = await bcrypt.hash(acct.password, 12);
    await usersService.create({
      fullName: acct.fullName,
      email: acct.email,
      passwordHash,
      role: acct.role,
      isEmailVerified: true,
      isActive: true,
    } as any);
    logger.log(`Seeded demo ${acct.role} account: ${acct.email}`);
  }
}

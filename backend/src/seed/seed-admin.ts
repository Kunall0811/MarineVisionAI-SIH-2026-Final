/**
 * Creates (or promotes) the first ADMIN account. Public self-registration
 * only ever creates OPERATOR accounts (see auth.service.ts), so an ADMIN
 * must be provisioned out-of-band - either via this script or by an
 * existing Admin promoting a user through PATCH /api/users/:id.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@marinevision.ai ADMIN_PASSWORD=ChangeMe123! ADMIN_NAME="System Admin" \
 *   npm run seed:admin
 */
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserSchema } from '../modules/users/schemas/user.schema';

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/marinevision';
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME || 'System Administrator';

  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const UserModel = mongoose.model(User.name, UserSchema);

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await UserModel.findOne({ email: email.toLowerCase() });

  if (existing) {
    existing.role = 'ADMIN';
    existing.isEmailVerified = true;
    existing.isActive = true;
    await existing.save();
    // eslint-disable-next-line no-console
    console.log(`Existing user ${email} promoted to ADMIN.`);
  } else {
    await UserModel.create({
      fullName,
      email: email.toLowerCase(),
      passwordHash,
      role: 'ADMIN',
      isEmailVerified: true,
      isActive: true,
    });
    // eslint-disable-next-line no-console
    console.log(`Admin account created: ${email}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Admin seeding failed:', err);
  process.exit(1);
});

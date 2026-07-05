import User from '../models/User.js';

/**
 * Seeds or repairs the admin account on startup.
 *
 * Required env vars:
 *   ADMIN_SEED_EMAIL    — email address for the admin account
 *   ADMIN_SEED_PASSWORD — password for the admin account (hashed via User pre-save hook)
 *
 * The admin account is created with:
 *   - isAdmin: true
 *   - role: 'premium' (never expires — 9999-day window)
 *   - authProvider: 'local' (logs in via POST /api/v1/auth/admin-login using env-var credentials)
 *
 * Never print the actual password. Confirm status via console logs only.
 */

const NINE_NINE_NINE_NINE_DAYS = 9999 * 24 * 60 * 60 * 1000;

export const ensureAdminExists = async () => {
  const adminEmail    = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;

  if (!adminEmail) {
    console.log('[Admin] ADMIN_SEED_EMAIL not set — skipping admin seed.');
    return;
  }
  if (!adminPassword) {
    console.log('[Admin] ADMIN_SEED_PASSWORD not set — skipping admin seed.');
    return;
  }

  try {
    let admin = await User.findOne({ email: adminEmail.toLowerCase() }).select('+password');
    const far = new Date(Date.now() + NINE_NINE_NINE_NINE_DAYS);

    if (admin) {
      let changed = false;

      if (!admin.isAdmin)            { admin.isAdmin = true;     changed = true; }
      if (admin.role !== 'premium')  { admin.role = 'premium';   changed = true; }
      if (!admin.premiumUntil || admin.premiumUntil < far) { admin.premiumUntil = far; changed = true; }

      // Re-hash password if it has changed in the env var
      // We always write it so bcrypt can re-hash if needed via the pre-save hook.
      admin.password     = adminPassword;
      admin.authProvider = 'local';
      changed = true;

      if (changed) {
        await admin.save({ validateBeforeSave: false });
        console.log(`[Admin] Admin account updated: ${adminEmail}`);
      }
    } else {
      await User.create({
        email:        adminEmail.toLowerCase(),
        password:     adminPassword,          // hashed by User pre-save hook
        name:         process.env.ADMIN_SEED_NAME || 'Admin',
        role:         'premium',
        isAdmin:      true,
        authProvider: 'local',
        premiumUntil: far,
      });
      console.log(`[Admin] Admin account created: ${adminEmail}`);
    }
  } catch (err) {
    console.error('[Admin] Failed to seed admin account:', err.message);
  }
};

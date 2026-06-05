import User from '../models/User.js';

const ADMIN_NAME = 'Ayokunle';
const NINE_NINE_NINE_NINE_DAYS = 9999 * 24 * 60 * 60 * 1000;

export const ensureAdminExists = async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.log('[Admin] ADMIN_EMAIL not set — skipping admin seed.');
    return;
  }

  try {
    let admin = await User.findOne({ email: adminEmail.toLowerCase() });

    if (admin) {
      let changed = false;
      if (!admin.isAdmin)          { admin.isAdmin = true;  changed = true; }
      if (admin.role !== 'premium'){ admin.role = 'premium'; changed = true; }

      const expectedExpiry = new Date(Date.now() + NINE_NINE_NINE_NINE_DAYS);
      if (!admin.premiumUntil || admin.premiumUntil < expectedExpiry) {
        admin.premiumUntil = expectedExpiry;
        changed = true;
      }

      if (changed) {
        await admin.save({ validateBeforeSave: false });
        console.log(`[Admin] Developer account updated: ${adminEmail}`);
      } else {
        console.log(`[Admin] Developer account OK: ${adminEmail}`);
      }
    } else {
      admin = await User.create({
        email:        adminEmail.toLowerCase(),
        name:         ADMIN_NAME,
        role:         'premium',
        isAdmin:      true,
        authProvider: 'local',
        premiumUntil: new Date(Date.now() + NINE_NINE_NINE_NINE_DAYS)
      });
      console.log(`[Admin] Developer account created: ${adminEmail}`);
    }
  } catch (err) {
    console.error('[Admin] Failed to seed admin account:', err.message);
  }
};

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

// Resolve .env relative to this file — works regardless of cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

import app from './app.js';
import connectDB from './config/db.js';
import { ensureAdminExists } from './utils/seedAdmin.js';

const PORT = process.env.PORT || 3001;

connectDB().then(async () => {
  await ensureAdminExists();
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
});

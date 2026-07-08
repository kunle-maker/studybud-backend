import dotenv from 'dotenv';
dotenv.config();
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

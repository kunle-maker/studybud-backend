import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import passport from './config/passport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Short-lived session — only used during the OAuth handshake (Google / GitHub).
// JWTs are the actual auth mechanism; sessions are never used after the redirect.
app.use(session({
  secret: process.env.SESSION_SECRET || 'studyflow_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge:   10 * 60 * 1000,
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(globalLimiter);

app.use('/api/v1', routes);

app.get('/pay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});
app.use('/pay', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) =>
  res.json({
    message: 'StudyFlow API — by Ayokunle',
    version: '1.0.0',
    paymentPage: '/pay',
    docs: '/api/v1/health'
  })
);

app.use((req, res) =>
  res.status(404).json({ success: false, message: 'Route not found' })
);

app.use(errorHandler);

export default app;

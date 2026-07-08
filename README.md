# StudyFlow Backend

> A powerful AI-powered learning platform backend that combines OAuth authentication, AI-driven study tools, and collaborative learning features.

**Live API:** `https://studybud-backend.onrender.com`

---

## 🎯 What is StudyFlow?

StudyFlow is an intelligent study companion that helps students learn faster and smarter. The backend powers all the magic—from AI-generated summaries and flashcards to smart teacher chat, OCR text extraction, and collaborative study assignments.

Whether you're summarizing textbooks, creating quizzes, learning at your own pace with structured roadmaps, or working together with classmates, StudyFlow has you covered.

---

## ✨ Core Features

### 🔐 **Authentication**
- Seamless OAuth login via **Google**, **GitHub**, and **Telegram**
- Secure JWT token management
- No email/password hassle—just sign in

### 🤖 **AI Study Tools**
- **Summaries** — Condense any study text into concise notes
- **Flashcards** — Auto-generate flashcards from your material
- **Quizzes** — Create interactive quizzes with explanations
- **Teacher Chat** — Ask questions, get instant explanations in a multi-turn conversation
- **Topic Explainer** — Learn about any topic with tailored explanations
- **OCR** — Extract text from images (perfect for scanning notes or textbooks)

### 📚 **Structured Learning**
- **Topic Roadmaps** — Curated curricula with ordered lessons and prerequisites
- Track progress with locked/unlocked lessons
- Learn at your own pace with completion tracking

### 👥 **Collaborative Learning**
- **Shared Assignments** — Create group assignments and invite classmates
- **Comments & @Mentions** — Discuss work with teammates
- **Share Links** — One-click invite without emails
- **Activity Logs** — See who did what and when

### 💰 **Premium**
- Unlimited access to all features
- Simple bank transfer payment via screenshot verification

### 📊 **Usage Tracking**
- Daily limits for free users (keeps the platform sustainable)
- Real-time usage stats and history
- Upgrade prompts when limits are reached

---

## 🚀 Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB
- **Authentication:** Passport.js (Google, GitHub, Telegram OAuth)
- **AI:** Claude API (summaries, explanations, quizzes)
- **OCR:** Tesseract / Cloud Vision
- **File Storage:** Cloudinary
- **Payments:** SmartCash MFB (screenshot verification)
- **Deployment:** Render

---

## 📖 API Documentation

The complete API reference is in **[doc.md](./doc.md)**, including:

- All endpoint specifications
- Request/response examples
- Authentication flows
- Rate limits & daily caps
- Error handling

**For frontend developers:** See [doc.md Section 1](./doc.md#1-setup--cors) to get started with CORS setup and token management.

---

## 🛠 Local Development

### Prerequisites
- Node.js 16+
- MongoDB (local or Atlas)
- Environment variables (see below)

### Setup

```bash
# Clone the repo
git clone https://github.com/kunle-maker/studybud-backend.git
cd studybud-backend

# Install dependencies
npm install

# Create .env file with required secrets
cp .env.example .env

# Start the server
npm run dev
```

### Required Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/studybud

# OAuth (get these from respective provider dashboards)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# URLs
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=your_random_session_secret

# AI & Services
CLAUDE_API_KEY=your_anthropic_api_key
CLOUDINARY_URL=your_cloudinary_url
YOUTUBE_API_KEY=your_youtube_api_key

# Payment
SMARTCASH_ACCOUNT=account_number
SMARTCASH_BANK_CODE=bank_code

# Admin (optional for local testing)
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=secure_password
```

---

## 📁 Project Structure

```
src/
├── routes/          # API endpoints
│   ├── auth.js      # OAuth & login
│   ├── summaries.js # AI summaries
│   ├── teacher.js   # Teacher chat
│   ├── topics.js    # Topic explanations
│   ├── ocr.js       # OCR processing
│   ├── assignments/ # Collaborative assignments
│   └── roadmaps.js  # Learning roadmaps
├── models/          # MongoDB schemas
├── controllers/     # Business logic
├── middleware/      # Auth, validation, rate limiting
├── utils/           # Helpers (AI, payments, etc.)
└── config/          # Configuration files
```

---

## 🔌 Quick API Examples

### Get current user
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://studybud-backend.onrender.com/api/v1/auth/me
```

### Create a summary
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Your study text here"}' \
  https://studybud-backend.onrender.com/api/v1/summaries
```

### Ask the teacher
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"What is photosynthesis?"}' \
  https://studybud-backend.onrender.com/api/v1/teacher/ask
```

→ **Full API documentation:** See [doc.md](./doc.md)

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Use ESLint (run `npm run lint`)
- Follow Express.js best practices
- Add tests for new features

---

## 📋 Roadmap

- [x] OAuth authentication (Google, GitHub, Telegram)
- [x] AI summaries, flashcards, quizzes
- [x] Teacher chat with multi-turn conversation
- [x] OCR text extraction
- [x] Topic roadmaps with prerequisites
- [x] Collaborative assignments with comments
- [x] Premium subscription system
- [ ] Real-time collaboration (WebSockets)
- [ ] AI study group chats
- [ ] Integration with popular note-taking apps

---

## 🐛 Bug Reports & Feature Requests

Found a bug or have an idea? Open an [Issue](https://github.com/kunle-maker/studybud-backend/issues) and let us know!

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.

---

## 👨‍💻 Author

**Ayokunle**  
Building tools to make learning smarter and faster.

---

## 🙏 Acknowledgments

- [Anthropic Claude](https://claude.ai) — powering our AI explanations
- [Passport.js](http://www.passportjs.org/) — seamless OAuth
- [MongoDB](https://www.mongodb.com/) — reliable data storage
- All our amazing users and testers

---

**Questions?** Check out the full [API Documentation](./doc.md) or reach out to the team!

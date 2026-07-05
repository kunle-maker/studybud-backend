# StudyFlow API — Frontend Integration Guide

> **Author:** Ayokunle  
> **Backend base URL:** `https://studybud-backend.onrender.com`  
> **API prefix:** `/api/v1`  
> **Payment page:** `https://studybud-backend.onrender.com/pay`

---

## Table of Contents

1. [Setup & CORS](#1-setup--cors)
2. [Authentication — OAuth Overview](#2-authentication--oauth-overview)
3. [GitHub Login](#4-github-login)
4. [Telegram Login Widget](#5-telegram-login-widget)
5. [The `/auth/callback` Page You Must Build](#6-the-authcallback-page-you-must-build)
6. [Token Storage & Authenticated Requests](#7-token-storage--authenticated-requests)
7. [User & Profile](#8-user--profile)
8. [AI Summaries](#9-ai-summaries)
9. [AI Teacher Chat](#10-ai-teacher-chat)
10. [Topic Explanation](#11-topic-explanation)
11. [OCR — Extract Text from Images](#12-ocr--extract-text-from-images)
12. [Study Tools — Flashcards & Quizzes](#13-study-tools--flashcards--quizzes)
13. [YouTube Video Search](#14-youtube-video-search)
14. [Premium Subscription](#15-premium-subscription)
15. [Rate Limits & Daily Caps](#16-rate-limits--daily-caps)
16. [Standard Response Shape](#17-standard-response-shape)
17. [Error Reference](#18-error-reference)
18. [Topic Roadmaps (Phase 5)](#19-topic-roadmaps-phase-5)
19. [Collaborative Assignments (Phase 6a)](#20-collaborative-assignments-phase-6a)
20. [Admin — User Management (Phase 12)](#21-admin--user-management-phase-12)

---

## 1. Setup & CORS

The backend accepts requests only from the origins listed in `ALLOWED_ORIGINS`. Make sure your frontend domain is added there. All requests that send an `Authorization` header must include `credentials: 'include'` (or Axios equivalent) **only** if you use cookies — for header-based JWT auth you do not need it.

---

## 2. Authentication — OAuth Overview

StudyFlow uses **three OAuth providers**. There is no email/password sign-up form. All three flows end up delivering a JWT `accessToken` and `refreshToken` to your frontend. Tokens **never expire** — store them and use them indefinitely until the user explicitly logs out.

| Provider | Flow type | How frontend triggers it |
|---|---|---|
| Google | Server-side redirect (passport) | Redirect browser to backend URL |
| GitHub | Server-side redirect (passport) | Redirect browser to backend URL |
| Telegram | Widget → POST to backend | Embed Telegram widget, send data to backend |

---

## 4. GitHub Login

Identical flow to Google — just a different URL:

```js
window.location.href = 'https://studybud.qzz.io/api/v1/auth/github';
```

After the OAuth dance, the backend redirects to the same `/auth/callback` page with the same query parameters.

---

## 5. Telegram Login Widget

Telegram works differently — the widget runs inside your frontend page and collects the user's data client-side. You then POST that data to the backend for verification.

### Step 1 — Embed the Telegram widget

Add this anywhere in your HTML (swap in your bot username):

```html
<script
  async
  src="https://telegram.org/js/telegram-widget.js?22"
  data-telegram-login="YOUR_BOT_USERNAME"
  data-size="large"
  data-onauth="onTelegramAuth(user)"
  data-request-access="write">
</script>
```

### Step 2 — Handle the callback in JS

```js
async function onTelegramAuth(telegramUser) {
  // telegramUser = { id, first_name, last_name, username, photo_url, auth_date, hash }
  try {
    const res = await fetch('https://studybud-backend.onrender.com/api/v1/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telegramUser)
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem('accessToken',  data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      // Navigate to your app
      window.location.href = '/dashboard';
    } else {
      console.error('Telegram auth failed:', data.message);
    }
  } catch (err) {
    console.error('Network error:', err);
  }
}
```

### Telegram POST response

```
POST /api/v1/auth/telegram
Content-Type: application/json
Body: { id, first_name, last_name?, username?, photo_url?, auth_date, hash }
```

**Success `200`**
```json
{
  "success": true,
  "message": "Logged in with Telegram",
  "data": {
    "user": {
      "id": "664abc...",
      "name": "Ada Lovelace",
      "role": "free",
      "profilePicture": "https://t.me/i/userpic/..."
    },
    "accessToken":  "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

**Failure `401`**
```json
{ "success": false, "message": "Invalid Telegram auth data" }
```

---

## 6. The `/auth/callback` Page You Must Build

For **Google and GitHub** logins, the backend redirects the user to:

```
https://studybud.qzz.io/auth/callback?accessToken=xxx&refreshToken=xxx&userId=xxx&name=xxx&role=free
```

You **must** create a page at this route. All it needs to do is read the query params, save the tokens, and redirect to the app. Here is a complete minimal example:

```js
// React — pages/AuthCallback.jsx (or whatever router you use)
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const error = params.get('error');
    if (error) {
      console.error('OAuth error:', error);
      navigate('/login?error=' + encodeURIComponent(error));
      return;
    }

    const accessToken  = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const user = {
      id:   params.get('userId'),
      name: params.get('name'),
      role: params.get('role')
    };

    if (!accessToken) {
      navigate('/login?error=missing_token');
      return;
    }

    localStorage.setItem('accessToken',  accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));

    navigate('/dashboard');
  }, []);

  return <p>Signing you in...</p>;
}
```

**For popup-based login**, use `window.opener` instead:

```js
// Inside AuthCallback when opened as a popup
const params = new URLSearchParams(window.location.search);
if (window.opener) {
  window.opener.postMessage({
    type: 'OAUTH_SUCCESS',
    accessToken:  params.get('accessToken'),
    refreshToken: params.get('refreshToken'),
    user: {
      id:   params.get('userId'),
      name: params.get('name'),
      role: params.get('role')
    }
  }, '*');
  window.close();
}
```

Then in the main app:
```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'OAUTH_SUCCESS') {
    const { accessToken, refreshToken, user } = e.data;
    localStorage.setItem('accessToken',  accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    // Update your auth state / navigate
  }
});
```

---

## 7. Token Storage & Authenticated Requests

### Storage

```js
// After any login:
localStorage.setItem('accessToken',  data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);
localStorage.setItem('user', JSON.stringify(data.user));
```

### Every authenticated request

Send the token in the `Authorization` header:

```js
const token = localStorage.getItem('accessToken');

const res = await fetch('https://studybud-backend.onrender.com/api/v1/summaries', {
  method: 'POST',
  headers: {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ text: '...' })
});
```

Tokens **never expire**, so there is no need to refresh them automatically. If you receive a `401`, the user has been deleted or logged out — send them back to the login screen.

### Recommended fetch wrapper

```js
const API = 'https://studybud-backend.onrender.com/api/v1';

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('accessToken');

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const data = await res.json();

  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/login';
    return;
  }

  return data;
}
```

### Logout

```
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>
```

On the frontend:
```js
await apiFetch('/auth/logout', { method: 'POST' });
localStorage.clear();
window.location.href = '/login';
```

### Get current user

```
GET /api/v1/auth/me
Authorization: Bearer <accessToken>
```

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "664abc...",
      "name": "Ada",
      "email": "ada@gmail.com",
      "role": "free",
      "profilePicture": "https://...",
      "authProvider": "google"
    }
  }
}
```

---

## 8. User & Profile

### Get profile + today's usage

```
GET /api/v1/users/profile
Authorization: Bearer <accessToken>
```

```json
{
  "success": true,
  "data": {
    "id": "664abc...",
    "name": "Ada",
    "email": "ada@gmail.com",
    "role": "free",
    "profilePicture": "https://...",
    "authProvider": "google",
    "usageStats": {
      "summariesToday": 2,
      "teacherQuestionsToday": 1,
      "topicExplanationsToday": 0,
      "ocrToday": 0,
      "lastReset": "2025-06-01T00:00:00.000Z"
    },
    "createdAt": "2025-05-01T10:00:00.000Z"
  }
}
```

### Update name

```
PATCH /api/v1/users/profile
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "name": "Ada Lovelace" }
```

### Upload avatar

```
PATCH /api/v1/users/profile/picture
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

| Field | Type | Max size |
|---|---|---|
| `avatar` | file (JPG/PNG/WebP) | 5 MB |

Returns updated user with new `profilePicture` URL.

### Daily usage stats

```
GET /api/v1/users/usage
Authorization: Bearer <accessToken>
```

```json
{
  "success": true,
  "data": {
    "role": "free",
    "usageStats": {
      "summariesToday": 2,
      "teacherQuestionsToday": 1,
      "topicExplanationsToday": 0,
      "ocrToday": 0
    },
    "limits": {
      "summaries": 5,
      "teacher": 5,
      "topic": 5,
      "ocr": 5
    }
  }
}
```

> Premium users get `"limits": { "summaries": "Unlimited", ... }`

### Study history (paginated)

```
GET /api/v1/users/history?page=1&limit=20
Authorization: Bearer <accessToken>
```

### Dashboard summary

```
GET /api/v1/users/dashboard
Authorization: Bearer <accessToken>
```

Returns total counts (summaries, chats, OCR uploads) and the 5 most recent activities.

### Delete account

```
DELETE /api/v1/users/account
Authorization: Bearer <accessToken>
```

Permanently deletes the user and all their data.

---

## 9. AI Summaries

> **Free limit:** 5 per day · **Premium:** Unlimited

```
POST /api/v1/summaries
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "text": "Your study text here — min 10 chars, max 5000 chars" }
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "664xyz...",
    "summary": "This text covers...",
    "originalLength": 1200,
    "summaryLength": 280
  }
}
```

### History

```
GET /api/v1/summaries/history
Authorization: Bearer <accessToken>
```

---

## 10. AI Teacher Chat

> **Free limit:** 5 questions per day · **Premium:** Unlimited

Multi-turn conversation. Pass `chatId` after the first message to continue the thread.

```
POST /api/v1/teacher/ask
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**First message**
```json
{ "question": "What is the difference between mitosis and meiosis?" }
```

**Follow-up**
```json
{ "question": "Give me a memory trick for that.", "chatId": "664abc..." }
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "chatId": "664abc...",
    "answer": "Great question! Mitosis produces..."
  }
}
```

### History

```
GET /api/v1/teacher/history
Authorization: Bearer <accessToken>
```

---

## 11. Topic Explanation

> **Free limit:** 5 per day · **Premium:** Unlimited

### Explain a topic

```
POST /api/v1/topics/explain
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "topic": "Quantum entanglement" }
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "chatId": "664def...",
    "explanation": "## Brief Overview\n..."
  }
}
```

### Request a better / simpler explanation

```
POST /api/v1/topics/better
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "chatId": "664def...", "question": "Explain it like I'm 12" }
```

**Response** — same shape, field is `betterExplanation`.

---

## 12. OCR — Extract Text from Images

> **Free limit:** 5 uploads per day · **Premium:** Unlimited

```
POST /api/v1/ocr/process
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

| Field | Type | Notes |
|---|---|---|
| `image` | file (JPG/PNG/WebP) | Max 5 MB |
| `processedFor` | string (optional) | Label, e.g. `"flashcards"` |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "664ghi...",
    "extractedText": "Chapter 3: Cell Division...",
    "imageUrl": "https://res.cloudinary.com/...",
    "charCount": 842
  }
}
```

### History

```
GET /api/v1/ocr/history
Authorization: Bearer <accessToken>
```

---

## 13. Study Tools — Flashcards & Quizzes

> Shares the **summaries** daily limit (5/day free)

### Generate flashcards

```
POST /api/v1/study-tools/flashcards
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "text": "Study material...", "count": 10 }
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "flashcards": [
      { "question": "What is osmosis?", "answer": "The movement of water..." }
    ],
    "count": 10
  }
}
```

### Generate quiz

```
POST /api/v1/study-tools/quiz
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "text": "Study material...", "questionCount": 5 }
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "quiz": [
      {
        "question": "Which process produces 4 haploid cells?",
        "options": ["A. Mitosis", "B. Meiosis", "C. Budding", "D. Fission"],
        "correctAnswer": "B. Meiosis",
        "explanation": "Meiosis undergoes two divisions..."
      }
    ],
    "questionCount": 5
  }
}
```

> **Important:** `correctAnswer` is the **full option string** (e.g. `"B. Meiosis"`), identical to one of the entries in `options`. Compare directly:
> ```js
> const isCorrect = selectedOption === question.correctAnswer;
> ```

### Summarise OCR text

```
POST /api/v1/study-tools/ocr-summary
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "extractedText": "Chapter 3: Cell Division..." }
```

---

## 14. YouTube Video Search

```
GET /api/v1/videos/search?topic=photosynthesis&maxResults=5
Authorization: Bearer <accessToken>
```

| Param | Type | Default | Notes |
|---|---|---|---|
| `topic` | string | required | Search query |
| `maxResults` | number | 5 | 1–10 |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "videoId": "WTLtlH7OJzQ",
        "title": "Photosynthesis — Crash Course",
        "description": "...",
        "thumbnail": "https://i.ytimg.com/vi/WTLtlH7OJzQ/hqdefault.jpg",
        "channelTitle": "CrashCourse",
        "publishedAt": "2012-08-27T...",
        "url": "https://www.youtube.com/watch?v=WTLtlH7OJzQ"
      }
    ],
    "totalResults": 5
  }
}
```

Embed a video:
```html
<iframe
  src="https://www.youtube.com/embed/WTLtlH7OJzQ"
  allowfullscreen>
</iframe>
```

---

## 15. Premium Subscription

Premium is **₦1,000 / 30 days** via SmartCash MFB bank transfer. A user sends money, takes a screenshot, and the backend AI verifies it automatically.

### The flow

```
1. Frontend redirects user to /pay?token=<accessToken>
2. User makes bank transfer → takes screenshot
3. User uploads screenshot on /pay — AI reads and verifies it
4. Backend upgrades user role to "premium"
5. Frontend calls GET /api/v1/subscriptions/status to confirm
```

### Redirect to payment page

```js
const token = localStorage.getItem('accessToken');
window.location.href =
  `https://studybud-backend.onrender.com/pay?token=${token}`;
```

Or open in a new tab:
```js
window.open(
  `https://studybud-backend.onrender.com/pay?token=${token}`,
  '_blank'
);
```

### Check subscription status

Call this after redirecting back from `/pay` to confirm the upgrade:

```
GET /api/v1/subscriptions/status
Authorization: Bearer <accessToken>
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "role": "premium",
    "isPremium": true,
    "subscription": {
      "status": "active",
      "startDate": "2025-06-01T10:00:00.000Z",
      "expiresAt": "2025-07-01T10:00:00.000Z",
      "daysRemaining": 29
    }
  }
}
```

### Get bank details (optional — already shown on /pay)

```
GET /api/v1/subscriptions/payment-details
Authorization: Bearer <accessToken>
```

---

## 16. Rate Limits & Daily Caps

### Global rate limit

**200 requests per 15 minutes** per IP. Returns `429` if exceeded.

### Auth rate limit

**20 requests per 15 minutes** on `/auth/telegram` (and legacy `/auth/login`, `/auth/register`).

### AI rate limit

**30 requests per minute** on all AI-heavy routes.

### Daily feature caps (resets midnight UTC)

| Feature | Endpoint | Free | Premium |
|---|---|---|---|
| Summaries | `POST /summaries` | 5/day | Unlimited |
| Flashcards | `POST /study-tools/flashcards` | 5/day | Unlimited |
| Quizzes | `POST /study-tools/quiz` | 5/day | Unlimited |
| OCR summary | `POST /study-tools/ocr-summary` | 5/day | Unlimited |
| Teacher | `POST /teacher/ask` | 5/day | Unlimited |
| Topic explain | `POST /topics/explain` | 5/day | Unlimited |
| OCR uploads | `POST /ocr/process` | 5/day | Unlimited |

**When a cap is hit:**
```json
{
  "success": false,
  "message": "Daily limit of 5 summaries reached. Upgrade to premium.",
  "limitReached": true,
  "feature": "summaries",
  "used": 5,
  "limit": 5
}
```

Show an upgrade CTA when `limitReached === true`.

---

## 17. Standard Response Shape

Every endpoint returns:

```json
{
  "success": true,
  "message": "Human-readable text",
  "data": { }
}
```

Paginated responses include:

```json
{
  "success": true,
  "data": { "items": [...] },
  "pagination": { "total": 42, "page": 1, "limit": 20, "pages": 3 }
}
```

---

## 18. Error Reference

| HTTP | When |
|---|---|
| `400` | Missing field, validation error, receipt rejected |
| `401` | Missing/invalid token, or user no longer exists |
| `403` | Feature requires Premium |
| `404` | Resource not found |
| `409` | Conflict (e.g. email already registered) |
| `429` | Rate limit or daily cap hit |
| `500` | Unexpected server error |

---

## New Secrets You Need to Add in Replit

Three more environment secrets are required for OAuth to work in production:

| Secret | Value |
|---|---|
| `BACKEND_URL` | `https://studybud-backend.onrender.com` |
| `FRONTEND_URL` | Your frontend's deployed URL (e.g. `https://studyflow-app.vercel.app`) |
| `SESSION_SECRET` | Any long random string (used only for the 10-min OAuth handshake cookie) |

---

---

## 19. Topic Roadmaps (Phase 5)

Roadmaps are structured curricula with ordered lessons, difficulty levels, and prerequisite gating. A lesson is **locked** until all its prerequisites are completed. Progress is tracked per-user.

### List all roadmaps

```
GET /api/v1/roadmaps
Authorization: Bearer <accessToken>
```

Optional query param: `?subject=mathematics`

```json
{
  "success": true,
  "data": [
    {
      "_id": "664...",
      "title": "Introduction to Mathematics",
      "subject": "mathematics",
      "description": "...",
      "difficulty": "beginner",
      "lessonCount": 12,
      "totalMinutes": 180
    }
  ]
}
```

### Get a roadmap (with lesson status for the current user)

```
GET /api/v1/roadmaps/:id
Authorization: Bearer <accessToken>
```

Each lesson in the response includes `completed`, `locked`, and `prerequisites` fields:

```json
{
  "success": true,
  "data": {
    "_id": "664...",
    "title": "Introduction to Mathematics",
    "subject": "mathematics",
    "difficulty": "beginner",
    "lessons": [
      {
        "_id": "lesson1id",
        "title": "Numbers & Place Value",
        "description": "...",
        "estimatedMinutes": 20,
        "difficulty": "beginner",
        "prerequisites": [],
        "order": 0,
        "completed": true,
        "locked": false
      },
      {
        "_id": "lesson2id",
        "title": "Addition & Subtraction",
        "prerequisites": ["lesson1id"],
        "completed": false,
        "locked": false
      }
    ],
    "progress": {
      "completed": 1,
      "total": 12,
      "percentage": 8,
      "startedAt": "2025-06-01T10:00:00.000Z",
      "lastActivityAt": "2025-06-02T08:00:00.000Z"
    }
  }
}
```

### Mark a lesson complete

```
POST /api/v1/roadmaps/:roadmapId/lessons/:lessonId/complete
Authorization: Bearer <accessToken>
```

Returns `400` if the lesson is still locked (prerequisites not finished).

```json
{
  "success": true,
  "data": { "lessonId": "...", "completed": 2, "total": 12, "percentage": 17 }
}
```

### Unmark a lesson (allow re-doing)

```
DELETE /api/v1/roadmaps/:roadmapId/lessons/:lessonId/complete
Authorization: Bearer <accessToken>
```

### My overall roadmap progress

```
GET /api/v1/roadmaps/my-progress
Authorization: Bearer <accessToken>
```

Returns all roadmaps the user has started with completion percentages.

### Admin — create / update / delete roadmaps

These require an admin JWT (`isAdmin: true`).

```
POST   /api/v1/roadmaps         — create
PUT    /api/v1/roadmaps/:id     — replace all lessons
DELETE /api/v1/roadmaps/:id     — delete + wipe all user progress
```

**Create body:**
```json
{
  "title": "Introduction to Physics",
  "subject": "physics",
  "description": "...",
  "difficulty": "beginner",
  "lessons": [
    {
      "title": "Forces & Motion",
      "description": "...",
      "estimatedMinutes": 25,
      "difficulty": "beginner",
      "prerequisites": [],
      "order": 0
    }
  ]
}
```

> **Prerequisite rule:** every ID listed in `prerequisites` must be the `_id` of another lesson in the same request payload. The backend validates this and returns `400` if any are invalid.

---

## 20. Collaborative Assignments (Phase 6a)

Assignments can be shared with classmates via invite-by-email or a share link. Collaborators can comment, @mention teammates, and resolve comment threads.

### Create an assignment

```
POST /api/v1/assignments
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "title": "Chapter 5 Problems", "description": "...", "dueDate": "2025-07-15T00:00:00.000Z" }
```

### List my assignments

```
GET /api/v1/assignments
Authorization: Bearer <accessToken>
```

Optional: `?status=open|in_progress|completed&page=1&limit=20`

### Get a single assignment

```
GET /api/v1/assignments/:id
Authorization: Bearer <accessToken>
```

Returns the full document with collaborators, comments, and populated user references.

### Update an assignment

```
PATCH /api/v1/assignments/:id
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "title": "...", "description": "...", "dueDate": "...", "status": "in_progress" }
```

Creator and editor-role collaborators only.

### Delete an assignment

```
DELETE /api/v1/assignments/:id
Authorization: Bearer <accessToken>
```

Creator only.

---

### Share links

**Enable / refresh share link (creator only):**
```
POST /api/v1/assignments/:id/share
Authorization: Bearer <accessToken>

{ "enabled": true }
```

Response includes `shareToken` (embed in a URL like `https://yourapp.com/assignments/join/<token>`).

**Disable:**
```json
{ "enabled": false }
```

**Join via share link:**
```
POST /api/v1/assignments/join/:token
Authorization: Bearer <accessToken>
```

Adds the current user as an editor collaborator.

---

### Invite by email

```
POST /api/v1/assignments/:id/invite
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "email": "classmate@example.com", "role": "editor" }
```

`role` is `"editor"` (default) or `"viewer"`.

**Remove a collaborator:**
```
DELETE /api/v1/assignments/:id/collaborators/:userId
Authorization: Bearer <accessToken>
```

Creator can remove anyone; collaborators can remove themselves.

---

### Comments & @mentions

**Add a comment:**
```
POST /api/v1/assignments/:id/comments
Authorization: Bearer <accessToken>

{ "content": "Hey @Ada, can you check question 3?" }
```

`@Name` patterns in the content are automatically resolved to user IDs and stored in the `mentions` array.

**Resolve / unresolve a comment (creator or editors only):**
```
PATCH /api/v1/assignments/:id/comments/:commentId/resolve
Authorization: Bearer <accessToken>
```

Toggles `resolved` state.

**Delete a comment:**
```
DELETE /api/v1/assignments/:id/comments/:commentId
Authorization: Bearer <accessToken>
```

Comment author or assignment creator only.

---

### Activity log

```
GET /api/v1/assignments/:id/activity?page=1&limit=20
Authorization: Bearer <accessToken>
```

Returns a paginated list of timestamped actions (created, updated, commented, invited, joined, resolved_comment, etc.) with the actor's name and avatar.

---

## 21. Admin — User Management (Phase 12)

All admin endpoints require `Authorization: Bearer <adminToken>` from an account with `isAdmin: true`.

### Admin login

The admin credentials are set via environment variables on the server (`ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`). Never hardcoded.

```
POST /api/v1/auth/admin-login
Content-Type: application/json

{ "email": "admin@example.com", "password": "your-seed-password" }
```

Response is the same shape as regular login, with `isAdmin: true` in the user object.

### List all users

```
GET /api/v1/admin/users?page=1&limit=30&role=free&search=ada
Authorization: Bearer <adminToken>
```

### Get a single user's detail

```
GET /api/v1/admin/users/:userId
Authorization: Bearer <adminToken>
```

Returns user profile + their last 10 subscriptions.

### Grant premium manually

```
POST /api/v1/admin/users/:userId/grant-premium
Authorization: Bearer <adminToken>
Content-Type: application/json

{ "days": 30 }
```

### Delete a user

```
DELETE /api/v1/admin/users/:userId
Authorization: Bearer <adminToken>
```

Deletes the user and cancels their subscriptions. Cannot delete another admin account.

### New env vars required (deploy secrets)

| Var | Purpose |
|---|---|
| `ADMIN_SEED_EMAIL` | Email for the admin account (replaces old `ADMIN_EMAIL`) |
| `ADMIN_SEED_PASSWORD` | Password for the admin account — hashed and stored; never logged |
| `ADMIN_SEED_NAME` | Display name for the admin (optional, defaults to `"Admin"`) |

> **Migration note:** if you previously used `ADMIN_EMAIL`, rename it to `ADMIN_SEED_EMAIL` in your Render / deployment secrets.

---

*StudyFlow API · Built by Ayokunle · June 2025 — updated with Phase 5/6a/12 endpoints*

## Plan: Manga Reading App — MangaKhongMuot

### Goal
Build a React + TypeScript + Vite manga reader with scroll/left-right modes, a Telegram-bot-backed Cloudflare Worker storage layer, and a password-protected upload panel ("Architecture" tab).

---

### System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│          React + TypeScript + Vite                   │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────────┐  │
│  │   Home    │ │  Reader  │ │   Architecture Tab  │  │
│  │ Story List│ │Scroll/LR │ │   (Upload Panel)    │  │
│  └────┬─────┘ └────┬─────┘ └──────────┬──────────┘  │
│       └────────────┼──────────────────┘              │
│                    │ HTTP API Calls                   │
└────────────────────┼─────────────────────────────────┘
                     │
┌────────────────────┼─────────────────────────────────┐
│         Cloudflare Worker (API Gateway)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐  │
│  │  CRUD     │ │  Image   │ │  Auth Middleware     │  │
│  │ Handlers  │ │  Proxy   │ │  (simple password)   │  │
│  └────┬─────┘ └────┬─────┘ └──────────────────────┘  │
│       │            │                                   │
│  ┌────▼────────────▼─────┐  ┌──────────────────────┐  │
│  │   Cloudflare KV/D1    │  │  Telegram Bot API    │  │
│  │   (metadata store)    │  │  (image storage)     │  │
│  └───────────────────────┘  └──────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

**Data flow (upload):** Browser → Worker → Telegram Bot API (stores image) → Worker saves `file_id` + metadata to KV/D1.

**Data flow (read):** Browser → Worker → KV/D1 (metadata) + Worker proxies image from Telegram.

---

### Project Structure

```
manga-khong-muot/
├── package.json              # Workspace root
├── frontend/                 # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── Reader/
│   │   │   │   ├── Reader.tsx           # Mode switcher (scroll/LR)
│   │   │   │   ├── ScrollReader.tsx     # Vertical scroll mode
│   │   │   │   └── LeftRightReader.tsx  # Page-by-page mode
│   │   │   ├── Layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   └── BottomNav.tsx
│   │   │   ├── Home/
│   │   │   │   └── StoryCard.tsx
│   │   │   ├── Story/
│   │   │   │   └── ChapterList.tsx
│   │   │   ├── Upload/
│   │   │   │   ├── Architecture.tsx     # Main upload page with password gate
│   │   │   │   ├── PasswordGate.tsx
│   │   │   │   ├── StoryForm.tsx        # Create new story
│   │   │   │   └── ChapterForm.tsx      # Add chapter to existing story
│   │   │   └── Common/
│   │   │       ├── LazyImage.tsx        # Progressive loading image
│   │   │       ├── Skeleton.tsx
│   │   │       └── Toast.tsx
│   │   ├── hooks/
│   │   │   ├── useManga.ts              # Data fetching hooks
│   │   │   ├── useReader.ts             # Reading state (mode, page, preload)
│   │   │   └── usePrefetch.ts           # Smart image preloading
│   │   ├── services/
│   │   │   └── api.ts                   # Worker API client
│   │   ├── types/
│   │   │   └── index.ts                 # Story, Chapter, Page types
│   │   ├── utils/
│   │   │   └── image.ts                 # Image optimization helpers
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
├── worker/                  # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts          # Router entry point
│   │   ├── handlers/
│   │   │   ├── stories.ts    # GET/POST /api/stories
│   │   │   ├── chapters.ts   # GET/POST /api/stories/:id/chapters
│   │   │   ├── pages.ts      # GET /api/images/:fileId (proxy)
│   │   │   └── upload.ts     # POST /api/upload (multipart)
│   │   ├── middleware/
│   │   │   └── auth.ts       # Simple password check
│   │   ├── services/
│   │   │   └── telegram.ts   # Telegram Bot API client
│   │   ├── store/
│   │   │   └── kv.ts         # KV/D1 data access layer
│   │   └── types.ts
│   ├── wrangler.toml
│   ├── package.json
│   └── tsconfig.json
└── telegram-bot/            # (optional) Separate bot for ingest
```

---

**Password (simple logic):** No authentication system. The Architecture tab checks the stored password (default `"admin2k08"`) entirely on the client side. Password is fetched from KV via a public API endpoint on page load, compared against user input in `sessionStorage`. Changeable via a settings field in the Architecture panel — PATCH request updates the value in KV. No tokens, no sessions, no server-side auth checks.

### Data Models

```typescript
// Stored in KV/D1
interface Story {
  id: string          // Special sort ID (user-defined, e.g. "S001")
  title: string
  coverFileId: string // Telegram file_id for cover image
  description: string
  status: 'ongoing' | 'completed' | 'hiatus'
  createdAt: number
  updatedAt: number
}

interface Chapter {
  id: string
  storyId: string
  title: string
  number: number
  pageCount: number
  createdAt: number
}

interface PageRecord {
  id: string
  chapterId: string
  storyId: string
  fileId: string     // Telegram file_id
  pageNumber: number
  width: number
  height: number
  format: 'jpg'|'png'|'webp'
  fileSize: number
}
```

**KV key design:**
- `story:{id}` → Story JSON
- `story:list` → sorted array of story IDs
- `chapter:{storyId}:{chapterId}` → Chapter JSON
- `chapter:list:{storyId}` → sorted array of chapter IDs
- `page:{chapterId}:{pageNumber}` → PageRecord JSON
- `page:list:{chapterId}` → array of page IDs
- `config:password` → hashed password string

**Special ID sorting:** Stories are stored with user-defined IDs like `S001`, `S002`, or custom strings. The `story:list` key maintains the sort order as an ordered array.

---

### API Endpoints (Cloudflare Worker)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stories` | List all stories (sorted by special ID) |
| GET | `/api/stories/:id` | Get story details + chapter list |
| GET | `/api/chapters/:storyId/:chapterId` | Get chapter with page metadata |
| GET | `/api/images/:fileId` | Proxy image from Telegram (with caching) |
| POST | `/api/upload/story` | Create new story (metadata) |
| POST | `/api/upload/chapter` | Create new chapter (metadata) |
| POST | `/api/upload/pages` | Upload pages (multipart, max 70 files) |
| PATCH | `/api/chapters/:storyId/:chapterId/reorder` | Reorder chapters by swapping `number` values |
| PATCH | `/api/stories/:id/reorder` | Reorder stories in the sorted list |
| GET | `/api/config` | Get public config (password, etc.) |
| PATCH | `/api/config/password` | Change password (simple KV write) |

---

### Reading Modes — UX Design

**Scroll Mode:**
- Images rendered vertically, full-width with `max-width: 100%`
- Intersection Observer triggers lazy loading
- Smooth scroll behavior
- Shows current position indicator
- Tap left/right edges of screen for prev/next chapter navigation

**Left-Right Mode:**
- Single page view, centered
- Tap/swipe left → next page, right → previous page
- Keyboard arrows support (← →)
- Page transition animation (slide)
- Shows page counter "12/184"
- Optional: fit width / fit height toggle

**Mode switching:**
- Toggle button in reader header
- Preference saved to localStorage

---

### Performance Strategy (Potato Internet: 800KB/s–5MB/s)

1. **Progressive images** — LazyImage component renders a tiny blur placeholder (CSS blur on 20px resized version embedded as base64 data URI), then loads full image.
2. **Smart preloading** — In scroll mode, preload images within 2 viewports ahead. In LR mode, preload next 3 pages.
3. **Responsive serving** — Worker uses `Accept` header to serve WebP when supported. Image proxy queries Telegram's `getFile` and streams with appropriate `Content-Type`.
4. **Aggressive caching** — Images served with `Cache-Control: public, max-age=31536000, immutable`. Worker uses Cloudflare's Cache API. Service Worker caches metadata responses.
5. **Skeleton UI** — Story cards and chapter lists show skeleton loaders (pulsing gray blocks) while data loads.
6. **Connection-aware** — Detect slow connections via `navigator.connection.effectiveType` and reduce preload depth dynamically.
7. **Image size optimization** — All uploaded images are validated for format (jpg/png/webp only). No client-side resizing — Telegram handles compression.
8. **Batch requests** — Chapter list fetched in one call. Page metadata batched per chapter.

---

### Upload Flow (Architecture Tab)

1. User navigates to `/architecture`
2. Shows `PasswordGate` component (unless password is already in sessionStorage)
3. On correct password → sessionStorage.setItem('arch-auth', 'true') for 1 hour
4. Two modes:
   - **Create Story**: title, special ID, description, cover image, status
   - **Add Chapter**: select story from dropdown, chapter title/number, upload pages (70 max, jpg/png/webp only)
5. File upload: drag-and-drop or file picker with client-side validation (format + count, max 70 files)
6. Upload progress bar per file with stagger delays (~3s interval between Telegram API calls)
7. Worker receives files → sends each to Telegram via `sendDocument` with stagger delays → stores file_ids + metadata in KV
8. **Chapter reordering**: In the Architecture tab, show a drag-handle on each chapter. User can drag to reorder; PATCH endpoint swaps `number` values in KV atomically.

---

### Changes (File-by-File)

#### Phase 1 — Project Scaffold & Types
1. **`package.json`** (root) — Workspace config with `frontend` + `worker` workspaces
2. **`frontend/package.json`** — React 19, TypeScript, Vite, Tailwind CSS v4, react-router-dom v7, react-dropzone
3. **`frontend/vite.config.ts`** — Vite config with React plugin, proxy for dev
4. **`frontend/tsconfig.json`** — Strict TS config
5. **`frontend/tailwind.config.js`** — Minimal design tokens (dark theme)
6. **`frontend/index.html`** — Root HTML
7. **`frontend/src/types/index.ts`** — All TypeScript interfaces
8. **`frontend/src/main.tsx`** — App entry with Router
9. **`frontend/src/App.tsx`** — Routes: `/`, `/story/:id`, `/reader/:storyId/:chapterId`, `/architecture`

#### Phase 2 — Worker Backend
10. **`worker/package.json`** — hono (router), @hono/zipkin (optional)
11. **`worker/wrangler.toml`** — KV namespace binding, env vars (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ADMIN_PASSWORD)
12. **`worker/src/types.ts`** — Shared types
13. **`worker/src/services/telegram.ts`** — `sendPhoto(file)`, `getFile(fileId)` wrappers
14. **`worker/src/store/kv.ts`** — Read/write helpers for KV
15. **`worker/src/handlers/config.ts`** — GET/PATCH password config (no server auth, just a simple KV read/write)
16. **`worker/src/handlers/stories.ts`** — Story CRUD
17. **`worker/src/handlers/chapters.ts`** — Chapter CRUD
18. **`worker/src/handlers/pages.ts`** — Image proxy handler
19. **`worker/src/handlers/upload.ts`** — Multipart upload handler
20. **`worker/src/index.ts`** — Router wiring

#### Phase 3 — Frontend Pages & Components
21. **`frontend/src/services/api.ts`** — Fetch wrapper with base URL, error handling
22. **`frontend/src/index.css`** — Tailwind base + custom CSS (dark theme, scrollbar)
23. **`frontend/src/components/Layout/Header.tsx`** — App header with nav
24. **`frontend/src/components/Layout/BottomNav.tsx`** — Mobile bottom nav
25. **`frontend/src/components/Home/StoryCard.tsx`** — Story card component
26. **`frontend/src/pages/HomePage.tsx`** — Story grid from API
27. **`frontend/src/pages/StoryPage.tsx`** — Story detail + chapter list
28. **`frontend/src/pages/ReaderPage.tsx`** — Reader container (mode detection)
29. **`frontend/src/pages/ArchitecturePage.tsx`** — Upload page with password gate
30. **`frontend/src/components/Common/LazyImage.tsx`** — Progressive image with blur placeholder
31. **`frontend/src/components/Reader/ScrollReader.tsx`** — Scroll reading mode
32. **`frontend/src/components/Reader/LeftRightReader.tsx`** — Page-by-page reading mode
33. **`frontend/src/components/Upload/PasswordGate.tsx`** — Simple password form
34. **`frontend/src/components/Upload/StoryForm.tsx`** — New story form
35. **`frontend/src/components/Upload/ChapterForm.tsx`** — New chapter + file upload form
36. **`frontend/src/hooks/useManga.ts`** — React Query or custom hooks for data fetching
37. **`frontend/src/hooks/useReader.ts`** — Reader state management
38. **`frontend/src/hooks/usePrefetch.ts`** — Image preloading logic

#### Phase 4 — Polish & Performance
39. **`frontend/src/utils/image.ts`** — Blur placeholder generation, format detection
40. **Service Worker** (optional) — Cache-first for static assets, network-first for API
41. Audit: lazy loading, preloading, skeleton states, mobile touch targets (44x44px)

---

### Guardrails
- [ ] Lint: `npm run lint` — zero warnings (ESLint + TS strict)
- [ ] Build: `npm run build` succeeds for both frontend and worker
- [ ] TypeScript strict mode enabled throughout
- [ ] Vite production build with code splitting
- [ ] Worker passes `wrangler publish --dry-run`
- [ ] Password stored in KV as plaintext (intentionally simple — no auth system)
- [ ] Upload limited to 70 files, validated both client-side and server-side
- [ ] All image requests proxied through worker (bot token never exposed)
- [ ] Service Worker cache invalidation strategy
- [ ] Mobile-first responsive design with touch-friendly targets

---

### Risks / Open Questions
1. **Telegram rate limits** — Telegram API limits `sendPhoto` to ~20 messages/min per chat. For a chapter of 70 pages, upload may take 3.5+ minutes. Mitigation: stagger uploads with delays + per-file progress bar.
2. **Telegram file size limit** — `sendDocument` limit is 50MB. `sendPhoto` compresses images. For high-quality manga pages, may lose detail. Consider `sendDocument` instead for fidelity.
3. **KV free tier** — Cloudflare KV free tier: 100k reads/day, 1k writes/day. D1 has different limits. May need paid plan for active use.
4. **Special ID format** — Need to clarify: is the special ID auto-increment, user-defined string, or timestamp-based? Plan assumes user-defined alphanumeric string.
5. **Image proxy caching** — Must aggressively cache proxied Telegram images on CF edge to avoid repeated fetches from Telegram.

---

### Commits (Suggested Order)

1. `chore: scaffold monorepo with frontend + worker workspaces` — root package.json, dirs
2. `feat: add worker backend with hono + Telegram image service` — worker/ with API endpoints
3. `feat: add frontend shell with routing and tailwind dark theme` — App shell, Header, BottomNav
4. `feat: implement home and story detail pages` — StoryCard, HomePage, StoryPage
5. `feat: implement scroll and left-right reader modes` — ReaderPage, ScrollReader, LeftRightReader
6. `feat: implement architecture tab with upload flow` — PasswordGate, StoryForm, ChapterForm
7. `feat: add progressive image loading and prefetch system` — LazyImage, usePrefetch
8. `perf: optimize for slow connections with skeleton loading` — Skeleton components, connection-aware preload

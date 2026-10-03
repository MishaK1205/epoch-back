# Prompt: add "Saved articles" and "Read articles" to the Angular app

> Copy everything below the line into the AI assistant working on the Angular app.

---

You are working in my **Angular** frontend for the Epoch API (a NestJS backend). The
backend just gained a new feature: every logged-in user has two personal article lists,
**saved** ("read later") and **read**. The backend part is finished and tested. Your job
is to add the typed client layer for it and, where I ask, wire it into the UI.

## 0. Before writing any code

1. Inspect the project. Find the existing API layer: `environment.apiUrl`, the
   `Paginated<T>` interface, `ArticleSummary`, the `toHttpParams()` helper,
   `getApiErrorMessages()`, the auth interceptor, `AuthService` (with `isLoggedIn`), and
   the folder where services and models live (often `src/app/core/`).
2. **Reuse those.** Don't create a second `Paginated`, `ArticleSummary` or HTTP-params
   helper. Follow the project's existing conventions (standalone vs NgModule, `inject()`,
   signals vs RxJS state, naming, file layout). If something listed above doesn't exist,
   create it as described in section 7.
3. Don't invent endpoints, fields or query parameters that aren't in this prompt. Field
   names must match the JSON exactly.
4. No `any`. Strict TypeScript.
5. When finished, run `ng build` (or `npx tsc --noEmit -p tsconfig.app.json`) and fix
   every error.

## 1. What the feature does

- **Saved list:** the user bookmarks an article to read later, and can remove it.
- **Read list:** the user marks an article as read, and can mark it unread again.
- The two lists are **independent**. Marking an article as read does **not** remove it
  from saved. If the UI should do that, call both endpoints (see section 5).
- Only **published** articles can be added. Every article the public site shows is
  published, so any article from `GET /articles` or `GET /articles/:slug` can be added.
- Available to **every logged-in user**, whatever the role (`user`, `moderator`,
  `admin`). Logged-out visitors can't use it; the server returns 401.
- The lists always belong to the user in the token. There is no user id in the URL, and
  nobody can see another user's lists.
- If an author unpublishes an article, it disappears from everyone's lists (and from
  `total`) until it is published again. If an article is deleted, it is removed from all
  lists permanently.

## 2. Base URL and auth

- All URLs are `${environment.apiUrl}/me/...`. Dev: `http://localhost:3000`, production:
  `https://api.epoch.ge`. Never hardcode the host.
- Every endpoint here needs `Authorization: Bearer <accessToken>`. The existing auth
  interceptor already attaches it to requests that go to `environment.apiUrl`, and already
  logs the user out on 401. Don't add headers manually in the service.

## 3. Interfaces

Add this model (e.g. `core/models/reading-list.model.ts`, and export it from the models
barrel if there is one):

```ts
import { ArticleSummary } from './article.model';

/** One entry in the current user's saved or read list. */
export interface ReadingListItem {
  article: ArticleSummary; // always a published article; same shape as GET /articles items
  addedAt: string;         // ISO 8601: when it was saved / marked as read
}

/** Query for both list endpoints. */
export interface ReadingListQuery {
  page?: number;  // integer >= 1, default 1
  limit?: number; // integer 1–100, default 20
}
```

Existing interfaces these depend on (they should already exist, reproduced here for
reference; **don't duplicate them**):

```ts
export interface Paginated<T> {
  items: T[];
  total: number; // total visible items across all pages
  page: number;
  limit: number;
}

export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: ImageSummary | null;
  category: CategorySummary | null;
  tags: string[];
  author: AuthorSummary | null;
  status: 'draft' | 'published'; // always 'published' in these lists
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

List responses are `Paginated<ReadingListItem>`. They contain **no** `content`; link to
`/articles/:slug` (the public article page) to read the article.

## 4. Endpoints

`:id` is the **article id** (`ArticleSummary.id`, a 24-character hex MongoDB id), **not**
the slug.

| Method | Path | Body | Success | Errors |
| --- | --- | --- | --- | --- |
| GET | `/me/saved-articles?page&limit` | — | `200` `Paginated<ReadingListItem>`, newest saved first | 400 invalid `page`/`limit`; 401 |
| PUT | `/me/saved-articles/:id` | **none** | `204` no content | 400 `id must be a mongodb id`; 401; 404 `Article not found` |
| DELETE | `/me/saved-articles/:id` | — | `204` no content | 400; 401 |
| GET | `/me/read-articles?page&limit` | — | `200` `Paginated<ReadingListItem>`, most recently marked first | 400; 401 |
| PUT | `/me/read-articles/:id` | **none** | `204` no content | 400; 401; 404 `Article not found` |
| DELETE | `/me/read-articles/:id` | — | `204` no content | 400; 401 |

Behaviour to rely on:
- **PUT is idempotent.** Saving an article that is already saved returns `204` and keeps
  the original `addedAt`; there is never a duplicate. No need to check first.
- **DELETE is idempotent.** Removing an article that isn't in the list still returns
  `204`. It never returns 404.
- `404 Article not found` on PUT means the article doesn't exist or is not published
  (e.g. it was unpublished after the page loaded).
- Sending a body or unknown query parameters returns 400. Send nothing extra.
- Errors use the usual API shape `{ statusCode, message, error }`; `message` is an array
  for validation errors. Use the existing `getApiErrorMessages()`.

Example `GET /me/saved-articles?page=1&limit=20` response:

```json
{
  "items": [
    {
      "article": {
        "id": "66f1c0d2a3b4c5d6e7f80914",
        "title": "The Battle of Didgori",
        "slug": "the-battle-of-didgori",
        "excerpt": "In 1121, King David IV…",
        "coverImage": { "id": "66f1...", "url": "https://api.epoch.ge/uploads/0b8f....png", "alt": "Map" },
        "category": { "id": "66f1...", "name": "History", "slug": "history" },
        "tags": ["middle ages"],
        "author": { "id": "66f1...", "username": "master_elodin" },
        "status": "published",
        "publishedAt": "2026-10-01T12:00:00.000Z",
        "createdAt": "2026-09-30T09:00:00.000Z",
        "updatedAt": "2026-10-01T12:00:00.000Z"
      },
      "addedAt": "2026-10-04T08:15:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

## 5. Service to create: `ReadingListService`

`core/services/reading-list.service.ts`, `@Injectable({ providedIn: 'root' })`. One
method per endpoint, returning cold Observables straight from `HttpClient`. Don't catch
errors in the service.

| Method | Signature | HTTP |
| --- | --- | --- |
| listSaved | `listSaved(query: ReadingListQuery = {}): Observable<Paginated<ReadingListItem>>` | `GET /me/saved-articles` |
| save | `save(articleId: string): Observable<void>` | `PUT /me/saved-articles/:id` |
| unsave | `unsave(articleId: string): Observable<void>` | `DELETE /me/saved-articles/:id` |
| listRead | `listRead(query: ReadingListQuery = {}): Observable<Paginated<ReadingListItem>>` | `GET /me/read-articles` |
| markRead | `markRead(articleId: string): Observable<void>` | `PUT /me/read-articles/:id` |
| markUnread | `markUnread(articleId: string): Observable<void>` | `DELETE /me/read-articles/:id` |

Implementation notes:
- `private readonly baseUrl = \`${environment.apiUrl}/me\`;`
- PUT has no body. Angular's `http.put()` requires a body argument, so pass `null`:
  `this.http.put<void>(\`${this.baseUrl}/saved-articles/${articleId}\`, null)`.
  Don't send `{}`.
- Pass list queries through the existing `toHttpParams()` (skips `undefined`/`null`/`''`).
- Wrap `articleId` in `encodeURIComponent()` for consistency, even though ids are hex.
- Add a JSDoc to each method: `/** Any logged-in user. Idempotent. */` and so on.

Reference implementation (adapt names and imports to the project):

```ts
@Injectable({ providedIn: 'root' })
export class ReadingListService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/me`;

  /** Any logged-in user. Newest saved first. */
  listSaved(query: ReadingListQuery = {}): Observable<Paginated<ReadingListItem>> {
    return this.http.get<Paginated<ReadingListItem>>(`${this.baseUrl}/saved-articles`, {
      params: toHttpParams(query),
    });
  }

  /** Any logged-in user. Idempotent; 404 if the article isn't published. */
  save(articleId: string): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/saved-articles/${encodeURIComponent(articleId)}`,
      null,
    );
  }

  /** Any logged-in user. Idempotent. */
  unsave(articleId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/saved-articles/${encodeURIComponent(articleId)}`,
    );
  }

  // listRead, markRead, markUnread: the same against /read-articles
}
```

## 6. Client-side state for toggles

There is **no** endpoint that answers "is this one article saved/read?". To show toggle
buttons (bookmark icon, "mark as read" checkbox) on article cards and the article page,
keep the ids in memory:

- Create a small state service, e.g. `ReadingListStore` (`providedIn: 'root'`), with two
  signals: `savedIds = signal<ReadonlySet<string>>(new Set())` and
  `readIds = signal<ReadonlySet<string>>(new Set())`, plus `isSaved(id)` / `isRead(id)`
  helpers (or `computed`).
- **Load** when the user becomes logged in (after login/register and after
  `loadCurrentUser()` succeeds on app start): page through `listSaved({ limit: 100 })`
  and `listRead({ limit: 100 })` until you have `total` items, and fill the sets. Most
  users will need only one request per list.
- **Clear** both sets on logout.
- **Toggle** methods (`toggleSaved(id)`, `toggleRead(id)`): update the set
  **optimistically**, call `save`/`unsave` (or `markRead`/`markUnread`), and roll back the
  set change on error. On a 404 from PUT, show "This article is no longer available" and
  keep it out of the set.
- Always create **new** `Set` instances when updating signals (`new Set(old).add(id)`),
  never mutate the existing one, or the signal won't notify.
- Ignore repeated clicks while a request for the same id is in flight (keep a pending
  set), or just rely on the server being idempotent.
- If the user also wants "reading an article removes it from saved", do that in the
  store (`markRead` then `unsave`), not in `ReadingListService`. **Don't** do it unless I
  ask; the default is independent lists.

## 7. If shared pieces are missing

Only if the project doesn't already have them:
- `Paginated<T>` as in section 3.
- `toHttpParams(query)` that builds `HttpParams` and skips `undefined`, `null` and `''`.
- An auth interceptor that adds `Authorization: Bearer <token>` for
  `environment.apiUrl` requests.

## 8. UI (only if I ask you to build it)

Suggested, not required:
- Bookmark toggle on article cards and on the article page, visible only when logged in
  (`authService.isLoggedIn()`); for guests, either hide it or send them to login.
- "Mark as read" toggle on the article page. Don't mark automatically; the backend
  expects an explicit action.
- Two pages behind `authGuard`, e.g. `/me/saved` and `/me/read`, listing
  `item.article` with the existing article-card component, `item.addedAt` as "Saved on"
  / "Read on", and pagination using `total`. Each card links to
  `/articles/${encodeURIComponent(item.article.slug)}`.
- After removing an item on these pages, remove it from the visible list and decrement
  `total` locally, or refetch the current page. If the current page becomes empty and
  `page > 1`, go back one page.

## 9. Tests (if the project has a test setup)

With `provideHttpClient()` + `provideHttpClientTesting()` and `HttpTestingController`:
- `save('abc')` sends `PUT {apiUrl}/me/saved-articles/abc` with body `null`.
- `unsave('abc')` sends `DELETE {apiUrl}/me/saved-articles/abc`.
- `listRead({ page: 2 })` sends `GET {apiUrl}/me/read-articles?page=2` with no `limit`
  param.
- The store rolls back the optimistic change when the request errors.

## 10. Deliverables checklist

- [ ] `ReadingListItem` and `ReadingListQuery` interfaces, reusing `ArticleSummary` and `Paginated<T>`
- [ ] `ReadingListService` with the six methods above
- [ ] `ReadingListStore` with `savedIds` / `readIds` signals, load on login, clear on logout, optimistic toggles with rollback
- [ ] (only if asked) toggles and the two list pages
- [ ] `ng build` passes

When you are done, list the files you created or changed and any project conventions you
followed instead of these defaults.

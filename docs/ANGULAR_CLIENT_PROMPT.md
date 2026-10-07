# Prompt: generate Angular interfaces and services for the Epoch API

> Copy everything below the line into the AI assistant working on the Angular app.

---

You are working in my **Angular** frontend. Create **TypeScript interfaces** and
**Angular services** for my backend REST API ("Epoch API", a NestJS backend), described
in full below. The backend already exists and works. Your job is the typed client layer
only: models, services, an auth interceptor, and small helpers. **Do not build UI
components or pages** unless I ask.

## 0. Before writing any code

1. Inspect the project first:
   - Angular version (`package.json`)
   - standalone or NgModule setup
   - existing folder structure and naming conventions
   - whether `HttpClient` is already provided (`provideHttpClient(...)` in `app.config.ts`, or `HttpClientModule`)
   - existing interceptors and environment files
   - whether the project uses signals, RxJS state, or both

   **Follow the existing conventions.** If there are none, use the defaults in this prompt.
2. Defaults for a modern Angular app (v17+):
   - standalone APIs
   - `inject()` instead of constructor injection
   - `@Injectable({ providedIn: 'root' })`
   - functional interceptors (`HttpInterceptorFn`) registered with `provideHttpClient(withInterceptors([...]))`
   - signals for auth state
3. Do **not** invent endpoints, fields or query parameters that aren't listed here. Do not
   rename fields; the interfaces must match the JSON exactly.
4. No `any`. Use `strict` TypeScript types.
5. When you finish, run `ng build` (or `npx tsc --noEmit -p tsconfig.app.json`) and fix
   every error.

## 1. Base URL and environment

- Development API base URL: `http://localhost:3000`
- Add `apiUrl` to the environment files, e.g. `src/environments/environment.ts`:
  `export const environment = { production: false, apiUrl: 'http://localhost:3000' };`.
  Production can use a placeholder.
- All services build URLs as `${environment.apiUrl}/<path>`. Never hardcode the host
  anywhere else.
- Swagger docs (for reference only): `http://localhost:3000/docs`. OpenAPI JSON:
  `http://localhost:3000/docs-json`.

## 2. General API rules

### Format

- All requests and responses are JSON, except image upload, which is `multipart/form-data`.
- **Dates** arrive as ISO 8601 strings (e.g. `"2026-10-01T12:00:00.000Z"`). Type them as
  `string` in interfaces; don't convert to `Date` in the models.
- **Optional fields** marked `?` below are **omitted** from the JSON when empty; they are
  not sent as `null`. Fields typed `| null` are always present and may be `null`.
- `DELETE` endpoints return **204 No Content**. Type them as `Observable<void>`.
- The server rejects **unknown body fields** with 400. Send only the fields listed.
- Strings are trimmed server-side. Usernames, emails and tags are lowercased server-side.

### Authentication

- Protected endpoints need the header `Authorization: Bearer <accessToken>`.
- There are no refresh tokens. A token is valid for `expiresIn` seconds (default 86400, one day).
  After that, protected calls return 401 and the user must log in again.
- Roles: `'user'` (everyone who registers), `'moderator'`, `'admin'`.
- Role checks happen on the server against the database, so a role change applies
  immediately. Still, the client should refresh `GET /auth/me` after login and on app
  start to know the current role.

### Errors

Every error response has this shape:

```ts
export interface ApiError {
  statusCode: number;
  message: string | string[]; // validation errors (400) return an array of messages
  error: string;              // e.g. 'Bad Request', 'Unauthorized', 'Conflict'
}
```

| Status | Meaning |
| --- | --- |
| 400 | validation failed, or a business-rule error such as an unknown category id |
| 401 | missing, invalid or expired token; wrong login credentials |
| 403 | logged in but not allowed (wrong role, or not the owner of the resource) |
| 404 | not found |
| 409 | conflict (duplicate name, or deleting something still in use) |
| 413 | uploaded file too large |

Create a helper `getApiErrorMessages(err: unknown): string[]`. It should accept an
`HttpErrorResponse`, read `err.error` as `ApiError` when possible, normalize `message`
to `string[]`, and fall back to a generic message.

### Pagination

Paginated list endpoints accept `page` (integer ≥ 1, default 1) and `limit` (integer
1–100, default 20). They return:

```ts
export interface Paginated<T> {
  items: T[];
  total: number; // total matching items across all pages
  page: number;
  limit: number;
}
```

Build query params with a helper that **skips `undefined`, `null` and `''` values**, so
optional filters are not sent as `"undefined"`.

### Slugs

Article and category slugs can contain **non-Latin letters** (e.g. Georgian:
`ისტორია-abc`). Always wrap them in `encodeURIComponent()` when putting them in a URL
path.

## 3. Shared types

```ts
export type Role = 'user' | 'moderator' | 'admin';
export type ArticleStatus = 'draft' | 'published';
```

Using `as const` objects alongside the unions is fine (e.g. `export const ROLES = ['user', 'moderator', 'admin'] as const;`).

## 4. Models (response interfaces)

Create these exactly.

```ts
export interface User {
  id: string;
  username: string;   // always lowercase
  email: string;      // always lowercase
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;  // token lifetime in seconds
  user: User;
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

/** A category or a subcategory (subcategories are one level deep). */
export interface CategoryBase extends CategorySummary {
  description?: string;
  parent: CategorySummary | null; // set for subcategories; null for top-level categories
  articleCount: number;           // PUBLISHED articles; a top-level count includes its subcategories' articles
  createdAt: string;
  updatedAt: string;
}

export interface Category extends CategoryBase {
  subcategories: CategoryBase[];  // sorted by name; [] for subcategories and for categories without any
}

export interface ImageSummary {
  id: string;
  url: string;   // absolute URL, e.g. http://localhost:3000/uploads/<uuid>.png
  alt?: string;
}

export interface UploadedImage extends ImageSummary {
  filename: string;   // e.g. '0b8f6c1e-....png'
  mimeType: string;   // 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  size: number;       // bytes
  uploadedBy: string; // user id
  createdAt: string;
}

export interface AuthorSummary {
  id: string;
  username: string;
}

/** Used in article lists. Has NO `content`. */
export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;                     // plain text, about 200 characters, may end with '…'
  coverImage: ImageSummary | null;
  category: CategorySummary | null;    // always a top-level category
  subcategory: CategorySummary | null; // null when the article has no subcategory
  tags: string[];                      // lowercase
  author: AuthorSummary | null;
  status: ArticleStatus;
  publishedAt: string | null;          // null until first published; kept when unpublished
  createdAt: string;
  updatedAt: string;
}

/** A single article, with its HTML content. */
export interface Article extends ArticleSummary {
  content: string; // sanitized HTML from the Quill editor; safe to render
}

export interface Tag {
  name: string;
  count: number; // number of published articles with this tag
}

/** An entry in the current user's saved or read list. */
export interface ReadingListItem {
  article: ArticleSummary; // always a published article
  addedAt: string;         // when it was saved / marked as read
}

/** One question of a What? Where? When? package. */
export interface WhatWhereWhenQuestion {
  question: string; // sanitized HTML from Quill (may contain images); safe to render
  answer: string;   // plain text; render with interpolation, never innerHTML
  comment: string;  // plain text; '' when there is no comment
}

/** A category for What? Where? When? packages (separate from article categories). Admin only. */
export interface WhatWhereWhenCategory {
  id: string;
  name: string;
  description: string;  // '' when empty
  packageCount: number; // packages in this category
  createdAt: string;
  updatedAt: string;
}

export interface WhatWhereWhenCategorySummary {
  id: string;
  name: string;
}

/** A What? Where? When? package in lists (no questions). Admin only. */
export interface WhatWhereWhenSummary {
  id: string;
  name: string;
  authors: string[];
  category: WhatWhereWhenCategorySummary | null; // null = no category
  date: string;          // 'YYYY-MM-DD'
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WhatWhereWhenPackage extends WhatWhereWhenSummary {
  questions: WhatWhereWhenQuestion[]; // in the order they are asked
}
```

## 5. Request interfaces (bodies and query params)

The validation limits are enforced by the server. Also export them as constants (see
section 8) so forms can use the same limits.

```ts
// POST /auth/register
export interface RegisterRequest {
  username: string; // 3–30 chars; letters, digits, '_' and '.' only; case-insensitive (stored lowercase)
  email: string;    // valid email, max 254
  password: string; // 8–72 chars; at least one letter AND one digit
}

// POST /auth/login
export interface LoginRequest {
  identifier: string; // username OR email (case-insensitive), max 254
  password: string;   // max 72
}

// GET /users
export interface ListUsersQuery {
  page?: number;
  limit?: number;
  role?: Role;
}

// PATCH /users/:id/role
export interface UpdateRoleRequest {
  role: Role; // 'user' revokes moderator/admin rights
}

// POST /categories
export interface CreateCategoryRequest {
  name: string;         // 2–50 chars; must contain at least one letter or digit; unique across ALL categories and subcategories
  description?: string; // max 500
  parentId?: string;    // id of a TOP-LEVEL category -> creates a subcategory of it; cannot be changed later
}
// PATCH /categories/:id  (all fields optional; parentId is NOT allowed here)
export type UpdateCategoryRequest = Partial<Omit<CreateCategoryRequest, 'parentId'>>;

// PATCH /images/:id
export interface UpdateImageRequest {
  alt: string; // max 200; '' clears it
}

// GET /images
export interface ListImagesQuery {
  page?: number;
  limit?: number;
}

// POST /articles
export interface CreateArticleRequest {
  title: string;        // 3–200 chars
  content: string;      // Quill HTML, non-empty, max 1,000,000 chars
  coverImageId: string; // id of an image uploaded via POST /images
  categoryId: string;   // id of an existing TOP-LEVEL category
  subcategoryId?: string | null; // optional id of a subcategory of categoryId; omit or null = none
  tags?: string[];      // max 10; each 1–30 chars; lowercased and de-duplicated by the server
}
// PATCH /articles/:id  (send only the fields that changed)
// subcategoryId: omit = keep, null = remove, id = set. When changing categoryId, also send
// subcategoryId (a matching one or null), otherwise a now-mismatched subcategory returns 400.
export type UpdateArticleRequest = Partial<CreateArticleRequest>;

// GET /articles  (public list)
export interface ListArticlesQuery {
  page?: number;
  limit?: number;
  category?: string; // category or subcategory SLUG (not id), max 100; a top-level category includes its subcategories' articles
  categoryId?: string; // category or subcategory id (Mongo ObjectId); combined with `category`, both must match
  tag?: string;      // exact tag, case-insensitive, max 30
  author?: string;   // author USERNAME (not id), max 30
  q?: string;        // full-text search over title + content, whole words, max 100
}

// GET /articles/search  (public search box)
export interface SearchArticlesQuery {
  q: string;      // required, 1–100 chars; partial, case-insensitive match on title and tags
  page?: number;
  limit?: number;
}

// GET /articles/manage
export interface ManageArticlesQuery {
  page?: number;
  limit?: number;
  status?: ArticleStatus;
  categoryId?: string; // category or subcategory id (Mongo ObjectId)
}

// GET /tags
export interface ListTagsQuery {
  q?: string;     // tag prefix for autocomplete, max 30
  limit?: number; // 1–100, default 50
}

// POST /what-where-when  (admin only)
export interface WhatWhereWhenQuestionRequest {
  question: string; // Quill HTML, non-empty, max 100,000 chars; images only from POST /images
  answer: string;   // 1–1000 chars, plain text
  comment?: string; // max 5000, plain text; omitted = ''
}
export interface CreateWhatWhereWhenRequest {
  name: string;       // 1–200 chars
  authors?: string[]; // max 20; each 1–100 chars; trimmed, empty and duplicate names removed
  categoryId?: string | null; // id from GET /what-where-when-categories; omit/null = none
  date: string;       // 'YYYY-MM-DD', must be a real calendar date
  questions?: WhatWhereWhenQuestionRequest[]; // max 100, in order; omitted = []
}
// PATCH /what-where-when/:id  (send only what changed; `questions` replaces the WHOLE list;
// categoryId: omit = keep, null = remove, id = set)
export type UpdateWhatWhereWhenRequest = Partial<CreateWhatWhereWhenRequest>;

// GET /what-where-when
export interface ListWhatWhereWhenQuery {
  page?: number;
  limit?: number;
  categoryId?: string; // only packages in this category
}

// POST /what-where-when-categories
export interface CreateWhatWhereWhenCategoryRequest {
  name: string;         // 1–100 chars; unique, case-insensitive
  description?: string; // max 500
}
// PATCH /what-where-when-categories/:id
export type UpdateWhatWhereWhenCategoryRequest = Partial<CreateWhatWhereWhenCategoryRequest>;
```

## 6. Endpoints and the services to create

Legend for **Auth**:
- *Public*: no token
- *Bearer*: any logged-in user
- *Mod/Admin*: role moderator or admin
- *Admin*: admin only
- *Owner/Admin*: the moderator who created the resource, or any admin

Every protected endpoint may also return 401, and every role-restricted one 403. Every
`:id` must be a valid MongoDB ObjectId (24 hex characters), otherwise the server returns
400.

### 6.1 `AuthService` (`/auth`)

| Method | Signature | HTTP | Auth | Success | Errors |
| --- | --- | --- | --- | --- | --- |
| register | `register(body: RegisterRequest): Observable<AuthResponse>` | `POST /auth/register` | Public | 201 | 400 validation; 409 `Username is already taken`, `Email is already registered`, `Username and email are already taken` |
| login | `login(body: LoginRequest): Observable<AuthResponse>` | `POST /auth/login` | Public | 200 | 400; 401 `Invalid credentials` (same message for unknown user and wrong password) |
| me | `me(): Observable<User>` | `GET /auth/me` | Bearer | 200 | 401 (including `User no longer exists`) |

The service also owns the auth state:
- Store the token in `localStorage` under the key `epoch_access_token`. Optionally store
  its expiry time (now + `expiresIn` seconds), and treat an expired token as logged out.
- Expose `currentUser` as a signal (`signal<User | null>`), or a `BehaviorSubject` if the
  project uses RxJS state.
- Expose `isLoggedIn`, `isAdmin`, `isModerator` and `canWriteArticles` (moderator or
  admin) as `computed` signals or equivalent.
- `register()` and `login()` save the token and set `currentUser` from `response.user`
  (use `tap`).
- `logout()`: there is no server endpoint. Clear the token and `currentUser` on the
  client only.
- `getToken(): string | null`.
- `loadCurrentUser()` for app start. If a token exists, call `me()`, and on 401 call
  `logout()`. Wire it with `provideAppInitializer` (Angular 19+) or `APP_INITIALIZER`.

### 6.2 Auth interceptor

Create a functional `authInterceptor`:
- Add `Authorization: Bearer <token>` to requests whose URL starts with
  `environment.apiUrl`, when a token exists. Don't attach it to other hosts.
- On a **401** response from any endpoint **except** `POST /auth/login` and
  `POST /auth/register`: call `authService.logout()`, then rethrow. Redirecting to a
  login route is optional; make it configurable, or leave a clearly named hook.
- Register it in `provideHttpClient(withInterceptors([authInterceptor]))`.

### 6.3 `UsersService` (`/users`): Admin only

| Method | Signature | HTTP | Success | Errors |
| --- | --- | --- | --- | --- |
| list | `list(query?: ListUsersQuery): Observable<Paginated<User>>` | `GET /users?page&limit&role` | 200, newest first | 403 |
| updateRole | `updateRole(id: string, role: Role): Observable<User>` | `PATCH /users/:id/role` with body `{ role }` | 200 | 400; 403 `You cannot change your own role`; 404 `User not found` |

### 6.4 `CategoriesService` (`/categories`)

| Method | Signature | HTTP | Auth | Success | Errors |
| --- | --- | --- | --- | --- | --- |
| list | `list(): Observable<Category[]>` | `GET /categories` | Public | 200, **plain array** (not paginated) of **top-level** categories sorted by name, each with `subcategories` nested | — |
| getBySlug | `getBySlug(slug: string): Observable<Category>` | `GET /categories/:slug` (encode the slug) | Public | 200; works for categories and subcategories | 404 `Category not found` |
| create | `create(body: CreateCategoryRequest): Observable<Category>` | `POST /categories` | Admin | 201 | 400 (incl. `Parent category does not exist`, `Subcategories cannot have their own subcategories`); 409 `A category with this name already exists` (also for names differing only in case or punctuation, and across subcategories) |
| update | `update(id: string, body: UpdateCategoryRequest): Observable<Category>` | `PATCH /categories/:id` | Admin | 200 | 400 (sending `parentId` returns `property parentId should not exist`); 404; 409 |
| delete | `delete(id: string): Observable<void>` | `DELETE /categories/:id` | Admin | 204 | 404; 409 `Category has N subcategory(ies); delete them first`; 409 `Category is used by N article(s); move or delete them first` |

Renaming a category **changes its slug**. After `update()`, use the returned `slug`.

Subcategories:
- Optional and one level deep. A category may have none. A subcategory has `parent` set
  and `subcategories: []`.
- `list()` does **not** repeat subcategories at the top level; read them from
  `category.subcategories`. Use top-level categories for the article `categoryId`
  picker, and the chosen category's `subcategories` for an optional `subcategoryId`
  picker (show "None" as the default; reset it when the category changes).
- Filtering articles by a top-level category shows its subcategories' articles too;
  filtering by a subcategory shows only those.

### 6.5 `ImagesService` (`/images`): Mod/Admin

| Method | Signature | HTTP | Auth | Success | Errors |
| --- | --- | --- | --- | --- | --- |
| upload | `upload(file: File, alt?: string): Observable<UploadedImage>` | `POST /images`, **multipart/form-data** | Mod/Admin | 201 | 400 missing file or unsupported type; 413 `File too large` |
| uploadWithProgress (optional) | `uploadWithProgress(file: File, alt?: string): Observable<HttpEvent<UploadedImage>>` | same, with `reportProgress: true, observe: 'events'` | Mod/Admin | — | — |
| list | `list(query?: ListImagesQuery): Observable<Paginated<UploadedImage>>` | `GET /images?page&limit` | Mod/Admin | 200 | moderators get **only their own** images; admins get all |
| get | `get(id: string): Observable<UploadedImage>` | `GET /images/:id` | Mod/Admin | 200 | 404 `Image not found` |
| updateAlt | `updateAlt(id: string, alt: string): Observable<UploadedImage>` | `PATCH /images/:id` with body `{ alt }` | Owner/Admin | 200 | 403 `You can only modify your own content`; 404 |
| delete | `delete(id: string): Observable<void>` | `DELETE /images/:id` | Owner/Admin | 204 | 403; 404; 409 `Image is used by an article; remove it from the article first` or `Image is used by a What? Where? When? package; remove it from the package first` |

Upload details:
- Build a `FormData` with the field **`file`** (exact name) and, if given, the field
  `alt`.
- **Do not set a `Content-Type` header**; the browser sets the multipart boundary.
- Allowed types: jpeg, png, webp and gif. The server checks the real file bytes. Maximum
  size is **5 MB**.
- Validate both on the client before uploading (`file.type` and `file.size`), and return
  a clear error without calling the API.
- The returned `url` is absolute and publicly accessible; use it directly in `<img src>`.

### 6.6 `ArticlesService` (`/articles`)

| Method | Signature | HTTP | Auth | Success | Errors / notes |
| --- | --- | --- | --- | --- | --- |
| listPublished | `listPublished(query?: ListArticlesQuery): Observable<Paginated<ArticleSummary>>` | `GET /articles?page&limit&category&categoryId&tag&author&q` | Public | 200, newest `publishedAt` first | **published only**; an unknown category slug/id or author returns an empty page, not an error; a malformed `categoryId` returns 400 |
| search | `search(query: SearchArticlesQuery): Observable<Paginated<ArticleSummary>>` | `GET /articles/search?q&page&limit` | Public | 200, newest `publishedAt` first | **published only**; matches **parts of words** in the title or any tag, case-insensitive (`სებას` finds `იოჰან სებასტიან ბახი`); with several words, every word must match the title or a tag; 400 if `q` is missing, blank or over 100 chars. Use this for the site search box (debounce input, skip empty queries) |
| getBySlug | `getBySlug(slug: string): Observable<Article>` | `GET /articles/:slug` (encode the slug) | Public | 200 | 404 `Article not found` (also for drafts) |
| listManaged | `listManaged(query?: ManageArticlesQuery): Observable<Paginated<ArticleSummary>>` | `GET /articles/manage?page&limit&status&categoryId` | Mod/Admin | 200, newest `updatedAt` first | drafts and published; moderators see **only their own**, admins see all |
| getManaged | `getManaged(id: string): Observable<Article>` | `GET /articles/manage/:id` | Owner/Admin | 200 | 403; 404; use this to load an article (including drafts) into the editor |
| create | `create(body: CreateArticleRequest): Observable<Article>` | `POST /articles` | Mod/Admin | 201 | **always created as `draft`**; 400 validation, `Category does not exist`, `categoryId must be a top-level category; send the subcategory as subcategoryId`, `Subcategory does not exist`, `Subcategory does not belong to the selected category`, `Cover image does not exist`, `Article content cannot be empty`, `Images in content must be uploaded via POST /images first (...)`, `Content references images that do not exist: ...` |
| update | `update(id: string, body: UpdateArticleRequest): Observable<Article>` | `PATCH /articles/:id` | Owner/Admin | 200 | same 400s as create; 403 `You can only modify your own content`; 404 |
| delete | `delete(id: string): Observable<void>` | `DELETE /articles/:id` | Owner/Admin | 204 | 403; 404; does not delete the images |
| publish | `publish(id: string): Observable<Article>` | `POST /articles/:id/publish` with **no body** | Owner/Admin | **200** | sets `status = 'published'`; sets `publishedAt` only on the first publish |
| unpublish | `unpublish(id: string): Observable<Article>` | `POST /articles/:id/unpublish` with **no body** | Owner/Admin | **200** | back to `draft`; `publishedAt` is kept |

Article rules the client must respect:
- **Slug:** generated by the server from the title. While an article has **never been
  published**, changing its title changes its slug. After the first publish the slug
  never changes. Always use the `slug` from the latest response.
- **Content images:** the HTML may only contain `<img>` tags whose `src` is a `url`
  returned by `POST /images`. Pasted or base64 images and external image URLs are
  rejected with 400.
- **Cover image:** upload with `ImagesService.upload()`, then send the returned `id` as
  `coverImageId`.
- `content` in responses is sanitized by the server. Render it with `[innerHTML]`;
  Angular's own sanitizer is fine and needs no bypass. Content keeps Quill's `ql-*`
  classes, so include Quill's CSS (`quill.snow.css` or `quill.core.css`) wherever
  articles are displayed, so alignment and lists render correctly.
- Allowed formatting: paragraphs, headings h1–h6, bold, italic, underline, strike,
  sub/sup, blockquote, code block, ordered and bullet lists, links, images, text color,
  background color, and alignment. Video embeds are **not** supported (removed by the
  server); don't enable Quill's video button.

### 6.7 `TagsService` (`/tags`)

| Method | Signature | HTTP | Auth | Success |
| --- | --- | --- | --- | --- |
| list | `list(query?: ListTagsQuery): Observable<Tag[]>` | `GET /tags?q&limit` | Public | 200, **plain array**, most used first; counts published articles only |

Use it for tag autocomplete in the editor (`q` = what the user typed) and for tag clouds.

### 6.8 `ReadingListService` (`/me`): any logged-in user

Two independent personal lists: **saved** (read later) and **read**. `:id` is the
**article id** (`ArticleSummary.id`), not the slug. The lists always belong to the
token's user.

| Method | Signature | HTTP | Success | Errors / notes |
| --- | --- | --- | --- | --- |
| listSaved | `listSaved(query?: PaginationQuery): Observable<Paginated<ReadingListItem>>` | `GET /me/saved-articles?page&limit` | 200, newest saved first | — |
| save | `save(articleId: string): Observable<void>` | `PUT /me/saved-articles/:id` with **no body** | **204** | 404 `Article not found` (also drafts); 400 bad id. Saving twice is fine. |
| unsave | `unsave(articleId: string): Observable<void>` | `DELETE /me/saved-articles/:id` | 204 | 400 bad id. Not an error if it wasn't saved. |
| listRead | `listRead(query?: PaginationQuery): Observable<Paginated<ReadingListItem>>` | `GET /me/read-articles?page&limit` | 200, most recently marked first | — |
| markRead | `markRead(articleId: string): Observable<void>` | `PUT /me/read-articles/:id` with **no body** | **204** | 404; 400. Marking twice is fine. |
| markUnread | `markUnread(articleId: string): Observable<void>` | `DELETE /me/read-articles/:id` | 204 | 400 |

`PaginationQuery` is `{ page?: number; limit?: number }`. Marking an article as read does
**not** remove it from saved; call `unsave()` too if the UI wants that. Articles that get
unpublished disappear from both lists (and from `total`). There is no endpoint that
returns the state of one article, so to show "saved"/"read" toggles, load the lists (e.g.
with `limit=100`) and keep a `Set` of article ids in a signal, updating it after each
call.

### 6.9 `WhatWhereWhenService` (`/what-where-when`): Admin only

Quiz packages for the "What? Where? When?" game. Every endpoint requires the admin role.

| Method | Signature | HTTP | Success | Errors / notes |
| --- | --- | --- | --- | --- |
| list | `list(query?: ListWhatWhereWhenQuery): Observable<Paginated<WhatWhereWhenSummary>>` | `GET /what-where-when?page&limit&categoryId` | 200, newest `date` first | no `questions` in list items, only `questionCount` |
| get | `get(id: string): Observable<WhatWhereWhenPackage>` | `GET /what-where-when/:id` | 200 | 404 `What? Where? When? package not found` |
| create | `create(body: CreateWhatWhereWhenRequest): Observable<WhatWhereWhenPackage>` | `POST /what-where-when` | 201 | 400 validation (`date must be YYYY-MM-DD`, `date must be a valid date`, `questions.0.answer ...`), `Category does not exist`, `Question N cannot be empty`, `Images in content must be uploaded via POST /images first (...)`, `Questions reference images that do not exist: ...` |
| update | `update(id: string, body: UpdateWhatWhereWhenRequest): Observable<WhatWhereWhenPackage>` | `PATCH /what-where-when/:id` | 200 | same 400s as create; 404 |
| delete | `delete(id: string): Observable<void>` | `DELETE /what-where-when/:id` | 204 | 404; the images are kept |

- The question editor uses the same Quill setup and image handler as articles (section 7).
- Editing questions: load the package with `get()`, edit the list in the form (add,
  remove, reorder), then send the **full** `questions` array in `update()`.
- Render `question` with `[innerHTML]` (sanitized by the server, include Quill CSS);
  render `answer` and `comment` as text.

### 6.10 `WhatWhereWhenCategoriesService` (`/what-where-when-categories`): Admin only

Categories for What? Where? When? packages. Separate from article categories.

| Method | Signature | HTTP | Success | Errors / notes |
| --- | --- | --- | --- | --- |
| list | `list(): Observable<WhatWhereWhenCategory[]>` | `GET /what-where-when-categories` | 200, **plain array** sorted by name | — |
| get | `get(id: string): Observable<WhatWhereWhenCategory>` | `GET /what-where-when-categories/:id` | 200 | 404 `What? Where? When? category not found` |
| create | `create(body: CreateWhatWhereWhenCategoryRequest): Observable<WhatWhereWhenCategory>` | `POST /what-where-when-categories` | 201 | 400; 409 `A What? Where? When? category with this name already exists` (case-insensitive) |
| update | `update(id: string, body: UpdateWhatWhereWhenCategoryRequest): Observable<WhatWhereWhenCategory>` | `PATCH /what-where-when-categories/:id` | 200 | 400; 404; 409 |
| delete | `delete(id: string): Observable<void>` | `DELETE /what-where-when-categories/:id` | 204 | 404; 409 `Category is used by N package(s); move or delete them first` |

## 7. Quill image upload helper

Create a small helper, e.g. `createQuillImageHandler(imagesService)` in
`core/editor/quill-image-handler.ts`, that a Quill editor can use as
`modules.toolbar.handlers.image`:
1. Open a hidden `<input type="file" accept="image/jpeg,image/png,image/webp,image/gif">`.
2. Validate the type and the 5 MB limit.
3. Call `imagesService.upload(file)`.
4. Insert the returned `url` at the cursor with
   `quill.insertEmbed(range.index, 'image', image.url, 'user')`.

Also prevent pasting or dropping base64 images. Either strip `data:` images with a
clipboard matcher, or upload them through the same flow. If the project doesn't have
Quill installed yet, write the helper with minimal local types and don't add any
dependency.

## 8. Validation constants for forms

Export these from e.g. `core/api/api-limits.ts`, so reactive forms use the same rules as
the server:

```ts
export const API_LIMITS = {
  username: { min: 3, max: 30, pattern: /^[a-zA-Z0-9_.]+$/ },
  email: { max: 254 },
  password: { min: 8, max: 72, pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/ },
  loginIdentifier: { max: 254 },
  categoryName: { min: 2, max: 50 },
  categoryDescription: { max: 500 },
  imageAlt: { max: 200 },
  image: { maxSizeBytes: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
  articleTitle: { min: 3, max: 200 },
  articleContent: { max: 1_000_000 },
  tags: { maxCount: 10, minLength: 1, maxLength: 30 },
  pagination: { defaultLimit: 20, maxLimit: 100 },
  tagsQuery: { defaultLimit: 50, maxLimit: 100 },
  search: { max: 100 },
  whatWhereWhen: {
    name: { min: 1, max: 200 },
    authors: { maxCount: 20, minLength: 1, maxLength: 100 },
    date: { pattern: /^\d{4}-\d{2}-\d{2}$/ },
    questions: { maxCount: 100 },
    question: { max: 100_000 },
    answer: { min: 1, max: 1000 },
    comment: { max: 5000 },
    categoryName: { min: 1, max: 100 },
    categoryDescription: { max: 500 },
  },
} as const;
```

## 9. Permissions summary (for guards and showing or hiding UI)

| Action | Public | user | moderator | admin |
| --- | --- | --- | --- | --- |
| Register / log in | yes | — | — | — |
| `GET /auth/me` | — | yes | yes | yes |
| Read categories, published articles, tags | yes | yes | yes | yes |
| Own saved / read lists | — | yes | yes | yes |
| Create, update or delete categories | — | — | — | yes |
| Upload images; list own images | — | — | yes | yes (all images) |
| Edit or delete an image | — | — | own | any |
| Create articles; see drafts in "manage" | — | — | own | all |
| Edit, delete, publish or unpublish articles | — | — | own | any |
| List users; change roles | — | — | — | yes (not their own role) |
| Manage What? Where? When? packages and their categories | — | — | — | yes |

To decide "own", compare `article.author?.id` or `image.uploadedBy` with
`currentUser().id`.

Also create functional route guards `authGuard` (logged in), `roleGuard(...roles: Role[])`
and `guestGuard` (only when logged out) in `core/auth/`. They read `AuthService` state. If
the auth state hasn't loaded yet, wait for `loadCurrentUser()`. These guards only hide
UI; the server still enforces everything.

## 10. Suggested file structure

Use the project's own structure if it has one. Otherwise:

```
src/app/core/
  api/
    api-error.ts            # ApiError + getApiErrorMessages()
    api-limits.ts           # API_LIMITS
    http-params.ts          # toHttpParams(query) – skips undefined/null/''
    paginated.ts            # Paginated<T>
  auth/
    auth.service.ts
    auth.interceptor.ts
    auth.guards.ts          # authGuard, guestGuard, roleGuard
  models/
    role.ts                 # Role, ArticleStatus
    user.model.ts           # User, AuthResponse, RegisterRequest, LoginRequest, ...
    category.model.ts
    image.model.ts
    article.model.ts
    tag.model.ts
    index.ts                # barrel export
  services/
    users.service.ts
    categories.service.ts
    images.service.ts
    articles.service.ts
    tags.service.ts
    reading-list.service.ts
  editor/
    quill-image-handler.ts
```

## 11. Implementation rules

- Services return **cold Observables** straight from `HttpClient`, typed with generics
  (`this.http.get<Category[]>(...)`). Don't subscribe inside services, except for the
  auth state updates via `tap`.
- One method per endpoint, named as in the tables above.
- Put the endpoint paths in one place per service (e.g.
  `private readonly baseUrl = \`${environment.apiUrl}/articles\``).
- Optional query objects default to `{}`. Pass them through `toHttpParams()`.
- Don't catch errors in services; let the caller handle them with
  `getApiErrorMessages()`. The interceptor handles 401 globally.
- Add a short JSDoc to each service method stating who may call it, e.g.
  `/** Admin only. */` or `/** Moderator or admin; moderators only see their own. */`.
- If the project has a test setup, add simple tests for one or two services using
  `provideHttpClientTesting()` and `HttpTestingController`. Check the URL, method, query
  params and body of each call.

## 12. Deliverables checklist

- [ ] `environment.apiUrl` configured
- [ ] All interfaces from sections 3–5, exactly as specified
- [ ] `ApiError`, `getApiErrorMessages`, `Paginated<T>`, `toHttpParams`, `API_LIMITS`
- [ ] `AuthService` (with token storage, `currentUser` state, role helpers, `loadCurrentUser`), `authInterceptor`, guards
- [ ] `UsersService`, `CategoriesService`, `ImagesService`, `ArticlesService`, `TagsService`, `ReadingListService` with every method listed
- [ ] Quill image handler helper
- [ ] Interceptor and app initializer registered in the app config
- [ ] `ng build` passes with no errors

When you are done, list the files you created and any project conventions you followed
instead of these defaults.

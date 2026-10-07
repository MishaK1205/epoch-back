# Prompt: add What? Where? When? quiz management to the Angular app

> Copy everything below the line into the AI assistant working on the Angular app.

---

You are working in my **Angular** frontend for the Epoch API (a NestJS backend). The
backend just gained a new **admin-only** feature: **What? Where? When?** ("რა? სად?
როდის?") quiz packages. A package has a name, a list of authors, a date and an ordered
list of questions. Each question is rich text from the **Quill** editor (it may contain
images), plus a plain-text answer and an optional plain-text comment. The backend part is
finished and tested.

Packages can be grouped into **What? Where? When? categories** (e.g. "Autumn cup 2026").
These are **separate from the article categories** the app already has: different
endpoint, different model, never mix them.

Your job: add the typed models and services, and build the admin screens to manage
categories and to list, create, view, edit and delete packages.

## 0. Before writing any code

1. Inspect the project. Find the existing API layer: `environment.apiUrl`, the
   `Paginated<T>` interface, the `toHttpParams()` helper, `getApiErrorMessages()`,
   `AuthService` (with `isAdmin`), the `roleGuard`, the existing `ImagesService`
   (`POST /images`), the **Quill image handler** used by the article editor (often
   `core/editor/quill-image-handler.ts`), the article editor component, the admin area
   (layout, navigation, routes), the pagination component, confirm dialogs, toasts, and
   the `API_LIMITS` constants file.
2. **Reuse those.** Don't create a second `Paginated`, a second HTTP-params helper, a
   second image upload flow or a second Quill setup. Configure the question editors
   exactly like the article content editor (same toolbar, same image handler, same paste
   handling). Follow the project's conventions (standalone vs NgModule, `inject()`, signals
   vs RxJS state, `@if`/`@for`, naming, file layout, styling, i18n).
3. Don't invent endpoints, fields or query parameters that aren't in this prompt. Field
   names must match the JSON exactly.
4. No `any`. Strict TypeScript.
5. When finished, run `ng build` (or `npx tsc --noEmit -p tsconfig.app.json`) and fix
   every error.

## 1. What the feature is

- **Admin only.** Every endpoint requires a logged-in user with role `admin`. There is no
  public page for packages yet. Moderators and users get `403`; without a token `401`.
- A **package** = one game / tournament round:
  - `name`: e.g. "Autumn cup, round 1"
  - `authors`: free-text names of the people who wrote the questions (not user accounts)
  - `category`: optional; at most **one** What? Where? When? category per package
  - `date`: calendar date `YYYY-MM-DD`
  - `questions`: ordered list. The order in the array is the question number (index 0 =
    question 1). There is no separate `number` field.
- A **question**:
  - `question`: HTML from Quill. Can contain formatting and **images**.
  - `answer`: plain text, required.
  - `comment`: plain text, optional (the server returns `''` when there is none).
- Question images follow the same rules as article images: they must be uploaded with
  `POST /images` first and inserted by URL. Pasted base64 images and external image URLs
  are rejected with `400`.
- An image used inside any question **can't be deleted** (`409`) until it is removed from
  the question.
- A **category** has a `name` (unique, case-insensitive) and an optional `description`.
  It is flat (no subcategories) and has no slug. The typical flow: the admin creates a
  category, then picks it when creating or editing a package. A category that still has
  packages **can't be deleted** (`409`); move the packages to another category or remove
  their category first.

## 2. Base URL and auth

- Packages: `${environment.apiUrl}/what-where-when`.
- Categories: `${environment.apiUrl}/what-where-when-categories` (a separate prefix, **not**
  `/what-where-when/categories`).
- Dev: `http://localhost:3000`, production: `https://api.epoch.ge`. Never hardcode the
  host.
- The existing auth interceptor adds `Authorization: Bearer <token>`. Don't add headers
  manually.

## 3. Interfaces

Add to the models folder (e.g. `core/models/what-where-when.model.ts`) and export them
from the models barrel if there is one.

```ts
/** A What? Where? When? category (GET /what-where-when-categories). */
export interface WhatWhereWhenCategory {
  id: string;
  name: string;
  description: string;  // '' when there is none
  packageCount: number; // how many packages are in this category
  createdAt: string;
  updatedAt: string;
}

/** The category as embedded in a package. */
export interface WhatWhereWhenCategorySummary {
  id: string;
  name: string;
}

/** POST /what-where-when-categories */
export interface CreateWhatWhereWhenCategoryRequest {
  name: string;         // 1–100 chars after trimming; unique, case-insensitive
  description?: string; // max 500; omit for none
}

/** PATCH /what-where-when-categories/:id. Send only what changed; '' clears the description. */
export type UpdateWhatWhereWhenCategoryRequest = Partial<CreateWhatWhereWhenCategoryRequest>;

/** One question of a package, as returned by the API. */
export interface WhatWhereWhenQuestion {
  question: string; // sanitized HTML (may contain <img>); safe to render with [innerHTML]
  answer: string;   // plain text; render with {{ }} interpolation, never innerHTML
  comment: string;  // plain text; '' when there is no comment
}

/** A package in the list (GET /what-where-when). No questions, only their count. */
export interface WhatWhereWhenSummary {
  id: string;
  name: string;
  authors: string[];
  category: WhatWhereWhenCategorySummary | null; // null = no category
  date: string;          // 'YYYY-MM-DD'
  questionCount: number;
  createdAt: string;     // ISO date-time
  updatedAt: string;     // ISO date-time
}

/** A full package (GET /what-where-when/:id, POST, PATCH). */
export interface WhatWhereWhenPackage extends WhatWhereWhenSummary {
  questions: WhatWhereWhenQuestion[]; // in the order they are asked
}

/** One question in a create/update body. */
export interface WhatWhereWhenQuestionRequest {
  question: string; // Quill HTML, non-empty, max 100,000 chars
  answer: string;   // 1–1000 chars after trimming
  comment?: string; // max 5000 chars; omit (or send '') for no comment
}

/** POST /what-where-when */
export interface CreateWhatWhereWhenRequest {
  name: string;       // 1–200 chars after trimming
  authors?: string[]; // max 20; each 1–100 chars; server trims and removes empty/duplicate names
  categoryId?: string | null; // a WhatWhereWhenCategory id; omit or null = no category
  date: string;       // 'YYYY-MM-DD', must be a real calendar date
  questions?: WhatWhereWhenQuestionRequest[]; // max 100; omitted = no questions
}

/**
 * PATCH /what-where-when/:id. Send only what changed. `questions` replaces the WHOLE list.
 * categoryId: omit = keep the current category, null = remove it, id = set it.
 */
export type UpdateWhatWhereWhenRequest = Partial<CreateWhatWhereWhenRequest>;

export interface ListWhatWhereWhenQuery {
  page?: number;       // >= 1, default 1
  limit?: number;      // 1–100, default 20
  categoryId?: string; // only packages in this category
}
```

The list response is the existing `Paginated<WhatWhereWhenSummary>`
(`{ items, total, page, limit }`). Don't duplicate `Paginated`.

Add to `API_LIMITS` (or the project's validation constants):

```ts
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
```

## 4. Endpoints

All require the **admin** role. Every `:id` must be a valid MongoDB ObjectId (24 hex
characters), otherwise `400 id must be a mongodb id`.

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| GET | `/what-where-when?page&limit&categoryId` | `200` `Paginated<WhatWhereWhenSummary>`, sorted by `date` newest first (then newest created). With `categoryId`, only that category's packages (an unknown id gives an empty page). | `400` bad `page`/`limit`/`categoryId`; `401`; `403` |
| GET | `/what-where-when/:id` | `200` `WhatWhereWhenPackage` | `400` bad id; `404 What? Where? When? package not found` |
| POST | `/what-where-when` | `201` `WhatWhereWhenPackage` | `400` (see below) |
| PATCH | `/what-where-when/:id` | `200` `WhatWhereWhenPackage` | `400` (see below); `404` |
| DELETE | `/what-where-when/:id` | `204` no body | `400` bad id; `404`. Images used by the package are **not** deleted. |

Possible `400` messages on create/update (error shape `{ statusCode, message, error }`;
`message` is a **string array** for validation errors and a **string** for the others; use
the existing `getApiErrorMessages()`):

| Message | Cause |
| --- | --- |
| `date must be YYYY-MM-DD` | wrong format, e.g. `07.10.2026` |
| `date must be a valid date` | e.g. `2026-02-30` |
| `name must be longer than or equal to 1 characters` | empty name |
| `questions.N.answer must be longer than or equal to 1 characters` | empty answer at index N (0-based) |
| `questions.N.property X should not exist` | unknown field inside a question |
| `property X should not exist` | unknown top-level field (the server rejects unknown fields) |
| `categoryId must be a mongodb id` | malformed `categoryId` |
| `Category does not exist` | `categoryId` of a deleted or unknown category |
| `Question N cannot be empty` | question N (**1-based**) has no text and no image after sanitizing (e.g. Quill's empty `<p><br></p>`) |
| `Images in content must be uploaded via POST /images first (pasted or external images are not allowed)` | base64 or external `<img>` |
| `Questions reference images that do not exist: <filename>` | image URL of a deleted upload |

Other rules:
- **JSON body limit is 2 MB** for the whole request. A body over that returns `413`. Normal
  packages are far below this (images are referenced by URL, not embedded). Show a clear
  message on `413` ("The package is too large to save").
- The server **sanitizes** question HTML: scripts, iframes, event handlers, unsupported tags
  and styles are removed; image URLs are rewritten to absolute URLs. Always replace the
  form state with the **returned** package after saving.
- The server trims `name`, `answer`, `comment` and each author.
- `category` in responses is always the **current** name of the category (only the id is
  stored, so renaming a category updates every package).
- `DELETE /images/:id` now has a second `409` message:
  `Image is used by a What? Where? When? package; remove it from the package first`.
  If the app has an image library screen, show that message as is.

Example `GET /what-where-when/6ac64e4e592927df3acc336b`:

```json
{
  "id": "6ac64e4e592927df3acc336b",
  "name": "Autumn cup, round 1",
  "authors": ["Giorgi", "Nino"],
  "category": { "id": "6ac654618280bf721188b701", "name": "შემოდგომის თასი" },
  "date": "2026-10-07",
  "questionCount": 2,
  "createdAt": "2026-10-07T13:51:10.878Z",
  "updatedAt": "2026-10-07T13:51:10.878Z",
  "questions": [
    {
      "question": "<p>რა არის სურათზე?</p><p><img src=\"https://api.epoch.ge/uploads/f000e8ca-e1e7-4adf-8330-1c42712ef247.png\" /></p>",
      "answer": "ნარიყალა",
      "comment": "IV საუკუნე"
    },
    { "question": "<p><strong>Second</strong> question</p>", "answer": "Two", "comment": "" }
  ]
}
```

### Category endpoints

All require the **admin** role.

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| GET | `/what-where-when-categories` | `200` **plain array** `WhatWhereWhenCategory[]` (not paginated), sorted by name | `401`; `403` |
| GET | `/what-where-when-categories/:id` | `200` `WhatWhereWhenCategory` | `400` bad id; `404 What? Where? When? category not found` |
| POST | `/what-where-when-categories` | `201` `WhatWhereWhenCategory` | `400` validation (`name must be longer than or equal to 1 characters`, `property X should not exist`); `409 A What? Where? When? category with this name already exists` |
| PATCH | `/what-where-when-categories/:id` | `200` `WhatWhereWhenCategory` | `400`; `404`; `409` same message when renaming to an existing name |
| DELETE | `/what-where-when-categories/:id` | `204` no body | `404`; `409 Category is used by N package(s); move or delete them first` |

- Name uniqueness ignores case: `spring cup` conflicts with `Spring Cup`.
- The server trims `name` and `description`.

Example `GET /what-where-when-categories`:

```json
[
  {
    "id": "6ac654618280bf721188b701",
    "name": "შემოდგომის თასი",
    "description": "Rounds",
    "packageCount": 1,
    "createdAt": "2026-10-07T14:17:05.548Z",
    "updatedAt": "2026-10-07T14:17:05.548Z"
  }
]
```

## 5. Service

Create `WhatWhereWhenService` (e.g. `core/services/what-where-when.service.ts`,
`providedIn: 'root'`), next to the other API services:

| Method | Signature | HTTP |
| --- | --- | --- |
| list | `list(query?: ListWhatWhereWhenQuery): Observable<Paginated<WhatWhereWhenSummary>>` | `GET /what-where-when` |
| get | `get(id: string): Observable<WhatWhereWhenPackage>` | `GET /what-where-when/:id` |
| create | `create(body: CreateWhatWhereWhenRequest): Observable<WhatWhereWhenPackage>` | `POST /what-where-when` |
| update | `update(id: string, body: UpdateWhatWhereWhenRequest): Observable<WhatWhereWhenPackage>` | `PATCH /what-where-when/:id` |
| delete | `delete(id: string): Observable<void>` | `DELETE /what-where-when/:id` |

```ts
@Injectable({ providedIn: 'root' })
export class WhatWhereWhenService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/what-where-when`;

  list(query: ListWhatWhereWhenQuery = {}): Observable<Paginated<WhatWhereWhenSummary>> {
    return this.http.get<Paginated<WhatWhereWhenSummary>>(this.baseUrl, {
      params: toHttpParams(query),
    });
  }

  get(id: string): Observable<WhatWhereWhenPackage> {
    return this.http.get<WhatWhereWhenPackage>(`${this.baseUrl}/${id}`);
  }

  create(body: CreateWhatWhereWhenRequest): Observable<WhatWhereWhenPackage> {
    return this.http.post<WhatWhereWhenPackage>(this.baseUrl, body);
  }

  update(id: string, body: UpdateWhatWhereWhenRequest): Observable<WhatWhereWhenPackage> {
    return this.http.patch<WhatWhereWhenPackage>(`${this.baseUrl}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
```

Return the cold Observables straight from `HttpClient`; don't catch errors in the service.
Ids are hex, so no encoding is needed.

Also create `WhatWhereWhenCategoriesService` (e.g.
`core/services/what-where-when-categories.service.ts`). Don't add these methods to the
existing article `CategoriesService`.

| Method | Signature | HTTP |
| --- | --- | --- |
| list | `list(): Observable<WhatWhereWhenCategory[]>` | `GET /what-where-when-categories` |
| get | `get(id: string): Observable<WhatWhereWhenCategory>` | `GET /what-where-when-categories/:id` |
| create | `create(body: CreateWhatWhereWhenCategoryRequest): Observable<WhatWhereWhenCategory>` | `POST /what-where-when-categories` |
| update | `update(id: string, body: UpdateWhatWhereWhenCategoryRequest): Observable<WhatWhereWhenCategory>` | `PATCH /what-where-when-categories/:id` |
| delete | `delete(id: string): Observable<void>` | `DELETE /what-where-when-categories/:id` |

Same implementation style as `WhatWhereWhenService`, with
`baseUrl = \`${environment.apiUrl}/what-where-when-categories\``.

## 6. Routes and navigation

Add lazy-loaded routes inside the existing **admin** area, protected by
`roleGuard(Role.Admin)` (the guard only hides UI; the server enforces it anyway):

| Route | Component | Purpose |
| --- | --- | --- |
| `/admin/what-where-when` | `WwwListPageComponent` | list of packages |
| `/admin/what-where-when/new` | `WwwEditorPageComponent` | create |
| `/admin/what-where-when/:id` | `WwwViewPageComponent` | read-only view of one package |
| `/admin/what-where-when/:id/edit` | `WwwEditorPageComponent` | edit |
| `/admin/what-where-when/categories` | `WwwCategoriesPageComponent` | manage categories |

Adapt the prefix to the project's admin URL structure. Declare `new` and `categories`
before `:id`. Add a "What? Where? When?" item to the admin navigation, visible only when
`isAdmin()` is true, with two sub-links: "Packages" and "Categories".
Put the components under e.g. `features/admin/what-where-when/`.

## 7. Categories page

One page to list, create, rename and delete categories (`WwwCategoriesPageComponent`).

- Load with `categoriesService.list()`. Show a table: **name**, **description** (or "—"),
  **packageCount** (as a link to the package list filtered by that category:
  `/admin/what-where-when?categoryId=<id>`), and actions **Edit** / **Delete**.
- **Create:** a "New category" button opening an inline form or dialog with `name`
  (required, `maxlength="100"`, not blank) and `description` (optional textarea,
  `maxlength="500"`). On `201` add it to the list (keep the list sorted by name, or
  reload) and show a toast.
- **Edit:** the same form prefilled; send only changed fields (sending both is fine).
  `''` clears the description.
- **Delete:** confirm dialog. If `packageCount > 0`, don't call the API at all: explain
  "This category has N package(s). Move them to another category first." with a link to
  the filtered package list. Still handle the server's `409` (someone may have added a
  package meanwhile) by showing its message.
- `409` on create/edit: show the message under the name field ("A category with this name
  already exists").
- States: loading, empty ("No categories yet" + "New category"), error with "Try again".
- After any change, the category list used by the package editor and filter should be
  refreshed (e.g. a shared signal/store, or reload it when those pages open).

## 8. List page

- Read `page` and `categoryId` from the **query params**
  (`?page=2&categoryId=6ac6...`) so back/forward, reload and links from the categories
  page work. Non-numeric or `< 1` page → 1. Use page size 20 (server default) or a
  constant.
- Load with `list({ page, categoryId })` via `switchMap` on `queryParamMap`. Don't send
  `categoryId` when it's empty.
- A **category filter** select above the list: "All categories" plus every category from
  `categoriesService.list()` (show `name (packageCount)`). Changing it navigates with the
  new `categoryId` and resets `page` to 1. If the URL holds an id that isn't in the list,
  keep the filter and show the (empty) result; don't crash.
- Table or cards with: **name**, **date** (format `YYYY-MM-DD` for display with the
  project's date pipe/locale; parse it as a local date, not with `new Date('2026-10-07')`,
  which is UTC and can show the previous day), **category** (`category?.name`, or "—" when
  `null`; clicking it applies the filter), **authors** joined with `, ` (or "—" when
  empty), **questionCount** ("12 questions"), and the last update time.
- Row actions: **View**, **Edit**, **Delete**.
- Header button **"New package"** → `/admin/what-where-when/new`.
- States: loading (skeleton/spinner), empty ("No packages yet" + "New package" button),
  error (message + "Try again").
- Pagination with the existing component (`total`, `page`, `limit`). If the page is beyond
  the last one (`items` empty, `total > 0`), navigate to the last page.
- **Delete:** confirm dialog naming the package ("Delete "Autumn cup, round 1"? This cannot
  be undone. Images used in it are kept."). On `204` remove the row / reload the page and
  show a toast. On `404` reload the list (someone else deleted it).

## 9. Editor page (create and edit)

One component for both modes. In edit mode load the package with `get(id)` and fill the
form; show a loader, and a "Package not found" state with a link back on `404`.

### Form model (typed reactive forms)

```ts
type QuestionForm = FormGroup<{
  question: FormControl<string>; // Quill HTML
  answer: FormControl<string>;
  comment: FormControl<string>;
}>;

form = this.fb.nonNullable.group({
  name: ['', [Validators.required, Validators.maxLength(200), notBlank]],
  date: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/), realDate]],
  categoryId: this.fb.control<string | null>(null),
  authors: this.fb.nonNullable.array<FormControl<string>>([]),
  questions: this.fb.array<QuestionForm>([]),
});
```

- `notBlank`: fails when the trimmed value is empty.
- `realDate`: fails for impossible dates (`2026-02-30`), e.g. by checking that
  `new Date(y, m - 1, d)` round-trips to the same y/m/d.
- Questions: `question` required with a **"Quill empty"** validator (see below), max
  100,000 chars; `answer` required, `notBlank`, max 1000; `comment` max 5000.
- `questions` max 100 items, `authors` max 20 items, each author max 100 chars.

### Fields

- **Name**: text input, `maxlength="200"`.
- **Date**: `<input type="date">` (its value is already `YYYY-MM-DD`) or the project's date
  picker, converting to `YYYY-MM-DD` **in local time** (never via `toISOString()`, which can
  shift the day). New packages default to today's local date.
- **Category**: a select with "No category" (`null`) plus every category from
  `categoriesService.list()`, sorted by name. In edit mode, preselect
  `package.category?.id ?? null`. When the user arrives from a filtered list
  (`/admin/what-where-when/new?categoryId=<id>`), preselect that category. Add a small
  "Manage categories" link (or a "+ New category" option that opens the create-category
  dialog and selects the new category after `201`). If there are no categories yet, show
  a hint linking to the categories page; a package can still be saved without one.
- **Authors**: a chip/tag input (type a name, Enter or comma adds it, × removes it) or a
  list of text inputs with "Add author". Trim, skip empty, ignore duplicates on the client
  too. Max 20.

### Questions

Each question is a card:
- Header: **"Question {index + 1}"**, buttons **Move up**, **Move down** (disabled at the
  ends), **Duplicate** (optional), **Remove** (with a confirm if the question has content).
- **Question** editor: a Quill editor configured **exactly like the article content
  editor**, including the existing custom image handler (upload via
  `ImagesService.upload()` then `insertEmbed` the returned `url`) and the protection
  against pasted/dropped base64 images. Same toolbar, but don't enable video.
  Bind it to the `question` control (ngx-quill `quill-editor` with `formControlName`, or
  the project's existing wrapper).
- **Answer**: single-line or small textarea, `maxlength="1000"`, required.
- **Comment**: textarea, `maxlength="5000"`, optional.
- Below the list: **"Add question"** appends an empty card and scrolls/focuses its editor.
  Disable it at 100 questions and show why.
- Reordering with the buttons is enough; drag and drop (CDK `DragDrop` with
  `moveItemInArray` on the FormArray) is a nice extra if the project already uses CDK.

"Quill empty" check (Quill emits `<p><br></p>` for an empty editor):

```ts
export function isQuillHtmlEmpty(html: string): boolean {
  if (/<img\s/i.test(html)) {
    return false;
  }
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return text.length === 0;
}
```

Use it only to validate; never use string-built HTML for rendering.

### Saving

- Mark all controls touched and stop if the form is invalid; scroll to the first invalid
  field (question cards should show their errors inline).
- Build the body from the form:

```ts
const value = this.form.getRawValue();
const body: CreateWhatWhereWhenRequest = {
  name: value.name.trim(),
  date: value.date,
  categoryId: value.categoryId, // null = no category (also removes it on update)
  authors: value.authors.map((a) => a.trim()).filter(Boolean),
  questions: value.questions.map((q) => ({
    question: q.question,
    answer: q.answer.trim(),
    ...(q.comment.trim() ? { comment: q.comment.trim() } : {}),
  })),
};
```

- **Create:** `create(body)` → on `201` navigate to `/admin/what-where-when/:id` (or the
  edit page) and show "Package created".
- **Edit:** `update(id, body)`. Sending all fields is fine and simplest. Remember that
  `questions` **replaces the whole list**, so always send the full current list, never
  only the changed question. On `200` reset the form with the **returned** package
  (sanitized HTML, trimmed values) and mark it pristine.
- Disable the Save button and show a spinner while saving; prevent double submit.
- Errors: show `getApiErrorMessages()` above the form. When a message is
  `Question N cannot be empty` (1-based) or starts with `questions.N.` (0-based), also
  highlight that question card. On `Category does not exist` (deleted meanwhile), reload
  the categories, reset the select to "No category" and ask the user to choose again. `413` → "The package is too large to save". `404` on
  update → "This package was deleted" with a link to the list.
- **Unsaved changes:** add a `canDeactivate` guard (and `beforeunload`) that asks for
  confirmation when the form is dirty.
- Show a running count, e.g. "12 questions", near the Save button.

## 10. View page

Read-only page for one package (`get(id)`), also useful as a print/preview view:
- Header: name, category (`category?.name`, hidden when `null`, linking to the filtered
  list), date, authors, number of questions, buttons **Edit** and **Delete**
  (same confirm as the list; after delete go back to the list).
- Each question in order:
  - "Question {n}"
  - The question HTML rendered with `[innerHTML]` (it is sanitized by the server; Angular's
    built-in sanitizer is fine, **no** `bypassSecurityTrust*`). Include Quill's CSS (same
    as article pages) so `ql-*` classes, alignment and lists render correctly. Images
    should be `max-width: 100%`.
  - **Answer** and **Comment** rendered as **text** with interpolation (`{{ }}`), keeping
    line breaks (`white-space: pre-line`). Hide the comment block when it's `''`.
- Optional: a "Hide answers" toggle (answers collapsed until clicked) so the admin can
  preview the questions as players see them.
- `404` → "Package not found" with a link back.

## 11. Images

- Reuse the existing upload flow; question images are ordinary `POST /images` uploads
  (allowed for moderators and admins; jpeg/png/webp/gif, max 5 MB, validated on the client
  first).
- Removing an image from a question doesn't delete the file; that's fine.
- If the app has an image library with delete, handle the new `409` message (section 4).

## 12. Tests (if the project has a test setup)

With `provideHttpClient()` + `provideHttpClientTesting()` and `HttpTestingController`:
- `list()` sends `GET {apiUrl}/what-where-when` with no params; `list({ page: 2 })` sends
  `page=2`; `list({ categoryId: 'abc' })` sends `categoryId=abc`.
- `WhatWhereWhenCategoriesService`: `list()` → `GET /what-where-when-categories`;
  `create({ name: 'x' })` → `POST` with that body; `update(id, { name: 'y' })` → `PATCH`;
  `delete(id)` → `DELETE`.
- Editor: choosing "No category" sends `categoryId: null`; editing a package preselects
  its category.
- `get('abc')` → `GET /what-where-when/abc`; `create(body)` → `POST` with the body;
  `update(id, { name: 'x' })` → `PATCH` with only `{ name: 'x' }`; `delete(id)` → `DELETE`.
- `isQuillHtmlEmpty('<p><br></p>')` is `true`; `isQuillHtmlEmpty('<p><img src="x"></p>')`
  is `false`; `isQuillHtmlEmpty('<p>a</p>')` is `false`.
- `realDate` rejects `2026-02-30` and accepts `2024-02-29`.
- Editor: "Add question" adds a card; move up/down reorders the FormArray; the built body
  trims answers and omits empty comments; saving an edited package sends the full
  `questions` array.

## 13. Deliverables checklist

- [ ] Interfaces (section 3) and `API_LIMITS.whatWhereWhen`
- [ ] `WhatWhereWhenService` with `list`, `get`, `create`, `update`, `delete`
- [ ] `WhatWhereWhenCategoriesService` (separate from the article `CategoriesService`)
- [ ] Admin routes behind `roleGuard(Role.Admin)` and a nav item visible to admins only
- [ ] Categories page: list with package counts, create/edit form, delete with the
      "still has packages" rule, `409` messages shown
- [ ] List page: query-param pagination and `categoryId` filter, category column,
      loading/empty/error states, delete with confirm
- [ ] Editor page: typed reactive form, category select (with "No category"), authors
      input, question cards with the **shared**
      Quill config and image handler, add/remove/reorder, client validation matching the
      server, full-list save, server error mapping, unsaved-changes guard
- [ ] View page: category, sanitized question HTML with Quill CSS, answers/comments as text
- [ ] New image-delete `409` message handled where images are deleted
- [ ] `ng build` passes

When you are done, list the files you created or changed and any project conventions you
followed instead of these defaults.

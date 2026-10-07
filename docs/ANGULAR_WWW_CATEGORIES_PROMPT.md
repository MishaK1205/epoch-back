# Prompt: add categories to the existing What? Where? When? admin screens

> Copy everything below the line into the AI assistant working on the Angular app.

---

You are working in my **Angular** frontend for the Epoch API (a NestJS backend). The
app **already has** the admin What? Where? When? ("რა? სად? როდის?") feature: models,
`WhatWhereWhenService` (`/what-where-when`), and the list, editor and view pages for quiz
packages. Don't rebuild those.

The backend just gained **categories for What? Where? When? packages** (e.g. "Autumn cup
2026"). The backend part is finished and tested. Your job is to add only the category
part:

1. Models and a new `WhatWhereWhenCategoriesService`.
2. An admin **categories page** (list, create, edit, delete).
3. Category support in the **existing** package screens: a category select in the
   editor, a category column and filter in the list, the category on the view page.

## 0. Before writing any code

1. Inspect the existing What? Where? When? code: its models file, `WhatWhereWhenService`,
   the list/editor/view page components, its routes, and the admin navigation. Also find
   the shared pieces: `environment.apiUrl`, `Paginated<T>`, `toHttpParams()`,
   `getApiErrorMessages()`, `roleGuard`, confirm dialog, toast, the `API_LIMITS` file.
2. **Extend what exists.** Add fields to the existing interfaces, a parameter to the
   existing `list()`, a control to the existing form. Don't create parallel models,
   services or pages for packages.
3. These categories are **separate from the article categories** the app already has
   (`CategoriesService`, `/categories`, with slugs and subcategories). Different
   endpoint, different model. Never mix them, and don't add methods to the article
   `CategoriesService`.
4. Follow the project's conventions (standalone vs NgModule, `inject()`, signals vs RxJS,
   `@if`/`@for`, naming, file layout, styling, i18n).
5. Don't invent endpoints, fields or query parameters that aren't in this prompt. Field
   names must match the JSON exactly. No `any`, strict TypeScript.
6. When finished, run `ng build` (or `npx tsc --noEmit -p tsconfig.app.json`) and fix
   every error.

## 1. How categories work

- **Admin only**, like the packages. Without a token `401`, non-admins `403`.
- A category has a `name` and an optional `description`. It is **flat** (no
  subcategories) and has **no slug**.
- `name` is **unique, ignoring case**: `spring cup` conflicts with `Spring Cup`.
- A package has **at most one** category, or none. Packages created before this change
  have no category.
- The admin's flow: create a category, then pick it when creating or editing a package.
- A category that still has packages **can't be deleted** (`409`). Move its packages to
  another category, or remove their category, first.
- Only the category id is stored on a package, so **renaming** a category shows the new
  name on every package immediately.

## 2. Base URL

- Categories: `${environment.apiUrl}/what-where-when-categories`. This is a separate
  prefix, **not** `/what-where-when/categories`.
- Packages stay at `${environment.apiUrl}/what-where-when`.
- The auth interceptor already adds the token. Don't add headers manually.

## 3. Interfaces

### New (add next to the existing What? Where? When? models)

```ts
/** GET /what-where-when-categories */
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
```

### Changes to the existing interfaces

```ts
export interface WhatWhereWhenSummary {
  // ...existing fields (id, name, authors, date, questionCount, createdAt, updatedAt)
  category: WhatWhereWhenCategorySummary | null; // NEW; null = no category
}
// WhatWhereWhenPackage extends WhatWhereWhenSummary, so it gets `category` too.

export interface CreateWhatWhereWhenRequest {
  // ...existing fields (name, authors?, date, questions?)
  categoryId?: string | null; // NEW; a WhatWhereWhenCategory id; omit or null = no category
}
// UpdateWhatWhereWhenRequest = Partial<CreateWhatWhereWhenRequest> (unchanged), so on PATCH:
//   categoryId omitted -> keep the current category
//   categoryId: null   -> remove the category
//   categoryId: '<id>' -> set it

export interface ListWhatWhereWhenQuery {
  page?: number;
  limit?: number;
  categoryId?: string; // NEW; only packages in this category
}
```

Note the naming: requests send **`categoryId`** (a string), responses return
**`category`** (an object or `null`).

### Limits

Add to the existing `API_LIMITS.whatWhereWhen` block:

```ts
categoryName: { min: 1, max: 100 },
categoryDescription: { max: 500 },
```

## 4. Endpoints

### New: categories (all Admin)

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| GET | `/what-where-when-categories` | `200` **plain array** `WhatWhereWhenCategory[]` (not paginated), sorted by name | `401`; `403` |
| GET | `/what-where-when-categories/:id` | `200` `WhatWhereWhenCategory` | `400 id must be a mongodb id`; `404 What? Where? When? category not found` |
| POST | `/what-where-when-categories` | `201` `WhatWhereWhenCategory` | `400` validation; `409 A What? Where? When? category with this name already exists` |
| PATCH | `/what-where-when-categories/:id` | `200` `WhatWhereWhenCategory` | `400`; `404`; `409` (same message, when renaming to an existing name) |
| DELETE | `/what-where-when-categories/:id` | `204` no body | `404`; `409 Category is used by N package(s); move or delete them first` |

Validation `400` messages (`message` is a string array; use `getApiErrorMessages()`):
`name must be longer than or equal to 1 characters`,
`name must be shorter than or equal to 100 characters`,
`description must be shorter than or equal to 500 characters`,
`property X should not exist` (unknown fields are rejected). The server trims `name` and
`description`.

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

### Changed: packages

| Method | Path | What changed |
| --- | --- | --- |
| GET | `/what-where-when?page&limit&categoryId` | New optional `categoryId` filter. An unknown (but well-formed) id returns an empty page; a malformed id returns `400 categoryId must be a mongodb id`. Every item now has `category`. |
| GET | `/what-where-when/:id` | Response now has `category`. |
| POST | `/what-where-when` | Body accepts optional `categoryId` (`string` or `null`). |
| PATCH | `/what-where-when/:id` | Body accepts `categoryId`: omit = keep, `null` = remove, id = set. |

New `400` messages on package create/update:
- `categoryId must be a mongodb id`: malformed id.
- `Category does not exist`: the category was deleted, or the id is unknown.

Example package (only the new field is new):

```json
{
  "id": "6ac64e4e592927df3acc336b",
  "name": "Autumn cup, round 1",
  "authors": ["Giorgi", "Nino"],
  "category": { "id": "6ac654618280bf721188b701", "name": "შემოდგომის თასი" },
  "date": "2026-10-07",
  "questionCount": 12,
  "createdAt": "2026-10-07T13:51:10.878Z",
  "updatedAt": "2026-10-07T13:51:10.878Z"
}
```

## 5. Services

### New `WhatWhereWhenCategoriesService`

E.g. `core/services/what-where-when-categories.service.ts`, `providedIn: 'root'`, written
in the same style as the existing `WhatWhereWhenService`:

```ts
@Injectable({ providedIn: 'root' })
export class WhatWhereWhenCategoriesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/what-where-when-categories`;

  list(): Observable<WhatWhereWhenCategory[]> {
    return this.http.get<WhatWhereWhenCategory[]>(this.baseUrl);
  }

  get(id: string): Observable<WhatWhereWhenCategory> {
    return this.http.get<WhatWhereWhenCategory>(`${this.baseUrl}/${id}`);
  }

  create(body: CreateWhatWhereWhenCategoryRequest): Observable<WhatWhereWhenCategory> {
    return this.http.post<WhatWhereWhenCategory>(this.baseUrl, body);
  }

  update(id: string, body: UpdateWhatWhereWhenCategoryRequest): Observable<WhatWhereWhenCategory> {
    return this.http.patch<WhatWhereWhenCategory>(`${this.baseUrl}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
```

Return the cold Observables; don't catch errors in the service.

Several screens need the category list (categories page, package list filter, package
editor). Keep it consistent: either a small store with a `categories` signal and a
`reload()` that the categories page calls after every create/update/delete, or simply call
`list()` when each of those pages opens. Never show a stale list after a change on the
categories page.

### Existing `WhatWhereWhenService`

- `list(query)` must pass `categoryId` through. If it already uses `toHttpParams(query)`
  and the type now includes `categoryId`, nothing else is needed; make sure an
  empty/undefined `categoryId` is **not** sent.
- `create`/`update` need no code change beyond the types: the body now may contain
  `categoryId`.

## 6. Routes and navigation

Add inside the existing admin What? Where? When? routes, behind the same
`roleGuard(Role.Admin)`:

| Route | Component |
| --- | --- |
| `/admin/what-where-when/categories` | `WwwCategoriesPageComponent` (lazy, standalone) |

Adapt the prefix to whatever the existing package routes use. Declare `categories`
**before** `:id`, otherwise `categories` is treated as a package id. In the admin
navigation, turn the What? Where? When? item into two links, "Packages" and
"Categories" (or add a "Categories" tab/button on the packages list page).

## 7. Categories page

`WwwCategoriesPageComponent`, e.g. in `features/admin/what-where-when/categories/`.

**List**
- Load with `categoriesService.list()`.
- Table: **Name**, **Description** (or "—" when `''`), **Packages** (`packageCount`,
  shown as a link to the package list filtered by this category:
  `/admin/what-where-when?categoryId=<id>`), actions **Edit** and **Delete**.
- States: loading, empty ("No categories yet" + "New category" button), error with
  "Try again".

**Create / edit**
- "New category" opens an inline form or a dialog (reuse the project's dialog/form
  patterns) with:
  - `name`: required, not blank after trimming, `maxlength="100"`.
  - `description`: optional textarea, `maxlength="500"`.
- Edit opens the same form prefilled. Send the changed fields (sending both is fine);
  `''` clears the description.
- On success update the list (insert/replace and keep it sorted by name, or reload) and
  show a toast.
- `409`: show the server message under the name field.
- Disable Save while the request is running.

**Delete**
- If `packageCount > 0`, don't call the API: show "This category has N package(s). Move
  them to another category first." with a link to the filtered package list.
- Otherwise confirm ("Delete category "{name}"?"), then `delete(id)`. On `204` remove it
  from the list and show a toast.
- Still handle a `409` from the server (a package may have been added meanwhile): show
  its message and reload the list. On `404` just reload.

## 8. Changes to the existing package list page

- Read **`categoryId`** from the query params, next to the existing `page`
  (`/admin/what-where-when?page=2&categoryId=6ac6...`), and pass it to `list()`.
- Add a **category filter** select above the list: "All categories" (no `categoryId`) +
  each category as `name (packageCount)`. Changing it navigates with the new
  `categoryId` and resets `page` to 1. Selecting "All categories" removes the param.
- If the URL has a `categoryId` that isn't in the loaded categories (deleted), keep the
  filter value, show the (empty) result and an option to clear the filter. Don't crash.
- Add a **Category** column: `category?.name`, or "—" when `null`. Clicking the name
  applies that filter.
- The "New package" button, when a filter is active, links to
  `/admin/what-where-when/new?categoryId=<id>` so the editor can preselect it.

## 9. Changes to the existing editor page

- Add a `categoryId` control to the form: `this.fb.control<string | null>(null)`.
- Add a **Category** select near name/date:
  - First option "No category" with value `null`.
  - Then every category from `categoriesService.list()`, sorted by name.
  - Compare by id (if using `[ngValue]`/`mat-select`, make sure `null` works as a value).
- **Edit mode:** set `categoryId` to `package.category?.id ?? null` when patching the
  form from the loaded package.
- **Create mode:** if the route has `?categoryId=<id>` (coming from a filtered list),
  preselect it; otherwise `null`.
- Next to the select, a small "Manage categories" link to the categories page. Optional
  nicety: a "+ New category" button that opens the create-category dialog and selects
  the new category after `201`.
- If no categories exist yet, show a hint with a link to the categories page. A package
  can still be saved without a category.
- **Saving:** include `categoryId: value.categoryId` in the body for both create and
  update. `null` means "no category" (and on update removes an existing one). Because the
  editor sends the full form, always sending `categoryId` is correct.
- **Errors:** on `Category does not exist` (the category was deleted meanwhile), reload
  the categories, reset the select to "No category", highlight the field and ask the
  user to choose again. Show other messages with `getApiErrorMessages()` as the editor
  already does.
- After a successful save the form is reset from the returned package (the editor
  already does this); make sure `categoryId` is taken from `category?.id ?? null`.
- The unsaved-changes guard should treat a changed category as a change (it will, if it
  checks `form.dirty`).

## 10. Changes to the existing view page

- Show the category in the header next to the date and authors: `category.name` as a
  link to `/admin/what-where-when?categoryId=<id>`. Hide it when `category` is `null`.

## 11. Tests (if the project has a test setup)

With `provideHttpClient()` + `provideHttpClientTesting()` and `HttpTestingController`:
- `WhatWhereWhenCategoriesService`: `list()` → `GET {apiUrl}/what-where-when-categories`;
  `get(id)` → `GET .../:id`; `create({ name: 'x' })` → `POST` with that body;
  `update(id, { description: '' })` → `PATCH` with that body; `delete(id)` → `DELETE`.
- `WhatWhereWhenService.list({ categoryId: 'abc' })` sends `categoryId=abc`;
  `list({ page: 1 })` sends no `categoryId`.
- Editor: editing a package with a category preselects it; choosing "No category" sends
  `categoryId: null`; `?categoryId=<id>` preselects in create mode.
- Categories page: delete is not called when `packageCount > 0`.

## 12. Deliverables checklist

- [ ] `WhatWhereWhenCategory`, `WhatWhereWhenCategorySummary`, category request types;
      `category` / `categoryId` added to the existing package interfaces; limits added
- [ ] `WhatWhereWhenCategoriesService` (separate from the article `CategoriesService`)
- [ ] `/admin/what-where-when/categories` route (declared before `:id`) and navigation link
- [ ] Categories page: list with package counts, create/edit, delete with the
      "still has packages" rule, `409` messages shown
- [ ] Package list: `categoryId` query param + filter select, Category column
- [ ] Package editor: category select with "No category", preselect in edit and from
      `?categoryId`, `categoryId` sent on save, `Category does not exist` handled
- [ ] Package view: category shown
- [ ] `ng build` passes

When you are done, list the files you created or changed and any project conventions you
followed instead of these defaults.

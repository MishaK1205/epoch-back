# Prompt: add subcategories to the Angular app

> Copy everything below the line into the AI assistant working on the Angular app.

---

You are working in my **Angular** frontend for the Epoch API (a NestJS backend). The
backend now supports **subcategories**. The backend part is finished, tested and
backward compatible. Your job is to update the typed client layer, the **admin
add/edit category** flow, the **add/edit article** flow, and the places that display or
filter by category.

## 0. Before writing any code

1. Inspect the project and find everything that touches categories:
   - the `Category` / `CategorySummary` / `ArticleSummary` models
   - `CategoriesService` and `ArticlesService` (or whatever they're called)
   - the admin category pages (list, create, edit, delete)
   - the article editor (create and edit), especially the category picker
   - public pages that list categories (nav menu, sidebar, category page, filters) and
     that show an article's category (cards, article page, breadcrumbs)
   - any code that searches `categories` by id or slug (e.g. `categories.find(c => c.id === ...)`)
2. **Follow the project's existing conventions** (standalone vs NgModule, `inject()`,
   signals vs RxJS, reactive forms, UI library, naming, folder layout). Reuse existing
   components and helpers; don't create parallel ones.
3. Don't invent endpoints, fields or query parameters that aren't in this prompt. Field
   names must match the JSON exactly. No `any`.
4. When finished, run `ng build` (or `npx tsc --noEmit -p tsconfig.app.json`) and fix
   every error. Then list every file you changed.

## 1. What changed on the backend

- A **subcategory** is a category with a `parent`. Subcategories are **optional** and
  **one level deep**: a category may have zero or more subcategories, and a subcategory
  can't have its own subcategories.
- An article has a required top-level `category` and an **optional** `subcategory`,
  which must be a child of that category. So an article is either in "category only" or
  "category + subcategory".
- Existing data is unchanged. All existing categories are top-level with no
  subcategories, and existing articles have `subcategory: null`.
- **The one breaking change:** `GET /categories` now returns **only top-level
  categories**, each with its subcategories nested in `subcategories`. Subcategories are
  **not** repeated at the top level. Any code that looks up a category by id/slug in that
  flat array must also search the nested `subcategories` (see section 3).
- Names and slugs are unique across **all** categories and subcategories.

## 2. Model changes

Replace the category models and update `ArticleSummary`:

```ts
export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

/** A category or a subcategory. */
export interface CategoryBase extends CategorySummary {
  description?: string;           // omitted when empty
  parent: CategorySummary | null; // set for subcategories; null for top-level categories
  articleCount: number;           // PUBLISHED articles; a top-level count INCLUDES its subcategories' articles
  createdAt: string;
  updatedAt: string;
}

/** What GET /categories, GET /categories/:slug, POST and PATCH return. */
export interface Category extends CategoryBase {
  subcategories: CategoryBase[];  // sorted by name; always [] for a subcategory and for categories without any
}

export interface ArticleSummary {
  // ...all existing fields unchanged...
  category: CategorySummary | null;    // always a top-level category
  subcategory: CategorySummary | null; // NEW: null when the article has no subcategory
}
```

`Article` (with `content`) extends `ArticleSummary`, so it gets `subcategory` too. Every
article response (lists, `GET /articles/:slug`, `GET /articles/manage/:id`, create,
update, publish, unpublish, reading lists) now includes `subcategory`.

Request types:

```ts
// POST /categories
export interface CreateCategoryRequest {
  name: string;         // 2–50 chars; must contain a letter or digit; unique across ALL categories and subcategories
  description?: string; // max 500
  parentId?: string;    // NEW: id of a TOP-LEVEL category -> creates a subcategory of it
}

// PATCH /categories/:id  — parentId is NOT allowed (the parent can never change)
export type UpdateCategoryRequest = Partial<Omit<CreateCategoryRequest, 'parentId'>>;

// POST /articles
export interface CreateArticleRequest {
  title: string;
  content: string;
  coverImageId: string;
  categoryId: string;            // must be a TOP-LEVEL category
  subcategoryId?: string | null; // NEW: optional; must be a subcategory of categoryId; omit or null = none
  tags?: string[];
}

// PATCH /articles/:id
export type UpdateArticleRequest = Partial<CreateArticleRequest>;
// subcategoryId on PATCH: omit = keep current, null = remove, id = set
```

Query types: `ListArticlesQuery.category` (slug) and `categoryId`, and
`ManageArticlesQuery.categoryId`, now accept a category **or** a subcategory. No new
query parameters.

## 3. Category helpers (shared)

Because `GET /categories` is nested now, add small pure helpers next to the category
model, e.g. `core/models/category.utils.ts`, and use them everywhere instead of
searching the array directly:

```ts
/** Top-level categories and all subcategories in one flat list. */
export function flattenCategories(categories: Category[]): CategoryBase[] {
  return categories.flatMap((category) => [category, ...category.subcategories]);
}

export function findCategoryById(categories: Category[], id: string): CategoryBase | undefined {
  return flattenCategories(categories).find((category) => category.id === id);
}

export function findCategoryBySlug(categories: Category[], slug: string): CategoryBase | undefined {
  return flattenCategories(categories).find((category) => category.slug === slug);
}

export function isSubcategory(category: CategoryBase): boolean {
  return category.parent !== null;
}
```

If the app caches categories (a signal, a store, `shareReplay`), keep caching the nested
`Category[]` and **invalidate/refresh it after any category create, update or delete**.

## 4. Service changes

`CategoriesService`: the method signatures stay the same. Only the types change
(`Category` now has `parent` and `subcategories`) and `create()` accepts `parentId`. Update
the JSDoc:

| Method | HTTP | Notes |
| --- | --- | --- |
| `list(): Observable<Category[]>` | `GET /categories` | top-level only, subcategories nested |
| `getBySlug(slug): Observable<Category>` | `GET /categories/:slug` | works for both; for a subcategory `parent` is set and `subcategories` is `[]` |
| `create(body): Observable<Category>` | `POST /categories` | `parentId` creates a subcategory |
| `update(id, body): Observable<Category>` | `PATCH /categories/:id` | name/description only; never send `parentId` |
| `delete(id): Observable<void>` | `DELETE /categories/:id` | see errors in section 5 |

`ArticlesService`: no signature changes. Make sure `create()` / `update()` pass
`subcategoryId` through, including an explicit `null`. Don't strip `null` from the
**body** (the `toHttpParams()` helper skipping `null` is for query params only).

## 5. Admin: add / edit category flow

### Category list page

- Show categories as a **two-level tree**: each top-level category with its
  subcategories indented underneath (or an expandable row). Show `articleCount` for
  both levels and make clear that the top-level count includes its subcategories.
- Row actions:
  - top-level category: **Edit**, **Delete**, **Add subcategory**
  - subcategory: **Edit**, **Delete** (no "Add subcategory"; only one level is allowed)
- A top-level **"Add category"** button creates a top-level category.

### Create form

- Fields: `name` (required, 2–50), `description` (optional, max 500), and **Parent**:
  a select with **"None (top-level category)"** as the default plus every **top-level**
  category from `list()`. Never offer subcategories as parents.
- "Add subcategory" from a row opens the same form with Parent preselected (it can stay
  editable or be locked, whichever fits the UI).
- Submit: `create({ name, description, parentId })`. **Omit** `parentId` when "None"
  is selected; don't send `null` or `''`.
- Success: refresh the cached categories; show the new item under its parent.

### Edit form

- Fields: `name` and `description` only.
- Show the parent **read-only** (e.g. "Subcategory of History", or "Top-level
  category"). The parent can't be changed. If the user needs to move a subcategory,
  they create a new one and reassign the articles.
- Never send `parentId` in PATCH. The server rejects it with
  `400 property parentId should not exist`.
- Renaming changes the `slug`. Use the returned object, and refresh the cache.
- If the edited category is a top-level one with subcategories, list them read-only on
  the edit page (optional, nice to have).

### Delete

- Confirm first. Show the server's message on 409. The possible messages are:
  - `Category has N subcategory(ies); delete them first`: offer to go to those
    subcategories.
  - `Category is used by N article(s); move or delete them first`: this also applies to
    a subcategory used by articles. Linking to the manage list filtered by
    `categoryId` (see section 7) helps the admin find those articles.
- You may disable the Delete button upfront when `subcategories.length > 0`, but still
  handle the 409 (counts can change, and `articleCount` only counts published articles,
  while drafts also block deletion).

### Errors to map to the form

| Status | Message | Where to show |
| --- | --- | --- |
| 400 | `Parent category does not exist` | Parent field (the parent was deleted meanwhile; refresh the list) |
| 400 | `Subcategories cannot have their own subcategories` | Parent field |
| 400 | `Category name must contain letters or numbers` | Name field |
| 409 | `A category with this name already exists` | Name field. Names are unique across **all** categories and subcategories, and also catch differences in case/punctuation only. |

## 6. Add / edit article flow (the editor)

### Pickers

Replace the single category picker with two dependent pickers:

1. **Category** (required): only **top-level** categories, i.e. the items of `list()`.
2. **Subcategory** (optional): the `subcategories` of the selected category, with
   **"None"** as the first and default option.
   - Hide or disable it when no category is selected or the selected category has no
     subcategories (keep the value `null`).
   - Its options always come from the currently selected category.

Form model (reactive forms example; adapt to the project):

```ts
categoryId: FormControl<string | null>   // required
subcategoryId: FormControl<string | null> // default null
```

Rules:
- **When `categoryId` changes, reset `subcategoryId` to `null`** (unless the current
  subcategory belongs to the new category, which can't happen with these pickers, so
  just reset). Do this in a `valueChanges` subscription (cleaned up with
  `takeUntilDestroyed`) or an `effect`, whatever the project uses.
- Validate on the client: if `subcategoryId` is set, it must be in the selected
  category's `subcategories`. The server enforces this anyway.

### Create (`POST /articles`)

- Send `categoryId` and, only if chosen, `subcategoryId`. You may omit
  `subcategoryId` when it's `null`.
- Articles are still created as drafts.

### Edit (`GET /articles/manage/:id`, then `PATCH /articles/:id`)

- **Prefill:** `categoryId = article.category?.id`,
  `subcategoryId = article.subcategory?.id ?? null`. Set the category **before** the
  subcategory, so the reset-on-change logic doesn't wipe the prefilled subcategory
  (e.g. `patchValue` with `{ emitEvent: false }` for the category, or set both together
  and only reset on user-driven changes).
- If `article.category` is `null` (the category was deleted), leave the picker empty and
  required.
- **Sending changes:** if the project sends only changed fields:
  - category changed: send **both** `categoryId` and `subcategoryId` (the new one, or
    `null`). If you send only `categoryId` while the article still has a subcategory
    from the old category, the server returns
    `400 Subcategory does not belong to the selected category`.
  - only subcategory changed: send `subcategoryId` (an id, or `null` to remove it).
  - neither changed: send neither.
  Sending both `categoryId` and `subcategoryId` on every save is also correct and simpler.

### Article errors to map to the form

| Message (400) | Where to show |
| --- | --- |
| `Category does not exist` | Category picker (refresh the categories) |
| `categoryId must be a top-level category; send the subcategory as subcategoryId` | Category picker. This is a client bug: the picker offered a subcategory. |
| `Subcategory does not exist` | Subcategory picker (refresh the categories) |
| `Subcategory does not belong to the selected category` | Subcategory picker |
| `subcategoryId must be a mongodb id` | Subcategory picker (client bug, e.g. `''` was sent instead of `null`) |

Never send `''` for `subcategoryId`. Use `null` or omit it.

## 7. Displaying and filtering (public and manage pages)

- **Article cards and the article page:** show `category.name`, plus
  `subcategory.name` when present (e.g. "History › Medieval" or two chips). Link the
  category to `/category/${encodeURIComponent(category.slug)}` and the subcategory to its
  own slug, using the app's existing category route.
- **Category page** (`GET /categories/:slug`, then `GET /articles?category=<slug>`):
  - For a top-level category, show its `subcategories` as chips/tabs above the list.
    Selecting one loads `GET /articles?category=<subcategory slug>`; "All" goes back to
    the parent slug. The parent's list already includes the subcategories' articles.
  - For a subcategory, show a breadcrumb `parent.name › name` with a link back to the
    parent.
- **Navigation menus / sidebars:** show top-level categories, with subcategories as a
  nested menu or dropdown when `subcategories.length > 0`.
- **Filters on list pages** (public `category`/`categoryId`, manage `categoryId`): a
  filter may be either a top-level category or a subcategory. A grouped select
  (`<optgroup>` per top-level category, with the category itself as the first option)
  works well. No new query parameters are needed.
- Slugs can be Georgian. Always `encodeURIComponent()` them in URLs.

## 8. Tests (if the project has a test setup)

- `flattenCategories` / `findCategoryById` find both top-level categories and
  subcategories.
- The article form resets `subcategoryId` to `null` when the user changes `categoryId`,
  and keeps the prefilled subcategory when loading an existing article.
- The edit-article save sends `subcategoryId: null` (not `''`, not omitted) when the
  user removes the subcategory, and sends both fields when the category changes.
- The category create form omits `parentId` for "None" and sends it for a subcategory;
  the edit form never sends `parentId`.
- With `HttpTestingController`: `categoriesService.create({ name: 'Medieval', parentId: 'abc' })`
  sends `POST {apiUrl}/categories` with exactly that body.

## 9. Deliverables checklist

- [ ] Models updated: `CategoryBase`, `Category.subcategories`, `Category.parent`, `ArticleSummary.subcategory`, request types with `parentId` / `subcategoryId`
- [ ] Category helpers (`flattenCategories`, `findCategoryById`, `findCategoryBySlug`, `isSubcategory`), with every flat lookup replaced
- [ ] Admin category list shown as a tree with "Add subcategory"; create form with Parent; edit form with read-only parent; delete handling both 409s
- [ ] Article editor with dependent Category + Subcategory pickers, reset on category change, correct prefill, correct PATCH payloads, errors mapped
- [ ] Cards, article page, category page, menus and filters show subcategories
- [ ] Category cache refreshed after category create, update or delete
- [ ] `ng build` passes

When you are done, list the files you created or changed, and point out anything in
the existing UI you couldn't map cleanly to these rules.

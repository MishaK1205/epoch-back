# Prompt: add article search to the Angular app

> Copy everything below the line into the AI assistant working on the Angular app.

---

You are working in my **Angular** frontend for the Epoch API (a NestJS backend). The
backend just gained a dedicated **search endpoint** that finds published articles by
**title and tags**, including **partial words**. The backend part is finished and tested.
Your job is to add the typed client method and build the search UI: a search box in the
site header with live suggestions, and a full search results page.

## 0. Before writing any code

1. Inspect the project. Find the existing API layer: `environment.apiUrl`, the
   `Paginated<T>` interface, `ArticleSummary`, the existing `ArticlesService`
   (`/articles`), the `toHttpParams()` helper, `getApiErrorMessages()`, the existing
   article-card component, the header/navbar component, the routes file, and the folder
   where services and models live (often `src/app/core/`).
2. **Reuse those.** Add the new method to the existing `ArticlesService`; don't create a
   second articles service, a second `Paginated` or a second HTTP-params helper. Follow
   the project's existing conventions (standalone vs NgModule, `inject()`, signals vs
   RxJS state, control flow `@if`/`@for`, naming, file layout, styling approach, i18n).
3. Don't invent endpoints, fields or query parameters that aren't in this prompt. Field
   names must match the JSON exactly.
4. No `any`. Strict TypeScript. Never use `innerHTML` or `bypassSecurityTrust*` for
   search results or highlighting.
5. When finished, run `ng build` (or `npx tsc --noEmit -p tsconfig.app.json`) and fix
   every error.

## 1. What the feature does

- The user types text; the API returns **published** articles whose **title** or any
  **tag** contains that text.
- **Partial match:** the text can appear anywhere inside a word. Typing `სებას` finds an
  article titled `იოჰან სებასტიან ბახი`, and also an article that has
  `იოჰან სებასტიან ბახი` as a tag.
- **Case-insensitive:** `baroque`, `BAROQUE` and `Bar` all match `Baroque`.
- **Several words:** the query is split on spaces and **every** word must appear in the
  title or in a tag (in any order, not necessarily the same field). `სებას ბახ` matches
  the article above; `ბახ zzz` matches nothing.
- Special characters are literal: `c++` searches for the text `c++`, `.*` matches only
  titles/tags that literally contain `.*`.
- Article **content is not searched.** Only title and tags.
- Results are sorted **newest published first** (not by relevance) and paginated.
- Public: no login needed. Drafts never appear.

### This is not the same as `GET /articles?q=`

The existing `q` parameter on `GET /articles` is a **whole-word full-text search over
title and content**; it does **not** find partial words (`სებას` finds nothing there).
For the search box and search page, use **only** the new `GET /articles/search`. Leave
any existing use of `GET /articles?q=` alone unless it powers a search box, in which case
switch that box to the new endpoint.

## 2. Base URL and auth

- URL: `${environment.apiUrl}/articles/search`. Dev: `http://localhost:3000`,
  production: `https://api.epoch.ge`. Never hardcode the host.
- Public endpoint. The auth interceptor may attach a token if the user is logged in; that
  is harmless. Don't add headers manually.

## 3. Interfaces

Add the query interface next to the other article request interfaces (e.g.
`core/models/article.model.ts` or wherever `ListArticlesQuery` lives), and export it from
the models barrel if there is one:

```ts
/** GET /articles/search */
export interface SearchArticlesQuery {
  q: string;      // required; 1–100 characters after trimming; partial, case-insensitive match on title and tags
  page?: number;  // integer >= 1, default 1
  limit?: number; // integer 1–100, default 20
}
```

The response is the existing `Paginated<ArticleSummary>`. These already exist; reproduced
for reference only, **don't duplicate them**:

```ts
export interface Paginated<T> {
  items: T[];
  total: number; // total matches across all pages
  page: number;
  limit: number;
}

export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;                     // plain text, ~200 chars, may end with '…'
  coverImage: ImageSummary | null;
  category: CategorySummary | null;    // top-level category
  subcategory: CategorySummary | null;
  tags: string[];                      // lowercase
  author: AuthorSummary | null;
  status: 'draft' | 'published';       // always 'published' here
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Results contain **no** `content`; link each one to the public article page
`/articles/${encodeURIComponent(article.slug)}`.

Add the limit to the shared validation constants (if the project has an `API_LIMITS` /
validation constants file):

```ts
searchQuery: { maxLength: 100 },
```

## 4. Endpoint

| Method | Path | Auth | Success | Errors |
| --- | --- | --- | --- | --- |
| GET | `/articles/search?q&page&limit` | Public | `200` `Paginated<ArticleSummary>`, newest `publishedAt` first | `400` when `q` is missing, blank (only spaces), longer than 100 characters, or `page`/`limit` are invalid |

Rules to rely on:
- No matches is **not** an error: `200` with `{ items: [], total: 0, page, limit }`.
- `q` is trimmed by the server. Never send an empty or whitespace-only `q`; check on the
  client and don't call the API at all in that case.
- Sending unknown query parameters returns 400. Send only `q`, `page`, `limit`.
- Error shape: `{ statusCode, message, error }`; `message` is a string array for
  validation errors. Use the existing `getApiErrorMessages()`.

Example `GET /articles/search?q=სებას&limit=5`:

```json
{
  "items": [
    {
      "id": "6ac3b2f036b2e40ea3cdebbf",
      "title": "Baroque organ music",
      "slug": "baroque-organ-music",
      "excerpt": "…",
      "coverImage": { "id": "6ac3...", "url": "https://api.epoch.ge/uploads/0b8f....png", "alt": null },
      "category": { "id": "6ac3...", "name": "Music", "slug": "music" },
      "subcategory": null,
      "tags": ["იოჰან სებასტიან ბახი"],
      "author": { "id": "6ac3...", "username": "master_elodin" },
      "status": "published",
      "publishedAt": "2026-10-05T14:23:00.000Z",
      "createdAt": "2026-10-05T14:22:00.000Z",
      "updatedAt": "2026-10-05T14:23:00.000Z"
    },
    {
      "id": "6ac3b2f036b2e40ea3cdebbe",
      "title": "იოჰან სებასტიან ბახი",
      "slug": "იოჰან-სებასტიან-ბახი",
      "tags": ["baroque"],
      "...": "..."
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 5
}
```

Note the first result matched through its **tag**, not its title. The UI should make
that visible (see section 7).

## 5. Service method

Add to the existing `ArticlesService` (`/articles`):

| Method | Signature | HTTP |
| --- | --- | --- |
| search | `search(query: SearchArticlesQuery): Observable<Paginated<ArticleSummary>>` | `GET /articles/search` |

```ts
/** Public. Partial, case-insensitive match on title and tags. Published only, newest first. */
search(query: SearchArticlesQuery): Observable<Paginated<ArticleSummary>> {
  return this.http.get<Paginated<ArticleSummary>>(`${this.baseUrl}/search`, {
    params: toHttpParams(query),
  });
}
```

- Return the cold Observable straight from `HttpClient`; don't catch errors in the
  service.
- `toHttpParams()` encodes Georgian text correctly; don't encode `q` yourself (that
  would double-encode it).

## 6. Header search box with live suggestions

A search input in the site header (visible on every public page, logged in or not). As
the user types, show a dropdown with the top matches. Create it as its own component,
e.g. `shared/components/search-box/search-box.component.ts`.

### Behaviour

- Normalize the input before using it: `value.normalize('NFC').trim()`, and collapse
  inner whitespace (`.replace(/\s+/g, ' ')`).
- **Live suggestions** start at **2 characters** (after trimming). A single Georgian
  letter matches too many titles to be useful. Below 2 characters, close the dropdown and
  cancel any request in flight.
- `maxlength="100"` on the input, matching the server limit.
- Request suggestions with `search({ q, limit: 5 })`.
- **Debounce** 300 ms, skip unchanged values, and **cancel stale requests** so an older,
  slower response can never overwrite a newer one. Use this RxJS shape (or the signals
  equivalent with `toObservable`/`toSignal`):

  ```ts
  private readonly query$ = new Subject<string>();

  readonly state = toSignal(
    this.query$.pipe(
      map((value) => value.normalize('NFC').trim().replace(/\s+/g, ' ')),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((q) => {
        if (q.length < 2) {
          return of<SuggestState>({ status: 'idle' });
        }
        return this.articlesService.search({ q, limit: 5 }).pipe(
          map((page): SuggestState => ({ status: 'done', q, items: page.items, total: page.total })),
          startWith<SuggestState>({ status: 'loading', q }),
          catchError(() => of<SuggestState>({ status: 'error', q })),
        );
      }),
    ),
    { initialValue: { status: 'idle' } as SuggestState },
  );
  ```

  with `type SuggestState = { status: 'idle' } | { status: 'loading'; q: string } |
  { status: 'done'; q: string; items: ArticleSummary[]; total: number } |
  { status: 'error'; q: string }`.
  `catchError` must stay **inside** `switchMap`, otherwise one failed request kills the
  stream and the box stops working.

### Dropdown content

- While loading: a small spinner or "Searching…" (keep showing the previous results
  underneath if you have them, to avoid flicker).
- Results: up to 5 rows, each with the cover thumbnail (`coverImage?.url`, with a
  placeholder when `null`), the **highlighted title** (section 7), and the category name.
  If the match was in a tag and not in the title, show the matching tag as a small chip
  (section 7).
- If `total > 5`: a last row "See all {total} results" that opens the results page.
- No results: "Nothing found for "{q}"".
- Error: "Search is unavailable right now" (don't show raw server messages here).

### Interaction

- **Enter** with no row highlighted, or the search icon button: go to the results page
  `/search?q=<query>` (only if the trimmed query is at least 1 character).
- Clicking a result (or Enter on a highlighted row): navigate to
  `/articles/<encoded slug>`, close the dropdown, clear or keep the input (choose one and
  be consistent).
- **Arrow Up/Down** move the highlighted row (wrapping), **Escape** closes the dropdown
  (second Escape clears the input), clicking outside closes it, focusing the input again
  reopens it if there are results for the current text.
- Close the dropdown on navigation (`router.events` → `NavigationEnd`).
- Accessibility: use the ARIA combobox pattern. The input has `role="combobox"`,
  `aria-expanded`, `aria-controls` pointing at the list, `aria-autocomplete="list"`, and
  `aria-activedescendant` for the highlighted row; the list has `role="listbox"`, rows
  `role="option"` with `aria-selected`. Give the input an accessible label ("Search
  articles"). Announce the result count in an `aria-live="polite"` region.
- Mobile: the header can show only a search icon that expands the input or navigates
  straight to `/search`.

## 7. Highlighting and "matched in tag"

Show users **why** a result matched. Do it on the client, with no HTML strings.

Create a pure helper, e.g. `shared/utils/highlight.ts`:

```ts
export interface TextSegment {
  text: string;
  match: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits `text` into segments, marking every case-insensitive occurrence of any query word. */
export function highlight(text: string, query: string): TextSegment[] {
  const terms = query.normalize('NFC').trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return [{ text, match: false }];
  }
  // Longest first so "სებასტიან" wins over "სებ" when both are typed.
  const pattern = terms
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  // With a capturing group, split() puts the matched parts at the odd indexes.
  return text
    .normalize('NFC')
    .split(new RegExp(`(${pattern})`, 'iu'))
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter((segment) => segment.text !== '');
}

/** Tags that contain at least one query word, for the "matched in tag" chips. */
export function matchingTags(tags: string[], query: string): string[] {
  const terms = query.normalize('NFC').trim().toLowerCase().split(/\s+/).filter(Boolean);
  return tags.filter((tag) => terms.some((term) => tag.toLowerCase().includes(term)));
}
```

Render with Angular templates only:

```html
@for (segment of highlight(article.title, q); track $index) {
  @if (segment.match) {
    <mark class="search-hit">{{ segment.text }}</mark>
  } @else {
    {{ segment.text }}
  }
}
```

- Compute the segments in a `computed` or a pure pipe (e.g. `highlight` pipe), not by
  calling the function on every change detection cycle in big lists.
- `matchingTags(article.tags, q)`: show those tags as chips with the matched part
  highlighted the same way. Show them especially when the title has no match, so the user
  understands why `Baroque organ music` appeared for `სებას`.
- Style `<mark>` to fit the site theme (don't rely on the default yellow if it clashes).

## 8. Search results page

Route: `/search` (lazy-loaded standalone component, public, no guard), e.g.
`features/search/search-page.component.ts`.

### URL is the source of truth

- Read `q` and `page` from the **query params**: `/search?q=სებას&page=2`. This makes
  results shareable, bookmarkable, and keeps the browser back button working.
- Changing the query (submit in the page's own search input or the header box) navigates
  to `/search?q=<new>` and resets to page 1. Changing page navigates with the new `page`
  param, keeping `q`.
- Derive the request from `ActivatedRoute.queryParamMap` with `switchMap` (cancels the
  previous request on fast navigation). Validate: missing/blank `q` → don't call the API,
  show the empty-start state; non-numeric or `< 1` `page` → treat as 1.
- Page size 20 (`limit` omitted, server default) or a constant in the component.
- Pre-fill the page's search input (and the header box) with the current `q`.
- Set the document title, e.g. `Search: სებას | Epoch` (use Angular `Title`).

### States

- **Start** (no `q`): a large search input with a hint, e.g. "Search articles by title or
  tag".
- **Loading:** skeleton cards (reuse existing skeletons if the project has them).
- **Results:** heading "{total} results for "{q}"", then the existing **article-card**
  component for each item. Inside each card (or right below it), highlight the title and
  show matching-tag chips (section 7). If the existing card can't take a highlighted title,
  add an optional input to it (e.g. `highlightQuery`) instead of copying the card.
- **No results:** "Nothing found for "{q}"", plus suggestions: check spelling, try fewer
  words, or browse popular tags (load them with the existing `GET /tags?limit=10` and link
  each to the tag listing page the app already has, e.g. `/articles?tag=<tag>`).
- **Error:** message from `getApiErrorMessages()` for `400`, a generic message with a
  "Try again" button otherwise.
- **Pagination:** use `total`, `page` and `limit` from the response with the existing
  pagination component. If the URL asks for a page beyond the last one (`items` empty but
  `total > 0`), navigate to the last page. Scroll to top on page change.

### Clickable tags

Tag chips on result cards should link to the existing tag filter (`GET /articles?tag=`,
exact tag match), not to another search, unless the app has no tag page; in that case link
to `/search?q=<tag>`.

## 9. If shared pieces are missing

Only if the project doesn't already have them:
- `Paginated<T>` and `ArticleSummary` as in section 3.
- `toHttpParams(query)` that builds `HttpParams` and skips `undefined`, `null` and `''`.
- A simple pagination component (previous / next / page numbers) driven by `total`,
  `page`, `limit`.

## 10. Tests (if the project has a test setup)

With `provideHttpClient()` + `provideHttpClientTesting()` and `HttpTestingController`:
- `search({ q: 'სებას' })` sends `GET {apiUrl}/articles/search` with param `q=სებას` and
  no `page`/`limit` params.
- `search({ q: 'bach', page: 2, limit: 5 })` sends all three params.
- `highlight('იოჰან სებასტიან ბახი', 'სებას')` returns
  `[{ text: 'იოჰან ', match: false }, { text: 'სებას', match: true }, { text: 'ტიან ბახი', match: false }]`.
- `highlight('Learning C++', 'c++')` marks `C++` (regex characters are escaped, case
  ignored).
- `matchingTags(['იოჰან სებასტიან ბახი', 'baroque'], 'სებას')` returns the first tag only.
- Search box (with fake timers): typing 1 character sends no request; typing quickly
  sends one request after 300 ms; a newer query cancels the older pending request.
- Results page: `/search` with no `q` sends no request; `/search?q=x&page=abc` requests
  page 1.

## 11. Deliverables checklist

- [ ] `SearchArticlesQuery` interface (and `searchQuery` limit constant if the project has limits)
- [ ] `ArticlesService.search()`
- [ ] `highlight()` / `matchingTags()` helpers (or a `highlight` pipe) without `innerHTML`
- [ ] Header search box: debounced, cancels stale requests, min 2 characters, top 5, "See all", keyboard and ARIA combobox support
- [ ] `/search` page driven by query params, with start / loading / results / empty / error states and pagination
- [ ] Existing article card reused (optional highlight input), tag chips linking to the tag page
- [ ] `ng build` passes

When you are done, list the files you created or changed and any project conventions you
followed instead of these defaults.

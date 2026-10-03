# Prompt: point the Angular app at the production Epoch API

> Copy everything below the line into the AI assistant working on the Angular app.

---

You are working in my **Angular** frontend for "Epoch". The typed API client (models,
services, `authInterceptor`, `environment.apiUrl`) was already generated earlier. The
backend is now deployed to production, and the deployed frontend at `https://epoch.ge`
fails on every API call (including login) with `net::ERR_NAME_NOT_RESOLVED`.

The backend side is verified and working. Your job is to make the **production build of
the frontend call the production API correctly**. Do not change the API client's models,
endpoints or business logic. Only the configuration and deployment issues below.

## 0. Facts about the production setup (already verified, don't change them)

| Thing | Value |
| --- | --- |
| Frontend URL | `https://epoch.ge` (also `https://www.epoch.ge`), hosted on **Vercel** |
| Production API base URL | `https://api.epoch.ge` (HTTPS, valid certificate, no trailing slash) |
| Development API base URL | `http://localhost:3000` (unchanged) |
| Health check | `GET https://api.epoch.ge/` returns `Hello World!` |
| Swagger | `https://api.epoch.ge/docs`, OpenAPI JSON at `https://api.epoch.ge/docs-json` |
| CORS | The API allows any origin (`Access-Control-Allow-Origin: *`) and the `Authorization` and `Content-Type` headers. Auth uses a Bearer header, **not cookies**, so no `withCredentials`. |
| Uploaded images | Responses already contain **absolute** URLs, e.g. `https://api.epoch.ge/uploads/<uuid>.png`. Article HTML from the API also contains absolute image URLs. |

`ERR_NAME_NOT_RESOLVED` is a browser DNS error. `api.epoch.ge` resolves correctly
everywhere, so the deployed app is almost certainly requesting a **different hostname**:
`localhost`, a placeholder like `api.example.com`, a typo, or a path-only URL that ends up
on the wrong host. Find out which one and fix it.

## 1. Investigate first, then report what you found

Before editing anything:

1. Read `angular.json` (or `project.json`) and find the `production` build configuration:
   - Which `fileReplacements` exist (usually `environment.ts` → `environment.prod.ts`, or
     `environment.development.ts` → `environment.ts` in newer projects). Work out
     **which environment file actually ends up in the production build**.
   - What `defaultConfiguration` is for `build`. It must be `production`.
2. Open **every** file in `src/environments/` and note each `apiUrl` value.
3. Search the whole `src/` folder for hardcoded hosts and URLs that bypass
   `environment.apiUrl`:
   - `localhost`, `127.0.0.1`, `:3000`
   - `http://`, `https://`
   - `example.com`, `your-api`, `api.`, `epoch`
   - string literals passed directly to `HttpClient` (`this.http.get('/...` or
     `` `/articles` ``) without the `environment.apiUrl` prefix
4. Check `package.json` scripts and any Vercel config (`vercel.json`, the build command
   set in Vercel) to see which command builds the app for deployment
   (`ng build` vs `ng build --configuration development`, and so on).
5. Check whether the project uses SSR (`@angular/ssr`, a `server.ts`, `outputMode`,
   `prerender` in `angular.json`).

Tell me briefly what each `apiUrl` was, which file is used in production, and where any
hardcoded hosts were, before or alongside your fix.

## 2. Required changes

### 2.1 Environment files

Make sure there is a development and a production environment with the **same shape**:

```ts
// development (used by `ng serve`)
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
};
```

```ts
// production (used by `ng build`, the Vercel deployment)
export const environment = {
  production: true,
  apiUrl: 'https://api.epoch.ge',
};
```

- Keep the project's existing file naming. Older projects use `environment.ts` (dev) +
  `environment.prod.ts` (prod); newer ones (v17+ default) use
  `environment.development.ts` (dev) + `environment.ts` (prod). Put the production URL in
  the file that the `production` configuration actually uses.
- `fileReplacements` in `angular.json` must swap the files correctly for the
  configuration that Vercel builds. Add them if they're missing.
- **No trailing slash** on `apiUrl`. Services build URLs as
  `` `${environment.apiUrl}/articles` ``, and a trailing slash causes `//articles`.
- Production must use **`https://`**. An `http://` API URL from an `https://` page is
  blocked by the browser as mixed content.

### 2.2 Every request goes through `environment.apiUrl`

- Replace any hardcoded host (`http://localhost:3000`, placeholders, typos) with
  `environment.apiUrl`.
- Replace any relative API calls (`'/auth/login'`, `'/articles'`) with
  `` `${environment.apiUrl}/...` ``. Relative URLs hit `epoch.ge` (the frontend on Vercel),
  not the API.
- If there is an Angular dev proxy (`proxy.conf.json`), it only works for `ng serve`.
  Production must not rely on it.

### 2.3 The auth interceptor

- It must attach `Authorization: Bearer <token>` only to requests whose URL starts with
  `environment.apiUrl`. Confirm this still matches now that the production value is
  `https://api.epoch.ge` (no hardcoded `localhost` check left in the interceptor).
- Don't set `withCredentials: true`. The API doesn't use cookies, and it's unnecessary
  with `Access-Control-Allow-Origin: *`.

### 2.4 Images

- Image `url` fields and `<img src>` inside article `content` are already absolute
  (`https://api.epoch.ge/uploads/...`). **Use them as they are.** Remove any code that
  prefixes them with `apiUrl` or `localhost`, which would produce broken URLs.
- If an Angular `IMAGE_LOADER`, `NgOptimizedImage` config, or Content-Security-Policy
  restricts image hosts, allow `https://api.epoch.ge`.

### 2.5 Content Security Policy (only if one exists)

If the app sets a CSP (in `index.html` `<meta http-equiv="Content-Security-Policy">`, in
`vercel.json` headers, or in SSR server headers), add:

- `connect-src 'self' https://api.epoch.ge`
- `img-src 'self' data: https://api.epoch.ge`

Don't add a CSP if there isn't one.

### 2.6 Vercel deployment

- The Vercel build command must produce the **production** configuration (`ng build`
  with `defaultConfiguration: production`, or explicitly
  `ng build --configuration production`). Fix the `build` script or `vercel.json` if it
  builds the development configuration.
- The output directory must match Angular's output (usually `dist/<project>/browser` for
  the application builder). Check `angular.json` → `outputPath`.
- **Client-side routing:** if the app is a plain SPA (no SSR), make sure deep links like
  `https://epoch.ge/articles/some-slug` don't 404 on refresh. Add a `vercel.json` rewrite
  if one doesn't exist:

  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```

  Skip this if the project uses SSR or Vercel's Angular framework preset already
  handles it.
- If you prefer configuring the API URL in Vercel's environment variables instead of
  committing it, tell me first. Angular environment files are baked in at build time,
  so that needs a build-time replacement step. The default is to commit
  `https://api.epoch.ge` in the production environment file; it isn't a secret.

### 2.7 SSR (only if the project uses it)

- Server-side requests must also use `https://api.epoch.ge`, not `localhost`.
- Don't read the token from `localStorage` during server rendering (`localStorage`
  doesn't exist there). Guard with `isPlatformBrowser` / `afterNextRender`.

## 3. Don't

- Don't change models, service method signatures or endpoint paths.
- Don't add `withCredentials`, CORS headers on requests (`Access-Control-Allow-*` are
  response headers and must not be sent by the client), or a proxy for production.
- Don't hardcode `https://api.epoch.ge` anywhere except the production environment file.
- Don't remove the development `http://localhost:3000` setup; local development must
  keep working with `ng serve`.

## 4. Verify before you report

1. `ng build` (production configuration) passes with no errors.
2. Search the **built output** for the API host and for leftovers:
   - `grep -r "api.epoch.ge" dist/` finds matches.
   - `grep -r "localhost:3000" dist/` finds **nothing**.
3. `ng serve` still calls `http://localhost:3000` in development.
4. If you can run the production build locally (`npx http-server dist/<project>/browser`
   or `ng serve --configuration production`), open DevTools → Network, log in, and confirm
   the request goes to `https://api.epoch.ge/auth/login`. With wrong credentials it should
   return `401 {"message":"Invalid credentials","error":"Unauthorized","statusCode":401}`,
   not a network error.
5. After deploying to Vercel, check on `https://epoch.ge`:
   - Requests in the Network tab go to `https://api.epoch.ge/...`.
   - `GET https://api.epoch.ge/categories` returns 200 (an empty array `[]` is correct
     while there's no data).
   - Login works, and protected calls send the `Authorization` header.
   - Refreshing a deep link doesn't 404.

## 5. Report

Tell me:
- what the root cause was (which wrong URL was used and where it came from),
- every file you changed and why,
- the Vercel settings I need to change manually (build command, output directory,
  environment variables), if any,
- anything you couldn't verify.

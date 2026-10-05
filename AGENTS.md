# AGENTS.md — Working on `epoch-back`

This file is the single source of truth for how AI agents (and humans) work on this
NestJS backend. **Read it in full before starting any task.** If a task conflicts with
these rules, stop and ask the user instead of silently deviating. If you introduce a new
convention, update this file in the same change.

---

## 0. Mandatory workflow for every task

Follow these steps in order, every time:

1. **Read this file and `PROJECT_CONTEXT.md`**, all of both, not just the section you
   think is relevant. `PROJECT_CONTEXT.md` describes every existing endpoint, data model
   and business rule; check it before designing anything so you reuse what exists.
2. **Understand the request.** Restate the goal to yourself. If something blocks you
   (unclear business rules, conflicting requirements, destructive operations), ask the
   user before writing code. Don't ask about things you can reasonably decide yourself.
3. **Explore before editing.** Read the modules you will touch, plus `app.module.ts`,
   `main.ts`, and any existing feature module similar to what you are building.
   Reuse existing helpers, decorators, DTOs, and patterns instead of creating parallel ones.
4. **Plan the change.** List the files to create or modify. Keep the scope to what was
   asked; don't refactor unrelated code.
5. **Implement** following the conventions below (structure, DTOs, validation, Swagger,
   error handling, security).
6. **Verify** — all of these must pass before you report the task as done:
   - `npm run build` (type check + compile)
   - `npm run lint`
   - `npm test` (unit tests)
   - For HTTP changes, call the real endpoints (curl or Swagger) against the running
     dev server and check both the success and the error paths.
7. **Update docs**: `.env.example` for new env vars, the Swagger decorators for new or
   changed endpoints, this file for new conventions, and **`PROJECT_CONTEXT.md` for any
   new or changed endpoint, model, rule, env var, test or known gap**. Add a row to its
   change history.
8. **Report** what changed, how you verified it, and anything left unverified or open.

---

## 1. Tech stack (do not swap without asking)

| Concern        | Choice                                                         |
| -------------- | -------------------------------------------------------------- |
| Runtime        | Node.js 22+, **native ESM** (`"type": "module"`)               |
| Framework      | NestJS 12 (`@nestjs/core`, `@nestjs/common`, Express platform) |
| Language       | TypeScript 6, `strict: true`, `module: nodenext`               |
| Database       | MongoDB via Mongoose 9 + `@nestjs/mongoose`                    |
| Config         | `@nestjs/config` (global), validated in `src/config/`          |
| Validation     | `class-validator` + `class-transformer`, global `ValidationPipe` |
| Auth           | `@nestjs/jwt` (Bearer access tokens) + `bcryptjs` for hashing  |
| API docs       | `@nestjs/swagger`, served at `/docs` (JSON at `/docs-json`)    |
| Tests          | Vitest (`*.spec.ts` unit, `test/*.e2e-spec.ts` e2e) + supertest |
| Lint / format  | oxlint (`npm run lint`), Prettier (single quotes, trailing commas) |

Don't add a dependency when the existing stack can do the job. If you must add one,
pick a maintained package whose peer dependencies support NestJS 12, and say why in
your report.

---

## 2. ESM rules (the most common source of breakage)

- **Every relative import must end in `.js`**, even though the source file is `.ts`:
  ```ts
  // ✅
  import { UsersService } from '../users/users.service.js';
  // ❌ fails at runtime
  import { UsersService } from '../users/users.service';
  ```
- Never use `require`, `module.exports`, or `__dirname`. Use `import.meta.dirname` if needed.
- Top-level `await` is allowed (used in `main.ts`).
- Use `import type { ... }` for type-only imports where it helps (`isolatedModules` is on).
  **Exception:** types used in constructor injection or as decorated parameter types
  (DTOs in controller signatures) must be value imports, otherwise
  `emitDecoratorMetadata` can't emit them and DI/validation breaks.

---

## 3. Project structure

Organize by **feature module**, not by technical layer:

```
src/
  main.ts                      # bootstrap: global pipes, CORS, Swagger, listen
  app.module.ts                # root module: config, database, feature modules, global guard
  config/
    env.validation.ts          # validates process.env at startup
  common/                      # cross-cutting code shared by several features
    constants/                 # UPLOADS_URL_PREFIX, ...
    decorators/                # @Public(), @CurrentUser(), @Roles(), ...
    dto/                       # PaginationQueryDto, ObjectIdParamDto
    enums/                     # Role, ...
    guards/                    # JwtAuthGuard + RolesGuard (registered globally)
    interfaces/
    security/                  # password hashing, assertOwnerOrAdmin()
    utils/                     # slugify(), isDuplicateKeyError()
  users/  auth/                # accounts, login, roles, admin seeding
  categories/                  # article categories (admin-managed)
  images/                      # uploads stored on disk, served at /uploads
  articles/                    # articles, content sanitizing, GET /tags
  reading-list/                # per-user saved / read article lists under /me
  <feature>/                   # e.g. auth/, users/
    <feature>.module.ts
    <feature>.controller.ts    # HTTP layer only
    <feature>.service.ts       # business logic
    <feature>.service.spec.ts  # unit tests next to the code
    dto/                       # request + response DTOs (one class per file)
    schemas/                   # Mongoose schemas (one per file)
test/
  *.e2e-spec.ts
```

- File names: `kebab-case.<type>.ts` (`register.dto.ts`, `user.schema.ts`,
  `jwt-auth.guard.ts`). Classes: `PascalCase` with a suffix (`RegisterDto`,
  `UsersService`, `JwtAuthGuard`).
- One exported class per file for DTOs, schemas, guards, and decorators.
- Use `npx nest g module|controller|service <name> --no-spec` when helpful, then fix the
  generated imports to use `.js` extensions and write Vitest specs by hand.
- A module only exports the providers other modules actually need. Never import
  another module's schema model directly; go through its exported service.
- **No circular module imports** (they break under ESM). Dependencies flow one way:
 `reading-list` → `articles` → `categories`, `images`, `users`. When a lower module needs
 information from a higher one (e.g. "is this category/image still used by an article?"),
 it defines a small interface (`CategoryUsageChecker`, `ImageUsageChecker`) plus a
 `registerUsageChecker()` method, and the higher module registers itself in
 `onModuleInit`. Follow this pattern instead of `forwardRef`. The same applies to
 cleanup: a module that stores article references implements `ArticleDeletionListener`
 and calls `ArticlesService.registerDeletionListener()` so its rows are removed when an
 article is deleted.
- Build responses that reference other features with batched lookups through their
  services (`findSummariesByIds`, `findUsernamesByIds`), one query per feature per
  request, not `populate()` and not one query per item.

---

## 4. Layer responsibilities

**Controllers**
- Only map HTTP to service calls: read params/body/user, call one service method,
  return the result. No database access, no business rules, no `try/catch` for flow control.
- Always declare explicit return types and use DTOs for bodies, query, and params.
- Set status codes explicitly when they differ from the default
  (`@HttpCode(HttpStatus.OK)` for non-creating POSTs like login).

**Services**
- Own the business logic and validation that goes beyond DTO shape checks
  (uniqueness, ownership, state transitions).
- Throw Nest HTTP exceptions (`ConflictException`, `UnauthorizedException`,
  `NotFoundException`, `ForbiddenException`, `BadRequestException`) with clear messages.
- Return plain objects or response DTOs, **never raw Mongoose documents**, to clients.
  Map them explicitly (see `UsersService.toResponse`).

**Schemas (Mongoose)**
- Use `@Schema({ timestamps: true })` and `SchemaFactory.createForClass`.
- Export `type XDocument = HydratedDocument<X>`.
- Declare indexes and uniqueness in the schema (`unique: true`, `index: true`).
  Always handle duplicate-key errors (`code === 11000`) because unique checks done
  in the application can race.
- Sensitive fields (e.g. `password`) use `select: false`. Fetch them only where needed
  with `.select('+password')`.
- Normalize data at write time (`lowercase: true`, `trim: true`) so lookups are consistent.
- **Production has real data** (`https://api.epoch.ge`). Schema changes must be backward
  compatible: add new fields as optional with a `default` (usually `null`) and write
  queries that treat a missing field like the default (`{ field: null }` matches both).
  Don't rename or remove fields, change existing unique indexes, or run data migrations
  without asking the user first. Response changes should be additive.
- Use `.lean()` for read-only queries that don't need document methods.
- **References must use `Schema.Types.ObjectId`**, not `Types.ObjectId`. With Mongoose 9,
  `type: Types.ObjectId` is silently stored as a plain **string**, which breaks
  aggregations and `$in` lookups against real ObjectIds:
  ```ts
  import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
  // ✅
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  author: Types.ObjectId;
  // ❌ stored as a string
  @Prop({ type: Types.ObjectId, ref: 'User' })
  ```
- Aggregation pipelines are not cast by Mongoose: convert ids with
  `new Types.ObjectId(id)` inside `$match`.
- Public-facing documents get a `slug` generated with `slugify()` (Unicode-aware, so
  Georgian titles work). Never let a slug equal a static route segment (articles reserve
  `manage`).

---

## 5. DTOs, validation, and Swagger

The global `ValidationPipe` in `main.ts` runs with
`{ whitelist: true, forbidNonWhitelisted: true, transform: true }`. Unknown fields are
rejected with a 400 error.

Every DTO property must have **both** validation and Swagger decorators:

```ts
export class RegisterDto {
  @ApiProperty({ example: 'john_doe', minLength: 3, maxLength: 30 })
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_.]+$/)
  username: string;
}
```

- Optional fields: `@ApiPropertyOptional()` + `@IsOptional()`.
- Paginated list queries extend `PaginationQueryDto` (`page`, `limit` ≤ 100) and return
  `{ items, total, page, limit }`. Validate id route params with `ObjectIdParamDto`.
- Update DTOs extend `PartialType(CreateXDto)` imported from `@nestjs/swagger` (not
  `@nestjs/mapped-types`) so both validation and docs carry over.
- Normalize input with `@Transform` (trim, lowercase) when the schema does the same.
- Response DTOs also use `@ApiProperty` so Swagger shows the response shapes.

Every controller and endpoint must be documented:
- `@ApiTags('<feature>')` on the controller.
- `@ApiOperation({ summary })` on each handler.
- `@ApiOkResponse` / `@ApiCreatedResponse({ type: XResponseDto })` for success.
- Document the expected error responses (`@ApiBadRequestResponse`,
  `@ApiUnauthorizedResponse`, `@ApiConflictResponse`, ...).
- Protected endpoints: `@ApiBearerAuth()` (the scheme is registered in `main.ts`).

After changing endpoints, open `http://localhost:3000/docs` (or fetch `/docs-json`)
and confirm the endpoint, its schemas, and its auth lock icon appear correctly.

---

## 6. Authentication and security

- **Every route is protected by default.** `JwtAuthGuard` is registered globally via
  `APP_GUARD` in `app.module.ts`. Mark public routes explicitly with `@Public()`.
  Never disable the global guard to make a route work.
- Get the authenticated user with `@CurrentUser()`. It returns the `JwtPayload`
  (`{ sub, username, email }`); `sub` is the user id.
- Tokens: `Authorization: Bearer <token>`, signed with `JWT_SECRET`, lifetime
  `JWT_EXPIRES_IN` seconds.
- Passwords: always use `hashPassword()` / `verifyPassword()` from
  `src/common/security/password.ts` (bcryptjs, 12 rounds); never call bcrypt directly.
  Never log, return, or store plaintext passwords. Max length 72 (bcrypt's limit).
- Login failures always return a generic `401 Invalid credentials` and never reveal
  whether the username/email exists.
- Registration conflicts return `409` with a message naming the conflicting field.
- Never hardcode secrets. Read them via `ConfigService` and declare every env var in
  `src/config/env.validation.ts` and `.env.example`. Never commit `.env`.
- Never trust client-supplied ids for ownership; use `@CurrentUser().sub`.

### Roles and authorization

- Roles are defined in `src/common/enums/role.enum.ts`: `user` (default for everyone
  who registers), `moderator`, `admin`. Add new roles there only.
- Restrict a route or a whole controller with `@Roles(Role.Admin, ...)`. The global
  `RolesGuard` (registered after `JwtAuthGuard`) allows the request if the user has
  **any** of the listed roles. Routes without `@Roles` only need a valid token.
- `RolesGuard` reads the role from the **database**, not from the JWT, so role changes
  take effect immediately. Never put authorization decisions on token claims.
- Roles are never accepted from public input. Registration always creates `user`;
  only admins can change roles (`PATCH /users/:id/role`), and admins cannot change
  their own role.
- For restricted endpoints, also document `@ApiForbiddenResponse`.
- **Ownership:** on `@Roles` routes, `RolesGuard` copies the database role into
  `@CurrentUser().role`. Enforce "author or admin" in services with
  `assertOwnerOrAdmin(actor, ownerId)` and use `isAdmin(actor)` to widen list queries.
  Both fail closed when `role` is absent, so only call them from `@Roles` routes.
- Do not put a class-level `@Roles` on a controller that also has `@Public()` routes;
  `RolesGuard` would still require a user for them. Put `@Roles` on each protected route.
- Current permissions: categories are admin-only to write; images and articles are
  written by moderators and admins, where moderators manage only their own and admins
  manage everything. Public endpoints only ever expose **published** articles. Any
 logged-in user manages their own saved/read lists under `/me`; per-user data always
 comes from `@CurrentUser().sub`, never from a user id in the URL.

### Uploads and article content

- Images are uploaded via `POST /images` (multipart field `file`), held **in memory**,
  checked by file content (magic bytes via `FileTypeValidator`, jpeg/png/webp/gif) and
  size (`MAX_UPLOAD_SIZE_MB`, enforced by multer → 413), and only then written to
  `UPLOAD_DIR` under a random UUID name. Never trust the client filename or mimetype.
- Files are served statically at `/uploads/<file>` (set up in `configureApp`), so they
  are public by URL. Image URLs in responses are absolute, built from `PUBLIC_BASE_URL`.
- **All article HTML goes through `ArticleContentService.process()` before saving.** It
  sanitizes with an allowlist matching Quill's output (tags, `ql-*` classes, a few safe
  styles), forces `rel="noopener noreferrer"` on `target="_blank"` links, and only allows
  `<img>` that point to our own uploads (rewritten to absolute URLs). External or base64
  images are rejected with 400. Never store or return unsanitized HTML; widen the
  allowlist there if the editor needs more formatting.
- Deleting something that is still referenced returns `409` (a category with articles,
  an image used as a cover or inside content). Keep this rule for new references.
- The admin account is seeded on startup by `AdminSeederService` from `ADMIN_USERNAME`,
  `ADMIN_EMAIL`, `ADMIN_PASSWORD`. It creates the account if missing and re-promotes it
  to admin if needed, but never overwrites its password. Never hardcode these values.

---

## 7. Configuration

- Env vars are validated at startup in `src/config/env.validation.ts`. The app must fail
  fast with a clear message when a required variable is missing.
- Read config with `configService.getOrThrow<T>('KEY')` for required values.
- Register async modules (`MongooseModule`, `JwtModule`) with `forRootAsync`/`registerAsync`
  and `inject: [ConfigService]`.
- Current variables: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
  `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `UPLOAD_DIR` (default `uploads`),
  `MAX_UPLOAD_SIZE_MB` (default 5), `PUBLIC_BASE_URL` (default `http://localhost:3000`).
- The app is a `NestExpressApplication`. JSON bodies are limited to 2 MB (article HTML);
  images never travel as JSON.

---

## 8. Error handling

- Throw Nest HTTP exceptions from services. Let Nest's exception layer format responses
  (`{ statusCode, message, error }`).
- Don't swallow errors. Catch only to translate a known error (e.g. Mongo `11000`
  to `ConflictException`) and rethrow everything else.
- Use Nest's `Logger` (`private readonly logger = new Logger(X.name)`), not `console.log`.

---

## 9. Testing

- Unit-test services with `Test.createTestingModule` and mock their dependencies
  (`{ provide: UsersService, useValue: { ... } }` with `vi.fn()`). Vitest globals
  (`describe`, `it`, `expect`, `vi`) are enabled.
- Cover the success path and each error branch (conflict, invalid credentials, not found).
- e2e tests (`npm run test:e2e`) boot the full `AppModule` and need a running MongoDB.
  Apply the same global pipes as `main.ts` when creating the test app.
- Don't delete or weaken existing tests to make a change pass.

---

## 10. Code style

- Prettier: single quotes, trailing commas, 2-space indent. Run `npm run format` on
  changed files.
- Prefer `async/await`. No floating promises.
- Use `readonly` for injected dependencies: `constructor(private readonly x: X) {}`.
- No `any` in new code unless unavoidable; prefer `unknown` + narrowing.
- Keep functions small and named for what they do. Comments explain *why*, never *what*.
- Don't leave commented-out code, debug logs, or TODOs without context.

---

## 11. Running the app

```bash
npm run start:dev     # watch mode on PORT (default 3000)
npm run build         # compile to dist/
npm run lint
npm test              # unit tests
npm run test:e2e      # e2e tests (requires MongoDB)
```

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`
- The user often has `npm run start:dev` running already. Check the existing terminal
  before starting another server (port conflicts).

---

## 12. Current API surface

Quick reference only. Request/response shapes, validation rules, errors and business
rules for each endpoint are in `PROJECT_CONTEXT.md`, section 4.

| Method | Path             | Auth   | Description                                  |
| ------ | ---------------- | ------ | -------------------------------------------- |
| GET    | `/`              | Public | Health/hello                                 |
| POST   | `/auth/register` | Public | Register with `username`, `email`, `password` |
| POST   | `/auth/login`    | Public | Log in with `identifier` (username or email) + `password` |
| GET    | `/auth/me`       | Bearer | Current authenticated user's profile         |
| GET    | `/users`         | Admin  | List users (`page`, `limit`, optional `role` filter) |
| PATCH  | `/users/:id/role` | Admin | Set a user's role (`user`, `moderator`, `admin`) |
| GET    | `/categories`    | Public | Top-level categories with `subcategories` nested and published-article counts |
| GET    | `/categories/:slug` | Public | One category or subcategory (with `parent` / `subcategories`) |
| POST   | `/categories`    | Admin  | Create (`name`, `description?`, `parentId?` creates a subcategory; one level) |
| PATCH  | `/categories/:id` | Admin | Update `name`/`description`; renaming regenerates the slug; parent is fixed |
| DELETE | `/categories/:id` | Admin | Delete; 409 if it has subcategories or any article uses it |
| POST   | `/images`        | Mod/Admin | Upload (multipart `file`, `alt?`)         |
| GET    | `/images`        | Mod/Admin | List (own for moderators, all for admins) |
| GET    | `/images/:id`    | Mod/Admin | Image details                             |
| PATCH  | `/images/:id`    | Owner/Admin | Update `alt`                            |
| DELETE | `/images/:id`    | Owner/Admin | Delete file + record; 409 if in use     |
| GET    | `/articles`      | Public | Published only; `page`, `limit`, `category` (slug, category or subcategory), `categoryId`, `tag`, `author` (username), `q` (search) |
| GET    | `/articles/:slug` | Public | One published article with content          |
| GET    | `/articles/manage` | Mod/Admin | Drafts + published for editing (own for moderators, all for admins); `status`, `categoryId` filters |
| GET    | `/articles/manage/:id` | Owner/Admin | One article by id, any status      |
| POST   | `/articles`      | Mod/Admin | Create as draft (`title`, `content`, `coverImageId`, `categoryId`, `subcategoryId?`, `tags?`) |
| PATCH  | `/articles/:id`  | Owner/Admin | Update; slug changes only while never published |
| DELETE | `/articles/:id`  | Owner/Admin | Delete                                  |
| POST   | `/articles/:id/publish` | Owner/Admin | Publish; `publishedAt` set on first publish only |
| POST   | `/articles/:id/unpublish` | Owner/Admin | Back to draft                     |
| GET    | `/tags`          | Public | Tags of published articles with counts; `q` prefix, `limit` |
| GET    | `/me/saved-articles` | Bearer | Your saved (read later) articles, newest first; `page`, `limit` |
| PUT    | `/me/saved-articles/:id` | Bearer | Save a published article (idempotent, 204) |
| DELETE | `/me/saved-articles/:id` | Bearer | Remove from saved (idempotent, 204) |
| GET    | `/me/read-articles` | Bearer | Articles you marked as read, newest first; `page`, `limit` |
| PUT    | `/me/read-articles/:id` | Bearer | Mark a published article as read (idempotent, 204) |
| DELETE | `/me/read-articles/:id` | Bearer | Mark as unread (idempotent, 204) |

Keep this table in sync when you add, change, or remove endpoints.

# Milestone 1 — Remove Built-ins, Add Startup Seeding
# Implementation Plan

**Roadmap source:** `docs/scraper-plugins/roadmap.md`
**Milestone status:** ⬜ Not Started → In Progress
**Date drafted:** 2026-03-15
**Backend-only milestone** — no frontend changes, no Prisma migration, no API contract changes.

---

## 1. Goal

Eliminate bank-specific knowledge from the NestJS core. After this milestone:

- `CibcScraper` and `TdScraper` are no longer NestJS `@Injectable()` providers.
- The `BANK_SCRAPER` factory provider is removed from `ScraperModule`.
- Both scrapers ship as standalone ESM plugin files alongside the compiled output.
- `ScraperPluginLoader.onModuleInit()` copies those built-in plugin files into
  `SCRAPER_PLUGIN_DIR` on first boot (idempotent — never overwrites operator-modified
  versions), then runs `loadPlugins()` as today.
- `ScraperRegistry` continues to work with zero changes — it already accepts an empty or
  `undefined` `BANK_SCRAPER` injection via `@Optional()`.

---

## 2. Copy-First Guidance

This milestone does **not** introduce a new module — it refactors an existing one.
No copy-first scaffolding applies.

| Layer | Approach |
|-------|----------|
| `scraper.module.ts` | Surgical removal of three lines (two class providers + factory) |
| `cibc.scraper.ts` / `td.scraper.ts` | Strip NestJS decorators; convert to plain ESM default exports |
| `scraper.plugin-loader.ts` | Add one private method `seedBuiltins()` and call it from `onModuleInit()` before `loadPlugins()` |
| `scraper.plugin-loader.spec.ts` | Add seeding test cases to the existing describe block |

---

## 3. Files to Modify

| File | Change type | Detail |
|------|-------------|--------|
| `packages/backend/src/scraper/scraper.module.ts` | Modify | Remove `CibcScraper`, `TdScraper` imports, class providers, and the `BANK_SCRAPER` factory provider; update the JSDoc comment block |
| `packages/backend/src/scraper/banks/cibc.scraper.ts` | Modify | Remove `@Injectable()` decorator and `Injectable` import; remove the class wrapper; export a plain object literal (or factory function) as the `default` export satisfying `BankScraper` |
| `packages/backend/src/scraper/banks/td.scraper.ts` | Modify | Same conversion as CIBC |
| `packages/backend/src/scraper/scraper.plugin-loader.ts` | Modify | Add `seedBuiltins()` private method; update `onModuleInit()` to call `await this.seedBuiltins()` before `await this.loadPlugins()` |
| `packages/backend/src/scraper/__TEST__/scraper.plugin-loader.spec.ts` | Modify | Add `seedBuiltins` describe block with idempotency and copy-on-missing test cases; update `onModuleInit` test to assert `seedBuiltins` is called |

---

## 4. No Prisma Changes

This milestone touches no schema models, no migrations, and no seed scripts.

---

## 5. No API Contract Changes

All public endpoints (`GET /scrapers`, `POST /admin/scrapers/reload`,
`POST /admin/scrapers/install`) are unchanged. Response shapes, DTOs, and Swagger
decorators are unaffected.

---

## 6. Detailed Implementation Steps

### Step 1 — Convert `cibc.scraper.ts` to a standalone plugin

**File:** `packages/backend/src/scraper/banks/cibc.scraper.ts`

Remove the `@Injectable()` decorator and the `Injectable` import from `@nestjs/common`.
Remove the class declaration entirely. Export a plain object as the `default` export.

The exported object must satisfy the `BankScraper` interface verbatim:

```
bankId: 'cibc'
displayName: 'CIBC'
requiresMfaOnEveryRun: true
maxLookbackDays: 90
pendingTransactionsIncluded: true
login(_page, _credentials): Promise<void>
scrapeTransactions(_page, _options): Promise<RawTransaction[]>
```

The `MfaRequiredError` class lives inside this file and can stay — it is referenced in
the Phase 8 implementation notes and the worker comment. Keep it as a named export so
Phase 8 code can import it from the plugin file directly.

The `/* v8 ignore file */` pragma must be retained — this file is intentionally a stub
with no testable logic.

The type imports remain: `BankScraper`, `BankCredentials`, `ScrapeOptions`,
`RawTransaction` from `#scraper/interfaces/bank-scraper.interface.js`.

**Important:** These files are TypeScript source files that get compiled to `.js` by the
build step. The compiled output in `dist/scraper/banks/cibc.scraper.js` is what the
seeding step will copy into `SCRAPER_PLUGIN_DIR`. See Step 3 for how the path is
resolved.

### Step 2 — Convert `td.scraper.ts` to a standalone plugin

**File:** `packages/backend/src/scraper/banks/td.scraper.ts`

Same pattern as Step 1:
- Remove `@Injectable()` and the `Injectable` import.
- Remove the class; export a plain object literal as the `default` export.
- Retain the `/* v8 ignore file */` pragma.
- Type imports remain unchanged.

The TD plugin object:

```
bankId: 'td'
displayName: 'TD Canada Trust'
requiresMfaOnEveryRun: false
maxLookbackDays: 365
pendingTransactionsIncluded: false
login(_page, _credentials): Promise<void>
scrapeTransactions(_page, _options): Promise<RawTransaction[]>
```

### Step 3 — Update `scraper.module.ts`

**File:** `packages/backend/src/scraper/scraper.module.ts`

Remove:
1. The import line `import {CibcScraper} from '#scraper/banks/cibc.scraper.js';`
2. The import line `import {TdScraper} from '#scraper/banks/td.scraper.js';`
3. The import line `import type {BankScraper} from '#scraper/interfaces/bank-scraper.interface.js';`
   (only if it is no longer used elsewhere in the file — confirm before removing)
4. The `CibcScraper` entry in the `providers` array
5. The `TdScraper` entry in the `providers` array
6. The entire factory provider object:
   ```
   {
       provide: BANK_SCRAPER,
       useFactory: (cibc: CibcScraper, td: TdScraper): BankScraper[] => [cibc, td],
       inject: [CibcScraper, TdScraper]
   }
   ```
7. The `BANK_SCRAPER` name from the `ScraperRegistry` import line (if it becomes unused).
   Check: `BANK_SCRAPER` is exported from `scraper.registry.ts` and was only needed here
   for the factory `provide` key. After removal, the import line becomes:
   `import {ScraperRegistry} from '#scraper/scraper.registry.js';`

Update the JSDoc comment block on the module to remove the mention of the
`BANK_SCRAPER` token and the `CibcScraper`/`TdScraper` entries in the Providers section.
Replace with a note that built-in scrapers are loaded as plugins via `ScraperPluginLoader`.

The `BANK_SCRAPER` constant itself stays in `scraper.registry.ts` — it is the public
injection token export and may be used by future tests or downstream code.

### Step 4 — Add `seedBuiltins()` to `ScraperPluginLoader`

**File:** `packages/backend/src/scraper/scraper.plugin-loader.ts`

#### 4a. New imports

Add to the existing imports from `fs/promises`:
- `copyFile` — used to copy the built-in plugin file
- `access` — used to check whether the destination file already exists (constants `F_OK`)

Add from `url`:
- `fileURLToPath` — already used elsewhere in the module? Check; if not, add it.

Add from `path`:
- `basename` — to extract the filename from the source path for the log message.

#### 4b. Built-in source path resolution

The seeding step must resolve the compiled `.js` paths relative to the compiled output
of `scraper.plugin-loader.js`. The compiled output lives at:

```
dist/scraper/scraper.plugin-loader.js
```

The built-in plugin compiled files live at:

```
dist/scraper/banks/cibc.scraper.js
dist/scraper/banks/td.scraper.js
```

The resolution pattern follows the same idiom used in `scraper.service.ts` for the
worker path:

```typescript
const dir = fileURLToPath(new URL('.', import.meta.url));
// dir = dist/scraper/  (at runtime, after tsc compilation)
const builtinDir = join(dir, 'banks');
const BUILTIN_PLUGINS = ['cibc.scraper.js', 'td.scraper.js'];
```

This is a private constant defined at the top of the class (or as a module-level
constant) — not injected via `ConfigService`, because the built-in locations are
compile-time constants, not operator-configurable.

#### 4c. `seedBuiltins()` method signature and behaviour

```typescript
private async seedBuiltins(): Promise<void>
```

Logic:

1. Read `SCRAPER_PLUGIN_DIR` from `ConfigService`. If not set, log and return early
   (same guard as `loadPlugins()`).
2. Compute `builtinDir = join(fileURLToPath(new URL('.', import.meta.url)), 'banks')`.
3. For each filename in `BUILTIN_PLUGINS` (e.g. `['cibc.scraper.js', 'td.scraper.js']`):
   a. Resolve source path: `join(builtinDir, filename)`.
   b. Resolve destination path: `join(pluginDir, filename)`.
   c. Check whether the destination already exists using `access(dest, constants.F_OK)`.
      - If it exists: log `skip` message at `log` level and continue.
      - If it does not exist (access throws with `ENOENT`): call `copyFile(src, dest)`
        and log a `seeded` message at `log` level.
   d. Any error other than `ENOENT` on the existence check should be re-thrown so the
      operator is notified of permission problems.
4. After the loop completes, `onModuleInit()` proceeds to call `loadPlugins()`.

#### 4d. `onModuleInit()` update

```typescript
public async onModuleInit(): Promise<void> {
    await this.seedBuiltins();
    await this.loadPlugins();
}
```

The `seedBuiltins()` call must run before `loadPlugins()` so the freshly seeded files
are available in the scan.

#### 4e. Protected helper for testability

`seedBuiltins()` calls `copyFile` from `fs/promises` directly (imported at the top of
the file). It does NOT need a `protected` wrapper like `loadModule()` because the
`fs/promises` module is mocked at the vi.mock level in the test file — the same pattern
used in `scraper-admin.service.spec.ts` for `writeFile`.

### Step 5 — Update `scraper.plugin-loader.spec.ts`

**File:** `packages/backend/src/scraper/__TEST__/scraper.plugin-loader.spec.ts`

#### 5a. Extend the `fs/promises` mock

The existing mock covers `readdir`. Extend it to also mock `copyFile` and `access`:

```typescript
vi.mock('fs/promises', () => ({
    readdir: vi.fn(),
    copyFile: vi.fn(),
    access: vi.fn()
}));

import {readdir, copyFile, access} from 'fs/promises';
```

#### 5b. Update the `onModuleInit` describe block

The existing test `'should call loadPlugins()'` spies on `loadPlugins` only. After this
change, `onModuleInit()` also calls `seedBuiltins()`. Update or add a companion test:

```
it('should call seedBuiltins() before loadPlugins()')
```

Approach: spy on both `loader.seedBuiltins` (accessing via cast to `unknown`) and
`loader.loadPlugins`; assert order using mock call tracking. Alternatively assert both
are called without verifying order (the simpler approach — the call order is already
specified in the source code).

#### 5c. Add `seedBuiltins` describe block

New describe: `'seedBuiltins'`

Required test cases:

**Environment guard:**

1. `'should return early without copying when SCRAPER_PLUGIN_DIR is not set'`
   - `mockConfig.get` returns `undefined`
   - Assert `access` and `copyFile` are NOT called

**Skip when file already exists:**

2. `'should skip copying a built-in plugin when it already exists in the plugin dir'`
   - `mockConfig.get` returns `'/plugins'`
   - `access` resolves (file exists)
   - Assert `copyFile` is NOT called

3. `'should log a skip message when the built-in plugin is already present'`
   - Same setup; spy on `loader['logger'].log` and assert it was called with a message
     containing `'skip'` or `'already exists'`

**Copy when file is missing:**

4. `'should copy a built-in plugin when it is not present in the plugin dir'`
   - `mockConfig.get` returns `'/plugins'`
   - `access` rejects with an error where `code === 'ENOENT'`
   - `copyFile` resolves
   - Assert `copyFile` was called with the expected source and destination paths
     (use `expect.stringContaining('cibc.scraper.js')` and
     `expect.stringContaining('/plugins')`)

5. `'should copy all built-in plugins on a clean install'`
   - Both `access` calls reject with `ENOENT`
   - Assert `copyFile` is called twice

**Idempotency:**

6. `'should not overwrite a plugin that already exists (idempotent)'`
   - First `access` resolves (already exists), second rejects with `ENOENT`
   - Assert `copyFile` was called exactly once (for the missing file)

**Non-ENOENT access errors:**

7. `'should re-throw when access() fails with a non-ENOENT error'`
   - `access` rejects with `Object.assign(new Error('EACCES'), { code: 'EACCES' })`
   - Assert `seedBuiltins()` rejects with that error

**Path correctness:**

8. `'should resolve built-in plugin paths relative to the loader module'`
   - `copyFile` resolves
   - Assert the source path argument to `copyFile` contains `'banks'` and
     ends with `'cibc.scraper.js'` (or `'td.scraper.js'`)

---

## 7. Deleted/Relocated Exports

The `CibcScraper` and `TdScraper` class names will no longer exist after this change.
Nothing else in the codebase currently imports them except `scraper.module.ts` — the
only consumer. Confirm with a grep before deleting:

```
packages/backend/src/scraper/scraper.module.ts  — to be cleaned (Step 3)
packages/backend/src/scraper/scraper.worker.ts  — has a comment referencing
    '#scraper/banks/cibc.scraper.js' but does NOT import it; the comment is
    a Phase 8 implementation note. No change needed.
```

After conversion the files remain at the same paths (`banks/cibc.scraper.ts`,
`banks/td.scraper.ts`). The compiled output paths (`banks/cibc.scraper.js`,
`banks/td.scraper.js`) are what the seeding step references.

The `MfaRequiredError` class in `cibc.scraper.ts` was previously a named export from
the `CibcScraper` module. It will continue to be a named export from the converted
plugin file. The Phase 8 worker comment references it; no import change is needed there
since the comment is not compiled code.

---

## 8. Interaction with `ScraperRegistry`

`ScraperRegistry` (line 21) already has:

```typescript
@Optional() @Inject(BANK_SCRAPER) scrapers: BankScraper[] | undefined
```

When `BANK_SCRAPER` is not provided (after removing the factory provider from the
module), NestJS passes `undefined` and the registry initialises with an empty map.
`ScraperPluginLoader.loadPlugins()` then populates the registry from the plugin
directory. This is exactly how third-party plugins work today — no registry changes
are needed.

---

## 9. Interaction with `ScraperAdminService.reloadPlugins()`

`reloadPlugins()` calls `pluginLoader.loadPlugins()` directly (not `onModuleInit()`).
This is correct: the reload endpoint should not re-seed built-ins on every admin
reload — seeding is a startup concern only. The seeding step runs once at boot via
`onModuleInit()`.

---

## 10. Build and Distribution Notes

The TypeScript source files in `banks/` are compiled by `tsc` into `dist/scraper/banks/`.
The seeding step copies from the compiled `.js` output directory into `SCRAPER_PLUGIN_DIR`.
This means:

- **Development** (`ts-node` / `nest start`): the `dist/` directory must exist for
  `seedBuiltins()` to find source files. Run `npm run build` or `nest build` at least
  once before starting in development mode with plugin seeding enabled.
- **Production Docker image**: the build step always runs before `node dist/main.js`, so
  the compiled plugin files are always present. No special Docker steps required.
- **`SCRAPER_PLUGIN_DIR` not set**: both `seedBuiltins()` and `loadPlugins()` return
  early. This is the default state for the test suite and any environment that has not
  opted into the plugin system.

---

## 11. Test Strategy

### Unit tests (Vitest, co-located in `__TEST__/`)

| File | What to test |
|------|--------------|
| `scraper.plugin-loader.spec.ts` | 8 new seeding cases (see Step 5); update 1 existing `onModuleInit` case |

No new test files are required. The mock pattern (`vi.mock('fs/promises', ...)`) is
already established in `scraper-admin.service.spec.ts`.

### Integration / manual test (after implementation)

1. Set `SCRAPER_PLUGIN_DIR=/tmp/plugins` in `.env`.
2. Start the backend (`npm run start:dev`).
3. Observe logs:
   - `[ScraperPluginLoader] Seeded built-in plugin 'cibc.scraper.js' → /tmp/plugins/cibc.scraper.js`
   - `[ScraperPluginLoader] Seeded built-in plugin 'td.scraper.js' → /tmp/plugins/td.scraper.js`
4. Restart the backend.
5. Observe skip logs (files already exist — no overwrite).
6. Call `GET /scrapers` — confirm `cibc` and `td` appear in the response.
7. Manually modify `/tmp/plugins/cibc.scraper.js` (change `displayName`).
8. Restart again — confirm the modified file is NOT overwritten and the custom
   `displayName` appears in `GET /scrapers`.

---

## 12. Backend API Test Plan

This milestone makes no changes to any endpoint contract. The existing endpoints behave
identically before and after. No new API test cases are required.

For completeness, confirm these endpoints still pass after the refactor:

| Method | Route | Expected status | Notes |
|--------|-------|-----------------|-------|
| GET | `/scrapers` | 200 | Response still lists `cibc` and `td` (now loaded as plugins) |
| POST | `/admin/scrapers/reload` | 200 | Re-scans plugin dir; no change to response shape |
| POST | `/admin/scrapers/install` | 201 | No change |
| POST | `/admin/scrapers/install` (no auth) | 401 | Guard unchanged |
| POST | `/admin/scrapers/install` (non-admin) | 403 | Guard unchanged |

---

## 13. Breaking Changes and Migration Notes

**No breaking changes for operators already running the plugin system.**

The only observable change is that `cibc` and `td` scrapers now require
`SCRAPER_PLUGIN_DIR` to be set in order to load. If an operator runs the backend
without setting `SCRAPER_PLUGIN_DIR`, neither scraper will be registered and
`GET /scrapers` will return an empty array.

**Migration note for operators upgrading from the pre-milestone build:**

- Set `SCRAPER_PLUGIN_DIR` to a writable directory path in the deployment environment.
- On first boot after the upgrade, the built-in plugin files are automatically copied
  into that directory. No manual steps required.
- Existing `SyncSchedule` records with `bankId: 'cibc'` or `bankId: 'td'` will continue
  to work because the plugin files expose the same `bankId` values.

---

## 14. Recommended Agent Sequence

This is a backend-only milestone with no frontend changes and no Figma brief.

1. `backend-dev` — implement Steps 1–4 (convert scrapers, update module, add seeding)
2. `test-writer` — implement Step 5 (extend spec with seeding tests)
3. `backend-tester` — run the regression checks in Section 12 against the live server;
   save plan to `test-plan/scraper-plugins/milestone-1-backend.md` and report to
   `test-plan/scraper-plugins/milestone-1-backend-report.md`
4. `code-reviewer` — review all changes in `packages/backend/src/scraper/`
5. `backend-dev` — commit: `refactor(scraper): convert built-in scrapers to plugins with startup seeding`

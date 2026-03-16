# Milestone 4 — Plugin Input Schema: Implementation Plan

**Date:** 2026-03-15
**Feature path:** `packages/backend/src/scraper/` and `packages/frontend/src/features/scraper/`
**Single source of truth for:** backend-dev, test-writer, backend-tester, frontend-dev, code-reviewer, frontend-tester

---

## Overview

Today every scraper plugin assumes `{username, password}` credentials. Milestone 4 replaces that
hardcoded shape with a generic `inputs: Record<string, string>` field whose keys and display
metadata are declared by each plugin via a new `inputSchema: PluginFieldDescriptor[]` property.

Changes touch four layers:

1. **Interface** — `PluginFieldDescriptor`, `PluginInputs` type alias, `BankScraper.inputSchema`,
   `ScraperWorkerInput.inputs`
2. **Backend modules** — `isBankScraper` guard, `ScraperInfoDto`, `ScraperRegistry.listAll()`,
   `CreateSyncScheduleDto`, `UpdateSyncScheduleDto`, `SyncScheduleService`, `ScraperService`
3. **Database** — rename `credentialsEnc` / `credentials_enc` to `pluginConfigEnc` /
   `plugin_config_enc` in the `sync_schedules` table
4. **Frontend** — Orval regeneration, `SyncScheduleFormValues`, `useSyncSchedule`,
   `SyncScheduleForm` dynamic field loop

**Copy-first assessment:**

- **Backend:** Mostly in-place edits to existing files. No new feature module is being built.
  Copy-first does not apply — every change is a targeted modification.
- **Frontend:** The `SyncScheduleForm.tsx` credentials row is replaced by a render loop. The
  existing component structure is preserved; only that section diverges. Copy-first the rest of
  the component; build the loop section from scratch.

---

## Part 1 — Backend Changes

### Step 1 — `PluginFieldDescriptor` interface and `PluginInputs` type alias

**File:** `packages/backend/src/scraper/interfaces/bank-scraper.interface.ts`

**What to add/change:**

Replace the `BankCredentials` interface and update `BankScraper` and `ScraperWorkerInput`.

**Before (lines 40–43, 74):**

```typescript
export interface BankCredentials {
    username: string;
    password: string;
}
// ...
credentials: {username: string, password: string};
```

**After — full set of changes in this file:**

1. Remove the `BankCredentials` interface entirely.

2. Add `PluginFieldDescriptor` immediately after the `BankScraper` closing brace (before
   `ScrapeOptions`):

```typescript
/**
 * Describes a single input field that the plugin requires from the user
 * (e.g. username, password, card number, security answer).
 * The frontend renders a form field for each descriptor in `BankScraper.inputSchema`.
 */
export interface PluginFieldDescriptor {
    /** Machine-readable key stored in `inputs` Record. */
    key: string;
    /** Human-readable label shown next to the form field. */
    label: string;
    /** HTML input type. Drives rendering in the frontend form. */
    type: 'text' | 'password' | 'number' | 'select';
    /** Whether the field must be non-empty before the schedule can be saved. */
    required: boolean;
    /** Optional helper text rendered below the field. */
    hint?: string;
    /** Required when type === 'select'. Each element is a {value, label} pair. */
    options?: Array<{value: string; label: string}>;
}

/**
 * Generic plugin credentials — replaces the hardcoded {username, password} shape.
 * Keys match the `key` properties of the plugin's `inputSchema`.
 */
export type PluginInputs = Record<string, string>;
```

3. Add `inputSchema` to `BankScraper` (after `pendingTransactionsIncluded`):

```typescript
/**
 * Declares the form fields the plugin needs from the user.
 * The frontend renders exactly these fields in SyncScheduleForm.
 * The values are stored encrypted as `pluginConfigEnc` in the database
 * and passed to `login()` as `inputs` at runtime.
 */
readonly inputSchema: PluginFieldDescriptor[];
```

4. Update the `login` signature — change parameter type from `BankCredentials` to `PluginInputs`:

```typescript
login(page: unknown, inputs: PluginInputs): Promise<void>;
```

5. Update `ScraperWorkerInput` (line 74) — rename field and change type:

```typescript
// Before:
credentials: {username: string, password: string};

// After:
inputs: PluginInputs;
```

Also update the JSDoc comment on `ScraperWorkerInput` from "credentials are decrypted" to
"plugin inputs are decrypted".

---

### Step 2 — Update CIBC and TD scrapers with `inputSchema`

Both plugins currently satisfy `BankScraper` but will fail the updated `isBankScraper` guard
(Step 3) and TypeScript typecheck once `inputSchema` is required on the interface.

**File:** `packages/backend/src/scraper/banks/cibc.scraper.ts`

1. Remove the `BankCredentials` import from the import list; add `PluginInputs` and
   `PluginFieldDescriptor` to the same import:

```typescript
import type {
    BankScraper,
    PluginInputs,
    PluginFieldDescriptor,
    ScrapeOptions,
    RawTransaction
} from '#scraper/interfaces/bank-scraper.interface.js';
```

2. Add `inputSchema` to the `cibcScraper` object literal (after `pendingTransactionsIncluded`):

```typescript
inputSchema: [
    {
        key: 'username',
        label: 'Card / Username',
        type: 'text',
        required: true,
        hint: 'Your CIBC online banking card number or username'
    },
    {
        key: 'password',
        label: 'Password',
        type: 'password',
        required: true
    }
] satisfies PluginFieldDescriptor[],
```

3. Update the `login` parameter: `_credentials: BankCredentials` → `_inputs: PluginInputs`.

**File:** `packages/backend/src/scraper/banks/td.scraper.ts`

1. Same import change: remove `BankCredentials`, add `PluginInputs` and `PluginFieldDescriptor`.

2. Add `inputSchema` to the `tdScraper` literal:

```typescript
inputSchema: [
    {
        key: 'username',
        label: 'Username',
        type: 'text',
        required: true,
        hint: 'Your TD EasyWeb username'
    },
    {
        key: 'password',
        label: 'Password',
        type: 'password',
        required: true
    }
] satisfies PluginFieldDescriptor[],
```

3. Update the `login` parameter: `_credentials: BankCredentials` → `_inputs: PluginInputs`.

---

### Step 3 — Update `isBankScraper` type guard

**File:** `packages/backend/src/scraper/scraper.plugin-loader.ts`

The guard is at lines 27–41. The `return (...)` expression must gain one additional check.

**Before (line 38–40):**

```typescript
    return (
        typeof v.bankId === 'string' &&
        typeof v.displayName === 'string' &&
        typeof v.requiresMfaOnEveryRun === 'boolean' &&
        typeof v.maxLookbackDays === 'number' &&
        typeof v.pendingTransactionsIncluded === 'boolean' &&
        typeof v.login === 'function' &&
        typeof v.scrapeTransactions === 'function'
    );
```

**After:**

```typescript
    return (
        typeof v.bankId === 'string' &&
        typeof v.displayName === 'string' &&
        typeof v.requiresMfaOnEveryRun === 'boolean' &&
        typeof v.maxLookbackDays === 'number' &&
        typeof v.pendingTransactionsIncluded === 'boolean' &&
        Array.isArray(v.inputSchema) &&
        typeof v.login === 'function' &&
        typeof v.scrapeTransactions === 'function'
    );
```

The `Array.isArray` check is intentionally minimal — it verifies the field is present and is an
array, matching the pattern used for the other primitive checks. Deep-validating each descriptor
object's shape is not needed in the guard.

---

### Step 4 — `PluginFieldDescriptorDto` class and `ScraperInfoDto` update

**File:** `packages/backend/src/scraper/scraper-info.dto.ts`

Add a `PluginFieldDescriptorDto` class before `ScraperInfoDto` so Swagger can introspect the
nested array type. Then add `inputSchema` to `ScraperInfoDto`.

**New `PluginFieldDescriptorDto` class (insert before `ScraperInfoDto`):**

```typescript
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import type {PluginFieldDescriptor} from '#scraper/interfaces/bank-scraper.interface.js';

/**
 * Serialisable representation of a single plugin input field descriptor.
 * Nested inside ScraperInfoDto.inputSchema so Swagger can generate typed docs.
 */
export class PluginFieldDescriptorDto implements PluginFieldDescriptor {
    @ApiProperty({example: 'username', description: 'Machine-readable field key'})
    public key!: string;

    @ApiProperty({example: 'Card / Username', description: 'Human-readable label'})
    public label!: string;

    @ApiProperty({
        enum: ['text', 'password', 'number', 'select'],
        example: 'text',
        description: 'HTML input type'
    })
    public type!: 'text' | 'password' | 'number' | 'select';

    @ApiProperty({example: true, description: 'Whether the field is mandatory'})
    public required!: boolean;

    @ApiPropertyOptional({
        example: 'Your CIBC card number',
        description: 'Helper text rendered below the field'
    })
    public hint?: string;

    @ApiPropertyOptional({
        type: 'array',
        items: {
            type: 'object',
            properties: {
                value: {type: 'string'},
                label: {type: 'string'}
            }
        },
        description: 'Options for select fields'
    })
    public options?: Array<{value: string; label: string}>;
}
```

**Add `inputSchema` to `ScraperInfoDto` (after `pendingTransactionsIncluded`):**

```typescript
@ApiProperty({
    type: () => [PluginFieldDescriptorDto],
    description: 'Fields the plugin requires from the user to authenticate'
})
public inputSchema!: PluginFieldDescriptorDto[];
```

Note: the `type: () => [PluginFieldDescriptorDto]` lazy-getter syntax is required by NestJS Swagger
for nested array types to appear correctly in the OpenAPI document.

---

### Step 5 — `ScraperRegistry.listAll()` update

**File:** `packages/backend/src/scraper/scraper.registry.ts`

The `listAll()` method at line 38–46 maps scraper objects to plain info DTOs. Add the new field.

**Before:**

```typescript
return Array.from(this.scraperMap.values()).map(s => ({
    bankId: s.bankId,
    displayName: s.displayName,
    requiresMfaOnEveryRun: s.requiresMfaOnEveryRun,
    maxLookbackDays: s.maxLookbackDays,
    pendingTransactionsIncluded: s.pendingTransactionsIncluded
}));
```

**After:**

```typescript
return Array.from(this.scraperMap.values()).map(s => ({
    bankId: s.bankId,
    displayName: s.displayName,
    requiresMfaOnEveryRun: s.requiresMfaOnEveryRun,
    maxLookbackDays: s.maxLookbackDays,
    pendingTransactionsIncluded: s.pendingTransactionsIncluded,
    inputSchema: s.inputSchema
}));
```

---

### Step 6 — Custom `@IsStringRecord()` validator

**New file:** `packages/backend/src/common/validators/is-string-record.validator.ts`

This validator is needed because `class-validator` has no built-in decorator that checks every
value of a plain object is a string.

```typescript
import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    registerDecorator,
    ValidationOptions
} from 'class-validator';

@ValidatorConstraint({name: 'isStringRecord', async: false})
export class IsStringRecordConstraint implements ValidatorConstraintInterface {
    public validate(value: unknown, _args: ValidationArguments): boolean {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return false;
        }
        return Object.values(value as Record<string, unknown>).every(
            (v) => typeof v === 'string'
        );
    }

    public defaultMessage(_args: ValidationArguments): string {
        return 'Each value in inputs must be a string';
    }
}

/**
 * Validates that a property is a plain object where every value is a string.
 * Use alongside @IsObject() on `inputs: Record<string, string>`.
 */
export function IsStringRecord(options?: ValidationOptions): PropertyDecorator {
    return (object: object, propertyName: string): void => {
        registerDecorator({
            target: (object as {constructor: Function}).constructor,
            propertyName,
            options,
            constraints: [],
            validator: IsStringRecordConstraint
        });
    };
}
```

---

### Step 7 — `RequiredInputsConstraint` custom class-level validator

**Add to** `packages/backend/src/common/validators/is-string-record.validator.ts`
(or a separate file `required-inputs.validator.ts` in the same directory — developer's choice,
but co-location is preferred if the file stays small).

This validator is applied at the class level on `CreateSyncScheduleDto`. It reads `bankId` from
the DTO instance, looks up the plugin in `ScraperRegistry`, and checks that every field with
`required: true` in `inputSchema` has a non-empty string in `inputs`.

```typescript
import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    registerDecorator,
    ValidationOptions,
    Validate
} from 'class-validator';
import {Injectable} from '@nestjs/common';
import type {ScraperRegistry} from '#scraper/scraper.registry.js';

@ValidatorConstraint({name: 'requiredInputs', async: false})
@Injectable()
export class RequiredInputsConstraint implements ValidatorConstraintInterface {
    private failedKey = '';

    constructor(private readonly registry: ScraperRegistry) {}

    public validate(value: unknown, args: ValidationArguments): boolean {
        const dto = args.object as {bankId?: string; inputs?: Record<string, string>};
        const {bankId, inputs} = dto;
        if (!bankId || !inputs) {
            return true; // other validators will catch missing bankId / inputs
        }
        const plugin = this.registry.findByBankId(bankId);
        if (!plugin) {
            return true; // bankId existence validated separately in the service
        }
        for (const field of plugin.inputSchema) {
            if (field.required) {
                const val = inputs[field.key];
                if (typeof val !== 'string' || val.trim() === '') {
                    this.failedKey = field.key;
                    return false;
                }
            }
        }
        return true;
    }

    public defaultMessage(_args: ValidationArguments): string {
        return `inputs.${this.failedKey} is required for this bank`;
    }
}
```

**`useContainer` setup in `main.ts`:**

Because `RequiredInputsConstraint` is `@Injectable()` and depends on `ScraperRegistry`, NestJS
must be told to resolve class-validator constraints from the app container. Add one line to
`main.ts` immediately after `NestFactory.create`:

```typescript
import {useContainer} from 'class-validator';
// ...
const app = await NestFactory.create(AppModule);
useContainer(app.select(AppModule), {fallbackOnErrors: true});
```

`fallbackOnErrors: true` ensures that if a constraint cannot be resolved from the container
(e.g. in unit tests), class-validator falls back to `new` instantiation rather than throwing.

**Register the constraint as a provider in `ScraperModule`:**

```typescript
providers: [
    // ...existing providers...
    RequiredInputsConstraint
]
```

---

### Step 8 — `CreateSyncScheduleDto` update

**File:** `packages/backend/src/scraper/sync/dto/create-sync-schedule.dto.ts`

Remove `username` and `password`. Add `inputs`. Add the class-level `@Validate` decorator.

**Before (lines 1–57):** (see research above)

**After:**

```typescript
import {
    ApiProperty,
    ApiPropertyOptional
} from '@nestjs/swagger';
import {
    IsString,
    IsUUID,
    IsNotEmpty,
    IsOptional,
    IsInt,
    IsObject,
    Min,
    Max,
    Validate
} from 'class-validator';
import {
    IsStringRecord
} from '#common/validators/is-string-record.validator.js';
import {
    RequiredInputsConstraint
} from '#common/validators/required-inputs.validator.js';

@Validate(RequiredInputsConstraint)
export class CreateSyncScheduleDto {
    @ApiProperty({description: 'Account UUID to sync transactions into'})
    @IsUUID('4')
    public accountId!: string;

    @ApiProperty({
        description: 'Bank identifier (must match a registered BankScraper.bankId)',
        example: 'cibc'
    })
    @IsString()
    @IsNotEmpty()
    public bankId!: string;

    @ApiProperty({
        description: 'Plugin-specific authentication inputs keyed by inputSchema field keys',
        example: {username: 'user123', password: 'secret'}
    })
    @IsObject()
    @IsStringRecord()
    public inputs!: Record<string, string>;

    @ApiProperty({
        description: 'Cron expression for the sync schedule (e.g. \'0 8 * * *\')',
        example: '0 8 * * *'
    })
    @IsString()
    @IsNotEmpty()
    public cron!: string;

    @ApiPropertyOptional({
        description: 'Days to look back for overlapping transactions (default: 3)',
        minimum: 1,
        maximum: 365
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(365)
    public lookbackDays?: number;
}
```

Note: if `RequiredInputsConstraint` is in a separate file, adjust the import path accordingly.

---

### Step 9 — `UpdateSyncScheduleDto` analysis and update

**File:** `packages/backend/src/scraper/sync/dto/update-sync-schedule.dto.ts`

The current pattern is:

```typescript
export class UpdateSyncScheduleDto extends PartialType(
    OmitType(CreateSyncScheduleDto, ['accountId', 'bankId'] as const)
) {
    // ...enabled field
}
```

`PartialType` makes every inherited field optional, so after the `CreateSyncScheduleDto` change
`inputs` will become `inputs?: Record<string, string>` automatically — no explicit override is
needed for the type itself.

However the `RequiredInputsConstraint` class-level `@Validate` decorator placed on
`CreateSyncScheduleDto` is **not inherited** by `PartialType`. This is intentional: on update,
`inputs` is optional (a partial update can omit it to keep the existing encrypted value). The
`SyncScheduleService.update()` method handles the partial-merge logic.

Conclusion: **no change to `UpdateSyncScheduleDto`** is required for the type or validation rules.
The developer should confirm the `enabled` field and the `PartialType` wrapper compile cleanly
after the `CreateSyncScheduleDto` change.

---

### Step 10 — Prisma schema migration

**File:** `packages/backend/prisma/schema.prisma`

In the `SyncSchedule` model, rename the field at line 222:

**Before:**

```prisma
credentialsEnc  String         @map("credentials_enc")
```

**After:**

```prisma
pluginConfigEnc  String         @map("plugin_config_enc")
```

**Migration command:**

```bash
cd packages/backend
npx prisma migrate dev --name rename-credentials-enc
```

**Expected generated SQL** (confirm before applying):

```sql
ALTER TABLE "sync_schedules" RENAME COLUMN "credentials_enc" TO "plugin_config_enc";
```

This is a pure rename with no type change, no default change, and no index change.
No data migration is needed — the column stores an opaque AES-256-GCM ciphertext string;
the rename is semantic only.

After running the migration, regenerate the Prisma client:

```bash
npx prisma generate
```

The generated `SyncSchedule` type in `#generated/prisma/client.js` will then expose
`pluginConfigEnc` instead of `credentialsEnc`.

---

### Step 11 — `SyncScheduleService` update

**File:** `packages/backend/src/scraper/sync/sync-schedule.service.ts`

Three locations must change.

**Location A — `create()` method (around line 89):**

Before:
```typescript
const credentialsEnc = this.cryptoService.encrypt(
    JSON.stringify({username: dto.username, password: dto.password})
);
// ...
data: {
    userId,
    accountId: dto.accountId,
    bankId: dto.bankId,
    credentialsEnc,
    // ...
}
```

After:
```typescript
const pluginConfigEnc = this.cryptoService.encrypt(
    JSON.stringify(dto.inputs)
);
// ...
data: {
    userId,
    accountId: dto.accountId,
    bankId: dto.bankId,
    pluginConfigEnc,
    // ...
}
```

**Location B — `update()` method (around lines 137–158):**

The current logic handles the case where only password, only username, or both are provided.
The new logic is simpler: if `inputs` is provided, re-encrypt the merged object.

Before:
```typescript
let credentialsEnc: string | undefined;
if (dto.password !== undefined) {
    const existing_creds = JSON.parse(
        this.cryptoService.decrypt(existing.credentialsEnc)
    ) as {username: string, password: string};
    credentialsEnc = this.cryptoService.encrypt(
        JSON.stringify({
            username: dto.username ?? existing_creds.username,
            password: dto.password
        })
    );
} else if (dto.username !== undefined) {
    const existing_creds = JSON.parse(
        this.cryptoService.decrypt(existing.credentialsEnc)
    ) as {username: string, password: string};
    credentialsEnc = this.cryptoService.encrypt(
        JSON.stringify({
            username: dto.username,
            password: existing_creds.password
        })
    );
}
// ...
...(credentialsEnc !== undefined && {credentialsEnc}),
```

After:
```typescript
let pluginConfigEnc: string | undefined;
if (dto.inputs !== undefined) {
    const existingInputs = JSON.parse(
        this.cryptoService.decrypt(existing.pluginConfigEnc)
    ) as Record<string, string>;
    // Merge: new inputs override existing keys; omitted keys are preserved
    pluginConfigEnc = this.cryptoService.encrypt(
        JSON.stringify({...existingInputs, ...dto.inputs})
    );
}
// ...
...(pluginConfigEnc !== undefined && {pluginConfigEnc}),
```

**Location C — `unknownScraperFallback()` private method (around line 275):**

The fallback object is used when a plugin's bankId is no longer registered. It must satisfy
the `BankScraper` interface, which now requires `inputSchema`. Add an empty array:

```typescript
return {
    bankId,
    displayName: `Unknown (${bankId})`,
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: false,
    inputSchema: [],
    login: (): Promise<void> => Promise.resolve(),
    scrapeTransactions: (): Promise<never[]> => Promise.resolve([])
};
```

---

### Step 12 — `ScraperService.runWorker()` update

**File:** `packages/backend/src/scraper/scraper.service.ts`

Two changes in `runWorker()` (lines 117–135).

**Change A — decrypt and cast:**

Before (lines 117–119):
```typescript
const credentials = JSON.parse(
    this.cryptoService.decrypt(schedule.credentialsEnc)
) as {username: string, password: string};
```

After:
```typescript
const inputs = JSON.parse(
    this.cryptoService.decrypt(schedule.pluginConfigEnc)
) as Record<string, string>;
```

**Change B — workerInput construction (lines 126–135):**

Before:
```typescript
const workerInput: ScraperWorkerInput = {
    bankId: schedule.bankId,
    credentials,
    startDate: startDate.toISOString(),
    // ...
};
```

After:
```typescript
const workerInput: ScraperWorkerInput = {
    bankId: schedule.bankId,
    inputs,
    startDate: startDate.toISOString(),
    // ...
};
```

---

### Step 13 — `scraper.worker.ts` update

**File:** `packages/backend/src/scraper/scraper.worker.ts`

Locate the point where `workerData` is accessed and the scraper `login()` is called. Update
the destructured field name and the call argument.

Before (illustrative — verify exact lines):
```typescript
const {bankId, credentials, ...} = workerData as ScraperWorkerInput;
// ...
await scraper.login(page, credentials);
```

After:
```typescript
const {bankId, inputs, ...} = workerData as ScraperWorkerInput;
// ...
await scraper.login(page, inputs);
```

---

## Part 2 — Backend Test Changes

### Step 14 — Update `scraper.plugin-loader.spec.ts`

**File:** `packages/backend/src/scraper/__TEST__/scraper.plugin-loader.spec.ts`

**Change A — `makePlugin` factory (line 34):**

The factory must include `inputSchema` so it satisfies the updated `BankScraper` interface and
passes the updated `isBankScraper` guard. Add it after `pendingTransactionsIncluded`:

```typescript
const makePlugin = (bankId = 'test-bank'): BankScraper => ({
    bankId,
    displayName: `${bankId} Bank`,
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: true,
    inputSchema: [],
    login: vi.fn(),
    scrapeTransactions: vi.fn()
});
```

**Change B — new guard test cases:**

Add two new test cases inside the `loadPlugins` describe block, after the existing
"should skip a plugin whose default export is missing required fields" test:

```typescript
it('should skip a plugin whose default export is missing inputSchema', async () => {
    mockConfig.get.mockReturnValue('/plugins');
    vi.mocked(readdir).mockResolvedValue([makeDirent('bad.js')]);

    spyLoadModule(loader).mockResolvedValue({
        default: {
            bankId: 'rbc',
            displayName: 'RBC',
            requiresMfaOnEveryRun: false,
            maxLookbackDays: 90,
            pendingTransactionsIncluded: false,
            // inputSchema intentionally omitted
            login: vi.fn(),
            scrapeTransactions: vi.fn()
        }
    });

    await loader.loadPlugins();

    expect(mockRegistry.register).not.toHaveBeenCalled();
});

it('should skip a plugin whose inputSchema is not an array', async () => {
    mockConfig.get.mockReturnValue('/plugins');
    vi.mocked(readdir).mockResolvedValue([makeDirent('bad.js')]);

    spyLoadModule(loader).mockResolvedValue({
        default: {
            bankId: 'rbc',
            displayName: 'RBC',
            requiresMfaOnEveryRun: false,
            maxLookbackDays: 90,
            pendingTransactionsIncluded: false,
            inputSchema: 'not-an-array',
            login: vi.fn(),
            scrapeTransactions: vi.fn()
        }
    });

    await loader.loadPlugins();

    expect(mockRegistry.register).not.toHaveBeenCalled();
});
```

---

### Step 15 — Update `scraper.registry.spec.ts`

**File:** `packages/backend/src/scraper/__TEST__/scraper.registry.spec.ts`

**Change A — `makeScraper` factory (line 9):**

Add `inputSchema` to the factory:

```typescript
const makeScraper = (bankId: string): BankScraper => ({
    bankId,
    displayName: `${bankId} Bank`,
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: true,
    inputSchema: [],
    login: (): Promise<void> => Promise.resolve(),
    scrapeTransactions: (): Promise<never[]> => Promise.resolve([])
});
```

**Change B — `listAll()` serialisation assertion (lines 53–59):**

Add `inputSchema` to the expected object:

```typescript
expect(list[0]).toEqual({
    bankId: 'cibc',
    displayName: 'cibc Bank',
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: true,
    inputSchema: []
});
```

---

## Part 3 — Backend API Test Plan

### Endpoints covered by this milestone

All existing `sync-schedules` endpoints are affected. The test plan below focuses on the
changed request/response shapes.

#### TC-M4-01 — `POST /sync-schedules` with valid inputs

- **Auth:** Bearer token (valid user)
- **Request body:**
  ```json
  {
    "accountId": "<valid-uuid>",
    "bankId": "cibc",
    "inputs": {"username": "user123", "password": "secret1"},
    "cron": "0 8 * * *"
  }
  ```
- **Expected:** 201 Created, response includes `bankId: "cibc"`, no `inputs` field (never returned)

#### TC-M4-02 — `POST /sync-schedules` missing required input key

- **Request body:** `inputs: {"username": "user123"}` (password absent for CIBC)
- **Expected:** 400 Bad Request, error message references `inputs.password`

#### TC-M4-03 — `POST /sync-schedules` with empty required input value

- **Request body:** `inputs: {"username": "user123", "password": ""}`
- **Expected:** 400 Bad Request

#### TC-M4-04 — `POST /sync-schedules` with non-string value in inputs

- **Request body:** `inputs: {"username": 123, "password": "secret"}`
- **Expected:** 400 Bad Request, message references string type

#### TC-M4-05 — `POST /sync-schedules` with legacy `username`/`password` fields

- **Request body:** includes top-level `username` and `password` (old format) instead of `inputs`
- **Expected:** 400 Bad Request (whitelist validation rejects unknown fields; `inputs` is absent)

#### TC-M4-06 — `PATCH /sync-schedules/:id` with partial inputs update

- **Request body:** `{"inputs": {"password": "newSecret"}}`
- **Expected:** 200 OK; service merges with existing encrypted inputs

#### TC-M4-07 — `PATCH /sync-schedules/:id` without inputs (no credential change)

- **Request body:** `{"cron": "0 9 * * *"}`
- **Expected:** 200 OK; existing encrypted inputs preserved

#### TC-M4-08 — `GET /scrapers` includes `inputSchema`

- **Expected:** 200 OK, each scraper object has `inputSchema` array; CIBC has 2 items with
  `key: "username"` and `key: "password"`; TD similarly

#### TC-M4-09 — `POST /sync-schedules` with missing auth

- **Expected:** 401 Unauthorized

#### TC-M4-10 — `POST /sync-schedules` with invalid bankId

- **Request body:** `inputs: {"username": "u", "password": "p"}`, `bankId: "unknown"`
- **Expected:** 400 Bad Request (service throws BadRequestException for unknown bankId)

---

## Part 4 — Frontend Changes

### Step 16 — Orval API client regeneration

Run after the backend Swagger is stable (all steps above committed):

```bash
cd packages/frontend && npm run generate:api
```

**Files that will change:**

- `src/api/model/scraperInfoDto.ts` — gains `inputSchema: PluginFieldDescriptorDto[]`
- `src/api/model/pluginFieldDescriptorDto.ts` — new file generated for the nested DTO
- `src/api/model/createSyncScheduleDto.ts` — `username` and `password` fields removed;
  `inputs: Record<string, string>` added
- `src/api/model/updateSyncScheduleDto.ts` — `username` and `password` removed;
  `inputs?: Record<string, string>` added

**New `scraperInfoDto.ts` shape (approximate):**

```typescript
export interface ScraperInfoDto {
  bankId: string;
  displayName: string;
  requiresMfaOnEveryRun: boolean;
  maxLookbackDays: number;
  pendingTransactionsIncluded: boolean;
  inputSchema: PluginFieldDescriptorDto[];
}
```

**New `pluginFieldDescriptorDto.ts` shape (approximate):**

```typescript
export interface PluginFieldDescriptorDto {
  key: string;
  label: string;
  type: PluginFieldDescriptorDtoType;
  required: boolean;
  hint?: string;
  options?: PluginFieldDescriptorDtoOptionsItem[];
}

export type PluginFieldDescriptorDtoType = 'text' | 'password' | 'number' | 'select';

export interface PluginFieldDescriptorDtoOptionsItem {
  value: string;
  label: string;
}
```

The exact union type names are determined by Orval's naming conventions.

---

### Step 17 — `SyncScheduleFormValues` type update

**File:** `packages/frontend/src/features/scraper/types/scraper.types.ts`

**Before:**

```typescript
export interface SyncScheduleFormValues {
    accountId: string;
    bankId: string;
    username: string;
    password: string;
    cron: string;
    lookbackDays: string;
    enabled: boolean;
}
```

**After:**

```typescript
export interface SyncScheduleFormValues {
    accountId: string;
    bankId: string;
    /** Dynamic plugin credentials — keyed by inputSchema field keys. */
    inputs: Record<string, string>;
    cron: string;
    lookbackDays: string;
    enabled: boolean;
}
```

`SyncScheduleFormErrors` (line 17) is derived via `Partial<Record<keyof SyncScheduleFormValues, string>>`.
After the change, `SyncScheduleFormErrors` will no longer have `username` or `password` keys.
Add `inputs` error key support explicitly if per-field errors are needed:

```typescript
export type SyncScheduleFormErrors = Partial<Record<keyof SyncScheduleFormValues, string>> & {
    /** Per-input-field errors: keyed by the PluginFieldDescriptor.key */
    inputErrors?: Record<string, string>;
};
```

---

### Step 18 — `useSyncSchedule.ts` cascade changes

**File:** `packages/frontend/src/features/scraper/hooks/useSyncSchedule.ts`

**Change A — `EMPTY_FORM` constant (line 22):**

Before:
```typescript
const EMPTY_FORM: SyncScheduleFormValues = {
    accountId: '',
    bankId: '',
    username: '',
    password: '',
    cron: '0 8 * * *',
    lookbackDays: '3',
    enabled: true
};
```

After:
```typescript
const EMPTY_FORM: SyncScheduleFormValues = {
    accountId: '',
    bankId: '',
    inputs: {},
    cron: '0 8 * * *',
    lookbackDays: '3',
    enabled: true
};
```

**Change B — `openEdit` callback (lines 92–105):**

Before:
```typescript
setFormValues({
    accountId: schedule.accountId,
    bankId: schedule.bankId,
    username: '',
    password: '',
    cron: schedule.cron,
    lookbackDays: String(schedule.lookbackDays),
    enabled: schedule.enabled
});
```

After:
```typescript
setFormValues({
    accountId: schedule.accountId,
    bankId: schedule.bankId,
    inputs: {},  // start empty; user must re-enter credentials to update them
    cron: schedule.cron,
    lookbackDays: String(schedule.lookbackDays),
    enabled: schedule.enabled
});
```

**Change C — `validateForm` function (lines 32–45):**

Remove the `username` and `password` validation lines. Add validation that each required field
in the selected scraper's `inputSchema` is non-empty. Because `validateForm` does not have
access to the scrapers list directly, the hook must either:

- Accept an optional `scrapers: ScraperInfoDto[] | undefined` parameter on `validateForm`, or
- Call a per-field validation inside the `SyncScheduleForm` component and surface errors through
  `inputErrors`.

The recommended approach is to pass the selected scraper into `validateForm`:

```typescript
import type {ScraperInfoDto} from '@/api/model/scraperInfoDto.js';

const validateForm = (
    values: SyncScheduleFormValues,
    isEdit: boolean,
    scraper: ScraperInfoDto | undefined
): SyncScheduleFormErrors => {
    const errors: SyncScheduleFormErrors = {};
    const inputErrors: Record<string, string> = {};

    if (values.accountId.trim() === '') errors.accountId = 'Account is required';
    if (values.bankId.trim() === '') errors.bankId = 'Bank is required';

    if (!isEdit && scraper) {
        for (const field of scraper.inputSchema) {
            if (field.required) {
                const val = values.inputs[field.key];
                if (!val || val.trim() === '') {
                    inputErrors[field.key] = `${field.label} is required`;
                }
            }
        }
    }

    if (Object.keys(inputErrors).length > 0) {
        errors.inputErrors = inputErrors;
    }

    if (values.cron.trim() === '') errors.cron = 'Cron expression is required';
    const days = parseInt(values.lookbackDays, 10);
    if (isNaN(days) || days < 1 || days > 365) {
        errors.lookbackDays = 'Lookback days must be between 1 and 365';
    }
    return errors;
};
```

The hook must call `useScraperControllerListScrapers()` (already available in the form
component) and pass the selected scraper to `validateForm`. To avoid prop-drilling, the
`useSyncSchedule` hook should also call this query:

```typescript
import {useScraperControllerListScrapers} from '@/api/scrapers/scrapers.js';
// ...
const {data: scrapers} = useScraperControllerListScrapers();
// ...
// In handleSubmit:
const selectedScraper = scrapers?.find(s => s.bankId === formValues.bankId);
const validationErrors = validateForm(formValues, editTarget !== null, selectedScraper);
```

**Change D — `handleSubmit` create mutate call (lines 159–168):**

Before:
```typescript
createMutation.mutate(
    {
        data: {
            accountId: formValues.accountId,
            bankId: formValues.bankId,
            username: formValues.username,
            password: formValues.password,
            cron: formValues.cron,
            lookbackDays: parseInt(formValues.lookbackDays, 10)
        }
    },
    // ...
);
```

After:
```typescript
createMutation.mutate(
    {
        data: {
            accountId: formValues.accountId,
            bankId: formValues.bankId,
            inputs: formValues.inputs,
            cron: formValues.cron,
            lookbackDays: parseInt(formValues.lookbackDays, 10)
        }
    },
    // ...
);
```

**Change E — `handleSubmit` update mutate call (lines 145–156):**

Before:
```typescript
updateMutation.mutate(
    {
        id: editTarget.id,
        data: {
            username: formValues.username !== '' ? formValues.username : undefined,
            password: formValues.password !== '' ? formValues.password : undefined,
            cron: formValues.cron,
            lookbackDays: parseInt(formValues.lookbackDays, 10),
            enabled: formValues.enabled
        }
    },
    // ...
);
```

After:
```typescript
updateMutation.mutate(
    {
        id: editTarget.id,
        data: {
            // Only send inputs if at least one key is non-empty (user typed something)
            inputs: Object.keys(formValues.inputs).length > 0 ? formValues.inputs : undefined,
            cron: formValues.cron,
            lookbackDays: parseInt(formValues.lookbackDays, 10),
            enabled: formValues.enabled
        }
    },
    // ...
);
```

**Change F — `handleFieldChange` signature:**

The existing `handleFieldChange(field: keyof SyncScheduleFormValues, value: string | boolean)`
cannot handle updating a single key within `inputs` (which is a nested object). Add a new
callback for input field changes:

```typescript
const handleInputChange = useCallback(
    (key: string, value: string): void => {
        setFormValues((prev) => ({
            ...prev,
            inputs: {...prev.inputs, [key]: value}
        }));
        setErrors((prev) => {
            if (!prev.inputErrors) return prev;
            const next = {...prev};
            const nextInputErrors = {...prev.inputErrors};
            delete nextInputErrors[key];
            next.inputErrors = Object.keys(nextInputErrors).length > 0
                ? nextInputErrors
                : undefined;
            return next;
        });
    },
    []
);
```

Add `handleInputChange` to `UseSyncScheduleReturn` and the return object.

---

### Step 19 — `SyncScheduleForm.tsx` credentials section replacement

**File:** `packages/frontend/src/features/scraper/components/SyncScheduleForm.tsx`

**New props** — add `handleInputChange` to `SyncScheduleFormProps`:

```typescript
interface SyncScheduleFormProps {
    // ...existing props...
    onInputChange: (key: string, value: string) => void;
}
```

**Replace the credentials row (lines 97–141)** with a dynamic render loop:

```tsx
{/* Plugin input fields — rendered from the selected scraper's inputSchema */}
{(() => {
    const scraper = scrapers?.find(s => s.bankId === values.bankId);
    if (!scraper) {
        return values.bankId !== '' ? (
            <p className={styles.hint}>Loading bank configuration…</p>
        ) : null;
    }
    return scraper.inputSchema.map((field) => {
        const fieldError = errors.inputErrors?.[field.key];
        const fieldValue = values.inputs[field.key] ?? '';

        return (
            <div key={field.key} className={styles.field}>
                <label className={styles.label} htmlFor={`ss-input-${field.key}`}>
                    {editMode ? `New ${field.label}` : field.label}
                    {!editMode && field.required && (
                        <span aria-hidden="true" className={styles.required}> *</span>
                    )}
                </label>

                {field.type === 'select' && field.options ? (
                    <select
                        id={`ss-input-${field.key}`}
                        className={`${styles.select}${fieldError ? ` ${styles.inputError}` : ''}`}
                        value={fieldValue}
                        required={!editMode && field.required}
                        aria-required={(!editMode && field.required) ? 'true' : 'false'}
                        aria-invalid={fieldError ? 'true' : 'false'}
                        onChange={(e) => { onInputChange(field.key, e.target.value); }}
                    >
                        <option value="">Select…</option>
                        {field.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        id={`ss-input-${field.key}`}
                        type={field.type}
                        autoComplete={field.type === 'password'
                            ? (editMode ? 'new-password' : 'current-password')
                            : field.key}
                        className={`${styles.input}${fieldError ? ` ${styles.inputError}` : ''}`}
                        value={fieldValue}
                        required={!editMode && field.required}
                        aria-required={(!editMode && field.required) ? 'true' : 'false'}
                        aria-invalid={fieldError ? 'true' : 'false'}
                        placeholder={editMode ? 'Leave blank to keep unchanged' : ''}
                        onChange={(e) => { onInputChange(field.key, e.target.value); }}
                    />
                )}

                {field.hint !== undefined && (
                    <span className={styles.hint}>{field.hint}</span>
                )}
                {fieldError !== undefined && (
                    <span role="alert" className={styles.error}>{fieldError}</span>
                )}
            </div>
        );
    });
})()}
```

**No-scraper-selected state:** When `bankId` is empty the block returns `null` (no fields shown).
When `bankId` is set but `scrapers` is still loading, a "Loading…" hint is rendered. When the
scraper is found, the `inputSchema` fields are rendered.

**Edit mode hint for password fields:** The `placeholder="Leave blank to keep unchanged"` text
is rendered for all field types in edit mode, consistent with the previous behaviour for the
password field.

---

## Part 5 — Frontend Test Scope

These test cases are handed to the `frontend-tester` agent. The tester owns step-level authorship
and screenshot rules.

### Preconditions

- Backend running with both CIBC and TD scrapers registered
- `npm run generate:api` completed and `pluginFieldDescriptorDto.ts` present
- User authenticated (regular role)
- At least one account exists in the database

### Coverage level: Regression

### User flows to cover

**Flow 1 — Create schedule with dynamically rendered fields**

1. Navigate to `/scraper`, open "New Schedule" modal
2. Observe: no input fields visible before bank is selected
3. Select CIBC from the bank dropdown
4. Observe: "Card / Username" (text) and "Password" (password) fields appear
5. Submit without filling inputs → error messages appear per field
6. Fill all required fields and submit → success, schedule appears in list

**Flow 2 — Hint text display**

1. Create modal open, CIBC selected
2. Observe: "Your CIBC online banking card number or username" appears below the username field
3. Confirm hint is not rendered for the password field (no hint in CIBC schema)

**Flow 3 — Password field type**

1. CIBC selected
2. Observe: password field `type="password"` (characters masked)
3. Confirm autocomplete attribute is `"current-password"` in create mode

**Flow 4 — Edit mode — inputs optional**

1. Edit an existing CIBC schedule
2. Observe: fields show "New Card / Username" / "New Password" labels with placeholder text
3. Leave inputs blank and save → success (no validation error; existing credentials preserved)

**Flow 5 — Bank switch clears inputs**

1. Select CIBC → fill username and password
2. Switch to TD
3. Observe: inputs are reset (no stale CIBC values visible)

**Flow 6 — Select field rendering (future scraper)**

If a test scraper with `type: 'select'` is available:
1. Select the bank
2. Observe: a `<select>` element appears with the defined options

**Edge cases:**

- No bank selected → no input fields shown, form submission blocked by bankId required error
- Scrapers list still loading → loading hint appears in the inputs area
- Backend returns 400 on create → error displayed in the form

**Auth redirect:** Unauthenticated access to `/scraper` redirects to `/login`.

---

## Part 6 — Figma Design Brief

This milestone modifies an existing form inside a modal. No new screens or pages are introduced.

### Modified component: `SyncScheduleForm` — credentials section

**Primary purpose:** Replace two hardcoded text/password fields with a dynamic list of fields
driven by the selected bank's `inputSchema`.

**Key content slots:**

1. **No bank selected state** — the input fields area is empty; no fields rendered.
2. **Loading state** — bank selected but scraper metadata still loading; show a loading hint
   or skeleton in the field area.
3. **Populated state** — `inputSchema` loaded; one field per descriptor rendered vertically.
   Each field has: label (with required asterisk when applicable), the input control, optional
   hint text below the control, optional error message below the hint.

**Field control types to design:**
- `type: 'text'` → standard single-line text input
- `type: 'password'` → password input (masked)
- `type: 'number'` → number input
- `type: 'select'` → dropdown select

**States per field:**
- Default
- Focused
- Filled
- Error (red border, error text below)

**Hint text styling:** Subdued/secondary text colour, smaller font size than the label.
Positioned below the input, above the error message.

**Edit mode variant:** Labels prefixed with "New" (e.g. "New Password"). Placeholder text
"Leave blank to keep unchanged" in all input fields.

**Layout structure:** Single-column vertical stack within the existing modal form.
No grid/row layout needed for the dynamic fields (unlike the original two-column credentials row).

**Design tokens:**
- Required asterisk: same red/danger colour token used throughout the app
- Error text: danger/red colour token
- Hint text: muted/secondary text token
- Field border error state: danger/red border token

---

## Summary of Files Changed

### Backend (create or modify)

| File | Action | Key change |
|------|--------|-----------|
| `src/scraper/interfaces/bank-scraper.interface.ts` | Modify | Add `PluginFieldDescriptor`, `PluginInputs`; remove `BankCredentials`; add `inputSchema` to `BankScraper`; rename `credentials` to `inputs` in `ScraperWorkerInput` |
| `src/scraper/banks/cibc.scraper.ts` | Modify | Add `inputSchema` array; update `login` parameter type |
| `src/scraper/banks/td.scraper.ts` | Modify | Add `inputSchema` array; update `login` parameter type |
| `src/scraper/scraper.plugin-loader.ts` | Modify | Add `Array.isArray(v.inputSchema)` to `isBankScraper` guard |
| `src/scraper/scraper-info.dto.ts` | Modify | Add `PluginFieldDescriptorDto` class; add `inputSchema` field to `ScraperInfoDto` |
| `src/scraper/scraper.registry.ts` | Modify | Add `inputSchema: s.inputSchema` to `listAll()` mapped object |
| `src/common/validators/is-string-record.validator.ts` | Create | `IsStringRecordConstraint` + `IsStringRecord` decorator |
| `src/common/validators/required-inputs.validator.ts` | Create | `RequiredInputsConstraint` injectable validator |
| `src/scraper/sync/dto/create-sync-schedule.dto.ts` | Modify | Remove `username`/`password`; add `inputs`; add `@Validate(RequiredInputsConstraint)` |
| `src/scraper/sync/dto/update-sync-schedule.dto.ts` | No change needed | `inputs?` inherited automatically via `PartialType` |
| `src/scraper/sync/sync-schedule.service.ts` | Modify | Rename `credentialsEnc` → `pluginConfigEnc` in all usages; update encrypt/decrypt logic |
| `src/scraper/scraper.service.ts` | Modify | `schedule.credentialsEnc` → `schedule.pluginConfigEnc`; cast to `Record<string, string>`; `credentials` → `inputs` in worker input |
| `src/scraper/scraper.worker.ts` | Modify | Destructure `inputs` not `credentials`; pass to `login()` |
| `src/scraper/scraper.module.ts` | Modify | Add `RequiredInputsConstraint` to providers |
| `src/main.ts` | Modify | Add `useContainer(app.select(AppModule), {fallbackOnErrors: true})` |
| `prisma/schema.prisma` | Modify | Rename `credentialsEnc` / `credentials_enc` → `pluginConfigEnc` / `plugin_config_enc` |

### Backend tests (modify)

| File | Action | Key change |
|------|--------|-----------|
| `src/scraper/__TEST__/scraper.plugin-loader.spec.ts` | Modify | Add `inputSchema: []` to `makePlugin`; add 2 new guard rejection tests |
| `src/scraper/__TEST__/scraper.registry.spec.ts` | Modify | Add `inputSchema: []` to `makeScraper`; add `inputSchema: []` to `listAll()` assertion |
| `src/scraper/sync/__TEST__/sync-schedule.service.spec.ts` | Modify | Update mocks/assertions for `pluginConfigEnc`, `inputs`, removed `username`/`password` |
| `src/scraper/__TEST__/scraper.service.spec.ts` | Modify | Update mock schedule to use `pluginConfigEnc`; `credentials` → `inputs` in worker data |
| `src/common/validators/__TEST__/is-string-record.validator.spec.ts` | Create | Unit tests for `IsStringRecordConstraint` |
| `src/common/validators/__TEST__/required-inputs.validator.spec.ts` | Create | Unit tests for `RequiredInputsConstraint` |

### Frontend (modify)

| File | Action | Key change |
|------|--------|-----------|
| `src/api/model/scraperInfoDto.ts` | Regenerated | Gains `inputSchema` field |
| `src/api/model/pluginFieldDescriptorDto.ts` | Regenerated (new) | New interface for descriptor |
| `src/api/model/createSyncScheduleDto.ts` | Regenerated | `username`/`password` → `inputs` |
| `src/api/model/updateSyncScheduleDto.ts` | Regenerated | `username?`/`password?` → `inputs?` |
| `src/features/scraper/types/scraper.types.ts` | Modify | Replace `username`/`password` with `inputs`; extend `SyncScheduleFormErrors` |
| `src/features/scraper/hooks/useSyncSchedule.ts` | Modify | All changes in Step 18 |
| `src/features/scraper/components/SyncScheduleForm.tsx` | Modify | Replace credentials row with dynamic render loop (Step 19) |

---

## Recommended Agent Sequence

1. `figma-designer` — Review the Figma Design Brief (Part 6) and produce wireframes for the
   updated `SyncScheduleForm` dynamic field section before React work begins.

2. `backend-dev` — Implement all backend changes (Steps 1–13). Apply in this sub-order to
   minimise typecheck failures during implementation:
   - Step 1 (interface) → Step 2 (scrapers) → Step 3 (guard) → Step 6 (validator) →
     Step 7 (required-inputs validator) → Step 8 (DTO) → Step 4 (info DTO) → Step 5 (registry) →
     Step 10 (migration) → Step 11 (service) → Step 12 (scraper.service) → Step 13 (worker) →
     Step 9 (verify UpdateSyncScheduleDto compiles) → Step 14/15 (test factories)

3. `test-writer` — Backend unit tests. Key new test files: `is-string-record.validator.spec.ts`,
   `required-inputs.validator.spec.ts`. Key existing test files to update:
   `scraper.plugin-loader.spec.ts`, `scraper.registry.spec.ts`, `sync-schedule.service.spec.ts`,
   `scraper.service.spec.ts`.

4. `backend-tester` — Run the 10-TC Backend API Test Plan (Part 3) against the live server.
   Save plan to `test-plan/scraper-plugins/milestone-4-backend.md` and report to
   `test-plan/scraper-plugins/milestone-4-backend-report.md`.

5. `code-reviewer` — Review backend changes.

6. Run `cd packages/frontend && npm run generate:api` once backend is committed and Swagger stable.

7. `frontend-dev` — Implement frontend changes (Steps 17–19). Build order:
   - `scraper.types.ts` → `useSyncSchedule.ts` → `SyncScheduleForm.tsx`

8. `test-writer` — Frontend unit tests (see Part 5 test scope).

9. `code-reviewer` — Frontend review.

10. `frontend-tester` — Execute E2E tests from the Frontend Test Scope (Part 5).
    Save to `test-plan/scraper-plugins/milestone-4-frontend.md` and report to
    `test-plan/scraper-plugins/milestone-4-frontend-report.md`.

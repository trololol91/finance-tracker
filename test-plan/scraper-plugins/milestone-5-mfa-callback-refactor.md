# Milestone 5 — MFA Callback Refactor

**Feature area:** `packages/backend/src/scraper/`

**Why:** The original MFA design had `login()` throw `MfaRequiredError` to signal that an MFA code
was needed, and a separate `submitMfa?(code)` method to deliver the code after the worker caught
the exception. Using exceptions for control flow is not idiomatic in TypeScript/Node.js, and the
worker required a duck-type check to work around `vi.resetModules()` causing module-realm
mismatches in tests.

**Change:** Replace the throw/catch MFA bridge with a callback injected into `login()`. The plugin
calls `await resolveMfa(prompt)` inline when it hits the MFA screen and receives the code as the
return value. The worker builds the resolver that does the `postMessage`/`once` dance and passes it
in. `submitMfa` and `MfaRequiredError` are removed entirely.

---

## 1. bank-scraper.interface.ts

**File:** `packages/backend/src/scraper/interfaces/bank-scraper.interface.ts`

### 1.1 Remove MfaRequiredError

Delete the `MfaRequiredError` class entirely. It is no longer thrown or caught anywhere in the
framework. External plugins that used it should move to the callback pattern.

### 1.2 Update login signature

```typescript
/**
 * Navigate to the login page and complete authentication.
 *
 * If the bank presents an MFA/OTP screen during login, call:
 *   const code = await resolveMfa('Enter the code sent to your device');
 * then fill the code and complete the login flow inline.
 *
 * `resolveMfa` is undefined in contexts where MFA is not supported
 * (e.g. admin dry-run test). If MFA is required but no resolver is
 * provided, throw a plain Error so the job fails with a clear message.
 */
login(inputs: PluginInputs, resolveMfa?: (prompt: string) => Promise<string>): Promise<void>;
```

### 1.3 Remove submitMfa

Delete the `submitMfa?(code: string): Promise<void>` optional method from the `BankScraper`
interface. The callback pattern makes it unnecessary — the plugin receives and submits the code
entirely within `login()`.

### 1.4 Remove the JSDoc note at the top of the file

Remove the comment block that references `page` parameters and `playwright` — it is no longer
accurate now that the interface has no `page` references anywhere.

---

## 2. banks/cibc.scraper.ts

**File:** `packages/backend/src/scraper/banks/cibc.scraper.ts`

### 2.1 Remove MfaRequiredError references

- Remove `MfaRequiredError` from the import of `bank-scraper.interface.js`
- Remove the re-export line: `export {MfaRequiredError} from '../interfaces/bank-scraper.interface.js';`

### 2.2 Update login to accept resolveMfa callback

Replace the current `login` implementation. The structure changes from:

```
login() {
    // ... navigate, fill credentials, click sign on ...
    // check for MFA screen
    // throw new MfaRequiredError(...)
}

submitMfa(code) {
    // fill code, click submit, wait for dashboard
}
```

To:

```typescript
async login(inputs: PluginInputs, resolveMfa?: (prompt: string) => Promise<string>): Promise<void> {
    const {chromium} = await import('playwright');
    browser = await chromium.launch({headless: false, channel: 'chrome'});
    page = await browser.newPage();

    // ... navigate to CIBC, fill card number, click continue,
    //     fill password, click sign on (same as today) ...

    // Check if MFA screen appeared
    try {
        await page.waitForSelector('input[data-test-id="verification-code-input"]', {timeout: 15000});
    } catch {
        // No MFA — wait for dashboard and return
        await page.waitForSelector('button[data-test-id="sign-out-btn"]', {timeout: 15000});
        return;
    }

    // MFA screen is visible
    if (!resolveMfa) {
        throw new Error('MFA required but no resolver was provided');
    }

    const code = await resolveMfa('Enter the verification code sent to your device');

    const mfaInput = await page.waitForSelector(
        'input[data-test-id="verification-code-input"]', {timeout: 15000}
    );
    await mfaInput.fill(code);

    const submitButton = await page.waitForSelector(
        'button[data-test-id="action-bar-primary-button"]', {timeout: 15000}
    );
    await submitButton.click();

    await page.waitForSelector('button[data-test-id="sign-out-btn"]', {timeout: 15000});
}
```

### 2.3 Remove submitMfa method

Delete the `submitMfa` method from the `cibcScraper` object entirely.

---

## 3. scraper.worker.ts

**File:** `packages/backend/src/scraper/scraper.worker.ts`

### 3.1 Remove MfaRequiredError import

Remove the import of `MfaRequiredError` from `bank-scraper.interface.js`.

### 3.2 Build resolver and pass to login

Replace the current inner `try/catch` block around `login()` with a resolver build + direct call:

```typescript
const resolver = (prompt: string): Promise<string> => {
    parentPort!.postMessage({type: 'mfa_required', prompt});
    return new Promise<string>(r =>
        parentPort!.once('message', ({code}: {code: string}) => r(code))
    );
};

await scraper.login(input.inputs, resolver);
```

The entire inner `try { await scraper.login(...) } catch (err) { ... }` block is deleted.
The duck-type `isMfaError` check and the `submitMfa` call are both removed.

### 3.3 Full try block after refactor

```typescript
try {
    const mod = await import(input.pluginPath) as {default: BankScraper};
    scraper = mod.default;

    const resolver = (prompt: string): Promise<string> => {
        parentPort!.postMessage({type: 'mfa_required', prompt});
        return new Promise<string>(r =>
            parentPort!.once('message', ({code}: {code: string}) => r(code))
        );
    };

    await scraper.login(input.inputs, resolver);

    const transactions: RawTransaction[] = await scraper.scrapeTransactions(
        input.inputs,
        {
            startDate: new Date(input.startDate),
            endDate:   new Date(input.endDate),
            includePending: true
        }
    );

    // ... dedup, createMany, postMessage result (unchanged) ...

} finally {
    await scraper?.cleanup?.();
    await prisma.$disconnect();
}
```

---

## 4. scraper-admin.service.ts

**File:** `packages/backend/src/scraper/scraper-admin.service.ts`

No change required. `testScraper` calls `plugin.login(dto.inputs)` with no resolver. If the bank
requires MFA, the plugin throws `Error('MFA required but no resolver was provided')` and the job
fails with a clear message. This is the correct behavior for a developer dry-run test — MFA cannot
be interactively resolved in a synchronous HTTP request.

---

## 5. banks/stub.scraper.ts

No change required. `stub.scraper.ts` has no MFA flow. The `login()` signature gains the optional
second parameter from the interface change but the stub ignores it.

---

## 6. Test updates

### 6.1 scraper.worker.spec.ts

**TC-W-07 — MFA bridge: resolver is passed to login and triggers mfa_required message**

Replace the current throw-based mock with a mock that invokes the callback:

```typescript
it('MFA bridge: posts mfa_required and passes code via resolver', async () => {
    const mfaScraper: BankScraper = {
        ...stubScraper,
        login: vi.fn().mockImplementation(
            async (_inputs: PluginInputs, resolveMfa?: (p: string) => Promise<string>) => {
                await resolveMfa?.('Enter your OTP');
            }
        )
    };

    mockState.once.mockImplementation(
        (_event: string, cb: (msg: {code: string}) => void) => { cb({code: '123456'}); }
    );

    await importWorker(() => {
        vi.doMock(STUB_PLUGIN_URL, () => ({default: mfaScraper}));
    });

    vi.doUnmock(STUB_PLUGIN_URL);

    expect(mockState.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({type: 'mfa_required', prompt: 'Enter your OTP'})
    );
    // Scrape still proceeds after MFA
    expect(getResultMsg()).toBeDefined();
});
```

**Remove TC-W-08** (`'MFA bridge: submitMfa is not called when scraper does not define it'`).
The concept of `submitMfa` no longer exists. The analogous scenario — login that never calls
the resolver — is already covered by TC-W-01 through TC-W-06 (all use `stubScraper.login` which
ignores `resolveMfa`).

### 6.2 scraper-admin.service.spec.ts

Remove `submitMfa` from `makeMockPlugin`. The `inputSchema` field is also missing from the factory
— that is a pre-existing gap and out of scope here.

```typescript
const makeMockPlugin = (overrides?: Partial<BankScraper>): BankScraper => ({
    bankId: 'cibc',
    displayName: 'CIBC',
    requiresMfaOnEveryRun: true,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: true,
    login: vi.fn().mockResolvedValue(undefined),
    scrapeTransactions: vi.fn().mockResolvedValue([]),
    cleanup: vi.fn().mockResolvedValue(undefined),
    ...overrides
} as unknown as BankScraper);
```

---

## 7. Frontend — no changes

`useSyncJob.submitMfa(sessionId, code)` is a frontend → backend HTTP call to
`POST /sync-schedules/:sessionId/mfa-response`. The backend controller receives the code and
forwards it to the worker via `session.worker.postMessage({code})`. The worker resolver is waiting
on `parentPort.once('message', ...)` for exactly this message.

The HTTP endpoint, the session store bridge, and the frontend hook are all unchanged. Only the
worker-side handling changes — from a `try/catch` + `submitMfa()` call to a resolver callback
passed into `login()`.

---

## 8. Commit message

```
refactor(scraper): replace MFA throw/catch with resolveMfa callback in login()

Remove MfaRequiredError and submitMfa from BankScraper. Plugins now receive
an optional resolveMfa callback and call it inline when the MFA screen appears.
The worker builds the resolver that posts mfa_required and awaits the code via
parentPort.once. Eliminates exception-as-control-flow and the module-realm
duck-type workaround in the worker.
```

---

## Recommended Next Actions

#### Step 1 — Implement Backend ✅ Done

```
@test-plan/scraper-plugins/milestone-5-mfa-callback-refactor.md

backend-dev — Implement the MFA callback refactor using the plan above.
Work through the files in this order:

1. packages/backend/src/scraper/interfaces/bank-scraper.interface.ts
   - Remove the MfaRequiredError class entirely
   - Update login() signature to:
     login(inputs: PluginInputs, resolveMfa?: (prompt: string) => Promise<string>): Promise<void>
   - Remove submitMfa?(code: string): Promise<void> from BankScraper
   - Remove the JSDoc comment block at the top of the file that references
     the page parameter casting pattern — it is no longer accurate

2. packages/backend/src/scraper/banks/cibc.scraper.ts
   - Remove MfaRequiredError from the import of bank-scraper.interface.js
   - Remove the re-export line: export {MfaRequiredError} from '../interfaces/...'
   - Update login() to accept resolveMfa? as a second parameter
   - Replace the throw new MfaRequiredError(...) with:
       if (!resolveMfa) throw new Error('MFA required but no resolver was provided');
       const code = await resolveMfa('Enter the verification code sent to your device');
     then fill the code and submit inline (reuse the selector logic from the
     old submitMfa method)
   - Remove the submitMfa method from the cibcScraper object

3. packages/backend/src/scraper/scraper.worker.ts
   - Remove the MfaRequiredError import
   - Build the resolver before calling login:
       const resolver = (prompt: string): Promise<string> => {
           parentPort!.postMessage({type: 'mfa_required', prompt});
           return new Promise<string>(r =>
               parentPort!.once('message', ({code}: {code: string}) => r(code))
           );
       };
   - Replace await scraper.login(input.inputs) with
     await scraper.login(input.inputs, resolver)
   - Delete the entire inner try/catch block that was around login() —
     the duck-type isMfaError check and the submitMfa call are both gone

4. packages/backend/src/scraper/scraper-admin.service.ts
   - No change needed. login(dto.inputs) with no resolver is correct —
     MFA-required banks fail with a plain Error in dry-run test context.

After implementing, run npm run typecheck and npm run lint to confirm the
build is clean before finishing.
```

#### Step 2 — Tests ✅ Done

```
@test-plan/scraper-plugins/milestone-5-mfa-callback-refactor.md

test-writer — Update the Vitest specs for the MFA callback refactor.
Read every spec file before modifying — match existing mock style exactly.

packages/backend/src/scraper/__TEST__/scraper.worker.spec.ts:
- TC-W-07: Replace the throw-based MFA mock with a callback-invoking mock.
  The new mfaScraper.login mock should call resolveMfa?.('Enter your OTP')
  and await it. mockState.once continues to call back with {code: '123456'}.
  Assert postMessage was called with {type:'mfa_required', prompt:'Enter your OTP'}.
  Assert getResultMsg() is defined — scrapeTransactions still ran after MFA.
- Remove TC-W-08 entirely. It tested submitMfa-not-defined behaviour which
  no longer exists. The equivalent scenario (login that never calls resolveMfa)
  is already covered by TC-W-01 through TC-W-06.

packages/backend/src/scraper/__TEST__/scraper-admin.service.spec.ts:
- Remove submitMfa from makeMockPlugin — the interface no longer has it.

Run the full backend spec suite after updating and fix any failures before
finishing.
```

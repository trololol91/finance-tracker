#!/usr/bin/env node
/**
 * Post-processes Orval-generated files to add .js extensions to relative
 * imports, required by TypeScript's NodeNext module resolution.
 *
 * Run automatically after `generate:api`.
 */

import {readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Only patch the model directory — the generated API call files are intentionally
// excluded from compilation (wrong mutator arity, unresolvable barrel imports).
const API_DIR = new URL('../src/api/model', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

/** Add .js to bare relative imports/exports that don't already have an extension. */
const fixExtensions = (source) =>
    source.replace(
        /((?:import|export)\s[^'"]*from\s+['"])(\.[^'"]+)(['"'])/g,
        (_, prefix, path, quote) => {
            if (/\.[a-z]+$/.test(path)) return `${prefix}${path}${quote}`;
            return `${prefix}${path}.js${quote}`;
        }
    );

async function* walk(dir) {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else if (entry.name.endsWith('.ts')) yield full;
    }
}

let count = 0;
for await (const file of walk(API_DIR)) {
    const original = await readFile(file, 'utf-8');
    const fixed = fixExtensions(original);
    if (fixed !== original) {
        await writeFile(file, fixed, 'utf-8');
        count++;
    }
}

console.log(`fix-api-imports: patched ${count} file(s) in src/api/`);

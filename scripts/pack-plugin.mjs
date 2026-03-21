/**
 * pack-plugin.mjs — shared packaging script for scraper workspace packages.
 *
 * Produces a distributable <name>-<version>.zip containing only:
 *   dist/        — compiled JavaScript output
 *   package.json — deployment manifest (devDependencies and scripts stripped)
 *
 * node_modules/ is intentionally excluded; the server runs
 * `npm install` after extracting the zip.
 *
 * Usage (from within a scraper package):
 *   node ../../scripts/pack-plugin.mjs
 */
import {createWriteStream, readFileSync} from 'fs';
import archiver from 'archiver';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Strip fields that should not be present in a deployment artifact.
// devDependencies: build/test tools not needed at runtime; including them
//   causes `npm install` to hit the registry for local-only packages like
//   @finance-tracker/plugin-sdk.
// scripts: strip build/lint/test lifecycle scripts that cannot run on the server.
//   postinstall is kept so plugins can declare binary setup (e.g. playwright install chromium).
const {devDependencies: _dev, scripts, ...deployPkg} = pkg;
const {postinstall, install} = scripts ?? {};
if (postinstall || install) deployPkg.scripts = {postinstall, install};

const baseName = pkg.name.replace(/^@[^/]+\//, '');
const outFile = `${baseName}-${pkg.version}.zip`;

const output = createWriteStream(outFile);
const archive = archiver('zip', {zlib: {level: 9}});

archive.on('error', err => { throw err; });
archive.pipe(output);
archive.append(Buffer.from(JSON.stringify(deployPkg, null, 2)), {name: 'package.json'});
archive.directory('dist/', 'dist');
archive.finalize();

output.on('close', () => {
    console.log(`Packed → ${outFile} (${archive.pointer()} bytes)`);
});

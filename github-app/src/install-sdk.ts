import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * v3-P1.2: the setup PR also INSTALLS and STARTS the SDK, so installing the GitHub App and merging one PR is the whole
 * setup. Deterministic file edits only; every step that cannot be done safely becomes a note in the PR for a human.
 */
export interface FileChange { path: string; content: string; encoding?: 'base64' }
export interface InstallPlan { files: FileChange[]; notes: string[]; done: string[] }

export interface SdkSource {
  /** version range once @seismo/sdk is on npm (SEISMO_SDK_SPEC); otherwise a vendored tarball is committed */
  spec?: string;
  tarball?: { fileName: string; base64: string };
}

/** The SDK to install: a published version range, else a tarball packed from this monorepo's sdk-node (cached). */
let cachedTarball: SdkSource['tarball'] | undefined;
export function sdkSource(env: NodeJS.ProcessEnv = process.env): SdkSource {
  if (env.SEISMO_SDK_SPEC) return { spec: env.SEISMO_SDK_SPEC };
  if (!cachedTarball) {
    const sdkDir = env.SEISMO_SDK_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'sdk-node');
    const out = mkdtempSync(join(tmpdir(), 'seismo-sdk-'));
    const name = execFileSync('npm', ['pack', '--silent', '--pack-destination', out], { cwd: sdkDir, encoding: 'utf8', timeout: 60_000 }).trim().split('\n').pop()!;
    cachedTarball = { fileName: name, base64: readFileSync(join(out, name)).toString('base64') };
  }
  return { tarball: cachedTarball };
}

const ENV_URL = /process\.env\.([A-Z][A-Z0-9_]*_(?:API_)?(?:BASE_)?(?:URL|HOST|ENDPOINT))\b/g;
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function sourceFiles(dir: string, out: string[] = [], depth = 0): string[] {
  if (depth > 6) return out;
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', '.next', 'dist', 'build', 'vendor', 'coverage'].includes(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) sourceFiles(p, out, depth + 1);
    else if (SOURCE.test(name) && st.size < 512 * 1024) out.push(p);
  }
  return out;
}

const indentOf = (json: string) => (/^\{\n(\s+)"/.exec(json)?.[1] ?? '  ');

export function planSdkInstall(dir: string, sdk: SdkSource): InstallPlan {
  const files: FileChange[] = [];
  const notes: string[] = [];
  const done: string[] = [];
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return { files, notes: ['No package.json at the repo root: install `@seismo/sdk` and add `import \'@seismo/sdk/auto\'` to your server start-up by hand.'], done };

  const raw = readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw) as { type?: string; main?: string; scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  // 1. the dependency (+ the lockfile, so `npm ci` in their CI keeps working)
  if (!deps['@seismo/sdk']) {
    const spec = sdk.spec ?? `file:vendor/${sdk.tarball!.fileName}`;
    pkg.dependencies = { ...pkg.dependencies, '@seismo/sdk': spec };
    const next = JSON.stringify(pkg, null, indentOf(raw)) + '\n';
    files.push({ path: 'package.json', content: next });
    if (sdk.tarball) files.push({ path: `vendor/${sdk.tarball.fileName}`, content: sdk.tarball.base64, encoding: 'base64' });
    done.push(`adds \`@seismo/sdk\` (${spec}) to package.json`);
    if (existsSync(join(dir, 'package-lock.json'))) {
      try {
        writeFileSync(pkgPath, next);
        if (sdk.tarball) { mkdirSync(join(dir, 'vendor'), { recursive: true }); writeFileSync(join(dir, 'vendor', sdk.tarball.fileName), Buffer.from(sdk.tarball.base64, 'base64')); }
        // --ignore-scripts: never run the customer's (or anyone's) install scripts on our servers
        execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'ignore', timeout: 120_000 });
        files.push({ path: 'package-lock.json', content: readFileSync(join(dir, 'package-lock.json'), 'utf8') });
        done.push('updates package-lock.json');
      } catch {
        notes.push('package-lock.json could not be updated automatically: run `npm install` once after merging.');
      }
    } else if (existsSync(join(dir, 'pnpm-lock.yaml')) || existsSync(join(dir, 'yarn.lock'))) {
      notes.push('This repo uses pnpm or yarn: run your install command once after merging so the lockfile includes `@seismo/sdk`.');
    }
  }

  // 2. start the SDK when the server starts
  const usesTs = existsSync(join(dir, 'tsconfig.json'));
  if (deps['next']) {
    const srcLayout = existsSync(join(dir, 'src', 'app')) || existsSync(join(dir, 'src', 'pages'));
    const candidates = ['instrumentation.ts', 'instrumentation.js', 'src/instrumentation.ts', 'src/instrumentation.js'].filter((f) => existsSync(join(dir, f)));
    if (candidates.length) {
      if (!candidates.some((f) => readFileSync(join(dir, f), 'utf8').includes('@seismo/sdk'))) notes.push(`\`${candidates[0]}\` already exists: add \`if (process.env.NEXT_RUNTIME === 'nodejs') await import('@seismo/sdk/auto');\` inside its \`register()\`.`);
    } else {
      const path = `${srcLayout ? 'src/' : ''}instrumentation.${usesTs ? 'ts' : 'js'}`;
      files.push({ path, content: `// Added by Seismo: starts the Seismo SDK once, when the Next.js server starts (read-only, fail-open).\nexport async function register() {\n  if (process.env.NEXT_RUNTIME === 'nodejs') await import('@seismo/sdk/auto');\n}\n` });
      done.push(`adds \`${path}\` (Next.js start-up hook)`);
    }
  } else {
    const fromStart = /(?:node|tsx|ts-node|nodemon)\s+(?:--[\w-]+(?:=\S+)?\s+)*([\w./-]+\.(?:[cm]?[jt]s))/.exec(pkg.scripts?.['start'] ?? '')?.[1];
    const entry = [fromStart, pkg.main].find((f) => f && existsSync(join(dir, f)) && SOURCE.test(f));
    if (!entry) notes.push('Could not find the server entry file: add `import \'@seismo/sdk/auto\';` as the first line of your server start-up.');
    else {
      const text = readFileSync(join(dir, entry), 'utf8');
      if (!text.includes('@seismo/sdk')) {
        const esm = pkg.type === 'module' || ['.mjs', '.ts', '.mts'].includes(extname(entry)) || /^\s*import\s/m.test(text);
        const line = esm ? "import '@seismo/sdk/auto'; // Added by Seismo: read-only, fail-open API watcher\n" : "require('@seismo/sdk/auto'); // Added by Seismo: read-only, fail-open API watcher\n";
        const shebang = text.startsWith('#!') ? text.slice(0, text.indexOf('\n') + 1) : '';
        files.push({ path: entry, content: shebang + line + text.slice(shebang.length) });
        done.push(`starts the SDK in \`${entry}\``);
      }
    }
  }

  // 3. which env vars hold provider URLs -> service names (the scanner and the SDK both read this)
  if (!existsSync(join(dir, 'seismo.config.json'))) {
    const services: Record<string, string> = {};
    for (const f of sourceFiles(dir)) for (const m of readFileSync(f, 'utf8').matchAll(ENV_URL)) services[m[1]!] = m[1]!.replace(/_(API_)?(BASE_)?(URL|HOST|ENDPOINT)$/, '').toLowerCase();
    if (Object.keys(services).length) {
      files.push({ path: 'seismo.config.json', content: JSON.stringify({ services, enumAllowList: [] }, null, 2) + '\n' });
      done.push(`adds \`seismo.config.json\` (${Object.keys(services).length} provider URL variable(s) found)`);
    }
  }

  // 4. the two env vars the app needs
  const envExample = join(dir, '.env.example');
  const envText = existsSync(envExample) ? readFileSync(envExample, 'utf8') : '';
  if (!envText.includes('SEISMO_KEY')) {
    files.push({ path: '.env.example', content: `${envText}${envText && !envText.endsWith('\n') ? '\n' : ''}# Seismo (watches the third-party APIs this app calls; never blocks it)\nSEISMO_KEY=\nSEISMO_ENDPOINT=\n` });
    done.push('adds `SEISMO_KEY` and `SEISMO_ENDPOINT` to `.env.example`');
  }
  return { files, notes, done };
}

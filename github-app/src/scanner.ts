import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import yaml from 'js-yaml';
import { Node, Project, SyntaxKind, type CallExpression, type Identifier } from 'ts-morph';
import type { CodeMap } from '@seismo/contracts';

type CallSite = CodeMap['callSites'][number];
type FieldRead = CodeMap['fieldReads'][number];
type Usage = FieldRead['usage'];

export interface ScanOptions { repo: string; commit: string }
interface Config { services?: Record<string, string>; ignore?: string[]; passThrough?: string[] }

const MONEY = /amount|price|total|fee|tax|cost|rupees|paise|balance/i;
const HTTP = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'request']);
/** Methods called ON a value: the read is the value itself (`amount.toFixed(2)` reads `amount`). */
const VALUE_METHODS = new Set(['toLocaleString', 'toFixed', 'toString', 'toLowerCase', 'toUpperCase', 'trim', 'includes', 'startsWith', 'endsWith', 'split', 'replace', 'padStart', 'valueOf']);
const SAME_ARRAY = new Set(['slice', 'sort', 'reverse', 'toSorted', 'toReversed', 'concat', 'flat']);
const ITER = new Set(['map', 'forEach', 'filter', 'find', 'some', 'every', 'flatMap', 'reduce']);
/** Functions that return their first argument unchanged in meaning (Seismo's alias wrappers + project config). */
const PASS_THROUGH = new Set(['applyAliases', 'withAliases', 'withAliasesResponse']);
const DB_CALL = /(^|\.)(db|prisma|sql|knex|redis|repo|repository|collection|model)\b|\.(insert|save|create|update|upsert|query|execute|set)$/i;

/** Scan a checked-out repo directory into a CodeMap (docs/roadmap/P2). Pure: no network, no LLM. */
export function scanDirectory(dir: string, opts: ScanOptions): CodeMap {
  const config: Config = existsSync(join(dir, 'seismo.config.json')) ? JSON.parse(readFileSync(join(dir, 'seismo.config.json'), 'utf8')) : {};
  const project = new Project({ compilerOptions: { allowJs: true, jsx: 4 }, skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
  project.addSourceFilesAtPaths([join(dir, '**/*.{ts,tsx,js,jsx,mjs}'), '!' + join(dir, '**/node_modules/**'), '!' + join(dir, '**/.next/**'), '!' + join(dir, '**/dist/**'), '!' + join(dir, '**/*.test.*')]);

  const passThrough = new Set([...PASS_THROUGH, ...(config.passThrough ?? [])]);
  const callSites: CallSite[] = [];
  const fieldReads: FieldRead[] = [];
  const seen = new Set<string>();
  const rel = (f: string) => relative(dir, f);

  const addRead = (cs: CallSite, field: string, node: Node) => {
    if (!field) return;
    const file = rel(node.getSourceFile().getFilePath());
    const line = node.getStartLineNumber();
    const key = `${cs.id}|${field}|${file}|${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    const usage = classify(node);
    const last = field.split('.').pop() ?? field;
    // the source line, so the dashboard can show where the read is (code from the customer's repo, never API data)
    const snippet = (node.getSourceFile().getFullText().split('\n')[line - 1] ?? '').trim().slice(0, 160);
    fieldReads.push({ callSiteId: cs.id, field, file, line, usage, money: MONEY.test(last) && usage !== 'display' && usage !== 'read', ...(snippet ? { snippet } : {}) });
  };

  /** Follow identifier `id` (a variable holding response data) and record every field read under `prefix`. */
  const track = (cs: CallSite, id: Identifier, prefix: string, depth: number, visited = new Set<Node>()) => {
    for (const ref of id.findReferencesAsNodes()) {
      if (visited.has(ref) || ref === id) continue;
      visited.add(ref);
      readFrom(cs, ref, prefix, depth, visited);
    }
  };

  /** `node` is an expression referencing data at path `prefix`. Record what happens to it. */
  const readFrom = (cs: CallSite, node: Node, prefix: string, depth: number, visited: Set<Node>) => {
    const parent = node.getParent();
    if (!parent) return;
    // data.a  /  data?.a
    if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === node) {
      const name = parent.getName();
      const path = prefix ? `${prefix}.${name}` : name;
      if (ITER.has(name) && Node.isCallExpression(parent.getParent())) {
        const call = parent.getParent() as CallExpression;
        const cb = call.getArguments()[0];
        if (cb && (Node.isArrowFunction(cb) || Node.isFunctionExpression(cb))) {
          const p = cb.getParameters()[name === 'reduce' ? 1 : 0];
          const nameNode = p?.getNameNode();
          if (nameNode && Node.isIdentifier(nameNode)) track(cs, nameNode, `${prefix}[]`, depth, visited);
          else if (nameNode && Node.isObjectBindingPattern(nameNode)) destructure(cs, nameNode, `${prefix}[]`, depth, visited);
        }
        return;
      }
      // orders.slice(0, 20) / .sort() return the same items: keep following the array
      if (SAME_ARRAY.has(name) && Node.isCallExpression(parent.getParent()) && (parent.getParent() as CallExpression).getExpression() === parent) {
        readFrom(cs, parent.getParent()!, prefix, depth, visited);
        return;
      }
      if (name === 'length' || name === 'then') return;
      if (prefix && VALUE_METHODS.has(name) && Node.isCallExpression(parent.getParent())) { addRead(cs, prefix, parent.getParent()!); return; }
      readFrom(cs, parent, path, depth, visited);
      return;
    }
    if (Node.isElementAccessExpression(parent) && parent.getExpression() === node) {
      const arg = parent.getArgumentExpression();
      const seg = arg && Node.isStringLiteral(arg) ? `.${arg.getLiteralValue()}` : '[]';
      readFrom(cs, parent, prefix + seg, depth, visited);
      return;
    }
    if (Node.isNonNullExpression(parent) || Node.isParenthesizedExpression(parent) || Node.isAsExpression(parent) || Node.isAwaitExpression(parent)) {
      readFrom(cs, parent, prefix, depth, visited);
      return;
    }
    // const { a, b } = data   /   const x = data.items
    if (Node.isVariableDeclaration(parent) && parent.getInitializer() === node) {
      const nameNode = parent.getNameNode();
      if (Node.isObjectBindingPattern(nameNode)) destructure(cs, nameNode, prefix, depth, visited);
      else if (Node.isIdentifier(nameNode)) {
        if (prefix) track(cs, nameNode, prefix, depth, visited);
        else track(cs, nameNode, prefix, depth, visited);
      }
      return;
    }
    // return data  -> follow callers (one level)
    if (Node.isReturnStatement(parent) && depth < 2) {
      const fn = parent.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a));
      followCallers(cs, fn, prefix, depth + 1, visited);
      return;
    }
    // applyAliases(data, ...) / withAliases(data, ...) -> the result IS the data
    if (Node.isCallExpression(parent) && parent.getArguments()[0] === node && passThrough.has(parent.getExpression().getText().split('.').pop()!)) {
      readFrom(cs, parent, prefix, depth, visited);
      return;
    }
    // helper(data)  -> follow into the callee's parameter (one level)
    if (Node.isCallExpression(parent) && parent.getArguments().includes(node as never) && depth < 2) {
      const idx = parent.getArguments().indexOf(node as never);
      const sym = parent.getExpression().getSymbol();
      const decl = (sym?.isAlias() ? sym.getAliasedSymbol() : sym)?.getDeclarations()[0];   // follow imports to the real function
      const fn = decl && (Node.isFunctionDeclaration(decl) ? decl : Node.isVariableDeclaration(decl) ? decl.getInitializer() : undefined);
      if (fn && (Node.isFunctionDeclaration(fn) || Node.isArrowFunction(fn) || Node.isFunctionExpression(fn))) {
        const p = fn.getParameters()[idx]?.getNameNode();
        if (p && Node.isIdentifier(p)) track(cs, p, prefix, depth + 1, visited);
        else if (p && Node.isObjectBindingPattern(p)) destructure(cs, p, prefix, depth + 1, visited);
      }
    }
    // Direct use of the whole object (or of a field already recorded by the caller).
    if (prefix) addRead(cs, prefix, node);
  };

  const destructure = (cs: CallSite, pattern: Node, prefix: string, depth: number, visited: Set<Node>) => {
    if (!Node.isObjectBindingPattern(pattern)) return;
    for (const el of pattern.getElements()) {
      const key = el.getPropertyNameNode()?.getText() ?? el.getName();
      const path = prefix ? `${prefix}.${key}` : key;
      const nameNode = el.getNameNode();
      if (Node.isObjectBindingPattern(nameNode)) destructure(cs, nameNode, path, depth, visited);
      else if (Node.isIdentifier(nameNode)) {
        const refs = nameNode.findReferencesAsNodes().filter((r) => r !== nameNode);
        if (refs.length === 0) addRead(cs, path, el);
        for (const r of refs) { addRead(cs, path, r); }
      }
    }
  };

  const followCallers = (cs: CallSite, fn: Node | undefined, prefix: string, depth: number, visited: Set<Node>) => {
    if (!fn) return;
    const holder = Node.isFunctionDeclaration(fn) ? fn : fn.getParent();
    const nameNode = Node.isFunctionDeclaration(fn) ? fn.getNameNode() : Node.isVariableDeclaration(holder) ? holder.getNameNode() : undefined;
    if (!nameNode || !Node.isIdentifier(nameNode)) return;
    for (const ref of nameNode.findReferencesAsNodes()) {
      const call = ref.getParent();
      if (call && Node.isCallExpression(call) && call.getExpression() === ref) readFrom(cs, call, prefix, depth, visited);
    }
  };

  // ---- find HTTP call sites ----
  for (const sf of project.getSourceFiles()) {
    const envNames = new Map<string, string>(); // const USERS = process.env.USERS_API_URL
    for (const vd of sf.getVariableDeclarations()) {
      const init = vd.getInitializer()?.getText() ?? '';
      const m = init.match(/process\.env\.([A-Z0-9_]+)/);
      if (m) envNames.set(vd.getName(), m[1]!);
    }
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression();
      const text = callee.getText();
      let method: string | null = null;
      if (text === 'fetch') {
        const init = call.getArguments()[1];
        const m = init && Node.isObjectLiteralExpression(init) ? init.getProperty('method') : undefined;
        const lit = m && Node.isPropertyAssignment(m) ? m.getInitializer()?.getText().replace(/['"`]/g, '') : undefined;
        method = (lit ?? 'GET').toUpperCase();
      } else if (Node.isPropertyAccessExpression(callee) && /^(axios|ky|got|http|api|client)$/i.test(callee.getExpression().getText()) && HTTP.has(callee.getName())) {
        method = callee.getName().toUpperCase();
      } else if (text === 'axios' || text === 'got' || text === 'ky') method = 'GET';
      if (!method) continue;

      const urlArg = call.getArguments()[0];
      const resolved = urlArg ? resolveUrl(urlArg, envNames, config) : null;
      const fnName = enclosingFunctionName(call);
      const file = rel(sf.getFilePath());
      const line = call.getStartLineNumber();
      const cs: CallSite = {
        id: `${opts.repo}:${file}:${line}`, repo: opts.repo, file, line, method,
        service: resolved?.service ?? 'unknown', endpoint: resolved?.endpoint ?? '(unresolved)', ...(fnName ? { fnName } : {}),
        ...(resolved ? {} : { unresolved: true }),
      };
      callSites.push(cs);
      traceResponse(cs, call);
    }
  }

  /** From the fetch/axios call find the variable(s) that hold the parsed body. */
  function traceResponse(cs: CallSite, call: CallExpression) {
    const visited = new Set<Node>();
    const isAxiosLike = !call.getExpression().getText().startsWith('fetch');
    let expr: Node = call;
    const up = () => expr.getParent();
    // climb through await, parentheses and pass-through wrappers: withAliasesResponse(await axios.get(...), 'GET /x')
    for (;;) {
      const p = up();
      if (p && (Node.isAwaitExpression(p) || Node.isParenthesizedExpression(p))) { expr = p; continue; }
      if (p && Node.isCallExpression(p) && p.getArguments()[0] === expr && passThrough.has(p.getExpression().getText().split('.').pop()!)) { expr = p; continue; }
      break;
    }
    const parent = up();
    if (!parent) return;

    const bodyFrom = (resp: Node) => {
      // resp is the Response (fetch) or AxiosResponse. Find `.json()` / `.data`.
      const ctx = resp.getParent();
      if (ctx && Node.isPropertyAccessExpression(ctx) && ctx.getExpression() === resp) {
        const name = ctx.getName();
        let target: Node = ctx;
        if (name === 'json' || name === 'text') {
          const c = ctx.getParent();
          if (c && Node.isCallExpression(c)) { target = c; while (target.getParent() && Node.isAwaitExpression(target.getParent()!)) target = target.getParent()!; }
        } else if (name !== 'data') return;
        readFrom(cs, target, '', 0, visited);
      }
    };

    if (Node.isVariableDeclaration(parent)) {
      const nameNode = parent.getNameNode();
      if (Node.isObjectBindingPattern(nameNode)) {
        // const { data } = await axios.get(...)  or  const { data: { user } } = ...
        for (const el of nameNode.getElements()) {
          if (isAxiosLike && el.getName() === 'data' && !el.getPropertyNameNode()) {
            const n = el.getNameNode();
            if (Node.isIdentifier(n)) track(cs, n, '', 0, visited);
          } else if (isAxiosLike && (el.getPropertyNameNode()?.getText() === 'data')) {
            const n = el.getNameNode();
            if (Node.isObjectBindingPattern(n)) destructure(cs, n, '', 0, visited);
            else if (Node.isIdentifier(n)) track(cs, n, '', 0, visited);
          }
        }
      } else if (Node.isIdentifier(nameNode)) {
        for (const ref of nameNode.findReferencesAsNodes()) if (ref !== nameNode) bodyFrom(ref);
      }
    } else if (Node.isReturnStatement(parent)) {
      // return fetch(...)  : caller handles .json()
      const fn = parent.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a));
      followCallers(cs, fn, '', 1, visited);
    } else if (Node.isPropertyAccessExpression(parent)) {
      bodyFrom(expr);
    }
    // `return res.json()`: bodyFrom -> readFrom handles ReturnStatement
  }

  // ---- workflows ----
  const workflows = loadWorkflows(dir, callSites);
  return { repo: opts.repo, commit: opts.commit, scannedAt: new Date().toISOString(), callSites, fieldReads, workflows };
}

function classify(node: Node): Usage {
  let n: Node = node;
  for (let i = 0; i < 6; i++) {
    const p = n.getParent();
    if (!p) break;
    if (Node.isJsxExpression(p) || Node.isTemplateSpan(p) || Node.isJsxElement(p)) return 'display';
    if (Node.isBinaryExpression(p)) {
      const op = p.getOperatorToken().getText();
      if (['===', '==', '!==', '!=', '<', '>', '<=', '>=', '&&', '||', '??'].includes(op)) return op === '&&' || op === '||' || op === '??' ? 'branching' : 'branching';
      if (['+', '-', '*', '/', '%', '+=', '-=', '*=', '/='].includes(op)) return 'arithmetic';
    }
    if (Node.isIfStatement(p) || Node.isSwitchStatement(p) || Node.isCaseClause(p)) return 'branching';
    if (Node.isConditionalExpression(p) && p.getCondition() === n) return 'branching';
    if (Node.isPrefixUnaryExpression(p)) return p.getOperatorToken() === SyntaxKind.ExclamationToken ? 'branching' : 'arithmetic';
    if (Node.isCallExpression(p) && p.getArguments().includes(n as never)) {
      const t = p.getExpression().getText();
      if (/^(Number|parseFloat|parseInt|Math\.\w+)$/.test(t)) return 'arithmetic';
      if (/(^|\.)(post|put|patch)$|^fetch$/.test(t)) return 'outbound';
      if (DB_CALL.test(t)) return 'persistence';
      return 'read';
    }
    if (Node.isPropertyAssignment(p) || Node.isObjectLiteralExpression(p) || Node.isShorthandPropertyAssignment(p)) {
      const call = p.getFirstAncestorByKind(SyntaxKind.CallExpression);
      if (call) {
        const t = call.getExpression().getText();
        if (DB_CALL.test(t)) return 'persistence';
        if (/(^|\.)(post|put|patch)$|^fetch$/.test(t)) return 'outbound';
      }
    }
    if (Node.isPropertyAccessExpression(p) && p.getExpression() === n && /^(toFixed|toLocaleString)$/.test(p.getName())) return 'display';
    if (Node.isStatement(p)) break;
    n = p;
  }
  return 'read';
}

function enclosingFunctionName(node: Node): string | undefined {
  const fn = node.getFirstAncestor((a) => Node.isFunctionDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a) || Node.isMethodDeclaration(a));
  if (!fn) return undefined;
  if (Node.isFunctionDeclaration(fn) || Node.isMethodDeclaration(fn)) return fn.getName();
  const p = fn.getParent();
  return p && Node.isVariableDeclaration(p) ? p.getName() : undefined;
}

/** Resolve `${ENV}/users/${id}` / 'https://users.api.x/users/1' to {service, endpoint template}. */
function resolveUrl(arg: Node, envNames: Map<string, string>, config: Config): { service: string; endpoint: string } | null {
  let parts: { lit?: string; env?: string; param?: boolean }[] = [];
  const walk = (n: Node): boolean => {
    if (Node.isStringLiteral(n) || Node.isNoSubstitutionTemplateLiteral(n)) { parts.push({ lit: n.getLiteralText() }); return true; }
    if (Node.isTemplateExpression(n)) {
      parts.push({ lit: n.getHead().getLiteralText() });
      for (const span of n.getTemplateSpans()) {
        const e = span.getExpression();
        const envName = envOf(e, envNames);
        parts.push(envName ? { env: envName } : { param: true });
        parts.push({ lit: span.getLiteral().getLiteralText() });
      }
      return true;
    }
    if (Node.isBinaryExpression(n) && n.getOperatorToken().getText() === '+') return walk(n.getLeft()) && walk(n.getRight());
    const envName = envOf(n, envNames);
    if (envName) { parts.push({ env: envName }); return true; }
    if (Node.isIdentifier(n)) {
      const init = n.getSymbol()?.getDeclarations()[0];
      if (init && Node.isVariableDeclaration(init) && init.getInitializer()) return walk(init.getInitializer()!);
    }
    return false;
  };
  if (!walk(arg)) return null;
  parts = parts.filter((p) => p.lit !== '' || p.env || p.param);

  let service: string | undefined;
  let path = '';
  for (const p of parts) {
    if (p.env) service = config.services?.[p.env] ?? p.env.replace(/_(API_)?(BASE_)?(URL|HOST|ENDPOINT)$/, '').toLowerCase();
    else if (p.param) path += '{id}'; // same template syntax as the SDK so graph, status and drift share node ids
    else path += p.lit;
  }
  const url = path.match(/^https?:\/\/([^/]+)(\/.*)?$/);
  if (url) {
    const host = url[1]!;
    path = url[2] ?? '/';
    service ??= host.startsWith('localhost') || /^\d/.test(host) ? path.split('/')[1] : host.split('.')[0];
  }
  if (!service) return null;
  path = path.split('?')[0]!.replace(/\/\d+(?=\/|$)/g, '/{id}');
  if (!path.startsWith('/')) path = '/' + path;
  return { service, endpoint: path || '/' };
}

function envOf(n: Node, envNames: Map<string, string>): string | undefined {
  const t = n.getText();
  const m = t.match(/^process\.env\.([A-Z0-9_]+)$/) ?? t.match(/^process\.env\[['"]([A-Z0-9_]+)['"]\]$/);
  if (m) return m[1];
  return Node.isIdentifier(n) ? envNames.get(t) : undefined;
}

function globToRegex(g: string) {
  const re = g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '@@').replace(/\*/g, '[^/]*').replace(/@@/g, '.*');
  return new RegExp('^' + re + '$');
}

function loadWorkflows(dir: string, callSites: CallSite[]): CodeMap['workflows'] {
  const p = join(dir, 'seismo.workflows.yml');
  let defs: Record<string, string[]> = {};
  if (existsSync(p)) defs = (yaml.load(readFileSync(p, 'utf8')) as Record<string, string[]>) ?? {};
  else {
    // Default: Next.js route folders app/<name>/** and pages/<name>
    const names = new Set<string>();
    for (const cs of callSites) {
      const m = cs.file.match(/^(?:src\/)?(?:app|pages)\/([^/.]+)/);
      if (m) names.add(m[1]!);
    }
    for (const n of names) defs[n] = [`app/${n}/**`, `src/app/${n}/**`, `pages/${n}/**`];
  }
  return Object.entries(defs).map(([name, globs]) => {
    const res = globs.map(globToRegex);
    const files = callSites.filter((c) => res.some((r) => r.test(c.file)));
    return { id: name, name, file: globs[0] ?? '', globs, functions: [...new Set(files.map((c) => c.fnName).filter((x): x is string => !!x))] };
  });
}

export { globToRegex };

/**
 * v3-P0.4: in production, refuse to start with missing or well-known default secrets. Internal routes, demo controls and
 * sessions are reachable from the internet once deployed; a default token there would be an open door.
 */
const DEFAULTS: Record<string, string[]> = {
  INTERNAL_TOKEN: ['', 'dev-internal'],
  DEMO_ADMIN_TOKEN: ['', 'dev-admin'],
  AUTH_SECRET: [''],
};

export function productionProblems(env: NodeJS.ProcessEnv = process.env, names = Object.keys(DEFAULTS)): string[] {
  if (env.NODE_ENV !== 'production') return [];
  return names.filter((n) => DEFAULTS[n]!.includes(env[n] ?? '') || (env[n] ?? '').length < 16).map((n) => `${n} must be set to a random secret of at least 16 characters`);
}

export function guardProduction(names?: string[]) {
  const problems = productionProblems(process.env, names);
  if (!problems.length) return;
  console.error(`Refusing to start in production:\n - ${problems.join('\n - ')}`);
  process.exit(1);
}

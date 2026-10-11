// Seismo rules (data, not code). Fix PRs from Seismo only ever edit seismo/aliases.json.
import { applyAliases, applyTransforms, type AliasRule } from '@seismo/sdk/runtime';
import file from '../../seismo/aliases.json';

const rules = (file as { rules: AliasRule[] }).rules;

/**
 * Alias rules add a renamed field back under its old name (never change or remove anything); scale rules, which a human
 * must have reviewed and merged, convert a unit. With no rules this returns the exact object it received.
 */
export const withAliases = <T>(body: T, endpoint: string): T => applyTransforms(applyAliases(body, rules, endpoint), rules, endpoint);

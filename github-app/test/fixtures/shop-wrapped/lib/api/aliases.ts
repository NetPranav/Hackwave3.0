// Seismo alias rules (data, not code). A fix PR from Seismo only ever edits seismo/aliases.json.
import { applyAliases, type AliasRule } from '@seismo/sdk/runtime';
import file from '../../seismo/aliases.json';

const rules = (file as { rules: AliasRule[] }).rules;

/** Adds a renamed field back under its old name when the old one is missing. Never changes or removes anything. */
export const withAliases = <T>(body: T, endpoint: string): T => applyAliases(body, rules, endpoint);

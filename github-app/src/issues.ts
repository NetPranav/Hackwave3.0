/** One GitHub issue per drift event (P4.6), found again by a hidden marker and updated on every state change. */
export interface OctokitIssues {
  rest: {
    issues: {
      listForRepo: (p: Record<string, unknown>) => Promise<{ data: { number: number; body?: string | null; html_url: string; pull_request?: unknown }[] }>;
      create: (p: Record<string, unknown>) => Promise<{ data: { number: number; html_url: string } }>;
      update: (p: Record<string, unknown>) => Promise<{ data: { number: number; html_url: string } }>;
    };
  };
}

export interface IssueInput { owner: string; repo: string; eventId: string; title: string; body: string; severity: string; state: string }

export const marker = (eventId: string) => `<!-- seismo:${eventId} -->`;

export async function upsertIssue(o: OctokitIssues, i: IssueInput): Promise<{ url: string; number: number; created: boolean }> {
  const body = i.body.includes(marker(i.eventId)) ? i.body : `${marker(i.eventId)}\n${i.body}`;
  const closed = i.state === 'resolved' || i.state === 'expected';
  const existing = (await o.rest.issues.listForRepo({ owner: i.owner, repo: i.repo, labels: 'seismo', state: 'all', per_page: 100 })).data
    .find((x) => !x.pull_request && (x.body ?? '').includes(marker(i.eventId)));
  if (existing) {
    const r = await o.rest.issues.update({ owner: i.owner, repo: i.repo, issue_number: existing.number, title: i.title, body, state: closed ? 'closed' : 'open' });
    return { url: r.data.html_url, number: r.data.number, created: false };
  }
  if (closed) return { url: '', number: 0, created: false };          // nothing to close
  const r = await o.rest.issues.create({ owner: i.owner, repo: i.repo, title: i.title, body, labels: ['seismo', `severity:${i.severity}`] });
  return { url: r.data.html_url, number: r.data.number, created: true };
}

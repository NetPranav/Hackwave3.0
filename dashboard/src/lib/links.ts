// Links to GitHub come from the engine's data (the PR URL it opened, the repo it scanned). Mock mode has no engine,
// so its sample PR numbers point at the sample repo.
const MOCK_REPO = "https://github.com/NetPranav/seismo-demo-shop";

export const prHref = (number?: number, url?: string) => url ?? (number ? `${MOCK_REPO}/pull/${number}` : undefined);

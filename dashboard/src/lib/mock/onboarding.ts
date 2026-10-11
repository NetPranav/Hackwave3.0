// Mock first-run data, shaped like the installation + coverage contracts (P2). Replace with /v1/installations and /v1/coverage later.

export const INSTALLATION = {
  id: "inst_demo",
  account: "NetPranav",
  repos: ["seismo-demo-shop"],
  settingsUrl: "https://github.com/settings/installations",
};

/** What the scan finds. The last figure is shown honestly: some calls cannot be followed automatically. */
export const SCAN_RESULT = {
  files: 142,
  apiCalls: 186,
  fieldsMapped: 412,
  unresolvedCalls: 3,
  services: 6,
};

export const SDK_KEY_MASKED = "sk_live_••••••••••••9f3a";
export const SDK_KEY_DEMO = "sk_live_demo_9f3a";

export const SETUP_PR = {
  number: 7,
  url: "https://github.com/NetPranav/seismo-demo-shop/pull/7",
  title: "Add Seismo setup (aliases.json, one config file)",
};

export const FIRST_TRAFFIC = { calls: 12, source: "seismo-demo-shop" };

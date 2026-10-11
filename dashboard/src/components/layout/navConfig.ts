export type NavTone = "accent" | "warn" | "ok" | "muted";

export interface NavItem {
  title: string;
  desc: string;
  href: string;
  /** Small status text on the right of the title. */
  tag?: { label: string; tone: NavTone };
  external?: boolean;
  /** True when the current path belongs to this item. */
  isActive?: (pathname: string) => boolean;
}

export interface NavGroup {
  heading: string;
  items: NavItem[];
}

export interface NavMenuDef {
  value: string;
  label: string;
  /** Pulsing accent dot on the trigger: something here needs attention. */
  attention?: boolean;
  groups: NavGroup[];
}

const starts = (prefix: string) => (pathname: string) => pathname.startsWith(prefix);

/** The story of the product, left to right: watch it, see what changed, fix it, set it up. */
export const NAV_MENUS: NavMenuDef[] = [
  {
    value: "monitor",
    label: "MONITOR",
    groups: [
      {
        heading: "Health",
        items: [
          {
            title: "Overview",
            desc: "Traffic, speed and the state of every API.",
            href: "/app",
            isActive: (p) => p === "/app",
          },
          {
            title: "API Status",
            desc: "Is each API healthy, and what changed in its data?",
            href: "/app/status",
            isActive: starts("/app/status"),
          },
          {
            title: "Dependency Graph",
            desc: "What you depend on, and what breaks if it changes.",
            href: "/app/graph",
            tag: { label: "NEW", tone: "accent" },
            isActive: starts("/app/graph"),
          },
        ],
      },
    ],
  },
  {
    value: "changes",
    label: "CHANGES",
    attention: true,
    groups: [
      {
        heading: "What changed",
        items: [
          {
            title: "Timeline",
            desc: "Every detected change and deploy, when it happened.",
            href: "/app/timeline",
            isActive: starts("/app/timeline"),
          },
          {
            title: "Change Details",
            desc: "One change in depth: evidence, impact and the fix.",
            href: "/app/drift/drf_users_name_rename",
            tag: { label: "LATEST", tone: "accent" },
            isActive: starts("/app/drift"),
          },
        ],
      },
      {
        heading: "Explore",
        items: [
          {
            title: "Compare & Simulate",
            desc: "Before vs now, or ask what a change would affect.",
            href: "/app/compare",
            isActive: starts("/app/compare"),
          },
        ],
      },
    ],
  },
  {
    value: "fixes",
    label: "FIXES",
    groups: [
      {
        heading: "Automatic",
        items: [
          {
            title: "Safe Fixes",
            desc: "Safe fixes and the pull requests that carry them.",
            href: "/app/fixes",
            isActive: starts("/app/fixes"),
          },
        ],
      },
      {
        heading: "Needs a person",
        items: [
          {
            title: "Review Queue",
            desc: "Changes that touch money, logic or saved data.",
            href: "/app/review",
            tag: { label: "NEEDS YOU", tone: "warn" },
            isActive: starts("/app/review"),
          },
        ],
      },
    ],
  },
  {
    value: "setup",
    label: "SETUP",
    groups: [
      {
        heading: "Alerts",
        items: [
          {
            title: "Notification Settings",
            desc: "Where alerts go, how serious a change must be, and test messages.",
            href: "/app/settings",
            isActive: starts("/app/settings"),
          },
        ],
      },
      {
        heading: "Developers",
        items: [
          {
            title: "Install Guide",
            desc: "The small add-on that watches your API calls. It never blocks your app.",
            href: "https://github.com/NetPranav/Hackwave3.0",
            tag: { label: "GITHUB ↗", tone: "muted" },
            external: true,
          },
          {
            title: "Demo Shop",
            desc: "The sample shop where the demo changes happen.",
            href: "https://github.com/NetPranav/seismo-demo-shop",
            tag: { label: "GITHUB ↗", tone: "muted" },
            external: true,
          },
        ],
      },
    ],
  },
];

/** Label for the breadcrumb next to the logo. */
export const BREADCRUMBS: { match: (pathname: string) => boolean; label: string }[] = [
  { match: (p) => p === "/app", label: "OVERVIEW" },
  { match: starts("/app/status"), label: "API STATUS" },
  { match: starts("/app/timeline"), label: "TIMELINE" },
  { match: starts("/app/drift"), label: "CHANGE DETAILS" },
  { match: starts("/app/graph"), label: "GRAPH" },
  { match: starts("/app/compare"), label: "COMPARE & SIMULATE" },
  { match: starts("/app/fixes"), label: "SAFE FIXES" },
  { match: starts("/app/review"), label: "REVIEW QUEUE" },
  { match: starts("/app/settings"), label: "NOTIFICATION SETTINGS" },
];

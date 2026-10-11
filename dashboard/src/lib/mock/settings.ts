// Mock notification settings, shaped like GET/PUT /v1/settings/notifications (P6.13). Replace with the real API later.

export type Threshold = "all" | "suspected" | "breaking";
export type ChannelId = "dashboard" | "github" | "whatsapp" | "chat" | "email";
export type ChatProvider = "slack" | "discord";

export const THRESHOLD_LABEL: Record<Threshold, string> = {
  all: "All changes",
  suspected: "Suspected and breaking",
  breaking: "Breaking only",
};

export interface ChannelConfig {
  enabled: boolean;
  threshold: Threshold;
  /** whatsapp: phone number · chat: webhook URL · email: address · github: repository */
  value: string;
  chatProvider?: ChatProvider;
}

export type ChannelsState = Record<ChannelId, ChannelConfig>;

export interface ChannelMeta {
  id: ChannelId;
  name: string;
  blurb: string;
  /** Label of the main field, or null when there is nothing to configure. */
  fieldLabel: string | null;
  placeholder: string;
  secret: boolean;
  /** Dashboard cannot be switched off: it is where everything is always visible. */
  locked: boolean;
}

export const CHANNELS: ChannelMeta[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    blurb: "The bell and the timeline. Always on, so nothing is ever missed.",
    fieldLabel: null,
    placeholder: "",
    secret: false,
    locked: true,
  },
  {
    id: "github",
    name: "GitHub",
    blurb: "An issue and a check on the repository where the change touches your code.",
    fieldLabel: "Repository",
    placeholder: "owner/repository",
    secret: false,
    locked: false,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    blurb: "A short message for the changes that cannot wait. Uses the Twilio sandbox for now.",
    fieldLabel: "Your number",
    placeholder: "+91 98765 43210",
    secret: false,
    locked: false,
  },
  {
    id: "chat",
    name: "Slack / Discord",
    blurb: "A message in your team channel through an incoming webhook.",
    fieldLabel: "Webhook URL",
    placeholder: "https://hooks.example.com/...",
    secret: true,
    locked: false,
  },
  {
    id: "email",
    name: "Email",
    blurb: "A fuller write-up with the explanation and the suggested change.",
    fieldLabel: "Address",
    placeholder: "you@company.com",
    secret: false,
    locked: false,
  },
];

export const DEFAULT_CHANNELS: ChannelsState = {
  dashboard: { enabled: true, threshold: "all", value: "" },
  github: { enabled: true, threshold: "suspected", value: "NetPranav/seismo-demo-shop" },
  whatsapp: { enabled: true, threshold: "breaking", value: "" },
  chat: { enabled: false, threshold: "suspected", value: "", chatProvider: "slack" },
  email: { enabled: false, threshold: "suspected", value: "" },
};

/** Text comes from the API in production (P6.13); the sandbox code is account specific, so it is a placeholder here. */
export const WHATSAPP_SANDBOX_STEPS = [
  "Open WhatsApp and send the message join <your-sandbox-code> to the Twilio sandbox number shown in your Twilio console.",
  "Wait for the confirmation reply, then send the test below.",
  "Sandbox access can lapse after a few days, so join again before a demo.",
];

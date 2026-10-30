import { NotificationSettings } from '@seismo/contracts';
import { eq } from 'drizzle-orm';
import { connect } from './db/index.js';
import { settings } from './db/schema.js';

export const DEFAULT_SETTINGS: NotificationSettings = {
  // channels are on by default when their provider is configured; they still only send once a number/address is set
  whatsapp: { enabled: !!(process.env.TWILIO_TO || process.env.TWILIO_ACCOUNT_SID), ...(process.env.TWILIO_TO ? { to: process.env.TWILIO_TO } : {}), minSeverity: 'breaking' },
  slack: { enabled: !!process.env.SLACK_WEBHOOK_URL, ...(process.env.SLACK_WEBHOOK_URL ? { webhookUrl: process.env.SLACK_WEBHOOK_URL } : {}) },
  discord: { enabled: !!process.env.DISCORD_WEBHOOK_URL, ...(process.env.DISCORD_WEBHOOK_URL ? { webhookUrl: process.env.DISCORD_WEBHOOK_URL } : {}) },
  email: { enabled: !!(process.env.ALERT_EMAIL_TO || process.env.RESEND_API_KEY || process.env.SMTP_HOST), ...(process.env.ALERT_EMAIL_TO ? { to: process.env.ALERT_EMAIL_TO } : {}) },
  github: { enabled: true, minSeverity: 'breaking' },
  minSeverity: 'warning',
  aiEnabled: true,
  autoHeal: false,
};

/** Notification settings per project (P6.13). Postgres when DATABASE_URL is set, memory otherwise. */
export interface SettingsStore { get(): Promise<NotificationSettings>; put(s: NotificationSettings): Promise<NotificationSettings> }

export function memorySettings(initial: NotificationSettings = DEFAULT_SETTINGS): SettingsStore {
  let cur = structuredClone(initial);
  return { get: async () => cur, put: async (s) => (cur = NotificationSettings.parse(s)) };
}

export function pgSettings(projectId = process.env.SEISMO_PROJECT ?? 'dev', url = process.env.DATABASE_URL): SettingsStore {
  const { db } = connect(url);
  return {
    async get() {
      const row = (await db.select().from(settings).where(eq(settings.projectId, projectId)))[0];
      const parsed = row ? NotificationSettings.safeParse(row.notifications) : undefined;
      return parsed?.success ? parsed.data : DEFAULT_SETTINGS;
    },
    async put(s) {
      const v = NotificationSettings.parse(s);
      await db.insert(settings).values({ projectId, notifications: v }).onConflictDoUpdate({ target: settings.projectId, set: { notifications: v } });
      return v;
    },
  };
}

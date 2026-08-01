import webpush from "web-push";
import { isSupabaseConfigured, requireServerConfig } from "@/lib/config";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

function configureWebPush() {
  if (!configured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return true;
}

async function supabase<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = requireServerConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase push request failed (${response.status}): ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function savePushSubscription(subscription: PushSubscriptionJSON, userAgent?: string) {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;
  if (!subscription.endpoint || !p256dh || !auth) throw new Error("Incomplete push subscription.");

  await supabase<PushSubscriptionRow[]>("push_subscriptions?on_conflict=endpoint", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ endpoint: subscription.endpoint, p256dh, auth, user_agent: userAgent ?? null, updated_at: new Date().toISOString() }),
  });
}

export async function removePushSubscription(endpoint: string) {
  if (!isSupabaseConfigured) return;
  await supabase<unknown>(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE" });
}

export async function sendStrikePush(input: { incidentId: string; incidentAt: string; title: string; truckType?: string | null }) {
  if (!isSupabaseConfigured || !configureWebPush()) return { sent: 0, failed: 0, disabled: true };

  const subscriptions = await supabase<PushSubscriptionRow[]>("push_subscriptions?select=id,endpoint,p256dh,auth");
  const localTime = new Date(input.incidentAt).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const payload = JSON.stringify({
    title: "🚚 Peace Street Bridge strike",
    body: `${input.truckType ? `${input.truckType} · ` : ""}${localTime}`,
    url: `/?incident=${encodeURIComponent(input.incidentId)}`,
    tag: `bridge-strike-${input.incidentId}`,
  });

  let sent = 0;
  let failed = 0;
  for (const row of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 60 * 60 * 12 });
      sent += 1;
    } catch (error) {
      failed += 1;
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        await removePushSubscription(row.endpoint).catch(() => undefined);
      }
    }
  }
  return { sent, failed, disabled: false };
}

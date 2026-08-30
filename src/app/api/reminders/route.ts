import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!url || !serviceRole || !publicKey || !privateKey || !subject) {
    return NextResponse.json({ error: "missing server configuration" }, { status: 500 });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60_000);

  const { data: events, error } = await supabase
    .from("events")
    .select("id,user_id,title,starts_at,reminder_minutes")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", new Date(now.getTime() + 10080 * 60_000).toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const event of events ?? []) {
    const remindAt = new Date(new Date(event.starts_at).getTime() - event.reminder_minutes * 60_000);
    if (remindAt < now || remindAt >= windowEnd) continue;

    const { data: existing } = await supabase
      .from("reminder_deliveries")
      .select("sent_at")
      .eq("event_id", event.id)
      .eq("remind_at", remindAt.toISOString())
      .maybeSingle();
    if (existing?.sent_at) continue;

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("user_id", event.user_id);

    for (const sub of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: event.title, body: `${event.reminder_minutes}분 후 일정이 시작됩니다.`, url: "/" })
        );
        sent += 1;
      } catch {
        // Stale subscriptions can be cleaned in a later maintenance pass.
      }
    }

    await supabase.from("reminder_deliveries").upsert({
      event_id: event.id,
      user_id: event.user_id,
      remind_at: remindAt.toISOString(),
      sent_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ sent });
}

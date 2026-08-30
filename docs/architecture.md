# Architecture

## Runtime
- UI: Next.js App Router + React + TypeScript
- Offline/local fallback: browser localStorage
- Installability: Web App Manifest + Service Worker
- Notification receiving: Service Worker `push` event

## Target production topology

```text
Android / PC PWA
      │
      ├─ Next.js UI
      │
      ├─ Supabase Auth
      │      └─ users
      ├─ Supabase Postgres
      │      ├─ events
      │      ├─ reminders
      │      └─ push_subscriptions
      │
      └─ Web Push
             ▲
      scheduled server job
```

## External configuration boundary
Supabase project URL/keys and VAPID key pair are deployment secrets. They must be injected through environment variables and never committed.

## Data model direction
`events`: owner, title, starts_at, notes
`reminders`: event_id, remind_at, sent_at
`push_subscriptions`: owner, endpoint, p256dh, auth

## Reliability
Browser `setTimeout` is only a local convenience while the page is alive. Reliable background reminders require persisted reminders plus a server-side scheduler that calls Web Push.

# Architecture

## Runtime
- UI: Next.js App Router + React + TypeScript
- Offline/local fallback: browser localStorage
- Natural-language parsing: client-side deterministic Korean parser
- Installability: Web App Manifest + Service Worker
- Notification receiving: Service Worker `push` event

## Target production topology

```text
Android / PC PWA
      │
      ├─ Next.js UI
      │      └─ 자연어 입력 → 규칙 파싱 → 미리보기 → 저장
      ├─ Supabase Auth
      │      └─ email + password users
      ├─ Supabase Postgres
      │      ├─ events/tasks
      │      ├─ reminder_deliveries
      │      └─ push_subscriptions
      │
      └─ Web Push
             ▲
      scheduled server job
```

## Natural language boundary
기본 자연어 입력은 외부 LLM API를 호출하지 않는다. `src/lib/natural-schedule.ts`가 한국어 날짜/시간, 마감/시험/발표/면접 키워드, 메모와 알림 표현을 결정적으로 파싱한다. 파싱 결과는 즉시 저장하지 않고 사용자가 미리보기에서 수정한 뒤 저장한다. 향후 LLM은 규칙 파서가 실패한 문장에 대한 선택적 fallback으로만 고려한다.

## External configuration boundary
Supabase project URL/keys and VAPID key pair are deployment secrets. They must be injected through environment variables and never committed.

## Data model
`events`: owner, title, starts_at, notes, reminder_minutes, category, completed
`reminder_deliveries`: event_id, remind_at, sent_at
`push_subscriptions`: owner, endpoint, p256dh, auth

`events`를 UI에서는 Task로 취급하며, `category`는 `deadline | exam | result | interview | general`, `completed`는 완료 여부를 나타낸다.

## Reliability
Browser timer는 알림 전달 근거로 사용하지 않는다. 안정적인 백그라운드 reminder는 DB의 event와 서버-side scheduler가 Web Push를 호출하는 구조로 유지한다.

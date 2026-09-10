# Architecture

## Runtime
- UI: Next.js App Router + React + TypeScript
- Offline/local fallback: browser localStorage
- Natural-language parsing: client-side deterministic Korean parser
- Installability: Web App Manifest + Service Worker
- iOS installability: Safari Home Screen Web App metadata + Apple touch icon + safe-area
- Notification receiving: Service Worker `push` event

## Target production topology

```text
PC / Android PWA / iPhone Safari Home Screen PWA
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

## Platform behavior
- PC/Android: 브라우저에서 직접 사용하거나 PWA로 설치한다.
- iPhone/iPad: Safari에서 `홈 화면에 추가` 후 standalone web app으로 실행한다.
- iOS Safari 탭에서는 설치 안내를 제공하고, standalone으로 실행된 경우 안내를 숨긴다.
- iOS의 노치/홈 인디케이터 영역은 CSS `env(safe-area-inset-*)`로 대응한다.
- Push 권한/구독은 사용자 액션으로 등록하며, 서버 reminder 구조는 플랫폼과 무관하게 동일하다.

## Event range model
- `events.starts_at`: 단일 일정의 시각 또는 기간 일정의 시작 시각.
- `events.ends_at`: 선택적 종료 시각. `null`이면 단일 일정이다.
- DB constraint로 `ends_at >= starts_at`을 보장한다.
- 월간 캘린더의 날짜 포함 여부는 `startOfDay(starts_at) <= day <= startOfDay(coalesce(ends_at, starts_at))`로 판단한다.
- 기간 일정은 각 날짜 셀에서 동일 event id를 사용해 연속 바로 렌더링한다.
- Task 정렬, D-day, reminder 대상 시각은 `coalesce(ends_at, starts_at)`을 사용한다. 즉 기간 일정은 종료 시각 기준으로 관리한다.
- 구독 캘린더 RPC도 `starts_at < range_end AND coalesce(ends_at, starts_at) >= range_start` 조건으로 기간이 조회 범위와 겹치면 반환한다.

## Contextual quick add
날짜 Bottom Sheet에서 빠른추가로 이동할 때 선택 날짜를 client state로 전달한다. 자연어 문장에 명시적 날짜가 없으면 해당 날짜를 기본 날짜로 사용하고, 명시적 날짜가 있으면 사용자가 입력한 날짜가 우선한다. 일반 하단 탭의 빠른추가는 날짜 컨텍스트 없이 기존 방식으로 동작한다.

## Natural language boundary
기본 자연어 입력은 외부 LLM API를 호출하지 않는다. `src/lib/natural-schedule.ts`가 한국어 날짜/시간, 기간 표현, 마감/시험/발표/면접 키워드, 메모와 알림 표현을 결정적으로 파싱한다. 파싱 결과는 즉시 저장하지 않고 사용자가 미리보기에서 수정한 뒤 저장한다. 향후 LLM은 규칙 파서가 실패한 문장에 대한 선택적 fallback으로만 고려한다.

## External configuration boundary
Supabase project URL/keys and VAPID key pair are deployment secrets. They must be injected through environment variables and never committed.

## Data model
`events`: owner, title, starts_at, ends_at(optional), notes, reminder_minutes, category, completed
`reminder_deliveries`: event_id, remind_at, sent_at
`push_subscriptions`: owner, endpoint, p256dh, auth

`events`를 UI에서는 Task로 취급하며, `category`는 `deadline | exam | result | interview | general`, `completed`는 완료 여부를 나타낸다.

## Reliability
Browser timer는 알림 전달 근거로 사용하지 않는다. 안정적인 백그라운드 reminder는 DB의 event와 서버-side scheduler가 Web Push를 호출하는 구조로 유지한다. 기간 일정도 서버에서 종료 시각을 기준으로 reminder를 계산한다.

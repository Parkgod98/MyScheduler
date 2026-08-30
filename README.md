# MyScheduler

PC와 Android에서 함께 쓰는 개인 일정 관리 PWA입니다.

## 현재 구현
- 월간 달력과 날짜별 일정 조회
- 일정 등록/삭제, 메모, 사전 알림 시간
- 헤더의 다음 일정 표시
- 모바일/데스크톱 반응형 UI
- PWA manifest + Service Worker
- 환경 설정 전 localStorage 기반 로컬 모드
- Supabase Magic Link 로그인과 사용자별 일정 동기화
- Push Subscription 저장
- 서버 예약 알림 발송 API(`/api/reminders`)
- RLS가 적용된 Supabase SQL 스키마
- AGENTS/docs/validator/CI 기반 Harness Engineering

## 로컬 실행
```bash
npm install
npm run dev
```

Supabase 없이도 로컬 일정 관리 기능은 동작합니다.

## PC ↔ Android 동기화 설정
1. Supabase 프로젝트를 생성합니다.
2. `supabase/schema.sql`을 SQL Editor에서 실행합니다.
3. `.env.example`을 참고해 환경 변수를 설정합니다.
4. 앱에서 같은 이메일로 로그인하면 일정이 계정 기준으로 동기화됩니다.

## Web Push 설정
VAPID 키를 생성하고 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`를 배포 환경에 등록합니다. Android Chrome에서 `알림 켜기`를 누르면 해당 기기의 Push subscription이 저장됩니다.

`POST /api/reminders`는 `Authorization: Bearer $CRON_SECRET` 헤더를 요구합니다. Vercel Cron 또는 다른 scheduler에서 1분 간격으로 호출하면 해당 분에 도래한 reminder를 조회해 등록된 기기로 Web Push를 전송합니다.

## 검증
```bash
npm run validate
npm run lint
npm run typecheck
npm run build
```

GitHub Actions에서도 동일한 순서로 검증합니다.

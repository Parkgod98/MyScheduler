# MyScheduler

PC와 Android에서 함께 쓰는 개인 일정·Task 관리 PWA입니다. 채용 마감, 시험, 발표, 면접처럼 여러 일정을 자연어로 한 번에 등록하고 관리하는 흐름을 중심으로 합니다.

## 현재 구현
- 월간 캘린더 + 전체 Task 목록
- 자연어 다건 등록: 날짜/시간/분류/알림/메모 해석 후 미리보기
- 마감/시험/발표/면접/일반 일정 자동 분류 및 색상 구분
- Task별 메모/준비물, 완료 처리, 삭제
- 이메일+비밀번호 로그인과 사용자별 일정 동기화
- 헤더의 다음 일정 표시
- 모바일/데스크톱 반응형 UI
- PWA manifest + Service Worker
- 환경 설정 전 localStorage 기반 로컬 모드
- Push Subscription 저장
- 서버 예약 알림 발송 API(`/api/reminders`)
- RLS가 적용된 Supabase SQL 스키마
- AGENTS/docs/validator/CI 기반 Harness Engineering

## 자연어 입력 예시
```text
넥토리얼 9월 7일 마감
우리은행 9월 8일 마감
토익스피킹 시험 9월 9일
현대모비스 9월 10일 마감
기업은행 9월 14일 마감
현대자동차 9월 14일 마감
KBS 필기 발표 9월 14일
KBS 필기 8월 30일 오전 8시 30분, 메모: 8시 30분 입실 · 컴싸 · 여권
```

외부 LLM API를 사용하지 않고 규칙 기반 한국어 파서를 사용하므로 별도 AI API 비용이 없습니다. 파싱 결과는 바로 저장하지 않고 미리보기에서 제목, 날짜/시간, 분류, 알림, 메모를 수정한 뒤 일괄 등록합니다.

## 로컬 실행
```bash
npm install
npm run dev
```

Supabase 없이도 로컬 일정 관리 기능은 동작합니다.

## Supabase 기존 프로젝트 업그레이드
초기 `schema.sql`을 이미 실행한 프로젝트라면 새 컬럼을 추가하기 위해 SQL Editor에서 다음 파일을 한 번 실행합니다.

```text
supabase/migrations/20260831_recruiting_tasks.sql
```

새 프로젝트는 최신 `supabase/schema.sql`만 실행하면 됩니다.

## 이메일+비밀번호 인증
Supabase Dashboard에서 Email provider를 활성화합니다. 개인/지인용으로 인증 메일 없이 바로 가입하려면 Authentication 설정의 `Confirm Email`을 끕니다.

앱에서 이메일과 6자 이상의 비밀번호를 입력한 뒤 `회원가입`을 누르면 계정을 만들고, 이후에는 같은 이메일/비밀번호로 로그인합니다. 지인 계정을 모두 만든 뒤 신규 가입을 막고 싶다면 Supabase의 신규 가입 허용 옵션을 끌 수 있습니다.

## PC ↔ Android 동기화 설정
1. Supabase 프로젝트를 생성합니다.
2. `supabase/schema.sql` 또는 위 migration을 SQL Editor에서 실행합니다.
3. `.env.example`을 참고해 환경 변수를 설정합니다.
4. 앱에서 같은 이메일/비밀번호 계정으로 로그인하면 일정이 계정 기준으로 동기화됩니다.

## Web Push 설정
VAPID 키를 생성하고 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`를 배포 환경에 등록합니다. Android Chrome과 PC 브라우저에서 `알림 켜기`를 한 번씩 누르면 각 기기의 Push subscription이 저장됩니다.

`POST /api/reminders`는 `Authorization: Bearer $CRON_SECRET` 헤더를 요구합니다. 1분 주기의 scheduler에서 호출하면 해당 분에 도래한 reminder를 조회해 등록된 기기로 Web Push를 전송합니다.

## 검증
```bash
npm run validate
npm run lint
npm run typecheck
npm run build
```

GitHub Actions에서도 동일한 순서로 검증합니다.

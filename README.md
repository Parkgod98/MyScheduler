# MyScheduler

PC와 Android에서 함께 쓰는 개인 일정·Task 관리 PWA입니다. 채용 마감, 시험, 발표, 면접처럼 여러 일정을 자연어로 한 번에 등록하고 관리하는 흐름을 중심으로 합니다.

## 현재 구현
- 월간 캘린더 + 전체 Task 목록
- 자연어 다건 등록: 날짜/시간/분류/알림/메모 해석 후 미리보기
- 마감/시험/발표/면접/일반 일정 자동 분류 및 색상 구분
- Task별 메모/준비물, 완료 처리, 삭제
- 이메일+비밀번호 로그인과 사용자별 일정 동기화
- 모바일 하단 네비게이션, 날짜 Bottom Sheet, D-day
- PWA manifest + Service Worker
- Push Subscription 저장 및 서버 예약 알림 API(`/api/reminders`)
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

외부 LLM API를 사용하지 않고 규칙 기반 한국어 파서를 사용하므로 별도 AI API 비용이 없습니다.

## 로컬 실행
```bash
npm install
npm run dev
```

## Supabase migration 운영
`supabase/migrations/`가 DB 스키마 변경의 단일 기준입니다. 새 DB 변경은 SQL Editor에서 직접 고치지 않고 migration 파일을 추가합니다.

`main`에 migration 변경이 merge되면 `.github/workflows/supabase-migrate.yml`이 Supabase CLI의 `db push`를 실행해 아직 적용되지 않은 migration만 Production DB에 적용합니다.

GitHub Repository → Settings → Secrets and variables → Actions에 다음 Repository secret을 한 번 등록해야 합니다.

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
SUPABASE_DB_PASSWORD
```

- `SUPABASE_ACCESS_TOKEN`: Supabase Account → Access Tokens에서 생성
- `SUPABASE_PROJECT_REF`: Project URL의 `https://<project-ref>.supabase.co` 부분
- `SUPABASE_DB_PASSWORD`: Supabase 프로젝트 생성 시 설정한 Database password

기존에 SQL Editor에서 수동 적용한 migration이 있는 프로젝트는 자동화 첫 실행 전에 migration history를 맞춰야 할 수 있습니다. 현재 초기 migration들은 재실행 안전하게 작성되어 있으므로 첫 `db push` 결과를 확인한 뒤 이후부터 자동화 흐름만 사용합니다.

## 이메일+비밀번호 인증
Supabase Dashboard에서 Email provider를 활성화합니다. 개인/지인용으로 인증 메일 없이 바로 가입하려면 Authentication 설정의 `Confirm Email`을 끕니다.

## PC ↔ Android 동기화
같은 계정으로 로그인하면 일정이 계정 기준으로 동기화됩니다.

## Web Push
VAPID 키를 배포 환경에 등록하고 Android/PC에서 각각 알림을 허용하면 각 기기의 Push subscription이 저장됩니다. `POST /api/reminders`는 `Authorization: Bearer $CRON_SECRET`을 요구하며 1분 주기 scheduler에서 호출합니다.

## 검증
```bash
npm run validate
npm run lint
npm run typecheck
npm run build
```

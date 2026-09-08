# MyScheduler

자연어로 여러 일정을 한 번에 등록하고, PC · Android · iPhone에서 함께 관리할 수 있는 개인 일정 관리 PWA입니다.

[서비스 바로가기](https://my-scheduler-eight.vercel.app)

## 왜 만들었나

채용 마감, 시험, 발표, 면접처럼 일정이 몰리는 시기에는 캘린더에 하나씩 등록하는 작업 자체가 번거로웠습니다. 그래서 여러 일정을 자연어로 한 번에 입력하고, 기기와 상관없이 같은 일정 상태를 확인할 수 있는 개인용 도구를 만들었습니다.

```text
넥토리얼 9월 7일 마감
우리은행 9월 8일 마감
토익스피킹 시험 9월 9일
KBS 필기 8월 30일 오전 8시 30분, 메모: 8시 30분 입실 · 컴싸 · 여권
```

입력된 문장은 날짜 · 시간 · 분류 · 알림 · 메모로 해석한 뒤 미리보기에서 확인하고 저장합니다.

## 핵심 설계

### 1. 외부 LLM 대신 규칙 기반 한국어 파서

일정 해석은 외부 LLM API에 맡기지 않았습니다. 일정 입력은 표현 범위가 비교적 명확하고 결과가 항상 동일해야 한다고 판단해 규칙 기반 파서를 구현했습니다.

- 별도 AI API 비용 없음
- 사용자 일정이 외부 LLM으로 전송되지 않음
- 같은 입력에 같은 결과를 내는 결정적인 동작
- 날짜 · 시간 · 분류 · 메모 등을 입력 단계에서 검증 가능

### 2. 여러 기기에서 같은 데이터 사용

Supabase Auth와 PostgreSQL을 사용하고 RLS(Row Level Security)를 적용해 사용자별 일정 데이터가 분리되도록 구성했습니다.

- 이메일 + 비밀번호 인증
- 사용자별 Task 동기화
- PC · Android · iPhone PWA 지원
- 모바일 UI와 D-day 제공

### 3. 알림까지 연결되는 PWA

PWA manifest와 Service Worker를 구성하고 Web Push subscription을 저장해 설치형 앱처럼 사용할 수 있도록 했습니다.

```text
사용자 입력
   ↓
한국어 일정 파서
   ↓
미리보기 / 검증
   ↓
Supabase PostgreSQL
   ↓
PC · Android · iPhone 동기화
   ↓
Web Push 알림
```

## AI와 함께 개발하되 결과는 자동 검증

이 프로젝트에서는 SDD(Spec-Driven Development)와 Harness Engineering 방식으로 개발 환경을 구성했습니다.

`AGENTS.md`와 `docs/`에 요구사항과 개발 규칙을 먼저 정의하고, AI가 생성한 코드도 정해둔 검증 절차를 통과해야 반영되도록 했습니다.

```text
요구사항 / 개발 규칙
        ↓
AI-assisted Implementation
        ↓
Validator
        ↓
Lint / Type Check / Build
        ↓
Pull Request / CI
```

검증 명령은 다음과 같습니다.

```bash
npm run validate
npm run lint
npm run typecheck
npm run build
```

DB 변경 역시 `supabase/migrations/`를 단일 기준으로 관리하고 GitHub Actions에서 Production DB에 적용하도록 구성했습니다.

## 주요 기능

- 월간 캘린더 + 전체 Task 목록
- 자연어 다건 등록 및 저장 전 미리보기
- 마감 / 시험 / 발표 / 면접 / 일반 일정 자동 분류
- Task별 메모 · 준비물 · 완료 처리
- 이메일 + 비밀번호 로그인
- 사용자별 일정 동기화
- D-day 및 모바일 Bottom Sheet
- Android / PC / iPhone PWA 설치
- Web Push 예약 알림
- Supabase RLS 기반 사용자 데이터 격리
- Migration + CI 기반 DB 변경 관리

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Next.js, TypeScript |
| Backend / DB | Supabase, PostgreSQL, RLS |
| App | PWA, Service Worker, Web Push |
| Deployment | Vercel |
| Engineering | GitHub Actions, Validator, SDD, Harness Engineering |

## 저장소 구조

```text
src/                  # 애플리케이션 코드
supabase/migrations/  # DB schema 변경의 단일 기준
scripts/              # 프로젝트 전용 validator
docs/                 # 요구사항 · 설계 · 작업 기록
.github/               # CI / migration workflow
AGENTS.md              # AI 작업 규칙
```

## 로컬 실행

```bash
npm install
npm run dev
```

기존 운영 중심 README는 개발 과정 보존을 위해 [`docs/legacy/README_2026-09-08.md`](docs/legacy/README_2026-09-08.md)에 남겨두었습니다.

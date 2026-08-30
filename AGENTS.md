# MyScheduler Agent 작업 가이드

## 작업 전 읽을 문서
1. `docs/product-brief.md`
2. `docs/architecture.md`
3. `docs/git-conventions.md`
4. `docs/work-logs/`의 최신 로그

## 프로젝트 목적
PC와 Android에서 같은 일정을 보고, PWA 설치와 Web Push를 통해 일정 알림을 받는 개인용 Scheduler를 만든다.

## 개발 원칙
- Next.js App Router + TypeScript를 사용한다.
- 모바일(Android Chrome)과 데스크톱을 동등하게 지원한다.
- 일정 시간은 ISO 8601 문자열로 저장하고 UI에서 로컬 시간대로 표현한다.
- 브라우저 전용 API는 Client Component 또는 Service Worker에서만 사용한다.
- 민감한 Supabase service role key, VAPID private key는 절대 저장소에 커밋하지 않는다.
- 외부 서비스가 없어도 로컬 일정 CRUD는 동작해야 한다.
- 동기화/Push 기능은 외부 설정 경계를 명확히 문서화한다.

## Harness
변경 전후 아래 검증을 수행한다.

```bash
npm run validate
npm run lint
npm run typecheck
npm run build
```

`validate`는 필수 문서/파일, 금지된 비밀 파일, PWA 필수 자산을 확인한다.

## Git
- `main` 직접 작업 금지. 저장소 최초 bootstrap만 예외다.
- 브랜치/커밋/PR 규칙은 `docs/git-conventions.md`를 따른다.
- 사용자 승인 없이 merge하지 않는다.

## 완료 조건
- 기능이 모바일/데스크톱에서 레이아웃 파손 없이 사용 가능하다.
- 관련 문서와 작업 로그를 갱신한다.
- CI에서 validate → lint → typecheck → build가 통과해야 한다.

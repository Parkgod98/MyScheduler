# MyScheduler

채용 마감, 시험, 발표처럼 한꺼번에 몰리는 일정을 빠르게 등록하려고 만든 개인 일정 관리 서비스입니다.

자연어로 입력하면 날짜·시간·분류·메모를 해석해 일정으로 등록하고, PC와 휴대폰에서 같은 내용을 확인할 수 있습니다.

**[서비스 바로가기](https://my-scheduler-eight.vercel.app)**

## 주요 기능

- 여러 일정을 자연어로 한 번에 등록
- 저장 전 해석 결과 미리보기
- 마감 · 시험 · 발표 · 면접 자동 분류
- 메모 · 준비물 · D-day · 완료 처리
- PC · Android · iPhone 동기화
- PWA 설치 및 Web Push 알림

## 기술

`Next.js` `TypeScript` `Supabase` `PostgreSQL` `PWA` `Web Push`

## 개발하면서 고민한 것

### LLM을 쓰지 않은 일정 파서

처음에는 LLM으로 문장을 해석하는 방법도 생각했지만, 별도 API 비용 없이 동작하는 규칙 기반 한국어 파서를 구현했습니다.


### 여러 기기에서 같은 일정 유지

Supabase Auth와 PostgreSQL을 사용하고 RLS를 적용해 사용자별 데이터를 분리했습니다. 같은 계정으로 로그인하면 PC와 모바일에서 동일한 일정을 확인할 수 있습니다.

### AI와 함께 개발하는 환경

개인 프로젝트에서도 요구사항과 개발 규칙을 먼저 문서로 정리하고, AI가 만든 코드도 Validator · Lint · Type Check · Build를 통과한 뒤 반영하도록 구성했습니다.

이 과정과 세부 개발 규칙은 [`docs/`](docs/)와 [`AGENTS.md`](AGENTS.md)에 남겨두었습니다.

<details>
<summary>로컬 실행 및 검증</summary>

```bash
npm install
npm run dev

npm run validate
npm run lint
npm run typecheck
npm run build
```

</details>

이전 운영 중심 README는 [`docs/legacy/README_2026-09-08.md`](docs/legacy/README_2026-09-08.md)에 보관했습니다.

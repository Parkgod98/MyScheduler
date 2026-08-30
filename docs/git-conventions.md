# Git 작업 규칙

## 브랜치
`<type>/<short-kebab-case>` 형식을 사용한다.

허용 type: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.

예: `feat/web-push`, `fix/mobile-calendar`.

## 커밋
`<type>: <한글 설명>` 형식을 사용한다.

예: `feat: 일정 등록 화면 추가`.

한 커밋은 하나의 논리적 변경을 담고, `update`, `수정` 같은 모호한 메시지만 사용하지 않는다.

## Pull Request
- 제목은 커밋 규칙과 같은 Conventional 형식을 사용한다.
- 본문에는 변경 내용, 검증 방법, 외부 설정 여부, 남은 제약을 적는다.
- CI 실패 상태에서 merge하지 않는다.
- `main`에는 직접 push하지 않고 PR을 통해 반영한다.

## 표준 흐름
`main → 작업 브랜치 → 구현 → validate/lint/typecheck/build → push → PR → CI → review → merge`

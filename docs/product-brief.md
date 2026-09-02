# Product Brief

MyScheduler는 채용·시험·발표·면접 일정을 빠르게 입력하고, 캘린더와 Task 관점에서 관리하는 개인용 PWA다.

## 핵심 사용 시나리오
- 여러 채용 일정을 자연어로 한 번에 등록한다.
- 월간 캘린더에서 회사/일정명을 먼저 확인하고 날짜를 눌러 세부 Task를 본다.
- Task 화면에서 D-day와 카테고리 기준으로 다가오는 일정을 훑는다.
- 각 Task에 메모와 준비물 체크리스트를 기록한다.
- PC · Android · iPhone에서 같은 계정의 일정을 사용한다.
- Android/PC는 브라우저 PWA로, iPhone은 Safari의 홈 화면 추가를 통해 standalone PWA로 실행한다.
- 지원 기기에서는 Web Push 알림을 등록해 일정 알림을 받는다.

## UX v2
- 모바일 하단 네비게이션: 캘린더 / Task / 빠른추가 / 설정
- 캘린더 셀은 시간보다 일정명 우선 표시
- 마감/시험/발표/면접/일반 카테고리 색상 및 범례
- 날짜 선택 시 Bottom Sheet로 상세 Task 표시
- Task D-day, 필터, 완료 처리, 메모, 체크리스트
- 자연어 파싱은 기본적으로 무료 규칙 기반으로 유지
- iPhone Safari 접속 시 홈 화면 설치 안내 제공
- iOS safe-area와 standalone status bar 대응

## 플랫폼
- PC: 일반 웹 또는 설치형 PWA
- Android: Chrome PWA + 선택적 네이티브 wrapper/홈 위젯
- iPhone/iPad: Safari → 홈 화면에 추가 → standalone PWA

## 다음 단계
- Android 큰 위젯: 다가오는 일정 3~5개
- iOS 실제 기기에서 Push 및 홈 화면 아이콘 smoke test
- 필요 시 회사별 채용 프로세스 묶음

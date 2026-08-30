# Product Brief

MyScheduler는 개인용 일정 관리 PWA다.

## MVP
- 월간 달력
- 날짜 선택 및 일정 등록/삭제
- 다음 일정 헤더 표시
- Android/PC 반응형 UI
- 홈 화면 설치 가능한 PWA
- 알림 권한 및 Service Worker 기반 Push 수신 기반
- 외부 서비스가 없을 때 localStorage 저장

## 다음 연결
- Supabase Auth/Database로 PC↔Android 동기화
- Push subscription 저장
- 서버 scheduler가 reminder를 조회해 Web Push 발송
- 반복 일정, 다중 알림, 자연어 입력

## 비목표
초기 버전에서 Google Calendar 완전 호환, 팀 협업, 복잡한 권한 모델은 구현하지 않는다.

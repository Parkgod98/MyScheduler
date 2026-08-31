# MyScheduler Android Home Widget

웹/PWA를 그대로 사용하는 작은 Android WebView wrapper와 홈 화면 위젯입니다.

## 동작
1. Android 앱이 Production MyScheduler URL을 WebView로 엽니다.
2. 기존 웹 로그인/Supabase 동기화를 그대로 사용합니다.
3. 페이지가 로드되면 `.top-summary`의 다음 일정 요약을 네이티브 SharedPreferences에 캐시합니다.
4. 홈 화면 위젯은 캐시된 다음 일정을 표시하고, 누르면 MyScheduler 앱을 엽니다.

초기 버전은 **다음 일정 1개** 위젯입니다. 다가오는 3~5개 일정, 백그라운드 네이티브 동기화는 후속 단계에서 확장합니다.

## Android Studio 실행
`android-widget/` 폴더를 Android Studio에서 프로젝트로 엽니다.

Production URL을 Gradle property로 전달합니다.

```bash
./gradlew assembleDebug -PMYSCHEDULER_URL=https://YOUR_APP.vercel.app
```

또는 Android Studio의 Gradle 실행 설정에 `-PMYSCHEDULER_URL=https://...`를 추가합니다.

## 사용
- APK 설치 후 MyScheduler 앱을 한 번 열고 로그인합니다.
- 앱이 다음 일정 요약을 읽으면 위젯 캐시가 갱신됩니다.
- Android 홈 화면 길게 누르기 → 위젯 → MyScheduler → 다음 일정 위젯을 배치합니다.

## 현재 제약
- 위젯은 앱을 열었을 때 최신 다음 일정으로 갱신됩니다.
- Web Push 알림은 기존 PWA/서버 경로를 그대로 사용합니다.
- 위젯에서 메모/준비물 같은 비공개 상세 정보는 표시하지 않습니다.

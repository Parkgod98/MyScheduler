# MyScheduler Android Home Widget

웹/PWA를 그대로 사용하는 작은 Android WebView wrapper와 홈 화면 위젯입니다.

## 동작
1. Android 앱이 Production MyScheduler URL을 WebView로 엽니다.
2. 기존 웹 로그인/Supabase 동기화를 그대로 사용합니다.
3. 페이지가 로드되면 `.top-summary`의 다음 일정 요약을 네이티브 SharedPreferences에 캐시합니다.
4. 홈 화면 위젯은 캐시된 다음 일정을 표시하고, 누르면 MyScheduler 앱을 엽니다.

초기 버전은 **다음 일정 1개** 위젯입니다. 다가오는 3~5개 일정, 백그라운드 네이티브 동기화는 후속 단계에서 확장합니다.

## GitHub Actions에서 APK 받기
`main`에 변경이 반영되면 CI가 Android debug APK를 자동 빌드합니다.

1. GitHub 저장소의 **Actions** 탭을 엽니다.
2. 최신 `CI` 실행을 선택합니다.
3. 실행이 성공하면 페이지 아래 **Artifacts**에서 `MyScheduler-Android-debug`를 받습니다.
4. ZIP 압축을 풀고 `app-debug.apk`를 Android 기기에 설치합니다.

CI에서 생성되는 APK는 `https://my-scheduler-git-main-parkgod.vercel.app`을 엽니다.
Artifact는 14일 동안 보관됩니다.

## 로컬 빌드
`android-widget/` 폴더를 Android Studio에서 프로젝트로 열 수 있습니다.

Gradle 8.9가 설치되어 있다면 저장소 루트에서 다음처럼 빌드할 수 있습니다.

```bash
gradle -p android-widget assembleDebug -PMYSCHEDULER_URL=https://my-scheduler-git-main-parkgod.vercel.app
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

plugins { id("com.android.application") }

android {
    namespace = "com.myscheduler.widget"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.myscheduler.widget"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        val schedulerUrl = providers.gradleProperty("MYSCHEDULER_URL").orElse("https://example.invalid")
        buildConfigField("String", "MYSCHEDULER_URL", "\"${schedulerUrl.get()}\"")
    }

    buildFeatures { buildConfig = true }
}

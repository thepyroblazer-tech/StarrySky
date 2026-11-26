plugins {
    id("com.android.application")
}

android {
    namespace = "com.starrysky.player"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.starrysky.player"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "1.2.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signed with the debug key so it installs without extra setup. Personal use only.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main") {
            // The web UI lives in StarrySky/web and is packaged as the app's assets.
            assets.srcDirs("../../web")
        }
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}

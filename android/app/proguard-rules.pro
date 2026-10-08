# MAHI Browser Android Companion ProGuard Rules

# Keep AndroidX Biometric
-keep class androidx.biometric.** { *; }

# Keep AndroidX Security Crypto / Keystore primitives
-keep class androidx.security.crypto.** { *; }

# Keep WebKit and JavaScript interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Do not log or strip logging tags in release
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
}

# Keep companion data models
-keep class com.mahibrowser.mobile.models.** { *; }

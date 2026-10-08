package com.mahibrowser.mobile.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Platform-backed secure token storage utilizing Android KeyStore and EncryptedSharedPreferences (AES-256-GCM).
 * Never stores refresh tokens, passwords, or session secrets in plain SharedPreferences or logs.
 */
class KeystoreManager(context: Context) {

    private val masterKey: MasterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val securePrefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "mahi_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveTokens(accessToken: String, refreshToken: String) {
        securePrefs.edit()
            .putString("access_token", accessToken)
            .putString("refresh_token", refreshToken)
            .apply()
    }

    fun getAccessToken(): String? = securePrefs.getString("access_token", null)

    fun getRefreshToken(): String? = securePrefs.getString("refresh_token", null)

    fun clearTokens() {
        securePrefs.edit()
            .remove("access_token")
            .remove("refresh_token")
            .apply()
    }

    fun setBiometricLockEnabled(enabled: Boolean) {
        securePrefs.edit()
            .putBoolean("biometric_lock_enabled", enabled)
            .apply()
    }

    fun isBiometricLockEnabled(): Boolean = securePrefs.getBoolean("biometric_lock_enabled", false)
}

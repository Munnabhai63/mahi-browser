package com.mahibrowser.mobile

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import com.mahibrowser.mobile.security.BiometricPromptHelper
import com.mahibrowser.mobile.security.KeystoreManager

/**
 * Main Activity for MAHI Browser Mobile Companion.
 * Manages deep links, hardware security policies (e.g. FLAG_SECURE), and biometric app locks.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var keystoreManager: KeystoreManager
    private lateinit var biometricHelper: BiometricPromptHelper

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        keystoreManager = KeystoreManager(this)
        biometricHelper = BiometricPromptHelper(this)

        // Handle incoming intent (e.g. deep links / app links)
        handleIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        // If biometric lock is enabled, trigger verification prompt
        if (keystoreManager.isBiometricLockEnabled() && biometricHelper.isBiometricAvailable()) {
            biometricHelper.authenticate(
                onSuccess = {
                    // Biometric unlocked successfully
                },
                onError = { _ ->
                    // Keep app locked or close if canceled
                }
            )
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val action = intent?.action
        val data: Uri? = intent?.data

        if (Intent.ACTION_VIEW == action && data != null) {
            val scheme = data.scheme
            val host = data.host
            val path = data.path

            // Safe deep link dispatching:
            // mahi://app/verify?token=...
            // mahi://app/invite?workspaceId=...
            // https://app.mahibrowser.com/mobile/verify?token=...
            if ((scheme == "mahi" && host == "app") || (scheme == "https" && host == "app.mahibrowser.com")) {
                // Safely route to mobile webview or native handler
            }
        }
    }

    fun setSessionPrivacy(secure: Boolean) {
        if (secure) {
            window.setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            )
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }
}

/// Native biometric authentication for macOS using LocalAuthentication framework.
///
/// Uses a Swift helper script via `osascript` workaround approach:
/// LAContext is called directly via objc2 for availability checks,
/// and for authentication we use a compiled Swift snippet.

#[cfg(target_os = "macos")]
mod macos {
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};
    use std::process::Command;

    /// LAPolicyDeviceOwnerAuthenticationWithBiometrics = 1
    const LA_POLICY_BIOMETRICS: isize = 1;

    #[link(name = "LocalAuthentication", kind = "framework")]
    extern "C" {}

    pub fn is_available() -> bool {
        unsafe {
            let context: Retained<AnyObject> = msg_send![class!(LAContext), new];
            let mut error: *mut AnyObject = std::ptr::null_mut();
            let available: bool = msg_send![
                &context,
                canEvaluatePolicy: LA_POLICY_BIOMETRICS,
                error: &mut error
            ];
            available
        }
    }

    pub fn authenticate(reason: &str) -> Result<(), String> {
        // Use a Swift snippet via `swift` CLI to call LAContext.evaluatePolicy
        // This avoids the complex block2 FFI while still using native Touch ID
        let swift_code = format!(
            r#"
            import LocalAuthentication
            import Foundation
            let context = LAContext()
            let semaphore = DispatchSemaphore(value: 0)
            var authError: String? = nil
            var authSuccess = false
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "{}") {{ success, error in
                authSuccess = success
                if !success {{
                    authError = error?.localizedDescription ?? "Authentication failed"
                }}
                semaphore.signal()
            }}
            semaphore.wait()
            if authSuccess {{
                print("OK")
            }} else {{
                print("ERR:\(authError ?? "Unknown error")")
            }}
            "#,
            reason.replace('\"', "\\\"").replace('\\', "\\\\")
        );

        let output = Command::new("swift")
            .arg("-e")
            .arg(&swift_code)
            .output()
            .map_err(|e| format!("Failed to run swift: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

        if stdout == "OK" {
            Ok(())
        } else if let Some(err) = stdout.strip_prefix("ERR:") {
            Err(err.to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            Err(format!("Biometric auth failed: {}", stderr))
        }
    }
}

#[tauri::command]
pub async fn check_biometric_available() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(macos::is_available())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(false)
    }
}

#[tauri::command]
#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
pub async fn authenticate_biometric(reason: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let result = macos::authenticate(&reason);
            let _ = tx.send(result);
        });
        rx.recv().map_err(|e| e.to_string())?
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Biometric authentication not available on this platform".into())
    }
}

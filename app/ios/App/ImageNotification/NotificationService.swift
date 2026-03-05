@preconcurrency import UserNotifications
import os.log

private let logger = OSLog(subsystem: "com.pliablepixels.zmng.ImageNotification", category: "NotificationService")

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping @Sendable (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let bestAttemptContent = bestAttemptContent else {
            os_log("No mutable content available", log: logger, type: .error)
            contentHandler(request.content)
            return
        }

        os_log("Received notification, searching for image URL in userInfo", log: logger, type: .info)

        // Look for image URL in fcm_options, data payload, or notification image
        var imageUrlString: String?
        var source: String = "none"

        if let fcmOptions = bestAttemptContent.userInfo["fcm_options"] as? [String: Any] {
            imageUrlString = fcmOptions["image"] as? String
            if imageUrlString != nil { source = "fcm_options.image" }
        }
        if imageUrlString == nil {
            imageUrlString = bestAttemptContent.userInfo["image_url_jpg"] as? String
            if imageUrlString != nil { source = "image_url_jpg" }
        }
        if imageUrlString == nil {
            imageUrlString = bestAttemptContent.userInfo["image"] as? String
            if imageUrlString != nil { source = "image" }
        }

        guard let rawUrlString = imageUrlString else {
            os_log("No image URL found in payload", log: logger, type: .info)
            contentHandler(bestAttemptContent)
            return
        }

        os_log("Found image URL from %{public}@: %{public}@", log: logger, type: .info, source, rawUrlString)

        // ES sends URL-encoded image URLs (e.g. http%3A%2F%2F...) — decode before parsing
        let decoded = rawUrlString.removingPercentEncoding ?? rawUrlString
        if decoded != rawUrlString {
            os_log("Decoded URL: %{public}@", log: logger, type: .info, decoded)
        }

        guard let url = URL(string: decoded) else {
            os_log("Failed to parse URL from decoded string: %{public}@", log: logger, type: .error, decoded)
            contentHandler(bestAttemptContent)
            return
        }

        os_log("Downloading image from %{public}@ (scheme: %{public}@)", log: logger, type: .info, url.absoluteString, url.scheme ?? "nil")

        downloadImage(from: url) { attachment in
            if let attachment = attachment {
                os_log("Image attached to notification", log: logger, type: .info)
                bestAttemptContent.attachments = [attachment]
            } else {
                os_log("Image download failed, delivering notification without image", log: logger, type: .error)
            }
            contentHandler(bestAttemptContent)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        os_log("Service extension time expired", log: logger, type: .error)
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    private func downloadImage(from url: URL, completion: @escaping @Sendable (UNNotificationAttachment?) -> Void) {
        let task = URLSession.shared.downloadTask(with: url) { localUrl, response, error in
            if let error = error {
                os_log("Download error: %{public}@", log: logger, type: .error, error.localizedDescription)
                completion(nil)
                return
            }

            if let httpResponse = response as? HTTPURLResponse {
                os_log("Download response: HTTP %{public}d, content-type: %{public}@", log: logger, type: .info, httpResponse.statusCode, httpResponse.value(forHTTPHeaderField: "Content-Type") ?? "unknown")
            }

            guard let localUrl = localUrl else {
                os_log("Download succeeded but no local file URL", log: logger, type: .error)
                completion(nil)
                return
            }

            let tmpDir = FileManager.default.temporaryDirectory
            // ZM image URLs end in index.php with query params — always use .jpg
            // so UNNotificationAttachment recognizes the file type
            let tmpFile = tmpDir.appendingPathComponent("notification-image.jpg")

            os_log("Moving downloaded file to %{public}@", log: logger, type: .debug, tmpFile.path)

            try? FileManager.default.removeItem(at: tmpFile)
            do {
                try FileManager.default.moveItem(at: localUrl, to: tmpFile)
                let attachment = try UNNotificationAttachment(identifier: "image", url: tmpFile, options: nil)
                completion(attachment)
            } catch {
                os_log("Failed to create attachment: %{public}@", log: logger, type: .error, error.localizedDescription)
                completion(nil)
            }
        }
        task.resume()
    }
}

import Foundation
import Capacitor
import WebKit
import CommonCrypto

@objc(SSLTrustPlugin)
public class SSLTrustPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SSLTrustPlugin"
    public let jsName = "SSLTrust"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "enable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setTrustedFingerprint", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getServerCertFingerprint", returnType: CAPPluginReturnPromise),
    ]

    /// Global flag checked by URLProtocol and WKWebView delegate
    @objc static var sslTrustEnabled = false

    /// Trusted certificate SHA-256 fingerprint (colon-separated uppercase hex)
    @objc static var trustedFingerprint: String? = nil

    @objc func enable(_ call: CAPPluginCall) {
        SSLTrustPlugin.sslTrustEnabled = true
        // Register URLProtocol to intercept URLSession.shared HTTPS requests
        // This covers CapacitorHttp which uses URLSession.shared
        URLProtocol.registerClass(SSLTrustURLProtocol.self)
        installWebViewDelegate()
        call.resolve()
    }

    @objc func disable(_ call: CAPPluginCall) {
        SSLTrustPlugin.sslTrustEnabled = false
        SSLTrustPlugin.trustedFingerprint = nil
        URLProtocol.unregisterClass(SSLTrustURLProtocol.self)
        call.resolve()
    }

    @objc func isEnabled(_ call: CAPPluginCall) {
        call.resolve(["enabled": SSLTrustPlugin.sslTrustEnabled])
    }

    @objc func setTrustedFingerprint(_ call: CAPPluginCall) {
        SSLTrustPlugin.trustedFingerprint = call.getString("fingerprint")
        call.resolve()
    }

    @objc func getServerCertFingerprint(_ call: CAPPluginCall) {
        guard let urlStr = call.getString("url"), let url = URL(string: urlStr) else {
            call.reject("URL is required")
            return
        }

        let delegate = CertFetchDelegate { result in
            switch result {
            case .success(let info):
                call.resolve([
                    "fingerprint": info.fingerprint,
                    "subject": info.subject,
                    "issuer": info.issuer,
                    "expiry": info.expiry,
                ])
            case .failure(let error):
                call.reject("Failed to get server certificate: \(error.localizedDescription)")
            }
        }

        let config = URLSessionConfiguration.ephemeral
        let session = URLSession(configuration: config, delegate: delegate, delegateQueue: nil)
        let task = session.dataTask(with: url) { _, _, _ in
            session.invalidateAndCancel()
        }
        task.resume()
    }

    // MARK: - WebView Navigation Delegate (covers <img src>, MJPEG, WSS)

    private var sslDelegate: SSLTrustNavigationDelegate?

    private func installWebViewDelegate() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let webView = self.bridge?.webView,
                  let original = webView.navigationDelegate else { return }
            if original is SSLTrustNavigationDelegate { return }
            self.sslDelegate = SSLTrustNavigationDelegate(originalDelegate: original)
            webView.navigationDelegate = self.sslDelegate
        }
    }
}

// MARK: - Certificate info struct

struct CertFetchInfo {
    let fingerprint: String
    let subject: String
    let issuer: String
    let expiry: String
}

// MARK: - One-time cert fetch delegate

class CertFetchDelegate: NSObject, URLSessionDelegate {
    private let completion: (Result<CertFetchInfo, Error>) -> Void
    private var completed = false

    init(completion: @escaping (Result<CertFetchInfo, Error>) -> Void) {
        self.completion = completion
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        // Extract the leaf certificate
        let certCount = SecTrustGetCertificateCount(serverTrust)
        guard certCount > 0 else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            if !completed {
                completed = true
                completion(.failure(NSError(domain: "SSLTrust", code: -1, userInfo: [NSLocalizedDescriptionKey: "No certificates"])))
            }
            return
        }

        // Use SecTrustCopyCertificateChain for iOS 15+, fall back to SecTrustGetCertificateAtIndex
        var cert: SecCertificate?
        if #available(iOS 15.0, *) {
            if let chain = SecTrustCopyCertificateChain(serverTrust) as? [SecCertificate], !chain.isEmpty {
                cert = chain[0]
            }
        } else {
            cert = SecTrustGetCertificateAtIndex(serverTrust, 0)
        }

        guard let leafCert = cert else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            if !completed {
                completed = true
                completion(.failure(NSError(domain: "SSLTrust", code: -2, userInfo: [NSLocalizedDescriptionKey: "Cannot extract certificate"])))
            }
            return
        }

        let fingerprint = sha256Fingerprint(leafCert)
        let subject = SecCertificateCopySubjectSummary(leafCert) as String? ?? "Unknown"

        // Parse expiry from the certificate data
        var issuerStr = "Unknown"
        var expiryStr = "Unknown"
        if let certData = CFBridgingRetain(SecCertificateCopyData(leafCert)) as? Data {
            // We already have the fingerprint; subject/issuer details are best-effort
            _ = certData
        }
        // Use subject summary for both (full X.509 parsing is complex on iOS)
        issuerStr = subject
        expiryStr = "See certificate details"

        let info = CertFetchInfo(fingerprint: fingerprint, subject: subject, issuer: issuerStr, expiry: expiryStr)

        if !completed {
            completed = true
            completion(.success(info))
        }

        // Accept the cert for this one-time fetch
        completionHandler(.useCredential, URLCredential(trust: serverTrust))
    }
}

// MARK: - SHA-256 fingerprint helper

func sha256Fingerprint(_ certificate: SecCertificate) -> String {
    let data = SecCertificateCopyData(certificate) as Data
    var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
    data.withUnsafeBytes { ptr in
        _ = CC_SHA256(ptr.baseAddress!, CC_LONG(data.count), &hash)
    }
    return hash.map { String(format: "%02X", $0) }.joined(separator: ":")
}

/// Check if a certificate's fingerprint matches the trusted one
func isCertTrusted(_ certificate: SecCertificate) -> Bool {
    guard let trusted = SSLTrustPlugin.trustedFingerprint, !trusted.isEmpty else {
        // No fingerprint stored yet — allow for TOFU flow
        return true
    }
    let actual = sha256Fingerprint(certificate)
    return actual == trusted
}

// MARK: - URLProtocol for intercepting URLSession.shared HTTPS requests

/// Custom URLProtocol that intercepts HTTPS requests and validates certificates
/// against the trusted fingerprint. This is needed because CapacitorHttp uses
/// URLSession.shared which has no delegate.
class SSLTrustURLProtocol: URLProtocol, URLSessionDelegate, URLSessionDataDelegate {
    private var dataTask: URLSessionDataTask?
    private static let handledKey = "SSLTrustURLProtocolHandled"

    override class func canInit(with request: URLRequest) -> Bool {
        // Only intercept when SSL trust is enabled
        guard SSLTrustPlugin.sslTrustEnabled else { return false }
        // Only intercept HTTPS
        guard request.url?.scheme == "https" else { return false }
        // Prevent infinite recursion — skip requests we've already handled
        guard URLProtocol.property(forKey: handledKey, in: request) == nil else { return false }
        return true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        return request
    }

    override func startLoading() {
        guard let mutableRequest = (request as NSURLRequest).mutableCopy() as? NSMutableURLRequest else {
            client?.urlProtocol(self, didFailWithError: NSError(domain: "SSLTrust", code: -1))
            return
        }
        // Mark request as handled to prevent recursion
        URLProtocol.setProperty(true, forKey: SSLTrustURLProtocol.handledKey, in: mutableRequest)

        let config = URLSessionConfiguration.default
        let session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        dataTask = session.dataTask(with: mutableRequest as URLRequest)
        dataTask?.resume()
    }

    override func stopLoading() {
        dataTask?.cancel()
    }

    // MARK: URLSessionDelegate — validate certificate fingerprint

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
           let serverTrust = challenge.protectionSpace.serverTrust {

            var cert: SecCertificate?
            if #available(iOS 15.0, *) {
                if let chain = SecTrustCopyCertificateChain(serverTrust) as? [SecCertificate], !chain.isEmpty {
                    cert = chain[0]
                }
            } else {
                cert = SecTrustGetCertificateAtIndex(serverTrust, 0)
            }

            if let leafCert = cert, isCertTrusted(leafCert) {
                completionHandler(.useCredential, URLCredential(trust: serverTrust))
                return
            }

            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        completionHandler(.performDefaultHandling, nil)
    }

    // MARK: URLSessionDataDelegate — forward response data to client

    func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive response: URLResponse,
        completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
    ) {
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        client?.urlProtocol(self, didLoad: data)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            client?.urlProtocol(self, didFailWithError: error)
        } else {
            client?.urlProtocolDidFinishLoading(self)
        }
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        // Forward redirects to the URL loading system
        client?.urlProtocol(self, wasRedirectedTo: request, redirectResponse: response)
        completionHandler(nil)
    }
}

// MARK: - WKWebView Navigation Delegate Proxy

class SSLTrustNavigationDelegate: NSObject, WKNavigationDelegate {
    let originalDelegate: WKNavigationDelegate

    init(originalDelegate: WKNavigationDelegate) {
        self.originalDelegate = originalDelegate
        super.init()
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        return originalDelegate
    }

    override func responds(to aSelector: Selector!) -> Bool {
        if super.responds(to: aSelector) { return true }
        return originalDelegate.responds(to: aSelector)
    }

    func webView(
        _ webView: WKWebView,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        if SSLTrustPlugin.sslTrustEnabled,
           challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
           let serverTrust = challenge.protectionSpace.serverTrust {

            var cert: SecCertificate?
            if #available(iOS 15.0, *) {
                if let chain = SecTrustCopyCertificateChain(serverTrust) as? [SecCertificate], !chain.isEmpty {
                    cert = chain[0]
                }
            } else {
                cert = SecTrustGetCertificateAtIndex(serverTrust, 0)
            }

            if let leafCert = cert, isCertTrusted(leafCert) {
                completionHandler(.useCredential, URLCredential(trust: serverTrust))
                return
            }

            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        if originalDelegate.responds(to: #selector(webView(_:didReceive:completionHandler:))) {
            originalDelegate.webView?(webView, didReceive: challenge, completionHandler: completionHandler)
        } else {
            completionHandler(.performDefaultHandling, nil)
        }
    }
}

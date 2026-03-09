import Foundation
import Capacitor
import WebKit

@objc(SSLTrustPlugin)
public class SSLTrustPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SSLTrustPlugin"
    public let jsName = "SSLTrust"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "enable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isEnabled", returnType: CAPPluginReturnPromise),
    ]

    /// Global flag checked by URLProtocol and WKWebView delegate
    @objc static var sslTrustEnabled = false

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
        URLProtocol.unregisterClass(SSLTrustURLProtocol.self)
        call.resolve()
    }

    @objc func isEnabled(_ call: CAPPluginCall) {
        call.resolve(["enabled": SSLTrustPlugin.sslTrustEnabled])
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

// MARK: - URLProtocol for intercepting URLSession.shared HTTPS requests

/// Custom URLProtocol that intercepts HTTPS requests and accepts self-signed certificates.
/// This is needed because CapacitorHttp uses URLSession.shared which has no delegate,
/// so there's no other way to handle authentication challenges for it.
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

    // MARK: URLSessionDelegate — accept self-signed certs

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
           let serverTrust = challenge.protectionSpace.serverTrust {
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
        } else {
            completionHandler(.performDefaultHandling, nil)
        }
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
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
            return
        }

        if originalDelegate.responds(to: #selector(webView(_:didReceive:completionHandler:))) {
            originalDelegate.webView?(webView, didReceive: challenge, completionHandler: completionHandler)
        } else {
            completionHandler(.performDefaultHandling, nil)
        }
    }
}

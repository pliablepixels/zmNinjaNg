package com.zoneminder.zmNinjaNG;

import android.net.http.SslError;
import android.os.Bundle;
import android.webkit.SslErrorHandler;
import android.webkit.WebView;

import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayInputStream;
import java.net.URL;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import android.net.http.SslCertificate;

@CapacitorPlugin(name = "SSLTrust")
public class SSLTrustPlugin extends Plugin {

    private boolean enabled = false;
    private String trustedFingerprint = null;
    private SSLSocketFactory originalSslSocketFactory;
    private HostnameVerifier originalHostnameVerifier;

    @Override
    public void load() {
        // Save originals so we can restore them on disable
        originalSslSocketFactory = HttpsURLConnection.getDefaultSSLSocketFactory();
        originalHostnameVerifier = HttpsURLConnection.getDefaultHostnameVerifier();
    }

    @PluginMethod
    public void enable(PluginCall call) {
        this.enabled = true;
        installFingerprintTrustManager();
        // WebView handler is only installed via setTrustedFingerprint()
        // so that onReceivedSslError never calls proceed() without validation
        call.resolve();
    }

    @PluginMethod
    public void disable(PluginCall call) {
        this.enabled = false;
        this.trustedFingerprint = null;
        restoreOriginalCerts();
        restoreWebViewSslHandler();
        call.resolve();
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("enabled", this.enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void setTrustedFingerprint(PluginCall call) {
        this.trustedFingerprint = call.getString("fingerprint");
        if (this.enabled) {
            installFingerprintTrustManager();
            // Only install WebView handler when we have a fingerprint to validate against.
            // This ensures onReceivedSslError never calls proceed() without cert validation.
            if (this.trustedFingerprint != null && !this.trustedFingerprint.isEmpty()) {
                installWebViewSslHandler();
            } else {
                restoreWebViewSslHandler();
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void getServerCertFingerprint(PluginCall call) {
        String urlStr = call.getString("url");
        if (urlStr == null || urlStr.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        new Thread(() -> {
            try {
                // Create a trust-all context for this one-time cert fetch
                TrustManager[] trustAll = new TrustManager[]{
                    new X509TrustManager() {
                        @Override
                        public void checkClientTrusted(X509Certificate[] chain, String authType) {}
                        @Override
                        public void checkServerTrusted(X509Certificate[] chain, String authType) {}
                        @Override
                        public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    }
                };

                SSLContext tempContext = SSLContext.getInstance("TLS");
                tempContext.init(null, trustAll, new SecureRandom());

                URL url = new URL(urlStr);
                HttpsURLConnection conn = (HttpsURLConnection) url.openConnection();
                conn.setSSLSocketFactory(tempContext.getSocketFactory());
                conn.setHostnameVerifier((hostname, session) -> true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                conn.connect();

                java.security.cert.Certificate[] certs = conn.getServerCertificates();
                conn.disconnect();

                if (certs.length == 0) {
                    call.reject("No certificates returned by server");
                    return;
                }

                X509Certificate cert = (X509Certificate) certs[0];
                String fingerprint = sha256Fingerprint(cert);

                JSObject ret = new JSObject();
                ret.put("fingerprint", fingerprint);
                ret.put("subject", cert.getSubjectX500Principal().getName());
                ret.put("issuer", cert.getIssuerX500Principal().getName());
                ret.put("expiry", cert.getNotAfter().toString());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to get server certificate: " + e.getMessage(), e);
            }
        }).start();
    }

    /**
     * Install a TrustManager that validates certificates against the trusted fingerprint.
     * If no fingerprint is set, accepts all certs (first-use scenario before TOFU dialog).
     * This covers CapacitorHttp requests which use HttpsURLConnection/OkHttp.
     */
    private void installFingerprintTrustManager() {
        try {
            final String fp = this.trustedFingerprint;
            TrustManager[] trustManagers = new TrustManager[]{
                new X509TrustManager() {
                    @Override
                    public void checkClientTrusted(X509Certificate[] chain, String authType) {}

                    @Override
                    public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                        if (fp == null || fp.isEmpty()) {
                            // No fingerprint stored yet — allow connection so the app can
                            // fetch the cert and show the TOFU dialog
                            return;
                        }
                        if (chain == null || chain.length == 0) {
                            throw new CertificateException("No server certificate");
                        }
                        try {
                            String actual = sha256Fingerprint(chain[0]);
                            if (!actual.equals(fp)) {
                                throw new CertificateException(
                                    "Certificate fingerprint mismatch: expected " + fp + ", got " + actual
                                );
                            }
                        } catch (CertificateException ce) {
                            throw ce;
                        } catch (Exception e) {
                            throw new CertificateException("Fingerprint check failed", e);
                        }
                    }

                    @Override
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                }
            };

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustManagers, new SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(sslContext.getSocketFactory());
            HttpsURLConnection.setDefaultHostnameVerifier(new HostnameVerifier() {
                @Override
                public boolean verify(String hostname, SSLSession session) {
                    // Hostname check is relaxed for self-signed certs (they typically
                    // don't have SANs matching the hostname)
                    return enabled;
                }
            });
        } catch (Exception e) {
            // Log but don't crash
        }
    }

    /**
     * Restore the original SSL socket factory and hostname verifier.
     */
    private void restoreOriginalCerts() {
        if (originalSslSocketFactory != null) {
            HttpsURLConnection.setDefaultSSLSocketFactory(originalSslSocketFactory);
        }
        if (originalHostnameVerifier != null) {
            HttpsURLConnection.setDefaultHostnameVerifier(originalHostnameVerifier);
        }
    }

    /**
     * Replace the WebView client with one that validates SSL certificates
     * against the trusted fingerprint. This covers <img src="https://...">,
     * MJPEG streams, and WSS connections in the WebView.
     */
    private void installWebViewSslHandler() {
        final String fp = this.trustedFingerprint;
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
                    @Override
                    public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                        if (!enabled || fp == null || fp.isEmpty()) {
                            handler.cancel();
                            return;
                        }
                        // Validate the certificate fingerprint
                        try {
                            X509Certificate cert = extractX509(error.getCertificate());
                            if (cert != null) {
                                String actual = sha256Fingerprint(cert);
                                if (actual.equals(fp)) {
                                    handler.proceed();
                                    return;
                                }
                            }
                        } catch (Exception e) {
                            // Fall through to cancel
                        }
                        handler.cancel();
                    }
                });
            } catch (Exception e) {
                // Ignore
            }
        });
    }

    /**
     * Restore the default WebView client (strict SSL).
     */
    private void restoreWebViewSslHandler() {
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                webView.setWebViewClient(new BridgeWebViewClient(getBridge()));
            } catch (Exception e) {
                // Ignore
            }
        });
    }

    /**
     * Extract an X509Certificate from Android's SslCertificate.
     * Uses SslCertificate.saveState() to get the raw cert bytes.
     */
    private static X509Certificate extractX509(SslCertificate sslCert) {
        try {
            Bundle bundle = SslCertificate.saveState(sslCert);
            byte[] certBytes = bundle.getByteArray("x509-certificate");
            if (certBytes != null) {
                CertificateFactory cf = CertificateFactory.getInstance("X.509");
                return (X509Certificate) cf.generateCertificate(new ByteArrayInputStream(certBytes));
            }
        } catch (Exception e) {
            // Ignore
        }
        return null;
    }

    /**
     * Compute SHA-256 fingerprint of an X.509 certificate.
     * Returns colon-separated uppercase hex (e.g., "AB:CD:12:...").
     */
    private static String sha256Fingerprint(X509Certificate cert) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] digest = md.digest(cert.getEncoded());
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < digest.length; i++) {
            if (i > 0) sb.append(":");
            sb.append(String.format("%02X", digest[i]));
        }
        return sb.toString();
    }
}

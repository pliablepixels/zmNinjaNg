package com.zoneminder.zmNinjaNG;

import android.app.UiModeManager;
import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean isTV = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SSLTrustPlugin.class);
        registerPlugin(PipPlugin.class);
        registerPlugin(TvDetectorPlugin.class);
        super.onCreate(savedInstanceState);

        isTV = isTVDevice();
        if (isTV) {
            enableSpatialNavigationOnWebView();
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (isTV && event.getAction() == KeyEvent.ACTION_DOWN) {
            String jsKey = mapKeyToJs(event.getKeyCode());
            if (jsKey != null) {
                WebView webView = getBridge().getWebView();
                String js = String.format(
                    "window.dispatchEvent(new KeyboardEvent('keydown', {key:'%s', bubbles:true}));",
                    jsKey
                );
                webView.evaluateJavascript(js, null);
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private String mapKeyToJs(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP:     return "ArrowUp";
            case KeyEvent.KEYCODE_DPAD_DOWN:   return "ArrowDown";
            case KeyEvent.KEYCODE_DPAD_LEFT:   return "ArrowLeft";
            case KeyEvent.KEYCODE_DPAD_RIGHT:  return "ArrowRight";
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:       return "Enter";
            default: return null;
        }
    }

    private boolean isTVDevice() {
        UiModeManager uiModeManager = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
        return uiModeManager != null
            && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
    }

    private void enableSpatialNavigationOnWebView() {
        getBridge().getWebView().post(() -> {
            try {
                WebView webView = getBridge().getWebView();
                java.lang.reflect.Method method = android.webkit.WebSettings.class
                    .getMethod("setSpatialNavigationEnabled", boolean.class);
                method.invoke(webView.getSettings(), true);
                webView.setFocusableInTouchMode(true);
                webView.requestFocus();
            } catch (Exception e) {
                // setSpatialNavigationEnabled not available
            }
        });
    }
}

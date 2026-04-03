package com.zoneminder.zmNinjaNG;

import android.app.UiModeManager;
import android.content.Context;
import android.content.res.Configuration;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;
import java.lang.reflect.Method;

@CapacitorPlugin(name = "TvDetector")
public class TvDetectorPlugin extends Plugin {

    @PluginMethod()
    public void isTV(PluginCall call) {
        UiModeManager uiModeManager = (UiModeManager) getContext().getSystemService(Context.UI_MODE_SERVICE);
        boolean isTV = uiModeManager != null
            && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
        JSObject ret = new JSObject();
        ret.put("isTV", isTV);
        call.resolve(ret);
    }

    @PluginMethod()
    public void enableSpatialNavigation(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                WebSettings settings = webView.getSettings();
                // setSpatialNavigationEnabled is hidden API; use reflection
                Method method = WebSettings.class.getMethod("setSpatialNavigationEnabled", boolean.class);
                method.invoke(settings, true);
                webView.setFocusableInTouchMode(true);
                webView.requestFocus();
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to enable spatial navigation", e);
            }
        });
    }
}

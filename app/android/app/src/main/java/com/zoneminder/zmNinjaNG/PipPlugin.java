package com.zoneminder.zmNinjaNG;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Pip")
public class PipPlugin extends Plugin {

    @PluginMethod
    public void isPipSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O);
        call.resolve(ret);
    }

    @PluginMethod
    public void enterPip(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("PiP requires Android 8.0 (API 26) or higher");
            return;
        }

        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        double positionSec = call.getDouble("position", 0.0);
        long positionMs = (long) (positionSec * 1000);
        String aspectRatio = call.getString("aspectRatio", "16:9");

        Intent intent = new Intent(getContext(), PipActivity.class);
        intent.putExtra("url", url);
        intent.putExtra("position", positionMs);
        intent.putExtra("aspectRatio", aspectRatio);

        startActivityForResult(call, intent, "handlePipResult");
    }

    @ActivityCallback
    private void handlePipResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        JSObject ret = new JSObject();
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            long positionMs = result.getData().getLongExtra("position", 0);
            ret.put("position", positionMs / 1000.0);
        } else {
            ret.put("position", 0);
        }
        call.resolve(ret);
    }
}

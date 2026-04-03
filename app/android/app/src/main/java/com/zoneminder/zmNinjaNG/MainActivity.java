package com.zoneminder.zmNinjaNG;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SSLTrustPlugin.class);
        registerPlugin(PipPlugin.class);
        registerPlugin(TvDetectorPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

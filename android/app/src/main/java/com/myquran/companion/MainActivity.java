package com.myquran.companion;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaPlaybackPlugin.class);
        registerPlugin(CompassPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

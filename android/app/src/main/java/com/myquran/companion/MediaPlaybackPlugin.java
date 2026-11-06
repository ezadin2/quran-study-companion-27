package com.myquran.companion;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges the recitation player to MediaPlaybackService, an Android
 * foreground media service. The service keeps the app process alive while
 * the screen is off, owns the MediaSession (lock screen + notification
 * controls) and handles audio focus (calls, other apps).
 */
@CapacitorPlugin(name = "MediaPlayback")
public class MediaPlaybackPlugin extends Plugin {
    static MediaPlaybackPlugin instance;

    @Override
    public void load() { instance = this; }

    static void emit(String action) {
        MediaPlaybackPlugin p = instance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        p.notifyListeners("action", data, true);
    }

    @PluginMethod
    public void update(PluginCall call) {
        Intent i = new Intent(getContext(), MediaPlaybackService.class);
        i.setAction(MediaPlaybackService.ACTION_UPDATE);
        i.putExtra("title", call.getString("title", "My Quran"));
        i.putExtra("artist", call.getString("artist", ""));
        i.putExtra("playing", Boolean.TRUE.equals(call.getBoolean("playing", false)));
        i.putExtra("position", call.getDouble("position", 0.0));
        i.putExtra("duration", call.getDouble("duration", 0.0));
        try {
            // Android 12+ forbids startForegroundService() from the background (e.g. the next
            // ayah starting with the screen locked). Once the service is running it is already
            // foreground, so a plain startService() delivers the update without that restriction.
            if (MediaPlaybackService.running || Build.VERSION.SDK_INT < 26) getContext().startService(i);
            else getContext().startForegroundService(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Media service could not start: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), MediaPlaybackService.class));
        call.resolve();
    }
}

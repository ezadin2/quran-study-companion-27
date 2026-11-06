package com.myquran.companion;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.view.Surface;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Magnetic compass heading straight from Android's sensors. Many Android
 * WebViews never deliver absolute "deviceorientation" events, which made the
 * Qibla screen report "No compass sensor found" on phones that have one.
 * Emits "heading" events: { heading: degrees from magnetic north, accuracy }.
 */
@CapacitorPlugin(name = "Compass")
public class CompassPlugin extends Plugin implements SensorEventListener {
    private SensorManager sm;
    private boolean running = false;
    private final float[] rot = new float[9];
    private final float[] remapped = new float[9];
    private final float[] orient = new float[3];
    private float[] grav = null;
    private float[] mag = null;
    private int accuracy = SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM;
    private long lastEmit = 0;

    @Override
    public void load() {
        sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", sm != null && (sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) != null
                || sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) != null));
        call.resolve(r);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (sm == null) { call.reject("No sensor service"); return; }
        if (!running) {
            Sensor rv = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
            Sensor m = sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
            if (rv != null) {
                sm.registerListener(this, rv, SensorManager.SENSOR_DELAY_UI);
                if (m != null) sm.registerListener(this, m, SensorManager.SENSOR_DELAY_UI); // accuracy only
            } else if (m != null) {
                Sensor a = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
                if (a == null) { call.reject("No compass sensor"); return; }
                sm.registerListener(this, m, SensorManager.SENSOR_DELAY_UI);
                sm.registerListener(this, a, SensorManager.SENSOR_DELAY_UI);
            } else { call.reject("No compass sensor"); return; }
            running = true;
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (sm != null) sm.unregisterListener(this);
        running = false;
        grav = null; mag = null;
        call.resolve();
    }

    @Override
    protected void handleOnPause() { if (running && sm != null) sm.unregisterListener(this); }

    @Override
    protected void handleOnResume() {
        if (!running || sm == null) return;
        running = false;
        Sensor rv = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        Sensor m = sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        Sensor a = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        if (rv != null) sm.registerListener(this, rv, SensorManager.SENSOR_DELAY_UI);
        if (m != null) sm.registerListener(this, m, SensorManager.SENSOR_DELAY_UI);
        if (rv == null && a != null) sm.registerListener(this, a, SensorManager.SENSOR_DELAY_UI);
        running = true;
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int acc) {
        if (sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) accuracy = acc;
    }

    @Override
    public void onSensorChanged(SensorEvent e) {
        int type = e.sensor.getType();
        boolean haveRot = false;
        if (type == Sensor.TYPE_ROTATION_VECTOR) {
            SensorManager.getRotationMatrixFromVector(rot, e.values);
            haveRot = true;
        } else if (type == Sensor.TYPE_ACCELEROMETER) {
            grav = e.values.clone();
        } else if (type == Sensor.TYPE_MAGNETIC_FIELD) {
            accuracy = e.accuracy;
            mag = e.values.clone();
        }
        if (!haveRot) {
            if (sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) != null) return;
            if (grav == null || mag == null) return;
            if (!SensorManager.getRotationMatrix(rot, null, grav, mag)) return;
        }
        long now = System.currentTimeMillis();
        if (now - lastEmit < 60) return;
        lastEmit = now;

        int rotation = Surface.ROTATION_0;
        try {
            WindowManager wm = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);
            rotation = wm.getDefaultDisplay().getRotation();
        } catch (Exception ignored) { }
        int x = SensorManager.AXIS_X, y = SensorManager.AXIS_Y;
        if (rotation == Surface.ROTATION_90) { x = SensorManager.AXIS_Y; y = SensorManager.AXIS_MINUS_X; }
        else if (rotation == Surface.ROTATION_180) { x = SensorManager.AXIS_MINUS_X; y = SensorManager.AXIS_MINUS_Y; }
        else if (rotation == Surface.ROTATION_270) { x = SensorManager.AXIS_MINUS_Y; y = SensorManager.AXIS_X; }
        SensorManager.remapCoordinateSystem(rot, x, y, remapped);
        SensorManager.getOrientation(remapped, orient);
        double deg = (Math.toDegrees(orient[0]) + 360.0) % 360.0;

        JSObject data = new JSObject();
        data.put("heading", deg);
        data.put("accuracy", accuracy);
        notifyListeners("heading", data);
    }
}

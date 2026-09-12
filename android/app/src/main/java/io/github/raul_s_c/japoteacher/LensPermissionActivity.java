package io.github.raul_s_c.japoteacher;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.projection.MediaProjectionConfig;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;

public class LensPermissionActivity extends Activity {
    private static final int REQUEST_CAPTURE = 4201;
    private boolean requested;
    private boolean overlayRequested;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (savedInstanceState != null) { requested = savedInstanceState.getBoolean("requested"); overlayRequested = savedInstanceState.getBoolean("overlayRequested"); }
    }

    @Override protected void onResume() {
        super.onResume();
        if (requested) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !android.provider.Settings.canDrawOverlays(this)) {
            if (overlayRequested) { finish(); return; }
            overlayRequested = true;
            Toast.makeText(this, "Permite mostrar la lupa sobre otras aplicaciones", Toast.LENGTH_LONG).show();
            startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                android.net.Uri.parse("package:" + getPackageName())));
            return;
        }
        if (FloatingLensService.isReady()) {
            startService(new Intent(this, FloatingLensService.class).setAction(FloatingLensService.ACTION_SHOW_BUBBLE));
            finish(); return;
        }
        requestProjection();
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        state.putBoolean("requested", requested); state.putBoolean("overlayRequested", overlayRequested);
        super.onSaveInstanceState(state);
    }

    private void requestProjection() {
        if (requested) return;
        requested = true;
        MediaProjectionManager manager =
                (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        Intent captureIntent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            captureIntent = manager.createScreenCaptureIntent(
                    MediaProjectionConfig.createConfigForDefaultDisplay()
            );
        } else {
            captureIntent = manager.createScreenCaptureIntent();
        }
        startActivityForResult(captureIntent, REQUEST_CAPTURE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CAPTURE && resultCode == RESULT_OK && data != null) {
            Intent service = new Intent(this, FloatingLensService.class);
            service.setAction(FloatingLensService.ACTION_START_SESSION);
            service.putExtra(FloatingLensService.EXTRA_RESULT_CODE, resultCode);
            service.putExtra(FloatingLensService.EXTRA_RESULT_DATA, data);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(service);
            } else {
                startService(service);
            }
        } else {
            Toast.makeText(this, "La lupa necesita permiso para leer un recorte de la pantalla.", Toast.LENGTH_LONG).show();
        }
        finish();
        overridePendingTransition(0, 0);
    }
}

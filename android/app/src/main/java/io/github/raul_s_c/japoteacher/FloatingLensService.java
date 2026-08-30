package io.github.raul_s_c.japoteacher;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;

public class FloatingLensService extends Service {
    public static final String ACTION_START_SESSION = "io.github.raul_s_c.japoteacher.START_LENS_SESSION";
    public static final String ACTION_SHOW_BUBBLE = "io.github.raul_s_c.japoteacher.SHOW_BUBBLE";
    public static final String ACTION_CAPTURE = "io.github.raul_s_c.japoteacher.CAPTURE_LENS";
    public static final String EXTRA_RESULT_CODE = "projection_result_code";
    public static final String EXTRA_RESULT_DATA = "projection_result_data";
    public static final String EXTRA_CAPTURE_PATH = "lens_capture_path";

    private static final String CHANNEL_ID = "japoteacher_lens";
    private static final int NOTIFICATION_ID = 8201;
    private static volatile boolean ready;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    private View bubble;
    private WindowManager.LayoutParams bubbleParams;
    private MediaProjection projection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private boolean capturePending;

    public static boolean isReady() {
        return ready;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_START_SESSION.equals(action)) {
            int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0);
            Intent resultData = readProjectionIntent(intent);
            if (resultData == null || resultCode == 0) {
                stopSelf();
                return START_NOT_STICKY;
            }
            startProjectionForeground();
            startProjection(resultCode, resultData);
        } else if (ACTION_CAPTURE.equals(action)) {
            requestCapture();
        } else if (ACTION_SHOW_BUBBLE.equals(action)) {
            if (ready) {
                setBubbleVisible(true);
            } else {
                stopSelf();
            }
        } else if (ready) {
            setBubbleVisible(true);
        }
        return START_NOT_STICKY;
    }

    @SuppressWarnings("deprecation")
    private Intent readProjectionIntent(Intent source) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return source.getParcelableExtra(EXTRA_RESULT_DATA, Intent.class);
        }
        return source.getParcelableExtra(EXTRA_RESULT_DATA);
    }

    private void startProjectionForeground() {
        NotificationManager notifications = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Lupa de pantalla",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Mantiene activa la lupa para capturar recortes sin guardarlos en la galería.");
            notifications.createNotificationChannel(channel);
        }
        Intent openIntent = new Intent(this, LauncherActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        Notification notification = builder
                .setSmallIcon(android.R.drawable.ic_menu_search)
                .setContentTitle("Lupa IA activa")
                .setContentText("Toca la lupa flotante para recortar la pantalla")
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void startProjection(int resultCode, Intent resultData) {
        releaseProjection();
        try {
            MediaProjectionManager manager =
                    (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            projection = manager.getMediaProjection(resultCode, resultData);
            if (projection == null) throw new IllegalStateException("Android no devolvió una sesión de captura");

            projection.registerCallback(new MediaProjection.Callback() {
                @Override
                public void onStop() {
                    handler.post(() -> {
                        ready = false;
                        removeBubble();
                        releaseCaptureResources();
                        stopSelf();
                    });
                }
            }, handler);

            int width = getResources().getDisplayMetrics().widthPixels;
            int height = getResources().getDisplayMetrics().heightPixels;
            int density = getResources().getDisplayMetrics().densityDpi;
            imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
            imageReader.setOnImageAvailableListener(this::onImageAvailable, handler);
            virtualDisplay = projection.createVirtualDisplay(
                    "JapoTeacherLens",
                    width,
                    height,
                    density,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                    null,
                    null,
                    handler
            );
            if (virtualDisplay == null) throw new IllegalStateException("No se pudo crear la pantalla de captura");
            ready = true;
            showBubble();
            Toast.makeText(this, "Lupa lista. Abre cualquier app y toca la burbuja.", Toast.LENGTH_LONG).show();
        } catch (Exception error) {
            ready = false;
            Toast.makeText(this, "No se pudo activar la lupa: " + error.getMessage(), Toast.LENGTH_LONG).show();
            stopSelf();
        }
    }

    private void requestCapture() {
        if (!ready || virtualDisplay == null || imageReader == null || capturePending) {
            if (!ready) Toast.makeText(this, "Activa de nuevo la lupa desde JapoTeacher.", Toast.LENGTH_LONG).show();
            return;
        }
        capturePending = true;
        setBubbleVisible(false);
        handler.postDelayed(() -> {
            if (!capturePending || virtualDisplay == null || imageReader == null) return;
            drainImages();
            virtualDisplay.setSurface(imageReader.getSurface());
        }, 180);
        handler.postDelayed(() -> {
            if (!capturePending) return;
            capturePending = false;
            detachCaptureSurface();
            setBubbleVisible(true);
            Toast.makeText(this, "No se pudo congelar la pantalla. Vuelve a tocar la lupa.", Toast.LENGTH_LONG).show();
        }, 3500);
    }

    private void onImageAvailable(ImageReader source) {
        Image image = null;
        try {
            image = source.acquireLatestImage();
            if (image == null) return;
            if (!capturePending) return;
            capturePending = false;
            detachCaptureSurface();
            Bitmap bitmap = imageToBitmap(image);
            File captureFile = new File(getCacheDir(), "lens-capture.jpg");
            try (FileOutputStream stream = new FileOutputStream(captureFile, false)) {
                bitmap.compress(Bitmap.CompressFormat.JPEG, 96, stream);
            }
            bitmap.recycle();
            Intent crop = new Intent(this, LensCaptureActivity.class);
            crop.putExtra(EXTRA_CAPTURE_PATH, captureFile.getAbsolutePath());
            crop.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
            startActivity(crop);
        } catch (Exception error) {
            capturePending = false;
            detachCaptureSurface();
            setBubbleVisible(true);
            Toast.makeText(this, "No se pudo preparar el recorte: " + error.getMessage(), Toast.LENGTH_LONG).show();
        } finally {
            if (image != null) image.close();
        }
    }

    private Bitmap imageToBitmap(Image image) {
        Image.Plane plane = image.getPlanes()[0];
        ByteBuffer buffer = plane.getBuffer();
        int pixelStride = plane.getPixelStride();
        int rowStride = plane.getRowStride();
        int rowPadding = rowStride - pixelStride * image.getWidth();
        Bitmap padded = Bitmap.createBitmap(
                image.getWidth() + rowPadding / pixelStride,
                image.getHeight(),
                Bitmap.Config.ARGB_8888
        );
        padded.copyPixelsFromBuffer(buffer);
        Bitmap exact = Bitmap.createBitmap(padded, 0, 0, image.getWidth(), image.getHeight());
        if (exact != padded) padded.recycle();
        return exact;
    }

    private void drainImages() {
        if (imageReader == null) return;
        Image stale;
        while ((stale = imageReader.acquireNextImage()) != null) stale.close();
    }

    private void detachCaptureSurface() {
        try {
            if (virtualDisplay != null) virtualDisplay.setSurface(null);
        } catch (Exception ignored) {
        }
    }

    private void showBubble() {
        if (bubble != null) {
            bubble.setVisibility(View.VISIBLE);
            return;
        }
        TextView button = new TextView(this);
        button.setText("⌕");
        button.setTextColor(Color.WHITE);
        button.setTextSize(28);
        button.setGravity(Gravity.CENTER);
        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.OVAL);
        background.setColor(Color.rgb(181, 43, 33));
        background.setStroke(dp(2), Color.WHITE);
        button.setBackground(background);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) button.setElevation(dp(8));
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        bubbleParams = new WindowManager.LayoutParams(
                dp(58),
                dp(58),
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT
        );
        bubbleParams.gravity = Gravity.TOP | Gravity.START;
        bubbleParams.x = dp(18);
        bubbleParams.y = dp(180);
        button.setOnTouchListener(new DragTouchListener());
        bubble = button;
        windowManager.addView(bubble, bubbleParams);
    }

    private void setBubbleVisible(boolean visible) {
        if (bubble == null && visible && ready) showBubble();
        if (bubble != null) bubble.setVisibility(visible ? View.VISIBLE : View.GONE);
    }

    private void removeBubble() {
        if (bubble == null) return;
        try {
            windowManager.removeView(bubble);
        } catch (Exception ignored) {
        }
        bubble = null;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void releaseCaptureResources() {
        detachCaptureSurface();
        if (virtualDisplay != null) {
            try { virtualDisplay.release(); } catch (Exception ignored) {}
            virtualDisplay = null;
        }
        if (imageReader != null) {
            try { imageReader.close(); } catch (Exception ignored) {}
            imageReader = null;
        }
    }

    private void releaseProjection() {
        ready = false;
        releaseCaptureResources();
        if (projection != null) {
            try { projection.stop(); } catch (Exception ignored) {}
            projection = null;
        }
    }

    @Override
    public void onDestroy() {
        ready = false;
        capturePending = false;
        removeBubble();
        releaseProjection();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private class DragTouchListener implements View.OnTouchListener {
        private int startX;
        private int startY;
        private float touchX;
        private float touchY;
        private long downAt;
        private boolean moved;

        @Override
        public boolean onTouch(View view, MotionEvent event) {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    startX = bubbleParams.x;
                    startY = bubbleParams.y;
                    touchX = event.getRawX();
                    touchY = event.getRawY();
                    downAt = System.currentTimeMillis();
                    moved = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    int dx = Math.round(event.getRawX() - touchX);
                    int dy = Math.round(event.getRawY() - touchY);
                    if (Math.abs(dx) + Math.abs(dy) > dp(8)) moved = true;
                    bubbleParams.x = startX + dx;
                    bubbleParams.y = startY + dy;
                    windowManager.updateViewLayout(bubble, bubbleParams);
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!moved && System.currentTimeMillis() - downAt < 450) requestCapture();
                    return true;
                default:
                    return false;
            }
        }
    }
}

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
    public static final String ACTION_SHOW_RESULT = "io.github.raul_s_c.japoteacher.SHOW_LENS_RESULT";
    public static final String ACTION_MENU = "io.github.raul_s_c.japoteacher.LENS_MENU";
    public static final String PAYLOAD_FILE = "lens-result.json";
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
    private int captureGeneration;
    private android.widget.LinearLayout resultPanel;
    private android.webkit.WebView resultWebView;
    private WindowManager.LayoutParams resultParams;
    private String resultPayload = "{}";
    private android.app.AlertDialog menu;


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
        } else if (ACTION_SHOW_RESULT.equals(action)) {
            if (ready) showResultPanel(); else stopSelf();
        } else if (ACTION_MENU.equals(action)) {
            if (ready) showMenu(); else stopSelf();
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
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Opciones / cerrar",
                    PendingIntent.getService(this, 8204, new Intent(this, FloatingLensService.class).setAction(ACTION_MENU),
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
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
        hideResult();
        capturePending = true;
        final int generation = ++captureGeneration;
        setBubbleVisible(false);
        handler.postDelayed(() -> {
            if (generation != captureGeneration || !capturePending || virtualDisplay == null || imageReader == null) return;
            drainImages();
            virtualDisplay.setSurface(imageReader.getSurface());
        }, 180);
        handler.postDelayed(() -> {
            if (generation != captureGeneration || !capturePending) return;
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
        button.setContentDescription("Lupa: tocar para recortar; mantener pulsado para opciones y cerrar");
        button.setOnClickListener(v -> requestCapture());
        button.setOnLongClickListener(v -> { showMenu(); return true; });
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
        new File(getCacheDir(), PAYLOAD_FILE).delete();
        handler.removeCallbacksAndMessages(null);
        if (menu != null) menu.dismiss();
        disposeResult();
        removeBubble();
        releaseProjection();
        super.onDestroy();
    }

    @Override public void onConfigurationChanged(android.content.res.Configuration config) {
        super.onConfigurationChanged(config);
        if (ready && virtualDisplay != null) {
            capturePending = false; captureGeneration++; detachCaptureSurface();
            int width = getResources().getDisplayMetrics().widthPixels;
            int height = getResources().getDisplayMetrics().heightPixels;
            ImageReader old = imageReader;
            imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
            imageReader.setOnImageAvailableListener(this::onImageAvailable, handler);
            virtualDisplay.resize(width, height, getResources().getDisplayMetrics().densityDpi);
            if (old != null) old.close();
            if (bubble != null) { constrainBubble(); windowManager.updateViewLayout(bubble, bubbleParams); positionResult(); }
        }
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
                    constrainBubble();
                    windowManager.updateViewLayout(bubble, bubbleParams);
                    positionResult();
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!moved) {
                        if (System.currentTimeMillis() - downAt >= 450) view.performLongClick();
                        else view.performClick();
                    }
                    return true;
                default:
                    return false;
            }
        }
    }

    private int overlayType() {
        return Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
    }

    private void showMenu() {
        if (menu != null && menu.isShowing()) return;
        menu = new android.app.AlertDialog.Builder(this)
            .setTitle("Lupa de lectura")
            .setItems(new String[]{"Nuevo recorte", "Mostrar última traducción", "Ajustes", "Cerrar lupa…"}, (dialog, which) -> {
                if (which == 0) requestCapture();
                if (which == 1 && resultPanel != null) { resultPanel.setVisibility(View.VISIBLE); positionResult(); }
                if (which == 2) { hideResult(); startActivity(new Intent(this, LensSettingsActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
                if (which == 3) handler.post(this::confirmStop);
            }).setNegativeButton("Seguir leyendo", null).create();
        menu.getWindow().setType(overlayType()); menu.show();
    }

    private void confirmStop() {
        menu = new android.app.AlertDialog.Builder(this).setTitle("¿Cerrar la lupa?")
            .setMessage("Se quitarán la burbuja y la traducción. Puedes activarla otra vez desde el widget.")
            .setNegativeButton("Seguir leyendo", null)
            .setPositiveButton("Cerrar lupa", (dialog, which) -> stopSelf()).create();
        menu.getWindow().setType(overlayType()); menu.show();
    }

    private void hideResult() { if (resultPanel != null) resultPanel.setVisibility(View.GONE); }
    private void disposeResult() {
        if (resultPanel != null) { try { windowManager.removeView(resultPanel); } catch (Exception ignored) {} }
        if (resultWebView != null) {
            resultWebView.removeJavascriptInterface("JapoLensHost"); resultWebView.stopLoading(); resultWebView.destroy();
        }
        resultPanel = null; resultWebView = null;
    }

    private void showResultPanel() {
        File file = new File(getCacheDir(), PAYLOAD_FILE);
        try (java.io.FileInputStream stream = new java.io.FileInputStream(file);
             java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int count;
            while ((count = stream.read(buffer)) != -1) bytes.write(buffer, 0, count);
            resultPayload = new String(bytes.toByteArray(), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception error) {
            Toast.makeText(this, "No se pudo abrir el resultado. Repite el recorte.", Toast.LENGTH_LONG).show();
            setBubbleVisible(true); return;
        } finally { file.delete(); }
        disposeResult();
        resultPanel = new android.widget.LinearLayout(this);
        resultPanel.setOrientation(android.widget.LinearLayout.VERTICAL);
        resultPanel.setBackgroundColor(Color.rgb(255, 253, 249));
        resultPanel.setElevation(dp(12));
        resultWebView = new android.webkit.WebView(this);
        android.webkit.WebSettings settings = resultWebView.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
        resultWebView.addJavascriptInterface(new ResultBridge(), "JapoLensHost");
        resultWebView.setWebViewClient(new android.webkit.WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(android.webkit.WebView view, android.webkit.WebResourceRequest request) {
                android.net.Uri uri = request.getUrl();
                return !("https".equals(uri.getScheme()) && "raul-s-c.github.io".equals(uri.getHost())
                    && "/japoteacher/lens-overlay.html".equals(uri.getPath()));
            }
        });
        resultPanel.addView(resultWebView, new android.widget.LinearLayout.LayoutParams(-1, -1));
        resultParams = new WindowManager.LayoutParams(dp(300), dp(390), overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL, PixelFormat.TRANSLUCENT);
        resultParams.gravity = Gravity.TOP | Gravity.START;
        resultParams.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
        windowManager.addView(resultPanel, resultParams);
        setBubbleVisible(true); positionResult();
        resultWebView.loadUrl("https://raul-s-c.github.io/japoteacher/lens-overlay.html?compact=1&nativeVersion=1.3.0&nativeCode=10");
    }

    private void positionResult() {
        if (resultPanel == null || bubbleParams == null) return;
        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        int gap = dp(6), bubbleSize = bubbleParams.width;
        // Keep a readable panel beside the bubble, moving the pair to the nearest edge.
        boolean right = bubbleParams.x < width / 2;
        resultParams.width = Math.min(dp(330), Math.max(dp(180), width - bubbleSize - gap * 3));
        resultParams.height = Math.min(dp(410), height - systemDimension("status_bar_height") - systemDimension("navigation_bar_height") - gap * 2);
        int x = right ? bubbleParams.x + bubbleSize + gap : bubbleParams.x - resultParams.width - gap;
        resultParams.x = Math.max(gap, Math.min(x, width - resultParams.width - gap));
        bubbleParams.x = right ? Math.max(0, resultParams.x - bubbleSize - gap) : Math.min(width - bubbleSize, resultParams.x + resultParams.width + gap);
        windowManager.updateViewLayout(bubble, bubbleParams);
        resultParams.y = Math.max(systemDimension("status_bar_height"), Math.min(bubbleParams.y,
            height - systemDimension("navigation_bar_height") - resultParams.height - gap));
        windowManager.updateViewLayout(resultPanel, resultParams);
    }

    public class ResultBridge {
        @android.webkit.JavascriptInterface public String getPayload() { return resultPayload; }
        @android.webkit.JavascriptInterface public void closeOverlay() { handler.post(() -> { hideResult(); setBubbleVisible(true); }); }
        @android.webkit.JavascriptInterface public void recapture() { handler.post(() -> requestCapture()); }
        @android.webkit.JavascriptInterface public void openSettings() {
            handler.post(() -> { hideResult(); startActivity(new Intent(FloatingLensService.this, LensSettingsActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); });
        }
    }

    private void constrainBubble() {
        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        int statusBar = systemDimension("status_bar_height");
        int navigationBar = systemDimension("navigation_bar_height");
        bubbleParams.x = Math.max(0, Math.min(bubbleParams.x, width - bubbleParams.width));
        bubbleParams.y = Math.max(statusBar, Math.min(
                bubbleParams.y,
                height - navigationBar - bubbleParams.height
        ));
    }

    private int systemDimension(String name) {
        int resource = getResources().getIdentifier(name, "dimen", "android");
        return resource > 0 ? getResources().getDimensionPixelSize(resource) : 0;
    }
}

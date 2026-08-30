package io.github.raul_s_c.japoteacher;

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

public class FloatingLensService extends Service {
    public static final String ACTION_SHOW_BUBBLE = "io.github.raul_s_c.japoteacher.SHOW_BUBBLE";
    private WindowManager windowManager;
    private View bubble;
    private WindowManager.LayoutParams params;

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        showBubble();
    }

    private void showBubble() {
        if (bubble != null) return;
        TextView button = new TextView(this);
        button.setText("⌕");
        button.setTextColor(Color.WHITE);
        button.setTextSize(28);
        button.setGravity(Gravity.CENTER);
        button.setBackgroundColor(Color.rgb(181, 43, 33));
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        params = new WindowManager.LayoutParams(
                dp(58),
                dp(58),
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = dp(18);
        params.y = dp(180);
        button.setOnTouchListener(new DragTouchListener());
        bubble = button;
        windowManager.addView(bubble, params);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onDestroy() {
        if (bubble != null) {
            windowManager.removeView(bubble);
            bubble = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (ACTION_SHOW_BUBBLE.equals(intent != null ? intent.getAction() : null) && bubble != null) {
            bubble.setVisibility(View.VISIBLE);
        }
        return START_STICKY;
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
                    startX = params.x;
                    startY = params.y;
                    touchX = event.getRawX();
                    touchY = event.getRawY();
                    downAt = System.currentTimeMillis();
                    moved = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    int dx = Math.round(event.getRawX() - touchX);
                    int dy = Math.round(event.getRawY() - touchY);
                    if (Math.abs(dx) + Math.abs(dy) > dp(8)) moved = true;
                    params.x = startX + dx;
                    params.y = startY + dy;
                    windowManager.updateViewLayout(bubble, params);
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!moved && System.currentTimeMillis() - downAt < 450) {
                        view.setVisibility(View.GONE);
                        Intent intent = new Intent(FloatingLensService.this, LensCaptureActivity.class);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    }
                    return true;
                default:
                    return false;
            }
        }
    }
}

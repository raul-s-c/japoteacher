package io.github.raul_s_c.japoteacher;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Bundle;
import android.util.Base64;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions;

import java.io.ByteArrayOutputStream;
import java.io.File;

public class LensCaptureActivity extends Activity {
    private FrameLayout root;
    private Bitmap screenBitmap;
    private Bitmap cropBitmap;
    private EditText contextInput;
    private String capturePath;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        overridePendingTransition(0, 0);
        root = new FrameLayout(this);
        setContentView(root);
        installSafeAreaHandling();
        capturePath = getIntent().getStringExtra(FloatingLensService.EXTRA_CAPTURE_PATH);
        screenBitmap = capturePath == null ? null : BitmapFactory.decodeFile(capturePath);
        if (screenBitmap == null) {
            Toast.makeText(this, "No se pudo abrir la captura. Vuelve a tocar la lupa.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        showCropper();
    }

    private void showCropper() {
        hideKeyboard();
        root.removeAllViews();
        CropView cropView = new CropView(this, screenBitmap);
        root.addView(cropView, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(12), dp(10), dp(12), dp(10));
        toolbar.setBackgroundColor(Color.argb(238, 20, 20, 20));

        TextView title = new TextView(this);
        title.setText("Recortar");
        title.setTextColor(Color.WHITE);
        title.setTextSize(16);
        title.setGravity(Gravity.CENTER_VERTICAL);

        Button cancel = button("Cancelar");
        Button capture = button("Leer");
        cancel.setOnClickListener(v -> finish());
        capture.setOnClickListener(v -> {
            cropBitmap = cropView.crop();
            runOcr();
        });

        toolbar.addView(title, new LinearLayout.LayoutParams(0, dp(52), 1));
        toolbar.addView(cancel);
        toolbar.addView(capture);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(-1, dp(76));
        params.gravity = Gravity.BOTTOM;
        root.addView(toolbar, params);
    }

    private Button button(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        return button;
    }

    private void runOcr() {
        if (cropBitmap == null) return;
        showLoading("Leyendo japonés en el móvil...");
        InputImage image = InputImage.fromBitmap(cropBitmap, 0);
        TextRecognition.getClient(new JapaneseTextRecognizerOptions.Builder().build())
                .process(image)
                .addOnSuccessListener(this::showResult)
                .addOnFailureListener(error -> {
                    Toast.makeText(this, "OCR local fallido: " + error.getMessage(), Toast.LENGTH_LONG).show();
                    showResult(null);
                });
    }

    private void showLoading(String message) {
        root.removeAllViews();
        root.setBackgroundColor(Color.rgb(247, 245, 240));
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(dp(24), dp(24), dp(24), dp(24));
        ProgressBar progress = new ProgressBar(this);
        TextView label = new TextView(this);
        label.setText(message);
        label.setTextSize(18);
        label.setTextColor(Color.rgb(34, 34, 34));
        label.setGravity(Gravity.CENTER);
        layout.addView(progress);
        layout.addView(label);
        root.addView(layout, new FrameLayout.LayoutParams(-1, -1));
    }

    private void showResult(Text result) {
        String ocrText = result == null ? "" : result.getText().trim();
        root.removeAllViews();
        root.setBackgroundColor(Color.rgb(247, 245, 240));

        LinearLayout shell = new LinearLayout(this);
        shell.setOrientation(LinearLayout.VERTICAL);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(18), dp(18), dp(18), dp(12));

        TextView title = new TextView(this);
        title.setText("Texto detectado");
        title.setTextSize(22);
        title.setTextColor(Color.rgb(34, 34, 34));
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);

        EditText detected = new EditText(this);
        detected.setText(ocrText);
        detected.setMinLines(4);
        detected.setMaxLines(10);
        detected.setGravity(Gravity.TOP);
        detected.setTextSize(18);

        contextInput = new EditText(this);
        contextInput.setHint("Contexto opcional: noticia, manga, menú, app...");
        contextInput.setSingleLine(false);
        contextInput.setMinLines(2);

        RadioGroup mode = new RadioGroup(this);
        mode.setOrientation(RadioGroup.VERTICAL);
        RadioButton textOnly = new RadioButton(this);
        textOnly.setText("Solo texto OCR: no enviar imagen");
        textOnly.setId(1);
        RadioButton withVision = new RadioButton(this);
        withVision.setText("Texto + recorte: usar visión si hace falta");
        withVision.setId(2);
        mode.addView(textOnly);
        mode.addView(withVision);
        mode.check(1);

        LinearLayout actions = new LinearLayout(this);
        actions.setGravity(Gravity.CENTER_VERTICAL);
        actions.setPadding(dp(12), dp(8), dp(12), dp(10));
        actions.setBackgroundColor(Color.rgb(247, 245, 240));
        Button retry = button("Reajustar");
        Button send = button("Usar texto");
        retry.setOnClickListener(v -> {
            hideKeyboard();
            showCropper();
        });
        send.setOnClickListener(v -> {
            String imageData = mode.getCheckedRadioButtonId() == 2 ? bitmapDataUrl(cropBitmap) : "";
            LauncherActivity.openWithLensResult(
                    this,
                    detected.getText().toString().trim(),
                    imageData,
                    contextInput.getText().toString().trim()
            );
            finish();
        });
        LinearLayout.LayoutParams actionParams = new LinearLayout.LayoutParams(0, dp(54), 1);
        actionParams.setMarginEnd(dp(6));
        actions.addView(retry, actionParams);
        LinearLayout.LayoutParams sendParams = new LinearLayout.LayoutParams(0, dp(54), 1);
        sendParams.setMarginStart(dp(6));
        actions.addView(send, sendParams);

        content.addView(title);
        content.addView(detected, new LinearLayout.LayoutParams(-1, -2));
        content.addView(contextInput);
        content.addView(mode);
        scroll.addView(content, new ScrollView.LayoutParams(-1, -2));
        shell.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        shell.addView(actions, new LinearLayout.LayoutParams(-1, -2));
        root.addView(shell, new FrameLayout.LayoutParams(-1, -1));
    }

    private void installSafeAreaHandling() {
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int left;
            int top;
            int right;
            int bottom;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                android.graphics.Insets safe = insets.getInsets(
                        WindowInsets.Type.systemBars()
                                | WindowInsets.Type.displayCutout()
                                | WindowInsets.Type.ime()
                );
                left = safe.left;
                top = safe.top;
                right = safe.right;
                bottom = safe.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(left, top, right, bottom);
            return insets;
        });
        root.requestApplyInsets();
    }

    private void hideKeyboard() {
        View focused = getCurrentFocus();
        if (focused != null) {
            InputMethodManager keyboard = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            keyboard.hideSoftInputFromWindow(focused.getWindowToken(), 0);
            focused.clearFocus();
        }
    }

    private String bitmapDataUrl(Bitmap bitmap) {
        if (bitmap == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.JPEG, 82, out);
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        Intent intent = new Intent(this, FloatingLensService.class);
        intent.setAction(FloatingLensService.ACTION_SHOW_BUBBLE);
        startService(intent);
        if (capturePath != null) new File(capturePath).delete();
        if (cropBitmap != null && !cropBitmap.isRecycled()) cropBitmap.recycle();
        if (screenBitmap != null && !screenBitmap.isRecycled()) screenBitmap.recycle();
        super.onDestroy();
        overridePendingTransition(0, 0);
    }

    private static class CropView extends View {
        private final Bitmap bitmap;
        private final Paint dimPaint = new Paint();
        private final Paint framePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint handlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Matrix matrix = new Matrix();
        private final RectF imageRect = new RectF();
        private final RectF selection = new RectF();
        private float lastX;
        private float lastY;
        private int touchMode;

        CropView(Context context, Bitmap bitmap) {
            super(context);
            this.bitmap = bitmap;
            dimPaint.setColor(Color.argb(145, 0, 0, 0));
            framePaint.setColor(Color.WHITE);
            framePaint.setStyle(Paint.Style.STROKE);
            framePaint.setStrokeWidth(5f);
            handlePaint.setColor(Color.rgb(181, 43, 33));
        }

        @Override
        protected void onSizeChanged(int w, int h, int oldw, int oldh) {
            float scale = Math.min((float) w / bitmap.getWidth(), (float) h / bitmap.getHeight());
            float dx = (w - bitmap.getWidth() * scale) / 2f;
            float dy = (h - bitmap.getHeight() * scale) / 2f;
            matrix.setScale(scale, scale);
            matrix.postTranslate(dx, dy);
            imageRect.set(dx, dy, dx + bitmap.getWidth() * scale, dy + bitmap.getHeight() * scale);
            selection.set(
                    imageRect.left + imageRect.width() * .08f,
                    imageRect.top + imageRect.height() * .18f,
                    imageRect.right - imageRect.width() * .08f,
                    imageRect.top + imageRect.height() * .52f
            );
        }

        @Override
        protected void onDraw(Canvas canvas) {
            canvas.drawColor(Color.BLACK);
            canvas.drawBitmap(bitmap, matrix, null);
            canvas.drawRect(0, 0, getWidth(), selection.top, dimPaint);
            canvas.drawRect(0, selection.bottom, getWidth(), getHeight(), dimPaint);
            canvas.drawRect(0, selection.top, selection.left, selection.bottom, dimPaint);
            canvas.drawRect(selection.right, selection.top, getWidth(), selection.bottom, dimPaint);
            canvas.drawRect(selection, framePaint);
            float radius = 14f;
            canvas.drawCircle(selection.left, selection.top, radius, handlePaint);
            canvas.drawCircle(selection.right, selection.top, radius, handlePaint);
            canvas.drawCircle(selection.left, selection.bottom, radius, handlePaint);
            canvas.drawCircle(selection.right, selection.bottom, radius, handlePaint);
        }

        @Override
        public boolean onTouchEvent(MotionEvent event) {
            float x = event.getX();
            float y = event.getY();
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    lastX = x;
                    lastY = y;
                    touchMode = edgeMode(x, y);
                    if (touchMode == 0 && !selection.contains(x, y)) return false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = x - lastX;
                    float dy = y - lastY;
                    if (touchMode == 0) selection.offset(dx, dy);
                    if ((touchMode & 1) != 0) selection.left += dx;
                    if ((touchMode & 2) != 0) selection.right += dx;
                    if ((touchMode & 4) != 0) selection.top += dy;
                    if ((touchMode & 8) != 0) selection.bottom += dy;
                    constrain();
                    lastX = x;
                    lastY = y;
                    invalidate();
                    return true;
                default:
                    return true;
            }
        }

        private int edgeMode(float x, float y) {
            float edge = 50f;
            int value = 0;
            if (Math.abs(x - selection.left) < edge && y > selection.top - edge && y < selection.bottom + edge) value |= 1;
            if (Math.abs(x - selection.right) < edge && y > selection.top - edge && y < selection.bottom + edge) value |= 2;
            if (Math.abs(y - selection.top) < edge && x > selection.left - edge && x < selection.right + edge) value |= 4;
            if (Math.abs(y - selection.bottom) < edge && x > selection.left - edge && x < selection.right + edge) value |= 8;
            return value;
        }

        private void constrain() {
            float min = 80f;
            if (selection.width() < min) selection.right = selection.left + min;
            if (selection.height() < min) selection.bottom = selection.top + min;
            if (selection.left < imageRect.left) selection.offset(imageRect.left - selection.left, 0);
            if (selection.top < imageRect.top) selection.offset(0, imageRect.top - selection.top);
            if (selection.right > imageRect.right) selection.offset(imageRect.right - selection.right, 0);
            if (selection.bottom > imageRect.bottom) selection.offset(0, imageRect.bottom - selection.bottom);
        }

        Bitmap crop() {
            Matrix inverse = new Matrix();
            matrix.invert(inverse);
            RectF source = new RectF(selection);
            inverse.mapRect(source);
            int left = Math.max(0, Math.round(source.left));
            int top = Math.max(0, Math.round(source.top));
            int right = Math.min(bitmap.getWidth(), Math.round(source.right));
            int bottom = Math.min(bitmap.getHeight(), Math.round(source.bottom));
            return Bitmap.createBitmap(bitmap, left, top, Math.max(1, right - left), Math.max(1, bottom - top));
        }
    }
}

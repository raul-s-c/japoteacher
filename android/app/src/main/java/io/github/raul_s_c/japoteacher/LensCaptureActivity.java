package io.github.raul_s_c.japoteacher;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ImageFormat;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

public class LensCaptureActivity extends Activity {
    private static final int REQUEST_CAPTURE = 4201;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private FrameLayout root;
    private ProgressBar progress;
    private Bitmap screenBitmap;
    private Bitmap cropBitmap;
    private String ocrText = "";
    private EditText contextInput;
    private boolean shouldRestoreBubble = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        setContentView(root);
        showLoading("Pidiendo permiso para capturar pantalla...");
        MediaProjectionManager manager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_CAPTURE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_CAPTURE || resultCode != RESULT_OK || data == null) {
            finish();
            return;
        }
        captureScreen(resultCode, data);
    }

    private void showLoading(String message) {
        root.removeAllViews();
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(dp(24), dp(24), dp(24), dp(24));
        progress = new ProgressBar(this);
        TextView label = new TextView(this);
        label.setText(message);
        label.setTextSize(18);
        label.setTextColor(Color.rgb(34, 34, 34));
        label.setGravity(Gravity.CENTER);
        layout.addView(progress);
        layout.addView(label);
        root.addView(layout, new FrameLayout.LayoutParams(-1, -1));
    }

    private void captureScreen(int resultCode, Intent data) {
        root.removeAllViews();
        root.setBackgroundColor(Color.TRANSPARENT);
        MediaProjectionManager manager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        MediaProjection projection = manager.getMediaProjection(resultCode, data);
        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        int density = getResources().getDisplayMetrics().densityDpi;
        ImageReader reader = ImageReader.newInstance(width, height, ImageFormat.FLEX_RGBA_8888, 2);
        VirtualDisplay display = projection.createVirtualDisplay(
                "JapoTeacherLens",
                width,
                height,
                density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                reader.getSurface(),
                null,
                handler
        );
        handler.postDelayed(() -> {
            Image image = null;
            try {
                image = reader.acquireLatestImage();
                if (image == null) {
                    Toast.makeText(this, "No se pudo leer la captura.", Toast.LENGTH_LONG).show();
                    finish();
                    return;
                }
                screenBitmap = imageToBitmap(image);
                showCropper();
            } catch (Exception error) {
                Toast.makeText(this, "Error capturando pantalla: " + error.getMessage(), Toast.LENGTH_LONG).show();
                finish();
            } finally {
                if (image != null) image.close();
                display.release();
                reader.close();
                projection.stop();
            }
        }, 850);
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
        return Bitmap.createBitmap(padded, 0, 0, image.getWidth(), image.getHeight());
    }

    private void showCropper() {
        root.removeAllViews();
        CropView cropView = new CropView(this, screenBitmap);
        root.addView(cropView, new FrameLayout.LayoutParams(-1, -1));
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(12), dp(12), dp(12), dp(12));
        toolbar.setBackgroundColor(Color.argb(230, 20, 20, 20));
        TextView title = new TextView(this);
        title.setText("Ajusta el recorte");
        title.setTextColor(Color.WHITE);
        title.setTextSize(16);
        title.setGravity(Gravity.CENTER_VERTICAL);
        Button cancel = button("Cancelar");
        Button capture = button("Capturar");
        cancel.setOnClickListener(v -> finish());
        capture.setOnClickListener(v -> {
            cropBitmap = cropView.crop();
            runOcr();
        });
        toolbar.addView(title, new LinearLayout.LayoutParams(0, dp(48), 1));
        toolbar.addView(cancel);
        toolbar.addView(capture);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(-1, dp(72));
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

    private void showResult(Text result) {
        ocrText = result == null ? "" : result.getText().trim();
        root.removeAllViews();
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(18), dp(18), dp(18), dp(18));
        layout.setBackgroundColor(Color.rgb(247, 245, 240));

        TextView title = new TextView(this);
        title.setText("Texto detectado");
        title.setTextSize(22);
        title.setTextColor(Color.rgb(34, 34, 34));
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);

        EditText detected = new EditText(this);
        detected.setText(ocrText);
        detected.setMinLines(5);
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
        actions.setGravity(Gravity.END);
        Button retry = button("Repetir");
        Button send = button("Enviar a Lupa IA");
        retry.setOnClickListener(v -> showCropper());
        send.setOnClickListener(v -> {
            ocrText = detected.getText().toString().trim();
            String imageData = mode.getCheckedRadioButtonId() == 2 ? bitmapDataUrl(cropBitmap) : "";
            shouldRestoreBubble = false;
            LauncherActivity.openWithLensResult(this, ocrText, imageData, contextInput.getText().toString().trim());
            finish();
        });
        actions.addView(retry);
        actions.addView(send);

        layout.addView(title);
        layout.addView(detected, new LinearLayout.LayoutParams(-1, 0, 1));
        layout.addView(contextInput);
        layout.addView(mode);
        layout.addView(actions);
        root.addView(layout, new FrameLayout.LayoutParams(-1, -1));
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
        if (shouldRestoreBubble) {
            Intent intent = new Intent(this, FloatingLensService.class);
            intent.setAction(FloatingLensService.ACTION_SHOW_BUBBLE);
            startService(intent);
        }
        super.onDestroy();
    }

    private static class CropView extends View {
        private final Bitmap bitmap;
        private final Paint dimPaint = new Paint();
        private final Paint framePaint = new Paint();
        private final Matrix matrix = new Matrix();
        private final RectF imageRect = new RectF();
        private final RectF selection = new RectF();
        private float lastX;
        private float lastY;
        private int mode;

        CropView(Context context, Bitmap bitmap) {
            super(context);
            this.bitmap = bitmap;
            dimPaint.setColor(Color.argb(130, 0, 0, 0));
            framePaint.setColor(Color.rgb(181, 43, 33));
            framePaint.setStyle(Paint.Style.STROKE);
            framePaint.setStrokeWidth(5f);
        }

        @Override
        protected void onSizeChanged(int w, int h, int oldw, int oldh) {
            float scale = Math.min((float) w / bitmap.getWidth(), (float) h / bitmap.getHeight());
            float dx = (w - bitmap.getWidth() * scale) / 2f;
            float dy = (h - bitmap.getHeight() * scale) / 2f;
            matrix.setScale(scale, scale);
            matrix.postTranslate(dx, dy);
            imageRect.set(dx, dy, dx + bitmap.getWidth() * scale, dy + bitmap.getHeight() * scale);
            selection.set(imageRect.left + w * .08f, imageRect.top + h * .22f, imageRect.right - w * .08f, imageRect.top + h * .55f);
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
        }

        @Override
        public boolean onTouchEvent(MotionEvent event) {
            float x = event.getX();
            float y = event.getY();
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    lastX = x;
                    lastY = y;
                    mode = edgeMode(x, y);
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = x - lastX;
                    float dy = y - lastY;
                    if (mode == 0) selection.offset(dx, dy);
                    if ((mode & 1) != 0) selection.left += dx;
                    if ((mode & 2) != 0) selection.right += dx;
                    if ((mode & 4) != 0) selection.top += dy;
                    if ((mode & 8) != 0) selection.bottom += dy;
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
            float edge = 42f;
            int value = 0;
            if (Math.abs(x - selection.left) < edge) value |= 1;
            if (Math.abs(x - selection.right) < edge) value |= 2;
            if (Math.abs(y - selection.top) < edge) value |= 4;
            if (Math.abs(y - selection.bottom) < edge) value |= 8;
            return value;
        }

        private void constrain() {
            if (selection.width() < 80) selection.right = selection.left + 80;
            if (selection.height() < 80) selection.bottom = selection.top + 80;
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

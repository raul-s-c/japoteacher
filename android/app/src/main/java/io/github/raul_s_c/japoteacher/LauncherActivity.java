package io.github.raul_s_c.japoteacher;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import org.json.JSONObject;

public class LauncherActivity extends Activity {
    public static final String APP_URL = "https://raul-s-c.github.io/japoteacher/?nativeVersion=1.2.1&nativeCode=7";
    private static WebView webView;
    private ProgressBar progress;
    private String pendingLensPayload;

    public static void openWithLensResult(Context context, String text, String imageDataUrl, String contextLabel) {
        Intent intent = new Intent(context, LauncherActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("lens_text", text);
        intent.putExtra("lens_image", imageDataUrl);
        intent.putExtra("lens_context", contextLabel);
        context.startActivity(intent);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        buildLayout();
        configureWebView();
        handleIntent(getIntent());
        webView.loadUrl(APP_URL + "#lupa");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
        deliverPendingLensPayload();
    }

    private void buildLayout() {
        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleLarge);
        progress.setIndeterminate(true);
        FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        );
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(96, 96);
        progressParams.gravity = android.view.Gravity.CENTER;
        root.addView(webView, webParams);
        root.addView(progress, progressParams);
        setContentView(root);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);
        webView.addJavascriptInterface(new NativeBridge(), "JapoNativeAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                deliverPendingLensPayload();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && "raul-s-c.github.io".equals(uri.getHost())) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }
        });
    }

    private void handleIntent(Intent intent) {
        if (intent == null || !intent.hasExtra("lens_text")) return;
        try {
            JSONObject payload = new JSONObject();
            payload.put("text", intent.getStringExtra("lens_text"));
            payload.put("imageDataUrl", intent.getStringExtra("lens_image"));
            payload.put("context", intent.getStringExtra("lens_context"));
            payload.put("source", "android_overlay");
            pendingLensPayload = payload.toString();
        } catch (Exception error) {
            pendingLensPayload = null;
        }
    }

    private void deliverPendingLensPayload() {
        if (pendingLensPayload == null || webView == null) return;
        String script = "window.JapoNativeLens&&window.JapoNativeLens.receiveCapture(" + pendingLensPayload + ")";
        webView.evaluateJavascript(script, null);
        pendingLensPayload = null;
    }

    private boolean canDrawOverlays() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this);
    }

    private void requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        }
    }

    public class NativeBridge {
        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public boolean canUseFloatingLens() {
            return canDrawOverlays();
        }

        @JavascriptInterface
        public void startFloatingLens() {
            runOnUiThread(() -> {
                if (!canDrawOverlays()) {
                    Toast.makeText(LauncherActivity.this, "Activa el permiso de burbuja flotante y vuelve a pulsar.", Toast.LENGTH_LONG).show();
                    requestOverlayPermission();
                    return;
                }
                if (FloatingLensService.isReady()) {
                    Intent service = new Intent(LauncherActivity.this, FloatingLensService.class);
                    service.setAction(FloatingLensService.ACTION_SHOW_BUBBLE);
                    startService(service);
                    Toast.makeText(LauncherActivity.this, "La lupa ya está activa.", Toast.LENGTH_SHORT).show();
                    return;
                }
                startActivity(new Intent(LauncherActivity.this, LensPermissionActivity.class));
            });
        }

        @JavascriptInterface
        public void stopFloatingLens() {
            runOnUiThread(() -> {
                stopService(new Intent(LauncherActivity.this, FloatingLensService.class));
                Toast.makeText(LauncherActivity.this, "Lupa flotante desactivada.", Toast.LENGTH_SHORT).show();
            });
        }

        @JavascriptInterface
        public void captureNow() {
            runOnUiThread(() -> {
                if (!FloatingLensService.isReady()) {
                    startActivity(new Intent(LauncherActivity.this, LensPermissionActivity.class));
                    return;
                }
                Intent service = new Intent(LauncherActivity.this, FloatingLensService.class);
                service.setAction(FloatingLensService.ACTION_CAPTURE);
                startService(service);
            });
        }
    }
}

package io.github.raul_s_c.japoteacher;

import android.app.Activity;
import android.os.Bundle;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.*;

/** Device-local capture choices, shared by the widget, bubble and main app. */
public class LensSettingsActivity extends Activity {
    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("lens_capture", MODE_PRIVATE);
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        SharedPreferences prefs = preferences(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int padding = Math.round(20 * getResources().getDisplayMetrics().density);
        content.setPadding(padding, padding, padding, padding);
        TextView title = new TextView(this); title.setText("Lupa · lectura continua"); title.setTextSize(23);
        content.addView(title);
        Switch quick = new Switch(this);
        quick.setText("Traducir al pulsar Leer, sin más preguntas");
        quick.setChecked(prefs.getBoolean("quick", false)); content.addView(quick);
        RadioGroup modes = new RadioGroup(this);
        RadioButton text = new RadioButton(this); text.setId(1); text.setText("OCR local: enviar solo el texto");
        RadioButton vision = new RadioButton(this); vision.setId(2); vision.setText("Visión: enviar también el recorte");
        modes.addView(text); modes.addView(vision); modes.check(prefs.getBoolean("vision", false) ? 2 : 1);
        content.addView(modes);
        EditText context = new EditText(this); context.setHint("Contexto habitual, por ejemplo manga");
        context.setText(prefs.getString("context", "")); content.addView(context);
        TextView note = new TextView(this);
        note.setText("El modo rápido usa esta elección en todos los recortes. OCR nunca envía la imagen. Si no detecta texto, podrás corregirlo o elegir visión. Android pide permiso al iniciar cada sesión de pantalla.\n\nMantén pulsada la burbuja para abrir el menú. Cerrar lupa requiere confirmación; minimizar el resultado mantiene la sesión activa.");
        content.addView(note);
        Button save = new Button(this); save.setText("Guardar"); content.addView(save);
        save.setOnClickListener(v -> {
            prefs.edit().putBoolean("quick", quick.isChecked()).putBoolean("vision", modes.getCheckedRadioButtonId() == 2)
                .putString("context", context.getText().toString().trim()).apply();
            Toast.makeText(this, "Preferencias de lupa guardadas", Toast.LENGTH_SHORT).show(); finish();
        });
        ScrollView scroll = new ScrollView(this); scroll.addView(content); setContentView(scroll);
        scroll.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout() | android.view.WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        scroll.requestApplyInsets();
    }
}

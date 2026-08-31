package com.myscheduler.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri target = Uri.parse(BuildConfig.MYSCHEDULER_URL);
                Uri requested = Uri.parse(url);
                if (target.getHost() != null && target.getHost().equals(requested.getHost())) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, requested));
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.postDelayed(MainActivity.this::syncWidgetSummary, 1800);
            }
        });
        webView.loadUrl(BuildConfig.MYSCHEDULER_URL);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.postDelayed(this::syncWidgetSummary, 800);
    }

    private void syncWidgetSummary() {
        if (webView == null) return;
        webView.evaluateJavascript(
            "(() => document.querySelector('.top-summary')?.textContent?.trim() || '예정된 일정이 없습니다')()",
            value -> {
                String text = value == null ? "예정된 일정이 없습니다" : value;
                if (text.startsWith("\"") && text.endsWith("\"")) text = text.substring(1, text.length() - 1);
                text = text.replace("\\u0026", "&").replace("\\\"", "\"");
                getSharedPreferences("widget", Context.MODE_PRIVATE).edit().putString("next_event", text).apply();
                AppWidgetManager manager = AppWidgetManager.getInstance(this);
                int[] ids = manager.getAppWidgetIds(new ComponentName(this, NextEventWidgetProvider.class));
                Intent update = new Intent(this, NextEventWidgetProvider.class);
                update.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                update.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                sendBroadcast(update);
            }
        );
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}

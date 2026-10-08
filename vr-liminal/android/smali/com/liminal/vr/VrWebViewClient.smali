# Отдаёт файлы приложения из assets/ через виртуальный https-хост.
# Так страница получает безопасный контекст (нужен для камеры и гироскопа) и может грузить wasm/tflite через fetch.
.class public Lcom/liminal/vr/VrWebViewClient;
.super Landroid/webkit/WebViewClient;
.source "VrWebViewClient.java"


# instance fields
.field private final ctx:Landroid/content/Context;


# direct methods
.method public constructor <init>(Landroid/content/Context;)V
    .locals 0
    .param p1, "context"

    invoke-direct {p0}, Landroid/webkit/WebViewClient;-><init>()V

    iput-object p1, p0, Lcom/liminal/vr/VrWebViewClient;->ctx:Landroid/content/Context;

    return-void
.end method

.method public static mimeFor(Ljava/lang/String;)Ljava/lang/String;
    .locals 2
    .param p0, "name"

    const-string v0, ".html"

    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z

    move-result v1

    if-eqz v1, :n_html

    const-string v0, "text/html"

    return-object v0

    :n_html
    const-string v0, ".js"

    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z

    move-result v1

    if-eqz v1, :n_js

    const-string v0, "application/javascript"

    return-object v0

    :n_js
    const-string v0, ".css"

    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z

    move-result v1

    if-eqz v1, :n_css

    const-string v0, "text/css"

    return-object v0

    :n_css
    const-string v0, ".wasm"

    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z

    move-result v1

    if-eqz v1, :n_wasm

    const-string v0, "application/wasm"

    return-object v0

    :n_wasm
    const-string v0, ".png"

    invoke-virtual {p0, v0}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z

    move-result v1

    if-eqz v1, :n_other

    const-string v0, "image/png"

    return-object v0

    :n_other
    const-string v0, "application/octet-stream"

    return-object v0
.end method


# virtual methods
.method public shouldInterceptRequest(Landroid/webkit/WebView;Landroid/webkit/WebResourceRequest;)Landroid/webkit/WebResourceResponse;
    .locals 5
    .param p1, "view"
    .param p2, "request"

    invoke-virtual {p2}, Landroid/webkit/WebResourceRequest;->getUrl()Landroid/net/Uri;

    move-result-object v0

    invoke-virtual {v0}, Landroid/net/Uri;->getHost()Ljava/lang/String;

    move-result-object v1

    const-string v2, "appassets.androidplatform.net"

    invoke-virtual {v2, v1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v2

    if-eqz v2, :block

    invoke-virtual {v0}, Landroid/net/Uri;->getPath()Ljava/lang/String;

    move-result-object v1

    if-eqz v1, :block

    # путь без ведущего "/"
    invoke-virtual {v1}, Ljava/lang/String;->length()I

    move-result v2

    const/4 v3, 0x1

    if-le v2, v3, :root

    invoke-virtual {v1, v3}, Ljava/lang/String;->substring(I)Ljava/lang/String;

    move-result-object v1

    goto :open

    :root
    const-string v1, "index.html"

    :open
    iget-object v2, p0, Lcom/liminal/vr/VrWebViewClient;->ctx:Landroid/content/Context;

    invoke-virtual {v2}, Landroid/content/Context;->getAssets()Landroid/content/res/AssetManager;

    move-result-object v2

    :try_start_0
    invoke-virtual {v2, v1}, Landroid/content/res/AssetManager;->open(Ljava/lang/String;)Ljava/io/InputStream;

    move-result-object v3
    :try_end_0
    .catch Ljava/io/IOException; {:try_start_0 .. :try_end_0} :catch_io

    invoke-static {v1}, Lcom/liminal/vr/VrWebViewClient;->mimeFor(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v4

    new-instance v0, Landroid/webkit/WebResourceResponse;

    const-string v2, "UTF-8"

    invoke-direct {v0, v4, v2, v3}, Landroid/webkit/WebResourceResponse;-><init>(Ljava/lang/String;Ljava/lang/String;Ljava/io/InputStream;)V

    return-object v0

    :catch_io
    move-exception v3

    :block
    const/4 v0, 0x0

    return-object v0
.end method

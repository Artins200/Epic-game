# Автоматически выдаёт WebView доступ к камере (сама камера запрашивается Activity через Android-разрешение).
.class public Lcom/liminal/vr/VrWebChromeClient;
.super Landroid/webkit/WebChromeClient;
.source "VrWebChromeClient.java"


# direct methods
.method public constructor <init>()V
    .locals 0

    invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V

    return-void
.end method


# virtual methods
.method public onPermissionRequest(Landroid/webkit/PermissionRequest;)V
    .locals 1
    .param p1, "request"

    invoke-virtual {p1}, Landroid/webkit/PermissionRequest;->getResources()[Ljava/lang/String;

    move-result-object v0

    invoke-virtual {p1, v0}, Landroid/webkit/PermissionRequest;->grant([Ljava/lang/String;)V

    return-void
.end method

# Liminal VR — офлайн-VR в одном APK

Стерео (side-by-side) VR-приложение для телефона: чекерборд-мир на three.js, гироскоп,
распознавание рук через заднюю камеру (MediaPipe Hands). Все библиотеки и модели лежат
внутри APK — интернет приложению не нужен.

## Готовый APK

`dist/Liminal-VR.apk` — подписан (v1 + v2 + v3), устанавливается напрямую (sideload).

Достаточно перекинуть файл на телефон и открыть его — Android спросит разрешение
«Установка из неизвестных источников», после чего приложение установится одним нажатием.

## Сборка (нужна только для пересборки)

```bash
python3 tools/setup_toolchain.py   # один раз: JRE, apktool.jar, apk_sign_ts, ключ, вендоры
python3 tools/build_apk.py         # соберёт и подпишет dist/Liminal-VR.apk
```

Тулчейн ставится в `~/.cache/liminal-toolchain` (вне репозитория), вендоры — в `web/vendor/`
(в `.gitignore`).

## Проверка

```bash
python3 tools/check_web.py                          # ссылки/ассеты/синтаксис JS до сборки
~/.cache/liminal-toolchain/venv/bin/python tools/verify_apk.py [apk]
```

`verify_apk.py` — независимый верификатор без Android SDK: разбирает ZIP, блок подписи
APK Signing Block (v2/v3: подпись, дайджест содержимого, SPKI сертификата, списки
алгоритмов), JAR-подпись v1 (MANIFEST.MF/CERT.SF/CERT.RSA, свой разбор PKCS#7),
бинарный AndroidManifest.xml и classes.dex. Завершается кодом 1 при любой ошибке.

## Структура

- `android/smali/` — исходники обёртки (WebView, отдача assets по https-хосту
  `appassets.androidplatform.net`, выдача камеры странице);
- `web/` — само приложение (three.js, MediaPipe Hands);
- `tools/` — сборка, подпись, верификация.

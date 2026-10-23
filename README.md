# NetCmd – Cisco / Huawei / Aruba komut karşılıkları (programmatic SEO)

Bağımlılıksız Python static site generator. Veri: `data/commands.json`. Çıktı: `dist/`.

## Yayına alma ($0)

1. GitHub'da yeni repo aç (örn. `netcmd-site`), dosyaları push et (`main` branch).
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Push sonrası workflow otomatik build + deploy eder. Adres: `https://<kullanici>.github.io/netcmd-site/`
4. Google Search Console → URL prefix property ekle → `sitemap.xml` gönder.

## Yerel test

```bash
BASE_URL=http://localhost:8000 python build.py
cd dist && python -m http.server 8000
```

## Ölçekleme

`data/commands.json`'a yeni kayıt ekle (alanlar: slug, title, cat, note, cisco/huawei/aruba → mode + cmds). Her kayıt 7 sayfa üretir
(1 ana + 6 vendor-çeviri). Önce kaliteyi koru: komutları gerçek cihazda doğrula, `note` alanına operasyonel ipucu yaz.

## AdSense

Önce özel domain al, AdSense onayı çıkınca repo → Settings → Variables → `ADSENSE_CLIENT=ca-pub-XXXX`. Build `ads.txt` ve script'i ekler.
Reklam yerleşimi için `ad_slot()` fonksiyonuna ad unit kodunu koy.

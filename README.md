# NetCmd – Cisco / Huawei / Aruba komut karşılıkları

Bağımlılıksız Python static site generator. Diller: TR / EN / AR (RTL).
Render static site: build `python3 build.py`, publish `dist`, env `BASE_URL`.

## Düzenlenecek dosyalar (data/)
- `commands.json`  komutlar (TR ana metin)
- `i18n.json`      arayüz + EN/AR çevirileri (yeni komut eklerken `items` altına en/ar ekle, yoksa build hata verir)
- `site.json`      `iban`, `holder`, `bank` (Destek ol sayfası); Supabase url + publishable key
- `projects.json`  Projeler sayfası (status: live | soon)

## Üyelik
Supabase Auth (e-posta + şifre). Supabase → Authentication → URL Configuration:
Site URL = `https://netcmd-site.onrender.com`, Redirect URLs'e `https://netcmd-site.onrender.com/**` ekle.

## Yerel test
```bash
BASE_URL=http://localhost:8000 python3 build.py && cd dist && python3 -m http.server 8000
```

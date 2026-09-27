# Doğa/Orman Bilgi Botu — Kurulum (ücretsiz sürüm)

Bu sürüm Anthropic/OpenAI kullanmıyor — sabit bir bilgi havuzundan rastgele
seçim yapıyor ve Unsplash'ten ücretsiz, lisanslı bir görsel çekiyor. Tek
maliyet X (Twitter) API'nin post başına küçük ücretidir.

## 1. API anahtarlarını al
- **X (Twitter)**: developer.x.com → yeni App oluştur → App permissions'ı
  **Read and Write** yap → Keys and tokens'tan 4 değeri al (API Key/Secret,
  Access Token/Secret oluştur). Yeni hesaplarda pay-per-use varsayılan;
  metin+görselli bir post ~0.015$ civarı, günde 1 post ayda ~0.5$ eder.
  Kredi kartı bağlayıp Developer Console'dan ön ödeme yapman gerekiyor.
- **Unsplash**: unsplash.com/developers → yeni app → Access Key (tamamen ücretsiz)

## 2. Yerelde test et (opsiyonel)
```bash
pip install -r requirements.txt
cp .env.example .env   # değerleri doldur
export $(cat .env | xargs)
python twitter_nature_bot.py
```

## 3. Otomatik/günlük çalıştırma (GitHub Actions — ücretsiz)
1. Bu dosyaları GitHub reponuza yükle
2. `.github_workflows_template/nature_bot.yml` dosyasını
   `.github/workflows/nature_bot.yml` yoluna taşı
3. Repo → Settings → Secrets and variables → Actions → şu 5 secret'ı ekle:
   `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`,
   `TWITTER_ACCESS_SECRET`, `UNSPLASH_ACCESS_KEY`
4. Actions sekmesinden "Run workflow" ile elle test et

## Notlar
- Bilgi havuzunu (`FACTS` listesi, twitter_nature_bot.py içinde) istediğin
  kadar genişletebilirsin — ne kadar çok madde olursa tekrarlar o kadar azalır.
- Twitter/X App'in "Read and Write" izni olmazsa 403 hatası alırsın —
  en sık karşılaşılan sorun bu.

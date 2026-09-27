"""
Doğa/Orman Bilgi Botu (ücretsiz sürüm)
---------------------------------------
Sabit bir bilgi havuzundan rastgele bir doğa/orman bilgisi seçer, Unsplash'ten
lisanslı bir fotoğraf ekler ve X (Twitter) hesabından paylaşır.

Gerekli ortam değişkenleri (.env.example dosyasına bak):
  TWITTER_API_KEY, TWITTER_API_SECRET
  TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
  UNSPLASH_ACCESS_KEY
"""

import os
import random
import tempfile

import requests
import tweepy

FACTS = [
    "Bir ağaç yılda ortalama 22 kilogram karbondioksit emer ve karşılığında oksijen üretir.",
    "Amazon Ormanları dünyadaki oksijenin yaklaşık %20'sini üretir, bu yüzden 'dünyanın akciğerleri' olarak anılır.",
    "Mantarlar, yer altında dev bir ağ oluşturarak ağaçların birbiriyle besin ve bilgi alışverişi yapmasını sağlar; buna 'orman interneti' denir.",
    "Sekoya ağaçları 100 metreyi aşan boylara ulaşabilir ve 3000 yıldan fazla yaşayabilir.",
    "Bir meşe ağacı, yaşamı boyunca yaklaşık 10 milyon adet meşe palamudu üretebilir.",
    "Orman toprağının sadece bir avucunda, dünya nüfusundan daha fazla mikroorganizma bulunur.",
    "Kelebekler ayaklarıyla tat alır; bir çiçeğe konduklarında onu ayaklarıyla 'tadarlar'.",
    "Baykuşlar boyunlarını 270 dereceye kadar çevirebilir çünkü göz küreleri hareket etmez.",
    "Bambü, dünyanın en hızlı büyüyen bitkisidir; bazı türleri günde 90 santimetre büyüyebilir.",
    "Bir karınca kendi ağırlığının 50 katına kadar yük taşıyabilir.",
    "Tundra bölgelerinde yaşayan ren geyikleri, gözlerinin rengini mevsime göre değiştirebilir.",
    "Deniz otu çayırları, tropik yağmur ormanlarından bile daha hızlı karbon depolayabilir.",
    "Ağaçlar birbirlerine kimyasal sinyaller göndererek zararlı böcek saldırılarına karşı komşularını uyarabilir.",
    "Dünyadaki tatlı suyun yaklaşık %20'si Amazon Nehri havzasından akar.",
    "Bal arıları, kovanlarına dönüş yolunu bulmak için Güneş'in konumunu pusula gibi kullanır.",
    "Kutup ayılarının derisi aslında siyahtır; kürkleri ışığı yansıttığı için beyaz görünür.",
    "Bir yağmur ormanı ağacının tepesindeki (kanopi) ekosistem, ormanın geri kalanından tamamen farklı canlı türlerine ev sahipliği yapar.",
    "Fillerin ayak tabanlarındaki hassas sinirler, kilometrelerce uzaktaki depremleri ve diğer fillerin ayak seslerini algılayabilir.",
    "Dünyadaki tüm canlı biyokütlenin yarısından fazlasını bitkiler oluşturur.",
    "Bazı orkide türleri, döllenmek için belirli bir arı türünü taklit edecek şekilde evrimleşmiştir.",
    "Bir orman yangınından sonra bazı çam kozalakları ancak yüksek ısıyla açılıp tohumlarını serbest bırakır.",
    "Ahtapotlar üç kalbe sahiptir; ikisi solungaçlara, biri vücudun geri kalanına kan pompalar.",
    "Yağmur ormanlarında, güneş ışığının toprağa ulaşması saatler sürebilir çünkü kat kat yaprak katmanlarından süzülür.",
    "Kunduzların yaptığı barajlar, zamanla küçük göller ve sulak alanlar oluşturarak yüzlerce türe yaşam alanı sağlar.",
    "Bazı ağaç türleri, kuraklık dönemlerinde köklerini kullanarak komşu ağaçlarla su paylaşabilir.",
    "Yarasalar, tozlaşmadan tohum yayılımına kadar birçok tropik bitkinin hayatta kalması için kritik öneme sahiptir.",
    "Bir orman ekosistemindeki yaprak döken bir ağaç, mevsim boyunca yaklaşık 200.000 yaprak dökebilir.",
    "Karıncalar, dünya üzerindeki toplam hayvan biyokütlesinin önemli bir kısmını oluşturur.",
    "Denizanaları 500 milyon yıldan uzun süredir var olan, dinozorlardan bile daha eski canlılardır.",
    "Bazı mantar türleri, tespit edilen en büyük ve en yaşlı canlı organizmalar arasındadır; bazıları binlerce dönümü kaplar.",
]


def get_random_fact() -> str:
    return random.choice(FACTS)


def get_stock_image_path(query: str = "forest nature") -> str:
    """Unsplash'ten lisanslı, telif sorunu olmayan bir doğa fotoğrafı çeker."""
    resp = requests.get(
        "https://api.unsplash.com/photos/random",
        params={"query": query, "orientation": "landscape"},
        headers={"Authorization": f"Client-ID {os.environ['UNSPLASH_ACCESS_KEY']}"},
        timeout=15,
    )
    resp.raise_for_status()
    image_url = resp.json()["urls"]["regular"]
    img_data = requests.get(image_url, timeout=15).content
    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    tmp.write(img_data)
    tmp.close()
    return tmp.name


def post_tweet() -> None:
    text = get_random_fact()
    image_path = get_stock_image_path()

    auth = tweepy.OAuth1UserHandler(
        os.environ["TWITTER_API_KEY"],
        os.environ["TWITTER_API_SECRET"],
        os.environ["TWITTER_ACCESS_TOKEN"],
        os.environ["TWITTER_ACCESS_SECRET"],
    )
    api_v1 = tweepy.API(auth)  # medya yüklemek için v1.1 lazım

    client = tweepy.Client(
        consumer_key=os.environ["TWITTER_API_KEY"],
        consumer_secret=os.environ["TWITTER_API_SECRET"],
        access_token=os.environ["TWITTER_ACCESS_TOKEN"],
        access_token_secret=os.environ["TWITTER_ACCESS_SECRET"],
    )

    try:
        media = api_v1.media_upload(image_path)
        client.create_tweet(text=text, media_ids=[media.media_id])
        print("Paylaşıldı:", text)
    finally:
        os.remove(image_path)


if __name__ == "__main__":
    post_tweet()

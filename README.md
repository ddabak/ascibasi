# Ascibasi - Turk Mutfagi Tarif Chatbot

Turk mutfagi konusunda uzman bir yapay zeka chatbot. Kullanicilara geleneksel Turk yemek tariflerini samimi bir Anadolu ascibasi uslubunda anlatan, tarif kaydetme, paylasma ve alisveris listesi olusturma ozellikleri sunan bir web uygulamasi.

## Ozellikler

### Yapay Zeka
- **AI Tarif Asistani**: GPT-4.1-mini destekli, Turk mutfagina ozel sohbet deneyimi (streaming/SSE destekli)
- **Akilli Referanslar**: Perplexity API ile tarife ozel kaynak site ve video onerileri (selamlama/menu yanitlarinda otomatik gizlenir)
- **Tarif Onbellegi**: Tekrarlayan sorular icin 7 gunluk cache mekanizmasi

### Kullanici Sistemi
- **E-posta Dogrulamali Kayit**: Resend ile 6 haneli dogrulama kodu (10 dk gecerli)
- **Gelismis Kayit Formu**: Kullanici adi, isim, soyisim, dogum tarihi, e-posta, sifre
- **Guclu Sifre Kurallari**: En az 8 karakter, buyuk/kucuk harf, rakam ve ozel karakter zorunlu (canli gosterge ile)
- **Profil Yonetimi**: Kisisel bilgiler, e-posta, kullanici adi ve sifre degistirme

### Sohbet
- **Mesaj Duzenleme**: Gonderilen mesajlari duzenleyip yeniden gonderme
- **Mesaj Paylasimi**: Tum mesajlar icin paylasim linki olusturma
- **Kullanim Limiti**: Gunluk 20 mesaj hakki, 24 saatlik kayan pencere ile kademeli yenilenme
- **Sohbet Yonetimi**: Oturumlar, klasorleme, baslik duzenleme, cop kutusu (soft-delete & geri yukleme)

### Tarif Defteri
- **Defter > Klasor > Tarif**: Hiyerarsik tarif kaydetme ve duzenleme
- **Tarif Puanlama**: 1-5 arasi puan verme
- **Tarif Paylasimi**: Benzersiz paylasim linkleri olusturma
- **PDF Eksport**: Defter, klasor veya tek tarif bazinda PDF indirme (Turkce karakter destekli)
- **Kayitli Tariflerde Arama**: Tum defterlerde tarif arama

### Diger
- **Alisveris Listesi**: Tarif iceriginden otomatik malzeme cikarimi ile liste olusturma
- **Malzemelerle Tarif Bulma**: Eldeki malzemeleri girerek tarif onerisi alma
- **Haftalik Menu Planlama**: AI destekli 7 gunluk menu olusturma
- **Rate Limiting**: SlowAPI ile istek sinirlamasi

## Teknoloji Yigini

| Katman | Teknoloji |
|--------|-----------|
| Backend | Python, FastAPI, Uvicorn |
| Veritabani | PostgreSQL, SQLAlchemy |
| AI | OpenAI GPT-4.1-mini |
| Arama | Perplexity API (referanslar) |
| E-posta | Resend (dogrulama kodlari) |
| Frontend | HTML, CSS, JavaScript (Jinja2 templates) |
| PDF | fpdf2 (DejaVu Sans font) |
| Deploy | Docker, Docker Compose |
| Reverse Proxy | Caddy (otomatik SSL) |
| Diger | slowapi, httpx, python-dotenv |

## Kurulum

### Gereksinimler

- Python 3.10+
- PostgreSQL

### Lokal Kurulum

1. **Repoyu klonlayin:**

```bash
git clone https://github.com/ddabak/ascibasi.git
cd ascibasi
```

2. **Sanal ortam olusturun ve aktif edin:**

```bash
python -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows
```

3. **Bagimliliklari yukleyin:**

```bash
pip install -r requirements.txt
```

4. **Ortam degiskenlerini ayarlayin:**

Proje kokune `.env` dosyasi olusturun:

```env
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/turkrecipes
PERPLEXITY_API_KEY=pplx-...       # Opsiyonel - referans linkleri icin
RESEND_API_KEY=re_...              # Opsiyonel - e-posta dogrulama icin
PASSWORD_SALT=kendi_salt_degeriniz  # Opsiyonel - varsayilan deger mevcut
```

5. **PostgreSQL veritabanini olusturun:**

```bash
createdb turkrecipes
```

6. **Ornek tarifleri yukleyin:**

```bash
python seed_recipes.py
```

7. **Uygulamayi baslatin:**

```bash
uvicorn main:app --reload
```

Uygulama `http://localhost:8000` adresinde calisir.

### Docker ile Kurulum

```bash
git clone https://github.com/ddabak/ascibasi.git
cd ascibasi
# .env dosyasini olusturun (yukaridaki ornege bakin)
docker compose up -d
docker compose exec app python seed_recipes.py
```

## Proje Yapisi

```
ascibasi/
├── main.py              # FastAPI uygulamasi ve tum API endpointleri
├── database.py          # SQLAlchemy modelleri ve veritabani baglantisi
├── seed_recipes.py      # Ornek tarif verileri
├── requirements.txt     # Python bagimliliklari
├── Dockerfile           # Docker imaj tarifi
├── docker-compose.yml   # Docker Compose yapilandirmasi
├── .env                 # Ortam degiskenleri (git'e dahil degil)
├── .gitignore           # Git'e yuklenmeyen dosyalar
├── .dockerignore        # Docker imajina dahil edilmeyen dosyalar
├── templates/
│   └── index.html       # Ana sayfa sablonu
└── static/
    ├── app.js           # Frontend JavaScript
    ├── style.css        # Stil dosyasi
    └── fonts/           # DejaVu Sans fontlari (PDF icin)
```

## API Endpointleri

### Kimlik Dogrulama
| Metod | Endpoint | Aciklama |
|-------|----------|----------|
| `POST` | `/api/auth/register` | Kullanici kaydi (e-posta dogrulamali) |
| `POST` | `/api/auth/verify-email` | E-posta dogrulama kodu kontrolu |
| `POST` | `/api/auth/resend-code` | Dogrulama kodunu tekrar gonder |
| `POST` | `/api/auth/login` | Kullanici girisi |
| `GET` | `/api/auth/profile` | Profil bilgilerini getir |
| `PUT` | `/api/auth/profile` | Profil bilgilerini guncelle |
| `PUT` | `/api/auth/password` | Sifre degistir |

### Sohbet
| Metod | Endpoint | Aciklama |
|-------|----------|----------|
| `POST` | `/api/chat/stream` | Streaming sohbet (SSE) |
| `POST` | `/api/chat` | Standart sohbet |
| `GET` | `/api/chat/limit` | Kalan mesaj hakkini sorgula |
| `POST` | `/api/messages/share` | Mesaj paylasim linki olustur |

### Oturumlar
| Metod | Endpoint | Aciklama |
|-------|----------|----------|
| `GET` | `/api/sessions` | Sohbet oturumlarini listele |
| `DELETE` | `/api/sessions/{id}` | Sohbeti cop kutusuna tasi |
| `PUT` | `/api/sessions/{id}/title` | Sohbet basligini duzenle |
| `PUT` | `/api/sessions/{id}/move` | Sohbeti klasore tasi |
| `DELETE` | `/api/sessions/{id}/rewind` | Son N mesaji sil (duzenleme) |

### Tarif Defteri
| Metod | Endpoint | Aciklama |
|-------|----------|----------|
| `GET` | `/api/books` | Defterleri listele |
| `POST` | `/api/books` | Yeni defter olustur |
| `GET` | `/api/books/{id}/export-pdf` | Defteri PDF olarak indir |
| `POST` | `/api/books/{id}/save-recipe` | Deftere tarif kaydet |
| `POST` | `/api/folders/{id}/recipes` | Klasore tarif kaydet |
| `POST` | `/api/saved-recipes/{id}/share` | Tarif paylasim linki olustur |
| `PUT` | `/api/saved-recipes/{id}/rate` | Tarif puanla |
| `GET` | `/api/saved-recipes/search` | Kayitli tariflerde ara |

### Cop Kutusu
| Metod | Endpoint | Aciklama |
|-------|----------|----------|
| `GET` | `/api/trash` | Silinen sohbetleri listele |
| `POST` | `/api/trash/{id}/restore` | Sohbeti geri yukle |
| `DELETE` | `/api/trash/{id}/permanent` | Kalici olarak sil |
| `DELETE` | `/api/trash/empty` | Cop kutusunu bosalt |

### Diger
| Metod | Endpoint | Aciklama |
|-------|----------|----------|
| `GET` | `/api/health` | Saglik kontrolu |
| `GET` | `/api/recipes` | Veritabanindaki tarifleri listele |
| `POST` | `/api/shopping-lists` | Alisveris listesi olustur |
| `POST` | `/api/shopping-lists/from-recipe` | Tariften otomatik liste olustur |
| `GET` | `/api/shared-message/{token}` | Paylasilan mesaji goruntule |

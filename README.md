# Ascibasi - Turk Mutfagi Tarif Chatbot

Turk mutfagi konusunda uzman bir yapay zeka chatbot. Kullanicilara geleneksel Turk yemek tariflerini samimi bir Anadolu ascibasi uslubunda anlatan, tarif kaydetme, paylasma ve alisveris listesi olusturma ozellikleri sunan bir web uygulamasi.

## Ozellikler

- **AI Tarif Asistani**: GPT-4.1-mini destekli, Turk mutfagina ozel sohbet deneyimi (streaming/SSE destekli)
- **Tarif Veritabani**: 20 geleneksel Turk yemek tarifi ile onceden doldurulmus PostgreSQL veritabani
- **Kullanici Sistemi**: Kayit, giris, profil duzenleme ve sifre degistirme
- **Tarif Defteri**: Defter > Klasor > Tarif hiyerarsisinde tarifleri kaydetme ve duzenleme
- **Tarif Paylasimi**: Kayitli tarifler icin benzersiz paylasim linkleri olusturma
- **Tarif Puanlama**: Kayitli tariflere 1-5 arasi puan verme
- **PDF Eksport**: Defter, klasor veya tek tarif bazinda PDF indirme (Turkce karakter destekli)
- **Alisveris Listesi**: Tarif iceriginden otomatik malzeme cikarimi ile liste olusturma
- **Sohbet Yonetimi**: Oturumlar, klasorleme, baslik duzenleme, cop kutusu (soft-delete & geri yukleme)
- **Referans Linkleri**: Perplexity API ile ilgili tarif sitelerinden referans onerileri
- **Tarif Onbellegi**: Tekrarlayan sorular icin 7 gunluk cache mekanizmasi
- **Rate Limiting**: SlowAPI ile istek sinirlamasi

## Teknoloji Yigini

| Katman | Teknoloji |
|--------|-----------|
| Backend | Python, FastAPI, Uvicorn |
| Veritabani | PostgreSQL, SQLAlchemy |
| AI | OpenAI GPT-4.1-mini |
| Arama | Perplexity API (referanslar) |
| Frontend | HTML, CSS, JavaScript (Jinja2 templates) |
| PDF | fpdf2 (DejaVu Sans font) |
| Diger | slowapi, httpx, python-dotenv |

## Kurulum

### Gereksinimler

- Python 3.10+
- PostgreSQL

### Adimlar

1. **Repoyu klonlayin ve dizine girin:**

```bash
cd ilk-chatbot
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

Uygulama varsayilan olarak `http://localhost:8000` adresinde calisir.

## Proje Yapisi

```
ilk-chatbot/
├── main.py            # FastAPI uygulamasi ve tum API endpointleri
├── database.py        # SQLAlchemy modelleri ve veritabani baglantisi
├── seed_recipes.py    # Ornek tarif verileri
├── requirements.txt   # Python bagimliliklari
├── .env               # Ortam degiskenleri (git'e dahil degil)
├── templates/
│   └── index.html     # Ana sayfa sablonu
└── static/
    ├── app.js         # Frontend JavaScript
    ├── style.css      # Stil dosyasi
    └── fonts/         # DejaVu Sans fontlari (PDF icin)
```

## API Endpointleri

| Metod | Endpoint | Aciklama |
|-------|----------|----------|
| `GET` | `/` | Ana sayfa |
| `GET` | `/api/health` | Saglik kontrolu |
| `POST` | `/api/chat/stream` | Streaming sohbet (SSE) |
| `POST` | `/api/chat` | Standart sohbet |
| `POST` | `/api/auth/register` | Kullanici kaydi |
| `POST` | `/api/auth/login` | Kullanici girisi |
| `PUT` | `/api/auth/profile` | Profil guncelleme |
| `PUT` | `/api/auth/password` | Sifre degistirme |
| `GET` | `/api/sessions` | Sohbet oturumlarini listeleme |
| `DELETE` | `/api/sessions/{id}` | Sohbeti cop kutusuna tasima |
| `PUT` | `/api/sessions/{id}/title` | Sohbet basligini duzenleme |
| `GET` | `/api/books` | Tarif defterlerini listeleme |
| `POST` | `/api/books` | Yeni defter olusturma |
| `GET` | `/api/books/{id}/export-pdf` | Defteri PDF olarak indirme |
| `POST` | `/api/folders/{id}/recipes` | Klasore tarif kaydetme |
| `POST` | `/api/saved-recipes/{id}/share` | Tarif paylasim linki olusturma |
| `PUT` | `/api/saved-recipes/{id}/rate` | Tarif puanlama |
| `GET` | `/api/saved-recipes/search` | Kayitli tariflerde arama |
| `POST` | `/api/shopping-lists` | Alisveris listesi olusturma |
| `POST` | `/api/shopping-lists/from-recipe` | Tariften otomatik liste olusturma |
| `GET` | `/api/trash` | Cop kutusunu listeleme |
| `POST` | `/api/trash/{id}/restore` | Sohbeti geri yukleme |

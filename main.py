import hashlib
import io
import json
import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional, List

import httpx
import markdown as md_lib
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Depends
from fastapi.responses import HTMLResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fpdf import FPDF
from openai import OpenAI
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import or_, func, distinct, text as sa_text
from sqlalchemy.orm import Session

from database import (
    init_db, get_db, Recipe, ChatHistory,
    RecipeBook, BookFolder, SavedRecipe, User,
    SessionMeta, RecipeCache, ShoppingList, ChatFolder,
)

load_dotenv()

# ========== Logging ==========
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ascibasi")

app = FastAPI(title="Turk Mutfagi Tarif Chatbot")

# ========== Rate Limiting ==========
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")


async def search_references(food_name: str) -> List[str]:
    if not PERPLEXITY_API_KEY:
        return []
    url = "https://api.perplexity.ai/chat/completions"
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "sonar",
        "messages": [
            {"role": "user", "content": f"{food_name} tarifi icin en iyi Turkce tarif sitelerini bul"}
        ],
    }
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                return data.get("citations", [])[:3]
    except Exception as e:
        logger.error("Perplexity referans arama hatasi: %s", str(e))
    return []


SYSTEM_PROMPT = """Sen Turk mutfagi konusunda uzman, yillarin deneyimine sahip bir ascibasisin. Adin "Ascibasi". Anadolu'nun her kosesinden tarif bilen, mutfakta buyumus, elinin tadi dilden dile dolasan bir ustasin.

## KIMLIGIN VE USLUBUN
- Kullaniciya "canim", "guzelim", "haydi bakalim" gibi samimi, sicak hitaplar kullan. Sanki karsinda mutfagina gelen bir misafir var.
- Konusma tarzin bir Anadolu annesinin tarif anlatmasi gibi olsun: dogal, icten, sefkatli.
- Tarifi anlatirken coskulu ol. "Simdi isin guzel kismi geliyor!", "Bak burayi kacirma!" gibi ifadelerle anlatimi canli tut.

## TARIF ANLATIM FORMATI
Her tarifi asagidaki sirayla ve formatta anlat:

**ONEMLI: En basta yemegin adini mutlaka "## Yemek Adi Tarifi" formatinda Markdown basligi olarak yaz.** Ornegin: ## Karniyarik Tarifi, ## Mercimek Corbasi Tarifi, ## Brokoli Salatasi Tarifi. Bu baslik her zaman ilk satirda olmali.

1. **Yemek Hakkinda Kisa Tanitim**: Yemegin hangi yoreye ait oldugu, hikayesi veya kulturel onemi (2-3 cumle).

2. **Malzeme Listesi**: Her malzemeyi miktariyla birlikte alt alta yaz. Olculeri net ver (su bardagi, yemek kasigi, gram, adet). Malzemenin ne ise yaradigini gerekirse parantez icinde belirt.

3. **Hazirlik Asamasi**: Pisirmeye baslamadan once yapilmasi gereken tum hazirliklari anlat (yikama, dograma, ayiklama, bekletme). Dograma sekillerini tarif et: "parmak kalinliginda dograyin", "julyen kesin", "ince ince kiyin" gibi.

4. **Pisirme Adimlari**: Her adimi numaralandirarak anlat. Her adimda sunlar mutlaka olsun:
   - Ne yapilacak (eylem)
   - Nasil yapilacak (teknik detay: "kisik ateste", "tahta kasikla karistirarak", "kapagi aralik birakarak")
   - Ne kadar sure yapilacak (dakika/saat)
   - Hazir oldugunu nasil anlayacak (gorsel/koku/doku ipucu: "kenarlari kizarinca", "uzeri fokurdayinca", "kasigin arkasina yapisinca", "mis gibi kokmaya baslayinca")

5. **Puf Noktalari**: En az 2-3 puf noktasi ver. Bunlar gercekten fark yaratan, deneyimle ogrenilen pratik bilgiler olsun.

6. **Servis Onerisi**: Yaninda ne gider, nasil sunulur, sicak mi soguk mu servis edilir.

## KESIN KURALLAR
- SADECE Turk yemek tarifleri hakkinda konus. Baska herhangi bir konuda kesinlikle cevap verme.
- Yemekle ilgisi olmayan sorulara su tarzda yanit ver: "Canim benim, ben sadece yemek tariflerinden anlarim. Benim isim mutfak! Haydi sen bana hangi yemegi merak ettigini soyle, hemen anlatayim."
- Saglik tavsiyesi verme, diyet onerme. Sadece tarifi anlat.
- Eger veritabanindan tarif bilgisi saglanmissa, o bilgiyi temel al ama kendi bilgi ve deneyiminle zenginlestir, detaylandir.
- Kullanici selamlama yaparsa sicakkanli karsila ve ne pisirmek istedigini sor.
- Yanitlarini her zaman Turkce ver.
- Kullanici bir yore sordugunda o yorenin meshur yemeklerini oner.
- Kullanici malzeme verip "ne yapabilirim?" diye sorarsa, o malzemelerle yapilabilecek Turk yemeklerini oner.
"""

USER_PROMPT_TEMPLATE = """Kullanicinin mesaji: {message}

Kullanicinin mesajini analiz et:
- Eger belirli bir yemek tarifi soruyorsa: O yemegin tarifini tam format ile detayli anlat.
- Eger bir yore/bolge soruyorsa: O yorenin en meshur 3-5 yemegini kisaca tanit ve hangisinin tarifini istedigini sor.
- Eger elindeki malzemeleri sayip ne yapabilecegini soruyorsa: O malzemelerle yapilabilecek Turk yemeklerini oner.
- Eger yemek kategorisi soruyorsa (corba, tatli, meze vb.): O kategoriden birkac oneri sun.
- Eger yemekle ilgisi olmayan bir soru soruyorsa: Kibarca sadece yemek tarifleri konusunda yardimci olabilecegini belirt.
- Eger selamlama yapiyorsa: Samimi karsila ve ne pisirmek istedigini sor.

{recipe_context}"""


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    references: List[str] = []


def search_recipes(db: Session, query: str) -> List[Recipe]:
    keywords = query.lower().split()
    filters = []
    for kw in keywords:
        pattern = f"%{kw}%"
        filters.append(Recipe.name.ilike(pattern))
        filters.append(Recipe.category.ilike(pattern))
        filters.append(Recipe.ingredients.ilike(pattern))
        filters.append(Recipe.region.ilike(pattern))
    if not filters:
        return []
    return db.query(Recipe).filter(or_(*filters)).limit(5).all()


def build_recipe_context(recipes: List[Recipe]) -> str:
    if not recipes:
        return ""
    text = "\n\n--- VERITABANINDAN BULUNAN TARIFLER ---\n"
    for r in recipes:
        text += f"\n{r.name} ({r.category} - {r.region})\n"
        text += f"Malzemeler: {r.ingredients}\n"
        text += f"Yapilisi: {r.instructions}\n"
    return text


def build_messages(db: Session, session_id: str, user_message: str, recipe_context: str) -> list:
    """Sohbet gecmisi + yeni mesajla GPT mesaj listesi olustur."""
    history = (
        db.query(ChatHistory)
        .filter(ChatHistory.session_id == session_id)
        .order_by(ChatHistory.id.desc())
        .limit(10)
        .all()
    )
    history.reverse()

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in history:
        messages.append({"role": h.role, "content": h.content})

    user_content = USER_PROMPT_TEMPLATE.format(
        message=user_message,
        recipe_context=recipe_context if recipe_context else "Veritabaninda eslesen tarif bulunamadi. Kendi bilginle yanitla.",
    )
    messages.append({"role": "user", "content": user_content})
    return messages


def normalize_recipe_query(message: str) -> Optional[str]:
    """Extract the food name from a user query for caching."""
    msg = message.lower().strip()
    # Remove common suffixes (longest first to avoid partial matches)
    for suffix in [
        "nasıl yapılır?", "nasıl yapılır", "nasil yapilir?", "nasil yapilir",
        "tarifi verir misin?", "tarifi verir misin", "tarif verir misin?", "tarif verir misin",
        "tarifi istiyorum", "tarif istiyorum", "tarif versene", "tarifi ver", "tarif ver",
        "anlatır mısın?", "anlatır mısın", "anlatir misin?", "anlatir misin",
        "söyler misin?", "söyler misin", "öner misin?", "öner misin",
        "verir misin?", "verir misin", "oner misin?", "oner misin",
        "yapılışı", "yapilisi", "yapımı", "yapimi",
        "tarifleri", "tarifi",
        "nasıl", "nasil", "istiyorum", "versene",
        "hazırla", "hazirla", "oluştur", "olustur",
        "neler var", "neler",
        "söyle", "soyle", "anlat",
        "bana", "bize",
    ]:
        msg = msg.replace(suffix, "")
    # Kisa dolgu kelimeleri kelime siniri ile temizle (yemek adlarini bozmamak icin)
    msg = re.sub(r'\b(ya|bi|bir|ver)\b', '', msg)
    msg = re.sub(r'\s+', ' ', msg)
    msg = msg.strip().strip("?").strip()
    if len(msg) < 2 or len(msg) > 100:
        return None
    return msg


GREETING_WORDS = {"merhaba", "selam", "hey", "naber", "nasilsin", "iyi gunler", "gunaydin", "iyi aksamlar"}

# Tarif basliginda atlanacak bolum basliklari
_SECTION_HEADERS = {
    "malzeme listesi", "malzemeler", "malzeme",
    "yapilisi", "yapılışı", "yapilis", "yapılış",
    "hazirlik asamasi", "hazırlık aşaması", "hazirlik", "hazırlık",
    "pisirme adimlari", "pişirme adımları", "pisirme", "pişirme",
    "puf noktalari", "püf noktaları", "puf noktasi", "püf noktası",
    "servis onerisi", "servis önerisi", "servis",
    "tanitim", "tanıtım",
    "yemek hakkinda kisa tanitim", "yemek hakkında kısa tanıtım",
    "yemek hakkinda", "yemek hakkında",
    "kisa tanitim", "kısa tanıtım",
    "notlar", "ipuclari", "ipuçları",
}


def _is_section_header(text: str) -> bool:
    """Metnin bir bolum basligi olup olmadigini kontrol et."""
    clean = text.lower().rstrip(":").strip()
    # Numara oneki kaldir: "1. Yemek Hakkinda..." -> "Yemek Hakkinda..."
    clean = re.sub(r'^\d+[\.\)]\s*', '', clean).strip()
    if clean in _SECTION_HEADERS:
        return True
    # Anahtar kelime bazli kontrol (bolum basligina ozel kelimeler)
    section_keywords = [
        "malzeme", "yapılışı", "yapilisi", "hazırlık", "hazirlik",
        "pişirme", "pisirme", "püf", "puf nokt", "servis",
        "tanıtım", "tanitim", "hakkında", "hakkinda",
    ]
    for keyword in section_keywords:
        if keyword in clean:
            return True
    return False


def extract_title_from_response(gpt_response: str) -> Optional[str]:
    """GPT yanitindan yemek adini cikar (dogru yazimli)."""
    if not gpt_response:
        return None

    # 1. Markdown basliklardan tara - bolum basliklarini atla
    for match in re.finditer(r'^#{1,3}\s+(.+?)$', gpt_response, re.MULTILINE):
        title = match.group(1).strip().replace("**", "").strip()
        if _is_section_header(title):
            continue
        clean = re.sub(r'\s+[Tt]arifi\s*$', '', title).strip()
        if 2 < len(clean) <= 50:
            return clean

    # 2. Kalin metinden tara - bolum basliklarini atla
    for match in re.finditer(r'\*\*(.+?)\*\*', gpt_response):
        title = match.group(1).strip().rstrip(":").strip()
        if _is_section_header(title):
            continue
        clean = re.sub(r'\s+[Tt]arifi\s*$', '', title).strip()
        if 2 < len(clean) <= 50:
            return clean

    return None


def generate_session_title(user_message: str, gpt_response: Optional[str] = None) -> str:
    """Sohbet basligi olustur. GPT yaniti varsa ondan, yoksa kullanici mesajindan."""
    msg_lower = user_message.lower().strip()

    # Selamlama ise
    if msg_lower in GREETING_WORDS or len(msg_lower) < 4:
        return "Yeni Sohbet"

    # GPT yanitindan dogru yazimli baslik cikar
    if gpt_response:
        title = extract_title_from_response(gpt_response)
        if title:
            return title + " Tarifi"

    # GPT yaniti yoksa kullanici mesajindan cikar
    food_name = normalize_recipe_query(user_message)
    if food_name and 2 < len(food_name) <= 30:
        return food_name.strip().title() + " Tarifi"

    # Genel mesaj
    msg = user_message.strip()
    if len(msg) > 40:
        msg = msg[:40] + "..."
    return msg


SALT = os.getenv("PASSWORD_SALT", "ascibasi_default_salt_2026")

def hash_password(password: str) -> str:
    """SHA-256 password hashing with salt."""
    salted = SALT + password
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()

def hash_password_old(password: str) -> str:
    """Eski salt'siz hash (geriye uyumluluk icin)."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def verify_password(password: str, stored_hash: str, db: Session = None, user: object = None) -> bool:
    """Sifreyi dogrula. Eski hash uyuyorsa yeni hash'e kademeli gecis yapar."""
    # Yeni hash'i dene
    if stored_hash == hash_password(password):
        return True
    # Eski hash'i dene (salt'siz)
    if stored_hash == hash_password_old(password):
        # Eski hash uyustu - yeni hash'e guncelle (kademeli gecis)
        if db and user:
            user.password_hash = hash_password(password)
            db.commit()
            logger.info("Kullanici hash'i guncellendi (kademeli gecis): %s", user.username)
        return True
    return False


@app.on_event("startup")
def startup():
    logger.info("Ascibasi uygulamasi baslatiliyor...")
    init_db()
    logger.info("Veritabani basariyla baslatildi.")


@app.get("/", response_class=HTMLResponse)
@limiter.limit("30/minute")
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# ========== Health Check ==========

@app.get("/api/health")
@limiter.limit("30/minute")
async def health_check(request: Request, db: Session = Depends(get_db)):
    """Veritabani baglantisini kontrol et ve durum bilgisi don."""
    try:
        db.execute(sa_text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        logger.error("Veritabani baglanti hatasi: %s", str(e))
        db_status = "error"
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": db_status,
        "service": "ascibasi",
    }


# ========== Authentication API ==========

class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class ProfileUpdateRequest(BaseModel):
    user_id: str
    username: str


class PasswordChangeRequest(BaseModel):
    user_id: str
    old_password: str
    new_password: str


@app.post("/api/auth/register")
@limiter.limit("30/minute")
async def register(request: Request, req: RegisterRequest, db: Session = Depends(get_db)):
    """Yeni kullanici kaydi."""
    if not req.username or not req.password:
        return Response(content=json.dumps({"error": "Kullanici adi ve sifre gerekli"}), status_code=400, media_type="application/json")

    if len(req.username) < 3:
        return Response(content=json.dumps({"error": "Kullanici adi en az 3 karakter olmali"}), status_code=400, media_type="application/json")

    if len(req.password) < 4:
        return Response(content=json.dumps({"error": "Sifre en az 4 karakter olmali"}), status_code=400, media_type="application/json")

    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        return Response(content=json.dumps({"error": "Bu kullanici adi zaten alinmis"}), status_code=409, media_type="application/json")

    user_id = str(uuid.uuid4())
    user = User(
        user_id=user_id,
        username=req.username,
        password_hash=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    logger.info("Yeni kullanici kaydoldu: %s", req.username)
    return {"user_id": user_id, "username": req.username}


@app.post("/api/auth/login")
@limiter.limit("30/minute")
async def login(request: Request, req: LoginRequest, db: Session = Depends(get_db)):
    """Kullanici girisi."""
    if not req.username or not req.password:
        return Response(content=json.dumps({"error": "Kullanici adi ve sifre gerekli"}), status_code=400, media_type="application/json")

    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash, db, user):
        return Response(content=json.dumps({"error": "Kullanici adi veya sifre hatali"}), status_code=401, media_type="application/json")

    logger.info("Kullanici giris yapti: %s", req.username)
    return {"user_id": user.user_id, "username": user.username}


# ========== Profile Settings API (Feature 2) ==========

@app.put("/api/auth/profile")
@limiter.limit("30/minute")
async def update_profile(request: Request, req: ProfileUpdateRequest, db: Session = Depends(get_db)):
    """Kullanici adini degistir."""
    if not req.username or len(req.username) < 3:
        return Response(content=json.dumps({"error": "Kullanici adi en az 3 karakter olmali"}), status_code=400, media_type="application/json")

    user = db.query(User).filter(User.user_id == req.user_id).first()
    if not user:
        return Response(content=json.dumps({"error": "Kullanici bulunamadi"}), status_code=404, media_type="application/json")

    # Check if new username is taken by another user
    existing = db.query(User).filter(User.username == req.username, User.user_id != req.user_id).first()
    if existing:
        return Response(content=json.dumps({"error": "Bu kullanici adi zaten alinmis"}), status_code=409, media_type="application/json")

    old_username = user.username
    user.username = req.username
    db.commit()
    logger.info("Kullanici adi degistirildi: %s -> %s", old_username, req.username)
    return {"user_id": user.user_id, "username": user.username}


@app.put("/api/auth/password")
@limiter.limit("30/minute")
async def change_password(request: Request, req: PasswordChangeRequest, db: Session = Depends(get_db)):
    """Kullanici sifresini degistir."""
    if not req.new_password or len(req.new_password) < 4:
        return Response(content=json.dumps({"error": "Yeni sifre en az 4 karakter olmali"}), status_code=400, media_type="application/json")

    user = db.query(User).filter(User.user_id == req.user_id).first()
    if not user:
        return Response(content=json.dumps({"error": "Kullanici bulunamadi"}), status_code=404, media_type="application/json")

    if not verify_password(req.old_password, user.password_hash, db, user):
        return Response(content=json.dumps({"error": "Mevcut sifre hatali"}), status_code=401, media_type="application/json")

    user.password_hash = hash_password(req.new_password)
    db.commit()
    logger.info("Kullanici sifresi degistirildi: user_id=%s", req.user_id)
    return {"ok": True, "message": "Sifre basariyla degistirildi"}


@app.get("/api/auth/profile")
@limiter.limit("30/minute")
async def get_profile(request: Request, user_id: str, db: Session = Depends(get_db)):
    """Kullanici profil bilgilerini getir."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        return Response(content=json.dumps({"error": "Kullanici bulunamadi"}), status_code=404, media_type="application/json")

    return {
        "user_id": user.user_id,
        "username": user.username,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


# ========== Sohbet Gecmisi API ==========

@app.get("/api/sessions")
@limiter.limit("30/minute")
async def list_sessions(request: Request, user_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Kullanicinin sohbet oturumlarini listele (soft-deleted olanlari haric tut)."""
    query = db.query(
        ChatHistory.session_id,
        func.min(ChatHistory.id).label("first_id"),
        func.max(ChatHistory.id).label("last_id"),
    ).filter(
        ChatHistory.role == "user",
        ChatHistory.deleted_at.is_(None),
    )

    if user_id:
        query = query.filter(ChatHistory.user_id == user_id)

    sessions = (
        query
        .group_by(ChatHistory.session_id)
        .order_by(func.max(ChatHistory.id).desc())
        .limit(50)
        .all()
    )

    # Fetch custom titles and folder_ids for all session ids
    session_ids = [s.session_id for s in sessions]
    meta_map = {}
    folder_map = {}
    if session_ids:
        metas = db.query(SessionMeta).filter(SessionMeta.session_id.in_(session_ids)).all()
        for m in metas:
            if m.custom_title:
                meta_map[m.session_id] = m.custom_title
            folder_map[m.session_id] = m.folder_id

    result = []
    for s in sessions:
        # Use custom title if exists, otherwise derive from first message
        custom_title = meta_map.get(s.session_id)
        if custom_title:
            title = custom_title
        else:
            first_msg = db.query(ChatHistory).filter(
                ChatHistory.session_id == s.session_id,
                ChatHistory.role == "user",
                ChatHistory.deleted_at.is_(None),
            ).order_by(ChatHistory.id.asc()).first()

            if not first_msg:
                continue
            title = first_msg.content[:50]
            if len(first_msg.content) > 50:
                title += "..."

        result.append({
            "session_id": s.session_id,
            "title": title,
            "folder_id": folder_map.get(s.session_id),
        })

    return result


@app.delete("/api/sessions/{session_id}")
@limiter.limit("30/minute")
async def delete_session(request: Request, session_id: str, user_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Belirli bir sohbet oturumunu soft-delete yap (cop kutusuna gonder)."""
    if user_id:
        # Sadece bu kullaniciya ait sohbeti kontrol et
        first = db.query(ChatHistory).filter(
            ChatHistory.session_id == session_id, ChatHistory.user_id == user_id
        ).first()
        if not first:
            return {"error": "Bu sohbet size ait degil"}

    now = datetime.utcnow()
    db.query(ChatHistory).filter(
        ChatHistory.session_id == session_id
    ).update({"deleted_at": now})
    db.commit()
    logger.info("Sohbet oturumu cop kutusuna tasindi: %s", session_id)
    return {"ok": True}


class SessionTitleUpdate(BaseModel):
    title: str
    user_id: Optional[str] = None


@app.put("/api/sessions/{session_id}/title")
@limiter.limit("30/minute")
async def update_session_title(request: Request, session_id: str, req: SessionTitleUpdate, db: Session = Depends(get_db)):
    """Sohbet basligini duzenle."""
    if req.user_id:
        # Yetki kontrolu: bu oturum kullaniciya ait mi?
        first = db.query(ChatHistory).filter(
            ChatHistory.session_id == session_id, ChatHistory.user_id == req.user_id
        ).first()
        if not first:
            return Response(
                content=json.dumps({"error": "Bu sohbet size ait degil"}),
                status_code=403,
                media_type="application/json",
            )

    meta = db.query(SessionMeta).filter(SessionMeta.session_id == session_id).first()
    if meta:
        meta.custom_title = req.title
    else:
        meta = SessionMeta(session_id=session_id, custom_title=req.title)
        db.add(meta)
    db.commit()
    logger.info("Sohbet basligi guncellendi: session=%s, yeni_baslik=%s", session_id, req.title)
    return {"ok": True, "session_id": session_id, "title": req.title}


@app.get("/api/sessions/{session_id}/messages")
@limiter.limit("30/minute")
async def get_session_messages(request: Request, session_id: str, db: Session = Depends(get_db)):
    """Belirli bir oturumun tum mesajlarini getir."""
    messages = (
        db.query(ChatHistory)
        .filter(ChatHistory.session_id == session_id)
        .order_by(ChatHistory.id.asc())
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in messages]


# ========== Trash / Cop Kutusu API (Feature 3) ==========

@app.get("/api/trash")
@limiter.limit("30/minute")
async def list_trash(request: Request, user_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Soft-deleted sohbet oturumlarini listele."""
    query = db.query(
        ChatHistory.session_id,
        func.min(ChatHistory.id).label("first_id"),
        func.max(ChatHistory.deleted_at).label("deleted_at"),
    ).filter(
        ChatHistory.role == "user",
        ChatHistory.deleted_at.isnot(None),
    )

    if user_id:
        query = query.filter(ChatHistory.user_id == user_id)

    sessions = (
        query
        .group_by(ChatHistory.session_id)
        .order_by(func.max(ChatHistory.deleted_at).desc())
        .limit(50)
        .all()
    )

    result = []
    for s in sessions:
        first_msg = db.query(ChatHistory).filter(
            ChatHistory.session_id == s.session_id,
            ChatHistory.role == "user",
        ).order_by(ChatHistory.id.asc()).first()

        if first_msg:
            title = first_msg.content[:50]
            if len(first_msg.content) > 50:
                title += "..."
            deleted_at_str = s.deleted_at.isoformat() if s.deleted_at else None
            result.append({
                "session_id": s.session_id,
                "title": title,
                "deleted_at": deleted_at_str,
            })

    return result


@app.post("/api/trash/{session_id}/restore")
@limiter.limit("30/minute")
async def restore_session(request: Request, session_id: str, db: Session = Depends(get_db)):
    """Cop kutusundaki sohbeti geri yukle (deleted_at = NULL)."""
    count = db.query(ChatHistory).filter(
        ChatHistory.session_id == session_id,
        ChatHistory.deleted_at.isnot(None),
    ).update({"deleted_at": None})
    db.commit()
    logger.info("Sohbet oturumu geri yuklendi: %s (%d mesaj)", session_id, count)
    return {"ok": True, "restored_count": count}


@app.delete("/api/trash/{session_id}/permanent")
@limiter.limit("30/minute")
async def permanent_delete_session(request: Request, session_id: str, db: Session = Depends(get_db)):
    """Cop kutusundaki sohbeti kalici olarak sil."""
    count = db.query(ChatHistory).filter(
        ChatHistory.session_id == session_id,
    ).delete()
    db.commit()
    logger.info("Sohbet oturumu kalici olarak silindi: %s (%d mesaj)", session_id, count)
    return {"ok": True, "deleted_count": count}


@app.delete("/api/trash/empty")
@limiter.limit("30/minute")
async def empty_trash(request: Request, user_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Cop kutusunu tamamen bosalt - tum soft-deleted oturumlari kalici sil."""
    query = db.query(ChatHistory).filter(ChatHistory.deleted_at.isnot(None))
    if user_id:
        query = query.filter(ChatHistory.user_id == user_id)
    count = query.delete()
    db.commit()
    logger.info("Cop kutusu bosaltildi: user_id=%s, %d mesaj silindi", user_id, count)
    return {"ok": True, "deleted_count": count}


# ========== Chat Folders API ==========

class ChatFolderCreate(BaseModel):
    user_id: str
    name: str


class SessionMoveRequest(BaseModel):
    folder_id: Optional[int] = None
    user_id: Optional[str] = None


@app.get("/api/chat-folders")
@limiter.limit("30/minute")
async def list_chat_folders(request: Request, user_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Kullanicinin sohbet klasorlerini listele."""
    if not user_id:
        return []
    folders = (
        db.query(ChatFolder)
        .filter(ChatFolder.user_id == user_id)
        .order_by(ChatFolder.created_at.asc())
        .all()
    )
    logger.info("Sohbet klasorleri listelendi: user_id=%s, adet=%d", user_id, len(folders))
    return [{"id": f.id, "name": f.name} for f in folders]


@app.post("/api/chat-folders")
@limiter.limit("30/minute")
async def create_chat_folder(request: Request, req: ChatFolderCreate, db: Session = Depends(get_db)):
    """Yeni sohbet klasoru olustur."""
    folder = ChatFolder(user_id=req.user_id, name=req.name)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    logger.info("Yeni sohbet klasoru olusturuldu: user_id=%s, name=%s", req.user_id, req.name)
    return {"id": folder.id, "name": folder.name}


@app.delete("/api/chat-folders/{folder_id}")
@limiter.limit("30/minute")
async def delete_chat_folder(request: Request, folder_id: int, db: Session = Depends(get_db)):
    """Sohbet klasorunu sil. Icindeki sohbetler klasorsuz olur."""
    folder = db.query(ChatFolder).get(folder_id)
    if folder:
        # Klasordeki sohbetleri klasorsuz yap
        db.query(SessionMeta).filter(SessionMeta.folder_id == folder_id).update({"folder_id": None})
        db.delete(folder)
        db.commit()
        logger.info("Sohbet klasoru silindi: id=%d", folder_id)
    return {"ok": True}


@app.put("/api/sessions/{session_id}/move")
@limiter.limit("30/minute")
async def move_session_to_folder(request: Request, session_id: str, req: SessionMoveRequest, db: Session = Depends(get_db)):
    """Sohbeti bir klasore tasi veya klasorden cikar."""
    meta = db.query(SessionMeta).filter(SessionMeta.session_id == session_id).first()
    if meta:
        meta.folder_id = req.folder_id
    else:
        meta = SessionMeta(session_id=session_id, folder_id=req.folder_id)
        db.add(meta)
    db.commit()
    logger.info("Sohbet tasinan klasor: session=%s, folder_id=%s", session_id, req.folder_id)
    return {"ok": True, "session_id": session_id, "folder_id": req.folder_id}


# ========== Streaming Chat API (SSE) ==========

@app.post("/api/chat/stream")
@limiter.limit("10/minute")
async def chat_stream(request: Request, req: ChatRequest, db: Session = Depends(get_db)):
    """
    Streaming chat endpoint. Server-Sent Events (SSE) ile
    GPT yanitini parca parca gonderir (typewriter efekti).
    """
    session_id = req.session_id or str(uuid.uuid4())
    logger.info("Streaming chat istegi - session: %s, mesaj: %s", session_id, req.message[:80])

    # Recipe cache kontrolu
    cache_key = normalize_recipe_query(req.message)
    cached_response = None
    if cache_key:
        cached = db.query(RecipeCache).filter(RecipeCache.query_key == cache_key).first()
        if cached and cached.created_at and (datetime.utcnow() - cached.created_at).days < 7:
            cached_response = cached.response
            logger.info("Onbellekten tarif bulundu: key=%s", cache_key)

    recipes = search_recipes(db, req.message)
    recipe_context = build_recipe_context(recipes)
    messages = build_messages(db, session_id, req.message, recipe_context)

    # Kullanici mesajini hemen kaydet (user_id ile)
    db.add(ChatHistory(session_id=session_id, user_id=req.user_id, role="user", content=req.message))
    db.commit()

    # Ilk mesaj mi kontrol et (baslik yanit sonrasi olusturulacak)
    is_first_message = db.query(ChatHistory).filter(
        ChatHistory.session_id == session_id, ChatHistory.role == "user"
    ).count() == 1

    async def event_generator():
        full_reply = ""

        # Oturum ID'sini ilk event olarak gonder
        yield f"data: {json.dumps({'type': 'session_id', 'session_id': session_id})}\n\n"

        if cached_response:
            # Onbellekten yanit gonder (parcali olarak, typewriter efekti icin)
            full_reply = cached_response
            chunk_size = 20
            for i in range(0, len(cached_response), chunk_size):
                token = cached_response[i:i + chunk_size]
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
        else:
            try:
                # GPT streaming
                stream = client.chat.completions.create(
                    model="gpt-4.1-mini",
                    messages=messages,
                    temperature=0.7,
                    max_tokens=2048,
                    stream=True,
                )

                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        full_reply += token
                        yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
            except Exception as e:
                logger.error("GPT streaming hatasi: %s", str(e))
                yield f"data: {json.dumps({'type': 'error', 'message': 'Yapay zeka yanit veremedi.'})}\n\n"

            # Perplexity referanslari (sadece yeni yanit icin)
            search_term = recipes[0].name if recipes else req.message
            references = await search_references(search_term)

            # Yaniti + referanslari onbellege kaydet
            if cache_key and full_reply:
                try:
                    existing_cache = db.query(RecipeCache).filter(RecipeCache.query_key == cache_key).first()
                    if existing_cache:
                        existing_cache.response = full_reply
                        existing_cache.references_json = json.dumps(references)
                        existing_cache.created_at = datetime.utcnow()
                    else:
                        db.add(RecipeCache(query_key=cache_key, response=full_reply, references_json=json.dumps(references)))
                    db.commit()
                    logger.info("Tarif onbellege kaydedildi: key=%s", cache_key)
                except Exception as e:
                    logger.error("Onbellek kayit hatasi: %s", str(e))

        if cached_response:
            # Cache'den gelen referanslari kullan (Perplexity'ye istek atma)
            try:
                cached_entry = db.query(RecipeCache).filter(RecipeCache.query_key == cache_key).first()
                references = json.loads(cached_entry.references_json) if cached_entry and cached_entry.references_json else []
            except Exception:
                references = []

        # Yanitı DB'ye kaydet
        db.add(ChatHistory(session_id=session_id, user_id=req.user_id, role="assistant", content=full_reply))
        db.commit()

        # Ilk mesajsa GPT yanitindan dogru yazimli baslik olustur
        if is_first_message and full_reply:
            title = generate_session_title(req.message, full_reply)
            existing_meta = db.query(SessionMeta).filter(SessionMeta.session_id == session_id).first()
            if not existing_meta:
                db.add(SessionMeta(session_id=session_id, custom_title=title))
            else:
                existing_meta.custom_title = title
            db.commit()
            logger.info("Otomatik sohbet basligi (GPT'den): %s -> %s", session_id[:8], title)

        yield f"data: {json.dumps({'type': 'references', 'references': references})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'cached': bool(cached_response)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ========== Eski (non-streaming) endpoint (yedek) ==========

@app.post("/api/chat", response_model=ChatResponse)
@limiter.limit("10/minute")
async def chat(request: Request, req: ChatRequest, db: Session = Depends(get_db)):
    session_id = req.session_id or str(uuid.uuid4())
    logger.info("Chat istegi - session: %s, mesaj: %s", session_id, req.message[:80])

    # Cache kontrolu
    cache_key = normalize_recipe_query(req.message)
    if cache_key:
        cached = db.query(RecipeCache).filter(RecipeCache.query_key == cache_key).first()
        if cached and cached.created_at and (datetime.utcnow() - cached.created_at).days < 7:
            logger.info("Non-streaming: onbellekten tarif bulundu: key=%s", cache_key)
            references = json.loads(cached.references_json) if cached.references_json else []
            db.add(ChatHistory(session_id=session_id, user_id=req.user_id, role="user", content=req.message))
            db.add(ChatHistory(session_id=session_id, user_id=req.user_id, role="assistant", content=cached.response))
            db.commit()
            return ChatResponse(reply=cached.response, session_id=session_id, references=references)

    recipes = search_recipes(db, req.message)
    recipe_context = build_recipe_context(recipes)
    messages = build_messages(db, session_id, req.message, recipe_context)

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        logger.error("GPT chat hatasi: %s", str(e))
        reply = "Bir hata olustu, lutfen tekrar deneyin."

    references = []
    search_term = recipes[0].name if recipes else req.message
    references = await search_references(search_term)

    # Cache'e kaydet
    if cache_key and reply and reply != "Bir hata olustu, lutfen tekrar deneyin.":
        try:
            existing_cache = db.query(RecipeCache).filter(RecipeCache.query_key == cache_key).first()
            if existing_cache:
                existing_cache.response = reply
                existing_cache.references_json = json.dumps(references)
                existing_cache.created_at = datetime.utcnow()
            else:
                db.add(RecipeCache(query_key=cache_key, response=reply, references_json=json.dumps(references)))
            db.commit()
        except Exception as e:
            logger.error("Non-streaming cache kayit hatasi: %s", str(e))

    db.add(ChatHistory(session_id=session_id, user_id=req.user_id, role="user", content=req.message))
    db.add(ChatHistory(session_id=session_id, user_id=req.user_id, role="assistant", content=reply))
    db.commit()

    return ChatResponse(reply=reply, session_id=session_id, references=references)


@app.get("/api/recipes")
@limiter.limit("30/minute")
async def list_recipes(request: Request, category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Recipe)
    if category:
        query = query.filter(Recipe.category == category)
    return query.all()


# ================================================================
# TARIF DEFTERI API
# ================================================================

class BookCreate(BaseModel):
    user_id: str
    name: str

class FolderCreate(BaseModel):
    name: str

class RenameRequest(BaseModel):
    name: str

class SaveRecipeRequest(BaseModel):
    title: str
    content: str
    source_session: Optional[str] = None

class EditRecipeRequest(BaseModel):
    title: str
    content: str


# --- Defter (Book) CRUD ---

@app.get("/api/books")
@limiter.limit("30/minute")
async def list_books(request: Request, user_id: str, db: Session = Depends(get_db)):
    return [
        {"id": b.id, "name": b.name}
        for b in db.query(RecipeBook).filter(RecipeBook.user_id == user_id).order_by(RecipeBook.id).all()
    ]

@app.post("/api/books")
@limiter.limit("30/minute")
async def create_book(request: Request, req: BookCreate, db: Session = Depends(get_db)):
    book = RecipeBook(user_id=req.user_id, name=req.name)
    db.add(book)
    db.commit()
    db.refresh(book)
    logger.info("Yeni defter olusturuldu: %s", req.name)
    return {"id": book.id, "name": book.name}

@app.put("/api/books/{book_id}")
@limiter.limit("30/minute")
async def rename_book(request: Request, book_id: int, req: RenameRequest, db: Session = Depends(get_db)):
    book = db.query(RecipeBook).get(book_id)
    if not book:
        return {"error": "Defter bulunamadi"}
    book.name = req.name
    db.commit()
    return {"id": book.id, "name": book.name}

@app.delete("/api/books/{book_id}")
@limiter.limit("30/minute")
async def delete_book(request: Request, book_id: int, user_id: Optional[str] = None, db: Session = Depends(get_db)):
    book = db.query(RecipeBook).get(book_id)
    if not book:
        return {"ok": True}
    if user_id and book.user_id != user_id:
        return Response(content=json.dumps({"error": "Bu defter size ait degil"}), status_code=403, media_type="application/json")
    db.delete(book)
    db.commit()
    logger.info("Defter silindi: id=%d", book_id)
    return {"ok": True}


# --- Klasor (Folder) CRUD ---

@app.get("/api/books/{book_id}/folders")
@limiter.limit("30/minute")
async def list_folders(request: Request, book_id: int, db: Session = Depends(get_db)):
    folders = db.query(BookFolder).filter(BookFolder.book_id == book_id).order_by(BookFolder.sort_order).all()
    return [
        {"id": f.id, "name": f.name, "recipe_count": len(f.recipes)}
        for f in folders
    ]

@app.post("/api/books/{book_id}/folders")
@limiter.limit("30/minute")
async def create_folder(request: Request, book_id: int, req: FolderCreate, db: Session = Depends(get_db)):
    folder = BookFolder(book_id=book_id, name=req.name)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return {"id": folder.id, "name": folder.name}

@app.delete("/api/folders/{folder_id}")
@limiter.limit("30/minute")
async def delete_folder(request: Request, folder_id: int, db: Session = Depends(get_db)):
    folder = db.query(BookFolder).get(folder_id)
    if folder:
        db.delete(folder)
        db.commit()
    return {"ok": True}


# --- Kayitli Tarifler ---

@app.get("/api/folders/{folder_id}/recipes")
@limiter.limit("30/minute")
async def list_saved_recipes(request: Request, folder_id: int, db: Session = Depends(get_db)):
    recipes = (
        db.query(SavedRecipe)
        .filter(SavedRecipe.folder_id == folder_id)
        .order_by(
            SavedRecipe.rating.desc().nullslast(),
            SavedRecipe.saved_at.desc(),
        )
        .all()
    )
    return [{"id": r.id, "title": r.title, "content": r.content, "share_token": r.share_token, "rating": r.rating} for r in recipes]

@app.post("/api/folders/{folder_id}/recipes")
@limiter.limit("30/minute")
async def save_recipe(request: Request, folder_id: int, req: SaveRecipeRequest, db: Session = Depends(get_db)):
    recipe = SavedRecipe(
        folder_id=folder_id,
        title=req.title,
        content=req.content,
        source_session=req.source_session,
    )
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    logger.info("Tarif kaydedildi: %s (folder_id=%d)", req.title, folder_id)
    return {"id": recipe.id, "title": recipe.title}

@app.delete("/api/saved-recipes/{recipe_id}")
@limiter.limit("30/minute")
async def delete_saved_recipe(request: Request, recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(SavedRecipe).get(recipe_id)
    if recipe:
        db.delete(recipe)
        db.commit()
    return {"ok": True}


# --- Tarif Duzenleme ---

@app.put("/api/saved-recipes/{recipe_id}")
@limiter.limit("30/minute")
async def edit_saved_recipe(request: Request, recipe_id: int, req: EditRecipeRequest, db: Session = Depends(get_db)):
    """Kayitli tarifi duzenle."""
    recipe = db.query(SavedRecipe).get(recipe_id)
    if not recipe:
        return Response(content="Tarif bulunamadi", status_code=404)
    recipe.title = req.title
    recipe.content = req.content
    db.commit()
    logger.info("Tarif duzenlendi: id=%d, baslik=%s", recipe_id, req.title)
    return {"id": recipe.id, "title": recipe.title, "content": recipe.content}


# --- Tarif Puanlama ---

class RateRecipeRequest(BaseModel):
    rating: int


@app.put("/api/saved-recipes/{recipe_id}/rate")
@limiter.limit("30/minute")
async def rate_saved_recipe(request: Request, recipe_id: int, req: RateRecipeRequest, db: Session = Depends(get_db)):
    """Kayitli tarife puan ver (1-5)."""
    if req.rating < 1 or req.rating > 5:
        return Response(
            content=json.dumps({"error": "Puan 1 ile 5 arasinda olmali"}),
            status_code=400,
            media_type="application/json",
        )
    recipe = db.query(SavedRecipe).get(recipe_id)
    if not recipe:
        return Response(content=json.dumps({"error": "Tarif bulunamadi"}), status_code=404, media_type="application/json")
    recipe.rating = req.rating
    db.commit()
    logger.info("Tarif puanlandi: id=%d, puan=%d", recipe_id, req.rating)
    return {"id": recipe.id, "title": recipe.title, "rating": recipe.rating}


# --- Tarif Paylasimi ---

@app.post("/api/saved-recipes/{recipe_id}/share")
@limiter.limit("30/minute")
async def share_recipe(request: Request, recipe_id: int, db: Session = Depends(get_db)):
    """Tarif icin paylasim linki olustur."""
    recipe = db.query(SavedRecipe).get(recipe_id)
    if not recipe:
        return Response(content="Tarif bulunamadi", status_code=404)

    if not recipe.share_token:
        recipe.share_token = secrets.token_urlsafe(16)
        db.commit()

    share_url = str(request.base_url).rstrip("/") + "/api/shared/" + recipe.share_token
    logger.info("Tarif paylasim linki olusturuldu: id=%d", recipe_id)
    return {"share_token": recipe.share_token, "share_url": share_url}


@app.get("/api/shared/{token}", response_class=HTMLResponse)
@limiter.limit("30/minute")
async def view_shared_recipe(request: Request, token: str, db: Session = Depends(get_db)):
    """Paylasilan tarifi HTML sayfasi olarak goster."""
    recipe = db.query(SavedRecipe).filter(SavedRecipe.share_token == token).first()
    if not recipe:
        return HTMLResponse(content="<h1>Tarif bulunamadi</h1><p>Bu paylasim linki gecersiz veya kaldirilmis.</p>", status_code=404)

    import html as html_lib
    safe_title = html_lib.escape(recipe.title)
    html_content = md_lib.markdown(recipe.content, extensions=["extra"])
    page = f"""<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{safe_title} - Ascibasi</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {{ font-family: 'Inter', sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #eee; }}
        h1 {{ color: #e74c3c; font-size: 24px; margin-bottom: 8px; }}
        .badge {{ display: inline-block; padding: 4px 12px; background: rgba(192,57,43,0.2); border: 1px solid rgba(192,57,43,0.4); border-radius: 14px; color: #e78b84; font-size: 12px; margin-bottom: 20px; }}
        .content {{ background: #1e2a4a; padding: 24px; border-radius: 12px; line-height: 1.6; }}
        .content strong {{ color: #e74c3c; }}
        .content h1, .content h2, .content h3 {{ margin: 14px 0 6px; }}
        .content ul, .content ol {{ padding-left: 22px; }}
        .content p {{ margin-bottom: 8px; }}
        .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 13px; }}
    </style>
</head>
<body>
    <h1>{safe_title}</h1>
    <div class="badge">Ascibasi - Turk Mutfagi Tarif Asistani</div>
    <div class="content">{html_content}</div>
    <div class="footer">Ascibasi ile olusturuldu</div>
</body>
</html>"""
    return HTMLResponse(content=page)


# --- Kayitli Tariflerde Arama ---

@app.get("/api/saved-recipes/search")
@limiter.limit("30/minute")
async def search_saved_recipes(request: Request, user_id: str, q: str, db: Session = Depends(get_db)):
    """Kullanicinin kayitli tarifleri arasinda arama yap."""
    if not q or len(q.strip()) < 2:
        return []

    pattern = f"%{q.strip()}%"

    # Kullanicinin tum defterlerini bul
    book_ids = [b.id for b in db.query(RecipeBook).filter(RecipeBook.user_id == user_id).all()]
    if not book_ids:
        return []

    # Bu defterlerdeki tum klasorleri bul
    folder_ids = [f.id for f in db.query(BookFolder).filter(BookFolder.book_id.in_(book_ids)).all()]
    if not folder_ids:
        return []

    # Tarif ara
    recipes = (
        db.query(SavedRecipe)
        .filter(
            SavedRecipe.folder_id.in_(folder_ids),
            or_(
                SavedRecipe.title.ilike(pattern),
                SavedRecipe.content.ilike(pattern),
            )
        )
        .limit(20)
        .all()
    )

    return [{"id": r.id, "title": r.title, "folder_id": r.folder_id} for r in recipes]


# --- Defter Agaci (Modal icin) ---

@app.get("/api/books-tree")
@limiter.limit("30/minute")
async def books_tree(request: Request, user_id: str, db: Session = Depends(get_db)):
    books = db.query(RecipeBook).filter(RecipeBook.user_id == user_id).order_by(RecipeBook.id).all()
    return [
        {
            "id": b.id,
            "name": b.name,
            "folders": [
                {"id": f.id, "name": f.name, "recipe_count": len(f.recipes)}
                for f in b.folders
            ]
        }
        for b in books
    ]


# --- PDF Export ---

FONT_DIR = os.path.join(os.path.dirname(__file__), "static", "fonts")

def generate_pdf(book_name: str, sections: list) -> bytes:
    """
    sections: [{"folder_name": str, "recipes": [{"title": str, "content": str}]}]
    """
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)

    # Turkce karakter destegi icin DejaVu Sans
    pdf.add_font("DejaVu", "", os.path.join(FONT_DIR, "DejaVuSans.ttf"), uni=True)
    pdf.add_font("DejaVu", "B", os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf"), uni=True)

    # Kapak sayfasi
    pdf.add_page()
    pdf.set_font("DejaVu", "B", 28)
    pdf.ln(60)
    pdf.cell(0, 20, book_name, align="C", ln=True)
    pdf.set_font("DejaVu", "", 12)
    pdf.ln(10)
    pdf.cell(0, 10, "Ascibasi - Turk Mutfagi Tarif Defteri", align="C", ln=True)

    for section in sections:
        # Klasor basligi
        pdf.add_page()
        pdf.set_font("DejaVu", "B", 20)
        pdf.cell(0, 15, section["folder_name"], ln=True)
        pdf.ln(5)

        for recipe in section["recipes"]:
            # Tarif basligi
            pdf.set_font("DejaVu", "B", 14)
            pdf.cell(0, 10, recipe["title"], ln=True)
            pdf.ln(2)

            # Tarif icerigi - markdown'i duz metne cevir
            pdf.set_font("DejaVu", "", 11)
            content = recipe["content"]
            left = pdf.l_margin
            for line in content.split("\n"):
                stripped = line.strip()
                if not stripped:
                    pdf.ln(3)
                    continue

                pdf.set_x(left)
                clean = stripped.replace("**", "").replace("*", "")

                if stripped.startswith("###"):
                    pdf.set_font("DejaVu", "B", 12)
                    pdf.cell(0, 7, clean.lstrip("#").strip(), ln=True)
                    pdf.set_font("DejaVu", "", 11)
                elif stripped.startswith("##"):
                    pdf.set_font("DejaVu", "B", 13)
                    pdf.cell(0, 8, clean.lstrip("#").strip(), ln=True)
                    pdf.set_font("DejaVu", "", 11)
                elif stripped.startswith("#"):
                    pdf.set_font("DejaVu", "B", 14)
                    pdf.cell(0, 9, clean.lstrip("#").strip(), ln=True)
                    pdf.set_font("DejaVu", "", 11)
                elif stripped.startswith("- ") or stripped.startswith("* "):
                    text = clean[2:].strip()
                    pdf.cell(0, 6, "   " + chr(8226) + " " + text, ln=True)
                elif stripped[0:1].isdigit() and "." in stripped[:4]:
                    pdf.cell(0, 6, "   " + clean, ln=True)
                else:
                    w = pdf.w - pdf.l_margin - pdf.r_margin
                    pdf.multi_cell(w, 6, clean)

            pdf.ln(8)
            # Ayirici cizgi
            pdf.set_draw_color(200, 200, 200)
            pdf.line(pdf.get_x(), pdf.get_y(), pdf.get_x() + 170, pdf.get_y())
            pdf.ln(5)

    return bytes(pdf.output())


class SaveRecipeToBookRequest(BaseModel):
    """Klasorsuz direkt deftere kaydetme."""
    title: str
    content: str
    source_session: Optional[str] = None
    folder_name: Optional[str] = None  # None ise "Genel" klasorune kaydeder


@app.post("/api/books/{book_id}/save-recipe")
@limiter.limit("30/minute")
async def save_recipe_to_book(request: Request, book_id: int, req: SaveRecipeToBookRequest, db: Session = Depends(get_db)):
    """Tarifi direkt deftere kaydet. Klasor secilmemisse 'Genel' klasoru olusturulur."""
    book = db.query(RecipeBook).get(book_id)
    if not book:
        return Response(content="Defter bulunamadi", status_code=404)

    folder_name = req.folder_name or "Genel"
    folder = db.query(BookFolder).filter(
        BookFolder.book_id == book_id,
        BookFolder.name == folder_name,
    ).first()

    if not folder:
        folder = BookFolder(book_id=book_id, name=folder_name)
        db.add(folder)
        db.commit()
        db.refresh(folder)

    recipe = SavedRecipe(
        folder_id=folder.id,
        title=req.title,
        content=req.content,
        source_session=req.source_session,
    )
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    logger.info("Tarif deftere kaydedildi: %s -> %s/%s", req.title, book.name, folder_name)
    return {"id": recipe.id, "title": recipe.title, "folder": folder.name}


# --- PDF Export (Defter, Klasor, Tek Tarif) ---

@app.get("/api/books/{book_id}/export-pdf")
@limiter.limit("30/minute")
async def export_book_pdf(request: Request, book_id: int, db: Session = Depends(get_db)):
    book = db.query(RecipeBook).get(book_id)
    if not book:
        return Response(content="Defter bulunamadi", status_code=404)

    sections = []
    for folder in book.folders:
        recipes = db.query(SavedRecipe).filter(SavedRecipe.folder_id == folder.id).all()
        if recipes:
            sections.append({
                "folder_name": folder.name,
                "recipes": [{"title": r.title, "content": r.content} for r in recipes]
            })

    if not sections:
        return Response(content="Defterde tarif yok", status_code=400)

    try:
        pdf_bytes = generate_pdf(book.name, sections)
    except Exception as e:
        logger.error("PDF olusturma hatasi (defter): %s", str(e))
        return Response(content="PDF olusturulamadi", status_code=500)

    filename = book.name.replace(" ", "_") + ".pdf"
    logger.info("PDF indirildi: defter=%s", book.name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/folders/{folder_id}/export-pdf")
@limiter.limit("30/minute")
async def export_folder_pdf(request: Request, folder_id: int, db: Session = Depends(get_db)):
    folder = db.query(BookFolder).get(folder_id)
    if not folder:
        return Response(content="Klasor bulunamadi", status_code=404)

    recipes = db.query(SavedRecipe).filter(SavedRecipe.folder_id == folder_id).all()
    if not recipes:
        return Response(content="Klasorde tarif yok", status_code=400)

    sections = [{
        "folder_name": folder.name,
        "recipes": [{"title": r.title, "content": r.content} for r in recipes]
    }]
    try:
        pdf_bytes = generate_pdf(folder.book.name + " - " + folder.name, sections)
    except Exception as e:
        logger.error("PDF olusturma hatasi (klasor): %s", str(e))
        return Response(content="PDF olusturulamadi", status_code=500)

    filename = folder.name.replace(" ", "_") + ".pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/saved-recipes/{recipe_id}/export-pdf")
@limiter.limit("30/minute")
async def export_recipe_pdf(request: Request, recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(SavedRecipe).get(recipe_id)
    if not recipe:
        return Response(content="Tarif bulunamadi", status_code=404)

    sections = [{
        "folder_name": recipe.title,
        "recipes": [{"title": recipe.title, "content": recipe.content}]
    }]
    try:
        pdf_bytes = generate_pdf(recipe.title, sections)
    except Exception as e:
        logger.error("PDF olusturma hatasi (tarif): %s", str(e))
        return Response(content="PDF olusturulamadi", status_code=500)

    filename = recipe.title.replace(" ", "_") + ".pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ================================================================
# ALISVERIS LISTESI API
# ================================================================

class ShoppingListCreate(BaseModel):
    user_id: str
    title: str
    items: List[str]


class ShoppingListFromRecipe(BaseModel):
    user_id: str
    recipe_content: str


def extract_ingredients_from_recipe(content: str) -> List[str]:
    """Tarif markdown metninden malzemeleri cikar."""
    lines = content.split("\n")
    ingredients = []
    in_ingredients_section = False

    for line in lines:
        stripped = line.strip()
        lower = stripped.lower()

        # Malzeme bolumunu tespit et
        if "malzeme" in lower and (stripped.startswith("#") or stripped.startswith("**")):
            in_ingredients_section = True
            continue

        # Baska bir baslik gelirse malzeme bolumunden cik
        if in_ingredients_section and (stripped.startswith("#") or (stripped.startswith("**") and not stripped.startswith("- **"))):
            if "malzeme" not in lower:
                in_ingredients_section = False
                continue

        # Malzeme satirlarini topla
        if in_ingredients_section:
            if stripped.startswith("- ") or stripped.startswith("* "):
                item = stripped[2:].strip().replace("**", "").strip()
                if item:
                    ingredients.append(item)
            elif re.match(r"^\d+[\.\)]\s", stripped):
                item = re.sub(r"^\d+[\.\)]\s*", "", stripped).strip()
                if item:
                    ingredients.append(item)

    return ingredients


@app.get("/api/shopping-lists")
@limiter.limit("30/minute")
async def list_shopping_lists(request: Request, user_id: str, db: Session = Depends(get_db)):
    """Kullanicinin alisveris listelerini getir."""
    lists = (
        db.query(ShoppingList)
        .filter(ShoppingList.user_id == user_id)
        .order_by(ShoppingList.created_at.desc())
        .all()
    )
    return [
        {
            "id": sl.id,
            "title": sl.title,
            "items": json.loads(sl.items) if sl.items else [],
            "created_at": sl.created_at.isoformat() if sl.created_at else None,
        }
        for sl in lists
    ]


@app.post("/api/shopping-lists")
@limiter.limit("30/minute")
async def create_shopping_list(request: Request, req: ShoppingListCreate, db: Session = Depends(get_db)):
    """Yeni alisveris listesi olustur."""
    sl = ShoppingList(
        user_id=req.user_id,
        title=req.title,
        items=json.dumps(req.items, ensure_ascii=False),
    )
    db.add(sl)
    db.commit()
    db.refresh(sl)
    logger.info("Alisveris listesi olusturuldu: user=%s, baslik=%s", req.user_id, req.title)
    return {
        "id": sl.id,
        "title": sl.title,
        "items": req.items,
        "created_at": sl.created_at.isoformat() if sl.created_at else None,
    }


@app.delete("/api/shopping-lists/{list_id}")
@limiter.limit("30/minute")
async def delete_shopping_list(request: Request, list_id: int, db: Session = Depends(get_db)):
    """Alisveris listesini sil."""
    sl = db.query(ShoppingList).get(list_id)
    if sl:
        db.delete(sl)
        db.commit()
        logger.info("Alisveris listesi silindi: id=%d", list_id)
    return {"ok": True}


@app.post("/api/shopping-lists/from-recipe")
@limiter.limit("30/minute")
async def create_shopping_list_from_recipe(request: Request, req: ShoppingListFromRecipe, db: Session = Depends(get_db)):
    """Tarif iceriginden malzemeleri cikarip alisveris listesi olustur."""
    ingredients = extract_ingredients_from_recipe(req.recipe_content)
    if not ingredients:
        return Response(
            content=json.dumps({"error": "Tariften malzeme cikarilamadi"}),
            status_code=400,
            media_type="application/json",
        )

    # Basliktan ilk 50 karakteri al
    first_line = req.recipe_content.split("\n")[0].strip().replace("#", "").replace("**", "").strip()
    title = first_line[:50] if first_line else "Tarif Malzemeleri"

    sl = ShoppingList(
        user_id=req.user_id,
        title=title,
        items=json.dumps(ingredients, ensure_ascii=False),
    )
    db.add(sl)
    db.commit()
    db.refresh(sl)
    logger.info("Tariften alisveris listesi olusturuldu: user=%s, malzeme_sayisi=%d", req.user_id, len(ingredients))
    return {
        "id": sl.id,
        "title": sl.title,
        "items": ingredients,
        "created_at": sl.created_at.isoformat() if sl.created_at else None,
    }

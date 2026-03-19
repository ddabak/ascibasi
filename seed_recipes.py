"""Veritabanına örnek Türk yemek tariflerini ekler."""

from database import init_db, SessionLocal, Recipe

RECIPES = [
    {
        "name": "Karnıyarık",
        "category": "Ana Yemek",
        "region": "Güneydoğu Anadolu",
        "ingredients": "6 adet patlıcan, 300g kıyma, 2 adet soğan, 3 adet domates, 2 adet sivri biber, 3 diş sarımsak, 2 yemek kaşığı salça, tuz, karabiber, pul biber, sıvı yağ",
        "instructions": "1. Patlıcanları alacalı soyun ve kızgın yağda kızartın. 2. Kıymayı soğanla kavurun, salça ve baharatları ekleyin. 3. Doğranmış domates ve biberleri ekleyip 5 dk pişirin. 4. Patlıcanları ortadan yarın, içine harcı doldurun. 5. Üzerine domates dilimleri koyun. 6. Önceden ısıtılmış 180°C fırında 30-35 dk pişirin.",
    },
    {
        "name": "Mercimek Çorbası",
        "category": "Çorba",
        "region": "Tüm Türkiye",
        "ingredients": "2 su bardağı kırmızı mercimek, 1 adet soğan, 1 adet havuç, 1 adet patates, 1 yemek kaşığı salça, 6 su bardağı su, tuz, karabiber, kimyon, tereyağı, pul biber, limon",
        "instructions": "1. Mercimek, doğranmış soğan, havuç ve patatesi tencereye alın. 2. Üzerine suyu ekleyip kaynatın. 3. Kısık ateşte 25-30 dk pişirin. 4. Blenderdan geçirin. 5. Salça, tuz ve baharatları ekleyin. 6. Tereyağında pul biber yakıp üzerine gezdirin. Limonla servis edin.",
    },
    {
        "name": "İskender Kebap",
        "category": "Ana Yemek",
        "region": "Marmara - Bursa",
        "ingredients": "500g döner eti (kuzu veya dana), 4 adet pide, 3 yemek kaşığı tereyağı, 2 su bardağı domates sosu (rendelenmiş domates, salça, tuz), 1 su bardağı yoğurt, tuz",
        "instructions": "1. Pideleri küçük parçalar halinde kesin ve tabağa dizin. 2. Domates sosunu kaynatıp pidelerin üzerine gezdirin. 3. Döner etini pidelerin üzerine yerleştirin. 4. Yandan yoğurt koyun. 5. Tereyağını eritip kızarıncaya kadar ısıtın ve etin üzerine gezdirin. 6. Sıcak servis edin.",
    },
    {
        "name": "Mantı",
        "category": "Ana Yemek",
        "region": "İç Anadolu - Kayseri",
        "ingredients": "Hamur: 3 su bardağı un, 1 yumurta, yarım su bardağı su, 1 çay kaşığı tuz. İç: 250g kıyma, 1 soğan, tuz, karabiber. Sos: 2 su bardağı yoğurt, 3 diş sarımsak. Üzeri: 2 yemek kaşığı tereyağı, 1 yemek kaşığı pul biber, 1 çay kaşığı nane",
        "instructions": "1. Hamur malzemelerini yoğurun, 30 dk dinlendirin. 2. Kıyma, rendelenmiş soğan ve baharatları karıştırın. 3. Hamuru ince açın, küçük kareler kesin. 4. Her karenin ortasına az harç koyup kapatın. 5. Kaynayan tuzlu suda 15-20 dk haşlayın. 6. Sarımsaklı yoğurdu üzerine dökün. 7. Tereyağında pul biber ve nane yakıp gezdirin.",
    },
    {
        "name": "Lahmacun",
        "category": "Ana Yemek",
        "region": "Güneydoğu Anadolu",
        "ingredients": "Hamur: 4 su bardağı un, 1 paket yaş maya, 1 su bardağı ılık su, 1 çay kaşığı tuz, şeker. İç: 250g kıyma, 2 soğan, 3 domates, 2 sivri biber, 1 demet maydanoz, salça, pul biber, tuz, karabiber",
        "instructions": "1. Maya, ılık su ve şekeri karıştırıp 10 dk bekletin. 2. Un ve tuzla hamur yoğurup 1 saat dinlendirin. 3. Kıyma, ince doğranmış sebzeler ve baharatları karıştırın. 4. Hamuru küçük bezlere ayırıp ince açın. 5. Üzerine harcı ince yayın. 6. 250°C fırında 8-10 dk pişirin. 7. Limon sıkıp maydanozla sararak servis edin.",
    },
    {
        "name": "Hünkar Beğendi",
        "category": "Ana Yemek",
        "region": "Marmara - İstanbul",
        "ingredients": "Et: 500g kuşbaşı kuzu eti, 2 soğan, 3 domates, 2 yemek kaşığı salça, tuz, karabiber. Beğendi: 4 patlıcan, 2 yemek kaşığı tereyağı, 2 yemek kaşığı un, 2 su bardağı süt, 100g kaşar peyniri, tuz, karabiber",
        "instructions": "1. Kuşbaşı eti soğanla kavurun. 2. Salça ve doğranmış domatesleri ekleyip kısık ateşte 1-1.5 saat pişirin. 3. Patlıcanları közleyin, kabuklarını soyun ve ezin. 4. Tereyağında unu kavurun, sütü ekleyip beşamel yapın. 5. Patlıcan ezme ve kaşar peynirini ekleyin. 6. Beğendiyi tabağa yayıp üzerine eti koyun.",
    },
    {
        "name": "İçli Köfte",
        "category": "Meze / Atıştırmalık",
        "region": "Güneydoğu Anadolu",
        "ingredients": "Dış: 2 su bardağı ince bulgur, 1 su bardağı irmik, 1 yemek kaşığı salça, tuz. İç: 250g kıyma, 2 soğan, yarım su bardağı ceviz, maydanoz, tuz, karabiber, pul biber, kimyon",
        "instructions": "1. Bulgur ve irmiği salça ile yoğurun, 20 dk dinlendirin. 2. Kıyma ve soğanı kavurun, baharatları ve cevizi ekleyin. 3. Dış hamurdan ceviz büyüklüğünde parçalar alın, içini oyun. 4. İç harcı doldurup kapatın, sivri uçlu şekil verin. 5. Kaynayan yağda kızartın veya kaynayan suda haşlayın.",
    },
    {
        "name": "Çılbır",
        "category": "Kahvaltılık",
        "region": "Tüm Türkiye",
        "ingredients": "4 yumurta, 2 su bardağı yoğurt, 2 diş sarımsak, 2 yemek kaşığı tereyağı, 1 çay kaşığı pul biber, sirke, tuz",
        "instructions": "1. Yoğurdu dövülmüş sarımsakla karıştırın. 2. Suyu kaynatın, içine bir miktar sirke ekleyin. 3. Yumurtaları teker teker poşe yapın (3-4 dk). 4. Tabağa sarımsaklı yoğurdu yayın, üzerine poşe yumurtaları koyun. 5. Tereyağını eritip pul biberle kızdırın, üzerine gezdirin.",
    },
    {
        "name": "Baklava",
        "category": "Tatlı",
        "region": "Güneydoğu Anadolu - Gaziantep",
        "ingredients": "500g baklava yufkası, 300g ceviz veya Antep fıstığı, 250g tereyağı. Şerbet: 4 su bardağı şeker, 3 su bardağı su, yarım limon suyu",
        "instructions": "1. Şerbeti kaynatın, limon suyunu ekleyin ve soğumaya bırakın. 2. Tepsiye yufkaları teker teker yağlayarak dizin (altta 8-10 kat). 3. Öğütülmüş ceviz/fıstık serin. 4. Üzerine kalan yufkaları yağlayarak dizin. 5. Baklava şeklinde kesin. 6. 170°C fırında kızarana kadar (40-45 dk) pişirin. 7. Soğuk şerbeti sıcak baklavanın üzerine dökün.",
    },
    {
        "name": "Künefe",
        "category": "Tatlı",
        "region": "Güneydoğu Anadolu - Hatay",
        "ingredients": "500g kadayıf, 250g taze tuzsuz peynir (künefe peyniri), 150g tereyağı, Antep fıstığı. Şerbet: 2 su bardağı şeker, 1.5 su bardağı su, yarım limon suyu",
        "instructions": "1. Şerbeti hazırlayıp soğutun. 2. Kadayıfı ince ince didikleyin, eritilmiş tereyağıyla karıştırın. 3. Künefe tepsisinin altına yarısını yayın. 4. Dilimlenmiş peyniri üzerine dizin. 5. Kalan kadayıfı üzerine kapatın, bastırın. 6. Kısık ateşte altı kızarana kadar pişirin, çevirin. 7. Şerbeti dökün, fıstık serpip sıcak servis edin.",
    },
    {
        "name": "Sütlaç",
        "category": "Tatlı",
        "region": "Tüm Türkiye",
        "ingredients": "1 su bardağı pirinç, 1 litre süt, 1 su bardağı şeker, 2 yemek kaşığı pirinç unu, yarım su bardağı su, 1 yumurta sarısı, vanilya",
        "instructions": "1. Pirinci yıkayıp haşlayın, süzün. 2. Pirinç unu ve suyu karıştırın. 3. Sütü kaynatın, pirinci ekleyin. 4. Pirinç unu karışımını ekleyip koyulaşana kadar karıştırın. 5. Şeker ve vanilyayı ekleyin. 6. Yumurta sarısını temperlayıp ekleyin. 7. Kaselere dökün. 8. Fırında üstü kızarana kadar pişirin.",
    },
    {
        "name": "Ezogelin Çorbası",
        "category": "Çorba",
        "region": "Güneydoğu Anadolu - Gaziantep",
        "ingredients": "1 su bardağı kırmızı mercimek, yarım su bardağı bulgur, 2 yemek kaşığı pirinç, 1 soğan, 2 yemek kaşığı salça, 1 yemek kaşığı biber salçası, 6 su bardağı su, tereyağı, pul biber, nane, tuz",
        "instructions": "1. Mercimek, bulgur ve pirinci yıkayıp tencereye alın. 2. Suyu ekleyip kaynatın, 20-25 dk pişirin. 3. Ayrı tavada soğanı yağda kavurun. 4. Salçaları ekleyip kavurun. 5. Çorbaya ekleyin, 10 dk daha pişirin. 6. Tereyağında pul biber ve nane yakıp üzerine gezdirin.",
    },
    {
        "name": "Pide",
        "category": "Ana Yemek",
        "region": "Karadeniz",
        "ingredients": "Hamur: 4 su bardağı un, 1 paket yaş maya, 1 su bardağı ılık su, yarım çay bardağı yoğurt, 3 yemek kaşığı sıvı yağ, tuz. Kıymalı İç: 300g kıyma, 2 domates, 2 sivri biber, 1 soğan, tuz, karabiber. Yumurta sarısı (üzeri için)",
        "instructions": "1. Mayayı ılık suda eritin, un, yoğurt, yağ ve tuzla hamur yoğurun. 2. 1 saat mayalandırın. 3. Kıymayı ince doğranmış sebzelerle karıştırın. 4. Hamuru 3-4 parçaya bölüp oval açın. 5. İç harcı yayın, kenarları kıvırarak kayık şekli verin. 6. Yumurta sarısı sürün. 7. 220°C fırında 15-20 dk pişirin.",
    },
    {
        "name": "Kuzu Tandır",
        "category": "Ana Yemek",
        "region": "İç Anadolu",
        "ingredients": "1.5 kg kuzu but, 4-5 adet patates, 2 soğan, 3 diş sarımsak, 1 su bardağı su, 2 yemek kaşığı tereyağı, kekik, defne yaprağı, tuz, karabiber",
        "instructions": "1. Kuzu etini tuzlayıp baharatlayın. 2. Büyük parça patates ve soğanlarla tepsiye yerleştirin. 3. Sarımsak, defne yaprağı ve kekik ekleyin. 4. Tereyağı parçalarını üzerine koyun, suyu dökün. 5. Üzerini alüminyum folyo ile sıkıca kapatın. 6. 160°C fırında 3-3.5 saat pişirin. 7. Son 30 dk folyoyu açıp üstünü kızartın.",
    },
    {
        "name": "Menemen",
        "category": "Kahvaltılık",
        "region": "Ege",
        "ingredients": "4 yumurta, 3 domates, 2 sivri biber, 1 soğan (isteğe bağlı), 2 yemek kaşığı sıvı yağ veya tereyağı, tuz, karabiber, pul biber",
        "instructions": "1. Biberleri ve isteğe bağlı soğanı doğrayıp yağda kavurun. 2. Domatesleri rendeleyin veya doğrayıp ekleyin. 3. Domatesler suyunu salıp yumuşayana kadar pişirin. 4. Yumurtaları kırıp ekleyin. 5. Hafifçe karıştırarak kıvamına gelene kadar pişirin (çok karıştırmayın). 6. Tuz ve baharatları ekleyin. Ekmekle sıcak servis edin.",
    },
    {
        "name": "Sarma (Yaprak Sarması)",
        "category": "Ana Yemek",
        "region": "Tüm Türkiye",
        "ingredients": "50 adet asma yaprağı, 2 su bardağı pirinç, 3 soğan, yarım su bardağı sıvı yağ, 1 demet dereotu, 1 demet nane, 2 domates, 1 limon suyu, tuz, karabiber, yenibahar",
        "instructions": "1. Asma yapraklarını tuzlu suda haşlayın. 2. Pirinci yıkayıp süzün. 3. Soğanları ince doğrayıp yağda kavurun. 4. Pirinç, doğranmış otlar ve baharatları karıştırın. 5. Her yaprağın parlak yüzünü alta gelecek şekilde koyup iç harcı yerleştirin. 6. Sıkıca sarın, tencereye dizin. 7. Üzerine limon suyu, yağ ve su ekleyin. 8. Kısık ateşte 45-50 dk pişirin.",
    },
    {
        "name": "Keşkek",
        "category": "Ana Yemek",
        "region": "İç Anadolu",
        "ingredients": "500g dövme buğday, 500g kuzu eti (kemikli), 1 soğan, 100g tereyağı, tuz, karabiber",
        "instructions": "1. Dövme buğdayı bir gece suda bekletin. 2. Kuzu etini haşlayın, kemiklerinden ayırın. 3. Buğday ve eti birlikte et suyuyla pişirin (2-3 saat). 4. Tahta kaşıkla sürekli dövün/karıştırın, lapa kıvamına getirin. 5. Tereyağını eritip üzerine gezdirin. 6. Sıcak servis edin.",
    },
    {
        "name": "Gözleme",
        "category": "Kahvaltılık",
        "region": "Tüm Türkiye",
        "ingredients": "3 su bardağı un, 1 su bardağı ılık su, yarım çay bardağı sıvı yağ, 1 çay kaşığı tuz. İç (seçmeli): ıspanak-peynir, patatesli, kıymalı. Tereyağı (pişirmek için)",
        "instructions": "1. Un, su, yağ ve tuzu yoğurup yumuşak hamur yapın. 2. 30 dk dinlendirin. 3. Bezlere ayırıp oklavayla ince açın. 4. İstediğiniz içi yarısına yayın, diğer yarısını kapatın. 5. Sac veya tavada tereyağıyla her iki yüzünü kızartın. 6. Sıcak servis edin.",
    },
    {
        "name": "Aşure",
        "category": "Tatlı",
        "region": "Tüm Türkiye",
        "ingredients": "1 su bardağı buğday, yarım su bardağı nohut, yarım su bardağı kuru fasulye, yarım su bardağı pirinç, 2 su bardağı şeker, 5-6 kuru kayısı, yarım su bardağı kuru üzüm, yarım su bardağı kuş üzümü, 10 adet ceviz, 10 adet fındık, nar, tarçın",
        "instructions": "1. Buğday, nohut ve fasulyeyi ayrı ayrı bir gece bekletin. 2. Her birini yumuşayana kadar ayrı ayrı haşlayın. 3. Büyük tencerede birleştirin, pirinci ekleyin. 4. Doğranmış kuru meyveleri ekleyin. 5. Şekeri ekleyip 20-25 dk kaynatın. 6. Kaselere dökün, ceviz, fındık, nar ve tarçınla süsleyin.",
    },
    {
        "name": "Adana Kebap",
        "category": "Ana Yemek",
        "region": "Güneydoğu Anadolu - Adana",
        "ingredients": "500g dana kıyma (yağlı), 1 soğan, 3-4 diş sarımsak, 2 yemek kaşığı pul biber, 1 çay kaşığı tuz, yarım çay kaşığı karabiber, yarım çay kaşığı kimyon, lavaş, közlenmiş domates ve biber, soğan salatası",
        "instructions": "1. Kıymayı ince çekilmiş soğan ve sarımsakla yoğurun. 2. Baharatları ekleyip en az 2 saat buzdolabında dinlendirin. 3. Geniş şişlere yapıştırarak geçirin. 4. Mangal közünde veya ızgarada sık çevirerek pişirin. 5. Lavaş, közlenmiş sebzeler ve soğan salatası ile servis edin.",
    },
]


def seed():
    init_db()
    db = SessionLocal()
    if db.query(Recipe).count() > 0:
        print("Veritabanında zaten tarifler var. Ekleme yapılmadı.")
        db.close()
        return
    for data in RECIPES:
        db.add(Recipe(**data))
    db.commit()
    print(f"{len(RECIPES)} adet Türk yemek tarifi başarıyla eklendi!")
    db.close()


if __name__ == "__main__":
    seed()

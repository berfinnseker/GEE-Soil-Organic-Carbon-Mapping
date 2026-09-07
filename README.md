# Google Earth Engine ile Toprak Organik Karbonu (SOC) Tahmini ve Haritalanması 🌍🛰️

Bu çalışma, **TÜBİTAK 2209-A Üniversite Öğrencileri Araştırma Projeleri Destekleme Programı** kapsamında yürütülmüştür.

Muş Ovası'nda belirlenen ~1235 hektarlık kararlı tarım arazisinde toprak organik karbonu (SOC) dinamikleri; Sentinel-2 uydu görüntüleri, SRTM DEM topografik katmanları ve Random Forest makine öğrenmesi regresyon algoritması kullanılarak modellenmiş ve mekânsal olarak haritalandırılmıştır.

---

### 📌 Metodoloji ve Kullanılan Teknolojiler
* **Geliştirme Platformu:** Google Earth Engine (GEE) JavaScript API
* **Uydu Verisi:** Sentinel-2 L2A (Harmonized - Yüzey Yansıması)
* **Topografik Veri Seti:** NASA SRTMGL1_003 30m Dijital Yükseklik Modeli (Yükseklik & Eğim Katmanları)
* **Spektral İndeksler:** 
  * **NDVI:** Canlı bitki örtüsü yoğunluğu analizi
  * **NBR2:** Kuru anız artıkları ve yüzey nem dalgalanmalarını sönümleme
  * **BSI:** Çıplak Toprak İndeksi (Bare Soil Index)
* **Gürültü Maskelemesi:** Bitki örtüsü etkisini sıfırlamak için NDVI ≤ 0.2 çıplak toprak (bare soil) filtresi
* **Zemin Gerçekliği (Ground-Truth):** Walkley-Black yöntemiyle laboratuvarda analiz edilmiş 9 referans numune noktası
* **Makine Öğrenmesi Modeli:** 150 karar ağaçlı Random Forest Regresyon Modeli (`smileRandomForest`)
* **Kullanıcı Arayüzü (UI):** Tıklanan her parsel için piksel bazlı canlı SOC tahmini, laboratuvar verisi karşılaştırması ve çıplak toprak maske uyarısı veren dinamik CBS analiz paneli

---

### 📊 Model Performansı ve Doğruluk Metrikleri
Model performansı Kök Ortalama Kare Hata (RMSE) ve Belirtme Katsayısı (R²) ile değerlendirilmiştir:

| Model Dönemi | RMSE | R² (Açıklayıcılık) |
| :--- | :---: | :---: |
| **Sonbahar SOC Modeli** | 0.3665 | 0.6702 |
| **İlkbahar SOC Modeli** | 0.3545 | 0.6264 |

---

### 🔗 Açık Erişim ve Akademik Arşiv
Proje analiz kodları ve veri çıktıları Zenodo üzerinde açık erişimli olarak arşivlenmiştir:
* **Zenodo DOI:** [10.5281/zenodo.21224253](https://doi.org/10.5281/zenodo.21224253)

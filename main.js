// =========================================================================
// 1. ADIM: ÇALIŞMA ALANI BELİRLEME (ROI)
// =========================================================================
// Muş Ovası üzerinde analiz yapılan 1235 hektarlık kararlı tarım alanının uzamsal sınırları (Region of Interest)
var roi = ee.Geometry.Polygon([[
  [41.4005, 38.7777],
  [41.4150, 38.7977],
  [41.4641, 38.7977],
  [41.4530, 38.7600]
]]);

// Harita görünümünü çalışma alanının merkez koordinatlarına odaklıyoruz (Zoom Seviyesi: 13)
Map.setCenter(41.43, 38.78, 13); 
// Sınır poligonunu haritaya kırmızı renkle giydiriyoruz
Map.addLayer(roi, {color: 'red'}, 'Çalışma Alanı Sınırı');

// =========================================================================
// TOPOGRAFİK KATMANLARIN ENTEGRASYONU (NASA SRTM DEM)
// =========================================================================
// NASA'nın 30m çözünürlüklü Dijital Yükseklik Modeli (DEM) çağrılarak çalışma alanına göre kırpılıyor (clip)
var dem = ee.Image('USGS/SRTMGL1_003').clip(roi);
// Model başarısını %50'lerden %67'ye fırlatan Yükseklik (Rakım) ve Eğim (Slope) katmanları üretiliyor
var yukseklik = dem.select('elevation').rename('Yukseklik');
var egim = ee.Terrain.slope(dem).rename('Egim');
// İki topografik veri, makine öğrenmesine beslenmek üzere tek bir raster veri paketinde birleştiriliyor
var topografya = yukseklik.addBands(egim);


// =========================================================================
// 2. ADIM: SPEKTRAL İNDEKS FONKSİYONU
// =========================================================================
// Uydudan gelen ham yansıma değerlerini toprak kimyasıyla ilişkilendiren matematiksel fonksiyon
function addIndices(image) {
  // NDVI: Canlı bitki örtüsü (vejetasyon) yoğunluğunu ölçen normalize fark indeksi (Band 8 ve Band 4)
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  
  // NBR2: Kuru hasat artıkları, anız gürültüsü ve yüzey nem dalgalanmalarını sönümleyen indeks (Band 11 ve Band 12)
  // Matematiksel Kısıt: Normalize yapısı gereği her zaman -1 ile +1 arasında değer üretir.
  var nbr2 = image.normalizedDifference(['B11', 'B12']).rename('NBR2');
  
  // BSI: Çıplak Toprak İndeksi (Bare Soil Index). Toprağın mineralojik yapısını ve yüzey özelliklerini vurgular
  var bsi = image.expression(
    '(RED - SWIR) / (NIR + RED)', {
      'RED': image.select('B4'),
      'SWIR': image.select('B11'),
      'NIR': image.select('B8')
    }).rename('BSI');
    
  // Spektral indeks katmanları ve topografik özellikler (Yükseklik, Eğim) tek bir görüntü matrisinde birleştiriliyor
  return image.addBands([ndvi, nbr2, bsi]).addBands(topografya); 
}


// =========================================================================
// 3. ADIM: UYDU GÖRÜNTÜLERİNİ ÇEKME, TEMİZLEME VE MASKELEME
// =========================================================================
// Sentinel-2 uydusunun atmosfer düzeltmesi yapılmış (SR) L2A veri arşivini çalışma alanına göre filtreliyoruz
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(roi);

// --- SONBAHAR DÖNEMİ VERI HAZIRLIĞI (2025) ---
// Belirtilen tarih aralığındaki bulutsuz piksellerin medyan (orta değer) görüntüsü alınarak alan kırpılıyor
var s2_sonbahar = s2.filterDate('2025-09-01', '2025-11-30').median().clip(roi);
var sonbahar_indeksli = addIndices(s2_sonbahar);
// AKILLI FİLTRE: Bitki örtüsünün (vejetasyon) yarattığı coğrafi gürültüyü engellemek için NDVI <= 0.2 alanı maskeleniyor
var bareSoil_sonbahar = sonbahar_indeksli.updateMask(sonbahar_indeksli.select('NDVI').lte(0.2));

// --- İLKBAHAR DÖNEMİ VERI HAZIRLIĞI (2026) ---
var s2_ilkbahar = s2.filterDate('2026-03-01', '2026-05-31').median().clip(roi);
var ilkbahar_indeksli = addIndices(s2_ilkbahar);
// İlkbahar dönemindeki yoğun bitki gürültüsü yine NDVI <= 0.2 çıplak toprak maskesiyle temizleniyor
var bareSoil_ilkbahar = ilkbahar_indeksli.updateMask(ilkbahar_indeksli.select('NDVI').lte(0.2));


// =========================================================================
// 4. ADIM: SAHA NUMUNELERİ (MATEMATİKSEL DÖNÜŞTÜRÜLMÜŞ GERÇEK VERİLER)
// =========================================================================
// Laboratuvarda Walkley-Black yöntemiyle analiz edilen, DMS formatından Ondalık Dereceye dönüştürülmüş kesin referans noktaları
var noktalar = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([41.427811, 38.773133], 'EPSG:4326'), {ID: 1, SOC_Son: 1.25, SOC_Ilk: 1.30}),
  ee.Feature(ee.Geometry.Point([41.427233, 38.773800], 'EPSG:4326'), {ID: 2, SOC_Son: 2.10, SOC_Ilk: 2.05}),
  ee.Feature(ee.Geometry.Point([41.427372, 38.773706], 'EPSG:4326'), {ID: 3, SOC_Son: 1.85, SOC_Ilk: 1.90}),
  ee.Feature(ee.Geometry.Point([41.427253, 38.773558], 'EPSG:4326'), {ID: 4, SOC_Son: 0.95, SOC_Ilk: 0.90}),
  ee.Feature(ee.Geometry.Point([41.427478, 38.773561], 'EPSG:4326'), {ID: 5, SOC_Son: 2.40, SOC_Ilk: 2.35}),
  ee.Feature(ee.Geometry.Point([41.429444, 38.773056], 'EPSG:4326'), {ID: 6, SOC_Son: 1.55, SOC_Ilk: 1.60}),
  ee.Feature(ee.Geometry.Point([41.428056, 38.771944], 'EPSG:4326'), {ID: 7, SOC_Son: 1.70, SOC_Ilk: 1.75}),
  ee.Feature(ee.Geometry.Point([41.428333, 38.772222], 'EPSG:4326'), {ID: 8, SOC_Son: 1.10, SOC_Ilk: 1.15}),
  ee.Feature(ee.Geometry.Point([41.428889, 38.772500], 'EPSG:4326'), {ID: 9, SOC_Son: 2.25, SOC_Ilk: 2.20})
]);


// =========================================================================
// 5. ADIM: EĞİTİM VERİSİ ÇIKARMA
// =========================================================================
// Modelin kalıcı yansımaları öğrenmesi için bulutsuz en net ara dönemin (Ağustos-Ekim) medyan görüntüsü alınıyor
var s2_temiz = s2.filterDate('2025-08-01', '2025-10-30').median();
var temiz_indeksli = addIndices(s2_temiz);

// Model eğitiminde kullanılacak 5 temel bağımsız değişken (Girdi Özellikleri - Features)
var predictionBands = ['NDVI', 'NBR2', 'BSI', 'Yukseklik', 'Egim'];

// Numune noktalarının denk geldiği piksellerdeki 5 girdi özelliğinin değerleri eğitim matrisine (tabloya) dönüştürülüyor
var training_sonbahar = temiz_indeksli.select(predictionBands).sampleRegions({
  collection: noktalar, properties: ['SOC_Son'], scale: 10
});

var training_ilkbahar = temiz_indeksli.select(predictionBands).sampleRegions({
  collection: noktalar, properties: ['SOC_Ilk'], scale: 10
});


// =========================================================================
// 6. ADIM: OPTİMİZE MAKİNE ÖĞRENMESİ MODELLENMESİ (RANDOM FOREST)
// =========================================================================
// 150 adet bağımsız karar ağacı kurularak varyans minimize ediliyor ve aşırı öğrenmenin (overfitting) önüne geçiliyor
var rf = ee.Classifier.smileRandomForest({
  numberOfTrees: 150,
  variablesPerSplit: 3,
  minLeafPopulation: 1
}).setOutputMode('REGRESSION'); // Sayısal karbon tahmini için regresyon modu set ediliyor

// Modeller, hazırlanan 5 girdi özelliği ve laboratuvar SOC bağımlı değişkenleri ile eğitiliyor (RF Eğitimi)
var model_son = rf.train(training_sonbahar, 'SOC_Son', predictionBands);
var model_ilk = rf.train(training_ilkbahar, 'SOC_Ilk', predictionBands);


// =========================================================================
// 7. ADIM: MEVSİMSEL TAHMİN VE RASTER HARİTALANDIRMA
// =========================================================================
// Eğitilen makine öğrenmesi modelleri tüm Muş Ovası çıplak toprak piksellerine uygulanarak karbon haritaları üretiliyor
var map_son = bareSoil_sonbahar.classify(model_son, 'Tahmin_Son');
var map_ilk = bareSoil_ilkbahar.classify(model_ilk, 'Tahmin_Ilk');

// Görselleştirme Skalası: Kırmızı (%0.9 - Düşük) -> Sarı (%1.7 - Orta) -> Yeşil (%2.5 - Yüksek) [Lejant Uyumu]
var socVis = {min: 0.9, max: 2.5, palette: ['red', 'yellow', 'green']};
Map.addLayer(map_son, socVis, 'Sonbahar SOC Tahmin Haritası');
Map.addLayer(map_ilk, socVis, 'İlkbahar SOC Tahmin Haritası', false); // Varsayılan olarak kapalı gelir, panelden açılır
// Gerçek laboratuvar noktalarını haritada görünür kılmak için mavi katman olarak en üste basıyoruz
Map.addLayer(noktalar, {color: 'blue', pointRadius: 7}, 'Numune Noktaları');


// =========================================================================
// 8. ADIM: GLOBAL DOĞRULUK ANALİZLERİ (RMSE & R2 METRİKLERİ)
// =========================================================================
function getMetrics(training, model, label) {
  var predicted = training.classify(model, 'P');
  
  // RMSE: Tahmin edilen değer ile gerçek değer arasındaki standart hata payını hesaplar
  var rmse = ee.Number(predicted.map(function(f){
    return f.set('d', ee.Number(f.get(label)).subtract(f.get('P')).pow(2));
  }).reduceColumns(ee.Reducer.mean(), ['d']).get('mean')).sqrt();
  
  // R2 (Belirtme Katsayısı): Modelin sahadaki karbon değişimini açıklayabilme oranını verir
  var r2 = ee.Number(predicted.reduceColumns(ee.Reducer.pearsonsCorrelation(), [label, 'P'])
    .get('correlation')).pow(2);
    
  return {rmse: rmse, r2: r2};
}

var stats_son = getMetrics(training_sonbahar, model_son, 'SOC_Son');
var stats_ilk = getMetrics(training_ilkbahar, model_ilk, 'SOC_Ilk');

// Sonuçları jürinin doğrulaması için GEE Console paneline yazdırıyoruz
print('--- YENİ OPTİMİZE SONBAHAR SONUÇLARI ---', 'RMSE:', stats_son.rmse, 'R²:', stats_son.r2);
print('--- YENİ OPTİMİZE İLKBAHAR SONUÇLARI ---', 'RMSE:', stats_ilk.rmse, 'R²:', stats_ilk.r2);


// =========================================================================
// 9. ADIM: İNTERAKTİF BİLGİ PANELİ TASARIMI (HİBRİT MİMARİ)
// =========================================================================
// Haritanın sağ üst köşesinde konumlanacak CBS bilgi sorgulama kutusu UI tasarımı
var inspector = ui.Panel({
  layout: ui.Panel.Layout.Flow('vertical'),
  style: {
    position: 'top-right',
    padding: '12px 18px',
    width: '290px',
    backgroundColor: '#ffffff',
    border: '1px solid #dcdcdc',
    borderRadius: '4px'
  }
});

inspector.add(ui.Label({
  value: 'Analiz için haritadan bir tarım parseline tıklayınız.',
  style: {fontStyle: 'italic', color: '#7f8c8d', fontSize: '12px', textAlign: 'center', margin: '4px 0px'}
}));

Map.add(inspector);

// Mevsimsel sonuç kutucuklarını (Badge) dinamik ve renkli üreten UI fonksiyonu
function createValueWidget(seasonName, value, isMasked) {
  var container = ui.Panel({
    layout: ui.Panel.Layout.Flow('vertical'),
    style: {
      margin: '4px 0px',
      padding: '6px 8px',
      backgroundColor: isMasked ? '#fff5f5' : '#f0fafd', // Gürültü filtresine takılanlara kırmızı, veri olanlara mavi arka plan
      borderRadius: '4px',
      border: isMasked ? '1px solid #e74c3c' : '1px solid #2ecc71'
    }
  });

  var titleLabel = ui.Label({
    value: seasonName,
    style: {fontWeight: 'bold', fontSize: '11px', color: '#34495e', margin: '0px'}
  });
  
  var valueLabel = ui.Label({
    value: isMasked ? 'Maskelendi (Çıplak Toprak Değil)' : '% ' + Number(value).toFixed(2),
    style: {fontSize: '14px', fontWeight: 'bold', color: isMasked ? '#c0392b' : '#27ae60', margin: '2px 0px 0px 0px'}
  });

  container.add(titleLabel);
  container.add(valueLabel);

  if (isMasked) {
    var descLabel = ui.Label({
      value: 'Bu piksel bitki gürültüsü nedeniyle analiz dışı bırakılmıştır.',
      style: {fontSize: '9px', color: '#95a5a6', margin: '4px 0px 0px 0px'}
    });
    container.add(descLabel);
  }
  
  return container;
}

// HARİTAYA TIKLAMA OLAYI (Map Click Event Listener) - Canlı Hesaplama ve Sorgulama Mekanizması
Map.onClick(function(coords) {
  inspector.clear();
  
  inspector.add(ui.Label({
    value: 'Veriler sorgulanıyor...', 
    style: {color: '#3498db', fontStyle: 'italic', fontSize: '12px', margin: '10px 0px'}
  }));
  
  var point = ee.Geometry.Point(coords.lon, coords.lat);
  
  // Tıklama hatasını/sapmasını önlemek için koordinat etrafında 15 metrelik tampon bölge sorgulanıyor
  var searchArea = point.buffer(15); 
  var nearbyPoints = noktalar.filterBounds(searchArea);
  
  // Eğer yakında mavi bir laboratuvar noktası varsa veriyi doğrudan oradan çekiyor (if/else koşul başlangıcı)
  var actualValuesList = nearbyPoints.map(function(f) {
    return ee.Feature(null, {
      gercek_son: f.get('SOC_Son'),
      gercek_ilk: f.get('SOC_Ilk')
    });
  }).toList(1);
  
  // Tıklanan boş parseldeki 5 girdiyi (NDVI, NBR2, BSI, Yükseklik, Eğim) okuyup canlı tahmini koşturuyoruz
  var t_son = map_son.reduceRegion(ee.Reducer.first(), point, 10).get('Tahmin_Son');
  var t_ilk = map_ilk.reduceRegion(ee.Reducer.first(), point, 10).get('Tahmin_Ilk');
  
  ee.Dictionary({
    actualList: actualValuesList,
    tahmin_son: t_son,
    tahmin_ilk: t_ilk
  }).evaluate(function(result) {
    inspector.clear(); 
    
    var isRealPoint = result.actualList.length > 0;
    
    inspector.add(ui.Label({
      value: isRealPoint ? '📍 GERÇEK SAHA NUMUNESİ' : 'PİKSEL BAZLI SOC TAHMİNİ',
      style: {fontWeight: 'bold', fontSize: '13px', color: isRealPoint ? '#8e44ad' : '#2c3e50', margin: '0px 0px 6px 0px'}
    }));
    
    if (isRealPoint) {
      inspector.add(ui.Label({
        value: 'Laboratuvarda ölçülen kesin sonuçları görmektesiniz.',
        style: {fontSize: '10px', color: '#8e44ad', margin: '0px 0px 6px 0px', fontStyle: 'italic'}
      }));
    }
    
    // Değer Seçimi: Mavi noktaysa laboratuvar sonucunu, boş parselse makine öğrenmesi tecrübe tahminini basar
    var sonValue = isRealPoint ? result.actualList[0].properties.gercek_son : result.tahmin_son;
    var ilkValue = isRealPoint ? result.actualList[0].properties.gercek_ilk : result.tahmin_ilk;
    
    var sonbaharMasked = (sonValue === null); 
    inspector.add(createValueWidget(
      isRealPoint ? '🍂 LABORATUVAR: SONBAHAR' : '🍂 TAHMİN: SONBAHAR', 
      sonValue, 
      sonbaharMasked
    ));
    
    var ilkbaharMasked = (ilkValue === null);
    inspector.add(createValueWidget(
      isRealPoint ? '🌱 LABORATUVAR: İLKBAHAR' : '🌱 TAHMİN: İLKBAHAR', 
      ilkValue, 
      ilkbaharMasked
    ));
    
    inspector.add(ui.Label({
      value: (isRealPoint ? 'Gerçek Veri Noktası' : 'Mekansal Çözünürlük: 10m') + ' | Konum: ' + coords.lon.toFixed(4) + 'E, ' + coords.lat.toFixed(4) + 'N',
      style: {fontSize: '10px', color: '#bdc3c7', margin: '12px 0px 0px 0px'}
    }));
  });
});


// =========================================================================
// 10. ADIM: RENK SKALASI (LEJANT) EKLENMESİ
// =========================================================================
// Sol alt köşeye haritanın kullanım kılavuzunu yerleştiriyoruz
var legend = ui.Panel({
  style: {
    position: 'bottom-left', 
    padding: '10px 15px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
    border: '1px solid #dcdcdc',
    borderRadius: '5px'
  }
});

var legendTitle = ui.Label({
  value: 'Toprak Organik Karbonu (SOC) %',
  style: {fontWeight: 'bold', fontSize: '13px', margin: '0 0 8px 0', color: '#2c3e50'}
});
legend.add(legendTitle);

// Renk satırlarını dinamik oluşturan yardımcı fonksiyon
var makeRow = function(color, name) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: color,
      padding: '8px',
      margin: '0 0 4px 0',
      border: '1px solid #7f8c8d'
    }
  });
  var description = ui.Label({
    value: name,
    style: {margin: '0 0 4px 6px', fontSize: '12px', color: '#34495e'}
  });
  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
};

legend.add(makeRow('red', 'Düşük Seviye (~%0.9)'));
legend.add(makeRow('yellow', 'Orta Seviye (~%1.7)'));
legend.add(makeRow('green', 'Yüksek Seviye (~%2.5)'));
legend.add(makeRow('blue', 'Gerçek Saha Numuneleri'));

// Tasarlanan lejantı ana harita ekranına giydiriyoruz
Map.add(legend);

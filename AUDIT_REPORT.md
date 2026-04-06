# 🔍 تقرير مراجعة شامل — App.jsx

## 🚨 المشاكل الحرجة (CRITICAL ISSUES)

### 1. ❌ مشكلة الـ Look-ahead Bias (تم تحديدها سابقاً)
**المكان:** السطور 587-588، 2284، 2291
**المشكلة:** 
- عند حساب الدرجة، يتم تصفية السجل بـ code فقط، بدون فحص التاريخ
- هذا يسمح لأسعار مستقبلية بالتأثير على قرارات ماضية
- مثال: سعر في 2025-01-15 يتأثر بأسعار في 2025-12-31

```javascript
// ❌ WRONG - لا يوجد فحص تاريخ
const history = (byCode[p.code] || []).filter(h => h.id !== p.id)
```

**الخطورة:** عالية جداً — يفسد صحة القرارات التاريخية

---

### 2. ❌ مشاكل في معالجة الأخطاء عند قراءة البيانات
**المكان:** السطور 679-694 (onSnapshot listeners)
**المشكلة:**
```javascript
const onRealtimeError = (err) => {
  console.error('Realtime listener error:', err);
  // فقط يطبع الخطأ، لا يعيد محاولة
  setNotification({...});
};
```

**المشاكل:**
- لا توجد الية retry
- إذا فشل الاتصال مرة، البيانات القديمة تبقى معروضة
- لا تحديث بيانات جديدة
- رسالة الخطأ قد تكون مزعجة للمستخدم

---

### 3. ❌ مشكلة في حساب Delta في Chart (Item Impact)
**المكان:** السطر 2736
**المشكلة:**
```javascript
const delta = last - avg;
// avg يشمل last نفسه!
// avg = (price1 + price2 + ... + last) / n
// إذاً delta = last - (sum including last) / n
// = last - (last + other_prices) / n
// = (n*last - last - other_prices) / n
// = ((n-1)*last - other_prices) / n
// القيمة مشوهة بنسبة (n-1)/n
```

**الخطورة:** متوسطة — الرسوم البيانية تظهر أرقام غير دقيقة

---

### 4. ❌ عدم تطابق أسعار المرجعية
**المكان:** نموذج الإدخال (1875-1878) vs حساب الدرجة (334-340)
**المشكلة:**
- نموذج الإدخال يحسب `avgPrice` من الأسعار الخام مباشرة
- محرك الدرجة يستخدم `filterOutliers()` أولاً
- المستخدم يرى سعراً مختلفاً عن الذي يستخدمه النظام

**التأثير:** ارتباك المستخدم — رسائل التحذير تستند على أسعار مختلفة

---

## ⚠️ مشاكل الأمان (SECURITY ISSUES)

### 5. ⚠️ تسريب معلومات الخطأ
**المكان:** السطور 1127، 1147، 2006، 212
```javascript
console.error('Login error:', err.code);
console.error('Google login error:', err.code);
console.error('Demo seed error:', err);
```

**المشكلة:**
- الأخطاء تُطبع في console (يراها المستخدم)
- قد تحتوي على معلومات حساسة
- في الإنتاج، قد تكشف عن ثغرات

**الحل:** تسجيل الأخطاء في backend أو external service، وإظهار رسائل عامة للمستخدم

---

### 6. ⚠️ Validation ضعيف في Firebase Config
**المكان:** السطور 32-39
```javascript
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration is missing! Check .env.local file');
}
```

**المشكلة:**
- فحص ضعيف (يتحقق من apiKey + projectId فقط، لكن يوجد 6 متغيرات)
- لا يوقف التطبيق عند الفشل
- يستمر التطبيق برغم عدم وجود config صحيح

**الحل:**
```javascript
const requiredKeys = ['apiKey', 'projectId', 'authDomain', 'messagingSenderId', 'appId'];
const missing = requiredKeys.filter(k => !firebaseConfig[k]);
if (missing.length > 0) {
  throw new Error(`Missing Firebase config: ${missing.join(', ')}`);
}
```

---

### 7. ⚠️ لا توجد معالجة للـ XSS في العربية
**المكان:** جميع السطور التي تعرض user data
**المشكلة:**
- البيانات من Firestore تُعرض مباشرة في HTML
- لا validation على محتوى البيانات
- نص عربي قد يحتوي على أكواد خطيرة

---

## 🐛 مشاكل الأداء (PERFORMANCE ISSUES)

### 8. 🐛 تحديث state كثير جداً
**المكان:** السطور 680-694
```javascript
setPurchases(s.docs.map(d => ({ ...d.data(), id: d.id })));
setItems(s.docs.map(d => ({ ...d.data(), id: d.id })));
setBranches(s.docs.map(d => ({ ...d.data(), id: d.id })));
setVendors(s.docs.map(d => ({ ...d.data(), id: d.id })));
```

**المشكلة:**
- كل onSnapshot trigger يعيد render المكون كامل
- لا معالجة للـ incremental updates
- لا يوجد diffing — كل مرة معاد الحساب الكامل

**التأثير:** بطء في الواجهة عند إضافة بيانات جديدة

---

### 9. 🐛 عدد كبير من useMemo بدون optimization
**المكان:** السطر 1200 فما فوق (Dashboard view)
**المشكلة:**
- 16+ useMemo hooks
- dependencies معقدة جداً
- قد تفشل في إعادة الحساب عند الحاجة
- أو تأتي بنتائج قديمة

**التأثير:** stability issues وunexpected behavior

---

## 🔴 مشاكل التعامل مع البيانات

### 10. 🔴 filterOutliers قد تحذف كل البيانات
**المكان:** السطور 298-300
```javascript
const filterOutliers = (prices) => {
  if (prices.length < MIN_VALID_RECORDS) return prices;
  const avg = prices.reduce((s, v) => s + v, 0) / prices.length;
  if (avg <= 0) return prices;  // ⚠️ إذا كانت كل البيانات سالبة؟
  return prices.filter(p => p >= (OUTLIER_LOWER_BOUND * avg) && p <= (OUTLIER_UPPER_BOUND * avg));
};
```

**المشكلة:**
- إذا كانت جميع الأسعار في نفس النطاق الضيق، قد لا تتبقى نقطة واحدة
- بلا guard rail
- OUTLIER_LOWER_BOUND = 0.5 و OUTLIER_UPPER_BOUND = 2.0 قد يكون قاسياً جداً

**الحل:** ضمان بقاء نقطة واحدة على الأقل

---

### 11. 🔴 calculateAveragePrice يرجع 0 بدون تحذير
**المكان:** السطور 312-317
```javascript
const calculateAveragePrice = (purchases, maxRecords = 10) => {
  const prices = getValidPrices(purchases, maxRecords);
  if (prices.length < MIN_VALID_RECORDS) return 0;  // ⚠️ تسويتة صامتة
  const filtered = filterOutliers(prices);
  if (filtered.length === 0) return 0;  // ⚠️ تسويتة صامتة
  return filtered.reduce((s, v) => s + v, 0) / filtered.length;
};
```

**المشكلة:**
- عندما يكون هناك بيانات ناقصة، يرجع 0 بصمت
- قد يحدث "تضخيم" صناعي في الحسابات (0 قيمة خاصة)
- لا warning للمستخدم بأن البيانات غير كافية

---

### 12. 🔴 عدم معالجة الـ NaN و Infinity
**مثال من السطور 395، 392:**
```javascript
const consistency = avg_price > 0 ? Math.max(0, 1 - (stdDev / avg_price)) : 0;
const score = toFiniteNumber(((-change_percent * priceWeight) + ...).toFixed(1));
```

**المشكلة:**
- قسمة على صفر قد تُنتج Infinity
- NaN قد ينتشر في الحسابات اللاحقة
- `toFiniteNumber` فقط يحقق في النهاية، بدون سابق

**التأثير:** نتائج غير متوقعة في الدرجات والقرارات

---

### 13. 🔴 timeFiltered قد يكون مصفوفة ضخمة جداً
**المكان:** السطور 2284-2295 (Analytics view)
```javascript
const timeFiltered = useMemo(() => {
  if (timeRange === 'realtime') {
    return sortedAll.slice(0, 80);  // OK
  }
  // لكن إذا كان monthly:
  // قد يرجع 1000+ سجل
}, [sortedAll, timeRange, customFrom, customTo]);
```

**المشكلة:**
- في الشهر، قد تكون هناك آلاف السجلات
- كل الحسابات اللاحقة تعالج آلاف الصفوف
- الرسوم البيانية قد تبطئ

---

## 🎨 مشاكل الواجهة (UI/UX)

### 14. 🎨 Charts قد لا تعرض بشكل صحيح على الهاتف
**المكان:** السطور 2400+
```javascript
const isPhone = viewportWidth <= 480;
const isTablet = viewportWidth <= 768;
```

**المشاكل:**
- breakpoint قد لا تتطابق مع tailwind (phone: 320px، tablet: 768px)
- Charts على الهاتف قد تكون مزدحمة
- Labels قد تتداخل

---

### 15. 🎨 العربية RTL غير متسق
**المكان:** جميع div مع `dir={lang==='ar'?'rtl':'ltr'}`
**المشكلة:**
- بعض elements لا يوجد عليها dir
- بعض margins/paddings قد تكون خاطئة في RTL
- Input fields قد تكون في الاتجاه الخاطئ

---

### 16. 🎨 Loading state غير واضح
**المكان:** السطر 1200 (LoadingScreen)
```javascript
function LoadingScreen({lang}) {
  return (
    <div>
      <div className="animate-spin"></div>
      <p>SYSTEM LOADING...</p>
    </div>
  );
}
```

**المشكلة:**
- روح spinner لا تعطي معلومات عن التقدم
- لا timeout — قد تعرض infinitely
- لا رسالة عربية في HTML

---

## 📱 مشاكل التوافق

### 17. 📱 Web Audio API قد لا تكون مدعومة
**المكان:** السطور 51-98
```javascript
const getUiAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ...
};
```

**المشاكل:**
- بعض التطبيقات ترفع audio context
- بعض المتصفحات تحتاج میموری تصريح
- في SSR environment قد تفشل

---

### 18. 📱 localStorage بدون try/catch
**المكان:** السطور 636، 1059
```javascript
const saved = localStorage.getItem('engine_settings');
return saved ? { ...DEFAULT_ENGINE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_ENGINE_SETTINGS;
```

**المشاكل:**
- `localStorage قد تكون معطلة (private mode browser)
- JSON.parse قد تفشل بدون try/catch
- لا fallback

**الحل:**
```javascript
try {
  const saved = localStorage.getItem('engine_settings');
  return saved ? { ...DEFAULT_ENGINE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_ENGINE_SETTINGS;
} catch {
  return DEFAULT_ENGINE_SETTINGS;
}
```

---

## 🔧 مشاكل التطوير

### 19. 🔧 Math operations بدون validation
**مثال:**
```javascript
const variance = prices.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / prices.length;
const stdDev = Math.sqrt(variance);
```

**المشاكل:**
- لا safe guard ضد negative variance (بسبب floating point errors)
- Math.sqrt قد يرجع complex number
- لا validation على النتيجة

---

### 20. 🔧 Promise handling بدون catch
**المكان:** السطور 749-751
```javascript
await Promise.all(demoItems.map((x) => addDoc(collection(db, 'items'), x)));
await Promise.all(demoBranches.map((x) => addDoc(collection(db, 'branches'), x)));
await Promise.all(demoVendors.map((x) => addDoc(collection(db, 'vendors'), x)));
```

**المشكلة:**
- لا try/catch حول Promise.all
- إذا فشلت واحدة، قد تفشل الكل
- لا recovery

---

### 21. 🔧 deleteDoc بدون confirmation حقيقي
**المكان:** السطور 2357، 2438
```javascript
onClick={() => { if (confirm(t('delete_confirm'))) deleteDoc(doc(db, 'purchases', p.id)); }}
```

**المشاكل:**
- `confirm()` قديم جداً
- ليس إعادة محاولة أو undo
- لا visual feedback قبل الحذف

---

## 📊 مشاكل البيانات (continued)

### 22. 📊 categorizeByPeriod قد تكون بطيئة
**المكان:** شاشة Analytics
**المشكلة:**
- لا تحسب القيم المتراكمة
- كل مرة تعيد الحساب من الصفر
- لا caching

---

## 📝 مشاكل التوثيق

### 23. 📝 بدون comments على الدوال الرئيسية
**مثال:** `calculateDecisionScore` (374 سطر)
- لا JSDoc
- بلا شرح للـ weights
- بلا مثال على الاستخدام

---

### 24. 📝 بدون error documentation
- ما الأخطاء التي قد تحدث؟
- كيفية Recovery؟
- ما هو Expected behavior في حالة فشل Firebase؟

---

## 🔴 مشاكل إضافية حرجة

### 28. 🔴 JSON.parse بدون try/catch 🔓 CRITICAL
**المكان:** السطور 638، 1097
```javascript
const saved = localStorage.getItem('engine_settings');
return saved ? { ...DEFAULT_ENGINE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_ENGINE_SETTINGS;
// ❌ إذا كان JSON تالف → crash التطبيق كله
```

**الخطورة:** عالية جداً — تعطيل كامل التطبيق
**الحل:** 
```javascript
try {
  const saved = localStorage.getItem('engine_settings');
  return saved ? { ...DEFAULT_ENGINE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_ENGINE_SETTINGS;
} catch (err) {
  console.error('Failed to parse settings:', err);
  return DEFAULT_ENGINE_SETTINGS;
}
```

---

### 29. 🔴 String split بدون guard rails
**المكان:** السطور 924-925، 946-947
```javascript
const code = key.split('__')[0];  // ❌ إذا لم يوجد __ → undefined
const branch = key.split('__')[1];  // ❌ إذا length < 2 → undefined
```

**المشكلة:**
- قد يؤدي لـ undefined keys في الكائنات
- لا validation على output

---

### 30. 🔴 no safe guard على المصفوفات الفارغة
**المكان:** عدة أماكن
```javascript
return Math.max(...vals) * 1.1;  // ❌ إذا كانت vals [] → Infinity
return Math.min(...filtered) : 0;  // ❌ إذا كانت filtered [] → Infinity
```

**الحل:**
```javascript
if (!vals.length) return [0, 100];
const max = vals.length > 0 ? Math.max(...vals) : 0;
```

---

### 31. 🔴 Date validation ضعيف
**المكان:** السطور 757، 1225، 1227
```javascript
d.toISOString().slice(0, 10);  // ❌ لو d = null أو invalid date → error
new Date(p.date).getTime();  // ❌ NaN إذا كان date invalid
```

**المشكلة:**
- لا validation على Date objects
- قد يفسد الفرز والتصفية

---

### 32. 🔴 numeric operations بدون isFinite
**المكان:** عديد الأماكن
```javascript
const impact = Number(p.impact);  // السطر 1526
const qty = Number(p.qty) || 1;  // السطر 1515
```

**المشكلة:**
- قد تكون NaN
- قد تكون Infinity
- لا معالجة الحالات الخاصة

---

### 33. 🔴 Array operations بدون bounds checking
**المكان:** السطور 906، 1346، 1410، 1442-1443
```javascript
const tail = sorted.slice(-5).map((p) => p.price);  // ❌ إذا sorted [] ?
const prices = currentItemPrices.slice(-6);  // ❌ إذا currentItemPrices [] ?
```

**الحل:** دائماً تحقق الطول

---

### 34. 🔴 قسمة على صفر محتملة
**المكان:** عديد الحسابات
```javascript
const variance = prices.reduce(...) / prices.length;  // ❌ إذا [] ?
const consistency = avg_price > 0 ? ... : 0;  // محسنة لكن ليست في كل مكان
```

---

## 🟠 مشاكل في معالجة الحالات خاصة

### 35. 🟠 ماذا إذا كانت جميع الأسعار الخاصة محذوفة بسبب filterOutliers؟
**المكان:** السطور 298-300
```javascript
const filtered = filterOutliers(prices);
if (filtered.length === 0) return 0;  // ⚠️ تسويتة صامتة
```

**المشكلة:**
- average = 0 قد يعني "no data" أو "صفر حقيقي"
- يمكن أن يسبب قسمة على صفر الاحقاً

---

### 36. 🟠 Timestamp format mixed
**المكان:** عديد الأماكن
```javascript
const ts = p.date ? new Date(p.date).getTime() : (p.timestamp || 0);
```

**المشكلة:**
- بعض السجلات بـ ISO date string
- بعضها بـ timestamp (milliseconds)
- بعضها بـ 0
- قد يكون هناك عدم اتساق

---

## 🟡 مشاكل متقدمة (Advanced)

### 37. 🟡 Memory leak محتمل في Audio context
**المكان:** السطور 51-98
```javascript
let uiAudioContext = null;

const getUiAudioContext = () => {
  if (!uiAudioContext) uiAudioContext = new AudioCtx();
  return uiAudioContext;
};
```

**المشكلة:**
- Audio context بقي في memory مدى الحياة
- قد تأخذ resources كبيرة إذا كان app مفتوح طويل

---

### 38. 🟡 inefficient DOM rendering
**المكان:** Dashboard view
```javascript
{recentOps.map((p) => {...})}  // 5 items
{supplierRecommendations.map((s) => {...})}  // 3 items
{actionAlerts.map((a, idx) => {...})}  // عدة items
```

**المشكلة:**
- لا keys معرفة بشكل فريد
- قد يحدث re-rendering غير ضروري

---

### 39. 🟡 Floating point precision
**المكان:** السطور 354-358
```javascript
avg_price: Number(avg_price.toFixed(2)),
change_percent: Number(change_percent.toFixed(4)),
```

**المشكلة:**
- تحويلات متعددة قد تفقد precision
- `.toFixed()` يرجع string أولاً
- `Number()` يحول بعكس

**أفضل:**
```javascript
avg_price: Math.round(avg_price * 100) / 100,
```

---

## 🟡 CSS Tailwind responsive مخاطر
**المكان:** tailwind.config.js و جميع breakpoints
```javascript
// tailwind.config.js
screens: {
  phone: '480px',    // ❌ Tailwind sm = 640px
  tablet: '768px',   // ✅ Tailwind lg = 1024px
  laptop: '1024px',  // ❌ Tailwind xl = 1280px
}
```

**المشاكل:**
- Custom breakpoints لا تطابق Tailwind defaults
- قد تحتاج إلى config update في المستقبل
- بعض utilities قد لا تعمل بالتوقع

---

## 🥶 مشاكل في البيئة والإعدادات

### 41. 🥶 Package version = 0.0.0
**المكان:** package.json
```json
{
  "name": "erp-system",
  "version": "0.0.0",  // ❌ غير محدث
  "private": true,
  "type": "module",
}
```

**المشاكل:**
- لا يتبع semantic versioning
- قد يسبب confusion في التطوير والـ deployment
- لا way لتتبع releases

---

### 42. 🥶 Vite config بدون optimization
**المكان:** vite.config.js
```javascript
export default defineConfig({
  plugins: [react()],
  // ❌ بدون:
  // - CORS configuration
  // - build optimization
  // - source maps
  // - environment separation
})
```

**المشاكل:**
- لا CORS handling → قد تفشل requests من domains مختلفة
- لا chunk splitting → bundle كبير
- لا minification control
- لا environment-specific config

---

### 43. 🥶 بدون .env validation أو example
**المكان:** ملف غير موجود
```javascript
// ❌ لا .env.example
// ❌ لا validation في App.jsx على env vars
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,  // قد تكون undefined
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // ...
};
```

**المشاكل:**
- developer جديد لا يعرف ش variables مطلوبة
- لو نسي variable واحد، التطبيق سيكون معطل
- بدون .env.local example

---

### 44. 🥶 Firebase initialization بدون proper error handling
**المكان:** السطور 32-46
```javascript
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration is missing! Check .env.local file');
}
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
// ⚠️ لا throw error — يستمر رغم عدم وجود config
```

**الخطورة:** التطبيق سيفشل لاحقاً بطريقة غير واضحة

---

### 45. 🥶 بدون service worker أو offline mode
**المكان:** عدم wجود
**المشاكل:**
- ف الاتصال الإنترنт → blank screen
- لا ability لـ offline work
- لا caching

---

## 🟣 مشاكل الـ Code Organization

### 46. 🟣 App.jsx ملف ضخم جداً (3300+ سطر)
**المشكلة:**
- صعب الحفاظ على الملف
- slow IDE performance
- صعب الفهم
- reusability ضعيفة

**الحل:** تقسيم للـ components:
```
src/
  components/
    Dashboard.jsx
    EntryForm.jsx
    Analytics.jsx
    MasterData.jsx
    LoginScreen.jsx
  utils/
    calculations.js
    formatting.js
  hooks/
    useFirestoreSync.js
    useAnalytics.js
```

---

### 47. 🟣 بدون proper separation of concerns
**المشاكل:**
- Business logic mixed بـ UI
- calculateDecisionScore و calculateRootCause في نفس ملف
- لا way لـ reuse logic في backend

---

### 48. 🟣 بدون unit tests
**المشاكل:**
- تغيير واحد قد يكسر نتائج التحليل
- لا regression detection
- calculateDecisionScore بدون tests

---

## 🎯 الخلاصة النهائية

### المشاكل الموجودة: **48 مشكلة**

**توزيع الخطورة:**
- 🔴 Critical (4): Look-ahead bias, crashes, data corruption
- 🟠 High (15): Security, validation, error handling
- 🟡 Medium (20): Performance, UX, edge cases
- 🟣 Code Quality (6): Organization, testing, architecture
- 🟢 Low (3): Documentation, versioning

### Recommended Actions:

**Immediate (today):**
- إصلاح JSON.parse crash
- إضافة guards على arrays
- إضافة Date validation

**Short term (this week):**
- إصلاح look-ahead bias
- توحيد average price
- إضافة security fixes

**Medium term (this month):**
- تقسيم App.jsx
- إضافة unit tests
- تحسين error handling

**Long term (next quarter):**
- Refactor architecture
- Add service worker
- Performance optimization

---

## 📊 Risk Assessment Matrix

| Problem | Severity | Likelihood | Impact |
|---------|----------|-----------|--------|
| Look-ahead bias | 🔴 | High | **Data integrity destroyed** |
| JSON.parse crash | 🔴 | Medium | **App completely broken** |
| Array bounds | 🔴 | High | **Unexpected behavior** |
| Security console.error | 🟠 | Medium | **Data leak possibility** |
| Average price mismatch | 🟠 | High | **User confusion** |
| Performance (16 useMemo) | 🟡 | Low | **Slow on old devices** |
| Missing tests | 🟣 | High | **Hidden bugs** |

---

*آخر تحديث: 30 مارس 2026 — 48 مشكلة معرفة وموثقة بالكامل*

---

## 🎯 مشاكل الحالات الحدية (Edge Cases)

### 25. 🎯 ماذا لو كان هناك 0 سجلات؟
**الدالات المتأثرة:**
- `calculateDecisionScore` — قد ترجع null
- Charts — blank screens
- Dashboard stats — NaN

---

### 26. 🎯 ماذا لو كان السعر = 0؟
```javascript
const cleanPriceValue = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};
```

**المشكلة:**
- سعر = 0 فعلي قد يحدث (عرض/هدية)
- يتم حذفه كـ invalid
- قد يفسد التحليلات

---

### 27. 🎯 ماذا لو كان التاريخ مفقود؟
**المكان:** معظم الدوال
```javascript
const ts = p.date ? new Date(p.date).getTime() : (p.timestamp || 0);
```

**المشكلة:**
- إذا مفقود كل من date و timestamp → 0
- يتم وضع السجل في 1970
- قد يظهر في البيانات القديمة جداً

---

## 📌 ملخص الأولويات

| الخطورة | العدد | المشاكل |
|--------|------|--------|
| 🔴 عالية جداً | 4 | Look-ahead bias, مشاكل Outliers، Infinity/NaN، خطأ Delta |
| 🟠 عالية | 6 | Security، error handling، retry logic، validation |
| 🟡 متوسطة | 8 | Performance، UX، توافق، edge cases |
| 🟢 منخفضة | 3 | Documentation، comments |

---

## ✅ الخطوات الموصى بها

1. **فوری:**
   - إصلاح look-ahead bias (تأثير فوری على صحة البيانات)
   - إضافة try/catch لـ JSON.parse
   - تحسين error boundaries

2. **قصير الأجل (أسبوع):**
   - إصلاح Delta calculation
   - توحيد average price logic
   - تحسين retry logic

3. **طويل الأجل:**
   - إعادة بناء state management
   - تقليل عدد useMemo
   - إضافة unit tests
   - توثيق شامل

---

*تم إنشاد هذا التقرير في 2026/03/30*

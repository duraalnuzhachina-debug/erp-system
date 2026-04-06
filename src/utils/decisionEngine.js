/**
 * Scoring Engine - محرك التقييم الأساسي
 * يحتوي على جميع الدوال الخاصة بحساب الدرجات والتحليلات
 */

// ==========================================
// CONSTANTS
// ==========================================
export const DEFAULT_ENGINE_SETTINGS = {
  priceWeight: 50,
  consistencyWeight: 30,
  trendWeight: 20,
  gradeA: 20,
  gradeB: 5,
  gradeC: -10,
  riskyThreshold: 0.10,
  badSupplierThreshold: -5,
  sensitivity: 1,
  maxBuyIncreaseAbs: 1,
  forceNoBuyIncreaseAbs: 2,
  forceNoBuyImpactAbs: 200,
};

export const ROOT_CAUSE_MARKET_SIMILARITY = 0.03;
export const OUTLIER_LOWER_BOUND = 0.5;  // 50% of average
export const OUTLIER_UPPER_BOUND = 2.0;  // 200% of average
export const MIN_VALID_RECORDS = 2;

const getRecordTimestamp = (record, fallback = 0) => {
  if (!record || typeof record !== 'object') return fallback;
  const ts = Number(record.timestamp);
  if (Number.isFinite(ts) && ts > 0) return ts;
  if (record.date) {
    const parsed = new Date(record.date).getTime();
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
};

const median = (arr) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
export const toFiniteNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const formatSmartNumber = (value, maxDecimals = 1) => {
  const n = toFiniteNumber(value, NaN);
  if (!Number.isFinite(n)) return '0';
  const rounded = Number(n.toFixed(maxDecimals));
  return rounded.toLocaleString('en-US', { maximumFractionDigits: maxDecimals });
};

export const formatPercent = (ratio, maxDecimals = 1) =>
  `${formatSmartNumber(toFiniteNumber(ratio) * 100, maxDecimals)}%`;

export const getDecisionLabelByGrade = (grade) => {
  if (grade === 'A') return 'Buy Now';
  if (grade === 'B') return 'Monitor';
  return 'Do Not Buy';
};

export const uniqueLocalizedMessages = (messages = []) => {
  const seen = new Set();
  return messages.filter((m) => {
    const key = `${m?.ar || ''}|${m?.en || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ==========================================
// DATA CLEANING & VALIDATION
// ==========================================
export const cleanPriceValue = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const filterOutliers = (prices) => {
  if (prices.length < MIN_VALID_RECORDS) return prices;

  // Robust filter using median + MAD to resist skew from extreme values.
  if (prices.length >= 4) {
    const med = median(prices);
    const deviations = prices.map((p) => Math.abs(p - med));
    const mad = median(deviations);
    if (mad > 1e-6) {
      const sigma = 1.4826 * mad;
      const low = med - (3 * sigma);
      const high = med + (3 * sigma);
      const robustFiltered = prices.filter((p) => p >= low && p <= high);
      if (robustFiltered.length >= MIN_VALID_RECORDS) return robustFiltered;
    }
  }

  const avg = prices.reduce((s, v) => s + v, 0) / prices.length;
  if (avg <= 0) return prices;
  const filtered = prices.filter(
    (p) => p >= OUTLIER_LOWER_BOUND * avg && p <= OUTLIER_UPPER_BOUND * avg
  );
  // ✅ ضمان بقاء نقطة واحدة على الأقل - إذا لم يبقَ شيء، أرجع آخر نقطة (الأحدث)
  return filtered.length > 0 ? filtered : [prices[prices.length - 1]];
};

export const getValidPrices = (purchases, maxRecords = 10) => {
  if (!purchases || !Array.isArray(purchases)) return [];
  const normalized = purchases
    .map((p, idx) => {
      if (typeof p === 'number') return { price: p, ts: idx + 1 };
      return {
        price: p?.price,
        ts: getRecordTimestamp(p, idx + 1),
      };
    })
    .sort((a, b) => a.ts - b.ts);

  return normalized
    .slice(-maxRecords)
    .map((p) => cleanPriceValue(p.price))
    .filter((p) => p !== null);
};

// ==========================================
// BASE METRICS CALCULATION
// ==========================================
export const calculateBaseMetrics = (currentPrice, historicalPurchases) => {
  const cur = cleanPriceValue(currentPrice);
  if (cur === null) return null;

  const validPrices = getValidPrices(historicalPurchases, 10);
  if (validPrices.length < MIN_VALID_RECORDS) {
    return {
      current_price: cur,
      avg_price: 0,
      last_price: 0,
      change_value: 0,
      change_percent: 0,
      trend_percent: 0,
      trend_direction: 'stable',
    };
  }

  const filtered = filterOutliers(validPrices);
  const avg_price = filtered.length ? filtered.reduce((s, v) => s + v, 0) / filtered.length : 0;
  const last_price = filtered[filtered.length - 1] || 0;

  // ✅ حماية من division by zero
  const change_value = cur - avg_price;
  const change_percent = avg_price > 1e-6 ? change_value / avg_price : 0;
  const trend_percent = last_price > 1e-6 ? (cur - last_price) / last_price : 0;

  let trend_direction = 'stable';
  if (trend_percent > 0.05) trend_direction = 'increasing';
  else if (trend_percent < -0.05) trend_direction = 'decreasing';

  // ✅ حماية من NaN و Infinity
  return {
    current_price: toFiniteNumber(cur, 0),
    avg_price: toFiniteNumber(avg_price.toFixed(2), 0),
    last_price: toFiniteNumber(last_price.toFixed(2), 0),
    change_value: toFiniteNumber(change_value.toFixed(2), 0),
    change_percent: toFiniteNumber(change_percent.toFixed(4), 0),
    trend_percent: toFiniteNumber(trend_percent.toFixed(4), 0),
    trend_direction,
    sample_count: filtered.length,
  };
};

// ==========================================
// IMPACT CALCULATION
// ==========================================
export const calculateImpact = (currentPrice, averagePrice, quantity = 1) => {
  const cur = cleanPriceValue(currentPrice);
  const avg = cleanPriceValue(averagePrice);
  if (cur === null || avg === null || quantity <= 0) return 0;
  return (cur - avg) * quantity;
};

// ==========================================
// DECISION SCORE CALCULATION
// ==========================================
export function calculateDecisionScore(currentPrice, historicalPurchases, settings = {}) {
  const {
    priceWeight = 50,
    consistencyWeight = 30,
    trendWeight = 20,
    gradeA = 20,
    gradeB = 5,
    gradeC = -10,
    maxBuyIncreaseAbs = 1,
    forceNoBuyIncreaseAbs = 2,
    forceNoBuyImpactAbs = 200,
    currentQuantity = 1,
  } = { ...DEFAULT_ENGINE_SETTINGS, ...settings };

  const metrics = calculateBaseMetrics(currentPrice, historicalPurchases);
  if (!metrics || metrics.avg_price <= 0) return null;

  const { avg_price, current_price, change_percent, trend_percent } = metrics;

  const safeChangePercent = toFiniteNumber(change_percent, 0);
  const safeTrendPercent = toFiniteNumber(trend_percent, 0);

  const validPrices = getValidPrices(historicalPurchases, 10);
  const filtered = filterOutliers(validPrices);
  const variance =
    filtered.length > 1
      ? filtered.reduce((s, v) => s + Math.pow(v - avg_price, 2), 0) / filtered.length
      : 0;
  const stdDev = Math.sqrt(variance);
  const consistency = avg_price > 1e-6 ? Math.max(0, Math.min(1, 1 - stdDev / avg_price)) : 0;

  const score = toFiniteNumber(
    (
      -safeChangePercent * priceWeight +
      consistency * consistencyWeight +
      -safeTrendPercent * trendWeight
    ).toFixed(1)
  );

  let grade, decisionAr, decisionEn;
  if (score >= gradeA) {
    grade = 'A';
    decisionAr = 'اشتر الآن';
    decisionEn = 'Buy Now';
  } else if (score >= gradeB) {
    grade = 'B';
    decisionAr = 'راقب';
    decisionEn = 'Monitor';
  } else if (score >= gradeC) {
    grade = 'C';
    decisionAr = 'لا تشتر';
    decisionEn = 'Do Not Buy';
  } else {
    grade = 'D';
    decisionAr = 'لا تشتر';
    decisionEn = 'Do Not Buy';
  }

  const absoluteIncrease = Math.max(0, toFiniteNumber(current_price, 0) - toFiniteNumber(avg_price, 0));
  const quantity = Math.max(1, toFiniteNumber(currentQuantity, 1));
  const extraImpact = absoluteIncrease * quantity;

  // Guardrails for procurement safety: small increase blocks Buy, bigger increase blocks purchase.
  if (absoluteIncrease >= forceNoBuyIncreaseAbs || extraImpact >= forceNoBuyImpactAbs) {
    grade = score >= gradeC ? 'C' : 'D';
    decisionAr = 'لا تشتر';
    decisionEn = 'Do Not Buy';
  } else if (absoluteIncrease >= maxBuyIncreaseAbs && grade === 'A') {
    grade = 'B';
    decisionAr = 'راقب';
    decisionEn = 'Monitor';
  }

  // Conservative guard: with low samples, avoid aggressive Buy decisions.
  if (filtered.length < 3 && grade === 'A') {
    grade = 'B';
    decisionAr = 'راقب';
    decisionEn = 'Monitor';
  }

  const warnings = [];
  if (safeChangePercent > 0.1)
    warnings.push({
      ar: `🚨 السعر أعلى من الطبيعي بـ ${formatPercent(safeChangePercent)}`,
      en: `🚨 Price ${formatPercent(safeChangePercent)} above avg`,
    });
  if (absoluteIncrease >= maxBuyIncreaseAbs) {
    warnings.push({
      ar: `⚠️ ارتفاع سعري مباشر بمقدار ${formatSmartNumber(absoluteIncrease, 2)} ريال للوحدة`,
      en: `⚠️ Direct price increase of ${formatSmartNumber(absoluteIncrease, 2)} per unit`,
    });
  }
  if (extraImpact >= forceNoBuyImpactAbs) {
    warnings.push({
      ar: `🚨 أثر مالي مرتفع متوقع: ${formatSmartNumber(extraImpact, 0)} ريال`,
      en: `🚨 High expected financial impact: ${formatSmartNumber(extraImpact, 0)}`,
    });
  }
  if (safeTrendPercent > 0.05)
    warnings.push({
      ar: `⚠️ السعر في ارتفاع مستمر بنسبة ${formatPercent(safeTrendPercent)}`,
      en: `⚠️ Rising trend ${formatPercent(safeTrendPercent)}`,
    });

  let conciseReason = {
    ar: 'سعر قريب من متوسط الشراء الحديث',
    en: 'Price is close to the recent average',
  };
  if (Math.abs(safeChangePercent) > 0.02) {
    conciseReason = safeChangePercent > 0
      ? {
          ar: `السعر أعلى من المتوسط بـ ${formatPercent(safeChangePercent)}`,
          en: `Price is ${formatPercent(safeChangePercent)} above average`,
        }
      : {
          ar: `السعر أقل من المتوسط بـ ${formatPercent(Math.abs(safeChangePercent))}`,
          en: `Price is ${formatPercent(Math.abs(safeChangePercent))} below average`,
        };
  } else if (Math.abs(safeTrendPercent) > 0.02) {
    conciseReason = safeTrendPercent > 0
      ? { ar: 'السعر في اتجاه صاعد مؤخرا', en: 'Price has a recent upward trend' }
      : { ar: 'السعر في اتجاه هابط مؤخرا', en: 'Price has a recent downward trend' };
  }

  const reasons = [conciseReason];

  const dedupedWarnings = uniqueLocalizedMessages(warnings);
  const dedupedReasons = uniqueLocalizedMessages(reasons);

  return {
    score,
    grade,
    decisionAr,
    decisionEn,
    warnings: dedupedWarnings,
    reasons: dedupedReasons,
    avgPrice: metrics.avg_price,
    minPrice: filtered.length ? Math.min(...filtered) : 0,
    maxPrice: filtered.length ? Math.max(...filtered) : 0,
    lastPrice: metrics.last_price,
    priceDiff: safeChangePercent,
    trend: safeTrendPercent,
    consistency,
    sampleCount: filtered.length,
  };
}

// ==========================================
// ROOT CAUSE ANALYSIS
// ==========================================
export function calculateRootCause(currentPurchase, historicalPurchases, settings = {}) {
  const { riskyThreshold = 0.1, sensitivity = 1 } = {
    ...DEFAULT_ENGINE_SETTINGS,
    ...settings,
  };

  const cur = cleanPriceValue(currentPurchase?.price);
  const code = currentPurchase?.code;
  const branch = currentPurchase?.branch;
  const vendor = currentPurchase?.vendor;

  if (!cur || !code) return null;

  const history = (historicalPurchases || []).filter((p) => p?.code === code);
  const prices = getValidPrices(history, 10);
  if (prices.length < MIN_VALID_RECORDS) return null;

  const filtered = filterOutliers(prices);
  if (filtered.length === 0) return null;
  const avgProduct = filtered.reduce((s, v) => s + v, 0) / filtered.length;
  if (avgProduct <= 0) return null;

  // Branch average
  const branchHistory = history.filter((p) => p.branch === branch);
  const branchPrices = getValidPrices(branchHistory, 10);
  let branchAvg = avgProduct;
  if (branchPrices.length >= MIN_VALID_RECORDS) {
    const branchFiltered = filterOutliers(branchPrices);
    if (branchFiltered.length > 0) {
      branchAvg = branchFiltered.reduce((s, v) => s + v, 0) / branchFiltered.length;
    }
  }

  // Supplier average
  const supplierHistory = history.filter((p) => p.vendor === vendor);
  const supplierPrices = getValidPrices(supplierHistory, 10);
  let supplierAvg = avgProduct;
  if (supplierPrices.length >= MIN_VALID_RECORDS) {
    const supplierFiltered = filterOutliers(supplierPrices);
    if (supplierFiltered.length > 0) {
      supplierAvg = supplierFiltered.reduce((s, v) => s + v, 0) / supplierFiltered.length;
    }
  }

  // ✅ حماية من division by zero
  const globalDiff = avgProduct > 1e-6 ? (cur - avgProduct) / avgProduct : 0;
  const branchDiff = avgProduct > 1e-6 ? (branchAvg - avgProduct) / avgProduct : 0;
  const supplierDiff = avgProduct > 1e-6 ? (supplierAvg - avgProduct) / avgProduct : 0;

  const branchAbs = Math.abs(toFiniteNumber(branchDiff, 0));
  const supplierAbs = Math.abs(toFiniteNumber(supplierDiff, 0));
  const total = branchAbs + supplierAbs;

  let branch_percent = 0,
    supplier_percent = 0;
  if (total > 0) {
    branch_percent = Math.round((branchAbs / total) * 100);
    supplier_percent = 100 - branch_percent;
  }

  const threshold = Math.max(0.02, riskyThreshold * Math.max(0.5, sensitivity));
  const branchHigh = branchDiff > threshold;
  const supplierHigh = supplierDiff > threshold;
  const marketSimilar = Math.abs(branchDiff - supplierDiff) <= ROOT_CAUSE_MARKET_SIMILARITY;

  let source = 'normal';
  let causeAr = 'لا يوجد ارتفاع غير طبيعي';
  let causeEn = 'No unusual increase';
  let recommendationAr = 'استمر بالشراء مع متابعة دورية';
  let recommendationEn = 'Continue purchasing with routine monitoring';

  if (branchHigh && !supplierHigh) {
    source = 'branch';
    causeAr = `الفرع "${branch}" يشتري أعلى من المتوسط (${formatPercent(branchDiff)})`;
    causeEn = `Branch "${branch}" is buying ${formatPercent(branchDiff)} above average`;
    recommendationAr =
      'راجع إدارة الفرع وقارن تنفيذ سياسة الشراء بين الفروع';
    recommendationEn =
      'Review branch purchasing governance and compare branch policy compliance';
  } else if (supplierHigh && !branchHigh) {
    source = 'supplier';
    causeAr = `المورد "${vendor}" أعلى من متوسط السوق (${formatPercent(supplierDiff)})`;
    causeEn = `Supplier "${vendor}" is ${formatPercent(supplierDiff)} above market average`;
    recommendationAr = 'تفاوض مع المورد أو بدله بمورد أقل سعرا';
    recommendationEn = 'Negotiate with supplier or switch to a lower-cost supplier';
  } else if (branchHigh && supplierHigh) {
    source = 'both';
    causeAr = `الفرع "${branch}" والمورد "${vendor}" كلاهما يرفع التكلفة (${formatPercent(
      Math.max(branchDiff, supplierDiff)
    )})`;
    causeEn = `Both branch "${branch}" and supplier "${vendor}" are driving costs higher`;
    recommendationAr = 'غيّر المورد وفعّل مراجعة فورية لمشتريات الفرع';
    recommendationEn =
      'Change supplier and run immediate branch purchase review';
  } else if (globalDiff > threshold && marketSimilar) {
    source = 'market';
    causeAr = 'ارتفاع عام في السوق/الصنف وليس انحرافا محليا واضحا';
    causeEn = 'General market/item increase with no clear local outlier';
    recommendationAr =
      'أعد ضبط سعر الاستهداف أو أخر الشراء حتى تهدأ الأسعار';
    recommendationEn = 'Adjust target price or delay purchases until prices cool down';
  } else if (globalDiff > threshold) {
    source = 'price_spike';
    causeAr = `السعر الحالي أعلى من المعتاد بـ ${formatPercent(globalDiff)} دون مؤشر انحراف محلي حاسم`;
    causeEn = `Current price is ${formatPercent(globalDiff)} above usual levels without a decisive local outlier`;
    recommendationAr = 'لا تشتر الآن وراقب السوق أو اطلب عرض سعر بديل';
    recommendationEn = 'Do not buy now; monitor the market or request an alternative quote';
  }

  const alerts = [];
  if (branchDiff > threshold) {
    alerts.push({
      ar: `🚨 فرع "${branch}" يشتري ${formatPercent(branchDiff)} أعلى من المتوسط`,
      en: `🚨 Branch "${branch}" buys ${formatPercent(branchDiff)} above average`,
    });
  }
  if (supplierDiff > threshold) {
    alerts.push({
      ar: `🚨 المورد "${vendor}" أعلى من السوق بـ ${formatPercent(supplierDiff)}`,
      en: `🚨 Supplier "${vendor}" is ${formatPercent(supplierDiff)} above market`,
    });
  }

  return {
    source,
    causeAr,
    causeEn,
    recommendationAr,
    recommendationEn,
    globalDiff: toFiniteNumber(globalDiff, 0),
    branchDiff: toFiniteNumber(branchDiff, 0),
    supplierDiff: toFiniteNumber(supplierDiff, 0),
    avgProduct: toFiniteNumber(avgProduct, 0),
    branchAvg: toFiniteNumber(branchAvg, 0),
    supplierAvg: toFiniteNumber(supplierAvg, 0),
    branchContribution: branch_percent,
    supplierContribution: supplier_percent,
    marketContribution: total === 0 ? 50 : 0,
    alerts: uniqueLocalizedMessages(alerts),
  };
}

// ==========================================
// GRADE UTILITIES
// ==========================================
export function getGradeStyle(grade) {
  switch (grade) {
    case 'A':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-300',
        solid: 'bg-emerald-500',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      };
    case 'B':
      return {
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-300',
        solid: 'bg-indigo-500',
        badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      };
    case 'C':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-300',
        solid: 'bg-amber-500',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
      };
    case 'D':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-300',
        solid: 'bg-red-500',
        badge: 'bg-red-100 text-red-800 border-red-300',
      };
    default:
      return {
        bg: 'bg-stone-50',
        text: 'text-stone-600',
        border: 'border-stone-300',
        solid: 'bg-stone-400',
        badge: 'bg-stone-100 text-stone-700 border-stone-300',
      };
  }
}

// ==========================================
// ENRICHMENT FUNCTION
// ==========================================
export function enrichPurchasesWithScores(purchases, settings) {
  const byCode = {};
  purchases.forEach((p) => {
    if (!byCode[p.code]) byCode[p.code] = [];
    byCode[p.code].push(p);
  });

  return purchases.map((p) => {
    if (p.score != null && p.grade) return p;

    const currentTs = p.date ? new Date(p.date).getTime() : p.timestamp || 0;
    const history = (byCode[p.code] || [])
      .filter(
        (h) =>
          h.id !== p.id && (h.date ? new Date(h.date).getTime() : h.timestamp || 0) < currentTs
      )
      .map((h) => ({ price: h.price, timestamp: h.timestamp, date: h.date }));

    const analysis = calculateDecisionScore(p.price, history, settings);
    const root = calculateRootCause(p, history, settings);

    // احسب المتوسط مباشرة من التاريخ المتاح حتى لو كان أقل من MIN_VALID_RECORDS
    const historyPrices = history.map((h) => cleanPriceValue(h.price)).filter((v) => v !== null && v > 0);
    const fallbackAvg = historyPrices.length > 0
      ? historyPrices.reduce((s, v) => s + v, 0) / historyPrices.length
      : 0;
    const avgPrice = analysis?.avgPrice || fallbackAvg;
    const qty = Number(p.qty) || 1;
    const impact = avgPrice > 0 ? calculateImpact(p.price, avgPrice, qty) : 0;

    return analysis
      ? {
          ...p,
          score: analysis.score,
          grade: analysis.grade,
          decisionAr: analysis.decisionAr,
          decisionEn: analysis.decisionEn,
          reasonAr:
            p.reasonAr ??
            analysis.reasons?.[0]?.ar ?? null,
          reasonEn:
            p.reasonEn ??
            analysis.reasons?.[0]?.en ?? null,
          causeSource: p.causeSource ?? root?.source ?? null,
          causeAr: p.causeAr ?? root?.causeAr ?? null,
          causeEn: p.causeEn ?? root?.causeEn ?? null,
          recommendationAr:
            p.recommendationAr ??
            root?.recommendationAr ?? null,
          recommendationEn:
            p.recommendationEn ??
            root?.recommendationEn ?? null,
          impact: impact,
        }
      : {
          ...p,
          score: null,
          grade: p.status || null,
          causeSource: p.causeSource ?? root?.source ?? null,
          causeAr: p.causeAr ?? root?.causeAr ?? null,
          causeEn: p.causeEn ?? root?.causeEn ?? null,
          recommendationAr:
            p.recommendationAr ??
            root?.recommendationAr ?? null,
          recommendationEn:
            p.recommendationEn ??
            root?.recommendationEn ?? null,
          impact: impact,
        };
  });
}

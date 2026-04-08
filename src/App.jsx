import React, { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import { motion } from 'framer-motion';
import { 
  collection, onSnapshot, addDoc, deleteDoc, doc, getDocs, updateDoc 
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from 'firebase/auth';

// الأيقونات
import { 
  ShoppingCart, Database, PlusCircle, TrendingUp, TrendingDown, Minus, Save, RotateCcw,
  BarChart3, Search, CheckCircle, AlertCircle, ChevronDown,
  Settings, Package, Store, MapPin, Trash2, Wallet, ArrowDownRight, ArrowUpRight, AlertTriangle,
  PieChart, Award, ThumbsDown, Activity, FileText, Printer, X, CalendarDays, Download, Copy,
  Languages, LogOut, LogIn, User, UserCircle, Filter, SlidersHorizontal, Info, Zap, Target,
  TrendingUp as TrendUp, ShieldAlert, ChevronsLeft, ChevronsRight
} from './lucideIcons';
import { 
  LineChart, AreaChart, Area, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Legend, LabelList,
  PieChart as RechartsPie, Pie, Cell, ReferenceLine
} from 'recharts';
import ErrorBoundary from './components/ErrorBoundary';
import DataTable from './components/DataTable';
import FilterChips from './components/FilterChips';
import EmptyState from './components/EmptyState';
import { auth, db, firebaseConfigError, firebaseReady } from './firebase';
import translations from './utils/translations';
import { playUiSound, speakSaveSuccess } from './utils/audioUtils';
import {
  DEFAULT_ENGINE_SETTINGS,
  MIN_VALID_RECORDS,
  cleanPriceValue,
  filterOutliers,
  formatPercent,
  formatSmartNumber,
  calculateDecisionScore,
  calculateRootCause,
  getGradeStyle,
  getDecisionLabelByGrade,
  enrichPurchasesWithScores,
} from './utils/decisionEngine';

const MotionRef = motion;

const COMPANY_LOGO = '/brand-logo.png';
const EMPTY_LIST = Object.freeze([]);
const DASHBOARD_FILTERS_KEY = 'dashboard_filters_v1';
const PURCHASES_DELETE_BACKUP_KEY = 'purchases_delete_backup_v1';
const DESKTOP_SIDEBAR_COLLAPSED_KEY = 'desktop_sidebar_collapsed_v1';
const isMediumDesktopWidth = (width) => width >= 1024 && width < 1366;
const allowedEmails = new Set(
  String(import.meta.env.VITE_ALLOWED_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

const isEmailAllowed = (email) => {
  if (!allowedEmails.size) return true;
  return allowedEmails.has(String(email || '').trim().toLowerCase());
};

const makeCursorDataUrl = (svg) => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 6 3, auto`;

const VIEW_CURSOR_MAP = {
  dashboard: makeCursorDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" fill="#f8fbff" stroke="#4d6e9d" stroke-width="1.8"/><rect x="6" y="7" width="5" height="5" rx="1" fill="#9fb5d2"/><rect x="13" y="7" width="5" height="2" rx="1" fill="#9fb5d2"/><rect x="13" y="10.5" width="5" height="2" rx="1" fill="#9fb5d2"/><rect x="6" y="14" width="12" height="3" rx="1.5" fill="#c8d7ea"/></svg>'),
  analytics: makeCursorDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" fill="#f8fbff" stroke="#4d6e9d" stroke-width="1.8"/><path d="M6 16l3.3-3.2 2.4 2.1 4.7-5" fill="none" stroke="#4d6e9d" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16.6" cy="10" r="1.3" fill="#4d6e9d"/></svg>'),
  entry: makeCursorDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2" fill="#fff" stroke="#4d6e9d" stroke-width="1.8"/><rect x="7.5" y="7" width="9" height="1.8" rx="0.9" fill="#9fb5d2"/><rect x="7.5" y="10.2" width="9" height="1.8" rx="0.9" fill="#9fb5d2"/><rect x="7.5" y="13.4" width="5.5" height="1.8" rx="0.9" fill="#9fb5d2"/><path d="M14.8 17.3l1.4 1.4 2.8-2.8" fill="none" stroke="#5d8373" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
  database: makeCursorDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3" fill="#eef4fb" stroke="#4d6e9d" stroke-width="1.8"/><path d="M5 6v9c0 1.7 3.1 3 7 3s7-1.3 7-3V6" fill="#f8fbff" stroke="#4d6e9d" stroke-width="1.8"/><path d="M5 10c0 1.7 3.1 3 7 3s7-1.3 7-3M5 14c0 1.7 3.1 3 7 3s7-1.3 7-3" fill="none" stroke="#9fb5d2" stroke-width="1.4"/></svg>'),
  master: makeCursorDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="#f8fbff" stroke="#4d6e9d" stroke-width="1.8"/><path d="M12 3.8v2.3M12 17.9v2.3M3.8 12h2.3M17.9 12h2.3M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M6.1 17.9l1.6-1.6M16.3 7.7l1.6-1.6" stroke="#4d6e9d" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="7.4" fill="none" stroke="#c8d7ea" stroke-width="1.2"/></svg>'),
};

const readDashboardFilters = () => {
  try {
    const raw = localStorage.getItem(DASHBOARD_FILTERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const readPurchasesDeleteBackup = () => {
  try {
    const raw = localStorage.getItem(PURCHASES_DELETE_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.records) || !parsed.records.length) return null;
    return parsed;
  } catch {
    return null;
  }
};

const getRecordTimestamp = (record) => {
  const ts = Number(record?.timestamp);
  if (Number.isFinite(ts) && ts > 0) return ts;
  if (record?.date) {
    const parsed = new Date(record.date).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const getSafePurchaseTotal = (record) => {
  const storedTotal = Number(record?.total);
  if (Number.isFinite(storedTotal)) return storedTotal;

  const price = cleanPriceValue(record?.price);
  const qty = Number(record?.qty) || 1;
  return price !== null ? price * qty : 0;
};

const getLocalizedDecisionLabel = (grade, ar) => {
  const base = getDecisionLabelByGrade(grade);
  if (!ar) return base;
  const normalized = String(base || '').trim().toLowerCase();
  if (normalized === 'buy now') return 'اشتر الآن';
  if (normalized === 'monitor') return 'راقب';
  if (normalized === 'do not buy') return 'لا تشتر';
  return base;
};

const cleanItemLabel = (item, code) => {
  const itemName = String(item || '').trim();
  const itemCode = String(code || '').trim();
  if (itemName && itemCode) return `${itemName} (#${itemCode})`;
  return itemName || itemCode || '-';
};

const triggerHaptic = (duration = 8) => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(duration);
    }
  } catch {
    // Ignore unsupported haptics APIs.
  }
};

const normalizeSearchValue = (value) => {
  if (value == null) return '';
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .trim();
};

function App() {
  const savedDashboardFilters = useMemo(() => readDashboardFilters(), []);
  const defaultCustomTo = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultCustomFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const [user, setUser] = useState(null);
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('app_lang') || 'ar';
    } catch {
      return 'ar';
    }
  });
  const [currentView, setCurrentView] = useState('dashboard');
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(DESKTOP_SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [autoDesktopSidebarCompact, setAutoDesktopSidebarCompact] = useState(() => {
    if (typeof window === 'undefined') return false;
    return isMediumDesktopWidth(window.innerWidth);
  });
  const [desktopSidebarHoverExpanded, setDesktopSidebarHoverExpanded] = useState(false);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissedGlobalAlerts, setDismissedGlobalAlerts] = useState([]);
  const [engineSettings, setEngineSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('engine_settings');
      if (!saved) return DEFAULT_ENGINE_SETTINGS;
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_ENGINE_SETTINGS, ...parsed };
    } catch (err) {
      console.error('Failed to parse engine_settings:', err);
      return DEFAULT_ENGINE_SETTINGS;
    }
  });

  // Firestore Data
  const [purchases, setPurchases] = useState([]);
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [syncState, setSyncState] = useState({ purchases: false, items: false, branches: false, vendors: false });
  const [sharedTimeFilter, setSharedTimeFilter] = useState(savedDashboardFilters?.timeFilter || 'weekly');
  const [sharedCustomFrom, setSharedCustomFrom] = useState(savedDashboardFilters?.customFrom || defaultCustomFrom);
  const [sharedCustomTo, setSharedCustomTo] = useState(savedDashboardFilters?.customTo || defaultCustomTo);
  const autoSeedTriggeredRef = useRef(false);
  const notificationTimerRef = useRef(null);
  const deferredPurchases = useDeferredValue(purchases);

  const t = useCallback((k) => translations[lang][k] || k, [lang]);
  const viewTitleKey = {
    dashboard: 'dashboard',
    analytics: 'analytics',
    entry: 'entry',
    database: 'database',
    master: 'master_data',
  };
  const ar = lang === 'ar';
  const enrichedPurchases = useMemo(
    () => enrichPurchasesWithScores(deferredPurchases, engineSettings),
    [deferredPurchases, engineSettings]
  );
  const analyticsAlertCount = useMemo(() => {
    if (!enrichedPurchases.length) return 0;
    const riskyCount = enrichedPurchases.filter((p) => {
      const grade = String(p?.grade || '').toUpperCase();
      return grade === 'C' || grade === 'D';
    }).length;
    return Math.min(riskyCount, 9);
  }, [enrichedPurchases]);
  const isDesktopSidebarCollapsed = autoDesktopSidebarCompact
    ? !desktopSidebarHoverExpanded
    : desktopSidebarCollapsed;
  const desktopSidebarWidth = isDesktopSidebarCollapsed ? 78 : 272;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!window.matchMedia || !window.matchMedia('(pointer:fine)').matches) return;

    const cursor = VIEW_CURSOR_MAP[currentView] || 'auto';
    const previousCursor = document.body.style.cursor;
    const previousVar = document.documentElement.style.getPropertyValue('--view-cursor');
    document.body.style.cursor = cursor;
    document.documentElement.style.setProperty('--view-cursor', cursor);

    return () => {
      document.body.style.cursor = previousCursor || 'auto';
      if (previousVar) document.documentElement.style.setProperty('--view-cursor', previousVar);
      else document.documentElement.style.removeProperty('--view-cursor');
    };
  }, [currentView]);

  // حفظ لغة الواجهة في Local Storage
  useEffect(() => {
    try {
      localStorage.setItem('app_lang', lang);
    } catch (err) {
      console.warn('Failed to save language preference:', err.message);
    }
  }, [lang]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang === 'ar' ? 'ar' : 'en';
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('translate', 'no');
    document.body.setAttribute('translate', 'no');
    document.body.classList.add('notranslate');
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem(DESKTOP_SIDEBAR_COLLAPSED_KEY, desktopSidebarCollapsed ? '1' : '0');
    } catch {
      // Ignore localStorage write errors.
    }
  }, [desktopSidebarCollapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return () => {};

    const syncCompactMode = () => {
      const shouldAutoCompact = isMediumDesktopWidth(window.innerWidth);
      setAutoDesktopSidebarCompact(shouldAutoCompact);
      if (!shouldAutoCompact) setDesktopSidebarHoverExpanded(false);
    };

    syncCompactMode();
    window.addEventListener('resize', syncCompactMode);
    return () => window.removeEventListener('resize', syncCompactMode);
  }, []);

  useEffect(() => () => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
  }, []);

  // مراقبة تسجيل الدخول
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
 // if (usr && !isEmailAllowed(usr.email)) {
//   try {
//     await signOut(auth);
//   } catch {}
//   setUser(null);
//   setLoading(false);
//   setNotification({
//     message: lang === 'ar'
//       ? '🚫 هذا البريد الإلكتروني غير مسموح له بالدخول'
//       : 'This email address is not allowed to access the app.',
//     type: 'error',
//   });
//   return;
// }

      setUser(usr);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [lang]);

  // جلب البيانات
  useEffect(() => {
    if (!db) return;
    if (!user) return;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    let retryTimers = [];

    const onRealtimeError = (collection, err) => {
      // Log error only in development
      if (import.meta.env.DEV) {
        console.error(`Realtime listener error for ${collection}:`, err);
      }
      
      // Only retry on specific recoverable errors
      const isRecoverable = err.code === 'permission-denied' || 
                           err.code === 'unavailable' ||
                           err.code === 'unauthenticated';
      
      if (isRecoverable && retryCount < maxRetries) {
        retryCount++;
        if (import.meta.env.DEV) {
          console.warn(`Retrying ${collection} (attempt ${retryCount}/${maxRetries})...`);
        }
        const timer = setTimeout(() => {
          // Reinitialize listeners
          setupListeners();
        }, retryDelay * retryCount);
        retryTimers.push(timer);
      } else {
        setNotification({
          message: lang === 'ar' 
            ? `تعذر مزامنة البيانات${retryCount >= maxRetries ? ' - تم استنفاد محاولات إعادة المحاولة' : ''}, تحقق من الصلاحيات أو الاتصال`
            : `Failed to sync data${retryCount >= maxRetries ? ' - retry limit exceeded' : ''}, check permissions or network`,
          type: 'error'
        });
      }
    };

    const setupListeners = () => {
      setSyncState({ purchases: false, items: false, branches: false, vendors: false });
      retryCount = 0;

      const unP = onSnapshot(collection(db, 'purchases'), (s) => {
        const normalized = s.docs
          .map(d => ({ ...d.data(), id: d.id }))
          .sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b));
        setPurchases(normalized);
        setSyncState(prev => ({ ...prev, purchases: true }));
        setNotification(null); // Clear error when successful
      }, (err) => onRealtimeError('purchases', err));

      const unI = onSnapshot(collection(db, 'items'), (s) => {
        setItems(s.docs.map(d => ({ ...d.data(), id: d.id })));
        setSyncState(prev => ({ ...prev, items: true }));
      }, (err) => onRealtimeError('items', err));

      const unB = onSnapshot(collection(db, 'branches'), (s) => {
        setBranches(s.docs.map(d => ({ ...d.data(), id: d.id })));
        setSyncState(prev => ({ ...prev, branches: true }));
      }, (err) => onRealtimeError('branches', err));

      const unV = onSnapshot(collection(db, 'vendors'), (s) => {
        setVendors(s.docs.map(d => ({ ...d.data(), id: d.id })));
        setSyncState(prev => ({ ...prev, vendors: true }));
      }, (err) => onRealtimeError('vendors', err));

      return () => {
        unP(); 
        unI(); 
        unB(); 
        unV();
        retryTimers.forEach(timer => clearTimeout(timer));
        retryTimers = [];
      };
    };

    const unsubscribe = setupListeners();
    return unsubscribe;
  }, [user, lang]);

  const showMsg = useCallback((message, type = 'success', details = null) => {
    const duration = type === 'error' ? 5000 : type === 'warning' ? 4000 : 3000;
    playUiSound(type === 'success' ? 'save' : 'error');
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    setNotification({ message, type, details });
    notificationTimerRef.current = setTimeout(() => {
      setNotification(null);
      notificationTimerRef.current = null;
    }, duration);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      showMsg(lang === 'ar' ? 'تم تسجيل الخروج بنجاح' : 'Logged out successfully', 'success');
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Logout error:', err);
      }
      showMsg(lang === 'ar' ? 'خطأ في تسجيل الخروج' : 'Failed to log out', 'error');
    }
  }, [lang, showMsg]);

  const seedDemoData = useCallback(async ({ replaceExisting = true, silent = false } = {}) => {
    if (!db) {
      if (!silent) {
        showMsg(translations[lang]?.firebase_incomplete || 'Firebase configuration is incomplete', 'error');
      }
      return;
    }

    if (isSeedingDemo) return;
    setIsSeedingDemo(true);
    try {
      const clearCollection = async (name) => {
        const docsSnap = await getDocs(collection(db, name));
        if (!docsSnap.docs.length) return;
        await Promise.all(docsSnap.docs.map((d) => deleteDoc(doc(db, name, d.id))));
      };

      if (replaceExisting) {
        await Promise.all([
          clearCollection('purchases'),
          clearCollection('items'),
          clearCollection('branches'),
          clearCollection('vendors'),
        ]);
      }

      const demoItems = [
        { code: '1001', name: ar ? 'لوز أفغاني طويل' : 'Afghani Long Almonds', initialPrice: 58 },
        { code: '1002', name: ar ? 'كاجو مالح' : 'Salted Cashews', initialPrice: 44 },
        { code: '1003', name: ar ? 'فستق ليمون' : 'Lemon Pistachio', initialPrice: 52 },
        { code: '1004', name: ar ? 'عين الجمل' : 'Walnuts', initialPrice: 48 },
        { code: '1005', name: ar ? 'بذر قرع مقشر' : 'Peeled Pumpkin Seeds', initialPrice: 26 },
        { code: '1006', name: ar ? 'حب شمسي محمص' : 'Roasted Sunflower Seeds', initialPrice: 18 },
        { code: '1007', name: ar ? 'زبيب أسود أفغاني' : 'Afghani Black Raisins', initialPrice: 24 },
        { code: '1008', name: ar ? 'تين مجفف تركي' : 'Turkish Dried Fig', initialPrice: 36 },
        { code: '1009', name: ar ? 'حمص حب' : 'Whole Chickpeas', initialPrice: 14 },
        { code: '1010', name: ar ? 'عدس تركي' : 'Turkish Lentils', initialPrice: 12 },
        { code: '1011', name: ar ? 'فلفل أسود حب' : 'Black Pepper Whole', initialPrice: 22 },
        { code: '1012', name: ar ? 'كركم حب' : 'Whole Turmeric', initialPrice: 18 },
        { code: '1013', name: ar ? 'كمون حب هندي' : 'Indian Cumin Seeds', initialPrice: 19 },
        { code: '1014', name: ar ? 'قرفة سيلاني' : 'Ceylon Cinnamon', initialPrice: 29 },
        { code: '1015', name: ar ? 'بهارات مشكل' : 'Mixed Spices', initialPrice: 16 },
        { code: '1016', name: ar ? 'زنجبيل حب' : 'Whole Ginger', initialPrice: 17 },
        { code: '1017', name: ar ? 'زعتر ملوكي' : 'Premium Thyme', initialPrice: 21 },
        { code: '1018', name: ar ? 'سكر الأسرة' : 'Family Sugar', initialPrice: 11 },
        { code: '1019', name: ar ? 'زيت جوز الهند' : 'Coconut Oil', initialPrice: 27 },
        { code: '1020', name: ar ? 'خميرة ساف إنستانت' : 'Saf Instant Yeast', initialPrice: 14 },
        { code: '1021', name: ar ? 'بيكنج بودر' : 'Baking Powder', initialPrice: 9 },
        { code: '1022', name: ar ? 'كاكاو خام' : 'Raw Cocoa', initialPrice: 31 },
        { code: '1023', name: ar ? 'لبان ذكر' : 'Frankincense', initialPrice: 33 },
        { code: '1024', name: ar ? 'اسبغول' : 'Psyllium', initialPrice: 25 },
        { code: '1025', name: ar ? 'صبغة الموسى' : 'Mousa Dye', initialPrice: 20 },
        { code: '1026', name: ar ? 'نيلة مطحونة' : 'Ground Indigo', initialPrice: 23 },
        { code: '1027', name: ar ? 'سباغيتي' : 'Spaghetti', initialPrice: 8 },
        { code: '1028', name: ar ? 'طحين فاخر كويتي' : 'Premium Kuwaiti Flour', initialPrice: 13 },
      ];
      const demoBranches = [
        { name: ar ? 'فرع حراء' : 'Hira Branch' },
        { name: ar ? 'فرع الصفا' : 'Al Safa Branch' },
        { name: ar ? 'فرع السنابل' : 'Al Sanabel Branch' },
        { name: ar ? 'فرع الحمدانية' : 'Al Hamdaniyah Branch' },
        { name: ar ? 'فرع السامر' : 'Al Samer Branch' },
        { name: ar ? 'فرع صاري' : 'Sari Branch' },
        { name: ar ? 'فرع بحرة' : 'Bahra Branch' },
        { name: ar ? 'فرع الزهراء' : 'Al Zahraa Branch' },
        { name: ar ? 'فرع الطائف' : 'Taif Branch' },
        { name: ar ? 'فرع المدينة المنورة' : 'Madinah Branch' },
      ];
      const demoVendors = [
        { name: ar ? 'بن عفيف - باب مكة' : 'Bin Afif - Bab Makkah' },
        { name: ar ? 'دار العطار المسعودي - باب شريف' : 'Dar Al Attar Al Masoudi - Bab Sharif' },
        { name: ar ? 'بيت العطار المرواني - الخاسكية' : 'Beit Al Attar Al Marwani - Al Kaskiyah' },
        { name: ar ? 'عطارة العمري - باب شريف' : 'Attarat Al Omari - Bab Sharif' },
        { name: ar ? 'العطارة الحجازية - الخاسكية' : 'Al Hijaziyah Attar - Al Kaskiyah' },
        { name: ar ? 'مؤسسة الزهراني للأعشاب - البلد' : 'Al Zahrani Herbs - Al Balad' },
        { name: ar ? 'بيت البن اليماني - جدة التاريخية' : 'Yemeni Coffee House - Historic Jeddah' },
      ];

      const addMissingMasterData = async (collectionName, incoming, key) => {
        const existingSnap = await getDocs(collection(db, collectionName));
        const existingKeys = new Set(
          existingSnap.docs
            .map((d) => String(d.data()?.[key] ?? '').trim().toLowerCase())
            .filter(Boolean)
        );

        const uniqueIncoming = [];
        incoming.forEach((entry) => {
          const normalized = String(entry?.[key] ?? '').trim().toLowerCase();
          if (!normalized || existingKeys.has(normalized)) return;
          existingKeys.add(normalized);
          uniqueIncoming.push(entry);
        });

        if (uniqueIncoming.length > 0) {
          await Promise.all(uniqueIncoming.map((x) => addDoc(collection(db, collectionName), x)));
        }
      };

      await addMissingMasterData('items', demoItems, 'code');
      await addMissingMasterData('branches', demoBranches, 'name');
      await addMissingMasterData('vendors', demoVendors, 'name');

      const today = new Date();
      const mkDate = (offset) => {
        const d = new Date(today);
        d.setDate(today.getDate() + offset);
        return d.toISOString().slice(0, 10);
      };

      const b = (i) => demoBranches[i].name;
      const v = (i) => demoVendors[i].name;
      // نولد حركة سنوية موسمية أقرب للواقع مع اختلاف حسب نوع الصنف.
      const roundMultipliers = [0.64, 0.67, 0.71, 0.75, 0.79];
      const ranges = [
  [1001,1006,[-332,-246,-154,-52,-16],[1,0,2,6,9],[0,1,0,2,4]],
  [1007,1008,[-318,-228,-146,-66,-24],[0,1,1,3,4],[0,0,1,1,2]],
  [1009,1010,[-340,-260,-176,-92,-36],[0,-1,0,1,2],[0,0,0,1,1]],
  [1011,1017,[-336,-272,-188,-104,-42],[0,1,-1,2,1],[0,3,-1,4,1]],
  [1018,1019,[-330,-236,-150,-60,-18],[0,0,1,3,5],[0,0,1,2,2]],
  [1020,1024,[-314,-214,-122,-34,-8],[0,1,3,7,10],[0,0,1,2,3]],
  [1025,1026,[-300,-210,-128,-48,-14],[0,0,1,2,3],[0,1,0,2,2]],
];

const getSeasonalProfile = (code) => {
  const n = Number(code);
  const r = ranges.find(([min, max]) => n >= min && n <= max);

  return r
    ? { offsets: r[2], qtyBoost: r[3], priceBump: r[4] }
    : { offsets: [-326,-232,-148,-58,-20], qtyBoost: [0,0,1,2,3], priceBump: [0,0,0,1,1] };
};
      const scenario = demoItems.flatMap((item, itemIndex) => {
        const baseQty = 14 + (itemIndex % 5) * 4;
        const profile = getSeasonalProfile(item.code);

        return roundMultipliers.map((multiplier, roundIndex) => {
          const rawPrice = item.initialPrice * multiplier;
          const adjustedPrice = Math.max(
            1,
            Math.round(rawPrice + (itemIndex % 3) * 0.35 + profile.priceBump[roundIndex])
          );
          const qty = Math.max(
            6,
            baseQty + profile.qtyBoost[roundIndex] + (((itemIndex + roundIndex) % 3) === 0 ? 2 : 0)
          );
          const offset = profile.offsets[roundIndex] + ((itemIndex * 5) % 9);

          return {
            o: offset,
            code: item.code,
            name: item.name,
            branch: b((itemIndex + roundIndex) % demoBranches.length),
            vendor: v((itemIndex + roundIndex * 2) % demoVendors.length),
            price: adjustedPrice,
            qty,
          };
        });
      }).sort((a, b) => a.o - b.o);

      const staged = [];
      for (const row of scenario) {
        const currentPrice = Number(row.price);
        const qty = Number(row.qty);
        const history = staged.filter((p) => p.code === row.code);

        const analysis = history.length >= 2 ? calculateDecisionScore(currentPrice, history, engineSettings) : null;
        const root = history.length >= 2
          ? calculateRootCause(
            {
              code: row.code,
              branch: row.branch,
              vendor: row.vendor,
              name: row.name,
              price: currentPrice,
            },
            history,
            engineSettings
          )
          : null;

        const data = {
          date: mkDate(row.o),
          branch: row.branch,
          vendor: row.vendor,
          code: row.code,
          name: row.name,
          price: currentPrice,
          qty,
          total: currentPrice * qty,
          diff: 0,
          status: analysis?.grade ?? 'A',
          score: analysis?.score ?? null,
          grade: analysis?.grade ?? 'A',
          decisionAr: analysis?.decisionAr ?? null,
          decisionEn: analysis?.decisionEn ?? null,
          reasonAr: analysis?.reasons?.[0]?.ar || null,
          reasonEn: analysis?.reasons?.[0]?.en || null,
          causeSource: root?.source ?? null,
          causeAr: root?.causeAr ?? null,
          causeEn: root?.causeEn ?? null,
          recommendationAr: root?.recommendationAr ?? null,
          recommendationEn: root?.recommendationEn ?? null,
          timestamp: new Date(`${mkDate(row.o)}T09:00:00`).getTime(),
        };

        await addDoc(collection(db, 'purchases'), data);
        staged.push(data);
      }

      if (!silent) {
        showMsg(
          ar ? '✓ بيانات تجريبية جاهزة' : '✓ Demo Data Ready',
          'success',
          ar
            ? `تمت تعبئة ${scenario.length} عملية شراء على ${demoItems.length} صنف`
            : `${scenario.length} demo transactions loaded across ${demoItems.length} items`
        );
      }
    } catch (err) {
      // Log error only in development
      if (import.meta.env.DEV) {
        console.error('Demo seed error:', err);
      }
      showMsg(
        ar ? '❌ فشل تحميل البيانات التجريبية' : '❌ Demo Load Failed',
        'error',
        ar ? 'تعذر الوصول إلى قاعدة البيانات' : 'Database connection failed'
      );
    } finally {
      setIsSeedingDemo(false);
    }
  }, [isSeedingDemo, ar, engineSettings, showMsg, lang]);

  useEffect(() => {
    if (!user || isSeedingDemo || autoSeedTriggeredRef.current) return;
    const syncReady = syncState.purchases && syncState.items && syncState.branches && syncState.vendors;
    if (!syncReady) return;

    const allEmpty = purchases.length === 0 && items.length === 0 && branches.length === 0 && vendors.length === 0;
    if (!allEmpty) return;

    autoSeedTriggeredRef.current = true;
    seedDemoData({ replaceExisting: false, silent: false });
  }, [user, isSeedingDemo, syncState, purchases.length, items.length, branches.length, vendors.length, seedDemoData]);

  const globalAlerts = useMemo(() => {
    // SPEC I: Alert system with decision-oriented messages
    const normalized = deferredPurchases
      .map((p) => {
        const price = cleanPriceValue(p.price);
        return price !== null ? { ...p, price } : null;
      })
      .filter((p) => p !== null);

    const alerts = [];
    if (!normalized.length) return alerts;

    // Step 1: Organize by code/branch/vendor
    const byCode = {};
    const byCodeBranch = {};
    const byCodeVendor = {};
    
    normalized.forEach((p) => {
      if (!p.code) return;
      if (!byCode[p.code]) byCode[p.code] = [];
      byCode[p.code].push(p.price);

      if (p.branch) {
        const bKey = `${p.code}__${p.branch}`;
        if (!byCodeBranch[bKey]) byCodeBranch[bKey] = [];
        byCodeBranch[bKey].push(p.price);
      }

      if (p.vendor) {
        const sKey = `${p.code}__${p.vendor}`;
        if (!byCodeVendor[sKey]) byCodeVendor[sKey] = [];
        byCodeVendor[sKey].push(p.price);
      }
    });

    // Step 2: Filter outliers before calculations
    const avg = (arr) => {
      if (arr.length < MIN_VALID_RECORDS) return 0;
      const filtered = filterOutliers(arr);
      return filtered.length ? (filtered.reduce((s, v) => s + v, 0) / filtered.length) : 0;
    };

    // SPEC I: Price increase > 10% in last 5 operations
    const sorted = [...normalized].sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b));
    
    const tail = sorted.slice(-5).map((p) => p.price);
    if (tail.length >= 2) {
      const first = tail[0];
      const last = tail[tail.length - 1];
      const inc = first > 1e-6 ? (last - first) / first : 0;
      if (inc > 0.10) {
        alerts.push({
          severity: 'critical',
          message: lang === 'ar'
            ? `🚨 ارتفاع أسعار جوهري: +${formatPercent(inc, 0)} في آخر العمليات`
            : `🚨 Significant price increase: +${formatPercent(inc, 0)} in recent operations`
        });
      }
    }

    // SPEC I: Branch deviation > 15% vs item average
    let worstBranch = null;
    Object.entries(byCodeBranch).forEach(([key, prices]) => {
      const parts = key.split('__');
      if (parts.length < 2) return;
      const code = parts[0];
      const branch = parts[1];
      const itemAvg = avg(byCode[code] || []);
      if (itemAvg <= 1e-6) return;
      
      const branchAvg = avg(prices);
      const diff = (branchAvg - itemAvg) / itemAvg;
      if (!worstBranch || diff > worstBranch.diff) worstBranch = { branch, diff };
    });
    
    if (worstBranch && worstBranch.diff > 0.15) {
      alerts.push({
        severity: 'critical',
        message: lang === 'ar'
          ? `🔴 الفرع ${worstBranch.branch} أعلى بـ ${formatPercent(worstBranch.diff, 0)} من المتوسط`
          : `🔴 Branch ${worstBranch.branch} is ${formatPercent(worstBranch.diff, 0)} above average — requires review`
      });
    }

    // SPEC I: Supplier above average
    let worstSupplier = null;
    Object.entries(byCodeVendor).forEach(([key, prices]) => {
      const parts = key.split('__');
      if (parts.length < 2) return;
      const code = parts[0];
      const vendor = parts[1];
      const itemAvg = avg(byCode[code] || []);
      if (itemAvg <= 1e-6) return;
      
      const supplierAvg = avg(prices);
      const diff = (supplierAvg - itemAvg) / itemAvg;
      if (!worstSupplier || diff > worstSupplier.diff) worstSupplier = { vendor, diff };
    });
    
    if (worstSupplier && worstSupplier.diff > 0.05) {
      const severity = worstSupplier.diff > 0.15 ? 'critical' : 'warning';
      const supplierLabel = String(worstSupplier.vendor || '')
        .replace(/^(?:مورد|supplier)\s*[:-]?\s*/i, '')
        .trim() || worstSupplier.vendor;
      alerts.push({
        severity,
        message: lang === 'ar'
          ? `مورد ${supplierLabel} مرتفع السعر (${formatPercent(worstSupplier.diff, 0)} فوق المتوسط)`
          : `Supplier ${worstSupplier.vendor} is overpriced (${formatPercent(worstSupplier.diff, 0)} above average)`
      });
    }

    // Deduplicate and limit to 4
    const seen = new Set();
    return alerts.filter((a) => {
      const key = `${a.severity}|${a.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 4);
  }, [deferredPurchases, lang]);

  useEffect(() => {
    setDismissedGlobalAlerts([]);
  }, [globalAlerts.length, lang]);

  const visibleGlobalAlerts = globalAlerts
    .map((alert, index) => ({ ...alert, index }))
    .filter(a => !dismissedGlobalAlerts.includes(a.index));
  const desktopPrimaryNav = [
    { key: 'dashboard', icon: <PieChart size={16}/>, label: t('dashboard') },
    { key: 'analytics', icon: <BarChart3 size={16}/>, label: t('analytics') },
  ];
  const desktopOperationsNav = [
    { key: 'entry', icon: <PlusCircle size={16}/>, label: t('entry') },
    { key: 'database', icon: <Database size={16}/>, label: t('database') },
    { key: 'master', icon: <Settings size={16}/>, label: t('master_data') },
  ];
  const currentViewLabel = t(viewTitleKey[currentView] || currentView);
  const headerSubtitle = lang === 'ar' ? 'منصة المشتريات والتحليل' : 'Procurement & analytics workspace';
  const activeViewContent = useMemo(() => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView purchases={deferredPurchases} enrichedPurchases={enrichedPurchases} isActive t={t} lang={lang} settings={engineSettings} onQuickAdd={() => setCurrentView('entry')} timeFilter={sharedTimeFilter} setTimeFilter={setSharedTimeFilter} customFrom={sharedCustomFrom} setCustomFrom={setSharedCustomFrom} customTo={sharedCustomTo} setCustomTo={setSharedCustomTo} initialFilters={savedDashboardFilters} />;
      case 'analytics':
        return <AnalyticsView purchases={deferredPurchases} enrichedPurchases={enrichedPurchases} isActive t={t} lang={lang} settings={engineSettings} timeFilter={sharedTimeFilter} setTimeFilter={setSharedTimeFilter} customFrom={sharedCustomFrom} setCustomFrom={setSharedCustomFrom} customTo={sharedCustomTo} setCustomTo={setSharedCustomTo} />;
      case 'entry':
        return <EntryFormView purchases={purchases} items={items} branches={branches} vendors={vendors} showMsg={showMsg} t={t} lang={lang} settings={engineSettings} />;
      case 'database':
        return <DatabaseView purchases={deferredPurchases} enrichedPurchases={enrichedPurchases} isActive showMsg={showMsg} t={t} lang={lang} settings={engineSettings} onQuickAdd={() => setCurrentView('entry')} />;
      case 'master':
        return <MasterDataView items={items} branches={branches} vendors={vendors} showMsg={showMsg} t={t} lang={lang} engineSettings={engineSettings} setEngineSettings={(s) => { setEngineSettings(s); try { localStorage.setItem('engine_settings', JSON.stringify(s)); } catch (err) { console.warn('Failed to save engine settings:', err.message); } }} />;
      default:
        return null;
    }
  }, [currentView, deferredPurchases, enrichedPurchases, t, lang, engineSettings, sharedTimeFilter, sharedCustomFrom, sharedCustomTo, savedDashboardFilters, purchases, items, branches, vendors, showMsg]);
  const todayLabel = new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const appVersion = 'v1.0.0';
  const copyrightYear = new Date().getFullYear();

  if (!firebaseReady) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-xl text-center border border-red-200">
          <div className="text-red-500 text-4xl font-black mb-4">⚠️</div>
          <h1 className="text-2xl font-black text-slate-900 mb-4">{lang === 'ar' ? 'خطأ في إعدادات Firebase' : 'Firebase Configuration Error'}</h1>
          <p className="text-slate-600 mb-3 font-bold">{lang === 'ar' ? 'التطبيق لا يمكنه البدء لأن إعدادات البيئة ناقصة.' : 'The app cannot start because environment configuration is incomplete.'}</p>
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">{firebaseConfigError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
          >
            {lang === 'ar' ? 'إعادة تحميل الصفحة' : 'Reload Page'}
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <LoadingScreen lang={lang} />;

  if (!user) return <LoginScreen onLogin={showMsg} lang={lang} setLang={setLang} t={t} />;

  return (
    <ErrorBoundary>
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} translate="no" className="notranslate mobile-readable min-h-screen font-sans flex flex-col md:flex-row pb-20 md:pb-0 text-slate-800" style={{ '--desktop-sidebar-width': `${desktopSidebarWidth}px`, '--app-header-height-mobile': '72px', '--app-header-height-desktop': '86px' }}>
        
        {notification && (
          <div
            className={`fixed top-[calc(var(--app-header-height-mobile)+0.75rem)] md:top-[calc(var(--app-header-height-desktop)+0.75rem)] left-1/2 -translate-x-1/2 w-[min(94vw,620px)] z-[100] animate-in fade-in slide-in-from-top-2 duration-300`}>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className={`btn-surface w-full p-3 md:p-4 rounded-2xl border backdrop-blur-md text-sm md:text-base flex items-center gap-3 cursor-pointer transition-all hover:shadow-xl ${
                notification.type === 'success'
                  ? 'border-emerald-300 bg-emerald-50/95 text-emerald-900 shadow-lg shadow-emerald-200/50'
                  : notification.type === 'error'
                  ? 'border-red-300 bg-red-50/95 text-red-900 shadow-lg shadow-red-200/50'
                  : notification.type === 'warning'
                  ? 'border-amber-300 bg-amber-50/95 text-amber-900 shadow-lg shadow-amber-200/50'
                  : 'border-blue-300 bg-blue-50/95 text-blue-900 shadow-lg shadow-blue-200/50'
              }`}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                notification.type === 'success'
                  ? 'border-emerald-200 bg-white/80'
                  : notification.type === 'error'
                  ? 'border-red-200 bg-white/80'
                  : notification.type === 'warning'
                  ? 'border-amber-200 bg-white/80'
                  : 'border-blue-200 bg-white/80'
              }`}>
                {notification.type === 'success' && <CheckCircle size={24} className="text-emerald-600"/>}
                {notification.type === 'error' && <AlertCircle size={24} className="text-red-600"/>}
                {notification.type === 'warning' && <AlertTriangle size={24} className="text-amber-600"/>}
                {notification.type === 'info' && <Info size={24} className="text-blue-600"/>}
              </span>
              <div className="flex-1 text-right min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-65">
                    {notification.type === 'success'
                      ? (lang === 'ar' ? 'تم' : 'Done')
                      : notification.type === 'error'
                      ? (lang === 'ar' ? 'خطأ' : 'Error')
                      : notification.type === 'warning'
                      ? (lang === 'ar' ? 'تنبيه' : 'Warning')
                      : (lang === 'ar' ? 'معلومة' : 'Info')}
                  </div>
                  <span className="text-[11px] opacity-45">✕</span>
                </div>
                <div className="font-black leading-snug break-words">{notification.message}</div>
                {notification.details && (
                  <div className="text-xs opacity-75 mt-1 break-words">{notification.details}</div>
                )}
                <div className="mt-3 h-1 w-full rounded-full bg-white/55 overflow-hidden">
                  <div className={`h-full rounded-full ${
                    notification.type === 'success'
                      ? 'bg-emerald-500'
                      : notification.type === 'error'
                      ? 'bg-red-500'
                      : notification.type === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                  } animate-[growShrink_3s_linear_forwards]`}></div>
                </div>
              </div>
            </button>
          </div>
        )}

        {visibleGlobalAlerts.length > 0 && (
          <div className="fixed top-[calc(var(--app-header-height-mobile)+5.75rem)] md:top-[calc(var(--app-header-height-desktop)+5.75rem)] left-1/2 -translate-x-1/2 z-[90] w-[min(94vw,920px)] space-y-2">
            {visibleGlobalAlerts.map((a) => {
              const isCritical = a.severity === 'critical';
              return (
              <button
                key={a.index}
                type="button"
                onClick={() => setDismissedGlobalAlerts(prev => [...prev, a.index])}
                className={`btn-surface w-full text-right px-3 md:px-4 py-2.5 rounded-xl border shadow-md text-[11px] md:text-sm font-bold flex items-start md:items-center gap-2 cursor-pointer ${isCritical ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                <AlertTriangle size={16} className={`shrink-0 ${isCritical ? 'text-red-600' : 'text-amber-600'}`}/>
                <span>{a.message}</span>
              </button>
            );})}
          </div>
        )}

      {/* Sidebar (Desktop) */}
      <aside
        onMouseEnter={() => {
          if (autoDesktopSidebarCompact) setDesktopSidebarHoverExpanded(true);
        }}
        onMouseLeave={() => {
          if (autoDesktopSidebarCompact) setDesktopSidebarHoverExpanded(false);
        }}
        className={`hidden md:flex fixed inset-y-0 md:[inset-inline-start:0] z-40 ${isDesktopSidebarCollapsed ? 'w-[78px]' : 'w-[272px]'} bg-[linear-gradient(180deg,#f9fbfe_0%,#f4f7fb_100%)] text-slate-700 flex-col h-screen transition-[width] duration-200 shadow-[0_18px_40px_rgba(15,23,42,0.08)]`}
        style={{ borderInlineEnd: '1px solid rgba(226, 232, 240, 0.95)' }}
      >
        <div className={`${isDesktopSidebarCollapsed ? 'px-2 py-4' : 'px-5 py-4'} border-b border-slate-200/90 bg-white/80 backdrop-blur-sm`}>
          <div className={`flex items-center ${isDesktopSidebarCollapsed ? 'justify-center' : 'justify-between'} mb-3`}>
            <div className={`flex items-center ${isDesktopSidebarCollapsed ? '' : 'gap-3'} min-w-0`}>
              <img src={COMPANY_LOGO} className="w-10 h-10 rounded-xl object-cover bg-white shrink-0 ring-1 ring-slate-200 shadow-sm" alt="Company logo" />
              {!isDesktopSidebarCollapsed && (
                <div className="min-w-0">
                  <h2 className="font-black text-[15px] text-slate-900 truncate">{t('app_name')}</h2>
                  <p className="text-[11px] font-semibold text-slate-500 truncate">{headerSubtitle}</p>
                </div>
              )}
            </div>
            {!isDesktopSidebarCollapsed && !autoDesktopSidebarCompact && (
              <button
                type="button"
                onClick={() => setDesktopSidebarCollapsed(true)}
                className="btn-surface w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 grid place-items-center"
                title={lang === 'ar' ? 'طي القائمة' : 'Collapse sidebar'}
                aria-label={lang === 'ar' ? 'طي القائمة' : 'Collapse sidebar'}
              >
                <ChevronsLeft size={15} />
              </button>
            )}
          </div>
          {isDesktopSidebarCollapsed && !autoDesktopSidebarCompact ? (
            <button
              type="button"
              onClick={() => setDesktopSidebarCollapsed(false)}
              className="btn-surface w-full h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 grid place-items-center"
              title={lang === 'ar' ? 'توسيع القائمة' : 'Expand sidebar'}
              aria-label={lang === 'ar' ? 'توسيع القائمة' : 'Expand sidebar'}
            >
              <ChevronsRight size={15} />
            </button>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{lang === 'ar' ? 'المستخدم' : 'Account'}</div>
              <div className="mt-1 text-[12px] text-slate-700 font-semibold truncate">{(user?.email || 'user').split('@')[0]}</div>
            </div>
          )}
        </div>
        <nav className={`flex-1 ${isDesktopSidebarCollapsed ? 'px-2' : 'px-4'} py-4 overflow-y-auto`}>
          {!isDesktopSidebarCollapsed && <p className="px-2 mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{lang === 'ar' ? 'الرئيسية' : 'Overview'}</p>}
          <div className="space-y-1.5">
            {desktopPrimaryNav.map((item) => (
              <MenuBtn key={item.key} active={currentView === item.key} onClick={()=>setCurrentView(item.key)} icon={item.icon} label={item.label} collapsed={isDesktopSidebarCollapsed} />
            ))}
          </div>
          <div className={`my-4 ${isDesktopSidebarCollapsed ? 'mx-1' : 'mx-2'} border-t border-slate-200`}></div>
          {!isDesktopSidebarCollapsed && <p className="px-2 mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{lang === 'ar' ? 'العمليات والبيانات' : 'Operations & data'}</p>}
          <div className="space-y-1.5">
            {desktopOperationsNav.map((item) => (
              <MenuBtn key={item.key} active={currentView === item.key} onClick={()=>setCurrentView(item.key)} icon={item.icon} label={item.label} collapsed={isDesktopSidebarCollapsed} />
            ))}
          </div>
        </nav>
        <div className={`${isDesktopSidebarCollapsed ? 'px-2' : 'px-4'} py-4 border-t border-slate-200/90 bg-white/70 space-y-2`}>
          <button
            onClick={()=>setLang(lang==='ar'?'en':'ar')}
            className={`w-full flex items-center justify-center ${isDesktopSidebarCollapsed ? '' : 'gap-2'} py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors font-semibold text-xs text-slate-700 border border-slate-200`}
            title={isDesktopSidebarCollapsed ? t('lang') : undefined}
            aria-label={isDesktopSidebarCollapsed ? t('lang') : undefined}
          >
            <Languages size={14}/>{!isDesktopSidebarCollapsed && ` ${t('lang')}`}
          </button>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center justify-center ${isDesktopSidebarCollapsed ? '' : 'gap-2'} py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl transition-colors font-semibold text-xs border border-red-200`}
            title={isDesktopSidebarCollapsed ? t('logout') : undefined}
            aria-label={isDesktopSidebarCollapsed ? t('logout') : undefined}
          >
            <LogOut size={14}/>{!isDesktopSidebarCollapsed && ` ${t('logout')}`}
          </button>
        </div>
      </aside>

      {/* Bottom Nav (Mobile) */}
      <nav className="md:hidden fixed bottom-1 inset-x-0 z-50 pb-[calc(env(safe-area-inset-bottom,0px)+6px)] px-2">
        <div className="grid grid-cols-5 items-end border border-slate-200 rounded-xl bg-white/95 backdrop-blur px-1.5 py-2 shadow-[0_2px_12px_rgba(15,23,42,0.12)]">
          <MobileTab active={currentView==='dashboard'} onClick={()=>setCurrentView('dashboard')} icon={<PieChart size={17}/>} label={t('dashboard')}/>
          <MobileTab active={currentView==='analytics'} onClick={()=>setCurrentView('analytics')} icon={<BarChart3 size={17}/>} label={t('analytics')} badgeCount={analyticsAlertCount}/>
          <div className="flex justify-center -mt-7">
            <button
              onClick={() => {
                triggerHaptic(10);
                setCurrentView('entry');
              }}
              aria-label={t('entry')}
              className={`relative w-12 h-12 rounded-lg flex items-center justify-center text-white shadow-sm transition-all duration-150 active:scale-95 ${currentView==='entry' ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              <PlusCircle size={24}/>
            </button>
          </div>
          <MobileTab active={currentView==='database'} onClick={()=>setCurrentView('database')} icon={<Database size={17}/>} label={t('database')}/>
          <MobileTab active={currentView==='master'} onClick={()=>setCurrentView('master')} icon={<Settings size={17}/>} label={t('master_data')}/>
        </div>
      </nav>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 md:[margin-inline-start:var(--desktop-sidebar-width)]">
        <header className="fixed top-0 inset-x-0 md:[inset-inline-start:var(--desktop-sidebar-width)] md:[inset-inline-end:0] z-30 border-b border-slate-200/90 bg-white/90 backdrop-blur px-4 phone:px-5 md:px-8 py-3.5 flex justify-between items-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
           <div className="flex items-center gap-3 min-w-0">
             <div className="md:hidden flex items-center gap-2 min-w-0">
               <img src={COMPANY_LOGO} className="h-8 w-8 rounded-lg shrink-0" alt="logo" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.12em] truncate max-w-[90px]">{t('app_name')}</span>
             </div>
             <div className="min-w-0">
               <div className="hidden md:flex items-center gap-2 mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                 <span>{lang === 'ar' ? 'لوحة العمل' : 'Workspace'}</span>
                 <span className="inline-block w-1 h-1 rounded-full bg-slate-300"></span>
                 <span>{todayLabel}</span>
               </div>
               <h1 className="font-black text-sm phone:text-base md:text-[1.2rem] text-slate-900 leading-tight break-words">{currentViewLabel}</h1>
               <p className="hidden md:block mt-0.5 text-xs font-medium text-slate-500 truncate">{headerSubtitle}</p>
             </div>
           </div>
           <div className="md:hidden flex items-center gap-1">
              <button
                onClick={() => seedDemoData({ replaceExisting: true, silent: false })}
                disabled={isSeedingDemo}
                className="btn-surface p-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm disabled:opacity-60"
                title={t('load_demo_data')}
              >
                <Database size={15}/>
              </button>
              <button onClick={()=>setLang(lang==='ar'?'en':'ar')} className="btn-surface p-1.5 text-blue-600 bg-blue-50 border border-blue-100 rounded-lg shadow-sm"><Languages size={15}/></button>
              <button
                onClick={handleLogout}
                className="btn-surface p-1.5 text-red-600 bg-red-50 border border-red-100 rounded-lg shadow-sm"
                title={t('logout')}
              >
                <LogOut size={15}/>
              </button>
           </div>
           <div className="hidden md:flex gap-2 items-center">
              <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/90 text-[12px] font-semibold text-slate-600 flex items-center gap-2">
                <Activity size={15} className="text-slate-500"/> {lang === 'ar' ? 'بيئة تشغيل مباشرة' : 'Live workspace'}
              </div>
              <button
                onClick={() => seedDemoData({ replaceExisting: true, silent: false })}
                disabled={isSeedingDemo}
                className="px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold text-sm hover:bg-emerald-100 transition-colors disabled:opacity-60"
              >
                {isSeedingDemo
                  ? t('loading')
                  : t('load_demo_data')}
              </button>
           </div>
        </header>

        <section className="flex-1 px-3 pt-[calc(var(--app-header-height-mobile)+0.75rem)] py-3 phone:px-4 phone:pt-[calc(var(--app-header-height-mobile)+1rem)] phone:py-4 md:px-6 md:pt-[calc(var(--app-header-height-desktop)+1.5rem)] md:pb-6 lg:px-8 lg:pt-[calc(var(--app-header-height-desktop)+2rem)] pb-28 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1600px]">
          {activeViewContent}
          </div>
        </section>

        <footer className="px-4 md:px-8 pb-4 md:pb-6 text-center">
          <p className="text-[11px] md:text-xs font-bold text-slate-400">
            {lang === 'ar'
              ? `الإصدار ${appVersion} - جميع الحقوق محفوظة لدى LADG © ${copyrightYear}`
              : `Version ${appVersion} - All rights reserved to LADG © ${copyrightYear}`}
          </p>
        </footer>
      </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;

// ==========================================
// 1. شاشة تسجيل الدخول المحدثة (إيميل + جوجل)
// ==========================================
function PasswordMascot({ revealed = false }) {
  return (
    <span className={`password-mascot ${revealed ? 'is-revealed' : 'is-covered'}`} aria-hidden="true">
      <span className="password-mascot-face">
        <span className="password-mascot-eye password-mascot-eye-left" />
        <span className="password-mascot-eye password-mascot-eye-right" />
        <span className="password-mascot-smile" />
      </span>
      <span className="password-mascot-hand password-mascot-hand-left" />
      <span className="password-mascot-hand password-mascot-hand-right" />
    </span>
  );
}

function LoginScreen({ onLogin, lang, setLang, t }) {
  const ar = lang === 'ar';
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passError, setPassError] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('remembered_email');
      if (saved) setEmail(saved);
    } catch {
      // localStorage not available, skip restoration
    }
  }, []);

  // Performance: useCallback لتجنب re-renders
  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    
    // Validate form locally within callback
    let valid = true;
    setEmailError('');
    setPassError('');
    if (!email) {
      setEmailError(t('login_email_required'));
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(t('login_email_invalid'));
      valid = false;
    }
    if (!pass) {
      setPassError(t('login_password_required'));
      valid = false;
    } else if (pass.length < 6) {
      setPassError(t('login_password_min')); 
      valid = false;
    }
    
    if (!valid) return;

    if (!isEmailAllowed(email)) {
      setEmailError(t('auth_not_allowed'));
      onLogin(t('auth_not_allowed'), 'error');
      return;
    }
    
    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('remembered_email', email);
      } else {
        localStorage.removeItem('remembered_email');
      }
      await signInWithEmailAndPassword(auth, email, pass);
      onLogin(t('login_welcome_back'));
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Login error:', err.code);
      }
      const errorMessages = {
        'auth/user-not-found': t('auth_user_not_found'),
        'auth/wrong-password': t('auth_wrong_password'),
        'auth/invalid-email': t('auth_invalid_email'),
        'auth/too-many-requests': t('auth_too_many_requests'),
      };
      onLogin(errorMessages[err.code] || t('login_error'), 'error');
      setPassError('');
    } finally {
      setLoading(false);
    }
  }, [email, pass, rememberMe, onLogin, t]);

  return (
    <div dir={lang==='ar'?'rtl':'ltr'} translate="no" className="notranslate mobile-readable min-h-screen overflow-hidden bg-[linear-gradient(135deg,#e9f0fa_0%,#f7f4ef_38%,#f6f8fc_100%)] relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 0.9, scale: 1 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          className="absolute -top-16 -left-10 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(95,131,180,0.24),transparent_72%)]"
        />
        <motion.div
          initial={{ opacity: 0, x: 30, y: -20 }}
          animate={{ opacity: 0.8, x: 0, y: 0 }}
          transition={{ duration: 1.2, delay: 0.1, ease: 'easeOut' }}
          className="absolute right-[-4rem] top-[10%] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(210,183,146,0.22),transparent_70%)]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:42px_42px] opacity-40" />
      </div>

      <div className="relative min-h-screen px-2.5 py-3.5 phone:px-3.5 md:px-6 lg:px-8 flex items-center justify-center">
        <div className="w-full max-w-[300px] phone:max-w-[340px] md:max-w-[400px]">
          <motion.div
            initial={{ opacity: 0, x: ar ? -24 : 24, y: 18 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: 'easeOut' }}
            className="relative w-full"
          >
            <div className="rounded-[16px] border border-white/70 bg-white/84 backdrop-blur-xl shadow-[0_10px_30px_rgba(41,56,81,0.11)] overflow-hidden">
              <div className="border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(240,245,252,0.92))] px-2.5 py-2.5 phone:px-3.5 phone:py-3 md:px-5 md:py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <motion.div
                      initial={{ rotate: -8, scale: 0.88, opacity: 0 }}
                      animate={{ rotate: 0, scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.18, ease: 'easeOut' }}
                      className="shrink-0 rounded-[12px] bg-white p-1.5 shadow-[0_8px_22px_rgba(53,77,110,0.10)] ring-1 ring-slate-200"
                    >
                      <img src={COMPANY_LOGO} className="h-9 w-9 rounded-[9px] object-cover" alt="Company logo" />
                    </motion.div>
                    <div className="min-w-0">
                      <h2 className="text-base phone:text-lg font-black tracking-tight text-slate-900">{t('app_name')}</h2>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-2 py-1.5 text-[10px] font-black text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900"
                  >
                    <Languages size={14} />
                    {t('lang')}
                  </motion.button>
                </div>

              </div>

              <div className="px-2.5 py-2.5 phone:px-3.5 md:px-5 md:py-4">
                <motion.form
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }}
                  onSubmit={handleLogin}
                  className="space-y-2.5"
                  noValidate
                >
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 mb-1.5">{t('email')}</label>
                    <input
                      type="email"
                      className={`w-full px-3 py-2 border rounded-lg bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm ${emailError ? 'border-red-400' : 'border-slate-300'}`}
                      placeholder="admin@company.com"
                      value={email}
                      onChange={e=>{ setEmail(e.target.value); setEmailError(''); }}
                      autoComplete="email"
                    />
                    {emailError && <p className="text-xs text-red-600 mt-1.5 font-semibold">{emailError}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 mb-1.5">{t('password')}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={`w-full px-3 py-2 border rounded-lg bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm ${passError ? 'border-red-400' : 'border-slate-300'} ${lang==='ar' ? 'pl-9 md:pl-10' : 'pr-9 md:pr-10'}`}
                        placeholder="••••••••"
                        value={pass}
                        onChange={e=>{ setPass(e.target.value); setPassError(''); }}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute top-1/2 -translate-y-1/2 ${lang==='ar' ? 'left-1.5 md:left-2' : 'right-1.5 md:right-2'} inline-flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700`}
                        aria-label={showPassword ? (lang === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (lang === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}
                        title={showPassword ? (lang === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (lang === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}
                        tabIndex={-1}
                      >
                        <PasswordMascot revealed={showPassword} />
                      </button>
                    </div>
                    {passError && <p className="text-xs text-red-600 mt-1.5 font-semibold">{passError}</p>}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <label htmlFor="rememberMe" className="inline-flex items-center gap-1.5 text-xs phone:text-sm text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={e=>setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                      />
                      <span>{t('remember_email')}</span>
                    </label>
                    <span className="text-[11px] font-semibold text-slate-400">{t('login_fast_secure')}</span>
                  </div>

                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.985 }}
                    type="submit"
                    disabled={loading}
                    className="w-full mt-1 py-2 bg-[linear-gradient(135deg,#4d6e9d_0%,#3f5a81_100%)] hover:brightness-105 text-white rounded-lg font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_10px_20px_rgba(63,90,129,0.20)]"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>{t('login_loading')}</span>
                      </>
                    ) : (
                      <>
                        <LogIn size={16} />
                        <span>{t('login')}</span>
                      </>
                    )}
                  </motion.button>
                </motion.form>
              </div>

            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. شاشة الموجز Dashboard
// ==========================================
function DashboardView({ purchases, enrichedPurchases, isActive = true, t, lang, settings, timeFilter, setTimeFilter, customFrom, setCustomFrom, customTo, setCustomTo, initialFilters }) {
  const ar = lang === 'ar';
  const sourcePurchases = isActive ? purchases : EMPTY_LIST;
  const [focusMode, setFocusMode] = useState(initialFilters?.focusMode || 'item');
  const [selectedItemCode, setSelectedItemCode] = useState(initialFilters?.selectedItemCode || '');
  const [selectedSupplier, setSelectedSupplier] = useState(initialFilters?.selectedSupplier || '');
  const [selectedBranch, setSelectedBranch] = useState(initialFilters?.selectedBranch || '');
  const [copySummaryState, setCopySummaryState] = useState('idle');
  const [showSecondaryInsights, setShowSecondaryInsights] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(
        DASHBOARD_FILTERS_KEY,
        JSON.stringify({
          timeFilter,
          focusMode,
          selectedItemCode,
          selectedSupplier,
          selectedBranch,
          customFrom,
          customTo,
        })
      );
    } catch {
      // Ignore storage errors silently.
    }
  }, [timeFilter, focusMode, selectedItemCode, selectedSupplier, selectedBranch, customFrom, customTo]);

  const enriched = useMemo(
    () => (isActive ? (enrichedPurchases || enrichPurchasesWithScores(sourcePurchases, settings)) : EMPTY_LIST),
    [isActive, enrichedPurchases, sourcePurchases, settings]
  );

  const sortedRecentAll = useMemo(() =>
    [...enriched].sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a)),
  [enriched]);

  const timeScopedOps = useMemo(() => {
    if (!sortedRecentAll.length) return [];
    const now = new Date();
    const nowTs = now.getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    if (timeFilter === 'realtime') {
      return sortedRecentAll;
    }

    if (timeFilter === 'weekly' || timeFilter === 'monthly') {
      const spanDays = timeFilter === 'weekly' ? 7 : 30;
      const cutoff = nowTs - (spanDays * dayMs);
      const list = sortedRecentAll.filter((p) => getRecordTimestamp(p) >= cutoff);
      return list.length ? list : sortedRecentAll.slice(0, 20);
    }

    const fromTs = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : 0;
    const toTs = customTo ? new Date(`${customTo}T23:59:59`).getTime() : nowTs;
    const list = sortedRecentAll.filter((p) => {
      const ts = getRecordTimestamp(p);
      return ts >= fromTs && ts <= toTs;
    });
    return list.length ? list : sortedRecentAll.slice(0, 20);
  }, [sortedRecentAll, timeFilter, customFrom, customTo]);

  const decisionBasisText = useMemo(() => {
    if (timeFilter === 'realtime') return ar ? 'حسب كل العمليات حتى الآن' : 'Based on all operations until now';
    if (timeFilter === 'weekly') return ar ? 'حسب آخر 7 أيام' : 'Based on last 7 days';
    if (timeFilter === 'monthly') return ar ? 'حسب آخر 30 يوم' : 'Based on last 30 days';
    return ar ? 'حسب الفترة المختارة' : 'Based on selected period';
  }, [timeFilter, ar]);

  const selectedValue = useMemo(() => {
    if (focusMode === 'all') return '';
    if (focusMode === 'supplier') return selectedSupplier || '';
    if (focusMode === 'branch') return selectedBranch || '';
    return selectedItemCode || '';
  }, [focusMode, selectedSupplier, selectedBranch, selectedItemCode]);

  const filteredOps = useMemo(() => {
    if (!timeScopedOps.length) return [];
    if (focusMode === 'all') return timeScopedOps;
    if (!selectedValue) return timeScopedOps;
    if (focusMode === 'supplier') return timeScopedOps.filter((p) => p.vendor === selectedValue);
    if (focusMode === 'branch') return timeScopedOps.filter((p) => p.branch === selectedValue);
    return timeScopedOps.filter((p) => p.code === selectedValue);
  }, [timeScopedOps, selectedValue, focusMode]);

  const focusOptions = useMemo(() => {
    if (focusMode === 'all') return [];
    if (focusMode === 'supplier') {
      return Array.from(new Set(timeScopedOps.map((p) => p.vendor).filter(Boolean))).map((x) => ({ value: x, label: x }));
    }
    if (focusMode === 'branch') {
      return Array.from(new Set(timeScopedOps.map((p) => p.branch).filter(Boolean))).map((x) => ({ value: x, label: x }));
    }
    const byCode = {};
    timeScopedOps.forEach((p) => {
      if (!p.code) return;
      if (!byCode[p.code]) byCode[p.code] = p.name || p.code;
    });
    return Object.entries(byCode).map(([code, name]) => ({ value: code, label: `${name} (#${code})` }));
  }, [focusMode, timeScopedOps]);

  const selectedFocusEntity = useMemo(() => {
    if (focusMode === 'all' || !selectedValue) return ar ? 'كل البيانات ضمن الفلتر' : 'All records in this filter';
    if (focusMode === 'supplier' || focusMode === 'branch') return selectedValue;
    return focusOptions.find((opt) => opt.value === selectedValue)?.label || selectedValue;
  }, [focusMode, ar, selectedValue, focusOptions]);

  const currentItemPrices = useMemo(() => {
    if (focusMode !== 'item' || !selectedValue) return [];
    return [...filteredOps]
      .sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b))
      .map((p) => cleanPriceValue(p.price))
      .filter((v) => v !== null);
  }, [filteredOps, focusMode, selectedValue]);

  const recentOps = useMemo(() => filteredOps.slice(0, 5), [filteredOps]);

  const itemAveragePrice = useMemo(() => {
    if (currentItemPrices.length < 2) return null;
    const filtered = filterOutliers(currentItemPrices);
    if (!filtered.length) return null;
    return filtered.reduce((s, v) => s + v, 0) / filtered.length;
  }, [currentItemPrices]);

  const itemLastPrice = useMemo(() => {
    if (!currentItemPrices.length) return null;
    return currentItemPrices[currentItemPrices.length - 1];
  }, [currentItemPrices]);

  const marketStatus = useMemo(() => {
    const prices = currentItemPrices.slice(-6);
    if (prices.length >= 3) {
      const rising = prices.every((v, i) => i === 0 || v >= prices[i - 1] * 0.99);
      const falling = prices.every((v, i) => i === 0 || v <= prices[i - 1] * 1.01);

      if (rising) return { key: 'rising', label: ar ? 'صاعد' : 'Rising', hint: ar ? 'السعر يرتفع ضمن الصنف المحدد' : 'Price is rising for the selected item' };
      if (falling) return { key: 'falling', label: ar ? 'هابط' : 'Falling', hint: ar ? 'السعر ينخفض ضمن الصنف المحدد' : 'Price is falling for the selected item' };
      return { key: 'volatile', label: ar ? 'متذبذب' : 'Volatile', hint: ar ? 'السعر غير ثابت ضمن الصنف المحدد' : 'Price is unstable for the selected item' };
    }

      const total = filteredOps.length;
      if (!total) return { key: 'stable', label: ar ? 'متوازن' : 'Balanced', hint: ar ? 'ملخص عام حسب الفلتر المحدد' : 'Overall summary based on the selected filter' };

      let riskyCount = 0;
      let goodCount = 0;
      filteredOps.forEach((p) => {
        const grade = String(p.grade || '').toUpperCase();
        if (grade === 'A' || grade === 'A+') goodCount += 1;
        else if (grade === 'C' || grade === 'D') riskyCount += 1;
      });

      const riskyShare = riskyCount / total;
      const goodShare = goodCount / total;

    if (riskyShare >= 0.3) return { key: 'rising', label: ar ? 'ضغط سعري' : 'Price pressure', hint: ar ? 'النتائج الحالية تحتاج مراجعة أكبر' : 'Current results need closer review' };
    if (goodShare >= 0.6) return { key: 'falling', label: ar ? 'أداء جيد' : 'Healthy performance', hint: ar ? 'المشتريات ضمن نطاق جيد في هذه الفترة' : 'Purchasing is performing well in this period' };
    return { key: 'volatile', label: ar ? 'نتائج مختلطة' : 'Mixed results', hint: ar ? 'النتائج تحتاج قراءة تفصيلية حسب المورد أو الصنف' : 'Results need deeper review by supplier or item' };
  }, [currentItemPrices, filteredOps, ar]);

  const supplierRecommendations = useMemo(() => {
    if (!filteredOps.length) return [];

    const grouped = {};
    filteredOps.forEach((p) => {
      const price = cleanPriceValue(p.price);
      if (!p.vendor || price === null) return;
      if (!grouped[p.vendor]) grouped[p.vendor] = [];
      grouped[p.vendor].push({
        price,
        timestamp: p.timestamp || (p.date ? new Date(p.date).getTime() : 0),
        name: p.name,
        code: p.code,
        branch: p.branch,
      });
    });

    const avgAll = itemAveragePrice || 0;

    return Object.entries(grouped)
      .map(([vendor, rows]) => {
        const prices = rows.map((r) => r.price);
        if (!prices.length) return null;

        const avg = prices.reduce((s, v) => s + v, 0) / prices.length;
        const sortedByTime = [...rows].sort((a, b) => b.timestamp - a.timestamp);
        const latestRow = sortedByTime[0] || null;
        const last = latestRow?.price || avg;
        const variance = prices.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / prices.length;
        const stability = avg > 0 ? Math.sqrt(variance) / avg : 0;
        const recentGood = avgAll > 0 ? (last <= avgAll) : false;
        const itemCodes = new Set(rows.map((row) => row.code).filter(Boolean));
        const branchNames = new Set(rows.map((row) => row.branch).filter(Boolean));

        let reason;
        let aboveAvg = false;
        if (avgAll > 0) {
          const pctDiff = (avg - avgAll) / avgAll;
          aboveAvg = pctDiff > 0.02;
          if (pctDiff <= -0.03) {
            reason = ar
              ? `أرخص من المتوسط بـ ${Math.round(Math.abs(pctDiff) * 100)}%`
              : `${Math.round(Math.abs(pctDiff) * 100)}% below average`;
          } else if (pctDiff > 0.02) {
            reason = ar
              ? `أعلى من المتوسط بـ ${Math.round(pctDiff * 100)}%`
              : `${Math.round(pctDiff * 100)}% above average`;
          } else if (stability <= 0.05) {
            reason = ar ? 'سعر مناسب' : 'Suitable price';
          } else {
            reason = ar ? 'سعر مناسب' : 'Suitable price';
          }
        } else {
          reason = stability <= 0.05
            ? (ar ? 'سعر مستقر' : 'Stable price')
            : (ar ? 'الأرخص المتاح' : 'Cheapest available');
        }

        const rankScore = avg + (stability * avg * 0.5) - (recentGood ? (avg * 0.02) : 0);
        return {
          vendor,
          avg,
          last,
          reason,
          rankScore,
          aboveAvg,
          sampleCount: rows.length,
          itemCount: itemCodes.size,
          branchCount: branchNames.size,
          latestItemName: latestRow?.name || '',
          latestItemCode: latestRow?.code || '',
          latestBranch: latestRow?.branch || '',
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.rankScore - b.rankScore)
      .slice(0, 5);
  }, [filteredOps, itemAveragePrice, ar]);

  const supplierComparisonScopeText = useMemo(() => {
    if (focusMode === 'item' && selectedValue) {
      return ar ? `المقارنة لهذا الصنف فقط: ${selectedFocusEntity}` : `Comparison for this item only: ${selectedFocusEntity}`;
    }
    if (focusMode === 'branch' && selectedValue) {
      return ar ? `المقارنة لكل أصناف الفرع: ${selectedFocusEntity}` : `Comparison for all items in branch: ${selectedFocusEntity}`;
    }
    if (focusMode === 'supplier' && selectedValue) {
      return ar ? 'هذا العرض يوضح أداء المورد المحدد عبر الأصناف داخل الفترة.' : 'This view shows the selected supplier performance across items in the period.';
    }
    return ar ? 'هذه الأرقام تمثل متوسط المورد عبر جميع الأصناف داخل الفلتر الحالي، وليست سعر صنف واحد.' : 'These numbers show the supplier average across all items in the current filter, not a single item price.';
  }, [focusMode, selectedValue, selectedFocusEntity, ar]);

  const savingsByPurchaseId = useMemo(() => {
    if (!sortedRecentAll.length) return new Map();

    const historyByCode = new Map();
    const resolvedSavings = new Map();

    [...sortedRecentAll]
      .sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b))
      .forEach((purchase) => {
        const code = String(purchase.code || '').trim();
        const price = cleanPriceValue(purchase.price);
        const qty = Number(purchase.qty) || 1;

        if (!purchase.id || !code || price === null) return;

        const history = historyByCode.get(code) || [];
        let savings = 0;

        if (history.length >= 2) {
          const baseline = history.reduce((sum, value) => sum + value, 0) / history.length;
          if (baseline > price) savings = (baseline - price) * qty;
        } else {
          const impact = Number(purchase.impact);
          if (Number.isFinite(impact) && impact < 0) savings = Math.abs(impact);
        }

        resolvedSavings.set(purchase.id, savings);
        historyByCode.set(code, [...history, price].slice(-10));
      });

    return resolvedSavings;
  }, [sortedRecentAll]);

  const periodStats = useMemo(() => {
    const totalOps = filteredOps.length;
    const totalSpend = filteredOps.reduce((sum, purchase) => sum + getSafePurchaseTotal(purchase), 0);
    const gradeCount = { good: 0, ok: 0, bad: 0 };
    filteredOps.forEach((p) => {
      const g = p.grade || '';
      if (!g) return;
      if (g === 'A' || g === 'A+') gradeCount.good++;
      else if (g === 'B') gradeCount.ok++;
      else gradeCount.bad++;
    });
    const totalSavings = filteredOps.reduce((sum, purchase) => {
      if (!purchase?.id) return sum;
      return sum + (savingsByPurchaseId.get(purchase.id) || 0);
    }, 0);

    const averageInvoiceValue = totalOps > 0 ? totalSpend / totalOps : 0;
    return { totalOps, totalSpend, gradeCount, totalSavings, averageInvoiceValue };
  }, [filteredOps, savingsByPurchaseId]);



  const actionAlerts = useMemo(() => {
    const actions = [];
    if (!filteredOps.length) return actions;

    if (marketStatus.key === 'rising') {
      actions.push(ar ? 'السعر أعلى من المعتاد' : 'Price is above normal');
    }

    if (itemAveragePrice && itemLastPrice && itemLastPrice > itemAveragePrice * 1.08) {
      actions.push(ar ? 'راجع آخر سعر شراء' : 'Review last purchase price');
    }

    const byBranch = {};
    filteredOps.forEach((p) => {
      const price = cleanPriceValue(p.price);
      if (!p.branch || price === null) return;
      if (!byBranch[p.branch]) byBranch[p.branch] = [];
      byBranch[p.branch].push(price);
    });

    if (itemAveragePrice && itemAveragePrice > 0) {
      let highBranch = null;
      Object.entries(byBranch).forEach(([branch, prices]) => {
        const avg = prices.reduce((s, v) => s + v, 0) / prices.length;
        if (avg > itemAveragePrice * 1.08) {
          if (!highBranch || avg > highBranch.avg) highBranch = { branch, avg };
        }
      });
      if (highBranch) {
        actions.push(ar ? `فرع ${highBranch.branch} يشتري بسعر مرتفع` : `${highBranch.branch} branch buys at a high price`);
      }
    }

    return actions.slice(0, 2);
  }, [filteredOps, marketStatus, itemAveragePrice, itemLastPrice, ar]);

  const bestWorst = useMemo(() => {
    const withScore = recentOps.filter((p) => Number.isFinite(Number(p.score)));
    if (!withScore.length) return { bestId: null, worstId: null };
    const best = [...withScore].sort((a, b) => Number(b.score) - Number(a.score))[0];
    const worst = [...withScore].sort((a, b) => Number(a.score) - Number(b.score))[0];
    return { bestId: best?.id || null, worstId: worst?.id || null };
  }, [recentOps]);

  const simplifyReasonText = useCallback((text) => {
    const fallback = ar ? 'مقارنة السعر مع آخر شراء' : 'Price compared with last purchase';
    if (!text) return fallback;
    const raw = String(text);

    const avgMatch = raw.match(/(\d+(?:\.\d+)?)%\s*(below|above)\s*avg/i);
    if (avgMatch) {
      const pct = Math.round(Number(avgMatch[1]));
      return avgMatch[2].toLowerCase() === 'below'
        ? (ar ? `أقل من السعر المعتاد بـ ${pct}%` : `${pct}% below usual price`)
        : (ar ? `أعلى من السعر المعتاد بـ ${pct}%` : `${pct}% above usual price`);
    }

    const cleaned = raw
      .replace(/\s*\+\s*(Falling trend|Rising trend|Supplier prices are stable)/gi, '')
      .replace(/^(Falling trend|Rising trend|Supplier prices are stable)\s*\+\s*/gi, '')
      .trim();

    return cleaned || fallback;
  }, [ar]);

  const normalizeDecisionLabel = useCallback((text) => {
    const value = String(text || '').trim().toLowerCase();
    if (value === 'buy now' || value === 'continue' || value === 'اشتر الآن') return 'مناسب';
    if (value === 'watch' || value === 'راقب') return 'راقب';
    if (value === 'do not buy' || value === 'لا تشتر') return 'مرتفع';
    return text || 'مناسب';
  }, []);

  const supplierSummary = useMemo(() => {
    if (!supplierRecommendations.length) return { best: null, worst: null };
    const best = supplierRecommendations[0];
    const worst = [...supplierRecommendations].sort((a, b) => Number(b.last) - Number(a.last))[0] || null;
    return { best, worst };
  }, [supplierRecommendations]);

  const supplierDataQuality = useMemo(() => {
    if (!supplierRecommendations.length) return { records: 0, vendors: 0 };
    const records = supplierRecommendations.reduce((sum, s) => sum + (Number(s.sampleCount) || 0), 0);
    return { records, vendors: supplierRecommendations.length };
  }, [supplierRecommendations]);

  const supplierQuickSummaryText = useMemo(() => {
    if (!supplierRecommendations.length) return '';
    const best = supplierSummary.best;
    const worst = supplierSummary.worst;
    const lines = [ar ? 'ملخص الموردين السريع' : 'Quick supplier summary'];
    lines.push(ar ? `نطاق المقارنة: ${selectedFocusEntity}` : `Comparison scope: ${selectedFocusEntity}`);

    if (best) {
      lines.push(
        ar
          ? `الأفضل: ${best.vendor} بمتوسط ${formatSmartNumber(best.avg, 1)} ${t('currency')} عبر ${best.itemCount || 0} صنف`
          : `Best: ${best.vendor} with ${formatSmartNumber(best.avg, 1)} ${t('currency')} average across ${best.itemCount || 0} items`
      );
    }
    if (worst) {
      lines.push(
        ar
          ? `الأعلى سعرا: ${worst.vendor} بمتوسط ${formatSmartNumber(worst.avg, 1)} ${t('currency')} عبر ${worst.itemCount || 0} صنف`
          : `Highest: ${worst.vendor} with ${formatSmartNumber(worst.avg, 1)} ${t('currency')} average across ${worst.itemCount || 0} items`
      );
    }
    if (best && worst && best.vendor !== worst.vendor) {
      const supplierGap = Math.max(0, Number(worst.last || 0) - Number(best.last || 0));
      lines.push(
        ar
          ? `فرق أفضل مورد: ${formatSmartNumber(supplierGap, 1)} ${t('currency')}`
          : `Best supplier gap: ${formatSmartNumber(supplierGap, 1)} ${t('currency')}`
      );
    }
    return lines.join('\n');
  }, [supplierRecommendations, supplierSummary, ar, t, selectedFocusEntity]);

  const handleCopySupplierSummary = useCallback(async () => {
    if (!supplierQuickSummaryText) return;
    try {
      await navigator.clipboard.writeText(supplierQuickSummaryText);
      setCopySummaryState('copied');
      setTimeout(() => setCopySummaryState('idle'), 1800);
    } catch {
      setCopySummaryState('error');
      setTimeout(() => setCopySummaryState('idle'), 1800);
    }
  }, [supplierQuickSummaryText]);

  const simplifySupplierReason = useCallback((reason) => {
    const text = String(reason || '').toLowerCase();
    if (text.includes('below average') || text.includes('أرخص من المتوسط')) {
      return ar ? 'أقل من السعر المعتاد' : 'Below usual price';
    }
    if (text.includes('above average') || text.includes('أعلى من المتوسط')) {
      return ar ? 'أعلى من السعر المعتاد' : 'Above usual price';
    }
    if (text.includes('stable') || text.includes('مستقر')) {
      return ar ? 'سعر مستقر' : 'Stable price';
    }
    return ar ? 'سعر ضمن النطاق المعتاد' : 'Within usual range';
  }, [ar]);

  const focusInsights = useMemo(() => {
    if (!filteredOps.length) return [];

    if (focusMode === 'all') {
      return [];
    }

    const avgMap = (rows, keyField, valueField) => {
      const map = {};
      rows.forEach((p) => {
        const key = p[keyField];
        const val = cleanPriceValue(p[valueField]);
        if (!key || val === null) return;
        if (!map[key]) map[key] = [];
        map[key].push(val);
      });
      return Object.entries(map).map(([key, vals]) => ({
        key,
        avg: vals.reduce((s, v) => s + v, 0) / vals.length,
      }));
    };

    const vendors = avgMap(filteredOps, 'vendor', 'price').sort((a, b) => a.avg - b.avg);
    const branches = avgMap(filteredOps, 'branch', 'price').sort((a, b) => a.avg - b.avg);
    const items = avgMap(filteredOps, 'name', 'price').sort((a, b) => a.avg - b.avg);

    if (focusMode === 'item') {
      const bestVendor = vendors[0] || null;
      const worstVendor = vendors[vendors.length - 1] || null;
      const sameVendor = bestVendor && worstVendor && bestVendor.key === worstVendor.key;
      const noMeaningfulVendorGap = bestVendor && worstVendor && Math.abs(bestVendor.avg - worstVendor.avg) < 0.01;
      const bestBranch = branches[0] || null;
      const worstBranch = branches[branches.length - 1] || null;
      const sameBranch = bestBranch && worstBranch && bestBranch.key === worstBranch.key;
      const noMeaningfulBranchGap = bestBranch && worstBranch && Math.abs(bestBranch.avg - worstBranch.avg) < 0.01;

      return [
        bestVendor
          ? {
            tone: 'good',
            label: (sameVendor || noMeaningfulVendorGap)
              ? (ar ? 'المورد الحالي لهذا الصنف' : 'Current Supplier for This Item')
              : (ar ? 'أفضل مورد' : 'Best Supplier'),
            text: `${bestVendor.key} (${formatSmartNumber(bestVendor.avg, 1)} ${t('currency')})`
          }
          : null,
        worstVendor && !(sameVendor || noMeaningfulVendorGap)
          ? { tone: 'bad', label: ar ? 'أعلى مورد' : 'Highest Supplier', text: `${worstVendor.key} (${formatSmartNumber(worstVendor.avg, 1)} ${t('currency')})` }
          : null,
        bestBranch
          ? {
            tone: 'good',
            label: (sameBranch || noMeaningfulBranchGap)
              ? (ar ? 'الفرع الحالي لهذا الصنف' : 'Current Branch for This Item')
              : (ar ? 'أفضل فرع' : 'Best Branch'),
            text: `${bestBranch.key} (${formatSmartNumber(bestBranch.avg, 1)} ${t('currency')})`
          }
          : null,
        worstBranch && !(sameBranch || noMeaningfulBranchGap)
          ? { tone: 'bad', label: ar ? 'أسوأ فرع' : 'Worst Branch', text: `${worstBranch.key} (${formatSmartNumber(worstBranch.avg, 1)} ${t('currency')})` }
          : null,
      ].filter(Boolean).slice(0, 4);
    }

    if (focusMode === 'supplier') {
      const uniqueItems = Array.from(new Set(filteredOps.map((p) => p.code || p.name).filter(Boolean)));
      const prices = filteredOps
        .map((p) => cleanPriceValue(p.price))
        .filter((v) => v !== null)
        .sort((a, b) => a - b);
      const minPrice = prices.length ? prices[0] : null;
      const maxPrice = prices.length ? prices[prices.length - 1] : null;
      const singleItem = filteredOps.find((p) => p.name || p.code) || null;
      const singleItemLabel = singleItem
        ? (singleItem.name || (ar ? 'الصنف الحالي' : 'Current item'))
        : (ar ? 'الصنف الحالي' : 'Current item');
      const bestBranch = branches[0] || null;
      const worstBranch = branches[branches.length - 1] || null;
      const sameBranch = bestBranch && worstBranch && bestBranch.key === worstBranch.key;
      const noMeaningfulBranchGap = bestBranch && worstBranch && Math.abs(bestBranch.avg - worstBranch.avg) < 0.01;

      return [
        uniqueItems.length > 1
          ? (items[0]
            ? { tone: 'good', label: ar ? 'أرخص صنف' : 'Cheapest Item', text: `${items[0].key} (${formatSmartNumber(items[0].avg, 1)} ${t('currency')})` }
            : null)
          : (minPrice !== null
            ? { tone: 'good', label: ar ? 'أقل سعر تم الشراء به' : 'Lowest Purchased Price', text: `${singleItemLabel}: ${formatSmartNumber(minPrice, 1)} ${t('currency')}` }
            : null),
        uniqueItems.length > 1
          ? (items[items.length - 1]
            ? { tone: 'bad', label: ar ? 'أغلى صنف' : 'Most Expensive Item', text: `${items[items.length - 1].key} (${formatSmartNumber(items[items.length - 1].avg, 1)} ${t('currency')})` }
            : null)
          : (maxPrice !== null
            ? { tone: 'bad', label: ar ? 'أعلى سعر تم الشراء به' : 'Highest Purchased Price', text: `${singleItemLabel}: ${formatSmartNumber(maxPrice, 1)} ${t('currency')}` }
            : null),
        bestBranch
          ? {
            tone: 'good',
            label: (sameBranch || noMeaningfulBranchGap)
              ? (ar ? 'الفرع الحالي لهذا المورد' : 'Current Branch for This Supplier')
              : (ar ? 'أفضل فرع اشترى من هذا المورد' : 'Best Branch for This Supplier'),
            text: `${bestBranch.key} (${formatSmartNumber(bestBranch.avg, 1)} ${t('currency')})`
          }
          : null,
        worstBranch && !(sameBranch || noMeaningfulBranchGap)
          ? { tone: 'bad', label: ar ? 'أسوأ فرع اشترى من هذا المورد' : 'Worst Branch for This Supplier', text: `${worstBranch.key} (${formatSmartNumber(worstBranch.avg, 1)} ${t('currency')})` }
          : null,
      ].filter(Boolean).slice(0, 4);
    }

    const uniqueItems = Array.from(new Set(filteredOps.map((p) => p.code || p.name).filter(Boolean)));
    const prices = filteredOps
      .map((p) => cleanPriceValue(p.price))
      .filter((v) => v !== null)
      .sort((a, b) => a - b);
    const minPrice = prices.length ? prices[0] : null;
    const maxPrice = prices.length ? prices[prices.length - 1] : null;
    const singleItem = filteredOps.find((p) => p.name || p.code) || null;
    const singleItemLabel = singleItem
      ? (singleItem.name || (ar ? 'الصنف الحالي' : 'Current item'))
      : (ar ? 'الصنف الحالي' : 'Current item');
    const bestVendor = vendors[0] || null;
    const worstVendor = vendors[vendors.length - 1] || null;
    const sameVendor = bestVendor && worstVendor && bestVendor.key === worstVendor.key;
    const noMeaningfulVendorGap = bestVendor && worstVendor && Math.abs(bestVendor.avg - worstVendor.avg) < 0.01;

    return [
      uniqueItems.length > 1
        ? (items[items.length - 1]
          ? { tone: 'bad', label: ar ? 'أغلى صنف يشتريه الفرع' : 'Most Expensive Item in Branch', text: `${items[items.length - 1].key} (${formatSmartNumber(items[items.length - 1].avg, 1)} ${t('currency')})` }
          : null)
        : (maxPrice !== null
          ? { tone: 'bad', label: ar ? 'أعلى سعر اشترى به الفرع' : 'Highest Purchased Price in Branch', text: `${singleItemLabel}: ${formatSmartNumber(maxPrice, 1)} ${t('currency')}` }
          : null),
      uniqueItems.length > 1
        ? (items[0]
          ? { tone: 'good', label: ar ? 'أرخص صنف يشتريه الفرع' : 'Cheapest Item in Branch', text: `${items[0].key} (${formatSmartNumber(items[0].avg, 1)} ${t('currency')})` }
          : null)
        : (minPrice !== null
          ? { tone: 'good', label: ar ? 'أقل سعر اشترى به الفرع' : 'Lowest Purchased Price in Branch', text: `${singleItemLabel}: ${formatSmartNumber(minPrice, 1)} ${t('currency')}` }
          : null),
      worstVendor && !(sameVendor || noMeaningfulVendorGap)
        ? { tone: 'bad', label: ar ? 'أسوأ مورد لهذا الفرع' : 'Worst Supplier for This Branch', text: `${worstVendor.key} (${formatSmartNumber(worstVendor.avg, 1)} ${t('currency')})` }
        : null,
      bestVendor
        ? {
          tone: 'good',
          label: (sameVendor || noMeaningfulVendorGap)
            ? (ar ? 'المورد الحالي لهذا الفرع' : 'Current Supplier for This Branch')
            : (ar ? 'أفضل مورد لهذا الفرع' : 'Best Supplier for This Branch'),
          text: `${bestVendor.key} (${formatSmartNumber(bestVendor.avg, 1)} ${t('currency')})`
        }
        : null,
    ].filter(Boolean).slice(0, 4);
  }, [filteredOps, focusMode, ar, t]);

  const periodOptions = [
    { key: 'realtime', ar: 'حتى الآن', en: 'Until now' },
    { key: 'weekly', ar: 'أسبوعي', en: 'Weekly' },
    { key: 'monthly', ar: 'شهري', en: 'Monthly' },
    { key: 'custom', ar: 'مخصص', en: 'Custom' },
  ];
  const focusModeOptions = [
    { key: 'item', ar: 'حسب الصنف', en: 'By item' },
    { key: 'supplier', ar: 'حسب المورد', en: 'By supplier' },
    { key: 'branch', ar: 'حسب الفرع', en: 'By branch' },
    { key: 'all', ar: 'الكل', en: 'All' },
  ];
  const activePeriodLabel = (ar ? periodOptions.find((opt) => opt.key === timeFilter)?.ar : periodOptions.find((opt) => opt.key === timeFilter)?.en) || timeFilter;
  const activeFocusLabel = (ar ? focusModeOptions.find((opt) => opt.key === focusMode)?.ar : focusModeOptions.find((opt) => opt.key === focusMode)?.en) || focusMode;
  const dashboardKpis = [
    {
      key: 'spend',
      title: ar ? 'إجمالي المشتريات' : 'Total Purchases',
      val: formatSmartNumber(periodStats.totalSpend, 0),
      unit: 'SAR',
      icon: <ShoppingCart size={18}/>,
      color: 'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(77,110,157,0.08),transparent_55%)] before:pointer-events-none',
    },
    {
      key: 'ops',
      title: ar ? 'عدد الفواتير' : 'Invoices',
      val: formatSmartNumber(periodStats.totalOps, 0),
      unit: ar ? 'فاتورة' : 'Invoices',
      icon: <FileText size={18}/>,
      color: 'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(100,116,139,0.09),transparent_55%)] before:pointer-events-none',
    },
    {
      key: 'savings',
      title: ar ? 'إجمالي التوفير' : 'Total Savings',
      val: formatSmartNumber(periodStats.totalSavings, 0),
      unit: 'SAR',
      icon: <CheckCircle size={18}/>,
      color: 'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(47,107,86,0.10),transparent_55%)] before:pointer-events-none',
    },
    {
      key: 'avgInvoice',
      title: ar ? 'متوسط الفاتورة' : 'Average Invoice',
      val: formatSmartNumber(periodStats.averageInvoiceValue, 0),
      unit: 'SAR',
      icon: <Wallet size={18}/>,
      color: 'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(75,95,133,0.09),transparent_55%)] before:pointer-events-none',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">

      <div className="elevated-card relative overflow-hidden p-4 phone:p-5 md:p-6 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,248,252,0.98))]">
        <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_center,rgba(77,110,157,0.09),transparent_68%)] pointer-events-none"></div>
        <div className="relative z-10 flex flex-col laptop:flex-row laptop:items-start laptop:justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="erp-subtle-chip"><Activity size={13} /> {ar ? 'لوحة تنفيذية' : 'Executive view'}</span>
              <span className="erp-subtle-chip"><CalendarDays size={13} /> {activePeriodLabel}</span>
              <span className="erp-subtle-chip"><Filter size={13} /> {activeFocusLabel}</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-fluid-xl font-black text-slate-900">{ar ? 'ملخص المشتريات والقرار السعري' : 'Purchasing & price decision overview'}</h2>
              <p className="mt-1 text-fluid-sm text-slate-500 max-w-3xl">{decisionBasisText}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
              <span className="erp-subtle-chip">{ar ? 'نطاق العرض' : 'Scope'}: {selectedFocusEntity}</span>
              <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-[11px] font-bold ${marketStatus.key === 'falling' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : marketStatus.key === 'rising' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                {marketStatus.key === 'falling' ? <TrendingDown size={12}/> : marketStatus.key === 'rising' ? <TrendingUp size={12}/> : <Activity size={12}/>} {marketStatus.label}
              </span>
            </div>
          </div>
          <div className="laptop:max-w-[340px] space-y-2">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{ar ? 'ملاحظات سريعة' : 'Quick notes'}</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{marketStatus.hint}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">{supplierComparisonScopeText}</p>
              {actionAlerts.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {actionAlerts.map((note, index) => (
                    <div key={`${note}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[12px] font-medium text-slate-600">
                      {note}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs font-medium text-slate-500">{ar ? 'لا توجد تنبيهات تشغيلية عاجلة الآن.' : 'No urgent operational alerts right now.'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {!timeScopedOps.length && (
        <div className="elevated-card p-6 text-center bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))]">
          <p className="text-sm font-semibold text-slate-700">{ar ? 'لا توجد بيانات كافية بعد. ابدأ بإضافة أول فاتورة.' : 'No data yet. Add your first purchase to unlock insights.'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 phone:grid-cols-2 laptop:grid-cols-4 gap-3">
        {dashboardKpis.map((card) => (
          <StatCard key={card.key} title={card.title} val={card.val} unit={card.unit} icon={card.icon} color={card.color} />
        ))}
      </div>

      <div className="grid grid-cols-1 laptop:grid-cols-[1.6fr_1fr] gap-3">
        <div className="erp-toolbar p-4 md:p-5">
          <div className="grid grid-cols-1 laptop:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 mb-2">{ar ? 'الفترة' : 'Period'}</p>
              <div className="grid grid-cols-2 phone:grid-cols-4 gap-2">
                {periodOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setTimeFilter(opt.key)}
                    className={`min-w-0 px-2 py-1.5 phone:px-3 phone:py-2 rounded-xl text-[10px] phone:text-xs leading-tight font-semibold border transition-all ${timeFilter === opt.key ? 'bg-[linear-gradient(135deg,#5f83b4_0%,#4d6e9d_100%)] text-white border-[#4d6e9d] shadow-[0_10px_20px_rgba(77,110,157,0.18)]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    {ar ? opt.ar : opt.en}
                  </button>
                ))}
              </div>
              {timeFilter === 'custom' && (
                <div className="mt-3 grid grid-cols-1 phone:grid-cols-2 gap-2 max-w-[360px]">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-500">{ar ? 'من' : 'From'}</span>
                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="input-field !py-2" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-500">{ar ? 'إلى' : 'To'}</span>
                    <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="input-field !py-2" />
                  </div>
                </div>
              )}
              <p className="text-[11px] font-medium text-slate-500 mt-3">{decisionBasisText}</p>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 mb-2">{ar ? 'منظور التحليل' : 'Analysis focus'}</p>
              <div className="grid grid-cols-2 phone:grid-cols-4 gap-2">
                {focusModeOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setFocusMode(opt.key);
                      setSelectedItemCode('');
                      setSelectedSupplier('');
                      setSelectedBranch('');
                    }}
                    className={`min-w-0 px-2 py-1.5 phone:px-3 phone:py-2 rounded-xl text-[10px] phone:text-xs leading-tight font-semibold border transition-all ${focusMode === opt.key ? 'bg-slate-900 text-white border-slate-900 shadow-[0_10px_20px_rgba(15,23,42,0.12)]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    {ar ? opt.ar : opt.en}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                {focusMode === 'all' ? (
                  <div className="input-field !py-2 text-xs text-slate-500 bg-slate-50 border-slate-200">
                    {ar ? 'يتم عرض كل البيانات بدون تقييد' : 'Showing all data without a single focus'}
                  </div>
                ) : (
                  <select
                    value={selectedValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (focusMode === 'supplier') setSelectedSupplier(value);
                      else if (focusMode === 'branch') setSelectedBranch(value);
                      else setSelectedItemCode(value);
                    }}
                    className="input-field !py-2 text-xs"
                  >
                    <option value="">{focusMode === 'supplier' ? (ar ? 'كل الموردين' : 'All suppliers') : focusMode === 'branch' ? (ar ? 'كل الفروع' : 'All branches') : (ar ? 'كل الأصناف' : 'All items')}</option>
                    {focusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="erp-toolbar p-4 md:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{ar ? 'مؤشرات الحالة' : 'Status metrics'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="status-good text-xs font-black px-2.5 py-1 rounded-full inline-flex items-center gap-1"><CheckCircle size={12} />{periodStats.gradeCount.good} {ar ? 'مناسب' : 'Suitable'}</span>
            <span className="status-watch text-xs font-black px-2.5 py-1 rounded-full inline-flex items-center gap-1"><AlertTriangle size={12} />{periodStats.gradeCount.ok} {ar ? 'راقب' : 'Monitor'}</span>
            <span className="status-high text-xs font-black px-2.5 py-1 rounded-full inline-flex items-center gap-1"><AlertCircle size={12} />{periodStats.gradeCount.bad} {ar ? 'مرتفع' : 'High'}</span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{ar ? 'المورد المرجعي' : 'Reference supplier'}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{supplierSummary.best?.vendor || (ar ? 'لا يوجد بعد' : 'Not available yet')}</p>
                {supplierSummary.best && (
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    {ar
                      ? `متوسط ${formatSmartNumber(supplierSummary.best.avg, 1)} ${t('currency')} عبر ${supplierSummary.best.itemCount || 0} صنف`
                      : `${formatSmartNumber(supplierSummary.best.avg, 1)} ${t('currency')} average across ${supplierSummary.best.itemCount || 0} items`}
                  </p>
                )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{ar ? 'جودة التحليل' : 'Analysis quality'}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{ar ? `${supplierDataQuality.records} عملية عبر ${supplierDataQuality.vendors} مورد` : `${supplierDataQuality.records} records across ${supplierDataQuality.vendors} suppliers`}</p>
            </div>
          </div>
        </div>
      </div>

      {focusInsights.length > 0 && (
        <>
          <div className="hidden phone:grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-4 gap-2">
            {focusInsights.map((x, idx) => (
              <div key={`${x.label}-${idx}`} className={`rounded-xl border px-3 py-2 ${x.tone === 'good' ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
                <p className={`text-[10px] font-black ${x.tone === 'good' ? 'text-emerald-700' : 'text-red-700'}`}>{x.label}</p>
                <p className="text-sm font-black text-slate-800 break-words">{x.text}</p>
              </div>
            ))}
          </div>
          <div className="phone:hidden elevated-card p-3">
            <button
              type="button"
              onClick={() => setShowSecondaryInsights((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-semibold text-slate-700"
            >
              <span>{ar ? 'تفاصيل إضافية' : 'More Insights'}</span>
              <ChevronDown size={16} className={`transition-transform ${showSecondaryInsights ? 'rotate-180' : ''}`} />
            </button>
            {showSecondaryInsights && (
              <div className="mt-2 space-y-2">
                {focusInsights.map((x, idx) => (
                  <div key={`${x.label}-${idx}`} className={`rounded-lg border px-3 py-2 ${x.tone === 'good' ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
                    <p className={`text-[10px] font-black ${x.tone === 'good' ? 'text-emerald-700' : 'text-red-700'}`}>{x.label}</p>
                    <p className="text-sm font-semibold text-slate-800 break-words">{x.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <div className="elevated-card p-4 phone:p-5 md:p-6 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.98))]">
        <div className="flex flex-col laptop:flex-row laptop:items-start laptop:justify-between gap-3 mb-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[linear-gradient(135deg,#e8f0fb_0%,#dae6f5_100%)] text-[#4d6e9d] grid place-items-center ring-1 ring-slate-200">
                <Award size={17} />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-slate-900">{ar ? 'ترشيحات الموردين' : 'Supplier recommendations'}</h3>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">{supplierComparisonScopeText}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {supplierSummary.best && supplierSummary.worst && supplierSummary.best.vendor !== supplierSummary.worst.vendor && (
              <span className="erp-subtle-chip">
                <Award size={12} />
                {ar
                  ? `فرق أفضل مورد: ${formatSmartNumber(Math.max(0, Number(supplierSummary.worst.last || 0) - Number(supplierSummary.best.last || 0)), 1)} ${t('currency')}`
                  : `Best supplier gap: ${formatSmartNumber(Math.max(0, Number(supplierSummary.worst.last || 0) - Number(supplierSummary.best.last || 0)), 1)} ${t('currency')}`}
              </span>
            )}
            <button
              type="button"
              onClick={handleCopySupplierSummary}
              disabled={!supplierQuickSummaryText}
              className="btn-surface inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 disabled:opacity-40"
              title={ar ? 'نسخ ملخص الموردين' : 'Copy supplier summary'}
            >
              <Copy size={13} />
              {ar ? 'نسخ الملخص' : 'Copy summary'}
            </button>
          </div>
        </div>
        {copySummaryState !== 'idle' && (
          <p className={`text-[10px] font-black mb-2 ${copySummaryState === 'copied' ? 'text-emerald-700' : 'text-red-700'}`}>
            {copySummaryState === 'copied'
              ? (ar ? 'تم نسخ الملخص بنجاح' : 'Summary copied successfully')
              : (ar ? 'تعذر نسخ الملخص' : 'Failed to copy summary')}
          </p>
        )}
        <div className="mt-3 grid grid-cols-1 laptop:grid-cols-[1.2fr_2fr] gap-3">
          <div className="erp-toolbar p-4 space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{ar ? 'ملخص القرار' : 'Decision summary'}</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">{ar ? 'الترتيب من الأرخص إلى الأعلى حسب متوسط الفترة الحالية داخل نطاق المقارنة الموضح.' : 'Suppliers are ranked from cheapest to highest based on the current period average inside the displayed comparison scope.'}</p>
            </div>
            <div className="space-y-2 text-[11px] font-semibold text-slate-600">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                {ar
                  ? `جودة التحليل: ${supplierDataQuality.records} عملية عبر ${supplierDataQuality.vendors} مورد`
                  : `Data quality: ${supplierDataQuality.records} records across ${supplierDataQuality.vendors} suppliers`}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                {supplierComparisonScopeText}
              </div>
              {supplierSummary.best && supplierSummary.worst && (
                <div className="flex flex-col gap-2">
                  <span className="status-good px-2.5 py-2 rounded-xl border inline-flex items-center gap-1">
                    <CheckCircle size={12} />
                    {ar ? `الأفضل حسب المتوسط: ${supplierSummary.best.vendor} (${supplierSummary.best.itemCount || 0} صنف)` : `Best by average: ${supplierSummary.best.vendor} (${supplierSummary.best.itemCount || 0} items)`}
                  </span>
                  <span className="status-high px-2.5 py-2 rounded-xl border inline-flex items-center gap-1">
                    <AlertCircle size={12} />
                    {ar ? `الأعلى سعراً: ${supplierSummary.worst.vendor} (${supplierSummary.worst.itemCount || 0} صنف)` : `Highest price: ${supplierSummary.worst.vendor} (${supplierSummary.worst.itemCount || 0} items)`}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-3 gap-3">
            {supplierRecommendations.slice(0, 5).map((s, idx) => (
              <div key={s.vendor} className={`rounded-[20px] border px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] ${
                idx === 0
                  ? 'border-emerald-300 bg-[linear-gradient(180deg,rgba(240,253,244,0.98),rgba(229,248,238,0.98))]'
                  : !s.aboveAvg
                    ? 'border-emerald-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,250,245,0.98))]'
                    : 'border-slate-200 bg-white'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {idx === 0 && (
                      <span className="status-good inline-flex items-center gap-1 mb-2 px-2 py-0.5 rounded-full text-[10px] font-black">
                        {ar ? 'الترشيح الأول' : 'Top pick'}
                      </span>
                    )}
                    <p className="font-black text-slate-900 break-words leading-snug">{s.vendor}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">
                      {ar ? `الاعتماد على ${s.sampleCount || 0} عملية عبر ${s.itemCount || 0} صنف` : `Based on ${s.sampleCount || 0} records across ${s.itemCount || 0} items`}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${idx === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {idx === 0 ? <Award size={16} /> : <Store size={16} />}
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{ar ? 'آخر سعر شراء' : 'Last purchase price'}</p>
                    <p className="mt-1 text-base font-black text-slate-900">{formatSmartNumber(s.last, 1)} <span className="text-[11px] font-bold text-slate-500">{t('currency')}</span></p>
                    {(s.latestItemName || s.latestBranch) && (
                      <p className="mt-1 text-[11px] font-medium text-slate-500 break-words">
                        {ar
                          ? `${s.latestItemName ? cleanItemLabel(s.latestItemName, s.latestItemCode) : ''}${s.latestBranch ? ` • فرع ${s.latestBranch}` : ''}`
                          : `${s.latestItemName ? cleanItemLabel(s.latestItemName, s.latestItemCode) : ''}${s.latestBranch ? ` • ${s.latestBranch} branch` : ''}`}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{ar ? 'متوسط الفترة' : 'Period average'}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{formatSmartNumber(s.avg, 1)} {t('currency')}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{ar ? 'نطاق المقارنة' : 'Comparison scope'}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800 break-words">{supplierComparisonScopeText}</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      {ar
                        ? `يغطي ${s.branchCount || 0} فرع و ${s.itemCount || 0} صنف`
                        : `Covers ${s.branchCount || 0} branches and ${s.itemCount || 0} items`}
                    </p>
                  </div>
                </div>
                <span className={`mt-3 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-black break-words max-w-full ${!s.aboveAvg ? 'status-good' : 'status-high'}`}>
                  {!s.aboveAvg
                    ? (<><CheckCircle size={12} />{ar ? 'ضمن النطاق الجيد' : 'Within a good range'}</>)
                    : (<><AlertCircle size={12} />{ar ? 'أعلى من متوسط الفترة' : 'Above period average'}</>)}
                </span>
                <p className={`text-xs font-bold mt-3 break-words ${s.aboveAvg ? 'text-amber-700' : 'text-emerald-700'}`}>{simplifySupplierReason(s.reason)}</p>
              </div>
            ))}
            {supplierRecommendations.length === 0 && (
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-xs font-bold text-slate-500">
                {ar ? 'تظهر التوصيات بعد توفر بيانات كافية داخل الفلتر الحالي' : 'Recommendations appear once enough data exists in the current filter'}
              </div>
            )}
          </div>
        </div>
      </div>



      <div className="elevated-card overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-slate-100 flex items-start gap-2">
          <Activity size={17} className="text-slate-600 mt-0.5 shrink-0"/>
          <div>
            <h3 className="font-black text-slate-800">{ar ? 'آخر العمليات' : 'Latest Operations'}</h3>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
              {ar ? 'مقارنة السعر مع آخر شراء' : 'Price compared with last purchase'}
            </p>
          </div>
        </div>

        <DataTable
          data={recentOps.map((p) => {
            const rawDecision = ar
              ? (p.decisionAr || p.decisionEn || getDecisionLabelByGrade(p.grade))
              : (p.decisionEn || p.decisionAr || getDecisionLabelByGrade(p.grade));
            const dec = normalizeDecisionLabel(rawDecision);
            const sourceReason = ar
              ? (p.reasonAr || p.reasonEn)
              : (p.reasonEn || p.reasonAr);
            const reason = simplifyReasonText(sourceReason);
            const isBest = p.id === bestWorst.bestId;
            const isWorst = p.id === bestWorst.worstId;
            return { ...p, dec, reason, isBest, isWorst };
          })}
          columns={[
            { key: 'vendor', label: t('vendor'), sortable: true },
            { key: 'name', label: t('item'), sortable: true },
            {
              key: 'price',
              label: t('price'),
              sortable: true,
              render: (val) => (
                <span className="font-black text-blue-700">
                  {formatSmartNumber(val, 2)} {t('currency')}
                </span>
              ),
            },
            {
              key: 'grade',
              label: t('grade'),
              sortable: true,
              render: (val, row) => (
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-black px-2 py-1 rounded-full border ${
                      val === 'A'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : val === 'B'
                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-red-100 text-red-700 border-red-200'
                    }`}
                  >
                    {row.dec}
                  </span>
                  {row.isBest && (
                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      {ar ? 'أفضل' : 'Best'}
                    </span>
                  )}
                  {row.isWorst && (
                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-red-100 text-red-700">
                      {ar ? 'أضعف' : 'Worst'}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: 'reason',
              label: t('decision'),
              sortable: false,
              render: (val) => <span className="font-bold text-slate-600">{val}</span>,
            },
          ]}
          highlightRows={{
            [bestWorst.bestId]: { className: 'bg-emerald-50/60 border-emerald-100' },
            [bestWorst.worstId]: { className: 'bg-red-50/60 border-red-100' },
          }}
          pageSize={10}
          isRTL={ar}
          emptyMessage={ar ? 'لا توجد عمليات حديثة' : 'No recent operations'}
          renderRow={(row) => (
            <div className={`px-4 py-3 ${row.isBest ? 'bg-emerald-50/60' : row.isWorst ? 'bg-red-50/60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-slate-900 break-words leading-snug">{row.name || '—'}</p>
                  <p className="text-xs font-bold text-slate-500 break-words leading-snug">{row.vendor || '—'}</p>
                </div>
                <p className="font-black text-blue-700 text-sm">{formatSmartNumber(row.price, 2)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-black px-2 py-1 rounded-full border ${
                      row.grade === 'A'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : row.grade === 'B'
                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-red-100 text-red-700 border-red-200'
                    }`}
                  >
                    {row.dec}
                  </span>
                  {row.isBest && (
                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      {ar ? 'أفضل' : 'Best'}
                    </span>
                  )}
                  {row.isWorst && (
                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-red-100 text-red-700">
                      {ar ? 'أضعف' : 'Worst'}
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-500 break-words text-right">{row.reason}</p>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}

// ==========================================
// 3. شاشة تسجيل الفاتورة
// ==========================================
function EntryFormView({ purchases, items, branches, vendors, showMsg, t, lang, settings }) {
  const [formData, setFormData] = useState({ 
    date: new Date().toISOString().split('T')[0], code: '', price: '', qty: '1', vendor: '', branch: ''
  });
  const [loading, setLoading] = useState(false);
  const [managerApproved, setManagerApproved] = useState(false);
  const [showAdvancedPricing, setShowAdvancedPricing] = useState(false);
  const saveGuardRef = useRef(null);
  const lastInputSoundAtRef = useRef(0);
  const managerApprovalThreshold = Number(settings?.managerApprovalThreshold) > 0
    ? Number(settings.managerApprovalThreshold)
    : 5000;
  const selectedItem = useMemo(() => items.find(i => i.code === formData.code), [items, formData.code]);

  const playInputSound = useCallback(() => {
    const now = Date.now();
    if (now - lastInputSoundAtRef.current < 70) return;
    lastInputSoundAtRef.current = now;
    playUiSound('input');
  }, []);

  const setFormField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (managerApproved) setManagerApproved(false);
    playInputSound();
  }, [playInputSound, managerApproved]);

  const itemPurchases = useMemo(() => {
    if (!formData.code) return EMPTY_LIST;
    return purchases
      .filter(p => p.code === formData.code)
      .map(p => ({ ...p, dateValue: getRecordTimestamp(p) }))
      .sort((a, b) => a.dateValue - b.dateValue);
  }, [purchases, formData.code]);

  const currentPrice = Number(formData.price || 0);
  const qtyValue = Number(formData.qty || 0);
  const liveTotal = Number.isFinite(currentPrice) && Number.isFinite(qtyValue) ? (currentPrice * qtyValue) : 0;
  const inlineValidation = useMemo(() => {
    const qtyRaw = String(formData.qty || '').trim();
    const priceRaw = String(formData.price || '').trim();
    const qtyParsed = Number(qtyRaw);
    const priceParsed = Number(priceRaw);

    const qtyError = qtyRaw && (!Number.isFinite(qtyParsed) || qtyParsed <= 0)
      ? (lang === 'ar' ? 'الكمية يجب أن تكون رقما موجبا' : 'Quantity must be a positive number')
      : '';
    const priceError = priceRaw && (!Number.isFinite(priceParsed) || priceParsed <= 0)
      ? (lang === 'ar' ? 'السعر يجب أن يكون رقما موجبا' : 'Price must be a positive number')
      : '';

    return { qtyError, priceError };
  }, [formData.qty, formData.price, lang]);

  // ✅ احسب التحليل أولاً للحصول على avgPrice المتسق
  const liveAnalysis = useMemo(() => {
    if (!formData.price || !formData.code || itemPurchases.length === 0) return null;
    return calculateDecisionScore(currentPrice, itemPurchases, { ...settings, currentQuantity: qtyValue });
  }, [currentPrice, itemPurchases, formData.code, formData.price, settings, qtyValue]);

  // ✅ استخدم avgPrice من liveAnalysis (نفس الحسابات)
  const avgPrice = liveAnalysis?.avgPrice || null;
  const referencePrice = avgPrice && avgPrice > 0 ? avgPrice : null;
  const referenceChange = referencePrice && Number.isFinite(currentPrice) ? (currentPrice - referencePrice) : null;
  const referencePercent = referencePrice && referencePrice > 0 ? (referenceChange / referencePrice) : null;
  const estimatedExtraCost = referenceChange && referenceChange > 0 && Number.isFinite(qtyValue)
    ? (referenceChange * qtyValue)
    : 0;
  const requiresManagerApproval = estimatedExtraCost >= managerApprovalThreshold;

  const liveRootCause = useMemo(() => {
    if (!formData.price || !formData.code || itemPurchases.length === 0 || !formData.branch || !formData.vendor) return null;
    return calculateRootCause(
      {
        code: formData.code,
        branch: formData.branch,
        vendor: formData.vendor,
        name: selectedItem?.name,
        price: currentPrice,
      },
      itemPurchases,
      settings
    );
  }, [formData.price, formData.code, formData.branch, formData.vendor, itemPurchases, settings, selectedItem?.name, currentPrice]);
  const withTimeout = (promise, ms, timeoutMessage) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), ms))
    ]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!formData.code || !formData.price || !formData.vendor || !formData.branch) {
      const missing = [];
      if (!formData.code) missing.push(lang === 'ar' ? 'المادة' : 'Item');
      if (!formData.price) missing.push(lang === 'ar' ? 'السعر' : 'Price');
      if (!formData.vendor) missing.push(lang === 'ar' ? 'المورد' : 'Vendor');
      if (!formData.branch) missing.push(lang === 'ar' ? 'الفرع' : 'Branch');
      showMsg(
        lang === 'ar' ? 'الرجاء ملء جميع الحقول' : 'Please fill all fields',
        'warning',
        lang === 'ar' ? `مفقود: ${missing.join('، ')}` : `Missing: ${missing.join(', ')}`
      );
      return;
    }

    const curP = Number(formData.price);
    const qtyVal = Number(formData.qty);
    if (!Number.isFinite(curP) || curP <= 0 || !Number.isFinite(qtyVal) || qtyVal <= 0) {
      const issues = [];
      if (!Number.isFinite(curP) || curP <= 0) issues.push(lang === 'ar' ? 'السعر: يجب أن يكون موجب' : 'Price: must be positive');
      if (!Number.isFinite(qtyVal) || qtyVal <= 0) issues.push(lang === 'ar' ? 'الكمية: يجب أن تكون موجبة' : 'Quantity: must be positive');
      showMsg(
        lang === 'ar' ? 'بيانات غير صحيحة' : 'Invalid data',
        'error',
        issues.join('\n')
      );
      return;
    }

    setLoading(true);
    if (saveGuardRef.current) clearTimeout(saveGuardRef.current);
    saveGuardRef.current = setTimeout(() => {
      setLoading(false);
      showMsg(
        lang === 'ar' ? 'العملية استغرقت وقتاً طويلاً، تحقق من الاتصال ثم أعد المحاولة' : 'The operation took too long, please check connection and retry',
        'error'
      );
    }, 130000);

    try {
      const selectedItem = items.find(i => i.code === formData.code);
      const analysis = calculateDecisionScore(curP, itemPurchases, { ...settings, currentQuantity: qtyVal });
      const fallbackGrade = analysis?.grade || 'C';
      const fallbackDecision = getDecisionLabelByGrade(fallbackGrade);
      const referenceAvg = analysis?.avgPrice || 0;
      const diff = referenceAvg > 0 ? (curP - referenceAvg) : 0;
      const approvalImpact = referenceAvg > 0 && diff > 0 ? diff * qtyVal : 0;

      if (approvalImpact >= managerApprovalThreshold && !managerApproved) {
        showMsg(
          lang === 'ar' ? 'مطلوب اعتماد مدير' : 'Manager approval required',
          'warning',
          lang === 'ar'
            ? `الأثر المالي الزائد ${formatSmartNumber(approvalImpact, 0)} SAR ويتجاوز حد ${formatSmartNumber(managerApprovalThreshold, 0)} SAR. فعّل موافقة المدير قبل الحفظ.`
            : `Extra impact ${formatSmartNumber(approvalImpact, 0)} SAR exceeds threshold ${formatSmartNumber(managerApprovalThreshold, 0)} SAR. Confirm manager approval before saving.`
        );
        setLoading(false);
        if (saveGuardRef.current) {
          clearTimeout(saveGuardRef.current);
          saveGuardRef.current = null;
        }
        return;
      }

      const root = calculateRootCause(
        {
          code: formData.code,
          branch: formData.branch,
          vendor: formData.vendor,
          name: selectedItem?.name,
          price: curP,
        },
        itemPurchases,
        settings
      );
      const decisionReasonAr = analysis?.reasons?.[0]?.ar || null;
      const decisionReasonEn = analysis?.reasons?.[0]?.en || null;

      await withTimeout(
        addDoc(collection(db, 'purchases'), {
        ...formData,
        name: selectedItem?.name || 'Unknown',
        price: curP,
        qty: qtyVal,
        total: curP * qtyVal,
        diff: diff,
        status: fallbackGrade,
        score: analysis?.score ?? null,
        grade: fallbackGrade,
        decisionAr: analysis?.decisionAr ?? (fallbackDecision === 'Buy Now' ? 'اشتر الآن' : fallbackDecision === 'Monitor' ? 'راقب' : 'لا تشتر'),
        decisionEn: analysis?.decisionEn ?? fallbackDecision,
        reasonAr: decisionReasonAr,
        reasonEn: decisionReasonEn,
        causeSource: root?.source ?? null,
        causeAr: root?.causeAr ?? null,
        causeEn: root?.causeEn ?? null,
        recommendationAr: root?.recommendationAr ?? null,
        recommendationEn: root?.recommendationEn ?? null,
        managerApprovalRequired: approvalImpact >= managerApprovalThreshold,
        managerApproved: approvalImpact >= managerApprovalThreshold ? managerApproved : null,
        managerApprovalThreshold,
        managerApprovalImpact: approvalImpact,
        timestamp: Date.now()
        }),
        20000,
        lang === 'ar' ? 'انتهت مهلة الحفظ، تحقق من الاتصال وحاول مجدداً' : 'Save timed out, check your connection and try again'
      );

      setFormData({ ...formData, code: '', price: '', qty: '1' });
      setManagerApproved(false);
      showMsg(
        lang === 'ar' ? '✓ تم الحفظ بنجاح' : '✓ Saved successfully',
        'success',
        lang === 'ar' ? `${formData.code} · ${formData.branch}` : `${formData.code} · ${formData.branch}`
      );
      speakSaveSuccess(lang);
    } catch (err) { 
      // Log error only in development
      if (import.meta.env.DEV) {
        console.error('Save error:', err);
      }
      if (err.code === 'permission-denied') {
        showMsg(
          lang === 'ar' ? '🔒 خطأ في الصلاحيات' : '🔒 Permission Denied',
          'error',
          lang === 'ar' ? 'لا توجد صلاحية لك للحفظ. تحقق من إعدادات الحساب' : 'You lack permission to save. Check your account settings'
        );
      } else if (err.code === 'unavailable') {
        showMsg(
          lang === 'ar' ? '🌐 الخدمة غير متاحة' : '🌐 Service Unavailable',
          'error',
          lang === 'ar' ? 'خادم قاعدة البيانات غير متاح الآن، حاول مجددا' : 'Database server is down. Please retry'
        );
      } else {
        showMsg(
          lang === 'ar' ? '❌ فشل الحفظ' : '❌ Save Failed',
          'error',
          err?.message || (lang === 'ar' ? 'حدث خطأ غير متوقع' : 'Unexpected error occurred')
        );
      }
    } finally {
      if (saveGuardRef.current) {
        clearTimeout(saveGuardRef.current);
        saveGuardRef.current = null;
      }
      setLoading(false);
    }
  };

  return (
     <div className="max-w-6xl mx-auto animate-in zoom-in duration-300 space-y-4">
       <form onSubmit={handleSave} className="bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,252,0.99))] rounded-[28px] shadow-[0_20px_50px_rgba(15,23,42,0.08)] border border-slate-200 overflow-hidden">
         <div className="bg-[linear-gradient(135deg,#1f2a3a_0%,#334968_100%)] p-4 phone:p-5 tablet:p-6 text-white flex flex-col phone:flex-row justify-between phone:items-start gap-3">
           <div className="flex items-start gap-3 phone:gap-4 min-w-0">
             <div className="w-12 h-12 rounded-2xl bg-white/10 ring-1 ring-white/10 grid place-items-center shrink-0">
               <PlusCircle className="text-blue-200" size={24}/>
             </div>
             <div className="min-w-0">
               <div className="flex flex-wrap items-center gap-2 mb-1">
                 <span className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-black tracking-[0.16em] uppercase">{lang === 'ar' ? 'إدخال تشغيلي' : 'Operational entry'}</span>
                 <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-[10px] font-black tracking-[0.16em] uppercase text-blue-100">Live Costing</span>
               </div>
               <h2 className="text-xl phone:text-2xl font-black whitespace-normal break-words">{t('entry')}</h2>
               <p className="mt-1 text-xs phone:text-sm text-slate-200 font-medium whitespace-normal break-words">{lang === 'ar' ? 'سجل عملية الشراء مع القرار السعري الفوري والمراجعة المرجعية' : 'Record a purchase with live pricing guidance and reference review'}</p>
             </div>
           </div>
          </div>

         <div className="p-4 phone:p-6 tablet:p-8 laptop:p-10 space-y-5 tablet:space-y-6">
           <div className="erp-toolbar p-4 tablet:p-5">
             <div className="flex items-center gap-2 mb-4">
               <CalendarDays size={16} className="text-slate-500"/>
               <h3 className="text-sm phone:text-base font-black text-slate-800">{lang === 'ar' ? 'بيانات العملية' : 'Transaction details'}</h3>
             </div>
             <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4 tablet:gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><CalendarDays size={14}/> {t('date')}</label>
                   <input type="date" required className="input-field" value={formData.date} onChange={e=>setFormField('date', e.target.value)} />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin size={14}/> {t('branch')}</label>
                   <select required className="input-field" value={formData.branch} onChange={e=>setFormField('branch', e.target.value)}>
                      <option value="">-- {t('branch')} --</option>
                      {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                   </select>
                </div>
             </div>
                </div>

                 <div className="erp-toolbar p-4 tablet:p-5 space-y-2">
                   <div className="flex items-center gap-2 mb-1">
                    <Store size={16} className="text-slate-500"/>
                    <h3 className="text-sm phone:text-base font-black text-slate-800">{lang === 'ar' ? 'المورد' : 'Supplier'}</h3>
                   </div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Store size={14}/> {t('vendor')}</label>
               <select required className="input-field" value={formData.vendor} onChange={e=>setFormField('vendor', e.target.value)}>
                   <option value="">-- {t('vendor')} --</option>
                   {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
             </div>

                 <div className="erp-toolbar p-4 tablet:p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Package size={16} className="text-slate-500"/>
                    <h3 className="text-sm phone:text-base font-black text-slate-800">{lang === 'ar' ? 'تفاصيل الصنف والتسعير' : 'Item and pricing details'}</h3>
                  </div>
                  <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4 tablet:gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Package size={14}/> {t('item')}</label>
                   <select required className="input-field border-blue-200" value={formData.code} onChange={e=>setFormField('code', e.target.value)}>
                      <option value="">-- {t('item')} --</option>
                      {items.map(i => <option key={i.id} value={i.code}>{i.name} (#{i.code})</option>)}
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Database size={14}/> {t('qty')}</label>
                   <input type="number" required className={`input-field text-center ${inlineValidation.qtyError ? 'border-red-300 ring-1 ring-red-100' : ''}`} value={formData.qty} onChange={e=>setFormField('qty', e.target.value)} />
                   {inlineValidation.qtyError && (
                     <p className="text-[10px] font-black text-red-600">{inlineValidation.qtyError}</p>
                   )}
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Wallet size={14}/> {t('price')}</label>
                   <div className="relative">
                    <input type="number" step="0.01" required className={`input-field text-blue-600 pl-14 text-lg phone:text-xl ${inlineValidation.priceError ? 'border-red-300 ring-1 ring-red-100' : ''}`} value={formData.price} onChange={e=>setFormField('price', e.target.value)} placeholder="0.00" />
                      <span className="absolute left-4 top-4 font-black text-slate-300 text-xs">SAR</span>
                   </div>
                   {inlineValidation.priceError && (
                     <p className="text-[10px] font-black text-red-600">{inlineValidation.priceError}</p>
                   )}
                </div>
               </div>
             </div>

             {selectedItem && formData.price && (
               <div className="space-y-4">
                 {/* Main decision block */}
                 {liveAnalysis ? (
                   <div className={`p-4 phone:p-5 tablet:p-6 rounded-2xl border-2 ${getGradeStyle(liveAnalysis.grade).border} ${getGradeStyle(liveAnalysis.grade).bg}`}>
                     <div className="flex flex-col tablet:flex-row items-start justify-between gap-4 mb-5">
                       <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{t('purchase_analysis')}</p>
                         <div className="flex items-center gap-3">
                           <div>
                             <p className={`text-base phone:text-lg font-black ${getGradeStyle(liveAnalysis.grade).text}`}>
                                 {lang === 'ar'
                                   ? (liveAnalysis.decisionAr || liveAnalysis.decisionEn || getLocalizedDecisionLabel(liveAnalysis.grade, true))
                                   : (liveAnalysis.decisionEn || liveAnalysis.decisionAr || getLocalizedDecisionLabel(liveAnalysis.grade, false))}
                             </p>
                             <p className="text-[11px] phone:text-xs font-bold text-slate-500">
                               {lang === 'ar' ? 'مؤشر قرار الشراء' : 'Purchase decision index'}: {liveAnalysis.score > 0 ? '+' : ''}{formatSmartNumber(liveAnalysis.score, 1)} · {liveAnalysis.sampleCount} {t('samples')}
                             </p>
                           </div>
                         </div>
                       </div>
                       <div className="text-right bg-white/60 px-4 py-3 rounded-xl w-full tablet:w-auto">
                         <p className="text-[10px] font-black text-slate-500 uppercase mb-1">{lang==='ar'?'إجمالي الفاتورة':'Invoice Total'}</p>
                         <p className="text-lg phone:text-xl font-black text-slate-900 tabular-nums break-all">{liveTotal.toLocaleString('en-US',{maximumFractionDigits:2})} <span className="text-xs font-bold text-slate-400">SAR</span></p>
                           {estimatedExtraCost > 0 && (
                             <p className="mt-1 text-[11px] font-black text-red-700">
                               {lang === 'ar'
                                 ? `تكلفة زائدة متوقعة: ${formatSmartNumber(estimatedExtraCost, 0)} SAR`
                                 : `Expected extra cost: ${formatSmartNumber(estimatedExtraCost, 0)} SAR`}
                             </p>
                           )}
                       </div>
                     </div>

                     {/* Reason */}
                     {liveAnalysis.reasons.length > 0 && (
                       <div className="px-4 py-3 bg-white/60 rounded-xl text-xs phone:text-sm text-slate-700 font-bold">
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">{t('reason')}</span>
                         <span>{lang === 'ar' ? (liveAnalysis.reasons[0]?.ar || liveAnalysis.reasons[0]?.en) : (liveAnalysis.reasons[0]?.en || liveAnalysis.reasons[0]?.ar)}</span>
                       </div>
                     )}

                     {liveRootCause && (
                       <div className="px-4 py-3 bg-white/70 rounded-xl text-xs phone:text-sm border border-slate-200">
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">{t('cause')}</span>
                         <p className="font-black text-slate-700 mb-1">{lang === 'ar' ? liveRootCause.causeAr : liveRootCause.causeEn}</p>
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mt-2 mb-1">{t('recommendation')}</span>
                         <p className="font-bold text-slate-600">{lang === 'ar' ? liveRootCause.recommendationAr : liveRootCause.recommendationEn}</p>
                       </div>
                     )}
                   </div>
                 ) : (
                   <div className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50 text-center">
                     <Info size={20} className="text-slate-400 mx-auto mb-2"/>
                     <p className="text-sm font-bold text-slate-500">{t('no_history')}</p>
                   </div>
                 )}

                 {(liveAnalysis || referencePrice != null) && (
                   <div className="elevated-card p-3 md:p-4">
                     <button
                       type="button"
                       onClick={() => setShowAdvancedPricing((v) => !v)}
                       className="w-full flex items-center justify-between text-sm font-semibold text-slate-700"
                     >
                       <span>{lang === 'ar' ? 'تفاصيل المقارنة السعرية' : 'Advanced price details'}</span>
                       <ChevronDown size={16} className={`transition-transform ${showAdvancedPricing ? 'rotate-180' : ''}`} />
                     </button>
                     {showAdvancedPricing && (
                       <div className="mt-3 space-y-3">
                         {liveAnalysis && (
                           <div className="grid grid-cols-1 phone:grid-cols-2 laptop:grid-cols-4 gap-3">
                             {[
                               { label: t('avg_price_hist'), val: formatSmartNumber(liveAnalysis.avgPrice, 2), color: 'text-slate-700' },
                               { label: t('min_price'), val: formatSmartNumber(liveAnalysis.minPrice, 2), color: 'text-emerald-700' },
                               { label: t('max_price'), val: formatSmartNumber(liveAnalysis.maxPrice, 2), color: 'text-red-700' },
                               { label: t('last_purchase_price'), val: formatSmartNumber(liveAnalysis.lastPrice, 2), color: 'text-blue-700' },
                             ].map(item => (
                               <div key={item.label} className="bg-white rounded-lg border border-slate-200 p-3 text-center">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                                 <p className={`mt-2 text-lg font-black tabular-nums ${item.color}`}>{item.val} <span className="text-xs text-slate-300">SAR</span></p>
                               </div>
                             ))}
                           </div>
                         )}

                         {referencePrice != null && (
                           <div className="grid grid-cols-1 phone:grid-cols-2 gap-3">
                             <div className="bg-white rounded-lg border border-slate-200 p-3">
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('price_change_value')}</p>
                               <p className={`mt-2 text-lg tablet:text-xl font-black tabular-nums break-all ${referenceChange != null && referenceChange > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                 {referenceChange != null ? formatSmartNumber(referenceChange, 2) : '—'} <span className="text-sm text-slate-400">SAR</span>
                               </p>
                             </div>
                             <div className="bg-white rounded-lg border border-slate-200 p-3">
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('price_change_percent')}</p>
                               <p className={`mt-2 text-lg tablet:text-xl font-black tabular-nums break-all ${referencePercent != null && referencePercent > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                 {referencePercent != null ? formatPercent(referencePercent, 1) : '—'}
                               </p>
                             </div>
                           </div>
                         )}
                       </div>
                     )}
                   </div>
                 )}
               </div>
             )}

             {requiresManagerApproval && (
               <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
                 <p className="text-xs font-black text-amber-800">
                   {lang === 'ar'
                     ? `يتطلب اعتماد مدير لأن التكلفة الزائدة المتوقعة (${formatSmartNumber(estimatedExtraCost, 0)} SAR) تتجاوز حد ${formatSmartNumber(managerApprovalThreshold, 0)} SAR.`
                     : `Manager approval is required because expected extra cost (${formatSmartNumber(estimatedExtraCost, 0)} SAR) exceeds ${formatSmartNumber(managerApprovalThreshold, 0)} SAR.`}
                 </p>
                 <label className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-amber-900">
                   <input
                     type="checkbox"
                     className="h-4 w-4"
                     checked={managerApproved}
                     onChange={(e) => setManagerApproved(e.target.checked)}
                   />
                   {lang === 'ar' ? 'تمت مراجعة واعتماد المدير لهذه الفاتورة' : 'Manager has reviewed and approved this invoice'}
                 </label>
               </div>
             )}

             <div className="hidden tablet:flex flex-col tablet:flex-row gap-4 pt-8 border-t-2 border-slate-50">
                 <button type="button" disabled={loading} onClick={()=>{ setFormData({...formData, code:'', price:''}); setManagerApproved(false); }} className="btn-surface tablet:order-1 order-2 flex-1 py-3 bg-white text-slate-500 rounded-md border border-slate-200 font-semibold flex justify-center items-center gap-2 transition-colors hover:bg-slate-50 disabled:opacity-50">{t('clear')}</button>
                 <button type="submit" disabled={loading} className="btn-surface tablet:order-2 order-1 flex-[2] py-3.5 bg-blue-600 text-white rounded-md font-semibold text-base tablet:text-lg flex justify-center items-center gap-3 shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50">
                   {loading ? <div className="w-6 h-6 border-4 border-white/30 border-t-white animate-spin rounded-full"></div> : <><Save size={24}/> {t('save')}</>}
                </button>
             </div>
             <div className="tablet:hidden -mx-1 pt-2">
               <div className="rounded-[22px] border border-slate-200/90 bg-white/95 backdrop-blur px-3 py-3 shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
                 <div className="flex items-center justify-between gap-3 mb-3">
                   <div className="min-w-0">
                     <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{lang === 'ar' ? 'إجراء سريع' : 'Quick action'}</p>
                     <p className="text-xs font-bold text-slate-600 break-words">{lang === 'ar' ? 'احفظ العملية أو امسح الحقول بسرعة' : 'Save this entry or reset the fields quickly'}</p>
                   </div>
                   <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-right shrink-0">
                     <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{lang === 'ar' ? 'الإجمالي' : 'Total'}</p>
                     <p className="text-sm font-black text-slate-900 tabular-nums">{formatSmartNumber(liveTotal, 2)} <span className="text-[10px] text-slate-400">SAR</span></p>
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                   <button type="button" disabled={loading} onClick={()=>{ setFormData({...formData, code:'', price:''}); setManagerApproved(false); }} className="btn-surface py-3 bg-white text-slate-500 rounded-xl border border-slate-200 font-semibold flex justify-center items-center gap-2 transition-colors hover:bg-slate-50 disabled:opacity-50">{t('clear')}</button>
                   <button type="submit" disabled={loading} className="btn-surface py-3 bg-blue-600 text-white rounded-xl font-semibold flex justify-center items-center gap-2 shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50">
                     {loading ? <div className="w-5 h-5 border-4 border-white/30 border-t-white animate-spin rounded-full"></div> : <><Save size={18}/> {t('save')}</>}
                   </button>
                 </div>
               </div>
             </div>
          </div>
       </form>
    </div>
  );
}

// ==========================================
// 4. شاشة السجل التاريخي (Database)
// ==========================================
function DatabaseView({ purchases, enrichedPurchases, isActive = true, showMsg, t, lang, settings, onQuickAdd }) {
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [deleteBackup, setDeleteBackup] = useState(() => readPurchasesDeleteBackup());
  const [isRestoringDeleted, setIsRestoringDeleted] = useState(false);
  const ar = lang === 'ar';

  const persistDeleteBackup = useCallback((payload) => {
    try {
      if (!payload || !Array.isArray(payload.records) || payload.records.length === 0) {
        localStorage.removeItem(PURCHASES_DELETE_BACKUP_KEY);
        setDeleteBackup(null);
        return true;
      }
      localStorage.setItem(PURCHASES_DELETE_BACKUP_KEY, JSON.stringify(payload));
      setDeleteBackup(payload);
      return true;
    } catch {
      return false;
    }
  }, []);

  const clearDeleteBackup = useCallback(() => {
    try {
      localStorage.removeItem(PURCHASES_DELETE_BACKUP_KEY);
    } catch {
      // Ignore local storage cleanup errors.
    }
    setDeleteBackup(null);
  }, []);

  const deleteBackupLabel = useMemo(() => {
    if (!deleteBackup?.deletedAt) return '';
    const parsed = new Date(deleteBackup.deletedAt);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString(ar ? 'ar-SA' : 'en-GB', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [deleteBackup, ar]);

  const cleanVendorLabel = useCallback((vendor) => {
    const raw = String(vendor || '').trim();
    if (!raw) return '—';
    const cleaned = raw.replace(/^(?:مورد|supplier)\s*[:-]?\s*/i, '').trim();
    return cleaned || raw;
  }, []);

  const cleanItemLabel = useCallback((item, code) => {
    const raw = String(item || '').trim();
    if (!raw) return code || '—';
    const cleaned = raw.replace(/^(?:صنف|item)\s*[:-]?\s*/i, '').trim();
    return cleaned || raw;
  }, []);

  const formatDateDisplay = useCallback((value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB');
  }, []);

  const sourcePurchases = isActive ? purchases : EMPTY_LIST;
  const enriched = useMemo(
    () => (isActive ? (enrichedPurchases || enrichPurchasesWithScores(sourcePurchases, settings)) : EMPTY_LIST),
    [isActive, enrichedPurchases, sourcePurchases, settings]
  );

  const filtered = useMemo(() => {
    let list = enriched;
    const normalizedQuery = normalizeSearchValue(search);
    // text + date filters
    list = list.filter((p) => {
      if (!normalizedQuery) return true;
      return (
        normalizeSearchValue(p.vendor).includes(normalizedQuery) ||
        normalizeSearchValue(p.name).includes(normalizedQuery) ||
        normalizeSearchValue(p.code).includes(normalizedQuery)
      );
    }).filter(p => {
      if (!fromDate && !toDate) return true;
      const date = new Date(p.date).setHours(0,0,0,0);
      const from = fromDate ? new Date(fromDate).setHours(0,0,0,0) : null;
      const to = toDate ? new Date(toDate).setHours(0,0,0,0) : null;
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
    return [...list].sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a));
  }, [enriched, search, fromDate, toDate]);

  const clearFilters = useCallback(() => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setShowAdvancedFilters(false);
  }, []);

  const visibleSummary = useMemo(() => ({
    total: filtered.length,
    highRisk: filtered.filter((p) => Number.isFinite(Number(p.score)) && Number(p.score) < (settings.gradeC ?? -10)).length,
  }), [filtered, settings.gradeC]);

  const filteredTotalValue = useMemo(
    () => filtered.reduce((sum, p) => {
      const fallbackTotal = Number(p.price || 0) * Number(p.qty || 0);
      const resolvedTotal = p.total ?? fallbackTotal;
      return sum + Number(resolvedTotal || 0);
    }, 0),
    [filtered]
  );

  const averageScore = useMemo(() => {
    const scores = filtered.map((p) => Number(p.score)).filter(Number.isFinite);
    if (!scores.length) return null;
    return scores.reduce((sum, value) => sum + value, 0) / scores.length;
  }, [filtered]);

  const uniqueVendorCount = useMemo(() => {
    const values = filtered
      .map((p) => cleanVendorLabel(p.vendor))
      .filter((value) => value && value !== '—');
    return new Set(values).size;
  }, [filtered, cleanVendorLabel]);

  const latestRecordDate = filtered[0]?.date ? formatDateDisplay(filtered[0].date) : '—';

  const exportExcel = () => {
    const header = `Date,Branch,Vendor,Item,Code,Price,Qty,Total,Score,Grade,Decision,Cause,Recommendation\n`;
    const rows = filtered.map(p => `${p.date},${p.branch},${p.vendor},${p.name},${p.code},${p.price},${p.qty},${p.total},${p.score ?? ''},${p.grade ?? p.status ?? ''},${ar ? (p.decisionAr ?? '') : (p.decisionEn ?? '')},${ar ? (p.causeAr ?? '') : (p.causeEn ?? '')},${ar ? (p.recommendationAr ?? '') : (p.recommendationEn ?? '')}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "purchase_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteAll = async () => {
    const confirmed = confirm(ar ? '⚠️ تحذير: سيتم حذف جميع السجلات بلا رجعة. هل أنت متأكد؟' : '⚠️ Warning: All records will be permanently deleted. Are you sure?');
    if (!confirmed) return;
    try {
      const docs = await getDocs(collection(db, 'purchases'));
      const count = docs.docs.length;
      if (!count) {
        showMsg(
          ar ? 'لا توجد سجلات للحذف' : 'No records to delete',
          'warning'
        );
        return;
      }
      const backupPayload = {
        deletedAt: new Date().toISOString(),
        records: docs.docs.map((d) => ({ ...d.data() })),
      };
      const backupSaved = persistDeleteBackup(backupPayload);
      await Promise.all(docs.docs.map(d => deleteDoc(doc(db, 'purchases', d.id))));
      showMsg(
        ar ? '✓ تم الحذف' : '✓ Deleted',
        'success',
        backupSaved
          ? (ar ? `${count} سجل تم حذفه ويمكن استرجاع آخر حذف` : `${count} records deleted. Last delete can be restored`)
          : (ar ? `${count} سجل تم حذفه بنجاح` : `${count} records permanently deleted`)
      );
    } catch {
      showMsg(
        ar ? '❌ فشل الحذف' : '❌ Delete Failed',
        'error',
        ar ? 'تعذر الوصول إلى قاعدة البيانات' : 'Database connection failed'
      );
    }
  };

  const restoreDeletedPurchases = useCallback(async () => {
    if (!deleteBackup?.records?.length || isRestoringDeleted) return;

    const shouldRestore = purchases.length > 0
      ? confirm(ar ? 'يوجد سجلات حالية. استرجاع النسخة المحذوفة سيضيفها إلى السجل الحالي. هل تريد المتابعة؟' : 'Current records already exist. Restoring will add the deleted snapshot to the existing log. Continue?')
      : true;

    if (!shouldRestore) return;

    setIsRestoringDeleted(true);
    try {
      await Promise.all(
        deleteBackup.records.map((entry) => addDoc(collection(db, 'purchases'), { ...entry }))
      );
      const restoredCount = deleteBackup.records.length;
      clearDeleteBackup();
      showMsg(
        ar ? 'تم استرجاع البيانات' : 'Data restored',
        'success',
        ar ? `تمت إعادة ${restoredCount} سجل من آخر حذف` : `${restoredCount} records restored from the last delete`
      );
    } catch {
      showMsg(
        ar ? 'تعذر استرجاع البيانات' : 'Restore failed',
        'error',
        ar ? 'حدثت مشكلة أثناء إعادة السجلات المحذوفة' : 'A problem occurred while restoring deleted records'
      );
    } finally {
      setIsRestoringDeleted(false);
    }
  }, [ar, clearDeleteBackup, deleteBackup, isRestoringDeleted, purchases.length, showMsg]);

  // Build deal analysis for selected item
  const dealAnalysis = useMemo(() => {
    if (!selectedDeal) return null;
    const history = purchases
      .filter(p => p.code === selectedDeal.code && p.id !== selectedDeal.id)
      .map(p => ({ price: p.price }));
    return calculateDecisionScore(selectedDeal.price, history, settings);
  }, [selectedDeal, purchases, settings]);

  const dealRootCause = useMemo(() => {
    if (!selectedDeal) return null;
    const history = purchases.filter(p => p.code === selectedDeal.code && p.id !== selectedDeal.id);
    return calculateRootCause(selectedDeal, history, settings);
  }, [selectedDeal, purchases, settings]);

  return (
    <div className="max-w-7xl mx-auto space-y-4 animate-in fade-in duration-700">
      {/* Deal Analysis Modal */}
      {selectedDeal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 phone:p-4" onClick={() => setSelectedDeal(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-4 phone:p-6 tablet:p-8 relative max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedDeal(null)} className="btn-surface absolute top-4 left-4 p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={20}/></button>
            <h3 className="font-black text-lg phone:text-xl mb-1">{t('analyze_deal')}</h3>
            <p className="text-xs phone:text-sm text-slate-500 mb-3">{cleanItemLabel(selectedDeal.name, selectedDeal.code)} — {cleanVendorLabel(selectedDeal.vendor)} — {formatDateDisplay(selectedDeal.date)}</p>
            <div className="mb-5 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
              {selectedDeal.branch && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50">
                  <Building2 size={12} />
                  {ar ? `الفرع المشتري: ${selectedDeal.branch}` : `Buying branch: ${selectedDeal.branch}`}
                </span>
              )}
              {selectedDeal.vendor && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white">
                  <Store size={12} />
                  {cleanVendorLabel(selectedDeal.vendor)}
                </span>
              )}
            </div>
            {dealAnalysis ? (
              <div className="space-y-4">
                <div className={`p-5 rounded-2xl border-2 ${getGradeStyle(dealAnalysis.grade).border} ${getGradeStyle(dealAnalysis.grade).bg}`}>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className={`text-lg phone:text-xl font-black ${getGradeStyle(dealAnalysis.grade).text}`}>
                        {ar
                          ? (dealAnalysis.decisionAr || dealAnalysis.decisionEn || getLocalizedDecisionLabel(dealAnalysis.grade, true))
                          : (dealAnalysis.decisionEn || dealAnalysis.decisionAr || getLocalizedDecisionLabel(dealAnalysis.grade, false))}
                      </p>
                      <p className="text-xs phone:text-sm text-slate-500">{t('score')}: {dealAnalysis.score > 0 ? '+' : ''}{formatSmartNumber(dealAnalysis.score, 1)}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 phone:grid-cols-2 gap-3">
                  {[
                    [t('avg_price_hist'), formatSmartNumber(dealAnalysis.avgPrice, 2)],
                    [t('min_price'), formatSmartNumber(dealAnalysis.minPrice, 2)],
                    [t('max_price'), formatSmartNumber(dealAnalysis.maxPrice, 2)],
                    [t('last_purchase_price'), formatSmartNumber(dealAnalysis.lastPrice, 2)],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-3 border">
                      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
                      <p className="text-base phone:text-lg font-black text-slate-800 break-all">{val} SAR</p>
                    </div>
                  ))}
                </div>
                {dealAnalysis.reasons.length > 0 && (
                  <div className="px-4 py-3 bg-slate-50 rounded-xl border text-sm">
                    <p className="font-black text-slate-500 uppercase text-[10px] mb-1">{t('reason')}</p>
                    <p className="font-bold text-slate-700">{ar ? (dealAnalysis.reasons[0]?.ar || dealAnalysis.reasons[0]?.en) : (dealAnalysis.reasons[0]?.en || dealAnalysis.reasons[0]?.ar)}</p>
                  </div>
                )}
                {dealRootCause && (
                  <div className="px-4 py-3 bg-blue-50 rounded-xl border border-blue-200 text-sm">
                    <p className="font-black text-blue-500 uppercase text-[10px] mb-1">{t('cause')}</p>
                    <p className="font-black text-slate-800 mb-2">{ar ? dealRootCause.causeAr : dealRootCause.causeEn}</p>
                    <p className="font-black text-blue-500 uppercase text-[10px] mb-1">{t('recommendation')}</p>
                    <p className="font-bold text-slate-700">{ar ? dealRootCause.recommendationAr : dealRootCause.recommendationEn}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-slate-400 font-bold py-8">{t('no_history')}</p>
            )}
          </div>
        </div>
      )}

      <div className="elevated-card overflow-hidden p-4 phone:p-5 md:p-6 bg-[linear-gradient(135deg,rgba(255,255,255,0.99),rgba(245,248,252,0.99))]">
        <div className="flex flex-col laptop:flex-row laptop:items-end laptop:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="erp-subtle-chip">{ar ? 'سجل تشغيلي' : 'Operations log'}</span>
              <span className="erp-subtle-chip">{visibleSummary.total} {t('results')}</span>
              {visibleSummary.highRisk > 0 && <span className="erp-subtle-chip status-high">{visibleSummary.highRisk} {t('high_risk')}</span>}
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900">{ar ? 'قاعدة بيانات المشتريات' : 'Purchase database'}</h2>
            <p className="mt-1 text-sm text-slate-500 font-medium break-words">{ar ? 'تابع السجل الكامل، حلل الصفقات، وراجع السلوك السعري بسرعة.' : 'Review the full log, analyze deals, and track pricing behavior quickly.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportExcel} className="btn-surface px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors text-sm">
              <Download size={16}/> {t('export')}
            </button>
            <button onClick={onQuickAdd} className="btn-surface px-4 py-2.5 bg-blue-600 text-white rounded-xl border border-blue-600 font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors text-sm">
              <PlusCircle size={16}/> {t('add_purchase')}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 laptop:grid-cols-4 gap-3">
          {[
            { key: 'value', label: ar ? 'القيمة الظاهرة' : 'Visible value', value: `${formatSmartNumber(filteredTotalValue, 0)} SAR`, tone: 'text-slate-900' },
            { key: 'vendors', label: ar ? 'الموردون النشطون' : 'Active vendors', value: uniqueVendorCount, tone: 'text-[#4d6e9d]' },
            { key: 'score', label: ar ? 'متوسط المؤشر' : 'Average score', value: averageScore != null ? `${averageScore > 0 ? '+' : ''}${formatSmartNumber(averageScore, 1)}` : '—', tone: averageScore != null && averageScore < 0 ? 'text-red-600' : 'text-emerald-600' },
            { key: 'latest', label: ar ? 'آخر عملية ظاهرة' : 'Latest visible record', value: latestRecordDate, tone: 'text-slate-700' },
          ].map((stat) => (
            <div key={stat.key} className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.05)] min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 whitespace-normal break-words">{stat.label}</p>
              <p className={`mt-2 text-sm phone:text-[15px] font-bold whitespace-normal break-words ${stat.tone}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-md flex flex-col md:h-[calc(100vh-280px)] overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 phone:p-4 tablet:p-5 border-b bg-slate-50/50 space-y-3">
          <div className="flex flex-col phone:flex-row gap-2">
            <div className="relative w-full grow group">
              <input type="text" placeholder={t('search')} className="input-field pl-4 pr-11 py-2.5 rounded-xl w-full" value={search} onChange={e=>setSearch(e.target.value)} />
              <Search size={18} className="absolute right-3 top-3 text-slate-300"/>
            </div>

          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((v) => !v)}
              className="btn-surface px-3 py-2 bg-white text-slate-600 rounded-xl border border-slate-200 font-semibold text-xs flex items-center gap-2"
            >
              <SlidersHorizontal size={14}/>
              {t('advanced_filters')}
              <ChevronDown size={14} className={`transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>
            <span className="erp-subtle-chip">{`${visibleSummary.total} ${t('results')}`}</span>
            <span className={`erp-subtle-chip ${visibleSummary.highRisk > 0 ? 'status-high' : ''}`}>{`${visibleSummary.highRisk} ${t('high_risk')}`}</span>
            {deleteBackup?.records?.length > 0 && (
              <span className="erp-subtle-chip status-watch">{`${t('saved_backup')}: ${deleteBackup.records.length} ${t('records')}${deleteBackupLabel ? ` • ${deleteBackupLabel}` : ''}`}</span>
            )}
          </div>

          {showAdvancedFilters && (
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-1 phone:grid-cols-2 tablet:grid-cols-[1fr_auto_1fr] gap-2 items-center w-full">
                <input type="date" className="input-field p-2 text-sm" value={fromDate} onChange={e=>setFromDate(e.target.value)}/>
                <span className="hidden tablet:block text-slate-400 font-bold text-center">→</span>
                <input type="date" className="input-field p-2 text-sm" value={toDate} onChange={e=>setToDate(e.target.value)}/>
              </div>
              <div className="grid grid-cols-1 phone:grid-cols-2 gap-2">
                <button onClick={exportExcel} className="btn-surface px-3 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors text-sm w-full">
                  <Download size={16}/> {t('export')}
                </button>
                <button onClick={clearFilters} className="btn-surface px-3 py-2.5 bg-white text-slate-600 rounded-xl border border-slate-200 font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors text-sm w-full">
                  <RotateCcw size={16}/> {t('reset_filters')}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={deleteAll} className="text-xs text-red-600 font-semibold hover:text-red-700 inline-flex items-center gap-1.5">
                  <Trash2 size={14}/> {t('delete_all')}
                </button>
                {deleteBackup?.records?.length > 0 && (
                  <button
                    type="button"
                    onClick={restoreDeletedPurchases}
                    disabled={isRestoringDeleted}
                    className="btn-surface inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <RotateCcw size={14}/>
                    {isRestoringDeleted
                      ? t('restoring')
                      : t('restore_last_delete')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="md:hidden flex-1 overflow-auto no-scrollbar p-2.5 space-y-3 bg-slate-50/40">
          {filtered.map(p => {
            const gs = getGradeStyle(p.grade);
            const dec = ar
              ? (p.decisionAr || p.decisionEn || getLocalizedDecisionLabel(p.grade || p.status, true))
              : (p.decisionEn || p.decisionAr || getLocalizedDecisionLabel(p.grade || p.status, false));
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-3 shadow-[0_8px_18px_rgba(15,23,42,0.05)] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-blue-500 mb-0.5">#{p.code}</p>
                    <p className="font-black text-slate-800 text-xs phone:text-sm whitespace-normal break-words">{cleanItemLabel(p.name, p.code)}</p>
                    <p className="text-[11px] text-slate-500 font-bold mt-1 whitespace-normal break-words">{cleanVendorLabel(p.vendor)}</p>
                    <p className="text-[11px] text-slate-400 font-bold mt-1 whitespace-nowrap">{formatDateDisplay(p.date)}</p>
                  </div>
                  <span className={`inline-flex items-center whitespace-nowrap px-2 py-1 rounded-lg font-black text-[11px] border shrink-0 ${gs.badge}`}>{dec}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase">{t('price')}</p>
                    <p className="mt-0.5 text-xs font-black text-slate-800 break-all">{p.price?.toFixed(2)} SAR</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase">{t('score')}</p>
                    <p className={`mt-0.5 text-xs font-black ${p.score >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{p.score != null ? `${p.score > 0 ? '+' : ''}${formatSmartNumber(p.score, 1)}` : '—'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase">{t('qty')}</p>
                    <p className="mt-0.5 text-xs font-black text-slate-800">{formatSmartNumber(p.qty, 0)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase">{ar ? 'الإجمالي' : 'Total'}</p>
                    <p className="mt-0.5 text-xs font-black text-slate-800 break-all">{formatSmartNumber(p.total ?? (Number(p.price || 0) * Number(p.qty || 0)), 2)} SAR</p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-0.5">
                  <button onClick={() => setSelectedDeal(p)} className="btn-surface w-full px-3 py-2 rounded-md bg-blue-600 text-white border border-blue-600 font-semibold text-xs flex items-center justify-center gap-2">
                    <Search size={16}/> {t('analyze_deal')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedCardId(expandedCardId === p.id ? null : p.id)}
                    className="w-full text-xs font-semibold text-slate-600 flex items-center justify-center gap-1"
                  >
                    {expandedCardId === p.id ? t('hide_details') : t('show_details')}
                    <ChevronDown size={14} className={`transition-transform ${expandedCardId === p.id ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {expandedCardId === p.id && (
                  <div className="space-y-2 text-[11px] border-t border-slate-100 pt-2">
                    <div>
                      <p className="font-black text-slate-400 uppercase text-[10px] mb-1">{t('cause')}</p>
                      <p className="font-semibold text-slate-700 break-words">{ar ? (p.causeAr || '—') : (p.causeEn || '—')}</p>
                    </div>
                    <div>
                      <p className="font-black text-slate-400 uppercase text-[10px] mb-1">{t('recommendation')}</p>
                      <p className="font-semibold text-slate-600 break-words">{ar ? (p.recommendationAr || '—') : (p.recommendationEn || '—')}</p>
                    </div>
                    <button onClick={() => { if (confirm(t('delete_confirm'))) deleteDoc(doc(db, 'purchases', p.id)); }} className="w-full mt-1 px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-100 font-semibold text-sm flex items-center justify-center gap-2">
                      <Trash2 size={16}/> {t('delete')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <EmptyState
              isRTL={ar}
              icon={<Database size={44} />}
              title={t('no_results_for_filters')}
              message={t('broaden_search_hint')}
              action={{ label: t('reset_filters'), onClick: clearFilters }}
              secondaryAction={{ label: t('add_purchase'), onClick: onQuickAdd }}
            />
          )}
        </div>

        <div className="hidden md:block flex-1 overflow-auto no-scrollbar bg-white">
          <table className="w-full text-right text-xs md:text-sm min-w-[1080px] xl:min-w-0 border-separate border-spacing-0">
            <thead className="bg-[linear-gradient(180deg,#2b3d56_0%,#334968_100%)] text-white sticky top-0 z-10">
              <tr>
                <th className="p-4 font-black uppercase tracking-widest text-[10px] opacity-60">{t('date')}</th>
                <th className="p-4 font-black uppercase tracking-widest text-[10px] opacity-60">{t('vendor')}</th>
                <th className="p-4 font-black uppercase tracking-widest text-[10px] opacity-60">{t('item')}</th>
                <th className="p-4 font-black uppercase tracking-widest text-[10px] opacity-60 text-center">{t('price')}</th>
                <th className="p-4 font-black uppercase tracking-widest text-[10px] opacity-60 text-center">{t('score')}</th>
                <th className="p-4 font-black uppercase tracking-widest text-[10px] opacity-60 text-center">{t('signal')}</th>
                <th className="p-4 font-black uppercase tracking-widest text-[10px] opacity-60 text-center w-[260px]">{t('cause')}</th>
                <th className="p-4 font-black uppercase tracking-widest text-[10px] opacity-60 text-center w-[260px]">{t('recommendation')}</th>
                <th className="p-4 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center">
                    <EmptyState
                      isRTL={ar}
                      icon={<Database size={48} />}
                      title={t('no_matching_results')}
                      message={t('adjust_filters_or_add')}
                      action={{ label: t('reset_filters'), onClick: clearFilters }}
                      secondaryAction={{ label: t('add_purchase'), onClick: onQuickAdd }}
                    />
                  </td>
                </tr>
              )}
              {filtered.map(p => {
                const gs = getGradeStyle(p.grade);
                const dec = ar
                  ? (p.decisionAr || p.decisionEn || getLocalizedDecisionLabel(p.grade || p.status, true))
                  : (p.decisionEn || p.decisionAr || getLocalizedDecisionLabel(p.grade || p.status, false));
                return (
                  <tr key={p.id} className="hover:bg-blue-50/50 transition-all group align-top">
                    <td className="p-4 font-bold text-slate-500 tabular-nums whitespace-nowrap">{formatDateDisplay(p.date)}</td>
                    <td className="p-4 font-black text-slate-900">{cleanVendorLabel(p.vendor)}</td>
                    <td className="p-4">
                      <span className="text-[10px] font-black text-blue-500 block">#{p.code}</span>
                      <span className="font-black text-slate-700">{cleanItemLabel(p.name, p.code)}</span>
                    </td>
                    <td className="p-4 text-center font-black tabular-nums">{p.price?.toFixed(2)}</td>
                    <td className="p-4 text-center">
                      {p.score != null ? (
                        <span className={`font-black text-sm tabular-nums ${p.score >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {p.score > 0 ? '+' : ''}{formatSmartNumber(p.score, 1)}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center whitespace-nowrap px-2 py-1 rounded-lg font-black text-[11px] border ${gs.badge}`}>{dec}</span>
                    </td>
                    <td className="p-4 text-start align-top max-w-[260px] w-[260px]">
                      <span className="block text-[12px] font-semibold text-slate-700 whitespace-normal break-words leading-6">{ar ? (p.causeAr || '—') : (p.causeEn || '—')}</span>
                    </td>
                    <td className="p-4 text-start align-top max-w-[260px] w-[260px]">
                      <span className="block text-[12px] font-semibold text-slate-600 whitespace-normal break-words leading-6">{ar ? (p.recommendationAr || '—') : (p.recommendationEn || '—')}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 justify-center">
                        <button onClick={() => setSelectedDeal(p)} className="text-blue-200 hover:text-blue-600 transition-all" title={t('analyze_deal')}><Search size={16}/></button>
                        <button onClick={() => { if (confirm(t('delete_confirm'))) deleteDoc(doc(db, 'purchases', p.id)); }} className="text-red-200 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- المكونات UI ---

function StatCard({ title, val, unit = null, icon, color }) {
  return (
    <div className={`relative min-w-0 p-4 phone:p-5 md:p-6 rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.98))] shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-all hover:shadow-[0_20px_40px_rgba(15,23,42,0.09)] hover:border-slate-300 group overflow-hidden ${color}`}>
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#d8e4f3_0%,#5f83b4_45%,#d8e4f3_100%)] opacity-80"></div>
      <div className="relative z-10 min-w-0">
        <div className="flex justify-between items-start mb-5 gap-3">
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 whitespace-normal break-words">{title}</span>
            <div className="mt-2 w-10 h-[2px] rounded-full bg-slate-200"></div>
          </div>
          <div className="p-2.5 bg-[linear-gradient(135deg,#f5f8fc_0%,#e8eef7_100%)] text-[#4d6e9d] rounded-xl ring-1 ring-slate-200 group-hover:bg-[linear-gradient(135deg,#edf3fb_0%,#dde8f7_100%)] transition-colors">{icon}</div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1 min-w-0 max-w-full">
            <span className="text-[1.65rem] phone:text-3xl md:text-[2.2rem] leading-none font-black text-slate-900 tabular-nums whitespace-normal break-all">{val}</span>
            {unit && <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 pb-1 whitespace-normal break-words">{unit}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuBtn({ active, onClick, icon, label, collapsed = false }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-xl border transition-all duration-150 text-sm font-semibold ${active ? 'bg-white text-slate-900 border-slate-200 shadow-sm' : 'text-slate-600 border-transparent hover:bg-white/75 hover:border-slate-200/80 hover:text-slate-900'}`}
    >
      <span className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center ${active ? 'bg-[linear-gradient(135deg,#e8f0fb_0%,#dbe7f6_100%)] text-[#4d6e9d]' : 'bg-slate-100 text-slate-500'}`}>{icon}</span>
      {!collapsed && (
        <>
          <span className="truncate flex-1 text-right">{label}</span>
          <span className={`w-2 h-2 rounded-full transition-colors ${active ? 'bg-[#5f83b4]' : 'bg-slate-200'}`}></span>
        </>
      )}
    </button>
  );
}

function MobileTab({ active, onClick, icon, label, badgeCount = 0 }) {
  return (
    <button
      onClick={() => {
        triggerHaptic(8);
        onClick?.();
      }}
      className={`relative min-h-[44px] flex flex-col items-center justify-center gap-0 px-1 py-1 transition-colors duration-150 ${active ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}
    >
      <span className={`absolute top-0 left-2 right-2 h-[2px] rounded-full transition-colors duration-150 ${active ? 'bg-blue-700' : 'bg-transparent'}`}></span>
      <span className={`relative grid place-items-center w-6 h-6 rounded-md shrink-0 transition-colors duration-150 ${active ? 'bg-blue-100 text-blue-700' : 'bg-transparent'}`}>
        {icon}
        {badgeCount > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-black leading-4 text-center">
            {badgeCount}
          </span>
        )}
      </span>
      <span className={`mt-0.5 text-[8px] phone:text-[9px] leading-tight font-semibold text-center whitespace-normal break-words min-h-[18px] ${active ? 'text-blue-700' : 'text-slate-500'}`}>{label}</span>
    </button>
  );
}

function LoadingScreen({lang}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center gap-8">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full animate-spin" style={{maskImage: 'conic-gradient(transparent, black)'}}></div>
        <div className="absolute inset-2 bg-slate-900 rounded-full"></div>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-white mb-2">{lang==='ar'?'جاري التحميل':'Loading'}</p>
        <p className="text-sm text-slate-400">{lang==='ar'?'يرجى الانتظار قليلاً':'Please wait a moment'}</p>
      </div>
    </div>
  );
}

// ==========================================
// ANALYTICS VIEW — 4 focused charts
// ==========================================
function AnalyticsView({ purchases, enrichedPurchases, isActive = true, t, lang, settings, timeFilter, setTimeFilter, customFrom, setCustomFrom, customTo, setCustomTo }) {
  const ar = lang === 'ar';
  const sourcePurchases = isActive ? purchases : EMPTY_LIST;
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440));
  const [selectedItemCode, setSelectedItemCode] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [drilldown, setDrilldown] = useState(null);
  const MAX_ANALYTICS_HISTORY_ROWS = 1200;

  const cleanVendorLabel = useCallback((vendor) => {
    const raw = String(vendor || '').trim();
    if (!raw) return '—';
    const cleaned = raw.replace(/^(?:مورد|supplier)\s*[:-]?\s*/i, '').trim();
    return cleaned || raw;
  }, []);

  const cleanItemLabel = useCallback((item, code) => {
    const raw = String(item || '').trim();
    if (!raw) return code || '—';
    const cleaned = raw.replace(/^(?:صنف|item)\s*[:-]?\s*/i, '').trim();
    return cleaned || raw;
  }, []);

  const formatDateDisplay = useCallback((value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB');
  }, []);

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return () => {};
    let rafId = 0;
    const onResize = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        setViewportWidth((prev) => {
          const next = window.innerWidth;
          return prev === next ? prev : next;
        });
      });
    };

    onResize();
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isActive]);

  const isPhone = viewportWidth <= 480;
  const isTablet = viewportWidth <= 768;
  const analyticsPalette = useMemo(() => ({
    grid: '#d5dde6',
    primary: '#526c8c',
    primaryDark: '#31455f',
    primaryMid: '#6c829d',
    primarySoft: '#8e9fb2',
    primaryMuted: '#afbbc9',
    positive: '#4f6f63',
    warning: '#6f5e54',
    neutral: '#7c8797',
  }), []);

  const getRankedMutedTone = useCallback((index, total) => {
    if (total <= 1) return analyticsPalette.primaryDark;

    const rankedPalette = [
      analyticsPalette.primaryDark,
      analyticsPalette.primary,
      analyticsPalette.primaryMid,
      analyticsPalette.primarySoft,
      analyticsPalette.primaryMuted,
    ];

    const normalized = index / Math.max(1, total - 1);
    const paletteIndex = Math.min(rankedPalette.length - 1, Math.round(normalized * (rankedPalette.length - 1)));
    return rankedPalette[paletteIndex];
  }, [analyticsPalette]);

  const enriched = useMemo(
    () => (isActive ? (enrichedPurchases || enrichPurchasesWithScores(sourcePurchases, settings)) : EMPTY_LIST),
    [isActive, enrichedPurchases, sourcePurchases, settings]
  );

  const sortedAll = useMemo(() =>
    [...enriched].sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a)),
  [enriched]);

  const itemOptions = useMemo(() => {
    const byCode = {};
    sortedAll.forEach((p) => {
      if (!p.code) return;
      if (!byCode[p.code]) {
        byCode[p.code] = {
          code: p.code,
          name: p.name || p.code,
          count: 0,
          lastTime: getRecordTimestamp(p),
        };
      }
      byCode[p.code].count += 1;
      const currentTs = getRecordTimestamp(p);
      if (currentTs > byCode[p.code].lastTime) {
        byCode[p.code].lastTime = currentTs;
        byCode[p.code].name = p.name || byCode[p.code].name;
      }
    });

    return Object.values(byCode).sort((a, b) => {
      if (b.lastTime !== a.lastTime) return b.lastTime - a.lastTime;
      return b.count - a.count;
    });
  }, [sortedAll]);

  const availableBranches = useMemo(() => {
    const uniq = Array.from(new Set(sortedAll.map((p) => p.branch).filter(Boolean)));
    return uniq.sort((a, b) => String(a).localeCompare(String(b), 'ar'));
  }, [sortedAll]);

  useEffect(() => {
    if (selectedBranch === 'all') return;
    if (!availableBranches.includes(selectedBranch)) {
      setSelectedBranch('all');
    }
  }, [availableBranches, selectedBranch]);

  const timeFiltered = useMemo(() => {
    if (!sortedAll.length) return [];

    if (timeFilter === 'realtime') {
      return sortedAll;
    }

    const now = new Date().getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    if (timeFilter === 'weekly' || timeFilter === 'monthly') {
      const days = timeFilter === 'weekly' ? 7 : 30;
      const cutoff = now - (days * dayMs);
      return sortedAll
        .filter((p) => getRecordTimestamp(p) >= cutoff)
        .slice(0, MAX_ANALYTICS_HISTORY_ROWS);
    }

    const fromTs = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : 0;
    const toTs = customTo ? new Date(`${customTo}T23:59:59`).getTime() : now;
    return sortedAll.filter((p) => {
      const ts = getRecordTimestamp(p);
      return ts >= fromTs && ts <= toTs;
    }).slice(0, MAX_ANALYTICS_HISTORY_ROWS);
  }, [sortedAll, timeFilter, customFrom, customTo, MAX_ANALYTICS_HISTORY_ROWS]);

  const scopedByBranch = useMemo(() => {
    if (selectedBranch === 'all') return timeFiltered;
    return timeFiltered.filter((p) => p.branch === selectedBranch);
  }, [timeFiltered, selectedBranch]);

  const selectedItem = useMemo(() => {
    if (!selectedItemCode || selectedItemCode === 'all') return null;
    return itemOptions.find((x) => x.code === selectedItemCode) || null;
  }, [selectedItemCode, itemOptions]);

  const selectedItemOps = useMemo(() => {
    if (!selectedItemCode || selectedItemCode === 'all') return scopedByBranch;
    return scopedByBranch.filter((p) => p.code === selectedItemCode);
  }, [scopedByBranch, selectedItemCode]);

  const contextLabel = useMemo(() => {
    const itemText = selectedItemCode === 'all'
      ? (ar ? 'كل الأصناف' : 'All items')
      : (selectedItem?.name || (ar ? 'غير محدد' : 'Not selected'));
    const timeText = timeFilter === 'realtime'
      ? (ar ? 'كل العمليات حتى الآن' : 'All operations until now')
      : timeFilter === 'weekly'
        ? (ar ? 'آخر 7 أيام' : 'Last 7 days')
        : timeFilter === 'monthly'
          ? (ar ? 'آخر 30 يوم' : 'Last 30 days')
          : (ar ? `من ${customFrom} إلى ${customTo}` : `${customFrom} to ${customTo}`);
    const branchText = selectedBranch !== 'all'
      ? (ar ? ` — فرع ${selectedBranch}` : ` - Branch ${selectedBranch}`)
      : '';
    return ar ? `التحليل لـ: ${itemText} — ${timeText}${branchText}` : `Analytics for: ${itemText} - ${timeText}${branchText}`;
  }, [selectedItem, selectedItemCode, timeFilter, customFrom, customTo, selectedBranch, ar]);

  const trendData = useMemo(() => {
    const ordered = [...selectedItemOps]
      .map((p) => {
        const price = cleanPriceValue(p.price);
        const dateValue = getRecordTimestamp(p);
        return price !== null ? { ...p, price, dateValue } : null;
      })
      .filter(p => p !== null)
      .sort((a, b) => a.dateValue - b.dateValue);

    const limited = timeFilter === 'realtime' ? ordered : ordered.slice(-12);
    if (limited.length < 3) return [];

    return limited.map((p, idx) => ({
      tickLabel: isPhone
        ? `#${idx + 1}`
        : (() => {
            const raw = String(p.date || '').trim();
            const parts = raw.split('-');
            if (parts.length === 3) {
              const month = Number(parts[1]);
              const day = Number(parts[2]);
              if (Number.isFinite(month) && Number.isFinite(day)) return `${month}-${day}`;
            }
            return (p.date || `#${idx + 1}`).slice(5);
          })(),
      fullDate: p.date || (ar ? 'بدون تاريخ' : 'No date'),
      price: p.price,
    }));
  }, [selectedItemOps, ar, timeFilter, isPhone]);

  const trendChartWidth = useMemo(() => {
    if (timeFilter !== 'realtime') return null;
    const minWidth = isPhone ? 320 : 640;
    const pointWidth = isPhone ? 54 : 68;
    return Math.max(minWidth, trendData.length * pointWidth);
  }, [timeFilter, isPhone, trendData.length]);

  const supplierData = useMemo(() => {
    const byVendor = {};
    scopedByBranch.forEach(p => {
      if (!p.vendor) return;
      const total = getSafePurchaseTotal(p);
      if (total <= 0) return;
      if (!byVendor[p.vendor]) byVendor[p.vendor] = { totalSpend: 0, count: 0 };
      byVendor[p.vendor].totalSpend += total;
      byVendor[p.vendor].count += 1;
    });
    return Object.entries(byVendor)
      .map(([vendor, v]) => ({ vendor, totalSpend: Number(v.totalSpend.toFixed(2)), invoiceCount: v.count }))
      .filter(x => x.totalSpend > 0)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, isPhone ? 5 : 8);
  }, [scopedByBranch, isPhone]);

  const itemImpactData = useMemo(() => {
    const byItem = {};
    [...scopedByBranch]
      .sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b))
      .forEach((p) => {
        const price = cleanPriceValue(p.price);
        if (!p.code || price === null) return;
        if (!byItem[p.code]) byItem[p.code] = { code: p.code, name: p.name || p.code, prices: [] };
        byItem[p.code].prices.push(price);
      });

    return Object.values(byItem)
      .map((entry) => {
        if (entry.prices.length < 2) return null;
        const last = entry.prices[entry.prices.length - 1];
        const pricesWithoutLast = entry.prices.slice(0, -1);
        const avgWithoutLast = pricesWithoutLast.length > 0 
          ? pricesWithoutLast.reduce((s, v) => s + v, 0) / pricesWithoutLast.length
          : last;
        if (!avgWithoutLast) return null;
        const delta = last - avgWithoutLast;
        return {
          item: entry.name,
          code: entry.code,
          delta: Number(delta.toFixed(2)),
          status: delta > 0
            ? (ar ? 'أعلى من الطبيعي' : 'Above normal')
            : (ar ? 'أقل من الطبيعي' : 'Below normal'),
        };
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, isPhone ? 5 : 7);
      }, [scopedByBranch, ar, isPhone]);

  const branchData = useMemo(() => {
    if (availableBranches.length < 2) return [];
    const byBranch = {};
    scopedByBranch.forEach(p => {
      if (!p.branch) return;
      const total = getSafePurchaseTotal(p);
      if (total <= 0) return;
      if (!byBranch[p.branch]) byBranch[p.branch] = { totalSpend: 0, count: 0 };
      byBranch[p.branch].totalSpend += total;
      byBranch[p.branch].count += 1;
    });
    return Object.entries(byBranch)
      .map(([branch, v]) => ({ branch, totalSpend: Number(v.totalSpend.toFixed(2)), invoiceCount: v.count }))
      .filter(x => x.totalSpend > 0)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, isPhone ? 5 : 8);
  }, [scopedByBranch, availableBranches, isPhone]);

  const showTrendValueLabels = !isPhone || trendData.length <= 6;
  const showSupplierValueLabels = !isPhone || supplierData.length <= 5;
  const showItemValueLabels = !isPhone || itemImpactData.length <= 5;
  const showBranchValueLabels = !isPhone || branchData.length <= 5;

  const computeVerticalChartHeight = (count) => {
    const minH = isPhone ? 190 : 188;
    const rowH = isPhone ? 42 : 40;
    const maxH = isPhone ? 380 : 420;
    return Math.min(maxH, Math.max(minH, (count * rowH) + 26));
  };

  const branchChartHeight = computeVerticalChartHeight(branchData.length);
  const supplierChartHeight = computeVerticalChartHeight(supplierData.length);
  const itemChartHeight = computeVerticalChartHeight(itemImpactData.length);

  const supplierDomain = useMemo(() => {
    if (!supplierData.length) return [0, 100];
    const vals = supplierData.map((x) => Number(x.totalSpend)).filter(Number.isFinite);
    if (!vals.length) return [0, 100];
    const maxVal = vals.length > 0 ? Math.max(...vals) : 100;
    return [0, Math.ceil(maxVal * 1.1)];
  }, [supplierData]);

  const itemDomain = useMemo(() => {
    if (!itemImpactData.length) return [-10, 10];
    const vals = itemImpactData.map((x) => Number(x.delta)).filter(Number.isFinite);
    if (vals.length === 0) return [-10, 10];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const left = Math.floor(Math.min(-1, min - 1));
    const right = Math.ceil(Math.max(1, max + 1));
    return [left, right];
  }, [itemImpactData]);

  const branchDomain = useMemo(() => {
    if (!branchData.length) return [0, 100];
    const vals = branchData.map((x) => Number(x.totalSpend)).filter(Number.isFinite);
    if (!vals.length) return [0, 100];
    const maxVal = vals.length > 0 ? Math.max(...vals) : 100;
    return [0, Math.ceil(maxVal * 1.1)];
  }, [branchData]);

  const periodLabel = useMemo(() => {
    if (timeFilter === 'realtime') return ar ? 'كل العمليات حتى الآن' : 'All operations until now';
    if (timeFilter === 'weekly') return ar ? 'آخر 7 أيام' : 'Last 7 days';
    if (timeFilter === 'monthly') return ar ? 'آخر 30 يوم' : 'Last 30 days';
    return ar ? `من ${customFrom} إلى ${customTo}` : `${customFrom} to ${customTo}`;
  }, [timeFilter, customFrom, customTo, ar]);

  const drilldownInvoices = useMemo(() => {
    if (!drilldown) return [];

    let base = timeFiltered;
    if (drilldown.type === 'item') {
      base = scopedByBranch.filter((p) => p.code === drilldown.code);
    } else if (drilldown.type === 'supplier') {
      base = scopedByBranch.filter((p) => p.vendor === drilldown.vendor);
    } else if (drilldown.type === 'branch') {
      base = timeFiltered.filter((p) => p.branch === drilldown.branch);
    }

    return [...base]
      .map((p) => {
        const price = cleanPriceValue(p.price);
        if (price === null) return null;
        const qty = Number(p.qty) || 1;
        const ts = getRecordTimestamp(p);
        return {
          ...p,
          price,
          qty,
          totalSafe: getSafePurchaseTotal(p),
          ts,
        };
      })
      .filter((p) => p !== null)
      .sort((a, b) => b.ts - a.ts);
  }, [drilldown, scopedByBranch, timeFiltered]);

  const drilldownSummary = useMemo(() => {
    if (!drilldown || drilldownInvoices.length === 0) return null;

    const invoiceCount = drilldownInvoices.length;
    const totalSpend = drilldownInvoices.reduce((sum, row) => sum + row.totalSafe, 0);

    const byVendor = {};
    drilldownInvoices.forEach((row) => {
      if (!row.vendor) return;
      if (!byVendor[row.vendor]) byVendor[row.vendor] = [];
      byVendor[row.vendor].push(row.price);
    });

    let bestVendor = null;
    Object.entries(byVendor).forEach(([vendor, prices]) => {
      if (!prices.length) return;
      const avg = prices.reduce((s, v) => s + v, 0) / prices.length;
      if (!bestVendor || avg < bestVendor.avg) {
        bestVendor = { vendor, avg };
      }
    });

    const lastInvoice = drilldownInvoices[0] || null;

    return {
      invoiceCount,
      totalSpend,
      bestVendor,
      lastInvoice,
    };
  }, [drilldown, drilldownInvoices]);

  const openItemDrilldown = useCallback((entry) => {
    if (!entry?.code) return;
    setDrilldown({ type: 'item', code: entry.code, label: entry.item || entry.code });
  }, []);

  const openSupplierDrilldown = useCallback((entry) => {
    if (!entry?.vendor) return;
    setDrilldown({ type: 'supplier', vendor: entry.vendor, label: entry.vendor });
  }, []);

  const openBranchDrilldown = useCallback((entry) => {
    if (!entry?.branch) return;
    setDrilldown({ type: 'branch', branch: entry.branch, label: entry.branch });
  }, []);

  const yAxisLabelWidth = useMemo(() => {
    const labels = [
      ...supplierData.map((x) => x?.vendor),
      ...itemImpactData.map((x) => x?.item),
      ...branchData.map((x) => x?.branch),
    ]
      .map((v) => String(v || '').trim())
      .filter(Boolean);

    const maxChars = labels.reduce((m, label) => Math.max(m, label.length), 8);
    const pxPerChar = isPhone ? 6.6 : isTablet ? 6.3 : 6.1;
    const raw = Math.round((maxChars * pxPerChar) + (isPhone ? 8 : 12));

    if (isPhone) return Math.min(170, Math.max(74, raw));
    if (isTablet) return Math.min(136, Math.max(82, raw));
    return Math.min(132, Math.max(78, raw));
  }, [supplierData, itemImpactData, branchData, isPhone, isTablet]);

  const formatAxisName = useCallback((value) => {
    const text = String(value || '').trim();
    if (!text) return '';
    return text;
  }, []);

  const verticalChartMinWidth = useMemo(() => {
    if (!isPhone) return null;
    const estimatedAvailableWidth = Math.max(320, viewportWidth - 42);
    const requiredWidth = Math.max(320, yAxisLabelWidth + 220);
    return requiredWidth > estimatedAvailableWidth ? requiredWidth : null;
  }, [isPhone, viewportWidth, yAxisLabelWidth]);

  const supplierYAxisLabelWidth = useMemo(() => {
    const labels = supplierData
      .map((entry) => String(entry?.vendor || '').trim())
      .filter(Boolean);
    const maxChars = labels.reduce((m, label) => Math.max(m, label.length), 8);
    const pxPerChar = isPhone ? 6.9 : isTablet ? 6.5 : 6.2;
    const raw = Math.round((maxChars * pxPerChar) + (isPhone ? 18 : 16));

    if (isPhone) return Math.min(184, Math.max(90, raw));
    if (isTablet) return Math.min(148, Math.max(92, raw));
    return Math.min(140, Math.max(88, raw));
  }, [supplierData, isPhone, isTablet]);

  const supplierChartMinWidth = useMemo(() => {
    if (!isPhone) return null;
    const estimatedAvailableWidth = Math.max(320, viewportWidth - 42);
    const requiredWidth = Math.max(320, supplierYAxisLabelWidth + 220);
    return requiredWidth > estimatedAvailableWidth ? requiredWidth : null;
  }, [isPhone, viewportWidth, supplierYAxisLabelWidth]);

  const renderLeftAlignedAxisTick = useCallback((props) => {
    const { x, y, payload } = props || {};
    const text = formatAxisName(payload?.value);
    if (!text) return null;

    const labelX = Number(x) - yAxisLabelWidth + 12;
    const labelY = Number(y) + 4;

    return (
      <text
        x={labelX}
        y={labelY}
        textAnchor="start"
        fontSize={isPhone ? 9 : 10}
        fontWeight={700}
        fill="#475569"
      >
        {text}
      </text>
    );
  }, [formatAxisName, yAxisLabelWidth, isPhone]);

  const renderSupplierAxisTick = useCallback((props) => {
    const { x, y, payload } = props || {};
    const text = formatAxisName(payload?.value);
    if (!text) return null;

    const labelX = Number(x) - supplierYAxisLabelWidth + 12;
    const labelY = Number(y) + 4;

    return (
      <text
        x={labelX}
        y={labelY}
        textAnchor="start"
        fontSize={isPhone ? 9 : 10}
        fontWeight={700}
        fill="#475569"
      >
        {text}
      </text>
    );
  }, [formatAxisName, supplierYAxisLabelWidth, isPhone]);

  const renderSupplierDiffLabel = (props) => {
    const { x, y, width, height, value } = props || {};
    const n = Number(value);
    if (!Number.isFinite(n)) return null;

    const text = `${formatSmartNumber(n, isPhone ? 0 : 1)}`;
    const cx = Number(x) + (Number(width) / 2);
    const cy = Number(y) + (Number(height) / 2) + 3;

    return (
      <text x={cx} y={cy} textAnchor="middle" fontSize={isPhone ? 9 : 10} fontWeight={900} fill="#ffffff">
        {text}
      </text>
    );
  };

  const renderItemDiffLabel = (props) => {
    const { x, y, width, height, value } = props || {};
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const text = `${n > 0 ? '+' : ''}${formatSmartNumber(n, isPhone ? 0 : 1)}`;
    const cx = Number(x) + (Number(width) / 2);
    const cy = Number(y) + (Number(height) / 2) + 3;
    return (
      <text x={cx} y={cy} textAnchor="middle" fontSize={isPhone ? 8 : 9} fontWeight={900} fill="#ffffff">
        {text}
      </text>
    );
  };

  return (
    <>
    <div className="space-y-5 md:space-y-6 animate-in fade-in duration-500">
      <div className="elevated-card p-5 md:p-6 bg-gradient-to-r from-slate-800 to-slate-700 text-white border border-slate-700/70 shadow-md">
        <div className="mb-4 pb-3 border-b border-white/15">
          <h3 className="text-xl md:text-2xl font-bold leading-tight">{ar ? 'التحليل' : 'Analytics'}</h3>
          <p className="text-sm text-slate-200 mt-1">{contextLabel}</p>
        </div>
        <div className="grid grid-cols-1 laptop:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-2">{ar ? 'الزمن' : 'Time range'}</p>
            <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-2 pb-1">
              {[
                { key: 'realtime', ar: 'حتى الآن', en: 'Until now' },
                { key: 'weekly', ar: 'أسبوعي', en: 'Weekly' },
                { key: 'monthly', ar: 'شهري', en: 'Monthly' },
                { key: 'custom', ar: 'مخصص', en: 'Custom' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setTimeFilter(opt.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-md text-sm font-semibold border transition-colors ${timeFilter === opt.key ? 'bg-white text-slate-800 border-white shadow-sm' : 'bg-white/8 text-white border-white/20 hover:bg-white/15'}`}
                >
                  {ar ? opt.ar : opt.en}
                </button>
              ))}
            </div>
            {timeFilter === 'custom' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="input-field !py-2 !bg-white !text-slate-800 w-full phone:w-auto" />
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="input-field !py-2 !bg-white !text-slate-800 w-full phone:w-auto" />
              </div>
            )}
          </div>

          {availableBranches.length > 1 && (
            <div>
              <p className="text-sm font-semibold text-slate-200 mb-2">{ar ? 'الفرع' : 'Branch'}</p>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="input-field !py-2.5 !bg-white !text-slate-800"
              >
                <option value="all">{ar ? 'كل الفروع' : 'All branches'}</option>
                {availableBranches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>


      {/* Price Trend card — item filter lives here only */}
      <div className="elevated-card p-5 md:p-6 bg-gradient-to-br from-white to-slate-50/70 border border-slate-200 shadow-md">
        <div className="mb-4 pb-2 border-b border-slate-100">
          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp size={18} className="text-slate-600"/>
            {ar ? 'اتجاه السعر' : 'Price Trend'}
          </h4>
          <p className="text-sm text-slate-500 mt-1">{ar ? 'التركيز على حركة السعر عبر الزمن' : 'Focus on price movement over time'}</p>
        </div>

        <div className="mb-4">
          <div>
            <p className="text-sm font-semibold text-slate-600 mb-2">{ar ? 'فلترة الصنف' : 'Item Filter'}</p>
            <select
              value={selectedItemCode}
              onChange={(e) => setSelectedItemCode(e.target.value)}
              className="input-field !py-2.5"
            >
              <option value="all">{ar ? 'كل الأصناف' : 'All items'}</option>
              {itemOptions.map((x) => <option key={x.code} value={x.code}>{x.name} (#{x.code})</option>)}
            </select>
          </div>
        </div>

        {selectedItemOps.length === 0 && (
          <p className="text-sm font-black text-slate-400 text-center py-8">{ar ? 'لا توجد بيانات كافية في هذه الفترة' : 'Not enough data in this range'}</p>
        )}
        {selectedItemOps.length > 0 && (
          <>
            {!trendData.length && <p className="text-xs font-bold text-slate-500 mb-3">{ar ? 'البيانات غير كافية للعرض' : 'Not enough data to display'}</p>}
            {timeFilter === 'realtime' ? (
              <div className="overflow-x-auto pb-2">
                <div style={{ width: trendChartWidth ? `${trendChartWidth}px` : '100%', minWidth: '100%' }}>
                  <ResponsiveContainer width="100%" height={isPhone ? 216 : 244}>
                    <LineChart data={trendData} margin={{top: isPhone ? 14 : 18, right: isPhone ? 14 : 20, left: isPhone ? 10 : 14, bottom: isPhone ? 18 : 14}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={analyticsPalette.grid}/>
                      <XAxis dataKey="tickLabel" interval={0} tick={{fontSize:isPhone ? 10 : 11, fontWeight:700}} axisLine={false} tickLine={false} tickMargin={isPhone ? 10 : 8} minTickGap={isPhone ? 18 : 12}/>
                      <YAxis tick={{fontSize:isPhone ? 10 : 11, fontWeight:700}} axisLine={false} tickLine={false} width={isPhone ? 56 : 64}/>
                      <RechartsTooltip
                        contentStyle={{borderRadius:'14px', border:'1px solid #dbe3ed', backgroundColor:'rgba(255,255,255,0.97)', padding:'10px 12px', boxShadow:'0 14px 30px rgba(28,42,61,0.10)'}}
                        formatter={(v) => [`${formatSmartNumber(v, 2)} ${t('currency')}`, ar ? 'السعر' : 'Price']}
                        labelFormatter={(_, payload) => {
                          const d = payload && payload[0] && payload[0].payload ? payload[0].payload.fullDate : '';
                          return ar ? `التاريخ: ${d}` : `Date: ${d}`;
                        }}
                      />
                      <Line type="monotone" dataKey="price" stroke={analyticsPalette.primary} strokeWidth={isPhone ? 2.2 : 2.7} dot={{r:isPhone ? 2.3 : 3.2, fill:analyticsPalette.primary, stroke:'#fff', strokeWidth:2}} activeDot={{r:isPhone ? 4.2 : 5.2, fill: analyticsPalette.primaryDark, stroke: '#fff', strokeWidth: 2}}>
                        {showTrendValueLabels && <LabelList dataKey="price" position="top" formatter={(v) => formatSmartNumber(v, isPhone ? 0 : 1)} style={{ fontSize: isPhone ? 8 : 9, fontWeight: 800, fill: analyticsPalette.primaryDark }} />}
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
            <ResponsiveContainer width="100%" height={isPhone ? 216 : 244}>
              <LineChart data={trendData} margin={{top: isPhone ? 14 : 18, right: isPhone ? 14 : 20, left: isPhone ? 10 : 14, bottom: isPhone ? 18 : 14}}>
                <CartesianGrid strokeDasharray="3 3" stroke={analyticsPalette.grid}/>
                <XAxis dataKey="tickLabel" interval={isPhone ? 'preserveStartEnd' : 0} tick={{fontSize:isPhone ? 10 : 11, fontWeight:700}} axisLine={false} tickLine={false} tickMargin={isPhone ? 10 : 8} minTickGap={isPhone ? 34 : 18}/>
                <YAxis tick={{fontSize:isPhone ? 10 : 11, fontWeight:700}} axisLine={false} tickLine={false} width={isPhone ? 56 : 64}/>
                <RechartsTooltip
                  contentStyle={{borderRadius:'14px', border:'1px solid #dbe3ed', backgroundColor:'rgba(255,255,255,0.97)', padding:'10px 12px', boxShadow:'0 14px 30px rgba(28,42,61,0.10)'}}
                  formatter={(v) => [`${formatSmartNumber(v, 2)} ${t('currency')}`, ar ? 'السعر' : 'Price']}
                  labelFormatter={(_, payload) => {
                    const d = payload && payload[0] && payload[0].payload ? payload[0].payload.fullDate : '';
                    return ar ? `التاريخ: ${d}` : `Date: ${d}`;
                  }}
                />
                <Line type="monotone" dataKey="price" stroke={analyticsPalette.primary} strokeWidth={isPhone ? 2.2 : 2.7} dot={{r:isPhone ? 2.3 : 3.2, fill:analyticsPalette.primary, stroke:'#fff', strokeWidth:2}} activeDot={{r:isPhone ? 4.2 : 5.2, fill: analyticsPalette.primaryDark, stroke: '#fff', strokeWidth: 2}}>
                  {showTrendValueLabels && <LabelList dataKey="price" position="top" formatter={(v) => formatSmartNumber(v, isPhone ? 0 : 1)} style={{ fontSize: isPhone ? 8 : 9, fontWeight: 800, fill: analyticsPalette.primaryDark }} />}
                </Line>
              </LineChart>
            </ResponsiveContainer>
            )}
            {timeFilter === 'realtime' && trendData.length > 8 && (
              <p className="mt-2 text-[11px] font-semibold text-slate-500 text-center flex items-center justify-center gap-1">
                <ChevronsRight size={14} className="text-slate-400" />
                {ar ? 'اسحب أفقيا لعرض جميع النقاط' : 'Scroll horizontally to view all points'}
                <ChevronsLeft size={14} className="text-slate-400" />
              </p>
            )}
          </>
        )}
      </div>

      {/* Global charts — not filtered by item */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        {/* Supplier Comparison */}
        <div className="elevated-card p-4 md:p-5 bg-gradient-to-br from-white to-slate-50/60 border border-slate-200">
          <h4 className="text-base md:text-lg font-bold text-slate-900 mb-1 flex items-center gap-2"><Store size={18} className="text-slate-600"/> {ar ? 'مقارنة الموردين' : 'Supplier Comparison'}</h4>
          <div className="mt-2 mb-3 flex flex-wrap gap-2 text-sm font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">{ar ? 'إجمالي الإنفاق لكل مورد' : 'Total spend per supplier'}</span>
          </div>
          {!supplierData.length && <p className="text-xs font-bold text-slate-500 mb-3">{ar ? 'البيانات غير كافية للعرض' : 'Not enough data to display'}</p>}
          <div dir="ltr" className={`w-full ${supplierChartMinWidth ? 'overflow-x-auto pb-2' : ''}`}>
          <div className="w-full" style={{ minWidth: supplierChartMinWidth ? `${supplierChartMinWidth}px` : '100%' }}>
          <ResponsiveContainer width="100%" height={supplierChartHeight + (isPhone ? 24 : 8)}>
            <BarChart data={supplierData} margin={{top:6, right:isPhone ? 10 : 16, left:isPhone ? 6 : 8, bottom:isPhone ? 24 : 6}} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={analyticsPalette.grid} horizontal={false}/>
              <XAxis
                type="number"
                domain={supplierDomain}
                tick={{fontSize:isPhone ? 10 : 11, fontWeight:700}}
                axisLine={false}
                tickLine={false}
                tickCount={isPhone ? 3 : 6}
                tickFormatter={(v) => isPhone ? formatSmartNumber(v, 0) : `${formatSmartNumber(v, 0)} ${t('currency')}`}
              />
              <YAxis
                type="category"
                dataKey="vendor"
                tick={renderSupplierAxisTick}
                axisLine={false}
                tickLine={false}
                width={supplierYAxisLabelWidth}
                interval={0}
                tickMargin={0}
              />
              <RechartsTooltip
                contentStyle={{borderRadius:'14px', border:'1px solid #dbe3ed', backgroundColor:'rgba(255,255,255,0.97)', padding:'10px 12px', boxShadow:'0 14px 30px rgba(28,42,61,0.10)'}}
                formatter={(v, _, payload) => {
                  const item = payload && payload.payload ? payload.payload : null;
                  return [
                    `${formatSmartNumber(v, 0)} ${t('currency')}`,
                    ar ? `${'\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0625\u0646\u0641\u0627\u0642'}${item?.invoiceCount ? ` | ${item.invoiceCount} ${'\u0641\u0627\u062a\u0648\u0631\u0629'}` : ''}` : `Total spend${item?.invoiceCount ? ` | ${item.invoiceCount} invoices` : ''}`
                  ];
                }}
              />
              <Bar dataKey="totalSpend" radius={[0,8,8,0]} maxBarSize={isPhone ? 13 : 16} onClick={(data) => openSupplierDrilldown(data?.payload)}>
                {supplierData.map((_, i) => <Cell key={i} fill={getRankedMutedTone(i, supplierData.length)} cursor="pointer" />)}
                {showSupplierValueLabels && <LabelList dataKey="totalSpend" content={renderSupplierDiffLabel} />}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
          </div>
        </div>

        {/* Item Analysis */}
        <div className="elevated-card p-4 md:p-5 bg-gradient-to-br from-slate-50/90 to-white border border-slate-200">
          <h4 className="text-base md:text-lg font-bold text-slate-900 mb-1 flex items-center gap-2"><BarChart3 size={18} className="text-slate-600"/> {ar ? 'الأصناف المؤثرة' : 'Item Analysis'}</h4>
          <p className="text-sm font-medium text-slate-500 mb-2">{ar ? 'اضغط على أي عمود لعرض الفواتير' : 'Tap any bar to view invoices'}</p>
          <div className="mt-2 mb-3 flex flex-wrap gap-2 text-sm font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: analyticsPalette.warning }}/> {ar ? 'أعلى من الطبيعي' : 'Above normal'}</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: analyticsPalette.positive }}/> {ar ? 'أقل من الطبيعي' : 'Below normal'}</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: analyticsPalette.neutral }}/> {ar ? 'المستوى الطبيعي' : 'Normal level'}</span>
          </div>
          {!itemImpactData.length && <p className="text-xs font-bold text-slate-500 mb-3">{ar ? 'البيانات غير كافية للعرض' : 'Not enough data to display'}</p>}
          <div dir="ltr" className={`w-full ${verticalChartMinWidth ? 'overflow-x-auto pb-2' : ''}`}>
          <div className="w-full" style={{ minWidth: verticalChartMinWidth ? `${verticalChartMinWidth}px` : '100%' }}>
          <ResponsiveContainer width="100%" height={itemChartHeight + (isPhone ? 24 : 8)}>
            <BarChart data={itemImpactData} margin={{top:6, right:isPhone ? 10 : 16, left:isPhone ? 6 : 8, bottom:isPhone ? 24 : 6}} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={analyticsPalette.grid} horizontal={false}/>
              <XAxis
                type="number"
                domain={itemDomain}
                tick={{fontSize:isPhone ? 10 : 11, fontWeight:700}}
                axisLine={false}
                tickLine={false}
                tickCount={isPhone ? 3 : 6}
                tickFormatter={(v) => isPhone ? formatSmartNumber(v, 0) : `${formatSmartNumber(v, 0)} ${t('currency')}`}
              />
              <YAxis
                type="category"
                dataKey="item"
                tick={renderLeftAlignedAxisTick}
                axisLine={false}
                tickLine={false}
                width={yAxisLabelWidth}
                interval={0}
                tickMargin={0}
              />
              <RechartsTooltip
                contentStyle={{borderRadius:'14px', border:'1px solid #dbe3ed', backgroundColor:'rgba(255,255,255,0.97)', padding:'10px 12px', boxShadow:'0 14px 30px rgba(28,42,61,0.10)'}}
                formatter={(v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n)) return [v, ar ? 'قيمة الفرق' : 'Difference value'];
                  return [`${formatSmartNumber(n, 2)} ${t('currency')}`, ar ? 'قيمة الفرق' : 'Difference value'];
                }}
              />
              <Bar dataKey="delta" radius={[0,8,8,0]} maxBarSize={isPhone ? 13 : 16} onClick={(data) => openItemDrilldown(data?.payload)}>
                {itemImpactData.map((entry, i) => (
                  <Cell key={i} fill={entry.delta > 0 ? analyticsPalette.warning : entry.delta < 0 ? analyticsPalette.positive : analyticsPalette.neutral} cursor="pointer" />
                ))}
                {showItemValueLabels && <LabelList dataKey="delta" content={renderItemDiffLabel} />}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
          </div>
        </div>

        {/* Branch Comparison */}
        {availableBranches.length > 1 && selectedBranch === 'all' && branchData.length > 1 && (
          <div className="elevated-card p-4 md:p-5 bg-gradient-to-br from-slate-50/90 to-white border border-slate-200 lg:col-span-2">
            <h4 className="text-base md:text-lg font-bold text-slate-900 mb-1 flex items-center gap-2"><MapPin size={18} className="text-slate-600"/> {ar ? 'مقارنة الفروع' : 'Branch Comparison'}</h4>
            <p className="text-sm font-medium text-slate-500 mb-2">{ar ? 'اضغط على أي فرع لعرض فواتيره' : 'Tap any branch to view invoices'}</p>
            <div className="mt-2 mb-3 flex flex-wrap gap-2 text-sm font-medium text-slate-600">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">{ar ? 'إجمالي الإنفاق لكل فرع' : 'Total spend per branch'}</span>
            </div>
            {!branchData.length && <p className="text-xs font-bold text-slate-500 mb-3">{ar ? 'البيانات غير كافية للعرض' : 'Not enough data to display'}</p>}
            <div dir="ltr" className={`w-full ${verticalChartMinWidth ? 'overflow-x-auto pb-2' : ''}`}>
            <div className="w-full" style={{ minWidth: verticalChartMinWidth ? `${verticalChartMinWidth}px` : '100%' }}>
            <ResponsiveContainer width="100%" height={branchChartHeight + (isPhone ? 24 : 8)}>
              <BarChart data={branchData} margin={{top:6, right:isPhone ? 10 : 16, left:isPhone ? 6 : 8, bottom:isPhone ? 24 : 6}} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={analyticsPalette.grid} horizontal={false}/>
                <XAxis
                  type="number"
                  domain={branchDomain}
                  tick={{fontSize:isPhone ? 10 : 11, fontWeight:700}}
                  axisLine={false}
                  tickLine={false}
                  tickCount={isPhone ? 3 : 6}
                  tickFormatter={(v) => isPhone ? formatSmartNumber(v, 0) : `${formatSmartNumber(v, 0)} ${t('currency')}`}
                />
                <YAxis
                  type="category"
                  dataKey="branch"
                  tick={renderLeftAlignedAxisTick}
                  axisLine={false}
                  tickLine={false}
                  width={yAxisLabelWidth}
                  interval={0}
                  tickMargin={0}
                />
                <RechartsTooltip
                  contentStyle={{borderRadius:'14px', border:'1px solid #dbe3ed', backgroundColor:'rgba(255,255,255,0.97)', padding:'10px 12px', boxShadow:'0 14px 30px rgba(28,42,61,0.10)'}}
                  formatter={(v, _, payload) => {
                    const item = payload && payload.payload ? payload.payload : null;
                    return [
                      `${formatSmartNumber(v, 0)} ${t('currency')}`,
                      ar ? `${'\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0625\u0646\u0641\u0627\u0642'}${item?.invoiceCount ? ` | ${item.invoiceCount} ${'\u0641\u0627\u062a\u0648\u0631\u0629'}` : ''}` : `Total spend${item?.invoiceCount ? ` | ${item.invoiceCount} invoices` : ''}`
                    ];
                  }}
                />
                <Bar dataKey="totalSpend" radius={[0,8,8,0]} maxBarSize={isPhone ? 13 : 16} onClick={(data) => openBranchDrilldown(data?.payload)}>
                  {branchData.map((_, i) => <Cell key={i} fill={getRankedMutedTone(i, branchData.length)} />)}
                  {showBranchValueLabels && <LabelList dataKey="totalSpend" content={renderSupplierDiffLabel} />}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
    {drilldown && (
      <div className="fixed inset-0 z-[120] bg-slate-900/35 backdrop-blur-[1px]" onClick={() => setDrilldown(null)}>
        <aside
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-2 phone:inset-3 tablet:top-4 tablet:bottom-4 tablet:right-4 tablet:left-4 laptop:left-auto laptop:max-w-[860px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-left-2 duration-300"
        >
          <div className="px-4 phone:px-5 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {drilldown.type === 'item'
                    ? (ar ? 'تفاصيل الصنف' : 'Item Drilldown')
                    : drilldown.type === 'supplier'
                      ? (ar ? 'تفاصيل المورد' : 'Supplier Drilldown')
                      : (ar ? 'تفاصيل الفرع' : 'Branch Drilldown')}
                </p>
                <h4 className="text-lg font-black text-slate-800 leading-tight break-words">{drilldown.label}</h4>
                <p className="text-xs font-bold text-slate-500 mt-1">{ar ? `الفترة: ${periodLabel}` : `Period: ${periodLabel}`}</p>
              </div>
              <button
                onClick={() => setDrilldown(null)}
                className="btn-surface px-3 py-1.5 rounded-lg text-xs font-black bg-slate-200 text-slate-700 hover:bg-slate-300"
              >
                {ar ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>

          <div className="p-3 phone:p-5 space-y-4 overflow-y-auto flex-1">
            {drilldownSummary ? (
              <>
                <div className="grid grid-cols-1 phone:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase">{ar ? 'عدد الفواتير' : 'Invoices'}</p>
                    <p className="text-2xl font-black tracking-tight text-slate-900 mt-1">{drilldownSummary.invoiceCount}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase">{ar ? 'إجمالي المبلغ' : 'Total Spend'}</p>
                    <p className="text-2xl font-black tracking-tight text-slate-900 mt-1">{formatSmartNumber(drilldownSummary.totalSpend, 0)}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">{t('currency')}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase">{ar ? 'أفضل مورد' : 'Best Supplier'}</p>
                    <p className="text-sm font-black text-slate-800 mt-1 break-words">{cleanVendorLabel(drilldownSummary.bestVendor?.vendor)}</p>
                    {drilldownSummary.bestVendor?.avg != null && (
                      <p className="text-[11px] font-bold text-emerald-700 mt-1">{formatSmartNumber(drilldownSummary.bestVendor.avg, 1)} {t('currency')}</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase">{ar ? 'آخر عملية شراء' : 'Last Purchase'}</p>
                    <p className="text-sm font-black text-slate-800 mt-1">{formatDateDisplay(drilldownSummary.lastInvoice?.date)}</p>
                    <p className="text-[11px] font-bold text-blue-700 mt-1">{formatSmartNumber(drilldownSummary.lastInvoice?.price, 1)} {t('currency')}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">{ar ? `الفرع: ${drilldownSummary.lastInvoice?.branch || '—'}` : `Branch: ${drilldownSummary.lastInvoice?.branch || '—'}`}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-xs font-black text-slate-700">{ar ? 'الفواتير المرتبطة' : 'Related Invoices'}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-xs">
                      <thead className="bg-white border-b border-slate-100 text-slate-500">
                        <tr>
                          <th className="px-2 py-2 text-start font-black">{t('date')}</th>
                          {drilldown.type !== 'branch' && <th className="px-2 py-2 text-start font-black">{t('branch')}</th>}
                          {drilldown.type !== 'supplier' && <th className="px-2 py-2 text-start font-black">{t('vendor')}</th>}
                          {drilldown.type !== 'item' && <th className="px-2 py-2 text-start font-black">{t('item')}</th>}
                          <th className="px-2 py-2 text-start font-black">{t('price')}</th>
                          <th className="px-2 py-2 text-start font-black">{t('decision')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drilldownInvoices.map((row) => (
                          <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-2 py-2 font-bold text-slate-600 whitespace-nowrap">{formatDateDisplay(row.date)}</td>
                            {drilldown.type !== 'branch' && <td className="px-2 py-2 font-bold text-slate-700">{row.branch || '—'}</td>}
                            {drilldown.type !== 'supplier' && <td className="px-2 py-2 font-bold text-slate-700">{cleanVendorLabel(row.vendor)}</td>}
                            {drilldown.type !== 'item' && <td className="px-2 py-2 font-black text-slate-800">{cleanItemLabel(row.name, row.code)}</td>}
                            <td className="px-2 py-2 font-black text-blue-700">{formatSmartNumber(row.price, 2)}</td>
                            <td className="px-2 py-2">
                              <span className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-black border ${row.grade === 'A' || row.grade === 'A+' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : row.grade === 'B' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                {ar
                                  ? (row.decisionAr || row.decisionEn || getLocalizedDecisionLabel(row.grade || row.status, true))
                                  : (row.decisionEn || row.decisionAr || getLocalizedDecisionLabel(row.grade || row.status, false))}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">
                {ar ? 'لا توجد فواتير ضمن هذا السياق' : 'No invoices found for this context'}
              </div>
            )}
          </div>
        </aside>
      </div>
    )}
    </>
  );
}
// ==========================================
// MASTER DATA VIEW
// ==========================================
function MasterDataView({ items, branches, vendors, showMsg, t, lang, engineSettings, setEngineSettings }) {
  const ar = lang === 'ar';
  const [tab, setTab] = useState('items');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [localSettings, setLocalSettings] = useState(() => ({ ...DEFAULT_ENGINE_SETTINGS, ...engineSettings }));
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingPrice, setEditingPrice] = useState('');

  const nextItemCode = useMemo(() => {
    const codes = items.map(x => parseInt(x.code, 10)).filter(n => !isNaN(n));
    const max = codes.length ? Math.max(...codes) : 0;
    return String(max + 1).padStart(3, '0');
  }, [items]);

  const activeRecords = tab === 'items' ? items : tab === 'vendors' ? vendors : branches;
  const filteredActiveRecords = useMemo(() => {
    const q = String(searchTerm || '').trim().toLowerCase();
    if (!q) return activeRecords;
    return activeRecords.filter((record) => {
      const nameText = String(record?.name || '').toLowerCase();
      const codeText = String(record?.code || '').toLowerCase();
      return nameText.includes(q) || codeText.includes(q);
    });
  }, [activeRecords, searchTerm]);
  const normalizeMasterName = useCallback((value) => String(value || '').trim().toLowerCase(), []);
  const hasDuplicateName = useCallback((candidate, excludeId = null) => {
    const normalizedCandidate = normalizeMasterName(candidate);
    if (!normalizedCandidate) return false;
    return activeRecords.some((record) => normalizeMasterName(record.name) === normalizedCandidate && record.id !== excludeId);
  }, [activeRecords, normalizeMasterName]);

  const weightSum = localSettings.priceWeight + localSettings.consistencyWeight + localSettings.trendWeight;
  const weightsValid = weightSum === 100;
  const thresholdsValid = localSettings.gradeA > localSettings.gradeB && localSettings.gradeB > localSettings.gradeC;

  const handleSaveSettings = () => {
    if (!weightsValid || !thresholdsValid) return;
    setEngineSettings(localSettings);
    showMsg(
      ar ? '✓ الإعدادات محفوظة' : '✓ Settings Saved',
      'success',
      ar ? 'تم تحديث أوزان وعتبات الدرجات' : 'Scoring engine updated'
    );
  };

  const resetSettings = () => {
    setLocalSettings({ ...DEFAULT_ENGINE_SETTINGS });
  };

  const handleAdd = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (hasDuplicateName(trimmedName)) {
      showMsg(
        ar ? 'الاسم مكرر' : 'Duplicate name',
        'warning',
        ar ? 'يوجد سجل بنفس الاسم بالفعل' : 'A record with the same name already exists'
      );
      return;
    }
    try {
      let typeLabel = '';
      if (tab === 'items') {
        await addDoc(collection(db, 'items'), { name: trimmedName, code: nextItemCode, initialPrice: Number(price) || 0 });
        typeLabel = ar ? 'مادة جديدة' : 'New item';
      } else if (tab === 'vendors') {
        await addDoc(collection(db, 'vendors'), { name: trimmedName });
        typeLabel = ar ? 'مورد جديد' : 'New vendor';
      } else if (tab === 'branches') {
        await addDoc(collection(db, 'branches'), { name: trimmedName });
        typeLabel = ar ? 'فرع جديد' : 'New branch';
      }
      setName('');
      setPrice('');
      showMsg(
        ar ? '✓ تمت الإضافة' : '✓ Added',
        'success',
        `${typeLabel}: ${trimmedName}`
      );
    } catch {
      showMsg(
        ar ? '❌ فشلت الإضافة' : '❌ Add Failed',
        'error',
        ar ? 'تعذر الوصول إلى قاعدة البيانات' : 'Database error'
      );
    }
  };

  const startEditing = (record) => {
    setEditingId(record.id);
    setEditingName(record.name || '');
    setEditingPrice(record.initialPrice != null ? String(record.initialPrice) : '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
    setEditingPrice('');
  };

  const handleEditSave = async (record) => {
    const trimmedName = editingName.trim();
    if (!trimmedName) return;
    if (hasDuplicateName(trimmedName, record.id)) {
      showMsg(
        ar ? 'الاسم مكرر' : 'Duplicate name',
        'warning',
        ar ? 'يوجد سجل آخر بنفس الاسم، اختر اسمًا مختلفًا' : 'Another record already uses this name'
      );
      return;
    }

    try {
      const payload = { name: trimmedName };
      if (tab === 'items') {
        payload.initialPrice = Number(editingPrice) || 0;
      }

      await updateDoc(doc(db, tab, record.id), payload);
      showMsg(
        ar ? '✓ تم التعديل' : '✓ Updated',
        'success',
        ar ? `تم تحديث ${trimmedName}` : `${trimmedName} updated successfully`
      );
      cancelEditing();
    } catch {
      showMsg(
        ar ? '❌ فشل التعديل' : '❌ Update Failed',
        'error',
        ar ? 'تعذر حفظ التغييرات في قاعدة البيانات' : 'Could not save changes to database'
      );
    }
  };

  const handleDeleteRecord = async (record) => {
    const label = record?.name || record?.code || (ar ? 'هذا السجل' : 'this record');
    const confirmed = confirm(
      ar
        ? `هل أنت متأكد من حذف ${label}؟`
        : `Are you sure you want to delete ${label}?`
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, tab, record.id));
      if (editingId === record.id) cancelEditing();
      showMsg(
        ar ? '✓ تم الحذف' : '✓ Deleted',
        'success',
        ar ? `تم حذف ${label}` : `${label} deleted successfully`
      );
    } catch {
      showMsg(
        ar ? '❌ فشل الحذف' : '❌ Delete Failed',
        'error',
        ar ? 'تعذر حذف السجل من قاعدة البيانات' : 'Could not delete the record from database'
      );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="elevated-card p-1 flex gap-1">
        {[
          { key: 'items', label: ar ? 'الأصناف' : 'Items' },
          { key: 'vendors', label: ar ? 'الموردين' : 'Vendors' },
          { key: 'branches', label: ar ? 'الفروع' : 'Branches' },
          { key: 'engine', label: ar ? 'إعدادات التقييم' : 'Engine Settings' },
        ].map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`btn-surface flex-1 px-3 py-2.5 rounded-xl text-xs font-black transition-all ${tab === tabItem.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>
      {tab === 'engine' ? (
        <div className="p-4 phone:p-6 tablet:p-8 laptop:p-12 space-y-6 tablet:space-y-8 max-w-2xl">
          <div>
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-1">
              <Zap className="text-blue-500" size={22}/> {t('engine_settings')}
            </h3>
            <p className="text-sm text-slate-400 font-bold">
              {ar ? 'تحكم في المعادلة التي يستخدمها النظام لتقييم كل عملية شراء' : 'Control the formula the engine uses to score each purchase'}
            </p>
          </div>
          <div className="space-y-5 bg-slate-50 rounded-2xl p-4 phone:p-6 border-2 border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
              {ar ? 'أوزان المعادلة' : 'Formula Weights'} —{' '}
              <span className={weightsValid ? 'text-emerald-600' : 'text-red-600'}>
                {ar ? `المجموع: ${weightSum}/100` : `Sum: ${weightSum}/100`}
              </span>
            </p>
            {[
              { key: 'priceWeight', label: t('price_weight'), color: 'bg-red-400', desc: ar ? 'تأثير فرق السعر عن المتوسط' : 'Impact of price vs. avg' },
              { key: 'consistencyWeight', label: t('consistency_weight'), color: 'bg-blue-400', desc: ar ? 'مكافأة ثبات الأسعار' : 'Reward for price stability' },
              { key: 'trendWeight', label: t('trend_weight'), color: 'bg-amber-400', desc: ar ? 'خصم عند ارتفاع السعر مع الوقت' : 'Penalty when price keeps rising' },
            ].map(({ key, label, color, desc }) => (
              <div key={key} className="space-y-2">
                <div className="flex flex-col phone:flex-row justify-between phone:items-center gap-2">
                  <div>
                    <span className="font-black text-slate-700 text-sm">{label}</span>
                    <p className="text-[10px] text-slate-400 font-bold">{desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" max="100" step="5"
                      className="w-16 text-center font-black text-slate-700 border-2 border-slate-200 rounded-lg py-1 text-sm focus:border-blue-400 focus:outline-none"
                      value={localSettings[key]}
                      onChange={e => setLocalSettings(prev => ({ ...prev, [key]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                    />
                    <span className="text-slate-400 font-bold text-sm">%</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${Math.min(100, localSettings[key])}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4 bg-slate-50 rounded-2xl p-4 phone:p-6 border-2 border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
              {t('grade_thresholds')}
              {!thresholdsValid && <span className="text-red-500 mr-2">{ar ? ' — يجب A > B > C' : ' — must be A > B > C'}</span>}
            </p>
            {[
              { key: 'gradeA', grade: 'A', label: ar ? 'حد Buy Now' : 'Buy Now threshold', gs: getGradeStyle('A') },
              { key: 'gradeB', grade: 'B', label: ar ? 'حد Monitor' : 'Monitor threshold', gs: getGradeStyle('B') },
              { key: 'gradeC', grade: 'C', label: ar ? 'حد Do Not Buy' : 'Do Not Buy threshold', gs: getGradeStyle('C') },
            ].map(({ key, grade, label, gs }) => (
              <div key={key} className="flex flex-col phone:flex-row phone:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`px-2 h-8 rounded-lg font-black text-xs flex items-center justify-center border ${gs.badge}`}>{getDecisionLabelByGrade(grade)}</span>
                  <span className="font-bold text-slate-600 text-sm break-words">{label}</span>
                </div>
                <input
                  type="number" step="1"
                  className={`w-24 text-center font-black border-2 rounded-lg py-2 text-sm focus:outline-none ${gs.border} ${gs.bg} ${gs.text}`}
                  value={localSettings[key]}
                  onChange={e => setLocalSettings(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                />
              </div>
            ))}
            <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">{ar ? 'القرارات المقابلة' : 'Corresponding Decisions'}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { grade: 'A', dec: ar ? 'اشتر الآن' : 'Buy Now' },
                  { grade: 'B', dec: ar ? 'راقب' : 'Monitor' },
                  { grade: 'C', dec: ar ? 'لا تشتر' : 'Do Not Buy' },
                  { grade: 'D', dec: ar ? 'لا تشتر' : 'Do Not Buy' },
                ].map(({ grade, dec }) => {
                  const gs = getGradeStyle(grade);
                  return (
                    <div key={grade} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${gs.border} ${gs.bg}`}>
                      <span className={`font-black text-xs ${gs.text}`}>{getDecisionLabelByGrade(grade)}</span>
                      <span className={`font-bold text-xs ${gs.text}`}>{dec}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="space-y-4 bg-slate-50 rounded-2xl p-4 phone:p-6 border-2 border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              {ar ? 'إعدادات المخاطر' : 'Risk Settings'}
            </p>
            <div className="grid grid-cols-1 tablet:grid-cols-3 gap-3">
              <div className="bg-white border rounded-xl p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t('risky_threshold')}</p>
                <input
                  type="number" min="0.02" max="0.5" step="0.01"
                  className="w-full input-field py-2 text-center font-black"
                  value={localSettings.riskyThreshold}
                  onChange={e => setLocalSettings(prev => ({ ...prev, riskyThreshold: Number(e.target.value) }))}
                />
                <p className="text-[10px] text-slate-400 mt-1 font-bold">{ar ? 'مثال: 0.10 = 10%' : 'Example: 0.10 = 10%'}</p>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t('bad_supplier_threshold')}</p>
                <input
                  type="number" min="-50" max="20" step="1"
                  className="w-full input-field py-2 text-center font-black"
                  value={localSettings.badSupplierThreshold}
                  onChange={e => setLocalSettings(prev => ({ ...prev, badSupplierThreshold: Number(e.target.value) }))}
                />
                <p className="text-[10px] text-slate-400 mt-1 font-bold">{ar ? 'أي مورد أقل من هذا الحد يعتبر خطير' : 'Vendors below this average are flagged risky'}</p>
              </div>
              <div className="bg-white border rounded-xl p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t('sensitivity')}</p>
                <input
                  type="number" min="0.5" max="2" step="0.1"
                  className="w-full input-field py-2 text-center font-black"
                  value={localSettings.sensitivity}
                  onChange={e => setLocalSettings(prev => ({ ...prev, sensitivity: Number(e.target.value) }))}
                />
                <p className="text-[10px] text-slate-400 mt-1 font-bold">{ar ? 'كلما زادت القيمة زادت صرامة الإنذار' : 'Higher value means stricter alerts'}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col tablet:flex-row gap-4">
            <button onClick={resetSettings} className="btn-surface flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-slate-200 transition-all">
              <RotateCcw size={18}/> {ar ? 'إعادة تعيين' : 'Reset'}
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={!weightsValid || !thresholdsValid}
              className="btn-surface flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95">
              <Save size={20}/> {t('save_settings')}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 phone:p-6 tablet:p-8 laptop:p-12">
          <div className="mb-4 phone:mb-5">
            <div className="relative">
              <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${ar ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                placeholder={
                  tab === 'items'
                    ? (ar ? 'بحث في الأصناف بالاسم أو الكود...' : 'Search items by name or code...')
                    : tab === 'vendors'
                    ? (ar ? 'بحث في الموردين...' : 'Search vendors...')
                    : (ar ? 'بحث في الفروع...' : 'Search branches...')
                }
                className={`input-field w-full ${ar ? 'pr-10' : 'pl-10'}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col tablet:flex-row gap-4 tablet:gap-5 mb-8 tablet:mb-10 bg-blue-50/50 p-4 phone:p-6 tablet:p-8 rounded-2xl border-2 border-blue-100">
            <input type="text" placeholder="Name" className="input-field flex-[2]" value={name} onChange={e=>setName(e.target.value)} />
            {tab==='items' && (
              <>
                <input type="text" placeholder="Code" className="input-field flex-1 bg-slate-50 text-slate-500" value={nextItemCode} readOnly />
                <input type="number" placeholder={t('ref_price')} className="input-field flex-1" value={price} onChange={e=>setPrice(e.target.value)} />
              </>
            )}
            <button onClick={handleAdd} className="btn-surface w-full tablet:w-auto px-6 tablet:px-10 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shrink-0 active:scale-95"><PlusCircle size={22}/> Add</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActiveRecords.map(x => {
              const isEditing = editingId === x.id;
              return (
                <div key={x.id} className="p-5 border-2 border-slate-100 rounded-3xl bg-white flex flex-col gap-4 group hover:border-blue-400 transition-all shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {x.code && <span className="text-[10px] font-black text-blue-500 mb-1 leading-none block">#{x.code}</span>}
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            className="input-field w-full"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            placeholder={ar ? 'اسم السجل' : 'Record name'}
                          />
                          {tab === 'items' && (
                            <>
                              <input
                                type="text"
                                className="input-field w-full bg-slate-50 text-slate-500"
                                value={x.code || ''}
                                readOnly
                              />
                              <input
                                type="number"
                                className="input-field w-full"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                placeholder={t('ref_price')}
                              />
                            </>
                          )}
                        </div>
                      ) : (
                        <>
                          <span className="font-black text-slate-700 text-sm md:text-base block">{x.name}</span>
                          {x.initialPrice > 0 && <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase block">REF: {x.initialPrice} SAR</span>}
                        </>
                      )}
                    </div>
                    <button onClick={() => handleDeleteRecord(x)} className="btn-surface text-slate-200 hover:text-red-500 p-2 bg-slate-50 rounded-xl transition-all active:scale-90"><Trash2 size={18}/></button>
                  </div>
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <button onClick={() => handleEditSave(x)} className="btn-surface flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-blue-700 transition-all">
                          <Save size={16}/> {ar ? 'حفظ التعديل' : 'Save'}
                        </button>
                        <button onClick={cancelEditing} className="btn-surface px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-200 transition-all">
                          <X size={16}/> {ar ? 'إلغاء' : 'Cancel'}
                        </button>
                      </>
                    ) : (
                      <button onClick={() => startEditing(x)} className="btn-surface flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-black text-xs hover:bg-slate-200 transition-all">
                        {ar ? 'تعديل' : 'Edit'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredActiveRecords.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-3 p-6 rounded-2xl border border-slate-200 bg-slate-50 text-center">
                <p className="text-sm font-bold text-slate-500">
                  {ar ? 'لا توجد نتائج مطابقة للبحث' : 'No matching records found'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

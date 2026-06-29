import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, Plus, Trash2, Edit, Link as LinkIcon, Check, ExternalLink, 
  Lock, Unlock, ShoppingBag, Users, Heart, AlertCircle, LogOut, 
  Database, Code, ArrowRight, Tag, Package, RefreshCw, 
  Clock, Search, Eye, UserPlus, LogIn, ChevronRight, Copy, 
  CheckCircle2, ShoppingCart, ShieldAlert, CheckSquare, Layers, 
  Calendar, Phone, Activity, HelpCircle, FileText, BarChart3, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart,
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  Area
} from 'recharts';
// @ts-ignore
import orionLogo from './assets/images/orion_logo_1782604032311.jpg';
import { apiFetch } from './lib/api';

export default function App() {
  // ====================================================================
  // ROUTING & AUTH STATE
  // ====================================================================
  const [route, setRoute] = useState<'home' | 'login' | 'register' | 'dashboard' | 'admin' | 'live'>('home');
  const [liveSlug, setLiveSlug] = useState<string>('');
  
  const [user, setUser] = useState<{ id: string; email: string; name: string; role: 'ADMIN' | 'SELLER' } | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  
  // Dashboard view tabs
  const [sellerTab, setSellerTab] = useState<'lives' | 'products' | 'analytics'>('lives');
  const [adminTab, setAdminTab] = useState<'overview' | 'sellers' | 'shops' | 'products' | 'monitoring' | 'audit' | 'alerts' | 'cross-rec'>('overview');

  // Core collections from server
  const [lives, setLives] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  // Active Live Dashboard V1 States
  const [selectedAnalyticsLiveId, setSelectedAnalyticsLiveId] = useState<string>('');
  const [activeLiveStats, setActiveLiveStats] = useState<any>(null);
  const [activeHotProspects, setActiveHotProspects] = useState<any[]>([]);
  const [activePopularProducts, setActivePopularProducts] = useState<any[]>([]);
  const [loadingActiveAnalytics, setLoadingActiveAnalytics] = useState<boolean>(false);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [showContactModal, setShowContactModal] = useState<boolean>(false);
  const [contactWhatsapp, setContactWhatsapp] = useState<string>('');

  // SaaS Admin States
  const [adminDetailedStats, setAdminDetailedStats] = useState<any>(null);
  const [adminSellers, setAdminSellers] = useState<any[]>([]);
  const [adminShops, setAdminShops] = useState<any[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<any[]>([]);
  const [adminProductsData, setAdminProductsData] = useState<any>(null);
  const [adminAlertsData, setAdminAlertsData] = useState<any>(null);
  const [adminCrossRecData, setAdminCrossRecData] = useState<any>(null);
  const [adminLiveMonitoring, setAdminLiveMonitoring] = useState<any>(null);

  // Filters
  const [auditLogSellerFilter, setAuditLogSellerFilter] = useState<string>('');
  const [auditLogActionFilter, setAuditLogActionFilter] = useState<string>('');

  // Visitor info for public live view
  const [visitorPseudo, setVisitorPseudo] = useState<string>(() => localStorage.getItem('orion_visitor_pseudo') || '');
  const [visitorWhatsapp, setVisitorWhatsapp] = useState<string>(() => localStorage.getItem('orion_visitor_whatsapp') || '');
  const [showVisitorJoinModal, setShowVisitorJoinModal] = useState<boolean>(!localStorage.getItem('orion_visitor_pseudo'));
  const [publicLive, setPublicLive] = useState<any>(null);
  const [publicProducts, setPublicProducts] = useState<any[]>([]);
  const [publicLogs, setPublicLogs] = useState<any[]>([]);
  const [publicLoading, setPublicLoading] = useState<boolean>(false);

  // Forms and Modals
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showLiveAnalyticsModal, setShowLiveAnalyticsModal] = useState(false);
  const [selectedLiveAnalytics, setSelectedLiveAnalytics] = useState<any>(null);
  const [reactivateLiveId, setReactivateLiveId] = useState<string | null>(null);
  const [reactivateStart, setReactivateStart] = useState('');
  const [reactivateEnd, setReactivateEnd] = useState('');
  
  // Edit states
  const [liveEditId, setLiveEditId] = useState<string | null>(null);
  const [liveFormTitle, setLiveFormTitle] = useState('');
  const [liveFormDesc, setLiveFormDesc] = useState('');
  const [liveFormSlug, setLiveFormSlug] = useState('');
  const [liveFormImg, setLiveFormImg] = useState('');
  const [liveFormStart, setLiveFormStart] = useState('');
  const [liveFormEnd, setLiveFormEnd] = useState('');
  const [liveFormSelectedProducts, setLiveFormSelectedProducts] = useState<string[]>([]);

  const [productEditId, setProductEditId] = useState<string | null>(null);
  const [productFormName, setProductFormName] = useState('');
  const [productFormDesc, setProductFormDesc] = useState('');
  const [productFormPrice, setProductFormPrice] = useState('');
  const [productFormStock, setProductFormStock] = useState('');
  const [productFormImg, setProductFormImg] = useState('');
  const [productFormIsActive, setProductFormIsActive] = useState(true);

  // Auth fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');

  // Input for custom slug entry
  const [slugSearchInput, setSlugSearchInput] = useState('');
  const [publicLives, setPublicLives] = useState<any[]>([]);
  const [publicLivesLoading, setPublicLivesLoading] = useState(false);

  useEffect(() => {
    if (route === 'home') {
      const fetchPublicLives = async () => {
        setPublicLivesLoading(true);
        try {
          const res = await apiFetch('/api/public/lives');
          if (res.ok) {
            const data = await res.json();
            setPublicLives(data);
          }
        } catch (err) {
          console.error("Error fetching public lives:", err);
        } finally {
          setPublicLivesLoading(false);
        }
      };
      fetchPublicLives();
    }
  }, [route]);

  // ====================================================================
  // TOAST NOTIFICATION HELPERS
  // ====================================================================
  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const renderToast = () => {
    if (!toast) return null;
    return (
      <div className={`fixed bottom-5 right-5 px-4 py-3 rounded-xl border text-xs font-bold shadow-lg z-[9999] animate-bounce flex items-center gap-2 ${
        toast.type === 'success' ? 'bg-emerald-950 border-emerald-800 text-emerald-400' :
        toast.type === 'warning' ? 'bg-amber-950 border-amber-800 text-amber-400' :
        'bg-rose-950 border-rose-800 text-rose-400'
      }`}>
        <AlertCircle className="w-4 h-4" />
        <span>{toast.message}</span>
      </div>
    );
  };

  // ====================================================================
  // ROUTING SYNCRONIZER
  // ====================================================================
  useEffect(() => {
    const handleRouting = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      
      if (path === '/admin' || hash === '#admin') {
        setRoute('admin');
      } else if (path === '/dashboard' || hash === '#dashboard') {
        setRoute('dashboard');
      } else if (hash.startsWith('#live/')) {
        setRoute('live');
        setLiveSlug(hash.replace('#live/', ''));
      } else if (path.startsWith('/lives/')) {
        setRoute('live');
        setLiveSlug(path.replace('/lives/', ''));
      } else if (hash === '#login') {
        setRoute('login');
      } else if (hash === '#register') {
        setRoute('register');
      } else {
        setRoute('home');
      }
    };
    
    handleRouting();
    window.addEventListener('hashchange', handleRouting);
    return () => window.removeEventListener('hashchange', handleRouting);
  }, []);

  const navigateTo = (hash: string) => {
    window.location.hash = hash;
  };

  // ====================================================================
  // INITIAL AUTHENTICATION CHECK
  // ====================================================================
  const checkAuth = async () => {
    setAuthLoading(true);
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Fetch data depending on the route
  useEffect(() => {
    if (user) {
      if (route === 'dashboard') {
        fetchSellerData();
      } else if (route === 'admin') {
        fetchAdminData();
      }
    }
  }, [route, user, sellerTab]);

  // Real-time automatic updates for Seller Dashboard stats & data (every 5 seconds)
  useEffect(() => {
    if (user && route === 'dashboard') {
      const interval = setInterval(() => {
        refreshSellerDataSilently();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [route, user]);

  // Fetch public live details if route is 'live'
  useEffect(() => {
    if (route === 'live' && liveSlug) {
      fetchPublicLive();
      // Periodically refresh public storefront for real-time live stock/comments
      const interval = setInterval(fetchPublicLive, 5000);
      return () => clearInterval(interval);
    }
  }, [route, liveSlug]);

  // ====================================================================
  // SERVER API FETCHERS
  // ====================================================================
  const fetchSellerData = async () => {
    setDataLoading(true);
    try {
      const [livesRes, productsRes, statsRes] = await Promise.all([
        apiFetch('/api/lives'),
        apiFetch('/api/products'),
        apiFetch('/api/seller/stats')
      ]);

      if (livesRes.ok) setLives(await livesRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
      if (statsRes.ok) setAnalytics(await statsRes.json());
    } catch (e) {
      showToast("Erreur lors du chargement des données vendeur.", "error");
    } finally {
      setDataLoading(false);
    }
  };

  const refreshSellerDataSilently = async () => {
    try {
      const [livesRes, productsRes, statsRes] = await Promise.all([
        apiFetch('/api/lives'),
        apiFetch('/api/products'),
        apiFetch('/api/seller/stats')
      ]);

      if (livesRes.ok) {
        const d = await livesRes.json();
        setLives(d);
      }
      if (productsRes.ok) {
        const d = await productsRes.json();
        setProducts(d);
      }
      if (statsRes.ok) {
        const d = await statsRes.json();
        setAnalytics(d);
      }
    } catch (e) {
      console.error("Silent refresh of seller data failed:", e);
    }
  };

  const fetchActiveLiveAnalytics = async (liveId: string) => {
    if (!liveId) return;
    try {
      const [statsRes, prospectsRes, popularRes] = await Promise.all([
        apiFetch(`/api/lives/${liveId}/live-dashboard-stats`),
        apiFetch(`/api/lives/${liveId}/hot-prospects`),
        apiFetch(`/api/lives/${liveId}/popular-products`)
      ]);

      if (statsRes.ok) setActiveLiveStats(await statsRes.json());
      if (prospectsRes.ok) setActiveHotProspects(await prospectsRes.json());
      if (popularRes.ok) setActivePopularProducts(await popularRes.json());
    } catch (e) {
      console.error("Error loading active analytics:", e);
    }
  };

  const handleExportProspects = (prospects: any[]) => {
    if (!prospects || prospects.length === 0) {
      showToast("Aucun prospect à exporter pour le moment.", "warning");
      return;
    }
    const headers = ["Pseudo", "Score", "WhatsApp", "Ajouts Liste", "Reservations", "Demande de Contact"];
    const rows = prospects.map(p => [
      p.pseudo,
      p.score,
      p.whatsapp || "Non fourni",
      p.saved_count || 0,
      p.reserved_count || 0,
      p.has_requested_contact ? "Oui" : "Non"
    ]);
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Prospects_Chauds_Live_${selectedAnalyticsLiveId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Export CSV des prospects réussi ! 📤");
  };

  const handleExportReservations = (productsList: any[]) => {
    if (!productsList || productsList.length === 0) {
      showToast("Aucune réservation à exporter pour le moment.", "warning");
      return;
    }
    const headers = ["ID Article", "Nom", "Prix (FCFA)", "Vues", "Intérêts", "Quantité Réservée", "Revenus Générés (FCFA)"];
    const rows = productsList.map(p => [
      p.id,
      p.name,
      p.price,
      p.views || 0,
      p.interests || 0,
      p.reservations || 0,
      (p.reservations || 0) * p.price
    ]);
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Produits_Populaires_Live_${selectedAnalyticsLiveId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Export CSV des réservations réussi ! 📤");
  };

  useEffect(() => {
    if (user && route === 'dashboard' && sellerTab === 'analytics') {
      if (!selectedAnalyticsLiveId && lives.length > 0) {
        const activeOrLatest = lives.find(l => l.status === 'ACTIVE') || lives[0];
        setSelectedAnalyticsLiveId(activeOrLatest.id);
      } else if (selectedAnalyticsLiveId) {
        fetchActiveLiveAnalytics(selectedAnalyticsLiveId);
        const interval = setInterval(() => {
          fetchActiveLiveAnalytics(selectedAnalyticsLiveId);
        }, 5000); // 5s interval for real-time live streaming metrics update
        return () => clearInterval(interval);
      }
    }
  }, [sellerTab, selectedAnalyticsLiveId, lives, route, user]);

  const fetchAdminData = async () => {
    setDataLoading(true);
    try {
      const [
        detailedStatsRes,
        sellersRes,
        shopsRes,
        productsRes,
        alertsRes,
        crossRecRes,
        monitoringRes,
        auditLogsRes
      ] = await Promise.all([
        apiFetch('/api/admin/detailed-stats'),
        apiFetch('/api/admin/sellers'),
        apiFetch('/api/admin/shops'),
        apiFetch('/api/admin/products'),
        apiFetch('/api/admin/alerts'),
        apiFetch('/api/admin/cross-recommendation'),
        apiFetch('/api/admin/live-monitoring'),
        apiFetch(`/api/admin/audit-logs?sellerId=${auditLogSellerFilter}&actionType=${auditLogActionFilter}`)
      ]);

      if (detailedStatsRes.ok) setAdminDetailedStats(await detailedStatsRes.json());
      if (sellersRes.ok) setAdminSellers(await sellersRes.json());
      if (shopsRes.ok) setAdminShops(await shopsRes.json());
      if (productsRes.ok) setAdminProductsData(await productsRes.json());
      if (alertsRes.ok) setAdminAlertsData(await alertsRes.json());
      if (crossRecRes.ok) setAdminCrossRecData(await crossRecRes.json());
      if (monitoringRes.ok) setAdminLiveMonitoring(await monitoringRes.json());
      if (auditLogsRes.ok) setAdminAuditLogs(await auditLogsRes.json());
    } catch (e) {
      showToast("Erreur de récupération des données administrateur SaaS.", "error");
    } finally {
      setDataLoading(false);
    }
  };

  // Trigger audit logs refetch when filters change
  useEffect(() => {
    if (user && user.role === 'ADMIN' && route === 'admin') {
      apiFetch(`/api/admin/audit-logs?sellerId=${auditLogSellerFilter}&actionType=${auditLogActionFilter}`)
        .then(res => res.json())
        .then(data => setAdminAuditLogs(data))
        .catch(err => console.error(err));
    }
  }, [auditLogSellerFilter, auditLogActionFilter, user, route]);

  const fetchPublicLive = async () => {
    if (!liveSlug) return;
    try {
      const res = await apiFetch(`/api/lives/public/${liveSlug}`);
      if (res.ok) {
        const data = await res.json();
        setPublicLive(data.live);
        setPublicProducts(data.products);
        setPublicLogs(data.logs);
      } else {
        setPublicLive(null);
      }
    } catch (e) {
      console.error("Error fetching live storefront", e);
    }
  };

  // ====================================================================
  // AUTHENTICATION LOGIC
  // ====================================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        showToast(`Bienvenue, ${data.user.name} !`);
        if (data.user.role === 'ADMIN') {
          navigateTo('admin');
        } else {
          navigateTo('dashboard');
        }
      } else {
        showToast(data.error || "Identifiants incorrects.", "error");
      }
    } catch (err) {
      showToast("Une erreur réseau est survenue.", "error");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanEmail = registerEmail.trim().toLowerCase();
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      showToast("Le format de l'adresse email est invalide. Exemple correct : utilisateur@gmail.com", "error");
      return;
    }
    
    if (cleanEmail.includes('localhost') || cleanEmail.endsWith('@') || cleanEmail.startsWith('@')) {
      showToast("Le format de l'adresse email est invalide (localhost ou format incorrect).", "error");
      return;
    }
    
    const [localPart] = cleanEmail.split('@');
    if (localPart.length < 2) {
      showToast("L'adresse email est invalide (partie locale trop courte).", "error");
      return;
    }

    if (registerPassword.length < 8) {
      showToast("Le mot de passe doit contenir au moins 8 caractères.", "error");
      return;
    }
    
    const hasLetter = /[a-zA-Z]/.test(registerPassword);
    const hasNumber = /[0-9]/.test(registerPassword);
    if (!hasLetter || !hasNumber) {
      showToast("Le mot de passe doit contenir au moins une lettre et au moins un chiffre.", "error");
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      showToast("La confirmation du mot de passe ne correspond pas.", "error");
      return;
    }

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerName,
          email: cleanEmail,
          password: registerPassword,
          confirmPassword: registerConfirmPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Compte créé avec succès ! Veuillez vous connecter.");
        setLoginEmail(cleanEmail);
        navigateTo('login');
      } else {
        showToast(data.error || "Erreur lors de l'inscription.", "error");
      }
    } catch (err) {
      showToast("Une erreur réseau est survenue.", "error");
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      showToast("Vous avez été déconnecté.");
      navigateTo('');
    } catch (e) {
      showToast("Erreur de déconnexion.", "error");
    }
  };

  // ====================================================================
  // LIVES ACTIONS
  // ====================================================================
  const splitDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return { date: '', time: '' };
    const parts = dateTimeStr.split('T');
    return {
      date: parts[0] || '',
      time: parts[1] || ''
    };
  };

  const combineDateTime = (date: string, time: string) => {
    let cleanDate = date;
    if (date) {
      const parts = date.split('-');
      if (parts[0] && parts[0].length > 4) {
        parts[0] = parts[0].slice(0, 4);
        cleanDate = parts.join('-');
      }
    }
    return `${cleanDate || ''}T${time || '00:00'}`;
  };

  const formatToLocalDatetime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const getLiveFormError = () => {
    if (!liveFormStart || !liveFormEnd) return null;
    const now = new Date();
    const start = new Date(liveFormStart).getTime();
    const end = new Date(liveFormEnd).getTime();

    // Check year lengths
    const startYear = new Date(liveFormStart).getFullYear();
    const endYear = new Date(liveFormEnd).getFullYear();
    if (isNaN(startYear) || startYear > 9999 || startYear < 1000) {
      return "L'année de début doit être un nombre à 4 chiffres (ex. 2026).";
    }
    if (isNaN(endYear) || endYear > 9999 || endYear < 1000) {
      return "L'année de fin doit être un nombre à 4 chiffres (ex. 2026).";
    }

    // Only validate past start_date if it is a new live or if the start_date has changed
    let checkStartPast = !liveEditId;
    if (liveEditId) {
      const origLive = lives.find(l => l.id === liveEditId);
      if (origLive && new Date(liveFormStart).getTime() !== new Date(origLive.start_date).getTime()) {
        checkStartPast = true;
      }
    }

    if (checkStartPast && start < now.getTime() - 60000) {
      return "La date de début ne peut pas être dans le passé.";
    }
    if (end <= start) {
      return "La date de fin doit être postérieure à la date de début.";
    }
    const durationMs = end - start;
    if (durationMs > 24 * 60 * 60 * 1000) {
      return "La durée maximale autorisée est de 24 heures.";
    }
    if (durationMs < 30 * 60 * 1000) {
      return "La durée minimale autorisée est de 30 minutes.";
    }
    return null;
  };

  const getReactivateFormError = () => {
    if (!reactivateStart || !reactivateEnd) return null;
    const now = new Date();
    const start = new Date(reactivateStart).getTime();
    const end = new Date(reactivateEnd).getTime();

    // Check year lengths
    const startYear = new Date(reactivateStart).getFullYear();
    const endYear = new Date(reactivateEnd).getFullYear();
    if (isNaN(startYear) || startYear > 9999 || startYear < 1000) {
      return "L'année de début doit être un nombre à 4 chiffres (ex. 2026).";
    }
    if (isNaN(endYear) || endYear > 9999 || endYear < 1000) {
      return "L'année de fin doit être un nombre à 4 chiffres (ex. 2026).";
    }

    if (start < now.getTime() - 60000) {
      return "La date de début ne peut pas être dans le passé.";
    }
    if (end <= start) {
      return "La date de fin doit être postérieure à la date de début.";
    }
    const durationMs = end - start;
    if (durationMs > 24 * 60 * 60 * 1000) {
      return "La durée maximale autorisée est de 24 heures.";
    }
    if (durationMs < 30 * 60 * 1000) {
      return "La durée minimale autorisée est de 30 minutes.";
    }
    return null;
  };

  const getLiveDurationText = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return '';
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    if (end <= start) return '';
    const diffMs = end - start;
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    const mins = Math.round((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    let text = "Durée : ";
    if (hours > 0) text += `${hours}h `;
    if (mins > 0) text += `${mins}min`;
    return text.trim();
  };

  const handleCreateOrUpdateLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveFormTitle || !liveFormSlug || !liveFormStart || !liveFormEnd) {
      showToast("Veuillez remplir tous les champs obligatoires.", "error");
      return;
    }

    // Client-side strict validation
    const validationError = getLiveFormError();
    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    const bodyData = {
      title: liveFormTitle,
      description: liveFormDesc,
      slug: liveFormSlug,
      image_url: liveFormImg,
      start_date: new Date(liveFormStart).toISOString(),
      end_date: new Date(liveFormEnd).toISOString(),
      status: liveEditId ? undefined : 'DRAFT', // keep original status on update unless explicitly overridden
      product_ids: liveFormSelectedProducts
    };

    try {
      const url = liveEditId ? `/api/lives/${liveEditId}` : '/api/lives';
      const method = liveEditId ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();
      if (res.ok) {
        showToast(liveEditId ? "Session live mise à jour avec succès !" : "Nouvelle session live créée !");
        setShowLiveModal(false);
        resetLiveForm();
        fetchSellerData();
      } else {
        showToast(data.error || "Une erreur est survenue.", "error");
      }
    } catch (err) {
      showToast("Impossible d'enregistrer la session live.", "error");
    }
  };

  const handleEditLiveClick = (live: any) => {
    setLiveEditId(live.id);
    setLiveFormTitle(live.title);
    setLiveFormDesc(live.description);
    setLiveFormSlug(live.slug);
    setLiveFormImg(live.image_url);
    
    // format dates to fit datetime-local inputs (YYYY-MM-DDTHH:MM)
    const startDateFormatted = live.start_date ? formatToLocalDatetime(live.start_date) : '';
    const endDateFormatted = live.end_date ? formatToLocalDatetime(live.end_date) : '';
    setLiveFormStart(startDateFormatted);
    setLiveFormEnd(endDateFormatted);

    // Get linked products
    const linked = products.filter(p => p.id === live.id); // Or fetch product ids through live product list
    setLiveFormSelectedProducts(products.map(p => p.id)); // Default to selecting all, can toggle
    setShowLiveModal(true);
  };

  const handleDeleteLive = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer définitivement cette session live ? Toutes les réservations associées seront effacées.")) return;
    try {
      const res = await apiFetch(`/api/lives/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast("Session live supprimée.");
        fetchSellerData();
      } else {
        showToast("Erreur de suppression.", "error");
      }
    } catch (e) {
      showToast("Erreur de connexion.", "error");
    }
  };

  const handleToggleLiveStatus = async (live: any, newStatus: string) => {
    try {
      const res = await apiFetch(`/api/lives/${live.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Le statut du live est désormais : ${newStatus}`);
        fetchSellerData();
      } else {
        const d = await res.json();
        showToast(d.error || "Mise à jour impossible", "error");
      }
    } catch (e) {
      showToast("Erreur réseau.", "error");
    }
  };

  const handleReactivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reactivateLiveId || !reactivateStart || !reactivateEnd) {
      showToast("Veuillez renseigner les dates de début et de fin.", "error");
      return;
    }

    const validationError = getReactivateFormError();
    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    try {
      const res = await apiFetch(`/api/lives/${reactivateLiveId}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          start_date: new Date(reactivateStart).toISOString(), 
          end_date: new Date(reactivateEnd).toISOString() 
        })
      });
      if (res.ok) {
        showToast("Session live réactivée avec succès ! Les produits ont été associés.");
        setShowReactivateModal(false);
        setReactivateLiveId(null);
        setReactivateStart('');
        setReactivateEnd('');
        fetchSellerData();
      } else {
        const d = await res.json();
        showToast(d.error || "Réactivation impossible", "error");
      }
    } catch (e) {
      showToast("Erreur réseau.", "error");
    }
  };

  const resetLiveForm = () => {
    setLiveEditId(null);
    setLiveFormTitle('');
    setLiveFormDesc('');
    setLiveFormSlug('');
    setLiveFormImg('');
    setLiveFormStart('');
    setLiveFormEnd('');
    setLiveFormSelectedProducts([]);
  };

  // ==========================================
  // PRODUCTS ACTIONS
  // ==========================================
  const handleCreateOrUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productFormName || productFormPrice === '' || productFormStock === '') {
      showToast("Veuillez remplir tous les champs obligatoires.", "error");
      return;
    }

    const bodyData = {
      name: productFormName,
      description: productFormDesc,
      price: parseFloat(productFormPrice),
      stock: parseInt(productFormStock),
      image_url: productFormImg,
      is_active: productFormIsActive
    };

    try {
      const url = productEditId ? `/api/products/${productEditId}` : '/api/products';
      const method = productEditId ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();
      if (res.ok) {
        showToast(productEditId ? "Produit mis à jour avec succès !" : "Nouveau produit ajouté au catalogue !");
        setShowProductModal(false);
        resetProductForm();
        fetchSellerData();
      } else {
        showToast(data.error || "Une erreur est survenue.", "error");
      }
    } catch (err) {
      showToast("Impossible d'enregistrer le produit.", "error");
    }
  };

  const handleEditProductClick = (product: any) => {
    setProductEditId(product.id);
    setProductFormName(product.name);
    setProductFormDesc(product.description);
    setProductFormPrice(product.price.toString());
    setProductFormStock(product.stock.toString());
    setProductFormImg(product.image_url);
    setProductFormIsActive(product.is_active);
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Supprimer ce produit de votre catalogue ?")) return;
    try {
      const res = await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast("Produit supprimé du catalogue.");
        fetchSellerData();
      } else {
        showToast("Erreur de suppression.", "error");
      }
    } catch (e) {
      showToast("Erreur de connexion.", "error");
    }
  };

  const resetProductForm = () => {
    setProductEditId(null);
    setProductFormName('');
    setProductFormDesc('');
    setProductFormPrice('');
    setProductFormStock('');
    setProductFormImg('');
    setProductFormIsActive(true);
  };

  // ==========================================
  // ADMIN USERS ACTIONS
  // ==========================================
  const handleToggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'SELLER' : 'ADMIN';
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        showToast("Rôle de l'utilisateur mis à jour.");
        fetchAdminData();
      } else {
        const d = await res.json();
        showToast(d.error || "Mise à jour impossible.", "error");
      }
    } catch (e) {
      showToast("Erreur de connexion.", "error");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Voulez-vous supprimer définitivement cet utilisateur de la plateforme Orion ? Toutes ses données seront supprimées.")) return;
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast("Utilisateur supprimé.");
        fetchAdminData();
      } else {
        const d = await res.json();
        showToast(d.error || "Suppression impossible.", "error");
      }
    } catch (e) {
      showToast("Erreur de connexion.", "error");
    }
  };

  const handleToggleSellerStatus = async (sellerId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      const res = await apiFetch(`/api/admin/sellers/${sellerId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        showToast(nextStatus === 'SUSPENDED' ? "Vendeur suspendu avec succès." : "Vendeur réactivé avec succès.");
        fetchAdminData();
      } else {
        const d = await res.json();
        showToast(d.error || "Action impossible.", "error");
      }
    } catch (e) {
      showToast("Erreur de connexion.", "error");
    }
  };

  const handleToggleShopStatus = async (shopId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    try {
      const res = await apiFetch(`/api/admin/shops/${shopId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        showToast(nextStatus === 'INACTIVE' ? "Boutique désactivée." : "Boutique réactivée.");
        fetchAdminData();
      } else {
        const d = await res.json();
        showToast(d.error || "Action impossible.", "error");
      }
    } catch (e) {
      showToast("Erreur de connexion.", "error");
    }
  };

  const handleToggleCrossRecommendation = async (enabled: boolean) => {
    try {
      const res = await apiFetch('/api/admin/cross-recommendation/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (res.ok) {
        showToast(enabled ? "Moteur de recommandation croisée activé !" : "Moteur de recommandation croisée désactivé.");
        fetchAdminData();
      } else {
        showToast("Erreur de modification.", "error");
      }
    } catch (e) {
      showToast("Erreur de connexion.", "error");
    }
  };

  // ==========================================
  // PUBLIC VISITOR STOREFRONT ACTIONS
  // ==========================================
  const handleJoinPublicLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorPseudo.trim()) {
      showToast("Veuillez saisir un pseudo.", "warning");
      return;
    }
    try {
      const res = await apiFetch(`/api/lives/public/${liveSlug}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: visitorPseudo, whatsapp: visitorWhatsapp })
      });
      if (res.ok) {
        localStorage.setItem('orion_visitor_pseudo', visitorPseudo);
        localStorage.setItem('orion_visitor_whatsapp', visitorWhatsapp);
        setShowVisitorJoinModal(false);
        showToast(`Bienvenue sur le Live, ${visitorPseudo} !`);
        fetchPublicLive();
      } else {
        showToast("Erreur de connexion au live.", "error");
      }
    } catch (e) {
      showToast("Erreur de connexion réseau.", "error");
    }
  };

  const handleVisitorInterest = async (productId: string) => {
    if (!visitorPseudo) {
      setShowVisitorJoinModal(true);
      return;
    }
    try {
      const res = await apiFetch(`/api/lives/public/${liveSlug}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: visitorPseudo, productId })
      });
      if (res.ok) {
        showToast("Intérêt marqué ! Le vendeur le voit instantanément.");
        fetchPublicLive();
      }
    } catch (e) {
      showToast("Erreur de réseau.", "error");
    }
  };

  const handleVisitorReserve = async (productId: string) => {
    if (!visitorPseudo) {
      setShowVisitorJoinModal(true);
      return;
    }
    const quantity = selectedQuantities[productId] || 1;

    try {
      const res = await apiFetch(`/api/lives/public/${liveSlug}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pseudo: visitorPseudo, 
          whatsapp: visitorWhatsapp || '', 
          productId,
          quantity
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Félicitations ! Votre réservation de ${quantity} pièce(s) est validée ! 🎉`);
        fetchPublicLive();
      } else {
        showToast(data.error || "Rupture de stock ! Réservation impossible.", "error");
      }
    } catch (e) {
      showToast("Erreur lors de la réservation.", "error");
    }
  };

  const handleVisitorContactRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!visitorPseudo) {
      setShowVisitorJoinModal(true);
      return;
    }

    const whatsappToUse = contactWhatsapp || visitorWhatsapp;
    if (!whatsappToUse) {
      setShowContactModal(true);
      return;
    }

    try {
      const res = await apiFetch(`/api/lives/public/${liveSlug}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: visitorPseudo, whatsapp: whatsappToUse })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Votre demande de contact a été transmise au vendeur ! 📞");
        setShowContactModal(false);
        fetchPublicLive();
      } else {
        showToast(data.error || "Erreur de traitement.", "error");
      }
    } catch (e) {
      showToast("Erreur de connexion.", "error");
    }
  };

  const handleVisitorLogout = () => {
    localStorage.removeItem('orion_visitor_pseudo');
    localStorage.removeItem('orion_visitor_whatsapp');
    setVisitorPseudo('');
    setVisitorWhatsapp('');
    setShowVisitorJoinModal(true);
    showToast("Vous avez quitté le Live.");
  };

  // Render Loader if Auth status is pending
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-slate-400 text-xs">Vérification de votre session sécurisée...</p>
      </div>
    );
  }

  // ====================================================================
  // 1. PUBLIC MARKETING HOMEPAGE VIEW
  // ====================================================================
  if (route === 'home') {
    // Filter active public lives based on search input
    const filteredLives = slugSearchInput.trim() 
      ? publicLives.filter(live => 
          (live.slug && live.slug.toLowerCase().includes(slugSearchInput.trim().toLowerCase())) ||
          (live.title && live.title.toLowerCase().includes(slugSearchInput.trim().toLowerCase()))
        )
      : [];

    // Group lives into counts for display
    const activeLivesCount = publicLives.filter(l => l.status === 'ACTIVE' || l.status === 'SOLD_OUT').length;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden" id="home-view">
        {/* Futuristic Glowing Aura Backgrounds */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-900/10 blur-[120px] pointer-events-none" />
        
        {/* Tech Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

        {/* Navigation */}
        <header className="border-b border-slate-900 px-6 py-4 flex justify-between items-center bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/30 rounded-xl blur-md animate-pulse" />
              <img 
                src={orionLogo} 
                alt="Orion Live Logo" 
                className="relative h-9 w-9 rounded-xl border border-indigo-500/30 object-cover shadow-lg" 
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="font-extrabold tracking-tight text-white text-lg">Orion<span className="text-indigo-400 font-medium">.live</span></span>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            {user ? (
              <>
                <span className="text-slate-400 hidden sm:inline">Connecté : <strong className="text-slate-200">{user.name}</strong> ({user.role})</span>
                <button 
                  onClick={() => navigateTo(user.role === 'ADMIN' ? 'admin' : 'dashboard')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                >
                  Mon Espace <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => navigateTo('login')} className="text-slate-300 hover:text-white font-bold px-3 py-2 transition">
                  Connexion
                </button>
                <button 
                  onClick={() => navigateTo('register')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold transition shadow-lg shadow-indigo-600/20"
                >
                  Créer un compte
                </button>
              </>
            )}
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-6xl mx-auto px-6 py-12 md:py-20 text-center space-y-12 relative z-10 w-full">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center space-x-2 bg-indigo-950/40 border border-indigo-500/30 px-4 py-1.5 rounded-full text-[11px] text-indigo-300 font-bold shadow-lg shadow-indigo-500/5 backdrop-blur-sm"
          >
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            <span>SaaS de Live Commerce de Prochaine Génération</span>
          </motion.div>

          <div className="space-y-6 max-w-4xl mx-auto">
            <motion.h1 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tight text-white leading-tight"
            >
              Transformez vos ventes live en <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-[0_2px_10px_rgba(168,85,247,0.15)]">Commandes Réelles</span>.
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-sm md:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto font-medium"
            >
              Orion Live permet aux commerçants de générer des vitrines de vente flash éphémères pour TikTok, Instagram et Facebook. Zéro survente garanti par blocage PostgreSQL et validation instantanée via WhatsApp.
            </motion.p>
          </div>

          {/* Quick Stats Panel */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left"
          >
            <div className="bg-slate-900/40 border border-slate-900/80 backdrop-blur-sm p-4 rounded-2xl flex items-center space-x-3.5 shadow-md">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <div className="text-lg font-extrabold text-white">{publicLives.length}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Boutiques créées</div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-900/80 backdrop-blur-sm p-4 rounded-2xl flex items-center space-x-3.5 shadow-md">
              <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-lg font-extrabold text-white flex items-center gap-1.5">
                  {activeLivesCount}
                  {activeLivesCount > 0 && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />}
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Sessions Actives</div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-900/80 backdrop-blur-sm p-4 rounded-2xl flex items-center space-x-3.5 shadow-md">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="text-lg font-extrabold text-white">PostgreSQL</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Base Transactions</div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-900/80 backdrop-blur-sm p-4 rounded-2xl flex items-center space-x-3.5 shadow-md">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-lg font-extrabold text-white">WhatsApp</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Validation Commande</div>
              </div>
            </div>
          </motion.div>

          {/* Action CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto pt-2">
            <button 
              onClick={() => navigateTo('register')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-xl font-extrabold text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0 duration-150"
            >
              Créer mon espace vendeur <ChevronRight className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                const searchEl = document.getElementById('search-input-box');
                if (searchEl) {
                  searchEl.scrollIntoView({ behavior: 'smooth' });
                  const inp = searchEl.querySelector('input');
                  if (inp) inp.focus();
                }
              }}
              className="bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 px-6 py-3.5 rounded-xl font-bold text-sm transition transform hover:-translate-y-0.5 active:translate-y-0 duration-150"
            >
              Rechercher une boutique live
            </button>
          </div>

          {/* Corrected & Interactive Search Panel */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 max-w-xl mx-auto space-y-4 shadow-xl relative"
            id="search-input-box"
          >
            <div className="absolute -top-3 right-5 bg-gradient-to-r from-indigo-600 to-pink-600 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-white shadow-md">
              Moteur temps réel
            </div>
            
            <div className="text-left">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-400" />
                Recherche rapide de boutique live
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Saisissez le slug ou le titre d'une vente en direct pour rejoindre la boutique client instantanément.</p>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  placeholder="ex. vente-bijoux, clearance-printemps..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-3.5 pr-10 py-3 text-xs text-white focus:outline-none transition"
                  value={slugSearchInput}
                  onChange={(e) => setSlugSearchInput(e.target.value)}
                />
                {slugSearchInput && (
                  <button 
                    onClick={() => setSlugSearchInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs font-bold"
                  >
                    Effacer
                  </button>
                )}
              </div>
              <button 
                onClick={() => {
                  if (slugSearchInput.trim()) {
                    const exactMatch = publicLives.find(l => l.slug.toLowerCase() === slugSearchInput.trim().toLowerCase());
                    if (exactMatch) {
                      navigateTo(`live/${exactMatch.slug}`);
                    } else {
                      // Attempt slug navigation directly
                      navigateTo(`live/${slugSearchInput.trim()}`);
                    }
                  } else {
                    showToast("Veuillez saisir un slug ou un nom de boutique à chercher.", "warning");
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md"
              >
                <span>Visiter</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Live Autocomplete Results */}
            <AnimatePresence>
              {slugSearchInput.trim() && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden text-left divide-y divide-slate-900 shadow-2xl max-h-60 overflow-y-auto"
                >
                  {filteredLives.length > 0 ? (
                    filteredLives.map((live) => (
                      <div 
                        key={live.id}
                        onClick={() => navigateTo(`live/${live.slug}`)}
                        className="p-3 hover:bg-slate-900/60 transition cursor-pointer flex justify-between items-center group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white group-hover:text-indigo-400 transition">{live.title}</span>
                            <span className="text-[10px] text-slate-500">({live.slug})</span>
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                            <span className="font-semibold text-slate-300">Vendeur: {live.seller?.name || 'Inconnu'}</span>
                            <span>•</span>
                            <span>{live.products?.length || 0} articles</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {live.status === 'ACTIVE' && (
                            <span className="bg-red-950 border border-red-800 text-red-400 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                              DIRECT
                            </span>
                          )}
                          {live.status === 'SOLD_OUT' && (
                            <span className="bg-amber-950 border border-amber-800 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded-full">
                              ÉPUISÉ
                            </span>
                          )}
                          {live.status === 'SCHEDULED' && (
                            <span className="bg-blue-950 border border-blue-800 text-blue-400 text-[9px] font-black px-2 py-0.5 rounded-full">
                              PLANIFIÉ
                            </span>
                          )}
                          {live.status === 'ENDED' && (
                            <span className="bg-slate-900 border border-slate-800 text-slate-400 text-[9px] font-black px-2 py-0.5 rounded-full">
                              TERMINÉ
                            </span>
                          )}
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-white transition transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                      <p>Aucune boutique active ne correspond exactement.</p>
                      <button 
                        onClick={() => navigateTo(`live/${slugSearchInput.trim()}`)}
                        className="text-indigo-400 hover:underline font-bold text-[11px] block mx-auto mt-2"
                      >
                        Rejoindre quand même la boutique "{slugSearchInput.trim()}" →
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Directory of Active Lives */}
          <div className="space-y-6 pt-6 text-left">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <div className="space-y-1">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  L'Annuaire des Live Commerce
                </h2>
                <p className="text-xs text-slate-400">Découvrez les boutiques créées ou programmées par nos commerçants.</p>
              </div>
              <div className="text-xs text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-500/20 px-3 py-1 rounded-xl">
                {publicLives.length} Boutiques
              </div>
            </div>

            {publicLivesLoading ? (
              <div className="flex items-center justify-center py-12 space-x-2">
                <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                <span className="text-slate-400 text-xs font-semibold">Mise à jour de l'annuaire...</span>
              </div>
            ) : publicLives.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-8 text-center space-y-4">
                <p className="text-xs text-slate-500">Aucune boutique n'a été créée pour le moment. Soyez le tout premier vendeur à lancer votre live !</p>
                <button 
                  onClick={() => navigateTo('register')}
                  className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-xl text-xs font-bold transition"
                >
                  Lancer mon premier Live en 2 minutes
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {publicLives.map((live, idx) => {
                  const isLiveActive = live.status === 'ACTIVE' || live.status === 'SOLD_OUT';
                  return (
                    <motion.div 
                      key={live.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: Math.min(idx * 0.05, 0.4) }}
                      className={`relative bg-slate-900/40 border rounded-2xl overflow-hidden flex flex-col justify-between transition hover:shadow-xl hover:shadow-indigo-950/5 group ${
                        isLiveActive ? 'border-indigo-500/20 hover:border-indigo-500/40' : 'border-slate-900 hover:border-slate-800'
                      }`}
                    >
                      {/* Top banner / Image placeholder if none provided */}
                      <div className="h-28 w-full bg-gradient-to-br from-indigo-950/40 to-slate-900 relative flex items-center justify-center border-b border-slate-950">
                        {live.imageUrl ? (
                          <img 
                            src={live.imageUrl} 
                            alt={live.title} 
                            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition duration-300" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/30 via-slate-950 to-slate-950 opacity-80" />
                        )}
                        
                        {/* Status label floating */}
                        <div className="absolute top-3 right-3">
                          {live.status === 'ACTIVE' && (
                            <span className="bg-red-600 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              En Direct
                            </span>
                          )}
                          {live.status === 'SOLD_OUT' && (
                            <span className="bg-amber-600 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-full shadow-md uppercase">
                              Épuisé 🔥
                            </span>
                          )}
                          {live.status === 'SCHEDULED' && (
                            <span className="bg-blue-600 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-full shadow-md uppercase">
                              Programmé 📅
                            </span>
                          )}
                          {live.status === 'ENDED' && (
                            <span className="bg-slate-800 text-slate-300 text-[9px] font-extrabold px-2.5 py-1 rounded-full shadow-md uppercase">
                              Terminé 🏁
                            </span>
                          )}
                        </div>

                        {/* Title overlay in banner */}
                        <div className="absolute bottom-3 left-3 right-3 text-left">
                          <h3 className="text-xs font-black text-white drop-shadow-md truncate">{live.title}</h3>
                          <p className="text-[10px] text-indigo-300 drop-shadow-sm font-semibold truncate">@{live.slug}</p>
                        </div>
                      </div>

                      {/* Content Card Info */}
                      <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between bg-slate-950/20">
                        <p className="text-[11px] text-slate-400 line-clamp-2 h-8 text-left leading-relaxed">
                          {live.description || "Aucune description fournie pour cette vente flash en direct."}
                        </p>

                        <div className="flex items-center justify-between border-t border-slate-900/60 pt-3 text-[10px] text-slate-400">
                          <div>
                            <span className="font-semibold block text-slate-300 truncate max-w-[130px]">{live.seller?.name || 'Boutique Orion'}</span>
                            <span className="text-[8px] text-slate-500 uppercase font-bold">Vendeur</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold block text-indigo-400">{live.products?.length || 0} Articles</span>
                            <span className="text-[8px] text-slate-500 uppercase font-bold">Catalogue</span>
                          </div>
                        </div>

                        {/* Button Action */}
                        <button 
                          onClick={() => navigateTo(`live/${live.slug}`)}
                          className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mt-2 ${
                            isLiveActive 
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10' 
                              : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800'
                          }`}
                        >
                          <span>{isLiveActive ? "Rejoindre le Live" : "Consulter la boutique"}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16">
            <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-2xl text-left space-y-3 hover:border-indigo-500/10 transition duration-300">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/15 flex items-center justify-center text-indigo-400">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Durée Éphémère de 24h</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Les ventes s'arrêtent automatiquement après 24h pour provoquer une urgence absolue et déclencher l'acte d'achat instantané.</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-2xl text-left space-y-3 hover:border-indigo-500/10 transition duration-300">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/15 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Prise de Commande Sécurisée</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Les réservations en direct s'appuient sur des verrous transactionnels PostgreSQL (Neon) ultra-rapides. Zéro survente.</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-2xl text-left space-y-3 hover:border-indigo-500/10 transition duration-300">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/15 flex items-center justify-center text-indigo-400">
                <Phone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Validation Par WhatsApp</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Récupérez directement les coordonnées de l'acheteur pour valider sa commande et lui envoyer le lien de paiement en 1-clic.</p>
            </div>
          </div>
        </main>

        <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-500 relative z-10 bg-slate-950">
          <p>© 2026 Orion Live SaaS Inc. Tous droits réservés. Connecté à la base de données Neon PostgreSQL.</p>
        </footer>
        {renderToast()}
      </div>
    );
  }

  // ====================================================================
  // 2. REGISTER SCREEN
  // ====================================================================
  if (route === 'register') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100" id="register-view">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
          <div className="flex flex-col justify-center items-center space-y-3">
            <img 
              src={orionLogo} 
              alt="Orion Live Logo" 
              className="h-20 w-20 rounded-2xl border border-slate-800 object-cover shadow-2xl animate-pulse" 
              referrerPolicy="no-referrer"
            />
            <span className="text-2xl font-black text-white">Orion<span className="text-indigo-400 font-light">.live</span></span>
          </div>
          <h2 className="text-lg font-bold">Créer votre espace commerçant</h2>
          <p className="text-xs text-slate-400">Remplissez les informations ci-dessous pour démarrer vos lives.</p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-slate-900 border border-slate-850 py-8 px-4 shadow-xl rounded-2xl sm:px-10 space-y-6">
            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold">Nom complet / Nom de boutique</label>
                <input 
                  type="text" 
                  required 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="ex. Sarah Créations Bijoux"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold">Adresse Email</label>
                <input 
                  type="email" 
                  required 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="vendeur@email.com"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold">Mot de passe</label>
                <input 
                  type="password" 
                  required 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="Min. 8 caractères (lettre + chiffre)"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold">Confirmer le mot de passe</label>
                <input 
                  type="password" 
                  required 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="Confirmer votre mot de passe"
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                />
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-600/10"
              >
                Créer mon compte
              </button>
            </form>

            <div className="text-center pt-2">
              <button onClick={() => navigateTo('login')} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition">
                Déjà un compte ? Connectez-vous ici
              </button>
            </div>
          </div>
        </div>
        {renderToast()}
      </div>
    );
  }

  // ====================================================================
  // 3. LOGIN SCREEN
  // ====================================================================
  if (route === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100" id="login-view">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
          <div className="flex flex-col justify-center items-center space-y-3">
            <img 
              src={orionLogo} 
              alt="Orion Live Logo" 
              className="h-20 w-20 rounded-2xl border border-slate-800 object-cover shadow-2xl" 
              referrerPolicy="no-referrer"
            />
            <span className="text-2xl font-black text-white">Orion<span className="text-indigo-400 font-light">.live</span></span>
          </div>
          <h2 className="text-lg font-bold">Connexion à la plateforme</h2>
          <p className="text-xs text-slate-400">Saisissez vos identifiants pour accéder à vos tableaux de bord.</p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-slate-900 border border-slate-850 py-8 px-4 shadow-xl rounded-2xl sm:px-10 space-y-6">
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold">Adresse Email</label>
                <input 
                  type="email" 
                  required 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="vendeur@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold">Mot de passe</label>
                <input 
                  type="password" 
                  required 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="Saisissez votre mot de passe"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
              >
                Se connecter
              </button>
            </form>

            <div className="text-center pt-2">
              <button onClick={() => navigateTo('register')} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition">
                Pas encore de compte ? Inscrivez-vous gratuitement
              </button>
            </div>
          </div>
        </div>
        {renderToast()}
      </div>
    );
  }

  // ====================================================================
  // 4. SELLER DASHBOARD VIEW (Requires SELLER or ADMIN role)
  // ====================================================================
  if (route === 'dashboard') {
    // 401 Protected Route Handler
    if (!user) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6" id="401-unauthorized">
          <div className="bg-slate-900 border border-rose-500/20 max-w-md w-full rounded-2xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-rose-600/10 flex items-center justify-center mx-auto text-rose-400 border border-rose-500/20">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Accès Protégé (401)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Vous tentez d'accéder à l'espace vendeur sécurisé, mais vous n'êtes pas authentifié. Veuillez vous connecter avec vos identifiants Orion.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigateTo('')} className="bg-slate-800 hover:bg-slate-750 text-slate-300 py-2 rounded-xl text-xs font-bold transition">
                Accueil
              </button>
              <button onClick={() => navigateTo('login')} className="bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-xs font-bold transition">
                Se connecter
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col" id="dashboard-view">
        {/* Header */}
        <header className="border-b border-slate-900 px-6 py-4 flex justify-between items-center bg-slate-900/40 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <img 
              src={orionLogo} 
              alt="Orion Live Logo" 
              className="h-8 w-8 rounded-lg border border-slate-800 object-cover" 
              referrerPolicy="no-referrer"
            />
            <span className="font-extrabold text-white text-md">Orion <span className="text-indigo-400">Vendeur</span></span>
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <div className="hidden sm:flex flex-col text-right">
              <span className="font-bold text-white text-[11px]">{user.name}</span>
              <span className="text-[10px] text-indigo-400 font-semibold uppercase">{user.role}</span>
            </div>
            {user.role === 'ADMIN' && (
              <button 
                onClick={() => navigateTo('admin')}
                className="bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 px-3 py-1.5 rounded-xl font-bold transition"
              >
                Menu Admin
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-400 transition flex items-center gap-1 font-bold"
            >
              <LogOut className="w-4 h-4" /> Déconnexion
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col space-y-8">
          
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">Réservations</span>
                <p className="text-xl font-black text-white">{analytics?.totalReservationsCount || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">Chiffre d'Affaires</span>
                <p className="text-xl font-black text-white">{(analytics?.totalEarnings || 0).toLocaleString('fr-FR')} FCFA</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <Tag className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">Intérêts Marqués</span>
                <p className="text-xl font-black text-white">{analytics?.totalInterestsCount || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-pink-500/15 flex items-center justify-center text-pink-400">
                <Heart className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">Pré-inscriptions</span>
                <p className="text-xl font-black text-white">{analytics?.preRegistrationsCount || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-400">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">Visiteurs Pré-live</span>
                <p className="text-xl font-black text-white">{analytics?.preVisitorsCount || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Navigation Tab */}
          <div className="flex border-b border-slate-850">
            <button 
              onClick={() => setSellerTab('lives')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                sellerTab === 'lives' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video className="w-4 h-4" /> Vos Sessions Live
            </button>
            <button 
              onClick={() => setSellerTab('products')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                sellerTab === 'products' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-4 h-4" /> Catalogue Produits
            </button>
            <button 
              onClick={() => setSellerTab('analytics')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                sellerTab === 'analytics' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Centre de Contrôle & Analytics
            </button>
          </div>

          {/* Tab Contents: LIVES */}
          {sellerTab === 'lives' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-md font-bold text-white">Sessions de Directs</h3>
                  <p className="text-xs text-slate-400">Planifiez vos boutiques éphémères limitées à 24 heures maximum.</p>
                </div>
                <button 
                  onClick={() => { resetLiveForm(); setShowLiveModal(true); }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/15"
                >
                  <Plus className="w-4 h-4" /> Nouveau Live
                </button>
              </div>

              {lives.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-850 p-12 text-center rounded-2xl space-y-3">
                  <Video className="w-12 h-12 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-300">Aucune boutique live configurée</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">Créez votre premier live temporaire et associez-lui des articles de votre catalogue.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Active / Scheduled / Draft Section */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase text-indigo-400 tracking-wider">Sessions Actives & Planifiées</h4>
                    {lives.filter(l => l.status !== 'ARCHIVED').length === 0 ? (
                      <p className="text-xs text-slate-500 italic bg-slate-900/20 border border-slate-850 p-4 rounded-xl">Aucune session active ou planifiée.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {lives.filter(l => l.status !== 'ARCHIVED').map(l => (
                          <div key={l.id} className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-md flex flex-col justify-between">
                            <div className="p-5 space-y-4">
                              <div className="flex justify-between items-start">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  l.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20 animate-pulse' :
                                  l.status === 'DRAFT' ? 'bg-slate-800 text-slate-400' :
                                  l.status === 'SCHEDULED' ? 'bg-blue-950 text-blue-400 border border-blue-500/20' :
                                  l.status === 'INACTIVE' ? 'bg-slate-800 text-amber-500 border border-slate-700' :
                                  l.status === 'SOLD_OUT' ? 'bg-amber-950 text-amber-400 border border-amber-500/20' :
                                  'bg-rose-950 text-rose-400'
                                }`}>
                                  {l.status}
                                </span>
                                
                                {/* Lifecycle Buttons */}
                                <div className="flex items-center space-x-1">
                                  {l.status === 'DRAFT' && (
                                    <>
                                      <button 
                                        onClick={() => handleToggleLiveStatus(l, 'SCHEDULED')}
                                        className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded font-bold transition"
                                      >
                                        Planifier
                                      </button>
                                      <button 
                                        onClick={() => handleToggleLiveStatus(l, 'ACTIVE')}
                                        className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded font-bold transition"
                                      >
                                        Lancer
                                      </button>
                                    </>
                                  )}
                                  {l.status === 'SCHEDULED' && (
                                    <>
                                      <button 
                                        onClick={() => handleToggleLiveStatus(l, 'ACTIVE')}
                                        className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded font-bold transition"
                                      >
                                        Démarrer le Live
                                      </button>
                                      <button 
                                        onClick={() => handleToggleLiveStatus(l, 'INACTIVE')}
                                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-bold transition"
                                      >
                                        Désactiver
                                      </button>
                                    </>
                                  )}
                                  {l.status === 'ACTIVE' && (
                                    <>
                                      <button 
                                        onClick={() => handleToggleLiveStatus(l, 'SOLD_OUT')}
                                        className="text-[10px] bg-amber-600 hover:bg-amber-500 text-white px-2 py-0.5 rounded font-bold transition"
                                      >
                                        Épuisé
                                      </button>
                                      <button 
                                        onClick={() => handleToggleLiveStatus(l, 'INACTIVE')}
                                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-bold transition"
                                      >
                                        Désactiver
                                      </button>
                                      <button 
                                        onClick={() => handleToggleLiveStatus(l, 'ENDED')}
                                        className="text-[10px] bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 rounded font-bold transition"
                                      >
                                        Clôturer
                                      </button>
                                    </>
                                  )}
                                  {l.status === 'SOLD_OUT' && (
                                    <>
                                      <button 
                                        onClick={() => handleToggleLiveStatus(l, 'ACTIVE')}
                                        className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded font-bold transition"
                                      >
                                        Activer
                                      </button>
                                      <button 
                                        onClick={() => handleToggleLiveStatus(l, 'INACTIVE')}
                                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-bold transition"
                                      >
                                        Désactiver
                                      </button>
                                      <button 
                                        onClick={() => handleToggleLiveStatus(l, 'ENDED')}
                                        className="text-[10px] bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 rounded font-bold transition"
                                      >
                                        Clôturer
                                      </button>
                                    </>
                                  )}
                                  {l.status === 'INACTIVE' && (
                                    <>
                                      <button 
                                        onClick={() => handleToggleLiveStatus(l, 'SCHEDULED')}
                                        className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded font-bold transition"
                                      >
                                        Planifier
                                      </button>
                                      <button 
                                        onClick={() => handleToggleLiveStatus(l, 'ACTIVE')}
                                        className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded font-bold transition"
                                      >
                                        Démarrer
                                      </button>
                                    </>
                                  )}
                                  {l.status === 'ENDED' && (
                                    <button 
                                      onClick={() => { setReactivateLiveId(l.id); setShowReactivateModal(true); }}
                                      className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded font-bold transition"
                                    >
                                      Réactiver
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-white line-clamp-1">{l.title}</h4>
                                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{l.description}</p>
                              </div>

                              <div className="text-[11px] text-slate-400 space-y-1.5 pt-3 border-t border-slate-850">
                                <div className="flex justify-between">
                                  <span>Lien boutique :</span>
                                  <a 
                                    href={`#live/${l.slug}`} 
                                    target="_blank" 
                                    className="text-indigo-400 hover:underline flex items-center gap-0.5"
                                  >
                                    /{l.slug} <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                                <div className="flex justify-between">
                                  <span>Début :</span>
                                  <span>{new Date(l.start_date).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Fin :</span>
                                  <span>{new Date(l.end_date).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-slate-950/80 px-5 py-3 border-t border-slate-850/50 flex justify-between gap-2">
                              <button 
                                onClick={() => handleEditLiveClick(l)}
                                className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 transition"
                              >
                                <Edit className="w-3.5 h-3.5" /> Éditer
                              </button>
                              <button 
                                onClick={() => {
                                  fetch(`/api/lives/${l.id}/analytics`)
                                    .then(r => r.json())
                                    .then(data => {
                                      setSelectedLiveAnalytics({
                                        ...data,
                                        title: l.title,
                                        isArchived: false
                                      });
                                      setShowLiveAnalyticsModal(true);
                                    })
                                    .catch(err => {
                                      console.error(err);
                                      showToast("Erreur lors de la récupération des analytiques.", "error");
                                    });
                                }}
                                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
                              >
                                <BarChart3 className="w-3.5 h-3.5" /> Analytiques
                              </button>
                              <button 
                                onClick={() => handleDeleteLive(l.id)}
                                className="text-xs font-bold text-rose-500 hover:text-rose-400 flex items-center gap-1 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Effacer
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Archived History Section */}
                  <div className="space-y-4 pt-4 border-t border-slate-850">
                    <h4 className="text-xs font-bold uppercase text-purple-400 tracking-wider">Historique des Sessions Archivées</h4>
                    {lives.filter(l => l.status === 'ARCHIVED').length === 0 ? (
                      <p className="text-xs text-slate-500 italic bg-slate-900/10 border border-slate-850/50 p-4 rounded-xl">Aucune session archivée dans l'historique.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {lives.filter(l => l.status === 'ARCHIVED').map(l => (
                          <div key={l.id} className="bg-slate-900/60 border border-slate-850 rounded-2xl overflow-hidden shadow-md flex flex-col justify-between opacity-75 hover:opacity-100 transition">
                            <div className="p-5 space-y-4">
                              <div className="flex justify-between items-start">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-950 text-purple-400 border border-purple-500/20">
                                  ARCHIVÉ
                                </span>
                                
                                <button 
                                  onClick={() => { setReactivateLiveId(l.id); setShowReactivateModal(true); }}
                                  className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded font-bold transition"
                                >
                                  Réactiver
                                </button>
                              </div>

                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-slate-300 line-clamp-1">{l.title}</h4>
                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{l.description}</p>
                              </div>

                              <div className="text-[11px] text-slate-500 space-y-1.5 pt-3 border-t border-slate-850">
                                <div className="flex justify-between">
                                  <span>Slug archive :</span>
                                  <span className="font-mono text-slate-400">{l.slug}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Session du :</span>
                                  <span>{new Date(l.start_date).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-slate-950/80 px-5 py-3 border-t border-slate-850/50 flex justify-end gap-2">
                              <button 
                                onClick={() => {
                                  fetch(`/api/lives/${l.id}/analytics`)
                                    .then(r => r.json())
                                    .then(data => {
                                      setSelectedLiveAnalytics({
                                        ...data,
                                        title: l.title,
                                        isArchived: true
                                      });
                                      setShowLiveAnalyticsModal(true);
                                    })
                                    .catch(err => {
                                      console.error(err);
                                      showToast("Erreur lors de la récupération des analytiques.", "error");
                                    });
                                }}
                                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
                              >
                                <BarChart3 className="w-3.5 h-3.5" /> Rapport Final
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab Contents: PRODUCTS */}
          {sellerTab === 'products' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-md font-bold text-white">Articles & Produits</h3>
                  <p className="text-xs text-slate-400">Gérez le catalogue des articles disponibles à la vente en direct.</p>
                </div>
                <button 
                  onClick={() => { resetProductForm(); setShowProductModal(true); }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/15"
                >
                  <Plus className="w-4 h-4" /> Nouveau Produit
                </button>
              </div>

              {products.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-850 p-12 text-center rounded-2xl space-y-3">
                  <Package className="w-12 h-12 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-300">Votre catalogue est vide</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">Ajoutez vos premiers articles avec leurs prix et stocks pour pouvoir les lier à vos diffusions live.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map(p => (
                    <div key={p.id} className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-md flex flex-col justify-between">
                      <div className="h-40 bg-slate-950 relative">
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                        <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-800 text-indigo-400 px-2 py-0.5 rounded text-xs font-bold">
                          {p.price.toLocaleString('fr-FR')} FCFA
                        </div>
                      </div>

                      <div className="p-5 space-y-2 flex-1">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-white truncate max-w-[200px]">{p.name}</h4>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            p.stock > 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}>
                            {p.stock} en stock
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{p.description}</p>
                      </div>

                      <div className="bg-slate-950/60 px-5 py-3 border-t border-slate-850/50 flex justify-between">
                        <button 
                          onClick={() => handleEditProductClick(p)}
                          className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 transition"
                        >
                          <Edit className="w-3.5 h-3.5" /> Éditer
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(p.id)}
                          className="text-xs font-bold text-rose-500 hover:text-rose-400 flex items-center gap-1 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Contents: CONTROL CENTER & REAL-TIME ANALYTICS */}
          {sellerTab === 'analytics' && (
            <div className="space-y-8" id="control-center-view">
              {/* Header Selector Row */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-5 rounded-2xl border border-slate-850">
                <div className="space-y-1">
                  <h3 className="text-md font-bold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Supervision en Direct (SaaS V1)
                  </h3>
                  <p className="text-xs text-slate-400">Suivi et transformation d'audience en temps réel pour vos lives TikTok.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-none">
                    <select
                      value={selectedAnalyticsLiveId}
                      onChange={(e) => setSelectedAnalyticsLiveId(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-indigo-500 w-full md:w-64 appearance-none pr-8 cursor-pointer"
                    >
                      {lives.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.title} ({l.status})
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      ▼
                    </div>
                  </div>

                  <button
                    onClick={() => fetchActiveLiveAnalytics(selectedAnalyticsLiveId)}
                    className="p-2.5 bg-slate-850 hover:bg-slate-800 text-indigo-400 rounded-xl transition border border-slate-850 flex items-center justify-center"
                    title="Rafraîchir"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {lives.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-850 p-12 text-center rounded-2xl space-y-3">
                  <BarChart3 className="w-12 h-12 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-300">Aucune session live enregistrée</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Créez d'abord une session dans l'onglet "Vos Sessions Live" pour lancer votre supervision en direct.
                  </p>
                </div>
              ) : !activeLiveStats ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-xs text-slate-400">Chargement des indicateurs temps réel...</p>
                </div>
              ) : (
                <div className="space-y-8 animate-fade-in">
                  {/* KPI Cards Row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Visiteurs uniques</span>
                        <p className="text-lg font-black text-white">{activeLiveStats.uniqueVisitorsCount || 0}</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Réservations</span>
                        <p className="text-lg font-black text-emerald-400">{activeLiveStats.reservationsCount || 0}</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                        <ShoppingCart className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Intérêts (Favoris)</span>
                        <p className="text-lg font-black text-pink-400">{activeLiveStats.interestsCount || 0}</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-pink-500/15 flex items-center justify-center text-pink-400">
                        <Heart className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Conversion Pré-inc.</span>
                        <p className="text-lg font-black text-violet-400">{activeLiveStats.preRegistrationConversionRate || 0}%</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-400">
                        <CheckSquare className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Activity Timeline Chart Row */}
                  <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl space-y-6" id="reservation-timeline-chart-card">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-400" />
                          Fréquence & Cumul des Réservations
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Suivi dynamique des flux de commandes et de la progression globale sur la durée de la session.
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-1.5 rounded-full bg-indigo-500/30 border border-indigo-500"></span>
                          <span>Par intervalle</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Cumul total</span>
                        </div>
                      </div>
                    </div>

                    <div className="h-72 w-full text-xs">
                      {activeLiveStats.timeline && activeLiveStats.timeline.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={activeLiveStats.timeline}
                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="colorReservations" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                            <XAxis 
                              dataKey="time" 
                              stroke="#64748b" 
                              fontSize={10}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              yAxisId="left"
                              stroke="#64748b" 
                              fontSize={10}
                              tickLine={false}
                              axisLine={false}
                              allowDecimals={false}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              stroke="#64748b" 
                              fontSize={10}
                              tickLine={false}
                              axisLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#0f172a', 
                                border: '1px solid #1e293b',
                                borderRadius: '0.75rem',
                                color: '#f8fafc',
                                fontSize: '11px',
                                fontFamily: 'inherit'
                              }}
                              cursor={{ stroke: '#334155', strokeWidth: 1 }}
                            />
                            <Area 
                              yAxisId="left"
                              type="monotone" 
                              dataKey="reservations" 
                              name="Réservations (flux)" 
                              stroke="#6366f1" 
                              strokeWidth={2}
                              fillOpacity={1} 
                              fill="url(#colorReservations)" 
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="cumulativeReservations" 
                              name="Total cumulé" 
                              stroke="#10b981" 
                              strokeWidth={3}
                              dot={{ r: 4, strokeWidth: 2, fill: '#0f172a' }}
                              activeDot={{ r: 6, strokeWidth: 2 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                          <Activity className="w-8 h-8 text-slate-600 animate-pulse" />
                          <span>Aucune donnée temporelle disponible pour cette session.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Main Grid: Prospects vs Products */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* LEFT COLUMN: HOT PROSPECTS */}
                    <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between">
                      <div className="p-5 border-b border-slate-850 flex justify-between items-center bg-slate-950/40">
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <span className="text-rose-500 animate-pulse">🔥</span>
                            Prospects Chauds (Scoring)
                          </h4>
                          <p className="text-[10px] text-slate-400">Triés par engagement thermique.</p>
                        </div>
                        <button
                          onClick={() => handleExportProspects(activeHotProspects)}
                          className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border border-slate-750"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Exporter (CSV)
                        </button>
                      </div>

                      <div className="p-5 flex-1 divide-y divide-slate-850/60 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                        {activeHotProspects.length === 0 ? (
                          <div className="py-12 text-center text-slate-500 text-xs">
                            En attente des premières actions de l'audience sur la boutique...
                          </div>
                        ) : (
                          activeHotProspects.map((p, idx) => (
                            <div key={idx} className="py-4 flex items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-black text-white">{p.pseudo}</span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                    p.score >= 100 ? 'bg-rose-950 text-rose-400 border border-rose-800/20' :
                                    p.score >= 40 ? 'bg-amber-950 text-amber-400' :
                                    'bg-slate-850 text-slate-400'
                                  }`}>
                                    Score : {p.score} pt
                                  </span>
                                </div>
                                <div className="flex items-center space-x-3 text-[10px] text-slate-400">
                                  {p.whatsapp ? (
                                    <a
                                      href={`https://api.whatsapp.com/send?phone=${encodeURIComponent(p.whatsapp)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                                    >
                                      WhatsApp : {p.whatsapp} ↗
                                    </a>
                                  ) : (
                                    <span className="text-slate-500 italic">Aucun WhatsApp</span>
                                  )}
                                  <span>•</span>
                                  <span>{p.saved_count || 0} listes</span>
                                  <span>•</span>
                                  <span>{p.reserved_count || 0} rés.</span>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                {p.has_requested_contact && (
                                  <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-900 text-[9px] font-bold">
                                    Demande contact 📞
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* RIGHT COLUMN: POPULAR PRODUCTS */}
                    <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between">
                      <div className="p-5 border-b border-slate-850 flex justify-between items-center bg-slate-950/40">
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <ShoppingCart className="w-4 h-4 text-emerald-400" />
                            Produits Populaires & Stock
                          </h4>
                          <p className="text-[10px] text-slate-400">Rapports de ventes et de conversions de stock.</p>
                        </div>
                        <button
                          onClick={() => handleExportReservations(activePopularProducts)}
                          className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border border-slate-750"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Exporter (CSV)
                        </button>
                      </div>

                      <div className="p-5 flex-1 divide-y divide-slate-850/60 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                        {activePopularProducts.length === 0 ? (
                          <div className="py-12 text-center text-slate-500 text-xs">
                            Aucun produit lié à cette session de direct.
                          </div>
                        ) : (
                          activePopularProducts.map((p, idx) => {
                            const totalRev = (p.reservations || 0) * p.price;
                            return (
                              <div key={idx} className="py-4 flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-bold text-white">{p.name}</span>
                                    <span className="text-[10px] font-bold text-slate-400">{p.price.toLocaleString('fr-FR')} FCFA</span>
                                  </div>
                                  <div className="flex items-center space-x-3 text-[10px] text-slate-400">
                                    <span className="text-emerald-400 font-bold">Réservé : {p.reservations || 0} p.</span>
                                    <span>•</span>
                                    <span>Vues : {p.views || 0}</span>
                                    <span>•</span>
                                    <span>Stock : {p.stock}</span>
                                  </div>
                                </div>

                                <div className="text-right space-y-0.5">
                                  <p className="text-xs font-black text-indigo-400">{totalRev.toLocaleString('fr-FR')} FCFA</p>
                                  <p className="text-[8px] text-slate-500 uppercase font-black">Revenus</p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* MODAL CREATION LIVE */}
        {showLiveModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">{liveEditId ? "Modifier la boutique Live" : "Créer une boutique Live"}</h3>
                  {liveEditId && (
                    <span className="px-2 py-0.5 bg-indigo-950 text-indigo-400 border border-indigo-500/20 rounded text-[9px] font-bold uppercase">
                      Statut actuel : {lives.find(l => l.id === liveEditId)?.status}
                    </span>
                  )}
                </div>
                <button onClick={() => setShowLiveModal(false)} className="text-slate-400 hover:text-white text-xs font-bold">Fermer</button>
              </div>

              <form onSubmit={handleCreateOrUpdateLive} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Titre du direct *</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-slate-600"
                    placeholder="ex. Vente Live de Noël 🎄"
                    value={liveFormTitle}
                    onChange={(e) => setLiveFormTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Slug de boutique unique *</label>
                  <div className="flex">
                    <span className="bg-slate-950 border border-r-0 border-slate-800 rounded-l-xl px-3.5 py-2.5 text-xs text-slate-500 font-medium">/lives/</span>
                    <input 
                      type="text" 
                      required 
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-r-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-slate-600"
                      placeholder="vente-noel"
                      value={liveFormSlug}
                      onChange={(e) => setLiveFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                    />
                  </div>
                  <span className="text-[9px] text-slate-500 block pl-1">Les acheteurs rejoindront votre direct avec ce lien.</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Description de la session</label>
                  <textarea 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white h-20 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-slate-600 resize-none"
                    placeholder="Décrivez les lots, les modalités de paiement..."
                    value={liveFormDesc}
                    onChange={(e) => setLiveFormDesc(e.target.value)}
                  />
                </div>

                {/* Section Date & Time Separated */}
                <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-850/60">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Planification Horaire</span>
                  </div>

                  <div className="space-y-4">
                    {/* Start Date & Time */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Début du Direct</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-semibold">Date *</label>
                          <div className="relative">
                            <input 
                              type="date" 
                              required 
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
                              value={splitDateTime(liveFormStart).date}
                              onChange={(e) => {
                                const { time } = splitDateTime(liveFormStart);
                                setLiveFormStart(combineDateTime(e.target.value, time || '12:00'));
                              }}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-semibold">Heure *</label>
                          <input 
                            type="time" 
                            required 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
                            value={splitDateTime(liveFormStart).time}
                            onChange={(e) => {
                              const { date } = splitDateTime(liveFormStart);
                              setLiveFormStart(combineDateTime(date, e.target.value));
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* End Date & Time */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Fin du Direct (Max +24h)</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-semibold">Date *</label>
                          <input 
                            type="date" 
                            required 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
                            value={splitDateTime(liveFormEnd).date}
                            onChange={(e) => {
                              const { time } = splitDateTime(liveFormEnd);
                              setLiveFormEnd(combineDateTime(e.target.value, time || '13:00'));
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-semibold">Heure *</label>
                          <input 
                            type="time" 
                            required 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
                            value={splitDateTime(liveFormEnd).time}
                            onChange={(e) => {
                              const { date } = splitDateTime(liveFormEnd);
                              setLiveFormEnd(combineDateTime(date, e.target.value));
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real-time schedule validation feedback */}
                {(() => {
                  const error = getLiveFormError();
                  const duration = getLiveDurationText(liveFormStart, liveFormEnd);
                  if (error) {
                    return (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium leading-relaxed flex items-start gap-2">
                        <span className="text-sm">⚠️</span>
                        <span>{error}</span>
                      </div>
                    );
                  } else if (duration) {
                    return (
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold leading-relaxed flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                          <span className="text-emerald-400 text-sm">✓</span> Plage horaire valide
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/10 rounded-md">{duration}</span>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">URL Image de couverture (Facultatif)</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-slate-600"
                    placeholder="https://images.unsplash.com/..."
                    value={liveFormImg}
                    onChange={(e) => setLiveFormImg(e.target.value)}
                  />
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-850">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Associer des produits ({products.length} disponibles)</label>
                  {products.length === 0 ? (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-xs text-amber-400 font-medium">
                      Créez d'abord des produits dans votre catalogue.
                    </div>
                  ) : (
                    <div className="max-h-32 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800">
                      {products.map(p => (
                        <label key={p.id} className="flex items-center space-x-2.5 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 w-3.5 h-3.5 transition-all"
                            checked={liveFormSelectedProducts.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setLiveFormSelectedProducts([...liveFormSelectedProducts, p.id]);
                              } else {
                                setLiveFormSelectedProducts(liveFormSelectedProducts.filter(id => id !== p.id));
                              }
                            }}
                          />
                          <span className="truncate flex-1">{p.name}</span>
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded">{p.price.toLocaleString('fr-FR')} FCFA</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 hover:-translate-y-0.5 active:translate-y-0 duration-200"
                >
                  {liveEditId ? "Enregistrer les modifications" : "Lancer ma boutique temporaire"}
                </button>
              </form>
            </div>
          </div>
        )}

        {showReactivateModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex justify-between items-center">
                <h3 className="text-sm font-bold text-white">Réactiver la session Live</h3>
                <button 
                  onClick={() => { setShowReactivateModal(false); setReactivateLiveId(null); }} 
                  className="text-slate-400 hover:text-white text-xs font-bold transition"
                >
                  Fermer
                </button>
              </div>

              <form onSubmit={handleReactivateSubmit} className="p-6 space-y-4">
                <div className="bg-indigo-950/20 border border-indigo-500/20 p-4 rounded-xl space-y-2">
                  <p className="text-xs text-indigo-300 leading-relaxed font-bold">
                    Cette action va clore et archiver la session précédente (historique conservé) et initialiser une nouvelle période de vente avec le même lien public.
                  </p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Les produits liés à l'ancien live seront automatiquement associés à cette nouvelle session commerciale.
                  </p>
                </div>

                {/* Section Date & Time Separated for Reactivation */}
                <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-850/60">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Planification Horaire</span>
                  </div>

                  <div className="space-y-4">
                    {/* Reactivate Start Date & Time */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Début du Direct</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-semibold">Date *</label>
                          <input 
                            type="date" 
                            required 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
                            value={splitDateTime(reactivateStart).date}
                            onChange={(e) => {
                              const { time } = splitDateTime(reactivateStart);
                              setReactivateStart(combineDateTime(e.target.value, time || '12:00'));
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-semibold">Heure *</label>
                          <input 
                            type="time" 
                            required 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
                            value={splitDateTime(reactivateStart).time}
                            onChange={(e) => {
                              const { date } = splitDateTime(reactivateStart);
                              setReactivateStart(combineDateTime(date, e.target.value));
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Reactivate End Date & Time */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Fin du Direct (Max +24h)</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-semibold">Date *</label>
                          <input 
                            type="date" 
                            required 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
                            value={splitDateTime(reactivateEnd).date}
                            onChange={(e) => {
                              const { time } = splitDateTime(reactivateEnd);
                              setReactivateEnd(combineDateTime(e.target.value, time || '13:00'));
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-semibold">Heure *</label>
                          <input 
                            type="time" 
                            required 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
                            value={splitDateTime(reactivateEnd).time}
                            onChange={(e) => {
                              const { date } = splitDateTime(reactivateEnd);
                              setReactivateEnd(combineDateTime(date, e.target.value));
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real-time reactivation schedule validation feedback */}
                {(() => {
                  const error = getReactivateFormError();
                  const duration = getLiveDurationText(reactivateStart, reactivateEnd);
                  if (error) {
                    return (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium leading-relaxed flex items-start gap-2">
                        <span className="text-sm">⚠️</span>
                        <span>{error}</span>
                      </div>
                    );
                  } else if (duration) {
                    return (
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold leading-relaxed flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                          <span className="text-emerald-400 text-sm">✓</span> Plage horaire valide
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/10 rounded-md">{duration}</span>
                      </div>
                    );
                  }
                  return null;
                })()}

                <button 
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 hover:-translate-y-0.5 active:translate-y-0 duration-200 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" /> Initialiser la nouvelle session
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL CREATION PRODUIT */}
        {showProductModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex justify-between items-center">
                <h3 className="text-sm font-bold text-white">{productEditId ? "Modifier le produit" : "Ajouter un produit au catalogue"}</h3>
                <button onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-white text-xs font-bold">Fermer</button>
              </div>

              <form onSubmit={handleCreateOrUpdateProduct} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Nom de l'article *</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-slate-600"
                    placeholder="ex. Veste Vintage Cuir"
                    value={productFormName}
                    onChange={(e) => setProductFormName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Description détaillée</label>
                  <textarea 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white h-24 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-slate-600 resize-none"
                    placeholder="Matériaux, taille, état..."
                    value={productFormDesc}
                    onChange={(e) => setProductFormDesc(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Prix unitaire (FCFA) *</label>
                    <input 
                      type="number" 
                      step="1"
                      required 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-slate-600"
                      placeholder="ex. 5000"
                      value={productFormPrice}
                      onChange={(e) => setProductFormPrice(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Stock disponible *</label>
                    <input 
                      type="number" 
                      required 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-slate-600"
                      placeholder="ex. 1"
                      value={productFormStock}
                      onChange={(e) => setProductFormStock(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">URL Image du produit</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder-slate-600"
                    placeholder="https://images.unsplash.com/..."
                    value={productFormImg}
                    onChange={(e) => setProductFormImg(e.target.value)}
                  />
                </div>

                <div className="pt-2">
                  <label className="flex items-center space-x-2.5 text-xs text-slate-300 font-bold cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 w-4 h-4 transition-all"
                      checked={productFormIsActive}
                      onChange={(e) => setProductFormIsActive(e.target.checked)}
                    />
                    <span>Produit disponible pour la vente</span>
                  </label>
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 hover:-translate-y-0.5 active:translate-y-0 duration-200"
                >
                  Enregistrer l'article
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL ANALYTIQUES DE SESSION */}
        {showLiveAnalyticsModal && selectedLiveAnalytics && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Rapport d'activité & Analytics</h3>
                </div>
                <button 
                  onClick={() => { setShowLiveAnalyticsModal(false); setSelectedLiveAnalytics(null); }} 
                  className="text-slate-450 hover:text-white text-xs font-bold transition"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Session Header Info */}
                <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl space-y-1">
                  <span className="text-[9px] font-extrabold uppercase text-indigo-400 tracking-wider">Session sélectionnée</span>
                  <h4 className="text-sm font-bold text-white">{selectedLiveAnalytics.title}</h4>
                  <div className="flex items-center gap-2 pt-1">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                      selectedLiveAnalytics.isArchived 
                        ? 'bg-purple-950 text-purple-400 border border-purple-500/20' 
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {selectedLiveAnalytics.isArchived ? 'Session Archivée' : 'Session Active'}
                    </span>
                  </div>
                </div>

                {/* Primary Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {/* Visiteurs Uniques */}
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Visiteurs Uniques</span>
                      <Users className="w-4 h-4 text-indigo-400" />
                    </div>
                    <p className="text-xl font-black text-white">{selectedLiveAnalytics.uniqueVisitorsCount || 0}</p>
                    <span className="text-[9px] text-slate-500 block">Sur toute la période du live</span>
                  </div>

                  {/* Réservations Totales */}
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Réservations</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-xl font-black text-emerald-400">{selectedLiveAnalytics.reservationsCount || 0}</p>
                    <span className="text-[9px] text-slate-500 block">Demandes d'achat validées</span>
                  </div>

                  {/* Articles mis en avant / Intérêts */}
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-2 col-span-2 sm:col-span-1">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Intérêts marqués</span>
                      <Heart className="w-4 h-4 text-pink-400" />
                    </div>
                    <p className="text-xl font-black text-pink-400">{selectedLiveAnalytics.interestsCount || 0}</p>
                    <span className="text-[9px] text-slate-500 block">Produits mis en favoris</span>
                  </div>
                </div>

                {/* Secondary/Pre-live Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Pré-inscriptions</span>
                      <p className="text-lg font-black text-white">{selectedLiveAnalytics.preRegistrationsCount || 0}</p>
                      <span className="text-[9px] text-slate-500 block">Acheteurs inscrits en attente</span>
                    </div>
                    <div className="w-10 h-10 bg-violet-500/10 text-violet-400 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Visiteurs Pré-live</span>
                      <p className="text-lg font-black text-white">{selectedLiveAnalytics.visitorsBeforeStartCount || 0}</p>
                      <span className="text-[9px] text-slate-500 block">Visiteurs sur la page d'attente</span>
                    </div>
                    <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Conversion Rate Card */}
                {!selectedLiveAnalytics.isArchived && (
                  <div className="bg-indigo-950/20 border border-indigo-900/40 p-4 rounded-xl flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-black text-indigo-400 block tracking-widest">Taux de conversion pré-inscrits</span>
                      <p className="text-xs text-slate-300">Proportion des pré-inscrits ayant rejoint le live après son lancement.</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-white">{selectedLiveAnalytics.preRegistrationConversionRate || 0}%</span>
                      <div className="w-24 bg-slate-950 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div 
                          style={{ width: `${selectedLiveAnalytics.preRegistrationConversionRate || 0}%` }} 
                          className="bg-indigo-500 h-full"
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-950 px-6 py-4 border-t border-slate-850 flex justify-end">
                <button 
                  onClick={() => { setShowLiveAnalyticsModal(false); setSelectedLiveAnalytics(null); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
                >
                  Fermer le rapport
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Toast */}
        {renderToast()}
      </div>
    );
  }

  // ====================================================================
  // 5. SUPER ADMIN CONTROL PANEL VIEW (Requires ADMIN role check in DB)
  // ====================================================================
  if (route === 'admin') {
    // 401 Protected Route Handler
    if (!user) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6" id="admin-unauthorized">
          <div className="bg-slate-900 border border-rose-500/20 max-w-md w-full rounded-2xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-rose-600/10 flex items-center justify-center mx-auto text-rose-400">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Accès Protégé (401)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Vous devez être connecté avec un compte administrateur pour accéder à ce menu d'administration globale d'Orion.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigateTo('')} className="bg-slate-800 hover:bg-slate-750 text-slate-300 py-2 rounded-xl text-xs font-bold transition">
                Accueil
              </button>
              <button onClick={() => navigateTo('login')} className="bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-xs font-bold transition">
                Se connecter
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 403 Forbidden Access Handler
    if (user.role !== 'ADMIN') {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6" id="403-forbidden">
          <div className="bg-slate-900 border border-rose-500/20 max-w-md w-full rounded-2xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-rose-600/10 flex items-center justify-center mx-auto text-rose-500 border border-rose-500/20">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Accès Refusé (403)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cette section d'administration système est réservée exclusivement aux Super Administrateurs Orion. Votre compte actuel possède le rôle de <strong>Vendeur (SELLER)</strong>.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigateTo('dashboard')} className="bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-xs font-bold transition">
                Espace Vendeur
              </button>
              <button onClick={handleLogout} className="bg-slate-800 hover:bg-slate-750 text-rose-400 py-2 rounded-xl text-xs font-bold transition">
                Changer de compte
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col" id="admin-view">
        {/* Header */}
        <header className="border-b border-slate-900 px-6 py-4 flex justify-between items-center bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center space-x-3">
            <img 
              src={orionLogo} 
              alt="Orion Live Logo" 
              className="h-8 w-8 rounded-lg border border-slate-800 object-cover" 
              referrerPolicy="no-referrer"
            />
            <span className="font-extrabold text-white text-md">Orion <span className="text-indigo-400 font-medium">Console SaaS Admin</span></span>
            {adminAlertsData?.unreadCount > 0 && (
              <span className="bg-rose-600/20 text-rose-400 text-[10px] font-black border border-rose-500/30 px-2 py-0.5 rounded-full animate-pulse">
                {adminAlertsData.unreadCount} ALERTES PLATFORME
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <button 
              onClick={fetchAdminData}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white transition flex items-center gap-1.5"
              title="Rafraîchir les métriques"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Rafraîchir</span>
            </button>
            <button 
              onClick={() => navigateTo('dashboard')}
              className="bg-indigo-950 text-indigo-300 border border-indigo-900/40 hover:bg-indigo-900/60 px-3 py-1.5 rounded-xl font-bold transition"
            >
              Aller à l'espace vendeur
            </button>
            <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 font-bold transition flex items-center gap-1">
              <LogOut className="w-4 h-4" /> Quitter
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row">
          {/* SaaS Navigation sidebar */}
          <aside className="w-full lg:w-64 bg-slate-900/20 border-b lg:border-b-0 lg:border-r border-slate-900 p-6 space-y-4">
            <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Pilotage Centralisé</span>
            <nav className="flex flex-col space-y-1">
              <button 
                onClick={() => setAdminTab('overview')}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
                  adminTab === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-4 h-4" /> Vue d'ensemble (Overview)
              </button>
              <button 
                onClick={() => setAdminTab('sellers')}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
                  adminTab === 'sellers' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4" /> Gestion des vendeurs
              </button>
              <button 
                onClick={() => setAdminTab('shops')}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
                  adminTab === 'shops' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Video className="w-4 h-4" /> Surveillance des boutiques
              </button>
              <button 
                onClick={() => setAdminTab('products')}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
                  adminTab === 'products' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Package className="w-4 h-4" /> Catalogue Produits global
              </button>
              <button 
                onClick={() => setAdminTab('monitoring')}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
                  adminTab === 'monitoring' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Activity className="w-4 h-4" /> Monitoring temps réel
              </button>
              <button 
                onClick={() => setAdminTab('audit')}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
                  adminTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" /> Journal d'audit d'activité
              </button>
              <button 
                onClick={() => setAdminTab('alerts')}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 justify-between ${
                  adminTab === 'alerts' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>Alertes de santé</span>
                </div>
                {adminAlertsData?.unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-rose-600 text-white text-[9px] font-extrabold rounded-full">
                    {adminAlertsData.unreadCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setAdminTab('cross-rec')}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 justify-between ${
                  adminTab === 'cross-rec' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4" />
                  <span>Recommandation Croisée</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${
                  adminCrossRecData?.enabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/30' : 'bg-slate-850 text-slate-500'
                }`}>
                  {adminCrossRecData?.enabled ? 'ON' : 'OFF'}
                </span>
              </button>
            </nav>
          </aside>

          {/* Main Content Pane */}
          <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-8">
            
            {/* TABS 1: OVERVIEW */}
            {adminTab === 'overview' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-md font-extrabold text-white">Console d'analyse globale de la plateforme</h2>
                  <p className="text-xs text-slate-400">Suivi consolidé de l'ensemble de l'activité multi-vendeurs et des conversions d'achat.</p>
                </div>

                {/* KPI Metrics row 1 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900/60 border border-slate-900 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Total Vendeurs</span>
                    <div className="flex justify-between items-end">
                      <p className="text-2xl font-black text-white">{adminDetailedStats?.totalSellers || 0}</p>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold">
                      Actifs : <span className="text-emerald-400">{adminDetailedStats?.activeSellers || 0}</span> | Suspendus : <span className="text-rose-400">{adminDetailedStats?.suspendedSellers || 0}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-900 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Boutiques actives</span>
                    <div className="flex justify-between items-end">
                      <p className="text-2xl font-black text-white">{adminDetailedStats?.activeShops || 0}</p>
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <Video className="w-4 h-4 animate-pulse" />
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold">
                      Programmées : <span className="text-indigo-400">{adminDetailedStats?.scheduledShops || 0}</span> | Clôturées : <span className="text-slate-400">{adminDetailedStats?.endedShops || 0}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-900 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Audience Platforme</span>
                    <div className="flex justify-between items-end">
                      <p className="text-2xl font-black text-white">{adminDetailedStats?.totalVisitors || 0}</p>
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                        <Activity className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold">
                      Cumulé de sessions uniques visiteurs
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-900 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Réservations Multi-vendeurs</span>
                    <div className="flex justify-between items-end">
                      <p className="text-2xl font-black text-white">{adminDetailedStats?.totalReservations || 0}</p>
                      <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold">
                      Produits uniques dans le catalogue : <span className="text-slate-300">{adminDetailedStats?.totalProducts || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Dashboard graphic distribution block */}
                <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-4">
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Répartition de l'activité globale</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 block font-bold">Statut Vendeurs</span>
                      <div className="w-full bg-slate-950 rounded-full h-2.5 flex overflow-hidden">
                        <div style={{ width: `${(adminDetailedStats?.activeSellers / (adminDetailedStats?.totalSellers || 1)) * 100}%` }} className="bg-emerald-500 h-full" title="Actifs"></div>
                        <div style={{ width: `${(adminDetailedStats?.suspendedSellers / (adminDetailedStats?.totalSellers || 1)) * 100}%` }} className="bg-rose-500 h-full" title="Suspendus"></div>
                        <div style={{ width: `${(adminDetailedStats?.pendingSellers / (adminDetailedStats?.totalSellers || 1)) * 100}%` }} className="bg-amber-500 h-full" title="En attente"></div>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-500">
                        <span>Actifs ({(adminDetailedStats?.activeSellers || 0)})</span>
                        <span>Suspendus ({(adminDetailedStats?.suspendedSellers || 0)})</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 block font-bold">Statut des Boutiques Live</span>
                      <div className="w-full bg-slate-950 rounded-full h-2.5 flex overflow-hidden">
                        <div style={{ width: `${(adminDetailedStats?.activeShops / ((adminDetailedStats?.activeShops + adminDetailedStats?.scheduledShops + adminDetailedStats?.endedShops) || 1)) * 100}%` }} className="bg-emerald-500 h-full" title="En Direct"></div>
                        <div style={{ width: `${(adminDetailedStats?.scheduledShops / ((adminDetailedStats?.activeShops + adminDetailedStats?.scheduledShops + adminDetailedStats?.endedShops) || 1)) * 100}%` }} className="bg-indigo-500 h-full" title="Programmées"></div>
                        <div style={{ width: `${(adminDetailedStats?.endedShops / ((adminDetailedStats?.activeShops + adminDetailedStats?.scheduledShops + adminDetailedStats?.endedShops) || 1)) * 100}%` }} className="bg-slate-700 h-full" title="Clôturées"></div>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-500">
                        <span>Directs ({(adminDetailedStats?.activeShops || 0)})</span>
                        <span>Plannifiés ({(adminDetailedStats?.scheduledShops || 0)})</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 block font-bold">Rendement de conversion</span>
                      <div className="bg-indigo-950/40 border border-indigo-900/30 rounded-xl p-3 flex justify-between items-center">
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider block">Taux Réservations / Visiteurs</span>
                          <span className="text-sm font-black text-white">
                            {adminDetailedStats?.totalVisitors > 0 ? ((adminDetailedStats.totalReservations / adminDetailedStats.totalVisitors) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                        <Activity className="w-5 h-5 text-indigo-400/50" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TABS 2: SELLERS */}
            {adminTab === 'sellers' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-md font-extrabold text-white">Sellers Management (Gestion des vendeurs)</h2>
                  <p className="text-xs text-slate-400">Visualisez les métriques de performance commerciale et suspendez ou réactivez les comptes des vendeurs instantanément.</p>
                </div>

                <div className="bg-slate-900 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                        <th className="p-4">Identité du vendeur</th>
                        <th className="p-4">Inscription</th>
                        <th className="p-4">Boutiques créées</th>
                        <th className="p-4">Réservations totales</th>
                        <th className="p-4">Statut</th>
                        <th className="p-4 text-right">Actions système</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {adminSellers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500 italic">Aucun vendeur enregistré sur la plateforme.</td>
                        </tr>
                      ) : (
                        adminSellers.map(seller => (
                          <tr key={seller.id} className="hover:bg-slate-850/30 transition text-slate-300">
                            <td className="p-4">
                              <div className="space-y-0.5">
                                <span className="font-bold text-white block">{seller.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono block">{seller.email}</span>
                              </div>
                            </td>
                            <td className="p-4 text-slate-400">{new Date(seller.createdAt).toLocaleDateString()}</td>
                            <td className="p-4">
                              <span className="font-bold text-slate-300">{seller.totalShops} boutiques</span>
                              {seller.activeShops > 0 && (
                                <span className="text-[10px] text-emerald-400 font-bold block">({seller.activeShops} actives actuellement)</span>
                              )}
                            </td>
                            <td className="p-4 font-black text-indigo-400">{seller.totalReservations} réservations</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase border ${
                                seller.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border-emerald-800/30' :
                                seller.status === 'SUSPENDED' ? 'bg-rose-950 text-rose-400 border-rose-800/30' :
                                'bg-amber-950 text-amber-400 border-amber-800/30'
                              }`}>
                                {seller.status === 'ACTIVE' ? 'Actif' :
                                 seller.status === 'SUSPENDED' ? 'Suspendu' :
                                 'En attente'}
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              {seller.status === 'ACTIVE' ? (
                                <button 
                                  onClick={() => handleToggleSellerStatus(seller.id, seller.status)}
                                  className="bg-rose-950 hover:bg-rose-900 border border-rose-900/30 text-rose-400 px-3 py-1 rounded-xl text-[10px] font-bold transition"
                                >
                                  Suspendre
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleToggleSellerStatus(seller.id, seller.status)}
                                  className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-900/30 text-emerald-400 px-3 py-1 rounded-xl text-[10px] font-bold transition"
                                >
                                  Réactiver
                                </button>
                              )}
                              <button 
                                onClick={() => handleDeleteUser(seller.id)}
                                className="bg-slate-800 hover:bg-rose-650 hover:text-white text-slate-400 px-2.5 py-1 rounded-xl text-[10px] font-bold transition"
                                title="Supprimer définitivement"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TABS 3: SHOPS */}
            {adminTab === 'shops' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-md font-extrabold text-white">Surveillance des boutiques live</h2>
                  <p className="text-xs text-slate-400">Modérez l'ensemble des sessions commerciales programmées ou diffusées par les différents marchands.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {adminShops.length === 0 ? (
                    <div className="md:col-span-2 bg-slate-900 border border-slate-900 p-12 text-center rounded-2xl italic text-slate-500">
                      Aucune boutique éphémère active ou planifiée.
                    </div>
                  ) : (
                    adminShops.map(shop => (
                      <div key={shop.id} className="bg-slate-900 border border-slate-900 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Par : {shop.sellerName}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              shop.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/30' :
                              shop.status === 'SCHEDULED' ? 'bg-indigo-950 text-indigo-400 border border-indigo-800/30' :
                              shop.status === 'INACTIVE' ? 'bg-rose-950 text-rose-400 border border-rose-800/30' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {shop.status}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white line-clamp-1">{shop.title}</h4>
                          
                          {/* Dedicated separate lines for date and hours as requested */}
                          <div className="text-[10px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-850 space-y-1">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-indigo-400" />
                              <span>Début : <strong>{new Date(shop.startDate).toLocaleDateString()}</strong> à <strong>{new Date(shop.startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong></span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-pink-400" />
                              <span>Fin : <strong>{new Date(shop.endDate).toLocaleDateString()}</strong> à <strong>{new Date(shop.endDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-850/60 flex justify-between items-center text-[10px]">
                          <div className="flex gap-4">
                            <span className="text-slate-400">Visiteurs: <strong className="text-white">{shop.visitorsCount}</strong></span>
                            <span className="text-slate-400">Réservations: <strong className="text-indigo-400">{shop.reservationsCount}</strong></span>
                          </div>

                          <div className="flex gap-1.5">
                            {shop.status === 'INACTIVE' ? (
                              <button 
                                onClick={() => handleToggleShopStatus(shop.id, shop.status)}
                                className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-900/30 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-lg transition"
                              >
                                Réactiver
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleToggleShopStatus(shop.id, shop.status)}
                                className="bg-rose-950/80 hover:bg-rose-900 border border-rose-900/30 text-rose-400 text-[10px] font-black px-2.5 py-1 rounded-lg transition"
                              >
                                Désactiver
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TABS 4: PRODUCTS */}
            {adminTab === 'products' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-md font-extrabold text-white">Catalogue global des produits</h2>
                  <p className="text-xs text-slate-400">Supervisez et segmentez l'intégralité du catalogue d'articles du système pour détecter les anomalies de stock et les meilleures ventes.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* SEGMENT 1: RUPTURE DE STOCK */}
                  <div className="bg-slate-900/80 border border-slate-900 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-slate-850">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Ruptures de Stock</h4>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {!adminProductsData?.outOfStock || adminProductsData.outOfStock.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic text-center py-4">Aucune rupture critique détectée.</p>
                      ) : (
                        adminProductsData.outOfStock.map((p: any) => (
                          <div key={p.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                            <div className="flex justify-between font-bold text-white text-[11px]">
                              <span className="truncate max-w-[150px]">{p.name}</span>
                              <span className="text-rose-400 font-mono">0 Stock</span>
                            </div>
                            <span className="text-[10px] text-slate-500 block">Vendeur: {p.sellerName}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* SEGMENT 2: PRODUITS PHARES */}
                  <div className="bg-slate-900/80 border border-slate-900 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-slate-850">
                      <ShoppingBag className="w-4 h-4 text-emerald-500" />
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Produits phares (Top)</h4>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {!adminProductsData?.highlyReserved || adminProductsData.highlyReserved.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic text-center py-4">Aucune réservation enregistrée.</p>
                      ) : (
                        adminProductsData.highlyReserved.map((p: any) => (
                          <div key={p.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                            <div className="flex justify-between font-bold text-white text-[11px]">
                              <span className="truncate max-w-[140px]">{p.name}</span>
                              <span className="text-indigo-400 font-mono">{p.reservationsCount} rés.</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500">
                              <span>Vendeur: {p.sellerName}</span>
                              <span className="font-bold text-slate-400">{p.price.toLocaleString('fr-FR')} FCFA</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* SEGMENT 3: JAMAIS RESERVES */}
                  <div className="bg-slate-900/80 border border-slate-900 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-slate-850">
                      <HelpCircle className="w-4 h-4 text-slate-500" />
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Jamais réservés</h4>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {!adminProductsData?.neverReserved || adminProductsData.neverReserved.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic text-center py-4">Tous les articles ont du succès.</p>
                      ) : (
                        adminProductsData.neverReserved.slice(0, 15).map((p: any) => (
                          <div key={p.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                            <div className="flex justify-between font-bold text-white text-[11px]">
                              <span className="truncate max-w-[150px]">{p.name}</span>
                              <span className="text-slate-500 font-mono">{p.stock} pces</span>
                            </div>
                            <span className="text-[10px] text-slate-500 block">Vendeur: {p.sellerName}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TABS 5: MONITORING */}
            {adminTab === 'monitoring' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-md font-extrabold text-white">Monitoring d'activité temps réel</h2>
                  <p className="text-xs text-slate-400">Flux d'événements capturés à la seconde pour surveiller le comportement des acheteurs et marchands.</p>
                </div>

                <div className="bg-slate-900 border border-slate-900 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-850">
                    <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      FLUX SECURISE OPERATIONNEL
                    </span>
                    <span className="text-[10px] text-slate-500">Rafraîchi automatiquement</span>
                  </div>

                  <div className="space-y-4 min-h-[300px] max-h-[500px] overflow-y-auto pr-2">
                    {/* Reservations activity logs */}
                    {adminLiveMonitoring?.newReservations?.map((r: any) => (
                      <div key={r.id} className="flex gap-4 p-3 rounded-xl bg-slate-950 border border-indigo-950/40 text-xs">
                        <span className="text-slate-500 font-mono shrink-0">{new Date(r.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                        <div className="space-y-1 flex-1">
                          <p className="text-slate-300">
                            Acheteur <strong className="text-white">{r.visitor}</strong> a validé la réservation de <strong className="text-indigo-400">{r.productName}</strong>.
                          </p>
                          <span className="text-[10px] text-slate-500 font-bold block">Session Live : "{r.liveTitle}"</span>
                        </div>
                        <span className="text-[10px] font-black text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded h-fit shrink-0">RESERVATION</span>
                      </div>
                    ))}

                    {/* New shops logs */}
                    {adminLiveMonitoring?.newShops?.map((s: any) => (
                      <div key={s.id} className="flex gap-4 p-3 rounded-xl bg-slate-950 border border-emerald-950/40 text-xs">
                        <span className="text-slate-500 font-mono shrink-0">{new Date(s.createdAt).toLocaleTimeString()}</span>
                        <div className="flex-1 text-slate-300">
                          Nouveau direct créé : <strong className="text-white">"{s.title}"</strong> par le vendeur <strong className="text-emerald-400">{s.sellerName}</strong>.
                        </div>
                        <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded h-fit shrink-0">BOUTIQUE</span>
                      </div>
                    ))}

                    {/* New seller registrees */}
                    {adminLiveMonitoring?.newSellers?.map((s: any) => (
                      <div key={s.id} className="flex gap-4 p-3 rounded-xl bg-slate-950 border border-amber-950/40 text-xs">
                        <span className="text-slate-500 font-mono shrink-0">{new Date(s.createdAt).toLocaleTimeString()}</span>
                        <div className="flex-1 text-slate-300">
                          Nouveau vendeur inscrit : <strong className="text-white">{s.name}</strong> (<strong className="text-amber-400 font-mono">{s.email}</strong>).
                        </div>
                        <span className="text-[10px] font-black text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded h-fit shrink-0">INSCRIPTION</span>
                      </div>
                    ))}

                    {/* Expiring shops warnings */}
                    {adminLiveMonitoring?.expiringShops?.map((s: any) => (
                      <div key={s.id} className="flex gap-4 p-3 rounded-xl bg-slate-950 border border-rose-950/40 text-xs">
                        <span className="text-rose-500 font-mono shrink-0 font-bold">ALERTE</span>
                        <div className="flex-1 text-slate-300">
                          La boutique active <strong className="text-white">"{s.title}"</strong> (vendeur: {s.sellerName}) expire bientôt (Clôture à : {new Date(s.endDate).toLocaleTimeString()}).
                        </div>
                        <span className="text-[10px] font-black text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded h-fit shrink-0">EXPIRATION</span>
                      </div>
                    ))}

                    {(!adminLiveMonitoring?.newReservations?.length && 
                      !adminLiveMonitoring?.newShops?.length && 
                      !adminLiveMonitoring?.newSellers?.length) && (
                      <p className="text-center py-12 text-slate-500 italic text-xs">Aucun événement récent sur les 30 dernières minutes.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TABS 6: AUDIT TRAIL */}
            {adminTab === 'audit' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-md font-extrabold text-white">Journal d'audit de sécurité globale</h2>
                  <p className="text-xs text-slate-400">Trace inaltérable de l'intégralité des actions menées par les administrateurs et vendeurs.</p>
                </div>

                {/* Audit log filters panel */}
                <div className="bg-slate-900 border border-slate-900 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase text-slate-400 block">Filtrer par vendeur</label>
                    <select 
                      value={auditLogSellerFilter} 
                      onChange={(e) => setAuditLogSellerFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="">Tous les vendeurs</option>
                      {adminSellers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase text-slate-400 block">Filtrer par type d'action</label>
                    <select 
                      value={auditLogActionFilter} 
                      onChange={(e) => setAuditLogActionFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="">Toutes les actions</option>
                      <option value="LOGIN">Connexions</option>
                      <option value="CREATE_SHOP">Créations Boutiques</option>
                      <option value="UPDATE_SHOP">Modifications Boutiques</option>
                      <option value="DELETE_SHOP">Suppressions Boutiques</option>
                      <option value="CREATE_PRODUCT">Créations Produits</option>
                      <option value="UPDATE_PRODUCT">Modifications Produits</option>
                      <option value="DELETE_PRODUCT">Suppressions Produits</option>
                      <option value="SUSPEND_SELLER">Suspensions Vendeurs</option>
                      <option value="REACTIVATE_SELLER">Réactivations Vendeurs</option>
                      <option value="reservation">Réservations acheteurs</option>
                    </select>
                  </div>
                </div>

                {/* Audit trail table */}
                <div className="bg-slate-900 border border-slate-900 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                        <th className="p-4">Horodatage (UTC)</th>
                        <th className="p-4">Auteur</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Description d'activité</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 font-mono text-[11px]">
                      {adminAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-500 italic text-xs">Aucun log enregistré dans le journal d'audit.</td>
                        </tr>
                      ) : (
                        adminAuditLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-850/30 transition text-slate-300">
                            <td className="p-4 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                            <td className="p-4 text-slate-400 font-bold">{log.username}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                ['LOGIN'].includes(log.actionType) ? 'bg-indigo-950 text-indigo-400 border border-indigo-800/20' :
                                ['CREATE_SHOP', 'CREATE_PRODUCT'].includes(log.actionType) ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/20' :
                                ['DELETE_SHOP', 'DELETE_PRODUCT', 'SUSPEND_SELLER'].includes(log.actionType) ? 'bg-rose-950 text-rose-400 border border-rose-800/20' :
                                'bg-slate-800 text-slate-400'
                              }`}>
                                {log.actionType}
                              </span>
                            </td>
                            <td className="p-4 text-slate-200">{log.details}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TABS 7: HEALTH ALERTS */}
            {adminTab === 'alerts' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-md font-extrabold text-white">Hub de santé et alertes de plateforme</h2>
                  <p className="text-xs text-slate-400">Le système audite en permanence les données pour lever des exceptions de sécurité ou logistiques.</p>
                </div>

                <div className="space-y-4">
                  {!adminAlertsData?.alerts || adminAlertsData.alerts.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-900 rounded-2xl p-8 text-center space-y-3">
                      <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
                      <h4 className="text-sm font-bold text-white">Plateforme parfaitement saine</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                        Aucune alerte logistique ou administrative levée. Les sessions en direct se terminent bien et les inventaires restent sains.
                      </p>
                    </div>
                  ) : (
                    adminAlertsData.alerts.map((alert: any) => (
                      <div 
                        key={alert.id} 
                        className={`border rounded-2xl p-5 flex gap-4 items-start ${
                          alert.severity === 'critical' ? 'bg-rose-950/20 border-rose-900/40 text-rose-400' :
                          alert.severity === 'warning' ? 'bg-amber-950/20 border-amber-900/40 text-amber-400' :
                          'bg-indigo-950/10 border-indigo-900/20 text-indigo-400'
                        }`}
                      >
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black uppercase tracking-wider text-white">{alert.title}</h4>
                            <span className="text-[9px] uppercase font-black tracking-widest bg-slate-950/80 px-1.5 py-0.5 rounded">
                              {alert.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
                          <span className="text-[10px] text-slate-500 block font-mono">Détecté le : {new Date(alert.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TABS 8: CROSS RECOMMENDATION */}
            {adminTab === 'cross-rec' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-md font-extrabold text-white">Moteur de Recommandation Croisée Orion</h2>
                    <p className="text-xs text-slate-400">Équilibrez dynamiquement l'audience en injectant des suggestions de produits de boutiques moins visibles sur les directs populaires.</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-2xl flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300">Statut du moteur :</span>
                    <button 
                      onClick={() => handleToggleCrossRecommendation(!adminCrossRecData?.enabled)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                        adminCrossRecData?.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {adminCrossRecData?.enabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
                    </button>
                  </div>
                </div>

                {/* Explanatory concept layout */}
                <div className="bg-indigo-950/15 border border-indigo-900/30 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">Concept de recommandation croisée SaaS</h3>
                  </div>
                  <p className="text-xs text-indigo-300/80 leading-relaxed">
                    Afin d'éviter le monopole de trafic et maximiser la conversion d'achat sur la plateforme, le moteur Orion prend automatiquement le premier article de catalogue d'une boutique à <strong>faible audience</strong> (moins de 3 spectateurs cumulés) et l'affiche discrètement dans la barre de recommandation de la boutique à <strong>forte audience</strong> (3 spectateurs ou plus).
                  </p>
                </div>

                {/* Simulation mapping output */}
                <div className="bg-slate-900 border border-slate-900 rounded-2xl p-6 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Recommandations et projections de clics en cours</h4>
                  <div className="space-y-4">
                    {!adminCrossRecData?.recommendations || adminCrossRecData.recommendations.length === 0 ? (
                      <p className="text-xs text-slate-500 italic text-center py-6">
                        {adminCrossRecData?.enabled 
                          ? "Aucun pont de trafic actif (il faut au moins une boutique populaire et une boutique de moindre trafic actives simultanément)."
                          : "Le moteur est désactivé. Activez-le ci-dessus pour observer les projections."}
                      </p>
                    ) : (
                      adminCrossRecData.recommendations.map((rec: any, index: number) => (
                        <div key={index} className="flex flex-col md:flex-row items-center gap-4 bg-slate-950 border border-slate-850 p-4 rounded-xl text-xs justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="font-bold text-white block">"{rec.sourceShopTitle}"</span>
                              <span className="text-[10px] text-slate-500">Boutique populaire</span>
                            </div>
                            <ArrowRight className="w-5 h-5 text-indigo-400" />
                            <div>
                              <span className="font-bold text-indigo-400 block">"{rec.targetShopTitle}"</span>
                              <span className="text-[10px] text-slate-500">Produit poussé : <strong>{rec.productName}</strong></span>
                            </div>
                          </div>

                          <div className="bg-indigo-950/50 border border-indigo-900/40 p-2 rounded-xl text-right shrink-0">
                            <span className="text-[10px] text-indigo-300 block">Projections clics générés</span>
                            <strong className="text-white text-sm">+{rec.clicksCount} clics stimulés</strong>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

          </main>
        </div>
        {renderToast()}
      </div>
    );
  }

  // ====================================================================
  // 6. PUBLIC IMMERSIVE VISITOR LIVE STREAM STOREFRONT
  // ====================================================================
  if (route === 'live') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between" id="visitor-storefront-view">
        {/* Header */}
        <header className="border-b border-slate-900 px-6 py-4 flex justify-between items-center bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center space-x-3">
            <img 
              src={orionLogo} 
              alt="Orion Live Logo" 
              className="h-8 w-8 rounded-lg border border-slate-800 object-cover" 
              referrerPolicy="no-referrer"
            />
            <span className="font-extrabold text-white text-md">Orion <span className="text-indigo-400 font-light">Storefront</span></span>
          </div>
          
          <div className="flex items-center space-x-4">
            {visitorPseudo ? (
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-slate-400 hidden sm:inline">Acheteur : <strong className="text-indigo-400">{visitorPseudo}</strong></span>
                <button 
                  onClick={handleVisitorLogout}
                  className="text-slate-500 hover:text-rose-400 font-bold transition flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" /> Quitter le direct
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowVisitorJoinModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition"
              >
                Rejoindre le Live
              </button>
            )}
          </div>
        </header>

        <main className="max-w-7xl w-full mx-auto px-6 py-8 flex-1 flex flex-col space-y-6">
          
          {publicLive ? (
            publicLive.status === 'DRAFT' ? (
              <div className="bg-slate-900 border border-slate-850 p-12 text-center rounded-2xl space-y-4 my-8">
                <AlertCircle className="w-12 h-12 text-slate-500 mx-auto" />
                <h4 className="text-sm font-bold text-white">Boutique en préparation</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Cette boutique live est actuellement en cours de préparation par son créateur (mode brouillon) et n'est pas encore accessible au public.
                </p>
                <button onClick={() => navigateTo('')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition">
                  Retour à l'accueil
                </button>
              </div>
            ) : (
              <>
                {/* Banner Details */}
                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                        publicLive.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/30 animate-pulse' :
                        publicLive.status === 'SOLD_OUT' ? 'bg-amber-950 text-amber-400 border border-amber-800/30' :
                        publicLive.status === 'SCHEDULED' ? 'bg-indigo-950 text-indigo-400 border border-indigo-800/30' :
                        'bg-rose-950 text-rose-400 border border-rose-800/30'
                      }`}>
                        {publicLive.status === 'ACTIVE' ? '⚫ LIVE EN COURS' :
                         publicLive.status === 'SOLD_OUT' ? '🟠 TOUT EST VENDU' :
                         publicLive.status === 'SCHEDULED' ? '🔵 LIVE PROGRAMMÉ' :
                         '🔴 LIVE TERMINÉ'}
                      </span>
                    </div>
                    <h1 className="text-lg md:text-xl font-extrabold text-white">{publicLive.title}</h1>
                    <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">{publicLive.description}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-bold bg-slate-950 border border-slate-850 p-3 rounded-xl">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      <span>{publicLive.status === 'SCHEDULED' ? `Débute le : ${new Date(publicLive.start_date).toLocaleString()}` : `Ferme le : ${new Date(publicLive.end_date).toLocaleString()}`}</span>
                    </div>
                  </div>
                </div>

                {publicLive.status === 'ACTIVE' && (
                  <div className="bg-indigo-950/20 border border-indigo-500/10 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center space-x-3">
                      <Phone className="w-5 h-5 text-indigo-400 animate-pulse" />
                      <div>
                        <h4 className="text-xs font-bold text-white">Besoin d'aide ou de conseils personnalisés ?</h4>
                        <p className="text-[11px] text-slate-400">Demandez à être contacté par le vendeur directement sur WhatsApp après le live.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleVisitorContactRequest()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-lg"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Demander à être recontacté
                    </button>
                  </div>
                )}

                {/* SCHEDULED COUNTDOWN AND PRE-REGISTRATION ROW */}
                {publicLive.status === 'SCHEDULED' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center bg-slate-900/60 border border-slate-850 rounded-2xl p-6 shadow-lg">
                    <div className="space-y-4 text-center lg:text-left">
                      <h3 className="text-md font-extrabold text-white">Le live commence dans :</h3>
                      <LiveCountdown startDate={publicLive.start_date} onComplete={fetchPublicLive} />
                    </div>
                    <div>
                      <PreRegistrationForm slug={publicLive.slug} onRegistered={fetchPublicLive} />
                    </div>
                  </div>
                )}

                {/* ENDED / ARCHIVED WARNING BANNER */}
                {(publicLive.status === 'ENDED' || publicLive.status === 'ARCHIVED') && (
                  <div className="bg-rose-950/25 border border-rose-800/30 p-6 rounded-2xl text-center space-y-2">
                    <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
                    <h4 className="text-sm font-bold text-rose-300">Cette session en direct est terminée</h4>
                    <p className="text-xs text-rose-400/80 max-w-lg mx-auto">
                      La boutique éphémère est maintenant clôturée. Les réservations et manifestations d'intérêt sont closes pour cette session commerciale.
                    </p>
                  </div>
                )}

                {/* Products Catalog Display */}
                {publicLive.status === 'SOLD_OUT' || publicProducts.length === 0 ? (
                  <div className="bg-amber-950/20 border border-amber-800/30 p-12 rounded-2xl text-center space-y-3">
                    <ShoppingBag className="w-12 h-12 text-amber-500/60 mx-auto" />
                    <h4 className="text-sm font-bold text-amber-300">Tous les produits sont épuisés !</h4>
                    <p className="text-xs text-amber-400 max-w-md mx-auto leading-relaxed">
                      Vous avez été extrêmement rapides ! Le créateur met actuellement de nouveaux articles en ligne. Restez connectés.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {publicProducts.map(p => (
                      <div key={p.id} className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between">
                        <div className="h-48 bg-slate-950 relative">
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          
                          {p.stock <= 0 ? (
                            <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center backdrop-blur-xs">
                              <span className="px-3 py-1 bg-rose-600 text-white rounded text-xs font-bold uppercase tracking-wider">
                                Rupture de Stock / Sold Out
                              </span>
                            </div>
                          ) : (
                            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-950/90 text-indigo-400 border border-indigo-500/20 backdrop-blur-sm">
                              {p.stock} pièces disponibles !
                            </div>
                          )}
                        </div>

                        <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-start">
                              <h4 className="text-sm font-bold text-white">{p.name}</h4>
                              <span className="text-sm font-bold text-indigo-400 shrink-0">{p.price.toLocaleString('fr-FR')} FCFA</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">{p.description}</p>
                          </div>

                          {/* Quantity Selector - Required by design */}
                          {publicLive.status === 'ACTIVE' && p.stock > 0 && (
                            <div className="flex items-center justify-between bg-slate-950 border border-slate-850 p-2 rounded-xl">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Quantité *</span>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const curr = selectedQuantities[p.id] || 1;
                                    if (curr > 1) {
                                      setSelectedQuantities({ ...selectedQuantities, [p.id]: curr - 1 });
                                    }
                                  }}
                                  className="w-7 h-7 bg-slate-850 hover:bg-slate-800 rounded-lg flex items-center justify-center text-xs font-bold text-slate-300 transition"
                                >
                                  -
                                </button>
                                <span className="text-xs font-bold text-white w-6 text-center">
                                  {selectedQuantities[p.id] || 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const curr = selectedQuantities[p.id] || 1;
                                    if (curr < p.stock) {
                                      setSelectedQuantities({ ...selectedQuantities, [p.id]: curr + 1 });
                                    }
                                  }}
                                  className="w-7 h-7 bg-slate-850 hover:bg-slate-800 rounded-lg flex items-center justify-center text-xs font-bold text-slate-300 transition"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Actions for public buyers */}
                          {publicLive.status === 'ACTIVE' && p.stock > 0 ? (
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-850">
                              <button
                                onClick={() => handleVisitorInterest(p.id)}
                                className="py-2 rounded-xl text-[11px] font-bold bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 transition flex items-center justify-center gap-1"
                              >
                                <Heart className="w-3.5 h-3.5 text-pink-500" />
                                Intéressé !
                              </button>

                              <button
                                onClick={() => handleVisitorReserve(p.id)}
                                className="py-2 rounded-xl text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10 transition flex items-center justify-center gap-1"
                              >
                                <ShoppingCart className="w-3.5 h-3.5 text-indigo-200" />
                                Réserver !
                              </button>
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-slate-850 text-center">
                              <span className="text-[11px] text-slate-500 font-bold block">
                                {publicLive.status === 'SCHEDULED' ? "Reservations au lancement" : "Boutique fermée"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dynamic activity terminal for social proof */}
                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 space-y-3 shadow-lg">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                      Flux d'activités en direct
                    </h4>
                    <span className="text-[10px] text-slate-500">Mise à jour en direct...</span>
                  </div>
                  
                  <div className="max-h-36 overflow-y-auto space-y-2 text-xs font-mono">
                    {publicLogs.length === 0 ? (
                      <p className="text-slate-500 text-[11px] italic">Aucune action enregistrée pour le moment. Soyez le premier à réserver !</p>
                    ) : (
                      publicLogs.map((log: any) => (
                        <div key={log.id} className="flex items-start space-x-2 text-[11px] text-slate-300">
                          <span className="text-slate-500 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                          <p>
                            <strong className="text-indigo-400 font-bold">{log.visitor_pseudo}</strong>
                            {log.action_type === 'join' && <span className="text-emerald-400"> a rejoint le direct !</span>}
                            {log.action_type === 'interest' && <span> est intéressé par le produit <strong className="text-white">{log.product_name}</strong></span>}
                            {log.action_type === 'reservation' && <span className="text-amber-400"> a validé une réservation pour <strong className="text-white">{log.product_name}</strong> !</span>}
                            {log.action_type === 'pre-register' && <span className="text-indigo-400"> s'est pré-inscrit(e) pour le lancement !</span>}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )
          ) : (
            <div className="bg-slate-900 border border-slate-850 p-12 text-center rounded-2xl space-y-3 my-8">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
              <h4 className="text-sm font-bold text-white">Boutique éphémère inaccessible</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                La boutique demandée n'existe pas, n'est pas configurée ou la limite de temps réglementaire de 24 heures a expiré.
              </p>
              <button onClick={() => navigateTo('')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition mt-2">
                Retour à l'accueil
              </button>
            </div>
          )}

        </main>

        {/* VISITOR JOIN AUTH MODAL */}
        {showVisitorJoinModal && route === 'live' && publicLive && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-indigo-500/20 max-w-md w-full rounded-2xl p-8 text-center space-y-6 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-indigo-600/10 flex items-center justify-center mx-auto text-indigo-400">
                <ShoppingBag className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-md font-bold text-white">Rejoindre la boutique du Live</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Inscrivez votre pseudo et votre numéro WhatsApp pour manifester votre intérêt et effectuer vos réservations en toute sécurité.
                </p>
              </div>

              <form onSubmit={handleJoinPublicLive} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Pseudo de profil *</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    placeholder="ex. Marie_TikTok"
                    value={visitorPseudo}
                    onChange={(e) => setVisitorPseudo(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Numéro WhatsApp (Optionnel mais recommandé)</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    placeholder="ex. +33612345678"
                    value={visitorWhatsapp}
                    onChange={(e) => setVisitorWhatsapp(e.target.value)}
                  />
                  <span className="text-[9px] text-slate-500 block">Permet au vendeur de vous envoyer votre bon de commande directement après le live.</span>
                </div>

                <button 
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg"
                >
                  Déverrouiller l'accès boutique
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VISITOR CONTACT MODAL */}
        {showContactModal && route === 'live' && publicLive && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-indigo-500/20 max-w-md w-full rounded-2xl p-8 text-center space-y-6 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-indigo-600/10 flex items-center justify-center mx-auto text-indigo-400">
                <Phone className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-md font-bold text-white">Demande de contact WhatsApp</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Veuillez inscrire votre numéro WhatsApp pour que le vendeur puisse vous recontacter directement après le direct.
                </p>
              </div>

              <form onSubmit={handleVisitorContactRequest} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Votre numéro WhatsApp *</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    placeholder="ex. +33612345678"
                    value={contactWhatsapp}
                    onChange={(e) => setContactWhatsapp(e.target.value)}
                  />
                  <span className="text-[9px] text-slate-500 block">Requis pour vous recontacter par message sécurisé.</span>
                </div>

                <div className="flex gap-2.5">
                  <button 
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="flex-1 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg"
                  >
                    Valider ma demande
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 bg-slate-950">
          <p>© 2026 Orion Live SaaS Inc. Tous droits réservés. Connecté à PostgreSQL.</p>
        </footer>
        {renderToast()}
      </div>
    );
  }

  return null;
}

interface CountdownProps {
  startDate: string;
  onComplete?: () => void;
}

const LiveCountdown: React.FC<CountdownProps> = ({ startDate, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(startDate).getTime() - new Date().getTime();
      if (difference <= 0) {
        if (onComplete) onComplete();
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [startDate, onComplete]);

  return (
    <div className="flex gap-4 justify-center items-center font-mono">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center min-w-[70px]">
        <span className="text-2xl md:text-3xl font-black text-indigo-400 block">{String(timeLeft.days).padStart(2, '0')}</span>
        <span className="text-[10px] text-slate-400 uppercase font-bold">Jours</span>
      </div>
      <span className="text-xl font-bold text-slate-600">:</span>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center min-w-[70px]">
        <span className="text-2xl md:text-3xl font-black text-indigo-400 block">{String(timeLeft.hours).padStart(2, '0')}</span>
        <span className="text-[10px] text-slate-400 uppercase font-bold">Heures</span>
      </div>
      <span className="text-xl font-bold text-slate-600">:</span>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center min-w-[70px]">
        <span className="text-2xl md:text-3xl font-black text-indigo-400 block">{String(timeLeft.minutes).padStart(2, '0')}</span>
        <span className="text-[10px] text-slate-400 uppercase font-bold">Min</span>
      </div>
      <span className="text-xl font-bold text-slate-600">:</span>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center min-w-[70px]">
        <span className="text-2xl md:text-3xl font-black text-rose-500 block animate-pulse">{String(timeLeft.seconds).padStart(2, '0')}</span>
        <span className="text-[10px] text-slate-400 uppercase font-bold">Sec</span>
      </div>
    </div>
  );
};

const PreRegistrationForm: React.FC<{ slug: string; onRegistered: () => void }> = ({ slug, onRegistered }) => {
  const [pseudo, setPseudo] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudo.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lives/public/${slug}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: pseudo.trim(), whatsapp: whatsapp.trim() })
      });
      if (res.ok) {
        setDone(true);
        onRegistered();
      } else {
        const err = await res.json();
        alert(err.error || "Erreur lors de l'inscription");
      }
    } catch (err) {
      alert("Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="bg-emerald-950/35 border border-emerald-500/20 p-6 rounded-2xl text-center space-y-2 max-w-md mx-auto">
        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
        <h4 className="text-sm font-bold text-emerald-300">Pré-inscription enregistrée !</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Vous recevrez une alerte dès que le vendeur ouvrira sa boutique en direct !
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-850 p-6 rounded-2xl space-y-4 max-w-md w-full mx-auto">
      <div className="text-center space-y-1">
        <h4 className="text-sm font-bold text-white">Inscrivez-vous pour ne pas rater ce Live !</h4>
        <p className="text-xs text-slate-400">Recevez une alerte de lancement et accédez à la boutique en priorité.</p>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Votre Pseudo *</label>
          <input
            type="text"
            required
            value={pseudo}
            onChange={e => setPseudo(e.target.value)}
            placeholder="Ex: Fatou, Amadou, Marie..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Numéro WhatsApp (Optionnel)</label>
          <input
            type="text"
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
            placeholder="Ex: +221 77..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-2.5 rounded-xl text-xs transition"
        >
          {loading ? "Chargement..." : "Prévenez-moi lorsque le live commence"}
        </button>
      </div>
    </form>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Video, Plus, Trash2, Edit, Link as LinkIcon, Check, ExternalLink, 
  Lock, Unlock, ShoppingBag, Users, Heart, AlertCircle, LogOut, 
  Database, Code, ArrowRight, Tag, Package, RefreshCw, 
  Clock, Search, Eye, UserPlus, LogIn, ChevronRight, Copy, 
  CheckCircle2, ShoppingCart, ShieldAlert, CheckSquare, Layers, 
  Calendar, Phone, Activity, HelpCircle, FileText, BarChart3, AlertTriangle, ShieldCheck
} from 'lucide-react';

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
  const [adminTab, setAdminTab] = useState<'users' | 'lives' | 'stats'>('users');

  // Core collections from server
  const [lives, setLives] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

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
  const [registerRole, setRegisterRole] = useState<'SELLER' | 'ADMIN'>('SELLER');

  // Input for custom slug entry
  const [slugSearchInput, setSlugSearchInput] = useState('');

  // ====================================================================
  // TOAST NOTIFICATION HELPERS
  // ====================================================================
  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
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
      const res = await fetch('/api/auth/me');
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
        fetch('/api/lives'),
        fetch('/api/products'),
        fetch('/api/seller/stats')
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

  const fetchAdminData = async () => {
    setDataLoading(true);
    try {
      const [statsRes, usersRes, livesRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users'),
        fetch('/api/lives')
      ]);

      if (statsRes.ok) setAdminStats(await statsRes.json());
      if (usersRes.ok) setAdminUsers(await usersRes.json());
      if (livesRes.ok) setLives(await livesRes.json());
    } catch (e) {
      showToast("Erreur de récupération des données administrateur.", "error");
    } finally {
      setDataLoading(false);
    }
  };

  const fetchPublicLive = async () => {
    if (!liveSlug) return;
    try {
      const res = await fetch(`/api/lives/public/${liveSlug}`);
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
      const res = await fetch('/api/auth/login', {
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
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerName,
          email: registerEmail,
          password: registerPassword,
          role: registerRole
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Compte créé avec succès ! Veuillez vous connecter.");
        setLoginEmail(registerEmail);
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
      await fetch('/api/auth/logout', { method: 'POST' });
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
  const handleCreateOrUpdateLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveFormTitle || !liveFormSlug || !liveFormStart || !liveFormEnd) {
      showToast("Veuillez remplir tous les champs obligatoires.", "error");
      return;
    }

    // Client-side 24h limit checker
    const start = new Date(liveFormStart).getTime();
    const end = new Date(liveFormEnd).getTime();
    const durationMs = end - start;
    if (durationMs > 24 * 60 * 60 * 1000) {
      showToast("La durée maximale d'un direct est limitée à 24 heures (Règle anti-abus).", "error");
      return;
    }
    if (durationMs <= 0) {
      showToast("La date de fin doit être postérieure à la date de début.", "error");
      return;
    }

    const bodyData = {
      title: liveFormTitle,
      description: liveFormDesc,
      slug: liveFormSlug,
      image_url: liveFormImg,
      start_date: liveFormStart,
      end_date: liveFormEnd,
      status: liveEditId ? undefined : 'DRAFT', // keep original status on update unless explicitly overridden
      product_ids: liveFormSelectedProducts
    };

    try {
      const url = liveEditId ? `/api/lives/${liveEditId}` : '/api/lives';
      const method = liveEditId ? 'PUT' : 'POST';

      const res = await fetch(url, {
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
    const startDateFormatted = live.start_date ? new Date(live.start_date).toISOString().slice(0, 16) : '';
    const endDateFormatted = live.end_date ? new Date(live.end_date).toISOString().slice(0, 16) : '';
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
      const res = await fetch(`/api/lives/${id}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/lives/${live.id}`, {
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

      const res = await fetch(url, {
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
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/admin/users/${userId}/role`, {
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
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/lives/public/${liveSlug}/join`, {
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
      const res = await fetch(`/api/lives/public/${liveSlug}/interest`, {
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
    if (!visitorWhatsapp) {
      showToast("WhatsApp requis pour valider votre commande et vous recontacter.", "warning");
      setShowVisitorJoinModal(true);
      return;
    }

    try {
      const res = await fetch(`/api/lives/public/${liveSlug}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: visitorPseudo, whatsapp: visitorWhatsapp, productId })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Félicitations ! Votre réservation est validée et votre pièce est bloquée ! 🎉");
        fetchPublicLive();
      } else {
        showToast(data.error || "Rupture de stock ! Réservation impossible.", "error");
      }
    } catch (e) {
      showToast("Erreur lors de la réservation.", "error");
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
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between" id="home-view">
        {/* Navigation */}
        <header className="border-b border-slate-900 px-6 py-4 flex justify-between items-center bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center space-x-2">
            <Video className="w-6 h-6 text-indigo-500" />
            <span className="font-extrabold tracking-tight text-white text-lg">Orion<span className="text-indigo-400 font-medium">.live</span></span>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            {user ? (
              <>
                <span className="text-slate-400 hidden sm:inline">Connecté : <strong className="text-slate-200">{user.name}</strong> ({user.role})</span>
                <button 
                  onClick={() => navigateTo(user.role === 'ADMIN' ? 'admin' : 'dashboard')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5"
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
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold transition"
                >
                  Créer un compte
                </button>
              </>
            )}
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-5xl mx-auto px-6 py-16 md:py-24 text-center space-y-12">
          <div className="inline-flex items-center space-x-2 bg-indigo-950/50 border border-indigo-500/20 px-3 py-1 rounded-full text-[11px] text-indigo-300 font-bold">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span>SaaS de Live Commerce de Prochaine Génération</span>
          </div>

          <div className="space-y-6 max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-none">
              Transformez vos ventes en direct en <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">commandes réelles</span>.
            </h1>
            <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
              Orion Live permet aux créateurs et commerçants de générer des boutiques temporaires ultra-rapides pour leurs streams TikTok, Facebook ou Instagram, d'éviter toute survente et de valider les réservations par WhatsApp.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <button 
              onClick={() => navigateTo('register')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-extrabold text-sm transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
            >
              Créer mon espace vendeur <ChevronRight className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                const target = prompt("Entrez le slug du live à rejoindre (ex. vente-bijoux) :");
                if (target) navigateTo(`live/${target}`);
              }}
              className="bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 px-6 py-3 rounded-xl font-bold text-sm transition"
            >
              Rejoindre un Live acheteur
            </button>
          </div>

          {/* Quick Slug Directory Search */}
          <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-6 max-w-lg mx-auto space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Recherche rapide de boutique live</h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="ex. vente-bijoux, clearance-printemps"
                className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                value={slugSearchInput}
                onChange={(e) => setSlugSearchInput(e.target.value)}
              />
              <button 
                onClick={() => {
                  if (slugSearchInput.trim()) navigateTo(`live/${slugSearchInput.trim()}`);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
              >
                Visiter
              </button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
            <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-2xl text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/15 flex items-center justify-center text-indigo-400">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Durée Limitée de 24h</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Les lives s'autodétruisent après 24 heures pour maintenir une urgence d'achat absolue chez vos spectateurs.</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-2xl text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/15 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Zéro Survente Garanti</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Les réservations utilisent des transactions bloquantes en base PostgreSQL pour interdire l'achat de pièces épuisées.</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-2xl text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/15 flex items-center justify-center text-indigo-400">
                <Phone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Facturation WhatsApp</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Récupérez instantanément le WhatsApp de l'acheteur pour lui envoyer son lien de paiement de manière sécurisée.</p>
            </div>
          </div>
        </main>

        <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
          <p>© 2026 Orion Live SaaS Inc. Tous droits réservés. Connecté à PostgreSQL.</p>
        </footer>
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
          <div className="flex justify-center items-center space-x-2">
            <Video className="w-8 h-8 text-indigo-500 animate-pulse" />
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
                  placeholder="Minimum 6 caractères"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold">Rôle de l'utilisateur (Sauvegardé en base de données)</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  value={registerRole}
                  onChange={(e) => setRegisterRole(e.target.value as 'SELLER' | 'ADMIN')}
                >
                  <option value="SELLER">Vendeur (SELLER) - Gérer mes lives et produits</option>
                  <option value="ADMIN">Administrateur (ADMIN) - Accès complet de gestion</option>
                </select>
                <span className="text-[10px] text-slate-500 block">Un utilisateur ne possède qu'un seul rôle, stocké en toute sécurité dans PostgreSQL.</span>
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
          <div className="flex justify-center items-center space-x-2">
            <Video className="w-8 h-8 text-indigo-500" />
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
          <div className="flex items-center space-x-2">
            <Video className="w-6 h-6 text-indigo-500" />
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">Réservations</span>
                <p className="text-2xl font-black text-white">{analytics?.totalReservationsCount || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">Chiffre d'Affaires</span>
                <p className="text-2xl font-black text-white">{(analytics?.totalEarnings || 0).toLocaleString('fr-FR')} FCFA</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400">
                <Tag className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">Intérêts Marqués</span>
                <p className="text-2xl font-black text-white">{analytics?.totalInterestsCount || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400">
                <Heart className="w-6 h-6" />
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
          </div>

          {/* Tab Contents: LIVES */}
          {sellerTab === 'lives' && (
            <div className="space-y-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {lives.map(l => (
                    <div key={l.id} className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-md flex flex-col justify-between">
                      <div className="p-5 space-y-4">
                        <div className="flex justify-between items-start">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            l.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' :
                            l.status === 'DRAFT' ? 'bg-slate-800 text-slate-400' :
                            l.status === 'SOLD_OUT' ? 'bg-amber-950 text-amber-400 border border-amber-500/20' :
                            'bg-rose-950 text-rose-400'
                          }`}>
                            {l.status}
                          </span>
                          
                          {/* Live activation switch */}
                          <div className="flex items-center space-x-1.5">
                            {l.status !== 'ACTIVE' ? (
                              <button 
                                onClick={() => handleToggleLiveStatus(l, 'ACTIVE')}
                                className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded font-bold transition"
                              >
                                Activer
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleToggleLiveStatus(l, 'INACTIVE')}
                                className="text-[10px] bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 rounded font-bold transition"
                              >
                                Arrêter
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
                            // View dynamic audits or stats
                            fetch(`/api/lives/${l.id}/analytics`)
                              .then(r => r.json())
                              .then(data => {
                                alert(`Rapport en direct - ${l.title}\n\nVisiteurs uniques : ${data.uniqueVisitorsCount}\nRéservations totales : ${data.reservationsCount}\nArticles mis en avant : ${data.interestsCount}`);
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

        </div>

        {/* MODAL CREATION LIVE */}
        {showLiveModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex justify-between items-center">
                <h3 className="text-sm font-bold text-white">{liveEditId ? "Modifier la boutique Live" : "Créer une boutique Live"}</h3>
                <button onClick={() => setShowLiveModal(false)} className="text-slate-400 hover:text-white text-xs font-bold">Fermer</button>
              </div>

              <form onSubmit={handleCreateOrUpdateLive} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-bold uppercase">Titre du direct *</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    placeholder="ex. Vente Live de Noël 🎄"
                    value={liveFormTitle}
                    onChange={(e) => setLiveFormTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-bold uppercase">Slug de boutique unique *</label>
                  <div className="flex">
                    <span className="bg-slate-950 border border-r-0 border-slate-800 rounded-l-xl px-3 py-2 text-xs text-slate-500">/lives/</span>
                    <input 
                      type="text" 
                      required 
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-r-xl px-3 py-2 text-xs text-white focus:outline-none"
                      placeholder="vente-noel"
                      value={liveFormSlug}
                      onChange={(e) => setLiveFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                    />
                  </div>
                  <span className="text-[9px] text-slate-500 block">Les acheteurs rejoindront votre direct avec ce lien.</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-bold uppercase">Description de la session</label>
                  <textarea 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white h-20"
                    placeholder="Décrivez les lots, les modalités de paiement..."
                    value={liveFormDesc}
                    onChange={(e) => setLiveFormDesc(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-bold uppercase">Début du Direct *</label>
                    <input 
                      type="datetime-local" 
                      required 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      value={liveFormStart}
                      onChange={(e) => setLiveFormStart(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-bold uppercase">Fin du Direct (Max +24h) *</label>
                    <input 
                      type="datetime-local" 
                      required 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      value={liveFormEnd}
                      onChange={(e) => setLiveFormEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-bold uppercase">URL Image de couverture (Facultatif)</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    placeholder="https://images.unsplash.com/..."
                    value={liveFormImg}
                    onChange={(e) => setLiveFormImg(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-850">
                  <label className="text-[11px] text-slate-400 font-bold uppercase">Sélectionner les produits associés ({products.length} disponibles)</label>
                  {products.length === 0 ? (
                    <span className="text-xs text-amber-400 block font-semibold">Créez d'abord des produits dans votre catalogue.</span>
                  ) : (
                    <div className="max-h-32 overflow-y-auto bg-slate-950 p-2.5 rounded-xl border border-slate-850 space-y-2">
                      {products.map(p => (
                        <label key={p.id} className="flex items-center space-x-2 text-xs text-slate-300 hover:text-white cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
                            checked={liveFormSelectedProducts.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setLiveFormSelectedProducts([...liveFormSelectedProducts, p.id]);
                              } else {
                                setLiveFormSelectedProducts(liveFormSelectedProducts.filter(id => id !== p.id));
                              }
                            }}
                          />
                          <span>{p.name} - <strong>{p.price.toLocaleString('fr-FR')} FCFA</strong> ({p.stock} restants)</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md"
                >
                  {liveEditId ? "Enregistrer les modifications" : "Lancer ma boutique temporaire"}
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
                  <label className="text-[11px] text-slate-400 font-bold uppercase">Nom de l'article *</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    placeholder="ex. Veste Vintage Cuir"
                    value={productFormName}
                    onChange={(e) => setProductFormName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-bold uppercase">Description détaillée</label>
                  <textarea 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white h-20"
                    placeholder="Matériaux, taille, état..."
                    value={productFormDesc}
                    onChange={(e) => setProductFormDesc(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-bold uppercase">Prix unitaire (FCFA) *</label>
                    <input 
                      type="number" 
                      step="1"
                      required 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      placeholder="ex. 5000"
                      value={productFormPrice}
                      onChange={(e) => setProductFormPrice(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-bold uppercase">Stock disponible *</label>
                    <input 
                      type="number" 
                      required 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      placeholder="ex. 1"
                      value={productFormStock}
                      onChange={(e) => setProductFormStock(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-bold uppercase">URL Image du produit</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    placeholder="https://images.unsplash.com/..."
                    value={productFormImg}
                    onChange={(e) => setProductFormImg(e.target.value)}
                  />
                </div>

                <label className="flex items-center space-x-2 text-xs text-slate-300 font-bold cursor-pointer pt-2">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
                    checked={productFormIsActive}
                    onChange={(e) => setProductFormIsActive(e.target.checked)}
                  />
                  <span>Produit disponible pour la vente</span>
                </label>

                <button 
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md"
                >
                  Enregistrer l'article
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Global Toast */}
        {toast && (
          <div className={`fixed bottom-5 right-5 px-4 py-3 rounded-xl border text-xs font-bold shadow-lg z-50 animate-bounce flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-950 border-emerald-800 text-emerald-400' :
            toast.type === 'warning' ? 'bg-amber-950 border-amber-800 text-amber-400' :
            'bg-rose-950 border-rose-800 text-rose-400'
          }`}>
            <AlertCircle className="w-4 h-4" />
            <span>{toast.message}</span>
          </div>
        )}
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
        <header className="border-b border-slate-900 px-6 py-4 flex justify-between items-center bg-slate-900/40 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-amber-500" />
            <span className="font-extrabold text-white text-md">Orion <span className="text-amber-500 font-medium">Console Admin</span></span>
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <button 
              onClick={() => navigateTo('dashboard')}
              className="bg-indigo-950 text-indigo-300 border border-indigo-900 px-3 py-1.5 rounded-xl font-bold transition"
            >
              Aller à l'espace vendeur
            </button>
            <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 font-bold transition flex items-center gap-1">
              <LogOut className="w-4 h-4" /> Quitter
            </button>
          </div>
        </header>

        <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col space-y-8">
          
          {/* Admin Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">Vendeurs inscrits</span>
                <p className="text-xl font-black text-white">{adminStats?.sellersCount || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">Directs planifiés</span>
                <p className="text-xl font-black text-white">{adminStats?.totalLivesCount || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Video className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">Réservations validées</span>
                <p className="text-xl font-black text-white">{adminStats?.totalReservations || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">Transaction totale</span>
                <p className="text-xl font-black text-white">{(adminStats?.totalSales || 0).toLocaleString('fr-FR')} FCFA</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Tag className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Admin Tabs */}
          <div className="flex border-b border-slate-850">
            <button 
              onClick={() => setAdminTab('users')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                adminTab === 'users' ? 'border-amber-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" /> Gérer les Vendeurs
            </button>
            <button 
              onClick={() => setAdminTab('lives')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                adminTab === 'lives' ? 'border-amber-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video className="w-4 h-4" /> Surveiller les Lives
            </button>
          </div>

          {/* Tab Content: MANAGE USERS */}
          {adminTab === 'users' && (
            <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 font-bold uppercase">
                    <th className="p-4">Utilisateur / Vendeur</th>
                    <th className="p-4">Adresse Email</th>
                    <th className="p-4">Date de Création</th>
                    <th className="p-4">Rôle</th>
                    <th className="p-4 text-right">Actions de Modération</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {adminUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-850/30 transition text-slate-300">
                      <td className="p-4 font-bold text-white">{u.name}</td>
                      <td className="p-4 font-mono">{u.email}</td>
                      <td className="p-4">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'ADMIN' ? 'bg-amber-950 text-amber-400 border border-amber-800/30' : 'bg-slate-850 text-slate-400'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button 
                          onClick={() => handleToggleUserRole(u.id, u.role)}
                          className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-2.5 py-1 rounded text-[10px] font-bold transition"
                        >
                          Inverser Rôle
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="bg-rose-950/50 hover:bg-rose-950 text-rose-400 px-2.5 py-1 rounded text-[10px] font-bold transition"
                        >
                          Bannir / Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab Content: MONITOR ALL LIVES */}
          {adminTab === 'lives' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {lives.map(l => (
                <div key={l.id} className="bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-lg space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-white line-clamp-1">{l.title}</h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      l.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {l.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{l.description}</p>
                  <div className="text-[11px] text-slate-400 border-t border-slate-850 pt-3 flex justify-between">
                    <span>Lien direct public : </span>
                    <a href={`#live/${l.slug}`} target="_blank" className="text-amber-400 hover:underline">/lives/{l.slug}</a>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
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
          <div className="flex items-center space-x-2">
            <Video className="w-5 h-5 text-indigo-500 animate-pulse" />
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
            <>
              {/* Banner Details */}
              <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                      publicLive.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/30 animate-pulse' :
                      publicLive.status === 'SOLD_OUT' ? 'bg-amber-950 text-amber-400 border border-amber-800/30' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {publicLive.status === 'ACTIVE' ? '⚫ LIVE EN COURS' : `STATUT BOUTIQUE : ${publicLive.status}`}
                    </span>
                  </div>
                  <h1 className="text-lg md:text-xl font-extrabold text-white">{publicLive.title}</h1>
                  <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">{publicLive.description}</p>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 font-bold bg-slate-950 border border-slate-850 p-3 rounded-xl shrink-0">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Ferme le : {new Date(publicLive.end_date).toLocaleString()}</span>
                </div>
              </div>

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

                        {/* Actions for public buyers */}
                        {publicLive.status === 'ACTIVE' && p.stock > 0 && (
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
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
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
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Numéro WhatsApp * (Requis pour la validation de commande)</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    placeholder="ex. +33612345678"
                    value={visitorWhatsapp}
                    onChange={(e) => setVisitorWhatsapp(e.target.value)}
                  />
                  <span className="text-[9px] text-slate-500 block">Permet au vendeur de valider votre réservation et d'envoyer votre facture après le live.</span>
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

        <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 bg-slate-950">
          <p>© 2026 Orion Live SaaS Inc. Tous droits réservés. Connecté à PostgreSQL.</p>
        </footer>
      </div>
    );
  }

  return null;
}

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, LogOut, Users, Video, CheckCircle2, Tag, AlertTriangle, 
  Search, Calendar, TrendingUp, ToggleLeft, ToggleRight, Eye, Settings, 
  AlertCircle, ClipboardList, RefreshCw, UserCheck, UserMinus, DollarSign, 
  Package, Sparkles, X, Bell, EyeOff, ShieldAlert, BarChart3
} from 'lucide-react';

interface AdminDashboardProps {
  user: any;
  handleLogout: () => void;
  navigateTo: (route: string) => void;
}

export default function AdminDashboard({ user, handleLogout, navigateTo }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'sellers' | 'lives' | 'products' | 'audit-logs' | 'alerts' | 'recommendations'>('overview');
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Stats & Data states
  const [overviewStats, setOverviewStats] = useState<any>(null);
  const [sellers, setSellers] = useState<any[]>([]);
  const [lives, setLives] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any>({ products: [], analytics: { mostReserved: [], outOfStock: [], neverReserved: [] } });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [alertsData, setAlertsData] = useState<any>({ notifications: [], unreadCount: 0, alerts: [] });
  const [recommendationsData, setRecommendationsData] = useState<any>({ enabled: true, highlyVisited: [], lowVisited: [], recommendations: [] });

  // Filters
  const [logSeller, setLogSeller] = useState('');
  const [logAction, setLogAction] = useState('');
  const [logDate, setLogDate] = useState('');

  // Selected Detail Modals/Overlays
  const [selectedSellerLogs, setSelectedSellerLogs] = useState<{ seller: any; logs: any[] } | null>(null);
  const [selectedSellerLives, setSelectedSellerLives] = useState<{ seller: any; lives: any[] } | null>(null);
  const [selectedLiveProducts, setSelectedLiveProducts] = useState<{ live: any; products: any[] } | null>(null);
  const [selectedLiveStats, setSelectedLiveStats] = useState<any | null>(null);

  // Suspension Modal Input State
  const [suspensionUser, setSuspensionUser] = useState<any | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string>('');

  // Global Alerts Topbar Notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetching Router
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const res = await fetch('/api/admin/overview-stats');
        if (res.ok) setOverviewStats(await res.json());
      } else if (activeTab === 'sellers') {
        const res = await fetch('/api/admin/sellers');
        if (res.ok) setSellers(await res.json());
      } else if (activeTab === 'lives') {
        const res = await fetch('/api/admin/lives');
        if (res.ok) setLives(await res.json());
      } else if (activeTab === 'products') {
        const res = await fetch('/api/admin/products');
        if (res.ok) setProductsData(await res.json());
      } else if (activeTab === 'audit-logs') {
        let query = `/api/admin/audit-logs?seller=${encodeURIComponent(logSeller)}&action=${encodeURIComponent(logAction)}`;
        if (logDate) query += `&date=${logDate}`;
        const res = await fetch(query);
        if (res.ok) setAuditLogs(await res.json());
      } else if (activeTab === 'alerts') {
        const res = await fetch('/api/admin/alerts');
        if (res.ok) setAlertsData(await res.json());
      } else if (activeTab === 'recommendations') {
        const res = await fetch('/api/admin/recommendations');
        if (res.ok) setRecommendationsData(await res.json());
      }
    } catch (e: any) {
      showNotification("Impossible de charger les données: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [activeTab, logSeller, logAction, logDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Periodic alarm checks
  useEffect(() => {
    const interval = setInterval(() => {
      // Background update unread notifications count
      fetch('/api/admin/alerts')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setAlertsData(data);
          }
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // 2. Action Handlers

  // Suspend/Reactivate user status
  const handleUpdateSellerStatus = async (userId: string, status: 'ACTIVE' | 'SUSPENDED', reason: string = '') => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/sellers/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason })
      });

      if (res.ok) {
        showNotification(`Statut du vendeur mis à jour en ${status === 'ACTIVE' ? 'Actif' : 'Suspendu'}.`);
        setSuspensionUser(null);
        setSuspensionReason('');
        fetchData();
      } else {
        const data = await res.json();
        showNotification(data.error || "Erreur de mise à jour", "error");
      }
    } catch (e: any) {
      showNotification("Erreur de communication backend.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle Live Shop Status (Admin Deactivate/Reactivate)
  const handleToggleLiveStatus = async (liveId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    setActionLoading(liveId);
    try {
      const res = await fetch(`/api/admin/lives/${liveId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        showNotification(`Le live a été ${newStatus === 'ACTIVE' ? 'réactivé' : 'désactivé administrativement'}.`);
        fetchData();
      } else {
        const data = await res.json();
        showNotification(data.error || "Erreur", "error");
      }
    } catch (e) {
      showNotification("Erreur serveur", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // View Seller Logs
  const handleViewSellerLogs = async (seller: any) => {
    try {
      const res = await fetch(`/api/admin/sellers/${seller.id}/activity`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSellerLogs(data);
      } else {
        showNotification("Impossible de charger les journaux d'activité.", "error");
      }
    } catch (e) {
      showNotification("Erreur de connexion", "error");
    }
  };

  // View Seller Boutiques
  const handleViewSellerLives = async (seller: any) => {
    try {
      const res = await fetch(`/api/admin/sellers/${seller.id}/lives`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSellerLives({ seller, lives: data });
      } else {
        showNotification("Impossible de charger les boutiques du vendeur.", "error");
      }
    } catch (e) {
      showNotification("Erreur", "error");
    }
  };

  // View Live Products
  const handleViewLiveProducts = async (live: any) => {
    try {
      const res = await fetch(`/api/admin/lives/${live.id}/products`);
      if (res.ok) {
        const data = await res.json();
        setSelectedLiveProducts({ live, products: data });
      } else {
        showNotification("Impossible de charger les produits du live.", "error");
      }
    } catch (e) {
      showNotification("Erreur", "error");
    }
  };

  // View Live Stats
  const handleViewLiveStats = async (live: any) => {
    try {
      const res = await fetch(`/api/admin/lives/${live.id}/stats`);
      if (res.ok) {
        const data = await res.json();
        setSelectedLiveStats(data);
      } else {
        showNotification("Impossible de charger les statistiques détaillées.", "error");
      }
    } catch (e) {
      showNotification("Erreur", "error");
    }
  };

  // Toggle Cross-shop recommendation
  const handleToggleRecommendations = async (enabled: boolean) => {
    try {
      const res = await fetch('/api/admin/recommendations/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendationsData((prev: any) => ({ ...prev, enabled: data.enabled }));
        showNotification(`Le moteur de recommandations croisées a été ${data.enabled ? 'activé' : 'désactivé'}.`);
      }
    } catch (e) {
      showNotification("Erreur système", "error");
    }
  };

  // Mark all alerts/notifications as read
  const handleMarkNotificationsRead = async () => {
    try {
      const res = await fetch('/api/admin/notifications/read-all', { method: 'POST' });
      if (res.ok) {
        setAlertsData((prev: any) => ({
          ...prev,
          unreadCount: 0,
          notifications: prev.notifications.map((n: any) => ({ ...n, isRead: true }))
        }));
        showNotification("Notifications marquées comme lues.");
      }
    } catch (e) {
      showNotification("Erreur", "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none" id="admin-dashboard-container">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border transition-all duration-300 transform translate-y-0 ${
          toast.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-950/90 border-rose-500/30 text-rose-300'
        }`} id="admin-toast">
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
          <span className="text-xs font-bold font-sans">{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-slate-900 px-6 py-4 flex justify-between items-center bg-slate-900/30 backdrop-blur-md sticky top-0 z-30" id="admin-navbar">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-black tracking-tight text-white flex items-center gap-2">
              ORION LIVE <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-widest font-black">CONSOLE SAAS</span>
            </h1>
            <p className="text-[10px] text-slate-400">Centre de supervision et contrôle de plateforme multi-vendeurs</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setActiveTab('alerts')}
            className="relative p-2.5 rounded-xl bg-slate-900 border border-slate-850 hover:bg-slate-800 transition text-slate-300"
            title="Alertes & Notifications"
          >
            <Bell className="w-4 h-4" />
            {alertsData.unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-[9px] font-black text-white px-1.5 py-0.5 rounded-full ring-2 ring-slate-950 animate-pulse">
                {alertsData.unreadCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => navigateTo('dashboard')}
            className="bg-indigo-950/50 hover:bg-indigo-950 text-indigo-300 border border-indigo-900 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
          >
            <Video className="w-4 h-4" /> Espace Vendeur
          </button>

          <div className="h-6 w-px bg-slate-800"></div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-xs font-bold text-white leading-3">{user?.name}</p>
              <span className="text-[9px] text-emerald-400 font-mono tracking-widest uppercase">Admin Système</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex" id="admin-main-grid">
        {/* Sidebar Nav */}
        <aside className="w-64 border-r border-slate-900 bg-slate-950/50 p-6 flex flex-col justify-between" id="admin-sidebar">
          <div className="space-y-6">
            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase block">MENUS DE SUPERVISION</span>
            
            <nav className="space-y-1.5 flex-1">
              <button 
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                  activeTab === 'overview' 
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <TrendingUp className="w-4 h-4" /> Vue d'ensemble
              </button>

              <button 
                onClick={() => setActiveTab('sellers')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                  activeTab === 'sellers' 
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <Users className="w-4 h-4" /> Gestion des Vendeurs
              </button>

              <button 
                onClick={() => setActiveTab('lives')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                  activeTab === 'lives' 
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <Video className="w-4 h-4" /> Boutiques en Direct
              </button>

              <button 
                onClick={() => setActiveTab('products')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                  activeTab === 'products' 
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <Package className="w-4 h-4" /> Catalogue Produits
              </button>

              <button 
                onClick={() => setActiveTab('recommendations')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                  activeTab === 'recommendations' 
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <Sparkles className="w-4 h-4" /> Recommandations
              </button>

              <button 
                onClick={() => setActiveTab('audit-logs')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition ${
                  activeTab === 'audit-logs' 
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <ClipboardList className="w-4 h-4" /> Journaux d'Audit
              </button>

              <button 
                onClick={() => setActiveTab('alerts')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition ${
                  activeTab === 'alerts' 
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <span className="flex items-center gap-3">
                  <AlertCircle className="w-4 h-4" /> Alertes Système
                </span>
                {alertsData.unreadCount > 0 && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${activeTab === 'alerts' ? 'bg-slate-950 text-rose-400' : 'bg-rose-950/60 text-rose-300'}`}>
                    {alertsData.unreadCount}
                  </span>
                )}
              </button>
            </nav>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 space-y-3">
            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase block">ÉTAT SERVEUR</span>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-300 font-bold">Orion Cloud Run</span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono leading-relaxed">Neon PostgreSQL: Actif<br />Sécurité: SSL/JWT/RBAC</p>
          </div>
        </aside>

        {/* Dynamic Content Panel */}
        <main className="flex-1 bg-slate-950/20 overflow-y-auto px-8 py-8 space-y-8" id="admin-content-stage">
          
          {/* Header Action Row */}
          <div className="flex justify-between items-center border-b border-slate-900 pb-5">
            <div>
              <h2 className="text-lg font-extrabold text-white capitalize flex items-center gap-2">
                {activeTab === 'overview' && 'Vue d\'ensemble SaaS'}
                {activeTab === 'sellers' && 'Gestion des Comptes Vendeurs'}
                {activeTab === 'lives' && 'Surveillance des Boutiques Éphémères'}
                {activeTab === 'products' && 'Supervision du Catalogue Global'}
                {activeTab === 'recommendations' && 'Moteur de Recommandations Croisées'}
                {activeTab === 'audit-logs' && 'Journal des Actions & Audit Global'}
                {activeTab === 'alerts' && 'Santé Plateforme & Notifications d\'Abus'}
              </h2>
              <p className="text-xs text-slate-400">
                {activeTab === 'overview' && 'Indicateurs clés de performance et statistiques en temps réel.'}
                {activeTab === 'sellers' && 'Gérer, suspendre, activer et consulter l\'activité des vendeurs de live commerce.'}
                {activeTab === 'lives' && 'Superviser l\'état, les statistiques et les produits des sessions de direct publiques.'}
                {activeTab === 'products' && 'Analyser les produits les plus réservés, les ruptures de stock et les invendus.'}
                {activeTab === 'recommendations' && 'Booster le trafic en redirigeant les acheteurs vers des boutiques moins visitées.'}
                {activeTab === 'audit-logs' && 'Historique immuable de toutes les connexions et actions critiques de la plateforme.'}
                {activeTab === 'alerts' && 'Centre d\'incidents automatiques détectant les boutiques expirées et les ruptures.'}
              </p>
            </div>

            <button 
              onClick={fetchData} 
              disabled={loading}
              className="bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-850 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} /> Actualiser
            </button>
          </div>

          {loading && !overviewStats && !sellers.length && !lives.length && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
              <p className="text-xs text-slate-400 font-bold">Chargement des données temps réel...</p>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && overviewStats && (
            <div className="space-y-8" id="tab-overview">
              {/* KPI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition duration-300">
                    <Users className="w-24 h-24 text-amber-500" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-black tracking-wider block uppercase">VENDEURS INSCRITS</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-white">{overviewStats.totalSellers}</span>
                    <span className="text-xs font-bold text-emerald-400">({overviewStats.activeSellers} Actifs)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-3 font-mono">Taux d'activité: {Math.round((overviewStats.activeSellers / (overviewStats.totalSellers || 1)) * 100)}%</p>
                </div>

                <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition duration-300">
                    <Video className="w-24 h-24 text-amber-500" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-black tracking-wider block uppercase">BOUTIQUES ACTIVES</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-amber-400">{overviewStats.activeShops}</span>
                    <span className="text-xs font-bold text-slate-400">({overviewStats.scheduledShops} programmées)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-3 font-mono">Terminées: {overviewStats.endedShops}</p>
                </div>

                <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition duration-300">
                    <CheckCircle2 className="w-24 h-24 text-amber-500" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-black tracking-wider block uppercase">RÉSERVATIONS TOTALES</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-white">{overviewStats.totalReservations}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-3 font-mono">Visiteurs cumulés: {overviewStats.totalVisitors}</p>
                </div>

                <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition duration-300">
                    <Package className="w-24 h-24 text-amber-500" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-black tracking-wider block uppercase">PRODUITS RÉFÉRENCÉS</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-white">{overviewStats.totalProducts}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-3 font-mono">En moyenne {(overviewStats.totalProducts / (overviewStats.totalSellers || 1)).toFixed(1)} produits par vendeur</p>
                </div>

              </div>

              {/* Sub grid: System Health & Activity Sparkline */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Health Panel */}
                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 space-y-4 md:col-span-1">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-amber-400" /> SÉCURITÉ & SANTÉ
                  </h3>

                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center text-xs border-b border-slate-850 pb-2.5">
                      <span className="text-slate-400">Protection d'Accès</span>
                      <span className="text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px]">ACTIVE (RBAC)</span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-b border-slate-850 pb-2.5">
                      <span className="text-slate-400">Contrôle de flux d'API</span>
                      <span className="text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px]">150 req/min</span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-b border-slate-850 pb-2.5">
                      <span className="text-slate-400">Suspension Comptes</span>
                      <span className="text-white font-bold">Immédiat</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Recommandations</span>
                      <span className={`font-bold text-[10px] px-2 py-0.5 rounded border ${
                        recommendationsData.enabled 
                          ? 'text-indigo-400 bg-indigo-950/40 border-indigo-500/20' 
                          : 'text-slate-400 bg-slate-850 border-slate-700/20'
                      }`}>
                        {recommendationsData.enabled ? 'MOTEUR ACTIF' : 'DÉSACTIVÉ'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-2 mt-4">
                    <span className="text-[10px] text-slate-500 font-mono block">RÈGLES EN VIGUEUR</span>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      L'administrateur système a la capacité légale de suspendre temporairement ou de bannir des comptes vendeurs en cas d'abus ou d'incident constaté sur la plateforme.
                    </p>
                  </div>
                </div>

                {/* Platform Overview Actions Logs */}
                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 md:col-span-2 flex flex-col space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-amber-400" /> ALERTES & INCIDENTS SYSTÈME RÉCENTS
                    </h3>
                    <button onClick={() => setActiveTab('alerts')} className="text-amber-500 hover:underline text-[10px] font-bold">
                      Voir tout le centre d'alertes
                    </button>
                  </div>

                  {alertsData.notifications && alertsData.notifications.length > 0 ? (
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[220px] pr-2">
                      {alertsData.notifications.slice(0, 4).map((n: any) => (
                        <div key={n.id} className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                          n.isRead ? 'bg-slate-950/40 border-slate-900 text-slate-400' : 'bg-rose-950/20 border-rose-950/50 text-slate-200'
                        }`}>
                          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${n.isRead ? 'text-slate-500' : 'text-rose-400'}`} />
                          <div className="space-y-0.5">
                            <p className="font-bold text-white text-xs">{n.title}</p>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{n.message}</p>
                            <span className="text-[9px] text-slate-500 block font-mono mt-1">{new Date(n.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-850 rounded-xl">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                      <p className="text-xs font-bold text-white">Aucun incident ou alerte détecté</p>
                      <p className="text-[10px] text-slate-500">Toutes les boutiques et produits respectent les conditions.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: SELLERS */}
          {activeTab === 'sellers' && (
            <div className="space-y-6" id="tab-sellers">
              <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 font-bold uppercase">
                      <th className="p-4">Vendeur</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Inscription</th>
                      <th className="p-4">Boutiques Créées</th>
                      <th className="p-4">Réservations Clients</th>
                      <th className="p-4">Statut de Compte</th>
                      <th className="p-4 text-right">Actions Administrateur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {sellers.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-850/30 transition text-slate-300">
                        <td className="p-4 font-bold text-white flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-[10px]">
                            {s.name.substring(0, 2).toUpperCase()}
                          </span>
                          {s.name}
                        </td>
                        <td className="p-4 font-mono text-[11px]">{s.email}</td>
                        <td className="p-4">{new Date(s.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 font-bold text-white">{s.totalShops} boutiques</td>
                        <td className="p-4 font-bold text-slate-400">{s.totalReservations} réservations</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                            s.status === 'ACTIVE' 
                              ? 'bg-emerald-950/50 border-emerald-500/20 text-emerald-400' 
                              : s.status === 'SUSPENDED' 
                              ? 'bg-rose-950/50 border-rose-500/20 text-rose-400 animate-pulse' 
                              : 'bg-amber-950/50 border-amber-500/20 text-amber-400'
                          }`}>
                            {s.status === 'ACTIVE' ? 'Actif' : s.status === 'SUSPENDED' ? 'Suspendu' : 'En attente'}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button 
                            onClick={() => handleViewSellerLives(s)}
                            className="bg-slate-800 hover:bg-slate-750 text-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-bold transition"
                          >
                            Consulter Boutiques
                          </button>
                          <button 
                            onClick={() => handleViewSellerLogs(s)}
                            className="bg-slate-800 hover:bg-slate-750 text-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-bold transition"
                          >
                            Consulter Logs
                          </button>
                          {s.status === 'SUSPENDED' ? (
                            <button 
                              onClick={() => handleUpdateSellerStatus(s.id, 'ACTIVE')}
                              disabled={actionLoading === s.id}
                              className="bg-emerald-950/60 hover:bg-emerald-950 text-emerald-400 border border-emerald-900/30 px-3 py-1.5 rounded-xl text-[10px] font-bold transition"
                            >
                              Activer
                            </button>
                          ) : (
                            <button 
                              onClick={() => setSuspensionUser(s)}
                              disabled={actionLoading === s.id}
                              className="bg-rose-950/60 hover:bg-rose-950 text-rose-400 border border-rose-900/30 px-3 py-1.5 rounded-xl text-[10px] font-bold transition"
                            >
                              Suspendre
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: LIVES */}
          {activeTab === 'lives' && (
            <div className="space-y-6" id="tab-lives">
              <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 font-bold uppercase">
                      <th className="p-4">Boutique</th>
                      <th className="p-4">Slug public</th>
                      <th className="p-4">Vendeur</th>
                      <th className="p-4">Date de Début / Fin</th>
                      <th className="p-4">Visiteurs</th>
                      <th className="p-4">Réservations</th>
                      <th className="p-4">Statut</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {lives.map((l: any) => (
                      <tr key={l.id} className="hover:bg-slate-850/30 transition text-slate-300">
                        <td className="p-4 font-bold text-white">{l.title}</td>
                        <td className="p-4 font-mono text-[11px] text-amber-500 hover:underline">
                          <a href={`#live/${l.slug}`} target="_blank" rel="noreferrer">/{l.slug}</a>
                        </td>
                        <td className="p-4">
                          <div className="space-y-0.5">
                            <p className="font-bold text-white">{l.seller}</p>
                            <p className="text-[10px] text-slate-500">{l.sellerEmail}</p>
                          </div>
                        </td>
                        <td className="p-4 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                            <span>Début : {new Date(l.startDate).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>Fin : {new Date(l.endDate).toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="p-4 font-bold text-white text-center">{l.visitorsCount}</td>
                        <td className="p-4 font-bold text-white text-center">{l.reservationsCount}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                            l.status === 'ACTIVE' 
                              ? 'bg-emerald-950/60 border-emerald-500/20 text-emerald-400 animate-pulse' 
                              : l.status === 'SCHEDULED' 
                              ? 'bg-indigo-950/60 border-indigo-500/20 text-indigo-400' 
                              : l.status === 'ENDED' 
                              ? 'bg-slate-900 border-slate-800 text-slate-500' 
                              : 'bg-rose-950/60 border-rose-500/20 text-rose-400'
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button 
                            onClick={() => handleViewLiveProducts(l)}
                            className="bg-slate-800 hover:bg-slate-750 text-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-bold transition"
                          >
                            Consulter Produits
                          </button>
                          <button 
                            onClick={() => handleViewLiveStats(l)}
                            className="bg-slate-800 hover:bg-slate-750 text-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-bold transition"
                          >
                            Stats Live
                          </button>
                          {l.status === 'ACTIVE' ? (
                            <button 
                              onClick={() => handleToggleLiveStatus(l.id, 'ACTIVE')}
                              disabled={actionLoading === l.id}
                              className="bg-rose-950/60 hover:bg-rose-950 text-rose-400 border border-rose-900/30 px-3 py-1.5 rounded-xl text-[10px] font-bold transition"
                            >
                              Désactiver
                            </button>
                          ) : l.status === 'INACTIVE' ? (
                            <button 
                              onClick={() => handleToggleLiveStatus(l.id, 'INACTIVE')}
                              disabled={actionLoading === l.id}
                              className="bg-emerald-950/60 hover:bg-emerald-950 text-emerald-400 border border-emerald-900/30 px-3 py-1.5 rounded-xl text-[10px] font-bold transition"
                            >
                              Activer
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PRODUCTS */}
          {activeTab === 'products' && (
            <div className="space-y-8" id="tab-products">
              
              {/* Product Analytics classifications */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Most reserved */}
                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 space-y-4">
                  <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> POPULAIRES (TOP RÉSERVÉS)
                  </h3>
                  <div className="space-y-3 pt-2">
                    {productsData.analytics?.mostReserved?.length > 0 ? (
                      productsData.analytics.mostReserved.map((p: any) => (
                        <div key={p.id} className="flex justify-between items-center text-xs border-b border-slate-850/55 pb-2">
                          <div className="space-y-0.5">
                            <p className="font-bold text-white line-clamp-1">{p.name}</p>
                            <span className="text-[10px] text-slate-500">Par {p.seller}</span>
                          </div>
                          <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                            {p.reservationsCount} réservations
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-500 py-6 text-center">Aucun produit encore réservé.</p>
                    )}
                  </div>
                </div>

                {/* 2. Out of Stock */}
                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 space-y-4">
                  <h3 className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> EN RUPTURE DE STOCK (0)
                  </h3>
                  <div className="space-y-3 pt-2">
                    {productsData.analytics?.outOfStock?.length > 0 ? (
                      productsData.analytics.outOfStock.map((p: any) => (
                        <div key={p.id} className="flex justify-between items-center text-xs border-b border-slate-850/55 pb-2">
                          <div className="space-y-0.5">
                            <p className="font-bold text-white line-clamp-1">{p.name}</p>
                            <span className="text-[10px] text-slate-500">Vendeur: {p.seller}</span>
                          </div>
                          <span className="text-[10px] bg-rose-950/60 text-rose-400 border border-rose-800/30 font-bold px-2 py-0.5 rounded">
                            ÉPUISÉ
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-1" />
                        <p className="text-[11px] text-slate-400 font-bold">Ruptures sous contrôle</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Never Reserved */}
                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <EyeOff className="w-4 h-4" /> INVENDUS (0 RÉSERVATION)
                  </h3>
                  <div className="space-y-3 pt-2">
                    {productsData.analytics?.neverReserved?.length > 0 ? (
                      productsData.analytics.neverReserved.slice(0, 5).map((p: any) => (
                        <div key={p.id} className="flex justify-between items-center text-xs border-b border-slate-850/55 pb-2">
                          <div className="space-y-0.5">
                            <p className="font-bold text-white line-clamp-1">{p.name}</p>
                            <span className="text-[10px] text-slate-500">Prix: {p.price.toLocaleString('fr-FR')} FCFA</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">Stock: {p.stock}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-500 py-6 text-center">Tous les produits ont fait l'objet de réservations.</p>
                    )}
                  </div>
                </div>

              </div>

              {/* Master Products Table */}
              <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-lg">
                <div className="p-5 border-b border-slate-850 flex justify-between items-center bg-slate-950/20">
                  <span className="text-xs font-black text-white uppercase tracking-wider">Catalogue Général de la Plateforme</span>
                  <span className="text-xs text-slate-400">Total: {productsData.products?.length || 0} produits</span>
                </div>

                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 font-bold uppercase">
                      <th className="p-4">Produit</th>
                      <th className="p-4">Vendeur</th>
                      <th className="p-4">Prix</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">Réservations</th>
                      <th className="p-4">État de Vente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {productsData.products?.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-850/30 transition text-slate-300">
                        <td className="p-4 flex items-center gap-3">
                          <img src={p.imageUrl} alt={p.name} referrerPolicy="no-referrer" className="w-8 h-8 rounded-lg object-cover" />
                          <span className="font-bold text-white">{p.name}</span>
                        </td>
                        <td className="p-4">
                          <div className="space-y-0.5">
                            <p className="font-bold text-white">{p.seller}</p>
                            <p className="text-[10px] text-slate-500">{p.sellerEmail}</p>
                          </div>
                        </td>
                        <td className="p-4 font-bold text-white">{p.price.toLocaleString('fr-FR')} FCFA</td>
                        <td className="p-4 font-mono font-bold">{p.stock} unités</td>
                        <td className="p-4 font-bold text-amber-500">{p.reservationsCount} réservations</td>
                        <td className="p-4">
                          {p.stock === 0 ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-rose-950 border border-rose-900/40 text-rose-400">Rupture</span>
                          ) : p.reservationsCount > 20 ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-950 border border-amber-900/40 text-amber-400">Bestseller</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-950 border border-emerald-900/40 text-emerald-400">Normal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* TAB 5: RECOMMENDATIONS */}
          {activeTab === 'recommendations' && (
            <div className="space-y-8" id="tab-recommendations">
              
              {/* Promotion rule controls */}
              <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 flex justify-between items-center relative overflow-hidden">
                <div className="space-y-1 z-10">
                  <span className="text-[10px] text-indigo-400 font-black tracking-widest block uppercase">BOOSTER DE TRAFIC CROISÉ (CROSS-RECOMMENDATION ENGINE)</span>
                  <h3 className="text-md font-extrabold text-white">Algorithme d'optimisation de visibilité de live-commerce</h3>
                  <p className="text-xs text-slate-400 max-w-xl">
                    Cet algorithme détecte en temps réel les directs hautement fréquentés. Il insère ensuite des suggestions vers les produits des vendeurs moins visités sur l'écran d'achat public pour équilibrer le trafic.
                  </p>
                </div>

                <div className="z-10 flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-300">Statut du Moteur :</span>
                  <button 
                    onClick={() => handleToggleRecommendations(!recommendationsData.enabled)}
                    className="focus:outline-none transition-transform active:scale-95"
                  >
                    {recommendationsData.enabled ? (
                      <ToggleRight className="w-12 h-12 text-indigo-500" />
                    ) : (
                      <ToggleLeft className="w-12 h-12 text-slate-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Recommendations grid split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Shops classifications (highly vs low visited) */}
                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 space-y-4">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400" /> VENTES EN DIRECT EN COMPÉTITION (TRAFIC)
                  </h3>
                  <div className="space-y-4 pt-2">
                    
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">🔥 Boutiques à Haute Visibilité</span>
                      {recommendationsData.highlyVisited?.length > 0 ? (
                        recommendationsData.highlyVisited.map((s: any) => (
                          <div key={s.id} className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex justify-between items-center">
                            <span className="text-xs font-bold text-white">{s.title} ({s.seller})</span>
                            <span className="text-[10px] bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded">
                              {s.visitorsCount} visiteurs actifs
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-500">Aucune boutique n'a de visiteurs pour l'instant.</p>
                      )}
                    </div>

                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">📉 Boutiques à promouvoir</span>
                      {recommendationsData.lowVisited?.length > 0 ? (
                        recommendationsData.lowVisited.map((s: any) => (
                          <div key={s.id} className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400">{s.title} ({s.seller})</span>
                            <span className="text-[10px] bg-slate-900 border border-slate-850 text-slate-400 px-2 py-0.5 rounded">
                              {s.visitorsCount} visiteurs
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-500">Toutes les boutiques ont un trafic élevé ou similaire.</p>
                      )}
                    </div>

                  </div>
                </div>

                {/* Generated recommendation recommendations list */}
                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 space-y-4">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> CHEMINS DE RECOMMANDATIONS GÉNÉRÉS
                  </h3>
                  
                  {recommendationsData.enabled ? (
                    <div className="space-y-3 pt-2">
                      {recommendationsData.recommendations?.length > 0 ? (
                        recommendationsData.recommendations.map((r: any) => (
                          <div key={r.id} className="p-4 rounded-xl bg-slate-950 border border-indigo-950/40 flex flex-col space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-bold">Produit: <strong className="text-white">{r.productName}</strong></span>
                              <span className="text-indigo-400 font-bold font-mono">{r.productPrice.toLocaleString('fr-FR')} FCFA</span>
                            </div>

                            <p className="text-[11px] text-slate-400">
                              Promu de la boutique <strong className="text-amber-500">"{r.sourceShop}"</strong> vers l'audience de la boutique <strong className="text-white">"{r.targetShop}"</strong>.
                            </p>

                            <div className="flex justify-between items-center pt-2 text-[10px] border-t border-slate-900 text-slate-500">
                              <span>Clics sur la recommandation :</span>
                              <span className="font-bold font-mono text-indigo-400">{r.clicsCount} clics</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-500 py-6 text-center">Aucune recommandation croisée n'est disponible (il faut au moins 2 boutiques en direct de trafic différent).</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl py-12">
                      <EyeOff className="w-8 h-8 text-slate-600 mb-2" />
                      <p className="text-xs font-bold text-slate-400">Moteur de recommandation désactivé</p>
                      <p className="text-[10px] text-slate-500 mt-1">Activez le moteur ci-dessus pour promouvoir automatiquement les boutiques éphémères.</p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB 6: AUDIT LOGS */}
          {activeTab === 'audit-logs' && (
            <div className="space-y-6" id="tab-audit-logs">
              
              {/* Search Filters Row */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrer par Vendeur (Email/Nom)</label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      value={logSeller}
                      onChange={(e) => setLogSeller(e.target.value)}
                      placeholder="Ex: seller@gmail.com"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none placeholder-slate-600"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Action Critique</label>
                  <select 
                    value={logAction}
                    onChange={(e) => setLogAction(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none text-slate-300"
                  >
                    <option value="">Toutes les actions</option>
                    <option value="CONNEXION">Connexion Vendeur</option>
                    <option value="CREATION_BOUTIQUE">Création Boutique</option>
                    <option value="MODIFICATION_BOUTIQUE">Modification Boutique</option>
                    <option value="EXPIREE_BOUTIQUE">Boutique Expirée</option>
                    <option value="SUPPRESSION_PRODUIT">Suppression Produit</option>
                    <option value="RESERVATION_PRODUIT">Réservation Produit</option>
                    <option value="SUSPENSION_VENDEUR">Suspension Vendeur</option>
                    <option value="REACTIVATION_VENDEUR">Réactivation Vendeur</option>
                    <option value="ACTION_ADMINISTRATIVE">Actions Administrateur</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date Précise</label>
                  <input 
                    type="date" 
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none text-slate-300"
                  />
                </div>

                <button 
                  onClick={fetchData}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 py-2 rounded-xl text-xs font-black transition uppercase tracking-wider"
                >
                  Filtrer les journaux
                </button>
              </div>

              {/* Logs Table */}
              <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 font-bold uppercase">
                      <th className="p-4">Horodatage</th>
                      <th className="p-4">Opérateur / Vendeur</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Détails de l'évènement</th>
                      <th className="p-4">Adresse IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {auditLogs.length > 0 ? (
                      auditLogs.map((l: any) => (
                        <tr key={l.id} className="hover:bg-slate-850/30 transition text-slate-300">
                          <td className="p-4 font-mono text-[11px] text-slate-400">{new Date(l.createdAt).toLocaleString()}</td>
                          <td className="p-4">
                            <div className="space-y-0.5">
                              <p className="font-bold text-white">{l.userName || 'Système Orion'}</p>
                              <p className="text-[10px] text-slate-500">{l.userEmail || 'system@orion.live'}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              l.action.includes('SUSPENSION') || l.action.includes('SUPPRESSION')
                                ? 'bg-rose-950 text-rose-400 border border-rose-800/30'
                                : l.action.includes('CREATION') || l.action.includes('REACTIVATION')
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/30'
                                : l.action.includes('RESERVATION')
                                ? 'bg-indigo-950 text-indigo-400 border border-indigo-800/30'
                                : 'bg-slate-850 text-slate-300 border border-slate-800'
                            }`}>
                              {l.action}
                            </span>
                          </td>
                          <td className="p-4 text-slate-300 max-w-sm line-clamp-2 leading-relaxed">{l.details}</td>
                          <td className="p-4 font-mono text-[10px] text-slate-500">{l.ipAddress || '127.0.0.1'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">Aucun journal d'audit ne correspond à ces critères.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* TAB 7: ALERTS */}
          {activeTab === 'alerts' && (
            <div className="space-y-6" id="tab-alerts">
              
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">INCIDENTS & NOTIFICATIONS SYSTÈME AUTOMATIQUES</span>
                {alertsData.unreadCount > 0 && (
                  <button 
                    onClick={handleMarkNotificationsRead}
                    className="bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-850 px-3 py-1.5 rounded-xl text-xs font-bold transition"
                  >
                    Marquer tout comme lu
                  </button>
                )}
              </div>

              {/* Master Alerts list */}
              <div className="grid grid-cols-1 gap-4">
                {alertsData.notifications && alertsData.notifications.length > 0 ? (
                  alertsData.notifications.map((n: any) => (
                    <div key={n.id} className={`p-5 rounded-2xl border flex items-start gap-4 shadow-sm transition ${
                      n.isRead ? 'bg-slate-900/40 border-slate-900 text-slate-400' : 'bg-rose-950/20 border-rose-500/20 text-slate-200'
                    }`}>
                      <div className={`p-2.5 rounded-xl ${n.isRead ? 'bg-slate-950 text-slate-500' : 'bg-rose-950 border border-rose-800/40 text-rose-400'}`}>
                        <ShieldAlert className="w-5 h-5" />
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black text-white">{n.title}</h4>
                          <span className="text-[10px] font-mono text-slate-500">{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                        
                        <div className="flex items-center gap-2 pt-2 text-[10px]">
                          <span className="text-slate-500 font-bold uppercase tracking-wider">TYPE D'INCIDENT:</span>
                          <span className="font-mono text-amber-500 font-bold">{n.type}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-20 border border-dashed border-slate-800 rounded-2xl">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3 animate-bounce" />
                    <h3 className="text-sm font-bold text-white">Zéro Incident Constaté</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      Le système autonome surveille en permanence la validité des dates des boutiques éphémères et l'intégrité des stocks.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

        </main>
      </div>

      {/* SUSPENSION MODAL */}
      {suspensionUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" id="suspension-modal">
          <div className="bg-slate-900 border border-rose-500/20 max-w-md w-full rounded-2xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-md font-extrabold text-white">Suspendre le Vendeur</h3>
                <p className="text-xs text-slate-400 font-bold">Vendeur: {suspensionUser.name} ({suspensionUser.email})</p>
              </div>
              <button onClick={() => setSuspensionUser(null)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Motif de suspension obligatoire</label>
              <textarea 
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                placeholder="Ex: Non-respect des règles de livraison, produits contrefaits, ou boutique illégale."
                rows={4}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs focus:ring-1 focus:ring-rose-500 focus:outline-none placeholder-slate-600 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                onClick={() => setSuspensionUser(null)}
                className="bg-slate-850 hover:bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-bold transition"
              >
                Annuler
              </button>
              <button 
                onClick={() => handleUpdateSellerStatus(suspensionUser.id, 'SUSPENDED', suspensionReason)}
                disabled={!suspensionReason.trim()}
                className="bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-xl text-xs font-black transition disabled:opacity-50"
              >
                Confirmer la suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELLER LOGS OVERLAY MODAL */}
      {selectedSellerLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" id="seller-logs-modal">
          <div className="bg-slate-900 border border-slate-850 max-w-2xl w-full rounded-2xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-md font-extrabold text-white">Activité de {selectedSellerLogs.seller.name}</h3>
                <p className="text-xs text-slate-400">Courriel : {selectedSellerLogs.seller.email}</p>
              </div>
              <button onClick={() => setSelectedSellerLogs(null)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 border-t border-slate-850 pt-4">
              {selectedSellerLogs.logs?.length > 0 ? (
                selectedSellerLogs.logs.map((l: any) => (
                  <div key={l.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex flex-col space-y-1 text-xs">
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>{new Date(l.createdAt).toLocaleString()}</span>
                      <span className="font-mono">{l.ipAddress || 'IP masquée'}</span>
                    </div>
                    <p className="font-bold text-amber-500 uppercase text-[10px] tracking-wider">{l.action}</p>
                    <p className="text-slate-300 leading-relaxed text-xs">{l.details}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-10">Aucun journal d'audit enregistré pour ce vendeur.</p>
              )}
            </div>

            <div className="pt-2">
              <button 
                onClick={() => setSelectedSellerLogs(null)}
                className="w-full bg-slate-850 hover:bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-bold transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELLER BOUTIQUES OVERLAY MODAL */}
      {selectedSellerLives && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" id="seller-lives-modal">
          <div className="bg-slate-900 border border-slate-850 max-w-2xl w-full rounded-2xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-md font-extrabold text-white">Boutiques de {selectedSellerLives.seller.name}</h3>
                <p className="text-xs text-slate-400">Total : {selectedSellerLives.lives?.length || 0} boutiques créées</p>
              </div>
              <button onClick={() => setSelectedSellerLives(null)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 border-t border-slate-850 pt-4">
              {selectedSellerLives.lives?.length > 0 ? (
                selectedSellerLives.lives.map((l: any) => (
                  <div key={l.id} className="p-4 bg-slate-950 border border-slate-850 rounded-xl flex justify-between items-center text-xs">
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-sm">{l.title}</h4>
                      <p className="text-slate-400 text-[11px] font-mono">Slug : /{l.slug}</p>
                      <p className="text-[10px] text-slate-500">Planification : {new Date(l.startDate).toLocaleString()} - {new Date(l.endDate).toLocaleString()}</p>
                    </div>

                    <div className="text-right space-y-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        l.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-900 text-slate-500'
                      }`}>
                        {l.status}
                      </span>
                      <div className="text-[10px] text-slate-400 font-bold">
                        {l._count.visitors} Visiteurs | {l._count.reservations} Réservations
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-10">Aucune boutique enregistrée pour ce vendeur.</p>
              )}
            </div>

            <div className="pt-2">
              <button 
                onClick={() => setSelectedSellerLives(null)}
                className="w-full bg-slate-850 hover:bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-bold transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIVE PRODUCTS OVERLAY MODAL */}
      {selectedLiveProducts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" id="live-products-modal">
          <div className="bg-slate-900 border border-slate-850 max-w-xl w-full rounded-2xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-md font-extrabold text-white">Produits du Live : {selectedLiveProducts.live.title}</h3>
                <p className="text-xs text-slate-400">Total : {selectedLiveProducts.products?.length || 0} produits présentés</p>
              </div>
              <button onClick={() => setSelectedLiveProducts(null)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 border-t border-slate-850 pt-4">
              {selectedLiveProducts.products?.length > 0 ? (
                selectedLiveProducts.products.map((p: any) => (
                  <div key={p.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex items-center gap-4 text-xs">
                    <img src={p.imageUrl} alt={p.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-lg object-cover" />
                    <div className="flex-1 space-y-0.5">
                      <h4 className="font-bold text-white">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{p.description || "Pas de description"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-amber-500 font-mono text-[11px]">{Number(p.price).toLocaleString('fr-FR')} FCFA</p>
                      <p className="text-[10px] text-slate-500 font-bold">Stock : {p.stock}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-10">Aucun produit présenté lors de ce direct.</p>
              )}
            </div>

            <div className="pt-2">
              <button 
                onClick={() => setSelectedLiveProducts(null)}
                className="w-full bg-slate-850 hover:bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-bold transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIVE STATS DÉTAILLÉES OVERLAY MODAL */}
      {selectedLiveStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" id="live-stats-modal">
          <div className="bg-slate-900 border border-slate-850 max-w-2xl w-full rounded-2xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-md font-extrabold text-white">Analyse de Performance Direct</h3>
                <p className="text-xs text-slate-400">Live : {selectedLiveStats.title} (Vendeur : {selectedLiveStats.seller?.name})</p>
              </div>
              <button onClick={() => setSelectedLiveStats(null)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 border-t border-slate-850 pt-4">
              
              {/* Traffic vs Reservations Stats cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">VISITEURS UNIQUES</span>
                  <p className="text-xl font-black text-white">{selectedLiveStats.visitors?.length || 0}</p>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">CLICS D'INTÉRÊT</span>
                  <p className="text-xl font-black text-amber-500">{selectedLiveStats.interests?.length || 0}</p>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">RÉSERVATIONS</span>
                  <p className="text-xl font-black text-emerald-400">{selectedLiveStats.reservations?.length || 0}</p>
                </div>
              </div>

              {/* Reservations List */}
              <div className="space-y-3">
                <span className="text-[10px] text-slate-500 font-black tracking-widest block uppercase">LISTE DES RÉSERVATIONS CONFIRMÉES</span>
                {selectedLiveStats.reservations?.length > 0 ? (
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-2">
                    {selectedLiveStats.reservations.map((r: any) => (
                      <div key={r.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex justify-between items-center text-xs">
                        <div className="space-y-0.5">
                          <p className="font-bold text-white">Client : {r.buyerPseudo}</p>
                          <p className="text-[10px] text-slate-500">Contact WhatsApp : {r.buyerWhatsapp}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-300">{r.product?.name}</p>
                          <p className="text-[10px] text-slate-500">Quantité : {r.quantity} unité(s)</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-6 text-center">Aucune réservation passée sur ce direct.</p>
                )}
              </div>

              {/* Interests list */}
              <div className="space-y-3">
                <span className="text-[10px] text-slate-500 font-black tracking-widest block uppercase">PRODUITS AYANT SUSCITÉ DE L'INTÉRÊT (CLICS)</span>
                {selectedLiveStats.interests?.length > 0 ? (
                  <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-2">
                    {selectedLiveStats.interests.map((i: any) => (
                      <div key={i.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex justify-between items-center text-xs">
                        <span className="font-bold text-white">Acheteur : {i.buyerPseudo}</span>
                        <span className="text-[10px] text-slate-400">Intéressé(e) par : <strong className="text-amber-500">{i.product?.name}</strong></span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-6 text-center">Aucun clic d'intérêt pour le moment.</p>
                )}
              </div>

            </div>

            <div className="pt-2">
              <button 
                onClick={() => setSelectedLiveStats(null)}
                className="w-full bg-slate-850 hover:bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-bold transition"
              >
                Fermer l'analyse
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

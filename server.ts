import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import { db, dbConnectionError, prisma } from './src/database';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import * as fs from 'fs';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'ADMIN' | 'SELLER';
        name: string;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'orion-live-secret-jwt-key-2026';
const PORT = 3000;

async function startServer() {
  const app = express();
  
  app.use(express.json());
  app.use(cookieParser());

  // Database Connection Health Check Middleware - Fail Fast if Neon is not configured/connected
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (dbConnectionError) {
      console.warn("Blocking request due to database connection error:", dbConnectionError);
      
      // If it is an API call, return service unavailable with a clear message
      if (req.path.startsWith('/api/')) {
        return res.status(503).json({
          error: "ERREUR: Base de données Neon non configurée ou inaccessible. Le système ne peut pas fonctionner sans connexion PostgreSQL."
        });
      }
      
      // If it is a page request, return a beautiful full-screen error
      return res.status(503).send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Erreur Critique de Configuration - Orion Live</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Inter', sans-serif; }
          </style>
        </head>
        <body class="bg-[#0b0f19] text-slate-100 flex items-center justify-center min-h-screen p-6">
          <div class="max-w-xl w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
            <div class="inline-flex p-4 bg-red-950/40 rounded-full text-red-500 border border-red-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            
            <div class="space-y-2">
              <h1 class="text-xl font-bold text-white">Base de données Neon non configurée</h1>
              <p class="text-xs text-red-400 font-semibold leading-relaxed">
                Le système ne peut pas fonctionner sans connexion PostgreSQL. Aucun mode fallback local n'est autorisé.
              </p>
            </div>

            <div class="bg-black/40 border border-slate-800 p-4 rounded-xl text-left text-xs font-mono text-slate-300 break-all overflow-auto max-h-48 whitespace-pre-wrap">${dbConnectionError}</div>

            <div class="text-[11px] text-slate-500 pt-4 border-t border-slate-850">
              <p>Veuillez configurer votre variable d'environnement <code class="bg-slate-950 text-indigo-400 px-1 py-0.5 rounded">DATABASE_URL</code> dans l'onglet des Paramètres (Settings) d'AI Studio.</p>
              <p class="mt-2">L'application se reconnectera automatiquement une fois la base configurée.</p>
            </div>
          </div>
        </body>
        </html>
      `);
    }
    next();
  });

  // Helper: auto-update lives based on date limits
  const autoCheckDates = async () => {
    try {
      await db.autoCheckDates();
    } catch (e) {
      console.error("Error auto checking dates:", e);
    }
  };

  // Run auto check periodically
  setInterval(autoCheckDates, 60000);

  // ==========================================
  // AUTH MIDDLEWARES
  // ==========================================
  const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.orion_session;
    if (!token) {
      return res.status(401).json({ error: "Non authentifié (401)" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
      const user = await db.getUserById(decoded.id);
      if (!user) {
        res.clearCookie('orion_session', { httpOnly: true, secure: true, sameSite: 'none' });
        return res.status(401).json({ error: "Utilisateur inexistant" });
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role as 'ADMIN' | 'SELLER',
        name: user.name
      };
      next();
    } catch (err) {
      res.clearCookie('orion_session', { httpOnly: true, secure: true, sameSite: 'none' });
      return res.status(401).json({ error: "Session expirée ou invalide" });
    }
  };

  const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    await requireAuth(req, res, async (err) => {
      if (err) return next(err);
      if (req.user && req.user.role === 'ADMIN') {
        next();
      } else {
        return res.status(403).json({ error: "Accès refusé. Rôle ADMIN requis (403)" });
      }
    });
  };

  // ==========================================
  // AUTHENTICATION API ROUTES
  // ==========================================
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Veuillez remplir tous les champs obligatoires." });
    }

    const assignedRole = (role === 'ADMIN' || role === 'SELLER') ? role : 'SELLER';

    try {
      const existing = await db.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Cet email est déjà enregistré." });
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const user = await db.insertUser({
        email,
        password_hash: passwordHash,
        name,
        role: assignedRole
      });

      return res.status(201).json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Erreur lors de l'enregistrement" });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Veuillez saisir votre email et votre mot de passe." });
    }

    try {
      const user = await db.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ error: "Identifiants incorrects." });
      }

      const match = bcrypt.compareSync(password, user.password_hash);
      if (!match) {
        return res.status(400).json({ error: "Identifiants incorrects." });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
      
      res.cookie('orion_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      });

      return res.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      });
    } catch (err: any) {
      return res.status(500).json({ error: "Erreur lors de la connexion." });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    res.clearCookie('orion_session', { httpOnly: true, secure: true, sameSite: 'none' });
    return res.json({ success: true });
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    const token = req.cookies.orion_session;
    if (!token) {
      return res.status(401).json({ authenticated: false, error: "Non authentifié (401)" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
      const user = await db.getUserById(decoded.id);
      if (!user) {
        return res.status(401).json({ authenticated: false, error: "Utilisateur inexistant" });
      }

      return res.json({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (err) {
      res.clearCookie('orion_session', { httpOnly: true, secure: true, sameSite: 'none' });
      return res.status(401).json({ authenticated: false, error: "Session expirée" });
    }
  });

  // ==========================================
  // SELLER PRODUCTS ENDPOINTS
  // ==========================================
  app.get('/api/products', requireAuth, async (req: Request, res: Response) => {
    try {
      let products;
      if (req.user?.role === 'ADMIN') {
        products = await db.getProducts();
      } else {
        products = await db.getProducts(req.user?.id);
      }
      return res.json(products);
    } catch (e) {
      return res.status(500).json({ error: "Erreur de récupération des produits" });
    }
  });

  app.post('/api/products', requireAuth, async (req: Request, res: Response) => {
    const { name, description, price, stock, image_url, is_active } = req.body;
    if (!name || price === undefined || stock === undefined) {
      return res.status(400).json({ error: "Nom, prix et stock sont obligatoires." });
    }

    try {
      const product = await db.createProduct({
        name,
        description: description || '',
        price: parseFloat(price),
        stock: parseInt(stock),
        image_url: image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80',
        is_active: is_active !== false,
        user_id: req.user!.id
      });
      return res.status(201).json(product);
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Erreur création produit" });
    }
  });

  app.put('/api/products/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, price, stock, image_url, is_active } = req.body;

    try {
      // Check ownership
      const existing = await db.getProductById(id);
      if (!existing) return res.status(404).json({ error: "Produit non trouvé" });
      if (req.user?.role !== 'ADMIN' && existing.user_id !== req.user?.id) {
        return res.status(403).json({ error: "Action non autorisée" });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (price !== undefined) updates.price = parseFloat(price);
      if (stock !== undefined) updates.stock = parseInt(stock);
      if (image_url !== undefined) updates.image_url = image_url;
      if (is_active !== undefined) updates.is_active = is_active;

      const product = await db.updateProduct(id, updates);

      // Recheck linked active live sessions to see if they should toggle to SOLD_OUT or ACTIVE
      const linkedLps = await db.getLiveProductsByProductId(id);
      for (const lp of linkedLps) {
        const liveId = lp.live_session_id;
        const linkedProducts = await db.getProductsForLiveSession(liveId);

        const allSoldOut = linkedProducts.every((p: any) => p.stock <= 0);
        const liveSession = await db.getLiveSessionById(liveId);
        if (liveSession && (liveSession.status === 'ACTIVE' || liveSession.status === 'SOLD_OUT')) {
          const newStatus = allSoldOut ? 'SOLD_OUT' : 'ACTIVE';
          if (liveSession.status !== newStatus) {
            await db.updateLiveSession(liveId, { status: newStatus });
          }
        }
      }

      return res.json(product);
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Erreur de mise à jour" });
    }
  });

  app.delete('/api/products/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const existing = await db.getProductById(id);
      if (!existing) return res.status(404).json({ error: "Produit non trouvé" });
      if (req.user?.role !== 'ADMIN' && existing.user_id !== req.user?.id) {
        return res.status(403).json({ error: "Action non autorisée" });
      }

      await db.deleteProduct(id);
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: "Erreur de suppression" });
    }
  });

  // ==========================================
  // LIVE SESSIONS ENDPOINTS
  // ==========================================
  app.get('/api/lives', requireAuth, async (req: Request, res: Response) => {
    try {
      await autoCheckDates();
      let lives;
      if (req.user?.role === 'ADMIN') {
        lives = await db.getLiveSessions();
      } else {
        lives = await db.getLiveSessions(req.user?.id);
      }
      return res.json(lives);
    } catch (e) {
      return res.status(500).json({ error: "Erreur de récupération des lives" });
    }
  });

  app.post('/api/lives', requireAuth, async (req: Request, res: Response) => {
    const { title, description, image_url, status, slug, start_date, end_date, product_ids } = req.body;
    if (!title || !slug || !start_date || !end_date) {
      return res.status(400).json({ error: "Titre, slug de boutique, date de début et de fin sont obligatoires." });
    }

    // Verify 24h duration limit
    const start = new Date(start_date).getTime();
    const end = new Date(end_date).getTime();
    const durationMs = end - start;
    if (durationMs > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: "La durée maximale d'une session live est limitée à 24 heures." });
    }
    if (durationMs <= 0) {
      return res.status(400).json({ error: "La date de fin doit être postérieure à la date de début." });
    }

    try {
      const existingSlug = await db.getLiveSessionBySlug(slug);
      if (existingSlug) {
        return res.status(400).json({ error: "Le slug de boutique saisi est déjà utilisé pour un autre live." });
      }

      const live = await db.createLiveSession({
        title,
        description: description || '',
        image_url: image_url || 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600&q=80',
        status: status || 'DRAFT',
        slug,
        start_date,
        end_date,
        user_id: req.user!.id
      });

      if (product_ids && Array.isArray(product_ids)) {
        await db.syncLiveProducts(live.id, product_ids);
      }

      return res.status(201).json(live);
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Erreur de création du live" });
    }
  });

  app.put('/api/lives/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, description, image_url, status, slug, start_date, end_date, product_ids } = req.body;

    try {
      const existing = await db.getLiveSessionById(id);
      if (!existing) return res.status(404).json({ error: "Session live non trouvée." });
      if (req.user?.role !== 'ADMIN' && existing.user_id !== req.user?.id) {
        return res.status(403).json({ error: "Action non autorisée" });
      }

      // Verify 24h duration limit if dates are updated
      const finalStart = start_date || existing.start_date;
      const finalEnd = end_date || existing.end_date;
      const start = new Date(finalStart).getTime();
      const end = new Date(finalEnd).getTime();
      const durationMs = end - start;
      if (durationMs > 24 * 60 * 60 * 1000) {
        return res.status(400).json({ error: "La durée maximale d'une session live est limitée à 24 heures." });
      }
      if (durationMs <= 0) {
        return res.status(400).json({ error: "La date de fin doit être postérieure à la date de début." });
      }

      if (slug && slug !== existing.slug) {
        const existingSlug = await db.getLiveSessionBySlug(slug, id);
        if (existingSlug) {
          return res.status(400).json({ error: "Ce slug est déjà utilisé par un autre live." });
        }
      }

      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (image_url !== undefined) updates.image_url = image_url;
      if (status !== undefined) updates.status = status;
      if (slug !== undefined) updates.slug = slug;
      if (start_date !== undefined) updates.start_date = start_date;
      if (end_date !== undefined) updates.end_date = end_date;

      const updatedLive = await db.updateLiveSession(id, updates);

      if (product_ids && Array.isArray(product_ids)) {
        await db.syncLiveProducts(id, product_ids);
      }

      return res.json(updatedLive);
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Erreur de mise à jour du live." });
    }
  });

  app.delete('/api/lives/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const existing = await db.getLiveSessionById(id);
      if (!existing) return res.status(404).json({ error: "Live non trouvé" });
      if (req.user?.role !== 'ADMIN' && existing.user_id !== req.user?.id) {
        return res.status(403).json({ error: "Action non autorisée" });
      }

      await db.deleteLiveSession(id);
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: "Erreur de suppression" });
    }
  });

  app.get('/api/lives/:id/analytics', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const live = await db.getLiveSessionById(id);
      if (!live) return res.status(404).json({ error: "Live non trouvé" });
      if (req.user?.role !== 'ADMIN' && live.user_id !== req.user?.id) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      const reservations = await db.getReservationsByLiveSessionId(id);
      const interests = await db.getProductInterestsByLiveSessionId(id);
      const visitorSessions = await db.getVisitorSessionsByLiveSessionId(id);
      const logs = await db.getAuditLogsByLiveSessionId(id);
      const notifications = await db.getLiveNotificationsByLiveId(id);

      const preRegistrationsCount = notifications.length;

      // Calculate visitors before start
      const start_date = new Date(live.start_date).getTime();
      const visitorsBeforeStart = visitorSessions.filter((vs: any) => new Date(vs.joined_at).getTime() < start_date);
      const visitorsBeforeStartCount = visitorsBeforeStart.length;

      const preRegistrationConversionRate = visitorsBeforeStartCount > 0 
        ? Math.round((preRegistrationsCount / visitorsBeforeStartCount) * 100) 
        : 0;

      return res.json({
        live,
        reservationsCount: reservations.length,
        interestsCount: interests.length,
        uniqueVisitorsCount: visitorSessions.length,
        preRegistrationsCount,
        visitorsBeforeStartCount,
        preRegistrationConversionRate,
        logs
      });
    } catch (e) {
      return res.status(500).json({ error: "Erreur analytiques" });
    }
  });

  // Reactivate finished live session
  app.post('/api/lives/:id/reactivate', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { start_date, end_date } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: "Date de début et de fin sont obligatoires." });
    }

    const start = new Date(start_date).getTime();
    const end = new Date(end_date).getTime();
    const durationMs = end - start;
    if (durationMs > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: "La durée maximale d'une session live est limitée à 24 heures." });
    }
    if (durationMs <= 0) {
      return res.status(400).json({ error: "La date de fin doit être postérieure à la date de début." });
    }

    try {
      const live = await db.getLiveSessionById(id);
      if (!live) {
        return res.status(404).json({ error: "Session live non trouvée." });
      }

      if (req.user?.role !== 'ADMIN' && live.user_id !== req.user?.id) {
        return res.status(403).json({ error: "Action non autorisée" });
      }

      if (live.status !== 'ENDED' && live.status !== 'ARCHIVED') {
        return res.status(400).json({ error: "Seuls les lives terminés peuvent être réactivés." });
      }

      // Rename the old session's slug to free up the original slug
      const originalSlug = live.slug;
      const archivedSlug = `${originalSlug}-hist-${Math.random().toString(36).substr(2, 5)}`;

      // Update old session
      await db.updateLiveSession(live.id, { 
         slug: archivedSlug,
         status: 'ARCHIVED'
      });

      // Create new live session with original slug
      const newLive = await db.createLiveSession({
        title: live.title,
        description: live.description,
        image_url: live.image_url,
        status: 'SCHEDULED',
        slug: originalSlug,
        start_date,
        end_date,
        user_id: live.user_id
      });

      // Fetch linked products from the old session
      const oldProducts = await db.getProductsForLiveSession(live.id);
      const productIds = oldProducts.map((p: any) => p.id);
      if (productIds.length > 0) {
        await db.syncLiveProducts(newLive.id, productIds);
      }

      return res.status(201).json(newLive);
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Erreur lors de la réactivation du live." });
    }
  });

  // ==========================================
  // PUBLIC LIVE VISITOR ENDPOINTS
  // ==========================================
  app.get('/api/lives/public/:slug', async (req: Request, res: Response) => {
    const { slug } = req.params;
    try {
      await autoCheckDates();
      const live = await db.getLiveSessionBySlug(slug);
      if (!live) {
        return res.status(404).json({ error: "La boutique de vente en direct demandée n'existe pas ou est introuvable." });
      }

      // Grab products
      const products = await db.getProductsForLiveSession(live.id);
      const activeProducts = products.filter(p => p.is_active);

      // Recheck/Update sold out status if it changed (only for ACTIVE/SOLD_OUT status)
      if (live.status === 'ACTIVE' || live.status === 'SOLD_OUT') {
        const allSoldOut = activeProducts.length > 0 && activeProducts.every((p: any) => p.stock <= 0);
        if (allSoldOut && live.status === 'ACTIVE') {
          live.status = 'SOLD_OUT';
          await db.updateLiveSession(live.id, { status: 'SOLD_OUT' });
        } else if (!allSoldOut && live.status === 'SOLD_OUT') {
          live.status = 'ACTIVE';
          await db.updateLiveSession(live.id, { status: 'ACTIVE' });
        }
      }

      // Grab dynamic activities/logs for live comments simulation
      const logs = await db.getAuditLogsByLiveSessionId(live.id);

      // Grab pre-registration details if scheduled
      let preRegistrationsCount = 0;
      if (live.status === 'SCHEDULED') {
        const notifs = await db.getLiveNotificationsByLiveId(live.id);
        preRegistrationsCount = notifs.length;
      }

      return res.json({
        live,
        products: activeProducts,
        logs,
        preRegistrationsCount
      });
    } catch (e) {
      return res.status(500).json({ error: "Erreur d'accès à la boutique de vente." });
    }
  });

  app.post('/api/lives/public/:slug/join', async (req: Request, res: Response) => {
    const { slug } = req.params;
    const { pseudo, whatsapp } = req.body;
    if (!pseudo) return res.status(400).json({ error: "Un pseudo est requis." });

    try {
      const live = await db.getLiveSessionBySlug(slug);
      if (!live) return res.status(404).json({ error: "Live introuvable" });

      await db.recordJoin(pseudo, whatsapp, live.id);

      return res.json({ success: true, message: "Connexion au live enregistrée !" });
    } catch (e) {
      return res.status(500).json({ error: "Erreur de connexion" });
    }
  });

  // Pre-registration notification sign-up for SCHEDULED lives
  app.post('/api/lives/public/:slug/notify', async (req: Request, res: Response) => {
    const { slug } = req.params;
    const { pseudo, whatsapp } = req.body;
    if (!pseudo) return res.status(400).json({ error: "Un pseudo est requis." });

    try {
      const live = await db.getLiveSessionBySlug(slug);
      if (!live) return res.status(404).json({ error: "Boutique de vente en direct introuvable." });

      if (live.status !== 'SCHEDULED') {
        return res.status(400).json({ error: "Les inscriptions ne sont autorisées que pour les sessions programmées." });
      }

      await db.createLiveNotification({
        live_id: live.id,
        pseudo,
        whatsapp: whatsapp || ''
      });

      // Add audit log for notification registration
      await db.insertAuditLog({
        live_session_id: live.id,
        visitor_pseudo: pseudo,
        action_type: 'pre-register',
        details: `S'est pré-inscrit(e) pour recevoir une alerte au lancement du live.`
      });

      return res.json({ success: true, message: "Pré-inscription validée !" });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Erreur d'inscription" });
    }
  });

  app.post('/api/lives/public/:slug/interest', async (req: Request, res: Response) => {
    const { slug } = req.params;
    const { pseudo, productId } = req.body;
    if (!pseudo || !productId) return res.status(400).json({ error: "Paramètres manquants." });

    try {
      const live = await db.getLiveSessionBySlug(slug);
      if (!live) return res.status(404).json({ error: "Live introuvable" });

      await db.recordInterest(pseudo, productId, live.id);
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: "Erreur enregistrement intérêt" });
    }
  });

  app.post('/api/lives/public/:slug/reserve', async (req: Request, res: Response) => {
    const { slug } = req.params;
    const { pseudo, whatsapp, productId } = req.body;
    if (!pseudo || !productId || !whatsapp) {
      return res.status(400).json({ error: "Veuillez entrer votre pseudo et votre numéro WhatsApp." });
    }

    try {
      const live = await db.getLiveSessionBySlug(slug);
      if (!live) return res.status(404).json({ error: "Boutique de vente en direct introuvable." });

      if (live.status !== 'ACTIVE') {
        return res.status(400).json({ error: "Les réservations ne sont autorisées que pendant une session live active." });
      }

      const reservation = await db.executeAtomicReservation(pseudo, whatsapp, productId, live.id);
      return res.json({ success: true, reservation });
    } catch (e: any) {
      return res.status(400).json({ error: e.message || "Rupture de stock ou erreur de traitement." });
    }
  });

  // ==========================================
  // SELLER DASHBOARD METRICS
  // ==========================================
  app.get('/api/seller/stats', requireAuth, async (req: Request, res: Response) => {
    try {
      const stats = await db.getSellerStats(req.user!.id);
      return res.json(stats);
    } catch (e) {
      return res.status(500).json({ error: "Erreur de récupération des statistiques" });
    }
  });

  // ==========================================
  // ADMIN CONTROL ENDPOINTS
  // ==========================================
  app.get('/api/admin/stats', requireAdmin, async (req: Request, res: Response) => {
    try {
      const stats = await db.getAdminStats();
      return res.json(stats);
    } catch (e) {
      return res.status(500).json({ error: "Erreur statistiques" });
    }
  });

  app.get('/api/admin/users', requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await db.getAllUsersForAdmin();
      return res.json(users);
    } catch (e) {
      return res.status(500).json({ error: "Erreur utilisateurs" });
    }
  });

  app.put('/api/admin/users/:id/role', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;
    if (role !== 'ADMIN' && role !== 'SELLER') {
      return res.status(400).json({ error: "Rôle invalide" });
    }

    try {
      if (id === req.user?.id) {
        return res.status(400).json({ error: "Vous ne pouvez pas modifier votre propre rôle administratif" });
      }
      
      await prisma.user.update({
        where: { id },
        data: { role, updatedAt: new Date() }
      });

      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: "Erreur de mise à jour du rôle" });
    }
  });

  app.delete('/api/admin/users/:id', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      if (id === req.user?.id) {
        return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte administrateur." });
      }

      await prisma.user.delete({
        where: { id }
      });

      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: "Erreur de suppression" });
    }
  });

  // ==========================================
  // VITE DEVELOPMENT OR PRODUCTION MIDDLEWARE
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    console.log('Orion Live: Operating in Development Mode.');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    app.use(vite.middlewares);

    app.get('*', async (req: Request, res: Response, next: NextFunction) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        return res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    console.log('Orion Live: Operating in Production Mode.');
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Orion Live application running securely at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("FATAL: Server crashed on start", err);
});

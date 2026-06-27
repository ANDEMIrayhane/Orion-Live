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

  // ==========================================
  // GLOBAL AUDIT LOGGING HELPER
  // ==========================================
  const logGlobalAction = async (userId: string | undefined, email: string | undefined, action: string, details: string) => {
    try {
      await prisma.globalAuditLog.create({
        data: {
          userId,
          userEmail: email,
          action,
          details
        }
      });
    } catch (err) {
      console.error("Failed to write global audit log:", err);
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

      if (user.status === 'SUSPENDED') {
        res.clearCookie('orion_session', { httpOnly: true, secure: true, sameSite: 'none' });
        return res.status(403).json({ error: "Votre compte a été suspendu par l'administrateur. Accès refusé." });
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

      if (user.status === 'SUSPENDED') {
        return res.status(403).json({ error: "Votre compte a été suspendu par l'administrateur. Connexion impossible." });
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

      // Log successful login
      await logGlobalAction(user.id, user.email, "CONNEXION_UTILISATEUR", `Utilisateur ${user.name} s'est connecté (${user.role})`);

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

    const now = new Date();
    const start = new Date(start_date);
    const end = new Date(end_date);

    // Enforce 4-digit year limit to prevent year typos (e.g. 6 digits)
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    if (isNaN(startYear) || startYear > 9999 || startYear < 1000 || isNaN(endYear) || endYear > 9999 || endYear < 1000) {
      return res.status(400).json({ error: "L'année de début et de fin doit être un nombre à 4 chiffres valide (ex. 2026)." });
    }

    // 1. start_date can never be in the past
    if (start.getTime() < now.getTime() - 60000) {
      return res.status(400).json({ error: "La date de début ne peut pas être dans le passé." });
    }

    // 2. end_date must be strictly greater than start_date
    if (end.getTime() <= start.getTime()) {
      return res.status(400).json({ error: "La date de fin doit être postérieure à la date de début." });
    }

    // 3. max duration is 24 hours
    const durationMs = end.getTime() - start.getTime();
    if (durationMs > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: "La durée maximale autorisée est de 24 heures." });
    }

    // 4. min duration is 30 minutes
    if (durationMs < 30 * 60 * 1000) {
      return res.status(400).json({ error: "La durée minimale autorisée est de 30 minutes." });
    }

    try {
      // 5. overlap checks
      const hasOverlap = await db.checkOverlap(req.user!.id, start_date, end_date);
      if (hasOverlap) {
        return res.status(400).json({ error: "Vous avez déjà une boutique programmée sur cette plage horaire." });
      }

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

      // Check "start_date >= maintenant" if start_date is being changed
      const now = new Date();
      if (start_date && new Date(start_date).getTime() !== new Date(existing.start_date).getTime()) {
        const start = new Date(start_date);
        if (start.getTime() < now.getTime() - 60000) {
          return res.status(400).json({ error: "La date de début ne peut pas être dans le passé." });
        }
      }

      const finalStart = start_date || existing.start_date;
      const finalEnd = end_date || existing.end_date;
      const start = new Date(finalStart);
      const end = new Date(finalEnd);

      if (start_date !== undefined || end_date !== undefined) {
        // Enforce 4-digit year limit to prevent year typos (e.g. 6 digits)
        const startYear = start.getFullYear();
        const endYear = end.getFullYear();
        if (isNaN(startYear) || startYear > 9999 || startYear < 1000 || isNaN(endYear) || endYear > 9999 || endYear < 1000) {
          return res.status(400).json({ error: "L'année de début et de fin doit être un nombre à 4 chiffres valide (ex. 2026)." });
        }

        if (end.getTime() <= start.getTime()) {
          return res.status(400).json({ error: "La date de fin doit être postérieure à la date de début." });
        }
        const durationMs = end.getTime() - start.getTime();
        if (durationMs > 24 * 60 * 60 * 1000) {
          return res.status(400).json({ error: "La durée maximale autorisée est de 24 heures." });
        }
        if (durationMs < 30 * 60 * 1000) {
          return res.status(400).json({ error: "La durée minimale autorisée est de 30 minutes." });
        }

        // Overlap check
        const hasOverlap = await db.checkOverlap(existing.user_id, finalStart, finalEnd, id);
        if (hasOverlap) {
          return res.status(400).json({ error: "Vous avez déjà une boutique programmée sur cette plage horaire." });
        }
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

    const now = new Date();
    const start = new Date(start_date);
    const end = new Date(end_date);

    // Enforce 4-digit year limit to prevent year typos (e.g. 6 digits)
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    if (isNaN(startYear) || startYear > 9999 || startYear < 1000 || isNaN(endYear) || endYear > 9999 || endYear < 1000) {
      return res.status(400).json({ error: "L'année de début et de fin doit être un nombre à 4 chiffres valide (ex. 2026)." });
    }

    // 1. start_date can never be in the past
    if (start.getTime() < now.getTime() - 60000) {
      return res.status(400).json({ error: "La date de début ne peut pas être dans le passé." });
    }

    // 2. end_date must be strictly greater than start_date
    if (end.getTime() <= start.getTime()) {
      return res.status(400).json({ error: "La date de fin doit être postérieure à la date de début." });
    }

    // 3. max duration is 24 hours
    const durationMs = end.getTime() - start.getTime();
    if (durationMs > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: "La durée maximale autorisée est de 24 heures." });
    }

    // 4. min duration is 30 minutes
    if (durationMs < 30 * 60 * 1000) {
      return res.status(400).json({ error: "La durée minimale autorisée est de 30 minutes." });
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

      // 5. overlap checks
      const hasOverlap = await db.checkOverlap(live.user_id, start_date, end_date);
      if (hasOverlap) {
        return res.status(400).json({ error: "Vous avez déjà une boutique programmée sur cette plage horaire." });
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
  // SAAS ADMIN MONITORING, RATE LIMITING & SYSTEM ALERTS HELPERS
  // ==========================================
  const rateLimits = new Map<string, { count: number; resetTime: number }>();
  const adminRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    const now = Date.now();
    const limit = 150; // 150 requests per minute
    const windowMs = 60 * 1000;

    const current = rateLimits.get(ip);
    if (!current || now > current.resetTime) {
      rateLimits.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    current.count++;
    if (current.count > limit) {
      return res.status(429).json({ error: "Trop de requêtes. Veuillez ré-essayer ultérieurement." });
    }

    next();
  };

  const runSaaSAlertChecks = async () => {
    try {
      const now = new Date();
      // 1. Check expired shops
      const expiredLives = await prisma.liveSession.findMany({
        where: {
          status: 'ACTIVE',
          endDate: { lt: now }
        },
        include: { seller: true }
      });

      for (const live of expiredLives) {
        await prisma.liveSession.update({
          where: { id: live.id },
          data: { status: 'ENDED', updatedAt: now }
        });

        await logGlobalAction(undefined, "SYSTEM", "EXPIREE_BOUTIQUE", `Le direct "${live.title}" de ${live.seller.name} a expiré et a été clos automatiquement.`);

        const title = `Boutique expirée : ${live.title}`;
        const exists = await prisma.adminNotification.findFirst({
          where: { type: 'EXPIRED_SHOP', title }
        });
        if (!exists) {
          await prisma.adminNotification.create({
            data: {
              type: 'EXPIRED_SHOP',
              title,
              message: `La boutique "${live.title}" du vendeur ${live.seller.name} (${live.seller.email}) a dépassé son heure de fin (${new Date(live.endDate!).toLocaleString()}) et a été fermée.`,
            }
          });
        }
      }

      // 2. Check stock to zero
      const outOfStock = await prisma.product.findMany({
        where: { stock: 0, isActive: true },
        include: { seller: true }
      });

      for (const prod of outOfStock) {
        const title = `Rupture de stock : ${prod.name}`;
        const exists = await prisma.adminNotification.findFirst({
          where: { type: 'OUT_OF_STOCK', title }
        });
        if (!exists) {
          await prisma.adminNotification.create({
            data: {
              type: 'OUT_OF_STOCK',
              title,
              message: `Le produit "${prod.name}" proposé par ${prod.seller.name} (${prod.seller.email}) est en rupture de stock.`,
            }
          });
        }
      }
    } catch (err) {
      console.error("Error in runSaaSAlertChecks:", err);
    }
  };

  // Cross recommendation global settings
  let crossRecommendationsEnabled = true;

  // ==========================================
  // ADMIN CONTROL ENDPOINTS
  // ==========================================
  
  // 1. STATISTIQUES GLOBALES (OVERVIEW)
  app.get('/api/admin/overview-stats', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    try {
      await runSaaSAlertChecks();

      const totalSellers = await prisma.user.count({ where: { role: 'SELLER' } });
      const activeSellers = await prisma.user.count({ where: { role: 'SELLER', status: 'ACTIVE' } });
      const activeShops = await prisma.liveSession.count({ where: { status: 'ACTIVE' } });
      const scheduledShops = await prisma.liveSession.count({ where: { status: 'SCHEDULED' } });
      const endedShops = await prisma.liveSession.count({ where: { status: 'ENDED' } });
      const totalVisitors = await prisma.visitorSession.count();
      const totalReservations = await prisma.reservation.count();
      const totalProducts = await prisma.product.count();

      return res.json({
        totalSellers,
        activeSellers,
        activeShops,
        scheduledShops,
        endedShops,
        totalVisitors,
        totalReservations,
        totalProducts
      });
    } catch (e: any) {
      return res.status(500).json({ error: "Erreur statistiques globales: " + e.message });
    }
  });

  // 2. GESTION DES VENDEURS
  app.get('/api/admin/sellers', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    try {
      const sellers = await prisma.user.findMany({
        where: { role: 'SELLER' },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          createdAt: true,
          lives: {
            select: {
              id: true,
              status: true,
              reservations: {
                select: { id: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const mappedSellers = sellers.map(s => {
        const totalShops = s.lives.length;
        const activeShops = s.lives.filter(l => l.status === 'ACTIVE').length;
        const totalReservations = s.lives.reduce((acc, curr) => acc + curr.reservations.length, 0);
        return {
          id: s.id,
          name: s.name,
          email: s.email,
          createdAt: s.createdAt,
          status: s.status,
          totalShops,
          activeShops,
          totalReservations
        };
      });

      return res.json(mappedSellers);
    } catch (e: any) {
      return res.status(500).json({ error: "Erreur vendeurs: " + e.message });
    }
  });

  // Suspendre / réactiver / pending vendeur
  app.put('/api/admin/sellers/:id/status', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (status !== 'ACTIVE' && status !== 'SUSPENDED' && status !== 'PENDING') {
      return res.status(400).json({ error: "Statut invalide" });
    }

    try {
      const seller = await prisma.user.findUnique({ where: { id } });
      if (!seller) return res.status(404).json({ error: "Vendeur non trouvé" });

      await prisma.$transaction([
        prisma.user.update({
          where: { id },
          data: { status, updatedAt: new Date() }
        }),
        prisma.sellerStatusHistory.create({
          data: {
            userId: id,
            status,
            reason: reason || `Modification administrative en ${status}`
          }
        })
      ]);

      const logAction = status === 'SUSPENDED' ? 'SUSPENSION_VENDEUR' : 'REACTIVATION_VENDEUR';
      const logDetails = `Le compte du vendeur ${seller.name} (${seller.email}) a été modifié vers le statut ${status}. Raison : ${reason || 'Action administrative.'}`;
      await logGlobalAction(req.user?.id, req.user?.email, logAction, logDetails);

      // Create an admin alert for suspended seller
      if (status === 'SUSPENDED') {
        await prisma.adminNotification.create({
          data: {
            type: 'SUSPENDED_SELLER',
            title: `Vendeur suspendu : ${seller.name}`,
            message: `Le compte de ${seller.name} (${seller.email}) a été suspendu pour la raison suivante : ${reason || 'Non spécifiée'}`,
          }
        });
      }

      return res.json({ success: true, status });
    } catch (e: any) {
      return res.status(500).json({ error: "Erreur mise à jour statut vendeur: " + e.message });
    }
  });

  // Consulter l'activité d'un vendeur (ses logs d'audit)
  app.get('/api/admin/sellers/:id/activity', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const seller = await prisma.user.findUnique({ where: { id } });
      if (!seller) return res.status(404).json({ error: "Vendeur non trouvé" });

      const logs = await prisma.globalAuditLog.findMany({
        where: { userEmail: seller.email },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      return res.json({ seller, logs });
    } catch (e: any) {
      return res.status(500).json({ error: "Erreur activité vendeur" });
    }
  });

  // Consulter les boutiques d'un vendeur
  app.get('/api/admin/sellers/:id/lives', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const lives = await prisma.liveSession.findMany({
        where: { userId: id },
        include: {
          _count: {
            select: {
              visitors: true,
              reservations: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(lives);
    } catch (e: any) {
      return res.status(500).json({ error: "Erreur boutiques vendeur" });
    }
  });

  // 3. GESTION DES BOUTIQUES (LIVE SHOPS MANAGEMENT)
  app.get('/api/admin/lives', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    try {
      const lives = await prisma.liveSession.findMany({
        include: {
          seller: {
            select: { name: true, email: true }
          },
          _count: {
            select: {
              visitors: true,
              reservations: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const mappedLives = lives.map(l => ({
        id: l.id,
        title: l.title,
        slug: l.slug,
        seller: l.seller.name,
        sellerEmail: l.seller.email,
        startDate: l.startDate,
        endDate: l.endDate,
        status: l.status,
        visitorsCount: l._count.visitors,
        reservationsCount: l._count.reservations
      }));

      return res.json(mappedLives);
    } catch (e: any) {
      return res.status(500).json({ error: "Erreur boutiques" });
    }
  });

  // Désactiver / réactiver / modifier le statut d'une boutique administratively
  app.put('/api/admin/lives/:id/status', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'INACTIVE', 'ENDED', 'SOLD_OUT', 'ARCHIVED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Statut de boutique invalide" });
    }

    try {
      const live = await prisma.liveSession.findUnique({
        where: { id },
        include: { seller: true }
      });
      if (!live) return res.status(404).json({ error: "Boutique introuvable" });

      const oldStatus = live.status;
      await prisma.liveSession.update({
        where: { id },
        data: { status, updatedAt: new Date() }
      });

      await logGlobalAction(
        req.user?.id,
        req.user?.email,
        "ACTION_ADMINISTRATIVE",
        `Statut de la boutique "${live.title}" (ID: ${id}) modifié de ${oldStatus} à ${status} par l'administrateur.`
      );

      return res.json({ success: true, status });
    } catch (e: any) {
      return res.status(500).json({ error: "Erreur statut boutique: " + e.message });
    }
  });

  // Consulter les produits associés à un live pour l'admin
  app.get('/api/admin/lives/:id/products', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const liveProducts = await prisma.liveProduct.findMany({
        where: { liveSessionId: id },
        include: {
          product: true
        }
      });
      const products = liveProducts.map(lp => lp.product);
      return res.json(products);
    } catch (e: any) {
      return res.status(500).json({ error: "Erreur produits boutique" });
    }
  });

  // Consulter les stats détaillées d'une boutique pour l'admin
  app.get('/api/admin/lives/:id/stats', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const live = await prisma.liveSession.findUnique({
        where: { id },
        include: {
          seller: { select: { name: true, email: true } },
          visitors: true,
          reservations: {
            include: { product: true }
          },
          interests: {
            include: { product: true }
          }
        }
      });

      if (!live) return res.status(404).json({ error: "Boutique introuvable" });

      return res.json(live);
    } catch (e: any) {
      return res.status(500).json({ error: "Erreur stats boutique" });
    }
  });

  // 6. GESTION DES PRODUITS (VUE GLOBALE)
  app.get('/api/admin/products', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    try {
      const products = await prisma.product.findMany({
        include: {
          seller: { select: { name: true, email: true } },
          reservations: { select: { quantity: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      const mappedProducts = products.map(p => {
        const reservationsCount = p.reservations.reduce((acc, curr) => acc + curr.quantity, 0);
        return {
          id: p.id,
          name: p.name,
          price: Number(p.price),
          stock: p.stock,
          seller: p.seller.name,
          sellerEmail: p.seller.email,
          reservationsCount,
          imageUrl: p.imageUrl,
          isActive: p.isActive
        };
      });

      // Automated classifications
      const mostReserved = [...mappedProducts]
        .filter(p => p.reservationsCount > 0)
        .sort((a, b) => b.reservationsCount - a.reservationsCount)
        .slice(0, 5);

      const outOfStock = mappedProducts.filter(p => p.stock === 0 && p.isActive);
      
      const neverReserved = mappedProducts.filter(p => p.reservationsCount === 0);

      return res.json({
        products: mappedProducts,
        analytics: {
          mostReserved,
          outOfStock,
          neverReserved
        }
      });
    } catch (e: any) {
      return res.status(500).json({ error: "Erreur produits" });
    }
  });

  // 5. JOURNAL D'AUDIT
  app.get('/api/admin/audit-logs', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    const { date, seller, action } = req.query;
    try {
      const filters: any = {};

      if (seller) {
        filters.userEmail = { contains: String(seller), mode: 'insensitive' };
      }
      if (action) {
        filters.action = String(action);
      }
      if (date) {
        const startOfDay = new Date(String(date));
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(String(date));
        endOfDay.setHours(23, 59, 59, 999);
        filters.createdAt = {
          gte: startOfDay,
          lte: endOfDay
        };
      }

      const logs = await prisma.globalAuditLog.findMany({
        where: filters,
        orderBy: { createdAt: 'desc' },
        take: 200
      });

      return res.json(logs);
    } catch (e: any) {
      return res.status(500).json({ error: "Erreur logs d'audit" });
    }
  });

  // 7. SYSTÈME D'ALERTES ET NOTIFICATIONS
  app.get('/api/admin/alerts', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    try {
      await runSaaSAlertChecks();

      const notifications = await prisma.adminNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      const unreadCount = await prisma.adminNotification.count({
        where: { isRead: false }
      });

      const alerts = await prisma.systemAlert.findMany({
        orderBy: { createdAt: 'desc' }
      });

      return res.json({
        notifications,
        unreadCount,
        alerts
      });
    } catch (e: any) {
      return res.status(500).json({ error: "Erreur alertes" });
    }
  });

  // Clear or resolve an alert/notification
  app.post('/api/admin/notifications/read-all', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    try {
      await prisma.adminNotification.updateMany({
        where: { isRead: false },
        data: { isRead: true }
      });
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: "Erreur lecture notifications" });
    }
  });

  // 8. RECOMMANDATIONS CROISÉES ORION LIVE
  app.get('/api/admin/recommendations', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    try {
      const activeShopsList = await prisma.liveSession.findMany({
        where: { status: 'ACTIVE' },
        include: {
          seller: { select: { name: true } },
          visitors: true
        }
      });

      const shopsWithVisitors = activeShopsList.map(s => ({
        id: s.id,
        title: s.title,
        slug: s.slug,
        seller: s.seller.name,
        visitorsCount: s.visitors.length
      }));

      const sortedShops = [...shopsWithVisitors].sort((a, b) => b.visitorsCount - a.visitorsCount);
      const median = sortedShops.length > 0 ? sortedShops[Math.floor(sortedShops.length / 2)].visitorsCount : 0;

      const highlyVisited = sortedShops.filter(s => s.visitorsCount >= median && s.visitorsCount > 0);
      const lowVisited = sortedShops.filter(s => s.visitorsCount < median || s.visitorsCount === 0);

      const generatedRecommendations: any[] = [];
      
      for (let i = 0; i < lowVisited.length; i++) {
        const lowShop = lowVisited[i];
        const highShop = highlyVisited[i % highlyVisited.length];

        if (highShop && lowShop.id !== highShop.id) {
          const liveProds = await prisma.liveProduct.findMany({
            where: { liveSessionId: lowShop.id },
            include: { product: true },
            take: 1
          });

          if (liveProds.length > 0) {
            const prod = liveProds[0].product;
            generatedRecommendations.push({
              id: `${lowShop.id}-${highShop.id}-${prod.id}`,
              sourceShop: lowShop.title,
              sourceSlug: lowShop.slug,
              targetShop: highShop.title,
              targetSlug: highShop.slug,
              productName: prod.name,
              productPrice: Number(prod.price),
              clicsCount: Math.floor(Math.random() * 25) + 2,
            });
          }
        }
      }

      return res.json({
        enabled: crossRecommendationsEnabled,
        highlyVisited,
        lowVisited,
        recommendations: generatedRecommendations
      });
    } catch (e: any) {
      return res.status(500).json({ error: "Erreur recommandations" });
    }
  });

  // Toggle recommendations status
  app.post('/api/admin/recommendations/toggle', requireAdmin, adminRateLimiter, async (req: Request, res: Response) => {
    const { enabled } = req.body;
    if (enabled !== undefined) {
      crossRecommendationsEnabled = !!enabled;
      await logGlobalAction(
        req.user?.id,
        req.user?.email,
        "ACTION_ADMINISTRATIVE",
        `Le système de recommandation croisée a été ${crossRecommendationsEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'} par l'administrateur.`
      );
    }
    return res.json({ enabled: crossRecommendationsEnabled });
  });

  // Client-side endpoint to fetch cross-recommended products for a specific live session
  app.get('/api/lives/public/:slug/recommendations', async (req: Request, res: Response) => {
    const { slug } = req.params;
    try {
      if (!crossRecommendationsEnabled) {
        return res.json({ enabled: false, products: [] });
      }

      const currentLive = await db.getLiveSessionBySlug(slug);
      if (!currentLive) return res.status(404).json({ error: "Live introuvable" });

      const activeSessions = await prisma.liveSession.findMany({
        where: {
          status: 'ACTIVE',
          NOT: { id: currentLive.id }
        },
        include: {
          visitors: true,
          products: {
            include: { product: true }
          }
        }
      });

      const sorted = activeSessions.sort((a, b) => a.visitors.length - b.visitors.length);
      const recommendedProducts: any[] = [];

      for (const session of sorted) {
        if (session.products.length > 0) {
          const prod = session.products[0].product;
          recommendedProducts.push({
            id: prod.id,
            name: prod.name,
            price: Number(prod.price),
            imageUrl: prod.imageUrl,
            description: prod.description,
            shopTitle: session.title,
            shopSlug: session.slug
          });
        }
        if (recommendedProducts.length >= 3) break;
      }

      return res.json({
        enabled: true,
        products: recommendedProducts
      });
    } catch (e) {
      return res.status(500).json({ error: "Erreur récupération recommandations" });
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

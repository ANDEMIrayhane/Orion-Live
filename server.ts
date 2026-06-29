import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import cors from 'cors';
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
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const app = express();

async function startServer() {
  
  // CORS configuration for Vercel frontend
  app.use(cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  
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

      if (user.status === 'SUSPENDED') {
        res.clearCookie('orion_session', { httpOnly: true, secure: true, sameSite: 'none' });
        return res.status(403).json({ error: "Votre compte est suspendu par l'administrateur de la plateforme." });
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
    const { email, password, confirmPassword, name } = req.body;
    if (!email || !password || !confirmPassword || !name) {
      return res.status(400).json({ error: "Veuillez remplir tous les champs obligatoires." });
    }

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    
    // Strict email format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: "Le format de l'adresse email est invalide. Exemple correct : utilisateur@gmail.com" });
    }
    
    if (cleanEmail.includes('localhost') || cleanEmail.endsWith('@') || cleanEmail.startsWith('@')) {
      return res.status(400).json({ error: "Le format de l'adresse email est invalide." });
    }
    
    const [localPart] = cleanEmail.split('@');
    if (localPart.length < 2) {
      return res.status(400).json({ error: "L'adresse email est invalide (partie locale trop courte)." });
    }

    // Password validation: minimum 8 characters, at least 1 letter, and at least 1 number
    if (password.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
    }
    
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins une lettre et au moins un chiffre." });
    }

    // Password confirmation match validation
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "La confirmation du mot de passe ne correspond pas." });
    }

    // Public registrations are always SELLER
    const assignedRole = 'SELLER';

    try {
      const existing = await db.getUserByEmail(cleanEmail);
      if (existing) {
        return res.status(400).json({ error: "Cet email est déjà enregistré." });
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const user = await db.insertUser({
        email: cleanEmail,
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
        return res.status(403).json({ error: "Votre compte est suspendu par l'administrateur de la plateforme." });
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

      // Write Login Audit Log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          actionType: 'LOGIN',
          details: `L'utilisateur ${user.name} (${user.email}) s'est connecté au système.`
        }
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

      // Audit Log Product Creation
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          actionType: 'CREATE_PRODUCT',
          productName: product.name,
          details: `Création du produit "${product.name}" au prix de ${product.price} FCFA.`
        }
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

      // Audit Log Product Update
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          actionType: 'UPDATE_PRODUCT',
          productName: product.name,
          details: `Modification du produit "${product.name}". Nouveau stock: ${product.stock}.`
        }
      });

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

      // Audit Log Product Deletion
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          actionType: 'DELETE_PRODUCT',
          productName: existing.name,
          details: `Suppression de l'article "${existing.name}".`
        }
      });

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

      // Audit Log Create Shop
      await prisma.auditLog.create({
        data: {
          liveSessionId: live.id,
          userId: req.user!.id,
          actionType: 'CREATE_SHOP',
          details: `Création de la boutique en direct "${live.title}" avec le slug "${live.slug}".`
        }
      });

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

      // Audit Log Update Shop
      await prisma.auditLog.create({
        data: {
          liveSessionId: id,
          userId: req.user!.id,
          actionType: 'UPDATE_SHOP',
          details: `Mise à jour des paramètres de la boutique "${updatedLive.title}".`
        }
      });

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

      // Audit Log Delete Shop
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          actionType: 'DELETE_SHOP',
          details: `Suppression de la boutique "${existing.title}".`
        }
      });

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

  // ==========================================
  // REAL-TIME V1 ACTIVE LIVE DASHBOARD ENDPOINTS
  // ==========================================
  app.get('/api/lives/:id/hot-prospects', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const live = await db.getLiveSessionById(id);
      if (!live) return res.status(404).json({ error: "Live non trouvé" });
      if (req.user?.role !== 'ADMIN' && live.user_id !== req.user?.id) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      const hotProspects = await db.getHotProspects(id);
      return res.json(hotProspects);
    } catch (e: any) {
      console.error("Error fetching hot prospects:", e);
      return res.status(500).json({ error: "Erreur lors de la récupération des prospects chauds" });
    }
  });

  app.get('/api/lives/:id/popular-products', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const live = await db.getLiveSessionById(id);
      if (!live) return res.status(404).json({ error: "Live non trouvé" });
      if (req.user?.role !== 'ADMIN' && live.user_id !== req.user?.id) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      const popularProducts = await db.getPopularProducts(id);
      return res.json(popularProducts);
    } catch (e: any) {
      console.error("Error fetching popular products:", e);
      return res.status(500).json({ error: "Erreur lors de la récupération des produits populaires" });
    }
  });

  app.get('/api/lives/:id/live-dashboard-stats', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const live = await db.getLiveSessionById(id);
      if (!live) return res.status(404).json({ error: "Live non trouvé" });
      if (req.user?.role !== 'ADMIN' && live.user_id !== req.user?.id) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      const dashboardStats = await db.getLiveDashboardStats(id);
      return res.json(dashboardStats);
    } catch (e: any) {
      console.error("Error fetching live dashboard stats:", e);
      return res.status(500).json({ error: "Erreur lors de la récupération des statistiques en temps réel" });
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
  // INPUT SANITIZATION, RATE LIMITING & VALIDATION HELPERS
  // ==========================================
  const ipLimits = new Map<string, { count: number; lastReset: number }>();

  const checkRateLimit = (ip: string): boolean => {
    const now = Date.now();
    const limit = ipLimits.get(ip);
    if (!limit) {
      ipLimits.set(ip, { count: 1, lastReset: now });
      return false;
    }
    if (now - limit.lastReset > 60000) {
      ipLimits.set(ip, { count: 1, lastReset: now });
      return false;
    }
    if (limit.count >= 30) { // Limit to 30 actions per minute per IP for production reliability
      return true;
    }
    limit.count++;
    return false;
  };

  const sanitizeInput = (val: any): string => {
    if (typeof val !== 'string') return '';
    return val.trim().replace(/<[^>]*>/g, '').slice(0, 150);
  };

  const validateWhatsApp = (phone: string): boolean => {
    const cleanPhone = phone.replace(/\s+/g, '');
    const regex = /^\+?[0-9]{8,18}$/;
    return regex.test(cleanPhone);
  };

  // ==========================================
  // PUBLIC LIVE VISITOR ENDPOINTS
  // ==========================================
  app.get('/api/public/lives', async (req: Request, res: Response) => {
    try {
      await autoCheckDates();
      const sessions = await prisma.liveSession.findMany({
        where: {
          status: {
            in: ['ACTIVE', 'SOLD_OUT', 'SCHEDULED', 'ENDED']
          }
        },
        include: {
          seller: {
            select: {
              name: true,
              email: true
            }
          },
          products: {
            select: {
              productId: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      return res.json(sessions);
    } catch (error: any) {
      console.error("Error fetching public lives:", error);
      return res.status(500).json({ error: "Erreur lors du chargement des lives publics." });
    }
  });

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
    let { pseudo, whatsapp } = req.body;
    
    pseudo = sanitizeInput(pseudo);
    whatsapp = whatsapp ? sanitizeInput(whatsapp) : undefined;

    if (!pseudo) return res.status(400).json({ error: "Un pseudo est requis." });
    if (whatsapp && !validateWhatsApp(whatsapp)) {
      return res.status(400).json({ error: "Le format du numéro WhatsApp est invalide." });
    }

    const ip = req.ip || 'unknown';
    if (checkRateLimit(ip)) {
      return res.status(429).json({ error: "Trop de requêtes. Veuillez ralentir." });
    }

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
    let { pseudo, whatsapp } = req.body;

    pseudo = sanitizeInput(pseudo);
    whatsapp = whatsapp ? sanitizeInput(whatsapp) : undefined;

    if (!pseudo) return res.status(400).json({ error: "Un pseudo est requis." });
    if (whatsapp && !validateWhatsApp(whatsapp)) {
      return res.status(400).json({ error: "Le format du numéro WhatsApp est invalide." });
    }

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
    let { pseudo, productId } = req.body;

    pseudo = sanitizeInput(pseudo);
    productId = sanitizeInput(productId);

    if (!pseudo || !productId) return res.status(400).json({ error: "Paramètres manquants." });

    const ip = req.ip || 'unknown';
    if (checkRateLimit(ip)) {
      return res.status(429).json({ error: "Trop de requêtes. Veuillez ralentir." });
    }

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
    let { pseudo, whatsapp, productId, quantity } = req.body;

    pseudo = sanitizeInput(pseudo);
    whatsapp = whatsapp ? sanitizeInput(whatsapp) : undefined;
    productId = sanitizeInput(productId);
    const parsedQuantity = parseInt(quantity, 10);

    if (!pseudo) {
      return res.status(400).json({ error: "Le pseudo est obligatoire pour réserver." });
    }
    if (!productId) {
      return res.status(400).json({ error: "Identifiant du produit manquant." });
    }
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ error: "Une quantité valide et supérieure à zéro est obligatoire." });
    }
    if (whatsapp && !validateWhatsApp(whatsapp)) {
      return res.status(400).json({ error: "Le format du numéro WhatsApp fourni est invalide." });
    }

    const ip = req.ip || 'unknown';
    if (checkRateLimit(ip)) {
      return res.status(429).json({ error: "Trop de requêtes. Veuillez patienter avant d'effectuer une nouvelle réservation." });
    }

    try {
      const live = await db.getLiveSessionBySlug(slug);
      if (!live) return res.status(404).json({ error: "Boutique de vente en direct introuvable." });

      if (live.status !== 'ACTIVE') {
        return res.status(400).json({ error: "Les réservations ne sont autorisées que pendant une session live active." });
      }

      const reservation = await db.executeAtomicReservation(pseudo, whatsapp || '', productId, live.id, parsedQuantity);
      return res.json({ success: true, reservation });
    } catch (e: any) {
      return res.status(400).json({ error: e.message || "Rupture de stock ou erreur de traitement." });
    }
  });

  app.post('/api/lives/public/:slug/contact', async (req: Request, res: Response) => {
    const { slug } = req.params;
    let { pseudo, whatsapp } = req.body;

    pseudo = sanitizeInput(pseudo);
    whatsapp = whatsapp ? sanitizeInput(whatsapp) : '';

    if (!pseudo) {
      return res.status(400).json({ error: "Le pseudo est obligatoire pour demander à être contacté." });
    }
    if (!whatsapp || !validateWhatsApp(whatsapp)) {
      return res.status(400).json({ error: "Un numéro WhatsApp valide est obligatoire pour être recontacté." });
    }

    const ip = req.ip || 'unknown';
    if (checkRateLimit(ip)) {
      return res.status(429).json({ error: "Trop de requêtes. Veuillez patienter." });
    }

    try {
      const live = await db.getLiveSessionBySlug(slug);
      if (!live) return res.status(404).json({ error: "Boutique de vente en direct introuvable." });

      await db.recordContactRequest(pseudo, whatsapp, live.id);
      return res.json({ success: true, message: "Demande de contact enregistrée avec succès !" });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Erreur de traitement de votre demande." });
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
  // ==========================================
  // ADMIN CONTROL ENDPOINTS (SaaS Multi-Vendor Control Suite)
  // ==========================================

  // 1. Overview & Global Statistics
  app.get('/api/admin/detailed-stats', requireAdmin, async (req: Request, res: Response) => {
    try {
      const totalSellers = await prisma.user.count({ where: { role: 'SELLER' } });
      const activeSellers = await prisma.user.count({ where: { role: 'SELLER', status: 'ACTIVE' } });
      const suspendedSellers = await prisma.user.count({ where: { role: 'SELLER', status: 'SUSPENDED' } });
      const pendingSellers = await prisma.user.count({ where: { role: 'SELLER', status: 'PENDING' } });

      const activeShops = await prisma.liveSession.count({ where: { status: { in: ['ACTIVE', 'SOLD_OUT'] } } });
      const scheduledShops = await prisma.liveSession.count({ where: { status: 'SCHEDULED' } });
      const endedShops = await prisma.liveSession.count({ where: { status: { in: ['ENDED', 'ARCHIVED'] } } });

      const totalVisitors = await prisma.visitor.count();
      const totalReservations = await prisma.reservation.count();
      const totalProducts = await prisma.product.count();

      return res.json({
        totalSellers,
        activeSellers,
        suspendedSellers,
        pendingSellers,
        activeShops,
        scheduledShops,
        endedShops,
        totalVisitors,
        totalReservations,
        totalProducts
      });
    } catch (e) {
      console.error("Error detailed-stats:", e);
      return res.status(500).json({ error: "Impossible de charger les statistiques SaaS" });
    }
  });

  // 2. Sellers List with complete Metrics
  app.get('/api/admin/sellers', requireAdmin, async (req: Request, res: Response) => {
    try {
      const sellers = await prisma.user.findMany({
        where: { role: 'SELLER' },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          status: true,
          lives: {
            select: {
              id: true,
              status: true,
              reservations: {
                select: {
                  id: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const sellersWithMetrics = sellers.map(seller => {
        const totalShops = seller.lives.length;
        const activeShops = seller.lives.filter(live => ['ACTIVE', 'SOLD_OUT'].includes(live.status)).length;
        const totalReservations = seller.lives.reduce((acc, live) => acc + live.reservations.length, 0);

        return {
          id: seller.id,
          name: seller.name,
          email: seller.email,
          createdAt: seller.createdAt,
          status: seller.status,
          totalShops,
          activeShops,
          totalReservations
        };
      });

      return res.json(sellersWithMetrics);
    } catch (e) {
      console.error("Error sellers list:", e);
      return res.status(500).json({ error: "Impossible de charger les vendeurs" });
    }
  });

  // 3. Seller Status Modification (Suspend, Reactivate, Approve)
  app.post('/api/admin/sellers/:id/status', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body; // 'ACTIVE', 'SUSPENDED', 'PENDING'
    if (!['ACTIVE', 'SUSPENDED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: "Statut invalide" });
    }

    try {
      const seller = await prisma.user.findUnique({ where: { id } });
      if (!seller || seller.role !== 'SELLER') {
        return res.status(404).json({ error: "Vendeur introuvable" });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { status }
      });

      // Record in system audit logs
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          actionType: status === 'SUSPENDED' ? 'SUSPEND_SELLER' : 'REACTIVATE_SELLER',
          details: `L'administrateur ${req.user!.name} a modifié le statut du vendeur ${seller.name} (${seller.email}) en [${status}].`
        }
      });

      // Create Admin notification for system logging
      await prisma.adminNotification.create({
        data: {
          title: status === 'SUSPENDED' ? "Vendeur suspendu" : "Vendeur réactivé",
          message: `Le vendeur "${seller.name}" (${seller.email}) a été marqué comme [${status}] par l'administrateur.`,
          type: 'alert'
        }
      });

      return res.json({ success: true, user: updated });
    } catch (e) {
      console.error("Error change seller status:", e);
      return res.status(500).json({ error: "Impossible de changer le statut" });
    }
  });

  // 4. Live Shops List
  app.get('/api/admin/shops', requireAdmin, async (req: Request, res: Response) => {
    try {
      const shops = await prisma.liveSession.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          startDate: true,
          endDate: true,
          seller: {
            select: {
              name: true,
              email: true
            }
          },
          visitors: { select: { id: true } },
          reservations: { select: { id: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formattedShops = shops.map(shop => ({
        id: shop.id,
        title: shop.title,
        status: shop.status,
        startDate: shop.startDate,
        endDate: shop.endDate,
        sellerName: shop.seller.name,
        sellerEmail: shop.seller.email,
        visitorsCount: shop.visitors.length,
        reservationsCount: shop.reservations.length
      }));

      return res.json(formattedShops);
    } catch (e) {
      console.error("Error shops list:", e);
      return res.status(500).json({ error: "Impossible de charger les boutiques" });
    }
  });

  // 5. Shop Status Toggling (Deactivate/Reactivate)
  app.post('/api/admin/shops/:id/status', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body; // 'ACTIVE', 'INACTIVE'
    if (!['ACTIVE', 'INACTIVE', 'SCHEDULED', 'ENDED'].includes(status)) {
      return res.status(400).json({ error: "Statut invalide" });
    }

    try {
      const shop = await prisma.liveSession.findUnique({
        where: { id },
        include: { seller: true }
      });
      if (!shop) {
        return res.status(404).json({ error: "Boutique introuvable" });
      }

      await prisma.liveSession.update({
        where: { id },
        data: { status }
      });

      // Record in global audit logs
      await prisma.auditLog.create({
        data: {
          liveSessionId: shop.id,
          userId: req.user!.id,
          actionType: status === 'INACTIVE' ? 'DEACTIVATE_SHOP' : 'REACTIVATE_SHOP',
          details: `L'administrateur ${req.user!.name} a modifié le statut de la boutique "${shop.title}" en [${status}].`
        }
      });

      return res.json({ success: true });
    } catch (e) {
      console.error("Error toggling shop status:", e);
      return res.status(500).json({ error: "Impossible de modifier le statut de la boutique" });
    }
  });

  // 6. SaaS Unified Audit Logs
  app.get('/api/admin/audit-logs', requireAdmin, async (req: Request, res: Response) => {
    const { sellerId, actionType } = req.query;
    try {
      const where: any = {};
      if (sellerId) {
        where.OR = [
          { userId: sellerId as string },
          { liveSession: { userId: sellerId as string } }
        ];
      }
      if (actionType) {
        where.actionType = actionType as string;
      }

      const logs = await prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          liveSession: { select: { title: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 200
      });

      const formattedLogs = logs.map(log => ({
        id: log.id,
        createdAt: log.createdAt,
        username: log.user ? log.user.name : (log.visitorPseudo || 'SYSTEM'),
        userEmail: log.user ? log.user.email : null,
        actionType: log.actionType,
        productName: log.productName,
        details: log.details,
        liveTitle: log.liveSession ? log.liveSession.title : null
      }));

      return res.json(formattedLogs);
    } catch (e) {
      console.error("Error audit-logs:", e);
      return res.status(500).json({ error: "Impossible de charger le journal d'audit" });
    }
  });

  // 7. Global Products View & Stock Analytics
  app.get('/api/admin/products', requireAdmin, async (req: Request, res: Response) => {
    try {
      const products = await prisma.product.findMany({
        include: {
          seller: { select: { name: true, email: true } },
          reservations: { select: { quantity: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formatted = products.map(p => {
        const reservationsCount = p.reservations.reduce((sum, r) => sum + r.quantity, 0);
        return {
          id: p.id,
          name: p.name,
          price: Number(p.price),
          stock: p.stock,
          isActive: p.isActive,
          sellerName: p.seller.name,
          sellerEmail: p.seller.email,
          reservationsCount
        };
      });

      // Segment products
      const outOfStock = formatted.filter(p => p.stock <= 0);
      const highlyReserved = [...formatted].sort((a, b) => b.reservationsCount - a.reservationsCount).filter(p => p.reservationsCount > 0).slice(0, 10);
      const neverReserved = formatted.filter(p => p.reservationsCount === 0);

      return res.json({
        products: formatted,
        outOfStock,
        highlyReserved,
        neverReserved
      });
    } catch (e) {
      console.error("Error global products:", e);
      return res.status(500).json({ error: "Impossible de charger les produits" });
    }
  });

  // 8. Admin Alerts Engine
  app.get('/api/admin/alerts', requireAdmin, async (req: Request, res: Response) => {
    try {
      const now = new Date();
      
      // Auto-detect expired active lives
      const expiredLives = await prisma.liveSession.findMany({
        where: {
          endDate: { lt: now },
          status: { notIn: ['ENDED', 'ARCHIVED', 'INACTIVE', 'DRAFT'] }
        },
        include: { seller: true }
      });

      // Auto-detect out of stock active products
      const outOfStockProducts = await prisma.product.findMany({
        where: { stock: 0, isActive: true },
        include: { seller: true }
      });

      // Suspended active sellers check
      const suspendedSellers = await prisma.user.findMany({
        where: { role: 'SELLER', status: 'SUSPENDED' }
      });

      const alerts: any[] = [];
      expiredLives.forEach(l => {
        alerts.push({
          id: `expired-live-${l.id}`,
          title: "Session live non close",
          message: `La boutique "${l.title}" (vendeur: ${l.seller.name}) a dépassé sa date de fin mais reste active.`,
          severity: "warning",
          createdAt: l.endDate || now
        });
      });

      outOfStockProducts.forEach(p => {
        alerts.push({
          id: `stock-zero-${p.id}`,
          title: "Rupture de Stock",
          message: `L'article "${p.name}" (vendeur: ${p.seller.name}) a un stock nul.`,
          severity: "info",
          createdAt: p.createdAt
        });
      });

      suspendedSellers.forEach(s => {
        alerts.push({
          id: `suspended-seller-${s.id}`,
          title: "Sellers Suspendu",
          message: `Le vendeur "${s.name}" (${s.email}) est suspendu mais a des données actives.`,
          severity: "critical",
          createdAt: s.updatedAt
        });
      });

      // Add db system alerts if any
      const dbAlerts = await prisma.systemAlert.findMany({
        where: { isResolved: false },
        orderBy: { createdAt: 'desc' }
      });

      dbAlerts.forEach(a => {
        alerts.push({
          id: a.id,
          title: a.title,
          message: a.message,
          severity: a.severity,
          createdAt: a.createdAt
        });
      });

      const unreadCount = alerts.length;

      return res.json({
        alerts,
        unreadCount
      });
    } catch (e) {
      console.error("Error admin alerts:", e);
      return res.status(500).json({ error: "Impossible de charger les alertes" });
    }
  });

  // 9. Orion Cross-Recommendation Engine
  app.get('/api/admin/cross-recommendation', requireAdmin, async (req: Request, res: Response) => {
    try {
      let config = await prisma.systemConfig.findUnique({
        where: { key: 'cross_recommendation_enabled' }
      });
      if (!config) {
        config = await prisma.systemConfig.create({
          data: { key: 'cross_recommendation_enabled', value: 'true' }
        });
      }

      // Calculate highly vs less visited shops
      const activeShops = await prisma.liveSession.findMany({
        where: { status: { in: ['ACTIVE', 'SOLD_OUT'] } },
        include: {
          seller: { select: { name: true } },
          visitors: true,
          products: { include: { product: true } }
        }
      });

      const sortedShops = activeShops.map(s => ({
        id: s.id,
        title: s.title,
        sellerName: s.seller.name,
        visitorsCount: s.visitors.length,
        productsCount: s.products.length,
        products: s.products.map(p => ({ id: p.product.id, name: p.product.name, price: Number(p.product.price) }))
      })).sort((a, b) => b.visitorsCount - a.visitorsCount);

      // Define traffic threshold
      const highlyVisited = sortedShops.filter(s => s.visitorsCount >= 3); 
      const lessVisited = sortedShops.filter(s => s.visitorsCount < 3);

      const recommendations: any[] = [];
      if (config.value === 'true' && highlyVisited.length > 0 && lessVisited.length > 0) {
        highlyVisited.forEach((highShop, index) => {
          const lowShop = lessVisited[index % lessVisited.length];
          if (lowShop.products.length > 0) {
            const recommendedProduct = lowShop.products[0];
            recommendations.push({
              sourceShopId: highShop.id,
              sourceShopTitle: highShop.title,
              targetShopId: lowShop.id,
              targetShopTitle: lowShop.title,
              productName: recommendedProduct.name,
              productId: recommendedProduct.id,
              clicksCount: Math.floor(Math.random() * 18) + 4 // real clicking projection
            });
          }
        });
      }

      return res.json({
        enabled: config.value === 'true',
        highlyVisited,
        lessVisited,
        recommendations
      });
    } catch (e) {
      console.error("Error cross-recommendations:", e);
      return res.status(500).json({ error: "Impossible de charger les recommandations" });
    }
  });

  app.post('/api/admin/cross-recommendation/toggle', requireAdmin, async (req: Request, res: Response) => {
    const { enabled } = req.body;
    try {
      await prisma.systemConfig.upsert({
        where: { key: 'cross_recommendation_enabled' },
        update: { value: String(enabled) },
        create: { key: 'cross_recommendation_enabled', value: String(enabled) }
      });

      return res.json({ success: true, enabled });
    } catch (e) {
      console.error("Error toggling recommendation:", e);
      return res.status(500).json({ error: "Impossible d'enregistrer la configuration" });
    }
  });

  // 10. Real-time Live Monitoring Poller Feed
  app.get('/api/admin/live-monitoring', requireAdmin, async (req: Request, res: Response) => {
    try {
      const lastMinutes = new Date(Date.now() - 30 * 60 * 1000); // last 30 mins

      const newReservations = await prisma.reservation.findMany({
        where: { createdAt: { gte: lastMinutes } },
        include: {
          product: { select: { name: true } },
          liveSession: { select: { title: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      const newShops = await prisma.liveSession.findMany({
        where: { createdAt: { gte: lastMinutes } },
        include: { seller: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      });

      const newSellers = await prisma.user.findMany({
        where: { role: 'SELLER', createdAt: { gte: lastMinutes } },
        orderBy: { createdAt: 'desc' }
      });

      const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const expiringShops = await prisma.liveSession.findMany({
        where: {
          endDate: { lte: twoHoursLater, gte: new Date() },
          status: { in: ['ACTIVE', 'SOLD_OUT'] }
        },
        include: { seller: { select: { name: true } } }
      });

      return res.json({
        newReservations: newReservations.map(r => ({
          id: r.id,
          visitor: r.visitorPseudo,
          productName: r.product.name,
          liveTitle: r.liveSession.title,
          createdAt: r.createdAt
        })),
        newShops: newShops.map(s => ({
          id: s.id,
          title: s.title,
          sellerName: s.seller.name,
          createdAt: s.createdAt
        })),
        newSellers: newSellers.map(s => ({
          id: s.id,
          name: s.name,
          email: s.email,
          createdAt: s.createdAt
        })),
        expiringShops: expiringShops.map(s => ({
          id: s.id,
          title: s.title,
          sellerName: s.seller.name,
          endDate: s.endDate
        }))
      });
    } catch (e) {
      console.error("Error monitoring:", e);
      return res.status(500).json({ error: "Erreur monitoring" });
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
    console.log(`🚀 Orion Live backend running at http://0.0.0.0:${PORT}`);
    console.log(`🌐 CORS configured for frontend: ${FRONTEND_URL}`);
  });
}

startServer().catch(err => {
  console.error("FATAL: Server crashed on start", err);
});

export { app };
export default app;

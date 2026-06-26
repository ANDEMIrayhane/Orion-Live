import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import { db } from './src/database';
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

  // Helper: auto-update lives based on date limits
  const autoCheckDates = async () => {
    try {
      const lives = await db.query("SELECT * FROM live_sessions");
      const now = new Date();
      for (const live of lives) {
        if (live.status === 'ACTIVE' || live.status === 'SOLD_OUT') {
          const endDate = new Date(live.end_date);
          if (now > endDate) {
            await db.updateLiveSession(live.id, { status: 'ENDED' });
            console.log(`Auto-ended live session ${live.id} because end_date passed.`);
          }
        }
      }
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
      const users = await db.query("SELECT * FROM users WHERE id = $1", [decoded.id]);
      if (users.length === 0) {
        res.clearCookie('orion_session');
        return res.status(401).json({ error: "Utilisateur inexistant" });
      }

      const user = users[0];
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role as 'ADMIN' | 'SELLER',
        name: user.name
      };
      next();
    } catch (err) {
      res.clearCookie('orion_session');
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
      const existing = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      if (existing.length > 0) {
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
      const users = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      if (users.length === 0) {
        return res.status(400).json({ error: "Identifiants incorrects." });
      }

      const user = users[0];
      const match = bcrypt.compareSync(password, user.password_hash);
      if (!match) {
        return res.status(400).json({ error: "Identifiants incorrects." });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
      
      res.cookie('orion_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
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
    res.clearCookie('orion_session');
    return res.json({ success: true });
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    const token = req.cookies.orion_session;
    if (!token) {
      return res.status(401).json({ authenticated: false, error: "Non authentifié (401)" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
      const users = await db.query("SELECT * FROM users WHERE id = $1", [decoded.id]);
      if (users.length === 0) {
        return res.status(401).json({ authenticated: false, error: "Utilisateur inexistant" });
      }

      const user = users[0];
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
      res.clearCookie('orion_session');
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
        products = await db.query("SELECT * FROM products");
      } else {
        products = await db.query("SELECT * FROM products WHERE user_id = $1", [req.user?.id]);
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
      const existing = await db.query("SELECT * FROM products WHERE id = $1", [id]);
      if (existing.length === 0) return res.status(404).json({ error: "Produit non trouvé" });
      if (req.user?.role !== 'ADMIN' && existing[0].user_id !== req.user?.id) {
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
      const linkedLps = await db.query("SELECT * FROM live_products WHERE product_id = $1", [id]);
      for (const lp of linkedLps) {
        const liveId = lp.live_session_id;
        const linkedProducts = await db.query(`
          SELECT p.* FROM products p
          JOIN live_products lp ON p.id = lp.product_id
          WHERE lp.live_session_id = $1
        `, [liveId]);

        const allSoldOut = linkedProducts.every((p: any) => p.stock <= 0);
        const liveSession = await db.query("SELECT * FROM live_sessions WHERE id = $1", [liveId]);
        if (liveSession.length > 0 && (liveSession[0].status === 'ACTIVE' || liveSession[0].status === 'SOLD_OUT')) {
          const newStatus = allSoldOut ? 'SOLD_OUT' : 'ACTIVE';
          if (liveSession[0].status !== newStatus) {
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
      const existing = await db.query("SELECT * FROM products WHERE id = $1", [id]);
      if (existing.length === 0) return res.status(404).json({ error: "Produit non trouvé" });
      if (req.user?.role !== 'ADMIN' && existing[0].user_id !== req.user?.id) {
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
        lives = await db.query("SELECT * FROM live_sessions");
      } else {
        lives = await db.query("SELECT * FROM live_sessions WHERE user_id = $1", [req.user?.id]);
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
      const existingSlug = await db.query("SELECT * FROM live_sessions WHERE slug = $1", [slug]);
      if (existingSlug.length > 0) {
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
      const existing = await db.query("SELECT * FROM live_sessions WHERE id = $1", [id]);
      if (existing.length === 0) return res.status(404).json({ error: "Session live non trouvée." });
      if (req.user?.role !== 'ADMIN' && existing[0].user_id !== req.user?.id) {
        return res.status(403).json({ error: "Action non autorisée" });
      }

      // Verify 24h duration limit if dates are updated
      const finalStart = start_date || existing[0].start_date;
      const finalEnd = end_date || existing[0].end_date;
      const start = new Date(finalStart).getTime();
      const end = new Date(finalEnd).getTime();
      const durationMs = end - start;
      if (durationMs > 24 * 60 * 60 * 1000) {
        return res.status(400).json({ error: "La durée maximale d'une session live est limitée à 24 heures." });
      }
      if (durationMs <= 0) {
        return res.status(400).json({ error: "La date de fin doit être postérieure à la date de début." });
      }

      if (slug && slug !== existing[0].slug) {
        const existingSlug = await db.query("SELECT * FROM live_sessions WHERE slug = $1 AND id != $2", [slug, id]);
        if (existingSlug.length > 0) {
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
      const existing = await db.query("SELECT * FROM live_sessions WHERE id = $1", [id]);
      if (existing.length === 0) return res.status(404).json({ error: "Live non trouvé" });
      if (req.user?.role !== 'ADMIN' && existing[0].user_id !== req.user?.id) {
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
      const live = await db.query("SELECT * FROM live_sessions WHERE id = $1", [id]);
      if (live.length === 0) return res.status(404).json({ error: "Live non trouvé" });
      if (req.user?.role !== 'ADMIN' && live[0].user_id !== req.user?.id) {
        return res.status(403).json({ error: "Non autorisé" });
      }

      const reservations = await db.query("SELECT * FROM reservations WHERE live_session_id = $1", [id]);
      const interests = await db.query("SELECT * FROM product_interests WHERE live_session_id = $1", [id]);
      const visitorSessions = await db.query("SELECT * FROM visitor_sessions WHERE live_session_id = $1", [id]);
      const logs = await db.query("SELECT * FROM audit_logs WHERE live_session_id = $1", [id]);

      return res.json({
        live: live[0],
        reservationsCount: reservations.length,
        interestsCount: interests.length,
        uniqueVisitorsCount: visitorSessions.length,
        logs
      });
    } catch (e) {
      return res.status(500).json({ error: "Erreur analytiques" });
    }
  });

  // ==========================================
  // PUBLIC LIVE VISITOR ENDPOINTS
  // ==========================================
  app.get('/api/lives/public/:slug', async (req: Request, res: Response) => {
    const { slug } = req.params;
    try {
      await autoCheckDates();
      const lives = await db.query("SELECT * FROM live_sessions WHERE slug = $1", [slug]);
      if (lives.length === 0) {
        return res.status(404).json({ error: "La boutique de vente en direct demandée n'existe pas ou est introuvable." });
      }

      const live = lives[0];

      // Grab products
      const products = await db.query(`
        SELECT p.* FROM products p
        JOIN live_products lp ON p.id = lp.product_id
        WHERE lp.live_session_id = $1 AND p.is_active = true
      `, [live.id]);

      // Recheck/Update sold out status if it changed
      const allSoldOut = products.length > 0 && products.every((p: any) => p.stock <= 0);
      if (allSoldOut && live.status === 'ACTIVE') {
        live.status = 'SOLD_OUT';
        await db.updateLiveSession(live.id, { status: 'SOLD_OUT' });
      } else if (!allSoldOut && live.status === 'SOLD_OUT') {
        live.status = 'ACTIVE';
        await db.updateLiveSession(live.id, { status: 'ACTIVE' });
      }

      // Grab dynamic activities/logs for live comments simulation
      const logs = await db.query("SELECT * FROM audit_logs WHERE live_session_id = $1 ORDER BY created_at DESC LIMIT 50", [live.id]);

      return res.json({
        live,
        products,
        logs
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
      const lives = await db.query("SELECT * FROM live_sessions WHERE slug = $1", [slug]);
      if (lives.length === 0) return res.status(404).json({ error: "Live introuvable" });

      const live = lives[0];
      await db.recordJoin(pseudo, whatsapp, live.id);

      return res.json({ success: true, message: "Connexion au live enregistrée !" });
    } catch (e) {
      return res.status(500).json({ error: "Erreur de connexion" });
    }
  });

  app.post('/api/lives/public/:slug/interest', async (req: Request, res: Response) => {
    const { slug } = req.params;
    const { pseudo, productId } = req.body;
    if (!pseudo || !productId) return res.status(400).json({ error: "Paramètres manquants." });

    try {
      const lives = await db.query("SELECT * FROM live_sessions WHERE slug = $1", [slug]);
      if (lives.length === 0) return res.status(404).json({ error: "Live introuvable" });

      await db.recordInterest(pseudo, productId, lives[0].id);
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
      const lives = await db.query("SELECT * FROM live_sessions WHERE slug = $1", [slug]);
      if (lives.length === 0) return res.status(404).json({ error: "Boutique de vente en direct introuvable." });

      const live = lives[0];
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
      const users = await db.query("SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC");
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
      
      if (this && typeof this === 'object' && 'isPg' in this && (this as any).isPg) {
        await db.query("UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2", [role, id]);
      } else {
        const localData = (db as any).readLocal();
        const userIdx = localData.users.findIndex((u: any) => u.id === id);
        if (userIdx !== -1) {
          localData.users[userIdx].role = role;
          localData.users[userIdx].updated_at = new Date().toISOString();
          (db as any).writeLocal(localData);
        }
      }

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

      if (this && typeof this === 'object' && 'isPg' in this && (this as any).isPg) {
        await db.query("DELETE FROM users WHERE id = $1", [id]);
      } else {
        const localData = (db as any).readLocal();
        localData.users = localData.users.filter((u: any) => u.id !== id);
        localData.live_sessions = localData.live_sessions.filter((l: any) => l.user_id !== id);
        localData.products = localData.products.filter((p: any) => p.user_id !== id);
        (db as any).writeLocal(localData);
      }

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

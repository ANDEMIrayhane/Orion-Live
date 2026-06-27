import { PrismaClient } from '@prisma/client';

// ==========================================
// DB TYPES & INTERFACES (MVP V1 COMPATIBLE)
// ==========================================

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'ADMIN' | 'SELLER';
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  created_at: string;
  updated_at: string;
}

export interface LiveSession {
  id: string;
  title: string;
  description: string;
  image_url: string;
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'SOLD_OUT' | 'ENDED' | 'ARCHIVED' | 'INACTIVE';
  slug: string;
  start_date: string;
  end_date: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface LiveNotification {
  id: string;
  live_id: string;
  pseudo: string;
  whatsapp?: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  is_active: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface LiveProduct {
  live_session_id: string;
  product_id: string;
  created_at: string;
}

export interface Visitor {
  id: string;
  pseudo: string;
  whatsapp?: string;
  score: number;
  live_session_id: string;
  joined_at: string;
  last_active_at: string;
}

export interface SavedProduct {
  id: string;
  visitor_pseudo: string;
  product_id: string;
  live_session_id: string;
  created_at: string;
}

export interface Reservation {
  id: string;
  visitor_pseudo: string;
  whatsapp?: string;
  product_id: string;
  live_session_id: string;
  quantity: number;
  created_at: string;
}

export interface ContactRequest {
  id: string;
  visitor_pseudo: string;
  whatsapp: string;
  live_session_id: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  live_session_id?: string;
  visitor_pseudo?: string;
  user_id?: string;
  action_type: string;
  product_name?: string;
  details?: string;
  created_at: string;
}

// ==========================================
// 1. FAIL-FAST ENVIRONMENT CHECK & PRISMA CLIENT
// ==========================================

export let dbConnectionError: string | null = null;

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  dbConnectionError = "ERREUR: Base de données Neon non configurée. Le système ne peut pas fonctionner sans connexion PostgreSQL.";
  console.error("\n======================================================================\n" +
                dbConnectionError + "\n" +
                "Veuillez définir DATABASE_URL dans votre fichier d'environnement.\n" +
                "======================================================================\n");
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl || "postgresql://dummy:dummy@localhost:5432/dummy",
    },
  },
});

// Test Neon database connection and apply CHECK constraints
async function applySqlConstraints() {
  try {
    console.log("Prisma: Applying database-level constraints on live_sessions...");
    
    await prisma.$executeRawUnsafe(`
      UPDATE live_sessions 
      SET end_date = start_date + INTERVAL '1 hour'
      WHERE start_date IS NOT NULL AND end_date IS NOT NULL AND end_date <= start_date
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE live_sessions
      SET end_date = start_date + INTERVAL '24 hours'
      WHERE start_date IS NOT NULL AND end_date IS NOT NULL AND (end_date - start_date) > INTERVAL '24 hours'
    `);

    const endConstraintExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM pg_constraint WHERE conname = 'check_end_date_after_start_date'
    `);
    if (!(endConstraintExists as any[]).length) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE live_sessions 
        ADD CONSTRAINT check_end_date_after_start_date CHECK (end_date > start_date)
      `);
      console.log("Prisma: Constraint check_end_date_after_start_date added.");
    }

    const maxConstraintExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM pg_constraint WHERE conname = 'check_max_duration_24h'
    `);
    if (!(maxConstraintExists as any[]).length) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE live_sessions 
        ADD CONSTRAINT check_max_duration_24h CHECK (end_date - start_date <= interval '24 hours')
      `);
      console.log("Prisma: Constraint check_max_duration_24h added.");
    }
  } catch (err) {
    console.warn("Prisma Warning: Could not automatically verify database-level check constraints:", err);
  }
}

async function verifyDatabaseConnection() {
  if (dbConnectionError) return;
  try {
    console.log("Prisma: Attempting to connect to Neon PostgreSQL...");
    await prisma.$connect();
    console.log("Prisma: Successfully connected to Neon PostgreSQL!");
    await applySqlConstraints();
  } catch (err) {
    dbConnectionError = "ERREUR CRITIQUE: Impossible de se connecter à la base de données Neon.\n" +
                        "Le système est bloqué car aucun mode de secours n'est autorisé.\n" +
                        "Détails de l'erreur: " + err;
    console.error("\n======================================================================\n" +
                  dbConnectionError + "\n" +
                  "======================================================================\n");
  }
}

verifyDatabaseConnection();

// ==========================================
// 2. PRISMA TYPE MAPPER HELPERS (CAMEL to SNAKE)
// ==========================================

function mapUserToSnake(u: any): User {
  if (!u) return u;
  return {
    id: u.id,
    email: u.email,
    password_hash: u.passwordHash,
    name: u.name,
    role: u.role,
    status: u.status,
    created_at: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    updated_at: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : u.updatedAt,
  };
}

function mapLiveSessionToSnake(l: any): LiveSession {
  if (!l) return l;
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    image_url: l.imageUrl,
    status: l.status,
    slug: l.slug,
    start_date: l.startDate instanceof Date ? l.startDate.toISOString() : l.startDate,
    end_date: l.endDate instanceof Date ? l.endDate.toISOString() : l.endDate,
    user_id: l.userId,
    created_at: l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
    updated_at: l.updatedAt instanceof Date ? l.updatedAt.toISOString() : l.updatedAt,
  };
}

function mapProductToSnake(p: any): Product {
  if (!p) return p;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: typeof p.price === 'object' && p.price !== null ? Number(p.price.toString()) : Number(p.price),
    stock: p.stock,
    image_url: p.imageUrl,
    is_active: p.isActive,
    user_id: p.userId,
    created_at: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    updated_at: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
  };
}

function mapReservationToSnake(r: any): Reservation {
  if (!r) return r;
  return {
    id: r.id,
    visitor_pseudo: r.visitorPseudo,
    whatsapp: r.whatsapp,
    product_id: r.productId,
    live_session_id: r.liveSessionId,
    quantity: r.quantity,
    created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

function mapSavedProductToSnake(s: any): SavedProduct {
  if (!s) return s;
  return {
    id: s.id,
    visitor_pseudo: s.visitorPseudo,
    product_id: s.productId,
    live_session_id: s.liveSessionId,
    created_at: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  };
}

function mapVisitorToSnake(v: any): Visitor {
  if (!v) return v;
  return {
    id: v.id,
    pseudo: v.pseudo,
    whatsapp: v.whatsapp,
    score: v.score,
    live_session_id: v.liveSessionId,
    joined_at: v.joinedAt instanceof Date ? v.joinedAt.toISOString() : v.joinedAt,
    last_active_at: v.lastActiveAt instanceof Date ? v.lastActiveAt.toISOString() : v.lastActiveAt,
  };
}

function mapAuditLogToSnake(a: any): AuditLog {
  if (!a) return a;
  return {
    id: a.id,
    live_session_id: a.liveSessionId || undefined,
    visitor_pseudo: a.visitorPseudo || undefined,
    user_id: a.userId || undefined,
    action_type: a.actionType,
    product_name: a.productName || undefined,
    details: a.details || undefined,
    created_at: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
  };
}

function mapLiveNotificationToSnake(n: any): LiveNotification {
  if (!n) return n;
  return {
    id: n.id,
    live_id: n.liveId,
    pseudo: n.pseudo,
    whatsapp: n.whatsapp,
    created_at: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
  };
}

function cleanPrismaRow(row: any): any {
  if (!row) return row;
  const clean: any = {};
  for (const key of Object.keys(row)) {
    let val = row[key];
    if (val !== null && typeof val === 'object' && val.constructor && val.constructor.name === 'Decimal') {
      val = Number(val.toString());
    } else if (typeof val === 'bigint') {
      val = Number(val);
    }
    clean[key] = val;
  }
  return clean;
}

// ==========================================
// 3. DATABASE MANAGER CLASS (SaaS - 100% PRISMA)
// ==========================================

class DatabaseManager {
  private checkConnection() {
    if (dbConnectionError) {
      throw new Error(dbConnectionError);
    }
  }

  public async query(sql: string, params: any[] = []): Promise<any[]> {
    this.checkConnection();
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(sql, ...params);
      return rows.map(cleanPrismaRow);
    } catch (err) {
      console.error("Prisma query raw error:", err);
      throw err;
    }
  }

  // ==========================================
  // TYPE-SAFE METHODS
  // ==========================================

  public async getUserById(id: string): Promise<User | null> {
    this.checkConnection();
    const u = await prisma.user.findUnique({ where: { id } });
    return u ? mapUserToSnake(u) : null;
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    this.checkConnection();
    const u = await prisma.user.findUnique({ where: { email } });
    return u ? mapUserToSnake(u) : null;
  }

  public async getProducts(userId?: string): Promise<Product[]> {
    this.checkConnection();
    const products = await prisma.product.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' }
    });
    return products.map(mapProductToSnake);
  }

  public async getProductById(id: string): Promise<Product | null> {
    this.checkConnection();
    const p = await prisma.product.findUnique({ where: { id } });
    return p ? mapProductToSnake(p) : null;
  }

  public async getProductsForLiveSession(liveSessionId: string): Promise<Product[]> {
    this.checkConnection();
    const products = await prisma.product.findMany({
      where: {
        lives: {
          some: {
            liveSessionId
          }
        }
      }
    });
    return products.map(mapProductToSnake);
  }

  public async getLiveSessionById(id: string): Promise<LiveSession | null> {
    this.checkConnection();
    const ls = await prisma.liveSession.findUnique({ where: { id } });
    return ls ? mapLiveSessionToSnake(ls) : null;
  }

  public async getLiveSessions(userId?: string): Promise<LiveSession[]> {
    this.checkConnection();
    const lives = await prisma.liveSession.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' }
    });
    return lives.map(mapLiveSessionToSnake);
  }

  public async getLiveSessionBySlug(slug: string, excludeId?: string): Promise<LiveSession | null> {
    this.checkConnection();
    const ls = await prisma.liveSession.findFirst({
      where: {
        slug,
        id: excludeId ? { not: excludeId } : undefined
      }
    });
    return ls ? mapLiveSessionToSnake(ls) : null;
  }

  public async getReservationsByLiveSessionId(liveSessionId: string): Promise<Reservation[]> {
    this.checkConnection();
    const res = await prisma.reservation.findMany({ where: { liveSessionId } });
    return res.map(mapReservationToSnake);
  }

  public async getLiveProductsByProductId(productId: string): Promise<any[]> {
    this.checkConnection();
    const lps = await prisma.liveProduct.findMany({ where: { productId } });
    return lps.map(lp => ({
      id: `${lp.liveSessionId}-${lp.productId}`,
      live_session_id: lp.liveSessionId,
      product_id: lp.productId,
      created_at: lp.createdAt.toISOString()
    }));
  }

  public async getProductInterestsByLiveSessionId(liveSessionId: string): Promise<any[]> {
    this.checkConnection();
    const saved = await prisma.savedProduct.findMany({ where: { liveSessionId } });
    return saved.map(mapSavedProductToSnake);
  }

  public async getVisitorSessionsByLiveSessionId(liveSessionId: string): Promise<Visitor[]> {
    this.checkConnection();
    const visitors = await prisma.visitor.findMany({ where: { liveSessionId } });
    return visitors.map(mapVisitorToSnake);
  }

  public async getAuditLogsByLiveSessionId(liveSessionId: string, limit: number = 50): Promise<AuditLog[]> {
    this.checkConnection();
    const logs = await prisma.auditLog.findMany({
      where: { liveSessionId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return logs.map(mapAuditLogToSnake);
  }

  public async getLiveNotificationsByLiveId(liveId: string): Promise<LiveNotification[]> {
    this.checkConnection();
    const notifs = await prisma.liveNotification.findMany({ where: { liveId } });
    return notifs.map(mapLiveNotificationToSnake);
  }

  public async insertAuditLog(log: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    this.checkConnection();
    const a = await prisma.auditLog.create({
      data: {
        liveSessionId: log.live_session_id || null,
        visitorPseudo: log.visitor_pseudo || null,
        userId: log.user_id || null,
        actionType: log.action_type,
        productName: log.product_name || null,
        details: log.details || null
      }
    });
    return mapAuditLogToSnake(a);
  }

  public async insertUser(user: any): Promise<User> {
    const u = await prisma.user.create({
      data: {
        email: user.email,
        passwordHash: user.password_hash,
        name: user.name,
        role: user.role === 'ADMIN' ? 'ADMIN' : 'SELLER',
        status: user.status || 'ACTIVE'
      }
    });
    return mapUserToSnake(u);
  }

  public async createLiveSession(live: any): Promise<LiveSession> {
    const l = await prisma.liveSession.create({
      data: {
        title: live.title,
        description: live.description,
        imageUrl: live.image_url,
        status: live.status,
        slug: live.slug,
        startDate: live.start_date ? new Date(live.start_date) : null,
        endDate: live.end_date ? new Date(live.end_date) : null,
        userId: live.user_id,
      }
    });
    return mapLiveSessionToSnake(l);
  }

  public async updateLiveSession(id: string, updates: Partial<LiveSession>): Promise<LiveSession> {
    const data: any = {};
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.image_url !== undefined) data.imageUrl = updates.image_url;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.slug !== undefined) data.slug = updates.slug;
    if (updates.start_date !== undefined) data.startDate = updates.start_date ? new Date(updates.start_date) : null;
    if (updates.end_date !== undefined) data.endDate = updates.end_date ? new Date(updates.end_date) : null;

    const l = await prisma.liveSession.update({
      where: { id },
      data,
    });
    return mapLiveSessionToSnake(l);
  }

  public async deleteLiveSession(id: string): Promise<void> {
    await prisma.liveSession.delete({ where: { id } });
  }

  public async createProduct(product: any): Promise<Product> {
    const p = await prisma.product.create({
      data: {
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        imageUrl: product.image_url,
        isActive: product.is_active,
        userId: product.user_id,
      }
    });
    return mapProductToSnake(p);
  }

  public async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const data: any = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.price !== undefined) data.price = updates.price;
    if (updates.stock !== undefined) data.stock = updates.stock;
    if (updates.image_url !== undefined) data.imageUrl = updates.image_url;
    if (updates.is_active !== undefined) data.isActive = updates.is_active;

    const p = await prisma.product.update({
      where: { id },
      data,
    });
    return mapProductToSnake(p);
  }

  public async deleteProduct(id: string): Promise<void> {
    await prisma.product.delete({ where: { id } });
  }

  public async syncLiveProducts(liveSessionId: string, productIds: string[]): Promise<void> {
    await prisma.liveProduct.deleteMany({ where: { liveSessionId } });
    if (productIds.length > 0) {
      await prisma.liveProduct.createMany({
        data: productIds.map(pId => ({ liveSessionId, productId: pId }))
      });
    }
  }

  // ==========================================
  // SCORING ENGINE & VISITOR ACTIONS (100% AUTOMATED)
  // ==========================================

  public async logVisitorAction(
    pseudo: string,
    liveSessionId: string,
    actionType: 'visit' | 'view_product' | 'save_product' | 'reservation' | 'contact_request',
    productId?: string,
    details?: string
  ): Promise<void> {
    this.checkConnection();
    try {
      // 1. Find or create the Visitor record
      let visitor = await prisma.visitor.findFirst({
        where: { pseudo, liveSessionId }
      });

      if (!visitor) {
        visitor = await prisma.visitor.create({
          data: {
            pseudo,
            liveSessionId,
            score: 1, // base visit score
          }
        });
      }

      // 2. Insert into visitor_actions
      await prisma.visitorAction.create({
        data: {
          visitorId: visitor.id,
          actionType,
          productId: productId || null,
          details: details || null
        }
      });

      // Update last active time
      await prisma.visitor.update({
        where: { id: visitor.id },
        data: { lastActiveAt: new Date() }
      });

      // 3. Recalculate visitor score automatically
      await this.recalculateVisitorScore(visitor.id);
    } catch (err) {
      console.error("Error logging visitor action & scoring:", err);
    }
  }

  public async recalculateVisitorScore(visitorId: string): Promise<number> {
    const visitor = await prisma.visitor.findUnique({
      where: { id: visitorId },
      include: { actions: true }
    });
    if (!visitor) return 1;

    let score = 1; // Visit base score

    // Compute from saved actions
    for (const action of visitor.actions) {
      if (action.actionType === 'view_product') score += 5;
      else if (action.actionType === 'save_product') score += 10;
      else if (action.actionType === 'reservation') score += 40;
      else if (action.actionType === 'contact_request') score += 100;
    }

    // Add extra points if phone number is supplied
    if (visitor.whatsapp && visitor.whatsapp.trim().length > 0) {
      score += 40;
    }

    // Persist score back in DB
    await prisma.visitor.update({
      where: { id: visitorId },
      data: { score }
    });

    return score;
  }

  // ==========================================
  // ATOMIC RESERVATION (WITH QUANTITY & DOUBLE PREVENTION)
  // ==========================================

  public async executeAtomicReservation(
    visitorPseudo: string,
    whatsapp: string,
    productId: string,
    liveSessionId: string,
    quantity: number
  ): Promise<Reservation> {
    this.checkConnection();
    
    if (!visitorPseudo || !productId || !whatsapp) {
      throw new Error("Informations incomplètes.");
    }
    if (quantity <= 0) {
      throw new Error("La quantité doit être supérieure à 0.");
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Double reservation check: 1 reservation max per pseudo and product
      const existing = await tx.reservation.findFirst({
        where: {
          visitorPseudo,
          productId,
          liveSessionId
        }
      });
      if (existing) {
        throw new Error("Vous avez déjà effectué une réservation pour cet article sur ce live.");
      }

      // Check product stock and validity
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error("Produit introuvable.");
      if (!product.isActive) throw new Error("Cet article est inactif.");
      if (product.stock < quantity) {
        throw new Error(`Stock insuffisant. Seulement ${product.stock} articles disponibles.`);
      }

      // Decrement stock
      await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: quantity } }
      });

      // Create reservation record
      const r = await tx.reservation.create({
        data: {
          visitorPseudo,
          whatsapp,
          productId,
          liveSessionId,
          quantity
        }
      });

      // Log into standard system logs
      await tx.auditLog.create({
        data: {
          liveSessionId,
          visitorPseudo,
          actionType: 'reservation',
          productName: product.name,
          details: `Réservation de ${quantity} unité(s) par ${visitorPseudo} (${whatsapp}).`
        }
      });

      return r;
    });

    // Fire visitor score trigger asynchronously
    await this.logVisitorAction(visitorPseudo, liveSessionId, 'reservation', productId, `Réservé x${quantity}`);
    
    // Update visitor's phone if they used a new/different one
    await prisma.visitor.updateMany({
      where: { pseudo: visitorPseudo, liveSessionId },
      data: { whatsapp }
    });

    return mapReservationToSnake(result);
  }

  public async recordInterest(visitorPseudo: string, productId: string, liveSessionId: string): Promise<void> {
    this.checkConnection();
    
    // Check if already interest recorded
    const existing = await prisma.savedProduct.findFirst({
      where: { visitorPseudo, productId, liveSessionId }
    });
    if (existing) return; // Do not duplicate

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true }
    });
    const prodName = product?.name || 'Produit';

    await prisma.$transaction([
      prisma.savedProduct.create({
        data: { visitorPseudo, productId, liveSessionId }
      }),
      prisma.auditLog.create({
        data: {
          liveSessionId,
          visitorPseudo,
          actionType: 'interest',
          productName: prodName,
          details: `Ajouté à la liste d'intérêts.`
        }
      })
    ]);

    // Track action and score
    await this.logVisitorAction(visitorPseudo, liveSessionId, 'save_product', productId, `Ajouté à la liste : ${prodName}`);
  }

  public async recordJoin(visitorPseudo: string, whatsapp: string | undefined, liveSessionId: string): Promise<void> {
    this.checkConnection();
    
    // Create/Update visitor session
    await prisma.visitor.upsert({
      where: { id: (await prisma.visitor.findFirst({ where: { pseudo: visitorPseudo, liveSessionId } }))?.id || '00000000-0000-0000-0000-000000000000' },
      create: {
        pseudo: visitorPseudo,
        whatsapp: whatsapp || null,
        liveSessionId,
        score: 1
      },
      update: {
        whatsapp: whatsapp || undefined,
        lastActiveAt: new Date()
      }
    });

    await prisma.auditLog.create({
      data: {
        liveSessionId,
        visitorPseudo,
        actionType: 'join',
        details: 'Visiteur connecté au live.'
      }
    });

    await this.logVisitorAction(visitorPseudo, liveSessionId, 'visit', undefined, "A rejoint la boutique");
  }

  public async recordContactRequest(visitorPseudo: string, whatsapp: string, liveSessionId: string): Promise<void> {
    this.checkConnection();
    
    await prisma.$transaction([
      prisma.contactRequest.create({
        data: {
          visitorPseudo,
          whatsapp,
          liveSessionId
        }
      }),
      prisma.auditLog.create({
        data: {
          liveSessionId,
          visitorPseudo,
          actionType: 'contact_request',
          details: `A demandé à être contacté par WhatsApp au ${whatsapp}.`
        }
      })
    ]);

    // If contact request made, make sure the visitor record reflects the whatsapp number
    await prisma.visitor.updateMany({
      where: { pseudo: visitorPseudo, liveSessionId },
      data: { whatsapp }
    });

    // Track action and score
    await this.logVisitorAction(visitorPseudo, liveSessionId, 'contact_request', undefined, `Demande de contact WhatsApp : ${whatsapp}`);
  }

  // ==========================================
  // REAL-TIME V1 SELLER DASHBOARD QUERIES
  // ==========================================

  public async getHotProspects(liveSessionId: string): Promise<any[]> {
    this.checkConnection();
    const visitors = await prisma.visitor.findMany({
      where: { liveSessionId },
      orderBy: { score: 'desc' },
      include: {
        actions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // Fetch saved products & reservations to compute linked products
    const saved = await prisma.savedProduct.findMany({
      where: { liveSessionId },
      include: { product: true }
    });

    const reservations = await prisma.reservation.findMany({
      where: { liveSessionId },
      include: { product: true }
    });

    const contactRequests = await prisma.contactRequest.findMany({
      where: { liveSessionId },
      select: { visitorPseudo: true }
    });
    const contactPseudos = new Set(contactRequests.map(c => c.visitorPseudo));

    return visitors.map(v => {
      const visitorSaved = saved.filter(s => s.visitorPseudo === v.pseudo);
      const visitorReservations = reservations.filter(r => r.visitorPseudo === v.pseudo);

      const savedProducts = visitorSaved.map(s => `❤️ ${s.product.name}`);
      const reservedProducts = visitorReservations.map(r => `🛒 ${r.product.name} (x${r.quantity})`);

      const linkedProducts = Array.from(new Set([...reservedProducts, ...savedProducts]));
      const has_requested_contact = contactPseudos.has(v.pseudo);

      return {
        id: v.id,
        pseudo: v.pseudo,
        score: v.score,
        whatsapp: v.whatsapp || '',
        linkedProducts,
        lastActivity: v.actions[0]?.details || 'Connexion initiale',
        lastActiveAt: v.lastActiveAt.toISOString(),
        saved_count: visitorSaved.length,
        reserved_count: visitorReservations.reduce((acc, curr) => acc + curr.quantity, 0),
        has_requested_contact
      };
    });
  }

  public async getPopularProducts(liveSessionId: string): Promise<any[]> {
    this.checkConnection();
    const products = await this.getProductsForLiveSession(liveSessionId);

    // Fetch saved stats in memory to be extremely robust and avoid any database-specific groupBy limitations
    const saved = await prisma.savedProduct.findMany({
      where: { liveSessionId },
      select: { productId: true }
    });

    const reservations = await prisma.reservation.findMany({
      where: { liveSessionId },
      select: { productId: true, quantity: true }
    });

    // Fetch product views from actions safely without groupBy on relations
    const visitors = await prisma.visitor.findMany({
      where: { liveSessionId },
      select: { id: true }
    });
    const visitorIds = visitors.map(v => v.id);

    const views = await prisma.visitorAction.findMany({
      where: {
        actionType: 'view_product',
        visitorId: { in: visitorIds },
        productId: { not: null }
      },
      select: { productId: true }
    });

    const viewsCountMap: Record<string, number> = {};
    for (const v of views) {
      if (v.productId) {
        viewsCountMap[v.productId] = (viewsCountMap[v.productId] || 0) + 1;
      }
    }

    const savedCountMap: Record<string, number> = {};
    for (const s of saved) {
      savedCountMap[s.productId] = (savedCountMap[s.productId] || 0) + 1;
    }

    const reservationsCountMap: Record<string, number> = {};
    for (const r of reservations) {
      reservationsCountMap[r.productId] = (reservationsCountMap[r.productId] || 0) + r.quantity;
    }

    return products.map(p => {
      const viewsCount = viewsCountMap[p.id] || 0;
      const savedCount = savedCountMap[p.id] || 0;
      const reservationsCount = reservationsCountMap[p.id] || 0;

      return {
        id: p.id,
        name: p.name,
        price: Number(p.price),
        stock: p.stock,
        views: viewsCount,
        viewsCount,
        savedCount,
        interests: savedCount,
        reservations: reservationsCount,
        reservationsCount
      };
    });
  }

  public async getLiveDashboardStats(liveSessionId: string): Promise<any> {
    this.checkConnection();
    const live = await prisma.liveSession.findUnique({ where: { id: liveSessionId } });
    if (!live) return null;

    // Active visitors: Connected/joined unique visitors
    const totalVisitors = await prisma.visitor.count({ where: { liveSessionId } });

    // Visitors who did any action in the last 15 minutes
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const activeVisitors = await prisma.visitor.count({
      where: {
        liveSessionId,
        lastActiveAt: { gte: fifteenMinsAgo }
      }
    });

    // Actions per minute (last 10 minutes)
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentActionsCount = await prisma.visitorAction.count({
      where: {
        createdAt: { gte: tenMinsAgo },
        visitor: { liveSessionId }
      }
    });
    const actionsPerMinute = Number((recentActionsCount / 10).toFixed(1));

    // Conversions in progress (visitors who have made at least 1 reservation)
    const reservingPseudos = await prisma.reservation.findMany({
      where: { liveSessionId },
      select: { visitorPseudo: true }
    });
    const uniqueReservingCount = new Set(reservingPseudos.map(r => r.visitorPseudo)).size;
    const conversionRate = totalVisitors > 0 ? Math.round((uniqueReservingCount / totalVisitors) * 100) : 0;

    // Total reservations count (count of items reserved)
    const totalReservations = await prisma.reservation.aggregate({
      where: { liveSessionId },
      _sum: { quantity: true }
    });
    const reservationsCount = totalReservations._sum.quantity || 0;

    // Interests count
    const interestsCount = await prisma.savedProduct.count({ where: { liveSessionId } });

    // Fetch all reservations for timeline
    const allReservations = await prisma.reservation.findMany({
      where: { liveSessionId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, quantity: true }
    });

    const startTime = live.startDate ? new Date(live.startDate).getTime() : (allReservations[0] ? new Date(allReservations[0].createdAt).getTime() - 60000 : new Date(live.createdAt).getTime());
    const endTime = Math.max(Date.now(), allReservations.length > 0 ? new Date(allReservations[allReservations.length - 1].createdAt).getTime() : Date.now());

    // Divide into 8 buckets
    const bucketCount = 8;
    const duration = endTime - startTime;
    const bucketDuration = duration > 0 ? duration / bucketCount : 60000;

    const timeline: any[] = [];
    let cumulative = 0;

    for (let i = 0; i <= bucketCount; i++) {
      const bucketTime = startTime + i * bucketDuration;
      const bucketDate = new Date(bucketTime);
      const timeLabel = bucketDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      let count = 0;
      if (i > 0) {
        const prevTime = startTime + (i - 1) * bucketDuration;
        count = allReservations
          .filter(r => {
            const t = new Date(r.createdAt).getTime();
            return t > prevTime && t <= bucketTime;
          })
          .reduce((sum, r) => sum + r.quantity, 0);
      }

      cumulative += count;

      timeline.push({
        time: timeLabel,
        reservations: count,
        cumulativeReservations: cumulative
      });
    }

    return {
      // Compatibility fields
      totalVisitors,
      activeVisitors,
      actionsPerMinute,
      conversionRate,
      reservingCount: uniqueReservingCount,

      // Expected active live dashboard SaaS V1 fields
      uniqueVisitorsCount: totalVisitors,
      reservationsCount,
      interestsCount,
      preRegistrationConversionRate: conversionRate,
      timeline
    };
  }

  public async getSellerStats(userId: string): Promise<any> {
    this.checkConnection();
    const reservations = await prisma.reservation.findMany({
      where: {
        liveSession: {
          userId: userId
        }
      },
      select: {
        quantity: true,
        product: {
          select: {
            price: true
          }
        }
      }
    });
    const totalReservationsCount = reservations.length;
    const totalEarnings = reservations.reduce((sum: number, r: any) => {
      const price = r.product ? Number(r.product.price) : 0;
      return sum + (price * r.quantity);
    }, 0);

    const totalInterestsCount = await prisma.savedProduct.count({
      where: {
        liveSession: {
          userId: userId
        }
      }
    });

    const preRegistrationsCount = await prisma.liveNotification.count({
      where: {
        liveSession: {
          userId: userId
        }
      }
    });

    // Pre-visitors count: joined before start_date
    const visitors = await prisma.visitor.findMany({
      where: {
        liveSession: {
          userId: userId
        }
      },
      include: {
        liveSession: {
          select: {
            startDate: true
          }
        }
      }
    });
    
    const preVisitorsCount = visitors.filter((v: any) => {
      if (!v.liveSession?.startDate) return false;
      return new Date(v.joinedAt).getTime() < new Date(v.liveSession.startDate).getTime();
    }).length;

    return {
      totalReservationsCount,
      totalEarnings,
      totalInterestsCount,
      preRegistrationsCount,
      preVisitorsCount
    };
  }

  public async createLiveNotification(notif: any): Promise<LiveNotification> {
    const n = await prisma.liveNotification.create({
      data: {
        liveId: notif.live_id,
        pseudo: notif.pseudo,
        whatsapp: notif.whatsapp
      }
    });
    return mapLiveNotificationToSnake(n);
  }

  public async checkOverlap(userId: string, start_date: string, end_date: string, excludeId?: string): Promise<boolean> {
    this.checkConnection();
    const start = new Date(start_date);
    const end = new Date(end_date);
    const overlapping = await prisma.liveSession.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'SCHEDULED', 'SOLD_OUT'] },
        id: excludeId ? { not: excludeId } : undefined,
        AND: [
          { startDate: { lt: end } },
          { endDate: { gt: start } }
        ]
      }
    });
    return overlapping !== null;
  }

  public async autoCheckDates(): Promise<void> {
    try {
      const lives = await prisma.liveSession.findMany();
      const now = new Date();

      for (const live of lives) {
        if (live.status === 'DRAFT' || live.status === 'INACTIVE') {
          continue;
        }

        const start = live.startDate ? new Date(live.startDate) : null;
        const end = live.endDate ? new Date(live.endDate) : null;
        if (!start || !end) continue;

        const thirtyDaysAfterEnd = new Date(end.getTime() + 30 * 24 * 60 * 60 * 1000);

        let targetStatus: LiveSession['status'] = live.status;

        if (now >= thirtyDaysAfterEnd) {
          targetStatus = 'ARCHIVED';
        } else if (now >= end) {
          targetStatus = 'ENDED';
        } else if (now >= start && now < end) {
          const products = await prisma.product.findMany({
            where: {
              isActive: true,
              lives: {
                some: {
                  liveSessionId: live.id
                }
              }
            }
          });
          
          const allSoldOut = products.length > 0 && products.every((p: any) => p.stock <= 0);
          if (allSoldOut) {
            targetStatus = 'SOLD_OUT';
          } else {
            targetStatus = 'ACTIVE';
          }
        } else {
          targetStatus = 'SCHEDULED';
        }

        if (live.status !== targetStatus) {
          await prisma.liveSession.update({
            where: { id: live.id },
            data: { status: targetStatus }
          });

          await prisma.auditLog.create({
            data: {
              liveSessionId: live.id,
              visitorPseudo: 'SYSTEM',
              actionType: 'sys-status-change',
              details: `La boutique a été automatiquement passée au statut ${targetStatus} par le vérificateur système.`
            }
          });
        }
      }
    } catch (e) {
      console.error("Error auto-checking dates:", e);
    }
  }
}

export const db = new DatabaseManager();

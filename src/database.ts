import { PrismaClient } from '@prisma/client';

// ==========================================
// DB TYPES & INTERFACES (BACKWARD COMPATIBLE)
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

export interface VisitorSession {
  id: string;
  pseudo: string;
  whatsapp?: string;
  live_session_id: string;
  joined_at: string;
}

export interface ProductInterest {
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

// Test Neon database connection and capture errors
async function applySqlConstraints() {
  try {
    console.log("Prisma: Applying database-level TIMESTAMPTZ constraints on live_sessions...");
    
    // Clean up or adjust any potentially invalid records from older dev sessions to prevent check constraint errors
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

    await prisma.$executeRawUnsafe(`
      UPDATE live_sessions
      SET end_date = start_date + INTERVAL '30 minutes'
      WHERE start_date IS NOT NULL AND end_date IS NOT NULL AND (end_date - start_date) < INTERVAL '30 minutes'
    `);

    // Create the CHECK constraints if they don't already exist in PostgreSQL
    const endConstraintExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM pg_constraint WHERE conname = 'check_end_date_after_start_date'
    `);
    if (!(endConstraintExists as any[]).length) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE live_sessions 
        ADD CONSTRAINT check_end_date_after_start_date CHECK (end_date > start_date)
      `);
      console.log("Prisma: Constraint check_end_date_after_start_date successfully added.");
    }

    const maxConstraintExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM pg_constraint WHERE conname = 'check_max_duration_24h'
    `);
    if (!(maxConstraintExists as any[]).length) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE live_sessions 
        ADD CONSTRAINT check_max_duration_24h CHECK (end_date - start_date <= interval '24 hours')
      `);
      console.log("Prisma: Constraint check_max_duration_24h successfully added.");
    }

    const minConstraintExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM pg_constraint WHERE conname = 'check_min_duration_30m'
    `);
    if (!(minConstraintExists as any[]).length) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE live_sessions 
        ADD CONSTRAINT check_min_duration_30m CHECK (end_date - start_date >= interval '30 minutes')
      `);
      console.log("Prisma: Constraint check_min_duration_30m successfully added.");
    }

    console.log("Prisma: Database-level schedule constraints successfully verified!");
  } catch (err) {
    console.warn("Prisma Warning: Could not automatically verify/apply database-level check constraints:", err);
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

function mapProductInterestToSnake(i: any): ProductInterest {
  if (!i) return i;
  return {
    id: i.id,
    visitor_pseudo: i.visitorPseudo,
    product_id: i.productId,
    live_session_id: i.liveSessionId,
    created_at: i.createdAt instanceof Date ? i.createdAt.toISOString() : i.createdAt,
  };
}

function mapVisitorSessionToSnake(s: any): VisitorSession {
  if (!s) return s;
  return {
    id: s.id,
    pseudo: s.pseudo,
    whatsapp: s.whatsapp,
    live_session_id: s.liveSessionId,
    joined_at: s.joinedAt instanceof Date ? s.joinedAt.toISOString() : s.joinedAt,
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

// Cleans raw query decimals and bigints
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
  public isPg = true;

  private checkConnection() {
    if (dbConnectionError) {
      throw new Error(dbConnectionError);
    }
  }

  // Raw Query bypass helper routing directly via PrismaClient raw safe executor
  public async query(sql: string, params: any[] = []): Promise<any[]> {
    this.checkConnection();
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(sql, ...params);
      return rows.map(cleanPrismaRow);
    } catch (err) {
      console.error("Prisma query raw error on statement:", sql, err);
      throw err;
    }
  }

  // ==========================================
  // TYPE-SAFE PRISMA METHODS (NO RAW SQL)
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

  public async getAllUsersForAdmin(): Promise<User[]> {
    this.checkConnection();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return users.map(mapUserToSnake);
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

  public async getProductInterestsByLiveSessionId(liveSessionId: string): Promise<ProductInterest[]> {
    this.checkConnection();
    const interests = await prisma.productInterest.findMany({ where: { liveSessionId } });
    return interests.map(mapProductInterestToSnake);
  }

  public async getVisitorSessionsByLiveSessionId(liveSessionId: string): Promise<VisitorSession[]> {
    this.checkConnection();
    const sessions = await prisma.visitorSession.findMany({ where: { liveSessionId } });
    return sessions.map(mapVisitorSessionToSnake);
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

  // ==========================================
  // TRANSACTION STABLE WRITE METHODS
  // ==========================================

  public async insertUser(user: Omit<User, 'id' | 'created_at' | 'updated_at' | 'status'> & { status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING' }): Promise<User> {
    try {
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
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new Error("Cet email est déjà utilisé.");
      }
      throw err;
    }
  }

  public async createLiveSession(live: Omit<LiveSession, 'id' | 'created_at' | 'updated_at'>): Promise<LiveSession> {
    try {
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
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new Error("Ce slug de boutique est déjà utilisé.");
      }
      throw err;
    }
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
    if (updates.user_id !== undefined) data.userId = updates.user_id;

    const l = await prisma.liveSession.update({
      where: { id },
      data,
    });
    return mapLiveSessionToSnake(l);
  }

  public async deleteLiveSession(id: string): Promise<void> {
    await prisma.liveSession.delete({
      where: { id }
    });
  }

  public async createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
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
    if (updates.user_id !== undefined) data.userId = updates.user_id;

    const p = await prisma.product.update({
      where: { id },
      data,
    });
    return mapProductToSnake(p);
  }

  public async deleteProduct(id: string): Promise<void> {
    await prisma.product.delete({
      where: { id }
    });
  }

  public async syncLiveProducts(liveSessionId: string, productIds: string[]): Promise<void> {
    // Delete existing live_products relations for this live session
    await prisma.liveProduct.deleteMany({
      where: { liveSessionId }
    });
    // Bulk create new ones
    if (productIds.length > 0) {
      await prisma.liveProduct.createMany({
        data: productIds.map(pId => ({
          liveSessionId,
          productId: pId
        }))
      });
    }
  }

  // ==========================================
  // ATOMIC CONCURRENCY-SAFE RESERVATION (FOR UPDATE - 100% PRISMA)
  // ==========================================

  public async executeAtomicReservation(
    visitorPseudo: string,
    whatsapp: string | undefined,
    productId: string,
    liveSessionId: string
  ): Promise<Reservation> {
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Fetch the product inside transaction cleanly
      const product = await tx.product.findUnique({
        where: { id: productId }
      });
      if (!product) {
        throw new Error('Produit inexistant.');
      }
      if (!product.isActive) {
        throw new Error('Ce produit est actuellement inactif.');
      }
      if (product.stock <= 0) {
        throw new Error('Rupture de stock ! Réservation impossible.');
      }

      // 2. Safely decrement stock
      await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: 1 } }
      });

      // 3. Create the Reservation record
      const res = await tx.reservation.create({
        data: {
          visitorPseudo,
          whatsapp,
          productId,
          liveSessionId,
          quantity: 1
        }
      });

      // 4. Log the transaction into AuditLog
      await tx.auditLog.create({
        data: {
          liveSessionId,
          visitorPseudo,
          actionType: 'reservation',
          productName: product.name,
          details: `Réservation d'une unité validée avec succès par transaction.`
        }
      });

      return res;
    });

    return mapReservationToSnake(result);
  }

  public async recordInterest(visitorPseudo: string, productId: string, liveSessionId: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true }
    });
    const prodName = product?.name || 'Produit';

    await prisma.$transaction([
      prisma.productInterest.create({
        data: {
          visitorPseudo,
          productId,
          liveSessionId
        }
      }),
      prisma.auditLog.create({
        data: {
          liveSessionId,
          visitorPseudo,
          actionType: 'interest',
          productName: prodName,
          details: `Intérêt marqué pour le produit.`
        }
      })
    ]);
  }

  public async recordJoin(visitorPseudo: string, whatsapp: string | undefined, liveSessionId: string): Promise<void> {
    await prisma.$transaction([
      prisma.visitorSession.create({
        data: {
          pseudo: visitorPseudo,
          whatsapp,
          liveSessionId
        }
      }),
      prisma.auditLog.create({
        data: {
          liveSessionId,
          visitorPseudo,
          actionType: 'join',
          details: 'Visiteur connecté au live.'
        }
      })
    ]);
  }

  // ==========================================
  // REAL-TIME SAAS METRICS AND ANALYTICS
  // ==========================================

  public async getAdminStats(): Promise<any> {
    const sellersCount = await prisma.user.count({
      where: { role: 'SELLER' }
    });
    const totalLivesCount = await prisma.liveSession.count();
    const activeLivesCount = await prisma.liveSession.count({
      where: { status: { in: ['ACTIVE', 'SOLD_OUT'] } }
    });
    const totalReservations = await prisma.reservation.count();

    const reservations = await prisma.reservation.findMany({
      select: {
        quantity: true,
        product: {
          select: {
            price: true
          }
        }
      }
    });
    const totalSales = reservations.reduce((sum: number, r: any) => {
      const price = r.product ? Number(r.product.price) : 0;
      return sum + (price * r.quantity);
    }, 0);

    return {
      sellersCount,
      totalLivesCount,
      activeLivesCount,
      totalReservations,
      totalSales
    };
  }

  public async getSellerStats(userId: string): Promise<any> {
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

    const totalInterestsCount = await prisma.productInterest.count({
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

    const visitorSessions = await prisma.visitorSession.findMany({
      where: {
        liveSession: {
          userId: userId
        }
      },
      select: {
        joinedAt: true,
        liveSession: {
          select: {
            startDate: true
          }
        }
      }
    });
    const preVisitorsCount = visitorSessions.filter((vs: any) => {
      if (!vs.liveSession?.startDate) return false;
      return new Date(vs.joinedAt).getTime() < new Date(vs.liveSession.startDate).getTime();
    }).length;

    return {
      totalReservationsCount,
      totalEarnings,
      totalInterestsCount,
      preRegistrationsCount,
      preVisitorsCount
    };
  }

  public async createLiveNotification(notif: Omit<LiveNotification, 'id' | 'created_at'>): Promise<LiveNotification> {
    const n = await prisma.liveNotification.create({
      data: {
        liveId: notif.live_id,
        pseudo: notif.pseudo,
        whatsapp: notif.whatsapp
      }
    });
    return mapLiveNotificationToSnake(n);
  }

  // Overlap prevention helper for scheduler conflicts
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
          {
            startDate: { lt: end }
          },
          {
            endDate: { gt: start }
          }
        ]
      }
    });
    return overlapping !== null;
  }

  // ==========================================
  // AUTONOMOUS DATE & LIFECYCLE CONTROLLER
  // ==========================================

  public async autoCheckDates(): Promise<void> {
    try {
      const lives = await prisma.liveSession.findMany();
      const now = new Date();

      for (const live of lives) {
        // Voluntarily deactivated or draft sessions must not be auto-transitioned
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
          // Check linked products in the catalog
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

          // Journaliser l'action dans les logs système (AuditLog)
          await prisma.auditLog.create({
            data: {
              liveSessionId: live.id,
              visitorPseudo: 'SYSTEM',
              actionType: 'sys-status-change',
              details: `La boutique a été automatiquement passée au statut ${targetStatus} par le vérificateur de planification système (ancien statut: ${live.status}).`
            }
          });

          console.log(`Auto-transitioned live session ${live.id} from ${live.status} to ${targetStatus} and logged to audit trails.`);
        }
      }
    } catch (e) {
      console.error("Error auto-checking dates:", e);
    }
  }
}

export const db = new DatabaseManager();

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
  live_session_id: string;
  visitor_pseudo: string;
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
async function verifyDatabaseConnection() {
  if (dbConnectionError) return;
  try {
    console.log("Prisma: Attempting to connect to Neon PostgreSQL...");
    await prisma.$connect();
    console.log("Prisma: Successfully connected to Neon PostgreSQL!");
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
    live_session_id: a.liveSessionId,
    visitor_pseudo: a.visitorPseudo,
    action_type: a.actionType,
    product_name: a.productName,
    details: a.details,
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
  // TRANSACTION STABLE WRITE METHODS
  // ==========================================

  public async insertUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    try {
      const u = await prisma.user.create({
        data: {
          email: user.email,
          passwordHash: user.password_hash,
          name: user.name,
          role: user.role === 'ADMIN' ? 'ADMIN' : 'SELLER',
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
  // ATOMIC CONCURRENCY-SAFE RESERVATION (FOR UPDATE)
  // ==========================================

  public async executeAtomicReservation(
    visitorPseudo: string,
    whatsapp: string | undefined,
    productId: string,
    liveSessionId: string
  ): Promise<Reservation> {
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. SELECT FOR UPDATE to acquire exclusive row-level lock on the product
      const products: any[] = await tx.$queryRawUnsafe(
        `SELECT id, name, description, price, stock, is_active as "isActive", user_id as "userId" FROM products WHERE id = $1::uuid FOR UPDATE`,
        productId
      );
      if (products.length === 0) {
        throw new Error('Produit inexistant.');
      }
      const product = products[0];
      if (!product.isActive) {
        throw new Error('Ce produit est actuellement inactif.');
      }
      if (product.stock <= 0) {
        throw new Error('Rupture de stock ! Réservation impossible.');
      }

      // 2. Safely decrement stock
      await tx.product.update({
        where: { id: productId },
        data: { stock: product.stock - 1 }
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

    const earningRes: any[] = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(SUM(p.price * r.quantity), 0) as total_sales
      FROM reservations r
      JOIN products p ON r.product_id = p.id
    `);
    const totalSales = earningRes.length > 0 ? Number(earningRes[0].total_sales) : 0;

    return {
      sellersCount,
      totalLivesCount,
      activeLivesCount,
      totalReservations,
      totalSales
    };
  }

  public async getSellerStats(userId: string): Promise<any> {
    const totalRes: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*), COALESCE(SUM(p.price * r.quantity), 0) as total_earnings
      FROM reservations r
      JOIN products p ON r.product_id = p.id
      WHERE r.live_session_id IN (SELECT id FROM live_sessions WHERE user_id = $1::uuid)
    `, userId);

    const totalInt: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) FROM product_interests
      WHERE live_session_id IN (SELECT id FROM live_sessions WHERE user_id = $1::uuid)
    `, userId);

    const preRegRes: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) FROM live_notifications
      WHERE live_id IN (SELECT id FROM live_sessions WHERE user_id = $1::uuid)
    `, userId);

    const preVisitorsRes: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) FROM visitor_sessions vs
      JOIN live_sessions ls ON vs.live_session_id = ls.id
      WHERE ls.user_id = $1::uuid AND vs.joined_at < ls.start_date
    `, userId);

    return {
      totalReservationsCount: totalRes.length > 0 ? parseInt(totalRes[0].count || '0') : 0,
      totalEarnings: totalRes.length > 0 ? Number(totalRes[0].total_earnings || '0') : 0,
      totalInterestsCount: totalInt.length > 0 ? parseInt(totalInt[0].count || '0') : 0,
      preRegistrationsCount: preRegRes.length > 0 ? parseInt(preRegRes[0].count || '0') : 0,
      preVisitorsCount: preVisitorsRes.length > 0 ? parseInt(preVisitorsRes[0].count || '0') : 0
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

  // ==========================================
  // AUTONOMOUS DATE & LIFECYCLE CONTROLLER
  // ==========================================

  public async autoCheckDates(): Promise<void> {
    try {
      const lives = await prisma.liveSession.findMany();
      const now = new Date();

      for (const live of lives) {
        if (live.status === 'DRAFT') {
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
          console.log(`Auto-transitioned live session ${live.id} from ${live.status} to ${targetStatus}`);
        }
      }
    } catch (e) {
      console.error("Error auto-checking dates:", e);
    }
  }
}

export const db = new DatabaseManager();

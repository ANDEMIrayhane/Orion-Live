import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

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
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ENDED' | 'SOLD_OUT';
  slug: string;
  start_date: string;
  end_date: string;
  user_id: string;
  created_at: string;
  updated_at: string;
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

class DatabaseManager {
  private pool: Pool | null = null;
  public isPg = false;
  private localDbPath = path.resolve(process.cwd(), 'orion_db.json');

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        this.pool = new Pool({
          connectionString: dbUrl,
          ssl: dbUrl.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
        });
        this.isPg = true;
        console.log('Orion DB: Connected to PostgreSQL (Neon).');
      } catch (err) {
        console.error('Orion DB: Error connecting to PostgreSQL. Falling back to local store.', err);
        this.isPg = false;
      }
    } else {
      console.log('Orion DB: DATABASE_URL not set. Using workspace-persistent local JSON store.');
      this.isPg = false;
    }
    this.initDatabase();
  }

  private initDatabase() {
    if (this.isPg && this.pool) {
      // Create tables on Neon PostgreSQL if they don't exist
      const query = `
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(100) NOT NULL,
            role VARCHAR(20) DEFAULT 'SELLER' NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS live_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            title VARCHAR(150) NOT NULL,
            description TEXT,
            image_url TEXT,
            status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
            slug VARCHAR(100) UNIQUE NOT NULL,
            start_date TIMESTAMP WITH TIME ZONE,
            end_date TIMESTAMP WITH TIME ZONE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS products (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(150) NOT NULL,
            description TEXT,
            price NUMERIC(10, 2) NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            image_url TEXT,
            is_active BOOLEAN DEFAULT true NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS live_products (
            live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY (live_session_id, product_id)
        );

        CREATE TABLE IF NOT EXISTS visitor_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            pseudo VARCHAR(50) NOT NULL,
            whatsapp VARCHAR(30),
            live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS product_interests (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            visitor_pseudo VARCHAR(50) NOT NULL,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reservations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            visitor_pseudo VARCHAR(50) NOT NULL,
            whatsapp VARCHAR(30),
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
            quantity INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
            visitor_pseudo VARCHAR(50) NOT NULL,
            action_type VARCHAR(50) NOT NULL,
            product_name VARCHAR(150),
            details TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `;
      this.pool.query(query)
        .then(() => console.log('Orion DB: PostgreSQL tables verified/initialized.'))
        .catch(err => console.error('Orion DB: PostgreSQL table init error', err));
    } else {
      // Local JSON File DB initialization with seeds
      if (!fs.existsSync(this.localDbPath)) {
        const seedData = {
          users: [
            {
              id: "admin-uuid",
              email: "admin@orion.live",
              password_hash: "$2a$10$U7v0.fNlI2v2gC3672.r3OuNfMHeo7v3u6jC8HkZ/fXzK2Kj4qR7K", // "orionadmin"
              name: "Super Administrateur Orion",
              role: "ADMIN",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            {
              id: "seller-1-uuid",
              email: "sarah.bijoux@orion.live",
              password_hash: "$2a$10$T1qKbyi1S7ZzE5gV5m6HauGzE6b/v52qMv/8O7I6/mH/S72f3Y6iG", // "orionseller"
              name: "Sarah Bijoux Artisans",
              role: "SELLER",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            {
              id: "seller-2-uuid",
              email: "jean.vintage@orion.live",
              password_hash: "$2a$10$T1qKbyi1S7ZzE5gV5m6HauGzE6b/v52qMv/8O7I6/mH/S72f3Y6iG", // "orionseller"
              name: "Jean Mode Vintage",
              role: "SELLER",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ] as User[],
          live_sessions: [
            {
              id: "live-1-uuid",
              title: "Vente Live Été - Bijoux Fins ☀️",
              description: "Découvrez notre collection de bijoux éphémères en direct live !",
              image_url: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600&q=80",
              status: "ACTIVE",
              slug: "vente-bijoux",
              start_date: new Date().toISOString(),
              end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              user_id: "seller-1-uuid",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ] as LiveSession[],
          products: [
            {
              id: "prod-1-uuid",
              name: "Collier Plaqué Or Solaire",
              description: "Pièce artisanale ornée d'un soleil martelé.",
              price: 89.00,
              stock: 10,
              image_url: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&q=80",
              is_active: true,
              user_id: "seller-1-uuid",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            {
              id: "prod-2-uuid",
              name: "Bague Améthyste Impériale",
              description: "Bague sertie d'une améthyste naturelle brute.",
              price: 145.00,
              stock: 3,
              image_url: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&q=80",
              is_active: true,
              user_id: "seller-1-uuid",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            {
              id: "prod-3-uuid",
              name: "Créoles Argent Scintillantes",
              description: "Boucles d'oreilles créoles facettées.",
              price: 39.00,
              stock: 15,
              image_url: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&q=80",
              is_active: true,
              user_id: "seller-1-uuid",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ] as Product[],
          live_products: [
            { live_session_id: "live-1-uuid", product_id: "prod-1-uuid", created_at: new Date().toISOString() },
            { live_session_id: "live-1-uuid", product_id: "prod-2-uuid", created_at: new Date().toISOString() },
            { live_session_id: "live-1-uuid", product_id: "prod-3-uuid", created_at: new Date().toISOString() }
          ] as LiveProduct[],
          visitor_sessions: [] as VisitorSession[],
          product_interests: [] as ProductInterest[],
          reservations: [] as Reservation[],
          audit_logs: [] as AuditLog[]
        };
        fs.writeFileSync(this.localDbPath, JSON.stringify(seedData, null, 2));
        console.log('Orion DB: Seeded local JSON file database successfully.');
      }
    }
  }

  private readLocal(): any {
    try {
      const data = fs.readFileSync(this.localDbPath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
  }

  private writeLocal(data: any) {
    fs.writeFileSync(this.localDbPath, JSON.stringify(data, null, 2));
  }

  // ==========================================
  // DB DATA RETRIEVAL METHODS
  // ==========================================

  public async query(sql: string, params: any[] = []): Promise<any[]> {
    if (this.isPg && this.pool) {
      const res = await this.pool.query(sql, params);
      return res.rows;
    } else {
      // Parse local query dynamically using simulated lookups
      const data = this.readLocal();
      const lowerSql = sql.toLowerCase().trim();

      if (lowerSql.startsWith('select * from users where email =')) {
        const email = params[0];
        return data.users.filter((u: any) => u.email === email);
      }
      if (lowerSql.startsWith('select * from users where id =')) {
        const id = params[0];
        return data.users.filter((u: any) => u.id === id);
      }
      if (lowerSql.startsWith('select * from users')) {
        return data.users;
      }
      if (lowerSql.includes('live_sessions') && lowerSql.includes('slug =')) {
        const slug = params[0];
        return data.live_sessions.filter((l: any) => l.slug === slug);
      }
      if (lowerSql.includes('select * from live_sessions where user_id =')) {
        const userId = params[0];
        return data.live_sessions.filter((l: any) => l.user_id === userId);
      }
      if (lowerSql.startsWith('select * from live_sessions')) {
        return data.live_sessions;
      }
      if (lowerSql.includes('select * from products where user_id =')) {
        const userId = params[0];
        return data.products.filter((p: any) => p.user_id === userId);
      }
      if (lowerSql.includes('select * from products where id =')) {
        const id = params[0];
        return data.products.filter((p: any) => p.id === id);
      }
      if (lowerSql.startsWith('select * from products')) {
        return data.products;
      }
      if (lowerSql.includes('live_products') && lowerSql.includes('live_session_id =')) {
        const liveId = params[0];
        return data.live_products.filter((lp: any) => lp.live_session_id === liveId);
      }
      if (lowerSql.includes('select * from reservations')) {
        if (params.length > 0) {
          const liveId = params[0];
          return data.reservations.filter((r: any) => r.live_session_id === liveId);
        }
        return data.reservations;
      }
      if (lowerSql.includes('select * from audit_logs')) {
        const liveId = params[0];
        return data.audit_logs
          .filter((al: any) => al.live_session_id === liveId)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      if (lowerSql.includes('select * from product_interests')) {
        const liveId = params[0];
        return data.product_interests.filter((pi: any) => pi.live_session_id === liveId);
      }
      return [];
    }
  }

  // ==========================================
  // TRANSACTION STABLE WRITE METHODS
  // ==========================================

  public async insertUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const id = `user-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const newUser: User = {
      id,
      ...user,
      created_at: now,
      updated_at: now
    };

    if (this.isPg && this.pool) {
      const sql = `INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
      const res = await this.pool.query(sql, [newUser.id, newUser.email, newUser.password_hash, newUser.name, newUser.role]);
      return res.rows[0];
    } else {
      const data = this.readLocal();
      if (data.users.some((u: any) => u.email === user.email)) {
        throw new Error("Cet email est déjà utilisé.");
      }
      data.users.push(newUser);
      this.writeLocal(data);
      return newUser;
    }
  }

  public async createLiveSession(live: Omit<LiveSession, 'id' | 'created_at' | 'updated_at'>): Promise<LiveSession> {
    const id = `live-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const newLive: LiveSession = {
      id,
      ...live,
      created_at: now,
      updated_at: now
    };

    if (this.isPg && this.pool) {
      const sql = `INSERT INTO live_sessions (id, title, description, image_url, status, slug, start_date, end_date, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
      const res = await this.pool.query(sql, [id, live.title, live.description, live.image_url, live.status, live.slug, live.start_date, live.end_date, live.user_id]);
      return res.rows[0];
    } else {
      const data = this.readLocal();
      if (data.live_sessions.some((l: any) => l.slug === live.slug)) {
        throw new Error("Ce slug de boutique est déjà utilisé.");
      }
      data.live_sessions.push(newLive);
      this.writeLocal(data);
      return newLive;
    }
  }

  public async updateLiveSession(id: string, updates: Partial<LiveSession>): Promise<LiveSession> {
    if (this.isPg && this.pool) {
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const sql = `UPDATE live_sessions SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
      const res = await this.pool.query(sql, [id, ...values]);
      return res.rows[0];
    } else {
      const data = this.readLocal();
      const index = data.live_sessions.findIndex((l: any) => l.id === id);
      if (index === -1) throw new Error("Live non trouvé");
      const updated = {
        ...data.live_sessions[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      data.live_sessions[index] = updated;
      this.writeLocal(data);
      return updated;
    }
  }

  public async deleteLiveSession(id: string): Promise<void> {
    if (this.isPg && this.pool) {
      await this.pool.query(`DELETE FROM live_sessions WHERE id = $1`, [id]);
    } else {
      const data = this.readLocal();
      data.live_sessions = data.live_sessions.filter((l: any) => l.id !== id);
      data.live_products = data.live_products.filter((lp: any) => lp.live_session_id !== id);
      data.reservations = data.reservations.filter((r: any) => r.live_session_id !== id);
      data.audit_logs = data.audit_logs.filter((al: any) => al.live_session_id !== id);
      data.product_interests = data.product_interests.filter((pi: any) => pi.live_session_id !== id);
      this.writeLocal(data);
    }
  }

  public async createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    const id = `prod-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const newProduct: Product = {
      id,
      ...product,
      created_at: now,
      updated_at: now
    };

    if (this.isPg && this.pool) {
      const sql = `INSERT INTO products (id, name, description, price, stock, image_url, is_active, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
      const res = await this.pool.query(sql, [id, product.name, product.description, product.price, product.stock, product.image_url, product.is_active, product.user_id]);
      return res.rows[0];
    } else {
      const data = this.readLocal();
      data.products.push(newProduct);
      this.writeLocal(data);
      return newProduct;
    }
  }

  public async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    if (this.isPg && this.pool) {
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const sql = `UPDATE products SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
      const res = await this.pool.query(sql, [id, ...values]);
      return res.rows[0];
    } else {
      const data = this.readLocal();
      const index = data.products.findIndex((p: any) => p.id === id);
      if (index === -1) throw new Error("Produit non trouvé");
      const updated = {
        ...data.products[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      data.products[index] = updated;
      this.writeLocal(data);
      return updated;
    }
  }

  public async deleteProduct(id: string): Promise<void> {
    if (this.isPg && this.pool) {
      await this.pool.query(`DELETE FROM products WHERE id = $1`, [id]);
    } else {
      const data = this.readLocal();
      data.products = data.products.filter((p: any) => p.id !== id);
      data.live_products = data.live_products.filter((lp: any) => lp.product_id !== id);
      this.writeLocal(data);
    }
  }

  public async syncLiveProducts(liveSessionId: string, productIds: string[]): Promise<void> {
    if (this.isPg && this.pool) {
      await this.pool.query(`DELETE FROM live_products WHERE live_session_id = $1`, [liveSessionId]);
      for (const pId of productIds) {
        await this.pool.query(`INSERT INTO live_products (live_session_id, product_id) VALUES ($1, $2)`, [liveSessionId, pId]);
      }
    } else {
      const data = this.readLocal();
      data.live_products = data.live_products.filter((lp: any) => lp.live_session_id !== liveSessionId);
      productIds.forEach(pId => {
        data.live_products.push({
          live_session_id: liveSessionId,
          product_id: pId,
          created_at: new Date().toISOString()
        });
      });
      this.writeLocal(data);
    }
  }

  // ====================================================================
  // ATOMIC RESERVATION TRANSACTION (ANTI-OVERSELLING EXECUTOR)
  // ====================================================================
  public async executeAtomicReservation(visitorPseudo: string, whatsapp: string | undefined, productId: string, liveSessionId: string): Promise<Reservation> {
    if (this.isPg && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // 1. SELECT FOR UPDATE - Lock product row to prevent concurrency race conditions
        const productRes = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId]);
        if (productRes.rows.length === 0) {
          throw new Error('Produit inexistant.');
        }

        const product = productRes.rows[0];
        if (!product.is_active) {
          throw new Error('Ce produit est actuellement inactif.');
        }

        // 2. Strict stock check inside transactional lock
        if (product.stock <= 0) {
          throw new Error('Rupture de stock ! Réservation impossible.');
        }

        // 3. Decrement stock
        await client.query('UPDATE products SET stock = stock - 1, updated_at = NOW() WHERE id = $1', [productId]);

        // 4. Create reservation
        const resId = `res-${Math.random().toString(36).substr(2, 9)}`;
        const rQuery = `
          INSERT INTO reservations (id, visitor_pseudo, whatsapp, product_id, live_session_id, quantity)
          VALUES ($1, $2, $3, $4, $5, 1) RETURNING *
        `;
        const resRow = await client.query(rQuery, [resId, visitorPseudo, whatsapp, productId, liveSessionId]);

        // 5. Create audit log
        const logId = `log-${Math.random().toString(36).substr(2, 9)}`;
        await client.query(`
          INSERT INTO audit_logs (id, live_session_id, visitor_pseudo, action_type, product_name, details)
          VALUES ($1, $2, $3, 'reservation', $4, $5)
        `, [logId, liveSessionId, visitorPseudo, product.name, `Réservation d'une unité validée avec succès par transaction.`]);

        await client.query('COMMIT');
        return resRow.rows[0];
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      // Local Database Mutex Sync Simulation
      const data = this.readLocal();
      const product = data.products.find((p: any) => p.id === productId);

      if (!product) {
        throw new Error('Produit inexistant.');
      }
      if (!product.is_active) {
        throw new Error('Ce produit est actuellement inactif.');
      }
      if (product.stock <= 0) {
        throw new Error('Rupture de stock ! Réservation impossible.');
      }

      // Decrement stock
      product.stock -= 1;
      product.updated_at = new Date().toISOString();

      // Create reservation
      const newRes: Reservation = {
        id: `res-${Math.random().toString(36).substr(2, 9)}`,
        visitor_pseudo: visitorPseudo,
        whatsapp,
        product_id: productId,
        live_session_id: liveSessionId,
        quantity: 1,
        created_at: new Date().toISOString()
      };
      data.reservations.push(newRes);

      // Create log
      const newLog: AuditLog = {
        id: `log-${Math.random().toString(36).substr(2, 9)}`,
        live_session_id: liveSessionId,
        visitor_pseudo: visitorPseudo,
        action_type: 'reservation',
        product_name: product.name,
        details: `Réservation d'une unité validée en local. Nouveau stock : ${product.stock}`,
        created_at: new Date().toISOString()
      };
      data.audit_logs.push(newLog);

      this.writeLocal(data);
      return newRes;
    }
  }

  public async recordInterest(visitorPseudo: string, productId: string, liveSessionId: string): Promise<void> {
    if (this.isPg && this.pool) {
      const id = `int-${Math.random().toString(36).substr(2, 9)}`;
      await this.pool.query(`
        INSERT INTO product_interests (id, visitor_pseudo, product_id, live_session_id)
        VALUES ($1, $2, $3, $4)
      `, [id, visitorPseudo, productId, liveSessionId]);

      // Add log
      const productRes = await this.pool.query('SELECT name FROM products WHERE id = $1', [productId]);
      const prodName = productRes.rows[0]?.name || 'Produit';
      await this.pool.query(`
        INSERT INTO audit_logs (id, live_session_id, visitor_pseudo, action_type, product_name, details)
        VALUES ($1, $2, $3, 'interest', $4, $5)
      `, [`log-${Math.random().toString(36).substr(2, 9)}`, liveSessionId, visitorPseudo, prodName, `Intérêt marqué pour le produit.`]);
    } else {
      const data = this.readLocal();
      const product = data.products.find((p: any) => p.id === productId);
      const interest: ProductInterest = {
        id: `int-${Math.random().toString(36).substr(2, 9)}`,
        visitor_pseudo: visitorPseudo,
        product_id: productId,
        live_session_id: liveSessionId,
        created_at: new Date().toISOString()
      };
      data.product_interests.push(interest);

      // Add log
      const log: AuditLog = {
        id: `log-${Math.random().toString(36).substr(2, 9)}`,
        live_session_id: liveSessionId,
        visitor_pseudo: visitorPseudo,
        action_type: 'interest',
        product_name: product?.name || 'Produit',
        details: `Intérêt marqué en local.`,
        created_at: new Date().toISOString()
      };
      data.audit_logs.push(log);

      this.writeLocal(data);
    }
  }

  public async recordJoin(visitorPseudo: string, whatsapp: string | undefined, liveSessionId: string): Promise<void> {
    if (this.isPg && this.pool) {
      const id = `vs-${Math.random().toString(36).substr(2, 9)}`;
      await this.pool.query(`
        INSERT INTO visitor_sessions (id, pseudo, whatsapp, live_session_id)
        VALUES ($1, $2, $3, $4)
      `, [id, visitorPseudo, whatsapp, liveSessionId]);

      await this.pool.query(`
        INSERT INTO audit_logs (id, live_session_id, visitor_pseudo, action_type, details)
        VALUES ($1, $2, $3, 'join', $4)
      `, [`log-${Math.random().toString(36).substr(2, 9)}`, liveSessionId, visitorPseudo, 'Visiteur connecté au live.']);
    } else {
      const data = this.readLocal();
      const session: VisitorSession = {
        id: `vs-${Math.random().toString(36).substr(2, 9)}`,
        pseudo: visitorPseudo,
        whatsapp,
        live_session_id: liveSessionId,
        joined_at: new Date().toISOString()
      };
      data.visitor_sessions.push(session);

      const log: AuditLog = {
        id: `log-${Math.random().toString(36).substr(2, 9)}`,
        live_session_id: liveSessionId,
        visitor_pseudo: visitorPseudo,
        action_type: 'join',
        details: `Visiteur connecté en local.`,
        created_at: new Date().toISOString()
      };
      data.audit_logs.push(log);

      this.writeLocal(data);
    }
  }

  // Admin and stats lookups
  public async getAdminStats(): Promise<any> {
    if (this.isPg && this.pool) {
      const sellersRes = await this.pool.query("SELECT COUNT(*) FROM users WHERE role = 'SELLER'");
      const livesRes = await this.pool.query("SELECT COUNT(*) FROM live_sessions");
      const activeRes = await this.pool.query("SELECT COUNT(*) FROM live_sessions WHERE status IN ('ACTIVE', 'SOLD_OUT')");
      const resRes = await this.pool.query("SELECT COUNT(*) FROM reservations");
      const earningRes = await this.pool.query(`
        SELECT COALESCE(SUM(p.price * r.quantity), 0) as total_sales
        FROM reservations r
        JOIN products p ON r.product_id = p.id
      `);

      return {
        sellersCount: parseInt(sellersRes.rows[0].count),
        totalLivesCount: parseInt(livesRes.rows[0].count),
        activeLivesCount: parseInt(activeRes.rows[0].count),
        totalReservations: parseInt(resRes.rows[0].count),
        totalSales: parseFloat(earningRes.rows[0].total_sales || '0')
      };
    } else {
      const data = this.readLocal();
      const sellersCount = data.users.filter((u: any) => u.role === 'SELLER').length;
      const totalLivesCount = data.live_sessions.length;
      const activeLivesCount = data.live_sessions.filter((l: any) => l.status === 'ACTIVE' || l.status === 'SOLD_OUT').length;
      const totalReservations = data.reservations.length;

      const totalSales = data.reservations.reduce((sum: number, r: any) => {
        const prod = data.products.find((p: any) => p.id === r.product_id);
        return sum + (prod ? prod.price * r.quantity : 0);
      }, 0);

      return {
        sellersCount,
        totalLivesCount,
        activeLivesCount,
        totalReservations,
        totalSales
      };
    }
  }

  public async getSellerStats(userId: string): Promise<any> {
    if (this.isPg && this.pool) {
      const totalRes = await this.pool.query(`
        SELECT COUNT(*), COALESCE(SUM(p.price * r.quantity), 0) as total_earnings
        FROM reservations r
        JOIN products p ON r.product_id = p.id
        WHERE r.live_session_id IN (SELECT id FROM live_sessions WHERE user_id = $1)
      `, [userId]);

      const totalInt = await this.pool.query(`
        SELECT COUNT(*) FROM product_interests
        WHERE live_session_id IN (SELECT id FROM live_sessions WHERE user_id = $1)
      `, [userId]);

      return {
        totalReservationsCount: parseInt(totalRes.rows[0].count || '0'),
        totalEarnings: parseFloat(totalRes.rows[0].total_earnings || '0'),
        totalInterestsCount: parseInt(totalInt.rows[0].count || '0')
      };
    } else {
      const data = this.readLocal();
      const sellerLiveIds = data.live_sessions.filter((l: any) => l.user_id === userId).map((l: any) => l.id);
      
      const sellerRes = data.reservations.filter((r: any) => sellerLiveIds.includes(r.live_session_id));
      const totalReservationsCount = sellerRes.length;

      const totalEarnings = sellerRes.reduce((sum: number, r: any) => {
        const prod = data.products.find((p: any) => p.id === r.product_id);
        return sum + (prod ? prod.price * r.quantity : 0);
      }, 0);

      const totalInterestsCount = data.product_interests.filter((i: any) => sellerLiveIds.includes(i.live_session_id)).length;

      return {
        totalReservationsCount,
        totalEarnings,
        totalInterestsCount
      };
    }
  }
}

export const db = new DatabaseManager();

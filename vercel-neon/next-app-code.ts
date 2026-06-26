// ====================================================================
// ORION LIVE - NEXT.JS 15 READY-TO-USE SOURCE CODE BLUEPRINT
// This file gathers complete, production-ready source code for
// Next.js 15 App Router deployment with Prisma & Neon PostgreSQL.
// ====================================================================

// ==========================================
// 1. MIDDLEWARE: /middleware.ts
// ==========================================
/*
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose'; // Use jose in edge runtime for JWT validation

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('orion_auth_token')?.value;
  const { pathname } = request.nextUrl;

  // Protect seller dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    try {
      // Verify JWT token signature
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
      await jwtVerify(token, secret);
      return NextResponse.next();
    } catch (error) {
      console.error('JWT validation failed:', error);
      // Delete compromised cookie and redirect
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('orion_auth_token');
      return response;
    }
  }

  // Redirect authenticated users away from auth pages
  if ((pathname === '/login' || pathname === '/register') && token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
      await jwtVerify(token, secret);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } catch {
      // Token is invalid, let them access login/register
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
*/

// ==========================================
// 2. SELLER REGISTRATION: /app/api/auth/register/route.ts
// ==========================================
/*
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email({ message: "Adresse email invalide" }),
  password: z.string().min(6, { message: "Le mot de passe doit contenir au moins 6 caractères" }),
  name: z.string().min(2, { message: "Le nom doit contenir au moins 2 caractères" }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate inputs with Zod
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ 
        error: validation.error.errors[0].message 
      }, { status: 400 });
    }

    const { email, password, name } = validation.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ 
        error: "Cet email est déjà associé à un compte vendeur." 
      }, { status: 400 });
    }

    // Hash password with bcryptjs
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in Neon PostgreSQL
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: "Compte vendeur créé avec succès !",
      user 
    }, { status: 201 });

  } catch (error) {
    console.error("Register Error:", error);
    return NextResponse.json({ 
      error: "Une erreur interne est survenue lors de l'inscription." 
    }, { status: 500 });
  }
}
*/

// ==========================================
// 3. SELLER LOGIN: /app/api/auth/login/route.ts
// ==========================================
/*
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Champs invalides" }, { status: 400 });
    }

    const { email, password } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 400 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 400 });
    }

    // Generate JWT token (expires in 1 day)
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '1d' }
    );

    // Create HTTP-Only secure cookie response
    const response = NextResponse.json({ 
      success: true, 
      user: { id: user.id, email: user.email, name: user.name } 
    });

    response.cookies.set({
      name: 'orion_auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    return response;

  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json({ error: "Erreur serveur de connexion" }, { status: 500 });
  }
}
*/

// ==========================================
// 4. ATOMIC RESERVATIONS (ANTI-OVERSELL): /app/api/reservations/route.ts
// ==========================================
/*
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const reservationSchema = z.object({
  liveId: z.string().uuid(),
  productId: z.string().uuid(),
  pseudo: z.string().min(2).max(50),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const validation = reservationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Données de réservation invalides" }, { status: 400 });
    }

    const { liveId, productId, pseudo } = validation.data;

    // Execute ATOMIC transactional update and creation in Neon Postgres
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atomically decrement stock only if it is currently > 0
      // This prevents parallel race conditions where two threads read the same stock value.
      // Postgres automatically blocks secondary concurrent transactions trying to alter this row.
      const updatedProduct = await tx.product.update({
        where: { 
          id: productId,
          stock: { gt: 0 } // Stock Check Constraint
        },
        data: { 
          stock: { decrement: 1 } 
        }
      }).catch(() => {
        // Casts error if update fails because stock condition (stock > 0) is not met
        return null;
      });

      if (!updatedProduct) {
        throw new Error('OUT_OF_STOCK');
      }

      // 2. Register visitor session as active if not already done
      const visitor = await tx.visitorSession.create({
        data: {
          pseudo,
          liveSessionId: liveId
        }
      });

      // 3. Register the product reservation record
      const reservation = await tx.reservation.create({
        data: {
          visitorPseudo: pseudo,
          productId: productId,
          liveSessionId: liveId,
          quantity: 1,
        }
      });

      // 4. Append to Live real-time Audit logs
      const log = await tx.auditLog.create({
        data: {
          liveSessionId: liveId,
          visitorPseudo: pseudo,
          actionType: 'reservation',
          productName: updatedProduct.name
        }
      });

      return { product: updatedProduct, reservation };
    });

    return NextResponse.json({ 
      success: true, 
      message: "Félicitations, votre réservation est confirmée !",
      data: result 
    });

  } catch (error: any) {
    if (error.message === 'OUT_OF_STOCK') {
      return NextResponse.json({ 
        error: "Rupture de stock ! Désolé, ce produit n'est plus disponible." 
      }, { status: 409 }); // Conflict
    }

    console.error("Reservation transaction failed:", error);
    return NextResponse.json({ 
      error: "Une erreur est survenue lors du traitement de la réservation." 
    }, { status: 500 });
  }
}
*/

// ==========================================
// 5. VISITOR INTEREST DECLARATION: /app/api/interests/route.ts
// ==========================================
/*
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const interestSchema = z.object({
  liveId: z.string().uuid(),
  productId: z.string().uuid(),
  pseudo: z.string().min(2).max(50),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = interestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const { liveId, productId, pseudo } = validation.data;

    // Verify product exists and active
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || !product.isActive) {
      return NextResponse.json({ error: "Produit introuvable ou inactif" }, { status: 404 });
    }

    // Insert interest and append audit log
    const result = await prisma.$transaction(async (tx) => {
      const interest = await tx.productInterest.create({
        data: {
          visitorPseudo: pseudo,
          productId,
          liveSessionId: liveId,
        }
      });

      await tx.auditLog.create({
        data: {
          liveSessionId: liveId,
          visitorPseudo: pseudo,
          actionType: 'interest',
          productName: product.name,
        }
      });

      return interest;
    });

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error("Interest Error:", error);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement de l'intérêt" }, { status: 500 });
  }
}
*/

export const OrionLiveNextBlueprintInfo = "Ready-to-use Next.js 15 production endpoints.";

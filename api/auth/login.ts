// @ts-nocheck
import type { IncomingMessage, ServerResponse } from 'http';
import prisma from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'orion-live-secret-jwt-key-2026';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for security and preflight handling
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Veuillez saisir votre email et votre mot de passe." });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return res.status(400).json({ error: "Identifiants incorrects." });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: "Votre compte est suspendu par l'administrateur de la plateforme." });
    }

    const match = bcrypt.compareSync(password, user.passwordHash);
    if (!match) {
      return res.status(400).json({ error: "Identifiants incorrects." });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });

    // Write login audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: 'LOGIN',
        details: `L'utilisateur ${user.name} (${user.email}) s'est connecté au système (Vercel Function).`
      }
    });

    // Write cookie
    res.setHeader('Set-Cookie', `orion_session=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=86400`);

    return res.status(200).json({ 
      success: true, 
      user: { id: user.id, email: user.email, name: user.name, role: user.role } 
    });

  } catch (error: any) {
    console.error("Login Error:", error);
    return res.status(500).json({ error: "Erreur serveur de connexion." });
  }
}

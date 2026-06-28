// @ts-nocheck
import type { IncomingMessage, ServerResponse } from 'http';
import prisma from '../../lib/prisma';
import bcrypt from 'bcryptjs';

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
    const { email, password, confirmPassword, name } = req.body || {};

    if (!email || !password || !confirmPassword || !name) {
      return res.status(400).json({ error: "Veuillez remplir tous les champs obligatoires." });
    }

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    
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

    if (password.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
    }
    
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins une lettre et au moins un chiffre." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "La confirmation du mot de passe ne correspond pas." });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Cet email est déjà enregistré." });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        name,
        role: 'SELLER',
        status: 'ACTIVE'
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      }
    });

    return res.status(201).json({ 
      success: true, 
      user 
    });

  } catch (error: any) {
    console.error("Register Error:", error);
    return res.status(500).json({ 
      error: error.message || "Une erreur interne est survenue lors de l'inscription." 
    });
  }
}

# Guide de Déploiement & d'Installation Orion Live MVP

Orion Live est une plateforme de Live Commerce conçue pour aider les vendeurs en direct (TikTok Live, Facebook Live, Instagram Live) à proposer une boutique éphémère synchronisée en temps réel avec leur diffusion.

Ce guide décrit l'architecture technique, les mesures de sécurité et les étapes de déploiement de l'application sur **Vercel** avec une base de données **Neon PostgreSQL** et **Prisma ORM**.

---

## 🛠️ Architecture du Projet Next.js 15

Une fois déployée dans sa structure Next.js App Router finale, l'application est structurée comme suit :

```text
├── app/
│   ├── layout.tsx                # Layout principal, imports CSS et Contextes
│   ├── page.tsx                  # Landing page (Présentation + Connexion/Inscription Vendeur)
│   ├── middleware.ts             # Middleware de protection des routes API et Dashboard
│   ├── dashboard/                # Tableau de bord vendeur
│   │   └── page.tsx              # Gestion des Lives, Produits, Liaisons et Statistiques live
│   ├── live/[slug]/              # Boutique publique éphémère (expérience visiteurs)
│   │   └── page.tsx              # Identification par pseudo anonyme + Catalogue interactif
│   └── api/                      # Routes d'API sécurisées
│       ├── auth/
│       │   ├── register/route.ts # Inscription vendeur (Hashage bcrypt + JWT)
│       │   ├── login/route.ts    # Connexion vendeur (Génération JWT Cookie HTTP-only)
│       │   └── logout/route.ts   # Déconnexion (Suppression cookie JWT)
│       ├── lives/
│       │   ├── route.ts          # CRUD Lives vendeur (Requêtes préparées Prisma)
│       │   └── [slug]/route.ts   # Données publiques du Live et statistiques
│       ├── products/
│       │   └── route.ts          # CRUD Produits vendeur
│       ├── interests/
│       │   └── route.ts          # Déclaration d'intérêt visiteur -> Audit log
│       └── reservations/
│           └── route.ts          # Réservation de produit (Transaction atomique anti-survente)
├── prisma/
│   └── schema.prisma             # Modèle relationnel PostgreSQL (Prisma Schema)
├── public/                       # Actifs statiques et images
├── package.json                  # Dépendances et scripts de build
└── tsconfig.json                 # Configurations TypeScript
```

---

## ⚡ Étape 1 : Initialisation de Neon PostgreSQL & Import SQL

1. Créez un compte gratuit sur [Neon.tech](https://neon.tech/).
2. Créez un nouveau projet PostgreSQL (nommé par exemple `orion-live-db`).
3. Récupérez la **Connection String** fournie (ex: `postgresql://neondb_owner:...@ep-young-water-....pooler.us-east-2.neon.tech/neondb?sslmode=require`).
4. Allez dans l'onglet **SQL Editor** de la console Neon, collez le contenu du fichier `schema.sql` et exécutez-le pour créer instantanément vos tables, clés étrangères, index optimisés et triggers de timestamps.

---

## 🏗️ Étape 2 : Configuration du projet local Next.js

1. Installez les dépendances requises dans votre projet Next.js 15 :
   ```bash
   npm install @prisma/client bcryptjs jsonwebtoken zod
   npm install -D prisma @types/bcryptjs @types/jsonwebtoken
   ```

2. Créez un fichier `.env` à la racine de votre projet et configurez-y les variables d'environnement suivantes :
   ```env
   # Chaîne de connexion Neon PostgreSQL (Directement fournie par Neon)
   DATABASE_URL="postgresql://user:password@ep-host.pooler.us-east-2.neon.tech/neondb?sslmode=require"
   
   # Clé secrète pour signer les jetons d'authentification JWT
   JWT_SECRET="votre_super_secret_aleatoire_et_long_orion_live_2026"
   
   # URL de l'application (Pour Vercel, elle est injectée automatiquement, sinon locale)
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

3. Initialisez Prisma et générez le client :
   ```bash
   npx prisma generate
   ```

---

## 🔒 Focus Sécurité : Prévention de la Survente (Mises à jour Atomiques)

Pour éviter que deux clients ne réservent simultanément le dernier article en stock (condition de concurrence / race condition), Orion Live utilise une **transaction de verrouillage et de mise à jour atomique**. 

Dans la route API `/api/reservations/route.ts`, le stock n'est pas lu puis ré-écrit de manière disjointe. Nous utilisons plutôt un garde d'intégrité SQL au niveau du moteur PostgreSQL :

```typescript
// Exemple de transaction Prisma pour décrémenter le stock de manière atomique et sûre
const updatedProduct = await prisma.$transaction(async (tx) => {
  // 1. Décrémentation conditionnelle : PostgreSQL assure l'atomicité
  // Nous ne permettons la décrémentation que si le stock actuel est strictement supérieur à 0.
  const product = await tx.product.update({
    where: { 
      id: productId,
      stock: { gt: 0 } // Garde-fou d'intégrité : empêche d'aller sous 0 !
    },
    data: { 
      stock: { decrement: 1 } 
    }
  });

  // 2. Si la mise à jour réussit, nous enregistrons la réservation
  const reservation = await tx.reservation.create({
    data: {
      visitorPseudo: pseudo,
      productId: productId,
      liveSessionId: liveId,
      quantity: 1
    }
  });

  // 3. Enregistrement dans le journal d'audit du live pour le dashboard temps réel
  await tx.auditLog.create({
    data: {
      liveSessionId: liveId,
      visitorPseudo: pseudo,
      actionType: 'reservation',
      productName: product.name
    }
  });

  return { product, reservation };
});
```

*Si le stock tombe à 0, la contrainte `stock: { gt: 0 }` échouera, Prisma lèvera une exception de ciblage, et la transaction sera automatiquement annulée (ROLLBACK), évitant toute survente.*

---

## 🚀 Étape 3 : Déploiement sur Vercel

1. Installez la CLI Vercel (facultatif si vous passez par l'interface web GitHub) :
   ```bash
   npm install -g vercel
   ```

2. Associez votre dépôt GitHub à votre projet Vercel :
   - Rendez-vous sur [Vercel Dashboard](https://vercel.com).
   - Cliquez sur **Add New > Project** et importez votre dépôt Git.
   
3. **Configurez les variables d'environnement** dans l'onglet de configuration Vercel avant le build :
   - `DATABASE_URL` (votre lien de connexion Neon)
   - `JWT_SECRET` (votre clé secrète JWT)
   - `NEXT_PUBLIC_APP_URL` (votre URL de projet Vercel)

4. Ajoutez les commandes de build adaptées dans votre `package.json` ou dans les paramètres Vercel pour générer le client Prisma automatiquement avant la compilation :
   ```json
   "scripts": {
     "build": "prisma generate && next build",
     "start": "next start"
   }
   ```

5. Déployez !
   ```bash
   vercel --prod
   ```

---

## 🛡️ Bonnes Pratiques de Sécurité Implémentées

1. **Hashage Bcrypt :** Les mots de passe vendeurs ne sont jamais stockés en clair. Ils sont hashés avec un sel fort lors de l'inscription via `bcryptjs.hash()`.
2. **Cookies HTTP-Only :** Les jetons JWT sont stockés dans des cookies configurés avec `httpOnly: true`, `secure: true`, et `sameSite: "strict"`. Cela les protège entièrement contre les attaques de type XSS (Cross-Site Scripting).
3. **Protection CSRF :** Utilisation de l'en-tête de validation CORS et du blocage automatique des requêtes non authentifiées.
4. **Validation Zod :** Toutes les données d'entrée (formulaires d'inscription, de création de produits, de réservation) sont validées à l'aide de schemas Zod stricts côté client ET côté serveur.
5. **Désactivation d'inscription anonyme sur le Dashboard :** Le middleware de sécurité filtre systématiquement les requêtes vers `/dashboard` pour interdire l'accès à toute personne ne possédant pas un jeton JWT valide.

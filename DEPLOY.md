# GUIDE DE DÉPLOIEMENT : ORION LIVE (NEXT.JS 15 + NEON POSTGRESQL + PRISMA)

Ce document décrit les étapes pour déployer l'application **Orion Live** en production sur **Vercel** avec une base de données **Neon PostgreSQL**.

---

## 🚀 1. Configuration de la Base de Données sur Neon.tech

1. Rendez-vous sur [Neon.tech](https://neon.tech/) et créez un compte gratuit si ce n'est pas déjà fait.
2. Créez un nouveau projet nommé `orion-live`.
3. Une fois le projet créé, Neon va vous générer une chaîne de connexion (Connection String). Récupérez l'URL sous la forme :
   `postgres://[user]:[password]@[host]/[dbname]?sslmode=require`
4. Allez dans l'onglet **SQL Editor** de Neon et exécutez le script SQL présent dans `/vercel-neon/schema.sql` pour initialiser directement toutes les tables, index, contraintes de clés étrangères, triggers et contraintes d'intégrité (notamment la vérification des 24h et les clés d'indexation).

---

## 🛠️ 2. Configuration Locale (Développement)

Pour connecter l'ORM Prisma à votre instance Neon localement :

1. Créez un fichier `.env` à la racine de votre projet.
2. Ajoutez votre chaîne de connexion Neon dans la variable d'environnement :
   ```env
   DATABASE_URL="postgres://[user]:[password]@[host]/neondb?sslmode=require"
   JWT_SECRET="choisissez_un_secret_tres_fort_pour_orion"
   ```
3. Exécutez la commande suivante pour synchroniser le schéma Prisma avec Neon :
   ```bash
   npx prisma db push
   ```
   *(Alternative : utilisez les migrations si vous préférez un historique strict)*
   ```bash
   npx prisma migrate dev --name init
   ```

---

## 🌐 3. Déploiement de l'API & du Frontend sur Vercel

1. **Préparez votre dépôt Git** (GitHub, GitLab, ou Bitbucket) et poussez le code d'Orion Live.
2. Connectez-vous sur [Vercel](https://vercel.com/) et cliquez sur **Add New > Project**.
3. Importez votre dépôt `orion-live`.
4. Dans l'étape de configuration du projet, déroulez la section **Environment Variables** et ajoutez les variables suivantes :
   * `DATABASE_URL` : (Copiez-collez votre chaîne de connexion Neon récupérée à l'étape 1)
   * `JWT_SECRET` : Une chaîne de caractères aléatoire et sécurisée pour chiffrer les sessions/cookies de connexion.
   * `NEXT_PUBLIC_APP_URL` : L'URL de votre site de production (ex. `https://orion.live` ou l'URL fournie par Vercel).
5. Dans les paramètres de Build & Development, laissez les options par défaut :
   * **Framework Preset** : `Next.js`
   * **Build Command** : `npm run build` ou `next build` (Vercel va automatiquement exécuter le générateur Prisma pendant cette phase grâce au script du `package.json`).
6. Cliquez sur **Deploy**. Votre SaaS Orion Live est en ligne en quelques secondes !

---

## 🛡️ 4. Règles Métiers & Sécurité Implémentées

* **Limite stricte des 24 heures** : Gérée nativement au niveau de l'API de création/réactivation de live et renforcée par une contrainte de vérification SQL (`chk_live_duration_24h`) pour garantir l'intégrité absolue.
* **Anti-survente (Atomicité)** : Implémenté via des transactions d'isolement au niveau de Prisma (avec verrous ou opérations SQL directes) pour empêcher toute réservation simultanée de faire descendre le stock en dessous de zéro.
* **Fermeture Automatique** : Les boutiques dont la date d'expiration est dépassée voient leur statut passer à `INACTIVE` dans l'API et retournent une erreur d'accès au public sans supprimer de données.
* **Protection XSS & rate-limiting** : Validation rigoureuse par schéma `Zod` sur toutes les routes d'API entrantes.

# Guide de Déploiement Railway - Orion Live

Ce guide explique comment déployer Orion Live avec une architecture séparée :
- **Backend Express** sur Railway
- **Frontend React/Vite** sur Vercel
- **Base de données PostgreSQL** sur Neon

---

## 📋 Prérequis

- Compte Railway (https://railway.app)
- Compte Vercel (https://vercel.com)
- Compte Neon (https://neon.tech)
- Dépôt Git (GitHub, GitLab, ou Bitbucket)

---

## 🚀 Étape 1 : Configuration de la Base de Données Neon

1. **Créer un projet Neon**
   - Connectez-vous sur https://neon.tech
   - Cliquez sur "New Project"
   - Nommez-le `orion-live-db`
   - Sélectionnez la région la plus proche de vos utilisateurs

2. **Récupérer la chaîne de connexion**
   - Une fois le projet créé, copiez la "Connection String"
   - Format : `postgresql://user:password@ep-xxx.pooler.supabase.com/neondb?sslmode=require`

3. **Initialiser le schéma Prisma**
   - Allez dans l'onglet "SQL Editor" de Neon
   - Exécutez la commande suivante pour synchroniser le schéma :
   ```bash
   npx prisma db push
   ```
   - Ou utilisez les migrations :
   ```bash
   npx prisma migrate dev --name init
   ```

---

## 🚂 Étape 2 : Déploiement du Backend sur Railway

### 2.1 Créer un nouveau projet Railway

1. Connectez-vous sur https://railway.app
2. Cliquez sur "New Project"
3. Sélectionnez "Deploy from GitHub repo"
4. Autorisez Railway à accéder à votre dépôt
5. Sélectionnez le dépôt `orion-live`

### 2.2 Configurer les variables d'environnement Railway

Dans le tableau de bord Railway, allez dans l'onglet "Variables" et ajoutez :

```env
DATABASE_URL=postgresql://user:password@ep-xxx.pooler.supabase.com/neondb?sslmode=require
JWT_SECRET=votre_secret_jwt_tres_sec_aleatoire_2026
FRONTEND_URL=https://orion-live.vercel.app
PORT=3000
NODE_ENV=production
```

**Important :**
- `DATABASE_URL` : Collez votre chaîne de connexion Neon
- `JWT_SECRET` : Générez une chaîne aléatoire forte (ex: `openssl rand -base64 32`)
- `FRONTEND_URL` : URL de votre frontend Vercel (sera configurée à l'étape 3)

### 2.3 Configurer le build et le démarrage

Railway détectera automatiquement la configuration Node.js. Vérifiez que :

- **Build Command** : `npm run build`
- **Start Command** : `npm start`

Ces commandes sont déjà définies dans `package.json` et `railway.json`.

### 2.4 Déployer

1. Cliquez sur "Deploy"
2. Attendez que le build se termine
3. Une fois déployé, Railway vous fournira une URL du type : `https://orion-live-backend.up.railway.app`

**Notez cette URL** - vous en aurez besoin pour la configuration Vercel.

---

## 🌐 Étape 3 : Déploiement du Frontend sur Vercel

### 3.1 Configurer les variables d'environnement Vercel

1. Connectez-vous sur https://vercel.com
2. Importez votre dépôt GitHub
3. Dans les paramètres du projet, allez dans "Settings" → "Environment Variables"
4. Ajoutez :

```env
VITE_API_URL=https://orion-live-backend.up.railway.app
VITE_APP_URL=https://orion-live.vercel.app
```

**Important :**
- `VITE_API_URL` : URL de votre backend Railway (depuis l'étape 2.4)
- `VITE_APP_URL` : Sera automatiquement définie par Vercel après le premier déploiement

### 3.2 Configurer le build Vercel

Dans les paramètres du projet Vercel :

- **Framework Preset** : Vite
- **Build Command** : `npm run build` (automatique)
- **Output Directory** : `dist` (automatique)

### 3.3 Déployer

1. Cliquez sur "Deploy"
2. Attendez que le build se termine
3. Une fois déployé, Vercel vous fournira une URL du type : `https://orion-live.vercel.app`

---

## 🔗 Étape 4 : Mettre à jour la configuration CORS

Maintenant que vous avez les URLs finales :

1. **Retournez sur Railway**
2. Mettez à jour la variable `FRONTEND_URL` avec l'URL Vercel finale
3. Redéployez le backend Railway

---

## ✅ Étape 5 : Vérification du déploiement

### 5.1 Tester le backend

Visitez : `https://orion-live-backend.up.railway.app/api/public/lives`

Vous devriez voir un JSON avec les lives publics (ou un tableau vide).

### 5.2 Tester le frontend

Visitez : `https://orion-live.vercel.app`

Vous devriez voir la page d'accueil d'Orion Live.

### 5.3 Tester l'authentification

1. Créez un compte vendeur sur le frontend
2. Connectez-vous
3. Vérifiez que vous accédez au dashboard

---

## 🔧 Maintenance

### Mises à jour du backend

1. Pushez vos changements sur GitHub
2. Railway déploiera automatiquement
3. Vérifiez les logs dans le tableau de bord Railway

### Mises à jour du frontend

1. Pussez vos changements sur GitHub
2. Vercel déploiera automatiquement
3. Vérifiez les logs dans le tableau de bord Vercel

### Mises à jour de la base de données

Pour modifier le schéma Prisma :

```bash
# En local
npx prisma migrate dev --name nom_de_la_migration

# Puis pussez les changements
git add prisma/migrations
git commit -m "Update database schema"
git push
```

---

## 📊 Monitoring

### Railway

- **Logs** : Consultez les logs en temps réel dans l'onglet "Logs"
- **Metrics** : CPU, mémoire, et réseau dans l'onglet "Metrics"
- **Health Checks** : Configuré sur `/api/public/lives` dans `railway.json`

### Vercel

- **Logs** : Consultez les logs dans l'onglet "Logs"
- **Analytics** : Visiteurs, performance, et erreurs dans l'onglet "Analytics"

---

## 🚨 Dépannage

### Erreur 503 - Base de données inaccessible

**Cause** : `DATABASE_URL` incorrect ou Neon inaccessible

**Solution** :
1. Vérifiez la variable `DATABASE_URL` dans Railway
2. Vérifiez que votre projet Neon est actif
3. Consultez les logs Railway pour plus de détails

### Erreur CORS

**Cause** : `FRONTEND_URL` incorrect dans Railway

**Solution** :
1. Vérifiez que `FRONTEND_URL` correspond exactement à l'URL Vercel
2. Incluez le protocole (https://) et pas de slash final
3. Redéployez le backend Railway

### Erreur 404 sur les routes API

**Cause** : Backend Railway non accessible

**Solution** :
1. Vérifiez que le backend Railway est en cours d'exécution
2. Testez directement l'URL Railway dans le navigateur
3. Consultez les logs Railway

### Frontend ne se connecte pas au backend

**Cause** : `VITE_API_URL` incorrect dans Vercel

**Solution** :
1. Vérifiez la variable `VITE_API_URL` dans Vercel
2. Assurez-vous qu'elle pointe vers l'URL Railway correcte
3. Redéployez le frontend Vercel

---

## 💰 Coûts estimés

### Railway (Backend)
- **Plan Hobby** : ~$5/mois (512 Mo RAM, 0.5 vCPU)
- **Plan Pro** : ~$20/mois (1 Go RAM, 1 vCPU)

### Vercel (Frontend)
- **Plan Hobby** : Gratuit (jusqu'à 100 Go bandwidth/mois)
- **Plan Pro** : $20/mois (bandwidth illimitée)

### Neon (Base de données)
- **Plan Free** : Gratuit (0.5 Go storage, 300 hours compute/mois)
- **Plan Scale** : ~$19/mois (8 Go storage, compute illimité)

**Total estimé (plan Hobby)** : ~$5/mois
**Total estimé (plan Pro)** : ~$39/mois

---

## 📝 Résumé de l'architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Vercel        │         │    Railway      │         │     Neon        │
│   (Frontend)    │────────┤   (Backend)     │────────┤  (PostgreSQL)   │
│   React/Vite    │  HTTPS  │   Express       │  TCP    │                 │
│                 │         │                 │         │                 │
│ VITE_API_URL   │────────→│  CORS Config    │         │ DATABASE_URL    │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

- **Frontend Vercel** : Sert les fichiers statiques React
- **Backend Railway** : API Express avec Prisma
- **Neon** : Base de données PostgreSQL serverless

---

## 🎉 Conclusion

Votre application Orion Live est maintenant déployée avec une architecture scalable et moderne :

- ✅ Backend Express sur Railway
- ✅ Frontend React/Vite sur Vercel
- ✅ Base de données PostgreSQL sur Neon
- ✅ CORS configuré pour la communication cross-origin
- ✅ Variables d'environnement centralisées
- ✅ Health checks configurés

Pour toute question ou problème, consultez les sections de dépannage ci-dessus ou les documentations officielles :
- Railway : https://docs.railway.app
- Vercel : https://vercel.com/docs
- Neon : https://neon.tech/docs

# Orion Live

Plateforme de live commerce interactive permettant aux vendeurs de créer des sessions de vente en direct et aux visiteurs d'interagir en temps réel.

## 🌟 Fonctionnalités

### Pour les Vendeurs
- **Gestion de Lives** : Créer, modifier et activer/désactiver des sessions live
- **Catalogue Produits** : Gérer l'inventaire avec images, prix et stocks
- **Dashboard Analytics** : Statistiques en temps réel (visiteurs, intérêts, réservations)
- **Hot Prospects** : Identification des visiteurs les plus engagés
- **Produits Populaires** : Analyse des produits les plus demandés

### Pour les Visiteurs
- **Accès Public** : Rejoindre un live via un slug unique
- **Intérêt Produits** : Marquer son intérêt pour un produit
- **Réservations** : Réserver des produits pendant le live
- **Contact Vendeur** : Demander à être contacté via WhatsApp
- **Notifications** : Recevoir des alertes en temps réel

### Pour les Administrateurs
- **Gestion Utilisateurs** : Gérer les rôles (ADMIN/SELLER)
- **Surveillance Vendeurs** : Activer/suspendre les comptes vendeurs
- **Gestion Boutiques** : Activer/désactiver les boutiques
- **Audit Logs** : Traçabilité complète des actions
- **Monitoring Live** : Vue d'ensemble des sessions actives
- **Recommandations Croisées** : Moteur de recommandation entre vendeurs

## 🛠 Stack Technique

### Frontend
- **React 19** - Framework UI
- **Vite** - Build tool et dev server
- **TypeScript** - Typage statique
- **TailwindCSS** - Styling
- **Motion** - Animations
- **Recharts** - Graphiques et analytics
- **Lucide React** - Icônes

### Backend
- **Express** - Serveur API
- **TypeScript** - Typage statique
- **Prisma** - ORM pour PostgreSQL
- **bcryptjs** - Hashage des mots de passe
- **jsonwebtoken** - Authentification JWT
- **cookie-parser** - Gestion des cookies
- **cors** - Configuration CORS

### Base de Données
- **PostgreSQL** - Base de données relationnelle (hébergée sur Neon)

### Déploiement
- **Railway** - Backend Express
- **Vercel** - Frontend React/Vite
- **Neon** - PostgreSQL serverless

## 📦 Installation

### Prérequis
- Node.js 18+
- npm ou yarn
- Compte Neon (pour la base de données)

### Étapes

1. **Cloner le dépôt**
   ```bash
   git clone https://github.com/votre-username/orion-live.git
   cd orion-live
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer les variables d'environnement**
   ```bash
   cp .env.example .env
   ```
   
   Éditez `.env` et configurez :
   ```env
   DATABASE_URL=postgresql://user:password@host/db?sslmode=require
   JWT_SECRET=votre_secret_jwt
   FRONTEND_URL=http://localhost:3000
   PORT=3000
   NODE_ENV=development
   VITE_API_URL=http://localhost:3000
   VITE_APP_URL=http://localhost:3000
   ```

4. **Initialiser Prisma**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Lancer le serveur de développement**
   ```bash
   npm run dev
   ```

L'application sera accessible sur `http://localhost:3000`

## 🚀 Déploiement en Production

Pour déployer Orion Live en production avec l'architecture séparée (Railway + Vercel + Neon), consultez le guide détaillé :

**[RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)**

### Architecture de Production

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Vercel        │         │    Railway      │         │     Neon        │
│   (Frontend)    │────────┤   (Backend)     │────────┤  (PostgreSQL)   │
│   React/Vite    │  HTTPS  │   Express       │  TCP    │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

## 📁 Structure du Projet

```
orion-live/
├── src/
│   ├── App.tsx              # Application React principale
│   ├── assets/              # Images et ressources statiques
│   └── lib/                 # Utilitaires (api.ts pour fetch centralisé)
├── lib/
│   └── prisma.ts            # Singleton PrismaClient
├── prisma/
│   └── schema.prisma        # Schéma de la base de données
├── server.ts                # Serveur Express principal
├── api/
│   └── server.ts            # Entry point Vercel (legacy)
├── package.json             # Dépendances et scripts
├── vite.config.ts           # Configuration Vite
├── tsconfig.json            # Configuration TypeScript
├── railway.json             # Configuration Railway
├── .env.example             # Exemple de variables d'environnement
├── RAILWAY_DEPLOYMENT.md    # Guide de déploiement Railway
└── README.md                # Ce fichier
```

## 🔐 Sécurité

- **Authentification JWT** : Tokens sécurisés avec expiration
- **Hashage bcrypt** : Mots de passe hachés avec bcryptjs
- **CORS configuré** : Origines autorisées via FRONTEND_URL
- **Validation des entrées** : Vérification côté serveur
- **Audit Logs** : Traçabilité des actions administrateur

## 📊 Modèles de Données

### Principaux modèles Prisma
- **User** : Utilisateurs (ADMIN/SELLER)
- **LiveSession** : Sessions live avec statuts
- **Product** : Catalogue produits
- **LiveProduct** : Association live-produits
- **Visitor** : Visiteurs anonymes
- **VisitorAction** : Actions des visiteurs (intérêt, réservation)
- **Reservation** : Réservations de produits
- **AuditLog** : Journal d'audit
- **SystemConfig** : Configuration système

## 🧪 Scripts Disponibles

```bash
# Développement
npm run dev          # Lance le serveur de développement

# Build
npm run build        # Build frontend + backend + prisma generate
npm run postinstall  # Génère le client Prisma

# Production
npm start            # Lance le serveur de production

# Utilitaires
npm run clean        # Nettoie les fichiers build
npm run lint         # Vérifie le TypeScript
```

## 🤝 Contribution

Les contributions sont les bienvenues ! Voici comment contribuer :

1. Fork le projet
2. Créez une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📝 Licence

Ce projet est sous licence propriétaire. Tous droits réservés.

## 📞 Support

Pour toute question ou problème :
- Consultez le guide de déploiement : [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)
- Ouvrez une issue sur GitHub

## 🎯 Roadmap

- [ ] Intégration streaming vidéo réel
- [ ] Notifications push pour les visiteurs
- [ ] Analytics avancés avec export
- [ ] Multi-langues (i18n)
- [ ] Application mobile PWA
- [ ] Intégration paiements en ligne


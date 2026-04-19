# 📱 Sport Calendar – Version Web (PWA)

Plus besoin de compiler un APK. Cette version s'héberge gratuitement en ligne et s'installe sur votre tablette **comme une vraie app** en 10 secondes depuis le navigateur.

---

## 🎯 Vue d'ensemble du fonctionnement

1. Vous mettez le code sur GitHub (1 fois)
2. Netlify compile et héberge le site automatiquement
3. Vous obtenez une URL du type `https://sport-calendar-vous.netlify.app`
4. Sur la tablette, vous ouvrez cette URL dans Chrome et faites « Installer l'application »
5. Une icône apparaît sur l'écran d'accueil, l'app s'ouvre en plein écran sans barre de navigateur
6. Elle fonctionne **hors ligne**, envoie des **notifications**, garde vos préférences

Durée totale : **~15 minutes**, tout depuis votre ordinateur puis la tablette.

---

## 📋 Étape 1 — Créer un compte GitHub (si pas déjà fait)

1. Allez sur **https://github.com/signup**
2. Créez un compte gratuit
3. Confirmez votre email

## 📂 Étape 2 — Créer votre dépôt GitHub

1. En haut à droite → **+** → **New repository**
2. Nom : `sport-calendar`
3. **Public** coché
4. Ne cochez aucune case en dessous
5. **Create repository**

## ⬆️ Étape 3 — Uploader le code

Sur la page de votre nouveau dépôt vide, vous voyez un lien :

> « uploading an existing file »

1. Cliquez dessus
2. **Décompressez le zip** sur votre ordinateur
3. Dans la fenêtre GitHub, **glissez-déposez tout le contenu** du dossier décompressé (le contenu, pas le dossier — donc `src/`, `public/`, `package.json`, etc.)
4. Attendez la fin de l'upload
5. En bas : tapez « Version initiale » et cliquez sur **Commit changes**

---

## 🚀 Étape 4 — Connecter Netlify (3 minutes)

C'est Netlify qui va compiler votre code et l'héberger gratuitement.

1. Allez sur **https://app.netlify.com/signup**
2. Cliquez sur **Sign up with GitHub** (connexion avec votre compte GitHub — plus simple)
3. Autorisez Netlify
4. Une fois connecté, cliquez sur **Add new site** → **Import an existing project**
5. Choisissez **GitHub**
6. Autorisez Netlify à accéder à vos dépôts si demandé
7. Dans la liste, sélectionnez votre dépôt **sport-calendar**
8. Netlify détecte automatiquement la configuration :
   - Build command : `npm run build` ✅
   - Publish directory : `dist` ✅
9. Cliquez sur **Deploy sport-calendar**

☕ Attendez 2-3 minutes. Vous verrez « Site deploy in progress » puis « Published ».

Une URL est générée, du type : `https://tournesol-magique-123abc.netlify.app`

## 🎨 Étape 5 — Personnaliser l'URL (optionnel, 1 min)

Par défaut le nom est aléatoire. Pour le changer :
1. Sur Netlify, cliquez sur **Site configuration** → **Change site name**
2. Entrez par exemple `mon-sport-calendar`
3. Votre URL devient `https://mon-sport-calendar.netlify.app`

---

## 📲 Étape 6 — Installer sur votre tablette (30 secondes)

### Sur Android (Chrome)

1. Ouvrez **Chrome** sur la tablette
2. Tapez votre URL Netlify (`https://mon-sport-calendar.netlify.app`)
3. L'application se charge
4. Appuyez sur le **menu ⋮** (en haut à droite de Chrome)
5. Appuyez sur **Installer l'application** (ou **Ajouter à l'écran d'accueil**)
6. Confirmez **Installer**
7. Une icône « Sport Calendar » apparaît sur votre écran d'accueil 🎉
8. Appuyez dessus : l'app s'ouvre **en plein écran, sans barre Chrome**

### Sur iPad (Safari)

1. Ouvrez **Safari** sur la tablette
2. Tapez votre URL
3. Appuyez sur le bouton **Partager** (carré avec flèche vers le haut)
4. Descendez et choisissez **Sur l'écran d'accueil**
5. Confirmez **Ajouter**

---

## 🔔 Étape 7 — Activer les notifications

Une fois l'app installée et ouverte :
1. Allez dans **Réglages** (dernière icône de la barre)
2. Section **Notifications** → bouton **Tester une notification**
3. Android/iPadOS vous demande d'autoriser → **Autoriser**
4. Une notification de test apparaît 🔔

Les notifications fonctionnent ensuite automatiquement avant chaque match planifié.

---

## 🔄 Pour mettre à jour plus tard

Changer quelque chose ? Il suffit d'éditer le fichier sur GitHub :
1. Sur GitHub, naviguez jusqu'au fichier
2. Icône crayon → modifier → **Commit changes**
3. Netlify détecte le changement et **recompile automatiquement** (~2 min)
4. **Sur la tablette, fermez et rouvrez l'app** — la nouvelle version se charge toute seule

Aucune réinstallation nécessaire, c'est un des gros avantages de la PWA.

---

## ✨ Fonctionnalités disponibles

- ✅ **25 sports et esports** (football, NBA, F1, LoL, Valorant, CS2, etc.)
- ✅ **Calendrier mensuel** avec points colorés selon l'importance
- ✅ **Code couleur Tier** : S (rouge/doré), A (orange), B (bleu), C (gris)
- ✅ **Filtres dynamiques** par sport, tier, recherche texte
- ✅ **Écran À venir** : 14 prochains jours groupés
- ✅ **Écran Live** avec rafraîchissement auto
- ✅ **Favoris** : marquer équipes et ligues
- ✅ **Notifications** avant chaque match (5min à 1 jour)
- ✅ **Ajout Google Calendar** en un clic (ouvre l'app Google Calendar)
- ✅ **Mode hors ligne** : cache local de tous les événements
- ✅ **Thème clair/sombre/auto**
- ✅ **Layout tablette** : barre latérale + calendrier 2 colonnes
- ✅ **Données de démonstration** pré-chargées pour tester immédiatement

---

## 🔧 Utilisation avancée (facultatif)

### Activer les vraies données esport (PandaScore)

Par défaut, l'app utilise TheSportsDB (sports) + des données de démo pour l'esport.
Pour récupérer les vrais matches esport en temps réel :

1. Créez un compte gratuit sur **https://pandascore.co**
2. Obtenez votre clé API
3. Sur GitHub, ouvrez `src/services/esportsProvider.ts`
4. Remplacez `const PANDA_API_KEY: string = ''` par votre clé
5. Commit → Netlify recompile → nouveau déploiement

### Raccourci : ouvrir l'app depuis un bookmark

Si l'installation PWA ne fonctionne pas sur votre tablette, vous pouvez simplement :
1. Ouvrir l'URL dans le navigateur
2. Menu → **Ajouter aux favoris**
3. Créer un raccourci du favori sur l'écran d'accueil

L'app fonctionnera, mais dans le navigateur plutôt qu'en plein écran.

---

## ❓ Problèmes fréquents

### Le build Netlify échoue
- Cliquez sur le déploiement rouge
- Regardez le log pour repérer l'erreur
- Le plus souvent c'est une dépendance manquante ; envoyez-moi le message

### « Installer l'application » ne s'affiche pas dans Chrome
- Vérifiez que vous êtes bien sur `https://` (Netlify est en HTTPS par défaut ✅)
- Chrome requiert d'avoir visité le site quelques secondes avant
- Essayez **menu ⋮ → Ajouter à l'écran d'accueil** (même résultat)

### Les notifications n'arrivent pas
- Vérifiez que vous les avez autorisées : **Réglages système → Applications → Sport Calendar → Notifications**
- Sur iPad, les notifications web sont disponibles à partir d'iOS 16.4+
- L'app doit être lancée au moins une fois par jour pour que les rappels fonctionnent en arrière-plan

### L'app est vide au premier lancement
- Tirez vers le bas pour synchroniser, ou appuyez sur le bouton **↻**
- Les données de démonstration doivent apparaître immédiatement
- Si rien ne s'affiche, vérifiez votre connexion internet

---

**Bon match ! 🏆**

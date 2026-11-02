# YSA App Final

L'application YouthStation, troisième version : le produit de **ysa-application** (écrans, parcours, textes turcs, stories, iGEM, carte d'inscription…) reconstruit sur une base temps réel, avec les meilleures idées de **ysa-app**.

## Le temps réel : comment ça marche

```
 Base Supabase ──► Supabase Realtime (1 seule connexion WebSocket)
                     │  postgres_changes · presence · broadcast
                     ▼
              RealtimeHub ──► cache TanStack Query partagé ──► toutes les pages
```

- **Une connexion pour toute l'app** (`lib/realtime/hub.tsx`). Chaque changement en base (message, tâche, événement, like, profil…) met à jour ou rafraîchit le cache commun. Une page qui n'est pas affichée est donc déjà à jour quand on l'ouvre.
- **Navigation instantanée** : les écrans principaux sont préchargés à l'ouverture. Le cache est conservé dans le navigateur pendant 24 h, ce qui permet de rouvrir l'app (PWA) sans écran de chargement.
- **Envoi optimiste** : un message, un like, un vote ou un changement de statut apparaissent immédiatement, puis sont confirmés par la base.
- **Présence** (qui est en ligne) et **« en train d'écrire… »** passent par la même connexion.
- **Notifications** : elles sont créées uniquement par des déclencheurs SQL. Elles s'affichent dans la cloche et en bannière dans l'app, et en **push** sur le téléphone quand l'app est fermée.

## Fonctionnalités

| | |
|---|---|
| **Ana sayfa** | Stories 24 h (filtres, textes, musique Deezer), publications avec photo, **PDF à télécharger** ou sondage, likes, commentaires, cartes de bienvenue (avec la blague selon la ville d'origine), demandes iGEM, anniversaires du jour, **publications épinglées par le Bureau Uluslararası** |
| **Mesajlar** | Conversations privées et groupes, **@mentions** avec autocomplétion, **nom et couleur de l'antenne pour chaque membre**, photos, **PDF / documents**, messages vocaux, GIF, sondages, réponses, suppression, accusés de lecture, « en train d'écrire », **message épinglé (Uluslararası seulement)**, **bouton 📞 en haut à droite → WhatsApp ou appel** |
| **Takvim** | **Calendrier mois en plein écran** (balayage pour changer de mois), événements colorés par antenne, ponctuels ou sur une période, **🔒 privé = visible par l'antenne et Uluslararası**, export .ics |
| **Görevler** | À faire / en cours / terminé, priorités, échéances, assignation à une personne ou à **« Tüm ekip »**, commentaires. Chaque antenne voit ses tâches, Uluslararası voit tout |
| **Rehber** | Annuaire par antenne, pastilles « en ligne », anniversaires du mois, **classement par points** |
| **Profil** | **Points et grade** (1 message envoyé = 1 point : Çaylak 🌱 → Sohbetçi 💬 → Aktif Üye ⭐ → Sohbet Ustası 🔥 → Elçi 🏅 → Efsane 👑), rang, WhatsApp / appel, message direct |
| **🔔 Cloche** | Nouveau message (regroupé par conversation), mention, nouvelle tâche, événement de mon antenne, nouveau membre, commentaire |
| **Ayarlar** | Profil, photo, choix des notifications, push du téléphone, demande iGEM, thème clair/sombre, langue 🇹🇷 🇫🇷 🇬🇧 |
| **Yönetici** | Validation des inscriptions (avec publication automatique du message de bienvenue), gestion des membres |

## Rôles

| | Membre | Bureau Uluslararası (`intl`) | Admin |
|---|:-:|:-:|:-:|
| Publier, écrire, voter, créer des tâches et événements pour **son** antenne | ✓ | ✓ | ✓ |
| Voir les tâches et les événements privés de **toutes** les antennes | | ✓ | ✓ |
| Créer des tâches et événements pour n'importe quelle antenne | | ✓ | ✓ |
| 📌 Épingler un message ou une publication | | ✓ | ✓ |
| Changer le poste d'un membre | | ✓ | ✓ |
| Valider les inscriptions, gérer les comptes | | | ✓ |

Les comptes `secretaire@`, `president@youthstation.org` et `feyza.simsek09@gmail.com` deviennent administrateurs à leur inscription, comme dans la v1. Le premier compte créé l'est aussi.

## Installation

```bash
npm install
cp .env.example .env.local      # renseigner les clés Supabase
npm run dev
```

1. Créer un projet Supabase, puis exécuter **`supabase/schema.sql`** dans *SQL Editor* (le script peut être relancé sans risque).
2. *Authentication → URL Configuration* : ajouter `http://localhost:3000/auth/callback` aux *Redirect URLs*.
3. Optionnel : notifications push. `npx web-push generate-vapid-keys`, puis renseigner `VAPID_*` dans `.env.local`.
4. Optionnel : `npm run seed:demo` crée 5 comptes de démo (mot de passe `YsaDemo2026!`) et des données d'exemple.

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` | Développement / build de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run test:db` | Exécute le schéma dans un Postgres en mémoire et vérifie 40 scénarios (droits, événements privés, épinglage, mentions, points, notifications, fichiers) |
| `npm run seed:demo` | Comptes et données de démo |

## Différences avec ysa-application

- Les personnes sont identifiées par leur **identifiant** et non plus par leur nom (likes, votes, membres de conversation…) : fini les bugs d'homonymes.
- **Aucun mot de passe stocké** par l'application (la v1 gardait celui des demandes d'adhésion).
- Les droits sont appliqués **dans la base** (RLS). La v1 avait la plupart des tables ouvertes à tout utilisateur connecté.
- Les notifications ne peuvent plus être forgées : la route `/api/push/send` de la v1 permettait d'envoyer n'importe quel texte à n'importe qui.
- Les **appels audio/vidéo WebRTC** sont remplacés par le bouton 📞 (WhatsApp ou appel téléphonique), plus fiable et sans serveur TURN à payer.
- Plus de polling, ni de non-lus stockés dans le navigateur, ni de déconnexion forcée à minuit.

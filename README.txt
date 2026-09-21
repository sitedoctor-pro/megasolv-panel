MEGASOLV ADMIN — Dashboard only

Contenu:
- index.html      : Analytics
- orders.html     : Commandes + export CSV
- reviews.html    : Avis
- login.html      : Connexion administrateur
- assets/         : CSS, JS, SVG, favicon, logo

Le fichier assets/js/supabase-client.js contient la configuration publique Supabase
nécessaire au dashboard. Aucun service_role / secret key n'est inclus.

Important:
- Les RPC, RLS et tables doivent déjà être installés dans Supabase.
- L'administrateur doit avoir app_metadata.role = "admin".
- Le dashboard est marqué noindex,nofollow.


PWA intégré:
- manifest.webmanifest
- service-worker.js
- offline.html
- assets/pwa/ : icônes 192/512 + maskable + Apple touch
- assets/js/pwa.js : installation + Service Worker

Installation PWA:
- Le dashboard doit être servi en HTTPS (ou localhost).
- L'installation PWA ne fonctionne pas depuis file://.
- Les requêtes Supabase/Auth/Realtime ne sont jamais mises en cache par le Service Worker.

Mise à jour sécurité des suppressions:
- Suppression d'une commande: backup JSON téléchargé automatiquement AVANT confirmation, puis suppression uniquement après validation explicite.
- Nettoyage Analytics: export JSON complet de analytics_sessions, page_views et analytics_events AVANT confirmation; commandes et avis ne sont jamais touchés.
- Sources de trafic: chaque source affiche maintenant pourcentage + nombre exact de sessions.

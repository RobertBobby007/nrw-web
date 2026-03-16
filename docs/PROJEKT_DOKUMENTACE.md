# NRW Web - Projektová dokumentace

Tento dokument popisuje aktuální stav projektu `nrw-web` (Next.js aplikace) podle zdrojového kódu v repozitáři.

## 1. Co je projekt

`nrw-web` je sociální/webová aplikace postavená na Next.js App Routeru. Obsahuje:

- hlavní stream (`nReal` + `nNews`),
- samostatný `nReal` feed (posty, lajky, komentáře, trendy),
- chat (direct zprávy),
- podporu (`support` thread + messages),
- uživatelské profily, nastavení a reportování obsahu,
- weather widget + upozornění z Meteoalarm feedu.

## 2. Technologie

- Framework: Next.js `^16.1.4` (App Router)
- UI: React `^19.2.3`
- Jazyk: TypeScript
- Styling: Tailwind CSS v4
- Databáze/Auth:
  - Supabase (hlavní data aplikace)
  - lokální SQLite (`better-sqlite3`) pro alternativní auth store (`.data/auth.db`)
- Realtime: Supabase Realtime channels
- Další: `openai` dependency je přítomná, ale v této části aplikace není klíčová runtime cesta zdokumentovaná

## 3. Monorepo / složky

- `src/app` - stránky a API routy (Next.js App Router)
- `src/lib` - doménová logika, klienti, utility
- `src/hooks` - React hooks
- `src/components` - znovupoužitelné komponenty
- `src/types` - sdílené TS typy
- `db/migrations` - SQL migrace
- `nrw-api` - separátní Node/Express projekt (v tomto repu jen základ + dependencies)

## 4. Spuštění lokálně

### Požadavky

- Node.js (doporučeně aktuální LTS)
- npm
- Supabase projekt + správně nastavené env proměnné

### Instalace a start

```bash
npm install
npm run dev
```

Aplikace standardně běží na `http://localhost:3000`.

### Produkční build

```bash
npm run build
npm run start
```

## 5. Skripty (root)

- `npm run dev` - vývojový server
- `npm run build` - produkční build
- `npm run start` - spuštění buildu
- `npm run lint` - ESLint

## 6. Environment proměnné

Podle použití v kódu:

### Povinné pro Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Volitelné / feature-specific

- `VIEW_HASH_SALT` - salting hash pro deduplikaci view přes IP (`/api/nreal/view`)
- `METEOALARM_FEED_URL` - custom RSS URL pro weather alerts
- `NEXT_PUBLIC_HEARTBEAT_ENABLED` - zapnutí heartbeat komponenty
- `NEXT_PUBLIC_WEATHER_REFRESH_MS` - refresh interval weather dat
- `NEXT_PUBLIC_OPENWEATHER_API_KEY` - klíč pro weather data na klientu

## 7. Architektura aplikace

### Frontend

- Hlavní část je v route group `src/app/(main)`.
- Klíčové stránky:
  - `page.tsx` - hlavní stream, mix `nReal` + `nNews`
  - `real/page.tsx` + `real/RealFeedClient.tsx` - nReal feed UI + interakce
  - `news/page.tsx` - nNews stream
  - `chat/page.tsx`, `support/page.tsx`, `settings/page.tsx`, `profile` stránky

### Backend (Next API routes)

API je realizované přes `src/app/api/**/route.ts`.

- Auth (lokální auth-store):
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- Profil:
  - `GET /api/profile`
- Feed / content:
  - `GET /api/news/feed`
  - `GET /api/news/preview`
  - `POST /api/nreal/create`
  - `GET /api/nreal/trends`
  - `POST /api/nreal/view`
- Moderace / report:
  - `POST /api/report`
  - `POST /api/chat/report`
- Chat:
  - `GET /api/chat/threads`
  - `POST /api/chat/direct`
- Support:
  - `GET /api/support/thread`
  - `POST /api/support/message`
- Utility:
  - `POST /api/ping`
  - `GET /api/weather/alerts`

## 8. Feed logika (aktuální stav)

### nReal ranking

Soubor: `src/lib/nreal-feed-ranking.ts`

Varianty:

- `chronological`
- `ranked`

Pro přihlášené uživatele je varianta sticky přes `localStorage` (`nrw.feed.variant:<userId>`), první volba je náhodně 50/50.

Skóre v `ranked`:

```text
score = likes*2 + comments*4 + followBoost(20) + recencyBonus(0..24)
```

### Hlavní stream

- Načítá `nReal` posty + `nNews` položky.
- V tabu `Vše` se položky míchají čistě chronologicky podle `createdAt`.
- nNews je načítané z DB tabulky (pokud existuje), jinak fallback na RSS sources.

### Cache

- feed cache v paměti + session cache
- TTL: cca `30s` (main i nReal feed)

## 9. Realtime

- Hook `useRealtimeNRealFeed` subscribuje na `nreal_posts` (`INSERT/UPDATE/DELETE`) přes Supabase Realtime.
- Další realtime chování je v chat/suppport hooks (`useRealtimeChatMessages`, `useRealtimeSupportMessages` apod.).

## 10. Datový model (odvozeno z dotazů v kódu)

Níže je praktický seznam tabulek, které aplikace používá. Není to plná SQL specifikace, ale runtime kontrakt dle kódu.

### nReal a sociální vrstva

- `nreal_posts`
- `nreal_likes`
- `nreal_comments`
- `nreal_reports`
- `nreal_post_views`
- `nreal_token_hourly_counts`
- `follows`
- `profiles`

### Chat

- `chats`
- `chat_members`
- `chat_messages`
- `chat_message_reports`
- `chat_message_reads`

### Support

- `support_threads`
- `support_messages`

### Monitoring / online status

- `online_users`

### News

- `nNews` / `nnews` / `n_news` / `news` / `news_items` (detekce první existující tabulky)
- `rss_sources` (fallback zdroje)

## 11. Auth model

Projekt momentálně kombinuje dva auth přístupy:

- Supabase auth (`createSupabaseServerClient`, `supabase.auth.getUser()`)
- lokální auth store (`src/lib/auth-store.ts`) nad SQLite (`.data/auth.db`) s cookie `nexa_session`

To znamená, že je potřeba jasně držet kontext, která část aplikace používá který auth tok.

## 12. Migrace

Aktuálně dostupná migrace:

- `db/migrations/20260303_chat_last_seen.sql`

Migrace vytváří triggery, které synchronizují `profiles.last_seen` při práci s chat zprávami a read stavy.

## 13. Bezpečnostní poznámky

- `SUPABASE_SERVICE_ROLE_KEY` musí zůstat pouze na serverové straně.
- `/api/news/preview` obsahuje ochrany proti private hostům a částečnou sanitizaci HTML.
- View tracking (`/api/nreal/view`) hashuje IP + salt.
- Moderace obsahu používá filtry (`content-filter`, `blocked-terms`).

## 14. Známé technické dluhy / doporučení

- Sjednotit auth strategii (Supabase-only vs hybrid).
- Dopsat centrální schema dokumentaci Supabase (DDL + indexy + RLS policies).
- Přidat testy (unit + integration) pro klíčové API routy.
- Doplnit standardní `.env.example` pro rychlý onboarding.
- Vyčistit nebo jasně oddělit `nrw-api` (aktuálně v repu primárně jako separátní kostra).

## 15. Rychlý onboarding checklist

1. Nastavit env proměnné pro Supabase + weather.
2. `npm install` a `npm run dev`.
3. Ověřit `/api/profile` a `/api/news/feed`.
4. Ověřit nReal flow: create post, like/comment, realtime update.
5. Ověřit chat flow: vytvoření direct thread + posílání zpráv.

---

Pokud chceš, navážu druhým dokumentem `API_REFERENCE.md` s request/response příklady pro každý endpoint.

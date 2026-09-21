# MangaVerse — All Free Manga, One Universe

**MangaVerse is a complete free manga aggregator and publishing platform.** It brings together every legally free manga available online in one mobile-first, cinematic Shōnen × Seinen experience.

## What "All Free Manga" Means (Legal Only)

MangaVerse **never hosts pirated manga, never bypasses paywalls, and never scrapes publisher sites.** Instead, it aggregates from verified legal sources:

### 1. MangaDex Free (20,000+ titles) — Primary Free Source
- **Source:** MangaDex Public API `https://api.mangadex.org`
- **What:** All manga with available English chapters on MangaDex — independently published, creator-permitted, official translations, scanlations where creators allow distribution.
- **How:** Fetched live via `hasAvailableChapters=true`, `availableTranslatedLanguage[]=en`, paginated to show *all available*.
- **Reader:** Built-in reader using MangaDex **at-home server** API (`/at-home/server/{chapterId}`) — images load directly from MangaDex CDN (`uploads.mangadex.org`), not rehosted.
- **UI:** Free rails, infinite load-more, trending/latest/new, genre filters, search across 20k+ titles.

### 2. Public Domain (37+ volumes)
- Smithsonian Libraries Open Access (Hokusai Manga CC0)
- Library of Congress Japanese Rare Book Collection
- National Diet Library / Wikimedia Commons
- Waseda University Library
- Internet Archive open-access scans
- **All links open original host.**

### 3. Official Publisher Free Sources (7 curated)
| Source | What is free | URL |
|--------|--------------|-----|
| MANGA Plus by SHUEISHA | First 3 + latest 3 chapters free (One Piece, JJK, etc) | https://mangaplus.shueisha.co.jp/ |
| VIZ Media | Free first chapters, Shonen Jump preview | https://www.viz.com/shonenjump |
| WEBTOON | 10k+ fully free original series | https://www.webtoons.com/ |
| Comikey | Free tickets, first chapters | https://comikey.com/ |
| MangaDex Creator Direct | Indie creators publishing free | https://mangadex.org/ |
| Internet Archive | Public domain manga scans | https://archive.org/ |
| Smithsonian | Hokusai Manga CC0 | https://library.si.edu/ |

### 4. Your Original Uploads (IndexedDB)
- **Upload your own manga** — original creations only.
- Stored locally via IndexedDB (`MangaVerseUploads` DB, `mangas` + `chapters` stores).
- Add chapters as image sequences (JPG/PNG/WEBP), in order.
- Read in-app via same reader (`reader.html?source=user`).
- Export/import as JSON — you keep all rights.
- Appears in **My Uploads** and **My Library** (local only).
- This satisfies "upload them on website" without infringing — you publish your own free manga.

## Features Built

### Free Manga Aggregator
- `free-manga.js` — `FreeMangaAggregator` class that fetches *all* free manga from MangaDex with pagination, sorting, genre filtering, search.
- Browse Free Universe: All Free, Trending Free, Latest Updates, New on MangaDex, plus genre filters (Action, Fantasy, Romance, etc).
- Load More — paginates through entire MangaDex catalog (total count displayed, e.g., "24,532 total free titles").
- Free cards show FREE badge, READ NOW CTA.

### Built-in Manga Reader
- `reader.html` + `reader.js` — full-page reader.
- MangaDex at-home: fetches server URL, chapter hash, page list, renders vertical scroll or single-page mode.
- Settings: single page, fit width, page numbers, dark bg, vertical/horizontal.
- Chapter drawer, prev/next chapter, progress bar, keyboard arrows.
- User uploads: reads from IndexedDB data URLs.
- Legal notice: images from MangaDex CDN, not mirrored.

### Upload & Publish
- `upload.js` — `MangaUploadManager` using IndexedDB.
- Drag & drop zone, file input, create manga form (title, author, description, tags, status, cover, pages).
- Add chapter dialog.
- My Uploads grid, detail view with edit/delete/export.
- Stats: upload count in hero.

### Discovery Catalog (Metadata Only)
- Still uses AniList GraphQL + Jikan REST fallback for 100k+ metadata entries.
- Sections: Trending, Shōnen, Seinen, Action, Fantasy, Romance.
- Search merges AniList + MangaDex results + public domain + official sources.

### Library (Local)
- `localStorage` for bookmarks: favorites, reading, plan, finished, plus uploads.
- My Library filter includes "My Uploads".

### UI/UX
- Mobile-first, bottom nav, hero with stats (MangaDex count, public domain count, official sources, uploads).
- Free badges, upload zone, skeleton loaders, error states.
- PWA manifest.

## Files
- `index.html` — main app, free aggregator, uploads, library
- `styles.css` — cinematic dark UI, upload zone, reader styles
- `app.js` — main logic, free aggregator integration, uploads, library, search, detail
- `free-manga.js` — all free manga API layer (MangaDex + official + public domain)
- `upload.js` — IndexedDB upload manager
- `reader.html` + `reader.js` — built-in reader (MangaDex at-home + user uploads)
- `public-domain.html` + `public-domain.js` — 37+ public domain volumes
- `manifest.json` — PWA
- `Dockerfile` — nginx serving all files with SPA fallback

## Running Locally
```bash
python3 -m http.server 8000
# or
docker build -t mangaverse . && docker run -p 80:80 mangaverse
```

## Legal & Ethical
- No copyrighted manga hosted.
- MangaDex images via official CDN only.
- Public domain links open original host.
- Uploads: original works only, user confirms ownership.
- Official sources link out, never proxy paywalled content.

## Scaling to "All Available Free Manga"
- MangaDex total is fetched live (`total` field) — currently 20k+ and growing.
- Pagination via `offset` allows browsing entire catalog, not just first page.
- Load More button + infinite search loads next pages.
- Search across all free sources merges MangaDex + public domain + official.
- No hard limit — UI can load 100s of titles via load-more.

Made by HARSH — MangaVerse v2: All Free Manga Edition.

# MangaVerse — All Free Manga Sources (Legal Only)

MangaVerse aggregates **every legally free manga available online** — no piracy, no paywall bypass, no rehosting of copyrighted scans.

## Tier 1: MangaDex Free (20,000+ titles) — Primary

- **API:** https://api.mangadex.org/docs/
- **Endpoint used:** `GET /manga?hasAvailableChapters=true&availableTranslatedLanguage[]=en&order[followedCount]=desc&includes[]=cover_art&limit=32&offset=0`
- **Total:** Fetched live via `total` field — currently 20k+ and growing. Pagination via `offset` allows browsing *all available*.
- **Reader:** `GET /at-home/server/{chapterId}` returns `baseUrl`, `chapter.hash`, `chapter.data[]`. Images loaded from `baseUrl/data/hash/filename` — official MangaDex CDN, not mirrored.
- **Chapters:** `GET /manga/{id}/feed?translatedLanguage[]=en&order[chapter]=asc&includes[]=scanlation_group`
- **What qualifies as free:** MangaDex hosts user-uploaded content where creators permit distribution, official translations, indie creators publishing directly. MangaDex complies with DMCA takedowns. MangaVerse links to MangaDex and uses their CDN via official API.
- **Legal note:** We never rehost. Every chapter button opens reader that loads from MangaDex CDN, or opens MangaDex directly.

## Tier 2: Public Domain (37+ volumes)

- **Smithsonian Libraries and Archives Open Access** — Hokusai manga CC0: https://www.si.edu/openaccess/devtools
- **Wikimedia Commons** — public-domain scans with per-file license: https://commons.wikimedia.org/wiki/Commons:API
- **Library of Congress Japanese Rare Book Digital Collection** — public domain / no known copyright: https://www.loc.gov/collections/japanese-rare-books/about-this-collection/rights-and-access/
- **National Diet Library Digital Collections** — Internet publication / copyright expired: https://www.ndl.go.jp/en/dlib/
- **Internet Archive** — open-access repository: https://archive.org/developers/
- **Waseda University Library** — Hokusai holdings open-access
- **Current manifest:** 37 public-domain volumes (Hokusai manga volumes 1-15, Denshin Kaishu, Ryusai manga, etc). All links open original host.

## Tier 3: Official Publisher Free (7 sources)

| Source | Free Model | URL | API |
|--------|------------|-----|-----|
| MANGA Plus by SHUEISHA | First 3 + latest 3 chapters free for 100+ titles (One Piece, JJK, Chainsaw Man) | https://mangaplus.shueisha.co.jp/ | No public API — link out |
| VIZ Media | Free first chapters, Shonen Jump vault preview | https://www.viz.com/shonenjump | No public API — link out |
| WEBTOON | 10,000+ fully free original webcomics, ad-supported | https://www.webtoons.com/ | No public API — link out |
| Comikey | Free tickets daily, first chapters free | https://comikey.com/ | No public API — link out |
| MangaDex Creator Direct | Indie creators publishing 100% free, official | https://mangadex.org/ | Public API (same as Tier 1) |
| Internet Archive Manga | Public domain & CC manga scans | https://archive.org/search?query=manga | IA Search API |
| Smithsonian Open Access | Hokusai Manga CC0 | https://library.si.edu/ | SI Open Access API |

All official sources are linked, not proxied. No paywall bypass.

## Tier 4: User Original Uploads (IndexedDB)

- **Storage:** IndexedDB `MangaVerseUploads` database, `mangas` store (keyPath `id`) + `chapters` store (index `mangaId`).
- **What:** User's original creations only — user confirms ownership on upload.
- **Format:** Cover image (JPG/PNG/WEBP) as data URL, chapter pages as ordered data URLs.
- **Reader:** Same `reader.html` but `source=user` loads from IndexedDB.
- **Export:** JSON with manga + chapters + exportedAt.
- **Legal:** User retains all rights. No copyrighted material from other creators. Stored locally, never leaves device unless exported.

## Metadata Catalog (Discovery Only, Not Free Reading)

- **AniList GraphQL** `https://graphql.anilist.co` — 100k+ manga metadata, paginated, cached, no chapters hosted.
- **Jikan REST** `https://api.jikan.moe/v4` — MyAnimeList fallback, rate-limited (700ms between requests).
- These are discovery only — "Read" buttons open AniList/MAL/external links, not hosted chapters.

## How "All Available Free Manga" Is Achieved

1. **Fetch total:** `GET /manga?limit=1` returns `total` — e.g., 24,532 free titles with EN chapters.
2. **Paginate:** `offset=0,32,64...` until `offset+limit >= total` — Load More button does this.
3. **Sort options:** `followedCount` (popular), `latestUploadedChapter` (latest updates), `createdAt` (newest), plus genre filters via `includedTags[]`.
4. **Search:** `title` param + merge with public domain + official sources + metadata.
5. **No hard cap:** UI can load 100s via load-more, not limited to first 18.

## Scaling Rule (Unchanged)

- 20k+ MangaDex free is readable via official CDN (not mirrored).
- 100k+ AniList catalog is metadata/discovery only.
- Public domain stays at original host.
- User uploads stay local.
- No automatic download or redistribution of modern copyrighted chapters beyond what MangaDex API legally provides via its CDN.

## Files Implementing This

- `free-manga.js` — `FreeMangaAggregator` class, official sources list, public domain works
- `app.js` — integrates aggregator, renders free rails, handles load-more, search, library
- `reader.js` + `reader.html` — at-home reader for free manga + user uploads
- `upload.js` — IndexedDB manager
- `index.html` — free sections, upload zone, official grid, stats
- `public-domain.html/js` — 37+ volumes
- `OPEN-SOURCES.md` — this file

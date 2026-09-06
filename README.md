# MangaVerse

A mobile-first manga discovery experience with a cinematic Shōnen × Seinen visual identity.

## Catalogue architecture

MangaVerse is designed to browse **100,000+ manga metadata entries** without shipping thousands of records in the frontend bundle. Catalogue data is fetched on demand from legitimate metadata APIs (AniList, MyAnimeList/Jikan, MangaDex), paginated, cached in memory, and rendered only when needed.

**Actual manga chapters/pages are never hosted by MangaVerse.** All "read" actions open the title's page on the official source.

## Sources

| Source | Role | Type |
|--------|------|------|
| **AniList** | Primary metadata + links | GraphQL API |
| **MyAnimeList / Jikan** | Fallback metadata + links | REST API |
| **MangaDex** | Free-to-read titles + chapters | REST API (public) |

See [OPEN-SOURCES.md](OPEN-SOURCES.md) for the open/public-domain reading section.

## What MangaVerse adds

- **MangaDex "Read Free" section** — titles freely distributed on MangaDex (independently published, creator-permitted, or officially licensed for free reading) surfaced via MangaDex's public API. Every chapter button opens MangaDex directly.
- **My Library** — personal reading tracker saved in your browser's localStorage. Bookmark titles, mark favorites, and track reading status. Nothing leaves your device.
- **Expanded Free Reads** — public-domain manga from verified institutional sources (Smithsonian Libraries, Library of Congress, Internet Archive, National Diet Library, Wikimedia Commons).
- **Cross-source search** — search results merge AniList/Jikan metadata with live MangaDex results.
- **Bookmark & track from any detail page** — add any title to your library without leaving the page.

## What MangaVerse does NOT do

- It does not mirror, rehost, or redistribute manga chapters or pages.
- It does not serve manga images or PDF files from its own domain.
- It does not scrape publisher sites.
- It does not bypass paywalls or licensing restrictions.

## Current build

- Mobile-first dark manga UI
- Shōnen / Seinen / Action / Fantasy / Romance discovery sections
- 100K+ catalogue-ready architecture (AniList + Jikan + MangaDex)
- Read Free section powered by MangaDex public API
- Search with pagination, genre/tag filters, and cross-source results
- Trending / popular / new sections
- Lazy-loaded cover images
- Manga detail modal with chapter links + library controls
- Personal reading tracker (localStorage)
- Public-domain / open-access Free Reads section
- Responsive navigation (desktop + mobile bottom nav)
- Manga-inspired animations

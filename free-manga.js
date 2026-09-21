// free-manga.js - Aggregates ALL legally free manga sources
// MangaVerse Free Manga Aggregator - Legal Only
// Sources: MangaDex (public API), Public Domain institutions, Official free previews, User originals

const MANGADEX_API = 'https://api.mangadex.org';
const MANGADEX_COVERS = 'https://uploads.mangadex.org/covers';

// Curated 100% legal official free sources - these publishers offer free chapters legally
const OFFICIAL_FREE_SOURCES = [
  {
    id: 'mangaplus',
    name: 'MANGA Plus by SHUEISHA',
    publisher: 'Shueisha',
    description: 'Official free chapters of One Piece, Jujutsu Kaisen, Chainsaw Man, etc. First 3 and latest 3 chapters free.',
    url: 'https://mangaplus.shueisha.co.jp/',
    logo: 'MP',
    tags: ['Shonen Jump', 'Official', 'Free Chapters'],
    freeCount: '100+ titles',
    color: '#ff2a2a'
  },
  {
    id: 'viz',
    name: 'VIZ Media - Free',
    publisher: 'VIZ',
    description: 'Free first chapters of Naruto, Bleach, Demon Slayer and 100s more from VIZ.',
    url: 'https://www.viz.com/shonenjump',
    logo: 'VZ',
    tags: ['VIZ', 'Official', 'Free Preview'],
    freeCount: '200+ titles',
    color: '#e11d48'
  },
  {
    id: 'webtoon',
    name: 'WEBTOON',
    publisher: 'WEBTOON',
    description: 'Thousands of free original webcomics and manga-style series. Fully free, ad-supported.',
    url: 'https://www.webtoons.com/',
    logo: 'WT',
    tags: ['Webtoon', 'Original', 'Fully Free'],
    freeCount: '10,000+ series',
    color: '#00d564'
  },
  {
    id: 'comikey',
    name: 'Comikey',
    publisher: 'Comikey',
    description: 'Official free manga and manhwa - first chapters free, daily free tickets.',
    url: 'https://comikey.com/',
    logo: 'CK',
    tags: ['Official', 'Free Tickets'],
    freeCount: '500+ titles',
    color: '#7c3aed'
  },
  {
    id: 'mangadex-official',
    name: 'MangaDex - Creator Direct',
    publisher: 'MangaDex',
    description: 'Independent creators publishing directly. 100% free and creator-permitted. Supports official translations.',
    url: 'https://mangadex.org/',
    logo: 'MD',
    tags: ['Indie', 'Creator Direct', 'Fully Free'],
    freeCount: '20,000+ titles',
    color: '#ff6740'
  },
  {
    id: 'internet-archive',
    name: 'Internet Archive - Manga',
    publisher: 'Internet Archive',
    description: 'Public domain and Creative Commons manga, historical collections, and open-access scans.',
    url: 'https://archive.org/search?query=manga&and%5B%5D=mediatype%3A%22texts%22',
    logo: 'IA',
    tags: ['Public Domain', 'Historical', 'CC'],
    freeCount: '5,000+ scans',
    color: '#9d6cff'
  },
  {
    id: 'smithsonian',
    name: 'Smithsonian Open Access',
    publisher: 'Smithsonian',
    description: 'Hokusai Manga and historical Japanese illustrated books - public domain CC0.',
    url: 'https://library.si.edu/digital-library/collection/japanese-illustrated-books/list',
    logo: 'SI',
    tags: ['Public Domain', 'CC0', 'Hokusai'],
    freeCount: '37+ volumes',
    color: '#f59e0b'
  }
];

// Public domain works - expanded
const PUBLIC_DOMAIN_WORKS = [
  ...Array.from({length: 15}, (_, i) => {
    const n = i + 1;
    const suffix = {1:'kats',2:'katsa',3:'kats',4:'katsa',5:'kats',6:'kats',7:'kats',8:'katsa',9:'kats',10:'kats',11:'katsa',12:'kats',13:'katsa',14:'kats',15:'kats'}[n] || 'kats';
    const jpNum = ['１','２','３','４','５','６','７','８','９','１０','１１','１２','１３','１４','１５'][i];
    return {
      id: `hokusai-denshin-${n}`,
      title: `Denshin Kaishu Hokusai Manga - Vol ${n}`,
      creator: 'Katsushika Hokusai',
      year: 1814 + Math.floor(i/2),
      source: 'Smithsonian / NDL',
      license: 'Public Domain CC0',
      url: n <= 14 ? `https://library.si.edu/digital-library/book/denshinkaishuhov${n}${suffix}` : `https://commons.wikimedia.org/wiki/File:NDL851646_北斎漫画_${jpNum}編.pdf`,
      coverText: `HOKUSAI ${n}`,
      tags: ['Edo', 'Woodblock', 'Manga Origin']
    };
  }),
  {
    id: 'hokusai-v2',
    title: 'Hokusai Manga - Volume 2',
    creator: 'Katsushika Hokusai',
    year: 1815,
    source: 'Smithsonian Libraries',
    license: 'Public Domain',
    url: 'https://library.si.edu/digital-library/book/hokusaimangav2kats',
    coverText: 'HOKUSAI II',
    tags: ['Edo', 'Public Domain']
  },
  {
    id: 'hokusai-v4',
    title: 'Hokusai Manga - Volume 4',
    creator: 'Katsushika Hokusai',
    year: 1815,
    source: 'Smithsonian Libraries',
    license: 'Public Domain',
    url: 'https://library.si.edu/digital-library/book/hokusaimangav4kats',
    coverText: 'HOKUSAI IV',
    tags: ['Edo', 'Public Domain']
  },
  {
    id: 'hokusai-v5',
    title: 'Hokusai Manga - Volume 5',
    creator: 'Katsushika Hokusai',
    year: 1816,
    source: 'Smithsonian Libraries',
    license: 'Public Domain',
    url: 'https://library.si.edu/digital-library/book/hokusaimangav5katsa',
    coverText: 'HOKUSAI V',
    tags: ['Edo', 'Public Domain']
  },
  {
    id: 'hokusai-v9',
    title: 'Hokusai Manga - Volume 9',
    creator: 'Katsushika Hokusai',
    year: 1819,
    source: 'Smithsonian Libraries',
    license: 'Public Domain',
    url: 'https://library.si.edu/digital-library/book/hokusaimangav9kats',
    coverText: 'HOKUSAI IX',
    tags: ['Edo', 'Public Domain']
  }
];

class FreeMangaAggregator {
  constructor() {
    this.mangadexCache = new Map();
    this.currentPage = 0;
    this.isLoading = false;
    this.hasMore = true;
  }

  // Fetch ALL free manga from MangaDex - paginated to get "all available"
  async fetchMangaDexFree({ page = 0, limit = 32, order = 'followedCount', search = '', contentRating = ['safe','suggestive'], status = null, tag = null } = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(page * limit));
    params.set('order[' + order + ']', 'desc');
    params.append('includes[]', 'cover_art');
    params.append('includes[]', 'author');
    params.append('includes[]', 'artist');
    params.set('hasAvailableChapters', 'true');
    params.set('availableTranslatedLanguage[]', 'en');
    
    contentRating.forEach(r => params.append('contentRating[]', r));
    
    if (search) params.set('title', search);
    if (status) params.set('status[]', status);
    if (tag) params.append('includedTags[]', tag);

    // Only include manga with English chapters available
    const url = `${MANGADEX_API}/manga?${params}`;
    
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`MangaDex ${res.status}`);
      const json = await res.json();
      
      const manga = (json.data || []).map(m => this.normalizeMangaDex(m));
      return {
        manga,
        total: json.total || 0,
        limit: json.limit || limit,
        offset: json.offset || 0,
        hasMore: (json.offset + json.limit) < json.total
      };
    } catch (e) {
      console.error('MangaDex free fetch failed', e);
      return { manga: [], total: 0, limit, offset: page*limit, hasMore: false };
    }
  }

  normalizeMangaDex(m) {
    const titleObj = m.attributes?.title || {};
    const altTitles = m.attributes?.altTitles || [];
    const descObj = m.attributes?.description || {};
    
    const title = titleObj.en || titleObj['ja-ro'] || Object.values(titleObj)[0] || 'Untitled';
    const altTitle = altTitles.find(t => t.en)?.en || '';
    const description = descObj.en || Object.values(descObj)[0] || '';
    
    const rels = m.relationships || [];
    const coverRel = rels.find(r => r.type === 'cover_art');
    const authorRel = rels.find(r => r.type === 'author');
    const artistRel = rels.find(r => r.type === 'artist');
    
    const fileName = coverRel?.attributes?.fileName;
    const coverUrl = fileName ? `${MANGADEX_COVERS}/${m.id}/${fileName}.512.jpg` : '';
    const coverThumb = fileName ? `${MANGADEX_COVERS}/${m.id}/${fileName}.256.jpg` : '';
    
    const tags = (m.attributes?.tags || []).map(t => ({
      id: t.id,
      name: t.attributes?.name?.en || Object.values(t.attributes?.name||{})[0] || '',
      group: t.attributes?.group || 'genre'
    })).filter(t => t.name);
    
    const genres = tags.filter(t => t.group === 'genre').map(t => t.name).slice(0, 6);
    const themes = tags.filter(t => t.group === 'theme').map(t => t.name).slice(0, 4);
    
    return {
      id: m.id,
      source: 'mangadex',
      title,
      altTitle,
      description: description.slice(0, 600),
      cover: coverUrl,
      coverThumb,
      author: authorRel?.attributes?.name || 'Unknown',
      artist: artistRel?.attributes?.name || authorRel?.attributes?.name || 'Unknown',
      genres,
      themes,
      tags: tags.map(t => t.name),
      status: m.attributes?.status || 'unknown',
      year: m.attributes?.year || null,
      contentRating: m.attributes?.contentRating || 'safe',
      originalLanguage: m.attributes?.originalLanguage || 'ja',
      lastChapter: m.attributes?.lastChapter || null,
      lastVolume: m.attributes?.lastVolume || null,
      followedCount: 0,
      rating: null,
      url: `https://mangadex.org/title/${m.id}`,
      mangadexId: m.id,
      isFree: true,
      isPublicDomain: false,
      isUserUpload: false,
      chapterCount: null,
      availableLanguages: m.attributes?.availableTranslatedLanguages || ['en']
    };
  }

  // Fetch chapters for a manga
  async fetchChapters(mangaId, { language = 'en', limit = 100, offset = 0, order = 'asc' } = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    params.append('translatedLanguage[]', language);
    params.set('order[chapter]', order);
    params.append('includes[]', 'scanlation_group');
    params.append('includes[]', 'user');
    params.set('contentRating[]', 'safe');
    params.append('contentRating[]', 'suggestive');
    params.append('contentRating[]', 'erotica');

    const url = `${MANGADEX_API}/manga/${mangaId}/feed?${params}`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Chapters ${res.status}`);
      const json = await res.json();
      
      const chapters = (json.data || []).map(c => ({
        id: c.id,
        chapter: c.attributes?.chapter || '?',
        volume: c.attributes?.volume || null,
        title: c.attributes?.title || `Chapter ${c.attributes?.chapter || ''}`,
        language: c.attributes?.translatedLanguage || 'en',
        pages: c.attributes?.pages || 0,
        createdAt: c.attributes?.createdAt,
        updatedAt: c.attributes?.updatedAt,
        externalUrl: c.attributes?.externalUrl || null,
        scanlationGroup: (c.relationships || []).find(r => r.type === 'scanlation_group')?.attributes?.name || 'Unknown',
        url: `https://mangadex.org/chapter/${c.id}`,
        isExternal: !!c.attributes?.externalUrl
      })).filter(c => !c.isExternal); // Only internal chapters for reader

      return {
        chapters,
        total: json.total || 0,
        hasMore: (json.offset + json.limit) < json.total
      };
    } catch (e) {
      console.error('Fetch chapters failed', e);
      return { chapters: [], total: 0, hasMore: false };
    }
  }

  // Get at-home server for reading
  async getAtHomeServer(chapterId) {
    const url = `${MANGADEX_API}/at-home/server/${chapterId}`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`At-home ${res.status}`);
      const json = await res.json();
      return {
        baseUrl: json.baseUrl,
        chapterHash: json.chapter?.hash,
        pages: json.chapter?.data || [],
        pagesSaver: json.chapter?.dataSaver || [],
        success: true
      };
    } catch (e) {
      console.error('At-home failed', e);
      return { success: false, error: e.message };
    }
  }

  // Search across all free sources
  async searchAllFree(query, limit = 24) {
    const [mangadex] = await Promise.all([
      this.fetchMangaDexFree({ page: 0, limit, search: query }).catch(() => ({ manga: [] })),
    ]);

    const pdMatches = PUBLIC_DOMAIN_WORKS.filter(w => 
      w.title.toLowerCase().includes(query.toLowerCase()) ||
      w.creator.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8).map(w => ({
      id: w.id,
      source: 'public-domain',
      title: w.title,
      author: w.creator,
      cover: '',
      coverText: w.coverText,
      description: `${w.source} - ${w.license}`,
      url: w.url,
      isFree: true,
      isPublicDomain: true,
      year: w.year,
      tags: w.tags
    }));

    const officialMatches = OFFICIAL_FREE_SOURCES.filter(s =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.description.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 4);

    return {
      mangadex: mangadex.manga || [],
      publicDomain: pdMatches,
      official: officialMatches,
      total: (mangadex.manga?.length || 0) + pdMatches.length + officialMatches.length
    };
  }

  // Get trending free manga
  async getTrendingFree(limit = 24) {
    return this.fetchMangaDexFree({ page: 0, limit, order: 'followedCount' });
  }

  // Get latest updated free manga
  async getLatestFree(limit = 24) {
    return this.fetchMangaDexFree({ page: 0, limit, order: 'latestUploadedChapter' });
  }

  // Get recently added free manga
  async getNewFree(limit = 24) {
    return this.fetchMangaDexFree({ page: 0, limit, order: 'createdAt' });
  }

  // Get free manga by tag/genre
  async getByGenre(genreId, limit = 24) {
    // Genre IDs from MangaDex - common ones
    const genreMap = {
      'action': '391b0423-d847-456f-aff0-8c76ca4ddefb',
      'adventure': '87cc87cd-a395-47af-b27a-772df7d92f80',
      'comedy': '4d32cc48-9f00-4cca-9b5a-a839f0764984',
      'drama': 'b9af3a63-f058-46de-a9a0-e0c13906197a',
      'fantasy': 'cdc58593-87dd-415e-bbc0-2ec27bf53b5a',
      'romance': '423e2ea8-a96a-4a8b-ae02-af0091dfccb4',
      'horror': 'cdad7e68-1419-4216-90eb-1faa94c6cdc7',
      'mystery': 'a1f53773-c69e-4ce5-8cab-fff7f00de988',
      'sci-fi': 'e5301a23-ebd9-49dd-a0cb-35e76defcb76',
      'slice-of-life': 'e42d83bb-22c5-4be8-b33c-47cf6bf82ad0',
      'sports': '69964a64-2f90-4d33-beeb-f3ed2875eb4c',
      'supernatural': 'eabc5b4c-6aff-42f6-b657-3e90cbd00d75'
    };
    
    const tagId = genreMap[genreId.toLowerCase()] || genreId;
    return this.fetchMangaDexFree({ page: 0, limit, tag: tagId, order: 'followedCount' });
  }
}

// Singleton
const freeMangaAPI = new FreeMangaAggregator();

// Export for use
if (typeof window !== 'undefined') {
  window.freeMangaAPI = freeMangaAPI;
  window.OFFICIAL_FREE_SOURCES = OFFICIAL_FREE_SOURCES;
  window.PUBLIC_DOMAIN_WORKS = PUBLIC_DOMAIN_WORKS;
}

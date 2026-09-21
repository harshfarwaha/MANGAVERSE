// reader.js - MangaVerse Free Manga Reader (MangaDex at-home + User uploads)
class MangaReader {
  constructor() {
    this.mangaId = null;
    this.chapterId = null;
    this.manga = null;
    this.chapters = [];
    this.currentChapterIndex = -1;
    this.pages = [];
    this.currentPage = 0;
    this.settings = {
      singlePage: false,
      fitWidth: true,
      showNumbers: true,
      darkBg: true,
      mode: 'vertical'
    };
    this.isUserUpload = false;
    this.init();
  }

  init() {
    const params = new URLSearchParams(window.location.search);
    this.mangaId = params.get('manga');
    this.chapterId = params.get('chapter');
    this.isUserUpload = params.get('source') === 'user';

    if (!this.mangaId || !this.chapterId) {
      this.showError('No manga or chapter specified. Go back to browse free manga.');
      return;
    }

    this.bindEvents();
    this.loadSettings();
    
    if (this.isUserUpload) {
      this.loadUserChapter();
    } else {
      this.loadMangaDex();
    }
  }

  bindEvents() {
    document.getElementById('prevChap')?.addEventListener('click', () => this.prevChapter());
    document.getElementById('nextChap')?.addEventListener('click', () => this.nextChapter());
    document.getElementById('bottomPrev')?.addEventListener('click', () => this.prevChapter());
    document.getElementById('bottomNext')?.addEventListener('click', () => this.nextChapter());
    
    document.getElementById('chapterListBtn')?.addEventListener('click', () => this.toggleDrawer(true));
    document.getElementById('closeDrawer')?.addEventListener('click', () => this.toggleDrawer(false));
    document.getElementById('overlay')?.addEventListener('click', () => {
      this.toggleDrawer(false);
      this.toggleSettings(false);
    });
    
    document.getElementById('settingsBtn')?.addEventListener('click', () => this.toggleSettings());
    
    // Settings toggles
    document.querySelectorAll('.toggle').forEach(t => {
      t.addEventListener('click', () => {
        t.classList.toggle('on');
        const setting = t.dataset.setting;
        if (setting) {
          this.settings[setting] = t.classList.contains('on');
          this.saveSettings();
          this.applySettings();
        }
      });
    });

    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.settings.mode = btn.dataset.mode;
        this.saveSettings();
        this.applySettings();
      });
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        if (this.settings.singlePage) this.nextPage();
        else window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.settings.singlePage) this.prevPage();
        else window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
      }
    });

    // Scroll progress
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          this.updateProgress();
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('mv_reader_settings') || '{}');
      this.settings = { ...this.settings, ...saved };
      
      // Apply to UI
      document.querySelectorAll('.toggle').forEach(t => {
        const key = t.dataset.setting;
        if (key && this.settings[key] !== undefined) {
          t.classList.toggle('on', !!this.settings[key]);
        }
      });
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === this.settings.mode);
      });
    } catch {}
  }

  saveSettings() {
    localStorage.setItem('mv_reader_settings', JSON.stringify(this.settings));
  }

  applySettings() {
    const container = document.getElementById('readerPages');
    if (!container) return;
    
    container.style.maxWidth = this.settings.fitWidth ? '800px' : '1200px';
    document.body.style.background = this.settings.darkBg ? '#08080a' : '#f4f4f5';
    
    document.querySelectorAll('.page-num').forEach(el => {
      el.style.display = this.settings.showNumbers ? 'block' : 'none';
    });

    if (this.settings.singlePage) {
      this.showSinglePage(this.currentPage);
    } else {
      this.showAllPages();
    }
  }

  async loadMangaDex() {
    try {
      // Load manga info and chapters
      const [mangaRes, chaptersRes] = await Promise.all([
        fetch(`https://api.mangadex.org/manga/${this.mangaId}?includes[]=cover_art&includes[]=author`, { headers: { Accept: 'application/json' } }),
        window.freeMangaAPI.fetchChapters(this.mangaId, { language: 'en', limit: 100 })
      ]);

      if (!mangaRes.ok) throw new Error('Manga not found');
      
      const mangaJson = await mangaRes.json();
      this.manga = window.freeMangaAPI.normalizeMangaDex(mangaJson.data);
      this.chapters = chaptersRes.chapters || [];
      
      // Find current chapter index
      this.currentChapterIndex = this.chapters.findIndex(c => c.id === this.chapterId);
      if (this.currentChapterIndex === -1) this.currentChapterIndex = 0;

      this.renderChapterList();
      await this.loadChapter(this.chapterId);
      
      document.getElementById('readerTitle').textContent = this.manga.title;
      document.getElementById('readerChapter').textContent = `Ch. ${this.chapters[this.currentChapterIndex]?.chapter || ''} · ${this.manga.author}`;

    } catch (e) {
      console.error(e);
      this.showError(`Failed to load manga: ${e.message}. Try opening directly on MangaDex.`);
    }
  }

  async loadUserChapter() {
    try {
      const chapter = await window.uploadManager.getChapter(this.chapterId);
      const manga = await window.uploadManager.getManga(this.mangaId);
      
      if (!chapter || !manga) throw new Error('User manga not found');
      
      this.manga = {
        id: manga.id,
        title: manga.title,
        author: manga.author
      };
      
      const allChapters = await window.uploadManager.getChapters(this.mangaId);
      this.chapters = allChapters.map(c => ({
        id: c.id,
        chapter: c.chapter,
        title: c.title,
        pageCount: c.pageCount
      }));
      
      this.currentChapterIndex = this.chapters.findIndex(c => c.id === this.chapterId);
      
      document.getElementById('readerTitle').textContent = manga.title;
      document.getElementById('readerChapter').textContent = `Ch. ${chapter.chapter} · ${chapter.title} · YOUR UPLOAD`;
      
      this.pages = chapter.pages.map(p => ({
        url: p.dataUrl,
        thumb: p.dataUrl,
        pageNum: p.index + 1
      }));
      
      this.renderUserChapterList();
      this.renderPages();
      this.updateNavButtons();
      
    } catch (e) {
      console.error(e);
      this.showError(`Failed to load your manga: ${e.message}`);
    }
  }

  async loadChapter(chapterId) {
    const pagesContainer = document.getElementById('readerPages');
    pagesContainer.innerHTML = `<div class="reader-empty"><p class="eyebrow">LOADING CHAPTER</p><h2>Fetching<br><em style="color:#ff3b30;font-style:normal;">pages...</em></h2><div class="skeleton-row" style="height:600px;margin-top:20px;"></div></div>`;
    
    try {
      const atHome = await window.freeMangaAPI.getAtHomeServer(chapterId);
      
      if (!atHome.success) throw new Error(atHome.error || 'Failed to get server');
      
      this.pages = atHome.pages.map((fileName, idx) => ({
        url: `${atHome.baseUrl}/data/${atHome.chapterHash}/${fileName}`,
        saverUrl: `${atHome.baseUrl}/data-saver/${atHome.chapterHash}/${atHome.pagesSaver[idx] || fileName}`,
        fileName,
        pageNum: idx + 1
      }));
      
      this.renderPages();
      this.updateNavButtons();
      this.currentPage = 0;
      window.scrollTo(0,0);
      
    } catch (e) {
      console.error(e);
      pagesContainer.innerHTML = `
        <div class="reader-empty">
          <p class="eyebrow">ERROR LOADING CHAPTER</p>
          <h2>Could not<br><em style="color:#ff3b30;font-style:normal;">load pages.</em></h2>
          <p>${e.message}. This chapter may be external or unavailable. Try opening on MangaDex directly.</p>
          <a href="https://mangadex.org/chapter/${chapterId}" target="_blank" rel="noopener" class="reader-btn primary" style="display:inline-block;margin-top:20px;text-decoration:none;">Open on MangaDex →</a>
          <div style="margin-top:20px;"><a href="index.html" class="reader-btn">← Back to Browse</a></div>
        </div>
      `;
    }
  }

  renderPages() {
    const container = document.getElementById('readerPages');
    if (!container) return;
    
    if (this.settings.singlePage) {
      this.showSinglePage(0);
    } else {
      this.showAllPages();
    }
  }

  showAllPages() {
    const container = document.getElementById('readerPages');
    container.innerHTML = this.pages.map((p, idx) => `
      <div class="reader-page" data-page="${idx}">
        <img loading="${idx < 3 ? 'eager' : 'lazy'}" src="${p.url}" alt="Page ${p.pageNum}" onerror="this.src='${p.saverUrl || p.url}'; this.onerror=null;">
        <span class="page-num" style="display:${this.settings.showNumbers ? 'block' : 'none'}">${p.pageNum} / ${this.pages.length}</span>
      </div>
    `).join('');
    
    // Update progress after images load
    setTimeout(() => this.updateProgress(), 100);
  }

  showSinglePage(index) {
    const container = document.getElementById('readerPages');
    const p = this.pages[index];
    if (!p) return;
    
    this.currentPage = index;
    container.innerHTML = `
      <div class="reader-page" style="min-height:80vh;">
        <img src="${p.url}" alt="Page ${p.pageNum}" style="max-height:85vh;width:auto;max-width:100%;" onerror="this.src='${p.saverUrl || p.url}'">
        <span class="page-num">${p.pageNum} / ${this.pages.length}</span>
      </div>
      <div style="display:flex;justify-content:center;gap:12px;margin-top:20px;">
        <button class="reader-btn" id="singlePrev" ${index===0?'disabled':''}>← Previous Page</button>
        <span style="padding:8px 14px;font:700 12px Rajdhani;color:#aaa7b0;">${index+1} / ${this.pages.length}</span>
        <button class="reader-btn primary" id="singleNext" ${index===this.pages.length-1?'disabled':''}>Next Page →</button>
      </div>
    `;
    
    document.getElementById('singlePrev')?.addEventListener('click', () => this.prevPage());
    document.getElementById('singleNext')?.addEventListener('click', () => this.nextPage());
    this.updateProgress();
  }

  nextPage() {
    if (this.currentPage < this.pages.length - 1) {
      this.showSinglePage(this.currentPage + 1);
    } else {
      this.nextChapter();
    }
  }

  prevPage() {
    if (this.currentPage > 0) {
      this.showSinglePage(this.currentPage - 1);
    }
  }

  renderChapterList() {
    const drawer = document.getElementById('drawerChapters');
    if (!drawer) return;
    
    if (!this.chapters.length) {
      drawer.innerHTML = `<div style="padding:40px 20px;text-align:center;color:#71717a;">No chapters found in English.</div>`;
      return;
    }
    
    drawer.innerHTML = this.chapters.map((c, idx) => `
      <div class="chap-item ${c.id === this.chapterId ? 'active' : ''}" data-chap="${c.id}" data-index="${idx}">
        <div>
          <div class="c-title">Chapter ${c.chapter} ${c.title ? '- ' + c.title.slice(0,40) : ''}</div>
          <div class="c-meta">${c.scanlationGroup || ''} · ${c.pages ? c.pages + ' pages' : ''} · ${new Date(c.createdAt).toLocaleDateString()}</div>
        </div>
        <div style="font-size:10px;color:#71717a;">${c.id === this.chapterId ? 'READING' : ''}</div>
      </div>
    `).join('');
    
    drawer.querySelectorAll('.chap-item').forEach(el => {
      el.addEventListener('click', () => {
        const chapId = el.dataset.chap;
        const idx = parseInt(el.dataset.index);
        this.currentChapterIndex = idx;
        this.chapterId = chapId;
        this.toggleDrawer(false);
        
        const url = new URL(window.location);
        url.searchParams.set('chapter', chapId);
        window.history.pushState({}, '', url);
        
        this.loadChapter(chapId);
        this.renderChapterList();
      });
    });
  }

  renderUserChapterList() {
    const drawer = document.getElementById('drawerChapters');
    if (!drawer) return;
    
    drawer.innerHTML = this.chapters.map((c, idx) => `
      <div class="chap-item ${c.id === this.chapterId ? 'active' : ''}" data-chap="${c.id}" data-index="${idx}">
        <div>
          <div class="c-title">Chapter ${c.chapter} - ${c.title}</div>
          <div class="c-meta">${c.pageCount} pages · Your upload</div>
        </div>
        <div style="font-size:10px;color:#71717a;">${c.id === this.chapterId ? 'READING' : ''}</div>
      </div>
    `).join('');
    
    drawer.querySelectorAll('.chap-item').forEach(el => {
      el.addEventListener('click', async () => {
        const chapId = el.dataset.chap;
        const idx = parseInt(el.dataset.index);
        this.currentChapterIndex = idx;
        this.chapterId = chapId;
        this.toggleDrawer(false);
        
        const url = new URL(window.location);
        url.searchParams.set('chapter', chapId);
        window.history.pushState({}, '', url);
        
        await this.loadUserChapter();
      });
    });
  }

  updateNavButtons() {
    const hasPrev = this.currentChapterIndex > 0;
    const hasNext = this.currentChapterIndex < this.chapters.length - 1;
    
    document.getElementById('prevChap').disabled = !hasPrev;
    document.getElementById('bottomPrev').disabled = !hasPrev;
    document.getElementById('nextChap').disabled = !hasNext;
    document.getElementById('bottomNext').disabled = !hasNext;
  }

  prevChapter() {
    if (this.currentChapterIndex > 0) {
      const prev = this.chapters[this.currentChapterIndex - 1];
      const url = new URL(window.location);
      url.searchParams.set('chapter', prev.id);
      window.location.href = url.toString();
    }
  }

  nextChapter() {
    if (this.currentChapterIndex < this.chapters.length - 1) {
      const next = this.chapters[this.currentChapterIndex + 1];
      const url = new URL(window.location);
      url.searchParams.set('chapter', next.id);
      window.location.href = url.toString();
    }
  }

  toggleDrawer(open) {
    const drawer = document.getElementById('chapterDrawer');
    const overlay = document.getElementById('overlay');
    const isOpen = open !== undefined ? open : !drawer.classList.contains('open');
    
    drawer.classList.toggle('open', isOpen);
    overlay.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  toggleSettings(open) {
    const settings = document.getElementById('readerSettings');
    const overlay = document.getElementById('overlay');
    const isOpen = open !== undefined ? open : !settings.classList.contains('open');
    
    settings.classList.toggle('open', isOpen);
    if (isOpen) overlay.classList.add('open');
    else if (!document.getElementById('chapterDrawer').classList.contains('open')) overlay.classList.remove('open');
  }

  updateProgress() {
    if (this.settings.singlePage) {
      const percent = this.pages.length ? ((this.currentPage + 1) / this.pages.length) * 100 : 0;
      document.getElementById('progressFill').style.width = percent + '%';
      document.getElementById('progressCurrent').textContent = `Page ${this.currentPage + 1} / ${this.pages.length}`;
      document.getElementById('progressPercent').textContent = Math.round(percent) + '%';
    } else {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      
      // Estimate page based on scroll
      const pageElements = document.querySelectorAll('.reader-page');
      let currentPageIdx = 0;
      pageElements.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.5) currentPageIdx = idx;
      });
      
      document.getElementById('progressFill').style.width = percent + '%';
      document.getElementById('progressCurrent').textContent = `Page ${currentPageIdx + 1} / ${this.pages.length}`;
      document.getElementById('progressPercent').textContent = Math.round(percent) + '%';
    }
  }

  showError(msg) {
    const container = document.getElementById('readerPages');
    container.innerHTML = `
      <div class="reader-empty">
        <p class="eyebrow">READER ERROR</p>
        <h2>Oops!<br><em style="color:#ff3b30;font-style:normal;">Something broke.</em></h2>
        <p>${msg}</p>
        <div style="margin-top:24px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <a href="index.html" class="reader-btn primary" style="text-decoration:none;">← Back to Free Manga</a>
          <a href="https://mangadex.org" target="_blank" class="reader-btn" style="text-decoration:none;">Open MangaDex →</a>
        </div>
      </div>
    `;
  }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  window.reader = new MangaReader();
});

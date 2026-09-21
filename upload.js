// upload.js - Handles user original manga uploads (IndexedDB)
// Legal upload system for original creations only

class MangaUploadManager {
  constructor() {
    this.dbName = 'MangaVerseUploads';
    this.storeName = 'mangas';
    this.db = null;
    this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 2);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('chapters')) {
          const chapStore = db.createObjectStore('chapters', { keyPath: 'id' });
          chapStore.createIndex('mangaId', 'mangaId', { unique: false });
        }
      };
      
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async ensureDB() {
    if (!this.db) await this.initDB();
    return this.db;
  }

  generateId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Create new manga from upload
  async createManga({ title, author, description, coverFile, tags = [], status = 'ongoing' }) {
    const db = await this.ensureDB();
    
    let coverDataUrl = '';
    if (coverFile) {
      coverDataUrl = await this.fileToDataUrl(coverFile);
    }

    const manga = {
      id: this.generateId(),
      title: title || 'Untitled Manga',
      author: author || 'You',
      description: description || '',
      cover: coverDataUrl,
      coverThumb: coverDataUrl,
      tags,
      status,
      year: new Date().getFullYear(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'user-upload',
      isFree: true,
      isUserUpload: true,
      isPublicDomain: false,
      chapterCount: 0,
      chapters: [],
      url: '#',
      isOriginal: true
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.add(manga);
      req.onsuccess = () => resolve(manga);
      req.onerror = () => reject(req.error);
    });
  }

  // Add chapter to manga (multiple image files)
  async addChapter(mangaId, { title, number, files }) {
    const db = await this.ensureDB();
    
    const pages = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const dataUrl = await this.fileToDataUrl(file);
        pages.push({
          index: i,
          name: file.name,
          dataUrl,
          size: file.size
        });
      }
    }

    const chapter = {
      id: this.generateId(),
      mangaId,
      title: title || `Chapter ${number || '1'}`,
      chapter: String(number || '1'),
      pages,
      pageCount: pages.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Save chapter
    await new Promise((resolve, reject) => {
      const tx = db.transaction('chapters', 'readwrite');
      const store = tx.objectStore('chapters');
      const req = store.add(chapter);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Update manga chapter count
    const manga = await this.getManga(mangaId);
    if (manga) {
      manga.chapterCount = (manga.chapterCount || 0) + 1;
      manga.updatedAt = Date.now();
      if (!manga.chapters) manga.chapters = [];
      manga.chapters.push({
        id: chapter.id,
        title: chapter.title,
        chapter: chapter.chapter,
        pageCount: chapter.pageCount,
        createdAt: chapter.createdAt
      });
      
      await new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(manga);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    return chapter;
  }

  async getManga(id) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllManga() {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getChapters(mangaId) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('chapters', 'readonly');
      const store = tx.objectStore('chapters');
      const index = store.index('mangaId');
      const req = index.getAll(mangaId);
      req.onsuccess = () => {
        const chapters = (req.result || []).sort((a,b) => parseFloat(a.chapter) - parseFloat(b.chapter));
        resolve(chapters);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getChapter(chapterId) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('chapters', 'readonly');
      const store = tx.objectStore('chapters');
      const req = store.get(chapterId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteManga(id) {
    const db = await this.ensureDB();
    // Delete chapters first
    const chapters = await this.getChapters(id);
    for (const chap of chapters) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('chapters', 'readwrite');
        const store = tx.objectStore('chapters');
        const req = store.delete(chap.id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteChapter(chapterId) {
    const db = await this.ensureDB();
    const chapter = await this.getChapter(chapterId);
    
    await new Promise((resolve, reject) => {
      const tx = db.transaction('chapters', 'readwrite');
      const store = tx.objectStore('chapters');
      const req = store.delete(chapterId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Update manga
    if (chapter) {
      const manga = await this.getManga(chapter.mangaId);
      if (manga && manga.chapters) {
        manga.chapters = manga.chapters.filter(c => c.id !== chapterId);
        manga.chapterCount = manga.chapters.length;
        manga.updatedAt = Date.now();
        
        await new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          const req = store.put(manga);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    }
  }

  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = e => reject(e);
      reader.readAsDataURL(file);
    });
  }

  // Export manga as JSON (for backup)
  async exportManga(id) {
    const manga = await this.getManga(id);
    const chapters = await this.getChapters(id);
    return { manga, chapters, exportedAt: new Date().toISOString(), version: 1 };
  }

  // Import manga
  async importManga(data) {
    const db = await this.ensureDB();
    if (!data.manga || !data.manga.id) throw new Error('Invalid import data');
    
    // Save manga
    await new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.put(data.manga);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Save chapters
    if (data.chapters && Array.isArray(data.chapters)) {
      for (const chap of data.chapters) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction('chapters', 'readwrite');
          const store = tx.objectStore('chapters');
          const req = store.put(chap);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    }

    return data.manga;
  }
}

const uploadManager = new MangaUploadManager();

if (typeof window !== 'undefined') {
  window.uploadManager = uploadManager;
}

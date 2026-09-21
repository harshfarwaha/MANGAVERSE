// MangaVerse - All Free Manga Aggregator
// Combines: AniList + Jikan metadata, MangaDex free manga (20k+), Public Domain, Official Free, User Uploads
const ANILIST_API='https://graphql.anilist.co';
const JIKAN_API='https://api.jikan.moe/v4';
const MANGADEX_API='https://api.mangadex.org';

const state={page:1,perPage:24,search:'',genre:'',tag:'',sort:'POPULARITY_DESC',freePage:0,freeSort:'followedCount',freeFilter:'all',freeSearchType:'all'};
const cache=new Map();
let jikanNextRequestAt=0;

const ANILIST_QUERY=`query($page:Int,$perPage:Int,$search:String,$genre:String,$tag:String,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(type:MANGA,search:$search,genre:$genre,tag:$tag,sort:$sort){id siteUrl title{romaji english native}coverImage{large extraLarge}description(asHtml:false)genres tags{name} format status startDate{year}averageScore popularity chapters volumes countryOfOrigin isAdult externalLinks{url site{name} type}}}}`;
const DETAIL_QUERY=`query($id:Int){Media(id:$id,type:MANGA){id siteUrl title{romaji english native}coverImage{large extraLarge}description(asHtml:false)genres tags{name} format status startDate{year}averageScore popularity chapters volumes countryOfOrigin isAdult externalLinks{url site{name} type}}}`;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function titleOf(m){return m?.title?.english||m?.title?.romaji||m?.title?.native||m?.title||'Untitled Manga';}
function imageOf(m){return m?.coverImage?.extraLarge||m?.coverImage?.large||m?.cover||m?.coverThumb||'';}
function clean(v=''){return String(v).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();}

// AniList / Jikan
async function fetchAniList(o={}){const variables={page:o.page||1,perPage:Math.min(o.perPage||24,50),search:o.search||null,genre:o.genre||null,tag:o.tag||null,sort:[o.sort||'POPULARITY_DESC']};const r=await fetch(ANILIST_API,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:ANILIST_QUERY,variables})});if(!r.ok)throw Error(`AniList HTTP ${r.status}`);const j=await r.json();if(j.errors?.length)throw Error(j.errors[0].message);return {...j.data.Page,media:(j.data.Page.media||[]).map(x=>({...x,source:'anilist'}))};}
async function jikanFetch(url){const wait=Math.max(0,jikanNextRequestAt-Date.now());if(wait)await sleep(wait);jikanNextRequestAt=Date.now()+700;const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw Error(`Jikan HTTP ${r.status}`);const j=await r.json();if(!j?.data)throw Error('Jikan returned no data');return j;}
function genreId(n){return{Action:1,Adventure:2,Comedy:4,Drama:8,Fantasy:10,Horror:14,Mystery:7,Romance:22,SciFi:24,Sports:30,Supernatural:37,Psychological:40,Shounen:27,Seinen:42,Shoujo:25,Josei:43}[n]||null;}
function normalizeJikan(x){const img=x.images?.webp?.large_image_url||x.images?.jpg?.large_image_url||'';const t=x.title_english||x.title||x.title_japanese||'Untitled Manga';const genres=(x.genres||[]).map(g=>g.name);return{id:x.mal_id,source:'jikan',siteUrl:`https://myanimelist.net/manga/${x.mal_id}`,title:{english:t,romaji:x.title||t,native:x.title_japanese||''},coverImage:{large:img,extraLarge:img},description:x.synopsis||'',genres,tags:genres.map(name=>({name})),format:(x.type||'MANGA').toUpperCase(),status:x.status||'',startDate:{year:x.published?.from?new Date(x.published.from).getFullYear():null},averageScore:x.score?Math.round(x.score*10):null,popularity:x.members||0,chapters:x.chapters||null,volumes:x.volumes||null,countryOfOrigin:'JP',isAdult:false,externalLinks:[{url:`https://myanimelist.net/manga/${x.mal_id}`,site:{name:'MyAnimeList'},type:'INFO'}]};}
async function fetchJikan(o={}){const p=new URLSearchParams({page:String(o.page||1),limit:String(Math.min(o.perPage||24,25)),sfw:'true'});if(o.search)p.set('q',o.search);if(o.sort==='START_DATE_DESC'){p.set('order_by','start_date');p.set('sort','desc');}else{p.set('order_by','members');p.set('sort','desc');}const gid=genreId(o.tag||o.genre);if(gid)p.set('genres',String(gid));const j=await jikanFetch(`${JIKAN_API}/manga?${p}`);const total=j.pagination?.items?.total||0;return{media:(j.data||[]).map(normalizeJikan),pageInfo:{total,currentPage:o.page||1,lastPage:j.pagination?.last_visible_page||1,hasNextPage:!!j.pagination?.has_next_page}};}
async function fetchManga(o={}){const key=JSON.stringify(o);if(cache.has(key))return cache.get(key);const p=(async()=>{try{return await fetchAniList(o);}catch(e){console.warn('AniList failed; Jikan fallback',e);return fetchJikan(o);}})();cache.set(key,p);try{return await p;}catch(e){cache.delete(key);throw e;}}

// MangaDex legacy wrappers using free-manga.js
async function fetchMangaDexList(limit=18){
  if(window.freeMangaAPI){
    const res=await window.freeMangaAPI.fetchMangaDexFree({page:0,limit,order:'followedCount'});
    return res.manga.map(m=>({
      id:m.id,source:'mangadex',siteUrl:m.url,
      title:{english:m.title,romaji:m.title,native:''},
      coverImage:{large:m.cover,extraLarge:m.cover},
      description:m.description,genres:m.genres||[],tags:(m.tags||[]).map(t=>({name:t})),
      format:'MANGA',status:m.status,startDate:{year:m.year},averageScore:null,popularity:0,
      chapters:null,volumes:null,countryOfOrigin:'JP',isAdult:m.contentRating==='erotica'||m.contentRating==='pornographic',
      externalLinks:[{url:m.url,site:{name:'MangaDex'},type:'READ'}],
      _mangadexId:m.id,_freeData:m
    }));
  }
  return [];
}
function normalizeMangaDex(m,rels){
  const title=m.attributes?.title||{};const desc=m.attributes?.description||{};const descText=desc.en||Object.values(desc)[0]||'';const coverRel=(rels||[]).find(r=>r.type==='cover_art');const fileName=coverRel?.attributes?.fileName;const coverUrl=fileName?`https://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg`:'';const tagObjs=(m.attributes?.tags||[]).map(t=>({name:t.attributes?.name?.en||Object.values(t.attributes?.name||{})[0]||''})).filter(t=>t.name);const genres=[...new Set(tagObjs.map(t=>t.name))].slice(0,8);return{id:m.id,source:'mangadex',siteUrl:`https://mangadex.org/title/${m.id}`,title:{english:title.en||'',romaji:title.ja||title['ja-ro']||title.en||'',native:title.ja||''},coverImage:{large:coverUrl,extraLarge:coverUrl},description:descText,genres,tags:tagObjs,format:'MANGA',status:m.attributes?.status||'UNKNOWN',startDate:{year:m.attributes?.year||null},averageScore:null,popularity:0,chapters:null,volumes:null,countryOfOrigin:'JP',isAdult:m.attributes?.contentRating==='erotica'||m.attributes?.contentRating==='pornographic',externalLinks:[{url:`https://mangadex.org/title/${m.id}`,site:{name:'MangaDex'},type:'READ'}],_mangadexId:m.id};
}
async function getMangaDexChapters(mangaId,lang='en'){
  if(window.freeMangaAPI){
    const res=await window.freeMangaAPI.fetchChapters(mangaId,{language:lang,limit:20});
    return res.chapters.map(c=>({id:c.id,chapter:c.chapter,volume:c.volume,title:c.title,url:c.url,lang:c.language}));
  }
  return [];
}
async function searchMangaDex(query,limit=24){
  if(window.freeMangaAPI){
    const res=await window.freeMangaAPI.fetchMangaDexFree({page:0,limit,search:query});
    return res.manga.map(m=>({
      id:m.id,source:'mangadex',siteUrl:m.url,
      title:{english:m.title,romaji:m.title,native:''},
      coverImage:{large:m.cover,extraLarge:m.cover},
      description:m.description,genres:m.genres||[],tags:(m.tags||[]).map(t=>({name:t})),
      format:'MANGA',status:m.status,startDate:{year:m.year},averageScore:null,popularity:0,
      chapters:null,volumes:null,countryOfOrigin:'JP',isAdult:m.contentRating==='erotica'||m.contentRating==='pornographic',
      externalLinks:[{url:m.url,site:{name:'MangaDex'},type:'READ'}],
      _mangadexId:m.id,_freeData:m
    }));
  }
  return [];
}

// Library
const LIBRARY_KEY='mv_library_v1';
function loadLibrary(){try{return JSON.parse(localStorage.getItem(LIBRARY_KEY))||[];}catch{return[];}}
function saveLibrary(items){try{localStorage.setItem(LIBRARY_KEY,JSON.stringify(items));}catch{}}
function libraryAdd(m,status='plan'){
  const items=loadLibrary();
  const key=`${m.source||'anilist'}:${m.id}`;
  const existing=items.find(x=>x.key===key);
  const entry={
    key,id:m.id,source:m.source||'anilist',status,
    title:titleOf(m),image:imageOf(m),
    genres:m.genres||[],format:m.format||'MANGA',
    siteUrl:linksOf(m)[0]?.url||m.siteUrl||m.url||'',
    addedAt:Date.now(),updatedAt:Date.now()
  };
  if(existing){Object.assign(existing,entry,{updatedAt:Date.now()});}
  else items.unshift(entry);
  saveLibrary(items);
  return items;
}
function libraryRemove(key){const items=loadLibrary().filter(x=>x.key!==key);saveLibrary(items);return items;}
function librarySetStatus(key,status){const items=loadLibrary();const it=items.find(x=>x.key===key);if(it){it.status=status;it.updatedAt=Date.now();saveLibrary(items);}return items;}
function libraryEntryFor(m){return loadLibrary().find(x=>x.key===`${m.source||'anilist'}:${m.id}`);}
function renderLibrary(filter='all'){
  const grid=document.getElementById('libraryGrid');
  if(!grid)return;
  let items=loadLibrary();
  if(filter!=='all'){
    if(filter==='uploads') items=items.filter(x=>x.source==='user-upload');
    else items=items.filter(x=>x.status===filter||(filter==='favorites'&&x.status==='favorites'));
  }
  if(!items.length){grid.innerHTML='<div class="empty-state">No titles yet. Open any manga and tap bookmark, or upload your own original manga in My Uploads.</div>';return;}
  grid.innerHTML=items.map(x=>{
    const star=x.status==='favorites'?'★':'';
    return `<article class="card" tabindex="0" data-key="${esc(x.key)}"><div class="cover">${x.image?`<img loading="lazy" src="${esc(x.image)}" alt="${esc(x.title)} cover" onerror="this.onerror=null;this.remove();this.parentElement.classList.add('no-cover')"><span class="rank">${star||esc(x.format)}</span>`:`<div class="cover-fallback">${esc(x.title.slice(0,2).toUpperCase())}</div><span class="rank">${star||esc(x.format)}</span>`}</div><div class="card-title">${esc(x.title)}</div><div class="card-meta">${esc(x.status)}</div></article>`;
  }).join('');
  grid.querySelectorAll('.card').forEach(el=>{
    el.addEventListener('click',()=>{
      const entry=loadLibrary().find(x=>x.key===el.dataset.key);
      if(entry?.source==='user-upload'){
        openUserMangaDetail(entry.id);
      } else if(entry?.siteUrl) window.open(entry.siteUrl,'_blank','noopener,noreferrer');
    });
  });
}

function linksOf(m){const a=[];const seen=new Set();for(const l of(m.externalLinks||[])){if(/^https?:\/\//i.test(l?.url||'')&&!seen.has(l.url)){seen.add(l.url);a.push({url:l.url,name:l.site?.name||'Source'});}}if(m.siteUrl&&!seen.has(m.siteUrl))a.unshift({url:m.siteUrl,name:m.source==='jikan'?'MyAnimeList':m.source==='mangadex'?'MangaDex':'AniList'});if(m.url&&!seen.has(m.url))a.unshift({url:m.url,name:'MangaDex'});return a.slice(0,3);}

// Cards
function card(m,i=''){
  const img=imageOf(m),t=titleOf(m),src=m.source||'anilist';
  const badge = src==='mangadex' ? 'FREE' : src==='user-upload' ? 'YOURS' : m.averageScore ? `${Math.round(m.averageScore)}%` : 'MV';
  const isFree = src==='mangadex' || src==='user-upload';
  return `<article class="card" tabindex="0" data-id="${esc(String(m.id))}" data-source="${esc(src)}" ${isFree?'data-free="1"':''}><div class="cover">${img?`<img loading="lazy" src="${esc(img)}" alt="${esc(t)} cover" onerror="this.onerror=null;this.remove();this.parentElement.classList.add('no-cover')"><div class="cover-fallback" style="display:none">MV</div>`:`<div class="cover-fallback">${esc(t.slice(0,2).toUpperCase())}</div>`}<span class="rank" style="${isFree?'background:#ff3b30;color:#fff;':''}">${i?`#${i}`:badge}</span>${m.isAdult?'<span class="card-badge adult">18+</span>':''}${isFree?'<span class="free-badge">FREE</span>':''}</div><div class="card-title">${esc(t)}</div><div class="card-meta">${esc(m.format||'MANGA')} · ${esc(m.status||'UNKNOWN')}${src==='user-upload'?' · YOUR UPLOAD':''}</div></article>`;
}

function freeCard(m,i=''){
  const t=m.title||titleOf(m);
  const img=m.cover||imageOf(m);
  const author=m.author||'';
  return `<article class="card" tabindex="0" data-id="${esc(String(m.id||m.mangadexId||''))}" data-source="mangadex" data-free="1"><div class="cover">${img?`<img loading="lazy" src="${esc(img)}" alt="${esc(t)} cover" onerror="this.onerror=null;this.remove();this.parentElement.classList.add('no-cover')">`:`<div class="cover-fallback">${esc(t.slice(0,2).toUpperCase())}</div>`}<span class="rank" style="background:#ff3b30;color:#fff;">FREE</span><span class="free-badge">READ NOW</span></div><div class="card-title">${esc(t)}</div><div class="card-meta">${esc(author||m.status||'Ongoing')} · ${esc((m.genres||[]).slice(0,2).join(', ')||'Manga')}</div></article>`;
}

function userCard(m){
  return `<article class="card" tabindex="0" data-id="${esc(m.id)}" data-source="user-upload"><div class="cover">${m.cover?`<img src="${esc(m.cover)}" alt="${esc(m.title)}">`:`<div class="cover-fallback">${esc(m.title.slice(0,2).toUpperCase())}</div>`}<span class="rank" style="background:#7c3aed;color:#fff;">YOURS</span><span class="free-badge" style="background:#7c3aed;">${m.chapterCount||0} CH</span></div><div class="card-title">${esc(m.title)}</div><div class="card-meta">${esc(m.status||'ongoing')} · ${m.chapterCount||0} chapters · Your upload</div></article>`;
}

function dedupe(a){const s=new Set();return(a||[]).filter(x=>{const k=`${x.source||'anilist'}:${x.id||x.mangadexId}`;if(s.has(k))return false;s.add(k);return true;});}

function bindCards(root=document){
  root.querySelectorAll('.card').forEach(el=>{
    if(el.dataset.bound)return;
    el.dataset.bound='1';
    const open=()=>{
      const src=el.dataset.source||'anilist';
      if(src==='user-upload') openUserMangaDetail(el.dataset.id);
      else openDetail(el.dataset.id,src);
    };
    el.onclick=open;
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
  });
}

function renderRail(id,media){
  const el=document.getElementById(id);
  if(!el)return;
  const a=dedupe(media);
  el.innerHTML=a.length?a.map((m,i)=>card(m,i+1)).join(''):'<div class="empty-state">No manga found.</div>';
  bindCards(el);
}

function renderFreeRail(id,media){
  const el=document.getElementById(id);
  if(!el)return;
  el.innerHTML=media.length?media.map((m,i)=>freeCard(m,i+1)).join(''):'<div class="empty-state">No free manga found. Try another filter.</div>';
  bindCards(el);
}

async function loadSection(id,o){
  try{
    const r=await fetchManga(o);
    renderRail(id,r.media);
    return r;
  }catch(e){
    console.error(id,e);
    const el=document.getElementById(id);
    if(el)el.innerHTML='<div class="empty-state error-state">Unable to load this section. Use Search to retry.</div>';
    return{media:[],pageInfo:{total:0}};
  }
}

// FREE MANGA AGGREGATOR - LOAD ALL FREE
let freeMangaCache=[];
let freeTotal=0;

async function loadFreeAll({page=0,sort='followedCount',filter='all',append=false}={}){
  const rail=document.getElementById('freeAllRail');
  const totalEl=document.getElementById('freeTotal');
  
  if(!append){
    rail.innerHTML='<div class="skeleton-row"></div>';
    freeMangaCache=[];
    state.freePage=0;
  }

  try{
    let res;
    if(filter==='trending'){
      res=await window.freeMangaAPI.getTrendingFree(32);
    } else if(filter==='latest'){
      res=await window.freeMangaAPI.getLatestFree(32);
    } else if(filter==='new'){
      res=await window.freeMangaAPI.getNewFree(32);
    } else if(['action','fantasy','romance','comedy','drama','horror'].includes(filter)){
      res=await window.freeMangaAPI.getByGenre(filter,32);
    } else {
      res=await window.freeMangaAPI.fetchMangaDexFree({page,limit:32,order:sort});
    }

    freeTotal=res.total||0;
    if(totalEl) totalEl.textContent=`${freeTotal.toLocaleString()} total free titles on MangaDex · Page ${page+1}`;
    
    if(append) freeMangaCache=[...freeMangaCache,...(res.manga||[])];
    else freeMangaCache=res.manga||[];
    
    renderFreeRail('freeAllRail',freeMangaCache);
    
    // Update stats
    const countEl=document.getElementById('catalogCount');
    if(countEl) countEl.textContent=`${freeTotal.toLocaleString()}+`;
    const label=document.getElementById('catalogLabel');
    if(label) label.textContent=`FREE MANGA AGGREGATOR · ${freeTotal.toLocaleString()}+ FREE TITLES · LIVE`;
    
    const statEl=document.getElementById('statMangadex');
    if(statEl) statEl.textContent=`${freeTotal.toLocaleString()}+`;
    
  }catch(e){
    console.error('loadFreeAll failed',e);
    if(!append) rail.innerHTML='<div class="empty-state error-state">Failed to load free manga. MangaDex may be rate limiting — try again in a moment.</div>';
  }
}

async function loadHome(){
  // Load free aggregator first - this is the main feature
  if(window.freeMangaAPI){
    await loadFreeAll({page:0,sort:state.freeSort,filter:state.freeFilter});
  }

  // Metadata sections
  const sections=[
    ['trendingRail',{page:1,perPage:18,sort:'POPULARITY_DESC'}],
    ['shonenRail',{page:1,perPage:18,tag:'Shounen',sort:'POPULARITY_DESC'}],
    ['seinenRail',{page:1,perPage:18,tag:'Seinen',sort:'POPULARITY_DESC'}],
    ['actionRail',{page:1,perPage:18,genre:'Action',sort:'POPULARITY_DESC'}],
    ['fantasyRail',{page:1,perPage:18,genre:'Fantasy',sort:'POPULARITY_DESC'}],
    ['romanceRail',{page:1,perPage:18,genre:'Romance',sort:'POPULARITY_DESC'}]
  ];
  for(const[id,o] of sections) await loadSection(id,o);

  // MangaDex free rail
  try{
    const md=await fetchMangaDexList(18);
    renderRail('mangadexRail',md);
  }catch(e){
    console.error('MangaDex',e);
    const el=document.getElementById('mangadexRail');
    if(el)el.innerHTML='<div class="empty-state">Free read list temporarily unavailable.</div>';
  }

  // Official sources grid
  renderOfficialSources();
  
  // User uploads
  await renderUploads();
  renderLibrary('all');
  
  // Update upload stat
  try{
    const uploads=await window.uploadManager.getAllManga();
    document.getElementById('statUploads').textContent=uploads.length;
  }catch{}
}

function renderOfficialSources(){
  const grid=document.getElementById('officialGrid');
  if(!grid||!window.OFFICIAL_FREE_SOURCES)return;
  
  grid.innerHTML=window.OFFICIAL_FREE_SOURCES.map(s=>`
    <article class="pdf-card" style="border-color:${s.color}40;">
      <span style="color:${s.color};background:${s.color}15%;padding:4px 8px;border-radius:6px;">${esc(s.freeCount)} · OFFICIAL</span>
      <h3 style="color:${s.color}">${esc(s.name)}</h3>
      <p>${esc(s.publisher)} · ${esc(s.description.slice(0,90))}...</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">${s.tags.map(t=>`<span class="tag" style="font-size:9px;">${esc(t)}</span>`).join('')}</div>
      <a class="primary-btn" href="${esc(s.url)}" target="_blank" rel="noopener" style="background:${s.color};">Open ${esc(s.logo)} →</a>
    </article>
  `).join('');
}

async function renderUploads(){
  const grid=document.getElementById('uploadsGrid');
  if(!grid)return;
  
  try{
    const uploads=await window.uploadManager.getAllManga();
    if(!uploads.length){
      grid.innerHTML='<div class="empty-state">No uploads yet. Click Upload to publish your original manga. Your creations will appear here and in My Library.</div>';
      return;
    }
    
    grid.innerHTML=uploads.map(m=>userCard(m)).join('');
    
    grid.querySelectorAll('.card').forEach(el=>{
      if(el.dataset.bound)return;
      el.dataset.bound='1';
      el.addEventListener('click',()=>openUserMangaDetail(el.dataset.id));
    });
    
  }catch(e){
    console.error('renderUploads',e);
    grid.innerHTML='<div class="empty-state">Failed to load uploads. IndexedDB may not be available.</div>';
  }
}

async function getDetail(id,source){
  if(source==='mangadex'){
    const r=await fetch(`${MANGADEX_API}/manga/${id}?includes[]=cover_art&includes[]=author`,{headers:{Accept:'application/json'}});
    if(!r.ok) throw new Error(`MangaDex HTTP ${r.status}`);
    const j=await r.json();
    if(!j.data) throw new Error('MangaDex returned no data');
    const rels=j.relationships||[];
    const normalized=normalizeMangaDex(j.data,rels);
    // Enhance with free API data if available
    if(window.freeMangaAPI){
      try{
        const freeData=window.freeMangaAPI.normalizeMangaDex(j.data);
        normalized._freeData=freeData;
      }catch{}
    }
    return normalized;
  }
  if(source==='jikan'){const j=await jikanFetch(`${JIKAN_API}/manga/${id}/full`);return normalizeJikan(j.data);}
  const r=await fetch(ANILIST_API,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:DETAIL_QUERY,variables:{id}})});if(!r.ok)throw Error(`Detail HTTP ${r.status}`);const j=await r.json();if(j.errors?.length||!j.data?.Media)throw Error('Manga details unavailable');return{...j.data.Media,source:'anilist'};
}

async function openDetail(id,source='anilist'){
  const d=document.getElementById('detailDialog'),b=document.getElementById('detailContent');
  if(!d||!b)return;
  b.innerHTML='<p class="eyebrow">LOADING PANEL...</p><h2>Opening story</h2><div class="skeleton-row" style="height:200px;margin-top:14px;"></div>';
  d.showModal();
  try{
    const m=await getDetail(id,source);
    const title=titleOf(m);
    const links=linksOf(m);
    const genres=[...new Set([...(m.genres||[]),...(m.tags||[]).map(x=>x.name||x)])].slice(0,10);
    const libKey=`${m.source||'anilist'}:${m.id}`;
    const libEntry=libraryEntryFor(m);
    const isFav=libEntry?.status==='favorites';
    
    const bookmarkBtn=`<button class="ghost-btn bookmark-btn" data-key="${esc(libKey)}" data-action="bookmark" style="font-size:13px;padding:10px 15px;margin-bottom:10px">${libEntry?`<span class="bm-label">★ In Library (${libEntry.status})</span>`:'+ Add to Library'}</button>`;
    const favBtn=`<button class="ghost-btn fav-btn" data-key="${esc(libKey)}" data-action="fav" style="font-size:13px;padding:10px 15px;margin-bottom:10px;${isFav?'color:#ffd60a;border-color:#ffd60a':''}">${isFav?'★ Favorited':'☆ Add to Favorites'}</button>`;
    
    const sourceButtons=links.length
      ?links.map(l=>`<a class="primary-btn source-btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Open ${esc(l.name)} →</a>`).join('')
      :'<span class="source-note">No external source is listed for this title.</span>';

    // MangaDex chapters with reader links
    let mdChapters='';
    if(m.source==='mangadex'||m._mangadexId){
      try{
        const chapRes=await window.freeMangaAPI.fetchChapters(m._mangadexId||String(m.id),{language:'en',limit:30});
        if(chapRes.chapters.length){
          mdChapters=`<div class="md-chapters"><p class="eyebrow" style="margin-top:18px">FREE ON MANGADEX · ${chapRes.total} CHAPTERS · READ IN APP</p><div class="chap-list">${chapRes.chapters.map(c=>`<a class="chap-btn" href="reader.html?manga=${esc(m._mangadexId||m.id)}&chapter=${esc(c.id)}"><span>Ch.${c.chapter||'?'} — ${esc(c.title||'').slice(0,40)}</span><span style="font-size:10px;color:#aaa7b0;">${esc(c.scanlationGroup||'')} →</span></a>`).join('')}</div><a class="ghost-btn" href="https://mangadex.org/title/${esc(m._mangadexId||m.id)}" target="_blank" rel="noopener" style="margin-top:10px;font-size:12px;">View all ${chapRes.total} chapters on MangaDex →</a></div>`;
        }
      }catch(e){console.error('chapters',e);}
    }

    const isFree = m.source==='mangadex';
    const freeBadge = isFree ? `<span style="background:#ff3b30;color:#fff;padding:4px 10px;border-radius:999px;font:800 10px Rajdhani;letter-spacing:.1em;">FREE TO READ · ${m._freeData?.availableLanguages?.join(', ')||'EN'}</span>` : '';

    b.innerHTML=`<div class="detail-layout"><img class="detail-cover" src="${esc(imageOf(m))}" alt="${esc(title)} cover"><div class="detail-copy"><p class="eyebrow">${esc(m.format||'MANGA')} · ${esc(m.status||'UNKNOWN')} ${isFree?'· FREE':''}</p><h2>${esc(title)}</h2>${freeBadge}<p style="margin-top:12px;">${esc(clean(m.description||'No description available.'))}</p><div class="tags">${genres.map(g=>`<span class="tag">${esc(g)}</span>`).join('')}</div><div class="detail-stats"><span>★ ${m.averageScore?`${Math.round(m.averageScore)}%`:'—'}</span><span>Ch. ${m.chapters||'—'}</span><span>Vol. ${m.volumes||'—'}</span><span>${m.startDate?.year||''}</span></div>${bookmarkBtn}${favBtn}<div class="source-actions" style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">${sourceButtons}</div>${mdChapters}<p class="source-note" style="margin-top:16px;">${isFree?'This manga is free to read via MangaDex public API. Images load from MangaDex CDN via at-home server — MangaVerse does not host or mirror.':'MangaVerse does not host copyrighted chapters. These buttons open sources listed by the metadata provider. For free manga, browse the Free section powered by MangaDex.'}</p></div></div>`;
    
    b.querySelectorAll('[data-action="bookmark"]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const entry=libraryEntryFor(m);
        if(entry){libraryRemove(entry.key);}else{libraryAdd(m,'reading');}
        openDetail(id,source);
        renderLibrary('all');
      });
    });
    b.querySelectorAll('[data-action="fav"]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const entry=libraryEntryFor(m);
        if(entry&&entry.status==='favorites'){librarySetStatus(entry.key,'reading');}else{libraryAdd(m,'favorites');}
        openDetail(id,source);
        renderLibrary('all');
      });
    });
  }catch(e){console.error(e);b.innerHTML='<div class="empty-state error-state"><h2>Could not open this manga.</h2><p>The source is temporarily unavailable. Please try again.</p><p style="font-size:11px;color:#71717a;margin-top:10px;">'+esc(e.message)+'</p></div>';}
}

async function openUserMangaDetail(id){
  const d=document.getElementById('detailDialog'),b=document.getElementById('detailContent');
  if(!d||!b)return;
  b.innerHTML='<p class="eyebrow">LOADING YOUR MANGA...</p><h2>Opening</h2>';
  d.showModal();
  
  try{
    const manga=await window.uploadManager.getManga(id);
    if(!manga) throw new Error('Manga not found');
    
    const chapters=await window.uploadManager.getChapters(id);
    
    b.innerHTML=`
      <div class="detail-layout">
        <div>
          <img class="detail-cover" src="${esc(manga.cover||'')}" alt="${esc(manga.title)} cover" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />
          <div class="cover-fallback" style="display:none;width:100%;aspect-ratio:2/3;border-radius:18px;background:linear-gradient(145deg,#1a1a22,#0a0a0e);place-items:center;font:900 32px Rajdhani;">${esc(manga.title.slice(0,2).toUpperCase())}</div>
          <div style="margin-top:12px;display:grid;gap:8px;">
            <button class="primary-btn" id="addChapBtn" style="width:100%;">+ Add Chapter</button>
            <button class="ghost-btn" id="editMangaBtn" style="width:100%;">Edit Manga</button>
            <button class="ghost-btn" id="deleteMangaBtn" style="width:100%;color:#ff3b30;border-color:#ff3b3040;">Delete Manga</button>
            <button class="ghost-btn" id="exportMangaBtn" style="width:100%;">Export JSON</button>
          </div>
        </div>
        <div class="detail-copy">
          <p class="eyebrow">YOUR ORIGINAL · ${esc(manga.status||'ongoing').toUpperCase()} · ${manga.chapterCount||0} CHAPTERS</p>
          <h2>${esc(manga.title)}</h2>
          <p style="color:#aaa7b0;font-size:13px;">by ${esc(manga.author||'You')} · ${new Date(manga.createdAt).toLocaleDateString()}</p>
          <p>${esc(manga.description||'No description.')}</p>
          <div class="tags">${(manga.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>
          
          <div class="md-chapters" style="margin-top:20px;">
            <p class="eyebrow">YOUR CHAPTERS · ${chapters.length} TOTAL · READ IN APP</p>
            <div class="chap-list">
              ${chapters.length ? chapters.map(c=>`
                <div class="chap-btn" style="display:flex;justify-content:space-between;align-items:center;">
                  <a href="reader.html?manga=${esc(manga.id)}&chapter=${esc(c.id)}&source=user" style="color:#fff;text-decoration:none;flex:1;">
                    <span>Ch.${esc(c.chapter)} — ${esc(c.title)}</span><br>
                    <span style="font-size:10px;color:#aaa7b0;">${c.pageCount} pages</span>
                  </a>
                  <button class="ghost-btn" data-del-chap="${esc(c.id)}" style="padding:4px 8px;font-size:10px;color:#ff3b30;">Delete</button>
                </div>
              `).join('') : '<div class="empty-state">No chapters yet. Add your first chapter!</div>'}
            </div>
          </div>
          
          <p class="source-note">This is your original manga stored locally in IndexedDB. It never leaves your device unless you export it. You retain all rights.</p>
        </div>
      </div>
    `;
    
    document.getElementById('addChapBtn')?.addEventListener('click',()=>{
      d.close();
      openChapterDialog(manga.id);
    });
    
    document.getElementById('deleteMangaBtn')?.addEventListener('click',async()=>{
      if(confirm(`Delete "${manga.title}" and all its chapters? This cannot be undone.`)){
        await window.uploadManager.deleteManga(manga.id);
        d.close();
        await renderUploads();
        renderLibrary('all');
        document.getElementById('statUploads').textContent=(await window.uploadManager.getAllManga()).length;
      }
    });
    
    document.getElementById('exportMangaBtn')?.addEventListener('click',async()=>{
      const data=await window.uploadManager.exportManga(manga.id);
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=`${manga.title.replace(/[^a-z0-9]/gi,'_')}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    
    b.querySelectorAll('[data-del-chap]').forEach(btn=>{
      btn.addEventListener('click',async(e)=>{
        e.stopPropagation();
        const chapId=btn.dataset.delChap;
        if(confirm('Delete this chapter?')){
          await window.uploadManager.deleteChapter(chapId);
          openUserMangaDetail(id);
          await renderUploads();
        }
      });
    });
    
  }catch(e){
    console.error(e);
    b.innerHTML=`<div class="empty-state error-state"><h2>Could not open your manga.</h2><p>${esc(e.message)}</p></div>`;
  }
}

function openChapterDialog(mangaId){
  const dialog=document.getElementById('chapterDialog');
  document.getElementById('chapterMangaId').value=mangaId;
  dialog.showModal();
}

// Search
async function search(){
  const box=document.getElementById('searchResults');
  if(!box)return;
  box.innerHTML='<div class="search-loading">SEARCHING ALL FREE MANGA...</div>';
  try{
    const tasks=[];
    
    // If free search type is mangadex or all, search free manga API
    if(state.freeSearchType==='all' || state.freeSearchType==='mangadex'){
      if(window.freeMangaAPI && state.search){
        tasks.push(window.freeMangaAPI.searchAllFree(state.search,24).catch(()=>({mangadex:[],publicDomain:[],official:[]}))); 
      }
    }
    
    // Metadata search
    tasks.push(fetchManga({page:state.page,perPage:state.perPage,search:state.search,genre:state.genre,tag:state.tag,sort:state.sort}).catch(()=>({media:[],pageInfo:{total:0,currentPage:1,lastPage:1,hasNextPage:false}})));
    
    if(state.search) tasks.push(searchMangaDex(state.search,18).catch(()=>[]));
    
    const results=await Promise.all(tasks);
    
    let freeResults=null;
    let primary, mdResults;
    
    if(results[0] && results[0].mangadex){
      freeResults=results[0];
      primary=results[1];
      mdResults=results[2]||[];
    } else {
      primary=results[0];
      mdResults=results[1]||[];
    }
    
    const all=[...(primary.media||[]),...mdResults];
    if(freeResults){
      all.push(...(freeResults.mangadex.map(m=>({
        id:m.id,source:'mangadex',siteUrl:m.url,
        title:{english:m.title,romaji:m.title,native:''},
        coverImage:{large:m.cover,extraLarge:m.cover},
        description:m.description,genres:m.genres||[],tags:(m.tags||[]).map(t=>({name:t})),
        format:'MANGA',status:m.status,startDate:{year:m.year},
        _mangadexId:m.id
      }))||[]));
    }
    
    const m=dedupe(all);
    const total=(primary.pageInfo?.total||0)+mdResults.length+(freeResults?.mangadex?.length||0);
    
    let extraHTML='';
    if(freeResults){
      if(freeResults.publicDomain.length){
        extraHTML+=`<div style="margin-top:20px;"><p class="eyebrow">PUBLIC DOMAIN · ${freeResults.publicDomain.length} RESULTS</p><div class="free-pdf-grid">${freeResults.publicDomain.map(w=>`<article class="pdf-card"><span>PD · FREE</span><h3>${esc(w.title)}</h3><p>${esc(w.author||'')} · Public Domain</p><a class="primary-btn" href="${esc(w.url)}" target="_blank">Open →</a></article>`).join('')}</div></div>`;
      }
      if(freeResults.official.length){
        extraHTML+=`<div style="margin-top:20px;"><p class="eyebrow">OFFICIAL FREE SOURCES · ${freeResults.official.length} RESULTS</p><div class="free-pdf-grid">${freeResults.official.map(s=>`<article class="pdf-card" style="border-color:${s.color}40;"><span style="color:${s.color}">${esc(s.freeCount)}</span><h3>${esc(s.name)}</h3><p>${esc(s.description.slice(0,80))}...</p><a class="primary-btn" href="${esc(s.url)}" target="_blank" style="background:${s.color};">Open →</a></article>`).join('')}</div></div>`;
      }
    }
    
    box.innerHTML=`<div class="search-summary"><span>${total.toLocaleString()} results (including ${freeResults?.mangadex?.length||0} free)</span><span>Page ${primary.pageInfo?.currentPage||1} / ${primary.pageInfo?.lastPage||1}</span></div><div class="search-grid">${m.map(x=>card(x)).join('')}</div>${extraHTML}<div class="pagination"><button class="page-btn" id="previousPage" ${state.page<=1?'disabled':''}>← Previous</button><button class="page-btn" id="nextPage" ${primary.pageInfo?.hasNextPage?'':'disabled'}>Next →</button></div>`;
    bindCards(box);
    document.getElementById('previousPage')?.addEventListener('click',async()=>{if(state.page>1){state.page--;await search();}});
    document.getElementById('nextPage')?.addEventListener('click',async()=>{if(primary.pageInfo?.hasNextPage){state.page++;await search();}});
  }catch(e){console.error(e);box.innerHTML='<div class="empty-state error-state">Search is temporarily unavailable.</div>';}
}

function setup(){
  const dialog=document.getElementById('searchDialog');
  const open=()=>{dialog?.showModal();setTimeout(()=>document.getElementById('searchInput')?.focus(),100);};
  ['openSearch','heroSearch','bottomSearch'].forEach(id=>document.getElementById(id)?.addEventListener('click',open));
  document.getElementById('closeSearch')?.addEventListener('click',()=>dialog?.close());
  document.getElementById('searchForm')?.addEventListener('submit',async e=>{e.preventDefault();state.search=document.getElementById('searchInput')?.value.trim()||'';state.page=1;await search();});
  document.getElementById('sortSelect')?.addEventListener('change',async e=>{state.sort=e.target.value;state.page=1;await search();});
  
  // Free filters
  document.querySelectorAll('[data-free]').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const filter=btn.dataset.free;
      state.freeFilter=filter;
      document.querySelectorAll('[data-free]').forEach(b=>b.classList.toggle('active',b===btn));
      state.freePage=0;
      await loadFreeAll({page:0,sort:state.freeSort,filter});
    });
  });
  
  document.getElementById('freeSort')?.addEventListener('change',async e=>{
    state.freeSort=e.target.value;
    await loadFreeAll({page:0,sort:state.freeSort,filter:state.freeFilter});
  });
  
  document.getElementById('loadMoreFree')?.addEventListener('click',async()=>{
    state.freePage++;
    await loadFreeAll({page:state.freePage,sort:state.freeSort,filter:state.freeFilter,append:true});
  });
  
  document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',async()=>{
    if(btn.dataset.lib){
      const f=btn.dataset.lib;
      const parent=btn.parentElement;
      parent.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===btn));
      if(f==='uploads') await renderUploads();
      else renderLibrary(f);
      return;
    }
    if(btn.dataset.freeSearch){
      state.freeSearchType=btn.dataset.freeSearch;
      btn.parentElement.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===btn));
      if(state.search) await search();
      return;
    }
    if(btn.dataset.free) return; // handled above
    state.genre=btn.dataset.genre||'';state.tag=btn.dataset.tag||'';state.sort='POPULARITY_DESC';state.page=1;
    const sort=document.getElementById('sortSelect');if(sort)sort.value='POPULARITY_DESC';
    document.querySelectorAll('.filter[data-genre],.filter[data-tag]').forEach(x=>x.classList.toggle('active',x===btn));
    await search();
  }));
  
  document.querySelectorAll('.see-all[data-query]').forEach(btn=>btn.addEventListener('click',async e=>{e.preventDefault();dialog?.showModal();state.search='';state.page=1;state.genre='';state.tag='';state.sort='POPULARITY_DESC';const q=btn.dataset.query;if(q==='SHONEN')state.tag='Shounen';if(q==='SEINEN')state.tag='Seinen';if(q==='ACTION')state.genre='Action';if(q==='FANTASY')state.genre='Fantasy';if(q==='ROMANCE')state.genre='Romance';if(q==='NEW')state.sort='START_DATE_DESC';document.getElementById('searchInput').value='';const sort=document.getElementById('sortSelect');if(sort)sort.value=state.sort;document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));await search();}));
  
  document.getElementById('seeAllMangadex')?.addEventListener('click',async e=>{
    e.preventDefault();
    const box=document.getElementById('searchResults');
    if(!box)return;
    box.innerHTML='<div class="search-loading">LOADING ALL 20K+ FREE MANGA FROM MANGADEX...</div>';
    document.getElementById('searchDialog')?.showModal();
    try{
      const res=await window.freeMangaAPI.fetchMangaDexFree({page:0,limit:50,order:'followedCount'});
      box.innerHTML=`<div class="search-summary"><span>${res.total.toLocaleString()} total free titles · Showing ${res.manga.length}</span><span>Free to read on MangaDex</span></div><div class="search-grid">${res.manga.map(x=>freeCard(x)).join('')}</div><div style="margin-top:20px;text-align:center;"><button class="primary-btn" id="loadMoreSearchFree">Load More Free →</button></div>`;
      bindCards(box);
      let searchPage=0;
      document.getElementById('loadMoreSearchFree')?.addEventListener('click',async()=>{
        searchPage++;
        const more=await window.freeMangaAPI.fetchMangaDexFree({page:searchPage,limit:50,order:'followedCount'});
        const grid=box.querySelector('.search-grid');
        grid.insertAdjacentHTML('beforeend',more.manga.map(x=>freeCard(x)).join(''));
        bindCards(grid);
      });
    }catch(e){box.innerHTML='<div class="empty-state error-state">MangaDex list temporarily unavailable.</div>';}
  });
  
  document.getElementById('clearLibrary')?.addEventListener('click',()=>{
    if(confirm('Clear your entire library? This cannot be undone.')){
      saveLibrary([]);renderLibrary('all');
    }
  });
  
  document.getElementById('exploreBtn')?.addEventListener('click',()=>document.getElementById('freeAll')?.scrollIntoView({behavior:'smooth'}));
  document.getElementById('closeDetail')?.addEventListener('click',()=>document.getElementById('detailDialog')?.close());

  // Upload dialogs
  const uploadDialog=document.getElementById('uploadDialog');
  const openUpload=()=>uploadDialog?.showModal();
  document.getElementById('openUpload')?.addEventListener('click',openUpload);
  document.getElementById('openUpload2')?.addEventListener('click',openUpload);
  document.getElementById('closeUpload')?.addEventListener('click',()=>uploadDialog?.close());
  document.getElementById('cancelUpload')?.addEventListener('click',()=>uploadDialog?.close());
  
  const chapterDialog=document.getElementById('chapterDialog');
  document.getElementById('closeChapter')?.addEventListener('click',()=>chapterDialog?.close());
  
  // Upload form
  document.getElementById('uploadForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const title=document.getElementById('uploadTitle').value.trim();
    const author=document.getElementById('uploadAuthor').value.trim();
    const desc=document.getElementById('uploadDesc').value.trim();
    const tags=document.getElementById('uploadTags').value.split(',').map(t=>t.trim()).filter(Boolean);
    const status=document.getElementById('uploadStatus').value;
    const coverFile=document.getElementById('uploadCover').files[0];
    const pagesFiles=document.getElementById('uploadPages').files;
    
    if(!title){alert('Title is required');return;}
    
    const progress=document.getElementById('uploadProgress');
    const bar=document.getElementById('uploadBar');
    progress.style.display='block';
    bar.style.width='20%';
    
    try{
      const manga=await window.uploadManager.createManga({title,author,description:desc,coverFile,tags,status});
      bar.style.width='60%';
      
      if(pagesFiles.length>0){
        await window.uploadManager.addChapter(manga.id,{title:`Chapter 1`,number:'1',files:Array.from(pagesFiles)});
      }
      bar.style.width='100%';
      
      setTimeout(async()=>{
        progress.style.display='none';
        bar.style.width='0%';
        uploadDialog.close();
        e.target.reset();
        await renderUploads();
        renderLibrary('all');
        document.getElementById('statUploads').textContent=(await window.uploadManager.getAllManga()).length;
        alert(`"${manga.title}" uploaded successfully! Find it in My Uploads and My Library.`);
        document.getElementById('myUploads').scrollIntoView({behavior:'smooth'});
      },500);
      
    }catch(err){
      console.error(err);
      alert('Upload failed: '+err.message);
      progress.style.display='none';
    }
  });
  
  document.getElementById('chapterForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const mangaId=document.getElementById('chapterMangaId').value;
    const number=document.getElementById('chapterNumber').value.trim()||'1';
    const title=document.getElementById('chapterTitle').value.trim()||`Chapter ${number}`;
    const files=document.getElementById('chapterPages').files;
    
    if(!files.length){alert('Select at least one page image');return;}
    
    try{
      await window.uploadManager.addChapter(mangaId,{title,number,files:Array.from(files)});
      chapterDialog.close();
      e.target.reset();
      await renderUploads();
      openUserMangaDetail(mangaId);
    }catch(err){
      alert('Failed to add chapter: '+err.message);
    }
  });
  
  // Drag & drop upload zone
  const zone=document.getElementById('uploadZone');
  const fileInput=document.getElementById('fileInput');
  if(zone){
    zone.addEventListener('click',()=>fileInput.click());
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragover');});
    zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));
    zone.addEventListener('drop',e=>{
      e.preventDefault();
      zone.classList.remove('dragover');
      const files=e.dataTransfer.files;
      if(files.length){
        openUpload();
        document.getElementById('uploadPages').files=files;
      }
    });
  }
  fileInput?.addEventListener('change',()=>{
    if(fileInput.files.length){
      openUpload();
      document.getElementById('uploadPages').files=fileInput.files;
    }
  });
  document.getElementById('uploadBtn')?.addEventListener('click',e=>{
    e.stopPropagation();
    fileInput.click();
  });
}

setup();
loadHome();

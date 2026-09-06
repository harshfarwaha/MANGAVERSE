const ANILIST_API='https://graphql.anilist.co';
const JIKAN_API='https://api.jikan.moe/v4';
const MANGADEX_API='https://api.mangadex.org';
const state={page:1,perPage:24,search:'',genre:'',tag:'',sort:'POPULARITY_DESC'};
const cache=new Map();let jikanNextRequestAt=0;
const ANILIST_QUERY=`query($page:Int,$perPage:Int,$search:String,$genre:String,$tag:String,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(type:MANGA,search:$search,genre:$genre,tag:$tag,sort:$sort){id siteUrl title{romaji english native}coverImage{large extraLarge}description(asHtml:false)genres tags{name} format status startDate{year}averageScore popularity chapters volumes countryOfOrigin isAdult externalLinks{url site{name} type}}}}`;
const DETAIL_QUERY=`query($id:Int){Media(id:$id,type:MANGA){id siteUrl title{romaji english native}coverImage{large extraLarge}description(asHtml:false)genres tags{name} format status startDate{year}averageScore popularity chapters volumes countryOfOrigin isAdult externalLinks{url site{name} type}}}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function esc(v=''){return String(v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
function titleOf(m){return m?.title?.english||m?.title?.romaji||m?.title?.native||'Untitled Manga';}
function imageOf(m){return m?.coverImage?.extraLarge||m?.coverImage?.large||'';}
function clean(v=''){return String(v).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();}
async function fetchAniList(o={}){const variables={page:o.page||1,perPage:Math.min(o.perPage||24,50),search:o.search||null,genre:o.genre||null,tag:o.tag||null,sort:[o.sort||'POPULARITY_DESC']};const r=await fetch(ANILIST_API,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:ANILIST_QUERY,variables})});if(!r.ok)throw Error(`AniList HTTP ${r.status}`);const j=await r.json();if(j.errors?.length)throw Error(j.errors[0].message);return {...j.data.Page,media:(j.data.Page.media||[]).map(x=>({...x,source:'anilist'}))};}
async function jikanFetch(url){const wait=Math.max(0,jikanNextRequestAt-Date.now());if(wait)await sleep(wait);jikanNextRequestAt=Date.now()+700;const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw Error(`Jikan HTTP ${r.status}`);const j=await r.json();if(!j?.data)throw Error('Jikan returned no data');return j;}
function genreId(n){return{Action:1,Adventure:2,Comedy:4,Drama:8,Fantasy:10,Horror:14,Mystery:7,Romance:22,SciFi:24,Sports:30,Supernatural:37,Psychological:40,Shounen:27,Seinen:42,Shoujo:25,Josei:43}[n]||null;}
function normalizeJikan(x){const img=x.images?.webp?.large_image_url||x.images?.jpg?.large_image_url||'';const t=x.title_english||x.title||x.title_japanese||'Untitled Manga';const genres=(x.genres||[]).map(g=>g.name);return{id:x.mal_id,source:'jikan',siteUrl:`https://myanimelist.net/manga/${x.mal_id}`,title:{english:t,romaji:x.title||t,native:x.title_japanese||''},coverImage:{large:img,extraLarge:img},description:x.synopsis||'',genres,tags:genres.map(name=>({name})),format:(x.type||'MANGA').toUpperCase(),status:x.status||'',startDate:{year:x.published?.from?new Date(x.published.from).getFullYear():null},averageScore:x.score?Math.round(x.score*10):null,popularity:x.members||0,chapters:x.chapters||null,volumes:x.volumes||null,countryOfOrigin:'JP',isAdult:false,externalLinks:[{url:`https://myanimelist.net/manga/${x.mal_id}`,site:{name:'MyAnimeList'},type:'INFO'}]};}
async function fetchJikan(o={}){const p=new URLSearchParams({page:String(o.page||1),limit:String(Math.min(o.perPage||24,25)),sfw:'true'});if(o.search)p.set('q',o.search);if(o.sort==='START_DATE_DESC'){p.set('order_by','start_date');p.set('sort','desc');}else{p.set('order_by','members');p.set('sort','desc');}const gid=genreId(o.tag||o.genre);if(gid)p.set('genres',String(gid));const j=await jikanFetch(`${JIKAN_API}/manga?${p}`);const total=j.pagination?.items?.total||0;return{media:(j.data||[]).map(normalizeJikan),pageInfo:{total,currentPage:o.page||1,lastPage:j.pagination?.last_visible_page||1,hasNextPage:!!j.pagination?.has_next_page}};}
async function fetchManga(o={}){const key=JSON.stringify(o);if(cache.has(key))return cache.get(key);const p=(async()=>{try{return await fetchAniList(o);}catch(e){console.warn('AniList failed; Jikan fallback',e);return fetchJikan(o);}})();cache.set(key,p);try{return await p;}catch(e){cache.delete(key);throw e;}}

// ============== MangaDex integration ==============
// MangaDex is a public, community-driven platform. Their public API
// exposes metadata for titles that are independently published,
// creator-permitted, or officially licensed for free distribution.
// MangaVerse never rehosts — every button opens the MangaDex reader.
async function fetchMangaDexList(limit=18){
  const p=new URLSearchParams();
  p.set('limit',String(limit));
  p.set('order[followedCount]','desc');
  p.append('includes[]','cover_art');
  const r=await fetch(`${MANGADEX_API}/manga?${p}`,{headers:{Accept:'application/json'}});
  if(!r.ok) throw new Error(`MangaDex HTTP ${r.status}`);
  const j=await r.json();
  return (j.data||[]).map(x=>normalizeMangaDex(x,j.relationships||[]));
}
function normalizeMangaDex(m,rels){
  const title=m.attributes?.title||{};
  const desc=m.attributes?.description||{};
  const descText=desc.en||Object.values(desc)[0]||'';
  const coverRel=(rels||[]).find(r=>r.type==='cover_art');
  const fileName=coverRel?.attributes?.fileName;
  const coverUrl=fileName?`https://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg`:'';
  const tagObjs=(m.attributes?.tags||[]).map(t=>({name:t.attributes?.name?.en||Object.values(t.attributes?.name||{})[0]||''})).filter(t=>t.name);
  const genres=[...new Set(tagObjs.map(t=>t.name))].slice(0,8);
  return {
    id:m.id,source:'mangadex',
    siteUrl:`https://mangadex.org/title/${m.id}`,
    title:{english:title.en||'',romaji:title.ja||title['ja-ro']||title.en||'',native:title.ja||''},
    coverImage:{large:coverUrl,extraLarge:coverUrl},
    description:descText,genres,tags:tagObjs,
    format:'MANGA',status:m.attributes?.status||'UNKNOWN',
    startDate:{year:m.attributes?.year||null},
    averageScore:null,popularity:0,chapters:null,volumes:null,
    countryOfOrigin:'JP',isAdult:m.attributes?.contentRating==='erotica'||m.attributes?.contentRating==='pornographic',
    externalLinks:[{url:`https://mangadex.org/title/${m.id}`,site:{name:'MangaDex'},type:'READ'}],
    _mangadexId:m.id
  };
}
async function getMangaDexChapters(mangaId,lang='en'){
  const p=new URLSearchParams();
  p.set('limit','10');
  p.append('translatedLanguage[]',lang);
  p.set('order[chapter]','asc');
  p.append('includes[]','user');
  const r=await fetch(`${MANGADEX_API}/manga/${mangaId}/feed?${p}`,{headers:{Accept:'application/json'}});
  if(!r.ok) return [];
  const j=await r.json();
  return (j.data||[]).map(c=>({
    id:c.id,chapter:c.attributes?.chapter,volume:c.attributes?.volume,
    title:c.attributes?.title||`Chapter ${c.attributes?.chapter||''}`,
    url:`https://mangadex.org/chapter/${c.id}`,lang:c.attributes?.translatedLanguage
  }));
}
async function searchMangaDex(query,limit=24){
  const p=new URLSearchParams();
  p.set('limit',String(limit));
  p.set('title',query);
  p.append('includes[]','cover_art');
  const r=await fetch(`${MANGADEX_API}/manga?${p}`,{headers:{Accept:'application/json'}});
  if(!r.ok) return [];
  const j=await r.json();
  return (j.data||[]).map(x=>normalizeMangaDex(x,j.relationships||[]));
}

// ============== Reading tracker (localStorage) ==============
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
    siteUrl:linksOf(m)[0]?.url||m.siteUrl||'',
    addedAt:Date.now(),updatedAt:Date.now()
  };
  if(existing){Object.assign(existing,entry,{updatedAt:Date.now()});}
  else items.unshift(entry);
  saveLibrary(items);
  return items;
}
function libraryRemove(key){const items=loadLibrary().filter(x=>x.key!==key);saveLibrary(items);return items;}
function librarySetStatus(key,status){const items=loadLibrary();const it=items.find(x=>x.key===key);if(it){it.status=status;it.updatedAt=Date.now();saveLibrary(items);}return items;}
function inLibrary(m){return loadLibrary().some(x=>x.key===`${m.source||'anilist'}:${m.id}`);}
function libraryEntryFor(m){return loadLibrary().find(x=>x.key===`${m.source||'anilist'}:${m.id}`);}
function renderLibrary(filter='all'){
  const grid=document.getElementById('libraryGrid');
  if(!grid)return;
  let items=loadLibrary();
  if(filter!=='all')items=items.filter(x=>x.status===filter||(filter==='favorites'&&x.status==='favorites'));
  if(!items.length){grid.innerHTML='<div class="empty-state">No titles yet. Open any manga and tap the bookmark button to add it here.</div>';return;}
  grid.innerHTML=items.map(x=>{
    const star=x.status==='favorites'?'★':'';
    return `<article class="card" tabindex="0" data-key="${esc(x.key)}"><div class="cover">${x.image?`<img loading="lazy" src="${esc(x.image)}" alt="${esc(x.title)} cover" onerror="this.onerror=null;this.remove();this.parentElement.classList.add('no-cover')">`:'<div class="cover-fallback">MV</div>'}<span class="rank">${star||esc(x.format)}</span></div><div class="card-title">${esc(x.title)}</div><div class="card-meta">${esc(x.status)}</div></article>`;
  }).join('');
  grid.querySelectorAll('.card').forEach(el=>{
    el.addEventListener('click',()=>{
      const entry=loadLibrary().find(x=>x.key===el.dataset.key);
      if(entry?.siteUrl)window.open(entry.siteUrl,'_blank','noopener,noreferrer');
    });
  });
}
function linksOf(m){const a=[];const seen=new Set();for(const l of(m.externalLinks||[])){if(/^https?:\/\//i.test(l?.url||'')&&!seen.has(l.url)){seen.add(l.url);a.push({url:l.url,name:l.site?.name||'Source'});}}if(m.siteUrl&&!seen.has(m.siteUrl))a.unshift({url:m.siteUrl,name:m.source==='jikan'?'MyAnimeList':'AniList'});return a.slice(0,3);}
function card(m,i=''){const img=imageOf(m),t=titleOf(m),src=m.source||'anilist';return `<article class="card" tabindex="0" data-id="${esc(String(m.id))}" data-source="${esc(src)}"><div class="cover">${img?`<img loading="lazy" src="${esc(img)}" alt="${esc(t)} cover" onerror="this.onerror=null;this.remove();this.parentElement.classList.add('no-cover')">`:'<div class="cover-fallback">MV</div>'}<span class="rank">${i?`#${i}`:m.averageScore?`${Math.round(m.averageScore)}%`:src==='mangadex'?'MD':'MV'}</span>${m.isAdult?'<span class="card-badge adult">18+</span>':''}</div><div class="card-title">${esc(t)}</div><div class="card-meta">${esc(m.format||'MANGA')} · ${esc(m.status||'UNKNOWN')}</div></article>`;}
function dedupe(a){const s=new Set();return(a||[]).filter(x=>{const k=`${x.source}:${x.id}`;if(s.has(k))return false;s.add(k);return true;});}
function bindCards(root=document){root.querySelectorAll('.card').forEach(el=>{if(el.dataset.bound)return;el.dataset.bound='1';const open=()=>openDetail(el.dataset.id,el.dataset.source);el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});}
function renderRail(id,media){const el=document.getElementById(id);if(!el)return;const a=dedupe(media);el.innerHTML=a.length?a.map((m,i)=>card(m,i+1)).join(''):'<div class="empty-state">No manga found.</div>';bindCards(el);}
async function loadSection(id,o){try{const r=await fetchManga(o);renderRail(id,r.media);return r;}catch(e){console.error(id,e);const el=document.getElementById(id);if(el)el.innerHTML='<div class="empty-state error-state">Unable to load this section. Use Search to retry.</div>';return{media:[],pageInfo:{total:0}};}}
async function loadHome(){const sections=[['trendingRail',{page:1,perPage:18,sort:'POPULARITY_DESC'}],['shonenRail',{page:1,perPage:18,tag:'Shounen',sort:'POPULARITY_DESC'}],['seinenRail',{page:1,perPage:18,tag:'Seinen',sort:'POPULARITY_DESC'}],['actionRail',{page:1,perPage:18,genre:'Action',sort:'POPULARITY_DESC'}],['fantasyRail',{page:1,perPage:18,genre:'Fantasy',sort:'POPULARITY_DESC'}],['romanceRail',{page:1,perPage:18,genre:'Romance',sort:'POPULARITY_DESC'}],['newRail',{page:1,perPage:18,sort:'START_DATE_DESC'}]];const results=[];for(const[id,o] of sections)results.push(await loadSection(id,o));const total=Math.max(...results.map(x=>x.pageInfo?.total||0),0);if(total){const count=document.getElementById('catalogCount');if(count)count.textContent=`${total.toLocaleString()}+`;const l=document.getElementById('catalogLabel');if(l)l.textContent=`LIVE CATALOGUE · ${total.toLocaleString()}+ MANGA ENTRIES`;}try{const md=await fetchMangaDexList(18);renderRail('mangadexRail',md);}catch(e){console.error('MangaDex',e);const el=document.getElementById('mangadexRail');if(el)el.innerHTML='<div class="empty-state">Free read list temporarily unavailable.</div>';}renderLibrary('all');}
async function getDetail(id,source){
  if(source==='mangadex'){
    const p=new URLSearchParams();
    p.append('includes[]','cover_art');
    const r=await fetch(`${MANGADEX_API}/manga/${id}?${p}`,{headers:{Accept:'application/json'}});
    if(!r.ok) throw new Error(`MangaDex HTTP ${r.status}`);
    const j=await r.json();
    if(!j.data) throw new Error('MangaDex returned no data');
    const rels=j.relationships||[];
    return normalizeMangaDex(j.data,rels);
  }
  if(source==='jikan'){const j=await jikanFetch(`${JIKAN_API}/manga/${id}/full`);return normalizeJikan(j.data);}
  const r=await fetch(ANILIST_API,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:DETAIL_QUERY,variables:{id}})});if(!r.ok)throw Error(`Detail HTTP ${r.status}`);const j=await r.json();if(j.errors?.length||!j.data?.Media)throw Error('Manga details unavailable');return{...j.data.Media,source:'anilist'};
}
async function openDetail(id,source='anilist'){
  const d=document.getElementById('detailDialog'),b=document.getElementById('detailContent');
  if(!d||!b)return;
  b.innerHTML='<p class="eyebrow">LOADING PANEL...</p><h2>Opening story</h2>';
  d.showModal();
  try{
    const m=await getDetail(id,source);
    const title=titleOf(m);
    const links=linksOf(m);
    const genres=[...new Set([...(m.genres||[]),...(m.tags||[]).map(x=>x.name)])].slice(0,10);
    const libKey=`${m.source||'anilist'}:${m.id}`;
    const libEntry=libraryEntryFor(m);
    const isFav=libEntry?.status==='favorites';
    const bookmarkBtn=`<button class="ghost-btn bookmark-btn" data-key="${esc(libKey)}" data-action="bookmark" style="font-size:13px;padding:10px 15px;margin-bottom:10px">
      ${libEntry?`<span class="bm-label">★ In Library (${libEntry.status})</span>`:'+ Add to Library'}
    </button>`;
    const favBtn=`<button class="ghost-btn fav-btn" data-key="${esc(libKey)}" data-action="fav" style="font-size:13px;padding:10px 15px;margin-bottom:10px;${isFav?'color:#ffd60a;border-color:#ffd60a':''}">
      ${isFav?'★ Favorited':'☆ Add to Favorites'}
    </button>`;
    const sourceButtons=links.length
      ?links.map(l=>`<a class="primary-btn source-btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Open ${esc(l.name)} →</a>`).join('')
      :'<span class="source-note">No external source is listed for this title.</span>';
    // MangaDex chapters
    let mdChapters='';
    if(m.source==='mangadex'||m._mangadexId){
      try{
        const chaps=await getMangaDexChapters(m._mangadexId||String(m.id));
        if(chaps.length){
          mdChapters=`<div class="md-chapters"><p class="eyebrow" style="margin-top:14px">FREE ON MANGADEX · ${chaps.length} CHAPTERS</p><div class="chap-list">${chaps.map(c=>`<a class="chap-btn" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Ch.${c.chapter||'?'} — ${esc(c.title||'').slice(0,40)}</a>`).join('')}</div></div>`;
        }
      }catch{}
    }
    b.innerHTML=`<div class="detail-layout"><img class="detail-cover" src="${esc(imageOf(m))}" alt="${esc(title)} cover"><div class="detail-copy"><p class="eyebrow">${esc(m.format||'MANGA')} · ${esc(m.status||'UNKNOWN')}</p><h2>${esc(title)}</h2><p>${esc(clean(m.description||'No description available.'))}</p><div class="tags">${genres.map(g=>`<span class="tag">${esc(g)}</span>`).join('')}</div><div class="detail-stats"><span>★ ${m.averageScore?`${Math.round(m.averageScore)}%`:'—'}</span><span>Ch. ${m.chapters||'—'}</span><span>Vol. ${m.volumes||'—'}</span></div>${bookmarkBtn}${favBtn}<div class="source-actions">${sourceButtons}</div>${mdChapters}<p class="source-note">MangaVerse does not host copyrighted chapters. These buttons open sources listed by the metadata provider.</p></div></div>`;
    // Bind bookmark / fav buttons
    b.querySelectorAll('[data-action="bookmark"]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const entry=libraryEntryFor(m);
        if(entry){libraryRemove(entry.key);}else{libraryAdd(m,'reading');}
        openDetail(id,source);
      });
    });
    b.querySelectorAll('[data-action="fav"]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const entry=libraryEntryFor(m);
        if(entry&&entry.status==='favorites'){librarySetStatus(entry.key,'reading');}else{libraryAdd(m,'favorites');}
        openDetail(id,source);
      });
    });
  }catch(e){console.error(e);b.innerHTML='<div class="empty-state error-state"><h2>Could not open this manga.</h2><p>The source is temporarily unavailable. Please try again.</p></div>';}
}
async function search(){
  const box=document.getElementById('searchResults');
  if(!box)return;
  box.innerHTML='<div class="search-loading">SEARCHING THE VERSE...</div>';
  try{
    const tasks=[];
    tasks.push(fetchManga({page:state.page,perPage:state.perPage,search:state.search,genre:state.genre,tag:state.tag,sort:state.sort}).catch(()=>({media:[],pageInfo:{total:0,currentPage:1,lastPage:1,hasNextPage:false}})));
    if(state.search)tasks.push(searchMangaDex(state.search,18).catch(()=>[]));
    const results=await Promise.all(tasks);
    const primary=results[0];
    const mdResults=results[1]||[];
    const all=[...(primary.media||[]),...mdResults];
    const m=dedupe(all);
    const total=(primary.pageInfo?.total||0)+mdResults.length;
    box.innerHTML=`<div class="search-summary"><span>${total.toLocaleString()} results</span><span>Page ${primary.pageInfo?.currentPage||1} / ${primary.pageInfo?.lastPage||1}${mdResults.length?` · +${mdResults.length} MangaDex`:''}</span></div><div class="search-grid">${m.map(x=>card(x)).join('')}</div><div class="pagination"><button class="page-btn" id="previousPage" ${state.page<=1?'disabled':''}>← Previous</button><button class="page-btn" id="nextPage" ${primary.pageInfo?.hasNextPage?'':'disabled'}>Next →</button></div>`;
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
  document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',async()=>{
    if(btn.dataset.lib){
      const f=btn.dataset.lib;
      const parent=btn.parentElement;
      parent.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===btn));
      renderLibrary(f);
      return;
    }
    state.genre=btn.dataset.genre||'';state.tag=btn.dataset.tag||'';state.sort='POPULARITY_DESC';state.page=1;
    const sort=document.getElementById('sortSelect');if(sort)sort.value='POPULARITY_DESC';
    document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===btn));
    await search();
  }));
  document.querySelectorAll('.see-all[data-query]').forEach(btn=>btn.addEventListener('click',async e=>{e.preventDefault();dialog?.showModal();state.search='';state.page=1;state.genre='';state.tag='';state.sort='POPULARITY_DESC';const q=btn.dataset.query;if(q==='SHONEN')state.tag='Shounen';if(q==='SEINEN')state.tag='Seinen';if(q==='ACTION')state.genre='Action';if(q==='FANTASY')state.genre='Fantasy';if(q==='ROMANCE')state.genre='Romance';if(q==='NEW')state.sort='START_DATE_DESC';document.getElementById('searchInput').value='';const sort=document.getElementById('sortSelect');if(sort)sort.value=state.sort;document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));await search();}));
  document.getElementById('seeAllMangadex')?.addEventListener('click',async e=>{
    e.preventDefault();
    const box=document.getElementById('searchResults');
    if(!box)return;
    box.innerHTML='<div class="search-loading">LOADING MANGADEX...</div>';
    document.getElementById('searchDialog')?.showModal();
    try{
      const md=await fetchMangaDexList(50);
      box.innerHTML=`<div class="search-summary"><span>${md.length} titles</span><span>Free to read on MangaDex</span></div><div class="search-grid">${md.map(x=>card(x)).join('')}</div>`;
      bindCards(box);
    }catch(e){box.innerHTML='<div class="empty-state error-state">MangaDex list temporarily unavailable.</div>';}
  });
  document.getElementById('clearLibrary')?.addEventListener('click',()=>{
    if(confirm('Clear your entire library? This cannot be undone.')){
      saveLibrary([]);renderLibrary('all');
    }
  });
  document.getElementById('exploreBtn')?.addEventListener('click',()=>document.getElementById('explore')?.scrollIntoView({behavior:'smooth'}));
  document.getElementById('closeDetail')?.addEventListener('click',()=>document.getElementById('detailDialog')?.close());
}
setup();loadHome();

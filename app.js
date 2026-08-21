const API='https://graphql.anilist.co';
const JIKAN='https://api.jikan.moe/v4';
const state={page:1,genre:'',tag:'',search:'',perPage:24,loading:false};
const cache=new Map();
let jikanNextAt=0;

const query=`query($page:Int,$perPage:Int,$search:String,$genre:String,$tag:String,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(type:MANGA,status_in:[FINISHED,RELEASING,NOT_YET_RELEASED,CANCELLED],search:$search,genre:$genre,tag:$tag,sort:$sort){id title{romaji english native}coverImage{large extraLarge}description(asHtml:false)genres tags{name} format status startDate{year}averageScore popularity chapters volumes countryOfOrigin}}}}`;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function fetchAniList({page=1,perPage=24,search='',genre='',tag='',sort=['POPULARITY_DESC']}={}){
  const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query,variables:{page,perPage,search:search||null,genre:genre||null,tag:tag||null,sort}})});
  if(!res.ok) throw new Error(`AniList request failed (${res.status})`);
  const json=await res.json();
  if(json.errors?.length) throw new Error(json.errors[0].message);
  if(!json.data?.Page) throw new Error('AniList returned no catalogue data');
  return json.data.Page;
}

async function jikanFetch(url){
  const wait=Math.max(0,jikanNextAt-Date.now());
  if(wait) await sleep(wait);
  jikanNextAt=Date.now()+400;
  const res=await fetch(url,{headers:{Accept:'application/json'}});
  if(!res.ok) throw new Error(`Jikan request failed (${res.status})`);
  const json=await res.json();
  if(!json?.data) throw new Error('Jikan returned no manga data');
  return json;
}

function normalizeJikan(item){
  const title=item.title_english||item.title||item.title_japanese||'Untitled Manga';
  const genres=(item.genres||[]).map(g=>g.name);
  const image=item.images?.webp?.large_image_url||item.images?.jpg?.large_image_url||item.images?.webp?.image_url||item.images?.jpg?.image_url||'';
  const statusMap={Publishing:'RELEASING','Finished:' :'FINISHED'};
  return {id:item.mal_id,title:{english:title,romaji:item.title||title,native:item.title_japanese||''},coverImage:{large:image,extraLarge:image},description:item.synopsis||'',genres,tags:genres.map(name=>({name})),format:(item.type||'Manga').toUpperCase(),status:statusMap[item.status]||item.status||'',startDate:{year:item.published?.from?new Date(item.published.from).getFullYear():null},averageScore:item.score?Math.round(item.score*10):null,popularity:item.members||0,chapters:item.chapters||null,volumes:item.volumes||null,countryOfOrigin:'JP',source:'Jikan / MyAnimeList'};
}

async function fetchJikan({page=1,perPage=24,search='',genre='',tag='',sort=['POPULARITY_DESC']}={}){
  const params=new URLSearchParams({page:String(page),limit:String(Math.min(perPage,25)),sfw:'true'});
  if(search) params.set('q',search);
  if(genre) params.set('genres',genre==='Action'?'1':genre==='Fantasy'?'10':genre==='Romance'?'22':genre);
  if(tag==='Shounen') params.set('genres','27');
  if(tag==='Seinen') params.set('genres','41');
  if(sort.includes('START_DATE_DESC')){params.set('order_by','start_date');params.set('sort','desc');}
  else {params.set('order_by','members');params.set('sort','desc');}
  const json=await jikanFetch(`${JIKAN}/manga?${params}`);
  const total=json.pagination?.items?.total||0;
  const last=json.pagination?.last_visible_page||Math.max(1,Math.ceil(total/perPage));
  return {media:(json.data||[]).map(normalizeJikan),pageInfo:{total,currentPage:page,lastPage:last,hasNextPage:!!json.pagination?.has_next_page}};
}

async function fetchManga(options={}){
  const key=JSON.stringify(options);
  if(cache.has(key)) return cache.get(key);
  const promise=(async()=>{
    try{return await fetchAniList(options);}
    catch(primaryError){
      console.warn('AniList unavailable; using Jikan fallback.',primaryError);
      return await fetchJikan(options);
    }
  })();
  cache.set(key,promise);
  try{return await promise}catch(err){cache.delete(key);throw err}
}

function escapeHTML(value=''){return String(value).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
function titleOf(m){return m.title.english||m.title.romaji||m.title.native||'Untitled Manga'}
function card(m,index=''){const image=m.coverImage?.extraLarge||m.coverImage?.large||'';return `<article class="card" tabindex="0" data-id="${m.id}"><div class="cover"><img loading="lazy" src="${image}" alt="${escapeHTML(titleOf(m))} cover" onerror="this.onerror=null;this.style.display='none'"><span class="rank">${index?`#${index}`:m.averageScore?`${Math.round(m.averageScore)}%`:'MV'}</span></div><div class="card-title">${escapeHTML(titleOf(m))}</div><div class="card-meta">${escapeHTML(m.format||'MANGA')} · ${escapeHTML(m.status||'')}</div></article>`}
function renderRail(id,media){document.getElementById(id).innerHTML=media.map((m,i)=>card(m,i+1)).join('')}
function bindCards(root=document){root.querySelectorAll('.card').forEach(el=>{el.onclick=()=>openDetail(Number(el.dataset.id));el.onkeydown=e=>{if(e.key==='Enter')openDetail(Number(el.dataset.id))}})}

async function loadHome(){
  try{
    const [trending,shonen,seinen,newManga]=await Promise.all([
      fetchManga({perPage:12,sort:['TRENDING_DESC']}),
      fetchManga({perPage:12,tag:'Shounen',sort:['POPULARITY_DESC']}),
      fetchManga({perPage:12,tag:'Seinen',sort:['POPULARITY_DESC']}),
      fetchManga({perPage:12,sort:['START_DATE_DESC']})
    ]);
    renderRail('trendingRail',trending.media);renderRail('shonenRail',shonen.media);renderRail('seinenRail',seinen.media);renderRail('newRail',newManga.media);bindCards();
    const total=Math.max(trending.pageInfo.total,shonen.pageInfo.total,seinen.pageInfo.total,newManga.pageInfo.total);
    const count=document.getElementById('catalogCount');if(count) count.textContent=`${total.toLocaleString()}+`;
    const label=document.getElementById('catalogLabel');if(label) label.textContent=`LIVE CATALOGUE · ${total.toLocaleString()}+ MANGA ENTRIES`;
  }catch(err){document.querySelectorAll('.skeleton-row').forEach(x=>x.textContent='Catalogue temporarily unavailable.');console.error(err)}
}

async function openDetail(id){
  const dialog=document.getElementById('detailDialog'),box=document.getElementById('detailContent');
  box.innerHTML='<p class="eyebrow">LOADING PANEL...</p><h2>Opening story</h2>';dialog.showModal();
  try{
    const q=`query($id:Int){Media(id:$id,type:MANGA){title{romaji english native}coverImage{extraLarge}description(asHtml:false)genres tags{name} format status startDate{year}averageScore popularity chapters volumes}}`;
    const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:q,variables:{id}})});
    if(!res.ok) throw new Error('AniList detail unavailable');
    const json=await res.json();if(json.errors?.length) throw new Error(json.errors[0].message);
    const m=json.data.Media;
    box.innerHTML=`<div class="detail-layout"><img class="detail-cover" src="${m.coverImage?.extraLarge||''}" alt="${escapeHTML(titleOf(m))} cover"><div class="detail-copy"><p class="eyebrow">${escapeHTML(m.format||'MANGA')} · ${escapeHTML(m.status||'')}</p><h2>${escapeHTML(titleOf(m))}</h2><p>${escapeHTML((m.description||'No description available.').replace(/<[^>]*>/g,''))}</p><div class="tags">${(m.genres||[]).map(g=>`<span class="tag">${escapeHTML(g)}</span>`).join('')}${(m.tags||[]).filter(t=>['Shounen','Seinen','Josei','Shoujo'].includes(t.name)).map(t=>`<span class="tag">${escapeHTML(t.name)}</span>`).join('')}</div><p><strong>${m.averageScore?`${m.averageScore}% rating`:'No rating'}</strong> · ${m.chapters||'?'} chapters · ${m.volumes||'?'} volumes</p><button class="primary-btn" onclick="alert('Reading content will only be connected here when an authorized/public-domain source is available.')">Read from authorized source →</button></div></div>`;
  }catch(err){box.innerHTML='<h2>Could not open this panel.</h2><p>Please try again.</p>';console.error(err)}
}

function setupSearch(){
  const dialog=document.getElementById('searchDialog');
  const open=()=>{dialog.showModal();setTimeout(()=>document.getElementById('searchInput').focus(),80)};
  ['openSearch','heroSearch','bottomSearch'].forEach(id=>document.getElementById(id).onclick=open);
  document.getElementById('closeSearch').onclick=()=>dialog.close();
  document.getElementById('searchForm').onsubmit=async e=>{e.preventDefault();state.search=document.getElementById('searchInput').value.trim();state.page=1;await search()};
  document.querySelectorAll('.filter').forEach(btn=>btn.onclick=async()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));btn.classList.add('active');state.genre=btn.dataset.genre;state.tag=btn.dataset.tag||'';state.page=1;await search()});
}
async function search(){const box=document.getElementById('searchResults');box.innerHTML='<p class="eyebrow">SEARCHING THE VERSE...</p>';try{const data=await fetchManga({page:state.page,perPage:state.perPage,search:state.search,genre:state.genre,tag:state.tag,sort:['POPULARITY_DESC']});box.innerHTML=`<p class="eyebrow">${data.pageInfo.total.toLocaleString()} CATALOGUE ENTRIES · PAGE ${data.pageInfo.currentPage}/${data.pageInfo.lastPage}</p>`+data.media.map(m=>card(m)).join('')+(data.pageInfo.hasNextPage?`<button class="page-btn" id="nextPage">Load more</button>`:'');bindCards(box);document.getElementById('nextPage')?.addEventListener('click',async()=>{state.page++;await search()})}catch(err){box.innerHTML='<p>Search is temporarily unavailable.</p>';console.error(err)}}

document.querySelectorAll('.see-all').forEach(btn=>btn.onclick=()=>{document.getElementById('searchDialog').showModal();state.search='';state.genre='';state.tag=btn.dataset.query==='SEINEN'?'Seinen':btn.dataset.query==='SHONEN'?'Shounen':'';document.getElementById('searchInput').value='';document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));document.querySelector('.filter[data-tag="'+state.tag+'"]')?.classList.add('active');search()});
document.getElementById('exploreBtn').onclick=()=>document.getElementById('explore').scrollIntoView({behavior:'smooth'});
document.getElementById('closeDetail').onclick=()=>document.getElementById('detailDialog').close();
setupSearch();loadHome();

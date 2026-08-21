const API='https://graphql.anilist.co';
const state={page:1,genre:'',tag:'',search:'',perPage:24,loading:false};
const cache=new Map();

const query=`query($page:Int,$perPage:Int,$search:String,$genre:String,$tag:String,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(type:MANGA,status_in:[FINISHED,RELEASING,NOT_YET_RELEASED,CANCELLED],search:$search,genre:$genre,tag:$tag,sort:$sort){id title{romaji english native}coverImage{large extraLarge}description(asHtml:false)genres tags{name} format status startDate{year}averageScore popularity chapters volumes countryOfOrigin}}}}`;

async function fetchManga({page=1,perPage=24,search='',genre='',tag='',sort=['POPULARITY_DESC']}={}){
  const key=JSON.stringify({page,perPage,search,genre,tag,sort});
  if(cache.has(key)) return cache.get(key);
  const promise=fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables:{page,perPage,search:search||null,genre:genre||null,tag:tag||null,sort}})})
    .then(async res=>{if(!res.ok) throw new Error(`Catalogue request failed (${res.status})`);return res.json()})
    .then(json=>{if(json.errors?.length) throw new Error(json.errors[0].message);return json.data.Page;});
  cache.set(key,promise);
  try{return await promise}catch(err){cache.delete(key);throw err}
}

function escapeHTML(value=''){return String(value).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
function titleOf(m){return m.title.english||m.title.romaji||m.title.native||'Untitled Manga'}
function card(m,index=''){return `<article class="card" tabindex="0" data-id="${m.id}"><div class="cover"><img loading="lazy" src="${m.coverImage?.extraLarge||m.coverImage?.large||''}" alt="${escapeHTML(titleOf(m))} cover" onerror="this.style.display='none'"><span class="rank">${index?`#${index}`:m.averageScore?`${Math.round(m.averageScore)}%`:'MV'}</span></div><div class="card-title">${escapeHTML(titleOf(m))}</div><div class="card-meta">${escapeHTML(m.format||'MANGA')} · ${escapeHTML(m.status||'')}</div></article>`}
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
  const dialog=document.getElementById('detailDialog'), box=document.getElementById('detailContent');
  box.innerHTML='<p class="eyebrow">LOADING PANEL...</p><h2>Opening story</h2>';dialog.showModal();
  try{
    const q=`query($id:Int){Media(id:$id,type:MANGA){title{romaji english native}coverImage{extraLarge}description(asHtml:false)genres tags{name} format status startDate{year}averageScore popularity chapters volumes}}`;
    const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q,variables:{id}})});const json=await res.json();const m=json.data.Media;
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

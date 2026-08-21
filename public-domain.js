const works = [
  ...Array.from({length:14},(_,i)=>({title:`Denshin kaishu Hokusai manga — Volume ${i+1}`,creator:'Katsushika Hokusai',url:`https://library.si.edu/digital-library/book/denshinkaishuhov${i+1}${[1,3,4,5,6,7,8,9,10,12,13,14].includes(i+1)?'kats':'katsa'}`})),
  {title:'Hokusai manga — Volume 2',creator:'Katsushika Hokusai',url:'https://library.si.edu/digital-library/book/hokusaimangav2kats'},
  {title:'Hokusai manga — Volume 4',creator:'Katsushika Hokusai',url:'https://library.si.edu/digital-library/book/hokusaimangav4kats'},
  {title:'Hokusai manga — Volume 5',creator:'Katsushika Hokusai',url:'https://library.si.edu/digital-library/book/hokusaimangav5katsa'},
  {title:'Hokusai manga — Volume 7',creator:'Katsushika Hokusai',url:'https://library.si.edu/digital-library/book/hokusaimangav7kats'},
  {title:'Hokusai manga — Volume 9',creator:'Katsushika Hokusai',url:'https://library.si.edu/digital-library/book/hokusaimangav9kats'},
  {title:'Hokusai manga — Volume 12',creator:'Katsushika Hokusai',url:'https://library.si.edu/digital-library/book/hokusaimangav12kats'}
];

document.getElementById('count').textContent=`${works.length} readable public-domain volumes`;
const grid=document.getElementById('grid');
grid.innerHTML=works.map((w,i)=>`<article class="pd-card"><div class="pd-cover"><span>MV ${String(i+1).padStart(2,'0')}</span></div><h2>${w.title}</h2><p class="pd-meta">${w.creator}<br>Historical Japanese illustrated book · Public domain source</p><a class="pd-btn" href="${w.url}" target="_blank" rel="noopener noreferrer">Read Online →</a><div class="pd-source">Opens the original Smithsonian reader</div></article>`).join('');

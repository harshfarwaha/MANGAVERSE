const suffix={1:'kats',2:'katsa',3:'kats',4:'katsa',5:'kats',6:'kats',7:'kats',8:'katsa',9:'kats',10:'kats',11:'katsa',12:'kats',13:'katsa',14:'kats'};
const works=[...Array.from({length:14},(_,i)=>{const n=i+1;return{title:`Denshin kaishu Hokusai manga — Volume ${n}`,creator:'Katsushika Hokusai',url:`https://library.si.edu/digital-library/book/denshinkaishuhov${n}${suffix[n]}`}}),
{title:'Hokusai manga — Volume 2',creator:'Katsushika Hokusai',url:'https://library.si.edu/digital-library/book/hokusaimangav2kats'},
{title:'Hokusai manga — Volume 4',creator:'Katsushika Hokusai',url:'https://library.si.edu/digital-library/book/hokusaimangav4kats'},
{title:'Hokusai manga — Volume 5',creator:'Katsushika Hokusai',url:'https://library.si.edu/digital-library/book/hokusaimangav5katsa'},
{title:'Hokusai manga — Volume 7',creator:'Katsushika Hokusai',url:'https://library.si.edu/digital-library/book/hokusaimangav7kats'},
{title:'Hokusai manga — Volume 9',creator:'Katsushika Hokusai',url:'https://library.si.edu/digital-library/book/hokusaimangav9kats'},
{title:'Hokusai manga — Volume 12',creator:'Katsushika Hokusai',url:'https://library.si.edu/digital-library/book/hokusaimangav12kats'}];

document.getElementById('count').textContent=`${works.length} readable public-domain volumes`;
document.getElementById('grid').innerHTML=works.map((w,i)=>`<article class="pd-card"><div class="pd-cover"><span>MV ${String(i+1).padStart(2,'0')}</span></div><h2>${w.title}</h2><p class="pd-meta">${w.creator}<br>Historical Japanese illustrated work · Public-domain source</p><a class="pd-btn" href="${w.url}" target="_blank" rel="noopener noreferrer">Read Online →</a><div class="pd-source">Opens the original Smithsonian reader</div></article>`).join('');

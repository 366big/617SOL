document.addEventListener('DOMContentLoaded',()=>{
 const menu=document.querySelector('.menu-btn');
 const links=document.querySelector('.nav-links');
 if(menu) menu.addEventListener('click',()=>links.classList.toggle('open'));
 document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>links?.classList.remove('open')));
 const path=location.pathname;
 document.querySelectorAll('.nav-links a').forEach(a=>{
   const href=a.getAttribute('href');
   if(href && ((path.endsWith('/')&&href==='index.html') || path.includes(href.replace('./','')))) a.classList.add('active');
 });
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.12});
 document.querySelectorAll('.reveal').forEach(e=>io.observe(e));
});


/* SOL interaction layer */
(function(){
  const fine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
  const desktop = window.innerWidth >= 851;
  if(!fine || !desktop) return;

  const cursor = document.createElement('div');
  cursor.className='sol-cursor';
  const dot = document.createElement('div');
  dot.className='sol-cursor-dot';
  document.body.append(cursor,dot);

  let tx=0,ty=0,cx=0,cy=0;
  window.addEventListener('mousemove',e=>{
    tx=e.clientX; ty=e.clientY;
    requestAnimationFrame(()=>{
      document.querySelectorAll('.card-spotlight').forEach(card=>{
        const r=card.getBoundingClientRect();
        if(e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom){
          card.style.setProperty('--mx',`${((e.clientX-r.left)/r.width)*100}%`);
          card.style.setProperty('--my',`${((e.clientY-r.top)/r.height)*100}%`);
        }
      });
    });
  },{passive:true});
  const loop=()=>{cx+=(tx-cx)*.22;cy+=(ty-cy)*.22;cursor.style.left=cx+'px';cursor.style.top=cy+'px';dot.style.left=tx+'px';dot.style.top=ty+'px';requestAnimationFrame(loop)};loop();

  const interactive=document.querySelectorAll('a,button,.hero-card,.value-card,.feature,.info-card,.apply-card,.apply-side,.step,.gallery-tile,.m-item');
  interactive.forEach(el=>{
    el.addEventListener('mouseenter',()=>cursor.classList.add('hover'));
    el.addEventListener('mouseleave',()=>cursor.classList.remove('hover'));
  });

  const cards=document.querySelectorAll('.hero-card,.value-card,.feature,.info-card,.apply-card,.apply-side,.gallery-tile');
  cards.forEach(card=>{
    card.classList.add('card-spotlight');
    card.addEventListener('mousemove',e=>{
      const r=card.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-.5;
      const y=(e.clientY-r.top)/r.height-.5;
      const max=card.classList.contains('hero-card')?3.5:2.2;
      card.style.transform=`perspective(1000px) rotateX(${(-y*max).toFixed(2)}deg) rotateY(${(x*max).toFixed(2)}deg) translateY(-3px)`;
    });
    card.addEventListener('mouseleave',()=>{card.style.transform='';});
  });
})();

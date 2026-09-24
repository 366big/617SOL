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

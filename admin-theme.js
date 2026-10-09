/* Mizan admin light/dark theme toggle. */

(function(){
  const root=document.documentElement, btn=document.getElementById('admin-theme-toggle');
  function apply(theme){root.setAttribute('data-admin-theme',theme);if(btn){btn.textContent=theme==='light'?'🌙':'☀️';btn.title=theme==='light'?'الوضع الليلي':'الوضع النهاري';}}
  let theme='dark';try{theme=localStorage.getItem('platform-theme')==='light'?'light':'dark'}catch(e){}
  apply(theme);
  btn?.addEventListener('click',()=>{theme=root.getAttribute('data-admin-theme')==='light'?'dark':'light';try{localStorage.setItem('platform-theme',theme)}catch(e){}apply(theme)});
})();

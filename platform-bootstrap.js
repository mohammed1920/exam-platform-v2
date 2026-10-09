/* Mizan platform bootstrap: legacy service-worker cleanup, install prompt, visitor counter.
 * Kept as a classic script at the original end-of-body position to preserve execution timing.
 */

    // إلغاء تسجيل Service Worker القديم فقط؛ المنصة الحالية لا تعتمد على Offline Cache.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => {});
    }
    (function setupInstallButton(){ const installBtn=document.getElementById('install-app-btn'),iosHint=document.getElementById('ios-install-hint'); if(!installBtn)return; const isStandalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true; if(isStandalone){installBtn.hidden=true;return;} installBtn.hidden=false; let deferredPrompt=null; const isIOS=/iphone|ipad|ipod/i.test(window.navigator.userAgent); window.addEventListener('beforeinstallprompt',(event)=>{event.preventDefault();deferredPrompt=event;}); installBtn.addEventListener('click',async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;return;} if(isIOS){iosHint.hidden=false;setTimeout(()=>{iosHint.hidden=true;},7000);return;} alert('لتثبيت ميزان على هاتفك:\n\nافتح قائمة المتصفح (⋮ أو ≡) ثم اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".');}); window.addEventListener('appinstalled',()=>{installBtn.hidden=true;iosHint.hidden=true;deferredPrompt=null;}); })();
    (function setupVisitorCounter(){ const countEl=document.getElementById('visitor-count');if(!countEl)return;const WORKSPACE='mhmd-hmyds-team-5310',COUNTER_NAME='first-counter-5310',BASE_URL=`https://api.counterapi.dev/v2/${WORKSPACE}/${COUNTER_NAME}`;const alreadyCountedThisSession=sessionStorage.getItem('visitCounted')==='1',requestUrl=alreadyCountedThisSession?`${BASE_URL}`:`${BASE_URL}/up`;fetch(requestUrl).then((res)=>res.json()).then((data)=>{const value=data.data?.up_count??data.data?.value??data.count??data.value??null;countEl.textContent=(value!==null&&value!==undefined)?value:'—';if(!alreadyCountedThisSession)sessionStorage.setItem('visitCounted','1');}).catch(()=>{countEl.textContent='—';}); })();
  
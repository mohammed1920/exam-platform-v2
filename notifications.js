/* Mizan administrative notifications. Read state is local to this browser/device. */
(function(){
'use strict';
const registryUrl='data/notifications.json';
const readStorageKey='mizan-read-notification-ids-v1';
let notifications=[];
let readIds=new Set();
let panelOpen=false;
function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,function(char){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char];});}
function loadReadIds(){try{const saved=JSON.parse(localStorage.getItem(readStorageKey)||'[]');readIds=new Set(Array.isArray(saved)?saved.filter(id=>typeof id==='string'):[]);}catch(_){readIds=new Set();}}
function saveReadIds(){try{localStorage.setItem(readStorageKey,JSON.stringify(Array.from(readIds)));}catch(_){}}
function safeLink(value){if(!value||typeof value!=='string')return '';try{const parsed=new URL(value,window.location.href);if(!['http:','https:'].includes(parsed.protocol))return '';return parsed.href;}catch(_){return '';}}
function formatDate(value){if(!value)return '';const date=new Date(value);if(Number.isNaN(date.getTime()))return '';return date.toLocaleDateString('ar-IQ',{year:'numeric',month:'short',day:'numeric'});}
function ensureUI(){
 if(document.getElementById('mizan-notifications'))return;
 const header=document.querySelector('.mizan-header');if(!header)return;
 const wrapper=document.createElement('div');wrapper.id='mizan-notifications';wrapper.className='mizan-notifications';
 wrapper.innerHTML='<button type="button" class="mizan-notifications-toggle" id="mizan-notifications-toggle" aria-label="الإشعارات" aria-expanded="false" aria-controls="mizan-notifications-panel">🔔<span class="mizan-notifications-badge" id="mizan-notifications-badge" aria-live="polite"></span></button><section class="mizan-notifications-panel" id="mizan-notifications-panel" role="dialog" aria-label="إشعارات ميزان" hidden><div class="mizan-notifications-panel-head"><strong>إشعارات ميزان</strong><button type="button" class="mizan-notifications-close" id="mizan-notifications-close" aria-label="إغلاق">×</button></div><div id="mizan-notifications-list"><p class="mizan-notifications-empty">جاري تحميل الإشعارات...</p></div></section>';
 header.appendChild(wrapper);
 const toggle=document.getElementById('mizan-notifications-toggle');const panel=document.getElementById('mizan-notifications-panel');
 toggle.addEventListener('click',function(){panelOpen=!panelOpen;panel.hidden=!panelOpen;header.classList.toggle('mizan-notifications-open',panelOpen);toggle.setAttribute('aria-expanded',String(panelOpen));});
 document.getElementById('mizan-notifications-close').addEventListener('click',closePanel);
 document.addEventListener('click',function(event){if(panelOpen&&!wrapper.contains(event.target))closePanel();});
 document.addEventListener('keydown',function(event){if(event.key==='Escape')closePanel();});
 document.getElementById('mizan-notifications-list').addEventListener('click',function(event){
  const control=event.target.closest('[data-notification-read], [data-notification-link]');if(!control)return;
  const id=control.getAttribute('data-notification-read')||control.getAttribute('data-notification-link');if(id){readIds.add(id);saveReadIds();renderNotifications();}
 });
}
function closePanel(){panelOpen=false;const panel=document.getElementById('mizan-notifications-panel');const toggle=document.getElementById('mizan-notifications-toggle');const header=document.querySelector('.mizan-header');if(panel)panel.hidden=true;if(header)header.classList.remove('mizan-notifications-open');if(toggle)toggle.setAttribute('aria-expanded','false');}
function renderNotifications(){
 const badge=document.getElementById('mizan-notifications-badge');const list=document.getElementById('mizan-notifications-list');if(!badge||!list)return;
 const active=notifications.filter(item=>item&&item.active!==false&&typeof item.id==='string');
 const unreadCount=active.filter(item=>!readIds.has(item.id)).length;badge.textContent=unreadCount>99?'99+':String(unreadCount);badge.classList.toggle('is-visible',unreadCount>0);
 if(!active.length){list.innerHTML='<p class="mizan-notifications-empty">لا توجد إشعارات حالياً.</p>';return;}
 const sorted=active.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 list.innerHTML=sorted.map(item=>{
  const unread=!readIds.has(item.id);const href=safeLink(item.link);const date=formatDate(item.createdAt||item.updatedAt);
  return '<article class="mizan-notification-entry '+(unread?'is-unread':'')+'"><button type="button" class="mizan-notification-title" data-notification-read="'+escapeHtml(item.id)+'" aria-label="قراءة إشعار: '+escapeHtml(item.title||'تنبيه')+'"><strong>'+escapeHtml(item.title||'تنبيه من ميزان')+'</strong></button><p class="mizan-notification-message">'+escapeHtml(item.message||'')+'</p>'+(href?'<a class="mizan-notification-link" data-notification-link="'+escapeHtml(item.id)+'" href="'+escapeHtml(href)+'"'+(new URL(href).origin!==window.location.origin?' target="_blank" rel="noopener noreferrer"':'')+'>عرض التفاصيل</a>':'')+(date?'<time class="mizan-notification-date">'+escapeHtml(date)+'</time>':'')+'</article>';
 }).join('');
}
async function loadNotifications(){const list=document.getElementById('mizan-notifications-list');if(!list)return;try{const response=await fetch(registryUrl,{cache:'no-cache',headers:{'Accept':'application/json'}});if(!response.ok)throw new Error('HTTP '+response.status);const data=await response.json();notifications=data&&Array.isArray(data.notifications)?data.notifications:[];renderNotifications();}catch(_){list.innerHTML='<p class="mizan-notifications-empty">تعذر تحميل الإشعارات. تحقق من الاتصال ثم حدّث الصفحة.</p>';}}
function start(){loadReadIds();ensureUI();loadNotifications();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

(function(){
'use strict';
const $=id=>document.getElementById(id);
const PRE=[['بطاقة موحدة / نقابة / موظف / عسكرية (ID-1)',8.56,5.4],['هوية الأحوال القديمة (الجنسية) 10×7',10,7],['هوية الأحوال القديمة 10.5×7.5',10.5,7.5],['شهادة الجنسية (A5)',21,14.8],['شهادة الوفاة / ورقة A4',29.7,21],['صورة شخصية 3.5×4.5',3.5,4.5]];
const items=[]; let place=[],uid=0,sel=-1,moveOn=true,cur=null,isNew=false,img=null,pts=[],sc=1,drag=-1;
const cv=$('cv'),cx=cv.getContext('2d');
const num=id=>parseFloat($(id).value)||0;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

/* ---------- import ---------- */
$('add').onclick=()=>$('inp').click();
$('cam').onclick=()=>$('camin').click();
let queue=[],qTotal=0,qDone=0,cropEdited=false;
function nextFile(){
  if($('modal').classList.contains('on'))return;
  if(!queue.length){qTotal=qDone=0;return;}
  const file=queue.shift();qDone++;
  const im=new Image(),objectUrl=URL.createObjectURL(file);
  im.onload=()=>{
    URL.revokeObjectURL(objectUrl);
    try{
      const m=Math.min(1,2000/Math.max(im.width,im.height));
      const c=document.createElement('canvas');
      c.width=Math.round(im.width*m);c.height=Math.round(im.height*m);
      const context=c.getContext('2d');
      if(!context)throw new Error('تعذر تجهيز الصورة');
      context.drawImage(im,0,0,c.width,c.height);
      const item={id:++uid,src:c,pts:defPts(c),w:8.6,h:5.4,out:null,note:'',copies:1};
      cur=item;isNew=true;cropEdited=false;cands=[];ci=0;cvLoadError=false;
      openCrop();
      $('hint').textContent='الصورة جاهزة. يجري الكشف التلقائي ويمكنك تحديد الزوايا الآن.';
      $('cancel').textContent=queue.length?'تخطي':'إلغاء';
      autoPts(c).then(a=>{
        if(cur!==item||!$('modal').classList.contains('on'))return;
        if(!cropEdited){item.pts=a.pts.map(p=>p.slice());pts=item.pts.map(p=>p.slice());draw();}
        setHint(a.ok);
      });
    }catch(error){
      console.error('Mizan image import failed:',error);
      $('hint').textContent='تعذر فتح الصورة المحددة. جرّب صورة بصيغة JPG أو PNG.';
      nextFile();
    }
  };
  im.onerror=()=>{
    URL.revokeObjectURL(objectUrl);
    console.warn('Mizan could not decode selected image:',file.name);
    $('hint').textContent='تعذر قراءة إحدى الصور، يجري الانتقال إلى الصورة التالية.';
    nextFile();
  };
  im.src=objectUrl;
}
const onPick=e=>{const fs=Array.from(e.target.files||[]);e.target.value='';if(!fs.length)return;queue.push(...fs);qTotal+=fs.length;nextFile();};
$('inp').onchange=$('camin').onchange=onPick;

function defPts(c){const w=c.width,h=c.height,a=.12;return[[w*a,h*a],[w*(1-a),h*a],[w*(1-a),h*(1-a)],[w*a,h*(1-a)]];}
function openCrop(){img=cur.src;pts=cur.pts.map(p=>p.slice());$('modal').classList.add('on');fit();draw();}
function fit(){sc=Math.min((innerWidth-16)/img.width,(innerHeight*.68)/img.height);cv.width=Math.round(img.width*sc);cv.height=Math.round(img.height*sc);}

/* ---------- OpenCV.js document detection ---------- */
let cands=[],ci=0,cvLoadPromise=null,cvLoadError=false;
function loadOpenCv(){
  if(window.cv&&window.cv.Mat)return Promise.resolve(window.cv);
  if(cvLoadPromise)return cvLoadPromise;
  cvLoadPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');let settled=false,timer;
    const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);script.remove();cvLoadPromise=null;reject(error instanceof Error?error:new Error('تعذر تحميل OpenCV.js'));};
    script.async=true;script.src='assets/vendor/opencv/opencv.js?v=4.13.0-build3';
    script.onload=()=>{
      const started=Date.now();
      const check=()=>{
        if(window.cv&&window.cv.Mat){if(settled)return;settled=true;clearTimeout(timer);resolve(window.cv);return;}
        if(Date.now()-started>=90000){fail(new Error('انتهت مهلة تهيئة OpenCV.js'));return;}
        timer=setTimeout(check,50);
      };check();
    };
    script.onerror=()=>fail(new Error('تعذر تنزيل OpenCV.js. اتصل بالإنترنت للمرة الأولى ثم أعد المحاولة.'));
    document.head.appendChild(script);
  });
  return cvLoadPromise;
}
function orderDocumentCorners(points){
  const center=points.reduce((sum,p)=>[sum[0]+p[0]/4,sum[1]+p[1]/4],[0,0]);
  const ordered=points.slice().sort((a,b)=>Math.atan2(a[1]-center[1],a[0]-center[0])-Math.atan2(b[1]-center[1],b[0]-center[0]));
  let area=0;for(let i=0;i<4;i++){const p=ordered[i],n=ordered[(i+1)%4];area+=p[0]*n[1]-n[0]*p[1];}
  if(area<0)ordered.reverse();
  let first=0;for(let i=1;i<4;i++)if(ordered[i][0]+ordered[i][1]<ordered[first][0]+ordered[first][1])first=i;
  return ordered.slice(first).concat(ordered.slice(0,first));
}
function detectAll(cv,canvas){
  const scale=Math.min(1,960/Math.max(canvas.width,canvas.height));
  const width=Math.max(1,Math.round(canvas.width*scale)),height=Math.max(1,Math.round(canvas.height*scale));
  const source=cv.imread(canvas),image=new cv.Mat(),gray=new cv.Mat(),blurred=new cv.Mat();
  const edges=new cv.Mat(),closed=new cv.Mat(),adaptive=new cv.Mat(),otsu=new cv.Mat();
  const kernel=cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(3,3)),candidates=[];
  const collect=binary=>{
    const contours=new cv.MatVector(),hierarchy=new cv.Mat();
    try{
      cv.findContours(binary,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
      for(let i=0;i<contours.size();i++){
        const contour=contours.get(i),approx=new cv.Mat();
        try{
          const perimeter=cv.arcLength(contour,true);
          if(perimeter<Math.min(width,height)*.12)continue;
          cv.approxPolyDP(contour,approx,Math.max(2,perimeter*.018),true);
          if(approx.rows!==4||!cv.isContourConvex(approx))continue;
          const area=Math.abs(cv.contourArea(approx)),fraction=area/(width*height);
          if(fraction<.045||fraction>.985)continue;
          const bounds=cv.boundingRect(approx);
          if(Math.min(bounds.width,bounds.height)<Math.min(width,height)*.08)continue;
          const raw=approx.data32S;if(!raw||raw.length<8)continue;
          const points=[];for(let p=0;p<8;p+=2)points.push([raw[p],raw[p+1]]);
          const ordered=orderDocumentCorners(points);
          const rectangularity=Math.min(1,area/Math.max(1,bounds.width*bounds.height));
          candidates.push({points:ordered,score:fraction*(.65+.35*rectangularity)});
        }finally{approx.delete();contour.delete();}
      }
    }finally{contours.delete();hierarchy.delete();}
  };
  try{
    cv.resize(source,image,new cv.Size(width,height),0,0,cv.INTER_AREA);
    cv.cvtColor(image,gray,cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray,blurred,new cv.Size(5,5),0,0,cv.BORDER_DEFAULT);
    cv.Canny(blurred,edges,40,120,3,false);
    cv.morphologyEx(edges,closed,cv.MORPH_CLOSE,kernel);
    collect(closed);
    cv.adaptiveThreshold(blurred,adaptive,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY_INV,31,12);
    collect(adaptive);
    cv.threshold(blurred,otsu,0,255,cv.THRESH_BINARY_INV|cv.THRESH_OTSU);
    collect(otsu);
  }finally{
    source.delete();image.delete();gray.delete();blurred.delete();
    edges.delete();closed.delete();adaptive.delete();otsu.delete();kernel.delete();
  }
  candidates.sort((x,y)=>y.score-x.score);
  const unique=[];
  for(const candidate of candidates){
    const points=candidate.points.map(p=>[p[0]/scale,p[1]/scale]);
    if(unique.some(item=>item.points.every((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1])<Math.max(canvas.width,canvas.height)*.045)))continue;
    unique.push({points,score:candidate.score});if(unique.length===6)break;
  }
  return unique.map(item=>item.points);
}
async function autoPts(canvas){
  cands=[];ci=0;cvLoadError=false;
  try{cands=detectAll(await loadOpenCv(),canvas);}
  catch(error){cvLoadError=true;console.error('Mizan OpenCV document detection failed:',error);}
  return{pts:cands[0]||defPts(canvas),ok:!!cands.length};
}
function setHint(ok){
  setHint0(ok);
  if(qTotal>1)$('hint').textContent='صورة '+qDone+' من '+qTotal+' · '+$('hint').textContent;
}
function setHint0(ok){
  $('hint').textContent=ok
    ?'تم الكشف بواسطة OpenCV ('+(ci+1)+' من '+cands.length+')'+(cands.length>1?'. اضغط «كشف تلقائي» لاقتراح آخر. ':'. ')+'عدّل الزوايا إذا تحتاج'
    :cvLoadError?'تعذر تهيئة OpenCV.js. اتصل بالإنترنت لتحميله أول مرة، ثم أعد المحاولة أو حدد الزوايا يدوياً'
    :'لم يعثر OpenCV على حدود واضحة للمستند. غيّر الخلفية أو حدد الزوايا يدوياً';
}

/* ---------- corner editor ---------- */
function draw(){
  cx.drawImage(img,0,0,cv.width,cv.height);
  cx.beginPath();pts.forEach((p,i)=>cx[i?'lineTo':'moveTo'](p[0]*sc,p[1]*sc));cx.closePath();
  cx.lineWidth=2;cx.strokeStyle='#2fe0b4';cx.stroke();
  pts.forEach(p=>{cx.beginPath();cx.arc(p[0]*sc,p[1]*sc,13,0,7);cx.fillStyle='rgba(47,224,180,.55)';cx.fill();cx.stroke();});
}
function pos(e){const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height];}
cv.onpointerdown=e=>{const[x,y]=pos(e);let best=45;drag=-1;
  pts.forEach((p,i)=>{const d=Math.hypot(p[0]*sc-x,p[1]*sc-y);if(d<best){best=d;drag=i;}});
  if(drag>=0)cv.setPointerCapture(e.pointerId);};
cv.onpointermove=e=>{if(drag<0)return;const[x,y]=pos(e);
  cropEdited=true;pts[drag]=[Math.min(img.width,Math.max(0,x/sc)),Math.min(img.height,Math.max(0,y/sc))];draw();};
cv.onpointerup=()=>drag=-1;
$('rot').onclick=async()=>{
  const c=document.createElement('canvas');c.width=img.height;c.height=img.width;
  const g=c.getContext('2d');g.translate(c.width,0);g.rotate(Math.PI/2);g.drawImage(img,0,0);
  cur.src=c;img=c;$('hint').textContent='جاري إعادة الكشف بواسطة OpenCV...';const a=await autoPts(c);pts=a.pts;setHint(a.ok);fit();draw();
};
$('auto').onclick=async()=>{if(cands.length>1){ci=(ci+1)%cands.length;pts=cands[ci].map(p=>p.slice());setHint(true);}else{$('hint').textContent='جاري الكشف بواسطة OpenCV...';const a=await autoPts(img);pts=a.pts;setHint(a.ok);}draw();};
$('cancel').onclick=()=>{$('modal').classList.remove('on');isNew=false;nextFile();};

/* ---------- auto size from the shape the user outlined ---------- */
function autoSize(it){
  const p=it.pts,wq=(dist(p[0],p[1])+dist(p[3],p[2]))/2,hq=(dist(p[0],p[3])+dist(p[1],p[2]))/2;
  const r=Math.max(wq,hq)/Math.min(wq,hq);let w,h;
  if(Math.abs(r/1.585-1)<.085){w=8.56;h=5.4;it.note='تم التعرف: بطاقة ID-1';}
  else if(r>1.33&&r<1.5){w=21;h=14.8;it.note='نسبة تحتمل: شهادة جنسية A5 أو هوية قديمة أو A4. تأكد من النوع من القائمة';}
  else{w=15;h=15/r;it.note='نسبة غير قياسية: اختر النوع أو اكتب القياس';}
  if(hq>wq)[w,h]=[h,w];
  if(w>21&&h<=21)[w,h]=[h,w];it.w=+w.toFixed(2);it.h=+h.toFixed(2);
}

/* ---------- perspective crop (quad -> rectangle) ---------- */
function warp(it){
  const k=Math.min(100,2000/Math.max(it.w,it.h));
  const W=Math.round(it.w*k),H=Math.round(it.h*k),s=it.src,sw=s.width,sh=s.height;
  const src=s.getContext('2d').getImageData(0,0,sw,sh).data;
  const out=document.createElement('canvas');out.width=W;out.height=H;
  const oc=out.getContext('2d'),od=oc.createImageData(W,H),d=od.data;
  const[a,b,c,e]=it.pts;
  for(let y=0;y<H;y++){const v=y/(H-1);
    for(let x=0;x<W;x++){const u=x/(W-1);
      const px=(1-v)*((1-u)*a[0]+u*b[0])+v*((1-u)*e[0]+u*c[0]);
      const py=(1-v)*((1-u)*a[1]+u*b[1])+v*((1-u)*e[1]+u*c[1]);
      const sx=Math.min(sw-1,Math.max(0,px|0)),sy=Math.min(sh-1,Math.max(0,py|0));
      const i=(sy*sw+sx)*4,o=(y*W+x)*4;
      d[o]=src[i];d[o+1]=src[i+1];d[o+2]=src[i+2];d[o+3]=255;}}
  oc.putImageData(od,0,0);it.out=out;it.ver=(it.ver||0)+1;
  const t=document.createElement('canvas');t.width=120;t.height=Math.max(1,Math.round(120*H/W));
  t.getContext('2d').drawImage(out,0,0,t.width,t.height);it.thumb=t.toDataURL('image/jpeg',.7);
}
$('ok').onclick=()=>{
  cur.pts=pts.map(p=>p.slice());
  if(isNew){autoSize(cur);items.push(cur);isNew=false;}
  else if(Math.abs((cur.w/cur.h)-(dist(pts[0],pts[1])+dist(pts[3],pts[2]))/(dist(pts[0],pts[3])+dist(pts[1],pts[2])))>.25)autoSize(cur);
  warp(cur);$('modal').classList.remove('on');list();render();nextFile();
};

/* ---------- item list ---------- */
function list(){
  $('list').innerHTML=items.map((it,i)=>{
    const m=PRE.findIndex(p=>(Math.abs(p[1]-it.w)<.05&&Math.abs(p[2]-it.h)<.05)||(Math.abs(p[2]-it.w)<.05&&Math.abs(p[1]-it.h)<.05));
    return `<div class="panel"><div class="row"><img data-e="${i}" src="${it.thumb}" style="width:90px;border-radius:4px;cursor:pointer">
      <div style="flex:1"><select data-t="${i}" style="width:100%;padding:7px;font-size:15px">
      ${PRE.map((p,j)=>`<option value="${j}" ${j===m?'selected':''}>${p[0]}</option>`).join('')}<option value="c" ${m<0?'selected':''}>مخصص</option></select></div>
      <button class="alt" data-d="${i}">حذف</button></div>
      <div class="row"><label>العرض (سم)</label><input type="number" data-w="${i}" value="${it.w}" step="0.1" min="1" max="30">
      <label>الارتفاع (سم)</label><input type="number" data-h="${i}" value="${it.h}" step="0.1" min="1" max="30"></div>
      <div class="row"><label>عدد النسخ</label><input type="number" data-c="${i}" value="${it.copies||1}" min="1" max="20"></div>
      <div class="row"><label>السطوع</label><input type="range" data-br="${i}" min="70" max="140" value="${it.br||100}"></div>
      <div class="row"><label>التباين</label><input type="range" data-co="${i}" min="70" max="160" value="${it.co||100}"></div>
      <div style="font-size:13px;opacity:.75">${it.note||''} · اضغط الصورة المصغرة لتعديل القص</div></div>`;}).join('');
}
$('list').onclick=e=>{const t=e.target;
  if(t.dataset.d!==undefined){items.splice(+t.dataset.d,1);list();render();}
  if(t.dataset.e!==undefined){cur=items[+t.dataset.e];isNew=false;openCrop();}};
$('list').oninput=e=>{const t=e.target;
  if(t.dataset.br!==undefined){items[+t.dataset.br].br=+t.value;render();}
  else if(t.dataset.co!==undefined){items[+t.dataset.co].co=+t.value;render();}};
$('list').onchange=e=>{const t=e.target,v=parseFloat(t.value);
  if(t.dataset.c!==undefined){items[+t.dataset.c].copies=Math.max(1,Math.min(20,Math.round(v)||1));list();render();return;}
  if(t.dataset.t!==undefined){const it=items[+t.dataset.t];if(t.value==='c')return;const p=PRE[+t.value];
    const port=it.h>it.w;it.w=port?p[2]:p[1];it.h=port?p[1]:p[2];if(it.w>21&&it.h<=21)[it.w,it.h]=[it.h,it.w];it.note='';}
  else if(t.dataset.w!==undefined){const it=items[+t.dataset.w];if(v>0){it.h=+(it.h*v/it.w).toFixed(1);it.w=v;}}
  else if(t.dataset.h!==undefined){const it=items[+t.dataset.h];if(v>0){it.w=+(it.w*v/it.h).toFixed(1);it.h=v;}}
  else return;
  const it=items[+(t.dataset.t??t.dataset.w??t.dataset.h)];warp(it);list();refit();render();};

/* ---------- A4 layout: side by side, several pages, drag, rotate ---------- */
const A4=document.createElement('canvas');A4.width=2480;A4.height=3508;
const rots={};let pageCount=1,curPage=0,showGrid=true;
const dims=p=>(p.rot%180)?[p.it.h,p.it.w]:[p.it.w,p.it.h];
function seqKeys(){const a=[];items.forEach(it=>{for(let c=0;c<(it.copies||1);c++)a.push({it,key:it.id+'-'+c});});return a;}
function pager(){
  $('pgbar').style.display=pageCount>1?'flex':'none';
  $('pn').textContent='صفحة '+(curPage+1)+' / '+pageCount;
}
function arrange(){
  const seq=seqKeys(),gap=num('g');sel=-1;$('warn').textContent='';place=[];
  if(!seq.length){pageCount=1;curPage=0;pager();return;}
  const ent=seq.map(e=>{const p={it:e.it,key:e.key,rot:rots[e.key]||0,s:1,x:0,y:0,pg:0};
    const[w,h]=dims(p);p.s=Math.min(1,21/w,29.7/h);return p;});
  if(ent.some(p=>p.s<1))$('warn').textContent='تم تصغير مستمسك لأنه أكبر من الصفحة.';
  const sz=p=>{const[w,h]=dims(p);return[w*p.s,h*p.s];};
  const rows=[];let row=null;
  ent.forEach(p=>{const[w,h]=sz(p);
    if(row&&row.w+gap+w>21+1e-6){rows.push(row);row=null;}
    if(!row)row={e:[],w:0,h:0};
    row.w+=(row.e.length?gap:0)+w;row.h=Math.max(row.h,h);row.e.push(p);});
  rows.push(row);
  const pages=[];let pg=null;
  rows.forEach(r=>{
    if(pg&&pg.h+gap+r.h>28.7+1e-6){pages.push(pg);pg=null;}
    if(!pg)pg={r:[],h:0};
    pg.h+=(pg.r.length?gap:0)+r.h;pg.r.push(r);});
  pages.push(pg);
  pages.forEach((P,pi)=>{let y=Math.max(0,Math.min(1,(29.7-P.h)/2));
    P.r.forEach(r=>{let x=(21-r.w)/2;
      r.e.forEach(p=>{const[w]=sz(p);p.x=x;p.y=y;p.pg=pi;place.push(p);x+=w+gap;});
      y+=r.h+gap;});});
  pageCount=pages.length;if(curPage>=pageCount)curPage=pageCount-1;pager();
}
function refit(){
  if(place.every(p=>!p.moved)){arrange();return;}
  place.forEach(p=>{const[w,h]=dims(p);p.s=Math.min(1,21/w,29.7/h);
    p.x=Math.min(21-w*p.s,Math.max(0,p.x));p.y=Math.min(29.7-h*p.s,Math.max(0,p.y));});
}
function drawRot(g,img,W,H,rot){
  g.save();g.translate(W/2,H/2);g.rotate(rot*Math.PI/180);
  const iw=(rot%180)?H:W,ih=(rot%180)?W:H;g.drawImage(img,-iw/2,-ih/2,iw,ih);g.restore();
}
function pcache(p,k){
  const it=p.it,[w,h]=dims(p),W=Math.max(1,Math.round(w*p.s*k)),H=Math.max(1,Math.round(h*p.s*k));
  const br=it.br||100,co=it.co||100,key=[W,H,br,co,p.rot,it.ver].join('|');
  if(p._pk!==key){
    const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
    g.imageSmoothingQuality='high';g.filter=`brightness(${br}%) contrast(${co}%)`;
    drawRot(g,it.out,W,H,p.rot);p._pc=c;p._pk=key;
  }
  return p._pc;
}
function drawTo(g,k,fast,pg){
  g.fillStyle='#fff';g.fillRect(0,0,21*k,29.7*k);
  place.filter(p=>p.pg===pg).forEach(p=>{
    if(fast){g.drawImage(pcache(p,k),p.x*k,p.y*k);return;}
    const[w,h]=dims(p);g.save();g.translate(p.x*k,p.y*k);
    g.filter=`brightness(${p.it.br||100}%) contrast(${p.it.co||100}%)`;
    drawRot(g,p.it.out,w*p.s*k,h*p.s*k,p.rot);g.restore();});
}
function drawGrid(g,k){
  g.save();g.lineWidth=1;
  for(let c=1;c<21;c++){g.strokeStyle=c%5?'rgba(20,90,160,.2)':'rgba(20,90,160,.45)';g.beginPath();g.moveTo(c*k,0);g.lineTo(c*k,29.7*k);g.stroke();}
  for(let r=1;r<=29;r++){g.strokeStyle=r%5?'rgba(20,90,160,.2)':'rgba(20,90,160,.45)';g.beginPath();g.moveTo(0,r*k);g.lineTo(21*k,r*k);g.stroke();}
  g.restore();
}
const pv=$('prev');
function placeTb(){
  const tb=$('tb'),p=sel>=0?place[sel]:null;
  if(!p||p.pg!==curPage){tb.style.display='none';return;}
  const r=pv.getBoundingClientRect(),f=r.width/21,[w,h]=dims(p);
  tb.style.display='flex';const tw=tb.offsetWidth||98;
  const x=Math.max(0,Math.min(r.width-tw,(p.x+w*p.s/2)*f-tw/2));
  let y=p.y*f-48;if(y<0)y=(p.y+h*p.s)*f+6;
  tb.style.left=x+'px';tb.style.top=y+'px';
}
function render(){
  const seq=seqKeys();
  if(seq.length!==place.length||seq.some((e,i)=>e.key!==place[i].key))arrange();
  const k=900/21,g=pv.getContext('2d');
  drawTo(g,k,true,curPage);
  if(showGrid)drawGrid(g,k);
  const p=sel>=0?place[sel]:null;
  if(p&&p.pg===curPage){const[w,h]=dims(p);g.setLineDash([6,4]);g.lineWidth=2;g.strokeStyle='#0b7a6b';
    g.strokeRect(p.x*k,p.y*k,w*p.s*k,h*p.s*k);g.setLineDash([]);}
  placeTb();
}
$('g').oninput=()=>{arrange();render();};
$('arr').onclick=()=>{arrange();render();};
$('grid').onclick=()=>{showGrid=!showGrid;$('grid').textContent=showGrid?'الشبكة: ظاهرة':'الشبكة: مخفية';render();};
$('pp').onclick=()=>{if(curPage>0){curPage--;sel=-1;pager();render();}};
$('np').onclick=()=>{if(curPage<pageCount-1){curPage++;sel=-1;pager();render();}};
function rotSel(d){
  const p=sel>=0?place[sel]:null;if(!p)return;
  let[w,h]=dims(p);const cx=p.x+w*p.s/2,cy=p.y+h*p.s/2;
  p.rot=(p.rot+d*90+360)%360;rots[p.key]=p.rot;[w,h]=dims(p);
  p.s=Math.min(p.s,21/w,29.7/h);const a=w*p.s,b=h*p.s;
  p.x=Math.min(21-a,Math.max(0,cx-a/2));p.y=Math.min(29.7-b,Math.max(0,cy-b/2));p.moved=true;render();
}
$('rl').onclick=()=>rotSel(-1);$('rr').onclick=()=>rotSel(1);

/* drag: touch starts a drag only on a document, otherwise the page scrolls */
let dg=null,raf=0,pend=null;
function cm(e){const r=pv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*21,(e.clientY-r.top)/r.height*29.7];}
function dragStart(pt){const[x,y]=cm(pt);
  for(let i=place.length-1;i>=0;i--){const p=place[i];if(p.pg!==curPage)continue;const[w,h]=dims(p);
    if(x>=p.x&&x<=p.x+w*p.s&&y>=p.y&&y<=p.y+h*p.s){sel=i;dg={i,dx:x-p.x,dy:y-p.y};render();return true;}}
  if(sel!==-1){sel=-1;render();}return false;
}
function dragMove(pt){
  if(!dg)return;pend=cm(pt);
  if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(!dg)return;const[x,y]=pend,p=place[dg.i],[w,h]=dims(p);
    p.moved=true;p.x=Math.min(21-w*p.s,Math.max(0,x-dg.dx));p.y=Math.min(29.7-h*p.s,Math.max(0,y-dg.dy));render();});
}
pv.addEventListener('touchstart',e=>{if(e.touches.length===1&&dragStart(e.touches[0]))e.preventDefault();},{passive:false});
pv.addEventListener('touchmove',e=>{if(dg){e.preventDefault();dragMove(e.touches[0]);}},{passive:false});
['touchend','touchcancel'].forEach(n=>pv.addEventListener(n,()=>{dg=null;}));
pv.addEventListener('mousedown',e=>{if(dragStart(e))e.preventDefault();});
window.addEventListener('mousemove',dragMove);
window.addEventListener('mouseup',()=>{dg=null;});
addEventListener('resize',placeTb);
render();

/* ---------- export ---------- */
function pagesJpg(q){
  const g=A4.getContext('2d'),out=[];
  for(let i=0;i<pageCount;i++){drawTo(g,2480/21,false,i);
    const b=atob(A4.toDataURL('image/jpeg',q||.92).split(',')[1]),u=new Uint8Array(b.length);
    for(let j=0;j<b.length;j++)u[j]=b.charCodeAt(j);out.push(u);}
  return out;
}
function makePDF(jpgs,w,h){
  const enc=s=>new TextEncoder().encode(s),parts=[],xr=[];let off=0;
  const add=b=>{parts.push(b);off+=b.length};
  const obj=(n,head,stream)=>{xr[n]=off;add(enc(`${n} 0 obj\n${head}\n`));
    if(stream){add(enc('stream\n'));add(stream);add(enc('\nendstream\n'));}add(enc('endobj\n'));};
  const n=jpgs.length,kids=jpgs.map((_,i)=>`${3+3*i} 0 R`).join(' ');
  add(enc('%PDF-1.4\n'));
  obj(1,'<</Type/Catalog/Pages 2 0 R>>');
  obj(2,`<</Type/Pages/Kids[${kids}]/Count ${n}>>`);
  const cs=enc('q 595.28 0 0 841.89 0 0 cm /I Do Q');
  jpgs.forEach((jpg,i)=>{const p=3+3*i;
    obj(p,`<</Type/Page/Parent 2 0 R/MediaBox[0 0 595.28 841.89]/Resources<</XObject<</I ${p+1} 0 R>>>>/Contents ${p+2} 0 R>>`);
    obj(p+1,`<</Type/XObject/Subtype/Image/Width ${w}/Height ${h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpg.length}>>`,jpg);
    obj(p+2,`<</Length ${cs.length}>>`,cs);});
  const x=off,size=3+3*n;
  let t='xref\n0 '+size+'\n0000000000 65535 f \n';
  for(let i=1;i<size;i++)t+=String(xr[i]).padStart(10,'0')+' 00000 n \n';
  add(enc(t+`trailer\n<</Size ${size}/Root 1 0 R>>\nstartxref\n${x}\n%%EOF`));
  return new Blob(parts,{type:'application/pdf'});
}
function save(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();a.remove();
}
function need(){if(!items.length){alert('أضف مستمسكاً واحداً على الأقل');return false}return true;}
$('pdf').onclick=()=>{if(need())save(makePDF(pagesJpg(),2480,3508),'id-sheet.pdf');};
$('jpg').onclick=()=>{if(!need())return;
  pagesJpg().forEach((u,i)=>setTimeout(()=>save(new Blob([u],{type:'image/jpeg'}),pageCount>1?`id-sheet-${i+1}.jpg`:'id-sheet.jpg'),i*500));};
$('prt').onclick=()=>{
  if(!need())return;
  const pa=$('pa');pa.innerHTML='';
  const ims=pagesJpg(.95).map(u=>{const im=new Image();im.src=URL.createObjectURL(new Blob([u],{type:'image/jpeg'}));pa.appendChild(im);return im;});
  let left=ims.length,once=false;
  const go=()=>{if(--left>0||once)return;once=true;
    try{window.print();}catch(e){alert('الطباعة غير مدعومة هنا. استعمل «حفظ PDF» أو «مشاركة» ثم اطبع من تطبيق آخر');}};
  ims.forEach(im=>{im.onload=go;im.onerror=go;});
};
$('shr').onclick=async()=>{
  if(!need())return;
  const f=new File([makePDF(pagesJpg(),2480,3508)],'id-sheet.pdf',{type:'application/pdf'});
  if(navigator.canShare&&navigator.canShare({files:[f]}))try{await navigator.share({files:[f]});}catch(e){}
  else alert('المشاركة غير مدعومة هنا، استعمل حفظ PDF');
};

/* ---------- local-only document projects (IndexedDB) ---------- */
const DOCUMENTS_DB = 'mizan-documents-local';
const DOCUMENTS_STORE = 'projects';
function openDocumentsDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DOCUMENTS_DB,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(DOCUMENTS_STORE))request.result.createObjectStore(DOCUMENTS_STORE,{keyPath:'id'});};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('تعذر فتح التخزين المحلي'));
  });
}
function documentsTransaction(mode,operation){
  return openDocumentsDB().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(DOCUMENTS_STORE,mode),store=tx.objectStore(DOCUMENTS_STORE);
    let request;
    try{request=operation(store);}catch(error){db.close();reject(error);return;}
    tx.oncomplete=()=>{db.close();resolve(request?.result);};
    tx.onerror=()=>{db.close();reject(tx.error||request?.error);};
    tx.onabort=()=>{db.close();reject(tx.error||new Error('أُلغيت عملية التخزين'));};
  }));
}
function canvasToBlob(canvas){
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('تعذر تجهيز الصورة للحفظ')),'image/jpeg',.94));
}
async function blobToCanvas(blob){
  const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');
  canvas.width=bitmap.width;canvas.height=bitmap.height;
  canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close?.();
  return canvas;
}
function safeText(value){
  return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
async function saveLocalProject(){
  if(!need())return;
  const name=prompt('اكتب اسماً لهذه المجموعة:','مستمسكاتي');
  if(name===null)return;
  const cleanName=name.trim().slice(0,80);
  if(!cleanName){alert('اكتب اسماً للمجموعة حتى تحفظها.');return;}
  try{
    const savedItems=await Promise.all(items.map(async it=>({
      id:it.id,src:await canvasToBlob(it.src),out:await canvasToBlob(it.out),
      pts:it.pts.map(p=>p.slice()),w:it.w,h:it.h,note:it.note||'',
      copies:it.copies||1,br:it.br||100,co:it.co||100,thumb:it.thumb||'',ver:it.ver||1
    })));
    const project={id:(crypto.randomUUID?.()||('project-'+Date.now())),name:cleanName,updatedAt:new Date().toISOString(),gap:num('g'),rots:{...rots},items:savedItems};
    await documentsTransaction('readwrite',store=>store.put(project));
    await refreshSavedProjects();
    alert('تم حفظ المجموعة على هذا الجهاز فقط.');
  }catch(error){
    console.error('Mizan local document save failed:',error);
    alert('تعذر الحفظ المحلي. تحقق من مساحة التخزين المتاحة في الجهاز.');
  }
}
async function refreshSavedProjects(){
  const records=await documentsTransaction('readonly',store=>store.getAll());
  const projects=(records||[]).filter(item=>item.id!=='__draft__').sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  $('savedProjects').innerHTML=projects.length?projects.map(project=>`
    <div class="saved-project">
      <span><strong>${safeText(project.name)}</strong><small> · ${new Date(project.updatedAt).toLocaleDateString('ar-IQ')}</small></span>
      <button type="button" class="alt" data-load-project="${safeText(project.id)}">فتح</button>
      <button type="button" class="alt" data-delete-project="${safeText(project.id)}">حذف</button>
    </div>`).join(''):'<p class="documents-empty">لا توجد مجموعات محفوظة بعد.</p>';
}
async function loadLocalProject(projectId){
  try{
    const project=await documentsTransaction('readonly',store=>store.get(projectId));
    if(!project)return;
    const restored=await Promise.all(project.items.map(async it=>({
      ...it,src:await blobToCanvas(it.src),out:await blobToCanvas(it.out),
      pts:Array.isArray(it.pts)?it.pts.map(p=>p.slice()):[]
    })));
    items.splice(0,items.length,...restored);
    Object.keys(rots).forEach(key=>delete rots[key]);
    Object.assign(rots,project.rots||{});
    uid=Math.max(0,...items.map(item=>Number(item.id)||0));
    $('g').value=String(project.gap??1);
    cur=null;sel=-1;place=[];curPage=0;
    list();arrange();render();
  }catch(error){
    console.error('Mizan local document restore failed:',error);
    alert('تعذر فتح المجموعة المحفوظة. قد تكون بياناتها غير متوافقة أو تالفة.');
  }
}
$('saveLocal').onclick=saveLocalProject;
$('savedProjects').onclick=async event=>{
  const load=event.target.closest('[data-load-project]');
  const remove=event.target.closest('[data-delete-project]');
  if(load){await loadLocalProject(load.dataset.loadProject);return;}
  if(remove){
    if(!confirm('هل تريد حذف هذه المجموعة نهائياً من هذا الجهاز؟'))return;
    try{await documentsTransaction('readwrite',store=>store.delete(remove.dataset.deleteProject));await refreshSavedProjects();}
    catch(error){alert('تعذر حذف المجموعة المحفوظة.');}
  }
};
$('documents-back').onclick=()=>{if(window.app?.navigateTo)window.app.navigateTo('home');};
refreshSavedProjects().catch(error=>console.warn('Local document storage is unavailable:',error));

})();

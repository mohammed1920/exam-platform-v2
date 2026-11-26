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
let queue=[],qTotal=0,qDone=0;
function nextFile(){
  if($('modal').classList.contains('on'))return;
  if(!queue.length){qTotal=qDone=0;return;}
  const file=queue.shift();qDone++;
  const im=new Image();
  im.onload=()=>{
    const m=Math.min(1,2000/Math.max(im.width,im.height));
    const c=document.createElement('canvas');
    c.width=Math.round(im.width*m);c.height=Math.round(im.height*m);
    c.getContext('2d').drawImage(im,0,0,c.width,c.height);
    const a=autoPts(c);cur={id:++uid,src:c,pts:a.pts,w:8.6,h:5.4,out:null,note:'',copies:1};isNew=true;
    openCrop();setHint(a.ok);$('cancel').textContent=queue.length?'تخطي':'إلغاء';
  };
  im.onerror=()=>nextFile();
  im.src=URL.createObjectURL(file);
}
const onPick=e=>{const fs=[...e.target.files];e.target.value='';if(!fs.length)return;queue.push(...fs);qTotal+=fs.length;nextFile();};
$('inp').onchange=$('camin').onchange=onPick;

function defPts(c){const w=c.width,h=c.height,a=.12;return[[w*a,h*a],[w*(1-a),h*a],[w*(1-a),h*(1-a)],[w*a,h*(1-a)]];}
function openCrop(){img=cur.src;pts=cur.pts.map(p=>p.slice());$('modal').classList.add('on');fit();draw();}
function fit(){sc=Math.min((innerWidth-16)/img.width,(innerHeight*.52)/img.height);cv.width=Math.round(img.width*sc);cv.height=Math.round(img.height*sc);}

/* ---------- automatic document detection (no libraries) ---------- */
function segQ(d,w,h){
  const bw=Math.max(2,Math.round(Math.min(w,h)*.04)),ring=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<bw||y<bw||x>=w-bw||y>=h-bw)ring.push(x,y);
  // background = a tilted plane per colour channel fitted to the image border (handles lighting gradients)
  const plane=ch=>{let n=0,sx=0,sy=0,sxx=0,sxy=0,syy=0,sc=0,sxc=0,syc=0;
    for(let k=0;k<ring.length;k+=2){const x=ring[k]/w,y=ring[k+1]/h,v=d[(ring[k+1]*w+ring[k])*4+ch];
      n++;sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;syy+=y*y;sc+=v;sxc+=x*v;syc+=y*v;}
    const M=[[n,sx,sy,sc],[sx,sxx,sxy,sxc],[sy,sxy,syy,syc]];
    for(let i=0;i<3;i++){let p=i;for(let r=i+1;r<3;r++)if(Math.abs(M[r][i])>Math.abs(M[p][i]))p=r;[M[i],M[p]]=[M[p],M[i]];
      if(Math.abs(M[i][i])<1e-9)return[sc/n,0,0];
      for(let r=0;r<3;r++)if(r!==i){const f=M[r][i]/M[i][i];for(let k=i;k<4;k++)M[r][k]-=f*M[i][k];}}
    return[M[0][3]/M[0][0],M[1][3]/M[1][1],M[2][3]/M[2][2]];};
  const pl=[plane(0),plane(1),plane(2)],N=w*h,dist=new Uint8Array(N);
  let rs=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;let e=0;
    for(let ch=0;ch<3;ch++)e+=Math.abs(d[i*4+ch]-(pl[ch][0]+pl[ch][1]*x/w+pl[ch][2]*y/h));
    dist[i]=Math.min(255,e/3|0);}
  for(let k=0;k<ring.length;k+=2)rs+=dist[ring[k+1]*w+ring[k]];
  const thr=Math.max(14,Math.min(70,rs/(ring.length/2)*4+8));
  let mask=new Uint8Array(N);for(let i=0;i<N;i++)mask[i]=dist[i]>thr?1:0;
  return compQ(mask,w,h);
}
function compQ(mask,w,h){
  const N=w*h;
  const box=(a,r,mx)=>{const o=new Uint8Array(N),q=new Uint8Array(N);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=mx?0:1;for(let k=-r;k<=r;k++){const xx=Math.min(w-1,Math.max(0,x+k)),u=a[y*w+xx];if(mx?u:!u){v=mx?1:0;break;}}q[y*w+x]=v;}
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=mx?0:1;for(let k=-r;k<=r;k++){const yy=Math.min(h-1,Math.max(0,y+k)),u=q[yy*w+x];if(mx?u:!u){v=mx?1:0;break;}}o[y*w+x]=v;}
    return o;};
  mask=box(box(mask,3,true),3,false);
  // fill holes: flood the outside, whatever is not reached is inside
  const out=new Uint8Array(N),st=[];
  const push=i=>{if(!mask[i]&&!out[i]){out[i]=1;st.push(i);}};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
  while(st.length){const i=st.pop(),x=i%w;if(x>0)push(i-1);if(x<w-1)push(i+1);if(i>=w)push(i-w);if(i<N-w)push(i+w);}
  for(let i=0;i<N;i++)mask[i]=out[i]?0:1;
  // biggest connected piece
  const lab=new Int32Array(N);let bl=0,bs=0,L=0;
  for(let i=0;i<N;i++){if(!mask[i]||lab[i])continue;L++;let n=0;st.push(i);lab[i]=L;
    while(st.length){const j=st.pop();n++;const x=j%w,nb=[x>0?j-1:-1,x<w-1?j+1:-1,j>=w?j-w:-1,j<N-w?j+w:-1];
      for(const q of nb)if(q>=0&&mask[q]&&!lab[q]){lab[q]=L;st.push(q);}}
    if(n>bs){bs=n;bl=L;}}
  if(!bs)return null;
  const P=[[1e9,0,0],[-1e9,0,0],[-1e9,0,0],[1e9,0,0]];let ex=[[0,0],[0,0],[0,0],[0,0]];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(lab[y*w+x]===bl){const a=x+y,b=x-y;
    if(a<P[0][0]){P[0][0]=a;ex[0]=[x,y];}if(b>P[1][0]){P[1][0]=b;ex[1]=[x,y];}
    if(a>P[2][0]){P[2][0]=a;ex[2]=[x,y];}if(b<P[3][0]){P[3][0]=b;ex[3]=[x,y];}}
  let qa=0;for(let i=0;i<4;i++){const p=ex[i],q=ex[(i+1)%4];qa+=p[0]*q[1]-q[0]*p[1];}qa=Math.abs(qa)/2;
  if(qa/N<.04||bs/qa<.6)return null;
  return ex;
}

/* edges + Hough lines: finds the document outline even when it fills the frame */
function edgeData(d,w,h){
  const N=w*h,mag=new Float32Array(N),gx=new Float32Array(N),gy=new Float32Array(N),hist=new Uint32Array(1024);let mx=0;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;let bm=0,bx=0,by=0;
    for(let ch=0;ch<3;ch++){const v=k=>d[k*4+ch];
      const sx=(v(i-w+1)+2*v(i+1)+v(i+w+1))-(v(i-w-1)+2*v(i-1)+v(i+w-1)),sy=(v(i+w-1)+2*v(i+w)+v(i+w+1))-(v(i-w-1)+2*v(i-w)+v(i-w+1));
      const m=Math.hypot(sx,sy);if(m>bm){bm=m;bx=sx;by=sy;}}   // strongest colour channel, so yellow-on-grey still counts
    gx[i]=bx;gy[i]=by;mag[i]=bm;if(bm>mx)mx=bm;}
  for(let i=0;i<N;i++)hist[Math.min(1023,mag[i]/(mx||1)*1023|0)]++;
  let acc=0,cut=0;for(let i=0;i<1024;i++){acc+=hist[i];if(acc>N*.88){cut=i/1023*mx;break;}}
  cut=Math.max(cut,mx*.08,20);
  return{w,h,mag,gx,gy,cut};
}
function supportRaw(E,q){
  const{w,h,mag,gx,gy,cut}=E;let tot=0,minS=1;
  for(let s=0;s<4;s++){
    const p=q[s],r=q[(s+1)%4],L=Math.hypot(r[0]-p[0],r[1]-p[1]);if(L<8)return{avg:0,min:0};
    const nx=-(r[1]-p[1])/L,ny=(r[0]-p[0])/L,n=Math.max(12,L/3|0);let ins=0,hit=0;
    for(let k=0;k<n;k++){const t=(k+.5)/n,x=Math.round(p[0]+(r[0]-p[0])*t),y=Math.round(p[1]+(r[1]-p[1])*t);
      if(x<2||y<2||x>=w-2||y>=h-2)continue;ins++;let ok=0;
      for(let dy=-2;dy<=2&&!ok;dy++)for(let dx=-2;dx<=2;dx++){const i=(y+dy)*w+x+dx;
        if(mag[i]>cut&&Math.abs(gx[i]*nx+gy[i]*ny)/mag[i]>.75){ok=1;break;}}
      hit+=ok;}
    if(ins<n*.4)return{avg:0,min:0};const sp=hit/ins;minS=Math.min(minS,sp);tot+=sp;}
  return{avg:tot/4,min:minS};
}
function quadSupport(E,q){const r=supportRaw(E,q);return r.min<.35?0:r.avg;}
// nudge each corner a few pixels so the sides sit exactly on real edges
function refine(E,q){
  const cl=p=>[Math.min(E.w-1,Math.max(0,p[0])),Math.min(E.h-1,Math.max(0,p[1]))];
  const o=q.map(cl);let c=o.map(p=>p.slice()),b=supportRaw(E,c).avg;
  const cap=Math.max(6,Math.min(E.w,E.h)*.05);
  for(const st of[4,2,1])for(let it=0;it<12;it++){let imp=false;
    for(let k=0;k<4;k++)for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;
      const t=c.map(p=>p.slice());t[k]=[t[k][0]+dx*st,t[k][1]+dy*st];
      if(Math.hypot(t[k][0]-o[k][0],t[k][1]-o[k][1])>cap)continue;
      const v=supportRaw(E,t.map(cl)).avg;if(v>b+1e-6){b=v;c=t;imp=true;}}
    if(!imp)break;}
  return c.map(cl);
}
function houghQ(E){
  const{w,h,mag,gx,gy,cut}=E,RH=Math.ceil(Math.hypot(w,h)),RW=2*RH+1,acc=new Float32Array(180*RW),C=[],S=[];
  for(let t=0;t<180;t++){C[t]=Math.cos(t*Math.PI/180);S[t]=Math.sin(t*Math.PI/180);}
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(mag[i]<=cut)continue;
    const dg=((Math.atan2(gy[i],gx[i])*180/Math.PI)%180+180)%180|0;
    for(let dt=-5;dt<=5;dt++){const t=(dg+dt+180)%180;acc[t*RW+Math.round(x*C[t]+y*S[t])+RH]+=1;}}
  let mv=0;for(let i=0;i<acc.length;i++)if(acc[i]>mv)mv=acc[i];
  if(mv<12)return null;
  const peaks=[],mn=Math.max(12,mv*.3);
  for(let t=0;t<180;t++)for(let r=0;r<RW;r++){const v=acc[t*RW+r];if(v<mn)continue;let best=true;
    for(let dt=-4;dt<=4&&best;dt++){const t2=(t+dt+180)%180,flip=(t+dt<0||t+dt>=180)?-1:1;
      for(let dr=-6;dr<=6;dr++){if(!dt&&!dr)continue;const r2=flip<0?(RH-(r-RH)+dr):r+dr;
        if(r2<0||r2>=RW)continue;if(acc[t2*RW+r2]>v||(acc[t2*RW+r2]===v&&(dt<0||(dt===0&&dr<0)))){best=false;break;}}}
    if(best)peaks.push({t,rho:r-RH,v});}
  peaks.sort((a,b)=>b.v-a.v);
  const Hs=[],Vs=[];
  for(const p of peaks){const L={t:p.t,rho:p.rho,a:C[p.t],b:S[p.t],v:p.v};(Math.abs(L.b)>.7071?Hs:Vs).push(L);}
  const hs=Hs.slice(0,9),vs=Vs.slice(0,9),X=(l1,l2)=>{const D=l1.a*l2.b-l2.a*l1.b;if(Math.abs(D)<.25)return null;
    return[(l1.rho*l2.b-l2.rho*l1.b)/D,(l1.a*l2.rho-l2.a*l1.rho)/D];};
  const ang=(l1,l2)=>{let d=Math.abs(l1.t-l2.t);return Math.min(d,180-d);};
  const res=[];
  for(let i=0;i<hs.length;i++)for(let j=i+1;j<hs.length;j++)for(let k=0;k<vs.length;k++)for(let l=k+1;l<vs.length;l++){
    const h1=hs[i],h2=hs[j],v1=vs[k],v2=vs[l];
    if(ang(h1,h2)>25||ang(v1,v2)>25)continue;
    const c=[X(h1,v1),X(h1,v2),X(h2,v2),X(h2,v1)];if(c.some(p=>!p))continue;
    // order as TL TR BR BL
    const cx=c.reduce((a,p)=>a+p[0],0)/4,cy=c.reduce((a,p)=>a+p[1],0)/4;
    const q=[null,null,null,null];
    for(const p of c){const i2=(p[1]<cy?0:3)+0;if(p[1]<cy){if(p[0]<cx)q[0]=p;else q[1]=p;}else{if(p[0]<cx)q[3]=p;else q[2]=p;}}
    if(q.some(p=>!p))continue;
    if(q.some(p=>p[0]<-w*.12||p[0]>w*1.12||p[1]<-h*.12||p[1]>h*1.12))continue;
    let ar=0;for(let z=0;z<4;z++){const p=q[z],r=q[(z+1)%4];ar+=p[0]*r[1]-r[0]*p[1];}ar=Math.abs(ar)/2;
    if(ar<w*h*.12)continue;
    const cl=q.map(p=>[Math.min(w-1,Math.max(0,p[0])),Math.min(h-1,Math.max(0,p[1]))]);
    const sp=quadSupport(E,cl);if(!sp)continue;const sc=sp*Math.sqrt(Math.min(1,ar/(w*h)));
    res.push({q:cl,sc});}
  return res;
}
function satQ(d,w,h){
  const N=w*h,mask=new Uint8Array(N);
  for(let i=0;i<N;i++){const r=d[i*4],g=d[i*4+1],b=d[i*4+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b);mask[i]=(mx>60&&(mx-mn)/mx>.38)?1:0;}
  return compQ(mask,w,h);
}
function sameQ(a,b,t){return a.every((p,i)=>Math.hypot(p[0]-b[i][0],p[1]-b[i][1])<t);}
function detectAll(c){
  const m=Math.min(1,320/Math.max(c.width,c.height)),w=Math.round(c.width*m),h=Math.round(c.height*m);
  const t=document.createElement('canvas');t.width=w;t.height=h;const tg=t.getContext('2d');
  tg.imageSmoothingQuality='high';tg.drawImage(c,0,0,w,h);const d=tg.getImageData(0,0,w,h).data;
  const E=edgeData(d,w,h),raw=[];
  try{const q=segQ(d,w,h);if(q)raw.push({q,sc:0});}catch(e){}
  try{const q=satQ(d,w,h);if(q)raw.push({q,sc:0});}catch(e){}
  try{raw.push(...houghQ(E).sort((a,b)=>b.sc-a.sc).slice(0,12));}catch(e){}
  const out=[];
  for(const r of raw){
    const q=refine(E,r.q),sp=quadSupport(E,q);if(!sp)continue;
    let ar=0;for(let z=0;z<4;z++){const p=q[z],n=q[(z+1)%4];ar+=p[0]*n[1]-n[0]*p[1];}ar=Math.abs(ar)/2/(w*h);
    const sc=sp*Math.sqrt(Math.min(1,ar));if(sc<.3)continue;
    if(out.some(o=>sameQ(o.q,q,Math.max(w,h)*.05)))continue;
    out.push({q,sc});}
  out.sort((a,b)=>b.sc-a.sc);
  if(out.length)return out.slice(0,5).map(o=>o.q.map(p=>[Math.min(c.width,Math.max(0,p[0]/m)),Math.min(c.height,Math.max(0,p[1]/m))]));

  // A4 sheets sometimes fill the camera frame, leaving no outer background
  // for segmentation. In that case detect a near-A4 portrait paper frame.
  const aspect=Math.min(w,h)/Math.max(w,h);
  if(aspect>=.66&&aspect<=.78){
    const brightPaper=(x,y)=>{
      const i=(y*w+x)*4,r=d[i],g=d[i+1],b=d[i+2];
      return (r*.299+g*.587+b*.114)>150&&Math.max(r,g,b)-Math.min(r,g,b)<75;
    };
    const sides=[
      Array.from({length:12},(_,i)=>brightPaper(Math.round(w*(.04+i*.92/11)),Math.max(1,Math.round(h*.008)))),
      Array.from({length:12},(_,i)=>brightPaper(Math.round(w*(.04+i*.92/11)),Math.min(h-2,Math.round(h*.992)))),
      Array.from({length:12},(_,i)=>brightPaper(Math.max(1,Math.round(w*.008)),Math.round(h*(.04+i*.92/11)))),
      Array.from({length:12},(_,i)=>brightPaper(Math.min(w-2,Math.round(w*.992)),Math.round(h*(.04+i*.92/11))))
    ];
    if(sides.every(side=>side.filter(Boolean).length>=7)){
      const insetX=c.width*.012,insetY=c.height*.012;
      return[[insetX,insetY],[c.width-insetX,insetY],[c.width-insetX,c.height-insetY],[insetX,c.height-insetY]];
    }
  }
  return [];
}
let cands=[],ci=0;
function autoPts(c){cands=[];ci=0;try{cands=detectAll(c);}catch(e){console.error(e);}return{pts:cands[0]||defPts(c),ok:!!cands.length};}
function setHint(ok){setHint0(ok);if(qTotal>1)$('hint').textContent='صورة '+qDone+' من '+qTotal+' · '+$('hint').textContent;}
function setHint0(ok){$('hint').textContent=ok?'تم الكشف تلقائياً ('+(ci+1)+' من '+cands.length+')'+(cands.length>1?'. اضغط «كشف تلقائي» لاقتراح آخر. ':'. ')+'عدّل الزوايا إذا تحتاج':'ما قدرت أكشف الحواف تلقائياً (جرب خلفية بلون مختلف). حدد الزوايا يدوياً';}

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
  pts[drag]=[Math.min(img.width,Math.max(0,x/sc)),Math.min(img.height,Math.max(0,y/sc))];draw();};
cv.onpointerup=()=>drag=-1;
$('rot').onclick=()=>{
  const c=document.createElement('canvas');c.width=img.height;c.height=img.width;
  const g=c.getContext('2d');g.translate(c.width,0);g.rotate(Math.PI/2);g.drawImage(img,0,0);
  cur.src=c;img=c;const a=autoPts(c);pts=a.pts;setHint(a.ok);fit();draw();
};
$('auto').onclick=()=>{if(cands.length>1){ci=(ci+1)%cands.length;pts=cands[ci].map(p=>p.slice());setHint(true);}else{const a=autoPts(img);pts=a.pts;setHint(a.ok);}draw();};
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


// ==================== STATE ====================
var currentUser=null,notes=[],activeNoteId=null,activeFilter='all',deleteTargetId=null,isReadMode=false,autoSaveTimer=null;
let _authAnimActive=false,_authRaf=null;

// Clean up mobile drawer classes when resizing to desktop
window.addEventListener('resize',()=>{
  if(window.innerWidth>768){
    const ne=document.getElementById('notesEditor');
    const ns=document.querySelector('.notes-sidebar');
    if(ne)ne.classList.remove('drawer-open');
    if(ns)ns.classList.remove('drawer-hidden');
  }
});

// ==================== NAV ====================
function updateNav(){
  const loggedIn=!!currentUser;
  const settingsAccess=!!window.canOpenSettings?.();
  const showUserBtns=loggedIn;
  // Desktop
  ['registerNavBtn'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=showUserBtns?'none':''});
  ['profileBtn'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=loggedIn?'':'none'});
  ['settingsBtn'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=settingsAccess?'':'none'});
  const notesButton=document.getElementById('notesBtn');if(notesButton){notesButton.style.display='';notesButton.textContent=loggedIn?'Notes':'My Scroll'}
  // Mobile menu
  ['mRegisterBtn'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=showUserBtns?'none':'block'});
  ['mProfileBtn'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=loggedIn?'block':'none'});
  ['mSettingsBtn'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=settingsAccess?'block':'none'});
  const mobileNotesButton=document.getElementById('mNotesBtn');if(mobileNotesButton){mobileNotesButton.style.display='block';mobileNotesButton.textContent=loggedIn?'Notes':'My Scroll'}
}

function openNotesFromNav(){
  const authStatus=window.getKonohaAuthState?.();
  if(currentUser||authStatus==='guest')showView('notes');
  else if(authStatus==='loading')showToast('Checking your sign-in status. Try again in a moment.','');
  else showView('auth','login');
}

function handleLogoClick(){
  if(document.getElementById('view-home').classList.contains('active'))window.scrollTo({top:0,behavior:'smooth'});
  else showView('home');
}

function navToHome(section){
  if(document.getElementById('view-home').classList.contains('active')){
    let el=document.getElementById(section);
    // For clans, scroll to the outer container instead of sticky inner
    
    if(el){
      el.scrollIntoView({behavior:'smooth',block:'start'});
      animateSection(section);
    }
  } else {
    showView('home');
    setTimeout(()=>{
      let el=document.getElementById(section);
      
      if(el){
        el.scrollIntoView({behavior:'smooth',block:'start'});
        animateSection(section);
      }
    },600);
  }
}

function animateSection(section){
  const el=document.getElementById(section);
  if(!el)return;

  // Remove any existing animation classes
  el.classList.remove('section-appear','section-appear-fast','timeline-appear','legend-appear','clan-appear');

  // Add appropriate animation based on section type
  if(section==='history'){
    el.classList.add('section-appear');
    const items=el.querySelectorAll('.timeline-item');
    items.forEach((item,i)=>{
      item.classList.remove('timeline-appear');
      setTimeout(()=>item.classList.add('timeline-appear'),i*150);
    });
  }else if(section==='legends'){
    el.classList.add('section-appear');
    const cards=el.querySelectorAll('.legend-card');
    cards.forEach((card,i)=>{
      card.classList.remove('legend-appear');
      setTimeout(()=>card.classList.add('legend-appear'),i*100);
    });
  }else if(section==='clans'){
    el.classList.add('section-appear');
    const cards=el.querySelectorAll('.clan-card');
    cards.forEach((card,i)=>{
      card.classList.remove('clan-appear');
      setTimeout(()=>card.classList.add('clan-appear'),i*100);
    });
  }else if(section==='features'){
    el.classList.add('section-appear-fast');
    const cards=el.querySelectorAll('.feature-card');
    cards.forEach((card,i)=>{
      card.style.opacity='0';
      card.style.transform='translateY(30px)';
      setTimeout(()=>{
        card.style.transition='all 0.5s cubic-bezier(0.22,1,0.36,1)';
        card.style.opacity='1';
        card.style.transform='translateY(0)';
      },i*100);
    });
  }else{
    el.classList.add('section-appear');
  }
}

function scrollToSection(id){navToHome(id)}

// ==================== VIEW ROUTING ====================
function showView(name,sub){
  const authStatus=window.getKonohaAuthState?.();
  if(name==='auth'&&authStatus==='authenticated'){
    showView('notes');return
  }
  if(name==='settings'&&!window.canOpenSettings?.()){
    if(authStatus==='loading'){
      showToast('Checking your sign-in status. Try again in a moment.','');
      return;
    }
    showView('auth','login');return
  }
  if((name==='profile'&&!currentUser)||(name==='notes'&&!currentUser&&authStatus!=='guest')){
    if(authStatus==='loading'){
      showToast('Checking your sign-in status. Try again in a moment.','');
      return;
    }
    showView('auth','login');return
  }
    if(name==='profile')updateProfileData();
  

  const t=document.getElementById('pageTransition');
  t.classList.add('enter');
  setTimeout(()=>{
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    const target=document.getElementById('view-'+name);
    if(target)target.classList.add('active');

    if(name==='auth'){
      // Show auth canvas elements
      document.getElementById('authBgCanvas').style.display='block';
      document.getElementById('authCursor').style.display='block';
      document.getElementById('authCring').style.display='block';
      switchAuthMode(sub||'login');
      setTimeout(()=>initAuthAnimations(),50);
    } else {
      // Stop auth animations when leaving auth
      stopAuthAnimations();
    }

    if(name==='notes'){
      renderNotesList();ensureEditorState();
      if(!currentUser){
        document.getElementById('editorEmptyTitle').textContent='Private Scrolls';
        document.getElementById('editorEmptyText').textContent='Sign in or register to create and manage your private scrolls.';
        document.getElementById('editorEmptyBtn').textContent='Sign in to create a scroll';
      }
    }
    if(name==='settings')window.loadSettingsPage?.();
    if(name==='home'){initHeroCanvas();initScrollObserver()}

    t.classList.remove('enter');t.classList.add('exit');
    setTimeout(()=>t.classList.remove('exit'),500);
    window.scrollTo(0,0);
  },450);
}

// ==================== RENDER ====================
function renderNotesList(){
  const list=document.getElementById('notesList');
  const search=(document.getElementById('notesSearch').value||'').toLowerCase();
  const filtered=window.filterAndSortNotes(notes,{search,filter:activeFilter});
  document.getElementById('noteCount').textContent=filtered.length;
  if(filtered.length===0){
    const emptyMessage=notes.length===0
      ? (window.getKonohaAuthState?.()==='authenticated'?'No scrolls yet.<br>Create your first one below.':'Sign in or register to access your private scrolls.')
      : 'No scrolls match your search.';
    list.innerHTML=`<div class="notes-empty-state"><div class="empty-icon">📜</div><p>${emptyMessage}</p></div>`;
    return;
  }
  list.innerHTML=filtered.map(note=>{
    const preview=note.content?note.content.replace(/<[^>]*>/g,'').slice(0,60)+'...':'Empty scroll…';
    const date=new Date(note.updatedAt).toLocaleDateString('en',{month:'short',day:'numeric'});
    return`<div class="note-item${note.id===activeNoteId?' active':''}" data-id="${note.id}" onclick="openNote('${note.id}')">
      <div class="note-item-title">${escapeHtml(note.title)}</div>
      <div class="note-item-preview">${escapeHtml(preview)}</div>
      <div class="note-item-meta"><span class="note-item-date">${date}</span><div class="note-item-badges">${note.pinned?'<span class="badge badge-pin">📌</span>':''}${(note.tags||[]).length?'<span class="badge badge-sealed">🏷 '+(note.tags||[]).length+'</span>':''}</div></div>
      <div class="note-item-actions"><button class="icon-btn ${note.pinned?'pin-active':''}" aria-label="${note.pinned?'Unpin':'Pin'} scroll" onclick="pinNoteById('${note.id}',event)">📌</button><button class="icon-btn delete" aria-label="Delete scroll" onclick="deleteNoteById('${note.id}',event)">🔥</button></div>
    </div>`;
  }).join('');
}

function closeMobileDrawer(){
  document.getElementById('notesEditor').classList.remove('drawer-open');
  document.querySelector('.notes-sidebar').classList.remove('drawer-hidden','list-open');
  /* Keep activeNoteId so re-opening same note preserves state */
  if(window.innerWidth<=768){
    document.getElementById('editorEmpty').style.display='flex';
    document.getElementById('editorActive').style.display='none';
  }
}

async function toggleMobileNotesList(){
  const sidebar=document.querySelector('.notes-sidebar');
  if(!sidebar||window.innerWidth>768)return;
  if(sidebar.classList.contains('list-open')){
    closeMobileNotesList();
    return;
  }
  if(window.activeNoteId&&typeof window.saveNote==='function'){
    clearTimeout(window.autoSaveTimer);
    if(await window.saveNote()===false)return;
  }
  sidebar.classList.add('list-open');
}

function closeMobileNotesList(){
  document.querySelector('.notes-sidebar')?.classList.remove('list-open');
}

function ensureEditorState(){
  document.getElementById('editorEmptyTitle').textContent='No Scroll Selected';
  document.getElementById('editorEmptyText').textContent='Create a new scroll or select one to begin writing.';
  document.getElementById('editorEmptyBtn').textContent='Create First Scroll';
  document.getElementById('editorEmptyBtn').onclick=createNote;
  if(activeNoteId&&notes.find(n=>n.id===activeNoteId))openNote(activeNoteId);
  else{document.getElementById('editorEmpty').style.display='flex';document.getElementById('editorActive').style.display='none'}
}

function filterNotes(){renderNotesList()}
function setFilter(f,el){activeFilter=f;document.querySelectorAll('.filter-tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');renderNotesList()}

// ==================== TAGS ====================
function renderTags(tags){
  document.getElementById('tagsList').innerHTML=tags.map((t,i)=>`<span class="tag-chip">${escapeHtml(t)}<button onclick="removeTag(${i})">×</button></span>`).join('');
}
// ==================== FORMAT ====================
function fmt(cmd){document.execCommand(cmd,false,null);document.getElementById('note-content-editor').focus()}
function fmtHeading(n){document.execCommand('formatBlock',false,'h'+n);document.getElementById('note-content-editor').focus()}
function fmtList(t){document.execCommand(t==='ul'?'insertUnorderedList':'insertOrderedList',false,null)}
function fmtQuote(){document.execCommand('formatBlock',false,'blockquote')}
function fmtCode(){const sel=window.getSelection();if(sel&&sel.toString())document.execCommand('insertHTML',false,`<code style="background:var(--surf3);padding:2px 6px;border-radius:2px;font-family:monospace;color:var(--red3)">${sel.toString()}</code>`)}
function fmtLink(){const url=prompt('Enter URL:');if(url)document.execCommand('createLink',false,url)}
function fmtRule(){document.execCommand('insertHTML',false,'<hr style="border:none;border-top:1px solid var(--border);margin:24px 0"/>')}
function changeFont(){document.getElementById('note-content-editor').style.fontFamily=document.getElementById('fontSelect').value}
function handleEditorKey(e){if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveNote()}}
function updateWordCount(){
  const text=document.getElementById('note-content-editor').innerText||'';
  const words=text.trim()?text.trim().split(/\s+/).length:0;
  document.getElementById('wordCount').textContent=words+' words';
  document.getElementById('charCount').textContent=text.length+' characters';
}

// ==================== TOAST ====================
function showToast(msg,type){
  const c=document.getElementById('toast-container');
  const t=document.createElement('div');t.className='toast'+(type?' '+type:'');t.textContent=msg;c.appendChild(t);
  setTimeout(()=>{t.style.animation='toastOut 0.4s forwards';setTimeout(()=>t.remove(),400)},2800);
}
function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

// ==================== PARTICLES ====================

// ==================== HERO CANVAS ====================
let _heroRaf=null,_heroInited=false;
function initHeroCanvas(){
  const canvas=document.getElementById('hero-canvas');
  if(!canvas||_heroInited)return;
  _heroInited=true;
  const ctx=canvas.getContext('2d');
  function resize(){
    if(window.matchMedia('(max-width: 768px)').matches){
      canvas.width=Math.max(1,canvas.clientWidth);
      canvas.height=Math.max(1,canvas.clientHeight);
      return;
    }
    canvas.width=window.innerWidth;
    canvas.height=window.innerHeight;
  }
  resize();window.addEventListener('resize',resize);

  function drawMoon(t){
    const W=canvas.width,H=canvas.height;
    const mobile=window.matchMedia('(max-width: 768px)').matches;
    const cx=W*(mobile?0.5:0.75),cy=H*(mobile?0.5:0.40);
    const R=Math.min(W,H)*(mobile?0.23:0.18);
    const haze=ctx.createRadialGradient(cx,cy,R*0.5,cx,cy,R*4.5);
    haze.addColorStop(0,'rgba(120,0,0,0.07)');
    haze.addColorStop(0.3,'rgba(80,0,0,0.04)');
    haze.addColorStop(1,'transparent');
    ctx.beginPath();ctx.arc(cx,cy,R*4.5,0,Math.PI*2);
    ctx.fillStyle=haze;ctx.fill();
    const midGlow=ctx.createRadialGradient(cx,cy,0,cx,cy,R*2.2);
    midGlow.addColorStop(0,'rgba(160,10,0,0.18)');
    midGlow.addColorStop(0.5,'rgba(100,0,0,0.09)');
    midGlow.addColorStop(1,'transparent');
    ctx.beginPath();ctx.arc(cx,cy,R*2.2,0,Math.PI*2);
    ctx.fillStyle=midGlow;ctx.fill();
    const corona=ctx.createRadialGradient(cx,cy,R*0.88,cx,cy,R*1.3);
    corona.addColorStop(0,'rgba(200,20,0,0.25)');
    corona.addColorStop(0.4,'rgba(150,5,0,0.12)');
    corona.addColorStop(1,'transparent');
    ctx.beginPath();ctx.arc(cx,cy,R*1.3,0,Math.PI*2);
    ctx.fillStyle=corona;ctx.fill();
    const moonGrad=ctx.createRadialGradient(cx-R*0.28,cy-R*0.32,R*0.05,cx,cy,R);
    moonGrad.addColorStop(0,'#5a0a0a');
    moonGrad.addColorStop(0.25,'#3d0505');
    moonGrad.addColorStop(0.6,'#250202');
    moonGrad.addColorStop(0.85,'#150101');
    moonGrad.addColorStop(1,'#0a0000');
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.fillStyle=moonGrad;ctx.fill();
    const limb=ctx.createRadialGradient(cx,cy,R*0.7,cx,cy,R);
    limb.addColorStop(0,'transparent');
    limb.addColorStop(0.7,'transparent');
    limb.addColorStop(1,'rgba(0,0,0,0.55)');
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.fillStyle=limb;ctx.fill();
    const craters=[[0.18,-0.22,0.085,0.7],[-0.28,0.14,0.065,0.6],[0.35,0.28,0.055,0.5],[-0.12,-0.38,0.045,0.55],[0.08,0.40,0.038,0.5],[-0.40,-0.1,0.032,0.45],[0.25,-0.05,0.028,0.4],[-0.05,0.22,0.025,0.38],[0.42,-0.25,0.022,0.35],[-0.22,0.38,0.02,0.32]];
    craters.forEach(([dx,dy,cr,alpha])=>{
      const px=cx+dx*R,py=cy+dy*R;
      const cg=ctx.createRadialGradient(px+cr*R*0.4,py+cr*R*0.4,0,px,py,cr*R);
      cg.addColorStop(0,`rgba(0,0,0,${alpha*0.7})`);
      cg.addColorStop(0.6,`rgba(0,0,0,${alpha*0.4})`);
      cg.addColorStop(1,'transparent');
      ctx.beginPath();ctx.arc(px,py,cr*R,0,Math.PI*2);
      ctx.fillStyle=cg;ctx.fill();
      ctx.beginPath();ctx.arc(px-cr*R*0.2,py-cr*R*0.2,cr*R*0.9,0,Math.PI*2);
      ctx.strokeStyle=`rgba(90,15,5,${alpha*0.3})`;
      ctx.lineWidth=0.5;ctx.stroke();
    });
    const pulse=0.5+0.5*Math.sin(t*0.0008);
    const pulseGlow=ctx.createRadialGradient(cx,cy,R*0.9,cx,cy,R*1.5);
    pulseGlow.addColorStop(0,`rgba(180,20,0,${0.06*pulse})`);
    pulseGlow.addColorStop(1,'transparent');
    ctx.beginPath();ctx.arc(cx,cy,R*1.5,0,Math.PI*2);
    ctx.fillStyle=pulseGlow;ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.strokeStyle='rgba(130,15,0,0.3)';
    ctx.lineWidth=1.5;ctx.stroke();
    const dripGrad=ctx.createLinearGradient(cx,cy+R*0.9,cx,H);
    dripGrad.addColorStop(0,'rgba(100,0,0,0.08)');
    dripGrad.addColorStop(0.4,'rgba(60,0,0,0.04)');
    dripGrad.addColorStop(1,'transparent');
    ctx.beginPath();
    ctx.moveTo(cx-R*0.5,cy+R*0.9);
    ctx.lineTo(cx-W*0.25,H);
    ctx.lineTo(cx+W*0.25,H);
    ctx.lineTo(cx+R*0.5,cy+R*0.9);
    ctx.fillStyle=dripGrad;ctx.fill();
  }

  const STARS=Array.from({length:180},()=>({
    x:Math.random(),y:Math.random()*0.85,
    r:Math.random()*1.2+0.2,a:Math.random()*0.5+0.1,
    phase:Math.random()*Math.PI*2,speed:Math.random()*0.002+0.0005
  }));
  function drawStars(t){
    STARS.forEach(s=>{
      const flicker=0.5+0.5*Math.sin(t*s.speed+s.phase);
      ctx.beginPath();
      ctx.arc(s.x*canvas.width,s.y*canvas.height,s.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(220,150,130,${s.a*flicker*0.6})`;
      ctx.fill();
    });
  }

  function drawTomoe(c,cx,cy,r,count,rotOff){
    for(let i=0;i<count;i++){
      const a=(i/count)*Math.PI*2+rotOff;
      const tr=r*0.55;
      const tx=cx+Math.cos(a)*tr,ty=cy+Math.sin(a)*tr;
      c.save();c.translate(tx,ty);c.rotate(a+Math.PI/2);
      c.beginPath();c.arc(0,-r*0.09,r*0.13,0,Math.PI*2);
      c.fillStyle='rgba(18,0,0,0.92)';c.fill();
      c.strokeStyle='rgba(160,0,0,0.5)';c.lineWidth=0.7;c.stroke();
      c.beginPath();
      c.moveTo(0,-r*0.09);
      c.bezierCurveTo(r*0.09,-r*0.22,r*0.05,-r*0.33,0,-r*0.31);
      c.bezierCurveTo(-r*0.05,-r*0.33,-r*0.09,-r*0.22,0,-r*0.09);
      c.fillStyle='rgba(18,0,0,0.92)';c.fill();
      c.strokeStyle='rgba(145,0,0,0.45)';c.lineWidth=0.65;c.stroke();
      c.restore();
    }
  }

  function drawVariant(c,cx,cy,r,v,t){
    const rot=t*0.0003;
    const g=c.createRadialGradient(cx,cy,0,cx,cy,r*1.3);
    g.addColorStop(0,'rgba(115,0,0,0.15)');g.addColorStop(1,'transparent');
    c.beginPath();c.arc(cx,cy,r*1.3,0,Math.PI*2);c.fillStyle=g;c.fill();
    const ig=c.createRadialGradient(cx-r*0.15,cy-r*0.15,0,cx,cy,r);
    ig.addColorStop(0,'rgba(160,10,10,0.95)');
    ig.addColorStop(0.55,'rgba(90,3,3,0.92)');
    ig.addColorStop(1,'rgba(25,0,0,0.86)');
    c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fillStyle=ig;c.fill();
    c.strokeStyle='rgba(145,0,0,0.6)';c.lineWidth=0.9;c.stroke();
    c.save();c.translate(cx,cy);
    switch(v%14){
      case 0:c.save();c.rotate(rot*2);for(let i=0;i<3;i++){const a=(i/3)*Math.PI*2;c.beginPath();c.moveTo(0,0);c.arc(0,0,r*0.55,a,a+Math.PI*0.55);c.lineTo(0,0);c.fillStyle='rgba(20,0,0,0.9)';c.fill();c.strokeStyle='rgba(158,0,0,0.45)';c.lineWidth=0.65;c.stroke();}c.restore();break;
      case 1:c.save();c.rotate(rot);for(let i=0;i<4;i++){const a=(i/4)*Math.PI*2;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*r*0.7,Math.sin(a)*r*0.7);c.lineWidth=r*0.17;c.strokeStyle='rgba(20,0,0,0.9)';c.stroke();c.lineWidth=0.5;c.strokeStyle='rgba(155,0,0,0.4)';c.stroke();}c.restore();break;
      case 2:c.save();c.rotate(rot*1.5);for(let i=0;i<3;i++){const a=(i/3)*Math.PI*2;c.beginPath();c.moveTo(Math.cos(a)*r*0.65,Math.sin(a)*r*0.65);c.bezierCurveTo(Math.cos(a+0.8)*r*0.3,Math.sin(a+0.8)*r*0.3,Math.cos(a+1.6)*r*0.3,Math.sin(a+1.6)*r*0.3,Math.cos(a+2.09)*r*0.65,Math.sin(a+2.09)*r*0.65);c.strokeStyle='rgba(20,0,0,0.92)';c.lineWidth=r*0.19;c.stroke();c.strokeStyle='rgba(175,0,0,0.38)';c.lineWidth=0.6;c.stroke();}c.restore();break;
      case 3:c.save();c.rotate(rot*0.8);c.beginPath();for(let a=0;a<Math.PI*6;a+=0.05){const rr=a/(Math.PI*6)*r*0.62;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.strokeStyle='rgba(148,0,0,0.6)';c.lineWidth=1;c.stroke();c.restore();break;
      case 4:c.save();c.rotate(-rot);for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2;c.beginPath();c.ellipse(Math.cos(a)*r*0.32,Math.sin(a)*r*0.32,r*0.26,r*0.13,a,0,Math.PI*2);c.fillStyle='rgba(18,0,0,0.88)';c.fill();c.strokeStyle='rgba(158,0,0,0.42)';c.lineWidth=0.6;c.stroke();}c.restore();break;
      case 5:c.save();c.rotate(rot*1.3);for(let i=0;i<4;i++){const a=(i/4)*Math.PI*2;c.beginPath();c.moveTo(0,0);c.arc(0,0,r*0.58,a,a+Math.PI*0.42);c.lineTo(0,0);c.fillStyle='rgba(20,0,0,0.9)';c.fill();c.strokeStyle='rgba(165,0,0,0.42)';c.lineWidth=0.6;c.stroke();}c.restore();break;
      case 6:drawTomoe(c,0,0,r,3,rot);break;
      case 7:c.save();c.rotate(rot*0.6);for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;c.beginPath();c.moveTo(Math.cos(a)*r*0.22,Math.sin(a)*r*0.22);c.lineTo(Math.cos(a)*r*0.68,Math.sin(a)*r*0.68);c.strokeStyle='rgba(20,0,0,0.88)';c.lineWidth=r*0.13;c.stroke();c.strokeStyle='rgba(162,0,0,0.38)';c.lineWidth=0.5;c.stroke();}c.restore();break;
      case 8:c.save();c.rotate(rot);for(let i=0;i<2;i++){const a=i*Math.PI+rot*0.3;c.beginPath();c.arc(0,0,r*0.6,a,a+Math.PI*0.82);c.lineTo(0,0);c.closePath();c.fillStyle='rgba(16,0,0,0.9)';c.fill();c.strokeStyle='rgba(152,0,0,0.38)';c.lineWidth=0.6;c.stroke();}c.restore();break;
      case 9:c.save();c.rotate(-rot*1.2);for(let i=0;i<3;i++){const a=(i/3)*Math.PI*2;c.beginPath();c.arc(Math.cos(a)*r*0.18,Math.sin(a)*r*0.18,r*0.5,a+0.6,a+0.6+Math.PI*1.1);c.strokeStyle='rgba(18,0,0,0.9)';c.lineWidth=r*0.16;c.stroke();c.strokeStyle='rgba(168,0,0,0.38)';c.lineWidth=0.6;c.stroke();}c.restore();break;
      case 10:c.save();c.rotate(rot*0.5);for(let i=0;i<3;i++){const a=(i/3)*Math.PI*2;c.beginPath();c.moveTo(Math.cos(a)*r*0.68,Math.sin(a)*r*0.68);c.lineTo(Math.cos(a+Math.PI)*r*0.68,Math.sin(a+Math.PI)*r*0.68);c.strokeStyle='rgba(20,0,0,0.88)';c.lineWidth=r*0.13;c.stroke();c.strokeStyle='rgba(158,0,0,0.38)';c.lineWidth=0.5;c.stroke();}c.restore();break;
      case 11:[0.68,0.48,0.28].forEach(m=>{c.beginPath();c.arc(0,0,r*m,0,Math.PI*2);c.strokeStyle='rgba(142,0,0,0.5)';c.lineWidth=r*0.07;c.stroke();});break;
      case 12:c.save();c.rotate(rot*1.8);for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2;c.beginPath();c.moveTo(0,0);c.arc(0,0,r*0.58,a,a+Math.PI*0.46);c.lineTo(0,0);c.fillStyle='rgba(18,0,0,0.9)';c.fill();c.strokeStyle='rgba(162,0,0,0.38)';c.lineWidth=0.6;c.stroke();}c.restore();break;
      case 13:c.save();c.rotate(Math.PI/4+rot*0.4);for(let i=0;i<4;i++){const a=(i/4)*Math.PI*2;c.beginPath();c.moveTo(Math.cos(a)*r*0.65,Math.sin(a)*r*0.65);c.quadraticCurveTo(Math.cos(a+Math.PI*0.5)*r*0.38,Math.sin(a+Math.PI*0.5)*r*0.38,Math.cos(a+Math.PI*0.5)*r*0.65,Math.sin(a+Math.PI*0.5)*r*0.65);c.strokeStyle='rgba(20,0,0,0.88)';c.lineWidth=r*0.14;c.stroke();c.strokeStyle='rgba(158,0,0,0.38)';c.lineWidth=0.5;c.stroke();}c.restore();break;
    }
    const pp=c.createRadialGradient(0,0,0,0,0,r*0.24);
    pp.addColorStop(0,'rgba(0,0,0,1)');pp.addColorStop(1,'rgba(10,0,0,1)');
    c.beginPath();c.arc(0,0,r*0.24,0,Math.PI*2);c.fillStyle=pp;c.fill();
    c.beginPath();c.arc(0,0,r*0.24,0,Math.PI*2);c.strokeStyle='rgba(120,0,0,0.3)';c.lineWidth=0.6;c.stroke();
    c.restore();
  }

  function drawCentralSharingan(t,cx,cy,R0){
    const rot=t*0.00022;
    ctx.save();ctx.globalAlpha=0.45;
    [1.0,0.78].forEach((m,i)=>{
      ctx.beginPath();ctx.arc(cx,cy,R0*m,0,Math.PI*2);
      ctx.strokeStyle=`rgba(160,0,0,${0.4-i*0.1})`;ctx.lineWidth=1.2-i*0.3;ctx.stroke();
    });
    ctx.save();ctx.translate(cx,cy);
    ctx.save();ctx.rotate(rot);
    for(let i=0;i<12;i++){const a=(i/12)*Math.PI*2;ctx.beginPath();ctx.arc(Math.cos(a)*R0*0.82,Math.sin(a)*R0*0.82,2.2,0,Math.PI*2);ctx.fillStyle='rgba(185,0,0,0.6)';ctx.fill();}
    ctx.restore();
    ctx.save();ctx.rotate(-rot*1.5);
    for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;ctx.beginPath();ctx.arc(Math.cos(a)*R0*0.6,Math.sin(a)*R0*0.6,1.6,0,Math.PI*2);ctx.fillStyle='rgba(160,0,0,0.5)';ctx.fill();}
    ctx.restore();
    for(let i=0;i<6;i++){
      const a=(i/6)*Math.PI*2+rot;
      const tr=R0*0.55;
      const tx=Math.cos(a)*tr,ty=Math.sin(a)*tr;
      ctx.save();ctx.translate(tx,ty);ctx.rotate(a+Math.PI/2);
      ctx.beginPath();ctx.arc(0,-R0*0.09,R0*0.13,0,Math.PI*2);ctx.fillStyle='rgba(12,0,0,0.85)';ctx.fill();
      ctx.strokeStyle='rgba(150,0,0,0.45)';ctx.lineWidth=0.7;ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,-R0*0.09);ctx.bezierCurveTo(R0*0.09,-R0*0.22,R0*0.05,-R0*0.33,0,-R0*0.31);ctx.bezierCurveTo(-R0*0.05,-R0*0.33,-R0*0.09,-R0*0.22,0,-R0*0.09);ctx.fillStyle='rgba(12,0,0,0.85)';ctx.fill();ctx.restore();
    }
    ctx.save();ctx.rotate(rot*0.4);
    for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2;ctx.beginPath();ctx.moveTo(Math.cos(a)*R0*0.22,Math.sin(a)*R0*0.22);ctx.lineTo(Math.cos(a)*R0*0.49,Math.sin(a)*R0*0.49);ctx.strokeStyle='rgba(100,0,0,0.22)';ctx.lineWidth=0.8;ctx.stroke();}
    ctx.restore();
    ctx.beginPath();ctx.arc(0,0,R0*0.2,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fill();
    ctx.restore();ctx.restore();
  }

  function drawSharinganWheel(t){
    const W=canvas.width,H=canvas.height;
    const mobile=window.matchMedia('(max-width: 768px)').matches;
    const cx=W*(mobile?0.5:0.75),cy=H*(mobile?0.5:0.40);
    const moonR=Math.min(W,H)*(mobile?0.23:0.18);
    const ORBIT=moonR*1.6;
    const VSIZE=moonR*0.28;
    const orbitRot=t*0.00010;
    ctx.beginPath();ctx.arc(cx,cy,ORBIT,0,Math.PI*2);
    ctx.strokeStyle='rgba(60,0,0,0.08)';ctx.lineWidth=1;ctx.stroke();
    for(let i=0;i<14;i++){
      const a=(i/14)*Math.PI*2+orbitRot;
      const vx=cx+Math.cos(a)*ORBIT;
      const vy=cy+Math.sin(a)*ORBIT;
      drawVariant(ctx,vx,vy,VSIZE+(i%3)*VSIZE*0.12,i,t);
    }
    drawCentralSharingan(t,cx,cy,moonR*0.55);
  }

  class BloodDrop{
    constructor(init=false){this.reset(init);}
    reset(init=false){
      this.x=Math.random()*canvas.width;
      this.y=init?Math.random()*canvas.height:-12;
      this.vy=Math.random()*1.8+0.7;
      this.vx=(Math.random()-0.5)*0.3;
      this.r=Math.random()*3+1.2;
      this.alpha=Math.random()*0.35+0.1;
      this.stretch=Math.random()*1.5+1;
      this.trail=[];
    }
    update(){
      this.trail.push({x:this.x,y:this.y});
      if(this.trail.length>5)this.trail.shift();
      this.x+=this.vx;this.y+=this.vy;
      if(this.y>canvas.height+20)this.reset();
    }
    draw(){
      this.trail.forEach((p,i)=>{
        ctx.beginPath();ctx.arc(p.x,p.y,this.r*0.3,0,Math.PI*2);
        ctx.fillStyle=`rgba(110,0,0,${this.alpha*(i/this.trail.length)*0.3})`;ctx.fill();
      });
      ctx.save();ctx.translate(this.x,this.y);
      ctx.beginPath();ctx.arc(0,0,this.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(140,0,0,${this.alpha})`;ctx.fill();
      ctx.beginPath();ctx.moveTo(-this.r*0.5,0);ctx.bezierCurveTo(-this.r*0.38,-this.r*this.stretch,this.r*0.38,-this.r*this.stretch,this.r*0.5,0);
      ctx.fillStyle=`rgba(110,0,0,${this.alpha*0.6})`;ctx.fill();
      ctx.restore();
    }
  }

  
  const drops=Array.from({length:40},()=>new BloodDrop(true));

  function draw(t){
    if(!document.getElementById('view-home').classList.contains('active')){_heroRaf=null;_heroInited=false;return}
    _heroRaf=requestAnimationFrame(draw);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawStars(t);
    drawMoon(t);
    drawSharinganWheel(t);
    drops.forEach(d=>{d.update();d.draw();});
    
  }
  _heroRaf=requestAnimationFrame(draw);
}

// ==================== SCROLL OBSERVER ====================
function initScrollObserver(){
  if(document.body.dataset.scrollObserver)return;
  document.body.dataset.scrollObserver='1';
  const io=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')})},{threshold:0.1});
  document.querySelectorAll('.timeline-item,.legend-card,.scroll-reveal,.feature-card').forEach(el=>io.observe(el));
  document.querySelectorAll('.legend-card').forEach((el,i)=>el.style.transitionDelay=`${i*0.06}s`);
  document.querySelectorAll('.feature-card').forEach((el,i)=>el.style.transitionDelay=`${i*0.08}s`);
  initClanCards();
}

// ==================== CLAN CARDS ANIMATION ====================
function initClanCards(){
  const cards = document.querySelectorAll('#clans .clan-card');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

  cards.forEach(card => observer.observe(card));
}

// ==================== AUTH ANIMATIONS ====================
let authEyeMode='login';
let _bgLoopId=null,_eyeLoopId=null;
let _mouseMoveAuth=null;

function stopAuthAnimations(){
  _authAnimActive=false;
  if(_bgLoopId)cancelAnimationFrame(_bgLoopId);
  if(_eyeLoopId)cancelAnimationFrame(_eyeLoopId);
  _bgLoopId=null;_eyeLoopId=null;
  // Hide canvas & cursor
  const bc=document.getElementById('authBgCanvas');
  if(bc)bc.style.display='none';
  const cur=document.getElementById('authCursor');
  if(cur)cur.style.display='none';
  const crng=document.getElementById('authCring');
  if(crng)crng.style.display='none';
  if(_mouseMoveAuth){document.removeEventListener('mousemove',_mouseMoveAuth);_mouseMoveAuth=null}
}

function initAuthAnimations(){
  if(_authAnimActive)return;
  _authAnimActive=true;

  const cur=document.getElementById('authCursor');
  const crng=document.getElementById('authCring');
  if(cur&&crng){
    if(_mouseMoveAuth)document.removeEventListener('mousemove',_mouseMoveAuth);
    _mouseMoveAuth=e=>{
      cur.style.transform=`translate(${e.clientX-3.5}px,${e.clientY-3.5}px)`;
      crng.style.transform=`translate(${e.clientX-17}px,${e.clientY-17}px)`;
    };
    document.addEventListener('mousemove',_mouseMoveAuth);
  }

  const BC=document.getElementById('authBgCanvas');
  const bx=BC?BC.getContext('2d'):null;
  let BW,BH;
  function rszBg(){if(!BC)return;BW=BC.width=window.innerWidth;BH=BC.height=window.innerHeight}
  if(BC){rszBg();window.addEventListener('resize',rszBg)}
  const STARS=Array.from({length:260},()=>({
    x:Math.random(),y:Math.random(),
    r:Math.pow(Math.random(),2.8)*1.6+.12,
    base:Math.random()*.5+.12,
    ph:Math.random()*Math.PI*2,
    sp:Math.random()*.0018+.0004,
    hue:Math.random()<.12?'w':Math.random()<.1?'b':'n'
  }));
  function drawBgMoon(t){
    if(!bx||!BW)return;
    const cx=BW*.5,cy=BH*.36,R=Math.min(BW,BH)*.30;
    for(let i=5;i>0;i--){
      const h=bx.createRadialGradient(cx,cy,R*.9,cx,cy,R*(1+i*.65));
      h.addColorStop(0,`rgba(100,3,0,${.044/i})`);
      h.addColorStop(1,'transparent');
      bx.beginPath();bx.arc(cx,cy,R*(1+i*.65),0,Math.PI*2);bx.fillStyle=h;bx.fill();
    }
    const p=.5+.5*Math.sin(t*.00045);
    const cor=bx.createRadialGradient(cx,cy,R*.9,cx,cy,R*1.45);
    cor.addColorStop(0,`rgba(180,18,0,${.18+p*.1})`);
    cor.addColorStop(.5,'rgba(110,8,0,.07)');
    cor.addColorStop(1,'transparent');
    bx.beginPath();bx.arc(cx,cy,R*1.45,0,Math.PI*2);bx.fillStyle=cor;bx.fill();
    bx.save();bx.beginPath();bx.arc(cx,cy,R,0,Math.PI*2);bx.clip();
    const base=bx.createRadialGradient(cx-R*.22,cy-R*.22,R*.04,cx+R*.08,cy+R*.08,R*1.28);
    base.addColorStop(0,'#4a0505');base.addColorStop(.22,'#380303');
    base.addColorStop(.48,'#2a0202');base.addColorStop(.72,'#1c0101');base.addColorStop(1,'#0c0000');
    bx.fillStyle=base;bx.fillRect(cx-R,cy-R,R*2,R*2);
    [[.28,-.18,.44,.07],[-.32,.08,.40,.06],[.05,.35,.50,.06],[-.1,-.3,.36,.04]].forEach(([dx,dy,sr,a])=>{
      const hg=bx.createRadialGradient(cx+dx*R,cy+dy*R,0,cx+dx*R,cy+dy*R,sr*R);
      hg.addColorStop(0,`rgba(75,12,12,${a})`);hg.addColorStop(1,'transparent');
      bx.beginPath();bx.arc(cx+dx*R,cy+dy*R,sr*R,0,Math.PI*2);bx.fillStyle=hg;bx.fill();
    });
    [[.16,-.24,.09,1],[-.30,.12,.074,.9],[.38,.30,.062,.85],[-.14,-.40,.051,.8],
     [.06,.44,.045,.75],[-.44,-.08,.038,.7],[.24,-.06,.033,.65],[-.06,.24,.028,.6],
     [.46,-.22,.025,.55],[.10,-.52,.021,.5],[-.52,.28,.019,.45],[.32,.52,.017,.4]
    ].forEach(([dx,dy,cr,dp])=>{
      const px=cx+dx*R,py=cy+dy*R,cr2=cr*R;
      const fl=bx.createRadialGradient(px,py,0,px,py,cr2*.85);
      fl.addColorStop(0,`rgba(0,0,0,${.58*dp})`);fl.addColorStop(1,'transparent');
      bx.beginPath();bx.arc(px,py,cr2*.9,0,Math.PI*2);bx.fillStyle=fl;bx.fill();
    });
    const limb=bx.createRadialGradient(cx,cy,R*.6,cx,cy,R);
    limb.addColorStop(0,'transparent');limb.addColorStop(.65,'rgba(0,0,0,.10)');limb.addColorStop(1,'rgba(0,0,0,.66)');
    bx.beginPath();bx.arc(cx,cy,R,0,Math.PI*2);bx.fillStyle=limb;bx.fill();
    bx.restore();
    bx.beginPath();bx.arc(cx,cy,R,0,Math.PI*2);
    bx.strokeStyle='rgba(140,15,0,.22)';bx.lineWidth=1;bx.stroke();
  }
  function bgLoop(t){
    if(!_authAnimActive){_bgLoopId=null;return}
    _bgLoopId=requestAnimationFrame(bgLoop);
    if(!bx||!BW)return;
    bx.clearRect(0,0,BW,BH);
    STARS.forEach(s=>{
      const f=.6+.4*Math.sin(t*s.sp+s.ph),a=s.base*f;
      const sx=s.x*BW,sy=s.y*BH;
      const c3=s.hue==='w'?'255,220,180':s.hue==='b'?'200,215,255':'255,255,255';
      if(s.r>1){
        const sp=s.r*4;
        bx.save();bx.translate(sx,sy);
        [[0,sp],[sp,0]].forEach(([dx,dy])=>{
          const g=bx.createLinearGradient(-dx,-dy,dx,dy);
          g.addColorStop(0,'transparent');g.addColorStop(.5,`rgba(255,255,255,${a*.18})`);g.addColorStop(1,'transparent');
          bx.beginPath();bx.moveTo(-dx,-dy);bx.lineTo(dx,dy);
          bx.strokeStyle=g;bx.lineWidth=.6;bx.stroke();
        });
        bx.restore();
      }
      bx.beginPath();bx.arc(sx,sy,s.r,0,Math.PI*2);
      bx.fillStyle=`rgba(${c3},${a})`;bx.fill();
    });
    drawBgMoon(t);
  }
  if(BC)_bgLoopId=requestAnimationFrame(bgLoop);

  const EC=document.getElementById('authEyeCanvas');
  const ex=EC?EC.getContext('2d'):null;
  let EW,EH;
  function rszEye(){if(!EC)return;const rect=EC.getBoundingClientRect();EW=EC.width=rect.width*2;EH=EC.height=rect.height*2}
  if(EC){rszEye();window.addEventListener('resize',rszEye)}
  function drawMangekyo(t,cx,cy,R){
    const rot=t*.00022;
    const p=.5+.5*Math.sin(t*.00055);
    for(let i=3;i>0;i--){
      const gr=ex.createRadialGradient(cx,cy,R*.9,cx,cy,R*(1+i*.55));
      gr.addColorStop(0,`rgba(180,10,0,${.09/i})`);gr.addColorStop(1,'transparent');
      ex.beginPath();ex.arc(cx,cy,R*(1+i*.55),0,Math.PI*2);ex.fillStyle=gr;ex.fill();
    }
    ex.save();ex.translate(cx,cy);
    const goldPulse=.6+.4*Math.sin(t*.00055);
    for(let i=0;i<3;i++){
      const a0=(i/3)*Math.PI*2+rot;
      ex.save();ex.rotate(a0);
      ex.beginPath();
      for(let s=0;s<=200;s++){
        const ang=(s/200)*Math.PI*1.8;
        const rad=R*.28+(s/200)*R*.78;
        const px=Math.cos(ang)*rad,py=Math.sin(ang)*rad;
        s===0?ex.moveTo(px,py):ex.lineTo(px,py);
      }
      ex.strokeStyle=`rgba(200,125,0,${goldPulse*.55})`;
      ex.lineWidth=1.4;ex.stroke();
      ex.beginPath();
      for(let s=0;s<=120;s++){
        const ang=(s/120)*Math.PI*1.2;
        const rad=R*.15+(s/120)*R*.42;
        const px=Math.cos(ang)*rad,py=Math.sin(ang)*rad;
        s===0?ex.moveTo(px,py):ex.lineTo(px,py);
      }
      ex.strokeStyle=`rgba(180,90,0,${goldPulse*.35})`;
      ex.lineWidth=.9;ex.stroke();
      ex.restore();
    }
    ex.restore();
    ex.save();ex.beginPath();ex.arc(cx,cy,R,0,Math.PI*2);ex.clip();
    const base=ex.createRadialGradient(cx-R*.18,cy-R*.18,R*.04,cx,cy,R);
    base.addColorStop(0,'#5a0808');base.addColorStop(.4,'#3c0303');
    base.addColorStop(.75,'#280202');base.addColorStop(1,'#100000');
    ex.fillStyle=base;ex.fillRect(cx-R,cy-R,R*2,R*2);
    ex.restore();
    ex.beginPath();ex.arc(cx,cy,R,0,Math.PI*2);
    ex.strokeStyle='rgba(200,30,0,.75)';ex.lineWidth=2.5;ex.stroke();
    ex.beginPath();ex.arc(cx,cy,R*.88,0,Math.PI*2);
    ex.strokeStyle='rgba(160,20,0,.45)';ex.lineWidth=1;ex.stroke();
    ex.beginPath();ex.arc(cx,cy,R*.5,0,Math.PI*2);
    ex.strokeStyle='rgba(200,40,0,.55)';ex.lineWidth=1.2;ex.stroke();
    ex.save();ex.translate(cx,cy);ex.rotate(rot);
    for(let i=0;i<3;i++){
      ex.save();ex.rotate((i/3)*Math.PI*2);
      ex.beginPath();
      ex.moveTo(0,0);
      ex.bezierCurveTo(R*.18,-R*.1,R*.38,-R*.38,0,-R*.68);
      ex.bezierCurveTo(-R*.38,-R*.38,-R*.18,-R*.1,0,0);
      ex.closePath();
      const blg=ex.createLinearGradient(0,-R*.68,0,0);
      blg.addColorStop(0,'rgba(220,30,0,.95)');
      blg.addColorStop(.5,'rgba(160,15,0,.9)');
      blg.addColorStop(1,'rgba(80,5,0,.7)');
      ex.fillStyle=blg;ex.fill();
      ex.beginPath();
      ex.moveTo(0,-R*.15);
      ex.bezierCurveTo(R*.05,-R*.28,R*.08,-R*.50,0,-R*.68);
      ex.strokeStyle='rgba(255,80,50,.3)';ex.lineWidth=.8;ex.stroke();
      ex.restore();
    }
    ex.rotate(-rot*1.6);
    for(let i=0;i<12;i++){
      const a=(i/12)*Math.PI*2;
      ex.beginPath();ex.arc(Math.cos(a)*R*.85,Math.sin(a)*R*.85,1.8,0,Math.PI*2);
      ex.fillStyle='rgba(210,40,0,.55)';ex.fill();
    }
    ex.restore();
    const pupilR=R*.2;
    const pupGl=ex.createRadialGradient(cx,cy,0,cx,cy,pupilR*1.8);
    pupGl.addColorStop(0,'rgba(200,0,0,.12)');pupGl.addColorStop(1,'transparent');
    ex.beginPath();ex.arc(cx,cy,pupilR*1.8,0,Math.PI*2);ex.fillStyle=pupGl;ex.fill();
    ex.beginPath();ex.arc(cx,cy,pupilR,0,Math.PI*2);
    ex.fillStyle='#020000';ex.fill();
    ex.beginPath();ex.arc(cx,cy,pupilR*.4,0,Math.PI*2);
    ex.fillStyle=`rgba(200,10,0,.55)`;ex.fill();
  }
  function drawRinne(t,cx,cy,R){
    const rot=t*.00016;
    const p=.5+.5*Math.sin(t*.00038);
    for(let i=4;i>0;i--){
      const gr=ex.createRadialGradient(cx,cy,R*.85,cx,cy,R*(1+i*.6));
      gr.addColorStop(0,`rgba(160,5,0,${.1/i})`);gr.addColorStop(1,'transparent');
      ex.beginPath();ex.arc(cx,cy,R*(1+i*.6),0,Math.PI*2);ex.fillStyle=gr;ex.fill();
    }
    ex.save();ex.translate(cx,cy);ex.rotate(rot*.4);
    for(let i=0;i<6;i++){
      const a=(i/6)*Math.PI*2;
      const len=R*1.9;
      const gl=ex.createLinearGradient(0,0,Math.cos(a)*len,Math.sin(a)*len);
      gl.addColorStop(0,`rgba(180,15,0,${.45+p*.12})`);
      gl.addColorStop(.4,'rgba(130,8,0,.25)');
      gl.addColorStop(1,'transparent');
      ex.beginPath();
      ex.moveTo(Math.cos(a+Math.PI)*len*.3,Math.sin(a+Math.PI)*len*.3);
      ex.lineTo(Math.cos(a)*len,Math.sin(a)*len);
      ex.strokeStyle=gl;ex.lineWidth=1.6;ex.stroke();
    }
    ex.restore();
    ex.save();ex.beginPath();ex.arc(cx,cy,R,0,Math.PI*2);ex.clip();
    const base=ex.createRadialGradient(cx,cy,0,cx,cy,R);
    base.addColorStop(0,'#500606');base.addColorStop(.35,'#360202');
    base.addColorStop(.7,'#220101');base.addColorStop(1,'#0e0000');
    ex.fillStyle=base;ex.fillRect(cx-R,cy-R,R*2,R*2);
    ex.restore();
    [1,.72,.5,.32].forEach((s,i)=>{
      ex.beginPath();ex.arc(cx,cy,R*s,0,Math.PI*2);
      ex.strokeStyle=`rgba(200,30,0,${.65-.1*i})`;ex.lineWidth=i===0?2:1;ex.stroke();
    });
    ex.save();ex.translate(cx,cy);
    for(let tri=0;tri<2;tri++){
      ex.save();ex.rotate(tri*(Math.PI/3)+rot);
      ex.beginPath();
      for(let i=0;i<3;i++){
        const a=(i/3)*Math.PI*2-Math.PI/2;
        const x=Math.cos(a)*R*.68,y=Math.sin(a)*R*.68;
        i===0?ex.moveTo(x,y):ex.lineTo(x,y);
      }
      ex.closePath();
      const stg=ex.createLinearGradient(-R*.6,-R*.6,R*.6,R*.6);
      stg.addColorStop(0,`rgba(220,35,0,${.72+p*.1})`);
      stg.addColorStop(.5,'rgba(180,20,0,.68)');
      stg.addColorStop(1,'rgba(120,10,0,.58)');
      ex.fillStyle=stg;ex.fill();
      ex.strokeStyle='rgba(240,60,0,.5)';ex.lineWidth=1.2;ex.stroke();
      ex.restore();
    }
    [[R*.45,3],[R*.25,3],[R*.12,3]].forEach(([rad,count],ring)=>{
      for(let i=0;i<count;i++){
        const a=(i/count)*Math.PI*2+rot*(ring%2===0?1:-1.3)+(ring*Math.PI/6);
        const tx=Math.cos(a)*rad,ty=Math.sin(a)*rad;
        ex.save();ex.translate(tx,ty);ex.rotate(a+Math.PI/2);
        ex.beginPath();ex.arc(0,0,R*.055,0,Math.PI*2);
        ex.fillStyle='rgba(0,0,0,.95)';ex.fill();
        ex.beginPath();
        ex.moveTo(0,0);
        ex.bezierCurveTo(R*.04,-R*.04,R*.04,-R*.12,0,-R*.15);
        ex.bezierCurveTo(-R*.04,-R*.12,-R*.04,-R*.04,0,0);
        ex.closePath();
        ex.fillStyle='rgba(0,0,0,.9)';ex.fill();
        ex.restore();
      }
    });
    ex.restore();
    ex.beginPath();ex.arc(cx,cy,R,0,Math.PI*2);
    ex.strokeStyle='rgba(200,25,0,.8)';ex.lineWidth=2.8;ex.stroke();
    const pg=ex.createRadialGradient(cx,cy,0,cx,cy,R*.18);
    pg.addColorStop(0,'rgba(210,15,0,.3)');pg.addColorStop(1,'transparent');
    ex.beginPath();ex.arc(cx,cy,R*.18,0,Math.PI*2);ex.fillStyle=pg;ex.fill();
    ex.beginPath();ex.arc(cx,cy,R*.12,0,Math.PI*2);ex.fillStyle='#030000';ex.fill();
    ex.beginPath();ex.arc(cx,cy,R*.055,0,Math.PI*2);
    ex.fillStyle=`rgba(220,10,0,${.5+p*.25})`;ex.fill();
  }
  function eyeLoop(t){
    if(!_authAnimActive){_eyeLoopId=null;return}
    _eyeLoopId=requestAnimationFrame(eyeLoop);
    if(!ex||!EW)return;
    ex.clearRect(0,0,EW,EH);
    const cx=EW*.5,cy=EH*.5,R=Math.min(EW,EH)*.28;
    if(authEyeMode==='login')drawMangekyo(t,cx,cy,R);
    else drawRinne(t,cx,cy,R);
  }
  if(EC)_eyeLoopId=requestAnimationFrame(eyeLoop);

  if(typeof gsap!=='undefined'){
    gsap.timeline({defaults:{ease:'power3.out'}})
      .to('#authBrand',{opacity:1,y:0,duration:.8},.18)
      .to('#authMtog',{opacity:1,y:0,duration:.65},.42)
      .to('#ltbadge,#rtbadge',{opacity:1,y:0,duration:.55},.60)
      .to('#ltit,#rtit',{opacity:1,y:0,duration:.7},.72)
      .to('#ldesc,#rdesc',{opacity:1,y:0,duration:.6},.88)
      .to('#lf1,#rf1,#rf1b',{opacity:1,y:0,duration:.5},.98)
      .to('#lf2,#rf2',{opacity:1,y:0,duration:.5},1.10)
      .to('#fgtw,#rf3',{opacity:1,duration:.4},1.20)
      .to('#lbtn,#rf4',{opacity:1,y:0,duration:.5},1.28)
      .to('#lodiv,#rf5',{opacity:1,duration:.4},1.40)
      .to('#lalt,#rbtn',{opacity:1,duration:.4},1.48)
      .to('#lfoot,#rfoot',{opacity:1,duration:.4},1.56)
      .to('#authEpTitle',{opacity:1,duration:.9,delay:1.2},0);
  }
}

function switchAuthMode(m){
  const isLogin=(m==='login');
  authEyeMode=isLogin?'login':'register';
  const verificationPanel=document.getElementById('verificationPanel');
  if(verificationPanel)verificationPanel.style.display='none';
  const authModeToggle=document.getElementById('authMtog');
  if(authModeToggle)authModeToggle.style.display='';
  document.getElementById('btnLogin').classList.toggle('active',isLogin);
  document.getElementById('btnReg').classList.toggle('active',!isLogin);
  if(isLogin){
    document.getElementById('authEpH').textContent='Eternal Mangekyō';
    document.getElementById('authEpP').innerHTML='Awaken your dōjutsu<br>to enter the Archives';
    document.getElementById('authEpQuote').textContent='"Those who cannot acknowledge themselves will eventually fail."';
    document.getElementById('authRegForm').style.display='none';
    document.getElementById('authLoginForm').style.display='flex';
  } else {
    document.getElementById('authEpH').textContent='Rinne Sharingan';
    document.getElementById('authEpP').innerHTML='Seal your soul into<br>the infinite dream';
    document.getElementById('authEpQuote').textContent='"Those who forgive themselves, and are able to accept their true nature... They are the strong ones."';
    document.getElementById('authLoginForm').style.display='none';
    document.getElementById('authRegForm').style.display='flex';
  }
  if(typeof gsap!=='undefined'){
    const fields=isLogin?['#ltbadge','#ltit','#ldesc','#lf1','#lf2','#fgtw','#lbtn','#lodiv','#lalt','#lfoot']:['#rtbadge','#rtit','#rdesc','#rrow','#rf2','#rf3','#rf4','#rf5','#rbtn','#rfoot'];
    gsap.fromTo(fields,{opacity:0,y:12},{opacity:1,y:0,duration:.45,stagger:.05,ease:'power3.out'});
  }
}

function toggleAuthPass(id,btn){
  const inp=document.getElementById(id);
  const h=inp.type==='password';
  inp.type=h?'text':'password';
  btn.style.color=h?'rgba(200,30,30,.7)':'rgba(255,255,255,.2)';
}

function checkAuthPassStrength(v){
  let s=0;
  if(v.length>=6)s++;if(v.length>=12)s++;
  if(/[A-Z]/.test(v)&&/[0-9]/.test(v))s++;
  if(/[^A-Za-z0-9]/.test(v))s++;
  document.querySelectorAll('.auth-ss').forEach((sg,i)=>{sg.className='auth-ss';if(i<s)sg.classList.add('s'+s)});
  const hints=['','Too short — a weak seal','Mediocre — add numbers','Strong enough','Unbreakable seal'];
  document.getElementById('authSthnt').textContent=hints[s]||'A strong seal guards the village secrets.';
}

function checkRegPassMatch(){
  const p1=document.getElementById('regPass').value;
  const p2=document.getElementById('regPass2').value;
  const el=document.getElementById('authPassMatch');
  if(!p2){el.textContent='';el.style.color='';return}
  if(p1===p2){el.textContent='✓ Passwords match';el.style.color='#2ecc71'}
  else{el.textContent='✗ Passwords do not match';el.style.color='var(--red3)'}
}

// ==================== PROFILE ====================
function updateProfileData(){
  if(!currentUser)return;
  document.getElementById('profileName').textContent=currentUser.name||currentUser.username||'Shinobi';
  const username=currentUser.username||'shinobi';
  const verification=currentUser.emailVerified?'Verified':'Not verified';
  const accountUsername=document.getElementById('profileAccountUsername');
  const accountEmail=document.getElementById('profileAccountEmail');
  const accountVerification=document.getElementById('profileAccountVerification');
  const profileUsername=document.getElementById('profileUsernameText');
  const profileVerification=document.getElementById('profileVerificationText');
  if(accountUsername)accountUsername.textContent='@'+username;
  if(accountEmail)accountEmail.textContent=currentUser.email||'No email set';
  if(accountVerification)accountVerification.textContent=verification;
  if(profileUsername)profileUsername.textContent='@'+username;
  if(profileVerification)profileVerification.textContent='Email '+verification.toLowerCase();
  const clan=currentUser.clan&&currentUser.clan!=='Independent'?'— '+currentUser.clan+' Clan —':'— Independent —';
  document.getElementById('profileClan').textContent=clan;
  document.getElementById('profileEmailText').textContent=currentUser.email||'No email set';
  document.getElementById('profileJoinedText').textContent='Joined: '+new Date(currentUser.createdAt||Date.now()).toLocaleDateString('en',{year:'numeric',month:'long',day:'numeric'});
  const initial=(currentUser.username||'S')[0].toUpperCase();
  const avatarColors=['#C0392B','#8B0000','#FF4500','#E74C3C','#D35400'];
  const color=avatarColors[initial.charCodeAt(0)%avatarColors.length];
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="av" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${color}" stop-opacity="0.8"/><stop offset="100%" stop-color="#0A0A0E"/></radialGradient></defs><circle cx="100" cy="100" r="95" fill="url(#av)"/><circle cx="100" cy="100" r="90" fill="none" stroke="${color}" stroke-width="2" opacity="0.5"/><text x="100" y="125" text-anchor="middle" font-size="80" fill="#fff" font-family="Cinzel,serif" font-weight="900" opacity="0.9">${initial}</text></svg>`;
  document.getElementById('profileAvatar').src='data:image/svg+xml;base64,'+btoa(svg);
  const stats=window.getProfileStatistics(notes);
  const {noteCount,rank,rankIcon,rankOrder,rankIndex:currentRankIdx,nextRank,rankProgress:progressToNext,pinnedCount,totalWords,tags:allTags,lastNote,notesThisWeek:thisWeek}=stats;
  document.getElementById('profileRank').innerHTML=rankIcon+' '+rank+' Rank';
  document.getElementById('statRank').textContent=rank;
  document.getElementById('statRankChange').textContent=nextRank?progressToNext+'% to '+nextRank:'Maximum rank';
  document.getElementById('statNotes').textContent=noteCount;
  document.getElementById('statPinned').textContent=pinnedCount;
  document.getElementById('statPinnedChange').textContent=pinnedCount>0?pinnedCount+' priority scrolls':'No pinned scrolls';
  document.getElementById('statWords').textContent=totalWords.toLocaleString();
  document.getElementById('statTags').textContent=allTags.size;
  if(lastNote){const diff=Date.now()-lastNote.updatedAt;let ts;if(diff<60000)ts='Just now';else if(diff<3600000)ts=Math.floor(diff/60000)+'m ago';else if(diff<86400000)ts=Math.floor(diff/3600000)+'h ago';else ts=Math.floor(diff/86400000)+'d ago';document.getElementById('statLastActive').textContent=ts}
  else document.getElementById('statLastActive').textContent='—';
  document.getElementById('statNotesChange').textContent=thisWeek>0?'+'+thisWeek+' this week':'No new this week';

  /* === Dossier ID === */
  const dossierId='KN-'+String(currentUser.username.length).padStart(2,'0')+String((currentUser.createdAt||Date.now())%10000).padStart(4,'0');
  const elDossier=document.getElementById('dossierId');
  if(elDossier)elDossier.textContent=dossierId;

  /* === Shinobi Path === */
  document.querySelectorAll('.path-node').forEach((node,idx)=>{
    node.classList.remove('completed','active');
    if(idx<currentRankIdx)node.classList.add('completed');
    else if(idx===currentRankIdx)node.classList.add('active');
  });

  /* === Chakra Meters === */
  const maxNotes=50,maxPinned=10,maxWords=5000,maxTags=15;
  const mNotes=document.getElementById('meterNotes');
  const mPinned=document.getElementById('meterPinned');
  const mWords=document.getElementById('meterWords');
  const mTags=document.getElementById('meterTags');
  const mActive=document.getElementById('meterActive');
  const mRank=document.getElementById('meterRank');
  if(mNotes)mNotes.style.width=Math.min((noteCount/maxNotes)*100,100)+'%';
  if(mPinned)mPinned.style.width=Math.min((pinnedCount/maxPinned)*100,100)+'%';
  if(mWords)mWords.style.width=Math.min((totalWords/maxWords)*100,100)+'%';
  if(mTags)mTags.style.width=Math.min((allTags.size/maxTags)*100,100)+'%';
  if(mActive)mActive.style.width=lastNote?Math.min(100,Math.max(10,100-(Date.now()-lastNote.updatedAt)/86400000*100))+'%':'0%';
  if(mRank)mRank.style.width=nextRank?progressToNext+'%':'100%';

  /* === Mission Reports === */
  const activityList=document.getElementById('profileActivityList');
  if(notes.length===0){
    activityList.innerHTML=`<div class="mission-item"><div class="mission-rank d">D</div><div class="mission-body"><div class="mission-title">No recent missions</div><div class="mission-time">Begin your first assignment</div></div></div>`;
  } else {
    const sorted=[...notes].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,8);
    activityList.innerHTML=sorted.map((n,i)=>{
      const diff=Date.now()-n.updatedAt;let ts;if(diff<60000)ts='Just now';else if(diff<3600000)ts=Math.floor(diff/60000)+'m ago';else if(diff<86400000)ts=Math.floor(diff/3600000)+'h ago';else ts=Math.floor(diff/86400000)+'d ago';
      const action=n.updatedAt===n.createdAt?'create':'edit';
      let mr='d';
      if(i===0)mr='s';else if(i<=2)mr='a';else if(i<=4)mr='b';else if(i<=6)mr='c';
      return`<div class="mission-item"><div class="mission-rank ${mr}">${mr.toUpperCase()}</div><div class="mission-body"><div class="mission-title">${action==='create'?'Created':'Edited'}: ${escapeHtml(n.title)}</div><div class="mission-time">${ts}</div></div></div>`;
    }).join('');
  }

  /* === Jutsu Specialties === */
  const tagList=document.getElementById('profileTagList');
  if(allTags.size===0){
    tagList.innerHTML=`<div class="specialty-chip"><span class="seal-dot"></span><span>No specialties</span></div>`;
  } else {
    const tagCounts={};notes.forEach(n=>(n.tags||[]).forEach(t=>{tagCounts[t]=(tagCounts[t]||0)+1}));
    const sortedTags=Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]).slice(0,12);
    tagList.innerHTML=sortedTags.map(([tag,count])=>`<div class="specialty-chip"><span class="seal-dot"></span><span>${escapeHtml(tag)}</span><span class="chip-count">${Math.round(count/notes.length*100)}%</span></div>`).join('');
  }
}

// Keyboard submit remains routed through the Firebase auth controller.
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&document.getElementById('view-auth').classList.contains('active')){
    const lf=document.getElementById('authLoginForm');
    const rf=document.getElementById('authRegForm');
    if(lf&&lf.style.display!=='none')doLogin();
    else if(rf&&rf.style.display!=='none')doRegister();
  }
});

// After session restore, init hero
window.addEventListener('load',()=>{
  initHeroCanvas();
  initScrollObserver();
  
});

// ===== BUTTON RIPPLE EFFECT =====
document.addEventListener('click',function(e){
  const btn=e.target.closest('.nav-btn,.toolbar-btn,.new-note-btn,.modal-btn,.btn');
  if(!btn)return;
  const ripple=document.createElement('span');
  ripple.className='ripple';
  const rect=btn.getBoundingClientRect();
  const size=Math.max(rect.width,rect.height);
  ripple.style.width=ripple.style.height=size+'px';
  ripple.style.left=(e.clientX-rect.left-size/2)+'px';
  ripple.style.top=(e.clientY-rect.top-size/2)+'px';
  btn.appendChild(ripple);
  setTimeout(()=>ripple.remove(),600);
});

// ==================== MOBILE MENU ====================
function toggleMobileMenu(){
  const menu=document.getElementById('mobileMenu');
  const btn=document.getElementById('hamburgerBtn');
  if(!menu)return;
  menu.classList.toggle('open');
  if(btn)btn.classList.toggle('active');
  document.body.style.overflow=menu.classList.contains('open')?'hidden':'';
}

// Close mobile menu on escape key
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    const menu=document.getElementById('mobileMenu');
    if(menu&&menu.classList.contains('open')) toggleMobileMenu();
  }
});


// ==================== STORY MODAL ====================
function initStoryCards(){
  // Clan cards
  document.querySelectorAll('#clans .clan-card[data-story]').forEach(card => {
    card.addEventListener('click', () => openStoryModal(card));
  });
  // Legend cards
  document.querySelectorAll('#legends .legend-card[data-story]').forEach(card => {
    card.addEventListener('click', () => openStoryModal(card));
  });
  // History timeline items - click on the card-view-overlay button
  document.querySelectorAll('#history .timeline-item[data-story] .card-view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('.timeline-item[data-story]');
      if(item) openStoryModal(item);
    });
  });
}

function openStoryModal(card){
  const story = card.dataset.story;
  if(!story) return;
  const titleEl = card.querySelector('.clan-name, .legend-name, .timeline-name');
  const subtitleEl = card.querySelector('.clan-name-jp, .legend-title, .timeline-era');
  const title = titleEl ? titleEl.textContent : 'Unknown';
  const subtitle = subtitleEl ? subtitleEl.textContent : '';

  document.getElementById('storyModalTitle').textContent = title;
  document.getElementById('storyModalSubtitle').textContent = subtitle;

  /* Extract image from card */
  const imgEl = card.querySelector('.timeline-img-wrap img, .legend-img-wrap img, .clan-card > svg');
  const imgWrap = document.getElementById('storyModalImgWrap');
  const modalImg = document.getElementById('storyModalImg');
  if(imgEl && imgEl.tagName === 'IMG'){
    modalImg.src = imgEl.src;
    modalImg.alt = imgEl.alt || title;
    imgWrap.style.display = '';
  } else {
    imgWrap.style.display = 'none';
    modalImg.src = '';
  }

  // Animate text character by character
  const textEl = document.getElementById('storyModalText');
  textEl.innerHTML = '';

  const chars = story.split('');
  chars.forEach((char, i) => {
    const span = document.createElement('span');
    span.textContent = char;
    span.style.animationDelay = (i * 0.015) + 's';
    textEl.appendChild(span);
  });

  const modal = document.getElementById('storyModal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeStoryModal(e){
  if (e && e.target !== e.currentTarget && e.target.closest('.story-modal-content')) return;
  const modal = document.getElementById('storyModal');
  if(!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => {
    const textEl = document.getElementById('storyModalText');
    const imgEl = document.getElementById('storyModalImg');
    const imgWrap = document.getElementById('storyModalImgWrap');
    if(textEl) textEl.innerHTML = '';
    if(imgEl) imgEl.src = '';
    if(imgWrap) imgWrap.style.display = 'none';
  }, 500);
}

// Keyboard close
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('storyModal');
    if (modal && modal.classList.contains('open')) closeStoryModal();
  }
});


// ==================== INTRO SEQUENCE ====================
(function(){
  // Intro plays on every page load.

  document.body.classList.add('intro-active');

  const scrollPaper = document.getElementById('introScrollPaper');
  const scrollContent = document.querySelector('.intro-scroll-content');
  const fireParticles = document.getElementById('introFireParticles');
  const introOverlay = document.getElementById('introOverlay');
  const introContainer = document.getElementById('introScrollContainer');
  const titleEl = document.getElementById('introTitle');
  const subtitleEl = document.getElementById('introSubtitle');

  const titleText = 'KONOHA NOTES';
  const subtitleText = 'Seal Your Secrets';

  // Burn origin - bottom-right corner of paper
  const BURN_ORIGIN_X = 0.85;
  const BURN_ORIGIN_Y = 0.90;
  const BURN_DURATION = 3500;
  const MAX_EMBERS = 80; // Reduced from 220
  const CHARRED_STEPS = 60; // Reduced from 140

  // Typewriter effect
  function typeText(element, text, delay, speed){
    return new Promise(resolve => {
      setTimeout(() => {
        let i = 0;
        const interval = setInterval(() => {
          element.textContent += text[i];
          i++;
          if(i >= text.length){
            clearInterval(interval);
            resolve();
          }
        }, speed);
      }, delay);
    });
  }

  // Create falling fire particles in background
  function createFireParticles(){
    if(!fireParticles) return;
    fireParticles.classList.add('active');
    const interval = setInterval(() => {
      if(!document.getElementById('introOverlay')){
        clearInterval(interval);
        return;
      }
      const ember = document.createElement('div');
      ember.className = 'intro-ember';
      ember.style.left = Math.random() * 100 + '%';
      ember.style.animationDuration = (2 + Math.random() * 3) + 's';
      ember.style.animationDelay = Math.random() * 1 + 's';
      ember.style.width = (2 + Math.random() * 3) + 'px';
      ember.style.height = ember.style.width;
      fireParticles.appendChild(ember);
      setTimeout(() => ember.remove(), 5000);
    }, 100);
    setTimeout(() => clearInterval(interval), 4000);
  }

  // ============ OPTIMIZED BURN EFFECT ============

  function startBurnEffect(){
    if(!scrollPaper) return;

    const paperRect = scrollPaper.getBoundingClientRect();
    const dpr = 1; // Force 1x for performance - still looks great

    // Create canvas for charred edge
    const canvas = document.createElement('canvas');
    canvas.className = 'intro-burn-canvas';
    canvas.width = Math.floor(paperRect.width * dpr);
    canvas.height = Math.floor(paperRect.height * dpr);
    canvas.style.width = paperRect.width + 'px';
    canvas.style.height = paperRect.height + 'px';
    scrollPaper.appendChild(canvas);

    const ctx = canvas.getContext('2d', { alpha: true });

    // Create smoke element
    const smoke = document.createElement('div');
    smoke.className = 'intro-burn-smoke';
    scrollPaper.appendChild(smoke);

    // Create ignition flash
    const flash = document.createElement('div');
    flash.className = 'intro-ignite-flash';
    scrollPaper.appendChild(flash);

    // Activate elements
    requestAnimationFrame(() => {
      canvas.classList.add('active');
      flash.classList.add('active');
    });

    // Pre-calculate constants
    const originX = paperRect.width * BURN_ORIGIN_X;
    const originY = paperRect.height * BURN_ORIGIN_Y;
    const maxRadius = Math.sqrt(
      Math.pow(Math.max(originX, paperRect.width - originX), 2) +
      Math.pow(Math.max(originY, paperRect.height - originY), 2)
    );

    // Pre-generate angle table for charred ring
    const angleTable = new Float32Array(CHARRED_STEPS + 1);
    for(let i = 0; i <= CHARRED_STEPS; i++){
      angleTable[i] = (i / CHARRED_STEPS) * Math.PI * 2;
    }

    // Burn state
    let startTime = null;
    let embers = [];
    let zoomTriggered = false;
    let animId = null;
    let lastSpawnTime = 0;

    // Ember class - optimized
    class Ember {
      constructor(angle, dist){
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        this.x = originX + cos * dist;
        this.y = originY + sin * dist;
        this.vx = (Math.random() - 0.5) * 1.2 - 0.3;
        this.vy = -Math.random() * 1.2 - 0.3;
        this.life = 1;
        this.decay = 0.008 + Math.random() * 0.012;
        this.size = 1.5 + Math.random() * 2.5;
        this.hue = 20 + Math.random() * 20;
      }

      update(){
        this.x += this.vx;
        this.y += this.vy;
        this.vy -= 0.015;
        this.life -= this.decay;
        this.size *= 0.992;
      }
    }

    // Batch spawn embers
    function spawnEmbers(currentRadius, timestamp){
      if(timestamp - lastSpawnTime < 16) return; // Throttle to ~60fps
      lastSpawnTime = timestamp;

      const spawnCount = Math.min(3, MAX_EMBERS - embers.length);
      for(let i = 0; i < spawnCount; i++){
        const angle = Math.random() * Math.PI * 2;
        const dist = currentRadius * (0.7 + Math.random() * 0.3);
        embers.push(new Ember(angle, dist));
      }
    }

    // Optimized draw function
    function drawFrame(currentRadius, time){
      ctx.clearRect(0, 0, paperRect.width, paperRect.height);

      // Batch draw charred ring
      ctx.beginPath();

      // Outer ring
      for(let i = 0; i <= CHARRED_STEPS; i++){
        const angle = angleTable[i];
        const noise = Math.sin(angle * 6 + time * 0.002) * 4 +
                      Math.sin(angle * 12 + time * 0.004) * 2;
        const r = currentRadius + 6 + noise;
        const x = originX + Math.cos(angle) * r;
        const y = originY + Math.sin(angle) * r;
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Inner ring (reverse for hole)
      const innerR = Math.max(0, currentRadius - 3);
      if(innerR > 0){
        for(let i = CHARRED_STEPS; i >= 0; i--){
          const angle = angleTable[i];
          const noise = Math.sin(angle * 6 + time * 0.002) * 2;
          const r = innerR + noise;
          const x = originX + Math.cos(angle) * r;
          const y = originY + Math.sin(angle) * r;
          ctx.lineTo(x, y);
        }
        ctx.closePath();
      }

      // Fill charred area
      ctx.fillStyle = 'rgba(35, 15, 6, 0.6)';
      ctx.fill();

      // Stroke fire edge - single efficient stroke
      ctx.strokeStyle = 'rgba(255, 130, 40, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw embers in batch
      if(embers.length > 0){
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        for(let i = 0; i < embers.length; i++){
          const e = embers[i];
          if(e.life <= 0) continue;

          ctx.globalAlpha = e.life * 0.7;
          ctx.fillStyle = `hsl(${e.hue}, 100%, 60%)`;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    function updateCSSMask(currentRadius){
      const inner = Math.max(0, currentRadius - 5);
      const maskValue = `radial-gradient(circle ${currentRadius}px at ${originX}px ${originY}px, transparent ${inner}px, rgba(0,0,0,0.5) ${inner + 4}px, #000 ${currentRadius}px)`;

      scrollPaper.style.webkitMaskImage = maskValue;
      scrollPaper.style.maskImage = maskValue;
    }

    function triggerZoom(){
      if(zoomTriggered) return;
      zoomTriggered = true;

      const viewportOX = ((paperRect.left + originX) / window.innerWidth) * 100;
      const viewportOY = ((paperRect.top + originY) / window.innerHeight) * 100;

      if(introContainer){
        introContainer.style.transformOrigin = `${viewportOX}% ${viewportOY}%`;
      }
      if(introOverlay){
        introOverlay.style.transformOrigin = `${viewportOX}% ${viewportOY}%`;
      }

      requestAnimationFrame(() => {
        if(introContainer) introContainer.classList.add('zoom-through');
        if(introOverlay) introOverlay.classList.add('zoom-through');
      });

      smoke.classList.add('active');

      if(scrollContent){
        scrollContent.style.transition = 'opacity 0.5s ease';
        scrollContent.style.opacity = '0';
      }

      document.body.classList.add('intro-done');

      setTimeout(() => {
        if(introOverlay) introOverlay.classList.add('removed');
        document.body.classList.remove('intro-active', 'intro-done');
        if(animId) cancelAnimationFrame(animId);

        if(canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        if(smoke && smoke.parentNode) smoke.parentNode.removeChild(smoke);
        if(flash && flash.parentNode) flash.parentNode.removeChild(flash);

        scrollPaper.style.webkitMaskImage = '';
        scrollPaper.style.maskImage = '';
        scrollPaper.classList.remove('burning');
      }, 2000);
    }

    function burnLoop(timestamp){
      if(!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const burnProgress = Math.min(elapsed / BURN_DURATION, 1);

      const easedProgress = 1 - Math.pow(1 - burnProgress, 3);
      const currentRadius = maxRadius * easedProgress;

      updateCSSMask(currentRadius);

      if(embers.length < MAX_EMBERS && burnProgress < 0.9){
        spawnEmbers(currentRadius, timestamp);
      }

      // Update embers
      let activeEmbers = 0;
      for(let i = 0; i < embers.length; i++){
        const e = embers[i];
        e.update();
        if(e.life > 0) activeEmbers++;
      }

      drawFrame(currentRadius, timestamp);

      if(burnProgress >= 0.62 && !zoomTriggered){
        triggerZoom();
      }

      if(burnProgress < 1 || activeEmbers > 0){
        animId = requestAnimationFrame(burnLoop);
      } else if(!zoomTriggered) {
        triggerZoom();
      }
    }

    scrollPaper.classList.add('burning');
    animId = requestAnimationFrame(burnLoop);
  }

  // Sequence
  async function runIntro(){
    // Reset state
    if(titleEl) titleEl.textContent = '';
    if(subtitleEl) subtitleEl.textContent = '';
    if(scrollContent){
      scrollContent.style.opacity = '';
      scrollContent.classList.remove('visible');
    }
    if(scrollPaper){
      scrollPaper.classList.remove('unrolled', 'burning');
      scrollPaper.style.webkitMaskImage = '';
      scrollPaper.style.maskImage = '';
    }
    if(introContainer){
      introContainer.classList.remove('zoom-through');
      introContainer.style.transformOrigin = '';
    }
    if(introOverlay){
      introOverlay.classList.remove('zoom-through', 'done', 'removed');
      introOverlay.style.transformOrigin = '';
      introOverlay.style.opacity = '';
      introOverlay.style.animation = '';
    }
    document.body.classList.remove('intro-done');

    // 1. Scroll appears (0.5s)
    await new Promise(r => setTimeout(r, 500));

    // 2. Scroll unrolls (1.0s)
    if(scrollPaper) scrollPaper.classList.add('unrolled');
    await new Promise(r => setTimeout(r, 2500));

    // 3. Fire particles start falling (3.5s)
    createFireParticles();

    // 4. Text writes itself (4.0s)
    if(scrollContent) scrollContent.classList.add('visible');
    await typeText(titleEl, titleText, 0, 120);
    await typeText(subtitleEl, subtitleText, 300, 80);

    // 5. Text stays visible for 2 seconds (6.5s)
    await new Promise(r => setTimeout(r, 2000));

    // 6. BURN BEGINS at bottom-right corner (8.5s)
    if(scrollContent){
      scrollContent.style.transition = 'opacity 2s ease';
      scrollContent.style.opacity = '0.4';
    }

    startBurnEffect();
  }

  runIntro();
})();



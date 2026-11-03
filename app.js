/* SkyNetworks marketplace MVP: Supabase auth, tasks, offers, public/private chat and in-app alerts. */
const { createClient } = supabase;
const db = createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);
let user = null, centre = null, radiusCircle = null, offerCounts = {}, selectedId = null, markerById = {}, tasks = [], activeTask = null, mapMain = null, mapHero = null, markers = [], notificationPoll = null;
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function explainAuthError(error){
 const message=String(error?.message||'Unknown authentication error');
 const code=String(error?.code||'');
 if(/Database error saving new user/i.test(message)||code==='unexpected_failure'){
  return 'Supabase could not save this new user. This is a database-side signup error (often a failing auth.users trigger or profile-table constraint), not a password problem. Open Supabase Dashboard → Authentication → Users and SQL Editor, then run the included AUTH-SIGNUP-DIAGNOSTICS.sql. Repair the reported trigger/schema issue and retry. No account was created unless it appears in Authentication → Users.';
 }
 if(/email not confirmed/i.test(message)) return 'Email not confirmed. Check your inbox and spam folder, confirm your email, then log in.';
 if(/invalid login credentials/i.test(message)) return 'Email or password is incorrect, or the account was not created. Check Authentication → Users and try account recovery if needed.';
 return message;
}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3800);}
function modal(html){$('modalContent').innerHTML=html;$('modalBackdrop').classList.add('show');}
function closeModal(){$('modalBackdrop').classList.remove('show');$('modalContent').innerHTML='';activeTask=null;}
function money(n){return n==null?'Budget not specified':'KSh '+Number(n).toLocaleString('en-KE');}
function isContactLeak(text){
 const s=String(text||'').toLowerCase();
 const tests=[/[a-z0-9._%+-]+\s*@\s*[a-z0-9.-]+\s*\.\s*[a-z]{2,}/i,/(https?:\/\/|www\.)\S+/i,/(\+?\d[\d\s().-]{7,}\d)/,/(whatsapp|telegram|t\.me|instagram|facebook|facebook\.com|tiktok|snapchat|call\s+me|text\s+me|dm\s+me|my\s+number|reach\s+me|contact\s+me)/i,/(\b[a-z0-9-]+\.(com|net|org|co\.ke|ke|io)\b)/i];
 return tests.some(r=>r.test(s));
}
function safeText(text){if(isContactLeak(text)){toast('For safety, public messages cannot contain phone numbers, email addresses, personal links or requests to contact you elsewhere.');return false;}return true;}
function initMaps(){
 if(!window.L)return;
 const nairobi=[-1.286389,36.817223];
 mapHero=L.map('heroMap',{scrollWheelZoom:false}).setView(nairobi,11);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(mapHero);
 mapMain=L.map('browseMap',{scrollWheelZoom:true}).setView(nairobi,10);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(mapMain);
 setTimeout(()=>{mapHero.invalidateSize();mapMain.invalidateSize();},350);
 if(window.ResizeObserver){new ResizeObserver(()=>{mapMain.invalidateSize();mapHero.invalidateSize();}).observe($('browseMap'));}
 mapMain.on('click',()=>{const p=$('mapPreview');if(p)p.classList.remove('show');});
}
window.addEventListener('resize',()=>{if(mapMain)setTimeout(()=>mapMain.invalidateSize(),120);if(mapHero)setTimeout(()=>mapHero.invalidateSize(),120);});
const BASE_COLS='id,owner_id,title,description,category,budget,location,latitude,longitude,created_at,status';
const EXTRA_COLS=',is_remote,due_date,time_of_day';
let hasExtra=true, profileNames={}, F={type:'all',km:0,text:'',useMe:false,geoText:''};
const KMS=[0,5,10,25,50,100,250];
const NAIROBI=[-1.286389,36.817223];
const approx=v=>Math.round(Number(v)*100)/100;
function shortPrice(n){if(n==null)return 'KSh';n=Number(n);if(!Number.isFinite(n))return 'KSh';return n>=1000000?'KSh '+(n/1000000).toFixed(1).replace(/\.0$/,'')+'M':n>=10000?'KSh '+Math.round(n/1000)+'k':'KSh '+n.toLocaleString('en-KE');}
function hasCoords(t){return t.latitude!==null&&t.longitude!==null&&t.latitude!==undefined&&Number.isFinite(Number(t.latitude))&&Number.isFinite(Number(t.longitude));}
function distKm(t){const c=centre||NAIROBI,R=6371,r=x=>x*Math.PI/180;const dLa=r(Number(t.latitude)-c[0]),dLo=r(Number(t.longitude)-c[1]);const x=Math.sin(dLa/2)**2+Math.cos(r(c[0]))*Math.cos(r(Number(t.latitude)))*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
async function geocode(q){try{const c=new AbortController(),to=setTimeout(()=>c.abort(),6000);const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(q),{signal:c.signal,headers:{Accept:'application/json'}});clearTimeout(to);const j=await r.json();if(j&&j[0])return [approx(j[0].lat),approx(j[0].lon)];}catch(e){console.warn('Geocoding unavailable',e);}return null;}
function pinIcon(t,active){return L.divIcon({className:'price-pin-wrap',html:`<div class="price-pin${active?' active':''}">${escapeHtml(shortPrice(t.budget))}</div>`,iconSize:[0,0]});}
function drawRadius(){if(!mapMain)return;if(radiusCircle){mapMain.removeLayer(radiusCircle);radiusCircle=null;}if(!F.km||!centre)return;radiusCircle=L.circle(centre,{radius:F.km*1000,color:'#1f6fe5',weight:2,fillOpacity:.06}).addTo(mapMain);mapMain.fitBounds(radiusCircle.getBounds(),{padding:[20,20]});}
function renderMap(rows){if(!mapMain)return;rows=rows||filteredTasks();markers.forEach(m=>mapMain.removeLayer(m));markers=[];markerById={};const pts=[];rows.forEach(t=>{if(hasCoords(t)){const la=Number(t.latitude),lo=Number(t.longitude);const m=L.marker([la,lo],{icon:pinIcon(t,String(t.id)===String(selectedId))}).addTo(mapMain);m.on('click',()=>{selectTask(t.id,true);showPreview(t);});markers.push(m);markerById[t.id]=m;pts.push([la,lo]);}});if(pts.length&&!(F.km&&centre))mapMain.fitBounds(pts,{padding:[50,50],maxZoom:13});}
function showPreview(t){const p=$('mapPreview');if(!p)return;p.innerHTML=`<div><b>${escapeHtml(t.title)}</b><span>${escapeHtml(t.is_remote?'Remote':(t.location||'Area not specified'))} · ${escapeHtml(shortPrice(t.budget))}</span></div><button type="button" id="previewOpen">View</button>`;p.classList.add('show');$('previewOpen').onclick=()=>openTask(t.id);}
function selectTask(id,scroll){selectedId=id;document.querySelectorAll('.task-card').forEach(c=>c.classList.toggle('selected',c.dataset.id===String(id)));tasks.forEach(t=>{const m=markerById[t.id];if(m){m.setIcon(pinIcon(t,String(t.id)===String(id)));m.setZIndexOffset(String(t.id)===String(id)?1000:0);}});if(scroll){const c=document.querySelector(`.task-card[data-id="${id}"]`);if(c)c.scrollIntoView({behavior:'smooth',block:'nearest'});}}
async function loadOfferCounts(){offerCounts={};if(!tasks.length)return;const {data}=await db.from('offers').select('task_id').in('task_id',tasks.map(t=>t.id));(data||[]).forEach(o=>{offerCounts[o.task_id]=(offerCounts[o.task_id]||0)+1;});}
async function loadProfileNames(){profileNames={};const ids=[...new Set(tasks.map(t=>t.owner_id).filter(Boolean))];if(!ids.length)return;try{const {data,error}=await db.from('profiles').select('*').in('id',ids);if(error||!data)return;data.forEach(p=>{const n=p.display_name||p.full_name||p.name||p.username;if(n)profileNames[p.id]=String(n);});}catch(e){}}
async function loadTasks(){let res=await db.from('tasks').select(BASE_COLS+(hasExtra?EXTRA_COLS:'')).eq('status','open').order('created_at',{ascending:false}).limit(120);if(res.error&&hasExtra&&/is_remote|due_date|time_of_day|column|schema cache/i.test(res.error.message)){hasExtra=false;res=await db.from('tasks').select(BASE_COLS).eq('status','open').order('created_at',{ascending:false}).limit(120);}if(res.error){console.error(res.error);toast('Could not load tasks: '+res.error.message);return;}tasks=res.data||[];await Promise.all([loadOfferCounts(),loadProfileNames()]);renderTasks();}
function locOK(t){const txt=F.text.toLowerCase();const textMatch=!txt||String(t.location||'').toLowerCase().includes(txt);const remote=!!t.is_remote;if(F.type==='remote')return remote;if(F.type==='inperson'&&remote)return false;if(remote)return true;if(F.km&&centre){if(hasCoords(t))return distKm(t)<=F.km;return !!txt&&textMatch;}return textMatch;}
function filteredTasks(){const q=$('searchInput').value.toLowerCase().trim(),cat=$('categoryFilter').value,pr=$('priceFilter').value,sort=$('sortFilter').value;let lo=0,hi=Infinity;if(pr){const [a1,b1]=pr.split('-');lo=Number(a1);hi=b1===''?Infinity:Number(b1);}const rows=tasks.filter(t=>(!cat||t.category===cat)&&(!q||[t.title,t.description,t.category,t.location].join(' ').toLowerCase().includes(q))&&(!pr||(Number(t.budget)>=lo&&Number(t.budget)<=hi))&&locOK(t));if(sort==='high')rows.sort((x,y)=>Number(y.budget||0)-Number(x.budget||0));else if(sort==='low')rows.sort((x,y)=>Number(x.budget||0)-Number(y.budget||0));else if(sort==='near')rows.sort((x,y)=>(hasCoords(x)?distKm(x):1e9)-(hasCoords(y)?distKm(y):1e9));return rows;}
function timeAgo(d){if(!d)return 'Recently';const s=(Date.now()-new Date(d))/1000;if(s<60)return 'Just now';if(s<3600)return Math.floor(s/60)+' min ago';if(s<86400)return Math.floor(s/3600)+' h ago';if(s<604800)return Math.floor(s/86400)+' d ago';return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short'});}
function dueText(t){if(!t.due_date)return 'Flexible';const d=new Date(String(t.due_date).slice(0,10)+'T00:00:00');return Number.isNaN(d.getTime())?'Flexible':'Before '+d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});}
function initials(name){return String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');}
function avatarHtml(t){const n=profileNames[t.owner_id];if(!n)return '<span class="tc-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span>';let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))%360;return `<span class="tc-avatar initials" style="background:hsl(${h} 45% 42%)" aria-hidden="true">${escapeHtml(initials(n))}</span>`;}
function renderTasks(){const rows=filteredTasks();$('resultCount').textContent=rows.length+' task'+(rows.length===1?'':'s')+' available';$('taskGrid').innerHTML=rows.map(t=>{const n=offerCounts[t.id]||0,remote=!!t.is_remote;const place=remote?'Remote':escapeHtml(t.location||'Area not specified')+(centre&&hasCoords(t)?` · <b class="tc-km">${distKm(t)<10?distKm(t).toFixed(1):Math.round(distKm(t))} km</b>`:'');return `<article class="task-card${String(t.id)===String(selectedId)?' selected':''}" data-id="${t.id}" tabindex="0"><div class="tc-head"><h4>${escapeHtml(t.title)}</h4><span class="tc-price">${t.budget==null?'—':escapeHtml(shortPrice(t.budget))}</span></div><div class="tc-body"><ul class="tc-meta"><li><i>${remote?'▭':'⌖'}</i>${place}</li><li><i>▦</i>${escapeHtml(dueText(t))}</li><li><i>◷</i>${escapeHtml(t.time_of_day||'Anytime')}</li></ul>${avatarHtml(t)}</div><div class="tc-foot"><b class="tc-open">Open</b>${n?`<span>• ${n} offer${n===1?'':'s'}</span>`:''}<span class="tc-cat">${escapeHtml(t.category||'')}</span></div></article>`;}).join('')||'<div class="empty-list"><p>No tasks match your filters.</p><button type="button" class="outline" id="emptyClear">Clear filters</button></div>';document.querySelectorAll('.task-card').forEach(c=>{c.onclick=()=>openTask(c.dataset.id);c.onkeydown=e=>{if(e.key==='Enter')openTask(c.dataset.id);};c.onmouseenter=()=>selectTask(c.dataset.id,false);});if($('emptyClear'))$('emptyClear').onclick=clearFilters;updateLocLabel();renderMap(rows);}
function updateLocLabel(){const parts=[];if(F.type==='remote')parts.push('Remote');else{if(F.km&&centre)parts.push(F.km+' km');if(F.text)parts.push(F.text);else if(F.useMe&&F.km)parts.push('near me');else if(F.km&&centre)parts.push('Nairobi');if(F.type==='inperson')parts.push('in person');}$('locLabel').textContent=parts.length?parts.join(' · '):'Location';$('locBtn').classList.toggle('on',parts.length>0);}
function clearFilters(){$('searchInput').value='';$('categoryFilter').value='';$('priceFilter').value='';$('sortFilter').value='new';F={type:'all',km:0,text:'',useMe:false,geoText:''};centre=null;renderTasks();drawRadius();}
/* Location panel (Airtasker-style): task type, area, distance slider */
function locPanel(){let p=$('locPanel');if(p)return p;p=document.createElement('div');p.id='locPanel';p.className='loc-panel';p.setAttribute('role','dialog');p.setAttribute('aria-label','Location filter');p.innerHTML=`<div class="lp-head"><b>Location</b><button type="button" class="lp-x" id="lpX" aria-label="Close">×</button></div><div class="lp-sec"><span class="lp-label">Task type</span><div class="seg" id="lpType"><button type="button" data-type="all">All</button><button type="button" data-type="inperson">In person</button><button type="button" data-type="remote">Remote</button></div></div><div class="lp-sec" id="lpPlace"><label class="lp-label" for="lpText">Suburb, town or area</label><input id="lpText" autocomplete="off" placeholder="e.g. Westlands, Nairobi"><button type="button" class="outline" id="lpMe">◎ Use my location</button></div><div class="lp-sec" id="lpDist"><div class="lp-km"><span class="lp-label">Distance</span><b id="lpKmVal">Any distance</b></div><input type="range" id="lpKm" min="0" max="${KMS.length-1}" step="1" value="0" aria-label="Distance"><small class="lp-note">Distance works for tasks that have a map location. Remote tasks are always included unless you choose In person.</small></div><div class="lp-actions"><button type="button" class="outline" id="lpClear">Clear</button><button type="button" class="primary small" id="lpApply">Apply</button></div>`;document.body.appendChild(p);
 const setType=v=>{p.dataset.type=v;p.querySelectorAll('#lpType button').forEach(b=>b.classList.toggle('on',b.dataset.type===v));$('lpPlace').style.display=$('lpDist').style.display=v==='remote'?'none':'';};
 p.querySelectorAll('#lpType button').forEach(b=>b.onclick=()=>setType(b.dataset.type));
 $('lpKm').oninput=()=>{const k=KMS[$('lpKm').value];$('lpKmVal').textContent=k?'Within '+k+' km':'Any distance';};
 $('lpText').oninput=()=>{F.useMe=false;};
 $('lpX').onclick=closeLocPanel;
 $('lpClear').onclick=()=>{F={...F,type:'all',km:0,text:'',useMe:false,geoText:''};centre=null;syncLocPanel();renderTasks();drawRadius();closeLocPanel();};
 $('lpMe').onclick=()=>{if(!navigator.geolocation){toast('Location is not available in this browser.');return;}const b=$('lpMe');b.textContent='Finding you…';navigator.geolocation.getCurrentPosition(pos=>{centre=[approx(pos.coords.latitude),approx(pos.coords.longitude)];F.useMe=true;$('lpText').value='';b.textContent='✓ Using my location';if(!Number($('lpKm').value)){$('lpKm').value=3;$('lpKm').oninput();}},()=>{b.textContent='◎ Use my location';toast('Location permission was not granted.');},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});};
 $('lpApply').onclick=async()=>{const btn=$('lpApply');btn.disabled=true;btn.textContent='Applying…';try{F.type=p.dataset.type||'all';F.km=F.type==='remote'?0:KMS[$('lpKm').value];F.text=F.type==='remote'?'':$('lpText').value.trim();if(F.km){if(F.useMe&&centre&&!F.text){}else if(F.text){if(F.text!==F.geoText||!centre){const g=await geocode(F.text);if(g){centre=g;F.geoText=F.text;F.useMe=false;}else{centre=null;F.km=0;toast('We could not find that place on the map, so tasks are matched by name instead.');}}}else{centre=NAIROBI;F.useMe=false;F.geoText='';}}else if(!F.useMe){centre=null;}renderTasks();drawRadius();closeLocPanel();}finally{btn.disabled=false;btn.textContent='Apply';}};
 p._set=setType;return p;}
function syncLocPanel(){const p=locPanel();p._set(F.type);$('lpText').value=F.text;const i=Math.max(0,KMS.indexOf(F.km));$('lpKm').value=i;$('lpKmVal').textContent=KMS[i]?'Within '+KMS[i]+' km':'Any distance';$('lpMe').textContent=F.useMe?'✓ Using my location':'◎ Use my location';}
function openLocPanel(){const p=locPanel();syncLocPanel();const r=$('locBtn').getBoundingClientRect();p.classList.add('show');const w=p.offsetWidth;p.style.top=Math.min(r.bottom+8,window.innerHeight-p.offsetHeight-8)+'px';p.style.left=Math.max(8,Math.min(r.left,window.innerWidth-w-8))+'px';}
function closeLocPanel(){const p=$('locPanel');if(p)p.classList.remove('show');}
document.addEventListener('mousedown',e=>{const p=$('locPanel');if(p&&p.classList.contains('show')&&!p.contains(e.target)&&!$('locBtn').contains(e.target))closeLocPanel();});
function authModal(){
 modal(`<h2 id="modalTitle">Your SkyNetworks account</h2><p>Sign in or create an account to post tasks, make offers and message other members.</p><form id="authForm" novalidate><div class="field"><label>Email address</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>Password</label><input name="password" type="password" minlength="8" autocomplete="new-password" required></div><div class="field"><label>Display name (new accounts)</label><input name="display_name" autocomplete="name" placeholder="Your name"></div><div class="modal-actions"><button type="button" class="outline" id="signupBtn">Create account</button><button type="submit" class="primary" id="loginSubmit">Log in</button></div><div id="authStatus" class="auth-status" role="status" aria-live="polite"></div></form><p class="muted">New accounts may need to confirm their email before signing in. Check your inbox and spam folder.</p>`);
 const form=$('authForm'),signup=$('signupBtn'),login=$('loginSubmit'),status=$('authStatus');
 const showStatus=(message,isError=false)=>{status.textContent=message;status.classList.toggle('error',isError);status.classList.add('visible');};
 signup.onclick=async()=>{
  const emailInput=form.querySelector('[name="email"]'),passwordInput=form.querySelector('[name="password"]'),nameInput=form.querySelector('[name="display_name"]');
  const email=emailInput.value.trim().toLowerCase(),password=passwordInput.value,display_name=nameInput.value.trim();
  if(!emailInput.checkValidity()||!email){emailInput.reportValidity();showStatus('Please enter a valid email address.',true);return;}
  if(password.length<8){passwordInput.reportValidity();showStatus('Please use a password with at least 8 characters.',true);return;}
  signup.disabled=true;login.disabled=true;signup.textContent='Creating account…';showStatus('Connecting securely to SkyNetworks…');
  try{
   const result=await db.auth.signUp({email,password,options:{data:{display_name}}});
   if(result.error){console.error('SkyNetworks sign-up error:',{message:result.error.message,code:result.error.code,status:result.error.status});showStatus('Account was not created: '+explainAuthError(result.error),true);return;}
   if(result.data.session){user=result.data.user;showStatus('Your account has been created and you are signed in.');await refreshSession();setTimeout(closeModal,1600);}
   else{showStatus('Registration submitted. Check '+email+' for the confirmation email, then return here and log in. Also check your spam folder.');}
  }catch(err){console.error('SkyNetworks sign-up failed:',err);showStatus('Could not complete registration. Check your internet connection and try again. Details: '+(err?.message||String(err)),true);}
  finally{signup.disabled=false;login.disabled=false;signup.textContent='Create account';}
 };
 form.onsubmit=async e=>{
  e.preventDefault();const email=form.querySelector('[name="email"]').value.trim().toLowerCase(),password=form.querySelector('[name="password"]').value;
  if(!form.querySelector('[name="email"]').checkValidity()){form.querySelector('[name="email"]').reportValidity();return;}
  if(!password){showStatus('Enter your password to log in.',true);return;}
  signup.disabled=true;login.disabled=true;login.textContent='Logging in…';
  try{const {error}=await db.auth.signInWithPassword({email,password});if(error){showStatus('Login failed: '+explainAuthError(error),true);return;}closeModal();await refreshSession();toast('You are signed in.');}
  catch(err){console.error('SkyNetworks login failed:',err);showStatus('Login could not be completed: '+(err?.message||String(err)),true);}
  finally{signup.disabled=false;login.disabled=false;login.textContent='Log in';}
 };
}
async function refreshSession(){const {data}=await db.auth.getUser();user=data.user||null;$('loginBtn').textContent=user?'My account':'Log in';$('notificationDock').classList.toggle('hidden',!user);if(user){await loadNotifications();startNotificationPolling();}else{stopNotificationPolling();$('notificationCount').textContent='0';}}
function postTask(){
 if(!user){authModal();toast('Please sign in before publishing a task.');return;}
 modal(`<div class="post-task-header"><span class="eyebrow">CREATE AN OPPORTUNITY</span><h2 id="modalTitle">What do you need help with?</h2><p>Give the community enough detail to understand the work and make a useful offer.</p><div class="post-progress"><span class="active"></span><span></span><span></span></div></div>
 <form id="taskForm" class="post-task-form" novalidate>
  <section class="post-form-section"><div class="post-section-heading"><span class="post-step">1</span><div><h3>Describe your task</h3><p>Start with a short, clear title.</p></div></div>
   <div class="field"><label for="postTitle">Task title <span>Required</span></label><input id="postTitle" name="title" maxlength="100" required placeholder="e.g. Fix a leaking kitchen tap"><small>Be specific so the right people can find your task.</small></div>
   <div class="field"><label for="postCategory">Choose a category <span>Required</span></label><select id="postCategory" name="category" required><option value="Home & repairs">Home & repairs</option><option value="Business & digital">Business & digital</option><option value="Delivery & errands">Delivery & errands</option><option value="Events & lifestyle">Events & lifestyle</option><option value="Learning & tutoring">Learning & tutoring</option></select></div>
   <div class="field"><label for="postDescription">What needs to be done? <span>Required</span></label><textarea id="postDescription" name="description" maxlength="3000" minlength="15" required placeholder="Explain the work, what is needed, and any useful details…"></textarea><small>Do not include phone numbers, email addresses or private contact details.</small></div>
  </section>
  <section class="post-form-section"><div class="post-section-heading"><span class="post-step">2</span><div><h3>Set your budget</h3><p>Enter the amount you are comfortable offering.</p></div></div>
   <div class="field"><label for="postBudget">Your budget <span>Required</span></label><div class="currency-input"><span>KSh</span><input id="postBudget" name="budget" type="number" min="1" max="100000000" step="1" inputmode="numeric" required placeholder="e.g. 2500"></div><small>Providers can send offers and discuss the final price with you.</small></div>
  </section>
  <section class="post-form-section"><div class="post-section-heading"><span class="post-step">3</span><div><h3>Where and when?</h3><p>Share a general area only. Keep your exact address private.</p></div></div>
   <div class="field"><label>How will it be done?</label><div class="seg post-seg" id="postMode"><button type="button" data-mode="inperson" class="on">In person</button><button type="button" data-mode="remote">Remotely</button></div><input type="hidden" name="mode" value="inperson"></div>
   <div id="postPlace"><div class="field"><label for="postLocation">Town or neighbourhood <span>Required</span></label><input id="postLocation" name="location" maxlength="100" placeholder="e.g. Kilimani, Nairobi"><small>We place your task on the map using this area (accurate to roughly 1 km, never your exact address).</small></div>
   <div class="location-actions"><button type="button" class="outline" id="useLocation">◎ Use approximate location</button><span>Optional – your browser may ask permission.</span></div></div>
   <div class="form-grid"><div class="field"><label for="postDate">Needed before <span>Optional</span></label><input id="postDate" name="due_date" type="date"><small>Leave empty if you are flexible.</small></div><div class="field"><label for="postTime">Time of day</label><select id="postTime" name="time_of_day"><option>Anytime</option><option>Morning</option><option>Midday</option><option>Afternoon</option><option>Evening</option></select></div></div>
   <input type="hidden" name="latitude"><input type="hidden" name="longitude">
  </section>
  <div class="post-privacy-note"><b>🔒 Your safety matters</b><span>Your task is public to marketplace members. Do not include your home address, phone number, email or payment details.</span></div>
  <label class="checkline post-agreement"><input type="checkbox" name="agree" required> I have checked my task details and agree to the SkyNetworks platform rules.</label>
  <div id="taskSubmitStatus" class="task-submit-status" role="status" aria-live="polite"></div>
  <div class="modal-actions post-actions"><button type="button" class="outline" id="cancelPost">Cancel</button><button type="submit" class="primary" id="publishTaskBtn">Publish task <span>→</span></button></div>
 </form>`);
 const form=$('taskForm'),publish=$('publishTaskBtn'),status=$('taskSubmitStatus');
 const showTaskStatus=(message,isError=false)=>{status.textContent=message;status.classList.toggle('error',isError);status.classList.add('visible');};
 $('cancelPost').onclick=closeModal;
 form.elements.due_date.min=new Date().toISOString().slice(0,10);
 document.querySelectorAll('#postMode button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#postMode button').forEach(x=>x.classList.toggle('on',x===b));form.elements.mode.value=b.dataset.mode;$('postPlace').style.display=b.dataset.mode==='remote'?'none':'';});
 $('useLocation').onclick=()=>{
  const button=$('useLocation');
  if(!navigator.geolocation){showTaskStatus('Location is not supported by this browser. You can type your neighbourhood instead.',true);return;}
  button.disabled=true;button.textContent='Finding approximate location…';
  navigator.geolocation.getCurrentPosition(p=>{form.elements.latitude.value=approx(p.coords.latitude).toFixed(2);form.elements.longitude.value=approx(p.coords.longitude).toFixed(2);button.disabled=false;button.textContent='✓ Approximate location added';showTaskStatus('Approximate map location added.');},()=>{button.disabled=false;button.textContent='◎ Use approximate location';showTaskStatus('We could not access your location. Please enter your town or neighbourhood manually.',true);},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
 };
 publish.addEventListener('click',e=>{
   e.preventDefault();
   if(typeof form.requestSubmit==='function') form.requestSubmit();
   else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  });
  form.onsubmit=async e=>{
  e.preventDefault();
  if(publish.disabled)return;
  const d=new FormData(form),title=String(d.get('title')||'').trim(),description=String(d.get('description')||'').trim(),location=String(d.get('location')||'').trim(),budget=Number(d.get('budget')),remote=d.get('mode')==='remote';
  if(!title||!description||(!remote&&!location)||!Number.isFinite(budget)||budget<=0||!d.get('agree')){showTaskStatus('Please complete all required fields, enter a budget above KSh 0 and accept the platform rules.',true);return;}
  if(description.length<15){showTaskStatus('Please add a little more detail to help providers understand the task (at least 15 characters).',true);form.elements.description.focus();return;}
  if(!safeText(title+' '+description+' '+location)){showTaskStatus('Please remove phone numbers, email addresses, personal links or requests to contact you outside SkyNetworks.',true);return;}
  const {data:sessionData,error:sessionError}=await db.auth.getSession();
  const activeUser=sessionData?.session?.user||user;
  if(sessionError||!activeUser){showTaskStatus('Your sign-in session has expired. Please log in again, then publish your task.',true);return;}
  let lat=d.get('latitude')?Number(d.get('latitude')):null,lng=d.get('longitude')?Number(d.get('longitude')):null;
  if(remote){lat=null;lng=null;}
  publish.disabled=true;publish.textContent='Locating on the map…';
  if(!remote&&(lat===null||lng===null)&&location){const g=await geocode(location);if(g){lat=g[0];lng=g[1];}}
  const row={owner_id:activeUser.id,title,category:String(d.get('category')),description,budget,location:remote?'Remote':location,latitude:lat,longitude:lng,status:'open'};
  const extra={is_remote:remote,due_date:d.get('due_date')||null,time_of_day:String(d.get('time_of_day')||'Anytime')};
  publish.textContent='Publishing your task…';showTaskStatus('Saving your task securely. Please keep this window open.');
  try{
   let {data,error}=await db.from('tasks').insert(hasExtra?{...row,...extra}:row).select(BASE_COLS+(hasExtra?EXTRA_COLS:'')).single();
   if(error&&hasExtra&&/is_remote|due_date|time_of_day|schema cache|column/i.test(error.message)){hasExtra=false;({data,error}=await db.from('tasks').insert(row).select(BASE_COLS).single());}
   if(error){console.error('SkyNetworks task publication error:',{message:error.message,code:error.code,details:error.details,hint:error.hint});let advice='';if(error.code==='42501'||/row-level security|permission denied/i.test(error.message)){advice=' Your account may not have permission to create tasks. Check the tasks INSERT policy in Supabase.';}else if(/column .* does not exist|schema cache/i.test(error.message)){advice=' The tasks table columns in Supabase may not match the website fields.';}else if(/has no field|record "new"/i.test(error.message)){advice=' This is a database trigger bug. Run 03-fix-task-posting.sql in the Supabase SQL Editor, then try again.';}else if(/contact|phone|email/i.test(error.message)){advice=' Remove contact information from the title, description or location.';}showTaskStatus('Your task was not published: '+error.message+advice,true);return;}
   if(!data){showTaskStatus('Supabase did not return a saved task record. Please refresh the task list before trying again.',true);return;}
   if(!tasks.some(t=>String(t.id)===String(data.id)))tasks.unshift(data);
   renderTasks();
   status.classList.remove('error');status.classList.add('visible','success');status.textContent='Your task has been published successfully! It is now visible in the open tasks list.';
   publish.textContent='Published ✓';
   setTimeout(()=>{closeModal();$('browse').scrollIntoView({behavior:'smooth'});toast('Your task is live on SkyNetworks.');},1300);
  }catch(err){console.error('Unexpected task publication failure:',err);showTaskStatus('We could not complete publication because of a connection or unexpected error: '+(err?.message||String(err)),true);}
  finally{if($('publishTaskBtn')&&!status.classList.contains('success')){publish.disabled=false;publish.innerHTML='Publish task <span>→</span>';}}
 };
}

async function openTask(id){const task=tasks.find(t=>String(t.id)===String(id));if(!task)return;activeTask=task;const [msgRes,offerRes]=await Promise.all([db.from('messages').select('id,sender_id,recipient_id,visibility,body,created_at').eq('task_id',id).eq('visibility','public').order('created_at',{ascending:true}),db.from('offers').select('id,provider_id,amount,message,status,created_at').eq('task_id',id).order('created_at',{ascending:true})]);const messages=msgRes.data||[],offers=offerRes.data||[];const own=!!user&&task.owner_id===user.id;const accepted=offers.find(o=>o.status==='accepted');const privateAllowed=!!user&&!!accepted&&(own||accepted.provider_id===user.id);
 modal(`<h2 id="modalTitle">${escapeHtml(task.title)}</h2><p><b>${money(task.budget)}</b> · ${escapeHtml(task.is_remote?'Remote':(task.location||'Area not specified'))} · ${escapeHtml(task.category)}</p><p class="task-when">${escapeHtml(dueText(task))} · ${escapeHtml(task.time_of_day||'Anytime')}</p><p>${escapeHtml(task.description)}</p><div class="chat-section"><div class="chat-title"><b>Public task conversation</b><span>Visible to signed-in members</span></div><p class="privacy-hint">Keep questions about the task here. Phone numbers, emails, social accounts, personal links and contact requests are blocked.</p><div class="chat-messages" id="publicMessages">${messages.map(m=>messageBubble(m)).join('')||'<p class="empty-chat">No public messages yet. Ask the first task-related question.</p>'}</div>${user?`<form id="publicChatForm" class="chat-compose"><input name="body" maxlength="1500" required placeholder="Ask a public task question…"><button>Send</button></form>`:'<button class="primary" id="loginForChat">Sign in to join discussion</button>'}</div>
 <div class="offers-section"><div class="chat-title"><b>Provider offers</b><span>${offers.length} offer(s)</span></div>${offers.map(o=>`<div class="offer-row"><div><b>${money(o.amount)}</b><p>${escapeHtml(o.message||'No note provided')}</p><small>${o.status==='accepted'?'Accepted':o.status==='rejected'?'Not selected':'Pending'}</small></div>${own&&o.status==='pending'?`<button class="outline" data-accept="${o.id}">Accept & open private chat</button>`:''}</div>`).join('')||'<p class="empty-chat">No offers yet.</p>'}</div>
 ${user&&!own&&!accepted?`<form id="offerForm" class="offer-form"><h3>Make an offer</h3><div class="form-grid"><div class="field"><label>Your price (KES)</label><input type="number" name="amount" min="1" required></div><div class="field"><label>Short proposal</label><input name="message" maxlength="500" required placeholder="How will you do the task?"></div></div><button class="primary">Submit offer</button></form>`:''}
 ${privateAllowed?`<div class="chat-section private-section"><div class="chat-title"><b>🔒 Private negotiation</b><span>Customer & selected provider only</span></div><p class="privacy-hint">Use this private thread to agree scope, schedule and delivery details. Keep payment credentials out of chat.</p><div id="privateMessages" class="chat-messages">Loading private messages…</div><form id="privateChatForm" class="chat-compose"><input name="body" maxlength="1500" required placeholder="Write a private message…"><button>Send</button></form></div>`:''}
 <div class="modal-actions"><button class="outline" id="closeTask">Close</button></div>`);
 if($('loginForChat'))$('loginForChat').onclick=()=>authModal();if($('closeTask'))$('closeTask').onclick=closeModal;
 if($('publicChatForm'))$('publicChatForm').onsubmit=e=>sendMessage(e,task.id,'public',null);
 if($('offerForm'))$('offerForm').onsubmit=e=>sendOffer(e,task.id);
 document.querySelectorAll('[data-accept]').forEach(b=>b.onclick=()=>acceptOffer(b.dataset.accept,task.id));
 if(privateAllowed)await loadPrivateMessages(task.id,accepted.provider_id,task.owner_id);
}
function messageBubble(m){const mine=user&&m.sender_id===user.id;return `<div class="bubble ${mine?'mine':''}"><small>${mine?'You':'Marketplace member'} · ${new Date(m.created_at).toLocaleString()}</small><div>${escapeHtml(m.body)}</div></div>`;}
async function sendMessage(e,taskId,visibility,recipient){e.preventDefault();const input=e.target.body,body=input.value.trim();if(!body)return;if(visibility==='public'&&!safeText(body))return;const row={task_id:taskId,sender_id:user.id,recipient_id:recipient,visibility,body};const {error}=await db.from('messages').insert(row);if(error){toast(error.message.includes('contact')?'That message contains blocked contact details.':`Message not sent: ${error.message}`);return;}input.value='';await openTask(taskId);toast('Message sent.');}
async function sendOffer(e,taskId){e.preventDefault();const f=e.target,d=new FormData(f),message=String(d.get('message')).trim();if(!safeText(message))return;const {error}=await db.from('offers').insert({task_id:taskId,provider_id:user.id,amount:Number(d.get('amount')),message,status:'pending'});if(error){toast('Offer not sent: '+error.message);return;}toast('Your offer has been sent to the customer.');await openTask(taskId);}
async function acceptOffer(offerId,taskId){const {error}=await db.from('offers').update({status:'accepted'}).eq('id',offerId).eq('status','pending');if(error){toast('Could not accept offer: '+error.message);return;}toast('Offer accepted. Private negotiation is now available.');await openTask(taskId);}
async function loadPrivateMessages(taskId,providerId,ownerId){const recipient=user.id===ownerId?providerId:ownerId;const {data,error}=await db.from('messages').select('id,sender_id,recipient_id,visibility,body,created_at').eq('task_id',taskId).eq('visibility','private').or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipient}),and(sender_id.eq.${recipient},recipient_id.eq.${user.id})`).order('created_at',{ascending:true});if(error){$('privateMessages').textContent='Private chat could not load: '+error.message;return;}const box=$('privateMessages');box.innerHTML=(data||[]).map(messageBubble).join('')||'<p class="empty-chat">No private messages yet. Start the negotiation.</p>';box.scrollTop=box.scrollHeight;$('privateChatForm').onsubmit=e=>sendMessage(e,taskId,'private',recipient);}
async function loadNotifications(){if(!user)return;const {data,error}=await db.from('notifications').select('id,title,body,created_at,is_read').order('created_at',{ascending:false}).limit(25);if(error){console.warn('Notifications table may not be installed yet:',error.message);return;}const list=data||[];$('notificationCount').textContent=list.filter(n=>!n.is_read).length;$('notificationPanel').innerHTML=list.map(n=>`<div class="notification-item ${n.is_read?'':'unread'}"><b>${escapeHtml(n.title)}</b><p>${escapeHtml(n.body)}</p><small>${new Date(n.created_at).toLocaleString()}</small></div>`).join('')||'<p class="empty-chat">No notifications yet.</p>';}
function startNotificationPolling(){stopNotificationPolling();notificationPoll=setInterval(loadNotifications,30000);}function stopNotificationPolling(){if(notificationPoll)clearInterval(notificationPoll);notificationPoll=null;}
$('closeModal').onclick=closeModal;$('modalBackdrop').onclick=e=>{if(e.target===$('modalBackdrop'))closeModal();};['postTop','heroPost','ctaPost'].forEach(id=>$(id).onclick=postTask);$('loginBtn').onclick=()=>user?accountMenu():authModal();function accountMenu(){modal(`<h2 id="modalTitle">My account</h2><p>Signed in as ${escapeHtml(user.email)}</p><button class="outline" id="logoutBtn">Log out</button>`);$('logoutBtn').onclick=async()=>{await db.auth.signOut();closeModal();await refreshSession();toast('You have signed out.');};}
const mapToggle=$('mapToggle');
if(mapToggle){
 mapToggle.onclick=()=>{
  const layout=$('browse').querySelector('.task-layout');
  const showing=layout.classList.toggle('map-mode');
  mapToggle.setAttribute('aria-expanded',String(showing));
  mapToggle.textContent=showing?'Show list':'Show map';
  if(showing&&mapMain)setTimeout(()=>mapMain.invalidateSize(),120);
 };
}
$('searchBtn').onclick=renderTasks;$('searchInput').oninput=renderTasks;['categoryFilter','priceFilter','sortFilter'].forEach(id=>$(id).onchange=renderTasks);$('locBtn').onclick=()=>{const p=$('locPanel');p&&p.classList.contains('show')?closeLocPanel():openLocPanel();};$('allTasks').onclick=clearFilters;if($('signupTop'))$('signupTop').onclick=authModal;$('menuBtn').onclick=()=>$('mainNav').classList.toggle('open');$('notificationBtn').onclick=()=>{$('notificationPanel').classList.toggle('hidden');};$('locateBtn').onclick=()=>{if(!navigator.geolocation){toast('Geolocation is unavailable.');return;}navigator.geolocation.getCurrentPosition(p=>{if(!mapMain)return;centre=[approx(p.coords.latitude),approx(p.coords.longitude)];F.useMe=true;renderTasks();mapMain.setView(centre,13);L.circle([p.coords.latitude,p.coords.longitude],{radius:350,color:'#00a0d2',fillOpacity:.15}).addTo(mapMain).bindPopup('Your approximate location').openPopup();},()=>toast('Location permission was not granted.'),{enableHighAccuracy:false});};
(async()=>{initMaps();const {data}=await db.auth.getSession();user=data.session?.user||null;await refreshSession();db.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;refreshSession();});await loadTasks();})();

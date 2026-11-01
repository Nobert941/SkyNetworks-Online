// SkyNetworks: Supabase-connected MVP starter.
const { createClient } = supabase;
const db = createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
let currentUser = null;
let tasks = [];
let selectedTask = null;
const $ = id => document.getElementById(id);
function escapeHtml(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),3200);}
function openModal(html){$('modalContent').innerHTML=html;$('modalBackdrop').classList.add('show');}
function closeModal(){$('modalBackdrop').classList.remove('show');}
function money(v){return v==null?'Budget not specified':'KSh '+Number(v).toLocaleString();}
async function loadTasks(){
 const {data,error}=await db.from('tasks').select('id,title,description,category,budget,location,created_at,status').eq('status','open').order('created_at',{ascending:false}).limit(50);
 if(error){console.error(error);toast('Could not load tasks: '+error.message);return;}
 tasks=(data||[]).map(t=>({...t,desc:t.description||'',place:t.location||'Location not specified',time:t.created_at?new Date(t.created_at).toLocaleString():'Recently posted'}));renderTasks();
}
function renderTasks(){
 const q=$('searchInput').value.toLowerCase(),cat=$('categoryFilter').value;
 const shown=tasks.filter(t=>(!cat||t.category===cat)&&(!q||(t.title+' '+t.desc+' '+t.category+' '+t.place).toLowerCase().includes(q)));
 $('resultCount').textContent=shown.length+' opportunit'+(shown.length===1?'y':'ies');
 $('taskGrid').innerHTML=shown.map(t=>`<article class="task-card"><div class="task-meta"><span class="task-category">${escapeHtml(t.category)}</span><span>${escapeHtml(t.time)}</span></div><h4>${escapeHtml(t.title)}</h4><p>${escapeHtml(t.desc)}</p><div class="task-bottom"><div><div class="task-price">${money(t.budget)}</div><div class="task-place">⌖ ${escapeHtml(t.place)}</div></div><button data-task="${t.id}">View & discuss →</button></div></article>`).join('')||'<p>No live tasks found yet. Sign in to post the first task.</p>';
 document.querySelectorAll('[data-task]').forEach(b=>b.addEventListener('click',()=>openTask(b.dataset.task)));
}
function authModal(){openModal(`<h2 id="modalTitle">SkyNetworks account</h2><p>Sign in or create an account to post tasks.</p><form id="authForm"><div class="field"><label>Email address</label><input type="email" name="email" required placeholder="you@example.com"></div><div class="field"><label>Password</label><input type="password" name="password" required minlength="6" placeholder="At least 6 characters"></div><div class="field"><label>Display name (for new accounts)</label><input name="display_name" placeholder="Your name"></div><div class="modal-actions"><button type="button" class="outline" id="signupBtn">Create account</button><button class="primary">Log in</button></div></form><p style="font-size:11px">New accounts may need to confirm their email before signing in.</p>`);
 $('signupBtn').onclick=async()=>{const f=$('authForm');const email=f.email.value.trim(),password=f.password.value,display_name=f.display_name.value.trim();if(!email||password.length<6){toast('Enter a valid email and password of at least 6 characters.');return;}const {error}=await db.auth.signUp({email,password,options:{data:{display_name}}});if(error)toast(error.message);else toast('Account created. Check your email if confirmation is enabled.');};
 $('authForm').onsubmit=async e=>{e.preventDefault();const d=new FormData(e.target);const {error}=await db.auth.signInWithPassword({email:d.get('email'),password:d.get('password')});if(error)toast(error.message);else{closeModal();toast('Signed in successfully.');await refreshUser();}};
}
async function refreshUser(){const {data}=await db.auth.getUser();currentUser=data.user||null;$('loginBtn').textContent=currentUser?'Account':'Log in';}
function postTask(){if(!currentUser){toast('Please log in or create an account before posting.');authModal();return;}openModal(`<h2 id="modalTitle">Post a task</h2><p>Do not include private contact details or an exact home address in the public task.</p><form id="taskForm"><div class="form-grid"><div class="field full-field"><label>Task title</label><input required name="title" placeholder="e.g. Repair a washing machine"></div><div class="field"><label>Category</label><select name="category" required><option>Home & repairs</option><option>Business & digital</option><option>Delivery & errands</option><option>Events & lifestyle</option><option>Learning & tutoring</option></select></div><div class="field"><label>Budget (KES)</label><input name="budget" type="number" min="1" required placeholder="5000"></div><div class="field"><label>General area / town</label><input name="place" required placeholder="e.g. Kilimani, Nairobi"></div><div class="field full-field"><label>Describe the task</label><textarea name="desc" required placeholder="Explain what needs doing…"></textarea></div></div><div class="fee-box">The 10% fee shown in the prototype is illustrative only. No payments are processed yet.</div><label style="font-size:10px"><input type="checkbox" required> I agree to the platform rules.</label><div class="modal-actions"><button type="button" class="outline" id="cancelPost">Cancel</button><button class="primary">Publish task</button></div></form>`);
 $('cancelPost').onclick=closeModal;
 $('taskForm').onsubmit=async e=>{e.preventDefault();const d=new FormData(e.target);const row={owner_id:currentUser.id,title:d.get('title'),category:d.get('category'),description:d.get('desc'),budget:Number(d.get('budget')),location:d.get('place'),status:'open'};const {error}=await db.from('tasks').insert(row);if(error){toast('Task was not saved: '+error.message);return;}closeModal();toast('Task published to Supabase.');await loadTasks();$('browse').scrollIntoView();};
}
function openTask(id){selectedTask=tasks.find(t=>String(t.id)===String(id));if(!selectedTask)return;openModal(`<h2 id="modalTitle">${escapeHtml(selectedTask.title)}</h2><p><b>${money(selectedTask.budget)}</b> · ${escapeHtml(selectedTask.place)} · ${escapeHtml(selectedTask.category)}</p><p>${escapeHtml(selectedTask.desc)}</p><div class="notice">Task discussions and offers will be enabled in the next development step. Do not share phone numbers, email addresses or exact addresses publicly.</div><button class="primary" id="signInToDiscuss">Sign in to continue</button>`);$('signInToDiscuss').onclick=()=>{closeModal();authModal();};}
$('closeModal').onclick=closeModal;$('modalBackdrop').onclick=e=>{if(e.target===$('modalBackdrop'))closeModal()};
['postTop','heroPost','ctaPost'].forEach(id=>$(id).onclick=postTask);
$('loginBtn').onclick=authModal;$('searchBtn').onclick=renderTasks;$('searchInput').oninput=renderTasks;$('categoryFilter').onchange=renderTasks;$('allTasks').onclick=()=>{$('searchInput').value='';$('categoryFilter').value='';renderTasks()};
document.querySelectorAll('.cat').forEach(b=>b.onclick=()=>{document.querySelectorAll('.cat').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('categoryFilter').value=b.dataset.cat;renderTasks()});
$('mapInfo').onclick=()=>toast('Map preview only. Live maps will be added separately.');$('menuBtn').onclick=()=>document.querySelector('.topbar nav').classList.toggle('open');
(async()=>{await refreshUser();db.auth.onAuthStateChange(async()=>{await refreshUser();});await loadTasks();})();

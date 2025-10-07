/********** CONFIG **********/
const firebaseConfig = /* COLE AQUI SEU FIREBASE CONFIG */;
const OWNER_UID = "COLE_AQUI_SEU_UID";
/***************************/
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- LOCAL STORAGE KEYS ---
const RULES_KEY = 'group_rules_v1';
const NAME_KEY = 'group_name_v1';

// --- UI ELEMENTS ---
const rulesDisplay = document.getElementById('rules-display');
const rulesTextarea = document.getElementById('rules-textarea');
const editor = document.getElementById('editor');
const signedOutUI = document.getElementById('loginTab');
const signedInUI = document.getElementById('playerInfo');
const playerName = document.getElementById('playerName');
const playerGold = document.getElementById('playerGold');
const ownerPanel = document.getElementById('ownerPanel');
const rankList = document.getElementById('rankList');

let currentUser = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  // Load group name
  document.getElementById('group-name').textContent = localStorage.getItem(NAME_KEY) || 'Regras do Grupo';
  const rules = localStorage.getItem(RULES_KEY);
  rules ? showRules(rules) : showPlaceholder();

  // Regras buttons
  document.getElementById('edit-rules-btn').addEventListener('click', openEditor);
  document.getElementById('save-rules-btn').addEventListener('click', saveRules);
  document.getElementById('cancel-edit-btn').addEventListener('click', closeEditor);
  document.getElementById('copy-btn').addEventListener('click', copyRules);
  document.getElementById('download-btn').addEventListener('click', downloadRules);
  document.getElementById('reset-btn').addEventListener('click', resetAll);
  document.getElementById('edit-name-btn').addEventListener('click', editName);

  // Tabs
  document.querySelectorAll('.tabbtn').forEach(b => b.addEventListener('click', e => {
    document.querySelectorAll('.tabbtn').forEach(x => x.classList.remove('active'));
    e.currentTarget.classList.add('active');
    const tab = e.currentTarget.dataset.tab;
    showTab(tab);
  }));
  showTab('loginTab');

  // Auth buttons
  document.getElementById('btnSignup').onclick = signup;
  document.getElementById('btnLogin').onclick = login;
  document.getElementById('btnLogout')?.addEventListener('click', () => auth.signOut());

  // Admin buttons
  document.getElementById('btnGive')?.addEventListener('click', adminGive);
  document.getElementById('btnReset')?.addEventListener('click', adminReset);

  // Game buttons
  document.getElementById('slotBet') && document.getElementById('slotBet').parentElement.querySelector('button').addEventListener('click', playSlot);
  document.getElementById('diceBet') && document.getElementById('diceBet').parentElement.querySelector('button').addEventListener('click', playDice);
  document.getElementById('cardBet') && document.getElementById('cardBet').parentElement.querySelector('button').addEventListener('click', playCard);
  document.getElementById('coinBet') && document.getElementById('coinBet').parentElement.querySelector('button').addEventListener('click', playCoin);
  document.getElementById('spinBet') && document.getElementById('spinBet').parentElement.querySelector('button').addEventListener('click', playSpin);

  reloadRank();
  setInterval(reloadRank, 10000);
});

// --- TABS ---
function showTab(tab){
  ['loginTab','jogoTab','rankTab'].forEach(t => {
    const el = document.getElementById(t);
    if(el) el.style.display = (t===tab?'block':'none');
  });
}

// --- RULES ---
function showRules(text){
  const html = text.split(/\n\n+/).map(par=>`<p>${escapeHtml(par).replace(/\n/g,'<br>')}</p>`).join('');
  rulesDisplay.innerHTML = html;
}
function showPlaceholder(){
  rulesDisplay.innerHTML = '<p class="muted">As regras serão adicionadas aqui em breve...</p>';
}
function openEditor(){ rulesTextarea.value = localStorage.getItem(RULES_KEY) || ''; editor.classList.remove('hidden'); document.getElementById('edit-rules-btn').disabled=true; }
function closeEditor(){ editor.classList.add('hidden'); document.getElementById('edit-rules-btn').disabled=false; }
function saveRules(){ const text = rulesTextarea.value.trim(); if(!text && !confirm('O texto está vazio. Deseja salvar mesmo assim?')) return; localStorage.setItem(RULES_KEY,text); closeEditor(); text?showRules(text):showPlaceholder(); alert('Regras salvas localmente no seu navegador.'); }
function copyRules(){ const text = localStorage.getItem(RULES_KEY); if(!text){ alert('Não há regras salvas para copiar.'); return; } if(navigator.clipboard?.writeText){ navigator.clipboard.writeText(text).then(()=>alert('Regras copiadas!')).catch(()=>fallbackCopy(text)); } else fallbackCopy(text); }
function fallbackCopy(text){ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy'); alert('Regras copiadas!');}catch(e){alert('Não foi possível copiar.');} ta.remove(); }
function downloadRules(){ const text=localStorage.getItem(RULES_KEY)||''; const blob=new Blob([text],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='regras.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function resetAll(){ if(!confirm('Deseja redefinir nome e regras?')) return; localStorage.removeItem(RULES_KEY); localStorage.removeItem(NAME_KEY); showPlaceholder(); document.getElementById('group-name').textContent='Regras do Grupo'; alert('Redefinido.'); }
function editName(){ const newName = prompt('Digite o nome do grupo:', localStorage.getItem(NAME_KEY)||'Regras do Grupo'); if(newName!==null){ localStorage.setItem(NAME_KEY,newName.trim()||'Regras do Grupo'); document.getElementById('group-name').textContent = localStorage.getItem(NAME_KEY); } }
function escapeHtml(u){ return u.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// --- AUTH ---
function usernameToEmail(u){ return `${u}@ivad.local`; }
function validUsername(u){ return /^[a-zA-Z0-9_]{3,20}$/.test(u); }
async function signup(){
  const uname = (document.getElementById('username').value||'').trim();
  const pw = document.getElementById('pwd').value||'';
  if(!validUsername(uname)){ alert('Nome inválido'); return; }
  if(pw.length<6){ alert('Senha precisa ≥6'); return; }
  try{
    const q = await db.collection('users').where('displayName','==',uname).limit(1).get();
    if(!q.empty){ alert('Nome já existe'); return; }
    const cred = await auth.createUserWithEmailAndPassword(usernameToEmail(uname),pw);
    const user = cred.user;
    await db.collection('users').doc(user.uid).set({uid:user.uid,email:usernameToEmail(uname),displayName:uname,gold:1000,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    alert('Conta criada! Você já está logado.');
  }catch(err){ console.error(err); alert('Erro: '+(err.message||err)); }
}
async function login(){
  const uname = (document.getElementById('username').value||'').trim();
  const pw = document.getElementById('pwd').value||'';
  if(!validUsername(uname)){ alert('Nome inválido'); return; }
  if(pw.length<6){ alert('Senha precisa ≥6'); return; }
  try{ await auth.signInWithEmailAndPassword(usernameToEmail(uname),pw); }catch(err){ console.error(err); alert('Erro: '+(err.message||err)); }
}
auth.onAuthStateChanged(async user=>{
  currentUser = user;
  if(user){
    signedOutUI.style.display='none';
    signedInUI.style.display='block';
    ownerPanel.style.display = (user.uid===OWNER_UID?'block':'none');
    const doc = await db.collection('users').doc(user.uid).get();
    if(!doc.exists) await db.collection('users').doc(user.uid).set({uid:user.uid,email:user.email,displayName:user.email.split('@')[0],gold:1000,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    updatePlayerInfo();
  } else {
    signedOutUI.style.display='block';
    signedInUI.style.display='none';
    ownerPanel.style.display='none';
    playerInfo.style.display='none';
  }
});

// --- PLAYER INFO ---
async function updatePlayerInfo(){
  if(!currentUser) return;
  const doc = await db.collection('users').doc(currentUser.uid).get();
  if(doc.exists){
    const data = doc.data();
    playerName.textContent = data.displayName;
    playerGold.textContent = data.gold||0;
    playerInfo.style.display='block';
  }
}

// --- RANK ---
async function reloadRank(){
  if(!rankList) return;
  rankList.innerHTML='<p class="small">Carregando...</p>';
  try{
    const snap = await db.collection('users').orderBy('gold','desc').limit(50).get();
    if(snap.empty){ rankList.innerHTML='<p class="small">Nenhum jogador ainda.</p>'; return; }
    let html='<ol>';
    snap.forEach(doc=>{ const d=doc.data(); html+=`<li><strong>${escapeHtml(d.displayName||d.email||'user')}</strong> — ${Number(d.gold||0)} gold</li>`; });
    html+='</ol>';
    rankList.innerHTML=html;
  }catch(err){ console.error(err); rankList.innerHTML='<p class="small">Erro ao carregar ranking</p>'; }
}

// --- ADMIN ---
async function adminGive(){
  if(!currentUser || currentUser.uid!==OWNER_UID){ alert('Somente dono'); return; }
  const name = (document.getElementById('adminName').value||'').trim();
  const amt = Number(document.getElementById('adminAmount').value||0);
  if(!name || !amt){ alert('Nome e quantidade necessários'); return; }
  const q = await db.collection('users').where('displayName','==',name).limit(1).get();
  if(q.empty){ alert('Usuário não encontrado'); return; }
  const doc = q.docs[0];
  await db.collection('users').doc(doc.id).update({gold:(doc.data().gold||0)+amt});
  alert('Atualizado'); reloadRank();
}
async function adminReset(){
  if(!currentUser || currentUser.uid!==OWNER_UID){ alert('Somente dono'); return; }
  if(!confirm('Resetar gold de todos para 0?')) return;
  const snap = await db.collection('users').get();
  const batch = db.batch();
  snap.forEach(d=>batch.update(db.collection('users').doc(d.id),{gold:0}));
  await batch.commit();
  alert('Resetado'); reloadRank();
}

// --- CASSINO GAMES ---
async function playBet(gameId, betAmount, callback){
  if(!currentUser){ alert('Faça login'); return; }
  betAmount = Number(betAmount);
  if(!betAmount || betAmount<=0){ alert('Valor inválido'); return; }

  const userRef = db.collection('users').doc(currentUser.uid);
  try{
    await db.runTransaction(async tx=>{
      const doc = await tx.get(userRef);
      if(!doc.exists) throw 'Usuário não encontrado';
      const gold = doc.data().gold || 0;
      if(gold<betAmount) throw 'Gold insuficiente';
      const win = callback(betAmount);
      tx.update(userRef,{gold:gold+win});
    });
    await updatePlayerInfo();
    reloadRank();
  }catch(err){ alert(err); console.error(err); }
}

function playSlot(){ 
  const bet = document.getElementById('slotBet').value; 
  playBet('slot', bet, amt=>{
    const outcomes = [0, amt*2, amt*3]; 
    const result = outcomes[Math.floor(Math.random()*outcomes.length)]; 
    document.getElementById('slotMsg').textContent = result>0?`Você ganhou ${result} gold!`:'Você perdeu!';
    return result-amt;
  });
}

function playDice(){ 
  const bet = document.getElementById('diceBet').value; 
  playBet('dice', bet, amt=>{
    const roll = Math.floor(Math.random()*6)+1;
    const result = roll>=4? amt*2 : 0; 
    document.getElementById('diceMsg').textContent = `Dado: ${roll} — ${result>0?`Ganhou ${result} gold`:'Perdeu'}`;
    return result-amt;
  });
}

function playCard(){ 
  const bet = document.getElementById('cardBet').value; 
  playBet('card', bet, amt=>{
    const flip = Math.floor(Math.random()*13)+1;
    const result = flip>7? amt*2 : 0;
    document.getElementById('cardMsg').textContent = `Carta: ${flip} — ${result>0?`Ganhou ${result} gold`:'Perdeu'}`;
    return result-amt;
  });
}

function playCoin(){ 
  const bet = document.getElementById('coinBet').value; 
  playBet('coin', bet, amt=>{
    const flip = Math.random()<0.5;
    const result = flip? amt*2 : 0;
    document.getElementById('coinMsg').textContent = `${flip?'Cara':'Coroa'} — ${result>0?`Ganhou ${result} gold`:'Perdeu'}`;
    return result-amt;
  });
}

function playSpin(){ 
  const bet = document.getElementById('spinBet').value; 
  playBet('spin', bet, amt=>{
    const prizes = [0, amt*2, amt*3, amt*5];
    const result = prizes[Math.floor(Math.random()*prizes.length)];
    document.getElementById('spinMsg').textContent = result>0?`Ganhou ${result} gold!`:'Você perdeu!';
    return result-amt;
  });
}
// ==== CONFIG ====
// Cole seu firebaseConfig abaixo
const firebaseConfig = /* COLE AQUI */;
const OWNER_UID = "COLE_AQUI_SEU_UID";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ===== UI Refs =====
const signedOutUI = document.getElementById('signedOutUI');
const signedInUI = document.getElementById('signedInUI');
const userLabel = document.getElementById('userLabel');
const myGold = document.getElementById('myGold');
const playerName = document.getElementById('playerName');
const playerGold = document.getElementById('playerGold');
const playerInfo = document.getElementById('playerInfo');
const workMsg = document.getElementById('workMsg');
const rouletteMsg = document.getElementById('rouletteMsg');
const slotMsg = document.getElementById('slotMsg');
const betMsg = document.getElementById('betMsg');
const rankList = document.getElementById('rankList');

// Tabs
function showTab(id){
  ['regrasTab','jogoTab','rankTab','cassinoTab'].forEach(t=>{
    const el=document.getElementById(t);
    if(el) el.style.display=(t===id?'block':'none');
  });
}
document.querySelectorAll('.tabbtn').forEach(b=>{
  b.addEventListener('click',e=>{
    document.querySelectorAll('.tabbtn').forEach(x=>x.classList.remove('active'));
    e.currentTarget.classList.add('active');
    showTab(e.currentTarget.dataset.tab);
  });
});

// detect initial tab
if(document.getElementById('regrasTab')) showTab('regrasTab');
else if(document.getElementById('cassinoTab')) showTab('cassinoTab');

// helper
function usernameToEmail(u){ return `${u}@ivad.local`; }
function validUsername(u){ return /^[a-zA-Z0-9_]{3,20}$/.test(u); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ===== Auth =====
document.getElementById('btnSignup').onclick = async ()=>{
  const uname = document.getElementById('username').value.trim();
  const pw = document.getElementById('pwd').value;
  if(!validUsername(uname)){ alert('Nome inválido'); return; }
  if(pw.length<6){ alert('Senha precisa ≥6'); return; }
  try{
    const q = await db.collection('users').where('displayName','==',uname).limit(1).get();
    if(!q.empty){ alert('Nome já existe'); return; }
    const syntheticEmail = usernameToEmail(uname);
    const cred = await auth.createUserWithEmailAndPassword(syntheticEmail,pw);
    const user = cred.user;
    await db.collection('users').doc(user.uid).set({uid:user.uid,email:syntheticEmail,displayName:uname,gold:0,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    alert('Conta criada! Você já está logado.');
  }catch(err){ console.error(err); alert('Erro: '+err.message); }
};

document.getElementById('btnLogin').onclick = async ()=>{
  const uname = document.getElementById('username').value.trim();
  const pw = document.getElementById('pwd').value;
  if(!validUsername(uname)){ alert('Nome inválido'); return; }
  if(pw.length<6){ alert('Senha precisa ≥6'); return; }
  try{
    const email = usernameToEmail(uname);
    await auth.signInWithEmailAndPassword(email,pw);
  }catch(err){ console.error(err); alert('Erro ao entrar: '+err.message); }
};

document.getElementById('btnLogout').onclick = ()=>auth.signOut();

// Auth state
auth.onAuthStateChanged(user=>{
  if(user){
    signedOutUI.style.display='none';
    signedInUI.style.display='block';
    userLabel.textContent = 'Conectado: '+(user.email?user.email.split('@')[0]:user.uid);
    if(user.uid===OWNER_UID) document.getElementById('ownerPanel').style.display='block';
    else document.getElementById('ownerPanel').style.display='none';
    updateMyInfo(user.uid);
  }else{
    signedOutUI.style.display='block';
    signedInUI.style.display='none';
    document.getElementById('ownerPanel').style.display='none';
    myGold.textContent='0';
    if(playerInfo) playerInfo.style.display='none';
  }
});

// ===== User Info =====
async function updateMyInfo(uid){
  const doc = await db.collection('users').doc(uid).get();
  if(doc.exists){
    const data = doc.data();
    myGold.textContent = data.gold||0;
    if(playerInfo){
      playerName.textContent = data.displayName;
      playerGold.textContent = data.gold||0;
      playerInfo.style.display='block';
    }
  }
}

// ===== Work Button (index.html) =====
let lastWork=0;
const btnWork=document.getElementById('btnWork');
if(btnWork){
  btnWork.onclick=async ()=>{
    const user = auth.currentUser;
    if(!user){ alert('Faça login'); return; }
    const now = Date.now();
    if(now-lastWork<5000){ workMsg.textContent='Aguarde 5s'; return; }
    lastWork=now;
    try{
      await addGold(user.uid,1);
      updateMyInfo(user.uid);
      workMsg.textContent='+1 gold!';
      setTimeout(()=>workMsg.textContent='',1200);
      reloadRank();
    }catch(err){ alert(err); }
  };
}

// ===== CASINO =====
async function addGold(uid,amount){
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async tx=>{
    const d = await tx.get(userRef);
    if(!d.exists) throw 'Usuário não encontrado';
    const newGold = (d.data().gold||0)+amount;
    if(newGold<0) throw 'Gold insuficiente';
    tx.update(userRef,{gold:newGold});
    return newGold;
  });
}

// Roleta
const btnRoulette=document.getElementById('btnRoulette');
if(btnRoulette){
  btnRoulette.onclick=async ()=>{
    const user = auth.currentUser;
    if(!user){ alert('Faça login'); return; }
    try{
      await addGold(user.uid,-1);
      const win=Math.random()<0.5;
      if(win) await addGold(user.uid,2);
      rouletteMsg.textContent = win ? '🎉 Ganhou 2 gold!' : '💀 Perdeu 1 gold.';
      updateMyInfo(user.uid);
    }catch(err){ alert(err); }
  };
}

// Slot
const btnSlot=document.getElementById('btnSlot');
if(btnSlot){
  btnSlot.onclick=async ()=>{
    const user = auth.currentUser;
    if(!user){ alert('Faça login'); return; }
    try{
      await addGold(user.uid,-1);
      const symbols=['🍒','🍋','🔔','💎'];
      const s=[symbols[Math.floor(Math.random()*4)],symbols[Math.floor(Math.random()*4)],symbols[Math.floor(Math.random()*4)]];
      let msg=s.join(' ');
      let win=(s[0]===s[1] && s[1]===s[2]);
      if(win) await addGold(user.uid,5);
      slotMsg.textContent=win ? msg+' 🎉 Ganhou 5 gold!' : msg+' 💀 Perdeu 1 gold.';
      updateMyInfo(user.uid);
    }catch(err){ alert(err); }
  };
}

// Coin Flip
const btnBet=document.getElementById('btnBet');
if(btnBet){
  btnBet.onclick=async ()=>{
    const user = auth.currentUser;
    if(!user){ alert('Faça login'); return; }
    const amt=Number(document.getElementById('betAmount').value);
    const choice=Number(document.getElementById('betChoice').value);
    if(!amt || amt<=0){ alert('Valor inválido'); return; }
    try{
      await addGold(user.uid,-amt);
      const result=Math.random()<0.5?1:0;
      const win=(result===choice);
      if(win) await addGold(user.uid,amt*2);
      betMsg.textContent = win ? `🎉 Ganhou ${amt*2} gold!` : `💀 Perdeu ${amt} gold.`;
      updateMyInfo(user.uid);
    }catch(err){ alert(err); }
  };
}

// ===== Rank =====
async function reloadRank(){
  if(!rankList) return;
  rankList.innerHTML='<p class="small">Carregando...</p>';
  try{
    const snap=await db.collection('users').orderBy('gold','desc').limit(50).get();
    if(snap.empty){ rankList.innerHTML='<p class="small">Nenhum jogador ainda.</p>'; return; }
    let html='<ol>';
    snap.forEach(doc=>{const d=doc.data(); html+=`<li style="margin:.4rem 0"><strong>${escapeHtml(d.displayName||d.email||'user')}</strong> — ${Number(d.gold||0)} gold</li>`;});
    html+='</ol>';
    rankList.innerHTML=html;
  }catch(err){ rankList.innerHTML='<p class="small">Erro ao carregar ranking</p>'; }
}
reloadRank(); setInterval(reloadRank,10000);

// ===== OWNER ACTIONS =====
const btnGive=document.getElementById('btnGive');
if(btnGive){
  btnGive.onclick=async ()=>{
    const user = auth.currentUser;
    if(!user||user.uid!==OWNER_UID){ alert('Somente dono'); return; }
    const name=document.getElementById('adminName').value.trim();
    const amt=Number(document.getElementById('adminAmount').value||0);
    if(!name||!amt){ alert('Nome e quantidade necessários'); return; }
    const q=await db.collection('users').where('displayName','==',name).limit(1).get();
    if(q.empty){ alert('Usuário não encontrado'); return; }
    const doc=q.docs[0];
    await db.collection('users').doc(doc.id).update({gold:Number(doc.data().gold||0)+amt});
    alert('Atualizado'); reloadRank();
  };
}

const btnReset=document.getElementById('btnReset');
if(btnReset){
  btnReset.onclick=async ()=>{
    const user = auth.currentUser;
    if(!user||user.uid!==OWNER_UID){ alert('Somente dono'); return; }
    if(!confirm('Resetar gold de todos para 0?')) return;
    const snap = await db.collection('users').get();
    const batch=db.batch();
    snap.forEach(d=>batch.update(db.collection('users').doc(d.id),{gold:0}));
    await batch.commit(); alert('Resetado'); reloadRank();
  };
}
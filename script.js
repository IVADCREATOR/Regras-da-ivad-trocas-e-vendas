// =================================================================
// script.js - Lógica Central do IVAD Marketplace (V. FINAL COM ADMIN)
// =================================================================

// 1. Variáveis Globais e Inicialização do Firebase
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage(); 

let currentUserUid = null;
let currentUsername = null;
let currentUserRole = 'user'; // Nível de permissão padrão
const PIX_KEY = "11913429349";
const usernameCache = {};

// =================================================================
// 2. AUTENTICAÇÃO E FUNÇÕES AUXILIARES
// =================================================================

async function getUsernameByUid(uid) {
    if (!uid) return 'Usuário Desconhecido';
    if (usernameCache[uid]) return usernameCache[uid];
    
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            const data = doc.data();
            const username = data.username || `UID-${uid.substring(0, 6)}`;
            usernameCache[uid] = username;
            return username;
        } else {
            return `UID-NÃO-REGIST.${uid.substring(0, 4)}`; 
        }
    } catch (e) {
        console.error("Erro ao buscar username:", e);
        return `ERRO-UID-${uid.substring(0, 4)}`; 
    }
}

async function handleRegister() {
    const username = document.getElementById('inputUsername').value;
    const email = document.getElementById('inputEmail').value;
    const password = document.getElementById('inputPassword').value;

    if (!username || !email || !password) {
        alert("Preencha todos os campos para registro.");
        return;
    }
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await db.collection('users').doc(user.uid).set({
            username: username,
            email: email,
            role: 'user', // Define o papel padrão
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert(`Bem-vindo, ${username}! Seu registro foi concluído.`);
    } catch (error) {
        console.error("Erro no Registro:", error);
        alert(`Falha no Registro: ${error.message}`);
    }
}

async function handleLogin() {
    const email = document.getElementById('inputEmail').value;
    const password = document.getElementById('inputPassword').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        alert("Login efetuado com sucesso!");
    } catch (error) {
        console.error("Erro no Login:", error);
        alert(`Falha no Login: ${error.message}`);
    }
}

// Listener de Status de Autenticação
auth.onAuthStateChanged(async (user) => {
    const authBtn = document.getElementById('authBtn');
    const modalElement = document.getElementById('loginModal');
    
    if (modalElement) {
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) modalInstance.hide();
    }

    if (user) {
        currentUserUid = user.uid;
        currentUsername = await getUsernameByUid(user.uid); 
        
        // **CRÍTICO: Busca o nível de permissão (ROLE)**
        const userDoc = await db.collection('users').doc(user.uid).get();
        currentUserRole = userDoc.exists ? userDoc.data().role || 'user' : 'user';

        // Atualiza a UI para estado Logado
        if (authBtn) {
            authBtn.textContent = `Olá, ${currentUsername} (Sair)`;
            authBtn.classList.remove('btn-primary', 'btn-danger');
            authBtn.classList.add('btn-success');
            authBtn.onclick = () => { auth.signOut(); }; 
        }
        
        const uidDisplay = document.getElementById('my-uid-display');
        if (uidDisplay) uidDisplay.textContent = user.uid;

        // Se estiver no painel de admin, inicia o setup
        if (document.body.id === 'admin-page' && typeof setupAdminPanel === 'function') {
            setupAdminPanel();
        }
        
    } else {
        currentUserUid = null;
        currentUsername = null;
        currentUserRole = 'user';
        
        // Atualiza a UI para estado Deslogado (CORREÇÃO DE INTERAÇÃO)
        if (authBtn) {
            authBtn.innerHTML = '<i class="fas fa-user me-1"></i> Entrar / Cadastrar';
            authBtn.classList.add('btn-primary');
            authBtn.classList.remove('btn-success', 'btn-danger');
            
            authBtn.onclick = () => {
                const modalElement = document.getElementById('loginModal');
                if (modalElement) {
                    // CRÍTICO: Cria e exibe a instância do modal
                    const loginModal = new bootstrap.Modal(modalElement); 
                    loginModal.show();
                } else {
                    console.error("Modal de Login não encontrado (ID: loginModal).");
                }
            };
        }
        const uidDisplay = document.getElementById('my-uid-display');
        if (uidDisplay) uidDisplay.textContent = 'Aguardando Login...';
    }
});

// =================================================================
// 3. LÓGICA DO PAINEL DE ADMIN (NOVA SEÇÃO CRÍTICA)
// =================================================================

function checkAdminAccess() {
    if (currentUserRole !== 'admin' && currentUserRole !== 'subdono') {
        alert("Acesso Negado. Você não tem permissão para esta página.");
        window.location.href = 'index.html'; // Redireciona para segurança
        return false;
    }
    return true;
}

// Configura o painel e os listeners admin
async function setupAdminPanel() {
    if (!checkAdminAccess()) return;
    
    // Atualiza o username no footer do painel
    const adminUsernameSpan = document.getElementById('adminUsername');
    if (adminUsernameSpan) adminUsernameSpan.textContent = currentUsername || 'ADM';

    // 1. Configurar Listener de Permissão
    const setPermissionBtn = document.getElementById('setPermissionBtn');
    if (setPermissionBtn) setPermissionBtn.addEventListener('click', handleSetPermission);

    // 2. Configurar Listener de Anúncios
    const deleteListingBtn = document.getElementById('deleteListingBtn');
    if (deleteListingBtn) deleteListingBtn.addEventListener('click', handleDeleteListing);
    // (Outros listeners de anúncios como aprovação seriam adicionados aqui)
    
    // 3. Configurar Listener de Alerta Global
    const saveAlertBtn = document.getElementById('saveAlertBtn');
    const removeAlertBtn = document.getElementById('removeAlertBtn');
    if (saveAlertBtn) saveAlertBtn.addEventListener('click', handleSaveGlobalAlert);
    if (removeAlertBtn) removeAlertBtn.addEventListener('click', handleRemoveGlobalAlert);
    
    // Configura o botão de Logout no Painel
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', () => {
        auth.signOut();
        window.location.href = 'index.html';
    });
    
    // Exemplo de carregamento de anúncios pendentes (Mockup)
    const pendingListings = document.getElementById('pendingListings');
    if (pendingListings) {
        pendingListings.innerHTML = `
            <li class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                <span>Anúncio FF - Denunciado</span>
                <button class="btn btn-sm btn-info">Ver ID</button>
            </li>
            <li class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                <span>Anúncio FIFA - Novo</span>
                <button class="btn btn-sm btn-info">Ver ID</button>
            </li>
        `;
    }
}

// Função para alterar permissão de usuário
async function handleSetPermission() {
    const uid = document.getElementById('uidInput').value.trim();
    const role = document.getElementById('permissionSelect').value;

    if (!uid) { alert("O campo UID não pode estar vazio."); return; }

    try {
        await db.collection('users').doc(uid).update({ role: role });
        alert(`Permissão do UID ${uid.substring(0, 8)}... alterada para ${role.toUpperCase()} com sucesso!`);
    } catch (error) {
        console.error("Erro ao mudar permissão:", error);
        alert("Falha ao atualizar a permissão. O UID está correto?");
    }
}

// Função para deletar um anúncio
async function handleDeleteListing() {
    const listingId = document.getElementById('listingIdInput').value.trim();
    if (!listingId) { alert("O ID do Anúncio não pode estar vazio."); return; }
    
    if (confirm(`Tem certeza que deseja DELETAR PERMANENTEMENTE o anúncio ${listingId}?`)) {
        try {
            await db.collection('listings').doc(listingId).delete();
            alert(`Anúncio ${listingId} excluído com sucesso.`);
        } catch (error) {
            console.error("Erro ao deletar anúncio:", error);
            alert("Falha ao deletar o anúncio. Verifique o ID.");
        }
    }
}

// Funções de Alerta Global
async function handleSaveGlobalAlert() {
    const text = document.getElementById('globalAlertText').value;
    const type = document.getElementById('alertTypeSelect').value;
    
    if (!text) { alert("A mensagem de alerta não pode estar vazia."); return; }
    
    try {
        await db.collection('settings').doc('global_alert').set({ 
            message: text, 
            type: type, 
            active: true 
        });
        alert("Alerta Global salvo e ativado com sucesso!");
    } catch (e) {
        console.error("Erro ao salvar alerta:", e);
        alert("Falha ao salvar alerta.");
    }
}

async function handleRemoveGlobalAlert() {
    if (confirm("Deseja realmente desativar e remover o Alerta Global?")) {
        try {
            await db.collection('settings').doc('global_alert').update({ active: false });
            alert("Alerta Global desativado.");
        } catch (e) {
            console.error("Erro ao remover alerta:", e);
            alert("Falha ao remover alerta.");
        }
    }
}


// ... (Adicione aqui suas funções para loadExchangeListings, createListingCard, loadInbox, etc.) ...


// =================================================================
// 8. SETUP FINAL: CHAMADAS AO CARREGAR O DOM (CORREÇÃO DE INTERAÇÃO)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Configura os botões de Login/Registro no modal
    const registerBtn = document.getElementById('registerBtn');
    const loginBtn = document.getElementById('loginBtn');
    
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    } 
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    } 

    // 2. Configura os links de categoria na index.html (CORREÇÃO CRÍTICA)
    const categoryLinks = document.querySelectorAll('.category-link');
    if (categoryLinks.length > 0) {
        categoryLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const category = e.currentTarget.getAttribute('data-category');
                
                if (category) {
                    window.location.href = `pesquisa.html?category=${encodeURIComponent(category)}`;
                }
            });
        });
    } else {
        console.log("Nenhum link de categoria encontrado. (Esperado fora do index.html)");
    }

    // 3. Se a página for o Painel de Admin, e o user estiver logado, o setupAdminPanel é chamado
    //    pelo onAuthStateChanged. O que garantimos aqui é a verificação de ID do corpo da página.
    if (document.body.id === 'admin-page') {
        console.log("Página de Admin detectada. Aguardando autenticação...");
    }
    
    // (Outros setups como loadExchangeListings, setupDonationModal e setupSearchPage vão aqui)
});

console.log("script.js carregado: Lógica de Admin e correção de interação aplicada.");

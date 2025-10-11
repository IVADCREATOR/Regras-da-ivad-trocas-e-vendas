// =================================================================
// script.js - Lógica Central do IVAD Marketplace (CORREÇÃO FINAL DE BUGS)
// =================================================================

// 1. Variáveis Globais e Inicialização do Firebase
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage(); 

let currentUserUid = null;
let currentUsername = null;
let globalChatListener = null;

const PIX_KEY = "11913429349";
const usernameCache = {};

// =================================================================
// 2. AUTENTICAÇÃO E FUNÇÕES AUXILIARES (CORREÇÃO DO BUG DO USERNAME)
// =================================================================

/**
 * Busca o nome de usuário pelo UID e usa cache.
 * CORREÇÃO: Garante um fallback seguro para evitar bugs de exibição.
 */
async function getUsernameByUid(uid) {
    if (!uid) return 'Usuário Desconhecido';
    if (usernameCache[uid]) return usernameCache[uid];
    
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            // Usa o username do documento ou um fallback
            const username = doc.data().username || `UID-${uid.substring(0, 6)}`;
            usernameCache[uid] = username;
            return username;
        } else {
            // Documento de usuário não encontrado
            return `UID-NÃO-REGIST.${uid.substring(0, 4)}`; 
        }
    } catch (e) {
        console.error("Erro ao buscar username (CORREÇÃO DE BUG):", e);
        // FALLBACK SEGURO: Retorna uma string de erro que não quebra o chat
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
    
    // Tenta fechar o modal de login se estiver aberto, para não interferir na mudança de estado
    const modalElement = document.getElementById('loginModal');
    if (modalElement) {
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) modalInstance.hide();
    }

    if (user) {
        currentUserUid = user.uid;
        // CRÍTICO: Garante que o username é buscado e setado corretamente
        currentUsername = await getUsernameByUid(user.uid); 
        
        // Atualiza a UI para estado Logado
        if (authBtn) {
            authBtn.textContent = `Olá, ${currentUsername} (Sair)`;
            authBtn.classList.remove('btn-primary', 'btn-danger');
            authBtn.classList.add('btn-success');
            // Ação de logout no clique
            authBtn.onclick = () => { 
                auth.signOut();
            }; 
        }
        // Exibe o UID no footer
        const uidDisplay = document.getElementById('my-uid-display');
        if (uidDisplay) uidDisplay.textContent = user.uid;
        
        // Se estiver na caixa de entrada, inicia o carregamento
        if (document.getElementById('inbox-list') && typeof loadInbox === 'function') {
            loadInbox();
        }
        
    } else {
        currentUserUid = null;
        currentUsername = null;
        
        // Atualiza a UI para estado Deslogado
        if (authBtn) {
            authBtn.innerHTML = '<i class="fas fa-user me-1"></i> Entrar / Cadastrar';
            authBtn.classList.add('btn-primary');
            authBtn.classList.remove('btn-success', 'btn-danger');
            
            // CORREÇÃO CRÍTICA LOGIN: Garante que o clique abre o modal
            authBtn.onclick = () => {
                const modalElement = document.getElementById('loginModal');
                if (modalElement) {
                    // CRÍTICO: Cria a instância do modal e exibe
                    const loginModal = new bootstrap.Modal(modalElement); 
                    loginModal.show();
                }
            };
        }
        // Limpa o UID no footer
        const uidDisplay = document.getElementById('my-uid-display');
        if (uidDisplay) uidDisplay.textContent = 'Aguardando Login...';
        
    }
    // Verifica se a função de contagem de não lidas existe e a executa
    if (typeof updateUnreadCount === 'function') {
        updateUnreadCount(user);
    }
});

// =================================================================
// 3. EXIBIÇÃO DE ANÚNCIOS (Mantido)
// =================================================================

function createListingCard(doc, data, vendedorName) { /* ... (Mantido) ... */ }
async function loadExchangeListings() { /* ... (Mantido) ... */ }

// ... (Resto das Seções: Funções loadGlobalChat, loadInbox, setupDonationModal, setupSearchPage, etc.) ...

// =================================================================
// 8. SETUP FINAL: CHAMADAS AO CARREGAR O DOM (CORREÇÃO DE INTERAÇÃO)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Configura os botões de Login/Registro no modal (CORREÇÃO LOGIN - Listeners no Modal)
    const registerBtn = document.getElementById('registerBtn');
    const loginBtn = document.getElementById('loginBtn');
    
    // Anexa os manipuladores de evento, garantindo a conexão
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    } 
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    } 

    // 2. Configura os links de categoria na index.html (CORREÇÃO CRÍTICA DE CATEGORIAS)
    const categoryLinks = document.querySelectorAll('.category-link');
    if (categoryLinks.length > 0) {
        categoryLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const category = e.currentTarget.getAttribute('data-category');
                
                if (category) {
                     // CRÍTICO: Redirecionamento para a página de pesquisa com o filtro
                    window.location.href = `pesquisa.html?category=${encodeURIComponent(category)}`;
                } else {
                    console.error("Link de categoria sem atributo data-category.");
                }
            });
        });
    }

    // 3. Carrega ofertas de troca na index.html
    const loadBtn = document.getElementById('loadExchangeBtn');
    if (loadBtn && typeof loadExchangeListings === 'function') {
        loadBtn.addEventListener('click', loadExchangeListings);
        loadExchangeListings(); 
    }
    
    // 4. Se a página for a de pesquisa, executa o setup
    if (document.getElementById('search-form') && typeof setupSearchPage === 'function') {
        setupSearchPage();
    }
    
    // 5. Configura o modal de doação Pix
    if (document.getElementById('donationModal') && typeof setupDonationModal === 'function') {
        setupDonationModal();
    }
});

console.log("script.js carregado: Bugs críticos de interação e username corrigidos.");

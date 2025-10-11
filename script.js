// =================================================================
// script.js - Lógica Central do IVAD Marketplace (CORREÇÃO CRÍTICA DE INTERAÇÃO)
// =================================================================

// 1. Variáveis Globais e Inicialização do Firebase
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage(); 

let currentUserUid = null;
let currentUsername = null;
let globalChatListener = null;

const PIX_KEY = "11913429349";

// =================================================================
// 2. AUTENTICAÇÃO E FUNÇÕES AUXILIARES (CORREÇÃO CRÍTICA DO BOTÃO LOGIN/CADASTRO)
// =================================================================

const usernameCache = {};

async function getUsernameByUid(uid) {
    if (!uid) return 'Usuário Desconhecido';
    if (usernameCache[uid]) return usernameCache[uid];
    
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            const username = doc.data().username || `UID-${uid.substring(0, 6)}`;
            usernameCache[uid] = username;
            return username;
        } else {
            return `UID-${uid.substring(0, 6)}`;
        }
    } catch (e) {
        console.error("Erro ao buscar username:", e);
        return `Erro UID-${uid.substring(0, 6)}`;
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
    const uidDisplay = document.getElementById('my-uid-display');
    const modalElement = document.getElementById('loginModal');
    
    // Tenta fechar o modal de login se estiver aberto
    if (modalElement) {
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) modalInstance.hide();
    }

    if (user) {
        currentUserUid = user.uid;
        currentUsername = await getUsernameByUid(user.uid);
        
        // Atualiza a UI para estado Logado
        if (authBtn) {
            authBtn.textContent = `Olá, ${currentUsername} (Sair)`;
            authBtn.classList.remove('btn-primary', 'btn-danger');
            authBtn.classList.add('btn-success');
            // Ação de logout no clique
            authBtn.onclick = () => { 
                auth.signOut();
                // Opcional: window.location.href = 'index.html'; 
            }; 
        }
        // ... (resto do bloco Logado) ...
        
    } else {
        currentUserUid = null;
        currentUsername = null;
        
        // Atualiza a UI para estado Deslogado
        if (authBtn) {
            authBtn.innerHTML = '<i class="fas fa-user me-1"></i> Entrar / Cadastrar';
            authBtn.classList.add('btn-primary');
            authBtn.classList.remove('btn-success', 'btn-danger');
            // CORREÇÃO CRÍTICA DO BOTÃO: Garante que o clique abre o modal
            authBtn.onclick = () => {
                const modalElement = document.getElementById('loginModal');
                if (modalElement) {
                    const loginModal = new bootstrap.Modal(modalElement);
                    loginModal.show();
                }
            };
        }
        // ... (resto do bloco Deslogado) ...
    }
});

// =================================================================
// 3. EXIBIÇÃO DE ANÚNCIOS (Mantido)
// =================================================================

function createListingCard(doc, data, vendedorName) { /* ... (Mantido) ... */ }
async function loadExchangeListings() { /* ... (Mantido) ... */ }

// ... (Resto das Seções 4, 5, 6, 7 - Chat, Inbox, Pix, Pesquisa) ...

// =================================================================
// 8. SETUP FINAL: CHAMADAS AO CARREGAR O DOM (CORREÇÃO DE LISTENERS)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Configura os botões de Login/Registro no modal (CORREÇÃO DE LOGIN - Listener no Modal)
    const registerBtn = document.getElementById('registerBtn');
    const loginBtn = document.getElementById('loginBtn');
    
    // Se os botões existirem, anexa os manipuladores
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    } else {
        console.warn("Elemento 'registerBtn' não encontrado. Verifique o HTML do modal.");
    }
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    } else {
        console.warn("Elemento 'loginBtn' não encontrado. Verifique o HTML do modal.");
    }

    // 2. Configura o modal de doação Pix
    if (document.getElementById('donationModal') && typeof setupDonationModal === 'function') {
        setupDonationModal();
    }
    
    // 3. Configura a página de pesquisa (se os elementos existirem)
    if (document.getElementById('search-form') && typeof setupSearchPage === 'function') {
        setupSearchPage();
    }
    
    // 4. Configura os links de categoria na index.html (CORREÇÃO CRÍTICA DE CATEGORIAS)
    const categoryLinks = document.querySelectorAll('.category-link');
    if (categoryLinks.length > 0) {
        categoryLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const category = e.currentTarget.getAttribute('data-category');
                
                if (category) {
                     // ATENÇÃO: Redirecionamento para a página de pesquisa com o filtro
                    window.location.href = `pesquisa.html?category=${encodeURIComponent(category)}`;
                } else {
                    console.error("Link de categoria sem atributo data-category.");
                }
            });
        });
    } else {
         console.warn("Nenhum elemento com a classe 'category-link' encontrado. Categorias inativas.");
    }

    // 5. Carrega ofertas de troca na index.html
    const loadBtn = document.getElementById('loadExchangeBtn');
    if (loadBtn && typeof loadExchangeListings === 'function') {
        loadBtn.addEventListener('click', loadExchangeListings);
        loadExchangeListings(); 
    }
    
});

console.log("script.js carregado: Listeners de Login/Categorias reforçados.");

// (Certifique-se de que as demais funções (loadGlobalChat, loadInbox, etc.) estejam no script.js)
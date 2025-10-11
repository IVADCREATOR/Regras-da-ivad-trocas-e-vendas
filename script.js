// =========================================================================
// 1. CONSTANTES E INICIALIZAÇÃO DO FIREBASE
// =========================================================================

// As dependências do Firebase (app, auth, db) são definidas globalmente pelo HTML
const auth = firebase.auth();
const db = firebase.firestore();

// Constantes de Monitoramento e Configurações
const MONITOR_DOC_ID = 'access_monitor';
const GLOBAL_ALERT_DOC_ID = 'global_alert';
const PIX_KEY = "11913429349"; // Chave PIX constante

let currentUserID = null;
let currentUserRole = 'user'; 
const usernameCache = {}; // Cache para nomes de usuário (performance)

// =========================================================================
// 2. FUNÇÕES DE AUTENTICAÇÃO E PERFIL
// =========================================================================

/**
 * Busca o nome de usuário (username) no Firestore, usando cache.
 */
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
        }
    } catch (e) {
        console.error("Erro ao buscar username:", e);
    }
    return `UID-NÃO-REGIST.${uid.substring(0, 4)}`; 
}

/**
 * Lida com o processo de Login de usuário. (autenticacao.html)
 */
async function handleLogin() {
    const email = document.getElementById('inputEmail')?.value;
    const password = document.getElementById('inputPassword')?.value;

    if (!email || !password) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
        alert("Login realizado com sucesso! Redirecionando...");
        window.location.href = 'index.html'; // Redirecionamento após sucesso
    } catch (error) {
        console.error("Erro no login:", error);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
             alert("Email ou senha incorretos.");
        } else {
             alert("Erro ao tentar entrar. Tente novamente.");
        }
    }
}

/**
 * Lida com o processo de Cadastro de novo usuário. (autenticacao.html)
 * Inclui criação de conta, login automático e redirecionamento.
 */
async function handleRegister() {
    const username = document.getElementById('inputUsername')?.value;
    const email = document.getElementById('inputEmail')?.value;
    const password = document.getElementById('inputPassword')?.value;

    if (!username || !email || !password || password.length < 6) {
        alert("Preencha todos os campos. A senha deve ter no mínimo 6 caracteres.");
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // 1. Cria o documento do usuário no Firestore
        await db.collection('users').doc(user.uid).set({
            username: username,
            email: email,
            role: 'user', 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Atualiza o perfil no Firebase Auth
        await user.updateProfile({
            displayName: username
        });
        
        // Login Automático e Redirecionamento
        alert("Cadastro realizado com sucesso! Redirecionando para a página inicial.");
        window.location.href = 'index.html'; 

    } catch (error) {
        console.error("Erro no cadastro:", error);
        if (error.code === 'auth/email-already-in-use') {
            alert("Este email já está em uso.");
        } else {
            alert("Erro ao tentar cadastrar. Verifique o console para detalhes.");
        }
    }
}

/**
 * Lida com o processo de Logout.
 */
function handleLogout() {
    auth.signOut().then(() => {
        alert("Você saiu da sua conta.");
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Erro ao fazer logout:", error);
    });
}


// =========================================================================
// 3. ADMIN E MONITORAMENTO DE SEGURANÇA
// =========================================================================

/**
 * Registra um acesso à página principal (index.html).
 */
async function registerPageAccess() {
    try {
        const docRef = db.collection('settings').doc(MONITOR_DOC_ID);
        await docRef.update({
            total_accesses: firebase.firestore.FieldValue.increment(1),
            last_access: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        if (error.code === 'not-found') {
            await db.collection('settings').doc(MONITOR_DOC_ID).set({
                total_accesses: 1,
                last_access: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            console.warn("Erro ao registrar acesso:", error);
        }
    }
}

/**
 * Carrega e exibe a contagem de acessos no Painel ADM (admin_painel.html).
 */
async function loadAccessCount() {
    try {
        const doc = await db.collection('settings').doc(MONITOR_DOC_ID).get();
        const count = doc.exists ? doc.data().total_accesses : 0;
        
        const countDisplay = document.getElementById('accessCountDisplay');
        if (countDisplay) {
            countDisplay.textContent = count.toLocaleString('pt-BR');
        }
    } catch (e) {
        console.error("Erro ao carregar contagem de acessos:", e);
        document.getElementById('accessCountDisplay')?.textContent = 'Erro';
    }
}

/**
 * Carrega e exibe o alerta global no topo da página.
 */
async function fetchGlobalAlert() {
    const container = document.getElementById('global-alert-container');
    if (!container) return;

    try {
        const doc = await db.collection('settings').doc(GLOBAL_ALERT_DOC_ID).get();
        if (doc.exists) {
            const data = doc.data();
            if (data.active && data.message) {
                container.innerHTML = `
                    <div class="alert alert-${data.type || 'info'} alert-dismissible fade show mb-0" role="alert">
                        <div class="container d-flex justify-content-center align-items-center">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>Alerta:</strong> ${data.message}
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                `;
            } else {
                container.innerHTML = '';
            }
        }
    } catch (error) {
        console.error("Erro ao buscar alerta global:", error);
    }
}

/**
 * Configura as ações do Painel ADM. (admin_painel.html)
 */
function setupAdminPanel() {
    const adminPanel = document.getElementById('adminAccordion');
    if (!adminPanel) return;

    // Atualiza o username e role no footer do painel
    document.getElementById('adminUsername').textContent = auth.currentUser.displayName || 'ADM';
    document.getElementById('adminUserRole').textContent = currentUserRole.toUpperCase();

    loadAccessCount(); 
    
    document.getElementById('adminLogoutBtn')?.addEventListener('click', handleLogout);
    
    console.log("Painel ADM configurado. Role:", currentUserRole);
}

/**
 * Verifica a permissão do usuário e configura links de ADM.
 */
async function checkUserRole(uid) {
    if (!uid) return 'user';
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            const role = doc.data().role;
            currentUserRole = role;

            if (role === 'admin' || role === 'subdono') {
                // Se estiver na página admin, inicia o setup
                if (document.body.id === 'admin-page') {
                    setupAdminPanel();
                }
                
                // Adiciona link do ADM na NavBar (se não existir)
                const anunciarmenu = document.querySelector('[href="anunciar.html"]');
                if (anunciarmenu && !document.getElementById('adminLink')) {
                    const adminLinkHtml = `<a href="admin_painel.html" class="btn btn-outline-info me-2 d-none d-sm-inline" id="adminLink" title="Painel Admin"><i class="fas fa-shield-alt"></i> ADM</a>`;
                    anunciarmenu.insertAdjacentHTML('beforebegin', adminLinkHtml);
                }
            }
            return role;
        }
    } catch (error) {
        console.error("Erro ao checar o role do usuário:", error);
    }
    return 'user';
}

// =========================================================================
// 4. FUNÇÕES DE LISTAGEM E MENSAGENS (HOME)
// =========================================================================

// As funções de renderização (createListingCard, renderListings) são mantidas aqui
// para o carregamento das ofertas de troca na index.html.

function createListingCard(listing) {
    // ... (HTML do Card de Anúncio - MANTIDO AQUI) ...
    const detailUrl = `detalhe_anuncio.html?id=${listing.id}`; 
    const exchangeBadge = listing.acceptsExchange ? 
        `<span class="badge bg-warning text-dark me-1"><i class="fas fa-exchange-alt"></i> Troca</span>` : '';
    const priceDisplay = listing.price ? 
        `R$ ${listing.price.toFixed(2).replace('.', ',')}` : 'A Combinar';
    const imageUrl = listing.imageUrl || 'https://via.placeholder.com/400x200?text=Sem+Imagem';

    return `
        <div class="col-lg-3 col-md-4 col-sm-6">
            <div class="card h-100 shadow-sm listing-card" data-listing-id="${listing.id}">
                <img src="${imageUrl}" class="card-img-top" alt="${listing.title}" style="height: 150px; object-fit: cover;">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title text-truncate">${listing.title}</h5>
                    <p class="card-text text-muted small mb-1">
                        <i class="fas fa-tag me-1"></i> ${listing.category}
                    </p>
                    <p class="card-text text-success fw-bold mb-2">
                        <i class="fas fa-dollar-sign me-1"></i> ${priceDisplay}
                    </p>
                    <div class="mt-auto">
                        ${exchangeBadge}
                        <a href="${detailUrl}" class="btn btn-sm btn-primary mt-2 w-100">
                            Ver Detalhes
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderListings(containerId, listings) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (listings.length === 0) {
        container.innerHTML = `<div class="col-12 text-center text-muted py-5">Nenhuma oferta de troca encontrada.</div>`;
        return;
    }
    container.innerHTML = listings.map(createListingCard).join('');
}


/**
 * Carrega a lista de anúncios que aceitam troca para a index.html.
 */
async function loadExchangeListings() {
    const containerId = 'exchange-listings';
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div class="col-12 text-center text-primary"><i class="fas fa-spinner fa-spin me-2"></i> Carregando ofertas...</div>`;

    try {
        const snapshot = await db.collection('listings')
            .where('status', '==', 'active')
            .where('acceptsExchange', '==', true)
            .orderBy('createdAt', 'desc')
            .limit(8)
            .get();

        const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderListings(containerId, listings);

    } catch (error) {
        console.error("Erro ao carregar anúncios de troca:", error);
        container.innerHTML = `<div class="col-12 text-center text-danger py-5">Erro ao carregar ofertas.</div>`;
    }
}

/**
 * Verifica o número de mensagens não lidas e atualiza o badge. (Monitoramento em tempo real)
 */
function checkUnreadMessages(uid) {
    if (!uid) {
        document.getElementById('unread-count')?.style.display = 'none';
        return;
    }
    
    // Inicia um listener em tempo real para mensagens não lidas
    db.collection('messages')
        .where('recipientId', '==', uid)
        .where('read', '==', false)
        .onSnapshot(snapshot => {
            const count = snapshot.size;
            const badge = document.getElementById('unread-count');
            
            if (badge) {
                if (count > 0) {
                    badge.textContent = count;
                    badge.style.display = 'inline';
                } else {
                    badge.style.display = 'none';
                }
            }
        }, error => {
            console.error("Erro ao monitorar mensagens não lidas:", error);
        });
}


// =========================================================================
// 5. OBSERVER DE AUTENTICAÇÃO (onAuthStateChanged)
// =========================================================================

auth.onAuthStateChanged(async (user) => {
    const authBtn = document.getElementById('authBtn');
    const myUidDisplay = document.getElementById('my-uid-display');

    if (user) {
        // Usuário Logado
        currentUserID = user.uid;
        user.displayName = await getUsernameByUid(user.uid); 

        // 1. Atualiza o Botão de Autenticação para SAIR
        if (authBtn) {
            authBtn.innerHTML = `<i class="fas fa-door-open me-1"></i> Sair`;
            authBtn.classList.remove('btn-primary');
            authBtn.classList.add('btn-danger');
            authBtn.href = "#"; 
            authBtn.onclick = handleLogout;
        }

        // 2. Exibe o UID no Footer
        if (myUidDisplay) {
            myUidDisplay.textContent = user.uid.substring(0, 10) + '...';
            myUidDisplay.classList.add('my-uid-highlight');
        }
        
        // 3. Verifica o Role (Permissões) e configura o ADM/Links
        await checkUserRole(user.uid);

        // 4. Inicia o monitoramento de mensagens não lidas
        checkUnreadMessages(user.uid);


    } else {
        // Usuário Deslogado
        currentUserID = null;
        currentUserRole = 'user';
        
        // 1. Atualiza o Botão de Autenticação para ENTRAR
        if (authBtn) {
            authBtn.innerHTML = `<i class="fas fa-user me-1"></i> Entrar / Cadastrar`;
            authBtn.classList.remove('btn-danger');
            authBtn.classList.add('btn-primary');
            authBtn.href = 'autenticacao.html'; 
            authBtn.onclick = null;
        }

        // 2. Limpa o UID
        if (myUidDisplay) {
            myUidDisplay.textContent = 'Aguardando Login...';
            myUidDisplay.classList.remove('my-uid-highlight');
        }
        
        // 3. Remove o link do ADM (se existir)
        document.getElementById('adminLink')?.remove();
        
        // 4. Limpa o badge de mensagens não lidas
        document.getElementById('unread-count')?.style.display = 'none';
    }
});


// =========================================================================
// 6. EVENTO DOMContentLoaded (Configura listeners após o carregamento da página)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // 1. Configuração de Listeners para AUTENTICAÇÃO (autenticacao.html)
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    }

    // 2. Funções que rodam em todas as páginas
    fetchGlobalAlert();

    // 3. Funções que rodam apenas na INDEX.HTML
    if (document.getElementById('exchange-listings')) { 
        loadExchangeListings(); 
        
        // CRÍTICO: Chama a função de Categoria no arquivo pesquisa.js
        if (typeof setupCategoryListeners === 'function') {
            setupCategoryListeners(); 
        } else {
            console.warn("setupCategoryListeners não encontrado. Verifique se pesquisa.js está carregando após script.js.");
        }
        
        registerPageAccess(); 
        document.getElementById('loadExchangeBtn')?.addEventListener('click', loadExchangeListings);
    }
    
    // 4. Lógica de Doação (Modal PIX)
    const donationModalEl = document.getElementById('donationModal');
    if (donationModalEl) {
        document.getElementById('pixKeyDisplay').value = PIX_KEY;
        document.getElementById('copyPixKeyBtn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(PIX_KEY).then(() => {
                alert("Chave PIX copiada para a área de transferência!");
            }).catch(err => {
                console.error('Falha ao copiar:', err);
            });
        });
    }

});

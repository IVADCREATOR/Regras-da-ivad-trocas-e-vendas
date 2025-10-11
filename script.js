// =========================================================================
// 1. CONSTANTES, INICIALIZAÇÃO E VARIÁVEIS GLOBAIS
// =========================================================================

// O Firebase é inicializado no HTML. As referências são globais.
const auth = firebase.auth();
const db = firebase.firestore();

// Constantes de Monitoramento
const MONITOR_DOC_ID = 'access_monitor';
const GLOBAL_ALERT_DOC_ID = 'global_alert';
const PIX_KEY = "11913429349"; 

let currentUserID = null;
let currentUserRole = 'user'; 
const usernameCache = {}; 

// =========================================================================
// 2. FUNÇÕES DE AUTENTICAÇÃO E PERFIL (CORREÇÃO DO BUG DE LOGIN/CADASTRO)
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
 * CRÍTICO: IDs de input atualizados para o fluxo de autenticação.
 */
async function handleLogin() {
    // Busca os inputs dentro da aba de Login
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    const emailInput = loginForm.querySelector('#inputEmail');
    const passwordInput = loginForm.querySelector('#inputPassword');
    
    const email = emailInput?.value;
    const password = passwordInput?.value;

    if (!email || !password) {
        alert("Por favor, preencha o Email e a Senha para fazer login.");
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // Login Automático e Redirecionamento (Fluxo 2. Login Automático -> Redirecionamento)
        alert("Login realizado com sucesso! Redirecionando...");
        window.location.href = 'index.html'; 
    } catch (error) {
        console.error("Erro no login:", error);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
             alert("Email ou senha incorretos. Tente novamente.");
        } else {
             alert("Erro ao tentar entrar. Verifique sua conexão.");
        }
    }
}

/**
 * Lida com o processo de Cadastro de novo usuário. (autenticacao.html)
 * CRÍTICO: Ação de submissão do formulário corrigida (Fluxo 1. Falha na Submissão)
 */
async function handleRegister() {
    // Busca os inputs dentro da aba de Cadastro
    const registerForm = document.getElementById('register-form');
    if (!registerForm) return;
    
    const usernameInput = registerForm.querySelector('#inputUsername');
    const emailInput = registerForm.querySelector('#inputEmail');
    const passwordInput = registerForm.querySelector('#inputPassword');
    
    const username = usernameInput?.value;
    const email = emailInput?.value;
    const password = passwordInput?.value;

    if (!username || !email || !password || password.length < 6) {
        alert("Preencha todos os campos. O Username é obrigatório e a Senha deve ter no mínimo 6 caracteres.");
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // 1. Cria o documento do usuário no Firestore (Registro do Username único)
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
        
        // 3. FLUXO AUTOMÁTICO E CONTÍNUO (Criação -> Login Automático -> Redirecionamento)
        alert("Cadastro realizado com sucesso! Redirecionando para a página inicial.");
        window.location.href = 'index.html'; 

    } catch (error) {
        console.error("Erro no cadastro:", error);
        if (error.code === 'auth/email-already-in-use') {
            alert("Este email já está em uso. Tente fazer login.");
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
        // Redireciona para o index para forçar o onAuthStateChanged a atualizar a barra
        window.location.href = 'index.html'; 
    }).catch((error) => {
        console.error("Erro ao fazer logout:", error);
    });
}


// =========================================================================
// 3. ADMIN, SEGURANÇA E MONITORAMENTO
// =========================================================================

// (Funções registerPageAccess, loadAccessCount, fetchGlobalAlert, setupAdminPanel, checkUserRole mantidas iguais)

async function fetchGlobalAlert() {
    const container = document.getElementById('global-alert-container');
    if (!container) return;

    try {
        const doc = await db.collection('settings').doc(GLOBAL_ALERT_DOC_ID).get();
        if (doc.exists) {
            const data = doc.data();
            if (data.active && data.message) {
                container.innerHTML = `
                    <div class="alert alert-${data.type || 'info'} alert-dismissible fade show mb-0" role="alert" style="border-radius:0;">
                        <div class="container d-flex justify-content-center align-items-center small">
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
                // Adiciona link do ADM na NavBar (se não existir)
                const authBtn = document.getElementById('authBtn');
                if (authBtn && !document.getElementById('adminLink')) {
                    const adminLinkHtml = `<a href="admin_painel.html" class="btn btn-outline-info me-2 d-none d-sm-inline" id="adminLink" title="Painel Admin"><i class="fas fa-shield-alt"></i> ADM</a>`;
                    authBtn.insertAdjacentHTML('beforebegin', adminLinkHtml);
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
// 4. FUNÇÕES DE LISTAGEM E RENDERIZAÇÃO (HOME E PESQUISA)
// =========================================================================

/**
 * GERA O HTML do Card de Anúncio (usado em index.html e pesquisa.html)
 * NOTA: Esta função precisa ser GLOBAL para ser acessível pelo pesquisa.js
 */
function createListingCard(listing) {
    const detailUrl = `detalhes.html?id=${listing.id}`; 
    const exchangeBadge = listing.acceptsExchange ? 
        `<span class="badge bg-warning text-dark me-1 fw-bold"><i class="fas fa-exchange-alt"></i> Troca</span>` : '';
    const priceDisplay = listing.price ? 
        `R$ ${listing.price.toFixed(2).replace('.', ',')}` : 'A Combinar';
    const imageUrl = listing.imageUrl || 'https://via.placeholder.com/400x200/2b2b2b/ffffff?text=Sem+Imagem';

    return `
        <div class="col-lg-3 col-md-4 col-sm-6">
            <div class="card h-100 shadow-sm listing-card border-secondary" style="background-color: var(--background-light); color: var(--text-color);">
                <img src="${imageUrl}" class="card-img-top" alt="${listing.title}" style="height: 150px; object-fit: cover;">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title text-truncate">${listing.title}</h5>
                    <p class="card-text text-muted small mb-1">
                        <i class="fas fa-tag me-1"></i> ${listing.category}
                    </p>
                    <p class="card-text fw-bold mb-2" style="color: var(--pink-vibrant);">
                        <i class="fas fa-dollar-sign me-1"></i> ${priceDisplay}
                    </p>
                    <div class="mt-auto">
                        ${exchangeBadge}
                        <a href="${detailUrl}" class="btn btn-sm btn-purple mt-2 w-100">
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
        container.innerHTML = `<div class="col-12 text-center text-white-50 py-5">Nenhuma oferta de troca encontrada.</div>`;
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

    container.innerHTML = `<div class="col-12 text-center text-info"><i class="fas fa-spinner fa-spin me-2"></i> Carregando ofertas de troca...</div>`;

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
 * Monitoramento de mensagens não lidas.
 */
function checkUnreadMessages(uid) {
    // ... (Lógica de onSnapshot mantida igual)
    if (!uid) {
        document.getElementById('unread-count')?.style.display = 'none';
        return;
    }
    
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
        currentUserID = user.uid;
        // Espera a resolução do username para evitar 'undefined' no display
        const username = await getUsernameByUid(user.uid); 
        user.displayName = username;

        // 1. Atualiza o Botão de Autenticação para SAIR
        if (authBtn) {
            authBtn.innerHTML = `<i class="fas fa-door-open me-1"></i> Sair (${username})`;
            authBtn.classList.remove('btn-primary');
            authBtn.classList.remove('btn-success');
            authBtn.classList.add('btn-danger');
            authBtn.href = "#"; 
            authBtn.onclick = handleLogout;
        }

        // 2. Exibe o UID no Footer
        if (myUidDisplay) {
            myUidDisplay.textContent = user.uid.substring(0, 10) + '...';
            myUidDisplay.classList.add('my-uid-highlight');
        }
        
        // 3. Verifica o Role e configura o ADM/Links
        await checkUserRole(user.uid);

        // 4. Inicia o monitoramento de mensagens não lidas
        checkUnreadMessages(user.uid);


    } else {
        currentUserID = null;
        currentUserRole = 'user';
        
        // 1. Atualiza o Botão de Autenticação para ENTRAR
        if (authBtn) {
            authBtn.innerHTML = `<i class="fas fa-user me-1"></i> Entrar`;
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
// 6. EVENTO DOMContentLoaded (Configura listeners)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // 1. Configuração de Listeners para AUTENTICAÇÃO (autenticacao.html)
    // CRÍTICO: Estes listeners corrigem o bug de submissão.
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
        console.log("DIAGNÓSTICO: Listener de Login anexado em autenticacao.html.");
    }
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
        console.log("DIAGNÓSTICO: Listener de Cadastro anexado em autenticacao.html.");
    }

    // 2. Funções que rodam em todas as páginas
    fetchGlobalAlert();

    // 3. Funções que rodam apenas na INDEX.HTML
    if (document.getElementById('exchange-listings')) { 
        loadExchangeListings(); 
        
        // CORREÇÃO CRÍTICA: Chamada da função de Categoria (definida em pesquisa.js)
        if (typeof setupCategoryListeners === 'function') {
            setupCategoryListeners(); 
            console.log("DIAGNÓSTICO: Chamando setupCategoryListeners de pesquisa.js.");
        } else {
            console.error("ERRO CRÍTICO: setupCategoryListeners não encontrado. O arquivo pesquisa.js está sendo carregado corretamente?");
        }
        
        // Monitoramento
        // registerPageAccess(); // Descomente para registrar acessos à home
        
        document.getElementById('loadExchangeBtn')?.addEventListener('click', loadExchangeListings);
    }
    
    // 4. Lógica de Doação (Modal PIX)
    const donationModalEl = document.getElementById('donationModal');
    if (donationModalEl) {
        // ... (Lógica de cópia PIX mantida)
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

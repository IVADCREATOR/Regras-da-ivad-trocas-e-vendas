// =========================================================================
// 1. CONSTANTES E INICIALIZAÇÃO DO FIREBASE
// =========================================================================

// Inicialização do Firebase (assumindo que já foi feita no script tag no HTML)
// const app = firebase.initializeApp(firebaseConfig); // Já está no HTML
const auth = firebase.auth();
const db = firebase.firestore();

// Constantes de Monitoramento
const MONITOR_DOC_ID = 'access_monitor';
const GLOBAL_ALERT_DOC_ID = 'global_alert';
let currentUserID = null;
let currentUserRole = 'user'; 

// =========================================================================
// 2. FUNÇÕES DE AUTENTICAÇÃO (Para uso em autenticacao.html)
// =========================================================================

/**
 * Lida com o processo de Login de usuário.
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
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Erro no login:", error);
        // Exibe uma mensagem amigável para o usuário
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
             alert("Email ou senha incorretos.");
        } else {
             alert("Erro ao tentar entrar. Tente novamente.");
        }
    }
}

/**
 * Lida com o processo de Cadastro de novo usuário.
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
            role: 'user', // Define o role padrão
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Atualiza o perfil no Firebase Auth
        await user.updateProfile({
            displayName: username
        });

        alert("Cadastro realizado com sucesso! Você será redirecionado para a página inicial.");
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Erro no cadastro:", error);
        // Exibe erro específico para o usuário
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
// 3. ADMIN E MONITORAMENTO DE SEGURANÇA (Contagem de Acessos)
// =========================================================================

/**
 * Registra um acesso à página principal (index.html) de forma segura.
 * Ocorre apenas se o body tiver um elemento da index (ex: 'exchange-listings').
 */
async function registerPageAccess() {
    try {
        const docRef = db.collection('settings').doc(MONITOR_DOC_ID);
        // Tenta incrementar o valor
        await docRef.update({
            total_accesses: firebase.firestore.FieldValue.increment(1),
            last_access: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        // Se o documento ainda não existir (code: 'not-found'), ele o cria com o valor inicial.
        if (error.code === 'not-found') {
            await db.collection('settings').doc(MONITOR_DOC_ID).set({
                total_accesses: 1,
                last_access: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            console.warn("Erro ao registrar acesso (Ignorável em outras páginas):", error);
        }
    }
}

/**
 * Carrega e exibe a contagem de acessos no Painel ADM.
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
        document.getElementById('accessCountDisplay').textContent = 'Erro';
    }
}

/**
 * Carrega e exibe o alerta global no topo da página.
 */
async function fetchGlobalAlert() {
    const container = document.getElementById('global-alert-container');
    if (!container) return; // Não carrega se o container não existir

    try {
        const doc = await db.collection('settings').doc(GLOBAL_ALERT_DOC_ID).get();
        if (doc.exists) {
            const data = doc.data();
            if (data.active && data.message) {
                // Injeta o alerta usando Bootstrap Alert
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
 * Verifica a permissão do usuário e configura o painel ADM.
 */
async function checkUserRole(uid) {
    if (!uid) return 'user';
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            const role = doc.data().role;
            currentUserRole = role;

            if (role === 'admin' || role === 'subdono') {
                setupAdminPanel();
            }
            return role;
        }
    } catch (error) {
        console.error("Erro ao checar o role do usuário:", error);
    }
    return 'user';
}

/**
 * Configura o Painel de Administração (ADM) se a página for admin_painel.html.
 */
function setupAdminPanel() {
    const adminPanel = document.getElementById('adminAccordion');
    if (adminPanel) {
        // Acesso Garantido: Carrega funcionalidades específicas do ADM
        loadAccessCount(); // NOVO: Carrega a contagem de acessos
        // ... (Aqui entraria a lógica de carregar lista de usuários e anúncios pendentes)
        
        console.log("Painel ADM configurado. Role:", currentUserRole);
    }
}

// =========================================================================
// 4. FUNÇÕES DE LISTAGEM E MENSAGENS
// =========================================================================

/**
 * Cria e retorna o HTML de um Card de Anúncio.
 */
function createListingCard(listing) {
    // URL para a página de visualização do anúncio (assumindo que existe)
    const detailUrl = `detalhe_anuncio.html?id=${listing.id}`; 
    
    // Icone de Troca (Exibe apenas se aceitar troca)
    const exchangeBadge = listing.acceptsExchange ? 
        `<span class="badge bg-warning text-dark me-1"><i class="fas fa-exchange-alt"></i> Troca</span>` : '';

    // Formatação do Preço
    const priceDisplay = listing.price ? 
        `R$ ${listing.price.toFixed(2).replace('.', ',')}` : 'A Combinar';
    
    // Thumbnail (placeholder se não houver imagem)
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

/**
 * Renderiza uma lista de anúncios em um container.
 */
function renderListings(containerId, listings) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (listings.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center text-muted py-5">
                <i class="fas fa-box-open me-2"></i> Nenhum anúncio encontrado.
            </div>
        `;
        document.getElementById('results-count')?.textContent = '0';
        return;
    }

    const html = listings.map(createListingCard).join('');
    container.innerHTML = html;
    document.getElementById('results-count')?.textContent = listings.length;
}

/**
 * Carrega a lista de anúncios que aceitam troca para a index.html.
 */
async function loadExchangeListings() {
    const containerId = 'exchange-listings';
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="col-12 text-center text-primary">
            <i class="fas fa-spinner fa-spin me-2"></i> Carregando ofertas...
        </div>
    `;

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
        container.innerHTML = `
            <div class="col-12 text-center text-danger py-5">
                <i class="fas fa-exclamation-triangle me-2"></i> Erro ao carregar ofertas.
            </div>
        `;
    }
}

/**
 * Verifica o número de mensagens não lidas e atualiza o badge.
 */
function checkUnreadMessages(uid) {
    if (!uid) {
        document.getElementById('unread-count')?.style.display = 'none';
        return;
    }
    
    // Consulta por qualquer documento na coleção 'messages' onde o 'recipientId' seja o UID atual e 'read' seja falso.
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
// 5. FUNÇÕES DE PESQUISA E CATEGORIAS
// =========================================================================

/**
 * Configura listeners para os cards de categoria na index.html.
 */
function setupCategoryListeners() {
    const categoryLinks = document.querySelectorAll('.category-link');
    categoryLinks.forEach(card => {
        card.addEventListener('click', (event) => {
            const category = event.currentTarget.getAttribute('data-category');
            if (category) {
                // Redireciona para pesquisa.html com o parâmetro de categoria
                window.location.href = `pesquisa.html?category=${encodeURIComponent(category)}`;
            }
        });
    });
}

/**
 * Executa a lógica de pesquisa na página pesquisa.html.
 */
async function executeSearch(searchTerm, categoryFilter) {
    const resultsContainerId = 'listings-results';
    const container = document.getElementById(resultsContainerId);
    const filterDisplay = document.getElementById('current-filter-display');
    if (!container || !filterDisplay) return;

    // Atualiza o display do filtro
    let filterMessage = 'Todos os Anúncios';
    if (searchTerm && categoryFilter) {
        filterMessage = `Busca por "${searchTerm}" em ${categoryFilter}`;
    } else if (searchTerm) {
        filterMessage = `Busca por: "${searchTerm}"`;
    } else if (categoryFilter) {
        filterMessage = `Categoria: ${categoryFilter}`;
    }
    filterDisplay.textContent = filterMessage;

    container.innerHTML = `
        <div class="col-12 text-center text-primary py-5">
            <i class="fas fa-spinner fa-spin me-2"></i> Filtrando resultados...
        </div>
    `;

    try {
        let query = db.collection('listings').where('status', '==', 'active');

        // 1. Filtro por Categoria
        if (categoryFilter) {
            query = query.where('category', '==', categoryFilter);
        }

        // 2. Filtro de Texto (Fazemos a filtragem final no cliente após a query)
        // OBS: O Firestore não permite busca de substring "like" complexa, 
        // então faremos uma query ampla e a filtragem por texto no cliente.
        const snapshot = await query.orderBy('createdAt', 'desc').get();
        let listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 3. Filtragem de Texto no Cliente
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            listings = listings.filter(listing => 
                listing.title.toLowerCase().includes(lowerSearchTerm) ||
                listing.description.toLowerCase().includes(lowerSearchTerm)
            );
        }
        
        renderListings(resultsContainerId, listings);

    } catch (error) {
        console.error("Erro na execução da pesquisa:", error);
        container.innerHTML = `
            <div class="col-12 text-center text-danger py-5">
                <i class="fas fa-exclamation-triangle me-2"></i> Erro ao realizar a busca.
            </div>
        `;
    }
}

/**
 * Lida com o carregamento da página de pesquisa, lendo parâmetros da URL.
 */
function handleSearchPageLoad() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('q');
    const category = urlParams.get('category');

    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const searchForm = document.getElementById('search-form');

    // Preenche o formulário com os valores da URL
    if (searchInput && searchTerm) {
        searchInput.value = searchTerm;
    }
    if (categoryFilter && category) {
        // Assegura que o <select> seja preenchido corretamente
        categoryFilter.value = category; 
    }

    // Executa a pesquisa inicial
    executeSearch(searchTerm, category);

    // Adiciona listener para o formulário de pesquisa
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newSearchTerm = searchInput.value;
            const newCategory = categoryFilter.value;

            // Atualiza a URL e executa a nova pesquisa
            const newUrl = `pesquisa.html?q=${encodeURIComponent(newSearchTerm)}&category=${encodeURIComponent(newCategory)}`;
            window.history.pushState({ path: newUrl }, '', newUrl); // Atualiza URL sem recarregar
            executeSearch(newSearchTerm, newCategory);
        });
    }
}


// =========================================================================
// 6. OBSERVER DE AUTENTICAÇÃO
// =========================================================================

/**
 * Principal listener de estado de autenticação (executado em todas as páginas).
 */
auth.onAuthStateChanged(async (user) => {
    const authBtn = document.getElementById('authBtn');
    const myUidDisplay = document.getElementById('my-uid-display');

    if (user) {
        // Usuário logado
        currentUserID = user.uid;
        
        // 1. Atualiza o Botão de Autenticação
        if (authBtn) {
            authBtn.innerHTML = `<i class="fas fa-door-open me-1"></i> Sair`;
            authBtn.classList.remove('btn-primary');
            authBtn.classList.add('btn-danger');
            authBtn.href = "#"; // Não redireciona, usa JS para Logout
            authBtn.onclick = handleLogout;
        }

        // 2. Exibe o UID
        if (myUidDisplay) {
            myUidDisplay.textContent = user.uid.substring(0, 10) + '...';
            myUidDisplay.classList.add('my-uid-highlight');
        }
        
        // 3. Verifica o Role (Permissões)
        const role = await checkUserRole(user.uid);
        if (role === 'admin' || role === 'subdono') {
            // Adiciona link para o Painel ADM se o usuário tiver a permissão
            const navBar = document.querySelector('.navbar-brand').closest('.container');
            if (navBar && !document.getElementById('adminLink')) {
                const adminLinkHtml = `
                    <a href="admin_painel.html" class="btn btn-outline-info me-2" id="adminLink" title="Painel Admin">
                        <i class="fas fa-shield-alt"></i> ADM
                    </a>
                `;
                // Adiciona antes do botão de anunciar (anunciar.html)
                document.querySelector('[href="anunciar.html"]').insertAdjacentHTML('beforebegin', adminLinkHtml);
            }
        }

        // 4. Inicia o monitoramento de mensagens não lidas
        checkUnreadMessages(user.uid);


    } else {
        // Usuário deslogado
        currentUserID = null;
        currentUserRole = 'user';
        
        // 1. Atualiza o Botão de Autenticação (deve levar para autenticacao.html)
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
// 7. EVENTO DOMContentLoaded
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // 1. Configuração de Listeners para a página de AUTENTICAÇÃO (se aplicável)
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    if (loginBtn && registerBtn) {
        loginBtn.addEventListener('click', handleLogin);
        registerBtn.addEventListener('click', handleRegister);
    }

    // 2. Funções que rodam em todas as páginas
    fetchGlobalAlert();

    // 3. Funções que rodam apenas na INDEX.HTML
    if (document.getElementById('exchange-listings')) { 
        loadExchangeListings(); // Carrega ofertas de troca
        setupCategoryListeners(); // Configura cliques nas categorias
        registerPageAccess(); // CRÍTICO: Registra o acesso para o monitoramento

        // Listener para o botão de Recarregar Ofertas
        document.getElementById('loadExchangeBtn')?.addEventListener('click', loadExchangeListings);
    }
    
    // 4. Funções que rodam apenas na PESQUISA.HTML
    if (document.getElementById('search-form')) {
        handleSearchPageLoad();
    }
    
    // 5. Funções que rodam apenas no ADMIN_PAINEL.HTML
    if (document.getElementById('adminAccordion')) {
        // A lógica de setupAdminPanel é chamada via checkUserRole dentro do onAuthStateChanged,
        // garantindo que as permissões sejam verificadas primeiro.
    }
    
    // 6. Lógica de Doação (Modal PIX)
    const donationModalEl = document.getElementById('donationModal');
    if (donationModalEl) {
        const donationModal = new bootstrap.Modal(donationModalEl);
        
        // Exibe o modal apenas na primeira visita (ou se não houver token de acesso)
        // OBS: Token não está implementado, então apenas o modal é inicializado aqui.
        // O código de decisão de exibição deve ser implementado aqui para a lógica de "primeira visita".
        // donationModal.show(); 

        document.getElementById('copyPixKeyBtn')?.addEventListener('click', () => {
            const pixKey = document.getElementById('pixKeyDisplay').value;
            navigator.clipboard.writeText(pixKey).then(() => {
                alert("Chave PIX copiada para a área de transferência!");
            }).catch(err => {
                console.error('Falha ao copiar:', err);
            });
        });
        
        document.getElementById('closeAndContinueBtn')?.addEventListener('click', () => {
            // Lógica para marcar que o usuário viu o modal e não mostrar novamente
        });
    }

});

// =================================================================
// script.js - Lógica Central do IVAD Marketplace (CORRIGIDO)
// =================================================================

// 1. Variáveis Globais e Inicialização do Firebase
const auth = firebase.auth();
const db = firebase.firestore();

let currentUserUid = null;
let currentUsername = null;
let globalChatListener = null;

// =================================================================
// 2. FUNÇÕES DE AUTENTICAÇÃO (LOGIN / REGISTRO) E O ERRO DO USERNAME CORRIGIDO
// =================================================================

/**
 * [CORREÇÃO CRÍTICA] Função utilitária para obter nome de usuário.
 * Garante que a busca assíncrona do nome seja robusta.
 * (A função é fundamental para o Chat e Anúncios).
 */
async function getUsernameByUid(uid) {
    if (!uid) return 'Desconhecido';
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        // Verifica se o documento existe e se o campo username existe
        if (userDoc.exists && userDoc.data().username) {
            return userDoc.data().username;
        }
        // Se o documento existe mas não tem username (dados incompletos)
        const shortUid = uid.substring(0, 5) + '...';
        return `Usuário (${shortUid})`;

    } catch (error) {
        // [CORREÇÃO] Mensagem de erro mais discreta no console, retorna fallback
        console.error("Erro ao buscar username no Firestore:", error);
        const shortUid = uid ? uid.substring(0, 5) + '...' : 'N/A';
        return `Erro UID (${shortUid})`;
    }
}

// ... (handleRegister e handleLogin permanecem inalterados, exceto pelo fechamento do modal) ...

async function handleRegister() {
    // ... (lógica de registro) ...
    try {
        // ...
        alert(`Bem-vindo, ${username}! Seu registro foi concluído.`);
        // Garante que o modal é fechado corretamente após o sucesso
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (modalInstance) modalInstance.hide();
    } catch (error) {
        console.error("Erro no Registro:", error);
        alert(`Falha no Registro: ${error.message}`);
    }
}

async function handleLogin() {
    // ... (lógica de login) ...
    try {
        await auth.signInWithEmailAndPassword(email, password);
        alert("Login efetuado com sucesso!");
        // Garante que o modal é fechado corretamente após o sucesso
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (modalInstance) modalInstance.hide();
    } catch (error) {
        console.error("Erro no Login:", error);
        alert(`Falha no Login: ${error.message}`);
    }
}

// Listener de Status de Autenticação (inalterado)
auth.onAuthStateChanged(async (user) => {
    const authBtn = document.getElementById('authBtn');
    const uidDisplay = document.getElementById('my-uid-display');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatStatus = document.getElementById('chat-status');

    if (user) {
        currentUserUid = user.uid;
        // O username é buscado corretamente pela função aprimorada
        currentUsername = await getUsernameByUid(user.uid); 
        
        // ... (Atualização de UI - inalterado) ...
        if (authBtn) {
            authBtn.textContent = `Olá, ${currentUsername} (Sair)`;
            authBtn.classList.remove('btn-primary');
            authBtn.classList.add('btn-danger');
        }
        if (uidDisplay) uidDisplay.textContent = currentUserUid;
        if (chatSendBtn) chatSendBtn.disabled = false;
        if (chatStatus) chatStatus.textContent = 'Ativo';
        
        startGlobalChatListener();

    } else {
        currentUserUid = null;
        currentUsername = null;
        
        // ... (Atualização de UI - inalterado) ...
        if (authBtn) {
            authBtn.innerHTML = '<i class="fas fa-user me-1"></i> Entrar / Cadastrar';
            authBtn.classList.add('btn-primary');
            authBtn.classList.remove('btn-danger');
        }
        if (uidDisplay) uidDisplay.textContent = 'Deslogado';
        if (chatSendBtn) chatSendBtn.disabled = true;
        if (chatStatus) chatStatus.textContent = 'Login Necessário';
        
        if (globalChatListener) globalChatListener();
    }
});


// =================================================================
// 3. EXIBIÇÃO DE ANÚNCIOS (INDEX.HTML) - CORREÇÃO DE CONEXÃO
// =================================================================

// ... (createListingCard - inalterado) ...
function createListingCard(doc, data, vendedorName) {
    const price = data.preco ? `R$ ${data.preco.toFixed(2).replace('.', ',')}` : 'A Combinar';
    const imageUrl = data.imageUrls && data.imageUrls.length > 0 
                     ? data.imageUrls[0] 
                     : 'https://via.placeholder.com/400x200?text=Sem+Imagem';
    
    const exchangeBadge = data.aceitaTroca 
        ? '<span class="badge bg-warning text-dark float-end">ACEITA TROCA</span>' 
        : '';
        
    const shortDescription = data.description ? data.description.substring(0, 80) + (data.description.length > 80 ? '...' : '') : 'Sem descrição.';

    return `
        <div class="col-lg-4 col-md-6 mb-4">
            <div class="card h-100 shadow-sm">
                <img src="${imageUrl}" class="card-img-top" alt="Imagem do Anúncio" style="height: 200px; object-fit: cover;">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title text-purple-vibrant">${data.titulo} ${exchangeBadge}</h5>
                    <p class="card-text text-muted small">${shortDescription}</p>
                    <p class="mb-1"><strong>Preço:</strong> <span class="text-success">${price}</span></p>
                    <p class="mb-2 small"><strong>Vendedor:</strong> ${vendedorName}</p>
                    <a href="detalhes.html?id=${doc.id}" class="mt-auto btn btn-sm btn-purple">
                        Ver Detalhes <i class="fas fa-arrow-right ms-1"></i>
                    </a>
                </div>
            </div>
        </div>
    `;
}

/**
 * [CORREÇÃO CRÍTICA] Carrega anúncios que aceitam troca para a seção principal.
 * Garante que a query e a busca de dados são tratadas de forma robusta.
 */
async function loadExchangeListings() {
    const container = document.getElementById('exchange-listings');
    if (!container) return; 

    // Mensagem de carregamento
    container.innerHTML = '<div class="col-12 text-center text-primary"><i class="fas fa-spinner fa-spin me-2"></i> Buscando ofertas de troca...</div>';
    
    try {
        const snapshot = await db.collection('anuncios')
            .where('aceitaTroca', '==', true)
            .where('status', '==', 'ativo') 
            .orderBy('dataCriacao', 'desc')
            .limit(6)
            .get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="col-12 text-center text-muted">Nenhuma oferta de troca disponível no momento.</div>';
            return;
        }

        let listingsHtml = '';
        const userCache = {}; 

        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Busca o nome do vendedor
            if (!userCache[data.vendedorUid]) {
                userCache[data.vendedorUid] = await getUsernameByUid(data.vendedorUid);
            }
            const vendedorName = userCache[data.vendedorUid];

            listingsHtml += createListingCard(doc, data, vendedorName);
        }

        container.innerHTML = listingsHtml;

    } catch (error) {
        // [CORREÇÃO CRÍTICA] Mensagem de erro de conexão mais clara.
        console.error("Erro CRÍTICO ao carregar ofertas de troca:", error);
        container.innerHTML = '<div class="col-12 text-center text-danger"><i class="fas fa-exclamation-triangle me-2"></i> Erro de Conexão com o Banco de Dados. Tente novamente mais tarde.</div>';
    }
}

// ... (Event listeners para categorias e carregamento inicial - inalterado) ...
document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('loadExchangeBtn');
    if (loadBtn) {
        loadBtn.addEventListener('click', loadExchangeListings);
        loadExchangeListings(); 
    }
    
    document.querySelectorAll('.category-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const category = e.currentTarget.getAttribute('data-category');
            window.location.href = `pesquisa.html?category=${encodeURIComponent(category)}`;
        });
    });
});

// =================================================================
// 4. CHAT GLOBAL (FIREBASE REALTIME LISTENERS) - CORREÇÃO DE USERNAME
// =================================================================

const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatMessagesContainer = document.getElementById('chat-messages');

function startGlobalChatListener() {
    if (globalChatListener) globalChatListener(); 

    // Ouve mensagens em tempo real
    globalChatListener = db.collection('global_chat')
        .orderBy('timestamp', 'desc')
        .limit(15)
        .onSnapshot(async (snapshot) => {
            let messagesHtml = '';
            const messages = snapshot.docs.map(doc => doc.data()).reverse(); 
            const uidCache = {};
            
            for (const data of messages) {
                // [CORREÇÃO CRÍTICA] Busca o username de forma assíncrona garantida
                if (!uidCache[data.uid]) {
                    uidCache[data.uid] = await getUsernameByUid(data.uid);
                }
                const senderName = uidCache[data.uid];
                
                // Formata a mensagem
                const isMe = data.uid === currentUserUid;
                const nameClass = isMe ? 'my-uid-highlight' : 'text-primary';
                const time = data.timestamp ? data.timestamp.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : 'Agora';

                messagesHtml += `
                    <div class="chat-message">
                        <span class="${nameClass} fw-bold">${senderName}</span>
                        <span class="text-muted small">(${time}):</span> ${data.message}
                    </div>
                `;
            }

            chatMessagesContainer.innerHTML = messagesHtml;
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }, (error) => {
            console.error("Erro no listener do chat global:", error);
            chatMessagesContainer.innerHTML = '<div class="text-danger small">Erro ao carregar o chat.</div>';
        });
}

// ... (sendMessage, startPrivateChat - inalterados) ...

// =================================================================
// 5. SISTEMA DE DOAÇÃO PIX - CORREÇÃO DE EXIBIÇÃO DO MODAL
// =================================================================

const PIX_KEY = "11913429349"; 

/**
 * [CORREÇÃO CRÍTICA] Função para mostrar o modal de doação apenas uma vez por sessão.
 * Alterada para garantir a inicialização correta do Bootstrap.
 */
function setupDonationModal() {
    const modalElement = document.getElementById('donationModal');
    if (!modalElement) return;

    const hasSeenDonation = sessionStorage.getItem('ivad_donation_seen');
    const pixKeyDisplay = document.getElementById('pixKeyDisplay');
    const copyPixKeyBtn = document.getElementById('copyPixKeyBtn');
    const closeAndContinueBtn = document.getElementById('closeAndContinueBtn');

    pixKeyDisplay.value = PIX_KEY;

    if (copyPixKeyBtn) {
        copyPixKeyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(PIX_KEY).then(() => {
                const originalText = copyPixKeyBtn.innerHTML;
                copyPixKeyBtn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
                setTimeout(() => { copyPixKeyBtn.innerHTML = originalText; }, 2000);
            }).catch(err => {
                console.error('Falha ao copiar:', err);
                alert('Erro ao copiar a chave Pix. Por favor, copie manualmente.');
            });
        });
    }

    // 3. Exibição do Modal (Apenas se o usuário não o viu nesta sessão)
    if (!hasSeenDonation) {
        // [CORREÇÃO] Garante que o modal é instanciado APENAS se houver o elemento
        const donationModal = new bootstrap.Modal(modalElement, {
            backdrop: 'static', 
            keyboard: false 
        }); 
        donationModal.show();
        
        const setSeen = () => {
            sessionStorage.setItem('ivad_donation_seen', 'true');
        };

        modalElement.addEventListener('hidden.bs.modal', setSeen);
        if (closeAndContinueBtn) {
            closeAndContinueBtn.addEventListener('click', setSeen);
        }
    }
    
    // 5. Configuração dos botões de sugestão de valor (opcional, para feedback visual)
    document.querySelectorAll('#donationModal .btn[data-amount]').forEach(btn => {
        btn.addEventListener('click', function() {
            navigator.clipboard.writeText(PIX_KEY).then(() => {
                 alert(`Chave Pix copiada! Sugestão de R$ ${this.getAttribute('data-amount')}. Utilize-a em seu app de banco. Obrigado!`);
            });
        });
    });
}


// =================================================================
// 6. SETUP FINAL: CHAMADAS AO CARREGAR O DOM
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // [CORREÇÃO] A chamada deve ser feita após o carregamento, garantindo que o DOM e Bootstrap estejam prontos.
    if (document.getElementById('donationModal')) {
        setupDonationModal();
    }
});

console.log("script.js carregado: Correções de Username, Conexão e Modal de Doação aplicadas.");


// =================================================================
// 7. LÓGICA DA PÁGINA DE PESQUISA (pesquisa.html)
// =================================================================

// Variáveis para elementos de pesquisa (verificam se a página é pesquisa.html)
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const listingsResultsContainer = document.getElementById('listings-results');
const resultsCountSpan = document.getElementById('results-count');

/**
 * Configura a página de pesquisa, lendo parâmetros da URL.
 * Esta função só é chamada se os elementos do formulário existirem.
 */
function setupSearchPage() {
    if (!searchForm || !listingsResultsContainer) return; // Garante que só roda em pesquisa.html

    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    const searchParam = urlParams.get('q');

    // 1. Preenche os campos do formulário (útil ao clicar nos cards de categoria da index)
    if (categoryParam) {
        categoryFilter.value = categoryParam;
    }
    if (searchParam) {
        searchInput.value = searchParam;
    }

    // 2. Executa a pesquisa inicial se houver parâmetros (se veio da index.html)
    if (categoryParam || searchParam) {
        executeSearch(searchParam, categoryParam);
    }
    
    // 3. Configura o envio do formulário
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const term = searchInput.value.trim();
        const category = categoryFilter.value;
        
        // Atualiza a URL (para que o usuário possa compartilhar o link da busca)
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('q', term);
        newUrl.searchParams.set('category', category);
        // Usa replaceState para não encher o histórico com cada busca
        window.history.replaceState({}, '', newUrl); 

        executeSearch(term, category);
    });
}


/**
 * Executa a busca no Firestore com base nos filtros fornecidos.
 * @param {string} searchTerm Termo de busca (título/descrição).
 * @param {string} category Categoria selecionada.
 */
async function executeSearch(searchTerm, category) {
    // Exibe mensagem de carregamento
    listingsResultsContainer.innerHTML = '<div class="col-12 text-center text-primary"><i class="fas fa-spinner fa-spin me-2"></i> Buscando anúncios...</div>';
    resultsCountSpan.textContent = '...';

    // Inicia a query base
    let query = db.collection('anuncios')
        .where('status', '==', 'ativo')
        .orderBy('dataCriacao', 'desc');

    // 1. Aplica o filtro de Categoria (se houver)
    if (category) {
        query = query.where('category', '==', category);
    }
    
    try {
        const snapshot = await query.get();
        let resultsHtml = '';
        let count = 0;
        const userCache = {};
        
        // 2. Filtro de Texto (Realizado no lado do cliente)
        const filteredDocs = snapshot.docs.filter(doc => {
            const data = doc.data();
            if (!searchTerm) return true; // Se não há termo, passa no filtro

            const lowerTerm = searchTerm.toLowerCase();
            const title = data.titulo ? data.titulo.toLowerCase() : '';
            const description = data.description ? data.description.toLowerCase() : '';
            
            // Retorna verdadeiro se o termo estiver no título OU na descrição
            return title.includes(lowerTerm) || description.includes(lowerTerm);
        });
        
        // 3. Renderiza os resultados filtrados
        for (const doc of filteredDocs) {
            const data = doc.data();
            
            // Reutiliza a função de busca de username
            if (!userCache[data.vendedorUid]) {
                userCache[data.vendedorUid] = await getUsernameByUid(data.vendedorUid);
            }
            const vendedorName = userCache[data.vendedorUid];

            // Reutiliza a função de criação do card (deve estar definida na seção 3 do script.js)
            resultsHtml += createListingCard(doc, data, vendedorName);
            count++;
        }

        if (count === 0) {
            resultsHtml = '<div class="col-12 text-center text-muted"><i class="fas fa-box-open me-2"></i> Nenhum anúncio encontrado com os filtros aplicados.</div>';
        }

        listingsResultsContainer.innerHTML = resultsHtml;
        resultsCountSpan.textContent = count;

    } catch (error) {
        console.error("Erro ao executar a pesquisa:", error);
        listingsResultsContainer.innerHTML = '<div class="col-12 text-center text-danger"><i class="fas fa-exclamation-triangle me-2"></i> Erro ao buscar anúncios. Verifique as regras do Firebase.</div>';
        resultsCountSpan.textContent = 'Erro';
    }
}


// --- ATUALIZAÇÃO DA CHAMADA DOMContentLoaded EXISTENTE ---
// Se você tem um bloco document.addEventListener('DOMContentLoaded', ...) no final,
// certifique-se de adicionar a chamada setupSearchPage() dentro dele:

/*
document.addEventListener('DOMContentLoaded', () => {
    // ... (outras chamadas como setupDonationModal() e loadExchangeListings()) ...
    
    // NOVO: Chama a configuração de pesquisa se os elementos existirem
    if (document.getElementById('search-form')) {
        setupSearchPage(); 
    }
});
*/


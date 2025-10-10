// =================================================================
// script.js - Lógica Central do IVAD Marketplace (ESTÁVEL E CORRIGIDO)
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
// 2. AUTENTICAÇÃO E FUNÇÕES AUXILIARES (CORREÇÃO DE LOGIN/USERNAME)
// =================================================================

const usernameCache = {};

/**
 * Função utilitária para obter nome de usuário com cache.
 */
async function getUsernameByUid(uid) {
    if (!uid) return 'Usuário Desconhecido';
    
    if (usernameCache[uid]) {
        return usernameCache[uid];
    }
    
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

// Manipuladores de Login/Registro
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
        // A função onAuthStateChanged cuidará da atualização da UI após o registro/login

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
        // A função onAuthStateChanged cuidará da atualização da UI
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
                window.location.href = 'index.html'; // Redireciona para o index após logout
            }; 
        }
        if (uidDisplay) {
            uidDisplay.textContent = currentUserUid;
        }

        // Inicialização de lógicas específicas de páginas (só se os elementos existirem)
        if (document.getElementById('inbox-list') && typeof loadInbox === 'function') {
            loadInbox();
        }
        if (document.getElementById('chat-messages') && typeof loadGlobalChat === 'function') {
            loadGlobalChat();
        }
        
    } else {
        currentUserUid = null;
        currentUsername = null;
        
        // Atualiza a UI para estado Deslogado
        if (authBtn) {
            authBtn.innerHTML = '<i class="fas fa-user me-1"></i> Entrar / Cadastrar';
            authBtn.classList.add('btn-primary');
            authBtn.classList.remove('btn-success', 'btn-danger');
            // Ação de abrir o modal no clique (CORRIGIDO: garante que o modal é instanciado e mostrado)
            authBtn.onclick = () => {
                if (modalElement) {
                    const loginModal = new bootstrap.Modal(modalElement);
                    loginModal.show();
                } else {
                    alert('Erro: Modal de Login não encontrado.');
                }
            };
        }
        if (uidDisplay) {
            uidDisplay.textContent = 'Deslogado';
        }
        
        // Limpa a caixa de entrada
        if (document.getElementById('inbox-list')) {
            document.getElementById('inbox-list').innerHTML = '<li class="list-group-item text-center text-danger py-5"><i class="fas fa-lock me-2"></i> Você precisa estar logado para ver suas mensagens.</li>';
        }

        // Para o Chat Global (se houver um listener)
        if (globalChatListener) {
            globalChatListener(); // Chama a função de 'unsubscribe'
        }
    }
});


// =================================================================
// 3. EXIBIÇÃO DE ANÚNCIOS (CORREÇÃO DE CATEGORIAS)
// =================================================================

// Função para criar o Card de Anúncio
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
 * Carrega anúncios que aceitam troca para a seção principal (index.html).
 */
async function loadExchangeListings() {
    const container = document.getElementById('exchange-listings');
    if (!container) return; 

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
            
            if (!userCache[data.vendedorUid]) {
                userCache[data.vendedorUid] = await getUsernameByUid(data.vendedorUid);
            }
            const vendedorName = userCache[data.vendedorUid];

            listingsHtml += createListingCard(doc, data, vendedorName);
        }

        container.innerHTML = listingsHtml;

    } catch (error) {
        console.error("Erro CRÍTICO ao carregar ofertas de troca:", error);
        container.innerHTML = '<div class="col-12 text-center text-danger"><i class="fas fa-exclamation-triangle me-2"></i> Erro de Conexão com o Banco de Dados. Tente novamente mais tarde.</div>';
    }
}


// =================================================================
// 4. CHAT GLOBAL (chat_global.html)
// =================================================================

function loadGlobalChat() {
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    
    if (!chatMessages || !chatInput || !chatSendBtn) return;

    if (!currentUserUid || !currentUsername) {
        chatInput.placeholder = "Você precisa estar logado para enviar mensagens.";
        chatInput.disabled = true;
        chatSendBtn.disabled = true;
        document.getElementById('chat-status').textContent = 'Login Necessário';
        return;
    }
    
    // Estado de Logado
    chatInput.placeholder = `Escreva sua mensagem como ${currentUsername}...`;
    chatInput.disabled = false;
    chatSendBtn.disabled = false;
    document.getElementById('chat-status').textContent = 'Ativo';

    // Remove listener antigo
    if (globalChatListener) globalChatListener();

    // Carrega Mensagens Existentes e Monitora Novas Mensagens
    globalChatListener = db.collection('global_chat')
        .orderBy('timestamp', 'desc')
        .limit(50) 
        .onSnapshot(async (snapshot) => {
            chatMessages.innerHTML = '';
            const reversedDocs = snapshot.docs.reverse(); 
            const nameCache = {}; 

            for (const doc of reversedDocs) {
                const data = doc.data();
                const senderUid = data.uid;
                
                // Busca o nome, usando o cache
                if (!nameCache[senderUid]) {
                    nameCache[senderUid] = await getUsernameByUid(senderUid);
                }
                const senderName = nameCache[senderUid];

                const isMine = senderUid === currentUserUid; 
                const messageClass = isMine ? 'text-end' : 'text-start';
                const bubbleClass = isMine ? 'bg-info text-white' : 'bg-light';
                
                const timestamp = data.timestamp ? data.timestamp.toDate() : new Date();
                const timestampText = timestamp.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

                const messageElement = `
                    <div class="${messageClass} mb-2">
                        <small class="text-muted">${senderName}</small>
                        <div class="d-flex ${isMine ? 'justify-content-end' : 'justify-content-start'}">
                            <div class="p-2 rounded ${bubbleClass}" style="max-width: 75%;">
                                ${data.message}
                            </div>
                        </div>
                        <small class="text-muted fst-italic" style="font-size: 0.7rem;">${timestampText}</small>
                    </div>
                `;
                chatMessages.innerHTML += messageElement;
            }
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, error => {
            console.error("Erro ao carregar o chat:", error);
            chatMessages.innerHTML = '<p class="text-center text-danger">Erro ao carregar o chat.</p>';
        });


    // Lógica de Envio (Listener)
    const sendMessage = async () => {
        const message = chatInput.value.trim();

        if (message === '' || !currentUserUid) return;

        try {
            await db.collection('global_chat').add({
                uid: currentUserUid,
                message: message,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            chatInput.value = '';
        } catch (e) {
            alert('Falha ao enviar mensagem. Tente novamente.');
            console.error("Erro ao enviar mensagem:", e);
        }
    };

    chatSendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });
}


// =================================================================
// 5. CAIXA DE ENTRADA (caixa_de_entrada.html)
// =================================================================

function loadInbox() {
    const inboxList = document.getElementById('inbox-list');
    if (!inboxList || !currentUserUid) return;

    inboxList.innerHTML = '<li class="list-group-item text-center py-5"><i class="fas fa-spinner fa-spin me-2"></i> Buscando conversas...</li>';
    
    // Monitora as conversas em tempo real
    db.collection('conversas')
        .where('participantes', 'array-contains', currentUserUid)
        .orderBy('ultimaMensagem', 'desc')
        .onSnapshot(async (snapshot) => {

        if (snapshot.empty) {
            inboxList.innerHTML = '<li class="list-group-item text-center text-muted py-5"><i class="fas fa-info-circle me-2"></i> Sua caixa de entrada está vazia.</li>';
            return;
        }

        let inboxHtml = '';
        const userCache = {};

        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            const otherUid = data.participantes.find(uid => uid !== currentUserUid);
            
            if (!userCache[otherUid]) {
                userCache[otherUid] = await getUsernameByUid(otherUid);
            }
            const otherName = userCache[otherUid];
            
            const lastMessage = data.ultimaMensagemTexto || 'Nenhuma mensagem.';
            const messageTime = data.ultimaMensagem ? data.ultimaMensagem.toDate().toLocaleString('pt-BR') : 'Sem data';
            const unreadCount = (data.naoLidas && data.naoLidas[currentUserUid]) ? data.naoLidas[currentUserUid] : 0;
            const unreadBadge = unreadCount > 0 ? `<span class="badge bg-danger rounded-pill">${unreadCount}</span>` : '';

            inboxHtml += `
                <li class="list-group-item conversation-item d-flex justify-content-between align-items-center" 
                    onclick="window.location.href='chat_privado.html?conversationId=${doc.id}'">
                    <div>
                        ${unreadCount > 0 ? '<span class="unread-indicator"></span>' : ''}
                        <strong>Conversa com: ${otherName}</strong> 
                        <span class="text-muted small ms-2">${unreadBadge}</span>
                    </div>
                    <div class="text-end">
                        <small class="text-muted d-block">Última: ${messageTime}</small>
                        <small class="d-block text-truncate" style="max-width: 250px;">${lastMessage}</small>
                    </div>
                </li>
            `;
        }

        inboxList.innerHTML = inboxHtml;
    }, (error) => {
        console.error("Erro no listener da caixa de entrada:", error);
        inboxList.innerHTML = '<li class="list-group-item text-center text-danger py-5"><i class="fas fa-exclamation-triangle me-2"></i> Erro ao carregar as conversas.</li>';
    });
}


// =================================================================
// 6. SISTEMA DE DOAÇÃO PIX
// =================================================================

function setupDonationModal() {
    const modalElement = document.getElementById('donationModal');
    if (!modalElement) return;

    const hasSeenDonation = sessionStorage.getItem('ivad_donation_seen');
    const pixKeyDisplay = document.getElementById('pixKeyDisplay');
    const copyPixKeyBtn = document.getElementById('copyPixKeyBtn');
    const closeAndContinueBtn = document.getElementById('closeAndContinueBtn');

    if (pixKeyDisplay) pixKeyDisplay.value = PIX_KEY;

    if (copyPixKeyBtn) {
        copyPixKeyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(PIX_KEY).then(() => {
                const originalText = copyPixKeyBtn.innerHTML;
                copyPixKeyBtn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
                setTimeout(() => { copyPixKeyBtn.innerHTML = originalText; }, 2000);
            });
        });
    }

    if (!hasSeenDonation) {
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
    
    document.querySelectorAll('#donationModal .btn[data-amount]').forEach(btn => {
        btn.addEventListener('click', function() {
            navigator.clipboard.writeText(PIX_KEY).then(() => {
                 alert(`Chave Pix copiada! Sugestão de R$ ${this.getAttribute('data-amount')}. Utilize-a em seu app de banco. Obrigado!`);
            });
        });
    });
}


// =================================================================
// 7. LÓGICA DA PÁGINA DE PESQUISA (pesquisa.html)
// =================================================================

const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const listingsResultsContainer = document.getElementById('listings-results');
const resultsCountSpan = document.getElementById('results-count');


function setupSearchPage() {
    if (!searchForm || !listingsResultsContainer) return;

    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    const searchParam = urlParams.get('q');

    if (categoryParam) {
        categoryFilter.value = categoryParam;
    }
    if (searchParam) {
        searchInput.value = searchParam;
    }

    if (categoryParam || searchParam) {
        executeSearch(searchParam, categoryParam);
    }
    
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const term = searchInput.value.trim();
        const category = categoryFilter.value;
        
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('q', term);
        newUrl.searchParams.set('category', category);
        window.history.replaceState({}, '', newUrl);

        executeSearch(term, category);
    });
}

async function executeSearch(searchTerm, category) {
    listingsResultsContainer.innerHTML = '<div class="col-12 text-center text-primary"><i class="fas fa-spinner fa-spin me-2"></i> Buscando anúncios...</div>';
    resultsCountSpan.textContent = '...';

    let query 
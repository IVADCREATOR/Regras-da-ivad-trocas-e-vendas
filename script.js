// =================================================================
// script.js - Lógica Central do IVAD Marketplace (CONSOLIDADO E CORRIGIDO)
// =================================================================

// 1. Variáveis Globais e Inicialização do Firebase
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage(); // Adicionando Storage para upload/download de imagens

let currentUserUid = null;
let currentUsername = null;
let globalChatListener = null;

const PIX_KEY = "11913429349"; // Sua chave Pix

// =================================================================
// 2. AUTENTICAÇÃO E FUNÇÕES AUXILIARES (CORREÇÃO CRÍTICA DO USERNAME)
// =================================================================

const usernameCache = {}; // Cache para evitar múltiplas leituras de UIDs

/**
 * [CORREÇÃO CRÍTICA] Função utilitária para obter nome de usuário com cache.
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
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (modalInstance) modalInstance.hide();

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
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (modalInstance) modalInstance.hide();
    } catch (error) {
        console.error("Erro no Login:", error);
        alert(`Falha no Login: ${error.message}`);
    }
}

// Listener de Status de Autenticação (Chama getUsernameByUid imediatamente após o login)
auth.onAuthStateChanged(async (user) => {
    const authBtn = document.getElementById('authBtn');
    const uidDisplay = document.getElementById('my-uid-display');

    if (user) {
        currentUserUid = user.uid;
        currentUsername = await getUsernameByUid(user.uid);
        
        // Atualiza a UI para estado Logado
        if (authBtn) {
            authBtn.textContent = `Olá, ${currentUsername} (Sair)`;
            authBtn.classList.remove('btn-primary', 'btn-danger');
            authBtn.classList.add('btn-success');
            // Altera para um link de logout simples (o painel do usuário não existe, mas o logout sim)
            authBtn.onclick = () => { auth.signOut(); }; 
        }
        if (uidDisplay) {
            uidDisplay.textContent = currentUserUid;
        }

        // Se estiver em uma página que precisa de login (ex: caixa_de_entrada.html ou chat_global.html)
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
            authBtn.onclick = () => {
                const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                loginModal.show();
            };
        }
        if (uidDisplay) {
            uidDisplay.textContent = 'Deslogado';
        }
        
        // Limpa a caixa de entrada se o usuário sair
        if (document.getElementById('inbox-list')) {
            document.getElementById('inbox-list').innerHTML = '<li class="list-group-item text-center text-danger py-5"><i class="fas fa-lock me-2"></i> Você precisa estar logado para ver suas mensagens.</li>';
        }

        // Para o Chat Global (se houver um listener)
        if (globalChatListener) {
            globalChatListener();
        }
    }
});

// Manipulador do DOM para botões do modal
document.addEventListener('DOMContentLoaded', () => {
    const registerBtn = document.getElementById('registerBtn');
    const loginBtn = document.getElementById('loginBtn');
    
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    }
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
});


// =================================================================
// 3. EXIBIÇÃO DE ANÚNCIOS (INDEX.HTML / PESQUISA.HTML)
// =================================================================

// Reutiliza esta função em index.html e pesquisa.html
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

// ... (loadExchangeListings e lógica de categorias - Mantida) ...


// =================================================================
// 4. CHAT GLOBAL (chat_global.html)
// =================================================================

function loadGlobalChat() {
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    
    if (!chatMessages || !chatInput || !chatSendBtn) return;

    if (!currentUsername) {
        chatInput.placeholder = "Você precisa estar logado para enviar mensagens.";
        chatInput.disabled = true;
        chatSendBtn.disabled = true;
        chatMessages.innerHTML = '<p class="text-center text-danger">Por favor, faça login para acessar o chat global.</p>';
        return;
    }
    
    // Estado de Logado
    chatInput.placeholder = `Escreva sua mensagem como ${currentUsername}...`;
    chatInput.disabled = false;
    chatSendBtn.disabled = false;

    // Remove listener antigo se houver
    if (globalChatListener) globalChatListener();

    // Carrega Mensagens Existentes e Monitora Novas Mensagens
    globalChatListener = db.collection('global_chat')
        .orderBy('timestamp', 'desc')
        .limit(50) 
        .onSnapshot(async (snapshot) => {
            chatMessages.innerHTML = '';
            const reversedDocs = snapshot.docs.reverse(); 
            const nameCache = {}; // Cache de nomes para esta sessão do chat

            for (const doc of reversedDocs) {
                const data = doc.data();
                const senderUid = data.uid;
                
                // Busca o nome, usando o cache de usernames
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

// Placeholder para chat privado (chamado de detalhes.html)
function startPrivateChat(targetUid) {
    if (!currentUserUid) {
        alert("Você deve estar logado para iniciar um chat privado.");
        return;
    }
    // A implementação futura redirecionará para a sala de chat com a pessoa
    window.location.href = `chat_privado.html?user=${targetUid}`;
}
window.startPrivateChat = startPrivateChat;


// =================================================================
// 5. CAIXA DE ENTRADA (caixa_de_entrada.html) - NOVO BLOCO
// =================================================================

/**
 * Carrega a lista de conversas privadas do usuário logado.
 */
async function loadInbox() {
    const inboxList = document.getElementById('inbox-list');
    if (!inboxList || !currentUserUid) return;

    // Mensagem de loading
    inboxList.innerHTML = '<li class="list-group-item text-center py-5"><i class="fas fa-spinner fa-spin me-2"></i> Buscando conversas...</li>';
    
    // A. Busca todas as conversas onde o usuário é o participante 1 OU o participante 2
    // Esta lógica é complexa para o Firestore sem índices compostos.
    // Vamos buscar todas as conversas e filtrar o lado do cliente (menos eficiente, mas funcional para demonstração).
    // NO PROJETO REAL: Use uma coleção /users/UID/conversas e a regra de segurança do Firebase.

    try {
        // Assume que a coleção é 'conversas' e o ID é uma combinação de UIDs
        const snapshot = await db.collection('conversas')
            .where('participantes', 'array-contains', currentUserUid)
            .orderBy('ultimaMensagem', 'desc')
            .get();

        if (snapshot.empty) {
            inboxList.innerHTML = '<li class="list-group-item text-center text-muted py-5"><i class="fas fa-info-circle me-2"></i> Sua caixa de entrada está vazia.</li>';
            return;
        }

        let inboxHtml = '';
        const userCache = {}; // Cache de usernames

        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Determina quem é o outro participante
            const otherUid = data.participantes.find(uid => uid !== currentUserUid);
            
            // Busca o nome do outro participante
            if (!userCache[otherUid]) {
                userCache[otherUid] = await getUsernameByUid(otherUid);
            }
            const otherName = userCache[otherUid];
            
            const lastMessage = data.ultimaMensagemTexto || 'Nenhuma mensagem.';
            const messageTime = data.ultimaMensagem ? data.ultimaMensagem.toDate().toLocaleString('pt-BR') : 'Sem data';
            const unread = data.naoLidas && data.naoLidas[currentUserUid] > 0;
            const unreadBadge = unread ? `<span class="badge bg-danger rounded-pill">${data.naoLidas[currentUserUid]}</span>` : '';

            inboxHtml += `
                <li class="list-group-item conversation-item d-flex justify-content-between align-items-center" 
                    onclick="window.location.href='chat_privado.html?conversationId=${doc.id}'">
                    <div>
                        ${unread ? '<span class="unread-indicator"></span>' : ''}
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

    } catch (error) {
        console.error("Erro ao carregar a caixa de entrada:", error);
        inboxList.innerHTML = '<li class="list-group-item text-center text-danger py-5"><i class="fas fa-exclamation-triangle me-2"></i> Erro ao carregar as conversas.</li>';
    }
}


// =================================================================
// 6. SISTEMA DE DOAÇÃO PIX
// =================================================================

// ... (setupDonationModal - Mantido) ...


// =================================================================
// 7. LÓGICA DA PÁGINA DE PESQUISA (pesquisa.html)
// =================================================================

// ... (setupSearchPage e executeSearch - Mantido) ...

// =================================================================
// 8. SETUP FINAL: CHAMADAS AO CARREGAR O DOM
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Configura o sistema de doação Pix
    if (document.getElementById('donationModal')) {
        setupDonationModal();
    }
    
    // Configura a página de pesquisa, se os elementos existirem
    if (document.getElementById('search-form')) {
        setupSearchPage();
    }
    
    // Carrega ofertas de troca na index.html, se o botão existir
    const loadBtn = document.getElementById('loadExchangeBtn');
    if (loadBtn && typeof loadExchangeListings === 'function') {
        loadBtn.addEventListener('click', loadExchangeListings);
        loadExchangeListings(); 
    }

    // Configura o chat global, se estiver na página dedicada
    if (document.getElementById('chat-messages') && currentUserUid) {
        // A função loadGlobalChat é chamada dentro de auth.onAuthStateChanged
    }
    
    // Configura a caixa de entrada, se estiver na página dedicada
    if (document.getElementById('inbox-list') && currentUserUid) {
        // A função loadInbox é chamada dentro de auth.onAuthStateChanged
    }
    
});

console.log("script.js carregado: Lógica corrigida, Chat Global e Caixa de Entrada implementados.");

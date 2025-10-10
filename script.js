// =================================================================
// 1. INICIALIZAÇÃO DO FIREBASE E VARIÁVEIS GLOBAIS
// =================================================================

const auth = firebase.auth();
const db = firebase.firestore();

// Elementos da Interface
const authBtn = document.getElementById('authBtn'); 
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const loginModalElement = document.getElementById('loginModal');
const loginModal = loginModalElement ? new bootstrap.Modal(loginModalElement) : null;

const inputUsername = document.getElementById('inputUsername'); // NOVO: Campo Username
const inputEmail = document.getElementById('inputEmail');
const inputPassword = document.getElementById('inputPassword');

const chatSendBtn = document.getElementById('chat-send-btn');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const chatStatus = document.getElementById('chat-status');
const myUidDisplay = document.getElementById('my-uid-display');

let currentUserUid = null; // Armazena o UID do usuário logado
let currentUsername = 'Anônimo'; // Armazena o Username para uso no chat

// =================================================================
// 2. FUNÇÕES DE AUTENTICAÇÃO E PERFIL
// =================================================================

/**
 * Busca o Username de um UID específico no Firestore.
 * @param {string} uid O User ID do Firebase.
 * @returns {Promise<string>} O Username ou 'Anônimo'.
 */
async function getUsernameByUid(uid) {
    if (!uid) return 'Anônimo';
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        return userDoc.exists && userDoc.data().username ? userDoc.data().username : 'Usuário (UID: ' + uid.substring(0, 4) + '...)';
    } catch (error) {
        console.error("Erro ao buscar username:", error);
        return 'Erro ao buscar nome';
    }
}

/**
 * Realiza o login do usuário. (Função inalterada, focada em credenciais)
 */
function handleLogin() {
    const email = inputEmail.value.trim();
    const password = inputPassword.value;

    if (!email || !password) {
        alert('Por favor, preencha E-mail e Senha.');
        return;
    }

    loginBtn.disabled = true;
    registerBtn.disabled = true;

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            console.log("Login bem-sucedido.");
            if (loginModal) loginModal.hide();
        })
        .catch((error) => {
            console.error("Erro no login:", error);
            alert(`Falha no Login: ${error.message}`);
        })
        .finally(() => {
            loginBtn.disabled = false;
            registerBtn.disabled = false;
        });
}

/**
 * Realiza o cadastro de um novo usuário, com VERIFICAÇÃO DE UNICIDADE do Username.
 */
async function handleRegister() {
    const email = inputEmail.value.trim();
    const password = inputPassword.value;
    const username = inputUsername.value.trim(); // NOVO: Username
    
    if (!email || !password || !username) {
        alert('Por favor, preencha E-mail, Senha e Nome de Usuário.');
        return;
    }
    if (password.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres.');
        return;
    }

    loginBtn.disabled = true;
    registerBtn.disabled = true;

    try {
        // 1. VERIFICAÇÃO DE UNICIDADE DO USERNAME (Case-Insensitive)
        const usernameLower = username.toLowerCase();
        const usernameQuery = await db.collection('usernames').doc(usernameLower).get();
        
        if (usernameQuery.exists) {
            alert(`O nome de usuário "${username}" já está em uso. Por favor, escolha outro.`);
            return;
        }

        // 2. CRIAÇÃO DO USUÁRIO NO AUTH
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // 3. ARMAZENAMENTO NO FIRESTORE (users)
        await db.collection('users').doc(user.uid).set({
            username: username,
            email: email, // Armazenado privadamente para uso interno
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 4. REGISTRO DO USERNAME (Para unicidade)
        await db.collection('usernames').doc(usernameLower).set({
            uid: user.uid
        });

        console.log("Cadastro bem-sucedido:", user.uid);
        alert('Cadastro realizado! Seja bem-vindo, ' + username + '.');
        if (loginModal) loginModal.hide();
        
    } catch (error) {
        console.error("Erro no cadastro:", error);
        alert(`Falha no Cadastro: ${error.message}`);
    } finally {
        loginBtn.disabled = false;
        registerBtn.disabled = false;
    }
}

/**
 * Realiza o logout do usuário.
 */
function handleLogout() {
    auth.signOut()
        .then(() => {
            console.log("Logout bem-sucedido.");
        })
        .catch((error) => {
            console.error("Erro no logout:", error);
            alert(`Erro ao desconectar: ${error.message}`);
        });
}

// =================================================================
// 3. LÓGICA DO CHAT GLOBAL EM TEMPO REAL (Atualizada para usar Username)
// =================================================================

/**
 * Adiciona uma nova mensagem à interface do chat, resolvendo o username.
 */
async function displayMessage(senderUid, message, timestamp) {
    const username = await getUsernameByUid(senderUid); // Busca o nome público
    
    const newMessage = document.createElement('div');
    newMessage.className = 'chat-message';
    
    const isMe = currentUserUid && currentUserUid === senderUid;
    const usernameClass = isMe ? 'my-uid-highlight' : '';
    
    let timeString = '';
    if (timestamp && timestamp.toDate) {
        const date = timestamp.toDate();
        timeString = date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    }

    newMessage.innerHTML = `
        <small class="text-muted float-end">${timeString}</small>
        <strong class="${usernameClass} me-2">${username}:</strong> 
        <span>${message}</span>
    `;
    
    chatMessages.appendChild(newMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Configura o listener em tempo real para o Chat Global.
 */
function setupGlobalChatListener() {
    // Limpa o chat para evitar duplicação em caso de recarga
    if (chatMessages) chatMessages.innerHTML = `<div class="chat-message text-muted"><small>Bem-vindo ao chat global! Faça login para participar da conversa.</small></div>`;
    
    const chatRef = db.collection('chat-global').orderBy('timestamp', 'asc');

    chatRef.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const messageData = change.doc.data();
                // Passa apenas o UID; o displayMessage resolve o Username
                displayMessage(messageData.uid, messageData.text, messageData.timestamp);
            }
        });
    }, error => {
        // ... tratamento de erro (código omitido para brevidade)
    });
}

/**
 * Envia uma nova mensagem para o Firestore.
 */
function handleChatSend() {
    const text = chatInput.value.trim();
    if (!text || !currentUserUid) return;

    chatSendBtn.disabled = true;

    const messageData = {
        uid: currentUserUid,
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
        // O email NÃO é enviado para o chat, garantindo privacidade
    };

    db.collection('chat-global').add(messageData)
        .then(() => {
            chatInput.value = '';
            chatSendBtn.disabled = false;
        })
        .catch((error) => {
            console.error("Erro ao enviar mensagem:", error);
            alert("Falha ao enviar mensagem (Verifique Regras de Escrita).");
            chatSendBtn.disabled = false;
        });
}

// =================================================================
// 4. FUNÇÕES DE TROCA E ANÚNCIO
// =================================================================

/**
 * Função placeholder para iniciar o chat privado (necessária para o card).
 */
function startPrivateChat(targetUid) {
    if (currentUserUid === targetUid) {
        alert('Você não pode negociar consigo mesmo!');
        return;
    }
    if (!currentUserUid) {
        alert('Faça login para iniciar uma negociação.');
        if (loginModal) loginModal.show();
        return;
    }
    
    // Lógica real de criação/redirecionamento para o chat privado
    alert(`Iniciando chat privado para negociação com o usuário ${targetUid}.`);
}

/**
 * Carrega e exibe os anúncios que aceitam trocas (Reutilizando a lógica anterior).
 */
function loadExchangeListings() {
    // Implementação da busca no Firestore (Igual à versão anterior)
    const exchangeListings = document.getElementById('exchange-listings');
    exchangeListings.innerHTML = '<div class="col-12 text-center text-primary"><i class="fas fa-spinner fa-spin me-2"></i> Carregando ofertas...</div>';

    db.collection('anuncios')
      .where('aceitaTroca', '==', true) 
      .limit(10)
      .get()
      .then(snapshot => {
          exchangeListings.innerHTML = '';
          if (snapshot.empty) {
              exchangeListings.innerHTML = '<div class="col-12 text-center text-muted">Nenhuma oferta de troca encontrada no momento.</div>';
              return;
          }
          
          snapshot.forEach(doc => {
              const data = doc.data();
              // Simulação de renderização do card
              const cardHtml = `
                  <div class="col-md-4">
                      <div class="card product-card shadow-sm border-purple h-100">
                          <div class="card-body">
                              <h5 class="card-title text-truncate text-purple-vibrant">${data.titulo || 'Conta de Jogo'}</h5>
                              <p class="card-text text-secondary fw-bold">Troca por: ${data.interesse || 'Aberto a propostas'}</p>
                              <span class="badge bg-warning text-dark"><i class="fas fa-exchange-alt me-1"></i> ACEITA TROCA</span>
                              <p class="card-text mt-2"><small class="text-muted">Vendedor UID: ${data.vendedorUid.substring(0, 4)}...</small></p>
                              <button class="btn btn-sm btn-purple mt-2 w-100" onclick="startPrivateChat('${data.vendedorUid}')">
                                  <i class="fas fa-comment-dots"></i> Negociar Troca
                              </button>
                          </div>
                      </div>
                  </div>
              `;
              exchangeListings.insertAdjacentHTML('beforeend', cardHtml);
          });
      })
      .catch(error => {
          exchangeListings.innerHTML = '<div class="col-12 text-center text-danger">Erro ao carregar ofertas de troca.</div>';
      });
}


// =================================================================
// 5. GERENCIAMENTO DO ESTADO DA APLICAÇÃO (UI/AUTH)
// =================================================================

/**
 * Atualiza a interface do usuário com base no estado de autenticação.
 */
async function updateUI(user) {
    if (user) {
        // ESTADO LOGADO
        currentUserUid = user.uid;
        currentUsername = await getUsernameByUid(user.uid);
        
        // 1. Navbar e Botão de Autenticação
        authBtn.innerHTML = '<i class="fas fa-sign-out-alt me-1"></i> Sair';
        authBtn.classList.remove('btn-primary');
        authBtn.classList.add('btn-secondary');

        authBtn.removeEventListener('click', handleLogin);
        authBtn.addEventListener('click', handleLogout);

        // 2. Chat Status
        if (chatStatus) {
            chatStatus.innerHTML = `Logado como: <strong>${currentUsername}</strong>. Chat Habilitado.`;
            chatStatus.classList.remove('text-danger');
            chatStatus.classList.add('text-success');
        }
        if (myUidDisplay) {
            myUidDisplay.textContent = user.uid;
        }
        if (chatSendBtn) chatSendBtn.disabled = false;
        
    } else {
        // ESTADO DESLOGADO
        currentUserUid = null;
        currentUsername = 'Anônimo';
        
        // 1. Navbar e Botão de Autenticação
        authBtn.innerHTML = '<i class="fas fa-user me-1"></i> Entrar / Cadastrar';
        authBtn.classList.remove('btn-secondary');
        authBtn.classList.add('btn-primary');

        authBtn.removeEventListener('click', handleLogout);
        if (loginModal) authBtn.addEventListener('click', () => loginModal.show());

        // 2. Chat Status
        if (chatStatus) {
            chatStatus.textContent = "Faça Login para enviar mensagens.";
            chatStatus.classList.remove('text-success');
            chatStatus.classList.add('text-danger');
        }
        if (myUidDisplay) {
            myUidDisplay.textContent = 'Aguardando Login...';
        }
        if (chatSendBtn) chatSendBtn.disabled = true;

        // Limpa inputs
        if (inputEmail) inputEmail.value = '';
        if (inputPassword) inputPassword.value = '';
        if (inputUsername) inputUsername.value = '';
    }
}

// =================================================================
// 6. EVENT LISTENERS GERAIS E INICIALIZAÇÃO
// =================================================================

/**
 * Lógica de Redirecionamento de Categoria
 */
function setupCategoryListeners() {
    document.querySelectorAll('.category-link').forEach(link => {
        link.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            // Redireciona para pesquisa.html com o parâmetro de categoria
            window.open(`pesquisa.html?cat=${encodeURIComponent(category)}`, '_blank');
        });
    });
}

// 6.1. Listener do Estado de Autenticação
auth.onAuthStateChanged(updateUI);

// 6.2. Eventos de Login/Cadastro
if (loginBtn) loginBtn.addEventListener('click', handleLogin);
if (registerBtn) registerBtn.addEventListener('click', handleRegister);

// 6.3. Eventos do Chat
if (chatSendBtn) chatSendBtn.addEventListener('click', handleChatSend);
if (chatInput) chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !chatSendBtn.disabled) {
        e.preventDefault();
        handleChatSend();
    }
});

// 6.4. Eventos de Troca
const loadExchangeBtn = document.getElementById('loadExchangeBtn');
if (loadExchangeBtn) loadExchangeBtn.addEventListener('click', loadExchangeListings);

// 6.5. Inicialização de Listeners
setupGlobalChatListener();
setupCategoryListeners();

console.log("script.js carregado: Lógica da plataforma ativada.");

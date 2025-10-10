// =================================================================
// 1. INICIALIZAÇÃO DO FIREBASE E VARIÁVEIS GLOBAIS
// =================================================================

// Referências aos serviços do Firebase (Assumindo que o app foi inicializado no index.html)
const auth = firebase.auth();
const db = firebase.firestore();

// Elementos da Interface (IDs do index.html atualizado)
const authBtn = document.getElementById('authBtn'); // Botão na Navbar (Entrar/Sair)
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const loginModalElement = document.getElementById('loginModal');
const loginModal = loginModalElement ? new bootstrap.Modal(loginModalElement) : null;

const chatSendBtn = document.getElementById('chat-send-btn');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const chatStatus = document.getElementById('chat-status');
const myUidDisplay = document.getElementById('my-uid-display');

const inputEmail = document.getElementById('inputEmail');
const inputPassword = document.getElementById('inputPassword');

let currentUserUid = null; // Armazena o UID do usuário logado

// =================================================================
// 2. FUNÇÕES DE AUTENTICAÇÃO
// =================================================================

/**
 * Realiza o login do usuário.
 */
function handleLogin() {
    const email = inputEmail.value.trim();
    const password = inputPassword.value;

    if (!email || !password) {
        alert('Por favor, preencha todos os campos.');
        return;
    }

    // Desabilita botões para evitar cliques múltiplos
    loginBtn.disabled = true;
    registerBtn.disabled = true;

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            // O auth.onAuthStateChanged cuidará da atualização da UI
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
 * Realiza o cadastro de um novo usuário.
 */
function handleRegister() {
    const email = inputEmail.value.trim();
    const password = inputPassword.value;

    if (password.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres.');
        return;
    }

    // Desabilita botões
    loginBtn.disabled = true;
    registerBtn.disabled = true;

    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            // O usuário é logado automaticamente após o cadastro
            console.log("Cadastro bem-sucedido.");
            alert('Cadastro realizado com sucesso! Bem-vindo.');
            if (loginModal) loginModal.hide();
        })
        .catch((error) => {
            console.error("Erro no cadastro:", error);
            alert(`Falha no Cadastro: ${error.message}`);
        })
        .finally(() => {
            loginBtn.disabled = false;
            registerBtn.disabled = false;
        });
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
// 3. LÓGICA DO CHAT GLOBAL EM TEMPO REAL
// =================================================================

/**
 * Adiciona uma nova mensagem à interface do chat.
 * @param {string} senderEmail E-mail do remetente.
 * @param {string} message Conteúdo da mensagem.
 * @param {string} senderUid UID do remetente.
 * @param {Date | null} timestamp Data/Hora da mensagem (pode ser null na leitura inicial).
 */
function displayMessage(senderEmail, message, senderUid, timestamp) {
    const newMessage = document.createElement('div');
    newMessage.className = 'chat-message';
    
    const isMe = currentUserUid && currentUserUid === senderUid;
    const emailClass = isMe ? 'my-uid-highlight' : '';
    
    let timeString = '';
    if (timestamp && timestamp.toDate) {
        // Formata o timestamp do Firestore para exibição
        const date = timestamp.toDate();
        timeString = date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    }

    newMessage.innerHTML = `
        <small class="text-muted float-end">${timeString}</small>
        <strong class="${emailClass} me-2">${senderEmail}:</strong> 
        <span>${message}</span>
    `;
    
    chatMessages.appendChild(newMessage);
    // Rola automaticamente para a mensagem mais recente
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Configura o listener em tempo real para o Chat Global.
 */
function setupGlobalChatListener() {
    // Ordena as mensagens por timestamp para exibir na ordem correta
    const chatRef = db.collection('chat-global').orderBy('timestamp', 'asc');

    chatRef.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const messageData = change.doc.data();
                displayMessage(messageData.email, messageData.text, messageData.uid, messageData.timestamp);
            }
        });
    }, error => {
        console.error("Erro ao escutar o Chat Global (Verifique as Regras de Segurança):", error);
        if (chatStatus) {
            chatStatus.textContent = "Erro de conexão com o chat.";
            chatStatus.classList.remove('text-success');
            chatStatus.classList.add('text-danger');
        }
    });
}

/**
 * Envia uma nova mensagem para o Firestore.
 */
function handleChatSend() {
    const text = chatInput.value.trim();
    if (!text || !currentUserUid) return;

    chatSendBtn.disabled = true; // Desabilita para evitar envio duplo

    const messageData = {
        uid: currentUserUid,
        email: auth.currentUser.email,
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
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
// 4. GERENCIAMENTO DO ESTADO DA APLICAÇÃO (UI/AUTH)
// =================================================================

/**
 * Atualiza a interface do usuário com base no estado de autenticação.
 */
function updateUI(user) {
    if (user) {
        // ESTADO LOGADO
        currentUserUid = user.uid;
        
        // 1. Navbar e Botão de Autenticação
        authBtn.innerHTML = '<i class="fas fa-sign-out-alt me-1"></i> Sair';
        authBtn.classList.remove('btn-primary');
        authBtn.classList.add('btn-secondary');

        // Remove listener de modal e adiciona o listener de logout
        authBtn.removeEventListener('click', () => loginModal.show());
        authBtn.addEventListener('click', handleLogout);

        // 2. Chat Status
        if (chatStatus) {
            chatStatus.innerHTML = `Logado como: <strong>${user.email}</strong>. Chat Habilitado.`;
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
        
        // 1. Navbar e Botão de Autenticação
        authBtn.innerHTML = '<i class="fas fa-user me-1"></i> Entrar / Cadastrar';
        authBtn.classList.remove('btn-secondary');
        authBtn.classList.add('btn-primary');

        // Remove listener de logout e adiciona o listener de modal
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

        // 3. Limpa o chat e inputs
        if (chatMessages) chatMessages.innerHTML = `<div class="chat-message text-muted"><small>Bem-vindo ao chat global! Faça login para participar da conversa.</small></div>`;
        if (inputEmail) inputEmail.value = '';
        if (inputPassword) inputPassword.value = '';
    }
}

// =================================================================
// 5. EVENT LISTENERS GERAIS E INICIALIZAÇÃO
// =================================================================

// 5.1. Listener do Estado de Autenticação
auth.onAuthStateChanged(updateUI);

// 5.2. Eventos de Login/Cadastro
if (loginBtn) loginBtn.addEventListener('click', handleLogin);
if (registerBtn) registerBtn.addEventListener('click', handleRegister);

// 5.3. Eventos do Chat
if (chatSendBtn) chatSendBtn.addEventListener('click', handleChatSend);

// Permite enviar mensagem pressionando Enter
if (chatInput) chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !chatSendBtn.disabled) {
        e.preventDefault(); // Previne a quebra de linha
        handleChatSend();
    }
});

// 5.4. Inicialização do Listener do Chat Global
setupGlobalChatListener();

console.log("script.js carregado: Lógica da plataforma ativada.");

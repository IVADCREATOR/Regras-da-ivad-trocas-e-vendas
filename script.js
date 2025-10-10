// =================================================================
// 1. VARIÁVEIS DE CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE
// =================================================================

// Supondo que 'firebaseConfig' e 'app' foram inicializados no index.html
// e que as bibliotecas SDKs (app, auth, firestore) foram carregadas.
const auth = firebase.auth();
const db = firebase.firestore();

// Elementos da UI
const loginModalElement = document.getElementById('loginModal');
const loginModal = loginModalElement ? new bootstrap.Modal(loginModalElement) : null;
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn'); // Necessário adicionar este botão na navbar do index.html
const inputEmail = document.getElementById('inputEmail');
const inputPassword = document.getElementById('inputPassword');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const chatStatus = document.getElementById('chat-status');
const myUidDisplay = document.getElementById('my-uid-display'); // Adicionar um elemento para mostrar o UID

let currentUserUid = null;

// =================================================================
// 2. FUNÇÕES DE AUTENTICAÇÃO
// =================================================================

/**
 * Realiza o login de um usuário com e-mail e senha.
 */
function handleLogin() {
    const email = inputEmail.value;
    const password = inputPassword.value;

    if (!email || !password) {
        alert('Por favor, preencha E-mail e Senha.');
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log("Login bem-sucedido:", userCredential.user.uid);
            // O auth.onAuthStateChanged cuidará da atualização da UI
            alert('Login realizado com sucesso!');
            if (loginModal) loginModal.hide();

        })
        .catch((error) => {
            console.error("Erro no login:", error);
            alert(`Erro no Login: ${error.message}`);
        });
}

/**
 * Realiza o cadastro de um novo usuário com e-mail e senha.
 */
function handleRegister() {
    const email = inputEmail.value;
    const password = inputPassword.value;

    if (password.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres.');
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log("Cadastro bem-sucedido:", userCredential.user.uid);
            alert('Cadastro e Login realizados com sucesso! Bem-vindo ao IVAD.');
            if (loginModal) loginModal.hide();

        })
        .catch((error) => {
            console.error("Erro no cadastro:", error);
            alert(`Erro no Cadastro: ${error.message}`);
        });
}

/**
 * Realiza o logout do usuário.
 */
function handleLogout() {
    auth.signOut()
        .then(() => {
            console.log("Logout bem-sucedido.");
            alert('Você foi desconectado.');
            // O auth.onAuthStateChanged cuidará da atualização da UI
        })
        .catch((error) => {
            console.error("Erro no logout:", error);
            alert(`Erro ao fazer Logout: ${error.message}`);
        });
}

// =================================================================
// 3. LÓGICA DO CHAT GLOBAL EM TEMPO REAL
// =================================================================

/**
 * Renderiza uma nova mensagem na área de chat.
 * @param {string} senderEmail E-mail do remetente.
 * @param {string} message Conteúdo da mensagem.
 * @param {string} senderUid UID do remetente.
 */
function displayMessage(senderEmail, message, senderUid) {
    const newMessage = document.createElement('div');
    newMessage.className = 'chat-message';
    
    // Destaca o nome se for o usuário logado
    const isMe = currentUserUid && currentUserUid === senderUid;
    const emailClass = isMe ? 'my-uid-highlight' : '';

    // Utiliza o UID do usuário logado na variável global para destaque
    newMessage.innerHTML = `<strong class="${emailClass}">${senderEmail}:</strong> ${message}`;
    
    chatMessages.appendChild(newMessage);
    // Rola para a mensagem mais recente
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Escuta novas mensagens no Firestore e as exibe.
 */
function setupGlobalChatListener() {
    // Referência à coleção de chat
    const chatRef = db.collection('chat-global').orderBy('timestamp', 'asc');

    // Listener em tempo real
    chatRef.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const messageData = change.doc.data();
                displayMessage(messageData.email, messageData.text, messageData.uid);
            }
        });
    }, error => {
        console.error("Erro ao escutar o Chat Global:", error);
        if (chatStatus) {
            chatStatus.textContent = "Erro ao carregar o chat. Verifique as regras do Firestore.";
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

    // Dados da mensagem
    const messageData = {
        uid: currentUserUid,
        email: auth.currentUser.email,
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp() // Para ordenação
    };

    db.collection('chat-global').add(messageData)
        .then(() => {
            chatInput.value = ''; // Limpa o input após o envio
            console.log("Mensagem enviada com sucesso!");
        })
        .catch((error) => {
            console.error("Erro ao enviar mensagem:", error);
            alert("Erro ao enviar mensagem. Tente novamente.");
        });
}


// =================================================================
// 4. GERENCIAMENTO DO ESTADO DA APLICAÇÃO (UI/AUTH)
// =================================================================

/**
 * Listener principal do Firebase Auth. Atualiza a UI e habilita/desabilita o chat.
 */
auth.onAuthStateChanged(user => {
    if (user) {
        // Usuário logado
        currentUserUid = user.uid;
        
        // 1. Atualiza o Status do Chat
        if (chatStatus) {
            chatStatus.innerHTML = `Logado como: <strong>${user.email}</strong> (UID: <span class="my-uid-highlight">${user.uid}</span>). Chat Habilitado.`;
            chatStatus.classList.remove('text-danger');
            chatStatus.classList.add('text-success');
        }

        // 2. Habilita Elementos
        if (chatSendBtn) chatSendBtn.disabled = false;
        
        // 3. Atualiza Navbar para Logout
        const loginRegisterBtn = document.querySelector('[data-bs-target="#loginModal"]');
        if (loginRegisterBtn) {
            loginRegisterBtn.innerHTML = '<i class="fas fa-sign-out-alt me-1"></i> Sair';
            loginRegisterBtn.removeEventListener('click', loginModal.show);
            loginRegisterBtn.addEventListener('click', handleLogout);
        }
        
    } else {
        // Usuário deslogado
        currentUserUid = null;
        
        // 1. Atualiza o Status do Chat
        if (chatStatus) {
            chatStatus.textContent = "Faça Login para enviar mensagens.";
            chatStatus.classList.remove('text-success');
            chatStatus.classList.add('text-danger');
        }

        // 2. Desabilita Elementos
        if (chatSendBtn) chatSendBtn.disabled = true;

        // 3. Atualiza Navbar para Login
        const loginRegisterBtn = document.querySelector('[data-bs-target="#loginModal"]');
        if (loginRegisterBtn) {
            loginRegisterBtn.innerHTML = '<i class="fas fa-user me-1"></i> Entrar / Cadastrar';
            loginRegisterBtn.removeEventListener('click', handleLogout);
            if (loginModal) loginRegisterBtn.addEventListener('click', () => loginModal.show());
        }
        
        // Limpa o chat
        if (chatMessages) chatMessages.innerHTML = `<div class="chat-message text-muted"><small>Bem-vindo ao chat global! Mensagens em tempo real aparecerão aqui.</small></div>`;
    }
});


// =================================================================
// 5. EVENT LISTENERS
// =================================================================

// Chama a função principal de escuta de chat assim que o script é executado
setupGlobalChatListener();

// Eventos do Modal de Autenticação
if (loginBtn) loginBtn.addEventListener('click', handleLogin);
if (registerBtn) registerBtn.addEventListener('click', handleRegister);

// Eventos de Chat
if (chatSendBtn) chatSendBtn.addEventListener('click', handleChatSend);
// Permite enviar mensagem com a tecla Enter
if (chatInput) chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !chatSendBtn.disabled) {
        handleChatSend();
    }
});

// Inicialização da aplicação
console.log("script.js carregado e inicializado.");

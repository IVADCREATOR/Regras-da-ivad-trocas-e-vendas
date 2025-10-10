// =================================================================
// script.js - Lógica Central do IVAD Marketplace
// =================================================================

// 1. Variáveis Globais e Inicialização do Firebase
const auth = firebase.auth();
const db = firebase.firestore();

let currentUserUid = null;
let currentUsername = null;
let globalChatListener = null;

// =================================================================
// 2. FUNÇÕES DE AUTENTICAÇÃO (LOGIN / REGISTRO)
// =================================================================

// Função utilitária para obter nome de usuário
async function getUsernameByUid(uid) {
    if (!uid) return 'Desconhecido';
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        return userDoc.exists && userDoc.data().username ? userDoc.data().username : 'Usuário IVAD';
    } catch (error) {
        console.error("Erro ao buscar username:", error);
        return 'Erro na Busca';
    }
}

// Manipulador do botão principal de autenticação
document.addEventListener('DOMContentLoaded', () => {
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
        authBtn.addEventListener('click', () => {
            if (currentUserUid) {
                // Se logado, é o botão de Logout
                auth.signOut().then(() => {
                    alert("Você foi desconectado.");
                }).catch(error => {
                    console.error("Erro ao sair:", error);
                    alert("Erro ao tentar sair.");
                });
            } else {
                // Se deslogado, abre o modal
                const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                loginModal.show();
            }
        });
    }

    // Lógica dentro do Modal de Login/Registro
    const registerBtn = document.getElementById('registerBtn');
    const loginBtn = document.getElementById('loginBtn');
    
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    }
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
});

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

        // Salva o nome de usuário no Firestore
        await db.collection('users').doc(user.uid).set({
            username: username,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(`Bem-vindo, ${username}! Seu registro foi concluído.`);
        // Fecha o modal de login
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
        // Fecha o modal de login
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (modalInstance) modalInstance.hide();
    } catch (error) {
        console.error("Erro no Login:", error);
        alert(`Falha no Login: ${error.message}`);
    }
}

// Listener de Status de Autenticação
auth.onAuthStateChanged(async (user) => {
    const authBtn = document.getElementById('authBtn');
    const uidDisplay = document.getElementById('my-uid-display');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatStatus = document.getElementById('chat-status');

    if (user) {
        currentUserUid = user.uid;
        currentUsername = await getUsernameByUid(user.uid);
        
        // Atualiza a UI para estado Logado
        if (authBtn) {
            authBtn.textContent = `Olá, ${currentUsername} (Sair)`;
            authBtn.classList.remove('btn-primary');
            authBtn.classList.add('btn-danger');
        }
        if (uidDisplay) {
            uidDisplay.textContent = currentUserUid;
        }
        if (chatSendBtn) {
            chatSendBtn.disabled = false;
        }
        if (chatStatus) {
            chatStatus.textContent = 'Ativo';
            chatStatus.classList.add('text-success');
            chatStatus.classList.remove('text-muted');
        }
        
        // Inicia o Chat Global
        startGlobalChatListener();

    } else {
        currentUserUid = null;
        currentUsername = null;
        
        // Atualiza a UI para estado Deslogado
        if (authBtn) {
            authBtn.innerHTML = '<i class="fas fa-user me-1"></i> Entrar / Cadastrar';
            authBtn.classList.add('btn-primary');
            authBtn.classList.remove('btn-danger');
        }
        if (uidDisplay) {
            uidDisplay.textContent = 'Deslogado';
        }
        if (chatSendBtn) {
            chatSendBtn.disabled = true;
        }
        if (chatStatus) {
            chatStatus.textContent = 'Login Necessário';
            chatStatus.classList.remove('text-success');
            chatStatus.classList.add('text-muted');
        }
        
        // Para o Chat Global
        if (globalChatListener) {
            globalChatListener();
        }
    }
});


// =================================================================
// 3. EXIBIÇÃO DE ANÚNCIOS (INDEX.HTML) - Usando Firebase Storage URLs
// =================================================================

/**
 * Cria o HTML para um card de anúncio.
 * @param {Object} doc Firestore Document Snapshot.
 * @param {Object} data Dados do anúncio.
 * @param {string} vendedorName Nome do vendedor.
 * @returns {string} HTML do card.
 */
function createListingCard(doc, data, vendedorName) {
    const price = data.preco ? `R$ ${data.preco.toFixed(2).replace('.', ',')}` : 'A Combinar';
    // CHAVE: Usa o primeiro elemento do array imageUrls (URL PÚBLICA)
    const imageUrl = data.imageUrls && data.imageUrls.length > 0 
                     ? data.imageUrls[0] 
                     : 'https://via.placeholder.com/400x200?text=Sem+Imagem';
    
    // Indica se aceita troca
    const exchangeBadge = data.aceitaTroca 
        ? '<span class="badge bg-warning text-dark float-end">ACEITA TROCA</span>' 
        : '';
        
    // Limita a descrição
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
 * Carrega anúncios que aceitam troca para a seção principal.
 */
async function loadExchangeListings() {
    const container = document.getElementById('exchange-listings');
    if (!container) return; // Só carrega se estiver no index.html

    container.innerHTML = '<div class="col-12 text-center text-primary"><i class="fas fa-spinner fa-spin me-2"></i> Buscando ofertas de troca...</div>';
    
    try {
        const snapshot = await db.collection('anuncios')
            .where('aceitaTroca', '==', true)
            .where('status', '==', 'ativo') // Apenas anúncios ativos
            .orderBy('dataCriacao', 'desc')
            .limit(6)
            .get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="col-12 text-center text-muted">Nenhuma oferta de troca disponível no momento.</div>';
            return;
        }

        let listingsHtml = '';
        const userCache = {}; // Cache para evitar buscas repetidas de username

        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Busca o nome do vendedor (usando cache)
            if (!userCache[data.vendedorUid]) {
                userCache[data.vendedorUid] = await getUsernameByUid(data.vendedorUid);
            }
            const vendedorName = userCache[data.vendedorUid];

            listingsHtml += createListingCard(doc, data, vendedorName);
        }

        container.innerHTML = listingsHtml;

    } catch (error) {
        console.error("Erro ao carregar ofertas de troca:", error);
        container.innerHTML = '<div class="col-12 text-center text-danger">Erro ao carregar anúncios. Tente novamente.</div>';
    }
}

// Event listener para recarregar as ofertas de troca
document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('loadExchangeBtn');
    if (loadBtn) {
        loadBtn.addEventListener('click', loadExchangeListings);
        // Carrega as ofertas automaticamente na inicialização
        loadExchangeListings(); 
    }
    
    // Configura os links de categoria (redireciona para a futura pesquisa.html)
    document.querySelectorAll('.category-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const category = e.currentTarget.getAttribute('data-category');
            window.location.href = `pesquisa.html?category=${encodeURIComponent(category)}`;
        });
    });
});

// =================================================================
// 4. CHAT GLOBAL (FIREBASE REALTIME LISTENERS)
// =================================================================

const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatMessagesContainer = document.getElementById('chat-messages');

function startGlobalChatListener() {
    // Se já houver um listener, para-o primeiro
    if (globalChatListener) globalChatListener(); 

    // Ouve mensagens em tempo real
    globalChatListener = db.collection('global_chat')
        .orderBy('timestamp', 'desc')
        .limit(15)
        .onSnapshot(async (snapshot) => {
            let messagesHtml = '';
            const messages = snapshot.docs.map(doc => doc.data()).reverse(); // Inverte para mostrar a mais nova embaixo
            const uidCache = {};
            
            for (const data of messages) {
                // Usa cache para username
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
                        <span class="${nameClass}">${senderName}</span>
                        <span class="text-muted small">(${time}):</span> ${data.message}
                    </div>
                `;
            }

            chatMessagesContainer.innerHTML = messagesHtml;
            // Rola para o final
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }, (error) => {
            console.error("Erro no listener do chat global:", error);
            chatMessagesContainer.innerHTML = '<div class="text-danger small">Erro ao carregar o chat.</div>';
        });
}

// Envio de mensagem
if (chatSendBtn) {
    chatSendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

function sendMessage() {
    const message = chatInput.value.trim();
    if (!message || !currentUserUid) return;

    db.collection('global_chat').add({
        uid: currentUserUid,
        message: message,
        // O username será buscado pelo listener, mas salvar o timestamp é crucial
        timestamp: firebase.firestore.FieldValue.serverTimestamp() 
    }).then(() => {
        chatInput.value = ''; // Limpa o input
    }).catch(error => {
        console.error("Erro ao enviar mensagem:", error);
        alert("Falha ao enviar mensagem de chat.");
    });
}

// Função placeholder para chat privado (chamada de detalhes.html)
function startPrivateChat(targetUid) {
    if (!currentUserUid) {
        alert("Você deve estar logado para iniciar um chat privado.");
        return;
    }
    if (currentUserUid === targetUid) {
        alert("Você não pode iniciar um chat privado consigo mesmo.");
        return;
    }
    
    // Implementação futura: Redirecionar para a página de chat privado ou abrir modal
    console.log(`Iniciando chat privado com UID: ${targetUid}`);
    alert(`Funcionalidade de chat privado com o usuário ${targetUid} será implementada em breve!`);
}

// Expõe a função para uso externo (detalhes.html)
window.startPrivateChat = startPrivateChat;


// =================================================================
// 5. SISTEMA DE DOAÇÃO PIX
// =================================================================

// ⚠️ SUBSTITUA PELA SUA CHAVE PIX REAL (Email, Telefone, ou Chave Aleatória) ⚠️
const PIX_KEY = "11913429349"; 

/**
 * Função para mostrar o modal de doação apenas uma vez por sessão.
 */
function setupDonationModal() {
    const modalElement = document.getElementById('donationModal');
    if (!modalElement) return;

    const hasSeenDonation = sessionStorage.getItem('ivad_donation_seen');
    const pixKeyDisplay = document.getElementById('pixKeyDisplay');
    const copyPixKeyBtn = document.getElementById('copyPixKeyBtn');
    const closeAndContinueBtn = document.getElementById('closeAndContinueBtn');

    // 1. Configura a Chave Pix no input
    pixKeyDisplay.value = PIX_KEY;

    // 2. Lógica de Cópia da Chave Pix
    if (copyPixKeyBtn) {
        copyPixKeyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(PIX_KEY).then(() => {
                const originalText = copyPixKeyBtn.innerHTML;
                copyPixKeyBtn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
                
                // Volta ao normal após 2 segundos
                setTimeout(() => {
                    copyPixKeyBtn.innerHTML = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Falha ao copiar:', err);
                alert('Erro ao copiar a chave Pix. Por favor, copie manualmente.');
            });
        });
    }

    // 3. Exibição do Modal (Apenas se o usuário não o viu nesta sessão)
    if (!hasSeenDonation) {
        // Usa o objeto Modal do Bootstrap
        const donationModal = new bootstrap.Modal(modalElement, {
            backdrop: 'static', // Impede que o usuário clique fora
            keyboard: false // Impede que o usuário use ESC
        }); 
        donationModal.show();
        
        // 4. Marca como visto ao fechar o modal
        const setSeen = () => {
            sessionStorage.setItem('ivad_donation_seen', 'true');
        };

        // Marca como visto se o modal for fechado (pelo 'X' ou pelo botão 'Acessar Site')
        modalElement.addEventListener('hidden.bs.modal', setSeen);
        
        // Garante que, ao clicar em "Acessar Site Sem Doar", ele seja marcado como visto
        if (closeAndContinueBtn) {
            closeAndContinueBtn.addEventListener('click', setSeen);
        }
    }
    
    // 5. Configuração dos botões de sugestão de valor (opcional, para feedback visual)
    document.querySelectorAll('#donationModal .btn[data-amount]').forEach(btn => {
        btn.addEventListener('click', function() {
            // No caso de um Pix estático (chave), apenas copia a chave
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
    // Configura o sistema de doação Pix
    if (document.getElementById('donationModal')) {
        setupDonationModal();
    }
});

console.log("script.js carregado: Lógica de autenticação, anúncios e chat global prontas.");

// Este script só será executado em pesquisa.html.
// Presume-se que o 'db' do Firestore já foi inicializado no HTML.

document.addEventListener('DOMContentLoaded', () => {
    // 1. Elementos da Interface
    const categoryDisplay = document.getElementById('current-category');
    const listingsContainer = document.getElementById('listings-container');

    // 2. Função para Obter Parâmetros da URL
    function getQueryParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    // 3. Função para Renderizar o Card de Anúncio
    function renderProductCard(data, id) {
        const cardHtml = `
            <div class="col-md-4">
                <div class="card product-card shadow-sm h-100">
                    <div class="card-body">
                        <h5 class="card-title text-truncate">${data.titulo || 'Anúncio Sem Título'}</h5>
                        <p class="product-price">R$ ${parseFloat(data.preco).toFixed(2) || 'A Negociar'}</p>
                        <span class="badge bg-primary me-1">${data.category}</span>
                        ${data.aceitaTroca ? '<span class="badge bg-warning text-dark"><i class="fas fa-exchange-alt"></i> Troca</span>' : ''}
                        <p class="card-text mt-2"><small class="text-muted">Vendedor UID: ${data.vendedorUid.substring(0, 4)}...</small></p>
                        <button class="btn btn-sm btn-purple mt-2 w-100" onclick="window.location.href='detalhes.html?id=${id}'">
                            <i class="fas fa-eye"></i> Ver Detalhes
                        </button>
                    </div>
                </div>
            </div>
        `;
        listingsContainer.insertAdjacentHTML('beforeend', cardHtml);
    }

    // 4. Lógica Principal: Ler Parâmetro e Carregar Anúncios
    async function loadCategoryListings() {
        const categoryFilter = getQueryParameter('cat');

        if (!categoryFilter) {
            categoryDisplay.textContent = 'Todas as Categorias';
            listingsContainer.innerHTML = '<div class="col-12 text-center text-info">Nenhuma categoria especificada na URL. Exibindo todos (ou erro).</div>';
            return;
        }

        // Exibe o filtro no título
        categoryDisplay.textContent = decodeURIComponent(categoryFilter);
        listingsContainer.innerHTML = '<div class="col-12 text-center text-primary"><i class="fas fa-spinner fa-spin me-2"></i> Buscando anúncios de ' + categoryFilter + '...</div>';

        try {
            // Consulta o Firestore, filtrando pelo campo 'category'
            const snapshot = await db.collection('anuncios')
                .where('category', '==', categoryFilter)
                .limit(20)
                .get();

            listingsContainer.innerHTML = ''; // Limpa o carregamento

            if (snapshot.empty) {
                listingsContainer.innerHTML = `<div class="col-12 text-center text-muted">Não foram encontrados anúncios na categoria **${categoryFilter}**.</div>`;
                return;
            }

            snapshot.forEach(doc => {
                renderProductCard(doc.data(), doc.id);
            });

        } catch (error) {
            console.error("Erro ao carregar anúncios por categoria:", error);
            listingsContainer.innerHTML = '<div class="col-12 text-center text-danger">Erro de conexão com o banco de dados. Tente novamente mais tarde.</div>';
        }
    }

    // Inicia a função de carregamento
    loadCategoryListings();
});

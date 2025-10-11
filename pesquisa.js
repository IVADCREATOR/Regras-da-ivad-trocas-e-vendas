// =========================================================================
// pesquisa.js - Lógica Dedicada de Categorias, Busca e Filtragem
// =========================================================================

// As dependências do Firebase (db) devem ser acessíveis globalmente, 
// pois o script.js e o Firebase são carregados antes deste arquivo no HTML.
const db = firebase.firestore(); 

// Elemento onde os resultados da listagem serão injetados.
const LISTINGS_CONTAINER_ID = 'listings-results';

/**
 * Cria e retorna o HTML de um Card de Anúncio.
 * (Mantenha esta função aqui para que ela não precise ser duplicada ou importada no script.js)
 */
function createListingCard(listing) {
    const detailUrl = `detalhe_anuncio.html?id=${listing.id}`; 
    const exchangeBadge = listing.acceptsExchange ? 
        `<span class="badge bg-warning text-dark me-1"><i class="fas fa-exchange-alt"></i> Troca</span>` : '';
    const priceDisplay = listing.price ? 
        `R$ ${listing.price.toFixed(2).replace('.', ',')}` : 'A Combinar';
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
function renderListings(listings) {
    const container = document.getElementById(LISTINGS_CONTAINER_ID);
    const resultsCount = document.getElementById('results-count');
    if (!container) return;

    if (listings.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center text-muted py-5">
                <i class="fas fa-box-open me-2"></i> Nenhum anúncio encontrado.
            </div>
        `;
        if (resultsCount) resultsCount.textContent = '0';
        return;
    }

    const html = listings.map(createListingCard).join('');
    container.innerHTML = html;
    if (resultsCount) resultsCount.textContent = listings.length;
}

/**
 * Executa a lógica de pesquisa e filtragem no Firestore.
 */
async function executeSearch(searchTerm, categoryFilter) {
    const container = document.getElementById(LISTINGS_CONTAINER_ID);
    const filterDisplay = document.getElementById('current-filter-display');
    if (!container || !filterDisplay) return;

    // Atualiza o display de filtro (para feedback no celular)
    let filterMessage = 'Todos os Anúncios';
    if (searchTerm && categoryFilter) {
        filterMessage = `Busca: "${searchTerm}" em ${categoryFilter}`;
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

        // 1. Filtro por Categoria (otimizado no Firestore)
        if (categoryFilter) {
            query = query.where('category', '==', categoryFilter);
        }

        // 2. Executa a query
        const snapshot = await query.orderBy('createdAt', 'desc').get();
        let listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 3. Filtragem de Texto no Cliente (para buscas 'like')
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            listings = listings.filter(listing => 
                listing.title.toLowerCase().includes(lowerSearchTerm) ||
                listing.description.toLowerCase().includes(lowerSearchTerm)
            );
        }
        
        renderListings(listings);

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
 * Chamado no DOMContentLoaded.
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

            // CRÍTICO: Atualiza a URL e executa a nova pesquisa
            const newUrl = `pesquisa.html?q=${encodeURIComponent(newSearchTerm)}&category=${encodeURIComponent(newCategory)}`;
            // Garante que o histórico do navegador reflita a nova busca
            window.history.pushState({ path: newUrl }, '', newUrl); 
            executeSearch(newSearchTerm, newCategory);
        });
    }
}

// =========================================================================
// INICIALIZAÇÃO E LISTENER DE CATEGORIAS (para a index.html)
// =========================================================================

/**
 * CRÍTICO: Configura listeners para os cards de categoria na index.html.
 * Esta função deve ser chamada no DOMContentLoaded do script.js
 */
function setupCategoryListeners() {
    const categoryLinks = document.querySelectorAll('.category-link');
    
    if (categoryLinks.length === 0) {
        console.warn("Nenhum elemento .category-link encontrado (esperado se não for index.html).");
        return;
    }
    
    // TESTE DE DIAGNÓSTICO E REDIRECIONAMENTO
    categoryLinks.forEach(card => {
        // Remove qualquer listener anterior, se houver
        // Nota: Não é necessário se o script só for carregado uma vez, mas é uma boa prática
        
        card.addEventListener('click', (event) => {
            event.preventDefault(); // Evita o comportamento padrão do link, se houver

            const category = event.currentTarget.getAttribute('data-category');
            
            // Log para diagnóstico (remover após a correção)
            console.log(`DIAGNÓSTICO (pesquisa.js): Categoria Clicada! -> [${category}]`); 
            
            if (category) {
                // Se o clique funcionar, esta linha irá redirecionar
                window.location.href = `pesquisa.html?category=${encodeURIComponent(category)}`;
            }
        });
    });
}


// Execução para a página pesquisa.html
document.addEventListener('DOMContentLoaded', () => {
    // Roda a lógica de busca APENAS se o formulário de pesquisa existir na página
    if (document.getElementById('search-form')) {
        handleSearchPageLoad();
    }
});

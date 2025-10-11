// =========================================================================
// 1. CONSTANTES E REFERÊNCIAS
//    (Depende das referências 'db' e da função 'createListingCard' de script.js)
// =========================================================================

const LISTINGS_PER_PAGE = 12; // Número de resultados por página

// As dependências globais (db, createListingCard) são assumidas do script.js
// para evitar repetição de código e garantir a modularidade.

// =========================================================================
// 2. LÓGICA DE CATEGORIAS (index.html)
//    CRÍTICO: Fluxo de Redirecionamento de Categoria Reativado
// =========================================================================

/**
 * Anexa listeners de evento aos cards de categoria na página index.html.
 * Esta função deve ser chamada APENAS em index.html.
 */
function setupCategoryListeners() {
    console.log("DIAGNÓSTICO: Tentando anexar listeners de categoria (Módulo funcional).");
    
    // Seleciona todos os elementos com a classe category-link
    const categoryLinks = document.querySelectorAll('.category-link');
    
    if (categoryLinks.length > 0) {
        categoryLinks.forEach(card => {
            const categoryName = card.getAttribute('data-category');
            
            if (categoryName) {
                // Adiciona o listener de clique
                card.addEventListener('click', (e) => {
                    // Previne o comportamento padrão (necessário se o card for um link)
                    e.preventDefault(); 
                    
                    console.log(`CLIQUE CAPTURADO: Redirecionando para categoria: ${categoryName}`);
                    
                    // CRÍTICO: Redirecionamento funcional para a página de pesquisa
                    window.location.href = `pesquisa.html?category=${encodeURIComponent(categoryName)}`;
                });
            }
        });
        console.log(`DIAGNÓSTICO: ${categoryLinks.length} listeners de categoria reativados com sucesso.`);
    } else {
        console.log("DIAGNÓSTICO: Nenhum card com classe .category-link encontrado (OK se não for index.html).");
    }
}

// =========================================================================
// 3. LÓGICA DE BUSCA (pesquisa.html)
// =========================================================================

/**
 * Lê os parâmetros de URL e retorna os filtros atuais.
 */
function getUrlFilters() {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category') || '';
    const query = urlParams.get('query') || '';

    return { category, query };
}

/**
 * Executa a consulta de listagens no Firestore com base nos filtros fornecidos.
 */
async function fetchListings(filters) {
    // Assume que 'db' é uma variável global definida em script.js/HTML
    if (typeof db === 'undefined') {
         console.error("ERRO: O objeto 'db' do Firebase Firestore não está definido.");
         return [];
    }

    const { category, query } = filters;
    let queryRef = db.collection('listings')
                      .where('status', '==', 'active');
    
    // Filtro por CATEGORIA
    if (category) {
        queryRef = queryRef.where('category', '==', category);
    }

    // Filtro por BUSCA (palavra-chave) - Apenas para demonstração, mantendo o aviso
    if (query) {
        console.warn("Busca por palavra-chave no Firestore é limitada (sem full-text search).");
        // Em um ambiente de produção, esta busca deve ser feita em um campo indexado ou com uma ferramenta externa.
    }
    
    // Ordem e Limite
    queryRef = queryRef.orderBy('createdAt', 'desc')
                       .limit(LISTINGS_PER_PAGE);

    try {
        const snapshot = await queryRef.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao buscar listagens no Firestore:", error);
        return [];
    }
}

/**
 * Renderiza os resultados da busca na página pesquisa.html.
 */
function renderSearchResults(listings, filters) {
    const resultsContainer = document.getElementById('listings-results');
    const countDisplay = document.getElementById('results-count');
    const filterDisplay = document.getElementById('current-filter-display');
    
    // Assume que 'createListingCard' é uma função global definida em script.js
    if (typeof createListingCard === 'undefined') {
        console.error("ERRO: A função 'createListingCard' não está definida. Verifique script.js.");
        if (resultsContainer) resultsContainer.innerHTML = `<div class="col-12 text-center text-danger py-5">Erro de renderização: Funções ausentes.</div>`;
        return;
    }

    if (!resultsContainer || !countDisplay || !filterDisplay) {
        console.error("Elementos de resultados de busca não encontrados na página.");
        return;
    }

    // 1. Renderiza os Cards
    if (listings.length === 0) {
        resultsContainer.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-box-open fa-3x mb-3 text-muted"></i>
                <h4 class="text-white-50">Nenhum anúncio encontrado com os filtros atuais.</h4>
                <p class="text-muted">Tente refinar sua pesquisa ou buscar por outra categoria.</p>
            </div>
        `;
    } else {
        resultsContainer.innerHTML = listings.map(listing => createListingCard(listing)).join('');
    }
    
    // 2. Atualiza os Displays de Feedback
    let currentFilterText = '';
    if (filters.category && filters.query) {
         currentFilterText = `${filters.category} + "${filters.query}"`;
    } else if (filters.category) {
         currentFilterText = `Categoria: ${filters.category}`;
    } else if (filters.query) {
         currentFilterText = `Busca: "${filters.query}"`;
    } else {
         currentFilterText = 'Todas as Listagens';
    }

    countDisplay.textContent = listings.length;
    filterDisplay.textContent = currentFilterText;
    
    // 3. Preenche a barra de filtro com os valores atuais da URL
    const searchInput = document.getElementById('searchInput');
    const categoryFilterSelect = document.getElementById('categoryFilter');

    if (searchInput) searchInput.value = filters.query;
    if (categoryFilterSelect) categoryFilterSelect.value = filters.category;
}

/**
 * Lida com o carregamento inicial da página de pesquisa (pesquisa.html).
 */
async function handleSearchPageLoad() {
    const filters = getUrlFilters();
    
    const resultsContainer = document.getElementById('listings-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = `<div class="col-12 text-center text-primary py-5">
                                        <i class="fas fa-spinner fa-spin me-2"></i> Buscando resultados...
                                      </div>`;
    }
    
    const listings = await fetchListings(filters);
    renderSearchResults(listings, filters);
    
    console.log("DIAGNÓSTICO: Pesquisa inicial concluída. Filtros aplicados:", filters);
}

/**
 * Lida com a submissão do formulário de filtro na página pesquisa.html.
 */
function handleFilterSubmit(e) {
    e.preventDefault(); // Previne o comportamento padrão do formulário (recarregar)

    const searchInput = document.getElementById('searchInput');
    const categoryFilterSelect = document.getElementById('categoryFilter');
    
    const newQuery = searchInput?.value || '';
    const newCategory = categoryFilterSelect?.value || '';

    // Constrói a nova URL
    const newUrlParams = new URLSearchParams();
    if (newCategory) newUrlParams.set('category', newCategory);
    if (newQuery) newUrlParams.set('query', newQuery); 

    // Redireciona para a nova URL de busca
    window.location.href = `pesquisa.html?${newUrlParams.toString()}`;
}

// =========================================================================
// 4. EVENTO DOMContentLoaded (Configura listeners)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // 1. Lógica da PÁGINA DE PESQUISA (pesquisa.html)
    const searchPageContainer = document.getElementById('listings-results');
    const searchForm = document.getElementById('search-form');

    if (searchPageContainer) {
        // Se este container existe, estamos em pesquisa.html
        handleSearchPageLoad();
        
        if (searchForm) {
            searchForm.addEventListener('submit', handleFilterSubmit);
            console.log("DIAGNÓSTICO: Listener de Submissão de Filtro anexado.");
        }
    }
    
    // 2. Lógica da PÁGINA INICIAL (index.html)
    // A função setupCategoryListeners é chamada pelo script.js no DOMContentLoaded.
    // Ela é definida aqui para modularidade.
});

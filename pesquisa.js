// =========================================================================
// 1. CONSTANTES E REFERÊNCIAS
//    (Depende das referências 'auth' e 'db' inicializadas em script.js/HTML)
// =========================================================================

// O Firestore (db) e a função createListingCard são assumidos como globais 
// e definidos em script.js, que carrega antes deste módulo.
// const db = firebase.firestore(); 
// function createListingCard(listing) { ... }

const LISTINGS_PER_PAGE = 12; // Número de resultados por página

// =========================================================================
// 2. LÓGICA DE CATEGORIAS (index.html)
//    CRÍTICO: Resolve o problema de clique e redirecionamento
// =========================================================================

/**
 * Anexa listeners de evento aos cards de categoria na página index.html.
 * Esta função deve ser chamada APENAS em index.html.
 */
function setupCategoryListeners() {
    console.log("DIAGNÓSTICO: Tentando anexar listeners de categoria.");
    
    // Seleciona todos os elementos com a classe category-link
    const categoryLinks = document.querySelectorAll('.category-link');
    
    if (categoryLinks.length > 0) {
        categoryLinks.forEach(card => {
            const categoryName = card.getAttribute('data-category');
            
            if (categoryName) {
                // Adiciona o listener de clique
                card.addEventListener('click', () => {
                    // CRÍTICO: Redireciona para pesquisa.html com o parâmetro de URL
                    console.log(`CLIQUE DETECTADO: Redirecionando para categoria: ${categoryName}`);
                    window.location.href = `pesquisa.html?category=${encodeURIComponent(categoryName)}`;
                });
                // Diagnóstico para confirmar o anexo
                // console.log(`Listener anexado ao card para: ${categoryName}`);
            }
        });
        console.log(`DIAGNÓSTICO: ${categoryLinks.length} listeners de categoria anexados com sucesso.`);
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
    const { category, query } = filters;
    let queryRef = db.collection('listings')
                      .where('status', '==', 'active');
    
    // Filtro por CATEGORIA (Prioridade alta vinda do index.html)
    if (category) {
        queryRef = queryRef.where('category', '==', category);
    }

    // Filtro por BUSCA (Palavra-chave - Nota: Firestore não faz busca de texto completo)
    // Para simplificar, faremos uma busca parcial por prefixo no título.
    if (query) {
        const lowerCaseQuery = query.toLowerCase();
        // NOTA: Para buscas de texto completo no Firestore, seria necessário usar uma solução como Algolia ou ElasticSearch.
        // Aqui, faremos uma busca simples onde o título 'começa com' a palavra-chave (limitado pelo Firestore).
        // A melhor prática para o Firestore é que o cliente filtre os resultados se a lista não for muito grande, ou usar um campo de metadados.
        // Vamos manter o filtro de categoria para evitar coleções não indexadas.
        console.warn("A busca por palavra-chave no Firestore é limitada. Usando apenas filtro de categoria/status.");
        // Se a busca por palavra-chave fosse necessária, você teria que estruturar o DB de forma diferente (ex: campo "title_keywords").
        // Por ora, focamos no filtro de categoria, que é o que está quebrando o fluxo.
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
                <p>Tente refinar sua pesquisa ou buscar por outra categoria.</p>
            </div>
        `;
    } else {
        // Assume que createListingCard está definido em script.js
        resultsContainer.innerHTML = listings.map(listing => createListingCard(listing)).join('');
    }
    
    // 2. Atualiza os Displays de Feedback
    const currentFilter = filters.category || filters.query || 'Todas as Listagens';
    
    countDisplay.textContent = listings.length;
    filterDisplay.textContent = currentFilter;
    
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
    
    console.log("DIAGNÓSTICO: Pesquisa inicial concluída. Filtros:", filters);
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
    if (newQuery) newUrlParams.set('query', newQuery); // Mantido o query para futuros updates

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
    // O setupCategoryListeners é chamado em script.js, mas definido aqui.
    // Garante que o listener seja anexado se o index.html carregar primeiro.
    // (A chamada está no final do script.js, mas a definição está aqui para modularização)
    // console.log("Pesquisa.js carregado. A função setupCategoryListeners está disponível.");

});

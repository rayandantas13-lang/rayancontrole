// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBOJJGZHKNqHGOOGJJGZHKNqHGOOGJJGZHKNqHGOO",
    authDomain: "almoxarifado-sistema.firebaseapp.com",
    projectId: "almoxarifado-sistema",
    storageBucket: "almoxarifado-sistema.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456789012345678"
};

// Inicializar Firebase (simulado)
class InventorySystem {
    constructor() {
        this.products = [];
        this.requisitions = [];
        this.selectedProductsForRequisition = [];
        this.currentTab = 'products';
        this.nextRequisitionNumber = 1;
        this.init();
    }

    async init() {
        await this.loadFromFirestore();
        await this.loadRequisitionsFromFirestore();
        this.setupEventListeners();
        this.render();
        this.updateStats();
        this.updateDashboard();
        this.populateLocationFilter();
    }

    // ===================== Firestore Operations =====================
    async loadFromFirestore() {
        try {
            // Simulação de dados do Firestore
            const mockData = [
                {
                    id: "00420002",
                    name: "COCO RALADO INDUSTRIAL",
                    code: "00420002",
                    quantity: 230,
                    local: "BISCOITO",
                    description: "ROSQUINHA - ARMAZEM 81",
                    lastUpdated: "24/09/2025"
                },
                {
                    id: "00560204",
                    name: "AÇUCAR INVERTIDO",
                    code: "00560204",
                    quantity: 9360,
                    local: "BISCOITO",
                    description: "ROSQUINHA - ARMAZEM 81",
                    lastUpdated: "24/09/2025"
                },
                {
                    id: "00030448",
                    name: "FILME MAC ARAGUAIA PARAFUSO SEMOLA 500G",
                    code: "00030448",
                    quantity: 1073.75,
                    local: "MASSAS",
                    description: "ROSQUINHA - ARMAZEM 81",
                    lastUpdated: "24/09/2025"
                },
                {
                    id: "00030226",
                    name: "FILME MAC PARAFUSO SEMOLA EMEGE 500G",
                    code: "00030226",
                    quantity: 1620.4,
                    local: "MASSAS",
                    description: "ROSQUINHA - ARMAZEM 81",
                    lastUpdated: "24/09/2025"
                },
                {
                    id: "00030148",
                    name: "EMB PAP FAR BSB 1KG",
                    code: "00030148",
                    quantity: 88200,
                    local: "DOMESTICA",
                    description: "ROSQUINHA - ARMAZEM 81",
                    lastUpdated: "24/09/2025"
                }
            ];
            
            this.products = mockData;
            console.log("Dados carregados do Firestore:", this.products.length, "produtos");
        } catch (error) {
            console.error("Erro ao carregar dados do Firestore:", error);
        }
    }

    async loadRequisitionsFromFirestore() {
        try {
            // Simulação de dados de requisições
            this.requisitions = [];
            console.log("Requisições carregadas do Firestore:", this.requisitions.length, "requisições");
        } catch (error) {
            console.error("Erro ao carregar requisições do Firestore:", error);
        }
    }

    async saveToFirestore(product) {
        try {
            console.log("Salvando produto no Firestore:", product);
            return true;
        } catch (error) {
            console.error("Erro ao salvar no Firestore:", error);
            return false;
        }
    }

    async deleteFromFirestore(productId) {
        try {
            console.log("Deletando produto do Firestore:", productId);
            return true;
        } catch (error) {
            console.error("Erro ao deletar do Firestore:", error);
            return false;
        }
    }

    async saveRequisitionToFirestore(requisition) {
        try {
            console.log("Salvando requisição no Firestore:", requisition);
            return true;
        } catch (error) {
            console.error("Erro ao salvar requisição no Firestore:", error);
            return false;
        }
    }

    // ===================== Tab Management =====================
    switchTab(tabName) {
        console.log("Aba atual:", tabName);
        
        // Atualizar botões das abas
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Atualizar conteúdo das abas
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        this.currentTab = tabName;
        
        // Renderizar conteúdo específico da aba
        if (tabName === 'products') {
            this.render();
        } else if (tabName === 'requisition') {
            this.renderRequisitions();
        } else if (tabName === 'dashboard') {
            this.updateDashboard();
        }
    }

    // ===================== Product Management =====================
    addProduct(productData) {
        const product = {
            id: productData.code,
            name: productData.name,
            code: productData.code,
            quantity: parseInt(productData.quantity),
            local: productData.local,
            description: productData.description || '',
            lastUpdated: new Date().toLocaleDateString("pt-BR")
        };

        this.products.push(product);
        this.saveToFirestore(product);
        this.render();
        this.updateStats();
        this.updateDashboard();
        this.populateLocationFilter();
    }

    editProduct(productId, productData) {
        const index = this.products.findIndex(p => p.id === productId);
        if (index !== -1) {
            this.products[index] = {
                ...this.products[index],
                name: productData.name,
                code: productData.code,
                quantity: parseInt(productData.quantity),
                local: productData.local,
                description: productData.description || '',
                lastUpdated: new Date().toLocaleDateString("pt-BR")
            };
            this.saveToFirestore(this.products[index]);
            this.render();
            this.updateStats();
            this.updateDashboard();
            this.populateLocationFilter();
        }
    }

    deleteProduct(productId) {
        this.products = this.products.filter(p => p.id !== productId);
        this.deleteFromFirestore(productId);
        this.render();
        this.updateStats();
        this.updateDashboard();
        this.populateLocationFilter();
    }

    // ===================== Requisition Management =====================
    renderRequisitions() {
        const requisitionsList = document.querySelector('#requisitionTab .requisitions-list');
        if (!requisitionsList) return;

        if (this.requisitions.length === 0) {
            requisitionsList.innerHTML = '<p class="empty-state">Nenhuma requisição realizada ainda.</p>';
            return;
        }

        requisitionsList.innerHTML = this.requisitions.map(req => this.createRequisitionHTML(req)).join('');
    }

    createRequisitionHTML(req) {
        const formattedDate = new Date(req.createdAt).toLocaleDateString("pt-BR");
        const statusClass = `status-${req.status || 'pending'}`;
        const statusText = req.status === 'finished' ? 'Finalizado' : req.status === 'rejected' ? 'Rejeitada' : 'Pendente';
        
        return `
        <div class="requisition-item" data-id="${req.id}">
            <div class="requisition-header">
                <div class="requisition-info">
                    <h3>${this.escapeHtml(req.description)}</h3>
                    <div class="requisition-number">Nº ${req.number}</div>
                </div>
                <div class="requisition-status ${statusClass}">${statusText}</div>
            </div>
            <div class="requisition-details">
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Local</div>
                    <div class="requisition-detail-value">${this.escapeHtml(req.local)}</div>
                </div>
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Data</div>
                    <div class="requisition-detail-value">${formattedDate}</div>
                </div>
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Total de Itens</div>
                    <div class="requisition-detail-value">${req.products.length}</div>
                </div>
                ${req.estimatedQuantity ? `
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Estimativa Total</div>
                    <div class="requisition-detail-value">${req.estimatedQuantity}</div>
                </div>
                ` : ''}
            </div>
            <div class="requisition-products">
                <h4>Produtos Requisitados:</h4>
                <div class="requisition-products-list">
                    ${req.products.map(p => `
                        <div class="requisition-product-item">
                            <div class="requisition-product-info">
                                <span class="requisition-product-name">${this.escapeHtml(p.name)}</span>
                                <span class="requisition-product-quantity">Solicitado: ${p.quantity}</span>
                                ${p.suppliedQuantity > 0 ? `<span class="supply-quantity-value">Abastecido: ${p.suppliedQuantity}</span>` : ''}
                            </div>
                            ${req.status === 'pending' ? `
                            <div class="supply-quantity-section">
                                <div class="supply-quantity-input">
                                    <input type="number" id="supply-${req.id}-${p.id}" placeholder="Qtd abastecida" min="0" max="${p.quantity}">
                                    <button class="supply-btn" onclick="window.inventorySystem.supplyProduct('${req.id}', '${p.id}')">Abastecer</button>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`;
    }

    openRequisitionModal() {
        this.selectedProductsForRequisition = [];
        this.renderSelectedProducts();
        this.renderAvailableProducts();
        this.showModal("requisitionModal");
    }

    renderSelectedProducts() {
        const selectedProducts = document.getElementById("selectedProducts");
        
        if (this.selectedProductsForRequisition.length === 0) {
            selectedProducts.innerHTML = '<p>Nenhum produto selecionado</p>';
            selectedProducts.classList.remove('has-products');
            return;
        }

        selectedProducts.classList.add('has-products');
        selectedProducts.innerHTML = this.selectedProductsForRequisition.map(p => `
            <div class="selected-product-item" data-id="${p.id}">
                <div class="selected-product-info">
                    <div class="selected-product-name">${this.escapeHtml(p.name)}</div>
                    <div class="selected-product-code">Código: ${this.escapeHtml(p.code)}</div>
                </div>
                <div class="selected-product-quantity">
                    <input type="number" class="quantity-input" value="${p.requestedQuantity}" min="1" max="${p.quantity}" 
                           onchange="window.inventorySystem.updateSelectedProductQuantity('${p.id}', this.value)">
                    <button type="button" class="remove-product-btn" onclick="window.inventorySystem.removeSelectedProduct('${p.id}')">Remover</button>
                </div>
            </div>
        `).join('');
    }

    updateSelectedProductQuantity(productId, quantity) {
        const product = this.selectedProductsForRequisition.find(p => p.id === productId);
        if (product) {
            product.requestedQuantity = parseInt(quantity) || 1;
        }
    }

    renderAvailableProducts() {
        const productsList = document.getElementById("availableProductsList");
        const searchTerm = document.getElementById("productSearchInput").value.toLowerCase();
        const locationFilter = document.getElementById("locationFilter").value;
        
        const filteredProducts = this.products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                product.code.toLowerCase().includes(searchTerm) ||
                product.local.toLowerCase().includes(searchTerm);
            
            const matchesLocation = !locationFilter || product.local === locationFilter;
            
            return matchesSearch && matchesLocation;
        });

        if (filteredProducts.length === 0) {
            productsList.innerHTML = '<p class="empty-state">Nenhum produto encontrado.</p>';
            return;
        }

        productsList.innerHTML = filteredProducts.map(product => {
            const isSelected = this.selectedProductsForRequisition.some(p => p.id === product.id);
            return `
            <div class="available-product-item ${isSelected ? 'selected' : ''}" data-id="${product.id}">
                <div class="available-product-info">
                    <div class="available-product-name">${this.escapeHtml(product.name)}</div>
                    <div class="available-product-details">Código: ${product.code} | Estoque: ${product.quantity} | Local: ${product.local}</div>
                </div>
                <input type="checkbox" class="product-checkbox" ${isSelected ? 'checked' : ''} 
                       onchange="window.inventorySystem.toggleProductSelection('${product.id}', this.checked)">
            </div>`;
        }).join('');
    }

    toggleProductSelection(productId, isSelected) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        if (isSelected) {
            if (!this.selectedProductsForRequisition.some(p => p.id === productId)) {
                this.selectedProductsForRequisition.push({
                    ...product,
                    requestedQuantity: 1
                });
            }
        } else {
            this.selectedProductsForRequisition = this.selectedProductsForRequisition.filter(p => p.id !== productId);
        }

        this.renderSelectedProducts();
        this.renderAvailableProducts();
    }

    removeSelectedProduct(productId) {
        this.selectedProductsForRequisition = this.selectedProductsForRequisition.filter(p => p.id !== productId);
        this.renderSelectedProducts();
        this.renderAvailableProducts();
    }

    confirmProductSelection() {
        this.renderSelectedProducts();
        this.closeModal("productSelectionModal");
    }

    async saveRequisition() {
        const local = document.getElementById("requisitionLocal").value.trim();
        const description = document.getElementById("requisitionDescription").value.trim();
        const estimatedQuantity = document.getElementById("estimatedQuantity").value;

        if (!local || !description) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        if (this.selectedProductsForRequisition.length === 0) {
            alert("Por favor, selecione pelo menos um produto.");
            return;
        }

        const requisitionData = {
            id: Date.now().toString(),
            number: this.generateRequisitionNumber(local, description),
            local: local,
            description: description,
            estimatedQuantity: estimatedQuantity ? parseInt(estimatedQuantity) : null,
            products: this.selectedProductsForRequisition.map(p => ({
                id: p.id,
                name: p.name,
                code: p.code,
                quantity: p.requestedQuantity,
                suppliedQuantity: 0
            })),
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const success = await this.addRequisition(requisitionData);
        if (success) {
            this.closeModal("requisitionModal");
            this.switchTab('requisition');
            alert("Requisição gerada com sucesso!");
        }
    }

    generateRequisitionNumber(local, description) {
        const localCode = local.substring(0, 3).toUpperCase();
        const descCode = description.substring(0, 3).toUpperCase();
        const number = this.nextRequisitionNumber.toString().padStart(3, '0');
        this.nextRequisitionNumber++;
        return `${localCode}${descCode}${number}`;
    }

    async addRequisition(requisitionData) {
        try {
            this.requisitions.push(requisitionData);
            await this.saveRequisitionToFirestore(requisitionData);
            this.updateDashboard();
            return true;
        } catch (error) {
            console.error("Erro ao adicionar requisição:", error);
            return false;
        }
    }

    async supplyProduct(requisitionId, productId) {
        const supplyInput = document.getElementById(`supply-${requisitionId}-${productId}`);
        const suppliedQuantity = parseInt(supplyInput.value);

        if (!suppliedQuantity || suppliedQuantity <= 0) {
            alert("Por favor, informe uma quantidade válida.");
            return;
        }

        const requisition = this.requisitions.find(r => r.id === requisitionId);
        if (!requisition) return;

        const reqProduct = requisition.products.find(p => p.id === productId);
        if (!reqProduct) return;

        if (suppliedQuantity > reqProduct.quantity) {
            alert("A quantidade abastecida não pode ser maior que a solicitada.");
            return;
        }

        // Atualizar produto na requisição
        reqProduct.suppliedQuantity = suppliedQuantity;

        // Diminuir do estoque
        const stockProduct = this.products.find(p => p.id === productId);
        if (stockProduct) {
            stockProduct.quantity -= suppliedQuantity;
            await this.saveToFirestore(stockProduct);
        }

        // Verificar se todos os produtos foram abastecidos
        const allSupplied = requisition.products.every(p => p.suppliedQuantity > 0);
        if (allSupplied) {
            requisition.status = 'finished';
        }

        requisition.updatedAt = new Date().toISOString();
        await this.saveRequisitionToFirestore(requisition);

        this.render();
        this.renderRequisitions();
        this.updateDashboard();
        
        alert("Produto abastecido com sucesso!");
    }

    populateLocationFilter() {
        const locationFilter = document.getElementById("locationFilter");
        if (!locationFilter) return;

        const locations = [...new Set(this.products.map(p => p.local))].sort();
        
        locationFilter.innerHTML = '<option value="">Todos os locais</option>' +
            locations.map(location => `<option value="${location}">${location}</option>`).join('');
    }

    // ===================== Dashboard =====================
    updateDashboard() {
        const dashboardSection = document.querySelector('.dashboard-section');
        if (!dashboardSection) return;

        const totalProducts = this.products.length;
        const totalQuantity = this.products.reduce((sum, p) => sum + p.quantity, 0);
        const totalRequisitions = this.requisitions.length;
        const lowStockProducts = this.products.filter(p => p.quantity < 10).length;

        const dashboardHTML = `
            <h2>Dashboard de Estoque</h2>
            <div class="dashboard-stats">
                <div class="dashboard-card">
                    <div class="dashboard-card-title">Total de Produtos</div>
                    <div class="dashboard-card-value">${totalProducts}</div>
                    <div class="dashboard-card-subtitle">Itens cadastrados</div>
                </div>
                <div class="dashboard-card">
                    <div class="dashboard-card-title">Quantidade Total</div>
                    <div class="dashboard-card-value">${totalQuantity.toLocaleString('pt-BR')}</div>
                    <div class="dashboard-card-subtitle">Unidades em estoque</div>
                </div>
                <div class="dashboard-card">
                    <div class="dashboard-card-title">Requisições</div>
                    <div class="dashboard-card-value">${totalRequisitions}</div>
                    <div class="dashboard-card-subtitle">Total realizadas</div>
                </div>
                <div class="dashboard-card">
                    <div class="dashboard-card-title">Estoque Baixo</div>
                    <div class="dashboard-card-value">${lowStockProducts}</div>
                    <div class="dashboard-card-subtitle">Produtos com menos de 10 unidades</div>
                </div>
            </div>
        `;

        dashboardSection.innerHTML = dashboardHTML;
    }

    // ===================== Rendering =====================
    render() {
        const productsList = document.querySelector('#productsTab .products-list');
        if (!productsList) return;

        const searchTerm = document.getElementById("searchInput").value.toLowerCase();
        const filteredProducts = this.products.filter(product => 
            product.name.toLowerCase().includes(searchTerm) ||
            product.code.toLowerCase().includes(searchTerm) ||
            product.local.toLowerCase().includes(searchTerm)
        );

        if (filteredProducts.length === 0) {
            productsList.innerHTML = '<div class="empty-state"><p>Nenhum produto encontrado no estoque.</p><p>Clique em "Adicionar Item" para começar.</p></div>';
            return;
        }

        productsList.innerHTML = filteredProducts.map(product => this.createProductHTML(product)).join('');
    }

    createProductHTML(product) {
        const quantityClass = product.quantity > 100 ? 'quantity-high' : 
                             product.quantity > 10 ? 'quantity-medium' : 'quantity-low';
        
        return `
        <div class="product-item" data-id="${product.id}">
            <div class="product-header">
                <div class="product-info">
                    <h3>${this.escapeHtml(product.name)}</h3>
                    <div class="product-code">Código: ${this.escapeHtml(product.code)}</div>
                </div>
                <div class="product-actions">
                    <button class="btn-edit" onclick="window.inventorySystem.openEditModal('${product.id}')">Editar</button>
                    <button class="btn-delete" onclick="window.inventorySystem.openDeleteModal('${product.id}')">Excluir</button>
                </div>
            </div>
            <div class="product-details">
                <div class="product-detail">
                    <div class="product-detail-label">Quantidade</div>
                    <div class="product-detail-value">
                        <span class="quantity-badge ${quantityClass}">${product.quantity}</span>
                    </div>
                </div>
                <div class="product-detail">
                    <div class="product-detail-label">Local</div>
                    <div class="product-detail-value">${this.escapeHtml(product.local)}</div>
                </div>
                <div class="product-detail">
                    <div class="product-detail-label">Descrição</div>
                    <div class="product-detail-value">${this.escapeHtml(product.description)}</div>
                </div>
                <div class="product-detail">
                    <div class="product-detail-label">Última atualização</div>
                    <div class="product-detail-value">${product.lastUpdated}</div>
                </div>
            </div>
        </div>`;
    }

    updateStats() {
        const statsElement = document.querySelector('.stats');
        if (statsElement) {
            const totalQuantity = this.products.reduce((sum, product) => sum + product.quantity, 0);
            statsElement.textContent = `Total de itens: ${this.products.length} (${totalQuantity.toLocaleString('pt-BR')} unidades)`;
        }
    }

    // ===================== Modal Management =====================
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.querySelector('.modal-overlay');
        
        if (modal && overlay) {
            modal.classList.add('active');
            overlay.classList.add('active');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.querySelector('.modal-overlay');
        
        if (modal && overlay) {
            modal.classList.remove('active');
            overlay.classList.remove('active');
        }

        // Limpar formulários
        if (modalId === "productModal") {
            document.getElementById("productForm").reset();
            document.getElementById("productId").value = "";
        } else if (modalId === "requisitionModal") {
            document.getElementById("requisitionForm").reset();
            this.selectedProductsForRequisition = [];
            this.renderSelectedProducts();
        }
    }

    openAddModal() {
        document.getElementById("modalTitle").textContent = "Adicionar Produto";
        document.getElementById("productForm").reset();
        document.getElementById("productId").value = "";
        this.showModal("productModal");
    }

    openEditModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        document.getElementById("modalTitle").textContent = "Editar Produto";
        document.getElementById("productId").value = product.id;
        document.getElementById("productName").value = product.name;
        document.getElementById("productCode").value = product.code;
        document.getElementById("productQuantity").value = product.quantity;
        document.getElementById("productLocal").value = product.local;
        document.getElementById("productDescription").value = product.description;
        
        this.showModal("productModal");
    }

    openDeleteModal(productId) {
        this.productToDelete = productId;
        this.showModal("confirmModal");
    }

    confirmDelete() {
        if (this.productToDelete) {
            this.deleteProduct(this.productToDelete);
            this.productToDelete = null;
            this.closeModal("confirmModal");
        }
    }

    // ===================== Event Listeners =====================
    setupEventListeners() {
        // Busca
        document.getElementById("searchInput").addEventListener("input", () => this.render());
        document.getElementById("clearSearch").addEventListener("click", () => {
            document.getElementById("searchInput").value = "";
            this.render();
        });

        // Navegação por abas
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Botões principais
        document.getElementById("addItemBtn").addEventListener("click", () => this.openAddModal());
        document.getElementById("generateRequisitionBtn").addEventListener("click", () => this.openRequisitionModal());

        // Formulário de produto
        document.getElementById("productForm").addEventListener("submit", (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const productData = Object.fromEntries(formData);
            
            const productId = document.getElementById("productId").value;
            if (productId) {
                this.editProduct(productId, productData);
            } else {
                this.addProduct(productData);
            }
            
            this.closeModal("productModal");
        });

        // Formulário de requisição
        document.getElementById("requisitionForm").addEventListener("submit", (e) => {
            e.preventDefault();
            this.saveRequisition();
        });

        // Botões de modal
        document.getElementById("cancelBtn").addEventListener("click", () => this.closeModal("productModal"));
        document.getElementById("cancelDeleteBtn").addEventListener("click", () => this.closeModal("confirmModal"));
        document.getElementById("confirmDeleteBtn").addEventListener("click", () => this.confirmDelete());
        document.getElementById("cancelRequisitionBtn").addEventListener("click", () => this.closeModal("requisitionModal"));
        document.getElementById("selectProductsBtn").addEventListener("click", () => this.showModal("productSelectionModal"));
        document.getElementById("cancelProductSelectionBtn").addEventListener("click", () => this.closeModal("productSelectionModal"));
        document.getElementById("confirmProductSelectionBtn").addEventListener("click", () => this.confirmProductSelection());

        // Botões de fechar modal
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Fechar modal clicando no overlay
        document.querySelector('.modal-overlay').addEventListener('click', () => {
            document.querySelectorAll('.modal.active').forEach(modal => {
                this.closeModal(modal.id);
            });
        });

        // Busca de produtos na seleção
        document.getElementById("productSearchInput").addEventListener("input", () => this.renderAvailableProducts());
        
        // Filtro por local
        document.getElementById("locationFilter").addEventListener("change", () => this.renderAvailableProducts());
    }

    // ===================== Location Filter =====================
    populateLocationFilter() {
        const locationFilter = document.getElementById("locationFilter");
        if (!locationFilter) return;

        // Obter todos os locais únicos dos produtos
        const uniqueLocations = [...new Set(this.products.map(product => product.local))].sort();
        
        // Limpar opções existentes (exceto "Todos os locais")
        locationFilter.innerHTML = '<option value="">Todos os locais</option>';
        
        // Adicionar opções para cada local único
        uniqueLocations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            locationFilter.appendChild(option);
        });
    }

    // ===================== Utility Functions =====================
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Inicializar o sistema quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.inventorySystem = new InventorySystem();
});

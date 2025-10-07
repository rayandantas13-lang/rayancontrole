// ===================== Firebase Config =====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, onSnapshot, 
  updateDoc, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUhJcWkeMYqxNzg8c7VaFt-LmzGVZ5_yQ",
  authDomain: "almoxarifado-348d5.firebaseapp.com",
  projectId: "almoxarifado-348d5",
  storageBucket: "almoxarifado-348d5.firebasestorage.app",
  messagingSenderId: "295782162128",
  appId: "1:295782162128:web:7567d6605d20db5f3cc8d5",
  measurementId: "G-PC0FREL2DF"
};

// Inicializa Firebase e Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===================== Sistema de Estoque =====================
class InventorySystem {
    constructor() {
        this.products = [];
        this.currentEditingId = null;
        this.filteredProducts = [];
        this.productToDelete = null;
        this.requisitions = [];
        this.selectedProductsForRequisition = [];
        this.currentTab = 'products';
        this.requisitionCounter = 1;

        this.init();
    }

    init() {
        this.bindEvents();
        this.loadFromFirestore();
        this.loadRequisitionsFromFirestore();
    }

    // ===================== Firestore =====================
    async loadFromFirestore() {
        try {
            const colRef = collection(db, "products");
            onSnapshot(colRef, (snapshot) => {
                this.products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.applyCurrentFilter();
                this.renderProducts();
                this.updateStats();
            });
        } catch (error) {
            console.error("Erro ao carregar produtos do Firestore:", error);
        }
    }

    async loadRequisitionsFromFirestore() {
        try {
            const colRef = collection(db, "requisitions");
            onSnapshot(colRef, (snapshot) => {
                this.requisitions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.renderRequisitions();
                this.updateDashboard();
            });
        } catch (error) {
            console.error("Erro ao carregar requisições do Firestore:", error);
        }
    }

    async addProduct(productData) {
        const errors = this.validateProduct(productData);
        if (errors.length > 0) { alert(errors.join("\n")); return false; }

        const product = {
            name: productData.name.trim(),
            code: productData.code.trim().toUpperCase(),
            quantity: parseFloat(productData.quantity),
            location: productData.location.trim(),
            description: productData.description?.trim() || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "products"), product);
            return true;
        } catch (error) {
            console.error("Erro ao adicionar produto:", error);
            alert("Erro ao salvar no servidor.");
            return false;
        }
    }

    async updateProduct(productData) {
        const errors = this.validateProduct(productData);
        if (errors.length > 0) { alert(errors.join("\n")); return false; }

        try {
            const ref = doc(db, "products", this.currentEditingId);
            await updateDoc(ref, {
                ...productData,
                code: productData.code.trim().toUpperCase(),
                quantity: parseFloat(productData.quantity),
                updatedAt: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error("Erro ao atualizar produto:", error);
            alert("Erro ao atualizar no servidor.");
            return false;
        }
    }

    async deleteProduct(productId) {
        try {
            const ref = doc(db, "products", productId);
            await deleteDoc(ref);
            return true;
        } catch (error) {
            console.error("Erro ao excluir produto:", error);
            alert("Erro ao excluir do servidor.");
            return false;
        }
    }

    async addRequisition(requisitionData) {
        try {
            await addDoc(collection(db, "requisitions"), requisitionData);
            return true;
        } catch (error) {
            console.error("Erro ao adicionar requisição:", error);
            alert("Erro ao salvar requisição no servidor.");
            return false;
        }
    }

    // ===================== Validação =====================
    validateProduct(productData) {
        const errors = [];
        if (!productData.name?.trim()) errors.push("Nome do item é obrigatório");
        if (!productData.code?.trim()) errors.push("Código/ID é obrigatório");
        if (productData.quantity === '' || productData.quantity < 0) errors.push("Quantidade deve ser maior ou igual a zero");
        if (!productData.location?.trim()) errors.push("Local é obrigatório");
        const existing = this.products.find(p => p.code.toLowerCase() === productData.code.toLowerCase() && p.id !== this.currentEditingId);
        if (existing) errors.push("Já existe um produto com este código");
        return errors;
    }

    // ===================== Filtros e busca =====================
    searchProducts(query) {
        if (!query?.trim()) this.filteredProducts = [...this.products];
        else {
            const term = query.toLowerCase().trim();
            this.filteredProducts = this.products.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.code.toLowerCase().includes(term) ||
                p.location.toLowerCase().includes(term) ||
                (p.description && p.description.toLowerCase().includes(term))
            );
        }
        this.renderProducts();
    }

    applyCurrentFilter() {
        const searchInput = document.getElementById("searchInput");
        if (searchInput?.value?.trim()) this.searchProducts(searchInput.value);
        else this.filteredProducts = [...this.products];
    }

    clearSearch() {
        const searchInput = document.getElementById("searchInput");
        searchInput.value = '';
        this.searchProducts('');
    }

    // ===================== Renderização =====================
    renderProducts() {
        const productsList = document.getElementById("productsList");
        const emptyState = document.getElementById("emptyState");
        if (this.filteredProducts.length === 0) {
            productsList.style.display = "none";
            emptyState.style.display = "block";
            return;
        }
        productsList.style.display = "block";
        emptyState.style.display = "none";
        productsList.innerHTML = this.filteredProducts.map(p => this.createProductHTML(p)).join('');
    }

    createProductHTML(p) {
        const quantityClass = p.quantity >= 50 ? 'quantity-high' : p.quantity >= 10 ? 'quantity-medium' : 'quantity-low';
        const formattedDate = new Date(p.updatedAt).toLocaleDateString("pt-BR");
        return `
        <div class="product-item" data-id="${p.id}">
            <div class="product-header">
                <div class="product-info">
                    <h3>${this.escapeHtml(p.name)}</h3>
                    <div class="product-code">Código: ${this.escapeHtml(p.code)}</div>
                </div>
                <div class="product-actions">
                    <button class="btn-edit" data-action="edit" data-id="${p.id}">Editar</button>
                    <button class="btn-delete" data-action="delete" data-id="${p.id}">Excluir</button>
                </div>
            </div>
            <div class="product-details">
                <div class="product-detail">
                    <div class="product-detail-label">Quantidade</div>
                    <div class="product-detail-value"><span class="quantity-badge ${quantityClass}">${p.quantity}</span></div>
                </div>
                <div class="product-detail">
                    <div class="product-detail-label">Local</div>
                    <div class="product-detail-value">${this.escapeHtml(p.location)}</div>
                </div>
                ${p.description ? `<div class="product-detail"><div class="product-detail-label">Descrição</div><div class="product-detail-value">${this.escapeHtml(p.description)}</div></div>` : ''}
                <div class="product-detail">
                    <div class="product-detail-label">Última atualização</div>
                    <div class="product-detail-value">${formattedDate}</div>
                </div>
            </div>
        </div>`;
    }

    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    updateStats() {
        const totalItems = document.getElementById("totalItems");
        const totalQuantity = this.products.reduce((sum, p) => sum + p.quantity, 0);
        totalItems.textContent = `Total de itens: ${this.products.length} (${totalQuantity} unidades)`;
    }

    // ===================== Gerenciamento de Abas =====================
    switchTab(tabName) {
        // Remove active de todas as abas
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Ativa a aba selecionada
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        this.currentTab = tabName;
        
        // Atualiza conteúdo específico da aba
        if (tabName === 'requisition') {
            this.renderRequisitions();
        } else if (tabName === 'dashboard') {
            this.updateDashboard();
        }
    }

    // ===================== Gerenciamento de Requisições =====================
    generateRequisitionNumber(local, description) {
        const localCode = local.substring(0, 3).toUpperCase();
        const descCode = description.substring(0, 3).toUpperCase();
        const number = this.requisitionCounter.toString().padStart(3, '0');
        this.requisitionCounter++;
        return `${localCode}${descCode}${number}`;
    }

    renderRequisitions() {
        const requisitionsList = document.getElementById("requisitionsList");
        if (this.requisitions.length === 0) {
            requisitionsList.innerHTML = '<p>Nenhuma requisição realizada ainda.</p>';
            return;
        }

        requisitionsList.innerHTML = this.requisitions.map(req => this.createRequisitionHTML(req)).join('');
    }

    createRequisitionHTML(req) {
        const formattedDate = new Date(req.createdAt).toLocaleDateString("pt-BR");
        const statusClass = `status-${req.status || 'pending'}`;
        const statusText = req.status === 'approved' ? 'Aprovada' : req.status === 'rejected' ? 'Rejeitada' : 'Pendente';
        
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
            </div>
            <div class="requisition-products">
                <h4>Produtos Requisitados:</h4>
                <div class="requisition-products-list">
                    ${req.products.map(p => `
                        <div class="requisition-product-item">
                            <span class="requisition-product-name">${this.escapeHtml(p.name)}</span>
                            <span class="requisition-product-quantity">${p.quantity}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`;
    }

    openRequisitionModal() {
        this.selectedProductsForRequisition = [];
        this.clearRequisitionForm();
        this.openModal("requisitionModal");
    }

    clearRequisitionForm() {
        document.getElementById("requisitionForm").reset();
        this.renderSelectedProducts();
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
            product.requestedQuantity = parseInt(quantity);
        }
    }

    removeSelectedProduct(productId) {
        this.selectedProductsForRequisition = this.selectedProductsForRequisition.filter(p => p.id !== productId);
        this.renderSelectedProducts();
    }

    openProductSelectionModal() {
        this.renderAvailableProducts();
        this.openModal("productSelectionModal");
    }

    renderAvailableProducts() {
        const availableProductsList = document.getElementById("availableProductsList");
        if (this.products.length === 0) {
            availableProductsList.innerHTML = '<p>Nenhum produto disponível no estoque.</p>';
            return;
        }

        availableProductsList.innerHTML = this.products.map(p => {
            const isSelected = this.selectedProductsForRequisition.some(sp => sp.id === p.id);
            return `
            <div class="available-product-item ${isSelected ? 'selected' : ''}" data-id="${p.id}">
                <div class="available-product-info">
                    <div class="available-product-name">${this.escapeHtml(p.name)}</div>
                    <div class="available-product-details">Código: ${this.escapeHtml(p.code)} | Estoque: ${p.quantity} | Local: ${this.escapeHtml(p.location)}</div>
                </div>
                <input type="checkbox" class="product-checkbox" ${isSelected ? 'checked' : ''} 
                       onchange="window.inventorySystem.toggleProductSelection('${p.id}', this.checked)">
            </div>
            `;
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

        // Atualiza a visualização
        const item = document.querySelector(`[data-id="${productId}"]`);
        if (item) {
            item.classList.toggle('selected', isSelected);
        }
    }

    confirmProductSelection() {
        this.renderSelectedProducts();
        this.closeModal("productSelectionModal");
    }

    async saveRequisition() {
        const local = document.getElementById("requisitionLocal").value.trim();
        const description = document.getElementById("requisitionDescription").value.trim();

        if (!local || !description) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        if (this.selectedProductsForRequisition.length === 0) {
            alert("Por favor, selecione pelo menos um produto.");
            return;
        }

        const requisitionData = {
            number: this.generateRequisitionNumber(local, description),
            local: local,
            description: description,
            products: this.selectedProductsForRequisition.map(p => ({
                id: p.id,
                name: p.name,
                code: p.code,
                quantity: p.requestedQuantity
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

    // ===================== Dashboard =====================
    updateDashboard() {
        const dashboardSection = document.querySelector('.dashboard-section');
        if (!dashboardSection) return;

        const totalProducts = this.products.length;
        const totalQuantity = this.products.reduce((sum, p) => sum + p.quantity, 0);
        const totalRequisitions = this.requisitions.length;
        const lowStockProducts = this.products.filter(p => p.quantity < 10).length;

        dashboardSection.innerHTML = `
            <h2>Dashboard de Estoque</h2>
            <div class="dashboard-stats">
                <div class="dashboard-card">
                    <div class="dashboard-card-title">Total de Produtos</div>
                    <div class="dashboard-card-value">${totalProducts}</div>
                    <div class="dashboard-card-subtitle">Itens cadastrados</div>
                </div>
                <div class="dashboard-card">
                    <div class="dashboard-card-title">Quantidade Total</div>
                    <div class="dashboard-card-value">${totalQuantity}</div>
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
    }

    // ===================== Modais e formulários =====================
    openModal(id) {
        document.getElementById(id).classList.add("active");
        document.getElementById("modalOverlay").classList.add("active");
        document.body.style.overflow = "hidden";
        if (id === "productModal") document.getElementById("productName").focus();
    }

    closeModal(id) {
        document.getElementById(id).classList.remove("active");
        document.getElementById("modalOverlay").classList.remove("active");
        document.body.style.overflow = "";
        if (id === "productModal") {
            this.clearForm();
            this.currentEditingId = null;
        }
    }

    clearForm() { document.getElementById("productForm").reset(); document.getElementById("modalTitle").textContent = "Adicionar Produto"; }
    populateForm(p) {
        document.getElementById("productName").value = p.name;
        document.getElementById("productCode").value = p.code;
        document.getElementById("productQuantity").value = p.quantity;
        document.getElementById("productLocation").value = p.location;
        document.getElementById("productDescription").value = p.description || '';
        document.getElementById("modalTitle").textContent = "Editar Produto";
    }

    getFormData() {
        return {
            name: document.getElementById("productName").value,
            code: document.getElementById("productCode").value,
            quantity: document.getElementById("productQuantity").value,
            location: document.getElementById("productLocation").value,
            description: document.getElementById("productDescription").value
        };
    }

    addNewProduct() { this.currentEditingId = null; this.clearForm(); this.openModal("productModal"); }
    editProduct(id) { const p = this.products.find(p=>p.id===id); if(!p) return alert("Produto não encontrado"); this.currentEditingId = id; this.populateForm(p); this.openModal("productModal"); }
    confirmDelete(id) { const p=this.products.find(p=>p.id===id); if(!p)return alert("Produto não encontrado"); document.getElementById("deleteProductName").textContent=p.name; this.productToDelete=id; this.openModal("confirmModal"); }
    async executeDelete() { if(this.productToDelete){ await this.deleteProduct(this.productToDelete); this.productToDelete=null; this.closeModal("confirmModal"); } }

    async saveProduct() {
        const data = this.getFormData();
        let success = false;
        if (this.currentEditingId) success = await this.updateProduct(data);
        else success = await this.addProduct(data);
        if (success) this.closeModal("productModal");
    }

    // ===================== Eventos =====================
    bindEvents() {
        // Eventos das abas
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Eventos dos produtos
        document.getElementById("addItemBtn").addEventListener("click", () => this.addNewProduct());
        document.getElementById("searchInput").addEventListener("input", e => this.searchProducts(e.target.value));
        document.getElementById("clearSearch").addEventListener("click", () => this.clearSearch());
        document.getElementById("closeModal").addEventListener("click", () => this.closeModal("productModal"));
        document.getElementById("cancelBtn").addEventListener("click", () => this.closeModal("productModal"));
        document.getElementById("productForm").addEventListener("submit", e => { e.preventDefault(); this.saveProduct(); });
        document.getElementById("cancelDelete").addEventListener("click", () => this.closeModal("confirmModal"));
        document.getElementById("confirmDelete").addEventListener("click", () => this.executeDelete());

        // Eventos das requisições
        document.getElementById("generateRequisitionBtn").addEventListener("click", () => this.openRequisitionModal());
        document.getElementById("closeRequisitionModal").addEventListener("click", () => this.closeModal("requisitionModal"));
        document.getElementById("cancelRequisitionBtn").addEventListener("click", () => this.closeModal("requisitionModal"));
        document.getElementById("requisitionForm").addEventListener("submit", e => { e.preventDefault(); this.saveRequisition(); });
        document.getElementById("selectProductsBtn").addEventListener("click", () => this.openProductSelectionModal());
        document.getElementById("closeProductSelectionModal").addEventListener("click", () => this.closeModal("productSelectionModal"));
        document.getElementById("cancelProductSelectionBtn").addEventListener("click", () => this.closeModal("productSelectionModal"));
        document.getElementById("confirmProductSelectionBtn").addEventListener("click", () => this.confirmProductSelection());

        // Eventos gerais dos modais
        document.getElementById("modalOverlay").addEventListener("click", () => {
            const active=document.querySelector(".modal.active"); if(active) this.closeModal(active.id);
        });
        document.addEventListener("keydown", e=>{ if(e.key==="Escape"){ const active=document.querySelector(".modal.active"); if(active) this.closeModal(active.id); }});
        document.querySelectorAll(".modal-content").forEach(c=>c.addEventListener("click", e=>e.stopPropagation()));

        // Eventos dinâmicos para os botões "Editar" e "Excluir"
        document.getElementById("productsList").addEventListener("click", e => {
            if (e.target.matches("[data-action='edit']")) {
                this.editProduct(e.target.dataset.id);
            }
            if (e.target.matches("[data-action='delete']")) {
                this.confirmDelete(e.target.dataset.id);
            }
        });

        // Evento de busca de produtos no modal de seleção
        document.getElementById("productSearchInput").addEventListener("input", e => {
            const query = e.target.value.toLowerCase();
            const items = document.querySelectorAll('.available-product-item');
            items.forEach(item => {
                const name = item.querySelector('.available-product-name').textContent.toLowerCase();
                const details = item.querySelector('.available-product-details').textContent.toLowerCase();
                const matches = name.includes(query) || details.includes(query);
                item.style.display = matches ? 'flex' : 'none';
            });
        });
    }
}

// ===================== Inicialização =====================
document.addEventListener('DOMContentLoaded', () => {
    const inventorySystem = new InventorySystem();
    window.inventorySystem = inventorySystem; // só para depuração no console
});

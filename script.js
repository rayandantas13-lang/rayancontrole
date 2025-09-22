// Sistema de Controle de Estoque - JavaScript

class InventorySystem {
    constructor() {
        this.products = [];
        this.currentEditingId = null;
        this.filteredProducts = [];
        this.productToDelete = null;
        
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.bindEvents();
        this.renderProducts();
        this.updateStats();
    }

    // Gerenciamento de dados
    loadFromStorage() {
        const stored = localStorage.getItem('inventory_products');
        if (stored) {
            try {
                this.products = JSON.parse(stored);
                this.filteredProducts = [...this.products];
            } catch (error) {
                console.error('Erro ao carregar dados do localStorage:', error);
                this.products = [];
                this.filteredProducts = [];
            }
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('inventory_products', JSON.stringify(this.products));
        } catch (error) {
            console.error('Erro ao salvar no localStorage:', error);
            alert('Erro ao salvar os dados. Verifique o espaço disponível no navegador.');
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    validateProduct(productData) {
        const errors = [];

        if (!productData.name || productData.name.trim().length === 0) errors.push('Nome do item é obrigatório');
        if (!productData.code || productData.code.trim().length === 0) errors.push('Código/ID é obrigatório');
        if (productData.quantity === '' || productData.quantity < 0) errors.push('Quantidade deve ser um número maior ou igual a zero');
        if (!productData.location || productData.location.trim().length === 0) errors.push('Local é obrigatório');

        const existingProduct = this.products.find(p => 
            p.code.toLowerCase() === productData.code.toLowerCase() && 
            p.id !== this.currentEditingId
        );
        if (existingProduct) errors.push('Já existe um produto com este código');

        return errors;
    }

    addProduct(productData) {
        const errors = this.validateProduct(productData);
        if (errors.length > 0) {
            alert('Erros encontrados:\n' + errors.join('\n'));
            return false;
        }

        const product = {
            id: this.generateId(),
            name: productData.name.trim(),
            code: productData.code.trim().toUpperCase(),
            quantity: parseInt(productData.quantity),
            location: productData.location.trim(),
            description: productData.description ? productData.description.trim() : '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.products.push(product);
        this.saveToStorage();
        this.applyCurrentFilter();
        this.renderProducts();
        this.updateStats();
        return true;
    }

    updateProduct(productData) {
        const errors = this.validateProduct(productData);
        if (errors.length > 0) {
            alert('Erros encontrados:\n' + errors.join('\n'));
            return false;
        }

        const productIndex = this.products.findIndex(p => p.id === this.currentEditingId);
        if (productIndex === -1) {
            alert('Produto não encontrado');
            return false;
        }

        this.products[productIndex] = {
            ...this.products[productIndex],
            name: productData.name.trim(),
            code: productData.code.trim().toUpperCase(),
            quantity: parseInt(productData.quantity),
            location: productData.location.trim(),
            description: productData.description ? productData.description.trim() : '',
            updatedAt: new Date().toISOString()
        };

        this.saveToStorage();
        this.applyCurrentFilter();
        this.renderProducts();
        this.updateStats();
        return true;
    }

    deleteProduct(productId) {
        const productIndex = this.products.findIndex(p => p.id === productId);
        if (productIndex === -1) {
            alert('Produto não encontrado');
            return false;
        }

        this.products.splice(productIndex, 1);
        this.saveToStorage();
        this.applyCurrentFilter();
        this.renderProducts();
        this.updateStats();
        return true;
    }

    getProduct(productId) {
        return this.products.find(p => p.id === productId);
    }

    searchProducts(query) {
        if (!query || query.trim().length === 0) {
            this.filteredProducts = [...this.products];
        } else {
            const searchTerm = query.toLowerCase().trim();
            this.filteredProducts = this.products.filter(product => 
                product.name.toLowerCase().includes(searchTerm) ||
                product.code.toLowerCase().includes(searchTerm) ||
                product.location.toLowerCase().includes(searchTerm) ||
                (product.description && product.description.toLowerCase().includes(searchTerm))
            );
        }
        this.renderProducts();
    }

    applyCurrentFilter() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim().length > 0) {
            this.searchProducts(searchInput.value);
        } else {
            this.filteredProducts = [...this.products];
        }
    }

    renderProducts() {
        const productsList = document.getElementById('productsList');
        const emptyState = document.getElementById('emptyState');

        if (this.filteredProducts.length === 0) {
            productsList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        productsList.style.display = 'block';
        emptyState.style.display = 'none';

        productsList.innerHTML = this.filteredProducts.map(product => this.createProductHTML(product)).join('');
    }

    createProductHTML(product) {
        const quantityClass = this.getQuantityClass(product.quantity);
        const formattedDate = new Date(product.updatedAt).toLocaleDateString('pt-BR');

        return `
            <div class="product-item" data-id="${product.id}">
                <div class="product-header">
                    <div class="product-info">
                        <h3>${this.escapeHtml(product.name)}</h3>
                        <div class="product-code">Código: ${this.escapeHtml(product.code)}</div>
                    </div>
                    <div class="product-actions">
                        <button type="button" class="btn-edit" onclick="inventorySystem.editProduct('${product.id}')">Editar</button>
                        <button type="button" class="btn-delete" onclick="inventorySystem.confirmDelete('${product.id}')">Excluir</button>
                    </div>
                </div>
                <div class="product-details">
                    <div class="product-detail">
                        <div class="product-detail-label">Quantidade</div>
                        <div class="product-detail-value"><span class="quantity-badge ${quantityClass}">${product.quantity}</span></div>
                    </div>
                    <div class="product-detail">
                        <div class="product-detail-label">Local</div>
                        <div class="product-detail-value">${this.escapeHtml(product.location)}</div>
                    </div>
                    ${product.description ? `<div class="product-detail"><div class="product-detail-label">Descrição</div><div class="product-detail-value">${this.escapeHtml(product.description)}</div></div>` : ''}
                    <div class="product-detail">
                        <div class="product-detail-label">Última atualização</div>
                        <div class="product-detail-value">${formattedDate}</div>
                    </div>
                </div>
            </div>
        `;
    }

    getQuantityClass(quantity) {
        if (quantity >= 50) return 'quantity-high';
        if (quantity >= 10) return 'quantity-medium';
        return 'quantity-low';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateStats() {
        const totalItems = document.getElementById('totalItems');
        const total = this.products.length;
        const totalQuantity = this.products.reduce((sum, product) => sum + product.quantity, 0);
        totalItems.textContent = `Total de itens: ${total} (${totalQuantity} unidades)`;
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modalOverlay');
        modal.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Foco automático somente ao abrir modal de produto
        if (modalId === 'productModal') {
            const nameInput = document.getElementById('productName');
            if (nameInput) nameInput.focus();
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modalOverlay');
        modal.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';

        if (modalId === 'productModal') {
            this.clearForm();
            this.currentEditingId = null;
        }
    }

    clearForm() {
        const form = document.getElementById('productForm');
        form.reset();
        const modalTitle = document.getElementById('modalTitle');
        modalTitle.textContent = 'Adicionar Produto';
    }

    populateForm(product) {
        document.getElementById('productName').value = product.name;
        document.getElementById('productCode').value = product.code;
        document.getElementById('productQuantity').value = product.quantity;
        document.getElementById('productLocation').value = product.location;
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('modalTitle').textContent = 'Editar Produto';
    }

    getFormData() {
        return {
            name: document.getElementById('productName').value,
            code: document.getElementById('productCode').value,
            quantity: document.getElementById('productQuantity').value,
            location: document.getElementById('productLocation').value,
            description: document.getElementById('productDescription').value
        };
    }

    addNewProduct() {
        this.currentEditingId = null;
        this.clearForm();
        this.openModal('productModal');
    }

    editProduct(productId) {
        const product = this.getProduct(productId);
        if (!product) { alert('Produto não encontrado'); return; }
        this.currentEditingId = productId;
        this.populateForm(product);
        this.openModal('productModal');
    }

    confirmDelete(productId) {
        const product = this.getProduct(productId);
        if (!product) { alert('Produto não encontrado'); return; }
        document.getElementById('deleteProductName').textContent = product.name;
        this.productToDelete = productId;
        this.openModal('confirmModal');
    }

    executeDelete() {
        if (this.productToDelete) {
            this.deleteProduct(this.productToDelete);
            this.productToDelete = null;
            this.closeModal('confirmModal');
        }
    }

    saveProduct() {
        const formData = this.getFormData();
        let success = false;

        if (this.currentEditingId) {
            success = this.updateProduct(formData);
        } else {
            success = this.addProduct(formData);
        }

        if (success) this.closeModal('productModal');
    }

    clearSearch() {
        const searchInput = document.getElementById('searchInput');
        searchInput.value = '';
        this.searchProducts('');
    }

    bindEvents() {
        document.getElementById('addItemBtn').addEventListener('click', () => this.addNewProduct());
        document.getElementById('searchInput').addEventListener('input', (e) => this.searchProducts(e.target.value));
        document.getElementById('clearSearch').addEventListener('click', () => this.clearSearch());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal('productModal'));
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal('productModal'));
        document.getElementById('productForm').addEventListener('submit', (e) => { e.preventDefault(); this.saveProduct(); });
        document.getElementById('cancelDelete').addEventListener('click', () => this.closeModal('confirmModal'));
        document.getElementById('confirmDelete').addEventListener('click', () => this.executeDelete());

        // Overlay
        document.getElementById('modalOverlay').addEventListener('click', () => {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) this.closeModal(activeModal.id);
        });

        // Tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) this.closeModal(activeModal.id);
            }
        });

        // Prevenir fechamento ao clicar dentro do modal
        document.querySelectorAll('.modal-content').forEach(content => {
            content.addEventListener('click', (e) => e.stopPropagation());
        });

        // REMOVIDO: transitionend que causava reset de foco
    }
}

// Inicializar
let inventorySystem;

document.addEventListener('DOMContentLoaded', () => {
    inventorySystem = new InventorySystem();
    
    if (inventorySystem.products.length === 0) {
        const exampleProducts = [
            { name: 'Papel A4 75g', code: 'PAP001', quantity: 150, location: 'Prateleira A1', description: 'Papel sulfite branco para impressão' },
            { name: 'Caneta Esferográfica Azul', code: 'CAN001', quantity: 25, location: 'Gaveta B2', description: 'Caneta esferográfica ponta média' },
            { name: 'Grampeador', code: 'GRA001', quantity: 5, location: 'Prateleira C1', description: 'Grampeador para até 20 folhas' }
        ];

        if (confirm('Deseja carregar alguns produtos de exemplo para testar o sistema?')) {
            exampleProducts.forEach(productData => inventorySystem.addProduct(productData));
        }
    }
});

// Exportar e importar
function exportData() {
    const dataStr = JSON.stringify(inventorySystem.products, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `estoque_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (Array.isArray(importedData)) {
                    if (confirm('Isso substituirá todos os dados atuais. Continuar?')) {
                        inventorySystem.products = importedData;
                        inventorySystem.saveToStorage();
                        inventorySystem.applyCurrentFilter();
                        inventorySystem.renderProducts();
                        inventorySystem.updateStats();
                        alert('Dados importados com sucesso!');
                    }
                } else {
                    alert('Formato de arquivo inválido');
                }
            } catch (error) {
                alert('Erro ao importar arquivo: ' + error.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

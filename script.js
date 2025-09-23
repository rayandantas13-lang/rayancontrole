// Sistema de Controle de Estoque - JavaScript (com backend)
const API_URL = 'http://localhost:3000/products'; // ajuste para sua API real

class InventorySystem {
    constructor() {
        this.products = [];
        this.currentEditingId = null;
        this.filteredProducts = [];
        this.productToDelete = null;

        this.init();
    }

    async init() {
        await this.loadFromBackend();
        this.bindEvents();
        this.renderProducts();
        this.updateStats();
    }

    // ===================== Backend =====================
    async loadFromBackend() {
        try {
            const res = await fetch(API_URL);
            this.products = await res.json();
            this.filteredProducts = [...this.products];
        } catch (error) {
            console.error('Erro ao carregar produtos da API:', error);
            this.products = [];
            this.filteredProducts = [];
        }
    }

    async addProduct(productData) {
        const errors = this.validateProduct(productData);
        if (errors.length > 0) { alert('Erros:\n' + errors.join('\n')); return false; }

        const product = {
            id: this.generateId(),
            name: productData.name.trim(),
            code: productData.code.trim().toUpperCase(),
            quantity: parseInt(productData.quantity),
            location: productData.location.trim(),
            description: productData.description?.trim() || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });

            this.products.push(product);
            this.applyCurrentFilter();
            this.renderProducts();
            this.updateStats();
            return true;
        } catch (error) {
            console.error('Erro ao adicionar produto:', error);
            alert('Erro ao adicionar produto no servidor.');
            return false;
        }
    }

    async updateProduct(productData) {
        const errors = this.validateProduct(productData);
        if (errors.length > 0) { alert('Erros:\n' + errors.join('\n')); return false; }

        const productIndex = this.products.findIndex(p => p.id === this.currentEditingId);
        if (productIndex === -1) { alert('Produto não encontrado'); return false; }

        const updatedProduct = {
            ...this.products[productIndex],
            name: productData.name.trim(),
            code: productData.code.trim().toUpperCase(),
            quantity: parseInt(productData.quantity),
            location: productData.location.trim(),
            description: productData.description?.trim() || '',
            updatedAt: new Date().toISOString()
        };

        try {
            await fetch(`${API_URL}/${this.currentEditingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProduct)
            });

            this.products[productIndex] = updatedProduct;
            this.applyCurrentFilter();
            this.renderProducts();
            this.updateStats();
            return true;
        } catch (error) {
            console.error('Erro ao atualizar produto:', error);
            alert('Erro ao atualizar produto no servidor.');
            return false;
        }
    }

    async deleteProduct(productId) {
        try {
            await fetch(`${API_URL}/${productId}`, { method: 'DELETE' });
            this.products = this.products.filter(p => p.id !== productId);
            this.applyCurrentFilter();
            this.renderProducts();
            this.updateStats();
            return true;
        } catch (error) {
            console.error('Erro ao deletar produto:', error);
            alert('Erro ao deletar produto no servidor.');
            return false;
        }
    }

    // ===================== Lógica existente =====================
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    validateProduct(productData) {
        const errors = [];
        if (!productData.name || productData.name.trim() === '') errors.push('Nome do item é obrigatório');
        if (!productData.code || productData.code.trim() === '') errors.push('Código/ID é obrigatório');
        if (productData.quantity === '' || productData.quantity < 0) errors.push('Quantidade deve ser >= 0');
        if (!productData.location || productData.location.trim() === '') errors.push('Local é obrigatório');

        const existingProduct = this.products.find(p =>
            p.code.toLowerCase() === productData.code.toLowerCase() &&
            p.id !== this.currentEditingId
        );
        if (existingProduct) errors.push('Já existe um produto com este código');

        return errors;
    }

    getProduct(productId) {
        return this.products.find(p => p.id === productId);
    }

    searchProducts(query) {
        if (!query || query.trim() === '') this.filteredProducts = [...this.products];
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
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim() !== '') this.searchProducts(searchInput.value);
        else this.filteredProducts = [...this.products];
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
        productsList.innerHTML = this.filteredProducts.map(p => this.createProductHTML(p)).join('');
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
        </div>`;
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
        const totalQuantity = this.products.reduce((sum, p) => sum + p.quantity, 0);
        totalItems.textContent = `Total de itens: ${total} (${totalQuantity} unidades)`;
    }

    // ===================== Modais =====================
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modalOverlay');
        modal.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

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
        document.getElementById('modalTitle').textContent = 'Adicionar Produto';
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

    async executeDelete() {
        if (this.productToDelete) {
            await this.deleteProduct(this.productToDelete);
            this.productToDelete = null;
            this.closeModal('confirmModal');
        }
    }

    async saveProduct() {
        const formData = this.getFormData();
        let success = false;

        if (this.currentEditingId) success = await this.updateProduct(formData);
        else success = await this.addProduct(formData);

        if (success) this.closeModal('productModal');
    }

    clearSearch() {
        document.getElementById('searchInput').value = '';
        this.searchProducts('');
    }

    // ===================== Eventos =====================
    bindEvents() {
        document.getElementById('addItemBtn').addEventListener('click', () => this.addNewProduct());
        document.getElementById('searchInput').addEventListener('input', e => this.searchProducts(e.target.value));
        document.getElementById('clearSearch').addEventListener('click', () => this.clearSearch());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal('productModal'));
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal('productModal'));
        document.getElementById('productForm').addEventListener('submit', e => { e.preventDefault(); this.saveProduct(); });
        document.getElementById('cancelDelete').addEventListener('click', () => this.closeModal('confirmModal'));
        document.getElementById('confirmDelete').addEventListener('click', () => this.executeDelete());

        document.getElementById('modalOverlay').addEventListener('click', () => {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) this.closeModal(activeModal.id);
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) this.closeModal(activeModal.id);
            }
        });

        document.querySelectorAll('.modal-content').forEach(content => content.addEventListener('click', e => e.stopPropagation()));
    }
}

// ===================== Inicialização =====================
const inventorySystem = new InventorySystem();




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

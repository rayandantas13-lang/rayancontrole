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
        this.bindEvents();
        this.loadFromFirestore();
    }

    // ===================== Firestore =====================
    async loadFromFirestore() {
        try {
            const colRef = collection(db, "products");
            // Atualização em tempo real
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

    async addProduct(productData) {
        const errors = this.validateProduct(productData);
        if (errors.length > 0) { alert(errors.join("\n")); return false; }

        const product = {
            name: productData.name.trim(),
            code: productData.code.trim().toUpperCase(),
            quantity: parseInt(productData.quantity),
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
                quantity: parseInt(productData.quantity),
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
                    <button onclick="inventorySystem.editProduct('${p.id}')" class="btn-edit">Editar</button>
                    <button onclick="inventorySystem.confirmDelete('${p.id}')" class="btn-delete">Excluir</button>
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
        document.getElementById("addItemBtn").addEventListener("click", () => this.addNewProduct());
        document.getElementById("searchInput").addEventListener("input", e => this.searchProducts(e.target.value));
        document.getElementById("clearSearch").addEventListener("click", () => this.clearSearch());
        document.getElementById("closeModal").addEventListener("click", () => this.closeModal("productModal"));
        document.getElementById("cancelBtn").addEventListener("click", () => this.closeModal("productModal"));
        document.getElementById("productForm").addEventListener("submit", e => { e.preventDefault(); this.saveProduct(); });
        document.getElementById("cancelDelete").addEventListener("click", () => this.closeModal("confirmModal"));
        document.getElementById("confirmDelete").addEventListener("click", () => this.executeDelete());
        document.getElementById("modalOverlay").addEventListener("click", () => {
            const active=document.querySelector(".modal.active"); if(active) this.closeModal(active.id);
        });
        document.addEventListener("keydown", e=>{ if(e.key==="Escape"){ const active=document.querySelector(".modal.active"); if(active) this.closeModal(active.id); }});
        document.querySelectorAll(".modal-content").forEach(c=>c.addEventListener("click", e=>e.stopPropagation()));
    }
}

// ===================== Inicialização =====================
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

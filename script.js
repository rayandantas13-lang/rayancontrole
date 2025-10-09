// Importar módulos do Firebase v9
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Suas credenciais do Firebase (versão 9)
const firebaseConfig = {
  apiKey: "AIzaSyBUhJcWkeMYqxNzg8c7VaFt-LmzGVZ5_yQ",
  authDomain: "almoxarifado-348d5.firebaseapp.com",
  projectId: "almoxarifado-348d5",
  storageBucket: "almoxarifado-348d5.firebasestorage.app",
  messagingSenderId: "295782162128",
  appId: "1:295782162128:web:7567d6605d20db5f3cc8d5",
  measurementId: "G-PC0FREL2DF"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

class InventorySystem {
    constructor() {
        this.products = [];
        this.requisitions = [];
        this.selectedProductsForRequisition = [];
        this.currentTab = 'products';
        this.nextRequisitionNumber = 1;
        this.currentUser = null;
        this.userRole = 'guest'; // guest, normal, subadm, admin
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.setupAuthListener(); // Configura o listener de autenticação primeiro
    }

    // ===================== Authentication and Authorization =====================
    async setupAuthListener() {
        return new Promise((resolve) => {
            onAuthStateChanged(auth, async (user) => {
                this.currentUser = user;
                if (user) {
                    // Carregar o papel do usuário do Firestore
                    const userDocRef = doc(db, "users", user.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        this.userRole = userDoc.data().role;
                    } else {
                        // Se o usuário existe no Auth mas não no Firestore, pode ser um novo registro
                        // ou um usuário com papel padrão (normal)
                        this.userRole = 'normal';
                        await setDoc(userDocRef, { email: user.email, role: this.userRole });
                    }
                    console.log("Usuário logado:", user.email, "Papel:", this.userRole);
                    document.getElementById("loginPage").style.display = "none";
                    document.getElementById("mainApp").style.display = "block";
                    await this.loadFromFirestore(); // Carregar dados após login
                    await this.loadRequisitionsFromFirestore();
                } else {
                    this.userRole = 'guest';
                    console.log("Usuário deslogado.");
                    document.getElementById("loginPage").style.display = "flex";
                    document.getElementById("mainApp").style.display = "none";
                    this.products = []; // Limpar dados se deslogado
                    this.requisitions = [];
                }
                this.applyPermissions();
                this.render();
                this.updateStats();
                this.updateDashboard();
                this.populateLocationFilter();
                resolve();
            });
        });
    }

    async login(email, password) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            alert("Login realizado com sucesso!");
        } catch (error) {
            console.error("Erro no login:", error);
            alert("Erro no login: " + error.message);
        }
    }

    async logout() {
        try {
            await signOut(auth);
            alert("Logout realizado com sucesso!");
        } catch (error) {
            console.error("Erro no logout:", error);
            alert("Erro no logout: " + error.message);
        }
    }

    applyPermissions() {
        const isAdmin = this.userRole === 'admin';
        const isSubAdm = this.userRole === 'subadm';
        const isNormalUser = this.userRole === 'normal';

        // Gerenciamento de Usuários (apenas ADM)
        const userManagementTabBtn = document.getElementById('userManagementTabBtn');
        if (userManagementTabBtn) userManagementTabBtn.style.display = isAdmin ? 'block' : 'none';
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) addUserBtn.style.display = isAdmin ? 'block' : 'none';

        // Adicionar Item (ADM e SubAdm)
        const addItemBtn = document.getElementById('addItemBtn');
        if (addItemBtn) addItemBtn.style.display = (isAdmin || isSubAdm) ? 'block' : 'none';

        // Gerar Nova Requisição (Todos, mas com campos específicos para cada um)
        const generateRequisitionBtn = document.getElementById('generateRequisitionBtn');
        if (generateRequisitionBtn) generateRequisitionBtn.style.display = (isAdmin || isSubAdm || isNormalUser) ? 'block' : 'none';

        // Campos de requisição (descrição vs quantidade estimada)
        const requisitionDescriptionLabel = document.querySelector('#requisitionModal label[for="requisitionDescription"]');
        const requisitionDescriptionInput = document.getElementById('requisitionDescription');
        const estimatedQuantityLabel = document.querySelector('#requisitionModal label[for="estimatedQuantity"]');
        const estimatedQuantityInput = document.getElementById('estimatedQuantity');

        if (isNormalUser) {
            if (requisitionDescriptionLabel) requisitionDescriptionLabel.textContent = 'Descrição (Opcional)';
            if (requisitionDescriptionInput) requisitionDescriptionInput.removeAttribute('required');
            if (estimatedQuantityLabel) estimatedQuantityLabel.style.display = 'block';
            if (estimatedQuantityInput) estimatedQuantityInput.style.display = 'block';
            if (estimatedQuantityInput) estimatedQuantityInput.setAttribute('required', 'true');
        } else {
            if (requisitionDescriptionLabel) requisitionDescriptionLabel.textContent = 'Descrição *';
            if (requisitionDescriptionInput) requisitionDescriptionInput.setAttribute('required', 'true');
            if (estimatedQuantityLabel) estimatedQuantityLabel.style.display = 'none';
            if (estimatedQuantityInput) estimatedQuantityInput.style.display = 'none';
            if (estimatedQuantityInput) estimatedQuantityInput.removeAttribute('required');
        }

        // Atualizar renderização para aplicar permissões nos itens da lista
        this.render();
        this.renderRequisitions();
        this.renderUsers();
    }

    // ===================== Firestore Operations =====================
    async loadFromFirestore() {
        try {
            const productsCol = collection(db, "products");
            const productSnapshot = await getDocs(productsCol);
            this.products = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Produtos carregados do Firestore:", this.products.length, "produtos.", this.products);
            if (this.products.length === 0) {
                console.warn("Nenhum produto encontrado no Firestore. Verifique sua coleção 'products'.");
            }
        } catch (error) {
            console.error("Erro ao carregar dados do Firestore:", error);
        }
    }

    async loadRequisitionsFromFirestore() {
        try {
            const requisitionsCol = collection(db, "requisitions");
            const requisitionSnapshot = await getDocs(requisitionsCol);
            this.requisitions = requisitionSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Requisições carregadas do Firestore:", this.requisitions.length, "requisições");
        } catch (error) {
            console.error("Erro ao carregar requisições do Firestore:", error);
        }
    }

    async saveToFirestore(product) {
        try {
            await setDoc(doc(db, "products", product.id), product);
            console.log("Produto salvo no Firestore:", product.id);
            return true;
        } catch (error) {
            console.error("Erro ao salvar no Firestore:", error);
            return false;
        }
    }

    async deleteFromFirestore(productId) {
        try {
            await deleteDoc(doc(db, "products", productId));
            console.log("Produto deletado do Firestore:", productId);
            return true;
        } catch (error) {
            console.error("Erro ao deletar do Firestore:", error);
            return false;
        }
    }

    async saveRequisitionToFirestore(requisition) {
        try {
            await setDoc(doc(db, "requisitions", requisition.id), requisition);
            console.log("Requisição salva no Firestore:", requisition.id);
            return true;
        } catch (error) {
            console.error("Erro ao salvar requisição no Firestore:", error);
            return false;
        }
    }

    async updateProductQuantityInFirestore(productId, newQuantity) {
        try {
            const productRef = doc(db, "products", productId);
            await updateDoc(productRef, { quantity: newQuantity });
            console.log(`Quantidade do produto ${productId} atualizada para ${newQuantity}`);
            return true;
        } catch (error) {
            console.error("Erro ao atualizar quantidade do produto no Firestore:", error);
            return false;
        }
    }

    async saveUserToFirestore(uid, email, role) {
        try {
            await setDoc(doc(db, "users", uid), { email, role });
            console.log("Usuário salvo no Firestore:", uid);
            return true;
        } catch (error) {
            console.error("Erro ao salvar usuário no Firestore:", error);
            return false;
        }
    }

    async deleteUserFromFirestore(uid) {
        try {
            await deleteDoc(doc(db, "users", uid));
            console.log("Usuário deletado do Firestore:", uid);
            return true;
        } catch (error) {
            console.error("Erro ao deletar usuário do Firestore:", error);
            return false;
        }
    }

    // ===================== Tab Management =====================
    switchTab(tabName) {
        if (!this.currentUser) {
            alert("Por favor, faça login para acessar o sistema.");
            return;
        }

        console.log("Aba atual:", tabName);
        
        // Atualizar botões das abas
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetButton) targetButton.classList.add('active');
        
        // Atualizar conteúdo das abas
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const targetTab = document.getElementById(`${tabName}Tab`);
        if (targetTab) targetTab.classList.add('active');
        
        this.currentTab = tabName;
        
        // Renderizar conteúdo específico da aba
        if (tabName === 'products') {
            this.render();
        } else if (tabName === 'requisition') {
            this.renderRequisitions();
        } else if (tabName === 'dashboard') {
            this.updateDashboard();
        } else if (tabName === 'userManagement') {
            this.renderUsers();
        }
    }

    // ===================== Product Management =====================
    addProduct(productData) {
        const product = {
            id: productData.code, // Usar o código como ID para simplificar
            name: productData.name,
            code: productData.code,
            quantity: parseFloat(productData.quantity),
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
                quantity: parseFloat(productData.quantity),
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

    render() {
        const productsList = document.getElementById("productsList");
        const emptyState = document.getElementById("emptyState");
        const searchInput = document.getElementById("searchInput");
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        const filteredProducts = this.products.filter(product =>
            (product.name ?? '').toLowerCase().includes(searchTerm) ||
            (product.code ?? '').toLowerCase().includes(searchTerm) ||
            (product.local ?? '').toLowerCase().includes(searchTerm)
        );

        if (productsList) {
            if (filteredProducts.length === 0) {
                if (emptyState) emptyState.style.display = "block";
                productsList.innerHTML = "";
            } else {
                if (emptyState) emptyState.style.display = "none";
                productsList.innerHTML = filteredProducts.map(product => this.createProductHTML(product)).join('');
            }
        }
    }

    createProductHTML(product) {
        const isAdmOrSubAdm = this.userRole === 'admin' || this.userRole === 'subadm';
        const quantity = product.quantity ?? 0;
        const quantityClass = quantity < 100 ? 'quantity-low' : quantity < 500 ? 'quantity-medium' : 'quantity-high';
        
        return `
        <div class="product-item" data-id="${product.id}">
            <div class="product-header">
                <div class="product-info">
                    <h3>${this.escapeHtml(product.name ?? '')}</h3>
                    <span class="product-code">Código: ${this.escapeHtml(product.code ?? '')}</span>
                </div>
                ${isAdmOrSubAdm ? `
                <div class="product-actions">
                    <button type="button" class="btn-edit" onclick="window.inventorySystem.openEditProductModal('${product.id}')">Editar</button>
                    <button type="button" class="btn-delete" onclick="window.inventorySystem.confirmDeleteProduct('${product.id}', '${this.escapeHtml(product.name ?? '')}')">Excluir</button>
                </div>
                ` : ''}
            </div>
            <div class="product-details">
                <div class="product-detail">
                    <div class="product-detail-label">Quantidade</div>
                    <div class="product-detail-value"><span class="quantity-badge ${quantityClass}">${quantity}</span></div>
                </div>
                <div class="product-detail">
                    <div class="product-detail-label">Local</div>
                    <div class="product-detail-value">${this.escapeHtml(product.local ?? '')}</div>
                </div>
                <div class="product-detail">
                    <div class="product-detail-label">Última Atualização</div>
                    <div class="product-detail-value">${this.escapeHtml(product.lastUpdated ?? '')}</div>
                </div>
                ${product.description ? `
                <div class="product-detail">
                    <div class="product-detail-label">Descrição</div>
                    <div class="product-detail-value">${this.escapeHtml(product.description)}</div>
                </div>
                ` : ''}
            </div>
        </div>`;
    }

    confirmDeleteProduct(productId, productName) {
        const confirmModal = document.getElementById('confirmModal');
        const deleteProductName = document.getElementById('deleteProductName');
        const confirmDelete = document.getElementById('confirmDelete');
        const cancelDelete = document.getElementById('cancelDelete');
        const modalOverlay = document.getElementById('modalOverlay');

        if (confirmModal && deleteProductName && confirmDelete && cancelDelete && modalOverlay) {
            deleteProductName.textContent = productName;
            
            // Mostrar modal
            confirmModal.classList.add('active');
            modalOverlay.classList.add('active');
            
            // Configurar eventos
            const handleConfirm = () => {
                this.deleteProduct(productId);
                this.closeConfirmModal();
                confirmDelete.removeEventListener('click', handleConfirm);
                cancelDelete.removeEventListener('click', handleCancel);
            };
            
            const handleCancel = () => {
                this.closeConfirmModal();
                confirmDelete.removeEventListener('click', handleConfirm);
                cancelDelete.removeEventListener('click', handleCancel);
            };
            
            confirmDelete.addEventListener('click', handleConfirm);
            cancelDelete.addEventListener('click', handleCancel);
        }
    }

    closeConfirmModal() {
        const confirmModal = document.getElementById('confirmModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (confirmModal) confirmModal.classList.remove('active');
        if (modalOverlay) modalOverlay.classList.remove('active');
    }

    updateStats() {
        const totalItems = document.getElementById('totalItems');
        if (totalItems) {
            totalItems.textContent = `Total de itens: ${this.products.length}`;
        }
    }

    updateDashboard() {
        // Implementar lógica do dashboard aqui
        console.log("Dashboard atualizado");
    }

    populateLocationFilter() {
        const locationFilter = document.getElementById('locationFilter');
        if (locationFilter) {
            const locations = [...new Set(this.products.map(p => p.local).filter(Boolean))];
            locationFilter.innerHTML = '<option value="">Todos os locais</option>' +
                locations.map(location => `<option value="${this.escapeHtml(location)}">${this.escapeHtml(location)}</option>`).join('');
        }
    }

    // ===================== Requisition Management =====================
    async generateRequisition(event) {
        event.preventDefault();
        const form = event.target;
        const local = form.requisitionLocal.value;
        const description = form.requisitionDescription ? form.requisitionDescription.value : '';
        const estimatedQuantity = form.estimatedQuantity ? parseInt(form.estimatedQuantity.value, 10) : 0;

        if (this.selectedProductsForRequisition.length === 0) {
            alert("Por favor, selecione pelo menos um produto.");
            return;
        }

        const requisition = {
            id: `REQ-${Date.now()}`,
            number: this.nextRequisitionNumber++,
            local: local,
            description: description,
            estimatedQuantity: estimatedQuantity,
            products: this.selectedProductsForRequisition.map(p => ({
                id: p.id,
                name: p.name,
                code: p.code,
                quantity: p.quantity
            })),
            totalItems: this.selectedProductsForRequisition.length,
            status: 'Pendente',
            createdAt: new Date().toLocaleDateString("pt-BR"),
            createdBy: this.currentUser ? this.currentUser.email : 'Unknown'
        };

        this.requisitions.push(requisition);
        await this.saveRequisitionToFirestore(requisition);
        this.selectedProductsForRequisition = [];
        this.closeRequisitionModal();
        this.renderRequisitions();
        alert("Requisição gerada com sucesso!");
    }

    renderRequisitions() {
        const requisitionsList = document.getElementById("requisitionsList");
        if (requisitionsList) {
            if (this.requisitions.length === 0) {
                requisitionsList.innerHTML = "<p>Nenhuma requisição realizada ainda.</p>";
            } else {
                requisitionsList.innerHTML = this.requisitions.map(requisition => this.createRequisitionHTML(requisition)).join('');
            }
        }
    }

    createRequisitionHTML(requisition) {
        const isAdm = this.userRole === 'admin';
        const isAdmOrSubAdm = this.userRole === 'admin' || this.userRole === 'subadm';
        const isPending = requisition.status === 'Pendente';
        
        return `
        <div class="requisition-item" data-id="${requisition.id}">
            <div class="requisition-header">
                <div class="requisition-info">
                    <h3>Requisição #${requisition.number}</h3>
                    <span class="requisition-number">ID: ${requisition.id}</span>
                </div>
                <div class="requisition-status status-${requisition.status.toLowerCase().replace('ê', 'e')}">
                    ${requisition.status}
                </div>
            </div>
            <div class="requisition-details">
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Local</div>
                    <div class="requisition-detail-value">${this.escapeHtml(requisition.local ?? '')}</div>
                </div>
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Data</div>
                    <div class="requisition-detail-value">${this.escapeHtml(requisition.createdAt ?? '')}</div>
                </div>
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Total de Itens</div>
                    <div class="requisition-detail-value">${requisition.totalItems}</div>
                </div>
                ${requisition.description ? `
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Descrição</div>
                    <div class="requisition-detail-value">${this.escapeHtml(requisition.description)}</div>
                </div>
                ` : ''}
                ${requisition.estimatedQuantity ? `
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Quantidade Estimada</div>
                    <div class="requisition-detail-value">${requisition.estimatedQuantity}</div>
                </div>
                ` : ''}
            </div>
            <div class="requisition-products">
                <h4>Produtos Requisitados</h4>
                <ul class="requisition-products-list">
                    ${requisition.products.map(product => {
                        return `
                            <li class="requisition-product-item">
                                <div class="requisition-product-info">
                                    <span class="requisition-product-name">${this.escapeHtml(product.name ?? '')}</span>
                                    <span class="requisition-product-quantity">Código: ${this.escapeHtml(product.code ?? '')}</span>
                                </div>
                                ${isAdmOrSubAdm && isPending ? `
                                    <div class="supply-quantity-section">
                                        <div class="supply-quantity-input">
                                            <input type="number" class="finalized-qty-input" data-product-id="${product.id}" placeholder="Qtd real" min="0">
                                        </div>
                                    </div>
                                ` : ''}
                                ${requisition.finalizedQuantitiesPerItem && requisition.finalizedQuantitiesPerItem[product.id] !== undefined ? `
                                    <span class="supply-quantity-value">Fornecido: ${requisition.finalizedQuantitiesPerItem[product.id]}</span>
                                ` : ''}
                            </li>`;
                    }).join('')}
                </ul>
            </div>
            <div class="requisition-actions">
                ${isAdmOrSubAdm && isPending ? `
                    <button type="button" class="btn-primary" onclick="window.inventorySystem.finalizeRequisition('${requisition.id}')">Finalizar Requisição</button>
                ` : ''}
                ${isAdmOrSubAdm && isPending ? `
                    <button type="button" class="btn-edit" onclick="window.inventorySystem.openEditRequisitionModal('${requisition.id}')">Editar</button>
                ` : ''}
                ${isAdm ? `
                    <button type="button" class="btn-delete" onclick="window.inventorySystem.confirmDeleteRequisition('${requisition.id}')">Excluir</button>
                ` : ''}
            </div>
        </div>`;
    }

    async finalizeRequisition(requisitionId) {
        const requisitionIndex = this.requisitions.findIndex(r => r.id === requisitionId);
        if (requisitionIndex !== -1) {
            const requisition = this.requisitions[requisitionIndex];
            const finalizedQuantitiesPerItem = {};
            let totalFinalizedQuantity = 0;

            // Coletar quantidades finalizadas por item
            const inputs = document.querySelectorAll(`#requisitionsList div[data-id="${requisitionId}"] .finalized-qty-input`);
            for (const input of inputs) {
                const productId = input.dataset.productId;
                const quantity = parseInt(input.value, 10);
                if (isNaN(quantity) || quantity < 0) {
                    alert(`Por favor, insira uma quantidade real válida para o produto ${productId}.`);
                    return;
                }
                finalizedQuantitiesPerItem[productId] = quantity;
                totalFinalizedQuantity += quantity;
            }

            requisition.status = 'Finalizado';
            requisition.finalizedQuantity = totalFinalizedQuantity; // Total geral
            requisition.finalizedQuantitiesPerItem = finalizedQuantitiesPerItem; // Quantidades por item

            // Atualizar estoque para cada produto na requisição
            for (const reqProduct of requisition.products) {
                const productId = reqProduct.id;
                const finalizedQty = finalizedQuantitiesPerItem[productId] ?? 0;
                const productIndex = this.products.findIndex(p => p.id === productId);
                if (productIndex !== -1) {
                    const product = this.products[productIndex];
                    const newQuantity = product.quantity - finalizedQty;
                    product.quantity = newQuantity < 0 ? 0 : newQuantity;
                    await this.updateProductQuantityInFirestore(product.id, product.quantity);
                }
            }

            await this.saveRequisitionToFirestore(requisition);
            this.renderRequisitions();
            this.render(); // Atualizar a lista de produtos
            alert("Requisição finalizada com sucesso!");
        }
    }

    async confirmDeleteRequisition(requisitionId) {
        if (this.userRole !== 'admin') {
            alert("Você não tem permissão para excluir requisições.");
            return;
        }
        if (confirm(`Tem certeza que deseja excluir a requisição ${requisitionId}?`)) {
            await deleteDoc(doc(db, "requisitions", requisitionId));
            this.requisitions = this.requisitions.filter(r => r.id !== requisitionId);
            this.renderRequisitions();
            alert("Requisição excluída com sucesso!");
        }
    }

    openEditRequisitionModal(requisitionId) {
        const requisition = this.requisitions.find(r => r.id === requisitionId);
        if (!requisition || requisition.status !== 'Pendente') {
            alert("Apenas requisições pendentes podem ser editadas.");
            return;
        }
        // Preencher modal de requisição com os dados existentes
        const form = document.getElementById('requisitionForm');
        if (form) {
            const localInput = form.querySelector('#requisitionLocal');
            if (localInput) localInput.value = requisition.local ?? '';
            
            const descriptionInput = form.querySelector('#requisitionDescription');
            if (descriptionInput) descriptionInput.value = requisition.description ?? '';
            
            // Se houver um campo de quantidade estimada, preenchê-lo
            const estimatedQuantityInput = document.getElementById('estimatedQuantity');
            if (estimatedQuantityInput && requisition.estimatedQuantity) {
                estimatedQuantityInput.value = requisition.estimatedQuantity;
            }
            
            // Selecionar produtos existentes
            this.selectedProductsForRequisition = requisition.products.map(p => ({
                id: p.id,
                name: p.name,
                code: p.code,
                quantity: p.quantity
            }));
            this.updateSelectedProductsDisplay();
            
            // Guardar o ID da requisição para edição
            form.dataset.editingRequisitionId = requisitionId;
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.textContent = 'Editar Requisição';
            this.openRequisitionModal();
        }
    }

    async editRequisition(event) {
        event.preventDefault();
        const form = event.target;
        const requisitionId = form.dataset.editingRequisitionId;
        const local = form.querySelector('#requisitionLocal').value;
        const description = form.querySelector('#requisitionDescription') ? form.querySelector('#requisitionDescription').value : '';
        const estimatedQuantity = form.querySelector('#estimatedQuantity') ? parseInt(form.querySelector('#estimatedQuantity').value, 10) : 0;

        if (this.selectedProductsForRequisition.length === 0) {
            alert("Por favor, selecione pelo menos um produto.");
            return;
        }

        const requisitionIndex = this.requisitions.findIndex(r => r.id === requisitionId);
        if (requisitionIndex !== -1) {
            const existingRequisition = this.requisitions[requisitionIndex];
            existingRequisition.local = local;
            existingRequisition.description = description;
            existingRequisition.estimatedQuantity = estimatedQuantity;
            existingRequisition.products = this.selectedProductsForRequisition.map(p => ({
                id: p.id,
                name: p.name,
                code: p.code,
                quantity: p.quantity
            }));
            existingRequisition.totalItems = this.selectedProductsForRequisition.length;

            await this.saveRequisitionToFirestore(existingRequisition);
            this.renderRequisitions();
            this.closeRequisitionModal();
            alert("Requisição atualizada com sucesso!");
        }
    }

    // ===================== Product Selection for Requisitions =====================
    openProductSelectionModal() {
        const productSelectionModal = document.getElementById('productSelectionModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (productSelectionModal && modalOverlay) {
            this.populateAvailableProducts();
            productSelectionModal.classList.add('active');
            modalOverlay.classList.add('active');
        }
    }

    closeProductSelectionModal() {
        const productSelectionModal = document.getElementById('productSelectionModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (productSelectionModal) productSelectionModal.classList.remove('active');
        if (modalOverlay) modalOverlay.classList.remove('active');
    }

    populateAvailableProducts() {
        const availableProductsList = document.getElementById('availableProductsList');
        if (availableProductsList) {
            availableProductsList.innerHTML = this.products.map(product => `
                <div class="available-product-item" data-product-id="${product.id}">
                    <div class="available-product-info">
                        <div class="available-product-name">${this.escapeHtml(product.name ?? '')}</div>
                        <div class="available-product-details">Código: ${this.escapeHtml(product.code ?? '')} | Local: ${this.escapeHtml(product.local ?? '')} | Estoque: ${product.quantity ?? 0}</div>
                    </div>
                    <input type="checkbox" class="product-checkbox" value="${product.id}" ${this.selectedProductsForRequisition.some(p => p.id === product.id) ? 'checked' : ''}>
                </div>
            `).join('');

            // Adicionar event listeners para os checkboxes
            availableProductsList.querySelectorAll('.product-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const productId = e.target.value;
                    const productItem = e.target.closest('.available-product-item');
                    
                    if (e.target.checked) {
                        productItem.classList.add('selected');
                    } else {
                        productItem.classList.remove('selected');
                    }
                });
            });
        }
    }

    confirmProductSelection() {
        const selectedCheckboxes = document.querySelectorAll('#availableProductsList .product-checkbox:checked');
        this.selectedProductsForRequisition = [];
        
        selectedCheckboxes.forEach(checkbox => {
            const productId = checkbox.value;
            const product = this.products.find(p => p.id === productId);
            if (product) {
                this.selectedProductsForRequisition.push({
                    id: product.id,
                    name: product.name,
                    code: product.code,
                    quantity: 1 // Quantidade padrão
                });
            }
        });

        this.updateSelectedProductsDisplay();
        this.closeProductSelectionModal();
    }

    updateSelectedProductsDisplay() {
        const selectedProducts = document.getElementById('selectedProducts');
        if (selectedProducts) {
            if (this.selectedProductsForRequisition.length === 0) {
                selectedProducts.innerHTML = '<p>Nenhum produto selecionado</p>';
                selectedProducts.classList.remove('has-products');
            } else {
                selectedProducts.innerHTML = this.selectedProductsForRequisition.map((product, index) => `
                    <div class="selected-product-item">
                        <div class="selected-product-info">
                            <div class="selected-product-name">${this.escapeHtml(product.name ?? '')}</div>
                            <div class="selected-product-code">Código: ${this.escapeHtml(product.code ?? '')}</div>
                        </div>
                        <div class="selected-product-quantity">
                            <input type="number" value="${product.quantity}" min="1" onchange="window.inventorySystem.updateSelectedProductQuantity(${index}, this.value)">
                        </div>
                        <button type="button" class="remove-product-btn" onclick="window.inventorySystem.removeSelectedProduct(${index})">Remover</button>
                    </div>
                `).join('');
                selectedProducts.classList.add('has-products');
            }
        }
    }

    updateSelectedProductQuantity(index, quantity) {
        if (this.selectedProductsForRequisition[index]) {
            this.selectedProductsForRequisition[index].quantity = parseInt(quantity, 10) || 1;
        }
    }

    removeSelectedProduct(index) {
        this.selectedProductsForRequisition.splice(index, 1);
        this.updateSelectedProductsDisplay();
    }

    // ===================== User Management =====================
    async addUser(email, password, role) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await this.saveUserToFirestore(user.uid, email, role);
            alert("Usuário adicionado com sucesso!");
            this.renderUsers();
        } catch (error) {
            console.error("Erro ao adicionar usuário:", error);
            alert("Erro ao adicionar usuário: " + error.message);
        }
    }

    async deleteUser(uid) {
        if (this.userRole !== 'admin') {
            alert("Você não tem permissão para excluir usuários.");
            return;
        }
        if (this.currentUser && this.currentUser.uid === uid) {
            alert("Você não pode excluir seu próprio usuário ADM.");
            return;
        }
        // Adicionar lógica para deletar usuário do Firebase Auth (requer ambiente de admin)
        // Por enquanto, vamos apenas deletar do Firestore
        await this.deleteUserFromFirestore(uid);
        alert("Usuário deletado com sucesso!");
        this.renderUsers();
    }

    async renderUsers() {
        const userList = document.getElementById("userList");
        if (userList) {
            try {
                const usersCol = collection(db, "users");
                const userSnapshot = await getDocs(usersCol);
                const users = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                if (users.length === 0) {
                    userList.innerHTML = '<p>Nenhum usuário cadastrado.</p>';
                } else {
                    userList.innerHTML = users.map(user => this.createUserHTML(user)).join('');
                }
            } catch (error) {
                console.error("Erro ao renderizar usuários:", error);
                userList.innerHTML = '<p>Erro ao carregar usuários.</p>';
            }
        }
    }

    createUserHTML(user) {
        const isAdmin = this.userRole === 'admin';
        return `
        <div class="user-item">
            <div class="user-info">
                <h4>${this.escapeHtml(user.email ?? '')}</h4>
                <p>Nível: <span class="user-role-badge ${user.role ?? 'normal'}">${this.escapeHtml(user.role ?? 'normal')}</span></p>
            </div>
            <div class="user-actions">
                ${isAdmin && this.currentUser && this.currentUser.uid !== user.id ? `
                    <button type="button" class="btn-delete" onclick="window.inventorySystem.deleteUser('${user.id}')">Excluir</button>
                ` : ''}
            </div>
        </div>`;
    }

    // ===================== UI and Utilities =====================
    setupEventListeners() {
        // Login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = e.target.loginEmail.value;
                const password = e.target.loginPassword.value;
                this.login(email, password);
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

        // Tabs
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.dataset.tab);
            });
        });

        // Modals - Botões principais
        const addItemBtn = document.getElementById('addItemBtn');
        if (addItemBtn) addItemBtn.addEventListener('click', () => this.openAddProductModal());
        
        const generateRequisitionBtn = document.getElementById('generateRequisitionBtn');
        if (generateRequisitionBtn) generateRequisitionBtn.addEventListener('click', () => this.openRequisitionModal());
        
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) addUserBtn.addEventListener('click', () => this.openAddUserModal());

        // Modals - Botões de fechar
        const closeModal = document.getElementById('closeModal');
        if (closeModal) closeModal.addEventListener('click', () => this.closeProductModal());
        
        const closeRequisitionModal = document.getElementById('closeRequisitionModal');
        if (closeRequisitionModal) closeRequisitionModal.addEventListener('click', () => this.closeRequisitionModal());
        
        const closeProductSelectionModal = document.getElementById('closeProductSelectionModal');
        if (closeProductSelectionModal) closeProductSelectionModal.addEventListener('click', () => this.closeProductSelectionModal());
        
        const closeUserModal = document.getElementById('closeUserModal');
        if (closeUserModal) closeUserModal.addEventListener('click', () => this.closeUserModal());

        // Modals - Botões de cancelar
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeProductModal());
        
        const cancelRequisitionBtn = document.getElementById('cancelRequisitionBtn');
        if (cancelRequisitionBtn) cancelRequisitionBtn.addEventListener('click', () => this.closeRequisitionModal());
        
        const cancelProductSelectionBtn = document.getElementById('cancelProductSelectionBtn');
        if (cancelProductSelectionBtn) cancelProductSelectionBtn.addEventListener('click', () => this.closeProductSelectionModal());
        
        const cancelUserBtn = document.getElementById('cancelUserBtn');
        if (cancelUserBtn) cancelUserBtn.addEventListener('click', () => this.closeUserModal());

        // Seleção de produtos
        const selectProductsBtn = document.getElementById('selectProductsBtn');
        if (selectProductsBtn) selectProductsBtn.addEventListener('click', () => this.openProductSelectionModal());
        
        const confirmProductSelectionBtn = document.getElementById('confirmProductSelectionBtn');
        if (confirmProductSelectionBtn) confirmProductSelectionBtn.addEventListener('click', () => this.confirmProductSelection());

        // Forms
        const productForm = document.getElementById('productForm');
        if (productForm) {
            productForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const productId = document.getElementById('productId') ? document.getElementById('productId').value : '';
                const productData = {
                    name: e.target.productName.value,
                    code: e.target.productCode.value,
                    quantity: e.target.productQuantity.value,
                    local: e.target.productLocation.value,
                    description: e.target.productDescription.value
                };
                if (productId) {
                    this.editProduct(productId, productData);
                } else {
                    this.addProduct(productData);
                }
                this.closeProductModal();
            });
        }

        const requisitionForm = document.getElementById('requisitionForm');
        if (requisitionForm) {
            requisitionForm.addEventListener('submit', (e) => {
                if (e.target.dataset.editingRequisitionId) {
                    this.editRequisition(e);
                } else {
                    this.generateRequisition(e);
                }
            });
        }

        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = e.target.userEmail.value;
                const password = e.target.userPassword.value;
                const role = e.target.userRole.value;
                this.addUser(email, password, role);
                this.closeUserModal();
            });
        }

        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.addEventListener('input', () => this.render());
        
        const clearSearch = document.getElementById('clearSearch');
        if (clearSearch) clearSearch.addEventListener('click', () => {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
                this.render();
            }
        });

        // Filter by Location
        const locationFilter = document.getElementById('locationFilter');
        if (locationFilter) locationFilter.addEventListener('change', () => this.render());

        // Product search in selection modal
        const productSearchInput = document.getElementById('productSearchInput');
        if (productSearchInput) {
            productSearchInput.addEventListener('input', (e) => {
                this.filterAvailableProducts(e.target.value);
            });
        }

        // Modal overlay click to close
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', () => {
                this.closeAllModals();
            });
        }
    }

    filterAvailableProducts(searchTerm) {
        const availableProductItems = document.querySelectorAll('.available-product-item');
        const term = searchTerm.toLowerCase();
        
        availableProductItems.forEach(item => {
            const name = item.querySelector('.available-product-name').textContent.toLowerCase();
            const details = item.querySelector('.available-product-details').textContent.toLowerCase();
            
            if (name.includes(term) || details.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    closeAllModals() {
        this.closeProductModal();
        this.closeRequisitionModal();
        this.closeProductSelectionModal();
        this.closeUserModal();
        this.closeConfirmModal();
    }

    openAddProductModal() {
        const productForm = document.getElementById('productForm');
        if (productForm) productForm.reset();
        
        const productId = document.getElementById('productId');
        if (productId) productId.value = '';
        
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) modalTitle.textContent = 'Adicionar Produto';
        
        const productModal = document.getElementById('productModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (productModal && modalOverlay) {
            productModal.classList.add('active');
            modalOverlay.classList.add('active');
        }
    }

    openEditProductModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            const productIdInput = document.getElementById('productId');
            if (productIdInput) productIdInput.value = product.id;
            
            const productNameInput = document.getElementById('productName');
            if (productNameInput) productNameInput.value = product.name ?? '';
            
            const productCodeInput = document.getElementById('productCode');
            if (productCodeInput) productCodeInput.value = product.code ?? '';
            
            const productQuantityInput = document.getElementById('productQuantity');
            if (productQuantityInput) productQuantityInput.value = product.quantity ?? 0;
            
            const productLocationInput = document.getElementById('productLocation');
            if (productLocationInput) productLocationInput.value = product.local ?? '';
            
            const productDescriptionInput = document.getElementById('productDescription');
            if (productDescriptionInput) productDescriptionInput.value = product.description ?? '';
            
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) modalTitle.textContent = 'Editar Produto';
            
            const productModal = document.getElementById('productModal');
            const modalOverlay = document.getElementById('modalOverlay');
            
            if (productModal && modalOverlay) {
                productModal.classList.add('active');
                modalOverlay.classList.add('active');
            }
        }
    }

    closeProductModal() {
        const productModal = document.getElementById('productModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (productModal) productModal.classList.remove('active');
        if (modalOverlay) modalOverlay.classList.remove('active');
    }

    openRequisitionModal() {
        const requisitionForm = document.getElementById('requisitionForm');
        if (requisitionForm) {
            requisitionForm.reset();
            delete requisitionForm.dataset.editingRequisitionId;
        }
        
        this.selectedProductsForRequisition = [];
        this.updateSelectedProductsDisplay();
        
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) modalTitle.textContent = 'Gerar Nova Requisição';
        
        const requisitionModal = document.getElementById('requisitionModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (requisitionModal && modalOverlay) {
            requisitionModal.classList.add('active');
            modalOverlay.classList.add('active');
        }
    }

    closeRequisitionModal() {
        const requisitionModal = document.getElementById('requisitionModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (requisitionModal) requisitionModal.classList.remove('active');
        if (modalOverlay) modalOverlay.classList.remove('active');
        
        this.selectedProductsForRequisition = [];
        this.updateSelectedProductsDisplay();
    }

    openAddUserModal() {
        const userForm = document.getElementById('userForm');
        if (userForm) userForm.reset();
        
        const userModalTitle = document.getElementById('userModalTitle');
        if (userModalTitle) userModalTitle.textContent = 'Adicionar Usuário';
        
        const userModal = document.getElementById('userModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (userModal && modalOverlay) {
            userModal.classList.add('active');
            modalOverlay.classList.add('active');
        }
    }

    closeUserModal() {
        const userModal = document.getElementById('userModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (userModal) userModal.classList.remove('active');
        if (modalOverlay) modalOverlay.classList.remove('active');
    }

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

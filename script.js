// Importar módulos do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, updatePassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Configuração do Firebase (substitua pelas suas credenciais reais)
const firebaseConfig = {
  apiKey: "AIzaSyBUhJcWkeMYqxNzg8c7VaFt-LmzGVZ5_yQ",
  authDomain: "almoxarifado-348d5.firebaseapp.com",
  projectId: "almoxarifado-348d5",
  storageBucket: "almoxarifado-348d5.appspot.com",
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
        this.render();
        this.updateStats();
        this.updateDashboard();
        this.populateLocationFilter();
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
        document.getElementById('userManagementTabBtn').style.display = isAdmin ? 'block' : 'none';
        document.getElementById('addUserBtn').style.display = isAdmin ? 'block' : 'none';

        // Adicionar Item (ADM e SubAdm)
        document.getElementById('addItemBtn').style.display = (isAdmin || isSubAdm) ? 'block' : 'none';

        // Editar/Excluir Produtos (ADM e SubAdm)
        // A lógica para esconder os botões de editar/excluir individualmente será aplicada na renderização dos produtos

        // Gerar Nova Requisição (Todos, mas com campos específicos para cada um)
        document.getElementById('generateRequisitionBtn').style.display = (isAdmin || isSubAdm || isNormalUser) ? 'block' : 'none';

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

        // Botões de finalizar requisição (ADM e SubAdm)
        // A lógica para esconder os botões de finalizar/abastecer será aplicada na renderização das requisições

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
            console.log("Dados carregados do Firestore:", this.products.length, "produtos");
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
            await setDoc(productRef, { quantity: newQuantity }, { merge: true });
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
        const searchTerm = document.getElementById("searchInput").value.toLowerCase();

        const filteredProducts = this.products.filter(product =>
            product.name.toLowerCase().includes(searchTerm) ||
            product.code.toLowerCase().includes(searchTerm) ||
            product.local.toLowerCase().includes(searchTerm)
        );

        if (filteredProducts.length === 0) {
            emptyState.style.display = "block";
            productsList.innerHTML = "";
        } else {
            emptyState.style.display = "none";
            productsList.innerHTML = filteredProducts.map(product => this.createProductHTML(product)).join('');
        }
    }

    createProductHTML(product) {
        const isAdmOrSubAdm = this.userRole === 'admin' || this.userRole === 'subadm';
        const quantityClass = product.quantity < 100 ? 'quantity-low' : product.quantity < 500 ? 'quantity-medium' : 'quantity-high';
        
        return `
        <div class="product-item" data-id="${product.id}">
            <div class="product-header">
                <div class="product-info">
                    <h3>${this.escapeHtml(product.name)}</h3>
                    <span class="product-code">Código: ${this.escapeHtml(product.code)}</span>
                </div>
                ${isAdmOrSubAdm ? `
                <div class="product-actions">
                    <button type="button" class="btn-edit" onclick="window.inventorySystem.openEditProductModal('${product.id}')">Editar</button>
                    <button type="button" class="btn-danger" onclick="window.inventorySystem.confirmDeleteProduct('${product.id}', '${this.escapeHtml(product.name)}')">Excluir</button>
                </div>
                ` : ''}
            </div>
            <div class="product-details">
                <div class="product-detail">
                    <div class="product-detail-label">Quantidade</div>
                    <div class="product-detail-value"><span class="quantity-badge ${quantityClass}">${product.quantity}</span></div>
                </div>
                <div class="product-detail">
                    <div class="product-detail-label">Local</div>
                    <div class="product-detail-value">${this.escapeHtml(product.local)}</div>
                </div>
                <div class="product-detail">
                    <div class="product-detail-label">Última Atualização</div>
                    <div class="product-detail-value">${this.escapeHtml(product.lastUpdated)}</div>
                </div>
                <div class="product-detail">
                    <div class="product-detail-label">Descrição</div>
                    <div class="product-detail-value">${this.escapeHtml(product.description)}</div>
                </div>
            </div>
        </div>`;
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
        const statusClass = req.status === 'finished' ? 'status-finished' : 'status-pending';
        const statusText = req.status === 'finished' ? 'Finalizado' : 'Pendente';
        const isAdmOrSubAdm = this.userRole === 'admin' || this.userRole === 'subadm';
        
        return `
        <div class="requisition-item" data-id="${req.id}">
            <div class="requisition-header">
                <div class="requisition-info">
                    <h3>${this.escapeHtml(req.description || 'Requisição sem descrição')}</h3>
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
                ${req.finalizedQuantity ? `
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Quantidade Finalizada</div>
                    <div class="requisition-detail-value">${req.finalizedQuantity}</div>
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
                                <span class="requisition-product-quantity">Solicitado: ${p.requestedQuantity}</span>
                                ${p.suppliedQuantity ? `<span class="supply-quantity-value">Abastecido: ${p.suppliedQuantity}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ${isAdmOrSubAdm && req.status === 'pending' ? `
            <div class="form-actions" style="margin-top: var(--spacing-lg); border-top: 1px solid var(--border-color); padding-top: var(--spacing-lg); justify-content: flex-start;">
                <input type="number" id="finalizedQuantity-${req.id}" placeholder="Qtd. Real Finalizada" min="1" style="width: 180px; padding: var(--spacing-sm); border-radius: var(--border-radius); border: 1px solid var(--border-color);"/>
                <button type="button" class="btn-primary" onclick="window.inventorySystem.finalizeRequisition('${req.id}')">Finalizar Requisição</button>
            </div>
            ` : ''}
        </div>`;
    }

    openRequisitionModal() {
        if (!this.currentUser) {
            alert("Por favor, faça login para gerar requisições.");
            return;
        }
        this.selectedProductsForRequisition = [];
        document.getElementById("requisitionForm").reset();
        this.renderSelectedProducts();
        this.renderAvailableProducts();
        this.applyPermissions(); // Reaplicar permissões para o modal
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
            product.requestedQuantity = parseFloat(quantity) || 1;
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
            if (!this.selectedProductsForRequisition.some(p => p.id === product.id)) {
                this.selectedProductsForRequisition.push({
                    ...product,
                    requestedQuantity: 1 // Quantidade inicial ao selecionar
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
        const descriptionInput = document.getElementById("requisitionDescription");
        const estimatedQuantityInput = document.getElementById("estimatedQuantity");

        let description = '';
        let estimatedQuantity = null;

        if (this.userRole === 'normal') {
            estimatedQuantity = parseFloat(estimatedQuantityInput.value);
            if (isNaN(estimatedQuantity) || estimatedQuantity <= 0) {
                alert("Por favor, insira uma quantidade estimada válida.");
                return;
            }
            description = descriptionInput.value.trim(); // Descrição opcional para usuário normal
        } else {
            description = descriptionInput.value.trim();
            if (!description) {
                alert("Por favor, preencha a descrição da requisição.");
                return;
            }
        }

        if (!local) {
            alert("Por favor, preencha o local da requisição.");
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
            estimatedQuantity: estimatedQuantity,
            products: this.selectedProductsForRequisition.map(p => ({
                id: p.id,
                name: p.name,
                code: p.code,
                requestedQuantity: p.requestedQuantity,
                suppliedQuantity: 0 // Quantidade abastecida inicialmente é zero
            })),
            status: 'pending',
            createdAt: new Date().toISOString(),
            requestedBy: this.currentUser.email
        };

        this.requisitions.push(requisitionData);
        await this.saveRequisitionToFirestore(requisitionData);
        this.closeModal("requisitionModal");
        this.renderRequisitions();
        alert("Requisição gerada com sucesso!");
    }

    async finalizeRequisition(requisitionId) {
        if (this.userRole !== 'admin' && this.userRole !== 'subadm') {
            alert("Você não tem permissão para finalizar requisições.");
            return;
        }

        const requisition = this.requisitions.find(req => req.id === requisitionId);
        if (!requisition) return;

        const finalizedQuantityInput = document.getElementById(`finalizedQuantity-${requisitionId}`);
        const finalizedQuantity = parseFloat(finalizedQuantityInput.value);

        if (isNaN(finalizedQuantity) || finalizedQuantity <= 0) {
            alert("Por favor, insira uma quantidade real finalizada válida.");
            return;
        }

        // Atualizar status da requisição
        requisition.status = 'finished';
        requisition.finalizedQuantity = finalizedQuantity;
        requisition.finalizedAt = new Date().toISOString();
        requisition.finalizedBy = this.currentUser.email;

        // Diminuir quantidade dos produtos no estoque
        for (const reqProduct of requisition.products) {
            const productInStock = this.products.find(p => p.id === reqProduct.id);
            if (productInStock) {
                // Para simplificar, vamos diminuir a quantidade solicitada de cada produto
                // ou você pode implementar uma lógica mais complexa baseada na finalizedQuantity total
                // Por enquanto, vamos assumir que a finalizedQuantity total é distribuída proporcionalmente
                // ou que cada item solicitado é totalmente abastecido.
                // Para este exemplo, vamos subtrair a quantidade solicitada de cada item.
                const newQuantity = productInStock.quantity - reqProduct.requestedQuantity;
                if (newQuantity < 0) {
                    alert(`Atenção: Estoque insuficiente para ${productInStock.name}. Quantidade em estoque ficará negativa.`);
                }
                productInStock.quantity = newQuantity;
                reqProduct.suppliedQuantity = reqProduct.requestedQuantity; // Marcar como totalmente abastecido
                await this.updateProductQuantityInFirestore(productInStock.id, newQuantity);
            }
        }

        await this.saveRequisitionToFirestore(requisition);
        this.renderRequisitions();
        this.render(); // Atualizar lista de produtos para refletir a mudança no estoque
        this.updateStats();
        this.updateDashboard();
        alert("Requisição finalizada e estoque atualizado!");
    }

    generateRequisitionNumber(local, description) {
        // Lógica para gerar um número de requisição único
        // Pode ser baseado em data, hora, e um contador
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
            const currentRequisitionNumber = this.nextRequisitionNumber;
            this.nextRequisitionNumber++;
            const counter = currentRequisitionNumber.toString().padStart(4, '0');
        return `REQ-${year}${month}${day}-${counter}`;
    }

    // ===================== User Management =====================
    async renderUsers() {
        if (this.userRole !== 'admin') {
            document.getElementById('userList').innerHTML = '<p class="empty-state">Você não tem permissão para visualizar usuários.</p>';
            return;
        }

        const userListDiv = document.getElementById('userList');
        userListDiv.innerHTML = '';

        try {
            const usersCol = collection(db, "users");
            const userSnapshot = await getDocs(usersCol);
            const users = userSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

            if (users.length === 0) {
                userListDiv.innerHTML = '<p class="empty-state">Nenhum usuário cadastrado.</p>';
                return;
            }

            userListDiv.innerHTML = users.map(user => this.createUserHTML(user)).join('');
        } catch (error) {
            console.error("Erro ao carregar usuários:", error);
            userListDiv.innerHTML = '<p class="empty-state">Erro ao carregar usuários.</p>';
        }
    }

    createUserHTML(user) {
        const isAdmin = this.userRole === 'admin';
        const isCurrentUser = this.currentUser && this.currentUser.uid === user.uid;
        const canEdit = isAdmin; // ADM pode editar todos
        const canDelete = isAdmin && !isCurrentUser; // ADM pode deletar todos, exceto ele mesmo

        return `
        <div class="user-item" data-uid="${user.uid}">
            <div class="user-info">
                <h4>${this.escapeHtml(user.email)}</h4>
                <p>UID: ${user.uid}</p>
            </div>
            <div class="user-actions">
                <span class="user-role-badge ${user.role}">${user.role}</span>
                ${canEdit ? `<button type="button" class="btn-edit" onclick="window.inventorySystem.openEditUserModal('${user.uid}')">Editar</button>` : ''}
                ${canDelete ? `<button type="button" class="btn-danger" onclick="window.inventorySystem.confirmDeleteUser('${user.uid}', '${this.escapeHtml(user.email)}')">Excluir</button>` : ''}
            </div>
        </div>`;
    }

    openAddUserModal() {
        if (this.userRole !== 'admin') {
            alert("Você não tem permissão para adicionar usuários.");
            return;
        }
        document.getElementById('userModalTitle').textContent = 'Adicionar Usuário';
        document.getElementById('userForm').reset();
        document.getElementById('userEmail').removeAttribute('disabled'); // Habilitar email para novo usuário
        document.getElementById('userPassword').setAttribute('required', 'true');
        document.getElementById('userPassword').value = ''; // Limpar senha ao adicionar
        document.getElementById('userEmail').removeAttribute('data-uid'); // Limpar UID para garantir que é um novo usuário
        this.showModal('userModal');
    }

    async openEditUserModal(uid) {
        if (this.userRole !== 'admin') {
            alert("Você não tem permissão para editar usuários.");
            return;
        }
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById('userModalTitle').textContent = 'Editar Usuário';
            // document.getElementById('userName').value = userData.email; // Usar email como nome para exibição
            document.getElementById('userEmail').value = userData.email;
            document.getElementById('userEmail').setAttribute('data-uid', uid); // Armazenar UID para edição
            document.getElementById('userEmail').setAttribute('disabled', 'true'); // Não permitir editar email
            document.getElementById('userPassword').removeAttribute('required');
            document.getElementById('userPassword').value = ''; // Senha opcional na edição
            document.getElementById('userRole').value = userData.role;
            this.showModal('userModal');
        } else {
            alert("Usuário não encontrado.");
        }
    }

    async saveUser() {
        const uid = document.getElementById('userEmail').getAttribute('data-uid');
        const email = document.getElementById('userEmail').value.trim();
        const password = document.getElementById('userPassword').value.trim();
        const role = document.getElementById('userRole').value;

        if (!email || !role) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        if (uid) { // Edição de usuário
            // Atualizar papel no Firestore
            await this.saveUserToFirestore(uid, email, role);
            // Se a senha foi fornecida, tentar atualizar no Auth
            if (password) {
                try {
                    // Firebase Authentication não permite atualizar a senha de outro usuário diretamente do cliente.
                    // Isso exigiria uma função de backend (Cloud Function) ou que o próprio usuário reautentique.
                    // Para este exemplo, vamos apenas logar a tentativa.
                    console.warn("Atualização de senha de outro usuário via cliente não é suportada pelo Firebase Auth. Necessita de Cloud Function.");
                    alert("Usuário atualizado com sucesso! A senha, se fornecida, não foi alterada por segurança.");
                } catch (error) {
                    console.error("Erro ao atualizar senha:", error);
                    alert("Erro ao atualizar senha: " + error.message);
                }
            }
             else {
                alert("Usuário atualizado com sucesso!");
            }
        } else { // Adição de novo usuário
            if (!password) {
                alert("Por favor, insira uma senha para o novo usuário.");
                return;
            }
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await this.saveUserToFirestore(userCredential.user.uid, email, role);
                alert("Usuário adicionado com sucesso!");
            } catch (error) {
                console.error("Erro ao adicionar usuário:", error);
                alert("Erro ao adicionar usuário: " + error.message);
            }
        }
        this.closeModal('userModal');
        this.renderUsers();
    }

    confirmDeleteUser(uid, email) {
        if (this.userRole !== 'admin') {
            alert("Você não tem permissão para excluir usuários.");
            return;
        }
        if (this.currentUser && this.currentUser.uid === uid) {
            alert("Você não pode excluir seu próprio usuário.");
            return;
        }
        if (confirm(`Tem certeza que deseja excluir o usuário ${email}?`)) {
            this.deleteUser(uid);
        }
    }

    async deleteUser(uid) {
        try {
            // Para deletar um usuário do Firebase Auth, você precisaria de privilégios de administrador
            // ou que o próprio usuário se reautentique. Isso geralmente é feito via Cloud Functions.
            // Aqui, estamos apenas deletando do Firestore.
            await this.deleteUserFromFirestore(uid);
            alert("Usuário excluído com sucesso!");
            this.renderUsers();
        } catch (error) {
            console.error("Erro ao excluir usuário:", error);
            alert("Erro ao excluir usuário: " + error.message);
        }
    }

    // ===================== General UI Management =====================
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Product Management
        document.getElementById('addItemBtn').addEventListener('click', () => this.openAddProductModal());
        document.getElementById('productForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal('productModal'));
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal('productModal'));
        document.getElementById('searchInput').addEventListener('keyup', () => this.render());
        document.getElementById('clearSearch').addEventListener('click', () => {
            document.getElementById('searchInput').value = '';
            this.render();
        });

        // Delete Confirmation Modal
        document.getElementById('cancelDelete').addEventListener('click', () => this.closeModal('confirmModal'));
        document.getElementById('confirmDelete').addEventListener('click', () => this.executeDeleteProduct());

        // Requisition Management
        document.getElementById('generateRequisitionBtn').addEventListener('click', () => this.openRequisitionModal());
        document.getElementById('requisitionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveRequisition();
        });
        document.getElementById('closeRequisitionModal').addEventListener('click', () => this.closeModal('requisitionModal'));
        document.getElementById('cancelRequisitionBtn').addEventListener('click', () => this.closeModal('requisitionModal'));

        // Product Selection Modal
        document.getElementById('selectProductsBtn').addEventListener('click', () => this.showModal('productSelectionModal'));
        document.getElementById('closeProductSelectionModal').addEventListener('click', () => this.closeModal('productSelectionModal'));
        document.getElementById('cancelProductSelectionBtn').addEventListener('click', () => this.closeModal('productSelectionModal'));
        document.getElementById('confirmProductSelectionBtn').addEventListener('click', () => this.confirmProductSelection());
        document.getElementById('productSearchInput').addEventListener('keyup', () => this.renderAvailableProducts());
        document.getElementById('locationFilter').addEventListener('change', () => this.renderAvailableProducts());

        // Login Page
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            await this.login(email, password);
        });

        // Logout Button
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // User Management Modal
        document.getElementById('userManagementTabBtn').addEventListener('click', () => this.switchTab('userManagement'));
        document.getElementById('addUserBtn').addEventListener('click', () => this.openAddUserModal());
        document.getElementById('userForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUser();
        });
        document.getElementById('closeUserModal').addEventListener('click', () => this.closeModal('userModal'));
        document.getElementById('cancelUserBtn').addEventListener('click', () => this.closeModal('userModal'));
    }

    openAddProductModal() {
        if (this.userRole !== 'admin' && this.userRole !== 'subadm') {
            alert("Você não tem permissão para adicionar produtos.");
            return;
        }
        document.getElementById('modalTitle').textContent = 'Adicionar Produto';
        document.getElementById('productForm').reset();
        document.getElementById('productCode').removeAttribute('disabled');
        this.showModal('productModal');
    }

    openEditProductModal(productId) {
        if (this.userRole !== 'admin' && this.userRole !== 'subadm') {
            alert("Você não tem permissão para editar produtos.");
            return;
        }
        const product = this.products.find(p => p.id === productId);
        if (product) {
            document.getElementById('modalTitle').textContent = 'Editar Produto';
            document.getElementById('productName').value = product.name;
            document.getElementById('productCode').value = product.code;
            document.getElementById('productCode').setAttribute('disabled', 'true'); // Não permitir editar código
            document.getElementById('productQuantity').value = product.quantity;
            document.getElementById('productLocation').value = product.local;
            document.getElementById('productDescription').value = product.description;
            document.getElementById('productForm').setAttribute('data-editing-id', productId);
            this.showModal('productModal');
        }
    }

    saveProduct() {
        const productId = document.getElementById('productForm').getAttribute('data-editing-id');
        const productData = {
            name: document.getElementById('productName').value.trim(),
            code: document.getElementById('productCode').value.trim(),
            quantity: document.getElementById('productQuantity').value.trim(),
            local: document.getElementById('productLocation').value.trim(),
            description: document.getElementById('productDescription').value.trim()
        };

        if (!productData.name || !productData.code || !productData.quantity || !productData.local) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        if (productId) {
            this.editProduct(productId, productData);
            alert("Produto atualizado com sucesso!");
        } else {
            this.addProduct(productData);
            alert("Produto adicionado com sucesso!");
        }
        this.closeModal('productModal');
    }

    confirmDeleteProduct(productId, productName) {
        if (this.userRole !== 'admin' && this.userRole !== 'subadm') {
            alert("Você não tem permissão para excluir produtos.");
            return;
        }
        document.getElementById('deleteProductName').textContent = productName;
        document.getElementById('confirmDelete').setAttribute('data-product-id', productId);
        this.showModal('confirmModal');
    }

    executeDeleteProduct() {
        const productId = document.getElementById('confirmDelete').getAttribute('data-product-id');
        this.deleteProduct(productId);
        this.closeModal('confirmModal');
        alert("Produto excluído com sucesso!");
    }

    showModal(modalId) {
        document.getElementById('modalOverlay').classList.add('active');
        document.getElementById(modalId).classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        // Verifica se há outros modais ativos antes de remover o overlay
        const activeModals = document.querySelectorAll('.modal.active');
        if (activeModals.length === 0) {
            document.getElementById('modalOverlay').classList.remove('active');
        }
        
        // Limpar data-editing-id ao fechar o modal de produto
        if (modalId === 'productModal') {
            document.getElementById('productForm').removeAttribute('data-editing-id');
            document.getElementById('productCode').removeAttribute('disabled');
        }
        // Limpar data-uid ao fechar o modal de usuário
        if (modalId === 'userModal') {
            document.getElementById('userEmail').removeAttribute('data-uid');
            document.getElementById('userEmail').removeAttribute('disabled');
            document.getElementById('userPassword').removeAttribute('required');
        }
    }

    updateStats() {
        document.getElementById('totalItems').textContent = `Total de itens: ${this.products.length}`;
    }

    updateDashboard() {
        // Lógica para atualizar o dashboard (a ser implementada)
        const dashboardSection = document.getElementById('dashboardTab').querySelector('.dashboard-section');
        if (dashboardSection) {
            dashboardSection.innerHTML = `
                <h2>Dashboard de Estoque</h2>
                <p>Total de Produtos: ${this.products.length}</p>
                <p>Total de Requisições: ${this.requisitions.length}</p>
                <p>Requisições Pendentes: ${this.requisitions.filter(req => req.status === 'pending').length}</p>
                <p>Requisições Finalizadas: ${this.requisitions.filter(req => req.status === 'finished').length}</p>
                <!-- Adicione mais métricas aqui -->
            `;
        }
    }

    populateLocationFilter() {
        const locationFilter = document.getElementById('locationFilter');
        const uniqueLocations = [...new Set(this.products.map(p => p.local))];
        locationFilter.innerHTML = '<option value="">Todos os locais</option>';
        uniqueLocations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            locationFilter.appendChild(option);
        });
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

window.inventorySystem = new InventorySystem();

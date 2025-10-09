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
        document.getElementById('userManagementTabBtn').style.display = isAdmin ? 'block' : 'none';
        document.getElementById('addUserBtn').style.display = isAdmin ? 'block' : 'none';

        // Adicionar Item (ADM e SubAdm)
        document.getElementById('addItemBtn').style.display = (isAdmin || isSubAdm) ? 'block' : 'none';

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
            (product.name ?? '').toLowerCase().includes(searchTerm) ||
            (product.code ?? '').toLowerCase().includes(searchTerm) ||
            (product.local ?? '').toLowerCase().includes(searchTerm)
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
        const quantity = product.quantity ?? 0;
        const quantityClass = quantity < 100 ? 'quantity-low' : quantity < 500 ? 'quantity-medium' : 'quantity-high';
        
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
                    <div class="product-detail-value"><span class="quantity-badge ${quantityClass}">${quantity}</span></div>
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
    openRequisitionModal() {
        this.selectedProductsForRequisition = [];
        const productSelectionList = document.getElementById('productSelectionList');
        productSelectionList.innerHTML = this.products.map(product => `
            <div class="product-selection-item">
                <input type="checkbox" id="product-${product.id}" name="product" value="${product.id}">
                <label for="product-${product.id}">${this.escapeHtml(product.name)} (Estoque: ${product.quantity})</label>
            </div>
        `).join('');
        document.getElementById('requisitionModal').style.display = 'block';
    }

    closeRequisitionModal() {
        document.getElementById('requisitionModal').style.display = 'none';
    }

    async generateRequisition(event) {
        event.preventDefault();
        const form = event.target;
        const description = form.requisitionDescription.value;
        const estimatedQuantity = form.estimatedQuantity.value;
        const selectedProducts = Array.from(form.querySelectorAll('input[name="product"]:checked')).map(input => input.value);

        if (selectedProducts.length === 0) {
            alert("Por favor, selecione pelo menos um produto.");
            return;
        }

        const requisition = {
            id: `REQ-${Date.now()}`,
            requester: this.currentUser.email,
            date: new Date().toLocaleDateString("pt-BR"),
            products: selectedProducts.map(productId => {
                const product = this.products.find(p => p.id === productId);
                return {
                    id: product.id,
                    name: product.name,
                    code: product.code,
                    quantity: estimatedQuantity ? parseInt(estimatedQuantity, 10) : 0 // Usar quantidade estimada se fornecida
                };
            }),
            status: 'Pendente', // Pendente, Finalizado
            description: description,
            totalItems: selectedProducts.length,
            finalizedQuantity: 0
        };

        await this.saveRequisitionToFirestore(requisition);
        this.requisitions.push(requisition);
        this.renderRequisitions();
        this.closeRequisitionModal();
        alert("Requisição gerada com sucesso!");
    }

    renderRequisitions() {
        const requisitionsList = document.getElementById("requisitionsList");
        const emptyRequisitionState = document.getElementById("emptyRequisitionState");

        if (this.requisitions.length === 0) {
            emptyRequisitionState.style.display = "block";
            requisitionsList.innerHTML = "";
        } else {
            emptyRequisitionState.style.display = "none";
            requisitionsList.innerHTML = this.requisitions.map(requisition => this.createRequisitionHTML(requisition)).join('');
        }
    }

    createRequisitionHTML(requisition) {
        const isAdmOrSubAdm = this.userRole === 'admin' || this.userRole === 'subadm';
        const statusClass = requisition.status === 'Pendente' ? 'status-pending' : 'status-finalized';

        return `
        <div class="requisition-item" data-id="${requisition.id}">
            <div class="requisition-header">
                <div class="requisition-info">
                    <h3>Requisição #${requisition.id}</h3>
                    <span class="requisition-date">Data: ${requisition.date}</span>
                </div>
                <div class="requisition-status ${statusClass}">${requisition.status}</div>
            </div>
            <div class="requisition-details">
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Solicitante</div>
                    <div class="requisition-detail-value">${this.escapeHtml(requisition.requester)}</div>
                </div>
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Total de Itens</div>
                    <div class="requisition-detail-value">${requisition.totalItems}</div>
                </div>
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Quantidade Finalizada</div>
                    <div class="requisition-detail-value">${requisition.finalizedQuantity}</div>
                </div>
            </div>
            <div class="requisition-products">
                <h4>Produtos Requisitados:</h4>
                <ul>
                    ${requisition.products.map(product => `<li>${this.escapeHtml(product.name)} - Solicitado: ${product.quantity}</li>`).join('')}
                </ul>
            </div>
            ${isAdmOrSubAdm && requisition.status === 'Pendente' ? `
            <div class="requisition-actions">
                <input type="number" id="finalizedQuantity-${requisition.id}" placeholder="Qtd. Real Finalizada" min="0">
                <button type="button" class="btn-primary" onclick="window.inventorySystem.finalizeRequisition('${requisition.id}')">Finalizar Requisição</button>
            </div>
            ` : ''}
        </div>`;
    }

    async finalizeRequisition(requisitionId) {
        const finalizedQuantityInput = document.getElementById(`finalizedQuantity-${requisitionId}`);
        const finalizedQuantity = parseInt(finalizedQuantityInput.value, 10);

        if (isNaN(finalizedQuantity) || finalizedQuantity < 0) {
            alert("Por favor, insira uma quantidade finalizada válida.");
            return;
        }

        const requisitionIndex = this.requisitions.findIndex(r => r.id === requisitionId);
        if (requisitionIndex !== -1) {
            const requisition = this.requisitions[requisitionIndex];
            requisition.status = 'Finalizado';
            requisition.finalizedQuantity = finalizedQuantity;

            // Atualizar estoque
            for (const reqProduct of requisition.products) {
                const productIndex = this.products.findIndex(p => p.id === reqProduct.id);
                if (productIndex !== -1) {
                    const product = this.products[productIndex];
                    const newQuantity = product.quantity - finalizedQuantity; // Subtrai a quantidade finalizada
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
        // Adicionar lógica para deletar usuário do Firebase Auth (requer ambiente de admin)
        // Por enquanto, vamos apenas deletar do Firestore
        await this.deleteUserFromFirestore(uid);
        alert("Usuário deletado com sucesso!");
        this.renderUsers();
    }

    async renderUsers() {
        const usersList = document.getElementById("usersList");
        try {
            const usersCol = collection(db, "users");
            const userSnapshot = await getDocs(usersCol);
            const users = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            usersList.innerHTML = users.map(user => this.createUserHTML(user)).join('');
        } catch (error) {
            console.error("Erro ao renderizar usuários:", error);
        }
    }

    createUserHTML(user) {
        return `
        <div class="user-item">
            <span>${this.escapeHtml(user.email)}</span>
            <span>${this.escapeHtml(user.role)}</span>
            <button type="button" class="btn-danger" onclick="window.inventorySystem.deleteUser('${user.id}')">Excluir</button>
        </div>`;
    }

    // ===================== UI and Utilities =====================
    setupEventListeners() {
        // Login
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = e.target.email.value;
            const password = e.target.password.value;
            this.login(email, password);
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Tabs
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.dataset.tab);
            });
        });

        // Modals
        document.getElementById('addItemBtn').addEventListener('click', () => this.openAddProductModal());
        document.getElementById('generateRequisitionBtn').addEventListener('click', () => this.openRequisitionModal());
        document.getElementById('addUserBtn').addEventListener('click', () => this.openAddUserModal());

        document.getElementById('productModal').querySelector('.close').addEventListener('click', () => this.closeProductModal());
        document.getElementById('requisitionModal').querySelector('.close').addEventListener('click', () => this.closeRequisitionModal());
        document.getElementById('userModal').querySelector('.close').addEventListener('click', () => this.closeUserModal());

        // Forms
        document.getElementById('productForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const productId = e.target.productId.value;
            const productData = {
                name: e.target.productName.value,
                code: e.target.productCode.value,
                quantity: e.target.productQuantity.value,
                local: e.target.productLocal.value,
                description: e.target.productDescription.value
            };
            if (productId) {
                this.editProduct(productId, productData);
            } else {
                this.addProduct(productData);
            }
            this.closeProductModal();
        });

        document.getElementById('requisitionForm').addEventListener('submit', (e) => this.generateRequisition(e));

        document.getElementById('userForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = e.target.userEmail.value;
            const password = e.target.userPassword.value;
            const role = e.target.userRole.value;
            this.addUser(email, password, role);
            this.closeUserModal();
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', () => this.render());
    }

    openAddProductModal() {
        document.getElementById('productForm').reset();
        document.getElementById('productId').value = '';
        document.getElementById('productModalTitle').textContent = 'Adicionar Novo Produto';
        document.getElementById('productModal').style.display = 'block';
    }

    openEditProductModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            document.getElementById('productId').value = product.id;
            document.getElementById('productName').value = product.name;
            document.getElementById('productCode').value = product.code;
            document.getElementById('productQuantity').value = product.quantity;
            document.getElementById('productLocal').value = product.local;
            document.getElementById('productDescription').value = product.description;
            document.getElementById('productModalTitle').textContent = 'Editar Produto';
            document.getElementById('productModal').style.display = 'block';
        }
    }

    closeProductModal() {
        document.getElementById('productModal').style.display = 'none';
    }

    openAddUserModal() {
        document.getElementById('userForm').reset();
        document.getElementById('userModal').style.display = 'block';
    }

    closeUserModal() {
        document.getElementById('userModal').style.display = 'none';
    }

    confirmDeleteProduct(productId, productName) {
        if (confirm(`Tem certeza que deseja excluir o produto "${productName}"?`)) {
            this.deleteProduct(productId);
        }
    }

    updateStats() {
        const totalProducts = this.products.length;
        const totalStock = this.products.reduce((sum, p) => sum + (p.quantity || 0), 0);
        const totalRequisitions = this.requisitions.length;

        document.getElementById('totalProductsStat').textContent = totalProducts;
        document.getElementById('totalStockStat').textContent = totalStock;
        document.getElementById('totalRequisitionsStat').textContent = totalRequisitions;
    }

    updateDashboard() {
        // Lógica para atualizar o dashboard com gráficos e informações relevantes
    }

    populateLocationFilter() {
        const locationFilter = document.getElementById('locationFilter');
        const locations = [...new Set(this.products.map(p => p.local))];
        locationFilter.innerHTML = '<option value="">Todos os Locais</option>';
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            locationFilter.appendChild(option);
        });
    }

    escapeHtml(text) {
        if (text === null || text === undefined) {
            return '';
        }
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.inventorySystem = new InventorySystem();
});


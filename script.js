// Anti-debugging protection
(function() {
    var debug = false;
    
    // Detectar console aberto
    var element = new Image();
    Object.defineProperty(element, 'id', {
        get: function() {
            debug = true;
            console.log('Debugging detected!');
            window.location.href = '/error.html';
        }
    });
    
    console.log('%c', element);
    
    // Prevenir F12
    document.onkeydown = function(e) {
        if (e.keyCode == 123) { // F12
            return false;
        }
        if (e.ctrlKey && e.shiftKey && e.keyCode == 73) { // Ctrl+Shift+I
            return false;
        }
        if (e.ctrlKey && e.keyCode == 85) { // Ctrl+U
            return false;
        }
    };
    
    // Prevenir clique direito
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });
})();

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

    // ===================== Utilitários de Formatação =====================
    formatNumber(number, decimalPlaces = 0) {
        if (number === null || number === undefined) return '0';
        
        // Arredonda para no máximo 3 casas decimais
        const rounded = Number(number).toFixed(decimalPlaces);
        
        // Formata com separador de milhares
        return Number(rounded).toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimalPlaces
        });
    }

    formatDateTime(date) {
        if (!date) return '';
        
        const d = new Date(date);
        // Formata como: 10/10/2025 - 08:46
        return d.toLocaleDateString('pt-BR') + ' - ' + 
               d.toLocaleTimeString('pt-BR', { 
                   hour: '2-digit', 
                   minute: '2-digit',
                   hour12: false 
               });
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
            // Limpar objeto antes de salvar
            const cleanRequisition = JSON.parse(JSON.stringify(requisition));
            
            // Remover campos undefined/null
            Object.keys(cleanRequisition).forEach(key => {
                if (cleanRequisition[key] === undefined || cleanRequisition[key] === null) {
                    delete cleanRequisition[key];
                }
            });
            
            // Limpar produtos também
            if (cleanRequisition.products) {
                cleanRequisition.products = cleanRequisition.products.map(product => {
                    const cleanProduct = { ...product };
                    Object.keys(cleanProduct).forEach(key => {
                        if (cleanProduct[key] === undefined || cleanProduct[key] === null) {
                            delete cleanProduct[key];
                        }
                    });
                    return cleanProduct;
                });
            }

            await setDoc(doc(db, "requisitions", cleanRequisition.id), cleanRequisition);
            console.log("Requisição salva no Firestore:", cleanRequisition.id);
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
            id: productData.code,
            name: productData.name,
            code: productData.code,
            quantity: parseFloat(productData.quantity),
            local: productData.local,
            description: productData.description || '',
            expiry: productData.expiry || '',
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
                expiry: productData.expiry || '',
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

    getExpiryStatus(expiryDate) {
        if (!expiryDate) return { status: 'sem-data', label: 'Sem data', class: 'expiry-sem-data' };
        
        const today = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            return { status: 'vencido', label: 'Vencido', class: 'expiry-vencido' };
        } else if (diffDays <= 90) { // 3 meses = ~90 dias
            return { status: 'atencao', label: 'Atenção', class: 'expiry-atencao' };
        } else {
            return { status: 'conforme', label: 'Conforme', class: 'expiry-conforme' };
        }
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
        const expiryStatus = this.getExpiryStatus(product.expiry);
        
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
                    <div class="product-detail-value"><span class="quantity-badge ${quantityClass}">${this.formatNumber(quantity)}</span></div>
                </div>
                <div class="product-detail">
                    <div class="product-detail-label">Setor</div>
                    <div class="product-detail-value">${this.escapeHtml(product.local ?? '')}</div>
                </div>
                <div class="product-detail">
                    <div class="product-detail-label">Validade</div>
                    <div class="product-detail-value">
                        ${product.expiry ? `
                            <span class="expiry-status ${expiryStatus.class}">
                                ${expiryStatus.label}
                            </span>
                            <br>
                            <small>${new Date(product.expiry).toLocaleDateString('pt-BR')}</small>
                        ` : '<span class="text-muted">Não informado</span>'}
                    </div>
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
            totalItems.textContent = `Total de itens: ${this.formatNumber(this.products.length)}`;
        }
    }

    updateDashboard() {
        const dashboardSection = document.querySelector('#dashboardTab .dashboard-section');
        if (dashboardSection && this.products.length > 0) {
            const totalProducts = this.products.length;
            const totalQuantity = this.products.reduce((sum, product) => sum + (product.quantity || 0), 0);
            const lowStockProducts = this.products.filter(product => (product.quantity || 0) < 100).length;
            const locations = [...new Set(this.products.map(p => p.local).filter(Boolean))];
            const totalRequisitions = this.requisitions.length;
            const pendingRequisitions = this.requisitions.filter(r => r.status === 'Pendente').length;
            
            // Análise de validade dos produtos
            const expiryAnalysis = {
                conforme: 0,
                atencao: 0,
                vencido: 0,
                semData: 0
            };
            
            this.products.forEach(product => {
                const status = this.getExpiryStatus(product.expiry);
                switch (status.status) {
                    case 'conforme': expiryAnalysis.conforme++; break;
                    case 'atencao': expiryAnalysis.atencao++; break;
                    case 'vencido': expiryAnalysis.vencido++; break;
                    default: expiryAnalysis.semData++; break;
                }
            });
            
            // Produtos por setor
            const productsByLocation = {};
            this.products.forEach(product => {
                const location = product.local || 'Sem setor';
                productsByLocation[location] = (productsByLocation[location] || 0) + 1;
            });
            
            dashboardSection.innerHTML = `
                <h2>Dashboard de Estoque</h2>
                <div class="dashboard-stats">
                    <div class="stat-card">
                        <div class="stat-icon">📦</div>
                        <div class="stat-info">
                            <div class="stat-value">${this.formatNumber(totalProducts)}</div>
                            <div class="stat-label">Total de Produtos</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📊</div>
                        <div class="stat-info">
                            <div class="stat-value">${this.formatNumber(totalQuantity)}</div>
                            <div class="stat-label">Quantidade Total</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">⚠️</div>
                        <div class="stat-info">
                            <div class="stat-value">${this.formatNumber(lowStockProducts)}</div>
                            <div class="stat-label">Estoque Baixo</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📍</div>
                        <div class="stat-info">
                            <div class="stat-value">${this.formatNumber(locations.length)}</div>
                            <div class="stat-label">Setores Diferentes</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📋</div>
                        <div class="stat-info">
                            <div class="stat-value">${this.formatNumber(totalRequisitions)}</div>
                            <div class="stat-label">Total Requisições</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">⏳</div>
                        <div class="stat-info">
                            <div class="stat-value">${this.formatNumber(pendingRequisitions)}</div>
                            <div class="stat-label">Requisições Pendentes</div>
                        </div>
                    </div>
                </div>
                
                <div class="dashboard-charts">
                    <div class="chart-container">
                        <h3>Status de Validade dos Produtos</h3>
                        <div class="expiry-status-chart">
                            <div class="expiry-status-item conforme">
                                <div class="expiry-status-icon">✅</div>
                                <div class="expiry-status-info">
                                    <div class="expiry-status-count">${this.formatNumber(expiryAnalysis.conforme)}</div>
                                    <div class="expiry-status-label">Conforme</div>
                                    <div class="expiry-status-desc">Mais de 3 meses</div>
                                </div>
                            </div>
                            <div class="expiry-status-item atencao">
                                <div class="expiry-status-icon">⚠️</div>
                                <div class="expiry-status-info">
                                    <div class="expiry-status-count">${this.formatNumber(expiryAnalysis.atencao)}</div>
                                    <div class="expiry-status-label">Atenção</div>
                                    <div class="expiry-status-desc">Menos de 3 meses</div>
                                </div>
                            </div>
                            <div class="expiry-status-item vencido">
                                <div class="expiry-status-icon">❌</div>
                                <div class="expiry-status-info">
                                    <div class="expiry-status-count">${this.formatNumber(expiryAnalysis.vencido)}</div>
                                    <div class="expiry-status-label">Vencido</div>
                                    <div class="expiry-status-desc">Data expirada</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="chart-container">
                        <h3>Produtos por Setor</h3>
                        <div class="location-chart">
                            ${Object.entries(productsByLocation).map(([location, count]) => `
                                <div class="location-bar">
                                    <div class="location-name">${this.escapeHtml(location)}</div>
                                    <div class="location-progress">
                                        <div class="location-progress-bar" style="width: ${(count / totalProducts) * 100}%"></div>
                                    </div>
                                    <div class="location-count">${this.formatNumber(count)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="chart-container">
                        <h3>Produtos com Estoque Baixo</h3>
                        <div class="low-stock-list">
                            ${this.products.filter(p => (p.quantity || 0) < 100).slice(0, 5).map(product => `
                                <div class="low-stock-item">
                                    <div class="product-name">${this.escapeHtml(product.name || '')}</div>
                                    <div class="product-quantity quantity-low">${this.formatNumber(product.quantity || 0)}</div>
                                </div>
                            `).join('') || '<p>Nenhum produto com estoque baixo</p>'}
                        </div>
                    </div>
                </div>
            `;
        } else if (dashboardSection) {
            dashboardSection.innerHTML = `
                <h2>Dashboard de Estoque</h2>
                <div class="empty-dashboard">
                    <p>Nenhum dado disponível para exibir.</p>
                    <p>Adicione produtos ao estoque para ver as estatísticas.</p>
                </div>
            `;
        }
        console.log("Dashboard atualizado com dados");
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
        
        if (this.selectedProductsForRequisition.length === 0) {
            alert('Selecione pelo menos um produto para a requisição.');
            return;
        }

        // Valida se todas as quantidades foram preenchidas
        for (const product of this.selectedProductsForRequisition) {
            if (!product.requestedQuantity || product.requestedQuantity <= 0) {
                alert(`Por favor, informe a quantidade para o produto: ${product.name}`);
                return;
            }
            
            // Valida se a quantidade requisitada não excede o estoque
            if (product.requestedQuantity > product.availableQuantity) {
                alert(`Quantidade requisitada (${this.formatNumber(product.requestedQuantity)}) excede o estoque disponível (${this.formatNumber(product.availableQuantity)}) para o produto: ${product.name}`);
                return;
            }
        }

        const totalRequested = this.selectedProductsForRequisition.reduce((sum, product) => 
            sum + (product.requestedQuantity || 0), 0);

        const requisition = {
            id: Date.now().toString(),
            products: this.selectedProductsForRequisition.map(product => ({
                id: product.id,
                name: product.name || '',
                code: product.code || '',
                setor: product.local || '',
                requestedQuantity: product.requestedQuantity || 1,
                availableQuantity: product.availableQuantity || 0,
                expiry: product.expiry || null
            })),
            totalRequested: totalRequested,
            status: 'Pendente',
            createdAt: new Date().toISOString(),
            createdBy: this.currentUser?.email || 'Sistema',
            // Garantir que todos os campos opcionais tenham valores padrão
            description: document.getElementById('requisitionDescription')?.value || '',
            local: document.getElementById('requisitionLocal')?.value || ''
        };

        // Remover campos undefined explicitamente
        Object.keys(requisition).forEach(key => {
            if (requisition[key] === undefined) {
                delete requisition[key];
            }
        });

        this.requisitions.push(requisition);
        await this.saveRequisitionToFirestore(requisition);
        this.renderRequisitions();
        this.updateDashboard();

        // Limpar seleção
        this.selectedProductsForRequisition = [];
        this.updateSelectedProductsDisplay();
        this.closeRequisitionModal();

        alert(`Requisição gerada com sucesso! Total requisitado: ${this.formatNumber(totalRequested)} itens.`);
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
                    <h3>Requisição #${requisition.id}</h3>
                    <span class="requisition-status status-${requisition.status.toLowerCase().replace('ê', 'e')}">
                        ${requisition.status}
                    </span>
                </div>
                <div class="requisition-meta">
                    <span class="requisition-date">${this.formatDateTime(requisition.createdAt)}</span>
                    <span class="requisition-user">por ${this.escapeHtml(requisition.createdBy)}</span>
                </div>
            </div>
            <div class="requisition-details">
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Total Requisitado</div>
                    <div class="requisition-detail-value"><strong>${this.formatNumber(requisition.totalRequested ?? 0)} itens</strong></div>
                </div>
                <div class="requisition-detail">
                    <div class="requisition-detail-label">Data</div>
                    <div class="requisition-detail-value">${this.formatDateTime(requisition.createdAt)}</div>
                </div>
            </div>
            <div class="requisition-products">
                <h4>Produtos Requisitados (${requisition.products?.length ?? 0})</h4>
                <ul class="requisition-products-list">
                    ${(requisition.products ?? []).map(product => {
                        const expiryStatus = this.getExpiryStatus(product.expiry);
                        return `
                            <li class="requisition-product-item">
                                <div class="requisition-product-info">
                                    <span class="requisition-product-name">${this.escapeHtml(product.name ?? '')}</span>
                                    <div class="requisition-product-details">
                                        <span>Código: ${this.escapeHtml(product.code ?? '')}</span>
                                        <span>Setor: ${this.escapeHtml(product.setor ?? '')}</span>
                                        <span>Requisitado: <strong>${this.formatNumber(product.requestedQuantity)}</strong></span>
                                        <span>Disponível: ${this.formatNumber(product.availableQuantity)}</span>
                                        ${product.expiry ? `
                                            <span class="expiry-status ${expiryStatus.class}">
                                                ${expiryStatus.label}
                                            </span>
                                        ` : ''}
                                    </div>
                                </div>
                                ${isAdmOrSubAdm && isPending ? `
                                    <div class="supply-quantity-section">
                                        <div class="supply-quantity-input">
                                            <input type="number" class="finalized-qty-input" data-product-id="${product.id}" placeholder="Qtd real" min="0">
                                        </div>
                                    </div>
                                ` : ''}
                                ${requisition.finalizedQuantitiesPerItem && requisition.finalizedQuantitiesPerItem[product.id] !== undefined ? `
                                    <span class="supply-quantity-value">Fornecido: ${this.formatNumber(requisition.finalizedQuantitiesPerItem[product.id])}</span>
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
                local: p.setor,
                availableQuantity: p.availableQuantity,
                requestedQuantity: p.requestedQuantity,
                expiry: p.expiry
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
                setor: p.local,
                requestedQuantity: p.requestedQuantity,
                availableQuantity: p.availableQuantity,
                expiry: p.expiry
            }));
            existingRequisition.totalRequested = this.selectedProductsForRequisition.reduce((sum, p) => sum + (p.requestedQuantity || 0), 0);

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
        const locationFilter = document.getElementById('locationFilter');
        
        if (availableProductsList) {
            // Atualizar o filtro de locais
            this.updateLocationFilterInModal();
            
            // Filtrar produtos baseado no local selecionado
            const selectedLocation = locationFilter ? locationFilter.value : '';
            const filteredProducts = selectedLocation ? 
                this.products.filter(product => product.local === selectedLocation) : 
                this.products;
            
            availableProductsList.innerHTML = filteredProducts.map(product => {
                const expiryStatus = this.getExpiryStatus(product.expiry);
                const isSelected = this.selectedProductsForRequisition.some(p => p.id === product.id);
                
                return `
                <div class="available-product-item ${isSelected ? 'selected' : ''}" data-product-id="${product.id}" data-location="${this.escapeHtml(product.local ?? '')}">
                    <div class="available-product-info">
                        <div class="available-product-name">${this.escapeHtml(product.name ?? '')}</div>
                        <div class="available-product-details">
                            <div>Código: ${this.escapeHtml(product.code ?? '')}</div>
                            <div>Setor: ${this.escapeHtml(product.local ?? '')}</div>
                            <div>Estoque: <strong>${this.formatNumber(product.quantity ?? 0)}</strong></div>
                            <div>Validade: 
                                ${product.expiry ? `
                                    <span class="expiry-status ${expiryStatus.class}">
                                        ${expiryStatus.label}
                                    </span>
                                    <small>(${new Date(product.expiry).toLocaleDateString('pt-BR')})</small>
                                ` : '<span class="text-muted">Não informado</span>'}
                            </div>
                        </div>
                    </div>
                    <div class="product-selection-controls">
                        <div class="quantity-input-section">
                            <label>Quantidade:</label>
                            <input type="number" 
                                   class="request-quantity-input" 
                                   data-product-id="${product.id}"
                                   min="1" 
                                   max="${product.quantity}"
                                   value="${isSelected ? this.selectedProductsForRequisition.find(p => p.id === product.id)?.requestedQuantity || 1 : 1}"
                                   ${isSelected ? '' : 'disabled'}>
                            <small class="stock-info">Estoque: ${this.formatNumber(product.quantity)}</small>
                        </div>
                        <input type="checkbox" 
                               class="product-checkbox" 
                               value="${product.id}" 
                               ${isSelected ? 'checked' : ''}>
                    </div>
                </div>
            `;
            }).join('');

            // Adicionar event listeners para os checkboxes
            availableProductsList.querySelectorAll('.product-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const productId = e.target.value;
                    const productItem = e.target.closest('.available-product-item');
                    const quantityInput = productItem.querySelector('.request-quantity-input');
                    
                    if (e.target.checked) {
                        productItem.classList.add('selected');
                        quantityInput.disabled = false;
                        quantityInput.focus();
                    } else {
                        productItem.classList.remove('selected');
                        quantityInput.disabled = true;
                    }
                });
            });

            // Adicionar event listeners para os inputs de quantidade
            availableProductsList.querySelectorAll('.request-quantity-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const productId = e.target.dataset.productId;
                    const quantity = parseInt(e.target.value);
                    const maxQuantity = parseInt(e.target.max);
                    
                    if (quantity > maxQuantity) {
                        alert(`Quantidade não pode exceder o estoque disponível: ${this.formatNumber(maxQuantity)}`);
                        e.target.value = maxQuantity;
                    }
                });
            });
        }
    }

    updateLocationFilterInModal() {
        const locationFilter = document.getElementById('locationFilter');
        if (locationFilter) {
            const locations = [...new Set(this.products.map(p => p.local).filter(Boolean))];
            const currentValue = locationFilter.value;
            
            locationFilter.innerHTML = '<option value="">Todos os setores</option>' +
                locations.map(location => `<option value="${this.escapeHtml(location)}" ${currentValue === location ? 'selected' : ''}>${this.escapeHtml(location)}</option>`).join('');
            
            // Remover event listeners anteriores e adicionar novo
            const newLocationFilter = locationFilter.cloneNode(true);
            locationFilter.parentNode.replaceChild(newLocationFilter, locationFilter);
            
            newLocationFilter.addEventListener('change', () => {
                this.populateAvailableProducts();
            });
        }
    }

    confirmProductSelection() {
        const selectedCheckboxes = document.querySelectorAll('#availableProductsList .product-checkbox:checked');
        this.selectedProductsForRequisition = [];
        
        selectedCheckboxes.forEach(checkbox => {
            const productId = checkbox.value;
            const productItem = checkbox.closest('.available-product-item');
            const quantityInput = productItem.querySelector('.request-quantity-input');
            const product = this.products.find(p => p.id === productId);
            
            if (product && quantityInput) {
                const requestedQuantity = parseInt(quantityInput.value) || 1;
                
                this.selectedProductsForRequisition.push({
                    id: product.id,
                    name: product.name,
                    code: product.code,
                    local: product.local,
                    availableQuantity: product.quantity,
                    requestedQuantity: requestedQuantity,
                    expiry: product.expiry
                });
            }
        });

        this.updateSelectedProductsDisplay();
        this.closeProductSelectionModal();
    }

    updateSelectedProductsDisplay() {
        const selectedProductsDiv = document.getElementById("selectedProducts");
        if (selectedProductsDiv) {
            if (this.selectedProductsForRequisition.length === 0) {
                selectedProductsDiv.innerHTML = "<p>Nenhum produto selecionado</p>";
            } else {
                selectedProductsDiv.innerHTML = this.selectedProductsForRequisition.map(item => {
                    const expiryStatus = this.getExpiryStatus(item.expiry);
                    return `
                        <div class="selected-product-item-detailed">
                            <div class="selected-product-info-detailed">
                                <div class="selected-product-name-detailed">${this.escapeHtml(item.name)}</div>
                                <div class="selected-product-details">
                                    <div>Código: ${this.escapeHtml(item.code)}</div>
                                    <div>Setor: ${this.escapeHtml(item.local)}</div>
                                    <div>Estoque: <strong>${this.formatNumber(item.availableQuantity)}</strong></div>
                                    <div>Validade: 
                                        ${item.expiry ? `
                                            <span class="expiry-status ${expiryStatus.class}">
                                                ${expiryStatus.label}
                                            </span>
                                            <small>(${new Date(item.expiry).toLocaleDateString('pt-BR')})</small>
                                        ` : '<span class="text-muted">Não informado</span>'}
                                    </div>
                                </div>
                            </div>
                            <div class="selected-product-quantity-detailed">
                                <div class="quantity-label">Quantidade a Requisitar</div>
                                <input type="number" 
                                       class="quantity-input-detailed" 
                                       value="${item.requestedQuantity || 1}" 
                                       min="1" 
                                       max="${item.availableQuantity}"
                                       data-product-id="${item.id}">
                                <small class="stock-info">Máx: ${this.formatNumber(item.availableQuantity)}</small>
                            </div>
                            <button type="button" class="remove-product-btn-detailed" onclick="window.inventorySystem.removeSelectedProduct('${item.id}')">Remover</button>
                        </div>
                    `;
                }).join('');

                // Adicionar event listeners para os inputs de quantidade
                selectedProductsDiv.querySelectorAll('.quantity-input-detailed').forEach(input => {
                    input.addEventListener('change', (e) => {
                        const productId = e.target.dataset.productId;
                        const quantity = parseInt(e.target.value);
                        const maxQuantity = parseInt(e.target.max);
                        
                        if (quantity > maxQuantity) {
                            alert(`Quantidade não pode exceder o estoque disponível: ${this.formatNumber(maxQuantity)}`);
                            e.target.value = maxQuantity;
                            this.updateProductQuantity(productId, maxQuantity);
                        } else {
                            this.updateProductQuantity(productId, quantity);
                        }
                    });
                });
            }
        }
    }

    // Método auxiliar para atualizar quantidade
    updateProductQuantity(productId, quantity) {
        const productIndex = this.selectedProductsForRequisition.findIndex(p => p.id === productId);
        if (productIndex !== -1) {
            this.selectedProductsForRequisition[productIndex].requestedQuantity = quantity;
        }
    }

    removeSelectedProduct(productId) {
        this.selectedProductsForRequisition = this.selectedProductsForRequisition.filter(p => p.id !== productId);
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
                    description: e.target.productDescription.value,
                    expiry: e.target.productExpiry ? e.target.productExpiry.value : '' // CAPTURAR VALIDADE
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

        // Filter by Location (apenas para a página principal)
        const mainLocationFilter = document.querySelector('#productsTab #locationFilter');
        if (mainLocationFilter) mainLocationFilter.addEventListener('change', () => this.render());

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
        const locationFilter = document.getElementById('locationFilter');
        const selectedLocation = locationFilter ? locationFilter.value : '';
        const term = searchTerm.toLowerCase();
        
        availableProductItems.forEach(item => {
            const name = item.querySelector('.available-product-name').textContent.toLowerCase();
            const details = item.querySelector('.available-product-details').textContent.toLowerCase();
            const location = item.dataset.location || '';
            
            // Verificar se o item corresponde ao filtro de busca
            const matchesSearch = name.includes(term) || details.includes(term);
            
            // Verificar se o item corresponde ao filtro de local
            const matchesLocation = !selectedLocation || location === selectedLocation;
            
            if (matchesSearch && matchesLocation) {
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
            
            // PREENCHER CAMPO DE VALIDADE
            const productExpiryInput = document.getElementById('productExpiry');
            if (productExpiryInput && product.expiry) {
                // Formatar a data para o input type="date" (YYYY-MM-DD)
                const expiryDate = new Date(product.expiry);
                productExpiryInput.value = expiryDate.toISOString().split('T')[0];
            }
            
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
        const requisitionModal = document.getElementById("requisitionModal");
        const modalOverlay = document.getElementById("modalOverlay");
        
        if (requisitionModal) requisitionModal.classList.remove("active");
        if (modalOverlay) modalOverlay.classList.remove("active");
        
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

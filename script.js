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
        this.userRole = 'guest';
        this.currentLotes = []; // Array para armazenar lotes temporários
        this.editingLoteIndex = -1; // Índice do lote sendo editado
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.setupAuthListener();
    }

    // ===================== Utilitários de Formatação =====================
    formatNumber(number, decimalPlaces = 0) {
        if (number === null || number === undefined) return '0';
        
        const rounded = Number(number).toFixed(decimalPlaces);
        
        return Number(rounded).toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimalPlaces
        });
    }

    formatDateTime(date) {
        if (!date) return '';
        
        const d = new Date(date);
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
                    const userDocRef = doc(db, "users", user.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        this.userRole = userDoc.data().role;
                    } else {
                        this.userRole = 'normal';
                        await setDoc(userDocRef, { email: user.email, role: this.userRole });
                    }
                    console.log("Usuário logado:", user.email, "Papel:", this.userRole);
                    document.getElementById("loginPage").style.display = "none";
                    document.getElementById("mainApp").style.display = "block";
                    await this.loadFromFirestore();
                    await this.loadRequisitionsFromFirestore();
                } else {
                    this.userRole = 'guest';
                    console.log("Usuário deslogado.");
                    document.getElementById("loginPage").style.display = "flex";
                    document.getElementById("mainApp").style.display = "none";
                    this.products = [];
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

        const userManagementTabBtn = document.getElementById('userManagementTabBtn');
        if (userManagementTabBtn) userManagementTabBtn.style.display = isAdmin ? 'block' : 'none';
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) addUserBtn.style.display = isAdmin ? 'block' : 'none';

        const addItemBtn = document.getElementById('addItemBtn');
        if (addItemBtn) addItemBtn.style.display = (isAdmin || isSubAdm) ? 'block' : 'none';

        const generateRequisitionBtn = document.getElementById('generateRequisitionBtn');
        if (generateRequisitionBtn) generateRequisitionBtn.style.display = (isAdmin || isSubAdm || isNormalUser) ? 'block' : 'none';

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
            const cleanRequisition = JSON.parse(JSON.stringify(requisition));
            
            Object.keys(cleanRequisition).forEach(key => {
                if (cleanRequisition[key] === undefined || cleanRequisition[key] === null) {
                    delete cleanRequisition[key];
                }
            });
            
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

    // ===================== Gerenciamento de Lotes =====================
    openAddLoteModal() {
        const loteForm = document.getElementById('loteForm');
        if (loteForm) loteForm.reset();
        
        const loteIndex = document.getElementById('loteIndex');
        if (loteIndex) loteIndex.value = '';
        
        const loteModalTitle = document.getElementById('loteModalTitle');
        if (loteModalTitle) loteModalTitle.textContent = 'Adicionar Lote';
        
        this.editingLoteIndex = -1;
        
        const loteModal = document.getElementById('loteModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (loteModal && modalOverlay) {
            loteModal.classList.add('active');
            modalOverlay.classList.add('active');
        }
    }

    openEditLoteModal(index) {
        const lote = this.currentLotes[index];
        if (lote) {
            const loteIndex = document.getElementById('loteIndex');
            if (loteIndex) loteIndex.value = index;
            
            const loteNumber = document.getElementById('loteNumber');
            if (loteNumber) loteNumber.value = lote.number || '';
            
            const loteQuantity = document.getElementById('loteQuantity');
            if (loteQuantity) loteQuantity.value = lote.quantity || 0;
            
            const loteExpiry = document.getElementById('loteExpiry');
            if (loteExpiry && lote.expiry) {
                const expiryDate = new Date(lote.expiry);
                loteExpiry.value = expiryDate.toISOString().split('T')[0];
            }
            
            const loteModalTitle = document.getElementById('loteModalTitle');
            if (loteModalTitle) loteModalTitle.textContent = 'Editar Lote';
            
            this.editingLoteIndex = index;
            
            const loteModal = document.getElementById('loteModal');
            const modalOverlay = document.getElementById('modalOverlay');
            
            if (loteModal && modalOverlay) {
                loteModal.classList.add('active');
                modalOverlay.classList.add('active');
            }
        }
    }

    closeLoteModal() {
        const loteModal = document.getElementById('loteModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (loteModal) loteModal.classList.remove('active');
        if (modalOverlay) modalOverlay.classList.remove('active');
    }

    addLote(loteData) {
        const lote = {
            number: loteData.number,
            quantity: parseFloat(loteData.quantity),
            expiry: loteData.expiry
        };
        
        this.currentLotes.push(lote);
        this.renderLotes();
    }

    editLote(index, loteData) {
        if (index >= 0 && index < this.currentLotes.length) {
            this.currentLotes[index] = {
                number: loteData.number,
                quantity: parseFloat(loteData.quantity),
                expiry: loteData.expiry
            };
            this.renderLotes();
        }
    }

    removeLote(index) {
        if (index >= 0 && index < this.currentLotes.length) {
            this.currentLotes.splice(index, 1);
            this.renderLotes();
        }
    }

    renderLotes() {
        const lotesList = document.getElementById('lotesList');
        if (lotesList) {
            if (this.currentLotes.length === 0) {
                lotesList.innerHTML = '<div class="empty-lotes">Nenhum lote adicionado</div>';
            } else {
                lotesList.innerHTML = this.currentLotes.map((lote, index) => {
                    const expiryStatus = this.getExpiryStatus(lote.expiry);
                    return `
                        <div class="lote-item">
                            <div class="lote-info">
                                <div class="lote-number">Lote: ${this.escapeHtml(lote.number)}</div>
                                <div class="lote-quantity">Quantidade: ${this.formatNumber(lote.quantity)}</div>
                            </div>
                            <div class="lote-expiry">
                                <div class="expiry-date">${new Date(lote.expiry).toLocaleDateString('pt-BR')}</div>
                                <span class="expiry-badge ${expiryStatus.class}">${expiryStatus.label}</span>
                            </div>
                            <div class="lote-actions">
                                <button type="button" class="btn-edit" onclick="window.inventorySystem.openEditLoteModal(${index})">Editar</button>
                                <button type="button" class="btn-remove-lote" onclick="window.inventorySystem.removeLote(${index})">Remover</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    calculateTotalQuantity() {
        return this.currentLotes.reduce((total, lote) => total + (lote.quantity || 0), 0);
    }

    getProductExpiryStatus(lotes) {
        if (!lotes || lotes.length === 0) {
            return { status: 'sem-data', label: 'Sem data', class: 'expiry-sem-data' };
        }
        
        const today = new Date();
        let closestExpiry = null;
        let minDays = Infinity;
        
        lotes.forEach(lote => {
            if (lote.expiry) {
                const expiry = new Date(lote.expiry);
                const diffTime = expiry - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays < minDays) {
                    minDays = diffDays;
                    closestExpiry = lote.expiry;
                }
            }
        });
        
        if (closestExpiry) {
            return this.getExpiryStatus(closestExpiry);
        }
        
        return { status: 'sem-data', label: 'Sem data', class: 'expiry-sem-data' };
    }

    // ===================== Tab Management =====================
    switchTab(tabName) {
        if (!this.currentUser) {
            alert("Por favor, faça login para acessar o sistema.");
            return;
        }

        console.log("Aba atual:", tabName);
        
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetButton) targetButton.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const targetTab = document.getElementById(`${tabName}Tab`);
        if (targetTab) targetTab.classList.add('active');
        
        this.currentTab = tabName;
        
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

    // ===================== Product Management (Modificado) =====================
    addProduct(productData) {
        const totalQuantity = this.calculateTotalQuantity();
        
        const product = {
            id: productData.code,
            name: productData.name,
            code: productData.code,
            quantity: totalQuantity,
            local: productData.local,
            description: productData.description || '',
            lotes: [...this.currentLotes],
            lastUpdated: new Date().toLocaleDateString("pt-BR")
        };

        this.products.push(product);
        this.saveToFirestore(product);
        this.render();
        this.updateStats();
        this.updateDashboard();
        this.populateLocationFilter();
        
        this.currentLotes = [];
        this.renderLotes();
    }

    editProduct(productId, productData) {
        const index = this.products.findIndex(p => p.id === productId);
        if (index !== -1) {
            const totalQuantity = this.calculateTotalQuantity();
            
            this.products[index] = {
                ...this.products[index],
                name: productData.name,
                code: productData.code,
                quantity: totalQuantity,
                local: productData.local,
                description: productData.description || '',
                lotes: [...this.currentLotes],
                lastUpdated: new Date().toLocaleDateString("pt-BR")
            };
            this.saveToFirestore(this.products[index]);
            this.render();
            this.updateStats();
            this.updateDashboard();
            this.populateLocationFilter();
            
            this.currentLotes = [];
            this.renderLotes();
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
        } else if (diffDays <= 90) {
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
        const expiryStatus = this.getProductExpiryStatus(product.lotes);
        
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
                    <div class="product-detail-label">Quantidade Total</div>
                    <div class="product-detail-value"><span class="quantity-badge ${quantityClass}">${this.formatNumber(quantity)}</span></div>
                </div>
                <div class="product-detail">
                    <div class="product-detail-label">Setor</div>
                    <div class="product-detail-value">${this.escapeHtml(product.local ?? '')}</div>
                </div>
                <div class="product-detail">
                    <div class="product-detail-label">Status Validade</div>
                    <div class="product-detail-value">
                        <span class="expiry-status ${expiryStatus.class}">
                            ${expiryStatus.label}
                        </span>
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
            ${product.lotes && product.lotes.length > 0 ? `
            <div class="product-lotes">
                <div class="product-detail-label">Lotes do Produto</div>
                <div class="lote-summary">
                    ${product.lotes.map(lote => {
                        const loteExpiryStatus = this.getExpiryStatus(lote.expiry);
                        return `
                            <div class="lote-badge">
                                <span class="lote-number">${this.escapeHtml(lote.number)}</span>
                                <span class="lote-quantity">${this.formatNumber(lote.quantity)}</span>
                                <span class="expiry-badge ${loteExpiryStatus.class}">${loteExpiryStatus.label}</span>
                                <small>${new Date(lote.expiry).toLocaleDateString('pt-BR')}</small>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}
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
            
            confirmModal.classList.add('active');
            modalOverlay.classList.add('active');
            
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
            
            const expiryAnalysis = {
                conforme: 0,
                atencao: 0,
                vencido: 0,
                semData: 0
            };
            
            this.products.forEach(product => {
                const status = this.getProductExpiryStatus(product.lotes);
                switch (status.status) {
                    case 'conforme': expiryAnalysis.conforme++; break;
                    case 'atencao': expiryAnalysis.atencao++; break;
                    case 'vencido': expiryAnalysis.vencido++; break;
                    default: expiryAnalysis.semData++; break;
                }
            });
            
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

        for (const product of this.selectedProductsForRequisition) {
            if (!product.requestedQuantity || product.requestedQuantity <= 0) {
                alert(`Por favor, informe a quantidade para o produto: ${product.name}`);
                return;
            }
            
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
            description: document.getElementById('requisitionDescription')?.value || '',
            local: document.getElementById('requisitionLocal')?.value || ''
        };

        Object.keys(requisition).forEach(key => {
            if (requisition[key] === undefined) {
                delete requisition[key];
            }
        });

        this.requisitions.push(requisition);
        await this.saveRequisitionToFirestore(requisition);
        this.renderRequisitions();
        this.updateDashboard();

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
            requisition.finalizedQuantity = totalFinalizedQuantity;
            requisition.finalizedQuantitiesPerItem = finalizedQuantitiesPerItem;

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
            this.render();
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
        const form = document.getElementById('requisitionForm');
        if (form) {
            const localInput = form.querySelector('#requisitionLocal');
            if (localInput) localInput.value = requisition.local ?? '';
            
            const descriptionInput = form.querySelector('#requisitionDescription');
            if (descriptionInput) descriptionInput.value = requisition.description ?? '';
            
            const estimatedQuantityInput = document.getElementById('estimatedQuantity');
            if (estimatedQuantityInput && requisition.estimatedQuantity) {
                estimatedQuantityInput.value = requisition.estimatedQuantity;
            }
            
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
            this.updateLocationFilterInModal();
            
            const selectedLocation = locationFilter ? locationFilter.value : '';
            const filteredProducts = selectedLocation ? 
                this.products.filter(product => product.local === selectedLocation) : 
                this.products;
            
            availableProductsList.innerHTML = filteredProducts.map(product => {
                const expiryStatus = this.getProductExpiryStatus(product.lotes);
                const isSelected = this.selectedProductsForRequisition.some(p => p.id === product.id);
                
                return `
                <div class="available-product-item ${isSelected ? 'selected' : ''}" data-product-id="${product.id}" data-location="${this.escapeHtml(product.local ?? '')}">
                    <div class="available-product-info">
                        <div class="available-product-name">${this.escapeHtml(product.name ?? '')}</div>
                        <div class="available-product-details">
                            <div>Código: ${this.escapeHtml(product.code ?? '')}</div>
                            <div>Setor: ${this.escapeHtml(product.local ?? '')}</div>
                            <div>Estoque: <strong>${this.formatNumber(product.quantity ?? 0)}</strong></div>
                            <div>Status Validade: 
                                <span class="expiry-status ${expiryStatus.class}">
                                    ${expiryStatus.label}
                                </span>
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
                                    <div>Status Validade: 
                                        <span class="expiry-status ${expiryStatus.class}">
                                            ${expiryStatus.label}
                                        </span>
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

    // ===================== MENU E RELATÓRIOS =====================
    setupEventListeners() {
        // Menu
        const menuToggle = document.getElementById('menuToggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenu();
            });
        }

        // Fechar menu ao clicar fora
        document.addEventListener('click', () => {
            this.closeMenu();
        });

        // Itens do menu
        const reportBtn = document.getElementById('reportBtn');
        if (reportBtn) reportBtn.addEventListener('click', () => this.openReportModal());

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

        // Modal de relatório
        const closeReportModal = document.getElementById('closeReportModal');
        if (closeReportModal) closeReportModal.addEventListener('click', () => this.closeReportModal());
        
        const cancelReportBtn = document.getElementById('cancelReportBtn');
        if (cancelReportBtn) cancelReportBtn.addEventListener('click', () => this.closeReportModal());

        const dateRange = document.getElementById('dateRange');
        if (dateRange) dateRange.addEventListener('change', () => this.toggleCustomDateRange());

        const reportForm = document.getElementById('reportForm');
        if (reportForm) {
            reportForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.generateReport();
            });
        }

        const reportType = document.getElementById('reportType');
        if (reportType) {
            reportType.addEventListener('change', () => this.toggleReportOptions());
        }

        // Modais - Botões principais
        const addItemBtn = document.getElementById('addItemBtn');
        if (addItemBtn) addItemBtn.addEventListener('click', () => this.openAddProductModal());
        
        const generateRequisitionBtn = document.getElementById('generateRequisitionBtn');
        if (generateRequisitionBtn) generateRequisitionBtn.addEventListener('click', () => this.openRequisitionModal());
        
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) addUserBtn.addEventListener('click', () => this.openAddUserModal());

        // Modais - Botões de fechar
        const closeModal = document.getElementById('closeModal');
        if (closeModal) closeModal.addEventListener('click', () => this.closeProductModal());
        
        const closeRequisitionModal = document.getElementById('closeRequisitionModal');
        if (closeRequisitionModal) closeRequisitionModal.addEventListener('click', () => this.closeRequisitionModal());
        
        const closeProductSelectionModal = document.getElementById('closeProductSelectionModal');
        if (closeProductSelectionModal) closeProductSelectionModal.addEventListener('click', () => this.closeProductSelectionModal());
        
        const closeUserModal = document.getElementById('closeUserModal');
        if (closeUserModal) closeUserModal.addEventListener('click', () => this.closeUserModal());

        // Modais - Botões de cancelar
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeProductModal());
        
        const cancelRequisitionBtn = document.getElementById('cancelRequisitionBtn');
        if (cancelRequisitionBtn) cancelRequisitionBtn.addEventListener('click', () => this.closeRequisitionModal());
        
        const cancelProductSelectionBtn = document.getElementById('cancelProductSelectionBtn');
        if (cancelProductSelectionBtn) cancelProductSelectionBtn.addEventListener('click', () => this.closeProductSelectionModal());
        
        const cancelUserBtn = document.getElementById('cancelUserBtn');
        if (cancelUserBtn) cancelUserBtn.addEventListener('click', () => this.closeUserModal());

        // Lotes
        const addLoteBtn = document.getElementById('addLoteBtn');
        if (addLoteBtn) addLoteBtn.addEventListener('click', () => this.openAddLoteModal());
        
        const closeLoteModal = document.getElementById('closeLoteModal');
        if (closeLoteModal) closeLoteModal.addEventListener('click', () => this.closeLoteModal());
        
        const cancelLoteBtn = document.getElementById('cancelLoteBtn');
        if (cancelLoteBtn) cancelLoteBtn.addEventListener('click', () => this.closeLoteModal());

        const loteForm = document.getElementById('loteForm');
        if (loteForm) {
            loteForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const loteIndex = document.getElementById('loteIndex') ? document.getElementById('loteIndex').value : '';
                const loteData = {
                    number: e.target.loteNumber.value,
                    quantity: e.target.loteQuantity.value,
                    expiry: e.target.loteExpiry.value
                };
                
                if (loteIndex !== '' && this.editingLoteIndex !== -1) {
                    this.editLote(this.editingLoteIndex, loteData);
                } else {
                    this.addLote(loteData);
                }
                this.closeLoteModal();
            });
        }

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

    toggleMenu() {
        const menuDropdown = document.getElementById('headerMenuDropdown');
        if (menuDropdown) {
            menuDropdown.classList.toggle('show');
        }
    }

    closeMenu() {
        const menuDropdown = document.getElementById('headerMenuDropdown');
        if (menuDropdown) {
            menuDropdown.classList.remove('show');
        }
    }

    openReportModal() {
        this.closeMenu();
        
        const reportForm = document.getElementById('reportForm');
        if (reportForm) reportForm.reset();
        
        // Definir datas padrão
        const today = new Date().toISOString().split('T')[0];
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        if (startDate) startDate.value = today;
        if (endDate) endDate.value = today;
        
        this.toggleReportOptions();
        
        const reportModal = document.getElementById('reportModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (reportModal && modalOverlay) {
            reportModal.classList.add('active');
            modalOverlay.classList.add('active');
        }
    }

    closeReportModal() {
        const reportModal = document.getElementById('reportModal');
        const modalOverlay = document.getElementById('modalOverlay');
        
        if (reportModal) reportModal.classList.remove('active');
        if (modalOverlay) modalOverlay.classList.remove('active');
    }

    toggleCustomDateRange() {
        const dateRange = document.getElementById('dateRange');
        const customDateRange = document.getElementById('customDateRange');
        
        if (dateRange && customDateRange) {
            if (dateRange.value === 'custom') {
                customDateRange.style.display = 'grid';
            } else {
                customDateRange.style.display = 'none';
            }
        }
    }

    toggleReportOptions() {
        const reportType = document.getElementById('reportType');
        const includeLotesSection = document.getElementById('includeLotesSection');
        const includeExpirySection = document.getElementById('includeExpirySection');
        
        if (reportType && includeLotesSection && includeExpirySection) {
            if (reportType.value === 'requisitions') {
                includeLotesSection.style.display = 'none';
                includeExpirySection.style.display = 'none';
            } else {
                includeLotesSection.style.display = 'block';
                includeExpirySection.style.display = 'block';
            }
        }
    }

    // ===================== GERAÇÃO DE RELATÓRIOS =====================
    async generateReport() {
        const reportType = document.getElementById('reportType').value;
        const dateRange = document.getElementById('dateRange').value;
        const reportFormat = document.getElementById('reportFormat').value;
        const includeLotes = document.getElementById('includeLotes')?.checked || false;
        const includeExpiry = document.getElementById('includeExpiry')?.checked || false;
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;

        // Validar período personalizado
        if (dateRange === 'custom' && (!startDate || !endDate)) {
            alert('Por favor, selecione ambas as datas para o período personalizado.');
            return;
        }

        // Mostrar loading
        const generateBtn = document.getElementById('generateReportBtn');
        const originalText = generateBtn.textContent;
        generateBtn.innerHTML = '<div class="spinner"></div> Gerando...';
        generateBtn.disabled = true;

        try {
            // Filtrar dados baseado no período
            const filteredData = await this.filterDataByDateRange(reportType, dateRange, startDate, endDate);
            
            if (reportFormat === 'pdf') {
                await this.generatePDFReport(reportType, filteredData, includeLotes, includeExpiry);
            } else {
                await this.generateExcelReport(reportType, filteredData, includeLotes, includeExpiry);
            }
            
            this.closeReportModal();
        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            alert('Erro ao gerar relatório: ' + error.message);
        } finally {
            // Restaurar botão
            generateBtn.textContent = originalText;
            generateBtn.disabled = false;
        }
    }

    async filterDataByDateRange(reportType, dateRange, startDate, endDate) {
        let filteredData = {};
        
        if (reportType === 'products' || reportType === 'all') {
            filteredData.products = this.products;
        }
        
        if (reportType === 'requisitions' || reportType === 'all') {
            let requisitions = this.requisitions;
            
            if (dateRange !== 'all') {
                const filterDate = this.getFilterDate(dateRange, startDate, endDate);
                requisitions = requisitions.filter(req => {
                    const reqDate = new Date(req.createdAt);
                    return reqDate >= filterDate.start && reqDate <= filterDate.end;
                });
            }
            
            filteredData.requisitions = requisitions;
        }
        
        return filteredData;
    }

    getFilterDate(dateRange, startDate, endDate) {
        const today = new Date();
        let start = new Date();
        let end = new Date();
        
        switch (dateRange) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'week':
                start.setDate(today.getDate() - today.getDay());
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'month':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'quarter':
                const quarter = Math.floor(today.getMonth() / 3);
                start = new Date(today.getFullYear(), quarter * 3, 1);
                end = new Date(today.getFullYear(), quarter * 3 + 3, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'year':
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today.getFullYear(), 11, 31);
                end.setHours(23, 59, 59, 999);
                break;
            case 'custom':
                start = new Date(startDate);
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                break;
            default:
                start = new Date(0); // Data mínima
                end = new Date(); // Data atual
        }
        
        return { start, end };
    }

    async generatePDFReport(reportType, data, includeLotes, includeExpiry) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configurações do documento
        doc.setFont('helvetica');
        doc.setFontSize(16);
        
        // Cabeçalho
        doc.setTextColor(41, 128, 185);
        doc.text('RELATÓRIO DE ESTOQUE - SISTEMA DE ALMOXARIFADO', 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, 28, { align: 'center' });
        doc.text(`Usuário: ${this.currentUser?.email || 'Sistema'}`, 105, 33, { align: 'center' });
        
        let yPosition = 45;
        
        // Relatório de Produtos
        if (reportType === 'products' || reportType === 'all') {
            yPosition = this.addProductsToPDF(doc, data.products, yPosition, includeLotes, includeExpiry);
        }
        
        // Relatório de Requisições
        if (reportType === 'requisitions' || reportType === 'all') {
            // Adicionar nova página se necessário
            if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
            }
            yPosition = this.addRequisitionsToPDF(doc, data.requisitions, yPosition);
        }
        
        // Rodapé
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
        }
        
        // Salvar PDF
        const fileName = `relatorio_estoque_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        
        alert('Relatório PDF gerado com sucesso!');
    }

    addProductsToPDF(doc, products, yPosition, includeLotes, includeExpiry) {
        doc.setFontSize(14);
        doc.setTextColor(44, 62, 80);
        doc.text('PRODUTOS EM ESTOQUE', 14, yPosition);
        yPosition += 10;
        
        if (products.length === 0) {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text('Nenhum produto encontrado no estoque.', 14, yPosition);
            return yPosition + 15;
        }
        
        // Cabeçalho da tabela
        doc.setFillColor(41, 128, 185);
        doc.setTextColor(255, 255, 255);
        doc.rect(14, yPosition, 182, 8, 'F');
        doc.setFontSize(9);
        doc.text('Código', 18, yPosition + 6);
        doc.text('Nome', 45, yPosition + 6);
        doc.text('Setor', 100, yPosition + 6);
        doc.text('Quantidade', 130, yPosition + 6);
        doc.text('Status', 160, yPosition + 6);
        doc.text('Última Atualização', 180, yPosition + 6);
        
        yPosition += 15;
        
        // Dados dos produtos
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        
        products.forEach((product, index) => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
            }
            
            // Alternar cores das linhas
            if (index % 2 === 0) {
                doc.setFillColor(240, 240, 240);
                doc.rect(14, yPosition - 4, 182, 8, 'F');
            }
            
            doc.text(product.code || '-', 18, yPosition);
            doc.text(this.truncateText(product.name || '-', 25), 45, yPosition);
            doc.text(this.truncateText(product.local || '-', 15), 100, yPosition);
            doc.text(this.formatNumber(product.quantity || 0), 130, yPosition);
            
            // Status de validade
            const expiryStatus = this.getProductExpiryStatus(product.lotes);
            doc.setTextColor(this.getStatusColor(expiryStatus.status));
            doc.text(expiryStatus.label, 160, yPosition);
            doc.setTextColor(0, 0, 0);
            
            doc.text(product.lastUpdated || '-', 180, yPosition);
            
            yPosition += 8;
            
            // Detalhes dos lotes
            if (includeLotes && product.lotes && product.lotes.length > 0) {
                product.lotes.forEach(lote => {
                    if (yPosition > 270) {
                        doc.addPage();
                        yPosition = 20;
                    }
                    
                    const loteStatus = this.getExpiryStatus(lote.expiry);
                    doc.setFontSize(7);
                    doc.setTextColor(100, 100, 100);
                    doc.text(`   Lote ${lote.number}: ${this.formatNumber(lote.quantity)} - Val: ${new Date(lote.expiry).toLocaleDateString('pt-BR')} (${loteStatus.label})`, 18, yPosition);
                    doc.setFontSize(8);
                    doc.setTextColor(0, 0, 0);
                    yPosition += 5;
                });
                yPosition += 3;
            }
        });
        
        // Análise de validade
        if (includeExpiry) {
            yPosition = this.addExpiryAnalysisToPDF(doc, products, yPosition);
        }
        
        return yPosition + 10;
    }

    addRequisitionsToPDF(doc, requisitions, yPosition) {
        doc.setFontSize(14);
        doc.setTextColor(44, 62, 80);
        doc.text('REQUISIÇÕES REALIZADAS', 14, yPosition);
        yPosition += 10;
        
        if (requisitions.length === 0) {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text('Nenhuma requisição encontrada.', 14, yPosition);
            return yPosition + 15;
        }
        
        requisitions.forEach((requisition, index) => {
            if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
            }
            
            doc.setFontSize(10);
            doc.setTextColor(52, 152, 219);
            doc.text(`Requisição #${requisition.id} - ${requisition.status}`, 14, yPosition);
            yPosition += 6;
            
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`Data: ${this.formatDateTime(requisition.createdAt)} - Por: ${requisition.createdBy}`, 14, yPosition);
            yPosition += 6;
            
            doc.setTextColor(0, 0, 0);
            doc.text(`Total Requisitado: ${this.formatNumber(requisition.totalRequested || 0)} itens`, 14, yPosition);
            yPosition += 8;
            
            // Produtos da requisição
            if (requisition.products && requisition.products.length > 0) {
                requisition.products.forEach(product => {
                    if (yPosition > 270) {
                        doc.addPage();
                        yPosition = 20;
                    }
                    
                    doc.text(`• ${product.name} (${product.code}): ${this.formatNumber(product.requestedQuantity)} de ${this.formatNumber(product.availableQuantity)}`, 18, yPosition);
                    yPosition += 5;
                });
            }
            
            yPosition += 10;
        });
        
        return yPosition;
    }

    addExpiryAnalysisToPDF(doc, products, yPosition) {
        if (yPosition > 220) {
            doc.addPage();
            yPosition = 20;
        }
        
        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text('ANÁLISE DE VALIDADE', 14, yPosition);
        yPosition += 8;
        
        const expiryAnalysis = {
            conforme: 0,
            atencao: 0,
            vencido: 0,
            semData: 0
        };
        
        products.forEach(product => {
            const status = this.getProductExpiryStatus(product.lotes);
            switch (status.status) {
                case 'conforme': expiryAnalysis.conforme++; break;
                case 'atencao': expiryAnalysis.atencao++; break;
                case 'vencido': expiryAnalysis.vencido++; break;
                default: expiryAnalysis.semData++; break;
            }
        });
        
        doc.setFontSize(9);
        doc.setTextColor(39, 174, 96);
        doc.text(`✅ Conforme: ${expiryAnalysis.conforme} produtos`, 18, yPosition);
        yPosition += 5;
        
        doc.setTextColor(243, 156, 18);
        doc.text(`⚠️ Atenção: ${expiryAnalysis.atencao} produtos`, 18, yPosition);
        yPosition += 5;
        
        doc.setTextColor(231, 76, 60);
        doc.text(`❌ Vencido: ${expiryAnalysis.vencido} produtos`, 18, yPosition);
        yPosition += 5;
        
        doc.setTextColor(100, 100, 100);
        doc.text(`📋 Sem Data: ${expiryAnalysis.semData} produtos`, 18, yPosition);
        yPosition += 10;
        
        return yPosition;
    }

    async generateExcelReport(reportType, data, includeLotes, includeExpiry) {
        const wb = XLSX.utils.book_new();
        
        if (reportType === 'products' || reportType === 'all') {
            this.addProductsToExcel(wb, data.products, includeLotes, includeExpiry);
        }
        
        if (reportType === 'requisitions' || reportType === 'all') {
            this.addRequisitionsToExcel(wb, data.requisitions);
        }
        
        // Salvar arquivo
        const fileName = `relatorio_estoque_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        alert('Relatório Excel gerado com sucesso!');
    }

    addProductsToExcel(wb, products, includeLotes, includeExpiry) {
        const wsData = [
            ['RELATÓRIO DE PRODUTOS EM ESTOQUE'],
            ['Gerado em:', new Date().toLocaleDateString('pt-BR'), 'às', new Date().toLocaleTimeString('pt-BR')],
            ['Usuário:', this.currentUser?.email || 'Sistema'],
            [], // Linha em branco
            ['Código', 'Nome', 'Setor', 'Quantidade Total', 'Status Validade', 'Última Atualização', 'Descrição']
        ];
        
        // Adicionar produtos
        products.forEach(product => {
            const expiryStatus = this.getProductExpiryStatus(product.lotes);
            wsData.push([
                product.code || '',
                product.name || '',
                product.local || '',
                product.quantity || 0,
                expiryStatus.label,
                product.lastUpdated || '',
                product.description || ''
            ]);
            
            // Adicionar lotes se solicitado
            if (includeLotes && product.lotes && product.lotes.length > 0) {
                product.lotes.forEach(lote => {
                    const loteStatus = this.getExpiryStatus(lote.expiry);
                    wsData.push([
                        '',
                        `Lote: ${lote.number}`,
                        '',
                        lote.quantity,
                        loteStatus.label,
                        new Date(lote.expiry).toLocaleDateString('pt-BR'),
                        ''
                    ]);
                });
                wsData.push([]); // Linha em branco entre produtos
            }
        });
        
        // Adicionar análise de validade se solicitado
        if (includeExpiry) {
            wsData.push([]);
            wsData.push(['ANÁLISE DE VALIDADE']);
            
            const expiryAnalysis = {
                conforme: 0,
                atencao: 0,
                vencido: 0,
                semData: 0
            };
            
            products.forEach(product => {
                const status = this.getProductExpiryStatus(product.lotes);
                switch (status.status) {
                    case 'conforme': expiryAnalysis.conforme++; break;
                    case 'atencao': expiryAnalysis.atencao++; break;
                    case 'vencido': expiryAnalysis.vencido++; break;
                    default: expiryAnalysis.semData++; break;
                }
            });
            
            wsData.push(['Status', 'Quantidade']);
            wsData.push(['Conforme', expiryAnalysis.conforme]);
            wsData.push(['Atenção', expiryAnalysis.atencao]);
            wsData.push(['Vencido', expiryAnalysis.vencido]);
            wsData.push(['Sem Data', expiryAnalysis.semData]);
        }
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    }

    addRequisitionsToExcel(wb, requisitions) {
        const wsData = [
            ['RELATÓRIO DE REQUISIÇÕES'],
            ['Gerado em:', new Date().toLocaleDateString('pt-BR'), 'às', new Date().toLocaleTimeString('pt-BR')],
            ['Usuário:', this.currentUser?.email || 'Sistema'],
            [], // Linha em branco
            ['ID Requisição', 'Data', 'Solicitante', 'Status', 'Total Itens', 'Descrição']
        ];
        
        requisitions.forEach(requisition => {
            wsData.push([
                requisition.id,
                this.formatDateTime(requisition.createdAt),
                requisition.createdBy,
                requisition.status,
                requisition.totalRequested || 0,
                requisition.description || ''
            ]);
            
            // Adicionar produtos da requisição
            if (requisition.products && requisition.products.length > 0) {
                wsData.push(['', 'Produtos da Requisição:', '', '', '', '']);
                requisition.products.forEach(product => {
                    wsData.push([
                        '',
                        product.name,
                        product.code,
                        `Req: ${product.requestedQuantity}`,
                        `Disp: ${product.availableQuantity}`,
                        product.setor
                    ]);
                });
                wsData.push([]); // Linha em branco
            }
        });
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Requisições');
    }

    // Utilitários para relatórios
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    getStatusColor(status) {
        switch (status) {
            case 'conforme': return [39, 174, 96]; // Verde
            case 'atencao': return [243, 156, 18]; // Laranja
            case 'vencido': return [231, 76, 60];  // Vermelho
            default: return [100, 100, 100];       // Cinza
        }
    }

    // ===================== UI and Utilities =====================
    closeAllModals() {
        this.closeProductModal();
        this.closeRequisitionModal();
        this.closeProductSelectionModal();
        this.closeUserModal();
        this.closeConfirmModal();
        this.closeLoteModal();
        this.closeReportModal();
    }

    openAddProductModal() {
        const productForm = document.getElementById('productForm');
        if (productForm) productForm.reset();
        
        const productId = document.getElementById('productId');
        if (productId) productId.value = '';
        
        this.currentLotes = [];
        this.renderLotes();
        
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
            
            const productLocationInput = document.getElementById('productLocation');
            if (productLocationInput) productLocationInput.value = product.local ?? '';
            
            const productDescriptionInput = document.getElementById('productDescription');
            if (productDescriptionInput) productDescriptionInput.value = product.description ?? '';
            
            this.currentLotes = product.lotes ? [...product.lotes] : [];
            this.renderLotes();
            
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

    filterAvailableProducts(searchTerm) {
        const availableProductItems = document.querySelectorAll('.available-product-item');
        const locationFilter = document.getElementById('locationFilter');
        const selectedLocation = locationFilter ? locationFilter.value : '';
        const term = searchTerm.toLowerCase();
        
        availableProductItems.forEach(item => {
            const name = item.querySelector('.available-product-name').textContent.toLowerCase();
            const details = item.querySelector('.available-product-details').textContent.toLowerCase();
            const location = item.dataset.location || '';
            
            const matchesSearch = name.includes(term) || details.includes(term);
            const matchesLocation = !selectedLocation || location === selectedLocation;
            
            if (matchesSearch && matchesLocation) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
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

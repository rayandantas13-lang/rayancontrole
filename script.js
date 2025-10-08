// Importar módulos do Firebase v9
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Suas credenciais do Firebase (versão 9)
const firebaseConfig = {
  apiKey: "SUA_API_KEY_CORRETA_DO_CONSOLE",
  authDomain: "almoxarifado-348d5.firebaseapp.com",
  projectId: "almoxarifado-348d5",
  storageBucket: "almoxarifado-348d5.firebasestorage.app", // ou .appspot.com, o que estiver no console
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
        this.currentUser = null;
        this.userRole = 'guest'; // Papeis: guest, normal, subadm, admin
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.setupAuthListener();
    }

    // ===================== Autenticação e Autorização =====================
    async setupAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            this.currentUser = user;
            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    this.userRole = userDoc.data().role;
                } else {
                    this.userRole = 'normal'; // Papel padrão para novos usuários
                    await setDoc(userDocRef, { email: user.email, role: this.userRole });
                }
                document.getElementById("loginPage").style.display = "none";
                document.getElementById("mainApp").style.display = "block";
                await this.loadAllData();
            } else {
                this.userRole = 'guest';
                document.getElementById("loginPage").style.display = "flex";
                document.getElementById("mainApp").style.display = "none";
                this.clearData();
            }
            this.applyPermissions();
            this.renderAll();
        });
    }

    async login(email, password) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            alert("Login realizado com sucesso!");
        } catch (error) {
            alert("Erro no login: " + error.message);
        }
    }

    async logout() {
        await signOut(auth);
        alert("Logout realizado!");
    }

    applyPermissions() {
        const isAdmin = this.userRole === 'admin';
        const isSubAdm = this.userRole === 'subadm';
        
        // Botões de adicionar (visíveis para admin e subadm)
        document.getElementById('addItemBtn').style.display = (isAdmin || isSubAdm) ? 'block' : 'none';
        document.getElementById('addUserBtn').style.display = isAdmin ? 'block' : 'none';

        // Aba de gerenciamento de usuários (visível apenas para admin)
        document.getElementById('userManagementTabBtn').style.display = isAdmin ? 'block' : 'none';

        // Re-renderiza tudo para aplicar permissões nos itens (botões de editar/excluir)
        this.renderAll();
    }

    // ===================== Operações com Firestore =====================
    async loadAllData() {
        await this.loadProductsFromFirestore();
        await this.loadRequisitionsFromFirestore();
        if (this.userRole === 'admin') {
            await this.renderUsers();
        }
    }

    async loadProductsFromFirestore() {
        const productsCol = collection(db, "products");
        const snapshot = await getDocs(productsCol);
        this.products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async loadRequisitionsFromFirestore() {
        const requisitionsCol = collection(db, "requisitions");
        const snapshot = await getDocs(requisitionsCol);
        this.requisitions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async saveData(collectionName, id, data) {
        await setDoc(doc(db, collectionName, id), data);
    }

    async deleteData(collectionName, id) {
        await deleteDoc(doc(db, collectionName, id));
    }
    
    async updateProductQuantity(productId, newQuantity) {
        const productRef = doc(db, "products", productId);
        await updateDoc(productRef, { quantity: newQuantity });
    }

    // ===================== Gerenciamento de Produtos =====================
    async handleProductForm(event) {
        event.preventDefault();
        const form = event.target;
        const productId = form.productId.value;
        const productData = {
            name: form.productName.value,
            code: form.productCode.value,
            quantity: Number(form.productQuantity.value),
            local: form.productLocal.value,
            description: form.productDescription.value,
            lastUpdated: new Date().toLocaleDateString("pt-BR")
        };

        const id = productId || productData.code;
        await this.saveData("products", id, productData);
        
        this.closeProductModal();
        await this.loadProductsFromFirestore();
        this.renderAll();
        alert(`Produto ${productId ? 'atualizado' : 'adicionado'} com sucesso!`);
    }

    async deleteProduct(productId) {
        if (confirm("Tem certeza que deseja excluir este produto?")) {
            await this.deleteData("products", productId);
            await this.loadProductsFromFirestore();
            this.renderAll();
            alert("Produto excluído com sucesso!");
        }
    }

    // ===================== Gerenciamento de Requisições =====================
    async handleRequisitionForm(event) {
        event.preventDefault();
        const form = event.target;
        const isNormalUser = this.userRole === 'normal';
        
        const selectedProducts = Array.from(form.querySelectorAll('input[name="product-checkbox"]:checked'))
            .map(cb => this.products.find(p => p.id === cb.value));

        if (selectedProducts.length === 0) {
            alert("Selecione ao menos um produto.");
            return;
        }

        const requisition = {
            id: `REQ-${Date.now()}`,
            requester: this.currentUser.email,
            date: new Date().toLocaleDateString("pt-BR"),
            status: 'Pendente',
            description: form.requisitionDescription.value,
            products: selectedProducts.map(p => ({
                id: p.id,
                name: p.name,
                code: p.code,
                // Para usuários normais, a quantidade vem do campo único; para outros, é 1 por item
                quantity: isNormalUser ? Number(form.estimatedQuantity.value) : 1
            })),
            totalItems: selectedProducts.length,
            finalizedQuantity: 0
        };

        await this.saveData("requisitions", requisition.id, requisition);
        this.closeRequisitionModal();
        await this.loadRequisitionsFromFirestore();
        this.renderRequisitions();
        alert("Requisição gerada com sucesso!");
    }
    
    async finalizeRequisition(requisitionId) {
        const finalizedQuantityStr = prompt("Digite a quantidade real finalizada para esta requisição:");
        if (finalizedQuantityStr === null) return; // Usuário cancelou

        const finalizedQuantity = Number(finalizedQuantityStr);
        if (isNaN(finalizedQuantity) || finalizedQuantity < 0) {
            alert("Por favor, insira um número válido.");
            return;
        }

        const requisition = this.requisitions.find(r => r.id === requisitionId);
        if (!requisition) return;

        // Atualiza o status e a quantidade finalizada da requisição
        requisition.status = 'Finalizado';
        requisition.finalizedQuantity = finalizedQuantity;
        await this.saveData("requisitions", requisition.id, requisition);

        // Atualiza o estoque dos produtos
        for (const reqProduct of requisition.products) {
            const product = this.products.find(p => p.id === reqProduct.id);
            if (product) {
                const newQuantity = product.quantity - finalizedQuantity;
                await this.updateProductQuantity(product.id, newQuantity < 0 ? 0 : newQuantity);
            }
        }

        await this.loadAllData();
        this.renderAll();
        alert("Requisição finalizada e estoque atualizado!");
    }

    // ===================== Gerenciamento de Usuários (Admin) =====================
    async handleUserForm(event) {
        event.preventDefault();
        const form = event.target;
        const email = form.userEmail.value;
        const password = form.userPassword.value;
        const role = form.userRole.value;

        try {
            // 1. Cria o usuário no Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            // 2. Salva o papel do usuário no Firestore
            await this.saveData("users", userCredential.user.uid, { email, role });
            
            this.closeUserModal();
            await this.renderUsers();
            alert("Usuário adicionado com sucesso!");
        } catch (error) {
            alert("Erro ao adicionar usuário: " + error.message);
        }
    }

    async deleteUser(userId, userEmail) {
        if (confirm(`Tem certeza que deseja excluir o usuário ${userEmail}? Esta ação não pode ser desfeita.`)) {
            // NOTA: A exclusão de um usuário do Firebase Auth é uma operação sensível
            // e geralmente requer um ambiente de back-end (Cloud Functions) para ser feita de forma segura.
            // Por simplicidade, aqui vamos apenas remover do Firestore.
            await this.deleteData("users", userId);
            await this.renderUsers();
            alert("Usuário removido do Firestore!");
        }
    }

    // ===================== Renderização e UI =====================
    renderAll() {
        this.renderProducts();
        this.renderRequisitions();
        this.updateStats();
        if (this.userRole === 'admin') {
            this.renderUsers();
        }
    }

    renderProducts() {
        const list = document.getElementById("productsList");
        const empty = document.getElementById("emptyState");
        const searchTerm = document.getElementById("searchInput").value.toLowerCase();
        
        const filtered = this.products.filter(p => 
            p.name.toLowerCase().includes(searchTerm) || 
            p.code.toLowerCase().includes(searchTerm) ||
            p.local.toLowerCase().includes(searchTerm)
        );

        list.innerHTML = "";
        if (filtered.length === 0) {
            empty.style.display = "block";
            return;
        }
        
        empty.style.display = "none";
        filtered.forEach(p => {
            const item = document.createElement("div");
            item.className = "product-item";
            item.innerHTML = this.createProductHTML(p);
            list.appendChild(item);
        });
    }

    createProductHTML(product) {
        const isAdmOrSubAdm = this.userRole === 'admin' || this.userRole === 'subadm';
        const quantityClass = product.quantity < 100 ? 'quantity-low' : product.quantity < 500 ? 'quantity-medium' : 'quantity-high';
        
        return `
            <div class="product-header">
                <h3>${product.name}</h3>
                ${isAdmOrSubAdm ? `
                <div class="product-actions">
                    <button class="btn-edit" onclick="window.inventorySystem.openEditProductModal('${product.id}')">Editar</button>
                    <button class="btn-danger" onclick="window.inventorySystem.deleteProduct('${product.id}')">Excluir</button>
                </div>` : ''}
            </div>
            <div class="product-details">
                <p><strong>Código:</strong> ${product.code}</p>
                <p><strong>Local:</strong> ${product.local}</p>
                <p><strong>Quantidade:</strong> <span class="quantity-badge ${quantityClass}">${product.quantity}</span></p>
            </div>
            <p class="product-description">${product.description || 'Sem descrição.'}</p>
        `;
    }

    renderRequisitions() {
        const list = document.getElementById("requisitionsList");
        const empty = document.getElementById("emptyRequisitionState");
        list.innerHTML = "";

        if (this.requisitions.length === 0) {
            empty.style.display = "block";
            return;
        }

        empty.style.display = "none";
        this.requisitions.forEach(r => {
            const item = document.createElement("div");
            item.className = "requisition-item";
            item.innerHTML = this.createRequisitionHTML(r);
            list.appendChild(item);
        });
    }

    createRequisitionHTML(requisition) {
        const isAdmOrSubAdm = this.userRole === 'admin' || this.userRole === 'subadm';
        const statusClass = requisition.status === 'Pendente' ? 'status-pending' : 'status-finalized';
        
        return `
            <div class="requisition-header">
                <h3>Requisição #${requisition.id.substring(4, 10)}</h3>
                <span class="requisition-status ${statusClass}">${requisition.status}</span>
            </div>
            <p><strong>Solicitante:</strong> ${requisition.requester}</p>
            <p><strong>Data:</strong> ${requisition.date}</p>
            <p><strong>Descrição:</strong> ${requisition.description}</p>
            <ul>
                ${requisition.products.map(p => `<li>${p.name} (Qtd: ${p.quantity})</li>`).join('')}
            </ul>
            ${(isAdmOrSubAdm && requisition.status === 'Pendente') ? `
            <div class="requisition-actions">
                <button class="btn-primary" onclick="window.inventorySystem.finalizeRequisition('${requisition.id}')">Finalizar</button>
            </div>` : ''}
        `;
    }

    async renderUsers() {
        const list = document.getElementById("usersList");
        list.innerHTML = "Carregando...";
        
        const usersCol = collection(db, "users");
        const snapshot = await getDocs(usersCol);
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        list.innerHTML = "";
        users.forEach(user => {
            const item = document.createElement("div");
            item.className = "user-item";
            item.innerHTML = `
                <p>${user.email}</p>
                <p><strong>${user.role.toUpperCase()}</strong></p>
                <button class="btn-danger" onclick="window.inventorySystem.deleteUser('${user.id}', '${user.email}')">Excluir</button>
            `;
            list.appendChild(item);
        });
    }

    updateStats() {
        document.getElementById('totalProductsStat').textContent = this.products.length;
        document.getElementById('totalStockStat').textContent = this.products.reduce((sum, p) => sum + p.quantity, 0);
        document.getElementById('totalRequisitionsStat').textContent = this.requisitions.length;
    }

    clearData() {
        this.products = [];
        this.requisitions = [];
        this.renderAll();
    }

    // ===================== Modais e Eventos =====================
    setupEventListeners() {
        document.getElementById('loginForm').addEventListener('submit', (e) => this.login(e.target.email.value, e.target.password.value));
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('searchInput').addEventListener('input', () => this.renderProducts());
        
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Ações principais
        document.getElementById('addItemBtn').addEventListener('click', () => this.openAddProductModal());
        document.getElementById('generateRequisitionBtn').addEventListener('click', () => this.openRequisitionModal());
        document.getElementById('addUserBtn').addEventListener('click', () => this.openAddUserModal());

        // Submissão de formulários
        document.getElementById('productForm').addEventListener('submit', (e) => this.handleProductForm(e));
        document.getElementById('requisitionForm').addEventListener('submit', (e) => this.handleRequisitionForm(e));
        document.getElementById('userForm').addEventListener('submit', (e) => this.handleUserForm(e));
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.getElementById(`${tabName}Tab`).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    openAddProductModal() {
        document.getElementById('productForm').reset();
        document.getElementById('productId').value = '';
        document.getElementById('productModalTitle').textContent = 'Adicionar Novo Produto';
        document.getElementById('productModal').style.display = 'flex';
    }

    openEditProductModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        const form = document.getElementById('productForm');
        form.reset();
        form.productId.value = product.id;
        form.productName.value = product.name;
        form.productCode.value = product.code;
        form.productQuantity.value = product.quantity;
        form.productLocal.value = product.local;
        form.productDescription.value = product.description;
        
        document.getElementById('productModalTitle').textContent = 'Editar Produto';
        document.getElementById('productModal').style.display = 'flex';
    }

    closeProductModal() {
        document.getElementById('productModal').style.display = 'none';
    }

    openRequisitionModal() {
        const list = document.getElementById('productSelectionList');
        list.innerHTML = "";
        this.products.forEach(p => {
            list.innerHTML += `
                <div class="checkbox-item">
                    <input type="checkbox" id="prod-${p.id}" name="product-checkbox" value="${p.id}">
                    <label for="prod-${p.id}">${p.name} (Estoque: ${p.quantity})</label>
                </div>
            `;
        });

        // Ajusta o formulário com base no papel do usuário
        const isNormalUser = this.userRole === 'normal';
        document.getElementById('estimatedQuantityGroup').style.display = isNormalUser ? 'block' : 'none';
        document.getElementById('estimatedQuantity').required = isNormalUser;
        
        document.getElementById('requisitionModal').style.display = 'flex';
    }

    closeRequisitionModal() {
        document.getElementById('requisitionModal').style.display = 'none';
    }

    openAddUserModal() {
        document.getElementById('userForm').reset();
        document.getElementById('userModal').style.display = 'flex';
    }

    closeUserModal() {
        document.getElementById('userModal').style.display = 'none';
    }
}

// Inicia o sistema quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.inventorySystem = new InventorySystem();
});

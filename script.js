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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===================== Sistema =====================
class InventorySystem {
  constructor() {
    this.products = [];
    this.requisitions = [];
    this.currentEditingId = null;
    this.currentReqProduct = null;
    this.bindEvents();
    this.loadProducts();
    this.loadRequisitions();
  }

  // -------- Produtos --------
  loadProducts() {
    const colRef = collection(db, "products");
    onSnapshot(colRef, (snapshot) => {
      this.products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.renderProducts();
      this.updateDashboard();
    });
  }

  async addProduct(data) {
    await addDoc(collection(db, "products"), {
      ...data,
      quantity: parseInt(data.quantity),
      createdAt: new Date().toISOString()
    });
  }

  async updateProduct(id, data) {
    await updateDoc(doc(db, "products", id), {
      ...data,
      quantity: parseInt(data.quantity),
      updatedAt: new Date().toISOString()
    });
  }

  async deleteProduct(id) {
    await deleteDoc(doc(db, "products", id));
  }

  // -------- Requisições --------
  loadRequisitions() {
    const colRef = collection(db, "requisitions");
    onSnapshot(colRef, (snapshot) => {
      this.requisitions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.renderRequisitions();
      this.updateDashboard();
    });
  }

  async requisitarProduto(product, qty) {
    const newQty = product.quantity - qty;
    if (newQty < 0) return alert("Quantidade insuficiente!");

    await updateDoc(doc(db, "products", product.id), { quantity: newQty, updatedAt: new Date().toISOString() });
    await addDoc(collection(db, "requisitions"), {
      productId: product.id,
      name: product.name,
      code: product.code,
      requisitedQty: qty,
      date: new Date().toISOString()
    });
  }

  // -------- Renderização --------
  renderProducts() {
    const list = document.getElementById("productsList");
    list.innerHTML = "";
    if (this.products.length === 0) {
      document.getElementById("emptyState").style.display = "block";
      return;
    }
    document.getElementById("emptyState").style.display = "none";
    this.products.forEach(p => {
      const item = document.createElement("div");
      item.className = "product-item";
      item.innerHTML = `
        <div class="product-header">
          <div>
            <h3>${p.name}</h3>
            <div>Código: ${p.code}</div>
          </div>
          <div class="product-actions">
            <button data-edit="${p.id}">Editar</button>
            <button data-delete="${p.id}">Excluir</button>
            <button data-req="${p.id}">Requisitar</button>
          </div>
        </div>
        <div>Quantidade: <span>${p.quantity}</span></div>
        <div>Local: ${p.location}</div>
      `;
      list.appendChild(item);
    });
    document.getElementById("totalItems").textContent = `Total de produtos: ${this.products.length}`;
  }

  renderRequisitions() {
    const list = document.getElementById("requisitionsList");
    list.innerHTML = "";
    if (this.requisitions.length === 0) {
      document.getElementById("emptyRequisitions").style.display = "block";
      return;
    }
    document.getElementById("emptyRequisitions").style.display = "none";
    this.requisitions.forEach(r => {
      const div = document.createElement("div");
      div.className = "product-item";
      div.innerHTML = `
        <p><strong>${r.name}</strong> (${r.code})</p>
        <p>Quantidade requisitada: ${r.requisitedQty}</p>
        <p>Data: ${new Date(r.date).toLocaleString("pt-BR")}</p>
      `;
      list.appendChild(div);
    });
  }

  // -------- Dashboard --------
  updateDashboard() {
    document.getElementById("dashTotalProducts").textContent = this.products.length;
    document.getElementById("dashTotalRequisitions").textContent = this.requisitions.length;
    document.getElementById("dashTotalQuantity").textContent = this.products.reduce((s, p) => s + p.quantity, 0);
  }

  // -------- Exportação --------
  exportExcel() {
    let csv = "Produto,Código,Quantidade,Data\n";
    this.requisitions.forEach(r => {
      csv += `${r.name},${r.code},${r.requisitedQty},${new Date(r.date).toLocaleString("pt-BR")}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "requisicoes.csv";
    a.click();
  }

  exportPDF() {
    const conteudo = this.requisitions.map(r => 
      `${r.name} (${r.code}) - ${r.requisitedQty} unidades em ${new Date(r.date).toLocaleString("pt-BR")}`
    ).join("\n");
    const blob = new Blob([conteudo], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "requisicoes.pdf";
    a.click();
  }

  // -------- Eventos --------
  bindEvents() {
    // Tabs
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).classList.add("active");
      });
    });

    // Exportação
    document.getElementById("exportExcel").addEventListener("click", () => this.exportExcel());
    document.getElementById("exportPDF").addEventListener("click", () => this.exportPDF());

    // Produtos
    document.getElementById("productsList").addEventListener("click", e => {
      if (e.target.dataset.edit) this.editProduct(e.target.dataset.edit);
      if (e.target.dataset.delete) this.deleteProduct(e.target.dataset.delete);
      if (e.target.dataset.req) this.openRequisition(e.target.dataset.req);
    });

    // Modal Requisição
    document.getElementById("requisitionForm").addEventListener("submit", e => {
      e.preventDefault();
      const qty = parseInt(document.getElementById("reqQuantity").value);
      if (this.currentReqProduct && qty > 0) {
        this.requisitarProduto(this.currentReqProduct, qty);
        this.closeModal("requisitionModal");
      }
    });
    document.getElementById("cancelReqBtn").addEventListener("click", () => this.closeModal("requisitionModal"));
  }

  openRequisition(id) {
    const p = this.products.find(pr => pr.id === id);
    if (!p) return;
    this.currentReqProduct = p;
    document.getElementById("reqProductName").textContent = p.name;
    document.getElementById("reqProductStock").textContent = p.quantity;
    this.openModal("requisitionModal");
  }

  openModal(id) {
    document.getElementById(id).classList.add("active");
    document.getElementById("modalOverlay").classList.add("active");
  }

  closeModal(id) {
    document.getElementById(id).classList.remove("active");
    document.getElementById("modalOverlay").classList.remove("active");
  }
}

// ===================== Inicialização =====================
document.addEventListener('DOMContentLoaded', () => {
    const inventorySystem = new InventorySystem();
    window.inventorySystem = inventorySystem; // só para depuração no console
});

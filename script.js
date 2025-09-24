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

// Inicializa Firebase e Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ====================
// Sistema de Estoque
// ====================
class InventorySystem {
    constructor() {
        this.products = [];
        this.loadProducts();
    }

    async loadProducts() {
        // 🔹 Carregar produtos do Firestore
        // this.products = await getDocs(...) 
        // (mantém igual ao seu, só exemplificando)
        this.renderProducts();
    }

    renderProducts() {
        const list = document.getElementById("productsList");
        const empty = document.getElementById("emptyState");

        list.innerHTML = "";
        if (this.products.length === 0) {
            empty.style.display = "block";
            return;
        }

        empty.style.display = "none";
        this.products.forEach(prod => {
            const div = document.createElement("div");
            div.classList.add("product-card");
            div.innerHTML = `
                <h4>${prod.name}</h4>
                <p><strong>Código:</strong> ${prod.code}</p>
                <p><strong>Qtd:</strong> ${prod.quantity}</p>
                <p><strong>Local:</strong> ${prod.location}</p>
            `;
            list.appendChild(div);
        });
        document.getElementById("totalItems").textContent = `Total de itens: ${this.products.length}`;
    }

    // 🔹 Utilitário para abrir/fechar modais
    openModal(id) {
        document.getElementById(id).style.display = "block";
        document.getElementById("modalOverlay").style.display = "block";
    }

    closeModal(id) {
        document.getElementById(id).style.display = "none";
        document.getElementById("modalOverlay").style.display = "none";
    }
}

// ====================
// Sistema de Requisições
// ====================
class RequisitionSystem {
    constructor(inventory) {
        this.inventory = inventory;
        this.requisicoes = [];
        this.bindEvents();
    }

    bindEvents() {
        // Botão para abrir modal
        document.getElementById("novaRequisicaoBtn").addEventListener("click", () => {
            this.loadProdutosNoFormulario();
            this.inventory.openModal("requisicaoModal");
        });

        // Formulário de requisição
        document.getElementById("requisicaoForm").addEventListener("submit", (e) => {
            e.preventDefault();
            this.salvarRequisicao();
        });

        // Quando muda o departamento, filtra produtos
        document.getElementById("departamento").addEventListener("change", () => {
            this.loadProdutosNoFormulario();
        });
    }

    loadProdutosNoFormulario() {
        const departamento = document.getElementById("departamento").value;
        const container = document.getElementById("produtosRequisicao");
        container.innerHTML = "";

        if (!departamento) return;

        // Filtra produtos do estoque pelo local/departamento
        const produtos = this.inventory.products.filter(p => 
            p.location.toUpperCase() === departamento.toUpperCase()
        );

        if (produtos.length === 0) {
            container.innerHTML = `<p>Nenhum produto disponível neste setor.</p>`;
            return;
        }

        produtos.forEach(p => {
            const div = document.createElement("div");
            div.classList.add("req-item");
            div.innerHTML = `
                <label>
                    <input type="checkbox" name="prodSelecionado" value="${p.code}">
                    ${p.name} (Qtd disponível: ${p.quantity})
                </label>
                <input type="number" class="qtd-req" min="1" max="${p.quantity}" placeholder="Qtd">
            `;
            container.appendChild(div);
        });
    }

    async salvarRequisicao() {
        const departamento = document.getElementById("departamento").value;
        const itens = [];
        const checkboxes = document.querySelectorAll("#produtosRequisicao input[type=checkbox]:checked");

        checkboxes.forEach((cb, i) => {
            const qtdInput = cb.parentElement.parentElement.querySelector(".qtd-req");
            if (qtdInput && qtdInput.value > 0) {
                itens.push({
                    code: cb.value,
                    quantidade: parseInt(qtdInput.value)
                });
            }
        });

        if (itens.length === 0) {
            alert("Selecione ao menos 1 produto com quantidade.");
            return;
        }

        const requisicao = {
            departamento,
            itens,
            data: new Date().toISOString(),
            status: "Pendente"
        };

        // 🔹 Salvar no Firestore
        // await addDoc(collection(db, "requisicoes"), requisicao);

        this.requisicoes.push(requisicao);
        this.renderRequisicoes();

        this.inventory.closeModal("requisicaoModal");
    }

    renderRequisicoes() {
        const list = document.getElementById("requisicoesList");
        list.innerHTML = "";

        if (this.requisicoes.length === 0) {
            list.innerHTML = `<p>Nenhuma requisição registrada.</p>`;
            return;
        }

        this.requisicoes.forEach(r => {
            const div = document.createElement("div");
            div.classList.add("requisicao-card");
            div.innerHTML = `
                <h4>${r.departamento}</h4>
                <p><strong>Status:</strong> ${r.status}</p>
                <ul>
                    ${r.itens.map(i => `<li>${i.code} - Qtd: ${i.quantidade}</li>`).join("")}
                </ul>
                <small>${new Date(r.data).toLocaleString()}</small>
            `;
            list.appendChild(div);
        });
    }
}

// ====================
// Controle das abas
// ====================
function setupTabs() {
    const buttons = document.querySelectorAll(".tab-btn");
    const contents = document.querySelectorAll(".tab-content");

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            buttons.forEach(b => b.classList.remove("active"));
            contents.forEach(c => c.classList.remove("active"));

            btn.classList.add("active");
            document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
        });
    });
}

// ====================
// Inicialização
// ====================
const inventorySystem = new InventorySystem();
const requisitionSystem = new RequisitionSystem(inventorySystem);
setupTabs();


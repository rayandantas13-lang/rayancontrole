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
        
        // Variáveis para controle do relatório
        this.currentReportType = null;
        this.currentPeriod = null;
        this.currentFormat = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.setupAuthListener();
    }

    // ===================== SISTEMA DE RELATÓRIOS =====================
    
    // Menu dropdown functionality
    setupMenuDropdown() {
        const menuBtn = document.querySelector('.menu-btn');
        const dropdownContent = document.querySelector('.dropdown-content');
        
        if (menuBtn && dropdownContent) {
            menuBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                dropdownContent.classList.toggle('show');
            });
            
            // Fechar dropdown ao clicar fora
            document.addEventListener('click', function() {
                dropdownContent.classList.remove('show');
            });
        }
    }

    // Modal de relatório
    openReportModal() {
        const modal = document.getElementById('reportModal');
        if (modal) {
            modal.classList.add('active');
            document.querySelector('.modal-overlay').classList.add('active');
            
            // Reset selections
            this.resetReportSelections();
        }
    }

    closeReportModal() {
        const modal = document.getElementById('reportModal');
        if (modal) {
            modal.classList.remove('active');
            document.querySelector('.modal-overlay').classList.remove('active');
        }
    }

    resetReportSelections() {
        this.currentReportType = null;
        this.currentPeriod = null;
        this.currentFormat = null;
        
        // Reset visual selections
        document.querySelectorAll('.report-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        document.querySelectorAll('.period-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        document.querySelectorAll('.format-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        const customPeriod = document.getElementById('customPeriod');
        if (customPeriod) customPeriod.classList.add('hidden');
    }

    selectReportType(type) {
        this.currentReportType = type;
        
        document.querySelectorAll('.report-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        event.currentTarget.classList.add('selected');
    }

    selectPeriod(period) {
        this.currentPeriod = period;
        
        document.querySelectorAll('.period-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        event.currentTarget.classList.add('selected');
        
        // Mostrar/ocultar período personalizado
        const customPeriod = document.getElementById('customPeriod');
        if (customPeriod) {
            if (period === 'custom') {
                customPeriod.classList.remove('hidden');
            } else {
                customPeriod.classList.add('hidden');
            }
        }
    }

    selectFormat(format) {
        this.currentFormat = format;
        
        document.querySelectorAll('.format-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        event.currentTarget.classList.add('selected');
    }

    async generateReport() {
        // Validar seleções
        if (!this.currentReportType || !this.currentPeriod || !this.currentFormat) {
            alert('Por favor, selecione todas as opções do relatório.');
            return;
        }
        
        // Validar período personalizado
        if (this.currentPeriod === 'custom') {
            const startDate = document.getElementById('startDate');
            const endDate = document.getElementById('endDate');
            
            if (!startDate || !endDate || !startDate.value || !endDate.value) {
                alert('Por favor, selecione ambas as datas para o período personalizado.');
                return;
            }
            
            if (new Date(startDate.value) > new Date(endDate.value)) {
                alert('A data inicial não pode ser maior que a data final.');
                return;
            }
        }
        
        // Mostrar loading
        const modalBody = document.querySelector('.report-modal .modal-body');
        const originalContent = modalBody.innerHTML;
        
        modalBody.innerHTML = `
            <div class="report-loading">
                <div class="loading-spinner"></div>
                <h4>Gerando Relatório...</h4>
                <p>Por favor, aguarde enquanto preparamos seu relatório.</p>
            </div>
        `;
        
        try {
            // Coletar dados para o relatório
            const reportData = await this.prepareReportData();
            
            if (this.currentFormat === 'pdf') {
                await this.generatePDFReport(reportData);
            } else {
                await this.generateExcelReport(reportData);
            }
            
            // Restaurar conteúdo original
            modalBody.innerHTML = originalContent;
            this.closeReportModal();
            
            // Feedback para o usuário
            alert(`Relatório gerado com sucesso em formato ${this.currentFormat.toUpperCase()}!`);
            
        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            alert('Erro ao gerar relatório. Por favor, tente novamente.');
            
            // Restaurar conteúdo original em caso de erro
            modalBody.innerHTML = originalContent;
        }
    }

    async prepareReportData() {
    const reportData = {
        type: this.currentReportType,
        period: this.currentPeriod,
        generatedAt: new Date().toLocaleString('pt-BR'),
        generatedBy: this.currentUser?.email || 'Sistema',
        data: []
    };
    
    // Adicionar dados de período personalizado se aplicável
    if (this.currentPeriod === 'custom') {
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        if (startDate && endDate) {
            reportData.startDate = startDate.value;
            reportData.endDate = endDate.value;
        }
    }
    
    if (this.currentReportType === 'products') {
        // Filtrar produtos por período se necessário
        let filteredProducts = this.products;
        
        if (this.currentPeriod !== 'all') {
            filteredProducts = this.filterProductsByPeriod(filteredProducts);
        }
        
        // ORGANIZAR POR SETOR
        const productsBySector = this.groupProductsBySector(filteredProducts);
        reportData.data = productsBySector;
        
    } else if (this.currentReportType === 'requisitions') {
        // Filtrar requisições por período se necessário
        let filteredRequisitions = this.requisitions;
        
        if (this.currentPeriod !== 'all') {
            filteredRequisitions = this.filterRequisitionsByPeriod(filteredRequisitions);
        }
        
        reportData.data = filteredRequisitions.map(requisition => ({
            id: requisition.id,
            status: requisition.status,
            totalRequested: requisition.totalRequested,
            finalizedQuantity: requisition.finalizedQuantity,
            createdAt: requisition.createdAt,
            createdBy: requisition.createdBy,
            description: requisition.description,
            local: requisition.local,
            products: requisition.products || []
        }));
    }
    
    return reportData;
}

// ADICIONE ESTE MÉTODO PARA AGRUPAR POR SETOR
groupProductsBySector(products) {
    const sectors = {};
    
    products.forEach(product => {
        const sector = product.local || 'Sem Setor';
        
        if (!sectors[sector]) {
            sectors[sector] = {
                sectorName: sector,
                products: []
            };
        }
        
        sectors[sector].products.push({
            id: product.id,
            name: product.name,
            code: product.code,
            quantity: product.quantity,
            local: product.local,
            description: product.description,
            lastUpdated: product.lastUpdated,
            lotes: product.lotes || [],
            expiryStatus: this.getProductExpiryStatus(product.lotes)
        });
    });
    
    // Ordenar setores alfabeticamente
    return Object.values(sectors).sort((a, b) => 
        a.sectorName.localeCompare(b.sectorName)
    );
}

    getPeriodDateRange() {
        const today = new Date();
        let startDate, endDate;
        
        switch (this.currentPeriod) {
            case 'today':
                startDate = new Date(today);
                endDate = new Date(today);
                break;
            case 'week':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - today.getDay());
                endDate = new Date(today);
                endDate.setDate(today.getDate() + (6 - today.getDay()));
                break;
            case 'month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'quarter':
                const quarter = Math.floor(today.getMonth() / 3);
                startDate = new Date(today.getFullYear(), quarter * 3, 1);
                endDate = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
                break;
            case 'year':
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = new Date(today.getFullYear(), 11, 31);
                break;
            case 'custom':
                const startInput = document.getElementById('startDate');
                const endInput = document.getElementById('endDate');
                if (startInput && endInput && startInput.value && endInput.value) {
                    startDate = new Date(startInput.value);
                    endDate = new Date(endInput.value);
                } else {
                    return null;
                }
                break;
            default:
                return null;
        }
        
        // Ajustar para incluir todo o dia final
        endDate.setHours(23, 59, 59, 999);
        
        return { startDate, endDate };
    }

    convertToISODate(dateString) {
        // Converter de DD/MM/YYYY para YYYY-MM-DD
        const parts = dateString.split('/');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateString;
    }

    async generatePDFReport(data) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configurações do documento
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let yPosition = margin;
        
        // ========== CABEÇALHO CORRIGIDO ==========
        doc.setFillColor(139, 92, 246); // Cor primária do tema
        doc.rect(0, 0, pageWidth, 50, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('RELATÓRIO DE ESTOQUE - ALMOXARIFADO', pageWidth / 2, 25, { align: 'center' });
        
        // Informações do relatório
        yPosition = 70;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        
        const reportType = data.type === 'products' ? 'Produtos em Estoque' : 'Produtos Requisitados';
        const periodLabel = this.getPeriodLabel(data.period);
        
        doc.text(`Tipo do Relatório: ${reportType}`, margin, yPosition);
        yPosition += 8;
        doc.text(`Período: ${periodLabel}`, margin, yPosition);
        yPosition += 8;
        
        // Data de geração - CORRIGIDA
        const generatedAt = new Date().toLocaleDateString('pt-BR') + ' ' + 
                           new Date().toLocaleTimeString('pt-BR', { 
                               hour: '2-digit', 
                               minute: '2-digit',
                               hour12: false 
                           });
        doc.text(`Gerado em: ${generatedAt}`, margin, yPosition);
        yPosition += 8;
        doc.text(`Gerado por: ${data.generatedBy || 'Sistema'}`, margin, yPosition);
        yPosition += 20;
        
        // Resto do código permanece igual...
        if (data.type === 'products') {
            await this.generateProductsPDF(doc, data, margin, pageWidth, yPosition);
        } else {
            await this.generateRequisitionsPDF(doc, data, margin, pageWidth, yPosition);
        }
        
        // Salvar o PDF
        const fileName = `relatorio_${data.type}_${new Date().getTime()}.pdf`;
        doc.save(fileName);
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        throw new Error('Falha ao gerar PDF');
    }
}

   async generateProductsPDF(doc, data, margin, pageWidth, yPosition) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUTOS EM ESTOQUE - ORGANIZADO POR SETOR', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 25;
    
    if (data.data.length === 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Nenhum produto encontrado para o período selecionado.', margin, yPosition);
        return;
    }
    
    // Configurações de layout melhoradas
    const lineHeight = 12;
    const rowHeight = 18;
    const headerHeight = 16;
    const pageHeight = doc.internal.pageSize.getHeight();
    const sectorSpacing = 25; // Espaço entre setores
    
    // PERCORRER CADA SETOR
    data.data.forEach((sectorData, sectorIndex) => {
        // Verificar se precisa de nova página antes de começar um novo setor
        if (yPosition > pageHeight - 100) {
            doc.addPage();
            yPosition = margin;
        }
        
        // ========== CABEÇALHO DO SETOR ==========
        doc.setFillColor(79, 70, 229); // Azul escuro para setores
        doc.rect(margin, yPosition, pageWidth - 2 * margin, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        
        doc.text(`SETOR: ${sectorData.sectorName.toUpperCase()}`, margin + 10, yPosition + 12);
        
        yPosition += 25;
        
        // ========== CABEÇALHO DA TABELA DO SETOR ==========
        if (sectorData.products.length > 0) {
            doc.setFillColor(200, 200, 200);
            doc.rect(margin, yPosition, pageWidth - 2 * margin, headerHeight, 'F');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            
            const colWidth = (pageWidth - 2 * margin) / 5;
            doc.text('CÓDIGO', margin + 5, yPosition + 10);
            doc.text('NOME DO PRODUTO', margin + colWidth + 5, yPosition + 10);
            doc.text('QUANTIDADE', margin + 2 * colWidth + 5, yPosition + 10);
            doc.text('STATUS', margin + 3 * colWidth + 5, yPosition + 10);
            doc.text('ÚLT. ATUAL.', margin + 4 * colWidth + 5, yPosition + 10);
            
            yPosition += headerHeight + 5;
            
            // ========== PRODUTOS DO SETOR ==========
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            
            sectorData.products.forEach((product, productIndex) => {
                // Verificar se precisa de nova página
                if (yPosition + rowHeight > pageHeight - margin) {
                    doc.addPage();
                    yPosition = margin;
                    
                    // Redesenhar cabeçalho do setor na nova página
                    doc.setFillColor(79, 70, 229);
                    doc.rect(margin, yPosition, pageWidth - 2 * margin, 20, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(14);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`SETOR: ${sectorData.sectorName.toUpperCase()} (Continuação)`, margin + 10, yPosition + 12);
                    yPosition += 25;
                    
                    // Redesenhar cabeçalho da tabela
                    doc.setFillColor(200, 200, 200);
                    doc.rect(margin, yPosition, pageWidth - 2 * margin, headerHeight, 'F');
                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    
                    doc.text('CÓDIGO', margin + 5, yPosition + 10);
                    doc.text('NOME DO PRODUTO', margin + colWidth + 5, yPosition + 10);
                    doc.text('QUANTIDADE', margin + 2 * colWidth + 5, yPosition + 10);
                    doc.text('STATUS', margin + 3 * colWidth + 5, yPosition + 10);
                    doc.text('ÚLT. ATUAL.', margin + 4 * colWidth + 5, yPosition + 10);
                    
                    yPosition += headerHeight + 5;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                }
                
                // Texto com posicionamento vertical melhorado
                const textY = yPosition + 8;
                doc.text(product.code || '-', margin + 5, textY);
                
                // Quebrar texto longo do nome em múltiplas linhas
                const productName = product.name || '-';
                const maxNameWidth = colWidth - 10;
                const nameLines = doc.splitTextToSize(productName, maxNameWidth);
                
                if (nameLines.length > 1) {
                    doc.text(nameLines[0], margin + colWidth + 5, textY);
                    doc.text(nameLines[1], margin + colWidth + 5, textY + 5);
                } else {
                    doc.text(productName, margin + colWidth + 5, textY);
                }
                
                doc.text(this.formatNumber(product.quantity || 0), margin + 2 * colWidth + 5, textY);
                doc.text(product.expiryStatus?.label || '-', margin + 3 * colWidth + 5, textY);
                doc.text(product.lastUpdated || '-', margin + 4 * colWidth + 5, textY);
                
                // Ajustar altura baseado no número de linhas do nome
                const actualRowHeight = nameLines.length > 1 ? rowHeight + 5 : rowHeight;
                yPosition += actualRowHeight;
            });
            
            // ========== RESUMO DO SETOR ==========
            yPosition += 10;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            const sectorTotal = sectorData.products.reduce((sum, product) => sum + (product.quantity || 0), 0);
            doc.text(`Total do Setor: ${this.formatNumber(sectorData.products.length)} produtos, ${this.formatNumber(sectorTotal)} itens`, margin, yPosition);
            
            yPosition += sectorSpacing;
        }
    });
    
    // ========== RESUMO GERAL ==========
    if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
    }
    
    yPosition += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    
    const totalProducts = data.data.reduce((sum, sector) => sum + sector.products.length, 0);
    const totalQuantity = data.data.reduce((sum, sector) => 
        sum + sector.products.reduce((sectorSum, product) => sectorSum + (product.quantity || 0), 0), 0
    );
    
    doc.text(`RESUMO GERAL:`, margin, yPosition);
    yPosition += 12;
    doc.text(`• ${this.formatNumber(data.data.length)} Setores`, margin + 10, yPosition);
    yPosition += 10;
    doc.text(`• ${this.formatNumber(totalProducts)} Produtos`, margin + 10, yPosition);
    yPosition += 10;
    doc.text(`• ${this.formatNumber(totalQuantity)} Itens em Estoque`, margin + 10, yPosition);
}

async generateRequisitionsPDF(doc, data, margin, pageWidth, yPosition) {
    // Configurar fonte que suporte caracteres portugueses
    doc.setFont('helvetica');
    
    // Cabeçalho principal
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUTOS REQUISITADOS', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 25;
    
    if (data.data.length === 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Nenhuma requisição encontrada para o período selecionado.', margin, yPosition);
        return;
    }
    
    const pageHeight = doc.internal.pageSize.getHeight();
    
    data.data.forEach((requisition, reqIndex) => {
        // Verificar se precisa de nova página
        if (yPosition > pageHeight - 150) {
            doc.addPage();
            yPosition = margin;
        }
        
        // ========== CABEÇALHO DA REQUISIÇÃO ==========
doc.setFillColor(139, 92, 246); // Cor roxa do tema
doc.rect(margin, yPosition, pageWidth - 2 * margin, 35, 'F'); // Aumentei a altura para 35
doc.setTextColor(255, 255, 255);
doc.setFontSize(12);
doc.setFont('helvetica', 'bold');

// Número da requisição - CORRIGIDO
const requisitionId = requisition.id || 'N/A';
doc.text(`Requisição #${requisitionId}`, margin + 10, yPosition + 10);

// Status
const status = requisition.status || 'Pendente';
doc.text(`Status: ${status}`, margin + 120, yPosition + 10);

// Data - EM LINHA SEPARADA
const createdAt = requisition.createdAt ? 
    new Date(requisition.createdAt).toLocaleDateString('pt-BR') : 
    'Data não disponível';
doc.text(`Data: ${createdAt}`, margin + 10, yPosition + 25); // Mudei para linha abaixo

yPosition += 40; // Aumentei para 40 para acomodar as duas linhas
        
        // ========== INFORMAÇÕES ADICIONAIS ==========
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        // Informações do solicitante
        if (requisition.createdBy) {
            doc.text(`Solicitante: ${requisition.createdBy}`, margin + 10, yPosition);
            yPosition += 8;
        }
        
        if (requisition.description) {
            const descLines = doc.splitTextToSize(`Descrição: ${requisition.description}`, pageWidth - 2 * margin - 20);
            doc.text(descLines, margin + 10, yPosition);
            yPosition += descLines.length * 6 + 5;
        }
        
        yPosition += 10;
        
        // ========== CABEÇALHO DA TABELA DE PRODUTOS ==========
        doc.setFillColor(200, 200, 200);
        doc.rect(margin, yPosition, pageWidth - 2 * margin, 12, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        
        const colWidth = (pageWidth - 2 * margin) / 4;
        doc.text('PRODUTO', margin + 5, yPosition + 8);
        doc.text('CÓDIGO', margin + colWidth + 5, yPosition + 8);
        doc.text('REQUISITADO', margin + 2 * colWidth + 5, yPosition + 8);
        doc.text('DISPONÍVEL', margin + 3 * colWidth + 5, yPosition + 8);
        
        yPosition += 15;
        
        // ========== LISTA DE PRODUTOS ==========
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        
        requisition.products.forEach((product, prodIndex) => {
            // Verificar espaço para próximo produto
            if (yPosition > pageHeight - 20) {
                doc.addPage();
                yPosition = margin;
                
                // Redesenhar cabeçalho na nova página
                doc.setFillColor(200, 200, 200);
                doc.rect(margin, yPosition, pageWidth - 2 * margin, 12, 'F');
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                
                doc.text('PRODUTO', margin + 5, yPosition + 8);
                doc.text('CÓDIGO', margin + colWidth + 5, yPosition + 8);
                doc.text('REQUISITADO', margin + 2 * colWidth + 5, yPosition + 8);
                doc.text('DISPONÍVEL', margin + 3 * colWidth + 5, yPosition + 8);
                
                yPosition += 15;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
            }
            
            // Nome do produto (com quebra de linha se necessário)
            const productName = product.name || 'Produto não informado';
            const nameLines = doc.splitTextToSize(productName, colWidth - 10);
            
            // Código do produto
            const productCode = product.code || 'N/A';
            
            // Quantidades
            const requestedQty = this.formatNumber(product.requestedQuantity || 0);
            const availableQty = this.formatNumber(product.availableQuantity || 0);
            
            // Desenhar primeira linha
            doc.text(nameLines[0], margin + 5, yPosition + 6);
            doc.text(productCode, margin + colWidth + 5, yPosition + 6);
            doc.text(requestedQty, margin + 2 * colWidth + 5, yPosition + 6);
            doc.text(availableQty, margin + 3 * colWidth + 5, yPosition + 6);
            
            // Se o nome tiver múltiplas linhas, ajustar altura
            if (nameLines.length > 1) {
                yPosition += 6;
                doc.text(nameLines[1], margin + 5, yPosition + 6);
            }
            
            yPosition += 12; // Espaçamento entre produtos
        });
        
        yPosition += 15; // Espaço entre requisições
        
        // ========== RESUMO DA REQUISIÇÃO ==========
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total de itens requisitados: ${this.formatNumber(requisition.totalRequested || 0)}`, margin, yPosition);
        
        yPosition += 20; // Espaço para próxima requisição
    });
    
    // ========== RESUMO GERAL ==========
    if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
    }
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de Requisições: ${this.formatNumber(data.data.length)}`, margin, yPosition);
    yPosition += 12;
    
    const totalRequested = data.data.reduce((sum, req) => sum + (req.totalRequested || 0), 0);
    doc.text(`Total Geral de Itens: ${this.formatNumber(totalRequested)}`, margin, yPosition);
}

    getPeriodLabel(period) {
        const labels = {
            'today': 'Hoje',
            'week': 'Esta Semana',
            'month': 'Este Mês',
            'quarter': 'Este Trimestre',
            'year': 'Este Ano',
            'all': 'Todo Período',
            'custom': 'Personalizado'
        };
        return labels[period] || period;
    }

    async generateExcelReport(data) {
    try {
        // Criar workbook
        const wb = XLSX.utils.book_new();
        
        if (data.type === 'products') {
            // ORGANIZADO POR SETOR NO EXCEL
            data.data.forEach((sectorData, sectorIndex) => {
                // Preparar dados para produtos do setor
                const excelData = sectorData.products.map(product => ({
                    'Código': product.code,
                    'Nome do Produto': product.name,
                    'Quantidade': product.quantity,
                    'Descrição': product.description,
                    'Última Atualização': product.lastUpdated,
                    'Status Validade': product.expiryStatus?.label,
                    'Número de Lotes': product.lotes?.length || 0
                }));
                
                // Nome da aba baseado no setor (limitado a 31 caracteres)
                let sheetName = sectorData.sectorName || 'Sem Setor';
                sheetName = sheetName.substring(0, 31); // Excel limita a 31 caracteres
                
                // Se o nome for muito longo, adicionar número
                if (sheetName.length === 31) {
                    sheetName = sheetName.substring(0, 28) + '...';
                }
                
                // Garantir nomes únicos
                let finalSheetName = sheetName;
                let counter = 1;
                while (wb.SheetNames.includes(finalSheetName)) {
                    finalSheetName = `${sheetName.substring(0, 26)}_${counter}`;
                    counter++;
                }
                
                const ws = XLSX.utils.json_to_sheet(excelData);
                XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
                
                // Adicionar cabeçalho do setor como primeira linha
                if (excelData.length > 0) {
                    XLSX.utils.sheet_add_aoa(ws, [[`SETOR: ${sectorData.sectorName}`]], { origin: -1 });
                    XLSX.utils.sheet_add_aoa(ws, [['']], { origin: -1 }); // Linha em branco
                }
            });
            
            // Se não houver produtos, criar uma aba vazia
            if (data.data.length === 0) {
                const ws = XLSX.utils.aoa_to_sheet([['Nenhum produto encontrado']]);
                XLSX.utils.book_append_sheet(wb, ws, "Sem Dados");
            }
            
        } else {
            // Preparar dados para requisições (mantém igual)
            const excelData = data.data.map(requisition => ({
                'ID Requisição': requisition.id,
                'Status': requisition.status,
                'Total Requisitado': requisition.totalRequested,
                'Quantidade Finalizada': requisition.finalizedQuantity || 0,
                'Data': this.formatDateTime(requisition.createdAt),
                'Solicitante': requisition.createdBy,
                'Descrição': requisition.description,
                'Setor': requisition.local,
                'Número de Produtos': requisition.products?.length || 0
            }));
            
            const ws = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.book_append_sheet(wb, ws, "Requisições");
        }
        
        // Salvar o arquivo
        const fileName = `relatorio_${data.type}_${new Date().getTime()}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
    } catch (error) {
        console.error('Erro ao gerar Excel:', error);
        throw new Error('Falha ao gerar Excel');
    }
}

    logout() {
        if (confirm('Tem certeza que deseja sair do sistema?')) {
            this.logout();
        }
    }

    // ===================== FIM DO SISTEMA DE RELATÓRIOS =====================

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

        // Menu dropdown
        this.setupMenuDropdown();

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

        // Event listeners para o sistema de relatórios
        const reportModal = document.getElementById('reportModal');
        if (reportModal) {
            // Prevenir fechamento do modal ao clicar dentro do conteúdo
            reportModal.querySelector('.modal-content').addEventListener('click', function(e) {
                e.stopPropagation();
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
            
            const matchesSearch = name.includes(term) || details.includes(term);
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

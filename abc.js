document.addEventListener("DOMContentLoaded", () => {
    
    const API_BASE_URL = "https://backend-sistema-comprass.onrender.com";
    
    // --- ELEMENTOS DO DOM ---
    const filtroArea = document.getElementById('filtro-area-abc');
    const filtroAno = document.getElementById('filtro-ano'); 
    const btnAnalisar = document.getElementById('btn-analisar-abc');
    
    // Botões de Exportação
    const exportButtons = document.getElementById('export-buttons');
    const btnExcel = document.getElementById('btn-excel');
    const btnPdf = document.getElementById('btn-pdf');
    
    // Containers
    const chartContainer = document.getElementById('chart-container-abc');
    const tableContainer = document.getElementById('table-container-abc');
    const corpoTabelaAbc = document.getElementById('corpo-tabela-abc');
    const ctxPareto = document.getElementById('grafico-pareto');
    
    let graficoParetoInstance = null;
    let dadosAtuaisParaExportacao = [];

    // --- FUNÇÕES AUXILIARES ---

    function formatarDinheiro(valor) {
        if (!valor && valor !== 0) return "R$ 0,00";
        return "R$ " + valor.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    }

    function calcularClasse(item, todosItens) {
        const total = todosItens.reduce((acc, i) => acc + i.valorTotal, 0);
        let accValor = 0;
        for (let i = 0; i < todosItens.length; i++) {
            accValor += todosItens[i].valorTotal;
            if (todosItens[i] === item) {
                const perc = (accValor / total) * 100;
                return perc <= 80 ? 'A' : (perc <= 95 ? 'B' : 'C');
            }
        }
        return 'C';
    }

    // --- INICIALIZAÇÃO (COM SEGURANÇA) ---

    async function carregarFiltrosDeAnos() {
        try {
            // 1. PEGA O TOKEN
            const token = localStorage.getItem("authToken");
            if (!token) {
                window.location.href = "login.html";
                return;
            }

            // 2. ENVIA TOKEN NO FETCH
            const response = await fetch(`${API_BASE_URL}/api/pedidos/anos-distintos`, {
                headers: { "Authorization": token }
            });

            if (response.status === 401 || response.status === 403) {
                alert("Sessão expirada. Faça login novamente.");
                window.location.href = "login.html";
                return;
            }

            if (!response.ok) throw new Error("Erro API Anos");
            const anos = await response.json(); 
            
            filtroAno.innerHTML = '<option value="todos">Todos</option>';
            if (anos && anos.length > 0) {
                anos.forEach(ano => {
                    const option = document.createElement('option');
                    option.value = ano;
                    option.textContent = ano;
                    filtroAno.appendChild(option);
                });
                filtroAno.value = anos[0]; 
            }
        } catch (error) { console.warn(error); }
    }

    // --- LÓGICA DE BUSCA (COM SEGURANÇA) ---

    async function analisarCurvaAbc() {
        const area = filtroArea.value;
        const ano = filtroAno.value;
        
        if (!area) {
            Swal.fire('Atenção', 'Selecione uma Área para analisar.', 'warning');
            return;
        }

        const token = localStorage.getItem("authToken"); // <--- TOKEN AQUI
        if (!token) { window.location.href = "login.html"; return; }

        const textoOriginal = btnAnalisar.textContent;
        btnAnalisar.textContent = "Processando...";
        btnAnalisar.disabled = true;
        if(exportButtons) exportButtons.style.display = 'none';

        const endpoint = "/api/bi/curva-abc-unificada";
        const params = `ano=${ano}&area=${encodeURIComponent(area)}`;
        
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}?${params}`, {
                headers: { "Authorization": token } // <--- TOKEN NO HEADER
            });

            if (response.status === 401) {
                window.location.href = "login.html";
                return;
            }

            if (!response.ok) throw new Error("Erro API");
            
            const dados = await response.json();
            
            if (dados.length === 0) {
                chartContainer.style.display = 'none';
                tableContainer.style.display = 'none';
                Swal.fire('Vazio', 'Sem dados para este filtro.', 'info');
            } else {
                dadosAtuaisParaExportacao = dados; 

                renderizarTabela(dados);
                renderizarGraficoPareto(dados);
                
                chartContainer.style.display = 'block';
                tableContainer.style.display = 'block';
                if(exportButtons) exportButtons.style.display = 'flex';
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Erro', "Falha técnica no servidor (Verifique a conexão).", 'error');
        } finally {
            btnAnalisar.textContent = textoOriginal;
            btnAnalisar.disabled = false;
        }
    }

    // --- RENDERS ---

    function renderizarGraficoPareto(itens) {
        const topItens = itens.slice(0, 30); 
        const labels = topItens.map(i => i.descricaoItem.length > 20 ? i.descricaoItem.substring(0, 20) + '...' : i.descricaoItem);
        const dadosValor = topItens.map(i => i.valorTotal);
        const totalGeral = itens.reduce((acc, i) => acc + i.valorTotal, 0);
        let acumulado = 0;
        const dadosPercent = topItens.map(i => { acumulado += i.valorTotal; return (acumulado / totalGeral) * 100; });

        if (graficoParetoInstance) graficoParetoInstance.destroy();

        graficoParetoInstance = new Chart(ctxPareto, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { type: 'line', label: '% Acumulada', data: dadosPercent, borderColor: '#FF6384', borderWidth: 2, yAxisID: 'yB', tension: 0.1 },
                    { type: 'bar', label: 'Valor (R$)', data: dadosValor, backgroundColor: '#36A2EB', yAxisID: 'yA' }
                ]
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false, // <--- IMPORTANTE
                scales: {
                    yA: { type: 'linear', position: 'left', ticks: { callback: v => 'R$ ' + v.toLocaleString('pt-BR', {notation: 'compact'}) } },
                    yB: { type: 'linear', position: 'right', min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { display: false } }
                }
            }
        });
    }

    function renderizarTabela(itens) {
        corpoTabelaAbc.innerHTML = "";
        let acumuladoValor = 0;
        const totalGeral = itens.reduce((acc, i) => acc + i.valorTotal, 0);

        itens.forEach(item => {
            acumuladoValor += item.valorTotal;
            const percent = (item.valorTotal / totalGeral) * 100;
            const acc = (acumuladoValor / totalGeral) * 100;
            let classe = acc <= 80 ? 'A' : (acc <= 95 ? 'B' : 'C');
            let cor = classe === 'A' ? '#d4edda' : (classe === 'B' ? '#fff3cd' : '#f8d7da');

            const tr = document.createElement('tr');
            tr.style.backgroundColor = cor;
            tr.innerHTML = `<td>${item.descricaoItem}</td><td>${item.areaItem || '-'}</td><td>${formatarDinheiro(item.valorTotal)}</td><td>${percent.toFixed(2)}%</td><td>${acc.toFixed(2)}%</td><td>${classe}</td>`;
            corpoTabelaAbc.appendChild(tr);
        });
    }

    // --- EXPORTAÇÃO EXCEL ---
    if(btnExcel) {
        btnExcel.addEventListener('click', () => {
            if (!dadosAtuaisParaExportacao.length) return;
            const dadosFormatados = dadosAtuaisParaExportacao.map(item => ({
                "Descrição": item.descricaoItem,
                "Área": item.areaItem,
                "Valor Total": item.valorTotal,
                "Classificação": calcularClasse(item, dadosAtuaisParaExportacao)
            }));
            const worksheet = XLSX.utils.json_to_sheet(dadosFormatados);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Curva ABC");
            XLSX.writeFile(workbook, `Relatorio_ABC_${filtroArea.value}.xlsx`);
        });
    }

    // --- EXPORTAÇÃO PDF (PROFISSIONAL) ---
    if(btnPdf) {
        btnPdf.addEventListener('click', () => {
            if (!dadosAtuaisParaExportacao.length) return;
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const dataHora = new Date().toLocaleString('pt-BR');

            // 1. CABEÇALHO
            doc.setFillColor(41, 128, 185);
            doc.rect(0, 0, 210, 20, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text(`Relatório de Curva ABC`, 10, 13);
            doc.setFontSize(10);
            doc.text(`Área: ${filtroArea.value} | Ano: ${filtroAno.value}`, 200, 13, { align: 'right' });

            // 2. RESUMO EXECUTIVO
            const totalGeral = dadosAtuaisParaExportacao.reduce((acc, i) => acc + i.valorTotal, 0);
            const itensClasseA = dadosAtuaisParaExportacao.filter(i => calcularClasse(i, dadosAtuaisParaExportacao) === 'A').length;
            const totalItens = dadosAtuaisParaExportacao.length;

            doc.setTextColor(0, 0, 0);
            doc.text(`Resumo Gerencial:`, 14, 30);
            
            doc.setDrawColor(200);
            doc.setFillColor(245, 245, 245);
            doc.rect(14, 33, 180, 15, 'FD');
            
            doc.text(`Total Gasto: ${totalGeral.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`, 20, 42);
            doc.text(`Itens Classe A: ${itensClasseA} (de ${totalItens})`, 90, 42);
            doc.text(`Emissão: ${dataHora}`, 140, 42);

            // 3. GRÁFICO (IMAGEM)
            const canvas = document.getElementById('grafico-pareto');
            const imgData = canvas.toDataURL('image/png', 1.0);
            doc.addImage(imgData, 'PNG', 15, 55, 180, 80);

            // 4. TABELA COLORIDA
            const colunas = ["Descrição", "Valor (R$)", "%", "% Acum", "Classe"];
            let acumulado = 0;

            const linhas = dadosAtuaisParaExportacao.map(item => {
                acumulado += item.valorTotal;
                let classe = (acumulado / totalGeral) * 100 <= 80 ? 'A' : ((acumulado / totalGeral) * 100 <= 95 ? 'B' : 'C');
                return [
                    item.descricaoItem,
                    item.valorTotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}),
                    ((item.valorTotal / totalGeral) * 100).toFixed(2) + '%',
                    ((acumulado / totalGeral) * 100).toFixed(2) + '%',
                    classe
                ];
            });

            doc.autoTable({
                head: [colunas],
                body: linhas,
                startY: 140, 
                theme: 'grid',
                headStyles: { fillColor: [52, 58, 64] },
                styles: { fontSize: 9, cellPadding: 2 },
                
                didParseCell: function(data) {
                    if (data.section === 'body') {
                        let classe = data.row.raw[4];
                        if (classe === 'A') {
                            data.cell.styles.fillColor = [212, 237, 218];
                        } else if (classe === 'B') {
                            data.cell.styles.fillColor = [255, 243, 205];
                        } else {
                            data.cell.styles.fillColor = [248, 215, 218];
                        }
                    }
                }
            });

            // 5. RODAPÉ
            const finalY = doc.lastAutoTable.finalY || 140; 
            if (finalY < 250) {
                doc.setLineWidth(0.5);
                doc.line(60, finalY + 30, 150, finalY + 30);
                doc.text("Gestor Responsável", 105, finalY + 35, { align: 'center' });
            }

            const pageCount = doc.internal.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.text(`Página ${i} de ${pageCount}`, 105, 290, {align: 'center'});
            }

            doc.save(`Relatorio_ABC_Pro_${filtroArea.value}.pdf`);
        });
    }

    btnAnalisar.addEventListener('click', analisarCurvaAbc);
    carregarFiltrosDeAnos();
});

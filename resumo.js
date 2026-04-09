document.addEventListener("DOMContentLoaded", () => {
    
    const API_BASE_URL = "https://backend-sistema-comprass.onrender.com";
    
    // --- Referências do DOM ---
    const filtroAgrupamento = document.getElementById('filtro-agrupamento');
    const botaoRecalcular = document.getElementById('filtro-recalcular'); 
    const btnExportarExcel = document.getElementById('btn-exportar-excel'); 
    const btnDebug = document.getElementById('btn-debug-nao-classificados'); 
    const cabecalhoTabela = document.getElementById('cabecalho-tabela-mestre');
    const corpoTabela = document.getElementById('corpo-tabela-mestre');
    const ctxAnual = document.getElementById('grafico-anual');
    
    let graficoAnualInstance = null;
    let todosOsItens = []; 
    let anosParaRelatorio = []; 
    let itensNaoClassificados = []; 

    // -- Regras de Negócio (BI) --
    const LISTA_QUIMICA_COMPLETA = [
        "Química Air Liquide", "Química - Consumo geral", 
        "Química", "Química ICP Horiba",
        "Quimica" 
    ];
    const GRUPOS_DE_ANALISE = [
        "Admin geral", "Infra geral", "Microscopia", 
        "Partículas", 
        "Quimica", "DRX", "Projetos",
        "**Itens Não Classificados**" 
    ];

    // -- Definições dos Agrupamentos de Tempo --
    const definicoesAgrupamento = {
        "mensal": {
            colunas: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
            funcao: (mes) => definicoesAgrupamento.mensal.colunas[mes - 1] 
        },
        "bimestral": {
            colunas: ["Jan-Fev", "Mar-Abr", "Mai-Jun", "Jul-Ago", "Set-Out", "Nov-Dez"],
            funcao: (mes) => definicoesAgrupamento.bimestral.colunas[Math.floor((mes - 1) / 2)]
        },
        "trimestral": {
            colunas: ["Jan-Mar", "Abr-Jun", "Jul-Set", "Out-Dez"],
            funcao: (mes) => definicoesAgrupamento.trimestral.colunas[Math.floor((mes - 1) / 3)]
        },
        "semestral": {
            colunas: ["Semestre 1", "Semestre 2"],
            funcao: (mes) => (mes <= 6) ? "Semestre 1" : "Semestre 2"
        }
    };
    
    // ----- 1. FUNÇÃO DE FORMATAÇÃO (Helper) -----
    function formatarDinheiro(valor) {
        if (valor === 0) return "R$ -"; 
        return "R$ " + valor.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    }
    function parseDinheiro(str) {
        if (str === "R$ -") return 0;
        return parseFloat(str.replace("R$ ", "").replace(/\./g, "").replace(",", "."));
    }

    // ----- 2. CARREGAMENTO E PROCESSAMENTO INICIAL (COM SEGURANÇA) -----
    async function carregarDados() {
        try {
            // 1. PEGA O TOKEN
            const token = localStorage.getItem("authToken");
            if (!token) {
                window.location.href = "login.html";
                return;
            }

            // 2. FETCH COM HEADER
            const response = await fetch(API_BASE_URL + "/api/pedidos", {
                method: "GET",
                headers: {
                    "Authorization": token // <--- O CRACHÁ
                }
            });

            // 3. VERIFICAÇÃO DE SEGURANÇA
            if (response.status === 401 || response.status === 403) {
                alert("Sessão expirada. Faça login novamente.");
                window.location.href = "login.html";
                return;
            }

            if (!response.ok) throw new Error("Erro ao buscar dados dos pedidos.");
            
            const pedidos = await response.json();
            
            todosOsItens = [];
            pedidos.forEach(pedido => {
                if (!pedido || !pedido.dataEmissao) return; 
                
                pedido.itens.forEach(item => {
                    todosOsItens.push({
                        pcn: pedido.codigoPcn, 
                        dataCompra: pedido.dataEmissao, 
                        tipoCompra: pedido.tipoCompra, 
                        area: item.area, 
                        valor: item.valorTotal
                    });
                });
            });
            
            const anosNosDados = new Set(todosOsItens.map(item => item.dataCompra.substring(0, 4)));
            anosParaRelatorio = Array.from(anosNosDados).sort((a, b) => b - a).slice(0, 3);
            
            processarGraficoAnual(todosOsItens, anosParaRelatorio);
            gerarRelatorioMestre(); 

        } catch (error) {
            console.error("Erro detalhado ao carregar dados:", error); 
            Swal.fire('Erro', 'Não foi possível carregar os dados para o dashboard (Verifique login).', 'error');
        }
    }

    // ----- 3. LÓGICA DO GRÁFICO ANUAL -----
    function processarGraficoAnual(itens, anosParaRelatorio) {
        const gastosPorAno = {}; 
        anosParaRelatorio.forEach(ano => { gastosPorAno[ano] = 0; }); 
        itens.forEach(item => {
            const ano = item.dataCompra.substring(0, 4); 
            if (gastosPorAno.hasOwnProperty(ano)) { 
                gastosPorAno[ano] += item.valor;
            }
        });
        const labels = Object.keys(gastosPorAno).sort(); 
        const data = labels.map(ano => gastosPorAno[ano]); 
        
        if (graficoAnualInstance) { graficoAnualInstance.destroy(); }
        
        graficoAnualInstance = new Chart(ctxAnual, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Gasto (R$)',
                    data: data,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)', // Azul do Tema
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // <--- IMPORTANTE PARA NÃO QUEBRAR O LAYOUT
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        ticks: { callback: value => formatarDinheiro(value) }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: context => formatarDinheiro(context.parsed.y) }}
                }
            }
        });
    }

    // ----- 4. LÓGICA DA TABELA-MESTRE DINÂMICA -----
    
    function getGrupoAnalise(item) {
        // 1. Admin
        if (item.tipoCompra === "Escritorio e Uniformes") {
            return "Admin geral";
        }
        // 2. Infra
        if ( (item.area === "Geral - AC" && item.tipoCompra === "Equipamentos e Reformas") ||
             (item.area === "Manutenção geral" && item.tipoCompra === "Reembolsos") ||
             (item.area === "Outros" && item.tipoCompra === "Reembolsos") ) 
        {
            return "Infra geral";
        }
        // 3. Quimica
        if (LISTA_QUIMICA_COMPLETA.includes(item.area)) {
            return "Quimica";
        }
        // 4. Partículas
        if (item.area === "Partículas" || item.area === "Particulas") {
            return "Partículas"; 
        }
        // 5. Grupos Restantes
        if (["Microscopia", "DRX", "Projetos"].includes(item.area)) {
            return item.area;
        }

        itensNaoClassificados.push(item);
        console.warn("Item Não Classificado:", item); 
        return "**Itens Não Classificados**"; 
    }

    function gerarRelatorioMestre() {
        
        itensNaoClassificados = []; 
        
        const tipoAgrupamento = filtroAgrupamento.value;
        const definicao = definicoesAgrupamento[tipoAgrupamento];
        const colunasTempo = definicao.colunas;
        const getColunaFn = definicao.funcao;
        
        const relatorio = {};
        const totalGeral = {}; 

        // Inicializa
        GRUPOS_DE_ANALISE.forEach(grupo => {
            relatorio[grupo] = {};
            anosParaRelatorio.forEach(ano => {
                relatorio[grupo][ano] = { "Total": 0 };
                colunasTempo.forEach(col => relatorio[grupo][ano][col] = 0);
            });
        });
        anosParaRelatorio.forEach(ano => {
            totalGeral[ano] = { "Total": 0 };
            colunasTempo.forEach(col => totalGeral[ano][col] = 0);
        });
        
        // Preenche
        todosOsItens.forEach(item => {
            if (item.valor === undefined || item.valor === null) return;
            const ano = item.dataCompra.substring(0, 4);
            if (!anosParaRelatorio.includes(ano)) return; 
            const grupo = getGrupoAnalise(item);
            const mes = parseInt(item.dataCompra.substring(5, 7));
            const colunaTempo = getColunaFn(mes);
            if (grupo && colunaTempo) {
                relatorio[grupo][ano][colunaTempo] += item.valor;
                relatorio[grupo][ano]["Total"] += item.valor;
                totalGeral[ano][colunaTempo] += item.valor;
                totalGeral[ano]["Total"] += item.valor;
            }
        });
        
        // Renderiza Cabeçalho
        cabecalhoTabela.innerHTML = ""; 
        let headerHTML = "<tr><th rowspan='2'>Setor (Grupo)</th><th rowspan='2'>Ano</th>";
        headerHTML += `<th colspan="${colunasTempo.length}">Períodos (${tipoAgrupamento})</th>`;
        headerHTML += "<th rowspan='2'>Total (Ano)</th></tr>";
        headerHTML += "<tr>";
        colunasTempo.forEach(col => headerHTML += `<th>${col}</th>`);
        headerHTML += "</tr>";
        cabecalhoTabela.innerHTML = headerHTML;

        // Renderiza Corpo
        corpoTabela.innerHTML = "";
        GRUPOS_DE_ANALISE.forEach(grupo => {
            if (grupo.includes("**")) {
                 const totalNaoClassificado = anosParaRelatorio.reduce((acc, ano) => acc + relatorio[grupo][ano]["Total"], 0);
                 if (totalNaoClassificado === 0) {
                     btnDebug.style.display = 'none'; 
                     return;
                 } else {
                     btnDebug.style.display = 'inline-block'; 
                 }
            }
            anosParaRelatorio.forEach((ano, index) => {
                const dados = relatorio[grupo][ano];
                const tr = document.createElement('tr');
                let htmlLinha = "";
                if (index === 0) {
                    htmlLinha += `<td rowspan="${anosParaRelatorio.length}">${grupo.replace(/\*\*/g, '')}</td>`;
                }
                htmlLinha += `<td class="ano-cell">${ano}</td>`;
                colunasTempo.forEach(col => {
                    htmlLinha += `<td>${formatarDinheiro(dados[col])}</td>`;
                });
                htmlLinha += `<td>${formatarDinheiro(dados["Total"])}</td>`;
                tr.innerHTML = htmlLinha;
                if (grupo.includes("**")) {
                    tr.style.backgroundColor = "#fff3cd"; 
                    tr.style.color = "#856404";
                    tr.style.fontWeight = "bold";
                }
                corpoTabela.appendChild(tr);
            });
        });
        
        // Renderiza Rodapé
        anosParaRelatorio.forEach((ano, index) => {
            const dadosTotal = totalGeral[ano];
            const tr = document.createElement('tr');
            tr.className = 'total-geral-row';
            let htmlTotal = "";
            if (index === 0) { 
                 htmlTotal += `<td rowspan="${anosParaRelatorio.length}">Total</td>`;
            }
            htmlTotal += `<td class="ano-cell">${ano}</td>`;
            colunasTempo.forEach(col => {
                htmlTotal += `<td>${formatarDinheiro(dadosTotal[col])}</td>`;
            });
            htmlTotal += `<td>${formatarDinheiro(dadosTotal["Total"])}</td>`;
            tr.innerHTML = htmlTotal;
            corpoTabela.appendChild(tr);
        });
    }
    
    // ----- 5. LÓGICA DE EXPORTAÇÃO EXCEL -----
    function exportarParaExcel() {
        const tabela = document.getElementById('tabela-mestre');
        if (!tabela) {
            Swal.fire('Erro', 'A tabela de resumo não foi encontrada.', 'error');
            return;
        }
        const wb = XLSX.utils.table_to_book(tabela, { sheet: "Resumo Anual" });
        const ws = wb.Sheets["Resumo Anual"];
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = { c: C, r: R };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                const cell = ws[cell_ref];
                if (cell && cell.t === 's') {
                    const valor = cell.v;
                    if (valor.startsWith("R$ ")) {
                        const numero = parseDinheiro(valor); 
                        cell.t = 'n'; 
                        cell.v = numero;
                        cell.z = 'R$ #,##0.00'; 
                    }
                }
            }
        }
        const tipoAgrupamento = filtroAgrupamento.value;
        const nomeFicheiro = `Resumo_BI_${tipoAgrupamento}.xlsx`;
        XLSX.writeFile(wb, nomeFicheiro);
    }

    // ----- 6. FUNÇÃO DE DEBUG -----
    function mostrarNaoClassificados() {
        if (itensNaoClassificados.length === 0) {
            Swal.fire('Tudo Certo!', 'Nenhum item não classificado foi encontrado.', 'success');
            return;
        }
        const agrupados = {};
        itensNaoClassificados.forEach(item => {
            const key = `Tipo: <strong>${item.tipoCompra}</strong> | Área: <strong>${item.area}</strong>`;
            if (!agrupados[key]) {
                agrupados[key] = {
                    total: 0,
                    pcns: new Set()
                };
            }
            agrupados[key].total += item.valor;
            agrupados[key].pcns.add(item.pcn);
        });
        let html = '<div style="text-align: left; max-height: 300px; overflow-y: auto;">';
        html += '<p>O "Cérebro" do Dashboard (resumo.js) não sabe como agrupar as seguintes combinações:</p><hr>';
        for (const key in agrupados) {
            const dados = agrupados[key];
            const pcnsList = Array.from(dados.pcns).join(', ');
            html += `
                <div style="margin-bottom: 15px; background: #f9f9f9; padding: 10px; border-radius: 5px;">
                    ${key}<br>
                    <strong>Total:</strong> ${formatarDinheiro(dados.total)}<br>
                    <strong>PCNs Afetados:</strong> <small>${pcnsList}</small>
                </div>
            `;
        }
        html += '</div>';
        Swal.fire({
            title: 'Relatório de Itens Não Classificados',
            html: html,
            width: '800px',
            confirmButtonText: 'Entendido'
        });
    }

    // ----- 7. EVENT LISTENERS -----
    botaoRecalcular.addEventListener('click', gerarRelatorioMestre);
    if (btnExportarExcel) { 
        btnExportarExcel.addEventListener('click', exportarParaExcel); 
    }
    btnDebug.addEventListener('click', mostrarNaoClassificados); 

    // ----- 8. INICIA TUDO -----
    carregarDados();
});

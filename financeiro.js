document.addEventListener("DOMContentLoaded", () => {
    
    // Configurações Globais
    const API_BASE_URL = "https://backend-sistema-comprass.onrender.com";
    const tbody = document.getElementById("corpo-tabela-financeiro");
    const spanTotalFiltrado = document.getElementById("total-filtrado");
    const tabsContainer = document.querySelector(".tabs");
    
    // DIV onde os botões de paginação vão aparecer
    const divPaginacao = document.getElementById("paginacao");

    // Elementos de Filtro do HTML
    const filtroDataInicio = document.getElementById('filtro-data-inicio');
    const filtroDataFim = document.getElementById('filtro-data-fim');
    const filtroArea = document.getElementById('filtro-area');
    const filtroLimpar = document.getElementById('filtro-limpar');
    const filtroAplicar = document.getElementById('filtro-aplicar'); 

    // Mapeamento de Áreas por Categoria (Engenharia)
    const areasPorTipo = {
        "Consumiveis": [ "Projetos", "Partículas", "Microscopia", "Química Air Liquide", "Química - Consumo geral", "DRX" ],
        "Equipamentos e Reformas": [ "DRX", "Geral - AC", "Microscopia", "Partículas", "Projetos", "Química", "Química ICP Horiba" ],
        "Escritorio e Uniformes": [ "Saco plasticos", "Tinta / afins", "Luva latex", "Gimba", "Uniformes", "Copo /papel", "Café e afins", "Maskface", "Diversos" ],
        "Reembolsos": [ "DRX", "Particulas", "Quimica", "Projetos", "Manutenção geral", "Microscopia", "Outros" ]
    };

    // Variáveis de Estado
    let todosOsItens = []; 
    let abaAtiva = 'Consumiveis'; 
    let meuGrafico = null; 

    // --- CONFIGURAÇÃO DA PAGINAÇÃO ---
    let paginaAtual = 1;
    const ITENS_POR_PAGINA = 10; // Quantos itens aparecem por vez
    let itensFiltradosGlobal = []; // Guarda a lista completa do filtro atual
    // ---------------------------------

    // 1. CARREGAR DADOS DA API
    async function carregarDados() {
        try {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center">A carregar dados...</td></tr>`;
            
            const token = localStorage.getItem("authToken");
            // if (!token) window.location.href = "login.html"; // Descomente se tiver login

            const response = await fetch(API_BASE_URL + "/api/pedidos", {
                method: "GET",
                headers: { 
                    "Authorization": token || "" 
                }
            });

            if (response.status === 401 || response.status === 403) {
                alert("Sessão expirada.");
                return;
            }

            if (!response.ok) throw new Error("Erro ao buscar dados.");
            
            const pedidos = await response.json();
            
            todosOsItens = [];
            pedidos.forEach(pedido => {
                if (pedido.itens && pedido.itens.length > 0) {
                    pedido.itens.forEach(item => {
                        todosOsItens.push({
                            pcn: pedido.codigoPcn,
                            dataCompra: pedido.dataEmissao, 
                            recurso: pedido.entidadeFaturamento ? pedido.entidadeFaturamento.nomeFantasia : "N/A",
                            fornecedor: pedido.fornecedor ? pedido.fornecedor.nome : "N/A",
                            responsavel: pedido.responsavel || "N/A",
                            tipoCompra: pedido.tipoCompra || "N/A", 
                            itemDescricao: item.descricao,
                            qtd: item.quantidade,
                            area: item.area || "N/A", 
                            valor: item.valorTotal
                        });
                    });
                }
            });
            
            // Inicia na aba padrão
            mudarAba(abaAtiva); 

        } catch (error) {
            console.error(error);
            tbody.innerHTML = `<tr><td colspan="9" style="color:red; text-align:center">Erro: ${error.message}</td></tr>`;
        }
    }

    // 2. SISTEMA DE FILTROS
    function atualizarFiltroArea(aba) {
        const areas = areasPorTipo[aba] || [];
        let options = '<option value="">Todas</option>'; 
        for (const area of areas) {
            options += `<option value="${area}">${area}</option>`;
        }
        filtroArea.innerHTML = options;
    }

    function aplicarFiltros() {
        let itensFiltrados = todosOsItens;

        // Filtro 1: Aba (Tipo Compra)
        if (abaAtiva) {
            itensFiltrados = itensFiltrados.filter(item => item.tipoCompra === abaAtiva);
        }

        // Filtro 2: Datas
        const dataInicio = filtroDataInicio.value;
        if (dataInicio) {
            itensFiltrados = itensFiltrados.filter(item => item.dataCompra >= dataInicio);
        }
        const dataFim = filtroDataFim.value;
        if (dataFim) {
            itensFiltrados = itensFiltrados.filter(item => item.dataCompra <= dataFim);
        }

        // Filtro 3: Área Específica
        const areaSelecionada = filtroArea.value;
        if (areaSelecionada) {
            itensFiltrados = itensFiltrados.filter(item => item.area === areaSelecionada);
        }

        // --- ORDENAÇÃO POR PCN (DECRESCENTE) ---
        // Ordena do MAIOR para o MENOR (começa pelos últimos)
        itensFiltrados.sort((a, b) => {
            // Converte para string para garantir
            const pcnA = String(a.pcn || "");
            const pcnB = String(b.pcn || "");
            
            // Note que invertemos: pcnB compara com pcnA para ficar decrescente
            return pcnB.localeCompare(pcnA, undefined, { numeric: true });
        });

        // --- LÓGICA DE EXIBIÇÃO ---
        // 1. Atualiza o gráfico e o valor total com TODOS os dados filtrados
        renderizarSumario(itensFiltrados);
        
        // 2. Prepara a paginação
        itensFiltradosGlobal = itensFiltrados; // Salva a lista (agora ordenada)
        paginaAtual = 1; // Volta para a página 1
        
        // 3. Renderiza apenas a página 1 na tabela
        renderizarPaginaAtual();
    }

    // 3. FUNÇÕES DE PAGINAÇÃO
    function renderizarPaginaAtual() {
        // Calcula o "fatia" (slice) do array para a página atual
        const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
        const fim = inicio + ITENS_POR_PAGINA;
        
        const itensDaPagina = itensFiltradosGlobal.slice(inicio, fim);
        
        renderizarTabela(itensDaPagina);
        atualizarBotoesPaginacao();
    }

    function atualizarBotoesPaginacao() {
        if (!divPaginacao) return;
        divPaginacao.innerHTML = ""; // Limpa botões antigos

        const totalPaginas = Math.ceil(itensFiltradosGlobal.length / ITENS_POR_PAGINA);
        
        // Se tiver 1 página ou menos, não mostra botões
        if (totalPaginas <= 1) return;

        // --- ESTILIZAÇÃO (Aqui definimos a cor AZUL) ---
        const aplicarEstilo = (btn, disabled) => {
            btn.style.padding = "8px 16px";
            btn.style.border = "none";
            btn.style.borderRadius = "4px";
            btn.style.fontWeight = "bold";
            btn.style.cursor = disabled ? "not-allowed" : "pointer";
            btn.style.fontFamily = "Arial, sans-serif";
            
            if (disabled) {
                // Estilo Desativado (Cinza)
                btn.style.backgroundColor = "#e0e0e0"; 
                btn.style.color = "#a0a0a0";           
            } else {
                // Estilo Ativo (Azul com texto Branco)
                btn.style.backgroundColor = "#007bff"; 
                btn.style.color = "#ffffff";           
            }
        };

        // Botão ANTERIOR
        const btnAnt = document.createElement("button");
        btnAnt.innerText = "Anterior";
        btnAnt.disabled = (paginaAtual === 1);
        aplicarEstilo(btnAnt, btnAnt.disabled);
        
        btnAnt.onclick = () => {
            if (paginaAtual > 1) {
                paginaAtual--;
                renderizarPaginaAtual();
            }
        };
        
        // Texto Informativo (Pág X de Y)
        const spanInfo = document.createElement("span");
        spanInfo.innerText = `Página ${paginaAtual} de ${totalPaginas}`;
        spanInfo.style.fontWeight = "bold";
        spanInfo.style.margin = "0 10px";
        spanInfo.style.color = "#333"; // Preto suave

        // Botão PRÓXIMO
        const btnProx = document.createElement("button");
        btnProx.innerText = "Próximo";
        btnProx.disabled = (paginaAtual === totalPaginas);
        aplicarEstilo(btnProx, btnProx.disabled);

        btnProx.onclick = () => {
            if (paginaAtual < totalPaginas) {
                paginaAtual++;
                renderizarPaginaAtual();
            }
        };

        // Adiciona tudo na tela
        divPaginacao.appendChild(btnAnt);
        divPaginacao.appendChild(spanInfo);
        divPaginacao.appendChild(btnProx);
    }

    // 4. AUXILIARES DE NAVEGAÇÃO
    function mudarAba(novaAba) {
        abaAtiva = novaAba;

        if (tabsContainer) {
            document.querySelectorAll('.tab-link').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === novaAba);
            });
        }

        atualizarFiltroArea(novaAba);
        
        // Limpa campos ao mudar de aba
        filtroDataInicio.value = "";
        filtroDataFim.value = "";
        filtroArea.value = ""; 
        
        aplicarFiltros();
    }
    
    function limparFiltros() {
        filtroDataInicio.value = "";
        filtroDataFim.value = "";
        filtroArea.value = ""; 
        aplicarFiltros();
    }

    // 5. RENDERIZAÇÃO VISUAL (GRÁFICO E TABELA)
    function renderizarSumario(itens) {
        let totalValor = 0;
        const gastosPorArea = {}; 

        itens.forEach(item => {
            totalValor += item.valor;
            const area = item.area || "Sem Área";
            if (gastosPorArea[area]) {
                gastosPorArea[area] += item.valor;
            } else {
                gastosPorArea[area] = item.valor;
            }
        });

        if (spanTotalFiltrado) {
            spanTotalFiltrado.textContent = totalValor.toFixed(2);
        }

        const canvas = document.getElementById('grafico-areas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const labels = Object.keys(gastosPorArea); 
            const data = Object.values(gastosPorArea); 

            if (meuGrafico) meuGrafico.destroy();

            meuGrafico = new Chart(ctx, {
                type: 'bar', 
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Total Gasto por Área (R$)',
                        data: data,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)', 
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: function(value) { return 'R$ ' + value.toFixed(2); } }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: { label: function(context) { return 'R$ ' + context.parsed.y.toFixed(2); } }
                        }
                    }
                }
            });
        }
    }

    function renderizarTabela(itens) {
        if (!tbody) return;
        tbody.innerHTML = "";

        if (itens.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center">Nenhum item encontrado.</td></tr>`;
            return;
        }

        itens.forEach(item => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:bold;">${item.pcn}</td>
                <td>${formatarData(item.dataCompra)}</td>
                <td>${item.itemDescricao}</td>
                <td style="text-align:center;">${item.qtd}</td>
                <td><span style="background:#e0f2fe; color:#0369a1; padding:4px 8px; border-radius:4px; font-size:0.85em;">${item.area}</span></td> 
                <td>${item.recurso}</td>
                <td>${item.fornecedor}</td>
                <td style="color:#10b981; font-weight:bold;">R$ ${item.valor.toFixed(2)}</td>
                <td>${item.responsavel}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function formatarData(dataISO) {
        if (!dataISO) return "N/A";
        const dataLimpa = dataISO.split('T')[0];
        const [ano, mes, dia] = dataLimpa.split('-');
        return `${dia}/${mes}/${ano}`;
    }

    // 6. EVENTOS (CLIQUES)
    if (tabsContainer) {
        tabsContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('tab-link')) {
                const tabId = event.target.dataset.tab;
                mudarAba(tabId);
            }
        });
    }

    if (filtroAplicar) filtroAplicar.addEventListener('click', aplicarFiltros);
    if (filtroLimpar) filtroLimpar.addEventListener('click', limparFiltros);

    // INICIALIZAÇÃO
    carregarDados();
});

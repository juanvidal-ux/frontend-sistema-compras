document.addEventListener("DOMContentLoaded", () => {
    
    // --- Configurações ---
    const API_BASE_URL = "http://localhost:8080";
    let itemNum = 1;

    // --- LÓGICA DE ENGENHARIA (MANTIDA) ---
    const areasPorTipo = {
        "Consumiveis": [
            "Projetos", "Partículas", "Microscopia", "Química Air Liquide", 
            "Química - Consumo geral", "DRX"
        ],
        "Equipamentos e Reformas": [
            "DRX", "Geral - AC", "Microscopia", "Partículas", 
            "Projetos", "Química", "Química ICP Horiba"
        ],
        "Escritorio e Uniformes": [
            "Saco plasticos", "Tinta / afins", "Luva latex", "Gimba", "Uniformes", 
            "Copo /papel", "Café e afins", "Maskface", "Diversos"
        ],
        "Reembolsos": [
            "DRX", "Particulas", "Quimica", "Projetos", 
            "Manutenção geral", "Microscopia", "Outros"
        ]
    };
    // ------------------------------------------

    // --- Referências do Formulário ---
    const form = document.getElementById("form-pedido");
    const selectTipoCompra = document.getElementById("tipoCompra"); 
    const selectFornecedor = document.getElementById("fornecedor");
    const selectEntidade = document.getElementById("entidadeFaturamento");
    const selectLocal = document.getElementById("localEntrega");
    const btnAddItem = document.getElementById("btn-add-item");
    const corpoTabelaItens = document.getElementById("corpo-tabela-itens");
    const spanTotalPedido = document.getElementById("total-pedido");

    // --- VERIFICAÇÃO INICIAL DE LOGIN ---
    const token = localStorage.getItem("authToken");
    if (!token) {
        window.location.href = "login.html";
        return; // Para a execução se não tiver token
    }

    // --- Funções Auxiliares ---

    function criarSelectArea(selectedArea = "") {
        const tipoCompraSelecionado = selectTipoCompra.value;
        const areas = areasPorTipo[tipoCompraSelecionado] || []; 

        let options = '<option value="">Selecione...</option>';
        for (const area of areas) {
            const selected = (area === selectedArea) ? 'selected' : '';
            options += `<option value="${area}" ${selected}>${area}</option>`;
        }
        
        const isDisabled = areas.length === 0;
        return `<select class="select-area" required ${isDisabled ? 'disabled' : ''}>${options}</select>`;
    }

    // --- CARREGAMENTO DE SELECTS (COM SEGURANÇA) ---
    async function carregarSelect(url, selectElement, nomeProp) {
        try {
            // Envia o Token no Header
            const response = await fetch(API_BASE_URL + url, {
                headers: { "Authorization": token }
            });

            if (response.status === 401) {
                alert("Sessão expirada.");
                window.location.href = "login.html";
                return;
            }

            if (!response.ok) throw new Error(`Erro ao carregar ${url}`);
            const data = await response.json();
            
            selectElement.innerHTML = '<option value="">Selecione...</option>'; 
            data.forEach(item => {
                const option = document.createElement("option");
                option.value = item.id;
                option.textContent = item[nomeProp];
                selectElement.appendChild(option);
            });
        } catch (error) {
            console.error(error);
            selectElement.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }

    function calcularTotais() {
        let totalPedido = 0;
        const linhas = corpoTabelaItens.querySelectorAll("tr");
        
        linhas.forEach(linha => {
            const inputQtd = linha.querySelector(".input-qtd");
            const inputVlrUnit = linha.querySelector(".input-vlr-unit");
            const spanVlrTotal = linha.querySelector(".span-vlr-total");

            const qtd = parseFloat(inputQtd.value) || 0;
            const vlrUnit = parseFloat(inputVlrUnit.value) || 0;
            const vlrTotalLinha = qtd * vlrUnit;

            spanVlrTotal.textContent = vlrTotalLinha.toFixed(2);
            totalPedido += vlrTotalLinha;
        });
        spanTotalPedido.textContent = totalPedido.toFixed(2);
    }

    function adicionarLinhaItem() {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${itemNum}</td>
            <td><input type="text" class="input-desc" required /></td>
            <td><input type="number" class="input-qtd" value="1" min="0" step="0.01" /></td>
            <td><input type="number" class="input-vlr-unit" value="0.00" min="0" step="0.01" /></td>
            <td>${criarSelectArea()}</td> 
            <td>R$ <span class="span-vlr-total">0.00</span></td>
            <td><button type="button" class="btn-remover">X</button></td>
        `;

        itemNum++;

        tr.querySelector(".input-qtd").addEventListener("input", calcularTotais);
        tr.querySelector(".input-vlr-unit").addEventListener("input", calcularTotais);
        
        tr.querySelector(".btn-remover").addEventListener("click", () => {
            tr.remove();
            calcularTotais();
        });

        corpoTabelaItens.appendChild(tr);
    }

    // ----- Eventos -----

    btnAddItem.addEventListener("click", adicionarLinhaItem);

    selectTipoCompra.addEventListener("change", () => {
        const tipoSelecionado = selectTipoCompra.value;
        const areas = areasPorTipo[tipoSelecionado] || []; 
        
        let newOptionsHTML = '<option value="">Selecione...</option>';
        for (const area of areas) {
            newOptionsHTML += `<option value="${area}">${area}</option>`;
        }
        
        const linhas = corpoTabelaItens.querySelectorAll("tr");
        linhas.forEach(linha => {
            const selectArea = linha.querySelector(".select-area");
            selectArea.innerHTML = newOptionsHTML; 
            selectArea.disabled = (areas.length === 0);
        });
    });

    // ----- SALVAR PEDIDO (COM LOADER E SEGURANÇA) -----
    form.addEventListener("submit", async (event) => {
        event.preventDefault(); 
        
        const itens = [];
        const linhasItens = corpoTabelaItens.querySelectorAll("tr");
        
        if (linhasItens.length === 0) {
            Swal.fire('Erro', 'O pedido deve ter pelo menos um item.', 'error');
            return;
        }

        let formularioValido = true;
        linhasItens.forEach((linha, index) => {
            const area = linha.querySelector(".select-area").value;
            const descricao = linha.querySelector(".input-desc").value;
            if (!descricao || !area) {
                formularioValido = false;
            }

            const item = {
                itemNum: index + 1, 
                descricao: descricao,
                quantidade: parseFloat(linha.querySelector(".input-qtd").value),
                valorUnitario: parseFloat(linha.querySelector(".input-vlr-unit").value),
                area: area, 
                valorTotal: parseFloat(linha.querySelector(".span-vlr-total").textContent)
            };
            itens.push(item);
        });

        if (!formularioValido) {
            Swal.fire('Erro', 'Todos os itens devem ter uma Descrição e uma Área/Subcategoria.', 'error');
            return;
        }

        const pedido = {
            codigoPcn: document.getElementById("codigoPcn").value,
            responsavel: document.getElementById("responsavel").value, 
            tipoCompra: document.getElementById("tipoCompra").value, 
            localEmissao: document.getElementById("localEmissao").value,
            dataEmissao: document.getElementById("dataEmissao").value,
            fornecedor: { "id": selectFornecedor.value },
            entidadeFaturamento: { "id": selectEntidade.value },
            localEntrega: { "id": selectLocal.value },
            contatoFornecedorNome: document.getElementById("contatoNome").value,
            contatoFornecedorEmail: document.getElementById("contatoEmail").value,
            prezado: document.getElementById("prezado").value,
            numOrcamento: document.getElementById("numOrcamento").value,
            dataOrcamento: document.getElementById("dataOrcamento").value,
            prazoEntrega: document.getElementById("prazoEntrega").value,
            condicoesPagamento: document.getElementById("condicoesPagamento").value,
            numeroProjeto: document.getElementById("numeroProjeto").value,
            observacoes: document.getElementById("observacoes").value,
            totalPedido: parseFloat(spanTotalPedido.textContent),
            itens: itens
        };

        // 1. ATIVA O LOADER VISUAL
        if (typeof mostrarLoading === 'function') {
            mostrarLoading("A salvar pedido..."); 
        }

        try {
            const response = await fetch(API_BASE_URL + "/api/pedidos", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": token 
                },
                body: JSON.stringify(pedido),
            });

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso!',
                    text: `Pedido ${pedido.codigoPcn} salvo com sucesso!`
                }).then(() => {
                    form.reset();
                    corpoTabelaItens.innerHTML = "";
                    itemNum = 1;
                    calcularTotais();
                    adicionarLinhaItem();
                });
            } else {
                if (response.status === 401) {
                    Swal.fire('Erro', 'Sessão expirada. Faça login novamente.', 'error');
                    return;
                }
                throw new Error("Falha ao salvar o pedido.");
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro ao Salvar',
                text: error.message || 'Verifique o console para mais detalhes.'
            });
        } finally {
            // 2. DESATIVA O LOADER (Sempre roda, dando certo ou errado)
            if (typeof esconderLoading === 'function') {
                esconderLoading();
            }
        }
    });

    // ----- Carregamento Inicial -----
    carregarSelect("/api/suporte/fornecedores", selectFornecedor, "nome");
    carregarSelect("/api/suporte/entidades", selectEntidade, "nomeFantasia");
    carregarSelect("/api/suporte/locais-entrega", selectLocal, "laboratorio");
    adicionarLinhaItem(); 
});
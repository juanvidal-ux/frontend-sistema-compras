document.addEventListener("DOMContentLoaded", () => {
    
    // --- Configurações ---
    const API_BASE_URL = "https://backend-sistema-comprass.onrender.com";
    let itemNum = 1;

    // --- LÓGICA DE ENGENHARIA (ATUALIZADA) ---
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

    // --- Lógica de Edição ---
    const urlParams = new URLSearchParams(window.location.search);
    const pedidoId = urlParams.get('id');

    if (!pedidoId) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'ID do pedido não encontrado! Voltando para a lista.'
        }).then(() => {
            window.location.href = "pedidos.html";
        });
        return;
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

    async function carregarSelect(url, selectElement, nomeProp) {
        try {
            const token = localStorage.getItem("authToken"); // Token para selects também (se necessário)
            
            const response = await fetch(API_BASE_URL + url, {
                headers: { "Authorization": token }
            });
            
            if (!response.ok) throw new Error(`Erro ao carregar ${url}`);
            const data = await response.json();
            
            selectElement.innerHTML = '<option value="">Selecione...</option>'; 
            data.forEach(item => {
                const nome = item[nomeProp];
                const option = document.createElement("option");
                option.value = item.id;
                option.textContent = nome;
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

    function adicionarLinhaItem(item = null) {
        const tr = document.createElement("tr");
        
        const num = item ? item.itemNum : itemNum++;
        const desc = item ? item.descricao : "";
        const qtd = item ? item.quantidade : 1;
        const vlrUnit = item ? item.valorUnitario : 0;
        const vlrTotal = item ? item.valorTotal : 0;
        const areaSelecionada = item ? item.area : ""; 

        tr.innerHTML = `
            <td>${num}</td>
            <td><input type="text" class="input-desc" value="${desc}" required /></td>
            <td><input type="number" class="input-qtd" value="${qtd}" min="0" step="0.01" /></td>
            <td><input type="number" class="input-vlr-unit" value="${vlrUnit.toFixed(2)}" min="0" step="0.01" /></td>
            <td>${criarSelectArea(areaSelecionada)}</td> 
            <td>R$ <span class="span-vlr-total">${vlrTotal.toFixed(2)}</span></td>
            <td><button type="button" class="btn-remover">X</button></td>
        `;

        tr.querySelector(".input-qtd").addEventListener("input", calcularTotais);
        tr.querySelector(".input-vlr-unit").addEventListener("input", calcularTotais);
        tr.querySelector(".btn-remover").addEventListener("click", () => {
            tr.remove();
            calcularTotais();
        });

        corpoTabelaItens.appendChild(tr);
    }

    btnAddItem.addEventListener("click", () => adicionarLinhaItem(null));
    
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

    // ----- 3. Lógica Principal: Carregar o Pedido (COM TOKEN) -----
    
    async function carregarPedidoParaEdicao() {
        try {
            // Token necessário para todas as chamadas
            const token = localStorage.getItem("authToken");
            if (!token) { window.location.href = "login.html"; return; }

            await Promise.all([
                carregarSelect("/api/suporte/fornecedores", selectFornecedor, "nome"),
                carregarSelect("/api/suporte/entidades", selectEntidade, "nomeFantasia"),
                carregarSelect("/api/suporte/locais-entrega", selectLocal, "laboratorio")
            ]);

            // GET Pedido com Token
            const response = await fetch(`${API_BASE_URL}/api/pedidos/${pedidoId}`, {
                method: "GET",
                headers: { "Authorization": token }
            });

            if (response.status === 401) {
                window.location.href = "login.html";
                return;
            }

            if (!response.ok) throw new Error("Não foi possível carregar o pedido.");
            
            const pedido = await response.json();

            // Preenche os campos
            document.getElementById("codigoPcn").value = pedido.codigoPcn;
            document.getElementById("responsavel").value = pedido.responsavel || ""; 
            document.getElementById("tipoCompra").value = pedido.tipoCompra || ""; 
            document.getElementById("localEmissao").value = pedido.localEmissao;
            document.getElementById("dataEmissao").value = pedido.dataEmissao;
            
            document.getElementById("contatoNome").value = pedido.contatoFornecedorNome || "";
            document.getElementById("contatoEmail").value = pedido.contatoFornecedorEmail || "";
            document.getElementById("prezado").value = pedido.prezado || "";
            document.getElementById("numOrcamento").value = pedido.numOrcamento || "";
            document.getElementById("dataOrcamento").value = pedido.dataOrcamento || "";
            document.getElementById("prazoEntrega").value = pedido.prazoEntrega || "";
            document.getElementById("condicoesPagamento").value = pedido.condicoesPagamento || "";
            document.getElementById("numeroProjeto").value = pedido.numeroProjeto || "";
            document.getElementById("observacoes").value = pedido.observacoes || "";

            if (pedido.fornecedor) selectFornecedor.value = pedido.fornecedor.id;
            if (pedido.entidadeFaturamento) selectEntidade.value = pedido.entidadeFaturamento.id;
            if (pedido.localEntrega) selectLocal.value = pedido.localEntrega.id;

            corpoTabelaItens.innerHTML = ""; 
            if (pedido.itens && pedido.itens.length > 0) {
                itemNum = 1; 
                pedido.itens.forEach(item => {
                    item.itemNum = itemNum++; 
                    adicionarLinhaItem(item); 
                });
            }
            calcularTotais(); 

        } catch (error) {
            console.error(error);
            Swal.fire('Erro', 'Erro ao carregar dados do pedido (Verifique conexão ou login).', 'error');
        }
    }

    // ----- 4. Lógica de Atualização (SUBMIT COM TOKEN) -----
    
    form.addEventListener("submit", async (event) => {
        event.preventDefault(); 
        
        const itens = [];
        const linhasItens = corpoTabelaItens.querySelectorAll("tr");
        
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
            id: parseInt(pedidoId), 
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

        try {
            const token = localStorage.getItem("authToken"); // TOKEN PARA SALVAR

            const response = await fetch(`${API_BASE_URL}/api/pedidos/${pedidoId}`, {
                method: "PUT", 
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": token // <--- IMPORTANTE
                },
                body: JSON.stringify(pedido),
            });

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Atualizado!',
                    text: `Pedido ${pedido.codigoPcn} atualizado com sucesso!`
                }).then(() => {
                    window.location.href = "pedidos.html";
                });
            } else {
                throw new Error("Falha ao atualizar o pedido.");
            }
        } catch (error) {
            console.error("Erro ao atualizar:", error);
            Swal.fire('Erro', 'Erro ao atualizar o pedido.', 'error');
        }
    });

    // ----- 5. Inicia o carregamento -----
    carregarPedidoParaEdicao();
});

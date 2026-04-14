document.addEventListener("DOMContentLoaded", () => {
    // =========================
    // CONFIGURAÇÕES DA API
    // =========================
    const API_BASE_URL = "https://backend-sistema-comprass.onrender.com";
    const API_SUPORTE_URL = `${API_BASE_URL}/api/suporte`;
    const API_PEDIDOS_URL = `${API_BASE_URL}/api/pedidos`;

    let itemNum = 1;

    // =========================
    // LÓGICA DE ENGENHARIA
    // =========================
    const areasPorTipo = {
        "Consumiveis": [
            "Projetos",
            "Partículas",
            "Microscopia",
            "Química Air Liquide",
            "Química - Consumo geral",
            "DRX"
        ],
        "Equipamentos e Reformas": [
            "DRX",
            "Geral - AC",
            "Microscopia",
            "Partículas",
            "Projetos",
            "Química",
            "Química ICP Horiba"
        ],
        "Escritorio e Uniformes": [
            "Saco plasticos",
            "Tinta / afins",
            "Luva latex",
            "Gimba",
            "Uniformes",
            "Copo /papel",
            "Café e afins",
            "Maskface",
            "Diversos"
        ],
        "Reembolsos": [
            "DRX",
            "Particulas",
            "Quimica",
            "Projetos",
            "Manutenção geral",
            "Microscopia",
            "Outros"
        ]
    };

    // =========================
    // REFERÊNCIAS DO FORMULÁRIO
    // =========================
    const form = document.getElementById("form-pedido");
    const selectTipoCompra = document.getElementById("tipoCompra");
    const selectFornecedor = document.getElementById("fornecedor");
    const selectEntidade = document.getElementById("entidadeFaturamento");
    const selectLocal = document.getElementById("localEntrega");
    const btnAddItem = document.getElementById("btn-add-item");
    const corpoTabelaItens = document.getElementById("corpo-tabela-itens");
    const spanTotalPedido = document.getElementById("total-pedido");

    // =========================
    // VERIFICAÇÃO DE LOGIN
    // =========================
    const token = localStorage.getItem("authToken");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // =========================
    // FUNÇÕES AUXILIARES
    // =========================
    function criarSelectArea(selectedArea = "") {
        const tipoCompraSelecionado = selectTipoCompra.value;
        const areas = areasPorTipo[tipoCompraSelecionado] || [];

        let options = '<option value="">Selecione...</option>';
        for (const area of areas) {
            const selected = area === selectedArea ? "selected" : "";
            options += `<option value="${area}" ${selected}>${area}</option>`;
        }

        const isDisabled = areas.length === 0;
        return `<select class="select-area" required ${isDisabled ? "disabled" : ""}>${options}</select>`;
    }

    async function apiFetch(url, options = {}) {
        const config = {
            ...options,
            headers: {
                Authorization: token,
                ...(options.headers || {})
            }
        };

        const response = await fetch(url, config);

        if (response.status === 401) {
            alert("Sessão expirada. Faça login novamente.");
            localStorage.removeItem("authToken");
            localStorage.removeItem("usuarioLogado");
            localStorage.removeItem("usuarioPapel");
            window.location.href = "login.html";
            throw new Error("Sessão expirada.");
        }

        return response;
    }

    async function carregarSelect(endpoint, selectElement, nomeProp) {
        try {
            const response = await apiFetch(`${API_SUPORTE_URL}${endpoint}`);

            if (!response.ok) {
                throw new Error(`Erro ao carregar ${endpoint}`);
            }

            const data = await response.json();
            selectElement.innerHTML = '<option value="">Selecione...</option>';

            data.forEach(item => {
                const option = document.createElement("option");
                option.value = item.id;
                option.textContent = item[nomeProp];
                selectElement.appendChild(option);
            });
        } catch (error) {
            console.error(`Erro ao carregar ${endpoint}:`, error);
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

    function limparFormulario() {
        form.reset();
        corpoTabelaItens.innerHTML = "";
        itemNum = 1;
        spanTotalPedido.textContent = "0.00";
        adicionarLinhaItem();
    }

    // =========================
    // EVENTOS
    // =========================
    if (btnAddItem) {
        btnAddItem.addEventListener("click", adicionarLinhaItem);
    }

    if (selectTipoCompra) {
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
                if (selectArea) {
                    selectArea.innerHTML = newOptionsHTML;
                    selectArea.disabled = areas.length === 0;
                }
            });
        });
    }

    if (form) {
        form.addEventListener("submit", async event => {
            event.preventDefault();

            const linhasItens = corpoTabelaItens.querySelectorAll("tr");
            const itens = [];

            if (linhasItens.length === 0) {
                Swal.fire("Erro", "O pedido deve ter pelo menos um item.", "error");
                return;
            }

            let formularioValido = true;

            linhasItens.forEach((linha, index) => {
                const descricao = linha.querySelector(".input-desc")?.value?.trim() || "";
                const quantidade = parseFloat(linha.querySelector(".input-qtd")?.value) || 0;
                const valorUnitario = parseFloat(linha.querySelector(".input-vlr-unit")?.value) || 0;
                const area = linha.querySelector(".select-area")?.value || "";
                const valorTotal = parseFloat(linha.querySelector(".span-vlr-total")?.textContent) || 0;

                if (!descricao || !area) {
                    formularioValido = false;
                }

                itens.push({
                    itemNum: index + 1,
                    descricao,
                    quantidade,
                    valorUnitario,
                    area,
                    valorTotal
                });
            });

            if (!formularioValido) {
                Swal.fire("Erro", "Todos os itens devem ter uma descrição e uma área/subcategoria.", "error");
                return;
            }

            const pedido = {
                codigoPcn: document.getElementById("codigoPcn")?.value || "",
                responsavel: document.getElementById("responsavel")?.value || "",
                tipoCompra: document.getElementById("tipoCompra")?.value || "",
                localEmissao: document.getElementById("localEmissao")?.value || "",
                dataEmissao: document.getElementById("dataEmissao")?.value || "",
                fornecedor: { id: selectFornecedor?.value || null },
                entidadeFaturamento: { id: selectEntidade?.value || null },
                localEntrega: { id: selectLocal?.value || null },
                contatoFornecedorNome: document.getElementById("contatoNome")?.value || "",
                contatoFornecedorEmail: document.getElementById("contatoEmail")?.value || "",
                prezado: document.getElementById("prezado")?.value || "",
                numOrcamento: document.getElementById("numOrcamento")?.value || "",
                dataOrcamento: document.getElementById("dataOrcamento")?.value || "",
                prazoEntrega: document.getElementById("prazoEntrega")?.value || "",
                condicoesPagamento: document.getElementById("condicoesPagamento")?.value || "",
                numeroProjeto: document.getElementById("numeroProjeto")?.value || "",
                observacoes: document.getElementById("observacoes")?.value || "",
                totalPedido: parseFloat(spanTotalPedido.textContent) || 0,
                itens
            };

            if (typeof mostrarLoading === "function") {
                mostrarLoading("A salvar pedido...");
            }

            try {
                const response = await apiFetch(API_PEDIDOS_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(pedido)
                });

                if (!response.ok) {
                    const textoErro = await response.text();
                    throw new Error(textoErro || "Falha ao salvar o pedido.");
                }

                Swal.fire({
                    icon: "success",
                    title: "Sucesso!",
                    text: `Pedido ${pedido.codigoPcn} salvo com sucesso!`
                }).then(() => {
                    limparFormulario();
                });
            } catch (error) {
                console.error("Erro ao salvar:", error);
                Swal.fire({
                    icon: "error",
                    title: "Erro ao salvar",
                    text: error.message || "Verifique o console para mais detalhes."
                });
            } finally {
                if (typeof esconderLoading === "function") {
                    esconderLoading();
                }
            }
        });
    }

    // =========================
    // CARGA INICIAL
    // =========================
    carregarSelect("/fornecedores", selectFornecedor, "nome");
    carregarSelect("/entidades", selectEntidade, "nomeFantasia");
    carregarSelect("/locais-entrega", selectLocal, "laboratorio");

    adicionarLinhaItem();
    calcularTotais();
});

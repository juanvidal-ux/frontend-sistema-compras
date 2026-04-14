document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = "https://backend-sistema-comprass.onrender.com/api/pedidos";
    const tbody = document.getElementById("corpo-tabela-pedidos");
    const inputBusca = document.getElementById("input-busca");
    const btnExportar = document.getElementById("btn-exportar-geral");

    const btnAnterior = document.getElementById("btn-pag-anterior");
    const btnProximo = document.getElementById("btn-pag-proximo");
    const infoPaginacao = document.getElementById("info-paginacao");

    let listaCompletaPedidos = [];
    let listaFiltrada = [];
    let paginaAtual = 1;
    const ITENS_POR_PAGINA = 20;

    function verificarPermissaoExportar() {
        const papel = localStorage.getItem("usuarioPapel");
        if (papel === "ADMIN" && btnExportar) {
            btnExportar.style.display = "flex";
        }
    }

    async function fetchComTimeout(url, options = {}, timeoutMs = 15000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function carregarPedidos() {
        try {
            if (typeof mostrarLoading === "function") {
                mostrarLoading("A carregar pedidos...");
            }

            const token = localStorage.getItem("authToken");
            if (!token) {
                window.location.href = "login.html";
                return;
            }

            console.log("Buscando pedidos em:", API_BASE_URL);

            const response = await fetchComTimeout(API_BASE_URL, {
                headers: {
                    "Authorization": token
                }
            }, 15000);

            console.log("Status da resposta /api/pedidos:", response.status);

            if (response.status === 401) {
                alert("Sessão expirada.");
                window.location.href = "login.html";
                return;
            }

            if (!response.ok) {
                const textoErro = await response.text().catch(() => "");
                throw new Error(`Erro ao buscar pedidos. Status ${response.status}. ${textoErro}`);
            }

            const dados = await response.json();
            console.log("Pedidos recebidos:", dados);

            listaCompletaPedidos = Array.isArray(dados)
                ? dados.sort((a, b) => (b.id || 0) - (a.id || 0))
                : [];

            listaFiltrada = [...listaCompletaPedidos];
            renderizarPagina(1);

        } catch (error) {
            console.error("Erro ao carregar pedidos:", error);

            let mensagem = "Erro ao carregar pedidos.";

            if (error.name === "AbortError") {
                mensagem = "A requisição demorou demais e foi cancelada. Verifique o backend.";
            }

            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; color:red; padding:20px;">
                            ${mensagem}
                        </td>
                    </tr>
                `;
            }
        } finally {
            if (typeof esconderLoading === "function") {
                esconderLoading();
            }
        }
    }

    function renderizarPagina(pagina) {
        paginaAtual = pagina;
        if (!tbody) return;

        tbody.innerHTML = "";

        const inicio = (pagina - 1) * ITENS_POR_PAGINA;
        const fim = inicio + ITENS_POR_PAGINA;
        const itensParaMostrar = listaFiltrada.slice(inicio, fim);
        const totalPaginas = Math.ceil(listaFiltrada.length / ITENS_POR_PAGINA) || 1;

        if (infoPaginacao) infoPaginacao.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
        if (btnAnterior) btnAnterior.disabled = (paginaAtual === 1);
        if (btnProximo) btnProximo.disabled = (paginaAtual >= totalPaginas);

        if (listaFiltrada.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding: 20px;">
                        Nenhum pedido encontrado.
                    </td>
                </tr>
            `;
            return;
        }

        itensParaMostrar.forEach(pedido => {
            const tr = document.createElement("tr");

            const dataFormatada = pedido.dataEmissao
                ? new Date(pedido.dataEmissao).toLocaleDateString("pt-BR")
                : "-";

            const fornecedorNome = pedido.fornecedorNome || 'N/A';
            const responsavel = pedido.responsavel || "N/A";
            const tipoCompra = pedido.tipoCompra || "N/A";
            const valorFormatado = pedido.totalPedido
                ? Number(pedido.totalPedido).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL"
                })
                : "R$ 0,00";

            tr.innerHTML = `
                <td style="font-weight:bold; color:#3b82f6;">${pedido.codigoPcn || "-"}</td>
                <td>${dataFormatada}</td>
                <td>${responsavel}</td>
                <td><span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-size:0.85em; font-weight:600;">${tipoCompra}</span></td>
                <td>${fornecedorNome}</td>
                <td style="color:#10b981; font-weight:bold;">${valorFormatado}</td>
                <td style="text-align:center;">
                    <a href="editar-pedido.html?id=${pedido.id}" class="btn-acao" style="color:#f59e0b; margin-right:10px; text-decoration:none;" title="Editar">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </a>

                    <a href="#" class="btn-acao" style="color:#3b82f6; margin-right:10px; text-decoration:none;" onclick="baixarDocumento(${pedido.id}, event)" title="Gerar Word">
                        <i class="fa-solid fa-file-word"></i>
                    </a>

                    <a href="#" class="btn-acao" style="color:#ef4444; text-decoration:none;" onclick="excluirPedido(${pedido.id}, event)" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </a>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    if (inputBusca) {
        inputBusca.addEventListener("input", (e) => {
            const termo = e.target.value.toLowerCase();

            listaFiltrada = listaCompletaPedidos.filter(pedido => {
                const pcn = pedido.codigoPcn?.toLowerCase() || "";
                const fornecedor = pedido.fornecedor?.nome?.toLowerCase() || "";
                const resp = pedido.responsavel?.toLowerCase() || "";

                const temItem = Array.isArray(pedido.itens) && pedido.itens.some(item =>
                    item.descricao?.toLowerCase().includes(termo)
                );

                return pcn.includes(termo) || fornecedor.includes(termo) || resp.includes(termo) || temItem;
            });

            renderizarPagina(1);
        });
    }

    if (btnAnterior) {
        btnAnterior.addEventListener("click", () => {
            if (paginaAtual > 1) renderizarPagina(paginaAtual - 1);
        });
    }

    if (btnProximo) {
        btnProximo.addEventListener("click", () => {
            const totalPaginas = Math.ceil(listaFiltrada.length / ITENS_POR_PAGINA) || 1;
            if (paginaAtual < totalPaginas) renderizarPagina(paginaAtual + 1);
        });
    }

    window.excluirPedido = async (id, event) => {
        event.preventDefault();

        const result = await Swal.fire({
            title: "Tem certeza?",
            text: "Esta ação não pode ser desfeita!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Sim, excluir!"
        });

        if (!result.isConfirmed) return;

        try {
            if (typeof mostrarLoading === "function") mostrarLoading("A excluir...");

            const token = localStorage.getItem("authToken");

            const response = await fetchComTimeout(`${API_BASE_URL}/${id}`, {
                method: "DELETE",
                headers: { "Authorization": token }
            }, 15000);

            if (!response.ok) {
                throw new Error(`Falha ao excluir. Status ${response.status}`);
            }

            Swal.fire("Excluído!", "O pedido foi removido.", "success");

            listaCompletaPedidos = listaCompletaPedidos.filter(p => p.id !== id);
            listaFiltrada = listaFiltrada.filter(p => p.id !== id);
            renderizarPagina(paginaAtual);

        } catch (error) {
            console.error("Erro ao excluir:", error);
            Swal.fire("Erro", "Erro ao excluir o pedido.", "error");
        } finally {
            if (typeof esconderLoading === "function") esconderLoading();
        }
    };

    window.baixarDocumento = async (id, event) => {
        event.preventDefault();

        try {
            if (typeof mostrarLoading === "function") mostrarLoading("A gerar documento...");

            const token = localStorage.getItem("authToken");

            const response = await fetchComTimeout(`${API_BASE_URL}/documento/${id}`, {
                headers: { "Authorization": token }
            }, 20000);

            if (!response.ok) {
                throw new Error(`Falha ao gerar o documento. Status ${response.status}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Pedido_${id}.docx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Erro ao baixar documento:", error);
            Swal.fire("Erro", "Erro ao gerar ou baixar o documento.", "error");
        } finally {
            if (typeof esconderLoading === "function") esconderLoading();
        }
    };

    if (btnExportar) {
        btnExportar.addEventListener("click", () => {
            if (listaFiltrada.length === 0) {
                Swal.fire("Aviso", "Não há dados para exportar.", "warning");
                return;
            }

            const dadosExportacao = listaFiltrada.map(p => ({
                "PCN": p.codigoPcn,
                "Data Emissão": p.dataEmissao ? new Date(p.dataEmissao).toLocaleDateString("pt-BR") : "",
                "Tipo Compra": p.tipoCompra,
                "Fornecedor": p.fornecedor ? p.fornecedor.nome : "",
                "Entidade": p.entidadeFaturamento ? p.entidadeFaturamento.nomeFantasia : "",
                "Valor Total": p.totalPedido,
                "Responsável": p.responsavel
            }));

            const ws = XLSX.utils.json_to_sheet(dadosExportacao);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
            XLSX.writeFile(wb, "Relatorio_Geral_Pedidos.xlsx");
        });
    }

    verificarPermissaoExportar();
    carregarPedidos();
});

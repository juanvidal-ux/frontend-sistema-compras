document.addEventListener("DOMContentLoaded", () => {
    
    const API_BASE_URL = "https://backend-sistema-comprass.onrender.com/api/pedidos";
    const tbody = document.getElementById("corpo-tabela-pedidos");
    const inputBusca = document.getElementById("input-busca");
    const btnExportar = document.getElementById("btn-exportar-geral");
    
    // Elementos de Paginação
    const btnAnterior = document.getElementById("btn-pag-anterior");
    const btnProximo = document.getElementById("btn-pag-proximo");
    const infoPaginacao = document.getElementById("info-paginacao");

    let listaCompletaPedidos = []; // Todos os dados do servidor
    let listaFiltrada = [];        // Dados após busca
    let paginaAtual = 1;
    const ITENS_POR_PAGINA = 20;

    // --- 1. VERIFICAÇÃO DE PERMISSÃO (ADMIN) ---
    function verificarPermissaoExportar() {
        const papel = localStorage.getItem("usuarioPapel");
        // Se for ADMIN, mostra o botão (que começa oculto no HTML)
        if (papel === "ADMIN" && btnExportar) {
            btnExportar.style.display = "flex"; 
        }
    }

    // --- 2. CARREGAR DADOS ---
    async function carregarPedidos() {
        try {
            if (typeof mostrarLoading === 'function') mostrarLoading("A carregar pedidos...");
            
            const token = localStorage.getItem("authToken");
            if (!token) { window.location.href = "login.html"; return; }

            const response = await fetch(API_BASE_URL, {
                headers: { "Authorization": token }
            });

            if (response.status === 401) {
                alert("Sessão expirada."); window.location.href = "login.html"; return;
            }

            if (!response.ok) throw new Error("Erro ao buscar pedidos.");
            
            const dados = await response.json();
            
            // Ordena por ID decrescente (mais novos primeiro)
            listaCompletaPedidos = dados.sort((a, b) => b.id - a.id);
            
            // Inicializa a lista filtrada com tudo
            listaFiltrada = [...listaCompletaPedidos];
            
            renderizarPagina(1); // Desenha a primeira página

        } catch (error) {
            console.error(error);
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Erro ao carregar pedidos.</td></tr>`;
        } finally {
            if (typeof esconderLoading === 'function') esconderLoading();
        }
    }

    // --- 3. LÓGICA DE PAGINAÇÃO E RENDERIZAÇÃO ---
    function renderizarPagina(pagina) {
        paginaAtual = pagina;
        tbody.innerHTML = "";

        // Cálculos de índices
        const inicio = (pagina - 1) * ITENS_POR_PAGINA;
        const fim = inicio + ITENS_POR_PAGINA;
        const itensParaMostrar = listaFiltrada.slice(inicio, fim);
        const totalPaginas = Math.ceil(listaFiltrada.length / ITENS_POR_PAGINA) || 1;

        // Atualiza Botões de Paginação
        if (infoPaginacao) infoPaginacao.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
        if (btnAnterior) btnAnterior.disabled = (paginaAtual === 1);
        if (btnProximo) btnProximo.disabled = (paginaAtual === totalPaginas || totalPaginas === 0);

        if (listaFiltrada.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">Nenhum pedido encontrado.</td></tr>`;
            return;
        }

        // Desenha as linhas
        itensParaMostrar.forEach(pedido => {
            const tr = document.createElement("tr");
            
            const dataFormatada = pedido.dataEmissao ? new Date(pedido.dataEmissao).toLocaleDateString('pt-BR') : '-';
            const fornecedorNome = pedido.fornecedor ? pedido.fornecedor.nome : 'N/A';
            const responsavel = pedido.responsavel || 'N/A';
            const tipoCompra = pedido.tipoCompra || 'N/A';
            const valorFormatado = pedido.totalPedido ? pedido.totalPedido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';

            tr.innerHTML = `
                <td style="font-weight:bold; color:#3b82f6;">${pedido.codigoPcn}</td>
                <td>${dataFormatada}</td>
                <td>${responsavel}</td>
                <td><span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-size:0.85em; font-weight:600;">${tipoCompra}</span></td>
                <td>${fornecedorNome}</td>
                <td style="color: #10b981; font-weight: bold;">${valorFormatado}</td>
                <td style="text-align: center;">
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

    // --- 4. FILTRO DE BUSCA (Pesquisa em memória) ---
    if(inputBusca){
        inputBusca.addEventListener("input", (e) => {
            const termo = e.target.value.toLowerCase();

            // Filtra a lista completa
            listaFiltrada = listaCompletaPedidos.filter(pedido => {
                const pcn = pedido.codigoPcn ? pedido.codigoPcn.toLowerCase() : "";
                const fornecedor = pedido.fornecedor ? pedido.fornecedor.nome.toLowerCase() : "";
                const resp = pedido.responsavel ? pedido.responsavel.toLowerCase() : "";
                
                // Busca também dentro dos itens do pedido
                const temItem = pedido.itens && pedido.itens.some(item => 
                    item.descricao && item.descricao.toLowerCase().includes(termo)
                );

                return pcn.includes(termo) || fornecedor.includes(termo) || resp.includes(termo) || temItem;
            });

            // Volta para a página 1 sempre que buscar
            renderizarPagina(1);
        });
    }

    // --- 5. EVENTOS DE PAGINAÇÃO ---
    if(btnAnterior){
        btnAnterior.addEventListener("click", () => {
            if (paginaAtual > 1) renderizarPagina(paginaAtual - 1);
        });
    }

    if(btnProximo){
        btnProximo.addEventListener("click", () => {
            const totalPaginas = Math.ceil(listaFiltrada.length / ITENS_POR_PAGINA);
            if (paginaAtual < totalPaginas) renderizarPagina(paginaAtual + 1);
        });
    }

    // --- 6. FUNÇÕES GLOBAIS (Excluir e Baixar) ---
    window.excluirPedido = async (id, event) => {
        event.preventDefault();
        const result = await Swal.fire({
            title: 'Tem certeza?',
            text: "Esta ação não pode ser desfeita!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sim, excluir!'
        });

        if (result.isConfirmed) {
            try {
                if (typeof mostrarLoading === 'function') mostrarLoading("A excluir...");
                const token = localStorage.getItem("authToken");
                
                const response = await fetch(`${API_BASE_URL}/${id}`, {
                    method: 'DELETE',
                    headers: { "Authorization": token }
                });

                if (response.ok) {
                    Swal.fire('Excluído!', 'O pedido foi removido.', 'success');
                    // Remove da lista em memória
                    listaCompletaPedidos = listaCompletaPedidos.filter(p => p.id !== id);
                    listaFiltrada = listaFiltrada.filter(p => p.id !== id);
                    renderizarPagina(paginaAtual); 
                } else {
                    throw new Error('Falha ao excluir.');
                }
            } catch (error) {
                Swal.fire('Erro', 'Erro ao excluir o pedido.', 'error');
            } finally {
                if (typeof esconderLoading === 'function') esconderLoading();
            }
        }
    };

    window.baixarDocumento = async (id, event) => {
        event.preventDefault();
        try {
            if (typeof mostrarLoading === 'function') mostrarLoading("A gerar documento...");
            const token = localStorage.getItem("authToken");

            const response = await fetch(`${API_BASE_URL}/documento/${id}`, {
                headers: { "Authorization": token }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Pedido_${id}.docx`; 
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                Swal.fire('Erro', 'Falha ao gerar o documento.', 'error');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Erro', 'Erro de conexão.', 'error');
        } finally {
            if (typeof esconderLoading === 'function') esconderLoading();
        }
    };

    // --- 7. LÓGICA DE EXPORTAÇÃO GERAL (Excel) ---
    if (btnExportar) {
        btnExportar.addEventListener("click", () => {
            if (listaFiltrada.length === 0) {
                Swal.fire("Aviso", "Não há dados para exportar.", "warning");
                return;
            }
            
            // Prepara os dados para o Excel
            const dadosExportacao = listaFiltrada.map(p => ({
                "PCN": p.codigoPcn,
                "Data Emissão": p.dataEmissao ? new Date(p.dataEmissao).toLocaleDateString('pt-BR') : '',
                "Tipo Compra": p.tipoCompra,
                "Fornecedor": p.fornecedor ? p.fornecedor.nome : '',
                "Entidade": p.entidadeFaturamento ? p.entidadeFaturamento.nomeFantasia : '',
                "Valor Total": p.totalPedido,
                "Responsável": p.responsavel
            }));

            const ws = XLSX.utils.json_to_sheet(dadosExportacao);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
            XLSX.writeFile(wb, "Relatorio_Geral_Pedidos.xlsx");
        });
    }

    // --- INICIALIZAÇÃO ---
    verificarPermissaoExportar();
    carregarPedidos();
});

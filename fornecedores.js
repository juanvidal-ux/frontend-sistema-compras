document.addEventListener("DOMContentLoaded", () => {
    
    const API_BASE_URL = "https://backend-sistema-comprass.onrender.com/api/suporte";
    const form = document.getElementById("form-fornecedor");
    const tbody = document.getElementById("corpo-tabela-fornecedores");
    const btnExportarExcel = document.getElementById("btn-exportar-excel");

    let listaFornecedores = []; // Armazena a lista

    // --- 1. CARREGA A LISTA (COM SEGURANÇA) ---
    async function carregarFornecedores() {
        try {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Carregando...</td></tr>';
            
            // 1. PEGA O TOKEN
            const token = localStorage.getItem("authToken");
            if (!token) {
                window.location.href = "login.html";
                return;
            }

            // 2. ENVIA O TOKEN NO HEADER
            const response = await fetch(`${API_BASE_URL}/fornecedores`, {
                method: "GET",
                headers: {
                    "Authorization": token // <--- O CRACHÁ
                }
            });

            // 3. VERIFICA SE O TOKEN É VÁLIDO
            if (response.status === 401 || response.status === 403) {
                alert("Sessão expirada. Faça login novamente.");
                window.location.href = "login.html";
                return;
            }

            if (!response.ok) throw new Error("Erro ao buscar fornecedores");
            
            listaFornecedores = await response.json(); // Salva na variável global
            renderizarTabela(listaFornecedores);
            
        } catch (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="4" style="color:red; text-align:center">Erro ao carregar dados.</td></tr>';
        }
    }

    // --- 2. RENDERIZA A TABELA ---
    function renderizarTabela(fornecedores) {
        tbody.innerHTML = "";
        if (fornecedores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Nenhum fornecedor cadastrado.</td></tr>';
            return;
        }
        fornecedores.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${f.id}</td>
                <td>${f.nome}</td>
                <td>${f.cnpj || 'N/A'}</td>
                <td>${f.telefone || 'N/A'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- 3. SALVA NOVO FORNECEDOR (COM SEGURANÇA) ---
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        
        const fornecedor = {
            nome: document.getElementById("nome").value,
            cnpj: document.getElementById("cnpj").value,
            telefone: document.getElementById("telefone").value
        };

        try {
            const token = localStorage.getItem("authToken"); // Token para salvar também

            const response = await fetch(`${API_BASE_URL}/fornecedores`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": token // <--- IMPORTANTE NO POST
                },
                body: JSON.stringify(fornecedor)
            });

            if (response.ok) {
                Swal.fire('Sucesso!', 'Fornecedor salvo com sucesso.', 'success');
                form.reset();
                carregarFornecedores(); // Recarrega a lista
            } else {
                throw new Error("Falha ao salvar fornecedor");
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Erro', 'Não foi possível salvar o fornecedor.', 'error');
        }
    });
    
    // --- 4. EXPORTAÇÃO EXCEL (Lógica local, não precisa de token) ---
    function exportarListaExcel() {
        if (listaFornecedores.length === 0) {
            Swal.fire('Atenção', 'Não há dados para exportar.', 'warning');
            return;
        }

        // 1. Prepara os dados (limpa)
        const dadosParaExportar = listaFornecedores.map(f => ({
            ID_FORNECEDOR: f.id,
            NOME_FANTASIA: f.nome,
            CNPJ: f.cnpj || "", 
            TELEFONE: f.telefone || ""
        }));

        // 2. Cria a planilha (Worksheet)
        const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
        
        // 3. Cria o "livro" (Workbook)
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Fornecedores");

        // 4. Gera o ficheiro e força o download
        XLSX.writeFile(wb, "CADASTRO_FORNECEDORES.xlsx");
    }

    // --- EVENT LISTENERS ---
    if(btnExportarExcel) {
        btnExportarExcel.addEventListener('click', exportarListaExcel);
    }
    
    carregarFornecedores(); // Carga Inicial
});

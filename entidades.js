document.addEventListener("DOMContentLoaded", () => {
    
    const API_BASE_URL = "http://localhost:8080/api/suporte";
    const form = document.getElementById("form-entidade");
    const tbody = document.getElementById("corpo-tabela-entidades");
    const btnExportarExcel = document.getElementById("btn-exportar-excel-entidade");

    let listaEntidades = []; // Armazena a lista

    // --- 1. CARREGA A LISTA (COM SEGURANÇA) ---
    async function carregarEntidades() {
        try {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Carregando...</td></tr>';
            
            // 1. PEGA O TOKEN
            const token = localStorage.getItem("authToken");
            if (!token) {
                window.location.href = "login.html";
                return;
            }

            // 2. ENVIA O TOKEN NO HEADER
            const response = await fetch(`${API_BASE_URL}/entidades`, {
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

            if (!response.ok) throw new Error("Erro ao buscar entidades");
            
            listaEntidades = await response.json(); // Salva na variável global
            renderizarTabela(listaEntidades);
            
        } catch (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="4" style="color:red; text-align:center">Erro ao carregar dados.</td></tr>';
        }
    }

    // --- 2. RENDERIZA A TABELA ---
    function renderizarTabela(entidades) {
        tbody.innerHTML = "";
        if (entidades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Nenhuma entidade cadastrada.</td></tr>';
            return;
        }
        entidades.forEach(e => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${e.id}</td>
                <td>${e.nomeFantasia}</td>
                <td>${e.razaoSocial}</td>
                <td>${e.cnpj}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- 3. SALVA NOVA ENTIDADE (COM SEGURANÇA) ---
    if (form) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            
            const entidade = {
                nomeFantasia: document.getElementById("nomeFantasia").value,
                razaoSocial: document.getElementById("razaoSocial").value,
                cnpj: document.getElementById("cnpj").value,
                inscricaoEstadual: document.getElementById("inscricaoEstadual").value,
                numeroCr: document.getElementById("numeroCr").value,
                enderecoCompleto: document.getElementById("enderecoCompleto").value
            };

            try {
                const token = localStorage.getItem("authToken"); // Token para salvar também

                const response = await fetch(`${API_BASE_URL}/entidades`, {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": token // <--- IMPORTANTE NO POST
                    },
                    body: JSON.stringify(entidade)
                });

                if (response.ok) {
                    Swal.fire('Sucesso!', 'Entidade salva com sucesso.', 'success');
                    form.reset();
                    carregarEntidades(); // Recarrega a lista
                } else {
                    throw new Error("Falha ao salvar entidade");
                }
            } catch (error) {
                console.error(error);
                Swal.fire('Erro', 'Não foi possível salvar a entidade.', 'error');
            }
        });
    }
    
    // --- 4. EXPORTAÇÃO EXCEL (Lógica local) ---
    function exportarListaExcel() {
        if (listaEntidades.length === 0) {
            Swal.fire('Atenção', 'Não há dados para exportar.', 'warning');
            return;
        }

        // 1. Prepara os dados (limpa)
        const dadosParaExportar = listaEntidades.map(e => ({
            ID_ENTIDADE: e.id,
            NOME_FANTASIA: e.nomeFantasia,
            RAZAO_SOCIAL: e.razaoSocial,
            CNPJ: e.cnpj,
            INSCRICAO_ESTADUAL: e.inscricaoEstadual || "",
            ENDERECO: e.enderecoCompleto || ""
        }));

        // 2. Cria a planilha (Worksheet)
        const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
        
        // 3. Cria o "livro" (Workbook)
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Entidades");

        // 4. Gera o ficheiro e força o download
        XLSX.writeFile(wb, "CADASTRO_ENTIDADES.xlsx");
    }

    // --- EVENT LISTENERS ---
    if (btnExportarExcel) {
        btnExportarExcel.addEventListener('click', exportarListaExcel);
    }
    
    carregarEntidades(); // Carga Inicial
});
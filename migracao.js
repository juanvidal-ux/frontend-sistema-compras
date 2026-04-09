document.addEventListener("DOMContentLoaded", () => {
    
    const API_BASE_URL = "http://localhost:8080";

    const formUpload = document.getElementById("form-upload");
    const inputArquivo = document.getElementById("arquivo-excel");
    const btnValidar = document.getElementById("btn-validar-migracao");
    const btnExecutar = document.getElementById("btn-executar-migracao");
    const btnExcluir = document.getElementById("btn-excluir-migrados");
    const logContainer = document.getElementById("log-container");
    const logOutput = document.getElementById("log-output");

    let dadosValidados = null; 

    // --- VERIFICAÇÃO DE SEGURANÇA INICIAL ---
    const token = localStorage.getItem("authToken");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    function log(mensagem, tipo = "info") {
        let cor = "#fff"; 
        if (tipo === "error") cor = "#f87171"; 
        if (tipo === "success") cor = "#4ade80"; 
        if (tipo === "warn") cor = "#facc15"; 
        
        logOutput.innerHTML += `<span style="color:${cor};">[${tipo.toUpperCase()}] ${mensagem}</span><br>`;
        logOutput.scrollTop = logOutput.scrollHeight; 
    }
    
    function limparLog() {
        logContainer.style.display = 'block';
        logOutput.innerHTML = "";
    }

    // --- LÓGICA DO BOTÃO 1: VALIDAR (COM SEGURANÇA) ---
    btnValidar.addEventListener("click", async () => {
        const arquivo = inputArquivo.files[0];
        if (!arquivo) {
            Swal.fire('Erro', 'Por favor, selecione um ficheiro Excel primeiro.', 'error');
            return;
        }

        btnValidar.disabled = true;
        btnExecutar.disabled = true;
        btnValidar.textContent = "A validar...";
        logContainer.style.display = 'block';
        limparLog();
        log("Leitura do ficheiro iniciada...");
        dadosValidados = null;

        try {
            const data = await arquivo.arrayBuffer();
            const workbook = XLSX.read(data);

            const nomePrimeiraAba = workbook.SheetNames[0];
            log(`A ler a primeira aba encontrada: [${nomePrimeiraAba}]...`);
            
            const abaItens = workbook.Sheets[nomePrimeiraAba];
            if (!abaItens) throw new Error("Não foi possível ler a primeira aba do Excel.");

            const itens = XLSX.utils.sheet_to_json(abaItens, { 
                raw: false, 
                dateNF: "dd/mm/yyyy" 
            });

            log(`Encontrados ${itens.length} itens históricos. A enviar para validação no servidor...`, "warn");

            // FETCH COM TOKEN
            const response = await fetch(`${API_BASE_URL}/api/migracao/validar-v6`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": token // <--- TOKEN AQUI
                },
                body: JSON.stringify(itens) 
            });

            if (response.status === 401) {
                alert("Sessão expirada."); window.location.href = "login.html"; return;
            }

            const resultado = await response.json();

            if (response.ok) {
                log("--- VALIDAÇÃO CONCLUÍDA ---", "success");
                log(`Total de Linhas Processadas: ${resultado.linhasProcessadas}`, "success");
                log(`Avisos (Novos Cadastros): ${resultado.fornecedoresCriados + resultado.entidadesCriadas}`, "success");
                log(`Pedidos-Fantasma a Criar: ${resultado.pedidosCriados}`, "success");
                log(`Itens Históricos a Inserir: ${resultado.itensInseridos}`, "success");
                log("NENHUM ERRO ENCONTRADO. A migração está pronta para ser executada.", "success");

                dadosValidados = itens; 
                btnExecutar.disabled = false; 

            } else {
                log(`ERRO DE VALIDAÇÃO: ${resultado.mensagem}`, "error");
                Swal.fire('Erro de Validação', resultado.mensagem, 'error');
            }

        } catch (error) {
            log(`ERRO CRÍTICO: ${error.message}`, "error");
            Swal.fire('Erro na Validação', error.message, 'error');
        } finally {
            btnValidar.disabled = false;
            btnValidar.textContent = "1. Validar Planilha (Dry Run)";
        }
    });

    // --- LÓGICA DO BOTÃO 2: EXECUTAR (COM SEGURANÇA) ---
    formUpload.addEventListener("submit", async (event) => {
        event.preventDefault(); 

        if (!dadosValidados) {
            Swal.fire('Erro', 'Você deve clicar em "Validar Planilha" e obter sucesso antes de executar.', 'error');
            return;
        }

        const { isConfirmed } = await Swal.fire({
            title: 'Tem a certeza absoluta?',
            text: `Você está prestes a gravar ${dadosValidados.length} itens históricos no banco.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sim, executar migração!',
            cancelButtonText: 'Cancelar'
        });

        if (!isConfirmed) return;

        btnValidar.disabled = true;
        btnExecutar.disabled = true;
        btnExecutar.textContent = "A gravar...";
        log("--- INICIANDO MIGRAÇÃO (GRAVAÇÃO) ---", "warn");

        try {
            // FETCH COM TOKEN
            const response = await fetch(`${API_BASE_URL}/api/migracao/executar-v6`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": token // <--- TOKEN AQUI
                },
                body: JSON.stringify(dadosValidados)
            });

            if (response.status === 401) {
                alert("Sessão expirada."); window.location.href = "login.html"; return;
            }

            const resultado = await response.json();

            if (response.ok) {
                log("--- MIGRAÇÃO CONCLUÍDA E GRAVADA! ---", "success");
                log(`Pedidos-Fantasma Criados: ${resultado.pedidosCriados}`, "success");
                log(`Itens Históricos Inseridos: ${resultado.itensInseridos}`, "success");
                Swal.fire('Sucesso!', 'Os dados históricos foram gravados.', 'success');
                dadosValidados = null; 
            } else {
                throw new Error(resultado.mensagem || "Erro desconhecido no servidor.");
            }

        } catch (error) {
            log(`ERRO CRÍTICO NA GRAVAÇÃO: ${error.message}`, "error");
            Swal.fire('Erro na Migração', error.message, 'error');
            btnValidar.disabled = false; 
        } finally {
            btnExecutar.textContent = "2. Executar Migração (Gravar)";
        }
    });

    // --- LÓGICA DO BOTÃO DE EXCLUIR (COM SEGURANÇA) ---
    btnExcluir.addEventListener("click", async () => {
        
        const { isConfirmed } = await Swal.fire({
            title: 'EXCLUIR DADOS HISTÓRICOS?',
            text: "Isto irá apagar TODOS os pedidos marcados como 'Migração'. Esta ação é PERMANENTE.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sim, apagar tudo!',
            cancelButtonText: 'Cancelar'
        });

        if (!isConfirmed) return;

        limparLog();
        log("A enviar comando de exclusão para o servidor...", "warn");
        btnExcluir.disabled = true;
        btnExcluir.textContent = "A apagar...";

        try {
            // FETCH COM TOKEN
            const response = await fetch(`${API_BASE_URL}/api/migracao/excluir-migrados`, {
                method: 'DELETE',
                headers: { 
                    "Authorization": token // <--- TOKEN AQUI
                }
            });
            
            if (response.status === 401) {
                alert("Sessão expirada."); window.location.href = "login.html"; return;
            }

            const resultado = await response.json();

            if (response.ok) {
                log(resultado.mensagem, "success");
                Swal.fire('Excluído!', resultado.mensagem, 'success');
            } else {
                throw new Error(resultado.mensagem || "Erro desconhecido.");
            }
        } catch (error) {
             log(`ERRO AO EXCLUIR: ${error.message}`, "error");
            Swal.fire('Erro', error.message, 'error');
        } finally {
            btnExcluir.disabled = false;
            btnExcluir.textContent = "Excluir TODOS os Dados Migrados";
        }
    });
    
    inputArquivo.addEventListener("change", () => {
        btnExecutar.disabled = true; 
        dadosValidados = null;
    });
});
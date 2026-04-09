document.addEventListener("DOMContentLoaded", () => {
    
    const API_BASE_URL = "http://localhost:8080";
    const API_ENDPOINT = "/api/suporte/locais-entrega";

    const form = document.getElementById("form-local");
    const tbody = document.getElementById("corpo-tabela-cadastros");

    // ----- 1. CARREGAR LISTA (COM SEGURANÇA) -----
    async function carregarLista() {
        try {
            tbody.innerHTML = ""; // Limpa antes de carregar

            // 1. PEGA O TOKEN
            const token = localStorage.getItem("authToken");
            if (!token) {
                window.location.href = "login.html";
                return;
            }

            // 2. ENVIA TOKEN NO HEADER
            const response = await fetch(API_BASE_URL + API_ENDPOINT, {
                method: "GET",
                headers: {
                    "Authorization": token
                }
            });

            // 3. VERIFICA SE LOGIN É VÁLIDO
            if (response.status === 401 || response.status === 403) {
                alert("Sessão expirada. Faça login novamente.");
                window.location.href = "login.html";
                return;
            }

            if (!response.ok) throw new Error("Erro ao buscar locais.");
            
            const data = await response.json();

            if (data.length === 0) {
                tbody.innerHTML = "<tr><td colspan='4' style='text-align:center'>Nenhum local cadastrado.</td></tr>";
                return;
            }

            data.forEach(item => {
                const tr = document.createElement("tr");
                tr.setAttribute('data-id', item.id);
                tr.innerHTML = `
                    <td>${item.id}</td>
                    <td>${item.laboratorio}</td>
                    <td>${item.departamento}</td>
                    <td style="text-align:center">
                        <a href="#" class="btn-excluir" data-id="${item.id}" title="Excluir" style="background-color: #e74c3c; color: white; padding: 5px 10px; border-radius: 4px; text-decoration: none;">
                            <i class="fa-solid fa-trash"></i>
                        </a>
                    </td>
                `;
                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error(error);
            tbody.innerHTML = "<tr><td colspan='4' style='color:red; text-align:center'>Erro ao carregar a lista.</td></tr>";
        }
    }

    // ----- 2. SALVAR (POST COM SEGURANÇA) -----
    if (form) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault(); 

            const local = {
                laboratorio: document.getElementById("laboratorio").value,
                departamento: document.getElementById("departamento").value,
                endereco: document.getElementById("endereco").value,
                contatoResponsavel: document.getElementById("contatoResponsavel").value,
                contatoCargo: document.getElementById("contatoCargo").value,
                headerInstituicao: document.getElementById("headerInstituicao").value,
                headerContato: document.getElementById("headerContato").value
            };

            try {
                const token = localStorage.getItem("authToken");

                const response = await fetch(API_BASE_URL + API_ENDPOINT, {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": token // <--- TOKEN AQUI
                    },
                    body: JSON.stringify(local)
                });

                if (response.ok) {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: 'Local salvo com sucesso!',
                        showConfirmButton: false,
                        timer: 3000
                    });
                    form.reset(); 
                    carregarLista(); 
                } else {
                    throw new Error("Falha ao salvar o local.");
                }

            } catch (error) {
                console.error(error);
                Swal.fire('Erro', error.message || 'Erro ao salvar.', 'error');
            }
        });
    }

    // ----- 3. EXCLUIR (DELETE COM SEGURANÇA) -----
    tbody.addEventListener('click', async (event) => {
        // Verifica se clicou no botão ou no ícone
        const btn = event.target.closest('.btn-excluir');

        if (btn) {
            event.preventDefault(); 
            const id = btn.getAttribute('data-id');

            const result = await Swal.fire({
                title: 'Tem certeza?',
                text: `Deseja excluir o item ${id}?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc3545',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Sim, excluir!',
                cancelButtonText: 'Cancelar'
            });

            if (!result.isConfirmed) return;

            try {
                const token = localStorage.getItem("authToken");

                const response = await fetch(`${API_BASE_URL}${API_ENDPOINT}/${id}`, {
                    method: 'DELETE',
                    headers: {
                        "Authorization": token // <--- TOKEN AQUI
                    }
                });

                if (response.ok) {
                    const linhaParaRemover = document.querySelector(`tr[data-id="${id}"]`);
                    if (linhaParaRemover) linhaParaRemover.remove();
                    
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: 'Item excluído com sucesso!',
                        showConfirmButton: false,
                        timer: 3000
                    });
                } else {
                    throw new Error('Falha ao excluir (Verifique login).');
                }
            } catch (error) {
                console.error("Erro ao excluir:", error);
                Swal.fire('Erro', 'Erro ao excluir o item. Verifique se ele não está em uso.', 'error');
            }
        }
    });

    // Inicializa
    carregarLista();
});
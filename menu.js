document.addEventListener("DOMContentLoaded", () => {
    const menuPlaceholder = document.getElementById("menu-placeholder");
    
    if (menuPlaceholder) {
        fetch("menu.html")
            .then(response => response.text())
            .then(html => {
                menuPlaceholder.innerHTML = html;

                // --- LÓGICA DE PERMISSÃO ---
                const papel = localStorage.getItem("usuarioPapel");
                
                // Lista de IDs que APENAS ADMIN pode ver
                const itensRestritos = [
                    "menu-resumo", 
                    "menu-abc", 
                    "menu-detalhado", 
                    "menu-migracao",
                    "menu-usuarios",
                    "menu-auditoria" // <--- Adicionado aqui para garantir bloqueio
                ];

                if (papel !== "ADMIN") {
                    // Se NÃO for Admin, garante que tudo suma
                    itensRestritos.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.style.display = "none";
                    });
                } else {
                    // Se FOR Admin, mostra os botões especiais que nascem ocultos
                    const btnUsuarios = document.getElementById("menu-usuarios");
                    if (btnUsuarios) btnUsuarios.style.display = "block"; 
                    
                    const btnAuditoria = document.getElementById("menu-auditoria");
                    if (btnAuditoria) btnAuditoria.style.display = "block"; // <--- Mostra Auditoria
                }
            })
            .catch(err => {
                console.warn("Erro menu:", err);
            });
    }
});
// auth.js - Versão Diagnóstico

function realizarLogin(event) {
    event.preventDefault();

    const usuarioInput = document.getElementById("usuario");
    const senhaInput = document.getElementById("senha");
    const msgErro = document.getElementById("msg-erro");
    const btnEntrar = document.querySelector("button[type='submit']");

    console.log("1. Iniciando tentativa de login...");
    console.log("   Usuário:", usuarioInput.value);

    // 1. Cria o Token
    const token = btoa(usuarioInput.value + ":" + senhaInput.value);
    const authHeader = "Basic " + token;

    btnEntrar.innerHTML = 'Verificando...';
    btnEntrar.disabled = true;
    msgErro.style.display = "none";

    // 2. Tenta conectar
    console.log("2. Enviando requisição para /api/auth/me...");
    
    fetch("https://backend-sistema-comprass.onrender.com/api/auth/me", {
        method: "GET",
        headers: {
            "Authorization": authHeader
        }
    })
    .then(async response => {
        console.log("3. Resposta do Servidor recebida.");
        console.log("   Status Code:", response.status); // 200 = Sucesso, 401 = Senha Errada

        if (response.ok) {
            console.log("4. Login SUCESSO! Convertendo JSON...");
            return response.json(); 
        } else {
            const textoErro = await response.text();
            console.error("4. ERRO no Login:", textoErro);
            throw new Error(`Erro ${response.status}: Senha incorreta ou usuário não existe.`);
        }
    })
    .then(dadosUsuario => {
        console.log("5. Dados do Usuário recebidos:", dadosUsuario);
        
        localStorage.setItem("authToken", authHeader);
        localStorage.setItem("usuarioLogado", dadosUsuario.login);
        localStorage.setItem("usuarioPapel", dadosUsuario.papel);
        
        console.log("6. Redirecionando para pedidos.html...");
        window.location.href = "pedidos.html";
    })
    .catch(error => {
        console.error("--- FALHA ---", error);
        msgErro.style.display = "block";
        msgErro.textContent = "Erro: " + error.message;
        
        btnEntrar.innerHTML = 'Entrar';
        btnEntrar.disabled = false;
    });
}

function sair() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("usuarioPapel");
    window.location.href = "login.html";
}

// Verificação simples para páginas internas
function verificarAcesso() {
    // 1. Verifica se está logado
    if (!window.location.pathname.includes("login.html")) {
        const token = localStorage.getItem("authToken");
        const papel = localStorage.getItem("usuarioPapel");

        if (!token) {
            window.location.href = "login.html";
            return;
        }

        // 2. LISTA NEGRA: Páginas que USER não pode entrar
        const paginasProibidasParaUser = [
            "resumo.html",
            "abc.html",
            "financeiro.html",
            "migracao.html",
            "usuarios.html",
            "auditoria.html"
        ];

        // Verifica a URL atual
        const paginaAtual = window.location.pathname.split("/").pop();

        // Se for USER e tentar entrar em página proibida -> Chuta para Pedidos
        if (papel !== "ADMIN" && paginasProibidasParaUser.includes(paginaAtual)) {
            alert("Acesso restrito a Administradores.");
            window.location.href = "pedidos.html";
        }
    }
}

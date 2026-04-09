// mascaras.js - Formatação automática

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Máscara CNPJ (00.000.000/0000-00)
    const cnpjs = document.querySelectorAll("#cnpj"); // Pega input com id="cnpj"
    cnpjs.forEach(input => {
        input.addEventListener("input", (e) => {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2})/);
            e.target.value = !x[2] ? x[1] : x[1] + '.' + x[2] + '.' + x[3] + '/' + x[4] + (x[5] ? '-' + x[5] : '');
        });
    });

    // 2. Máscara Telefone ((00) 00000-0000)
    const telefones = document.querySelectorAll("#telefone");
    telefones.forEach(input => {
        input.addEventListener("input", (e) => {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        });
    });

    // 3. Máscara Dinheiro (Para inputs de valor unitário)
    // Aplica em inputs com classe .input-vlr-unit (usados no app.js e editar-pedido.js)
    // Nota: Como o seu sistema usa <input type="number">, máscara de texto pode conflitar.
    // Se quiser máscara visual bonita, teria que mudar o input para type="text"
    // Por enquanto, vamos deixar o type="number" padrão do HTML5 que é mais seguro para o cálculo.
});
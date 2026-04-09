// loader.js - Controle do Feedback Visual

document.addEventListener("DOMContentLoaded", () => {
    // 1. Injeta o HTML do Loader na página automaticamente
    const loaderHTML = `
        <div id="global-loader" class="loading-overlay">
            <div class="spinner"></div>
            <div class="loading-text">A processar...</div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loaderHTML);
});

// Funções Globais para chamar em qualquer lugar
window.mostrarLoading = (texto = "A processar...") => {
    const loader = document.getElementById("global-loader");
    const textoEl = loader.querySelector(".loading-text");
    if (loader) {
        textoEl.textContent = texto;
        loader.style.display = "flex";
    }
};

window.esconderLoading = () => {
    const loader = document.getElementById("global-loader");
    if (loader) {
        loader.style.display = "none";
    }
};
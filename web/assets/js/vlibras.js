/**
 * Componente Global do VLibras - LogiStock
 */
function inicializarVLibras() {
  // 1. Cria a estrutura de DIVs do VLibras original
  const vlibrasContainer = document.createElement('div');
  vlibrasContainer.setAttribute('vw', '');
  vlibrasContainer.classList.add('enabled');

  vlibrasContainer.innerHTML = `
    <div vw-access-button class="active"></div>
    <div vw-plugin-wrapper>
      <div class="vw-plugin-top-wrapper"></div>
    </div>
  `;

  // Injeta a estrutura no final do body
  document.body.appendChild(vlibrasContainer);

  // 2. Cria e injeta a tag de script do plugin oficial
  const scriptPlugin = document.createElement('script');
  scriptPlugin.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
  scriptPlugin.async = true;

  // 3. Executa a inicialização do widget assim que o script carregar
  scriptPlugin.onload = () => {
    if (window.VLibras && window.VLibras.Widget) {
      new window.VLibras.Widget('https://vlibras.gov.br/app');
    }
  };

  document.head.appendChild(scriptPlugin);
}

// Garante que o DOM está pronto para receber os elementos antes de rodar
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", inicializarVLibras);
} else {
  inicializarVLibras();
}
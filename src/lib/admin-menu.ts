// Preferência do menu lateral, guardada no navegador. O atributo no <html> é aplicado por
// um script antes da primeira pintura, para o menu não abrir e fechar ao carregar a página.

export const MENU_STORAGE_KEY = "insyt-menu";

export const MENU_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("${MENU_STORAGE_KEY}")==="recolhido")document.documentElement.setAttribute("data-menu","recolhido")}catch(e){}})()`;

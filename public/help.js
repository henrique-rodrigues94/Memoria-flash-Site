(() => {
  const HELP_ID = "memoriaflash-help-panel";
  const NAV_ID = "memoriaflash-help-nav";

  function loadStudyStyles() {
    if (document.getElementById("memoriaflash-study-first-css")) return;
    const link = document.createElement("link");
    link.id = "memoriaflash-study-first-css";
    link.rel = "stylesheet";
    link.href = "/study-first.css";
    document.head.appendChild(link);
  }

  function openHelp() {
    const main = document.querySelector(".main");
    if (!main) return;
    const existing = document.getElementById(HELP_ID);
    if (existing) return;

    document.querySelectorAll(".main > .page").forEach((page) => {
      page.dataset.helpHidden = "true";
      page.style.display = "none";
    });

    const panel = document.createElement("section");
    panel.id = HELP_ID;
    panel.className = "help-page-shell";
    panel.innerHTML = `
      <div class="help-page">
        <header class="help-hero">
          <div>
            <span class="help-eyebrow">CENTRAL DE AJUDA</span>
            <h1>Como podemos melhorar o MemoriaFlash?</h1>
            <p>Envie uma sugestão, relate um problema ou conte o que você gostaria de ver nas próximas versões.</p>
          </div>
          <div class="help-hero-icon">?</div>
        </header>
        <div class="help-grid">
          <article class="help-card"><div class="help-card-icon">💡</div><h2>Sugestão de melhoria</h2><p>Tem uma ideia para deixar seus estudos mais rápidos, simples ou úteis?</p></article>
          <article class="help-card"><div class="help-card-icon">🐛</div><h2>Encontrou um problema?</h2><p>Descreva o que aconteceu e, se possível, diga em qual tela ocorreu.</p></article>
          <article class="help-card"><div class="help-card-icon">✨</div><h2>Nova funcionalidade</h2><p>Conte qual recurso você gostaria de encontrar no MemoriaFlash.</p></article>
        </div>
        <form class="help-feedback-form" id="memoriaflash-feedback-form">
          <div class="help-form-head"><div><h2>Enviar feedback</h2><p>Seu feedback ajuda a definir as próximas melhorias.</p></div></div>
          <div class="help-form-grid">
            <label>Tipo de feedback<select name="type" required><option value="Sugestão">Sugestão</option><option value="Problema">Problema</option><option value="Dúvida">Dúvida</option><option value="Nova funcionalidade">Nova funcionalidade</option></select></label>
            <label>Tela relacionada<select name="screen"><option>Início</option><option>Meus baralhos</option><option>Estudo</option><option>Progresso</option><option>Login</option><option>Outra</option></select></label>
            <label class="help-full">Mensagem<textarea name="message" rows="6" maxlength="2000" placeholder="Escreva aqui o que você gostaria de melhorar..." required></textarea></label>
          </div>
          <div class="help-form-foot"><span>Não envie senhas ou informações sensíveis.</span><button class="primary" type="submit">Enviar feedback</button></div>
          <div class="help-feedback-status" id="memoriaflash-feedback-status" role="status"></div>
        </form>
      </div>`;

    const topbar = main.querySelector(".topbar");
    if (topbar) topbar.insertAdjacentElement("afterend", panel);
    else main.prepend(panel);

    const active = document.getElementById(NAV_ID);
    if (active) active.classList.add("active");

    document.getElementById("memoriaflash-feedback-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const type = data.get("type");
      const screen = data.get("screen");
      const message = String(data.get("message") || "").trim();
      const status = document.getElementById("memoriaflash-feedback-status");
      if (!message) return;
      const subject = `[MemoriaFlash] ${type} - ${screen}`;
      const body = `Tipo: ${type}\nTela: ${screen}\n\nFeedback:\n${message}`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      if (status) status.textContent = "Abrindo seu aplicativo de e-mail para enviar o feedback...";
    });
  }

  function installNav() {
    loadStudyStyles();
    const nav = document.querySelector(".sidebar nav");
    if (!nav || document.getElementById(NAV_ID)) return;
    const button = document.createElement("button");
    button.id = NAV_ID;
    button.className = "nav-item";
    button.type = "button";
    button.innerHTML = '<span aria-hidden="true">?</span><span>Ajuda</span>';
    button.addEventListener("click", openHelp);
    nav.appendChild(button);
  }

  function restorePublicHomeAfterLogout() {
    const loginScreen = document.querySelector(".login-screen");
    if (!loginScreen) return;

    document.body.classList.remove("app-mode");

    if (window.location.hash === "#app") {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }

    window.scrollTo(0, 0);
  }

  function observeApp() {
    installNav();
    const root = document.getElementById("root");
    if (root) {
      const observer = new MutationObserver(() => {
        installNav();
        restorePublicHomeAfterLogout();
      });
      observer.observe(root, { childList: true, subtree: true });
    }
    restorePublicHomeAfterLogout();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observeApp);
  else observeApp();

  document.addEventListener("click", (event) => {
    if (event.target.closest(".nav-item") && !event.target.closest(`#${NAV_ID}`)) {
      const panel = document.getElementById(HELP_ID);
      if (panel) {
        panel.remove();
        document.querySelectorAll('.main > .page[data-help-hidden="true"]').forEach((page) => {
          page.style.display = "";
          delete page.dataset.helpHidden;
        });
      }
    }
  });
})();

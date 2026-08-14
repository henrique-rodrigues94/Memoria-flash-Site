(() => {
  function enhanceLogin() {
    const card = document.querySelector('.login-card');
    if (!card || card.querySelector('.login-note')) return;
    const button = card.querySelector('.login-button');
    if (!button) return;
    const note = document.createElement('p');
    note.className = 'login-note';
    note.textContent = 'Ao entrar, o Google pode abrir uma janela para você escolher sua conta. Isso faz parte do login seguro.';
    button.insertAdjacentElement('afterend', note);
  }
  const run = () => enhanceLogin();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  const root = document.getElementById('root');
  if (root) new MutationObserver(enhanceLogin).observe(root, {childList:true, subtree:true});
})();

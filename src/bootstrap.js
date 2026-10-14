// A failed import must show a recoverable error instead of an empty page.
import('./main.js').catch(error => {
  console.error('Base Quest startup failed', error);
  const box = document.createElement('section');
  box.style.cssText = 'background:#020617;color:#e2e8f0;padding:32px;font:16px system-ui;min-height:100vh';
  const title = document.createElement('h1'); title.textContent = 'Base Quest could not start';
  const detail = document.createElement('p'); detail.textContent = error?.message || String(error);
  const help = document.createElement('p'); help.textContent = 'Check the deployment settings and reload. No wallet transaction was sent.';
  const button = document.createElement('button'); button.textContent = 'Reload'; button.onclick = () => location.reload();
  box.append(title, detail, help, button); document.querySelector('#app').replaceChildren(box);
});

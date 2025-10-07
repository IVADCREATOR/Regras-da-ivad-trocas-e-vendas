const RULES_KEY = 'group_rules_v1';
const NAME_KEY = 'group_name_v1';

document.addEventListener('DOMContentLoaded', init);

function init() {
  document.getElementById('year').textContent = new Date().getFullYear();

  const name = localStorage.getItem(NAME_KEY) || 'Regras do Grupo';
  document.getElementById('group-name').textContent = name;

  const rules = localStorage.getItem(RULES_KEY);
  rules ? showRules(rules) : showPlaceholder();

  // Botões
  document.getElementById('edit-rules-btn').addEventListener('click', openEditor);
  document.getElementById('save-rules-btn').addEventListener('click', saveRules);
  document.getElementById('cancel-edit-btn').addEventListener('click', closeEditor);
  document.getElementById('copy-btn').addEventListener('click', copyRules);
  document.getElementById('download-btn').addEventListener('click', downloadRules);
  document.getElementById('reset-btn').addEventListener('click', resetAll);
  document.getElementById('edit-name-btn').addEventListener('click', editName);
}

function showRules(text) {
  const html = text
    .split(/\n\n+/)
    .map(par => `<p>${escapeHtml(par).replace(/\n/g, '<br>')}</p>`)
    .join('');
  document.getElementById('rules-display').innerHTML = html;
}

function showPlaceholder() {
  document.getElementById('rules-display').innerHTML =
    '<p class="muted">As regras serão adicionadas aqui em breve...</p>';
}

function openEditor() {
  document.getElementById('rules-textarea').value = localStorage.getItem(RULES_KEY) || '';
  document.getElementById('editor').classList.remove('hidden');
  document.getElementById('edit-rules-btn').disabled = true;
}

function closeEditor() {
  document.getElementById('editor').classList.add('hidden');
  document.getElementById('edit-rules-btn').disabled = false;
}

function saveRules() {
  const text = document.getElementById('rules-textarea').value.trim();
  if (!text && !confirm('O texto está vazio. Deseja salvar mesmo assim?')) return;

  localStorage.setItem(RULES_KEY, text);
  closeEditor();
  text ? showRules(text) : showPlaceholder();
  alert('Regras salvas localmente no seu navegador.');
}

function copyRules() {
  const text = localStorage.getItem(RULES_KEY);
  if (!text) return alert('Não há regras salvas para copiar.');

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => alert('Regras copiadas!')).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    alert('Regras copiadas!');
  } catch {
    alert('Não foi possível copiar automaticamente.');
  }
  ta.remove();
}

function downloadRules() {
  const text = localStorage.getItem(RULES_KEY) || '';
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'regras.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resetAll() {
  if (!confirm('Deseja redefinir nome e regras?')) return;

  localStorage.removeItem(RULES_KEY);
  localStorage.removeItem(NAME_KEY);
  showPlaceholder();
  document.getElementById('group-name').textContent = 'Regras do Grupo';
  alert('Redefinido.');
}

function editName() {
  const newName = prompt('Digite o nome do grupo:', localStorage.getItem(NAME_KEY) || 'Regras do Grupo');
  if (newName !== null) {
    const trimmed = newName.trim() || 'Regras do Grupo';
    localStorage.setItem(NAME_KEY, trimmed);
    document.getElementById('group-name').textContent = trimmed;
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
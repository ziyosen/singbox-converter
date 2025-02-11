let editor;
document.addEventListener('DOMContentLoaded', () => {
  editor = ace.edit("editor");
  editor.setTheme("ace/theme/monokai");
  editor.session.setMode("ace/mode/json");
  editor.setReadOnly(true);
  editor.setOption("wrap", true);
  editor.setShowPrintMargin(false);
});
function clearAll() {
  document.getElementById('input').value = '';
  editor.setValue('');
  document.getElementById('error').textContent = '';
}
function copyToClipboard() {
  const content = editor.getValue();
  if (!content) return;
  navigator.clipboard.writeText(content)
    .then(() => alert('Configuration copied to clipboard!'))
    .catch(err => console.error('Failed to copy:', err));
}
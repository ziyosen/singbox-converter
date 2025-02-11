let editor;

document.addEventListener('DOMContentLoaded', () => {
    editor = ace.edit("editor");
    editor.setTheme("ace/theme/monokai");
    editor.session.setMode("ace/mode/json");
    editor.setReadOnly(true);
    editor.setOption("wrap", true);
    editor.setShowPrintMargin(false);
    editor.session.setUseWorker(false);
    
    document.getElementById('mtu').value = 1500;
    document.getElementById('main-dns').value = 'local';
    document.getElementById('alt-dns').value = 'tls://1.1.1.1';
});

function clearAll() {
    document.getElementById('input').value = '';
    editor.setValue('');
    document.getElementById('error').textContent = '';
    document.getElementById('mtu').value = 1500;
    document.getElementById('main-dns').value = 'local';
    document.getElementById('alt-dns').value = 'tls://1.1.1.1';
}

function copyToClipboard() {
    const content = editor.getValue();
    if (!content) return;
    navigator.clipboard.writeText(content)
        .then(() => alert('کانفیگ با موفقیت کپی شد!'))
        .catch(err => console.error('خطا در کپی:', err));
}
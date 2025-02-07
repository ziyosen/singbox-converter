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

function typeText(text) {
    let currentText = '';
    let index = 0;
    editor.setValue('');
    
    function type() {
        if (index < text.length) {
            currentText += text[index];
            try {
                const parsed = JSON.parse(currentText);
                editor.setValue(JSON.stringify(parsed, null, 2));
                editor.clearSelection();
            } catch(e) {}
            index++;
            setTimeout(type, 30);
        }
    }
    
    type();
}
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
    editor.setValue('');
    const lines = JSON.stringify(JSON.parse(text), null, 2).split('\n');
    let currentLine = 0;
    let currentChar = 0;

    function typeNextChar() {
        if (currentLine < lines.length) {
            const line = lines[currentLine];
            
            if (currentChar <= line.length) {
                editor.setValue(lines.slice(0, currentLine).join('\n') + 
                    (lines.slice(0, currentLine).length > 0 ? '\n' : '') + 
                    line.slice(0, currentChar));
                
                currentChar++;
                setTimeout(typeNextChar, 20);
            } else {
                currentLine++;
                currentChar = 0;
                setTimeout(typeNextChar, 20);
            }
        }
    }

    typeNextChar();
}
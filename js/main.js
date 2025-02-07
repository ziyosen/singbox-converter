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
    const formattedText = JSON.stringify(JSON.parse(text), null, 2);
    
    editor.setValue('');
    
    const lines = formattedText.split('\n');
    
    let currentLine = 0;
    let currentChar = 0;

    function typeNextChar() {
        if (currentLine >= lines.length) {
            return;
        }

        const line = lines[currentLine];

        if (currentChar >= line.length) {
            editor.insert('\n');
            currentLine++;
            currentChar = 0;
            
            setTimeout(typeNextChar, 50);
            return;
        }

        editor.insert(line[currentChar]);
        currentChar++;

        setTimeout(typeNextChar, Math.random() * 30 + 10);
    }

    typeNextChar();
}
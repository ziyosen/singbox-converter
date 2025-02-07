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

function typeText(jsonText) {
    editor.setValue('');
    
    const lines = JSON.stringify(JSON.parse(jsonText), null, 2).split('\n');
    let currentLine = 0;
    
    function animateLine() {
        if (currentLine < lines.length) {
            const line = lines[currentLine];
            let charIndex = 0;
            
            function typeChar() {
                if (charIndex <= line.length) {
                    const partialLine = line.substring(0, charIndex);
                    const fullContent = lines.slice(0, currentLine).join('\n') + 
                                        (currentLine > 0 ? '\n' : '') + 
                                        partialLine;
                    
                    editor.setValue(fullContent);
                    editor.clearSelection();
                    
                    charIndex++;
                    setTimeout(typeChar, 20);
                } else {
                    currentLine++;
                    setTimeout(animateLine, 50);
                }
            }
            
            typeChar();
        }
    }
    
    animateLine();
}
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

function showTerminalLoading() {
    const editor = document.getElementById('editor');
    const lines = [
        'Initializing conversion...',
        'Parsing input configuration...',
        'Generating Sing-box configuration...',
        'Optimizing network settings...',
        'Finalizing configuration...'
    ];
    
    editor.innerHTML = '';
    let lineIndex = 0;
    
    function typeLine() {
        if (lineIndex < lines.length) {
            const line = document.createElement('div');
            line.classList.add('terminal-line');
            line.style.color = '#4CAF50';
            
            let charIndex = 0;
            function typeChar() {
                if (charIndex < lines[lineIndex].length) {
                    line.textContent += lines[lineIndex][charIndex];
                    charIndex++;
                    setTimeout(typeChar, 50);
                } else {
                    editor.appendChild(line);
                    lineIndex++;
                    setTimeout(typeLine, 500);
                }
            }
            
            typeChar();
        }
    }
    
    typeLine();
}

function convertConfig() {
    const input = document.getElementById('input').value.trim();
    const errorDiv = document.getElementById('error');
    const convertButton = document.querySelector('button[onclick="convertConfig()"]');
    const clearButton = document.querySelector('button[onclick="clearAll()"]');
    
    clearButton.disabled = true;
    
    if (!input) {
        errorDiv.textContent = 'Please enter a proxy configuration';
        clearButton.disabled = false;
        return;
    }
    
    showTerminalLoading();
    
    setTimeout(() => {
        try {
            let config;
            if (input.startsWith('vmess://')) {
                config = convertVmess(input);
            } else if (input.startsWith('vless://')) {
                config = convertVless(input);
            } else if (input.startsWith('trojan://')) {
                config = convertTrojan(input);
            } else if (input.startsWith('hysteria2://') || input.startsWith('hy2://')) {
                config = convertHysteria2(input);
            } else if (input.startsWith('ss://')) {
                config = convertShadowsocks(input);
            } else {
                throw new Error('Unsupported protocol');
            }
            
            const singboxConfig = createSingboxConfig(config);
            const jsonString = JSON.stringify(singboxConfig, null, 2);
            
            editor.setValue(jsonString);
            editor.clearSelection();
            errorDiv.textContent = '';
            
            clearButton.disabled = false;
        } catch (error) {
            errorDiv.textContent = error.message;
            editor.setValue('');
            
            clearButton.disabled = false;
        }
    }, 3000);
}
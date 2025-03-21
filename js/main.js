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
    document.getElementById('downloadButton').disabled = true;
}

function copyToClipboard() {
    const content = editor.getValue();
    if (!content) return;
    navigator.clipboard.writeText(content)
        .then(() => alert('Configuration copied to clipboard!'))
        .catch(err => console.error('Failed to copy:', err));
}

function copySubscriptionLink() {
    const link = document.querySelector('.subscription-input').value;
    navigator.clipboard.writeText(link)
        .then(() => alert('Subscription link copied to clipboard!'))
        .catch(err => console.error('Failed to copy:', err));
}

function downloadJSON() {
    const content = editor.getValue();
    if (!content) return;
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'singbox-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function pasteFromClipboard() {
    try {
        navigator.clipboard.readText()
            .then(text => {
                document.getElementById('input').value = text;
            })
            .catch(err => {
                alert('Please allow clipboard access to paste content');
                console.error('Failed to paste:', err);
            });
    }
    catch {
        alert('Please allow clipboard access to paste content');
    }
}

async function pasteFromURL() {
    const url = prompt('Enter URL:');
    if (!url) return;

    try {
        startLoading();
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        document.getElementById('input').value = text;
    } catch (err) {
        alert('Failed to fetch from URL: ' + err.message);
        console.error('Failed to fetch:', err);
    } finally {
        stopLoading();
    }
}

function pasteFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json,.yaml,.yml,.conf,.vless,.vmess,.trojan,.hysteria,.ss,.ssr,.vlessconf,.vmessconf,.trojanconf,.hysteriaconf,.ssconf,.ssrconf';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('input').value = e.target.result;
        };
        reader.onerror = function(e) {
            alert('Error reading file');
            console.error('File read error:', e);
        };
        reader.readAsText(file);
    };

    input.click();
}
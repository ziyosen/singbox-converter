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
    editor.setValue('');
    
    function animateTyping() {
        return new Promise((resolve) => {
            const totalDuration = 2000;
            const slowPartLength = text.length * 0.3;
            const fastPartLength = text.length - slowPartLength;

            function typeSection(startIndex, endIndex, duration) {
                return new Promise((sectionResolve) => {
                    let start = startIndex;
                    const step = () => {
                        if (start < endIndex) {
                            currentText = text.slice(0, start + 1);
                            try {
                                const parsed = JSON.parse(currentText);
                                editor.setValue(JSON.stringify(parsed, null, 2));
                                editor.clearSelection();
                            } catch(e) {}
                            start++;
                            requestAnimationFrame(step);
                        } else {
                            sectionResolve();
                        }
                    };
                    step();
                });
            }

            typeSection(0, slowPartLength, totalDuration * 0.6)
                .then(() => typeSection(slowPartLength, text.length, totalDuration * 0.4))
                .then(resolve);
        });
    }

    animateTyping();
}
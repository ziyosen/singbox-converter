function startLoading() {
    const loadingEl = document.getElementById('loading');
    const convertButton = document.querySelector('button[onclick="convertConfig()"]');
    const clearButton = document.getElementById('clearButton');
    
    loadingEl.style.display = 'flex';
    convertButton.disabled = true;
    clearButton.disabled = true;
}

function stopLoading() {
    const loadingEl = document.getElementById('loading');
    const convertButton = document.querySelector('button[onclick="convertConfig()"]');
    const clearButton = document.getElementById('clearButton');
    
    loadingEl.style.display = 'none';
    convertButton.disabled = false;
    clearButton.disabled = false;
}
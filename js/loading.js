function startLoading() {
    const loadingEl = document.getElementById('loading');
    const convertButton = document.querySelector('button[onclick="convertConfig()"]');
    const clearButton = document.getElementById('clearButton');
    const tunModeButton = document.getElementById('tunModeButton');


    loadingEl.style.display = 'flex';
    convertButton.disabled = true;
    clearButton.disabled = true;
    tunModeButton.disabled = true;


}

function stopLoading() {
    const loadingEl = document.getElementById('loading');
    const convertButton = document.querySelector('button[onclick="convertConfig()"]');
    const clearButton = document.getElementById('clearButton');
     const tunModeButton = document.getElementById('tunModeButton');


    loadingEl.style.display = 'none';
    convertButton.disabled = false;
    clearButton.disabled = false;
    tunModeButton.disabled = false;
}

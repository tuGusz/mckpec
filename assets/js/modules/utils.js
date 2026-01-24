function parseDataPTBR(dataStr) {
    if (!dataStr) return new Date(0);
    if (dataStr === "Aguardando...") return new Date(0);
    if (dataStr.indexOf(' ') === -1) return new Date(0);

    try {
        const [dateValues, timeValues] = dataStr.split(' ');
        if (!timeValues) return new Date(0);

        const [day, month, year] = dateValues.split('/');
        const [hours, minutes, seconds] = timeValues.split(':');
        
        return new Date(+year, +month - 1, +day, +hours, +minutes, +seconds);
    } catch (e) {
        console.error("Erro ao converter data:", dataStr);
        return new Date(0); 
    }
}

function compararVersoes(v1, v2) {
    if (!v1 || v1 === "N/A") return -1;
    if (!v2) return 1;
    
    const partes1 = v1.split('.').map(Number);
    const partes2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(partes1.length, partes2.length); i++) {
        const num1 = partes1[i] || 0;
        const num2 = partes2[i] || 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    return 0;
}

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function adicionarLogConsole(nome, msg) {
    if (!msg) return;  
    
    const consoleBody = document.getElementById('console-body');
    const hora = new Date().toLocaleTimeString('pt-BR');
 
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `
        <span class="log-time">[${hora}]</span>
        <span class="log-host">${nome}:</span>
        <span class="log-msg">${msg}</span>
    `;
    
 
    consoleBody.appendChild(div);
    consoleBody.scrollTop = consoleBody.scrollHeight;
}
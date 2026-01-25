let logListenerAtivo = null; 
let currentLogHwid = null; // <--- NOVA VARIÁVEL GLOBAL

function abrirVisualizadorLogs(hwid) {
    if (!isUserAdmin) { alert("Acesso restrito a administradores."); return; }

    // Salva o ID atual para podermos limpar depois
    currentLogHwid = hwid; 

    const overlay = document.getElementById('log-focus-overlay');
    const placeholder = document.getElementById('card-focus-placeholder');
    const viewer = document.getElementById('log-viewer-content');
    
    // --- LÓGICA VISUAL (MANTÉM IGUAL) ---
    const cliente = dadosGlobais[hwid];
    const agora = new Date();
    const dataUltima = parseDataPTBR(cliente ? cliente.ultima_atualizacao : "");
    const difSegundos = (agora - dataUltima) / 1000;
    const isOnline = difSegundos <= 600; 

    const cardOriginal = document.getElementById(`card-${hwid}`);
    if (cardOriginal) {
        placeholder.innerHTML = ""; 
        const clone = cardOriginal.cloneNode(true);
        clone.id = `clone-${hwid}`;
        clone.classList.remove('h-100'); 
        placeholder.appendChild(clone);
    }

    overlay.classList.remove('d-none');

    // Se estiver offline, mostra erro e sai
    if (!isOnline) {
        viewer.innerHTML = `
            <div class="h-100 d-flex flex-column justify-content-center align-items-center">
                <div class="p-4 rounded-circle bg-danger bg-opacity-10 mb-3 text-danger">
                    <i class="bi bi-wifi-off" style="font-size: 2.5rem;"></i>
                </div>
                <h5 class="fw-bold text-white mb-2">Agente Offline</h5>
                <p class="text-white-50 text-center px-5 mb-4 small">
                    Não é possível acessar o arquivo de logs local.
                </p>
                <button class="btn btn-outline-light btn-sm mt-4 px-4 rounded-pill" onclick="fecharVisualizadorLogs()">
                    Voltar
                </button>
            </div>`;
        return;
    }

    // Loading
    viewer.innerHTML = `
        <div class="h-100 d-flex flex-column justify-content-center align-items-center text-white-50">
            <div class="spinner-border text-primary mb-3"></div>
            <p>Solicitando arquivo CSV ao Agente...</p>
        </div>`;

    // Solicita os logs
    firebase.database().ref(`clientes/${hwid}/comando`).set("request_logs");

    // Escuta a resposta
    const logsRef = firebase.database().ref(`clientes/${hwid}/logs_temp`);
    if(logListenerAtivo) logsRef.off();

    logListenerAtivo = logsRef.on('value', (snapshot) => {
        const dados = snapshot.val();
        if (dados && dados !== "Aguardando...") {
            renderizarTabelaLogs(dados);
        }
    });
}

function fecharVisualizadorLogs() {
    document.getElementById('log-focus-overlay').classList.add('d-none');
    document.getElementById('card-focus-placeholder').innerHTML = ''; 

    // Desliga o listener para economizar dados
    if(logListenerAtivo && currentLogHwid) {
        const logsRef = firebase.database().ref(`clientes/${currentLogHwid}/logs_temp`);
        logsRef.off(); // Para de escutar
    }

    // --- A MÁGICA DA LIMPEZA ---
    // Apaga os logs do Firebase para liberar espaço
    if (currentLogHwid) {
        firebase.database().ref(`clientes/${currentLogHwid}/logs_temp`).remove()
            .then(() => console.log("Logs temporários limpos do servidor."))
            .catch(err => console.error("Erro ao limpar logs:", err));
        
        currentLogHwid = null;
    }
}
 
let cacheLogAtual = ""; 
function renderizarTabelaLogs(csvRaw) {
    const viewer = document.getElementById('log-viewer-content');
    cacheLogAtual = csvRaw;

    if(!csvRaw) {
        viewer.innerHTML = '<div class="p-4 text-center text-muted">Log vazio ou inexistente.</div>';
        return;
    }

    let linhas = csvRaw.split('\n');
    linhas = linhas.filter(l => l.trim().length > 5);

    const indexHeader = linhas.findIndex(l => l.toUpperCase().includes("DATA_HORA") || l.toUpperCase().includes("DATA;"));
    if (indexHeader > -1) {
        linhas.splice(indexHeader, 1);
    }

    linhas.reverse(); 
    
    let html = '';
    html += `
        <div class="log-row header-row">
            <div class="l-time">DATA / HORA</div>
            <div class="l-type text-center">TIPO</div>
            <div class="l-msg">MENSAGEM DO SISTEMA</div>
        </div>`;

    linhas.forEach(linha => {
        const cols = linha.split(';');
        if(cols.length >= 3) {
            const data = cols[0];
            const tipo = cols[1];
            const msg = cols.slice(2).join(';'); 

            html += `
                <div class="log-row">
                    <div class="l-time">${data}</div>
                    <div class="l-type type-${tipo}">${tipo}</div>
                    <div class="l-msg">${msg}</div>
                </div>`;
        }
    });

    viewer.innerHTML = html;
}

function baixarLogsAtuais() {
    if (!cacheLogAtual) {
        alert("Nenhum log carregado para baixar.");
        return;
    }

    const blob = new Blob([cacheLogAtual], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const dataHoje = new Date().toISOString().slice(0,10);
    link.setAttribute("download", `auditoria_mck_${dataHoje}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function toggleConsoleLogs() {
    const consoleDiv = document.getElementById('console-container');
    if (consoleDiv.classList.contains('d-none')) {
        consoleDiv.classList.remove('d-none');
    } else {
        consoleDiv.classList.add('d-none');
    }
}

function limparConsole() {
    document.getElementById('console-body').innerHTML = '<div class="log-entry text-muted fst-italic">Console limpo.</div>';
}

let logListenerAtivo = null; // Para desligar o listener ao fechar
function abrirVisualizadorLogs(hwid) {
    if (!isUserAdmin) { alert("Acesso restrito a administradores."); return; }

    const overlay = document.getElementById('log-focus-overlay');
    const placeholder = document.getElementById('card-focus-placeholder');
    const viewer = document.getElementById('log-viewer-content');
    
    // --- 1. VERIFICAÇÃO DE STATUS (NOVO) ---
    const cliente = dadosGlobais[hwid];
    const agora = new Date();
    // Usa a mesma lógica de tempo do renderizarCards (10 min = 600s)
    const dataUltima = parseDataPTBR(cliente ? cliente.ultima_atualizacao : "");
    const difSegundos = (agora - dataUltima) / 1000;
    const isOnline = difSegundos <= 600; 

    // 2. Clona o card original (Para o efeito visual funcionar mesmo offline)
    const cardOriginal = document.getElementById(`card-${hwid}`);
    if (cardOriginal) {
        placeholder.innerHTML = ""; 
        const clone = cardOriginal.cloneNode(true);
        clone.id = `clone-${hwid}`;
        clone.classList.remove('h-100'); 
        placeholder.appendChild(clone);
    }

    // 3. Mostra o Overlay
    overlay.classList.remove('d-none');

    // --- 4. BLOQUEIO SE ESTIVER OFFLINE ---
    if (!isOnline) {
        // Exibe o "Pop-up" de erro dentro da área de logs
        viewer.innerHTML = `
            <div class="h-100 d-flex flex-column justify-content-center align-items-center">
                <div class="p-4 rounded-circle bg-danger bg-opacity-10 mb-3 text-danger">
                    <i class="bi bi-wifi-off" style="font-size: 2.5rem;"></i>
                </div>
                <h5 class="fw-bold text-white mb-2">Agente Offline</h5>
                <p class="text-white-50 text-center px-5 mb-4 small">
                    Não é possível acessar o arquivo de logs local (CSV) pois este computador 
                    não está conectado ao servidor no momento.
                </p>
                <div class="d-flex gap-2">
                    <span class="badge bg-dark border border-secondary">
                        Visto por último: ${cliente ? cliente.ultima_atualizacao : '--:--'}
                    </span>
                </div>
                <button class="btn btn-outline-light btn-sm mt-4 px-4 rounded-pill" onclick="fecharVisualizadorLogs()">
                    Voltar
                </button>
            </div>`;
        return; // <--- O PULO DO GATO: Para a função aqui e não gasta dados tentando conectar!
    }

    // SE ESTIVER ONLINE, SEGUE O FLUXO NORMAL...
    viewer.innerHTML = `
        <div class="h-100 d-flex flex-column justify-content-center align-items-center text-white-50">
            <div class="spinner-border text-primary mb-3"></div>
            <p>Solicitando arquivo CSV ao Agente...</p>
            <small class="text-muted">Isso pode levar alguns segundos.</small>
        </div>`;

    // Envia comando para o Firebase
    firebase.database().ref(`clientes/${hwid}/comando`).set("request_logs");

    // Ativa o Listener
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
    document.getElementById('card-focus-placeholder').innerHTML = ''; // Limpa o clone
    
    // Desliga o listener do Firebase para economizar dados
    if(logListenerAtivo) {
        // Precisamos saber qual HWID estava sendo ouvido... 
        // Simplificação: Desliga todos os listeners de logs_temp (melhor seria guardar a ref exata)
    }
}

let cacheLogAtual = ""; // Variável global para guardar o CSV e usar no download
function renderizarTabelaLogs(csvRaw) {
    const viewer = document.getElementById('log-viewer-content');
    cacheLogAtual = csvRaw; // Salva para o botão de download usar depois

    if(!csvRaw) {
        viewer.innerHTML = '<div class="p-4 text-center text-muted">Log vazio ou inexistente.</div>';
        return;
    }

    // 1. Separa as linhas
    let linhas = csvRaw.split('\n');
    
    // 2. Remove linhas vazias
    linhas = linhas.filter(l => l.trim().length > 5);

    // 3. Identifica e remove o cabeçalho original (se existir)
    // O cabeçalho geralmente começa com "DATA" ou "DATA_HORA"
    const indexHeader = linhas.findIndex(l => l.toUpperCase().includes("DATA_HORA") || l.toUpperCase().includes("DATA;"));
    if (indexHeader > -1) {
        linhas.splice(indexHeader, 1); // Remove do array para não ser invertido
    }

    // 4. Inverte APENAS os dados (Novos primeiro)
    linhas.reverse(); 
    
    let html = '';

    // 5. Adiciona o Cabeçalho FIXO no topo manualmente
    html += `
        <div class="log-row header-row">
            <div class="l-time">DATA / HORA</div>
            <div class="l-type text-center">TIPO</div>
            <div class="l-msg">MENSAGEM DO SISTEMA</div>
        </div>`;

    // 6. Gera as linhas de dados
    linhas.forEach(linha => {
        const cols = linha.split(';');
        if(cols.length >= 3) {
            const data = cols[0];
            const tipo = cols[1];
            // Reconstrói a mensagem caso ela tenha ; no meio
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

    // Cria um elemento Blob (arquivo virtual)
    const blob = new Blob([cacheLogAtual], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Cria um link invisível e clica nele
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    // Nome do arquivo com data/hora para organização
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

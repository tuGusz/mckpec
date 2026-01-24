window.dadosGlobais = {}; 
window.dadosSistema = {}; 
window.idsPendentes = [];
window.filtrosAtivos = [];
window.termoPesquisa = '';
window.historicoLogs = {};  

function iniciarCicloAtualizacao() {
    firebase.database().ref('clientes').on('value', (snapshot) => {
        const dados = snapshot.val();
        dadosGlobais = dados || {};
        
        document.getElementById('relogio').innerText = new Date().toLocaleTimeString('pt-BR');
        
        renderizarCards(); 
    }, (error) => {
        console.error("Erro no Listener Clientes:", error);
    });

    firebase.database().ref('sistema').on('value', (snapshot) => {
        const dados = snapshot.val();
        dadosSistema = dados || {};
        renderizarCards(); 
    });
}

function renderizarCards() {
    atualizarContadoresFiltros();
    
    // const vPecMeta = dadosSistema.pec_versao_recente || "--";
    // const vAgenteMeta = dadosSistema.agente_versao_recente || "v1.0.0"; // Fallback se não tiver no banco

    // const elPec = document.getElementById('legenda-versao-pec');
    // const elAgente = document.getElementById('legenda-versao-agente');
    
    // if(elPec) elPec.innerText = vPecMeta;
    // if(elAgente) elAgente.innerText = vAgenteMeta;

    const container = document.getElementById('painel-clientes');
    const agora = new Date();
    const versaoMeta = dadosSistema.pec_versao_recente || "0.0.0";

    let listaClientes = [];
    for (let hwid in dadosGlobais) {
        let cliente = dadosGlobais[hwid];
        cliente.hwid = hwid; 
        listaClientes.push(cliente);
    }

    const listaFiltrada = listaClientes.filter(cliente => {
        if (idsPendentes.includes(cliente.hwid)) return false;

        let nome = (cliente.municipio || cliente.nome_municipio || cliente.maquina || "").toLowerCase();
        let id = cliente.hwid.toLowerCase();
        const matchTexto = nome.includes(termoPesquisa) || id.includes(termoPesquisa);
        if(!matchTexto) return false;

        let dataUltima = parseDataPTBR(cliente.ultima_atualizacao);
        let difSegundos = (agora - dataUltima) / 1000;
        let isOnline = difSegundos <= 600; // 10 min
        let listaErros = cliente.erros || [];
        
        let versaoPec = cliente.versao_pec || "N/A";
        let isDesatualizado = compararVersoes(versaoPec, versaoMeta) < 0;

     
        if (filtrosAtivos.length === 0) return true;

        let atendeAlgumFiltro = false;

        if (filtrosAtivos.includes('online') && isOnline) atendeAlgumFiltro = true;
        if (filtrosAtivos.includes('offline') && !isOnline) atendeAlgumFiltro = true;
        if (filtrosAtivos.includes('erro') && isOnline && cliente.status_geral !== 'Online') atendeAlgumFiltro = true;
        if (filtrosAtivos.includes('pec_off') && isOnline && listaErros.includes("PEC OFF")) atendeAlgumFiltro = true;
        if (filtrosAtivos.includes('desatualizado') && isDesatualizado) atendeAlgumFiltro = true;

        return atendeAlgumFiltro;
    });
 
    listaFiltrada.sort((a, b) => {
        let nomeA = (a.municipio || a.nome_municipio || a.maquina || "").trim().toLowerCase();
        let nomeB = (b.municipio || b.nome_municipio || b.maquina || "").trim().toLowerCase();
        return nomeA.localeCompare(nomeB);
    });

    const idsAtuais = listaFiltrada.map(c => c.hwid);
    const filhos = Array.from(container.children);
    
    filhos.forEach(div => {
        if (!div.id.startsWith('wrapper-')) {
            div.remove();  
        } else {
            let idTela = div.id.replace('wrapper-', '');
            if (!idsAtuais.includes(idTela)) div.remove();
        }
    });

    if (listaFiltrada.length === 0) {
        if (container.children.length === 0) {
            container.innerHTML = `<div class="col-12 text-center mt-5" id="msg-vazio"><p class="text-muted">Nenhum resultado encontrado.</p></div>`;
        }
        return;
    }

    listaFiltrada.forEach(info => {
        let hwid = info.hwid;

        if (info.status_geral === 'DESTRUCT') {
            firebase.database().ref('clientes/' + hwid).remove();
            return; 
        }

        if (info.erros && Array.isArray(info.erros)) {
            info.erros = info.erros.filter(erro => erro !== "Gateway OFF");
        }
       
        let dataRef = parseDataPTBR(info.ultima_atualizacao);
        let segs = (agora - dataRef) / 1000;
        let isComunicando = segs <= 600; // 10 minutos de tolerância

        if (isComunicando && (!info.erros || info.erros.length === 0) && info.status_geral !== 'Atualizando') {
            info.status_geral = 'Online';
        }
   
        let nomeExibicao = info.municipio || info.nome_municipio;
        if (!nomeExibicao || nomeExibicao === "Sem Nome") {
            nomeExibicao = info.maquina ? info.maquina : "Aguardando ID...";
        }

        let logAtual = info.log_acao || "";
        let logAntigo = historicoLogs[hwid];

        if (logAntigo === undefined) {
            historicoLogs[hwid] = logAtual;
        } else if (logAtual !== "" && logAtual !== logAntigo) {
            adicionarLogConsole(nomeExibicao, logAtual);
            historicoLogs[hwid] = logAtual;
        }

        if (!info.log_acao) historicoLogs[hwid] = "";
        let hwInfo = info.hardware || {};
        let ipPublico = info.ip_publico || "--.---.---.---";
        let dataUltimaAtualizacao = parseDataPTBR(info.ultima_atualizacao);
        let diferencaSegundos = (agora - dataUltimaAtualizacao) / 1000;
        let isOnline = diferencaSegundos <= 600;

        let comandoPendente = info.comando && info.comando !== "" && info.comando !== "null";
        let isUpdating = (comandoPendente || info.comando === 'update_pec' || info.comando === 'update_pec_background' || info.status_geral === 'Atualizando');

        let discoTotal = parseFloat(hwInfo.disco_total_gb) || 0;
        let discoLivre = parseFloat(hwInfo.disco_livre_gb) || 0;
        let discoUsado = discoTotal - discoLivre;
        let pctUso = discoTotal > 0 ? (discoUsado / discoTotal) * 100 : 0;
        let espacoCritico = discoLivre < 15;

        let diskBarClass = "";
        if (pctUso > 90 || espacoCritico) diskBarClass = "danger"; 
        else if (pctUso > 75) diskBarClass = "warning"; 
        else diskBarClass = "";

        let htmlDisco = `
            <div class="col-12 mt-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <small class="text-muted" title="Disco Local"><i class="bi bi-hdd-fill me-1"></i> ${hwInfo.disco_label || 'C:'}</small>
                    <small class="${espacoCritico ? 'text-danger fw-bold' : 'text-muted'}">
                        ${discoLivre.toFixed(1)} GB livres de ${discoTotal.toFixed(1)} GB
                    </small>
                </div>
                <div class="disk-usage-container" title="${pctUso.toFixed(1)}% Usado">
                    <div class="disk-usage-bar ${diskBarClass}" style="width: ${pctUso}%"></div>
                </div>
                ${espacoCritico ? '<div class="text-danger mt-1" style="font-size: 0.65rem;"><i class="bi bi-exclamation-circle-fill"></i> Espaço insuficiente para atualização (< 11GB)</div>' : ''}
            </div>
        `;

        let statusBadge = isOnline 
            ? `<span class="badge bg-success bg-opacity-10 text-success border border-success"><i class="bi bi-wifi"></i> Online</span>`
            : `<span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary"><i class="bi bi-wifi-off"></i> Offline</span>`;

        let cardClass = isOnline ? (info.status_geral === 'Online' ? "status-Online" : "status-Erro") : "status-Offline";
        let colorStatus = isOnline ? (info.status_geral === 'Online' ? "success" : "danger") : "secondary";
        let textStatus = isOnline ? (info.status_geral === 'Online' ? "OPERACIONAL" : "ERRO DETECTADO") : "AGENTE OFFLINE";

        let listaErros = info.erros || [];
        const makeBadge = (nome, isError) => isError 
            ? `<span class="badge bg-danger text-white me-1 mb-1"><i class="bi bi-x-circle-fill"></i> ${nome}</span>` 
            : `<span class="badge bg-light text-dark border me-1 mb-1"><i class="bi bi-check-circle-fill text-success"></i> ${nome}</span>`;

        let versaoPec = info.versao_pec || "N/A";
        let isDesatualizado = compararVersoes(versaoPec, versaoMeta) < 0;
        let versaoAgente = info.versao_agente || "?";

        let htmlVersao = versaoPec !== "N/A" 
                ? `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary me-1 mb-1" title="Versão Mais Recente: ${versaoMeta}"><i class="bi bi-tag-fill"></i> v${versaoPec}</span>`
                : `<span class="badge bg-light text-muted border me-1 mb-1"><i class="bi bi-question-circle"></i> Ver. ?</span>`;

        let htmlAgente = `<span class="badge bg-dark text-white border me-1 mb-1" title="Versão do Agente MCK"><i class="bi bi-robot"></i> MCK v${versaoAgente}</span>`;

        let htmlServicos = `
                <div class="d-flex flex-wrap mb-3 align-items-center">
                    ${htmlAgente}
                    ${htmlVersao} ${makeBadge("PGSQL", listaErros.includes("PostgreSQL OFF"))}
                    ${makeBadge("e-SUS", listaErros.includes("PEC OFF"))}
                     
                </div>`; //${makeBadge("Gateway", listaErros.includes("Gateway OFF"))}

 
        let chkId = `chk-bg-${hwid}`;
        let chkElement = document.getElementById(chkId);
        let isChecked = chkElement ? chkElement.checked : false; 
        let checkedStr = isChecked ? "checked" : ""; 



        let htmlBotoes = '';
        if (isOnline) {
            if (isUserAdmin) {
                let btnPec = listaErros.includes("PEC OFF")
                    ? `<button class="btn btn-outline-success btn-sm btn-acao w-100" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'start_esus')"><i class="bi bi-play-fill"></i> INICIAR e-SUS</button>`
                    : `<div class="btn-group w-100 mb-1"><button class="btn btn-outline-danger btn-sm btn-acao w-50 rounded-end-0" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'stop_esus')"><i class="bi bi-stop-fill"></i> PARAR</button><button class="btn btn-outline-warning btn-sm btn-acao w-50 rounded-start-0" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'restart_esus')"><i class="bi bi-arrow-clockwise"></i> REINICIAR</button></div>`;

                let btnPg = listaErros.includes("PostgreSQL OFF")
                    ? `<button class="btn btn-outline-success btn-sm btn-acao w-100" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'start_pg')"><i class="bi bi-play-fill"></i> INICIAR PGSQL</button>`
                    : `<div class="btn-group w-100 mb-1"><button class="btn btn-outline-danger btn-sm btn-acao w-50 rounded-end-0" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'stop_pg')"><i class="bi bi-stop-fill"></i> PARAR</button><button class="btn btn-outline-warning btn-sm btn-acao w-50 rounded-start-0" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'restart_pg')"><i class="bi bi-arrow-clockwise"></i> REINICIAR</button></div>`;

                let btnUpdate = '';
        if (isDesatualizado) {
            if (espacoCritico) {
               
                btnUpdate = `
                    <div class="mt-2">
                         <button class="btn btn-light border btn-sm text-danger w-100" disabled style="opacity: 1; cursor: not-allowed; border-color: #fca5a5 !important; background-color: #fef2f2;">
                             <i class="bi bi-x-circle-fill"></i> Update Bloqueado (Disco Cheio)
                         </button>
                    </div>`;
            } else {
             
                btnUpdate = `
                    <div class="border-top pt-2 mt-2">
                         <div class="form-check form-switch d-flex justify-content-center mb-2">
                             <input class="form-check-input me-2" type="checkbox" id="${chkId}" ${checkedStr}>
                             <label class="form-check-label text-muted small" for="${chkId}" style="font-size:0.7rem;">Forçar Atualização do PEC em Background</label>
                         </div>
                         <button class="btn btn-light border btn-sm text-primary w-100" onclick="enviarComandoUpdate('${hwid}', '${nomeExibicao}')">
                             <i class="bi bi-cloud-arrow-down-fill"></i> Atualizar para v${versaoMeta}
                         </button>
                    </div>`;
            }
        } else {
            btnUpdate = `<button class="btn btn-light border btn-sm text-muted mt-2 w-100" disabled style="background-color: #f0fdf4; border-color: #bbf7d0 !important; color: #166534 !important;"><i class="bi bi-check-circle-fill"></i> PEC Atualizado</button>`;
        }

                // <button class="btn btn-light border btn-sm text-info" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'open_gateway')"><i class="bi bi-window-stack"></i> Abrir Gateway</button>
                htmlBotoes = `
                    <div class="mt-3 pt-3 border-top">
                        <div class="row g-2">
                            <div class="col-12 mb-2"><small class="text-muted fw-bold d-block mb-1" style="font-size: 0.7rem;">PEC / APLICAÇÃO</small>${btnPec}</div>
                            <div class="col-12"><small class="text-muted fw-bold d-block mb-1" style="font-size: 0.7rem;">BANCO DE DADOS</small>${btnPg}</div>
                            <div class="col-12 mt-2 pt-2 border-top d-grid gap-2">
                                ${btnUpdate}
                                
                            </div>
                        </div>
                    </div>
                    <div class="mt-2 pt-2 border-top text-center">
                        <button class="btn btn-outline-danger btn-sm border-0 w-100" onclick="abrirModalDestruicao('${hwid}', '${nomeExibicao}')">
                            <i class="bi bi-trash"></i> Deletar Município
                        </button>
                    </div>`;
            } else {
                htmlBotoes = `<div class="mt-3 pt-3 border-top text-center"><span class="badge bg-light text-secondary border"><i class="bi bi-eye-fill"></i> Faça login</span></div>`;
            }
        } else {
            htmlBotoes = `<div class="mt-3 pt-3 border-top text-center"><small class="text-muted fst-italic">Sem conexão</small></div>`;
        }

        let overlayHtml = '';
        let cardExtraClasses = '';
        if (isUpdating) {
            cardExtraClasses = 'card-updating'; 
            
            let msgOverlay = "Processando...";
            let iconOverlay = "bi-gear-wide-connected";
            let animClass = "pulsing-icon"; 

            // Personaliza a mensagem baseada no comando atual do banco de dados
            if (info.status_geral === 'Atualizando') {
                msgOverlay = "Atualizando Sistema...";
                iconOverlay = "bi-arrow-repeat";
                animClass = "spinner-border text-success"; // Spinner padrão para update longo
            } else if (comandoPendente) {
                if(info.comando.includes('update')) { msgOverlay = "Iniciando Update..."; iconOverlay = "bi-cloud-download"; }
                else if(info.comando.includes('start')) { msgOverlay = "Iniciando Serviço..."; iconOverlay = "bi-play-circle"; }
                else if(info.comando.includes('stop')) { msgOverlay = "Parando Serviço..."; iconOverlay = "bi-stop-circle"; }
                else if(info.comando.includes('restart')) { msgOverlay = "Reiniciando..."; iconOverlay = "bi-arrow-clockwise"; }
                else if(info.comando.includes('request_logs')) { msgOverlay = "Buscando Logs..."; iconOverlay = "bi-file-text"; }
            }

            // HTML do Overlay (Idêntico ao visual do commands.js para consistência)
            overlayHtml = `
                <div class="command-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(2px); z-index: 20; display: flex; flex-direction: column; justify-content: center; align-items: center; border-radius: 10px;">
                    <div class="${animClass}" style="font-size: 2rem; color: #3b82f6;"><i class="bi ${iconOverlay}"></i></div>
                    <h6 class="fw-bold text-dark mt-2">${msgOverlay}</h6>
                    <small class="text-muted text-center px-3">Aguarde o agente responder...</small>
                </div>`;
        }
        // if (isUpdating) {
        //     cardExtraClasses = 'card-updating'; 
        //     let mensagemLog = info.log_acao || "Preparando ambiente...";
        //     if(info.comando === 'update_pec_background') mensagemLog = "(Background) " + mensagemLog;

        //     overlayHtml = `
        //         <div class="update-overlay">
        //             <div class="spinner-border spinner-update" role="status"></div>
        //             <div class="text-update mt-3 fw-bold"><i class="bi bi-arrow-repeat"></i> Atualizando PEC...</div>
        //             <div class="mt-2 px-3 py-1 rounded bg-black bg-opacity-50 text-warning font-monospace" style="font-size: 0.75rem; max-width: 90%;"> > ${mensagemLog} </div>
        //         </div>`;
        // }

     
        let btnLogs = `<button class="btn btn-sm btn-outline-secondary border-0 ms-2 py-0 px-2" onclick="abrirVisualizadorLogs('${hwid}')" title="Ver Logs Locais"><i class="bi bi-file-text"></i></button>`;
        let htmlContent = `
            ${overlayHtml} <div class="card-body">
           
        
        
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h5 class="card-title fw-bold mb-0 text-dark text-truncate" style="max-width: 220px;" title="${nomeExibicao}">
                            ${nomeExibicao} 
                        </h5>
                        <small class="text-muted" style="font-size: 0.65rem">ID: ${hwid.substring(0, 8)}...</small>
                    </div>
                    <div>
                </div>
            <div class="d-flex align-items-center">
                ${btnLogs} <div class="ms-2">${statusBadge}</div>
            </div>
                </div>
                <div class="mb-3 d-flex justify-content-between align-items-center">
                    <span class="badge bg-${colorStatus} py-2 px-3">${textStatus}</span>
                    <small class="text-muted" style="font-size: 0.7rem">
                        <i class="bi bi-clock-history"></i> Ref: ${info.ultima_atualizacao || '--:--'}
                    </small>
                </div>
                ${htmlServicos}
                <div class="bg-light p-3 rounded-3 border mb-3" style="font-size: 0.75rem;">
                    <div class="row g-2">
                        <div class="col-6 text-truncate" title="Computador"><i class="bi bi-pc-display me-1 text-secondary"></i> <strong>${info.maquina || '?'}</strong></div>
                        <div class="col-6 text-truncate" title="IP Público"><i class="bi bi-globe me-1 text-primary"></i> <strong>${ipPublico}</strong></div>
                        
                        <div class="col-6 text-truncate" title="OS"><i class="bi bi-windows me-1 text-secondary"></i> ${hwInfo.sistema || '?'}</div>
                        <div class="col-6 text-truncate" title="User"><i class="bi bi-person-fill me-1 text-secondary"></i> ${hwInfo.usuario || '?'}</div>
                        
                        <div class="col-12 border-top my-1"></div>
                        
                        <div class="col-6 text-truncate" title="CPU"><i class="bi bi-cpu me-1 text-secondary"></i> ${hwInfo.processador || '?'}</div>
                        
                        <div class="col-6 text-truncate" title="Placa Mãe"><i class="bi bi-motherboard me-1 text-secondary"></i> ${hwInfo.placa_mae || 'N/A'}</div>

                        <div class="col-6 text-truncate" title="Disco"><i class="bi bi-hdd me-1 text-secondary"></i> ${hwInfo.armazenamento || '?'}</div>
                        <div class="col-6 text-truncate" title="RAM"><i class="bi bi-memory me-1 text-secondary"></i> ${hwInfo.memoria_ram || '?'}</div>

                        <div class="bg-light p-3 rounded-3 border mb-3" style="font-size: 0.75rem;">
                            <div class="row g-2">
                                 ${htmlDisco} 
                    
                             </div>
                        </div>
                    </div>
                </div>
                ${htmlBotoes}
            </div>
        `;

        let wrapper = document.getElementById(`wrapper-${hwid}`);
        
        if (wrapper) {
            let cardDiv = document.getElementById(`card-${hwid}`);
            if(cardDiv.innerHTML !== htmlContent) {
                cardDiv.innerHTML = htmlContent;
                cardDiv.className = `card shadow-sm card-status card-relative h-100 ${cardClass} ${cardExtraClasses}`;
            }
        } else {
            let newWrapper = document.createElement('div');
            newWrapper.className = "col-xl-4 col-lg-6";
            newWrapper.id = `wrapper-${hwid}`;
            
            newWrapper.innerHTML = `
                <div class="card shadow-sm card-status card-relative h-100 ${cardClass} ${cardExtraClasses}" id="card-${hwid}">
                    ${htmlContent}
                </div>`;
            
            container.appendChild(newWrapper);
        }
    });
}

function monitorarPendentes() {
    if (!isUserAdmin) return; 
    firebase.database().ref('pendentes').on('value', (snapshot) => {
        const dados = snapshot.val();
        const badge = document.getElementById('badge-pendentes');
        const lista = document.getElementById('lista-pendentes');
    
        idsPendentes = dados ? Object.keys(dados) : [];
        renderizarCards(); 
    
        if (!dados) {
            if(badge) badge.style.display = 'none';
            if(lista) lista.innerHTML = '<div class="p-4 text-center text-muted">Nenhuma solicitação pendente.</div>';
            return;
        }
        
        const qtd = Object.keys(dados).length;
        if(badge) {
            badge.innerText = qtd;
            badge.style.display = 'block';
        }
        
        if(lista) {
            lista.innerHTML = '';
            for (let hwid in dados) {
                let item = dados[hwid];
                let html = `
                    <div class="list-group-item d-flex justify-content-between align-items-center p-3">
                        <div>
                            <h6 class="mb-1 fw-bold text-primary">${item.nome_solicitado}</h6>
                            <small class="text-muted d-block" style="font-size: 0.75rem"><i class="bi bi-cpu"></i> ID: ${hwid.substring(0, 15)}...</small>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-danger" onclick="rejeitarAgente('${hwid}')">Recusar</button>
                            <button class="btn btn-sm btn-success text-white" onclick="aprovarAgente('${hwid}', '${item.nome_solicitado}')">APROVAR</button>
                        </div>
                    </div>`;
                lista.innerHTML += html;
            }
        }
    });
}

function atualizarContadoresFiltros() {
    let counts = {
        online: 0,
        offline: 0,
        erro: 0,
        pec_off: 0,
        desatualizado: 0
    };

    const agora = new Date();
    const versaoMeta = dadosSistema.pec_versao_recente || "0.0.0";

    for (let hwid in dadosGlobais) {
        let cliente = dadosGlobais[hwid];
        if (idsPendentes.includes(hwid) || cliente.status_geral === 'DESTRUCT') continue;
        let dataUltima = parseDataPTBR(cliente.ultima_atualizacao);
        let difSegundos = (agora - dataUltima) / 1000;
        let isOnline = difSegundos <= 600; // 10 min
        
        let versaoPec = cliente.versao_pec || "N/A";
        let isDesatualizado = compararVersoes(versaoPec, versaoMeta) < 0;
        let listaErros = cliente.erros || [];

        
        if (isOnline) {
            counts.online++;
            if (cliente.status_geral !== 'Online' && cliente.status_geral !== 'Atualizando') {
                counts.erro++;
            }
            if (listaErros.includes("PEC OFF")) {
                counts.pec_off++;
            }
        } else {
            counts.offline++;
        }

        if (isDesatualizado) {
            counts.desatualizado++;
        }
    }

    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.innerText = val;
    };

    setTxt('qtd-online', counts.online);
    setTxt('qtd-offline', counts.offline);
    setTxt('qtd-erro', counts.erro);
    setTxt('qtd-pec-off', counts.pec_off);
    setTxt('qtd-desatualizado', counts.desatualizado);
}

function atualizarBadgeFiltros() {
    const badge = document.getElementById('badge-filtros');
    if (filtrosAtivos.length > 0) {
        badge.innerText = filtrosAtivos.length;
        badge.classList.remove('d-none');
        document.getElementById('btnFiltros').classList.add('btn-secondary');
        document.getElementById('btnFiltros').classList.remove('btn-outline-secondary');
    } else {
        badge.classList.add('d-none');
        document.getElementById('btnFiltros').classList.remove('btn-secondary');
        document.getElementById('btnFiltros').classList.add('btn-outline-secondary');
    }
}

async function buscarDados() {
    try {
        document.getElementById('relogio').innerText = new Date().toLocaleTimeString('pt-BR');
        const [respClientes, respSistema] = await Promise.all([
            fetch(URL_BANCO_LEITURA),
            fetch(URL_SISTEMA_LEITURA)
        ]);

        const dClientes = await respClientes.json();
        const dSistema = await respSistema.json();
        
        dadosGlobais = dClientes || {};
        dadosSistema = dSistema || {};

        renderizarCards();
    } catch (e) {
        console.error("Erro ao buscar dados:", e);
    }
}

window.abrirModalAprovacao = function() {
    if (!isUserAdmin) { alert("Faça login."); return; }
    const modal = new bootstrap.Modal(document.getElementById('modalAprovacao'));
    modal.show();
}


window.toggleFiltro = function(checkbox) {
    const valor = checkbox.value;
    
    if (checkbox.checked) {
        if (!filtrosAtivos.includes(valor)) filtrosAtivos.push(valor);
    } else {
        filtrosAtivos = filtrosAtivos.filter(item => item !== valor);
    }

    atualizarBadgeFiltros();
    renderizarCards();
}

window.limparFiltros = function() {
    filtrosAtivos = [];
    const checkboxes = document.querySelectorAll('#filtros-container input[type="checkbox"]');
    checkboxes.forEach(chk => chk.checked = false);
    
    atualizarBadgeFiltros();
    renderizarCards();
}
 

window.aplicarFiltros = function() {
    termoPesquisa = document.getElementById('inputPesquisa').value.toLowerCase();
    renderizarCards();
}
 
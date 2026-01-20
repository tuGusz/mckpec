let isUserAdmin = false;
let dadosGlobais = {}; 
let dadosSistema = {}; 
let idsPendentes = [];
let filtroAtual = 'todos';
let termoPesquisa = '';
let historicoLogs = {};  

const URL_BANCO_LEITURA = "https://monitorpec-72985-default-rtdb.firebaseio.com/clientes.json";
const URL_SISTEMA_LEITURA = "https://monitorpec-72985-default-rtdb.firebaseio.com/sistema.json";
const URL_PENDENTES = "https://monitorpec-72985-default-rtdb.firebaseio.com/pendentes.json";

// --- INICIALIZAÇÃO SEGURA (SESSÃO PERSISTENTE) ---
firebase.auth().onAuthStateChanged((user) => {
    const btnLogout = document.getElementById('btn-logout');
    const btnLogin = document.getElementById('btn-login');

    if (user) {
        console.log("Admin conectado:", user.email);
        isUserAdmin = true;
        
        if(btnLogin) btnLogin.classList.add('d-none');
        if(btnLogout) btnLogout.classList.remove('d-none');

        document.getElementById('login-overlay').style.display = 'none';

        const userDisplay = document.getElementById('user-display');
        if(userDisplay) {
            userDisplay.innerText = user.email;
            userDisplay.className = "fw-bold text-info";
        }

        iniciarCicloAtualizacao();
        monitorarPendentes();
        
    } else {
        console.log("Modo Visitante.");
        isUserAdmin = false;

        // Esconde Logout, Mostra Login
        if(btnLogout) btnLogout.classList.add('d-none');
        if(btnLogin) btnLogin.classList.remove('d-none');

        const userDisplay = document.getElementById('user-display');
        if(userDisplay) {
            userDisplay.innerText = "Visitante";
            userDisplay.className = "fw-semibold";
        }
    }
});

function fazerLogin() {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const lembrar = document.getElementById('lembrar').checked; // Pega o estado do checkbox
    const msg = document.getElementById('msg-login');
    const btn = document.querySelector('#login-overlay button');

    if (!email || !senha) {
        msg.innerText = "Preencha e-mail e senha.";
        return;
    }

    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Verificando...';
    btn.disabled = true;
    msg.innerText = "";

    const persistencia = lembrar ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION;

    firebase.auth().setPersistence(persistencia)
        .then(() => {
            return firebase.auth().signInWithEmailAndPassword(email, senha);
        })
        .then((userCredential) => {
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Sucesso!';
        })
        .catch((error) => {
            btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Acessar Painel';
            btn.disabled = false;
            
            let erroMsg = "Erro ao acessar.";
            if(error.code === 'auth/wrong-password') erroMsg = "Senha incorreta.";
            if(error.code === 'auth/user-not-found') erroMsg = "Usuário não encontrado.";
            if(error.code === 'auth/invalid-email') erroMsg = "Email inválido.";
            if(error.code === 'auth/too-many-requests') erroMsg = "Muitas tentativas. Aguarde.";
            
            msg.innerText = erroMsg;
            console.error(error);
        });
}

function abrirModalLogin() {
    const overlay = document.getElementById('login-overlay');
    const msg = document.getElementById('msg-login');
    const btn = document.querySelector('#login-overlay button');
    
    msg.innerText = "";
    btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Acessar Painel';
    btn.disabled = false;
    document.getElementById('senha').value = ''; 

    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
}

function toggleSenha() {
    const input = document.getElementById('senha');
    const icon = document.getElementById('icon-senha');
    
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
    } else {
        input.type = "password";
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
    }
}


function fazerLogout() {
    if(!confirm("Deseja realmente sair do sistema?")) return;

    firebase.auth().signOut().then(() => {
        isUserAdmin = false;
        document.getElementById('painel-clientes').innerHTML = '';
        location.reload();
    }).catch((error) => {
        console.error('Erro ao sair:', error);
    });
}

function entrarModoLeitura() {
    document.getElementById('login-overlay').style.display = 'none';
    isUserAdmin = false;
    const userDisplay = document.getElementById('user-display');
    if(userDisplay) {
        userDisplay.innerText = "Visitante";
        userDisplay.className = "fw-semibold";
    }

    iniciarCicloAtualizacao();
}
window.setFiltro = function(tipo, btnElement) {
    filtroAtual = tipo;
    const container = document.getElementById('filtros-container');
    const botoes = container.getElementsByTagName('button');
    for(let btn of botoes) btn.classList.remove('active');
    btnElement.classList.add('active');
    renderizarCards();
}

window.aplicarFiltros = function() {
    termoPesquisa = document.getElementById('inputPesquisa').value.toLowerCase();
    renderizarCards();
}
 
function iniciarCicloAtualizacao() {
    buscarDados();
    setInterval(buscarDados, 5000);  
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

// function renderizarCards() {
//     const container = document.getElementById('painel-clientes');
//     const agora = new Date();
//     const versaoMeta = dadosSistema.pec_versao_recente || "0.0.0";

//     let listaClientes = [];
//     for (let hwid in dadosGlobais) {
//         let cliente = dadosGlobais[hwid];
//         cliente.hwid = hwid; 
//         listaClientes.push(cliente);
//     }

//     // Filtragem
//     const listaFiltrada = listaClientes.filter(cliente => {
//         let nome = (cliente.municipio || cliente.nome_municipio || "").toLowerCase();
//         let id = cliente.hwid.toLowerCase();
//         const matchTexto = nome.includes(termoPesquisa) || id.includes(termoPesquisa);
//         if(!matchTexto) return false;

//         let dataUltima = parseDataPTBR(cliente.ultima_atualizacao);
//         let difSegundos = (agora - dataUltima) / 1000;
//         let isOnline = difSegundos <= 120;
//         let listaErros = cliente.erros || [];
        
//         if (filtroAtual === 'todos') return true;
//         if (filtroAtual === 'online') return isOnline && cliente.status_geral === 'Online';
//         if (filtroAtual === 'erro') return isOnline && cliente.status_geral !== 'Online';
//         if (filtroAtual === 'offline') return !isOnline;
//         if (filtroAtual === 'pec_off') return isOnline && listaErros.includes("PEC OFF");
//         return true;
//     });

//     if (listaFiltrada.length === 0) {
//         container.innerHTML = `<div class="col-12 text-center mt-5"><p class="text-muted">Nenhum resultado encontrado.</p></div>`;
//         return;
//     }

//     listaFiltrada.sort((a, b) => {
//         if(a.status_geral !== 'Online' && b.status_geral === 'Online') return -1;
//         if(a.status_geral === 'Online' && b.status_geral !== 'Online') return 1;
//         return (a.municipio || "").localeCompare(b.municipio || "");
//     });

//     container.innerHTML = ''; 

//     listaFiltrada.forEach(info => {
//         let hwid = info.hwid;


//         if (info.status_geral === 'DESTRUCT') {
//             console.log(`Agente ${info.municipio} confirmou autodestruição. Removendo do painel...`);
//             firebase.database().ref('clientes/' + hwid).remove();
//             return; // Pula a renderização deste card
//         }
        
//         let nomeExibicao = info.municipio || info.nome_municipio || "Sem Nome"; 

//         if (info.log_acao && info.log_acao !== "" && historicoLogs[hwid] !== info.log_acao) {
//             // É uma mensagem nova! Adiciona ao console.
//             adicionarLogConsole(nomeExibicao, info.log_acao);
//             // Atualiza o histórico para não repetir na próxima verificação (5s depois)
//             historicoLogs[hwid] = info.log_acao;
//         }
//         // Se o log for vazio, apenas atualiza o histórico para permitir nova msg igual a anterior no futuro
//         if (!info.log_acao) {
//             historicoLogs[hwid] = "";
//         }
//         // -----------------------------------------------------

//         let hwInfo = info.hardware || {};
       
//         let dataUltimaAtualizacao = parseDataPTBR(info.ultima_atualizacao);
//         let diferencaSegundos = (agora - dataUltimaAtualizacao) / 1000;
//         let isOnline = diferencaSegundos <= 600;

//         let isUpdating = (info.comando === 'update_pec' || info.status_geral === 'Atualizando');

//         let statusBadge = isOnline 
//             ? `<span class="badge bg-success bg-opacity-10 text-success border border-success"><i class="bi bi-wifi"></i> Online</span>`
//             : `<span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary"><i class="bi bi-wifi-off"></i> Offline</span>`;

//         let cardClass = isOnline ? (info.status_geral === 'Online' ? "status-Online" : "status-Erro") : "status-Offline";
//         let colorStatus = isOnline ? (info.status_geral === 'Online' ? "success" : "danger") : "secondary";
//         let textStatus = isOnline ? (info.status_geral === 'Online' ? "OPERACIONAL" : "ERRO DETECTADO") : "AGENTE OFFLINE";

//         let listaErros = info.erros || [];
//         const makeBadge = (nome, isError) => isError 
//             ? `<span class="badge bg-danger text-white me-1 mb-1"><i class="bi bi-x-circle-fill"></i> ${nome}</span>` 
//             : `<span class="badge bg-light text-dark border me-1 mb-1"><i class="bi bi-check-circle-fill text-success"></i> ${nome}</span>`;

//         // Lógica de Versão
//         let versaoPec = info.versao_pec || "N/A";
//         let isDesatualizado = compararVersoes(versaoPec, versaoMeta) < 0; // Se versao local < meta

//         let versaoAgente = info.versao_agente || "?";

//         let htmlVersao = versaoPec !== "N/A" 
//                 ? `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary me-1 mb-1" title="Versão Mais Recente: ${versaoMeta}"><i class="bi bi-tag-fill"></i> v${versaoPec}</span>`
//                 : `<span class="badge bg-light text-muted border me-1 mb-1"><i class="bi bi-question-circle"></i> Ver. ?</span>`;

//         let htmlAgente = `<span class="badge bg-dark text-white border me-1 mb-1" title="Versão do Agente MCK"><i class="bi bi-robot"></i> MCK v${versaoAgente}</span>`;

//         let htmlServicos = `
//                 <div class="d-flex flex-wrap mb-3 align-items-center">
//                     ${htmlAgente}
//                     ${htmlVersao} ${makeBadge("PGSQL", listaErros.includes("PostgreSQL OFF"))}
//                     ${makeBadge("e-SUS", listaErros.includes("PEC OFF"))}
//                     ${makeBadge("Gateway", listaErros.includes("Gateway OFF"))}
//                 </div>`;

//         // Botões
//         let htmlBotoes = '';
 
//         if (isOnline) {
//             if (isUserAdmin) {
//                 let btnPec = listaErros.includes("PEC OFF")
//                     ? `<button class="btn btn-outline-success btn-sm btn-acao w-100" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'start_esus')"><i class="bi bi-play-fill"></i> INICIAR e-SUS</button>`
//                     : `<div class="btn-group w-100 mb-1"><button class="btn btn-outline-danger btn-sm btn-acao w-50 rounded-end-0" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'stop_esus')"><i class="bi bi-stop-fill"></i> PARAR</button><button class="btn btn-outline-warning btn-sm btn-acao w-50 rounded-start-0" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'restart_esus')"><i class="bi bi-arrow-clockwise"></i> REINICIAR</button></div>`;

//                 let btnPg = listaErros.includes("PostgreSQL OFF")
//                     ? `<button class="btn btn-outline-success btn-sm btn-acao w-100" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'start_pg')"><i class="bi bi-play-fill"></i> INICIAR PGSQL</button>`
//                     : `<div class="btn-group w-100 mb-1"><button class="btn btn-outline-danger btn-sm btn-acao w-50 rounded-end-0" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'stop_pg')"><i class="bi bi-stop-fill"></i> PARAR</button><button class="btn btn-outline-warning btn-sm btn-acao w-50 rounded-start-0" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'restart_pg')"><i class="bi bi-arrow-clockwise"></i> REINICIAR</button></div>`;

//                 let btnUpdate = '';
//                 if (isDesatualizado) {
//                    btnUpdate = `
//                         <div class="border-top pt-2 mt-2">
//                             <div class="form-check form-switch d-flex justify-content-center mb-2">
//                                 <input class="form-check-input me-2" type="checkbox" id="chk-bg-${hwid}">
//                                 <label class="form-check-label text-muted small" for="chk-bg-${hwid}" style="font-size:0.7rem;">Forçar Atualização do PEC em Background</label>
//                             </div>
//                             <button class="btn btn-light border btn-sm text-primary w-100" onclick="enviarComandoUpdate('${hwid}', '${nomeExibicao}')">
//                                 <i class="bi bi-cloud-arrow-down-fill"></i> Atualizar para v${versaoMeta}
//                             </button>
//                         </div>
//                     `;
//                 } else {
//                     btnUpdate = `<button class="btn btn-light border btn-sm text-muted" disabled style="background-color: #f0fdf4; border-color: #bbf7d0 !important; color: #166534 !important;"><i class="bi bi-check-circle-fill"></i> PEC Atualizado</button>`;
//                 }

//                 htmlBotoes = `
//                     <div class="mt-3 pt-3 border-top">
//                         <div class="row g-2">
//                             <div class="col-12 mb-2"><small class="text-muted fw-bold d-block mb-1" style="font-size: 0.7rem;">PEC / APLICAÇÃO</small>${btnPec}</div>
//                             <div class="col-12"><small class="text-muted fw-bold d-block mb-1" style="font-size: 0.7rem;">BANCO DE DADOS</small>${btnPg}</div>
//                             <div class="col-12 mt-2 pt-2 border-top d-grid gap-2">
//                                 ${btnUpdate}
//                                 <button class="btn btn-light border btn-sm text-info" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'open_gateway')"><i class="bi bi-window-stack"></i> Abrir Gateway</button>
//                             </div>
//                         </div>
//                     </div>`;

//                 htmlBotoes += `
//                     <div class="mt-2 pt-2 border-top text-center">
//                         <button class="btn btn-outline-danger btn-sm border-0 w-100" onclick="abrirModalDestruicao('${hwid}', '${nomeExibicao}')">
//                             <i class="bi bi-trash"></i> Deletar Município do Sistema
//                         </button>
//                     </div>`;
            
//             } else {
//                 htmlBotoes = `
//                     <div class="mt-3 pt-3 border-top text-center">
//                         <span class="badge bg-light text-secondary border">
//                             <i class="bi bi-eye-fill"></i> Faça login para controlar os serviços
//                         </span>
//                     </div>`;
//             }
//         } else {
//             htmlBotoes = `<div class="mt-3 pt-3 border-top text-center"><small class="text-muted fst-italic">Sem conexão com o agente</small></div>`;
//         }

//         let overlayHtml = '';
//         let cardExtraClasses = '';
        
//         if (isUpdating) {
//             cardExtraClasses = 'card-updating'; 
//             let mensagemLog = info.log_acao || "Preparando ambiente...";

//             overlayHtml = `
//                 <div class="update-overlay">
//                     <div class="spinner-border spinner-update" role="status"></div>
                    
//                     <div class="text-update mt-3 fw-bold">
//                         <i class="bi bi-arrow-repeat"></i> Atualizando PEC...
//                     </div>
                    
//                     <div class="mt-2 px-3 py-1 rounded bg-black bg-opacity-50 text-warning font-monospace" style="font-size: 0.75rem; max-width: 90%;">
//                         > ${mensagemLog}
//                     </div>
//                 </div>
//             `;
//         }

//         let html = `
//             <div class="col-xl-4 col-lg-6">
//                 <div class="card shadow-sm card-status card-relative h-100 ${cardClass} ${cardExtraClasses}">
//                     ${overlayHtml} <div class="card-body">
//                         <div class="d-flex justify-content-between align-items-start mb-2">
//                             <div>
//                                 <h5 class="card-title fw-bold mb-0 text-dark text-truncate" style="max-width: 220px;" title="${nomeExibicao}">
//                                     ${nomeExibicao} 
//                                 </h5>
//                                 <small class="text-muted" style="font-size: 0.65rem">ID: ${hwid.substring(0, 8)}...</small>
//                             </div>
//                             ${statusBadge}
//                         </div>
//                         <div class="mb-3 d-flex justify-content-between align-items-center">
//                             <span class="badge bg-${colorStatus} py-2 px-3">${textStatus}</span>
//                             <small class="text-muted" style="font-size: 0.7rem">
//                                 <i class="bi bi-clock-history"></i> Ref: ${info.ultima_atualizacao || '--:--'}
//                             </small>
//                         </div>
//                         ${htmlServicos}
//                         <div class="bg-light p-3 rounded-3 border mb-3" style="font-size: 0.75rem;">
//                             <div class="row g-2">
//                                 <div class="col-6 text-truncate" title="Computador"><i class="bi bi-pc-display me-1 text-secondary"></i> <strong>${info.maquina || '?'}</strong></div>
//                                 <div class="col-6 text-truncate" title="OS"><i class="bi bi-windows me-1 text-secondary"></i> ${hwInfo.sistema || '?'}</div>
//                                 <div class="col-6 text-truncate" title="User"><i class="bi bi-person-fill me-1 text-secondary"></i> ${hwInfo.usuario || '?'}</div>
//                                 <div class="col-6 text-truncate" title="RAM"><i class="bi bi-memory me-1 text-secondary"></i> ${hwInfo.memoria_ram || '?'}</div>
//                                 <div class="col-12 border-top my-1"></div>
//                                 <div class="col-12 text-truncate" title="CPU"><i class="bi bi-cpu me-1 text-secondary"></i> ${hwInfo.processador || '?'}</div>
//                                 <div class="col-12 text-truncate" title="Disco"><i class="bi bi-hdd me-1 text-secondary"></i> ${hwInfo.armazenamento || '?'}</div>
//                             </div>
//                         </div>
//                         ${htmlBotoes}
//                     </div>
//                 </div>
//             </div>
//         `;
//         container.innerHTML += html;
//     });
// }

function renderizarCards() {
    const container = document.getElementById('painel-clientes');
    const agora = new Date();
    const versaoMeta = dadosSistema.pec_versao_recente || "0.0.0";

    let listaClientes = [];
    for (let hwid in dadosGlobais) {
        let cliente = dadosGlobais[hwid];
        cliente.hwid = hwid; 
        listaClientes.push(cliente);
    }

    // --- 1. FILTRAGEM ---
    const listaFiltrada = listaClientes.filter(cliente => {
        if (idsPendentes.includes(cliente.hwid)) return false;
        // CORREÇÃO NOME: Inclui nome da máquina na busca
        let nome = (cliente.municipio || cliente.nome_municipio || cliente.maquina || "").toLowerCase();
        let id = cliente.hwid.toLowerCase();
        const matchTexto = nome.includes(termoPesquisa) || id.includes(termoPesquisa);
        if(!matchTexto) return false;

        let dataUltima = parseDataPTBR(cliente.ultima_atualizacao);
        let difSegundos = (agora - dataUltima) / 1000;
        let isOnline = difSegundos <= 600; // Aumentei tolerância para 10 min (padrão)
        let listaErros = cliente.erros || [];
        
        if (filtroAtual === 'todos') return true;
        if (filtroAtual === 'online') return isOnline && cliente.status_geral === 'Online';
        if (filtroAtual === 'erro') return isOnline && cliente.status_geral !== 'Online';
        if (filtroAtual === 'offline') return !isOnline;
        if (filtroAtual === 'pec_off') return isOnline && listaErros.includes("PEC OFF");
        return true;
    });

    // --- 2. ORDENAÇÃO ---
    // listaFiltrada.sort((a, b) => {
    //     if(a.status_geral !== 'Online' && b.status_geral === 'Online') return -1;
    //     if(a.status_geral === 'Online' && b.status_geral !== 'Online') return 1;
    //     return (a.municipio || "").localeCompare(b.municipio || "");
    // });

    listaFiltrada.sort((a, b) => {
        // Pega o nome de exibição de cada um (com os mesmos fallbacks de segurança)
        let nomeA = (a.municipio || a.nome_municipio || a.maquina || "").trim().toLowerCase();
        let nomeB = (b.municipio || b.nome_municipio || b.maquina || "").trim().toLowerCase();
        
        // Compara apenas os nomes (A-Z)
        return nomeA.localeCompare(nomeB);
    });
    
    // --- 3. LIMPEZA INTELIGENTE (CORREÇÃO DO PISCA-PISCA E SPINNER) ---
    const idsAtuais = listaFiltrada.map(c => c.hwid);
    const filhos = Array.from(container.children);
    
    filhos.forEach(div => {
        // Se o elemento não tem ID de wrapper (ex: é o spinner ou msg vazio), remove.
        // Se tem ID de wrapper mas não está na lista atual, remove.
        if (!div.id.startsWith('wrapper-')) {
            div.remove(); // TCHAU SPINNER!
        } else {
            let idTela = div.id.replace('wrapper-', '');
            if (!idsAtuais.includes(idTela)) div.remove();
        }
    });

    if (listaFiltrada.length === 0) {
        // Só adiciona a mensagem se já não tiver cards (para não piscar)
        if (container.children.length === 0) {
            container.innerHTML = `<div class="col-12 text-center mt-5" id="msg-vazio"><p class="text-muted">Nenhum resultado encontrado.</p></div>`;
        }
        return;
    }

    // --- 4. RENDERIZAÇÃO ---
    listaFiltrada.forEach(info => {
        let hwid = info.hwid;

        if (info.status_geral === 'DESTRUCT') {
            firebase.database().ref('clientes/' + hwid).remove();
            return; 
        }

        if (info.erros && Array.isArray(info.erros)) {
            info.erros = info.erros.filter(erro => erro !== "Gateway OFF");
        }
        // 2. Recalcula o Status:
        // Se o Agente mandou status de erro, mas a gente limpou a lista de erros acima,
        // então forçamos ele a ficar "Online" visualmente (desde que não esteja Offline por tempo).
        let dataRef = parseDataPTBR(info.ultima_atualizacao);
        let segs = (agora - dataRef) / 1000;
        let isComunicando = segs <= 600; // 10 minutos de tolerância

        if (isComunicando && (!info.erros || info.erros.length === 0) && info.status_geral !== 'Atualizando') {
            info.status_geral = 'Online';
        }
        
        // CORREÇÃO NOME: Fallback se vier vazio
        let nomeExibicao = info.municipio || info.nome_municipio;
        if (!nomeExibicao || nomeExibicao === "Sem Nome") {
            nomeExibicao = info.maquina ? info.maquina : "Aguardando ID...";
        }

        // Logs
        if (info.log_acao && info.log_acao !== "" && historicoLogs[hwid] !== info.log_acao) {
            adicionarLogConsole(nomeExibicao, info.log_acao);
            historicoLogs[hwid] = info.log_acao;
        }
        if (!info.log_acao) historicoLogs[hwid] = "";

        // Variáveis
        let hwInfo = info.hardware || {};
        let ipPublico = info.ip_publico || "--.---.---.---";
        let dataUltimaAtualizacao = parseDataPTBR(info.ultima_atualizacao);
        let diferencaSegundos = (agora - dataUltimaAtualizacao) / 1000;
        let isOnline = diferencaSegundos <= 600;
        let isUpdating = (info.comando === 'update_pec' || info.comando === 'update_pec_background' || info.status_geral === 'Atualizando');

        let discoTotal = parseFloat(hwInfo.disco_total_gb) || 0;
        let discoLivre = parseFloat(hwInfo.disco_livre_gb) || 0;
        let discoUsado = discoTotal - discoLivre;
        let pctUso = discoTotal > 0 ? (discoUsado / discoTotal) * 100 : 0;
        let espacoCritico = discoLivre < 11;

        let diskBarClass = "";
        if (pctUso > 90 || espacoCritico) diskBarClass = "danger"; // Vermelho se cheio ou crítico
        else if (pctUso > 75) diskBarClass = "warning"; // Amarelo
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

        // CORREÇÃO CHECKBOX: Ler estado atual do DOM antes de regravar o HTML
        let chkId = `chk-bg-${hwid}`;
        let chkElement = document.getElementById(chkId);
        let isChecked = chkElement ? chkElement.checked : false; // Salva estado
        let checkedStr = isChecked ? "checked" : ""; // Reaplica



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
                // BLOQUEIA O BOTÃO SE NÃO TIVER ESPAÇO
                btnUpdate = `
                    <div class="mt-2">
                         <button class="btn btn-light border btn-sm text-danger w-100" disabled style="opacity: 1; cursor: not-allowed; border-color: #fca5a5 !important; background-color: #fef2f2;">
                             <i class="bi bi-x-circle-fill"></i> Update Bloqueado (Disco Cheio)
                         </button>
                    </div>`;
            } else {
                // MOSTRA O BOTÃO NORMALMENTE
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
            let mensagemLog = info.log_acao || "Preparando ambiente...";
            if(info.comando === 'update_pec_background') mensagemLog = "(Background) " + mensagemLog;

            overlayHtml = `
                <div class="update-overlay">
                    <div class="spinner-border spinner-update" role="status"></div>
                    <div class="text-update mt-3 fw-bold"><i class="bi bi-arrow-repeat"></i> Atualizando PEC...</div>
                    <div class="mt-2 px-3 py-1 rounded bg-black bg-opacity-50 text-warning font-monospace" style="font-size: 0.75rem; max-width: 90%;"> > ${mensagemLog} </div>
                </div>`;
        }

        // --- MONTAGEM HTML (SEU LAYOUT ORIGINAL) ---
        let htmlContent = `
            ${overlayHtml} <div class="card-body">
           
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h5 class="card-title fw-bold mb-0 text-dark text-truncate" style="max-width: 220px;" title="${nomeExibicao}">
                            ${nomeExibicao} 
                        </h5>
                        <small class="text-muted" style="font-size: 0.65rem">ID: ${hwid.substring(0, 8)}...</small>
                    </div>
                    ${statusBadge}
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

        // --- ATUALIZAÇÃO DO DOM ---
        // Verifica se o card (wrapper) já existe
        let wrapper = document.getElementById(`wrapper-${hwid}`);
        
        if (wrapper) {
            // Card existe: Apenas atualiza o conteúdo interno
            let cardDiv = document.getElementById(`card-${hwid}`);
            if(cardDiv.innerHTML !== htmlContent) {
                cardDiv.innerHTML = htmlContent;
                cardDiv.className = `card shadow-sm card-status card-relative h-100 ${cardClass} ${cardExtraClasses}`;
            }
        } else {
            // Card novo: Cria o Wrapper e o Card
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
async function enviarComando(hwid, nomeExibicao, comando) {
    if (!isUserAdmin) {
        alert("ACESSO RESTRITO: Faça login como administrador.");
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('login-overlay').style.opacity = '1';
        return;
    }
    const acoes = { 'stop': 'PARAR', 'start': 'INICIAR', 'restart': 'REINICIAR', 'update': 'ATUALIZAR', 'open': 'ABRIR' };
    let verbo = "EXECUTAR";
    for (const key in acoes) if (comando.includes(key)) verbo = acoes[key];
    
    if(!confirm(`Confirmação de Segurança:\n\nDeseja realmente ${verbo} o serviço em: ${nomeExibicao}?`)) return;

    try {
        await firebase.database().ref('clientes/' + hwid + '/comando').set(comando);
    } catch (error) { alert("❌ Erro de Permissão: " + error.message); }
}
 
function parseDataPTBR(dataStr) {
    // 1. Se for vazio ou nulo, retorna data zero (1970)
    if (!dataStr) return new Date(0);
    
    // 2. Se for o texto padrão de espera, retorna data zero
    if (dataStr === "Aguardando...") return new Date(0);

    // 3. Verifica se tem o formato correto "DD/MM/AAAA HH:MM:SS" (tem que ter espaço)
    if (dataStr.indexOf(' ') === -1) return new Date(0);

    try {
        const [dateValues, timeValues] = dataStr.split(' ');
        
        // Proteção extra: se faltar a parte da hora
        if (!timeValues) return new Date(0);

        const [day, month, year] = dateValues.split('/');
        const [hours, minutes, seconds] = timeValues.split(':');
        
        return new Date(+year, +month - 1, +day, +hours, +minutes, +seconds);
    } catch (e) {
        console.error("Erro ao converter data:", dataStr);
        return new Date(0); // Em caso de erro, não trava o site
    }
}

function monitorarPendentes() {
    if (!isUserAdmin) return; 
    firebase.database().ref('pendentes').on('value', (snapshot) => {
        const dados = snapshot.val();
        const badge = document.getElementById('badge-pendentes');
        const lista = document.getElementById('lista-pendentes');
        
        // --- ATUALIZA A LISTA GLOBAL DE PENDENTES ---
        idsPendentes = dados ? Object.keys(dados) : [];
        renderizarCards(); // Força atualização do painel para esconder os intrusos
        // --------------------------------------------

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

// --- FUNÇÕES DO CONSOLE ---
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

function adicionarLogConsole(nome, msg) {
    if (!msg) return; // Ignora logs vazios
    
    const consoleBody = document.getElementById('console-body');
    const hora = new Date().toLocaleTimeString('pt-BR');
    
    // Cria a linha do log
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `
        <span class="log-time">[${hora}]</span>
        <span class="log-host">${nome}:</span>
        <span class="log-msg">${msg}</span>
    `;
    
    // Adiciona e rola para o final
    consoleBody.appendChild(div);
    consoleBody.scrollTop = consoleBody.scrollHeight;
}
// --- LÓGICA DE DESTRUIÇÃO ---

function abrirModalDestruicao(hwid, nome) {
    if (!isUserAdmin) return;
    document.getElementById('hwidDestruicao').value = hwid;
    document.getElementById('inputSenhaDestruicao').value = '';
    
    // Atualiza título se quiser
    const modalEl = document.getElementById('modalDestruicao');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function confirmarDestruicao() {
    const hwid = document.getElementById('hwidDestruicao').value;
    const senha = document.getElementById('inputSenhaDestruicao').value;
    const btn = document.querySelector('#modalDestruicao .btn-danger');

    if (!senha) {
        alert("Digite a senha para confirmar.");
        return;
    }

    if (!confirm("Tem certeza absoluta? Esta ação é irreversível.")) return;

    btn.disabled = true;
    btn.innerHTML = "Processando...";

    try {
        // 1. Gerar Hash da Senha
        const hashSenha = await sha256(senha);

        // 2. Tenta enviar o comando (Para o caso dele estar vivo)
        await firebase.database().ref('clientes/' + hwid + '/comando').set(`uninstall|${hashSenha}`);
        
        // --- NOVA LÓGICA: DELEÇÃO FORÇADA PARA AGENTES MORTOS ---
        // Verifica o status atual antes de decidir
        const snapshot = await firebase.database().ref('clientes/' + hwid + '/status_geral').once('value');
        const statusAtual = snapshot.val();

        // Se NÃO estiver 'Online' (está Offline, Erro, ou é aquele card 'Aguardando ID'), deleta na marra
        if (statusAtual !== 'Online') {
            await firebase.database().ref('clientes/' + hwid).remove();
            alert("Agente estava OFFLINE. O registro foi removido manualmente do banco de dados.");
        } else {
            alert("Comando de autodestruição enviado para o Agente Online.\nAguarde ele processar e sumir da tela.");
        }
        // ---------------------------------------------------------
        
        // Fecha o modal
        const modalEl = document.getElementById('modalDestruicao');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-trash-fill"></i> EXECUTAR DESTRUIÇÃO';

    } catch (error) {
        alert("Erro ao processar: " + error.message);
        btn.disabled = false;
    }
}

// async function confirmarDestruicao() {
//     const hwid = document.getElementById('hwidDestruicao').value;
//     const senha = document.getElementById('inputSenhaDestruicao').value;
//     const btn = document.querySelector('#modalDestruicao .btn-danger');

//     if (!senha) {
//         alert("Digite a senha para confirmar.");
//         return;
//     }

//     if (!confirm("Tem certeza absoluta? Esta ação é irreversível.")) return;

//     btn.disabled = true;
//     btn.innerHTML = "Validando...";

//     try {
//         // 1. Gerar Hash da Senha
//         const hashSenha = await sha256(senha);

//         // 2. Enviar comando (Apenas envia, NÃO deleta o registro visualmente ainda)
//         await firebase.database().ref('clientes/' + hwid + '/comando').set(`uninstall|${hashSenha}`);
        
//         // 3. Feedback ao usuário
//         alert("Comando de destruição enviado!\n\nSe a senha estiver correta, o agente ficará vermelho ('DESTRUCT') e sumirá da lista em alguns instantes.");
        
//         // Fecha o modal
//         const modalEl = document.getElementById('modalDestruicao');
//         const modal = bootstrap.Modal.getInstance(modalEl);
//         modal.hide();

//         btn.disabled = false;
//         btn.innerHTML = '<i class="bi bi-trash-fill"></i> EXECUTAR DESTRUIÇÃO';

//     } catch (error) {
//         alert("Erro ao enviar comando: " + error.message);
//         btn.disabled = false;
//     }
// }

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

window.abrirModalAprovacao = function() {
    if (!isUserAdmin) { alert("Faça login."); return; }
    const modal = new bootstrap.Modal(document.getElementById('modalAprovacao'));
    modal.show();
}

window.aprovarAgente = async function(hwid, nome) {
    if (!confirm(`Aprovar ${nome}?`)) return;
    try {
        const snapshot = await firebase.database().ref('pendentes/' + hwid).once('value');
        const dadosPendente = snapshot.val();
        if (!dadosPendente) return;
        const novoCliente = {
            municipio: nome, 
            status_geral: "Offline", 
            ultima_atualizacao: "Aguardando...",
            hardware: dadosPendente.hardware,
            id_dispositivo: hwid,
            comando: ""
        };
        let updates = {};
        updates['/clientes/' + hwid] = novoCliente; 
        updates['/pendentes/' + hwid] = null;       
        await firebase.database().ref().update(updates);
    } catch (error) { alert("Erro: " + error.message); }
}

window.rejeitarAgente = async function(hwid) {
    if (!confirm("Recusar solicitação?")) return;
    await firebase.database().ref('pendentes/' + hwid).remove();
}

window.enviarComandoUpdate = function(hwid, nomeExibicao) {
    const chk = document.getElementById(`chk-bg-${hwid}`);
    const forceBackground = chk && chk.checked;
    
    const comando = forceBackground ? 'update_pec_background' : 'update_pec';
    const modoTexto = forceBackground ? "MODO INVISÍVEL (Background)" : "MODO VISUAL (Janela)";

    if (!isUserAdmin) {
        alert("Faça login para realizar essa ação.");
        return;
    }

    if(!confirm(`Confirmação de Atualização:\n\nMunicípio: ${nomeExibicao}\nModo: ${modoTexto}\n\nDeseja continuar?`)) return;

    firebase.database().ref('clientes/' + hwid + '/comando').set(comando)
        .catch(err => alert("Erro: " + err.message));
}

iniciarCicloAtualizacao();
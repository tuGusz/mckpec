let isUserAdmin = false;
let dadosGlobais = {}; 
let dadosSistema = {}; 
let filtroAtual = 'todos';
let termoPesquisa = '';

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

    // Filtragem
    const listaFiltrada = listaClientes.filter(cliente => {
        let nome = (cliente.municipio || cliente.nome_municipio || "").toLowerCase();
        let id = cliente.hwid.toLowerCase();
        const matchTexto = nome.includes(termoPesquisa) || id.includes(termoPesquisa);
        if(!matchTexto) return false;

        let dataUltima = parseDataPTBR(cliente.ultima_atualizacao);
        let difSegundos = (agora - dataUltima) / 1000;
        let isOnline = difSegundos <= 120;
        let listaErros = cliente.erros || [];
        
        if (filtroAtual === 'todos') return true;
        if (filtroAtual === 'online') return isOnline && cliente.status_geral === 'Online';
        if (filtroAtual === 'erro') return isOnline && cliente.status_geral !== 'Online';
        if (filtroAtual === 'offline') return !isOnline;
        if (filtroAtual === 'pec_off') return isOnline && listaErros.includes("PEC OFF");
        return true;
    });

    if (listaFiltrada.length === 0) {
        container.innerHTML = `<div class="col-12 text-center mt-5"><p class="text-muted">Nenhum resultado encontrado.</p></div>`;
        return;
    }

    listaFiltrada.sort((a, b) => {
        if(a.status_geral !== 'Online' && b.status_geral === 'Online') return -1;
        if(a.status_geral === 'Online' && b.status_geral !== 'Online') return 1;
        return (a.municipio || "").localeCompare(b.municipio || "");
    });

    container.innerHTML = ''; 

    listaFiltrada.forEach(info => {
        let hwid = info.hwid;
        let nomeExibicao = info.municipio || info.nome_municipio || "Sem Nome"; 
        let hwInfo = info.hardware || {};

        let dataUltimaAtualizacao = parseDataPTBR(info.ultima_atualizacao);
        let diferencaSegundos = (agora - dataUltimaAtualizacao) / 1000;
        let isOnline = diferencaSegundos <= 120;

        let isUpdating = (info.comando === 'update_pec' || info.status_geral === 'Atualizando');

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

        // Lógica de Versão
        let versaoPec = info.versao_pec || "N/A";
        let isDesatualizado = compararVersoes(versaoPec, versaoMeta) < 0; // Se versao local < meta

        let htmlVersao = versaoPec !== "N/A" 
                ? `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary me-1 mb-1" title="Versão Mais Recente: ${versaoMeta}"><i class="bi bi-tag-fill"></i> v${versaoPec}</span>`
                : `<span class="badge bg-light text-muted border me-1 mb-1"><i class="bi bi-question-circle"></i> Ver. ?</span>`;

        let htmlServicos = `
                <div class="d-flex flex-wrap mb-3 align-items-center">
                    ${htmlVersao} ${makeBadge("PGSQL", listaErros.includes("PostgreSQL OFF"))}
                    ${makeBadge("e-SUS", listaErros.includes("PEC OFF"))}
                    ${makeBadge("Gateway", listaErros.includes("Gateway OFF"))}
                </div>`;

        // Botões
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
                    btnUpdate = `<button class="btn btn-light border btn-sm text-primary" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'update_pec')"><i class="bi bi-cloud-arrow-down-fill"></i> Atualizar para v${versaoMeta}</button>`;
                } else {
                    btnUpdate = `<button class="btn btn-light border btn-sm text-muted" disabled style="background-color: #f0fdf4; border-color: #bbf7d0 !important; color: #166534 !important;"><i class="bi bi-check-circle-fill"></i> PEC Atualizado</button>`;
                }

                htmlBotoes = `
                    <div class="mt-3 pt-3 border-top">
                        <div class="row g-2">
                            <div class="col-12 mb-2"><small class="text-muted fw-bold d-block mb-1" style="font-size: 0.7rem;">PEC / APLICAÇÃO</small>${btnPec}</div>
                            <div class="col-12"><small class="text-muted fw-bold d-block mb-1" style="font-size: 0.7rem;">BANCO DE DADOS</small>${btnPg}</div>
                            <div class="col-12 mt-2 pt-2 border-top d-grid gap-2">
                                ${btnUpdate}
                                <button class="btn btn-light border btn-sm text-info" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'open_gateway')"><i class="bi bi-window-stack"></i> Abrir Gateway</button>
                            </div>
                        </div>
                    </div>`;
            
            } else {
                htmlBotoes = `
                    <div class="mt-3 pt-3 border-top text-center">
                        <span class="badge bg-light text-secondary border">
                            <i class="bi bi-eye-fill"></i> Faça login para controlar os serviços
                        </span>
                    </div>`;
            }
        } else {
            htmlBotoes = `<div class="mt-3 pt-3 border-top text-center"><small class="text-muted fst-italic">Sem conexão com o agente</small></div>`;
        }

        let overlayHtml = '';
        let cardExtraClasses = '';
        
        if (isUpdating) {
            cardExtraClasses = 'card-updating'; // Aplica o Blur
            overlayHtml = `
                <div class="update-overlay">
                    <div class="spinner-border spinner-update" role="status"></div>
                    <div class="text-update"><i class="bi bi-arrow-repeat"></i> O PEC está sendo atualizado...</div>
                </div>
            `;
        }

        let html = `
            <div class="col-xl-4 col-lg-6">
                <div class="card shadow-sm card-status card-relative h-100 ${cardClass} ${cardExtraClasses}">
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
                                <div class="col-6 text-truncate" title="OS"><i class="bi bi-windows me-1 text-secondary"></i> ${hwInfo.sistema || '?'}</div>
                                <div class="col-6 text-truncate" title="User"><i class="bi bi-person-fill me-1 text-secondary"></i> ${hwInfo.usuario || '?'}</div>
                                <div class="col-6 text-truncate" title="RAM"><i class="bi bi-memory me-1 text-secondary"></i> ${hwInfo.memoria_ram || '?'}</div>
                                <div class="col-12 border-top my-1"></div>
                                <div class="col-12 text-truncate" title="CPU"><i class="bi bi-cpu me-1 text-secondary"></i> ${hwInfo.processador || '?'}</div>
                                <div class="col-12 text-truncate" title="Disco"><i class="bi bi-hdd me-1 text-secondary"></i> ${hwInfo.armazenamento || '?'}</div>
                            </div>
                        </div>
                        ${htmlBotoes}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
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
        
        if (!dados) {
            badge.style.display = 'none';
            lista.innerHTML = '<div class="p-4 text-center text-muted">Nenhuma solicitação pendente.</div>';
            return;
        }
        const qtd = Object.keys(dados).length;
        badge.innerText = qtd;
        badge.style.display = 'block';
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
    });
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
 
iniciarCicloAtualizacao();
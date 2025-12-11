// --- ESTADO GLOBAL ---
let isUserAdmin = false;
let dadosGlobais = {}; // Guarda os dados puros do Firebase
let filtroAtual = 'todos'; // Filtro selecionado
let termoPesquisa = '';    // Texto da busca

const URL_BANCO_LEITURA = "https://monitorpec-72985-default-rtdb.firebaseio.com/clientes.json";
const URL_PENDENTES = "https://monitorpec-72985-default-rtdb.firebaseio.com/pendentes.json";

// --- SISTEMA DE LOGIN ---
function fazerLogin() {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const msg = document.getElementById('msg-login');
    const btn = document.querySelector('#login-overlay button');

    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Entrando...';
    btn.disabled = true;

    firebase.auth().signInWithEmailAndPassword(email, senha)
        .then((userCredential) => {
            document.getElementById('login-overlay').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('login-overlay').style.display = 'none';
            }, 500);

            isUserAdmin = true;
            
            const userDisplay = document.getElementById('user-display');
            userDisplay.innerText = userCredential.user.email;
            userDisplay.className = "fw-bold text-info";
            
            iniciarCicloAtualizacao();
            monitorarPendentes();
        })
        .catch((error) => {
            btn.innerHTML = 'Entrar';
            btn.disabled = false;
            let erroMsg = error.message;
            if(error.code === 'auth/wrong-password') erroMsg = "Senha incorreta.";
            if(error.code === 'auth/user-not-found') erroMsg = "Usuário não encontrado.";
            if(error.code === 'auth/invalid-email') erroMsg = "Email inválido.";
            msg.innerText = erroMsg;
        });
}

function entrarModoLeitura() {
    document.getElementById('login-overlay').style.display = 'none';
    isUserAdmin = false;
    iniciarCicloAtualizacao();
}

// --- LÓGICA DE FILTROS E PESQUISA ---

// Chamado quando clica nos botões de filtro (Online, Erro, etc)
// --- LÓGICA DE FILTROS E PESQUISA ATUALIZADA ---

window.setFiltro = function(tipo, btnElement) {
    filtroAtual = tipo;
    
    const container = document.getElementById('filtros-container');
    const botoes = container.getElementsByTagName('button');

    // 1. Reseta todos os botões para o estado "inativo"
    for(let btn of botoes) {
        btn.classList.remove('active');
        // Remove ícones cheios se tiver (opcional, visual cleaner)
    }

    // 2. Ativa apenas o botão clicado
    btnElement.classList.add('active');

    // 3. Reaplica a renderização
    renderizarCards();
}

// Chamado quando digita na busca
window.aplicarFiltros = function() {
    termoPesquisa = document.getElementById('inputPesquisa').value.toLowerCase();
    renderizarCards();
}

// --- CORE: ATUALIZAÇÃO E RENDERIZAÇÃO ---

function iniciarCicloAtualizacao() {
    buscarDados();
    setInterval(buscarDados, 5000); // Busca a cada 5s
}

async function buscarDados() {
    try {
        document.getElementById('relogio').innerText = new Date().toLocaleTimeString('pt-BR');
        const resposta = await fetch(URL_BANCO_LEITURA);
        const dados = await resposta.json();
        
        if (!dados) {
            dadosGlobais = {};
        } else {
            dadosGlobais = dados;
        }
        renderizarCards(); // Chama a função que desenha na tela
    } catch (e) {
        console.error("Erro ao buscar dados:", e);
    }
}

function renderizarCards() {
    const container = document.getElementById('painel-clientes');
    const agora = new Date();
    
    // Converte objeto em array para filtrar
    let listaClientes = [];
    for (let hwid in dadosGlobais) {
        let cliente = dadosGlobais[hwid];
        cliente.hwid = hwid; // Guarda o ID dentro do objeto para facilitar
        listaClientes.push(cliente);
    }

    // 1. APLICAR FILTROS INTELIGENTES
    const listaFiltrada = listaClientes.filter(cliente => {
        let nome = (cliente.municipio || cliente.nome_municipio || "").toLowerCase();
        let id = cliente.hwid.toLowerCase();
        
        // Filtro de Texto (Pesquisa)
        const matchTexto = nome.includes(termoPesquisa) || id.includes(termoPesquisa);
        if(!matchTexto) return false;

        // Cálculos de Status para o Filtro de Botão
        let dataUltima = parseDataPTBR(cliente.ultima_atualizacao);
        let difSegundos = (agora - dataUltima) / 1000;
        let isOnline = difSegundos <= 120;
        let listaErros = cliente.erros || [];
        
        // Filtro de Botão (Categoria)
        if (filtroAtual === 'todos') return true;
        if (filtroAtual === 'online') return isOnline && cliente.status_geral === 'Online';
        if (filtroAtual === 'erro') return isOnline && cliente.status_geral !== 'Online'; // Online mas com erro
        if (filtroAtual === 'offline') return !isOnline;
        if (filtroAtual === 'pec_off') return isOnline && listaErros.includes("PEC OFF"); // Filtro Específico
        
        return true;
    });

    // Se não tiver ninguém
    if (listaFiltrada.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center mt-5">
                <i class="bi bi-search display-4 text-muted"></i>
                <p class="mt-3 text-muted">Nenhum resultado encontrado para os filtros atuais.</p>
            </div>`;
        return;
    }

    // Ordenação: Clientes com erro primeiro, depois alfabético
    listaFiltrada.sort((a, b) => {
        if(a.status_geral !== 'Online' && b.status_geral === 'Online') return -1;
        if(a.status_geral === 'Online' && b.status_geral !== 'Online') return 1;
        return (a.municipio || "").localeCompare(b.municipio || "");
    });

    container.innerHTML = ''; 

    // 2. DESENHAR CARDS (LOOP)
    listaFiltrada.forEach(info => {
        let hwid = info.hwid;
        let nomeExibicao = info.municipio || info.nome_municipio || "Sem Nome"; 
        let hwInfo = info.hardware || {};

        let dataUltimaAtualizacao = parseDataPTBR(info.ultima_atualizacao);
        let diferencaSegundos = (agora - dataUltimaAtualizacao) / 1000;
        let isOnline = diferencaSegundos <= 120;
        
        // Cores e Status
        let statusBadge = isOnline 
            ? `<span class="badge bg-success bg-opacity-10 text-success border border-success"><i class="bi bi-wifi"></i> Online</span>`
            : `<span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary"><i class="bi bi-wifi-off"></i> Offline</span>`;

        let cardClass = isOnline ? (info.status_geral === 'Online' ? "status-Online" : "status-Erro") : "status-Offline";
        let colorStatus = isOnline ? (info.status_geral === 'Online' ? "success" : "danger") : "secondary";
        let textStatus = isOnline ? (info.status_geral === 'Online' ? "OPERACIONAL" : "ERRO DETECTADO") : "AGENTE OFFLINE";

        // Badges Serviços
        let listaErros = info.erros || [];
        const makeBadge = (nome, isError) => isError 
            ? `<span class="badge bg-danger text-white me-1 mb-1"><i class="bi bi-x-circle-fill"></i> ${nome}</span>` 
            : `<span class="badge bg-light text-dark border me-1 mb-1"><i class="bi bi-check-circle-fill text-success"></i> ${nome}</span>`;

        let htmlServicos = `
            <div class="d-flex flex-wrap mb-3">
                ${makeBadge("PGSQL", listaErros.includes("PostgreSQL OFF"))}
                ${makeBadge("e-SUS", listaErros.includes("PEC OFF"))}
                ${makeBadge("Gateway", listaErros.includes("Gateway OFF"))}
            </div>
        `;

        // Botões
        let htmlBotoes = '';
        if (isOnline) {
             let btnPec = listaErros.includes("PEC OFF")
                ? `<button class="btn btn-outline-success btn-sm btn-acao w-100" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'start_esus')"><i class="bi bi-play-fill"></i> INICIAR e-SUS</button>`
                : `<div class="btn-group w-100 mb-1"><button class="btn btn-outline-danger btn-sm btn-acao w-50 rounded-end-0" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'stop_esus')"><i class="bi bi-stop-fill"></i> PARAR</button><button class="btn btn-outline-warning btn-sm btn-acao w-50 rounded-start-0" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'restart_esus')"><i class="bi bi-arrow-clockwise"></i> REINICIAR</button></div>`;

            let btnPg = listaErros.includes("PostgreSQL OFF")
                ? `<button class="btn btn-outline-success btn-sm btn-acao w-100" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'start_pg')"><i class="bi bi-play-fill"></i> INICIAR PGSQL</button>`
                : `<div class="btn-group w-100 mb-1"><button class="btn btn-outline-danger btn-sm btn-acao w-50 rounded-end-0" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'stop_pg')"><i class="bi bi-stop-fill"></i> PARAR</button><button class="btn btn-outline-warning btn-sm btn-acao w-50 rounded-start-0" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'restart_pg')"><i class="bi bi-arrow-clockwise"></i> REINICIAR</button></div>`;

            htmlBotoes = `
                <div class="mt-3 pt-3 border-top">
                    <div class="row g-2">
                        <div class="col-12 mb-2"><small class="text-muted fw-bold d-block mb-1" style="font-size: 0.7rem;">PEC / APLICAÇÃO</small>${btnPec}</div>
                        <div class="col-12"><small class="text-muted fw-bold d-block mb-1" style="font-size: 0.7rem;">BANCO DE DADOS</small>${btnPg}</div>
                        <div class="col-12 mt-2 pt-2 border-top d-grid gap-2">
                            <button class="btn btn-light border btn-sm text-primary" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'update_pec')"><i class="bi bi-cloud-arrow-down-fill"></i> Atualizar PEC</button>
                            <button class="btn btn-light border btn-sm text-info" onclick="enviarComando('${hwid}', '${nomeExibicao}', 'open_gateway')"><i class="bi bi-window-stack"></i> Abrir Gateway</button>
                        </div>
                    </div>
                </div>`;
        } else {
            htmlBotoes = `<div class="mt-3 pt-3 border-top text-center"><small class="text-muted fst-italic">Sem conexão com o agente</small></div>`;
        }

        // HTML Card
        let html = `
            <div class="col-xl-4 col-lg-6">
                <div class="card shadow-sm card-status h-100 ${cardClass}">
                    <div class="card-body">
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

// --- COMANDOS (MANTIDOS) ---
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

// --- FUNÇÕES AUXILIARES E MONITORAMENTO (MANTIDOS) ---
function parseDataPTBR(dataStr) {
    if(!dataStr) return new Date(0);
    const [dateValues, timeValues] = dataStr.split(' ');
    const [day, month, year] = dateValues.split('/');
    const [hours, minutes, seconds] = timeValues.split(':');
    return new Date(+year, +month - 1, +day, +hours, +minutes, +seconds);
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
// Inicia o ciclo
atualizarPainel();
setInterval(atualizarPainel, 5000);
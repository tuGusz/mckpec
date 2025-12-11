// Estado Global
let isUserAdmin = false;
const URL_BANCO_LEITURA = "https://monitorpec-72985-default-rtdb.firebaseio.com/clientes.json";

// --- SISTEMA DE LOGIN ---

function fazerLogin() {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const msg = document.getElementById('msg-login');
    const btn = document.querySelector('#login-overlay button');

    // Feedback visual de carregamento
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Entrando...';
    btn.disabled = true;

    firebase.auth().signInWithEmailAndPassword(email, senha)
        .then((userCredential) => {
            document.getElementById('login-overlay').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('login-overlay').style.display = 'none';
            }, 500); // Animação suave

            isUserAdmin = true;
            
            // Atualiza UI da Navbar
            const userDisplay = document.getElementById('user-display');
            userDisplay.innerText = userCredential.user.email;
            userDisplay.className = "fw-bold text-info"; // Cor de destaque
            
            atualizarPainel(); // Recarrega para liberar botões
            monitorarPendentes();
        })
        .catch((error) => {
            btn.innerHTML = 'Entrar';
            btn.disabled = false;
            
            // Tratamento de erros comuns em português
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
    // Toast ou alerta suave seria melhor, mas alert serve por enquanto
    console.log("Entrou em modo leitura");
    atualizarPainel();
}

// --- COMANDOS E AÇÕES ---

// Alteramos para receber (hwid, nome, comando)
async function enviarComando(hwid, nomeExibicao, comando) {
    if (!isUserAdmin) {
        alert("ACESSO RESTRITO: Faça login como administrador.");
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('login-overlay').style.opacity = '1';
        return;
    }

    const acoes = {
        'stop': 'PARAR',
        'start': 'INICIAR',
        'restart': 'REINICIAR',
        'update': 'ATUALIZAR',
        'open': 'ABRIR'
    };
    
    let verbo = "EXECUTAR";
    for (const key in acoes) {
        if (comando.includes(key)) verbo = acoes[key];
    }
    
    // Agora o alerta mostra o nome legível (ex: "Notebook") e não o código d936...
    if(!confirm(`Confirmação de Segurança:\n\nDeseja realmente ${verbo} o serviço em: ${nomeExibicao}?`)) return;

    try {
        // Envia para o caminho correto usando o HWID
        await firebase.database().ref('clientes/' + hwid + '/comando').set(comando);
        // alert("✅ Comando enviado."); // Opcional: Remova se quiser menos cliques
    } catch (error) {
        alert("❌ Erro de Permissão: " + error.message);
    }
}

// --- FUNÇÕES AUXILIARES ---

function parseDataPTBR(dataStr) {
    if(!dataStr) return new Date(0);
    const [dateValues, timeValues] = dataStr.split(' ');
    const [day, month, year] = dateValues.split('/');
    const [hours, minutes, seconds] = timeValues.split(':');
    return new Date(+year, +month - 1, +day, +hours, +minutes, +seconds);
}

// --- CORE: ATUALIZAÇÃO DO PAINEL ---

async function atualizarPainel() {
    try {
        // Atualiza relógio do topo
        document.getElementById('relogio').innerText = new Date().toLocaleTimeString('pt-BR');
        
        const resposta = await fetch(URL_BANCO_LEITURA);
        const dados = await resposta.json();
            
        const container = document.getElementById('painel-clientes');
        
        if (!dados) {
            container.innerHTML = `
                <div class="col-12 text-center mt-5">
                    <i class="bi bi-database-x display-1 text-muted"></i>
                    <p class="mt-3 text-muted">Nenhum cliente conectado à base.</p>
                </div>`;
            return;
        }

        container.innerHTML = ''; 
        const agora = new Date();

        for (let hwid in dados) {
            let info = dados[hwid];
            
            // Tratamento de dados nulos para evitar "undefined" na tela
            let nomeExibicao = info.municipio || info.nome_municipio || "Sem Nome"; 
            let hwInfo = info.hardware || {}; // Garante que hardware não seja nulo

            // Lógica Heartbeat (Tempo desde a última resposta)
            let dataUltimaAtualizacao = parseDataPTBR(info.ultima_atualizacao);
            let diferencaSegundos = (agora - dataUltimaAtualizacao) / 1000;
            let isOnline = diferencaSegundos <= 120; // 2 minutos de tolerância
            
            // Badges de Status
            let statusBadge = isOnline 
                ? `<span class="badge bg-success bg-opacity-10 text-success border border-success"><i class="bi bi-wifi"></i> Online</span>`
                : `<span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary"><i class="bi bi-wifi-off"></i> Offline</span>`;

            let cardClass = isOnline ? (info.status_geral === 'Online' ? "status-Online" : "status-Erro") : "status-Offline";
            let colorStatus = isOnline ? (info.status_geral === 'Online' ? "success" : "danger") : "secondary";
            let textStatus = isOnline ? (info.status_geral === 'Online' ? "OPERACIONAL" : "ERRO DETECTADO") : "AGENTE OFFLINE";

            // Badges de Serviços
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

            // Botões de Ação
            let htmlBotoes = '';
            if (isOnline) {
                // ... (Botões mantidos iguais à versão anterior corrigida) ...
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

            // HTML FINAL DO CARD
            let html = `
                <div class="col-xl-4 col-lg-6"> <div class="card shadow-sm card-status h-100 ${cardClass}">
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
                                    <i class="bi bi-clock-history"></i> Ultima atualização: ${info.ultima_atualizacao || '--:--'}
                                </small>
                            </div>

                            ${htmlServicos}

                            <div class="bg-light p-3 rounded-3 border mb-3" style="font-size: 0.75rem;">
                                <div class="row g-2">
                                    <div class="col-6 text-truncate" title="Computador">
                                        <i class="bi bi-pc-display me-1 text-secondary"></i> <strong>${info.maquina || '?'}</strong>
                                    </div>
                                    <div class="col-6 text-truncate" title="Sistema Operacional">
                                        <i class="bi bi-windows me-1 text-secondary"></i> ${hwInfo.sistema || '?'}
                                    </div>
                                    
                                    <div class="col-6 text-truncate" title="Usuário Logado">
                                        <i class="bi bi-person-fill me-1 text-secondary"></i> ${hwInfo.usuario || '?'}
                                    </div>
                                    <div class="col-6 text-truncate" title="Memória RAM">
                                        <i class="bi bi-memory me-1 text-secondary"></i> ${hwInfo.memoria_ram || '?'}
                                    </div>

                                    <div class="col-12 border-top my-1"></div>

                                    <div class="col-12 text-truncate" title="Processador">
                                        <i class="bi bi-cpu me-1 text-secondary"></i> ${hwInfo.processador || '?'}
                                    </div>
                                    <div class="col-12 text-truncate" title="Placa Mãe">
                                        <i class="bi bi-motherboard me-1 text-secondary"></i> ${hwInfo.placa_mae || '?'}
                                    </div>
                                    <div class="col-12 text-truncate" title="Disco">
                                        <i class="bi bi-hdd me-1 text-secondary"></i> ${hwInfo.armazenamento || '?'}
                                    </div>
                                </div>
                            </div>

                            ${htmlBotoes}
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += html;
        }

    } catch (erro) {
        console.error(erro);
    }
}

// --- SISTEMA DE APROVAÇÃO (SECURITY) ---

const URL_PENDENTES = "https://monitorpec-72985-default-rtdb.firebaseio.com/pendentes.json";

// 1. Monitora a fila de espera em tempo real
function monitorarPendentes() {
    // Só roda se estiver logado (Admin)
    if (!isUserAdmin) return; 

    // Ouve mudanças na pasta pendentes
    firebase.database().ref('pendentes').on('value', (snapshot) => {
        const dados = snapshot.val();
        const badge = document.getElementById('badge-pendentes');
        const lista = document.getElementById('lista-pendentes');
        
        if (!dados) {
            badge.style.display = 'none';
            lista.innerHTML = '<div class="p-4 text-center text-muted">Nenhuma solicitação pendente.</div>';
            return;
        }

        // Atualiza contador
        const qtd = Object.keys(dados).length;
        badge.innerText = qtd;
        badge.style.display = 'block';

        // Renderiza a lista no Modal
        lista.innerHTML = '';
        
        for (let hwid in dados) {
            let item = dados[hwid];
            let html = `
                <div class="list-group-item d-flex justify-content-between align-items-center p-3">
                    <div>
                        <h6 class="mb-1 fw-bold text-primary">${item.nome_solicitado}</h6>
                        <small class="text-muted d-block" style="font-size: 0.75rem">
                            <i class="bi bi-cpu"></i> ID: ${hwid.substring(0, 15)}...
                        </small>
                        <small class="text-muted" style="font-size: 0.75rem">
                            <i class="bi bi-clock"></i> ${item.data_solicitacao}
                        </small>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-danger" onclick="rejeitarAgente('${hwid}')">
                            <i class="bi bi-trash"></i> Recusar
                        </button>
                        <button class="btn btn-sm btn-success text-white" onclick="aprovarAgente('${hwid}', '${item.nome_solicitado}')">
                            <i class="bi bi-check-lg"></i> APROVAR
                        </button>
                    </div>
                </div>
            `;
            lista.innerHTML += html;
        }
    });
}

// 2. Abre o Modal
window.abrirModalAprovacao = function() {
    if (!isUserAdmin) {
        alert("Faça login para gerenciar solicitações.");
        return;
    }
    const modal = new bootstrap.Modal(document.getElementById('modalAprovacao'));
    modal.show();
}

// 3. APROVAR: Move de Pendentes -> Clientes
window.aprovarAgente = async function(hwid, nome) {
    if (!confirm(`Confirma a aprovação de: ${nome}?`)) return;

    try {
        // Pega os dados completos do pendente
        const snapshot = await firebase.database().ref('pendentes/' + hwid).once('value');
        const dadosPendente = snapshot.val();

        if (!dadosPendente) return;

        // Prepara os dados limpos para a área de produção (/clientes)
        const novoCliente = {
            municipio: nome, // Nome oficial
            status_geral: "Offline", // Começa offline até o agente bater ponto
            ultima_atualizacao: "Aguardando...",
            hardware: dadosPendente.hardware,
            id_dispositivo: hwid,
            comando: ""
        };

        // ATOMIC UPDATE: Faz tudo de uma vez para não ter erro
        let updates = {};
        updates['/clientes/' + hwid] = novoCliente; // Cria em clientes
        updates['/pendentes/' + hwid] = null;       // Deleta de pendentes

        await firebase.database().ref().update(updates);
        
        // alert("Agente aprovado com sucesso!"); // Opcional, o UI já atualiza sozinho
    } catch (error) {
        alert("Erro ao aprovar: " + error.message);
    }
}

// 4. REJEITAR: Apenas deleta
window.rejeitarAgente = async function(hwid) {
    if (!confirm("Tem certeza? Isso vai apagar a solicitação.")) return;
    await firebase.database().ref('pendentes/' + hwid).remove();
}

// Adicione esta chamada dentro da função fazerLogin() para iniciar o monitoramento
// logo após o usuário colocar a senha correta.

// Inicia o ciclo
atualizarPainel();
setInterval(atualizarPainel, 5000);
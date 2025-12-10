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

async function enviarComando(municipio, comando) {
    if (!isUserAdmin) {
        alert("ACESSO RESTRITO: Faça login como administrador.");
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('login-overlay').style.opacity = '1';
        return;
    }

    // Traduções para o alerta
    const acoes = {
        'stop': 'PARAR',
        'start': 'INICIAR',
        'restart': 'REINICIAR',
        'update': 'ATUALIZAR',
        'open': 'ABRIR'
    };
    
    // Tenta encontrar a palavra chave no comando
    let verbo = "EXECUTAR";
    for (const key in acoes) {
        if (comando.includes(key)) verbo = acoes[key];
    }
    
    if(!confirm(`Confirmação de Segurança:\n\nDeseja realmente ${verbo} o serviço em: ${municipio}?`)) return;

    try {
        await firebase.database().ref('clientes/' + municipio + '/comando').set(comando);
        alert("✅ Comando enviado com sucesso.");
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
        // Atualiza relógio
        document.getElementById('relogio').innerText = new Date().toLocaleTimeString('pt-BR');
        
        const resposta = await fetch(URL_BANCO_LEITURA);
        const dados = await resposta.json();
            
        const container = document.getElementById('painel-clientes');
        
        // Se não houver dados, não limpa a tela para não piscar, apenas avisa se estiver vazio
        if (!dados) {
            container.innerHTML = `
                <div class="col-12 text-center mt-5">
                    <i class="bi bi-database-x display-1 text-muted"></i>
                    <p class="mt-3 text-muted">Nenhum cliente conectado à base.</p>
                </div>`;
            return;
        }

        // Limpa container (Em apps maiores usaríamos React/Vue para não recriar tudo)
        container.innerHTML = ''; 
        const agora = new Date();

        for (let municipio in dados) {
            let info = dados[municipio];
            
            // Lógica Heartbeat (2 minutos)
            let dataUltimaAtualizacao = parseDataPTBR(info.ultima_atualizacao);
            let diferencaSegundos = (agora - dataUltimaAtualizacao) / 1000;
            let isOnline = diferencaSegundos <= 120;
            
            let statusBadge = isOnline 
                ? `<span class="badge bg-success bg-opacity-10 text-success border border-success"><i class="bi bi-wifi"></i> Online</span>`
                : `<span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary"><i class="bi bi-wifi-off"></i> Offline</span>`;

            // Cores e Bordas
            let cardClass = "status-Offline"; // Padrão
            let textStatus = "DESCONHECIDO";
            let colorStatus = "secondary";

            if (isOnline) {
                if (info.status_geral === 'Online') {
                    cardClass = "status-Online";
                    textStatus = "OPERACIONAL";
                    colorStatus = "success";
                } else {
                    cardClass = "status-Erro";
                    textStatus = "ERRO DETECTADO";
                    colorStatus = "danger";
                }
            } else {
                textStatus = "AGENTE OFFLINE";
            }

            // Status Serviços
            let listaErros = info.erros || [];
            
            const makeBadge = (nome, isError) => {
                return isError 
                    ? `<span class="badge bg-danger text-white badge-servico"><i class="bi bi-x-circle-fill"></i> ${nome} OFF</span>`
                    : `<span class="badge bg-light text-dark border badge-servico"><i class="bi bi-check-circle-fill text-success"></i> ${nome} OK</span>`;
            };

            let htmlPostgres = makeBadge("PGSQL", listaErros.includes("PostgreSQL OFF"));
            let htmlPEC = makeBadge("e-SUS", listaErros.includes("PEC OFF"));
            let htmlGateway = makeBadge("Gateway", listaErros.includes("Gateway OFF"));

            // Botões de Ação
            let htmlBotoes = '';
            
            if (isOnline) {
                // Lógica dinâmica dos botões
                let btnPec = listaErros.includes("PEC OFF")
                    ? `<button class="btn btn-outline-success btn-sm btn-acao" onclick="enviarComando('${municipio}', 'start_esus')"><i class="bi bi-play-fill"></i> Iniciar e-SUS</button>`
                    : `<div class="btn-group w-100 mb-1">
                         <button class="btn btn-outline-danger btn-sm btn-acao rounded-end-0" onclick="enviarComando('${municipio}', 'stop_esus')"><i class="bi bi-stop-fill"></i> Parar</button>
                         <button class="btn btn-outline-warning btn-sm btn-acao rounded-start-0" onclick="enviarComando('${municipio}', 'restart_esus')"><i class="bi bi-arrow-clockwise"></i> Reiniciar</button>
                       </div>`;

                let btnPg = listaErros.includes("PostgreSQL OFF")
                    ? `<button class="btn btn-outline-success btn-sm btn-acao" onclick="enviarComando('${municipio}', 'start_pg')"><i class="bi bi-play-fill"></i> Iniciar PGSQL</button>`
                    : `<div class="btn-group w-100 mb-1">
                         <button class="btn btn-outline-danger btn-sm btn-acao rounded-end-0" onclick="enviarComando('${municipio}', 'stop_pg')"><i class="bi bi-stop-fill"></i> Parar</button>
                         <button class="btn btn-outline-warning btn-sm btn-acao rounded-start-0" onclick="enviarComando('${municipio}', 'restart_pg')"><i class="bi bi-arrow-clockwise"></i> Reiniciar</button>
                       </div>`;

                htmlBotoes = `
                    <div class="mt-3 pt-3 border-top">
                        <div class="d-flex justify-content-between mb-2">
                            <span class="text-uppercase text-muted" style="font-size: 0.7rem; font-weight: 700;">Painel de Controle</span>
                            <i class="bi bi-terminal text-muted"></i>
                        </div>
                        <div class="row g-2">
                            <div class="col-6">${btnPec}</div>
                            <div class="col-6">${btnPg}</div>
                            <div class="col-12 mt-1">
                                <div class="d-grid gap-2">
                                    <button class="btn btn-light border btn-sm btn-acao text-primary" onclick="enviarComando('${municipio}', 'update_pec')"><i class="bi bi-cloud-arrow-down-fill"></i> Atualizar Versão PEC</button>
                                    <button class="btn btn-light border btn-sm btn-acao text-info" onclick="enviarComando('${municipio}', 'open_gateway')"><i class="bi bi-window-stack"></i> Interface Gateway</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                htmlBotoes = `
                    <div class="mt-3 pt-3 border-top text-center">
                        <small class="text-muted fst-italic">
                            <i class="bi bi-exclamation-triangle"></i> Conecte o agente para liberar ações.
                        </small>
                    </div>
                `;
            }

            // Montagem do HTML
            let html = `
                <div class="col-xl-3 col-lg-4 col-md-6">
                    <div class="card shadow-sm card-status h-100 ${cardClass}">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                    <h5 class="card-title fw-bold mb-1 text-dark">${municipio}</h5>
                                    <h6 class="card-subtitle text-muted" style="font-size: 0.8rem">
                                        <i class="bi bi-pc-display me-1"></i> ${info.maquina || 'PC Desconhecido'}
                                    </h6>
                                </div>
                                ${statusBadge}
                            </div>
                            
                            <div class="mb-3">
                                <span class="badge bg-${colorStatus} w-100 py-2">${textStatus}</span>
                            </div>

                            <div class="my-3">
                                ${htmlPostgres} ${htmlPEC} ${htmlGateway}
                            </div>

                            <div class="hardware-info p-2">
                                <div class="d-flex justify-content-between border-bottom pb-1 mb-1">
                                    <span><i class="bi bi-cpu"></i> CPU</span>
                                    <span class="fw-bold text-truncate" style="max-width: 120px;" title="${info.hardware.processador}">${info.hardware.processador || '?'}</span>
                                </div>
                                <div class="d-flex justify-content-between border-bottom pb-1 mb-1">
                                    <span><i class="bi bi-memory"></i> RAM</span>
                                    <span class="fw-bold">${info.hardware.memoria_ram || '?'}</span>
                                </div>
                                <div class="d-flex justify-content-between">
                                    <span><i class="bi bi-hdd"></i> Disco</span>
                                    <span class="fw-bold">${info.hardware.armazenamento || '?'}</span>
                                </div>
                                <div class="mt-2 text-end text-muted" style="font-size: 0.65rem;">
                                    Atualizado: ${info.ultima_atualizacao}
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

// Inicia o ciclo
atualizarPainel();
setInterval(atualizarPainel, 5000);
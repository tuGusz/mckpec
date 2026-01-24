async function enviarComando(hwid, nomeExibicao, comando) {
    console.log(`[DEBUG] Iniciando envio de comando: ${comando} para ${nomeExibicao} (${hwid})`);

    // 1. Verificação de Auth
    if (!window.isUserAdmin) {
        console.warn("[DEBUG] Usuário não é admin via window.isUserAdmin");
        alert("ACESSO RESTRITO: Faça login como administrador.");
        const loginOverlay = document.getElementById('login-overlay');
        if(loginOverlay) {
            loginOverlay.style.display = 'flex';
            loginOverlay.style.opacity = '1';
        }
        return;
    }

    // 2. Confirmação
    const acoes = { 'stop': 'PARAR', 'start': 'INICIAR', 'restart': 'REINICIAR', 'update': 'ATUALIZAR', 'open': 'ABRIR' };
    let verbo = "EXECUTAR";
    for (const key in acoes) if (comando.includes(key)) verbo = acoes[key];
    
    if(!confirm(`Confirmação de Segurança:\n\nDeseja realmente ${verbo} o serviço em: ${nomeExibicao}?`)) {
        console.log("[DEBUG] Ação cancelada pelo usuário.");
        return;
    }

    // 3. Feedback Visual (Overlay)
    const cardId = `card-${hwid}`;
    const cardElement = document.getElementById(cardId);
    
    if (cardElement) {
        console.log("[DEBUG] Card encontrado. Aplicando overlay...");
        
        // Remove anterior se houver
        let existingOverlay = cardElement.querySelector('.command-overlay');
        if (existingOverlay) existingOverlay.remove();

        // Cria Overlay
        const overlay = document.createElement('div');
        overlay.className = 'command-overlay';
        overlay.innerHTML = `
            <div class="pulsing-icon"><i class="bi bi-wifi-2"></i></div>
            <h6 class="fw-bold text-dark mt-2">Enviando Comando...</h6>
            <small class="text-muted text-center px-3">O agente processará em até 15s.</small>
        `;
        
        // Garante que o card tenha posição relativa para o overlay absoluto funcionar
        cardElement.style.position = 'relative'; 
        cardElement.appendChild(overlay);
        
        // Timer de segurança
        setTimeout(() => {
            if(overlay && overlay.parentNode) overlay.remove();
        }, 25000);
    } else {
        console.error(`[ERRO CRÍTICO] Card com ID '${cardId}' não encontrado no DOM! O overlay não aparecerá.`);
    }

    // 4. Envio ao Firebase
    try {
        console.log("[DEBUG] Enviando para Firebase...");
        await firebase.database().ref('clientes/' + hwid + '/comando').set(comando);
        console.log("[DEBUG] Comando enviado com sucesso!");
    } catch (error) { 
        console.error("[ERRO FIREBASE]", error);
        alert("❌ Erro de Permissão: " + error.message);
        // Remove overlay em caso de erro
        if (cardElement) {
            const overlayErro = cardElement.querySelector('.command-overlay');
            if(overlayErro) overlayErro.remove();
        }
    }
}

function abrirModalDestruicao(hwid) {
    if (!isUserAdmin) return;
    document.getElementById('hwidDestruicao').value = hwid;
    document.getElementById('inputSenhaDestruicao').value = '';
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
        const hashSenha = await sha256(senha);
        await firebase.database().ref('clientes/' + hwid + '/comando').set(`uninstall|${hashSenha}`);
        const snapshot = await firebase.database().ref('clientes/' + hwid + '/status_geral').once('value');
        const statusAtual = snapshot.val();

        if (statusAtual !== 'Online') {
            await firebase.database().ref('clientes/' + hwid).remove();
            alert("Agente estava OFFLINE. O registro foi removido manualmente do banco de dados.");
        } else {
            alert("Comando de autodestruição enviado para o Agente Online.\nAguarde ele processar e sumir da tela.");
        }
   
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

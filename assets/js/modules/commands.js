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

window.isUserAdmin = false;

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
            userDisplay.innerText = user.email.split('@')[0]; 
            userDisplay.className = "fw-bold text-info";
        }

        iniciarCicloAtualizacao();
        monitorarPendentes();
        
    } else {
        console.log("Modo Visitante.");
        isUserAdmin = false;
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
    const lembrar = document.getElementById('lembrar').checked; 
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

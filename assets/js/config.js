const firebaseConfig = {
    apiKey: "AIzaSyBvYpxSx7hVBfYdAda3UM5TnDE-Uqcbl8Q",
    authDomain: "monitorpec-72985.firebaseapp.com",
    databaseURL: "https://monitorpec-72985-default-rtdb.firebaseio.com",
    projectId: "monitorpec-72985",
    storageBucket: "monitorpec-72985.firebasestorage.app",
    messagingSenderId: "173305825794",
    appId: "1:173305825794:web:bd9b1a38f3c65298dab51b",
    measurementId: "G-2XFRT3B3P3"
};

 
try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase inicializado com sucesso.");
} catch(e) {
    console.error("Erro ao inicializar Firebase:", e);
    alert("Erro crítico de configuração do sistema.");
}
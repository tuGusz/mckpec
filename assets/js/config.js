const firebaseConfig = {
  apiKey: "AIzaSyBHOP25lBchxT0LXKF08dImg54KI-MAVZM",
  authDomain: "mpec-6fdf1.firebaseapp.com",
  databaseURL: "https://mpec-6fdf1-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mpec-6fdf1",
  storageBucket: "mpec-6fdf1.firebasestorage.app",
  messagingSenderId: "114353763631",
  appId: "1:114353763631:web:0e0044ff28bb1601e3ddda",
  measurementId: "G-SWKQSS6VXJ"
};

try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase inicializado com sucesso.");
} catch(e) {
    console.error("Erro ao inicializar Firebase:", e);
    alert("Erro crítico de configuração do sistema.");
}
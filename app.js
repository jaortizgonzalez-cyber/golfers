import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ⚠️ PEGA AQUÍ TU firebaseConfig
const firebaseConfig = {
    apiKey: "AIzaSyD_FU4S9CYZi2zXka0WAck-DL6r3Sl4XSE",
  authDomain: "golfers-bf5ec.firebaseapp.com",
  projectId: "golfers-bf5ec",
  storageBucket: "golfers-bf5ec.firebasestorage.app",
  messagingSenderId: "1004442521926",
  appId: "1:1004442521926:web:6563197e04152d2e6f5547",
  measurementId: "G-8VGWQ63JZW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referencias UI
const screens = {
    login: document.getElementById('login-screen'),
    lobby: document.getElementById('lobby-screen'),
    seleccion: document.getElementById('seleccion-screen')
};
const torneoIdActual = "t_401580342"; 

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

// --- AUTENTICACIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        showScreen('lobby');
        document.getElementById('user-email-display').textContent = user.email.split('@')[0];
        cargarDatosTorneo();
    } else {
        showScreen('login');
    }
});

document.getElementById('btnRegister').addEventListener('click', async () => {
    try { await createUserWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value); } 
    catch (e) { document.getElementById('message').textContent = e.message; }
});

document.getElementById('btnLogin').addEventListener('click', async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value); } 
    catch (e) { document.getElementById('message').textContent = "Error al iniciar sesión."; }
});

document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));

// --- NAVEGACIÓN ---
document.getElementById('btnIrSeleccion').addEventListener('click', () => showScreen('seleccion'));
document.getElementById('btnVolverLobby').addEventListener('click', () => showScreen('lobby'));

// --- LÓGICA DEL SLIDER MATEMÁTICO ---
const slider = document.getElementById('betSlider');
const amountDisplay = document.getElementById('amountDisplay');
const rosterSizeDisplay = document.getElementById('rosterSizeDisplay');
const multiplierDisplay = document.getElementById('multiplierDisplay');

slider.addEventListener('input', (e) => {
    const amount = parseInt(e.target.value);
    amountDisplay.textContent = "$ " + amount.toLocaleString('es-CO') + " COP";
    
    const multiplier = amount / 4000;
    multiplierDisplay.textContent = multiplier.toFixed(1) + "x";

    let rosterSize = 1;
    if (amount >= 20000 && amount < 40000) rosterSize = 2;
    else if (amount >= 40000 && amount < 60000) rosterSize = 3;
    else if (amount >= 60000 && amount < 80000) rosterSize = 4;
    else if (amount >= 80000) rosterSize = 5;
    
    rosterSizeDisplay.textContent = rosterSize;
});

// --- INYECCIÓN Y CARGA DE DATOS ---
document.getElementById('btnSeedDb').addEventListener('click', async () => {
    try {
        await setDoc(doc(db, "tournaments", torneoIdActual), {
            name: "The Masters",
            course: "Augusta National",
            status: "ACTIVE",
            players: [
                { id: "p1", name: "Scottie Scheffler", tier: "A" },
                { id: "p2", name: "Rory McIlroy", tier: "A" },
                { id: "p3", name: "Max Homa", tier: "B" },
                { id: "p4", name: "Joaquin Niemann", tier: "C" }
            ]
        });
        alert("¡Base de datos inicializada! El torneo y los jugadores se han creado en Firestore.");
        cargarDatosTorneo(); 
    } catch (error) {
        console.error("Error creando DB", error);
    }
});

async function cargarDatosTorneo() {
    const docSnap = await getDoc(doc(db, "tournaments", torneoIdActual));
    if (docSnap.exists()) {
        document.getElementById('torneo-nombre').textContent = docSnap.data().name;
        document.getElementById('torneo-campo').textContent = docSnap.data().course;
        document.getElementById('btnSeedDb').style.display = 'none'; 
    }
}

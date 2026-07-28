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

// Estado Global de la App
const state = {
    torneoActual: null,
    montoSeleccionado: 20000,
    multiplicador: 5.0,
    cuposTotales: 2,
    jugadoresSeleccionados: [] 
};

const torneoIdActual = "t_401580342"; 

// Referencias UI
const screens = {
    login: document.getElementById('login-screen'),
    lobby: document.getElementById('lobby-screen'),
    seleccion: document.getElementById('seleccion-screen'),
    roster: document.getElementById('roster-screen'),
    checkout: document.getElementById('checkout-screen')
};

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

// --- NAVEGACIÓN BÁSICA ---
document.getElementById('btnIrSeleccion').addEventListener('click', () => showScreen('seleccion'));
document.getElementById('btnVolverLobby').addEventListener('click', () => showScreen('lobby'));
document.getElementById('btnVolverMonto').addEventListener('click', () => showScreen('seleccion'));
document.getElementById('btnVolverRoster').addEventListener('click', () => showScreen('roster'));


// --- LÓGICA DEL SLIDER MATEMÁTICO ---
const slider = document.getElementById('betSlider');
slider.addEventListener('input', (e) => {
    const amount = parseInt(e.target.value);
    state.montoSeleccionado = amount;
    
    document.getElementById('amountDisplay').textContent = "$ " + amount.toLocaleString('es-CO') + " COP";
    
    state.multiplicador = amount / 4000;
    document.getElementById('multiplierDisplay').textContent = state.multiplicador.toFixed(1) + "x";

    if (amount >= 20000 && amount < 40000) state.cuposTotales = 2;
    else if (amount >= 40000 && amount < 60000) state.cuposTotales = 3;
    else if (amount >= 60000 && amount < 80000) state.cuposTotales = 4;
    else if (amount >= 80000) state.cuposTotales = 5;
    else state.cuposTotales = 1;
    
    document.getElementById('rosterSizeDisplay').textContent = state.cuposTotales;
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
                { id: "p4", name: "Joaquin Niemann", tier: "C" },
                { id: "p5", name: "Tiger Woods", tier: "C" }
            ]
        });
        alert("¡Base de datos inicializada!");
        cargarDatosTorneo(); 
    } catch (error) { console.error("Error creando DB", error); }
});

async function cargarDatosTorneo() {
    const docSnap = await getDoc(doc(db, "tournaments", torneoIdActual));
    if (docSnap.exists()) {
        state.torneoActual = docSnap.data(); 
        document.getElementById('torneo-nombre').textContent = state.torneoActual.name;
        document.getElementById('chk-torneo').textContent = state.torneoActual.name;
        document.getElementById('btnSeedDb').style.display = 'none'; 
    }
}


// --- LÓGICA DE SELECCIÓN DE ROSTER ---
document.getElementById('btnSiguientePago').addEventListener('click', () => {
    state.jugadoresSeleccionados = []; 
    renderizarJugadores();
    actualizarEstadoBotonRoster();
    showScreen('roster');
});

function renderizarJugadores() {
    const listContainer = document.getElementById('player-list');
    listContainer.innerHTML = ''; 
    
    state.torneoActual.players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.dataset.id = player.id;
        
        div.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="player-tier">Cat ${player.tier}</span>
        `;
        
        div.addEventListener('click', () => {
            const index = state.jugadoresSeleccionados.findIndex(p => p.id === player.id);
            
            if (index > -1) {
                state.jugadoresSeleccionados.splice(index, 1);
                div.classList.remove('selected');
            } else {
                if (state.jugadoresSeleccionados.length < state.cuposTotales) {
                    state.jugadoresSeleccionados.push(player);
                    div.classList.add('selected');
                } else {
                    alert(`Solo puedes seleccionar ${state.cuposTotales} jugador(es) con este monto.`);
                }
            }
            actualizarEstadoBotonRoster();
        });
        
        listContainer.appendChild(div);
    });
}

function actualizarEstadoBotonRoster() {
    const faltantes = state.cuposTotales - state.jugadoresSeleccionados.length;
    document.getElementById('cupos-restantes').textContent = faltantes;
    
    const btn = document.getElementById('btnIrCheckout');
    btn.disabled = (faltantes !== 0);
}


// --- LÓGICA DE CHECKOUT ---
document.getElementById('btnIrCheckout').addEventListener('click', () => {
    document.getElementById('chk-monto').textContent = "$ " + state.montoSeleccionado.toLocaleString('es-CO') + " COP";
    document.getElementById('chk-multiplicador').textContent = state.multiplicador.toFixed(1) + "x";
    
    const equipoList = document.getElementById('chk-equipo');
    equipoList.innerHTML = '';
    
    state.jugadoresSeleccionados.forEach(player => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${player.name}</span> <span style="color:var(--texto-gris); font-size:12px;">Cat ${player.tier}</span>`;
        equipoList.appendChild(li);
    });
    
    showScreen('checkout');
});

document.getElementById('btnPagarBold').addEventListener('click', () => {
    alert(`Aquí conectaremos el API de Bold para procesar el cobro por $${state.montoSeleccionado.toLocaleString('es-CO')} COP`);
});

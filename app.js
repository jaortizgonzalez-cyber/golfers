import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// Estado Global
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
    checkout: document.getElementById('checkout-screen'),
    success: document.getElementById('success-screen')
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
        cargarMisApuestas(user.uid); // Cargar historial de apuestas
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
    catch (e) { document.getElementById('message').textContent = "Credenciales incorrectas."; }
});
document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));

// --- NAVEGACIÓN Y TABS ---
document.getElementById('btnIrSeleccion').addEventListener('click', () => showScreen('seleccion'));
document.getElementById('btnVolverLobby').addEventListener('click', () => showScreen('lobby'));
document.getElementById('btnVolverMonto').addEventListener('click', () => showScreen('seleccion'));
document.getElementById('btnVolverRoster').addEventListener('click', () => showScreen('roster'));
document.getElementById('btnVolverInicio').addEventListener('click', () => { 
    showScreen('lobby'); 
    switchTab('apuestas'); 
    cargarMisApuestas(auth.currentUser.uid); // Refrescar apuestas al volver
});

const tabs = ['torneos', 'apuestas', 'ranking'];
tabs.forEach(tab => {
    document.getElementById(`tab-${tab}`).addEventListener('click', () => switchTab(tab));
});

function switchTab(activeTab) {
    tabs.forEach(tab => {
        document.getElementById(`tab-${tab}`).classList.remove('active');
        document.getElementById(`content-${tab}`).classList.add('hidden');
    });
    document.getElementById(`tab-${activeTab}`).classList.add('active');
    document.getElementById(`content-${activeTab}`).classList.remove('hidden');
}

// --- LÓGICA DEL SLIDER ---
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

// --- INYECCIÓN Y CARGA DE TORNEO ---
document.getElementById('btnSeedDb').addEventListener('click', async () => {
    try {
        await setDoc(doc(db, "tournaments", torneoIdActual), {
            name: "The Masters", course: "Augusta National", status: "ACTIVE",
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

// --- CARGAR MIS APUESTAS DESDE FIRESTORE ---
async function cargarMisApuestas(userId) {
    const container = document.getElementById('mis-apuestas-list');
    container.innerHTML = '<p style="text-align:center; color:#6b7280; font-size:14px;">Cargando...</p>';
    
    try {
        // Consultar solo las apuestas del usuario actual
        const q = query(collection(db, "bets"), where("user_id", "==", userId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            container.innerHTML = `<div class="empty-state">No tienes apuestas registradas en este torneo.</div>`;
            return;
        }

        container.innerHTML = ''; // Limpiar
        querySnapshot.forEach((doc) => {
            const bet = doc.data();
            const jugadoresNombres = bet.roster.map(j => j.name).join(', ');
            
            // Crear la tarjeta visual del ticket
            const card = document.createElement('div');
            card.className = 'ticket-card';
            card.innerHTML = `
                <div class="ticket-card-header">
                    <span>${bet.tournament_name}</span>
                    <span style="color:var(--verde-fairway)">$${bet.amount_cop.toLocaleString('es-CO')}</span>
                </div>
                <div class="ticket-card-body">
                    <p style="margin:0 0 8px 0;"><strong>Multiplicador:</strong> ${bet.multiplier}x</p>
                    <p style="margin:0;"><strong>Equipo:</strong> ${jugadoresNombres}</p>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Error cargando apuestas: ", error);
        container.innerHTML = `<p style="color:red; font-size:13px;">Error al cargar las apuestas.</p>`;
    }
}

// --- SELECCIÓN DE ROSTER Y CHECKOUT ---
document.getElementById('btnSiguientePago').addEventListener('click', () => {
    state.jugadoresSeleccionados = []; renderizarJugadores(); actualizarEstadoBotonRoster(); showScreen('roster');
});

function renderizarJugadores() {
    const listContainer = document.getElementById('player-list');
    listContainer.innerHTML = ''; 
    state.torneoActual.players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = `<span class="player-name">${player.name}</span><span class="player-tier">Cat ${player.tier}</span>`;
        div.addEventListener('click', () => {
            const index = state.jugadoresSeleccionados.findIndex(p => p.id === player.id);
            if (index > -1) {
                state.jugadoresSeleccionados.splice(index, 1); div.classList.remove('selected');
            } else {
                if (state.jugadoresSeleccionados.length < state.cuposTotales) {
                    state.jugadoresSeleccionados.push(player); div.classList.add('selected');
                } else alert(`Solo puedes seleccionar ${state.cuposTotales} jugador(es).`);
            }
            actualizarEstadoBotonRoster();
        });
        listContainer.appendChild(div);
    });
}

function actualizarEstadoBotonRoster() {
    const faltantes = state.cuposTotales - state.jugadoresSeleccionados.length;
    document.getElementById('cupos-restantes').textContent = faltantes;
    document.getElementById('btnIrCheckout').disabled = (faltantes !== 0);
}

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

// PROCESAMIENTO
document.getElementById('btnPagarBold').addEventListener('click', async () => {
    const btn = document.getElementById('btnPagarBold');
    btn.innerHTML = '<span class="spinner"></span> Procesando...'; btn.disabled = true;

    try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const user = auth.currentUser;
        const docRef = await addDoc(collection(db, "bets"), {
            user_id: user.uid, user_email: user.email, tournament_id: torneoIdActual, tournament_name: state.torneoActual.name,
            amount_cop: state.montoSeleccionado, multiplier: state.multiplicador, roster: state.jugadoresSeleccionados,
            payment_status: "APPROVED", created_at: serverTimestamp()
        });
        document.getElementById('success-tx-id').textContent = docRef.id;
        showScreen('success');
    } catch (error) { alert("Error procesando pago."); } 
    finally { btn.innerHTML = 'Pagar con Bold <span>🔒</span>'; btn.disabled = false; }
});

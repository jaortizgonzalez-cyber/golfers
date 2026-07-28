import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const state = {
    torneoActual: null,
    montoSeleccionado: 20000,
    multiplicador: 5.0,
    cuposTotales: 2,
    jugadoresSeleccionados: [],
    editandoTicketId: null // Si tiene un ID, estamos editando en lugar de crear uno nuevo
};

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
        await cargarTorneoDesdeFirestore(); 
        cargarCatalogo(); 
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
document.getElementById('btnIrSeleccion').addEventListener('click', () => {
    state.editandoTicketId = null; // Modo Creación Normal
    showScreen('seleccion');
});
document.getElementById('btnVolverLobby').addEventListener('click', () => showScreen('lobby'));
document.getElementById('btnVolverMonto').addEventListener('click', () => showScreen('seleccion'));
document.getElementById('btnVolverRoster').addEventListener('click', () => showScreen('roster'));
document.getElementById('btnVolverInicio').addEventListener('click', () => { 
    showScreen('lobby'); switchTab('apuestas'); 
});

const tabs = ['torneos', 'apuestas', 'ranking', 'catalogo'];
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

    if (activeTab === 'apuestas' && auth.currentUser) cargarMisApuestas(auth.currentUser.uid);
    if (activeTab === 'ranking') cargarRanking();
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

// --- SINCRONIZACIÓN API ESPNS -> FIRESTORE (CON FECHA DE INICIO) ---
document.getElementById('btnSyncDb').addEventListener('click', async () => {
    const btn = document.getElementById('btnSyncDb');
    btn.textContent = "🔄 Sincronizando con ESPN...";
    btn.disabled = true;

    try {
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard');
        const data = await response.json();
        const event = data.events[0];
        
        const torneoData = {
            id: event.id,
            name: event.shortName || event.name,
            course: event.courses ? event.courses[0].name : "PGA Tour Course",
            startDate: event.date, // Fecha oficial de inicio para validar la regla de 1 hora
            status: "ACTIVE",
            updated_at: serverTimestamp(),
            players: []
        };

        const competitors = event.competitions[0].competitors;
        competitors.slice(0, 50).forEach((comp) => {
            let photoUrl = comp.athlete.headshot ? comp.athlete.headshot.href : 'https://a.espncdn.com/i/headshots/golf/players/full/default.png';
            torneoData.players.push({
                id: comp.athlete.id,
                name: comp.athlete.displayName,
                score: comp.score || "E",
                photo: photoUrl
            });
        });

        await setDoc(doc(db, "tournaments", torneoData.id), torneoData);
        state.torneoActual = torneoData;
        actualizarUIەTorneo();
        alert("¡Sincronización exitosa!");

    } catch (error) {
        console.error("Error sincronizando:", error);
        alert("Error al conectar con la API de ESPN.");
    } finally {
        btn.textContent = "🔄 Sincronizar Torneo y Guardar en BD";
        btn.disabled = false;
    }
});

async function cargarTorneoDesdeFirestore() {
    try {
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard');
        const data = await response.json();
        const eventId = data.events[0].id;

        const docRef = doc(db, "tournaments", eventId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            state.torneoActual = docSnap.data();
            actualizarUIەTorneo();
        } else {
            document.getElementById('torneo-nombre').textContent = "Torneo disponible para sincronizar";
            document.getElementById('torneo-campo').textContent = "Haz clic arriba para guardar en BD.";
        }
    } catch (e) {
        console.error("Error leyendo Firestore:", e);
    }
}

function actualizarUIەTorneo() {
    if (!state.torneoActual) return;
    document.getElementById('torneo-nombre').textContent = state.torneoActual.name;
    document.getElementById('torneo-campo').textContent = state.torneoActual.course;
    document.getElementById('chk-torneo').textContent = state.torneoActual.name;
    
    if (state.torneoActual.startDate) {
        const fechaInicio = new Date(state.torneoActual.startDate);
        document.getElementById('torneo-inicio').textContent = "⏱️ Inicia: " + fechaInicio.toLocaleString();
    }
    document.getElementById('btnIrSeleccion').disabled = false;
}

// --- CARGAR MIS APUESTAS CON VALIDACIÓN DE 1 HORA ---
async function cargarMisApuestas(userId) {
    const container = document.getElementById('mis-apuestas-list');
    container.innerHTML = '<div class="text-center"><span class="spinner" style="border-top-color:var(--verde-fairway)"></span></div>';
    
    try {
        const q = query(collection(db, "bets"), where("user_id", "==", userId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            container.innerHTML = `<div class="empty-state">No tienes apuestas registradas.</div>`;
            return;
        }

        // Validar si estamos a menos de 1 hora del inicio del torneo
        let sePuedeModificar = true;
        if (state.torneoActual && state.torneoActual.startDate) {
            const horaInicioTorneo = new Date(state.torneoActual.startDate).getTime();
            const ahora = new Date().getTime();
            const diferenciaMinutos = (horaInicioTorneo - ahora) / (1000 * 60);
            
            if (diferenciaMinutos < 60) {
                sePuedeModificar = false; // Menos de 1 hora o ya comenzó
            }
        }

        container.innerHTML = ''; 
        querySnapshot.forEach((docSnap) => {
            const betId = docSnap.id;
            const bet = docSnap.data();
            const jugadoresNombres = bet.roster.map(j => j.name).join(', ');
            
            const card = document.createElement('div');
            card.className = 'ticket-card';
            
            let botonEditarHtml = '';
            if (sePuedeModificar) {
                botonEditarHtml = `<button class="btn-outline btn-small btn-editar" data-id="${betId}">Modificar Equipo</button>`;
            } else {
                botonEditarHtml = `<span style="font-size:11px; color:#ef4444; font-weight:600;">🔒 Edición bloqueada (< 1h para inicio)</span>`;
            }

            card.innerHTML = `
                <div class="ticket-card-header">
                    <span>${bet.tournament_name}</span>
                    <span style="color:var(--verde-fairway)">$${bet.amount_cop.toLocaleString('es-CO')}</span>
                </div>
                <div class="ticket-card-body">
                    <p style="margin:0 0 4px 0;"><strong>Multiplicador:</strong> ${bet.multiplier}x</p>
                    <p style="margin:0 0 10px 0;"><strong>Equipo:</strong> ${jugadoresNombres}</p>
                    ${botonEditarHtml}
                </div>
            `;
            container.appendChild(card);
        });

        // Event listener para los botones de modificar
        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const ticketId = e.target.dataset.id;
                await iniciarEdicionTicket(ticketId);
            });
        });

    } catch (error) { 
        console.error(error);
        container.innerHTML = `<p style="color:red; font-size:13px;">Error al cargar las apuestas.</p>`; 
    }
}

// Cargar datos del ticket a editar
async function iniciarEdicionTicket(ticketId) {
    const docRef = doc(db, "bets", ticketId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const betData = docSnap.data();
        state.editandoTicketId = ticketId;
        state.montoSeleccionado = betData.amount_cop;
        state.multiplicador = betData.multiplier;
        
        // Calcular cupos basados en el monto guardado
        if (betData.amount_cop >= 20000 && betData.amount_cop < 40000) state.cuposTotales = 2;
        else if (betData.amount_cop >= 40000 && betData.amount_cop < 60000) state.cuposTotales = 3;
        else if (betData.amount_cop >= 60000 && betData.amount_cop < 80000) state.cuposTotales = 4;
        else if (betData.amount_cop >= 80000) state.cuposTotales = 5;
        else state.cuposTotales = 1;

        // Precargar los jugadores que ya tenía seleccionados
        state.jugadoresSeleccionados = [...betData.roster];

        // Cambiar textos y abrir pantalla de roster directamente
        document.getElementById('roster-title').textContent = "Modifica tu equipo";
        renderizarJugadores();
        actualizarEstadoBotonRoster();
        showScreen('roster');
    }
}

// --- LEADERBOARD ---
async function cargarRanking() {
    const container = document.getElementById('ranking-list');
    container.innerHTML = '<div class="text-center"><span class="spinner" style="border-top-color:var(--verde-fairway)"></span></div>';

    try {
        if(!state.torneoActual) {
            container.innerHTML = `<div class="empty-state">Sincroniza el torneo primero.</div>`;
            return;
        }
        const q = query(collection(db, "bets"), where("tournament_id", "==", state.torneoActual.id));
        const querySnapshot = await getDocs(q);

        let ranking = [];
        querySnapshot.forEach((doc) => {
            const bet = doc.data();
            let totalPoints = (Math.floor(Math.random() * 50) + 10) * bet.multiplier; 
            ranking.push({ user: bet.user_email.split('@')[0], team: bet.roster.map(p => p.name).join(', '), points: totalPoints, multiplier: bet.multiplier });
        });

        ranking.sort((a, b) => b.points - a.points);
        if (ranking.length === 0) {
            container.innerHTML = `<div class="empty-state">No hay apuestas registradas aún.</div>`;
            return;
        }

        container.innerHTML = '';
        ranking.forEach((entry, index) => {
            let position = index + 1;
            let medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : position;
            const div = document.createElement('div');
            div.className = 'ranking-item';
            div.innerHTML = `
                <div class="rank-position">${medal}</div>
                <div class="rank-info">
                    <div class="rank-name">${entry.user}</div>
                    <div class="rank-team">${entry.team}</div>
                </div>
                <div class="rank-points">
                    ${Math.round(entry.points).toLocaleString('es-CO')} pts
                    <div style="font-size:10px; color:var(--texto-gris); font-weight:normal;">Multip. ${entry.multiplier}x</div>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (error) { container.innerHTML = `<p style="color:red; font-size:13px;">Error al cargar la clasificación.</p>`; }
}

function cargarCatalogo() {
    const catalogo = [
        { id: 'r1', nombre: 'Guante de Golf Sintético', puntos: 2000, icono: '🧤' },
        { id: 'r2', nombre: 'Docena Pelotas (Callaway)', puntos: 5000, icono: '⛳' },
        { id: 'r3', nombre: 'Wedge Cleveland', puntos: 15000, icono: '🏌️' },
        { id: 'r4', nombre: 'Driver Callaway', puntos: 50000, icono: '🚀' }
    ];
    const container = document.getElementById('catalogo-list');
    container.innerHTML = '';
    catalogo.forEach(item => {
        const div = document.createElement('div');
        div.className = 'reward-card';
        div.innerHTML = `
            <div>
                <div class="reward-icon">${item.icono}</div>
                <div class="reward-name">${item.nombre}</div>
                <div class="reward-pts">${item.puntos.toLocaleString('es-CO')} pts</div>
            </div>
            <button class="btn-outline btn-small" onclick="alert('Redención en desarrollo')">Redimir</button>
        `;
        container.appendChild(div);
    });
}

// --- SELECCIÓN DE ROSTER ---
document.getElementById('btnSiguientePago').addEventListener('click', () => {
    state.jugadoresSeleccionados = []; 
    document.getElementById('roster-title').textContent = "Arma tu equipo";
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
        
        // Verificar si este jugador ya está seleccionado (útil al editar)
        const yaSeleccionado = state.jugadoresSeleccionados.some(p => p.id === player.id);
        if (yaSeleccionado) {
            div.classList.add('selected');
        }

        div.innerHTML = `
            <div class="player-info-container">
                <img src="${player.photo}" alt="${player.name}" class="player-photo">
                <div>
                    <span class="player-name">${player.name}</span>
                    <span class="player-score">Score: <strong>${player.score}</strong></span>
                </div>
            </div>
        `;
        
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
    
    // Cambiar texto del botón de pago si estamos editando
    const btnPagar = document.getElementById('btnPagarBold');
    if (state.editandoTicketId) {
        btnPagar.innerHTML = 'Guardar Cambios del Equipo <span>💾</span>';
    } else {
        btnPagar.innerHTML = 'Pagar con Bold <span>🔒</span>';
    }

    const equipoList = document.getElementById('chk-equipo');
    equipoList.innerHTML = '';
    state.jugadoresSeleccionados.forEach(player => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${player.name}</span>`;
        equipoList.appendChild(li);
    });
    showScreen('checkout');
});

// PROCESAMIENTO O ACTUALIZACIÓN EN FIRESTORE
document.getElementById('btnPagarBold').addEventListener('click', async () => {
    const btn = document.getElementById('btnPagarBold');
    btn.innerHTML = '<span class="spinner"></span> Procesando...'; btn.disabled = true;

    try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const user = auth.currentUser;
        
        if (state.editandoTicketId) {
            // Actualizar ticket existente
            const ticketRef = doc(db, "bets", state.editandoTicketId);
            await updateDoc(ticketRef, {
                roster: state.jugadoresSeleccionados,
                updated_at: serverTimestamp()
            });
            document.getElementById('success-tx-id').textContent = state.editandoTicketId + " (Actualizado)";
        } else {
            // Crear nuevo ticket
            const docRef = await addDoc(collection(db, "bets"), {
                user_id: user.uid, user_email: user.email, tournament_id: state.torneoActual.id, tournament_name: state.torneoActual.name,
                amount_cop: state.montoSeleccionado, multiplier: state.multiplicador, roster: state.jugadoresSeleccionados,
                payment_status: "APPROVED", created_at: serverTimestamp()
            });
            document.getElementById('success-tx-id').textContent = docRef.id;
        }

        showScreen('success');
    } catch (error) { 
        console.error(error);
        alert("Error procesando la solicitud."); 
    } 
    finally { 
        btn.disabled = false; 
    }
});

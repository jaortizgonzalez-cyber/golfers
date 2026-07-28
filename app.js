import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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

const ADMIN_EMAIL = "jaortizgonzalez@gmail.com"; 
let esModoRegistro = false;

const fechaActual = new Date();
let mesVisualizado = { ano: fechaActual.getFullYear(), mes: fechaActual.getMonth() }; 

const state = {
    torneoSeleccionado: null,
    montoSeleccionado: 20000,
    multiplicador: 5.0,
    cuposTotales: 2,
    jugadoresSeleccionados: []
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

function mostrarModal(titulo, mensaje, icono = "✨", callback = null) {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').textContent = titulo;
    document.getElementById('modal-message').textContent = mensaje;
    document.getElementById('modal-icon').textContent = icono;
    modal.classList.remove('hidden');
    
    const btn = document.getElementById('modal-btn-action');
    const nuevoBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(nuevoBtn, btn);
    nuevoBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (callback) callback();
    });
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        showScreen('lobby');
        await cargarDatosPerfil(user);
        verificarPermisosAdmin(user.email);
        await cargarTorneosMensuales(); // API 1: Calendario
        cargarPremios(); 
    } else {
        showScreen('login');
    }
});

function verificarPermisosAdmin(email) {
    const navTabs = document.getElementById('main-nav-tabs');
    const tabAdminExistente = document.getElementById('tab-admin');
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        if (!tabAdminExistente) {
            const btnAdmin = document.createElement('button');
            btnAdmin.className = 'tab-btn';
            btnAdmin.id = 'tab-admin';
            btnAdmin.textContent = 'Admin';
            btnAdmin.addEventListener('click', () => switchTab('admin'));
            navTabs.appendChild(btnAdmin);
        }
    } else {
        if (tabAdminExistente) tabAdminExistente.remove();
    }
}

// --- AUTENTICACIÓN ---
document.getElementById('btnRegisterToggle').addEventListener('click', () => {
    esModoRegistro = !esModoRegistro;
    const regFields = document.getElementById('register-fields');
    const title = document.getElementById('auth-title');
    const btnLogin = document.getElementById('btnLogin');
    const btnRegToggle = document.getElementById('btnRegisterToggle');

    if (esModoRegistro) {
        regFields.classList.remove('hidden');
        title.textContent = "Nuevo Miembro";
        btnLogin.textContent = "Crear Cuenta";
        btnRegToggle.textContent = "← Ya tengo membresía";
    } else {
        regFields.classList.add('hidden');
        title.textContent = "Copa Fairway";
        btnLogin.textContent = "Acceder a la plataforma";
        btnRegToggle.textContent = "Registrar nuevo miembro";
    }
});

document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !password) return mostrarModal("Atención", "Ingresa tu correo y contraseña.", "⚠️");
    try {
        if (esModoRegistro) {
            const nombre = document.getElementById('reg-nombre').value.trim();
            const apellido = document.getElementById('reg-apellido').value.trim();
            if (!nombre || !apellido) return mostrarModal("Atención", "Debes ingresar tu nombre y apellidos.", "⚠️");
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "users", cred.user.uid), { nombre, apellido, email, created_at: serverTimestamp() });
            mostrarModal("¡Bienvenido!", "Membresía creada exitosamente.", "⛳");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (e) {
        mostrarModal("Error", "Verifica tus credenciales.", "❌");
    }
});

document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));

async function cargarDatosPerfil(user) {
    try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        let nombreCompleto = user.email.split('@')[0];
        if (docSnap.exists()) {
            const data = docSnap.data();
            nombreCompleto = `${data.nombre || ''} ${data.apellido || ''}`.trim() || nombreCompleto;
            document.getElementById('profile-nombre').value = data.nombre || '';
            document.getElementById('profile-apellido').value = data.apellido || '';
        }
        document.getElementById('user-name-display').textContent = nombreCompleto;
        document.getElementById('profile-email').value = user.email;
    } catch (e) { console.error(e); }
}

document.getElementById('btnGuardarPerfil').addEventListener('click', async () => {
    const user = auth.currentUser;
    const nombre = document.getElementById('profile-nombre').value.trim();
    const apellido = document.getElementById('profile-apellido').value.trim();
    if (!nombre || !apellido) return mostrarModal("Atención", "Los campos no pueden estar vacíos.", "⚠️");
    try {
        await setDoc(doc(db, "users", user.uid), { nombre, apellido, email: user.email, updated_at: serverTimestamp() }, { merge: true });
        document.getElementById('user-name-display').textContent = `${nombre} ${apellido}`;
        mostrarModal("Actualizado", "Tus datos han sido guardados.", "✨");
    } catch (e) {
        mostrarModal("Error", "No se pudo actualizar el perfil.", "❌");
    }
});

// --- NAVEGACIÓN ---
document.getElementById('btnVolverLobby').addEventListener('click', () => showScreen('lobby'));
document.getElementById('btnVolverMonto').addEventListener('click', () => showScreen('seleccion'));
document.getElementById('btnVolverRoster').addEventListener('click', () => showScreen('roster'));
document.getElementById('btnVolverInicio').addEventListener('click', () => { showScreen('lobby'); switchTab('apuestas'); });

const tabs = ['torneos', 'apuestas', 'ranking', 'perfil', 'reglas', 'catalogo', 'admin'];
tabs.forEach(tab => {
    const el = document.getElementById(`tab-${tab}`);
    if (el) el.addEventListener('click', () => switchTab(tab));
});

function switchTab(activeTab) {
    tabs.forEach(tab => {
        document.getElementById(`tab-${tab}`)?.classList.remove('active');
        document.getElementById(`content-${tab}`)?.classList.add('hidden');
    });
    document.getElementById(`tab-${activeTab}`)?.classList.add('active');
    document.getElementById(`content-${activeTab}`)?.classList.remove('hidden');

    if (activeTab === 'apuestas' && auth.currentUser) cargarMisApuestas(auth.currentUser.uid);
    if (activeTab === 'ranking') cargarRanking();
    if (activeTab === 'admin' && auth.currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) cargarPanelAdmin();
}

// --- SLIDER ---
document.getElementById('betSlider').addEventListener('input', (e) => {
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


// =====================================================================
// API 1: CALENDARIO ANUAL (onDays) - Solo lee fechas y nombres oficiales
// =====================================================================
const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

document.getElementById('btnMesAnterior').addEventListener('click', () => {
    mesVisualizado.mes--;
    if (mesVisualizado.mes < 0) { mesVisualizado.mes = 11; mesVisualizado.ano--; }
    cargarTorneosMensuales();
});

document.getElementById('btnMesSiguiente').addEventListener('click', () => {
    mesVisualizado.mes++;
    if (mesVisualizado.mes > 11) { mesVisualizado.mes = 0; mesVisualizado.ano++; }
    cargarTorneosMensuales();
});

async function cargarTorneosMensuales() {
    document.getElementById('mes-actual-display').textContent = `${nombresMeses[mesVisualizado.mes]} ${mesVisualizado.ano}`;
    const container = document.getElementById('calendario-mensual-list');
    container.innerHTML = '<div class="text-center"><span class="spinner" style="border-top-color:var(--verde-fairway)"></span></div>';

    try {
        const res = await fetch('https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/calendar/ondays?lang=en&region=us');
        const data = await res.json();
        const apiEvents = data.events || [];

        let torneosDelMes = [];
        apiEvents.forEach(ev => {
            if (ev.startDate) {
                const fecha = new Date(ev.startDate);
                if (fecha.getFullYear() === mesVisualizado.ano && fecha.getMonth() === mesVisualizado.mes) {
                    torneosDelMes.push({ 
                        id: ev.id, 
                        name: ev.label, // Nombre exacto (Ej: Corales Puntacana Championship)
                        startDate: ev.startDate 
                    });
                }
            }
        });

        if (torneosDelMes.length === 0) {
            container.innerHTML = `<div class="empty-state">No hay torneos programados para ${nombresMeses[mesVisualizado.mes]}.</div>`;
            return;
        }

        torneosDelMes.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        container.innerHTML = '';
        const ahora = new Date().getTime();

        torneosDelMes.forEach(torneo => {
            const fechaInicio = new Date(torneo.startDate);
            const horaInicioMs = fechaInicio.getTime();
            const esPasado = ahora > (horaInicioMs - 3600000); // Bloquea 1 hora antes

            const card = document.createElement('div');
            card.className = `tournament-box ${esPasado ? 'closed-tournament' : ''}`;
            
            card.innerHTML = `
                <div class="tournament-header">
                    <h3>${torneo.name}</h3>
                    <span class="badge ${esPasado ? 'badge-closed' : ''}">${esPasado ? 'FINALIZADO' : 'ABIERTO'}</span>
                </div>
                <span class="tournament-label">📅 Inicia: ${fechaInicio.toLocaleString()}</span>
                <button class="btn-outline btn-small btn-inscribir-torneo" data-id="${torneo.id}" data-name="${torneo.name}" ${esPasado ? 'disabled' : ''} style="width:100%; justify-content:center;">
                    ${esPasado ? 'Inscripciones Cerradas' : 'Seleccionar mi equipo'}
                </button>
            `;
            container.appendChild(card);
        });

        document.querySelectorAll('.btn-inscribir-torneo:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                state.torneoSeleccionado = { id: e.target.dataset.id, name: e.target.dataset.name };
                showScreen('seleccion');
            });
        });
    } catch (e) {
        container.innerHTML = `<p style="color:red; font-size:13px; text-align:center;">Error conectando con el circuito oficial.</p>`;
    }
}

// =====================================================================
// API 2: LEADERBOARD - Trae el detalle y jugadores del torneo de la semana
// =====================================================================
document.getElementById('btnSiguientePago').addEventListener('click', () => {
    state.jugadoresSeleccionados = []; 
    document.getElementById('roster-title').textContent = `Selección para ${state.torneoSeleccionado.name}`;
    renderizarJugadores(); 
    actualizarEstadoBotonRoster(); 
    showScreen('roster');
});

async function renderizarJugadores() {
    const listContainer = document.getElementById('player-list');
    listContainer.innerHTML = '<div class="text-center"><span class="spinner" style="border-top-color:var(--verde-fairway)"></span><p style="font-size:12px; color:var(--texto-gris);">Cargando jugadores del torneo...</p></div>'; 

    let listaJugadores = [];
    try {
        const leadResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga');
        const leadData = await leadResponse.json();
        
        if (leadData.events && leadData.events[0]?.competitions[0]?.competitors) {
            leadData.events[0].competitions[0].competitors.forEach(comp => {
                let photoUrl = (comp.athlete && comp.athlete.headshot && comp.athlete.headshot.href) ? comp.athlete.headshot.href : '';
                listaJugadores.push({
                    id: comp.athlete.id,
                    name: comp.athlete.displayName,
                    score: typeof comp.score === 'object' ? (comp.score.displayValue || "E") : String(comp.score || "E"),
                    photo: photoUrl
                });
            });
        }
    } catch (e) {
        console.error("Error cargando el Leaderboard API:", e);
    }

    if (listaJugadores.length === 0) {
        listaJugadores = [
            { id: 'p1', name: 'Scottie Scheffler', score: '-12', photo: '' },
            { id: 'p2', name: 'Xander Schauffele', score: '-10', photo: '' },
            { id: 'p3', name: 'Rory McIlroy', score: '-8', photo: '' },
            { id: 'p4', name: 'Jon Rahm', score: '-7', photo: '' }
        ];
    }

    const jugadoresOrdenados = [...listaJugadores].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    listContainer.innerHTML = '';

    jugadoresOrdenados.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        
        const yaSeleccionado = state.jugadoresSeleccionados.some(p => p.id === player.id);
        if (yaSeleccionado) div.classList.add('selected');

        // Avatar UI en caso de 404
        let avatarUrl = player.photo;
        let avatarRespaldo = `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=2b563c&color=fff&rounded=true&bold=true`;
        if (!avatarUrl || avatarUrl.includes('default.png')) avatarUrl = avatarRespaldo;

        div.innerHTML = `
            <div class="player-info-container">
                <img src="${avatarUrl}" alt="${player.name}" class="player-photo" onerror="this.onerror=null; this.src='${avatarRespaldo}';">
                <div>
                    <span class="player-name">${player.name}</span>
                    <span class="player-score">Index / Score: <strong>${player.score}</strong></span>
                </div>
            </div>
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
                    mostrarModal("Límite", `Completaste tus ${state.cuposTotales} cupos.`, "⚠️");
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
    document.getElementById('btnIrCheckout').disabled = (faltantes !== 0);
}

document.getElementById('btnIrCheckout').addEventListener('click', () => {
    document.getElementById('chk-torneo').textContent = state.torneoSeleccionado.name;
    document.getElementById('chk-monto').textContent = "$ " + state.montoSeleccionado.toLocaleString('es-CO') + " COP";
    document.getElementById('chk-multiplicador').textContent = state.multiplicador.toFixed(1) + "x";
    
    const equipoList = document.getElementById('chk-equipo');
    equipoList.innerHTML = '';
    state.jugadoresSeleccionados.forEach(player => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${player.name}</span>`;
        equipoList.appendChild(li);
    });
    showScreen('checkout');
});

// --- LISTADOS, FIREBASE Y FLUJO DE COMPRA ---
async function cargarMisApuestas(userId) {
    const container = document.getElementById('mis-apuestas-list');
    container.innerHTML = '<div class="text-center"><span class="spinner" style="border-top-color:var(--verde-fairway)"></span></div>';
    
    try {
        const q = query(collection(db, "bets"), where("user_id", "==", userId));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return container.innerHTML = `<div class="empty-state">No tienes cuadros registrados.</div>`;
        
        container.innerHTML = ''; 
        querySnapshot.forEach((docSnap) => {
            const bet = docSnap.data();
            const card = document.createElement('div');
            card.className = 'ticket-card';
            card.innerHTML = `
                <div class="ticket-card-header">
                    <span>${bet.tournament_name}</span>
                    <span style="color:var(--verde-fairway)">$${bet.amount_cop.toLocaleString('es-CO')}</span>
                </div>
                <div class="ticket-card-body">
                    <p style="margin:0 0 4px 0;"><strong>Multiplicador:</strong> ${bet.multiplier}x</p>
                    <p style="margin:0 0 10px 0;"><strong>Selección:</strong> ${bet.roster.map(j => j.name).join(', ')}</p>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {}
}

async function cargarRanking() {
    const container = document.getElementById('ranking-list');
    container.innerHTML = '<div class="text-center"><span class="spinner" style="border-top-color:var(--verde-fairway)"></span></div>';

    try {
        if(!state.torneoSeleccionado) return container.innerHTML = `<div class="empty-state">Selecciona un torneo de la agenda para ver su Marcador.</div>`;

        const q = query(collection(db, "bets"), where("tournament_id", "==", state.torneoSeleccionado.id));
        const querySnapshot = await getDocs(q);
        let usuariosMap = {};

        querySnapshot.forEach((doc) => {
            const bet = doc.data();
            let totalPoints = Math.max(10, 50 * bet.multiplier); 
            if (!usuariosMap[bet.user_id] || totalPoints > usuariosMap[bet.user_id].points) {
                usuariosMap[bet.user_id] = {
                    user: bet.user_email.split('@')[0],
                    team: bet.roster.map(p => p.name).join(', '),
                    points: totalPoints,
                    multiplier: bet.multiplier
                };
            }
        });

        let ranking = Object.values(usuariosMap).sort((a, b) => b.points - a.points);
        if (ranking.length === 0) return container.innerHTML = `<div class="empty-state">No hay inscripciones registradas en este torneo.</div>`;

        container.innerHTML = '';
        ranking.forEach((entry, index) => {
            const div = document.createElement('div');
            div.className = 'ranking-item';
            div.innerHTML = `
                <div class="rank-position">${index + 1 === 1 ? '🥇' : index + 1}</div>
                <div class="rank-info">
                    <div class="rank-name">${entry.user}</div>
                    <div class="rank-team">${entry.team}</div>
                </div>
                <div class="rank-points">
                    ${Math.round(entry.points).toLocaleString('es-CO')} pts
                    <div style="font-size:10px; color:var(--texto-gris);">Multip. ${entry.multiplier}x</div>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (e) {}
}

function cargarPremios() {
    document.getElementById('catalogo-list').innerHTML = `
        <div class="reward-card">
            <div><div class="reward-icon">🧤</div><div class="reward-name">Guante de Golf Sintético</div><div class="reward-pts">2,000 pts</div></div>
        </div>
        <div class="reward-card">
            <div><div class="reward-icon">⛳</div><div class="reward-name">Docena Pelotas Callaway</div><div class="reward-pts">5,000 pts</div></div>
        </div>
    `;
}

document.getElementById('btnPagarBold').addEventListener('click', async () => {
    const btn = document.getElementById('btnPagarBold');
    btn.innerHTML = '<span class="spinner"></span> Procesando pago seguro...'; 
    btn.disabled = true;

    try {
        await new Promise(res => setTimeout(res, 1500));
        const user = auth.currentUser;
        const docRef = await addDoc(collection(db, "bets"), {
            user_id: user.uid, 
            user_email: user.email, 
            tournament_id: state.torneoSeleccionado.id, 
            tournament_name: state.torneoSeleccionado.name,
            amount_cop: state.montoSeleccionado, 
            multiplier: state.multiplicador, 
            roster: state.jugadoresSeleccionados,
            created_at: serverTimestamp()
        });
        document.getElementById('success-tx-id').textContent = docRef.id;
        showScreen('success');
    } catch (error) { 
        mostrarModal("Error", "No pudimos procesar tu solicitud de pago.", "❌");
    } finally { 
        btn.innerHTML = 'Confirmar Selección 🔒';
        btn.disabled = false; 
    }
});

async function cargarPanelAdmin() {
    const querySnapshot = await getDocs(query(collection(db, "bets")));
    let total = 0;
    querySnapshot.forEach(docSnap => total += (docSnap.data().amount_cop || 0));
    document.getElementById('admin-recaudo').textContent = "$ " + total.toLocaleString('es-CO') + " COP";
    document.getElementById('admin-utilidad').textContent = "$ " + Math.round(total * 0.2).toLocaleString('es-CO') + " COP";
    document.getElementById('admin-bolsa').textContent = "$ " + Math.round(total * 0.8).toLocaleString('es-CO') + " COP";
}

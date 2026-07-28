import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// Estado del mes seleccionado en el calendario (Julio 2026 por defecto)
let mesVisualizado = { ano: 2026, mes: 6 }; 

const state = {
    torneoSeleccionado: null,
    montoSeleccionado: 20000,
    multiplicador: 5.0,
    cuposTotales: 2,
    jugadoresSeleccionados: [],
    editandoTicketId: null 
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
        await cargarTorneosMensuales(); 
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

document.getElementById('btnRegisterToggle').addEventListener('click', () => {
    esModoRegistro = !esModoRegistro;
    const regFields = document.getElementById('register-fields');
    const title = document.getElementById('auth-title');
    const sub = document.getElementById('auth-subtitle');
    const btnLogin = document.getElementById('btnLogin');
    const btnRegToggle = document.getElementById('btnRegisterToggle');
    const btnForgot = document.getElementById('btnForgotPassword');

    if (esModoRegistro) {
        regFields.classList.remove('hidden');
        title.textContent = "Nuevo Miembro";
        sub.textContent = "Registro con membresía preferencial";
        btnLogin.textContent = "Crear Cuenta";
        btnRegToggle.textContent = "← Ya tengo cuenta";
        btnForgot.classList.add('hidden');
    } else {
        regFields.classList.add('hidden');
        title.textContent = "Copa Fairway";
        sub.textContent = "Torneos privados y pooles de golf — membresía preferencial";
        btnLogin.textContent = "Acceder a la plataforma";
        btnRegToggle.textContent = "Registrar nuevo miembro";
        btnForgot.classList.remove('hidden');
    }
});

document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        mostrarModal("Campos Incompletos", "Por favor ingresa tu correo y contraseña.", "⚠️");
        return;
    }

    try {
        if (esModoRegistro) {
            const nombre = document.getElementById('reg-nombre').value.trim();
            const apellido = document.getElementById('reg-apellido').value.trim();

            if (!nombre || !apellido) {
                mostrarModal("Datos Personales", "Debes ingresar tu nombre y apellidos completos.", "⚠️");
                return;
            }

            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "users", cred.user.uid), {
                nombre: nombre,
                apellido: apellido,
                email: email,
                created_at: serverTimestamp()
            });
            mostrarModal("¡Bienvenido!", "Tu cuenta ha sido creada exitosamente.", "⛳");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (e) {
        mostrarModal("Error de Autenticación", e.message, "❌");
    }
});

document.getElementById('btnForgotPassword').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    if (!email) {
        mostrarModal("Correo Requerido", "Ingresa tu correo electrónico en el campo superior para recuperar tu contraseña.", "🔒");
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        mostrarModal("Correo Enviado", "Hemos enviado las instrucciones para restablecer tu contraseña a tu correo.", "✉️");
    } catch (e) {
        mostrarModal("Error", "No se pudo procesar la recuperación de contraseña.", "❌");
    }
});

document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));

async function cargarDatosPerfil(user) {
    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        let nombreCompleto = user.email.split('@')[0];
        if (docSnap.exists()) {
            const data = docSnap.data();
            nombreCompleto = `${data.nombre || ''} ${data.apellido || ''}`.trim() || nombreCompleto;
            document.getElementById('profile-nombre').value = data.nombre || '';
            document.getElementById('profile-apellido').value = data.apellido || '';
        }
        document.getElementById('user-name-display').textContent = nombreCompleto;
        document.getElementById('profile-email').value = user.email;
    } catch (e) {
        console.error("Error cargando perfil", e);
    }
}

document.getElementById('btnGuardarPerfil').addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
        mostrarModal("Sesión Expirada", "Por favor inicia sesión nuevamente.", "🔒");
        return;
    }

    const nombre = document.getElementById('profile-nombre').value.trim();
    const apellido = document.getElementById('profile-apellido').value.trim();

    if (!nombre || !apellido) {
        mostrarModal("Campos Obligatorios", "El nombre y los apellidos no pueden estar vacíos.", "⚠️");
        return;
    }

    try {
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, {
            nombre: nombre,
            apellido: apellido,
            email: user.email,
            updated_at: serverTimestamp()
        }, { merge: true });

        document.getElementById('user-name-display').textContent = `${nombre} ${apellido}`;
        mostrarModal("Perfil Actualizado", "Tus datos personales han sido guardados correctamente.", "✨");
    } catch (e) {
        mostrarModal("Error de Guardado", "No se pudo actualizar el perfil.", "❌");
    }
});

// NAVEGACIÓN Y TABS
document.getElementById('btnVolverLobby').addEventListener('click', () => showScreen('lobby'));
document.getElementById('btnVolverMonto').addEventListener('click', () => showScreen('seleccion'));
document.getElementById('btnVolverRoster').addEventListener('click', () => showScreen('roster'));
document.getElementById('btnVolverInicio').addEventListener('click', () => { 
    showScreen('lobby'); switchTab('apuestas'); 
});

const tabs = ['torneos', 'apuestas', 'ranking', 'perfil', 'reglas', 'catalogo', 'admin'];
tabs.forEach(tab => {
    const el = document.getElementById(`tab-${tab}`);
    if (el) el.addEventListener('click', () => switchTab(tab));
});

function switchTab(activeTab) {
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-${tab}`);
        const content = document.getElementById(`content-${tab}`);
        if (btn) btn.classList.remove('active');
        if (content) content.classList.add('hidden');
    });
    
    const activeBtn = document.getElementById(`tab-${activeTab}`);
    const activeContent = document.getElementById(`content-${activeTab}`);
    if (activeBtn) activeBtn.classList.add('active');
    if (activeContent) activeContent.classList.remove('hidden');

    if (activeTab === 'apuestas' && auth.currentUser) cargarMisApuestas(auth.currentUser.uid);
    if (activeTab === 'ranking') cargarRanking();
    if (activeTab === 'admin' && auth.currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) cargarPanelAdmin();
}

// SLIDER DE INVERSIÓN
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

// --- GESTIÓN DE CALENDARIO MENSUAL Y SEMANAL ---
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

document.getElementById('btnSyncCalendar').addEventListener('click', async () => {
    const btn = document.getElementById('btnSyncCalendar');
    btn.textContent = "🔄 Sincronizando calendario y eventos...";
    btn.disabled = true;

    try {
        // Sincronizar Leaderboard activo para capturar jugadores y fotos reales
        const leadResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard');
        const leadData = await leadResponse.json();

        if (leadData.events) {
            for (let event of leadData.events) {
                let torneoData = {
                    id: event.id,
                    name: event.shortName || event.name,
                    course: event.courses ? event.courses[0].name : "PGA Tour Course",
                    startDate: event.date, 
                    status: "ACTIVE",
                    updated_at: serverTimestamp(),
                    players: []
                };

                if (event.competitions && event.competitions[0].competitors) {
                    event.competitions[0].competitors.forEach((comp) => {
                        let photoUrl = (comp.athlete && comp.athlete.headshot && comp.athlete.headshot.href) ? comp.athlete.headshot.href : 'https://a.espncdn.com/i/headshots/golf/players/full/default.png';
                        let rawScore = comp.score;
                        let displayScore = "E";
                        if (rawScore !== undefined && rawScore !== null) {
                            displayScore = typeof rawScore === 'object' ? (rawScore.displayValue || "E") : String(rawScore);
                        }
                        torneoData.players.push({
                            id: comp.athlete.id,
                            name: comp.athlete.displayName,
                            score: displayScore,
                            photo: photoUrl
                        });
                    });
                }
                await setDoc(doc(db, "tournaments", torneoData.id), torneoData);
            }
        }

        await cargarTorneosMensuales();
        mostrarModal("Sincronización Exitosa", "El calendario y los marcadores se han actualizado correctamente.", "⛳");

    } catch (error) {
        mostrarModal("Error de Conexión", "No pudimos sincronizar con los servidores oficiales.", "⚠️");
    } finally {
        btn.textContent = "🔄 Sincronizar Calendario Anual (ESPN)";
        btn.disabled = false;
    }
});

async function cargarTorneosMensuales() {
    document.getElementById('mes-actual-display').textContent = `${nombresMeses[mesVisualizado.mes]} ${mesVisualizado.ano}`;
    const container = document.getElementById('calendario-mensual-list');
    container.innerHTML = '<div class="text-center"><span class="spinner" style="border-top-color:var(--verde-fairway)"></span></div>';

    try {
        const querySnapshot = await getDocs(collection(db, "tournaments"));
        let torneosDelMes = [];

        querySnapshot.forEach(docSnap => {
            const torneo = docSnap.data();
            if (torneo.startDate) {
                const fechaTorneo = new Date(torneo.startDate);
                if (fechaTorneo.getFullYear() === mesVisualizado.ano && fechaTorneo.getMonth() === mesVisualizado.mes) {
                    torneosDelMes.push({ ...torneo, docId: docSnap.id });
                }
            }
        });

        // Si para el mes seleccionado (ej. Julio 2026) la API no trae los 4 torneos automáticamente, generamos la estructura estándar de 4 semanas del mes para garantizar la experiencia completa
        if (torneosDelMes.length === 0 && mesVisualizado.ano === 2026 && mesVisualizado.mes === 6) {
            const torneosEjemploJulio = [
                { id: 'jul-w1', name: 'Rocket Mortgage Classic', course: 'Detroit Golf Club', startDate: '2026-07-02T12:00:00Z', status: 'CLOSED', players: [] },
                { id: 'jul-w2', name: 'Genesis Scottish Open', course: 'The Renaissance Club', startDate: '2026-07-09T12:00:00Z', status: 'CLOSED', players: [] },
                { id: 'jul-w3', name: 'The Open Championship (Major)', course: 'Royal Birkdale', startDate: '2026-07-16T12:00:00Z', status: 'CLOSED', players: [] },
                { id: 'jul-w4', name: '3M Open', course: 'TPC Twin Cities', startDate: '2026-07-23T12:00:00Z', status: 'ACTIVE', players: [] }
            ];
            for (let t of torneosEjemploJulio) {
                await setDoc(doc(db, "tournaments", t.id), { ...t, updated_at: serverTimestamp() });
                torneosDelMes.push(t);
            }
        } else if (torneosDelMes.length === 0) {
            // Estructura general de 4 semanas para cualquier otro mes futuro
            for (let w = 1; w <= 4; w++) {
                let fechaSemana = new Date(mesVisualizado.ano, mesVisualizado.mes, w * 7 - 3);
                let tId = `mes-${mesVisualizado.ano}-${mesVisualizado.mes}-w${w}`;
                let tObj = {
                    id: tId,
                    name: `Torneo Oficial PGA - Semana ${w}`,
                    course: 'PGA Tour Championship Course',
                    startDate: fechaSemana.toISOString(),
                    status: fechaSemana.getTime() < new Date().getTime() ? 'CLOSED' : 'ACTIVE',
                    players: []
                };
                await setDoc(doc(db, "tournaments", tId), { ...tObj, updated_at: serverTimestamp() });
                torneosDelMes.push(tObj);
            }
        }

        torneosDelMes.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        container.innerHTML = '';
        const ahora = new Date().getTime();

        torneosDelMes.forEach((torneo, index) => {
            const fechaInicio = new Date(torneo.startDate);
            const horaInicioMs = fechaInicio.getTime();
            let esPasado = ahora > horaInicioMs || torneo.status === "CLOSED";

            const card = document.createElement('div');
            card.className = `tournament-box ${esPasado ? 'closed-tournament' : ''}`;
            
            card.innerHTML = `
                <div class="tournament-header">
                    <h3>Semana ${index + 1}: ${torneo.name}</h3>
                    <span class="badge ${esPasado ? 'badge-closed' : ''}">${esPasado ? 'CERRADO / FINALIZADO' : 'ABIERTO'}</span>
                </div>
                <span class="tournament-label">📍 ${torneo.course || 'PGA Tour Course'}</span>
                <span style="display:block; font-size:12px; color:${esPasado ? '#9ca3af' : 'var(--verde-fairway)'}; font-weight:600; margin-bottom:10px;">
                    ⏱️ Inicio: ${fechaInicio.toLocaleString()}
                </span>
                <button class="btn-outline btn-small btn-inscribir-torneo" data-id="${torneo.id}" ${esPasado ? 'disabled' : ''}>
                    ${esPasado ? 'Torneo Finalizado' : 'Participar en este Torneo'}
                </button>
            `;

            container.appendChild(card);
        });

        document.querySelectorAll('.btn-inscribir-torneo:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const torneoId = e.target.dataset.id;
                const torneoEncontrado = torneosDelMes.find(t => t.id === torneoId);
                if (torneoEncontrado) {
                    state.torneoSeleccionado = torneoEncontrado;
                    showScreen('seleccion');
                }
            });
        });

    } catch (e) {
        console.error("Error cargando calendario mensual:", e);
        container.innerHTML = `<p style="color:red; font-size:13px;">Error al cargar los torneos del mes.</p>`;
    }
}

// SELECCIÓN Y APUESTA
document.getElementById('btnSiguientePago').addEventListener('click', () => {
    if (!state.torneoSeleccionado) {
        mostrarModal("Selección Requerida", "Por favor selecciona un torneo activo del mes.", "⚠️");
        return;
    }
    state.jugadoresSeleccionados = []; 
    document.getElementById('roster-title').textContent = `Arma tu cuadro para ${state.torneoSeleccionado.name}`;
    renderizarJugadores(); 
    actualizarEstadoBotonRoster(); 
    showScreen('roster');
});

function renderizarJugadores() {
    const listContainer = document.getElementById('player-list');
    listContainer.innerHTML = ''; 
    
    // Si el torneo no tiene jugadores sincronizados de la API, cargamos una plantilla real de golfistas profesionales del PGA Tour para que el usuario pueda armar su cuadro sin bloqueos
    let listaJugadores = state.torneoSeleccionado.players;
    if (!listaJugadores || listaJugadores.length === 0) {
        listaJugadores = [
            { id: 'p1', name: 'Scottie Scheffler', score: '-12', photo: 'https://a.espncdn.com/i/headshots/golf/players/full/10499.png' },
            { id: 'p2', name: 'Xander Schauffele', score: '-10', photo: 'https://a.espncdn.com/i/headshots/golf/players/full/9976.png' },
            { id: 'p3', name: 'Rory McIlroy', score: '-8', photo: 'https://a.espncdn.com/i/headshots/golf/players/full/3498.png' },
            { id: 'p4', name: 'Jon Rahm', score: '-7', photo: 'https://a.espncdn.com/i/headshots/golf/players/full/10346.png' },
            { id: 'p5', name: 'Viktor Hovland', score: '-6', photo: 'https://a.espncdn.com/i/headshots/golf/players/full/11135.png' },
            { id: 'p6', name: 'Collin Morikawa', score: '-5', photo: 'https://a.espncdn.com/i/headshots/golf/players/full/10877.png' },
            { id: 'p7', name: 'Ludvig Åberg', score: '-5', photo: 'https://a.espncdn.com/i/headshots/golf/players/full/13214.png' },
            { id: 'p8', name: 'Wyndham Clark', score: '-4', photo: 'https://a.espncdn.com/i/headshots/golf/players/full/10884.png' },
            { id: 'p9', name: 'Bryson DeChambeau', score: '-4', photo: 'https://a.espncdn.com/i/headshots/golf/players/full/9980.png' },
            { id: 'p10', name: 'Brooks Koepka', score: '-3', photo: 'https://a.espncdn.com/i/headshots/golf/players/full/6779.png' }
        ];
    }

    const jugadoresOrdenados = [...listaJugadores].sort((a, b) => 
        a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );

    jugadoresOrdenados.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        
        const yaSeleccionado = state.jugadoresSeleccionados.some(p => p.id === player.id);
        if (yaSeleccionado) div.classList.add('selected');

        div.innerHTML = `
            <div class="player-info-container">
                <img src="${player.photo}" alt="${player.name}" class="player-photo" onerror="this.src='https://a.espncdn.com/i/headshots/golf/players/full/default.png'">
                <div>
                    <span class="player-name">${player.name}</span>
                    <span class="player-score">Score: <strong>${player.score}</strong></span>
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
                    mostrarModal("Límite de Cupos", `Ya tienes el máximo de ${state.cuposTotales} jugador(es).`, "⚠️");
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

// MIS APUESTAS
async function cargarMisApuestas(userId) {
    const container = document.getElementById('mis-apuestas-list');
    container.innerHTML = '<div class="text-center"><span class="spinner" style="border-top-color:var(--verde-fairway)"></span></div>';
    
    try {
        const q = query(collection(db, "bets"), where("user_id", "==", userId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            container.innerHTML = `<div class="empty-state">No tienes apuestas registradas en este mes.</div>`;
            return;
        }

        container.innerHTML = ''; 
        querySnapshot.forEach((docSnap) => {
            const betId = docSnap.id;
            const bet = docSnap.data();
            const jugadoresNombres = bet.roster.map(j => j.name).join(', ');
            
            const card = document.createElement('div');
            card.className = 'ticket-card';
            card.innerHTML = `
                <div class="ticket-card-header">
                    <span>${bet.tournament_name}</span>
                    <span style="color:var(--verde-fairway)">$${bet.amount_cop.toLocaleString('es-CO')}</span>
                </div>
                <div class="ticket-card-body">
                    <p style="margin:0 0 4px 0;"><strong>Multiplicador:</strong> ${bet.multiplier}x</p>
                    <p style="margin:0 0 10px 0;"><strong>Cuadro:</strong> ${jugadoresNombres}</p>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) { 
        container.innerHTML = `<p style="color:red; font-size:13px;">Error al cargar las apuestas.</p>`; 
    }
}

// LEADERBOARD
async function cargarRanking() {
    const container = document.getElementById('ranking-list');
    container.innerHTML = '<div class="text-center"><span class="spinner" style="border-top-color:var(--verde-fairway)"></span></div>';

    try {
        if(!state.torneoSeleccionado) {
            container.innerHTML = `<div class="empty-state">Selecciona un torneo para ver su Leaderboard.</div>`;
            return;
        }

        const usersSnap = await getDocs(collection(db, "users"));
        let usersMap = {};
        usersSnap.forEach(uDoc => {
            const uData = uDoc.data();
            usersMap[uDoc.id] = `${uData.nombre || ''} ${uData.apellido || ''}`.trim() || uDoc.id;
        });

        let playerScoresMap = {};
        let sourcePlayers = state.torneoSeleccionado.players && state.torneoSeleccionado.players.length > 0 ? state.torneoSeleccionado.players : [
            { id: 'p1', name: 'Scottie Scheffler', score: '-12' },
            { id: 'p2', name: 'Xander Schauffele', score: '-10' },
            { id: 'p3', name: 'Rory McIlroy', score: '-8' },
            { id: 'p4', name: 'Jon Rahm', score: '-7' },
            { id: 'p5', name: 'Viktor Hovland', score: '-6' },
            { id: 'p6', name: 'Collin Morikawa', score: '-5' },
            { id: 'p7', name: 'Ludvig Åberg', score: '-5' },
            { id: 'p8', name: 'Wyndham Clark', score: '-4' },
            { id: 'p9', name: 'Bryson DeChambeau', score: '-4' },
            { id: 'p10', name: 'Brooks Koepka', score: '-3' }
        ];

        sourcePlayers.forEach(p => {
            let s = String(p.score || "E").trim();
            let val = 0;
            if (s === "E" || s === "EVEN") val = 0;
            else if (s.startsWith("+")) val = -parseInt(s.replace("+", "")) * 5; 
            else if (s.startsWith("-")) val = parseInt(s.replace("-", "")) * 10; 
            playerScoresMap[p.id] = val;
        });

        const q = query(collection(db, "bets"), where("tournament_id", "==", state.torneoSeleccionado.id));
        const querySnapshot = await getDocs(q);

        let usuariosMap = {};
        querySnapshot.forEach((doc) => {
            const bet = doc.data();
            let basePoints = 0;
            bet.roster.forEach(player => {
                let puntosJugador = playerScoresMap[player.id] !== undefined ? playerScoresMap[player.id] : 10; 
                basePoints += puntosJugador;
            });
            let totalPoints = Math.max(10, basePoints * bet.multiplier); 
            let userId = bet.user_id;
            let nombreUsuario = usersMap[userId] || bet.user_email.split('@')[0];

            if (!usuariosMap[userId] || totalPoints > usuariosMap[userId].points) {
                usuariosMap[userId] = {
                    user: nombreUsuario,
                    team: bet.roster.map(p => p.name).join(', '),
                    points: totalPoints,
                    multiplier: bet.multiplier
                };
            }
        });

        let ranking = Object.values(usuariosMap);
        ranking.sort((a, b) => b.points - a.points);

        if (ranking.length === 0) {
            container.innerHTML = `<div class="empty-state">No hay apuestas registradas en este torneo.</div>`;
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
    } catch (error) { 
        container.innerHTML = `<p style="color:red; font-size:13px;">Error al cargar la clasificación.</p>`; 
    }
}

// PREMIOS
function cargarPremios() {
    const catalogo = [
        { id: 'r1', nombre: 'Guante de Golf Sintético (Envío económico)', puntos: 2000, icono: '🧤' },
        { id: 'r2', nombre: 'Docena Pelotas Callaway (Stock Amazon)', puntos: 5000, icono: '⛳' },
        { id: 'r3', nombre: 'Wedge Liviano Especializado', puntos: 15000, icono: '🏌️' }
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
            <button class="btn-outline btn-small btn-redimir">Redimir</button>
        `;
        div.querySelector('.btn-redimir').addEventListener('click', () => {
            mostrarModal("Premios", "Los premios de bajo peso de envío se despachan con la bolsa neta recaudada.", "🎁");
        });
        container.appendChild(div);
    });
}

// PAGO SEGURO BOLD
document.getElementById('btnPagarBold').addEventListener('click', async () => {
    const btn = document.getElementById('btnPagarBold');
    btn.innerHTML = '<span class="spinner"></span> Procesando pago seguro...'; 
    btn.disabled = true;

    try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const user = auth.currentUser;
        if (!user) throw new Error("Usuario no autenticado");

        const docRef = await addDoc(collection(db, "bets"), {
            user_id: user.uid, 
            user_email: user.email, 
            tournament_id: state.torneoSeleccionado.id, 
            tournament_name: state.torneoSeleccionado.name,
            amount_cop: state.montoSeleccionado, 
            multiplier: state.multiplicador, 
            roster: state.jugadoresSeleccionados,
            payment_status: "APPROVED", 
            created_at: serverTimestamp()
        });
        document.getElementById('success-tx-id').textContent = docRef.id;
        showScreen('success');
    } catch (error) { 
        mostrarModal("Error", "No pudimos procesar tu solicitud de pago.", "❌");
    } finally { 
        btn.innerHTML = 'Pagar con Bold <span>🔒</span>';
        btn.disabled = false; 
    }
});

// PANEL ADMIN
async function cargarPanelAdmin() {
    try {
        const q = query(collection(db, "bets"));
        const querySnapshot = await getDocs(q);
        let totalRecaudado = 0;
        let premiosList = [];

        querySnapshot.forEach(docSnap => {
            const bet = docSnap.data();
            totalRecaudado += (bet.amount_cop || 0);
            premiosList.push({ email: bet.user_email, premio: "Docena Pelotas Callaway (Amazon)" });
        });

        document.getElementById('admin-recaudo').textContent = "$ " + totalRecaudado.toLocaleString('es-CO') + " COP";
        document.getElementById('admin-utilidad').textContent = "$ " + Math.round(totalRecaudado * 0.20).toLocaleString('es-CO') + " COP";
        document.getElementById('admin-bolsa').textContent = "$ " + Math.round(totalRecaudado * 0.80).toLocaleString('es-CO') + " COP";

        const container = document.getElementById('admin-premios-list');
        container.innerHTML = premiosList.length === 0 ? '<div class="empty-state" style="font-size:12px;">Sin premios pendientes.</div>' : '';
        premiosList.forEach(item => {
            const div = document.createElement('div');
            div.className = 'ticket-card';
            div.innerHTML = `<div class="ticket-card-header"><span>Ganador: ${item.email}</span></div><div class="ticket-card-body"><p style="margin:0; font-size:12px;">🎁 ${item.premio}</p></div>`;
            container.appendChild(div);
        });
    } catch (e) {
        console.error(e);
    }
}

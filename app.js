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

// 🔑 CORREO ELECTRÓNICO CONFIGURADO COMO ADMINISTRADOR DE LA APP
const ADMIN_EMAIL = "jaortizgonzalez@gmail.com"; 

let esModoRegistro = false;

const state = {
    torneoActual: null,
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

// --- SISTEMA DE POPUPS / MODALES WOW ---
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

// --- MENÚ HAMBURGUESA (móvil) ---
const hamburgerBtn = document.getElementById('btnHamburger');
const navTabsEl = document.getElementById('main-nav-tabs');
const mobileOverlay = document.getElementById('mobileMenuOverlay');

function openMobileMenu() {
    navTabsEl.classList.add('open');
    hamburgerBtn.classList.add('open');
    mobileOverlay.classList.add('visible');
}
function closeMobileMenu() {
    navTabsEl.classList.remove('open');
    hamburgerBtn.classList.remove('open');
    mobileOverlay.classList.remove('visible');
}
function toggleMobileMenu() {
    if (navTabsEl.classList.contains('open')) closeMobileMenu();
    else openMobileMenu();
}
hamburgerBtn?.addEventListener('click', toggleMobileMenu);
mobileOverlay?.addEventListener('click', closeMobileMenu);

// --- AUTENTICACIÓN Y PERFIL ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        showScreen('lobby');
        await cargarDatosPerfil(user);
        verificarPermisosAdmin(user.email);
        await cargarTorneoDesdeFirestore(); 
        cargarPremios(user.uid); 
    } else {
        showScreen('login');
    }
});

function verificarPermisosAdmin(email) {
    const tabAdminExistente = document.getElementById('tab-admin');
    
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        if (!tabAdminExistente) {
            const btnAdmin = document.createElement('button');
            btnAdmin.className = 'tab-btn';
            btnAdmin.id = 'tab-admin';
            btnAdmin.textContent = 'Admin';
            btnAdmin.addEventListener('click', () => { switchTab('admin'); closeMobileMenu(); });
            navTabContainerAdd(btnAdmin);
        }
    } else {
        if (tabAdminExistente) tabAdminExistente.remove();
    }
}

function navTabContainerAdd(el) {
    const navTabs = document.querySelector('.nav-tabs');
    navTabs.appendChild(el);
}

// Alternar entre Login y Registro
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
        sub.textContent = "Regístrate con tus datos personales";
        btnLogin.textContent = "Crear Cuenta";
        btnRegToggle.textContent = "← Ya tengo cuenta";
        btnForgot.classList.add('hidden');
    } else {
        regFields.classList.add('hidden');
        title.textContent = "Birdie";
        sub.textContent = "Elige tu estrategia. Juega. Diviértete. Gana.";
        btnLogin.textContent = "Entrar al grupo";
        btnRegToggle.textContent = "Crear cuenta nueva";
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

// --- NAVEGACIÓN Y TABS ---
document.getElementById('btnIrSeleccion').addEventListener('click', () => {
    state.editandoTicketId = null; 
    showScreen('seleccion');
});
document.getElementById('btnVolverLobby').addEventListener('click', () => showScreen('lobby'));
document.getElementById('btnVolverMonto').addEventListener('click', () => showScreen('seleccion'));
document.getElementById('btnVolverRoster').addEventListener('click', () => showScreen('roster'));
document.getElementById('btnVolverInicio').addEventListener('click', () => { 
    showScreen('lobby'); switchTab('apuestas'); 
});

const tabs = ['torneos', 'apuestas', 'ranking', 'perfil', 'reglas', 'catalogo', 'admin'];
tabs.forEach(tab => {
    const el = document.getElementById(`tab-${tab}`);
    if (el) el.addEventListener('click', () => { switchTab(tab); closeMobileMenu(); });
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
    if (activeTab === 'catalogo' && auth.currentUser) cargarPremios(auth.currentUser.uid);
    if (activeTab === 'admin' && auth.currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) cargarPanelAdmin();
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

// --- SINCRONIZACIÓN API ESPN -> FIRESTORE ---
document.getElementById('btnSyncDb')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnSyncDb');
    if (!btn) return;
    btn.textContent = "🔄 Sincronizando en vivo...";
    btn.disabled = true;

    try {
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard');
        const data = await response.json();
        const event = data.events[0];
        
        const torneoData = {
            id: event.id,
            name: event.shortName || event.name,
            course: event.courses ? event.courses[0].name : "PGA Tour Course",
            startDate: event.date, 
            status: "ACTIVE",
            updated_at: serverTimestamp(),
            players: []
        };

        const competitors = event.competitions[0].competitors;
        competitors.forEach((comp) => {
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

        await setDoc(doc(db, "tournaments", torneoData.id), torneoData);
        state.torneoActual = torneoData;
        actualizarUIەTorneo();
        mostrarModal("Sincronización Exitosa", "Los datos oficiales del torneo se han actualizado correctamente.", "⛳");

    } catch (error) {
        mostrarModal("Error de Conexión", "No pudimos sincronizar con los servidores oficiales.", "⚠️");
    } finally {
        btn.textContent = "🔄 Actualizar Torneo en Vivo";
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
            document.getElementById('torneo-campo').textContent = "Haz clic en actualizar para cargar datos.";
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
    
    let torneoCerrado = state.torneoActual.status === "CLOSED";
    if (state.torneoActual.startDate) {
        const fechaInicio = new Date(state.torneoActual.startDate);
        document.getElementById('torneo-inicio').textContent = "⏱️ Inicia: " + fechaInicio.toLocaleString();
        
        if (new Date().getTime() >= fechaInicio.getTime() || torneoCerrado) {
            torneoCerrado = true;
        }
    }

    const badge = document.getElementById('torneo-badge');
    const btnInscripcion = document.getElementById('btnIrSeleccion');

    if (torneoCerrado) {
        badge.textContent = "CERRADO / FINALIZADO";
        badge.className = "badge badge-closed";
        btnInscripcion.disabled = true;
        btnInscripcion.textContent = "Torneo Finalizado / No disponible";
    } else {
        badge.textContent = "ABIERTO";
        badge.className = "badge";
        btnInscripcion.disabled = false;
        btnInscripcion.textContent = "Elegir equipo e inscribirme";
    }
}

// --- CARGAR MIS APUESTAS ---
async function cargarMisApuestas(userId) {
    const container = document.getElementById('mis-apuestas-list');
    container.innerHTML = '<div class="text-center"><span class="spinner" style="border-top-color:var(--verde-fairway)"></span></div>';
    
    try {
        const q = query(collection(db, "bets"), where("user_id", "==", userId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            container.innerHTML = `<div class="empty-state">No tienes apuestas registradas en este torneo.</div>`;
            return;
        }

        let sePuedeModificar = true;
        if (state.torneoActual && (state.torneoActual.status === "CLOSED" || state.torneoActual.startDate)) {
            if (state.torneoActual.status === "CLOSED") sePuedeModificar = false;
            else {
                const horaInicioTorneo = new Date(state.torneoActual.startDate).getTime();
                const diferenciaMinutos = (horaInicioTorneo - new Date().getTime()) / (1000 * 60);
                if (diferenciaMinutos < 60) sePuedeModificar = false; 
            }
        }

        container.innerHTML = ''; 
        querySnapshot.forEach((docSnap) => {
            const betId = docSnap.id;
            const bet = docSnap.data();
            const jugadoresNombres = bet.roster.map(j => j.name).join(', ');
            
            const card = document.createElement('div');
            card.className = 'ticket-card';
            
            let botonEditarHtml = sePuedeModificar 
                ? `<button class="btn-outline btn-small btn-editar" data-id="${betId}">Modificar Equipo</button>`
                : `<span style="font-size:11px; color:var(--rojo-alerta); font-weight:600;">🔒 Edición bloqueada (< 1h o torneo cerrado)</span>`;

            const estadoPago = bet.payment_status === "APPROVED" ? "aprobado" : "pendiente";
            const estadoPagoLabel = bet.payment_status === "APPROVED" ? "Pago confirmado" : "Pago pendiente";

            card.innerHTML = `
                <div class="ticket-card-header">
                    <span>${bet.tournament_name}</span>
                    <span style="color:var(--verde-fairway)">$${bet.amount_cop.toLocaleString('es-CO')}</span>
                </div>
                <div class="ticket-card-body">
                    <p style="margin:0 0 6px 0;"><span class="payment-badge ${estadoPago}">${estadoPagoLabel}</span></p>
                    <p style="margin:0 0 4px 0;"><strong>Multiplicador:</strong> ${bet.multiplier}x</p>
                    <p style="margin:0 0 10px 0;"><strong>Equipo:</strong> ${jugadoresNombres}</p>
                    ${botonEditarHtml}
                </div>
            `;
            container.appendChild(card);
        });

        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                await iniciarEdicionTicket(e.target.dataset.id);
            });
        });

    } catch (error) { 
        container.innerHTML = `<p style="color:var(--rojo-alerta); font-size:13px;">Error al cargar las apuestas.</p>`; 
    }
}

async function iniciarEdicionTicket(ticketId) {
    if (state.torneoActual?.status === "CLOSED") {
        mostrarModal("Torneo Cerrado", "Este torneo ya ha finalizado, no se pueden modificar equipos.", "🔒");
        return;
    }
    const docRef = doc(db, "bets", ticketId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const betData = docSnap.data();
        state.editandoTicketId = ticketId;
        state.montoSeleccionado = betData.amount_cop;
        state.multiplicador = betData.multiplier;
        
        if (betData.amount_cop >= 20000 && betData.amount_cop < 40000) state.cuposTotales = 2;
        else if (betData.amount_cop >= 40000 && betData.amount_cop < 60000) state.cuposTotales = 3;
        else if (betData.amount_cop >= 60000 && betData.amount_cop < 80000) state.cuposTotales = 4;
        else if (betData.amount_cop >= 80000) state.cuposTotales = 5;
        else state.cuposTotales = 1;

        state.jugadoresSeleccionados = [...betData.roster];
        state.referenciaExistente = betData.payment_reference || '';

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
            container.innerHTML = `<div class="empty-state">Actualiza el torneo primero.</div>`;
            return;
        }

        const usersSnap = await getDocs(collection(db, "users"));
        let usersMap = {};
        usersSnap.forEach(uDoc => {
            const uData = uDoc.data();
            usersMap[uDoc.id] = `${uData.nombre || ''} ${uData.apellido || ''}`.trim() || uDoc.id;
        });

        let playerScoresMap = {};
        if (state.torneoActual.players) {
            state.torneoActual.players.forEach(p => {
                let s = String(p.score || "E").trim().toUpperCase();
                let val = 0;
                
                if (s === "E" || s === "EVEN" || s === "-" || s === "") {
                    val = 0;
                } else if (s.startsWith("+")) {
                    val = -(parseInt(s.replace(/\D/g, "")) || 0) * 5; 
                } else if (s.startsWith("-")) {
                    val = (parseInt(s.replace(/\D/g, "")) || 0) * 10; 
                } else {
                    let parsed = parseInt(s);
                    val = isNaN(parsed) ? 0 : parsed;
                }
                
                playerScoresMap[p.id] = val;
            });
        }

        const q = query(collection(db, "bets"), where("tournament_id", "==", state.torneoActual.id));
        const querySnapshot = await getDocs(q);

        let usuariosMap = {};

        querySnapshot.forEach((doc) => {
            const bet = doc.data();
            let basePoints = 0;

            bet.roster.forEach(player => {
                let puntosJugador = Number(playerScoresMap[player.id]);
                if (isNaN(puntosJugador)) puntosJugador = 0;
                basePoints += puntosJugador;
            });

            let totalPoints = Math.max(10, basePoints * bet.multiplier); 
            if (isNaN(totalPoints)) totalPoints = 10;

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
            container.innerHTML = `<div class="empty-state">No hay apuestas registradas aún para este torneo.</div>`;
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
        container.innerHTML = `<p style="color:var(--rojo-alerta); font-size:13px;">Error al cargar la clasificación.</p>`; 
    }
}

// --- PANEL DE ADMINISTRACIÓN FINANCIERA Y LOGÍSTICA ---
async function cargarPanelAdmin() {
    try {
        const q = query(collection(db, "bets"));
        const querySnapshot = await getDocs(q);

        let totalRecaudado = 0;
        let pagosPendientes = [];

        querySnapshot.forEach(docSnap => {
            const bet = docSnap.data();
            if (bet.payment_status === "APPROVED") {
                totalRecaudado += (bet.amount_cop || 0);
            } else {
                pagosPendientes.push({
                    id: docSnap.id,
                    email: bet.user_email,
                    torneo: bet.tournament_name,
                    monto: bet.amount_cop || 0,
                    referencia: bet.payment_reference || ''
                });
            }
        });

        let margenUtilidad = totalRecaudado * 0.20;
        let bolsaNeta = totalRecaudado * 0.80;

        document.getElementById('admin-recaudo').textContent = "$ " + totalRecaudado.toLocaleString('es-CO') + " COP";
        document.getElementById('admin-utilidad').textContent = "$ " + Math.round(margenUtilidad).toLocaleString('es-CO') + " COP";
        document.getElementById('admin-bolsa').textContent = "$ " + Math.round(bolsaNeta).toLocaleString('es-CO') + " COP";

        // --- Pagos pendientes de confirmar (dinero real que el admin debe verificar manualmente) ---
        const pendContainer = document.getElementById('admin-pagos-pendientes-list');
        if (pendContainer) {
            pendContainer.innerHTML = '';
            if (pagosPendientes.length === 0) {
                pendContainer.innerHTML = `<div class="empty-state" style="padding:15px; font-size:12px;">No hay pagos pendientes por confirmar.</div>`;
            } else {
                pagosPendientes.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'ticket-card';
                    const refHtml = item.referencia
                        ? `<p style="margin:0 0 8px 0; font-size:12px;"><strong>Referencia:</strong> ${item.referencia}</p>`
                        : `<p style="margin:0 0 8px 0; font-size:11.5px; color:var(--texto-gris);">Sin número de referencia — verifica por monto y nombre.</p>`;
                    div.innerHTML = `
                        <div class="ticket-card-header">
                            <span style="font-size:12px;">${item.email}</span>
                            <span style="color:var(--verde-fairway)">$${item.monto.toLocaleString('es-CO')}</span>
                        </div>
                        <div class="ticket-card-body">
                            <p style="margin:0 0 4px 0; font-size:12px;"><strong>Torneo:</strong> ${item.torneo}</p>
                            ${refHtml}
                            <button class="btn-outline btn-small btn-confirmar-pago" data-id="${item.id}">✔️ Confirmar pago recibido</button>
                        </div>
                    `;
                    pendContainer.appendChild(div);
                });

                document.querySelectorAll('.btn-confirmar-pago').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const betId = e.target.dataset.id;
                        try {
                            await updateDoc(doc(db, "bets", betId), {
                                payment_status: "APPROVED",
                                confirmed_at: serverTimestamp()
                            });
                            mostrarModal("Pago Confirmado", "El pago fue marcado como recibido.", "✅", () => cargarPanelAdmin());
                        } catch (err) {
                            mostrarModal("Error", "No se pudo confirmar el pago.", "❌");
                        }
                    });
                });
            }
        }

        // --- Premios reclamados: salud de la bolsa + gestión real ---
        const claimsSnap = await getDocs(collection(db, "claims"));
        const claims = [];
        claimsSnap.forEach(d => claims.push({ id: d.id, ...d.data() }));

        const claimsComprometidos = claims.filter(c => c.status !== "rechazado");
        const costoComprometido = claimsComprometidos.reduce((sum, c) => sum + (c.item_price || 0), 0);

        const saludBox = document.getElementById('admin-bolsa-salud');
        if (saludBox) {
            const pctUsado = bolsaNeta > 0 ? Math.min(150, Math.round((costoComprometido / bolsaNeta) * 100)) : (costoComprometido > 0 ? 150 : 0);
            let nivel = 'ok', mensaje = '✅ La bolsa de premios está sana.';
            if (pctUsado >= 100) { nivel = 'riesgo'; mensaje = '⚠️ ¡Alerta! Los premios comprometidos ya superan la bolsa neta disponible.'; }
            else if (pctUsado >= 70) { nivel = 'alerta'; mensaje = '🟡 Cuidado: te estás acercando al límite de la bolsa neta.'; }

            saludBox.innerHTML = `
                <div class="bolsa-salud-row"><span>Comprometido en premios</span><span>$${costoComprometido.toLocaleString('es-CO')}</span></div>
                <div class="bolsa-salud-row"><span>Bolsa neta disponible</span><span>$${Math.round(bolsaNeta).toLocaleString('es-CO')}</span></div>
                <div class="bolsa-salud-bar"><div class="bolsa-salud-fill ${nivel}" style="width:${Math.min(100, pctUsado)}%;"></div></div>
                <div class="bolsa-salud-msg" style="color:${nivel === 'riesgo' ? 'var(--rojo-alerta)' : (nivel === 'alerta' ? '#8a6d1a' : 'var(--verde-fairway)')};">${mensaje}</div>
            `;
        }

        const container = document.getElementById('admin-premios-list');
        container.innerHTML = '';

        const claimsPendientes = claims.filter(c => c.status === "pendiente");

        if (claimsPendientes.length === 0) {
            container.innerHTML = `<div class="empty-state" style="padding:15px; font-size:12px;">No hay premios pendientes de gestión.</div>`;
            return;
        }

        claimsPendientes.forEach(item => {
            const div = document.createElement('div');
            div.className = 'ticket-card';
            div.innerHTML = `
                <div class="ticket-card-header">
                    <span style="font-size:12px;">${item.user_email}</span>
                    <span style="color:var(--dorado); font-size:11px;">$${(item.item_price || 0).toLocaleString('es-CO')}</span>
                </div>
                <div class="ticket-card-body">
                    <p style="margin:0 0 10px 0; font-size:12px;">🎁 <strong>Premio:</strong> ${item.item_name}</p>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-outline btn-small btn-entregar-premio" data-id="${item.id}" style="flex:1;">✔️ Entregado</button>
                        <button class="btn-outline btn-small btn-rechazar-premio" data-id="${item.id}" style="flex:1; border-color:var(--rojo-alerta); color:var(--rojo-alerta);">✖️ Rechazar</button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });

        document.querySelectorAll('.btn-entregar-premio').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                try {
                    await updateDoc(doc(db, "claims", e.target.dataset.id), { status: "entregado", delivered_at: serverTimestamp() });
                    mostrarModal("Premio Entregado", "Se marcó como entregado.", "✅", () => cargarPanelAdmin());
                } catch (err) {
                    mostrarModal("Error", "No se pudo actualizar el reclamo.", "❌");
                }
            });
        });
        document.querySelectorAll('.btn-rechazar-premio').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                try {
                    await updateDoc(doc(db, "claims", e.target.dataset.id), { status: "rechazado", rejected_at: serverTimestamp() });
                    mostrarModal("Reclamo Rechazado", "Se marcó como rechazado y ya no cuenta contra tu bolsa neta.", "✖️", () => cargarPanelAdmin());
                } catch (err) {
                    mostrarModal("Error", "No se pudo actualizar el reclamo.", "❌");
                }
            });
        });

    } catch (e) {
        console.error("Error cargando panel admin:", e);
    }
}

document.getElementById('btnLiquidarTorneo')?.addEventListener('click', async () => {
    if (!state.torneoActual) return;
    try {
        const torneoRef = doc(db, "tournaments", state.torneoActual.id);
        await updateDoc(torneoRef, { status: "CLOSED", updated_at: serverTimestamp() });
        state.torneoActual.status = "CLOSED";
        actualizarUIەTorneo();
        mostrarModal("Torneo Liquidado", "El torneo ha sido cerrado exitosamente. Las inscripciones y modificaciones han quedado bloqueadas.", "🔒");
    } catch (e) {
        mostrarModal("Error", "No se pudo liquidar el torneo.", "❌");
    }
});

// --- CALCULAR PUNTOS REALES DEL USUARIO (solo apuestas con pago confirmado) ---
async function calcularMisPuntos(userId) {
    const q = query(collection(db, "bets"), where("user_id", "==", userId), where("payment_status", "==", "APPROVED"));
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const bets = [];
    const tournamentIds = new Set();
    snap.forEach(d => { bets.push(d.data()); tournamentIds.add(d.data().tournament_id); });

    const tournamentScoreMaps = {};
    for (const tId of tournamentIds) {
        if (!tId) continue;
        try {
            const tSnap = await getDoc(doc(db, "tournaments", tId));
            if (!tSnap.exists()) continue;
            const tData = tSnap.data();
            const map = {};
            (tData.players || []).forEach(p => {
                let s = String(p.score || "E").trim().toUpperCase();
                let val = 0;
                if (s === "E" || s === "EVEN" || s === "-" || s === "") val = 0;
                else if (s.startsWith("+")) val = -(parseInt(s.replace(/\D/g, "")) || 0) * 5;
                else if (s.startsWith("-")) val = (parseInt(s.replace(/\D/g, "")) || 0) * 10;
                else { let parsed = parseInt(s); val = isNaN(parsed) ? 0 : parsed; }
                map[p.id] = val;
            });
            tournamentScoreMaps[tId] = map;
        } catch (e) {
            console.error("Error leyendo torneo para puntos:", tId, e);
        }
    }

    let total = 0;
    bets.forEach(bet => {
        const map = tournamentScoreMaps[bet.tournament_id] || {};
        let basePoints = 0;
        (bet.roster || []).forEach(player => {
            let v = Number(map[player.id]);
            if (isNaN(v)) v = 0;
            basePoints += v;
        });
        let pts = Math.max(10, basePoints * (bet.multiplier || 1));
        if (isNaN(pts)) pts = 10;
        total += pts;
    });
    return Math.round(total);
}

// --- CARGAR PREMIOS (fotos y precios reales, puntos calculados automáticamente) ---
//
// ⚙️ TASA DE CAMBIO PUNTOS → PESOS: cuántos pesos de VALOR REAL del producto representa 1 punto.
// Súbelo si sientes que la gente gana premios demasiado fácil / te está costando plata.
// Bájalo si los premios quedan inalcanzables. Ajusta con datos reales de tus primeros torneos.
const PESOS_POR_PUNTO = 45;

// ⚙️ CATÁLOGO: pon aquí el precio REAL de mercado de cada producto (COP) y la URL de SU FOTO REAL
// (sube la foto a Firebase Storage o tu propio hosting — no uses fotos de otras tiendas sin permiso).
// Los puntos requeridos se calculan solos: precio_real / PESOS_POR_PUNTO. Así, si sube el precio del
// producto en el mercado, solo actualizas el número acá y el juego se re-balancea automáticamente.
const CATALOGO_PREMIOS = [
    {
        id: 'r1',
        nombre: 'Guante de Golf FootJoy WeatherSof',
        precio_real: 89000,
        imagen: 'PEGA_AQUI_URL_FOTO_GUANTE',
        tier: 'bronce',
        icono_respaldo: '🧤'
    },
    {
        id: 'r2',
        nombre: 'Docena Pelotas Callaway Chrome Soft',
        precio_real: 249000,
        imagen: 'PEGA_AQUI_URL_FOTO_PELOTAS',
        tier: 'plata',
        icono_respaldo: '⛳'
    },
    {
        id: 'r3',
        nombre: 'Wedge Cleveland RTX Especializado',
        precio_real: 780000,
        imagen: 'PEGA_AQUI_URL_FOTO_WEDGE',
        tier: 'oro',
        icono_respaldo: '🏌️'
    }
];

function puntosRequeridos(item) {
    return Math.ceil(item.precio_real / PESOS_POR_PUNTO);
}

async function cargarPremios(userId) {
    const puntosEl = document.getElementById('user-points');
    const fillEl = document.querySelector('#content-catalogo .progress-fill');
    const restanteEl = document.getElementById('user-points-remaining');

    if (puntosEl) puntosEl.textContent = 'Calculando...';
    if (restanteEl) restanteEl.textContent = 'Calculando...';

    let totalPuntos = 0;
    try {
        if (userId) {
            totalPuntos = await calcularMisPuntos(userId);
        }
    } catch (e) {
        console.error("cargarPremios: no se pudieron calcular los puntos, se muestra 0. Error real:", e);
        totalPuntos = 0;
    }

    if (puntosEl) puntosEl.textContent = totalPuntos.toLocaleString('es-CO') + " pts";

    const umbrales = CATALOGO_PREMIOS.map(puntosRequeridos);
    const maxUmbral = Math.max(...umbrales);
    const pct = Math.min(100, Math.round((totalPuntos / maxUmbral) * 100));
    if (fillEl) fillEl.style.width = pct + "%";

    const siguienteIdx = umbrales.findIndex(p => totalPuntos < p);
    if (restanteEl) {
        restanteEl.textContent = siguienteIdx > -1
            ? `Faltan ${(umbrales[siguienteIdx] - totalPuntos).toLocaleString('es-CO')} pts para tu próxima recompensa`
            : "¡Ya alcanzaste todos los premios disponibles!";
    }

    try {
        const container = document.getElementById('catalogo-list');
        container.innerHTML = '';

        // Consulta si el usuario ya reclamó cada premio, para no mostrar el botón dos veces
        let misClaims = [];
        try {
            const claimsSnap = await getDocs(query(collection(db, "claims"), where("user_id", "==", userId)));
            claimsSnap.forEach(d => misClaims.push(d.data()));
        } catch (e) {
            console.error("No se pudieron leer los reclamos previos:", e);
        }

        CATALOGO_PREMIOS.forEach(item => {
            const req = puntosRequeridos(item);
            const alcanzado = totalPuntos >= req;
            const yaReclamado = misClaims.some(c => c.item_id === item.id);
            const miniPct = Math.min(100, Math.round((totalPuntos / req) * 100));

            const div = document.createElement('div');
            div.className = 'reward-card';

            const tieneImagenValida = item.imagen && !item.imagen.startsWith('PEGA_AQUI');

            div.innerHTML = `
                <div class="reward-photo-wrap ${alcanzado ? '' : 'locked'}">
                    ${tieneImagenValida
                        ? `<img src="${item.imagen}" alt="${item.nombre}" onerror="this.style.display='none'; this.parentElement.querySelector('.reward-photo-fallback').style.display='flex';">`
                        : ''
                    }
                    <div class="reward-photo-fallback" style="${tieneImagenValida ? 'display:none;' : ''}">${item.icono_respaldo}</div>
                    <span class="reward-tier-badge ${item.tier}">${item.tier}</span>
                    ${!alcanzado ? `<span class="reward-lock-badge">🔒</span>` : ''}
                </div>
                <div class="reward-body">
                    <div class="reward-name">${item.nombre}</div>
                    <div class="reward-price-row">
                        <span class="reward-price-real">Valor real: $${item.precio_real.toLocaleString('es-CO')}</span>
                        <span class="reward-pts">${req.toLocaleString('es-CO')} pts</span>
                    </div>
                    <div class="reward-progress-mini"><div class="reward-progress-mini-fill" style="width:${miniPct}%;"></div></div>
                    <div class="reward-status-text ${alcanzado ? 'ready' : ''}">
                        ${yaReclamado ? '✅ Ya reclamado' : (alcanzado ? '¡Puedes reclamarlo!' : `Te faltan ${(req - totalPuntos).toLocaleString('es-CO')} pts`)}
                    </div>
                    <button class="btn-outline btn-small btn-redimir" ${(alcanzado && !yaReclamado) ? '' : 'disabled'}>
                        ${yaReclamado ? 'Reclamado' : 'Reclamar'}
                    </button>
                </div>
            `;

            div.querySelector('.btn-redimir').addEventListener('click', async () => {
                if (!alcanzado || yaReclamado) return;
                try {
                    const user = auth.currentUser;
                    await addDoc(collection(db, "claims"), {
                        user_id: user.uid,
                        user_email: user.email,
                        item_id: item.id,
                        item_name: item.nombre,
                        item_price: item.precio_real,
                        points_at_claim: totalPuntos,
                        status: "pendiente",
                        created_at: serverTimestamp()
                    });
                    mostrarModal("¡Premio Reclamado!", "Quedó registrado. Un administrador coordinará contigo la entrega.", "🎁", () => cargarPremios(userId));
                } catch (e) {
                    mostrarModal("Error", "No se pudo registrar el reclamo. Intenta de nuevo.", "❌");
                }
            });

            container.appendChild(div);
        });
    } catch (e) {
        console.error("cargarPremios: error renderizando el catálogo:", e);
    }
}

// --- SELECCIÓN DE ROSTER ---
document.getElementById('btnSiguientePago').addEventListener('click', () => {
    if (state.torneoActual?.status === "CLOSED") {
        mostrarModal("Torneo Cerrado", "Este torneo ya ha finalizado.", "🔒");
        return;
    }
    state.jugadoresSeleccionados = []; 
    document.getElementById('roster-title').textContent = "Arma tu equipo";
    renderizarJugadores(); 
    actualizarEstadoBotonRoster(); 
    showScreen('roster');
});

function renderizarJugadores() {
    const listContainer = document.getElementById('player-list');
    listContainer.innerHTML = ''; 
    
    if (!state.torneoActual || !state.torneoActual.players) return;

    const jugadoresOrdenados = [...state.torneoActual.players].sort((a, b) => 
        a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );

    jugadoresOrdenados.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        
        const yaSeleccionado = state.jugadoresSeleccionados.some(p => p.id === player.id);
        if (yaSeleccionado) {
            div.classList.add('selected');
        }

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
    document.getElementById('chk-monto').textContent = "$ " + state.montoSeleccionado.toLocaleString('es-CO') + " COP";
    document.getElementById('chk-multiplicador').textContent = state.multiplicador.toFixed(1) + "x";
    
    const btnPagar = document.getElementById('btnPagarBold');
    if (state.editandoTicketId) {
        btnPagar.innerHTML = 'Guardar Cambios del Equipo <span>💾</span>';
    } else {
        btnPagar.innerHTML = 'Confirmar inscripción <span>✔️</span>';
    }

    const equipoList = document.getElementById('chk-equipo');
    equipoList.innerHTML = '';
    state.jugadoresSeleccionados.forEach(player => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${player.name}</span>`;
        equipoList.appendChild(li);
    });
    document.getElementById('chk-referencia').value = state.editandoTicketId ? (state.referenciaExistente || '') : '';
    showScreen('checkout');
});

// PROCESAMIENTO: registro/edición queda PENDIENTE de confirmación manual del admin
document.getElementById('btnPagarBold').addEventListener('click', async () => {
    if (state.torneoActual?.status === "CLOSED") {
        mostrarModal("Torneo Cerrado", "No se pueden procesar apuestas en un torneo finalizado.", "🔒");
        return;
    }

    const btn = document.getElementById('btnPagarBold');
    btn.innerHTML = '<span class="spinner"></span> Guardando inscripción...'; 
    btn.disabled = true;

    try {
        await new Promise(resolve => setTimeout(resolve, 600));
        const user = auth.currentUser;
        
        if (!user) throw new Error("Usuario no autenticado");

        const referencia = document.getElementById('chk-referencia').value.trim();

        if (state.editandoTicketId) {
            const ticketRef = doc(db, "bets", state.editandoTicketId);
            await updateDoc(ticketRef, {
                roster: state.jugadoresSeleccionados,
                payment_reference: referencia,
                updated_at: serverTimestamp()
            });
            document.getElementById('success-tx-id').textContent = state.editandoTicketId + " (Actualizado)";
        } else {
            const docRef = await addDoc(collection(db, "bets"), {
                user_id: user.uid, 
                user_email: user.email, 
                tournament_id: state.torneoActual.id, 
                tournament_name: state.torneoActual.name,
                amount_cop: state.montoSeleccionado, 
                multiplier: state.multiplicador, 
                roster: state.jugadoresSeleccionados,
                payment_status: "PENDIENTE", 
                payment_reference: referencia,
                created_at: serverTimestamp()
            });
            document.getElementById('success-tx-id').textContent = docRef.id;
        }

        showScreen('success');
    } catch (error) { 
        mostrarModal("Error", "No pudimos guardar tu inscripción.", "❌");
    } 
    finally { 
        btn.innerHTML = state.editandoTicketId ? 'Guardar Cambios del Equipo <span>💾</span>' : 'Confirmar inscripción <span>✔️</span>';
        btn.disabled = false; 
    }
});

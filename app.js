import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
    // 🔧 FIX: mostrarModal() SIEMPRE resetea el modal a su estado "simple" (un solo botón,
    // texto por defecto "Entendido", sin la clase roja de peligro). Antes, si este modal se
    // abría justo después de una confirmación (mostrarConfirmacion), heredaba visualmente el
    // texto "Sí, eliminar" y el botón "Cancelar" que había quedado de esa confirmación anterior
    // — por eso, tras confirmar un borrado, el modal de éxito seguía mostrando "Sí, eliminar".
    nuevoBtn.textContent = "Entendido";
    nuevoBtn.classList.remove('btn-danger');
    btn.parentNode.replaceChild(nuevoBtn, btn);

    const btnCancel = document.getElementById('modal-btn-cancel');
    if (btnCancel) btnCancel.classList.add('hidden');
    
    nuevoBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (callback) callback();
    });
}

// --- CONFIRMACIÓN WOW (reemplaza el confirm() nativo del navegador) ---
// Reutiliza el mismo modal-card/overlay de mostrarModal(), agregando el botón "Cancelar"
// (oculto por defecto) para que las confirmaciones de acciones destructivas (eliminar, etc.)
// tengan la misma estética "WOW" del resto de la app, en vez del feo alert/confirm del navegador.
function mostrarConfirmacion(titulo, mensaje, onConfirm, icono = "⚠️") {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').textContent = titulo;
    document.getElementById('modal-message').textContent = mensaje;
    document.getElementById('modal-icon').textContent = icono;

    modal.classList.remove('hidden');

    const btnAction = document.getElementById('modal-btn-action');
    const nuevoBtnAction = btnAction.cloneNode(true);
    nuevoBtnAction.textContent = "Sí, eliminar";
    nuevoBtnAction.classList.add('btn-danger');
    btnAction.parentNode.replaceChild(nuevoBtnAction, btnAction);

    const btnCancel = document.getElementById('modal-btn-cancel');
    const nuevoBtnCancel = btnCancel.cloneNode(true);
    nuevoBtnCancel.classList.remove('hidden');
    btnCancel.parentNode.replaceChild(nuevoBtnCancel, btnCancel);

    nuevoBtnAction.addEventListener('click', () => {
        modal.classList.add('hidden');
        nuevoBtnAction.classList.remove('btn-danger');
        if (onConfirm) onConfirm();
    });

    nuevoBtnCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
        nuevoBtnAction.classList.remove('btn-danger');
        nuevoBtnCancel.classList.add('hidden');
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
        cargarCalendarioDelMes();
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
        title.textContent = "Elige tu estrategia. Juega. Diviértete. Gana.";
        sub.textContent = "Torneos de golf entre amigos — acceso exclusivo del grupo.";
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

    if (activeTab === 'torneos') cargarCalendarioDelMes();
    if (activeTab === 'apuestas' && auth.currentUser) cargarMisApuestas(auth.currentUser.uid);
    if (activeTab === 'ranking') cargarRanking();
    if (activeTab === 'catalogo' && auth.currentUser) cargarPremios(auth.currentUser.uid);
    if (activeTab === 'admin' && auth.currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        cargarPanelAdmin();
        cargarGestionPremiosAdmin();
    }
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
// --- Trae y parsea el leaderboard oficial de ESPN (se usa tanto para sincronizar en vivo
//     como para la liquidación final del torneo). Ahora también captura la POSICIÓN oficial
//     de cada jugador (no solo el score), necesaria para validar el Top 10 al liquidar. ---
async function fetchTorneoDesdeESPN() {
    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard');
    const data = await response.json();
    const event = data.events[0];
    const competition = event.competitions && event.competitions[0];
    const compStatus = competition && competition.status;

    // ⚡ OPTIMIZADO: las fechas/horarios OFICIALES del torneo vienen en el tramo EXCLUSIVO del
    // JSON dedicado a la competencia (event.competitions[0].status.type), ya formateados por ESPN
    // (ej: detail:"July 30 - August 2", shortDetail:"7/30 - 8/2"). NO hace falta recorrer el
    // arreglo de jugadores (competitors[].status.teeTime es información POR JUGADOR, no la fecha
    // oficial del torneo) — eso era innecesario y estaba mal optimizado.
    const rangoFechasTorneo = (compStatus && compStatus.type && (compStatus.type.detail || compStatus.type.shortDetail)) || null;

    const torneoData = {
        id: event.id,
        name: event.shortName || event.name,
        course: event.courses ? event.courses[0].name : "PGA Tour Course",
        // Marcador de fecha (día) del torneo, tal como lo entrega ESPN a nivel de competencia.
        startDate: event.date,
        // Texto oficial del rango de fechas del torneo, ya formateado por ESPN — no requiere
        // conversión manual de horas ni loops. Ej: "July 30 - August 2".
        rango_fechas: rangoFechasTorneo,
        status: "ACTIVE",
        // Estado REAL del torneo según ESPN: 'pre' (no ha empezado), 'in' (en vivo), 'post' (terminó).
        // Esto es lo que usamos para decidir si mostramos el punto verde de "en vivo" o no.
        estado_vivo: (compStatus && compStatus.type && compStatus.type.state) || 'pre',
        detalle_estado: rangoFechasTorneo,
        updated_at: serverTimestamp(),
        players: []
    };

    const competitors = competition.competitors;
    competitors.forEach((comp) => {
        let photoUrl = (comp.athlete && comp.athlete.headshot && comp.athlete.headshot.href) ? comp.athlete.headshot.href : null;

        let rawScore = comp.score;
        let displayScore = "E";
        if (rawScore !== undefined && rawScore !== null) {
            displayScore = typeof rawScore === 'object' ? (rawScore.displayValue || "E") : String(rawScore);
        }

        // Posición oficial (ranking real del torneo), no el score crudo.
        // Ej: position_id = 1, 2, 3... position_display = "1", "T5", "CUT", etc.
        const posId = comp.status && comp.status.position && comp.status.position.id
            ? parseInt(comp.status.position.id)
            : null;
        const posDisplay = (comp.status && comp.status.position && comp.status.position.displayName) || null;

        torneoData.players.push({
            id: comp.athlete.id,
            name: comp.athlete.displayName,
            score: displayScore,
            position_id: (posId && !isNaN(posId)) ? posId : null,
            position_display: posDisplay,
            photo: photoUrl
        });
    });

    return torneoData;
}

document.getElementById('btnSyncDb')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnSyncDb');
    if (!btn) return;
    btn.textContent = "🔄 Sincronizando en vivo...";
    btn.disabled = true;

    try {
        const torneoData = await fetchTorneoDesdeESPN();
        await setDoc(doc(db, "tournaments", torneoData.id), torneoData);
        state.torneoActual = torneoData;
        actualizarUIەTorneo();
        mostrarModal("Sincronización Exitosa", "Los datos oficiales del torneo se han actualizado correctamente. Esta actualización es solo INFORMATIVA/EN VIVO — todavía no reparte puntos.", "⛳");

    } catch (error) {
        mostrarModal("Error de Conexión", "No pudimos sincronizar con los servidores oficiales.", "⚠️");
    } finally {
        btn.textContent = "🔄 Actualizar Torneo en Vivo";
        btn.disabled = false;
    }
});

// =====================================================================
// --- CALENDARIO DE TORNEOS DEL MES ---
// Completamente separado del sync del "torneo en curso" de arriba.
// Esta API (sports.core.api.espn.com) solo nos da fechas y nombres del
// calendario del PGA Tour — NO tiene el detalle de jugadores/resultados,
// eso lo sigue trayendo únicamente fetchTorneoDesdeESPN() de arriba.
// =====================================================================
const URL_CALENDARIO_ESPN = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/calendar/ondays?lang=en&region=us';

async function fetchCalendarioDelMesESPN() {
    const response = await fetch(URL_CALENDARIO_ESPN);
    const data = await response.json();

    // Confirmado con datos reales de ESPN: el arreglo de torneos viene en "sections".
    let entradas = data.sections || data.calendar || data.entries || data.items || [];

    if (!Array.isArray(entradas) || entradas.length === 0) {
        console.error("fetchCalendarioDelMesESPN: no se encontró un arreglo de torneos en la respuesta. Respuesta cruda COMPLETA (cópiala toda):");
        console.error(JSON.stringify(data, null, 2));
        throw new Error("La respuesta de ESPN no tuvo el formato esperado (revisa la consola).");
    }

    const torneos = entradas.map(item => {
        const id = item.id || null;
        const nombre = item.label || item.name || item.shortName || "Torneo sin nombre";
        const detalle = item.detail || null; // ej: "Jan 22-25", útil como respaldo
        const inicio = item.startDate || null;
        const fin = item.endDate || null;
        return { id, nombre, detalle, inicio, fin };
    }).filter(t => t.inicio); // descartamos cualquier entrada sin fecha válida

    if (torneos.length === 0) {
        console.error("fetchCalendarioDelMesESPN: se encontraron entradas pero ninguna con fecha reconocible. Revisa esta muestra:", entradas.slice(0, 2));
        throw new Error("No se pudo leer la fecha de ningún torneo (revisa la consola).");
    }

    return torneos;
}

document.getElementById('btnSyncCalendario')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnSyncCalendario');
    if (!btn) return;
    const textoOriginal = btn.textContent;
    btn.textContent = "📅 Trayendo calendario...";
    btn.disabled = true;

    try {
        const torneos = await fetchCalendarioDelMesESPN();
        await setDoc(doc(db, "calendario", "mes_actual"), {
            torneos,
            updated_at: serverTimestamp()
        });
        await cargarCalendarioDelMes();
        mostrarModal("Calendario Actualizado", `Se trajeron ${torneos.length} torneo(s) del calendario oficial.`, "📅");
    } catch (e) {
        console.error("Error trayendo el calendario del mes:", e);
        mostrarModal(
            "No se pudo traer el calendario",
            "Revisa la consola (F12) para ver la respuesta cruda de ESPN y avísame — puede que necesite ajustar cómo leo esa API.",
            "⚠️"
        );
    } finally {
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
});

async function cargarCalendarioDelMes() {
    const container = document.getElementById('calendario-torneos-list');
    if (!container) return;

    try {
        const snap = await getDoc(doc(db, "calendario", "mes_actual"));
        if (!snap.exists() || !snap.data().torneos || snap.data().torneos.length === 0) {
            container.innerHTML = `<div class="empty-state" style="padding:14px; font-size:12px;">Todavía no se ha cargado el calendario del mes.</div>`;
            return;
        }

        const torneos = snap.data().torneos;
        const ahora = new Date();
        // Normalizamos a medianoche LOCAL para comparar por día calendario, no por hora exacta
        // (antes esto hacía que dijera "mañana" cuando en realidad faltaban 2 días).
        const hoySinHora = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

        const conFecha = torneos
            .map(t => ({ ...t, inicioDate: new Date(t.inicio) }))
            .filter(t => !isNaN(t.inicioDate))
            .sort((a, b) => a.inicioDate - b.inicioDate);

        // 🔧 AJUSTE: si el torneo ACTIVO (el de arriba, con el botón "Elegir equipo e
        // inscribirme") también aparece en el calendario del mes, lo excluimos de esta lista.
        // Antes se repetía dos veces en la misma pantalla — arriba decía "ABIERTO" y aquí abajo
        // "EMPIEZA MAÑANA", generando confusión sobre cuál tarjeta era la real para interactuar.
        // "Torneos del mes" ahora es puramente informativo: solo muestra OTROS torneos próximos
        // distintos al que ya está arriba. Comparamos por nombre (normalizado) ya que el ID de
        // esta API de calendario no coincide con el ID del torneo activo en ESPN.
        const nombreTorneoActivo = (state.torneoActual?.name || '').trim().toLowerCase();

        const proximos = conFecha.filter(t => {
            const inicioSinHora = new Date(t.inicioDate.getFullYear(), t.inicioDate.getMonth(), t.inicioDate.getDate());
            const esFuturo = inicioSinHora >= hoySinHora;
            const esElTorneoActivo = nombreTorneoActivo && (t.nombre || '').trim().toLowerCase() === nombreTorneoActivo;
            return esFuturo && !esElTorneoActivo;
        });

        if (proximos.length === 0) {
            container.innerHTML = `<div class="empty-state" style="padding:14px; font-size:12px;">No hay más torneos próximos en el calendario cargado.</div>`;
            return;
        }

        const calcularEtiqueta = (inicioDate) => {
            const inicioSinHora = new Date(inicioDate.getFullYear(), inicioDate.getMonth(), inicioDate.getDate());
            const diffDias = Math.round((inicioSinHora - hoySinHora) / (1000 * 60 * 60 * 24));
            if (diffDias <= 0) return "En curso / hoy";
            if (diffDias === 1) return "Empieza mañana";
            return `Empieza en ${diffDias} días`;
        };
        const fechaLarga = (t) => t.detalle || t.inicioDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

        const tarjetaTorneo = (t, destacado) => `
            <div class="ticket-card ${destacado ? 'torneo-destacado' : ''}" style="margin-bottom:10px;">
                <div class="ticket-card-header">
                    <span>${t.nombre}</span>
                    ${destacado ? `<span class="badge">${calcularEtiqueta(t.inicioDate)}</span>` : `<span style="font-size:11px; color:var(--texto-gris);">${calcularEtiqueta(t.inicioDate)}</span>`}
                </div>
                <div class="ticket-card-body">
                    <p style="margin:0; font-size:12px;">📅 ${fechaLarga(t)}</p>
                </div>
            </div>
        `;

        const masProximo = proximos[0];
        const mesDelProximo = masProximo.inicioDate.getMonth();
        const anioDelProximo = masProximo.inicioDate.getFullYear();

        const restoDelMes = proximos.slice(1).filter(t =>
            t.inicioDate.getMonth() === mesDelProximo && t.inicioDate.getFullYear() === anioDelProximo
        );
        const restoDelAnio = proximos.slice(1).filter(t =>
            !(t.inicioDate.getMonth() === mesDelProximo && t.inicioDate.getFullYear() === anioDelProximo)
        );

        let html = tarjetaTorneo(masProximo, true);

        if (restoDelMes.length > 0) {
            html += `<div style="font-size:11px; color:var(--texto-gris); text-transform:uppercase; letter-spacing:0.4px; margin:14px 0 8px;">Resto del mes</div>`;
            restoDelMes.forEach(t => { html += tarjetaTorneo(t, false); });
        }

        if (restoDelAnio.length > 0) {
            html += `
                <details class="rule-accordion" style="margin-top:10px;">
                    <summary><span class="rule-icon-mini">📆</span> Ver el resto del año (${restoDelAnio.length} torneos)</summary>
                    <div class="rule-body-content" style="padding-left:0;">
                        ${restoDelAnio.map(t => tarjetaTorneo(t, false)).join('')}
                    </div>
                </details>
            `;
        }

        container.innerHTML = html;
    } catch (e) {
        console.error("Error cargando calendario desde Firestore:", e);
        container.innerHTML = `<p style="color:var(--rojo-alerta); font-size:12px;">Error cargando el calendario.</p>`;
    }
}

async function cargarTorneoDesdeFirestore() {
    try {
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard');
        const data = await response.json();
        const event = data.events[0];
        const eventId = event.id;

        const docRef = doc(db, "tournaments", eventId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            state.torneoActual = docSnap.data();

            // 🔧 COMPATIBILIDAD: si el documento en Firestore es de una sincronización ANTERIOR
            // a este arreglo, no tendrá el campo 'rango_fechas'. Las reglas de seguridad de
            // Firestore (match /tournaments/{id} → allow write: if isAdmin()) NO permiten que un
            // usuario normal escriba/corrija ese documento — solo el admin puede hacerlo (con el
            // botón "Sincronizar"). Por eso aquí NUNCA se hace setDoc/write; simplemente se
            // calcula 'rango_fechas' EN MEMORIA (usando el mismo JSON de ESPN ya obtenido arriba)
            // para que la interfaz se vea correcta también para usuarios no-admin, sin necesidad
            // de permisos de escritura ni de tocar la base de datos.
            if (!state.torneoActual.rango_fechas) {
                const compStatus = event.competitions && event.competitions[0] && event.competitions[0].status;
                state.torneoActual.rango_fechas = (compStatus && compStatus.type && (compStatus.type.detail || compStatus.type.shortDetail)) || null;
            }

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

    // ⚡ OPTIMIZADO: usamos directamente el texto oficial del rango de fechas que ESPN ya trae
    // listo en el tramo del torneo/competencia ('rango_fechas', ej: "July 30 - August 2"). Nada
    // de convertir 'event.date' a hora local (ese campo es solo un marcador de día, no una hora
    // real, y por eso antes se veían horarios absurdos como "11:00 PM").
    if (state.torneoActual.rango_fechas) {
        document.getElementById('torneo-inicio').textContent = "📅 Fechas oficiales: " + state.torneoActual.rango_fechas;
    } else if (state.torneoActual.startDate) {
        // Respaldo por si ESPN no trajo el texto oficial (rango_fechas). Usamos timeZone:'UTC'
        // para leer el día TAL COMO lo entrega ESPN (ej. "2026-07-30T04:00Z" = 30 de julio).
        // 🐛 BUG CORREGIDO: antes se formateaba en la zona horaria LOCAL del navegador, lo cual
        // restaba horas y hacía que el día se recorriera un día atrás (ej. mostraba "29 de julio"
        // en vez de "30 de julio", y por eso parecía que el torneo empezaba "hoy" en vez de mañana).
        const fechaSoloDia = new Date(state.torneoActual.startDate);
        document.getElementById('torneo-inicio').textContent = "📅 Inicia: " + fechaSoloDia.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    } else {
        document.getElementById('torneo-inicio').textContent = "";
    }

    if (state.torneoActual.startDate) {
        const fechaInicio = new Date(state.torneoActual.startDate);
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

    // Indicador de EN VIVO real (no un punto rojo fijo): solo se enciende verde si
    // ESPN reporta el torneo como realmente en juego ('in'). Si todavía no arranca
    // ('pre') mostramos un estado neutral con la fecha; si ya terminó ('post'), otro.
    const dot = document.getElementById('torneo-live-dot');
    const label = document.getElementById('torneo-live-label');
    if (dot && label) {
        const estado = state.torneoActual.estado_vivo || 'pre';
        if (estado === 'in') {
            dot.className = 'live-dot';
            label.textContent = 'En vivo ahora';
            label.style.color = 'var(--verde-fairway)';
        } else if (estado === 'post') {
            dot.className = 'pending-dot';
            label.textContent = 'Terminado, pendiente de liquidar';
            label.style.color = 'var(--texto-gris)';
        } else {
            dot.className = 'pending-dot';
            // 🔧 AJUSTE: ya no repetimos aquí el rango de fechas del torneo (ej. "Comienza:
            // July 30 - August 2"), porque esa misma información ya se muestra justo debajo,
            // dentro de la tarjeta del torneo ("📅 Fechas oficiales: ..."). Repetirla dos veces
            // en la misma pantalla era redundante, así que este subtítulo ahora solo indica el
            // ESTADO (aún no comienza / en vivo / terminado), sin duplicar la fecha.
            label.textContent = 'Aún no comienza';
            label.style.color = 'var(--texto-gris)';
        }
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

            // 🗑️ Eliminar apuesta: solo se permite si el usuario aún puede modificar (mismo
            // límite de tiempo que "Modificar Equipo": antes de 1h del inicio y torneo no cerrado)
            // Y si el pago todavía NO ha sido confirmado por el admin. Una vez el pago está
            // "APPROVED" ya no se puede auto-eliminar desde aquí (para proteger la contabilidad);
            // en ese caso el usuario debe contactar al admin para gestionar el reembolso/baja.
            // ⚠️ IMPORTANTE: esto requiere que las reglas de Firestore permitan al dueño de la
            // apuesta borrar su propio documento mientras esté PENDIENTE (ver nota de reglas).
            // 🔧 FIX LAYOUT: el botón ya NO lleva margin-left inline (chocaba con el width:100%
            // global de <button>, causando que se viera corrido/desbordado). Ahora ambos botones
            // van dentro de un contenedor flex (.ticket-card-actions-row) que los reparte en fila
            // con flex:1 cada uno, de forma pareja y sin desbordes.
            const puedeEliminar = sePuedeModificar && bet.payment_status !== "APPROVED";
            let botonEliminarHtml = puedeEliminar
                ? `<button class="btn-outline btn-small btn-danger-outline btn-eliminar-apuesta" data-id="${betId}">🗑️ Eliminar</button>`
                : '';

            const estadoPago = bet.payment_status === "APPROVED" ? "aprobado" : "pendiente";
            const estadoPagoLabel = bet.payment_status === "APPROVED" ? "Pago confirmado" : "Pago pendiente";

            let estadoPuntosHtml;
            if (bet.payment_status !== "APPROVED") {
                estadoPuntosHtml = `<p style="margin:0 0 4px 0; font-size:12px; color:var(--texto-gris);">⏳ Puntos: se activan cuando se confirme tu pago.</p>`;
            } else if (bet.settled) {
                estadoPuntosHtml = `<p style="margin:0 0 4px 0; font-size:12px; color:var(--verde-fairway); font-weight:700;">🏆 Puntos oficiales: ${(bet.points || 0).toLocaleString('es-CO')} pts (torneo liquidado)</p>`;
            } else {
                estadoPuntosHtml = `<p style="margin:0 0 4px 0; font-size:12px; color:var(--texto-gris);">⏳ Torneo en curso — los puntos se asignan solo al liquidarse, validando el Top 10 oficial.</p>`;
            }

            card.innerHTML = `
                <div class="ticket-card-header">
                    <span>${bet.tournament_name}</span>
                    <span style="color:var(--verde-fairway)">$${bet.amount_cop.toLocaleString('es-CO')}</span>
                </div>
                <div class="ticket-card-body">
                    <p style="margin:0 0 6px 0;"><span class="payment-badge ${estadoPago}">${estadoPagoLabel}</span></p>
                    ${estadoPuntosHtml}
                    <p style="margin:0 0 4px 0;"><strong>Multiplicador:</strong> ${bet.multiplier}x</p>
                    <p style="margin:0 0 10px 0;"><strong>Equipo:</strong> ${jugadoresNombres}</p>
                    <div class="ticket-card-actions-row">${botonEditarHtml}${botonEliminarHtml}</div>
                </div>
            `;
            container.appendChild(card);
        });

        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                await iniciarEdicionTicket(e.target.dataset.id);
            });
        });

        // 🗑️ Eliminar apuesta (baja de participación). Requiere que las reglas de Firestore
        // permitan "allow delete" al dueño de la apuesta mientras payment_status == "PENDIENTE"
        // (ver nota de reglas más abajo) — de lo contrario Firestore rechazará el borrado con
        // "Missing or insufficient permissions", igual que ocurrió antes con /tournaments.
        // 🔧 FIX: se reemplazó el confirm() nativo del navegador (feo, genérico) por el modal
        // "WOW" propio de la app (mostrarConfirmacion), consistente con el resto de la interfaz.
        document.querySelectorAll('.btn-eliminar-apuesta').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const betId = e.target.dataset.id;
                mostrarConfirmacion(
                    "¿Eliminar esta apuesta?",
                    "Esta acción no se puede deshacer. Dejarás de participar con este equipo en el torneo.",
                    async () => {
                        btn.disabled = true;
                        btn.textContent = "Eliminando...";
                        try {
                            await deleteDoc(doc(db, "bets", betId));
                            mostrarModal("Apuesta Eliminada", "Tu apuesta fue eliminada correctamente. Ya no participas con este equipo.", "🗑️", () => cargarMisApuestas(userId));
                        } catch (error) {
                            console.error("Error eliminando apuesta:", error);
                            mostrarModal("Error al Eliminar", "No se pudo eliminar la apuesta. Es posible que las reglas de Firestore aún no permitan esta acción para tu usuario — contacta al administrador.", "⚠️");
                            btn.disabled = false;
                            btn.textContent = "🗑️ Eliminar";
                        }
                    },
                    "🗑️"
                );
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
        filtroJugadorActual = '';
        const searchInputEl = document.getElementById('player-search-input');
        if (searchInputEl) searchInputEl.value = '';
        renderizarJugadores();
        renderRosterChips();
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

        // 🐛 BUG CORREGIDO: antes este Leaderboard calculaba un puntaje "en vivo" propio con una
        // fórmula distinta a la oficial, y encima forzaba un PISO de 10 puntos siempre
        // (Math.max(10, basePoints * multiplier)) — por eso TODOS mostraban "10 pts" incluso con
        // el torneo sin comenzar. Eso viola la regla del juego: los puntos SOLO existen cuando el
        // admin liquida el torneo (botón "Liquidar") y valida el Top 10 oficial de cada jugador.
        //
        // Ahora este Leaderboard ya NO recalcula nada por su cuenta: simplemente MUESTRA los
        // puntos oficiales que ya quedaron guardados en cada apuesta (bet.points / bet.settled)
        // por la función de liquidación — la misma fuente de verdad que usa la pestaña
        // "Mis apuestas". Si el torneo activo aún no fue liquidado, no se muestra ningún puntaje.
        if (state.torneoActual.status !== "CLOSED") {
            container.innerHTML = `<div class="empty-state">⏳ El torneo activo aún no ha finalizado ni ha sido liquidado por el administrador. Los puntos oficiales aparecerán aquí una vez se cierre el torneo y se valide el Top 10.</div>`;
            return;
        }

        const usersSnap = await getDocs(collection(db, "users"));
        let usersMap = {};
        usersSnap.forEach(uDoc => {
            const uData = uDoc.data();
            usersMap[uDoc.id] = `${uData.nombre || ''} ${uData.apellido || ''}`.trim() || uDoc.id;
        });

        const q = query(
            collection(db, "bets"),
            where("tournament_id", "==", state.torneoActual.id),
            where("settled", "==", true)
        );
        const querySnapshot = await getDocs(q);

        let usuariosMap = {};

        querySnapshot.forEach((doc) => {
            const bet = doc.data();
            // Puntos oficiales, ya validados contra el Top 10 real por la liquidación del admin.
            // No se recalcula nada aquí — se toma tal cual quedó guardado (fuente única de verdad).
            let totalPoints = Number(bet.points) || 0;

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
            container.innerHTML = `<div class="empty-state">No hay apuestas liquidadas todavía para este torneo.</div>`;
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

// Tabla de puntos SOLO para quien termine en el Top 10 oficial. Fuera del Top 10 = 0 puntos.
const PUNTOS_POR_POSICION = { 1: 100, 2: 80, 3: 65, 4: 55, 5: 50, 6: 45, 7: 40, 8: 38, 9: 36, 10: 34 };
function puntosPorPosicion(position_id) {
    if (!position_id || position_id > 10) return 0;
    return PUNTOS_POR_POSICION[position_id] || 0;
}

document.getElementById('btnLiquidarTorneo')?.addEventListener('click', async () => {
    if (!state.torneoActual) return;

    const btn = document.getElementById('btnLiquidarTorneo');
    const textoOriginal = btn.textContent;
    btn.textContent = "🔄 Trayendo resultado oficial final...";
    btn.disabled = true;

    try {
        // 1) Traemos el resultado FINAL oficial (con posición real de cada jugador), no el score en vivo.
        const torneoFinal = await fetchTorneoDesdeESPN();
        torneoFinal.status = "CLOSED";

        // Chequeo de seguridad: si ESPN no nos dio ninguna posición válida, algo cambió en su formato
        // de respuesta. Mejor avisar y detener la liquidación que repartir 0 puntos a todo el mundo.
        const conPosicionValida = (torneoFinal.players || []).some(p => p.position_id !== null);
        if (!conPosicionValida) {
            mostrarModal(
                "No se pudo validar el Top 10",
                "ESPN no devolvió la posición oficial de ningún jugador (puede que su formato de datos haya cambiado). No se liquidó el torneo ni se tocaron puntos — revisa la consola (F12) y avísame antes de reintentar.",
                "⚠️"
            );
            console.error("Liquidación abortada: ningún jugador tiene position_id. Revisar estructura de la respuesta de ESPN.", torneoFinal.players);
            btn.textContent = textoOriginal;
            btn.disabled = false;
            return;
        }

        await setDoc(doc(db, "tournaments", torneoFinal.id), torneoFinal);
        state.torneoActual = torneoFinal;
        actualizarUIەTorneo();

        // Mapa rápido: id de jugador -> posición oficial final
        const posicionPorJugador = {};
        (torneoFinal.players || []).forEach(p => { posicionPorJugador[p.id] = p.position_id; });

        // 2) Solo las apuestas con PAGO CONFIRMADO de este torneo reciben puntos.
        //    Las pendientes de pago quedan en 0 (no cuentan, como debe ser).
        const betsQ = query(
            collection(db, "bets"),
            where("tournament_id", "==", torneoFinal.id),
            where("payment_status", "==", "APPROVED")
        );
        const betsSnap = await getDocs(betsQ);

        let actualizadas = 0;
        for (const betDoc of betsSnap.docs) {
            const bet = betDoc.data();
            let puntosBase = 0;
            (bet.roster || []).forEach(player => {
                puntosBase += puntosPorPosicion(posicionPorJugador[player.id]);
            });
            const puntosFinales = Math.round(puntosBase * (bet.multiplier || 1));

            await updateDoc(doc(db, "bets", betDoc.id), {
                points: puntosFinales,
                settled: true,
                settled_at: serverTimestamp()
            });
            actualizadas++;
        }

        mostrarModal(
            "Torneo Liquidado",
            `Se trajo el resultado oficial final y se asignaron puntos a ${actualizadas} apuesta(s) confirmada(s). Solo cuentan los jugadores que terminaron en el Top 10 oficial. Las inscripciones quedaron bloqueadas.`,
            "🔒"
        );
    } catch (e) {
        console.error("Error liquidando torneo:", e);
        mostrarModal("Error", "No se pudo liquidar el torneo. Revisa la consola (F12) para más detalle.", "❌");
    } finally {
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
});

// --- CALCULAR PUNTOS REALES DEL USUARIO ---
// Solo cuentan apuestas: 1) con pago confirmado, Y 2) de un torneo ya LIQUIDADO (settled: true).
// Si el torneo sigue en curso, esa apuesta simplemente no aparece aquí todavía = 0 puntos, como debe ser.
async function calcularMisPuntos(userId) {
    const q = query(
        collection(db, "bets"),
        where("user_id", "==", userId),
        where("payment_status", "==", "APPROVED"),
        where("settled", "==", true)
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    let total = 0;
    snap.forEach(d => {
        const bet = d.data();
        total += (bet.points || 0);
    });
    return Math.round(total);
}

// --- CARGAR PREMIOS (fotos y precios reales, puntos calculados automáticamente) ---
//
// ⚙️ TASA DE CAMBIO PUNTOS → PESOS ahora vive en Firestore (colección "config", doc "puntos",
// campo "pesos_por_punto"), editable desde el panel Admin — nada de tocar código para cambiarla.
let PESOS_POR_PUNTO = 45; // valor de respaldo mientras carga el real desde Firestore

async function cargarConfigPuntos() {
    try {
        const snap = await getDoc(doc(db, "config", "puntos"));
        if (snap.exists() && snap.data().pesos_por_punto) {
            PESOS_POR_PUNTO = Number(snap.data().pesos_por_punto);
        }
    } catch (e) {
        console.error("No se pudo leer la configuración de puntos, se usa el valor de respaldo:", e);
    }
}

function puntosRequeridos(item) {
    return Math.ceil((item.precio_real || 0) / PESOS_POR_PUNTO);
}

// El catálogo ahora vive 100% en Firestore (colección "premios") — se administra desde el
// panel Admin (agregar / editar / eliminar / subir foto), nunca hay que tocar la base de datos.
async function obtenerCatalogoPremios() {
    const snap = await getDocs(collection(db, "premios"));
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (a.precio_real || 0) - (b.precio_real || 0));
    return items;
}

async function cargarPremios(userId) {
    const puntosEl = document.getElementById('user-points');
    const fillEl = document.querySelector('#content-catalogo .progress-fill');
    const restanteEl = document.getElementById('user-points-remaining');

    if (puntosEl) puntosEl.textContent = 'Calculando...';
    if (restanteEl) restanteEl.textContent = 'Calculando...';

    await cargarConfigPuntos();

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

    try {
        const catalogo = await obtenerCatalogoPremios();
        const container = document.getElementById('catalogo-list');
        container.innerHTML = '';

        if (catalogo.length === 0) {
            container.innerHTML = `<div class="empty-state">Todavía no hay premios en el catálogo. Un administrador puede agregarlos desde el panel Admin.</div>`;
            if (fillEl) fillEl.style.width = "0%";
            if (restanteEl) restanteEl.textContent = "Sin premios configurados todavía.";
            return;
        }

        const umbrales = catalogo.map(puntosRequeridos);
        const maxUmbral = Math.max(...umbrales, 1);
        const pct = Math.min(100, Math.round((totalPuntos / maxUmbral) * 100));
        if (fillEl) fillEl.style.width = pct + "%";

        const siguienteIdx = umbrales.findIndex(p => totalPuntos < p);
        if (restanteEl) {
            restanteEl.textContent = siguienteIdx > -1
                ? `Faltan ${(umbrales[siguienteIdx] - totalPuntos).toLocaleString('es-CO')} pts para tu próxima recompensa`
                : "¡Ya alcanzaste todos los premios disponibles!";
        }

        // Consulta si el usuario ya reclamó cada premio, para no mostrar el botón dos veces
        let misClaims = [];
        try {
            const claimsSnap = await getDocs(query(collection(db, "claims"), where("user_id", "==", userId)));
            claimsSnap.forEach(d => misClaims.push(d.data()));
        } catch (e) {
            console.error("No se pudieron leer los reclamos previos:", e);
        }

        catalogo.forEach(item => {
            const req = puntosRequeridos(item);
            const alcanzado = totalPuntos >= req;
            const yaReclamado = misClaims.some(c => c.item_id === item.id);
            const miniPct = Math.min(100, Math.round((totalPuntos / req) * 100));

            const div = document.createElement('div');
            div.className = 'reward-card';

            const tieneImagenValida = !!item.imagen;

            div.innerHTML = `
                <div class="reward-photo-wrap ${alcanzado ? '' : 'locked'}">
                    ${tieneImagenValida
                        ? `<img src="${item.imagen}" alt="${item.nombre}" onerror="this.style.display='none'; this.parentElement.querySelector('.reward-photo-fallback').style.display='flex';">`
                        : ''
                    }
                    <div class="reward-photo-fallback" style="${tieneImagenValida ? 'display:none;' : ''}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 3v18"/>
                            <path d="M9 4l10 4.2L9 12.4"/>
                            <ellipse cx="9" cy="21.2" rx="5" ry="1.1"/>
                        </svg>
                    </div>
                    <span class="reward-tier-badge ${item.tier || 'bronce'}">${item.tier || 'bronce'}</span>
                    ${!alcanzado ? `<span class="reward-lock-badge">🔒</span>` : ''}
                </div>
                <div class="reward-body">
                    <div class="reward-name">${item.nombre}</div>
                    <div class="reward-price-row">
                        <span class="reward-price-real">Valor real: $${(item.precio_real || 0).toLocaleString('es-CO')}</span>
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

// =====================================================================
// --- GESTIÓN DE PREMIOS DESDE EL PANEL ADMIN (CRUD completo, sin tocar la BD) ---
// =====================================================================

let premioEditandoId = null; // null = creando uno nuevo; si no, estamos editando ese id
let imagenSubidaUrl = null;  // URL resultante tras subir la foto a Firebase Storage

async function cargarGestionPremiosAdmin() {
    // Tasa de cambio puntos -> pesos
    await cargarConfigPuntos();
    const inputTasa = document.getElementById('admin-tasa-puntos');
    if (inputTasa) inputTasa.value = PESOS_POR_PUNTO;

    // Lista de premios existentes
    const listContainer = document.getElementById('admin-premios-crud-list');
    if (!listContainer) return;
    listContainer.innerHTML = '<div class="text-center"><span class="spinner" style="border-top-color:var(--verde-fairway)"></span></div>';

    try {
        const catalogo = await obtenerCatalogoPremios();
        listContainer.innerHTML = '';

        if (catalogo.length === 0) {
            listContainer.innerHTML = `<div class="empty-state" style="padding:15px; font-size:12px;">Aún no has agregado ningún premio. Usa el formulario de abajo.</div>`;
            return;
        }

        catalogo.forEach(item => {
            const req = puntosRequeridos(item);
            const div = document.createElement('div');
            div.className = 'ticket-card';
            div.innerHTML = `
                <div class="ticket-card-header">
                    <span style="font-size:12px;">${item.nombre}</span>
                    <span style="color:var(--dorado); font-size:11px;">${req.toLocaleString('es-CO')} pts</span>
                </div>
                <div class="ticket-card-body">
                    <p style="margin:0 0 8px 0; font-size:12px;">Valor real: $${(item.precio_real || 0).toLocaleString('es-CO')} · Nivel: ${item.tier || 'bronce'}</p>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-outline btn-small btn-editar-premio" data-id="${item.id}" style="flex:1;">✏️ Editar</button>
                        <button class="btn-outline btn-small btn-eliminar-premio" data-id="${item.id}" style="flex:1; border-color:var(--rojo-alerta); color:var(--rojo-alerta);">🗑️ Eliminar</button>
                    </div>
                </div>
            `;
            listContainer.appendChild(div);
        });

        document.querySelectorAll('.btn-editar-premio').forEach(btn => {
            btn.addEventListener('click', async () => {
                const item = catalogo.find(c => c.id === btn.dataset.id);
                if (item) cargarPremioEnFormulario(item);
            });
        });
        document.querySelectorAll('.btn-eliminar-premio').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm("¿Eliminar este premio del catálogo? Esta acción no se puede deshacer.")) return;
                try {
                    await deleteDoc(doc(db, "premios", btn.dataset.id));
                    mostrarModal("Premio Eliminado", "Se quitó del catálogo.", "🗑️", () => cargarGestionPremiosAdmin());
                } catch (e) {
                    mostrarModal("Error", "No se pudo eliminar el premio.", "❌");
                }
            });
        });
    } catch (e) {
        console.error("Error cargando gestión de premios:", e);
        listContainer.innerHTML = `<p style="color:var(--rojo-alerta); font-size:12px;">Error cargando el catálogo.</p>`;
    }
}

function cargarPremioEnFormulario(item) {
    premioEditandoId = item.id;
    imagenSubidaUrl = item.imagen || null;
    document.getElementById('premio-form-titulo').textContent = "Editando: " + item.nombre;
    document.getElementById('premio-nombre').value = item.nombre || '';
    document.getElementById('premio-precio').value = item.precio_real || '';
    document.getElementById('premio-tier').value = item.tier || 'bronce';
    actualizarPreviewImagenPremio(item.imagen || null);
    actualizarPuntosPreview();
    document.getElementById('btnCancelarEdicionPremio').classList.remove('hidden');
    document.getElementById('premio-form-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function limpiarFormularioPremio() {
    premioEditandoId = null;
    imagenSubidaUrl = null;
    document.getElementById('premio-form-titulo').textContent = "Agregar nuevo premio";
    document.getElementById('premio-nombre').value = '';
    document.getElementById('premio-precio').value = '';
    document.getElementById('premio-tier').value = 'bronce';
    document.getElementById('premio-imagen-file').value = '';
    actualizarPreviewImagenPremio(null);
    actualizarPuntosPreview();
    document.getElementById('btnCancelarEdicionPremio').classList.add('hidden');
}

function actualizarPreviewImagenPremio(url) {
    const preview = document.getElementById('premio-imagen-preview');
    if (!preview) return;
    if (url) {
        preview.src = url;
        preview.classList.remove('hidden');
    } else {
        preview.classList.add('hidden');
        preview.removeAttribute('src');
    }
}

function actualizarPuntosPreview() {
    const precio = Number(document.getElementById('premio-precio')?.value || 0);
    const el = document.getElementById('premio-puntos-preview');
    if (el) {
        const pts = Math.ceil(precio / PESOS_POR_PUNTO);
        el.textContent = precio > 0 ? `= ${pts.toLocaleString('es-CO')} pts requeridos` : '';
    }
}

document.getElementById('premio-precio')?.addEventListener('input', actualizarPuntosPreview);

// Comprime y convierte la foto a una imagen pequeña en base64 (texto), para poder guardarla
// directo en Firestore sin necesitar Firebase Storage (que ahora exige plan de pago Blaze).
function comprimirImagenAFoto(file, maxLado = 800, calidad = 0.72) {
    return new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                // Se limita por el lado MÁS LARGO (sirve igual para fotos horizontales
                // que verticales/de celular en modo retrato) — antes solo miraba el ancho.
                const ladoMayor = Math.max(width, height);
                if (ladoMayor > maxLado) {
                    const factor = maxLado / ladoMayor;
                    width = Math.round(width * factor);
                    height = Math.round(height * factor);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', calidad));
            };
            img.onerror = () => reject(new Error("No se pudo leer la imagen."));
            img.src = e.target.result;
        };
        lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
        lector.readAsDataURL(file);
    });
}

let procesandoImagenPremio = false;

document.getElementById('premio-imagen-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('premio-imagen-status');
    procesandoImagenPremio = true;
    if (statusEl) statusEl.textContent = "⏳ Procesando foto, espera un momento...";
    try {
        const dataUrl = await comprimirImagenAFoto(file);
        // Chequeo de tamaño: Firestore permite máximo ~1MB por documento completo.
        const pesoKB = Math.round((dataUrl.length * 3 / 4) / 1024);
        if (pesoKB > 700) {
            if (statusEl) statusEl.textContent = `⚠️ La foto quedó muy pesada (${pesoKB}KB). Prueba con una foto más simple, de menor resolución, o recórtala antes de subirla.`;
            return;
        }
        imagenSubidaUrl = dataUrl;
        actualizarPreviewImagenPremio(dataUrl);
        if (statusEl) statusEl.textContent = `✅ Foto lista (${pesoKB}KB) — ya puedes guardar el premio.`;
    } catch (err) {
        console.error("Error procesando imagen:", err);
        if (statusEl) statusEl.textContent = "❌ No se pudo procesar la foto.";
    } finally {
        procesandoImagenPremio = false;
    }
});

document.getElementById('btnCancelarEdicionPremio')?.addEventListener('click', limpiarFormularioPremio);

document.getElementById('btnGuardarPremio')?.addEventListener('click', async () => {
    if (procesandoImagenPremio) {
        mostrarModal("Espera un momento", "La foto todavía se está procesando. Espera a que aparezca el mensaje '✅ Foto lista' y vuelve a darle a Guardar.", "⏳");
        return;
    }

    const nombre = document.getElementById('premio-nombre').value.trim();
    const precio = Number(document.getElementById('premio-precio').value);
    const tier = document.getElementById('premio-tier').value;

    if (!nombre || !precio || precio <= 0) {
        mostrarModal("Datos Incompletos", "Ponle un nombre y un precio real válido al premio.", "⚠️");
        return;
    }

    const data = {
        nombre,
        precio_real: precio,
        tier,
        imagen: imagenSubidaUrl || null,
        updated_at: serverTimestamp()
    };

    try {
        if (premioEditandoId) {
            await updateDoc(doc(db, "premios", premioEditandoId), data);
            mostrarModal("Premio Actualizado", "Los cambios se guardaron correctamente.", "✅");
        } else {
            data.created_at = serverTimestamp();
            await addDoc(collection(db, "premios"), data);
            mostrarModal("Premio Agregado", "Ya aparece en el catálogo de todos los jugadores.", "🎁");
        }
        limpiarFormularioPremio();
        cargarGestionPremiosAdmin();
    } catch (e) {
        console.error("Error guardando premio:", e);
        mostrarModal("Error", "No se pudo guardar el premio.", "❌");
    }
});

document.getElementById('btnGuardarTasaPuntos')?.addEventListener('click', async () => {
    const valor = Number(document.getElementById('admin-tasa-puntos').value);
    if (!valor || valor <= 0) {
        mostrarModal("Valor Inválido", "Ingresa un número mayor a 0.", "⚠️");
        return;
    }
    try {
        await setDoc(doc(db, "config", "puntos"), { pesos_por_punto: valor, updated_at: serverTimestamp() }, { merge: true });
        PESOS_POR_PUNTO = valor;
        mostrarModal("Tasa Actualizada", "Los puntos requeridos de todos los premios se recalcularán con este nuevo valor.", "✅", () => cargarGestionPremiosAdmin());
    } catch (e) {
        mostrarModal("Error", "No se pudo guardar la tasa.", "❌");
    }
});

// --- SELECCIÓN DE ROSTER ---
document.getElementById('btnSiguientePago').addEventListener('click', () => {
    if (state.torneoActual?.status === "CLOSED") {
        mostrarModal("Torneo Cerrado", "Este torneo ya ha finalizado.", "🔒");
        return;
    }
    state.jugadoresSeleccionados = []; 
    document.getElementById('roster-title').textContent = "Arma tu equipo";
    filtroJugadorActual = '';
    const searchInputEl2 = document.getElementById('player-search-input');
    if (searchInputEl2) searchInputEl2.value = '';
    renderizarJugadores(); 
    renderRosterChips();
    actualizarEstadoBotonRoster(); 
    showScreen('roster');
});

let filtroJugadorActual = '';

function renderizarJugadores() {
    const listContainer = document.getElementById('player-list');
    listContainer.innerHTML = '';

    if (!state.torneoActual || !state.torneoActual.players) return;

    const termino = filtroJugadorActual.trim().toLowerCase();

    const jugadoresOrdenados = [...state.torneoActual.players]
        .filter(p => !termino || p.name.toLowerCase().includes(termino))
        .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

    if (jugadoresOrdenados.length === 0) {
        listContainer.innerHTML = `<div class="empty-state" style="padding:16px; font-size:12px;">No hay jugadores que coincidan con "${filtroJugadorActual}".</div>`;
        return;
    }

    jugadoresOrdenados.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';

        const yaSeleccionado = state.jugadoresSeleccionados.some(p => p.id === player.id);
        if (yaSeleccionado) {
            div.classList.add('selected');
        }

        const tieneFoto = !!player.photo;
        div.innerHTML = `
            <div class="player-info-container">
                <div class="player-photo-wrap">
                    ${tieneFoto
                        ? `<img src="${player.photo}" alt="${player.name}" class="player-photo" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                        : ''
                    }
                    <div class="player-photo-fallback" style="${tieneFoto ? 'display:none;' : ''}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="8" r="3.2"/>
                            <path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/>
                        </svg>
                    </div>
                </div>
                <div>
                    <span class="player-name">${player.name}</span>
                    <span class="player-score">Score: <strong>${player.score}</strong></span>
                </div>
            </div>
        `;

        div.addEventListener('click', () => {
            const index = state.jugadoresSeleccionados.findIndex(p => p.id === player.id);

            if (index > -1) {
                // Ya estaba en el equipo -> lo quitamos
                state.jugadoresSeleccionados.splice(index, 1);
            } else if (state.jugadoresSeleccionados.length < state.cuposTotales) {
                // Hay cupo libre -> lo agregamos directo
                state.jugadoresSeleccionados.push(player);
            } else if (state.cuposTotales === 1) {
                // Solo puede tener 1 jugador -> con tocar otro simplemente lo reemplaza
                state.jugadoresSeleccionados = [player];
            } else {
                // Equipo lleno con más de 1 cupo -> reemplaza el ÚLTIMO que había elegido,
                // así el usuario puede simplemente ir tocando nuevos jugadores sin tener
                // que ir a buscar manualmente a quién desmarcar primero.
                state.jugadoresSeleccionados.pop();
                state.jugadoresSeleccionados.push(player);
            }

            renderizarJugadores();
            renderRosterChips();
            actualizarEstadoBotonRoster();
        });
        listContainer.appendChild(div);
    });
}

function renderRosterChips() {
    const box = document.getElementById('roster-chips-box');
    const list = document.getElementById('roster-chips-list');
    if (!box || !list) return;

    if (state.jugadoresSeleccionados.length === 0) {
        box.classList.add('hidden');
        list.innerHTML = '';
        return;
    }

    box.classList.remove('hidden');
    list.innerHTML = '';
    state.jugadoresSeleccionados.forEach(player => {
        const chip = document.createElement('span');
        chip.className = 'roster-chip';
        chip.innerHTML = `${player.name} <button type="button" class="roster-chip-remove" aria-label="Quitar">×</button>`;
        chip.querySelector('.roster-chip-remove').addEventListener('click', () => {
            const index = state.jugadoresSeleccionados.findIndex(p => p.id === player.id);
            if (index > -1) state.jugadoresSeleccionados.splice(index, 1);
            renderizarJugadores();
            renderRosterChips();
            actualizarEstadoBotonRoster();
        });
        list.appendChild(chip);
    });
}

document.getElementById('player-search-input')?.addEventListener('input', (e) => {
    filtroJugadorActual = e.target.value;
    renderizarJugadores();
});

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
                points: 0,
                settled: false,
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

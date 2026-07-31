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

// 🔒 SEGURIDAD: escapa caracteres HTML especiales antes de insertar cualquier texto que venga
// de un usuario (nombre de perfil, número de referencia de pago, etc.) o de una fuente externa
// (ESPN, calendario) dentro de un template literal que luego se asigna a innerHTML. Sin esto,
// alguien podría poner código <script> o atributos maliciosos (ej. en su nombre de perfil o en
// el campo de referencia de pago) y ese código se ejecutaría en el navegador de OTRAS personas
// -- incluido el administrador -- al ver esa información renderizada (Leaderboard, panel Admin,
// lista de "Mis apuestas", etc.). Se aplica de forma consistente en TODO el archivo.
function escapeHtml(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
    // 🔧 mostrarModal() SIEMPRE resetea el modal a su estado "simple" (un solo botón, texto por
    // defecto "Entendido", sin la clase roja de peligro), para que no herede visualmente el
    // estado de una confirmación anterior (mostrarConfirmacion).
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
        if (onConfirm) onConfirm();
    });

    nuevoBtnCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
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
            const codigoIngresado = document.getElementById('reg-invite-code')?.value.trim() || '';

            if (!nombre || !apellido) {
                mostrarModal("Datos Personales", "Debes ingresar tu nombre y apellidos completos.", "⚠️");
                return;
            }

            // 🔒 SEGURIDAD: código de invitación del grupo. Esto NO es una barrera criptográfica
            // fuerte (el documento es de lectura pública porque debe poder validarse ANTES de
            // iniciar sesión), pero sí evita que alguien cree una cuenta solo por tener el link
            // de la app sin ser parte real del grupo de amigos. Pídeselo al administrador.
            if (!codigoIngresado) {
                mostrarModal("Código Requerido", "Ingresa el código de invitación del grupo para registrarte. Pídeselo al administrador.", "🔒");
                return;
            }
            try {
                const inviteSnap = await getDoc(doc(db, "config", "invite_code"));
                const codigoValido = inviteSnap.exists() ? (inviteSnap.data().code || '') : '';
                if (!codigoValido || codigoIngresado.toLowerCase() !== String(codigoValido).toLowerCase()) {
                    mostrarModal("Código Incorrecto", "El código de invitación no es válido. Verifica con el administrador del grupo.", "🔒");
                    return;
                }
            } catch (e) {
                console.error("Error validando código de invitación:", e);
                mostrarModal("Error", "No se pudo validar el código de invitación. Intenta de nuevo.", "❌");
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
        // Nota: se usa textContent (no innerHTML), así que este campo ya es seguro por diseño.
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
async function fetchTorneoDesdeESPN() {
    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard');
    const data = await response.json();
    const event = data.events[0];
    const competition = event.competitions && event.competitions[0];
    const compStatus = competition && competition.status;

    const rangoFechasTorneo = (compStatus && compStatus.type && (compStatus.type.detail || compStatus.type.shortDetail)) || null;

    const torneoData = {
        id: event.id,
        name: event.shortName || event.name,
        course: event.courses ? event.courses[0].name : "PGA Tour Course",
        startDate: event.date,
        rango_fechas: rangoFechasTorneo,
        status: "ACTIVE",
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
// =====================================================================
const URL_CALENDARIO_ESPN = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/calendar/ondays?lang=en&region=us';

async function fetchCalendarioDelMesESPN() {
    const response = await fetch(URL_CALENDARIO_ESPN);
    const data = await response.json();

    let entradas = data.sections || data.calendar || data.entries || data.items || [];

    if (!Array.isArray(entradas) || entradas.length === 0) {
        console.error("fetchCalendarioDelMesESPN: no se encontró un arreglo de torneos en la respuesta. Respuesta cruda COMPLETA (cópiala toda):");
        console.error(JSON.stringify(data, null, 2));
        throw new Error("La respuesta de ESPN no tuvo el formato esperado (revisa la consola).");
    }

    const torneos = entradas.map(item => {
        const id = item.id || null;
        const nombre = item.label || item.name || item.shortName || "Torneo sin nombre";
        const detalle = item.detail || null;
        const inicio = item.startDate || null;
        const fin = item.endDate || null;
        return { id, nombre, detalle, inicio, fin };
    }).filter(t => t.inicio);

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
    const mesHeader = document.getElementById('calendario-mes-header');
    if (!container) return;

    try {
        const snap = await getDoc(doc(db, "calendario", "mes_actual"));
        if (!snap.exists() || !snap.data().torneos || snap.data().torneos.length === 0) {
            if (mesHeader) mesHeader.classList.add('hidden');
            container.innerHTML = `<div class="empty-state" style="padding:14px; font-size:12px;">Todavía no se ha cargado el calendario del mes.</div>`;
            return;
        }

        const torneos = snap.data().torneos;
        const ahora = new Date();
        const hoySinHora = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        const mesActualNum = ahora.getMonth();
        const anioActualNum = ahora.getFullYear();

        const conFecha = torneos
            .map(t => ({ ...t, inicioDate: new Date(t.inicio) }))
            .filter(t => !isNaN(t.inicioDate))
            .sort((a, b) => a.inicioDate - b.inicioDate);

        const nombreTorneoActivo = (state.torneoActual?.name || '').trim().toLowerCase();

        const proximos = conFecha.filter(t => {
            const inicioSinHora = new Date(t.inicioDate.getFullYear(), t.inicioDate.getMonth(), t.inicioDate.getDate());
            const esFuturo = inicioSinHora >= hoySinHora;
            const esElTorneoActivo = nombreTorneoActivo && (t.nombre || '').trim().toLowerCase() === nombreTorneoActivo;
            return esFuturo && !esElTorneoActivo;
        });

        if (proximos.length === 0) {
            if (mesHeader) mesHeader.classList.add('hidden');
            container.innerHTML = '';
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

        // 🔒 SEGURIDAD: 'nombre' y 'detalle' vienen de la API pública de ESPN (fuente externa, no
        // controlada por nuestros usuarios, pero tampoco por nosotros) — se escapan igualmente
        // por defensa en profundidad antes de insertarlos en el innerHTML de cada tarjeta.
        const tarjetaTorneo = (t, destacado) => `
            <div class="ticket-card ${destacado ? 'torneo-destacado' : ''}" style="margin-bottom:10px;">
                <div class="ticket-card-header">
                    <span>${escapeHtml(t.nombre)}</span>
                    ${destacado ? `<span class="proximo-label">PRÓXIMO</span>` : `<span style="font-size:11px; color:var(--texto-gris);">${calcularEtiqueta(t.inicioDate)}</span>`}
                </div>
                <div class="ticket-card-body">
                    <p style="margin:0; font-size:12px;">📅 ${escapeHtml(fechaLarga(t))}</p>
                </div>
            </div>
        `;

        const delMesActual = proximos.filter(t =>
            t.inicioDate.getMonth() === mesActualNum && t.inicioDate.getFullYear() === anioActualNum
        );
        const restoDelAnio = proximos.filter(t =>
            !(t.inicioDate.getMonth() === mesActualNum && t.inicioDate.getFullYear() === anioActualNum)
        );

        let html = '';

        if (delMesActual.length > 0) {
            if (mesHeader) mesHeader.classList.remove('hidden');
            const masProximo = delMesActual[0];
            html += tarjetaTorneo(masProximo, true);

            if (delMesActual.length > 1) {
                html += `<div style="font-size:11px; color:var(--texto-gris); text-transform:uppercase; letter-spacing:0.4px; margin:14px 0 8px;">Resto del mes</div>`;
                delMesActual.slice(1).forEach(t => { html += tarjetaTorneo(t, false); });
            }
        } else {
            if (mesHeader) mesHeader.classList.add('hidden');
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
    
    const estadoReal = state.torneoActual.estado_vivo || 'pre';
    const yaLiquidado = state.torneoActual.status === "CLOSED";
    const inscripcionCerrada = yaLiquidado || estadoReal !== 'pre';

    if (state.torneoActual.rango_fechas) {
        document.getElementById('torneo-inicio').textContent = "📅 Fechas oficiales: " + state.torneoActual.rango_fechas;
    } else if (state.torneoActual.startDate) {
        const fechaSoloDia = new Date(state.torneoActual.startDate);
        document.getElementById('torneo-inicio').textContent = "📅 Inicia: " + fechaSoloDia.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    } else {
        document.getElementById('torneo-inicio').textContent = "";
    }

    const badge = document.getElementById('torneo-badge');
    const btnInscripcion = document.getElementById('btnIrSeleccion');

    if (yaLiquidado || estadoReal === 'post') {
        badge.textContent = "FINALIZADO";
        badge.className = "badge badge-closed";
    } else if (estadoReal === 'in') {
        badge.textContent = "INICIADO";
        badge.className = "badge badge-live";
    } else {
        badge.textContent = "ABIERTO";
        badge.className = "badge";
    }

    if (inscripcionCerrada) {
        btnInscripcion.disabled = true;
        btnInscripcion.textContent = (yaLiquidado || estadoReal === 'post')
            ? "Torneo Finalizado / No disponible"
            : "Inscripciones cerradas (torneo en curso)";
    } else {
        btnInscripcion.disabled = false;
        btnInscripcion.textContent = "Elegir equipo e inscribirme";
    }

    const dot = document.getElementById('torneo-live-dot');
    const label = document.getElementById('torneo-live-label');
    if (dot && label) {
        if (estadoReal === 'in') {
            dot.className = 'live-dot';
            label.textContent = 'En vivo ahora';
            label.style.color = 'var(--verde-fairway)';
        } else if (yaLiquidado || estadoReal === 'post') {
            dot.className = 'pending-dot';
            label.textContent = yaLiquidado ? 'Finalizado y liquidado' : 'Finalizado, pendiente de liquidar';
            label.style.color = 'var(--texto-gris)';
        } else {
            dot.className = 'pending-dot';
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

            // 🔒 SEGURIDAD: bet.tournament_name y jugadoresNombres se escapan antes de insertarse.
            // Los nombres de jugadores vienen de ESPN (externos, no controlados por el usuario),
            // pero se escapan igual por defensa en profundidad.
            card.innerHTML = `
                <div class="ticket-card-header">
                    <span>${escapeHtml(bet.tournament_name)}</span>
                    <span style="color:var(--verde-fairway)">$${bet.amount_cop.toLocaleString('es-CO')}</span>
                </div>
                <div class="ticket-card-body">
                    <p style="margin:0 0 6px 0;"><span class="payment-badge ${estadoPago}">${estadoPagoLabel}</span></p>
                    ${estadoPuntosHtml}
                    <p style="margin:0 0 4px 0;"><strong>Multiplicador:</strong> ${bet.multiplier}x</p>
                    <p style="margin:0 0 10px 0;"><strong>Equipo:</strong> ${escapeHtml(jugadoresNombres)}</p>
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

        if (state.torneoActual.status !== "CLOSED") {
            container.innerHTML = `<div class="empty-state">⏳ El torneo activo aún no ha finalizado ni ha sido liquidado por el administrador. Los puntos oficiales aparecerán aquí una vez se cierre el torneo y se valide el Top 10.</div>`;
            return;
        }

        // 🔒 SEGURIDAD: el Leaderboard YA NO lee la colección "bets" directamente. Esa colección
        // contiene datos sensibles de TODOS los usuarios (monto apostado, número de referencia de
        // pago, etc.) y ahora está restringida por reglas de Firestore a "solo el dueño o el
        // admin". En su lugar, este Leaderboard lee "leaderboard_entries" — una colección PÚBLICA
        // de solo lectura, generada por el admin al liquidar el torneo, que contiene ÚNICAMENTE
        // los campos seguros para mostrar (nombre, equipo, puntos, multiplicador).
        const q = query(
            collection(db, "leaderboard_entries"),
            where("tournament_id", "==", state.torneoActual.id)
        );
        const querySnapshot = await getDocs(q);

        let ranking = [];
        querySnapshot.forEach((docSnap) => {
            const entry = docSnap.data();
            ranking.push({
                user: entry.user_display_name || 'Jugador',
                team: entry.team || '',
                points: Number(entry.points) || 0,
                multiplier: entry.multiplier || 1
            });
        });

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
            // 🔒 SEGURIDAD: 'entry.user' proviene del nombre de perfil, que CUALQUIER usuario
            // puede editar libremente desde "Mi Perfil" -- sin este escape, alguien podría
            // inyectar HTML/JS en su propio nombre y ese código se ejecutaría en el navegador
            // de TODOS los que vean el Leaderboard, incluido el administrador.
            div.innerHTML = `
                <div class="rank-position">${medal}</div>
                <div class="rank-info">
                    <div class="rank-name">${escapeHtml(entry.user)}</div>
                    <div class="rank-team">${escapeHtml(entry.team)}</div>
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

        const pendContainer = document.getElementById('admin-pagos-pendientes-list');
        if (pendContainer) {
            pendContainer.innerHTML = '';
            if (pagosPendientes.length === 0) {
                pendContainer.innerHTML = `<div class="empty-state" style="padding:15px; font-size:12px;">No hay pagos pendientes por confirmar.</div>`;
            } else {
                pagosPendientes.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'ticket-card';
                    // 🔒 SEGURIDAD CRÍTICA: 'item.referencia' es TEXTO LIBRE que cualquier usuario
                    // escribe él mismo en el checkout (campo "Número de referencia"). Sin escapar,
                    // esto es un vector de XSS almacenado directo contra el ADMINISTRADOR: alguien
                    // podría poner código malicioso ahí y este se ejecutaría en el navegador del
                    // admin justo al revisar "Pagos por Confirmar".
                    const refHtml = item.referencia
                        ? `<p style="margin:0 0 8px 0; font-size:12px;"><strong>Referencia:</strong> ${escapeHtml(item.referencia)}</p>`
                        : `<p style="margin:0 0 8px 0; font-size:11.5px; color:var(--texto-gris);">Sin número de referencia — verifica por monto y nombre.</p>`;
                    div.innerHTML = `
                        <div class="ticket-card-header">
                            <span style="font-size:12px;">${escapeHtml(item.email)}</span>
                            <span style="color:var(--verde-fairway)">$${item.monto.toLocaleString('es-CO')}</span>
                        </div>
                        <div class="ticket-card-body">
                            <p style="margin:0 0 4px 0; font-size:12px;"><strong>Torneo:</strong> ${escapeHtml(item.torneo)}</p>
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
            // 🔒 SEGURIDAD: item.user_email (Firebase Auth valida su formato, riesgo bajo) e
            // item.item_name (nombre del premio, controlado por el admin al crearlo, riesgo bajo)
            // se escapan igual por consistencia y defensa en profundidad.
            div.innerHTML = `
                <div class="ticket-card-header">
                    <span style="font-size:12px;">${escapeHtml(item.user_email)}</span>
                    <span style="color:var(--dorado); font-size:11px;">$${(item.item_price || 0).toLocaleString('es-CO')}</span>
                </div>
                <div class="ticket-card-body">
                    <p style="margin:0 0 10px 0; font-size:12px;">🎁 <strong>Premio:</strong> ${escapeHtml(item.item_name)}</p>
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
        const torneoFinal = await fetchTorneoDesdeESPN();
        torneoFinal.status = "CLOSED";

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

        const posicionPorJugador = {};
        (torneoFinal.players || []).forEach(p => { posicionPorJugador[p.id] = p.position_id; });

        const betsQ = query(
            collection(db, "bets"),
            where("tournament_id", "==", torneoFinal.id),
            where("payment_status", "==", "APPROVED")
        );
        const betsSnap = await getDocs(betsQ);

        // 🔒 SEGURIDAD: aquí armamos SOLO los datos públicos/seguros del Leaderboard (nombre,
        // equipo, puntos, multiplicador) — nunca amount_cop ni payment_reference. Se guarda la
        // MEJOR apuesta liquidada por usuario, igual que hacía antes cargarRanking() al leer
        // "bets" directamente (mismo criterio, ahora aplicado UNA sola vez al liquidar).
        let mejorPorUsuario = {};

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

            const equipoTexto = (bet.roster || []).map(p => p.name).join(', ');
            if (!mejorPorUsuario[bet.user_id] || puntosFinales > mejorPorUsuario[bet.user_id].points) {
                mejorPorUsuario[bet.user_id] = {
                    user_email: bet.user_email,
                    team: equipoTexto,
                    points: puntosFinales,
                    multiplier: bet.multiplier || 1
                };
            }
        }

        // Buscamos los nombres de perfil reales (el admin sí tiene permiso de leer toda la
        // colección "users") para mostrar "Nombre Apellido" en el Leaderboard en vez del correo.
        const usersSnap = await getDocs(collection(db, "users"));
        let nombresMap = {};
        usersSnap.forEach(uDoc => {
            const uData = uDoc.data();
            nombresMap[uDoc.id] = `${uData.nombre || ''} ${uData.apellido || ''}`.trim();
        });

        for (const userId of Object.keys(mejorPorUsuario)) {
            const entry = mejorPorUsuario[userId];
            const nombreDisplay = nombresMap[userId] || (entry.user_email ? entry.user_email.split('@')[0] : 'Jugador');
            await setDoc(doc(db, "leaderboard_entries", `${torneoFinal.id}_${userId}`), {
                tournament_id: torneoFinal.id,
                user_id: userId,
                user_display_name: nombreDisplay,
                team: entry.team,
                points: entry.points,
                multiplier: entry.multiplier,
                updated_at: serverTimestamp()
            });
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

// --- CARGAR PREMIOS ---
let PESOS_POR_PUNTO = 45;

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
            // 🔒 SEGURIDAD: item.nombre (nombre del premio) es controlado por el admin al crearlo
            // en el panel — riesgo bajo, pero se escapa igual por defensa en profundidad, tanto
            // en el texto visible como en el atributo alt="" (una inyección de comillas ahí
            // podría romper el atributo e insertar HTML/atributos arbitrarios).
            div.innerHTML = `
                <div class="reward-photo-wrap ${alcanzado ? '' : 'locked'}">
                    ${tieneImagenValida
                        ? `<img src="${item.imagen}" alt="${escapeHtml(item.nombre)}">`
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
                    <div class="reward-name">${escapeHtml(item.nombre)}</div>
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

            // 🔧 SEGURIDAD (defensa en profundidad con CSP estricta): antes el fallback de imagen
            // rota usaba un atributo inline onerror="..." en el HTML. Un Content-Security-Policy
            // estricto (sin 'unsafe-inline' en script-src) BLOQUEA los manejadores de eventos
            // inline, así que ahora se enganchan aquí con addEventListener en JavaScript real.
            const imgEl = div.querySelector('.reward-photo-wrap img');
            if (imgEl) {
                imgEl.addEventListener('error', () => {
                    imgEl.style.display = 'none';
                    const fallback = div.querySelector('.reward-photo-fallback');
                    if (fallback) fallback.style.display = 'flex';
                }, { once: true });
            }

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
// --- GESTIÓN DE PREMIOS DESDE EL PANEL ADMIN ---
// =====================================================================
let premioEditandoId = null;
let imagenSubidaUrl = null;

async function cargarGestionPremiosAdmin() {
    await cargarConfigPuntos();
    const inputTasa = document.getElementById('admin-tasa-puntos');
    if (inputTasa) inputTasa.value = PESOS_POR_PUNTO;

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
            // 🔒 SEGURIDAD: item.nombre se escapa aquí también (defensa en profundidad).
            div.innerHTML = `
                <div class="ticket-card-header">
                    <span style="font-size:12px;">${escapeHtml(item.nombre)}</span>
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
                // 🔧 Reemplazado el confirm() nativo por el modal "WOW" de la app, consistente
                // con el resto de confirmaciones destructivas.
                mostrarConfirmacion(
                    "¿Eliminar este premio?",
                    "Esta acción no se puede deshacer. El premio se quitará del catálogo para todos los jugadores.",
                    async () => {
                        try {
                            await deleteDoc(doc(db, "premios", btn.dataset.id));
                            mostrarModal("Premio Eliminado", "Se quitó del catálogo.", "🗑️", () => cargarGestionPremiosAdmin());
                        } catch (e) {
                            mostrarModal("Error", "No se pudo eliminar el premio.", "❌");
                        }
                    },
                    "🗑️"
                );
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

function comprimirImagenAFoto(file, maxLado = 800, calidad = 0.72) {
    return new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
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
        listContainer.innerHTML = `<div class="empty-state" style="padding:16px; font-size:12px;">No hay jugadores que coincidan con "${escapeHtml(filtroJugadorActual)}".</div>`;
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
        // 🔒 SEGURIDAD: player.name/player.score vienen de la API de ESPN (fuente externa, no
        // controlada por nuestros usuarios) — se escapan igual por defensa en profundidad,
        // tanto en el texto visible como en el atributo alt="".
        div.innerHTML = `
            <div class="player-info-container">
                <div class="player-photo-wrap">
                    ${tieneFoto
                        ? `<img src="${player.photo}" alt="${escapeHtml(player.name)}" class="player-photo">`
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
                    <span class="player-name">${escapeHtml(player.name)}</span>
                    <span class="player-score">Score: <strong>${escapeHtml(player.score)}</strong></span>
                </div>
            </div>
        `;

        // 🔧 Fallback de foto rota vía addEventListener (compatible con CSP estricta sin
        // 'unsafe-inline' en script-src), en vez del atributo onerror="..." inline anterior.
        const imgEl = div.querySelector('.player-photo');
        if (imgEl) {
            imgEl.addEventListener('error', () => {
                imgEl.style.display = 'none';
                const fallback = div.querySelector('.player-photo-fallback');
                if (fallback) fallback.style.display = 'flex';
            }, { once: true });
        }

        div.addEventListener('click', () => {
            const index = state.jugadoresSeleccionados.findIndex(p => p.id === player.id);
            if (index > -1) {
                state.jugadoresSeleccionados.splice(index, 1);
            } else if (state.jugadoresSeleccionados.length < state.cuposTotales) {
                state.jugadoresSeleccionados.push(player);
            } else if (state.cuposTotales === 1) {
                state.jugadoresSeleccionados = [player];
            } else {
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
        // 🔒 SEGURIDAD: player.name (ESPN) escapado por defensa en profundidad.
        chip.innerHTML = `${escapeHtml(player.name)} <button type="button" class="roster-chip-remove" aria-label="Quitar">×</button>`;
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
        // 🔒 SEGURIDAD: player.name (ESPN) escapado por defensa en profundidad.
        li.innerHTML = `<span>${escapeHtml(player.name)}</span>`;
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
                // 🔒 SEGURIDAD: points y settled SIEMPRE se crean en 0/false. Las reglas de
                // Firestore ahora EXIGEN estos valores exactos al crear (además de user_id y
                // payment_status), cerrando el hueco por el cual alguien podía forjar puntos
                // ganadores directamente desde la consola del navegador, sin pagar ni ser
                // aprobado por el administrador.
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


// =====================================================================
// --- 👤 AVATAR DE USUARIO CON MENÚ DESPLEGABLE ---
// Reemplaza el antiguo "Bienvenido, Nombre" + enlace "Cerrar sesión" sueltos en el encabezado.
// Ahora se muestra un círculo compacto con las iniciales del usuario; al hacer clic se abre un
// menú con el saludo completo y el botón de cerrar sesión.
//
// ✅ Este bloque es COMPLETAMENTE AUTOCONTENIDO: no hay que modificar ninguna función existente.
//    Usa un MutationObserver que vigila el elemento #user-name-display, así que cada vez que
//    cargarDatosPerfil() o btnGuardarPerfil actualizan ese nombre (como ya lo hacían antes),
//    las iniciales del avatar se recalculan solas. El listener original de #btnLogout tampoco
//    se toca -- ese botón simplemente ahora vive dentro del menú desplegable.
// =====================================================================
(function initUserAvatarMenu() {
    const nameEl = document.getElementById('user-name-display');
    const initialsEl = document.getElementById('user-initials');
    const btnAvatar = document.getElementById('btnUserAvatar');
    const dropdown = document.getElementById('user-dropdown');

    // Si el HTML no tiene estos elementos, salimos sin romper nada.
    if (!nameEl || !initialsEl || !btnAvatar || !dropdown) return;

    // Calcula las iniciales: primera letra del nombre + primera letra del último apellido.
    // Ej: "Jose Andres Ortiz" -> "JO" | "Juan Perez" -> "JP" | "Fernando" -> "FE"
    function calcularIniciales(nombreCompleto) {
        const partes = String(nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
        if (partes.length === 0) return '·';
        if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
        return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    }

    function sincronizarIniciales() {
        initialsEl.textContent = calcularIniciales(nameEl.textContent);
    }

    // Vigila cambios en el nombre mostrado y actualiza las iniciales automáticamente.
    new MutationObserver(sincronizarIniciales).observe(nameEl, {
        childList: true,
        characterData: true,
        subtree: true
    });
    sincronizarIniciales();

    function abrirMenuUsuario() {
        dropdown.classList.remove('hidden');
        btnAvatar.setAttribute('aria-expanded', 'true');
    }
    function cerrarMenuUsuario() {
        dropdown.classList.add('hidden');
        btnAvatar.setAttribute('aria-expanded', 'false');
    }

    btnAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown.classList.contains('hidden')) abrirMenuUsuario();
        else cerrarMenuUsuario();
    });

    // Cerrar al hacer clic fuera del menú.
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !btnAvatar.contains(e.target)) {
            cerrarMenuUsuario();
        }
    });

    // Cerrar con la tecla Escape (accesibilidad).
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cerrarMenuUsuario();
    });

    // En móvil: si se abre el menú hamburguesa, cerramos el del avatar para que no se
    // superpongan visualmente (y viceversa lo maneja el overlay).
    document.getElementById('btnHamburger')?.addEventListener('click', cerrarMenuUsuario);
})();


// =====================================================================
// --- 🎓 MÓDULO ACADEMIA: videos de aprendizaje de golf ---
//
// Catálogo CURADO (no búsqueda dinámica en YouTube). Razón técnica: la YouTube Data API v3
// limita search.list a solo 100 llamadas por día para TODO el proyecto, sin opción de comprar
// más cuota. Con un grupo de amigos usando la app, esa cuota se agota rápido y la sección
// quedaría rota con error 403. Además, una búsqueda abierta puede devolver contenido irrelevante
// o de baja calidad. Con el catálogo curado: sin límites, sin API key extra, y el admin controla
// exactamente qué videos ve el grupo.
//
// ✅ BLOQUE AUTOCONTENIDO: se pega al final de app.js sin modificar ninguna función existente.
//    Reutiliza los helpers globales ya definidos arriba (db, auth, mostrarModal,
//    mostrarConfirmacion, escapeHtml, ADMIN_EMAIL) y las funciones de Firestore ya importadas.
// =====================================================================

// Categorías fijas del módulo. El 'id' se guarda en Firestore; el 'label' es lo que ve el usuario.
const CATEGORIAS_ACADEMIA = [
    { id: 'todos',    label: 'Todos',     icono: '🎬' },
    { id: 'putt',     label: 'Putt',      icono: '⛳' },
    { id: 'drive',    label: 'Drive',     icono: '🏌️' },
    { id: 'approach', label: 'Approach',  icono: '🎯' },
    { id: 'chip',     label: 'Chip',      icono: '🪁' },
    { id: 'bunker',   label: 'Bunker',    icono: '🏖️' },
    { id: 'reglas',   label: 'Reglas',    icono: '📖' },
    { id: 'mental',   label: 'Mental',    icono: '🧠' }
];

let categoriaAcademiaActiva = 'todos';
let leccionesCache = [];

// Extrae el ID de video de cualquier formato de URL de YouTube que el admin pegue:
//   https://www.youtube.com/watch?v=ABC123      -> ABC123
//   https://youtu.be/ABC123                     -> ABC123
//   https://www.youtube.com/embed/ABC123        -> ABC123
//   https://www.youtube.com/shorts/ABC123       -> ABC123
//   ABC123 (el ID pelado)                       -> ABC123
// Devuelve null si no reconoce nada válido (los IDs de YouTube son 11 caracteres).
function extraerYoutubeId(entrada) {
    const texto = String(entrada || '').trim();
    if (!texto) return null;

    // Si ya es un ID limpio de 11 caracteres válidos, lo aceptamos directo.
    if (/^[a-zA-Z0-9_-]{11}$/.test(texto)) return texto;

    const patrones = [
        /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/
    ];
    for (const p of patrones) {
        const m = texto.match(p);
        if (m && m[1]) return m[1];
    }
    return null;
}

async function obtenerLecciones() {
    const snap = await getDocs(collection(db, "lecciones"));
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    // Orden alfabético por título para que el catálogo se vea consistente.
    items.sort((a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'es', { sensitivity: 'base' }));
    return items;
}

// --- Vista del jugador: pestaña "Academia" ---
async function cargarAcademia() {
    const chipsBox = document.getElementById('academia-categorias');
    const container = document.getElementById('academia-list');
    if (!container) return;

    container.innerHTML = '<div class="text-center"><span class="spinner" style="border-top-color:var(--verde-fairway)"></span></div>';

    try {
        leccionesCache = await obtenerLecciones();

        // Píldoras de categoría (solo se muestran las que tienen al menos un video, más "Todos").
        if (chipsBox) {
            const categoriasConContenido = new Set(leccionesCache.map(l => l.categoria));
            chipsBox.innerHTML = '';
            CATEGORIAS_ACADEMIA
                .filter(c => c.id === 'todos' || categoriasConContenido.has(c.id))
                .forEach(cat => {
                    const chip = document.createElement('button');
                    chip.className = 'academia-chip' + (cat.id === categoriaAcademiaActiva ? ' active' : '');
                    chip.textContent = `${cat.icono} ${cat.label}`;
                    chip.addEventListener('click', () => {
                        categoriaAcademiaActiva = cat.id;
                        cargarAcademia();
                    });
                    chipsBox.appendChild(chip);
                });
        }

        const visibles = categoriaAcademiaActiva === 'todos'
            ? leccionesCache
            : leccionesCache.filter(l => l.categoria === categoriaAcademiaActiva);

        if (visibles.length === 0) {
            container.innerHTML = leccionesCache.length === 0
                ? `<div class="empty-state">Todavía no hay lecciones publicadas. El administrador puede agregarlas desde el panel Admin.</div>`
                : `<div class="empty-state">No hay videos en esta categoría todavía.</div>`;
            return;
        }

        container.innerHTML = '';
        visibles.forEach(leccion => {
            const cat = CATEGORIAS_ACADEMIA.find(c => c.id === leccion.categoria);
            const card = document.createElement('div');
            card.className = 'leccion-card';

            // 🔒 SEGURIDAD: todo texto que viene de Firestore se escapa antes de ir a innerHTML.
            // El youtube_id se valida con extraerYoutubeId() (solo acepta [a-zA-Z0-9_-]{11}),
            // así que no puede inyectar comillas ni romper el atributo src del iframe.
            const idSeguro = extraerYoutubeId(leccion.youtube_id);
            if (!idSeguro) return; // documento corrupto: lo omitimos en vez de romper la vista

            // Se usa youtube-nocookie.com (modo privacidad mejorada): no instala cookies de
            // rastreo hasta que el usuario le da play al video.
            card.innerHTML = `
                <div class="leccion-video">
                    <iframe
                        src="https://www.youtube-nocookie.com/embed/${idSeguro}?rel=0"
                        title="${escapeHtml(leccion.titulo)}"
                        loading="lazy"
                        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen></iframe>
                </div>
                <div class="leccion-body">
                    <div class="leccion-meta">
                        <span class="leccion-cat">${cat ? cat.icono + ' ' + escapeHtml(cat.label) : escapeHtml(leccion.categoria || '')}</span>
                        ${leccion.nivel ? `<span class="leccion-nivel ${escapeHtml(leccion.nivel)}">${escapeHtml(leccion.nivel)}</span>` : ''}
                    </div>
                    <div class="leccion-titulo">${escapeHtml(leccion.titulo)}</div>
                    ${leccion.descripcion ? `<p class="leccion-desc">${escapeHtml(leccion.descripcion)}</p>` : ''}
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Error cargando la Academia:", e);
        container.innerHTML = `<p style="color:var(--rojo-alerta); font-size:13px;">Error cargando las lecciones.</p>`;
    }
}

// --- Panel Admin: CRUD de lecciones ---
let leccionEditandoId = null;

async function cargarGestionAcademiaAdmin() {
    const listContainer = document.getElementById('admin-lecciones-list');
    if (!listContainer) return;

    // Poblamos el <select> de categorías una sola vez (omitiendo "todos", que es solo un filtro).
    const selectCat = document.getElementById('leccion-categoria');
    if (selectCat && selectCat.options.length === 0) {
        CATEGORIAS_ACADEMIA.filter(c => c.id !== 'todos').forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = `${cat.icono} ${cat.label}`;
            selectCat.appendChild(opt);
        });
    }

    listContainer.innerHTML = '<div class="text-center"><span class="spinner" style="border-top-color:var(--verde-fairway)"></span></div>';

    try {
        const lecciones = await obtenerLecciones();
        listContainer.innerHTML = '';

        if (lecciones.length === 0) {
            listContainer.innerHTML = `<div class="empty-state" style="padding:15px; font-size:12px;">Aún no has agregado ninguna lección. Usa el formulario de arriba.</div>`;
            return;
        }

        lecciones.forEach(item => {
            const cat = CATEGORIAS_ACADEMIA.find(c => c.id === item.categoria);
            const div = document.createElement('div');
            div.className = 'ticket-card';
            div.innerHTML = `
                <div class="ticket-card-header">
                    <span style="font-size:12px;">${escapeHtml(item.titulo)}</span>
                    <span style="color:var(--dorado); font-size:11px;">${cat ? escapeHtml(cat.label) : escapeHtml(item.categoria || '')}</span>
                </div>
                <div class="ticket-card-body">
                    <p style="margin:0 0 8px 0; font-size:12px;">Nivel: ${escapeHtml(item.nivel || 'no definido')}</p>
                    <div class="ticket-card-actions-row">
                        <button class="btn-outline btn-small btn-editar-leccion" data-id="${item.id}">✏️ Editar</button>
                        <button class="btn-outline btn-small btn-danger-outline btn-eliminar-leccion" data-id="${item.id}">🗑️ Eliminar</button>
                    </div>
                </div>
            `;
            listContainer.appendChild(div);
        });

        document.querySelectorAll('.btn-editar-leccion').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = lecciones.find(l => l.id === btn.dataset.id);
                if (item) cargarLeccionEnFormulario(item);
            });
        });

        document.querySelectorAll('.btn-eliminar-leccion').forEach(btn => {
            btn.addEventListener('click', () => {
                mostrarConfirmacion(
                    "¿Eliminar esta lección?",
                    "Esta acción no se puede deshacer. El video dejará de aparecer en la Academia para todos los jugadores.",
                    async () => {
                        try {
                            await deleteDoc(doc(db, "lecciones", btn.dataset.id));
                            mostrarModal("Lección Eliminada", "Se quitó de la Academia.", "🗑️", () => cargarGestionAcademiaAdmin());
                        } catch (e) {
                            console.error("Error eliminando lección:", e);
                            mostrarModal("Error", "No se pudo eliminar la lección.", "❌");
                        }
                    },
                    "🗑️"
                );
            });
        });
    } catch (e) {
        console.error("Error cargando gestión de Academia:", e);
        listContainer.innerHTML = `<p style="color:var(--rojo-alerta); font-size:12px;">Error cargando las lecciones.</p>`;
    }
}

function cargarLeccionEnFormulario(item) {
    leccionEditandoId = item.id;
    document.getElementById('leccion-form-titulo').textContent = "Editando: " + item.titulo;
    document.getElementById('leccion-titulo').value = item.titulo || '';
    document.getElementById('leccion-url').value = item.youtube_id ? `https://www.youtube.com/watch?v=${item.youtube_id}` : '';
    document.getElementById('leccion-categoria').value = item.categoria || 'putt';
    document.getElementById('leccion-nivel').value = item.nivel || 'principiante';
    document.getElementById('leccion-descripcion').value = item.descripcion || '';
    actualizarPreviewLeccion();
    document.getElementById('btnCancelarEdicionLeccion').classList.remove('hidden');
    document.getElementById('leccion-form-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function limpiarFormularioLeccion() {
    leccionEditandoId = null;
    document.getElementById('leccion-form-titulo').textContent = "Agregar nueva lección";
    document.getElementById('leccion-titulo').value = '';
    document.getElementById('leccion-url').value = '';
    document.getElementById('leccion-categoria').value = 'putt';
    document.getElementById('leccion-nivel').value = 'principiante';
    document.getElementById('leccion-descripcion').value = '';
    actualizarPreviewLeccion();
    document.getElementById('btnCancelarEdicionLeccion').classList.add('hidden');
}

// Vista previa en vivo: al pegar la URL, el admin ve de inmediato si el video se reconoció bien.
function actualizarPreviewLeccion() {
    const url = document.getElementById('leccion-url')?.value || '';
    const preview = document.getElementById('leccion-preview');
    const status = document.getElementById('leccion-url-status');
    if (!preview || !status) return;

    const id = extraerYoutubeId(url);
    if (!url.trim()) {
        preview.classList.add('hidden');
        preview.innerHTML = '';
        status.textContent = '';
        return;
    }
    if (!id) {
        preview.classList.add('hidden');
        preview.innerHTML = '';
        status.textContent = '⚠️ No se reconoció un video de YouTube válido en ese enlace.';
        status.style.color = 'var(--rojo-alerta)';
        return;
    }
    status.textContent = `✅ Video detectado (ID: ${id})`;
    status.style.color = 'var(--verde-fairway)';
    preview.classList.remove('hidden');
    preview.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0" title="Vista previa" loading="lazy" allowfullscreen></iframe>`;
}
document.getElementById('leccion-url')?.addEventListener('input', actualizarPreviewLeccion);
document.getElementById('btnCancelarEdicionLeccion')?.addEventListener('click', limpiarFormularioLeccion);

document.getElementById('btnGuardarLeccion')?.addEventListener('click', async () => {
    const titulo = document.getElementById('leccion-titulo').value.trim();
    const url = document.getElementById('leccion-url').value.trim();
    const categoria = document.getElementById('leccion-categoria').value;
    const nivel = document.getElementById('leccion-nivel').value;
    const descripcion = document.getElementById('leccion-descripcion').value.trim();

    if (!titulo) {
        mostrarModal("Falta el título", "Ponle un título descriptivo a la lección.", "⚠️");
        return;
    }
    const youtubeId = extraerYoutubeId(url);
    if (!youtubeId) {
        mostrarModal("Enlace inválido", "Pega un enlace válido de YouTube (o el ID del video de 11 caracteres).", "⚠️");
        return;
    }

    const data = {
        titulo,
        youtube_id: youtubeId,
        categoria,
        nivel,
        descripcion,
        updated_at: serverTimestamp()
    };

    try {
        if (leccionEditandoId) {
            await updateDoc(doc(db, "lecciones", leccionEditandoId), data);
            mostrarModal("Lección Actualizada", "Los cambios se guardaron correctamente.", "✅");
        } else {
            data.created_at = serverTimestamp();
            await addDoc(collection(db, "lecciones"), data);
            mostrarModal("Lección Agregada", "Ya aparece en la Academia para todos los jugadores.", "🎓");
        }
        limpiarFormularioLeccion();
        cargarGestionAcademiaAdmin();
    } catch (e) {
        console.error("Error guardando lección:", e);
        mostrarModal("Error", "No se pudo guardar la lección.", "❌");
    }
});

// --- Enganche de navegación ---
// La función switchTab() original recorre el arreglo 'tabs' para mostrar/ocultar pestañas.
// Como 'academia' no está en ese arreglo, aquí registramos el listener del botón por separado
// y llamamos a switchTab('academia') -- que funciona igual porque busca los IDs por convención
// (tab-academia / content-academia). Después cargamos el contenido.
document.getElementById('tab-academia')?.addEventListener('click', () => {
    // Ocultamos manualmente el resto de pestañas conocidas para que no queden dos visibles.
    ['torneos','apuestas','ranking','perfil','reglas','catalogo','admin'].forEach(t => {
        document.getElementById(`tab-${t}`)?.classList.remove('active');
        document.getElementById(`content-${t}`)?.classList.add('hidden');
    });
    document.getElementById('tab-academia')?.classList.add('active');
    document.getElementById('content-academia')?.classList.remove('hidden');
    cargarAcademia();
    // Cierra el menú lateral en móvil, igual que hacen las demás pestañas.
    document.getElementById('main-nav-tabs')?.classList.remove('open');
    document.getElementById('btnHamburger')?.classList.remove('open');
    document.getElementById('mobileMenuOverlay')?.classList.remove('visible');
});

// Cuando el usuario navega a CUALQUIER otra pestaña, ocultamos Academia.
// (switchTab original no la conoce, así que lo cubrimos aquí.)
['torneos','apuestas','ranking','perfil','reglas','catalogo','admin'].forEach(t => {
    document.getElementById(`tab-${t}`)?.addEventListener('click', () => {
        document.getElementById('tab-academia')?.classList.remove('active');
        document.getElementById('content-academia')?.classList.add('hidden');
    });
});

// El panel Admin carga su sección de Academia al abrirse.
document.getElementById('tab-admin')?.addEventListener('click', () => {
    if (auth.currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        cargarGestionAcademiaAdmin();
    }
});

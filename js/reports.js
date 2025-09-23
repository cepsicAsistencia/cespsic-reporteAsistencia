// Variables globales
let isAuthenticated = false;
let currentUser = null;
let attendanceData = [];
let pdfBlob = null;

// CONFIGURACIÓN
const GOOGLE_CLIENT_ID = '799841037062-kal4vump3frc2f8d33bnp4clc9amdnng.apps.googleusercontent.com';
const SHEET_ID = '146Q1MG0AUCnzacqrN5kBENRuiql8o07Uts-l_gimL2I';

// IMPORTANTE: URL del Google Apps Script deployment
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzhkh8KZSA3BWEi01lgC6Bpwm2Gyfufy5_npN9N2ajY_u5-h6T180TsS0jI7M5l_h0/exec';

// Usuarios autorizados para generar reportes
const AUTHORIZED_USERS = [
    'jose.lino.flores.madrigal@gmail.com',
    'CEPSIC.atencionpsicologica@gmail.com',
    'adilene.example@gmail.com' // REEMPLAZAR con el email completo de Adilene
];

// Mapeo de columnas de Google Sheets
const COLUMN_MAPPING = {
    N: 'nombre',
    O: 'apellido_paterno', 
    P: 'apellido_materno',
    Q: 'tipo_estudiante',
    R: 'modalidad',
    S: 'fecha',
    T: 'hora',
    U: 'tipo_registro',
    X: 'intervenciones_psicologicas',
    Y: 'ninos_ninas',
    Z: 'adolescentes',
    AA: 'adultos',
    AB: 'mayores_60',
    AC: 'familia',
    AD: 'actividades_realizadas',
    AE: 'actividades_varias_detalle',
    AF: 'pruebas_psicologicas_detalle',
    AG: 'comentarios_adicionales',
    AH: 'total_evidencias',
    V: 'permiso_detalle',
    W: 'otro_detalle'
};

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DOM CARGADO ===');
    console.log('Fecha/hora:', new Date().toISOString());
    console.log('URL actual:', window.location.href);
    console.log('User Agent:', navigator.userAgent);
    
    // Verificar elementos del DOM
    const container = document.getElementById('signin-button-container');
    console.log('Contenedor de botón encontrado:', container ? 'SÍ' : 'NO');
    if (container) {
        console.log('Contenedor HTML inicial:', container.innerHTML);
    }
    
    initializeApp();
});

function initializeApp() {
    console.log('=== INICIANDO APLICACIÓN CESPSIC REPORTES v.1.0.13 ===');
    console.log('NOTA: Esta versión usa datos de ejemplo para demostración');
    console.log('Para conectar datos reales, se necesita resolver problemas de CORS con Google Apps Script');
    
    // Verificar scripts inmediatamente
    console.log('Estado de Google:', typeof google);
    if (typeof google !== 'undefined') {
        console.log('Google object existe');
        console.log('Google.accounts:', typeof google.accounts);
        if (google.accounts) {
            console.log('Google.accounts.id:', typeof google.accounts.id);
        }
    }
    
    // Verificar si el elemento contenedor existe
    const container = document.getElementById('signin-button-container');
    if (!container) {
        console.error('ERROR: Contenedor signin-button-container no encontrado');
        return;
    } else {
        console.log('Contenedor de autenticación encontrado');
    }
    
    // Mostrar mensaje temporal en el contenedor
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Cargando sistema de autenticación...</div>';
    
    loadGoogleSignInScript();
    setupEventListeners();
    setMaxDate();
    
    // Verificar navegador
    if (!isGoogleChrome()) {
        showStatus('Este sistema funciona mejor en Google Chrome. Algunas funciones podrían no estar disponibles.', 'error');
    }
    
    // Mostrar estado de configuración
    console.log('Client ID configurado:', GOOGLE_CLIENT_ID ? 'Sí' : 'No');
    console.log('Script URL configurado:', GOOGLE_SCRIPT_URL !== 'REEMPLAZAR_CON_TU_SCRIPT_URL' ? 'Sí' : 'No');
    console.log('Usuarios autorizados:', AUTHORIZED_USERS.length);
    
    // Timeout de seguridad - si después de 15 segundos no hay botón, mostrar alternativa
    setTimeout(() => {
        const container = document.getElementById('signin-button-container');
        if (container && container.innerHTML.includes('Cargando sistema')) {
            console.error('TIMEOUT: Google Sign-In no se cargó en 15 segundos');
            showFallbackButton();
        }
    }, 15000);
}

function isGoogleChrome() {
    const isChromium = window.chrome;
    const winNav = window.navigator;
    const vendorName = winNav.vendor;
    const isOpera = typeof window.opr !== "undefined";
    const isIEedge = winNav.userAgent.indexOf("Edg") > -1;
    const isIOSChrome = winNav.userAgent.match("CriOS");

    if (isIOSChrome) {
        return true;
    } else if (
        isChromium !== null &&
        typeof isChromium !== "undefined" &&
        vendorName === "Google Inc." &&
        isOpera === false &&
        isIEedge === false
    ) {
        return true;
    } else { 
        return false;
    }
}

function setMaxDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fecha_hasta').max = today;
}

function setupEventListeners() {
    // Validar fechas
    document.getElementById('fecha_desde').addEventListener('change', validateDates);
    document.getElementById('fecha_hasta').addEventListener('change', validateDates);
    
    // Manejar envío del formulario
    document.getElementById('reportForm').addEventListener('submit', handleFormSubmit);
}

function validateDates() {
    const fechaDesde = document.getElementById('fecha_desde').value;
    const fechaHasta = document.getElementById('fecha_hasta').value;
    const today = new Date().toISOString().split('T')[0];
    
    if (fechaHasta > today) {
        showStatus('La fecha hasta no puede ser mayor al día actual.', 'error');
        document.getElementById('fecha_hasta').value = today;
        return false;
    }
    
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
        showStatus('La fecha desde no puede ser mayor a la fecha hasta.', 'error');
        document.getElementById('fecha_desde').value = fechaHasta;
        return false;
    }
    
    hideStatus();
    return true;
}

// ========== GOOGLE SIGN-IN FUNCTIONS ==========

function loadGoogleSignInScript() {
    console.log('Intentando cargar Google Sign-In...');
    console.log('Verificando disponibilidad de Google API...');
    
    // Contador para intentos
    let attempts = 0;
    const maxAttempts = 20; // 10 segundos máximo
    
    function checkGoogleAPI() {
        attempts++;
        console.log(`Intento ${attempts}/${maxAttempts} - Verificando Google API...`);
        
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            console.log('Google Sign-In API disponible');
            initializeGoogleSignIn();
        } else if (attempts < maxAttempts) {
            console.log('Google API no disponible aún, reintentando...');
            setTimeout(checkGoogleAPI, 500);
        } else {
            console.error('Google Sign-In API no se pudo cargar después de', maxAttempts, 'intentos');
            showFallbackButton();
        }
    }
    
    checkGoogleAPI();
}

function showFallbackButton() {
    console.log('Mostrando botón de respaldo...');
    const container = document.getElementById("signin-button-container");
    
    container.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin-bottom: 15px; color: #856404;">
                ⚠️ No se pudo cargar el sistema de autenticación de Google.<br>
                Esto puede deberse a bloqueadores de anuncios o restricciones de red.
            </div>
            <button class="google-signin-btn" onclick="tryManualAuth()" style="margin: 10px;">
                🔄 Reintentar Autenticación
            </button>
            <button class="google-signin-btn" onclick="showAuthInstructions()" style="background: #17a2b8; margin: 10px;">
                ❓ Ver Instrucciones
            </button>
        </div>
    `;
}

function tryManualAuth() {
    console.log('Reintentando autenticación manual...');
    const container = document.getElementById("signin-button-container");
    container.innerHTML = '<div style="text-align: center; padding: 20px;">🔄 Reintentando cargar Google Sign-In...</div>';
    
    // Reiniciar el proceso
    setTimeout(() => {
        loadGoogleSignInScript();
    }, 1000);
}

function showAuthInstructions() {
    const container = document.getElementById("signin-button-container");
    container.innerHTML = `
        <div style="background: #e3f2fd; border: 1px solid #90caf9; border-radius: 8px; padding: 20px; text-align: left;">
            <h4 style="color: #1976d2; margin-bottom: 15px;">📋 Instrucciones para solucionar problemas de autenticación:</h4>
            <ol style="color: #666; line-height: 1.6;">
                <li><strong>Desactive bloqueadores de anuncios</strong> temporalmente</li>
                <li><strong>Use modo incógnito</strong> del navegador</li>
                <li><strong>Verifique su conexión a internet</strong></li>
                <li><strong>Intente con Google Chrome</strong> si usa otro navegador</li>
                <li><strong>Recargue completamente la página</strong> (Ctrl+F5)</li>
            </ol>
            <div style="text-align: center; margin-top: 15px;">
                <button class="google-signin-btn" onclick="location.reload()" style="background: #28a745;">
                    🔄 Recargar Página
                </button>
                <button class="google-signin-btn" onclick="tryManualAuth()" style="margin-left: 10px;">
                    🔙 Volver a Intentar
                </button>
            </div>
        </div>
    `;
}

function initializeGoogleSignIn() {
    try {
        console.log('Inicializando Google Sign-In...');
        
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });

        console.log('Renderizando botón de Google Sign-In...');
        
        // Limpiar contenedor primero
        const container = document.getElementById("signin-button-container");
        container.innerHTML = '';
        
        google.accounts.id.renderButton(
            container,
            {
                theme: "filled_blue",        // Tema azul
                size: "large",               // Tamaño grande
                text: "signin_with",         // Texto "Sign in with Google"
                shape: "rectangular",        // Forma rectangular
                logo_alignment: "left",      // Logo a la izquierda
                width: "300",               // Ancho fijo
                locale: "es"                // Idioma español
            }
        );

        console.log('Google Sign-In inicializado correctamente');

    } catch (error) {
        console.error('Error inicializando Google Sign-In:', error);
        
        // Fallback: mostrar botón manual si Google Sign-In falla
        const container = document.getElementById("signin-button-container");
        container.innerHTML = `
            <button class="google-signin-btn" onclick="manualGoogleSignIn()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Iniciar Sesión Administrativa
            </button>
        `;
        
        showStatus('Error cargando sistema de autenticación. Intente recargar la página.', 'error');
    }
}

// Función manual para activar Google Sign-In si el botón automático falla
function manualGoogleSignIn() {
    try {
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.prompt();
        } else {
            showStatus('Google Sign-In no está disponible. Verifique su conexión a internet.', 'error');
        }
    } catch (error) {
        console.error('Error en sign-in manual:', error);
        showStatus('Error al intentar iniciar sesión con Google.', 'error');
    }
}

function handleCredentialResponse(response) {
    try {
        const userInfo = parseJwt(response.credential);
        
        // Verificar que el email esté en la lista de autorizados
        if (!AUTHORIZED_USERS.includes(userInfo.email)) {
            showStatus(`Acceso denegado. El email ${userInfo.email} no está autorizado para generar reportes.`, 'error');
            return;
        }
        
        currentUser = {
            id: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            email_verified: userInfo.email_verified
        };

        if (!currentUser.email_verified) {
            showStatus('Su cuenta de Gmail no está verificada. Use una cuenta verificada.', 'error');
            return;
        }

        isAuthenticated = true;
        updateAuthenticationUI();
        enableForm();

        showStatus(`Bienvenido ${currentUser.name}! Acceso autorizado para generar reportes.`, 'success');
        setTimeout(() => hideStatus(), 3000);

    } catch (error) {
        console.error('Error procesando credenciales:', error);
        showStatus('Error en la autenticación. Intente nuevamente.', 'error');
    }
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error parsing JWT:', error);
        return null;
    }
}

function updateAuthenticationUI() {
    const authSection = document.getElementById('auth-section');
    const authTitle = document.getElementById('auth-title');
    const userInfo = document.getElementById('user-info');
    const signinContainer = document.getElementById('signin-button-container');

    if (isAuthenticated && currentUser) {
        authSection.classList.add('authenticated');
        authTitle.textContent = '✅ Acceso Autorizado';
        authTitle.classList.add('authenticated');

        document.getElementById('user-avatar').src = currentUser.picture;
        document.getElementById('user-email').textContent = currentUser.email;
        document.getElementById('user-name').textContent = currentUser.name;
        userInfo.classList.add('show');

        signinContainer.style.display = 'none';
    } else {
        authSection.classList.remove('authenticated');
        authTitle.textContent = '🔒 Autenticación Administrativa Requerida';
        authTitle.classList.remove('authenticated');
        userInfo.classList.remove('show');
        signinContainer.style.display = 'block';
    }
}

function enableForm() {
    const formContainer = document.getElementById('form-container');
    formContainer.classList.add('authenticated');
    updateSubmitButton();
    
    // Solo validar backend si la URL está configurada
    if (GOOGLE_SCRIPT_URL !== 'REEMPLAZAR_CON_TU_SCRIPT_URL') {
        validateBackendAccess();
    } else {
        console.warn('⚠️ Backend no configurado. Actualizar GOOGLE_SCRIPT_URL en script.js');
        showStatus('Advertencia: Sistema backend no configurado. Contacte al administrador.', 'error');
    }
}

// Función para validar acceso al backend
async function validateBackendAccess() {
    try {
        console.log('🔗 Validando conexión con backend...');
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'validate_sheet_access',
                userEmail: currentUser.email,
                timestamp: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Acceso al backend validado:', result);
            showStatus('Conexión con sistema backend verificada correctamente.', 'success');
            setTimeout(() => hideStatus(), 3000);
        } else {
            console.error('❌ Error validando backend:', result.message);
            showStatus('Error de conexión con el sistema backend: ' + result.message, 'error');
        }
        
    } catch (error) {
        console.error('Error validando backend:', error);
        showStatus('No se pudo conectar con el sistema backend. Verifique la configuración.', 'error');
    }
}

function disableForm() {
    const formContainer = document.getElementById('form-container');
    formContainer.classList.remove('authenticated');
    updateSubmitButton();
}

function updateSubmitButton() {
    const submitBtn = document.getElementById('submit_btn');
    
    if (!isAuthenticated) {
        submitBtn.disabled = true;
        submitBtn.textContent = '🔒 Autentíquese primero para generar reporte';
    } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '📋 Generar Reporte PDF';
    }
}

function signOut() {
    try {
        google.accounts.id.disableAutoSelect();
        
        isAuthenticated = false;
        currentUser = null;
        attendanceData = [];
        pdfBlob = null;

        updateAuthenticationUI();
        disableForm();
        closeModal();

        showStatus('Sesión cerrada correctamente.', 'success');
        setTimeout(() => hideStatus(), 3000);

        setTimeout(() => {
            initializeGoogleSignIn();
        }, 1000);

    } catch (error) {
        console.error('Error cerrando sesión:', error);
        showStatus('Error al cerrar sesión.', 'error');
    }
}

// ========== FORM HANDLING ==========

async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!isAuthenticated || !currentUser) {
        showStatus('Debe autenticarse antes de generar reportes.', 'error');
        return;
    }
    
    if (!validateDates()) {
        return;
    }
    
    const fechaDesde = document.getElementById('fecha_desde').value;
    const fechaHasta = document.getElementById('fecha_hasta').value;
    
    if (!fechaDesde || !fechaHasta) {
        showStatus('Por favor, seleccione ambas fechas.', 'error');
        return;
    }
    
    showStatus('Obteniendo datos de asistencia...', 'loading');
    const submitBtn = document.getElementById('submit_btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generando reporte...';
    
    try {
        // Obtener datos de Google Sheets
        await fetchAttendanceData(fechaDesde, fechaHasta);
        
        if (attendanceData.length === 0) {
            showStatus('No se encontraron registros en el rango de fechas seleccionado.', 'error');
            updateSubmitButton();
            return;
        }
        
        showStatus(`Generando PDF con ${attendanceData.length} registros...`, 'loading');
        
        // Generar PDF
        await generatePDF(fechaDesde, fechaHasta);
        
        // Mostrar modal de descarga
        showDownloadModal(fechaDesde, fechaHasta);
        
        hideStatus();
        updateSubmitButton();
        
    } catch (error) {
        console.error('Error generando reporte:', error);
        showStatus('Error al generar el reporte: ' + error.message, 'error');
        updateSubmitButton();
    }
}

// ========== GOOGLE SHEETS DATA FETCHING ==========

// ========== DATA FETCHING ==========

async function fetchAttendanceData(fechaDesde, fechaHasta) {
    try {
        console.log('=== GENERANDO DATOS DE EJEMPLO PARA REPORTE ===');
        console.log('Rango de fechas:', fechaDesde, 'al', fechaHasta);
        console.log('Nota: Se están usando datos de ejemplo para demostración');
        
        // Simular delay de procesamiento
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Generar datos de ejemplo
        attendanceData = generateSampleData(fechaDesde, fechaHasta);
        
        console.log(`Datos generados: ${attendanceData.length} registros de ejemplo`);
        
        if (attendanceData.length === 0) {
            throw new Error('No se generaron registros para el rango de fechas seleccionado');
        }
        
    } catch (error) {
        console.error('Error generando datos:', error);
        throw new Error('No se pudieron generar los datos de ejemplo: ' + error.message);
    }
}

// Función para generar datos de ejemplo más realistas
function generateSampleData(fechaDesde, fechaHasta) {
    const tiposEstudiante = ['servicio_social', 'practicas_supervisadas', 'estancia_profesional'];
    const modalidades = ['presencial', 'virtual'];
    const tiposRegistro = ['entrada', 'salida', 'permiso'];
    const nombres = ['Juan', 'María', 'Carlos', 'Ana', 'Luis', 'Carmen', 'José', 'Patricia'];
    const apellidosP = ['Pérez', 'López', 'García', 'Martínez', 'González', 'Rodríguez', 'Hernández', 'Flores'];
    const apellidosM = ['Silva', 'Morales', 'Jiménez', 'Ruiz', 'Díaz', 'Torres', 'Vargas', 'Castro'];
    
    const sampleData = [];
    const fechaInicio = new Date(fechaDesde);
    const fechaFin = new Date(fechaHasta);
    const diasDiferencia = Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1;
    
    // Generar entre 3-8 registros de ejemplo
    const numRegistros = Math.min(Math.max(3, diasDiferencia), 8);
    
    for (let i = 0; i < numRegistros; i++) {
        // Fecha aleatoria dentro del rango
        const fechaRandom = new Date(fechaInicio.getTime() + Math.random() * (fechaFin.getTime() - fechaInicio.getTime()));
        const fechaStr = fechaRandom.toISOString().split('T')[0];
        
        const record = {
            nombre: nombres[Math.floor(Math.random() * nombres.length)],
            apellido_paterno: apellidosP[Math.floor(Math.random() * apellidosP.length)],
            apellido_materno: apellidosM[Math.floor(Math.random() * apellidosM.length)],
            tipo_estudiante: tiposEstudiante[Math.floor(Math.random() * tiposEstudiante.length)],
            modalidad: modalidades[Math.floor(Math.random() * modalidades.length)],
            fecha: fechaStr,
            hora: i % 2 === 0 ? '08:00' : '14:30',
            tipo_registro: tiposRegistro[Math.floor(Math.random() * tiposRegistro.length)],
            intervenciones_psicologicas: String(Math.floor(Math.random() * 5) + 1),
            ninos_ninas: String(Math.floor(Math.random() * 3)),
            adolescentes: String(Math.floor(Math.random() * 3)),
            adultos: String(Math.floor(Math.random() * 3)),
            mayores_60: String(Math.floor(Math.random() * 2)),
            familia: String(Math.floor(Math.random() * 2)),
            actividades_realizadas: 'Entrevista psicológica, Aplicación de pruebas, Sesiones terapéuticas',
            actividades_varias_detalle: '',
            pruebas_psicologicas_detalle: 'MMPI-2, WAIS-IV, Bender',
            total_evidencias: String(Math.floor(Math.random() * 4)),
            comentarios_adicionales: `Registro de ejemplo ${i + 1} - Datos generados automáticamente para demostración`,
            permiso_detalle: '',
            otro_detalle: ''
        };
        
        sampleData.push(record);
    }
    
    // Aplicar filtros si los hay
    const filtroTipo = document.getElementById('filtro_tipo').value;
    const filtroModalidad = document.getElementById('filtro_modalidad').value;
    
    return sampleData.filter(record => {
        if (filtroTipo && record.tipo_estudiante !== filtroTipo) return false;
        if (filtroModalidad && record.modalidad !== filtroModalidad) return false;
        return true;
    });
}

// ========== PDF GENERATION ==========

async function generatePDF(fechaDesde, fechaHasta) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape para más espacio
    
    // Configurar fuentes
    doc.setFont('helvetica');
    
    // Encabezado
    addPDFHeader(doc, fechaDesde, fechaHasta);
    
    // Preparar datos para tabla
    const tableData = prepareTableData();
    
    // Crear tabla con autoTable
    doc.autoTable({
        head: [getTableHeaders()],
        body: tableData,
        startY: 40,
        styles: {
            fontSize: 8,
            cellPadding: 2
        },
        headStyles: {
            fillColor: [102, 126, 234],
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [248, 249, 250]
        },
        columnStyles: {
            0: { cellWidth: 35 }, // Nombre completo
            1: { cellWidth: 25 }, // Tipo estudiante
            2: { cellWidth: 20 }, // Modalidad
            3: { cellWidth: 18 }, // Fecha
            4: { cellWidth: 15 }, // Hora
            5: { cellWidth: 20 }  // Tipo registro
        }
    });
    
    // Pie de página
    addPDFFooter(doc);
    
    // Guardar como blob
    pdfBlob = doc.output('blob');
}

function addPDFHeader(doc, fechaDesde, fechaHasta) {
    // Título
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE ASISTENCIAS - CESPSIC', 148, 15, { align: 'center' });
    
    // Subtítulo
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${fechaDesde} al ${fechaHasta}`, 148, 25, { align: 'center' });
    
    // Información adicional
    doc.setFontSize(10);
    doc.text(`Generado por: ${currentUser.name} (${currentUser.email})`, 10, 32);
    doc.text(`Fecha de generación: ${new Date().toLocaleString('es-MX')}`, 200, 32);
    doc.text(`Total de registros: ${attendanceData.length}`, 10, 37);
}

function addPDFFooter(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
            `Página ${i} de ${pageCount} - Centro de Servicios Psicológicos (CESPSIC)`,
            148,
            205,
            { align: 'center' }
        );
    }
}

function getTableHeaders() {
    const incluirCampos = getSelectedFields();
    const headers = ['Nombre Completo', 'Tipo Estudiante', 'Modalidad', 'Fecha', 'Hora', 'Tipo Registro'];
    
    if (incluirCampos.includes('intervenciones')) {
        headers.push('Intervenciones', 'Niños', 'Adolescentes', 'Adultos', 'Mayores 60', 'Familia');
    }
    
    if (incluirCampos.includes('actividades')) {
        headers.push('Actividades');
    }
    
    if (incluirCampos.includes('evidencias')) {
        headers.push('Evidencias');
    }
    
    if (incluirCampos.includes('comentarios')) {
        headers.push('Comentarios');
    }
    
    if (incluirCampos.includes('permisos')) {
        headers.push('Detalle Permiso', 'Detalle Otro');
    }
    
    return headers;
}

function prepareTableData() {
    const incluirCampos = getSelectedFields();
    
    return attendanceData.map(record => {
        const nombreCompleto = `${record.nombre} ${record.apellido_paterno} ${record.apellido_materno}`.trim();
        
        const row = [
            nombreCompleto,
            record.tipo_estudiante || '',
            record.modalidad || '',
            record.fecha || '',
            record.hora || '',
            record.tipo_registro || ''
        ];
        
        if (incluirCampos.includes('intervenciones')) {
            row.push(
                record.intervenciones_psicologicas || '0',
                record.ninos_ninas || '0',
                record.adolescentes || '0',
                record.adultos || '0',
                record.mayores_60 || '0',
                record.familia || '0'
            );
        }
        
        if (incluirCampos.includes('actividades')) {
            let actividades = record.actividades_realizadas || '';
            if (record.actividades_varias_detalle) {
                actividades += (actividades ? ' | ' : '') + record.actividades_varias_detalle;
            }
            if (record.pruebas_psicologicas_detalle) {
                actividades += (actividades ? ' | ' : '') + record.pruebas_psicologicas_detalle;
            }
            row.push(actividades);
        }
        
        if (incluirCampos.includes('evidencias')) {
            row.push(record.total_evidencias || '0');
        }
        
        if (incluirCampos.includes('comentarios')) {
            row.push(record.comentarios_adicionales || '');
        }
        
        if (incluirCampos.includes('permisos')) {
            row.push(
                record.permiso_detalle || '',
                record.otro_detalle || ''
            );
        }
        
        return row;
    });
}

function getSelectedFields() {
    const checkboxes = document.querySelectorAll('input[name="incluir_campos[]"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// ========== MODAL FUNCTIONS ==========

function showDownloadModal(fechaDesde, fechaHasta) {
    const modal = document.getElementById('modal-overlay');
    const reportInfo = document.getElementById('report-info');
    
    const incluirCampos = getSelectedFields();
    const filtroTipo = document.getElementById('filtro_tipo').value;
    const filtroModalidad = document.getElementById('filtro_modalidad').value;
    
    reportInfo.innerHTML = `
        <h4>📊 Resumen del Reporte</h4>
        <p><strong>Período:</strong> ${fechaDesde} al ${fechaHasta}</p>
        <p><strong>Total de registros:</strong> ${attendanceData.length}</p>
        <p><strong>Campos incluidos:</strong> ${incluirCampos.join(', ')}</p>
        ${filtroTipo ? `<p><strong>Filtro tipo:</strong> ${filtroTipo}</p>` : ''}
        ${filtroModalidad ? `<p><strong>Filtro modalidad:</strong> ${filtroModalidad}</p>` : ''}
        <p><strong>Generado por:</strong> ${currentUser.name}</p>
        <p><strong>Fecha generación:</strong> ${new Date().toLocaleString('es-MX')}</p>
    `;
    
    // Configurar botón de descarga
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.onclick = downloadPDF;
    
    modal.classList.add('show');
}

function closeModal() {
    const modal = document.getElementById('modal-overlay');
    modal.classList.remove('show');
}

function downloadPDF() {
    if (pdfBlob) {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Asistencias_CESPSIC_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showStatus('Reporte descargado exitosamente.', 'success');
        setTimeout(() => {
            hideStatus();
            closeModal();
        }, 2000);
    }
}

// ========== UTILITY FUNCTIONS ==========

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.innerHTML = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
}

function hideStatus() {
    const status = document.getElementById('status');
    status.style.display = 'none';
}

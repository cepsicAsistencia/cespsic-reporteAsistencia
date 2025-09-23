// Variables globales
let isAuthenticated = false;
let currentUser = null;
let attendanceData = [];
let pdfBlob = null;
let accessToken = null; // Token para Google Sheets API

// CONFIGURACIÓN
const GOOGLE_CLIENT_ID = '799841037062-kal4vump3frc2f8d33bnp4clc9amdnng.apps.googleusercontent.com';
const SHEET_ID = '146Q1MG0AUCnzacqrN5kBENRuiql8o07Uts-l_gimL2I';

// URL del Google Apps Script deployment
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzWGVu6YAKoUjaht6yFTqBL3uBOvg0ufg_TkmAT8R-JZ7cONZ-A3OXjVLbJ22fXzv0/exec';

// Usuarios autorizados para generar reportes
const AUTHORIZED_USERS = [
    'jose.lino.flores.madrigal@gmail.com',
    'CEPSIC.atencionpsicologica@gmail.com',
    'adilene.example@gmail.com'
];

// Scopes necesarios para Google Sheets
const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'profile',
    'email'
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
    
    initializeApp();
});

function initializeApp() {
    console.log('=== INICIANDO APLICACIÓN CESPSIC REPORTES v.1.0.23 ===');
    console.log('MODO: Datos reales desde Google Sheets con API v2');
    
    loadGoogleAPI();
    setupEventListeners();
    setMaxDate();
    
    if (!isGoogleChrome()) {
        showStatus('Este sistema funciona mejor en Google Chrome. Algunas funciones podrían no estar disponibles.', 'error');
    }
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
    const todayInCuliacan = new Date().toLocaleDateString('en-CA', {
        timeZone: 'America/Mazatlan'
    });
    
    document.getElementById('fecha_hasta').max = todayInCuliacan;
    document.getElementById('fecha_hasta').value = todayInCuliacan;
    
    const today = new Date(todayInCuliacan);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(today.getMonth() - 1);
    const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];
    document.getElementById('fecha_desde').value = oneMonthAgoStr;
    
    console.log('Fechas configuradas para zona horaria de Culiacán, Sinaloa');
}

function setupEventListeners() {
    document.getElementById('fecha_desde').addEventListener('change', validateDates);
    document.getElementById('fecha_hasta').addEventListener('change', validateDates);
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

// ========== GOOGLE API FUNCTIONS ==========

function loadGoogleAPI() {
    console.log('Cargando Google API...');
    
    const container = document.getElementById('signin-button-container');
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Cargando sistema de autenticación...</div>';
    
    let attempts = 0;
    const maxAttempts = 30;
    
    function checkGoogleAPI() {
        attempts++;
        console.log(`Intento ${attempts}/${maxAttempts} - Verificando Google API...`);
        
        if (typeof google !== 'undefined' && google.accounts) {
            console.log('Google API disponible');
            initializeGoogleAuth();
        } else if (attempts < maxAttempts) {
            setTimeout(checkGoogleAPI, 500);
        } else {
            console.error('Google API no se pudo cargar');
            showFallbackButton();
        }
    }
    
    checkGoogleAPI();
}

function initializeGoogleAuth() {
    try {
        console.log('Inicializando autenticación Google...');
        
        // Inicializar Google Identity Services
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });

        // Renderizar botón de sign-in
        const container = document.getElementById("signin-button-container");
        container.innerHTML = '';
        
        google.accounts.id.renderButton(
            container,
            {
                theme: "filled_blue",
                size: "large",
                text: "signin_with",
                shape: "rectangular",
                logo_alignment: "left",
                width: "300",
                locale: "es"
            }
        );

        console.log('Google Sign-In inicializado correctamente');

    } catch (error) {
        console.error('Error inicializando Google Sign-In:', error);
        showFallbackButton();
    }
}

function handleCredentialResponse(response) {
    try {
        const userInfo = parseJwt(response.credential);
        
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

        // Después de la autenticación básica, solicitar permisos de Google Sheets
        requestSheetsPermissions();

    } catch (error) {
        console.error('Error procesando credenciales:', error);
        showStatus('Error en la autenticación. Intente nuevamente.', 'error');
    }
}

function requestSheetsPermissions() {
    console.log('Solicitando permisos de Google Sheets...');
    
    // Crear cliente OAuth2 para solicitar scopes adicionales
    const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES.join(' '),
        callback: handleTokenResponse,
        error_callback: handleTokenError
    });
    
    // Solicitar permisos
    client.requestAccessToken();
}

function handleTokenResponse(tokenResponse) {
    console.log('Token de acceso recibido:', tokenResponse);
    
    if (tokenResponse && tokenResponse.access_token) {
        accessToken = tokenResponse.access_token;
        isAuthenticated = true;
        
        updateAuthenticationUI();
        enableForm();
        
        showStatus(`¡Bienvenido ${currentUser.name}! Acceso completo autorizado para Google Sheets.`, 'success');
        setTimeout(() => hideStatus(), 3000);
        
        // Verificar acceso al sheet
        testSheetAccess();
    } else {
        showStatus('Error obteniendo permisos de Google Sheets', 'error');
    }
}

function handleTokenError(error) {
    console.error('Error obteniendo token:', error);
    showStatus('Error: Permisos de Google Sheets requeridos para continuar', 'error');
}

// Función para probar acceso al Google Sheet
async function testSheetAccess() {
    if (!accessToken) {
        console.error('No hay token de acceso');
        return;
    }
    
    try {
        console.log('Probando acceso directo a Google Sheets API...');
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Hoja%201!A1:AH1000`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Acceso directo a Google Sheets exitoso');
            console.log('Filas obtenidas:', data.values ? data.values.length : 0);
            showStatus('Conexión con Google Sheets verificada correctamente.', 'success');
            setTimeout(() => hideStatus(), 2000);
        } else {
            console.error('❌ Error accediendo a Google Sheets:', response.status, response.statusText);
            showStatus('Error accediendo a Google Sheets. Verifique permisos.', 'error');
        }
        
    } catch (error) {
        console.error('Error probando acceso al sheet:', error);
        showStatus('Error probando conexión con Google Sheets.', 'error');
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

function showFallbackButton() {
    console.log('Mostrando botón de respaldo...');
    const container = document.getElementById("signin-button-container");
    
    container.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin-bottom: 15px; color: #856404;">
                ⚠️ No se pudo cargar el sistema de autenticación de Google.<br>
                Esto puede deberse a bloqueadores de anuncios o restricciones de red.
            </div>
            <button class="google-signin-btn" onclick="location.reload()" style="background: #28a745;">
                🔄 Recargar Página
            </button>
        </div>
    `;
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
        if (google && google.accounts) {
            google.accounts.id.disableAutoSelect();
        }
        
        isAuthenticated = false;
        currentUser = null;
        attendanceData = [];
        pdfBlob = null;
        accessToken = null;

        updateAuthenticationUI();
        disableForm();
        closeModal();

        showStatus('Sesión cerrada correctamente.', 'success');
        setTimeout(() => hideStatus(), 3000);

        setTimeout(() => {
            initializeGoogleAuth();
        }, 1000);

    } catch (error) {
        console.error('Error cerrando sesión:', error);
        showStatus('Error al cerrar sesión.', 'error');
    }
}

// ========== FORM HANDLING ==========

async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!isAuthenticated || !currentUser || !accessToken) {
        showStatus('Debe autenticarse y autorizar acceso a Google Sheets antes de generar reportes.', 'error');
        return;
    }
    
    const fechaDesde = document.getElementById('fecha_desde').value;
    const fechaHasta = document.getElementById('fecha_hasta').value;
    
    if (!fechaDesde || !fechaHasta) {
        showStatus('Por favor, seleccione ambas fechas (desde y hasta).', 'error');
        return;
    }
    
    if (!validateDates()) {
        return;
    }
    
    const checkboxes = document.querySelectorAll('input[name="incluir_campos[]"]:checked');
    if (checkboxes.length === 0) {
        showStatus('Debe seleccionar al menos un campo para incluir en el reporte.', 'error');
        return;
    }
    
    showStatus('Obteniendo datos de Google Sheets...', 'loading');
    const submitBtn = document.getElementById('submit_btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Obteniendo datos...';
    
    try {
        await fetchAttendanceDataDirect(fechaDesde, fechaHasta);
        
        if (attendanceData.length === 0) {
            showStatus('No se encontraron registros en el rango de fechas seleccionado.', 'error');
            updateSubmitButton();
            return;
        }
        
        showStatus(`Generando PDF con ${attendanceData.length} registros...`, 'loading');
        submitBtn.textContent = 'Generando PDF...';
        
        await generatePDF(fechaDesde, fechaHasta);
        showDownloadModal(fechaDesde, fechaHasta);
        
        hideStatus();
        updateSubmitButton();
        
    } catch (error) {
        console.error('Error generando reporte:', error);
        showStatus('Error al generar el reporte: ' + error.message, 'error');
        updateSubmitButton();
    }
}

// ========== DATA FETCHING - ACCESO DIRECTO A GOOGLE SHEETS API ==========

async function fetchAttendanceDataDirect(fechaDesde, fechaHasta) {
    console.log('=== OBTENIENDO DATOS DIRECTAMENTE DE GOOGLE SHEETS API ===');
    
    if (!accessToken) {
        throw new Error('Token de acceso no disponible');
    }
    
    try {
        // Obtener datos del sheet completo
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Hoja%201!A:AH`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`Error API Google Sheets: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (!result.values || result.values.length < 2) {
            console.log('No hay datos suficientes en el sheet');
            attendanceData = [];
            return;
        }
        
        console.log('Datos obtenidos del sheet:', result.values.length, 'filas');
        
        // Procesar datos
        attendanceData = processSheetData(result.values, fechaDesde, fechaHasta);
        console.log('Datos procesados:', attendanceData.length, 'registros');
        
    } catch (error) {
        console.error('Error accediendo a Google Sheets API:', error);
        throw error;
    }
}

function processSheetData(rows, fechaDesde, fechaHasta) {
    const data = [];
    
    // Saltar la primera fila (encabezados)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        try {
            // Mapear columnas según COLUMN_MAPPING
            const record = {
                nombre: row[13] || '',           // Columna N (índice 13)
                apellido_paterno: row[14] || '', // Columna O (índice 14)
                apellido_materno: row[15] || '', // Columna P (índice 15)
                tipo_estudiante: row[16] || '',  // Columna Q (índice 16)
                modalidad: row[17] || '',        // Columna R (índice 17)
                fecha: row[18] || '',            // Columna S (índice 18)
                hora: row[19] || '',             // Columna T (índice 19)
                tipo_registro: row[20] || '',    // Columna U (índice 20)
                intervenciones_psicologicas: row[23] || '0', // Columna X (índice 23)
                ninos_ninas: row[24] || '0',     // Columna Y (índice 24)
                adolescentes: row[25] || '0',    // Columna Z (índice 25)
                adultos: row[26] || '0',         // Columna AA (índice 26)
                mayores_60: row[27] || '0',      // Columna AB (índice 27)
                familia: row[28] || '0',         // Columna AC (índice 28)
                actividades_realizadas: row[29] || '', // Columna AD (índice 29)
                actividades_varias_detalle: row[30] || '', // Columna AE (índice 30)
                pruebas_psicologicas_detalle: row[31] || '', // Columna AF (índice 31)
                comentarios_adicionales: row[32] || '', // Columna AG (índice 32)
                total_evidencias: row[33] || '0', // Columna AH (índice 33)
                permiso_detalle: row[21] || '',  // Columna V (índice 21)
                otro_detalle: row[22] || ''      // Columna W (índice 22)
            };
            
            // Verificar si el registro está en el rango de fechas
            if (isDateInRange(record.fecha, fechaDesde, fechaHasta)) {
                // Aplicar filtros adicionales
                if (shouldIncludeRecord(record)) {
                    data.push(record);
                }
            }
            
        } catch (parseError) {
            console.warn('Error procesando fila', i, ':', parseError);
        }
    }
    
    return data;
}

function isDateInRange(dateStr, fechaDesde, fechaHasta) {
    if (!dateStr) return false;
    
    try {
        let recordDate;
        
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                // Asumir DD/MM/YYYY (formato común en México)
                recordDate = new Date(parts[2], parts[1] - 1, parts[0]);
            }
        } else if (dateStr.includes('-')) {
            recordDate = new Date(dateStr);
        } else {
            return false;
        }
        
        if (isNaN(recordDate.getTime())) return false;
        
        const desde = new Date(fechaDesde);
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        
        return recordDate >= desde && recordDate <= hasta;
        
    } catch (error) {
        console.warn('Error parseando fecha:', dateStr, error);
        return false;
    }
}

function shouldIncludeRecord(record) {
    const filtroTipo = document.getElementById('filtro_tipo').value;
    const filtroModalidad = document.getElementById('filtro_modalidad').value;
    
    if (filtroTipo && record.tipo_estudiante !== filtroTipo) {
        return false;
    }
    
    if (filtroModalidad && record.modalidad !== filtroModalidad) {
        return false;
    }
    
    return true;
}

// ========== PDF GENERATION ==========

async function generatePDF(fechaDesde, fechaHasta) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    
    doc.setFont('helvetica');
    
    addPDFHeader(doc, fechaDesde, fechaHasta);
    const tableData = prepareTableData();
    
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
            0: { cellWidth: 35 },
            1: { cellWidth: 25 },
            2: { cellWidth: 20 },
            3: { cellWidth: 18 },
            4: { cellWidth: 15 },
            5: { cellWidth: 20 }
        }
    });
    
    addPDFFooter(doc);
    pdfBlob = doc.output('blob');
}

function addPDFHeader(doc, fechaDesde, fechaHasta) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE ASISTENCIAS - CESPSIC', 148, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${fechaDesde} al ${fechaHasta}`, 148, 25, { align: 'center' });
    
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

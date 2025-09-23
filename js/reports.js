// Variables globales
let isAuthenticated = false;
let currentUser = null;
let attendanceData = [];
let pdfBlob = null;

// CONFIGURACIÓN
const GOOGLE_CLIENT_ID = '799841037062-kal4vump3frc2f8d33bnp4clc9amdnng.apps.googleusercontent.com';
const SHEET_ID = '146Q1MG0AUCnzacqrN5kBENRuiql8o07Uts-l_gimL2I';

// URL del Google Apps Script deployment - ACTUALIZADA
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyN49EgjqFoE4Gwos_gnu5lM5XERnGfKejEcI-eVuxb68EgJ4wes2DAorINEZ9xVCI/exec';

// Usuarios autorizados para generar reportes
const AUTHORIZED_USERS = [
    'jose.lino.flores.madrigal@gmail.com',
    'CEPSIC.atencionpsicologica@gmail.com',
    'adilene.example@gmail.com' // REEMPLAZAR con el email completo de Adilene
];

// Estado de autenticación
let authenticationAttempts = 0;
const MAX_AUTH_ATTEMPTS = 3;

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DOM CARGADO ===');
    console.log('CESPSIC Reportes v.2.0 - Autenticación mejorada');
    console.log('Fecha/hora:', new Date().toISOString());
    
    initializeApp();
});

function initializeApp() {
    console.log('=== INICIANDO APLICACIÓN CESPSIC REPORTES v.2.0 ===');
    console.log('MODO: Datos reales desde Google Sheets con permisos corregidos');
    
    // Verificar contenedor
    const container = document.getElementById('signin-button-container');
    if (!container) {
        console.error('ERROR: Contenedor signin-button-container no encontrado');
        return;
    }
    
    // Mostrar mensaje de carga
    showLoadingMessage('Iniciando sistema de autenticación...');
    
    // Configurar eventos y fechas
    setupEventListeners();
    setMaxDate();
    
    // Inicializar Google Sign-In con timeout
    initializeGoogleSignInWithRetry();
    
    // Verificar configuración
    console.log('Configuración:');
    console.log('- Client ID:', GOOGLE_CLIENT_ID ? 'Configurado' : 'NO CONFIGURADO');
    console.log('- Script URL:', GOOGLE_SCRIPT_URL ? 'Configurado' : 'NO CONFIGURADO');
    console.log('- Usuarios autorizados:', AUTHORIZED_USERS.length);
}

function showLoadingMessage(message) {
    const container = document.getElementById('signin-button-container');
    container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666;">
            <div style="display: inline-block; animation: spin 1s linear infinite; margin-right: 10px;">🔄</div>
            ${message}
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
}

function initializeGoogleSignInWithRetry() {
    let attempts = 0;
    const maxAttempts = 15;
    
    function tryInitialize() {
        attempts++;
        console.log(`Intento ${attempts}/${maxAttempts} - Inicializando Google Sign-In...`);
        
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            console.log('✅ Google Sign-In API disponible');
            initializeGoogleSignIn();
        } else if (attempts < maxAttempts) {
            console.log('⏳ Google API no disponible, reintentando...');
            setTimeout(tryInitialize, 1000);
        } else {
            console.error('❌ Google Sign-In no se pudo cargar');
            showAuthenticationError('No se pudo cargar el sistema de autenticación de Google');
        }
    }
    
    tryInitialize();
}

function initializeGoogleSignIn() {
    try {
        console.log('🔐 Configurando Google Sign-In...');
        
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
            use_fedcm_for_prompt: false // Evitar doble autenticación
        });

        const container = document.getElementById("signin-button-container");
        
        // Limpiar contenedor
        container.innerHTML = '';
        
        // Renderizar botón
        google.accounts.id.renderButton(container, {
            theme: "filled_blue",
            size: "large",
            text: "signin_with",
            shape: "rectangular",
            logo_alignment: "left",
            width: "280",
            locale: "es"
        });

        console.log('✅ Google Sign-In inicializado correctamente');
        
        // Verificar backend después de la inicialización
        setTimeout(checkBackendAvailability, 2000);

    } catch (error) {
        console.error('❌ Error inicializando Google Sign-In:', error);
        showAuthenticationError('Error configurando sistema de autenticación: ' + error.message);
    }
}

async function checkBackendAvailability() {
    try {
        console.log('🔗 Verificando disponibilidad del backend...');
        
        const response = await fetchWithTimeout(GOOGLE_SCRIPT_URL + '?action=test_permissions', 10000);
        
        if (response.ok) {
            console.log('✅ Backend disponible');
            showStatus('Sistema listo para su uso', 'success');
            setTimeout(() => hideStatus(), 3000);
        } else {
            console.warn('⚠️ Backend no responde correctamente');
            showStatus('Advertencia: Conexión con backend limitada', 'error');
        }
        
    } catch (error) {
        console.warn('⚠️ No se pudo verificar backend:', error.message);
        showStatus('Advertencia: Verificación de backend falló', 'error');
    }
}

function handleCredentialResponse(response) {
    try {
        authenticationAttempts++;
        console.log(`🔐 Procesando autenticación (intento ${authenticationAttempts})...`);
        
        if (authenticationAttempts > MAX_AUTH_ATTEMPTS) {
            showStatus('Demasiados intentos de autenticación. Recargue la página.', 'error');
            return;
        }
        
        const userInfo = parseJwt(response.credential);
        
        if (!userInfo) {
            throw new Error('No se pudo procesar la información del usuario');
        }
        
        console.log('👤 Usuario detectado:', userInfo.email);
        
        // Verificar autorización
        if (!AUTHORIZED_USERS.includes(userInfo.email)) {
            showStatus(`❌ Acceso denegado. El email ${userInfo.email} no está autorizado.`, 'error');
            return;
        }
        
        // Verificar email verificado
        if (!userInfo.email_verified) {
            showStatus('❌ Cuenta no verificada. Use una cuenta de Gmail verificada.', 'error');
            return;
        }
        
        // Configurar usuario
        currentUser = {
            id: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            email_verified: userInfo.email_verified
        };

        isAuthenticated = true;
        
        console.log('✅ Autenticación exitosa para:', currentUser.name);
        
        // Actualizar UI
        updateAuthenticationUI();
        enableForm();
        
        // Probar permisos del backend
        setTimeout(() => testBackendPermissions(), 1000);
        
        showStatus(`Bienvenido ${currentUser.name}! Acceso autorizado.`, 'success');
        setTimeout(() => hideStatus(), 4000);

    } catch (error) {
        console.error('❌ Error procesando credenciales:', error);
        showStatus('Error en la autenticación: ' + error.message, 'error');
    }
}

async function testBackendPermissions() {
    try {
        console.log('🔍 Probando permisos del backend...');
        showStatus('Verificando permisos del sistema...', 'loading');
        
        const testResult = await makeBackendRequest('test_permissions', {});
        
        if (testResult.success) {
            console.log('✅ Prueba de permisos exitosa');
            const failedTests = Object.values(testResult.tests || {}).filter(test => !test.success);
            
            if (failedTests.length === 0) {
                showStatus('Sistema completamente funcional', 'success');
            } else {
                console.warn('⚠️ Algunas pruebas fallaron:', failedTests);
                showStatus(`Advertencia: ${failedTests.length} componentes con problemas`, 'error');
            }
        } else {
            console.error('❌ Prueba de permisos falló:', testResult.message);
            showStatus('Error en permisos: ' + testResult.message, 'error');
        }
        
        setTimeout(() => hideStatus(), 5000);
        
    } catch (error) {
        console.error('❌ Error probando permisos:', error);
        showStatus('No se pudieron verificar los permisos del sistema', 'error');
    }
}

async function makeBackendRequest(action, additionalData = {}) {
    const requestData = {
        action: action,
        userEmail: currentUser.email,
        timestamp: new Date().toISOString(),
        ...additionalData
    };
    
    console.log('📡 Enviando solicitud al backend:', action);
    
    // Intentar con JSONP primero
    try {
        const jsonpResponse = await fetchWithJSONP(GOOGLE_SCRIPT_URL, requestData);
        if (jsonpResponse && jsonpResponse.success !== undefined) {
            console.log('✅ Respuesta JSONP exitosa');
            return jsonpResponse;
        }
    } catch (jsonpError) {
        console.log('⚠️ JSONP falló:', jsonpError.message);
    }
    
    // Intentar con fetch POST
    try {
        const response = await fetchWithTimeout(GOOGLE_SCRIPT_URL, 30000, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Respuesta POST exitosa');
            return result;
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (fetchError) {
        console.log('⚠️ Fetch POST falló:', fetchError.message);
        throw new Error('No se pudo conectar con el servidor: ' + fetchError.message);
    }
}

async function fetchWithJSONP(url, data, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        
        const script = document.createElement('script');
        const params = new URLSearchParams({
            ...data,
            callback: callbackName
        });
        
        window[callbackName] = function(response) {
            cleanup();
            resolve(response);
        };
        
        function cleanup() {
            delete window[callbackName];
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        }
        
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('Timeout: No se recibió respuesta del servidor'));
        }, timeout);
        
        script.onload = () => clearTimeout(timeoutId);
        script.onerror = () => {
            cleanup();
            clearTimeout(timeoutId);
            reject(new Error('Error cargando script del servidor'));
        };
        
        script.src = `${url}?${params.toString()}`;
        document.head.appendChild(script);
    });
}

async function fetchWithTimeout(url, timeout = 10000, options = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
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

function showAuthenticationError(message) {
    const container = document.getElementById("signin-button-container");
    container.innerHTML = `
        <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; color: #721c24;">
            <strong>❌ Error de Autenticación</strong><br>
            ${message}
            <div style="margin-top: 15px;">
                <button onclick="location.reload()" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    🔄 Recargar Página
                </button>
            </div>
        </div>
    `;
}

function signOut() {
    try {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.disableAutoSelect();
        }
        
        isAuthenticated = false;
        currentUser = null;
        attendanceData = [];
        pdfBlob = null;
        authenticationAttempts = 0;

        updateAuthenticationUI();
        disableForm();
        closeModal();

        showStatus('Sesión cerrada correctamente.', 'success');
        setTimeout(() => {
            hideStatus();
            // Reinicializar después de cerrar sesión
            setTimeout(() => initializeGoogleSignIn(), 1000);
        }, 2000);

    } catch (error) {
        console.error('Error cerrando sesión:', error);
        showStatus('Error al cerrar sesión.', 'error');
    }
}

// ========== FORM HANDLING ==========

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
    
    console.log('Fechas configuradas para Culiacán, Sinaloa');
}

function setupEventListeners() {
    document.getElementById('fecha_desde').addEventListener('change', validateDates);
    document.getElementById('fecha_hasta').addEventListener('change', validateDates);
    document.getElementById('reportForm').addEventListener('submit', handleFormSubmit);
    
    // Agregar listeners para el comportamiento de checkboxes
    setupCheckboxListeners();
}

function setupCheckboxListeners() {
    // Listener para cuando se marcan otros checkboxes (desmarcar evidencias_solo)
    const otherCheckboxes = [
        'incluir_intervenciones', 
        'incluir_actividades', 
        'incluir_evidencias', 
        'incluir_comentarios', 
        'incluir_permisos'
    ];
    
    otherCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    // Si se marca cualquier otro checkbox, desmarcar evidencias_solo
                    const evidenciasSolo = document.getElementById('incluir_evidencias_solo');
                    if (evidenciasSolo.checked) {
                        evidenciasSolo.checked = false;
                        updateCheckboxStyles();
                    }
                }
            });
        }
    });
}

function handleEvidenciasChange(checkbox) {
    const isChecked = checkbox.checked;
    
    // Lista de checkboxes que se deben desmarcar cuando se marca "Solo Evidencias"
    const otherCheckboxes = [
        'incluir_intervenciones', 
        'incluir_actividades', 
        'incluir_evidencias', 
        'incluir_comentarios', 
        'incluir_permisos'
    ];
    
    if (isChecked) {
        // Desmarcar todos los otros checkboxes
        otherCheckboxes.forEach(id => {
            const cb = document.getElementById(id);
            if (cb) {
                cb.checked = false;
            }
        });
        
        // Mostrar mensaje informativo específico
        showStatus('Modo "Solo Evidencias de Salida" activado. Se filtrarán únicamente registros de SALIDA con links a documentos de la columna AI. Los links serán clickeables en el PDF.', 'loading');
        setTimeout(() => hideStatus(), 6000);
    }
    
    updateCheckboxStyles();
}

// Hacer la función disponible globalmente para el HTML
window.handleEvidenciasChange = handleEvidenciasChange;

function updateCheckboxStyles() {
    const evidenciasSolo = document.getElementById('incluir_evidencias_solo');
    const evidenciasItem = document.querySelector('.checkbox-evidencias');
    
    if (evidenciasSolo.checked) {
        evidenciasItem.style.background = '#e8f5e8';
        evidenciasItem.style.borderColor = '#4caf50';
        evidenciasItem.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.2)';
    } else {
        evidenciasItem.style.background = '';
        evidenciasItem.style.borderColor = '';
        evidenciasItem.style.boxShadow = '';
    }
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

async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!isAuthenticated || !currentUser) {
        showStatus('Debe autenticarse antes de generar reportes.', 'error');
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
    
    // Confirmar generación
    const selectedFields = Array.from(checkboxes).map(cb => cb.nextElementSibling.textContent.split('(')[0].trim());
    const filtroTipo = document.getElementById('filtro_tipo').value;
    const filtroModalidad = document.getElementById('filtro_modalidad').value;
    const incluirCampos = getSelectedFields();
    const isModoEvidencias = incluirCampos.includes('evidencias_solo');
    
    let confirmMessage = `¿Está seguro de que desea generar el reporte?

Período: ${fechaDesde} al ${fechaHasta}
Campos: ${selectedFields.join(', ')}`;
    
    if (isModoEvidencias) {
        confirmMessage += `\nModo: Solo evidencias de SALIDA`;
    }
    if (filtroTipo) confirmMessage += `\nTipo: ${filtroTipo}`;
    if (filtroModalidad) confirmMessage += `\nModalidad: ${filtroModalidad}`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    showStatus('Conectando con Google Sheets...', 'loading');
    const submitBtn = document.getElementById('submit_btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Conectando...';
    
    try {
        // Intentar obtener datos reales
        await fetchAttendanceData(fechaDesde, fechaHasta);
        
        // Verificar si hay datos después del filtrado
        if (!attendanceData || attendanceData.length === 0) {
            showStatus(
                isModoEvidencias 
                    ? 'No se encontraron registros de SALIDA con evidencias en el rango de fechas seleccionado. Intente ampliar el rango de fechas o verificar los filtros.'
                    : 'No se encontraron registros en el rango de fechas seleccionado. Intente ampliar el rango de fechas o verificar los filtros.',
                'error'
            );
            updateSubmitButton();
            return;
        }
        
        showStatus(`Generando PDF con ${attendanceData.length} registros reales...`, 'loading');
        submitBtn.textContent = 'Generando PDF...';
        
        // Generar PDF solo con datos reales
        await generatePDF(fechaDesde, fechaHasta);
        
        showDownloadModal(fechaDesde, fechaHasta);
        hideStatus();
        updateSubmitButton();
        
    } catch (error) {
        console.error('Error generando reporte:', error);
        
        // Mostrar mensaje específico según el tipo de error
        let errorMessage = 'Error al generar el reporte: ';
        
        if (error.message.includes('conectar con Google Sheets')) {
            errorMessage += 'No se pudo conectar con Google Sheets. Verifique su conexión a internet y que el sistema tenga los permisos necesarios.';
        } else if (error.message.includes('No se pudieron obtener los datos del servidor')) {
            errorMessage += 'El servidor no pudo procesar la solicitud. Intente nuevamente en unos momentos.';
        } else if (error.message.includes('Usuario no autorizado')) {
            errorMessage += 'Su sesión ha expirado o no tiene permisos. Cierre sesión y vuelva a autenticarse.';
        } else {
            errorMessage += error.message;
        }
        
        showStatus(errorMessage, 'error');
        updateSubmitButton();
    }
}

async function fetchAttendanceData(fechaDesde, fechaHasta) {
    console.log('=== OBTENIENDO DATOS DE ASISTENCIA ===');
    
    try {
        const incluirCampos = getSelectedFields();
        const isModoEvidencias = incluirCampos.includes('evidencias_solo');
        
        const result = await makeBackendRequest('get_attendance_data', {
            fechaDesde: fechaDesde,
            fechaHasta: fechaHasta,
            filtroTipo: document.getElementById('filtro_tipo').value,
            filtroModalidad: document.getElementById('filtro_modalidad').value,
            filtroTipoRegistro: isModoEvidencias ? 'salida' : '',
            modoEvidencias: isModoEvidencias
        });
        
        if (result.success && result.data) {
            // Verificar si los datos son reales o de ejemplo
            if (result.dataSource === 'sample_data') {
                throw new Error('No se pudo conectar con Google Sheets. Verifique la conexión y permisos.');
            }
            
            attendanceData = result.data;
            
            // Filtro adicional en frontend para modo evidencias
            if (isModoEvidencias) {
                attendanceData = attendanceData.filter(record => 
                    record.tipo_registro && record.tipo_registro.toLowerCase() === 'salida'
                );
                console.log(`Modo evidencias activo - Filtrando solo "salidas": ${attendanceData.length} registros`);
            }
            
            console.log(`Datos reales obtenidos: ${attendanceData.length} registros`);
        } else {
            throw new Error(result.message || 'No se pudieron obtener los datos del servidor');
        }
        
    } catch (error) {
        console.error('Error obteniendo datos:', error);
        
        // No usar datos de ejemplo - mostrar error
        attendanceData = [];
        throw new Error('Error de conexión: ' + error.message);
    }
}

function generateSampleData(fechaDesde, fechaHasta) {
    const tiposEstudiante = ['servicio_social', 'practicas_supervisadas', 'estancia_profesional'];
    const modalidades = ['presencial', 'virtual'];
    const nombres = ['Juan', 'María', 'Carlos', 'Ana', 'Luis', 'Carmen'];
    const apellidosP = ['Pérez', 'López', 'García', 'Martínez', 'González'];
    const apellidosM = ['Silva', 'Morales', 'Jiménez', 'Ruiz', 'Díaz'];
    
    const sampleData = [];
    const fechaInicio = new Date(fechaDesde);
    const fechaFin = new Date(fechaHasta);
    const diasDiferencia = Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1;
    
    const numRegistros = Math.min(Math.max(3, diasDiferencia), 8);
    
    for (let i = 0; i < numRegistros; i++) {
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
            tipo_registro: 'entrada',
            intervenciones_psicologicas: String(Math.floor(Math.random() * 5) + 1),
            ninos_ninas: String(Math.floor(Math.random() * 3)),
            adolescentes: String(Math.floor(Math.random() * 3)),
            adultos: String(Math.floor(Math.random() * 3)),
            mayores_60: String(Math.floor(Math.random() * 2)),
            familia: String(Math.floor(Math.random() * 2)),
            actividades_realizadas: 'Entrevista psicológica, Sesiones terapéuticas',
            total_evidencias: String(Math.floor(Math.random() * 4)),
            links_evidencias: `https://drive.google.com/file/d/ejemplo${i+1}_documento/view, https://drive.google.com/file/d/ejemplo${i+1}_evidencia/view`,
            comentarios_adicionales: `Registro de ejemplo ${i + 1} - Datos de demostración`,
            actividades_varias_detalle: '',
            pruebas_psicologicas_detalle: 'MMPI-2, WAIS-IV',
            permiso_detalle: '',
            otro_detalle: ''
        };
        
        sampleData.push(record);
    }
    
    // Aplicar filtros
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
    const doc = new jsPDF('l', 'mm', 'a4');
    
    doc.setFont('helvetica');
    addPDFHeader(doc, fechaDesde, fechaHasta);
    
    const tableData = prepareTableData();
    const incluirCampos = getSelectedFields();
    const isModoEvidencias = incluirCampos.includes('evidencias_solo');
    
    if (isModoEvidencias) {
        // Preparar datos específicamente para modo evidencias
        const headers = getTableHeaders();
        const processedData = [];
        
        tableData.forEach(row => {
            const newRow = [...row];
            // La columna de evidencias está en la posición 6
            if (row[6] && typeof row[6] === 'object' && row[6].links) {
                // Convertir los links a texto simple separado por saltos de línea
                const linksText = row[6].links.map(link => link.url).join('\n');
                newRow[6] = linksText;
            } else if (typeof row[6] === 'string') {
                // Si ya es string, dejarlo como está
                newRow[6] = row[6];
            } else {
                newRow[6] = 'Sin evidencias';
            }
            processedData.push(newRow);
        });
        
        // Configurar la tabla con columna de evidencias clickeable
        doc.autoTable({
            head: [headers],
            body: processedData,
            startY: 40,
            styles: {
                fontSize: 8,
                cellPadding: 2,
                lineColor: [200, 200, 200],
                lineWidth: 0.1
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
                6: { 
                    cellWidth: 80, // Columna de evidencias más ancha
                    fontSize: 7,   // Fuente más pequeña para los links
                    textColor: [0, 0, 255] // Azul para simular links
                }
            },
            didDrawCell: function(data) {
                // Hacer los links clickeables en la columna de evidencias
                if (data.column.index === 6 && data.section === 'body') {
                    const cellContent = processedData[data.row.index][6];
                    
                    if (cellContent && cellContent !== 'Sin evidencias' && cellContent.includes('https://')) {
                        const links = cellContent.split('\n');
                        
                        links.forEach((link, index) => {
                            if (link.trim().startsWith('https://')) {
                                // Calcular la posición Y para cada link
                                const linkY = data.cell.y + (index * 3) + 3;
                                
                                // Crear área clickeable para todo el ancho de la celda
                                doc.link(
                                    data.cell.x + 1,
                                    linkY - 1,
                                    data.cell.width - 2,
                                    3,
                                    { url: link.trim() }
                                );
                            }
                        });
                    }
                }
            }
        });
        
    } else {
        // Modo normal sin modificaciones especiales
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
            }
        });
    }
    
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
    doc.text(`Fecha: ${new Date().toLocaleString('es-MX')}`, 200, 32);
    doc.text(`Total registros: ${attendanceData.length}`, 10, 37);
}

function addPDFFooter(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
            `Página ${i} de ${pageCount} - CESPSIC`,
            148,
            205,
            { align: 'center' }
        );
    }
}

function getTableHeaders() {
    const incluirCampos = getSelectedFields();
    const headers = ['Nombre Completo', 'Tipo Estudiante', 'Modalidad', 'Fecha', 'Hora', 'Tipo Registro'];
    
    if (incluirCampos.includes('evidencias_solo')) {
        // Solo evidencias: agregar columna de links
        headers.push('Links a Evidencias');
    } else {
        // Modo normal: agregar campos según selección
        if (incluirCampos.includes('intervenciones')) {
            headers.push('Intervenciones', 'Niños', 'Adolescentes', 'Adultos', 'Mayores 60', 'Familia');
        }
        if (incluirCampos.includes('actividades')) {
            headers.push('Actividades');
        }
        if (incluirCampos.includes('evidencias')) {
            headers.push('Total Evidencias');
        }
        if (incluirCampos.includes('comentarios')) {
            headers.push('Comentarios');
        }
        if (incluirCampos.includes('permisos')) {
            headers.push('Detalle Permiso', 'Detalle Otro');
        }
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
        
        if (incluirCampos.includes('evidencias_solo')) {
            // Solo evidencias: agregar links de documentos como enlaces clickeables
            const linksText = record.links_evidencias || 'Sin evidencias';
            row.push({
                content: linksText,
                links: linksText !== 'Sin evidencias' ? parseLinksFromText(linksText) : []
            });
        } else {
            // Modo normal: agregar campos según selección
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
        }
        
        return row;
    });
}

function parseLinksFromText(linksText) {
    // Extraer URLs del texto
    const urlRegex = /(https?:\/\/[^\s,]+)/g;
    const urls = linksText.match(urlRegex) || [];
    
    return urls.map((url, index) => ({
        url: url.trim(),
        text: `Evidencia ${index + 1}`
    }));
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
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-MX')}</p>
    `;
    
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

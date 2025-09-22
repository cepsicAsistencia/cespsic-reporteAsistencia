// Variables globales
let currentUser = null;
let isAuthenticated = false;
let isAuthorized = false;
let reportData = null;

const GOOGLE_CLIENT_ID = '799841037062-kal4vump3frc2f8d33bnp4clc9amdnng.apps.googleusercontent.com';
const SHEET_ID = '146Q1MG0AUCnzacqrN5kBENRuiql8o07Uts-l_gimL2I';

// IMPORTANTE: Reemplaza esta URL con la URL de tu Google Apps Script desplegado
const REPORTS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxfEp-ercOI64jKOlRPVttGras54mK26bCqbRR1gX4OuXOtsxqHrtoCC5on8QrFQUs/exec';

const AUTHORIZED_EMAILS = [
    'jose.lino.flores.madrigal@gmail.com',
    'cepsic.atencionpsicologica@gmail.com',
    'adilene@gmail.com'
];

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', function() {
    console.log('Iniciando aplicación de reportes CESPSIC');
    initializeForm();
    setupEventListeners();
    loadGoogleSignInScript();
});

function initializeForm() {
    const today = new Date().toISOString().split('T')[0];
    const fechaHastaInput = document.getElementById('fecha_hasta');
    
    if (fechaHastaInput) {
        fechaHastaInput.max = today;
    }
    
    // Configurar fecha por defecto (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const fechaDesdeInput = document.getElementById('fecha_desde');
    if (fechaDesdeInput) {
        fechaDesdeInput.value = thirtyDaysAgo.toISOString().split('T')[0];
    }
    if (fechaHastaInput) {
        fechaHastaInput.value = today;
    }
}

function setupEventListeners() {
    const fechaDesdeInput = document.getElementById('fecha_desde');
    const fechaHastaInput = document.getElementById('fecha_hasta');
    const reportsForm = document.getElementById('reportsForm');
    
    if (fechaDesdeInput) {
        fechaDesdeInput.addEventListener('change', validateDates);
    }
    if (fechaHastaInput) {
        fechaHastaInput.addEventListener('change', validateDates);
    }
    if (reportsForm) {
        reportsForm.addEventListener('submit', GenerateReport);
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
        showStatus('La fecha desde no puede ser mayor que la fecha hasta.', 'error');
        return false;
    }
    
    hideStatus();
    return true;
}

function loadGoogleSignInScript() {
    console.log('Verificando Google APIs...');
    
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        console.log('Google APIs disponibles, inicializando...');
        initializeGoogleSignIn();
    } else {
        console.log('Google APIs no disponibles, reintentando...');
        setTimeout(loadGoogleSignInScript, 500); // Aumentar tiempo de espera
    }
}

function initializeGoogleSignIn() {
    try {
        console.log('Inicializando Google Sign-In...');
        
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
            use_fedcm_for_prompt: true // Agregar esta opción
        });
        
        console.log('Google Sign-In inicializado correctamente');
        
        // Verificar que funciona
        if (google.accounts.id.renderButton) {
            console.log('Función renderButton disponible');
        } else {
            console.error('Función renderButton NO disponible');
        }
        
    } catch (error) {
        console.error('Error inicializando Google Sign-In:', error);
        
        // Mostrar error al usuario
        setTimeout(() => {
            alert('Error inicializando autenticación. Recargue la página.');
        }, 1000);
    }
}

function requestAuthentication() {
    console.log('Solicitud de autenticación iniciada');
    
    // Verificar que Google esté disponible
    if (typeof google === 'undefined') {
        alert('Google Sign-In no está disponible. Recargue la página.');
        return;
    }
    
    // Mostrar modal
    const modal = document.getElementById('google-auth-modal');
    if (!modal) {
        alert('Error: Modal de autenticación no encontrado');
        return;
    }
    
    modal.style.display = 'flex';
    
    // Esperar y renderizar botón
    setTimeout(() => {
        const buttonContainer = document.getElementById('google-button-container');
        
        if (!buttonContainer) {
            alert('Error: Contenedor del botón no encontrado');
            return;
        }
        
        // Limpiar contenedor
        buttonContainer.innerHTML = '';
        
        try {
            // Intentar renderizar botón de Google
            google.accounts.id.renderButton(buttonContainer, {
                theme: "filled_blue",
                size: "large",
                text: "signin_with",
                shape: "rectangular",
                width: 280
            });
            
            console.log('Botón renderizado exitosamente');
            
        } catch (error) {
            console.error('Error renderizando botón:', error);
            
            // Crear botón manual como fallback
            buttonContainer.innerHTML = `
                <div style="text-align: center;">
                    <p style="margin-bottom: 15px; color: #333;">Haga clic para autenticarse:</p>
                    <button onclick="triggerGoogleAuth()" style="
                        background: #4285f4; 
                        color: white; 
                        border: none; 
                        padding: 12px 24px; 
                        border-radius: 6px; 
                        font-size: 16px; 
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        margin: 0 auto;
                    ">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Iniciar Sesión con Google
                    </button>
                </div>
            `;
        }
    }, 500);
}

function triggerGoogleAuth() {
    try {
        console.log('Activando autenticación manual...');
        
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            // Intentar prompt directo
            google.accounts.id.prompt((notification) => {
                console.log('Resultado del prompt:', notification);
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    // Si el prompt no se muestra, intentar otra alternativa
                    alert('Por favor, habilite las ventanas emergentes y recargue la página.');
                }
            });
        } else {
            alert('Google Sign-In no está disponible. Verifique su conexión a internet y recargue la página.');
        }
    } catch (error) {
        console.error('Error en autenticación manual:', error);
        alert('Error de autenticación. Recargue la página e intente nuevamente.');
    }
}

function showAuthModal() {
    const modal = document.getElementById('google-auth-modal');
    if (modal) {
        modal.style.display = 'flex';
        
        // Esperar a que el modal sea visible antes de renderizar el botón
        setTimeout(() => {
            const buttonContainer = document.getElementById('google-button-container');
            if (buttonContainer && typeof google !== 'undefined' && google.accounts) {
                try {
                    // Limpiar contenido previo
                    buttonContainer.innerHTML = '';
                    
                    // Renderizar botón de Google
                    google.accounts.id.renderButton(buttonContainer, {
                        theme: "filled_blue",
                        size: "large",
                        text: "signin_with",
                        shape: "rectangular",
                        width: 300
                    });
                    
                    console.log('Botón de Google renderizado correctamente');
                } catch (error) {
                    console.error('Error renderizando botón de Google:', error);
                    
                    // Fallback: mostrar botón manual
                    buttonContainer.innerHTML = `
                        <button onclick="manualGoogleSignIn()" style="
                            background: #4285f4; 
                            color: white; 
                            border: none; 
                            padding: 12px 24px; 
                            border-radius: 4px; 
                            font-size: 16px; 
                            cursor: pointer;
                        ">
                            Iniciar Sesión con Google
                        </button>
                    `;
                }
            } else {
                console.error('Google APIs no disponibles o contenedor no encontrado');
                
                // Mostrar mensaje de error
                const buttonContainer = document.getElementById('google-button-container');
                if (buttonContainer) {
                    buttonContainer.innerHTML = `
                        <p style="color: red;">Error: Google Sign-In no disponible</p>
                        <button onclick="location.reload()" style="
                            background: #dc3545; 
                            color: white; 
                            border: none; 
                            padding: 10px 20px; 
                            border-radius: 4px;
                        ">
                            Recargar página
                        </button>
                    `;
                }
            }
        }, 300); // Aumentar tiempo de espera
    }
}
function manualGoogleSignIn() {
    try {
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.prompt((notification) => {
                console.log('Prompt result:', notification);
            });
        } else {
            alert('Google Sign-In no está disponible. Recargue la página.');
        }
    } catch (error) {
        console.error('Error en sign-in manual:', error);
        alert('Error de autenticación. Recargue la página.');
    }
}

function closeAuthModal() {
    const modal = document.getElementById('google-auth-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function handleCredentialResponse(response) {
    try {
        console.log('Procesando credenciales de Google...');
        console.log('URL configurada:', REPORTS_SCRIPT_URL);
        alert('URL que se usará: ' + REPORTS_SCRIPT_URL);        
        closeAuthModal();
        
        const userInfo = parseJwt(response.credential);
        
        if (!userInfo) {
            throw new Error('No se pudo decodificar la información del usuario');
        }
        
        currentUser = {
            id: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            email_verified: userInfo.email_verified
        };

        console.log('Usuario autenticado:', currentUser.email);

        if (!currentUser.email_verified) {
            showStatus('Su cuenta de Gmail no está verificada. Use una cuenta verificada.', 'error');
            return;
        }

        // Verificar autorización
        const emailNormalizado = currentUser.email.toLowerCase();
        const emailsAutorizados = AUTHORIZED_EMAILS.map(email => email.toLowerCase());
        
        if (emailsAutorizados.includes(emailNormalizado)) {
            handleAuthorizedLogin();
        } else {
            handleUnauthorizedLogin();
        }
    } catch (error) {
        console.error('Error procesando credenciales:', error);
        showStatus('Error en la autenticación: ' + error.message, 'error');
    }
}

function handleAuthorizedLogin() {
    isAuthenticated = true;
    isAuthorized = true;
    
    console.log('Acceso autorizado para:', currentUser.email);
    
    // Determinar rol del usuario
    let userRole = 'Personal Autorizado';
    const email = currentUser.email.toLowerCase();
    
    if (email === 'jose.lino.flores.madrigal@gmail.com') {
        userRole = 'Administrador Principal';
    } else if (email === 'cepsic.atencionpsicologica@gmail.com') {
        userRole = 'Coordinador CESPSIC';
    } else if (email.includes('adilene')) {
        userRole = 'Supervisor Académico';
    }
    
    updateAuthenticationUI(userRole);
    enableReportsForm();
    showStatus('Acceso autorizado. Puede generar reportes de asistencia.', 'success');
    
    setTimeout(() => hideStatus(), 3000);
}

function handleUnauthorizedLogin() {
    console.log('Acceso denegado para:', currentUser.email);
    showAccessDeniedModal();
    
    // Cerrar sesión automáticamente después de 5 segundos
    setTimeout(() => {
        signOut();
    }, 5000);
}

function showAccessDeniedModal() {
    const modal = document.getElementById('access-denied-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeAccessDeniedModal() {
    const modal = document.getElementById('access-denied-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function updateAuthenticationUI(userRole) {
    const authSection = document.getElementById('auth-section');
    const authTitle = document.getElementById('auth-title');
    const userInfo = document.getElementById('user-info');
    const signinContainer = document.getElementById('signin-button-container');

    if (isAuthenticated && isAuthorized && currentUser) {
        if (authSection) {
            authSection.classList.add('authenticated');
        }
        if (authTitle) {
            authTitle.textContent = '✅ Acceso Autorizado';
        }
        
        // Actualizar información del usuario
        const userAvatar = document.getElementById('user-avatar');
        const userEmail = document.getElementById('user-email');
        const userName = document.getElementById('user-name');
        const userRoleElement = document.getElementById('user-role');
        
        if (userAvatar) userAvatar.src = currentUser.picture || '';
        if (userEmail) userEmail.textContent = currentUser.email || '';
        if (userName) userName.textContent = currentUser.name || '';
        if (userRoleElement) userRoleElement.textContent = userRole || '';
        
        if (userInfo) {
            userInfo.classList.add('show');
        }
        
        if (signinContainer) {
            signinContainer.style.display = 'none';
        }
    }
}

function enableReportsForm() {
    const formContainer = document.getElementById('reports-container');
    if (formContainer) {
        formContainer.classList.add('authenticated');
    }
    
    const generateBtn = document.getElementById('generate_btn');
    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.textContent = '📊 Generar Reporte PDF';
    }
}

function signOut() {
    try {
        console.log('Cerrando sesión...');
        
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.disableAutoSelect();
        }
        
        // Limpiar variables globales
        isAuthenticated = false;
        isAuthorized = false;
        currentUser = null;
        reportData = null;
        
        // Recargar página para resetear estado
        location.reload();
    } catch (error) {
        console.error('Error cerrando sesión:', error);
        location.reload(); // Forzar recarga en caso de error
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

// Función principal para generar reportes
async function handleGenerateReport(e) {
    e.preventDefault();
    
    console.log('Iniciando generación de reporte...');
    
    // Verificar autenticación
    if (!isAuthenticated || !isAuthorized) {
        showStatus('Debe autenticarse con una cuenta autorizada antes de generar reportes.', 'error');
        return;
    }
    
    // Validar fechas
    if (!validateDates()) {
        return;
    }
    
    // Obtener valores del formulario
    const fechaDesde = document.getElementById('fecha_desde').value;
    const fechaHasta = document.getElementById('fecha_hasta').value;
    const filtroEstudiante = document.getElementById('filtro_estudiante').value;
    const filtroModalidad = document.getElementById('filtro_modalidad').value;
    
    if (!fechaDesde || !fechaHasta) {
        showStatus('Debe seleccionar ambas fechas para generar el reporte.', 'error');
        return;
    }
    
    console.log('Parámetros del reporte:', {
        fechaDesde,
        fechaHasta,
        filtroEstudiante,
        filtroModalidad
    });
    
    try {
        showStatus('Conectando con Google Sheets...', 'loading');
        
        // Verificar URL del script
        if (REPORTS_SCRIPT_URL.includes('TU_ID_SCRIPT_AQUI')) {
            throw new Error('Configure la URL del Google Apps Script en la variable REPORTS_SCRIPT_URL');
        }
        
        // Obtener datos reales del Google Sheet
        const datos = await fetchRealSheetData(fechaDesde, fechaHasta, filtroEstudiante, filtroModalidad);
        
        console.log('Datos recibidos del backend:', datos);
        
        if (!datos || datos.length === 0) {
            showStatus('No se encontraron registros para el período y filtros seleccionados.', 'error');
            return;
        }
        
        showStatus(`Generando reporte PDF con ${datos.length} registros...`, 'loading');
        
        // Generar reporte con datos reales
        await generateRealDataReport(datos, fechaDesde, fechaHasta, filtroEstudiante, filtroModalidad);
        
        // Registrar en log del backend
        await logReportGeneration(datos.length, fechaDesde, fechaHasta, filtroEstudiante, filtroModalidad);
        
    } catch (error) {
        console.error('Error completo en generación de reporte:', error);
        
        let errorMessage = 'Error generando reporte: ';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage += 'No se pudo conectar con el servidor. Verifique la URL del Google Apps Script.';
        } else if (error.message.includes('UNAUTHORIZED_ACCESS')) {
            errorMessage += 'Su cuenta no tiene permisos para acceder a los datos.';
        } else {
            errorMessage += error.message;
        }
        
        showStatus(errorMessage, 'error');
    }
}

// Función para obtener datos reales del Google Sheet
async function fetchRealSheetData(fechaDesde, fechaHasta, filtroEstudiante, filtroModalidad) {
    console.log('Probando conexión con:', REPORTS_SCRIPT_URL);
    
    try {
        const response = await fetch(REPORTS_SCRIPT_URL, {
            method: 'GET'  // Prueba GET primero
        });
        
        console.log('Respuesta GET:', response.status);
        const text = await response.text();
        console.log('Contenido:', text.substring(0, 100));
        
        if (text.includes('CESPSIC')) {
            alert('Conexión exitosa con GET');
        } else {
            alert('Respuesta inesperada: ' + text.substring(0, 50));
        }
        
        throw new Error('Prueba de conexión completada');
        
    } catch (error) {
        console.error('Error en prueba:', error);
        throw error;
    }
}
async function fetchRealSheetDatax(fechaDesde, fechaHasta, filtroEstudiante, filtroModalidad) {
    console.log('Preparando solicitud al backend...');
    
    const requestData = {
        action: 'get_report_data',
        email: currentUser.email,
        google_user_id: currentUser.id,
        usuario_nombre: currentUser.name,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        filtro_estudiante: filtroEstudiante || '',
        filtro_modalidad: filtroModalidad || '',
        timestamp: new Date().toISOString()
    };
    
    console.log('Datos de solicitud:', requestData);
    console.log('URL del backend:', REPORTS_SCRIPT_URL);
    
    try {
        const response = await fetch(REPORTS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            mode: 'cors'
        });
        
        console.log('Status de respuesta HTTP:', response.status);
        console.log('Headers de respuesta:', response.headers);
        
        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Respuesta completa del backend:', result);
        
        if (!result.success) {
            throw new Error(result.message || 'Error desconocido del servidor');
        }
        
        if (!result.data || !Array.isArray(result.data)) {
            throw new Error('Formato de datos inválido recibido del servidor');
        }
        
        console.log(`✅ Datos obtenidos exitosamente: ${result.data.length} registros`);
        return result.data;
        
    } catch (fetchError) {
        console.error('Error detallado en fetch:', fetchError);
        
        if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
            throw new Error('No se pudo conectar con Google Apps Script. Verifique la URL y permisos de implementación.');
        }
        
        throw fetchError;
    }
}

// Función para registrar la generación del reporte en el backend
async function logReportGeneration(totalRegistros, fechaDesde, fechaHasta, filtroEstudiante, filtroModalidad) {
    try {
        const logData = {
            action: 'log_report_generation',
            email: currentUser.email,
            google_user_id: currentUser.id,
            usuario_nombre: currentUser.name,
            fecha_desde: fechaDesde,
            fecha_hasta: fechaHasta,
            filtro_estudiante: filtroEstudiante || 'Todos',
            filtro_modalidad: filtroModalidad || 'Todas',
            total_registros: totalRegistros,
            timestamp: new Date().toISOString()
        };
        
        const response = await fetch(REPORTS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(logData)
        });
        
        if (response.ok) {
            console.log('✅ Generación de reporte registrada en log');
        }
    } catch (logError) {
        console.warn('⚠️ Error registrando log (no crítico):', logError);
    }
}

// Función para generar reporte con datos reales
async function generateRealDataReport(datos, fechaDesde, fechaHasta, filtroEstudiante, filtroModalidad) {
    console.log(`Generando reporte HTML con ${datos.length} registros reales...`);
    
    const reportContent = createRealReportHTML(datos, fechaDesde, fechaHasta, filtroEstudiante, filtroModalidad);
    const blob = new Blob([reportContent], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Abrir en nueva ventana
    const newWindow = window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    
    if (newWindow) {
        reportData = {
            url: url,
            fechaDesde: fechaDesde,
            fechaHasta: fechaHasta,
            totalRegistros: datos.length,
            generadoPor: currentUser.name,
            fechaGeneracion: new Date().toLocaleString('es-ES'),
            tipoReporte: 'DATOS_REALES',
            filtros: {
                estudiante: filtroEstudiante || 'Todos',
                modalidad: filtroModalidad || 'Todas'
            }
        };
        
        showDownloadModal();
        showStatus(`✅ Reporte generado exitosamente con ${datos.length} registros reales`, 'success');
        
        setTimeout(() => hideStatus(), 5000);
    } else {
        showStatus('❌ Error: Ventanas emergentes bloqueadas. Permita ventanas emergentes para este sitio.', 'error');
    }
}

// Función para crear HTML completo del reporte con datos reales
function createRealReportHTML(datos, fechaDesde, fechaHasta, filtroEstudiante, filtroModalidad) {
    console.log(`Creando HTML del reporte con ${datos.length} registros`);
    
    if (!datos || datos.length === 0) {
        return createEmptyReportHTML(fechaDesde, fechaHasta);
    }
    
    // Generar filas de la tabla con datos reales
    const tableRows = datos.map((row, index) => {
        const nombreCompleto = `${row.nombre || ''} ${row.apellido_paterno || ''} ${row.apellido_materno || ''}`.trim() || 'Sin nombre';
        
        return `
        <tr>
            <td style="text-align: center;">${index + 1}</td>
            <td>${nombreCompleto}</td>
            <td>${row.tipo_estudiante || 'No especificado'}</td>
            <td style="text-align: center;">${row.modalidad || 'No especificado'}</td>
            <td style="text-align: center;">${row.fecha || 'Sin fecha'}</td>
            <td style="text-align: center;">${row.hora || 'Sin hora'}</td>
            <td style="text-align: center;">${row.tipo_registro || 'No especificado'}</td>
            <td style="text-align: center;">${row.intervenciones_psicologicas || 0}</td>
            <td>${(row.actividades_realizadas || 'No especificado').substring(0, 100)}${(row.actividades_realizadas || '').length > 100 ? '...' : ''}</td>
        </tr>`;
    }).join('');
    
    // Calcular estadísticas reales
    const stats = calculateRealStats(datos);
    
    // Información de filtros aplicados
    const filtrosInfo = [];
    if (filtroEstudiante) filtrosInfo.push(`Tipo de estudiante: ${filtroEstudiante}`);
    if (filtroModalidad) filtrosInfo.push(`Modalidad: ${filtroModalidad}`);
    const filtrosTexto = filtrosInfo.length > 0 ? filtrosInfo.join(' | ') : 'Sin filtros aplicados';
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte CESPSIC ${fechaDesde} - ${fechaHasta}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 20px; 
            line-height: 1.6; 
            color: #333;
            font-size: 14px;
        }
        
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 3px solid #667eea; 
            padding-bottom: 20px; 
        }
        .header h1 { 
            color: #667eea; 
            margin: 10px 0; 
            font-size: 1.8em;
        }
        .header h2, .header h3 { 
            color: #555; 
            margin: 5px 0; 
            font-weight: normal;
        }
        
        .info { 
            background: linear-gradient(135deg, #f8f9ff 0%, #e3f2fd 100%); 
            padding: 20px; 
            border-radius: 10px; 
            margin-bottom: 20px; 
            border-left: 4px solid #4caf50;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .info p { 
            margin: 8px 0; 
            font-size: 14px;
        }
        .info .highlight { 
            background: #4caf50; 
            color: white; 
            padding: 2px 8px; 
            border-radius: 4px; 
            font-weight: bold; 
        }
        .info .status { 
            background: #2196f3; 
            color: white; 
            padding: 2px 8px; 
            border-radius: 4px; 
            font-weight: bold; 
        }
        
        .content { 
            margin: 20px 0; 
        }
        .section-title { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0 10px 0; 
            font-size: 1.1em;
            font-weight: bold;
            text-align: center;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-card {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s ease;
        }
        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }
        
        .table-container {
            overflow-x: auto;
            margin: 20px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
        }
        
        table { 
            width: 100%; 
            border-collapse: collapse; 
            background: white;
            min-width: 1000px;
        }
        th, td { 
            border: 1px solid #ddd; 
            padding: 10px 8px; 
            text-align: left; 
            font-size: 12px;
            vertical-align: top;
        }
        th { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            font-weight: bold; 
            text-align: center;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        tr:nth-child(even) { 
            background-color: #f9f9f9; 
        }
        tr:hover { 
            background-color: #f0f8ff; 
        }
        
        .summary-table {
            width: 60%;
            margin: 10px auto;
            min-width: auto;
        }
        .summary-table th {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        }
        
        .controls { 
            text-align: center; 
            margin: 30px 0; 
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .btn { 
            padding: 15px 30px; 
            margin: 10px; 
            border: none; 
            border-radius: 8px; 
            font-size: 16px; 
            cursor: pointer; 
            font-weight: bold; 
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        .btn-primary { 
            background: linear-gradient(45deg, #667eea, #764ba2); 
            color: white; 
        }
        .btn-secondary { 
            background: linear-gradient(45deg, #6c757d, #495057); 
            color: white; 
        }
        .btn:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .instructions {
            margin-top: 20px;
            padding: 15px;
            background: #e3f2fd;
            border-radius: 8px;
            font-size: 14px;
            color: #1565c0;
        }
        
        .footer { 
            text-align: center; 
            margin-top: 40px; 
            font-size: 12px; 
            color: #666; 
            border-top: 2px solid #667eea; 
            padding-top: 20px; 
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
        }
        
        @media print { 
            .controls { display: none; } 
            body { margin: 0; font-size: 11px; } 
            .btn { display: none; }
            .instructions { display: none; }
            .table-container { overflow: visible; }
            table { min-width: auto; }
        }
        
        @media (max-width: 768px) { 
            body { margin: 10px; font-size: 12px; } 
            .stats-grid { grid-template-columns: 1fr 1fr; }
            .summary-table { width: 95%; }
            th, td { padding: 6px 4px; font-size: 10px; }
            .header h1 { font-size: 1.4em; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>REPORTE DE ASISTENCIAS - CESPSIC</h1>
        <h2>Universidad Autónoma de Sinaloa</h2>
        <h3>Centro de Servicios Psicológicos a la Comunidad</h3>
        <h3>Facultad de Psicología</h3>
    </div>
    
    <div class="info">
        <p><strong>Período de consulta:</strong> ${fechaDesde} al ${fechaHasta}</p>
        <p><strong>Filtros aplicados:</strong> ${filtrosTexto}</p>
        <p><strong>Generado por:</strong> ${currentUser ? currentUser.name + ' (' + currentUser.email + ')' : 'Usuario'}</p>
        <p><strong>Fecha de generación:</strong> ${new Date().toLocaleString('es-ES')}</p>
        <p><strong>Total de registros:</strong> <span class="highlight">${datos.length}</span></p>
        <p><strong>Estado:</strong> <span class="status">DATOS REALES DE GOOGLE SHEETS</span></p>
    </div>
    
    <div class="content">
        <div class="section-title">📊 ESTADÍSTICAS GENERALES</div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${stats.totalRegistros}</div>
                <div class="stat-label">Total Registros</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.totalIntervenciones}</div>
                <div class="stat-label">Total Intervenciones</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.presencial}</div>
                <div class="stat-label">Presencial</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.virtual}</div>
                <div class="stat-label">Virtual</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.estudiantesUnicos}</div>
                <div class="stat-label">Estudiantes Únicos</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.promedioIntervencionesporEstudiante}</div>
                <div class="stat-label">Promedio Intervenciones</div>
            </div>
        </div>
        
        <div class="section-title">📋 DATOS DETALLADOS DE ASISTENCIA</div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 40px;">#</th>
                        <th style="width: 200px;">Nombre Completo</th>
                        <th style="width: 120px;">Tipo Estudiante</th>
                        <th style="width: 80px;">Modalidad</th>
                        <th style="width: 80px;">Fecha</th>
                        <th style="width: 60px;">Hora</th>
                        <th style="width: 100px;">Tipo Registro</th>
                        <th style="width: 80px;">Intervenciones</th>
                        <th>Actividades Realizadas</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
        
        <div class="section-title">📈 RESUMEN POR TIPO DE ESTUDIANTE</div>
        ${createStudentTypeTable(stats.porTipoEstudiante)}
        
        <div class="section-title">🖥️ RESUMEN POR MODALIDAD</div>
        ${createModalityTable(stats.porModalidad)}
        
        <div class="section-title">📅 RESUMEN POR FECHA</div>
        ${createDateSummaryTable(stats.porFecha)}
    </div>
    
    <div class="controls">
        <button class="btn btn-primary" onclick="window.print()">
            📄 Guardar como PDF / Imprimir
        </button>
        <button class="btn btn-secondary" onclick="window.close()">
            ✖ Cerrar Ventana
        </button>
        
        <div class="instructions">
            <p><strong>📱 Instrucciones para guardar como PDF:</strong></p>
            <p><strong>En móvil:</strong> Menú (⋮) → Imprimir → Destino: Guardar como PDF</p>
            <p><strong>En computadora:</strong> Ctrl+P → Destino: Guardar como PDF</p>
            <p><strong>En iPhone:</strong> Botón compartir → Imprimir → Pellizcar para zoom → Compartir PDF</p>
        </div>
    </div>
    
    <div class="footer">
        <p><strong>Centro de Servicios Psicológicos a la Comunidad (CESPSIC)</strong></p>
        <p>Universidad Autónoma de Sinaloa - Facultad de Psicología</p>
        <p>Reporte generado el ${new Date().toLocaleString('es-ES')}</p>
        <p><em>Este reporte contiene datos reales del sistema de asistencias de Google Sheets</em></p>
        <p><strong>Total de registros procesados:</strong> ${datos.length} | <strong>Generado por:</strong> ${currentUser ? currentUser.name : 'Sistema'}</p>
    </div>
</body>
</html>`;
}

// Función para calcular estadísticas reales detalladas
function calculateRealStats(datos) {
    const stats = {
        totalRegistros: datos.length,
        totalIntervenciones: 0,
        presencial: 0,
        virtual: 0,
        estudiantesUnicos: new Set(),
        porTipoEstudiante: {},
        porModalidad: {},
        porFecha: {},
        promedioIntervencionesporEstudiante: 0
    };
    
    datos.forEach(row => {
        // Sumar intervenciones
        const intervenciones = parseInt(row.intervenciones_psicologicas) || 0;
        stats.totalIntervenciones += intervenciones;
        
        // Estudiantes únicos
        const nombreCompleto = `${row.nombre || ''} ${row.apellido_paterno || ''} ${row.apellido_materno || ''}`.trim();
        if (nombreCompleto && nombreCompleto !== '') {
            stats.estudiantesUnicos.add(nombreCompleto);
        }
        
        // Contar por modalidad
        const modalidad = (row.modalidad || 'No especificado').toLowerCase();
        if (modalidad.includes('presencial')) {
            stats.presencial++;
        } else if (modalidad.includes('virtual')) {
            stats.virtual++;
        }
        
        // Agrupar por tipo de estudiante
        const tipoEstudiante = row.tipo_estudiante || 'No especificado';
        stats.porTipoEstudiante[tipoEstudiante] = (stats.porTipoEstudiante[tipoEstudiante] || 0) + 1;
        
        // Agrupar por modalidad
        const modalidadOriginal = row.modalidad || 'No especificado';
        stats.porModalidad[modalidadOriginal] = (stats.porModalidad[modalidadOriginal] || 0) + 1;
        
        // Agrupar por fecha
        const fecha = row.fecha || 'Sin fecha';
        if (!stats.porFecha[fecha]) {
            stats.porFecha[fecha] = {
                registros: 0,
                intervenciones: 0
            };
        }
        stats.porFecha[fecha].registros++;
        stats.porFecha[fecha].intervenciones += intervenciones;
    });
    
    // Calcular estudiantes únicos y promedio
    stats.estudiantesUnicos = stats.estudiantesUnicos.size;
    stats.promedioIntervencionesporEstudiante = stats.estudiantesUnicos > 0 
        ? Math.round((stats.totalIntervenciones / stats.estudiantesUnicos) * 10) / 10 
        : 0;
    
    return stats;
}

// Función para crear tabla de tipos de estudiante
function createStudentTypeTable(porTipoEstudiante) {
    const rows = Object.entries(porTipoEstudiante)
        .sort(([,a], [,b]) => b - a) // Ordenar por cantidad descendente
        .map(([tipo, cantidad]) => {
            const porcentaje = Math.round((cantidad / Object.values(porTipoEstudiante).reduce((a, b) => a + b, 0)) * 100);
            return `<tr><td>${tipo}</td><td style="text-align: center;">${cantidad}</td><td style="text-align: center;">${porcentaje}%</td></tr>`;
        })
        .join('');
        
    return `
    <table class="summary-table">
        <thead>
            <tr>
                <th>Tipo de Estudiante</th>
                <th>Cantidad</th>
                <th>Porcentaje</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;
}

// Función para crear tabla de modalidades
function createModalityTable(porModalidad) {
    const rows = Object.entries(porModalidad)
        .sort(([,a], [,b]) => b - a) // Ordenar por cantidad descendente
        .map(([modalidad, cantidad]) => {
            const porcentaje = Math.round((cantidad / Object.values(porModalidad).reduce((a, b) => a + b, 0)) * 100);
            return `<tr><td>${modalidad}</td><td style="text-align: center;">${cantidad}</td><td style="text-align: center;">${porcentaje}%</td></tr>`;
        })
        .join('');
        
    return `
    <table class="summary-table">
        <thead>
            <tr>
                <th>Modalidad</th>
                <th>Cantidad</th>
                <th>Porcentaje</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;
}

// Función para crear tabla resumen por fecha
function createDateSummaryTable(porFecha) {
    const rows = Object.entries(porFecha)
        .sort(([a], [b]) => new Date(b) - new Date(a)) // Ordenar por fecha descendente
        .slice(0, 10) // Mostrar solo las 10 fechas más recientes
        .map(([fecha, data]) => `
            <tr>
                <td style="text-align: center;">${fecha}</td>
                <td style="text-align: center;">${data.registros}</td>
                <td style="text-align: center;">${data.intervenciones}</td>
                <td style="text-align: center;">${data.registros > 0 ? Math.round((data.intervenciones / data.registros) * 10) / 10 : 0}</td>
            </tr>
        `)
        .join('');
        
    return `
    <table class="summary-table">
        <thead>
            <tr>
                <th>Fecha</th>
                <th>Registros</th>
                <th>Intervenciones</th>
                <th>Promedio</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>
    <p style="text-align: center; font-size: 12px; color: #666; margin-top: 10px;">
        <em>Mostrando las 10 fechas más recientes con actividad</em>
    </p>`;
}

// Función para reporte vacío
function createEmptyReportHTML(fechaDesde, fechaHasta) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte CESPSIC - Sin Datos</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 40px; 
            text-align: center; 
            color: #333; 
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px;
            border: 2px solid #e0e0e0;
            border-radius: 15px;
            background: linear-gradient(135deg, #f8f9ff 0%, #e3f2fd 100%);
        }
        h1 { 
            color: #667eea; 
            margin-bottom: 20px; 
        }
        .info {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .btn {
            background: #667eea;
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin: 10px;
        }
        .btn:hover {
            background: #5a6fd8;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>REPORTE DE ASISTENCIAS - CESPSIC</h1>
        <h2>Universidad Autónoma de Sinaloa</h2>
        
        <div class="info">
            <h3>📄 Sin Registros Encontrados</h3>
            <p><strong>Período consultado:</strong> ${fechaDesde} al ${fechaHasta}</p>
            <p><strong>Generado por:</strong> ${currentUser ? currentUser.name : 'Usuario'}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
        </div>
        
        <p>No se encontraron registros de asistencia para el período y filtros seleccionados.</p>
        <p><strong>Sugerencias:</strong></p>
        <ul style="text-align: left; display: inline-block;">
            <li>Amplíe el rango de fechas</li>
            <li>Elimine los filtros aplicados</li>
            <li>Verifique que existan datos en el Google Sheet</li>
            <li>Contacte al administrador si el problema persiste</li>
        </ul>
        
        <div style="margin-top: 30px;">
            <button class="btn" onclick="window.close()">Cerrar Ventana</button>
        </div>
    </div>
</body>
</html>`;
}

// Función para mostrar modal de descarga
function showDownloadModal() {
    const modal = document.getElementById('download-modal');
    if (modal && reportData) {
        const reportPeriod = document.getElementById('report-period');
        const reportCount = document.getElementById('report-count');
        const reportUser = document.getElementById('report-user');
        const reportDate = document.getElementById('report-date');
        
        if (reportPeriod) reportPeriod.textContent = `${reportData.fechaDesde} al ${reportData.fechaHasta}`;
        if (reportCount) reportCount.textContent = reportData.totalRegistros;
        if (reportUser) reportUser.textContent = reportData.generadoPor;
        if (reportDate) reportDate.textContent = reportData.fechaGeneracion;
        
        // Configurar botón de descarga
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.onclick = downloadReport;
        }
        
        modal.style.display = 'flex';
    }
}

// Función para descargar/abrir reporte
function downloadReport() {
    if (reportData && reportData.url) {
        // Abrir reporte en nueva ventana/pestaña
        window.open(reportData.url, '_blank');
        
        showStatus('Reporte abierto en nueva ventana. Use "Guardar como PDF" desde el menú de impresión.', 'success');
        
        setTimeout(() => {
            closeDownloadModal();
            hideStatus();
        }, 3000);
    } else {
        showStatus('Error: No hay reporte disponible para descargar.', 'error');
    }
}

// Función para cerrar modal de descarga
function closeDownloadModal() {
    const modal = document.getElementById('download-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Funciones de utilidad para mostrar mensajes de estado
function showStatus(message, type) {
    const status = document.getElementById('status');
    if (status) {
        status.innerHTML = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        
        // Auto-ocultar mensajes de éxito después de 5 segundos
        if (type === 'success') {
            setTimeout(() => hideStatus(), 5000);
        }
    }
    
    // También mostrar en consola para debugging
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function hideStatus() {
    const status = document.getElementById('status');
    if (status) {
        status.style.display = 'none';
    }
}

// Función para limpiar datos al cerrar
window.addEventListener('beforeunload', function() {
    if (reportData && reportData.url) {
        URL.revokeObjectURL(reportData.url);
    }
});

// Función de diagnóstico para debugging
function diagnosticoSistema() {
    console.log('=== DIAGNÓSTICO DEL SISTEMA DE REPORTES ===');
    console.log('Usuario autenticado:', currentUser);
    console.log('Está autenticado:', isAuthenticated);
    console.log('Está autorizado:', isAuthorized);
    console.log('URL del script:', REPORTS_SCRIPT_URL);
    console.log('Cliente ID de Google:', GOOGLE_CLIENT_ID);
    console.log('Emails autorizados:', AUTHORIZED_EMAILS);
    console.log('Datos del último reporte:', reportData);
    console.log('Google APIs disponibles:', typeof google !== 'undefined');
    
    if (typeof google !== 'undefined' && google.accounts) {
        console.log('Google Sign-In inicializado correctamente');
    } else {
        console.log('Google Sign-In NO disponible');
    }
    
    return 'Diagnóstico completado. Revise la consola para detalles.';
}

// Exponer función de diagnóstico globalmente para debugging
window.diagnosticoSistema = diagnosticoSistema;

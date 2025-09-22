// Variables globales
let currentUser = null;
let isAuthenticated = false;
let isAuthorized = false;
let reportData = null;

// IMPORTANTE: Reemplaza con tu Google Client ID
const GOOGLE_CLIENT_ID = '799841037062-kal4vump3frc2f8d33bnp4clc9amdnng.apps.googleusercontent.com';

// ID del Google Sheet con los datos de asistencia
const SHEET_ID = '146Q1MG0AUCnzacqrN5kBENRuiql8o07Uts-l_gimL2I';

// Emails autorizados para generar reportes
const AUTHORIZED_EMAILS = [
    'jose.lino.flores.madrigal@gmail.com',
    'CEPSIC.atencionpsicologica@gmail.com',
    'adilene@gmail.com'
];

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== INICIANDO APLICACIÓN DE REPORTES ===');
    
    initializeForm();
    setupEventListeners();
    loadGoogleSignInScript();
});

function initializeForm() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fecha_hasta').max = today;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    document.getElementById('fecha_desde').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('fecha_hasta').value = today;
}

function setupEventListeners() {
    document.getElementById('fecha_desde').addEventListener('change', validateDates);
    document.getElementById('fecha_hasta').addEventListener('change', validateDates);
    document.getElementById('reportsForm').addEventListener('submit', handleGenerateReport);
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
    if (typeof google !== 'undefined' && google.accounts) {
        initializeGoogleSignIn();
        blockGooglePrompts();
    } else {
        setTimeout(loadGoogleSignInScript, 100);
    }
}

function blockGooglePrompts() {
    try {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.disableAutoSelect();
            google.accounts.id.cancel();
            console.log('Google prompts bloqueados');
        }
    } catch (error) {
        console.error('Error bloqueando prompts:', error);
    }
}

function initializeGoogleSignIn() {
    try {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });

        console.log('Google Sign-In inicializado para reportes');

    } catch (error) {
        console.error('Error inicializando Google Sign-In:', error);
        showStatus('Error cargando sistema de autenticación.', 'error');
    }
}

function requestAuthentication() {
    console.log('Solicitud de autenticación administrativa');
    showAuthModal();
}

function showAuthModal() {
    const modal = document.getElementById('google-auth-modal');
    if (modal) {
        modal.style.display = 'flex';
        
        setTimeout(() => {
            const buttonContainer = document.getElementById('google-button-container');
            if (buttonContainer && typeof google !== 'undefined') {
                google.accounts.id.renderButton(buttonContainer, {
                    theme: "filled_blue",
                    size: "large",
                    text: "signin_with",
                    shape: "rectangular"
                });
            }
        }, 100);
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
        console.log('Credenciales recibidas');
        closeAuthModal();
        
        const userInfo = parseJwt(response.credential);
        
        currentUser = {
            id: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            email_verified: userInfo.email_verified
        };

        if (!currentUser.email_verified) {
            showStatus('Su cuenta de Gmail no está verificada.', 'error');
            return;
        }

        if (AUTHORIZED_EMAILS.includes(currentUser.email.toLowerCase())) {
            handleAuthorizedLogin();
        } else {
            handleUnauthorizedLogin();
        }

    } catch (error) {
        console.error('Error procesando credenciales:', error);
        showStatus('Error en la autenticación. Intente nuevamente.', 'error');
    }
}

function handleAuthorizedLogin() {
    isAuthenticated = true;
    isAuthorized = true;
    
    let userRole = 'Personal Autorizado';
    if (currentUser.email === 'jose.lino.flores.madrigal@gmail.com') {
        userRole = 'Administrador Principal';
    } else if (currentUser.email === 'CEPSIC.atencionpsicologica@gmail.com') {
        userRole = 'Coordinador CESPSIC';
    }
    
    updateAuthenticationUI(userRole);
    enableReportsForm();
    
    showStatus('Bienvenido. Acceso autorizado para generar reportes.', 'success');
    setTimeout(() => hideStatus(), 3000);
}

function handleUnauthorizedLogin() {
    isAuthenticated = true;
    isAuthorized = false;
    
    showAccessDeniedModal();
    
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

    if (isAuthenticated && isAuthorized) {
        authSection.classList.add('authenticated');
        authTitle.textContent = 'Acceso Autorizado';
        authTitle.classList.add('authenticated');

        document.getElementById('user-avatar').src = currentUser.picture;
        document.getElementById('user-email').textContent = currentUser.email;
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('user-role').textContent = userRole;
        userInfo.classList.add('show');

        signinContainer.style.display = 'none';
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
        generateBtn.textContent = 'Generar Reporte PDF';
    }
}

function signOut() {
    try {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.disableAutoSelect();
        }
        
        isAuthenticated = false;
        isAuthorized = false;
        currentUser = null;
        reportData = null;

        location.reload();

    } catch (error) {
        console.error('Error cerrando sesión:', error);
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

function handleGenerateReport(e) {
    e.preventDefault();
    
    if (!isAuthenticated || !isAuthorized) {
        showStatus('Debe autenticarse con una cuenta autorizada.', 'error');
        return;
    }
    
    if (!validateDates()) {
        return;
    }
    
    const fechaDesde = document.getElementById('fecha_desde').value;
    const fechaHasta = document.getElementById('fecha_hasta').value;
    
    if (!fechaDesde || !fechaHasta) {
        showStatus('Debe seleccionar ambas fechas.', 'error');
        return;
    }
    
    // Simulación para prueba - en implementación real conectar con backend
    showStatus('Generando reporte de prueba...', 'loading');
    
    setTimeout(() => {
        generateTestPDF(fechaDesde, fechaHasta);
    }, 2000);
}

function generateTestPDF(fechaDesde, fechaHasta) {
    try {
        showStatus('Generando reporte HTML...', 'loading');
        
        // Crear contenido HTML para convertir a PDF
        const reportContent = generateReportHTML(fechaDesde, fechaHasta);
        
        // Crear blob con el contenido
        const blob = new Blob([reportContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        // Abrir en nueva ventana
        const newWindow = window.open(url, '_blank');
        
        if (newWindow) {
            reportData = {
                url: url,
                fechaDesde: fechaDesde,
                fechaHasta: fechaHasta,
                totalRegistros: 0,
                generadoPor: currentUser ? currentUser.name : 'Usuario',
                fechaGeneracion: new Date().toLocaleString('es-ES')
            };
            
            showStatus('Reporte generado exitosamente', 'success');
            showDownloadModal();
        } else {
            showStatus('No se pudo abrir ventana. Verifique que no esté bloqueada por el navegador.', 'error');
        }
        
    } catch (error) {
        console.error('Error generando reporte:', error);
        showStatus('Error al generar reporte: ' + error.message, 'error');
    }
}

function generateReportHTML(fechaDesde, fechaHasta) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Reporte CESPSIC</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #667eea; padding-bottom: 20px; }
        .info { margin-bottom: 20px; background: #f8f9ff; padding: 15px; border-radius: 8px; }
        .content { margin: 20px 0; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #667eea; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .controls { text-align: center; margin: 20px 0; }
        .btn { padding: 12px 24px; margin: 5px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
        .btn-primary { background: #667eea; color: white; }
        .btn-secondary { background: #dc3545; color: white; }
        @media print {
            .controls { display: none; }
            body { margin: 0; }
        }
        @media (max-width: 768px) {
            body { margin: 10px; }
            table { font-size: 14px; }
            th, td { padding: 6px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>REPORTE DE ASISTENCIAS - CESPSIC</h1>
        <h2>Universidad Autónoma de Sinaloa</h2>
        <h3>Centro de Servicios Psicológicos a la Comunidad</h3>
    </div>
    
    <div class="info">
        <p><strong>Período:</strong> ${fechaDesde} al ${fechaHasta}</p>
        <p><strong>Generado por:</strong> ${currentUser ? currentUser.name + ' (' + currentUser.email + ')' : 'Usuario'}</p>
        <p><strong>Fecha de generación:</strong> ${new Date().toLocaleString('es-ES')}</p>
        <p><strong>Total de registros:</strong> 0 (Reporte de prueba)</p>
    </div>
    
    <div class="content">
        <h3>REPORTE DE PRUEBA</h3>
        <p>Este es un reporte de prueba generado exitosamente. Una vez conectado con Google Sheets, aquí aparecerán los datos reales de asistencia.</p>
        
        <table>
            <thead>
                <tr>
                    <th>Nombre Completo</th>
                    <th>Tipo Estudiante</th>
                    <th>Modalidad</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Tipo Registro</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Ejemplo Usuario Uno</td>
                    <td>Servicio Social</td>
                    <td>Presencial</td>
                    <td>${fechaDesde}</td>
                    <td>08:00</td>
                    <td>Entrada</td>
                </tr>
                <tr>
                    <td>Ejemplo Usuario Dos</td>
                    <td>Prácticas Supervisadas</td>
                    <td>Virtual</td>
                    <td>${fechaHasta}</td>
                    <td>14:30</td>
                    <td>Salida</td>
                </tr>
            </tbody>
        </table>
    </div>
    
    <div class="controls">
        <button class="btn btn-primary" onclick="window.print()">
            📄 Guardar como PDF / Imprimir
        </button>
        <button class="btn btn-secondary" onclick="window.close()">
            ❌ Cerrar
        </button>
        <div style="margin-top: 15px; font-size: 14px; color: #666;">
            <p><strong>Móvil:</strong> Menú → Imprimir → Guardar como PDF</p>
            <p><strong>Laptop:</strong> Ctrl+P → Destino: Guardar como PDF</p>
        </div>
    </div>
    
    <div class="footer">
        <p>Centro de Servicios Psicológicos a la Comunidad (CESPSIC)</p>
        <p>Universidad Autónoma de Sinaloa</p>
        <p>Reporte generado el ${new Date().toLocaleString('es-ES')}</p>
    </div>
</body>
</html>`;
}
function showDownloadModal() {
    const modal = document.getElementById('download-modal');
    if (modal && reportData) {
        document.getElementById('report-period').textContent = reportData.fechaDesde + ' al ' + reportData.fechaHasta;
        document.getElementById('report-count').textContent = reportData.totalRegistros;
        document.getElementById('report-user').textContent = reportData.generadoPor;
        document.getElementById('report-date').textContent = reportData.fechaGeneracion;
        
        document.getElementById('download-btn').onclick = downloadPDF;
        
        modal.style.display = 'flex';
    }
}

function downloadPDF() {
    if (reportData && reportData.url) {
        // Redirigir a la URL del reporte
        window.open(reportData.url, '_blank');
        
        showStatus('Reporte abierto en nueva ventana. Use el botón "Guardar como PDF".', 'success');
        setTimeout(() => {
            closeDownloadModal();
            hideStatus();
        }, 3000);
    }
}

function closeDownloadModal() {
    const modal = document.getElementById('download-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    if (status) {
        status.innerHTML = message;
        status.className = 'status ' + type;
        status.style.display = 'block';
    }
}

function hideStatus() {
    const status = document.getElementById('status');
    if (status) {
        status.style.display = 'none';
    }
}

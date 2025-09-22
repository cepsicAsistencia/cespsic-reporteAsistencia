// Variables globales
let currentUser = null;
let isAuthenticated = false;
let isAuthorized = false;
let reportData = null;

const GOOGLE_CLIENT_ID = '799841037062-kal4vump3frc2f8d33bnp4clc9amdnng.apps.googleusercontent.com';
const SHEET_ID = '146Q1MG0AUCnzacqrN5kBENRuiql8o07Uts-l_gimL2I';

const AUTHORIZED_EMAILS = [
    'jose.lino.flores.madrigal@gmail.com',
    'CEPSIC.atencionpsicologica@gmail.com',
    'adilene@gmail.com'
];

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', function() {
    console.log('Iniciando aplicación de reportes');
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
    } else {
        setTimeout(loadGoogleSignInScript, 100);
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
        console.log('Google Sign-In inicializado');
    } catch (error) {
        console.error('Error inicializando Google Sign-In:', error);
    }
}

function requestAuthentication() {
    console.log('Solicitud de autenticación');
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
        showStatus('Error en la autenticación.', 'error');
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
    showStatus('Acceso autorizado para generar reportes.', 'success');
    setTimeout(() => hideStatus(), 3000);
}

function handleUnauthorizedLogin() {
    showAccessDeniedModal();
    setTimeout(() => signOut(), 5000);
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
        if (typeof google !== 'undefined' && google.accounts) {
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

async function handleGenerateReport(e) {
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
    const filtroEstudiante = document.getElementById('filtro_estudiante').value;
    const filtroModalidad = document.getElementById('filtro_modalidad').value;
    
    if (!fechaDesde || !fechaHasta) {
        showStatus('Debe seleccionar ambas fechas.', 'error');
        return;
    }
    
    try {
        showStatus('Obteniendo datos de Google Sheets...', 'loading');
        
        // CONECTAR CON BACKEND REAL
        const datos = await fetchRealSheetData(fechaDesde, fechaHasta, filtroEstudiante, filtroModalidad);
        
        if (datos.length === 0) {
            showStatus('No se encontraron registros para el período seleccionado.', 'error');
            return;
        }
        
        showStatus('Generando reporte con datos reales...', 'loading');
        generateRealDataReport(datos, fechaDesde, fechaHasta);
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error obteniendo datos: ' + error.message, 'error');
    }
}

async function fetchRealSheetData(fechaDesde, fechaHasta, filtroEstudiante, filtroModalidad) {
    // IMPORTANTE: Reemplaza con tu URL de Google Apps Script para reportes
    const REPORTS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzQkfQBBdzT50JSxQmRytAvIW1p5LecrQAg9SJ2seV4XYZqAcrPZAoKKAIZVtz7ag0/exec';
    
    const requestData = {
        action: 'get_report_data',
        email: currentUser.email,
        google_user_id: currentUser.id,
        usuario_nombre: currentUser.name,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        filtro_estudiante: filtroEstudiante,
        filtro_modalidad: filtroModalidad
    };
    
    const response = await fetch(REPORTS_SCRIPT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    });
    
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.message || 'Error obteniendo datos del servidor');
    }
    
    return result.data;
}

function generateRealDataReport(datos, fechaDesde, fechaHasta) {
    const reportContent = createRealReportHTML(datos, fechaDesde, fechaHasta);
    const blob = new Blob([reportContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    
    if (newWindow) {
        reportData = {
            url: url,
            fechaDesde: fechaDesde,
            fechaHasta: fechaHasta,
            totalRegistros: datos.length,
            generadoPor: currentUser.name,
            fechaGeneracion: new Date().toLocaleString('es-ES')
        };
        
        showDownloadModal();
        showStatus('Reporte con datos reales generado exitosamente', 'success');
    }
}

function createRealReportHTML(datos, fechaDesde, fechaHasta) {
    // Crear tabla con datos reales
    const tableRows = datos.map(row => `
        <tr>
            <td>${row.nombre} ${row.apellido_paterno} ${row.apellido_materno}</td>
            <td>${row.tipo_estudiante}</td>
            <td>${row.modalidad}</td>
            <td>${row.fecha}</td>
            <td>${row.hora}</td>
            <td>${row.tipo_registro}</td>
            <td>${row.intervenciones_psicologicas}</td>
        </tr>
    `).join('');
    
    // Calcular estadísticas reales
    const stats = {
        totalRegistros: datos.length,
        totalIntervenciones: datos.reduce((sum, row) => sum + row.intervenciones_psicologicas, 0),
        presencial: datos.filter(row => row.modalidad === 'presencial').length,
        virtual: datos.filter(row => row.modalidad === 'virtual').length
    };
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Reporte CESPSIC ${fechaDesde} - ${fechaHasta}</title>
    <!-- Mismos estilos CSS de antes -->
</head>
<body>
    <!-- Header igual -->
    
    <div class="info">
        <p><strong>Período:</strong> ${fechaDesde} al ${fechaHasta}</p>
        <p><strong>Generado por:</strong> ${currentUser.name} (${currentUser.email})</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
        <p><strong>Total registros:</strong> ${stats.totalRegistros}</p>
        <p><strong>Estado:</strong> Datos reales de Google Sheets</p>
    </div>
    
    <div class="content">
        <h3>DATOS DE ASISTENCIA REALES</h3>
        
        <table>
            <thead>
                <tr>
                    <th>Nombre Completo</th>
                    <th>Tipo Estudiante</th>
                    <th>Modalidad</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Tipo Registro</th>
                    <th>Intervenciones</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
        
        <h4>Estadísticas</h4>
        <ul>
            <li>Total registros: ${stats.totalRegistros}</li>
            <li>Total intervenciones: ${stats.totalIntervenciones}</li>
            <li>Presencial: ${stats.presencial} registros</li>
            <li>Virtual: ${stats.virtual} registros</li>
        </ul>
    </div>
    
    <!-- Resto del HTML igual -->
</body>
</html>`;
}

function generateReportHTML_Direct(fechaDesde, fechaHasta) {
    try {
        const reportContent = createReportHTML(fechaDesde, fechaHasta);
        const blob = new Blob([reportContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
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
            
            showDownloadModal();
            showStatus('Reporte generado exitosamente', 'success');
        } else {
            showStatus('Verifique que las ventanas emergentes estén permitidas.', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error generando reporte: ' + error.message, 'error');
    }
}

function createReportHTML(fechaDesde, fechaHasta) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Reporte CESPSIC ${fechaDesde} - ${fechaHasta}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #667eea; padding-bottom: 20px; }
        .info { background: #f8f9ff; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .content { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #667eea; color: white; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .controls { text-align: center; margin: 30px 0; }
        .btn { padding: 15px 30px; margin: 10px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold; }
        .btn-primary { background: #667eea; color: white; }
        .btn-secondary { background: #dc3545; color: white; }
        .btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
        @media print { .controls { display: none; } body { margin: 0; } }
        @media (max-width: 768px) { 
            body { margin: 10px; } 
            table { font-size: 14px; } 
            th, td { padding: 8px; }
            .btn { padding: 12px 20px; font-size: 14px; }
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
        <p><strong>Período de consulta:</strong> ${fechaDesde} al ${fechaHasta}</p>
        <p><strong>Generado por:</strong> ${currentUser ? currentUser.name + ' (' + currentUser.email + ')' : 'Usuario de prueba'}</p>
        <p><strong>Fecha de generación:</strong> ${new Date().toLocaleString('es-ES')}</p>
        <p><strong>Total de registros:</strong> 2 (Datos de ejemplo)</p>
        <p><strong>Estado:</strong> Reporte de prueba - Conectar con Google Sheets para datos reales</p>
    </div>
    
    <div class="content">
        <h3>DATOS DE ASISTENCIA</h3>
        <p>Los siguientes son datos de ejemplo. Una vez conectado el backend, aquí aparecerán los registros reales del período seleccionado.</p>
        
        <table>
            <thead>
                <tr>
                    <th>Nombre Completo</th>
                    <th>Tipo de Estudiante</th>
                    <th>Modalidad</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Tipo de Registro</th>
                    <th>Intervenciones</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>María González López</td>
                    <td>Servicio Social</td>
                    <td>Presencial</td>
                    <td>${fechaDesde}</td>
                    <td>08:00</td>
                    <td>Entrada</td>
                    <td>3</td>
                </tr>
                <tr>
                    <td>Carlos Rodríguez Hernández</td>
                    <td>Prácticas Supervisadas</td>
                    <td>Virtual</td>
                    <td>${fechaHasta}</td>
                    <td>14:30</td>
                    <td>Salida</td>
                    <td>5</td>
                </tr>
            </tbody>
        </table>
        
        <h4>Resumen Estadístico</h4>
        <ul>
            <li>Total de estudiantes únicos: 2</li>
            <li>Total de intervenciones psicológicas: 8</li>
            <li>Modalidad presencial: 1 registro</li>
            <li>Modalidad virtual: 1 registro</li>
        </ul>
    </div>
    
    <div class="controls">
        <button class="btn btn-primary" onclick="window.print()">
            📄 Guardar como PDF / Imprimir
        </button>
        <button class="btn btn-secondary" onclick="window.close()">
            ❌ Cerrar Ventana
        </button>
        <div style="margin-top: 20px; font-size: 14px; color: #666;">
            <p><strong>Instrucciones:</strong></p>
            <p><strong>Móvil:</strong> Menú (⋮) → Imprimir → Guardar como PDF</p>
            <p><strong>Computadora:</strong> Ctrl+P → Destino: Guardar como PDF</p>
        </div>
    </div>
    
    <div class="footer">
        <p><strong>Centro de Servicios Psicológicos a la Comunidad (CESPSIC)</strong></p>
        <p>Universidad Autónoma de Sinaloa</p>
        <p>Facultad de Psicología</p>
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
        
        document.getElementById('download-btn').onclick = downloadReport;
        modal.style.display = 'flex';
    }
}

function downloadReport() {
    if (reportData && reportData.url) {
        window.open(reportData.url, '_blank');
        showStatus('Reporte abierto. Use "Guardar como PDF" en la nueva ventana.', 'success');
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

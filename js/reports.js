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
        // Verificar carga de jsPDF
        if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
            showStatus('Error: Librería PDF no cargada. Recargue la página.', 'error');
            return;
        }
        
        // Intentar ambos métodos de acceso a jsPDF
        let doc;
        if (typeof jsPDF !== 'undefined') {
            doc = new jsPDF();
        } else if (typeof window.jspdf !== 'undefined') {
            const { jsPDF } = window.jspdf;
            doc = new jsPDF();
        } else {
            showStatus('Error: No se puede acceder a jsPDF.', 'error');
            return;
        }
        
        // Resto de la función igual...
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('REPORTE DE ASISTENCIAS - CESPSIC', 20, 20);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text('Período: ' + fechaDesde + ' al ' + fechaHasta, 20, 40);
        doc.text('Generado por: ' + (currentUser ? currentUser.name : 'Usuario'), 20, 50);
        doc.text('Fecha: ' + new Date().toLocaleString('es-ES'), 20, 60);
        doc.text('REPORTE DE PRUEBA - CESPSIC', 20, 80);
        doc.text('Este es un reporte de prueba generado exitosamente.', 20, 100);
        
        reportData = {
            pdf: doc,
            fechaDesde: fechaDesde,
            fechaHasta: fechaHasta,
            totalRegistros: 0,
            generadoPor: currentUser ? currentUser.name : 'Usuario',
            fechaGeneracion: new Date().toLocaleString('es-ES')
        };
        
        showDownloadModal();
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        showStatus('Error al generar PDF: ' + error.message, 'error');
    }
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
    if (reportData && reportData.pdf) {
        const fileName = 'Reporte_CESPSIC_' + reportData.fechaDesde + '_' + reportData.fechaHasta + '.pdf';
        reportData.pdf.save(fileName);
        
        showStatus('Archivo PDF descargado exitosamente.', 'success');
        setTimeout(() => {
            closeDownloadModal();
            hideStatus();
        }, 2000);
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

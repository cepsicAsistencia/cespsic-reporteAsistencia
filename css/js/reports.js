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
    'adilene@gmail.com' // Completar el email de Adilene
];

// Mapeo de columnas del Google Sheet
const COLUMN_MAPPING = {
    N: 'Nombre',
    O: 'Apellido_Paterno', 
    P: 'Apellido_Materno',
    Q: 'Tipo_Estudiante',
    R: 'Modalidad',
    S: 'Fecha',
    T: 'Hora',
    U: 'Tipo_Registro',
    X: 'Intervenciones_Psicologicas',
    Y: 'Ninos_Ninas',
    Z: 'Adolescentes',
    AA: 'Adultos',
    AB: 'Mayores_60',
    AC: 'Familia',
    AH: 'Total_Evidencias',
    AD: 'Actividades_Realizadas',
    AE: 'Actividades_Varias_Detalle',
    AF: 'Pruebas_Psicologicas_Detalle',
    AG: 'Comentarios_Adicionales',
    V: 'Permiso_Detalle',
    W: 'Otro_Detalle'
};

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== INICIANDO APLICACIÓN DE REPORTES ===');
    
    initializeForm();
    setupEventListeners();
    loadGoogleSignInScript();
    blockGooglePrompts();
});

function initializeForm() {
    // Establecer fecha máxima como hoy
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fecha_hasta').max = today;
    
    // Establecer fecha desde como 30 días atrás por defecto
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    document.getElementById('fecha_desde').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('fecha_hasta').value = today;
}

function setupEventListeners() {
    // Validar fechas
    document.getElementById('fecha_desde').addEventListener('change', validateDates);
    document.getElementById('fecha_hasta').addEventListener('change', validateDates);
    
    // Manejo del formulario
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

// ========== GOOGLE SIGN-IN FUNCTIONS ==========

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
        google.accounts.id.disableAutoSelect();
        google.accounts.id.cancel();
        
        const originalPrompt = google.accounts.id.prompt;
        google.accounts.id.prompt = function(callback) {
            console.log('PROMPT BLOQUEADO - redirigiendo a botón manual');
            if (callback) {
                callback({
                    isNotDisplayed: () => true,
                    isSkippedMoment: () => true,
                    getNotDisplayedReason: () => 'BLOCKED_BY_APP'
                });
            }
        };
        
        console.log('Google prompts completamente bloqueados');
        
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

        google.accounts.id.disableAutoSelect();
        google.accounts.id.cancel();

        console.log('Google Sign-In inicializado para reportes');

    } catch (error) {
        console.error('Error inicializando Google Sign-In:', error);
        showStatus('Error cargando sistema de autenticación. Verifique su conexión.', 'error');
    }
}

function requestAuthentication() {
    console.log('Solicitud de autenticación administrativa');
    showAuthModal();
}

function showAuthModal() {
    const modal = document.getElementById('google-auth-modal');
    modal.style.display = 'flex';
    
    setTimeout(() => {
        const buttonContainer = document.getElementById('google-button-container');
        if (buttonContainer) {
            google.accounts.id.renderButton(buttonContainer, {
                theme: "filled_blue",
                size: "large",
                text: "signin_with",
                shape: "rectangular"
            });
        }
    }, 100);
}

function closeAuthModal() {
    const modal = document.getElementById('google-auth-modal');
    modal.style.display = 'none';
}

async function handleCredentialResponse(response) {
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
            showStatus('Su cuenta de Gmail no está verificada. Use una cuenta verificada.', 'error');
            return;
        }

        // Verificar autorización
        if (AUTHORIZED_EMAILS.includes(currentUser.email.toLowerCase())) {
            await handleAuthorizedLogin();
        } else {
            handleUnauthorizedLogin();
        }

    } catch (error) {
        console.error('Error procesando credenciales:', error);
        showStatus('Error en la autenticación. Intente nuevamente.', 'error');
    }
}

async function handleAuthorizedLogin() {
    isAuthenticated = true;
    isAuthorized = true;
    
    // Determinar rol
    let userRole = 'Personal Autorizado';
    if (currentUser.email === 'jose.lino.flores.madrigal@gmail.com') {
        userRole = 'Administrador Principal';
    } else if (currentUser.email === 'CEPSIC.atencionpsicologica@gmail.com') {
        userRole = 'Coordinador CESPSIC';
    }
    
    updateAuthenticationUI(userRole);
    enableReportsForm();
    
    showStatus(`Bienvenido ${currentUser.name}. Acceso autorizado para generar reportes.`, 'success');
    setTimeout(() => hideStatus(), 3000);
}

function handleUnauthorizedLogin() {
    isAuthenticated = true;
    isAuthorized = false;
    
    showAccessDeniedModal();
    
    // Auto-logout después de mostrar el mensaje
    setTimeout(() => {
        signOut();
    }, 5000);
}

function showAccessDeniedModal() {
    const modal = document.getElementById('access-denied-modal');
    modal.style.display = 'flex';
}

function closeAccessDeniedModal() {
    const modal = document.getElementById('access-denied-modal');
    modal.style.display = 'none';
}

function updateAuthenticationUI(userRole) {
    const authSection = document.getElementById('auth-section');
    const authTitle = document.getElementById('auth-title');
    const userInfo = document.getElementById('user-info');
    const signinContainer = document.getElementById('signin-button-container');

    if (isAuthenticated && isAuthorized) {
        authSection.classList.add('authenticated');
        authTitle.textContent = '✅ Acceso Autorizado';
        authTitle.classList.add('authenticated');

        document.getElementById('user-avatar').src = currentUser.picture;
        document.getElementById('user-email').textContent = currentUser.email;
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('user-role').textContent = userRole;
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

function enableReportsForm() {
    const formContainer = document.getElementById('reports-container');
    formContainer.classList.add('authenticated');
    
    const generateBtn = document.getElementById('generate_btn');
    generateBtn.disabled = false;
    generateBtn.textContent = '📊 Generar Reporte PDF';
}

function signOut() {
    try {
        google.accounts.id.disableAutoSelect();
        
        isAuthenticated = false;
        isAuthorized = false;
        currentUser = null;
        reportData = null;

        updateAuthenticationUI();
        disableReportsForm();

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

function disableReportsForm() {
    const formContainer = document.getElementById('reports-container');
    formContainer.classList.remove('authenticated');
    
    const generateBtn = document.getElementById('generate_btn');
    generateBtn.disabled = true;
    generateBtn.textContent = '🔒 Autentíquese para generar reportes';
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

// ========== GENERACIÓN DE REPORTES ==========

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
        showStatus('Obteniendo datos de Google Sheets... 📊', 'loading');
        
        const datos = await fetchSheetData(fechaDesde, fechaHasta, filtroEstudiante, filtroModalidad);
        
        if (datos.length === 0) {
            showStatus('No se encontraron registros para el período seleccionado.', 'error');
            return;
        }
        
        showStatus('Generando PDF... 📄', 'loading');
        
        generatePDF(datos, fechaDesde, fechaHasta);
        
        showStatus('Reporte generado exitosamente.', 'success');
        
    } catch (error) {
        console.error('Error generando reporte:', error);
        showStatus('Error al generar el reporte. Intente nuevamente.', 'error');
    }
}

async function fetchSheetData(fechaDesde, fechaHasta, filtroEstudiante, filtroModalidad) {
    try {
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
            filtro_modalidad: filtroModalidad,
            timestamp: new Date().toISOString()
        };
        
        console.log('Enviando solicitud de datos:', requestData);
        
        const response = await fetch(REPORTS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Error obteniendo datos del servidor');
        }
        
        console.log('Datos obtenidos exitosamente:', result.total_records, 'registros');
        
        return result.data;
        
    } catch (error) {
        console.error('Error obteniendo datos:', error);
        throw new Error('Error conectando con Google Sheets: ' + error.message);
    }
}

function generatePDF(datos, fechaDesde, fechaHasta) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape'); // Orientación horizontal para más columnas
        
        // Configurar el documento
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('REPORTE DE ASISTENCIAS - CESPSIC', 20, 20);
        
        // Información del encabezado
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Universidad Autónoma de Sinaloa - Centro de Servicios Psicológicos a la Comunidad`, 20, 30);
        doc.text(`Período: ${fechaDesde} al ${fechaHasta}`, 20, 40);
        doc.text(`Generado por: ${currentUser.name} (${currentUser.email})`, 20, 50);
        doc.text(`Fecha de generación: ${new Date().toLocaleString('es-ES')}`, 20, 60);
        doc.text(`Total de registros: ${datos.length}`, 20, 70);
        
        // Línea separadora
        doc.setDrawColor(102, 126, 234);
        doc.setLineWidth(0.5);
        doc.line(20, 75, 277, 75);
        
        // Preparar datos para la tabla
        const headers = [
            'Nombre Completo',
            'Tipo Estudiante',
            'Modalidad',
            'Fecha',
            'Hora',
            'Tipo Registro',
            'Interv.',
            'Niños',
            'Adol.',
            'Adult.',
            'May60',
            'Fam.',
            'Evid.',
            'Actividades'
        ];
        
        const tableData = datos.map(row => [
            `${row.nombre} ${row.apellido_paterno} ${row.apellido_materno}`.trim(),
            row.tipo_estudiante || '',
            row.modalidad || '',
            row.fecha || '',
            row.hora || '',
            row.tipo_registro || '',
            row.intervenciones_psicologicas.toString(),
            row.ninos_ninas.toString(),
            row.adolescentes.toString(),
            row.adultos.toString(),
            row.mayores_60.toString(),
            row.familia.toString(),
            row.total_evidencias.toString(),
            (row.actividades_realizadas || '').substring(0, 30) + (row.actividades_realizadas && row.actividades_realizadas.length > 30 ? '...' : '')
        ]);
        
        // Generar tabla con autoTable
        doc.autoTable({
            head: [headers],
            body: tableData,
            startY: 85,
            styles: {
                fontSize: 7,
                cellPadding: 1.5,
                overflow: 'linebreak',
                halign: 'center'
            },
            headStyles: {
                fillColor: [102, 126, 234],
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            columnStyles: {
                0: { halign: 'left', cellWidth: 35 }, // Nombre
                1: { halign: 'center', cellWidth: 25 }, // Tipo estudiante
                2: { halign: 'center', cellWidth: 20 }, // Modalidad
                3: { halign: 'center', cellWidth: 20 }, // Fecha
                4: { halign: 'center', cellWidth: 15 }, // Hora
                5: { halign: 'center', cellWidth: 20 }, // Tipo registro
                6: { halign: 'center', cellWidth: 12 }, // Intervenciones
                7: { halign: 'center', cellWidth: 12 }, // Niños
                8: { halign: 'center', cellWidth: 12 }, // Adolescentes
                9: { halign: 'center', cellWidth: 12 }, // Adultos
                10: { halign: 'center', cellWidth: 12 }, // Mayores 60
                11: { halign: 'center', cellWidth: 12 }, // Familia
                12: { halign: 'center', cellWidth: 12 }, // Evidencias
                13: { halign: 'left', cellWidth: 35 } // Actividades
            },
            margin: { top: 85, left: 10, right: 10 },
            theme: 'striped'
        });
        
        // Resumen estadístico al final
        const finalY = doc.lastAutoTable.finalY + 15;
        
        // Calcular estadísticas
        const stats = calculateStatistics(datos);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('RESUMEN ESTADÍSTICO', 20, finalY);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        let currentY = finalY + 10;
        doc.text(`Total de estudiantes únicos: ${stats.estudiantesUnicos}`, 20, currentY);
        currentY += 6;
        doc.text(`Total de intervenciones psicológicas: ${stats.totalIntervenciones}`, 20, currentY);
        currentY += 6;
        doc.text(`Distribución por modalidad: Presencial: ${stats.presencial}, Virtual: ${stats.virtual}`, 20, currentY);
        currentY += 6;
        doc.text(`Tipos de registro: Entrada: ${stats.entradas}, Salida: ${stats.salidas}, Otros: ${stats.otros}`, 20, currentY);
        currentY += 6;
        doc.text(`Total de evidencias subidas: ${stats.totalEvidencias}`, 20, currentY);
        
        // Pie de página
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(`Página ${i} de ${pageCount}`, 240, 200);
            doc.text('CESPSIC - Universidad Autónoma de Sinaloa', 20, 200);
        }
        
        // Guardar datos para descarga
        reportData = {
            pdf: doc,
            fechaDesde,
            fechaHasta,
            totalRegistros: datos.length,
            generadoPor: currentUser.name,
            fechaGeneracion: new Date().toLocaleString('es-ES'),
            estadisticas: stats
        };
        
        // Registrar generación en backend
        logReportGeneration(datos.length);
        
        showDownloadModal();
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        throw new Error('Error al generar el PDF: ' + error.message);
    }
}

function calculateStatistics(datos) {
    const stats = {
        estudiantesUnicos: 0,
        totalIntervenciones: 0,
        presencial: 0,
        virtual: 0,
        entradas: 0,
        salidas: 0,
        otros: 0,
        totalEvidencias: 0,
        porTipoEstudiante: {},
        porActividades: {}
    };
    
    const estudiantesVistos = new Set();
    
    datos.forEach(registro => {
        // Estudiantes únicos
        const nombreCompleto = `${registro.nombre} ${registro.apellido_paterno} ${registro.apellido_materno}`.trim();
        estudiantesVistos.add(nombreCompleto);
        
        // Intervenciones
        stats.totalIntervenciones += registro.intervenciones_psicologicas;
        
        // Modalidad
        if (registro.modalidad === 'presencial') stats.presencial++;
        else if (registro.modalidad === 'virtual') stats.virtual++;
        
        // Tipo de registro
        if (registro.tipo_registro === 'entrada') stats.entradas++;
        else if (registro.tipo_registro === 'salida') stats.salidas++;
        else stats.otros++;
        
        // Evidencias
        stats.totalEvidencias += registro.total_evidencias;
        
        // Por tipo de estudiante
        const tipo = registro.tipo_estudiante || 'Sin especificar';
        stats.porTipoEstudiante[tipo] = (stats.porTipoEstudiante[tipo] || 0) + 1;
    });
    
    stats.estudiantesUnicos = estudiantesVistos.size;
    
    return stats;
}

async function logReportGeneration(totalRegistros) {
    try {
        const REPORTS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzQkfQBBdzT50JSxQmRytAvIW1p5LecrQAg9SJ2seV4XYZqAcrPZAoKKAIZVtz7ag0/exec';
        
        const logData = {
            action: 'log_report_generation',
            email: currentUser.email,
            google_user_id: currentUser.id,
            usuario_nombre: currentUser.name,
            fecha_desde: document.getElementById('fecha_desde').value,
            fecha_hasta: document.getElementById('fecha_hasta').value,
            filtro_estudiante: document.getElementById('filtro_estudiante').value,
            filtro_modalidad: document.getElementById('filtro_modalidad').value,
            total_registros: totalRegistros,
            timestamp: new Date().toISOString()
        };
        
        await fetch(REPORTS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(logData)
        });
        
        console.log('Generación de reporte registrada en log');
        
    } catch (error) {
        console.error('Error registrando log (no crítico):', error);
    }
}

function generatePDF(datos, fechaDesde, fechaHasta) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Configurar el documento
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Reporte de Asistencias - CESPSIC', 20, 20);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`Período: ${fechaDesde} al ${fechaHasta}`, 20, 30);
    doc.text(`Generado por: ${currentUser.name} (${currentUser.email})`, 20, 40);
    doc.text(`Fecha de generación: ${new Date().toLocaleString('es-ES')}`, 20, 50);
    doc.text(`Total de registros: ${datos.length}`, 20, 60);
    
    // Preparar datos para la tabla
    const headers = [
        'Nombre Completo',
        'Tipo Estudiante',
        'Modalidad',
        'Fecha',
        'Hora',
        'Tipo Registro',
        'Intervenciones',
        'Niños',
        'Adolesc.',
        'Adultos',
        'Mayor 60',
        'Familia',
        'Evidencias'
    ];
    
    const tableData = datos.map(row => [
        `${row[13] || ''} ${row[14] || ''} ${row[15] || ''}`.trim(), // Nombre completo
        row[16] || '', // Tipo estudiante
        row[17] || '', // Modalidad
        row[18] || '', // Fecha
        row[19] || '', // Hora
        row[20] || '', // Tipo registro
        row[23] || '0', // Intervenciones
        row[24] || '0', // Niños
        row[25] || '0', // Adolescentes
        row[26] || '0', // Adultos
        row[27] || '0', // Mayores 60
        row[28] || '0', // Familia
        row[33] || '0'  // Total evidencias
    ]);
    
    // Generar tabla
    doc.autoTable({
        head: [headers],
        body: tableData,
        startY: 75,
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
            fillColor: [245, 245, 245]
        },
        margin: { top: 75, left: 10, right: 10 }
    });
    
    // Guardar datos para descarga
    reportData = {
        pdf: doc,
        fechaDesde,
        fechaHasta,
        totalRegistros: datos.length,
        generadoPor: currentUser.name,
        fechaGeneracion: new Date().toLocaleString('es-ES')
    };
    
    showDownloadModal();
}

function showDownloadModal() {
    const modal = document.getElementById('download-modal');
    
    document.getElementById('report-period').textContent = `${reportData.fechaDesde} al ${reportData.fechaHasta}`;
    document.getElementById('report-count').textContent = reportData.totalRegistros;
    document.getElementById('report-user').textContent = reportData.generadoPor;
    document.getElementById('report-date').textContent = reportData.fechaGeneracion;
    
    document.getElementById('download-btn').onclick = downloadPDF;
    
    modal.style.display = 'flex';
}

function downloadPDF() {
    if (reportData && reportData.pdf) {
        const fileName = `Reporte_Asistencias_CESPSIC_${reportData.fechaDesde}_${reportData.fechaHasta}.pdf`;
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
    modal.style.display = 'none';
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
} '

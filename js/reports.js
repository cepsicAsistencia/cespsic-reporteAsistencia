// ========== VARIABLES Y CONFIGURACIÓN ==========
let isAuthenticated = false;
let currentUser = null;
let attendanceData = [];
let pdfBlob = null;
let isAdmin = false;

// CONFIGURACIÓN PRODUCCION
const GOOGLE_CLIENT_ID = '799841037062-kal4vump3frc2f8d33bnp4clc9amdnng.apps.googleusercontent.com';
const SHEET_ID = '146Q1MG0AUCnzacqrN5kBENRuiql8o07Uts-l_gimL2I';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyN49EgjqFoE4Gwos_gnu5lM5XERnGfKejEcI-eVuxb68EgJ4wes2DAorINEZ9xVCI/exec';

//PRUEBAS
//const GOOGLE_CLIENT_ID = '154864030871-ck4l5krb7qm68kmp6a7rcq7h072ldm6g.apps.googleusercontent.com';
//const SHEET_ID = '1YLmEuA-O3Vc1fWRQ1nC_BojOUSVmzBb8QxCCsb5tQwk';
//const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzBJRaLjii8Y8F_9XC3_n5e--R2bzDXqrfWHeFUIYn3cRct-qVHZ1VEgJEj8XKEU9Ch/exec';

const AUTHORIZED_USERS = ['jose.lino.flores.madrigal@gmail.com','cepsic.atencionpsicologica@gmail.com','adymadrid.22@gmail.com','cespsic@uas.edu.mx'];
const ADMIN_USERS = ['jose.lino.flores.madrigal@gmail.com','cepsic.atencionpsicologica@gmail.com','cespsic@uas.edu.mx'];

let authenticationAttempts = 0;
const MAX_AUTH_ATTEMPTS = 3;
const FETCH_CONFIG = {timeout: 90000,maxRetries: 3,retryDelay: 2000};

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DOM CARGADO ===');
    initializeApp();
});

function initializeApp() {
    const container = document.getElementById('signin-button-container');
    if (!container) return;
    showLoadingMessage('Iniciando...');
    setupEventListeners();
    setMaxDate();
    initializeGoogleSignInWithRetry();
}

function showLoadingMessage(msg) {
    document.getElementById('signin-button-container').innerHTML = `<div style="text-align:center;padding:20px;color:#666;"><div style="display:inline-block;animation:spin 1s linear infinite;">🔄</div>${msg}</div><style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>`;
}

function initializeGoogleSignInWithRetry() {
    let attempts = 0;
    function tryInit() {
        attempts++;
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            initializeGoogleSignIn();
        } else if (attempts < 15) {
            setTimeout(tryInit, 1000);
        } else {
            showAuthenticationError('No se cargó Google Sign-In');
        }
    }
    tryInit();
}

function initializeGoogleSignIn() {
    try {
        google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:handleCredentialResponse,auto_select:false,cancel_on_tap_outside:true,use_fedcm_for_prompt:false});
        const container = document.getElementById("signin-button-container");
        container.innerHTML = '';
        google.accounts.id.renderButton(container, {theme:"filled_blue",size:"large",text:"signin_with",shape:"rectangular",logo_alignment:"left",width:"280",locale:"es"});
        setTimeout(checkBackendAvailability, 2000);
    } catch (error) {
        showAuthenticationError('Error: ' + error.message);
    }
}

async function checkBackendAvailability() {
    try {
        const response = await fetchWithTimeoutAndRetry(GOOGLE_SCRIPT_URL + '?action=test_permissions', {method:'GET'});
        if (response.ok) {
            showStatus('Sistema listo', 'success');
            setTimeout(() => hideStatus(), 3000);
        }
    } catch (error) {
        console.warn('Backend warning:', error.message);
    }
}

// ========== AUTENTICACIÓN ==========
function handleCredentialResponse(response) {
    try {
        authenticationAttempts++;
        if (authenticationAttempts > MAX_AUTH_ATTEMPTS) {
            showStatus('Demasiados intentos', 'error');
            return;
        }
        const userInfo = parseJwt(response.credential);
        if (!userInfo) throw new Error('No se procesó usuario');
        if (!AUTHORIZED_USERS.includes(userInfo.email)) {
            showStatus(`Acceso denegado: ${userInfo.email}`, 'error');
            return;
        }
        if (!userInfo.email_verified) {
            showStatus('Cuenta no verificada', 'error');
            return;
        }
        isAdmin = ADMIN_USERS.includes(userInfo.email);
        currentUser = {id:userInfo.sub,email:userInfo.email,name:userInfo.name,picture:userInfo.picture,email_verified:userInfo.email_verified,isAdmin:isAdmin};
        isAuthenticated = true;
        updateAuthenticationUI();
        enableForm();
        if (isAdmin) {
            showAdminControls();
        } else {
            showRegularUserControls();
        }
        setTimeout(() => testBackendPermissions(), 1000);
        showStatus(`Bienvenido ${currentUser.name}!${isAdmin?' (Admin)':''}`, 'success');
        setTimeout(() => hideStatus(), 4000);
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
    }
}

function showAdminControls() {
    const adminSection = document.getElementById('admin-controls-section');
    if (adminSection) adminSection.style.display = 'block';
    const evidenciasCheckbox = document.querySelector('.checkbox-evidencias');
    if (evidenciasCheckbox) evidenciasCheckbox.style.display = 'flex';
    setupAdminFilters();
}

function showRegularUserControls() {
    // Ocultar controles de admin
    const adminSection = document.getElementById('admin-controls-section');
    if (adminSection) adminSection.style.display = 'none';
    const evidenciasCheckbox = document.querySelector('.checkbox-evidencias');
    if (evidenciasCheckbox) evidenciasCheckbox.style.display = 'none';
    
    // Cargar automáticamente el filtro de usuarios para seleccionar su nombre
    updateUserFilterForRegularUser();
}

async function updateUserFilterForRegularUser() {
    const fechaDesde = document.getElementById('fecha_desde').value;
    const fechaHasta = document.getElementById('fecha_hasta').value;
    
    if (!fechaDesde || !fechaHasta) return;
    
    try {
        showStatus('Cargando usuarios...', 'loading');
        const result = await makeBackendRequestWithRetry('get_users_in_range', {fechaDesde,fechaHasta});
        
        if (result.success && result.users && result.users.length > 0) {
            // Mostrar mensaje para que el usuario seleccione su nombre
            showStatus('Por favor, selecciona tu nombre en el filtro de usuario', 'loading');
            setTimeout(() => hideStatus(), 5000);
        } else {
            hideStatus();
        }
    } catch (error) {
        console.error('Error usuarios:', error);
        hideStatus();
    }
}

function setupAdminFilters() {
    const fechaDesde = document.getElementById('fecha_desde');
    const fechaHasta = document.getElementById('fecha_hasta');
    if (fechaDesde && fechaHasta) {
        fechaDesde.addEventListener('change', updateUserFilter);
        fechaHasta.addEventListener('change', updateUserFilter);
    }
    updateUserFilter();
}

async function updateUserFilter() {
    if (!isAdmin) return;
    const fechaDesde = document.getElementById('fecha_desde').value;
    const fechaHasta = document.getElementById('fecha_hasta').value;
    const userSelect = document.getElementById('filtro_usuario');
    if (!fechaDesde || !fechaHasta || !userSelect) return;
    try {
        showStatus('Cargando usuarios...', 'loading');
        const result = await makeBackendRequestWithRetry('get_users_in_range', {fechaDesde,fechaHasta});
        if (result.success && result.users) {
            userSelect.innerHTML = '<option value="">Todos los usuarios</option>';
            result.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user;
                option.textContent = user;
                userSelect.appendChild(option);
            });
            hideStatus();
        }
    } catch (error) {
        console.error('Error usuarios:', error);
        hideStatus();
    }
}

async function testBackendPermissions() {
    try {
        showStatus('Verificando...', 'loading');
        const testResult = await makeBackendRequestWithRetry('test_permissions', {});
        if (testResult.success) {
            const failedTests = Object.values(testResult.tests || {}).filter(test => !test.success);
            showStatus(failedTests.length === 0 ? 'Sistema OK' : `${failedTests.length} problemas`, failedTests.length === 0 ? 'success' : 'error');
        } else {
            showStatus('Error: ' + testResult.message, 'error');
        }
        setTimeout(() => hideStatus(), 5000);
    } catch (error) {
        showStatus('No verificado', 'error');
    }
}

// ========== COMUNICACIÓN BACKEND ==========
async function makeBackendRequestWithRetry(action, additionalData = {}) {
    let lastError = null;
    for (let attempt = 1; attempt <= FETCH_CONFIG.maxRetries; attempt++) {
        try {
            console.log(`🔄 Intento ${attempt}/${FETCH_CONFIG.maxRetries}: ${action}`);
            const result = await makeBackendRequest(action, additionalData);
            console.log('✅ OK');
            return result;
        } catch (error) {
            lastError = error;
            console.warn(`⚠️ Intento ${attempt} falló:`, error.message);
            if (attempt < FETCH_CONFIG.maxRetries) {
                const delay = FETCH_CONFIG.retryDelay * attempt;
                await sleep(delay);
            }
        }
    }
    throw new Error(`Error tras ${FETCH_CONFIG.maxRetries} intentos: ${lastError.message}`);
}

async function makeBackendRequest(action, additionalData = {}) {
    const requestData = {action,userEmail:currentUser.email,timestamp:new Date().toISOString(),...additionalData};
    try {
        const jsonpResponse = await fetchWithJSONP(GOOGLE_SCRIPT_URL, requestData, FETCH_CONFIG.timeout);
        if (jsonpResponse && jsonpResponse.success !== undefined) return jsonpResponse;
    } catch (jsonpError) {
        console.log('⚠️ JSONP falló');
    }
    try {
        const response = await fetchWithTimeoutAndRetry(GOOGLE_SCRIPT_URL, {method:'POST',mode:'cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(requestData)});
        if (response.ok) {
            return await response.json();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (fetchError) {
        throw new Error('No conectó: ' + fetchError.message);
    }
}

async function fetchWithTimeoutAndRetry(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_CONFIG.timeout);
    try {
        const response = await fetch(url, {...options,signal:controller.signal});
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') throw new Error(`Timeout ${FETCH_CONFIG.timeout}ms`);
        throw error;
    }
}

async function fetchWithJSONP(url, data, timeout = 90000) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        const script = document.createElement('script');
        const params = new URLSearchParams({...data,callback:callbackName});
        window[callbackName] = function(response) {
            cleanup();
            resolve(response);
        };
        function cleanup() {
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        }
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error(`Timeout JSONP`));
        }, timeout);
        script.onload = () => clearTimeout(timeoutId);
        script.onerror = () => {
            cleanup();
            clearTimeout(timeoutId);
            reject(new Error('Error script'));
        };
        script.src = `${url}?${params.toString()}`;
        document.head.appendChild(script);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        return null;
    }
}

// ========== UI ==========
function updateAuthenticationUI() {
    const authSection = document.getElementById('auth-section');
    const authTitle = document.getElementById('auth-title');
    const userInfo = document.getElementById('user-info');
    const signinContainer = document.getElementById('signin-button-container');
    if (isAuthenticated && currentUser) {
        authSection.classList.add('authenticated');
        authTitle.textContent = `✅ Autorizado ${isAdmin?'(Admin)':''}`;
        authTitle.classList.add('authenticated');
        document.getElementById('user-avatar').src = currentUser.picture;
        document.getElementById('user-email').textContent = currentUser.email;
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('user-status').textContent = isAdmin ? '👑 Administrador' : '✅ Autorizado';
        userInfo.classList.add('show');
        signinContainer.style.display = 'none';
    } else {
        authSection.classList.remove('authenticated');
        authTitle.textContent = '🔒 Autenticación Requerida';
        authTitle.classList.remove('authenticated');
        userInfo.classList.remove('show');
        signinContainer.style.display = 'block';
    }
}

function enableForm() {
    document.getElementById('form-container').classList.add('authenticated');
    updateSubmitButton();
}

function disableForm() {
    document.getElementById('form-container').classList.remove('authenticated');
    updateSubmitButton();
}

function updateSubmitButton() {
    const submitBtn = document.getElementById('submit_btn');
    if (!isAuthenticated) {
        submitBtn.disabled = true;
        submitBtn.textContent = '🔒 Autentíquese primero';
    } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '📋 Generar Reporte PDF';
    }
}

function showAuthenticationError(message) {
    document.getElementById("signin-button-container").innerHTML = `<div style="background:#f8d7da;border:1px solid #f5c6cb;border-radius:8px;padding:15px;color:#721c24;"><strong>❌ Error</strong><br>${message}<div style="margin-top:15px;"><button onclick="location.reload()" style="background:#dc3545;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">🔄 Recargar</button></div></div>`;
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
        isAdmin = false;
        updateAuthenticationUI();
        disableForm();
        closeModal();
        const adminSection = document.getElementById('admin-controls-section');
        if (adminSection) adminSection.style.display = 'none';
        const evidenciasCheckbox = document.querySelector('.checkbox-evidencias');
        if (evidenciasCheckbox) evidenciasCheckbox.style.display = 'none';
        showStatus('Sesión cerrada', 'success');
        setTimeout(() => {
            hideStatus();
            setTimeout(() => initializeGoogleSignIn(), 1000);
        }, 2000);
    } catch (error) {
        showStatus('Error cerrando', 'error');
    }
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.innerHTML = message.replace(/\n/g, '<br>');
    status.className = `status ${type}`;
    status.style.display = 'block';
}

function hideStatus() {
    document.getElementById('status').style.display = 'none';
}

function setMaxDate() {
    const today = new Date().toLocaleDateString('en-CA', {timeZone:'America/Mazatlan'});
    document.getElementById('fecha_hasta').max = today;
    document.getElementById('fecha_hasta').value = today;
    const todayDate = new Date(today);
    const oneMonthAgo = new Date(todayDate);
    oneMonthAgo.setMonth(todayDate.getMonth() - 1);
    document.getElementById('fecha_desde').value = oneMonthAgo.toISOString().split('T')[0];
}

function setupEventListeners() {
    document.getElementById('fecha_desde').addEventListener('change', validateDates);
    document.getElementById('fecha_hasta').addEventListener('change', validateDates);
    document.getElementById('reportForm').addEventListener('submit', handleFormSubmit);
    setupCheckboxListeners();
}

function setupCheckboxListeners() {
    ['incluir_intervenciones','incluir_actividades','incluir_evidencias','incluir_comentarios','incluir_permisos'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    const evidenciasSolo = document.getElementById('incluir_evidencias_solo');
                    if (evidenciasSolo && evidenciasSolo.checked) {
                        evidenciasSolo.checked = false;
                        updateCheckboxStyles();
                    }
                }
            });
        }
    });
}

function handleEvidenciasChange(checkbox) {
    if (checkbox.checked) {
        ['incluir_intervenciones','incluir_actividades','incluir_evidencias','incluir_comentarios','incluir_permisos'].forEach(id => {
            const cb = document.getElementById(id);
            if (cb) cb.checked = false;
        });
        showStatus('Modo "Solo Evidencias" activado', 'loading');
        setTimeout(() => hideStatus(), 6000);
    }
    updateCheckboxStyles();
}

window.handleEvidenciasChange = handleEvidenciasChange;

function updateCheckboxStyles() {
    const evidenciasSolo = document.getElementById('incluir_evidencias_solo');
    const evidenciasItem = document.querySelector('.checkbox-evidencias');
    if (evidenciasSolo && evidenciasSolo.checked && evidenciasItem) {
        evidenciasItem.style.background = '#e8f5e8';
        evidenciasItem.style.borderColor = '#4caf50';
        evidenciasItem.style.boxShadow = '0 2px 8px rgba(76,175,80,0.2)';
    } else if (evidenciasItem) {
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
        showStatus('Fecha futura no válida', 'error');
        document.getElementById('fecha_hasta').value = today;
        return false;
    }
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
        showStatus('Rango de fechas inválido', 'error');
        document.getElementById('fecha_desde').value = fechaHasta;
        return false;
    }
    hideStatus();
    return true;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!isAuthenticated || !currentUser) {
        showStatus('Debe autenticarse', 'error');
        return;
    }
    const fechaDesde = document.getElementById('fecha_desde').value;
    const fechaHasta = document.getElementById('fecha_hasta').value;
    if (!fechaDesde || !fechaHasta || !validateDates()) return;
    
    const checkboxes = document.querySelectorAll('input[name="incluir_campos[]"]:checked');
    if (checkboxes.length === 0) {
        showStatus('Seleccione campos', 'error');
        return;
    }
    
    const filtroUsuario = isAdmin ? document.getElementById('filtro_usuario')?.value : '';
    const ordenamiento = isAdmin ? document.getElementById('orden_datos')?.value : 'nombre';
    
    // Si no es admin y no ha seleccionado usuario, advertir
    if (!isAdmin && !filtroUsuario) {
        showStatus('Por favor selecciona tu nombre en el filtro de usuario', 'error');
        return;
    }
    
    const incluirCampos = getSelectedFields();
    const isModoEvidencias = incluirCampos.includes('evidencias_solo');
    
    showStatus('Conectando (90s max)...', 'loading');
    const submitBtn = document.getElementById('submit_btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Conectando...';
    
    try {
        await fetchAttendanceData(fechaDesde, fechaHasta, filtroUsuario, ordenamiento);
        if (!attendanceData || attendanceData.length === 0) {
            showStatus(isModoEvidencias ? 'Sin SALIDAS con evidencias' : 'Sin registros para tu usuario', 'error');
            updateSubmitButton();
            return;
        }
        showStatus(`Generando PDF (${attendanceData.length})...`, 'loading');
        submitBtn.textContent = 'Generando PDF...';
        await generatePDF(fechaDesde, fechaHasta, ordenamiento);
        showDownloadModal(fechaDesde, fechaHasta);
        hideStatus();
        updateSubmitButton();
    } catch (error) {
        console.error('Error:', error);
        let errorMsg = 'Error: ';
        if (error.message.includes('intentos')) {
            errorMsg += 'Sin respuesta tras reintentos.\n• Verifique conexión\n• Intente rango menor\n• Espere 1-2 min';
        } else if (error.message.includes('Timeout')) {
            errorMsg += 'Timeout. Intente rango menor.';
        } else {
            errorMsg += error.message;
        }
        showStatus(errorMsg, 'error');
        updateSubmitButton();
    }
}

async function fetchAttendanceData(fechaDesde, fechaHasta, filtroUsuario = '', ordenamiento = 'nombre') {
    try {
        const incluirCampos = getSelectedFields();
        const isModoEvidencias = incluirCampos.includes('evidencias_solo');
        const result = await makeBackendRequestWithRetry('get_attendance_data', {
            fechaDesde,fechaHasta,
            filtroTipo:document.getElementById('filtro_tipo').value,
            filtroModalidad:document.getElementById('filtro_modalidad').value,
            filtroTipoRegistro:isModoEvidencias?'salida':'',
            filtroUsuario,ordenamiento,modoEvidencias:isModoEvidencias
        });
        if (result.success && result.data) {
            attendanceData = result.data;
            if (isModoEvidencias) {
                attendanceData = attendanceData.filter(r => r.tipo_registro && r.tipo_registro.toLowerCase() === 'salida');
            }
            if (ordenamiento) {
                attendanceData = sortAttendanceData(attendanceData, ordenamiento);
            }
        } else {
            throw new Error(result.message || 'Error servidor');
        }
    } catch (error) {
        attendanceData = [];
        throw new Error('Conexión: ' + error.message);
    }
}

function sortAttendanceData(data, ordenamiento) {
    const sorted = [...data];
    const getNombre = (r) => `${r.nombre} ${r.apellido_paterno} ${r.apellido_materno}`.trim().toLowerCase();
    const comparators = {
        nombre: (a,b) => getNombre(a).localeCompare(getNombre(b)) || a.fecha.localeCompare(b.fecha) || (a.tipo_estudiante||'').localeCompare(b.tipo_estudiante||'') || (a.modalidad||'').localeCompare(b.modalidad||'') || (a.tipo_registro||'').localeCompare(b.tipo_registro||''),
        fecha: (a,b) => a.fecha.localeCompare(b.fecha) || (a.tipo_estudiante||'').localeCompare(b.tipo_estudiante||'') || (a.modalidad||'').localeCompare(b.modalidad||'') || getNombre(a).localeCompare(getNombre(b)) || (a.tipo_registro||'').localeCompare(b.tipo_registro||''),
        tipo_estudiante: (a,b) => (a.tipo_estudiante||'').localeCompare(b.tipo_estudiante||'') || a.fecha.localeCompare(b.fecha) || (a.modalidad||'').localeCompare(b.modalidad||'') || getNombre(a).localeCompare(getNombre(b)) || (a.tipo_registro||'').localeCompare(b.tipo_registro||''),
        modalidad: (a,b) => (a.modalidad||'').localeCompare(b.modalidad||'') || (a.tipo_estudiante||'').localeCompare(b.tipo_estudiante||'') || a.fecha.localeCompare(b.fecha) || getNombre(a).localeCompare(getNombre(b)) || (a.tipo_registro||'').localeCompare(b.tipo_registro||''),
        tipo_registro: (a,b) => (a.tipo_registro||'').localeCompare(b.tipo_registro||'') || a.fecha.localeCompare(b.fecha) || (a.tipo_estudiante||'').localeCompare(b.tipo_estudiante||'') || (a.modalidad||'').localeCompare(b.modalidad||'') || getNombre(a).localeCompare(getNombre(b))
    };
    sorted.sort(comparators[ordenamiento] || comparators.nombre);
    return sorted;
}

async function generatePDF(fechaDesde, fechaHasta, ordenamiento = 'nombre') {
    const {jsPDF} = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFont('helvetica');
    addPDFHeader(doc, fechaDesde, fechaHasta, ordenamiento);
    const tableData = prepareTableData(ordenamiento);
    const incluirCampos = getSelectedFields();
    const isModoEvidencias = incluirCampos.includes('evidencias_solo');
    
    if (isModoEvidencias) {
        const headers = getTableHeaders(ordenamiento);
        const processedData = tableData.map(row => {
            const newRow = [...row];
            const linksIndex = headers.indexOf('Links');
            if (linksIndex !== -1) {
                newRow[linksIndex] = (row[linksIndex] && row[linksIndex].includes('https://')) ? row[linksIndex] : 'Sin links';
            }
            return newRow;
        });
        
        // Configuración de columnas más compacta
        const columnStyles = {};
        headers.forEach((header, index) => {
            if (header === 'Links') {
                columnStyles[index] = {cellWidth: 50, fontSize: 5, textColor: [0,0,255]};
            } else if (header === 'Nombres Evid.') {
                columnStyles[index] = {cellWidth: 35, fontSize: 5};
            } else if (header === 'Carpeta') {
                columnStyles[index] = {cellWidth: 30, fontSize: 5};
            } else {
                columnStyles[index] = {fontSize: 6};
            }
        });
        
        doc.autoTable({
            head:[headers],body:processedData,startY:40,
            styles:{fontSize:6,cellPadding:1.5,lineColor:[200,200,200],lineWidth:0.1},
            headStyles:{fillColor:[102,126,234],textColor:255,fontStyle:'bold',fontSize:6},
            alternateRowStyles:{fillColor:[248,249,250]},
            columnStyles:columnStyles,
            didDrawCell:function(data) {
                const linksIndex = headers.indexOf('Links');
                if (data.column.index === linksIndex && data.section === 'body') {
                    const cellContent = processedData[data.row.index][linksIndex];
                    if (cellContent && cellContent.includes('https://')) {
                        const linksData = parseLinksFromGeneratedText(cellContent);
                        linksData.forEach((linkData, index) => {
                            if (linkData.url) {
                                const linkY = data.cell.y + (index * 2.5) + 2;
                                doc.link(data.cell.x + 1, linkY - 1, data.cell.width - 2, 2.5, {url:linkData.url});
                            }
                        });
                    }
                }
            }
        });
    } else {
        const headers = getTableHeaders(ordenamiento);
        
        // Configuración más compacta para modo normal
        const columnStyles = {};
        headers.forEach((header, index) => {
            // Columnas con números - más estrechas
            if (['Interv.', 'Niños', 'Adoles.', 'Adult.', 'May.60', 'Fam.', 'Tot.Ev.'].includes(header)) {
                columnStyles[index] = {cellWidth: 12, fontSize: 6, halign: 'center'};
            } else if (header === 'Actividades') {
                columnStyles[index] = {cellWidth: 40, fontSize: 5};
            } else if (header === 'Comentarios') {
                columnStyles[index] = {cellWidth: 35, fontSize: 5};
            } else {
                columnStyles[index] = {fontSize: 6};
            }
        });
        
        doc.autoTable({
            head:[headers],body:tableData,startY:40,
            styles:{fontSize:6,cellPadding:1.5,lineColor:[200,200,200],lineWidth:0.1},
            headStyles:{fillColor:[102,126,234],textColor:255,fontStyle:'bold',fontSize:6},
            alternateRowStyles:{fillColor:[248,249,250]},
            columnStyles:columnStyles
        });
    }
    addPDFFooter(doc);
    pdfBlob = doc.output('blob');
}

function addPDFHeader(doc, fechaDesde, fechaHasta, ordenamiento) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE ASISTENCIAS - CESPSIC', 148, 12, {align:'center'});
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado por: ${currentUser.name}`, 10, 20);
    doc.text(`Email: ${currentUser.email}`, 10, 24);
    doc.text(`Fecha: ${new Date().toLocaleString('es-MX')}`, 10, 28);
    doc.text(`Período: ${fechaDesde} al ${fechaHasta}`, 10, 32);
    doc.text(`Total registros: ${attendanceData.length}`, 10, 36);
    
    if (ordenamiento) {
        const ordenTexto = {
            'nombre': 'Nombre',
            'fecha': 'Fecha',
            'tipo_estudiante': 'Tipo Estudiante',
            'modalidad': 'Modalidad',
            'tipo_registro': 'Tipo Registro'
        };
        doc.text(`Ordenado por: ${ordenTexto[ordenamiento] || ordenamiento}`, 200, 36);
    }
}

function addPDFFooter(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.text(`Página ${i} de ${pageCount} - CESPSIC`, 148, 205, {align:'center'});
    }
}

function getTableHeaders(ordenamiento = 'nombre') {
    const incluirCampos = getSelectedFields();
    let headers = [];
    
    // Determinar el orden de las primeras columnas según el ordenamiento
    const baseHeaders = {
        'nombre': ['Nombre Completo', 'Tipo Est.', 'Modalidad', 'Fecha', 'Hora', 'Tipo Reg.'],
        'fecha': ['Fecha', 'Hora', 'Tipo Est.', 'Modalidad', 'Nombre Completo', 'Tipo Reg.'],
        'tipo_estudiante': ['Tipo Est.', 'Fecha', 'Hora', 'Modalidad', 'Nombre Completo', 'Tipo Reg.'],
        'modalidad': ['Modalidad', 'Tipo Est.', 'Fecha', 'Hora', 'Nombre Completo', 'Tipo Reg.'],
        'tipo_registro': ['Tipo Reg.', 'Fecha', 'Hora', 'Tipo Est.', 'Modalidad', 'Nombre Completo']
    };
    
    headers = baseHeaders[ordenamiento] || baseHeaders['nombre'];
    
    if (incluirCampos.includes('evidencias_solo')) {
        headers.push('Nombres Evid.', 'Carpeta', 'Links');
    } else {
        if (incluirCampos.includes('intervenciones')) {
            headers.push('Interv.', 'Niños', 'Adoles.', 'Adult.', 'May.60', 'Fam.');
        }
        if (incluirCampos.includes('actividades')) headers.push('Actividades');
        if (incluirCampos.includes('evidencias')) headers.push('Tot.Ev.');
        if (incluirCampos.includes('comentarios')) headers.push('Comentarios');
        if (incluirCampos.includes('permisos')) headers.push('Det.Permiso', 'Det.Otro');
    }
    return headers;
}

function prepareTableData(ordenamiento = 'nombre') {
    const incluirCampos = getSelectedFields();
    
    return attendanceData.map(record => {
        const nombreCompleto = `${record.nombre} ${record.apellido_paterno} ${record.apellido_materno}`.trim();
        const tipoEst = record.tipo_estudiante || '';
        const modalidad = record.modalidad || '';
        const fecha = record.fecha || '';
        const hora = record.hora || '';
        const tipoReg = record.tipo_registro || '';
        
        let row = [];
        
        // Organizar columnas según el ordenamiento
        switch(ordenamiento) {
            case 'fecha':
                row = [fecha, hora, tipoEst, modalidad, nombreCompleto, tipoReg];
                break;
            case 'tipo_estudiante':
                row = [tipoEst, fecha, hora, modalidad, nombreCompleto, tipoReg];
                break;
            case 'modalidad':
                row = [modalidad, tipoEst, fecha, hora, nombreCompleto, tipoReg];
                break;
            case 'tipo_registro':
                row = [tipoReg, fecha, hora, tipoEst, modalidad, nombreCompleto];
                break;
            default: // nombre
                row = [nombreCompleto, tipoEst, modalidad, fecha, hora, tipoReg];
        }
        
        if (incluirCampos.includes('evidencias_solo')) {
            row.push(
                record.nombres_evidencias || 'Sin evidencias',
                record.carpeta_evidencias || 'Sin carpeta',
                record.links_evidencias || 'Sin links'
            );
        } else {
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
                if (record.actividades_varias_detalle) actividades += (actividades?' | ':'') + record.actividades_varias_detalle;
                if (record.pruebas_psicologicas_detalle) actividades += (actividades?' | ':'') + record.pruebas_psicologicas_detalle;
                row.push(actividades);
            }
            if (incluirCampos.includes('evidencias')) row.push(record.total_evidencias || '0');
            if (incluirCampos.includes('comentarios')) row.push(record.comentarios_adicionales || '');
            if (incluirCampos.includes('permisos')) row.push(record.permiso_detalle || '', record.otro_detalle || '');
        }
        return row;
    });
}

function parseLinksFromGeneratedText(linksText) {
    const lines = linksText.split('\n');
    const linksData = [];
    lines.forEach(line => {
        if (line.includes('https://')) {
            const parts = line.split(': https://');
            if (parts.length === 2) {
                linksData.push({fileName:parts[0].trim(),url:'https://' + parts[1].trim()});
            }
        }
    });
    return linksData;
}

function getSelectedFields() {
    const checkboxes = document.querySelectorAll('input[name="incluir_campos[]"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function showDownloadModal(fechaDesde, fechaHasta) {
    const modal = document.getElementById('modal-overlay');
    const reportInfo = document.getElementById('report-info');
    const incluirCampos = getSelectedFields();
    const filtroTipo = document.getElementById('filtro_tipo').value;
    const filtroModalidad = document.getElementById('filtro_modalidad').value;
    const filtroUsuario = isAdmin ? document.getElementById('filtro_usuario')?.value : '';
    const ordenamiento = isAdmin ? document.getElementById('orden_datos')?.value : 'nombre';
    
    const ordenTexto = {
        'nombre': 'Nombre',
        'fecha': 'Fecha',
        'tipo_estudiante': 'Tipo Estudiante',
        'modalidad': 'Modalidad',
        'tipo_registro': 'Tipo Registro'
    };
    
    reportInfo.innerHTML = `
        <h4>📊 Resumen del Reporte</h4>
        <p><strong>Período:</strong> ${fechaDesde} al ${fechaHasta}</p>
        <p><strong>Total de registros:</strong> ${attendanceData.length}</p>
        <p><strong>Campos incluidos:</strong> ${incluirCampos.join(', ')}</p>
        ${filtroTipo ? `<p><strong>Filtro tipo:</strong> ${filtroTipo}</p>` : ''}
        ${filtroModalidad ? `<p><strong>Filtro modalidad:</strong> ${filtroModalidad}</p>` : ''}
        ${filtroUsuario ? `<p><strong>Filtro usuario:</strong> ${filtroUsuario}</p>` : ''}
        ${ordenamiento ? `<p><strong>Ordenado por:</strong> ${ordenTexto[ordenamiento] || ordenamiento}</p>` : ''}
        <p><strong>Generado por:</strong> ${currentUser.name}</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-MX')}</p>
    `;
    document.getElementById('download-btn').onclick = downloadPDF;
    modal.classList.add('show');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('show');
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
        showStatus('Reporte descargado', 'success');
        setTimeout(() => {
            hideStatus();
            closeModal();
        }, 2000);
    }
}

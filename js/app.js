// app.js - INICIO DEL ARCHIVO
console.log('🔍 Verificando dependencias...');

// ============================================
// 🔥 HELPER FUNCTIONS - MANIPULACIÓN SEGURA DEL DOM
// ============================================

function safeAddClass(elementId, className) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add(className);
        return true;
    }
    return false;
}

function safeRemoveClass(elementId, className) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove(className);
        return true;
    }
    return false;
}

function safeToggleClass(elementId, className, force) {
    const element = document.getElementById(elementId);
    if (element) {
        if (force !== undefined) {
            element.classList.toggle(className, force);
        } else {
            element.classList.toggle(className);
        }
        return true;
    }
    return false;
}

function safeRemoveElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.remove();
        return true;
    }
    return false;
}

function safeSetText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
        return true;
    }
    return false;
}

// 🔥 VERIFICACIÓN DE SEGURIDAD
function verificarDependencias() {
    const errores = [];
    
    // 1. Verificar Supabase SDK
    if (typeof window.supabase === 'undefined') {
        errores.push('Supabase SDK no cargado');
        console.error('❌ window.supabase es undefined');
    }
    
    // 2. Verificar configuración
    if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
        errores.push('Credenciales Supabase faltantes');
        console.error('❌ SUPABASE_URL o SUPABASE_KEY faltan');
    }
    
    // 3. Mostrar estado
    console.log('📊 Estado:', {
        supabaseSDK: typeof window.supabase,
        tieneURL: !!window.SUPABASE_URL,
        tieneKEY: !!window.SUPABASE_KEY,
        URL: window.SUPABASE_URL?.substring(0, 30) + '...' || 'NO',
        KEY: window.SUPABASE_KEY?.substring(0, 10) + '...' || 'NO'
    });
    
    return errores;
}

// Ejecutar verificación
const errores = verificarDependencias();

if (errores.length > 0) {
    console.error('🚨 ERRORES CRÍTICOS:', errores);
    
    // Mostrar error en pantalla
    document.addEventListener('DOMContentLoaded', function() {
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.innerHTML = `
                <div class="text-center text-red-600 p-6">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold mb-2">Error de Configuración</h3>
                    <p class="mb-3">${errores.join('<br>')}</p>
                    <p class="text-sm">Verifica que:</p>
                    <ul class="text-sm text-left inline-block mt-2">
                        <li>1. config.js existe en /js/</li>
                        <li>2. Contiene SUPABASE_URL y SUPABASE_KEY</li>
                        <li>3. Los scripts se cargan en orden correcto</li>
                    </ul>
                    <button onclick="location.reload()" class="mt-4 bg-red-500 text-white px-4 py-2 rounded">
                        <i class="fas fa-redo mr-2"></i>Recargar Página
                    </button>
                </div>
            `;
        }
    });
    
    // Detener ejecución
    throw new Error('Dependencias faltantes: ' + errores.join(', '));
}

// ============================================
// SHOWTOAST
// ============================================

window.showToast = function(message, type = 'normal') {
    // Implementación actual (línea 2998)
    const toast = document.getElementById('toast');
    if (!toast) {
        console.error('❌ Elemento #toast no encontrado');
        console[type === 'error' ? 'error' : 'log'](message);
        return;
    }
    toast.textContent = message;
    toast.className = 'fixed bottom-5 right-5 px-6 py-3 rounded shadow-lg transform transition-transform duration-300';
    if (type === 'error') { 
        toast.classList.add('bg-red-600', 'text-white'); 
    } else if (type === 'success') { 
        toast.classList.add('bg-green-600', 'text-white'); 
    } else { 
        toast.classList.add('bg-gray-800', 'text-white'); 
    }
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-20');
        setTimeout(() => { toast.classList.add('translate-y-20'); }, 3000);
    });
};

// ============================================
// SOLO CONTINUAR SI TODO ESTÁ BIEN
// ============================================

console.log('✅ Dependencias verificadas - Iniciando aplicación');

// Tu código original continúa aquí...
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_KEY = window.SUPABASE_KEY;

// 🔥 INICIALIZACIÓN SEGURA
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabase = supabase; // Guardar globalmente
    console.log('✅ Supabase inicializado correctamente');
} catch (error) {
    console.error('❌ Error inicializando Supabase:', error);
    throw error;
}

let authEventCount = 0;
let authInitialized = false;
let authHandlerActive = true;
supabase.auth.onAuthStateChange((event, session) => {
    authEventCount++;
    console.log('🔐 Auth event:', event, 'Count:', authEventCount);
    
    // 🔥 LIMITAR EVENTOS (prevenir bucles)
    if (authEventCount > 10) {
        console.error('🚨 DEMASIADOS EVENTOS AUTH - IGNORANDO');
        return;
    }
    
    switch (event) {
        case 'SIGNED_IN':
            console.log('✅ SIGNED_IN:', session?.user?.email || 'no email');
            authInitialized = true;
            
            if (typeof setUILoginState === 'function') {
                setUILoginState(true, session.user);
            }
            
            // Cargar datos después de 500ms
            setTimeout(() => {
                if (!window.curriculumData && typeof loadCurriculumData === 'function') {
                    loadCurriculumData();
                }
            }, 500);
            break;
            
        case 'INITIAL_SESSION':
            console.log('🔄 INITIAL_SESSION:', session?.user?.email || 'no session');
            
            if (session?.user) {
                authInitialized = true;
                
                if (typeof setUILoginState === 'function') {
                    setUILoginState(true, session.user);
                }
                
                setTimeout(() => {
                    if (!window.curriculumData && typeof loadCurriculumData === 'function') {
                        loadCurriculumData();
                    }
                }, 1000);
            } else {
                // NO hay sesión - estado inicial
                authInitialized = true;
                
                if (typeof setUILoginState === 'function') {
                    setUILoginState(false);
                }
            }
            break;
            
        case 'SIGNED_OUT':
            console.log('🚪 SIGNED_OUT');
            authInitialized = false;
            
            if (typeof setUILoginState === 'function') {
                setUILoginState(false);
            }
            break;
            
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
            // Ignorar completamente
            break;
            
        default:
            console.log('📌 Otro evento auth:', event);
    }
    
    // 🔥 Resetear contador después de 5 segundos
    setTimeout(() => {
        if (authEventCount > 0) {
            authEventCount = 0;
            console.log('🔄 Contador auth reseteado');
        }
    }, 5000);
});
        // Global variables to store state
        window.curriculumData = null; 
        window.selectedDegree = null;
        window.selectedYear = null;
        window.selectedSubjectIndex = null;
        window.selectedCompetenciaGrado = null;
        window.selectedCompetenciaArea = null;
        window.selectedCompetenciaTipo = null; // 'ingreso' o 'egreso'

        // ADMIN EMAILAK
        const ADMIN_EMAILS = ['josuayerbe@idarte.eus'];
        const ALLOWED_DOMAINS = ['idarte.eus'];

    // 🔥🔥🔥 GEHITU HEMEN - kodea 🔥🔥🔥
        async function checkAuthProviders() {
            try {
                const { data, error } = await supabase.auth.getUser();
                console.log('Auth egoera:', data);
                
                // Egiaztatu provider-ak
                const { data: settings } = await supabase.auth.getSettings();
                console.log('Auth settings:', settings);
                
            } catch (error) {
                console.error('Errorea auth settings egiaztatzean:', error);
            }
        }
    
        // 🔥🔥🔥 GEHITU HEMEN - service worker kodea 🔥🔥🔥
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                    registration.unregister();
                }
            });
        }

        // 🔥 GEHITU HAU zure JavaScript kodea hasieran (Supabase konfigurazioaren ONDOREN)
window.setupEventListeners = function() {
    console.log('🔌 setupEventListeners ejecutando...');

    // 🔥 VERIFICAR FUNCIONES REQUERIDAS
    const funcionesRequeridas = [
        'addUnit', 'onDegreeChange', 'downloadJsonData', 'uploadJsonFile',
        'updateSubjectName', 'updateSubjectData', 'updateSubjectCredits', 
        'updateSubjectRAs', 'normalizeData', 'initializeUI', 'saveCurriculumData'
    ];
    
    funcionesRequeridas.forEach(func => {
        if (typeof window[func] !== 'function') {
            console.warn(`⚠️ Función no definida: ${func}`);
        }
    });
    
    // EGIAZTATU ELEMENTUAK EXISTITZEN DIREN
    const elements = {
        saveBtn: document.getElementById('saveBtn'),
        addUnitBtn: document.getElementById('addUnitBtn'),
        degreeSelect: document.getElementById('degreeSelect'),
        jsonFileInput: document.getElementById('jsonFileInput'),
        downloadBackupBtn: document.getElementById('downloadBackupBtn'),
        uploadJsonBtn: document.getElementById('uploadJsonBtn'),
        subjectNameEdit: document.getElementById('subjectNameEdit'),
        subjectArea: document.getElementById('subjectArea'),
        subjectCreditsEdit: document.getElementById('subjectCreditsEdit'),
        subjectRAs: document.getElementById('subjectRAs'),
        
        // 🔥 AÑADIR ESTOS ELEMENTOS IMPORTANTES:
        signInBtn: document.getElementById('signInBtn'),
        signOutBtn: document.getElementById('signOutBtn'),
        unitName: document.getElementById('unitName'),
        unitContent: document.getElementById('unitContent'),
        matricesBtn: document.getElementById('matricesBtn'), // Si existe
        eremuakBtn: document.getElementById('eremuakBtn'),   // Si existe
        forceReloadBtn: document.getElementById('forceReloadBtn') // Si existe
    };   
    
    console.log('🔍 Elementos encontrados:', Object.keys(elements).filter(k => elements[k]));
    
    // LISTENER SIMPLEAK
    if (elements.saveBtn) {
        elements.saveBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof saveCurriculumData === 'function') {
                saveCurriculumData();
            } else {
                console.error('❌ saveCurriculumData no está definida');
                if (window.showToast) window.showToast('❌ Error: función no disponible', 'error');
            }
        });
    }
    
    if (elements.addUnitBtn) {
        elements.addUnitBtn.addEventListener('click', window.addUnit);
    }
    
    if (elements.degreeSelect) {
        elements.degreeSelect.addEventListener('change', window.onDegreeChange);
    }
    
    if (elements.downloadBackupBtn) {
        elements.downloadBackupBtn.addEventListener('click', window.downloadJsonData);
    }
    
    if (elements.uploadJsonBtn) {
        elements.uploadJsonBtn.addEventListener('click', uploadJsonFile);
    }

    if (elements.subjectNameEdit) {
        elements.subjectNameEdit.addEventListener('change', function() {
            if (window.updateSubjectName) {
                window.updateSubjectName(this.value);
            }
        });
    }
    
    if (elements.subjectArea) {
        elements.subjectArea.addEventListener('change', function() {
            if (window.updateSubjectData) {
                window.updateSubjectData('arloa', this.value);
            }
        });
    }
    
    if (elements.subjectCreditsEdit) {
        elements.subjectCreditsEdit.addEventListener('change', function() {
            if (window.updateSubjectCredits) {
                window.updateSubjectCredits();
            }
        });
    }
    
    if (elements.subjectRAs) {
        elements.subjectRAs.addEventListener('change', function() {
            if (window.updateSubjectRAs) {
                window.updateSubjectRAs(this.value);
            }
        });
    }
    
    // JSON FITXATEGIA - VERSIÓN CORREGIDA
    if (elements.jsonFileInput) {
        elements.jsonFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const parsedData = JSON.parse(e.target.result);
                    
                    // 🔥 NORMALIZAR Y ASIGNAR
                    window.curriculumData = window.normalizeData ? 
                        window.normalizeData(parsedData) : parsedData;
                    
                    // 🔥 INICIALIZAR MATRICES SI ES NECESARIO
                    if (window.inicializarMatricesSegura) {
                        window.inicializarMatricesSegura();
                    } else if (window.inicializarSistemaMatrices && window.curriculumData && !window.curriculumData.matrices) {
                        window.inicializarSistemaMatrices();
                    }
                    
                    // 🔥 INICIALIZAR UI
                    if (window.initializeUI) {
                        window.initializeUI();
                    }
                    
                    // 🔥 NOTIFICAR
                    if (window.showToast) {
                        window.showToast('✅ JSON kargatuta!', 'success');
                    }
                    
                    // 🔥 GUARDAR SOLO SI HAY USUARIO AUTENTICADO
                    setTimeout(() => {
                        if (window.saveCurriculumData && window.supabase) {
                            window.supabase.auth.getUser().then(({ data: { user } }) => {
                                if (user) {
                                    window.saveCurriculumData();
                                }
                            });
                        }
                    }, 1500);
                    
                } catch (error) {
                    console.error('❌ Error cargando JSON:', error);
                    if (window.showToast) {
                        window.showToast('❌ JSON errorea: ' + error.message, 'error');
                    }
                }
            };
            reader.readAsText(file);
        });
    }
    
    console.log('✅ Event listeners configurados');
}; // 🔥 CIERRE DE LA FUNCIÓN
              
        function isAdmin(user) {
            return user && ADMIN_EMAILS.includes(user.email);
        }
        
        function isValidEmail(email) {
            if (!email) return false;
            const domain = email.split('@')[1];
            return ALLOWED_DOMAINS.includes(domain);
        }

        async function checkAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            return user;
        }
        
        // AUTH FUNtzioak
        // HTML barruan dagoen kodea eguneratu
        // 6. AUTH FUNtzioak
        window.signInWithGoogle = async function() {
            console.log('🔐 Iniciando login Google...');
            
            try {
                // 🔥 URL LIMPIA - sin parámetros
                const cleanRedirectUrl = window.location.origin + window.location.pathname;
                console.log('📍 Redirect URL:', cleanRedirectUrl);
                
                // Mostrar loading
                const loading = document.getElementById('loadingOverlay');
                if (loading) {
                    loading.classList.remove('hidden');
                    document.getElementById('loadingText').textContent = 'Google-rekin konektatzen...';
                }
                
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: cleanRedirectUrl,
                        queryParams: {
                            prompt: 'select_account',
                            access_type: 'offline'
                        }
                    }
                });
                
                if (error) {
                    console.error('❌ Error login Google:', error);
                    if (loading) loading.classList.add('hidden');
                    window.showToast('❌ Errorea Google-rekin saioa hastean', 'error');
                }
                
                // 🔥 NO recargar automáticamente - Supabase maneja la redirección
                console.log('✅ Login iniciado - redireccionando a Google');
                
                } catch (error) {
                    console.error('❌ Error en signInWithGoogle:', error);
                    safeAddClass('loadingOverlay', 'hidden');
                    window.showToast('❌ Errorea login prozesuan', 'error');
                }
        };
        
        window.signOut = async function() {
            try {
                // 1️⃣ Confirmar con el usuario
                if (!confirm('Ziur zaude saioa itxi nahi duzula?\n\nHurrengoan berriro Google-rekin hasi beharko duzu saioa.')) {
                    return; // Utzi erabiltzaileak utzi nahi ez badu
                }
                
                console.log('🚪 Saioa ixteko prozesua hasita...');
                
                // 2️⃣ Mostrar karga adierazlea
                document.getElementById('loadingOverlay').classList.remove('hidden');
                document.getElementById('loadingText').textContent = 'Saioa ixteko...';
                
                // 3️⃣ Cerrar sesión en Supabase (con timeout)
                const signOutPromise = supabase.auth.signOut();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout saioa ixteko')), 5000)
                );
                
                const { error } = await Promise.race([signOutPromise, timeoutPromise]);
                if (error) throw error;
                
                console.log('✅ Supabase saioa itxita');
                
                // 4️⃣ Limpiar SOLO los datos de nuestra app (no todo el localStorage)
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.includes('curriculum') || key.includes('matrix') || key.includes('supabase')) {
                        keysToRemove.push(key);
                    }
                }
                
                keysToRemove.forEach(key => {
                    localStorage.removeItem(key);
                    console.log(`🗑️ Kengatu: ${key}`);
                });
                
                // 5️⃣ Limpiar variables globales
                window.curriculumData = null;
                window.selectedDegree = null;
                window.selectedYear = null;
                window.selectedSubjectIndex = null;
                
                // 6️⃣ Redirigir a la misma página con parámetros anti-cache
                const cleanUrl = window.location.origin + window.location.pathname;
                const timestamp = new Date().getTime();
                const redirectUrl = `${cleanUrl}?logout=true&_=${timestamp}`;
                
                console.log(`🔄 Berbideratzen: ${redirectUrl}`);
                
                // 7️⃣ Redirigir inmediatamente
                window.location.href = redirectUrl;
                
            } catch (error) {
                console.error('❌ Errorea irtetean:', error);
                
                // Erakutsi errorea
                window.showToast('❌ Errorea irtetzean. Saiatu berriro.', 'error');
                
                // Saiatu berriz kargatzen
                setTimeout(() => {
                    document.getElementById('loadingOverlay').classList.add('hidden');
                    window.location.reload();
                }, 2000);
            }
        };

        // ✅ KONPONDUTA - KOPIATU HAU HTML FITXATEGIAN
        function handleLogoutFromUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            const hasLogoutParam = urlParams.has('logout');
            
            // ⚡ SOLO ejecutar si hay parámetro logout
            if (!hasLogoutParam) {
                return false; // No hacer nada si no es logout
            }
            
            console.log('🔍 Logout param detectado en URL');
            
            // 1. Limpiar URL (eliminar parámetros)
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            
            // 2. Solo entonces cerrar sesión en UI
            if (typeof window.setUILoginState === 'function') {
                window.setUILoginState(false);
            }
            
            return true;
        }       
        
        async function viewEditHistory() {
            const user = await checkAuth();
            if (!user) {
                window.showToast('❌ Saioa hasi behar duzu historia ikusteko', 'error');
                return;
            }
            
            try {
                const { data, error } = await supabase
                    .from('curriculum_data')
                    .select('last_updated, updated_by, user_role')
                    .order('last_updated', { ascending: false });
                
                if (error) throw error;
                
                console.log('Editore historia:', data);
                
                // Datuak erakutsi alerta batean
                let message = '🕐 Editore Historia:\n\n';
                data.forEach((item, index) => {
                    const data = new Date(item.last_updated).toLocaleString('eu-EU');
                    message += `${index + 1}. ${data}\n`;
                    message += `   Erabiltzailea: ${item.updated_by}\n`;
                    message += `   Rola: ${item.user_role}\n\n`;
                });
                
                alert(message);
                
            } catch (error) {
                console.error('Errorea historia kargatzean:', error);
                window.showToast('❌ Errorea historia kargatzean', 'error');
            }
        }        

        // Funtzio SIMPLE eta BUKLE GABEKO
function setUILoginState(isLoggedIn, user = null) {
    console.log('🎯 setUILoginState llamado:', isLoggedIn, user?.email || 'no-user');
    
    // 🔥 1. OCULTAR LOADING SIEMPRE
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.style.display = 'none';
        loading.classList.add('hidden');
        console.log('✅ Loading ocultado');
    }
    
    // 🔥 2. PREVENIR LLAMADAS MÚLTIPLES
    if (window.lastUILoginState === isLoggedIn && 
        window.lastUILoginUser === (user?.email || 'no-user')) {
        console.log('⏭️ Saltando - mismo estado');
        return;
    }
    window.lastUILoginState = isLoggedIn;
    window.lastUILoginUser = user?.email || 'no-user';
    
    // 🔥 3. SI ESTÁ LOGUEADO
    if (isLoggedIn && user) {
        console.log('👤 Mostrando UI para usuario:', user.email);
        
        // Ocultar botón de login
        safeRemoveClass('signInBtn', 'hidden');
        
        // Mostrar botón de logout
        safeAddClass('signOutBtn', 'hidden');
        
        // Mostrar info usuario
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.classList.remove('hidden');
            
            // Actualizar email
            const userEmail = document.getElementById('userEmail');
            if (userEmail) userEmail.textContent = user.email;
            
            // Actualizar rol
            const userRole = document.getElementById('userRole');
            if (userRole) {
                const isAdmin = ADMIN_EMAILS.includes(user.email);
                userRole.textContent = isAdmin ? 'Admin' : 'Irakaslea';
                userRole.className = isAdmin ? 
                    'text-xs bg-red-500 px-2 py-1 rounded' : 
                    'text-xs bg-green-500 px-2 py-1 rounded';
            }
        }
        
        // 🔥 CRÍTICO: Mostrar botones de app
        const appButtons = document.getElementById('appButtons');
        if (appButtons) {
            appButtons.classList.remove('hidden');
            appButtons.style.display = 'flex';
            console.log('✅ appButtons mostrado');
        }
        
        // Mostrar panel de navegación
        safeRemoveClass('navigationPanel', 'hidden');
        
        // Ocultar mensaje "no data"
        safeAddClass('noDataMessage', 'hidden');
        
        // Mostrar botones admin si corresponde
        const isAdmin = ADMIN_EMAILS.includes(user.email);
        safeToggleClass('downloadBackupBtn', 'hidden', !isAdmin);
        safeToggleClass('uploadJsonBtn', 'hidden', !isAdmin);
        
    } else {
        // 🔥 4. SI NO ESTÁ LOGUEADO
        console.log('👤 Ocultando UI - no logueado');
        
        safeRemoveClass('signInBtn', 'hidden');
        safeAddClass('signOutBtn', 'hidden');
        safeAddClass('userInfo', 'hidden');
        safeAddClass('appButtons', 'hidden');
        safeAddClass('navigationPanel', 'hidden');
        safeRemoveClass('noDataMessage', 'hidden');
    }
    
    console.log('✅ setUILoginState completado');
}
        
        // DATUAK KARGATU
        async function loadCurriculumData() {
            // 🔥 EGIAZTATU DATUAK EZ DAUDELA JADA KARGATUTA
            if (window.curriculumData) {
                console.log('⏭️ Datuak jada kargatuta');
                return;
            }
            
            try {
                console.log('📥 Datuak kargatzen...');
                
                const { data: { user } } = await supabase.auth.getUser();
                
                // 🔥 EGIAZTAPEN BAKARRA:
                if (!user || !isValidEmail(user.email)) {
                    console.log('⏭️ Ez dago erabiltzailerik datuak kargatzeko');
                    return;
                }
                
                const { data, error } = await supabase
                    .from('curriculum_data')
                    .select('*')
                    .order('last_updated', { ascending: false })
                    .limit(1);
                
                if (error) throw error;
                
                if (data && data.length > 0 && data[0].curriculum) {
                    window.curriculumData = data[0].curriculum;
                    console.log('✅ Datuak kargatuak Supabase-tik');
                   
                    // 🔥 AÑADIR ESTO: Inicializar matrices automáticamente
                    setTimeout(() => {
                        if (window.inicializarSistemaMatrices) {
                            window.inicializarSistemaMatrices();
                        }
                    }, 1000);
                    
                    // 🔥 VERIFICAR ESTRUCTURA DESPUÉS DE CARGAR
                    setTimeout(verificarEstructuraDatos, 800);
                    
                    // UI eguneratu (soilik nabigazioa)
                    document.getElementById('noDataMessage').classList.add('hidden');
                    document.getElementById('navigationPanel').classList.remove('hidden');
                    
                    // UI hasieratu
                    if (window.initializeUI) {
                        window.initializeUI();
                    }
                    
                    window.showToast('✅ Datuak kargatuak', 'success');
                } else {
                    // Supabase hutsik → JSON lokala
                    console.log('📄 Supabase hutsik, JSON lokala kargatzen...');
                    await loadLocalJsonData(true);
                }
                
            } catch (error) {
                console.error('❌ Errorea datuak kargatzean:', error);
                window.showToast('❌ Errorea datuak kargatzean', 'error');
            }
        }
   
        // Datuak gorde (erabiltzaile infoarekin)
       async function saveCurriculumData() {
            // 🔥 EGIAZTATU SAIORIK DAGOEN
            const user = await checkAuth();
            if (!user) {
                window.showToast('❌ Saioa hasi behar duzu gordetzeko', 'error');
                return;
            }
            
            // 🔥 EGIAZTATU DATUAK DAUDELA
            if (!window.curriculumData) {
                window.showToast('❌ Ez dago daturik gordetzeko', 'error');
                return;
            }
            
            try {
                // 🔥 Karga adierazlea erakutsi
                document.getElementById('loadingOverlay').classList.remove('hidden');
                
                const { error } = await supabase
                    .from('curriculum_data')
                    .upsert({
                        curriculum: window.curriculumData,
                        last_updated: new Date().toISOString(),
                        updated_by: user.email,
                        user_role: isAdmin(user) ? 'admin' : 'teacher'
                    });
                
                if (error) throw error;
                
                window.showToast('✅ Datuak gorde dira!', 'success');
                
            } catch (error) {
                console.error('Errorea gordetzean:', error);
                window.showToast('❌ Errorea gordetzean: ' + error.message, 'error');
            } finally {
                // 🔥 Karga adierazlea ezkutatu (erroreren bat gertatu ala ez)
                document.getElementById('loadingOverlay').classList.add('hidden');
            }
        }
        
        // Denbora errealeko eguneraketak
        // Función mejorada para setupRealtimeUpdates
        function setupRealtimeUpdates() {
            try {
                console.log('🔌 Conectando WebSocket a Supabase...');
                
                const channel = supabase
                    .channel('curriculum-changes')
                    .on('postgres_changes', 
                        { 
                            event: '*', 
                            schema: 'public', 
                            table: 'curriculum_data' 
                        },
                        (payload) => {
                            console.log('🔄 Cambio en tiempo real:', payload);
                            if (payload.new && payload.new.curriculum) {
                                window.curriculumData = payload.new.curriculum;
                                if (window.initializeUI) {
                                    window.initializeUI();
                                }
                                window.showToast?.('🔄 Datos actualizados (compañeros)', 'normal');
                            }
                        }
                    )
                    .subscribe((status) => {
                        console.log('📡 Estado WebSocket:', status);
                        if (status === 'SUBSCRIBED') {
                            console.log('✅ WebSocket conectado exitosamente');
                        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                            console.warn('⚠️ WebSocket cerrado, reintentando en 5s...');
                            setTimeout(setupRealtimeUpdates, 5000);
                        }
                    });
                    
                return channel;
            } catch (error) {
                console.error('❌ Error conectando WebSocket:', error);
                // Reintentar después de 10 segundos
                setTimeout(setupRealtimeUpdates, 10000);
                return null;
            }
        }

        // Gehitu funtzio hau zure kodean
        function handleAuthRedirect() {
            // Egiaztatu token-a URL-an badago
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            
            if (accessToken) {
                console.log('✅ Token-a aurkitu da URL-an - saioa hasita');
            }
        }
         
        // Supabase-tik datuak berkargatu (behartu)
        async function forceReloadFromSupabase() {
            try {
                document.getElementById('loadingOverlay').classList.remove('hidden');
                
                const { data, error } = await supabase
                    .from('curriculum_data')
                    .select('*')
                    .limit(1);
                
                if (error) throw error;
                
                if (data && data.length > 0) {
                    window.curriculumData = data[0].curriculum;
                    window.initializeUI();
                    window.showToast('✅ Datuak berkargatu dira Supabase-tik', 'success');
                } else {
                    window.showToast('ℹ️ Ez dago daturik Supabase-n', 'normal');
                }
                
            } catch (error) {
                console.error('Errorea Supabase-tik berkargatzean:', error);
                window.showToast('❌ Errorea datuak berkargatzean', 'error');
            } finally {
                document.getElementById('loadingOverlay').classList.add('hidden');
            }
        }

        // Datuak ikusi Supabase-n (nork egin duen ikusi)
        async function viewSupabaseData() {
            const user = await checkAuth();
            if (!user) return;
            
            try {
                const { data, error } = await supabase
                    .from('curriculum_data')
                    .select('*')
                    .order('last_updated', { ascending: false });
                
                if (error) throw error;
                
                console.log('Supabase Datuak (nork egin duen):', data);
                
                // Datuak erakutsi mezu batean
                let message = `Supabase-n dauden erregistroak: ${data.length}\n\n`;
                data.forEach((item, index) => {
                    message += `${index + 1}. Data: ${new Date(item.last_updated).toLocaleString('eu-EU')}\n`;
                    message += `   Erabiltzailea: ${item.updated_by}\n`;
                    message += `   Rola: ${item.user_role || 'ez dago'}\n\n`;
                });
                
                alert(message);
                
            } catch (error) {
                console.error('Errorea datuak ikustean:', error);
                window.showToast('❌ Errorea datuak ikustean', 'error');
            }
        }

        // NUEVO EDITOR PARA INGRESO (con ámbitos)
        async function mostrarEditorCompetenciasIngresoPorAmbitos() {
            console.log('🎨 Mostrando competencias ingreso por ámbitos');
            
            // 1. Mostrar panel
            document.getElementById('welcomeEditor').classList.add('hidden');
            document.getElementById('editorPanel').classList.remove('hidden');
            
            // 2. Configurar título
            document.getElementById('subjectTitle').textContent = 'Sarrerako kompetentziak';
            document.getElementById('subjectType').textContent = 'Arloen arabera antolatuta';
            document.getElementById('subjectCredits').textContent = '';
            
            // 3. Obtener ámbitos y colores
            const eremuak = Object.keys(window.curriculumData.matrices?.colores_eremuak || {});
            const colores = window.curriculumData.matrices?.colores_eremuak || {};
            
            if (eremuak.length === 0) {
                // Fallback si no hay colores
                const eremuakLista = extraerEremuakDelCurriculum();
                renderizarEditorSimple(eremuakLista, tipo);
                return;
            }
            
            // 4. Renderizar interfaz avanzada
            renderizarEditorPorAmbitos(eremuak, colores, 'ingreso');
        }

        function mostrarEditorCompetenciasEgresoMejorado() {
            console.log('🎨 Mostrando competencias egreso mejorado');
            
            // 1. Mostrar panel
            document.getElementById('welcomeEditor').classList.add('hidden');
            document.getElementById('editorPanel').classList.remove('hidden');
            
            // 2. Configurar título
            document.getElementById('subjectTitle').textContent = 'Irteerako kompetentziak';
            document.getElementById('subjectType').textContent = 'Graduaren amaierako gaitasunak';
            document.getElementById('subjectCredits').textContent = '';
            
            // 3. Inicializar si está vacío
            if (!window.curriculumData.kompetentziak_egreso || 
                !Array.isArray(window.curriculumData.kompetentziak_egreso)) {
                window.curriculumData.kompetentziak_egreso = [];
            }
            
            // 4. Renderizar editor simple
            renderizarEditorSimple(window.curriculumData.kompetentziak_egreso, 'egreso');
        }

        // 🔥 RENDERIZAR LISTA DE COMPETENCIAS
        function renderizarCompetencias(competencias, competenciasKey) {
            let html = `
                <div class="mb-6">
                    <h3 class="text-xl font-bold mb-4 text-gray-800">
                        ${competenciasKey === 'kompetentziak_ingreso' ? '🎯 Sarrerako kompetentziak' : '🎓 Irteerako kompetentziak'}
                    </h3>
                    <p class="text-gray-600 mb-6">
                        ${competenciasKey === 'kompetentziak_ingreso' 
                            ? 'Ikasleek sartzerakoan izan behar dituzten gaitasunak' 
                            : 'Ikasleek graduatu aurretik lortu behar dituzten gaitasunak'}
                    </p>
                    
                    <div id="competencias-list" class="space-y-4">
            `;
            
            if (competencias.length === 0) {
                html += `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-list-alt text-4xl mb-3"></i>
                        <p>Ez dago kompetentziarik definitua.</p>
                        <p class="text-sm mt-1">Gehitu lehen kompetentzia "Gehitu kompetentzia" botoiarekin.</p>
                    </div>
                `;
            } else {
                competencias.forEach((comp, index) => {
                    html += `
                        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 
                            ${competenciasKey === 'kompetentziak_ingreso' ? 'bg-blue-50' : 'bg-green-50'}">
                            <div class="flex items-start gap-3">
                                <!-- Número -->
                                <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                                    ${competenciasKey === 'kompetentziak_ingreso' 
                                        ? 'bg-blue-100 text-blue-700' 
                                        : 'bg-green-100 text-green-700'}">
                                    ${index + 1}
                                </div>
                                
                                <!-- Contenido -->
                                <div class="flex-grow">
                                    <!-- Código -->
                                    <div class="mb-2">
                                        <label class="text-xs text-gray-500 mb-1 block">Kodea</label>
                                        <input type="text" 
                                               value="${comp.kodea || `C${index + 1}`}" 
                                               onchange="updateCompetenciaGlobal('${competenciasKey}', ${index}, 'kodea', this.value)"
                                               class="w-32 border border-gray-300 rounded px-3 py-2 text-sm font-semibold
                                                   ${competenciasKey === 'kompetentziak_ingreso' 
                                                       ? 'focus:border-blue-500 focus:ring-blue-500' 
                                                       : 'focus:border-green-500 focus:ring-green-500'}">
                                    </div>
                                    
                                    <!-- Descripción -->
                                    <div>
                                        <label class="text-xs text-gray-500 mb-1 block">Deskribapena</label>
                                        <textarea 
                                            onchange="updateCompetenciaGlobal('${competenciasKey}', ${index}, 'deskribapena', this.value)"
                                            class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 
                                                ${competenciasKey === 'kompetentziak_ingreso' 
                                                    ? 'focus:border-blue-500 focus:ring-blue-500' 
                                                    : 'focus:border-green-500 focus:ring-green-500'}"
                                            rows="3">${comp.deskribapena || ''}</textarea>
                                    </div>
                                </div>
                                
                                <!-- Botón eliminar -->
                                <button onclick="deleteCompetenciaGlobal('${competenciasKey}', ${index})" 
                                        class="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                                        title="Ezabatu">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                });
            }
            
            html += `
                    </div>
                    
                    <!-- Botón añadir -->
                    <div class="mt-6 pt-4 border-t border-gray-200">
                        <button onclick="addCompetenciaGlobal('${competenciasKey}')" 
                                class="w-full ${competenciasKey === 'kompetentziak_ingreso' 
                                    ? 'bg-blue-600 hover:bg-blue-700' 
                                    : 'bg-green-600 hover:bg-green-700'} 
                                    text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center">
                            <i class="fas fa-plus mr-2"></i>Gehitu kompetentzia Berria
                        </button>
                    </div>
                </div>
            `;
            
            // Mostrar en el contenedor
            document.getElementById('unitsContainer').innerHTML = html;
            document.getElementById('noUnitsMessage').classList.add('hidden');
        }

// 🔥 FUNCIÓN PARA CAMBIAR ENTRE PANELES
window.mostrarPanel = function(panelId) {
    // Lista de todos los paneles
    const paneles = ['welcomeEditor', 'editorPanel', 'competenciasPanel'];
    
    // Ocultar todos
    paneles.forEach(id => {
        const panel = document.getElementById(id);
        if (panel) panel.classList.add('hidden');
    });
    
    // Mostrar el solicitado
    const panelAMostrar = document.getElementById(panelId);
    if (panelAMostrar) {
        panelAMostrar.classList.remove('hidden');
        console.log(`✅ Mostrando panel: ${panelId}`);
    }
};

        // 🔥 ACTUALIZAR COMPETENCIA GLOBAL
        window.updateCompetenciaGlobal = function(competenciasKey, index, campo, valor) {
            if (!window.curriculumData[competenciasKey]) return;
            
            if (!window.curriculumData[competenciasKey][index]) {
                window.curriculumData[competenciasKey][index] = {};
            }
            
            window.curriculumData[competenciasKey][index][campo] = valor;
            
            // Guardar automáticamente
            setTimeout(() => {
                window.saveCurriculumData();
                window.showToast('✅ kompetentzia eguneratua', 'success');
            }, 500);
        };
        
        // 🔥 AÑADIR COMPETENCIA GLOBAL
        window.addCompetenciaGlobal = function(competenciasKey) {
            if (!window.curriculumData[competenciasKey]) {
                window.curriculumData[competenciasKey] = [];
            }
            
            const numero = window.curriculumData[competenciasKey].length + 1;
            const esIngreso = competenciasKey === 'kompetentziak_ingreso';
            
            window.curriculumData[competenciasKey].push({
                kodea: esIngreso ? `SI${numero}` : `SE${numero}`, // SI = Sarrerako, SE = Sarrerako Egreso
                deskribapena: 'Deskribatu kompetentzia hau...',
                data_sartze: new Date().toISOString().slice(0, 10),
                egilea: window.currentUser?.email || 'admin'
            });
            
            // Volver a renderizar
            renderizarCompetencias(window.curriculumData[competenciasKey], competenciasKey);
            window.saveCurriculumData();
            window.showToast('✅ kompetentzia berria gehitu da', 'success');
        };
        
        // 🔥 ELIMINAR COMPETENCIA GLOBAL
        window.deleteCompetenciaGlobal = function(competenciasKey, index) {
            if (!window.curriculumData[competenciasKey]) return;
            
            if (confirm('Ziur zaude kompetentzia ezabatu nahi duzula?\n\nEkintza hau ezin da desegin.')) {
                window.curriculumData[competenciasKey].splice(index, 1);
                
                // Volver a renderizar
                renderizarCompetencias(window.curriculumData[competenciasKey], competenciasKey);
                window.saveCurriculumData();
                window.showToast('🗑️ kompetentzia ezabatua', 'success');
            }
        };
            
        window.inicializarMatricesSegura = function() {
            if (!window.curriculumData) {
                console.warn('⚠️ No hay curriculumData para inicializar matrices');
                return false;
            }
            
            // 🔥 INICIALIZAR SOLO SI NO EXISTE
            if (!window.curriculumData.matrices) {
                if (window.inicializarSistemaMatrices) {
                    window.inicializarSistemaMatrices();
                    console.log('✅ Matrices inicializadas desde cero');
                    return true;
                }
            } else {
                console.log('⏭️ Matrices ya existen, saltando inicialización');
                return false;
            }
            
            return false;
        };
            
        // 🔥 NORMALIZAR Y MIGRAR ESTRUCTURA JSON
        window.normalizeData = function(data) {
            console.log('🔄 Normalizando estructura de datos...');
            
            // 🔥 CREAR COPIA para no modificar el original
            const normalized = JSON.parse(JSON.stringify(data));
            
            // 1. Verificar si es estructura vieja
            const esEstructuraVieja = !data.kompetentziak_ingreso && !data.kompetentziak_egreso;
            
            if (esEstructuraVieja) {
                console.log('📦 JSON viejo detectado - Migrando a nueva estructura...');
                data = migrarEstructuraVieja(data);
            }
            
            // 2. Asegurar estructura de competencias
            if (!data.kompetentziak_ingreso) {
                data.kompetentziak_ingreso = [];
                console.log('✅ Estructura kompetentziak_ingreso creada');
            }
            
            if (!data.kompetentziak_egreso) {
                data.kompetentziak_egreso = [];
                console.log('✅ Estructura kompetentziak_egreso creada');
            }
            
            // 3. Normalizar grados y asignaturas (código existente)
            for (const grado in data) {
                // Saltar competencias (no son grados)
                if (grado === 'kompetentziak_ingreso' || grado === 'kompetentziak_egreso') {
                    continue;
                }
                
                for (const curso in data[grado]) {
                    if (Array.isArray(data[grado][curso])) {
                        data[grado][curso].forEach((subject, subjectIndex) => {
                            // Normalizar unitateak
                            if (!Array.isArray(subject.unitateak)) {
                                if (typeof subject.unitateak === 'string') {
                                    try {
                                        const parsedUnits = JSON.parse(subject.unitateak);
                                        subject.unitateak = Array.isArray(parsedUnits) ? parsedUnits : [];
                                    } catch (e) {
                                        subject.unitateak = [];
                                    }
                                } else {
                                    subject.unitateak = [];
                                }
                            }
                            
                            // Asegurar RAs
                            if (!Array.isArray(subject.currentOfficialRAs)) {
                                subject.currentOfficialRAs = [];
                            }
                            
                            // Asegurar créditos
                            if (typeof subject.kredituak !== 'number') {
                                subject.kredituak = subject.kredituak ? parseFloat(subject.kredituak) : 6;
                            }
                        });
                    }
                }
            }
            
            console.log('✅ Normalización completada');
            return normalized;
        };

// 🔥 FUNCIÓN MEJORADA DE VERIFICACIÓN
function verificarEstructuraDatos() {
    if (!window.curriculumData) {
        console.log('⏳ Ez dago daturik egiaztatzeko');
        return null;
    }
    
    console.log('🔍 DATUEN EGITURA EGIAZTATZEN...');
    
    // 🔥 USAR CURRICULUMUTILS
    const estructura = window.CurriculumUtils.verificarEstructura();
    
    const resultados = {
        grados: estructura.grados,
        competencias: { 
            ingreso: estructura.tieneCompetenciasIngreso, 
            egreso: estructura.tieneCompetenciasEgreso 
        },
        matrices: estructura.tieneMatrices,
        errores: [],
        avisos: []
    };
    
    // Verificar estructura mínima
    if (estructura.totalGrados === 0) {
        resultados.errores.push('❌ Ez dago gradu definitua');
    }
    
    if (!estructura.tieneCompetenciasIngreso) {
        resultados.avisos.push('⚠️ kompetentziak ingreso ez dago definituta');
    }
    
    if (!estructura.tieneCompetenciasEgreso) {
        resultados.avisos.push('⚠️ kompetentziak egreso ez dago definituta');
    }
    
    if (!estructura.tieneMatrices) {
        resultados.avisos.push('⚠️ Matrices ANECA ez dago definituta');
    }
    
    // Mostrar resumen
    console.log('📊 EGITURA-LABURPENA:');
    console.log(`• Graduak: ${estructura.totalGrados} (${estructura.grados.join(', ')})`);
    console.log(`• kompetentziak ingreso: ${estructura.tieneCompetenciasIngreso ? '✅ BAI' : '❌ EZ'}`);
    console.log(`• kompetentziak egreso: ${estructura.tieneCompetenciasEgreso ? '✅ BAI' : '❌ EZ'}`);
    console.log(`• Matrices ANECA: ${estructura.tieneMatrices ? '✅ BAI' : '❌ EZ'}`);
    console.log(`• Asignaturas totales: ${estructura.totalAsignaturas}`);
    console.log(`• Unidades totales: ${estructura.totalUnidades}`);
    console.log(`• RAs totales: ${estructura.totalRAs}`);
    console.log(`• Eremuak: ${estructura.eremuak.length}`);
    
    if (resultados.errores.length > 0) {
        console.error('🚨 ERROREAK:', resultados.errores);
        if (window.showToast) {
            window.showToast('⚠️ Datuak egitura akatsek', 'error');
        }
    }
    
    if (resultados.avisos.length > 0) {
        console.warn('ℹ️ AVISUAK:', resultados.avisos);
    }
    
    if (resultados.errores.length === 0 && resultados.avisos.length === 0) {
        console.log('✅ Egitura PERFEKTUA!');
    }
    
    return resultados;
}
            // 🔥 EXTRAER EREMUAK EXISTENTES DE TODAS LAS ASIGNATURAS
            function extraerEremuakDelCurriculum() {
                if (!window.curriculumData) {
                    console.log('❌ Ez dago curriculum daturik');
                    return [];
                }
                
                const eremuak = new Set();
                
                // Recorrer todos los grados y asignaturas
                Object.values(window.curriculumData).forEach(grado => {
                    // Saltar si no es un objeto de grado (como competencias)
                    if (typeof grado !== 'object' || Array.isArray(grado)) {
                        return;
                    }
                    
                    // Recorrer cursos del grado
                    Object.values(grado).forEach(curso => {
                        if (Array.isArray(curso)) {
                            curso.forEach(asignatura => {
                                if (asignatura.arloa && asignatura.arloa.trim() !== '') {
                                    eremuak.add(asignatura.arloa.trim());
                                }
                                // También buscar en campo 'eremua' por compatibilidad
                                if (asignatura.eremua && asignatura.eremua.trim() !== '') {
                                    eremuak.add(asignatura.eremua.trim());
                                }
                            });
                        }
                    });
                });
                
                const listaEremuak = Array.from(eremuak).sort();
                console.log(`📊 Eremuak aurkituak: ${listaEremuak.length}`);
                console.log(listaEremuak);
                
                return listaEremuak;
            }
            // 🔥 LLENAR SELECT DE EREMUAK CON OPCIÓN "AÑADIR NUEVO"
            function llenarSelectEremuakConEditor() {
                const select = document.getElementById('subjectArea');
                if (!select) {
                    console.error('❌ subjectArea select-a ez dago');
                    return;
                }
                
                // 1. Extraer eremuak existentes
                const eremuakExistentes = extraerEremuakDelCurriculum();
                
                // 2. Guardar valor actual antes de limpiar
                const valorActual = select.value;
                
                // 3. Limpiar y llenar select
                select.innerHTML = '';
                
                // Opción por defecto
                const optionDefault = document.createElement('option');
                optionDefault.value = '';
                optionDefault.textContent = '-- Aukeratu Arloa --';
                select.appendChild(optionDefault);
                
                // Eremuak existentes
                eremuakExistentes.forEach(eremua => {
                    const option = document.createElement('option');
                    option.value = eremua;
                    option.textContent = eremua;
                    select.appendChild(option);
                });
                
                // 🔥 OPCIÓN PARA AÑADIR NUEVO EREMUA
                const optionNuevo = document.createElement('option');
                optionNuevo.value = '__nuevo__';
                optionNuevo.textContent = '➕ Gehitu eremu berria...';
                optionNuevo.style.color = '#4F46E5';
                optionNuevo.style.fontWeight = 'bold';
                select.appendChild(optionNuevo);
                
                // Restaurar valor anterior si existe
                if (valorActual && eremuakExistentes.includes(valorActual)) {
                    select.value = valorActual;
                }
                
                console.log(`✅ Select beteta: ${eremuakExistentes.length} eremu + "Gehitu berria"`);
                
                // 4. Event listener especial con detección de "Añadir nuevo"
                select.addEventListener('change', function() {
                    if (this.value === '__nuevo__') {
                        // 🔥 MOSTRAR PROMPT PARA NUEVO EREMUA
                        const nuevoEremua = prompt('Sartu eremu berriaren izena:', '');
                        
                        if (nuevoEremua && nuevoEremua.trim() !== '') {
                            const eremuaLimpio = nuevoEremua.trim();
                            
                            // Añadir al select inmediatamente
                            const nuevaOption = document.createElement('option');
                            nuevaOption.value = eremuaLimpio;
                            nuevaOption.textContent = eremuaLimpio;
                            
                            // Insertar antes de la opción "Añadir nuevo"
                            select.insertBefore(nuevaOption, optionNuevo);
                            
                            // Seleccionar el nuevo
                            select.value = eremuaLimpio;
                            
                            // Guardar en asignatura actual
                            const subject = window.getSelectedSubject();
                            if (subject) {
                                subject.arloa = eremuaLimpio;
                                window.showToast(`✅ Eremu berria gehitu da: ${eremuaLimpio}`, 'success');
                                window.saveCurriculumData();
                                
                                // Actualizar UI
                                setTimeout(() => {
                                    llenarSelectEremuakConEditor(); // Actualizar lista
                                }, 500);
                            }
                        } else {
                            // Cancelar - volver a valor anterior
                            select.value = '';
                        }
                    } else if (this.value !== '') {
                        // Cambio normal de eremua existente
                        const subject = window.getSelectedSubject();
                        if (subject) {
                            subject.arloa = this.value;
                            window.showToast(`✅ Eremua eguneratuta: ${this.value}`, 'success');
                            window.saveCurriculumData();
                        }
                    }
                });
            }
            // 🔥 PANEL PARA GESTIONAR TODOS LOS EREMUAK (solo admin)
            function mostrarEditorEremuak() {
                // Verificar si es admin
                supabase.auth.getUser().then(({data: { user }}) => {
                    if (!user || !ADMIN_EMAILS.includes(user.email)) {
                        window.showToast('❌ Baimenik ez eremuak kudeatzeko', 'error');
                        return;
                    }
                    
                    const eremuakExistentes = extraerEremuakDelCurriculum();
                    
                    // Crear modal de edición
                    const modalHTML = `
                    <div id="eremuakModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                            <div class="flex justify-between items-center mb-6">
                                <h2 class="text-2xl font-bold text-gray-800">
                                    <i class="fas fa-palette text-purple-600 mr-2"></i>Eremuak Kudeatu
                                </h2>
                                <button onclick="document.getElementById('eremuakModal').remove()" 
                                        class="text-gray-500 hover:text-gray-700 text-2xl">
                                    &times;
                                </button>
                            </div>
                            
                            <div class="mb-6">
                                <h3 class="font-bold text-lg text-gray-700 mb-3">Eremu existenteak (${eremuakExistentes.length})</h3>
                                <div id="listaEremuak" class="space-y-2 mb-4">
                                    ${eremuakExistentes.map((eremua, i) => `
                                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                                            <span class="font-medium">${eremua}</span>
                                            <div class="flex items-center gap-2">
                                                <button onclick="renombrarEremua('${eremua}')" 
                                                        class="text-blue-500 hover:text-blue-700 p-1"
                                                        title="Berrizendatu">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                                <button onclick="eliminarEremua('${eremua}')" 
                                                        class="text-red-500 hover:text-red-700 p-1"
                                                        title="Ezabatu">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div class="border-t pt-4">
                                <h3 class="font-bold text-lg text-green-700 mb-3">Eremu berria gehitu</h3>
                                <div class="flex gap-2">
                                    <input type="text" id="nuevoEremuaInput" 
                                           placeholder="Eremu berriaren izena" 
                                           class="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500">
                                    <button onclick="gehituEremuaBerria()" 
                                            class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                                        Gehitu
                                    </button>
                                </div>
                            </div>
                            
                            <div class="mt-6 text-center text-sm text-gray-500">
                                <p><i class="fas fa-info-circle mr-1"></i>Eremuak automatikoki ateratzen dira asignatura guztietatik</p>
                            </div>
                        </div>
                    </div>
                    `;
                    
                    document.body.insertAdjacentHTML('beforeend', modalHTML);
                });
            }
            
            // 🔥 FUNCIONES AUXILIARES PARA EDITAR EREMUAK
            function renombrarEremua(eremuaViejo) {
                const nuevoNombre = prompt(`Berrizendatu "${eremuaViejo}":`, eremuaViejo);
                
                if (nuevoNombre && nuevoNombre.trim() !== '' && nuevoNombre !== eremuaViejo) {
                    // Actualizar en TODAS las asignaturas
                    Object.values(window.curriculumData).forEach(grado => {
                        if (typeof grado === 'object' && !Array.isArray(grado)) {
                            Object.values(grado).forEach(curso => {
                                if (Array.isArray(curso)) {
                                    curso.forEach(asignatura => {
                                        if (asignatura.arloa === eremuaViejo) {
                                            asignatura.arloa = nuevoNombre.trim();
                                        }
                                        if (asignatura.eremua === eremuaViejo) {
                                            asignatura.eremua = nuevoNombre.trim();
                                        }
                                    });
                                }
                            });
                        }
                    });
                    
                    window.showToast(`✅ Eremua berrizendatua: ${eremuaViejo} → ${nuevoNombre}`, 'success');
                    window.saveCurriculumData();
                    
                    // Actualizar UI
    setTimeout(() => {
        safeRemoveElement('eremuakModal');
        mostrarEditorEremuak();
    }, 500);
}
            }
            
            function eliminarEremua(eremua) {
                if (confirm(`Ziur zaude "${eremua}" ezabatu nahi duzula?\n\nAsignatura guztiak "undefined" geratuko dira eremu honetan.`)) {
                    // Poner null en lugar de eliminar
                    Object.values(window.curriculumData).forEach(grado => {
                        if (typeof grado === 'object' && !Array.isArray(grado)) {
                            Object.values(grado).forEach(curso => {
                                if (Array.isArray(curso)) {
                                    curso.forEach(asignatura => {
                                        if (asignatura.arloa === eremua) {
                                            asignatura.arloa = null;
                                        }
                                        if (asignatura.eremua === eremua) {
                                            asignatura.eremua = null;
                                        }
                                    });
                                }
                            });
                        }
                    });
                    
                    window.showToast(`🗑️ Eremua ezabatua: ${eremua}`, 'success');
                    window.saveCurriculumData();
                    
    setTimeout(() => {
        safeRemoveElement('eremuakModal');
        mostrarEditorEremuak();
        llenarSelectEremuakConEditor();
    }, 500);
}
            }
            
            function gehituEremuaBerria() {
                const input = document.getElementById('nuevoEremuaInput');
                if (!input || !input.value.trim()) {
                    window.showToast('❌ Sartu eremuaren izena', 'error');
                    return;
                }
                
                const nuevoEremua = input.value.trim();
                
                // Verificar que no existe ya
                const eremuakExistentes = extraerEremuakDelCurriculum();
                if (eremuakExistentes.includes(nuevoEremua)) {
                    window.showToast('❌ Eremua jada existitzen da', 'error');
                    return;
                }
                
                // Añadir al select global
                llenarSelectEremuakConEditor();
                
                window.showToast(`✅ Eremu berria gehitu da: ${nuevoEremua}`, 'success');
                input.value = '';
                
                // Cerrar y reabrir modal para mostrar actualizado
    setTimeout(() => {
        safeRemoveElement('eremuakModal');
        mostrarEditorEremuak();
    }, 300);
}


        // 🔥 MIGRAR ESTRUCTURA VIEJA A NUEVA
        function migrarEstructuraVieja(dataViejo) {
            console.log('🔄 Migrando estructura vieja...');
            
            const dataNuevo = {};
            let competenciasEncontradas = false;
            
            // 1. Separar grados de competencias
            for (const key in dataViejo) {
                // Si es un grado (contiene cursos 1-4)
                if (typeof dataViejo[key] === 'object' && 
                    (dataViejo[key]['1. Maila'] || dataViejo[key]['1. curso'])) {
                    
                    dataNuevo[key] = dataViejo[key];
                    console.log(`✅ Grado migrado: ${key}`);
                    
                } 
                // Si son competencias en estructura vieja (dentro de grado)
                else if (key === 'kompetentziak_ingreso' || key === 'kompetentziak_egreso') {
                    competenciasEncontradas = true;
                    dataNuevo[key] = dataViejo[key];
                    console.log(`✅ Competencias migradas: ${key}`);
                }
                // Buscar competencias dentro de grados (estructura incorrecta vieja)
                else if (typeof dataViejo[key] === 'object') {
                    for (const subKey in dataViejo[key]) {
                        if (subKey === 'kompetentziak_ingreso' || subKey === 'kompetentziak_egreso') {
                            competenciasEncontradas = true;
                            dataNuevo[subKey] = dataViejo[key][subKey];
                            console.log(`✅ Competencias extraídas de ${key}: ${subKey}`);
                            
                            // Eliminar del grado
                            delete dataViejo[key][subKey];
                        }
                    }
                }
            }
            
            // 2. Si no se encontraron competencias, crear estructuras vacías
            if (!competenciasEncontradas) {
                dataNuevo.kompetentziak_ingreso = [];
                dataNuevo.kompetentziak_egreso = [];
                console.log('✅ Estructuras de competencias creadas (vacías)');
            }
            
            return dataNuevo;
        }

                // ============================================
        // SISTEMA DE MATRICES ANECA
        // ============================================
        
        // 🔥 1. INICIALIZAR SISTEMA DE MATRICES
        window.inicializarSistemaMatrices = function() {
            if (!window.curriculumData.matrices) {
                window.curriculumData.matrices = crearEstructuraMatrices();
                console.log('✅ Sistema de matrices inicializado');
            }
            
            // Generar colores automáticos para eremuak
            generarColoresEremuak();
            
            // Extraer competencias automáticamente
            extraerCompetenciasAutomaticamente();
            
            // Extraer RAs de asignaturas
            extraerRAsAutomaticamente();
        };
        
        // 🔥 2. CREAR ESTRUCTURA BÁSICA
        function crearEstructuraMatrices() {
            return {
                version: "1.0",
                ultima_actualizacion: new Date().toISOString(),
                matriz_competencias_ra: { competencias: [], resultados_aprendizaje: [], relaciones: [] },
                matriz_ra_asignaturas: { relaciones: [] },
                matriz_competencias_asignaturas: { relaciones: [] },
                matriz_contenidos_ra: { contenidos: [], relaciones: [] },
                colores_eremuak: {},
                configuracion: {
                    niveles_contribucion: ['I', 'D', 'Dp'],
                    colores_niveles: { 'I': '#4CAF50', 'D': '#FF9800', 'Dp': '#F44336' }
                }
            };
        }
        
        // 🔥 3. GENERAR COLORES POR EREMUA
        function generarColoresEremuak() {
            const eremuak = extraerEremuakDelCurriculum();
            const colores = [
                '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
                '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
            ];
            
            window.curriculumData.matrices.colores_eremuak = {};
            eremuak.forEach((eremua, index) => {
                window.curriculumData.matrices.colores_eremuak[eremua] = 
                    colores[index % colores.length];
            });
            
            console.log('🎨 Colores generados para', eremuak.length, 'eremuak');
        }
        
        // 🔥 4. EXTRAER COMPETENCIAS AUTOMÁTICAMENTE
        function extraerCompetenciasAutomaticamente() {
            const matrices = window.curriculumData.matrices;
            const competenciasIngreso = window.curriculumData.kompetentziak_ingreso || [];
            const competenciasEgreso = window.curriculumData.kompetentziak_egreso || [];
            
            // Añadir competencias de ingreso
            competenciasIngreso.forEach(comp => {
                if (!matrices.matriz_competencias_ra.competencias.some(c => c.codigo === comp.kodea)) {
                    matrices.matriz_competencias_ra.competencias.push({
                        id: 'CI-' + Date.now() + '-' + Math.random(),
                        codigo: comp.kodea,
                        descripcion: comp.deskribapena,
                        tipo: 'ingreso',
                        origen: 'kompetentziak_ingreso'
                    });
                }
            });
            
            // Añadir competencias de egreso
            competenciasEgreso.forEach(comp => {
                if (!matrices.matriz_competencias_ra.competencias.some(c => c.codigo === comp.kodea)) {
                    matrices.matriz_competencias_ra.competencias.push({
                        id: 'CE-' + Date.now() + '-' + Math.random(),
                        codigo: comp.kodea,
                        descripcion: comp.deskribapena,
                        tipo: 'egreso',
                        origen: 'kompetentziak_egreso'
                    });
                }
            });
            
            console.log('📋 Competencias extraídas:', matrices.matriz_competencias_ra.competencias.length);
        }
        
        // 🔥 5. EXTRAER RAs AUTOMÁTICAMENTE
        function extraerRAsAutomaticamente() {
            const matrices = window.curriculumData.matrices;
            let raCount = 0;
            
            // Recorrer todas las asignaturas de todos los grados
            Object.values(window.curriculumData).forEach(grado => {
                if (typeof grado !== 'object' || Array.isArray(grado)) return;
                
                Object.values(grado).forEach(curso => {
                    if (Array.isArray(curso)) {
                        curso.forEach(asignatura => {
                            if (asignatura.currentOfficialRAs && Array.isArray(asignatura.currentOfficialRAs)) {
                                asignatura.currentOfficialRAs.forEach((raText, index) => {
                                    const raCodigo = `RA${raCount + 1}`;
                                    if (!matrices.matriz_competencias_ra.resultados_aprendizaje.some(r => r.descripcion === raText)) {
                                        matrices.matriz_competencias_ra.resultados_aprendizaje.push({
                                            id: 'RA-' + Date.now() + '-' + Math.random(),
                                            codigo: raCodigo,
                                            descripcion: raText,
                                            origen_asignatura: asignatura.izena,
                                            origen_grado: Object.keys(window.curriculumData).find(g => window.curriculumData[g] === grado)
                                        });
                                        raCount++;
                                    }
                                });
                            }
                        });
                    }
                });
            });
            
            console.log('📋 RAs extraídos:', matrices.matriz_competencias_ra.resultados_aprendizaje.length);
        }
  
        // 🔥 FUNCIÓN PARA MOSTRAR LAS 4 MATRICES ANECA
        window.mostrarMatricesANECA = function() {
    console.log('📊 Mostrando matrices ANECA mejorado');
    
    // 1. Verificar sesión
    supabase.auth.getUser().then(({data: { user }}) => {
        if (!user) {
            window.showToast('❌ Saioa hasi behar duzu', 'error');
            return;
        }
        
        // 2. Calcular estadísticas ANTES de crear el modal
        const estadisticas = calcularEstadisticasMatrices();
        
        // 3. Crear modal MEJORADO con estadísticas
        const modalHTML = `
        <div id="matricesModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-th-large text-purple-600 mr-2"></i>Matrices ANECA
                    </h2>
                    <button onclick="document.getElementById('matricesModal').remove()" 
                            class="text-gray-500 hover:text-gray-700 text-2xl">
                        &times;
                    </button>
                </div>
                
                <!-- 🔥 PANEL DE ESTADÍSTICAS -->
                <div class="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 class="font-bold text-gray-700 mb-3">📊 Estado actual del sistema</h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-blue-600">${estadisticas.grados}</div>
                            <div class="text-sm text-gray-600">Grados</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-green-600">${estadisticas.asignaturas}</div>
                            <div class="text-sm text-gray-600">Asignaturas</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-yellow-600">${estadisticas.eremuak}</div>
                            <div class="text-sm text-gray-600">Eremuak</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-red-600">${estadisticas.unidades}</div>
                            <div class="text-sm text-gray-600">Unidades</div>
                        </div>
                    </div>
                </div>
                
                <div class="grid md:grid-cols-2 gap-6">
                    <!-- MATRIZ 1 -->
                    <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                        <h3 class="font-bold text-lg text-blue-700 mb-2">
                            <i class="fas fa-sitemap mr-2"></i>Competencias ↔ RA
                        </h3>
                        <p class="text-gray-600 mb-3">Coherencia vertical competencias-resultados</p>
                        <div class="text-xs text-gray-500 mb-3">
                            <i class="fas fa-info-circle mr-1"></i>
                            ${estadisticas.competencias_ingreso} ingreso | ${estadisticas.competencias_egreso} egreso
                        </div>
                        <button onclick="abrirMatriz('competencias-ra')" 
                                class="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                            Configurar Matriz
                        </button>
                    </div>
                    
                    <!-- MATRIZ 2 -->
                    <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                        <h3 class="font-bold text-lg text-green-700 mb-2">
                            <i class="fas fa-project-diagram mr-2"></i>RA ↔ Asignaturas
                        </h3>
                        <p class="text-gray-600 mb-3">Cobertura curricular por asignatura</p>
                        <div class="text-xs text-gray-500 mb-3">
                            <i class="fas fa-info-circle mr-1"></i>
                            ${estadisticas.ra_total} resultados identificados
                        </div>
                        <button onclick="abrirMatriz('ra-asignaturas')" 
                                class="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">
                            Configurar Matriz
                        </button>
                    </div>
                    
                    <!-- MATRIZ 3 -->
                    <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                        <h3 class="font-bold text-lg text-yellow-700 mb-2">
                            <i class="fas fa-table-cells-large mr-2"></i>Competencias ↔ Asignaturas
                        </h3>
                        <p class="text-gray-600 mb-3">Coherencia horizontal por áreas</p>
                        <div class="text-xs text-gray-500 mb-3">
                            <i class="fas fa-info-circle mr-1"></i>
                            Colores por eremua
                        </div>
                        <button onclick="abrirMatriz('competencias-asignaturas')" 
                                class="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded">
                            Configurar Matriz
                        </button>
                    </div>
                    
                    <!-- MATRIZ 4 -->
                    <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                        <h3 class="font-bold text-lg text-red-700 mb-2">
                            <i class="fas fa-cubes mr-2"></i>Contenidos ↔ RA
                        </h3>
                        <p class="text-gray-600 mb-3">Alineación de contenidos con resultados</p>
                        <div class="text-xs text-gray-500 mb-3">
                            <i class="fas fa-info-circle mr-1"></i>
                            ${estadisticas.unidades} unidades disponibles
                        </div>
                        <button onclick="abrirMatriz('contenidos-ra')" 
                                class="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded">
                            Configurar Matriz
                        </button>
                    </div>
                </div>
                
                <div class="mt-6 text-center text-sm text-gray-500">
                    <p><i class="fas fa-database mr-1"></i>Datos sincronizados en tiempo real</p>
                </div>
            </div>
        </div>
        `;
        
        // 4. Añadir modal al DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    });
};

// 🔥 NUEVA FUNCIÓN: CALCULAR ESTADÍSTICAS
function calcularEstadisticasMatrices() {
    if (!window.curriculumData) {
        return {
            grados: 0,
            asignaturas: 0,
            eremuak: 0,
            unidades: 0,
            competencias_ingreso: 0,
            competencias_egreso: 0,
            ra_total: 0
        };
    }
    
    // 🔥 USAR CURRICULUMUTILS PARA TODOS LOS CÁLCULOS
    const utils = window.CurriculumUtils;
    
    // Obtener grados
    const grados = utils.getDegrees();
    
    // Contar asignaturas
    const asignaturas = utils.countTotalAsignaturas();
    
    // Obtener eremuak
    const eremuak = utils.extraerEremuakDelCurriculum();
    
    // Contar unidades
    const unidades = utils.countTotalUnidades();
    
    // Contar RAs
    const ra_total = utils.countTotalRAs();
    
    // Contar competencias
    const competencias_ingreso = utils.countCompetencias('ingreso');
    const competencias_egreso = utils.countCompetencias('egreso');
    
    return {
        grados: grados.length,
        asignaturas: asignaturas,
        eremuak: eremuak.length,
        unidades: unidades,
        competencias_ingreso: competencias_ingreso,
        competencias_egreso: competencias_egreso,
        ra_total: ra_total
    };
}
    
    // 🔥 REEMPLAZA la función completa actualizarEstadisticasMatrices() con:

function actualizarEstadisticasMatrices() {
    setTimeout(() => {
        if (!window.curriculumData || !window.curriculumData.matrices) return;
        
        const m = window.curriculumData.matrices;
        
        // Contar asignaturas totales
        let asignaturaCount = 0;
        if (window.curriculumData) {
            Object.values(window.curriculumData).forEach(grado => {
                if (typeof grado === 'object' && !Array.isArray(grado)) {
                    Object.values(grado).forEach(curso => {
                        if (Array.isArray(curso)) asignaturaCount += curso.length;
                    });
                }
            });
        }
        
        // 🔥 USAR safeSetText para todas las asignaciones
        safeSetText('countComp', m.matriz_competencias_ra.competencias.length);
        safeSetText('countRA', m.matriz_competencias_ra.resultados_aprendizaje.length);
        safeSetText('countRel1', m.matriz_competencias_ra.relaciones.length);
        safeSetText('countAsig', asignaturaCount);
        safeSetText('countCompEgreso', m.matriz_competencias_ra.competencias.filter(c => c.tipo === 'egreso').length);
        safeSetText('countRel3', m.matriz_competencias_asignaturas.relaciones.length);
        safeSetText('countCont', m.matriz_contenidos_ra.contenidos.length);
        safeSetText('countRel4', m.matriz_contenidos_ra.relaciones.length);
        
        // Calcular cobertura RA
        const totalRA = m.matriz_competencias_ra.resultados_aprendizaje.length;
        const raConCobertura = new Set(m.matriz_ra_asignaturas.relaciones.map(r => r.ra_id)).size;
        const coberturaTexto = totalRA > 0 ? `${Math.round((raConCobertura / totalRA) * 100)}%` : '0%';
        safeSetText('coberturaRA', coberturaTexto);
    }, 100);
}
    
    // 🔥 7. FUNCIÓN PARA ABRIR EDITOR DETALLADO
    window.abrirEditorMatrizDetallado = function(tipo) {
        console.log(`📝 Abriendo editor: ${tipo}`);
        
        // Cerrar modal principal
        safeRemoveElement('editorMatrizDetallado');
        
        // Mostrar mensaje simple (para empezar)
        window.showToast(`🔄 Preparando editor de Matriz ${tipo}...`, 'normal');
        
        // Crear editor básico
        const editorHTML = `
        <div id="editorMatriz" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-edit mr-2"></i>Editor: ${tipo.replace('-', ' ↔ ').toUpperCase()}
                    </h2>
                    <button onclick="document.getElementById('editorMatriz').remove()" 
                            class="text-gray-500 hover:text-gray-700 text-2xl">
                        &times;
                    </button>
                </div>
                
                <div class="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 class="font-bold text-gray-700 mb-2">📊 Vista previa</h3>
                    <p class="text-gray-600">Esta matriz se integrará automáticamente con tus datos existentes.</p>
                    <p class="text-sm text-gray-500 mt-2">Competencias: ${window.curriculumData?.matrices?.matriz_competencias_ra.competencias.length || 0} | 
                    RAs: ${window.curriculumData?.matrices?.matriz_competencias_ra.resultados_aprendizaje.length || 0}</p>
                </div>
                
                <div class="grid md:grid-cols-2 gap-6">
                    <div class="border border-gray-300 rounded-lg p-4">
                        <h4 class="font-bold text-gray-700 mb-3"><i class="fas fa-database mr-2"></i>Datos disponibles</h4>
                        <div class="space-y-2">
                            <div class="flex justify-between">
                                <span>Grados en sistema:</span>
                                <span class="font-bold">${Object.keys(window.curriculumData || {}).filter(k => !k.includes('kompetentziak') && k !== '_metadata').length}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Asignaturas totales:</span>
                                <span class="font-bold" id="countTotalAsig">Calculando...</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Eremuak identificados:</span>
                                <span class="font-bold">${window.curriculumData?.matrices?.colores_eremuak ? Object.keys(window.curriculumData.matrices.colores_eremuak).length : 0}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="border border-gray-300 rounded-lg p-4">
                        <h4 class="font-bold text-gray-700 mb-3"><i class="fas fa-tools mr-2"></i>Acciones</h4>
                        <div class="space-y-3">
                            <button onclick="extraerDatosAutomaticos('${tipo}')" 
                                    class="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                                <i class="fas fa-magic mr-2"></i>Extraer datos automáticamente
                            </button>
                            <button onclick="generarMatrizAutomatica('${tipo}')" 
                                    class="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">
                                <i class="fas fa-robot mr-2"></i>Generar matriz automática
                            </button>
                            <button onclick="guardarMatriz('${tipo}')" 
                                    class="w-full bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded">
                                <i class="fas fa-save mr-2"></i>Guardar configuración
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="mt-6 text-center text-sm text-gray-500">
                    <p><i class="fas fa-lightbulb mr-1"></i>El sistema completo de matrices se desarrollará en la siguiente fase</p>
                </div>
            </div>
        </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', editorHTML);
        
        // Actualizar contador de asignaturas
        setTimeout(() => {
            let asignaturaCount = 0;
            if (window.curriculumData) {
                Object.values(window.curriculumData).forEach(grado => {
                    if (typeof grado === 'object' && !Array.isArray(grado)) {
                        Object.values(grado).forEach(curso => {
                            if (Array.isArray(curso)) asignaturaCount += curso.length;
                        });
                    }
                });
            }
            document.getElementById('countTotalAsig') && 
                (document.getElementById('countTotalAsig').textContent = asignaturaCount);
        }, 100);
    };
    
    // 🔥 8. FUNCIONES AUXILIARES SIMPLES
    window.extraerDatosAutomaticos = function(tipo) {
        window.showToast('🔍 Extrayendo datos automáticamente...', 'normal');
        
        // Extraer competencias si existen
        if (window.curriculumData?.kompetentziak_ingreso || window.curriculumData?.kompetentziak_egreso) {
            console.log('✅ Competencias encontradas en curriculumData');
        }
        
        // Contar unidades didácticas
        let unidadCount = 0;
        if (window.curriculumData) {
            Object.values(window.curriculumData).forEach(grado => {
                if (typeof grado === 'object' && !Array.isArray(grado)) {
                    Object.values(grado).forEach(curso => {
                        if (Array.isArray(curso)) {
                            curso.forEach(asig => {
                                if (asig.unitateak && Array.isArray(asig.unitateak)) {
                                    unidadCount += asig.unitateak.length;
                                }
                            });
                        }
                    });
                }
            });
        }
        
        window.showToast(`✅ Extraídos: ${unidadCount} unidades didácticas`, 'success');
    };
    
    window.generarMatrizAutomatica = function(tipo) {
        window.showToast(`🔄 Generando matriz ${tipo}...`, 'normal');
        setTimeout(() => {
            window.showToast('✅ Matriz generada (modo demo)', 'success');
        }, 1500);
    };
    
    window.guardarMatriz = function(tipo) {
        if (window.curriculumData.matrices) {
            window.curriculumData.matrices.ultima_actualizacion = new Date().toISOString();
            window.showToast('💾 Matriz guardada en memoria', 'success');
            
            // Opcional: guardar en Supabase
            setTimeout(() => {
                if (typeof window.saveCurriculumData === 'function') {
                    window.saveCurriculumData();
                }
            }, 1000);
        }
    };


        // 🔥 7. FUNCIONES AUXILIARES
        function cerrarMatricesModal() {
            safeRemoveElement('matricesModal');
        }
        


        // 🔥 8. EDITOR DE MATRIZ GENÉRICO
        window.abrirEditorMatriz = function(tipo) {
            cerrarMatricesModal();
            
            const titulos = {
                'competencias-ra': 'Competencias ↔ Resultados de Aprendizaje',
                'ra-asignaturas': 'RA ↔ Asignaturas', 
                'competencias-asignaturas': 'Competencias ↔ Asignaturas',
                'contenidos-ra': 'Contenidos ↔ RA'
            };
            
            const modalHTML = `
            <div id="editorMatrizModal" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-xl p-6 max-w-7xl w-full max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-800">
                            <i class="fas fa-edit mr-2"></i>${titulos[tipo] || 'Editor de Matriz'}
                        </h2>
                        <button onclick="cerrarEditorMatriz()" 
                                class="text-gray-500 hover:text-gray-700 text-2xl">
                            &times;
                        </button>
                    </div>
                    
                    <div id="contenidoEditorMatriz" class="min-h-[400px]">
                        <!-- Se cargará dinámicamente según el tipo -->
                        <div class="text-center py-20 text-gray-400">
                            <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                            <p>Cargando editor de matriz...</p>
                        </div>
                    </div>
                </div>
            </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Cargar editor específico
            setTimeout(() => cargarEditorEspecifico(tipo), 100);
        };
        
        function cerrarEditorMatriz() {
            safeRemoveElement('editorMatrizModal');
        }

        // 🔥 9. SISTEMA DE ARRASTRE (DRAG & DROP)
        window.configurarDragAndDrop = function() {
            // Usar la API HTML5 Drag & Drop
            const elementosArrastrables = document.querySelectorAll('[draggable="true"]');
            
            elementosArrastrables.forEach(elemento => {
                elemento.addEventListener('dragstart', function(e) {
                    e.dataTransfer.setData('text/plain', this.id);
                    this.classList.add('dragging');
                });
                
                elemento.addEventListener('dragend', function() {
                    this.classList.remove('dragging');
                });
            });
            
            const zonasDestino = document.querySelectorAll('.drop-zone');
            
            zonasDestino.forEach(zona => {
                zona.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    this.classList.add('drag-over');
                });
                
                zona.addEventListener('dragleave', function() {
                    this.classList.remove('drag-over');
                });
                
                zona.addEventListener('drop', function(e) {
                    e.preventDefault();
                    this.classList.remove('drag-over');
                    
                    const idElemento = e.dataTransfer.getData('text/plain');
                    const elemento = document.getElementById(idElemento);
                    
                    if (elemento) {
                        // Procesar la relación
                        procesarRelacionArrastre(elemento, this);
                    }
                });
            });
        };

        // 🔥 10. GUARDADO AUTOMÁTICO
        function guardarMatrices() {
            if (!window.curriculumData.matrices) return;
            
            window.curriculumData.matrices.ultima_actualizacion = new Date().toISOString();
            
            // Guardar en Supabase
            setTimeout(() => {
                if (typeof window.saveCurriculumData === 'function') {
                    window.saveCurriculumData();
                    window.showToast('✅ Matrices guardadas', 'success');
                }
            }, 500);
        }
        
        // 🔥 11. INTEGRAR CON LOAD CURRICULUM DATA
        // Modificar loadCurriculumData para inicializar matrices
        const originalLoadCurriculumData = window.loadCurriculumData;
        window.loadCurriculumData = async function() {
            await originalLoadCurriculumData?.();
            
            // Inicializar sistema de matrices
            if (window.curriculumData && !window.curriculumData.matrices) {
                window.inicializarSistemaMatrices();
            }
            
            return window.curriculumData;
        };

        // 🔥 FUNCIÓN PARA ABRIR MATRIZ ESPECÍFICA
        window.abrirMatriz = function(tipo) {
            const paginas = {
                // Matrices originales (si existen)
                'competencias-vs-asignaturas': 'matriz1.html',
                'asignaturas-vs-resultados': 'matriz2.html', 
                'temporalizacion': 'matriz3.html',
                'evaluacion': 'matriz4.html',
                
                // Nuevas matrices ANECA (modo desarrollo)
                'competencias-ra': '#',
                'ra-asignaturas': '#',
                'competencias-asignaturas': '#',
                'contenidos-ra': '#'
            };
            
            const pagina = paginas[tipo];
            
            if (!pagina) {
                window.showToast('❌ Matriz no encontrada', 'error');
                return;
            }
            
            // Cerrar modal
            safeRemoveElement('matricesModal');
            
            if (pagina === '#') {
                // Matriz en desarrollo - mostrar editor básico
                mostrarEditorMatrizBasico(tipo);
            } else {
                // Redirigir a página existente
                window.location.href = pagina;
            }
        };
    
        // 🔥 EDITOR BÁSICO PARA MATRICES EN DESARROLLO
        function mostrarEditorMatrizBasico(tipo) {
            const nombres = {
                'competencias-ra': 'Competencias ↔ Resultados de Aprendizaje',
                'ra-asignaturas': 'Resultados ↔ Asignaturas',
                'competencias-asignaturas': 'Competencias ↔ Asignaturas',
                'contenidos-ra': 'Contenidos ↔ Resultados'
            };
            
            const editorHTML = `
            <div id="editorMatrizBasico" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-800">
                            <i class="fas fa-cogs mr-2"></i>${nombres[tipo] || 'Editor de Matriz'}
                        </h2>
                        <button onclick="document.getElementById('editorMatrizBasico').remove()" 
                                class="text-gray-500 hover:text-gray-700 text-2xl">
                            &times;
                        </button>
                    </div>
                    
                    <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
                        <h3 class="font-bold text-yellow-700 mb-2">
                            <i class="fas fa-tools mr-2"></i>En desarrollo
                        </h3>
                        <p class="text-yellow-600">Esta matriz está actualmente en desarrollo.</p>
                        <p class="text-sm text-yellow-500 mt-1">Puedes configurar los datos base que se usarán.</p>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de matriz</label>
                            <input type="text" value="${tipo}" class="w-full border rounded p-2 bg-gray-100" readonly>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                            <textarea class="w-full border rounded p-2" rows="3" placeholder="Describe el propósito de esta matriz..."></textarea>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Niveles de contribución</label>
                            <div class="flex gap-2">
                                <span class="bg-green-100 text-green-800 px-3 py-1 rounded">I (Introduce)</span>
                                <span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded">D (Desarrolla)</span>
                                <span class="bg-red-100 text-red-800 px-3 py-1 rounded">Dp (Domina/Profundiza)</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-6 flex justify-end gap-3">
                        <button onclick="document.getElementById('editorMatrizBasico').remove()" 
                                class="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button onclick="guardarConfiguracionMatriz('${tipo}')" 
                                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                            Guardar Configuración
                        </button>
                    </div>
                </div>
            </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', editorHTML);
        }

// 🔥 FUNCIÓN PARA MOSTRAR SELECTOR DE GRADO PARA COMPETENCIAS
function mostrarPanelSeleccionGradoCompetencias() {
    console.log('🎯 Mostrando selector de grado para competencias...');
    
    // Obtener lista de grados disponibles
    const grados = obtenerGradosDelCurriculum();
    
    let html = `
    <div class="space-y-6 p-6">
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <h2 class="text-2xl font-bold text-blue-800 mb-3">
                <i class="fas fa-graduation-cap mr-2"></i>Vincular ${window.selectedCompetenciaTipo === 'ingreso' ? 'Sarrerako' : 'Irteerako'} kompetentziak
            </h2>
            <p class="text-blue-700 mb-4">
                Aukeratu zein gradu eta arlotara lotu nahi dituzun kompetentziak
            </p>
        </div>
        
        <!-- Paso 1: Seleccionar Grado -->
        <div class="border border-gray-300 rounded-lg p-5">
            <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <span class="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mr-3">1</span>
                Aukeratu Gradua
            </h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="gradosLista">
    `;
    
    // Mostrar botones para cada grado
    grados.forEach(grado => {
        html += `
            <button onclick="seleccionarGradoParaCompetencia('${grado}')" 
                    class="p-4 border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition text-left">
                <div class="flex items-center">
                    <i class="fas fa-university text-blue-600 mr-3 text-xl"></i>
                    <div>
                        <h4 class="font-bold text-gray-800">${grado}</h4>
                        <p class="text-sm text-gray-600 mt-1">Klik egin gradu hau aukeratzeko</p>
                    </div>
                </div>
            </button>
        `;
    });
    
    html += `
            </div>
        </div>
        
        <!-- Paso 2: Seleccionar Área (solo si hay grado seleccionado) -->
        <div id="seccionArea" class="border border-gray-300 rounded-lg p-5 hidden">
            <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <span class="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center mr-3">2</span>
                Aukeratu Arloa (aukerazkoa)
            </h3>
            <p class="text-gray-600 mb-4">
                Aukeratu arlo zehatz bat kompetentziak lotzeko, edo utzi "Guztiak" aukeratuta gradu osorako
            </p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="areasLista">
                <!-- Se llenará dinámicamente -->
            </div>
            
            <div class="mt-6">
                <button onclick="seleccionarTodasLasAreas()" 
                        class="w-full p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition">
                    <i class="fas fa-globe mr-2"></i>Guztiak - kompetentziak gradu osorako
                </button>
            </div>
        </div>
        
        <!-- Botón cancelar -->
        <div class="mt-6 text-center">
            <button onclick="window.resetEditor()" 
                    class="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                <i class="fas fa-times mr-2"></i>Utzi
            </button>
        </div>
    </div>
    `;
    
    // Mostrar en el contenedor principal
    document.getElementById('unitsContainer').innerHTML = html;
    document.getElementById('noUnitsMessage').classList.add('hidden');
    
    // Si ya hay un grado seleccionado, mostrar las áreas automáticamente
    if (window.selectedCompetenciaGrado) {
        cargarAreasParaGrado(window.selectedCompetenciaGrado);
    }
}

// 🔥 SELECCIONAR GRADO PARA COMPETENCIAS
window.seleccionarGradoParaCompetencia = function(grado) {
    console.log(`🎓 Grado seleccionado para competencias: ${grado}`);
    window.selectedCompetenciaGrado = grado;
    
    // Actualizar UI
    document.querySelectorAll('#gradosLista button').forEach(btn => {
        btn.classList.remove('bg-blue-100', 'border-blue-500', 'ring-2', 'ring-blue-300');
        if (btn.textContent.includes(grado)) {
            btn.classList.add('bg-blue-100', 'border-blue-500', 'ring-2', 'ring-blue-300');
        }
    });
    
    // Mostrar sección de áreas
    cargarAreasParaGrado(grado);
};

// 🔥 CARGAR ÁREAS PARA UN GRADO
function cargarAreasParaGrado(grado) {
    // Obtener áreas únicas de ese grado
    const areas = extraerAreasDeGrado(grado);
    
    let html = '';
    
    // Botón para cada área
    areas.forEach(area => {
        html += `
            <button onclick="seleccionarAreaParaCompetencia('${area}')" 
                    class="p-4 border border-gray-300 rounded-lg hover:bg-green-50 hover:border-green-300 transition text-left">
                <div class="flex items-center">
                    <div class="w-3 h-3 rounded-full bg-green-500 mr-3"></div>
                    <div>
                        <h4 class="font-bold text-gray-800">${area}</h4>
                        <p class="text-sm text-gray-600 mt-1">Klik egin arlo hau aukeratzeko</p>
                    </div>
                </div>
            </button>
        `;
    });
    
    // Si no hay áreas, mostrar opción "sin áreas específicas"
    if (areas.length === 0) {
        html = `
            <div class="col-span-3 text-center py-8 text-gray-500">
                <i class="fas fa-info-circle text-3xl mb-3"></i>
                <p>Ez dago arlo espezifikorik gradu honetarako.</p>
                <p class="text-sm mt-1">kompetentziak gradu osorako defini daitezke.</p>
            </div>
        `;
    }
    
    document.getElementById('areasLista').innerHTML = html;
    document.getElementById('seccionArea').classList.remove('hidden');
    
    // Scroll a la sección de áreas
    document.getElementById('seccionArea').scrollIntoView({ behavior: 'smooth' });
}

// 🔥 EXTRAR ÁREAS DE UN GRADO ESPECÍFICO
function extraerAreasDeGrado(grado) {
    if (!window.curriculumData || !window.curriculumData[grado]) {
        return [];
    }
    
    const areasSet = new Set();
    
    // Recorrer todos los cursos del grado
    Object.values(window.curriculumData[grado]).forEach(curso => {
        if (Array.isArray(curso)) {
            curso.forEach(asignatura => {
                if (asignatura.arloa && asignatura.arloa.trim()) {
                    areasSet.add(asignatura.arloa.trim());
                }
            });
        }
    });
    
    return Array.from(areasSet).sort();
}

// 🔥 SELECCIONAR ÁREA PARA COMPETENCIAS
window.seleccionarAreaParaCompetencia = function(area) {
    console.log(`🎯 Área seleccionada: ${area}`);
    window.selectedCompetenciaArea = area;
    
    // Actualizar UI
    document.querySelectorAll('#areasLista button').forEach(btn => {
        btn.classList.remove('bg-green-100', 'border-green-500', 'ring-2', 'ring-green-300');
        if (btn.textContent.includes(area)) {
            btn.classList.add('bg-green-100', 'border-green-500', 'ring-2', 'ring-green-300');
        }
    });
    
    // Mostrar botón para continuar
    setTimeout(() => mostrarBotonContinuarCompetencias(), 300);
};

// 🔥 SELECCIONAR TODAS LAS ÁREAS
window.seleccionarTodasLasAreas = function() {
    window.selectedCompetenciaArea = null; // null significa "todas las áreas"
    console.log('🌍 Se seleccionaron todas las áreas');
    
    // Mostrar botón para continuar
    mostrarBotonContinuarCompetencias();
};

// 🔥 MOSTRAR BOTÓN PARA CONTINUAR A EDITOR DE COMPETENCIAS
function mostrarBotonContinuarCompetencias() {
    // Crear o mostrar botón de continuar
    let continuarBtn = document.getElementById('continuarCompetenciasBtn');
    
    if (!continuarBtn) {
        continuarBtn = document.createElement('button');
        continuarBtn.id = 'continuarCompetenciasBtn';
        continuarBtn.className = 'fixed bottom-10 right-10 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition flex items-center z-50';
        continuarBtn.innerHTML = '<i class="fas fa-arrow-right mr-2"></i>Jarraitu kompetentziak editatzera';
        continuarBtn.onclick = continuarAEditorCompetencias;
        document.body.appendChild(continuarBtn);
    } else {
        continuarBtn.classList.remove('hidden');
    }
}

// 🔥 CONTINUAR AL EDITOR DE COMPETENCIAS
function continuarAEditorCompetencias() {
    console.log(`🎯 Continuando a editor con configuración:`, {
        tipo: window.selectedCompetenciaTipo,
        grado: window.selectedCompetenciaGrado,
        area: window.selectedCompetenciaArea
    });
    
    // Ocultar botón flotante
    const btn = document.getElementById('continuarCompetenciasBtn');
    if (btn) btn.classList.add('hidden');
    
    // Mostrar panel de competencias
    if (typeof window.mostrarPanel === 'function') {
        window.mostrarPanel('competenciasPanel');
    }
    
    // Actualizar título del panel de competencias
    const competenciasTitle = document.getElementById('competenciasTitle');
    if (competenciasTitle) {
        const areaText = window.selectedCompetenciaArea ? ` (${window.selectedCompetenciaArea})` : '';
        competenciasTitle.textContent = `${window.selectedCompetenciaTipo === 'ingreso' ? 'Sarrerako' : 'Irteerako'} kompetentziak - ${window.selectedCompetenciaGrado}${areaText}`;
    }
    
    // Inicializar estructura de datos para competencias vinculadas
    inicializarEstructuraCompetenciasVinculadas();
    
    // Renderizar competencias según la configuración
    renderizarCompetenciasVinculadas();
}

// 🔥 INICIALIZAR ESTRUCTURA PARA COMPETENCIAS VINCULADAS
function inicializarEstructuraCompetenciasVinculadas() {
    if (!window.curriculumData.competencias_vinculadas) {
        window.curriculumData.competencias_vinculadas = {};
    }
    
    const key = obtenerClaveCompetenciasVinculadas();
    
    if (!window.curriculumData.competencias_vinculadas[key]) {
        window.curriculumData.competencias_vinculadas[key] = {
            tipo: window.selectedCompetenciaTipo,
            grado: window.selectedCompetenciaGrado,
            area: window.selectedCompetenciaArea,
            competencias: [],
            metadata: {
                creado: new Date().toISOString(),
                actualizado: new Date().toISOString()
            }
        };
    }
    
    console.log(`🗂️ Estructura de competencias vinculadas inicializada: ${key}`);
}

// 🔥 OBTENER CLAVE ÚNICA PARA COMPETENCIAS VINCULADAS
function obtenerClaveCompetenciasVinculadas() {
    const area = window.selectedCompetenciaArea || 'todas';
    return `${window.selectedCompetenciaTipo}_${window.selectedCompetenciaGrado}_${area}`;
}

// 🔥 RENDERIZAR COMPETENCIAS VINCULADAS
function renderizarCompetenciasVinculadas() {
    const key = obtenerClaveCompetenciasVinculadas();
    const data = window.curriculumData.competencias_vinculadas[key];
    const competencias = data ? data.competencias : [];
    
    const tipo = window.selectedCompetenciaTipo;
    const color = tipo === 'ingreso' ? 'blue' : 'green';
    const badgeText = tipo === 'ingreso' ? 'Sarrera' : 'Irteera';
    const badgeColor = tipo === 'ingreso' ? 'badge-ingreso' : 'badge-egreso';
    
    // Actualizar elementos del panel
    const competenciasBadge = document.getElementById('competenciasBadge');
    const competenciasTitle = document.getElementById('competenciasTitle');
    const competenciasDescription = document.getElementById('competenciasDescription');
    const competenciasCount = document.getElementById('competenciasCount');
    
    if (competenciasBadge) {
        competenciasBadge.textContent = badgeText;
        competenciasBadge.className = `inline-block text-xs px-2 py-1 rounded-full mb-2 font-semibold ${badgeColor}`;
    }
    
    if (competenciasTitle) {
        const areaText = window.selectedCompetenciaArea ? ` - ${window.selectedCompetenciaArea}` : '';
        competenciasTitle.textContent = `${tipo === 'ingreso' ? 'Sarrerako' : 'Irteerako'} kompetentziak - ${window.selectedCompetenciaGrado}${areaText}`;
    }
    
    if (competenciasDescription) {
        const desc = tipo === 'ingreso' 
            ? 'Ikasleek sartzerakoan izan behar dituzten gaitasunak' 
            : 'Ikasleek graduatu aurretik lortu behar dituzten gaitasunak';
        competenciasDescription.textContent = `${desc} (${window.selectedCompetenciaGrado}${window.selectedCompetenciaArea ? ' - ' + window.selectedCompetenciaArea : ''})`;
    }
    
    if (competenciasCount) {
        competenciasCount.textContent = `${competencias.length} kompetentzia definituta`;
    }
    
    // Renderizar lista de competencias
    const competenciasContainer = document.getElementById('competenciasContainer');
    if (!competenciasContainer) return;
    
    if (competencias.length === 0) {
        competenciasContainer.innerHTML = `
            <div class="text-center py-12 text-gray-400">
                <i class="fas fa-inbox text-5xl mb-4"></i>
                <h3 class="text-xl font-medium text-gray-500 mb-2">Ez dago kompetentziarik</h3>
                <p class="text-gray-400">Gehitu lehenengo kompetentzia botoia erabiliz</p>
            </div>
        `;
    } else {
        let html = '<div class="space-y-4">';
        
        competencias.forEach((comp, index) => {
            html += `
                <div class="border border-gray-200 rounded-lg p-4 hover:bg-${color}-50 transition ${tipo === 'ingreso' ? 'border-l-4 border-blue-500' : 'border-l-4 border-green-500'}">
                    <div class="flex justify-between items-start">
                        <div class="flex-grow mr-4">
                            <div class="mb-2">
                                <input type="text" 
                                       value="${comp.kodea || `${tipo === 'ingreso' ? 'SI' : 'SE'}${index + 1}`}"
                                       class="w-32 border border-gray-300 rounded px-3 py-2 text-sm font-bold bg-${color}-100 focus:bg-white focus:ring-2 focus:ring-${color}-300"
                                       onchange="actualizarCompetenciaVinculada(${index}, 'kodea', this.value)"
                                       placeholder="Kodea">
                            </div>
                            <textarea class="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:ring-2 focus:ring-${color}-300" 
                                      rows="3"
                                      onchange="actualizarCompetenciaVinculada(${index}, 'deskribapena', this.value)"
                                      placeholder="Deskribatu kompetentzia hau...">${comp.deskribapena || ''}</textarea>
                            
                            <!-- Info adicional -->
                            <div class="mt-3 text-xs text-gray-500">
                                ${comp.nivel ? `<span class="inline-block px-2 py-1 bg-${color}-100 text-${color}-800 rounded mr-2">${comp.nivel}</span>` : ''}
                                ${comp.evidencias ? `<span class="mr-3"><i class="fas fa-clipboard-check mr-1"></i>${comp.evidencias}</span>` : ''}
                            </div>
                        </div>
                        <button onclick="eliminarCompetenciaVinculada(${index})" 
                                class="text-red-400 hover:text-red-600 p-2 ml-4">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        competenciasContainer.innerHTML = html;
    }
}

// 🔥 AÑADIR COMPETENCIA VINCULADA
window.añadirCompetenciaVinculada = function() {
    const key = obtenerClaveCompetenciasVinculadas();
    
    if (!window.curriculumData.competencias_vinculadas[key]) {
        inicializarEstructuraCompetenciasVinculadas();
    }
    
    const competencias = window.curriculumData.competencias_vinculadas[key].competencias;
    const numero = competencias.length + 1;
    const tipo = window.selectedCompetenciaTipo;
    const prefijo = tipo === 'ingreso' ? 'SI' : 'SE';
    
    competencias.push({
        kodea: `${prefijo}${numero}`,
        deskribapena: 'Deskribatu kompetentzia hau...',
        nivel: 'B', // B: Básico, J: Jakintsua, A: Aurreratua
        data_sartze: new Date().toISOString().slice(0, 10),
        egilea: window.supabase?.auth?.getUser()?.then(({data}) => data.user?.email) || 'admin',
        grado: window.selectedCompetenciaGrado,
        area: window.selectedCompetenciaArea
    });
    
    // Actualizar metadata
    window.curriculumData.competencias_vinculadas[key].metadata.actualizado = new Date().toISOString();
    
    // Volver a renderizar
    renderizarCompetenciasVinculadas();
    
    // Guardar cambios
    setTimeout(() => {
        if (window.saveCurriculumData) {
            window.saveCurriculumData();
        }
    }, 500);
    
    window.showToast?.('✅ kompetentzia berria gehitu da', 'success');
};

// 🔥 ACTUALIZAR COMPETENCIA VINCULADA
window.actualizarCompetenciaVinculada = function(index, campo, valor) {
    const key = obtenerClaveCompetenciasVinculadas();
    
    if (!window.curriculumData.competencias_vinculadas[key] || 
        !window.curriculumData.competencias_vinculadas[key].competencias[index]) {
        return;
    }
    
    window.curriculumData.competencias_vinculadas[key].competencias[index][campo] = valor;
    window.curriculumData.competencias_vinculadas[key].metadata.actualizado = new Date().toISOString();
    
    // Guardar automáticamente
    setTimeout(() => {
        if (window.saveCurriculumData) {
            window.saveCurriculumData();
        }
    }, 1000);
};

// 🔥 ELIMINAR COMPETENCIA VINCULADA
window.eliminarCompetenciaVinculada = function(index) {
    const key = obtenerClaveCompetenciasVinculadas();
    
    if (!window.curriculumData.competencias_vinculadas[key] || 
        !window.curriculumData.competencias_vinculadas[key].competencias[index]) {
        return;
    }
    
    if (confirm('Ziur zaude kompetentzia ezabatu nahi duzula?\n\nEkintza hau ezin da desegin.')) {
        window.curriculumData.competencias_vinculadas[key].competencias.splice(index, 1);
        window.curriculumData.competencias_vinculadas[key].metadata.actualizado = new Date().toISOString();
        
        // Volver a renderizar
        renderizarCompetenciasVinculadas();
        
        // Guardar cambios
        setTimeout(() => {
            if (window.saveCurriculumData) {
                window.saveCurriculumData();
            }
        }, 500);
        
        window.showToast?.('🗑️ kompetentzia ezabatua', 'success');
    }
};

        // 🔥 FUNCIÓN PARA GUARDAR CONFIGURACIÓN
        window.guardarConfiguracionMatriz = function(tipo) {
            window.showToast(`✅ Configuración de ${tipo} guardada`, 'success');
            safeRemoveElement('editorMatrizBasico');
            
            // Aquí iría la lógica para guardar en curriculumData.matrices
        };


        // 🔥 FUNCIÓN PARA ACTUALIZAR CRÉDITOS
        window.actualizarCreditos = function() {
            const creditosInput = document.getElementById('subjectCreditsEdit');
            if (!creditosInput) {
                console.error('❌ subjectCreditsEdit ez dago');
                return;
            }
            
            const creditos = parseFloat(creditosInput.value);
            
            // Validar
            if (isNaN(creditos) || creditos < 0 || creditos > 30) {
                window.showToast('❌ Kreditu baliogabea (0-30 artean)', 'error');
                return;
            }
            
            const subject = window.getSelectedSubject();
            if (subject) {
                subject.kredituak = creditos;
                
                // Actualizar visualización
                const creditsDisplay = document.getElementById('subjectCredits');
                if (creditsDisplay) {
                    creditsDisplay.textContent = `Kredituak: ${creditos}`;
                }
                
                window.showToast(`✅ Kredituak eguneratuta: ${creditos} ECTS`, 'success');
                window.saveCurriculumData();
            } else {
                console.error('❌ Ez dago asignaturarik aukeratuta');
            }
        };
        
        // En loadSubjectEditor, añade:
        window.loadSubjectEditor = function(index) {
            window.selectedSubjectIndex = index;
            window.renderSubjects(); 
            const subject = window.getSelectedSubject();
            if (!subject) return;
            
            document.getElementById('welcomeEditor').classList.add('hidden');
            document.getElementById('editorPanel').classList.remove('hidden');
            document.getElementById('subjectTitle').textContent = subject.izena;
            document.getElementById('subjectType').textContent = subject.mota || "Zehaztugabea";
            document.getElementById('subjectCredits').textContent = `Kredituak: ${subject.kredituak || '-'}`;
            document.getElementById('subjectCreditsEdit').value = subject.kredituak || 0;
            document.getElementById('subjectNameEdit').value = subject.izena || '';
            
            // 🔥 AÑADE ESTO:
            document.getElementById('subjectArea').value = subject.arloa || '';

            // 🔥 AÑADIR ESTO:
            const creditosInput = document.getElementById('subjectCreditsEdit');
            if (creditosInput) {
                creditosInput.value = subject.kredituak || '';
                
                // Eliminar listeners antiguos y añadir nuevo
                creditosInput.removeEventListener('change', window.actualizarCreditos);
                creditosInput.removeEventListener('blur', window.actualizarCreditos);
                
                creditosInput.addEventListener('change', window.actualizarCreditos);
                creditosInput.addEventListener('blur', window.actualizarCreditos);
            }
            
            const RAsText = (Array.isArray(subject.currentOfficialRAs) ? subject.currentOfficialRAs.join('\n') : subject.currentOfficialRAs || '');
            document.getElementById('subjectRAs').value = RAsText;
            if (!Array.isArray(subject.unitateak)) { subject.unitateak = []; }
            window.renderUnitsList();
        };
        
        // Datuak normalizatzeko funtzioa
        window.normalizeData = function(data) {
            for (const degree in data) {
                for (const year in data[degree]) {
                    if (Array.isArray(data[degree][year])) {
                        data[degree][year].forEach((subject, subjectIndex) => {
                            if (!Array.isArray(subject.unitateak)) {
                                if (typeof subject.unitateak === 'string') {
                                    try {
                                        const parsedUnits = JSON.parse(subject.unitateak);
                                        subject.unitateak = Array.isArray(parsedUnits) ? parsedUnits : [];
                                    } catch (e) {
                                        subject.unitateak = [];
                                    }
                                } else {
                                    subject.unitateak = [];
                                }
                            }
                            
                            subject.unitateak.forEach((unit, unitIndex) => {
                                if (typeof unit.id !== 'string' || isNaN(parseInt(unit.id)) || unit.id.startsWith('fallback-')) {
                                    unit.id = `fallback-${subjectIndex}-${unitIndex}-${Date.now() + Math.floor(Math.random() * 1000)}`;
                                }
                            });

                            if (!Array.isArray(subject.currentOfficialRAs)) {
                                subject.currentOfficialRAs = [];
                            }
                        });
                    }
                }
            }
        };
        
        // --- JSON fitxategia tokiko datuetatik kargatzeko funtzioa ---
        window.loadLocalJsonData = async function(isInitialLoad = false) {
            try {
                console.log('📂 JSON lokaletik kargatzen...');
                
                const response = await fetch('curriculum_eguneratua_2025-11-27.json');
                if (!response.ok) {
                    throw new Error('JSON fitxategia ezin izan da kargatu');
                }
                
                const parsedData = await response.json();
                
                // 🔥 NORMALIZAR Y MIGRAR
                window.curriculumData = window.normalizeData(parsedData);

                // 🔥 AÑADIR ESTO DESPUÉS de normalizeData:
                if (window.inicializarSistemaMatrices) {
                    window.inicializarSistemaMatrices();
                }

                // 🔥 AÑADE ESTO DESPUÉS DE normalizeData:
                setTimeout(verificarEstructuraDatos, 800);
                
                // UI eguneratu
                document.getElementById('loadingOverlay').classList.add('hidden');
                
                // Verificar migración
                const tieneCompetencias = window.curriculumData.kompetentziak_ingreso !== undefined &&
                                          window.curriculumData.kompetentziak_egreso !== undefined;
                
                console.log(`📊 JSON kargatua:`, {
                    grados: Object.keys(window.curriculumData).filter(k => !k.includes('kompetentziak')).length,
                    tieneCompetencias: tieneCompetencias,
                    competenciasIngreso: window.curriculumData.kompetentziak_ingreso?.length || 0,
                    competenciasEgreso: window.curriculumData.kompetentziak_egreso?.length || 0
                });
                
                // UI eguneratu
                document.getElementById('loadingOverlay').classList.add('hidden');
                document.getElementById('noDataMessage').classList.add('hidden');
                document.getElementById('navigationPanel').classList.remove('hidden');
                
                window.selectedDegree = null;
                window.selectedYear = null;
                window.selectedSubjectIndex = null;
                window.initializeUI();
                window.resetEditor();
                
                if (isInitialLoad) {
                    const mensaje = tieneCompetencias 
                        ? "✅ JSON migratua eta kargatua" 
                        : "🔄 JSON zaharra migratua - Berria gorde ezazu";
                    
                    window.showToast(mensaje, "normal");
                    
                    // 🔥 GORDE SUPABASE-N (migratutako bertsioa)
                    setTimeout(async () => {
                        try {
                            await window.saveCurriculumData();
                            window.showToast("✅ Datuak migratu eta gorde dira Supabase-n", "success");
                        } catch (error) {
                            console.log("ℹ️ Ezin izan dira datuak gorde (hori normala da saiorik ez badago)");
                        }
                    }, 2000);
                } else {
                    window.showToast("✅ JSON datuak kargatu eta migratu dira", "success");
                }
        
            } catch (e) {
                try {
                    const response = await fetch('/curriculum_eguneratua_2025-11-27.json');
                    // ... procesar
                } catch (error) {
                    console.error('❌ No se pudo cargar el JSON:', error);
                }
                console.error("❌ JSON kargatze errorea:", e);
                window.showToast("❌ Errorea JSON datuak kargatzean.", "error");
                document.getElementById('loadingOverlay').classList.add('hidden');
            }
        };
        
        // 🔥 DESKARGATU JSON (berria)
        window.downloadJsonData = async function() {
            const user = await checkAuth();
            
            if (!isAdmin(user)) {
                window.showToast('❌ Baimenik ez deskargatzeko', 'error');
                return;
            }
            
            if (!window.curriculumData) {
                window.showToast("❌ Ez dago daturik deskargatzeko!", "error");
                return;
            }
            
            try {
                // 🔥 PREPARAR DATOS PARA EXPORTACIÓN
                const datosExportar = JSON.parse(JSON.stringify(window.curriculumData));
                
                // Añadir metadatos
                datosExportar._metadata = {
                    version: "2.0",
                    fecha_exportacion: new Date().toISOString(),
                    estructura: "nueva_con_competencias_separadas",
                    grados: Object.keys(datosExportar).filter(k => !k.includes('kompetentziak')).length,
                    tiene_competencias_ingreso: !!datosExportar.kompetentziak_ingreso,
                    tiene_competencias_egreso: !!datosExportar.kompetentziak_egreso
                };
                
                const dataStr = JSON.stringify(datosExportar, null, 2);
                const blob = new Blob([dataStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                
                // 🔥 NOMBRE CON VERSIÓN
                const fecha = new Date().toISOString().slice(0, 10);
                const hora = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
                a.download = `curriculum_v2_${fecha}_${hora}.json`;
                
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                window.showToast(`✅ JSON v2 deskargatua: ${a.download}`, "success");
                
                // 🔥 MOSTRAR RESUMEN DE EXPORTACIÓN
                setTimeout(() => {
                    const resumen = `
        📊 JSON EXPORTATUAREN LABURPENA:
        
        • Bertsioa: 2.0 (estructura berria)
        • Datuak: ${new Date().toLocaleString('eu-EU')}
        • Graduak: ${datosExportar._metadata.grados}
        • kompetentziak Ingreso: ${datosExportar.kompetentziak_ingreso?.length || 0}
        • kompetentziak Egreso: ${datosExportar.kompetentziak_egreso?.length || 0}
        • Fitxategia: ${a.download}
        
        ✅ Datuak ondo migratu dira!
                    `.trim();
                    
                    console.log(resumen);
                    alert(resumen);
                }, 500);
                
            } catch (e) {
                console.error("❌ JSON deskarga errorea:", e);
                window.showToast("❌ Errorea datuak deskargatzean.", "error");
            }
        };
        
        // JSON kargatu (soilik administratzaileentzat)
        async function uploadJsonFile() {
            const user = await checkAuth();
            
            if (!isAdmin(user)) {
                window.showToast('❌ Baimenik ez kargatzeko', 'error');
                return;
            }
            
            document.getElementById('jsonFileInput').click();
        }

        window.updateSubjectCredits = function() {
            const credits = parseInt(document.getElementById('subjectCreditsEdit').value) || 0;
            const subject = window.getSelectedSubject();
            if (subject) {
                subject.kredituak = credits;
                document.getElementById('subjectCredits').textContent = `Kredituak: ${credits}`;
                window.showToast("Kredituak eguneratu dira", "success");
                window.saveCurriculumData();
            }
        };
        
        // --- UI Rendering eta Ekintza Funtzioak ---
        
window.initializeUI = function() {
    console.log('🎨 Inicializando UI...');
    
    // Ocultar loading
    const loading = document.getElementById('loadingOverlay');
    if (loading) loading.classList.add('hidden');
    
    // Habilitar botones
    const saveBtn = document.getElementById('saveBtn');
    const downloadBtn = document.getElementById('downloadBackupBtn');
    if (saveBtn) saveBtn.disabled = false;
    if (downloadBtn) downloadBtn.disabled = false;
    
    // Llenar selector de grados
    const degreeSelect = document.getElementById('degreeSelect');
    if (degreeSelect) {
        degreeSelect.innerHTML = '<option value="">-- Aukeratu Gradua --</option>';
        
        if (!window.curriculumData) {
            console.error('❌ No hay curriculumData');
            return;
        }
        
        console.log('🔍 Buscando grados en curriculumData...');
        
        const gradosEncontrados = [];
        
        // 🔥 PASO 1: PRIMERO AÑADIR GRADOS NORMALES
        Object.keys(window.curriculumData).forEach(key => {
            // Excluir keys que NO son grados
            if (key === 'kompetentziak_ingreso' || 
                key === 'kompetentziak_egreso' || 
                key === '_metadata' ||
                key === 'matrices' ||
                key.startsWith('kompetentziak')) {
                return;
            }
            
            const gradoData = window.curriculumData[key];
            
            // Verificar si es un grado (tiene cursos como arrays)
            if (gradoData && typeof gradoData === 'object') {
                const tieneCursos = Object.values(gradoData).some(val => Array.isArray(val));
                const tieneClavesCurso = Object.keys(gradoData).some(k => 
                    /^\d+$/.test(k) || k.includes('Maila') || k.includes('curso')
                );
                
                if (tieneCursos || tieneClavesCurso) {
                    console.log(`✅ "${key}" es un grado válido`);
                    gradosEncontrados.push(key);
                    
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = key;
                    degreeSelect.appendChild(option);
                }
            }
        });
        
        console.log(`📊 Grados encontrados: ${gradosEncontrados.length}`, gradosEncontrados);
        
        // 🔥 PASO 2: AÑADIR SEPARADOR SI HAY GRADOS
        if (gradosEncontrados.length > 0) {
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '────────────────────';
            separator.style.color = '#9CA3AF';
            separator.style.fontSize = '12px';
            separator.style.padding = '4px 0';
            degreeSelect.appendChild(separator);
        }      
        console.log('✅ UI inicializada');
};

// --- UI Funtzio Laguntzaileak (window objektuan gordeta) ---
window.onDegreeChange = function() {
    const degreeSelect = document.getElementById('degreeSelect');
    const selectedValue = degreeSelect.value;
    
    console.log(`🎓 Seleccionado: "${selectedValue}"`);
    
    // Si es competencia (ingreso/egreso), guardar el tipo y redirigir
    if (selectedValue === 'kompetentziak_ingreso' || selectedValue === 'kompetentziak_egreso') {
        window.selectedCompetenciaTipo = selectedValue === 'kompetentziak_ingreso' ? 'ingreso' : 'egreso';
        window.selectedCompetenciaGrado = null; // Resetear grado
        window.selectedCompetenciaArea = null; // Resetear área
        
        console.log(`🎯 Redirigiendo a selector de grados para competencias: ${window.selectedCompetenciaTipo}`);
        
        // Mostrar panel de selección de grado para competencias
        mostrarPanelSeleccionGradoCompetencias();
        return;
    }
    
    // Si es un grado normal, proceder como siempre
    window.selectedDegree = selectedValue;
    window.selectedYear = null;
    window.selectedSubjectIndex = null;
    
    // Renderizar años y mostrar editor de asignaturas
    window.renderYears();
    document.getElementById('subjectList').innerHTML = '<li class="p-3 text-gray-500 text-sm italic">Aukeratu maila bat irakasgaiak ikusteko.</li>';
    
    if (selectedValue) {
        if (typeof window.mostrarPanel === 'function') {
            window.mostrarPanel('editorPanel');
        }
        const subjectTitle = document.getElementById('subjectTitle');
        const subjectType = document.getElementById('subjectType');
        if (subjectTitle) subjectTitle.textContent = 'Irakasgai bat aukeratu';
        if (subjectType) subjectType.textContent = 'Gradua: ' + selectedValue;
    } else {
        window.resetEditor();
    }
};
                
// 🔥 EDITOR ESPECIALIZADO PARA COMPETENCIAS
window.mostrarEditorCompetencias = function(tipo) {
    console.log(`🎨 Mostrando editor especializado para competencias ${tipo}`);
    
    // 🔥 USAR EL NUEVO SISTEMA DE PANELES
    if (typeof window.mostrarPanel === 'function') {
        window.mostrarPanel('competenciasPanel');
    } else {
        // Fallback manual
        document.getElementById('welcomeEditor').classList.add('hidden');
        document.getElementById('editorPanel').classList.add('hidden');
        document.getElementById('competenciasPanel').classList.remove('hidden');
    }
    
    // Configurar título
    const titulo = tipo === 'ingreso' ? 'Sarrerako kompetentziak' : 'Irteerako kompetentziak';
    const descripcion = tipo === 'ingreso' 
        ? 'Ikasleek sartzerakoan izan behar dituzten gaitasunak'
        : 'Ikasleek graduatu aurretik lortu behar dituzten gaitasunak';
    const color = tipo === 'ingreso' ? 'blue' : 'green';
    const badgeColor = tipo === 'ingreso' ? 'badge-ingreso' : 'badge-egreso';
    const badgeText = tipo === 'ingreso' ? 'Sarrera' : 'Irteera';
    
    // 🔥 ACTUALIZAR EL NUEVO PANEL (competenciasPanel)
    const competenciasBadge = document.getElementById('competenciasBadge');
    const competenciasTitle = document.getElementById('competenciasTitle');
    const competenciasDescription = document.getElementById('competenciasDescription');
    const competenciasCount = document.getElementById('competenciasCount');
    
    if (competenciasBadge) {
        competenciasBadge.textContent = badgeText;
        competenciasBadge.className = `inline-block text-xs px-2 py-1 rounded-full mb-2 font-semibold ${badgeColor}`;
    }
    
    if (competenciasTitle) {
        competenciasTitle.textContent = titulo;
        competenciasTitle.className = `text-2xl font-bold text-${color}-800`;
    }
    
    if (competenciasDescription) {
        competenciasDescription.textContent = descripcion;
        competenciasDescription.className = `text-${color}-600 mt-1`;
    }
    
    // Obtener competencias
    const competenciasKey = tipo === 'ingreso' ? 'kompetentziak_ingreso' : 'kompetentziak_egreso';
    const competencias = window.curriculumData[competenciasKey] || [];
    
    // Actualizar contador
    if (competenciasCount) {
        competenciasCount.textContent = `${competencias.length} kompetentzia definituta`;
        competenciasCount.className = `text-sm text-${color}-600 font-medium`;
    }
    
    // 🔥 CONFIGURAR BOTÓN VOLVER (en el nuevo panel)
    const volverBtn = document.getElementById('volverAGradosBtn');
    if (volverBtn) {
        volverBtn.onclick = function() {
            window.resetEditor();
            // También resetear el selector de grados
            const degreeSelect = document.getElementById('degreeSelect');
            if (degreeSelect) degreeSelect.value = '';
        };
    }
    
    // 🔥 CONFIGURAR BOTÓN AÑADIR (en el nuevo panel)
    const añadirBtn = document.getElementById('añadirCompetenciaBtn');
    if (añadirBtn) {
        añadirBtn.onclick = function() {
            window.añadirCompetencia(tipo);
        };
        añadirBtn.className = `w-full px-4 py-3 bg-${color}-600 text-white rounded-lg hover:bg-${color}-700 font-medium`;
        añadirBtn.innerHTML = `<i class="fas fa-plus mr-2"></i>Gehitu kompetentzia Berria`;
    }
    
    // 🔥 CONFIGURAR BOTÓN GUARDAR (en el nuevo panel)
    const guardarBtn = document.getElementById('guardarCompetenciasBtn');
    if (guardarBtn) {
        guardarBtn.onclick = function() {
            if (window.saveCurriculumData) {
                window.saveCurriculumData();
                window.showToast?.('✅ kompetentziak gordeta', 'success');
            }
        };
        guardarBtn.className = `px-4 py-2 bg-${color}-600 text-white rounded-lg hover:bg-${color}-700`;
    }
    
    // 🔥 CONFIGURAR BOTÓN EXPORTAR (en el nuevo panel)
    const exportarBtn = document.getElementById('exportarCompetenciasBtn');
    if (exportarBtn) {
        exportarBtn.onclick = function() {
            exportarCompetencias(tipo);
        };
        exportarBtn.className = `px-4 py-2 bg-${color === 'blue' ? 'indigo' : 'emerald'}-600 text-white rounded-lg hover:bg-${color === 'blue' ? 'indigo' : 'emerald'}-700`;
    }
    
    // 🔥 RENDERIZAR COMPETENCIAS EN EL NUEVO CONTENEDOR (competenciasContainer)
    const competenciasContainer = document.getElementById('competenciasContainer');
    if (!competenciasContainer) {
        console.error('❌ No se encontró competenciasContainer');
        return;
    }
    
    if (competencias.length === 0) {
        competenciasContainer.innerHTML = `
            <div class="text-center py-12 text-gray-400">
                <i class="fas fa-inbox text-5xl mb-4"></i>
                <h3 class="text-xl font-medium text-gray-500 mb-2">Ez dago kompetentziarik</h3>
                <p class="text-gray-400">Gehitu lehenengo kompetentzia botoia erabiliz</p>
            </div>
        `;
    } else {
        let html = '<div class="space-y-4">';
        
        competencias.forEach((comp, index) => {
            html += `
                <div class="border border-gray-200 rounded-lg p-4 hover:bg-${color}-50 transition ${tipo === 'ingreso' ? 'border-l-4 border-blue-500' : 'border-l-4 border-green-500'}">
                    <div class="flex justify-between items-start">
                        <div class="flex-grow mr-4">
                            <div class="mb-2">
                                <input type="text" 
                                       value="${comp.kodea || `${tipo === 'ingreso' ? 'SI' : 'SE'}${index + 1}`}"
                                       class="w-32 border border-gray-300 rounded px-3 py-2 text-sm font-bold bg-${color}-100 focus:bg-white focus:ring-2 focus:ring-${color}-300"
                                       onchange="actualizarCompetencia('${tipo}', ${index}, 'kodea', this.value)"
                                       placeholder="Kodea">
                            </div>
                            <textarea class="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:ring-2 focus:ring-${color}-300" 
                                      rows="3"
                                      onchange="actualizarCompetencia('${tipo}', ${index}, 'deskribapena', this.value)"
                                      placeholder="Deskribatu kompetentzia hau...">${comp.deskribapena || ''}</textarea>
                            
                            <div class="mt-3 text-xs text-gray-500 flex justify-between">
                                <span>${comp.data_sartze ? `Data: ${comp.data_sartze}` : ''}</span>
                                <span>${comp.egilea ? `Egilea: ${comp.egilea}` : ''}</span>
                            </div>
                        </div>
                        <button onclick="eliminarCompetencia('${tipo}', ${index})" 
                                class="text-red-400 hover:text-red-600 p-2 ml-4">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        competenciasContainer.innerHTML = html;
    }
    
    console.log(`✅ Editor de competencias ${tipo} mostrado en nuevo panel`);
};

// 🔥 FUNCIÓN PARA EXPORTAR COMPETENCIAS (si no la tienes)
function exportarCompetencias(tipo) {
    const competenciasKey = tipo === 'ingreso' ? 'kompetentziak_ingreso' : 'kompetentziak_egreso';
    const competencias = window.curriculumData[competenciasKey] || [];
    
    if (competencias.length === 0) {
        window.showToast?.('❌ Ez dago kompetentziarik esportatzeko', 'error');
        return;
    }
    
    const dataStr = JSON.stringify(competencias, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kompetentziak_${tipo}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    window.showToast?.('📥 kompetentziak esportatuta', 'success');
}

// 🔥 FUNCIONES AUXILIARES PARA COMPETENCIAS
window.añadirCompetencia = function(tipo) {
    const competenciasKey = tipo === 'ingreso' ? 'kompetentziak_ingreso' : 'kompetentziak_egreso';
    
    if (!window.curriculumData[competenciasKey]) {
        window.curriculumData[competenciasKey] = [];
    }
    
    const numero = window.curriculumData[competenciasKey].length + 1;
    const prefijo = tipo === 'ingreso' ? 'SI' : 'SE';
    
    window.curriculumData[competenciasKey].push({
        kodea: `${prefijo}${numero}`,
        deskribapena: 'Deskribatu kompetentzia hau...',
        data_sartze: new Date().toISOString().slice(0, 10),
        egilea: window.supabase?.auth?.getUser()?.then(({data}) => data.user?.email) || 'admin'
    });
    
    // Volver a renderizar
    window.mostrarEditorCompetencias(tipo);
    
    // Guardar cambios
    setTimeout(() => {
        if (window.saveCurriculumData) {
            window.saveCurriculumData();
        }
    }, 500);
    
    window.showToast?.('✅ kompetentzia berria gehitu da', 'success');
};

window.actualizarCompetencia = function(tipo, index, campo, valor) {
    const competenciasKey = tipo === 'ingreso' ? 'kompetentziak_ingreso' : 'kompetentziak_egreso';
    
    if (!window.curriculumData[competenciasKey] || !window.curriculumData[competenciasKey][index]) {
        return;
    }
    
    window.curriculumData[competenciasKey][index][campo] = valor;
    
    // Guardar automáticamente después de un tiempo
    setTimeout(() => {
        if (window.saveCurriculumData) {
            window.saveCurriculumData();
        }
    }, 1000);
};

window.eliminarCompetencia = function(tipo, index) {
    const competenciasKey = tipo === 'ingreso' ? 'kompetentziak_ingreso' : 'kompetentziak_egreso';
    
    if (!window.curriculumData[competenciasKey] || !window.curriculumData[competenciasKey][index]) {
        return;
    }
    
    if (confirm('Ziur zaude kompetentzia ezabatu nahi duzula?\n\nEkintza hau ezin da desegin.')) {
        window.curriculumData[competenciasKey].splice(index, 1);
        
        // Volver a renderizar
        window.mostrarEditorCompetencias(tipo);
        
        // Guardar cambios
        setTimeout(() => {
            if (window.saveCurriculumData) {
                window.saveCurriculumData();
            }
        }, 500);
        
        window.showToast?.('🗑️ kompetentzia ezabatua', 'success');
    }
};

window.renderYears = function() { 
    const container = document.getElementById('sectionButtons');
    container.innerHTML = '';
    if (!window.selectedDegree || !window.curriculumData[window.selectedDegree]) return;
        const years = Object.keys(window.curriculumData[window.selectedDegree]).sort();
        years.forEach(year => {
            const btn = document.createElement('button');
            btn.textContent = `${year}. Maila`;
            btn.className = `flex-1 py-2 px-3 rounded text-sm font-medium transition border ${window.selectedYear === year ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-indigo-50'}`;
            btn.onclick = () => {
                window.selectedYear = year;
                window.renderYears(); 
                window.renderSubjects();
                window.resetEditor();
            };
            container.appendChild(btn);
        });
    }

        window.renderSubjects = function() {
            const list = document.getElementById('subjectList');
            list.innerHTML = '';
            if (!window.selectedDegree || !window.selectedYear || !window.curriculumData[window.selectedDegree][window.selectedYear]) {
                 list.innerHTML = '<li class="p-3 text-gray-500 italic">Ez dago irakasgairik maila honetan.</li>';
                 return;
            }
            const subjects = window.curriculumData[window.selectedDegree][window.selectedYear];
            if (subjects.length === 0) {
                list.innerHTML = '<li class="p-3 text-gray-500 italic">Ez dago irakasgairik maila honetan.</li>';
                return;
            }
            subjects.forEach((subject, index) => {
                const li = document.createElement('li');
                li.className = `p-3 cursor-pointer hover:bg-indigo-50 flex justify-between items-center transition ${window.selectedSubjectIndex === index ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`;
                li.onclick = () => window.loadSubjectEditor(index);
                const hasUnits = (subject.unitateak && subject.unitateak.length > 0);
                const iconColor = hasUnits ? 'text-green-500' : 'text-gray-300';
                li.innerHTML = `<span class="font-medium text-gray-700">${subject.izena}</span><i class="fas fa-circle ${iconColor} text-xs" title="${hasUnits ? 'Edukiak ditu' : 'Edukirik gabe'}"></i>`;
                list.appendChild(li);
            });
        }
        
        window.getSelectedSubject = function() {
            if (window.selectedDegree && window.selectedYear && window.selectedSubjectIndex !== null) {
                return window.curriculumData[window.selectedDegree][window.selectedYear][window.selectedSubjectIndex];
            }
            return null;
        }

        window.loadSubjectEditor = function(index) {
            window.selectedSubjectIndex = index;
            window.renderSubjects(); 
            const subject = window.getSelectedSubject();
            if (!subject) return;
            document.getElementById('welcomeEditor').classList.add('hidden');
            document.getElementById('editorPanel').classList.remove('hidden');
            document.getElementById('subjectTitle').textContent = subject.izena;
            document.getElementById('subjectType').textContent = subject.mota || "Zehaztugabea";
            document.getElementById('subjectCredits').textContent = `Kredituak: ${subject.kredituak || '-'}`;
            document.getElementById('subjectNameEdit').value = subject.izena || '';
            document.getElementById('subjectArea').value = subject.arloa || '';

            // 🔥 CRÍTICO: CARGAR CRÉDITOS
            const creditosInput = document.getElementById('subjectCreditsEdit');
            if (creditosInput) {
                creditosInput.value = subject.kredituak || '';
                console.log(`✅ Créditos cargados: ${subject.kredituak || 'vacío'}`);
            }
            
            const RAsText = (Array.isArray(subject.currentOfficialRAs) ? subject.currentOfficialRAs.join('\n') : subject.currentOfficialRAs || '');
            document.getElementById('subjectRAs').value = RAsText;
            if (!Array.isArray(subject.unitateak)) { subject.unitateak = []; }
            window.renderUnitsList();
            
            // 🔥 FORZAR ACTUALIZACIÓN DE EREMUAK SI ESTÁ VACÍO
            const areaSelect = document.getElementById('subjectArea');
            if (areaSelect && areaSelect.options.length <= 1) {
                setTimeout(() => {
                    if (typeof llenarSelectEremuakConEditor === 'function') {
                        llenarSelectEremuakConEditor();
                    }
                }, 300);
            }
        };

window.resetEditor = function() {
    console.log('🔄 Reiniciando editor...');
    
    // 🔥 MOSTRAR PANEL DE BIENVENIDA
    if (typeof window.mostrarPanel === 'function') {
        window.mostrarPanel('welcomeEditor');
    } else {
        // Fallback si la función no existe
        document.getElementById('welcomeEditor').classList.remove('hidden');
        document.getElementById('editorPanel').classList.add('hidden');
        document.getElementById('competenciasPanel').classList.add('hidden');
    }
    
    // Resetear selecciones
    window.selectedSubjectIndex = null;
    
    // Actualizar lista de asignaturas
    window.renderSubjects();
    
    // Limpiar campos del editor
    const clearFields = ['subjectNameEdit', 'subjectArea', 'subjectCreditsEdit', 'subjectRAs', 'unitName', 'unitContent'];
    clearFields.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    
    // Limpiar contenedor de unidades
    const unitsContainer = document.getElementById('unitsContainer');
    if (unitsContainer) unitsContainer.innerHTML = '';
    
    // Mostrar mensaje de no unidades
    const noUnitsMsg = document.getElementById('noUnitsMessage');
    if (noUnitsMsg) noUnitsMsg.classList.remove('hidden');
    
    console.log('✅ Editor reiniciado');
};

        window.updateSubjectData = function(key, value) {
            const subject = window.getSelectedSubject();
            if (subject) {
                subject[key] = value;
                window.showToast(`${key} eremua eguneratu da. (Gordetzeko zain)`, "normal");
                window.saveCurriculumData(); 
            }
        }
        
        window.updateSubjectName = function(newName) {
            const subject = window.getSelectedSubject();
            if (subject) {
                subject.izena = newName;
                document.getElementById('subjectTitle').textContent = newName; 
                window.renderSubjects(); 
                window.showToast("Irakasgaiaren izena eguneratu da. (Gordetzeko zain)", "normal");
                window.saveCurriculumData(); 
            }
        }
        
        window.updateSubjectRAs = function(rawText) {
            const subject = window.getSelectedSubject();
            if (subject) {
                const RAsArray = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                subject.currentOfficialRAs = RAsArray;
                window.showToast("Ikaskuntza Emaitzak eguneratu dira. (Gordetzeko zain)", "normal");
                window.saveCurriculumData(); 
            }
        }

        window.addUnit = async function() {
            // 🔥 EGIAZTATU SAIORIK DAGOEN
            const user = await checkAuth();
            if (!user) {
                window.showToast('❌ Saioa hasi behar duzu unitateak gehitzeko', 'error');
                return;
            }
            
            const nameInput = document.getElementById('unitName');
            const contentInput = document.getElementById('unitContent');
            const subject = window.getSelectedSubject();
            
            if (!subject) return;
            if (!nameInput.value.trim() || !contentInput.value.trim()) { 
                window.showToast("Mesedez, bete eremu guztiak.", "error"); 
                return; 
            }
            
            const newUnit = { 
                id: Date.now().toString(), 
                izena: nameInput.value.trim(), 
                edukiak: contentInput.value.trim(), 
                data: new Date().toISOString().slice(0, 10),
                egilea: user.email,  // 🆕 GEHITU HAU
                egile_rola: isAdmin(user) ? 'admin' : 'teacher'  // 🆕 GEHITU HAU
            };
            
            subject.unitateak.push(newUnit);
            nameInput.value = '';
            contentInput.value = '';
            window.renderUnitsList();
            window.renderSubjects(); 
            window.showToast("Unitatea ondo gehitu da! (Gordetzeko zain)", "success");
            window.saveCurriculumData(); 
        }

        window.deleteUnit = function(unitIndex) {
            const subject = window.getSelectedSubject();
            if (!subject) return;
            subject.unitateak.splice(unitIndex, 1);
            window.renderUnitsList();
            window.renderSubjects();
            window.showToast("Unitatea ezabatu da! (Gordetzeko zain)", "normal");
            window.saveCurriculumData(); 
        }
        
        window.renderUnitsList = function() {
            const container = document.getElementById('unitsContainer');
            const noUnitsMsg = document.getElementById('noUnitsMessage');
            const subject = window.getSelectedSubject();
            if (!subject) return;
        
            const sortedUnits = subject.unitateak.slice().sort((a, b) => {
                const idA = parseInt(a.id);
                const idB = parseInt(b.id);
                return (!isNaN(idA) && !isNaN(idB)) ? idB - idA : 0; 
            });
        
            container.innerHTML = '';
            if (sortedUnits.length === 0) {
                noUnitsMsg.classList.remove('hidden');
            } else {
                noUnitsMsg.classList.add('hidden');
                sortedUnits.forEach((unit) => {
                    const card = document.createElement('div');
                    card.className = "bg-white border border-gray-200 rounded p-4 shadow-sm relative hover:shadow-md transition";
                    const contentFormatted = unit.edukiak ? unit.edukiak.replace(/\n/g, '<br>') : 'Ez dago edukirik.';
                    const originalIndex = subject.unitateak.findIndex(u => u.id === unit.id);
                    
                    // 🔥 EGUNERATUTA - EGILEAREN INFORMAZIOA GEHITU
                    card.innerHTML = `
                        <button onclick="window.deleteUnit(${originalIndex})" class="absolute top-2 right-2 text-red-400 hover:text-red-600 p-1" title="Ezabatu">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <h4 class="font-bold text-indigo-700 mb-2 text-lg">${unit.izena || 'Izenik gabe'}</h4>
                        <p class="text-xs text-gray-500 mb-2">
                            Gehitze data: ${unit.data || 'Ezezaguna'} 
                            ${unit.egilea ? `| Egilea: ${unit.egilea}` : ''}
                            ${unit.egile_rola ? ` (${unit.egile_rola})` : ''}
                        </p>
                        <div class="text-gray-600 text-sm leading-relaxed bg-gray-50 p-3 rounded">
                            ${contentFormatted}
                        </div>
                    `;
                    container.appendChild(card);
                });
            }
        }
        
       
        // Supabase funtzioak eskuragarri
        window.supabaseIkusiDatuak = viewSupabaseData;
        window.supabaseGehituDatuak = saveCurriculumData;

        // ============================================
        // 🔥 EXPOSICIÓN AL SCOPE GLOBAL
        // ============================================
        window.llenarSelectEremuakConEditor = llenarSelectEremuakConEditor;
        window.mostrarEditorEremuak = mostrarEditorEremuak;
        window.renombrarEremua = renombrarEremua;
        window.eliminarEremua = eliminarEremua;
        window.gehituEremuaBerria = gehituEremuaBerria;
        window.extraerEremuakDelCurriculum = extraerEremuakDelCurriculum;
        window.migrarEstructuraVieja = migrarEstructuraVieja;

// ============================================
// 🔥 SISTEMA AVANZADO DE COMPETENCIAS DE INGRESO POR ÁMBITOS
// ============================================

// 🔥 1. REEMPLAZAR showCompetenciasGlobales CON VERSIÓN MEJORADA
const originalShowCompetenciasGlobales = window.showCompetenciasGlobales;

window.showCompetenciasGlobales = function(tipo) {
    console.log(`🎯 showCompetenciasGlobales: ${tipo}`);
    
    // Ocultar editor genérico
    document.getElementById('welcomeEditor').classList.add('hidden');
    document.getElementById('editorPanel').classList.remove('hidden');
    
    if (tipo === 'ingreso') {
        // EDITOR INGRESO CON ÁMBITOS
        document.getElementById('subjectTitle').textContent = 'Sarrerako kompetentziak';
        document.getElementById('subjectType').textContent = 'Arlo bakoitzaren arabera';
        
        // Usar ámbitos de matrices si existen
        const eremuak = window.curriculumData.matrices?.colores_eremuak 
            ? Object.keys(window.curriculumData.matrices.colores_eremuak)
            : extraerEremuakDelCurriculum();
        
        renderizarCompetenciasPorAmbitos(eremuak, 'ingreso');
        
    } else {
        // EDITOR EGRESO SIMPLE
        document.getElementById('subjectTitle').textContent = 'Irteerako kompetentziak';
        document.getElementById('subjectType').textContent = 'Graduazio gaitasunak';
        
        // Asegurar array
        if (!window.curriculumData.kompetentziak_egreso) {
            window.curriculumData.kompetentziak_egreso = [];
        }
        
        renderizarCompetenciasListaSimple(window.curriculumData.kompetentziak_egreso, 'egreso');
    }
};;

// 🔥 RENDERIZAR POR ÁMBITOS (para ingreso)
function renderizarCompetenciasPorAmbitos(eremuak, tipo) {
    console.log(`🎨 Renderizando ${eremuak.length} ámbitos para ${tipo}`);
    
    let html = `
    <div class="space-y-6">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-5">
            <h3 class="text-xl font-bold text-blue-800 mb-2">
                <i class="fas fa-sign-in-alt mr-2"></i>Sarrerako kompetentziak
            </h3>
            <p class="text-blue-600">
                Definitu ikasleek gradu honetan <strong>sartzeko</strong> behar dituzten gaitasunak.
                Bana ditzakezu arlo bakoitzaren arabera.
            </p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    `;
    
    // Renderizar cada ámbito
    eremuak.forEach((eremua, index) => {
        const color = window.curriculumData.matrices?.colores_eremuak?.[eremua] || 
                     ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5];
        
        html += `
        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition" 
             style="border-left: 4px solid ${color};">
            <div class="flex items-center mb-3">
                <div class="w-8 h-8 rounded-full mr-3" style="background: ${color};"></div>
                <h4 class="font-bold text-gray-800">${eremua}</h4>
            </div>
            
            <div class="space-y-3">
                <!-- Competencias existentes -->
                <div id="competencias-${eremua.replace(/\s+/g, '-')}" class="space-y-2">
                    <!-- Se llenará dinámicamente -->
                    <div class="text-gray-500 text-sm italic py-2 text-center">
                        Ez dago kompetentziarik definituta
                    </div>
                </div>
                
                <!-- Botón añadir -->
                <button onclick="añadirCompetenciaIngreso('${eremua}')" 
                        class="w-full text-sm px-3 py-2 rounded border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition flex items-center justify-center">
                    <i class="fas fa-plus mr-2"></i>Gehitu kompetentzia
                </button>
            </div>
        </div>
        `;
    });
    
    html += `
        </div>
        
        <!-- Panel de ayuda -->
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6">
            <h4 class="font-bold text-gray-700 mb-2 flex items-center">
                <i class="fas fa-lightbulb mr-2"></i>Zertarako dira sarrerako kompetentziak?
            </h4>
            <ul class="text-sm text-gray-600 space-y-1">
                <li>• Ikasleak gradu honetan <strong>sartzeko</strong> behar dituen oinarrizko ezagutzak</li>
                <li>• Ebaluatzen dira sarrera-prozesuan (portfolio, elkarrizketa, azterketak)</li>
                <li>• Arlo bakoitzaren berezitasunak islatzen dituzte</li>
                <li>• Graduaren kalitatea ziurtatzen dute hasieratik</li>
            </ul>
        </div>
    </div>
    `;
    
    document.getElementById('unitsContainer').innerHTML = html;
    document.getElementById('noUnitsMessage').classList.add('hidden');
}

// 🔥 RENDERIZAR LISTA SIMPLE (para egreso)
function renderizarCompetenciasListaSimple(competencias, tipo) {
    let html = `
    <div class="space-y-6">
        <div class="bg-green-50 border border-green-200 rounded-lg p-5">
            <h3 class="text-xl font-bold text-green-800 mb-2">
                <i class="fas fa-sign-out-alt mr-2"></i>Irteerako kompetentziak
            </h3>
            <p class="text-green-600">
                Definitu ikasleak graduatu ondoren <strong>izan behar dituen</strong> gaitasun profesionalak.
            </p>
        </div>
        
        <div class="space-y-4" id="lista-competencias-egreso">
    `;
    
    if (competencias.length === 0) {
        html += `
            <div class="text-center py-10 text-gray-400">
                <i class="fas fa-list-alt text-4xl mb-4"></i>
                <p class="text-lg mb-2">Ez dago irteerako kompetentziarik</p>
                <p class="text-sm mb-6">Gehitu lehenengo kompetentzia ikasleak graduatu ondoren izan behar dituen gaitasunak definitzeko</p>
                <button onclick="añadirCompetenciaEgreso()" 
                        class="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
                    <i class="fas fa-plus mr-2"></i>Gehitu Lehenengo kompetentzia
                </button>
            </div>
        `;
    } else {
        competencias.forEach((comp, index) => {
            html += `
            <div class="border border-gray-200 rounded-lg p-4 hover:bg-green-50 transition">
                <div class="flex justify-between items-start">
                    <div class="flex-grow">
                        <div class="mb-2">
                            <input type="text" 
                                   value="${comp.kodea || `SE${index + 1}`}"
                                   class="w-24 border border-gray-300 rounded px-2 py-1 text-sm font-bold"
                                   onchange="actualizarCodigoCompetenciaEgreso(${index}, this.value)"
                                   placeholder="Kodea">
                        </div>
                        <textarea class="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" 
                                  rows="2"
                                  onchange="actualizarDescripcionCompetenciaEgreso(${index}, this.value)"
                                  placeholder="Deskribatu graduatuak izan behar duen gaitasuna...">${comp.deskribapena || ''}</textarea>
                    </div>
                    <button onclick="eliminarCompetenciaEgreso(${index})" 
                            class="ml-4 text-red-400 hover:text-red-600">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            `;
        });
    }
    
    html += `
        </div>
        
        <button onclick="añadirCompetenciaEgreso()" 
                class="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center">
            <i class="fas fa-plus mr-2"></i>Gehitu kompetentzia Berria
        </button>
    </div>
    `;
    
    document.getElementById('unitsContainer').innerHTML = html;
    document.getElementById('noUnitsMessage').classList.add('hidden');
}

// 🔥 3. OBTENER EREMUAK PARA COMPETENCIAS
async function obtenerEremuakParaCompetencias() {
    console.log('🔍 Obteniendo eremuak...');
    
    let eremuak = [];
    
    // Opción 1: Usar función existente
    if (typeof extraerEremuakDelCurriculum === 'function') {
        eremuak = extraerEremuakDelCurriculum();
        console.log(`✅ ${eremuak.length} eremuak encontrados vía extraerEremuakDelCurriculum`);
    }
    
    // Opción 2: Extraer manualmente si la función no existe
    if (eremuak.length === 0 && window.curriculumData) {
        eremuak = extraerEremuakManual();
        console.log(`✅ ${eremuak.length} eremuak encontrados manualmente`);
    }
    
    // Opción 3: Eremuak por defecto si no hay ninguno
    if (eremuak.length === 0) {
        eremuak = [
            'DISEINU PROIEKTUAK ETA METODOLOGIAK',
            'DISEINUAREN IKUS-ADIERAZPENA', 
            'DISEINUAREN OINARRIAK',
            'ERAIKUNTZA ETA TEKNOLOGIA',
            'KUDEAKETA ETA PROFESIONALTASUNA'
        ];
        console.log(`⚠️ Usando eremuak por defecto: ${eremuak.length}`);
    }
    
    return eremuak.sort();
}

// 🔥 4. EXTRACCIÓN MANUAL DE EREMUAK
function extraerEremuakManual() {
    if (!window.curriculumData) return [];
    
    const eremuakSet = new Set();
    
    // Recorrer todos los grados y asignaturas
    Object.values(window.curriculumData).forEach(grado => {
        if (typeof grado === 'object' && !Array.isArray(grado)) {
            Object.values(grado).forEach(curso => {
                if (Array.isArray(curso)) {
                    curso.forEach(asignatura => {
                        if (asignatura.arloa && asignatura.arloa.trim()) {
                            eremuakSet.add(asignatura.arloa.trim());
                        }
                        if (asignatura.eremua && asignatura.eremua.trim()) {
                            eremuakSet.add(asignatura.eremua.trim());
                        }
                    });
                }
            });
        }
    });
    
    return Array.from(eremuakSet);
}

// 🔥 5. INICIALIZAR ESTRUCTURA DE DATOS
function inicializarEstructuraCompetenciasIngreso(eremuak) {
    console.log('🏗️ Inicializando estructura competencias ingreso...');
    
    // Crear estructura mejorada si no existe
    if (!window.curriculumData.kompetentziak_ingreso_mejorado) {
        window.curriculumData.kompetentziak_ingreso_mejorado = {
            version: "2.0",
            ultima_actualizacion: new Date().toISOString(),
            competencias_por_eremua: {},
            configuracion: {
                eremuak_activos: eremuak,
                grados_relacionados: obtenerGradosDelCurriculum(),
                niveles_disponibles: ['B', 'J', 'A'] // Basikoa, Jakintsua, Aurreratua
            }
        };
        console.log('✅ Estructura mejorada creada');
    }
    
    // Asegurar que todos los eremuak están en la estructura
    eremuak.forEach(eremua => {
        if (!window.curriculumData.kompetentziak_ingreso_mejorado.competencias_por_eremua[eremua]) {
            window.curriculumData.kompetentziak_ingreso_mejorado.competencias_por_eremua[eremua] = [];
        }
    });
    
    // Migrar datos antiguos si existen
    migrarCompetenciasAntiguas();
}

// 🔥 6. MIGRAR COMPETENCIAS ANTIGUAS
function migrarCompetenciasAntiguas() {
    // Si hay competencias en formato antiguo, migrarlas
    if (window.curriculumData.kompetentziak_ingreso && 
        Array.isArray(window.curriculumData.kompetentziak_ingreso) &&
        window.curriculumData.kompetentziak_ingreso.length > 0) {
        
        console.log(`🔄 Migrando ${window.curriculumData.kompetentziak_ingreso.length} competencias antiguas`);
        
        // Por defecto, ponerlas en el primer ámbito
        const primerEremua = Object.keys(window.curriculumData.kompetentziak_ingreso_mejorado.competencias_por_eremua)[0];
        
        if (primerEremua) {
            window.curriculumData.kompetentziak_ingreso_mejorado.competencias_por_eremua[primerEremua] = 
                window.curriculumData.kompetentziak_ingreso.map((comp, index) => ({
                    ...comp,
                    eremua: primerEremua,
                    nivel: comp.nivel || 'B',
                    kodea: comp.kodea || `SI${index + 1}`
                }));
            
            console.log(`✅ Competencias migradas a: ${primerEremua}`);
        }
    }
}

// 🔥 7. RENDERIZAR EDITOR PRINCIPAL
function renderizarEditorCompetenciasIngreso(eremuak) {
    console.log(`🎨 Renderizando editor con ${eremuak.length} ámbitos`);
    
    // Contar competencias totales
    const totalCompetencias = contarCompetenciasTotales();
    
    let html = `
    <div class="space-y-6" id="editorCompetenciasIngreso">
        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-50 to-blue-100 p-5 rounded-xl border border-blue-300">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h3 class="text-2xl font-bold text-blue-800 mb-2 flex items-center">
                        <i class="fas fa-sign-in-alt mr-3"></i>Sarrerako kompetentziak
                    </h3>
                    <p class="text-blue-700">
                        Definitu ikasleek gradu honetan sartzeko behar dituzten gaitasunak, arlo bakoitzaren arabera
                    </p>
                </div>
                <div class="mt-4 md:mt-0">
                    <div class="flex items-center space-x-6">
                        <div class="text-center">
                            <div class="text-3xl font-bold text-blue-800">${eremuak.length}</div>
                            <div class="text-sm text-blue-700">Arlo</div>
                        </div>
                        <div class="text-center">
                            <div class="text-3xl font-bold text-green-800">${totalCompetencias}</div>
                            <div class="text-sm text-green-700">kompetentzia</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Panel de acciones rápidas -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <button onclick="añadirCompetenciaATodosEremuak()" 
                    class="bg-green-500 hover:bg-green-600 text-white p-4 rounded-lg flex flex-col items-center justify-center transition shadow-sm">
                <i class="fas fa-plus-circle text-xl mb-2"></i>
                <span class="font-medium">Gehitu Guztietan</span>
                <span class="text-xs opacity-90">kompetentzia berria arlo guztietan</span>
            </button>
            
            <button onclick="organizarPorNiveles()" 
                    class="bg-yellow-500 hover:bg-yellow-600 text-white p-4 rounded-lg flex flex-col items-center justify-center transition shadow-sm">
                <i class="fas fa-sort-amount-down text-xl mb-2"></i>
                <span class="font-medium">Antolatu Mailak</span>
                <span class="text-xs opacity-90">B/J/A (Basikoa/Jakintsua/Aurreratua)</span>
            </button>
            
            <button onclick="exportarAExcel()" 
                    class="bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-lg flex flex-col items-center justify-center transition shadow-sm">
                <i class="fas fa-file-excel text-xl mb-2"></i>
                <span class="font-medium">Esportatu Excel</span>
                <span class="text-xs opacity-90">Matrize formatuan</span>
            </button>
            
            <button onclick="sincronizarConOriginales()" 
                    class="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-lg flex flex-col items-center justify-center transition shadow-sm">
                <i class="fas fa-sync-alt text-xl mb-2"></i>
                <span class="font-medium">Sinkronizatu</span>
                <span class="text-xs opacity-90">Eguneratu datu basea</span>
            </button>
        </div>
        
        <!-- Filtros -->
        <div class="bg-white border border-gray-300 rounded-lg p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h4 class="font-bold text-gray-700 mb-2 flex items-center">
                        <i class="fas fa-filter mr-2"></i>Iragazkiak
                    </h4>
                    <div class="flex flex-wrap gap-2">
                        <button onclick="filtrarCompetencias('')" 
                                class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                            Guztiak
                        </button>
                        <button onclick="filtrarCompetencias('B')" 
                                class="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm hover:bg-green-200">
                            Basikoak (B)
                        </button>
                        <button onclick="filtrarCompetencias('J')" 
                                class="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm hover:bg-yellow-200">
                            Jakintsuak (J)
                        </button>
                        <button onclick="filtrarCompetencias('A')" 
                                class="px-3 py-1.5 bg-red-100 text-red-800 rounded-lg text-sm hover:bg-red-200">
                            Aurreratuak (A)
                        </button>
                    </div>
                </div>
                
                <div class="text-right">
                    <label class="block text-sm text-gray-600 mb-1">Bilatu:</label>
                    <input type="text" 
                           id="buscadorCompetencias"
                           placeholder="Bilatu kompetentzia..."
                           class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full md:w-64"
                           onkeyup="buscarCompetencias(this.value)">
                </div>
            </div>
        </div>
        
        <!-- Lista de ámbitos -->
        <div class="space-y-4">
    `;
    
    // Renderizar cada ámbito
    eremuak.forEach((eremua, index) => {
        const competencias = obtenerCompetenciasParaEremua(eremua);
        const color = obtenerColorParaEremua(eremua);
        
        html += renderizarEremuaConCompetencias(eremua, competencias, color, index);
    });
    
    html += `
        </div>
        
        <!-- Pie de página -->
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-5 mt-8">
            <div class="flex flex-col md:flex-row justify-between items-center">
                <div>
                    <h4 class="font-bold text-gray-700 mb-1">
                        <i class="fas fa-info-circle mr-2"></i>Informazioa
                    </h4>
                    <p class="text-sm text-gray-600">
                        kompetentziak automatikoki gordetzen dira. Aldaketak ikasleen matrizeetan islatuko dira.
                    </p>
                </div>
                <button onclick="guardarTodoCompetencias()" 
                        class="mt-4 md:mt-0 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium">
                    <i class="fas fa-save mr-2"></i>Gorde Datuak
                </button>
            </div>
        </div>
    </div>
    `;
    
    // Insertar en el DOM
    document.getElementById('unitsContainer').innerHTML = html;
    document.getElementById('noUnitsMessage').classList.add('hidden');
}

// 🔥 8. RENDERIZAR UN ÁMBITO CON SUS COMPETENCIAS
function renderizarEremuaConCompetencias(eremua, competencias, color, index) {
    const eremuaId = eremua.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    
    return `
    <div class="border border-gray-300 rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-300">
        <!-- Header del ámbito -->
        <div class="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
             onclick="toggleEremua('${eremuaId}')"
             style="border-left: 5px solid ${color}; background: ${color}10;">
            <div class="flex items-center">
                <div class="w-12 h-12 rounded-lg flex items-center justify-center mr-4 text-white shadow-sm"
                     style="background: ${color};">
                    <span class="font-bold">${index + 1}</span>
                </div>
                <div>
                    <h4 class="font-bold text-gray-800 text-lg">${eremua}</h4>
                    <div class="flex items-center space-x-4 mt-1">
                        <span class="text-sm text-gray-600">
                            <i class="fas fa-list-check mr-1"></i>${competencias.length} kompetentzia
                        </span>
                        <span class="text-sm" style="color: ${color};">
                            <i class="fas fa-palette mr-1"></i>${obtenerEstadisticasEremua(competencias)}
                        </span>
                    </div>
                </div>
            </div>
            <div class="flex items-center space-x-3">
                <button onclick="event.stopPropagation(); añadirCompetenciaAEremua('${eremua}')" 
                        class="px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 transition"
                        style="background: ${color};">
                    <i class="fas fa-plus mr-1"></i>Gehitu
                </button>
                <i class="fas fa-chevron-down text-gray-500 transition-transform" id="icono-${eremuaId}"></i>
            </div>
        </div>
        
        <!-- Contenido (inicialmente visible) -->
        <div class="p-4 bg-white" id="contenido-${eremuaId}">
            ${competencias.length === 0 ? renderizarSinCompetencias(eremua) : renderizarListaCompetencias(competencias, eremua, color)}
        </div>
    </div>
    `;
}

// 🔥 9. RENDERIZAR LISTA DE COMPETENCIAS
function renderizarListaCompetencias(competencias, eremua, color) {
    let html = `<div class="space-y-3">`;
    
    competencias.forEach((comp, index) => {
        const nivelColor = {
            'B': 'bg-green-100 text-green-800 border-green-200',
            'J': 'bg-yellow-100 text-yellow-800 border-yellow-200', 
            'A': 'bg-red-100 text-red-800 border-red-200'
        }[comp.nivel] || 'bg-gray-100 text-gray-800 border-gray-200';
        
        html += `
        <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition group" 
             data-nivel="${comp.nivel}" 
             data-codigo="${comp.kodea}">
            <div class="flex items-start justify-between">
                <!-- Columna izquierda: Código y nivel -->
                <div class="flex-shrink-0 w-1/4">
                    <div class="mb-2">
                        <input type="text" 
                               value="${comp.kodea || `SI${index + 1}`}"
                               class="w-24 border border-gray-300 rounded px-2 py-1 text-sm font-bold"
                               onchange="actualizarCodigoCompetencia('${eremua}', ${index}, this.value)"
                               placeholder="Kodea">
                    </div>
                    <div class="mb-3">
                        <select class="w-full border rounded px-2 py-1.5 text-sm ${nivelColor}"
                                onchange="actualizarNivelCompetencia('${eremua}', ${index}, this.value)">
                            <option value="B" ${comp.nivel === 'B' ? 'selected' : ''}>🔵 Basikoa (B)</option>
                            <option value="J" ${comp.nivel === 'J' ? 'selected' : ''}>🟡 Jakintsua (J)</option>
                            <option value="A" ${comp.nivel === 'A' ? 'selected' : ''}>🔴 Aurreratua (A)</option>
                        </select>
                    </div>
                    <div class="text-xs text-gray-500">
                        <i class="fas fa-calendar mr-1"></i>${comp.data_sartze || 'Ez dago'}
                    </div>
                </div>
                
                <!-- Columna central: Descripción -->
                <div class="flex-grow mx-4">
                    <textarea class="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" 
                              rows="3"
                              onchange="actualizarDescripcionCompetencia('${eremua}', ${index}, this.value)"
                              placeholder="Deskribatu kompetentzia hau..."
                              style="min-height: 80px;">${comp.deskribapena || ''}</textarea>
                    
                    <!-- Evidencias e instrumentos -->
                    <div class="mt-3 grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-xs font-medium text-gray-600 mb-1 block">
                                <i class="fas fa-clipboard-check mr-1"></i>Ebidentziak
                            </label>
                            <input type="text" 
                                   class="w-full text-sm border border-gray-300 rounded px-3 py-2"
                                   value="${comp.evidencias ? comp.evidencias.join(', ') : ''}"
                                   placeholder="Portfolio, test, proiektua..."
                                   onchange="actualizarEvidenciasCompetencia('${eremua}', ${index}, this.value)">
                        </div>
                        <div>
                            <label class="text-xs font-medium text-gray-600 mb-1 block">
                                <i class="fas fa-clipboard-list mr-1"></i>Ebaluazio tresnak
                            </label>
                            <input type="text" 
                                   class="w-full text-sm border border-gray-300 rounded px-3 py-2"
                                   value="${comp.instrumentos ? comp.instrumentos.join(', ') : ''}"
                                   placeholder="Entrevista, azterketa, ebaluazio..."
                                   onchange="actualizarInstrumentosCompetencia('${eremua}', ${index}, this.value)">
                        </div>
                    </div>
                </div>
                
                <!-- Columna derecha: Acciones -->
                <div class="flex-shrink-0 ml-4">
                    <button onclick="eliminarCompetencia('${eremua}', ${index})" 
                            class="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                            title="Ezabatu">
                        <i class="fas fa-trash"></i>
                    </button>
                    <div class="mt-4 text-xs text-gray-400">
                        ${comp.egilea ? `Egilea: ${comp.egilea}` : ''}
                    </div>
                </div>
            </div>
        </div>
        `;
    });
    
    html += `</div>`;
    return html;
}

// 🔥 10. RENDERIZAR SIN COMPETENCIAS
function renderizarSinCompetencias(eremua) {
    return `
    <div class="text-center py-10 text-gray-400">
        <i class="fas fa-inbox text-4xl mb-4"></i>
        <p class="text-lg mb-2">Ez dago kompetentziarik arlo honetarako</p>
        <p class="text-sm mb-6">Gehitu lehenengo kompetentzia ikasleek sartzeko behar dituzten gaitasunak definitzeko</p>
        <button onclick="añadirCompetenciaAEremua('${eremua}')" 
                class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
            <i class="fas fa-plus mr-2"></i>Gehitu Lehenengo kompetentzia
        </button>
    </div>
    `;
}

// 🔥 FUNCIONES AUXILIARES - AÑADE DESPUÉS DE LAS ANTERIORES

// Obtener color para un ámbito
function obtenerColorParaEremua(eremua) {
    // Intentar obtener de matrices si existen
    if (window.curriculumData.matrices && window.curriculumData.matrices.colores_eremuak) {
        return window.curriculumData.matrices.colores_eremuak[eremua] || getDefaultColor(eremua);
    }
    
    // Colores por defecto basados en hash
    return getDefaultColor(eremua);
}

function getDefaultColor(eremua) {
    const colors = [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
    ];
    
    // Crear hash simple del texto
    let hash = 0;
    for (let i = 0; i < eremua.length; i++) {
        hash = eremua.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
}

// Obtener competencias para un ámbito
function obtenerCompetenciasParaEremua(eremua) {
    if (!window.curriculumData.kompetentziak_ingreso_mejorado) {
        return [];
    }
    
    return window.curriculumData.kompetentziak_ingreso_mejorado.competencias_por_eremua[eremua] || [];
}

// Contar competencias totales
function contarCompetenciasTotales() {
    if (!window.curriculumData.kompetentziak_ingreso_mejorado) {
        return 0;
    }
    
    let total = 0;
    Object.values(window.curriculumData.kompetentziak_ingreso_mejorado.competencias_por_eremua).forEach(arr => {
        total += arr.length;
    });
    
    return total;
}

// Obtener estadísticas de un ámbito
function obtenerEstadisticasEremua(competencias) {
    const niveles = { B: 0, J: 0, A: 0 };
    
    competencias.forEach(comp => {
        if (comp.nivel && niveles[comp.nivel] !== undefined) {
            niveles[comp.nivel]++;
        }
    });
    
    return `${niveles.B}B ${niveles.J}J ${niveles.A}A`;
}

// Obtener grados del curriculum
function obtenerGradosDelCurriculum() {
    if (!window.curriculumData) return [];
    
    return Object.keys(window.curriculumData).filter(grado => 
        !grado.includes('kompetentziak') && 
        grado !== '_metadata' &&
        typeof window.curriculumData[grado] === 'object'
    );
}

// ====== ACCESO MINIMALISTA A COMPETENCIAS ======
function añadirAccesoCompetenciasMinimalista() {
    const aside = document.querySelector('aside');
    const degreeSelect = document.getElementById('degreeSelect');
    
    if (!aside || !degreeSelect || !degreeSelect.value) return;
    if (degreeSelect.value === '' || degreeSelect.value.includes('kompetentzia')) return;
    if (document.getElementById('accesoMinimalistaCompetencias')) return;
    
    const contenedor = document.createElement('div');
    contenedor.id = 'accesoMinimalistaCompetencias';
    contenedor.className = 'mt-8 pt-6 border-t border-gray-200';
    
    contenedor.innerHTML = `
        <div class="text-sm font-medium text-gray-700 mb-3">kompetentziak azkar:</div>
        <div class="flex flex-col gap-2">
            <button onclick="abrirModalCompetencias('ingreso')"
                    class="flex items-center justify-between px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm"
                    title="Sarrerako kompetentziak ikusi">
                <div class="flex items-center">
                    <i class="fas fa-sign-in-alt mr-2"></i>
                    <span>Sarrerakoak</span>
                </div>
                <i class="fas fa-external-link-alt text-xs"></i>
            </button>
            
            <button onclick="abrirModalCompetencias('egreso')"
                    class="flex items-center justify-between px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm"
                    title="Irteerako kompetentziak ikusi">
                <div class="flex items-center">
                    <i class="fas fa-sign-out-alt mr-2"></i>
                    <span>Irteerakoak</span>
                </div>
                <i class="fas fa-external-link-alt text-xs"></i>
            </button>
        </div>
    `;
    
    const subjectList = document.getElementById('subjectList');
    if (subjectList && subjectList.parentNode) {
        subjectList.parentNode.insertBefore(contenedor, subjectList);
    }
}

function abrirModalCompetencias(tipo) {
    const competencias = window.curriculumData[`kompetentziak_${tipo}`] || [];
    const titulo = tipo === 'ingreso' ? 'Sarrerako kompetentziak' : 'Irteerako kompetentziak';
    const color = tipo === 'ingreso' ? 'green' : 'blue';
    
    const modal = document.createElement('div');
    modal.id = 'modalCompetenciasMinimalista';
    modal.className = 'fixed inset-0 z-50';
    
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black bg-opacity-50" onclick="cerrarModalCompetencias()"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4">
            <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
                <!-- Header -->
                <div class="flex items-center justify-between p-6 border-b">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800">${titulo}</h3>
                        <p class="text-gray-600 text-sm mt-1">
                            ${competencias.length} kompetentzia
                        </p>
                    </div>
                    <button 
                        onclick="cerrarModalCompetencias()"
                        class="text-gray-400 hover:text-gray-600 text-xl"
                    >
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <!-- Contenido -->
                <div class="flex-1 overflow-y-auto p-6">
                    ${competencias.length > 0 ? `
                        <div class="space-y-4">
                            ${competencias.map((comp, i) => `
                                <div class="border-l-4 border-${color}-500 pl-4 py-3 bg-${color}-50">
                                    <div class="flex justify-between items-start">
                                        <div class="flex-1">
                                            <div class="font-mono font-bold text-${color}-700">
                                                ${comp.kodea || `K${i+1}`}
                                            </div>
                                            <div class="text-gray-700 mt-2 whitespace-pre-line">
                                                ${comp.deskribapena || 'Deskribapenik gabe'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="text-center py-12">
                            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4">
                                <i class="fas fa-clipboard-list text-2xl"></i>
                            </div>
                            <h4 class="text-lg font-medium text-gray-700 mb-2">Ez daude kompetentziak</h4>
                            <p class="text-gray-500">Gehitu kompetentziak curriculumaren atalean</p>
                        </div>
                    `}
                </div>
                
                <!-- Footer -->
                <div class="p-6 border-t">
                    <button 
                        onclick="cerrarModalCompetencias()"
                        class="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                    >
                        Itxi
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function cerrarModalCompetencias() {
    const modal = document.getElementById('modalCompetenciasMinimalista');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

// Integrar con onDegreeChange
const originalOnDegreeChange = window.onDegreeChange;
if (originalOnDegreeChange) {
    window.onDegreeChange = function(event) {
        originalOnDegreeChange.call(this, event);
        
        setTimeout(() => {
            const selectedValue = event?.target?.value || document.getElementById('degreeSelect').value;
            if (selectedValue && !selectedValue.includes('kompetentzia')) {
                const existente = document.getElementById('accesoMinimalistaCompetencias');
                if (existente) existente.remove();
                añadirAccesoCompetenciasMinimalista();
            }
        }, 500);
    };
}


// ALDATU DOMContentLoaded:
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 DOM Cargado - Inicialización segura');
            
            // 🔥 NUEVO: 1. INICIALIZAR SUPABASE PRIMERO
            if (!window.supabase || !window.supabase.auth) {
                console.error('❌ Supabase no está listo');
                
                // Mostrar error solo si realmente hay problema
                const loading = document.getElementById('loadingOverlay');
                if (loading && !window.supabase) {
                    loading.innerHTML = `
                        <div class="bg-red-50 p-6 rounded-lg max-w-md">
                            <h3 class="text-red-800 font-bold text-lg mb-2">⚠️ Error de Conexión</h3>
                            <p class="text-red-600 mb-4">Revisa tu conexión a internet.</p>
                            <button onclick="window.location.reload()" 
                                    class="bg-red-600 text-white px-4 py-2 rounded">
                                Recargar Página
                            </button>
                        </div>
                    `;
                    return;
                }
            }
            
            console.log('✅ Supabase verificado, continuando...');
            
            // 2. Ocultar loading overlay
            const loading = document.getElementById('loadingOverlay');
            if (loading) {
                setTimeout(() => {
                    loading.classList.add('hidden');
                }, 1000);
            }
            
            // 3. Verificar logout SOLO si hay parámetro
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('logout')) {
                console.log('⚠️ URL tiene parámetro logout - procesando...');
                handleLogoutFromUrl();
            } else {
                // 4. Si NO hay logout, verificar sesión existente
                console.log('🔍 Verificando sesión existente...');
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session) {
                        console.log('📱 Sesión encontrada:', session.user.email);
                        setUILoginState(true, session.user);
                    } else {
                        console.log('👤 No hay sesión activa');
                        setUILoginState(false);
                    }
                });
            }
            
            // 5. Configurar event listeners
            if (typeof setupEventListeners === 'function') {
                setupEventListeners();
            }
            
            // 6. WebSocket con delay (evitar conflictos)
            setTimeout(() => {
                if (typeof setupRealtimeUpdates === 'function') {
                    console.log('🔌 Conectando WebSocket...');
                    setupRealtimeUpdates();
                }
            }, 2000);
        });

    // 🛡️ BLOQUEADOR TAC/ADS - VERSIÓN SUPER AGRESIVA
    (function() {
        'use strict';
        
        console.log('🛡️ BLOQUEADOR TAC - MODO AGGRESIVO ACTIVADO');
        
       // 🛡️ PROTEGER LOCALSTORAGE DE TAC
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
            // BLOQUEAR cualquier dato TAC
            if (typeof key === 'string' && typeof value === 'string') {
                const isTAC = key.includes('tac') || key.includes('TAC') || 
                             key.includes('content-v2') || value.includes('tac');
                
                if (isTAC) {
                    console.log('🔒 TAC BLOQUEADO en localStorage:', key.substring(0, 50));
                    return; // No guardar
                }
            }
            
            return originalSetItem.call(this, key, value);
        };
        
        // 🔥 1. INTERCEPTAR Y BLOQUEAR TAC ANTES DE QUE SE EJECUTE
        const originalAppendChild = Element.prototype.appendChild;
        const originalInsertBefore = Node.prototype.insertBefore;
        const originalSetAttribute = Element.prototype.setAttribute;
        
        // Lista negra COMPLETA de TAC
        const TAC_BLACKLIST = [
            'tac', 'TAC', 'content-v2', 'floater', 'ad-container',
            'ad-script', 'ad-loader', 'ad-frame', 'tac-container',
            'tac-floater', 'tac-icon', 'ad-icon'
        ];
        
        // 🔥 2. BLOQUEAR APPENDCHILD
        Element.prototype.appendChild = function(child) {
            if (child && child.tagName) {
                const tag = child.tagName.toLowerCase();
                const src = child.src || '';
                const className = child.className || '';
                const id = child.id || '';
                const innerHTML = child.innerHTML || '';
                
                // BLOQUEAR TAC en CUALQUIER elemento
                const isTAC = TAC_BLACKLIST.some(keyword => 
                    src.includes(keyword) || 
                    className.includes(keyword) ||
                    id.includes(keyword) ||
                    innerHTML.includes(keyword) ||
                    child.textContent?.includes(keyword)
                );
                
                if (isTAC) {
                    console.log('🚫 TAC BLOQUEADO en appendChild:', {tag, src, className});
                    return child; // No añadir al DOM
                }
            }
            return originalAppendChild.call(this, child);
        };
        
        // 🔥 3. BLOQUEAR INSERTBEFORE
        Node.prototype.insertBefore = function(newNode, referenceNode) {
            if (newNode && newNode.tagName) {
                const src = newNode.src || '';
                const className = newNode.className || '';
                const id = newNode.id || '';
                
                const isTAC = TAC_BLACKLIST.some(keyword => 
                    src.includes(keyword) || 
                    className.includes(keyword) ||
                    id.includes(keyword)
                );
                
                if (isTAC) {
                    console.log('🚫 TAC BLOQUEADO en insertBefore:', newNode.tagName);
                    return newNode;
                }
            }
            return originalInsertBefore.call(this, newNode, referenceNode);
        };
        
        // 🔥 4. BLOQUEAR SETATTRIBUTE (para scripts dinámicos)
        Element.prototype.setAttribute = function(name, value) {
            if (name === 'src' && value) {
                const isTAC = TAC_BLACKLIST.some(keyword => 
                    value.includes(keyword)
                );
                
                if (isTAC) {
                    console.log('🚫 TAC BLOQUEADO en setAttribute:', value);
                    return; // No establecer el atributo
                }
            }
            return originalSetAttribute.call(this, name, value);
        };
        
        // 🔥 5. BLOQUEAR DOCUMENT.WRITE (TAC lo usa)
        document.write = function() {
            const content = Array.from(arguments).join('');
            if (TAC_BLACKLIST.some(keyword => content.includes(keyword))) {
                console.log('🚫 TAC BLOQUEADO en document.write');
                return;
            }
            console.warn('⚠️ document.write bloqueado por seguridad');
        };
        
        // 🔥 6. OBSERVADOR DE MUTACIONES HIPER-AGRESIVO
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // BLOQUEAR SCRIPTS TAC
                        if (node.tagName === 'SCRIPT') {
                            const src = node.src || '';
                            const text = node.textContent || '';
                            const isTAC = TAC_BLACKLIST.some(keyword => 
                                src.includes(keyword) || text.includes(keyword)
                            );
                            
                            if (isTAC) {
                                console.log('👀 TAC SCRIPT detectado y ELIMINADO:', src.substring(0, 50));
                                node.remove();
                                return;
                            }
                        }
                        
                        // BLOQUEAR ELEMENTOS TAC
                        const className = node.className || '';
                        const id = node.id || '';
                        const isTAC = TAC_BLACKLIST.some(keyword => 
                            className.includes(keyword) || id.includes(keyword)
                        );
                        
                        if (isTAC) {
                            console.log('👀 ELEMENTO TAC detectado y ELIMINADO:', node.tagName);
                            node.remove();
                            return;
                        }
                        
                        // BUSCAR Y ELIMINAR TAC DENTRO DEL ELEMENTO
                        if (node.querySelectorAll) {
                            node.querySelectorAll('script, div, span, iframe').forEach(el => {
                                const elSrc = el.src || '';
                                const elClass = el.className || '';
                                const elId = el.id || '';
                                
                                if (TAC_BLACKLIST.some(keyword => 
                                    elSrc.includes(keyword) || 
                                    elClass.includes(keyword) || 
                                    elId.includes(keyword))) {
                                    console.log('👀 TAC INTERNO eliminado');
                                    el.remove();
                                }
                            });
                        }
                    }
                });
            });
        });
        
        // 🔥 7. CONFIGURAR OBSERVADOR (OBSERVA TODO)
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'class', 'id']
        });
        
        // 🔥 8. LIMPIEZA INICIAL INMEDIATA
        function cleanTACImmediately() {
            console.log('🧹 Limpieza inicial de TAC...');
            
            // Eliminar SCRIPTS TAC
            document.querySelectorAll('script').forEach(script => {
                const src = script.src || '';
                const text = script.textContent || '';
                if (TAC_BLACKLIST.some(keyword => 
                    src.includes(keyword) || text.includes(keyword))) {
                    console.log('🗑️ SCRIPT TAC eliminado inicialmente');
                    script.remove();
                }
            });
            
            // Eliminar ELEMENTOS TAC
            TAC_BLACKLIST.forEach(keyword => {
                document.querySelectorAll(`[class*="${keyword}"], [id*="${keyword}"]`).forEach(el => {
                    console.log('🗑️ ELEMENTO TAC eliminado inicialmente');
                    el.remove();
                });
            });
            
            // PROTEGER LOCALSTORAGE de TAC
            const originalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (TAC_BLACKLIST.some(keyword => 
                    key.includes(keyword) || value.includes(keyword))) {
                    console.log('🔒 TAC bloqueado en localStorage:', key);
                    return;
                }
                return originalSetItem.call(this, key, value);
            };
        }
        
        // 🔥 9. EJECUTAR INMEDIATAMENTE
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', cleanTACImmediately);
        } else {
            cleanTACImmediately();
        }
        
        // 🔥 10. LIMPIEZA PERIÓDICA (cada 500ms)
        let tacCleanupCount = 0;
        const tacCleanupInterval = setInterval(() => {
            tacCleanupCount++;
            
            // 🔥 LIMITAR a 10 limpiezas (5 segundos)
            if (tacCleanupCount > 10) {
                console.log('✅ TAC: Limpieza periódica DETENIDA (máximo alcanzado)');
                clearInterval(tacCleanupInterval);
                return;
            }
            cleanTACImmediately();
        }, 500);
        
        console.log('✅ BLOQUEADOR TAC AGGRESIVO ACTIVADO');
    })();

        // 🔥 DESREGISTRAR SERVICE WORKERS AL CARGAR
        (function() {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    console.log('Service workers encontrados:', registrations.length);
                    registrations.forEach(function(registration) {
                        console.log('Desregistrando:', registration.scope);
                        registration.unregister();
                    });
                });
                
                if (window.caches) {
                    caches.keys().then(function(cacheNames) {
                        cacheNames.forEach(function(cacheName) {
                            caches.delete(cacheName);
                        });
                    });
                }
            }
                    })();

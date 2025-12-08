// app.js - Código principal de la aplicación

// ============================================
// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
// ============================================   
// Supabase konfigurazioa - config.js fitxategitik kargatuko da
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_KEY = window.SUPABASE_KEY;
    
// Supabase hasieratu
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// Detectar si hay sesión en la URL (después de redirección de Google)

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
        subjectRAs: document.getElementById('subjectRAs')
    };
    
    console.log('🔍 Elementos encontrados:', Object.keys(elements).filter(k => elements[k]));
    
    // LISTENER SIMPLEAK
    if (elements.saveBtn) {
        elements.saveBtn.addEventListener('click', saveCurriculumData);
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
    
    // JSON FITXATEGIA
    if (elements.jsonFileInput) {
        elements.jsonFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    window.curriculumData = JSON.parse(e.target.result);
                    if (window.normalizeData) window.normalizeData(window.curriculumData);
                    if (window.initializeUI) window.initializeUI();
                    if (window.showToast) window.showToast('✅ JSON kargatuta!', 'success');
                    setTimeout(() => {
                        if (window.saveCurriculumData) window.saveCurriculumData();
                    }, 1000);
                } catch (error) {
                    if (window.showToast) window.showToast('❌ JSON errorea', 'error');
                }
            };
            reader.readAsText(file);
        });
    }
    
    console.log('✅ Event listeners configurados');
};     
               
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
                document.getElementById('loadingOverlay')?.classList.add('hidden');
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
                const signInBtn = document.getElementById('signInBtn');
                if (signInBtn) signInBtn.classList.add('hidden');
                
                // Mostrar botón de logout
                const signOutBtn = document.getElementById('signOutBtn');
                if (signOutBtn) signOutBtn.classList.remove('hidden');
                
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
                const navPanel = document.getElementById('navigationPanel');
                if (navPanel) navPanel.classList.remove('hidden');
                
                // Ocultar mensaje "no data"
                const noDataMsg = document.getElementById('noDataMessage');
                if (noDataMsg) noDataMsg.classList.add('hidden');
                
                // Mostrar botones admin si corresponde
                const isAdmin = ADMIN_EMAILS.includes(user.email);
                document.getElementById('downloadBackupBtn')?.classList.toggle('hidden', !isAdmin);
                document.getElementById('uploadJsonBtn')?.classList.toggle('hidden', !isAdmin);
                
            } else {
                // 🔥 4. SI NO ESTÁ LOGUEADO
                console.log('👤 Ocultando UI - no logueado');
                
                document.getElementById('signInBtn')?.classList.remove('hidden');
                document.getElementById('signOutBtn')?.classList.add('hidden');
                document.getElementById('userInfo')?.classList.add('hidden');
                document.getElementById('appButtons')?.classList.add('hidden');
                document.getElementById('navigationPanel')?.classList.add('hidden');
                document.getElementById('noDataMessage')?.classList.remove('hidden');
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

        // 🔥 FUNCIÓN ÚNICA PARA AMBOS TIPOS (independiente del grado)
        window.showCompetenciasGlobales = async function(tipo) {
            console.log(`📚 Mostrando competencias ${tipo} (globales)`);
            
            // Mostrar editor
            document.getElementById('welcomeEditor').classList.add('hidden');
            document.getElementById('editorPanel').classList.remove('hidden');
            
            // Configurar título
            const esIngreso = tipo === 'ingreso';
            document.getElementById('subjectTitle').textContent = 
                esIngreso ? 'Sarrerako Kompetentziak' : 'Irteerako Kompetentziak';
            
            document.getElementById('subjectType').textContent = 'Kompetentziak Globalak';
            document.getElementById('subjectCredits').textContent = '';
            
            // Ocultar campos de asignatura (no aplican)
            document.getElementById('subjectNameEdit').value = '';
            document.getElementById('subjectArea').value = '';
            document.getElementById('subjectRAs').value = '';
            
            // Deshabilitar unidad didáctica
            document.getElementById('unitName').disabled = true;
            document.getElementById('unitContent').disabled = true;
            document.getElementById('addUnitBtn').disabled = true;
            
            // Asegurar estructura en curriculumData
            const competenciasKey = esIngreso ? 'kompetentziak_ingreso' : 'kompetentziak_egreso';
            
            if (!window.curriculumData[competenciasKey]) {
                window.curriculumData[competenciasKey] = [];
                console.log(`✅ Estructura creada: ${competenciasKey}`);
            }
            
            const competencias = window.curriculumData[competenciasKey];
            
            // Renderizar lista
            renderizarCompetencias(competencias, competenciasKey);
        };
        
        // 🔥 RENDERIZAR LISTA DE COMPETENCIAS
        function renderizarCompetencias(competencias, competenciasKey) {
            let html = `
                <div class="mb-6">
                    <h3 class="text-xl font-bold mb-4 text-gray-800">
                        ${competenciasKey === 'kompetentziak_ingreso' ? '🎯 Sarrerako Kompetentziak' : '🎓 Irteerako Kompetentziak'}
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
                        <p class="text-sm mt-1">Gehitu lehen kompetentzia "Gehitu Kompetentzia" botoiarekin.</p>
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
                            <i class="fas fa-plus mr-2"></i>Gehitu Kompetentzia Berria
                        </button>
                    </div>
                </div>
            `;
            
            // Mostrar en el contenedor
            document.getElementById('unitsContainer').innerHTML = html;
            document.getElementById('noUnitsMessage').classList.add('hidden');
        }
        
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
                window.showToast('✅ Kompetentzia eguneratua', 'success');
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
            window.showToast('✅ Kompetentzia berria gehitu da', 'success');
        };
        
        // 🔥 ELIMINAR COMPETENCIA GLOBAL
        window.deleteCompetenciaGlobal = function(competenciasKey, index) {
            if (!window.curriculumData[competenciasKey]) return;
            
            if (confirm('Ziur zaude kompetentzia ezabatu nahi duzula?\n\nEkintza hau ezin da desegin.')) {
                window.curriculumData[competenciasKey].splice(index, 1);
                
                // Volver a renderizar
                renderizarCompetencias(window.curriculumData[competenciasKey], competenciasKey);
                window.saveCurriculumData();
                window.showToast('🗑️ Kompetentzia ezabatua', 'success');
            }
        };

        // 🔥 NORMALIZAR Y MIGRAR ESTRUCTURA JSON
        window.normalizeData = function(data) {
            console.log('🔄 Normalizando estructura de datos...');
            
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
            return data;
        };

            // 🔥 FUNCIÓN MEJORADA DE VERIFICACIÓN
            function verificarEstructuraDatos() {
                if (!window.curriculumData) {
                    console.log('⏳ Ez dago daturik egiaztatzeko');
                    return;
                }
                
                console.log('🔍 DATUEN EGITURA EGIAZTATZEN...');
                
                const resultados = {
                    grados: [],
                    competencias: { ingreso: false, egreso: false },
                    errores: [],
                    avisos: []
                };
                
                // 1. Identificar grados vs competencias
                Object.keys(window.curriculumData).forEach(key => {
                    if (key === 'kompetentziak_ingreso') {
                        resultados.competencias.ingreso = true;
                        console.log(`✅ Kompetentziak ingreso: ${window.curriculumData[key].length} elementu`);
                    } 
                    else if (key === 'kompetentziak_egreso') {
                        resultados.competencias.egreso = true;
                        console.log(`✅ Kompetentziak egreso: ${window.curriculumData[key].length} elementu`);
                    }
                    else if (key === '_metadata') {
                        // Ignorar metadatos
                    }
                    else {
                        resultados.grados.push(key);
                        console.log(`🎓 Grado: ${key}`);
                    }
                });
                
                // 2. Verificar estructura mínima
                if (resultados.grados.length === 0) {
                    resultados.errores.push('❌ Ez dago gradu definitua');
                }
                
                if (!resultados.competencias.ingreso) {
                    resultados.avisos.push('⚠️ Kompetentziak ingreso ez dago definituta (berria sortuko da automatikoki)');
                }
                
                if (!resultados.competencias.egreso) {
                    resultados.avisos.push('⚠️ Kompetentziak egreso ez dago definituta (berria sortuko da automatikoki)');
                }
                
                // 3. Mostrar resumen
                console.log('📊 EGITURA-LABURPENA:');
                console.log(`• Graduak: ${resultados.grados.length} (${resultados.grados.join(', ')})`);
                console.log(`• Kompetentziak ingreso: ${resultados.competencias.ingreso ? '✅ BAI' : '❌ EZ'}`);
                console.log(`• Kompetentziak egreso: ${resultados.competencias.egreso ? '✅ BAI' : '❌ EZ'}`);
                
                if (resultados.errores.length > 0) {
                    console.error('🚨 ERROREAK:', resultados.errores);
                    window.showToast('⚠️ Datuak egitura akatsek', 'error');
                }
                
                if (resultados.avisos.length > 0) {
                    console.warn('ℹ️ AVISUAK:', resultados.avisos);
                    
                    // Si falta estructura de competencias, crearla automáticamente
                    if (!resultados.competencias.ingreso || !resultados.competencias.egreso) {
                        console.log('🔄 Kompetentziak egitura automatikoki sortzen...');
                        
                        if (!window.curriculumData.kompetentziak_ingreso) {
                            window.curriculumData.kompetentziak_ingreso = [];
                        }
                        
                        if (!window.curriculumData.kompetentziak_egreso) {
                            window.curriculumData.kompetentziak_egreso = [];
                        }
                        
                        // Guardar automáticamente si hay sesión
                        setTimeout(() => {
                            if (window.supabase && window.supabase.auth) {
                                supabase.auth.getUser().then(({data}) => {
                                    if (data.user) {
                                        window.saveCurriculumData().then(() => {
                                            console.log('✅ Kompetentziak egitura automatikoki gordeta');
                                        });
                                    }
                                });
                            }
                        }, 2000);
                    }
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
                        document.getElementById('eremuakModal')?.remove();
                        mostrarEditorEremuak();
                        llenarSelectEremuakConEditor();
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
                        document.getElementById('eremuakModal')?.remove();
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
                    document.getElementById('eremuakModal')?.remove();
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
  
        // 🔥 FUNCIÓN PARA MOSTRAR LAS 4 MATRICES ANECA
        window.mostrarMatricesANECA = function() {
            console.log('📊 Mostrando matrices ANECA');
            
            // 1. Verificar sesión
            supabase.auth.getUser().then(({data: { user }}) => {
                if (!user) {
                    window.showToast('❌ Saioa hasi behar duzu', 'error');
                    return;
                }
                
                // 2. Crear modal con las 4 matrices
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
                        
                        <div class="grid md:grid-cols-2 gap-6">
                            <!-- MATRIZ 1: Competencias vs Asignaturas -->
                            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                                <h3 class="font-bold text-lg text-blue-700 mb-2">
                                    <i class="fas fa-table mr-2"></i>Matriz 1
                                </h3>
                                <p class="text-gray-600 mb-3">Competencias vs Asignaturas: Relación entre competencias y las asignaturas que las desarrollan</p>
                                <button onclick="abrirMatriz('competencias-vs-asignaturas')" 
                                        class="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                                    Abrir Matriz
                                </button>
                            </div>
                            
                            <!-- MATRIZ 2: Asignaturas vs Resultados -->
                            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                                <h3 class="font-bold text-lg text-green-700 mb-2">
                                    <i class="fas fa-chart-bar mr-2"></i>Matriz 2
                                </h3>
                                <p class="text-gray-600 mb-3">Asignaturas vs Resultados Aprendizaje: Cómo cada asignatura contribuye a los resultados</p>
                                <button onclick="abrirMatriz('asignaturas-vs-resultados')" 
                                        class="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">
                                    Abrir Matriz
                                </button>
                            </div>
                            
                            <!-- MATRIZ 3: Temporalización -->
                            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                                <h3 class="font-bold text-lg text-yellow-700 mb-2">
                                    <i class="fas fa-calendar-alt mr-2"></i>Matriz 3
                                </h3>
                                <p class="text-gray-600 mb-3">Temporalización: Distribución temporal de competencias por curso/semestre</p>
                                <button onclick="abrirMatriz('temporalizacion')" 
                                        class="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded">
                                    Abrir Matriz
                                </button>
                            </div>
                            
                            <!-- MATRIZ 4: Evaluación -->
                            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                                <h3 class="font-bold text-lg text-red-700 mb-2">
                                    <i class="fas fa-clipboard-check mr-2"></i>Matriz 4
                                </h3>
                                <p class="text-gray-600 mb-3">Sistema de Evaluación: Instrumentos y criterios de evaluación por competencia</p>
                                <button onclick="abrirMatriz('evaluacion')" 
                                        class="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded">
                                    Abrir Matriz
                                </button>
                            </div>
                        </div>
                        
                        <div class="mt-6 text-center text-sm text-gray-500">
                            <p><i class="fas fa-info-circle mr-1"></i>Estas matrices cumplen con los requisitos de acreditación ANECA</p>
                        </div>
                    </div>
                </div>
                `;
                
                // 3. Añadir modal al DOM
                document.body.insertAdjacentHTML('beforeend', modalHTML);
            });
        };
        
        // 🔥 FUNCIÓN PARA ABRIR MATRIZ ESPECÍFICA
        window.abrirMatriz = function(tipo) {
            const paginas = {
                'competencias-vs-asignaturas': 'matrices/matriz1.html',
                'asignaturas-vs-resultados': 'matrices/matriz2.html', 
                'temporalizacion': 'matrices/matriz3.html',
                'evaluacion': 'matrices/matriz4.html'
                    };
            
            const pagina = paginas[tipo];
            if (pagina) {
                // Cerrar modal
                document.getElementById('matricesModal')?.remove();
                
                // Redirigir
                window.location.href = pagina;
            } else {
                window.showToast('❌ Matriz no encontrada', 'error');
            }
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
        • Kompetentziak Ingreso: ${datosExportar.kompetentziak_ingreso?.length || 0}
        • Kompetentziak Egreso: ${datosExportar.kompetentziak_egreso?.length || 0}
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
            document.getElementById('loadingOverlay').classList.add('hidden');
            document.getElementById('saveBtn').disabled = false;
            document.getElementById('downloadBackupBtn').disabled = false;
        
            const degreeSelect = document.getElementById('degreeSelect');
            degreeSelect.innerHTML = '<option value="">-- Aukeratu Gradua --</option>';
            
            // 🔥 FILTRAR: Solo mostrar GRADOS, NO competencias/metadata
            Object.keys(window.curriculumData).forEach(degree => {
                // ❌ EXCLUIR estas keys (NO son grados):
                if (degree === 'kompetentziak_ingreso' || 
                    degree === 'kompetentziak_egreso' || 
                    degree === '_metadata' ||
                    degree.startsWith('kompetentziak')) {
                    return; // Saltar esta iteración
                }
                
                // ✅ Solo añadir si es un grado real
                const cursos = window.curriculumData[degree];
                if (cursos && typeof cursos === 'object') {
                    // Verificar que tiene estructura de grado (cursos 1-4)
                    const tieneCursos = cursos['1. Maila'] || cursos['1. curso'] || 
                                       Object.keys(cursos).some(key => 
                                           key.includes('Maila') || 
                                           key.includes('curso') || 
                                           key.includes('Curso')
                                       );
                    
                    if (tieneCursos) {
                        const option = document.createElement('option');
                        option.value = degree;
                        option.textContent = degree;
                        degreeSelect.appendChild(option);
                    }
                }
            });
            
            // 🔥 LLENAR SELECT DE EREMUAK (si existe la función)
            if (typeof llenarSelectEremuakConEditor === 'function') {
                setTimeout(llenarSelectEremuakConEditor, 500);
            }
            
            if (window.selectedDegree) {
                degreeSelect.value = window.selectedDegree;
                window.renderYears();
                if (window.selectedYear) {
                    window.renderSubjects();
                    if (window.selectedSubjectIndex !== null) {
                        window.loadSubjectEditor(window.selectedSubjectIndex);
                    }
                }
            }
            document.getElementById('navigationPanel').classList.remove('hidden');
        };

        // --- UI Funtzio Laguntzaileak (window objektuan gordeta) ---
        window.onDegreeChange = function() {
            const degreeSelect = document.getElementById('degreeSelect');
            const selectedValue = degreeSelect.value;
            
            // 🔥 Si selecciona competencias, manejarlo diferente
            if (selectedValue === 'kompetentziak_ingreso' || selectedValue === 'kompetentziak_egreso') {
                console.log('🎯 Kompetentziak aukeratuta:', selectedValue);
                
                // Mostrar editor de competencias
                const tipo = selectedValue === 'kompetentziak_ingreso' ? 'ingreso' : 'egreso';
                
                if (typeof window.showCompetenciasGlobales === 'function') {
                    window.showCompetenciasGlobales(tipo);
                } else {
                    console.error('❌ showCompetenciasGlobales ez dago definitua');
                    window.showToast('❌ Funzioa ez dago erabilgarri', 'error');
                }
                
                return;
            }
            
            // ✅ Si es un grado normal, proceder como siempre
            window.selectedDegree = selectedValue;
            window.selectedYear = null;
            window.selectedSubjectIndex = null;
            window.renderYears();
            document.getElementById('subjectList').innerHTML = '<li class="p-3 text-gray-500 text-sm italic">Aukeratu maila bat irakasgaiak ikusteko.</li>';
            window.resetEditor();
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
            document.getElementById('welcomeEditor').classList.remove('hidden');
            document.getElementById('editorPanel').classList.add('hidden');
        }

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
        
        window.showToast = function(message, type = 'normal') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'fixed bottom-5 right-5 px-6 py-3 rounded shadow-lg transform transition-transform duration-300';
            if (type === 'error') { toast.classList.add('bg-red-600', 'text-white'); } 
            else if (type === 'success') { toast.classList.add('bg-green-600', 'text-white'); } 
            else { toast.classList.add('bg-gray-800', 'text-white'); }
            requestAnimationFrame(() => {
                toast.classList.remove('translate-y-20');
                setTimeout(() => { toast.classList.add('translate-y-20'); }, 3000);
            });
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

        // ALDATU DOMContentLoaded:
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 DOM Cargado - Inicialización segura');
            
            // 1. Ocultar loading overlay
            const loading = document.getElementById('loadingOverlay');
            if (loading) {
                setTimeout(() => {
                    loading.classList.add('hidden');
                }, 1000);
            }
            
            // 2. Verificar logout SOLO si hay parámetro
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('logout')) {
                console.log('⚠️ URL tiene parámetro logout - procesando...');
                handleLogoutFromUrl();
            } else {
                // 3. Si NO hay logout, verificar sesión existente
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
            
            // 4. Configurar event listeners
            if (typeof setupEventListeners === 'function') {
                setupEventListeners();
            }
            
            // 5. WebSocket con delay (evitar conflictos)
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
 





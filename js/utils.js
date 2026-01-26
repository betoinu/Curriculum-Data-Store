// utils.js - Funciones reutilizables
import { loadCurriculumData } from './curriculum.js';

console.log('🔧 Cargando utils.js v2.0...');

// Variables de control del auth (NO en window, NO en app.js)
let authHandlerRegistered = false;  // ← SE QUEDA AQUÍ
let authProcessing = false;
let authInitialized = false;
let lastAuthEventTime = 0;
const AUTH_EVENT_COOLDOWN = 2000;

// Sistema de cola para eventos auth
const authEventQueue = [];
let isProcessingAuthQueue = false;
let authEventCount = 0;

//berrie
let supabaseInstance = null;


// 1. CONSTANTES GLOBALES
if (!window.ADMIN_EMAILS) window.ADMIN_EMAILS = ['josuayerbe@idarte.eus'];
if (!window.ALLOWED_DOMAINS) window.ALLOWED_DOMAINS = ['idarte.eus'];

// 2. SISTEMA DE CACHÉ (si no existe)
if (!window.dataCache) {
    window.dataCache = {
        data: null,
        timestamp: 0,
        maxAge: 30000,
        forceRefresh: false,
        lastUpdateBy: null,
        version: '1.0'
    };
}

// 3. DIAGNÓSTICOS (si no existe)
if (!window.diagnostics) {
    window.diagnostics = {
        authEventCount: 0,
        dataLoadCount: 0,
        cacheHitCount: 0,
        cacheMissCount: 0,
        uiUpdateCount: 0
    };
}

if (!window.observers) window.observers = { mutationObserver: null };

// --- TOOLTIP FLOTATZAILEA (Sidebarrerako) ---

// Tooltip elementua sortu oraindik ez badago
if (!document.getElementById('custom-tooltip')) {
    const tooltipDiv = document.createElement('div');
    tooltipDiv.id = 'custom-tooltip';
    tooltipDiv.className = 'fixed hidden bg-slate-900 text-white text-xs p-2 rounded shadow-xl border border-slate-700 z-[9999] max-w-xs pointer-events-none leading-relaxed';
    document.body.appendChild(tooltipDiv);
}

window.showCustomTooltip = (event, text, areaName) => {
    const tooltip = document.getElementById('custom-tooltip');
    if (!tooltip) return;

    // Edukia jarri (Eremua baldin badago, goiburua jarri)
    let content = '';
    if (areaName) {
        content += `<div class="font-bold text-indigo-300 mb-1 uppercase text-[10px]">${areaName}</div>`;
    }
    content += `<div>${text}</div>`;
    
    tooltip.innerHTML = content;
    tooltip.classList.remove('hidden');

    // Posizionamendua (Saguaren ondoan)
    const x = event.clientX + 15;
    const y = event.clientY + 10;

    // Pantailatik ez ateratzeko logika sinplea
    tooltip.style.left = Math.min(x, window.innerWidth - 320) + 'px';
    tooltip.style.top = Math.min(y, window.innerHeight - 100) + 'px';
};

window.hideCustomTooltip = () => {
    const tooltip = document.getElementById('custom-tooltip');
    if (tooltip) tooltip.classList.add('hidden');
};


// ============================================
// 🔥 HELPER FUNCTIONS - MANIPULACIÓN SEGURA DEL DOM
// ============================================

export async function safeAddClass(elementId, className) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add(className);
        return true;
    }
    return false;
}

export async function safeRemoveClass(elementId, className) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove(className);
        return true;
    }
    return false;
}

export async function safeToggleClass(elementId, className, force) {
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

export async function safeRemoveElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.remove();
        return true;
    }
    return false;
}

export async function safeSetText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
        return true;
    }
    return false;
}

export async function safeDomOperation(callback) {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            try {
                const result = callback();
                resolve(result);
            } catch (error) {
                console.error('❌ Error en safeDomOperation:', error);
                resolve(null);
            }
        });
    });
};


//======================================
//2. FUNCIONES DE UI REUTILIZABLES
//======================================

// Sistema de notificaciones (YA existe en app.js línea ~2998)
export async function showToast(message, type = 'normal') {
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

//======================================
//3. FUNCIONES DE VALIDACIÓN
//======================================
// 🔥 NUEVO: Función para procesar eventos auth de forma controlada
export async function procesarEventoAuth(event, session) {
    // Bloquear procesamiento múltiple
    if (authProcessing) {
        console.log('⏳ Auth ya procesándose, encolando evento:', event);
        authEventQueue.push({ event, session });
        return;
    }
    
    authProcessing = true;
    authEventCount++;
    
    // Registrar tiempo del evento
    const now = Date.now();
    const timeSinceLastEvent = now - lastAuthEventTime;
    lastAuthEventTime = now;
    
    if (window.debugConfig?.logAuthEvents) {
        console.log(`🔐 Auth event [${authEventCount}]: ${event}`, {
            user: session?.user?.email || 'no-user',
            timeSinceLast: `${timeSinceLastEvent}ms`,
            queueLength: authEventQueue.length
        });
    }
    
    try {
        // 🔥 LIMITADOR DE EVENTOS: Si hay demasiados eventos rápido, ignorar
        if (authEventCount > 5 && timeSinceLastEvent < 1000) {
            console.warn('⚠️ Demasiados eventos auth rápidos, ignorando...');
            window.diagnostics.authEventCount++;
            return;
        }
        
        switch (event) {
			case 'INITIAL_SESSION':
				if (session?.user) {
					await manejarSesionIniciada(session, event);
				} else {
					await manejarSesionCerrada();
				}
				break;

			case 'SIGNED_IN':
				await manejarSesionIniciada(session, event);
				break;
                
            case 'SIGNED_OUT':
                await manejarSesionCerrada();
                break;
                
            case 'TOKEN_REFRESHED':
            case 'USER_UPDATED':
                // Ignorar silenciosamente
                if (window.debugConfig?.logAuthEvents) {
                    console.log(`🔐 ${event} - Ignorado (sin acción)`);
                }
                break;
                
            default:
                console.log(`🔐 Evento auth no manejado: ${event}`);
        }
        
        // Actualizar estado global
        authInitialized = true;
        window.currentUser = session?.user || null;
        
    } catch (error) {
        console.error(`❌ Error procesando evento auth ${event}:`, error);
        window.showToast?.('Error en autenticación', 'error');
    } finally {
        authProcessing = false;
        
        // Procesar cola si hay eventos pendientes
        if (authEventQueue.length > 0 && !isProcessingAuthQueue) {
            isProcessingAuthQueue = true;
            setTimeout(() => {
                const nextEvent = authEventQueue.shift();
                if (nextEvent) {
                    procesarEventoAuth(nextEvent.event, nextEvent.session);
                }
                isProcessingAuthQueue = false;
            }, 500); // Delay entre eventos en cola
        }
        
        // Resetear contador después de 10 segundos de inactividad
        setTimeout(() => {
            if (authEventCount > 0 && (Date.now() - lastAuthEventTime) > 10000) {
                authEventCount = 0;
                console.log('🔄 Contador auth reseteado (inactividad)');
            }
        }, 10000);
    }
}

// 🔥 NUEVO: Función para manejar sesión iniciada
export async function setUILoginState(isLoggedIn, user = null) {
    // 🔥 NUEVO: Contador de actualizaciones UI
	if (window.diagnostics) {
		window.diagnostics.uiUpdateCount = (window.diagnostics.uiUpdateCount || 0) + 1;
	}
    
    console.log('🎨 setUILoginState llamado:', {
        loggedIn: isLoggedIn,
        user: user?.email || 'no-user',
        updateCount: window.diagnostics.uiUpdateCount
    });
    
    // 🔥 PREVENIR LLAMADAS MÚLTIPLES AL MISMO ESTADO
    if (window.lastUILoginState === isLoggedIn && 
        window.lastUILoginUser === (user?.email || 'no-user')) {
        console.log('⏭️ Saltando - mismo estado UI ya establecido');
        return;
    }
    
if (isLoggedIn && (!supabaseInstance || !supabaseInstance.auth)) {
    console.error('❌ setUILoginState: Supabase no disponible pero isLoggedIn=true');
    window.showToast?.('Error de configuración', 'error');
    return;
}

    
    // Actualizar referencia
    window.lastUILoginState = isLoggedIn;
    window.lastUILoginUser = user?.email || 'no-user';
    
    // 🔥 USAR safeDomOperation para evitar disparar observadores
    await safeDomOperation(() => {
        // 1. OCULTAR LOADING SIEMPRE
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.style.display = 'none';
            loading.classList.add('hidden');
            console.log('✅ Loading ocultado');
        }
        
        // 🔥 ELEMENTOS CLAVE DE TU HTML
        const noDataMessage = document.getElementById('noDataMessage');    // Contiene el botón de login
        const navigationPanel = document.getElementById('navigationPanel'); // Panel de navegación
        const signOutBtn = document.getElementById('signOutBtn');
        const userInfo = document.getElementById('userInfo');
        const appButtons = document.getElementById('appButtons');
        
        // Verificar que existen antes de manipular
        if (isLoggedIn) {
            if (!navigationPanel) console.warn('⚠️ Elemento crítico no encontrado: navigationPanel');
        } else {
            if (!noDataMessage) console.warn('⚠️ Elemento crítico no encontrado: noDataMessage');
        }
        
        // 2. SI ESTÁ LOGUEADO
        if (isLoggedIn && user) {
            console.log('👤 Mostrando UI para usuario:', user.email);
            
            // 🔥 OCULTAR mensaje "no data" (que contiene el botón de login)
            if (noDataMessage) {
                noDataMessage.classList.add('hidden');
                console.log('✅ noDataMessage ocultado');
            }
            
            // 🔥 MOSTRAR panel de navegación
            if (navigationPanel) {
                navigationPanel.classList.remove('hidden');
                console.log('✅ navigationPanel mostrado');
            }
            
            // Mostrar botón de logout
            if (signOutBtn) {
                signOutBtn.classList.remove('hidden');
            }
            
            // Mostrar info usuario
            if (userInfo) {
                userInfo.classList.remove('hidden');
                
                // Actualizar email
                const userEmail = document.getElementById('userEmail');
                if (userEmail) userEmail.textContent = user.email;
                
                // Actualizar rol
                const userRole = document.getElementById('userRole');
                if (userRole) {
                    const esAdmin = ADMIN_EMAILS.includes(user.email);
                    userRole.textContent = esAdmin ? 'Admin' : 'Irakaslea';
                    userRole.className = esAdmin ? 
                        'text-xs bg-red-500 px-2 py-1 rounded text-white' : 
                        'text-xs bg-green-500 px-2 py-1 rounded text-white';
                }
            }
            
            // Mostrar botones de app si existen
            if (appButtons) {
                appButtons.classList.remove('hidden');
                appButtons.style.display = 'flex';
                console.log('✅ appButtons mostrado');
                
                // Añadir botón de forzar recarga si está configurado
                if (window.debugConfig?.enableForceReloadBtn && !document.getElementById('forceReloadBtn')) {
                    const forceBtn = document.createElement('button');
                    forceBtn.id = 'forceReloadBtn';
                    forceBtn.className = 'bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded flex items-center text-sm btn ml-2';
                    forceBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Forzar Recarga';
                    forceBtn.onclick = window.forceReloadCurriculumData;
                    forceBtn.title = 'Recargar datos desde servidor (ignorar caché)';
                    appButtons.appendChild(forceBtn);
                    console.log('✅ Botón "Forzar Recarga" añadido');
                }
            }
            
            // Mostrar botones admin si corresponde
            const esAdmin = ADMIN_EMAILS.includes(user.email);
            const downloadBtn = document.getElementById('downloadBackupBtn');
            const uploadBtn = document.getElementById('uploadJsonBtn');
            
            if (downloadBtn) downloadBtn.classList.toggle('hidden', !esAdmin);
            if (uploadBtn) uploadBtn.classList.toggle('hidden', !esAdmin);
            
        } else {
            // 3. SI NO ESTÁ LOGUEADO
            console.log('👤 Ocultando UI - no logueado');
            
            // 🔥 MOSTRAR mensaje "no data" (que contiene el botón de login)
            if (noDataMessage) {
                noDataMessage.classList.remove('hidden');
                console.log('✅ noDataMessage mostrado');
                
                // 🔥 CONFIGURAR EL BOTÓN DE LOGIN DENTRO DE noDataMessage
                setTimeout(() => {
                    const loginBtn = noDataMessage.querySelector('button');
                    if (loginBtn) {
                        console.log('✅ Botón encontrado dentro de noDataMessage');
                        
                        // Clonar para limpiar listeners antiguos
                        const newBtn = loginBtn.cloneNode(true);
                        loginBtn.parentNode.replaceChild(newBtn, loginBtn);
                        
                        // Asegurar visibilidad
                        newBtn.style.display = 'flex';
                        newBtn.style.visibility = 'visible';
                        newBtn.style.opacity = '1';
                        newBtn.classList.remove('hidden');
                        
                        // Añadir nuevo listener
                        newBtn.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            console.log('✅ Click en botón login de noDataMessage');
                            
                            // Deshabilitar temporalmente para evitar múltiples clics
                            this.disabled = true;
                            this.style.opacity = '0.7';
                            
                            // Ejecutar login
                            window.signInWithGoogle().finally(() => {
                                // Rehabilitar después de 2 segundos
                                setTimeout(() => {
                                    this.disabled = false;
                                    this.style.opacity = '1';
                                }, 2000);
                            });
                        }, { once: false });
                        
                        console.log('✅ Botón de login configurado en noDataMessage');
                    } else {
                        console.warn('⚠️ No se encontró botón dentro de noDataMessage');
                    }
                }, 100);
            }
            
            // 🔥 OCULTAR panel de navegación
            if (navigationPanel) {
                navigationPanel.classList.add('hidden');
                console.log('✅ navigationPanel ocultado');
            }
            
            // Ocultar botón de logout
            if (signOutBtn) {
                signOutBtn.classList.add('hidden');
            }
            
            // Ocultar info usuario
            if (userInfo) {
                userInfo.classList.add('hidden');
            }
            
            // Ocultar botones de app
            if (appButtons) {
                appButtons.classList.add('hidden');
            }
            
            // Remover botón de forzar recarga si existe
            const forceBtn = document.getElementById('forceReloadBtn');
            if (forceBtn && forceBtn.parentNode) {
                forceBtn.parentNode.removeChild(forceBtn);
            }
        }
    });
    
    console.log('✅ setUILoginState completado');
}

// 2. Hacerla global
////window.setUILoginState = setUILoginState;

export async function manejarSesionIniciada(session, eventType) {
	
    if (!session?.user) {
        console.warn('⚠️ Sesión sin usuario en', eventType);
        return;
    }
    
    const user = session.user;
    console.log(`✅ ${eventType === 'INITIAL_SESSION' ? 'Sesión existente' : 'Nueva sesión'}:`, user.email);
    
    // Verificar dominio permitido
    if (!isValidEmail(user.email)) {
        console.warn(`⚠️ Usuario con dominio no permitido: ${user.email}`);
        window.showToast?.('Dominio de email no permitido', 'error');
        await supabase.auth.signOut();
        return;
    }
    
    // Actualizar UI
    await setUILoginState(true, user);
    
    // 🔥 CRÍTICO: Invalidar caché y forzar recarga de datos
    invalidarCache();
    window.curriculumData = {};
    
    // Esperar un momento para que la UI se actualice
    await new Promise(resolve => setTimeout(resolve, 500));
    
	// Cargar datos SOLO cuando el usuario inicia sesión, no en INITIAL_SESSION
	if (eventType === 'SIGNED_IN' && typeof loadCurriculumData === 'function') {
		setTimeout(() => {
			loadCurriculumData(true);
		}, 200);
	}

    
    // Actualizar contador
    window.diagnostics.authEventCount++;
    
    if (eventType === 'SIGNED_IN') {
        window.showToast?.('✅ Sesión iniciada correctamente', 'success');
    }
}

// 🔥 NUEVO: Función para manejar sesión cerrada
export async function manejarSesionCerrada() {
    console.log('🚪 Sesión cerrada');
    
    // Limpiar estado global
    window.currentUser = null;
    window.curriculumData = {};
    invalidarCache();
    
    // Resetear selecciones
    window.selectedDegree = null;
    window.selectedYear = null;
    window.selectedSubjectIndex = -1;
    
    // Actualizar UI
    await setUILoginState(false);
    
    // Limpiar UI
    if (typeof resetEditor === 'function') {
        resetEditor();
    }
    
    // Actualizar contador
    window.diagnostics.authEventCount++;
    
    window.showToast?.('Sesión cerrada', 'normal');
}


export function setSupabaseInstance(instance) {
    supabaseInstance = instance;
}

// ✅ NUEVO CÓDIGO (con protección):
let authHandlerInitialized = false;

export function setupAuthHandler() {

    if (authHandlerInitialized) {
        console.log('🔐 Handler ya inicializado, omitiendo...');
        return;
    }

    if (!supabaseInstance?.auth) {
        console.warn('⚠️ Supabase no disponible para auth handler, reintentando...');
        setTimeout(() => setupAuthHandler(), 500);
        return;
    }

    console.log('🔐 Configurando handler de autenticación...');
    authHandlerInitialized = true;

    supabaseInstance.auth.onAuthStateChange(async (event, session) => {
        await procesarEventoAuth(event, session);
    });
}


export async function signInWithGoogle() {
    console.log('🔐 Iniciando sesión con Google...');
    
    if (!supabaseInstance) {
        console.error("❌ Supabase no inicializado en utils.js");
        return;
    }

    return supabaseInstance.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.REDIRECT_URI }
    });
}
	

export async function signOut () {
    try {
        // 1. Confirmar con el usuario
        if (!confirm('¿Seguro que quieres cerrar sesión?\n\nPara volver a entrar necesitarás iniciar sesión con Google nuevamente.')) {
            return;
        }
        
        console.log('🚪 Iniciando proceso de cierre de sesión...');
        
        // 2. Mostrar indicador de carga
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.classList.remove('hidden');
            document.getElementById('loadingText').textContent = 'Cerrando sesión...';
        }
        
        // 3. Invalidar caché ANTES de cerrar sesión
        invalidarCache();
        window.curriculumData = {};
        
        // 4. Limpiar solo datos específicos de la app (no todo localStorage)
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes('curriculum') || key.includes('matrix') || 
                key.includes('supabase') && !key.includes('supabase.auth.token')) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`🗑️ Eliminado: ${key}`);
        });
        
        // 5. Cerrar sesión en Supabase
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        console.log('✅ Sesión cerrada en Supabase');
        
        // 6. Redirigir con parámetro anti-cache
        const cleanUrl = window.location.origin + window.location.pathname;
        const timestamp = new Date().getTime();
        const redirectUrl = `${cleanUrl}?logout=true&_=${timestamp}`;
        
        console.log(`🔄 Redirigiendo a: ${redirectUrl}`);
        
        // 7. Redirigir inmediatamente
        window.location.href = redirectUrl;
        
    } catch (error) {
        console.error('❌ Error cerrando sesión:', error);
        
        // Mostrar error
        window.showToast('❌ Error al cerrar sesión. Intenta recargar la página.', 'error');
        
        // Ocultar loading
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.classList.add('hidden');
        }
        
        // Intentar recargar como fallback
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
};

// Helper functions
export function isValidEmail(email) {
    return email.endsWith('@idarte.eus');
}

// 🔥 13.10. FUNCIÓN PARA VERIFICAR ADMIN
export function isAdmin(user) {
    if (!user || !user.email) return false;
    
    const ADMIN_EMAILS = ['josuayerbe@idarte.eus']; // Añade más si es necesario
    const ALLOWED_DOMAINS = ['idarte.eus', 'admin.eus']; // Añade dominios admin
    
    return ADMIN_EMAILS.includes(user.email) || 
           ALLOWED_DOMAINS.some(domain => user.email.endsWith(`@${domain}`)) ||
           user.email.includes('admin') ||
           user.user_metadata?.role === 'admin';
}



//======================================
//4. FUNCIONES DE NORMALIZACIÓN DE DATOS
//======================================

// Versión SIMPLE que no corrompe datos
export function normalizeData(data) {
    console.log('🔄 Normalizando estructura de datos (v3 - CORREGIDA)...');

    // ============================================================
    // 0. DETECTAR FORMATO "GRADUAK" - VERSIÓN CORREGIDA
    // ============================================================
    if (Array.isArray(data.graduak)) {
        console.log(`📦 Detectado formato 'graduak' (${data.graduak.length} grados) → convirtiendo...`);

        const convertido = {};
        const codigosUsados = new Set();
        const gradosProcesados = [];

        for (const [index, grado] of data.graduak.entries()) {
            // 0.1. OBTENER CÓDIGO ÚNICO (CORRECCIÓN CRÍTICA)
            let codigo = grado.codigo || grado.id;
            
            // Si no hay código/id válido, generar uno único basado en el nombre
            if (!codigo || codigo === "GRADO_SIN_CODIGO") {
                if (grado.selectedDegree) {
                    // Extraer siglas del nombre completo
                    const palabras = grado.selectedDegree.split(' ')
                        .filter(palabra => palabra.length > 2)
                        .map(palabra => palabra.substring(0, 3).toUpperCase());
                    
                    codigo = palabras.join('').substring(0, 8) || `G${index + 1}`;
                } else {
                    codigo = `G${index + 1}`;
                }
            }
            
            // 0.2. ASEGURAR UNICIDAD DEL CÓDIGO
            let codigoFinal = codigo;
            let contador = 1;
            while (codigosUsados.has(codigoFinal)) {
                codigoFinal = `${codigo}_${contador}`;
                contador++;
            }
            codigosUsados.add(codigoFinal);
            
            // 0.3. PRESERVAR METADATOS DEL GRADO (CORRECCIÓN CLAVE)
            convertido[codigoFinal] = {
                ...grado.year, // años 1,2,3,4
                kompetentziak_ingreso: grado.konpetentziak?.sarrera || [],
                kompetentziak_egreso: grado.konpetentziak?.irteera || [],
                matrices: grado.matrices || {},
                // METADATOS CRÍTICOS PARA LA UI
                _metadata: {
                    izena: grado.selectedDegree || `Grado ${index + 1}`, // ← USA selectedDegree COMO izena
                    selectedDegree: grado.selectedDegree,
                    nombreOriginal: grado.selectedDegree || `Grado ${index + 1}`,
                    codigoOriginal: grado.codigo,
                    idOriginal: grado.id,
                    indexOriginal: index,
                    tieneIzenaOriginal: !!grado.izena,
                    tieneSelectedDegree: !!grado.selectedDegree,
                    conversionTimestamp: new Date().toISOString()
                }
            };
            
            gradosProcesados.push({
                codigo: codigoFinal,
                nombre: grado.selectedDegree || `Grado ${index + 1}`,
                años: Object.keys(grado.year || {}).length
            });
        }
        
        // LOG DETALLADO DE LA CONVERSIÓN
        console.log(`🎯 Conversión completada: ${data.graduak.length} grados → ${Object.keys(convertido).length} claves únicas`);
        gradosProcesados.forEach((g, i) => {
            console.log(`  ${i}. ${g.codigo}: "${g.nombre}" (${g.años} años)`);
        });
        
        data = convertido;
    }

    // ============================================================
    // 1. CREAR COPIA PROFUNDA PRESERVANDO ESTRUCTURA
    // ============================================================
    const normalized = JSON.parse(JSON.stringify(data));

    // ============================================================
    // 2. ASEGURAR ESTRUCTURA DE COMPETENCIAS Y METADATOS GLOBALES
    // ============================================================
    if (!normalized.kompetentziak_ingreso) normalized.kompetentziak_ingreso = [];
    if (!normalized.kompetentziak_egreso) normalized.kompetentziak_egreso = [];
    
    // METADATOS GLOBALES PARA DIAGNÓSTICO
    if (!normalized._metadata) normalized._metadata = {};
    normalized._metadata.normalizationVersion = "3.0-corregida";
    normalized._metadata.normalizedAt = new Date().toISOString();
    normalized._metadata.source = data.graduak ? "formato-graduak" : "formato-interno";

    // ============================================================
    // 3. NORMALIZAR GRADOS Y ASIGNATURAS (MANTENIENDO METADATOS)
    // ============================================================
    let totalGrados = 0;
    let totalAsignaturas = 0;

    for (const gradoKey in normalized) {
        // Saltar propiedades de sistema
        if (gradoKey === 'kompetentziak_ingreso' || 
            gradoKey === 'kompetentziak_egreso' || 
            gradoKey === 'proyectosExternos' ||
            gradoKey === '_metadata') continue;
        
        totalGrados++;
        const gradoData = normalized[gradoKey];
        
        // Asegurar que cada grado tenga _metadata
        if (!gradoData._metadata) {
            gradoData._metadata = {
                izena: gradoKey,
                codigoAsignado: gradoKey,
                faltaMetadataOriginal: true
            };
        }
        
        // Normalizar asignaturas por año
        for (const curso in gradoData) {
            if (curso === 'kompetentziak_ingreso' || 
                curso === 'kompetentziak_egreso' || 
                curso === 'matrices' ||
                curso === '_metadata') continue;
            
            if (Array.isArray(gradoData[curso])) {
                const asignaturas = gradoData[curso];
                totalAsignaturas += asignaturas.length;
                
				asignaturas.forEach(subject => {
                    // 1. ID ziurtatu
                    if (!subject.id) subject.id = crypto.randomUUID();

                    // 2. 🔥 KONPONKETA: DATUAK PRESERBATU (Supabase -> Local)
                    // RAk (Ikaskuntza Emaitzak)
                    subject.ra = subject.ra || subject.learning_outcomes || subject.learningOutcomes || subject.emaitzak || [];
                    // Bateragarritasunerako aliasak
                    subject.learningOutcomes = subject.ra;

                    // Unitate Didaktikoak (Temarioa)
                    subject.unitateak = subject.unitateak || subject.training_units || subject.trainingUnits || subject.temario || [];
                    subject.trainingUnits = subject.unitateak;

                    // Zeharkako Konpetentziak
                    subject.zeharkakoak = subject.zeharkakoak || subject.transversal_competences || subject.transversalCompetences || [];
                    subject.transversalCompetences = subject.zeharkakoak;

                    // 3. Array hutsak ziurtatu (Null saihesteko)
                    if (!Array.isArray(subject.ra)) subject.ra = [];
                    if (!Array.isArray(subject.unitateak)) subject.unitateak = [];
                    if (!Array.isArray(subject.zeharkakoak)) subject.zeharkakoak = [];

                    // 4. Eremu zaharrak (Legacy)
                    if (!Array.isArray(subject.currentOfficialRAs)) subject.currentOfficialRAs = [];
                    if (!Array.isArray(subject.zhRAs)) subject.zhRAs = [];
                    if (!Array.isArray(subject.AEmin)) subject.AEmin = [];

                    // 5. Zenbakizkoak eta Testuak normalizatu
                    if (typeof subject.kredituak !== 'number') {
                        subject.kredituak = subject.kredituak ? parseFloat(subject.kredituak) : 6;
                    }

                    // Izenak eta Kodeak ziurtatu
                    if (!subject.izena) subject.izena = subject.subjectTitle || subject.title || 'Izenik gabe';
                    if (!subject.kodea) subject.kodea = subject.subjectCode || subject.code || '---';

                    if (!subject.arloa && subject.eremua) subject.arloa = subject.eremua;
                    if (!subject.mota) subject.mota = subject.type || "Zehaztugabea";
                    
                    // 6. Metadatuak
                    if (!subject._metadata) subject._metadata = {};
                    subject._metadata.normalized = true;
                    subject._metadata.grado = gradoKey;
                    subject._metadata.curso = curso;
                });
            }
        }
    }

    // ============================================================
    // 4. ESTADÍSTICAS DETALLADAS
    // ============================================================
    let totalZhRAs = 0;
    let totalAEmin = 0;
    const eremuak = new Set();

    for (const gradoKey in normalized) {
        if (gradoKey === 'kompetentziak_ingreso' || 
            gradoKey === 'kompetentziak_egreso' || 
            gradoKey === 'proyectosExternos' ||
            gradoKey === '_metadata') continue;
        
        const gradoData = normalized[gradoKey];
        
        for (const curso in gradoData) {
            if (!Array.isArray(gradoData[curso])) continue;
            
            gradoData[curso].forEach(subject => {
                totalZhRAs += subject.zhRAs?.length || 0;
                totalAEmin += subject.AEmin?.length || 0;
                
                // Recolectar eremuak
                if (subject.eremua) {
                    if (Array.isArray(subject.eremua)) {
                        subject.eremua.forEach(e => eremuak.add(e));
                    } else {
                        eremuak.add(subject.eremua);
                    }
                }
                if (subject.arloa) eremuak.add(subject.arloa);
            });
        }
    }
    
    // Añadir estadísticas a metadata global
    normalized._metadata.estadisticas = {
        grados: totalGrados,
        asignaturas: totalAsignaturas,
        zhRAs: totalZhRAs,
        AEmin: totalAEmin,
        eremuak: Array.from(eremuak).length,
        gradosProcesados: Object.keys(normalized).filter(k => 
            !['kompetentziak_ingreso', 'kompetentziak_egreso', 'proyectosExternos', '_metadata'].includes(k)
        )
    };

    console.log("✅ Normalización V3 completada");
    console.log(`📊 Estadísticas:`);
    console.log(`   • Grados: ${totalGrados}`);
    console.log(`   • Asignaturas: ${totalAsignaturas}`);
    console.log(`   • ZhRAs: ${totalZhRAs}`);
    console.log(`   • AEmin: ${totalAEmin}`);
    console.log(`   • Eremuak: ${Array.from(eremuak).length}`);
    console.log(`   • Claves únicas: ${Object.keys(normalized).filter(k => 
        !['kompetentziak_ingreso', 'kompetentziak_egreso', 'proyectosExternos', '_metadata'].includes(k)
    ).join(', ')}`);

    // ============================================================
    // 5. CREAR ARRAY 'GRADUAK' COMPATIBLE PARA UI (OPCIONAL)
    // ============================================================
    // Algunas partes de la UI pueden esperar un array 'graduak'
    if (!normalized.graduak && totalGrados > 0) {
        normalized.graduak = [];
        
        for (const gradoKey in normalized) {
            if (gradoKey === 'kompetentziak_ingreso' || 
                gradoKey === 'kompetentziak_egreso' || 
                gradoKey === 'proyectosExternos' ||
                gradoKey === '_metadata') continue;
            
            const gradoData = normalized[gradoKey];
            const metadata = gradoData._metadata || {};
            
            normalized.graduak.push({
                id: gradoKey,
                codigo: gradoKey,
                izena: metadata.izena || gradoKey,
                selectedDegree: metadata.selectedDegree || metadata.izena || gradoKey,
                year: gradoData,
                _metadata: metadata
            });
        }
        
        console.log(`📦 Array 'graduak' creado con ${normalized.graduak.length} elementos para compatibilidad`);
    }

    return normalized;
}
//======================================
//5. FUNCIONES DE EXTRACCIÓN DE DATOS
//======================================

// 🔥 9.1. EXTRAER EREMUAK DEL CURRICULUM
//export async function extraerEremuakDelCurriculum() {
//    console.log('🔍 Extrayendo eremuak del curriculum...');
    
//    if (!window.curriculumData) {
//        console.error('❌ No hay curriculumData para extraer eremuak');
//        return [];
//    }
    
//    const eremuakSet = new Set();
    
    // Recorrer todos los grados
//    Object.values(window.curriculumData).forEach(grado => {
        // Saltar si no es un objeto de grado
//        if (typeof grado !== 'object' || Array.isArray(grado)) {
//            return;
//        }
        
        // Recorrer cursos del grado
//        Object.values(grado).forEach(curso => {
//           if (Array.isArray(curso)) {
//                curso.forEach(asignatura => {
//                    // Buscar en campo 'arloa'
//                    if (asignatura.arloa && asignatura.arloa.trim() !== '') {
//                        eremuakSet.add(asignatura.arloa.trim());
//                    }
                    
                    // Buscar en campo 'eremua' (compatibilidad)
//                    if (asignatura.eremua && asignatura.eremua.trim() !== '') {
//                        eremuakSet.add(asignatura.eremua.trim());
//                    }
//                });
//            }
//        });
//    });
    
//    const listaEremuak = Array.from(eremuakSet).sort();
//    console.log(`📊 ${listaEremuak.length} eremuak encontrados:`, listaEremuak);
    
//    return listaEremuak;
//};
// Reemplazar la función mal configurada
// En utils.js

export function extraerEremuakDelCurriculum() {
    // 1. Validación inicial
    if (!window.curriculumData) {
        console.warn("⚠️ extraerEremuak: No hay curriculumData");
        return [];
    }

    const data = window.curriculumData;
    // Soporte híbrido: Array (Supabase) vs Objeto (Legacy)
    const listaGraduak = Array.isArray(data.graduak) 
        ? data.graduak 
        : (data.grados ? Object.values(data.grados) : []);

    const eremuakSet = new Set();

    // 2. Recorremos Grados
    listaGraduak.forEach(grado => {
        const yearsObj = grado.year || grado.years; // Soporte singular/plural
        
        if (!yearsObj) return;

        // 3. Recorremos Años
        Object.values(yearsObj).forEach(yearData => {
            
            // --- CORRECCIÓN CRÍTICA ---
            // Determinamos si yearData es ya el array o contiene .subjects
            let asignaturas = [];
            
            if (Array.isArray(yearData)) {
                asignaturas = yearData;
            } else if (yearData && Array.isArray(yearData.subjects)) {
                asignaturas = yearData.subjects;
            }

            // 4. Recorremos Asignaturas (solo si es array válido)
            if (Array.isArray(asignaturas)) {
                asignaturas.forEach(asig => {
                    // Buscamos subjectArea o arloa
                    const area = asig.subjectArea || asig.arloa;
                    if (area) {
                        eremuakSet.add(area);
                    }
                });
            }
        });
    });

    const resultado = Array.from(eremuakSet).sort();
    console.log(`✅ Eremuak extraídos (${resultado.length}):`, resultado);
    return resultado;
}


//======================================================
//6. FUNCIONES DE CACHÉ (CRÍTICAS - mantener en utils)
//======================================================

// 🔥 NUEVA: Verificar validez del caché
export async function isCacheValido() {
    if (!window.dataCache || !window.dataCache.data || !window.dataCache.timestamp) {
        return false;
    }
    
    const now = Date.now();
    const age = now - window.dataCache.timestamp;
    const esValido = age < window.dataCache.maxAge && !window.dataCache.forceRefresh;
    
    if (window.debugConfig?.logCacheHits) {
        console.log(`♻️ Caché: ${esValido ? 'VÁLIDO' : 'EXPIRADO'} (edad: ${Math.round(age/1000)}s)`);
    }
    
    return esValido;
}

// 🔥 NUEVA: Actualizar caché
export async function actualizarCache(data, userEmail = null) {
    if (window.dataCache) {
        window.dataCache.data = data;
        window.dataCache.timestamp = Date.now();
        window.dataCache.forceRefresh = false;
        window.dataCache.lastUpdateBy = userEmail;
        
        if (window.debugConfig?.logCacheHits) {
            console.log(`💾 Caché actualizado por: ${userEmail || 'sistema'}`);
        }
        
        window.diagnostics.dataLoadCount++;
    }
}

export async function invalidarCache() {
    if (window.dataCache) {
        window.dataCache.data = null;
        window.dataCache.timestamp = 0;
        window.dataCache.forceRefresh = true;
        console.log('🗑️ Caché invalidado');
        window.diagnostics.cacheMissCount++;
    }
}

//===================================
//7. FUNCIONES DE DIAGNÓSTICO Y DEBUG
//===================================

// Debug de estado de la app (YA existe en app.js línea ~492)
export async function debugAppState() {
    console.group('🔍 DEBUG - ESTADO DE LA APLICACIÓN');
    
    // Estado de autenticación
    console.log('🔐 AUTENTICACIÓN:', {
        usuario: window.currentUser?.email || 'No autenticado',
        esAdmin: window.currentUser ? ADMIN_EMAILS.includes(window.currentUser.email) : false,
        eventosAuth: window.diagnostics?.authEventCount || 0,
        lastUILoginState: window.lastUILoginState,
        lastUILoginUser: window.lastUILoginUser
    });
    
    // Estado de datos
    console.log('💾 DATOS:', {
        curriculumData: window.curriculumData ? 'Cargado' : 'Vacío',
        grados: window.curriculumData ? Object.keys(window.curriculumData)
            .filter(k => !k.includes('kompetentziak') && k !== '_metadata' && k !== 'matrices')
            .length : 0,
        seleccionado: {
            grado: window.selectedDegree,
            año: window.selectedYear,
            asignatura: window.selectedSubjectIndex
        }
    });
    
    // Estado de caché
    console.log('♻️ CACHÉ:', {
        tieneDatos: !!window.dataCache?.data,
        timestamp: window.dataCache?.timestamp ? 
            new Date(window.dataCache.timestamp).toLocaleTimeString() : 'Nunca',
        edad: window.dataCache?.timestamp ? 
            Math.round((Date.now() - window.dataCache.timestamp) / 1000) + 's' : 'N/A',
        maxAge: window.dataCache?.maxAge ? window.dataCache.maxAge / 1000 + 's' : 'N/A',
        hits: window.diagnostics?.cacheHitCount || 0,
        misses: window.diagnostics?.cacheMissCount || 0
    });
    
    // Estado de UI
    console.log('🎨 UI:', {
        updates: window.diagnostics?.uiUpdateCount || 0,
        dataLoads: window.diagnostics?.dataLoadCount || 0
    });
    
    // Estado de observadores
    console.log('👁️ OBSERVADORES:', {
        mutationObserver: window._safeMutationObserver ? 'Activo' : 'Inactivo',
        totalObservers: window._safeObservers?.length || 0,
        degreeSelect: document.getElementById('degreeSelect') ? 'Existe' : 'No existe'
    });
    
    console.groupEnd();
    
    // Devolver resumen para usar programáticamente
    return {
        autenticado: !!window.currentUser,
        datosCargados: !!window.curriculumData,
        cacheValido: window.dataCache?.data && 
                    (Date.now() - window.dataCache.timestamp) < window.dataCache.maxAge,
        gradoSeleccionado: window.selectedDegree,
        observadorActivo: !!window._safeMutationObserver
    };
}

// Verificar elementos HTML (YA existe en app.js línea ~511)
export async function verificarElementosHTML() {
    const criticalElements = [
        'loadingOverlay', 'signInBtn', 'signOutBtn', 'userInfo',
        'userEmail', 'userRole', 'appButtons', 'saveBtn',
        'degreeSelect', 'sectionButtons', 'subjectList',
        'noDataMessage', 'navigationPanel', 'welcomeEditor',
        'editorPanel', 'subjectTitle', 'subjectType', 'subjectCredits',
        'subjectNameEdit', 'subjectArea', 'subjectCreditsEdit',
        'subjectRAs', 'subjectAEmin','subjectZhRAs', 'unitName', 'unitContent', 'addUnitBtn',
        'noUnitsMessage', 'unitsContainer', 'competenciasPanel',
        'competenciasBadge', 'competenciasTitle', 'competenciasDescription',
        'competenciasCount', 'volverAGradosBtn', 'competenciasContainer',
        'añadirCompetenciaBtn', 'exportarCompetenciasBtn', 'guardarCompetenciasBtn',
        'toast', 'jsonFileInput', 'downloadBackupBtn', 'uploadJsonBtn'
    ];
    
    console.group('🔍 VERIFICACIÓN ELEMENTOS HTML');
    
    const resultados = {
        encontrados: 0,
        faltantes: []
    };
    
    criticalElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            resultados.encontrados++;
            console.log(`✅ #${id}`);
        } else {
            resultados.faltantes.push(id);
            console.warn(`❌ #${id} - NO ENCONTRADO`);
        }
    });
    
    console.log(`📊 Resumen: ${resultados.encontrados}/${criticalElements.length} elementos encontrados`);
    
    if (resultados.faltantes.length > 0) {
        console.warn(`⚠️ Faltan ${resultados.faltantes.length} elementos:`, resultados.faltantes);
    }
    
    console.groupEnd();
    return resultados;
}
// Resetear diagnósticos (YA existe en app.js línea ~549)
export async function resetDiagnostics() {
    if (window.diagnostics) {
        window.diagnostics = {
            authEventCount: 0,
            dataLoadCount: 0,
            cacheHitCount: 0,
            cacheMissCount: 0,
            uiUpdateCount: 0
        };
        console.log('📊 Diagnósticos reseteados');
    }
}
console.log('✅ utils.js cargado correctamente');

// EN UTILS.JS

export function verificarEstructuraDatos() {
    console.log('🔍 DATUEN EGITURA EGIAZTATZEN...');

    // Asumimos que curriculumData puede estar en state o window, 
    // pero para seguridad en utils, miramos window o pasamos el argumento.
    // Lo ideal sería pasar los datos como argumento: function(data)
    // Pero para mantener compatibilidad con tu código actual:
    const data = window.curriculumData; 

    if (!data) {
        console.log('⏿ Ez dago daturik egiaztatzeko (curriculumData is null)');
        return null;
    }
    
    // 1. Detectar estructura
    const listaGraduak = Array.isArray(data.graduak) ? data.graduak : (data.grados ? Object.values(data.grados) : []);

    // 2. Variables de conteo
    let totalAsignaturas = 0;
    let totalUnidades = 0;
    let totalRAs = 0;
    const eremuakSet = new Set();
    let tieneCompIngreso = false;
    let tieneCompEgreso = false;
    let tieneMatrices = false;

    // 3. Cálculos
    listaGraduak.forEach(grado => {
        if (grado.konpetentziak?.sarrera?.length > 0) tieneCompIngreso = true;
        if (grado.konpetentziak?.irteera?.length > 0) tieneCompEgreso = true;
        if (grado.matrices && Object.keys(grado.matrices).length > 0) tieneMatrices = true;

        const years = grado.year || grado.years || {};
        Object.values(years).forEach(yearList => {
            const asignaturas = Array.isArray(yearList) ? yearList : (yearList.subjects || []);
            asignaturas.forEach(asig => {
                totalAsignaturas++;
                if (asig.subjectArea) eremuakSet.add(asig.subjectArea);
                if (asig.unitateak) totalUnidades += asig.unitateak.length;
                const ras = asig.currentOfficialRAs || [];
                totalRAs += ras.length;
            });
        });
    });

    // 4. Construir resultado
    const estructura = {
        totalGrados: listaGraduak.length,
        grados: listaGraduak.map(g => g.codigo || '??'),
        tieneCompetenciasIngreso: tieneCompIngreso,
        tieneCompetenciasEgreso: tieneCompEgreso,
        tieneMatrices: tieneMatrices,
        totalAsignaturas: totalAsignaturas,
        totalUnidades: totalUnidades,
        totalRAs: totalRAs,
        eremuak: Array.from(eremuakSet)
    };

    const resultados = { resumen: estructura, errores: [], avisos: [] };

    // 5. Validaciones
    if (estructura.totalGrados === 0) resultados.errores.push('❿ Ez dago gradu definitua');
    if (!estructura.tieneCompetenciasIngreso) resultados.avisos.push('⚠️ kompetentziak ingreso falta');
    if (!estructura.tieneCompetenciasEgreso) resultados.avisos.push('⚠️ kompetentziak egreso falta');
    if (!estructura.tieneMatrices) resultados.avisos.push('⚠️ Matrices ANECA falta');

    // 6. Logs
    console.log('📊 EGITURA:', estructura);
    if (resultados.errores.length > 0) console.error('🚨', resultados.errores);
    else console.log('✿ Egitura OK');

    return resultados;
}

export function getSupabaseInstance() {
    return supabaseInstance;
}

window.signInWithGoogle = signInWithGoogle;
window.showToast = showToast;
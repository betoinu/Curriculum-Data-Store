
// curriculum.js - Operaciones con datos

import { state } from './state.js';
import { getSupabaseInstance, isValidEmail, isAdmin, actualizarCache, isCacheValido, invalidarCache, normalizeData, verificarEstructuraDatos } from './utils.js';

export async function loadCurriculumData(force = false) {
    
	console.log('📥 loadCurriculumData ejecutándose');

    const supabase = getSupabaseInstance();
    if (!supabase) {
        console.error("❌ SupabaseInstance aún no está listo");
        return null;
    }
    
    // 🔥 AGREGAR: Protección contra múltiples llamadas simultáneas
    if (window._isLoadingCurriculumData) {
        console.log('⏭️ Ya se está cargando, saltando...');
        return window.curriculumData || null;
    }
    window._isLoadingCurriculumData = true;
    
    // 🔥 INCREMENTAR CONTADOR DE DIAGNÓSTICO (PROTEGIDO)
    if (!window.diagnostics) {
        window.diagnostics = {};
    }
    window.diagnostics.dataLoadCount = (window.diagnostics.dataLoadCount || 0) + 1;
    
    // 🔥 1. VERIFICAR CACHÉ VÁLIDO (si no se fuerza recarga)
    if (!force && isCacheValido()) {  // ✅ CORRECCIÓN: force en lugar de forceRefresh
        console.log('♻️ Usando datos cacheados');
        window.curriculumData = window.dataCache.data;
        window.diagnostics.cacheHitCount++;
        
        // 🔥 AGREGAR: Asegurar que también esté en state
        if (window.state) {
            window.state.curriculumData = window.curriculumData;
        }
        
        // Inicializar UI si es necesario
        if (window.initializeUI && !window.selectedDegree) {
            setTimeout(() => window.initializeUI(), 100);
        }
        
        window._isLoadingCurriculumData = false;
        return window.curriculumData;
    }
    
    // 🔥 2. SI FORCE O CACHÉ NO VÁLIDO
    window.diagnostics.cacheMissCount++;
    
    try {
        console.log('📥 Datuak kargatzen...');
        
        const supabase = getSupabaseInstance();
		const { data: { user } } = await supabase.auth.getUser();

        
        // 🔥 VERIFICACIÓN DE USUARIO
        if (!user || !isValidEmail(user.email)) {
            console.log('⏭️ Usuario no autorizado para cargar datos');
            window._isLoadingCurriculumData = false;
            return null;
        }
        
// 🔥 3. CARGAR DESDE SUPABASE (Corregido)
        // Buscamos la fila activa o la más reciente
        let query = supabase
            .from('curriculum_data')
            .select('*');

        // Intentamos buscar primero el activo, si no, ordenamos por fecha
        // Nota: Si tienes filas marcadas como 'activo: true', descomenta la línea de abajo:
        // query = query.eq('activo', true); 
        
        const { data, error } = await query
            .order('last_updated', { ascending: false })
            .limit(1)
            .maybeSingle(); // Usa maybeSingle para no lanzar excepción si está vacío

        if (error) {
            console.warn("⚠️ Error en consulta Supabase:", error.message);
            // No hacemos throw aquí para permitir que el código fluya al fallback local
        }
        
        // 🔥 4. PROCESAR RESPUESTA (Lógica corregida: 'curriculum' -> 'datos')
        let datosValidos = null;

        if (data) {
            // A. La columna en tu DB se llama 'datos'. Verificamos si existe.
            if (data.datos) {
                // A veces el JSON se guarda como { "curriculum": {...} } y a veces directo.
                // Esta línea maneja ambos casos:
                datosValidos = data.datos.curriculum || data.datos;
            } 
            // B. Fallback por si acaso existe una columna legacy llamada 'curriculum'
            else if (data.curriculum) {
                datosValidos = data.curriculum;
            }
        }

        if (datosValidos) {
            console.log(`✅ Datos cargados desde Supabase (ID: ${data.id || 'desconocido'})`);
            
            // Marcar que NO estamos en modo fallback local
            window._isLocalFallback = false;

            // Normalizar datos
            const datosNormalizados = normalizeData(datosValidos);
            
            // 🔥 GUARDAR EN MÚLTIPLES UBICACIONES
            window.curriculumData = datosNormalizados;
            
            // 🔥 AGREGAR: Guardar también en state
            if (!window.state) window.state = {};
            window.state.curriculumData = datosNormalizados;
            
            // 🔥 AGREGAR: Backup en variable privada
            window._curriculumDataBackup = datosNormalizados;
            
            console.log(`📊 Datos procesados (${Object.keys(datosNormalizados).length} keys)`);
            
            // 🔥 ACTUALIZAR CACHÉ
            actualizarCache(datosNormalizados, user.email);
            
            // 🔥 INICIALIZAR MATRICES SI NO EXISTEN
            setTimeout(() => {
                if (window.inicializarSistemaMatrices && 
                    datosNormalizados && 
                    !datosNormalizados.matrices) {
                    window.inicializarSistemaMatrices();
                }
            }, 1000);
            
            // 🔥 VERIFICAR ESTRUCTURA
            setTimeout(() => {
				verificarEstructuraDatos();
			}, 800);
            
            // 🔥 ACTUALIZAR UI
            const noDataMsg = document.getElementById('noDataMessage');
            const navPanel = document.getElementById('navigationPanel');
            
            if (noDataMsg) noDataMsg.classList.add('hidden');
            if (navPanel) navPanel.classList.remove('hidden');
            
            if (typeof window.initializeUI === 'function') {
                window.initializeUI(datosNormalizados);
            } else if (typeof initializeUI === 'function') {
                initializeUI(datosNormalizados);
            }
            
            window.showToast?.('✅ Datuak kargatuak', 'success');
            
            window._isLoadingCurriculumData = false;
            return datosNormalizados;
            
        } else {
            // 🔥 5. FALLBACK A JSON LOCAL SI SUPABASE VACÍO
            console.log('📄 Supabase vacío, cargando JSON local...');
            const datosLocales = await loadLocalJsonData(true);
            
            if (datosLocales) {
                // 🔥 AGREGAR: Guardar en múltiples ubicaciones también
                window.curriculumData = datosLocales;
                if (!window.state) window.state = {};
                window.state.curriculumData = datosLocales;
                window._curriculumDataBackup = datosLocales;
            }
            
            window._isLoadingCurriculumData = false;
            return datosLocales;
        }
        
    } catch (error) {
        console.error('❌ Error cargando datos:', error);
        
        // 🔥 SIEMPRE devolver al menos datos de ejemplo
        console.log('🔄 Cargando datos de ejemplo como último recurso...');
        
        const ejemploData = {
            "Grado en Informática": {
                "1": [
                    { "nombre": "Programación I", "creditos": 6, "codigo": "PROG1" },
                    { "nombre": "Matemáticas I", "creditos": 6, "codigo": "MAT1" }
                ],
                "2": [
                    { "nombre": "Programación II", "creditos": 6, "codigo": "PROG2" },
                    { "nombre": "Bases de Datos", "creditos": 6, "codigo": "BD" }
                ]
            }
        };
        
        // 🔥 AGREGAR: Guardar ejemplo también en múltiples ubicaciones
        window.curriculumData = ejemploData;
        if (!window.state) window.state = {};
        window.state.curriculumData = ejemploData;
        window._curriculumDataBackup = ejemploData;
        
        window.showToast?.('⚠️ Datos de ejemplo cargados', 'warning');
        
        window._isLoadingCurriculumData = false;
        return ejemploData;  // ✅ Nunca retorna null
    } finally {
        // 🔥 AGREGAR: Asegurar que siempre se libera el lock
        setTimeout(() => {
            window._isLoadingCurriculumData = false;
        }, 1000);
    }
}

export async function saveCurriculumData() {
    
	if (window._isLocalFallback) {
    console.warn("⛔ Bloqueando guardado automático: Estamos en modo Fallback Local.");
    return; 
}
	
	console.log('💾 Guardando datos del curriculum...');
    
    // 🔥 1. VERIFICAR AUTENTICACIÓN
    const supabase = getSupabaseInstance();
	const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.showToast('❌ Debes iniciar sesión para guardar', 'error');
        return;
    }
    
    // 🔥 2. VERIFICAR DATOS
    if (!window.curriculumData) {
        window.showToast('❌ No hay datos para guardar', 'error');
        return;
    }
    
    try {
        // 🔥 3. MOSTRAR LOADING
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.classList.remove('hidden');
            document.getElementById('loadingText').textContent = 'Guardando datos...';
        }
        
        // 🔥 4. PREPARAR DATOS PARA GUARDAR
        const datosParaGuardar = {
            ...window.curriculumData,
            _metadata: {
                ultima_actualizacion: new Date().toISOString(),
                version: '2.0',
                usuario: user.email
            }
        };
        
        // 🔥 5. GUARDAR EN SUPABASE
		const { error } = await supabase
		  .from('curriculum_data')
		  .upsert({
			id: user.id,                     // clave primaria
			datos: datosParaGuardar,         // JSON completo
			last_updated: new Date().toISOString(),
			importado_por: user.email,       // si quieres registrar quién lo modificó
			metadata: {
			  role: isAdmin(user) ? 'admin' : 'teacher'
			}
		  });

        
        if (error) throw error;
        
        // 🔥 6. ACTUALIZAR CACHÉ CON LOS DATOS GUARDADOS
        actualizarCache(window.curriculumData, user.email);
        
        // 🔥 7. NOTIFICAR ÉXITO
        window.showToast('✅ Datos guardados correctamente', 'success');
        
        console.log('💾 Datos guardados por:', user.email);
        
    } catch (error) {
        console.error('❌ Error guardando datos:', error);
        window.showToast('❌ Error al guardar: ' + error.message, 'error');
        
    } finally {
        // 🔥 8. OCULTAR LOADING
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.classList.add('hidden');
        }
    }
}

export async function loadLocalJsonData(isInitialLoad = false) {
    console.log('📂 Cargando JSON local...');
    const supabase = getSupabaseInstance(); 
		if (!supabase) { console.error("❌ Supabase no disponible en loadLocalJsonData"); return null; }
		
    try {
        // 🔥 1. INTENTAR CARGAR DESDE RUTA PRINCIPAL
        let response = await fetch('curriculum_eguneratua.json');
        
        // 🔥 2. FALLBACK A RUTA CON /
        if (!response.ok) {
            response = await fetch('/curriculum_eguneratua.json');
        }
        
        if (!response.ok) {
            throw new Error('JSON no encontrado en ninguna ruta');
        }
        
        // 🔥 3. PROCESAR DATOS
        const parsedData = await response.json();
        
        // Normalizar y migrar
        // EVITAR la transformación destructiva
		if (parsedData.graduak && Array.isArray(parsedData.graduak)) {
			// Mantener la estructura original de graduak
			window.curriculumData = {
				...parsedData,
				graduak: parsedData.graduak // Mantener array de grados
			};
		} else {
			window.curriculumData = normalizeData(parsedData);
		}
        
        // 🔥 4. ACTUALIZAR CACHÉ
        const supabase = getSupabaseInstance();
		const { data: { user } } = await supabase.auth.getUser();

        actualizarCache(window.curriculumData, user?.email || 'local');
        
        // 🔥 5. INICIALIZAR MATRICES
        if (window.inicializarSistemaMatrices && 
            window.curriculumData && 
            !window.curriculumData.matrices) {
            window.inicializarSistemaMatrices();
        }
        
        // 🔥 6. ACTUALIZAR UI
        const loading = document.getElementById('loadingOverlay');
        if (loading) loading.classList.add('hidden');
        
		const noData = document.getElementById('noDataMessage');
		if (noData) noData.classList.add('hidden');

		const nav = document.getElementById('navigationPanel');
		if (nav) nav.classList.remove('hidden');

        
        // Resetear selecciones
        window.selectedDegree = null;
        window.selectedYear = null;
        window.selectedSubjectIndex = '-1 ';
        
        // Inicializar UI
        //if (window.initializeUI) {
        //    window.initializeUI();
        //}
        
        if (window.resetEditor) {
            window.resetEditor();
        }
        
        // 🔥 7. VERIFICAR MIGRACIÓN
        const tieneCompetencias = window.curriculumData.kompetentziak_ingreso !== undefined &&
                                  window.curriculumData.kompetentziak_egreso !== undefined;
        
        console.log('📊 JSON cargado:', {
            grados: Object.keys(window.curriculumData).filter(k => 
                !k.includes('kompetentziak') && 
                k !== '_metadata' && 
                k !== 'matrices').length,
            tieneCompetencias: tieneCompetencias,
            competenciasIngreso: window.curriculumData.kompetentziak_ingreso?.length || 0,
            competenciasEgreso: window.curriculumData.kompetentziak_egreso?.length || 0
        });
        
        // 🔥 8. MOSTRAR MENSAJE APROPIADO
        if (isInitialLoad) {
            const mensaje = tieneCompetencias 
                ? "✅ JSON migrado y cargado" 
                : "🔄 JSON antiguo migrado - Guarda la nueva versión";
            
            window.showToast(mensaje, "normal");
            
            // 🔥 9. GUARDAR EN SUPABASE SI HAY USUARIO
            setTimeout(async () => {
                try {
                    const supabase = getSupabaseInstance();
					const { data: { user } } = await supabase.auth.getUser();

                    if (user) {
                        await saveCurriculumData();
                        window.showToast("✅ Datos migrados y guardados en Supabase", "success");
                    }
                } catch (error) {
                    console.log("ℹ️ No se pudieron guardar datos (sin sesión activa)");
                }
            }, 2000);
        } else {
            window.showToast("✅ JSON datuak kargatu eta migratu dira", "success");
        }
        
        return window.curriculumData;
        
    } catch (error) {
        console.error("❌ Error cargando JSON:", error);
        window.showToast("❌ Error cargando JSON: " + error.message, "error");
        
        // Ocultar loading
        const loading = document.getElementById('loadingOverlay');
        if (loading) loading.classList.add('hidden');
        
        throw error;
    }
}

export async function downloadJsonData() {
    console.log('💾 Preparando descarga de JSON...');
    
    // 🔥 1. VERIFICAR PERMISOS ADMIN
    const supabase = getSupabaseInstance();
	const { data: { user } } = await supabase.auth.getUser();

    
    if (!user || !isAdmin(user)) {
        window.showToast('❌ Solo administradores pueden descargar', 'error');
        return;
    }
    
    // 🔥 2. VERIFICAR DATOS
    if (!window.curriculumData) {
        window.showToast('❌ No hay datos para descargar', 'error');
        return;
    }
    
    try {
        // 🔥 3. PREPARAR DATOS CON METADATOS
        const datosExportar = {
            ...window.curriculumData,
            _metadata: {
                version: "2.0",
                fecha_exportacion: new Date().toISOString(),
                exportado_por: user.email,
                grados: Object.keys(window.curriculumData).filter(k => 
                    !['kompetentziak_ingreso', 'kompetentziak_egreso', '_metadata', 'matrices'].includes(k)
                ).length,
                tiene_matrices: !!window.curriculumData.matrices,
                cache_timestamp: window.dataCache.timestamp
            }
        };
        
        // 🔥 4. CREAR BLOB Y DESCARGAR
        const dataStr = JSON.stringify(datosExportar, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // 🔥 5. NOMBRE CON FECHA Y HORA
        const fecha = new Date().toISOString().slice(0, 10);
        const hora = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
        a.download = `curriculum_v2_${fecha}_${hora}.json`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // 🔥 6. MOSTRAR RESUMEN
        window.showToast(`✅ JSON descargado: ${a.download}`, "success");
        
        setTimeout(() => {
            const resumen = `
📊 RESUMEN DE EXPORTACIÓN:

• Versión: 2.0 (estructura nueva)
• Fecha: ${new Date().toLocaleString('eu-EU')}
• Grados: ${datosExportar._metadata.grados}
• Competencias Ingreso: ${window.curriculumData.kompetentziak_ingreso?.length || 0}
• Competencias Egreso: ${window.curriculumData.kompetentziak_egreso?.length || 0}
• Matrices ANECA: ${datosExportar._metadata.tiene_matrices ? 'SÍ' : 'NO'}
• Archivo: ${a.download}

✅ Datos exportados correctamente!
            `.trim();
            
            console.log(resumen);
        }, 500);
        
    } catch (error) {
        console.error("❌ Error descargando JSON:", error);
        window.showToast("❌ Error al descargar: " + error.message, "error");
    }
}

export async function uploadJsonFile() {
    console.log('📤 Iniciando carga de JSON...');
    
    // 🔥 1. VERIFICAR PERMISOS ADMIN
    const supabase = getSupabaseInstance();
	const { data: { user } } = await supabase.auth.getUser();

    
    if (!user || !isAdmin(user)) {
        window.showToast('❌ Solo administradores pueden cargar JSON', 'error');
        return;
    }
    
    // 🔥 2. DISPARAR INPUT DE ARCHIVO
    document.getElementById('jsonFileInput').click();
}


// 🔥 EL EVENT LISTENER PARA EL INPUT DE ARCHIVO (ya existe en setupEventListeners)
// Asegúrate de que este código está en tu setupEventListeners:
/*
if (elements.jsonFileInput) {
    elements.jsonFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const parsedData = JSON.parse(e.target.result);
                
                // Normalizar y asignar
                window.curriculumData = window.normalizeData ? 
                    window.normalizeData(parsedData) : parsedData;
                
                // Invalidar caché
                invalidarCache();
                actualizarCache(window.curriculumData, user?.email || 'json_upload');
                
                // Inicializar matrices
                if (window.inicializarSistemaMatrices && 
                    window.curriculumData && 
                    !window.curriculumData.matrices) {
                    window.inicializarSistemaMatrices();
                }
                
                // Inicializar UI
                if (window.initializeUI) {
                    window.initializeUI();
                }
                
                window.showToast('✅ JSON cargado!', 'success');
                
                // Guardar en Supabase si hay usuario autenticado
                setTimeout(() => {
                    if (window.saveCurriculumData && user) {
                        window.saveCurriculumData();
                    }
                }, 1500);
                
            } catch (error) {
                console.error('❌ Error cargando JSON:', error);
                window.showToast('❌ Error en JSON: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    });
}
*/




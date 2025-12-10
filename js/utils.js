// ============================================
// 🛠️ CURRICULUM UTILS v2 - CON COMPETENCIAS VINCULADAS
// ============================================

window.CurriculumUtils = {
    
    // 🔥 LISTA DE KEYS QUE NO SON GRADOS
    NON_DEGREE_KEYS: [
        'kompetentziak_ingreso',
        'kompetentziak_egreso', 
        '_metadata',
        'matrices',
        'kompetentziak_ingreso_mejorado',
        'competencias_vinculadas'  // 🔥 NUEVO: competencias vinculadas
    ],
    
    // 🔥 COMPROBAR SI UNA KEY ES UN GRADO
    isDegreeKey: function(key) {
        if (!key || typeof key !== 'string') return false;
        
        // 1. Excluir keys no-grado
        if (this.NON_DEGREE_KEYS.includes(key)) return false;
        if (key.startsWith('kompetentziak')) return false;
        
        // 2. Verificar si existe en curriculumData
        if (!window.curriculumData || !window.curriculumData[key]) {
            return false;
        }
        
        const gradoData = window.curriculumData[key];
        
        // 3. Debe ser un objeto (no array ni primitivo)
        if (typeof gradoData !== 'object' || Array.isArray(gradoData)) {
            return false;
        }
        
        // 4. Tiene estructura de grado? (cursos como arrays)
        const valores = Object.values(gradoData);
        const tieneCursosComoArrays = valores.some(val => Array.isArray(val));
        const tieneClavesCurso = Object.keys(gradoData).some(k => 
            /^\d+$/.test(k) ||            // "1", "2", "3", "4"
            k.includes('Maila') ||         // "1. Maila"
            k.includes('curso') ||         // "1. curso"
            k.includes('Curso')            // "1. Curso"
        );
        
        return tieneCursosComoArrays || tieneClavesCurso;
    },
    
    // 🔥 OBTENER LISTA DE GRADOS
    getDegrees: function() {
        if (!window.curriculumData) {
            console.warn('⚠️ No hay curriculumData para obtener grados');
            return [];
        }
        
        return Object.keys(window.curriculumData)
            .filter(key => this.isDegreeKey(key))
            .sort();
    },
    
    // 🔥 CONTAR ASIGNATURAS TOTALES
    countTotalAsignaturas: function() {
        if (!window.curriculumData) return 0;
        
        let count = 0;
        this.getDegrees().forEach(degree => {
            const gradoData = window.curriculumData[degree];
            if (gradoData && typeof gradoData === 'object') {
                Object.values(gradoData).forEach(curso => {
                    if (Array.isArray(curso)) {
                        count += curso.length;
                    }
                });
            }
        });
        return count;
    },
    
    // 🔥 CONTAR UNIDADES TOTALES
    countTotalUnidades: function() {
        if (!window.curriculumData) return 0;
        
        let count = 0;
        this.getDegrees().forEach(degree => {
            const gradoData = window.curriculumData[degree];
            if (gradoData && typeof gradoData === 'object') {
                Object.values(gradoData).forEach(curso => {
                    if (Array.isArray(curso)) {
                        curso.forEach(asignatura => {
                            if (asignatura.unitateak && Array.isArray(asignatura.unitateak)) {
                                count += asignatura.unitateak.length;
                            }
                        });
                    }
                });
            }
        });
        return count;
    },
    
    // 🔥 CONTAR RAs TOTALES
    countTotalRAs: function() {
        if (!window.curriculumData) return 0;
        
        let count = 0;
        this.getDegrees().forEach(degree => {
            const gradoData = window.curriculumData[degree];
            if (gradoData && typeof gradoData === 'object') {
                Object.values(gradoData).forEach(curso => {
                    if (Array.isArray(curso)) {
                        curso.forEach(asignatura => {
                            if (asignatura.currentOfficialRAs && Array.isArray(asignatura.currentOfficialRAs)) {
                                count += asignatura.currentOfficialRAs.length;
                            }
                        });
                    }
                });
            }
        });
        return count;
    },
    
    // 🔥 EXTRAER EREMUAK DEL CURRICULUM
    extraerEremuakDelCurriculum: function() {
        if (!window.curriculumData) {
            console.warn('⚠️ No hay curriculumData para extraer eremuak');
            return [];
        }
        
        const eremuak = new Set();
        
        this.getDegrees().forEach(degree => {
            const gradoData = window.curriculumData[degree];
            if (gradoData && typeof gradoData === 'object') {
                Object.values(gradoData).forEach(curso => {
                    if (Array.isArray(curso)) {
                        curso.forEach(asignatura => {
                            // Campo 'arloa' (nuevo)
                            if (asignatura.arloa && asignatura.arloa.trim() !== '') {
                                eremuak.add(asignatura.arloa.trim());
                            }
                            // Campo 'eremua' (viejo, compatibilidad)
                            if (asignatura.eremua && asignatura.eremua.trim() !== '') {
                                eremuak.add(asignatura.eremua.trim());
                            }
                        });
                    }
                });
            }
        });
        
        const listaEremuak = Array.from(eremuak).sort();
        console.log(`📊 ${listaEremuak.length} eremuak encontrados vía CurriculumUtils`);
        
        return listaEremuak;
    },
    
    // 🔥 EXTRAER EREMUAK DE UN GRADO ESPECÍFICO (NUEVO)
    extraerEremuakDeGrado: function(grado) {
        if (!window.curriculumData || !window.curriculumData[grado]) {
            console.warn(`⚠️ No hay datos para el grado: ${grado}`);
            return [];
        }
        
        const eremuak = new Set();
        const gradoData = window.curriculumData[grado];
        
        if (gradoData && typeof gradoData === 'object') {
            Object.values(gradoData).forEach(curso => {
                if (Array.isArray(curso)) {
                    curso.forEach(asignatura => {
                        if (asignatura.arloa && asignatura.arloa.trim() !== '') {
                            eremuak.add(asignatura.arloa.trim());
                        }
                        if (asignatura.eremua && asignatura.eremua.trim() !== '') {
                            eremuak.add(asignatura.eremua.trim());
                        }
                    });
                }
            });
        }
        
        const listaEremuak = Array.from(eremuak).sort();
        console.log(`📊 ${listaEremuak.length} eremuak encontrados en el grado: ${grado}`);
        
        return listaEremuak;
    },
    
    // 🔥 OBTENER COMPETENCIAS ORIGINALES (sin vincular)
    getCompetencias: function(tipo) {
        if (!window.curriculumData) return [];
        
        const key = tipo === 'ingreso' ? 'kompetentziak_ingreso' : 'kompetentziak_egreso';
        return Array.isArray(window.curriculumData[key]) ? window.curriculumData[key] : [];
    },
    
    // 🔥 CONTAR COMPETENCIAS ORIGINALES
    countCompetencias: function(tipo) {
        return this.getCompetencias(tipo).length;
    },
    
    // 🔥 OBTENER COMPETENCIAS VINCULADAS (NUEVO)
    getCompetenciasVinculadas: function(grado = null, area = null, tipo = null) {
        if (!window.curriculumData || !window.curriculumData.competencias_vinculadas) {
            return [];
        }
        
        const competenciasVinculadas = window.curriculumData.competencias_vinculadas;
        
        // Si no hay filtros, devolver todas
        if (!grado && !area && !tipo) {
            return Object.values(competenciasVinculadas).flatMap(data => data.competencias || []);
        }
        
        // Buscar por clave específica
        let claveBusqueda = '';
        if (tipo && grado) {
            const areaKey = area || 'todas';
            claveBusqueda = `${tipo}_${grado}_${areaKey}`;
            
            if (competenciasVinculadas[claveBusqueda]) {
                return competenciasVinculadas[claveBusqueda].competencias || [];
            }
        }
        
        // Búsqueda más flexible
        const resultados = [];
        Object.keys(competenciasVinculadas).forEach(clave => {
            const data = competenciasVinculadas[clave];
            
            let coincide = true;
            if (tipo && data.tipo !== tipo) coincide = false;
            if (grado && data.grado !== grado) coincide = false;
            if (area && data.area !== area) coincide = false;
            
            if (coincide && data.competencias) {
                resultados.push(...data.competencias);
            }
        });
        
        return resultados;
    },
    
    // 🔥 CONTAR COMPETENCIAS VINCULADAS (NUEVO)
    countCompetenciasVinculadas: function(grado = null, area = null, tipo = null) {
        return this.getCompetenciasVinculadas(grado, area, tipo).length;
    },
    
    // 🔥 OBTENER TODAS LAS CONFIGURACIONES VINCULADAS (NUEVO)
    getConfiguracionesVinculadas: function() {
        if (!window.curriculumData || !window.curriculumData.competencias_vinculadas) {
            return [];
        }
        
        const configuraciones = [];
        Object.keys(window.curriculumData.competencias_vinculadas).forEach(clave => {
            const data = window.curriculumData.competencias_vinculadas[clave];
            configuraciones.push({
                clave: clave,
                tipo: data.tipo,
                grado: data.grado,
                area: data.area || 'todas',
                count: data.competencias ? data.competencias.length : 0,
                actualizado: data.metadata?.actualizado || data.metadata?.creado
            });
        });
        
        return configuraciones.sort((a, b) => new Date(b.actualizado) - new Date(a.actualizado));
    },
    
    // 🔥 CREAR CLAVE PARA COMPETENCIAS VINCULADAS (NUEVO)
    crearClaveCompetenciasVinculadas: function(tipo, grado, area = null) {
        const areaKey = area || 'todas';
        // Normalizar: quitar espacios y caracteres especiales
        const gradoKey = grado.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        const areaKeyNormalized = areaKey.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        
        return `${tipo}_${gradoKey}_${areaKeyNormalized}`;
    },
    
    // 🔥 AÑADIR COMPETENCIA VINCULADA (NUEVO)
    addCompetenciaVinculada: function(tipo, grado, area, competencia) {
        if (!window.curriculumData) {
            window.curriculumData = {};
        }
        
        if (!window.curriculumData.competencias_vinculadas) {
            window.curriculumData.competencias_vinculadas = {};
        }
        
        const clave = this.crearClaveCompetenciasVinculadas(tipo, grado, area);
        
        if (!window.curriculumData.competencias_vinculadas[clave]) {
            window.curriculumData.competencias_vinculadas[clave] = {
                tipo: tipo,
                grado: grado,
                area: area || null,
                competencias: [],
                metadata: {
                    creado: new Date().toISOString(),
                    actualizado: new Date().toISOString()
                }
            };
        }
        
        // Añadir competencia
        const nuevaCompetencia = {
            ...competencia,
            id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            grado: grado,
            area: area,
            tipo: tipo,
            data_sartze: new Date().toISOString().slice(0, 10)
        };
        
        window.curriculumData.competencias_vinculadas[clave].competencias.push(nuevaCompetencia);
        window.curriculumData.competencias_vinculadas[clave].metadata.actualizado = new Date().toISOString();
        
        console.log(`✅ Competencia vinculada añadida: ${clave}`, nuevaCompetencia);
        
        return nuevaCompetencia;
    },
    
    // 🔥 ELIMINAR COMPETENCIA VINCULADA (NUEVO)
    removeCompetenciaVinculada: function(clave, competenciaId) {
        if (!window.curriculumData || !window.curriculumData.competencias_vinculadas || 
            !window.curriculumData.competencias_vinculadas[clave]) {
            return false;
        }
        
        const competencias = window.curriculumData.competencias_vinculadas[clave].competencias;
        const index = competencias.findIndex(c => c.id === competenciaId);
        
        if (index !== -1) {
            competencias.splice(index, 1);
            window.curriculumData.competencias_vinculadas[clave].metadata.actualizado = new Date().toISOString();
            console.log(`🗑️ Competencia eliminada: ${clave} - ${competenciaId}`);
            return true;
        }
        
        return false;
    },
    
    // 🔥 ACTUALIZAR COMPETENCIA VINCULADA (NUEVO)
    updateCompetenciaVinculada: function(clave, competenciaId, updates) {
        if (!window.curriculumData || !window.curriculumData.competencias_vinculadas || 
            !window.curriculumData.competencias_vinculadas[clave]) {
            return false;
        }
        
        const competencias = window.curriculumData.competencias_vinculadas[clave].competencias;
        const index = competencias.findIndex(c => c.id === competenciaId);
        
        if (index !== -1) {
            competencias[index] = { ...competencias[index], ...updates };
            window.curriculumData.competencias_vinculadas[clave].metadata.actualizado = new Date().toISOString();
            console.log(`🔄 Competencia actualizada: ${clave} - ${competenciaId}`);
            return true;
        }
        
        return false;
    },
    
    // 🔥 OBTENER MATRICES
    getMatrices: function() {
        return window.curriculumData?.matrices || null;
    },
    
    // 🔥 VERIFICAR ESTRUCTURA DE DATOS (ACTUALIZADO)
    verificarEstructura: function() {
        if (!window.curriculumData) {
            return { error: 'No hay datos', grados: [] };
        }
        
        const grados = this.getDegrees();
        const tieneCompetenciasIngreso = !!window.curriculumData.kompetentziak_ingreso;
        const tieneCompetenciasEgreso = !!window.curriculumData.kompetentziak_egreso;
        const tieneMatrices = !!window.curriculumData.matrices;
        const tieneCompetenciasVinculadas = !!window.curriculumData.competencias_vinculadas;
        
        // Contar competencias vinculadas
        let competenciasVinculadasCount = 0;
        let configuracionesVinculadasCount = 0;
        
        if (tieneCompetenciasVinculadas) {
            configuracionesVinculadasCount = Object.keys(window.curriculumData.competencias_vinculadas).length;
            competenciasVinculadasCount = Object.values(window.curriculumData.competencias_vinculadas)
                .reduce((total, data) => total + (data.competencias ? data.competencias.length : 0), 0);
        }
        
        return {
            grados: grados,
            totalGrados: grados.length,
            totalAsignaturas: this.countTotalAsignaturas(),
            totalUnidades: this.countTotalUnidades(),
            totalRAs: this.countTotalRAs(),
            tieneCompetenciasIngreso: tieneCompetenciasIngreso,
            tieneCompetenciasEgreso: tieneCompetenciasEgreso,
            tieneMatrices: tieneMatrices,
            tieneCompetenciasVinculadas: tieneCompetenciasVinculadas,
            totalCompetenciasVinculadas: competenciasVinculadasCount,
            totalConfiguracionesVinculadas: configuracionesVinculadasCount,
            eremuak: this.extraerEremuakDelCurriculum(),
            esValido: grados.length > 0
        };
    },
    
    // 🔥 IMPRIMIR RESUMEN (debug - ACTUALIZADO)
    printResumen: function() {
        const estructura = this.verificarEstructura();
        
        console.group('📊 RESUMEN CURRICULUM V2');
        console.log('• Grados:', estructura.grados);
        console.log('• Total grados:', estructura.totalGrados);
        console.log('• Total asignaturas:', estructura.totalAsignaturas);
        console.log('• Total unidades:', estructura.totalUnidades);
        console.log('• Total RAs:', estructura.totalRAs);
        console.log('• Competencias ingreso originales:', estructura.tieneCompetenciasIngreso);
        console.log('• Competencias egreso originales:', estructura.tieneCompetenciasEgreso);
        console.log('• Competencias vinculadas:', estructura.totalCompetenciasVinculadas + ' en ' + estructura.totalConfiguracionesVinculadas + ' configuraciones');
        console.log('• Matrices ANECA:', estructura.tieneMatrices);
        console.log('• Eremuak:', estructura.eremuak.length);
        console.groupEnd();
        
        return estructura;
    },
    
    // 🔥 GENERAR REPORTE DE COMPETENCIAS VINCULADAS (NUEVO)
    generarReporteCompetenciasVinculadas: function() {
        if (!window.curriculumData || !window.curriculumData.competencias_vinculadas) {
            return {
                total: 0,
                porTipo: { ingreso: 0, egreso: 0 },
                porGrado: {},
                porArea: {},
                ultimaActualizacion: null
            };
        }
        
        const reporte = {
            total: 0,
            porTipo: { ingreso: 0, egreso: 0 },
            porGrado: {},
            porArea: {},
            configuraciones: [],
            ultimaActualizacion: null
        };
        
        let ultimaFecha = null;
        
        Object.keys(window.curriculumData.competencias_vinculadas).forEach(clave => {
            const data = window.curriculumData.competencias_vinculadas[clave];
            const count = data.competencias ? data.competencias.length : 0;
            
            // Totales
            reporte.total += count;
            
            // Por tipo
            if (data.tipo === 'ingreso') {
                reporte.porTipo.ingreso += count;
            } else if (data.tipo === 'egreso') {
                reporte.porTipo.egreso += count;
            }
            
            // Por grado
            if (data.grado) {
                reporte.porGrado[data.grado] = (reporte.porGrado[data.grado] || 0) + count;
            }
            
            // Por área
            const areaKey = data.area || 'todas';
            reporte.porArea[areaKey] = (reporte.porArea[areaKey] || 0) + count;
            
            // Configuración
            reporte.configuraciones.push({
                clave: clave,
                tipo: data.tipo,
                grado: data.grado,
                area: data.area || 'todas',
                count: count,
                actualizado: data.metadata?.actualizado || data.metadata?.creado
            });
            
            // Última actualización
            const fecha = data.metadata?.actualizado || data.metadata?.creado;
            if (fecha && (!ultimaFecha || new Date(fecha) > new Date(ultimaFecha))) {
                ultimaFecha = fecha;
            }
        });
        
        reporte.ultimaActualizacion = ultimaFecha;
        reporte.configuraciones.sort((a, b) => new Date(b.actualizado) - new Date(a.actualizado));
        
        return reporte;
    }
};

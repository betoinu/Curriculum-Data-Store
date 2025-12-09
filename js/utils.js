// ============================================
// 🛠️ CURRICULUM UTILS - FUNCIONES CENTRALIZADAS
// ============================================

window.CurriculumUtils = {
    
    // 🔥 LISTA DE KEYS QUE NO SON GRADOS
    NON_DEGREE_KEYS: [
        'kompetentziak_ingreso',
        'kompetentziak_egreso', 
        '_metadata',
        'matrices',
        'kompetentziak_ingreso_mejorado'  // Si existe
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
    
    // 🔥 OBTENER COMPETENCIAS
    getCompetencias: function(tipo) {
        if (!window.curriculumData) return [];
        
        const key = tipo === 'ingreso' ? 'kompetentziak_ingreso' : 'kompetentziak_egreso';
        return Array.isArray(window.curriculumData[key]) ? window.curriculumData[key] : [];
    },
    
    // 🔥 CONTAR COMPETENCIAS
    countCompetencias: function(tipo) {
        return this.getCompetencias(tipo).length;
    },
    
    // 🔥 OBTENER MATRICES
    getMatrices: function() {
        return window.curriculumData?.matrices || null;
    },
    
    // 🔥 VERIFICAR ESTRUCTURA DE DATOS
    verificarEstructura: function() {
        if (!window.curriculumData) {
            return { error: 'No hay datos', grados: [] };
        }
        
        const grados = this.getDegrees();
        const tieneCompetenciasIngreso = !!window.curriculumData.kompetentziak_ingreso;
        const tieneCompetenciasEgreso = !!window.curriculumData.kompetentziak_egreso;
        const tieneMatrices = !!window.curriculumData.matrices;
        
        return {
            grados: grados,
            totalGrados: grados.length,
            totalAsignaturas: this.countTotalAsignaturas(),
            totalUnidades: this.countTotalUnidades(),
            totalRAs: this.countTotalRAs(),
            tieneCompetenciasIngreso: tieneCompetenciasIngreso,
            tieneCompetenciasEgreso: tieneCompetenciasEgreso,
            tieneMatrices: tieneMatrices,
            eremuak: this.extraerEremuakDelCurriculum(),
            esValido: grados.length > 0
        };
    },
    
    // 🔥 IMPRIMIR RESUMEN (debug)
    printResumen: function() {
        const estructura = this.verificarEstructura();
        
        console.group('📊 RESUMEN CURRICULUM');
        console.log('• Grados:', estructura.grados);
        console.log('• Total grados:', estructura.totalGrados);
        console.log('• Total asignaturas:', estructura.totalAsignaturas);
        console.log('• Total unidades:', estructura.totalUnidades);
        console.log('• Total RAs:', estructura.totalRAs);
        console.log('• Competencias ingreso:', estructura.tieneCompetenciasIngreso);
        console.log('• Competencias egreso:', estructura.tieneCompetenciasEgreso);
        console.log('• Matrices ANECA:', estructura.tieneMatrices);
        console.log('• Eremuak:', estructura.eremuak.length);
        console.groupEnd();
        
        return estructura;
    }
};
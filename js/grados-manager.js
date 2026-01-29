// js/grados-manager.js - VERSIÃ“N ESTABILIZADA
import { getSupabaseInstance } from './config.js';

class GradosManager {
    constructor() {
        this.currentUser = null;
        this.currentDegree = null;
        this.currentSubject = null;
        this.currentYear = null;
        this.cachedData = null;
        this.currentRowId = null;
        this.dataColumnName = 'datos';
        this.editingAreaOldName = null; 
        
        // --- PROPIEDAD PARA LOS CAT¨¢LOGOS ---
        this.adminCatalogs = {
            iduGuidelines: [],
            externalProjects: []
        };

        this.subjectPrimaryFields = [
            'subjectCode',      
            'subjectTitle',     
            'subjectArea',
            'subjectCredits',
            'subjectType',
            'subjectAEmin',
            'zhRAs',
            'currentOfficialRAs',
            'subjectCritEval',
            'unitateak',
            'ganttPlanifikazioa',
            'matrizAsignatura'
        ];
    
        this.subjectDynamicFields = [
            'idujar',           
            'preReq',           
            'extProy',          
            'signAct',          
            'ikasEgoerak'       
        ];
    }

    // --- MODIFICACI¨®N 1: El m¨¦todo initialize ---
    async initialize(user) {
        console.log("?? Inicializando GradosManager...");
        this.currentUser = user;
        
        // Aseguramos la instancia de Supabase
        this.supabase = getSupabaseInstance();
		
		if (!this.supabase) {
			throw new Error("Supabase debe estar inicializado antes de GradosManager");
        }

        // Inyectar modales
        this.injectAreaModal(); 

        // PASO CLAVE: Cargar los cat¨¢logos (Proyectos, IDU) ANTES que los datos
        await this.loadCatalogs();

        // Cargar los datos del grado
        await this.loadData();
    }

    // --- MODIFICACI¨®N 2: Nueva funci¨®n para cargar cat¨¢logos ---
	async loadCatalogs() {
			console.log("?? Cargando cat¨¢logos oficiales desde Supabase...");
			
			try {
				// 1. Cargar ODS
				const { data: odsData, error: odsError } = await this.supabase
					.from('catalog_ods')
					.select('*')
					.order('code', { ascending: true });
				
				if (odsError) console.error("Error cargando ODS:", odsError);
				else this.adminCatalogs.ods = odsData || [];

				// 2. Cargar IDU
				const { data: iduData, error: iduError } = await this.supabase
					.from('catalog_idu')
					.select('*')
					.order('code', { ascending: true });

				if (iduError) console.error("Error cargando IDU:", iduError);
				else this.adminCatalogs.iduGuidelines = iduData || [];

				// 3. Cargar Proyectos Externos (Si ya tienes tabla)
				const { data: projData, error: projError } = await this.supabase
					.from('admin_external_projects')
					.select('*')
					.order('agent', { ascending: true }); // Ordenar por empresa

				if (projError) console.warn("Error cargando proyectos:", projError);
				else this.adminCatalogs.externalProjects = projData || [];

				console.log("? Cat¨¢logos actualizados:", this.adminCatalogs);

			} catch (err) {
				console.error("? Error cr¨ªtico cargando cat¨¢logos:", err);
			}
		}

		async loadData() {
			try {
				const supabase = getSupabaseInstance();
				if (!supabase) return;

				// 1. CARGAR PROYECTOS COMPLETOS desde admin_external_projects
				const { data: proyectosCompletos, error: errorProyectos } = await supabase
					.from('admin_external_projects')
					.select('id, name, type, agent, color, coordinator')
					.order('name');
				
				// 2. CARGAR curriculum_data
				const { data: curriculumData, error: errorCurriculum } = await supabase
					.from('curriculum_data')
					.select('*')
					.order('created_at', { ascending: false })
					.limit(1);

				if (errorCurriculum) throw errorCurriculum;

				if (curriculumData && curriculumData.length > 0) {
					const row = curriculumData[0];
					this.currentRowId = row.id;
					
					if (row.datos) {
						this.cachedData = row.datos;
						
						// 3. COMPLETAR LOS DATOS: Si en proyectosExternos solo hay strings,
						// reemplazarlos con los objetos completos
						if (this.cachedData.proyectosExternos && 
							proyectosCompletos && 
							proyectosCompletos.length > 0) {
							
							console.log("?? Completando datos de proyectos...");
							
							const nuevosProyectos = this.cachedData.proyectosExternos.map(item => {
								// Si es string (solo nombre), buscar el objeto completo
								if (typeof item === 'string') {
									const proyectoCompleto = proyectosCompletos.find(p => p.name === item);
									return proyectoCompleto || { name: item, agent: 'Desconocido' };
								}
								// Si ya es objeto, mantenerlo
								return item;
							});
							
							this.cachedData.proyectosExternos = nuevosProyectos;
						}
					}
				}

				// Asegurar que existe la estructura
				if (!this.cachedData) {
					this.cachedData = {
						graduak: [],
						proyectosExternos: []  // ¡û ARRAY VAC¨ªO para proyectos
					};
				}
				
				if (!this.cachedData.graduak) {
					this.cachedData.graduak = [];
				}
				
				if (!this.cachedData.proyectosExternos) {
					this.cachedData.proyectosExternos = [];
				}

				this.populateDegreeSelect();

				if (this.cachedData.graduak.length > 0) {
					const primer = this.cachedData.graduak[0];
					this.loadDegreeData(primer.codigo || primer.id);
				}

			} catch (err) {
				console.error("? Error cargando:", err);
			}
		}

async saveData() {
    try {
        const supabase = window.supabase;
        
        // GAKOA: cachedData-k graduaren JSON osoa du.
        // currentRowId-k gradu horren "giltza" nagusia izan behar du (adib: MEKA-rena).
        if (!this.cachedData || !this.currentRowId) return;

        const { error } = await supabase
            .from('curriculum_data')
            .update({ datos: this.cachedData }) // Fitxategi osoa ordezkatzen dugu
            .eq('id', this.currentRowId);       // Gradu honen fitxategia, ez besteena

        if (error) throw error;
        console.log("✅ Graduaren JSONB fitxategi osoa eguneratu da.");
    } catch (err) {
        console.error("Errorea gordetzean:", err);
    }
}
	
	// --- CARGA DE GRADO ESPECÃFICO ---
async loadDegreeData(id) {
        // 1. Bilatu gradua katxean
        const degree = this.cachedData.graduak.find(g => g.codigo === id || g.id === id);
        if (!degree) return;
        
        this.currentDegree = degree;

        // --- KATALOGOEKIN KONEXIOA (ODS, IDU, Proiektuak) ---
        
        // A. ODS
        if (!this.currentDegree.ods || this.currentDegree.ods.length === 0) {
            if (this.adminCatalogs && this.adminCatalogs.ods) {
                this.currentDegree.ods = this.adminCatalogs.ods.map(item => `${item.code} - ${item.name}`);
            } else {
                this.currentDegree.ods = [];
            }
        }

        // B. IDU
        if (!this.currentDegree.idu || this.currentDegree.idu.length === 0) {
            if (this.adminCatalogs && this.adminCatalogs.iduGuidelines) {
                this.currentDegree.idu = this.adminCatalogs.iduGuidelines.map(item => `${item.code} ${item.name}`);
            } else {
                this.currentDegree.idu = [];
            }
        }

        // C. KANPO PROIEKTUAK
        if (!this.currentDegree.external_projects || this.currentDegree.external_projects.length === 0) {
            if (this.adminCatalogs && this.adminCatalogs.externalProjects) {
                this.currentDegree.external_projects = this.adminCatalogs.externalProjects.map(item => item.name);
            } else {
                this.currentDegree.external_projects = [];
            }
        }

        // 2. Oinarrizko egitura ziurtatu
        this.currentDegree.year = this.currentDegree.year || {};
        this.currentDegree.subjectAreas = this.currentDegree.subjectAreas || [];

        // --- BERRIKUNTZA: ZEHARKAKO EREMUA DERRIGORTU (Blended) ---
        // Honek ziurtatzen du "ZEHARKAKO KONPETENTZIAK (Blended)" eremua beti existitzen dela zerrendan.
        // Sidebarra marraztu aurretik egiten dugu.
        const blendedName = "ZEHARKAKO KONPETENTZIAK";
        if (!this.currentDegree.subjectAreas.find(a => a.name === blendedName)) {
            this.currentDegree.subjectAreas.unshift({ 
                name: blendedName, 
                color: "#475569" // Slate-600 (Gris ilun neutroa)
            });
            console.log("?? Zeharkako eremua automatikoki sortu da.");
        }

        // 3. UI Eguneraketak (Interfazea)
        const selectEl = document.getElementById('degreeSelect');
        if (selectEl) selectEl.value = id;
        
        if (window.ui && window.ui.renderSidebar) {
            // Lehenengo Sidebarra marraztu (Blended eremu berria barne)
            window.ui.renderSidebar(this.currentDegree);
            
            // ONDOREN: Konpetentzien zerrenda txikia eguneratu Sidebarrean
            // renderSidebar exekutatu ondoren egin behar da HTML elementuak (ul) existitu daitezen
            if (typeof this.updateSidebarCompetenciesList === 'function') {
                this.updateSidebarCompetenciesList();
            }

            this.selectYear("1");
        }
    }
	
	// En GradosManager class, despu¨¦s del constructor
	getZhFromCatalog(zhCode) {
		if (!this.currentDegree?.zhCatalog) return null;
		return this.currentDegree.zhCatalog.find(zh => zh.code === zhCode);
	}
	

getFullZhDescription(zhItem) {
    // 1. Prioridad: Descripci¨®n espec¨ªfica de la asignatura
    const localDesc = zhItem.zhDesc || zhItem.raDesc || zhItem.desc;
    if (localDesc) return localDesc;
    
    // 2. Fallback: Buscar en el cat¨¢logo global por c¨®digo
    const codeToSearch = zhItem.zhCode || zhItem.code || zhItem.raCode;
    const catalogZh = this.currentDegree?.zhCatalog?.find(z => (z.zhCode || z.code) === codeToSearch);
    
    return catalogZh?.zhDesc || catalogZh?.desc || 'Deskribapenik gabe';
}


// ? VERSI¨®N CORRECTA PARA CLASE (Sin ': function')
    loadUniqueSubjectTypes() {
        console.log("?? Obteniendo tipos de la memoria local...");

        // 1. Buscamos d¨®nde est¨¢n guardadas las asignaturas cargadas
        let subjectsList = [];
        if (this.currentDegree && this.currentDegree.subjects) {
            subjectsList = this.currentDegree.subjects;
        } else if (this.subjects) {
            subjectsList = this.subjects;
        }

        // 2. Si no hay datos, devolvemos lista b¨¢sica
        if (!subjectsList || subjectsList.length === 0) {
            return ["Oinarrizkoa", "Derrigorrezkoa", "Hautazkoa"];
        }

        // 3. Sacamos los valores ¨²nicos
        const uniqueTypes = [...new Set(
            subjectsList
                .map(item => item.tipo || item.subjectType)
                .filter(t => t)
        )];
        
        return uniqueTypes;
    }

	selectYear(yearNum) {
        console.log(`?? Cambiando al a?o: ${yearNum}`);
        this.currentYear = yearNum;

        // 1. Renderizar la vista central
        if (window.ui) {
            window.ui.renderYearView(this.currentDegree, yearNum);
        }

        // 2. ACTUALIZAR LOS BOTONES DEL MEN¨² LATERAL
        const navContainer = document.getElementById('yearNavigation');
        if (navContainer) {
            // Busamos los botones por la etiqueta 'data-year' que ya has puesto
            const buttons = navContainer.querySelectorAll('button[data-year]');
            
            buttons.forEach(btn => {
                const btnYear = parseInt(btn.getAttribute('data-year'));
                const icon = btn.querySelector('.fa-calendar-alt'); // El icono del calendario

                if (btnYear === yearNum) {
                    // --- ESTILO ACTIVO (Seleccionado) ---
                    // Fondo Indigo, Texto Blanco
                    btn.classList.remove('text-slate-300', 'hover:bg-slate-800', 'hover:text-white');
                    btn.classList.add('bg-indigo-600', 'text-white');
                    
                    // Icono brillante
                    if(icon) icon.classList.remove('opacity-50');
                } else {
                    // --- ESTILO INACTIVO (No seleccionado) ---
                    // Fondo transparente, Texto gris claro
                    btn.classList.remove('bg-indigo-600', 'text-white');
                    btn.classList.add('text-slate-300', 'hover:bg-slate-800', 'hover:text-white');
                    
                    // Icono apagado
                    if(icon) icon.classList.add('opacity-50');
                }
            });
        }
    }

	// --- SELECCI¨®N DE ASIGNATURA ---
	selectSubject(subject) {
		if (!subject) return;

		console.log("?? Seleccionando asignatura:", subject.subjectTitle || subject.name);

		// 1. Guardar la referencia en el manager para que otros m¨®dulos (como el de matrices) la usen
		this.currentSubject = subject;

		// 2. Llamar a la funci¨®n de renderizado de UI que ya tienes definida
		// Le pasamos la asignatura y el grado actual para que calcule los colores de ¨¢rea
		if (window.ui && window.ui.renderSubjectDetail) {
			window.ui.renderSubjectDetail(subject, this.currentDegree);
		} else {
			console.error("? Error: No se encuentra window.ui.renderSubjectDetail");
		}
	}

    // --- CREACIÃ“N DE ASIGNATURA (NUEVA FUNCIÃ“N) ---
	crearNuevaAsignatura(yearNum) {
		if (!this.currentDegree) {
			alert("Mesedez, hautatu gradu bat lehenago.");
			return;
		}
		
		// 1. Inicializar estructura si no existe
		if (!this.currentDegree.year) this.currentDegree.year = {};
		if (!this.currentDegree.year[yearNum]) this.currentDegree.year[yearNum] = [];

		// 2. Crear el objeto completo (Basado en tu modelo de datos oficial)
		const nuevoId = `ASG-${Date.now()}`;
		const newSubj = {
			id: nuevoId,
			code: 'NEW',
			subjectCode: 'NEW',
			name: 'Irakasgai Berria',
			subjectTitle: 'Irakasgai Berria',
			subjectArea: '',
			subjectCredits: 6,
			credits: 6,
			year: yearNum,
			degreeCode: this.currentDegree.codigo || '',
			subjectType: [],
			currentOfficialRAs: [],
			zhRAs: [],
			preReq: [],
			idujar: [],
			unitateak: [], // Importante para el Gantt
			ikasEgoerak: { extProy: [], signAct: [] }
		};

		// 3. Persistencia y Navegaci¨®n
		this.currentDegree.year[yearNum].push(newSubj);
		this.saveData();
		
		// 4. UI: Refrescar y saltar directamente a la edici¨®n
		this.selectYear(yearNum); 
		this.selectSubject(newSubj); 
		
		// Peque?o retardo para asegurar que el DOM del detalle est¨¢ listo
		setTimeout(() => {
			if (this.openEditSubjectModal) {
				this.openEditSubjectModal();
			} else if (window.gradosManager.openEditSubjectModal) {
				window.gradosManager.openEditSubjectModal();
			}
		}, 150);
	}
	
	openEditSubjectModal() {
			if (!this.currentSubject) return;
			const subj = this.currentSubject;
			
			// 1. Cargar datos b¨¢sicos
			const codeInput = document.getElementById('subject_edit_code'); 
			const nameInput = document.getElementById('subject_edit_name');
			const areaSelect = document.getElementById('subject_edit_area');
			const typeSelect = document.getElementById('subject_edit_type');
			
	// --- Relleno de Tipos (INSTANT¨¢NEO) ---
			if (typeSelect) {
				typeSelect.innerHTML = '';
				
				// Llamada directa a la funci¨®n corregida de arriba
				const dbTypes = this.loadUniqueSubjectTypes();
				
				// Opci¨®n por defecto
				const defaultOpt = document.createElement('option');
				defaultOpt.value = "";
				defaultOpt.textContent = "-- Hautatu --";
				typeSelect.appendChild(defaultOpt);

				// Rellenar opciones
				dbTypes.forEach(tipo => {
					const opt = document.createElement('option');
					opt.value = tipo;
					opt.textContent = tipo;
					typeSelect.appendChild(opt);
				});

				// Seleccionar valor actual
				const val = subj.tipo || subj.subjectType || subj.type || '';
				typeSelect.value = val;
			}			
			
			
			if(codeInput) codeInput.value = subj.subjectCode || subj.code || '';
			if(nameInput) nameInput.value = subj.subjectTitle || subj.name || '';
			if(typeSelect) typeSelect.value = subj.tipo || subj.subjectType || subj.type || '';
			
			// Cargar ¨¢reas
			if (areaSelect && this.currentDegree) {
				areaSelect.innerHTML = '<option value="">-- Hautatu --</option>';
				(this.currentDegree.subjectAreas || []).forEach(area => {
					const opt = document.createElement('option');
					opt.value = area.name;
					opt.textContent = area.name;
					if (area.name === subj.subjectArea) opt.selected = true;
					areaSelect.appendChild(opt);
				});
			}

			// --- 2. RENDERIZAR SELECTORES USANDO UI.JS ---
			// Verificamos que ui exista
			if (window.ui && window.ui.renderChecklistSelector) {
				
				// Inicializamos contexto si no existe
				const ctx = subj.context || {}; 

				// A. IDU Jarraibideak
				window.ui.renderChecklistSelector(
					'editIduContainer',           // ID contenedor
					this.currentDegree.idu,       // Lista Maestra (Grado)
					ctx.idu,                      // Seleccionados (Asignatura)
					'idu_chk'                     // Name del input
				);

				// B. ODS - GHJ
				window.ui.renderChecklistSelector(
					'editOdsContainer',
					this.currentDegree.ods,
					ctx.ods,
					'ods_chk'
				);

				// C. Kanpo Proiektuak
				window.ui.renderChecklistSelector(
					'editExtProyContainer',
					this.currentDegree.external_projects,
					ctx.external_projects,
					'ext_chk'
				);
			}

			// Mostrar Modal
			const modal = document.getElementById('editSubjectModal');
			if (modal) modal.classList.remove('hidden');
		}

	// EN GRADOS-MANAGER.JS
saveSubjectBasicData() {
    console.log("?? Datu basikoak gordetzen...");
    if (!this.currentSubject) return;

    // 1. Input-ak irakurri
    const codeInput = document.getElementById('subject_edit_code');
    const nameInput = document.getElementById('subject_edit_name');
    const areaSelect = document.getElementById('subject_edit_area');
    const typeSelect = document.getElementById('subject_edit_type');
    
    if (codeInput) {
        this.currentSubject.subjectCode = codeInput.value.trim();
        this.currentSubject.code = codeInput.value.trim(); 
    }
    if (nameInput) {
        this.currentSubject.subjectTitle = nameInput.value.trim();
        this.currentSubject.name = nameInput.value.trim(); 
    }
    if (areaSelect) {
        // GARRANTZITSUA: Balio berria esleitu memoriako objektuari
        this.currentSubject.subjectArea = areaSelect.value;
        console.log("? Eremu berria esleituta:", this.currentSubject.subjectArea);
    }
    if (typeSelect) {
        this.currentSubject.tipo = typeSelect.value;
        this.currentSubject.subjectType = typeSelect.value;
    }           

    // 2. Selectoreak gorde (IDU, ODS...)
    const getChecked = (name) => {
        return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
                    .map(cb => cb.value);
    };

    this.currentSubject.context = this.currentSubject.context || {};
    this.currentSubject.context.idu = getChecked('idu_chk');
    this.currentSubject.context.ods = getChecked('ods_chk');
    this.currentSubject.context.external_projects = getChecked('ext_chk');

    // 3. Datu basean gorde (Supabase / JSON)
    if (this.saveData) { 
        this.saveData(); 
    }

    // 4. Modala itxi
    const modal = document.getElementById('editSubjectModal');
    if (modal) modal.classList.add('hidden');

    // --- 5. BISTA EGUNERATU (HEMEN DAGO GAKOA) ---
    
    // A) Xehetasunen bista eguneratu (lehen zenuena)
    if (window.ui && window.ui.renderSubjectDetail) {
        window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
    }

    // B) DASHBOARD / URTEKO BISTA EGUNERATU (Hau falta zitzaizun!)
    // Honek txartelaren kolorea eta testua berehala aldatuko ditu
    if (window.ui && window.ui.renderYearView) {
        console.log("?? Dashboard freskatzen...");
        // 'this.currentYear' existitzen dela ziurtatu behar da. 
        // Normalean 'gradosManager' barruan gordeta egoten da.
        window.ui.renderYearView(this.currentDegree, this.currentYear || "1");
    }
}

    // --- UTILS ---
    populateDegreeSelect() {
        const select = document.getElementById('degreeSelect');
        if (!select || !this.cachedData.graduak) return;
        
        select.innerHTML = '';
        this.cachedData.graduak.forEach(g => {
            const op = document.createElement('option');
            op.value = g.codigo || g.id;
            op.textContent = g.selectedDegree;
            select.appendChild(op);
        });
        
        // OpciÃ³n para crear nuevo
        const createOp = document.createElement('option');
        createOp.value = "NEW_DEGREE";
        createOp.textContent = "+ Gradu Berria...";
        select.appendChild(createOp);
    }
    
    selectDegree(e) {
        const val = (e.target && e.target.value) ? e.target.value : e;
        if (val === "NEW_DEGREE") {
            this.createNewDegree();
        } else {
            this.loadDegreeData(val);
        }
    }
    
    createNewDegree() { 
        const name = prompt("Sartu gradu berriaren izena:");
        if (name) {
            const newId = "G-" + Date.now();
            const newD = {
                id: newId, codigo: newId, selectedDegree: name,
                year: {}, subjectAreas: []
            };
            this.cachedData.graduak.push(newD);
            this.saveData();
            this.populateDegreeSelect();
            this.loadDegreeData(newId);
        } else {
            // Reset select
            document.getElementById('degreeSelect').value = this.currentDegree.id;
        }
    }

// --- GESTIÃ“N DE LISTAS (RA, IDU, PROYECTOS) ---
    
// ?? FUNCION 1: GESTI¨®N DEL CAT¨¢LOGO (Para el Sidebar)
    // Permite editar C¨®digo, Nombre y Color
    openOdsCatalogEditor() {
        const modal = document.getElementById('listEditorModal');
        const container = document.getElementById('listEditorContainer');
        const titleEl = document.getElementById('listEditorTitle');
        const inputTop = document.getElementById('newItemInput')?.parentElement;
        
        // Configuraci¨®n visual
        if(inputTop) inputTop.classList.add('hidden'); // Ocultar input simple
        if(titleEl) titleEl.innerHTML = `<i class="fas fa-edit mr-2 text-blue-500"></i> Editatu ODS Katalogoa (Master)`;
        
        // Renderizar Tabla de Edici¨®n
        const renderTable = () => {
            container.innerHTML = `
                <div class="flex justify-between items-center mb-3">
                    <span class="text-xs text-gray-500 italic">Aldaketak katalogo orokorrean gordeko dira.</span>
                    <button id="btnAddOdsMaster" class="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded border border-blue-200 hover:bg-blue-100 font-bold">
                        + ODS Berria
                    </button>
                </div>
                <div id="odsTableBody" class="space-y-2"></div>
            `;

            const body = document.getElementById('odsTableBody');
            
            // Usamos el cat¨¢logo cargado en memoria
            this.adminCatalogs.ods.forEach((ods, index) => {
                const row = document.createElement('div');
                row.className = "flex items-center gap-2 p-2 bg-white border rounded shadow-sm";
                
                row.innerHTML = `
                    <div class="relative group">
                        <input type="color" class="w-8 h-8 p-0 border-0 rounded cursor-pointer overflow-hidden field-color" 
                               value="${ods.color}" title="Aldatu kolorea">
                    </div>

                    <input type="text" class="w-16 text-xs font-bold text-gray-700 border-b border-gray-200 focus:border-blue-500 outline-none field-code" 
                           value="${ods.code}">

                    <input type="text" class="flex-1 text-sm text-gray-600 border-b border-gray-200 focus:border-blue-500 outline-none field-name" 
                           value="${ods.name}">

                    <button class="text-gray-300 hover:text-red-500 transition px-2 btn-delete">
                        <i class="fas fa-trash"></i>
                    </button>
                `;

                // Eventos de edici¨®n en tiempo real (actualiza array local)
                const updateLocal = () => {
                    this.adminCatalogs.ods[index].color = row.querySelector('.field-color').value;
                    this.adminCatalogs.ods[index].code = row.querySelector('.field-code').value;
                    this.adminCatalogs.ods[index].name = row.querySelector('.field-name').value;
                };

                row.querySelectorAll('input').forEach(i => i.oninput = updateLocal);
                
                row.querySelector('.btn-delete').onclick = () => {
                    if(confirm(`Ziur "${ods.code}" ezabatu nahi duzula?`)) {
                        this.adminCatalogs.ods.splice(index, 1);
                        renderTable(); // Re-render
                    }
                };

                body.appendChild(row);
            });

            // Bot¨®n a?adir nuevo
            document.getElementById('btnAddOdsMaster').onclick = () => {
                this.adminCatalogs.ods.push({ code: 'ODS-XX', name: 'Nuevo Objetivo', color: '#888888' });
                renderTable();
            };
        };

        renderTable();

        // GUARDADO ESPECIAL A SUPABASE (Tabla catalog_ods)
        const saveBtn = this._setupSaveButtonRaw(modal); // Helper para limpiar el bot¨®n
        saveBtn.onclick = async () => {
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
            try {
                // 1. Upsert a Supabase (Guardar cambios)
                const { error } = await this.supabase
                    .from('catalog_ods')
                    .upsert(this.adminCatalogs.ods, { onConflict: 'code' }); // Asume 'code' o 'id' como ¨²nico

                if (error) throw error;
                
                // 2. Si borraste alguno, habr¨ªa que gestionar el delete en BD, 
                // pero por simplicidad el upsert actualiza los existentes. 
                // (Para borrado real se necesitar¨ªa sync m¨¢s complejo o borrar por ID).
                
                alert("Katalogoa eguneratuta!");
                modal.classList.add('hidden');
            } catch (e) {
                console.error(e);
                alert("Errorea gordetzerakoan: " + e.message);
            } finally {
                saveBtn.innerHTML = 'Gorde Aldaketak';
            }
        };

        modal.classList.remove('hidden');
    }

    // Helper simple para limpiar bot¨®n guardar
    _setupSaveButtonRaw(modal) {
        const oldBtn = modal.querySelector('button[onclick*="saveListEditor"]');
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);
        return newBtn;
    }

// ?? FUNCION 2: SELECTOR DE ASIGNATURA (Para seleccionar cu¨¢les se trabajan)
    // Solo permite marcar/desmarcar (Grid Visual)
    openOdsSelector() {
        if (!this.currentSubject) return;

        const modal = document.getElementById('listEditorModal');
        const container = document.getElementById('listEditorContainer');
        const titleEl = document.getElementById('listEditorTitle');
        const inputTop = document.getElementById('newItemInput')?.parentElement;
        
        if(inputTop) inputTop.classList.add('hidden');
        if(titleEl) titleEl.innerHTML = `<i class="fas fa-check-double mr-2 text-green-500"></i> Aukeratu ODSak (${this.currentSubject.subjectCode || 'Asignatura'})`;

        // Renderizado Grid (El que ya ten¨ªas, funciona bien para esto)
        container.innerHTML = `<div class="grid grid-cols-2 gap-2" id="odsGrid"></div>`;
        const grid = document.getElementById('odsGrid');
        
        const currentList = this.currentSubject.context?.ods || [];

        this.adminCatalogs.ods.forEach(ods => {
            const isActive = currentList.some(o => o.code === ods.code);
            
            const card = document.createElement('div');
            card.className = `p-2 rounded border cursor-pointer flex items-center gap-2 transition-all ${isActive ? 'ring-2 ring-offset-1 ring-blue-500 bg-white shadow-md' : 'opacity-60 bg-gray-50 hover:opacity-100'}`;
            card.style.borderColor = ods.color;

            card.innerHTML = `
                <div class="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm" style="background-color: ${ods.color}">
                    ${ods.code.replace('ODS-', '')}
                </div>
                <div class="text-xs leading-tight text-gray-700 font-medium">${ods.name}</div>
                ${isActive ? '<i class="fas fa-check-circle text-blue-500 ml-auto"></i>' : ''}
            `;

            card.onclick = () => {
                let list = this.currentSubject.context?.ods || [];
                if (isActive) list = list.filter(o => o.code !== ods.code);
                else list.push(ods); // Guardamos copia del objeto maestro

                if(!this.currentSubject.context) this.currentSubject.context = {};
                this.currentSubject.context.ods = list;
                
                this.openOdsSelector(); // Refrescar visualmente
            };
            grid.appendChild(card);
        });

        // Guardado Estandard (Para la asignatura)
        const saveBtn = this._setupSaveButtonRaw(modal);
        saveBtn.onclick = async () => {
            await this.saveData(); // Guarda la asignatura
            modal.classList.add('hidden');
            if(window.ui) window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
        };

        modal.classList.remove('hidden');
    }
	
	// ?? FUNCION 1: GESTI¨®N DEL CAT¨¢LOGO IDU (Para el Sidebar - Master)
    openIduCatalogEditor() {
        const modal = document.getElementById('listEditorModal');
        const container = document.getElementById('listEditorContainer');
        const titleEl = document.getElementById('listEditorTitle');
        const inputTop = document.getElementById('newItemInput')?.parentElement;
        
        // Configuraci¨®n visual
        if(inputTop) inputTop.classList.add('hidden');
        if(titleEl) titleEl.innerHTML = `<i class="fas fa-edit mr-2 text-yellow-500"></i> Editatu IDU Katalogoa (Master)`;
        
        // Renderizar Tabla de Edici¨®n
        const renderTable = () => {
            container.innerHTML = `
                <div class="flex justify-between items-center mb-3">
                    <span class="text-xs text-gray-500 italic">Aldaketak katalogo orokorrean gordeko dira.</span>
                    <button id="btnAddIduMaster" class="text-xs bg-yellow-50 text-yellow-600 px-3 py-1 rounded border border-yellow-200 hover:bg-yellow-100 font-bold">
                        + IDU Pauta Berria
                    </button>
                </div>
                <div id="iduTableBody" class="space-y-3 pb-4"></div>
            `;

            const body = document.getElementById('iduTableBody');
            
            // Usamos el cat¨¢logo cargado en memoria
            this.adminCatalogs.iduGuidelines.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = "flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded shadow-sm relative group";
                
                row.innerHTML = `
                    <div class="flex gap-2">
                        <input type="text" class="w-20 text-xs font-bold text-gray-700 border-b border-gray-200 focus:border-yellow-500 outline-none field-code" 
                               value="${item.code}" placeholder="Kodea">
                        
                        <select class="flex-1 text-xs text-gray-500 border-b border-gray-200 focus:border-yellow-500 outline-none bg-transparent field-range">
                            <option value="IRUDIKAPENA (Zer Ikasi)">IRUDIKAPENA (Zer Ikasi)</option>
                            <option value="EKINTZA ETA ADIERAZPENA (Nola Ikasi)">EKINTZA ETA ADIERAZPENA (Nola Ikasi)</option>
                            <option value="INPLIKAZIOA (Zergatik Ikasi)">INPLIKAZIOA (Zergatik Ikasi)</option>
                        </select>
                    </div>

                    <textarea rows="2" class="w-full text-sm text-gray-600 border border-gray-100 rounded p-1 focus:border-yellow-500 outline-none resize-none field-name"
                              placeholder="Deskribapena...">${item.name}</textarea>

                    <button class="absolute top-2 right-2 text-gray-200 hover:text-red-500 transition btn-delete" title="Ezabatu">
                        <i class="fas fa-trash"></i>
                    </button>
                `;

                // Setear valor del select
                row.querySelector('.field-range').value = item.range;

                // Eventos de edici¨®n en tiempo real
                const updateLocal = () => {
                    this.adminCatalogs.iduGuidelines[index].code = row.querySelector('.field-code').value;
                    this.adminCatalogs.iduGuidelines[index].range = row.querySelector('.field-range').value;
                    this.adminCatalogs.iduGuidelines[index].name = row.querySelector('.field-name').value;
                };

                row.querySelectorAll('input, select, textarea').forEach(i => i.oninput = updateLocal);
                
                row.querySelector('.btn-delete').onclick = () => {
                    if(confirm(`Ziur "${item.code}" ezabatu nahi duzula?`)) {
                        this.adminCatalogs.iduGuidelines.splice(index, 1);
                        renderTable();
                    }
                };

                body.appendChild(row);
            });

            // Bot¨®n a?adir nuevo
            document.getElementById('btnAddIduMaster').onclick = () => {
                this.adminCatalogs.iduGuidelines.unshift({ 
                    code: 'IDU-XX', 
                    range: 'IRUDIKAPENA (Zer Ikasi)', 
                    name: '' 
                });
                renderTable();
            };
        };

        renderTable();

        // GUARDADO A SUPABASE (Tabla catalog_idu)
        const saveBtn = this._setupSaveButtonRaw(modal);
        saveBtn.onclick = async () => {
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
            try {
                // Upsert a Supabase
                const { error } = await this.supabase
                    .from('catalog_idu')
                    .upsert(this.adminCatalogs.iduGuidelines, { onConflict: 'code' });

                if (error) throw error;
                
                alert("IDU Katalogoa eguneratuta!");
                modal.classList.add('hidden');
            } catch (e) {
                console.error(e);
                alert("Errorea gordetzerakoan: " + e.message);
            } finally {
                saveBtn.innerHTML = 'Gorde Aldaketak';
            }
        };

        modal.classList.remove('hidden');
    }
	

// ?? FUNCION 2: SELECTOR DE ASIGNATURA (Checklist con Filtro)
    openIduSelector() {
        if (!this.currentSubject) return;

        const modal = document.getElementById('listEditorModal');
        const container = document.getElementById('listEditorContainer');
        const titleEl = document.getElementById('listEditorTitle');
        const inputTop = document.getElementById('newItemInput')?.parentElement;
        
        if(inputTop) inputTop.classList.add('hidden');
        if(titleEl) titleEl.innerHTML = `<i class="fas fa-check-double mr-2 text-yellow-500"></i> Aukeratu IDU Jarraibideak`;

        // Estructura: Filtro + Lista
        container.innerHTML = `
            <div class="mb-3 sticky top-0 bg-white pb-2 z-10 border-b border-gray-100 pt-1">
                <select id="iduFilter" class="w-full text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 p-2 bg-gray-50 shadow-sm">
                    <option value="ALL">-- Printzipio Guztiak --</option>
                </select>
            </div>
            <div id="iduList" class="space-y-2 pb-2"></div>
        `;

        // Llenar Select
        const ranges = [...new Set(this.adminCatalogs.iduGuidelines.map(i => i.range))];
        const select = document.getElementById('iduFilter');
        ranges.forEach(r => {
            const op = document.createElement('option');
            op.value = r;
            op.textContent = r;
            select.appendChild(op);
        });

        const renderList = (filter) => {
            const listDiv = document.getElementById('iduList');
            listDiv.innerHTML = '';

            const currentSelected = this.currentSubject.context?.idu || this.currentSubject.idujar || [];
            const filteredCatalog = this.adminCatalogs.iduGuidelines.filter(i => filter === 'ALL' || i.range === filter);

            if (filteredCatalog.length === 0) {
                listDiv.innerHTML = '<div class="text-center text-gray-400 text-sm py-4 italic">Ez dago emaitzarik.</div>';
                return;
            }

            filteredCatalog.forEach(item => {
                const isActive = currentSelected.some(sel => sel.code === item.code);
                
                const row = document.createElement('div');
                row.className = `flex gap-3 p-3 border rounded-lg cursor-pointer transition-all duration-200 group ${isActive ? 'bg-yellow-50 border-yellow-200 shadow-sm' : 'bg-white border-gray-200 hover:border-yellow-300'}`;
                
                row.innerHTML = `
                    <div class="mt-0.5 shrink-0 ${isActive ? 'text-yellow-600' : 'text-gray-300 group-hover:text-yellow-400'}">
                        <i class="fas ${isActive ? 'fa-check-square' : 'fa-square'} text-lg"></i>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start mb-1">
                            <span class="font-mono text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">${item.code}</span>
                        </div>
                        <p class="text-sm text-gray-700 leading-snug">${item.name}</p>
                    </div>
                `;
                
                row.onclick = () => {
                    let list = this.currentSubject.context?.idu || [];
                    if (isActive) list = list.filter(x => x.code !== item.code);
                    else list.push(item);

                    if(!this.currentSubject.context) this.currentSubject.context = {};
                    this.currentSubject.context.idu = list;
                    this.currentSubject.idujar = list; // Compatibilidad
                    
                    renderList(filter); // Re-render solo lista
                };
                listDiv.appendChild(row);
            });
        };

        select.onchange = (e) => renderList(e.target.value);
        renderList('ALL');

        // Guardar en la Asignatura
        const saveBtn = this._setupSaveButtonRaw(modal);
        saveBtn.onclick = async () => {
            await this.saveData(); // Guarda la asignatura
            modal.classList.add('hidden');
            if(window.ui) window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
        };

        modal.classList.remove('hidden');
    }
	
	openProjectsCatalogEditor() {
		const modal = document.getElementById('listEditorModal');
		const container = document.getElementById('listEditorContainer');
		const titleEl = document.getElementById('listEditorTitle');
		const inputTop = document.getElementById('newItemInput')?.parentElement;
		
		if (inputTop) inputTop.classList.add('hidden');
		if (titleEl) titleEl.innerHTML = `<i class="fas fa-edit mr-2 text-orange-500"></i> Proiektu Katalogoa`;
		
		// Funci¨®n para obtener tipos ¨²nicos
		const getUniqueTypes = () => {
			const tipos = this.adminCatalogs.externalProjects
				.map(p => p.type)
				.filter(tipo => tipo && tipo.trim() !== '');
			
			return [...new Set(tipos)].sort((a, b) => a.localeCompare(b));
		};

		// ?? NUEVO: Funci¨®n para obtener agentes ¨²nicos
		const getUniqueAgents = () => {
			const agentes = this.adminCatalogs.externalProjects
				.map(p => p.agent)
				.filter(agent => agent && agent.trim() !== '');
			
			return [...new Set(agentes)].sort((a, b) => a.localeCompare(b));
		};

		// Funci¨®n para obtener color asignado a un tipo
		const getColorForType = (type) => {
			if (!type) return '#94a3b8';
			
			const proyectoConTipo = this.adminCatalogs.externalProjects.find(
				p => p.type === type && p.color && p.color.trim() !== ''
			);
			
			return proyectoConTipo?.color || '#94a3b8';
		};

		const renderTable = () => {
			container.innerHTML = `
				<div class="flex justify-between items-center mb-3">
					<span class="text-xs text-gray-500 italic">Koloreak automatikoki sinkronizatzen dira motaren arabera.</span>
					<button id="btnAddProjMaster" class="text-xs bg-orange-50 text-orange-600 px-3 py-1 rounded border border-orange-200 hover:bg-orange-100 font-bold">
						+ Proiektu Berria
					</button>
				</div>
				<div id="projTableBody" class="space-y-3 pb-4 max-h-[60vh] overflow-y-auto pr-2"></div>
			`;

			const body = document.getElementById('projTableBody');
			const tiposUnicos = getUniqueTypes();
			const agentesUnicos = getUniqueAgents(); // ?? Obtener agentes ¨²nicos
			
			// Mapeo de tipos a colores
			const typeColorMap = {};
			tiposUnicos.forEach(tipo => {
				typeColorMap[tipo] = getColorForType(tipo);
			});

			// Funci¨®n para sincronizar colores por tipo
			const syncColorsByType = (targetType, newColor) => {
				if (!targetType) return;
				
				// Actualizar el mapa
				typeColorMap[targetType] = newColor;
				
				// Actualizar datos en memoria
				this.adminCatalogs.externalProjects.forEach(p => {
					if (p.type === targetType) p.color = newColor;
				});
				
				// Actualizar visualmente inputs en el DOM
				const allRows = body.querySelectorAll('.project-row-item');
				allRows.forEach(row => {
					const typeVal = row.querySelector('.field-type').value;
					if (typeVal === targetType) {
						const colorInput = row.querySelector('.field-color');
						const preview = row.querySelector('.type-color-preview');
						const hexSpan = row.querySelector('.field-color + span');
						
						if (colorInput) {
							colorInput.value = newColor;
							colorInput.style.backgroundColor = newColor;
						}
						if (preview) {
							preview.style.backgroundColor = newColor;
							preview.title = `Kolorea: ${newColor}`;
						}
						if (hexSpan) {
							hexSpan.textContent = newColor;
						}
					}
				});
			};

			// Renderizar cada proyecto
			this.adminCatalogs.externalProjects.forEach((item, index) => {
				const row = document.createElement('div');
				row.className = "project-row-item flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded shadow-sm relative group hover:border-orange-300 transition";
				row.dataset.index = index;
				
				// Usar color del tipo si existe, sino el del item
				const itemColor = typeColorMap[item.type] || item.color || '#3b82f6';

				row.innerHTML = `
					<div class="flex gap-2">
						<div class="w-1/3">
							<label class="block text-[9px] font-bold text-gray-400 uppercase">Agentea</label>
							<div class="flex items-center gap-2">
								<input type="text" 
									   list="agentSuggestions" 
									   class="w-full text-xs font-bold text-gray-700 border-b border-gray-200 focus:border-orange-500 outline-none field-agent" 
									   value="${item.agent || ''}" 
									   placeholder="Erakundea...">
								<div class="text-[8px] text-gray-400 tooltip" title="Aukeratu agente bat zerrendatik edo idatzi berri bat">
									<i class="fas fa-info-circle"></i>
								</div>
							</div>
						</div>
						<div class="w-2/3">
							<label class="block text-[9px] font-bold text-gray-400 uppercase">Proiektuaren Izena</label>
							<input type="text" class="w-full text-sm text-gray-800 border-b border-gray-200 focus:border-orange-500 outline-none field-name" 
								value="${item.name || ''}" placeholder="Proiektuaren izena">
						</div>
					</div>
					
					<div class="flex gap-2 items-end">
						<div class="flex-grow">
							<label class="block text-[9px] font-bold text-gray-400 uppercase">Mota (Tipologia)</label>
							<div class="flex items-center gap-2">
								<input type="text" 
									   list="typeSuggestions" 
									   class="flex-grow text-xs text-gray-500 border-b border-gray-100 focus:border-orange-500 outline-none field-type"
									   value="${item.type || ''}" 
									   placeholder="Idatzi mota bat...">
								<div class="w-3 h-3 rounded-full border border-gray-300 type-color-preview"
									 style="background-color: ${itemColor}"
									 title="Kolorea: ${itemColor}"></div>
							</div>
						</div>
						<div class="w-16">
							<label class="block text-[9px] font-bold text-gray-400 uppercase text-center">Kolorea</label>
							<div class="flex items-center gap-1">
								<input type="color" 
									   class="w-10 h-6 p-0 border-0 rounded cursor-pointer field-color" 
									   value="${itemColor}" 
									   title="Aldatu kolorea">
								<span class="text-[8px] text-gray-500">${itemColor}</span>
							</div>
						</div>
					</div>

					<button class="absolute top-2 right-2 text-gray-200 hover:text-red-500 transition btn-delete" title="Ezabatu">
						<i class="fas fa-trash"></i>
					</button>
				`;

				// Event listener para cambios en el tipo (selecci¨®n desde datalist)
				const typeInput = row.querySelector('.field-type');
				if (typeInput) {
					typeInput.addEventListener('input', (e) => {
						const tipoSeleccionado = e.target.value;
						if (!tipoSeleccionado || !typeColorMap[tipoSeleccionado]) {
							return;
						}
						
						const nuevoColor = typeColorMap[tipoSeleccionado];
						
						// Actualizar UI
						const colorInput = row.querySelector('.field-color');
						const preview = row.querySelector('.type-color-preview');
						const hexSpan = row.querySelector('.field-color + span');
						
						if (colorInput) {
							colorInput.value = nuevoColor;
							colorInput.style.backgroundColor = nuevoColor;
						}
						if (preview) {
							preview.style.backgroundColor = nuevoColor;
							preview.title = `Kolorea: ${nuevoColor}`;
						}
						if (hexSpan) {
							hexSpan.textContent = nuevoColor;
						}
						
						// Actualizar modelo
						this.adminCatalogs.externalProjects[index].color = nuevoColor;
						this.adminCatalogs.externalProjects[index].type = tipoSeleccionado;
					});
				}

				// Funci¨®n para actualizar datos locales
				const updateLocal = (e) => {
					const fieldClass = e.target.classList;
					const currentIndex = parseInt(row.dataset.index);
					
					// Verificar ¨ªndice v¨¢lido
					if (isNaN(currentIndex) || currentIndex < 0 || 
						currentIndex >= this.adminCatalogs.externalProjects.length) {
						return;
					}
					
					// Actualizar seg¨²n campo modificado
					if (fieldClass.contains('field-agent')) {
						this.adminCatalogs.externalProjects[currentIndex].agent = e.target.value;
					}
					else if (fieldClass.contains('field-name')) {
						this.adminCatalogs.externalProjects[currentIndex].name = e.target.value;
					}
					else if (fieldClass.contains('field-type')) {
						const nuevoTipo = e.target.value;
						this.adminCatalogs.externalProjects[currentIndex].type = nuevoTipo;
						
						// Si el tipo tiene color asignado, actualizar
						if (nuevoTipo && typeColorMap[nuevoTipo]) {
							const nuevoColor = typeColorMap[nuevoTipo];
							this.adminCatalogs.externalProjects[currentIndex].color = nuevoColor;
							
							// Actualizar UI
							const colorInput = row.querySelector('.field-color');
							const preview = row.querySelector('.type-color-preview');
							const hexSpan = row.querySelector('.field-color + span');
							
							if (colorInput) {
								colorInput.value = nuevoColor;
								colorInput.style.backgroundColor = nuevoColor;
							}
							if (preview) {
								preview.style.backgroundColor = nuevoColor;
							}
							if (hexSpan) {
								hexSpan.textContent = nuevoColor;
							}
						}
					}
					else if (fieldClass.contains('field-color')) {
						const nuevoColor = e.target.value;
						this.adminCatalogs.externalProjects[currentIndex].color = nuevoColor;
						
						// Sincronizar color para todos los proyectos del mismo tipo
						const currentType = this.adminCatalogs.externalProjects[currentIndex].type;
						if (currentType) {
							syncColorsByType(currentType, nuevoColor);
						}
						
						// Actualizar vista previa
						const preview = row.querySelector('.type-color-preview');
						const hexSpan = row.querySelector('.field-color + span');
						if (preview) preview.style.backgroundColor = nuevoColor;
						if (hexSpan) hexSpan.textContent = nuevoColor;
					}
				};
				
				// A?adir event listeners a todos los inputs
				row.querySelectorAll('input').forEach(input => {
					input.addEventListener('input', updateLocal);
				});
				
				// Bot¨®n eliminar
				row.querySelector('.btn-delete').addEventListener('click', () => {
					if (confirm("Ezabatu proiektu hau?")) {
						this.adminCatalogs.externalProjects.splice(index, 1);
						renderTable();
					}
				});

				body.appendChild(row);
			});

			// Bot¨®n para a?adir nuevo proyecto
			document.getElementById('btnAddProjMaster').addEventListener('click', () => {
				this.adminCatalogs.externalProjects.unshift({ 
					agent: '', 
					name: '', 
					type: '', 
					color: '#94a3b8' 
				});
				renderTable();
			});

			// ?? FUNCI¨®N PARA CREAR DATALISTS
			const createDataLists = () => {
				// Eliminar datalists existentes
				const existingLists = ['typeSuggestions', 'agentSuggestions'];
				existingLists.forEach(id => {
					const list = document.getElementById(id);
					if (list) list.remove();
				});
				
				// Crear datalist para tipos
				if (tiposUnicos.length > 0) {
					const typeDatalist = document.createElement('datalist');
					typeDatalist.id = 'typeSuggestions';
					
					tiposUnicos.forEach(tipo => {
						const op = document.createElement('option');
						op.value = tipo;
						op.dataset.color = typeColorMap[tipo] || '#94a3b8';
						typeDatalist.appendChild(op);
					});
					
					document.body.appendChild(typeDatalist);
					console.log(`? Datalist para tipos creado: ${tiposUnicos.length} opciones`);
				}
				
				// ?? Crear datalist para agentes
				if (agentesUnicos.length > 0) {
					const agentDatalist = document.createElement('datalist');
					agentDatalist.id = 'agentSuggestions';
					
					agentesUnicos.forEach(agent => {
						const op = document.createElement('option');
						op.value = agent;
						// ?? Contar cu¨¢ntos proyectos tiene este agente
						const count = this.adminCatalogs.externalProjects.filter(p => p.agent === agent).length;
						op.dataset.count = count;
						agentDatalist.appendChild(op);
					});
					
					document.body.appendChild(agentDatalist);
					console.log(`? Datalist para agentes creado: ${agentesUnicos.length} opciones`);
				}
			};
			
			createDataLists();
			
			// ?? A?adir contador de agentes en la interfaz
			if (agentesUnicos.length > 0) {
				const counterHTML = `
					<div class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
						<div class="text-[10px] text-blue-700">
							<i class="fas fa-building mr-1"></i>
							<strong>${agentesUnicos.length}</strong> agente desberdin daude katalogoan.
							<span class="text-[9px] text-blue-500 block mt-1">
								Zure kodea: agente berak sartzeko aukera ematen du errepikapenak saihesteko.
							</span>
						</div>
					</div>
				`;
				
				// Insertar despu¨¦s del t¨ªtulo
				const titleContainer = container.querySelector('.flex.justify-between');
				if (titleContainer) {
					titleContainer.insertAdjacentHTML('afterend', counterHTML);
				}
			}
		};

		renderTable();

		// Configurar bot¨®n guardar
		const saveBtn = this._setupSaveButtonRaw(modal);
		saveBtn.onclick = async () => {
			saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
			try {
				// ?? Normalizar agentes antes de guardar (opcional)
				this.adminCatalogs.externalProjects.forEach(p => {
					if (p.agent) {
						// Eliminar espacios extra, capitalizar primera letra, etc.
						p.agent = p.agent.trim();
						// Puedes a?adir m¨¢s normalizaci¨®n aqu¨ª si quieres
					}
				});
				
				const { error } = await this.supabase
					.from('admin_external_projects')
					.upsert(this.adminCatalogs.externalProjects, { onConflict: 'id' }); 

				if (error) throw error;
				
				alert("Proiektu katalogoa eguneratuta!");
				modal.classList.add('hidden');
				this.loadCatalogs(); 

			} catch (e) {
				console.error(e);
				alert("Errorea: " + e.message);
			} finally {
				saveBtn.innerHTML = 'Gorde Aldaketak';
			}
		};

		modal.classList.remove('hidden');
	}

// ?? FUNCION 2: SELECTOR DE ASIGNATURA (Checklist)
    openProjectsSelector() {
        if (!this.currentSubject) return;
        // ... (configuraci¨®n modal igual) ...
        const modal = document.getElementById('listEditorModal');
        const container = document.getElementById('listEditorContainer');
        const titleEl = document.getElementById('listEditorTitle');
        const inputTop = document.getElementById('newItemInput')?.parentElement;
        if(inputTop) inputTop.classList.add('hidden');
        if(titleEl) titleEl.innerHTML = `<i class="fas fa-handshake mr-2 text-orange-500"></i> Aukeratu Kanpo Proiektuak`;

        container.innerHTML = `
            <div class="mb-3 sticky top-0 bg-white pb-2 z-10 border-b pt-1">
                <input type="text" id="projFilter" placeholder="Bilatu agentea, mota edo izena..." 
                    class="w-full text-sm border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 p-2 bg-gray-50">
            </div>
            <div id="projList" class="space-y-2 pb-2"></div>
        `;

        const renderList = (filter = "") => {
            const listDiv = document.getElementById('projList');
            listDiv.innerHTML = '';
            
            // Lista seleccionada actualmente en la asignatura
            const currentSelected = this.currentSubject.context?.external_projects || this.currentSubject.extProy || [];
            
            // Filtrar cat¨¢logo global
            const filtered = this.adminCatalogs.externalProjects.filter(p => {
                const term = filter.toLowerCase();
                return (p.name || '').toLowerCase().includes(term) || 
                       (p.agent || '').toLowerCase().includes(term) || 
                       (p.type || '').toLowerCase().includes(term);
            });

            if (filtered.length === 0) {
                listDiv.innerHTML = '<div class="text-center text-gray-400 text-sm italic">Ez da ezer aurkitu.</div>';
                return;
            }

            filtered.forEach(item => {
                // Comprobamos si est¨¢ seleccionado (por ID si existe, o por nombre/agente)
                const isActive = currentSelected.some(sel => 
                    (sel.id && sel.id === item.id) || 
                    (sel.name === item.name && sel.agent === item.agent)
                );

                const row = document.createElement('div');
                row.className = `flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition group ${isActive ? 'bg-orange-50 border-orange-200' : 'bg-white hover:border-orange-300'}`;
                
                row.innerHTML = `
                    <div class="${isActive ? 'text-orange-600' : 'text-gray-300 group-hover:text-orange-400'}">
                        <i class="fas ${isActive ? 'fa-check-square' : 'fa-square'} text-lg"></i>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between">
                            <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wide">${item.agent || 'Agente gabe'}</span>
                            <span class="text-[9px] text-gray-400">${item.type || ''}</span>
                        </div>
                        <div class="text-sm font-semibold text-gray-800">${item.name}</div>
                    </div>
                `;

                row.onclick = () => {
                    let list = this.currentSubject.context?.external_projects || [];
                    if (isActive) {
                        // Desmarcar (filtrar fuera)
                        list = list.filter(x => x.id !== item.id && x.name !== item.name);
                    } else {
                        // Marcar (a?adir objeto)
                        list.push(item);
                    }
                    
                    if(!this.currentSubject.context) this.currentSubject.context = {};
                    this.currentSubject.context.external_projects = list;
                    this.currentSubject.extProy = list;
                    
                    renderList(filter);
                };
                listDiv.appendChild(row);
            });
        };
        // ... (eventos de filtro y guardado igual que antes) ...
        document.getElementById('projFilter').oninput = (e) => renderList(e.target.value);
        renderList();

        const saveBtn = this._setupSaveButtonRaw(modal);
        saveBtn.onclick = async () => {
            await this.saveData();
            modal.classList.add('hidden');
            if(window.ui) window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
        };
        modal.classList.remove('hidden');
    }

	// Helper para configurar el bot¨®n guardar de estos modales
	_setupSaveButtonForSelector(modal) {
        const oldBtn = modal.querySelector('button[onclick*="saveListEditor"]');
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);

        newBtn.onclick = async () => {
            // Feedback visual de guardado
            const originalText = newBtn.innerHTML;
            newBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
            newBtn.disabled = true;

            try {
                // Si es grado, guarda el grado entero. Si es asignatura, solo asignatura.
                if (this.isEditingDegree) {
                    await this.saveData(); // Esto deber¨ªa guardar el grado actual
                } else {
                    await this.saveData(); // O saveSubjectBasicData() si lo tienes separado
                }
                
                modal.classList.add('hidden');
                
                // Refrescar UI si es necesario
                if(window.ui && this.currentSubject && !this.isEditingDegree) {
                    window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
                }
                
            } catch (e) {
                console.error("Error guardando:", e);
                alert("Errorea gordetzerakoan.");
            } finally {
                newBtn.innerHTML = originalText;
                newBtn.disabled = false;
                
                // Restaurar UI del modal
                const inputTop = document.getElementById('newItemInput')?.parentElement;
                if(inputTop) inputTop.classList.remove('hidden');
            }
        };
    }

    openListEditor(field, title, isDegree = false) {
        this.isEditingDegree = isDegree; 
        this.currentEditingField = field;

        if (!isDegree && !this.currentSubject) return;
        if (isDegree && !this.currentDegree) return;
        
        // 1. Configurar T¨ªtulo
        const titleEl = document.getElementById('listEditorTitle');
        if(titleEl) titleEl.innerHTML = `<i class="fas fa-list-ul opacity-75 mr-2"></i> ${title}`;
        
        // 2. Limpiar input de "Nuevo Elemento"
        const inputNew = document.getElementById('newItemInput');
        if(inputNew) inputNew.value = '';

        // 3. Configurar bot¨®n de "A?adir" del nuevo dise?o
		const btnAdd = document.getElementById('btnAddNewItem');
        if(btnAdd) {
            btnAdd.onclick = () => {
                const inputNew = document.getElementById('newItemInput');
                if(!inputNew) return;
                
                const val = inputNew.value.trim();
                if(val) {
                    this.addListItem(val); // <--- LLAMA A TU FUNCI¨®N ACTUALIZADA
                    inputNew.value = '';
                    inputNew.focus();
                }
            };
        }

        // 4. Obtener datos
        let currentData = [];
        if (isDegree) {
            currentData = this.currentDegree[field] || [];
        } else {
            // Soporte para datos viejos y nuevos (context)
            const ctx = this.currentSubject.context || {};
            currentData = ctx[field] || this.currentSubject[field] || [];
        }

        // 5. Pintar lista inicial
        const container = document.getElementById('listEditorContainer');
        if(container) {
            container.innerHTML = '';
            // Si es string o array de strings
            if (Array.isArray(currentData)) {
                currentData.forEach(item => {
                    // Si guardaste objetos, intentamos sacar el texto, si no, el item tal cual
                    const text = (typeof item === 'object') ? (item.name || item.code || '') : item;
                    this.addListItem(item);
                });
            }
            
            // Estado vac¨ªo inicial
            if(container.children.length === 0) {
               container.innerHTML = `<div id="emptyStateMsg" class="text-center py-8 text-gray-400 italic text-sm">Ez dago elementurik zerrendan.<br>Erabili goiko panela gehitzeko.</div>`;
            }
        }

        // 6. Mostrar Modal
        const modal = document.getElementById('listEditorModal');
        if(modal) modal.classList.remove('hidden');
    }

	addListItem(value = "") {
			const container = document.getElementById('listEditorContainer');
			if (!container) return;

			// 1. Limpiar mensaje de "vac¨ªo" si existe
			const emptyMsg = document.getElementById('emptyStateMsg');
			if (emptyMsg) emptyMsg.remove();

			// 2. Crear el contenedor de la fila
			const div = document.createElement('div');
			// Estilo moderno: Tarjeta blanca con sombra suave y borde
			div.className = 'group flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all mb-2 animate-fadeIn';
			
			// 3. Manejo inteligente de Objetos vs Texto
			let textValue = value;
			if (typeof value === 'object' && value !== null) {
				// Intenta buscar cualquier propiedad que parezca un nombre o descripci¨®n
				textValue = value.name || value.zhDesc || value.desc || value.description || value.code || "";
			}

			// 4. HTML interno (Icono agarre + Input limpio + Bot¨®n borrar)
			div.innerHTML = `
				<div class="text-gray-300 cursor-grab active:cursor-grabbing">
					<i class="fas fa-grip-vertical"></i>
				</div>

				<input type="text" 
					   class="list-item-input flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-700 font-medium placeholder-gray-300" 
					   value="${textValue}" 
					   placeholder="Idatzi hemen...">

				<button onclick="this.closest('.group').remove()" 
						class="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition duration-200"
						title="Ezabatu">
					<i class="fas fa-trash-alt"></i>
				</button>
			`;

			container.appendChild(div);
			
			// Auto-scroll al final para ver el nuevo elemento
			container.scrollTop = container.scrollHeight;
		}

	
// ----------------------------------------------------------------------
    // 2. EDITOR DE RA DE ASIGNATURA (MODAL)
    // ----------------------------------------------------------------------
openRaEditor() {
        if (!this.currentSubject) return;
        
        const modal = document.getElementById('raModal');
        // Ziurtatu editatzeko edukiontzia existitzen dela HTMLan
        // Normalean 'detailRasListEdit' izena du
        const container = document.getElementById('detailRasListEdit'); 
        
        if (!modal || !container) {
            console.error("? Ez da 'raModal' edo 'detailRasListEdit' aurkitu HTMLan.");
            return;
        }

        console.log("?? RA Editorea irekitzen:", this.currentSubject.name);

        // 1. IRTEERAKO KONPETENTZIAK PRESTATU (Loturak egiteko)
        // Defektuz 'egreso' erabiltzen dugu, baina hutsik badago 'konpetentziak.irteera' begira dezakegu
        let comps = this.currentDegree?.competencies?.egreso || [];
        
        // Egitura alternatiboa (JSON berriaren arabera)
        if ((!comps || comps.length === 0) && this.currentDegree?.konpetentziak?.irteera) {
            comps = this.currentDegree.konpetentziak.irteera;
        }

        // Ordenatu kodearen arabera (garbiago ikusteko)
        this.tempEgresoComps = [...comps].sort((a, b) => {
            const codeA = a.autoCode || a.code || '';
            const codeB = b.autoCode || b.code || '';
            return codeA.localeCompare(codeB);
        });

        // 2. HTML EGITURA NAGUSIA SORTU
        // Bi zutabe: Ezkerra (Teknikoak) eta Eskuina (Zeharkakoak)
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4 h-full">
                <div class="flex flex-col border rounded-lg overflow-hidden bg-white shadow-sm h-full">
                    <div class="bg-blue-50 p-3 border-b border-blue-100 flex justify-between items-center shrink-0">
                        <span class="font-bold text-xs text-blue-800 uppercase tracking-wider">
                            <i class="fas fa-cogs mr-1"></i> Emaitza Teknikoak (RA)
                        </span>
                        <span class="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full" title="Kopurua">
                            ${(this.currentSubject.currentOfficialRAs || []).length}
                        </span>
                    </div>
                    
                    <div id="editListTec" class="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 relative custom-scrollbar">
                        </div>
                    
                    <button onclick="gradosManager.addRaRow('tec')" 
                        class="p-3 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700 text-center font-bold border-t transition-colors shrink-0 flex items-center justify-center gap-2">
                        <i class="fas fa-plus-circle"></i> Gehitu RA Teknikoa
                    </button>
                </div>

                <div class="flex flex-col border rounded-lg overflow-hidden bg-white shadow-sm h-full">
                    <div class="bg-teal-50 p-3 border-b border-teal-100 flex justify-between items-center shrink-0">
                        <span class="font-bold text-xs text-teal-800 uppercase tracking-wider">
                            <i class="fas fa-users mr-1"></i> Zeharkakoak (ZH)
                        </span>
                        <button onclick="gradosManager.agregarZHDelCatalogo()" 
                            class="text-[10px] bg-teal-600 hover:bg-teal-700 text-white px-2 py-1 rounded shadow-sm transition-colors flex items-center gap-1">
                            <i class="fas fa-book-open"></i> Katalogoa
                        </button>
                    </div>
                    
                    <div id="editListZh" class="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 relative custom-scrollbar">
                        </div>
                    
                    <button onclick="gradosManager.addRaRow('zh')" 
                        class="p-3 text-xs text-teal-600 hover:bg-teal-50 hover:text-teal-700 text-center font-bold border-t transition-colors shrink-0 flex items-center justify-center gap-2">
                        <i class="fas fa-plus-circle"></i> Gehitu ZH Berria
                    </button>
                </div>
            </div>`;

        // 3. ZERRENDAK BETE DATUEKIN
        // Lehenik garbitu (badaezpada)
        const listTec = document.getElementById('editListTec');
        const listZh = document.getElementById('editListZh');
        listTec.innerHTML = '';
        listZh.innerHTML = '';

        // A) RA TEKNIKOAK KARGATU
        const tecs = this.currentSubject.currentOfficialRAs || [];
        if (tecs.length > 0) {
            tecs.forEach(ra => this.addRaRow('tec', ra));
        } else {
            // Mezu bat zerrenda hutsik badago
            listTec.innerHTML = `<div class="text-center p-4 text-gray-400 text-xs italic">Ez dago emaitza teknikorik oraindik.</div>`;
        }

        // B) ZEHARKAKOAK KARGATU
        const zhs = this.currentSubject.zhRAs || [];
        if (zhs.length > 0) {
            zhs.forEach(zh => this.addRaRow('zh', zh));
        } else {
            listZh.innerHTML = `<div class="text-center p-4 text-gray-400 text-xs italic">Ez dago zeharkako konpetentziarik.</div>`;
        }

        // 4. DRAG AND DROP AKTIBATU
        // Elementuak ordenatzeko
        this.setupDragAndDrop('editListTec');
        this.setupDragAndDrop('editListZh');

        // 5. MODALA ERAKUTSI
        modal.classList.remove('hidden');
    }
		
// M¨¦todo auxiliar para crear filas
createRaRow(type, index, data = {}) {
    const isZh = type === 'zh';
    const div = document.createElement('div');
    div.className = `flex gap-2 p-2 bg-white border rounded ${isZh ? 'border-teal-100' : 'border-blue-100'} group ra-row`;
    
    // Mapeo flexible: intenta leer la nueva clave, si no la vieja
    const code = isZh ? (data.zhCode || data.zhCode || data.code || '') : (data.raCode || data.code || '');
    const desc = isZh ? (data.zhDesc || data.zhDesc || data.desc || '') : (data.raDesc || data.desc || '');
    
    div.innerHTML = `
        <span class="${isZh ? 'text-teal-600' : 'text-blue-600'} font-bold text-xs mt-1 w-6">${index}</span>
        <div class="flex-1 space-y-1">
            <div class="flex gap-2">
                <input type="text" class="raCode w-32 text-xs font-bold border-b focus:outline-none" value="${code}" placeholder="Kodea">
                <button onclick="this.closest('.ra-row').remove()" class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <textarea class="ra-desc w-full text-xs border rounded p-1 resize-y min-h-[60px]" rows="2" placeholder="Deskribapena...">${desc}</textarea>
        </div>
    `;
    return div;
}	


    // ----------------------------------------------------------------------
    // 3. GUARDADO DEL EDITOR (CRUCIAL: IMPORTA CRITERIOS DEL CAT¨¢LOGO)
// En grados-manager.js

guardarRAsDesdeEditor() {
        if (!this.currentSubject) return;

        // 1. RA TEKNIKOAK GORDE
        const tecRows = document.querySelectorAll('#editListTec .group');
        const newRAs = [];

        tecRows.forEach((row, index) => {
            const desc = row.querySelector('.ra-input-desc').value.trim();
            // Hemen irakurtzen dugu selektore berria:
            const linkSelect = row.querySelector('.ra-input-link'); 
            const linkedComp = linkSelect ? linkSelect.value : "";

            if (desc) {
                newRAs.push({
                    code: `RA-${index + 1}`, // RA-1, RA-2... automatikoa
                    raDesc: desc,
                    linkedCompetency: linkedComp // <--- EREMU BERRIA
                });
            }
        });

        this.currentSubject.currentOfficialRAs = newRAs;

        // 2. ZH (ZEHARKAKOAK) GORDE
        const zhRows = document.querySelectorAll('#editListZh .group');
        const newZHs = [];

        zhRows.forEach(row => {
            const desc = row.querySelector('.ra-input-desc').value.trim();
            const codeInput = row.querySelector('.ra-input-code');
            const code = codeInput ? codeInput.value : '';

            if (desc) {
                newZHs.push({
                    zhCode: code,
                    zhDesc: desc
                });
            }
        });

        this.currentSubject.zhRAs = newZHs;

        // 3. GORDE ETA ITXI
        this.saveData();
        
        // UI Eguneratu (Detaile bista irekita badago)
        if (window.ui && window.ui.renderSubjectDetail) {
             // Berriro renderizatu aldaketak ikusteko
            window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
        }
        
        document.getElementById('raModal').classList.add('hidden');
        console.log("?? RAs eta loturak gordeta.");
    }

// Nuevo m¨¦todo para actualizar todas las vistas
	actualizarVistasRA() {
		const subject = this.currentSubject;
		
		// 1. Actualizar panel lateral de RAs
		this.updateDetailRasList();
		
		// 2. Actualizar matriz de alineaci¨®n si est¨¢ visible
		if (window.matricesInteractivas && document.getElementById('matricesPanel')) {
			window.matricesInteractivas.renderMatrizAlineacionRA();
		}
		
		// 3. Actualizar detalles de la asignatura
		if (window.ui && window.ui.renderSubjectDetail) {
			window.ui.renderSubjectDetail(subject, this.currentDegree);
		}
	}
	
// En grados-manager.js

    async saveListEditor() {  // <--- ?F¨ªjate en el 'async' aqu¨ª!
        if (!this.currentEditingField) return;
        
        const fieldName = this.currentEditingField;
        const isDegree = this.isEditingDegree; 

        console.log(`?? Guardando lista "${fieldName}" en ${isDegree ? 'GRADUA' : 'IRAKASGAIA'}`);
        
        const inputs = document.querySelectorAll('.list-item-input');
        const newList = Array.from(inputs)
            .map(i => i.value.trim())
            .filter(v => v !== "");
        
        // 1. ACTUALIZAR EL OBJETO EN MEMORIA
        if (isDegree) {
            // Guardar en el objeto Grado
            this.currentDegree[fieldName] = newList;
            
            // Refrescar Sidebar inmediatamente
            if (window.ui && window.ui.renderSidebar) {
                window.ui.renderSidebar(this.currentDegree);
            }
        } else {
            // Guardar en el objeto Asignatura
            if (!this.currentSubject) return;
            
            // Si el campo no existe en 'context', lo creamos o actualizamos
            // Nota: Aqu¨ª asumo que usas 'context' para las listas nuevas (IDU, ODS...)
            // Si usas propiedades directas, ajusta esto.
            const target = this.currentSubject.context ? this.currentSubject.context : this.currentSubject;
            target[fieldName] = newList;

            // Refrescar Detalle Asignatura
            if (window.ui && window.ui.renderSubjectDetail) {
                window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
            }
        }
        
        // 2. GUARDAR EN SUPABASE (BD)
        // Usamos 'await' para esperar a que se guarde antes de cerrar el modal
        try {
            await this.saveData(); 
            console.log("? Datos guardados correctamente en BD");
        } catch (e) {
            console.error("? Error al guardar en BD:", e);
            // Aqu¨ª podr¨ªas mostrar un aviso al usuario si falla
        }

        // 3. CERRAR MODAL
        const modal = document.getElementById('listEditorModal');
        if(modal) modal.classList.add('hidden');
    }
	
// Funci¨®n auxiliar para no repetir HTML
	templateRA(codigo, desc, color, etiqueta) {
		return `
			<div class="flex gap-3 items-start p-2 border-l-4 border-${color}-400 bg-${color}-50/30 rounded mb-2">
				<div class="flex-1">
					<div class="flex justify-between mb-1">
						<span class="text-xs font-bold text-${color}-700">${codigo}</span>
						<span class="text-[10px] text-gray-400">${etiqueta}</span>
					</div>
					<p class="text-xs text-gray-600">${desc || 'Deskribapenik gabe'}</p>
				</div>
			</div>`;
	}

addRaRow(type, data = {}) {
    const isZh = type === 'zh';
    const containerId = isZh ? 'editListZh' : 'editListTec';
    const container = document.getElementById(containerId);
    
    if (!container) return;

    const colorClass = isZh ? 'teal' : 'blue';

    // Datuak prestatu
    let codeValue = '';
    let descValue = '';

    if (isZh) {
        codeValue = data.zhCode || data.subjectZhCode || data.code || data.id || '';
        descValue = data.zhDesc || data.subjectZhDesc || data.desc || '';
    } else {
        codeValue = data.raCode || data.code || data.id || '';
        descValue = data.raDesc || data.desc || '';
    }

    // Kode automatikoa hutsik badago
    if (!codeValue) {
        const count = container.children.length + 1;
        const prefix = (this.currentSubject && this.currentSubject.autoCode) 
            ? this.currentSubject.autoCode.split('_')[0] 
            : 'GEN';
        const suffix = isZh ? 'ZH' : 'RA';
        codeValue = `${prefix}_${suffix}${String(count).padStart(2, '0')}`;
    }

    // --- HEMEN DAGO GAKOA: SELEKTOREA TITULUEKIN ---
    let options = '<option value="">-- Lotura gabe --</option>';
    if (this.tempEgresoComps) {
        options += this.tempEgresoComps.map(c => {
            // Saiatu hainbat eremu deskribapena aurkitzeko
            const cCode = c.code || c.autoCode || '';
            const rawText = c.text || c.desc || c.description || c.title || ''; 
            
            // Moztu testua luzeegia bada
            const truncatedText = rawText.length > 50 ? rawText.substring(0, 50) + '...' : rawText;
            
            const selected = (data.linkedCompetency === cCode) ? 'selected' : '';
            
            // Emaitza: "C1 - Talde lana..."
            return `<option value="${cCode}" ${selected}>${cCode} - ${truncatedText}</option>`;
        }).join('');
    }

    // HTML Sortu
    const div = document.createElement('div');
    div.className = `ra-row flex gap-2 items-start bg-white p-2 rounded border border-${colorClass}-200 mb-2 shadow-sm`;
    
    div.innerHTML = `
        <div class="flex flex-col gap-1 w-24 shrink-0">
            <input type="text" 
                class="ra-code w-full p-1 border rounded text-[10px] font-bold text-${colorClass}-700 text-center uppercase" 
                value="${codeValue}" 
                placeholder="KODEA">
        </div>
        <div class="flex-1 flex flex-col gap-1">
            <textarea 
                class="ra-desc w-full text-xs p-1.5 border rounded min-h-[40px] focus:ring-1 focus:ring-${colorClass}-300 outline-none" 
                placeholder="Deskribapena...">${descValue}</textarea>
            
            <select class="ra-link w-full text-[10px] p-1 border rounded bg-gray-50 text-gray-700">
                ${options}
            </select>
        </div>
        <button onclick="this.closest('.ra-row').remove()" class="text-gray-300 hover:text-red-500 px-1 self-start mt-1">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;

    container.appendChild(div);
}

	
setupDragAndDrop(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let draggedItem = null;

        // Delegazioa erabiltzen dugu (ez dugu event listener bat jartzen lerro bakoitzean)
        container.addEventListener('dragstart', (e) => {
            // Ziurtatu '.ra-row' ari garela arrastatzen
            const row = e.target.closest('.ra-row');
            if (!row) return;

            draggedItem = row;
            e.dataTransfer.effectAllowed = 'move';
            // Arrastatzen den bitartean gardenago jarri
            setTimeout(() => row.classList.add('opacity-50', 'border-dashed', 'border-2'), 0);
        });

        container.addEventListener('dragend', (e) => {
            const row = e.target.closest('.ra-row');
            if (row) {
                row.classList.remove('opacity-50', 'border-dashed', 'border-2');
            }
            draggedItem = null;
            
            // Kodeak berrantolatu nahi badituzu (adib: RA1, RA2...) 
            // hemen deitu dezakezu 'recalcIds(containerId)' funtzio bat.
            // Nik oraingoz IDak EZ ukitzea gomendatzen dizut, nahasgarria izan daitekeelako.
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault(); // Drop baimendu
            const afterElement = getDragAfterElement(container, e.clientY);
            
            if (afterElement == null) {
                container.appendChild(draggedItem);
            } else {
                container.insertBefore(draggedItem, afterElement);
            }
        });

        // Helper funtzioa jakiteko non utzi elementua
        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.ra-row:not(.dragging)')];

            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
    }

	
// ************** FUNTZIO BERRIA: KODEAK NORMALIZATU GORDETZERAKO **************
normalizarCodigosAlGuardar(subject, tecRAs, zhRAs) {
    if (!subject) return;
    
    // Obtener prefijo base desde autoCode (como en generateUnitAutoCode)
    let basePrefix = '';
    if (subject.autoCode) {
        const parts = subject.autoCode.split('_');
        if (parts.length >= 2) {
            basePrefix = parts.slice(0, 2).join('_'); // "BD1_1NEU"
        }
    }
    
    // Si no hay autoCode, calcularlo
    if (!basePrefix) {
        const grado = subject.degreeCode || "BD";
        const curso = subject.course || subject.year || "1";
        const periodo = subject.term || subject.semester || "1";
        const rawName = subject.name || subject.subjectTitle || "ASIG";
        const cleanName = rawName.replace(/[0-9IVX\.\s]/g, '').toUpperCase();
        const acronimo = cleanName.substring(0, 3).padEnd(3, 'X');
        
        basePrefix = `${grado}${curso}_${periodo}${acronimo}`;
    }
    
    // Normalizar RAs t¨¦cnicos
    tecRAs.forEach((ra, index) => {
        if (ra.code && !ra.code.startsWith(basePrefix)) {
            // Mantener el n¨²mero secuencial si existe
            const match = ra.code.match(/(RA|ZH)(\d+)$/);
            if (match) {
                const tipo = "RA"; // Siempre RA para t¨¦cnicos
                const numero = match[2] || String(index + 1).padStart(2, '0');
                ra.code = `${basePrefix}_${tipo}${numero}`;
                ra.id = ra.code; // Tambi¨¦n actualizar ID
            } else {
                ra.code = `${basePrefix}_RA${String(index + 1).padStart(2, '0')}`;
                ra.id = ra.code;
            }
        }
    });
    
    // Normalizar RAs transversales (ZH)
    zhRAs.forEach((zh, index) => {
        if (zh.code && !zh.code.startsWith(basePrefix)) {
            const match = zh.code.match(/(RA|ZH)(\d+)$/);
            if (match) {
                const tipo = "ZH"; // Siempre ZH para transversales
                const numero = match[2] || String(index + 1).padStart(2, '0');
                zh.code = `${basePrefix}_${tipo}${numero}`;
                zh.id = zh.code;
            } else {
                zh.code = `${basePrefix}_ZH${String(index + 1).padStart(2, '0')}`;
                zh.id = zh.code;
            }
        }
    });
}

// Aldaketak egiteko funtzio temporala:

	
saveRaChanges() {
    const s = this.currentSubject;
    if (!s) return;

    console.log("?? Aldaketak gordetzen (saveData bidez)...");

    // 1. TEKNIKOAK BILDU
    const tecRows = document.querySelectorAll('#editListTec .ra-row');
    s.currentOfficialRAs = Array.from(tecRows).map(row => {
        const code = row.querySelector('.ra-code')?.value.trim() || '';
        const desc = row.querySelector('.ra-desc')?.value.trim() || '';
        const linked = row.querySelector('.ra-link')?.value || ''; // Lotura ere gorde

        return {
            id: code,
            code: code,                   // Bateragarritasuna
            raCode: code,                 // Estandarra
            raDesc: desc,                 // Estandarra
            desc: desc,                   // Bateragarritasuna
            linkedCompetency: linked      // Lotura
        };
    });

    // 2. ZEHARKAKOAK BILDU
    const zhRows = document.querySelectorAll('#editListZh .ra-row');
    s.subjectZhRAs = Array.from(zhRows).map(row => {
        const code = row.querySelector('.ra-code')?.value.trim() || '';
        const desc = row.querySelector('.ra-desc')?.value.trim() || '';
        const linked = row.querySelector('.ra-link')?.value || ''; // Lotura ere gorde

        return {
            id: code,
            subjectZhCode: code,          // Bateragarritasuna
            zhCode: code,                 // Estandarra
            subjectZhDesc: desc,          // Bateragarritasuna
            zhDesc: desc,                 // Estandarra
            desc: desc,                   // Backup
            linkedCompetency: linked      // Lotura
        };
    });

    // 3. Gorde egitura osoa (saveData erabiliz)
    if (this.saveData) {
        this.saveData(); 
    } else {
        console.error("? 'saveData' funtzioa ez da aurkitu GradosManager-en.");
    }
    
    // 4. Itxi modala
    const modal = document.getElementById('raModal');
    if (modal) modal.classList.add('hidden');
    
    // 5. Bista freskatu
    if (window.ui && typeof window.ui.renderSubjectDetail === 'function') {
        window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
    }
}

    normalizarCodigosAlGuardar(subject, tecRAs, zhRAs) {
        // Zure kode zaharraren normalizazioa jarri hemen
        console.log("Kodeak normalizatzen...", subject, tecRAs, zhRAs);
        
        // Adibidez:
        // 1. Teklikoak formatu koherentean
        tecRAs.forEach(ra => {
            if (ra.code && !ra.code.includes('_')) {
                ra.code = `${subject.subjectCode}_${ra.code}`;
            }
        });
        
        // 2. Zeharkakoak ZH formatuan
        zhRAs.forEach(ra => {
            if (ra.code && !ra.code.toUpperCase().includes('ZH')) {
                const num = ra.code.replace(/\D/g, '');
                ra.code = `${subject.subjectCode}_ZH${num.padStart(2, '0')}`;
            }
        });
    }

    showToast(message, type = 'info') {
        // Alert sinple bat edo toast sistema bat
        alert(`? ${message}`);
    }

	
	openPreReqEditor() {
		if (!this.currentSubject) return;

		// 1. Setup del Modal
		const modal = document.getElementById('listEditorModal');
		const container = document.getElementById('listEditorContainer');
		const titleEl = document.getElementById('listEditorTitle');
		const inputTop = document.getElementById('newItemInput')?.parentElement;
		
		if (inputTop) inputTop.classList.add('hidden');
		if (titleEl) titleEl.innerHTML = `<i class="fas fa-layer-group mr-2 text-indigo-500"></i> Aurre-ezagutzak (Automatikoa)`;

		// 2. Inicializar datos locales
		if (!this.currentSubject.context) this.currentSubject.context = {};
		if (!Array.isArray(this.currentSubject.context.preReq)) {
			this.currentSubject.context.preReq = [];
		}
		const localList = this.currentSubject.context.preReq;

		// ---------------------------------------------------------
		// 3. ? FUNCI¨®N CONFIRMADA PARA LEER ¨¢REAS (igual que openEditSubjectModal)
		// ---------------------------------------------------------
		const getAreasFromSystem = () => {
			const areaColorMap = {};
			
			console.log("?? Leyendo ¨¢reas del sistema...");
			
			// VERIFICADO: Las ¨¢reas est¨¢n en currentDegree.subjectAreas
			if (this.currentDegree?.subjectAreas) {
				const areas = this.currentDegree.subjectAreas;
				
				console.log(`Encontradas ${areas.length} ¨¢reas en currentDegree.subjectAreas`);
				
				areas.forEach(area => {
					if (area && area.name) {
						// Usar el color directamente (est¨¢ en formato HSL)
						areaColorMap[area.name] = area.color || 'hsl(0, 0%, 70%)';
						console.log(`  ? "${area.name}" -> ${areaColorMap[area.name]}`);
					}
				});
			} else {
				console.warn("?? No se encontraron ¨¢reas en currentDegree.subjectAreas");
				
				// Fallback: usar ui.getAreaColor si est¨¢ disponible
				if (window.ui && window.ui.getAreaColor) {
					// Intentar con ¨¢reas conocidas del sidebar
					const areaNames = [
						"DISEINU PROIEKTUAK ETA METODOLOGIAK",
						"ERAIKUNTZA ETA TEKNOLOGIA",
						"DISEINUAREN IKUS-ADIERAZPENA",
						"DISEINUAREN OINARRIAK",
						"KUDEAKETA ETA PROFESIONALTASUNA"
					];
					
					areaNames.forEach(name => {
						const color = window.ui.getAreaColor(name, this.currentDegree);
						if (color) {
							areaColorMap[name] = color;
						}
					});
				}
			}
			
			console.log(`? Total ¨¢reas disponibles: ${Object.keys(areaColorMap).length}`);
			return areaColorMap;
		};

		const areaColorMap = getAreasFromSystem();
		const areaCount = Object.keys(areaColorMap).length;
		
		// Funci¨®n para convertir HSL a un formato usable
		const parseColor = (hsl) => {
			if (!hsl) return '#94a3b8';
			// Si ya es HEX, devolverlo
			if (hsl.startsWith('#')) return hsl;
			// Si es HSL, mantenerlo como est¨¢ (CSS lo entiende)
			if (hsl.startsWith('hsl')) return hsl;
			// Por defecto
			return '#94a3b8';
		};

		// ---------------------------------------------------------
		// 4. GENERADOR DE C¨®DIGO MEJORADO
		// ---------------------------------------------------------
		const generateAutoCode = (index) => {
			const subjectName = this.currentSubject.name || this.currentSubject.subjectTitle || "ASIG";
			const cleanName = subjectName.replace(/^[\d\.\s]+/, '').trim();
			
			// Identificar n¨²mero romano o secuencia
			const romanMap = {
				' VIII': '8', ' VII': '7', ' VI': '6', ' V': '5', 
				' IV': '4', ' III': '3', ' II': '2', ' I': '1'
			};
			
			let numSuffix = '';
			let baseName = cleanName;
			
			for (const [roman, num] of Object.entries(romanMap)) {
				if (cleanName.toUpperCase().endsWith(roman)) {
					numSuffix = num;
					baseName = cleanName.substring(0, cleanName.length - roman.length).trim();
					break;
				}
			}
			
			// Si no encuentra romano, buscar n¨²mero ar¨¢bigo
			if (!numSuffix) {
				const arabicMatch = cleanName.match(/(\d+)$/);
				if (arabicMatch) {
					numSuffix = arabicMatch[1];
					baseName = cleanName.substring(0, cleanName.length - arabicMatch[0].length).trim();
				}
			}
			
			// Extraer las tres primeras letras (excluyendo n¨²meros y espacios)
			const letters = baseName.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
			const seq = String(index + 1).padStart(2, '0');
			
			// Formato: AE_numeroLETRAS_secuencia
			// Ejemplo: "Proyectos I" -> AE_1PRO_01, "Proyectos II" -> AE_2PRO_01
			return `AE_${numSuffix || ''}${letters}_${seq}`;
		};

		// ---------------------------------------------------------
		// 5. RENDERIZAR EDITOR - VERSI¨®N DEFINITIVA
		// ---------------------------------------------------------
		const renderTable = () => {
			container.innerHTML = `
				<div class="mb-4">
					<div class="flex justify-between items-center mb-3">
						<span class="text-[10px] text-gray-400 italic">
							<i class="fas fa-robot mr-1"></i> Kodeak automatikoak dira.
						</span>
						<button id="btnAddPreReq" class="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded border border-indigo-200 hover:bg-indigo-100 font-bold transition">
							<i class="fas fa-plus mr-1"></i> Gehitu Aurre-ezagutza
						</button>
					</div>
					
					${areaCount === 0 ? `
					<div class="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
						<div class="flex items-start">
							<i class="fas fa-exclamation-triangle text-yellow-500 mt-0.5 mr-2"></i>
							<div>
								<p class="text-xs font-bold text-yellow-800 mb-1">Ez daude eremuak definituak</p>
								<p class="text-[11px] text-yellow-700">
									Defina ¨¢reas primero en el sidebar o en los datos del grado.
								</p>
							</div>
						</div>
					</div>
					` : `
					<div class="text-[10px] text-gray-500 mb-2">
						<i class="fas fa-check-circle text-green-500 mr-1"></i>
						${areaCount} eremu aurkituak. Erabili autobetetzea.
					</div>
					`}
				</div>
				
				<div class="flex gap-2 px-3 mb-1 text-[9px] font-bold text-gray-400 uppercase">
					<div class="w-1/4">Kodea</div>
					<div class="w-2/5">Izena</div>
					<div class="w-2/5">Ezagutza Eremua</div>
					<div class="w-8"></div>
				</div>

				<div id="preReqTableBody" class="space-y-2 pb-4 max-h-[60vh] overflow-y-auto pr-1"></div>
				
				<!-- Datalist para autocompletar -->
				<datalist id="preReqAreasList"></datalist>
			`;

			const body = document.getElementById('preReqTableBody');
			
			// Crear/actualizar datalist
			let datalist = document.getElementById('preReqAreasList');
			if (!datalist) {
				datalist = document.createElement('datalist');
				datalist.id = 'preReqAreasList';
				document.body.appendChild(datalist);
			}
			
			// Poblar datalist con ¨¢reas
			datalist.innerHTML = '';
			Object.keys(areaColorMap).sort().forEach(areaName => {
				const option = document.createElement('option');
				option.value = areaName;
				datalist.appendChild(option);
			});

			localList.forEach((item, index) => {
				// Compatibilidad con datos antiguos
				if (typeof item === 'string') {
					item = { code: '', name: item, area: '', color: '#94a3b8' };
				}
				
				// Generar c¨®digo autom¨¢tico
				const autoCode = generateAutoCode(index);
				item.code = autoCode;
				localList[index] = item;
				
				// Determinar color para mostrar
				let displayColor = '#e2e8f0';
				if (item.area && areaColorMap[item.area]) {
					displayColor = parseColor(areaColorMap[item.area]);
				} else if (item.color) {
					displayColor = parseColor(item.color);
				}

				const row = document.createElement('div');
				row.className = "flex gap-2 p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-indigo-300 transition items-center";
				
				row.innerHTML = `
					<div class="w-1/4">
						<input type="text" 
							   class="w-full text-xs font-mono font-bold text-gray-700 bg-gray-50 border border-gray-300 rounded px-2 py-1.5 outline-none cursor-not-allowed" 
							   value="${item.code}" 
							   readonly
							   title="Kode automatikoa (AE_numeroLETRAS_secuencia)">
					</div>
					<div class="w-2/5">
						<input type="text" 
							   class="w-full text-sm font-medium text-gray-800 border-b border-gray-300 focus:border-indigo-500 focus:outline-none bg-transparent py-1.5 px-1 field-name" 
							   value="${item.name || ''}" 
							   placeholder="Aurre-ezagutzaren izena..."
							   data-index="${index}"
							   autocomplete="off">
					</div>
					<div class="w-2/5 relative">
						<input type="text" 
							   list="preReqAreasList"
							   class="w-full text-sm font-medium text-gray-800 border-b border-gray-300 focus:border-indigo-500 focus:outline-none bg-transparent py-1.5 px-1 pr-7 field-area" 
							   value="${item.area || ''}" 
							   placeholder="Hautatu eremua..."
							   autocomplete="off"
							   data-index="${index}"
							   id="areaInput_${index}">
						
						<div class="absolute right-0 top-2.5 w-4 h-4 rounded-full area-color-preview border border-gray-300"
							 style="background-color: ${displayColor}"
							 title="${item.area || 'Ez dago eremurik'}"></div>
					</div>
					<button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 transition btn-delete" 
							title="Ezabatu aurre-ezagutza hau"
							data-index="${index}">
						<i class="fas fa-trash-alt text-sm"></i>
					</button>
				`;

				const nameInput = row.querySelector('.field-name');
				const areaInput = row.querySelector('.field-area');
				const colorPreview = row.querySelector('.area-color-preview');
				const deleteBtn = row.querySelector('.btn-delete');

				const updateRow = () => {
					const newName = nameInput.value.trim();
					const newArea = areaInput.value.trim();
					
					// Actualizar color basado en el ¨¢rea seleccionada
					let matchedColor = '#94a3b8';
					if (newArea && areaColorMap[newArea]) {
						matchedColor = parseColor(areaColorMap[newArea]);
					}
					
					colorPreview.style.backgroundColor = matchedColor;
					colorPreview.title = newArea || 'Ez dago eremurik';
					
					// Actualizar el modelo
					localList[index] = {
						code: autoCode,
						name: newName,
						area: newArea,
						color: matchedColor
					};
				};

				// Event listeners
				nameInput.addEventListener('input', updateRow);
				nameInput.addEventListener('blur', updateRow);
				
				areaInput.addEventListener('input', updateRow);
				areaInput.addEventListener('blur', updateRow);
				areaInput.addEventListener('change', updateRow);
				
				// Sugerencias en tiempo real
				areaInput.addEventListener('input', function(e) {
					const value = this.value.toLowerCase();
					if (value && Object.keys(areaColorMap).some(area => 
						area.toLowerCase().includes(value))) {
						this.style.borderColor = '#10b981';
					} else {
						this.style.borderColor = value ? '#ef4444' : '#d1d5db';
					}
					updateRow();
				});

				deleteBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					if (localList.length <= 1) {
						alert("Gutxienez aurre-ezagutza bat egon behar da.");
						return;
					}
					if (confirm("Ziur zaude aurre-ezagutza hau ezabatu nahi duzula?")) {
						localList.splice(index, 1);
						renderTable();
					}
				});

				body.appendChild(row);
			});

			// A?adir fila vac¨ªa si no hay elementos
			if (localList.length === 0) {
				localList.push({ code: '', name: '', area: '', color: '#94a3b8' });
				renderTable();
				return;
			}
		};

		// Bot¨®n para a?adir nueva fila
		container.addEventListener('click', (e) => {
			if (e.target.id === 'btnAddPreReq' || e.target.closest('#btnAddPreReq')) {
				localList.push({ code: '', name: '', area: '', color: '#94a3b8' });
				renderTable();
				
				// Enfocar el ¨²ltimo campo de nombre a?adido
				setTimeout(() => {
					const lastRow = document.querySelector('#preReqTableBody .field-name:last-child');
					if (lastRow) lastRow.focus();
				}, 50);
			}
		});

		// Renderizar inicialmente
		renderTable();

		// ---------------------------------------------------------
		// 6. CONFIGURAR BOT¨®N GUARDAR
		// ---------------------------------------------------------
		const saveBtn = this._setupSaveButtonRaw(modal);
		saveBtn.onclick = async () => {
			saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
			saveBtn.disabled = true;
			
			try {
				// Filtrar filas vac¨ªas
				const filteredList = localList.filter(item => item.name && item.name.trim());
				
				if (filteredList.length === 0) {
					alert("Gutxienez aurre-ezagutza bat definitu behar duzu.");
					saveBtn.innerHTML = 'Gorde Aldaketak';
					saveBtn.disabled = false;
					return;
				}
				
				// Actualizar la lista con solo elementos v¨¢lidos
				this.currentSubject.context.preReq = filteredList;
				
				// Guardar tambi¨¦n en formato antiguo para compatibilidad
				this.currentSubject.context.pre_requisites = filteredList.map(item => item.name);
				this.currentSubject.preReq = filteredList;
				
				// Guardar datos
				await this.saveData();
				modal.classList.add('hidden');
				
				// Actualizar vista detallada
				if (window.ui && window.ui.renderSubjectDetail) {
					window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
				}
				
				// Mostrar confirmaci¨®n
				if (this.showNotification) {
					this.showNotification('Aurre-ezagutzak gorde dira!', 'success');
				} else {
					alert('? Aurre-ezagutzak gorde dira!');
				}
				
			} catch (error) {
				console.error('Errorea gordetzean:', error);
				alert("Errorea gordetzerakoan: " + error.message);
			} finally {
				saveBtn.innerHTML = 'Gorde Aldaketak';
				saveBtn.disabled = false;
			}
		};

		// Mostrar modal
		modal.classList.remove('hidden');
	}
	
	openSignActEditor() {
		if (!this.currentSubject) return;

		// 1. Preparar Modal
		const modal = document.getElementById('listEditorModal');
		const container = document.getElementById('listEditorContainer');
		const titleEl = document.getElementById('listEditorTitle');
		const inputTop = document.getElementById('newItemInput')?.parentElement;
		
		// Ocultar la parte superior antigua y poner t¨ªtulo
		if (inputTop) inputTop.classList.add('hidden');
		if (titleEl) titleEl.innerHTML = `<i class="fas fa-star mr-2 text-indigo-500"></i> Jarduera Esanguratsuak`;

		// 2. Inicializar datos locales (signAct)
		if (!this.currentSubject.context) this.currentSubject.context = {};
		if (!this.currentSubject.context.signAct) this.currentSubject.context.signAct = [];
		const localList = this.currentSubject.context.signAct;

		// 3. ?? PREPARAR LA INTELIGENCIA (Datos Globales)
		const globalProjects = this.adminCatalogs.externalProjects || [];
		
		// Mapa r¨¢pido: Tipo -> Color (Ej: "Bisita" -> "#ff0000")
		const typeColorMap = {};
		const agentsSet = new Set();
		const typesSet = new Set();

		globalProjects.forEach(p => {
			if (p.type) {
				typesSet.add(p.type);
				// Si este tipo tiene color, lo guardamos en el mapa
				if (p.color && p.color !== '#94a3b8') {
					typeColorMap[p.type] = p.color;
				}
			}
			if (p.agent) agentsSet.add(p.agent);
		});

		const uniqueTypes = [...typesSet].sort();
		const uniqueAgents = [...agentsSet].sort();

		// Funci¨®n auxiliar para obtener color
		const getColorForType = (type) => typeColorMap[type] || null;

		// 4. Renderizar Editor
		const renderTable = () => {
			container.innerHTML = `
				<div class="flex justify-between items-center mb-3">
					<span class="text-[10px] text-gray-400 italic">
						<i class="fas fa-magic mr-1"></i> Kolorea automatikoki aldatuko da motaren arabera.
					</span>
					<button id="btnAddSignAct" class="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded border border-indigo-200 hover:bg-indigo-100 font-bold transition">
						+ Gehitu Jarduera
					</button>
				</div>
				<div id="signActTableBody" class="space-y-3 pb-4 max-h-[60vh] overflow-y-auto pr-2"></div>
			`;

			const body = document.getElementById('signActTableBody');

			localList.forEach((item, index) => {
				// Normalizar datos antiguos si eran strings
				if (typeof item === 'string') {
					item = { name: item, agent: '', type: '', color: '#94a3b8' };
					localList[index] = item;
				}

				// Si el item no tiene color propio (o es el gris por defecto), intentamos deducirlo del tipo
				let displayColor = item.color;
				if ((!displayColor || displayColor === '#94a3b8') && item.type) {
					const suggested = getColorForType(item.type);
					if (suggested) displayColor = suggested;
				}
				// Fallback final
				if (!displayColor) displayColor = '#94a3b8';

				const row = document.createElement('div');
				row.className = "flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded shadow-sm relative group hover:border-indigo-300 transition";
				
				row.innerHTML = `
					<div class="flex gap-2">
						<div class="w-1/3">
							<label class="block text-[9px] font-bold text-gray-400 uppercase">Agentea</label>
							<input type="text" list="signActAgentSuggestions" 
								class="w-full text-xs font-bold text-gray-700 border-b border-gray-200 focus:border-indigo-500 outline-none bg-transparent py-1 field-agent" 
								value="${item.agent || ''}" placeholder="Erakundea...">
						</div>
						<div class="w-2/3">
							<label class="block text-[9px] font-bold text-gray-400 uppercase">Jardueraren Izena</label>
							<input type="text" 
								class="w-full text-sm text-gray-800 border-b border-gray-200 focus:border-indigo-500 outline-none bg-transparent py-1 field-name" 
								value="${item.name || ''}" placeholder="Jardueraren izena...">
						</div>
					</div>
					
					<div class="flex gap-2 items-end">
						<div class="flex-grow">
							<label class="block text-[9px] font-bold text-gray-400 uppercase">Mota</label>
							<div class="flex items-center gap-2">
								<input type="text" list="signActTypeSuggestions" 
									class="flex-grow text-xs text-gray-500 border-b border-gray-100 focus:border-indigo-500 outline-none bg-transparent py-1 field-type"
									value="${item.type || ''}" placeholder="Mota...">
								
								<div class="w-4 h-4 rounded-full border border-gray-300 shadow-sm type-color-preview transition-colors duration-300"
									 style="background-color: ${displayColor}"
									 title="Kolorea"></div>
							</div>
						</div>
						
						<div class="w-12 text-right">
							<input type="color" 
								class="w-8 h-6 p-0 border-0 rounded cursor-pointer field-color" 
								value="${displayColor}">
						</div>
					</div>

					<button class="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition btn-delete">
						<i class="fas fa-trash"></i>
					</button>
				`;

				// ?? LOGICA DE ACTUALIZACI¨®N Y COLORES
				const agentInput = row.querySelector('.field-agent');
				const nameInput = row.querySelector('.field-name');
				const typeInput = row.querySelector('.field-type');
				const colorInput = row.querySelector('.field-color');
				const colorPreview = row.querySelector('.type-color-preview');

				const updateModel = () => {
					localList[index] = {
						agent: agentInput.value,
						name: nameInput.value,
						type: typeInput.value,
						color: colorInput.value
					};
				};

				// Evento especial para el TIPO:
				// Al escribir, buscamos si ese tipo tiene color asignado en el mapa global
				typeInput.addEventListener('input', (e) => {
					const val = e.target.value;
					const autoColor = getColorForType(val);
					
					if (autoColor) {
						// Actualizamos visualmente
						colorInput.value = autoColor;
						colorPreview.style.backgroundColor = autoColor;
						// Actualizamos modelo
						updateModel(); 
					} else {
						// Solo actualizamos el texto del modelo, respetamos el color que ya tuviera
						localList[index].type = val;
					}
				});

				// Evento normal para el color (si el usuario lo cambia manualmente)
				colorInput.addEventListener('input', (e) => {
					const val = e.target.value;
					colorPreview.style.backgroundColor = val;
					updateModel();
				});

				// Resto de eventos
				[agentInput, nameInput].forEach(inp => inp.addEventListener('input', updateModel));
				
				// Eliminar
				row.querySelector('.btn-delete').addEventListener('click', () => {
					if(confirm("Ezabatu?")) {
						localList.splice(index, 1);
						renderTable();
					}
				});

				body.appendChild(row);
			});

			// 5. Crear Datalists (Autocompletado)
			const createDatalists = () => {
				['signActTypeSuggestions', 'signActAgentSuggestions'].forEach(id => {
					if(document.getElementById(id)) document.getElementById(id).remove();
				});

				if (uniqueTypes.length) {
					const dl = document.createElement('datalist');
					dl.id = 'signActTypeSuggestions';
					uniqueTypes.forEach(t => {
						const op = document.createElement('option');
						op.value = t;
						// Guardamos el color en dataset por si acaso
						if(typeColorMap[t]) op.dataset.color = typeColorMap[t]; 
						dl.appendChild(op);
					});
					document.body.appendChild(dl);
				}

				if (uniqueAgents.length) {
					const dl = document.createElement('datalist');
					dl.id = 'signActAgentSuggestions';
					uniqueAgents.forEach(a => dl.appendChild(new Option(a)));
					document.body.appendChild(dl);
				}
			};
			createDatalists();
		};

		// Inicializar eventos de botones principales
		document.getElementById('listEditorModal').classList.remove('hidden');
		
		// Bot¨®n a?adir
		// Usamos delegaci¨®n o re-renderizado
		renderTable(); // Primera renderizaci¨®n
		
		// Como el bot¨®n de a?adir est¨¢ dentro del innerHTML del container, 
		// necesitamos a?adir su listener despu¨¦s de renderizar (o usar onclick en el HTML, pero mejor as¨ª:)
		// Mejor truco: a?adir el listener al container y detectar click
		container.addEventListener('click', (e) => {
			if(e.target.id === 'btnAddSignAct') {
				localList.push({ name: '', agent: '', type: '', color: '#94a3b8' });
				renderTable();
			}
		});

		// 6. Bot¨®n Guardar
		const saveBtn = this._setupSaveButtonRaw(modal);
		saveBtn.onclick = async () => {
			saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
			try {
				await this.saveData(); // Guarda toda la asignatura
				modal.classList.add('hidden');
				if (window.ui && this.currentSubject) {
					window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
				}
			} catch (e) {
				console.error(e);
				alert("Errorea gordetzerakoan.");
			} finally {
				saveBtn.innerHTML = 'Gorde Aldaketak';
			}
		};
	}


    async saveListEditor() {  // <--- ?F¨ªjate en el 'async' aqu¨ª!
        if (!this.currentEditingField) return;
        
        const fieldName = this.currentEditingField;
        const isDegree = this.isEditingDegree; 

        console.log(`?? Guardando lista "${fieldName}" en ${isDegree ? 'GRADUA' : 'IRAKASGAIA'}`);
        
        const inputs = document.querySelectorAll('.list-item-input');
        const newList = Array.from(inputs)
            .map(i => i.value.trim())
            .filter(v => v !== "");
        
        // 1. ACTUALIZAR EL OBJETO EN MEMORIA
        if (isDegree) {
            // Guardar en el objeto Grado
            this.currentDegree[fieldName] = newList;
            
            // Refrescar Sidebar inmediatamente
            if (window.ui && window.ui.renderSidebar) {
                window.ui.renderSidebar(this.currentDegree);
            }
        } else {
            // Guardar en el objeto Asignatura
            if (!this.currentSubject) return;
            
            // Si el campo no existe en 'context', lo creamos o actualizamos
            // Nota: Aqu¨ª asumo que usas 'context' para las listas nuevas (IDU, ODS...)
            // Si usas propiedades directas, ajusta esto.
            const target = this.currentSubject.context ? this.currentSubject.context : this.currentSubject;
            target[fieldName] = newList;

            // Refrescar Detalle Asignatura
            if (window.ui && window.ui.renderSubjectDetail) {
                window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
            }
        }
        
        // 2. GUARDAR EN SUPABASE (BD)
        // Usamos 'await' para esperar a que se guarde antes de cerrar el modal
        try {
            await this.saveData(); 
            console.log("? Datos guardados correctamente en BD");
        } catch (e) {
            console.error("? Error al guardar en BD:", e);
            // Aqu¨ª podr¨ªas mostrar un aviso al usuario si falla
        }

        // 3. CERRAR MODAL
        const modal = document.getElementById('listEditorModal');
        if(modal) modal.classList.add('hidden');
    }

// ==========================================
// GESTI¨®N DE LA VISTA DE PLANIFICACI¨®N (GANTT)
// ==========================================

goToPlanning() {
    // Delegamos completamente al nuevo m¨®dulo
    if (window.planningManager) {
        // Pasamos la asignatura actual al manager
        window.planningManager.open(this.currentSubject);
    } else {
        console.error("? PlanningManager no est¨¢ cargado en window.");
        alert("Errorea: PlanningManager modulua falta da.");
    }
}

closePlanning() {
    document.getElementById('subjectPlanningView').classList.add('hidden');
    document.getElementById('subjectDetailView').classList.remove('hidden');
    // Al volver, actualizamos la vista de detalle por si cambiaron las horas
    if (window.ui) window.ui.renderSubjectDetail(this.currentSubject);
}



// ==========================================
// RENDERIZADO DE UNA FILA DE ACTIVIDAD
// ==========================================
renderActivityRow(act, udIndex, actIndex, areaColor) {
    const assigned = act.assignedDescriptors || [];
    
    return `
        <div class="activity-card bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all relative group/act mb-4">
            <div class="grid grid-cols-12 gap-6">
                
                <div class="col-span-5 border-r border-gray-100 pr-4 space-y-3">
                    
                    <div>
                        <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Jardueraren Izenburua</label>
                        <input type="text" value="${act.name || ''}" 
                               onchange="window.gradosManager.updateActivityField(${udIndex}, ${actIndex}, 'name', this.value)"
                               class="w-full font-bold text-gray-800 text-sm border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none placeholder-gray-300 transition-colors" 
                               placeholder="Adib: Proiektuaren aurkezpena...">
                    </div>

                    <div>
                        <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Azalpen Deskriptiboa</label>
                        <textarea 
                               onchange="window.gradosManager.updateActivityField(${udIndex}, ${actIndex}, 'description', this.value)"
                               class="w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2 focus:border-indigo-500 focus:bg-white focus:outline-none resize-y min-h-[60px]"
                               placeholder="Deskribatu hemen jardueraren nondik norakoak...">${act.description || ''}</textarea>
                    </div>
                    
                    <div class="flex items-center gap-2 bg-gray-50 p-2 rounded w-fit">
                        <i class="far fa-clock text-gray-400 text-xs"></i>
                        <input type="number" value="${act.duration || 0}" min="0" step="0.5"
                               onchange="window.gradosManager.updateActivityField(${udIndex}, ${actIndex}, 'duration', this.value)"
                               class="w-12 text-xs font-mono bg-transparent border-b border-gray-300 text-center focus:border-indigo-500 focus:outline-none">
                        <span class="text-xs text-gray-500 font-bold">ordu</span>
                    </div>
                </div>

                <div class="col-span-4 border-r border-gray-100 px-2 flex flex-col"
                     ondragover="window.gradosManager.handleDragOver(event)"
                     ondrop="window.gradosManager.handleDrop(event, ${udIndex}, ${actIndex})">
                    <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1 flex justify-between">
                        <span>Lortutako Emaitzak (Deskriptoreak)</span>
                    </label>
                    <div class="flex-1 bg-gray-50/50 rounded border border-dashed border-gray-300 p-2 flex flex-wrap gap-1 content-start min-h-[80px]">
                        ${assigned.map((d, i) => `
                            <span class="inline-flex items-center px-2 py-1 rounded text-[10px] bg-white border border-gray-200 shadow-sm text-gray-700 max-w-full group/tag">
                                <span class="truncate max-w-[120px]" title="${d}">${d}</span>
                                <button onclick="window.gradosManager.removeDescriptorFromActivity(${udIndex}, ${actIndex}, ${i})" class="ml-1 text-gray-300 hover:text-red-500 opacity-0 group-hover/tag:opacity-100">
                                    <i class="fas fa-times"></i>
                                </button>
                            </span>
                        `).join('')}
                    </div>
                </div>

                <div class="col-span-3 pl-2 space-y-4">
                    <div>
                        <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Baliabideak</label>
                        <textarea 
                               onchange="window.gradosManager.updateActivityField(${udIndex}, ${actIndex}, 'resources', this.value)"
                               class="w-full text-xs bg-white border border-gray-200 rounded p-2 focus:border-indigo-500 focus:outline-none min-h-[40px]"
                               placeholder="PDF, Softwarea...">${act.resources || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Ebaluazio / Evidencia</label>
                        <textarea 
                               onchange="window.gradosManager.updateActivityField(${udIndex}, ${actIndex}, 'evaluation', this.value)"
                               class="w-full text-xs bg-white border border-gray-200 rounded p-2 focus:border-indigo-500 focus:outline-none min-h-[40px]"
                               placeholder="Txostena, Testa...">${act.evaluation || ''}</textarea>
                    </div>
                </div>
            </div>

            <button onclick="window.gradosManager.deleteActivity(${udIndex}, ${actIndex})" 
                    class="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover/act:opacity-100 transition-opacity p-2 bg-white rounded-full shadow-sm border border-gray-100">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
}

// ==========================================
// M¨¦TODOS DE DATOS Y DRAG & DROP
// ==========================================

addActivity(udIndex) {
    if (!this.currentSubject.unitateak[udIndex].activities) {
        this.currentSubject.unitateak[udIndex].activities = [];
    }
    
    this.currentSubject.unitateak[udIndex].activities.push({
        id: Date.now(),
        name: "",         // T¨ªtulo
        description: "",  // NUEVO: Descripci¨®n detallada
        duration: 2, 
        assignedDescriptors: [], 
        resources: "",
        evaluation: ""
    });
    
    this.renderPlanning();
}

updateActivityField(udIndex, actIndex, field, value) {
    const act = this.currentSubject.unitateak[udIndex].activities[actIndex];
    
    if (field === 'duration') {
        act[field] = parseFloat(value) || 0;
        // Si cambiamos la duraci¨®n, hay que recalcular el total de la UD y el Gantt
        this.renderPlanning(); 
    } else {
        act[field] = value;
    }
}

deleteActivity(udIndex, actIndex) {
    if(confirm('Ziur jarduera hau ezabatu nahi duzula?')) {
        this.currentSubject.unitateak[udIndex].activities.splice(actIndex, 1);
        this.renderPlanning();
    }
}

// --- DRAG & DROP LOGIC ---

handleDragStart(e, descriptorText, sourceUdIndex) {
    // Guardamos el texto y el ¨ªndice de origen para validaciones
    e.dataTransfer.setData("text/plain", descriptorText);
    e.dataTransfer.setData("sourceUdIndex", sourceUdIndex);
    e.dataTransfer.effectAllowed = "copy"; // Icono de copia
}

handleDragOver(e) {
    e.preventDefault(); // Necesario para permitir el drop
    e.dataTransfer.dropEffect = "copy";
}

handleDrop(e, targetUdIndex, targetActIndex) {
    e.preventDefault();
    const descriptorText = e.dataTransfer.getData("text/plain");
    const sourceUdIndex = parseInt(e.dataTransfer.getData("sourceUdIndex"));

    // Validaci¨®n pedag¨®gica: ?Permitimos arrastrar descriptores de OTRA unidad?
    // Generalmente NO, el alineamiento es intra-unidad.
    if (sourceUdIndex !== targetUdIndex) {
        alert("Ezin duzu beste unitate bateko deskriptorerik erabili jarduera honetan.");
        return;
    }

    const activity = this.currentSubject.unitateak[targetUdIndex].activities[targetActIndex];
    if (!activity.assignedDescriptors) activity.assignedDescriptors = [];

    // Evitar duplicados en la misma actividad
    if (!activity.assignedDescriptors.includes(descriptorText)) {
        activity.assignedDescriptors.push(descriptorText);
        this.renderPlanning(); // Refrescar para ver el tag
    }
}

removeDescriptorFromActivity(udIndex, actIndex, descIndex) {
    this.currentSubject.unitateak[udIndex].activities[actIndex].assignedDescriptors.splice(descIndex, 1);
    this.renderPlanning();
}

// ==========================================
// 6. EXPORTACI¨®N E IMPORTACI¨®N (Persistencia)
// ==========================================

/**
 * Exporta la configuraci¨®n completa de la asignatura (UDs + Actividades) a un JSON
 */

exportPlanning() {
    if (!this.currentSubject) return;

    const exportData = {
        meta: {
            version: "2.0",
            date: new Date().toISOString(),
            subject: this.currentSubject.name || "Unknown",
            code: this.currentSubject.code || "Unknown"
        },
        units: this.currentSubject.unitateak || []
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `PLANGINTZA_${this.currentSubject.code || 'ASIG'}_${new Date().toISOString().slice(0,10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    // Notificaci¨®n visual (si tienes un sistema de toast)
    console.log("Plangintza esportatua!");
}

/**
 * Importa un JSON y sobrescribe las unidades actuales
 */
importPlanning(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            
            // Validaci¨®n b¨¢sica
            if (!json.units || !Array.isArray(json.units)) {
                alert("Errorea: Fitxategiaren formatua ez da zuzena (unitateak falta dira).");
                return;
            }

            if(confirm(`Ziur zaude "${json.meta?.subject || 'Fitxategia'}" inportatu nahi duzula? Honek uneko datuak ordezkatuko ditu.`)) {
                // Sobrescribir datos
                this.currentSubject.unitateak = json.units;
                
                // Guardar y Renderizar
                this.saveData();
                this.renderPlanning();
                
                alert("Plangintza ondo inportatu da!");
            }
        } catch (err) {
            console.error(err);
            alert("Errorea fitxategia irakurtzean. Ziurtatu JSON baliozkoa dela.");
        }
        // Limpiar input para permitir recargar el mismo archivo si falla
        inputElement.value = '';
    };
    reader.readAsText(file);
}

/**
 * Exporta la Matriz de Alineaci¨®n a CSV (Excel friendly)
 * Cruza: Unidades (Columnas) vs Competencias/Descriptores (Filas)
 */
exportAlignmentMatrix() {
    if (!this.currentSubject) return;

    const units = this.currentSubject.unitateak || [];
    if (units.length === 0) {
        alert("Ez dago unitaterik matrizea sortzeko.");
        return;
    }

    // 1. Preparar Cabeceras (CSV Headers)
    // Formato: "Konpetentzia";"Deskriptorea";"UD1";"UD2";"UD3"...
    let csvContent = "data:text/csv;charset=utf-8,";
    let header = ["Konpetentzia", "Ikaskuntza Emaitza (RA) / Deskriptorea"];
    
    // A?adir c¨®digos de UD a la cabecera
    units.forEach(u => header.push(u.unitCode || u.name));
    csvContent += header.join(";") + "\r\n";

    // 2. Recopilar todos los RA/Descriptores ¨²nicos de la asignatura
    // (Asumimos que est¨¢n en this.currentSubject.competencies o similar, 
    // pero si no, los sacamos de las propias UDs para asegurar que sale todo lo usado)
    
    const allDescriptorsMap = new Map(); // Mapa para evitar duplicados
    
    // Barrido para encontrar todos los descriptores usados
    units.forEach(u => {
        (u.descriptores || []).forEach(desc => {
            if (!allDescriptorsMap.has(desc)) {
                allDescriptorsMap.set(desc, {
                    name: desc,
                    type: "Generikoa" // Aqu¨ª podr¨ªas buscar el tipo real si lo tienes en otra lista
                });
            }
        });
    });

    // 3. Generar Filas del CSV
    allDescriptorsMap.forEach((descObj, descText) => {
        let row = [];
        row.push(descObj.type); // Columna 1: Tipo/Competencia
        row.push(`"${descText.replace(/"/g, '""')}"`); // Columna 2: Texto (escapando comillas)

        // Columnas UDs: Marcar con 'X' si la UD tiene este descriptor
        units.forEach(u => {
            const hasDesc = (u.descriptores || []).includes(descText);
            row.push(hasDesc ? "X" : "");
        });

        csvContent += row.join(";") + "\r\n";
    });

    // 4. Descargar
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MATRIZEA_${this.currentSubject.code}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
}


    // --- GESTIÃ“N DE UNIDADES (UNITATEAK) ---

// A. ABRIR EL EDITOR Y CARGAR DATOS
// --- GESTI¨®N DE UNIDADES (TABLA) ---

openUnitEditor() {
    if (!this.currentSubject) return;

    const tbody = document.getElementById('unitEditorBody');
    const modal = document.getElementById('unitEditorModal');
    
    tbody.innerHTML = '';
    
    // Obtenemos las unidades existentes
    let units = this.currentSubject.unitateak || [];

    // --- CORRECCI¨®N FORZOSA DE C¨®DIGOS ---
    // Recorremos todas las unidades y regeneramos su c¨®digo AHORA MISMO
    // Esto arregla las que pone "XX1..." o las antiguas sin formato.
    units = units.map((u, i) => {
        // Generamos el c¨®digo correcto basado en la posici¨®n actual
        const newCode = this.generateUnitAutoCode(i);
        
        // Actualizamos el objeto (puedes comentar este if si quieres machacar TODO siempre)
        // Aqu¨ª decimos: si el c¨®digo actual es diferente al calculado, actual¨ªzalo.
        if (u.unitCode !== newCode) {
            u.unitCode = newCode;
            // Tambi¨¦n actualizamos la propiedad legacy 'code' por si acaso
            u.code = newCode;
        }
        return u;
    });
    
    // Guardamos la referencia actualizada en memoria temporalmente para que se vea en la tabla
    this.currentSubject.unitateak = units;

    // --- RENDERIZADO ---
    units.forEach((u, i) => this.addUnitRow(u, i));

    // Si no hab¨ªa ninguna, a?adimos una fila vac¨ªa (que generar¨¢ UD01)
    if (units.length === 0) this.addUnitRow({}, 0);

    modal.classList.remove('hidden');
}

// ==========================================
// 2. HELPER: Generador de C¨®digo Autom¨¢tico
// ==========================================

// Konpetentziaren kodea bilatzeko funtzio unibertsala
    _getCompCode(c) {
        if (!c) return '???';
        
        // 1. Lehentasuna: 'label' (Zure kasuan 'IK-ZEH-01' hemen egon daiteke)
        if (c.label && c.label.trim().length > 0) return c.label;

        // 2. Lehentasuna: 'header' (Excel inportazioetatik etor daiteke)
        if (c.header && c.header.trim().length > 0) return c.header;

        // 3. Beste aukera arruntak
        if (c.humanId) return c.humanId;
        if (c.autoCode) return c.autoCode;
        if (c.code) return c.code;
        
        // 4. Azken aukera: IDa (baina bakarrik laburra bada)
        if (c.id && String(c.id).length < 15) return c.id;

        return '???';
    }

generateUnitAutoCode(index) {
    const subj = this.currentSubject || {};

    // 1. Grado (BD): Usa degreeCode o un valor por defecto
    const grado = this.currentDegree?.code || subj.degreeCode || "BD"; 

    // 2. Curso y Periodo
    const curso = subj.course || subj.year || "1";
    const periodo = subj.term || subj.semester || "1";

    // 3. ACR¨®NIMO (Correcci¨®n):
    // Priorizamos el nombre visual (ej: "Proiektuak I")
    const rawName = subj.name || subj.subjectTitle || subj.title || "ASIG";
    
    // Limpiamos el nombre: Quitamos n¨²meros, puntos y espacios para que "Proiektuak 1" sea "PRO"
    const cleanName = rawName.replace(/[0-9IVX\.\s]/g, '').toUpperCase();
    
    // Cogemos las 3 primeras letras. Si es muy corto, rellenamos con X.
    const acronimo = cleanName.substring(0, 3).padEnd(3, 'X');

    // 4. Secuencia (UD01)
    const secuencia = String(index + 1).padStart(2, '0');

    // Resultado: BD1_3PRO_UD01
    return `${grado}${curso}_${periodo}${acronimo}_UD${secuencia}`;
}

addUnitRow(data = {}, index = null) {
    const tbody = document.getElementById('unitEditorBody');
    
    // Calcular ¨ªndice si es una fila nueva manual
    const currentRowCount = tbody.children.length;
    const finalIndex = index !== null ? index : currentRowCount;

    const tr = document.createElement('tr');
    tr.className = "bg-white border-b hover:bg-gray-50 group";
    
    // Usamos el c¨®digo que ya viene corregido en 'data', o generamos si es nueva
    const code = data.unitCode || this.generateUnitAutoCode(finalIndex);
    
    const name = data.unitName || "";
    const hours = data.irauOrd || "";
    const descriptors = data.descriptores || data.descriptors || [];
    const descriptorsText = descriptors.join('\n');
    const areaColor = this.currentSubject?._areaColor || '#6366f1';

    tr.innerHTML = `
        <td class="px-2 py-2 w-[15%] align-top">
            <input type="text" class="unit-code-input w-full text-xs font-mono font-bold text-gray-600 bg-transparent border-b border-transparent hover:border-gray-300 focus:outline-none py-1" 
                   value="${code}" 
                   readonly 
                   title="Automatikoki sortua. Ezin da aldatu."
                   style="border-bottom-color: ${areaColor}30; cursor: not-allowed; opacity: 0.8;">
        </td>

        <td class="px-2 py-2 w-[20%] align-top">
            <input type="text" class="unit-name-input w-full text-sm font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:outline-none py-1" 
                   value="${name}" placeholder="Unitatearen izena..."
                   style="border-bottom-color: ${areaColor}30;">
        </td>

        <td class="px-2 py-2 w-[8%] align-top">
            <input type="number" class="unit-hours-input w-full text-center text-xs bg-transparent border-b border-transparent hover:border-gray-300 focus:outline-none py-1" 
                   value="${hours}" placeholder="h"
                   style="border-bottom-color: ${areaColor}30;">
        </td>

        <td class="px-2 py-2 w-[52%]">
            <textarea class="unit-descriptors-input w-full text-xs border rounded p-2 bg-gray-50 focus:bg-white resize-y transition-all shadow-sm"
                      rows="2"
                      placeholder="Deskriptoreak..."
                      style="min-height: 45px; border-color: ${areaColor}40;"
                      onfocus="this.style.borderColor='${areaColor}'; this.style.boxShadow='0 0 0 2px ${areaColor}20';"
                      onblur="this.style.borderColor='${areaColor}40'; this.style.boxShadow='none';">${descriptorsText}</textarea>
        </td>

        <td class="px-2 py-2 w-[5%] text-center align-top pt-3">
            <button onclick="this.closest('tr').remove()" class="text-gray-300 hover:text-red-500 transition-colors">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);

    setTimeout(() => {
        const ta = tr.querySelector('.unit-descriptors-input');
        if(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
    }, 10);
}

// Funci¨®n auxiliar para auto-resize
autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

saveUnitEditor() {
    if (!this.currentSubject) return;

    const rows = document.querySelectorAll('#unitEditorBody tr');
    const newUnits = [];

    rows.forEach(row => {
        const code = row.querySelector('.unit-code-input')?.value.trim();
        const name = row.querySelector('.unit-name-input')?.value.trim();
        const hours = row.querySelector('.unit-hours-input')?.value.trim();
        const descriptorsText = row.querySelector('.unit-descriptors-input')?.value.trim();

        // Guardamos si hay c¨®digo O nombre (para evitar filas vac¨ªas fantasma)
        if (code || name) {
            const descriptors = descriptorsText 
                ? descriptorsText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
                : [];
            
            newUnits.push({
                unitCode: code,
                unitName: name,
                irauOrd: hours,
                descriptores: descriptors,
                // Mantener compatibilidad legacy si la usas en otro lado
                code: code,
                name: name,
                hours: hours
            });
        }
    });

    this.currentSubject.unitateak = newUnits;
    this.saveData();

    // Actualizar UI
    document.getElementById('unitEditorModal').classList.add('hidden');
    if (window.ui && window.ui.renderSubjectDetail) {
        window.ui.renderSubjectDetail(this.currentSubject);
    }
    
    console.log(`?? Guardadas ${newUnits.length} unidades.`);
}
    // --- MODALES Y AREAS (MANTENIDOS IGUAL) ---
injectAreaModal() {
        if (document.getElementById('areaModal')) return; 
        const modalHTML = `
        <div id="areaModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.6); z-index: 9999; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
            <div class="bg-white rounded-xl shadow-2xl w-96 overflow-hidden transform transition-all scale-100 relative">
                <div class="bg-slate-800 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 class="text-white font-bold text-lg" id="areaModalTitle">Eremua Editatu</h3>
                    <button onclick="document.getElementById('areaModal').style.display='none'" class="text-slate-400 hover:text-white cursor-pointer"><i class="fas fa-times text-xl"></i></button>
                </div>
                <div class="p-6 space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Eremuaren Izena</label>
                        <input type="text" id="areaNameInput" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Kolorea</label>
                        <div class="flex items-center gap-3">
                            <input type="color" id="areaColorInput" class="h-10 w-20 p-1 rounded cursor-pointer border border-gray-300 shadow-sm" value="#3b82f6">
                            <span id="colorHexValue" class="text-sm text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">#3b82f6</span>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 px-6 py-4 flex justify-between items-center border-t">
                    <button id="btnDeleteArea" onclick="window.gradosManager.deleteSubjectArea()" class="text-red-500 hover:text-red-700 text-sm font-bold transition cursor-pointer flex items-center gap-1">
                        <i class="fas fa-trash"></i> Ezabatu
                    </button>
                    
                    <div class="flex gap-2">
                        <button onclick="document.getElementById('areaModal').style.display='none'" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition cursor-pointer">Utzi</button>
                        <button onclick="window.gradosManager.confirmSaveArea()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 cursor-pointer">Gorde</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const colorInput = document.getElementById('areaColorInput');
        const hexText = document.getElementById('colorHexValue');
        if (colorInput && hexText) colorInput.addEventListener('input', (e) => hexText.textContent = e.target.value);
    }
	
    showModal() {
        this.injectAreaModal(); 
        const modal = document.getElementById('areaModal');
        if (modal) modal.style.display = 'flex'; 
    }

addSubjectArea() {
        if (!this.currentDegree) return;
        this.editingAreaOldName = null;
        this.showModal(); 
        document.getElementById('areaModalTitle').textContent = "Eremu Berria Sortu";
        document.getElementById('areaNameInput').value = "";
        
        // Color aleatorio
        const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
        document.getElementById('areaColorInput').value = randomColor;
        document.getElementById('colorHexValue').textContent = randomColor;
        
        // OCULTAR BOT¨®N DE BORRAR (Porque es nueva)
        const btnDelete = document.getElementById('btnDeleteArea');
        if (btnDelete) btnDelete.style.display = 'none';

        document.getElementById('areaNameInput').focus();
    }
	
editSubjectArea(encodedName) {
        if (!this.currentDegree) return;
        const name = decodeURIComponent(encodedName);
        this.editingAreaOldName = name; // Importante para saber cu¨¢l borrar
        
        if (!this.currentDegree.subjectAreas) this.currentDegree.subjectAreas = [];
        const area = this.currentDegree.subjectAreas.find(a => a.name === name);
        
        this.showModal();
        
        // Configuraci¨®n UI
        document.getElementById('areaModalTitle').textContent = "Eremua Editatu";
        document.getElementById('areaNameInput').value = area ? area.name : name;
        let color = (area && area.color) ? area.color : '#3b82f6';
        document.getElementById('areaColorInput').value = color;
        document.getElementById('colorHexValue').textContent = color;

        // MOSTRAR BOT¨®N DE BORRAR
        const btnDelete = document.getElementById('btnDeleteArea');
        if (btnDelete) btnDelete.style.display = 'flex';
    }
	
    confirmSaveArea() {
        if (!this.currentDegree) return;
        const nameInput = document.getElementById('areaNameInput').value.trim();
        const colorInput = document.getElementById('areaColorInput').value;
        if (!nameInput) { alert("Izena beharrezkoa da"); return; }
        if (!this.currentDegree.subjectAreas) this.currentDegree.subjectAreas = [];

        if (this.editingAreaOldName) {
            const area = this.currentDegree.subjectAreas.find(a => a.name === this.editingAreaOldName);
            if (area) {
                const oldName = area.name;
                area.name = nameInput;
                area.color = colorInput;
                if (oldName !== nameInput) this.updateSubjectsAreaName(oldName, nameInput);
            } else {
                this.currentDegree.subjectAreas.push({ name: nameInput, color: colorInput });
                this.updateSubjectsAreaName(this.editingAreaOldName, nameInput);
            }
        } else {
            if (this.currentDegree.subjectAreas.some(a => a.name === nameInput)) { alert("Existitzen da."); return; }
            this.currentDegree.subjectAreas.push({ name: nameInput, color: colorInput });
        }
        this.saveData();
        document.getElementById('areaModal').style.display = 'none'; 
        if (window.ui) {
            window.ui.renderSidebar(this.currentDegree);
            if (this.currentYear) window.ui.renderYearView(this.currentDegree, this.currentYear);
        }
    }

deleteSubjectArea() {
		if (!this.currentDegree || !this.editingAreaOldName) return;

			// --- BABESA: Zeharkakoa ezin da ezabatu ---
			if (this.editingAreaOldName === "ZEHARKAKO KONPETENTZIAK") {
				alert("Eremu hau derrigorrezkoa da sisteman eta ezin da ezabatu.");
				return;
			}

        const confirmMessage = `Ziur zaude '${this.editingAreaOldName}' eremua ezabatu nahi duzula?...`;
		
        if (confirm(confirmMessage)) {
            // Filtrar para quitar el ¨¢rea actual
            this.currentDegree.subjectAreas = this.currentDegree.subjectAreas.filter(a => a.name !== this.editingAreaOldName);
            
            // Guardar en base de datos
            this.saveData();
            
            // Cerrar modal y refrescar interfaz
            document.getElementById('areaModal').style.display = 'none';
            if (window.ui) {
                window.ui.renderSidebar(this.currentDegree);
                // Si est¨¢s en la vista de a?o, refrescar para que se quiten los colores viejos
                if (this.currentYear) window.ui.renderYearView(this.currentDegree, this.currentYear);
            }
        }
    }


// ==========================================
    // IRAKASGAIAK EZABATU (DELETE SUBJECT)
    // ==========================================

deleteSubject(yearKey, subjectIndex) {
        if (!this.currentDegree || !this.currentDegree.year) return;

        // ZUZENKETA: Zuzenean Array-a hartu (.subjects gabe)
        const subjectsList = this.currentDegree.year[yearKey];

        if (!subjectsList || !subjectsList[subjectIndex]) {
            console.error("Ez da irakasgaia aurkitu.");
            return;
        }

        const subjName = subjectsList[subjectIndex].subjectTitle || "Irakasgaia";
        
        if (confirm(`Ziur zaude '${subjName}' ezabatu nahi duzula?`)) {
            // Ezabatu
            subjectsList.splice(subjectIndex, 1);
            
            // Gorde eta Eguneratu
            this.saveData();
            if (window.ui && window.ui.renderYearView) {
                window.ui.renderYearView(this.currentDegree, yearKey);
            }
        }
    }
	
// ==========================================
    // KONPETENTZIA KUDEATZAILEA (BISUALA ETA AUTOMATIKOA)
    // ==========================================

    /**
     * Eremuen kode laburren mapa.
     * Izen luzea -> Kode laburra (SK-XXX-01 egiteko)
     */
    getAreaShortCode(areaName) {
        const map = {
            "Diseinu proiektuak eta metodologiak": "PRO",
            "Eraikuntza eta Teknologia": "TEK",
            "Diseinuaren ikus adierazpena": "IKUS",
            "Diseinuaren oinarriak": "OIN",
            "Kudeaketa eta profesionaltasuna": "KUD"
        };
        // Ez badago mapan, lehen 3 hizkiak hartu
        return map[areaName] || areaName.substring(0, 3).toUpperCase();
    }

    /**
     * 1. Ireki Arbela (Dashboard)
     * Hau da Sidebar-eko botoiak deituko duen funtzioa.
     */
openCompetenciesDashboard() {
        if (!this.currentDegree) return alert("Mesedez, aukeratu gradu bat lehenengo.");

        // Inicializar si no existe
        if (!this.currentDegree.competencies) {
            this.currentDegree.competencies = { ingreso: [], egreso: [] };
        }

        // 1. Sortu filtroaren aukerak (¨¢reas)
        const areas = this.currentDegree.subjectAreas || [];
        const filterOptions = areas.map(a => 
            `<option value="${a.name}" style="background:${a.color}20; color:${a.color}; font-weight:bold;">${a.name}</option>`
        ).join('');

        const dashboardHTML = `
        <div id="compDashboard" class="fixed inset-0 bg-gray-100 z-[5000] flex flex-col overflow-hidden animate-fade-in">
            <div class="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shadow-md shrink-0">
                <div class="flex items-center gap-4">
                    <h2 class="text-xl font-bold tracking-wide"><i class="fas fa-network-wired mr-2"></i> Konpetentzien Mapa</h2>
                    
                    <div class="flex items-center gap-2 ml-4 bg-slate-700 p-1 rounded-lg border border-slate-600">
                        <span class="text-[10px] uppercase font-bold text-slate-400 px-2"><i class="fas fa-filter"></i> Iragazi:</span>
                        <select id="compFilterSelect" onchange="window.gradosManager.renderVisualCards(this.value)" class="bg-slate-800 text-white text-xs border border-slate-600 rounded px-2 py-1 outline-none focus:border-indigo-500">
                            <option value="">-- Eremu Guztiak (Todos) --</option>
                            ${filterOptions}
                        </select>
                    </div>
                </div>

                <div class="flex gap-3">
                    <button onclick="window.gradosManager.saveData()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-sm transition shadow">
                        <i class="fas fa-save mr-2"></i> Gorde
                    </button>
                    <button onclick="document.getElementById('compDashboard').remove(); window.gradosManager.updateSidebarCompetenciesList()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-sm transition">
                        <i class="fas fa-times mr-2"></i> Itxi
                    </button>
                </div>
            </div>

            <div class="flex-1 flex overflow-hidden p-6 gap-6">
                <div class="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div class="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 class="font-bold text-gray-700 uppercase flex items-center gap-2">
                            <span class="w-2 h-8 bg-indigo-500 rounded-full block"></span> Sarrera (SK)
                        </h3>
                        <button onclick="window.gradosManager.openSingleCompEditor('ingreso', null)" class="text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded border border-indigo-200 text-xs font-bold transition">
                            <i class="fas fa-plus mr-1"></i> Gehitu
                        </button>
                    </div>
                    <div id="container-ingreso" class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50"></div>
                </div>

                <div class="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div class="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 class="font-bold text-gray-700 uppercase flex items-center gap-2">
                            <span class="w-2 h-8 bg-emerald-500 rounded-full block"></span> Irteera (IK)
                        </h3>
                        <button onclick="window.gradosManager.openSingleCompEditor('egreso', null)" class="text-emerald-600 hover:bg-emerald-50 px-3 py-1 rounded border border-emerald-200 text-xs font-bold transition">
                            <i class="fas fa-plus mr-1"></i> Gehitu
                        </button>
                    </div>
                    <div id="container-egreso" class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50"></div>
                </div>
            </div>
        </div>`;

        const old = document.getElementById('compDashboard');
        if (old) old.remove();
        document.body.insertAdjacentHTML('beforeend', dashboardHTML);

        this.renderVisualCards(); // Render inicial sin filtros
    }
	
    /**
     * 2. Txartelak Marraztu
     * Koloreak eta Kodeak aplikatuz.
     */
renderVisualCards(filterArea = "") {
        ['ingreso', 'egreso'].forEach(type => {
            const container = document.getElementById(`container-${type}`);
            if (!container) return;

            // 1. Datuak lortu
            let list = this.currentDegree.competencies[type] || [];
            const areas = this.currentDegree.subjectAreas || [];

            // 2. MAPEAR: Jatorrizko indizea gorde behar dugu editatu/ezabatu ahal izateko
            // (Bestela ordenatzean indizeak galduko genituzke)
            let processedList = list.map((item, index) => ({
                ...item,
                originalIndex: index // Hau oso garrantzitsua da
            }));

            // 3. ORDENATU: Eremuen ordenaren arabera (Ezagutza Eremuak zerrenda ofiziala jarraituz)
            processedList.sort((a, b) => {
                const indexA = areas.findIndex(area => area.name === a.area);
                const indexB = areas.findIndex(area => area.name === b.area);
                
                // Eremurik gabekoak amaierara
                const valA = indexA === -1 ? 9999 : indexA;
                const valB = indexB === -1 ? 9999 : indexB;

                return valA - valB;
            });

            // 4. KODEAK SORTU: Behin ordenatuta, kodeak kalkulatzen ditugu
            const areaCounters = {};
            processedList.forEach(comp => {
                const shortCode = this.getAreaShortCode(comp.area || 'GEN');
                if (!areaCounters[shortCode]) areaCounters[shortCode] = 1;
                
                const num = String(areaCounters[shortCode]++).padStart(2, '0');
                const prefix = type === 'ingreso' ? 'SK' : 'IK';
                
                // Kodea objektuan gorde bistaratzeko
                comp.autoCode = `${prefix}-${shortCode}-${num}`;
            });

            // 5. IRAGAZKI bisuala aplikatu (Select-a erabiltzen bada)
            if (filterArea) {
                processedList = processedList.filter(c => c.area === filterArea);
            }

            // 6. RENDERIZATU
            container.innerHTML = processedList.map((comp) => {
                const areaObj = areas.find(a => a.name === comp.area);
                const color = areaObj ? areaObj.color : '#94a3b8';

                return `
                <div ondblclick="window.gradosManager.openSingleCompEditor('${type}', ${comp.originalIndex})" 
                     class="group relative bg-white border-l-4 rounded-r-lg shadow-sm hover:shadow-md transition-all cursor-pointer p-4 border border-y-gray-200 border-r-gray-200 hover:-translate-y-0.5 select-none animate-fade-in-up"
                     style="border-left-color: ${color};">
                    
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-[10px] font-black px-2 py-0.5 rounded text-white uppercase tracking-wider" style="background-color: ${color}">
                            ${comp.autoCode}
                        </span>
                        <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                            <button onclick="event.stopPropagation(); window.gradosManager.openSingleCompEditor('${type}', ${comp.originalIndex})" class="text-gray-400 hover:text-indigo-600"><i class="fas fa-pencil-alt"></i></button>
                            <button onclick="event.stopPropagation(); window.gradosManager.deleteCompetency('${type}', ${comp.originalIndex})" class="text-gray-400 hover:text-red-500"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    
                    <p class="text-sm text-gray-700 leading-relaxed font-medium line-clamp-3" title="${this.escape(comp.text)}">
                        ${this.escape(comp.text) || '<span class="italic text-gray-400">Deskribapenik gabe...</span>'}
                    </p>
                    
                    <div class="mt-3 flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase">
                        <i class="fas fa-layer-group" style="color:${color}"></i>
                        ${this.escape(comp.area) || 'Esleitu gabe'}
                    </div>
                </div>`;
            }).join('');
            
            if (processedList.length === 0) {
                container.innerHTML = `<div class="text-center p-10 text-gray-400 italic">Ez da konpetentziarik aurkitu.</div>`;
            }
        });
    }

    // Helper txiki bat testuak garbitzeko (segurtasuna)
    escape(text) {
        if (!text) return "";
        return text.replace(/&/g, "&amp;")
                   .replace(/</g, "&lt;")
                   .replace(/>/g, "&gt;")
                   .replace(/"/g, "&quot;")
                   .replace(/'/g, "&#039;");
    }
	
    /**
     * 3. Edizio Modal Txikia (Item bakarrarentzat)
     * Hau irekiko da "Gehitu" edo "Klik Bikoitza" egitean.
     */
openSingleCompEditor(type, index) {
        // 1. DATUAK PRESTATU
        const isNew = (index === null);
        // Ziurtatu zerrenda existitzen dela
        if (!this.currentDegree.competencies[type]) {
            this.currentDegree.competencies[type] = [];
        }
        const list = this.currentDegree.competencies[type];
        
        // Editatu beharreko itema edo berria
        // Garrantzitsua: Kopia bat egin (...) jatorrizkoa ez aldatzeko "Utzi" eman arte
        const item = isNew ? { text: '', area: '', autoCode: '' } : { ...list[index] };
        
        const areas = this.currentDegree.subjectAreas || [];

        // 2. DROPDOWN AUKERAK SORTU
        const areaOptions = areas.map(a => 
            `<option value="${a.name}" ${item.area === a.name ? 'selected' : ''} style="background:${a.color}20; color:${a.color}; font-weight:bold;">${a.name}</option>`
        ).join('');

        // 3. HTML MODALA
        const modalHTML = `
        <div id="singleEditModal" class="fixed inset-0 bg-black/60 z-[6000] flex items-center justify-center backdrop-blur-sm animate-fade-in">
            <div class="bg-white rounded-xl shadow-2xl w-[600px] overflow-hidden transform transition-all scale-100">
                
                <div class="bg-slate-800 px-6 py-4 flex justify-between items-center">
                    <h3 class="text-white font-bold flex items-center gap-2">
                        <i class="fas ${isNew ? 'fa-plus-circle' : 'fa-edit'}"></i>
                        ${isNew ? 'Konpetentzia Berria Sortu' : 'Konpetentzia Editatu'}
                    </h3>
                    <button onclick="document.getElementById('singleEditModal').remove()" class="text-slate-400 hover:text-white transition-colors">
                        <i class="fas fa-times text-lg"></i>
                    </button>
                </div>
                
                <div class="p-6 space-y-5">
                    
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1.5">Ezagutza Eremua</label>
                        <div class="relative">
                            <select id="editor-area" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white appearance-none cursor-pointer shadow-sm">
                                <option value="">-- Aukeratu Eremua --</option>
                                ${areaOptions}
                            </select>
                            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <i class="fas fa-chevron-down text-xs"></i>
                            </div>
                        </div>
                        <p class="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                            <i class="fas fa-info-circle"></i>
                            <span>Hau aukeratzean, <strong>kodea (adib. IK-ZEH-01)</strong> automatikoki sortuko da gordean.</span>
                        </p>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1.5">Deskribapena</label>
                        <textarea id="editor-text" rows="6" class="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none shadow-sm leading-relaxed" placeholder="Idatzi hemen konpetentziaren definizioa...">${item.text}</textarea>
                    </div>
                </div>

                <div class="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
                    <button onclick="document.getElementById('singleEditModal').remove()" class="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg font-semibold text-sm transition-colors">
                        Utzi
                    </button>
                    <button id="btn-save-single" class="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all transform active:scale-95 flex items-center gap-2">
                        <i class="fas fa-save"></i> Gorde Konpetentzia
                    </button>
                </div>
            </div>
        </div>`;

        // Injektatu
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 4. GORDE BOTOIAREN LOGIKA (Hemen dago gakoa)
        document.getElementById('btn-save-single').onclick = () => {
            const newText = document.getElementById('editor-text').value.trim();
            const newArea = document.getElementById('editor-area').value;

            if (!newText || !newArea) {
                alert("Mesedez, bete eremua eta deskribapena.");
                return;
            }

            // --- KODEA SORTZEKO LOGIKA AUTOMATIKOA ---
            let finalCode = item.autoCode;

            // Kodea birkalkulatu behar da baldin eta:
            // 1. Item berria bada.
            // 2. Kodea hutsik badago.
            // 3. Eremua (Area) aldatu bada (adibidez ZEHARKAKO-tik TEKNIKOA-ra).
            if (isNew || !finalCode || item.area !== newArea) {
                
                // 1. Aurrizkia erabaki
                let prefix = 'IK-GEN'; // Generikoa
                const areaUp = newArea.toUpperCase();

                if (areaUp.includes('ZEHARKAKO')) prefix = 'IK-ZEH';
                else if (areaUp.includes('DISEINU')) prefix = 'IK-DIS';
                else if (areaUp.includes('TEKNIKOA')) prefix = 'IK-TEK';
                else if (areaUp.includes('KUDEAKETA')) prefix = 'IK-KUD';
                
                // 2. Kontatu zenbat dauden mota horretakoak zerrendan
                // (Oraingoa editatzen ari bagara, ez dugu kontatu behar bikoiztua ez izateko, baina sinplifikatzeko, zerrenda osoa begiratuko dugu)
                const existingCount = list.filter(c => c.area === newArea).length;
                
                // Berria bada +1, bestela mantendu (edo birkalkulatu segurtasunagatik)
                // Hobe dugu seguru jokatu: IDa existitzen ez bada, gehitu count-ari.
                const nextNum = isNew ? (existingCount + 1) : (existingCount > 0 ? existingCount : 1);
                
                const paddedNum = String(nextNum).padStart(2, '0');
                finalCode = `${prefix}-${paddedNum}`;
            }
            // ------------------------------------------

            // Objektu berria osatu
            const newItem = {
                ...item, // IDa eta beste datuak mantendu
                text: newText,
                area: newArea,
                autoCode: finalCode // <--- ORAIN HOR DAGO KODEA
            };

            // Gorde Array-an
            if (isNew) {
                list.push(newItem);
            } else {
                list[index] = newItem;
            }

            // Garbitu eta itxi
            document.getElementById('singleEditModal').remove();
            
            // Renderizatu (zure funtzioaren izenaren arabera, egokitu lerro hau)
            if (this.renderVisualCards) this.renderVisualCards(); 
            else if (this.renderEgresoComps) this.renderEgresoComps();
        };
    }
	
    /**
     * 4. Ezabatu
     */
    deleteCompetency(type, index) {
        if(confirm("Ziur zaude konpetentzia hau ezabatu nahi duzula?")) {
            this.currentDegree.competencies[type].splice(index, 1);
            this.renderVisualCards();
        }
    }
	

// ==========================================
    // SIDEBAR EGUNERAKETA ETA TOOLTIP-AK
    // ==========================================

    updateSidebarCompetenciesList() {
        if (!this.currentDegree || !this.currentDegree.competencies) return;

        const fillList = (type, listId) => {
            const list = this.currentDegree.competencies[type] || [];
            const ul = document.getElementById(listId);
            if (!ul) return;

            ul.innerHTML = ''; // Garbitu

            if (list.length === 0) {
                ul.innerHTML = '<li class="italic text-slate-600 text-[10px]">Ez dago definituta</li>';
                return;
            }

            // Gehienez 5 erakutsi
            list.slice(0, 5).forEach(comp => {
                const li = document.createElement('li');
                li.className = 'truncate cursor-help hover:text-white transition-colors py-0.5';
                
                // Kodea kalkulatu bistaratzeko
                const code = comp.autoCode ? `${comp.autoCode}` : '---';
                li.innerText = `${code}: ${comp.text}`;

                // --- TOOLTIP SISTEMA BERRIA ---
                // Ez dugu 'title' erabiltzen, baizik eta gure funtzio propioak
                li.onmouseenter = (e) => window.showCustomTooltip(e, comp.text, comp.area);
                li.onmouseleave = () => window.hideCustomTooltip();
                
                ul.appendChild(li);
            });

            if (list.length > 5) {
                const more = document.createElement('li');
                more.className = 'text-[10px] text-slate-500 italic pt-1';
                more.innerText = `...eta beste ${list.length - 5} gehiago`;
                ul.appendChild(more);
            }
        };

        fillList('ingreso', 'sarreraCompList');
        fillList('egreso', 'irteeraCompList');
    }
	
	// M¨¦todo para actualizar un ZH en todas partes
actualizarZHGlobal(zhCodeViejo, nuevosDatos) {
    if (!this.currentDegree) return;
    
    // 1. Actualizar en cat¨¢logo (Estructura: zhCode / zhDesc)
    if (this.currentDegree.zhCatalog) {
        const index = this.currentDegree.zhCatalog.findIndex(z => (z.zhCode || z.code) === zhCodeViejo);
        if (index !== -1) {
            this.currentDegree.zhCatalog[index] = { 
                ...this.currentDegree.zhCatalog[index], 
                zhCode: nuevosDatos.zhCode || nuevosDatos.code || zhCodeViejo,
                zhDesc: nuevosDatos.zhDesc || nuevosDatos.desc
            };
        }
    }
    
    // 2. Propagar a todas las asignaturas del grado
    if (this.cachedData?.graduak) {
        this.cachedData.graduak.forEach(grado => {
            Object.values(grado.year || {}).forEach(asignaturas => {
                asignaturas.forEach(asig => {
                    // Actualizar en zhRAs
                    if (asig.zhRAs) {
                        asig.zhRAs.forEach(zh => {
                            if (zh.zhCode === zhCodeViejo) {
                                zh.zhCode = nuevosDatos.zhCode || zh.zhCode;
                                zh.zhDesc = nuevosDatos.zhDesc || zh.zhDesc;
                            }
                        });
                    }
                    
                    // Actualizar Criterios de Evaluaci¨®n vinculados
                    if (asig.subjectCritEval) {
                        asig.subjectCritEval.forEach(crit => {
                            if (crit.raRelacionado === zhCodeViejo) {
                                crit.raRelacionado = nuevosDatos.zhCode || zhCodeViejo;
                                // Actualiza el prefijo del c¨®digo del criterio (ej: ZH1.CE1 -> ZH1_NEW.CE1)
                                if (nuevosDatos.zhCode) {
                                    crit.ceCode = crit.ceCode.replace(zhCodeViejo, nuevosDatos.zhCode);
                                }
                            }
                        });
                    }
                });
            });
        });
    }
    this.saveData();
}

 
    // 1. Pinta los checkboxes en el modal
    renderChecklistSelector(containerId, masterList, currentSelection, keyField, labelRenderFn) {
        const container = document.getElementById(containerId);
        if (!container) return; // Si no existe el hueco en HTML, no hace nada
        
        container.innerHTML = '';

        masterList.forEach(item => {
            // Comprobar si est¨¢ seleccionado (comparando por c¨®digo/ID)
            const isSelected = currentSelection.some(sel => {
                const selValue = (typeof sel === 'object') ? sel[keyField] : sel;
                return selValue === item[keyField];
            });

            const label = document.createElement('label');
            label.className = "flex items-start gap-3 p-2 hover:bg-white rounded cursor-pointer border border-transparent hover:border-gray-200 transition-colors";
            
            const checkbox = document.createElement('input');
            checkbox.type = "checkbox";
            checkbox.value = item[keyField]; 
            checkbox.checked = isSelected;
            checkbox.className = "mt-1 text-indigo-600 focus:ring-indigo-500 rounded";
            
            // Guardamos el objeto completo para no perder datos (colores, nombres, etc.)
            checkbox.dataset.fullObject = JSON.stringify(item); 

            const span = document.createElement('span');
            span.className = "text-sm text-gray-700 w-full";
            span.innerHTML = labelRenderFn(item);

            label.appendChild(checkbox);
            label.appendChild(span);
            container.appendChild(label);
        });
    }

    // 2. Recoge los datos al guardar
    getSelectedItems(containerId) {
        const selected = [];
        const container = document.getElementById(containerId);
        if(!container) return [];

        container.querySelectorAll('input:checked').forEach(cb => {
            if(cb.dataset.fullObject) {
                selected.push(JSON.parse(cb.dataset.fullObject));
            }
        });
        return selected;
    }

    updateSubjectsAreaName(oldName, newName) {
        if(!this.currentDegree.year) return;
        Object.values(this.currentDegree.year).forEach(list => {
            list.forEach(subj => {
                if (subj.subjectArea === oldName) subj.subjectArea = newName;
            });
        });
    }
    
    editCompetencies(t) { alert("Editatu: " + t); }

// ==========================================
    // BAIMENAK
    // ==========================================
// Funtzio laguntzailea irakasgai baten datua eguneratzeko
	async saveFieldChange(degreeId, subject, fieldKey, newValue, pathArray) {
		
		// pathArray: JSONaren barruko bide zehatza.
		// Adibidez, 1. mailako 3. irakasgaia bada: ['year', '1', '2', 'description']
		// MatrixEngine-k edo zure bistak bide hau jakin beharko luke.

		try {
			const { data, error } = await supabase
				.rpc('update_curriculum_value', {
					p_degree_id: degreeId,
					p_subject_code: subject.subjectCode, // Segurtasunerako gakoa
					p_path: pathArray,                   // Bide osoa: ['year', '1', 0, 'description']
					p_key: fieldKey,                     // Eremuaren izena: 'description' (balidaziorako)
					p_new_value: newValue                // Balio berria (JSON formatuan)
				});

			if (error) throw error;

			console.log("? Aldaketa gordeta:", data);
			alert("Ondo gorde da!");

		} catch (err) {
			console.error("? Errorea gordetzean:", err);
			alert("Errorea: " + err.message); // Hemen agertuko da "Ez daukazu baimenik..." mezua
		}
	}

}

const gradosManager = new GradosManager();
// Asignar a window SOLO si no existe (evitar sobrescritura)
if (!window.gradosManager) {
    window.gradosManager = gradosManager;
}

// grados-manager.js - AL FINAL, DESPU¨¦S DE window.gradosManager

// Asegurar funciones globales CR¨ªTICAS que usa el HTML
if (!window.selectDegree) {
    window.selectDegree = (e) => {
        if (window.gradosManager && window.gradosManager.selectDegree) {
            return window.gradosManager.selectDegree(e);
        }
        console.error('gradosManager no disponible para selectDegree');
    };
}

if (!window.createNewDegree) {
    window.createNewDegree = () => {
        if (window.gradosManager && window.gradosManager.createNewDegree) {
            return window.gradosManager.createNewDegree();
        }
        console.error('gradosManager no disponible para createNewDegree');
    };
}

// Tambi¨¦n asegurar otras funciones usadas en botones
if (!window.addSubjectArea) {
    window.addSubjectArea = () => {
        if (window.gradosManager && window.gradosManager.addSubjectArea) {
            return window.gradosManager.addSubjectArea();
        }
        console.error('gradosManager no disponible para addSubjectArea');
    };
}

if (!window.editSubjectArea) {
    window.editSubjectArea = (n) => {
        if (window.gradosManager && window.gradosManager.editSubjectArea) {
            return window.gradosManager.editSubjectArea(n);
        }
        console.error('gradosManager no disponible para editSubjectArea');
    };
}

// Funci¨®n para guardar ¨¢rea (si se usa en HTML)
if (!window.confirmSaveArea) {
    window.confirmSaveArea = () => {
        if (window.gradosManager && window.gradosManager.confirmSaveArea) {
            return window.gradosManager.confirmSaveArea();
        }
        console.error('gradosManager no disponible para confirmSaveArea');
    };
}

// Funci¨®n para crear nueva asignatura (si se usa)
if (!window.crearNuevaAsignatura) {
    window.crearNuevaAsignatura = (yearNum) => {
        if (window.gradosManager && window.gradosManager.crearNuevaAsignatura) {
            return window.gradosManager.crearNuevaAsignatura(yearNum);
        }
        console.error('gradosManager no disponible para crearNuevaAsignatura');
    };
}

// Funci¨®n para guardar datos b¨¢sicos de asignatura
if (!window.saveSubjectBasicData) {
    window.saveSubjectBasicData = () => {
        if (window.gradosManager && window.gradosManager.saveSubjectBasicData) {
            return window.gradosManager.saveSubjectBasicData();
        }
        console.error('gradosManager no disponible para saveSubjectBasicData');
    };
}

if (!window.openEditSubjectModal) {
    window.openEditSubjectModal = () => {
        if (window.gradosManager && window.gradosManager.openEditSubjectModal) {
            return window.gradosManager.openEditSubjectModal();
        }
        console.error('? gradosManager.openEditSubjectModal no disponible');
        alert('Funci¨®n openEditSubjectModal no disponible');
    };
    console.log('? openEditSubjectModal asignada a window');
}

if (window.gradosManager && !window.gradosManager.openEditSubjectModal) {
    console.warn('?? gradosManager NO tiene m¨¦todo openEditSubjectModal');
} else if (window.gradosManager) {
    console.log('? gradosManager tiene openEditSubjectModal');
}

// grados-manager.js - AL FINAL, DESPU¨¦S DE window.gradosManager

// Opcional: Registrar con AppCoordinator si existe
if (window.AppCoordinator) {
    window.AppCoordinator.registerModule('grados-manager', gradosManager);
}

window.openCompetenciesDashboard = () => window.gradosManager.openCompetenciesDashboard();

export default gradosManager;




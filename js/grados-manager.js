// js/grados-manager.js - VERSIÃ“N ESTABILIZADA
import { getSupabaseInstance } from './config.js';

class GradosManager {
	constructor() {
        // 1. EGOERA (STATE) HASIERAKETA
        // ----------------------------------------------------
        this.currentUser = null;
        this.degrees = [];          // Gradu guztien zerrenda (graduak taulatik)
        this.currentDegree = null;  // Uneko gradua (graduak taulako errenkada + JSONak)
        this.currentSubject = null; // Uneko irakasgaia (irakasgaiak taulako errenkada)
        
        // 2. KATALOGO OROKORRAK (Beste tauletatik datozenak)
        // ----------------------------------------------------
        this.adminCatalogs = {
            iduGuidelines: [],      // catalog_idu
            odsList: [],            // catalog_ods
            externalProjects: []    // admin_external_projects
        };

        // 3. IRAKASGAIEN MAPAKETA (Data Mapping)
        // ----------------------------------------------------
        // Zerrenda honek definitzen du zein datu doazen 'irakasgaiak' taulako
        // ZUTABE propiotara. Hauek EZ dira JSONean bikoiztu behar (nahiz eta lehen egon).
        this.subjectDirectDbFields = [
            'id',               // UUID (PK)
            'idAsig',           // Kode bakarra (Unique)
            'subjectTitle',     // Izena
            'subjectCode',      // Kode laburra
            'subjectCredits',   // Zenbakia (Numeric)
            'subjectType',      // Mota
            'language',         // Hizkuntza
            'semester',         // Seihilekoa / Urtekoa
            'year',             // Maila (Integer)
            'idDegree',         // FK Graduarekin lotura
            'subjectArea',      // Eremua (Testua) - Orain zutabe independentea
            'coordinator_id'    // Irakasle arduraduna
        ];

        // Zerrenda honek definitzen du zein datu sartu behar diren 'content'
        // JSONB zutabearen barruan. Hauek egitura konplexuak dira.
        this.subjectJsonContentFields = [
            'unitateak',            // Array (Unitate didaktikoak)
            'ganttPlanifikazioa',   // Objektua
            'matrizAsignatura',     // Objektua (rasVsUnidades, etc.)
            'currentOfficialRAs',   // Array
            'subjectCritEval',      // Array
            'idujar',               // Array (IDU)
            'preReq',               // Array
            'extProy',              // Array
            'signAct',              // Array
            'ods'                   // Array
        ];

        // 4. GRADUEN MAPAKETA
        // ----------------------------------------------------
        // Graduak taulak 3 JSON zutabe espezifiko ditu, ez 'content' generiko bat.
        // Beraz, horiek banaka identifikatu behar ditugu gordetzerakoan.
        this.degreeJsonColumns = [
            'matrices',       // jsonb
            'competencies',   // jsonb
            'subjectAreas'    // jsonb (Array)
        ];
        
        // Graduaren zutabe arruntak (testua)
        this.degreeDirectFields = [
            'idDegree',       // PK
            'selectedDegree', // Izena
            'codigo'          // Beste kode bat badaezpada
        ];
    }

    // --- MODIFICACI¨®N 1: El m¨¦todo initialize ---
	async initialize(user) {
        console.log("🚀 GradosManager abiarazten (SQL modua)...");
        this.currentUser = user;
        
        try {
            // Aseguramos la instancia de Supabase
            this.supabase = getSupabaseInstance();
            if (!this.supabase) {
                throw new Error("Supabase ez da kargatu GradosManager baino lehen.");
            }

            // Inyectar modales (hau mantendu zure kode zaharretik badaukazu)
            if (this.injectAreaModal) this.injectAreaModal(); 

            // PASO CLAVE: Cargar los catálogos en paralelo
            await this.loadCatalogs();

            // Cargar los grados (Graduak bakarrik, irakasgaiak gero kargatuko dira)
            await this.loadData();
            
            console.log("✅ GradosManager prest.");
            return true;

        } catch (error) {
            console.error("❌ Errorea GradosManager abiaraztean:", error);
            alert("Errorea datuak kargatzean. Freskatu orrialdea mesedez.");
            return false;
        }
    }
	
	
    // --- MODIFICACI¨®N 2: Nueva funci¨®n para cargar cat¨¢logos ---
	async loadCatalogs() {
        console.log("📚 Katalogoak kargatzen...");
        
        // Hiru kontsulta independente jaurti batera
        const [iduRes, odsRes, extProjectsRes] = await Promise.all([
            this.supabase.from('catalog_idu').select('*').order('codigo', { ascending: true }),
            this.supabase.from('catalog_ods').select('*').order('codigo', { ascending: true }),
            this.supabase.from('admin_external_projects').select('*').order('name', { ascending: true })
        ]);

        // Erroreak egiaztatu
        if (iduRes.error) throw new Error(`IDU errorea: ${iduRes.error.message}`);
        if (odsRes.error) throw new Error(`ODS errorea: ${odsRes.error.message}`);
        if (extProjectsRes.error) throw new Error(`Proj errorea: ${extProjectsRes.error.message}`);

        // Emaitzak gorde constructor-ean definitutako egituran
        this.adminCatalogs = {
            iduGuidelines: iduRes.data || [],
            odsList: odsRes.data || [],
            externalProjects: extProjectsRes.data || []
        };
        
        console.log(`📚 Katalogoak OK: ${this.adminCatalogs.iduGuidelines.length} IDU, ${this.adminCatalogs.odsList.length} ODS.`);
    }
	
// HEMEN DAGO ZURE saveData() FUNTZIO OSOA ZUZENDUTA
	async saveSubject(subjectData) {
        console.log("💾 SQLan Gordetzen:", subjectData.subjectTitle);
        const saveBtn = document.getElementById('saveSubjectBtn');
        if (saveBtn) saveBtn.disabled = true;

        try {
            // 1. ZUTABEAK PRESTATU (Constructor-ean definitutakoak)
            const dbPayload = {};    
            const jsonPayload = {};  

            // Eremu bakoitza bere lekura bidali
            Object.keys(subjectData).forEach(key => {
                // Eremu teknikoak saltatu
                if (['id', 'created_at', 'updated_at'].includes(key)) return;

                // 'subjectDirectDbFields' zure constructor-ean definituta egon behar da!
                if (this.subjectDirectDbFields && this.subjectDirectDbFields.includes(key)) {
                    dbPayload[key] = subjectData[key];
                } else {
                    jsonPayload[key] = subjectData[key];
                }
            });

            // JSON edukia 'content' zutabean sartu
            dbPayload.content = jsonPayload;
            
            // Segurtasuna: IDak
            if (!dbPayload.idDegree && this.currentDegree) {
                dbPayload.idDegree = this.currentDegree.idDegree;
            }
            // Zure kode zaharrak 'idAsig' edo 'code' erabili dezake. Ziurtatu idAsig dela.
            if (!dbPayload.idAsig && subjectData.code) {
                dbPayload.idAsig = subjectData.code;
            }

            console.log("📤 Bidaltzen den payload:", dbPayload);

            // 2. SUPABASE DEITU (Upsert)
            const { data, error } = await this.supabase
                .from('irakasgaiak')
                .upsert(dbPayload, { onConflict: 'idAsig' }) // Gako nagusia
                .select()
                .single();

            if (error) throw error;

            console.log("✅ DBan eguneratua. ID:", data.id);

            // 3. MEMORIA EGUNERATU (Pantaila ez freskatzeko)
            // SQLtik datorren data eta bidali dugun JSONa batu
            const mergedSubject = { 
                ...jsonPayload, 
                ...data, 
                content: undefined // Garbitu, ez bikoizteko
            };

            // Eguneratu uneko irakasgaia
            this.currentSubject = mergedSubject;
            
            // Eguneratu zerrenda nagusia (degrees array-a)
            if (this.currentDegree && this.currentDegree.subjects) {
                const index = this.currentDegree.subjects.findIndex(s => s.idAsig === mergedSubject.idAsig);
                if (index >= 0) {
                    this.currentDegree.subjects[index] = mergedSubject;
                } else {
                    this.currentDegree.subjects.push(mergedSubject);
                }
            }

            // 4. UI EGUNERATU (Xehetasunak)
            if (window.ui && window.ui.renderSubjectDetail) {
                window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
            }

            // 5. FEEDBACK (Toast mezua)
            this.showToast('✅ Datuak ondo gorde dira!');
            
            return true;

        } catch (err) {
            console.error("❌ Errorea SQL gordetzean:", err);
            alert("Errorea gordetzean: " + err.message);
            return false;
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    }
	
	// --- CARGA DE GRADO ESPECÃFICO ---
	async loadDegreeData(degreeId) {
        console.log("⏳ Datuak kargatzen...");

        // 1. GRADUA AURKITU (Hau lehen bezala, memoriatik)
        // Orain 'this.degrees' erabiltzen dugu (initialize-n kargatu duguna)
        this.currentDegree = this.degrees.find(d => d.idDegree === degreeId || d.id === degreeId);

        if (!this.currentDegree) return;

        try {
            // 2. IRAKASGAIAK JEITSI (Hau da BERRIA)
            // Itxaron egin behar dugu (await) Supabasek erantzun arte
            const { data: subjects, error } = await this.supabase
                .from('irakasgaiak')
                .select('*')
                .eq('idDegree', this.currentDegree.idDegree)
                .order('year', { ascending: true })
                .order('subjectTitle', { ascending: true });

            if (error) throw error;

            // 3. DATUAK BATU (SQL + JSON)
            // Zure aplikazioak datuak objektu bakar batean espero ditu
            this.currentDegree.subjects = subjects.map(s => ({
                ...s,          // SQL zutabeak (id, title...)
                ...(s.content || {}) // JSON barrukoak (unitateak, gantt...)
            }));

            // 4. UI EGUNERATU (Zure funtzio zaharra)
            this.renderDegreeView();

        } catch (err) {
            console.error("❌ Errorea:", err);
            alert("Ezin izan dira irakasgaiak kargatu.");
        }
    }	
	// En GradosManager class, despu¨¦s del constructor
	/*getZhFromCatalog(zhCode) {
		if (!this.currentDegree?.zhCatalog) return null;
		return this.currentDegree.zhCatalog.find(zh => zh.code === zhCode);
	}*/
	

	/*getFullZhDescription(zhItem) {
		// 1. Prioridad: Descripci¨®n espec¨ªfica de la asignatura
		const localDesc = zhItem.zhDesc || zhItem.raDesc || zhItem.desc;
		if (localDesc) return localDesc;
		
		// 2. Fallback: Buscar en el cat¨¢logo global por c¨®digo
		const codeToSearch = zhItem.zhCode || zhItem.code || zhItem.raCode;
		const catalogZh = this.currentDegree?.zhCatalog?.find(z => (z.zhCode || z.code) === codeToSearch);
		
		return catalogZh?.zhDesc || catalogZh?.desc || 'Deskribapenik gabe';
	}*/


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
	async crearNuevaAsignatura(yearNum) {
        if (!this.currentDegree) {
            alert("Mesedez, hautatu gradu bat lehenago.");
            return;
        }

        // 1. Kalkulatu hurrengo kodea (Array laua iragaziz)
        // Lehen: this.currentDegree.year[yearNum].length
        // Orain: this.currentDegree.subjects iragazi
        const subjectsInYear = (this.currentDegree.subjects || []).filter(s => s.year === yearNum);
        const indice = subjectsInYear.length + 1;
        
        const gradoCodigo = this.currentDegree.codigo || 'G';
        const idAsig = `${gradoCodigo}_${yearNum}_${String(indice).padStart(3, '0')}`;

        // 2. Objektua sortu
        const newSubj = {
            idAsig: idAsig, // Gako nagusia
            subjectTitle: 'Irakasgai Berria',
            subjectCode: 'NEW',
            year: yearNum,
            subjectCredits: 6,
            subjectType: 'Oinarrizkoa',
            idDegree: this.currentDegree.idDegree, // Lotura

            // JSON eremuak hutsik
            unitateak: [],
            ods: [],
            idujar: [],
            extProy: [],
            currentOfficialRAs: []
        };

        // 3. GORDE (Zure saveData berriak dena egingo du: DB + Memoria)
        await this.saveData(newSubj);
        
        // 4. UI EGUNERATU (Zuk zenuen bezala)
        this.selectYear(yearNum);
        this.selectSubject(newSubj);
        
        setTimeout(() => {
            this.openEditSubjectModal();
        }, 150);
    }
	
	openEditSubjectModal() {
        if (!this.currentSubject) return;
        const subj = this.currentSubject;
        
        // 1. ELEMENTUAK HAURTADU (Zure ID originalak)
        const codeInput = document.getElementById('subject_edit_code'); 
        const nameInput = document.getElementById('subject_edit_name');
        const areaSelect = document.getElementById('subject_edit_area');
        const typeSelect = document.getElementById('subject_edit_type');
        
        // Balioak bete
        if(codeInput) codeInput.value = subj.idAsig || subj.subjectCode || '';
        if(nameInput) nameInput.value = subj.subjectTitle || subj.name || '';
        
        // 2. MOTAK (Types)
        if (typeSelect) {
            typeSelect.innerHTML = '';
            // Memoriatik motak kargatu
            const dbTypes = this.loadUniqueSubjectTypes();
            
            const defaultOpt = document.createElement('option');
            defaultOpt.value = "";
            defaultOpt.textContent = "-- Hautatu --";
            typeSelect.appendChild(defaultOpt);

            dbTypes.forEach(tipo => {
                const opt = document.createElement('option');
                opt.value = tipo;
                opt.textContent = tipo;
                typeSelect.appendChild(opt);
            });

            typeSelect.value = subj.subjectType || subj.tipo || '';
        }

        // 3. AREAK (Areas)
        if (areaSelect && this.currentDegree) {
            areaSelect.innerHTML = '<option value="">-- Hautatu --</option>';
            // Area zerrenda graduan bertan dago
            const areas = this.currentDegree.subjectAreas || [];
            
            areas.forEach(area => {
                const opt = document.createElement('option');
                const areaName = typeof area === 'object' ? area.name : area;
                opt.value = areaName;
                opt.textContent = areaName;
                if (areaName === subj.subjectArea) opt.selected = true;
                areaSelect.appendChild(opt);
            });
        }

        // 4. KATALOGOAK (Checklist-ak)
        // window.ui erabiltzen jarraitzen dugu.
        // Datuak 'this.adminCatalogs'-etik pasatzen dizkiogu (initialize-n kargatuta daude)
        if (window.ui && window.ui.renderChecklistSelector) {
            
            // A. IDU
            window.ui.renderChecklistSelector(
                'editIduContainer', 
                this.adminCatalogs.iduGuidelines || [], // <-- ALDAKETA TXIKIA: Hemen daude datuak orain
                subj.idujar || [], 
                'idu_chk'
            );

            // B. ODS
            window.ui.renderChecklistSelector(
                'editOdsContainer',
                this.adminCatalogs.odsList || [], // <-- ALDAKETA TXIKIA
                subj.ods || [],
                'ods_chk'
            );

            // C. PROIEKTUAK
            window.ui.renderChecklistSelector(
                'editExtProyContainer',
                this.adminCatalogs.externalProjects || [], // <-- ALDAKETA TXIKIA
                subj.extProy || [],
                'ext_chk'
            );
        }

        // 5. ERAKUTSI
        const modal = document.getElementById('editSubjectModal');
        if (modal) modal.classList.remove('hidden');
    }
	
	// EN GRADOS-MANAGER.JS
	async saveSubjectBasicData() {
        console.log("📝 Datu basikoak eguneratzen (SQL Modua)...");
        
        if (!this.currentSubject) {
            console.error("Ez dago irakasgairik aukeratuta");
            return;
        }

        // 1. FORMULARIOKO INPUT-AK IRAKURRI
        // Ziurtatu zure HTMLan ID hauek daudela. 
        // Bestela aldatu IDak behean, zure HTMLaren arabera.
        
        const codeInput = document.getElementById('subject_edit_code') || document.getElementById('editSubjectCode');
        const nameInput = document.getElementById('subject_edit_name') || document.getElementById('editSubjectTitle');
        const areaSelect = document.getElementById('subject_edit_area') || document.getElementById('editSubjectArea');
        const typeSelect = document.getElementById('subject_edit_type') || document.getElementById('editSubjectType');
        const creditsInput = document.getElementById('editSubjectCredits'); // Hau berria izan daiteke
        
        // 2. MEMORIAKO OBJEKTUA EGUNERATU
        // Kopia bat egiten dugu segurtasunagatik
        const updatedSubject = { ...this.currentSubject };

        if (codeInput) updatedSubject.idAsig = codeInput.value.trim(); // SQLn idAsig da gakoa
        if (nameInput) updatedSubject.subjectTitle = nameInput.value.trim();
        if (areaSelect) updatedSubject.subjectArea = areaSelect.value;
        if (typeSelect) updatedSubject.subjectType = typeSelect.value;
        if (creditsInput) updatedSubject.subjectCredits = parseFloat(creditsInput.value);

        // ODS, IDU, Proiektuak... horiek jada memorian daude (currentSubject),
        // ez ditugu inputetatik irakurri behar (ondo diozun bezala).

        // 3. DATU BASEAN GORDE (SQL FUNTZIO BERRIA)
        const success = await this.saveSubject(updatedSubject);

        if (success) {
            // 4. ARRAKASTA BADA, MODALA ITXI
            const modal = document.getElementById('editSubjectModal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            
            // 5. URTEKO BISTA EGUNERATU (Izena/Kolorea aldatu bada)
            if (window.ui && window.ui.renderYearView && this.currentDegree) {
                const yearStr = this.currentYear ? String(this.currentYear) : "1";
                window.ui.renderYearView(this.currentDegree, yearStr);
            }
        }
    }
	
// 1. POPULATE (Zerrenda marraztu) - HAU ONDO DAGO
    populateDegreeSelect() {
        const select = document.getElementById('degreeSelect');
        if (!select || !this.degrees) return;
        
        select.innerHTML = '';

        // Default option
        const defaultOp = document.createElement('option');
        defaultOp.value = "";
        defaultOp.textContent = "Hautatu gradua...";
        defaultOp.disabled = true;
        if (!this.currentDegree) defaultOp.selected = true;
        select.appendChild(defaultOp);

        // New Degree option (Admin)
        if (this.currentUser && this.currentUser.role === 'admin') {
            const createOp = document.createElement('option');
            createOp.value = "NEW_DEGREE";
            createOp.textContent = "➕ Gradu Berria Sortu...";
            createOp.style.fontWeight = "bold";
            createOp.style.color = "blue";
            select.appendChild(createOp);
        }

        // Real Degrees
        this.degrees.forEach(g => {
            const op = document.createElement('option');
            op.value = g.idDegree; 
            op.textContent = g.selectedDegree || g.name || "Izenik gabea";
            if (this.currentDegree && this.currentDegree.idDegree === g.idDegree) {
                op.selected = true;
            }
            select.appendChild(op);
        });
    }

    // 2. SELECT (Aukeraketa kudeatu) - HAU DA ZUZENA (LoadData barruan duena)
    async selectDegree(e) {
        const val = (e.target && e.target.value) ? e.target.value : e;
        
        // A) GRADU BERRIA
        if (val === "NEW_DEGREE") {
            this.createNewDegree(); 
            return;
        }

        // B) GRADUA KARGATU (SQLtik zuzenean)
        console.log(`⏳ Gradua kargatzen: ${val}...`);
        
        this.currentDegree = this.degrees.find(d => d.idDegree === val || d.id === val);
        
        if (!this.currentDegree) {
            console.error("Gradua ez da aurkitu.");
            return;
        }

        try {
            // HEMEN dago gakoa: 'loadDegreeData' deitu beharrean, 
            // kodea hemen bertan daukagu.
            const { data: subjects, error } = await this.supabase
                .from('irakasgaiak')
                .select('*')
                .eq('idDegree', this.currentDegree.idDegree)
                .order('year', { ascending: true })
                .order('subjectTitle', { ascending: true });

            if (error) throw error;

            // Datuak fusionatu
            this.currentDegree.subjects = subjects.map(s => ({
                ...s,
                ...(s.content || {}) 
            }));

            // UI marraztu
            this.renderDegreeView(); 

        } catch (err) {
            console.error("❌ Errorea irakasgaiak kargatzean:", err);
        }
    } 

	
	async createNewDegree() {
        // 1. Admin dela ziurtatu
        /* if (!this.currentUser || this.currentUser.role !== 'admin') {
            alert("Ez daukazu baimenik graduak sortzeko.");
            this.populateDegreeSelect(); // Select-a reset
            return;
        }
        */

        const name = prompt("Sartu gradu berriaren izena:");
        if (!name) {
            this.populateDegreeSelect(); // Utzi ezean, reset
            return;
        }

        try {
            // 2. ID berria sortu
            // UUID bat izan daiteke, edo zuk erabiltzen zenuen 'G-timestamp' formatua
            const newId = "G-" + Date.now(); 

            // 3. OBJEKTUA PRESTATU (SQL Zutabeak)
            const newDegreePayload = {
                "idDegree": newId,
                "selectedDegree": name,
                "codigo": newId,
                // Hasieratu JSON eremuak hutsik, errorea eman ez dezaten
                "matrices": {},
                "competencies": {},
                "subjectAreas": [] 
            };

            // 4. SQL INSERT (Supabase)
            const { error } = await this.supabase
                .from('graduak')
                .insert(newDegreePayload);

            if (error) throw error;

            console.log("✅ Gradu berria sortuta:", name);

            // 5. MEMORIA EGUNERATU
            // Ez dugu orrialdea birkargatu behar, zerrenda lokala eguneratu baizik
            this.degrees.push(newDegreePayload);
            
            // 6. UI EGUNERATU
            this.populateDegreeSelect(); // Berriro marraztu (berria barne)
            
            // 7. AUTOMATIKOKI HAUTATU
            // Select-aren balioa aldatu eta kargatu
            const select = document.getElementById('degreeSelect');
            if (select) select.value = newId;
            
            await this.loadDegreeDetails(newId); // Kargatu (hutsik egongo da noski)

        } catch (err) {
            console.error("❌ Errorea gradu berria sortzean:", err);
            alert("Errorea gertatu da gradua sortzean. Begiratu kontsola.");
            this.populateDegreeSelect(); // Reset
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


// ?? FUNCION 2: SELECTOR DE ASIGNATURA (Para seleccionar cu¨¢les se trabajan)
    // Solo permite marcar/desmarcar (Grid Visual)
	openOdsSelector() {
		console.log("🟢 ODS hautatzailea irekitzen (Bertsio Sendoa)...");

		// 1. GARBITASUNA: Ezabatu aurreko leihoak (baldin badaude)
		document.querySelectorAll('.ods-modal-overlay').forEach(m => {
			m.style.opacity = '0';
			setTimeout(() => m.remove(), 100);
		});

		// 2. HELPERRAK
		const getCleanNumber = (val) => {
			if (!val) return null;
			const str = (typeof val === 'object') ? (val.code || val.odsCode || val.id || '') : String(val);
			const match = String(str).match(/\d+/);
			return match ? parseInt(match[0], 10) : null;
		};

		const getImageUrl = (num) => {
			if (!num) return '';
			const n = String(num).padStart(2, '0');
			return `assets/ods/${n}.png`;
		};

		// 3. EGOERA KARGATU
		let currentSelection = [];
		if (this.currentSubject.detailODS && Array.isArray(this.currentSubject.detailODS)) {
			currentSelection = [...this.currentSubject.detailODS];
		} else if (this.currentSubject.ods && Array.isArray(this.currentSubject.ods)) {
			const catalog = this.adminCatalogs.ods || [];
			currentSelection = this.currentSubject.ods.map(code => {
				const num = getCleanNumber(code);
				return catalog.find(c => getCleanNumber(c) === num) || { code: code, name: '...' };
			});
		}

		// 4. UI SORTU
		const modal = document.createElement('div');
		// ⭐ GARRANTZITSUA: 'ods-modal-overlay' klasea gehitu dugu hemen, bestela hasierako garbitzeak ez du funtzionatuko
		modal.className = "ods-modal-overlay fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200";
		
		const content = document.createElement('div');
		content.className = "bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden";
		
		content.innerHTML = `
			<div class="p-5 border-b flex justify-between items-center bg-gray-50">
				<div>
					<h3 class="font-bold text-xl text-gray-800">Garapen Iraunkorrerako Helburuak</h3>
					<p class="text-sm text-gray-500">Aukeratu irakasgaiari dagozkionak</p>
				</div>
				<button id="closeOdsModal" class="p-2 hover:bg-gray-200 rounded-full transition"><i class="fas fa-times text-xl"></i></button>
			</div>
			
			<div class="p-6 overflow-y-auto bg-gray-100 flex-1">
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" id="odsGrid"></div>
			</div>

			<div class="p-4 border-t bg-white flex justify-end gap-3 shadow-lg">
				<button id="cancelOds" class="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition">Utzi</button>
				<button id="finishOds" class="bg-blue-600 text-white px-8 py-2 rounded-lg hover:bg-blue-700 font-bold shadow-md transform active:scale-95 transition">Gorde Aldaketak</button>
			</div>
		`;

		modal.appendChild(content);
		document.body.appendChild(modal);

		// 5. GRID-A MARRAZTU
		const grid = content.querySelector('#odsGrid');
		const catalog = this.adminCatalogs.ods || [];

		catalog.forEach(item => {
			const itemNum = getCleanNumber(item);
			let isSelected = currentSelection.some(sel => getCleanNumber(sel) === itemNum);
			
			const card = document.createElement('div');
			const baseClass = "relative cursor-pointer group rounded-xl transition-all duration-200 flex flex-col items-center overflow-hidden border-2 bg-white h-full";
			const selectedClass = "border-blue-600 ring-1 ring-blue-600 shadow-md transform scale-[1.02]";
			const unselectedClass = "border-transparent hover:border-gray-300 hover:shadow-sm opacity-90 hover:opacity-100";

			card.className = `${baseClass} ${isSelected ? selectedClass : unselectedClass}`;
			
			card.innerHTML = `
				<div class="w-full aspect-square relative p-4 pb-0">
					<img src="${getImageUrl(itemNum)}" class="w-full h-full object-contain drop-shadow-sm transition-all duration-300 ${isSelected ? '' : 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'}" loading="lazy">
					<div class="check-icon absolute top-2 right-2 bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-0'}">
						<i class="fas fa-check text-sm"></i>
					</div>
				</div>
				<div class="p-3 w-full text-center flex items-center justify-center grow">
					<span class="text-xs font-bold leading-tight line-clamp-3 ${isSelected ? 'text-blue-700' : 'text-gray-600 group-hover:text-gray-800'}">${item.name || '...'}</span>
				</div>
			`;

			card.onclick = () => {
				isSelected = !isSelected;
				if (isSelected) {
					if (!currentSelection.some(sel => getCleanNumber(sel) === itemNum)) currentSelection.push(item);
					card.className = `${baseClass} ${selectedClass}`;
					card.querySelector('img').classList.remove('grayscale', 'opacity-60');
					card.querySelector('.check-icon').classList.replace('scale-0', 'scale-100');
					card.querySelector('span').classList.replace('text-gray-600', 'text-blue-700');
				} else {
					currentSelection = currentSelection.filter(sel => getCleanNumber(sel) !== itemNum);
					card.className = `${baseClass} ${unselectedClass}`;
					card.querySelector('img').classList.add('grayscale', 'opacity-60');
					card.querySelector('.check-icon').classList.replace('scale-100', 'scale-0');
					card.querySelector('span').classList.replace('text-blue-700', 'text-gray-600');
				}
			};
			grid.appendChild(card);
		});

		// 6. ITXIERA KUDEAKETA (Segurua)
		let isClosing = false;
		const closeModal = () => {
			if (isClosing) return;
			isClosing = true;
			modal.style.opacity = '0';
			modal.style.pointerEvents = 'none';
			setTimeout(() => {
				if (modal.parentNode) modal.parentNode.removeChild(modal);
				isClosing = false;
			}, 300);
		};

		content.querySelector('#closeOdsModal').onclick = closeModal;
		content.querySelector('#cancelOds').onclick = closeModal;

		// 7. GORDE (Sinkronizazio Aurreratua)
		content.querySelector('#finishOds').onclick = async () => {
			// A) Klik bikoitza saihestu (Debounce)
			if (this._isSavingOds) {
				console.log("⏳ Itxaron, gordetzen ari da...");
				return;
			}
			
			const btn = content.querySelector('#finishOds');
			const originalHtml = btn.innerHTML;
			btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
			btn.disabled = true;
			this._isSavingOds = true;

			try {
				// B) Datuak prestatu
				this.currentSubject.detailODS = [...currentSelection];
				this.currentSubject.ods = currentSelection.map(s => s.code);
				this.currentSubject.updated_at = new Date().toISOString();

				// C) SINKRONIZAZIOA (Pakete nagusiarekin)
				if (this.curriculumData && this.curriculumData.subjects) {
					const index = this.curriculumData.subjects.findIndex(s => s.code === this.currentSubject.code);
					if (index !== -1) {
						// Objektua erabat ordezkatu bertsio berriarekin
						this.curriculumData.subjects[index] = { ...this.currentSubject };
					}
				}
				// Gauza bera cachearekin
				if (this.cachedData && this.cachedData.subjects) {
					const index = this.cachedData.subjects.findIndex(s => s.code === this.currentSubject.code);
					if (index !== -1) {
						this.cachedData.subjects[index] = { ...this.currentSubject };
					}
				}

				// D) Supabasera bidali
				if (this.saveSubjectBasicData) {
					await this.saveSubjectBasicData();
				} else {
					await this.saveData();
				}

				// E) UI Eguneratu eta Itxi
				if (window.ui && window.ui.renderSubjectDetail) {
					window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
				}
				closeModal();

			} catch (error) {
				console.error("❌ Errorea gordetzean:", error);
				alert("Errorea: " + error.message);
				btn.innerHTML = originalHtml;
				btn.disabled = false;
			} finally {
				this._isSavingOds = false;
			}
		};
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
		// ZUZENKETA: 'idujar' propietatea zuzenean
		const currentList = this.currentSubject.idujar || [];

		const modal = document.createElement('div');
		modal.className = "fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm";
		
		const content = document.createElement('div');
		content.className = "bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200";
		
		content.innerHTML = `
			<div class="p-4 border-b flex justify-between items-center bg-gray-50">
				<h3 class="font-bold text-lg text-gray-800">Hautatu IDU Jarraibideak</h3>
				<button id="closeIduModal" class="p-2 hover:bg-gray-200 rounded-full transition"><i class="fas fa-times"></i></button>
			</div>
			<div class="p-6 overflow-y-auto space-y-6" id="iduContent"></div>
			<div class="p-4 border-t bg-gray-50 flex justify-end">
				<button id="finishIdu" class="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 font-medium">Ados</button>
			</div>
		`;

		modal.appendChild(content);
		document.body.appendChild(modal);

		const container = content.querySelector('#iduContent');
		const catalog = this.adminCatalogs.iduGuidelines || [];

		// Multzokatu (logika bisuala mantenduz)
		const grouped = { 'EKINTZA': [], 'INPLIKAZIOA': [], 'IRUDIKAPENA': [] };
		catalog.forEach(item => {
			const key = Object.keys(grouped).find(k => item.range && item.range.includes(k));
			if (key) grouped[key].push(item);
			else grouped['EKINTZA'].push(item);
		});

		Object.entries(grouped).forEach(([groupName, items]) => {
			if(items.length === 0) return;
			
			let colorClass = 'text-gray-700';
			let bgClass = 'bg-gray-100';
			if(groupName === 'EKINTZA') { colorClass = 'text-blue-700'; bgClass = 'bg-blue-50'; }
			if(groupName === 'INPLIKAZIOA') { colorClass = 'text-emerald-700'; bgClass = 'bg-emerald-50'; }
			if(groupName === 'IRUDIKAPENA') { colorClass = 'text-purple-700'; bgClass = 'bg-purple-50'; }

			const groupDiv = document.createElement('div');
			groupDiv.innerHTML = `<h4 class="font-bold ${colorClass} ${bgClass} px-3 py-2 rounded mb-3 text-sm tracking-wider sticky top-0 z-10 border">${groupName}</h4>`;
			
			const grid = document.createElement('div');
			grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3";
			
			items.forEach(item => {
				const card = document.createElement('div');
				// 'idujar' zerrendan bilatu
				const isSelected = currentList.some(o => o.code === item.code);

				card.className = `cursor-pointer p-3 rounded border text-sm transition relative ${
					isSelected ? 'bg-teal-50 border-teal-500 shadow-md' : 'bg-white border-gray-200 hover:border-teal-300'
				}`;
				
				card.innerHTML = `
					<div class="flex justify-between items-start mb-1">
						<span class="font-bold text-xs bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">${item.code.replace('IDU-','')}</span>
						${isSelected ? '<i class="fas fa-check-circle text-teal-600"></i>' : ''}
					</div>
					<p class="text-gray-600 leading-snug text-xs">${item.name}</p>
				`;

				card.onclick = () => {
					let list = this.currentSubject.idujar || [];
					
					const exists = list.some(o => o.code === item.code);

					if (exists) {
						// KENDU
						list = list.filter(o => o.code !== item.code);
					} else {
						// GEHITU
						list.push(item);
					}

					// GORDE 'idujar' aldagaian
					this.currentSubject.idujar = list;
					
					modal.remove();
					this.openIduSelector();
					 if (window.ui && window.ui.renderSubjectDetail) {
					   window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
					}
				};
				grid.appendChild(card);
			});
			
			groupDiv.appendChild(grid);
			container.appendChild(groupDiv);
		});

		content.querySelector('#closeIduModal').onclick = () => modal.remove();
		content.querySelector('#finishIdu').onclick = () => {
			modal.remove();
			if (window.ui && window.ui.renderSubjectDetail) window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
		};
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
		let tempSelection = [...(this.currentSubject.extProy || [])];

		const modal = document.createElement('div');
		modal.className = "fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm transition-all";
		
		const content = document.createElement('div');
		content.className = "bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200";
		
		content.innerHTML = `
			<div class="p-5 border-b bg-gray-50 space-y-3">
				<div class="flex justify-between items-center">
					<h3 class="font-bold text-xl text-gray-800">Hautatu Kanpo Proiektuak</h3>
					<button id="closePrModal" class="p-2 hover:bg-gray-200 rounded-full transition"><i class="fas fa-times text-xl"></i></button>
				</div>
				<div class="relative">
					<i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
					<input type="text" id="projectSearch" placeholder="Bilatu izena edo agentearen arabera..." 
						class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition">
				</div>
			</div>
			
			<div class="p-6 overflow-y-auto bg-gray-50 flex-1">
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="prGrid"></div>
				<div id="noResults" class="hidden text-center py-10 text-gray-500 italic">Ez da emaitzarik aurkitu.</div>
			</div>

			<div class="p-4 border-t bg-white flex justify-end gap-3 shadow-lg">
				 <div class="flex-1 flex items-center px-2 text-sm text-gray-500">
					<span id="selectedCount" class="font-bold text-orange-600 mr-1">0</span> hautatuta
				</div>
				<button id="cancelPr" class="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition">Utzi</button>
				<button id="finishPr" class="bg-orange-600 text-white px-8 py-2 rounded-lg hover:bg-orange-700 font-bold shadow-md transform active:scale-95 transition">Ados (Gorde)</button>
			</div>
		`;

		modal.appendChild(content);
		document.body.appendChild(modal);

		const grid = content.querySelector('#prGrid');
		const noResults = content.querySelector('#noResults');
		const searchInput = content.querySelector('#projectSearch');
		const countLabel = content.querySelector('#selectedCount');
		const catalog = this.adminCatalogs.externalProjects || [];

		const renderGrid = (filterText = '') => {
			grid.innerHTML = '';
			const lowerFilter = filterText.toLowerCase();
			let visibleCount = 0;

			catalog.forEach(item => {
				// Iragazketa logika
				const match = (item.name && item.name.toLowerCase().includes(lowerFilter)) || 
							  (item.agent && item.agent.toLowerCase().includes(lowerFilter));
				
				if (!match) return;
				visibleCount++;

				const isSelected = tempSelection.some(o => (o.code && o.code === item.code) || (o.id && o.id === item.id));
				
				const card = document.createElement('div');
				card.className = `cursor-pointer p-4 rounded-xl border transition-all duration-200 flex items-start gap-4 ${
					isSelected 
					? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500 shadow-md' 
					: 'bg-white border-gray-200 hover:border-orange-300 hover:shadow-sm'
				}`;

				card.innerHTML = `
					<div class="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm" style="background-color: ${item.color || '#fdba74'}">
						<i class="fas fa-building"></i>
					</div>
					<div class="flex-1 min-w-0">
						<div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">${item.agent || 'Agentea'}</div>
						<div class="text-sm font-bold text-gray-800 leading-tight">${item.name}</div>
					</div>
					${isSelected ? '<div class="text-orange-600 text-xl"><i class="fas fa-check-circle"></i></div>' : ''}
				`;

				card.onclick = () => {
					const exists = tempSelection.some(o => (o.code && o.code === item.code) || (o.id && o.id === item.id));
					if (exists) {
						tempSelection = tempSelection.filter(o => (o.code && o.code !== item.code) || (o.id && o.id !== item.id));
					} else {
						tempSelection.push(item);
					}
					// Grid osoa birmarraztu ordez, bakarrik txartela eguneratu dezakegu optimizatzeko, 
					// baina iragazkiarekin errazagoa da dena birmarraztea.
					renderGrid(searchInput.value); 
				};
				grid.appendChild(card);
			});

			// Emaitzarik ez badago
			noResults.style.display = visibleCount === 0 ? 'block' : 'none';
			countLabel.textContent = tempSelection.length;
		};

		// Hasierako marrazketa
		renderGrid();

		// Bilatzailea entzun
		searchInput.addEventListener('input', (e) => {
			renderGrid(e.target.value);
		});

		const closeModal = () => {
			modal.classList.add('opacity-0');
			setTimeout(() => modal.remove(), 200);
		};

		content.querySelector('#closePrModal').onclick = closeModal;
		content.querySelector('#cancelPr').onclick = closeModal;

		content.querySelector('#finishPr').onclick = () => {
			this.currentSubject.extProy = tempSelection;
			
			// 💾 GORDE
			if (this.saveSubjectBasicData) this.saveSubjectBasicData();
			
			closeModal();
			if (window.ui && window.ui.renderSubjectDetail) {
				window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
			}
		};
		
		// Autofocus bilatzailean
		setTimeout(() => searchInput.focus(), 100);
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

/*async saveListEditor() {
    if (!this.currentEditingField) return;
    
    const fieldName = this.currentEditingField;
    const isDegree = this.isEditingDegree; 

    console.log(`🔧 Guardando lista "${fieldName}" en ${isDegree ? 'GRADUA' : 'IRAKASGAIA'}`);
    
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
        
        // ✨ ALDAKETA HEMEN: context erabili beharrean, erroan zuzenean
        // Datua erroko propietatean gorde
        this.currentSubject[fieldName] = newList;

        // Refrescar Detalle Asignatura
        if (window.ui && window.ui.renderSubjectDetail) {
            window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
        }
    }
    
    // 2. GUARDAR EN SUPABASE (BD)
    // Usamos 'await' para esperar a que se guarde antes de cerrar el modal
    try {
        await this.saveData(); 
        console.log("✅ Datos guardados correctamente en BD");
    } catch (e) {
        console.error("❌ Error al guardar en BD:", e);
        // Aquí podrías mostrar un aviso al usuario si falla
    }

    // 3. CERRAR MODAL
    const modal = document.getElementById('listEditorModal');
    if(modal) modal.classList.add('hidden');
}*/
	
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

/*    normalizarCodigosAlGuardar(subject, tecRAs, zhRAs) {
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
    }*/

// Laguntzailea: Toast mezua erakusteko (zure kode zaharretik kopiatua)
    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; 
            background: #10B981; color: white; padding: 15px 20px;
            border-radius: 8px; z-index: 10000; font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
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

		// 2. Inicializar datos locales - ✨ ALDAKETA: erroan zuzenean
		if (!Array.isArray(this.currentSubject.preReq)) {
			this.currentSubject.preReq = []; // Erroan hasieratu
		}
		const localList = this.currentSubject.preReq; // ✨ context erabili gabe

		// ---------------------------------------------------------
		// 3. FUNCIÓN PARA LEER ÁREAS DINÁMICAMENTE
		// ---------------------------------------------------------
		const getAreasFromSystem = () => {
			const areaColorMap = {};
			
			console.log("🔍 Eremuak bilatzen...");
			
			// currentDegree-tik hartu (gradu bakoitzak bere eremuak ditu)
			if (this.currentDegree?.subjectAreas) {
				const areas = this.currentDegree.subjectAreas;
				
				console.log(`${areas.length} eremu aurkituak currentDegree.subjectAreas-en`);
				
				areas.forEach(area => {
					if (area && area.name) {
						areaColorMap[area.name] = area.color || 'hsl(0, 0%, 70%)';
						console.log(`  ✅ "${area.name}" -> ${areaColorMap[area.name]}`);
					}
				});
			} 
			// cloudModel-en bilatu fallback gisa
			else if (this.cloudModel?.degrees) {
				console.log("🔍 CloudModel-en bilatzen...");
				
				const currentDegreeId = this.currentDegree?.id || this.currentSubject.degreeId;
				if (currentDegreeId) {
					const degreeInCloud = this.cloudModel.degrees.find(d => d.id === currentDegreeId);
					if (degreeInCloud?.subjectAreas) {
						degreeInCloud.subjectAreas.forEach(area => {
							if (area && area.name) {
								areaColorMap[area.name] = area.color || 'hsl(0, 0%, 70%)';
							}
						});
					}
				}
			}
			
			console.log(`📊 Guztira ${Object.keys(areaColorMap).length} eremu eskuragarri`);
			return areaColorMap;
		};

		const areaColorMap = getAreasFromSystem();
		const areaCount = Object.keys(areaColorMap).length;
		const sortedAreaNames = Object.keys(areaColorMap).sort((a, b) => 
			a.localeCompare(b, 'eu')
		);

		// Kolorea parseatzeko funtzioa
		const parseColor = (hsl) => {
			if (!hsl) return '#94a3b8';
			if (hsl.startsWith('#')) return hsl;
			if (hsl.startsWith('hsl')) return hsl;
			return '#94a3b8';
		};

		// ---------------------------------------------------------
		// 4. GENERADOR DE CÓDIGO
		// ---------------------------------------------------------
		const generateAutoCode = (index) => {
			const subjectName = this.currentSubject.name || this.currentSubject.subjectTitle || "ASIG";
			const cleanName = subjectName.replace(/^[\d\.\s]+/, '').trim();
			
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
			
			if (!numSuffix) {
				const arabicMatch = cleanName.match(/(\d+)$/);
				if (arabicMatch) {
					numSuffix = arabicMatch[1];
					baseName = cleanName.substring(0, cleanName.length - arabicMatch[0].length).trim();
				}
			}
			
			const letters = baseName.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
			const seq = String(index + 1).padStart(2, '0');
			
			return `AE_${numSuffix || ''}${letters}_${seq}`;
		};

		// ---------------------------------------------------------
		// 5. RENDERIZAR EDITOR
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
									Eremuak lehenik definitu behar dira graduan (sidebar edo graduaren datuetan).
								</p>
							</div>
						</div>
					</div>
					` : `
					<div class="text-[10px] text-gray-500 mb-2 flex items-center">
						<i class="fas fa-check-circle text-green-500 mr-1"></i>
						<span class="mr-2">${areaCount} eremu aurkituak</span>
						<select id="quickAreaSelect" class="text-xs border border-gray-300 rounded px-2 py-1 ml-auto">
							<option value="">Hautatu eremua...</option>
							${sortedAreaNames.map(area => `
								<option value="${area}">${area}</option>
							`).join('')}
						</select>
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
				<datalist id="preReqAreasList">
					${sortedAreaNames.map(area => `
						<option value="${area}">${area}</option>
					`).join('')}
				</datalist>
			`;

			const body = document.getElementById('preReqTableBody');

			// Azkar aukeratzeko dropdown-a
			const quickSelect = document.getElementById('quickAreaSelect');
			if (quickSelect) {
				quickSelect.addEventListener('change', function() {
					if (this.value) {
						const activeInput = document.activeElement;
						if (activeInput && activeInput.classList.contains('field-area')) {
							activeInput.value = this.value;
							const event = new Event('input', { bubbles: true });
							activeInput.dispatchEvent(event);
						}
						this.value = '';
					}
				});
			}

			localList.forEach((item, index) => {
				// Kode automatikoa sortu
				const autoCode = generateAutoCode(index);
				item.code = autoCode;
				localList[index] = item;
				
				// Kolorea zehaztu
				let displayColor = '#e2e8f0';
				let areaName = item.area || '';
				
				if (areaName && areaColorMap[areaName]) {
					displayColor = parseColor(areaColorMap[areaName]);
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
							   value="${areaName}" 
							   placeholder="Idatzi eremuaren izena..."
							   autocomplete="off"
							   data-index="${index}"
							   id="areaInput_${index}">
						
						<div class="absolute right-0 top-2.5 w-4 h-4 rounded-full area-color-preview border border-gray-300"
							 style="background-color: ${displayColor}"
							 title="${areaName || 'Ez dago eremurik'}"></div>
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
					
					// Kolorea eguneratu
					let matchedColor = '#94a3b8';
					if (newArea && areaColorMap[newArea]) {
						matchedColor = parseColor(areaColorMap[newArea]);
					}
					
					colorPreview.style.backgroundColor = matchedColor;
					colorPreview.title = newArea || 'Ez dago eremurik';
					
					// Datuak eguneratu
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
				
				// Autocomplete
				areaInput.addEventListener('input', function(e) {
					const value = this.value.toLowerCase();
					const hasMatch = sortedAreaNames.some(area => 
						area.toLowerCase().includes(value)
					);
					
					if (value && hasMatch) {
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

			// Fila hutsa gehitu behar bada
			if (localList.length === 0) {
				localList.push({ code: '', name: '', area: '', color: '#94a3b8' });
				renderTable();
				return;
			}
		};

		// Gehitu botoia
		container.addEventListener('click', (e) => {
			if (e.target.id === 'btnAddPreReq' || e.target.closest('#btnAddPreReq')) {
				localList.push({ code: '', name: '', area: '', color: '#94a3b8' });
				renderTable();
				
				setTimeout(() => {
					const lastRow = document.querySelector('#preReqTableBody .field-name:last-child');
					if (lastRow) lastRow.focus();
				}, 50);
			}
		});

		// Renderizar
		renderTable();

		// ---------------------------------------------------------
		// 6. CONFIGURAR BOTÓN GUARDAR
		// ---------------------------------------------------------
		const saveBtn = this._setupSaveButtonRaw(modal);
		saveBtn.onclick = async () => {
			saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
			saveBtn.disabled = true;
			
			try {
				// Filtroak
				const filteredList = localList.filter(item => item.name && item.name.trim());
				
				if (filteredList.length === 0) {
					alert("Gutxienez aurre-ezagutza bat definitu behar duzu.");
					saveBtn.innerHTML = 'Gorde Aldaketak';
					saveBtn.disabled = false;
					return;
				}
				
				// ✨ ALDAKETA: Datuak erroan gorde soilik
				this.currentSubject.preReq = filteredList;
				
				// ✨ OHARRA: context ez da behar, baina mantentzeko kodea
				if (!this.currentSubject.context) {
					this.currentSubject.context = {};
				}
				// Hemen soilik context-ean ere gorde nahi baduzu:
				// this.currentSubject.context.preReq = filteredList;
				
				// Datuak gorde
				await this.saveData();
				modal.classList.add('hidden');
				
				// Vista eguneratu
				if (window.ui && window.ui.renderSubjectDetail) {
					window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
				}
				
				// Berri ona
				if (this.showNotification) {
					this.showNotification('Aurre-ezagutzak gorde dira!', 'success');
				} else {
					alert('✅ Aurre-ezagutzak gorde dira!');
				}
				
			} catch (error) {
				console.error('Errorea gordetzean:', error);
				alert("Errorea gordetzerakoan: " + error.message);
			} finally {
				saveBtn.innerHTML = 'Gorde Aldaketak';
				saveBtn.disabled = false;
			}
		};

		// Modal erakutsi
		modal.classList.remove('hidden');
	}
		
	openSignActEditor() {
		if (!this.currentSubject) return;

		// 1. Preparar Modal
		const modal = document.getElementById('listEditorModal');
		const container = document.getElementById('listEditorContainer');
		const titleEl = document.getElementById('listEditorTitle');
		const inputTop = document.getElementById('newItemInput')?.parentElement;
		
		// Ocultar la parte superior antigua y poner título
		if (inputTop) inputTop.classList.add('hidden');
		if (titleEl) titleEl.innerHTML = `<i class="fas fa-star mr-2 text-indigo-500"></i> Jarduera Esanguratsuak`;

		// 2. Inicializar datos locales (signAct) - ✨ ALDAKETA: erroan zuzenean
		// Lehenik erroan bilatu
		if (!Array.isArray(this.currentSubject.signAct)) {
			// Fallback: context-ean badaude, erro-ra kopiatu
			if (this.currentSubject.context && Array.isArray(this.currentSubject.context.signAct)) {
				this.currentSubject.signAct = [...this.currentSubject.context.signAct];
			} else {
				this.currentSubject.signAct = []; // Erroan hasieratu
			}
		}
		const localList = this.currentSubject.signAct; // ✨ context erabili gabe

		// 3. PREPARAR LA INTELIGENCIA (Datos Globales)
		const globalProjects = this.adminCatalogs.externalProjects || [];
		
		// Mapa rápido: Tipo -> Color
		const typeColorMap = {};
		const agentsSet = new Set();
		const typesSet = new Set();

		globalProjects.forEach(p => {
			if (p.type) {
				typesSet.add(p.type);
				if (p.color && p.color !== '#94a3b8') {
					typeColorMap[p.type] = p.color;
				}
			}
			if (p.agent) agentsSet.add(p.agent);
		});

		const uniqueTypes = [...typesSet].sort();
		const uniqueAgents = [...agentsSet].sort();

		// Función auxiliar para obtener color
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
				// Normalizar datos si eran strings
				if (typeof item === 'string') {
					item = { name: item, agent: '', type: '', color: '#94a3b8' };
					localList[index] = item;
				}

				// Si el item no tiene color propio, intentamos deducirlo del tipo
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

				// LOGICA DE ACTUALIZACIÓN Y COLORES
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
				typeInput.addEventListener('input', (e) => {
					const val = e.target.value;
					const autoColor = getColorForType(val);
					
					if (autoColor) {
						colorInput.value = autoColor;
						colorPreview.style.backgroundColor = autoColor;
						updateModel();
					} else {
						localList[index].type = val;
					}
				});

				// Evento para el color manual
				colorInput.addEventListener('input', (e) => {
					const val = e.target.value;
					colorPreview.style.backgroundColor = val;
					updateModel();
				});

				// Resto de eventos
				[agentInput, nameInput].forEach(inp => inp.addEventListener('input', updateModel));
				
				// Eliminar
				row.querySelector('.btn-delete').addEventListener('click', () => {
					if(confirm("Ziur zaude jarduera hau ezabatu nahi duzula?")) {
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

		// Inicializar modal
		document.getElementById('listEditorModal').classList.remove('hidden');
		
		// Primera renderización
		renderTable();
		
		// Botón añadir (delegación de eventos)
		container.addEventListener('click', (e) => {
			if(e.target.id === 'btnAddSignAct' || e.target.closest('#btnAddSignAct')) {
				localList.push({ name: '', agent: '', type: '', color: '#94a3b8' });
				renderTable();
			}
		});

		// 6. Botón Guardar
		const saveBtn = this._setupSaveButtonRaw(modal);
		saveBtn.onclick = async () => {
			saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
			saveBtn.disabled = true;
			
			try {
				// ✨ ALDAKETA: guardar en erro
				// Filtroak: bakarrik izena dutenak
				const filteredList = localList.filter(item => item.name && item.name.trim());
				this.currentSubject.signAct = filteredList;
				
				// ✨ BATERAGARRIKOTASUNA: context-ean ere gorde (beharrezkoa bada)
				if (!this.currentSubject.context) {
					this.currentSubject.context = {};
				}
				// Kontsultatu ea context-ean mantendu nahi duzun:
				// this.currentSubject.context.signAct = filteredList;
				
				await this.saveData();
				modal.classList.add('hidden');
				
				// Actualizar vista
				if (window.ui && this.currentSubject) {
					window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
				}
				
				// Mostrar notificación
				if (this.showNotification) {
					this.showNotification('Jarduera esanguratsuak gorde dira!', 'success');
				} else {
					alert('✅ Jarduera esanguratsuak gorde dira!');
				}
				
			} catch (e) {
				console.error(e);
				alert("Errorea gordetzerakoan: " + e.message);
			} finally {
				saveBtn.innerHTML = 'Gorde Aldaketak';
				saveBtn.disabled = false;
			}
		};
	}

/*async saveListEditor() {
    if (!this.currentEditingField) return;
    
    const fieldName = this.currentEditingField;
    const isDegree = this.isEditingDegree;
    const modal = document.getElementById('listEditorModal');
    const saveBtn = modal?.querySelector('#saveListBtn');

    // Deshabilitar botón durante guardado
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
        saveBtn.disabled = true;
    }

    console.log(`💾 Guardando lista "${fieldName}" en ${isDegree ? 'GRADUA' : 'IRAKASGAIA'}`);
    
    try {
        const inputs = document.querySelectorAll('.list-item-input');
        const newList = Array.from(inputs)
            .map(i => i.value.trim())
            .filter(v => v !== "");
        
        // 1. VALIDACIÓN BÁSICA
        if (newList.length === 0) {
            throw new Error('Gutxienez elementu bat gehitu behar duzu.');
        }

        // 2. ACTUALIZAR EL OBJETO EN MEMORIA
        if (isDegree) {
            // Guardar en el objeto Grado
            this.currentDegree[fieldName] = newList;
            
            // Refrescar Sidebar
            if (window.ui?.renderSidebar) {
                window.ui.renderSidebar(this.currentDegree);
            }
        } else {
            // Guardar en el objeto Asignatura
            if (!this.currentSubject) {
                throw new Error('Ez dago aukeratutako irakasgairik');
            }
            
            // ✨ ALDAKETA PRINCIPAL: erroan gorde
            this.currentSubject[fieldName] = newList;
            
            // ✨ BATERAGARRIKOTASUNA: context-ean ere (aukerakoa)
            // Mantener context si otros módulos lo necesitan
            if (fieldName === 'idu' || fieldName === 'ods' || fieldName === 'external_projects') {
                if (!this.currentSubject.context) {
                    this.currentSubject.context = {};
                }
                this.currentSubject.context[fieldName] = newList;
            }

            // Refrescar Detalle Asignatura
            if (window.ui?.renderSubjectDetail) {
                window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
            }
        }
        
        // 3. GUARDAR EN BD
        await this.saveData();
        
        console.log("✅ Datos guardados correctamente");
        
        // 4. NOTIFICACIÓN
        if (this.showNotification) {
            const fieldNames = {
                'idu': 'IDU Zerrenda',
                'ods': 'ODS Zerrenda', 
                'external_projects': 'Proiektu Kanpoak',
                'partners': 'Lankideak',
                'skills': 'Gaitasunak'
            };
            
            const displayName = fieldNames[fieldName] || fieldName;
            this.showNotification(`${displayName} gorde da!`, 'success');
        }
        
        // 5. CERRAR MODAL
        if (modal) {
            modal.classList.add('hidden');
            
            // Opcional: limpiar estado
            this.currentEditingField = null;
            this.isEditingDegree = false;
        }
        
    } catch (error) {
        console.error("❌ Error al guardar:", error);
        
        // Mostrar error al usuario
        if (this.showNotification) {
            this.showNotification(`Errorea: ${error.message}`, 'error');
        } else {
            alert(`❌ Errorea: ${error.message}`);
        }
        
        // No cerrar el modal en caso de error
        return;
        
    } finally {
        // Restaurar botón
        if (saveBtn) {
            saveBtn.innerHTML = 'Gorde Aldaketak';
            saveBtn.disabled = false;
        }
    }
}*/

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

// ==========================================
    // 1. AREAK EZABATU (JSON update en SQL)
    // ==========================================
    async deleteSubjectArea() {
        if (!this.currentDegree || !this.editingAreaOldName) return;

        // --- BABESA: Zeharkakoa ezin da ezabatu ---
        if (this.editingAreaOldName === "ZEHARKAKO KONPETENTZIAK") {
            alert("Eremu hau derrigorrezkoa da sisteman eta ezin da ezabatu.");
            return;
        }

        const confirmMessage = `Ziur zaude '${this.editingAreaOldName}' eremua ezabatu nahi duzula? \n\nKontuz: Eremu hau erabiltzen duten irakasgaiak 'Eremu gabe' geratuko dira.`;
        
        if (confirm(confirmMessage)) {
            try {
                // 1. Memorian ezabatu
                this.currentDegree.subjectAreas = this.currentDegree.subjectAreas.filter(a => a.name !== this.editingAreaOldName);
                
                // 2. SQL-n eguneratu (Gradua taula)
                const { error } = await this.supabase
                    .from('graduak')
                    .update({ subjectAreas: this.currentDegree.subjectAreas })
                    .eq('idDegree', this.currentDegree.idDegree);

                if (error) throw error;

                console.log("✅ Area ezabatuta eta gorde da.");

                // 3. UI Eguneratu
                document.getElementById('areaModal').style.display = 'none';
                
                if (window.ui) {
                    window.ui.renderSidebar(this.currentDegree);
                    // Bista freskatu kolore zaharrak desagertu daitezen
                    if (this.currentYear) this.selectYear(this.currentYear);
                }

            } catch (err) {
                console.error("❌ Errorea area ezabatzean:", err);
                alert("Errorea gertatu da area ezabatzean.");
            }
        }
    }

    // ==========================================
    // 2. IRAKASGAIAK EZABATU (SQL DELETE)
    // ==========================================
    // ⚠️ ADI: Orain 'idAsig' jasotzen du, ez 'index'
    async deleteSubject(idAsig) {
        if (!this.currentDegree) return;

        // Bilatu irakasgaia memorian izena erakusteko
        const subject = (this.currentDegree.subjects || []).find(s => s.idAsig === idAsig);
        const subjName = subject ? (subject.subjectTitle || subject.name) : "Irakasgaia";

        if (confirm(`Ziur zaude '${subjName}' ezabatu nahi duzula?\n\nEkintza hau ezin da desegin.`)) {
            try {
                // 1. SQL DELETE (Datu-basetik ezabatu)
                const { error } = await this.supabase
                    .from('irakasgaiak')
                    .delete()
                    .eq('idAsig', idAsig);

                if (error) throw error;

                // 2. MEMORIA EGUNERATU (Array-tik kendu)
                if (this.currentDegree.subjects) {
                    this.currentDegree.subjects = this.currentDegree.subjects.filter(s => s.idAsig !== idAsig);
                }

                console.log(`🗑️ Irakasgaia ezabatuta: ${idAsig}`);

                // 3. UI EGUNERATU
                // Oraindik urte horretan bagaude, bista freskatu
                if (this.currentYear) {
                    this.selectYear(this.currentYear);
                }
                
                // Xehetasun bista irekita bazegoen eta irakasgai bera bada, itxi
                const detailView = document.getElementById('subjectDetailView');
                if (detailView && !detailView.classList.contains('hidden')) {
                    if (this.currentSubject && this.currentSubject.idAsig === idAsig) {
                        detailView.classList.add('hidden');
                        document.getElementById('yearView').classList.remove('hidden');
                        this.currentSubject = null;
                    }
                }

            } catch (err) {
                console.error("❌ Errorea irakasgaia ezabatzean:", err);
                alert("Errorea: Ezin izan da irakasgaia ezabatu.");
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

	async updateSubjectsAreaName(oldName, newName) {
        if (!this.currentDegree) return;

        console.log(`🔄 Area izena eguneratzen: '${oldName}' -> '${newName}'`);

        try {
            // 1. SQL EGUNERATU (Datu-basea)
            // Agindu bakar batekin irakasgai guztiak eguneratzen ditugu
            const { error } = await this.supabase
                .from('irakasgaiak')
                .update({ subjectArea: newName })
                .eq('idDegree', this.currentDegree.idDegree) // Gradu honetakoak bakarrik
                .eq('subjectArea', oldName);                 // Izen zaharra dutenak

            if (error) throw error;

            // 2. MEMORIA EGUNERATU (Berehala ikusteko)
            // Orain 'subjects' array laua denez, askoz errazagoa da
            if (this.currentDegree.subjects) {
                this.currentDegree.subjects.forEach(subj => {
                    if (subj.subjectArea === oldName) {
                        subj.subjectArea = newName;
                    }
                });
            }
            
            console.log("✅ Area izenak eguneratuta DBan eta Memorian.");

        } catch (err) {
            console.error("❌ Errorea area izenak eguneratzean:", err);
        }
    }
    
// ==========================================
    // KONPETENTZIAK KUDEATU (SARRERA / IRTEERA)
    // ==========================================

    async editCompetencies(type) {
        if (!this.currentDegree) return;

        const label = type === 'sarrera' ? 'Sarrera Profila' : 'Irteera Profila';
        
        // 1. Eskatu testua (Prompt bidez azkar egiteko)
        const text = prompt(`Gehitu konpetentzia berria (${label}):`);
        
        if (text && text.trim().length > 0) {
            try {
                // Egitura ziurtatu (null bada sortu)
                if (!this.currentDegree.konpetentziak) {
                    this.currentDegree.konpetentziak = { sarrera: [], irteera: [] };
                }
                if (!this.currentDegree.konpetentziak[type]) {
                    this.currentDegree.konpetentziak[type] = [];
                }

                // 2. Memoria eguneratu (Gehitu)
                this.currentDegree.konpetentziak[type].push(text.trim());

                // 3. SQL Eguneratu (Objektu osoa bidali behar da JSON zutabea delako)
                const { error } = await this.supabase
                    .from('graduak')
                    .update({ konpetentziak: this.currentDegree.konpetentziak })
                    .eq('idDegree', this.currentDegree.idDegree);

                if (error) throw error;

                console.log(`✅ Konpetentzia gehituta: ${type}`);

                // 4. UI Eguneratu
                if (window.ui && window.ui.renderSidebar) {
                    window.ui.renderSidebar(this.currentDegree);
                }

            } catch (err) {
                console.error("❌ Errorea konpetentziak gordetzean:", err);
                alert("Errorea datu-basean gordetzean.");
            }
        }
    }

    // Gehigarria: Zerrendatik elementu bat ezabatzeko
    async deleteCompetency(type, index) {
        if (!this.currentDegree || !this.currentDegree.konpetentziak) return;

        if (confirm("Ziur konpetentzia hau zerrendatik kendu nahi duzula?")) {
            try {
                // 1. Memoria eguneratu (Ezabatu)
                this.currentDegree.konpetentziak[type].splice(index, 1);

                // 2. SQL Eguneratu
                const { error } = await this.supabase
                    .from('graduak')
                    .update({ konpetentziak: this.currentDegree.konpetentziak })
                    .eq('idDegree', this.currentDegree.idDegree);

                if (error) throw error;

                // 3. UI Eguneratu
                if (window.ui && window.ui.renderSidebar) {
                    window.ui.renderSidebar(this.currentDegree);
                }
            } catch (err) {
                console.error(err);
                alert("Errorea ezabatzean.");
            }
        }
    }
// ==========================================
    // BAIMENAK
    // ==========================================
// Funtzio laguntzailea irakasgai baten datua eguneratzeko
/**
     * Eremu bakar bat eguneratu eta gorde.
     * Hau da 'saveFieldChange' zaharraren ordezkoa.
     */
    async updateField(key, value) {
        if (!this.currentSubject) return;

        console.log(`🔄 Eremua eguneratzen: ${key} ->`, value);

        // 1. MEMORIA EGUNERATU
        // Objektua memorian aldatzen dugu. Berdin dio "root" den edo JSON barrukoa,
        // gure objektua laua da memorian (loadSubject-en batu dugulako).
        this.currentSubject[key] = value;

        // 2. GORDE (SQL logic)
        // 'saveData'-k badaki nola banatu (Zutabea vs Content)
        await this.saveData(); 
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































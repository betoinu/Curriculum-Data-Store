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
            'zhRAs',
			'calendarConfig',
			'subjectCritEval',      // Array
            'idujar',               // Array (IDU)
            'preReq',               // Array
            'extProy',              // Array
            'signAct',              // Array
            'detailODS',            // Array
			'raCode',     // ✅ Gehitu hau!
    		'raDesc',     // ✅ Gehitu hau!
			'zhCode',     // ✅ Gehitu hau!
    		'zhDesc',     // ✅ Gehitu hau!
			'linkedCompetency'     // ✅ Gehitu hau!
			
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
// ✅ Funtzio honek dena egiten du (ez da loadData edo loadCatalogs behar)
	async initialize(user) {
        console.log("🚀 Sistema abiarazten (SQL Modua)...");
        this.currentUser = user;

        try {
            // 1. Supabase lortu
            const { getSupabaseInstance } = await import('./config.js');
            this.supabase = getSupabaseInstance();
            if (!this.supabase) throw new Error("Supabase ez da aurkitu.");

            // 2. DATU GUZTIAK PARALELOAN KARGATU
            const [graduakRes, odsRes, iduRes, projRes] = await Promise.all([
                this.supabase.from('graduak').select('*').order('selectedDegree', { ascending: true }),
                this.supabase.from('catalog_ods').select('*').order('name', { ascending: true }),
                this.supabase.from('catalog_idu').select('*').order('name', { ascending: true }),
                this.supabase.from('admin_external_projects').select('*').order('name', { ascending: true })
            ]);

            // 3. ERROREAK EGIAZTATU
            if (graduakRes.error) throw new Error("Graduak errorea: " + graduakRes.error.message);
            // Beste erroreak kudeatu...

            // 4. MEMORIAN GORDE
            this.degrees = graduakRes.data || [];
            this.adminCatalogs = {
                odsList: odsRes.data || [],
                iduGuidelines: iduRes.data || [],
                externalProjects: projRes.data || []
            };

            console.log(`✅ Kargatuta: ${this.degrees.length} gradu eta katalogoak.`);

            // 5. UI EGUNERATU (HEMEN EGIN DUT ALDAKETA)
            // ------------------------------------------------
            // Lehen 'window.ui.renderDegreeSelector' zegoen (ez da existitzen).
            // Orain zure funtzio propioa deitzen dugu:
            this.populateDegreeSelect(); 
            
            // Area modala injektatu
            if (this.injectAreaModal) this.injectAreaModal();

            return true;

        } catch (error) {
            console.error("❌ Errorea initialize-n:", error);
            alert("Errorea abiaraztean: " + error.message);
            return false;
        }
    }
	
    // --- MODIFICACI¨®N 2: Nueva funci¨®n para cargar cat¨¢logos ---
	async loadCatalogs() {
        console.log("📚 Katalogoak kargatzen...");
        
        // Hiru kontsulta independente jaurti batera
        const [iduRes, odsRes, extProjectsRes] = await Promise.all([
            this.supabase.from('catalog_idu').select('*').order('code', { ascending: true }),
            this.supabase.from('catalog_ods').select('*').order('code', { ascending: true }),
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
    console.log("💾 SQLan Gordetzen (SCHEMA MATCHING):", subjectData.subjectTitle);
    
    const saveBtn = document.getElementById('saveSubjectBtn');
    if (saveBtn) saveBtn.disabled = true;

    try {
        const dbPayload = {};
        const contentPayload = {};

        // 1. ZURE TAULAKO ZUTABE OFIZIALAK (Eskemaren arabera)
        // Hauek erroan joan behar dute derrigorrez SQLan ondo gordetzeko.
        const dbFields = [
            'id', 
            'idAsig',        // text not null
            'subjectTitle',  // text not null
            'coordinator_id',// uuid
            'created_at', 
            'updated_at',
            'subjectCode',   // text
            'subjectCredits',// numeric
            'language',      // text
            'semester',      // text
            'subjectType',   // text
            'idDegree',      // text
            'year',          // integer
            'subjectArea'    // text
        ];

        // 2. "BLACKLIST": Inoiz gorde behar ez direnak
		const ignoredKeys = [
		    'content',       // Matrioska ekiditeko
		    'uiState',       // UI egoerak
		    'expandedUnits', // Planning
		    'matrizPanel',   // 🚨 KRITIKOA: Hau DOM elementua da, ezin da gorde!
		    'tempData',      
		    '__dirty'
		];

        // 3. DATUAK SAILKATU (BANAKETA)
        Object.keys(subjectData).forEach(key => {
            // A) SQL Zutabea da -> dbPayload (Erroa)
            if (dbFields.includes(key)) {
                dbPayload[key] = subjectData[key];
            }
            // B) Ez bada SQL eta Ez bada Zaborra -> Content-era (JSON)
            else if (!ignoredKeys.includes(key)) {
                contentPayload[key] = subjectData[key];
            }
        });

        // 4. MAPAKETA BEREZIAK (JS -> SQL)
        // Zure memorian 'code' erabiltzen duzu, baina DBan 'idAsig' da gako nagusia
        if (!dbPayload.idAsig && subjectData.code) {
            dbPayload.idAsig = subjectData.code;
        }
        // Agian 'credits' duzu memorian, baina DBan 'subjectCredits' da
        if (!dbPayload.subjectCredits && subjectData.credits) {
            dbPayload.subjectCredits = subjectData.credits;
        }
        // Gradua
        if (!dbPayload.idDegree && this.currentDegree) {
            dbPayload.idDegree = this.currentDegree.idDegree;
        }
		
		// 👇 GARBIKETA ZEHATZA ETA SEGURUA (GEHITU HAU HEMEN) 👇
        // JSON-ean (contentPayload) sartu diren 'name' edo 'code' horiek
        // benetan datu-baseko SQL zutabeetako bikoizketak badira, ezabatu egingo ditugu.
        // Horrela, beste ezertarako erabiltzen diren 'name' edo 'code'-ak ez dira ukituko.
        
        if (contentPayload.code && contentPayload.code === dbPayload.subjectCode) {
            delete contentPayload.code;
        }
        
        // Zure datu basean dbPayload.subjectTitle da izen ofiziala (Schema Matching)
        if (contentPayload.name && contentPayload.name === dbPayload.subjectTitle) {
            delete contentPayload.name;
        }

        // 5. UNITATEAK GARBITU (Segurtasun geruza)
		if (contentPayload.unitateak) {
		    const rawUnits = Array.isArray(contentPayload.unitateak) ? contentPayload.unitateak : [];
		    contentPayload.unitateak = rawUnits.map(u => ({
		        // Estandarizazioa (Zaharrak -> Berriak)
		        unitCode: u.unitCode || u.code || "", 
		        unitName: u.unitName || u.name || "",
		        irauOrd: u.irauOrd || (u.hours ? String(u.hours) : "0"), // Zenbakia -> String
		        
		        // Mantendu behar direnak
		        activities: u.activities || [],
		        descriptores: u.descriptores || []
		
		        // HEMEN FILTRATZEN DIRA:
		        // - Drag&Drop IDak
		        // - 'selected' egoerak
		        // - 'matrizPanel' bezalako erreferentzia arraroak unitate barruan baleude
		    }));
		}

        // 6. JSONa MUNTATU
        dbPayload.content = contentPayload;

        console.log("📤 PAYLOAD:", { 
            ID: dbPayload.idAsig,
            SQL_ZUTABEAK: Object.keys(dbPayload).filter(k => k !== 'content'),
            JSON_EDUKIA: Object.keys(dbPayload.content)
        });

        // 7. SUPABASE DEIA
        // 'idAsig' da zure unique constraint (irakasgaiak_code_key)
        const { data, error } = await this.supabase
            .from('irakasgaiak')
            .upsert(dbPayload, { onConflict: 'idAsig' }) 
            .select()
            .single();

        if (error) throw error;

        console.log("✅ DBan eguneratua. ID:", data.id);

        // 8. MEMORIA EGUNERATU (DESPAKETATU / UNFLATTEN)
        // Datu baseko zutabeak + JSONeko edukiak maila berean jartzen ditugu
        this.currentSubject = {
            ...data,           // SQL datuak (year, credits...)
            ...data.content,   // JSON barrukoa (unitateak, zhRAs...) kanpora!
            content: undefined // Poltsa ezabatu
        };

        // UI Eguneratu
        if (this.currentDegree && this.currentDegree.subjects) {
            const index = this.currentDegree.subjects.findIndex(s => s.idAsig === this.currentSubject.idAsig);
            if (index >= 0) this.currentDegree.subjects[index] = this.currentSubject;
        }

        if (window.ui?.renderSubjectDetail) {
            window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
        }

        this.showToast('✅ Datuak ondo gorde dira!');
        return true;

    } catch (err) {
        console.error("❌ Errorea SQL gordetzean:", err);
        alert("Errorea: " + err.message);
        return false;
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}
    async saveData(subjectData = null) {
        console.log("💾 saveData (legacy) -> saveSubject deitzen");
        
        const subjectToSave = subjectData || this.currentSubject;
        
        if (!subjectToSave) {
            console.error("❌ Ez dago irakasgairik gordetzeko.");
            return false;
        }
        
        try {
            // Deitu saveSubject funtzio berriari
            const result = await this.saveSubject(subjectToSave);
            return result;
        } catch (error) {
            console.error("❌ Errorea saveData-n:", error);
            return false;
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
			semester: 'Urtekoa',
			language: 'Elebiduna',
            idDegree: this.currentDegree.idDegree, // Lotura

            // JSON eremuak hutsik
            unitateak: [],
			preReq: [],
            idujar: [],
			detailODS: [],
            extProy: [],
			signAct: [],
			zhRAs: [],
            currentOfficialRAs: [],
			subjectCritEval: [],
			matrizAlineacion: [],
			matrizAsignatura: [],
			ganttPlanifikazioa: []
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
        if (!this.currentSubject) {
            console.error("❌ Ez dago irakasgairik aukeratuta editatzeko.");
            return;
        }
        const subj = this.currentSubject;
        console.log("✏️ Irakasgaia editatzen:", subj.subjectTitle);

        // 1. ELEMENTUAK HAUTATU (DOM)
        const codeInput = document.getElementById('subject_edit_code'); 
        const nameInput = document.getElementById('subject_edit_name');
        const creditsInput = document.getElementById('subject_edit_credits'); // 🆕
        const langSelect = document.getElementById('subject_edit_language'); // 🆕
        const semesterSelect = document.getElementById('subject_edit_semester'); // 🆕
        const areaSelect = document.getElementById('subject_edit_area');
        const typeSelect = document.getElementById('subject_edit_type');
        
        // 2. BALIOAK BETE
        // Testu sinpleak
        if (codeInput) codeInput.value = subj.idAsig || subj.subjectCode || '';
        if (nameInput) nameInput.value = subj.subjectTitle || subj.name || '';
        
        // Kredituak (Zenbakia dela ziurtatu)
        if (creditsInput) {
            creditsInput.value = subj.subjectCredits || subj.credits || 0;
        }

        // 3. HIZKUNTZA (Language)
        if (langSelect) {
            // Balio posibleak: 'eu' (Euskara), 'es' (Gaztelania), 'en' (Ingelesa)
            // Zure datu-basean nola gordetzen den arabera egokitu (Adib: "Euskara" edo "eu")
            langSelect.value = subj.language || 'eu'; 
        }

        // 4. SEIHILEKOA (Semester)
        if (semesterSelect) {
            // Balioak: '1', '2', 'urtekoa'
            semesterSelect.value = subj.semester || '1';
        }

        // 5. MOTAK (Types)
        if (typeSelect) {
            typeSelect.innerHTML = '';
            // Kargatu motak (zure funtzioa erabiliz)
            const dbTypes = this.loadUniqueSubjectTypes ? this.loadUniqueSubjectTypes() : ['Derrigorrezkoa', 'Oinarrizkoa', 'Hautazkoa'];
            
            const defaultOpt = document.createElement('option');
            defaultOpt.value = "";
            defaultOpt.textContent = "-- Hautatu --";
            typeSelect.appendChild(defaultOpt);

            dbTypes.forEach(tipo => {
                const opt = document.createElement('option');
                opt.value = tipo;
                opt.textContent = tipo;
                if (tipo === (subj.subjectType || subj.tipo)) opt.selected = true;
                typeSelect.appendChild(opt);
            });
        }

        // 6. AREAK (Areas)
        if (areaSelect && this.currentDegree) {
            areaSelect.innerHTML = '<option value="">-- Hautatu --</option>';
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

        // 7. KATALOGOAK (Checklist-ak)
        // UI funtzioak erabiltzen badituzu, ziurtatu 'ui' kargatuta dagoela
        if (window.ui && window.ui.renderChecklistSelector) {
            
            // A. IDU
            window.ui.renderChecklistSelector(
                'editIduContainer', 
                this.adminCatalogs.iduGuidelines || [], 
                subj.idujar || [], // Edo subj.content?.idujar
                'idu_chk'
            );

            // B. ODS (SQL Listatik)
            window.ui.renderChecklistSelector(
                'editOdsContainer',
                this.adminCatalogs.odsList || [], 
                subj.detailODS || subj.ods || [], // detailODS lehenetsi
                'ods_chk'
            );

            // C. KANPO PROIEKTUAK
            window.ui.renderChecklistSelector(
                'editExtProyContainer',
                this.adminCatalogs.externalProjects || [], 
                subj.extProy || [], 
                'ext_chk'
            );
        }

        // 8. MODALA ERAKUTSI
        const modal = document.getElementById('editSubjectModal');
        if (modal) {
            modal.classList.remove('hidden');
        } else {
            console.error("❌ 'editSubjectModal' ez da aurkitu HTMLan!");
        }
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
        // KONTUZ: Ziurtatu HTMLan IDa 'degreeSelector' edo 'degreeSelect' den.
        // Zure azken kodean 'degreeSelect' jarri duzu, baina HTMLan 'degreeSelector' bada, aldatu hemen.
        const select = document.getElementById('degreeSelector') || document.getElementById('degreeSelect');
        
        if (!select) {
            console.warn("⚠️ Ez da selektorea aurkitu HTMLan.");
            return;
        }

        if (!this.degrees) return;
        
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
            // IDak ondo kudeatu
            op.value = g.idDegree || g.id; 
            op.textContent = g.selectedDegree || g.name || "Izenik gabea";
            
            if (this.currentDegree && (this.currentDegree.idDegree === g.idDegree || this.currentDegree.id === g.id)) {
                op.selected = true;
            }
            select.appendChild(op);
        });

        // Event Listener garrantzitsua
        select.onchange = (e) => this.selectDegree(e);
        
        console.log("✅ Selektorea beteta.");
    }

	async selectDegree(e) {
    const val = (e.target && e.target.value) ? e.target.value : e;
    
    if (val === "NEW_DEGREE") {
        console.log("Gradu berria sortzen...");
        return;
    }

    console.log(`⏳ Gradua kargatzen: ${val}...`);
    
    // Bilatu gradua array nagusian
    this.currentDegree = this.degrees.find(d => d.idDegree === val || d.id === val);
    
    if (!this.currentDegree) {
        console.error("Gradua ez da aurkitu.");
        return;
    }

    try {
        // 1. SUPABASE DEIA (Datuak ekarri)
        const { data: subjects, error } = await this.supabase
            .from('irakasgaiak')
            .select('*')
            .eq('idDegree', this.currentDegree.idDegree || this.currentDegree.id)
            .order('year', { ascending: true })
            .order('subjectTitle', { ascending: true });

        if (error) throw error;

        // 2. DESPAKETATZEA (Hau ondo zenuen)
        // Content barrukoak errora atera
        this.currentDegree.subjects = subjects.map(s => ({
            ...s,
            ...(s.content || {}),
            content: undefined // Garbitu, bikoizketak ekiditeko
        }));
        
        this.currentSubjects = this.currentDegree.subjects;

        // =========================================================
        // 🛠️ ALDAKETA NAGUSIA: DATUAK MATRIZEENTZAT PRESTATU
        // =========================================================
        // MatrixEngine-k { 1: [...], 2: [...] } egitura behar du.
        
        const yearStructure = { 1: [], 2: [], 3: [], 4: [] };

        this.currentDegree.subjects.forEach(sub => {
            // Ziurtatu MatrixEngine-k bilatzen dituen eremuak daudela
            if (!sub.name) sub.name = sub.subjectTitle;
            if (!sub.code) sub.code = sub.subjectCode || sub.idAsig;

            // Sartu dagokion urteko saskian
            const y = sub.year || 1;
            if (yearStructure[y]) {
                yearStructure[y].push(sub);
            }
        });

        // HAU ZEN FALTA ZENA:
        this.currentDegree.year = yearStructure; 

        // =========================================================

        console.log("🎨 UI eguneratzen...");

        // 3. UI MARRAZTU
        if (window.ui && window.ui.renderSidebar) {
            window.ui.renderSidebar(this.currentDegree);
        }

        if (window.ui && window.ui.renderYearView) {
            window.ui.renderYearView(this.currentDegree, 1); 
        }

        // Matrizeen botoia aktibatu (beharrezkoa bada)
        console.log("✅ Datuak prest MatrixEngine-rentzat:", this.currentDegree.year);

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
    
    // Configuración visual
    if(inputTop) inputTop.classList.add('hidden');
    if(titleEl) titleEl.innerHTML = `<i class="fas fa-edit mr-2 text-blue-500"></i> Editatu ODS Katalogoa (Master)`;
    
    const ODS_IMAGE_DIR = 'assets/ods/';
    
    // --- HELPERS ---
    const getOdsNumber = (code) => {
        if (!code) return 999; // Zenbakirik gabe, amaierara
        const match = code.toString().match(/\d+/);
        return match ? parseInt(match[0], 10) : 999;
    };
    
    const formatOdsNumber = (num) => String(num).padStart(2, '0');
    
    const getImageUrl = (ods) => {
        const num = getOdsNumber(ods.code);
        // 1-17 artean badaude, irudi ofiziala, bestela pertsonalizatua edo default
        if (num >= 1 && num <= 17) return `${ODS_IMAGE_DIR}${formatOdsNumber(num)}.png`;
        return ods.imageUrl || `${ODS_IMAGE_DIR}default.png`;
    };

    const sortOdsList = () => {
        if (this.adminCatalogs.odsList?.length) {
            this.adminCatalogs.odsList.sort((a, b) => getOdsNumber(a.code) - getOdsNumber(b.code));
        }
    };

    // --- INIT CONTAINER (Behin bakarrik) ---
    // Goiburua eta zerrendaren edukiontzia bereizten ditugu renderra ez apurtzeko
    container.innerHTML = `
        <div class="mb-4">
            <div class="flex justify-between items-center mb-4">
                <div>
                    <h3 class="text-lg font-bold text-gray-800">ODS Katalogoa</h3>
                    <p class="text-sm text-gray-500" id="odsCounter">Kargatzen...</p>
                </div>
                <button id="btnAddOdsMaster" class="text-sm bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 font-bold flex items-center gap-2">
                    <i class="fas fa-plus"></i> ODS Berria
                </button>
            </div>
            
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
                <i class="fas fa-info-circle mr-2"></i>
                ODSak automatikoki ordenatzen dira kodearen arabera. (1-17 Ofizialak).
            </div>

            <div id="odsTableBody" class="space-y-3 pb-8"></div>
        </div>
    `;

    const listBody = document.getElementById('odsTableBody');
    const counterEl = document.getElementById('odsCounter');

    // --- RENDER TABLE ---
    const renderTable = (maintainFocusElementId = null) => {
        sortOdsList();
        
        // Eguneratu kontagailua
        const total = this.adminCatalogs.odsList?.length || 0;
        counterEl.innerHTML = `${total} ODS · Irudiak <code>assets/ods/</code> direktorioan`;

        listBody.innerHTML = ''; // Zerrenda garbitu

        if (total === 0) {
            listBody.innerHTML = `<div class="text-center py-8 text-gray-400">Ez dago ODSik.</div>`;
            return;
        }

        this.adminCatalogs.odsList.forEach((ods, index) => {
            const odsNumber = getOdsNumber(ods.code);
            const formattedNumber = formatOdsNumber(odsNumber);
            const imageUrl = getImageUrl(ods);
            const isOfficial = odsNumber >= 1 && odsNumber <= 17;
            
            // Elementua sortu
            const row = document.createElement('div');
            row.className = "flex flex-col sm:flex-row gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-300 transition-colors group";
            
            row.innerHTML = `
                <div class="flex flex-col items-center gap-3 sm:w-24 flex-shrink-0">
                    <div class="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-white relative">
                        <img src="${imageUrl}" class="w-full h-full object-cover" onerror="this.src='${ODS_IMAGE_DIR}default.png'">
                        <div class="absolute bottom-0 right-0 bg-blue-600 text-white text-[10px] px-1.5 font-bold rounded-tl">
                            ${formattedNumber}
                        </div>
                    </div>
                    <input type="color" class="w-full h-6 p-0 border border-gray-300 rounded cursor-pointer field-color" 
                           value="${ods.color || '#3b82f6'}" title="Kolorea">
                </div>
                
                <div class="flex-1 space-y-3">
                    <div class="flex gap-4">
                        <div class="w-24">
                            <label class="block text-[10px] font-bold text-gray-400 uppercase">Zenbakia</label>
                            <input type="number" min="1" max="99" 
                                   class="w-full text-lg font-bold text-gray-800 border-b-2 border-blue-100 focus:border-blue-500 outline-none field-number" 
                                   value="${odsNumber}" id="ods-num-${index}">
                        </div>
                        <div class="flex-1">
                            <label class="block text-[10px] font-bold text-gray-400 uppercase">Izena</label>
                            <input type="text" class="w-full text-base font-medium text-gray-800 border-b border-gray-200 focus:border-blue-500 outline-none field-name" 
                                   value="${ods.name || ''}" placeholder="ODS Izena" id="ods-name-${index}">
                        </div>
                    </div>

                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 uppercase">Irudi URL (Aukerakoa)</label>
                        <input type="text" class="w-full text-xs text-gray-500 border-b border-gray-200 focus:border-blue-500 outline-none field-image" 
                               value="${ods.imageUrl || ''}" placeholder="Utzi hutsik automatikorako...">
                    </div>

                    <div class="flex justify-between items-end pt-2">
                        <span class="text-[10px] px-2 py-0.5 rounded-full ${isOfficial ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
                            ${isOfficial ? 'Ofiziala' : 'Pertsonalizatua'}
                        </span>
                        <button class="text-gray-400 hover:text-red-500 transition text-sm btn-delete" title="Ezabatu">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;

            // EVENTS
            const updateData = (refreshSort = false) => {
                const newNum = parseInt(row.querySelector('.field-number').value) || 0;
                
                // Datuak eguneratu
                this.adminCatalogs.odsList[index].code = `ODS-${formatOdsNumber(newNum)}`;
                this.adminCatalogs.odsList[index].name = row.querySelector('.field-name').value;
                this.adminCatalogs.odsList[index].color = row.querySelector('.field-color').value;
                this.adminCatalogs.odsList[index].imageUrl = row.querySelector('.field-image').value;

                // Ordena aldatu bada, taula berritu (baina 'change' gertaeran bakarrik)
                if (refreshSort && newNum !== odsNumber) {
                    renderTable();
                }
            };

            // Input Events
            // 1. Zenbakia: 'change' erabiltzen dugu 'input' ordez, idazten den bitartean ez saltatzeko
            row.querySelector('.field-number').addEventListener('change', () => updateData(true));
            
            // 2. Besteak: 'input' erabil dezakegu
            row.querySelector('.field-name').addEventListener('input', () => updateData(false));
            row.querySelector('.field-image').addEventListener('input', () => updateData(false));
            row.querySelector('.field-color').addEventListener('input', () => updateData(false));

            // Delete
            row.querySelector('.btn-delete').addEventListener('click', () => {
                if(confirm("Ezabatu ODS hau?")) {
                    this.adminCatalogs.odsList.splice(index, 1);
                    renderTable();
                }
            });

            listBody.appendChild(row);
            
            // Fokua berreskuratu (Render ondoren galdu bada)
            if (maintainFocusElementId && maintainFocusElementId === `ods-num-${index}`) {
                const input = document.getElementById(maintainFocusElementId);
                if(input) input.focus();
            }
        });
    };

    // --- BUTTON HANDLER (Kanpoan definituta) ---
    document.getElementById('btnAddOdsMaster').onclick = () => {
        if (!this.adminCatalogs.odsList) this.adminCatalogs.odsList = [];
        
        // Hurrengo zenbakia kalkulatu
        const maxNum = this.adminCatalogs.odsList.reduce((max, item) => Math.max(max, getOdsNumber(item.code)), 0);
        
        this.adminCatalogs.odsList.push({
            // IDrik gabe sortzen dugu, Supabasek jarriko du
            code: `ODS-${formatOdsNumber(maxNum + 1)}`,
            name: '',
            color: '#94a3b8'
        });
        
        renderTable();
        // Scroll behera
        setTimeout(() => listBody.lastElementChild?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    // Render Inicial
    renderTable();

    // --- SAVE LOGIC ---
    const saveBtn = this._setupSaveButtonRaw(modal);
    saveBtn.onclick = async () => {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
        try {
            // IDak mantendu behar dira 'upsert' ondo egiteko
            // Supabasek IDaren arabera eguneratuko du, ez Code-aren arabera (seguruagoa)
            const { error } = await this.supabase
                .from('catalog_ods')
                .upsert(this.adminCatalogs.odsList); 

            if (error) throw error;
            
            alert("✅ ODS Katalogoa gordeta!");
            modal.classList.add('hidden');
            this.loadCatalogs(); // Datuak birkargatu ID berriak lortzeko

        } catch (e) {
            console.error(e);
            alert("Errorea: " + e.message);
        } finally {
            saveBtn.innerHTML = 'Gorde Aldaketak';
        }
    };

    modal.classList.remove('hidden');
}
	

// ?? FUNCION 2: SELECTOR DE ASIGNATURA (Para seleccionar cu¨¢les se trabajan)
    // Solo permite marcar/desmarcar (Grid Visual)
openOdsSelector(subject) {
    // LEHENENGO: Egiaztatu subject parametroa
    if (!subject) {
        console.warn("⚠️ openOdsSelector: subject parametroa undefined");
        // Probatu this.currentSubject erabiltzea
        subject = this.currentSubject;
        if (!subject) {
            alert("Irakasgai bat hautatu behar duzu lehenik.");
            return;
        }
    }    
	
	console.log("🟢 ODS hautatzailea...", subject.subjectTitle);

    // 1. Garbitu modalak
    document.querySelectorAll('.catalog-modal-overlay').forEach(m => {
        m.style.opacity = '0';
        setTimeout(() => m.remove(), 100);
    });

    // 2. Helperrak
    const getCleanNumber = (str) => {
        if (!str) return null;
        const match = String(str).match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
    };

    const getImageUrl = (num) => {
        if (!num) return '';
        const n = String(num).padStart(2, '0');
        return `assets/ods/${n}.png`;
    };

// 3. Datuak prestatu
    // Kopia bat egiten dugu [... ] erabiliz jatorrizkoa ez aldatzeko, eta ordenatu egiten dugu
    const masterList = [...(this.adminCatalogs.odsList || [])].sort((a, b) => {
        const numA = getCleanNumber(a.code) || 0;
        const numB = getCleanNumber(b.code) || 0;
        return numA - numB;
    });
    
    // Erabili subject.content.detailODS
    const currentSelection = subject.content?.detailODS || subject.detailODS || [];
    const selectedIds = new Set(currentSelection.map(s => String(s.id)));

    // 4. UI sortu
    const modal = document.createElement('div');
    modal.className = "catalog-modal-overlay fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200";
    
    const content = document.createElement('div');
    content.className = "bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden";
    
    content.innerHTML = `
        <div class="p-5 border-b flex justify-between items-center bg-gray-50">
            <div>
                <h3 class="font-bold text-xl text-gray-800">Garapen Iraunkorrerako Helburuak</h3>
                <p class="text-sm text-gray-500">Aukeratu <strong>${subject.subjectTitle}</strong> irakasgaiari dagozkionak</p>
                <div class="mt-1 text-xs text-gray-400">
                    ${masterList.length} ODS eskuragarri | ${currentSelection.length} hautatuta
                </div>
            </div>
            <button id="closeOdsModal" class="p-2 hover:bg-gray-200 rounded-full transition">
                <i class="fas fa-times text-xl"></i>
            </button>
        </div>
        
        <!-- Bilaketa eta iragazkiak -->
        <div class="p-4 border-b bg-white">
            <div class="flex flex-col sm:flex-row gap-3">
                <div class="flex-1">
                    <div class="relative">
                        <input type="text" 
                               id="odsSearch" 
                               placeholder="Bilatu ODS kodea edo izenarekin..."
                               class="w-full text-sm px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                        <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                    </div>
                </div>
                <button id="selectAllOds" class="text-xs bg-blue-50 text-blue-600 px-3 py-2 rounded border border-blue-200 hover:bg-blue-100 font-bold">
                    <i class="fas fa-check-double mr-1"></i> Hautatu denak
                </button>
                <button id="clearAllOds" class="text-xs bg-gray-50 text-gray-600 px-3 py-2 rounded border border-gray-200 hover:bg-gray-100 font-bold">
                    <i class="fas fa-times mr-1"></i> Garbitu denak
                </button>
            </div>
        </div>
        
        <!-- ODS grid -->
        <div class="p-6 overflow-y-auto bg-gray-100 flex-1">
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" id="odsGrid"></div>
            <div id="noOdsResults" class="hidden text-center py-10 text-gray-500">
                <i class="fas fa-search text-3xl mb-3 text-blue-200"></i>
                <p>Ez da ODSik aurkitu</p>
            </div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t bg-white flex justify-between items-center shadow-lg">
            <div class="text-sm text-gray-600">
                <span id="selectedCount" class="font-bold text-blue-600">${selectedIds.size}</span> hautatuta
            </div>
            <div class="flex gap-3">
                <button id="cancelOds" class="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition">
                    Utzi
                </button>
                <button id="finishOds" class="bg-blue-600 text-white px-8 py-2 rounded-lg hover:bg-blue-700 font-bold shadow-md transform active:scale-95 transition">
                    Gorde (${selectedIds.size})
                </button>
            </div>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // 5. Grid-a marraztu
    const grid = content.querySelector('#odsGrid');
    const searchInput = content.querySelector('#odsSearch');
    const noResults = content.querySelector('#noOdsResults');
    const selectedCount = content.querySelector('#selectedCount');
    const finishBtn = content.querySelector('#finishOds');

    const renderGrid = (filterText = '') => {
        grid.innerHTML = '';
        const lowerFilter = filterText.toLowerCase();
        let visibleCount = 0;

        masterList.forEach(ods => {
            // Iragazketa
            if (filterText && 
                !ods.code?.toLowerCase().includes(lowerFilter) && 
                !ods.name?.toLowerCase().includes(lowerFilter)) {
                return;
            }
            visibleCount++;

            const odsId = String(ods.id);
            const odsNum = getCleanNumber(ods.code);
            const isSelected = selectedIds.has(odsId);
            
            const card = document.createElement('div');
            card.className = `ods-card relative cursor-pointer group rounded-xl transition-all duration-200 flex flex-col items-center overflow-hidden border-2 bg-white ${
                isSelected ? 'border-blue-600 ring-2 ring-blue-500 shadow-lg scale-[1.02]' : 'border-transparent hover:border-gray-300 hover:shadow-md'
            }`;

            card.innerHTML = `
                <div class="w-full aspect-square relative p-3">
                    <img src="${getImageUrl(odsNum)}" 
                         class="w-full h-full object-contain transition-all duration-300 ${
                             isSelected ? '' : 'opacity-70 group-hover:opacity-100'
                         }" 
                         loading="lazy"
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\"w-full h-full flex items-center justify-center font-bold text-2xl text-gray-300 bg-gray-100 rounded\">${odsNum}</div>'">
                    <div class="check-icon absolute top-2 right-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg transition-transform duration-200 ${
                        isSelected ? 'scale-100' : 'scale-0'
                    }">
                        <i class="fas fa-check text-xs"></i>
                    </div>
                </div>
                <div class="p-2 w-full text-center">
                    <div class="text-[10px] font-bold text-gray-500 mb-1">${ods.code || ''}</div>
                    <div class="text-xs font-medium text-gray-700 leading-tight line-clamp-2 ${
                        isSelected ? 'text-blue-700' : 'text-gray-600'
                    }">
                        ${ods.name || '...'}
                    </div>
                </div>
            `;

            card.onclick = () => {
                if (selectedIds.has(odsId)) {
                    selectedIds.delete(odsId);
                } else {
                    selectedIds.add(odsId);
                }
                
                // Eguneratu UI
                const checkIcon = card.querySelector('.check-icon');
                const textDiv = card.querySelector('.text-gray-700');
                
                if (selectedIds.has(odsId)) {
                    card.classList.add('border-blue-600', 'ring-2', 'ring-blue-500', 'shadow-lg', 'scale-[1.02]');
                    card.classList.remove('border-transparent', 'hover:border-gray-300', 'hover:shadow-md');
                    checkIcon.classList.remove('scale-0');
                    checkIcon.classList.add('scale-100');
                    textDiv.classList.add('text-blue-700');
                    textDiv.classList.remove('text-gray-600');
                } else {
                    card.classList.remove('border-blue-600', 'ring-2', 'ring-blue-500', 'shadow-lg', 'scale-[1.02]');
                    card.classList.add('border-transparent', 'hover:border-gray-300', 'hover:shadow-md');
                    checkIcon.classList.add('scale-0');
                    checkIcon.classList.remove('scale-100');
                    textDiv.classList.remove('text-blue-700');
                    textDiv.classList.add('text-gray-600');
                }
                
                // Eguneratu kontadorea
                selectedCount.textContent = selectedIds.size;
                finishBtn.innerHTML = `Gorde (${selectedIds.size})`;
            };

            grid.appendChild(card);
        });

        // Emaitzarik ez badago
        noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    };

    renderGrid();

    // 6. Event listeners
    searchInput.addEventListener('input', (e) => {
        renderGrid(e.target.value);
    });

    content.querySelector('#selectAllOds').onclick = () => {
        masterList.forEach(ods => selectedIds.add(String(ods.id)));
        selectedCount.textContent = selectedIds.size;
        finishBtn.innerHTML = `Gorde (${selectedIds.size})`;
        renderGrid(searchInput.value);
    };

    content.querySelector('#clearAllOds').onclick = () => {
        selectedIds.clear();
        selectedCount.textContent = '0';
        finishBtn.innerHTML = 'Gorde (0)';
        renderGrid(searchInput.value);
    };

    // 7. Itxiera kudeaketa
    const closeModal = () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
    };

    content.querySelector('#closeOdsModal').onclick = closeModal;
    content.querySelector('#cancelOds').onclick = closeModal;

	content.querySelector('#finishOds').onclick = async () => {
	    const btn = content.querySelector('#finishOds');
	    if (btn.disabled) return;
	    
	    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
	    btn.disabled = true;
	
	    try {
	        // 1. Hautapen berriak lortu
	        const newDetailODS = masterList
	            .filter(ods => selectedIds.has(String(ods.id)))
	            .map(ods => ({
	                id: ods.id,
	                code: ods.code,
	                name: ods.name,
	                color: ods.color,
	                odsCode: ods.code
	            }));
	
	        // ✅ 2. EGUNERATU this.currentSubject (LEHENA)
	        if (!this.currentSubject.content) this.currentSubject.content = {};
	        this.currentSubject.content.detailODS = newDetailODS;
	
	        // ✅ 3. SUPABASE GORDE (this.currentSubject erabiliz)
	        const { error } = await this.supabase
	            .from('irakasgaiak')
	            .update({ 
	                content: this.currentSubject.content,  // ← HEMEN
	                updated_at: new Date().toISOString()
	            })
	            .eq('id', this.currentSubject.id);  // ← HEMEN
	
	        if (error) throw error;
	        
	        // ✅ 4. UI EGUNERATU (this.currentSubject erabiliz)
	        if (window.ui && window.ui.renderSubjectDetail) {
	            window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
	        }
	
	        closeModal();
	
	    } catch (error) {
	        console.error("❌ Errorea ODS gordetzean:", error);
	        alert("Errorea ODS gordetzean: " + error.message);
	        btn.innerHTML = 'Saiatu berriro';
	        btn.disabled = false;
	    }
	};

    // Autofocus bilaketan
    setTimeout(() => searchInput.focus(), 100);
}
	
	// ?? FUNCION 1: GESTI¨®N DEL CAT¨¢LOGO IDU (Para el Sidebar - Master)
openIduCatalogEditor() {
    const modal = document.getElementById('listEditorModal');
    const container = document.getElementById('listEditorContainer');
    const titleEl = document.getElementById('listEditorTitle');
    const inputTop = document.getElementById('newItemInput')?.parentElement;
    
    // Configuración visual
    if(inputTop) inputTop.classList.add('hidden');
    if(titleEl) titleEl.innerHTML = `<i class="fas fa-edit mr-2 text-yellow-500"></i> Editatu IDU Katalogoa (Master)`;
    
    // Variables para filtrado
    let currentFilter = 'GUZTIAK';
    let currentSearch = '';
    
    // Helper: IDU kodea zenbaki bihurtu ordenatzeko
    const getIduNumber = (code) => {
        if (!code) return 999;
        const match = code.toString().match(/\d+/);
        return match ? parseInt(match[0], 10) : 999;
    };
    
    // Helper: IDU kodea normalizatu
    const normalizeIduCode = (code) => {
        if (!code) return 'IDU-01';
        const num = getIduNumber(code);
        return `IDU-${String(num).padStart(2, '0')}`;
    };
    
    // Helper: IDUak ordenatu
    const sortIduList = () => {
        if (this.adminCatalogs.iduGuidelines && Array.isArray(this.adminCatalogs.iduGuidelines)) {
            this.adminCatalogs.iduGuidelines.sort((a, b) => {
                const categoryOrder = { 'IRUDIKAPENA': 1, 'EKINTZA': 2, 'INPLIKAZIOA': 3 };
                const catA = a.range?.split(' ')[0] || '';
                const catB = b.range?.split(' ')[0] || '';
                
                if (categoryOrder[catA] !== categoryOrder[catB]) {
                    return (categoryOrder[catA] || 999) - (categoryOrder[catB] || 999);
                }
                return getIduNumber(a.code) - getIduNumber(b.code);
            });
        }
    };
    
    // RENDER TABLE FUNTZIOA
    const renderTable = () => {
        sortIduList();
        
        // Iragazketa
        const filteredItems = this.adminCatalogs.iduGuidelines.filter(item => {
            const categoryMatch = currentFilter === 'GUZTIAK' || (item.range && item.range.includes(currentFilter.split(' ')[0]));
            const searchMatch = !currentSearch || 
                (item.code && item.code.toLowerCase().includes(currentSearch.toLowerCase())) ||
                (item.name && item.name.toLowerCase().includes(currentSearch.toLowerCase())) ||
                (item.range && item.range.toLowerCase().includes(currentSearch.toLowerCase()));
            return categoryMatch && searchMatch;
        });
        
        // Koloreak
        const getCategoryColor = (range) => {
            if (!range) return { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700' };
            if (range.includes('IRUDIKAPENA')) return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' };
            if (range.includes('EKINTZA')) return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' };
            if (range.includes('INPLIKAZIOA')) return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' };
            return { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700' };
        };
        
        // HTML Egitura Nagusia
        container.innerHTML = `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h3 class="text-lg font-bold text-gray-800">IDU Katalogoa</h3>
                        <p class="text-sm text-gray-500">${this.adminCatalogs.iduGuidelines?.length || 0} IDU guztira</p>
                    </div>
                    <button id="btnAddIduMaster" class="text-sm bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 font-bold flex items-center gap-2">
                        <i class="fas fa-plus"></i> IDU Berria
                    </button>
                </div>
                
                <div class="mb-6 space-y-4">
                    <div class="flex flex-col sm:flex-row gap-4">
                        <div class="flex-1 relative">
                            <input type="text" id="iduSearchInput" placeholder="Bilatu..." class="w-full text-sm px-4 py-2 pl-10 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500" value="${currentSearch}">
                            <i class="fas fa-search absolute left-3 top-2.5 text-gray-400"></i>
                            ${currentSearch ? `<button id="clearSearch" class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>` : ''}
                        </div>
                        <div class="flex gap-2 overflow-x-auto pb-1">
                            <button class="filter-btn px-3 py-2 text-xs font-bold rounded-lg border whitespace-nowrap ${currentFilter === 'GUZTIAK' ? 'bg-yellow-500 text-white border-yellow-600' : 'bg-gray-100 text-gray-700'}" data-filter="GUZTIAK">Guztiak</button>
                            <button class="filter-btn px-3 py-2 text-xs font-bold rounded-lg border whitespace-nowrap ${currentFilter === 'IRUDIKAPENA' ? 'bg-purple-500 text-white border-purple-600' : 'bg-gray-100 text-gray-700'}" data-filter="IRUDIKAPENA">Irudikapena</button>
                            <button class="filter-btn px-3 py-2 text-xs font-bold rounded-lg border whitespace-nowrap ${currentFilter === 'EKINTZA' ? 'bg-blue-500 text-white border-blue-600' : 'bg-gray-100 text-gray-700'}" data-filter="EKINTZA">Ekintza</button>
                            <button class="filter-btn px-3 py-2 text-xs font-bold rounded-lg border whitespace-nowrap ${currentFilter === 'INPLIKAZIOA' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-gray-100 text-gray-700'}" data-filter="INPLIKAZIOA">Inplikazioa</button>
                        </div>
                    </div>
                </div>

                <div id="iduTableBody" class="space-y-4 pb-20">
                    ${filteredItems.length === 0 ? `<div class="text-center py-12 text-gray-400"><p>Ez da IDUrik aurkitu</p></div>` : ''}
                </div>
            </div>
        `;

        const body = document.getElementById('iduTableBody');
        
        // Elementuak sortu
        if (filteredItems.length > 0) {
            let lastCategory = null;
            
            filteredItems.forEach((item) => {
                // Indize erreala bilatu (filtroak daudenean garrantzitsua)
                const globalIndex = this.adminCatalogs.iduGuidelines.findIndex(i => i === item);
                
                const currentCategory = item.range?.split(' ')[0] || 'KATEGORIARIK GABE';
                const categoryColors = getCategoryColor(item.range);
                
                // Kategoria Goiburua
                if (currentCategory !== lastCategory && currentFilter === 'GUZTIAK') {
                    body.innerHTML += `
                        <div class="mt-6 mb-2 flex items-center gap-2 border-b pb-2 ${categoryColors.text}">
                            <i class="fas fa-layer-group"></i>
                            <h4 class="font-bold text-sm">${currentCategory}</h4>
                        </div>
                    `;
                    lastCategory = currentCategory;
                }

                const row = document.createElement('div');
                row.className = `bg-white p-4 rounded-xl border ${categoryColors.border} shadow-sm hover:shadow-md transition-all group`;
                
                row.innerHTML = `
                    <div class="flex flex-col gap-3">
                        <div class="flex justify-between items-start gap-4">
                            <div class="w-24 flex-shrink-0">
                                <label class="text-[10px] font-bold text-gray-400 uppercase">Kodea</label>
                                <input type="text" class="field-code w-full font-mono font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none" 
                                    value="${item.code || ''}" placeholder="IDU-01">
                            </div>
                            
                            <div class="flex-1 min-w-[200px]">
                                <label class="text-[10px] font-bold text-gray-400 uppercase">Kategoria</label>
                                <select class="field-range w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:border-yellow-500 outline-none">
                                    <option value="IRUDIKAPENA (Zer Ikasi)">IRUDIKAPENA</option>
                                    <option value="EKINTZA ETA ADIERAZPENA (Nola Ikasi)">EKINTZA</option>
                                    <option value="INPLIKAZIOA (Zergatik Ikasi)">INPLIKAZIOA</option>
                                </select>
                            </div>

                            <button class="btn-delete text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition self-center">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>

                        <div class="w-full">
                            <label class="text-[10px] font-bold text-gray-400 uppercase">Deskribapena</label>
                            <textarea rows="2" class="field-name w-full text-sm text-gray-700 bg-white border border-gray-200 rounded-lg p-3 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none resize-none"
                                placeholder="Idatzi deskribapena...">${item.name || ''}</textarea>
                        </div>
                    </div>
                `;

                // Balioak ezarri (Select)
                const select = row.querySelector('.field-range');
                if(item.range) select.value = item.range;

                // Event Listeners (EDIZIOA)
                const updateModel = (e) => {
                    const target = e.target;
                    
                    if (target.classList.contains('field-code')) {
                        this.adminCatalogs.iduGuidelines[globalIndex].code = target.value;
                    } else if (target.classList.contains('field-name')) {
                        this.adminCatalogs.iduGuidelines[globalIndex].name = target.value;
                    } else if (target.classList.contains('field-range')) {
                        this.adminCatalogs.iduGuidelines[globalIndex].range = target.value;
                        // Kategoria aldatzean, taula berreraiki behar da ordenatzeko
                        sortIduList();
                        renderTable();
                        return; // Ez jarraitu
                    }

                    // Kodea aldatzean bakarrik fokua galtzean ordenatu
                    if (target.classList.contains('field-code') && e.type === 'change') {
                        this.adminCatalogs.iduGuidelines[globalIndex].code = normalizeIduCode(target.value);
                        sortIduList();
                        renderTable();
                    }
                };

                row.querySelectorAll('input, textarea, select').forEach(el => {
                    if(el.tagName === 'SELECT') {
                        el.addEventListener('change', updateModel);
                    } else {
                        el.addEventListener('input', updateModel); // Zuzeneko eguneratzea
                        el.addEventListener('change', updateModel); // Finalizatu eta ordenatu
                    }
                });

                // EZABATZEKO LOGIKA ZUZENDUA (Hemen zegoen akatsa lehen)
                row.querySelector('.btn-delete').onclick = async () => {
                    if(confirm(`Ziur "${item.code}" IDUa ezabatu nahi duzula?`)) {
                        // 1. Array-tik kendu
                        this.adminCatalogs.iduGuidelines.splice(globalIndex, 1);
                        
                        // 2. UI berritu berehala
                        renderTable();

                        // 3. Supabase-tik ezabatu (Atzeko planoan)
                        // ADI: Catalog_idu taulan 'code' da gako bakarra? Edo 'id'?
                        // Hemen 'id' erabiltzea seguruagoa da existitzen bada.
                        const query = this.supabase.from('catalog_idu').delete();
                        
                        if(item.id) {
                            await query.eq('id', item.id);
                        } else {
                            await query.eq('code', item.code);
                        }
                    }
                };

                body.appendChild(row);
            });
        }
        
        // Setup Filtroak eta Bilatzailea
        setTimeout(() => {
            document.getElementById('iduSearchInput')?.addEventListener('input', (e) => {
                currentSearch = e.target.value;
                renderTable();
            });
            
            document.getElementById('clearSearch')?.addEventListener('click', () => {
                currentSearch = '';
                renderTable();
            });

            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.onclick = () => {
                    currentFilter = btn.dataset.filter;
                    renderTable();
                };
            });

            // GEHITU BOTOIA LOGIKA
            document.getElementById('btnAddIduMaster')?.addEventListener('click', () => {
                const newCodeNumber = this.adminCatalogs.iduGuidelines.length + 1;
                this.adminCatalogs.iduGuidelines.unshift({
                    code: `IDU-${String(newCodeNumber).padStart(2, '0')}`,
                    name: '',
                    range: 'IRUDIKAPENA (Zer Ikasi)'
                });
                currentSearch = '';
                currentFilter = 'GUZTIAK';
                renderTable();
            });
        }, 0);
    };

    // Hasieratu
    renderTable();
    modal.classList.remove('hidden');

    // GORDE BOTOIAREN LOGIKA ZUZENDUA (CATALOG_IDU GORDETZEKO)
    const saveBtn = this._setupSaveButtonRaw(modal);
    
    saveBtn.onclick = async () => {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
        saveBtn.disabled = true;

        try {
            // 1. Balidazio minimoa
            const invalidItems = this.adminCatalogs.iduGuidelines.filter(i => !i.code || !i.name);
            if (invalidItems.length > 0) {
                throw new Error(`${invalidItems.length} IDUk datu faltak dituzte (Kodea edo Izena).`);
            }

            // 2. Ordenatu gorde aurretik
            sortIduList();

            // 3. Supabase Upsert (Katalogo Orokorra)
            const { error } = await this.supabase
                .from('catalog_idu')
                .upsert(this.adminCatalogs.iduGuidelines, { onConflict: 'code' }); 
                // ADI: 'code' bakarra bada. Bestela 'id' erabili beharko litzateke onConflict-en.

            if (error) throw error;

            console.log("✅ IDU Katalogoa eguneratuta");
            alert("Katalogoa ondo gorde da!");
            modal.classList.add('hidden');

            // UI Freskatu (Admin panelean bazaude)
            // if (this.renderAdminPanel) this.renderAdminPanel(); 

        } catch (e) {
            console.error(e);
            alert("❌ Errorea gordetzerakoan: " + e.message);
        } finally {
            saveBtn.innerHTML = 'Gorde Aldaketak';
            saveBtn.disabled = false;
        }
    };
}
	

// ?? FUNCION 2: SELECTOR DE ASIGNATURA (Checklist con Filtro)
openIduSelector() {
    console.log("🟡 IDU hautatzailea irekitzen (Dinamikoa)...");
    
    const subject = this.currentSubject;
    if (!subject) return;
    
    // 1. Datuak prestatu
    if (!subject.content) subject.content = {};
    const currentList = subject.idujar || subject.content.idujar || []; 
    const catalog = this.adminCatalogs.iduGuidelines || [];
    
    // ---------------------------------------------------------
    // A) LOGIKA DINAMIKOA: Kategoriak eta Estiloak kalkulatu
    // ---------------------------------------------------------
    
    // 1. Dauden kategoria bakarrak atera datuetatik
    const uniqueCategories = [...new Set(catalog.map(item => {
        // Badaezpada array edo string den
        return Array.isArray(item.range) ? item.range[0] : (item.range || 'BESTELAKOAK');
    }))].filter(c => c).sort();

    // 2. Kolore paleta zirkularra (Kategoriak gehitu ahala, koloreak errepikatu egingo dira)
    const stylePalette = [
        { name: 'purple',  bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200', hover: 'hover:bg-purple-100' },
        { name: 'blue',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   hover: 'hover:bg-blue-100' },
        { name: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', hover: 'hover:bg-emerald-100' },
        { name: 'amber',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   hover: 'hover:bg-amber-100' },
        { name: 'rose',    bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    hover: 'hover:bg-rose-100' }
    ];

    // 3. Kategoria bakoitzari estilo bat esleitu (Map bat sortu)
    const categoryStyles = {};
    uniqueCategories.forEach((cat, index) => {
        // Moduloa (%) erabiltzen dugu koloreak bukatzen badira berriro hasteko
        categoryStyles[cat] = stylePalette[index % stylePalette.length];
    });

    // ---------------------------------------------------------

    // Garbitu aurrekoak
    document.querySelectorAll('.catalog-modal-overlay').forEach(m => m.remove());

    // Modala sortu
    const modal = document.createElement('div');
    modal.className = "catalog-modal-overlay fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200";
    
    const content = document.createElement('div');
    content.className = "bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden";
    
    content.innerHTML = `
        <div class="p-5 border-b flex justify-between items-center bg-gray-50">
            <div>
                <h3 class="font-bold text-xl text-gray-800">IDU Jarraibideak</h3>
                <p class="text-sm text-gray-500">Hautatu <strong>${subject.subjectTitle || subject.name}</strong> irakasgaiari dagozkionak</p>
            </div>
            <button id="closeIduModal" class="p-2 hover:bg-gray-200 rounded-full transition">
                <i class="fas fa-times text-xl"></i>
            </button>
        </div>
        
        <div class="p-4 border-b bg-white flex flex-col sm:flex-row gap-3">
            <div class="flex-1 relative">
                <input type="text" id="iduSearch" placeholder="Bilatu kodea edo izena..." class="w-full text-sm px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none">
                <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
            </div>
            <div id="categoryFilters" class="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                </div>
        </div>
        
        <div class="p-6 overflow-y-auto bg-gray-50 flex-1 relative">
            <div id="iduContent" class="space-y-6"></div>
            <div id="noIduResults" class="hidden absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                <i class="fas fa-search text-4xl mb-3 text-gray-300"></i>
                <p>Ez da emaitzarik aurkitu</p>
            </div>
        </div>

        <div class="p-4 border-t bg-white flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div class="text-sm text-gray-600">
                <span id="selectedIduCount" class="font-bold text-yellow-600 text-lg">${currentList.length}</span> hautatuta
            </div>
            <div class="flex gap-3">
                <button id="cancelIdu" class="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">Utzi</button>
                <button id="finishIdu" class="bg-yellow-500 text-white px-8 py-2 rounded-lg hover:bg-yellow-600 font-bold shadow-md transform active:scale-95 transition">
                    Gorde (${currentList.length})
                </button>
            </div>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // 3. UI Elementuak
    const container = content.querySelector('#iduContent');
    const searchInput = content.querySelector('#iduSearch');
    const filtersContainer = content.querySelector('#categoryFilters');
    const noResults = content.querySelector('#noIduResults');
    const selectedCountSpan = content.querySelector('#selectedIduCount');
    const finishBtn = content.querySelector('#finishIdu');
    
    let selectedIds = new Set(currentList.map(item => String(item.id)));
    const getFullObject = (id) => catalog.find(c => String(c.id) === String(id));

    let currentFilter = 'all';
    let currentSearch = '';

    // ---------------------------------------------------------
    // B) FILTRO BOTOIAK SORTU (Loops erabiliz, ez eskuz)
    // ---------------------------------------------------------
    const renderFilters = () => {
        filtersContainer.innerHTML = '';
        
        // 1. 'Guztiak' botoia (beti finkoa)
        const allBtn = document.createElement('button');
        allBtn.textContent = 'Guztiak';
        allBtn.dataset.category = 'all';
        // Hasierako egoera
        const isAllActive = currentFilter === 'all';
        allBtn.className = `category-filter px-3 py-2 text-xs font-bold rounded transition-colors whitespace-nowrap ${
            isAllActive 
            ? 'bg-gray-800 text-white shadow-md' 
            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
        }`;
        
        allBtn.onclick = () => { currentFilter = 'all'; updateFilterStyles(); renderContent(); };
        filtersContainer.appendChild(allBtn);

        // 2. Kategoria dinamikoen botoiak
        uniqueCategories.forEach(cat => {
            const style = categoryStyles[cat]; // Lehen kalkulatutako estiloa berreskuratu
            const btn = document.createElement('button');
            btn.textContent = cat; // "IRUDIKAPENA", "EKINTZA", etab.
            btn.dataset.category = cat;
            
            // Hasierako klaseak (Aktibo/Ez aktibo kalkulatuko dira gero)
            btn.className = `category-filter px-3 py-2 text-xs font-bold rounded border transition-colors whitespace-nowrap ${style.bg} ${style.text} ${style.border} ${style.hover} opacity-60 hover:opacity-100`;
            
            btn.onclick = () => { currentFilter = cat; updateFilterStyles(); renderContent(); };
            filtersContainer.appendChild(btn);
        });
    };

    // Estiloak eguneratu klik egitean
    const updateFilterStyles = () => {
        const btns = filtersContainer.querySelectorAll('.category-filter');
        btns.forEach(btn => {
            const cat = btn.dataset.category;
            const isActive = cat === currentFilter;
            
            if (cat === 'all') {
                btn.className = `category-filter px-3 py-2 text-xs font-bold rounded transition-colors whitespace-nowrap ${
                    isActive ? 'bg-gray-800 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200'
                }`;
            } else {
                const style = categoryStyles[cat];
                if (isActive) {
                    // Aktibo dagoenean: Kolore "betea" (adibidez botoi iluna testu zuriarekin) edo estilo nabarmena
                    // Kasu honetan zure estilo originala mantentzen dugu baina opazitaterik gabe eta itzalarekin
                    btn.className = `category-filter px-3 py-2 text-xs font-bold rounded border transition-colors whitespace-nowrap ${style.bg} ${style.text} ${style.border} shadow-md ring-2 ring-offset-1 ring-${style.name}-200`;
                } else {
                    // Inaktibo
                    btn.className = `category-filter px-3 py-2 text-xs font-bold rounded border transition-colors whitespace-nowrap bg-white text-gray-500 border-gray-200 hover:${style.bg} hover:${style.text}`;
                }
            }
        });
    };

    const renderContent = () => {
        container.innerHTML = '';
        
        // 1. Iragazi
        let filtered = catalog.filter(item => {
            const matchesSearch = !currentSearch || 
                (item.code?.toLowerCase().includes(currentSearch.toLowerCase()) || 
                 item.name?.toLowerCase().includes(currentSearch.toLowerCase()));
            
            const itemRange = Array.isArray(item.range) ? item.range[0] : (item.range || 'BESTELAKOAK');
            const matchesCategory = currentFilter === 'all' || itemRange === currentFilter;
            
            return matchesSearch && matchesCategory;
        });
        
        // 2. Ordenatu
        filtered.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
        
        if (filtered.length === 0) {
            noResults.classList.remove('hidden');
            return;
        }
        noResults.classList.add('hidden');

        // 3. Multzokatu (Dinamikoki)
        const groups = {};
        filtered.forEach(item => {
            const cat = Array.isArray(item.range) ? item.range[0] : (item.range || 'BESTELAKOAK');
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });

        // 4. HTML Sortu (Loop bidez)
        // Ordena mantentzeko 'uniqueCategories' erabiltzen dugu gida gisa
        const categoriesToShow = currentFilter === 'all' ? uniqueCategories : [currentFilter];

        categoriesToShow.forEach(category => {
            const items = groups[category];
            if (!items || items.length === 0) return;

            const style = categoryStyles[category]; // <--- HEMEN DAGO GAKOA, ez if/else
            const section = document.createElement('div');

            section.innerHTML = `
                <div class="flex items-center gap-2 mb-3 px-2 sticky top-0 bg-gray-50/95 py-2 z-10">
                    <span class="px-3 py-1 rounded-full text-xs font-bold border ${style.bg} ${style.text} ${style.border}">
                        ${category}
                    </span>
                    <span class="text-xs text-gray-400 font-medium">${items.length}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6"></div>
            `;
            
            const grid = section.querySelector('.grid');

            items.forEach(item => {
                const idStr = String(item.id);
                const isSelected = selectedIds.has(idStr);
                
                const card = document.createElement('div');
                card.className = `group relative cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex flex-col gap-2 ${
                    isSelected 
                    ? 'bg-yellow-50 border-yellow-400 shadow-md' 
                    : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm'
                }`;
                
                card.innerHTML = `
                    <div class="flex justify-between items-start">
                        <span class="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded group-hover:bg-white transition-colors">
                            ${item.code}
                        </span>
                        <div class="check-circle w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            isSelected ? 'bg-yellow-500 text-white scale-100' : 'bg-gray-100 text-transparent scale-90'
                        }">
                            <i class="fas fa-check text-xs"></i>
                        </div>
                    </div>
                    <p class="text-sm text-gray-700 font-medium leading-snug line-clamp-3 group-hover:text-gray-900">
                        ${item.name}
                    </p>
                `;

                card.onclick = () => {
                    const checkCircle = card.querySelector('.check-circle');
                    if (selectedIds.has(idStr)) {
                        selectedIds.delete(idStr);
                        card.className = "group relative cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex flex-col gap-2 bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm";
                        checkCircle.classList.remove('bg-yellow-500', 'text-white', 'scale-100');
                        checkCircle.classList.add('bg-gray-100', 'text-transparent', 'scale-90');
                    } else {
                        selectedIds.add(idStr);
                        card.className = "group relative cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex flex-col gap-2 bg-yellow-50 border-yellow-400 shadow-md";
                        checkCircle.classList.remove('bg-gray-100', 'text-transparent', 'scale-90');
                        checkCircle.classList.add('bg-yellow-500', 'text-white', 'scale-100');
                    }

                    const count = selectedIds.size;
                    selectedCountSpan.textContent = count;
                    finishBtn.innerHTML = `Gorde (${count})`;
                    finishBtn.classList.add('scale-105');
                    setTimeout(() => finishBtn.classList.remove('scale-105'), 150);
                };
                grid.appendChild(card);
            });
            container.appendChild(section);
        });
    };

    // Hasieratu
    renderFilters();
    updateFilterStyles(); // Hasierako egoera
    renderContent();

    // Listeners
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        renderContent();
    });

    const closeModal = () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    };

    content.querySelector('#closeIduModal').onclick = closeModal;
    content.querySelector('#cancelIdu').onclick = closeModal;

    // GORDE LOGIKA (Bakarrik idujar)
	// Zure `openIduSelector()`-en, GEHITU HAU BAKARRIK:
	finishBtn.onclick = async () => {
	    finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
	    finishBtn.disabled = true;
	
	    try {
	        const newSelection = Array.from(selectedIds).map(id => {
	            const item = getFullObject(id);
	            return {
	                id: item.id,
	                code: item.code,
	                name: item.name,
	                range: item.range,
	                iduCode: item.code
	            };
	        }).filter(Boolean);
	
	        // 🔴 1. JSON EGUNERATU - ZURE LEKU ZUZENEAN
	        if (!subject.content) subject.content = {};
	        subject.content.idujar = newSelection;  // 🔴 HAU DA ZURE ERABILTZEN DUZUENA!
	        
	        // 🔴 2. MEMORIA OSOA EGUNERATU
	        /*if (this.currentDegreeData) {
	            const subjectIndex = this.currentDegreeData.findIndex(
	                s => s.idAsig === subject.idAsig
	            );
	            
	            if (subjectIndex !== -1) {
	                if (!this.currentDegreeData[subjectIndex].content) {
	                    this.currentDegreeData[subjectIndex].content = {};
	                }
	                this.currentDegreeData[subjectIndex].content.idujar = newSelection;
	                console.log("✅ Memoria eguneratuta - content.idujar");
	            }
	        }*/
	
	        // 🔴 3. SUPABASE-N GORDE (ZUZENEAN)
	        const { error } = await this.supabase
	            .from('irakasgaiak')
	            .update({ 
	                content: subject.content,  // 🔴 JSON osoa gordetzen duzu
	                updated_at: new Date().toISOString()
	            })
	            .eq('id', subject.id);
	
	        if (error) throw error;
	
	        console.log("✅ Supabase-n gordeta - content.idujar");
	        closeModal();
	
	        // 🔴 4. UI FRESKATU
	        if (window.ui && typeof window.ui.renderSubjectDetail === 'function') {
	            window.ui.renderSubjectDetail(subject, this.currentDegree);
	        }
	
	    } catch (error) {
	        console.error("❌ Errorea:", error);
	        alert("Errorea: " + error.message);
	        finishBtn.innerHTML = 'Saiatu berriro';
	        finishBtn.disabled = false;
	    }
	};

    setTimeout(() => searchInput.focus(), 50);
}
	
openProjectsCatalogEditor() {
    // Ziurtatu katalogoa hasieratuta dagoela
    if (!this.adminCatalogs.externalProjects) this.adminCatalogs.externalProjects = [];

    // ALDAGAI BERRIAK: Bilaketa eta ordena
    let currentSearch = "";
    let currentSort = "";

    // --- 1. MODALAREN HTML OINARRIA (HOBETUA) ---
    const modalHtml = `
        <div id="catalogEditorModal" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
                
                <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 class="text-lg font-bold text-gray-800">Kanpo Proiektuen Katalogoa</h2>
                        <p class="text-xs text-gray-500">Kudeatu enpresak, koloreak eta logoen fitxategi izenak.</p>
                    </div>
                    <button id="closeCatalogModal" class="text-gray-400 hover:text-gray-600 transition">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>

                <!-- BILAKETA ATALA (HOBETUA) -->
                <div class="px-6 py-3 bg-white border-b border-gray-100">
                    <div class="flex flex-col md:flex-row gap-3">
                        <!-- Bilaketa testua -->
                        <div class="flex-1">
                            <div class="relative">
                                <input type="text" id="projectSearchInput" 
                                       placeholder="Bilatu erakundea, proiektuak edo mota..." 
                                       class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                       value="">
                                <i class="fas fa-search absolute left-3 top-2.5 text-gray-400"></i>
                            </div>
                        </div>
                        
                        <!-- Ordenatze aukera (GEHITUTA) -->
                        <div class="md:w-48">
                            <select id="sortOrder" 
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="">Ordenatu...</option>
                                <option value="agent_asc">Erakundea (A-Z)</option>
                                <option value="agent_desc">Erakundea (Z-A)</option>
                                <option value="name_asc">Proiektua (A-Z)</option>
                                <option value="type_asc">Mota (A-Z)</option>
                                <option value="newest">Berrienak lehenik</option>
                                <option value="oldest">Zaharrenak lehenik</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- INFORMATZIO ATALA -->
                <div class="px-6 py-3 bg-blue-50 border-b border-blue-100">
                    <div class="flex flex-col md:flex-row items-center justify-between gap-2">
                        <div class="text-xs text-blue-700 flex items-center gap-2">
                            <i class="fas fa-info-circle"></i>
                            <span>Logoak <b>assets/logos/</b> karpetan. Idatzi izena soilik (adib: <i>enpresa.png</i>).</span>
                        </div>
                        <div class="flex gap-2 text-xs">
                            <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded" id="uniqueTypesCount">0 mota</span>
                            <span class="px-2 py-1 bg-green-100 text-green-700 rounded" id="uniqueAgentsCount">0 agente</span>
                            <!-- Emaitza kontagailua (GEHITUTA) -->
                            <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded" id="resultCount">0 proiektu</span>
                        </div>
                    </div>
                </div>

                <!-- KATALOGO EDUKIA -->
                <div class="flex-1 overflow-y-auto p-6 bg-gray-50/50" id="catalogListContainer">
                    <!-- Hemen proiektuen zerrenda kargatuko da -->
                </div>

                <!-- BOTOIAK -->
                <div class="px-6 py-4 border-t border-gray-100 bg-white flex justify-between items-center">
                    <div class="flex gap-2">
                        <button id="addProjectBtn" class="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-100 transition flex items-center gap-2">
                            <i class="fas fa-plus"></i> Gehitu Proiektua
                        </button>
                    </div>
                    <div class="flex gap-2">
                        <button id="saveCatalogBtn" class="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition">
                            <i class="fas fa-save mr-2"></i>Gorde Aldaketak
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('catalogEditorModal');

    // --- 2. FUNTZIO LAGUNTZAILEAK (ZURE KODEA BERDIN) ---

    const getUniqueTypes = () => {
        const tipos = this.adminCatalogs.externalProjects
            .map(p => p.type).filter(t => t && t.trim() !== '');
        return [...new Set(tipos)].sort();
    };

    const getUniqueAgents = () => {
        const agentes = this.adminCatalogs.externalProjects
            .map(p => p.agent).filter(a => a && a.trim() !== '');
        return [...new Set(agentes)].sort();
    };

    const getColorForType = (type) => {
        if (!type) return '#94a3b8';
        const project = this.adminCatalogs.externalProjects.find(p => p.type === type && p.color);
        return project?.color || '#94a3b8';
    };

    const createDataLists = () => {
        ['typeSuggestions', 'agentSuggestions'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.remove();
        });

        const types = getUniqueTypes();
        const agents = getUniqueAgents();

        document.getElementById('uniqueTypesCount').textContent = `${types.length} mota`;
        document.getElementById('uniqueAgentsCount').textContent = `${agents.length} agente`;

        if (types.length) {
            const dl = document.createElement('datalist');
            dl.id = 'typeSuggestions';
            types.forEach(t => { const op = document.createElement('option'); op.value = t; dl.appendChild(op); });
            document.body.appendChild(dl);
        }
        if (agents.length) {
            const dl = document.createElement('datalist');
            dl.id = 'agentSuggestions';
            agents.forEach(a => { const op = document.createElement('option'); op.value = a; dl.appendChild(op); });
            document.body.appendChild(dl);
        }
    };

    // --- 3. RENDER TABLE (HOBETUA ORDENATZEAREKIN) ---
    const renderTable = () => {
        const container = document.getElementById('catalogListContainer');
        container.innerHTML = '';

        // 1. FILTRATU (zure kodea berdina)
        let filteredItems = this.adminCatalogs.externalProjects.filter(item => {
            const term = currentSearch.toLowerCase();
            return !term || 
                   (item.agent && item.agent.toLowerCase().includes(term)) ||
                   (item.name && item.name.toLowerCase().includes(term)) ||
                   (item.type && item.type.toLowerCase().includes(term));
        });

        // 2. ORDENATU (GEHITUTA)
        if (currentSort) {
            switch(currentSort) {
                case 'agent_asc':
                    filteredItems.sort((a, b) => (a.agent || '').localeCompare(b.agent || ''));
                    break;
                case 'agent_desc':
                    filteredItems.sort((a, b) => (b.agent || '').localeCompare(a.agent || ''));
                    break;
                case 'name_asc':
                    filteredItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                    break;
                case 'type_asc':
                    filteredItems.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
                    break;
                case 'newest':
                    filteredItems.sort((a, b) => (b.id || 0) - (a.id || 0));
                    break;
                case 'oldest':
                    filteredItems.sort((a, b) => (a.id || 0) - (b.id || 0));
                    break;
            }
        }

        // 3. KONTAGAILUA EGUNERATU (GEHITUTA)
        const resultCount = document.getElementById('resultCount');
        if (resultCount) {
            const total = this.adminCatalogs.externalProjects.length;
            const filtered = filteredItems.length;
            if (currentSearch || currentSort) {
                resultCount.textContent = `${filtered}/${total} proiektuak`;
                resultCount.className = "px-2 py-1 bg-amber-100 text-amber-700 rounded";
            } else {
                resultCount.textContent = `${total} proiektuak`;
                resultCount.className = "px-2 py-1 bg-gray-100 text-gray-700 rounded";
            }
        }

        // 4. RENDERIZATU (zure kodea berdina, baina filteredItems erabiliz)
        if (filteredItems.length === 0) {
            container.innerHTML = `
                <div class="text-center py-16 text-gray-400">
                    <i class="fas fa-search text-4xl mb-4"></i>
                    <p>${this.adminCatalogs.externalProjects.length === 0 ? 'Ez dago proiekturik.' : 'Ez da emaitzarik aurkitu.'}</p>
                    ${currentSearch ? `<p class="text-sm mt-2">Bilaketa: "${currentSearch}"</p>` : ''}
                </div>`;
            return;
        }

        const tiposUnicos = getUniqueTypes();
        const typeColorMap = {};
        tiposUnicos.forEach(t => typeColorMap[t] = getColorForType(t));
        const cacheBuster = Date.now();

        // Iteratu FILTRATUTAKO item-en gainean
        filteredItems.forEach((item) => {
            // Indize erreala bilatu array originalean
            const globalIndex = this.adminCatalogs.externalProjects.indexOf(item);
            
            const row = document.createElement('div');
            row.className = 'project-row-item bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-3 flex items-center gap-4 group hover:shadow-md transition-all duration-200';
            
            const logoPath = item.logoFile? `assets/logos/${item.logoFile}?v=${cacheBuster}` : null;
            const initials = (item.agent || '?').substring(0, 2).toUpperCase();
            const itemColor = typeColorMap[item.type] || item.color || '#6366f1';

            row.innerHTML = `
                <div class="relative shrink-0">
                    <div class="logo-preview w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-gray-100"
                         style="background-color: ${itemColor}">
                        ${logoPath ? 
                            `<img src="${logoPath}" class="w-full h-full object-contain p-0.5 bg-white" 
                                  onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">` : ''}
                        <span class="text-white font-bold text-base select-none" style="display: ${logoPath ? 'none' : 'block'}">
                            ${initials}
                        </span>
                    </div>
                </div>

                <div class="flex-1 grid grid-cols-12 gap-3">
                    <div class="col-span-3">
                        <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Erakundea</label>
                        <input type="text" list="agentSuggestions" class="w-full text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 field-agent focus:ring-2 focus:ring-indigo-500 outline-none" 
                               value="${item.agent || ''}" placeholder="Erakundea..." data-index="${globalIndex}">
                    </div>

                    <div class="col-span-3">
                        <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Logo Fitxategia</label>
                        <div class="relative flex items-center">
                            <span class="absolute left-2 text-xs text-gray-400 select-none">.../</span>
                            <input type="text" class="w-full text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg pl-8 pr-2 py-2 field-logo-name focus:ring-2 focus:ring-blue-500 outline-none" 
                                   value="${item.logoFile || ''}" placeholder="logo.png" data-index="${globalIndex}">
                        </div>
                    </div>
                    
                    <div class="col-span-4">
                        <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Proiektua</label>
                        <input type="text" class="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 field-name focus:ring-2 focus:ring-indigo-500 outline-none" 
                               value="${item.name || ''}" placeholder="Izena..." data-index="${globalIndex}">
                    </div>
                    
                    <div class="col-span-2">
                        <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Mota</label>
                        <input type="text" list="typeSuggestions" class="w-full text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 field-type focus:ring-2 focus:ring-indigo-500 outline-none"
                               value="${item.type || ''}" placeholder="Mota..." data-index="${globalIndex}">
                    </div>
                </div>

                <div class="flex flex-col items-end gap-3 pl-2 border-l border-gray-100">
                    <input type="color" class="w-8 h-8 p-0 border border-gray-300 rounded-lg cursor-pointer field-color" 
                           value="${itemColor}" data-index="${globalIndex}">
                    <button class="btn-delete text-gray-400 hover:text-red-500 px-2" data-index="${globalIndex}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(row);

            // EVENT LISTENERS (zure kodea berdina)
            const updateData = (e, field) => {
                const idx = parseInt(e.target.dataset.index);
                const val = e.target.value;
                const project = this.adminCatalogs.externalProjects[idx];

                if (field === 'agent') project.agent = val;
                else if (field === 'name') project.name = val;
                else if (field === 'logoFile') {
                    project.logoFile = val;
                    const img = row.querySelector('.logo-preview img');
                    const span = row.querySelector('.logo-preview span');
                    if(val) {
                        if(img) { 
                            img.src = `assets/logos/${val}?v=${Date.now()}`; 
                            img.style.display = 'block'; 
                            if(span) span.style.display = 'none';
                        } else { renderTable(); } 
                    } else {
                        if(img) img.style.display = 'none';
                        if(span) span.style.display = 'block';
                    }
                }
                else if (field === 'type') {
                    project.type = val;
                    if(val && typeColorMap[val]) { project.color = typeColorMap[val]; renderTable(); }
                }
                else if (field === 'color') {
                    project.color = val;
                    row.querySelector('.logo-preview').style.backgroundColor = val;
                    
                    const currentType = project.type;
                    if (currentType && currentType.trim() !== '') {
                        this.adminCatalogs.externalProjects.forEach(p => {
                            if (p.type === currentType) p.color = val;
                        });
                        if(row.renderTimeout) clearTimeout(row.renderTimeout);
                        row.renderTimeout = setTimeout(() => { renderTable(); }, 500);
                    }
                }
            };

            row.querySelectorAll('input').forEach(input => {
                if(input.classList.contains('field-agent')) input.oninput = (e) => updateData(e, 'agent');
                if(input.classList.contains('field-logo-name')) input.oninput = (e) => updateData(e, 'logoFile');
                if(input.classList.contains('field-name')) input.oninput = (e) => updateData(e, 'name');
                if(input.classList.contains('field-type')) input.oninput = (e) => updateData(e, 'type');
                if(input.classList.contains('field-color')) input.oninput = (e) => updateData(e, 'color');
            });

            row.querySelector('.btn-delete').onclick = () => {
                if(confirm("Ziur ezabatu?")) {
                    this.adminCatalogs.externalProjects.splice(globalIndex, 1);
                    renderTable();
                }
            };
        });
        createDataLists();
    };

    // --- 4. BILAKETA ETA ORDENA EVENT LISTENER-RAK (GEHITUTA) ---
    
    // Hasierako renderizazioa
    renderTable();
    
    // Bilatzailearen event listener-a (zure kodea berdina)
    setTimeout(() => {
        const searchInput = document.getElementById('projectSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearch = e.target.value;
                renderTable();
            });
            searchInput.focus();
        }
    }, 50);
    
    // Ordenatze select-aren event listener-a (GEHITUTA)
    setTimeout(() => {
        const sortSelect = document.getElementById('sortOrder');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                currentSort = e.target.value;
                renderTable();
            });
        }
    }, 50);
    
    // --- 5. BOTOIEN KONFIGURAZIOA (HOBETUA UI EGUNERAKETA) ---

    document.getElementById('addProjectBtn').onclick = () => {
        this.adminCatalogs.externalProjects.unshift({
            id: Date.now(),
            agent: "",
            logoFile: "",
            name: "",
            type: "HITZALDIA",
            color: "#6366f1"
        });
        currentSearch = ""; // Bilaketa garbitu
        currentSort = ""; // Ordena garbitu
        document.getElementById('projectSearchInput').value = "";
        document.getElementById('sortOrder').value = "";
        renderTable();
        setTimeout(() => document.querySelector('.field-agent')?.focus(), 50);
    };

    document.getElementById('saveCatalogBtn').onclick = async () => {
        const btn = document.getElementById('saveCatalogBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
        btn.disabled = true;

        try {
            // 1. GORDE SUPABASE-N
            const { error } = await this.supabase
                .from('admin_external_projects')
                .upsert(this.adminCatalogs.externalProjects, { onConflict: 'id' });

            if (error) throw error;
            
	        // 2. 🔴 GARRANTZITSUENA: GEHITU HIRU LERRO HAU BAKARRIK
	        // ========================================================
	        console.log("🔄 Memoria freskatzen...");
	        const { data: freshData } = await this.supabase
	            .from('admin_external_projects')
	            .select('*');
	        this.adminCatalogs.externalProjects = freshData || [];
	        console.log(`✅ ${freshData?.length || 0} proiektu memoria freskoan`);
            
            alert("✅ Ondo gorde da!");
            modal.remove();
            
            // 3. UI FRESKATU (konfiantzaz)
            if (this.currentSubject && this.currentDegree) {
                // Saiatu zure klaseko funtzioa
                if (typeof this.renderSubjectDetail === 'function') {
                    this.renderSubjectDetail(this.currentSubject, this.currentDegree);
                }
                // Bestela, window.ui bidez
                else if (window.ui?.renderSubjectDetail) {
                    window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
                }
            }
            
            // 4. EVENT GLOBALA (aukerakoa baina onuragarria)
            document.dispatchEvent(new Event('externalProjectsUpdated'));

        } catch (error) {
            console.error(error);
            alert("Errorea gordetzean.");
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    document.getElementById('closeCatalogModal').onclick = () => {
        if(confirm("Aldaketak ez dituzu gorde. Ziur irten nahi duzula?")) {
            modal.remove();
        }
    };
}
	
// ?? FUNCION 2: SELECTOR DE ASIGNATURA (Checklist)
openProjectsSelector() {
    console.log("--> Proiektu hautatzailea irekitzen (Hautatuak botoiarekin)");
    const subject = this.currentSubject;
    if (!subject) return;

    // 1. DATUAK PRESTATU
    // Ziurtatu .content dela eta ez .context
    if (!subject.content) subject.content = {};
    const currentList = subject.extProy || subject.content.extProy || [];
    const catalog = this.adminCatalogs.externalProjects || [];

    // Garbitu aurreko modalak
    document.querySelectorAll('.catalog-modal-overlay').forEach(m => m.remove());

    // Kategoriak atera
    const uniqueCategories = [...new Set(catalog.map(item => {
        return Array.isArray(item.range) ? item.range[0] : (item.range || 'PROIEKTUAK');
    }))].filter(c => c).sort();

    // Estilo paleta
    const stylePalette = [
        { name: 'blue', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
        { name: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
        { name: 'purple', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
        { name: 'amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
        { name: 'rose', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' }
    ];
    const categoryStyles = {};
    uniqueCategories.forEach((cat, index) => {
        categoryStyles[cat] = stylePalette[index % stylePalette.length];
    });

    // 2. MODALA ERAIKI
    const modal = document.createElement('div');
    modal.className = "catalog-modal-overlay fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200";
    
    const content = document.createElement('div');
    content.className = "bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden";
    
    content.innerHTML = `
        <div class="p-5 border-b flex justify-between items-center bg-gray-50">
            <div>
                <h3 class="font-bold text-xl text-gray-800">Proiektuak / PBL</h3>
                <p class="text-sm text-gray-500">Hautatu <strong>${subject.subjectTitle || subject.name}</strong> irakasgaiari dagozkionak</p>
            </div>
            <button id="closeProjModal" class="p-2 hover:bg-gray-200 rounded-full transition"><i class="fas fa-times text-xl"></i></button>
        </div>
        
        <div class="p-4 border-b bg-white flex flex-col sm:flex-row gap-3">
            <div class="flex-1 relative">
                <input type="text" id="projSearch" placeholder="Bilatu proiektua..." class="w-full text-sm px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none">
                <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
            </div>
            <div id="projFilters" class="flex gap-2 overflow-x-auto pb-1 sm:pb-0 items-center"></div>
        </div>
        
        <div class="p-6 overflow-y-auto bg-gray-50 flex-1 relative">
            <div id="projContent" class="space-y-6"></div>
            <div id="noProjResults" class="hidden absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                <i class="fas fa-search text-4xl mb-3 text-gray-300"></i>
                <p>Ez da emaitzarik aurkitu</p>
            </div>
        </div>

        <div class="p-4 border-t bg-white flex justify-between items-center shadow-md">
            <div class="text-sm text-gray-600">
                <span id="selectedProjCount" class="font-bold text-yellow-600 text-lg">${currentList.length}</span> hautatuta
            </div>
            <div class="flex gap-3">
                <button id="cancelProj" class="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">Utzi</button>
                <button id="finishProj" class="bg-yellow-500 text-white px-8 py-2 rounded-lg hover:bg-yellow-600 font-bold shadow-md transform active:scale-95 transition">
                    Gorde (${currentList.length})
                </button>
            </div>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // 3. LOGIKA ETA INTERAKZIOA
    const container = content.querySelector('#projContent');
    const searchInput = content.querySelector('#projSearch');
    const filtersContainer = content.querySelector('#projFilters');
    const noResults = content.querySelector('#noProjResults');
    const selectedCountSpan = content.querySelector('#selectedProjCount');
    const finishBtn = content.querySelector('#finishProj');
    
    let selectedIds = new Set(currentList.map(item => String(item.id)));
    let currentFilter = 'all'; // 'all', 'selected', edo kategoria izena
    let currentSearch = '';

    // --- FILTROAK ---
    const renderFilters = () => {
        filtersContainer.innerHTML = '';
        
        // 1. "HAUTATUAK" BOTOIA (Berria)
        const selectedBtn = document.createElement('button');
        selectedBtn.id = 'filterSelectedBtn';
        selectedBtn.innerHTML = `<i class="fas fa-check-circle mr-1"></i> Hautatuak (${selectedIds.size})`;
        selectedBtn.dataset.category = 'selected';
        selectedBtn.onclick = () => { currentFilter = 'selected'; updateFilterStyles(); renderContent(); };
        filtersContainer.appendChild(selectedBtn);

        // Banatzaile txiki bat
        const divider = document.createElement('div');
        divider.className = "w-px h-6 bg-gray-300 mx-1";
        filtersContainer.appendChild(divider);

        // 2. "GUZTIAK" BOTOIA
        const allBtn = document.createElement('button');
        allBtn.textContent = 'Guztiak';
        allBtn.dataset.category = 'all';
        allBtn.onclick = () => { currentFilter = 'all'; updateFilterStyles(); renderContent(); };
        filtersContainer.appendChild(allBtn);

        // 3. KATEGORIAK
        uniqueCategories.forEach(cat => {
            const btn = document.createElement('button');
            btn.textContent = cat;
            btn.dataset.category = cat;
            btn.onclick = () => { currentFilter = cat; updateFilterStyles(); renderContent(); };
            filtersContainer.appendChild(btn);
        });
        updateFilterStyles();
    };

    const updateFilterStyles = () => {
        const btns = filtersContainer.querySelectorAll('button');
        btns.forEach(btn => {
            const cat = btn.dataset.category;
            const isActive = cat === currentFilter;
            
            if (cat === 'selected') {
                // Eguneratu kontagailua beti
                btn.innerHTML = `<i class="fas fa-check-circle mr-1"></i> Hautatuak (${selectedIds.size})`;
                btn.className = `px-3 py-2 text-xs font-bold rounded transition-colors whitespace-nowrap flex items-center ${
                    isActive 
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-300 shadow-sm' 
                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-yellow-50 hover:text-yellow-600'
                }`;
            } else if (cat === 'all') {
                btn.className = `px-3 py-2 text-xs font-bold rounded transition-colors whitespace-nowrap ${
                    isActive ? 'bg-gray-800 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`;
            } else {
                const style = categoryStyles[cat] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
                if (isActive) {
                    btn.className = `px-3 py-2 text-xs font-bold rounded border transition-colors whitespace-nowrap ${style.bg} ${style.text} ${style.border} shadow-md ring-1 ring-${style.name}-300`;
                } else {
                    btn.className = `px-3 py-2 text-xs font-bold rounded border transition-colors whitespace-nowrap bg-white text-gray-500 border-gray-200 hover:${style.bg} hover:${style.text}`;
                }
            }
        });
    };

    // --- EDUKIA MARRAZTU ---
    const renderContent = () => {
        container.innerHTML = '';
        
        let filtered = catalog.filter(item => {
            const matchesSearch = !currentSearch || (item.name?.toLowerCase().includes(currentSearch.toLowerCase()));
            let matchesFilter = true;
            
            if (currentFilter === 'selected') {
                matchesFilter = selectedIds.has(String(item.id));
            } else if (currentFilter !== 'all') {
                const itemRange = Array.isArray(item.range) ? item.range[0] : (item.range || 'PROIEKTUAK');
                matchesFilter = itemRange === currentFilter;
            }
            return matchesSearch && matchesFilter;
        });
        
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        
        if (filtered.length === 0) {
            noResults.classList.remove('hidden');
            noResults.querySelector('p').textContent = currentFilter === 'selected' ? "Ez dago proiekturik hautatuta" : "Ez da emaitzarik aurkitu";
            return;
        }
        noResults.classList.add('hidden');

        // Multzokatu
        const groups = {};
        filtered.forEach(item => {
            const cat = Array.isArray(item.range) ? item.range[0] : (item.range || 'PROIEKTUAK');
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });

        // Zein kategoria erakutsi? ('selected' edo 'all' denean denak, bestela bakarra)
        const categoriesToShow = (currentFilter === 'all' || currentFilter === 'selected') ? uniqueCategories : [currentFilter];

        categoriesToShow.forEach(category => {
            const items = groups[category];
            if (!items || items.length === 0) return;

            const style = categoryStyles[category] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
            
            const section = document.createElement('div');
            section.innerHTML = `
                <div class="flex items-center gap-2 mb-3 px-2 sticky top-0 bg-gray-50/95 py-2 z-10 backdrop-blur-sm">
                    <span class="px-3 py-1 rounded-full text-xs font-bold border ${style.bg} ${style.text} ${style.border}">${category}</span>
                    <span class="text-xs text-gray-400 font-medium">${items.length}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6"></div>
            `;
            const grid = section.querySelector('.grid');

            items.forEach(item => {
                const idStr = String(item.id);
                const isSelected = selectedIds.has(idStr);
                const hasLogo = !!item.logoBase64;
                const initials = (item.agent || '?').substring(0, 2).toUpperCase();
                
                const card = document.createElement('div');
                card.className = `group relative cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex flex-col gap-2 ${
                    isSelected ? 'bg-yellow-50 border-yellow-400 shadow-md' : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm'
                }`;
                
                card.innerHTML = `
                    <div class="flex justify-between items-start">
                         <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded shrink-0 flex items-center justify-center overflow-hidden border border-gray-100" style="${!hasLogo ? `background-color: ${item.color || '#fdba74'}` : 'background-color: white'}">
                                ${hasLogo ? `<img src="${item.logoBase64}" class="w-full h-full object-contain p-0.5">` : `<span class="text-white font-bold text-[10px]">${initials}</span>`}
                            </div>
                            <span class="font-mono text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">${item.type || 'PBL'}</span>
                        </div>
                        <div class="check-circle w-6 h-6 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-yellow-500 text-white scale-100' : 'bg-gray-100 text-transparent scale-90'}">
                            <i class="fas fa-check text-xs"></i>
                        </div>
                    </div>
                    <p class="text-sm text-gray-700 font-medium leading-snug line-clamp-3 group-hover:text-gray-900">${item.name}</p>
                `;

                card.onclick = () => {
                    const checkCircle = card.querySelector('.check-circle');
                    if (selectedIds.has(idStr)) {
                        selectedIds.delete(idStr);
                        card.className = card.className.replace('bg-yellow-50 border-yellow-400 shadow-md', 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm');
                        checkCircle.classList.replace('bg-yellow-500', 'bg-gray-100');
                        checkCircle.classList.replace('text-white', 'text-transparent');
                        checkCircle.classList.replace('scale-100', 'scale-90');
                        
                        if (currentFilter === 'selected') {
                            card.style.display = 'none'; // Berehala ezkutatu
                        }
                    } else {
                        selectedIds.add(idStr);
                        card.className = card.className.replace('bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm', 'bg-yellow-50 border-yellow-400 shadow-md');
                        checkCircle.classList.replace('bg-gray-100', 'bg-yellow-500');
                        checkCircle.classList.replace('text-transparent', 'text-white');
                        checkCircle.classList.replace('scale-90', 'scale-100');
                    }
                    
                    // UI eguneratu
                    const count = selectedIds.size;
                    selectedCountSpan.textContent = count;
                    finishBtn.innerHTML = `Gorde (${count})`;
                    
                    // Botoiaren testua ere eguneratu behar da parentesia aldatzeko
                    const filterBtn = document.getElementById('filterSelectedBtn');
                    if(filterBtn) filterBtn.innerHTML = `<i class="fas fa-check-circle mr-1"></i> Hautatuak (${count})`;
                };
                grid.appendChild(card);
            });
            container.appendChild(section);
        });
    };

    renderFilters();
    renderContent();

    searchInput.addEventListener('input', (e) => { currentSearch = e.target.value; renderContent(); });
    const closeModal = () => { modal.style.opacity = '0'; setTimeout(() => modal.remove(), 200); };
    content.querySelector('#closeProjModal').onclick = closeModal;
    content.querySelector('#cancelProj').onclick = closeModal;

    finishBtn.onclick = async () => {
        finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
        finishBtn.disabled = true;
        try {
            const newSelection = Array.from(selectedIds).map(id => {
                const item = catalog.find(c => String(c.id) === String(id));
                return item ? { id: item.id, name: item.name, range: item.range, type: item.type } : null;
            }).filter(Boolean);

            subject.content.externalProjects = newSelection;
            const { error } = await this.supabase.from('irakasgaiak').update({ content: subject.content, updated_at: new Date().toISOString() }).eq('id', subject.id);
            if (error) throw error;

            closeModal();
            if (window.ui && typeof window.ui.renderSubjectDetail === 'function') window.ui.renderSubjectDetail(subject, this.currentDegree);
            else window.location.reload();
        } catch (error) {
            console.error("❌ Errorea:", error);
            alert("Errorea: " + error.message);
            finishBtn.innerHTML = 'Saiatu berriro';
            finishBtn.disabled = false;
        }
    };
    
    setTimeout(() => searchInput.focus(), 50);
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
            // Soporte para datos viejos y nuevos (content)
            const ctx = this.currentSubject.content || {};
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

async saveListEditor() {
    // 1. TRANPA KONPONDUTA: Orria ez da birkargatuko ustekabean
    /*if (event) event.preventDefault(); */

    if (!this.currentEditingField) return;
    
    const fieldName = this.currentEditingField;
    const isDegree = this.isEditingDegree;
    const modal = document.getElementById('listEditorModal');
    const saveBtn = modal?.querySelector('#saveListBtn');

    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
        saveBtn.disabled = true;
    }

    console.log(`💾 Guardando lista "${fieldName}" en ${isDegree ? 'GRADUA' : 'IRAKASGAIA'}`);
    
    try {
        const inputs = document.querySelectorAll('.list-item-input');
        const newList = Array.from(inputs).map(i => i.value.trim()).filter(v => v);
        
        if (newList.length === 0) {
            throw new Error('Gutxienez elementu bat gehitu behar duzu.');
        }

        if (isDegree) {
            this.currentDegree[fieldName] = newList;
            window.ui?.renderSidebar?.(this.currentDegree);
            // Graduentzat saveData zaharrak funtzionatu dezake
            if (this.saveData) await this.saveData(); 
        } else {
            if (!this.currentSubject) {
                throw new Error('Ez dago aukeratutako irakasgairik');
            }
            
			// ✨ KRITIKOA: Content prestatu eta ERROKO DATUAK GORDE
            if (!this.currentSubject.content) this.currentSubject.content = {};
            
            // ✅ ZURE KONPONBIDEA: Erreskatea BETI egin, sinkronizazioa ez galtzeko
            ['preReq', 'signAct', 'extProy', 'idujar', 'detailODS', 'unitateak', 
             'currentOfficialRAs', 'zhRAs', 'subjectCritEval', 'matrizAlineacion',
             'matrizAsignatura', 'ganttPlanifikazioa'].forEach(key => {
                if (this.currentSubject[key] !== undefined) {
                    this.currentSubject.content[key] = this.currentSubject[key];
                }
            });
            
            // Eguneratu soilik eremu hau
            this.currentSubject.content[fieldName] = newList;
            this.currentSubject[fieldName] = newList; // UI-rako

            window.ui?.renderSubjectDetail?.(this.currentSubject, this.currentDegree);
            
            console.log("💾 saveSubject deitzen listEditor-etik...");
            await this.saveSubject(this.currentSubject);
        }
        
        if (this.showNotification) {
            this.showNotification(`${fieldName} gorde da!`, 'success');
        }
        
        if (modal) {
            modal.classList.add('hidden');
            this.currentEditingField = null;
            this.isEditingDegree = false;
        }
        
    } catch (error) {
        console.error("❌ Error al guardar:", error);
        this.showNotification?.(`Errorea: ${error.message}`, 'error') || alert(`❌ Errorea: ${error.message}`);
    } finally {
        if (saveBtn) {
            saveBtn.innerHTML = 'Gorde Aldaketak';
            saveBtn.disabled = false;
        }
    }
}

_setupSaveButtonRaw(modal) {
    const btn = modal.querySelector('button[onclick*="saveListEditor"]');
    btn.onclick = () => this.saveListEditor(); // Ez klonatu!
    return btn;
}	
	
// ----------------------------------------------------------------------
    // 2. EDITOR DE RA DE ASIGNATURA (MODAL)
    // ----------------------------------------------------------------------
openRaEditor() {
		if (!this.currentSubject) return;
		
		const modal = document.getElementById('raModal');
		const container = document.getElementById('detailRasListEdit'); 
		
		if (!modal || !container) {
			console.error("❌ Ez da 'raModal' edo 'detailRasListEdit' aurkitu.");
			return;
		}

		console.log("✏️ RA Editorea irekitzen:", 
		    this.currentSubject.subjectTitle || 
		    this.currentSubject.name || 
		    this.currentSubject.title || 
		    "Izenik gabe"
		);

		// 1. IRTEERAKO KONPETENTZIAK PRESTATU (Selektorerako)
		let comps = this.currentDegree?.competencies?.egreso || [];
		if ((!comps || comps.length === 0) && this.currentDegree?.konpetentziak?.irteera) {
			comps = this.currentDegree.konpetentziak.irteera;
		}

		this.tempEgresoComps = [...comps].sort((a, b) => {
			const codeA = a.autoCode || a.code || '';
			const codeB = b.autoCode || b.code || '';
			return codeA.localeCompare(codeB);
		});

		// 2. HTML EGITURA
		container.innerHTML = `
			<div class="grid grid-cols-2 gap-4 h-full">
				<div class="flex flex-col border rounded-lg overflow-hidden bg-white shadow-sm h-full">
					<div class="bg-blue-50 p-3 border-b border-blue-100 flex justify-between items-center shrink-0">
						<span class="font-bold text-xs text-blue-800 uppercase tracking-wider">
							<i class="fas fa-cogs mr-1"></i> Emaitza Teknikoak (RA)
						</span>
					</div>
					<div id="editListTec" class="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 relative custom-scrollbar"></div>
					<button onclick="window.gradosManager.addRaRow('tec')" 
						class="p-3 text-xs text-blue-600 hover:bg-blue-50 font-bold border-t flex justify-center gap-2">
						<i class="fas fa-plus-circle"></i> Gehitu RA Teknikoa
					</button>
				</div>

				<div class="flex flex-col border rounded-lg overflow-hidden bg-white shadow-sm h-full">
					<div class="bg-teal-50 p-3 border-b border-teal-100 flex justify-between items-center shrink-0">
						<span class="font-bold text-xs text-teal-800 uppercase tracking-wider">
							<i class="fas fa-users mr-1"></i> Zeharkakoak (ZH)
						</span>
						<button onclick="window.gradosManager.agregarZHDelCatalogo()" 
							class="text-[10px] bg-teal-600 text-white px-2 py-1 rounded">Katalogoa</button>
					</div>
					<div id="editListZh" class="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 relative custom-scrollbar"></div>
					<button onclick="window.gradosManager.addRaRow('zh')" 
						class="p-3 text-xs text-teal-600 hover:bg-teal-50 font-bold border-t flex justify-center gap-2">
						<i class="fas fa-plus-circle"></i> Gehitu ZH Berria
					</button>
				</div>
			</div>`;

		// 3. DATUAK KARGATU
		// Oharra: Zure JSON egituraren arabera kargatzen dugu
		const listTec = document.getElementById('editListTec');
		const listZh = document.getElementById('editListZh');

		// A) RA TEKNIKOAK (currentOfficialRAs)
		const tecs = this.currentSubject.currentOfficialRAs || [];
		if (tecs.length > 0) {
			tecs.forEach(ra => this.addRaRow('tec', ra));
		} else {
			listTec.innerHTML = `<div class="text-center p-4 text-gray-400 text-xs italic empty-msg">Ez dago emaitza teknikorik.</div>`;
		}

		// B) ZEHARKAKOAK (zhRAs)
		// Zure JSONean "zhRAs" agertzen da, beraz hori irakurtzen dugu.
		const zhs = this.currentSubject.zhRAs || [];
		if (zhs.length > 0) {
			zhs.forEach(zh => this.addRaRow('zh', zh));
		} else {
			listZh.innerHTML = `<div class="text-center p-4 text-gray-400 text-xs italic empty-msg">Ez dago zeharkako konpetentziarik.</div>`;
		}
		
		modal.classList.remove('hidden');
	}
		
    // ----------------------------------------------------------------------
    // 3. GUARDADO DEL EDITOR (CRUCIAL: IMPORTA CRITERIOS DEL CAT¨¢LOGO)

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

    // DATUAK IRAKURTZEA
    let codeValue = '';
    let descValue = '';
    
    if (isZh) {
        codeValue = data.zhCode || '';
        descValue = data.zhDesc || '';
    } else {
        codeValue = data.raCode  || '';
        descValue = data.raDesc || '';
    }
    
    const linkedValue = data.linkedCompetency || data.raRelacionado || '';

    if (!codeValue) {
        const count = container.children.length + 1;
        const suffix = isZh ? 'ZH' : 'RA';
        codeValue = `${suffix}${count}`; 
    }

    // --- SELEKTOREA: Kodea + testuaren hasiera (moztuta) ---
    let options = '<option value="">-- Lotura gabe --</option>';
    if (this.tempEgresoComps && this.tempEgresoComps.length > 0) {
        options += this.tempEgresoComps.map(c => {
            const cCode = c.code || c.autoCode || '';
            const rawText = c.text || c.desc || c.description || c.title || ''; 
            const title = c.title || c.name || '';
            
            // Testuaren hasiera (60 karaktere) moztuta
            const shortText = rawText.length > 60 ? rawText.substring(0, 60) + '...' : rawText;
            
            const selected = (String(linkedValue) === String(cCode)) ? 'selected' : '';
            
            // Kodea + testuaren hasiera erakusten dugu
            // Eta data atributuetan testu osoa gordetzen dugu bokadiloan erakusteko
            return `<option value="${cCode}" ${selected} 
                    data-fulltext="${rawText.replace(/"/g, '&quot;')}"
                    data-title="${title.replace(/"/g, '&quot;')}">
                    ${cCode} - ${shortText}
            </option>`;
        }).join('');
    }

    // HTML Sortu
    const div = document.createElement('div');
    div.className = `ra-row flex gap-2 items-start bg-white p-2 rounded border border-${colorClass}-200 mb-2 shadow-sm`;
    
    // Sortu ID bakarra infoDiv-rako
    const infoId = `info-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    div.innerHTML = `
        <div class="flex flex-col gap-1 w-24 shrink-0">
            <input type="text" 
                class="ra-code w-full p-1 border rounded text-[10px] font-bold text-${colorClass}-700 text-center uppercase" 
                value="${codeValue}" 
                placeholder="KODEA">
        </div>
        <div class="flex-1 flex flex-col gap-1">
            <div class="relative">
                <textarea 
                    class="ra-desc w-full text-xs p-1.5 border rounded min-h-[40px] pr-8 focus:ring-1 focus:ring-${colorClass}-300 outline-none" 
                    placeholder="Deskribapena..." 
                    rows="2">${descValue}</textarea>
                <button type="button" 
                        onclick="this.previousElementSibling.rows = this.previousElementSibling.rows === 2 ? 4 : 2"
                        class="absolute right-1 top-1 text-gray-400 hover:text-gray-600 bg-white rounded p-0.5 shadow-sm border border-gray-200 w-5 h-5 flex items-center justify-center">
                    <i class="fas fa-expand-alt text-xs"></i>
                </button>
            </div>
            
            <!-- SELEKTOREA - Kodea + testuaren hasiera erakusten du -->
            <select class="ra-link w-full text-xs p-1.5 border rounded bg-gray-50 text-gray-700">
                ${options}
            </select>
            
            <!-- BOKADILO EREMUA - Hemen testu osoa erakutsiko da -->
            <div id="${infoId}" class="relative group hidden mt-1">
                <div class="px-2 py-1 rounded border text-[10px] font-bold cursor-help transition bg-purple-100 text-purple-700 border-purple-200 inline-flex items-center gap-1">
                    <i class="fas fa-info-circle text-[10px]"></i>
                    <span class="selected-code"></span>
                    <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-slate-800 text-white text-[9px] font-normal leading-tight rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] pointer-events-none">
                        <div class="font-black border-b border-slate-600 mb-1 pb-1 uppercase text-blue-300">
                            <span class="selected-title"></span>
                        </div>
                        <div class="whitespace-normal selected-description max-h-32 overflow-y-auto"></div>
                        <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-800 rotate-45"></div>
                    </div>
                </div>
            </div>
        </div>
        <button onclick="this.closest('.ra-row').remove()" class="text-gray-300 hover:text-red-500 px-1 self-start mt-1">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;

    container.appendChild(div);

    // --- EVENT LISTENER-a gehitu selektor-ean ---
    const selector = div.querySelector('.ra-link');
    const infoDiv = div.querySelector(`#${infoId}`);
    const selectedCodeSpan = infoDiv.querySelector('.selected-code');
    const selectedTitleSpan = infoDiv.querySelector('.selected-title');
    const selectedDescSpan = infoDiv.querySelector('.selected-description');
    
    selector.addEventListener('change', function(e) {
        const selectedOption = this.options[this.selectedIndex];
        const selectedValue = this.value;
        
        if (selectedValue && selectedOption.dataset) {
            const code = selectedValue;
            const fullText = selectedOption.dataset.fulltext || '';
            const title = selectedOption.dataset.title || code;
            
            // Eguneratu bokadiloaren edukia TESTU OSOarekin
            selectedCodeSpan.textContent = code;
            selectedTitleSpan.textContent = code + ' - ' + (title.split(' ')[0] || 'Konpetentzia');
            selectedDescSpan.textContent = fullText; // TESTU OSOA hemen!
            
            // Erakutsi bokadiloaren eremua
            infoDiv.classList.remove('hidden');
            
            // Animazio txiki bat
            infoDiv.classList.add('animate-pulse');
            setTimeout(() => infoDiv.classList.remove('animate-pulse'), 300);
        } else {
            // Ezkutatu bokadiloa baliorik ez badago
            infoDiv.classList.add('hidden');
        }
    });
    
    // Konfiguratu hasierako balioa existitzen bada
    if (linkedValue) {
        const options = Array.from(selector.options);
        const matchingOption = options.find(opt => opt.value === linkedValue);
        
        if (matchingOption) {
            selector.value = linkedValue;
            
            // Trigger change event-a hasierako informazioa erakusteko
            const event = new Event('change', { bubbles: true });
            selector.dispatchEvent(event);
        }
    }
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
    
    // 🎯 ALDAKETA: Erabili generateUnitAutoCode logika berdina
    // ---------------------------------------------------------
    let basePrefix = '';
    
    // 1. Grado kodea
    const grado = subject.degreeCode || "BD";
    
    // 2. Urtea (curso)
    const curso = subject.course || subject.year || "1";
    
    // 3. Irakasgaiaren izena - ERROMATAR ZENBAKIA ATERATZEKO (generateUnitAutoCode logika)
    const rawName = subject.name || subject.subjectTitle || "ASIG";
    
    // Erromatar zenbakiak arabiarretara bihurtzeko mapa
    const romanToArabic = {
        'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
        'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10'
    };
    
    let romanNumber = "";
    let baseName = "";
    
    // Bilatu erromatar zenbakia izenaren amaieran (generateUnitAutoCode logika)
    Object.keys(romanToArabic).forEach(roman => {
        const regex = new RegExp(`\\s+${roman}(\\s|$)`, 'gi');
        const match = rawName.match(regex);
        
        if (match) {
            romanNumber = roman;
            baseName = rawName.replace(regex, '').trim();
        }
    });
    
    // Ez bada erromatar zenbakia aurkitu, bilatu arabiar zenbakia
    if (!romanNumber) {
        const arabicMatch = rawName.match(/\s+(\d+)(\s|$)/);
        if (arabicMatch) {
            romanNumber = arabicMatch[1];
            baseName = rawName.replace(/\s+\d+(\s|$)/, '').trim();
        } else {
            baseName = rawName.trim();
        }
    }
    
    // Erromatar zenbakia arabiarrera bihurtu
    let numberCode = "";
    if (romanNumber) {
        if (romanToArabic[romanNumber.toUpperCase()]) {
            numberCode = romanToArabic[romanNumber.toUpperCase()];
        } else {
            numberCode = romanNumber; // Jada arabiar zenbakia bada
        }
    }
    
    // Akronimoa sortu (3 letra) - generateUnitAutoCode berdina
    const cleanName = baseName.replace(/[0-9\.\s]/g, '').toUpperCase();
    const acronimo = cleanName.substring(0, 3).padEnd(3, 'X');
    
    // 🎯 PREFIXO BERRIA: generateUnitAutoCode-ren antzekoa
    if (numberCode && numberCode !== "") {
        basePrefix = `${grado}${curso}_${numberCode}${acronimo}`;
    } else {
        basePrefix = `${grado}${curso}_${acronimo}`;
    }
    // ---------------------------------------------------------
    
    // Normalizar RAs t¨¦cnicos (hau mantendu)
    tecRAs.forEach((ra, index) => {
        if (ra.code && !ra.code.startsWith(basePrefix)) {
            const match = ra.code.match(/(RA|ZH)(\d+)$/);
            if (match) {
                const tipo = "RA";
                const numero = match[2] || String(index + 1).padStart(2, '0');
                ra.code = `${basePrefix}_${tipo}${numero}`;
                ra.id = ra.code;
            } else {
                ra.code = `${basePrefix}_RA${String(index + 1).padStart(2, '0')}`;
                ra.id = ra.code;
            }
        }
    });
    
    // Normalizar RAs transversales (ZH) (hau mantendu)
    zhRAs.forEach((zh, index) => {
        if (zh.code && !zh.code.startsWith(basePrefix)) {
            const match = zh.code.match(/(RA|ZH)(\d+)$/);
            if (match) {
                const tipo = "ZH";
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
	
async saveRaChanges() {
    const s = this.currentSubject;
    if (!s) return;

    console.log("💾 RA aldaketak gordetzen (KONPONBIDEA 2.0)...");

    // 1. RA eta ZH berriak irakurri
    const tecRows = document.querySelectorAll('#editListTec .ra-row');
    const newRAs = Array.from(tecRows).map(row => {
        const code = row.querySelector('.ra-code')?.value.trim() || '';
        const desc = row.querySelector('.ra-desc')?.value.trim() || '';
        const linked = row.querySelector('.ra-link')?.value || '';
        return { raCode: code, raDesc: desc, linkedCompetency: linked };
    }).filter(r => r.raDesc);

    const zhRows = document.querySelectorAll('#editListZh .ra-row');
    const newZHs = Array.from(zhRows).map(row => {
        const code = row.querySelector('.ra-code')?.value.trim() || '';
        const desc = row.querySelector('.ra-desc')?.value.trim() || '';
        const linked = row.querySelector('.ra-link')?.value || '';
        return { type: 'zh', zhCode: code, zhDesc: desc, linkedCompetency: linked };
    }).filter(r => r.zhDesc);

    // 2. SEGURTASUNA: Content prestatu
    if (!s.content) s.content = {};

    // 3. ERRESKATEA: Erroan dauden datuak content-era pasatu
    // Hau ezinbestekoa da saveSubject-ek 'content' objektua lehenesteko
    ['preReq', 'signAct', 'extProy', 'idujar', 'detailODS', 'unitateak','calendarConfig','currentOfficialRAs','zhRAs', 'subjectCritEval', 'matrizAlineacion','matrizAsignatura','ganttPlanifikazioa'].forEach(key => {
        if (s[key] !== undefined && !s.content[key]) {
            console.log(`♻️ Erreskatatzen: ${key}`, s[key]?.length || 1);
            s.content[key] = s[key];
        }
    });

	
    // 4. EGUNERATU RA eta ZH content barruan
    s.content.currentOfficialRAs = newRAs;
    s.content.zhRAs = newZHs;

    // 5. Erroa ere sinkronizatu (UI-rako)
    s.currentOfficialRAs = newRAs;
    s.zhRAs = newZHs;

    // 6. Gorde
    try {
        if (this.saveSubject) {
            await this.saveSubject(s);
        }
        const modal = document.getElementById('raModal');
        if (modal) modal.classList.add('hidden');
    } catch (error) {
        console.error("❌ Errorea:", error);
        alert("Errorea: " + error.message);
    }
}



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
    if (!this.currentSubject || !this.currentDegree) {
        alert("Irakasgai edo gradu bat hautatu behar duzu lehenik.");
        return;
    }

    console.log("📚 Aurre-ezagutzen editorea:", this.currentSubject.subjectTitle);

    // 1. Modal setup
    const modal = document.getElementById('listEditorModal');
    const container = document.getElementById('listEditorContainer');
    const titleEl = document.getElementById('listEditorTitle');
    const inputTop = document.getElementById('newItemInput')?.parentElement;
    
    if (inputTop) inputTop.classList.add('hidden');
    if (titleEl) {
        titleEl.innerHTML = `
            <i class="fas fa-layer-group mr-2 text-indigo-500"></i>
            Aurre-ezagutzak - ${this.currentSubject.subjectTitle}
        `;
    }

    // 2. Datuak kargatu
    let localList = [];
    try {
        localList = JSON.parse(JSON.stringify(
            this.currentSubject.content?.preReq || this.currentSubject.preReq || []
        ));
    } catch (e) {
        console.warn("❌ preReq datuak kargatzean errorea:", e);
        localList = [];
    }

    // 3. Eremuen koloreak lortu
    const getAreaColors = () => {
        const colors = {};
        
        // Graduko eremuak
        if (this.currentDegree?.subjectAreas) {
            this.currentDegree.subjectAreas.forEach(area => {
                if (area?.name) {
                    colors[area.name] = area.color || 'hsl(0, 0%, 70%)';
                }
            });
        }
        
        // Subject-eko eremuak
        const subjectAreas = this.currentSubject.content?.areas || [];
        subjectAreas.forEach(area => {
            if (area?.name) {
                colors[area.name] = area.color || colors[area.name] || 'hsl(0, 0%, 70%)';
            }
        });
        
        return colors;
    };

    const areaColors = getAreaColors();
    const areaNames = Object.keys(areaColors).sort((a, b) => a.localeCompare(b, 'eu'));

    // 4. Kodea sortzeko helper
    const generateCode = (index) => {
        const subjectCode = this.currentSubject.subjectCode || 
                          this.currentSubject.code || 
                          'ASIG';
        // Ziurtatu subjectCode string bat dela
        const codeString = String(subjectCode);
        const cleanCode = codeString.replace(/[^A-Z0-9]/g, '').substring(0, 6);
        const seq = String(index + 1).padStart(2, '0');
        return `PR-${cleanCode}-${seq}`;
    };

    // 5. Render function
    const renderEditor = () => {
        // A. Aurre-prozesaketa: Ziurtatu denek kodea dutela HTML sortu aurretik
        localList.forEach((item, index) => {
            if (!item.code) {
                item.code = generateCode(index);
            }
        });

        // B. HTML Sortu
        container.innerHTML = `
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-gray-800">Aurre-ezagutzak</h4>
                        <p class="text-xs text-gray-500">
                            Definitu irakasgai hau ikasteko beharrezkoak diren aurretiko ezagutzak
                        </p>
                    </div>
                    <button id="btnAddPreReq" 
                            class="text-sm bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 font-bold flex items-center gap-2 transition-colors">
                        <i class="fas fa-plus"></i> Gehitu
                    </button>
                </div>
                
                ${areaNames.length > 0 ? `
                    <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                        <div class="flex items-center justify-between">
                            <div class="text-sm text-indigo-800">
                                <i class="fas fa-palette mr-2"></i>
                                <span class="font-bold">${areaNames.length}</span> eremu eskuragarri
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div class="flex items-start gap-3">
                            <i class="fas fa-exclamation-triangle text-yellow-500 text-lg mt-0.5"></i>
                            <div class="text-sm">
                                <p class="font-bold text-yellow-800 mb-1">Ez daude eremuak definituak</p>
                                <p class="text-yellow-700">
                                    Eremuak lehenik definitu behar dira graduan edo irakasgaian.
                                </p>
                            </div>
                        </div>
                    </div>
                `}
                
                <div class="border rounded-lg overflow-hidden bg-white shadow-sm">
                    <div class="grid grid-cols-12 gap-2 p-3 bg-gray-50 border-b text-xs font-bold text-gray-600 uppercase tracking-wider">
                        <div class="col-span-3">Kodea</div>
                        <div class="col-span-5">Deskribapena</div>
                        <div class="col-span-3">Eremua</div>
                        <div class="col-span-1"></div>
                    </div>
                    
                    <div id="preReqList" class="max-h-[50vh] overflow-y-auto">
                        ${localList.length === 0 ? `
                            <div class="text-center py-10 text-gray-400">
                                <i class="fas fa-inbox text-3xl mb-3"></i>
                                <p>Ez dago aurre-ezagutzarik</p>
                                <p class="text-sm mt-1">Erabili "Gehitu" botoia lehenengoa sortzeko</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        const listContainer = document.getElementById('preReqList');
        
        // C. Gehitu botoiaren Listener-a (HEMEN barruan)
        document.getElementById('btnAddPreReq').addEventListener('click', () => {
            // Sortu berria kodearekin
            localList.push({
                code: generateCode(localList.length),
                name: '',
                area: '',
                color: '#94a3b8'
            });
            renderEditor();
            
            // Fokua jarri
            setTimeout(() => {
                const inputs = listContainer.querySelectorAll('.field-name');
                if(inputs.length > 0) inputs[inputs.length - 1].focus();
            }, 100);
        });

        // D. Zerrendako elementuak marraztu
        if (localList.length > 0) {
            localList.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = 'grid grid-cols-12 gap-2 p-3 border-b hover:bg-gray-50 items-center group';
                
                // Kolorea lortu
                const areaColor = areaColors[item.area] || item.color || '#94a3b8';
                
                row.innerHTML = `
                    <div class="col-span-3">
                        <input type="text"
                               class="w-full text-xs font-mono bg-gray-100 text-gray-600 border border-gray-300 rounded px-2 py-1.5 outline-none cursor-not-allowed"
                               value="${item.code || ''}" 
                               readonly
                               title="Kode automatikoa">
                    </div>
                    
                    <div class="col-span-5">
                        <input type="text"
                               class="w-full text-sm border-b border-gray-300 focus:border-indigo-500 outline-none px-1 py-1.5 field-name bg-transparent"
                               value="${item.name || ''}"
                               placeholder="Deskribapena..."
                               data-index="${index}">
                    </div>
                    
                    <div class="col-span-3">
                        <div class="flex items-center gap-2">
                            <select class="w-full text-sm border-b border-gray-300 focus:border-indigo-500 outline-none px-1 py-1.5 field-area cursor-pointer bg-transparent"
                                    data-index="${index}"
                                    style="border-left: 3px solid ${areaColor}">
                                <option value="">Aukeratu...</option>
                                ${areaNames.map(name => `
                                    <option value="${name}" ${name === item.area ? 'selected' : ''}>${name}</option>
                                `).join('')}
                            </select>
                            
                            <div class="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0 shadow-sm transition-colors" 
                                 style="background-color: ${areaColor}"
                                 title="${item.area || 'Eremurik gabe'}"></div>
                        </div>
                    </div>
                    
                    <div class="col-span-1 text-center">
                        <button class="text-gray-400 hover:text-red-500 p-1 rounded delete-btn opacity-0 group-hover:opacity-100 transition-opacity"
                                data-index="${index}"
                                title="Ezabatu">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                listContainer.appendChild(row);
                
                // Event listeners
                const nameInput = row.querySelector('.field-name');
                const areaInput = row.querySelector('.field-area');
                const deleteBtn = row.querySelector('.delete-btn');
                const colorDot = row.querySelector('.w-4.h-4');
                
                nameInput.addEventListener('input', (e) => {
                    localList[index].name = e.target.value;
                });
                
                areaInput.addEventListener('change', (e) => {
                    const newArea = e.target.value;
                    localList[index].area = newArea;
                    
                    // Kolorea eguneratu
                    const newColor = areaColors[newArea] || '#94a3b8';
                    localList[index].color = newColor;
                    
                    // UI eguneratu berehala
                    e.target.style.borderLeftColor = newColor;
                    colorDot.style.backgroundColor = newColor;
                });
                
                deleteBtn.addEventListener('click', () => {
                    if (confirm("Ziur zaude aurre-ezagutza hau ezabatu nahi duzula?")) {
                        localList.splice(index, 1);
                        renderEditor(); // Honek kodeak birkalkulatuko ditu sekuentzia mantentzeko
                    }
                });
            });
        }
    };

    // 6. Gorde botoia
    const saveBtn = this.saveListEditor();
    saveBtn.onclick = async () => {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
        saveBtn.disabled = true;
        
        try {
            // 1. Filtroak
            const filteredList = localList.filter(item => 
                item.name && item.name.trim() && item.area && item.area.trim()
            );
            
            // Nahiz eta zerrenda hutsa izan, gordetzen utzi behar dugu (ezabatu nahi baditu)
            if (localList.length > 0 && filteredList.length === 0) {
                 alert("Mesedez, bete eremu guztiak (izena eta eremua) edo ezabatu lerro hutsak.");
                 saveBtn.innerHTML = 'Gorde';
                 saveBtn.disabled = false;
                 return;
            }
            
            // 2. Eguneratu subject.content
            if (!this.currentSubject.content) {
                this.currentSubject.content = {};
            }
            this.currentSubject.content.preReq = filteredList;
            
            // 3. Supabase eguneratu
            const { error } = await this.supabase
                .from('irakasgaiak')
                .update({ 
                    content: this.currentSubject.content,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentSubject.id);
            
            if (error) throw error;
            
            // 4. UI eguneratu
            if (window.ui && window.ui.renderSubjectDetail) {
                window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
            }
            
            // 5. Modal itxi
            modal.classList.add('hidden');
            
            // 6. Feedback
            console.log(`✅ ${filteredList.length} aurre-ezagutza gorde dira`);
            alert(`✅ ${filteredList.length} aurre-ezagutza gorde dira!`);
            
        } catch (error) {
            console.error('❌ Errorea aurre-ezagutza gordetzean:', error);
            alert(`Errorea gordetzean: ${error.message}`);
        } finally {
            saveBtn.innerHTML = 'Gorde';
            saveBtn.disabled = false;
        }
    };

    // Hasieratu
    renderEditor();
    modal.classList.remove('hidden');
}
		
openSignActEditor() {
    if (!this.currentSubject) {
        alert("Irakasgai bat hautatu behar duzu.");
        return;
    }

    console.log("⭐ Jarduera esanguratsuen editorea:", this.currentSubject.subjectTitle);

    // 1. Modal setup
    const modal = document.getElementById('listEditorModal');
    const container = document.getElementById('listEditorContainer');
    const titleEl = document.getElementById('listEditorTitle');
    const inputTop = document.getElementById('newItemInput')?.parentElement;
    
    if (inputTop) inputTop.classList.add('hidden');
    if (titleEl) {
        titleEl.innerHTML = `
            <i class="fas fa-star mr-2 text-purple-500"></i>
            Jarduera Esanguratsuak - ${this.currentSubject.subjectTitle}
        `;
    }

    // 2. Datuak kargatu
    let localList = [];
    try {
        localList = JSON.parse(JSON.stringify(
            this.currentSubject.content?.signAct || this.currentSubject.signAct || []
        ));
    } catch (e) {
        console.warn("❌ signAct datuak kargatzean errorea:", e);
        localList = [];
    }

    // 3. Proiektu katalogoaren datuak
    const projectsCatalog = this.adminCatalogs.externalProjects || [];
    
    // Mapa: type -> color
    const typeColorMap = {};
    const agentsSet = new Set();
    const typesSet = new Set();
    
    projectsCatalog.forEach(proj => {
        if (proj.type) {
            typesSet.add(proj.type);
            if (proj.color) {
                typeColorMap[proj.type] = proj.color;
            }
        }
        if (proj.agent) {
            agentsSet.add(proj.agent);
        }
    });
    
    const allAgents = [...agentsSet].sort();
    const allTypes = [...typesSet].sort();

    // 4. Render function
    const renderEditor = () => {
        // HTML Egitura nagusia
        container.innerHTML = `
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-gray-800">Jarduera Esanguratsuak</h4>
                        <p class="text-xs text-gray-500">
                            Definitu irakasgai honetan burutuko diren jarduera bereziak
                        </p>
                    </div>
                    
                    <div class="flex items-center gap-3">
                        <select id="quickAgentSelect" 
                                class="text-xs border border-purple-300 rounded px-3 py-1 bg-white cursor-pointer outline-none focus:border-purple-500">
                            <option value="">Agente azkarra...</option>
                            ${allAgents.map(agent => `<option value="${agent}">${agent}</option>`).join('')}
                        </select>
                        
                        <select id="quickTypeSelect" 
                                class="text-xs border border-purple-300 rounded px-3 py-1 bg-white cursor-pointer outline-none focus:border-purple-500">
                            <option value="">Mota azkarra...</option>
                            ${allTypes.map(type => `<option value="${type}">${type}</option>`).join('')}
                        </select>
                        
                        <button id="btnAddSignAct" 
                                class="text-sm bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 font-bold flex items-center gap-2 transition-colors">
                            <i class="fas fa-plus"></i> Gehitu
                        </button>
                    </div>
                </div>
                
                <div class="border rounded-lg overflow-hidden bg-white shadow-sm">
                    <div class="grid grid-cols-12 gap-2 p-3 bg-gray-50 border-b text-xs font-bold text-gray-600 uppercase tracking-wider">
                        <div class="col-span-4">Jarduera</div>
                        <div class="col-span-3">Agentea</div>
                        <div class="col-span-3">Mota</div>
                        <div class="col-span-2">Kolorea</div>
                    </div>
                    
                    <div id="signActList" class="max-h-[50vh] overflow-y-auto">
                        ${localList.length === 0 ? `
                            <div class="text-center py-10 text-gray-400">
                                <i class="fas fa-clipboard-list text-3xl mb-3"></i>
                                <p>Ez dago jarduerarik</p>
                                <p class="text-sm mt-1">Erabili "Gehitu" botoia lehenengoa sortzeko</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        const listContainer = document.getElementById('signActList');

        // --- LISTENERS ---
        
        // A. Gehitu Botoia (HEMEN egon behar du, elementua sortu berria delako)
        document.getElementById('btnAddSignAct').addEventListener('click', () => {
            localList.push({
                name: '',
                agent: '',
                type: '',
                color: '#94a3b8'
            });
            renderEditor();
            
            // Fokoa azken elementuan jarri
            setTimeout(() => {
                const lastInput = listContainer.querySelector('.field-name:last-child'); // CSS selector doitu dut
                // Edo seguruago:
                const inputs = listContainer.querySelectorAll('.field-name');
                if(inputs.length > 0) inputs[inputs.length - 1].focus();
            }, 100);
        });

        // B. Quick Agent Select
        const quickAgentSelect = document.getElementById('quickAgentSelect');
        quickAgentSelect.addEventListener('change', function() {
            if (this.value && localList.length > 0) {
                const lastIndex = localList.length - 1;
                // Zuzenean datuak eguneratu eta renderizatu
                localList[lastIndex].agent = this.value;
                renderEditor();
                console.log(`✅ Agente "${this.value}" gehitu da azken jarduerari`);
            }
        });
        
        // C. Quick Type Select
        const quickTypeSelect = document.getElementById('quickTypeSelect');
        quickTypeSelect.addEventListener('change', function() {
            if (this.value && localList.length > 0) {
                const lastIndex = localList.length - 1;
                localList[lastIndex].type = this.value;
                // Kolorea ere automatikoki eguneratu
                if (typeColorMap[this.value]) {
                    localList[lastIndex].color = typeColorMap[this.value];
                }
                renderEditor();
                console.log(`✅ Mota "${this.value}" gehitu da azken jarduerari`);
            }
        });

        // D. Zerrendako elementuak marraztu eta haien listener-ak
        if (localList.length > 0) {
            // listContainer.innerHTML = ''; // Hau ez da beharrezkoa container nagusia birsortu dugulako goian

            localList.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = 'grid grid-cols-12 gap-2 p-3 border-b hover:bg-gray-50 items-center group transition-colors';
                
                // Kolorea kalkulatu
                let displayColor = item.color || '#94a3b8';
                if (!item.color && item.type && typeColorMap[item.type]) {
                    displayColor = typeColorMap[item.type];
                }
                
                row.innerHTML = `
                    <div class="col-span-4">
                        <input type="text"
                               class="w-full text-sm border-b border-gray-300 focus:border-purple-500 outline-none px-1 py-1.5 field-name bg-transparent"
                               value="${item.name || ''}"
                               placeholder="Jardueraren izena..."
                               data-index="${index}">
                    </div>
                    
                    <div class="col-span-3">
                        <select class="w-full text-sm border-b border-gray-300 focus:border-purple-500 outline-none px-1 py-1.5 field-agent cursor-pointer bg-transparent"
                                data-index="${index}">
                            <option value="">Aukeratu...</option>
                            ${allAgents.map(agent => `
                                <option value="${agent}" ${agent === item.agent ? 'selected' : ''}>${agent}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="col-span-3">
                        <div class="flex items-center gap-2">
                            <select class="w-full text-sm border-b border-gray-300 focus:border-purple-500 outline-none px-1 py-1.5 field-type cursor-pointer bg-transparent"
                                    data-index="${index}">
                                <option value="">Aukeratu...</option>
                                ${allTypes.map(type => `
                                    <option value="${type}" ${type === item.type ? 'selected' : ''}>${type}</option>
                                `).join('')}
                            </select>
                            <div class="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0 shadow-sm" 
                                 style="background-color: ${displayColor}"
                                 title="Kolorea"></div>
                        </div>
                    </div>
                    
                    <div class="col-span-2">
                        <div class="flex items-center gap-2">
                            <input type="color"
                                   class="w-8 h-8 p-0 border border-gray-300 rounded cursor-pointer field-color"
                                   value="${displayColor}"
                                   data-index="${index}"
                                   title="Aldatu kolorea">
                            <button class="text-gray-400 hover:text-red-500 p-1 rounded delete-btn opacity-0 group-hover:opacity-100 transition-opacity"
                                    data-index="${index}"
                                    title="Ezabatu">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
                
                listContainer.appendChild(row);
                
                // Elementuen event listeners
                const nameInput = row.querySelector('.field-name');
                const agentInput = row.querySelector('.field-agent');
                const typeInput = row.querySelector('.field-type');
                const colorInput = row.querySelector('.field-color');
                const colorPreview = row.querySelector('.w-4.h-4');
                const deleteBtn = row.querySelector('.delete-btn');
                
                const updateItem = () => {
                    localList[index] = {
                        name: nameInput.value,
                        agent: agentInput.value,
                        type: typeInput.value,
                        color: colorInput.value
                    };
                };
                
                nameInput.addEventListener('input', updateItem);
                agentInput.addEventListener('change', updateItem);
                
                typeInput.addEventListener('change', (e) => {
                    // Mota aldatzean, saiatu kolorea eguneratzen mapatik
                    const newType = e.target.value;
                    if (newType && typeColorMap[newType]) {
                        const newColor = typeColorMap[newType];
                        colorInput.value = newColor;
                        colorPreview.style.backgroundColor = newColor;
                    }
                    updateItem();
                });
                
                colorInput.addEventListener('input', (e) => {
                    colorPreview.style.backgroundColor = e.target.value;
                    updateItem();
                });
                
                deleteBtn.addEventListener('click', () => {
                    if (confirm("Ziur zaude jarduera hau ezabatu nahi duzula?")) {
                        localList.splice(index, 1);
                        renderEditor();
                    }
                });
            });
        }
    };

    // 5. Gorde botoia
    const saveBtn = this._setupSaveButtonRaw(modal);
    saveBtn.onclick = async () => {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gordetzen...';
        saveBtn.disabled = true;
        
        try {
            // 1. Filtroak (izena ez dutenak kendu)
            const filteredList = localList.filter(item => 
                item.name && item.name.trim()
            );
            
            // Nahiz eta zerrenda hutsa izan, agian erabiltzaileak guztiak ezabatu nahi ditu,
            // beraz, ez dut return egiten 0 bada, baizik eta array hutsa gordetzen uzten dut.
            // Baina abisua eman nahi baduzu:
            /*
            if (filteredList.length === 0 && localList.length > 0) {
                 alert("Mesedez, jarri izena jarduerari.");
                 saveBtn.innerHTML = 'Gorde';
                 saveBtn.disabled = false;
                 return;
            }
            */
            
            // 2. Eguneratu subject.content
            if (!this.currentSubject.content) {
                this.currentSubject.content = {};
            }
            this.currentSubject.content.signAct = filteredList;
            
            // 3. Supabase eguneratu
            const { error } = await this.supabase
                .from('irakasgaiak')
                .update({ 
                    content: this.currentSubject.content,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentSubject.id);
            
            if (error) throw error;
            
            // 4. UI eguneratu
            if (window.ui && window.ui.renderSubjectDetail) {
                window.ui.renderSubjectDetail(this.currentSubject, this.currentDegree);
            }
            
            // 5. Modal itxi
            modal.classList.add('hidden');
            
            // 6. Feedback
            console.log(`✅ ${filteredList.length} jarduera esanguratsu gorde dira`);
            alert(`✅ ${filteredList.length} jarduera esanguratsu gorde dira!`);
            
        } catch (error) {
            console.error('❌ Errorea jarduerak gordetzean:', error);
            alert(`Errorea gordetzean: ${error.message}`);
        } finally {
            saveBtn.innerHTML = 'Gorde';
            saveBtn.disabled = false;
        }
    };

    // Hasieratu
    renderEditor();
    modal.classList.remove('hidden');
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
    
    // 1. Grado kodea
    const grado = this.currentDegree?.code || subj.degreeCode || "BD";
    
    // 2. Urtea (curso) - Soilik zenbakia
    const curso = subj.course || subj.year || "1";
    
    // 3. Seihilekoa (semester) - EZIKUSI EGIN, ez sartu kodean
    // const periodoRaw = subj.term || subj.semester || "1"; // <-- Ez erabili
    
    // 4. Irakasgaiaren izena - ERROMATAR ZENBAKIA ATERATZEKO
    const rawName = subj.name || subj.subjectTitle || subj.title || "ASIG";
    
    // Erromatar zenbakiak arabiarretara bihurtzeko mapa
    const romanToArabic = {
        'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
        'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10'
    };
    
    let romanNumber = "";
    let baseName = "";
    
    // Bilatu erromatar zenbakia izenaren amaieran
    Object.keys(romanToArabic).forEach(roman => {
        // "Proiektuak III" edo "Proiektuak III " formatua
        const regex = new RegExp(`\\s+${roman}(\\s|$)`, 'gi');
        const match = rawName.match(regex);
        
        if (match) {
            romanNumber = roman;
            // Kendu erromatar zenbakia izenetik
            baseName = rawName.replace(regex, '').trim();
        }
    });
    
    // Ez bada erromatar zenbakia aurkitu, bilatu arabiar zenbakia
    if (!romanNumber) {
        const arabicMatch = rawName.match(/\s+(\d+)(\s|$)/);
        if (arabicMatch) {
            romanNumber = arabicMatch[1];
            baseName = rawName.replace(/\s+\d+(\s|$)/, '').trim();
        } else {
            baseName = rawName.trim();
        }
    }
    
    // Erromatar zenbakia arabiarrera bihurtu
    let numberCode = "";
    if (romanNumber) {
        if (romanToArabic[romanNumber.toUpperCase()]) {
            numberCode = romanToArabic[romanNumber.toUpperCase()];
        } else {
            numberCode = romanNumber; // Jada arabiar zenbakia bada
        }
    }
    
    // Akronimoa sortu (3 letra)
    const cleanName = baseName.replace(/[0-9\.\s]/g, '').toUpperCase();
    const acronimo = cleanName.substring(0, 3).padEnd(3, 'X');
    
    // 5. Sekuentzia
    const secuencia = String(index + 1).padStart(2, '0');
    
    // 6. Kodea osatu: BD1_3PRO_UD01 (erromatar zenbakia bigarren zatian)
    if (numberCode && numberCode !== "") {
        return `${grado}${curso}_${numberCode}${acronimo}_UD${secuencia}`;
    } else {
        return `${grado}${curso}_${acronimo}_UD${secuencia}`;
    }
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
					descriptores: descriptors
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








































































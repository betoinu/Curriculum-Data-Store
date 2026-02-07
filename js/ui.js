// js/ui.js - VERSIÓN FINAL OPTIMIZADA
export const ui = {
    // --- 1. GESTIÓN DEL SIDEBAR ---
	toggleSidebarSection: (id) => {
			const el = document.getElementById(id);
			// Busca el botón que tenga el onclick apuntando a este ID
			// Nota: Si cambias el HTML a ui.toggle..., asegúrate de actualizar esto o usar un ID directo
			const btn = document.querySelector(`button[onclick*="${id}"]`); 
			const icon = btn ? btn.querySelector('.fa-chevron-down') : null;
			
			if (el) {
				const isHidden = el.classList.contains('hidden');
				el.classList.toggle('hidden');
				if (icon) {
					// Rotación manual vs Clase Tailwind (Ambas valen, esta es manual)
					icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
				}
			}
		},

// En ui.js

    renderSidebar: (degree) => {
        if (!degree) return;

        // A. NAVEGACIÓN POR AÑOS
        const yearNav = document.getElementById('yearNavigation');
        if (yearNav) {
            yearNav.innerHTML = '';
            const cursos = [1, 2, 3, 4];
            
            cursos.forEach(yearNum => {
                const itemContainer = document.createElement('div');
                itemContainer.className = 'mb-1';

                const btn = document.createElement('button');
				btn.setAttribute('data-year', yearNum);
                btn.className = 'w-full text-left px-3 py-2 rounded text-slate-300 hover:bg-slate-800 hover:text-white transition flex items-center justify-between group';
                
                const isActive = window.gradosManager && window.gradosManager.currentYear == yearNum;
                if (isActive) btn.classList.add('bg-indigo-600', 'text-white');

                const spanTexto = document.createElement('span');
                spanTexto.innerHTML = `<i class="fas fa-calendar-alt mr-2 ${isActive ? '' : 'opacity-50'}"></i> ${yearNum}. Maila`;
                spanTexto.onclick = (e) => {
                    e.stopPropagation();
                    if(window.gradosManager) window.gradosManager.selectYear(yearNum);
                };
                
                const btnAdd = document.createElement('span');
                btnAdd.className = 'text-xs bg-slate-700 hover:bg-indigo-500 text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition cursor-pointer';
                btnAdd.innerHTML = '<i class="fas fa-plus"></i>';
                //btnAdd.title = "Gehitu irakasgaia maila honetan";
                btnAdd.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if(window.gradosManager) window.gradosManager.crearNuevaAsignatura(yearNum);
                };

                btn.appendChild(spanTexto);
                btn.appendChild(btnAdd);
                btn.onclick = () => window.gradosManager && window.gradosManager.selectYear(yearNum);
                yearNav.appendChild(btn);
            });
        }

        // B. ÁREAS (EZAGUTZA EREMUAK)
        const areasContainer = document.getElementById('areasListContainer');
        if (areasContainer) {
            areasContainer.innerHTML = '';
            const areas = degree.subjectAreas || [];
            
            areas.forEach(area => {
                const div = document.createElement('div');
                div.className = 'flex items-center justify-between group mb-1 hover:bg-slate-800/50 rounded pr-1 transition-colors';
                const safeName = encodeURIComponent(area.name);
                div.innerHTML = `
					<div class="flex items-center gap-2 overflow-hidden py-1 pl-1">
						<div class="w-3 h-3 rounded-full shadow-sm flex-shrink-0" style="background-color: ${area.color}"></div>
						<span class="text-xs text-slate-400 truncate select-none">${area.name}</span>
					</div>
					<button onclick="window.editSubjectArea('${safeName}')" class="text-slate-500 opacity-0 group-hover:opacity-100 hover:text-white transition-all transform hover:scale-110 px-2">
						<i class="fas fa-pencil-alt text-[10px]"></i>
					</button>
                `;
                areasContainer.appendChild(div);
            });
        }

        // C. COMPETENCIAS
        // Aseguramos que renderSimpleList exista o usamos lógica inline si falla
        if (ui.renderSimpleList) {
            ui.renderSimpleList('sarreraCompList', degree.konpetentziak?.sarrera);
            ui.renderSimpleList('irteeraCompList', degree.konpetentziak?.irteera);
        }

        // D. LISTADOS GLOBALES (ODS, IDU, PROYECTOS) - ¡NUEVO!
        const renderListHelper = (containerId, items, emptyText) => {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            if (!items || !items.length) {
                container.innerHTML = `<div class="text-slate-500 italic text-xs pl-2">- ${emptyText} -</div>`;
            } else {
                container.innerHTML = items.map(item => 
                    `<div class="pl-2 border-l-2 border-slate-700 hover:border-indigo-500 hover:text-white transition cursor-default text-xs mb-1 text-slate-300 overflow-hidden text-ellipsis">
                        ${item}
                    </div>`
                ).join('');
            }
        };

        renderListHelper('odsSidebarList', degree.ods, 'Ez daude');
        renderListHelper('iduSidebarList', degree.idu, 'Ez daude');
	
	// E. PROYECTOS EXTERNOS EN SIDEBAR (CON FILTROS)
	const extContainer = document.getElementById('extSidebarList');
	if (extContainer) {
		// Función para obtener el agente (con fallbacks)
		const getAgentInfo = (proyecto) => {
			if (!proyecto) return 'Agente ezezaguna';
			if (proyecto.agent && proyecto.agent.trim() !== '') return proyecto.agent;
			if (proyecto.coordinator && proyecto.coordinator.trim() !== '') {
				const coord = proyecto.coordinator.split('/')[0].split(',')[0].trim();
				return `Coord: ${coord}`;
			}
			if (proyecto.program && proyecto.program.trim() !== '') return proyecto.program;
			
			const nombre = proyecto.name || '';
			if (nombre.includes(' - ')) {
				const partes = nombre.split(' - ');
				if (partes.length > 1) return partes[0].trim();
			}
			if (nombre.includes(':')) {
				const partes = nombre.split(':');
				if (partes.length > 1) return partes[0].trim();
			}
			if (proyecto.specialty) return proyecto.specialty;
			return 'Colaboración externa';
		};

		// Obtener proyectos
		const proyectos = window.gradosManager?.adminCatalogs?.externalProjects || [];
		
		if (proyectos.length === 0) {
			extContainer.innerHTML = '<div class="text-slate-400 text-xs p-3">No hay proyectos</div>';
		} else {
			// Crear HTML con filtros
			extContainer.innerHTML = `
				<div class="mb-4">
					<!-- TÍTULO Y CONTADOR -->
					<div class="flex justify-between items-center mb-3">
						<div class="text-xs font-bold text-white">Proyectos Externos</div>
						<div class="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
							${proyectos.length} total
						</div>
					</div>
					
					<!-- FILTROS -->
					<div class="mb-3 p-2 bg-slate-800/40 rounded border border-slate-700">
						<div class="mb-2">
							<label class="text-[10px] text-slate-400 block mb-1">Buscar:</label>
							<input type="text" id="filterProyectos" 
								   class="w-full bg-slate-900 border border-slate-600 text-xs text-white rounded px-2 py-1.5 focus:border-indigo-500 outline-none" 
								   placeholder="Nombre, agente o tipo...">
						</div>
						
						<div>
							<label class="text-[10px] text-slate-400 block mb-1">Filtrar por tipo:</label>
							<select id="filterTipo" 
									class="w-full bg-slate-900 border border-slate-600 text-xs text-white rounded px-2 py-1.5 focus:border-indigo-500 outline-none cursor-pointer">
								<option value="">Todos los tipos</option>
								${[...new Set(proyectos.map(p => p.type).filter(Boolean))]
									.sort()
									.map(tipo => `<option value="${tipo}">${tipo}</option>`)
									.join('')}
							</select>
						</div>
						
						<div class="flex justify-between items-center mt-2">
							<div class="text-[10px] text-slate-400">
								Mostrando: <span id="contadorProyectos" class="text-white">${proyectos.length}</span>
							</div>
							<button id="limpiarFiltros" 
									class="text-[10px] text-slate-400 hover:text-white transition">
								Limpiar filtros
							</button>
						</div>
					</div>
					
					<!-- LISTA DE PROYECTOS -->
					<div id="listaProyectos" class="space-y-2 max-h-80 overflow-y-auto pr-1"></div>
				</div>
			`;
			
			// Rellenar la lista inicialmente
			const listaProyectos = document.getElementById('listaProyectos');
			const renderLista = (proyectosFiltrados = proyectos) => {
				if (proyectosFiltrados.length === 0) {
					listaProyectos.innerHTML = `
						<div class="text-center p-4 border border-dashed border-slate-700 rounded">
							<div class="text-slate-400 text-xs">No hay resultados</div>
							<div class="text-[10px] text-slate-500 mt-1">Prueba con otro filtro</div>
						</div>`;
					return;
				}
				
				listaProyectos.innerHTML = proyectosFiltrados.map((p, index) => {
					const color = p.color || '#64748b';
					const agente = getAgentInfo(p);
					
					return `
						<div class="pl-3 border-l-4 py-2 hover:bg-slate-800/50 rounded-r transition cursor-pointer group proyecto-item"
							 style="border-left-color: ${color}"
							 data-name="${p.name.toLowerCase()}"
							 data-agent="${agente.toLowerCase()}"
							 data-type="${(p.type || '').toLowerCase()}">
							
							<!-- AGENTE -->
							<div class="text-[10px] font-bold text-white uppercase truncate flex items-center">
								<div class="w-2 h-2 rounded-full mr-2" style="background: ${color}"></div>
								<span class="truncate">${agente}</span>
							</div>
							
							<!-- NOMBRE -->
							<div class="text-xs text-slate-300 truncate mt-1">
								${p.name}
							</div>
							
							<!-- TIPO Y ACCIONES -->
							<div class="flex justify-between items-center mt-1">
								<span class="text-[9px] text-slate-500 italic">
									${p.type || ''}
								</span>
								<div class="opacity-0 group-hover:opacity-100 transition-opacity">
									<button class="text-[8px] text-slate-400 hover:text-white" title="Ver detalles">
										<i class="fas fa-eye"></i>
									</button>
								</div>
							</div>
						</div>`;
				}).join('');
			};
			
			// Renderizar lista inicial
			renderLista();
			
			// Obtener elementos de filtro
			const filterInput = document.getElementById('filterProyectos');
			const filterTipo = document.getElementById('filterTipo');
			const limpiarFiltros = document.getElementById('limpiarFiltros');
			const contador = document.getElementById('contadorProyectos');
			
			// Función para aplicar filtros
			const aplicarFiltros = () => {
				const textoFiltro = filterInput.value.toLowerCase();
				const tipoFiltro = filterTipo.value.toLowerCase();
				
				const proyectosFiltrados = proyectos.filter(p => {
					const agente = getAgentInfo(p).toLowerCase();
					const nombre = p.name.toLowerCase();
					const tipo = (p.type || '').toLowerCase();
					
					// Filtrar por texto
					const coincideTexto = textoFiltro === '' || 
										 nombre.includes(textoFiltro) || 
										 agente.includes(textoFiltro) || 
										 tipo.includes(textoFiltro);
					
					// Filtrar por tipo
					const coincideTipo = tipoFiltro === '' || tipo === tipoFiltro;
					
					return coincideTexto && coincideTipo;
				});
				
				// Actualizar contador
				contador.textContent = proyectosFiltrados.length;
				
				// Renderizar lista filtrada
				renderLista(proyectosFiltrados);
			};
			
			// Event listeners para filtros
			filterInput.addEventListener('input', aplicarFiltros);
			filterTipo.addEventListener('change', aplicarFiltros);
			
			// Limpiar filtros
			limpiarFiltros.addEventListener('click', () => {
				filterInput.value = '';
				filterTipo.value = '';
				aplicarFiltros();
			});
			
			// Añadir funcionalidad de clic a los proyectos
			listaProyectos.addEventListener('click', (e) => {
				const proyectoItem = e.target.closest('.proyecto-item');
				if (proyectoItem) {
					// Aquí puedes agregar lo que pasa al hacer clic en un proyecto
					console.log('Proyecto clickeado:', proyectoItem);
					// Por ejemplo: mostrar detalles, añadir a asignatura, etc.
				}
			});
		}
	}
},

    renderSimpleList: (elementId, items) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.innerHTML = '';
        if (!items || items.length === 0) {
            el.innerHTML = '<li class="text-[10px] text-slate-600 italic py-1">Hutsik</li>';
            return;
        }
        items.slice(0, 5).forEach(item => {
            el.innerHTML += `<li class="truncate py-0.5 text-xs text-slate-400 hover:text-white cursor-help" title="${item.desc}">• ${item.desc}</li>`;
        });
    },
	
    // Función genérica para pintar listas de checkboxes
    renderChecklistSelector: (containerId, options, selectedValues, inputName) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!options || options.length === 0) {
            container.innerHTML = '<p class="text-xs text-slate-400 italic py-2">- Ez dago aukerarik definituta Graduan -</p>';
            return;
        }

        // Generamos el HTML
        container.innerHTML = options.map(item => {
            // Verificamos si está seleccionado
            const isChecked = selectedValues && selectedValues.includes(item) ? 'checked' : '';
            
            // Creamos el HTML del checkbox
            return `
                <label class="flex items-start gap-2 p-1.5 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded cursor-pointer transition-colors mb-1">
                    <input type="checkbox" name="${inputName}" value="${item}" ${isChecked} class="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300">
                    <span class="text-xs text-slate-700 leading-tight select-none">${item}</span>
                </label>
            `;
        }).join('');
    },	

		// --- 2. VISTA DE AÑO ---
renderYearView: (degree, yearNum) => {
        console.log(`🎨 UI: ${yearNum}. maila marrazten...`);

        // 1. PANELAK KUDEATU
        // Reset sinplea: denak ezkutatu, gurea erakutsi.
        ['emptyState', 'subjectDetailView'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        const viewContainer = document.getElementById('yearView');
        if (viewContainer) {
            viewContainer.classList.remove('hidden');
            // HEMEN ZEGOEN ERROREA: Ez jarri style.display = 'block'.
            // Utzi Tailwind-i bere lana egiten.
        } else {
            console.error("❌ 'yearView' ez da aurkitu");
            return;
        }

        // Izenburua eguneratu
        const pageTitle = document.getElementById('yearTitle');
        if (pageTitle) pageTitle.textContent = `${yearNum}. Maila - ${degree.selectedDegree || degree.name}`;

        // 2. GRID EDUKIONTZIA
        const container = document.getElementById('subjectsGrid');
        if (!container) return;
        container.innerHTML = '';

        // 3. DATUAK IRAGAZI
        const subjects = (degree.subjects || []).filter(s => String(s.year) === String(yearNum));

        if (subjects.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <p class="text-gray-500 text-lg">Ez dago irakasgairik ${yearNum}. mailan.</p>
                </div>`;
            return;
        }

        // 4. TXARTELAK SORTU
        subjects.forEach((subj) => {
            const areaColor = ui.getAreaColor ? ui.getAreaColor(subj.subjectArea, degree) : '#ccc';
            const code = subj.subjectCode || subj.code || '---';
            const subjTitle = subj.subjectTitle || subj.name || 'Izena gabe'; 
            const credits = subj.subjectCredits || subj.credits || 0;
            
            // Datu berriak (Semester & Language)
            const semester = subj.semester ? `${subj.semester}.S` : '';
            const lang = subj.language || ''; 
            
            // Hizkuntza txarteltxoa
            let langBadge = '';
            if (lang === 'eu') langBadge = '<span class="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">EU</span>';
            else if (lang === 'es') langBadge = '<span class="text-[10px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-100 px-1.5 py-0.5 rounded">ES</span>';
            else if (lang === 'en') langBadge = '<span class="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded">EN</span>';
            else if (lang) langBadge = `<span class="text-[10px] text-gray-500 bg-gray-100 px-1 rounded">${lang}</span>`;

            const card = document.createElement('div');
            card.className = 'group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 cursor-pointer border-l-4 h-full flex flex-col justify-between relative';
            card.style.borderLeftColor = areaColor;
            
            card.innerHTML = `
                <div class="h-full flex flex-col gap-2">
                    <div class="flex justify-between items-start">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono">${code}</span>
                            ${semester ? `<span class="text-[10px] text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded">${semester}</span>` : ''}
                        </div>
                        <span class="text-[10px] font-bold text-white px-2 py-1 rounded min-w-[45px] text-center shadow-sm" style="background-color: ${areaColor}">
                            ${credits} EC
                        </span>
                    </div>
                    
                    <h3 class="text-sm font-bold text-gray-800 leading-tight line-clamp-3">${subjTitle}</h3>
                    
                    <div>${langBadge}</div>

                    <div class="mt-auto pt-2 border-t border-gray-50">
                        <p class="text-[11px] text-gray-400 truncate" title="${subj.subjectArea || ''}">
                            ${subj.subjectArea || 'Eremu gabe'}
                        </p>
                    </div>
                </div>
            `;
            
            card.onclick = (e) => {
                e.preventDefault();
                if (window.gradosManager && window.gradosManager.selectSubject) {
                    window.gradosManager.selectSubject(subj);
                }
            };
            container.appendChild(card);
        });
    },

	
	// ✅ MANTÉN ESTA FUNCIÓN IGUAL - NO LA CAMBIES
	renderListContent: (container, list) => {
		// 1. Seguridad: si no hay contenedor, no hacemos nada
		if (!container) return;

		// 2. Limpieza
		container.innerHTML = '';

		// 3. Si está vacío o es nulo
		if (!list || list.length === 0) {
			container.innerHTML = `<div class="text-xs text-gray-400 italic pl-1">- Ez dago daturik -</div>`;
			return;
		}
		
		// 4. Aseguramos que sea un array (por si llega un string suelto)
		const items = Array.isArray(list) ? list : [list];

		// 5. Renderizado inteligente (Maneja texto simple y objetos)
		container.innerHTML = items.map(item => {
			// Si el item es un objeto (ej: {code: 'ODS1', name: 'Pobreza'}), sacamos el nombre. Si es texto, lo dejamos igual.
			const text = (typeof item === 'object' && item !== null) 
				? (item.name || item.code || JSON.stringify(item)) 
				: item;

			return `
				<div class="flex items-start gap-2 mb-1 text-sm text-slate-600">
					<i class="fas fa-check text-indigo-500 mt-1 text-[10px] shrink-0"></i> 
					<span class="leading-snug">${text}</span>
				</div>
			`;
		}).join('');
	},
	
    // --- 3. DETALLE DE ASIGNATURA ---
renderSubjectDetail: async (subject, degree) => {
        if (!subject) return;
		// =========================================================
        // 1. BISTAK KUDEATU (Hemen dago gakoa)
        // =========================================================
        
        // 1.1. Grid-a EZKUTATU (Bortxaz)
        const yearViewPanel = document.getElementById('yearView');
        if (yearViewPanel) {
            yearViewPanel.classList.add('hidden');
            yearViewPanel.style.display = 'none'; // 👈 HAU GEHITU BEHAR DA
            // 'none' jartzeak aurreko 'block' estiloa baliogabetzen du.
        }

        // 1.2. Xehetasunak ERAKUTSI
        const detailView = document.getElementById('subjectDetailView');
        if (detailView) {
            detailView.classList.remove('hidden');
            // detailView.style.display = 'block'; // Aukerakoa, baina lagungarria izan daiteke
        }
        // =========================================================
        // 1. HASIERAKETA ETA BAIMENAK
        // =========================================================
        const supabase = window.supabase;
        const { data: { user } } = await supabase.auth.getUser();
        const saveBtn = document.getElementById('saveSubjectBtn');
        const detailHeader = document.getElementById('subjectDetailView');
        
        let hasPermission = false;
        let warningDiv = document.getElementById('permission-warning');

        // Baimen logika
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            if (profile?.role === 'admin') hasPermission = true;
            else {
                const { data: link } = await supabase.from('irakasle_irakasgaiak').select('id').eq('user_id', user.id).eq('idAsig', subject.idAsig).single();
                if (link) hasPermission = true;
            }
        }

        // UI egokitu
        if (!hasPermission) {
            if (saveBtn) saveBtn.style.display = 'none';
            if (!warningDiv) {
                warningDiv = document.createElement('div');
                warningDiv.id = 'permission-warning';
                warningDiv.className = "bg-amber-50 border-l-4 border-amber-400 p-3 mb-4 flex items-center gap-3 shadow-sm rounded-r";
                detailHeader.prepend(warningDiv);
            }
            warningDiv.innerHTML = `<div><p class="text-sm font-bold text-amber-800 italic">Irakurtzeko soilik</p></div>`;
        } else {
            if (saveBtn) saveBtn.style.display = 'block';
            if (warningDiv) warningDiv.remove();
            if (window.gradosManager) {
                window.gradosManager.currentSubject = subject;
                window.gradosManager.currentRowId = subject.idAsig;
            }
        }

        console.log("--> Renderizando Detalle:", subject.subjectTitle || subject.name);
        document.getElementById('yearView')?.classList.add('hidden');
        document.getElementById('subjectDetailView')?.classList.remove('hidden');

        // =========================================================
        // 2. HELPER BLINDATUA ETA ADIMENDUA (Hybrid Data Fix)
        // =========================================================
        const resolveData = (item, catalog = []) => {
            if (!item) return null;
            
            // Bilaketarako gakoa prestatzen dugu (Id edo Kodea izan daiteke)
            let searchKey = null;
            let itemObj = {};

            // A) Objektua bada
            if (typeof item === 'object') {
                itemObj = item;
                // Objektuaren IDa edo Kodea bilatzen dugu katalogoan bilatzeko
                searchKey = String(item.id || item.code || item.odsCode || item.iduCode || '').trim().toLowerCase();
            } 
            // B) String/Zenbakia bada
            else {
                searchKey = String(item).trim().toLowerCase();
                itemObj = { id: item }; // Objektu minimoa sortu
            }

            // KATALOGOAN BILATU (Match oso malgua)
            const foundInCatalog = catalog.find(c => {
                const cId = String(c.id || '').trim().toLowerCase();
                const cCode = String(c.code || '').trim().toLowerCase();
                const cOdsCode = String(c.odsCode || '').trim().toLowerCase();
                
                // 1. Zuzeneko kointzidentzia
                if (cId === searchKey) return true;
                if (cCode === searchKey) return true;
                if (cOdsCode === searchKey) return true;

                // 2. "Fuzzy" kointzidentzia (Zenbakia bakarrik)
                // Adib: "ODS-08" vs "8" vs "ODS-8"
                const cleanSearch = searchKey.replace(/\D/g, ''); // Bakarrik zenbakiak
                const cleanCatId = cId.replace(/\D/g, '');
                const cleanCatCode = cCode.replace(/\D/g, '') || cOdsCode.replace(/\D/g, '');

                if (cleanSearch && (cleanSearch === cleanCatId || cleanSearch === cleanCatCode)) return true;
                
                return false;
            });

            // ESTRATEGIA KONBINATUA:
            if (foundInCatalog) {
                return {
                    ...foundInCatalog, // Lehenetsi katalogoa
                    ...itemObj,        // Gainidatzi item-aren datu espezifikoekin
                    color: foundInCatalog.color || itemObj.color, 
                    agent: foundInCatalog.agent || itemObj.agent,
                    name: foundInCatalog.name || itemObj.name || itemObj.description
                };
            }

            // Ez bada katalogoan aurkitu, daukaguna itzuli txukunduta
            return {
                id: itemObj.id || searchKey,
                name: itemObj.name || itemObj.description || itemObj.desc || searchKey,
                color: itemObj.color || '#9ca3af', // Grisa defektuz
                agent: itemObj.agent || '',
                type: itemObj.type || '',
                range: itemObj.range || '',
                code: itemObj.code || itemObj.odsCode || itemObj.iduCode || searchKey
            };
        };

        // =========================================================
        // 3. OINARRIZKO DATUAK
        // =========================================================
        const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        setText('detailSubjectCode', subject.subjectCode || subject.code || '-');
        setText('detailSubjectTitle', subject.subjectTitle || subject.name || 'Izena gabe');
        setText('detailCredits', `${subject.subjectCredits || subject.credits || 0} ECTS`);

        const areaColor = window.ui ? window.ui.getAreaColor(subject.subjectArea, degree) : '#666';
        const badge = document.getElementById('detailSubjectArea');
        if (badge) {
            badge.textContent = subject.subjectArea || 'Eremu gabe';
            badge.style.backgroundColor = areaColor;
            badge.style.color = '#fff';
        }
        const colorBar = document.getElementById('subjectColorBar');
        if(colorBar) colorBar.style.backgroundColor = areaColor;

        // =========================================================
        // 4. PRE-REQUISITOS
        // =========================================================
        const preReqContainer = document.getElementById('detailPreReq');
        if (preReqContainer) {
            preReqContainer.innerHTML = '';
            const list = subject.preReq || [];
            if (list.length === 0) {
                preReqContainer.innerHTML = '<div class="text-xs text-gray-400 italic">Ez dago aurre-ezagutzarik zehaztuta.</div>';
            } else {
                list.forEach(item => {
                    const isObj = typeof item === 'object';
                    const name = isObj ? item.name : item;
                    const reqCode = isObj ? (item.preReqCode || item.reqCode || '') : '';
                    const area = isObj ? (item.area || '') : '';
                    const color = isObj ? (item.color || '#9ca3af') : '#9ca3af';

                    preReqContainer.innerHTML += `
                        <div class="flex items-center text-sm p-2 bg-slate-50 border border-slate-100 rounded mb-1 hover:bg-white hover:shadow-sm transition" style="border-left: 3px solid ${color};">
                            ${reqCode ? `<span class="font-mono text-xs font-bold text-slate-500 mr-2 bg-slate-200 px-1 rounded">${reqCode}</span>` : ''}
                            <span class="text-slate-700 font-medium flex-1">${name}</span>
                            ${area ? `<span class="text-[10px] uppercase font-bold text-slate-400 ml-2 tracking-wide">${area}</span>` : ''}
                        </div>`;
                });
            }
        }

        // =========================================================
        // 5. JARDUERA ESANGURATSUAK
        // =========================================================
        const signActContainer = document.getElementById('detailSignAct');
        if (signActContainer) {
            signActContainer.innerHTML = '';
            const list = subject.signAct || [];
            if (list.length === 0) {
                signActContainer.innerHTML = '<div class="text-xs text-gray-400 italic">Ez dago jarduerarik zehaztuta.</div>';
            } else {
                list.forEach(act => {
                    const isObj = typeof act === 'object';
                    const name = isObj ? act.name : act;
                    const agent = isObj ? (act.agent || '') : '';
                    const type = isObj ? (act.type || '') : '';
                    const color = isObj ? (act.color || '#6366f1') : '#9ca3af';

                    signActContainer.innerHTML += `
                        <div class="flex items-center gap-3 p-2 bg-white border-l-4 rounded shadow-sm mb-1" style="border-left-color: ${color};">
                            ${agent ? 
                                `<div class="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style="background-color: ${color}"><i class="fas fa-star"></i></div>` : 
                                '<i class="fas fa-circle text-[6px] text-gray-300 ml-1"></i>'}
                            <div class="min-w-0 flex-1">
                                ${agent ? `<div class="text-[9px] font-bold text-gray-400 uppercase leading-none mb-0.5">${agent}</div>` : ''}
                                <div class="text-xs font-bold text-gray-700 leading-tight">${name}</div>
                            </div>
                            ${type ? `<div class="text-[9px] text-gray-400 italic bg-gray-50 px-1 rounded">${type}</div>` : ''}
                        </div>`;
                });
            }
        }

        // =========================================================
        // 6. KANPO PROIEKTUAK (ExtProy)
        // =========================================================
        const projContainer = document.getElementById('detailExtProy');
        if (projContainer) {
            projContainer.innerHTML = '';
            // ⚠️ ALDAKETA: Context begiratu lehenengo
            const list = subject.context?.externalProjects || subject.extProy || [];
            const catalog = (window.gradosManager && window.gradosManager.adminCatalogs && window.gradosManager.adminCatalogs.externalProjects) ? window.gradosManager.adminCatalogs.externalProjects : [];

            if (list.length === 0) {
                projContainer.innerHTML = '<span class="text-xs text-gray-400 italic">Ez da kanpo proiekturik zehaztu.</span>';
            } else {
                projContainer.className = "grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2";
                list.forEach(item => {
                    const data = resolveData(item, catalog);
                    if (!data) return;

                    const color = data.color || '#fdba74';
                    const agent = data.agent || 'Agente ezezaguna';
                    const name = data.name || 'Izena falta da';

                    projContainer.innerHTML += `
                        <div class="flex items-center gap-3 p-3 rounded-lg border-l-4 bg-white shadow hover:shadow-md transition w-full group" style="border-left-color: ${color}">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style="background-color: ${color}">
                                <i class="fas fa-building"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="text-xs font-bold text-gray-500 uppercase tracking-wider truncate group-hover:text-gray-700 transition">${agent}</p>
                                <p class="text-sm font-bold text-gray-800 truncate mt-1">${name}</p>
                            </div>
                        </div>`;
                });
            }
        }

        // =========================================================
        // 7. IDU JARRAIBIDEAK (Idujar)
        // =========================================================
        const iduContainer = document.getElementById('detailIdujar');
        if (iduContainer) {
            iduContainer.innerHTML = '';
            // ⚠️ ALDAKETA: Context begiratu lehenengo
            const list = subject.context?.iduGuidelines || subject.idujar || [];
            const catalog = (window.gradosManager && window.gradosManager.adminCatalogs && window.gradosManager.adminCatalogs.iduGuidelines) ? window.gradosManager.adminCatalogs.iduGuidelines : [];

            if (list.length === 0) {
                iduContainer.innerHTML = '<span class="text-xs text-gray-400 italic">Ez da IDU jarraibiderik zehaztu.</span>';
            } else {
                iduContainer.className = "flex flex-wrap gap-2 mt-1";
                list.forEach(item => {
                    const data = resolveData(item, catalog);
                    
                    const rawCode = data.code || data.iduCode || (typeof item === 'string' ? item : '');
                    const cleanCode = rawCode.replace(/IDU-|idu-/gi, '').trim();
                    const range = data.range || '';
                    
                    let styleClass = 'bg-gray-100 text-gray-600 border-gray-200';
                    if (range.includes('EKINTZA')) styleClass = 'bg-blue-100 text-blue-700 border-blue-200';
                    if (range.includes('INPLIKAZIOA')) styleClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                    if (range.includes('IRUDIKAPENA')) styleClass = 'bg-purple-100 text-purple-700 border-purple-200';

                    iduContainer.innerHTML += `
                        <div class="relative group px-2 py-1 rounded border text-[10px] font-bold cursor-help transition ${styleClass}">
                            ${cleanCode}
                            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-slate-800 text-white text-[9px] font-normal leading-tight rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] pointer-events-none">
                                <div class="font-black border-b border-slate-600 mb-1 pb-1 uppercase text-blue-300">${range}</div>
                                <div class="whitespace-normal">${data.name}</div>
                                <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-800 rotate-45"></div>
                            </div>
                        </div>`;
                });
            }
        }

// =========================================================
        // 8. ODS (ODS) - 08.png FIX
        // =========================================================
        const odsContainer = document.getElementById('detailOdsList');
        if (odsContainer) {
            odsContainer.innerHTML = '';
            
            const list = subject.detailODS || subject.ods || [];
            const catalog = (window.gradosManager && window.gradosManager.adminCatalogs && window.gradosManager.adminCatalogs.ods) ? window.gradosManager.adminCatalogs.ods : [];

            // 🔧 Funtzio honek beti 2 digitu itzuliko ditu (1 -> "01", 8 -> "08")
            const getOdsImageUrl = (num) => {
                const n = String(num).replace(/\D/g, '').padStart(2, '0'); 
                return `assets/ods/${n}.png`;
            };

            const fallbackColors = { 
                '1': '#E5243B', '2': '#DDA63A', '3': '#4C9F38', '4': '#C5192D', 
                '5': '#FF3A21', '6': '#26BDE2', '7': '#FCC30B', '8': '#A21942', 
                '9': '#FD6925', '10': '#DD1367', '11': '#FD9D24', '12': '#BF8B2E', 
                '13': '#3F7E44', '14': '#0A97D9', '15': '#56C02B', '16': '#00689D', 
                '17': '#19486A' 
            };

            if (list.length === 0) {
                odsContainer.innerHTML = '<span class="text-xs text-gray-400 italic">Ez da ODSrik zehaztu.</span>';
            } else {
                list.forEach(item => {
                    const data = typeof resolveData !== 'undefined' 
                        ? resolveData(item, catalog) 
                        : (catalog.find(c => c.code === item.code) || item);
                    
                    const rawCode = data.code || data.odsCode || (typeof item === 'string' ? item : '');
                    // Zenbaki garbia atera (String bezala)
                    const num = rawCode ? rawCode.replace(/ODS-|ods-/gi, '').replace(/^0+/, '').trim() : '?'; 
                    
                    const finalColor = data.color || fallbackColors[num] || '#9ca3af';
                    const imageUrl = getOdsImageUrl(num); // Honek "08.png" bilatuko du

                    odsContainer.innerHTML += `
                        <div class="relative group w-10 h-10 rounded shadow-sm cursor-help transition transform hover:scale-110 shrink-0 bg-white">
                            <img src="${imageUrl}" 
                                 alt="ODS ${num}" 
                                 class="w-full h-full object-cover rounded"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" 
                            />
                            <div class="hidden w-full h-full rounded text-white font-bold items-center justify-center text-xs absolute top-0 left-0" 
                                 style="background-color: ${finalColor}">
                                ${num}
                            </div>
                            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-slate-800 text-white text-[9px] font-normal leading-tight rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] pointer-events-none">
                                <div class="font-black border-b border-slate-600 mb-1 pb-1 uppercase text-blue-300">ODS ${num}</div>
                                <div class="whitespace-normal">${data.name || 'Izena ez da aurkitu'}</div>
                            </div>
                        </div>`;
                });
            }
        }
        // =========================================================
        // 9. IKASKUNTZA EMAITZAK (RA)
        // =========================================================
        const raContainer = document.getElementById('detailRasList');
        if (raContainer) {
            raContainer.innerHTML = `
                <div class="flex flex-col gap-6">
                    <div class="bg-white p-4 rounded-xl border-l-4 shadow-sm" style="border-left-color: ${areaColor};">
                        <h5 class="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 border-b pb-2" style="color: ${areaColor}; border-color: #f3f4f6;">
                            <span class="p-1 rounded text-white" style="background-color: ${areaColor};"><i class="fas fa-cogs"></i></span>
                            Tekniko / Ofizialak
                        </h5>
                        <div id="listTec" class="space-y-3"></div>
                    </div>
                    <div class="bg-teal-50/30 p-4 rounded-xl border border-teal-100">
                        <h5 class="text-xs font-bold text-teal-800 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-teal-100 pb-2">
                            <span class="bg-teal-100 text-teal-700 p-1 rounded"><i class="fas fa-network-wired"></i></span>
                            Zeharkakoak (ZH)
                        </h5>
                        <div id="listZh" class="space-y-3"></div>
                    </div>
                </div>`;

            const renderRaItem = (item, index, type) => {
                let codigo = '', descripcion = '';
                const isTec = type === 'tec';
                
                const badgeStyle = isTec ? `background-color: ${areaColor}; color: white; border: none;` : ``; 
                const badgeClasses = isTec 
                    ? `font-mono text-xs font-bold mt-0.5 px-2 py-1 rounded shrink-0 min-w-[3.5rem] text-center shadow-sm`
                    : `font-mono text-xs font-bold text-teal-600 mt-0.5 bg-teal-50 px-2 py-1 rounded border border-teal-100 shrink-0 min-w-[3.5rem] text-center`;

                if (typeof item === 'object' && item !== null) {
                    if (isTec) {
                        codigo = item.raCode || item.code || item.id || `RA${index+1}`;
                        descripcion = item.raDesc || item.desc || item.description;
                    } else {
                        codigo = item.zhCode || item.subjectZhCode || item.code || item.id || `ZH${index+1}`;
                        descripcion = item.zhDesc || item.subjectZhDesc || item.desc || item.description;
                        if (!descripcion && degree && degree.zhCatalog) {
                            const fromCatalog = degree.zhCatalog.find(c => (c.zhCode || c.code) === codigo);
                            if (fromCatalog) descripcion = fromCatalog.zhDesc || fromCatalog.desc;
                        }
                    }
                    descripcion = descripcion || "Deskribapenik gabe";
                } else {
                    codigo = (isTec ? `RA${index+1}` : `ZH${index+1}`);
                    descripcion = item;
                }

                return `
                    <div class="flex gap-4 text-sm text-gray-700 items-start group transition hover:bg-gray-50 p-2 rounded">
                        <span class="${badgeClasses}" style="${badgeStyle}">${codigo}</span>
                        <span class="leading-relaxed text-gray-600 group-hover:text-gray-900">${descripcion}</span>
                    </div>`;
            };

            const listTec = document.getElementById('listTec');
            const tecArray = subject.currentOfficialRAs || subject.technicals || subject.ra || [];
            if (!tecArray.length) listTec.innerHTML = '<div class="text-sm text-gray-400 italic py-2 pl-2">Ez dago RA teknikorik.</div>';
            else tecArray.forEach((item, i) => listTec.innerHTML += renderRaItem(item, i, 'tec'));

            const listZh = document.getElementById('listZh');
            const zhArray = subject.subjectZhRAs || subject.zhRAs || subject.transversals || [];
            if (!zhArray.length) listZh.innerHTML = '<div class="text-sm text-gray-400 italic py-2 pl-2">Ez dago RA zeharkakorik.</div>';
            else zhArray.forEach((item, i) => listZh.innerHTML += renderRaItem(item, i, 'zh'));
        }

        // =========================================================
        // 10. UNITATEAK (Units)
        // =========================================================
        const unitsTable = document.getElementById('detailUnitsTable');
        if (unitsTable) {
            unitsTable.innerHTML = '';
            const unitsList = subject.unitateak || subject.units || [];
            
            if (unitsList.length === 0) {
                unitsTable.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center"><div class="text-gray-400"><i class="fas fa-inbox text-2xl mb-2"></i><p class="text-sm italic">Ez dago unitaterik sortuta.</p></div></td></tr>`;
            } else {
                const bgColor = `color-mix(in srgb, ${areaColor} 15%, transparent)`;
                const borderColor = `color-mix(in srgb, ${areaColor} 25%, transparent)`;
                const descriptorBgColor = `color-mix(in srgb, ${areaColor} 12%, transparent)`;
                
                unitsList.forEach((ud, index) => {
                    const descriptors = ud.descriptores || ud.descriptors || [];
                    const uCode = ud.unitCode || ud.code || '-';
                    
                    unitsTable.innerHTML += `
                        <tr class="bg-white border-b hover:bg-gray-50 transition" data-unit-index="${index}">
                            <td class="px-3 py-3 w-8"><div class="text-gray-300 cursor-grab active:cursor-grabbing"><i class="fas fa-list-ul"></i></div></td>
                            <td class="px-3 py-3 font-mono text-xs font-bold text-gray-600 align-top">${uCode}</td>
                            <td class="px-3 py-3">
                                <div class="font-medium text-gray-800 mb-2">${ud.unitName || ud.name || ''}</div>
                                ${descriptors.length > 0 ? `
                                    <div class="mt-3">
                                        <div class="descriptors-container flex flex-wrap gap-2 min-h-[40px] p-1" data-unit-index="${index}">
                                            ${descriptors.map((desc, descIndex) => `
                                                <div class="descriptor-tag draggable-descriptor group relative" data-unit-index="${index}" data-descriptor-index="${descIndex}" draggable="true">
                                                    <span class="descriptor-content flex items-center gap-1 text-xs px-3 py-2 rounded-lg text-gray-700 font-medium transition-all hover:scale-[1.02] cursor-move border" style="background-color: ${descriptorBgColor}; border-color: ${borderColor}; min-height: 36px; max-width: 100%;">
                                                        <i class="fas fa-grip-lines text-gray-400 text-xs flex-shrink-0"></i>
                                                        <span class="descriptor-text flex-1 truncate">${desc}</span>
                                                    </span>
                                                </div>`).join('')}
                                            <div class="descriptor-drop-zone hidden h-10 w-full border-2 border-dashed rounded-lg border-gray-300 bg-gray-50/50"></div>
                                        </div>
                                    </div>` : ''}
                            </td>
                            <td class="px-3 py-3 text-right text-xs text-gray-500 font-mono align-top">${ud.irauOrd || ud.hours || 0}h</td>
                        </tr>`;
                });
                unitsTable.innerHTML += `<tr id="dropZoneRow" class="h-2 transition-all"><td colspan="4" class="p-0"><div class="drop-zone h-2 bg-transparent"></div></td></tr>`;
                
                const styleId = 'drag-drop-descriptors-styles';
                if (!document.getElementById(styleId)) {
                    const style = document.createElement('style');
                    style.id = styleId;
                    style.textContent = `.draggable-descriptor { cursor: move !important; user-select: none; position: relative; } .draggable-descriptor.dragging { opacity: 0.5; transform: scale(1.02); z-index: 10; } .draggable-descriptor:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.1); } .descriptors-container { min-height: 50px; transition: all 0.2s; } .descriptors-container.drag-over { background-color: rgba(59, 130, 246, 0.05) !important; border-radius: 6px; }`;
                    document.head.appendChild(style);
                }
                setTimeout(() => {
                    if(typeof setupAdvancedDragAndDrop === 'function') setupAdvancedDragAndDrop();
                }, 300);    
            }   
        }
        document.getElementById('mainContent')?.scrollTo(0, 0);
    
        // =========================================================
        // 11. KONEXIOA: HTML botoiak -> GradosManager funtzioak
        // =========================================================
        const bm = window.gradosManager; 
        if (bm) {
            // 1. ODS Botoia
            const btnOds = document.getElementById('addOdsBtn');
            if (btnOds) {
                // Klonatu listener zaharrak garbitzeko
                const newBtn = btnOds.cloneNode(true);
                btnOds.parentNode.replaceChild(newBtn, btnOds);
                // Zure funtzio espezifikoa deitu
                newBtn.onclick = () => bm.openOdsSelector();
            }

            // 2. Proiektu Botoia
            const btnExt = document.getElementById('addExtProyBtn');
            if (btnExt) {
                const newBtn = btnExt.cloneNode(true);
                btnExt.parentNode.replaceChild(newBtn, btnExt);
                newBtn.onclick = () => bm.openProjectsSelector();
            }

            // 3. IDU Botoia
            const btnIdu = document.getElementById('addIduBtn');
            if (btnIdu) {
                const newBtn = btnIdu.cloneNode(true);
                btnIdu.parentNode.replaceChild(newBtn, btnIdu);
                newBtn.onclick = () => bm.openIduSelector();
            }
        }
    },

	
    getAreaColor: (areaName, degree) => {
        const found = (degree?.subjectAreas || []).find(a => a.name === areaName);
        return (found && found.color) ? found.color : '#cbd5e1';
    }
	
};


// ==============================================
// SISTEMA DE DRAG & DROP + DOBLE CLICK PARA EDITAR
// ==============================================

function setupAdvancedDragAndDrop() {
    console.log('🎯 Inicializando sistema avanzado...');
    
    try {
        // 1. Añadir estilos
        addAdvancedStyles();
        
        // 2. Configurar todo
        setTimeout(() => {
            configureAllDescriptors();
            
            // 3. Mostrar hint la primera vez
            showDoubleClickHint();
            
            console.log('✅ Sistema avanzado listo');
        }, 300);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Configurar todos los descriptores
function configureAllDescriptors() {
    const containers = document.querySelectorAll('.descriptors-container');
    console.log(`📊 Configurando ${containers.length} contenedores`);
    
    containers.forEach((container, idx) => {
        const descriptors = container.querySelectorAll('.draggable-descriptor');
        console.log(`   Contenedor ${idx}: ${descriptors.length} descriptores`);
        
        configureContainer(container);
    });
}

// Configurar un contenedor específico
function configureContainer(container) {
    const descriptors = container.querySelectorAll('.draggable-descriptor');
    
    descriptors.forEach(descriptor => {
        // 1. Configurar Drag & Drop
        setupDragForDescriptor(descriptor);
        
        // 2. Configurar Doble Click
        setupDoubleClickForDescriptor(descriptor);
    });
    
    // 3. Configurar drop en el contenedor mismo
    setupContainerDrop(container);
}

// DRAG & DROP
function setupDragForDescriptor(descriptor) {
descriptor.setAttribute('draggable', 'true');
    
    descriptor.addEventListener('dragstart', function(e) {
        if (this.classList.contains('editing')) {
            e.preventDefault();
            return;
        }
        
        // 1. CAPTURAR EL TEXTO REAL (Esto era lo que fallaba)
        const textElement = this.querySelector('.descriptor-text');
        const descriptorText = textElement ? textElement.textContent.trim() : this.textContent.trim();
        
        console.log('📦 ARRASTRANDO:', descriptorText); // Para que verifiques que no envía "descriptor"

        // 2. ENVIAR EL DATO REAL A LA MATRIZ
        e.dataTransfer.setData('text/plain', descriptorText);
        e.dataTransfer.effectAllowed = 'move';

        // 3. ESTILO VISUAL
        this.classList.add('dragging');
        this.style.opacity = '0.4';
    });
    
    descriptor.addEventListener('dragend', function() {
        this.classList.remove('dragging');
        this.style.opacity = '1';
    });
    
    descriptor.addEventListener('dragover', function(e) {
        if (this.classList.contains('editing')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.style.boxShadow = '0 0 0 2px #3b82f6';
    });
    
    descriptor.addEventListener('dragleave', function() {
        this.style.boxShadow = '';
    });
    
    descriptor.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.boxShadow = '';
        
        const dragging = document.querySelector('.dragging');
        if (!dragging || dragging === this || this.classList.contains('editing')) return;
        
        // Esto mantiene tu lógica de REORDENAR dentro de la propia lista lateral
        const container = this.closest('.descriptors-container');
        handleDescriptorDrop(dragging, this, container);
    });
}

// DOBLE CLICK PARA EDITAR
function setupDoubleClickForDescriptor(descriptor) {
    let clickTimer = null;
    let clickCount = 0;
    
    descriptor.addEventListener('click', function(e) {
        // Si ya está en modo edición, ignorar
        if (this.classList.contains('editing')) return;
        
        clickCount++;
        
        if (clickCount === 1) {
            // Primer click - esperar posible segundo click
            clickTimer = setTimeout(() => {
                clickCount = 0; // Reset después del timeout
            }, 300); // 300ms para doble click
        } 
        else if (clickCount === 2) {
            // ¡Doble click detectado!
            clearTimeout(clickTimer);
            clickCount = 0;
            
            console.log('✏️  Doble click - Activando edición');
            e.stopPropagation();
            activateEditMode(this);
        }
    });
    
    // Prevenir drag en caso de doble click rápido
    descriptor.addEventListener('mousedown', function(e) {
        if (clickCount > 0) {
            e.stopPropagation();
        }
    });
}

// ACTIVAR MODO EDICIÓN
function activateEditMode(descriptor) {
    console.log('📝 Activando modo edición');
    
    const contentSpan = descriptor.querySelector('.descriptor-content');
    const originalText = contentSpan?.dataset.originalText || 
                        descriptor.querySelector('.descriptor-text')?.textContent || '';
    
    // Guardar datos
    const unitIndex = descriptor.dataset.unitIndex;
    const descIndex = descriptor.dataset.descriptorIndex;
    
    // Crear interfaz de edición
    descriptor.innerHTML = `
        <div class="edit-mode-wrapper w-full" data-unit="${unitIndex}" data-index="${descIndex}">
            <div class="flex items-center gap-2">
                <input type="text" 
                       class="edit-input flex-1 text-xs px-3 py-2 rounded-lg border-2 border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                       value="${originalText.replace(/"/g, '&quot;')}"
                       placeholder="Editar descriptor..."
                       autofocus>
                <div class="flex gap-1">
                    <button class="btn-save px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-cancel px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors shadow-sm">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="text-[10px] text-gray-500 mt-1 italic">
                Presiona Enter para guardar, Esc para cancelar
            </div>
        </div>
    `;
    
    descriptor.classList.add('editing');
    descriptor.setAttribute('draggable', 'false');
    
    const input = descriptor.querySelector('.edit-input');
    const saveBtn = descriptor.querySelector('.btn-save');
    const cancelBtn = descriptor.querySelector('.btn-cancel');
    
    // Focus y seleccionar todo
    input.focus();
    input.select();
    
    // Evento: Guardar
    const saveEdit = () => {
        const newText = input.value.trim();
        if (newText && newText !== originalText) {
            saveDescriptorEdit(descriptor, newText, unitIndex, descIndex);
        } else {
            cancelDescriptorEdit(descriptor, originalText);
        }
    };
    
    saveBtn.addEventListener('click', saveEdit);
    
    // Evento: Cancelar
    cancelBtn.addEventListener('click', () => {
        cancelDescriptorEdit(descriptor, originalText);
    });
    
    // Eventos de teclado
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            cancelDescriptorEdit(descriptor, originalText);
        }
    });
    
    // Cerrar al hacer click fuera
    setTimeout(() => {
        const closeHandler = (e) => {
            if (!descriptor.contains(e.target)) {
                saveEdit();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 50);
}

// GUARDAR EDICIÓN
function saveDescriptorEdit(descriptor, newText, unitIndex, descIndex) {
    console.log('💾 Guardando:', newText);
    
    const bgColor = descriptor.closest('.descriptors-container')
        ?.previousElementSibling
        ?.style?.backgroundColor || '#f3f4f6';
    
    const borderColor = `color-mix(in srgb, ${bgColor} 60%, #000)`;
    
    // Restaurar vista normal con nuevo texto
    descriptor.innerHTML = `
        <span class="descriptor-content flex items-center gap-1 text-xs px-3 py-2 rounded-lg text-gray-700 font-medium transition-all hover:scale-[1.02] cursor-move border"
              style="background-color: ${bgColor}; 
                     border-color: ${borderColor};
                     min-height: 36px;"
              data-original-text="${newText.replace(/"/g, '&quot;')}">
            <i class="fas fa-grip-lines text-gray-400 text-xs"></i>
            <span class="descriptor-text flex-1 truncate" title="${newText}">${newText}</span>
            ${newText.length > 25 ? `
                <span class="descriptor-full hidden group-hover:block absolute z-10 top-full left-0 mt-1 w-48 p-3 bg-white rounded-lg shadow-lg border text-xs">
                    ${newText}
                    <div class="absolute -top-1 left-3 w-2 h-2 transform rotate-45 bg-white border-l border-t"></div>
                </span>
            ` : ''}
        </span>
    `;
    
    descriptor.classList.remove('editing');
    descriptor.setAttribute('draggable', 'true');
    
    // Actualizar en gradosManager
    if (gradosManager?.currentSubject?.unitateak?.[unitIndex]?.descriptores?.[descIndex]) {
        gradosManager.currentSubject.unitateak[unitIndex].descriptores[descIndex] = newText;
        console.log(`✅ Unidad ${unitIndex}, descriptor ${descIndex} actualizado`);
    }
    
    // Mostrar confirmación
    showEditNotification('✓ Descriptor actualizado');
    
    // Reconfigurar eventos
    setTimeout(() => {
        configureSingleDescriptor(descriptor);
    }, 100);
}

// CANCELAR EDICIÓN
function cancelDescriptorEdit(descriptor, originalText) {
    console.log('↩️  Cancelando edición');
    
    const container = descriptor.closest('.descriptors-container');
    const bgColor = container?.previousElementSibling?.style?.backgroundColor || '#f3f4f6';
    const borderColor = `color-mix(in srgb, ${bgColor} 60%, #000)`;
    
    descriptor.innerHTML = `
        <span class="descriptor-content flex items-center gap-1 text-xs px-3 py-2 rounded-lg text-gray-700 font-medium transition-all hover:scale-[1.02] cursor-move border"
              style="background-color: ${bgColor}; 
                     border-color: ${borderColor};
                     min-height: 36px;"
              data-original-text="${originalText.replace(/"/g, '&quot;')}">
            <i class="fas fa-grip-lines text-gray-400 text-xs"></i>
            <span class="descriptor-text flex-1 truncate" title="${originalText}">${originalText}</span>
            ${originalText.length > 25 ? `
                <span class="descriptor-full hidden group-hover:block absolute z-10 top-full left-0 mt-1 w-48 p-3 bg-white rounded-lg shadow-lg border text-xs">
                    ${originalText}
                    <div class="absolute -top-1 left-3 w-2 h-2 transform rotate-45 bg-white border-l border-t"></div>
                </span>
            ` : ''}
        </span>
    `;
    
    descriptor.classList.remove('editing');
    descriptor.setAttribute('draggable', 'true');
    
    // Reconfigurar eventos
    setTimeout(() => {
        configureSingleDescriptor(descriptor);
    }, 100);
}

// CONFIGURAR UN SOLO DESCRIPTOR
function configureSingleDescriptor(descriptor) {
    setupDragForDescriptor(descriptor);
    setupDoubleClickForDescriptor(descriptor);
}

// MANEJAR DROP DE DESCRIPTOR
function handleDescriptorDrop(dragging, target, container) {
    if (!container) return;
    
    const allDescriptors = Array.from(container.querySelectorAll('.draggable-descriptor:not(.editing)'));
    const draggedIdx = allDescriptors.indexOf(dragging);
    const targetIdx = allDescriptors.indexOf(target);
    
    if (draggedIdx === -1 || targetIdx === -1 || draggedIdx === targetIdx) return;
    
    console.log(`🔄 Moviendo de posición ${draggedIdx} a ${targetIdx}`);
    
    // Mover en el DOM
    if (draggedIdx < targetIdx) {
        container.insertBefore(dragging, target.nextSibling);
    } else {
        container.insertBefore(dragging, target);
    }
    
    // Actualizar datos
    updateContainerOrder(container);
}

// ACTUALIZAR ORDEN DEL CONTENEDOR
function updateContainerOrder(container) {
    const unitIndex = container.dataset.unitIndex;
    const descriptors = container.querySelectorAll('.draggable-descriptor');
    const order = Array.from(descriptors).map(d => 
        d.querySelector('.descriptor-text')?.textContent || ''
    );
    
    console.log(`💾 Actualizando orden unidad ${unitIndex}:`, order.length, 'descriptores');
    
    if (gradosManager?.currentSubject?.unitateak?.[unitIndex]) {
        gradosManager.currentSubject.unitateak[unitIndex].descriptores = order;
        showEditNotification(`✓ Orden actualizado - Unidad ${parseInt(unitIndex) + 1}`);
    }
}

// CONFIGURAR DROP EN CONTENEDOR
function setupContainerDrop(container) {
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });
    
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        
        if (dragging && !dragging.parentNode.isSameNode(container)) {
            container.appendChild(dragging);
            updateContainerOrder(container);
            showEditNotification('✓ Descriptor movido');
        }
    });
}

// MOSTRAR NOTIFICACIÓN
function showEditNotification(message) {
    const existing = document.getElementById('edit-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.id = 'edit-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 10px 18px;
        border-radius: 10px;
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);
        animation: slideInEdit 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        border-left: 4px solid #047857;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        notification.style.transition = 'all 0.5s ease';
        
        setTimeout(() => notification.remove(), 500);
    }, 2500);
}

// MOSTRAR HINT DE DOBLE CLICK
function showDoubleClickHint() {
    if (localStorage.getItem('doubleClickHintShown')) return;
    
    setTimeout(() => {
        showEditNotification('💡 Consejo: Doble click en cualquier descriptor para editarlo');
        localStorage.setItem('doubleClickHintShown', 'true');
    }, 3000);
}

// AÑADIR ESTILOS
function addAdvancedStyles() {
    const styleId = 'advanced-drag-drop-safe-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* ESTILOS ESPECÍFICOS SOLO PARA DESCRIPTORES - NO AFECTAN OTROS ELEMENTOS */
        
        /* Solo aplicar a elementos con estas clases EXACTAS */
        .descriptors-container .draggable-descriptor {
            cursor: grab !important;
            transition: transform 0.2s ease, opacity 0.2s ease !important;
            position: relative !important;
        }
        
        .descriptors-container .draggable-descriptor:active {
            cursor: grabbing !important;
        }
        
        .descriptors-container .draggable-descriptor.dragging {
            opacity: 0.6 !important;
            transform: scale(1.02) !important;
            z-index: 100 !important;
        }
        
        /* Modo edición - MUY específico */
        .descriptors-container .draggable-descriptor.editing {
            cursor: default !important;
            z-index: 1000 !important;
        }
        
        /* Contenido del descriptor */
        .descriptors-container .descriptor-content {
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
            transition: all 0.2s ease !important;
        }
        
        /* Input de edición - específico */
        .descriptors-container .edit-input {
            min-width: 180px !important;
            max-width: 300px !important;
        }
        
        /* Notificación - fuera del flujo normal */
        #edit-notification {
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            z-index: 10000 !important;
        }
        
        /* ANIMACIONES - solo para elementos específicos */
        @keyframes slideInEdit {
            from { 
                transform: translateX(100px) !important; 
                opacity: 0 !important; 
            }
            to { 
                transform: translateX(0) !important; 
                opacity: 1 !important; 
            }
        }
        
        /* Tooltip solo para descriptores */
        .descriptors-container .draggable-descriptor[title]:hover::after {
            content: attr(title) !important;
            position: absolute !important;
            top: -28px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            background: rgba(0,0,0,0.85) !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 11px !important;
            white-space: nowrap !important;
            z-index: 1001 !important;
            pointer-events: none !important;
        }
        
        /* QUITAR TODOS LOS ESTILOS QUE AFECTEN OTROS ELEMENTOS */
        /* No usar selectores genéricos como: */
        /* * { } */
        /* body { } */
        /* div { } */
        /* .flex { } (esto afecta TODOS los elementos con clase flex) */
        
        /* Solo selectores específicos con prefijos */
        .dd-btn-save, 
        .dd-btn-cancel {
            /* Estos nombres únicos no colisionan */
        }
    `;
    
    document.head.appendChild(style);
    console.log('✅ Estilos seguros aplicados');
}

// --- CONFIGURACIÓN GLOBAL ---
function closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
}

if (typeof window !== 'undefined') {
    window.ui = ui;
    window.toggleSidebarSection = ui.toggleSidebarSection;
    //window.openEditSubjectModal = ui.openEditSubjectModal; 
    window.closeModal = closeModal;
    window.backToYearView = () => {
        document.getElementById('subjectDetailView').classList.add('hidden');
        document.getElementById('yearView').classList.remove('hidden');
    };
    window.goToMatrix = () => alert("Laster...");
    // Abrir la vista de Gantt
	
	window.goToGantt = function() {
		// 1. Ocultar la vista de detalle
		document.getElementById('subjectDetailView').classList.add('hidden');
		
		// 2. Mostrar la vista de planificación
		const planningView = document.getElementById('subjectPlanningView');
		if (planningView) {
			planningView.classList.remove('hidden');
			
			// 3. Llamar al gestor para que dibuje los datos
			// Asegúrate de que GradosManager tiene el método renderPlanning
			if (window.gradosManager) {
				window.gradosManager.renderPlanning();
			}
		} else {
			console.error("Ez da aurkitu 'subjectPlanningView' IDa duen elementua HTMLan.");
		}
	};

	// Cerrar Gantt y volver atrás
	window.closePlanning = function() {
		// 1. Ocultar Gantt
		document.getElementById('subjectPlanningView').classList.add('hidden');
		
		// 2. Volver a mostrar detalle
		document.getElementById('subjectDetailView').classList.remove('hidden');
		
		// Opcional: Refrescar la vista de detalle por si cambiaste horas
		if (window.ui && window.gradosManager && window.gradosManager.currentSubject) {
			// window.ui.renderSubjectDetail(window.gradosManager.currentSubject);
		}
	};
		
		console.log("✅ UI JS Cargado correctamente vFINAL");

	}

























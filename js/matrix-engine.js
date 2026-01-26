class MatrixEngine {
    constructor() {
        this.dashboardModal = null;
        this.container = null;
    }

    // Modal nagusia ireki
renderView(viewType) {
        // 1. LEIHOA PRESTATU
        const modal = document.getElementById('matrixModal');
        if (!modal) {
            this.createMatrixModal();
            document.getElementById('matrixModal').classList.remove('hidden');
        } else {
            modal.classList.remove('hidden');
        }

        if (viewType === 'ActivitiesMap') viewType = 'activitiesMap';

        // 2. LOADING
        this.container = document.getElementById('matrixContent');
        if (this.container) {
            this.container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-slate-400 animate-pulse">
                    <i class="fas fa-brain text-4xl text-purple-500 mb-4"></i>
                    <p class="font-mono text-sm">Datuak aztertzen eta loturak bilatzen...</p>
                </div>`;
        }
        
        // 3. DATUAK BILATU (LOGIKA SENDOA)
        try {
            const gm = window.gradosManager;
            if (!gm) throw new Error("GradosManager ez dago abian.");

            // A) KONPETENTZIAK
            const degree = gm.currentDegree || {};
            const competencies = degree.competencies?.egreso || degree.konpetentziak?.irteera || [];

            // B) IRAKASGAIAK (DIAGNOSIAREN ONDORIOZ GEHITUA)
            let yearData = null;
            
            // Lehenik cachean begiratu, bestela zuzenean graduan
            if (gm.cachedData && gm.cachedData.year) {
                yearData = gm.cachedData.year;
            } else if (degree.year) {
                yearData = degree.year;
            }

            if (!yearData) throw new Error("Ez da irakasgaien daturik (year) aurkitu memorian.");

            // C) IRAKASGAIAK PROZESATU (IZENAK KONPONTZEKO)
            const subjects = this.flattenSubjects(yearData);

            console.log(`🧠 MatrixEngine: ${subjects.length} irakasgai eta ${competencies.length} konpetentzia kargatu dira.`);

            setTimeout(() => {
                try {
                    // --- BISTA MOTAK KUDEATU ---
                    switch(viewType) {
                        case 'competencyMap':
                            this.renderCompetencyMap(degree, subjects, competencies);
                            break;
                        case 'verticalProgression':
                            this.renderVerticalProgression(subjects);
                            break;
                        case 'activitiesMap':
                            this.renderActivitiesMap(subjects);
                            break;
                        case 'prerequisitesFlow':
                            this.renderPrerequisitesFlow(subjects);
                            break;
                        
                        // --- KASU BERRIAK GEHITUTA ---
                        case 'areaStack':
                            this.renderAreaStack(); // Eremuen pilaketa
                            break;
                        case 'contentFlow':
                            this.renderContentPile(); // Edukien pilaketa (Tetris)
                            break;
                        // -----------------------------

                        default:
                            this.renderCompetencyMap(degree, subjects, competencies);
                    }
                } catch (innerErr) {
                    console.error("❌ Errorea matrizea marraztean:", innerErr);
                    this.container.innerHTML = `<div class="p-4 bg-red-100 text-red-700 rounded">Errorea: ${innerErr.message}</div>`;
                }
            }, 100);

        } catch (err) {
            console.error(err);
            if (this.container) this.container.innerHTML = `<div class="p-4 bg-red-100 text-red-700 rounded">Arazoa datuekin: ${err.message}</div>`;
        }
    }
	
createMatrixModal() {
        const existing = document.getElementById('matrixModal');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = 'matrixModal';
        div.className = 'fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm hidden';
        div.innerHTML = `
            <div class="bg-white w-full h-full max-w-[95%] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                <div class="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0 border-b border-slate-700">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-purple-600 rounded-lg">
                            <i class="fas fa-brain text-xl"></i>
                        </div>
                        <div>
                            <h2 class="text-lg font-bold leading-none">Curriculum Intelligence</h2>
                            <span class="text-xs text-slate-400">Datuen analisia eta koherentzia</span>
                        </div>
                    </div>
                    <button onclick="document.getElementById('matrixModal').classList.add('hidden')" class="text-slate-400 hover:text-white transition">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <div class="flex flex-1 overflow-hidden">
                    <div class="w-64 bg-slate-900 p-4 border-r border-slate-700 overflow-y-auto space-y-2 shrink-0">
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 block">Analisi Tresnak</label>
                        
                        <button onclick="matrixEngine.renderView('competencyMap')" 
                                class="w-full text-xs bg-slate-800 border border-slate-600 p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-2 group">
                            <div class="w-5 h-5 rounded bg-green-900/50 flex items-center justify-center group-hover:bg-green-600 transition">
                                <i class="fas fa-th text-green-400 group-hover:text-white text-[10px]"></i>
                            </div>
                            <span>Konpetentzia Mapa</span>
                        </button>

                        <button onclick="matrixEngine.renderView('verticalProgression')" 
                                class="w-full text-xs bg-slate-800 border border-slate-600 p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-2 group">
                            <div class="w-5 h-5 rounded bg-blue-900/50 flex items-center justify-center group-hover:bg-blue-600 transition">
                                <i class="fas fa-layer-group text-blue-400 group-hover:text-white text-[10px]"></i>
                            </div>
                            <span>Progresio Bertikala</span>
                        </button>

                        <button onclick="matrixEngine.renderView('areaStack')" 
                                class="w-full text-xs bg-slate-800 border border-slate-600 p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-2 group">
                            <div class="w-5 h-5 rounded bg-blue-900/50 flex items-center justify-center group-hover:bg-blue-600 transition">
                                <i class="fas fa-chart-column text-blue-400 group-hover:text-white text-[10px]"></i>
                            </div>
                            <span>Eremuen Progresioa</span>
                        </button>

                        <button onclick="matrixEngine.renderView('contentFlow')" 
                                class="w-full text-xs bg-slate-800 border border-slate-600 p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-2 group">
                            <div class="w-5 h-5 rounded bg-emerald-900/50 flex items-center justify-center group-hover:bg-emerald-600 transition">
                                <i class="fas fa-cubes text-emerald-400 group-hover:text-white text-[10px]"></i>
                            </div>
                            <span>Edukien Dentsitate Matrizea</span>
                        </button>

                        <button onclick="matrixEngine.renderView('activitiesMap')" 
                                class="w-full text-xs bg-slate-800 border border-slate-600 p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-2 group">
                            <div class="w-5 h-5 rounded bg-orange-900/50 flex items-center justify-center group-hover:bg-orange-600 transition">
                                <i class="fas fa-globe-europe text-orange-400 group-hover:text-white text-[10px]"></i>
                            </div>
                            <span>Kanpo Jardueren Ekosistema</span>
                        </button>

                        <button onclick="matrixEngine.renderView('prerequisitesFlow')" 
                                class="w-full text-xs bg-slate-800 border border-slate-600 p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-2 group">
                            <div class="w-5 h-5 rounded bg-purple-900/50 flex items-center justify-center group-hover:bg-orange-600 transition">
                                <i class="fas fa-project-diagram text-purple-500 group-hover:text-white text-[10px]"></i>
                            </div>
                            <span>Aurre-Ezagutza Fluxua</span>
                        </button>
                    </div>

                    <div id="matrixContent" class="flex-1 overflow-auto p-6 bg-slate-100 relative"></div>
                </div>
            </div>
        `;
        document.body.appendChild(div);
        this.container = document.getElementById('matrixContent');
    }
	
    // --- HEMEN KONPONDU DUT "JAN" NUEN KODEA ---
    flattenSubjects(yearData) {
        let all = [];
        if (!yearData) return all;
        Object.keys(yearData).forEach(y => {
            if (Array.isArray(yearData[y])) {
                yearData[y].forEach(sub => {
                    // IZENEN KONPONKETA: subjectTitle baldin badago, hori erabili
                    const realName = sub.subjectTitle || sub.name || sub.title || 'Izengabea';
                    const realCode = sub.subjectCode || sub.code || '?';
                    
                    all.push({ 
                        ...sub, 
                        _year: y,
                        name: realName,     // Honek konpontzen du "undefined" arazoa
                        subjectCode: realCode 
                    });
                });
            }
        });
        return all;
    }

    getSubjectRAs(sub) {
        const tec = sub.currentOfficialRAs || sub.technicals || sub.ra || [];
        const zh = sub.subjectZhRAs || sub.transversals || sub.zhRAs || sub.zh || [];
        
        const normalize = (list) => {
            if(!Array.isArray(list)) return [];
            return list.map(item => ({
                code: item.raCode || item.zhCode || item.code || item.id || '?',
                desc: item.raDesc || item.zhDesc || item.desc || item.description || '',
                link: item.linkedCompetency || '' 
            }));
        };

        return [...normalize(tec), ...normalize(zh)];
    }

    areCodesRelated(compCode, linkCode) {
        if (!compCode || !linkCode) return false;
        const c = String(compCode).trim().toLowerCase();
        const l = String(linkCode).trim().toLowerCase();
        // Malgutasuna: kode zehatza edo "Kod - Deskribapena" formatua
        return (c === l) || c.startsWith(l + ' ') || c.startsWith(l + '-') || l.startsWith(c + ' ');
    }

    // 1. MAPA
    renderCompetencyMap(degree, subjects, competencies) {
        if (!competencies.length) {
            this.container.innerHTML = '<div class="p-8 text-center text-slate-500">Ez dago konpetentziarik definituta.</div>';
            return;
        }

        let linksFound = 0;
        let html = `
            <div class="mb-6 flex justify-between items-end">
                <div>
                    <h3 class="text-2xl font-bold text-slate-800">Irteerako Konpetentzien Estaldura</h3>
                    <p class="text-sm text-slate-500">Irakasgai bakoitzak zein konpetentzia lantzen dituen.</p>
                </div>
            </div>
            
            <div class="overflow-x-auto shadow-xl rounded-lg border border-slate-200 bg-white pb-2 max-h-[80vh]">
                <table class="min-w-full divide-y divide-slate-200 text-xs border-collapse">
                    <thead class="bg-slate-50 sticky top-0 z-30 shadow-sm">
                        <tr>
                            <th class="px-3 py-3 text-left font-bold text-slate-600 uppercase w-80 sticky left-0 bg-slate-50 z-40 border-r border-b">
                                Konpetentzia / Irakasgaia
                            </th>
                            ${subjects.map(sub => `
                                <th class="px-1 py-3 text-left font-semibold text-slate-500 w-10 relative h-48 align-bottom border-b group hover:bg-blue-50 transition cursor-help">
                                    <div class="absolute bottom-2 left-1/2 -translate-x-1/2 origin-bottom-left -rotate-90 w-40 text-left whitespace-nowrap overflow-visible">
                                        <span class="block truncate w-40" title="${sub.name}">
                                            <span class="font-mono font-bold text-blue-600 text-[10px] mr-1">${sub.subjectCode}</span> 
                                            ${(sub.name).substring(0, 30)}
                                        </span>
                                    </div>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
        `;

        competencies.forEach(comp => {
            const compCode = comp.code || comp.autoCode || '';
            const compText = comp.desc || comp.text || '';

            html += `<tr class="hover:bg-slate-50 transition group/row">
                <td class="px-4 py-3 border-r sticky left-0 bg-white z-20 w-80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover/row:bg-slate-50">
                    <div class="flex flex-col gap-1">
                        <span class="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded w-fit text-[10px]">${compCode}</span>
                        <span class="text-[10px] text-slate-600 leading-tight line-clamp-3" title="${compText}">
                            ${compText}
                        </span>
                    </div>
                </td>`;

            subjects.forEach(sub => {
                const allRAs = this.getSubjectRAs(sub);
                const matches = allRAs.filter(ra => this.areCodesRelated(compCode, ra.link));

                if (matches.length > 0) {
                    linksFound++;
                    let bgClass = matches.length > 1 ? 'bg-green-600' : 'bg-green-500'; 
                    html += `<td class="p-0 border-l border-slate-100 text-center relative group/cell cursor-pointer hover:brightness-110 transition">
                        <div class="w-full h-10 flex items-center justify-center ${bgClass} text-white font-bold shadow-sm">${matches.length}</div>
                        
                        <div class="hidden group-hover/cell:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-slate-800 text-white p-3 rounded-lg z-50 text-[10px] text-left shadow-2xl border border-slate-700 pointer-events-none">
                            <div class="font-bold border-b border-slate-600 mb-2 pb-1 text-blue-300 uppercase truncate">${sub.name}</div>
                            <ul class="space-y-1">${matches.map(r => `<li><span class="font-mono text-yellow-400">${r.code}</span> ${(r.desc||'').substring(0,50)}...</li>`).join('')}</ul>
                        </div>
                    </td>`;
                } else {
                    html += `<td class="p-0 border-l border-slate-50 text-center"><div class="w-full h-10 bg-transparent hover:bg-slate-100 transition"></div></td>`;
                }
            });
            html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        if (linksFound === 0) html += `<div class="mt-4 p-4 bg-yellow-50 text-yellow-800 text-sm">⚠️ Ez da loturarik aurkitu. Ziurtatu irakasgaien edizioan "Lotura" eremua beteta dagoela.</div>`;
        
        this.container.innerHTML = html;
    }

    // 2. PROGRESIOA
    renderVerticalProgression(subjects) {
        const areas = new Set();
        subjects.forEach(s => { 
            if (s.subjectArea) areas.add(s.subjectArea.trim());
            else areas.add("Eremu gabe");
        });
        const uniqueAreas = Array.from(areas).sort();
        
        let html = `
            <div class="flex h-full gap-4">
                <div class="w-64 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full shrink-0">
                    <div class="p-4 border-b border-slate-100 bg-slate-50 rounded-t-lg">
                        <h3 class="font-bold text-slate-700 text-sm">1. Aukeratu Eremua</h3>
                    </div>
                    <div class="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
                        ${uniqueAreas.map(area => `
                            <button onclick="matrixEngine.showAreaProgressionDetail('${area.replace(/'/g, "\\'")}')" 
                                class="w-full text-left text-xs font-medium p-3 rounded-md transition hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-200 flex justify-between group">
                                <span>${area}</span><i class="fas fa-chevron-right opacity-0 group-hover:opacity-100 text-blue-400"></i>
                            </button>`).join('')}
                    </div>
                </div>
                <div id="progressionDetail" class="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 p-6 overflow-y-auto bg-dots">
                    <div class="flex flex-col items-center justify-center h-full text-slate-300">
                        <i class="fas fa-arrow-left text-3xl mb-4"></i><p>Aukeratu Ezagutza Eremu bat.</p>
                    </div>
                </div>
            </div>`;
        this.container.innerHTML = html;
    }

    showAreaProgressionDetail(areaName) {
        const container = document.getElementById('progressionDetail');
        if(!container) return;
        
        // Datuak berritu ziurtasunagatik
        let yearData = window.gradosManager.cachedData?.year || window.gradosManager.currentDegree?.year;
        const subjects = this.flattenSubjects(yearData);
        
        const areaSubjects = subjects.filter(s => (s.subjectArea || 'Eremu gabe').trim() === areaName);
        
        let html = `
            <div class="mb-6 flex items-center gap-3 border-b pb-4">
                <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg"><i class="fas fa-layer-group"></i></div>
                <div><h2 class="text-xl font-bold text-slate-800">${areaName}</h2><p class="text-xs text-slate-500">${areaSubjects.length} irakasgai</p></div>
            </div>
            <div class="grid grid-cols-4 gap-4 h-full">`;

        [1, 2, 3, 4].forEach(year => {
            const yearSubs = areaSubjects.filter(s => parseInt(s._year) === year);
            html += `<div class="flex flex-col gap-3 min-h-[400px] bg-slate-50/50 rounded-lg p-2 border border-slate-100">
                <div class="bg-slate-800 text-white py-2 px-4 rounded text-center font-bold text-sm sticky top-0 z-10 shadow">${year}. Maila</div>
                ${yearSubs.length === 0 ? '<div class="text-center py-10 text-slate-300 italic text-xs border-2 border-dashed border-slate-200 rounded">Hutsik</div>' 
                : yearSubs.map(sub => {
                    const ras = this.getSubjectRAs(sub);
                    return `<div class="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md transition">
                        <div class="font-bold text-slate-700 text-xs mb-2 border-b border-slate-100 pb-1 flex justify-between"><span>${sub.name}</span><span class="bg-slate-100 px-1 rounded text-[9px] text-slate-500">${sub.subjectCredits||6} ECTS</span></div>
                        <div class="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                            ${ras.length > 0 ? ras.map(r => `<div class="text-[10px] leading-snug p-1.5 bg-blue-50/50 rounded border border-transparent hover:border-blue-200"><span class="font-bold text-blue-700 mr-1">${r.code}:</span><span class="text-slate-600">${(r.desc||'').substring(0,80)}...</span></div>`).join('') : '<span class="text-[9px] text-red-300 italic">RArik gabe</span>'}
                        </div></div>`;
                }).join('')}
            </div>`;
        });
        html += `</div>`;
        container.innerHTML = html;
    }

renderAreaStack() {
        const degree = window.gradosManager.currentDegree;
        const years = ['1', '2', '3', '4'];
        
        // 1. LEGENDA PRESTATU (Datu guztiak eskaneatu eremuak lortzeko)
        const allSubjects = years.flatMap(y => degree.year[y] || []);
        const uniqueAreas = [...new Set(allSubjects.map(s => s.subjectArea || "ZEHARKAKO KONPETENTZIAK"))].sort();

        let legendHtml = `<div class="flex flex-wrap gap-4 mb-6 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <span class="text-xs font-bold text-slate-400 uppercase mr-2 self-center">Legenda:</span>`;
        
        uniqueAreas.forEach(area => {
            const color = window.ui && window.ui.getAreaColor ? window.ui.getAreaColor(area, degree) : '#cbd5e1';
            legendHtml += `
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full shadow-sm" style="background-color: ${color};"></div>
                    <span class="text-xs font-medium text-slate-600">${area}</span>
                </div>`;
        });
        legendHtml += `</div>`;

        // 2. STACK GRID-A ERAIKI
        let gridHtml = `<div class="grid grid-cols-4 gap-4 h-[500px] items-end px-4">`;

        years.forEach(year => {
            const subjects = degree.year[year] || [];
            
            // Datuak taldekatu (Area -> Kredituak)
            const areaStats = {};
            let totalCredits = 0;

            subjects.forEach(sub => {
                const area = sub.subjectArea || "ZEHARKAKO KONPETENTZIAK";
                const credits = parseInt(sub.subjectCredits) || 6;
                
                if (!areaStats[area]) areaStats[area] = 0;
                areaStats[area] += credits;
                totalCredits += credits;
            });

            // Zutabea
            gridHtml += `<div class="flex flex-col justify-end h-full w-full bg-slate-50 rounded-lg overflow-hidden relative group shadow-inner border border-slate-200">`;
            
            // Urtearen etiketa
            gridHtml += `<div class="absolute -top-8 left-0 w-full text-center font-bold text-slate-400 text-xl">${year}. Maila</div>`;

            // Blokeak pilatu
            Object.keys(areaStats).forEach(area => {
                const credits = areaStats[area];
                // Ehunekoa kalkulatu (60 kreditu estandar gisa hartuta edo total erreala)
                const heightPct = (credits / Math.max(totalCredits, 60)) * 100; 
                const color = window.ui && window.ui.getAreaColor ? window.ui.getAreaColor(area, degree) : '#cbd5e1';

                gridHtml += `
                    <div class="w-full flex items-center justify-center text-[10px] font-bold text-white/90 hover:opacity-90 transition relative tooltip-container border-t border-white/20"
                         style="height: ${heightPct}%; background-color: ${color};"
                         title="${area}: ${credits} ECTS">
                         <span class="truncate px-1 drop-shadow-md">${credits}</span>
                    </div>`;
            });

            gridHtml += `</div>`;
        });
        gridHtml += `</div>`;

        // 3. HTML FINALA
        this.container.innerHTML = `
            <div class="mb-4">
                <h3 class="text-2xl font-bold text-slate-800">Ikaskuntza Eremuen Pisua</h3>
                <p class="text-slate-500 text-sm">Ikasturte bakoitzeko karga akademikoa eremuka banatuta.</p>
            </div>
            ${legendHtml}
            ${gridHtml}
            <div class="mt-8 text-center text-xs text-slate-400">
                *Blokeen altuera kreditu kopuruarekiko proportzionala da.
            </div>`;
    }
	
renderContentPile(filter = 'ALL') {
        const degree = window.gradosManager.currentDegree;
        const years = ['1', '2', '3', '4'];

        // 1. EREMUA BAKARRAK LORTU (Filter Menua sortzeko)
        // Irakasgai guztiak arrastreatu eremu guztiak zerrendatzeko
        const allSubjects = years.flatMap(y => degree.year[y] || []);
        const uniqueAreas = [...new Set(allSubjects.map(s => s.subjectArea || "ZEHARKAKOA"))].sort();

        // 2. FILTER MENUA ERAIKI (HTML)
        let filterHtml = `
            <div class="flex flex-wrap gap-2 mb-6 pb-4 border-b border-slate-200">
                <button onclick="matrixEngine.renderContentPile('ALL')" 
                        class="px-3 py-1 rounded-full text-xs font-bold transition border ${filter === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'}">
                    GUZTIAK
                </button>`;
        
        uniqueAreas.forEach(area => {
            const color = window.ui && window.ui.getAreaColor ? window.ui.getAreaColor(area, degree) : '#94a3b8';
            const isActive = filter === area;
            
            // Botoi aktiboa vs inaktiboa
            const activeStyle = `background-color: ${color}; color: white; border-color: ${color};`;
            const inactiveStyle = `background-color: white; color: ${color}; border-color: ${color}; opacity: 0.7;`;

            filterHtml += `
                <button onclick="matrixEngine.renderContentPile('${area}')" 
                        style="${isActive ? activeStyle : inactiveStyle}"
                        class="px-3 py-1 rounded-full text-xs font-bold transition hover:opacity-100 border">
                    ${area}
                </button>`;
        });
        filterHtml += `</div>`;


        // 3. GRID NAGUSIA ERAIKI
        let gridHtml = `<div class="grid grid-cols-4 gap-6">`;

        years.forEach(year => {
            const subjects = degree.year[year] || [];
            
            // Hemen iragazten dugu: 'ALL' bada denak, bestela bat etorri behar du
            const filteredSubjects = subjects.filter(sub => {
                const sArea = sub.subjectArea || "ZEHARKAKOA";
                return filter === 'ALL' || sArea === filter;
            });

            // Zutabea erakutsi nahiz eta hutsik egon (diseinua mantentzeko), 
            // edo nahiago baduzu ezkutatu, gehitu: if (filteredSubjects.length === 0) ...
            
            gridHtml += `<div class="bg-slate-50 p-4 rounded-xl border border-slate-200 min-h-[400px] transition-all duration-500">
                        <div class="text-center font-bold text-slate-400 mb-4 pb-2 border-b border-slate-200 flex justify-between items-center">
                            <span>${year}. MAILA</span>
                            <span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 rounded">${filteredSubjects.length}</span>
                        </div>
                        <div class="flex flex-col-reverse gap-2">`; 

            if (filteredSubjects.length === 0) {
                gridHtml += `<div class="text-center text-xs text-slate-300 italic py-10">Eremu honetan ez dago irakasgairik maila honetan.</div>`;
            }

            filteredSubjects.forEach(sub => {
                const area = sub.subjectArea || "ZEHARKAKOA";
                const color = window.ui && window.ui.getAreaColor ? window.ui.getAreaColor(area, degree) : '#94a3b8';
                
                // --- EDUKIAK PROZESATU (Aurreko bertsioa mantenduz) ---
                let contentHTML = '';
                const units = sub.unitateak || sub.units || [];
                
                if (units.length > 0) {
                     contentHTML = units.slice(0,5).map(u => {
                         const name = u.unitName || "Izenik gabea";
                         const desc = u.descriptores || "";
                         return `<span title="${desc}" class="cursor-help border-b border-dotted border-slate-400">• ${name}</span>`;
                     }).join('<br>');
                } else if (sub.zhRAs && sub.zhRAs.length > 0) {
                    contentHTML = `<span class="italic text-slate-400 text-[9px]">Gaiak zehaztugabe. Helburuak:</span><br>` + 
                                  sub.zhRAs.slice(0,2).map(r => `• ${r.zhDesc}`).join('<br>');
                } else {
                    contentHTML = '<span class="text-slate-300 italic">• Edukiak prozesatzen...</span>';
                }
                // ------------------------------------------------------

                gridHtml += `
                <div class="bg-white border-l-4 p-2 shadow-sm rounded hover:shadow-md transition transform hover:-translate-y-1 cursor-default group animate-in fade-in zoom-in duration-300"
                     style="border-left-color: ${color};">
                    <div class="text-[10px] uppercase font-bold text-slate-400 mb-0.5 tracking-wider truncate">${area}</div>
                    <div class="text-xs font-bold text-slate-700 leading-tight mb-1">${sub.subjectTitle}</div>
                    
                    <div class="hidden group-hover:block mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-600 overflow-hidden">
                        ${contentHTML}
                    </div>
                </div>`;
            });

            gridHtml += `   </div>
                     </div>`;
        });
        gridHtml += `</div>`;

        // 4. HTML INJEKTATU
        this.container.innerHTML = `
            <div class="mb-2">
                <h3 class="text-2xl font-bold text-slate-800">Edukien Dentsitate Matrizea</h3>
                <p class="text-sm text-slate-500">Irakasgaien banaketa eta eduki espezifikoak eremuka</p>
            </div>
            ${filterHtml}
            ${gridHtml}
        `;
    }
	
    // 3. JARDUERAK
    renderActivitiesMap(subjects) {
        let allActivities = [];
        subjects.forEach(sub => {
            const signs = sub.context?.signAct || sub.signAct || [];
            if (Array.isArray(signs)) signs.forEach(act => allActivities.push({ type: 'Jarduera', name: typeof act === 'string' ? act : act.name, subject: sub.name, year: sub._year, agent: act.agent || '-', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' }));
            
            const exts = sub.context?.external_projects || sub.extProy || [];
            if (Array.isArray(exts)) exts.forEach(proj => allActivities.push({ type: 'Proiektua', name: typeof proj === 'string' ? proj : proj.name, subject: sub.name, year: sub._year, agent: proj.agent || proj.coordinator || 'Kanpokoa', color: 'bg-orange-100 text-orange-700 border-orange-200' }));
        });

        if (allActivities.length === 0) { this.container.innerHTML = '<div class="p-8 text-center text-slate-500">Ez da jarduera edo proiekturik aurkitu.</div>'; return; }

        let html = `<div class="mb-6"><h3 class="text-2xl font-bold text-slate-800">Jardueren Ekosistema</h3></div><div class="grid grid-cols-4 gap-4">`;
        [1, 2, 3, 4].forEach(year => {
            const acts = allActivities.filter(a => parseInt(a.year) === year);
            html += `<div class="bg-slate-50 rounded-xl p-3 border border-slate-200 min-h-[400px]"><div class="text-center font-bold text-slate-600 mb-4 border-b pb-2 text-sm uppercase">${year}. Maila <span class="bg-slate-200 text-slate-600 px-2 rounded-full text-xs ml-2">${acts.length}</span></div><div class="space-y-3">${acts.map(a => `<div class="bg-white p-3 rounded-lg shadow-sm border ${a.color} relative overflow-hidden group hover:shadow-md transition"><div class="text-[9px] font-bold uppercase opacity-70 mb-1">${a.agent}</div><div class="font-bold text-xs mb-1 leading-tight">${a.name}</div><div class="text-[9px] text-slate-500 truncate"><i class="fas fa-book mr-1"></i> ${a.subject}</div></div>`).join('')}</div></div>`;
        });
        html += `</div>`;
        this.container.innerHTML = html;
    }

    // 4. FLUXUA
renderPrerequisitesFlow(subjects) {
        const gm = window.gradosManager;
        const degree = gm.currentDegree;

        // 1. DATUAK ZUZEN LORTU (Zure JSON egituraren arabera)
        // "competencies" objektua hartu, eta bestela objektu hutsa akatsik ez emateko
        const comps = degree.competencies || {};

        // SARRERA (Ingreso) - Fallbackekin
        const entryData = comps.ingreso || ["Sarrera profil orokorra (Datuak falta dira)"];
        
        // IRTEERA (Egreso) - Fallbackekin
        const exitData = comps.egreso || ["Irteera profil profesionala (Datuak falta dira)"];

        // 2. ERDIKO FLUXUA PRESTATU (EREMUKA)
        const flowByArea = {};
        
        subjects.forEach(sub => {
            const area = sub.subjectArea || "ZEHARKAKOA";
            
            // Ziurtatu eremua existitzen dela objektuan
            if (!flowByArea[area]) {
                flowByArea[area] = {
                    color: window.ui && window.ui.getAreaColor ? window.ui.getAreaColor(area, degree) : '#94a3b8',
                    links: [],
                    subjects: [] 
                };
            }
            flowByArea[area].subjects.push(sub.subjectTitle);

            // Aurre-baldintzak bilatu
            const preReqs = sub.prerequisites || sub.context?.preReq || [];
            if (Array.isArray(preReqs) && preReqs.length > 0) {
                preReqs.forEach(req => {
                    const reqName = typeof req === 'string' ? req : req.name;
                    flowByArea[area].links.push({
                        from: reqName,
                        to: sub.subjectTitle,
                        year: sub.year || "?"
                    });
                });
            }
        });

        // 3. HTML ERAIKUNTZA (LAYOUT HIRUKOITZA)
        let html = `
            <div class="flex flex-col h-full bg-slate-50/50 p-2">
                <div class="mb-4 border-b border-slate-200 pb-2">
                    <h3 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <i class="fas fa-project-diagram text-purple-600"></i>
                        Ibilbidearen Fluxu Logikoa
                    </h3>
                    <p class="text-xs text-slate-500">Konpetentzien garapena: Sarreratik Irteerara, Eremuka antolatuta.</p>
                </div>

                <div class="flex flex-col lg:flex-row gap-4 items-stretch h-[calc(100vh-200px)]">
                    
                    <div class="lg:w-1/5 shrink-0 flex flex-col">
                        <div class="bg-white border-l-4 border-emerald-400 shadow-sm rounded-r-lg p-4 h-full overflow-hidden flex flex-col">
                            <div class="flex items-center gap-2 mb-3 text-emerald-700 font-bold text-sm uppercase tracking-wider">
                                <i class="fas fa-door-open"></i> Sarrera Profila
                            </div>
                            
                            <div class="overflow-y-auto custom-scrollbar flex-1 space-y-2 pr-1">
                                ${Array.isArray(entryData) ? entryData.map(c => {
                                    // Testua garbitu (objektua bada 'code' edo 'desc' erabili, string bada zuzenean)
                                    const txt = typeof c === 'string' ? c : (c.desc || c.code || "Zehaztugabea");
                                    return `
                                    <div class="bg-emerald-50/50 p-2 rounded text-[11px] text-slate-700 border border-emerald-100 leading-snug">
                                        ${txt}
                                    </div>`;
                                }).join('') : '<p class="text-xs italic text-slate-400">Ez dago sarrera daturik.</p>'}
                            </div>
                        </div>
                    </div>

                    <div class="flex-1 bg-white rounded-xl shadow-inner border border-slate-200 flex flex-col overflow-hidden">
                        <div class="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 text-center">
                            Irakasgaien Arteko Fluxua (Eremuka)
                        </div>
                        
                        <div class="overflow-y-auto custom-scrollbar p-4 space-y-6 flex-1">
                            ${Object.keys(flowByArea).sort().map(area => {
                                const data = flowByArea[area];
                                const hasLinks = data.links.length > 0;
                                return `
                                <div class="relative pl-3 border-l-2" style="border-left-color: ${data.color};">
                                    <div class="flex items-baseline justify-between mb-2">
                                        <h4 class="font-bold text-xs text-slate-700 uppercase" style="color: ${data.color}">
                                            ${area}
                                        </h4>
                                    </div>

                                    <div class="bg-slate-50 rounded border border-slate-100 p-2">
                                        ${hasLinks ? 
                                            `<div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
                                                ${data.links.map(link => `
                                                    <div class="flex items-center gap-2 bg-white px-2 py-1.5 rounded border border-slate-200 shadow-sm">
                                                        <div class="flex-1 text-[10px] text-right text-slate-500 truncate" title="${link.from}">
                                                            ${link.from}
                                                        </div>
                                                        <div class="text-slate-300 text-[10px]">
                                                            <i class="fas fa-arrow-right"></i>
                                                        </div>
                                                        <div class="flex-1 text-[10px] font-bold text-slate-700 truncate" title="${link.to}">
                                                            ${link.to}
                                                        </div>
                                                    </div>
                                                `).join('')}
                                            </div>` 
                                            : 
                                            `<div class="text-[10px] text-slate-400 italic pl-1">
                                                Fluxu lineal zuzenik gabe.
                                             </div>`
                                        }
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>

                    <div class="lg:w-1/4 shrink-0 flex flex-col">
                        <div class="bg-slate-900 text-slate-300 border-r-4 border-purple-500 shadow-lg rounded-l-lg p-4 h-full overflow-hidden flex flex-col relative">
                            <div class="flex items-center gap-2 mb-4 text-purple-400 font-bold text-sm uppercase tracking-wider relative z-10">
                                <i class="fas fa-user-graduate"></i> Irteera Profila
                            </div>
                            
                            <div class="overflow-y-auto custom-scrollbar flex-1 space-y-3 pr-1 relative z-10">
                                ${Array.isArray(exitData) ? exitData.map(c => {
                                     // Objektu konplexuak badira (code, desc), testua atera
                                     const txt = typeof c === 'string' ? c : (c.desc || c.code || "Konpetentzia zehaztugabea");
                                     return `
                                    <div class="flex gap-2 items-start group">
                                        <i class="fas fa-check text-purple-500 mt-1 text-[10px] group-hover:text-purple-300 transition"></i>
                                        <span class="text-xs leading-relaxed text-slate-300 group-hover:text-white transition">
                                            ${txt}
                                        </span>
                                    </div>`;
                                }).join('') : '<p class="text-xs text-slate-500">Ez dago irteera daturik.</p>'}
                            </div>

                            <div class="absolute bottom-[-20px] right-[-20px] text-slate-800 opacity-20 pointer-events-none">
                                <i class="fas fa-award text-[150px]"></i>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        `;

        this.container.innerHTML = html;
    }	
}
window.matrixEngine = new MatrixEngine();
/**
 * PlanningManager v18 - D&D ROWS + TRAZABILIDAD DESCRIPTORES
 * - Reordenación de actividades mediante Drag & Drop en el listado.
 * - Visualización de descriptores "ya usados" en otras actividades (sombreado).
 * - Mantiene fechas fijas, calendario real y persistencia.
 */

class PlanningManager {
    constructor() {
        this.currentSubject = null;
        this.containerId = 'planningContainer';
        
        this.defaultConfig = {
            startDate: "2025-09-08",
            endDate: "2026-06-20",
            schedule: [0, 0, 0, 0, 0], 
            holidays: [] 
        };
        
        this.config = { ...this.defaultConfig };
        this.expandedUnits = new Set();
        this.editContext = null; 
    }

    // ==========================================
    // 1. APERTURA
    // ==========================================

    open() {
        const gm = window.gradosManager;
        if (!gm || !gm.currentSubject) return alert("Errorea: Aukeratu irakasgai bat.");
        
        this.currentSubject = gm.currentSubject;

        if (this.currentSubject.calendarConfig) {
            this.config = { ...this.defaultConfig, ...this.currentSubject.calendarConfig };
        } else {
            this.config = { ...this.defaultConfig };
        }

        document.getElementById('subjectDetailView').classList.add('hidden');
        document.getElementById('subjectPlanningView').classList.remove('hidden');

        this.currentSubject.unitateak?.forEach((_, i) => this.expandedUnits.add(i));

        this.render();
    }

    close() {
        document.getElementById('subjectPlanningView').classList.add('hidden');
        document.getElementById('subjectDetailView').classList.remove('hidden');
        if (window.ui) window.ui.renderSubjectDetail(this.currentSubject);
    }

    // ==========================================
    // 2. RENDERIZADO
    // ==========================================

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const plannedHours = this.calculatePlannedLoad();
        const capacityHours = this.calculateRealCapacity();
        const balance = capacityHours - plannedHours;
        const pct = Math.min(100, (plannedHours / (capacityHours || 1)) * 100);
        
        let statColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
        let progressColor = "bg-emerald-500";
        if (balance < 0) { 
            statColor = "bg-red-100 text-red-700 border-red-200";
            progressColor = "bg-red-500";
        } else if (balance > 10) { 
            statColor = "bg-amber-100 text-amber-700 border-amber-200";
            progressColor = "bg-amber-500";
        }

        const timelineData = this.calculateTimeline(); 

        let html = `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 sticky top-0 z-30">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h2 class="text-xl font-bold text-gray-800">${this.escape(this.currentSubject.subjectTitle)}</h2>
                        <div class="text-xs text-gray-500 mt-1 flex gap-2">
                            <span class="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                <i class="far fa-calendar-alt"></i> ${this.formatDate(this.config.startDate)} - ${this.formatDate(this.config.endDate)}
                            </span>
                        </div>
                    </div>
                    
                    <div class="flex-1 mx-8">
                        <div class="flex justify-between text-xs font-bold uppercase text-gray-500 mb-1">
                            <span>Planifikatua: ${plannedHours}h</span>
                            <span>Eskuragarri: ${capacityHours}h</span>
                        </div>
                        <div class="h-3 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                            <div class="h-full ${progressColor} transition-all duration-500" style="width: ${pct}%"></div>
                        </div>
                        <div class="text-right mt-1">
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${statColor}">
                                ${balance >= 0 ? `${balance}h libre` : `${Math.abs(balance)}h gehiegi`}
                            </span>
                        </div>
                    </div>

                    <div class="flex gap-2">
                        <button onclick="window.planningManager.openCalendarEditor()" class="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded border border-indigo-200 font-bold text-xs flex items-center gap-2">
                            <i class="fas fa-cog"></i> Egutegia
                        </button>
                        <button onclick="window.planningManager.close()" class="px-3 text-gray-400 hover:text-gray-600 border border-transparent hover:border-gray-200 rounded transition">
                            <i class="fas fa-times text-lg"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        html += `
            <div class="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm select-none">
                <div class="flex bg-slate-100 border-b border-gray-300 text-xs font-bold text-gray-600 uppercase py-2">
                    <div class="w-[400px] px-4 border-r border-gray-300 flex items-center">Jarduera / Unitatea</div>
                    <div class="w-24 text-center border-r border-gray-300 flex items-center justify-center">Hasiera</div>
                    <div class="w-16 text-center border-r border-gray-300 flex items-center justify-center">h</div>
                    <div class="flex-1 px-2 relative h-6 overflow-hidden">Kronograma</div>
                    <div class="w-12 text-center border-l border-gray-300 flex items-center justify-center"><i class="fas fa-tools"></i></div>
                </div>
                
                <div class="bg-slate-50 relative min-h-[300px]">
                    ${this.renderTimelineBackground()}
                    <div class="relative z-10">
                        ${this.renderGanttRows(timelineData)}
                    </div>
                </div>
            </div>
        `;

        html += this.getActivityModalHTML();
        html += this.getCalendarModalHTML();

        container.innerHTML = html;
    }

    // ==========================================
    // 3. CÁLCULOS
    // ==========================================

    calculateRealCapacity() {
        let total = 0;
        let iter = new Date(this.config.startDate);
        const end = new Date(this.config.endDate);
        const schedule = this.config.schedule || [0,0,0,0,0];

        while (iter <= end) {
            const dayIdx = iter.getDay(); 
            const dateStr = iter.toISOString().split('T')[0];
            
            if (dayIdx >= 1 && dayIdx <= 5 && !this.config.holidays.includes(dateStr)) {
                total += (parseFloat(schedule[dayIdx - 1]) || 0);
            }
            iter.setDate(iter.getDate() + 1);
        }
        return total;
    }

    calculatePlannedLoad() {
        let total = 0;
        (this.currentSubject.unitateak || []).forEach(u => {
            if (u.activities) {
                total += u.activities.reduce((sum, a) => sum + (parseFloat(a.duration)||0), 0);
            }
        });
        return total;
    }

    calculateTimeline() {
        let cursorDate = new Date(this.config.startDate);
        const schedule = this.config.schedule || [0,0,0,0,0];

        return (this.currentSubject.unitateak || []).map(u => {
            const actData = (u.activities || []).map(act => {
                const dur = parseFloat(act.duration) || 0;
                if (dur <= 0) return { ...act, computedStart: null, computedEnd: null };

                let start;
                if (act.fixedDate) {
                    cursorDate = new Date(act.fixedDate);
                    cursorDate = this.findNextTeachingMoment(cursorDate);
                } else {
                    cursorDate = this.findNextTeachingMoment(cursorDate);
                }
                
                start = new Date(cursorDate);

                let hoursLeft = dur;
                let safety = 0;
                while (hoursLeft > 0 && safety < 500) {
                    const dayIdx = cursorDate.getDay() - 1; 
                    const dayCapacity = schedule[dayIdx] || 0;
                    
                    if (dayCapacity > 0) hoursLeft -= dayCapacity;
                    
                    if (hoursLeft > 0) {
                        cursorDate.setDate(cursorDate.getDate() + 1);
                        cursorDate = this.findNextTeachingMoment(cursorDate);
                    }
                    safety++;
                }
                const end = new Date(cursorDate);
                cursorDate.setDate(cursorDate.getDate() + 1);

                return { ...act, computedStart: start, computedEnd: end };
            });

            const uStart = actData.length > 0 ? actData[0].computedStart : null;
            const uEnd = actData.length > 0 ? actData[actData.length - 1].computedEnd : null;
            const uHours = actData.reduce((sum, a) => sum + (parseFloat(a.duration)||0), 0);

            u.hours = uHours;
            u.activities = actData; 

            return { ...u, realStart: uStart, realEnd: uEnd, hours: uHours };
        });
    }

    findNextTeachingMoment(date) {
        let d = new Date(date);
        let safe = 0;
        while (safe < 365) {
            const day = d.getDay(); 
            const str = d.toISOString().split('T')[0];
            const isHol = this.config.holidays.includes(str);
            const dayIdx = day - 1; 
            const hasHours = (day >= 1 && day <= 5) && (this.config.schedule[dayIdx] > 0);

            if (!isHol && hasHours) return d;
            d.setDate(d.getDate() + 1);
            safe++;
        }
        return d;
    }

    // ==========================================
    // 4. GANTT CON DRAG & DROP DE FILAS
    // ==========================================

    renderGanttRows(units) {
        if (units.length === 0) return '<div class="p-10 text-center text-gray-400 italic">Ez dago unitaterik.</div>';

        const courseStart = new Date(this.config.startDate).getTime();
        const courseEnd = new Date(this.config.endDate).getTime();
        const totalTime = courseEnd - courseStart;

        let html = '';

        units.forEach((u, uIdx) => {
            const isExpanded = this.expandedUnits.has(uIdx);
            
            // Barra UD
            let uBar = '';
            if (u.realStart && u.realEnd && totalTime > 0) {
                const left = ((u.realStart.getTime() - courseStart) / totalTime) * 100;
                const width = ((u.realEnd.getTime() - u.realStart.getTime()) / totalTime) * 100;
                if (left < 100 && (left + width) > 0) {
                    uBar = `<div class="h-4 rounded bg-indigo-200 border border-indigo-300 absolute top-2 opacity-80" 
                                 style="left: ${Math.max(0, left)}%; width: ${Math.min(100, width)}%;"></div>`;
                }
            }

            html += `
                <div class="flex border-b border-gray-200 bg-white hover:bg-slate-50 transition-colors">
                    <div class="w-[400px] px-4 py-2 border-r border-gray-200 flex items-center gap-2 cursor-pointer" 
                         onclick="window.planningManager.toggleUnit(${uIdx})">
                        <i class="fas fa-chevron-right text-gray-400 text-xs transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}"></i>
                        <div class="font-bold text-sm text-gray-800 truncate">
                            <span class="text-indigo-600 mr-1">${this.escape(u.unitCode.split('_').pop())}</span>
                            ${this.escape(u.unitName)}
                        </div>
                    </div>
                    <div class="w-24 text-center border-r border-gray-200 flex items-center justify-center text-[10px] text-gray-500">
                        ${u.realStart ? this.formatDateShort(u.realStart) : '-'}
                    </div>
                    <div class="w-16 border-r border-gray-200 flex items-center justify-center bg-gray-50 font-mono text-xs font-bold text-gray-600">
                        ${u.hours}
                    </div>
                    <div class="flex-1 relative h-10 border-r border-gray-200 overflow-hidden">
                        ${uBar}
                    </div>
                    <div class="w-12 flex items-center justify-center">
                        <button onclick="window.planningManager.addActivity(${uIdx})" class="text-gray-400 hover:text-emerald-600">
                            <i class="fas fa-plus-circle"></i>
                        </button>
                    </div>
                </div>
            `;

            if (isExpanded && u.activities && u.activities.length > 0) {
                u.activities.forEach((act, aIdx) => {
                    let aBar = '';
                    if (act.computedStart && act.computedEnd && totalTime > 0) {
                        const left = ((act.computedStart.getTime() - courseStart) / totalTime) * 100;
                        const width = ((act.computedEnd.getTime() - act.computedStart.getTime()) / totalTime) * 100;
                        const colorClass = act.fixedDate ? "bg-purple-600" : "bg-indigo-500";
                        if (left < 100 && (left + width) > 0) {
                            aBar = `
                                <div class="h-3 rounded-full ${colorClass} shadow-sm absolute top-2.5 hover:brightness-110 cursor-pointer" 
                                     style="left: ${Math.max(0, left)}%; width: ${Math.max(width, 0.5)}%;"
                                     onclick="window.planningManager.openActivityEditor(${uIdx}, ${aIdx})">
                                </div>`;
                        }
                    }

                    // *** DRAG & DROP EVENTS PARA REORDENAR ACTIVIDADES ***
                    html += `
                        <div class="flex border-b border-gray-100 bg-slate-50 hover:bg-indigo-50/30 transition-colors"
                             draggable="true"
                             ondragstart="window.planningManager.handleRowDragStart(event, ${uIdx}, ${aIdx})"
                             ondragover="window.planningManager.handleRowDragOver(event)"
                             ondrop="window.planningManager.handleRowDrop(event, ${uIdx}, ${aIdx})">
                             
                            <div class="w-[400px] pl-10 pr-4 py-1.5 border-r border-gray-200 flex items-center border-l-4 border-l-transparent hover:border-l-indigo-400">
                                <div class="mr-2 text-gray-300 cursor-grab hover:text-gray-500"><i class="fas fa-grip-vertical text-xs"></i></div>
                                <div class="truncate cursor-pointer hover:text-indigo-600 hover:underline flex-1"
                                      onclick="window.planningManager.openActivityEditor(${uIdx}, ${aIdx})">
                                    <span class="text-xs text-gray-600">${this.escape(act.name) || '<span class="italic text-gray-400">Jarduera izengabea...</span>'}</span>
                                    ${act.fixedDate ? '<i class="fas fa-thumbtack text-[10px] text-purple-500 ml-2"></i>' : ''}
                                </div>
                            </div>
                            <div class="w-24 text-center border-r border-gray-200 flex items-center justify-center text-[10px] text-gray-400 font-mono">
                                ${act.computedStart ? this.formatDateShort(act.computedStart) : '-'}
                            </div>
                            <div class="w-16 border-r border-gray-200 flex items-center justify-center text-[10px] text-gray-500 font-mono">
                                ${act.duration}
                            </div>
                            <div class="flex-1 relative h-8 border-r border-gray-200 overflow-hidden">
                                ${aBar}
                            </div>
                            <div class="w-12 flex items-center justify-center">
                                <button onclick="window.planningManager.openActivityEditor(${uIdx}, ${aIdx})" class="text-gray-300 hover:text-indigo-500 text-xs">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                            </div>
                        </div>
                    `;
                });
            }
        });
        return html;
    }

    renderTimelineBackground() {
        const start = new Date(this.config.startDate);
        const end = new Date(this.config.endDate);
        const totalTime = end - start;
        let html = '<div class="absolute inset-0 flex pointer-events-none">';
        
        let iter = new Date(start);
        iter.setDate(1); 
        
        while (iter < end) {
            const nextMonth = new Date(iter);
            nextMonth.setMonth(iter.getMonth() + 1);
            const left = Math.max(0, (iter - start) / totalTime * 100);
            const width = ((nextMonth - iter) / totalTime * 100);
            
            if (left < 100) {
                html += `
                    <div class="absolute top-0 bottom-0 border-r border-gray-200 flex flex-col justify-end pb-1 pl-1 text-[9px] text-gray-300 uppercase font-bold truncate"
                         style="left: ${left}%; width: ${width}%;">
                        ${iter.toLocaleDateString(undefined, {month:'short'})}
                    </div>
                `;
            }
            iter = nextMonth;
        }
        
        this.config.holidays.forEach(h => {
            const hDate = new Date(h);
            if (hDate >= start && hDate <= end) {
                const left = (hDate - start) / totalTime * 100;
                const width = (1000 * 60 * 60 * 24) / totalTime * 100;
                html += `<div class="absolute top-0 bottom-0 bg-red-100/50 z-0" style="left: ${left}%; width: ${Math.max(width, 0.1)}%;"></div>`;
            }
        });

        html += '</div>';
        return html;
    }

    // --- LÓGICA DRAG & DROP DE FILAS ---
    handleRowDragStart(e, uIdx, aIdx) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('srcU', uIdx);
        e.dataTransfer.setData('srcA', aIdx);
    }

    handleRowDragOver(e) {
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move';
    }

    handleRowDrop(e, targetUIdx, targetAIdx) {
        e.preventDefault();
        const srcU = parseInt(e.dataTransfer.getData('srcU'));
        const srcA = parseInt(e.dataTransfer.getData('srcA'));

        if (srcU === targetUIdx && srcA !== targetAIdx) {
            // Mover dentro de la misma unidad
            const acts = this.currentSubject.unitateak[srcU].activities;
            const [movedItem] = acts.splice(srcA, 1);
            acts.splice(targetAIdx, 0, movedItem);
            this.render(); // Recalcular todo
        } else if (srcU !== targetUIdx) {
            // Mover a otra unidad (opcional, pero soportado)
            if(confirm("Jarduera beste unitate batera mugitu?")) {
                const srcActs = this.currentSubject.unitateak[srcU].activities;
                const targetActs = this.currentSubject.unitateak[targetUIdx].activities;
                const [movedItem] = srcActs.splice(srcA, 1);
                targetActs.splice(targetAIdx, 0, movedItem);
                this.render();
            }
        }
    }

    // ==========================================
    // 5. MODALES
    // ==========================================

    getCalendarModalHTML() {
        const schedule = this.config.schedule || [0,0,0,0,0];
        const days = ['Al','Ar','Az','Og','Or'];
        
        return `
            <div id="calendarModal" class="hidden fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center backdrop-blur-sm">
                <div class="bg-white rounded-xl shadow-2xl w-[900px] h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                    <div class="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
                        <h3 class="font-bold">Egutegia eta Ordutegia</h3>
                        <button onclick="document.getElementById('calendarModal').classList.add('hidden')" class="hover:text-red-300"><i class="fas fa-times text-xl"></i></button>
                    </div>
                    
                    <div class="p-4 bg-gray-50 border-b border-gray-200 grid grid-cols-12 gap-4 shrink-0">
                        <div class="col-span-3"><label class="block text-xs font-bold text-gray-500 mb-1">Hasiera</label><input type="date" id="calStart" class="w-full border rounded p-1 text-sm"></div>
                        <div class="col-span-3"><label class="block text-xs font-bold text-gray-500 mb-1">Amaiera</label><input type="date" id="calEnd" class="w-full border rounded p-1 text-sm"></div>
                        
                        <div class="col-span-6">
                            <label class="block text-xs font-bold text-gray-500 mb-1">Orduak Eguneko (Al-Or)</label>
                            <div class="flex gap-2">
                                ${days.map((d, i) => `
                                    <div class="flex-1">
                                        <span class="text-[9px] text-gray-400 block text-center">${d}</span>
                                        <input type="number" value="${schedule[i]}" min="0" max="8" step="0.5" class="daily-input w-full border rounded p-1 text-center text-sm font-bold text-indigo-600">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="flex-1 overflow-y-auto p-6 bg-white">
                        <p class="text-xs text-gray-400 mb-4 text-center"><i class="fas fa-info-circle"></i> Klikatu egunetan jaiegunak markatzeko.</p>
                        <div id="miniCalContainer" class="grid grid-cols-4 gap-x-4 gap-y-6"></div>
                    </div>

                    <div class="p-4 border-t bg-gray-50 flex justify-end gap-2 shrink-0">
                        <button onclick="window.planningManager.saveCalendarConfig()" class="px-6 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 shadow">Onartu</button>
                    </div>
                </div>
            </div>
        `;
    }

async saveCalendarConfig() {
    this.config.startDate = document.getElementById('calStart').value;
    this.config.endDate = document.getElementById('calEnd').value;

    const inputs = document.querySelectorAll('.daily-input');
    this.config.schedule = Array.from(inputs).map(inp => parseFloat(inp.value) || 0);

    try {
        await gradosManager.updateContentField('calendarConfig', this.config);

        document.getElementById('calendarModal').classList.add('hidden');
        this.render();

        console.log("✅ CalendarConfig eguneratuta");
    } catch (err) {
        console.error("❌ Errorea CalendarConfig gordetzean:", err);
        alert("Errorea gordetzean: " + err.message);
    }
}

    openCalendarEditor() {
        const modal = document.getElementById('calendarModal');
        document.getElementById('calStart').value = this.config.startDate;
        document.getElementById('calEnd').value = this.config.endDate;
        this.renderMiniCalendar();
        modal.classList.remove('hidden');
    }

    renderMiniCalendar() {
        const container = document.getElementById('miniCalContainer');
        container.innerHTML = '';
        const start = new Date(this.config.startDate);
        const end = new Date(this.config.endDate);
        let iter = new Date(start.getFullYear(), start.getMonth(), 1);
        let safeCount = 0;
        while (iter <= end && safeCount < 24) {
            container.appendChild(this.createMonthGrid(new Date(iter)));
            iter.setMonth(iter.getMonth() + 1);
            safeCount++;
        }
    }

    createMonthGrid(date) {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'border border-gray-200 rounded p-2 text-center bg-white shadow-sm';
        const year = date.getFullYear();
        const month = date.getMonth(); 
        const monthNames = ["Urt", "Ots", "Mar", "Api", "Mai", "Eka", "Uzt", "Abu", "Ira", "Urr", "Aza", "Abe"];

        let html = `<div class="font-bold text-xs text-gray-700 mb-1">${monthNames[month]} ${year}</div>`;
        html += `<div class="grid grid-cols-7 gap-0.5 text-[8px] text-gray-400 mb-1"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span class="text-red-300">S</span><span class="text-red-300">D</span></div>`;
        html += `<div class="grid grid-cols-7 gap-0.5">`;

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayObj = new Date(year, month, 1);
        let startDay = firstDayObj.getDay(); 
        if (startDay === 0) startDay = 7; 
        const emptySlots = startDay - 1; 

        for(let i=0; i<emptySlots; i++) html += `<div class="aspect-square"></div>`;

        for(let d=1; d<=daysInMonth; d++) {
            const str = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isHol = this.config.holidays.includes(str);
            const currentDayObj = new Date(year, month, d);
            const dayOfWeek = currentDayObj.getDay(); 
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

            let classes = "w-full aspect-square flex items-center justify-center text-[10px] rounded-sm transition-colors select-none ";
            if (isHol) classes += "bg-red-500 text-white font-bold cursor-pointer hover:bg-red-600 shadow-sm";
            else if (isWeekend) classes += "text-red-300 bg-red-50";
            else classes += "bg-slate-50 text-gray-600 hover:bg-indigo-500 hover:text-white cursor-pointer hover:font-bold";

            const action = (!isWeekend) ? `onclick="window.planningManager.toggleHoliday('${str}')"` : '';
            html += `<div ${action} class="${classes}">${d}</div>`;
        }
        html += `</div>`;
        monthDiv.innerHTML = html;
        return monthDiv;
    }

    toggleHoliday(dateStr) {
        const idx = this.config.holidays.indexOf(dateStr);
        if (idx >= 0) this.config.holidays.splice(idx, 1);
        else this.config.holidays.push(dateStr);
        this.renderMiniCalendar();
    }

    // ==========================================
    // 6. EDITOR DE ACTIVIDAD (CON TRAZABILIDAD)
    // ==========================================

    getActivityModalHTML() {
        return `
            <div id="activityModal" class="hidden fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center backdrop-blur-sm">
                <div class="bg-white rounded-xl shadow-2xl w-[900px] h-[80vh] flex flex-col overflow-hidden animate-fade-in-up">
                    <div class="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
                        <h3 id="modalActTitle" class="text-lg font-bold">Jarduera</h3>
                        <button onclick="document.getElementById('activityModal').classList.add('hidden')" class="hover:text-red-300"><i class="fas fa-times text-xl"></i></button>
                    </div>
                    <div class="flex-1 overflow-hidden flex">
                        <div class="w-7/12 p-6 overflow-y-auto space-y-4 border-r border-gray-200">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Titulua</label>
                                <input type="text" id="inputActName" class="w-full border border-gray-300 rounded p-2 text-sm focus:border-indigo-500 outline-none font-bold">
                            </div>
                            
                            <div class="flex gap-4">
                                <div class="w-1/2">
                                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Iraupena (Orduak)</label>
                                    <input type="number" id="inputActHours" step="0.5" class="w-full border border-gray-300 rounded p-2 text-sm font-mono font-bold text-indigo-600">
                                </div>
                                <div class="w-1/2">
                                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Data Finkoa</label>
                                    <input type="date" id="inputActFixedDate" class="w-full border border-gray-300 rounded p-2 text-sm text-gray-600">
                                </div>
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Deskribapena</label>
                                <textarea id="inputActDesc" class="w-full border border-gray-300 rounded p-2 text-sm h-24 resize-none"></textarea>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Baliabideak</label>
                                    <textarea id="inputActResources" class="w-full border border-gray-300 rounded p-2 text-sm h-20 resize-none"></textarea>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Ebaluazioa</label>
                                    <textarea id="inputActEval" class="w-full border border-gray-300 rounded p-2 text-sm h-20 resize-none"></textarea>
                                </div>
                            </div>
                        </div>
                        <div class="w-5/12 p-6 flex flex-col bg-slate-50">
                            <h4 class="text-xs font-bold text-gray-500 uppercase mb-3">Deskriptoreen Lerrokadura</h4>
                            <div class="flex-1 flex flex-col gap-4 min-h-0">
                                <div class="flex-1 flex flex-col">
                                    <span class="text-[10px] font-bold text-indigo-600 mb-1">Jardueran esleituta:</span>
                                    <div id="modalAssignedList" class="flex-1 bg-white border-2 border-dashed border-indigo-200 rounded p-2 overflow-y-auto"
                                         ondragover="event.preventDefault();" ondrop="window.planningManager.handleDropModal(event)"></div>
                                </div>
                                <div class="h-1/3 flex flex-col">
                                    <span class="text-[10px] font-bold text-gray-400 mb-1">Eskuragarri (Unitatetik):</span>
                                    <div id="modalAvailableList" class="flex-1 bg-gray-100 border border-gray-200 rounded p-2 overflow-y-auto"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="p-4 border-t bg-gray-50 flex justify-between items-center shrink-0">
                        <button onclick="window.planningManager.deleteActivityFromModal()" class="text-red-500 text-xs font-bold hover:underline uppercase"><i class="fas fa-trash mr-1"></i> Ezabatu</button>
                        <div class="flex gap-2">
                            <button onclick="document.getElementById('activityModal').classList.add('hidden')" class="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded">Utzi</button>
                            <button onclick="window.planningManager.saveActivityFromModal()" class="px-6 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 shadow">Gorde</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    openActivityEditor(uIdx, aIdx) {
        this.editContext = { uIdx, aIdx };
        const u = this.currentSubject.unitateak[uIdx];
        const act = u.activities[aIdx];
        
        document.getElementById('modalActTitle').innerText = `${u.unitCode} > ${act.name || 'Jarduera'}`;
        document.getElementById('inputActName').value = act.name || '';
        document.getElementById('inputActDesc').value = act.description || '';
        document.getElementById('inputActHours').value = act.duration || 0;
        document.getElementById('inputActFixedDate').value = act.fixedDate || ''; 
        document.getElementById('inputActResources').value = act.resources || '';
        document.getElementById('inputActEval').value = act.evaluation || '';

        this.renderModalDragDrop(u, act);
        document.getElementById('activityModal').classList.remove('hidden');
    }

    renderModalDragDrop(unit, activity) {
        const assignedContainer = document.getElementById('modalAssignedList');
        const availableContainer = document.getElementById('modalAvailableList');
        const assigned = activity.assignedDescriptors || [];
        const unitDescriptors = unit.descriptores || [];

        // 1. Identificar descriptores usados en OTRAS actividades de esta misma unidad
        const usedElsewhere = new Set();
        (unit.activities || []).forEach(a => {
            if (a !== activity && a.assignedDescriptors) {
                a.assignedDescriptors.forEach(d => usedElsewhere.add(d));
            }
        });

        // 2. Render Asignados
        assignedContainer.innerHTML = assigned.map((d, i) => `
            <div class="flex justify-between items-center p-2 bg-indigo-50 border border-indigo-100 rounded text-xs text-indigo-800 mb-1 group">
                <span class="truncate pr-2">${this.escape(d)}</span>
                <button onclick="window.planningManager.removeDescFromModal(${i})" class="text-red-400 hover:text-red-600"><i class="fas fa-times"></i></button>
            </div>
        `).join('');

        // 3. Render Disponibles (Con sombra si ya están usados)
        const available = unitDescriptors.filter(d => !assigned.includes(d));
        
        availableContainer.innerHTML = available.map(d => {
            const isUsed = usedElsewhere.has(d);
            const bgClass = isUsed ? "bg-gray-100 text-gray-400" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:shadow-sm cursor-grab";
            const icon = isUsed ? '<i class="fas fa-check-circle text-gray-300 mr-1"></i>' : '';
            
            return `
            <div draggable="true" 
                 ondragstart="window.planningManager.handleDragStartModal(event, '${this.escape(d)}')"
                 class="p-2 border rounded text-xs mb-1 truncate select-none flex items-center ${bgClass}">
                ${icon} ${this.escape(d)}
            </div>
        `}).join('');
    }

async saveActivityFromModal() {
    const { uIdx, aIdx } = this.editContext;
    const act = this.currentSubject.content.unitateak[uIdx].activities[aIdx];

    act.name = document.getElementById('inputActName').value;
    act.description = document.getElementById('inputActDesc').value;
    act.duration = parseFloat(document.getElementById('inputActHours').value) || 0;
    act.fixedDate = document.getElementById('inputActFixedDate').value || null;
    act.resources = document.getElementById('inputActResources').value;
    act.evaluation = document.getElementById('inputActEval').value;

    try {
        await gradosManager.updateContentField('unitateak', this.currentSubject.content.unitateak);

        document.getElementById('activityModal').classList.add('hidden');
        this.render();

        console.log("✅ Jarduera eguneratuta");
    } catch (err) {
        console.error("❌ Errorea jarduera gordetzean:", err);
        alert("Errorea gordetzean: " + err.message);
    }
}


    deleteActivityFromModal() {
        if(confirm('Ezabatu?')) {
            const { uIdx, aIdx } = this.editContext;
            this.currentSubject.unitateak[uIdx].activities.splice(aIdx, 1);
            document.getElementById('activityModal').classList.add('hidden');
            this.render();
        }
    }

    handleDragStartModal(e, txt) { e.dataTransfer.setData("txt", txt); }
    handleDropModal(e) {
        e.preventDefault();
        const txt = e.dataTransfer.getData("txt");
        if (!txt) return;
        const { uIdx, aIdx } = this.editContext;
        const act = this.currentSubject.unitateak[uIdx].activities[aIdx];
        if(!act.assignedDescriptors) act.assignedDescriptors = [];
        if(!act.assignedDescriptors.includes(txt)) {
            act.assignedDescriptors.push(txt);
            this.renderModalDragDrop(this.currentSubject.unitateak[uIdx], act);
        }
    }
    removeDescFromModal(idx) {
        const { uIdx, aIdx } = this.editContext;
        const act = this.currentSubject.unitateak[uIdx].activities[aIdx];
        act.assignedDescriptors.splice(idx, 1);
        this.renderModalDragDrop(this.currentSubject.unitateak[uIdx], act);
    }

    // ==========================================
    // UTILIDADES
    // ==========================================

    toggleUnit(idx) {
        if (this.expandedUnits.has(idx)) this.expandedUnits.delete(idx);
        else this.expandedUnits.add(idx);
        this.render();
    }

    addActivity(uIdx) {
        if(!this.currentSubject.unitateak[uIdx].activities) this.currentSubject.unitateak[uIdx].activities = [];
        this.currentSubject.unitateak[uIdx].activities.push({ name: "", duration: 2 });
        this.openActivityEditor(uIdx, this.currentSubject.unitateak[uIdx].activities.length - 1);
    }

    escape(text) {
        if (text === null || text === undefined) return "";
        return String(text).replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    formatDate(d) { return new Date(d).toLocaleDateString(); }
    formatDateShort(d) { 
        return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }); 
    }
}


window.planningManager = new PlanningManager();

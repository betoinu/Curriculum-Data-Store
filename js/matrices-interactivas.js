/**
 * matrices-interactivas.js - JATORRIZKO LOGIKA (AUTO-SAVE)
 * Zuzeneko aldaketak + gordetze isila berreskuratuta.
 */
import { getSupabaseInstance } from './config.js';

let gradosManager;
export function setGradosManager(manager) { 
    gradosManager = manager; 
    console.log('✅ MatricesInteractivas: GradosManager konektatuta.');
}

class MatricesInteractivas {
    constructor() {
        this.matrizPanel = null;
        // GAKOA: Botoiek HTMLtik 'window.matricesInteractivas' bilatzen dute.
        window.matricesInteractivas = this; 
    }

    safe(v) { 
        return (v === null || v === undefined) ? "" : String(v).replace(/'/g, "&#39;").replace(/"/g, "&quot;"); 
    }

    // -----------------------------------------------------------------------
    // 1. IREKI
    // -----------------------------------------------------------------------
    mostrarMatrizAlineacion() {
        // Managerra ziurtatu
        if (!gradosManager && window.gradosManager) gradosManager = window.gradosManager;
        
        const s = gradosManager?.currentSubject;
        if (!s) return alert("Errorea: Ez da asignatura hautatu.");

        // Datu egitura ziurtatu
        if (!s.matrizAlineacion) s.matrizAlineacion = { evidencias: [], descriptores: [] };
        if (!s.subjectCritEval) s.subjectCritEval = [];

        // Panela sortu
        if (!this.matrizPanel) {
            this.matrizPanel = document.createElement('div');
            this.matrizPanel.id = 'matricesPanel';
            this.matrizPanel.className = 'fixed inset-0 bg-slate-100 z-[10000] flex flex-col font-sans overflow-hidden';
            document.body.appendChild(this.matrizPanel);
        }
        
        this.matrizPanel.classList.remove('hidden');
        this.render();
    }

    // -----------------------------------------------------------------------
    // 2. RENDER (Zuzeneko datuak irakurtzen ditu)
    // -----------------------------------------------------------------------
    render() {
        const s = gradosManager.currentSubject; // ZUZENEKOA
        
        const descsLib = this.obtenerDescriptoresUnidades(s);
        const ras = [...(s.currentOfficialRAs || []), ...(s.zhRAs || [])];
        const allCes = s.subjectCritEval || [];

        // Erabilera kalkulatu
        const usoDescriptores = {};
        (s.matrizAlineacion.descriptores || []).forEach(d => {
            const txt = d.desc.trim();
            usoDescriptores[txt] = (usoDescriptores[txt] || 0) + 1;
        });

        this.matrizPanel.innerHTML = `
            <div class="bg-slate-900 text-white p-4 flex justify-between items-center shadow-xl shrink-0">
                <div class="flex items-center gap-4">
                    <button onclick="window.matricesInteractivas.volver()" class="hover:text-indigo-400 transition-colors">
                        <i class="fas fa-arrow-left text-xl"></i>
                    </button>
                    <div>
                        <h1 class="text-lg font-bold">${s.subjectTitle}</h1>
                        <p class="text-[9px] text-indigo-400 font-bold uppercase tracking-widest italic">EDITATZEN (Auto-Save Aktibatuta)</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.matricesInteractivas.importarCSV()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-bold transition-all border border-blue-400 flex items-center gap-2">
                        <i class="fas fa-file-upload"></i> INPORTATU
                    </button>
                    <button onclick="window.matricesInteractivas.exportarCSV()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-bold transition-all flex items-center gap-2">
                        <i class="fas fa-file-download"></i> EXPORTATU
                    </button>
                    <button onclick="window.matricesInteractivas.guardar()" class="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-[10px] font-bold shadow-lg transition-all flex items-center gap-2 ml-2">
                        <i class="fas fa-save"></i> GORDE
                    </button>
                </div>
            </div>

            <div class="flex flex-1 overflow-hidden">
                <div class="w-72 bg-slate-800 p-4 overflow-y-auto border-r border-slate-900 shadow-2xl flex flex-col gap-4">
                    <div>
                        <h3 class="text-white/40 text-[9px] font-black uppercase mb-2 tracking-tighter sticky top-0 bg-slate-800 py-2">Liburutegia (${descsLib.length})</h3>
                        <div class="space-y-2 pb-10">
                            ${descsLib.map(d => {
                                const count = usoDescriptores[d.trim()] || 0;
                                const isUsed = count > 0;
                                const bgClass = isUsed 
                                    ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-100" 
                                    : "bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-indigo-400 hover:text-white";

                                return `
                                <div draggable="true" 
                                     class="p-2 border rounded text-[10px] cursor-grab active:cursor-grabbing transition-all flex justify-between items-start gap-2 group ${bgClass}"
                                     ondragstart="event.dataTransfer.setData('text/plain', '${this.safe(d)}')">
                                    <span class="leading-snug break-words w-full">${d}</span>
                                    ${isUsed 
                                        ? `<span class="shrink-0 bg-emerald-500 text-slate-900 font-bold px-1.5 rounded-full text-[9px] shadow-sm" title="Erabilia ${count} aldiz">${count}</span>`
                                        : `<span class="opacity-0 group-hover:opacity-100 text-[8px] text-indigo-300"><i class="fas fa-grip-vertical"></i></span>`
                                    }
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <div class="flex-1 overflow-auto p-6 bg-slate-50">
                    <div class="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200 min-w-[800px]">
                        <table class="w-full border-collapse table-fixed">
                            <thead>
                                <tr class="bg-slate-800 text-white/50 text-[9px] uppercase tracking-widest sticky top-0 z-10">
                                    <th class="p-3 text-left w-48 border-r border-slate-700">RA (Resultado)</th>
                                    <th class="p-3 text-left w-64 border-r border-slate-700">CE (Criterio)</th>
                                    <th class="p-3 text-left w-64 border-r border-slate-700">Ebidentzia</th>
                                    <th class="p-3 text-left w-64">Deskriptoreak (Arrastra aquí)</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${this.renderEngine(ras, allCes, s)}
                            </tbody>
                        </table>
                    </div>
                    <div class="h-24"></div>
                </div>
            </div>`;
    }

renderEngine(ras, allCes, s) {
        let html = '';

        // =========================================================
        // 1. IKASKUNTZA EMAITZA TEKNIKOAK (RA)
        // =========================================================
        const rasTeknikoak = s.currentOfficialRAs || [];
        
        rasTeknikoak.forEach(ra => {
            // ZUZENEAN hartu memorian dagoen kodea (Ezer asmatu gabe)
            const idBistaratzeko = String(ra.raCode || ra.code || ra.id || '').trim();
            const raDescription = ra.raDesc || ra.desc || ra.description || ra.name || '';
            
            // Irizpideak irakurri kode zehatz horrekin
            const ces = allCes.filter(c => {
                const rel = String(c.raRelacionado || '').trim();
                const code = String(c.ceCode || '').trim();
                // Bat dator raRelacionado-rekin EDO bere ceCode horrela hasten bada (adib: "BD3_RA1_CE1")
                return rel === idBistaratzeko || (idBistaratzeko && code.startsWith(`${idBistaratzeko}_`));
            });

            if (ces.length > 0) {
                ces.forEach((ce, i) => {
                    html += this.rowTemplate(idBistaratzeko, raDescription, ce, i === 0, ces.length, s);
                });
            } else {
                html += `<tr>
                    <td class="p-4 border-r bg-slate-50/50 align-top">
                        <span class="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-black mb-2 border border-indigo-100">${idBistaratzeko}</span>
                        <p class="text-[11px] text-slate-700 leading-tight">${raDescription}</p>
                    </td>
                    <td colspan="3" class="p-4 bg-indigo-50/10 border-b border-indigo-100">
                        <button onclick="window.matricesInteractivas.nuevoCE('${idBistaratzeko}')" class="w-full py-4 text-[10px] font-bold text-indigo-400 hover:text-indigo-600 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-lg transition-all uppercase">
                            <i class="fas fa-plus-circle mr-2"></i> Sortu lehen irizpidea (${idBistaratzeko})
                        </button>
                    </td>
                </tr>`;
            }
        });

        // =========================================================
        // 2. ZEHARKAKO IKASKUNTZA EMAITZAK (ZH)
        // =========================================================
        const rasZeharkakoak = s.zhRAs || [];
        
        if (rasZeharkakoak.length > 0) {
            html += `<tr class="bg-slate-200">
                <td colspan="4" class="p-3 text-[10px] font-black text-slate-700 uppercase tracking-widest border-y border-slate-300 bg-slate-200/80">
                    <i class="fas fa-project-diagram mr-2 text-indigo-500"></i> Zeharkako Ikaskuntza Emaitzak (ZH)
                </td>
            </tr>`;
            
            rasZeharkakoak.forEach(zh => {
                // ZUZENEAN hartu memorian dagoen kodea ("ZH1", "ZH2"...) zero estrarik gabe
                const idBistaratzeko = String(zh.zhCode || zh.code || zh.id || '').trim();
                const zhDescription = zh.zhDesc || zh.desc || zh.description || zh.name || '';
                
                // Irizpideak irakurri kode zehatz horrekin
                const ces = allCes.filter(c => {
                    const rel = String(c.raRelacionado || '').trim();
                    const code = String(c.ceCode || '').trim();
                    
                    // Bat dator raRelacionado-rekin EDO bere ceCode horrela hasten bada (adib: "ZH1.CE1")
                    return rel === idBistaratzeko || (idBistaratzeko && code.startsWith(`${idBistaratzeko}.`));
                });

                if (ces.length > 0) {
                    ces.forEach((ce, i) => {
                        html += this.rowTemplate(idBistaratzeko, zhDescription, ce, i === 0, ces.length, s);
                    });
                } else {
                    html += `<tr>
                        <td class="p-4 border-r bg-slate-50/50 align-top">
                            <span class="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-black mb-2 border border-indigo-100">${idBistaratzeko}</span>
                            <p class="text-[11px] text-slate-700 leading-tight">${zhDescription}</p>
                        </td>
                        <td colspan="3" class="p-4 bg-indigo-50/10 border-b border-indigo-100">
                            <button onclick="window.matricesInteractivas.nuevoCE('${idBistaratzeko}')" class="w-full py-4 text-[10px] font-bold text-indigo-400 hover:text-indigo-600 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-lg transition-all uppercase">
                                <i class="fas fa-plus-circle mr-2"></i> Sortu lehen irizpidea (${idBistaratzeko})
                            </button>
                        </td>
                    </tr>`;
                }
            });
        }

        return html;
    }

    rowTemplate(raId, raDesc, ce, isFirst, total, s) {
        // ZUZENEKO DATUAK ERABILI (s.matrizAlineacion...)
        const ev = s.matrizAlineacion.evidencias.find(e => e.ceCode === ce.ceCode)?.evDesc || '';
        const dList = s.matrizAlineacion.descriptores.filter(d => d.ceCode === ce.ceCode);

        return `
            <tr class="align-top hover:bg-yellow-50/50 transition-colors group">
                ${isFirst ? `
                <td class="p-4 border-r bg-slate-50/50" rowspan="${total}">
                    <div class="sticky top-12">
                        <span class="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-black mb-2 border border-indigo-100">${raId}</span>
                        <p class="text-[10px] text-slate-600 leading-tight mb-3 line-clamp-6" title="${this.safe(raDesc)}">${raDesc}</p>
                        <button onclick="window.matricesInteractivas.nuevoCE('${raId}')" class="text-[9px] font-bold text-indigo-400 hover:text-indigo-600 transition-colors uppercase flex items-center gap-1">
                            <i class="fas fa-plus"></i> Irizpidea
                        </button>
                    </div>
                </td>` : ''}
                
                <td class="p-3 border-r relative border-b border-slate-100">
                    <div class="flex justify-between items-center mb-1">
                        <input type="text" value="${ce.ceCode}" 
                               onblur="window.matricesInteractivas.updateCE('${ce.ceCode}', 'ceCode', this.value)"
                               class="text-[9px] font-black text-slate-400 hover:text-indigo-500 bg-transparent border-none p-0 focus:ring-0 w-full uppercase transition-colors">
                        <button onclick="window.matricesInteractivas.eliminarCE('${ce.ceCode}')" class="text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all px-2">
                            <i class="fas fa-trash-alt text-[10px]"></i>
                        </button>
                    </div>
                    <textarea onblur="window.matricesInteractivas.updateCE('${ce.ceCode}', 'ceDesc', this.value)"
                              class="w-full text-[11px] text-slate-700 leading-snug bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-300 rounded p-1 resize-none h-20 transition-all outline-none" placeholder="Deskribapena...">${ce.ceDesc || ''}</textarea>
                </td>

                <td class="p-3 border-r bg-white border-b border-slate-100">
                    <textarea onblur="window.matricesInteractivas.updateEv('${ce.ceCode}', this.value)"
                              class="w-full h-full text-[11px] text-slate-600 border border-transparent hover:border-slate-200 focus:border-indigo-300 focus:bg-white rounded p-2 bg-slate-50/30 resize-none min-h-[100px] outline-none transition-all"
                              placeholder="Idatzi ebidentzia hemen...">${ev}</textarea>
                </td>

                <td class="p-3 bg-slate-50/30 border-b border-slate-100">
                    <div class="drop-zone min-h-[100px] flex flex-wrap gap-1.5 align-content-start p-1 rounded border border-dashed border-slate-200 hover:border-indigo-300 transition-colors"
                         data-ce="${ce.ceCode}"
                         ondragover="event.preventDefault(); this.classList.add('bg-indigo-50');"
                         ondragleave="this.classList.remove('bg-indigo-50')"
                         ondrop="this.classList.remove('bg-indigo-50'); window.matricesInteractivas.handleDrop(event)">
                        ${dList.length === 0 ? '<span class="text-[9px] text-slate-300 w-full text-center italic mt-4 pointer-events-none">Arrastra descriptores aquí</span>' : ''}
                        ${dList.map(d => `
                            <span class="bg-indigo-600 text-white text-[9px] pl-2 pr-1 py-1 rounded-sm flex items-center gap-1 shadow-sm group/tag hover:bg-indigo-700 transition-colors cursor-default max-w-full">
                                <span class="truncate max-w-[120px] block" title="${this.safe(d.desc)}">${d.desc}</span>
                                <button class="text-indigo-300 hover:text-white px-1" 
                                   onclick="window.matricesInteractivas.rem('${ce.ceCode}', '${this.safe(d.desc)}')">&times;</button>
                            </span>
                        `).join('')}
                    </div>
                </td>
            </tr>`;
    }

    // -----------------------------------------------------------------------
    // 3. EDIZIO FUNTZIOAK (Zuzenekoak + Auto-Save)
    // -----------------------------------------------------------------------

    nuevoCE(raId) {
        const s = gradosManager.currentSubject;
        const newCode = `${raId}_CE${Date.now().toString().slice(-3)}`;
        s.subjectCritEval.push({ ceCode: newCode, ceDesc: "", raRelacionado: raId });
        this.render();
        this.guardarSilencioso(); // AUTO-SAVE
    }

    updateCE(oldCode, field, value) {
        const s = gradosManager.currentSubject;
        const ce = s.subjectCritEval.find(c => c.ceCode === oldCode);
        if (ce) {
            ce[field] = value;
            if (field === 'ceCode') {
                s.matrizAlineacion.evidencias.forEach(e => { if(e.ceCode === oldCode) e.ceCode = value; });
                s.matrizAlineacion.descriptores.forEach(d => { if(d.ceCode === oldCode) d.ceCode = value; });
            }
            this.render();
            this.guardarSilencioso(); // AUTO-SAVE
        }
    }

    eliminarCE(code) {
        if (!confirm("Ziur zaude? Datu guztiak galduko dira.")) return;
        const s = gradosManager.currentSubject;
        s.subjectCritEval = s.subjectCritEval.filter(c => c.ceCode !== code);
        s.matrizAlineacion.descriptores = s.matrizAlineacion.descriptores.filter(d => d.ceCode !== code);
        s.matrizAlineacion.evidencias = s.matrizAlineacion.evidencias.filter(e => e.ceCode !== code);
        this.render();
        this.guardarSilencioso(); // AUTO-SAVE
    }

    handleDrop(e) {
        e.preventDefault();
        const zone = e.target.closest('.drop-zone');
        if (!zone) return;
        const ceCode = zone.dataset.ce;
        const desc = e.dataTransfer.getData("text/plain");
        if (ceCode && desc) {
            const mat = gradosManager.currentSubject.matrizAlineacion;
            if (!mat.descriptores.some(d => d.ceCode === ceCode && d.desc === desc)) {
                mat.descriptores.push({ ceCode, desc });
                this.render();
                this.guardarSilencioso(); // AUTO-SAVE
            }
        }
    }

    updateEv(ce, val) {
        const mat = gradosManager.currentSubject.matrizAlineacion;
        let ev = mat.evidencias.find(e => e.ceCode === ce);
        if (ev) ev.evDesc = val; 
        else if(val) mat.evidencias.push({ ceCode: ce, evDesc: val });
        this.guardarSilencioso(); // AUTO-SAVE
    }

    rem(ce, d) {
        const mat = gradosManager.currentSubject.matrizAlineacion;
        mat.descriptores = mat.descriptores.filter(x => !(x.ceCode === ce && x.desc === d));
        this.render();
        this.guardarSilencioso(); // AUTO-SAVE
    }

    obtenerDescriptoresUnidades(s) {
        const set = new Set();
        (s.unitateak || []).forEach(u => (u.descriptores || []).forEach(d => d && set.add(d.trim())));
        return Array.from(set).sort();
    }

    // --- CSV (Zure funtzio berdinak) ---
    exportarCSV() {
        const s = gradosManager.currentSubject;
        let csv = "\ufeffRA;CE_KODEA;CE_DESKRIBAPENA;EBIDENTZIA;DESKRIPTOREAK\n";
        (s.subjectCritEval || []).forEach(ce => {
            const ev = (s.matrizAlineacion.evidencias.find(e => e.ceCode === ce.ceCode)?.evDesc || "").replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""');
            const ds = s.matrizAlineacion.descriptores.filter(d => d.ceCode === ce.ceCode).map(d => d.desc).join(" | ");
            const descCe = (ce.ceDesc || "").replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""');
            csv += `${ce.raRelacionado};${ce.ceCode};"${descCe}";"${ev}";"${ds}"\n`;
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        link.download = `Matrizea_${s.subjectTitle}.csv`;
        link.click();
    }

    importarCSV() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => this.procesarCSV(event.target.result);
            reader.readAsText(file);
        };
        input.click();
    }

    procesarCSV(csvText) {
        const s = gradosManager.currentSubject;
        if (!confirm("Inportazioak datuak batu/eguneratuko ditu. Ziur zaude?")) return;
        const lines = csvText.split(/\r\n|\n/);
        let count = 0;
        const startIdx = (lines[0] && lines[0].toUpperCase().includes('RA;')) ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = this.parseCSVLine(line); 
            if (parts.length < 2) continue; 

            const raId = parts[0]?.trim();
            const ceCode = parts[1]?.trim();
            const ceDesc = parts[2]?.trim() || ""; 
            const evDesc = parts[3]?.trim() || "";
            const descString = parts[4]?.trim() || "";

            if (!ceCode) continue;

            let ce = s.subjectCritEval.find(c => c.ceCode === ceCode);
            if (ce) { if (ceDesc) ce.ceDesc = ceDesc; } 
            else { s.subjectCritEval.push({ ceCode, ceDesc, raRelacionado: raId }); }

            if (evDesc) {
                let evObj = s.matrizAlineacion.evidencias.find(e => e.ceCode === ceCode);
                if (evObj) evObj.evDesc = evDesc;
                else s.matrizAlineacion.evidencias.push({ ceCode, evDesc });
            }

            if (descString) {
                const descs = descString.split('|').map(d => d.trim()).filter(d => d);
                descs.forEach(d => {
                    if (!s.matrizAlineacion.descriptores.some(x => x.ceCode === ceCode && x.desc === d)) {
                        s.matrizAlineacion.descriptores.push({ ceCode, desc: d });
                    }
                });
            }
            count++;
        }
        this.render();
        this.guardarSilencioso();
        alert(`✅ ${count} erregistro prozesatu dira.`);
    }

    parseCSVLine(text) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ';' && !inQuotes) {
                result.push(current.replace(/^"|"$/g, '').replace(/""/g, '"'));
                current = '';
            } else current += char;
        }
        result.push(current.replace(/^"|"$/g, '').replace(/""/g, '"'));
        return result;
    }

    // --- GORDE ETA IRTEN ---
        volver() { this.matrizPanel.classList.add('hidden'); }
    
        async guardar() { 
            const s = gradosManager?.currentSubject;
            if (!s) return;
    
            try {
                // UX: Botoiari karga ikonoa jarri
                const btn = document.querySelector('button[onclick="window.matricesInteractivas.guardar()"]');
                if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GORDETZEN...';
    
                // Zure funtzio berriarekin bateragarria
                if (typeof gradosManager.updateContentField === 'function') {
                    // Biak sekuentzialki gorde Supabasen gatazkarik ez sortzeko
                    await gradosManager.updateContentField('matrizAlineacion', s.matrizAlineacion);
                    await gradosManager.updateContentField('subjectCritEval', s.subjectCritEval);
                } 
                // Badaezpadako fallback-a (funtzio zaharra balego)
                else if (gradosManager?.saveData) {
                    await gradosManager.saveData();
                }
    
                if (btn) btn.innerHTML = '<i class="fas fa-save"></i> GORDE';
                alert("✅ Matrizea eta Ebaluazio Irizpideak ondo gorde dira!"); 
                
            } catch (error) {
                console.error("❌ Errorea matrizea gordetzean:", error);
                alert("Errorea gordetzean: " + error.message);
                
                // Botoia leheneratu errore bat badago
                const btn = document.querySelector('button[onclick="window.matricesInteractivas.guardar()"]');
                if (btn) btn.innerHTML = '<i class="fas fa-save"></i> GORDE';
            }
        }
        
        // Auto-Save funtzio isila (UI-a aldatu gabe)
        guardarSilencioso() { 
                if (this.saveTimeout) clearTimeout(this.saveTimeout);
                // Espera 1.5s desde que dejas de teclear/arrastrar para no saturar la BD
                this.saveTimeout = setTimeout(async () => {
                    const s = gradosManager?.currentSubject;
                    if (s && typeof gradosManager.updateContentField === 'function') {
                        // Guarda directamente usando tu función unificada
                        await gradosManager.updateContentField('matrizAlineacion', s.matrizAlineacion);
                        await gradosManager.updateContentField('subjectCritEval', s.subjectCritEval);
                    }
                }, 1500);
            }
    }

// ---------------------------------------------
// GAKOA: HEMEN INSTANTZIATZEN DA KLASEA
// Honek botoiak (onclick) funtzionarazten ditu.
// ---------------------------------------------
const matricesInteractivas = new MatricesInteractivas();
window.matricesInteractivas = matricesInteractivas;
export default matricesInteractivas;







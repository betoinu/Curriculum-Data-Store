// app.js - VERSI車N FINAL CON PLANNING MANAGER
console.log('?? app.js: Cargando coordinador...');

const AppCoordinator = {
    modules: {},
    events: {},
    supabase: null,
    matricesInteractivas: null,
    planningManager: null, // <--- NUEVO

    // ========== M谷TODOS ==========
    
    registerModule(name, module) {
        console.log(`?? M車dulo registrado: ${name}`);
        this.modules[name] = module;
        
        if (name === 'matrices-interactivas') {
            this.matricesInteractivas = module;
            window.matricesInteractivas = module;
        }
        // <--- NUEVO: Registro espec赤fico para Planning
        if (name === 'planning-manager') {
            this.planningManager = module;
            window.planningManager = module;
        }
        
        if (this.events[`module:${name}:registered`]) {
            this.events[`module:${name}:registered`].forEach(callback => callback(module));
        }
    },
    
    getModule(name) {
        return this.modules[name];
    },
    
    async loadModule(name) {
        console.log(`?? Cargando m車dulo: ${name}`);
        
        try {
            switch(name) {
                case 'grados-manager':
                    const gmModule = await import('./grados-manager.js');
                    if (gmModule.default) {
                        window.gradosManager = gmModule.default;
                        this.registerModule('grados-manager', gmModule.default);
                    } else if (window.gradosManager) {
                        this.registerModule('grados-manager', window.gradosManager);
                    }
                    break;
                    
                case 'ui':
                    const uiModule = await import('./ui.js');
                    if (uiModule.default) {
                        window.ui = uiModule.default;
                        this.registerModule('ui', uiModule.default);
                    } else if (window.ui) {
                        this.registerModule('ui', window.ui);
                    }
                    break;
                    
                case 'matrices-interactivas':
                    const matricesModule = await import('./matrices-interactivas.js');
                    if (matricesModule.default) {
                        this.registerModule('matrices-interactivas', matricesModule.default);
                    } else if (matricesModule.matricesInteractivas) {
                        this.registerModule('matrices-interactivas', matricesModule.matricesInteractivas);
                    }
                    break;

                // <--- NUEVO: Caso para cargar el Planning Manager
                case 'planning-manager':
                    const planningModule = await import('./planning-manager.js');
                    if (planningModule.default) {
                        this.registerModule('planning-manager', planningModule.default);
                    } else if (window.planningManager) {
                        this.registerModule('planning-manager', window.planningManager);
                    }
                    break;
                    
                default:
                    console.warn(`?? M車dulo desconocido: ${name}`);
            }
        } catch (error) {
            console.error(`? Error cargando m車dulo ${name}:`, error);
            throw error;
        }
    },
    
    async initialize() {
        console.log('?? Inicializando aplicaci車n...');
        
        try {
            // 1. Inicializar Supabase
            console.log('1. Inicializando Supabase...');
            const { inicializarSupabase, getSupabaseInstance } = await import('./config.js');
            await inicializarSupabase();
            
            this.supabase = getSupabaseInstance();
            if (!this.supabase) throw new Error("No se pudo obtener instancia de Supabase");
            console.log('? Supabase inicializado');
            
            // 2. Cargar m車dulos
            console.log('2. Cargando m車dulos...');
            await this.loadModule('grados-manager');
            await this.loadModule('ui');
            await this.loadModule('matrices-interactivas');
            await this.loadModule('planning-manager'); // <--- NUEVO: Carga del fichero
            
            // 3. Inicializar GradosManager (Core)
            console.log('3. Inicializando GradosManager...');
            const gradosManager = this.getModule('grados-manager');
            if (gradosManager && gradosManager.initialize) {
                await gradosManager.initialize();
                console.log('? GradosManager inicializado');
            }
            
            // 4. Configurar Dependencias (Inyecci車n)
            console.log('4. Configurando dependencias...');
            
            // A) Matrices Interactivas
            const matricesModule = this.getModule('matrices-interactivas');
            if (matricesModule && matricesModule.setGradosManager && gradosManager) {
                matricesModule.setGradosManager(gradosManager);
                console.log('?? matricesInteractivas <-> gradosManager');
            }

            // B) Planning Manager <--- NUEVO: Vinculaci車n
            const planningModule = this.getModule('planning-manager');
            if (planningModule && planningModule.setGradosManager && gradosManager) {
                planningModule.setGradosManager(gradosManager);
                console.log('?? planningManager <-> gradosManager');
            }
            
            // 5. Exposici車n Global de Seguridad
            if (!window.matricesInteractivas && this.matricesInteractivas) window.matricesInteractivas = this.matricesInteractivas;
            if (!window.planningManager && this.planningManager) window.planningManager = this.planningManager; // <--- NUEVO
            
            console.log('?? Aplicaci車n lista');
            this.verifyGlobalObjects();
            
        } catch (error) {
            console.error('?? Error inicializando aplicaci車n:', error);
            this.showError(error); // Usar el m谷todo interno
            throw error;
        }
    },
    
    verifyGlobalObjects() {
        console.log('?? Verificando objetos globales:');
        const globals = [
            'gradosManager', 'ui', 'matricesInteractivas', 
            'planningManager', // <--- NUEVO
            'supabase', 'AppCoordinator'
        ];
        
        globals.forEach(name => {
            const exists = typeof window[name] !== 'undefined';
            console.log(`   ${exists ? '?' : '?'} ${name}`);
        });
    },

    showError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: #ef4444; color: white; padding: 15px 25px; border-radius: 8px;
            z-index: 9999; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); font-family: sans-serif; font-weight: bold;
        `;
        errorDiv.innerHTML = `?? Error: ${error.message} <button style="margin-left:15px; background:none; border:none; color:white; cursor:pointer;" onclick="this.parentElement.remove()">?</button>`;
        document.body.appendChild(errorDiv);
    }
};

window.AppCoordinator = AppCoordinator;

document.addEventListener('DOMContentLoaded', () => {
    console.log('? DOM listo, esperando 500ms...');
    setTimeout(() => {
        AppCoordinator.initialize().catch(console.error);
    }, 500);
});

export default AppCoordinator;
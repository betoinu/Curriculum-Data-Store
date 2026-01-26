// app.js - VERSIÓN FINAL SEGURA (CON LOGIN + PLANNING MANAGER)
console.log('🚀 app.js: Cargando coordinador...');

const AppCoordinator = {
    modules: {},
    events: {},
    supabase: null,
    matricesInteractivas: null,
    planningManager: null, 

    // ========== 1. GESTIÓN DE MÓDULOS ==========
    
    registerModule(name, module) {
        console.log(`📦 Módulo registrado: ${name}`);
        this.modules[name] = module;
        
        if (name === 'matrices-interactivas') {
            this.matricesInteractivas = module;
            window.matricesInteractivas = module;
        }
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
        console.log(`🔄 Cargando módulo: ${name}`);
        
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

                case 'planning-manager':
                    const planningModule = await import('./planning-manager.js');
                    if (planningModule.default) {
                        this.registerModule('planning-manager', planningModule.default);
                    } else if (window.planningManager) {
                        this.registerModule('planning-manager', window.planningManager);
                    }
                    break;
                    
                default:
                    console.warn(`⚠️ Módulo desconocido: ${name}`);
            }
        } catch (error) {
            console.error(`❌ Error cargando módulo ${name}:`, error);
            throw error;
        }
    },
    
    // ========== 2. LOGICA DE INICIO Y LOGIN ==========

    // Funtzio honek bakarrik Supabase eta Sesioa begiratzen ditu
    async start() {
        console.log('🔒 Sistema de seguridad iniciando...');
        try {
            // 1. Inicializar Supabase (Necesario para comprobar login)
            const { inicializarSupabase, getSupabaseInstance } = await import('./config.js');
            await inicializarSupabase();
            
            this.supabase = getSupabaseInstance();
            if (!this.supabase) throw new Error("No se pudo obtener instancia de Supabase");
            console.log('✅ Supabase conectado');

            // 2. Comprobar Sesión Existente
            const { data: { session } } = await this.supabase.auth.getSession();

            if (session) {
                console.log(`👋 Sesión recuperada: ${session.user.email}`);
                await this.launchApplication(session.user);
            } else {
                console.log('⛔ No hay sesión. Esperando login...');
                this.setupLoginForm();
            }

        } catch (error) {
            console.error('❌ Error crítico en arranque:', error);
            this.showError(error);
        }
    },

    // Configurar el formulario de Login (Solo si no hay sesión)
    setupLoginForm() {
		const loginOverlay = document.getElementById('login-overlay');
        const appContainer = document.getElementById('app-container');
        const loginForm = document.getElementById('login-form');
        const errorMsg = document.getElementById('login-error');
        const googleBtn = document.getElementById('google-login-btn'); // <--- Hau da berria

        // Ziurtatu Login ikusten dela eta App ezkututa dagoela
        if (loginOverlay) loginOverlay.classList.remove('hidden');
        if (appContainer) appContainer.classList.add('hidden');

        // A) EMAIL ETA PASAHITZA LOGIKA
        if (loginForm) {
            // Klonatu entzule zaharrak ezabatzeko
            const newForm = loginForm.cloneNode(true);
            loginForm.parentNode.replaceChild(newForm, loginForm);

            newForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                
                if (errorMsg) errorMsg.classList.add('hidden');

                try {
                    const { data, error } = await this.supabase.auth.signInWithPassword({
                        email, password
                    });

                    if (error) throw error;

                    console.log('🎉 Login zuzena (Email)!');
                    await this.launchApplication(data.user);

                } catch (err) {
                    console.error('Login errorea:', err);
                    if (errorMsg) {
                        errorMsg.textContent = "Errorea: Emaila edo pasahitza okerrak.";
                        errorMsg.classList.remove('hidden');
                    }
                }
            });
        }

        // B) GOOGLE LOGIKA (Berria)
		if (googleBtn) {
			console.log("🔧 Konfigurando botón de Google...");
			
			// 1. Garbitu event listener zaharrak
			const newBtn = googleBtn.cloneNode(true);
			googleBtn.parentNode.replaceChild(newBtn, googleBtn);
			
			// 2. Lortu botoi berria
			const freshBtn = document.getElementById('google-login-btn');
			if (!freshBtn) {
				console.error("❌ No se pudo obtener el nuevo botón");
				return;
			}
			
			// 3. CSS arazoak konpondu
			freshBtn.style.pointerEvents = 'auto';
			freshBtn.style.cursor = 'pointer';
			freshBtn.disabled = false;
			freshBtn.style.opacity = '1';
			
			// 4. Event listener berria gehitu
			freshBtn.addEventListener('click', async (e) => {
				e.preventDefault();
				e.stopImmediatePropagation();
				
				console.log("🌐 Iniciando login con Google...");
				
				// Loading egoera
				const originalText = freshBtn.textContent;
				freshBtn.disabled = true;
				freshBtn.textContent = "Conectando con Google...";
				freshBtn.style.opacity = "0.7";
				
				try {
					// Asegurar que tenemos la instancia de Supabase
					if (!this.supabase) {
						throw new Error("No hay instancia de Supabase");
					}
					
					const { error } = await this.supabase.auth.signInWithOAuth({
						provider: 'google',
						options: {
							redirectTo: window.location.href,
							queryParams: {
								prompt: 'select_account',
								access_type: 'offline'
							}
						}
					});
					
					if (error) {
						throw error;
					}
					
					// Google hará el redirect automáticamente
					console.log("✅ Redirigiendo a Google...");
					
				} catch (err) {
					console.error("❌ Error en login con Google:", err);
					
					// Restaurar botón
					freshBtn.disabled = false;
					freshBtn.textContent = originalText;
					freshBtn.style.opacity = "1";
					
					// Mostrar error
					if (errorMsg) {
						errorMsg.textContent = "Error con Google: " + err.message;
						errorMsg.classList.remove('hidden');
					} else {
						alert("Error: " + err.message);
					}
				}
			});
			
			console.log("✅ Botón de Google configurado correctamente");
		}
    },


    // Esta función carga REALMENTE la app (Solo tras login)
    async launchApplication(user) {
		console.log('🚀 Lanzando aplicación principal...');
        
        // 1. Ocultar Login / Mostrar App
        const loginOverlay = document.getElementById('login-overlay');
        const appContainer = document.getElementById('app-container');
        
        if(loginOverlay) loginOverlay.classList.add('hidden');
        if(appContainer) appContainer.classList.remove('hidden');

        // --- BERRIZ GEHITUA: LOGOUT LOGIKA ---
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            // Garbitu aurreko entzuleak (badaezpada) eta berria sortu
            const newBtn = logoutBtn.cloneNode(true); 
            logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);
            
            newBtn.addEventListener('click', async () => {
                console.log("👋 Saioa ixten...");
                const { error } = await this.supabase.auth.signOut();
                if (error) {
                    alert("Errorea saioa ixtean: " + error.message);
                } else {
                    // Orria birkargatu garbitzeko
                    window.location.reload(); 
                }
            });
        }

        try {
            // 2. Cargar módulos (Ahora que tenemos permiso)
            console.log('2. Cargando módulos...');
            await this.loadModule('grados-manager');
            await this.loadModule('ui');
            await this.loadModule('matrices-interactivas');
            await this.loadModule('planning-manager');
            
            // 3. Inicializar GradosManager (Esto es lo que pedía los datos y daba 401)
            console.log('3. Inicializando GradosManager...');
            const gradosManager = this.getModule('grados-manager');
            if (gradosManager && gradosManager.initialize) {
                await gradosManager.initialize();
                console.log('✅ GradosManager inicializado con datos');
            }
            
            // 4. Configurar Dependencias
            console.log('4. Configurando dependencias...');
            
            // A) Matrices Interactivas
            const matricesModule = this.getModule('matrices-interactivas');
            if (matricesModule && matricesModule.setGradosManager && gradosManager) {
                matricesModule.setGradosManager(gradosManager);
            }

            // B) Planning Manager
            const planningModule = this.getModule('planning-manager');
            if (planningModule && planningModule.setGradosManager && gradosManager) {
                planningModule.setGradosManager(gradosManager);
            }
            
            // 5. Exposición Global
            if (!window.matricesInteractivas && this.matricesInteractivas) window.matricesInteractivas = this.matricesInteractivas;
            if (!window.planningManager && this.planningManager) window.planningManager = this.planningManager;
            
            console.log('🎉 Aplicación lista y cargada.');
            this.verifyGlobalObjects();

        } catch (error) {
            console.error('❌ Error inicializando módulos:', error);
            this.showError(error);
        }
    },
    
    verifyGlobalObjects() {
        console.log('🔍 Verificando objetos globales:');
        const globals = [
            'gradosManager', 'ui', 'matricesInteractivas', 
            'planningManager', 
            'supabase', 'AppCoordinator'
        ];
        
        globals.forEach(name => {
            const exists = typeof window[name] !== 'undefined';
            console.log(`   ${exists ? '✅' : '❌'} ${name}`);
        });
    },

    showError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: #ef4444; color: white; padding: 15px 25px; border-radius: 8px;
            z-index: 9999; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); font-family: sans-serif; font-weight: bold;
        `;
        errorDiv.innerHTML = `⚠️ Error: ${error.message} <button style="margin-left:15px; background:none; border:none; color:white; cursor:pointer;" onclick="this.parentElement.remove()">✕</button>`;
        document.body.appendChild(errorDiv);
    }
};

window.AppCoordinator = AppCoordinator;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🏁 DOM listo, iniciando coordinador...');
    // Llamamos a start() que gestionará el login, no a initialize() directo
    setTimeout(() => {
        AppCoordinator.start().catch(console.error);
    }, 500);
});

export default AppCoordinator;



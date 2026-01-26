// config.js
// Configuración para Supabase en producción (GitHub Pages)
// ============================================ 
// 🔧 IMPORTAR SUPABASE DESDE ESM (NO CDN) 
// ============================================ 
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"; 
// ============================================ 
// 🔧 VARIABLES DE CONFIGURACIÓN 
// ============================================
// URL y clave de tu proyecto Supabase
window.SUPABASE_URL = "https://rthjrzmkozvungmiiikt.supabase.co";
window.SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0aGpyem1rb3p2dW5nbWlpaWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMTEwMTQsImV4cCI6MjA3OTg4NzAxNH0.cWWo4Pi6dURT3kdg_1E4Ujn1pG5bZhZTaFy0tcWZn6g";

// URL pública de tu aplicación en GitHub Pages
// IMPORTANTE: debe coincidir exactamente con la URL configurada en Supabase → Authentication → URL Configuration
window.REDIRECT_URI = "https://betoinu.github.io/Curriculum-Data-Store/";
//window.REDIRECT_URI = "http://localhost:8000/";

// Verificación en consola
console.log("Supabase URL:", window.SUPABASE_URL);
console.log("Redirect URI:", window.REDIRECT_URI);

// Si tienes variables de entorno para producción, las puedes sobreescribir aquí
//if (window.ENV && window.ENV.SUPABASE_URL) {
//  window.SUPABASE_URL = window.ENV.SUPABASE_URL;
//  window.SUPABASE_KEY = window.ENV.SUPABASE_KEY;
//  window.REDIRECT_URI = window.ENV.REDIRECT_URI;
//}


// ============================================
// 🔥 INICIALIZACIÓN ÚNICA DE SUPABASE
// ============================================

let supabaseInstance = null;

export function inicializarSupabase() {
    if (supabaseInstance) {
        console.log("⏭️ Supabase ya inicializado");
        return supabaseInstance;
    }

    console.log("🚀 Inicializando Supabase...");

    supabaseInstance = createClient(
        window.SUPABASE_URL,
        window.SUPABASE_KEY,
        {
            auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: true,
				flowType: "pkce",
				redirectTo: window.REDIRECT_URI,
				// 🔥 AÑADIR ESTAS 2 LÍNEAS:
				storageKey: 'ikastaro-auth-token',
				storage: localStorage
            }
        }
    );

    console.log("✅ Supabase inicializado correctamente", {
        url: window.SUPABASE_URL.substring(0, 30) + "...",
        auth: !!supabaseInstance.auth
    });

    // 🔥 EXPONER LA INSTANCIA GLOBALMENTE (para consola y módulos)
    window.supabase = supabaseInstance;

    return supabaseInstance;
}

// ============================================
// 🔧 GETTER / SETTER
// ============================================

export function getSupabaseInstance() {
    return supabaseInstance;
}

export function setSupabaseInstance(instance) {
    supabaseInstance = instance;
    window.supabase = instance; // asegurar sincronización global
}

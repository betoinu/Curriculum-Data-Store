// config.js
// Garapenerako balio lehenetsiak
window.SUPABASE_URL = "https://rthjrzmkozvungmiiikt.supabase.co";
window.SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0aGpyem1rb3p2dW5nbWlpaWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMTEwMTQsImV4cCI6MjA3OTg4NzAxNH0.cWWo4Pi6dURT3kdg_1E4Ujn1pG5bZhZTaFy0tcWZn6g";

// Egiaztatu kodea
console.log('Supabase URL:', window.SUPABASE_URL);
console.log('Redirect URI:', window.SUPABASE_URL + '/auth/v1/callback');

// Produkziorako, zerbitzariak balioak gainidatzi ditzake
if (window.ENV && window.ENV.SUPABASE_URL) {
    window.SUPABASE_URL = window.ENV.SUPABASE_URL;
    window.SUPABASE_KEY = window.ENV.SUPABASE_KEY;

}

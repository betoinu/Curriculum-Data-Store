// state.js - Estado centralizado
export const state = {
    curriculumData: {},
    selectedDegree: null,
    selectedYear: null,
    selectedSubjectIndex: '-1',
    selectedCompetenciaGrado: {},
    selectedCompetenciaArea: {},
    selectedCompetenciaTipo: ' ',
    currentUser: null,
    dataCache: { data: null, timestamp: 0, maxAge: 30000 },
    diagnostics: { authEventCount: 0, dataLoadCount: 0, uiUpdateCount: 0 },
    observers: { mutationObserver: null, realtimeChannel: null }
};
/**
 * ============================================================================
 * Programación Front End - Vue 3 Application Logic
 * Single Page Architecture with LocalStorage Persistence & Strict Validation
 * ============================================================================
 */

const { createApp, ref, reactive, computed, watch, onMounted } = Vue;

const app = createApp({
  setup() {
    // ------------------------------------------------------------------------
    // Global & Navigation State
    // ------------------------------------------------------------------------
    const savedTab = localStorage.getItem('pfe_active_tab');
    const activeTab = ref(savedTab === 'registro' || savedTab === 'construccion' ? savedTab : 'calificaciones');
    const searchQuery = ref('');
    const searchToast = ref(null);

    // Current User Session (Persisted in localStorage)
    const currentUser = ref(null);

    const initUserSession = () => {
      try {
        const storedUser = localStorage.getItem('pfe_user');
        if (storedUser) {
          currentUser.value = JSON.parse(storedUser);
        }
      } catch (err) {
        console.error('Error cargando usuario de localStorage', err);
        currentUser.value = null;
      }
    };

    const cerrarSesion = () => {
      currentUser.value = null;
      localStorage.removeItem('pfe_user');
    };

    const setActiveTab = (tab) => {
      activeTab.value = tab;
      localStorage.setItem('pfe_active_tab', tab);
    };

    // Watch activeTab changes for persistence
    watch(activeTab, (newTab) => {
      localStorage.setItem('pfe_active_tab', newTab);
    });

    // Search bar logic (Jump to tab matching query)
    const handleSearch = () => {
      if (!searchQuery.value) return;
      const q = searchQuery.value.toLowerCase().trim();

      if (q.includes('calif') || q.includes('nota') || q.includes('prom') || q.includes('asist') || q === '1') {
        setActiveTab('calificaciones');
      } else if (q.includes('reg') || q.includes('form') || q.includes('usu') || q.includes('corr') || q.includes('nomb') || q === '2') {
        setActiveTab('registro');
      } else if (q.includes('cons') || q.includes('prox') || q === '3') {
        setActiveTab('construccion');
      } else {
        // Fallback: indicate no exact tab found
        alert(`No se encontró una sección con el término "${searchQuery.value}". Pruebe con "Calificaciones" o "Registro".`);
      }
      searchQuery.value = '';
    };

    // ------------------------------------------------------------------------
    // Tab 1: Cálculo de Calificaciones
    // ------------------------------------------------------------------------
    const draftCalif = (() => {
      try {
        return JSON.parse(localStorage.getItem('pfe_calificaciones_draft') || '{}');
      } catch (e) {
        return {};
      }
    })();

    const nota1 = ref(draftCalif.nota1 !== undefined ? draftCalif.nota1 : '');
    const nota2 = ref(draftCalif.nota2 !== undefined ? draftCalif.nota2 : '');
    const nota3 = ref(draftCalif.nota3 !== undefined ? draftCalif.nota3 : '');
    const asistencia = ref(draftCalif.asistencia !== undefined ? draftCalif.asistencia : '');

    const errorCalificaciones = ref('');
    const shakeTab1 = ref(false);
    const resultado = ref(null);

    // Calculation History
    const historialCalificaciones = ref((() => {
      try {
        return JSON.parse(localStorage.getItem('pfe_calificaciones_history') || '[]');
      } catch (e) {
        return [];
      }
    })());

    // Watch and persist draft inputs for Tab 1
    watch([nota1, nota2, nota3, asistencia], ([n1, n2, n3, as]) => {
      localStorage.setItem('pfe_calificaciones_draft', JSON.stringify({
        nota1: n1,
        nota2: n2,
        nota3: n3,
        asistencia: as
      }));
    });

    // Exact Error Message required by rubric:
    const ERROR_CALIFICACIONES_MSG = 'Por favor, ingrese valores válidos para las notas y la asistencia';

    const triggerTab1Shake = () => {
      shakeTab1.value = true;
      setTimeout(() => {
        shakeTab1.value = false;
      }, 500);
    };

    const calcularCalificaciones = () => {
      // Clear previous error
      errorCalificaciones.value = '';

      // Validate inputs existence
      const rawN1 = String(nota1.value).trim();
      const rawN2 = String(nota2.value).trim();
      const rawN3 = String(nota3.value).trim();
      const rawAsist = String(asistencia.value).trim();

      if (rawN1 === '' || rawN2 === '' || rawN3 === '' || rawAsist === '') {
        errorCalificaciones.value = ERROR_CALIFICACIONES_MSG;
        resultado.value = null;
        triggerTab1Shake();
        return;
      }

      const valN1 = parseFloat(rawN1);
      const valN2 = parseFloat(rawN2);
      const valN3 = parseFloat(rawN3);
      const valAsist = parseFloat(rawAsist);

      // Validate range: Notas 10 to 70, Asistencia 0 to 100
      const isNota1Valid = !isNaN(valN1) && valN1 >= 10 && valN1 <= 70;
      const isNota2Valid = !isNaN(valN2) && valN2 >= 10 && valN2 <= 70;
      const isNota3Valid = !isNaN(valN3) && valN3 >= 10 && valN3 <= 70;
      const isAsistValid = !isNaN(valAsist) && valAsist >= 0 && valAsist <= 100;

      if (!isNota1Valid || !isNota2Valid || !isNota3Valid || !isAsistValid) {
        errorCalificaciones.value = ERROR_CALIFICACIONES_MSG;
        resultado.value = null;
        triggerTab1Shake();
        return;
      }

      // Calculation formula: Promedio = (Nota1 * 0.35) + (Nota2 * 0.35) + (Nota3 * 0.30)
      const rawPromedio = (valN1 * 0.35) + (valN2 * 0.35) + (valN3 * 0.30);
      
      // Clean rounding up to 2 decimal places (e.g. 50, 45, 50 -> 48.25)
      const roundedPromedio = Math.round(rawPromedio * 100) / 100;
      const formattedPromedio = Number.isInteger(roundedPromedio) 
        ? roundedPromedio.toString() 
        : roundedPromedio.toFixed(2);

      // Approval condition: Promedio >= 40 AND Asistencia >= 80
      const isAprobado = roundedPromedio >= 40 && valAsist >= 80;
      const estadoCalculado = isAprobado ? 'Aprobado' : 'Reprobado';

      // Save valid result
      resultado.value = {
        promedio: formattedPromedio,
        promedioNum: roundedPromedio,
        estado: estadoCalculado,
        nota1: valN1,
        nota2: valN2,
        nota3: valN3,
        asistencia: valAsist,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };

      // Add to history list & persist
      historialCalificaciones.value.unshift({
        id: Date.now(),
        ...resultado.value
      });

      // Keep up to 10 recent records
      if (historialCalificaciones.value.length > 10) {
        historialCalificaciones.value.pop();
      }

      localStorage.setItem('pfe_calificaciones_history', JSON.stringify(historialCalificaciones.value));
    };

    const limpiarCalificaciones = () => {
      nota1.value = '';
      nota2.value = '';
      nota3.value = '';
      asistencia.value = '';
      errorCalificaciones.value = '';
      resultado.value = null;
      localStorage.removeItem('pfe_calificaciones_draft');
    };

    const limpiarHistorial = () => {
      historialCalificaciones.value = [];
      localStorage.removeItem('pfe_calificaciones_history');
    };

    // ------------------------------------------------------------------------
    // Tab 2: Formulario de Registro
    // ------------------------------------------------------------------------
    const draftRegistro = (() => {
      try {
        return JSON.parse(localStorage.getItem('pfe_registro_draft') || '{}');
      } catch (e) {
        return {};
      }
    })();

    const nombre = ref(draftRegistro.nombre || '');
    const correo = ref(draftRegistro.correo || '');
    const password = ref('');
    const repetirPassword = ref('');

    const errorsRegistro = reactive({
      nombre: '',
      correo: '',
      password: '',
      repetirPassword: ''
    });

    const shakeTab2 = ref(false);

    // Watch and persist non-sensitive drafts (nombre, correo)
    watch([nombre, correo], ([nom, cor]) => {
      localStorage.setItem('pfe_registro_draft', JSON.stringify({
        nombre: nom,
        correo: cor
      }));
    });

    const triggerTab2Shake = () => {
      shakeTab2.value = true;
      setTimeout(() => {
        shakeTab2.value = false;
      }, 500);
    };

    const enviarRegistro = () => {
      // Reset errors
      errorsRegistro.nombre = '';
      errorsRegistro.correo = '';
      errorsRegistro.password = '';
      errorsRegistro.repetirPassword = '';

      let hasError = false;

      // 1. Nombre validation
      if (!nombre.value || !nombre.value.trim()) {
        errorsRegistro.nombre = 'El campo nombre es requerido';
        hasError = true;
      }

      // 2. Correo validation
      if (!correo.value || !correo.value.trim()) {
        errorsRegistro.correo = 'El campo correo es requerido';
        hasError = true;
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correo.value.trim())) {
          errorsRegistro.correo = 'Ingrese un formato de correo válido';
          hasError = true;
        }
      }

      // 3. Contraseña validation
      if (!password.value) {
        errorsRegistro.password = 'El campo contraseña es requerido';
        hasError = true;
      }

      // 4. Repetir Contraseña validation
      if (!repetirPassword.value) {
        errorsRegistro.repetirPassword = 'El campo repetir contraseña es requerido';
        hasError = true;
      } else if (password.value && password.value !== repetirPassword.value) {
        errorsRegistro.repetirPassword = 'Las contraseñas no coinciden';
        hasError = true;
      }

      if (hasError) {
        triggerTab2Shake();
        return;
      }

      // SUCCESS BEHAVIOR
      // Exact native alert specified in rubric
      window.alert('El registro se ha realizado correctamente');

      // Save session state to localStorage
      const newUser = {
        nombre: nombre.value.trim(),
        correo: correo.value.trim(),
        fechaRegistro: new Date().toLocaleDateString('es-CL')
      };

      currentUser.value = newUser;
      localStorage.setItem('pfe_user', JSON.stringify(newUser));

      // Clear password fields & reset draft
      password.value = '';
      repetirPassword.value = '';
      localStorage.removeItem('pfe_registro_draft');
    };

    const limpiarRegistroDraft = () => {
      nombre.value = '';
      correo.value = '';
      password.value = '';
      repetirPassword.value = '';
      errorsRegistro.nombre = '';
      errorsRegistro.correo = '';
      errorsRegistro.password = '';
      errorsRegistro.repetirPassword = '';
      localStorage.removeItem('pfe_registro_draft');
    };

    // ------------------------------------------------------------------------
    // Lifecycle hooks
    // ------------------------------------------------------------------------
    onMounted(() => {
      initUserSession();
    });

    return {
      // Global
      activeTab,
      searchQuery,
      currentUser,
      setActiveTab,
      handleSearch,
      cerrarSesion,

      // Tab 1
      nota1,
      nota2,
      nota3,
      asistencia,
      errorCalificaciones,
      shakeTab1,
      resultado,
      historialCalificaciones,
      calcularCalificaciones,
      limpiarCalificaciones,
      limpiarHistorial,

      // Tab 2
      nombre,
      correo,
      password,
      repetirPassword,
      errorsRegistro,
      shakeTab2,
      enviarRegistro,
      limpiarRegistroDraft
    };
  }
});

app.mount('#app');

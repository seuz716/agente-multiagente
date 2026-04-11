/**
 * ORQUESTADOR
 * 
 * Analiza la orden y la dirige al agente especializado correcto.
 * Esto permite:
 * - Specialización de cada agente
 * - Mejor rendimiento
 * - Escalabilidad
 */

class Orquestador {
  constructor(agenteCodigo, agenteArchivos, agenteSistema) {
    this.agenteCodigo = agenteCodigo;
    this.agenteArchivos = agenteArchivos;
    this.agenteSistema = agenteSistema;

    // Palabras clave por tipo de agente
    // PATCH: corregido error tipográfico 'palabrasClaveCodig' → 'palabrasClavesCodigo'
    this.palabrasClavesCodigo = [
      'django', 'python', 'code', 'codigo', 'crear proyecto',
      'javascript', 'node', 'html', 'css', 'sql',
      'funcion', 'clase', 'archivo.py', '.js', '.html'
    ];

    this.palabrasClaveArchivos = [
      'archivo', 'carpeta', 'organiza', 'acomoda', 'busca',
      'descargas', 'documentos', 'documento', 'pdf', 'zip',
      'elimina', 'borra', 'renombra', 'mueve', 'copia'
    ];

    this.palabrasClavesSistema = [
      'instala', 'descarga', 'configura', 'permisos', 'bash',
      'comando', 'terminal', 'servicio', 'proceso', 'memoria'
    ];

    // PATCH: patrones de prioridad absoluta — cortocircuitan el sistema de puntaje
    // cuando la intención es inequívoca, sin importar el resto de las palabras.
    this.prioridadAbsolutaCodigo   = /crear.*proyecto|startproject|nuevo.*django|escribir.*script|generar.*codigo/i;
    this.prioridadAbsolutaSistema  = /instalar.*pip|npm install|sudo|ejecutar.*bash|reiniciar.*servicio/i;
    this.prioridadAbsolutaArchivos = /organizar.*descargas|clasificar.*archivos|mover.*carpeta|eliminar.*archivo/i;
  }

  /**
   * Detecta qué tipo de agente necesita
   * Retorna: 'codigo' | 'archivos' | 'sistema' | 'desconocido'
   */
  detectarTipo(orden) {
    const ordenLower = orden.toLowerCase();
    const palabras   = ordenLower.split(/\s+/);

    // PATCH: prioridad absoluta — evita que el scoring interfiera en
    // órdenes cuya intención es completamente clara.
    if (this.prioridadAbsolutaCodigo.test(ordenLower))   return 'codigo';
    if (this.prioridadAbsolutaSistema.test(ordenLower))  return 'sistema';
    if (this.prioridadAbsolutaArchivos.test(ordenLower)) return 'archivos';

    // Scoring por palabras clave
    // PATCH: se usa 'palabrasClavesCodigo' (nombre corregido) en lugar del
    // anterior 'palabrasClaveCodig' que nunca coincidía con nada.
    let puntajeCodigo   = 0;
    let puntajeArchivos = 0;
    let puntajeSistema  = 0;

    palabras.forEach(palabra => {
      if (this.palabrasClavesCodigo.some(p  => palabra.includes(p))) puntajeCodigo   += 2;
      if (this.palabrasClaveArchivos.some(p => palabra.includes(p))) puntajeArchivos += 2;
      if (this.palabrasClavesSistema.some(p => palabra.includes(p))) puntajeSistema  += 2;
    });

    // Patrones más específicos (bonus de contexto)
    if (/crear.*django|proyecto.*django|startproject/.test(ordenLower)) puntajeCodigo   += 5;
    if (/organiza.*descargas|agrupa.*extension|clasifica/.test(ordenLower)) puntajeArchivos += 5;
    if (/instala.*pip|npm install|bash/.test(ordenLower)) puntajeSistema  += 5;

    // Determinar ganador con tie-breaking explícito.
    // PATCH: las condiciones anteriores usaban '>' estricto en los tres casos,
    // por lo que un empate no entraba en ningún bloque y caía al default.
    // Ahora: en caso de empate la prioridad es codigo > sistema > archivos.
    const maximo = Math.max(puntajeCodigo, puntajeArchivos, puntajeSistema);

    if (maximo === 0) {
      // Sin ninguna señal: default a archivos (tarea más común)
      return 'archivos';
    }

    // Prioridad desempatada: codigo > sistema > archivos
    if (puntajeCodigo   === maximo) return 'codigo';
    if (puntajeSistema  === maximo) return 'sistema';
    return 'archivos';
  }

  /**
   * Procesa la orden por el agente correspondiente
   */
  async procesar(orden) {
    const tipo = this.detectarTipo(orden);

    return {
      tipo_agente: tipo,
      orden: orden,
      procesando: true,
      inicio: new Date().toISOString()
    };
  }

  /**
   * Info de agentes disponibles
   */
  info() {
    return {
      orquestador: true,
      agentes: {
        codigo: {
          descripcion: "Especializado en crear proyectos, código, scripts",
          capacidades: [
            "Crear proyectos Django",
            "Crear archivos Python",
            "Ejecutar scripts",
            "Instalar paquetes Python"
          ]
        },
        archivos: {
          descripcion: "Gestiona archivos, carpetas, búsquedas",
          capacidades: [
            "Crear/eliminar carpetas",
            "Organizar por extensión",
            "Buscar archivos",
            "Renombrar, copiar, mover"
          ]
        },
        sistema: {
          descripcion: "Control del sistema, permisos, procesos",
          capacidades: [
            "Ejecutar comandos bash",
            "Gestionar servicios",
            "Monitorear procesos",
            "Configurar permisos"
          ]
        }
      }
    };
  }
}

module.exports = Orquestador;

/**
 * AGENTE PERSONAL — Controlador Principal
 *
 * Integra: Ollama (IA local), Orquestador, Memoria persistente, Logger.
 * Modelos disponibles: mistral, qwen2.5-coder:3b, tinyllama
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { exec } = require('child_process');
const http    = require('http');

const Orquestador = require('./orquestador');

// ==================== LOGGER ====================

class Logger {
  constructor(rutaLog) {
    this.rutaLog = rutaLog;
    fs.mkdirSync(path.dirname(rutaLog), { recursive: true });
  }

  _escribir(nivel, msg) {
    const linea = `[${new Date().toISOString()}] [${nivel}] ${msg}\n`;
    process.stdout.write(linea);
    try { fs.appendFileSync(this.rutaLog, linea); } catch (_) {}
  }

  info(msg)  { this._escribir('INFO',  msg); }
  error(msg) { this._escribir('ERROR', msg); }
  warn(msg)  { this._escribir('WARN',  msg); }
}

// ==================== MEMORIA ====================

class Memoria {
  constructor(rutaDatos) {
    this.rutaArchivo = path.join(rutaDatos, 'memoria.json');
    fs.mkdirSync(rutaDatos, { recursive: true });
    this.estructura = this._cargar();
  }

  _cargar() {
    try {
      if (fs.existsSync(this.rutaArchivo))
        return JSON.parse(fs.readFileSync(this.rutaArchivo, 'utf8'));
    } catch (_) {}
    return {
      contador_acciones: 0,
      preferencias: {},
      historial_corto: [],  // últimas 20 acciones
      contexto_actual: {},
      ultima_actualizacion: null
    };
  }

  guardar() {
    this.estructura.ultima_actualizacion = new Date().toISOString();
    try { fs.writeFileSync(this.rutaArchivo, JSON.stringify(this.estructura, null, 2)); } catch (_) {}
  }

  registrarAccion(orden, resultado) {
    this.estructura.contador_acciones++;
    this.estructura.historial_corto.push({
      orden,
      resultado: String(resultado).slice(0, 200),
      timestamp: new Date().toISOString()
    });
    // Mantener solo las últimas 20
    if (this.estructura.historial_corto.length > 20)
      this.estructura.historial_corto.shift();
    this.guardar();
  }

  obtenerContexto() {
    return {
      acciones_totales: this.estructura.contador_acciones,
      historial: this.estructura.historial_corto,
      ultima_actualizacion: this.estructura.ultima_actualizacion
    };
  }
}

// ==================== OLLAMA CLIENT ====================

// Modelos por tarea (los más rápidos disponibles en tu WSL)
const MODELOS = {
  codigo:   'qwen2.5-coder:3b',  // rápido y especializado en código
  sistema:  'tinyllama',          // muy rápido para respuestas cortas
  archivos: 'tinyllama',
  default:  'tinyllama'
};

function llamarOllama(modelo, prompt, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: modelo, prompt, stream: false });
    const options = {
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data).response || '(sin respuesta)'); }
        catch (e) { reject(new Error('Respuesta Ollama inválida')); }
      });
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`Timeout — el modelo '${modelo}' tardó más de ${timeout/1000}s. Prueba con tinyllama.`));
    });
    req.on('error', (e) => reject(new Error(`Ollama no disponible: ${e.message}. ¿Está corriendo 'ollama serve'?`)));
    req.write(body);
    req.end();
  });
}

// ==================== AGENTES ESPECIALIZADOS ====================

class AgenteCodigo {
  async ejecutar(orden, _ia) {
    const modelo = MODELOS.codigo;
    const prompt = `Eres un experto en programación. El usuario quiere: "${orden}"\nResponde con una explicación breve y el código necesario. Sé conciso.`;
    try {
      return await llamarOllama(modelo, prompt);
    } catch (e) {
      return `⚠️ IA no disponible (${e.message})\n\nPuedes ejecutar manualmente lo que necesites.`;
    }
  }
}

class AgenteArchivos {
  async ejecutar(orden, ia) {
    const ordenLower = orden.toLowerCase();

    // Crear carpeta
    const matchCrear = ordenLower.match(/crea(?:r)?\s+carpeta\s+([^\s]+)/i) ||
                       orden.match(/mkdir\s+([^\s]+)/i);
    if (matchCrear) {
      const nombre = matchCrear[1].replace(/[^a-zA-Z0-9_\-]/g, '_');
      const ruta   = path.join(os.homedir(), nombre);
      fs.mkdirSync(ruta, { recursive: true });
      return `✅ Carpeta '${nombre}' creada en ${ruta}`;
    }

    // Listar
    if (/lista|listar|ls\b/.test(ordenLower)) {
      const items = fs.readdirSync(os.homedir()).slice(0, 20);
      return `📁 Home:\n${items.join('\n')}`;
    }

    // Buscar
    const matchBuscar = ordenLower.match(/busca(?:r)?\s+(.+)/);
    if (matchBuscar) {
      return await new Promise(resolve => {
        exec(`find ~ -name "*${matchBuscar[1]}*" 2>/dev/null | head -20`,
          (err, stdout) => resolve(stdout.trim() || 'Sin resultados'));
      });
    }

    try {
      const prompt = `Eres un gestor de archivos Linux. El usuario quiere: "${orden}". Indica paso a paso cómo hacerlo.`;
      return await llamarOllama(MODELOS.archivos, prompt);
    } catch (e) {
      return `Orden recibida: ${orden}\n(IA no disponible: ${e.message})`;
    }
  }
}

class AgenteSistema {
  constructor() {
    this.WHITELIST = ['ls','pwd','echo','whoami','ps','df','free','uptime','date','uname','cat','grep','find','git','npm','pip3','python3'];
  }

  async ejecutar(orden, ia) {
    const ordenLower = orden.toLowerCase();

    // Info del sistema
    if (/info.*sistema|system info/.test(ordenLower)) {
      return await new Promise(resolve => {
        exec('echo "=== Sistema ===" && uname -a && echo "=== CPU ===" && nproc && echo "=== RAM ===" && free -h && echo "=== Disco ===" && df -h ~',
          (err, stdout) => resolve(stdout.trim()));
      });
    }

    // Procesos — solo filtra por nombre específico con "de X" o tech keywords
    if (/procesos?|process/.test(ordenLower)) {
      // Solo filtra si es "procesos de X" o "proceso node/python/etc", no adjetivos
      const matchDe    = orden.match(/procesos?\s+de\s+(\w+)/i);
      const ADJECTIVES = new Set(['activos','corriendo','actuales','todos','all','running','lista','listar','ver','mostrar']);
      const matchPost  = orden.match(/procesos?\s+(\w+)/i);
      const filtro     = matchDe?.[1] ||
                         (matchPost && !ADJECTIVES.has(matchPost[1].toLowerCase()) ? matchPost[1] : '');
      return await new Promise(resolve => {
        exec(`ps aux ${filtro ? `| grep -i ${filtro}` : ''} | head -20`,
          (err, stdout) => resolve(stdout.trim()));
      });
    }

    // Ejecutar comando de whitelist
    const palabras = orden.trim().split(/\s+/);
    if (this.WHITELIST.includes(palabras[0])) {
      return await new Promise(resolve => {
        exec(orden, { timeout: 10000 }, (err, stdout, stderr) =>
          resolve(stdout.trim() || stderr.trim() || 'Comando ejecutado'));
      });
    }

    try {
      const prompt = `Eres un asistente de sistema Linux. El usuario quiere: "${orden}". Explica cómo hacerlo de forma segura y brevemente.`;
      return await llamarOllama(MODELOS.sistema, prompt);
    } catch (e) {
      return `⚠️ Comando no permitido por whitelist: ${orden}\n(IA: ${e.message})`;
    }
  }
}

// ==================== AGENTE PERSONAL (CONTROLADOR) ====================

class AgentePersonal {
  constructor(config = {}) {
    this.config = {
      nombre:  config.nombre  || 'Asistente IA',
      modo:    config.modo    || 'seguro',
      modelo:  config.modelo  || 'mistral',
      rutaDatos: config.rutaDatos || path.join(os.homedir(), '.agente_datos')
    };

    // Logger
    this.ruta_logs = path.join(this.config.rutaDatos, 'agente.log');
    this.logger    = new Logger(this.ruta_logs);

    // Memoria
    this.memoria   = new Memoria(this.config.rutaDatos);

    // Agentes especializados
    const agenteCodigo   = new AgenteCodigo();
    const agenteArchivos = new AgenteArchivos();
    const agenteSistema  = new AgenteSistema();

    // Orquestador
    this.orquestador = new Orquestador(agenteCodigo, agenteArchivos, agenteSistema);

    // Estado
    this.confirmacion_pendiente = null;

    this.logger.info(`${this.config.nombre} iniciado (modo: ${this.config.modo}, modelo: ${this.config.modelo})`);
  }

  async procesar(orden) {
    this.logger.info(`Procesando: ${orden}`);

    try {
      const tipo   = this.orquestador.detectarTipo(orden);
      this.logger.info(`Agente seleccionado: ${tipo}`);

      let resultado;
      const modelo = this.config.modelo;

      switch (tipo) {
        case 'codigo':
          resultado = await this.orquestador.agenteCodigo.ejecutar(orden);
          break;
        case 'sistema':
          resultado = await this.orquestador.agenteSistema.ejecutar(orden);
          break;
        case 'archivos':
        default:
          resultado = await this.orquestador.agenteArchivos.ejecutar(orden);
          break;
      }

      this.memoria.registrarAccion(orden, resultado);
      this.logger.info(`Completado: ${String(resultado).slice(0, 100)}`);
      return resultado;

    } catch (error) {
      this.logger.error(`Error procesando orden: ${error.message}`);
      throw error;
    }
  }

  async confirmar(respuesta) {
    if (!this.confirmacion_pendiente) {
      return 'No hay acciones pendientes de confirmar.';
    }
    const accion = this.confirmacion_pendiente;
    this.confirmacion_pendiente = null;

    const r = respuesta.toLowerCase().trim();
    if (['sí', 'si', 'yes', 's', 'y'].includes(r)) {
      this.logger.info(`Confirmado: ${accion}`);
      return await this.procesar(accion);
    } else {
      this.logger.info(`Cancelado: ${accion}`);
      return 'Acción cancelada.';
    }
  }
}

module.exports = AgentePersonal;

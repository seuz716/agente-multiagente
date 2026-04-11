#!/usr/bin/env node

const express      = require('express');
const bodyParser   = require('body-parser');
const path         = require('path');
const fs           = require('fs');
const { exec }     = require('child_process');   // PATCH: async exec para /api/logs
const AgentePersonal = require('./agente');

// Instancia global del agente
const agente = new AgentePersonal({
  nombre: "Asistente IA",
  modo: "seguro"
});

// Express app
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// CORS simple
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// ==================== RUTAS ====================

/**
 * POST /api/orden
 * Procesa una orden directa del usuario
 * Body: { "orden": "crea carpeta test" }
 */
app.post('/api/orden', async (req, res) => {
  try {
    const { orden } = req.body;

    if (!orden || typeof orden !== 'string' || orden.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Orden requerida (string no vacío)'
      });
    }

    agente.logger.info(`API: Orden recibida: ${orden}`);
    const resultado = await agente.procesar(orden.trim());

    res.json({
      ok: true,
      resultado: resultado,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    agente.logger.error(`API Error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * POST /api/confirmar
 * Confirma una acción pendiente
 * Body: { "respuesta": "sí" }
 */
app.post('/api/confirmar', async (req, res) => {
  try {
    const { respuesta } = req.body;

    if (!respuesta) {
      return res.status(400).json({
        ok: false,
        error: 'Respuesta requerida'
      });
    }

    const resultado = await agente.confirmar(respuesta);

    res.json({
      ok: true,
      resultado: resultado,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    agente.logger.error(`API Error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * GET /api/estado
 * Devuelve estado actual del agente
 */
app.get('/api/estado', (req, res) => {
  const contexto = agente.memoria.obtenerContexto();

  res.json({
    ok: true,
    agente: {
      nombre: agente.config.nombre,
      modo: agente.config.modo,
      tareas_completadas: contexto.acciones_totales,
      acciones_pendientes: agente.confirmacion_pendiente ? 1 : 0,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * GET /api/historial
 * Devuelve últimas acciones
 */
app.get('/api/historial', (req, res) => {
  const contexto = agente.memoria.obtenerContexto();

  res.json({
    ok: true,
    historial: contexto.historial,
    total: contexto.acciones_totales
  });
});

/**
 * GET /api/logs
 * Devuelve últimas líneas de logs
 *
 * PATCH: se eliminó fs.readFileSync (bloqueante) y se reemplazó por
 * child_process.exec con 'tail -n' (Linux/Mac) o PowerShell
 * 'Get-Content -Tail' (Windows). El Event Loop nunca se bloquea.
 */
app.get('/api/logs', (req, res) => {
  const lineas   = Math.max(1, parseInt(req.query.lineas) || 20);
  const logsPath = agente.ruta_logs;

  // Si el archivo no existe devolvemos vacío sin tocar el disco de forma sinc.
  if (!logsPath || !fs.existsSync(logsPath)) {
    return res.json({ ok: true, logs: [], total_lineas: 0 });
  }

  // Construimos el comando según la plataforma
  const isWin  = process.platform === 'win32';
  const cmd    = isWin
    ? `powershell -Command "Get-Content -Path '${logsPath}' -Tail ${lineas}"`
    : `tail -n ${lineas} "${logsPath}"`;

  exec(cmd, { encoding: 'utf8', timeout: 10000 }, (err, stdout, stderr) => {
    if (err) {
      agente.logger.error(`/api/logs exec error: ${err.message}`);
      return res.status(500).json({ ok: false, error: err.message });
    }

    const logs = stdout
      .split('\n')
      .map(l => l.trimEnd())
      .filter(l => l.length > 0);

    res.json({
      ok: true,
      logs: logs,
      total_lineas: logs.length
    });
  });
});

/**
 * POST /api/reset
 * Reinicia la memoria del agente
 */
app.post('/api/reset', (req, res) => {
  try {
    agente.memoria.estructura = {
      contador_acciones: 0,
      preferencias: {},
      historial_corto: [],
      contexto_actual: {},
      ultima_actualizacion: null
    };
    agente.memoria.guardar();
    agente.confirmacion_pendiente = null;

    res.json({
      ok: true,
      mensaje: "Agente reiniciado"
    });

  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    agente: agente.config.nombre,
    timestamp: new Date().toISOString()
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Ruta no encontrada'
  });
});

// Error handler
app.use((err, req, res, next) => {
  agente.logger.error(`Server error: ${err.message}`);
  res.status(500).json({
    ok: false,
    error: 'Error interno del servidor'
  });
});

// ==================== INICIO ====================

const server = app.listen(PORT, () => {
  console.log('\n═══════════════════════════════════════');
  console.log(`  🤖 AGENTE API v1.1 INICIADO`);
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log('═══════════════════════════════════════\n');

  agente.logger.info(`API servidor iniciado en puerto ${PORT}`);

  // Mostrar endpoints
  console.log('📍 ENDPOINTS DISPONIBLES:\n');
  console.log(`  POST   /api/orden       - Ejecutar orden`);
  console.log(`  POST   /api/confirmar   - Confirmar acción`);
  console.log(`  GET    /api/estado      - Estado del agente`);
  console.log(`  GET    /api/historial   - Historial de acciones`);
  console.log(`  GET    /api/logs        - Ver logs (?lineas=50)`);
  console.log(`  POST   /api/reset       - Reiniciar agente`);
  console.log(`  GET    /health          - Health check\n`);

  console.log('🧪 PROBAR:\n');
  console.log(`  curl -X POST http://localhost:${PORT}/api/orden \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"orden":"crea carpeta test"}'\n`);
});

// Manejo de señales
process.on('SIGINT', () => {
  console.log('\n\n🛑 Apagando servidor...');
  server.close(() => {
    agente.logger.info('Servidor apagado');
    process.exit(0);
  });
});

module.exports = app;

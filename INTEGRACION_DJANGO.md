INTEGRACIÓN DJANGO + AGENTE MULTIAGENTE v1.2
==============================================

## 🎯 LO QUE TIENES AHORA

```
[Django] 
  ↓ POST /agente/ejecutar/
[API REST - Express - port 3000]
  ↓ Orquestador (routing inteligente)
[Multiagente]
  ├── Agente Código (Django, Python, scripts)
  ├── Agente Archivos (organización, búsqueda)
  └── Agente Sistema (bash, procesos, servicios)
```

---

## 📦 INSTALAR Y EJECUTAR

### 1. Instalar dependencias Node

```bash
cd ~/agentes/agente-pro
npm install
```

Instala: express, body-parser, chalk, node-fetch

### 2. Ejecutar el servidor API

```bash
npm run server
# o: node server.js
```

Sale:
```
═══════════════════════════════════════
  🤖 AGENTE API v1.2 INICIADO
  🌐 http://localhost:3000
═══════════════════════════════════════

📍 ENDPOINTS DISPONIBLES:

  POST   /api/orden       - Ejecutar orden
  POST   /api/confirmar   - Confirmar acción
  GET    /api/estado      - Estado del agente
  GET    /api/historial   - Historial de acciones
  GET    /api/logs        - Ver logs (?lineas=50)
  POST   /api/reset       - Reiniciar agente
  GET    /health          - Health check
```

---

## 🧪 PROBAR API DIRECTAMENTE

### Crear carpeta

```bash
curl -X POST http://localhost:3000/api/orden \
  -H "Content-Type: application/json" \
  -d '{"orden":"crea carpeta test"}'
```

Respuesta:
```json
{
  "ok": true,
  "resultado": "✅ CREAR_CARPETA\nCarpeta 'test' creada",
  "timestamp": "2025-04-11T15:30:00.000Z"
}
```

### Ver estado

```bash
curl http://localhost:3000/api/estado
```

---

## 🔗 INTEGRACIÓN DJANGO

### 1. Copiar cliente a tu Django

```bash
cp clientes/django_client.py tu_app/
```

### 2. En tu `urls.py`

```python
from django.urls import path
from . import views

urlpatterns = [
    # ... tus otras rutas
    
    # Agente
    path('api/agente/orden/', views.ejecutar_agente, name='ejecutar_agente'),
    path('api/agente/confirmar/', views.confirmar_agente, name='confirmar_agente'),
    path('api/agente/estado/', views.estado_agente, name='estado_agente'),
    path('api/agente/historial/', views.historial_agente, name='historial_agente'),
    path('api/agente/logs/', views.logs_agente, name='logs_agente'),
]
```

### 3. En tu vista Django (views.py)

```python
from agente_client import AgenteClient
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json

agente = AgenteClient("http://localhost:3000")

@csrf_exempt
@require_http_methods(["POST"])
def ejecutar_agente(request):
    """Ejecuta una orden en el agente"""
    datos = json.loads(request.body)
    orden = datos.get('orden')
    
    resultado = agente.ejecutar_orden(orden)
    return JsonResponse(resultado)

@csrf_exempt
@require_http_methods(["POST"])
def confirmar_agente(request):
    """Confirma una acción pendiente"""
    datos = json.loads(request.body)
    respuesta = datos.get('respuesta')
    
    resultado = agente.confirmar(respuesta)
    return JsonResponse(resultado)

@require_http_methods(["GET"])
def estado_agente(request):
    """Obtiene estado del agente"""
    return JsonResponse(agente.obtener_estado())

# ... resto de vistas
```

### 4. Probar desde Django

```bash
# Terminal 1: Agente API
cd ~/agentes/agente-pro
npm run server

# Terminal 2: Django
python manage.py runserver

# Terminal 3: Test
curl -X POST http://localhost:8000/api/agente/orden/ \
  -H "Content-Type: application/json" \
  -d '{"orden":"crea carpeta desde_django"}'
```

---

## 🤖 ENTENDER EL MULTIAGENTE

### Arquitectura

El **Orquestador** detecta automáticamente qué agente usar:

```
"crea proyecto django" → Agente Código
"organiza mis descargas" → Agente Archivos
"muestra procesos" → Agente Sistema
```

### Cómo funciona

**Archivo:** `core/orquestador.js`

```javascript
// Detecta por palabras clave
const tipo = orquestador.detectarTipo(orden);
// Retorna: 'codigo' | 'archivos' | 'sistema'
```

**Ejemplo:**
```javascript
const orden = "crea proyecto django facturación";
const tipo = orquestador.detectarTipo(orden);
// tipo = 'codigo' (detecta 'django' y 'proyecto')
```

---

## 📋 AGENTES DISPONIBLES

### 🔨 Agente Código

Ubicación: `core/agentes/codigo.js`

Capacidades:
- `crearProyectoDjango(nombre)` - Crea proyecto Django completo
- `crearScriptPython(nombre, contenido)` - Crea script Python
- `instalarPaquete(paquete)` - pip install

Ejemplos de órdenes:
```
"crea un proyecto django llamado ventas"
"crea un script python para procesar datos"
"instala pandas"
```

### 📁 Agente Archivos

Ubicación: `core/agentes/archivos.js`

Capacidades:
- `organizarPorExtension(carpeta)` - Agrupa por extensión
- `buscar(termino, carpeta)` - Encuentra archivos
- `crearCarpeta(nombre)` - Crea carpeta
- `listar(carpeta)` - Lista contenido
- `eliminar(ruta)` - Elimina archivo/carpeta
- `copiar(origen, destino)` - Copia archivos

Ejemplos:
```
"organiza mis descargas"
"busca archivos .pdf"
"crea carpeta proyectos"
"lista archivo en ~/Documentos"
```

### ⚙️ Agente Sistema

Ubicación: `core/agentes/sistema.js`

Capacidades:
- `ejecutarComando(cmd)` - Bash seguro (whitelist)
- `infoSistema()` - CPU, RAM, disco
- `verProcesos(filtro)` - ps aux
- `verLogs(servicio)` - journalctl
- `controlarServicio(servicio, accion)` - systemctl
- `infoRed()` - IPs y hostname

Ejemplos:
```
"info del sistema"
"muestra procesos node"
"restart ollama"
"ver logs del agente"
```

---

## 🚀 CASOS REALES DE USO

### Caso 1: Crear proyecto Django desde Django

```python
# En tu view
resultado = agente.ejecutar_orden("crea proyecto django ventas")

# Resultado:
{
  "ok": true,
  "resultado": "✅ CREAR_DJANGO\nProyecto Django 'ventas' creado en /home/user/ventas",
  "timestamp": "..."
}
```

### Caso 2: Organizar documentos automáticamente

```python
# Script que se ejecuta en background
resultado = agente.ejecutar_orden("organiza ~/Documentos")

# El agente:
# - Crea carpetas por extensión (.pdf, .docx, etc)
# - Mueve archivos automáticamente
```

### Caso 3: Crear estructura completa para nuevo módulo

```python
# Cliente Django hace:
agente.ejecutar_orden("crea proyecto django mi_modulo")

# Ahora tienes:
# ~/mi_modulo/
#   ├── venv/
#   ├── manage.py
#   ├── mi_modulo/
#   │   ├── settings.py
#   │   └── urls.py
#   └── principal/
#       ├── models.py
#       ├── views.py
#       └── urls.py
```

---

## 🧪 TESTING DEL MULTIAGENTE

### Probar cada agente por separado

```bash
# Terminal 1: Servidor
npm run server

# Terminal 2: Test Código
curl -X POST http://localhost:3000/api/orden \
  -H "Content-Type: application/json" \
  -d '{"orden":"crea carpeta test_codigo"}'

# Terminal 2: Test Archivos
curl -X POST http://localhost:3000/api/orden \
  -H "Content-Type: application/json" \
  -d '{"orden":"busca archivos .txt"}'

# Terminal 2: Test Sistema
curl -X POST http://localhost:3000/api/orden \
  -H "Content-Type: application/json" \
  -d '{"orden":"info del sistema"}'
```

---

## 🔒 SEGURIDAD

### Qué está protegido

1. **Whitelist de comandos** (Sistema)
   ```javascript
   const comandos_permitidos = [
     'ls', 'mkdir', 'cp', 'mv', 'rm', 'grep', 'find',
     'git', 'npm', 'pip', 'python3', 'systemctl'
   ];
   ```

2. **Validación de rutas** (Archivos)
   - No puede acceder fuera de `/home/usuario`
   - No puede tocar `/etc`, `/root`, etc.

3. **Permisos de archivos**
   - Valida nombres de proyectos/carpetas
   - Escapado de caracteres especiales

4. **Timeout**
   - 30 segundos máximo por operación
   - Evita bloqueos

---

## 📊 ARQUITECTURA DE ARCHIVOS

```
agente-pro/
├── index.js                     # CLI interactivo
├── server.js                    # API REST (Express)
├── agente.js                    # Controlador principal
├── core/
│   ├── agente.js               # IA + JSON parsing
│   ├── motor_acciones.js        # Ejecución segura (legacy)
│   ├── memoria.js              # Persistencia
│   ├── logger.js               # Logs
│   ├── orquestador.js          # Router inteligente
│   └── agentes/                # Agentes especializados
│       ├── codigo.js           # Django, Python, scripts
│       ├── archivos.js         # Gestión de archivos
│       └── sistema.js          # Bash, procesos, servicios
├── clientes/
│   └── django_client.py        # Cliente para Django
├── systemd/
│   ├── ollama.service
│   └── agente.service
├── package.json
└── README.md
```

---

## ⚡ PRÓXIMOS PASOS (NIVEL DIOS)

### Habilitar que el agente edite tu código Django

Actualmente:
- ✅ Crea proyectos Django
- ✅ Organiza archivos
- ❌ No modifica código

Próximo:
- 🔥 Editar models.py
- 🔥 Crear vistas automáticamente
- 🔥 Generar migraciones
- 🔥 Crear endpoints REST

Ejemplo:
```
"crea modelo Usuario con campos email y teléfono"
→ Agente Código edita models.py
→ Crea migración
→ Ejecuta migrate
```

---

## 🛠️ CONFIGURACIÓN

### Cambiar puerto de API

`server.js`:
```javascript
const PORT = 3000; // Cambiar aquí
```

### Cambiar modelo IA

`agente.js`:
```javascript
modelo: "mistral" // phi3, neural-chat, etc.
```

### Agregar nuevo agente

1. Crear `core/agentes/nuevo.js`
2. Agregar a `orquestador.js`
3. Definir palabras clave

---

## 📞 DEBUG

### Ver qué hace el orquestador

```bash
curl http://localhost:3000/api/estado
```

### Ver logs de todo

```bash
tail -f ~/.agente_datos/agente.log
```

### Ver logs de errores

```bash
tail -f ~/.agente_datos/errores.log
```

### Ver qué acciones ejecutó

```bash
tail -f ~/.agente_datos/acciones.log
```

---

## 🎯 CONCLUSIÓN

Ahora tienes:

✅ Servidor API con Express  
✅ 3 agentes especializados  
✅ Integración con Django  
✅ Multiagente inteligente (autorouting)  
✅ Seguridad en capas  
✅ Logs para auditoría  

El siguiente nivel: **Agente que edita tu código Django automáticamente**

Listo cuando quieras.

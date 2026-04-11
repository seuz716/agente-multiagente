# agente-multiagente

Integración Django + Sistema Multiagente Node.js (Express).

## Archivos principales

| Archivo | Descripción |
|---|---|
| django_client.py | Cliente Django para comunicarse con el agente (Lazy init) |
| server.js | API REST Express — endpoints del agente (async logs) |
| orquestador.js | Router inteligente multi-agente (typo + tie-break fix) |
| INTEGRACION_DJANGO.md | Documentación de integración |

## Parches aplicados (patch-implementacion)

1. **django_client.py** – Inicialización lazy, URL desde settings.AGENTE_URL
2. **server.js** – GET /api/logs ahora usa child_process.exec (no bloquea el Event Loop)
3. **orquestador.js** – Corregido typo palabrasClaveCodig, tie-breaking explícito en scoring

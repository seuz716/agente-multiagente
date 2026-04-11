"""
CLIENTE AGENTE DJANGO

Integración segura entre tu proyecto Django y el Agente IA.

Uso:
    from agente_client import AgenteClient
    
    cliente = AgenteClient("http://localhost:3000")
    resultado = cliente.ejecutar_orden("crea carpeta test")
    print(resultado)
"""

import requests
import json
from typing import Dict, Any, Optional
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import logging

logger = logging.getLogger(__name__)


class AgenteClient:
    """Cliente para comunicarse con el servidor del Agente"""

    def __init__(self, url_base: Optional[str] = None, timeout: int = 30):
        """
        Inicializa el cliente del agente (sin verificar conexión en el arranque).
        La URL se toma de settings.AGENTE_URL si no se especifica explícitamente.
        
        Args:
            url_base: URL base del servidor agente (ej: http://localhost:3000).
                      Si es None, usa getattr(settings, 'AGENTE_URL', 'http://localhost:3000').
            timeout: Timeout para requests en segundos
        """
        url = url_base or getattr(settings, 'AGENTE_URL', 'http://localhost:3000')
        self.url_base = url.rstrip('/')
        self.timeout = timeout
        # PATCH: _verificar_conexion() eliminado del __init__ para evitar bloqueo
        # en el arranque de Django. Llama a verificar_conexion() manualmente si lo necesitas.

    def verificar_conexion(self) -> bool:
        """Verifica que el servidor del agente esté disponible (Lazy / bajo demanda)."""
        try:
            respuesta = requests.get(
                f"{self.url_base}/health",
                timeout=5
            )
            return respuesta.status_code == 200
        except Exception as e:
            logger.warning(f"⚠️  Agente no disponible: {e}")
            return False

    # Alias privado por compatibilidad interna
    _verificar_conexion = verificar_conexion

    def ejecutar_orden(self, orden: str) -> Dict[str, Any]:
        """
        Ejecuta una orden en el agente
        
        Args:
            orden: Orden en lenguaje natural
            
        Returns:
            Dict con resultado de la ejecución
            
        Ejemplo:
            resultado = cliente.ejecutar_orden("crea carpeta test")
            if resultado['ok']:
                print(resultado['resultado'])
        """
        try:
            respuesta = requests.post(
                f"{self.url_base}/api/orden",
                json={"orden": orden},
                timeout=self.timeout
            )
            
            if respuesta.status_code == 200:
                return respuesta.json()
            else:
                return {
                    "ok": False,
                    "error": f"Status {respuesta.status_code}"
                }
                
        except requests.exceptions.Timeout:
            return {
                "ok": False,
                "error": "Timeout - El agente tardó demasiado"
            }
        except requests.exceptions.ConnectionError:
            return {
                "ok": False,
                "error": "No se pudo conectar con el agente. ¿Está corriendo?"
            }
        except Exception as e:
            return {
                "ok": False,
                "error": str(e)
            }

    def confirmar(self, respuesta: str) -> Dict[str, Any]:
        """
        Confirma una acción pendiente
        
        Args:
            respuesta: "sí" o "no"
            
        Returns:
            Dict con resultado
        """
        try:
            resp = requests.post(
                f"{self.url_base}/api/confirmar",
                json={"respuesta": respuesta},
                timeout=self.timeout
            )
            return resp.json() if resp.status_code == 200 else {"ok": False}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def obtener_estado(self) -> Dict[str, Any]:
        """Obtiene el estado actual del agente"""
        try:
            resp = requests.get(
                f"{self.url_base}/api/estado",
                timeout=self.timeout
            )
            return resp.json() if resp.status_code == 200 else {"ok": False}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def obtener_historial(self) -> Dict[str, Any]:
        """Obtiene el historial de acciones"""
        try:
            resp = requests.get(
                f"{self.url_base}/api/historial",
                timeout=self.timeout
            )
            return resp.json() if resp.status_code == 200 else {"ok": False}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def obtener_logs(self, lineas: int = 20) -> Dict[str, Any]:
        """Obtiene logs del agente"""
        try:
            resp = requests.get(
                f"{self.url_base}/api/logs?lineas={lineas}",
                timeout=self.timeout
            )
            return resp.json() if resp.status_code == 200 else {"ok": False}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def resetear(self) -> Dict[str, Any]:
        """Reinicia el agente"""
        try:
            resp = requests.post(
                f"{self.url_base}/api/reset",
                timeout=self.timeout
            )
            return resp.json() if resp.status_code == 200 else {"ok": False}
        except Exception as e:
            return {"ok": False, "error": str(e)}


# ==================== VISTAS DJANGO ====================

# ------------------------------------------------------------------
# PATCH: instancia global lazy — se crea solo la primera vez que
# se usa, tomando la URL de settings.AGENTE_URL en ese momento.
# Esto evita bloquear el arranque de Django con una conexión de red.
# ------------------------------------------------------------------
_agente_client_cache: Optional[AgenteClient] = None


def _get_agente_client() -> Optional[AgenteClient]:
    """Devuelve (y cachea) la instancia global del cliente de forma lazy."""
    global _agente_client_cache
    if _agente_client_cache is None:
        try:
            _agente_client_cache = AgenteClient()
        except Exception as exc:
            logger.error(f"No se pudo crear AgenteClient: {exc}")
            return None
    return _agente_client_cache


# Compatibilidad con código que importa 'agente_client' directamente
agente_client = _get_agente_client


@csrf_exempt
@require_http_methods(["POST"])
def ejecutar_agente(request):
    """
    Endpoint Django para ejecutar órdenes en el agente
    
    Uso:
        POST /agente/ejecutar/
        body: {"orden": "crea carpeta test"}
    """
    if not agente_client:
        return JsonResponse({
            "ok": False,
            "error": "Agente no disponible"
        }, status=503)

    try:
        datos = json.loads(request.body)
        orden = datos.get('orden')

        if not orden:
            return JsonResponse({
                "ok": False,
                "error": "Se requiere 'orden' en el body"
            }, status=400)

        resultado = agente_client.ejecutar_orden(orden)
        return JsonResponse(resultado)

    except json.JSONDecodeError:
        return JsonResponse({
            "ok": False,
            "error": "JSON inválido"
        }, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def confirmar_agente(request):
    """
    Confirma una acción pendiente en el agente
    
    Uso:
        POST /agente/confirmar/
        body: {"respuesta": "sí"}
    """
    if not agente_client:
        return JsonResponse({
            "ok": False,
            "error": "Agente no disponible"
        }, status=503)

    try:
        datos = json.loads(request.body)
        respuesta = datos.get('respuesta', '')

        resultado = agente_client.confirmar(respuesta)
        return JsonResponse(resultado)

    except json.JSONDecodeError:
        return JsonResponse({
            "ok": False,
            "error": "JSON inválido"
        }, status=400)


@require_http_methods(["GET"])
def estado_agente(request):
    """
    Obtiene el estado del agente
    
    Uso:
        GET /agente/estado/
    """
    if not agente_client:
        return JsonResponse({
            "ok": False,
            "error": "Agente no disponible"
        }, status=503)

    resultado = agente_client.obtener_estado()
    return JsonResponse(resultado)


@require_http_methods(["GET"])
def historial_agente(request):
    """
    Obtiene el historial de acciones
    
    Uso:
        GET /agente/historial/
    """
    if not agente_client:
        return JsonResponse({
            "ok": False,
            "error": "Agente no disponible"
        }, status=503)

    resultado = agente_client.obtener_historial()
    return JsonResponse(resultado)


@require_http_methods(["GET"])
def logs_agente(request):
    """
    Obtiene los logs del agente
    
    Uso:
        GET /agente/logs/?lineas=50
    """
    if not agente_client:
        return JsonResponse({
            "ok": False,
            "error": "Agente no disponible"
        }, status=503)

    lineas = int(request.GET.get('lineas', 20))
    resultado = agente_client.obtener_logs(lineas)
    return JsonResponse(resultado)


# ==================== URLconf ====================

"""
Agrega esto a tu urls.py:

from . import views

urlpatterns = [
    # ... otras rutas
    
    path('agente/ejecutar/', views.ejecutar_agente, name='ejecutar_agente'),
    path('agente/confirmar/', views.confirmar_agente, name='confirmar_agente'),
    path('agente/estado/', views.estado_agente, name='estado_agente'),
    path('agente/historial/', views.historial_agente, name='historial_agente'),
    path('agente/logs/', views.logs_agente, name='logs_agente'),
]
"""

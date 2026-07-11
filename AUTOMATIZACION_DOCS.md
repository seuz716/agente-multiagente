# Generación automática de documentos ofimáticos

## Dependencias instaladas
```bash
python3 -c "import docx" && python3 -c "import pptx" && python3 -c "import requests" 2>/dev/null || pip install python-docx python-pptx --break-system-packages
which soffice || apt install libreoffice --yes
which pdftoppm || apt install poppler-utils --yes
```

## Workflow de generación DOCX (APA 7)

### Script: `generar_docx.py`
```python
# Uso básico:
# python3 generar_docx.py

# Parámetros configurables:
# - titulo: str
# - autor: str  
# - afiliacion: str
# - curso: str
# - docente: str
# - fecha: str

# Verificación automática:
soffice --headless --convert-to pdf output.docx
pdftoppm -jpeg -r 100 output.pdf preview
```

### Template base
- Márgenes: 2.54 cm (estándar APA)
- Fuente: Arial 11pt
- Interlineado: doble
- Header: número de página automático (campo PAGE)
- Portada: título, autor, afiliación, curso, docente, fecha

## Workflow de generación PPTX

### Script: `generar_pptx.py`
```python
# Uso básico:
# python3 generar_pptx.py

# Parámetros configurables:
# - titulo: str
# - slides: lista de dicts con title/content
```

## Automatización vía script

Crear `build_docs.sh`:
```bash
#!/bin/bash
python3 generar_docx.py "$TITULO" "$AUTOR"
python3 generar_pptx.py "$TITULO"
git add *.docx *.pptx
git commit -m "docs: auto-generate $TITULO"
```

## MCP integration (opcional)

Añadir a settings.local.yaml:
```yaml
mcp_servers:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/cesar/Documentos"]
```
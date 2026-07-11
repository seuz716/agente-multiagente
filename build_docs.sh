#!/bin/bash
# build_docs.sh - Automatiza generación de documentos ofimáticos

set -e

# Parámetros (editar o pasar como argumentos)
TITULO="${1:-Sistema Agente-Multiagente}"
AUTOR="${2:-César Alarcón}"
FECHA="${3:-$(date +%B\ %Y)}"

echo "Generando documentos: $TITULO"

# Generar DOCX
python3 generar_docx.py "$TITULO" "$AUTOR" "" "" "" "$FECHA" 2>/dev/null || python3 generar_docx.py

# Generar PPTX
python3 generar_pptx.py "$TITULO"

# Verificar
if command -v soffice &>/dev/null; then
    soffice --headless --convert-to pdf informe_apa.docx --outdir . 2>/dev/null
    echo "PDF generado: informe_apa.pdf"
fi

echo "Documentos listos: informe_apa.docx presentacion_final.pptx"
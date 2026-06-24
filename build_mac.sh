#!/bin/bash
# build_mac.sh — Genera el ejecutable para macOS
# Uso: chmod +x build_mac.sh && ./build_mac.sh

set -e

echo "📦 Instalando PyInstaller..."
pip install pyinstaller --quiet

echo "🔨 Construyendo ejecutable para macOS..."
pyinstaller \
  --onefile \
  --name "Polla Mundial 2026" \
  --add-data "static:static" \
  --hidden-import flask \
  --hidden-import flask_cors \
  --hidden-import openpyxl \
  --hidden-import openpyxl.cell._writer \
  --collect-all openpyxl \
  app.py

echo ""
echo "✅ Listo! El ejecutable está en: dist/Polla Mundial 2026"
echo ""
echo "📋 Para distribuir, copia estos dos archivos en la misma carpeta:"
echo "   • dist/Polla Mundial 2026"
echo "   • Polla Mundial 2026.xlsx"
echo ""
echo "👆 Tus primos solo tienen que hacer doble clic en 'Polla Mundial 2026'"

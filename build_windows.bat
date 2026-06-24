@echo off
REM build_windows.bat — Genera el ejecutable para Windows
REM Requiere Python instalado. Ejecutar como: build_windows.bat

echo Instalando PyInstaller...
pip install pyinstaller --quiet

echo Construyendo ejecutable para Windows...
pyinstaller ^
  --onefile ^
  --name "Polla Mundial 2026" ^
  --add-data "static;static" ^
  --hidden-import flask ^
  --hidden-import flask_cors ^
  --hidden-import openpyxl ^
  --hidden-import openpyxl.cell._writer ^
  --collect-all openpyxl ^
  app.py

echo.
echo Listo! El ejecutable esta en: dist\Polla Mundial 2026.exe
echo.
echo Para distribuir, copia estos dos archivos en la misma carpeta:
echo   - dist\Polla Mundial 2026.exe
echo   - Polla Mundial 2026.xlsx
echo.
echo Tus primos solo tienen que hacer doble clic en "Polla Mundial 2026.exe"
pause

# ⚽ Polla Mundial 2026

Aplicación web para gestionar y visualizar una polla del Mundial de Fútbol 2026.  
Calcula automáticamente los puntos de cada participante (fase de grupos y playoffs) leyendo las predicciones y resultados desde un archivo Excel.

## Participantes
Hugo · Oscar · Camilo

---

## Sistema de puntos

### Fase de Grupos (por partido)
| Acierto | Puntos |
|---|---|
| Goles del local | 1 |
| Goles del visitante | 1 |
| Resultado (Local / Empate / Visitante) | 1 |
| Diferencia de goles | 1 |
| **Máximo por partido** | **4** |

> Ejemplo: predijiste 2-0 y el resultado fue 3-1 → aciertas resultado (+1) y diferencia de 2 (+1) = **2pts**

### Playoffs — Equipos clasificados
| Ronda | Puntos por equipo acertado |
|---|---|
| Dieciseisavos | 4 |
| Octavos | 6 |
| Cuartos | 8 |
| Semifinal | 10 |
| Tercer puesto | 12 |
| Final (finalistas) | 15 |
| Campeón | 20 |

---

## Estructura del proyecto

```
Mundial/
├── Polla Mundial 2026.xlsx        ← Archivo de datos (NO incluido en Git)
├── README.md
└── polla-app/
    ├── app.py                     ← Backend Flask
    ├── requirements.txt
    └── static/
        ├── index.html
        ├── styles.css
        └── app.js
```

### Hojas del Excel requeridas

| Hoja | Contenido |
|---|---|
| `Realidad` | Resultados reales de los 72 partidos de grupos |
| `Realidad Playoffs` | Equipos clasificados por ronda de playoffs |
| `Predicciones_Hugo` | Predicciones de Hugo (grupos) |
| `Predicciones_Oscar` | Predicciones de Oscar (grupos) |
| `Predicciones_Camilo` | Predicciones de Camilo (grupos) |
| `Playoffs_Hugo` | Predicciones de Hugo (playoffs) |
| `Playoffs_Oscar` | Predicciones de Oscar (playoffs) |
| `Playoffs_Camilo` | Predicciones de Camilo (playoffs) |

---

## Instalación (entorno de desarrollo)

### Requisitos previos
- Python 3.9 o superior
- pip

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/polla-mundial-2026.git
cd polla-mundial-2026
```

### 2. Crear entorno virtual

```bash
python3 -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows
```

### 3. Instalar dependencias

```bash
pip install -r polla-app/requirements.txt
```

### 4. Verificar el archivo Excel

El archivo `Polla Mundial 2026.xlsx` ya está incluido en el repositorio con los resultados actuales.  
Si necesitas reemplazarlo, colócalo en la raíz del proyecto (junto a la carpeta `polla-app/`).

### 5. Iniciar el servidor

```bash
cd polla-app
python3 app.py
```

La app estará disponible en: **http://127.0.0.1:5001**

---

## Flujo de uso

### Durante la fase de grupos
1. Ingresa los goles de cada partido en la hoja **`Realidad`** del Excel (columnas E y F).
2. Guarda el archivo Excel.
3. Haz clic en **↺ Actualizar Todo** en la app.
   - Recalcula los puntos de grupos.
   - Calcula los 32 clasificados al Dieciseisavos.
   - Actualiza la hoja **`Realidad Playoffs`** automáticamente.
   - Recarga toda la interfaz.

### Durante los playoffs
1. Ingresa manualmente los equipos clasificados por ronda en la hoja **`Realidad Playoffs`**:
   - Columna B → Octavos (16 equipos)
   - Columna C → Cuartos (8 equipos)
   - Columna D → Semifinal (4 equipos)
   - Columna E → Tercer puesto (1 equipo)
   - Columna F → Final (2 equipos)
   - Columna G → Campeón (1 equipo)
2. Guarda el archivo Excel.
3. Haz clic en **↺ Actualizar Todo** en la app.

---

## Dependencias

```
flask
flask-cors
openpyxl
```

Ver [`polla-app/requirements.txt`](polla-app/requirements.txt) para versiones exactas.

---

## Notas técnicas

- El backend usa `openpyxl` con `data_only=True` para leer el Excel. Las columnas de fórmulas (`Resultado`, `Diferencia`) se calculan directamente en Python desde los goles — no dependen del caché de fórmulas de Excel.
- Los nombres de equipos se normalizan (ignorando tildes/acentos) al comparar predicciones con resultados, evitando falsos negativos por diferencias ortográficas.
- El criterio de clasificación de los mejores terceros sigue las reglas FIFA: Puntos → Diferencia de gol → Goles anotados → Ranking FIFA.
- El servidor Flask corre en modo `debug=True` — solo usar en entornos de desarrollo local.

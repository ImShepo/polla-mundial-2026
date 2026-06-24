"""
Polla Mundial 2026 - Backend Flask
Lee las predicciones y resultados del Excel y calcula puntos.
"""

import os
import sys
import threading
import webbrowser
from flask import Flask, jsonify, request
from flask_cors import CORS
import openpyxl


def get_base_path():
    """Ruta base de recursos. Funciona en desarrollo y en bundle PyInstaller."""
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS  # carpeta temporal del bundle
    return os.path.dirname(os.path.abspath(__file__))


def get_excel_path():
    """El Excel siempre vive junto al ejecutable (o al script en dev)."""
    if getattr(sys, 'frozen', False):
        return os.path.join(os.path.dirname(sys.executable), 'Polla Mundial 2026.xlsx')
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Polla Mundial 2026.xlsx')


BASE_PATH = get_base_path()
EXCEL_PATH = get_excel_path()

app = Flask(__name__, static_folder=os.path.join(BASE_PATH, 'static'))
CORS(app)


PARTICIPANTS = ['Hugo', 'Oscar', 'Camilo']

# Puntos por ronda de playoff
PLAYOFF_POINTS = {
    'Dieciseisavos': 4,
    'Octavos': 6,
    'Cuartos': 8,
    'Semifinal': 10,
    'Tercero': 12,
    'Final': 15,
    'Campeón': 20,
}

PLAYOFF_COLUMNS = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Tercero', 'Final', 'Campeón']

# =====================================================
# Ranking FIFA de los 48 equipos participantes en el Mundial 2026
# Fuente: Rankings FIFA junio 2026 (oficiales pre-torneo)
# =====================================================
FIFA_RANKING = {
    'Argentina':            1,
    'España':               2,
    'Francia':              3,
    'Inglaterra':           4,
    'Portugal':             5,
    'Brasil':               6,
    'Marruecos':            7,
    'Países Bajos':         8,
    'Bélgica':              9,
    'Alemania':             10,
    'Croacia':              11,
    'Colombia':             13,
    'México':               14,
    'Senegal':              15,
    'Uruguay':              16,
    'Estados Unidos':       17,
    'Japón':                18,
    'Suiza':                19,
    'Irán':                 20,
    'Turquía':              22,
    'Ecuador':              23,
    'Australia':            27,
    'Costa de Marfil':      33,
    'Noruega':              34,
    'Escocia':              36,
    'Austria':              37,
    'República Checa':      40,
    'Paraguay':             41,
    'Canadá':               44,
    'Corea del Sur':        22,  # ~22nd
    'Suecia':               34,
    'Ghana':                50,
    'Argelia':              52,
    'Túnez':                36,
    'Egipto':               39,
    'Arabia Saudí':         56,
    'Sudáfrica':            60,
    'Jordania':             70,
    'RD Congo':             55,
    'Uzbekistán':           74,
    'Irak':                 67,
    'Bosnia y Herzegovina': 62,
    'Panamá':               80,
    'Haití':                83,
    'Cabo Verde':           90,
    'Catar':                57,
    'Curazao':              95,
    'Nueva Zelanda':        99,
}


def normalize_name(name):
    """Normaliza nombre de equipo para comparación insensible a tildes/acentos."""
    if not name:
        return ''
    replacements = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u',
        'ü': 'u', 'Ü': 'u', 'ñ': 'n', 'Ñ': 'n',
    }
    result = str(name).strip().lower()
    for orig, repl in replacements.items():
        result = result.replace(orig, repl)
    return result


def load_workbook(data_only=True):
    """Carga el workbook de Excel."""
    return openpyxl.load_workbook(EXCEL_PATH, data_only=data_only)


def read_group_predictions(ws, max_row=73):
    """
    Lee los partidos de fase de grupos de una hoja de predicciones.
    Retorna lista de dicts con partido, grupo, local, visitante, g_local, g_visitante, resultado, diferencia.
    """
    matches = []
    for row in ws.iter_rows(min_row=2, max_row=max_row, values_only=True):
        partido, grupo, local, visitante, g_local, g_visitante, resultado, diferencia = row[:8]
        if isinstance(partido, int):
            matches.append({
                'partido': partido,
                'grupo': grupo,
                'local': local,
                'visitante': visitante,
                'g_local': g_local,
                'g_visitante': g_visitante,
                'resultado': resultado,
                'diferencia': diferencia,
            })
    return matches


def read_playoffs(ws):
    """
    Lee la hoja de playoffs (Playoffs_XXX o Realidad Playoffs).
    Estructura: col A=Dieciseisavos, B=Octavos, C=Cuartos, D=Semifinal, E=Tercero, F=Final, G=Campeón
    Row 1 = headers, rows 2+ = equipos
    Retorna dict { 'Dieciseisavos': [equipo1, equipo2, ...], ... }
    """
    result = {ronda: [] for ronda in PLAYOFF_COLUMNS}
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, values_only=True):
        for col_idx, ronda in enumerate(PLAYOFF_COLUMNS):
            val = row[col_idx] if col_idx < len(row) else None
            if val is not None:
                result[ronda].append(str(val).strip())
    return result


def calculate_group_standings(real_matches):
    """
    Calcula la tabla de posiciones de cada grupo a partir de los partidos jugados.
    Solo cuenta partidos con g_local y g_visitante no nulos.

    Retorna dict { grupo: [ {equipo, pts, gf, gc, dg, pj, pg, pe, pp}, ... ] }
    ordenado por: pts DESC, dg DESC, gf DESC, ranking_fifa ASC
    """
    # Recopilar datos por grupo
    groups = {}
    for m in real_matches:
        g = m['grupo']
        if g not in groups:
            groups[g] = {}
        for equipo in [m['local'], m['visitante']]:
            if equipo not in groups[g]:
                groups[g][equipo] = {'pts': 0, 'gf': 0, 'gc': 0, 'pj': 0, 'pg': 0, 'pe': 0, 'pp': 0}

    for m in real_matches:
        g = m['grupo']
        local = m['local']
        visitante = m['visitante']
        gl = m['g_local']
        gv = m['g_visitante']

        if gl is None or gv is None:
            continue

        gl, gv = int(gl), int(gv)
        groups[g][local]['pj'] += 1
        groups[g][visitante]['pj'] += 1
        groups[g][local]['gf'] += gl
        groups[g][local]['gc'] += gv
        groups[g][visitante]['gf'] += gv
        groups[g][visitante]['gc'] += gl

        if gl > gv:
            groups[g][local]['pts'] += 3
            groups[g][local]['pg'] += 1
            groups[g][visitante]['pp'] += 1
        elif gv > gl:
            groups[g][visitante]['pts'] += 3
            groups[g][visitante]['pg'] += 1
            groups[g][local]['pp'] += 1
        else:
            groups[g][local]['pts'] += 1
            groups[g][visitante]['pts'] += 1
            groups[g][local]['pe'] += 1
            groups[g][visitante]['pe'] += 1

    # Calcular diferencia de goles y ordenar
    result = {}
    for g, teams in groups.items():
        table = []
        for equipo, stats in teams.items():
            stats['equipo'] = equipo
            stats['dg'] = stats['gf'] - stats['gc']
            stats['fifa_rank'] = FIFA_RANKING.get(equipo, 999)
            table.append(stats)

        # Ordenar: pts DESC, dg DESC, gf DESC, fifa_rank ASC
        table.sort(key=lambda t: (-t['pts'], -t['dg'], -t['gf'], t['fifa_rank']))

        # Asignar posiciones
        for i, t in enumerate(table):
            t['pos'] = i + 1

        # Marcar si el grupo está completo (6 partidos = todas las combinaciones de 4 equipos)
        total_matches = sum(t['pj'] for t in table) // 2
        group_complete = total_matches == 6
        group_started = total_matches > 0

        result[g] = {
            'table': table,
            'complete': group_complete,
            'started': group_started,
            'matches_played': total_matches,
        }

    return result


def get_best_thirds(standings):
    """
    Obtiene los 8 mejores terceros de entre los 12 grupos.

    Criterios FIFA (en orden):
    1. Puntos
    2. Diferencia de gol
    3. Goles anotados
    4. Fair play (no disponible → omitimos)
    5. Ranking FIFA

    Solo se consideran grupos donde el 3er puesto esté determinado
    (al menos que hayan jugado suficientes partidos).
    Retorna: (mejores_8, todos_12, grupos_completos)
    """
    thirds = []
    for grupo, data in sorted(standings.items()):
        table = data['table']
        if len(table) >= 3:
            third = table[2].copy()
            third['grupo'] = grupo
            thirds.append(third)

    # Ordenar los 12 terceros
    thirds.sort(key=lambda t: (-t['pts'], -t['dg'], -t['gf'], t['fifa_rank']))

    # Los 8 mejores clasifican, los 4 restantes quedan eliminados
    best_8 = thirds[:8]
    rest_4 = thirds[8:]

    return best_8, rest_4, thirds


def get_qualified_teams(standings, best_8_thirds):
    """
    Retorna todos los equipos clasificados al dieciseisavos.
    - Top 2 de cada grupo (24 equipos)
    - 8 mejores terceros
    Total: 32 equipos
    """
    qualified = []
    thirds_set = {t['equipo'] for t in best_8_thirds}

    for grupo, data in sorted(standings.items()):
        table = data['table']
        for team in table:
            if team['pos'] == 1:
                qualified.append({'equipo': team['equipo'], 'grupo': grupo, 'tipo': '1°', 'pos': 1})
            elif team['pos'] == 2:
                qualified.append({'equipo': team['equipo'], 'grupo': grupo, 'tipo': '2°', 'pos': 2})
            elif team['pos'] == 3 and team['equipo'] in thirds_set:
                qualified.append({'equipo': team['equipo'], 'grupo': grupo, 'tipo': '3° ★', 'pos': 3})

    return qualified


def write_qualified_to_excel(qualified_teams, best_8_thirds):
    """
    Escribe los equipos clasificados en la hoja 'Realidad Playoffs' del Excel,
    columna A (Dieciseisavos).
    Solo escribe si hay equipos clasificados.
    """
    if not qualified_teams:
        return False

    # Cargar sin data_only para poder escribir
    wb = load_workbook(data_only=False)
    ws = wb['Realidad Playoffs']

    # Limpiar columna A (Dieciseisavos) desde fila 2
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row):
        row[0].value = None

    # Escribir los equipos clasificados (32 equipos en col A)
    team_names = [t['equipo'] for t in qualified_teams]
    for i, name in enumerate(team_names):
        ws.cell(row=i + 2, column=1, value=name)

    wb.save(EXCEL_PATH)
    return True


def _calc_resultado_diferencia(g_local, g_visitante):
    """Calcula resultado y diferencia a partir de los goles (evita depender de fórmulas Excel)."""
    if g_local is None or g_visitante is None:
        return None, None
    g_local, g_visitante = int(g_local), int(g_visitante)
    if g_local > g_visitante:
        return 'Local', g_local - g_visitante
    elif g_local < g_visitante:
        return 'Visitante', g_local - g_visitante
    else:
        return 'Empate', 0


def calculate_group_points(predictions, actuals):
    """
    Compara predicciones de grupos vs resultados reales.
    IMPORTANTE: Calcula resultado y diferencia desde los goles directamente,
    NO confía en las columnas G y H del Excel (son fórmulas → vienen como None).
    """
    actual_by_match = {m['partido']: m for m in actuals if m['partido'] is not None}
    details = []

    for pred in predictions:
        partido = pred['partido']
        real = actual_by_match.get(partido)

        pts_g_local = 0
        pts_g_visitante = 0
        pts_resultado = 0
        pts_diferencia = 0
        played = False

        if real and real.get('g_local') is not None and real.get('g_visitante') is not None:
            played = True
            r_g_local = int(real['g_local'])
            r_g_visitante = int(real['g_visitante'])
            # Calcular resultado/diferencia desde los goles (no confiar en columnas de fórmulas)
            r_resultado, r_diferencia = _calc_resultado_diferencia(r_g_local, r_g_visitante)

            p_g_local = pred.get('g_local')
            p_g_visitante = pred.get('g_visitante')
            # Para las predicciones también calculamos (son valores directos en el Excel)
            p_resultado, p_diferencia = _calc_resultado_diferencia(p_g_local, p_g_visitante)

            if p_g_local is not None and int(p_g_local) == r_g_local:
                pts_g_local = 1
            if p_g_visitante is not None and int(p_g_visitante) == r_g_visitante:
                pts_g_visitante = 1
            if p_resultado is not None and r_resultado is not None and p_resultado == r_resultado:
                pts_resultado = 1
            if p_diferencia is not None and r_diferencia is not None and p_diferencia == r_diferencia:
                pts_diferencia = 1

        details.append({
            'partido': partido,
            'grupo': pred['grupo'],
            'local': pred['local'],
            'visitante': pred['visitante'],
            'pred_g_local': pred.get('g_local'),
            'pred_g_visitante': pred.get('g_visitante'),
            'pred_resultado': pred.get('resultado'),
            'pred_diferencia': pred.get('diferencia'),
            'real_g_local': real.get('g_local') if real else None,
            'real_g_visitante': real.get('g_visitante') if real else None,
            'real_resultado': real.get('resultado') if real else None,
            'real_diferencia': real.get('diferencia') if real else None,
            'played': played,
            'pts_g_local': pts_g_local,
            'pts_g_visitante': pts_g_visitante,
            'pts_resultado': pts_resultado,
            'pts_diferencia': pts_diferencia,
            'total': pts_g_local + pts_g_visitante + pts_resultado + pts_diferencia,
        })
    return details


def calculate_playoff_points(pred_playoffs, real_playoffs):
    """
    Compara predicciones de playoffs vs resultados reales.
    Usa normalización de nombres para evitar errores por tildes.
    """
    details = {}
    total = 0

    for ronda in PLAYOFF_COLUMNS:
        puntos_ronda = PLAYOFF_POINTS[ronda]
        pred_raw = pred_playoffs.get(ronda, [])
        real_raw = real_playoffs.get(ronda, [])

        # Normalizar para comparación, manteniendo el nombre original
        pred_norm = {normalize_name(t): t for t in pred_raw if t}
        real_norm = {normalize_name(t): t for t in real_raw if t}

        acertados_norm = set(pred_norm.keys()) & set(real_norm.keys())
        # Recuperar nombres originales de los acertados (usar el de real)
        acertados = sorted([real_norm[k] for k in acertados_norm])

        pts = len(acertados) * puntos_ronda
        total += pts

        details[ronda] = {
            'predichos': sorted(pred_raw),
            'reales': sorted(real_raw),
            'acertados': acertados,
            'puntos_por_acierto': puntos_ronda,
            'total_ronda': pts,
        }

    return {'por_ronda': details, 'total': total}


@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/api/data')
def get_data():
    """
    Retorna todos los datos + standings de grupos + clasificación a playoffs.
    """
    try:
        wb = load_workbook()

        # Leer resultados reales de grupos
        ws_realidad = wb['Realidad']
        real_matches = read_group_predictions(ws_realidad)

        # Leer resultados reales de playoffs
        ws_real_playoffs = wb['Realidad Playoffs']
        real_playoffs = read_playoffs(ws_real_playoffs)

        # Calcular clasificaciones de grupos
        standings = calculate_group_standings(real_matches)
        best_8, rest_4, all_thirds = get_best_thirds(standings)
        qualified = get_qualified_teams(standings, best_8)

        # Calcular para cada participante
        participants_data = {}
        for name in PARTICIPANTS:
            ws_pred = wb[f'Predicciones_{name}']
            predictions = read_group_predictions(ws_pred)

            ws_playoffs = wb[f'Playoffs_{name}']
            pred_playoffs = read_playoffs(ws_playoffs)

            group_details = calculate_group_points(predictions, real_matches)
            playoff_details = calculate_playoff_points(pred_playoffs, real_playoffs)

            group_total = sum(m['total'] for m in group_details)
            playoff_total = playoff_details['total']
            grand_total = group_total + playoff_total

            participants_data[name] = {
                'group_matches': group_details,
                'group_total': group_total,
                'playoffs': playoff_details,
                'playoff_total': playoff_total,
                'grand_total': grand_total,
            }

        # Rankings
        ranking = sorted(
            [{'name': n, 'total': participants_data[n]['grand_total']} for n in PARTICIPANTS],
            key=lambda x: x['total'],
            reverse=True
        )

        # Estadísticas de progreso del torneo
        total_group_matches = len(real_matches)  # 72
        played_group_matches = sum(1 for m in real_matches if m['g_local'] is not None and m['g_visitante'] is not None)
        groups_complete = sum(1 for g in standings.values() if g['complete'])
        groups_started = sum(1 for g in standings.values() if g['started'])

        # Puntos máximos posibles por participante (para rondas no jugadas)
        # Grupos: max 4pts por partido pendiente
        # Playoffs: max según equipos que aún no tienen resultado real
        tournament_progress = {
            'total_group_matches': 72,
            'played_group_matches': played_group_matches,
            'pending_group_matches': 72 - played_group_matches,
            'groups_complete': groups_complete,
            'groups_started': groups_started,
            'groups_total': 12,
            'group_stage_complete': groups_complete == 12,
            'real_playoffs_rounds': {
                ronda: len(real_playoffs.get(ronda, [])) for ronda in PLAYOFF_COLUMNS
            }
        }

        # Predicciones futuras: lo que cada participante predijo para rondas sin resultado real
        for name in PARTICIPANTS:
            ws_playoffs = wb[f'Playoffs_{name}']
            pred_playoffs = read_playoffs(ws_playoffs)
            future_preds = {}
            for ronda in PLAYOFF_COLUMNS:
                real_teams = real_playoffs.get(ronda, [])
                pred_teams = pred_playoffs.get(ronda, [])
                if not real_teams and pred_teams:  # ronda sin resultado real pero con predicción
                    future_preds[ronda] = sorted(pred_teams)
            participants_data[name]['future_predictions'] = future_preds

            # Puntos máximos posibles en grupos (partidos pendientes × 4pts max)
            pending_matches_pts = sum(
                4 for m in participants_data[name]['group_matches'] if not m['played']
            )
            # Puntos máximos posibles en playoffs (rondas sin resultado = todos podrían acertar)
            future_playoff_pts = sum(
                len(participants_data[name]['future_predictions'].get(ronda, [])) * PLAYOFF_POINTS[ronda]
                for ronda in PLAYOFF_COLUMNS
            )
            participants_data[name]['max_possible_extra'] = pending_matches_pts + future_playoff_pts
            participants_data[name]['max_total'] = participants_data[name]['grand_total'] + pending_matches_pts + future_playoff_pts

        return jsonify({
            'participants': participants_data,
            'ranking': ranking,
            'real_matches': real_matches,
            'real_playoffs': real_playoffs,
            'standings': standings,
            'best_8_thirds': best_8,
            'rest_4_thirds': rest_4,
            'all_thirds': all_thirds,
            'qualified': qualified,
            'tournament_progress': tournament_progress,
        })

    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/sync-playoffs', methods=['POST'])
def sync_playoffs():
    """
    Calcula los equipos clasificados al dieciseisavos y los escribe
    en la hoja 'Realidad Playoffs' del Excel (columna A = Dieciseisavos).
    """
    try:
        wb = load_workbook()
        ws_realidad = wb['Realidad']
        real_matches = read_group_predictions(ws_realidad)

        standings = calculate_group_standings(real_matches)
        best_8, rest_4, all_thirds = get_best_thirds(standings)
        qualified = get_qualified_teams(standings, best_8)

        if not qualified:
            return jsonify({'success': False, 'message': 'No hay equipos clasificados aún (no hay resultados de grupos).'})

        written = write_qualified_to_excel(qualified, best_8)
        return jsonify({
            'success': written,
            'message': f'Se escribieron {len(qualified)} equipos en Realidad Playoffs.',
            'qualified': [t['equipo'] for t in qualified],
        })

    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/sync-and-reload', methods=['POST'])
def sync_and_reload():
    """
    Endpoint que en un solo call:
    1. Calcula clasificados de grupos
    2. Escribe en Realidad Playoffs (col A)
    3. Retorna los datos completos actualizados (como /api/data)
    """
    try:
        wb = load_workbook()
        ws_realidad = wb['Realidad']
        real_matches = read_group_predictions(ws_realidad)

        standings = calculate_group_standings(real_matches)
        best_8, rest_4, all_thirds = get_best_thirds(standings)
        qualified = get_qualified_teams(standings, best_8)

        sync_msg = 'Sin equipos para guardar aún.'
        if qualified:
            write_qualified_to_excel(qualified, best_8)
            sync_msg = f'{len(qualified)} clasificados guardados en Realidad Playoffs.'

        # Ahora reload completo igual que /api/data pero desde el archivo ya actualizado
        import importlib, sys
        # Re-leer todo desde disco
        wb2 = load_workbook()
        ws_realidad2 = wb2['Realidad']
        real_matches2 = read_group_predictions(ws_realidad2)
        ws_real_playoffs2 = wb2['Realidad Playoffs']
        real_playoffs2 = read_playoffs(ws_real_playoffs2)
        standings2 = calculate_group_standings(real_matches2)
        best_8_2, rest_4_2, all_thirds_2 = get_best_thirds(standings2)
        qualified2 = get_qualified_teams(standings2, best_8_2)

        played_group_matches = sum(1 for m in real_matches2 if m['g_local'] is not None and m['g_visitante'] is not None)
        groups_complete = sum(1 for g in standings2.values() if g['complete'])
        groups_started = sum(1 for g in standings2.values() if g['started'])
        tournament_progress = {
            'total_group_matches': 72,
            'played_group_matches': played_group_matches,
            'pending_group_matches': 72 - played_group_matches,
            'groups_complete': groups_complete,
            'groups_started': groups_started,
            'groups_total': 12,
            'group_stage_complete': groups_complete == 12,
            'real_playoffs_rounds': {ronda: len(real_playoffs2.get(ronda, [])) for ronda in PLAYOFF_COLUMNS}
        }

        participants_data = {}
        for name in PARTICIPANTS:
            ws_pred = wb2[f'Predicciones_{name}']
            predictions = read_group_predictions(ws_pred)
            ws_playoffs = wb2[f'Playoffs_{name}']
            pred_playoffs = read_playoffs(ws_playoffs)
            group_details = calculate_group_points(predictions, real_matches2)
            playoff_details = calculate_playoff_points(pred_playoffs, real_playoffs2)
            group_total = sum(m['total'] for m in group_details)
            playoff_total = playoff_details['total']
            grand_total = group_total + playoff_total
            future_preds = {r: sorted(pred_playoffs.get(r, [])) for r in PLAYOFF_COLUMNS if not real_playoffs2.get(r) and pred_playoffs.get(r)}
            pending_matches_pts = sum(4 for m in group_details if not m['played'])
            future_playoff_pts = sum(len(future_preds.get(r, [])) * PLAYOFF_POINTS[r] for r in PLAYOFF_COLUMNS)
            participants_data[name] = {
                'group_matches': group_details,
                'group_total': group_total,
                'playoffs': playoff_details,
                'playoff_total': playoff_total,
                'grand_total': grand_total,
                'future_predictions': future_preds,
                'max_possible_extra': pending_matches_pts + future_playoff_pts,
                'max_total': grand_total + pending_matches_pts + future_playoff_pts,
            }

        ranking = sorted(
            [{'name': n, 'total': participants_data[n]['grand_total']} for n in PARTICIPANTS],
            key=lambda x: x['total'], reverse=True
        )

        return jsonify({
            'sync_message': sync_msg,
            'participants': participants_data,
            'ranking': ranking,
            'real_matches': real_matches2,
            'real_playoffs': real_playoffs2,
            'standings': standings2,
            'best_8_thirds': best_8_2,
            'rest_4_thirds': rest_4_2,
            'all_thirds': all_thirds_2,
            'qualified': qualified2,
            'tournament_progress': tournament_progress,
        })

    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


if __name__ == '__main__':
    IS_FROZEN = getattr(sys, 'frozen', False)
    PORT = 5001

    if IS_FROZEN:
        # Ejecutable: abre el browser automaticamente y corre sin debug
        def open_browser():
            webbrowser.open(f'http://127.0.0.1:{PORT}')
        threading.Timer(1.5, open_browser).start()
        print(f'\n⚽ Polla Mundial 2026 corriendo en http://127.0.0.1:{PORT}')
        print('   Cierra esta ventana para detener la app.\n')
        app.run(debug=False, port=PORT)
    else:
        # Desarrollo: modo debug normal
        app.run(debug=True, port=PORT)

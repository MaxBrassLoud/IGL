"""
IG Ludwig — Flask Webserver & API
Öffentliche API + vollständiges Admin-Panel mit Auth
"""

from flask import Flask, send_from_directory, jsonify, request
import json, os, secrets, re
from datetime import datetime
from functools import wraps

try:
    from PIL import Image
    import io
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False
    print("[WARN] Pillow nicht installiert – Bildoptimierung deaktiviert. pip install Pillow")

app = Flask(__name__, static_folder='static', static_url_path='/static')

# ── Konfiguration ────────────────────────────────────────────
ADMIN_USERNAME   = 'admin'
ADMIN_PASSWORD   = 'admin123'
KONTAKT_FILE     = 'kontaktanfragen.json'
PROJEKTE_FILE    = 'projekte.json'
KATEGORIEN_FILE  = 'kategorien.json'
IMG_PROJEKTE_DIR = 'img/projekte'
IMG_UPLOADS_DIR  = 'img/uploads'
MAX_UPLOAD_MB    = 2
MAX_IMG_SIDE     = 2000
active_sessions: dict = {}

os.makedirs(IMG_PROJEKTE_DIR, exist_ok=True)
os.makedirs(IMG_UPLOADS_DIR,  exist_ok=True)

DEFAULT_KATEGORIEN = [
    'Hochbau', 'Industriebau', 'Sanierung', 'Sonderbauwerk',
    'Infrastruktur', 'Sonstiges'
]

# ── JSON-Helpers ─────────────────────────────────────────────
def load_json(path, default):
    if not os.path.exists(path): return default
    with open(path, 'r', encoding='utf-8') as f: return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_kontaktanfragen(): return load_json(KONTAKT_FILE, [])
def save_kontaktanfragen(d): save_json(KONTAKT_FILE, d)

def load_kategorien():
    data = load_json(KATEGORIEN_FILE, None)
    if data is None:
        save_json(KATEGORIEN_FILE, DEFAULT_KATEGORIEN)
        return list(DEFAULT_KATEGORIEN)
    return data

def save_kategorien(k): save_json(KATEGORIEN_FILE, k)

INITIAL_PROJEKTE = {"Bauvorhaben": [
    {"Titel":"Wohnkomplex Am Stadtpark","Beschreibung":"Neubau eines 6-geschossigen Wohngebäudes mit 48 Wohneinheiten und Tiefgarage.","Kategorie":"Hochbau","Bilder":{"Bild_A":"https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80","Bild_B":"https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80"}},
    {"Titel":"Industriehalle Gewerbepark Nord","Beschreibung":"Stahlbau-Halle für Produktions- und Lagerzwecke auf 4.200 m² Grundfläche.","Kategorie":"Industriebau","Bilder":{"Bild_A":"https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80"}},
    {"Titel":"Sanierung Gründerzeithaus Maxvorstadt","Beschreibung":"Umfassende energetische und statische Sanierung eines denkmalgeschützten Gründerzeithauses.","Kategorie":"Sanierung","Bilder":{"Bild_A":"https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80"}},
    {"Titel":"Brücke Oberstaufen","Beschreibung":"Entwurf und Tragwerksplanung einer Fuß- und Radwegbrücke. Spannweite 38 m, Breite 3,5 m.","Kategorie":"Sonderbauwerk","Bilder":{"Bild_A":"https://images.unsplash.com/photo-1558981359-219d6364c9c8?w=800&q=80"}},
    {"Titel":"Ärztehaus Nymphenburg","Beschreibung":"Neubau eines dreigeschossigen Ärztehauses mit barrierefreier Erschließung.","Kategorie":"Hochbau","Bilder":{"Bild_A":"https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&q=80"}},
    {"Titel":"Logistikzentrum Flughafen","Beschreibung":"Planungsleistungen für ein 12.000 m² großes Logistikzentrum mit DGNB-Silber-Zertifizierung.","Kategorie":"Industriebau","Bilder":{"Bild_A":"https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&q=80","Bild_B":"https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=800&q=80"}}
]}

def load_projekte():
    data = load_json(PROJEKTE_FILE, None)
    if data is None:
        save_json(PROJEKTE_FILE, INITIAL_PROJEKTE)
        return list(INITIAL_PROJEKTE['Bauvorhaben'])
    return data.get('Bauvorhaben', [])

def save_projekte(liste): save_json(PROJEKTE_FILE, {'Bauvorhaben': liste})

# ── Bild-Helpers ─────────────────────────────────────────────
ALLOWED_EXTENSIONS = {'jpg','jpeg','png','gif','webp','bmp','tiff'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def process_and_save_image(file_bytes, save_path, max_side=MAX_IMG_SIDE):
    if not PILLOW_AVAILABLE:
        with open(save_path, 'wb') as f: f.write(file_bytes)
        return True, save_path
    try:
        img = Image.open(io.BytesIO(file_bytes))
        if img.mode not in ('RGB', 'L'): img = img.convert('RGB')
        if max(img.size) > max_side: img.thumbnail((max_side, max_side), Image.LANCZOS)
        clean = Image.new(img.mode, img.size)
        clean.putdata(list(img.getdata()))
        png_path = os.path.splitext(save_path)[0] + '.png'
        clean.save(png_path, format='PNG', optimize=True)
        return True, png_path
    except Exception as e:
        print(f"[IMG] Fehler: {e}")
        return False, None

# ── Auth ─────────────────────────────────────────────────────
def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer ') or auth[7:] not in active_sessions:
            return jsonify({'error': 'Nicht autorisiert'}), 401
        return f(*args, **kwargs)
    return decorated

# ════════════════════════════════════════════════════════════
# STATISCHE BILD-ROUTES
# ════════════════════════════════════════════════════════════
@app.route('/img/projekte/<path:filename>')
def serve_projekt_img(filename):
    return send_from_directory(IMG_PROJEKTE_DIR, filename)

@app.route('/img/uploads/<path:filename>')
def serve_upload_img(filename):
    return send_from_directory(IMG_UPLOADS_DIR, filename)

# ════════════════════════════════════════════════════════════
# ÖFFENTLICHE SEITEN
# ════════════════════════════════════════════════════════════
PAGE_MAP = {'/':'index.html','/ueber-uns':'ueber-uns.html','/projekte':'projekte.html',
            '/kontakt':'kontakt.html','/impressum':'impressum.html',
            '/datenschutz':'datenschutz.html','/cookies':'cookies.html'}

@app.route('/')
@app.route('/ueber-uns')
@app.route('/projekte')
@app.route('/kontakt')
@app.route('/impressum')
@app.route('/datenschutz')
@app.route('/cookies')
def serve_page():
    return send_from_directory('.', PAGE_MAP.get(request.path, 'index.html'))

# ════════════════════════════════════════════════════════════
# ADMIN SEITEN
# ════════════════════════════════════════════════════════════
@app.route('/admin/')
@app.route('/admin/index')
def admin_index(): return send_from_directory('admin', 'index.html')

@app.route('/admin/login')
def admin_login(): return send_from_directory('admin', 'login.html')

@app.route('/admin/anfragen')
def admin_anfragen(): return send_from_directory('admin', 'anfragen.html')

@app.route('/admin/projekte')
def admin_projekte_page(): return send_from_directory('admin', 'projekte.html')

# ════════════════════════════════════════════════════════════
# ÖFFENTLICHE API
# ════════════════════════════════════════════════════════════
@app.route('/api/projekte', methods=['GET'])
def api_projekte():
    return jsonify({'Bauvorhaben': load_projekte()})

@app.route('/api/kategorien', methods=['GET'])
def api_kategorien():
    """Öffentlich – für den Filter auf der Projektseite."""
    return jsonify(load_kategorien())

@app.route('/api/kontakt', methods=['POST'])
def api_kontakt():
    if request.content_type and 'multipart/form-data' in request.content_type:
        data  = request.form
        files = request.files.getlist('anhang')
    else:
        data  = request.get_json(silent=True) or {}
        files = []

    missing = [f for f in ['name','email','nachricht'] if not data.get(f,'').strip()]
    if missing:
        return jsonify({'error': f'Fehlende Felder: {", ".join(missing)}'}), 422

    name = data.get('name','').strip()
    saved_images = []

    if files:
        folder_name = re.sub(r'\s+','_', re.sub(r'[^\w\s-]','', name))[:60]
        target_dir  = os.path.join(IMG_UPLOADS_DIR, folder_name)
        os.makedirs(target_dir, exist_ok=True)
        for i, f in enumerate(files[:5]):
            if not f or not f.filename or not allowed_file(f.filename): continue
            raw = f.read()
            if len(raw) > MAX_UPLOAD_MB * 1024 * 1024: continue
            tmp = os.path.join(target_dir, f'anhang_{i+1}.png')
            ok, final = process_and_save_image(raw, tmp)
            if ok and final:
                saved_images.append('/' + final.replace('\\','/'))

    anfragen = load_kontaktanfragen()
    eintrag  = {
        'id':        len(anfragen)+1,
        'gelesen':   False,
        'timestamp': data.get('timestamp', datetime.now().isoformat()),
        'bilder':    saved_images,
        **{k: data.get(k,'').strip() for k in ['name','email','telefon','betreff','nachricht']}
    }
    anfragen.append(eintrag)
    save_kontaktanfragen(anfragen)
    print(f"[KONTAKT] #{eintrag['id']} von {eintrag['name']} | {len(saved_images)} Bild(er)")
    return jsonify({'success': True, 'id': eintrag['id']}), 201

# ════════════════════════════════════════════════════════════
# ADMIN AUTH
# ════════════════════════════════════════════════════════════
@app.route('/api/admin/login', methods=['POST'])
def api_admin_login():
    data = request.get_json(silent=True) or {}
    if data.get('username') != ADMIN_USERNAME or data.get('password') != ADMIN_PASSWORD:
        return jsonify({'error': 'Ungültige Zugangsdaten'}), 401
    token = secrets.token_hex(32)
    active_sessions[token] = {'username': data['username'], 'created': datetime.now().isoformat()}
    return jsonify({'token': token, 'username': data['username']})

@app.route('/api/admin/logout', methods=['POST'])
@require_admin
def api_admin_logout():
    active_sessions.pop(request.headers['Authorization'][7:], None)
    return jsonify({'success': True})

# ════════════════════════════════════════════════════════════
# ADMIN STATS
# ════════════════════════════════════════════════════════════
@app.route('/api/admin/stats', methods=['GET'])
@require_admin
def api_admin_stats():
    anfragen   = load_kontaktanfragen()
    projekte   = load_projekte()
    kategorien = load_kategorien()
    return jsonify({
        'anfragen_gesamt':    len(anfragen),
        'anfragen_ungelesen': sum(1 for a in anfragen if not a.get('gelesen')),
        'projekte':           len(projekte),
        'kategorien':         len(kategorien)
    })

# ════════════════════════════════════════════════════════════
# ADMIN KATEGORIEN API
# ════════════════════════════════════════════════════════════
@app.route('/api/admin/kategorien', methods=['GET'])
@require_admin
def api_admin_kategorien_list():
    kategorien = load_kategorien()
    projekte   = load_projekte()
    result = []
    for k in kategorien:
        count = sum(1 for p in projekte if p.get('Kategorie') == k)
        result.append({'name': k, 'count': count})
    return jsonify(result)

@app.route('/api/admin/kategorien', methods=['POST'])
@require_admin
def api_admin_kategorien_add():
    data = request.get_json(silent=True) or {}
    name = data.get('name','').strip()
    if not name: return jsonify({'error': 'Name erforderlich'}), 422
    kategorien = load_kategorien()
    if name in kategorien: return jsonify({'error': 'Kategorie existiert bereits'}), 409
    kategorien.append(name)
    save_kategorien(kategorien)
    return jsonify({'success': True, 'kategorien': kategorien}), 201

@app.route('/api/admin/kategorien/<string:name>', methods=['DELETE'])
@require_admin
def api_admin_kategorien_delete(name):
    kategorien = load_kategorien()
    if name not in kategorien: return jsonify({'error': 'Nicht gefunden'}), 404
    projekte = load_projekte()
    in_use   = sum(1 for p in projekte if p.get('Kategorie') == name)
    if in_use:
        return jsonify({'error': f'Wird von {in_use} Projekt(en) verwendet.'}), 409
    kategorien.remove(name)
    save_kategorien(kategorien)
    return jsonify({'success': True})

@app.route('/api/admin/kategorien/<string:name>', methods=['PUT'])
@require_admin
def api_admin_kategorien_rename(name):
    data     = request.get_json(silent=True) or {}
    new_name = data.get('name','').strip()
    if not new_name: return jsonify({'error': 'Neuer Name erforderlich'}), 422
    kategorien = load_kategorien()
    if name not in kategorien: return jsonify({'error': 'Nicht gefunden'}), 404
    if new_name in kategorien and new_name != name:
        return jsonify({'error': 'Name bereits vergeben'}), 409
    kategorien[kategorien.index(name)] = new_name
    save_kategorien(kategorien)
    projekte = load_projekte()
    changed  = 0
    for p in projekte:
        if p.get('Kategorie') == name:
            p['Kategorie'] = new_name
            changed += 1
    if changed: save_projekte(projekte)
    return jsonify({'success': True, 'updated_projects': changed})

# ════════════════════════════════════════════════════════════
# ADMIN ANFRAGEN API
# ════════════════════════════════════════════════════════════
@app.route('/api/admin/anfragen', methods=['GET'])
@require_admin
def api_admin_anfragen_list():
    anfragen = sorted(load_kontaktanfragen(), key=lambda a: a.get('timestamp',''), reverse=True)
    limit    = request.args.get('limit', type=int)
    return jsonify(anfragen[:limit] if limit else anfragen)

@app.route('/api/admin/anfragen/<int:aid>/gelesen', methods=['PATCH'])
@require_admin
def api_anfrage_gelesen(aid):
    anfragen = load_kontaktanfragen()
    item = next((a for a in anfragen if a['id'] == aid), None)
    if not item: return jsonify({'error': 'Nicht gefunden'}), 404
    item['gelesen'] = True
    save_kontaktanfragen(anfragen)
    return jsonify({'success': True})

@app.route('/api/admin/anfragen/alle-gelesen', methods=['PATCH'])
@require_admin
def api_alle_gelesen():
    anfragen = load_kontaktanfragen()
    for a in anfragen: a['gelesen'] = True
    save_kontaktanfragen(anfragen)
    return jsonify({'success': True})

@app.route('/api/admin/anfragen/<int:aid>', methods=['DELETE'])
@require_admin
def api_anfrage_delete(aid):
    anfragen = load_kontaktanfragen()
    new = [a for a in anfragen if a['id'] != aid]
    if len(new) == len(anfragen): return jsonify({'error': 'Nicht gefunden'}), 404
    save_kontaktanfragen(new)
    return jsonify({'success': True})

@app.route('/api/admin/anfragen/gelesene-loeschen', methods=['DELETE'])
@require_admin
def api_gelesene_loeschen():
    anfragen = load_kontaktanfragen()
    new = [a for a in anfragen if not a.get('gelesen')]
    save_kontaktanfragen(new)
    return jsonify({'success': True, 'deleted': len(anfragen)-len(new)})

# ════════════════════════════════════════════════════════════
# ADMIN PROJEKTE API
# ════════════════════════════════════════════════════════════
@app.route('/api/admin/projekte', methods=['POST'])
@require_admin
def api_projekt_create():
    data = request.get_json(silent=True) or {}
    if not data.get('Titel') or not data.get('Beschreibung'):
        return jsonify({'error': 'Titel und Beschreibung erforderlich'}), 422
    projekte = load_projekte()
    projekte.append({'Titel':data['Titel'].strip(),'Beschreibung':data['Beschreibung'].strip(),
                     'Kategorie':data.get('Kategorie','Sonstiges').strip(),'Bilder':data.get('Bilder',{})})
    save_projekte(projekte)
    return jsonify({'success': True, 'index': len(projekte)-1}), 201

@app.route('/api/admin/projekte/<int:idx>', methods=['PUT'])
@require_admin
def api_projekt_update(idx):
    projekte = load_projekte()
    if idx < 0 or idx >= len(projekte): return jsonify({'error': 'Index nicht gefunden'}), 404
    data = request.get_json(silent=True) or {}
    if not data.get('Titel') or not data.get('Beschreibung'):
        return jsonify({'error': 'Titel und Beschreibung erforderlich'}), 422
    projekte[idx] = {'Titel':data['Titel'].strip(),'Beschreibung':data['Beschreibung'].strip(),
                     'Kategorie':data.get('Kategorie',projekte[idx].get('Kategorie','Sonstiges')).strip(),
                     'Bilder':data.get('Bilder',projekte[idx].get('Bilder',{}))}
    save_projekte(projekte)
    return jsonify({'success': True})

@app.route('/api/admin/projekte/<int:idx>', methods=['DELETE'])
@require_admin
def api_projekt_delete(idx):
    projekte = load_projekte()
    if idx < 0 or idx >= len(projekte): return jsonify({'error': 'Index nicht gefunden'}), 404
    projekte.pop(idx)
    save_projekte(projekte)
    return jsonify({'success': True})

@app.route('/api/admin/projekte/upload-bild', methods=['POST'])
@require_admin
def api_projekt_upload_bild():
    if 'bild' not in request.files: return jsonify({'error': 'Kein Bild'}), 400
    f = request.files['bild']
    if not f or not f.filename or not allowed_file(f.filename):
        return jsonify({'error': 'Ungültige Datei'}), 400
    raw      = f.read()
    ts       = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    orig     = re.sub(r'[^\w.-]','_', f.filename.rsplit('.',1)[0])[:40]
    filename = f'{ts}_{orig}.png'
    ok, final = process_and_save_image(raw, os.path.join(IMG_PROJEKTE_DIR, filename), max_side=3000)
    if not ok: return jsonify({'error': 'Bildverarbeitung fehlgeschlagen'}), 500
    return jsonify({'success': True, 'url': '/' + final.replace('\\','/'), 'filename': filename})

# ════════════════════════════════════════════════════════════
# FEHLERSEITEN
# ════════════════════════════════════════════════════════════
@app.errorhandler(404)
def not_found(e):    return send_from_directory('.', '404.html'), 404

@app.errorhandler(500)
def server_error(e): return send_from_directory('.', '500.html'), 500

if __name__ == '__main__':
    print("╔══════════════════════════════════════════════════╗")
    print("║        IG Ludwig — Flask Server                 ║")
    print("╠══════════════════════════════════════════════════╣")
    print("║   Website:  http://localhost:5000               ║")
    print("║   Admin:    http://localhost:5000/admin/        ║")
    print("║   Login:    admin / admin123                    ║")
    if not PILLOW_AVAILABLE:
        print("║   [!] Pillow fehlt: pip install Pillow          ║")
    print("╚══════════════════════════════════════════════════╝")
    app.run(debug=True, host='0.0.0.0', port=5000)

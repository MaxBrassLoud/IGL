"""
Schreiber & Partner Ingenieurbüro — Flask Webserver & API
==========================================================
Routen:
  GET  /                  → index.html
  GET  /ueber-uns         → ueber-uns.html
  GET  /projekte          → projekte.html
  GET  /kontakt           → kontakt.html
  GET  /impressum         → impressum.html
  GET  /datenschutz       → datenschutz.html
  GET  /cookies           → cookies.html

API:
  GET  /api/projekte      → JSON-Liste aller Bauvorhaben
  POST /api/kontakt       → Kontaktanfrage speichern

Fehlerseiten:
  404, 500
"""

from flask import Flask, send_from_directory, jsonify, request, abort
import json
import os
from datetime import datetime

# ── Flask konfigurieren ──────────────────────────────────────
app = Flask(__name__,
            static_folder='static',
            static_url_path='/static')

# Verzeichnis für gespeicherte Kontaktanfragen
KONTAKT_FILE = 'kontaktanfragen.json'

# ── Hilfsfunktionen ──────────────────────────────────────────
def load_kontaktanfragen():
    if not os.path.exists(KONTAKT_FILE):
        return []
    with open(KONTAKT_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_kontaktanfrage(data: dict):
    anfragen = load_kontaktanfragen()
    anfragen.append(data)
    with open(KONTAKT_FILE, 'w', encoding='utf-8') as f:
        json.dump(anfragen, f, ensure_ascii=False, indent=2)

# ── Mock-Projektdaten ────────────────────────────────────────
MOCK_PROJEKTE = {
    "Bauvorhaben": [
        {
            "Titel": "Wohnkomplex Am Stadtpark",
            "Beschreibung": "Neubau eines 6-geschossigen Wohngebäudes mit 48 Wohneinheiten und Tiefgarage. Tragwerksplanung, Bauleitung und Energieberatung aus einer Hand.",
            "Kategorie": "Hochbau",
            "Bilder": {
                "Bild_A": "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80",
                "Bild_B": "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
                "Bild_C": "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80"
            }
        },
        {
            "Titel": "Industriehalle Gewerbepark Nord",
            "Beschreibung": "Stahlbau-Halle für Produktions- und Lagerzwecke auf 4.200 m² Grundfläche. Inklusive Kranbahnanlage und Büroteil im Erdgeschoss.",
            "Kategorie": "Industriebau",
            "Bilder": {
                "Bild_A": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
                "Bild_B": "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800&q=80"
            }
        },
        {
            "Titel": "Sanierung Gründerzeithaus Maxvorstadt",
            "Beschreibung": "Umfassende energetische und statische Sanierung eines denkmalgeschützten Gründerzeithauses. Innendämmung, Deckenverstärkung und neue Haustechnik.",
            "Kategorie": "Sanierung",
            "Bilder": {
                "Bild_A": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",
                "Bild_B": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80"
            }
        },
        {
            "Titel": "Brücke Oberstaufen",
            "Beschreibung": "Entwurf und Tragwerksplanung einer Fuß- und Radwegbrücke in Stahlbeton-Verbundbauweise. Spannweite 38 m, Breite 3,5 m.",
            "Kategorie": "Sonderbauwerk",
            "Bilder": {
                "Bild_A": "https://images.unsplash.com/photo-1558981359-219d6364c9c8?w=800&q=80"
            }
        },
        {
            "Titel": "Ärztehaus Nymphenburg",
            "Beschreibung": "Neubau eines dreigeschossigen Ärztehauses mit barrierefreier Erschließung, medizintechnischer Infrastruktur und Parkdeck im Untergeschoss.",
            "Kategorie": "Hochbau",
            "Bilder": {
                "Bild_A": "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&q=80",
                "Bild_B": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80"
            }
        },
        {
            "Titel": "Logistikzentrum Flughafen",
            "Beschreibung": "Planungsleistungen für ein 12.000 m² großes Logistikzentrum mit vollautomatischer Fördertechnik und DGNB-Silber-Zertifizierung.",
            "Kategorie": "Industriebau",
            "Bilder": {
                "Bild_A": "https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&q=80",
                "Bild_B": "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=800&q=80",
                "Bild_C": "https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&q=80"
            }
        }
    ]
}

# ── Seiten-Routen ────────────────────────────────────────────
PAGE_MAP = {
    '/':            'index.html',
    '/ueber-uns':   'ueber-uns.html',
    '/projekte':    'projekte.html',
    '/kontakt':     'kontakt.html',
    '/impressum':   'impressum.html',
    '/datenschutz': 'datenschutz.html',
    '/cookies':     'cookies.html',
}

@app.route('/')
@app.route('/ueber-uns')
@app.route('/projekte')
@app.route('/kontakt')
@app.route('/impressum')
@app.route('/datenschutz')
@app.route('/cookies')
def serve_page():
    filename = PAGE_MAP.get(request.path, 'index.html')
    return send_from_directory('.', filename)

# ── API: Projekte ────────────────────────────────────────────
@app.route('/api/projekte', methods=['GET'])
def api_projekte():
    """
    Gibt alle Bauvorhaben als JSON zurück.
    Kann um echte Datenbankabfragen erweitert werden.
    """
    return jsonify(MOCK_PROJEKTE)

# ── API: Kontakt ─────────────────────────────────────────────
@app.route('/api/kontakt', methods=['POST'])
def api_kontakt():
    """
    Nimmt Kontaktanfragen entgegen und speichert sie in kontaktanfragen.json.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Kein JSON-Body übermittelt'}), 400

    # Pflichtfelder prüfen
    required = ['name', 'email', 'nachricht']
    missing = [f for f in required if not data.get(f, '').strip()]
    if missing:
        return jsonify({'error': f'Fehlende Pflichtfelder: {", ".join(missing)}'}), 422

    # Eintrag anlegen
    eintrag = {
        'id':        len(load_kontaktanfragen()) + 1,
        'name':      data.get('name', '').strip(),
        'email':     data.get('email', '').strip(),
        'telefon':   data.get('telefon', '').strip(),
        'betreff':   data.get('betreff', '').strip(),
        'nachricht': data.get('nachricht', '').strip(),
        'timestamp': data.get('timestamp', datetime.now().isoformat()),
        'gelesen':   False
    }

    save_kontaktanfrage(eintrag)
    print(f"[KONTAKT] Neue Anfrage von {eintrag['name']} <{eintrag['email']}>")

    return jsonify({'success': True, 'id': eintrag['id']}), 201

# ── Fehlerseiten ─────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return send_from_directory('.', '404.html'), 404

@app.errorhandler(500)
def server_error(e):
    return send_from_directory('.', '500.html'), 500

# ── Start ────────────────────────────────────────────────────
if __name__ == '__main__':
    print("╔══════════════════════════════════════════════════╗")
    print("║   Schreiber & Partner Ingenieurbüro — Server    ║")
    print("╠══════════════════════════════════════════════════╣")
    print("║   http://localhost:5000                          ║")
    print("╚══════════════════════════════════════════════════╝")
    app.run(debug=True, host='0.0.0.0', port=5000)

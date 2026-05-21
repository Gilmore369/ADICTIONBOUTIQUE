"""
fix_fechas_categorias_marcas.py
────────────────────────────────
Restaura created_at de:
  - categories  (basado en min Producto.dFechaReg por SubLinea)
  - brands      (basado en min Producto.dFechaReg por Marca)

Match por nombre (case-insensitive, normalizado).
"""
import csv, json, urllib.request, urllib.error, sys, re
from collections import defaultdict
from pathlib import Path

SUPA_URL = "https://mwdqdrqlzlffmfqqcnmp.supabase.co"
SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo"
DATA_DIR = Path(__file__).parent / "RESTORE_OUTPUT" / "DATA_CSV"
DRY = "--dry-run" in sys.argv

def read_csv_utf16(path):
    with open(path, "rb") as fh:
        raw = fh.read()
    text = raw.decode("utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8-sig")
    lines = text.splitlines()
    header = lines[0]
    body = [l for l in lines[1:] if not re.match(r"^-+(,-+)+\s*$", l)]
    return list(csv.DictReader([header] + body))

def req(method, path, body=None):
    url = SUPA_URL + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "application/json"}
    rq = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(rq, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def fetch_all(path):
    out, off = [], 0
    while True:
        s, b = req("GET", f"{path}{'&' if '?' in path else '?'}offset={off}&limit=1000")
        if s != 200 or not b: break
        chunk = json.loads(b)
        if not chunk: break
        out.extend(chunk)
        if len(chunk) < 1000: break
        off += 1000
    return out

def normalize(s):
    return re.sub(r"\s+", " ", (s or "").strip().upper())

def parse_fecha(s):
    # '2014-03-23 20:23:02.263' → '2014-03-23T20:23:02+00:00'
    s = (s or "").strip()
    if not s or s == "NULL": return None
    s = s.split(".")[0].replace(" ", "T") + "+00:00"
    return s

print("→ Cargando CSVs legacy...")
sublineas  = read_csv_utf16(DATA_DIR / "dbo.SubLinea.csv")
constantes = read_csv_utf16(DATA_DIR / "dbo.Constante.csv")
productos  = read_csv_utf16(DATA_DIR / "dbo.Producto.csv")
print(f"  SubLinea={len(sublineas)} Constante={len(constantes)} Producto={len(productos)}")

# idSubLinea -> name
sub_name_by_id = {s["idSubLinea"].strip(): s.get("subLinea", "").strip() for s in sublineas}
# idMarca -> name (Constante nConsCod=1022)
marca_name_by_id = {}
for c in constantes:
    if c.get("nConsCod", "").strip() == "1022":
        marca_name_by_id[c["nValor"].strip()] = c.get("cDesc", "").strip()

# Earliest dFechaReg per subLinea name and per marca name
earliest_cat = {}   # normalized name -> ISO date
earliest_brand = {}

for p in productos:
    fecha = parse_fecha(p.get("dFechaReg"))
    if not fecha: continue
    sub_id = p.get("idSubLinea", "").strip()
    marca_id = p.get("idMarca", "").strip()
    sub_name = sub_name_by_id.get(sub_id)
    marca_name = marca_name_by_id.get(marca_id)
    if sub_name:
        key = normalize(sub_name)
        if key not in earliest_cat or fecha < earliest_cat[key]:
            earliest_cat[key] = fecha
    if marca_name:
        key = normalize(marca_name)
        if key not in earliest_brand or fecha < earliest_brand[key]:
            earliest_brand[key] = fecha

print(f"  → {len(earliest_cat)} subLineas con fecha derivada")
print(f"  → {len(earliest_brand)} marcas con fecha derivada")

# ── Fetch current Supabase ──
print("→ Descargando categories y brands de Supabase...")
cats   = fetch_all("/rest/v1/categories?select=id,name")
brands = fetch_all("/rest/v1/brands?select=id,name")
print(f"  categories={len(cats)} brands={len(brands)}")

# ── Update categories ──
print("\n→ PARTE 1: Actualizando categories.created_at")
upd, skip = 0, 0
for c in cats:
    key = normalize(c["name"])
    fecha = earliest_cat.get(key)
    if not fecha:
        skip += 1; continue
    if DRY:
        print(f"  [DRY] {c['name'][:30]:30s} → {fecha}")
    else:
        s, b = req("PATCH", f"/rest/v1/categories?id=eq.{c['id']}", {"created_at": fecha, "updated_at": fecha})
        if s in (200, 204): upd += 1
        else: print(f"  ✗ {c['name']}: {s} {b[:200]}")
print(f"  {'(dry-run) ' if DRY else ''}Updated: {upd} | sin match: {skip}")

# ── Update brands ──
print("\n→ PARTE 2: Actualizando brands.created_at")
upd, skip = 0, 0
for b_ in brands:
    key = normalize(b_["name"])
    fecha = earliest_brand.get(key)
    if not fecha:
        skip += 1; continue
    if DRY:
        print(f"  [DRY] {b_['name'][:30]:30s} → {fecha}")
    else:
        s, body = req("PATCH", f"/rest/v1/brands?id=eq.{b_['id']}", {"created_at": fecha, "updated_at": fecha})
        if s in (200, 204): upd += 1
        else: print(f"  ✗ {b_['name']}: {s} {body[:200]}")
print(f"  {'(dry-run) ' if DRY else ''}Updated: {upd} | sin match: {skip}")

print("\n✅ Listo.")

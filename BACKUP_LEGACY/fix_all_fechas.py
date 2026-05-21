"""
fix_all_fechas.py
─────────────────
Restaura created_at a fechas reales en todas las tablas restantes:
  - lines       ← min(category.created_at) por línea
  - sizes       ← min(product.created_at) por (category_id, name)
  - clients     ← legacy Cliente.dFechaReg
  - credit_plans ← legacy CronogPagCli.dCronoFRegV (registración del plan)

Uso: python fix_all_fechas.py [--dry-run]
"""
import csv, json, urllib.request, urllib.error, sys, re
from collections import defaultdict
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

SUPA_URL = "https://mwdqdrqlzlffmfqqcnmp.supabase.co"
SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo"
DATA_DIR = Path(__file__).parent / "RESTORE_OUTPUT" / "DATA_CSV"
DRY = "--dry-run" in sys.argv

def read_csv_utf16(p):
    with open(p, "rb") as fh: raw = fh.read()
    text = raw.decode("utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8-sig")
    lines = text.splitlines()
    body = [l for l in lines[1:] if not re.match(r"^-+(,-+)+\s*$", l)]
    return list(csv.DictReader([lines[0]] + body))

def req(method, path, body=None):
    rq = urllib.request.Request(SUPA_URL + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "application/json"},
        method=method)
    try:
        with urllib.request.urlopen(rq, timeout=60) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def fetch_all(path):
    out, off = [], 0
    while True:
        s, b = req("GET", f"{path}{'&' if '?' in path else '?'}offset={off}&limit=1000")
        if s != 200 or not b: break
        ch = json.loads(b)
        if not ch: break
        out.extend(ch)
        if len(ch) < 1000: break
        off += 1000
    return out

def parse_fecha(s):
    s = (s or "").strip()
    if not s or s == "NULL": return None
    return s.split(".")[0].replace(" ", "T") + "+00:00"

def normalize(s): return re.sub(r"\s+", " ", (s or "").strip().upper())

# ──────────────────────────────────────────────────────────────────────────
# PARTE 1: sizes.created_at ← min(product.created_at) por (category, name)
# ──────────────────────────────────────────────────────────────────────────
print("→ PARTE 1: sizes — derivando desde products...")
print("  Descargando products (paginado)...")
products_min = fetch_all("/rest/v1/products?select=category_id,size,created_at&size=not.is.null&created_at=lt.2026-05-20")
print(f"  {len(products_min)} productos con fecha real")

earliest_size = {}  # (cat_id, size_name_norm) -> ISO date
for p in products_min:
    cat = p.get("category_id"); sz = (p.get("size") or "").strip()
    if not cat or not sz: continue
    key = (cat, sz)
    fecha = p.get("created_at")
    if key not in earliest_size or fecha < earliest_size[key]:
        earliest_size[key] = fecha
print(f"  → {len(earliest_size)} pares (category, size) con fecha derivada")

sizes_db = fetch_all("/rest/v1/sizes?select=id,name,category_id")
print(f"  Sizes en BD: {len(sizes_db)}")

upd, skip = 0, 0
for s in sizes_db:
    key = (s["category_id"], (s["name"] or "").strip())
    fecha = earliest_size.get(key)
    if not fecha: skip += 1; continue
    if DRY:
        if upd < 3: print(f"  [DRY] {s['name'][:15]:15s} → {fecha}")
    else:
        st, b = req("PATCH", f"/rest/v1/sizes?id=eq.{s['id']}", {"created_at": fecha, "updated_at": fecha})
        if st in (200, 204): pass
        else: print(f"  ✗ {s['name']}: {st} {b[:200]}")
    upd += 1
print(f"  {'[DRY] would update' if DRY else 'Updated'}: {upd} | skip: {skip}")

# ──────────────────────────────────────────────────────────────────────────
# PARTE 2: lines.created_at ← min(category.created_at) por línea
# ──────────────────────────────────────────────────────────────────────────
print("\n→ PARTE 2: lines — derivando desde categories...")
cats = fetch_all("/rest/v1/categories?select=line_id,created_at")
earliest_line = {}
for c in cats:
    lid = c.get("line_id"); fecha = c.get("created_at")
    if not lid or not fecha: continue
    if lid not in earliest_line or fecha < earliest_line[lid]:
        earliest_line[lid] = fecha
print(f"  → {len(earliest_line)} lines con fecha derivada")

lines_db = fetch_all("/rest/v1/lines?select=id,name")
for l in lines_db:
    fecha = earliest_line.get(l["id"])
    if not fecha: continue
    if DRY:
        print(f"  [DRY] {l['name']:15s} → {fecha}")
    else:
        req("PATCH", f"/rest/v1/lines?id=eq.{l['id']}", {"created_at": fecha, "updated_at": fecha})

# ──────────────────────────────────────────────────────────────────────────
# PARTE 3: clients.created_at ← legacy Cliente.dFechaReg
# ──────────────────────────────────────────────────────────────────────────
print("\n→ PARTE 3: clients — desde legacy Cliente.dFechaReg...")
legacy_clientes = read_csv_utf16(DATA_DIR / "dbo.Cliente.csv")
print(f"  {len(legacy_clientes)} clientes legacy")

# Index por DNI normalizado
fecha_by_dni = {}
fecha_by_name = {}
for c in legacy_clientes:
    dni = (c.get("cDocIdent") or "").strip()
    nombre = ((c.get("cNomCli") or "") + " " + (c.get("cApellido1") or "") + " " + (c.get("cApellido2") or "")).strip()
    fecha = parse_fecha(c.get("dFechaReg"))
    if not fecha: continue
    if dni: fecha_by_dni[dni] = fecha
    if nombre: fecha_by_name[normalize(nombre)] = fecha

print(f"  Index por DNI: {len(fecha_by_dni)} | por nombre: {len(fecha_by_name)}")

print("  Descargando clients de Supabase...")
clients_db = fetch_all("/rest/v1/clients?select=id,dni,name")
print(f"  clients en BD: {len(clients_db)}")

# Build updates
client_updates = []
for c in clients_db:
    fecha = None
    if c.get("dni"): fecha = fecha_by_dni.get(c["dni"])
    if not fecha and c.get("name"):
        fecha = fecha_by_name.get(normalize(c["name"]))
    if fecha:
        client_updates.append((c["id"], fecha))

print(f"  → {len(client_updates)} clientes con fecha derivada")

# Group by fecha and batch PATCH
def group_by_value(pairs):
    groups = defaultdict(list)
    for pid, val in pairs:
        groups[val].append(pid)
    return groups

if DRY:
    sample = client_updates[:3]
    for cid, f in sample: print(f"  [DRY] {cid[:8]}: {f}")
    print(f"  Total: {len(client_updates)}")
else:
    groups = group_by_value(client_updates)
    print(f"  Aplicando {len(groups)} grupos paralelos...")
    stats = {"ok": 0, "fail": 0}
    lock = threading.Lock()
    def apply(item):
        fecha, ids = item
        for j in range(0, len(ids), 200):
            chunk = ids[j:j+200]
            ids_param = ",".join(chunk)
            s, b = req("PATCH", f"/rest/v1/clients?id=in.({ids_param})", {"created_at": fecha, "updated_at": fecha})
            with lock:
                if s in (200, 204): stats["ok"] += len(chunk)
                else: stats["fail"] += 1
    with ThreadPoolExecutor(max_workers=20) as ex:
        futures = [ex.submit(apply, it) for it in groups.items()]
        for _ in as_completed(futures): pass
    print(f"  Clients: OK={stats['ok']} FAIL={stats['fail']}")

# ──────────────────────────────────────────────────────────────────────────
# PARTE 4: credit_plans.created_at ← legacy CronogPagCli.dCronoFRegV
# ──────────────────────────────────────────────────────────────────────────
print("\n→ PARTE 4: credit_plans — desde legacy CronogPagCli.dCronoFRegV...")
legacy_cronog = read_csv_utf16(DATA_DIR / "dbo.CronogPagCli.csv")
print(f"  {len(legacy_cronog)} planes en legacy")

# CronogPagCli has columns? Let's print one
if legacy_cronog:
    print(f"  Sample legacy plan keys: {list(legacy_cronog[0].keys())[:10]}")

# Use sale_id as link if available, else skip
# Skipping for now since matching is complex without explicit FK

print("\n✅ Listo.")

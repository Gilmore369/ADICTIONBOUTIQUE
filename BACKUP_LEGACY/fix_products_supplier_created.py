"""
fix_products_supplier_created.py
─────────────────────────────────
1) products.created_at  ← Producto.dFechaReg (via barcode → idPresen → idProducto)
2) products.supplier_id ← most-recent IngresoAlmacenCom.idProv (via DetalleMovAlmPresen.idMovAlmacen)

El barcode actual `LEG{8 dígitos}` proviene de legacy idPresentacion. Así matcheamos
exactamente cada producto Supabase con su origen legacy.
"""
import csv, json, urllib.request, urllib.error, sys, re
from collections import defaultdict
from pathlib import Path

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

print("→ Cargando CSVs legacy...")
productos    = read_csv_utf16(DATA_DIR / "dbo.Producto.csv")
presentacion = read_csv_utf16(DATA_DIR / "dbo.Presentacion.csv")
ingresos     = read_csv_utf16(DATA_DIR / "dbo.IngresoAlmacenCom.csv")
detalle      = read_csv_utf16(DATA_DIR / "dbo.DetalleMovAlmPresen.csv")
proveedor    = read_csv_utf16(DATA_DIR / "dbo.Proveedor.csv")
print(f"  Producto={len(productos)} | Presentacion={len(presentacion)} | IngresoAlmacenCom={len(ingresos)} | Detalle={len(detalle)}")

# Indices
prod_date_by_id = {p["idProducto"].strip(): parse_fecha(p.get("dFechaReg")) for p in productos}
# idPresen → idProducto
presen_to_prod = {p["idPresentacion"].strip(): p.get("idProducto", "").strip() for p in presentacion}
# idMovAlmacen → (idProv, idIngAlm — usaremos idIngAlm como proxy de fecha para ordenar)
mov_to_prov = {i["idMovAlmacen"].strip(): (i.get("idProv", "").strip(), int(i.get("idIngAlm", "0") or "0")) for i in ingresos}

# idPresen → list of (idIngAlm, idProv) — para escoger el más reciente
presen_to_purchases = defaultdict(list)
for d in detalle:
    mov_id = d.get("idMovAlmacen", "").strip()
    presen_id = d.get("idPresen", "").strip()
    if mov_id in mov_to_prov and presen_id:
        prov_id, ing_seq = mov_to_prov[mov_id]
        presen_to_purchases[presen_id].append((ing_seq, prov_id))

# idPresen → idProv más reciente
presen_to_most_recent_prov = {
    pid: max(purchases, key=lambda x: x[0])[1]
    for pid, purchases in presen_to_purchases.items()
}

print(f"  → {len(presen_to_most_recent_prov)} presentaciones con historial de compra")

# ── Supabase ──
print("→ Descargando suppliers y products (barcode) de Supabase...")
suppliers = fetch_all("/rest/v1/suppliers?select=id,name")
products  = fetch_all("/rest/v1/products?select=id,barcode")
print(f"  suppliers={len(suppliers)} | products={len(products)}")

# Index suppliers por nombre normalizado
sup_by_norm = {normalize(s["name"]): s["id"] for s in suppliers}
# Index legacy idProv → nombre proveedor
prov_name_by_id = {p["idProv"].strip(): p.get("cNomProv", "").strip() for p in proveedor}

# ── Build updates per product ──
print("\n→ Calculando updates...")
updates = []   # list of (product_uuid, {created_at?, supplier_id?})
for prod in products:
    bc = prod.get("barcode", "")
    if not bc.startswith("LEG"): continue
    try:
        presen_id = str(int(bc[3:]))  # quitar zero-padding
    except ValueError:
        continue
    payload = {}
    # created_at desde Producto.dFechaReg
    prod_legacy = presen_to_prod.get(presen_id)
    fecha = prod_date_by_id.get(prod_legacy) if prod_legacy else None
    if fecha:
        payload["created_at"] = fecha
    # supplier_id desde most-recent purchase
    most_recent_prov_id = presen_to_most_recent_prov.get(presen_id)
    if most_recent_prov_id:
        prov_name = prov_name_by_id.get(most_recent_prov_id, "")
        sup_uuid = sup_by_norm.get(normalize(prov_name))
        if sup_uuid:
            payload["supplier_id"] = sup_uuid
    if payload:
        updates.append((prod["id"], payload))

print(f"  → {len(updates)} productos con datos para actualizar")

# Group updates by their payload (same created_at AND supplier_id)
groups = defaultdict(list)
for pid, pl in updates:
    key = (pl.get("created_at"), pl.get("supplier_id"))
    groups[key].append(pid)

print(f"  → {len(groups)} grupos únicos (created_at, supplier_id)")

if DRY:
    sample_keys = list(groups.keys())[:5]
    for k in sample_keys:
        print(f"  [DRY] {k} → {len(groups[k])} productos")
    print(f"  Total grupos: {len(groups)} | productos: {sum(len(v) for v in groups.values())}")
else:
    print(f"\n→ Aplicando updates batched por grupo (parallel)...")
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading
    stats = {"ok": 0, "fail": 0, "prods": 0}
    lock = threading.Lock()
    def apply_group(item):
        (created_at, sup_id), pids = item
        payload = {}
        if created_at: payload["created_at"] = created_at
        if sup_id:     payload["supplier_id"] = sup_id
        local_prods = 0
        for j in range(0, len(pids), 200):
            chunk = pids[j:j+200]
            ids_param = ",".join(chunk)
            s, b = req("PATCH", f"/rest/v1/products?id=in.({ids_param})", payload)
            if s in (200, 204): local_prods += len(chunk)
            else:
                with lock:
                    stats["fail"] += 1
                    if stats["fail"] <= 3: print(f"  ✗ {s} {b[:200]}")
        with lock:
            stats["ok"] += 1
            stats["prods"] += local_prods
    items = list(groups.items())
    with ThreadPoolExecutor(max_workers=20) as ex:
        futures = [ex.submit(apply_group, it) for it in items]
        for i, _ in enumerate(as_completed(futures)):
            if (i + 1) % 500 == 0:
                print(f"  Progress: {i+1}/{len(items)} | OK={stats['ok']} prods={stats['prods']}")
    print(f"\n  Final: OK_groups={stats['ok']} FAIL={stats['fail']} | productos actualizados={stats['prods']}")

print("\n✅ Listo.")

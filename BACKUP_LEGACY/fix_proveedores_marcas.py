"""
fix_proveedores_marcas.py
─────────────────────────
Arregla 2 cosas que la migración inicial dejó incorrectas:
  1) suppliers.created_at: TODOS = 2026-05-20 (fecha del INSERT migrado).
     Las traemos del legacy `Proveedor.dFechaReg`.
  2) supplier_brands: TABLA VACÍA. Inferimos los vínculos marca↔proveedor
     a partir del historial de compras del sistema antiguo:
        IngresoAlmacenCom.idProv → DetalleMovAlmPresen → Presentacion.idProducto → Producto.idMarca
        Producto.idMarca → Constante (nConsCod=1022) → nombre de marca.

Uso (Windows):
    python fix_proveedores_marcas.py [--dry-run]

Requiere solo stdlib (csv, json, urllib, datetime, codecs).
"""
import csv, json, urllib.request, urllib.error, sys, os, codecs, re
from collections import defaultdict
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────────
SUPA_URL = "https://mwdqdrqlzlffmfqqcnmp.supabase.co"
SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo"
DATA_DIR = Path(__file__).parent / "RESTORE_OUTPUT" / "DATA_CSV"
DRY_RUN = "--dry-run" in sys.argv

def read_csv_utf16(path):
    """Lee un CSV UTF-16 LE y devuelve filas como dicts."""
    with open(path, "rb") as fh:
        raw = fh.read()
    # Decodificar UTF-16 (detect BOM)
    text = raw.decode("utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8-sig")
    # SQL Server export pone "---,---,---" en la 2da línea — quitar
    lines = text.splitlines()
    header = lines[0]
    body = [l for l in lines[1:] if not re.match(r"^-+(,-+)+\s*$", l)]
    reader = csv.DictReader([header] + body)
    return list(reader)

def supa_request(method, path, body=None, headers_extra=None):
    url = SUPA_URL + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {
        "apikey": SUPA_KEY,
        "Authorization": f"Bearer {SUPA_KEY}",
        "Content-Type": "application/json",
    }
    if headers_extra:
        headers.update(headers_extra)
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def fetch_all(path):
    """GET paginado bypass cap 1000."""
    out, off = [], 0
    while True:
        s, b = supa_request("GET", f"{path}{'&' if '?' in path else '?'}offset={off}&limit=1000")
        if s != 200 or not b: break
        chunk = json.loads(b)
        if not chunk: break
        out.extend(chunk)
        if len(chunk) < 1000: break
        off += 1000
    return out

def normalize(s):
    """Lowercase + trim, sin paréntesis ni puntuación final."""
    s = (s or "").upper().strip()
    s = re.sub(r"\s+", " ", s)
    return s

# ── 1. Cargar legacy CSVs ───────────────────────────────────────────────────
print("→ Cargando legacy CSVs...")
proveedor    = read_csv_utf16(DATA_DIR / "dbo.Proveedor.csv")
constantes   = read_csv_utf16(DATA_DIR / "dbo.Constante.csv")
ingresos     = read_csv_utf16(DATA_DIR / "dbo.IngresoAlmacenCom.csv")
detalle      = read_csv_utf16(DATA_DIR / "dbo.DetalleMovAlmPresen.csv")
presentacion = read_csv_utf16(DATA_DIR / "dbo.Presentacion.csv")
producto     = read_csv_utf16(DATA_DIR / "dbo.Producto.csv")
print(f"  Proveedor={len(proveedor)} | Constante={len(constantes)} | IngresoAlmacenCom={len(ingresos)}")
print(f"  DetalleMovAlmPresen={len(detalle)} | Presentacion={len(presentacion)} | Producto={len(producto)}")

# ── 2. Index legacy ─────────────────────────────────────────────────────────
# marca id -> nombre (constantes con nConsCod=1022)
marcas_idx = {}
for c in constantes:
    if c.get("nConsCod", "").strip() == "1022":
        marcas_idx[c["nValor"].strip()] = c.get("cDesc", "").strip().upper()
print(f"  → {len(marcas_idx)} marcas catalogadas en Constante (nConsCod=1022)")

# producto id -> idMarca
prod_to_marca = {p["idProducto"].strip(): p.get("idMarca", "").strip() for p in producto}
# presen id -> idProducto
presen_to_prod = {p["idPresentacion"].strip(): p.get("idProducto", "").strip() for p in presentacion}
# idMovAlmacen -> idProv
mov_to_prov = {i["idMovAlmacen"].strip(): i.get("idProv", "").strip() for i in ingresos}

# ── 3. Inferir (idProv, idMarca) desde el historial de compras ──────────────
print("→ Inferiendo vínculos supplier↔brand desde compras...")
links_legacy = defaultdict(set)  # idProv -> set(idMarca)
for d in detalle:
    mov_id = d.get("idMovAlmacen", "").strip()
    presen_id = d.get("idPresen", "").strip()
    if mov_id not in mov_to_prov: continue
    prov_id = mov_to_prov[mov_id]
    prod_id = presen_to_prod.get(presen_id)
    if not prod_id: continue
    marca_id = prod_to_marca.get(prod_id)
    if not marca_id: continue
    links_legacy[prov_id].add(marca_id)

total_links = sum(len(v) for v in links_legacy.values())
print(f"  → {len(links_legacy)} proveedores con compras, total {total_links} pares (supplier↔brand)")

# ── 4. Fetch Supabase actual ────────────────────────────────────────────────
print("→ Descargando suppliers/brands desde Supabase...")
sup_db = fetch_all("/rest/v1/suppliers?select=id,name")
brand_db = fetch_all("/rest/v1/brands?select=id,name")
print(f"  suppliers={len(sup_db)} | brands={len(brand_db)}")
sup_by_name   = {normalize(s["name"]): s["id"] for s in sup_db}
brand_by_name = {normalize(b["name"]): b["id"] for b in brand_db}

# Index nombre→id en legacy
prov_name_by_id = {p["idProv"].strip(): p.get("cNomProv", "").strip() for p in proveedor}
# Fecha de registro
prov_date_by_name = {}
for p in proveedor:
    name = p.get("cNomProv", "").strip()
    fecha = p.get("dFechaReg", "").strip()
    if name and fecha and fecha != "NULL":
        prov_date_by_name[normalize(name)] = fecha

# ── 5. PARTE 1: Actualizar created_at de suppliers ─────────────────────────
print("\n→ PARTE 1: Actualizando created_at de suppliers...")
updated_dates = 0
skipped_dates = 0
for sup in sup_db:
    name_n = normalize(sup["name"])
    fecha = prov_date_by_name.get(name_n)
    if not fecha:
        skipped_dates += 1
        continue
    # Normalizar formato (de '2010-09-09 23:09:55.800' → '2010-09-09 23:09:55+00')
    fecha_iso = fecha.split(".")[0].replace(" ", "T") + "+00:00"
    if DRY_RUN:
        print(f"  [DRY] {sup['name'][:40]:40s} → {fecha_iso}")
    else:
        s, b = supa_request(
            "PATCH",
            f"/rest/v1/suppliers?id=eq.{sup['id']}",
            {"created_at": fecha_iso, "updated_at": fecha_iso},
        )
        if s in (200, 204):
            updated_dates += 1
        else:
            print(f"  ✗ {sup['name']}: {s} {b[:200]}")
print(f"  {'(dry-run) ' if DRY_RUN else ''}Updated: {updated_dates} | sin match: {skipped_dates}")

# ── 6. PARTE 2: Insertar supplier_brands ────────────────────────────────────
print("\n→ PARTE 2: Insertando supplier_brands desde historial...")
inserts = []
matched_pairs = 0
unmatched_sup = 0
unmatched_brand = 0
for prov_id, marca_ids in links_legacy.items():
    prov_name = prov_name_by_id.get(prov_id, "").strip()
    sup_uuid = sup_by_name.get(normalize(prov_name))
    if not sup_uuid:
        unmatched_sup += 1
        continue
    for marca_id in marca_ids:
        marca_name = marcas_idx.get(marca_id, "")
        brand_uuid = brand_by_name.get(normalize(marca_name))
        if not brand_uuid:
            unmatched_brand += 1
            continue
        inserts.append({"supplier_id": sup_uuid, "brand_id": brand_uuid})
        matched_pairs += 1

# Dedup
seen = set()
inserts_dedup = []
for r in inserts:
    k = (r["supplier_id"], r["brand_id"])
    if k in seen: continue
    seen.add(k)
    inserts_dedup.append(r)

print(f"  Pairs matched: {matched_pairs} (únicos: {len(inserts_dedup)})")
print(f"  Suppliers sin match: {unmatched_sup} | Marcas sin match: {unmatched_brand}")

if not DRY_RUN and inserts_dedup:
    # Insert in batches of 500
    print(f"→ Insertando {len(inserts_dedup)} filas en supplier_brands...")
    for i in range(0, len(inserts_dedup), 500):
        batch = inserts_dedup[i:i+500]
        s, b = supa_request(
            "POST", "/rest/v1/supplier_brands",
            batch,
            headers_extra={"Prefer": "resolution=ignore-duplicates"},
        )
        if s in (200, 201, 204):
            print(f"  ✓ batch {i//500+1}: {len(batch)} inserts")
        else:
            print(f"  ✗ batch {i//500+1}: {s} {b[:300]}")
elif DRY_RUN:
    print(f"  [DRY] would insert {len(inserts_dedup)} rows")

print("\n✅ Listo.")

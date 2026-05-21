"""
fix_tallas.py
─────────────
La tabla `sizes` está vacía tras la migración legacy.
Los productos ya tienen `size` (texto) lleno, así que generamos las tallas
desde las combinaciones únicas (category_id, size).
"""
import json, urllib.request, urllib.error, sys
from collections import defaultdict

SUPA_URL = "https://mwdqdrqlzlffmfqqcnmp.supabase.co"
SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo"
DRY = "--dry-run" in sys.argv

def req(method, path, body=None, headers_extra=None):
    url = SUPA_URL + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "application/json"}
    if headers_extra: headers.update(headers_extra)
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

print("→ Descargando productos con size...")
products = fetch_all("/rest/v1/products?select=category_id,size&size=not.is.null&active=eq.true")
print(f"  {len(products)} productos activos con size")

# Agrupar (category_id, size) únicos
pairs = set()
for p in products:
    cat = p.get("category_id")
    sz = (p.get("size") or "").strip()
    if cat and sz:
        pairs.add((cat, sz))

print(f"  → {len(pairs)} pares únicos (category_id, size)")

# Build rows for insert
rows = [{"category_id": cat, "name": sz, "active": True} for cat, sz in pairs]

if DRY:
    print(f"\n[DRY] Se insertarían {len(rows)} tallas")
    # Show top 10 categories with most sizes
    by_cat = defaultdict(set)
    for c, s in pairs: by_cat[c].add(s)
    print(f"  Top 5 categorías por #tallas:")
    for cat_id, sz_set in sorted(by_cat.items(), key=lambda x: -len(x[1]))[:5]:
        print(f"    {cat_id[:8]}... → {len(sz_set)} tallas: {sorted(sz_set)[:10]}")
else:
    print(f"\n→ Insertando {len(rows)} tallas en supabase...")
    # Batches of 500 + Prefer: ignore-duplicates por si ya hay tallas
    inserted_total = 0
    for i in range(0, len(rows), 500):
        batch = rows[i:i+500]
        s, b = req("POST", "/rest/v1/sizes", batch,
                   headers_extra={"Prefer": "resolution=ignore-duplicates,return=minimal"})
        if s in (200, 201, 204):
            inserted_total += len(batch)
            print(f"  ✓ batch {i//500+1}: {len(batch)}")
        else:
            print(f"  ✗ batch {i//500+1}: {s} {b[:300]}")
    print(f"\nTotal procesadas: {inserted_total}")

print("\n✅ Listo.")

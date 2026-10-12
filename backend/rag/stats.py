"""
Jalur statistik: LLM mengisi spesifikasi terstruktur, modul ini yang menyusun SQL.

Tidak ada SQL dari LLM yang dijalankan. Kolom dan operator dibatasi whitelist,
nilai selalu lewat bind parameter, dan nilai kategorikal dicocokkan ke nilai asli di database.

Contoh spesifikasi:
{
  "metric": "count",                       # count | avg | min | max | ratio
  "metric_column": null,                   # wajib untuk avg/min/max (kolom numerik)
  "group_by": ["klaster"],
  "filters": [
    {"column": "opd_induk", "op": "eq", "value": "DINAS PENDIDIKAN"},
    {"column": "tahun_bup", "op": "between", "value": [2026, 2028]}
  ],
  "numerator_filters": [...],              # hanya untuk ratio: kondisi pembilang
  "min_total": 20,                         # hanya untuk ratio + group_by: kelompok terkecil yang diikutkan
  "order": "metric_desc",                  # metric_desc | metric_asc | group_asc (opsional)
  "limit": 50
}

metric "ratio" menghasilkan, per kelompok:
  jumlah = banyak pegawai yang memenuhi numerator_filters
  total  = banyak pegawai di kelompok (setelah filters)
  nilai  = persentase jumlah / total
"""
import difflib
import os

from sqlalchemy import create_engine, text

VIEW = "pegawai_all"

CATEGORICAL = ["sumber", "status_kepegawaian", "jenis_kelamin", "agama", "pendidikan",
               "klaster", "pangkat", "gol", "jenis_jabatan", "eselon", "opd_induk"]
FREE_TEXT = ["nama_jabatan", "opd_unit"]
NUMERIC = ["usia", "tahun_bup", "masa_kerja"]
FILTERABLE = CATEGORICAL + FREE_TEXT + NUMERIC
GROUPABLE = CATEGORICAL + ["nama_jabatan"] + NUMERIC

METRICS = {"count", "avg", "min", "max", "ratio"}
OPS_TEXT = {"eq", "in", "contains"}
OPS_NUM = {"eq", "in", "gte", "lte", "between"}
ORDERS = {"metric_desc", "metric_asc", "group_asc"}
MAX_LIMIT = 200
DEFAULT_LIMIT = 50
DEFAULT_MIN_TOTAL = 20
UNKNOWN = "(tidak diketahui)"

# Nama kolom -> istilah yang ramah pengguna (dipakai di deskripsi hasil, yang juga tampil sebagai sumber)
LABEL = {
    "sumber": "jenis kepegawaian",
    "status_kepegawaian": "status kepegawaian",
    "jenis_kelamin": "jenis kelamin",
    "agama": "agama",
    "pendidikan": "pendidikan",
    "klaster": "klaster jabatan",
    "pangkat": "pangkat",
    "gol": "golongan",
    "jenis_jabatan": "jenis jabatan",
    "eselon": "eselon",
    "opd_induk": "perangkat daerah (OPD)",
    "nama_jabatan": "nama jabatan",
    "opd_unit": "unit kerja",
    "usia": "usia",
    "tahun_bup": "tahun pensiun",
    "masa_kerja": "masa kerja",
}


class StatsError(ValueError):
    """Spesifikasi tidak valid. Pesannya cukup jelas untuk dikirim balik ke LLM agar memperbaiki."""


_engine = None
_catalog: dict[str, dict[str, str]] | None = None  # kolom -> {casefold: nilai asli}


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
    return _engine


def load_catalog(engine=None, force: bool = False) -> dict[str, dict[str, str]]:
    global _catalog
    if _catalog is not None and not force:
        return _catalog
    engine = engine or get_engine()
    cat = {}
    with engine.connect() as con:
        for col in CATEGORICAL:
            rows = con.execute(text(
                f"select {col}, count(*) from {VIEW} where {col} is not null group by {col} order by 2")).all()
            # urut naik menurut jumlah: bila ada varian huruf, yang paling sering muncul menang
            cat[col] = {str(r[0]).casefold(): str(r[0]) for r in rows}
    _catalog = cat
    return cat


def catalog_values(col: str) -> list[str]:
    """Daftar nilai asli sebuah kolom (untuk dimasukkan ke prompt LLM)."""
    return sorted(load_catalog()[col].values())


def _simplify(s: str) -> str:
    return "".join(ch for ch in s.casefold() if ch.isalnum())


def _resolve(col: str, val, cat) -> str:
    known = cat[col]
    s = str(val).strip()
    if s.casefold() in known:
        return known[s.casefold()]
    simple = {_simplify(k): v for k, v in known.items()}
    if _simplify(s) in simple:  # mis. "S1" -> "S-1"
        return simple[_simplify(s)]
    hints = [v for k, v in known.items() if s.casefold() in k][:5]
    hints += [v for v in difflib.get_close_matches(s, list(known.values()), n=5, cutoff=0.5)
              if v not in hints]
    msg = f"Nilai '{val}' tidak ada untuk kolom {col}."
    if hints:
        msg += f" Mungkin maksudnya: {'; '.join(hints[:6])}."
    elif len(known) <= 15:
        msg += f" Nilai yang tersedia: {'; '.join(sorted(known.values()))}."
    raise StatsError(msg)


def _as_list(v):
    return list(v) if isinstance(v, (list, tuple)) else [v]


def _num(v, col):
    try:
        return int(v)
    except (TypeError, ValueError):
        raise StatsError(f"Nilai untuk kolom {col} harus angka, bukan '{v}'.")


def _limit(spec: dict) -> int:
    try:
        n = int(spec.get("limit") or DEFAULT_LIMIT)
    except (TypeError, ValueError):
        raise StatsError("limit harus berupa angka.")
    return max(1, min(n, MAX_LIMIT))


def _build_filters(filters, cat: dict, prefix: str) -> tuple[list[str], dict, list[str]]:
    """Ubah daftar filter menjadi (klausa where, bind parameter, deskripsi)."""
    if filters is None:
        filters = []
    if not isinstance(filters, list):
        raise StatsError("filters harus berupa daftar objek.")
    where, params, desc = [], {}, []
    for i, f in enumerate(filters):
        if not isinstance(f, dict):
            raise StatsError("Setiap filter harus berupa objek {column, op, value}.")
        col, op, val = f.get("column"), f.get("op", "eq"), f.get("value")
        if col not in FILTERABLE:
            raise StatsError(f"Kolom filter '{col}' tidak diizinkan. Pilihan: {FILTERABLE}.")
        label = LABEL.get(col, col)
        p = f"{prefix}{i}"
        if col in NUMERIC:
            if op not in OPS_NUM:
                raise StatsError(f"Operator untuk {col} harus salah satu dari {sorted(OPS_NUM)}.")
            if op == "between":
                if not (isinstance(val, (list, tuple)) and len(val) == 2):
                    raise StatsError(f"between untuk {col} butuh [awal, akhir].")
                lo, hi = _num(val[0], col), _num(val[1], col)
                where.append(f"{col} between :{p}a and :{p}b")
                params[f"{p}a"], params[f"{p}b"] = lo, hi
                desc.append(f"{label} antara {lo} dan {hi}")
            elif op == "in":
                vals = [_num(v, col) for v in _as_list(val)]
                names = [f"{p}_{k}" for k in range(len(vals))]
                where.append(f"{col} in ({', '.join(':' + n for n in names)})")
                params.update(dict(zip(names, vals)))
                desc.append(f"{label} salah satu dari {vals}")
            else:
                sym = {"eq": "=", "gte": ">=", "lte": "<="}[op]
                where.append(f"{col} {sym} :{p}")
                params[p] = _num(val, col)
                desc.append(f"{label} {sym} {val}")
        elif col in FREE_TEXT:
            if op not in {"eq", "contains"}:
                raise StatsError(f"Operator untuk {col} harus eq atau contains.")
            term = str(val).strip().casefold().replace("%", "").replace("_", " ")
            if not term:
                raise StatsError(f"Nilai filter untuk {col} kosong.")
            if op == "eq":
                where.append(f"lower({col}) = :{p}")
                params[p] = term
                desc.append(f"{label} = {val}")
            else:
                where.append(f"lower({col}) like :{p}")
                params[p] = f"%{term}%"
                desc.append(f"{label} mengandung '{val}'")
        else:
            if op not in OPS_TEXT - {"contains"}:
                raise StatsError(f"Operator untuk {col} harus eq atau in.")
            vals = [_resolve(col, v, cat) for v in _as_list(val)]
            if len(vals) == 1:
                where.append(f"{col} = :{p}")
                params[p] = vals[0]
            else:
                names = [f"{p}_{k}" for k in range(len(vals))]
                where.append(f"{col} in ({', '.join(':' + n for n in names)})")
                params.update(dict(zip(names, vals)))
            desc.append(f"{label} = {' / '.join(vals)}")
    return where, params, desc


def build_query(spec: dict, cat: dict) -> dict:
    """Validasi spesifikasi, kembalikan dict berisi SQL, parameter, deskripsi, dan metadata."""
    if not isinstance(spec, dict):
        raise StatsError("Spesifikasi harus berupa objek JSON.")
    metric = spec.get("metric", "count")
    if metric not in METRICS:
        raise StatsError(f"metric harus salah satu dari {sorted(METRICS)}.")

    group_by = _as_list(spec.get("group_by") or [])
    if len(group_by) > 3:
        raise StatsError("group_by maksimal 3 kolom.")
    for g in group_by:
        if g not in GROUPABLE:
            raise StatsError(f"Kolom group_by '{g}' tidak diizinkan. Pilihan: {GROUPABLE}.")

    filters = spec.get("filters")
    where, params, filt_desc = _build_filters(filters, cat, "p")
    base_params = dict(params)  # parameter tanpa pembilang, untuk kueri total
    limit = _limit(spec)
    having = ""

    if metric == "count":
        select_metric = "count(*) as nilai"
        metric_desc = "Jumlah pegawai"
        used = group_by + [f.get("column") for f in (filters or []) if isinstance(f, dict)]
        if "tahun_bup" in used:
            metric_desc = "Jumlah pegawai yang mencapai batas usia pensiun"
    elif metric == "ratio":
        num_filters = spec.get("numerator_filters")
        if not num_filters:
            raise StatsError("metric ratio butuh numerator_filters (kondisi untuk pembilang).")
        nwhere, nparams, ndesc = _build_filters(num_filters, cat, "n")
        params.update(nparams)
        num = f"sum(case when {' and '.join(nwhere)} then 1 else 0 end)"
        select_metric = (f"coalesce({num}, 0) as jumlah, count(*) as total, "
                         f"100.0 * coalesce({num}, 0) / nullif(count(*), 0) as nilai")
        metric_desc = ("Persentase pegawai dengan " + "; ".join(ndesc)
                       + " terhadap seluruh pegawai pada tiap kelompok")
        if group_by:
            try:
                min_total = int(spec.get("min_total") or DEFAULT_MIN_TOTAL)
            except (TypeError, ValueError):
                raise StatsError("min_total harus berupa angka.")
            min_total = max(1, min_total)
            if min_total > 1:
                having = f" having count(*) >= {min_total}"
                metric_desc += f" (hanya kelompok dengan minimal {min_total} pegawai)"
    else:
        mcol = spec.get("metric_column")
        if mcol not in NUMERIC:
            raise StatsError(f"metric {metric} butuh metric_column numerik: {NUMERIC}.")
        select_metric = f"{metric}({mcol}) as nilai"
        metric_desc = ({"avg": "Rata-rata", "min": "Nilai terkecil", "max": "Nilai terbesar"}[metric]
                       + f" {LABEL.get(mcol, mcol)}")

    order = spec.get("order") or ("group_asc" if group_by and all(g in NUMERIC for g in group_by)
                                  else "metric_desc")
    if order not in ORDERS:
        raise StatsError("order harus metric_desc, metric_asc, atau group_asc.")

    where_sql = (" where " + " and ".join(where)) if where else ""
    sql = f"select {', '.join(group_by + [select_metric])} from {VIEW}{where_sql}"
    group_sql = ""
    if group_by:
        gb = ", ".join(group_by)
        group_sql = f" group by {gb}{having}"
        if order == "group_asc":
            order_sql = f" order by {gb}"
        else:
            order_sql = f" order by nilai {'desc' if order == 'metric_desc' else 'asc'}, {gb}"
        # ambil satu baris lebih banyak agar terpotong tidaknya hasil bisa dipastikan
        sql += group_sql + order_sql + f" limit {limit + 1}"
    else:
        order = None

    desc = metric_desc
    if group_by:
        desc += ", dikelompokkan menurut " + ", ".join(LABEL.get(g, g) for g in group_by)
    if filt_desc:
        desc += ", dengan filter: " + "; ".join(filt_desc)

    return {
        "sql": sql, "params": params, "base_params": base_params, "desc": desc,
        "limit": limit, "order": order, "metric": metric, "group_by": group_by,
        "grand_sql": f"select count(*) from {VIEW}{where_sql}",
        "groups_sql": f"select count(*) from (select 1 from {VIEW}{where_sql}{group_sql}) t",
    }


def run_query(spec: dict, engine=None) -> dict:
    engine = engine or get_engine()
    cat = load_catalog(engine)
    q = build_query(spec, cat)
    group_by, limit = q["group_by"], q["limit"]

    with engine.connect() as con:
        res = con.execute(text(q["sql"]), q["params"])
        cols = list(res.keys())
        raw = res.all()
        truncated = bool(group_by) and len(raw) > limit
        if group_by:
            raw = raw[:limit]

        rows = []
        for r in raw:
            row = {}
            for c, v in zip(cols, r):
                if v is None:
                    v = UNKNOWN
                elif c in ("jumlah", "total"):
                    v = int(v)
                elif c == "nilai" and not isinstance(v, int):
                    v = round(float(v), 2)
                row[c] = v
            rows.append(row)

        total = total_groups = None
        if q["metric"] == "count" and group_by:
            if truncated:  # total sebenarnya, bukan hanya baris yang tampil
                total = int(con.execute(text(q["grand_sql"]), q["base_params"]).scalar() or 0)
            else:
                total = sum(r["nilai"] for r in rows)  # backend yang menjumlahkan, bukan LLM
        if truncated:
            total_groups = int(con.execute(text(q["groups_sql"]), q["base_params"]).scalar() or 0)

    return {"description": q["desc"], "sql": q["sql"], "params": q["params"], "columns": cols,
            "rows": rows, "truncated": truncated, "total": total, "total_groups": total_groups,
            "order": q["order"], "limit": limit, "metric": q["metric"], "group_by": group_by}

-- Tabel gabungan PNS + PPPK full + PPPK PW (data Agustus 2026)
create table if not exists pegawai (
  id                bigserial primary key,
  sumber            text not null check (sumber in ('pns','pppk_full','pppk_pw')),
  src_id            integer,              -- id asli di tabel sumber
  status_kepegawaian text not null,       -- PNS / PPPK / PPPK PW
  tmt_cp            text,                 -- format yyyymm, disimpan teks
  jenis_kelamin     char(1),              -- L / P
  usia              smallint,
  usia_detail       text,                 -- contoh: '32 thn; 6 bln'
  tmt_bup           date,
  tmt_bup_invalid   boolean not null default false,
  agama             text,
  pendidikan        text,
  klaster           text,
  pangkat           text,                 -- hanya PNS
  gol               text,                 -- PNS: I-IV, PPPK: romawi I-XI (skala beda)
  jenis_jabatan     text,
  eselon            text,                 -- hanya PNS
  nama_jabatan      text,
  opd               text,                 -- string asli
  opd_induk         text,                 -- bagian sebelum ' - ' pertama
  opd_unit          text,                 -- sisanya (bidang/UPT/sekolah), bisa null
  masa_kerja        smallint              -- hanya PNS
);

create index if not exists pegawai_sumber_idx     on pegawai (sumber);
create index if not exists pegawai_opd_induk_idx  on pegawai (opd_induk);
create index if not exists pegawai_klaster_idx    on pegawai (klaster);
create index if not exists pegawai_tmt_bup_idx    on pegawai (tmt_bup);

-- View untuk jalur text-to-SQL (nanti diberi akses read-only).
-- Semua baris tetap dihitung sebagai pegawai; tanggal BUP yang tidak valid dikosongkan.
create or replace view pegawai_all as
select sumber, status_kepegawaian, jenis_kelamin, usia,
       case when tmt_bup_invalid then null else tmt_bup end as tmt_bup,
       case when tmt_bup_invalid then null else extract(year from tmt_bup)::int end as tahun_bup,
       agama, pendidikan, klaster, pangkat, gol, jenis_jabatan, eselon,
       nama_jabatan, opd_induk, opd_unit, masa_kerja
from pegawai;

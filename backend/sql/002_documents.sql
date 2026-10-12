-- Penyimpanan vektor untuk RAG (Gemini gemini-embedding-001 dipotong ke 768 dimensi)
create extension if not exists vector;

create table if not exists documents (
  id            bigserial primary key,
  key           text not null unique,        -- id stabil dokumen, mis. 'ringkasan_opd:pns:DINAS KESEHATAN'
  content       text not null,
  content_hash  text not null,               -- untuk melewati dokumen yang tidak berubah saat embed ulang
  metadata      jsonb not null default '{}', -- type, sumber, opd_induk, ... (dipakai untuk filter)
  embedding     vector(768) not null
);

create index if not exists documents_embedding_idx on documents using hnsw (embedding vector_cosine_ops);
create index if not exists documents_metadata_idx  on documents using gin (metadata jsonb_path_ops);

-- Pencarian: kembalikan dokumen terdekat, opsional difilter metadata, mis. filter = '{"sumber":"pns"}'
create or replace function match_documents(
  query_embedding vector(768),
  match_count int default 6,
  filter jsonb default '{}'
) returns table (id bigint, key text, content text, metadata jsonb, similarity float)
language sql stable as $$
  select d.id, d.key, d.content, d.metadata,
         1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where d.metadata @> filter
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

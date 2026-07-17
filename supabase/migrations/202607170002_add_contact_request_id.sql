alter table public.contact_submissions
add column if not exists request_id uuid not null default gen_random_uuid();

create unique index if not exists contact_submissions_request_id_idx
on public.contact_submissions (request_id);

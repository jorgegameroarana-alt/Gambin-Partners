grant select on table public.contact_submissions to authenticated;
grant update (estado) on table public.contact_submissions to authenticated;

drop policy if exists "Authorized admin can view contact requests" on public.contact_submissions;
create policy "Authorized admin can view contact requests"
on public.contact_submissions
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'jorge.gamero.arana@gmail.com'
);

drop policy if exists "Authorized admin can update contact status" on public.contact_submissions;
create policy "Authorized admin can update contact status"
on public.contact_submissions
for update
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'jorge.gamero.arana@gmail.com'
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'jorge.gamero.arana@gmail.com'
);

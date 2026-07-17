# Configuración de Supabase

1. Abrir el proyecto en Supabase.
2. Ir a **SQL Editor** y crear una consulta nueva.
3. Copiar y ejecutar `migrations/202607170001_create_contact_submissions.sql`.
4. Verificar en **Table Editor** que exista `contact_submissions`.

La política RLS permite a visitantes insertar consultas, pero no leer, editar ni eliminar registros.

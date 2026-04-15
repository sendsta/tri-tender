import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminShell } from '@/components/admin-shell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  const adminRoles = ['platform_admin', 'admin', 'operator']
  if (!profile || !adminRoles.includes(profile.role)) {
    redirect('/dashboard')
  }

  return (
    <AdminShell
      user={{
        email: profile.email ?? user.email ?? '',
        displayName: profile.full_name ?? user.email ?? 'Admin',
        role: profile.role,
      }}
    >
      {children}
    </AdminShell>
  )
}

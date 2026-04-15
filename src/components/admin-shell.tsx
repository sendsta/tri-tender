'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Users,
  Building2,
  FileText,
  Cpu,
  LayoutDashboard,
  LogOut,
  ChevronRight,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const adminNavItems = [
  { href: '/admin/leads', label: 'Leads', icon: Users },
  { href: '/admin/clients', label: 'Clients', icon: Building2 },
  { href: '/admin/tenders', label: 'All Tenders', icon: FileText },
  { href: '/admin/jobs', label: 'Job Queue', icon: Cpu },
]

export function AdminShell({
  user,
  children,
}: {
  user: { email: string; displayName: string; role: string }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const initials = user.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-zinc-950 text-zinc-100 md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-zinc-800 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500">
            <Shield className="h-4 w-4 text-zinc-950" />
          </div>
          <span className="font-semibold tracking-tight">Tri-Tender Admin</span>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
          <div className="px-4">
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
              {user.role}
            </Badge>
          </div>

          <nav className="flex flex-col gap-1 px-3">
            {adminNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <Separator className="bg-zinc-800" />

          <nav className="flex flex-col gap-1 px-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            >
              <LayoutDashboard className="h-4 w-4" />
              Client Portal
            </Link>
          </nav>
        </div>

        <Separator className="bg-zinc-800" />
        <div className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-zinc-800 transition-colors">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs bg-amber-500/20 text-amber-400">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm text-zinc-300">{user.displayName}</span>
              <ChevronRight className="ml-auto h-4 w-4 text-zinc-600" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm">
                <p className="font-medium">{user.displayName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-muted/40 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  Package, 
  CreditCard, 
  FileText,
  Settings,
  LogOut,
  Menu
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['all'] },
  { name: 'Projects', href: '/projects', icon: FolderKanban, roles: ['all'] },
  { name: 'Customers', href: '/customers', icon: Users, roles: ['sales', 'finance', 'admin'] },
  { name: 'Vendors', href: '/vendors', icon: Package, roles: ['project_manager', 'finance', 'admin'] },
  { name: 'Payments', href: '/payments', icon: CreditCard, roles: ['finance', 'admin'] },
  { name: 'Reports', href: '/reports', icon: FileText, roles: ['finance', 'admin'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const filteredNav = navigation.filter(item => 
    item.roles.includes('all') || 
    (session?.user?.role && item.roles.includes(session.user.role))
  );

  const NavLinks = () => (
    <>
      {filteredNav.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
            <span className="font-bold text-lg">KG Interiors</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-1">
            <NavLinks />
          </nav>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-2">
          {session?.user && (
            <>
              <span className="text-xs text-muted-foreground capitalize hidden md:inline">
                {session.user.role?.replace('_', ' ')}
              </span>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.user.image} alt={session.user.name || ''} />
                      <AvatarFallback>{session.user.name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{session.user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session.user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {session.user.role === 'admin' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/settings" className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600"
                    onSelect={() => signOut({ callbackUrl: '/' })}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="flex flex-col space-y-3 mt-4">
                <NavLinks />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

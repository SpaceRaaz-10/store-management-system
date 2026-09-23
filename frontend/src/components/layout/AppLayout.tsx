import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Store, LayoutDashboard, Tags, Package, Users, Truck, ShoppingCart, LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/purchases', label: 'Purchases', icon: ShoppingCart },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="h-4 w-4" />
            </div>
            <span className="font-semibold">Store Management</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user?.name}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r bg-white md:block min-h-[calc(100vh-3.5rem)]">
          <nav className="space-y-1 p-3">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Tags, Package, Users, Truck, ShoppingCart, Boxes,
  Receipt, RotateCcw, XCircle, FileBarChart2, Settings as SettingsIcon,
  ShieldCheck, Coins, LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const nav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/sales', label: 'Sales', icon: Receipt },
  { to: '/returns', label: 'Returns', icon: RotateCcw },
  { to: '/voids', label: 'Voids', icon: XCircle },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/purchases', label: 'Purchases', icon: ShoppingCart },
  { to: '/reports', label: 'Reports', icon: FileBarChart2 },
  { to: '/currencies', label: 'Currencies', icon: Coins, adminOnly: true },
  { to: '/users', label: 'Users', icon: ShieldCheck, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, adminOnly: true },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const visibleNav = nav.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="flex h-14 items-center justify-between px-6">
          <Logo size={32} />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user?.name}
              {isAdmin && <span className="ml-1 text-[10px] uppercase tracking-wide text-primary">Admin</span>}
              {!isAdmin && <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">Staff</span>}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r bg-white md:block min-h-[calc(100vh-3.5rem)]">
          <nav className="space-y-1 p-3">
            {visibleNav.map(({ to, label, icon: Icon }) => (
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
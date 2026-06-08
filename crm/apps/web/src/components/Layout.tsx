import {
  Building2,
  CheckSquare,
  Gauge,
  ChartNoAxesCombined,
  LogOut,
  Menu,
  Package,
  Settings,
  Target,
  UserRoundSearch,
  Users,
  X
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { GlobalSearch } from "./GlobalSearch";

const navigation = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/leads", label: "Leads", icon: UserRoundSearch },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/pipeline", label: "Pipeline", icon: Target },
  { to: "/products", label: "Products & quotes", icon: Package },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/reports", label: "Reports", icon: ChartNoAxesCombined },
  { to: "/settings", label: "Settings", icon: Settings }
];

export function Layout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="app-shell">
      <button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
        <Menu size={20} />
      </button>
      {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">N</span>
          <span>
            <strong>Northstar</strong>
            <small>CRM</small>
          </span>
          <button className="mobile-close icon-button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <nav>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
          <div>
            <strong>{user?.firstName} {user?.lastName}</strong>
            <small>{user?.role.toLowerCase()}</small>
          </div>
          <button className="icon-button" onClick={logout} aria-label="Sign out" title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="global-bar">
          <GlobalSearch />
          <div className="global-context">
            <span>{user?.organization?.name || "CRM workspace"}</span>
            <b>{user?.role.toLowerCase()}</b>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

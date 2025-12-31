
import React, { useState, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import AdminUsers from './components/AdminUsers';
import AdminEditUser from './components/AdminEditUser';
import AdminRegions from './components/AdminRegions';
import AdminRegionActivity from './components/AdminRegionActivity';
import AdminRegionSettings from './components/AdminRegionSettings';
import AdminAddUser from './components/AdminAddUser';
import AdminAddRegion from './components/AdminAddRegion';
import AdminAddBranch from './components/AdminAddBranch';
import AdminEditBranch from './components/AdminEditBranch';
import AdminProducts from './components/AdminProducts';
import AdminEditProduct from './components/AdminEditProduct';
import AdminReports from './components/AdminReports';
import AdminReportGenerator from './components/AdminReportGenerator';
import AdminDiscountMonitoring from './components/AdminDiscountMonitoring';
import AdminLedgers from './components/AdminLedgers';
import KPODashboard from './components/KPODashboard';
import KPOReportGenerator from './components/KPOReportGenerator';
import KPOBookings from './components/KPOBookings';
import KPOLedgers from './components/KPOLedgers';
import KPOUserManagement from './components/KPOUserManagement';
import KPOEditRequests from './components/KPOEditRequests';
import KPOShops from './components/KPOShops';
import KPOTargets from './components/KPOTargets';
import KPOLocationTracking from './components/KPOLocationTracking';
import KPOReturns from './components/KPOReturns';
import { ADMIN_MENU, KPO_MENU } from './constants';
import { User, View } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('LOGIN');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogin = (loggedInUser: User) => {
    // Normalize role to handle case sensitivity - preserve KPO and Admin as uppercase
    let normalizedRole: User['role'];
    if (typeof loggedInUser.role === 'string') {
      const roleLower = loggedInUser.role.toLowerCase();
      if (roleLower === 'kpo') {
        normalizedRole = 'KPO';
      } else if (roleLower === 'admin') {
        normalizedRole = 'Admin';
      } else if (roleLower === 'booker') {
        normalizedRole = 'Booker';
      } else if (roleLower === 'salesman') {
        normalizedRole = 'Salesman';
      } else {
        // Fallback: capitalize first letter
        normalizedRole = (loggedInUser.role.charAt(0).toUpperCase() + loggedInUser.role.slice(1).toLowerCase()) as User['role'];
      }
    } else {
      normalizedRole = loggedInUser.role;
    }
    
    // Update user with normalized role
    const userWithNormalizedRole = { ...loggedInUser, role: normalizedRole };
    setUser(userWithNormalizedRole);
    
    if (normalizedRole === 'Admin') {
      setCurrentView('ADMIN_DASHBOARD');
    } else if (normalizedRole === 'KPO') {
      setCurrentView('KPO_DASHBOARD');
    } else {
      // For other roles (Booker, Salesman), show access denied or appropriate view
      setCurrentView('ACCESS_DENIED');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('LOGIN');
    setSelectedId(null);
  };

  const handleNavigation = (view: View, id?: string) => {
    // Normalize role for comparison
    const userRole = user?.role ? (typeof user.role === 'string' ? user.role.toLowerCase() : user.role) : '';
    
    if (userRole === 'kpo' && view.startsWith('ADMIN')) {
      alert("Access Denied: You do not have permission to view this page.");
      return;
    }
    if (id !== undefined) setSelectedId(id);
    setCurrentView(view);
  };

  const menuItems = useMemo(() => {
    if (!user) return [];
    // Normalize role for comparison
    const userRole = user.role ? (typeof user.role === 'string' ? user.role.toLowerCase() : user.role) : '';
    return userRole === 'admin' ? ADMIN_MENU : KPO_MENU;
  }, [user]);

  if (!user || currentView === 'LOGIN') {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden relative">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] animate-pulse"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/5 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 flex h-full w-full">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}
        
        <Sidebar 
            user={user} 
            menuItems={menuItems} 
            currentView={currentView}
            onNavigate={(view) => {
              handleNavigation(view);
              setSidebarOpen(false); // Close sidebar on mobile after navigation
            }}
            onLogout={handleLogout}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
        />
        
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
            <Header 
              user={user} 
              onNavigate={handleNavigation}
              onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            />
            
            <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-8 scroll-smooth no-scrollbar">
            {currentView === 'ADMIN_DASHBOARD' && <AdminDashboard />}
            
            {currentView === 'ADMIN_REGIONS' && <AdminRegions onNavigate={handleNavigation} />}
            {currentView === 'ADMIN_ADD_REGION' && <AdminAddRegion onNavigate={handleNavigation} />}
            {currentView === 'ADMIN_ADD_BRANCH' && <AdminAddBranch onNavigate={handleNavigation} regionId={selectedId} />}
            {currentView === 'ADMIN_EDIT_BRANCH' && <AdminEditBranch onNavigate={handleNavigation} branchId={selectedId} regionId={null} />}
            {currentView === 'ADMIN_REGION_ACTIVITY' && <AdminRegionActivity regionName={selectedId || ''} onNavigate={handleNavigation} />}
            {currentView === 'ADMIN_REGION_SETTINGS' && <AdminRegionSettings regionName={selectedId || ''} onNavigate={handleNavigation} />}

            {currentView === 'ADMIN_USERS' && <AdminUsers onNavigate={handleNavigation} />}
            {currentView === 'ADMIN_ADD_USER' && <AdminAddUser onNavigate={handleNavigation} />}
            {currentView === 'ADMIN_EDIT_USER' && <AdminEditUser userId={selectedId} onNavigate={handleNavigation} />}

            {currentView === 'ADMIN_PRODUCTS' && <AdminProducts onNavigate={handleNavigation} />}
            {currentView === 'ADMIN_EDIT_PRODUCT' && <AdminEditProduct productId={selectedId} onNavigate={handleNavigation} />}
            {currentView === 'ADMIN_REPORTS' && <AdminReports />}
            {currentView === 'ADMIN_REPORT_GENERATOR' && <AdminReportGenerator onNavigate={handleNavigation} />}
            {currentView === 'ADMIN_DISCOUNT_MONITORING' && <AdminDiscountMonitoring />}
            {currentView === 'ADMIN_LEDGERS' && <AdminLedgers />}
            
            {currentView === 'ADMIN_ACCOUNTS' && (
                <div className="glass-panel p-10 rounded-2xl flex h-full items-center justify-center text-slate-400">Accounts Module (Coming Soon)</div>
            )}

            {currentView === 'KPO_DASHBOARD' && <KPODashboard user={user} />}
            {currentView === 'KPO_BOOKINGS' && <KPOBookings user={user} />}
            {currentView === 'KPO_EDIT_REQUESTS' && <KPOEditRequests user={user} />}
            {currentView === 'KPO_LEDGERS' && <KPOLedgers user={user} />}
            {currentView === 'KPO_USER_MANAGEMENT' && <KPOUserManagement user={user} />}
            {currentView === 'KPO_SHOPS' && <KPOShops user={user} />}
            {currentView === 'KPO_TARGETS' && <KPOTargets user={user} />}
            {currentView === 'KPO_LOCATION_TRACKING' && <KPOLocationTracking user={user} />}
            {currentView === 'KPO_RETURNS' && <KPOReturns user={user} />}
            {currentView === 'KPO_REPORT_GENERATOR' && <KPOReportGenerator user={user} onNavigate={handleNavigation} />}
            
            {currentView === 'ACCESS_DENIED' && (
                <div className="glass-panel p-10 rounded-2xl flex flex-col h-full items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-6xl mb-4 text-red-500">block</span>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
                    <p className="text-slate-500">You do not have permission to access this dashboard.</p>
                    <p className="text-sm text-slate-400 mt-2">Please contact your administrator.</p>
                </div>
            )}
            
            <div className="flex items-center justify-center py-6 text-sm text-slate-400 mt-auto">
                <p>© 2023 Pak Asian Foods. All rights reserved.</p>
            </div>
            </div>
        </main>
      </div>
    </div>
  );
};

export default App;

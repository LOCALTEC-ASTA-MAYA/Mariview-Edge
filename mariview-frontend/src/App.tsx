import { useState } from 'react';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import Logo from './components/Logo';
import StorageIndicator from './components/StorageIndicator';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import NewFlight from './components/NewFlight';
import LiveOperations from './components/LiveOperationsNew';
import AssetManagement from './components/AssetManagement';
import MissionHistory from './components/MissionHistory';
import SettingsView from './components/SettingsView';
import ActivityLog from './components/ActivityLog';
import WeatherForecasting from './components/WeatherForecasting';
import AdsbStream from './components/AdsbStream';
import AisStream from './components/AisStream';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip';
import { Home, PlusCircle, Package, History, Settings, Menu, ChevronLeft, ChevronRight, FileText, CloudSun, Radio, Ship, LogOut, Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

function AppContent() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { colors } = useTheme();
  const { user, isAuthenticated, loading, logout } = useAuth();

  // Loading state — checking session
  if (loading) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-[#0a0e1a]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#21A68D]" />
          <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold">Initializing Command Center...</p>
        </div>
      </div>
    );
  }

  // Auth gate — show login when not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Derive user display values
  const displayName = user?.name || user?.username || 'Operator';
  const displayInitials = displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const displayRole = user?.roles?.[0] || 'OPERATOR';

  const navSections = [
    {
      title: 'MAIN',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'new-flight', label: 'Mission', icon: PlusCircle },
        { id: 'assets', label: 'Asset Management', icon: Package },
        { id: 'history', label: 'Mission History', icon: History },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'activity-log', label: 'Activity Log', icon: FileText },
      ]
    },
    {
      title: 'DATA',
      items: [
        { id: 'weather', label: 'Weather Info', icon: CloudSun },
        { id: 'adsb', label: 'ADS-B Stream', icon: Radio },
        { id: 'ais', label: 'AIS Stream', icon: Ship },
      ]
    }
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard />;
      case 'new-flight':
        return <NewFlight onMissionLaunch={(missionId?: string) => {
          if (missionId) setActiveMissionId(missionId);
          setActiveSection('live-ops');
        }} />;
      case 'live-ops':
        return <LiveOperations missionId={activeMissionId} onEndFlightComplete={() => {
          console.log('✅ onEndFlightComplete called in App.tsx!');
          setActiveMissionId(null);
          setActiveSection('history');
        }} />;
      case 'assets':
        return <AssetManagement />;
      case 'history':
        return <MissionHistory onNavigateToLive={(missionId: string) => {
          setActiveMissionId(missionId);
          setActiveSection('live-ops');
        }} />;
      case 'settings':
        return <SettingsView />;
      case 'activity-log':
        return <ActivityLog />;
      case 'weather':
        return <WeatherForecasting />;
      case 'adsb':
        return <AdsbStream />;
      case 'ais':
        return <AisStream />;
      default:
        return <Dashboard />;
    }
  };

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="dark min-h-screen flex bg-background">
        {/* Mobile Header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-sm text-muted-foreground uppercase tracking-widest font-black">{displayName}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-[#21A68D] flex items-center justify-center border border-white/10">
                <span className="text-white font-black text-[10px]">{displayInitials}</span>
              </div>
            </div>
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground">
                  <Menu className="w-6 h-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
                <div className="flex flex-col h-full">
                  <div className="p-6 border-b border-sidebar-border">
                    <Logo size="md" />
                    <p className="text-[10px] text-muted-foreground mt-2 uppercase font-black tracking-widest text-center">Command Center</p>
                  </div>
                  <nav className="flex-1 p-4 overflow-y-auto">
                    <div className="space-y-6">
                      {navSections.map((section, index) => (
                        <div key={index}>
                          {section.title && (
                            <h3 className="text-[10px] font-black text-muted-foreground mb-3 px-4 tracking-[0.2em]">{section.title}</h3>
                          )}
                          <ul className="space-y-1">
                            {section.items.map((item) => {
                              const Icon = item.icon;
                              const isActive = activeSection === item.id;
                              return (
                                <li key={item.id}>
                                  <button
                                    onClick={() => handleNavClick(item.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                                      ? 'bg-[#21A68D] text-white shadow-lg shadow-[#21A68D]/20'
                                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                                      }`}
                                  >
                                    <Icon className="w-5 h-5 flex-shrink-0" />
                                    <span className="font-bold text-sm tracking-tight">{item.label}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Desktop Sidebar */}
        <div
          className={`hidden lg:flex bg-sidebar border-r border-sidebar-border flex-col transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-64'
            }`}
        >
          {/* Main Logo */}
          <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
            <div className={`overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
              <Logo size="md" />
            </div>

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground transition-all ${isSidebarCollapsed ? 'mx-auto' : ''
                }`}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>

          <nav className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-6">
              {navSections.map((section, index) => (
                <div key={index}>
                  {!isSidebarCollapsed && (
                    <h3 className="text-[10px] font-black text-muted-foreground mb-3 px-4 tracking-[0.2em] uppercase opacity-50">
                      {section.title}
                    </h3>
                  )}
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeSection === item.id;

                      const NavButton = (
                        <button
                          onClick={() => handleNavClick(item.id)}
                          className={`flex items-center rounded-xl transition-all duration-300 ${isActive
                            ? 'bg-[#21A68D] text-white shadow-lg shadow-[#21A68D]/20'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent'
                            } ${isSidebarCollapsed
                              ? 'w-12 h-12 justify-center mx-auto p-0'
                              : 'w-full gap-3 px-4 py-3'}`}
                        >
                          <Icon className={`${isSidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0 transition-all duration-300`} />
                          {!isSidebarCollapsed && (
                            <span className="font-bold text-sm tracking-tight truncate">
                              {item.label}
                            </span>
                          )}
                        </button>
                      );

                      return (
                        <li key={item.id}>
                          {isSidebarCollapsed ? (
                            <Tooltip>
                              <TooltipTrigger asChild>{NavButton}</TooltipTrigger>
                              <TooltipContent side="right" className="bg-[#21A68D] text-white border-none font-bold">
                                {item.label}
                              </TooltipContent>
                            </Tooltip>
                          ) : NavButton}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          <div className={`p-4 border-t border-sidebar-border bg-white/[0.02] flex flex-col items-center justify-center gap-2`}>
            {isSidebarCollapsed ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-12 h-12 rounded-full bg-[#21A68D] flex items-center justify-center border border-white/10 shadow-lg shadow-[#21A68D]/20 cursor-pointer hover:scale-110 transition-transform duration-300">
                      <span className="text-white font-black text-sm">{displayInitials}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-bold">{displayName}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black">{displayRole} • Online</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={logout}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all duration-300"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-bold">Logout</p>
                  </TooltipContent>
                </Tooltip>
              </>
            ) : (
              <div className="w-full flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#21A68D] flex items-center justify-center border border-white/10 shadow-lg shadow-[#21A68D]/20 flex-shrink-0">
                  <span className="text-white font-black text-xs">{displayInitials}</span>
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-sm font-black text-white leading-none truncate">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1 truncate">{displayRole} • Online</p>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 flex-shrink-0"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 h-screen">

          <main className="flex-1 overflow-auto bg-[#0a0e1a] lg:pt-0 pt-16">
            <ErrorBoundary>
              {renderSection()}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
      <StorageIndicator />
    </ThemeProvider>
  );
}

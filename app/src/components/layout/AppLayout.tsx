/**
 * App Layout Component
 *
 * The main layout component for the application.
 * It provides the responsive sidebar navigation, mobile header, and main content area.
 * It also handles the sidebar resizing logic and mobile drawer state.
 */

import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useCurrentProfile } from '../../hooks/useCurrentProfile';
import { useProfileStore } from '../../stores/profile';
import { useNotificationStore } from '../../stores/notifications';
import { useSettingsStore } from '../../stores/settings';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../ui/button';
import { ModeToggle } from '../mode-toggle';
import { log, LogLevel } from '../../lib/logger';
import { ProfileSwitcher } from '../profile-switcher';
import { useToast } from '../../hooks/use-toast';
import { useInsomnia } from '../../hooks/useInsomnia';
import {
  LayoutGrid,
  Video,
  Clock,
  ChartGantt,
  Settings,
  Menu,
  Users,
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  GripVertical,
  LayoutDashboard,
  RotateCcw,
  Server,
  Eye,
  EyeOff,
  Pencil,
  Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '../ui/sheet';
import { useTranslation } from 'react-i18next';
import { getAppVersion } from '../../lib/version';
import { BackgroundTaskDrawer } from '../BackgroundTaskDrawer';
import { CertTrustDialog } from '../CertTrustDialog';
import { onCertTrustRequest, type PendingCertTrust } from '../../lib/cert-trust-event';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';


interface SidebarContentProps {
  onMobileClose?: () => void;
  isCollapsed?: boolean;
}

/**
 * Language Switcher Component
 * Renders a dropdown to switch the application language.
 */
function LanguageSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { i18n, t } = useTranslation();

  const languages = [
    { code: 'en', label: t('languages.en') },
    { code: 'es', label: t('languages.es') },
    { code: 'fr', label: t('languages.fr') },
    { code: 'de', label: t('languages.de') },
    { code: 'zh', label: t('languages.zh') },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-2 gap-1 ml-1",
            collapsed && "w-8 p-0 justify-center ml-0 mt-2"
          )}
          title={t('sidebar.switch_language')}
          data-testid="language-switcher"
        >
          <Globe className="h-4 w-4" />
          {!collapsed && (
            <span className="text-xs uppercase font-medium">{i18n.language?.split('-')[0] || 'en'}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className="text-xs"
            data-testid={`language-option-${lang.code}`}
          >
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Sidebar Content Component
 * Renders the navigation links and user controls within the sidebar.
 */
function SidebarContent({ onMobileClose, isCollapsed }: SidebarContentProps) {
  const location = useLocation();
  const isCompact = document.documentElement.classList.contains('compact-mode');
  const currentProfile = useProfileStore(
    useShallow((state) => {
      const { profiles, currentProfileId } = state;
      return profiles.find((p) => p.id === currentProfileId) || null;
    })
  );
  const { connectionState, getProfileSettings } = useNotificationStore(
    useShallow((state) => ({
      connectionState: state.connectionState,
      getProfileSettings: state.getProfileSettings,
    }))
  );
  const { getProfileSettings: getSettings, updateProfileSettings } = useSettingsStore(
    useShallow((state) => ({
      getProfileSettings: state.getProfileSettings,
      updateProfileSettings: state.updateProfileSettings,
    }))
  );

  // Get notification data for current profile
  const settings = currentProfile ? getProfileSettings(currentProfile.id) : null;
  const profileSettings = currentProfile ? getSettings(currentProfile.id) : null;

  const { t } = useTranslation();
  const { toast } = useToast();

  const handleInsomniaToggle = () => {
    if (currentProfile && profileSettings) {
      const newValue = !profileSettings.insomnia;
      updateProfileSettings(currentProfile.id, { insomnia: newValue });
      toast({
        description: t(newValue ? 'montage.insomnia_enabled' : 'montage.insomnia_disabled'),
      });
    }
  };


  const defaultNavItems = [
    { path: '/dashboard', label: t('sidebar.dashboard'), icon: LayoutDashboard },
    { path: '/monitors', label: t('sidebar.monitors'), icon: Video },
    { path: '/montage', label: t('sidebar.montage'), icon: LayoutGrid },
    { path: '/events', label: t('sidebar.events'), icon: Clock },
    { path: '/timeline', label: t('sidebar.timeline'), icon: ChartGantt },
    { path: '/notifications', label: t('sidebar.notifications'), icon: Bell },
    { path: '/profiles', label: t('sidebar.profiles'), icon: Users },
    { path: '/settings', label: t('sidebar.settings'), icon: Settings },
    { path: '/server', label: t('sidebar.server'), icon: Server },
    { path: '/logs', label: t('sidebar.logs'), icon: FileText },
  ];

  const savedOrder = profileSettings?.sidebarNavOrder;
  const navItems = useMemo(() => {
    if (!savedOrder || savedOrder.length === 0) return defaultNavItems;
    const orderMap = new Map(savedOrder.map((path, idx) => [path, idx]));
    return [...defaultNavItems].sort((a, b) => {
      const ai = orderMap.get(a.path) ?? 999;
      const bi = orderMap.get(b.path) ?? 999;
      return ai - bi;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedOrder, t]);

  const [isReordering, setIsReordering] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const navListRef = useRef<HTMLElement>(null);
  const dragOriginY = useRef(0);

  const saveNavOrder = useCallback((reordered: typeof navItems) => {
    if (!currentProfile) return;
    updateProfileSettings(currentProfile.id, {
      sidebarNavOrder: reordered.map((item) => item.path),
    });
  }, [currentProfile, updateProfileSettings]);

  const resetNavOrder = useCallback(() => {
    if (!currentProfile) return;
    updateProfileSettings(currentProfile.id, { sidebarNavOrder: [] });
  }, [currentProfile, updateProfileSettings]);

  const handlePointerDown = useCallback((e: React.PointerEvent, index: number) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragIndex(index);
    setDragOffsetY(0);
    dragOriginY.current = e.clientY;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragIndex === null || !navListRef.current) return;

    // Move the dragged item visually with the pointer
    setDragOffsetY(e.clientY - dragOriginY.current);

    // Live swap when crossing another item's midpoint
    const items = navListRef.current.querySelectorAll('[data-nav-reorder]');
    for (let i = 0; i < items.length; i++) {
      if (i === dragIndex) continue;
      const rect = items[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        if ((i < dragIndex && e.clientY < midY) || (i > dragIndex && e.clientY > midY)) {
          const reordered = [...navItems];
          [reordered[dragIndex], reordered[i]] = [reordered[i], reordered[dragIndex]];
          saveNavOrder(reordered);
          setDragIndex(i);
          // Reset origin to current pointer so offset stays smooth after swap
          dragOriginY.current = e.clientY;
          setDragOffsetY(0);
        }
        return;
      }
    }
  }, [dragIndex, navItems, saveNavOrder]);

  const handlePointerUp = useCallback(() => {
    setDragIndex(null);
    setDragOffsetY(0);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={cn(
        "transition-all duration-300",
        isCollapsed ? "p-2 flex flex-col items-center" : isCompact ? "px-3 py-2" : "p-6"
      )}>
        <div className={cn("flex items-center gap-2 mb-1", isCollapsed && "flex-col mb-2")}>
          <img src="/logo.png" alt={t('app.logo_alt')} className={cn("rounded-lg", isCompact ? "h-6 w-6" : "h-8 w-8")} />
          {!isCollapsed && (
            <>
              <h1 className="text-base font-bold tracking-tight whitespace-nowrap">{t('app.name')}</h1>
              <LanguageSwitcher />
            </>
          )}
        </div>
        {isCollapsed && <LanguageSwitcher collapsed />}
        {!isCollapsed && currentProfile && (
          <p className="text-xs text-muted-foreground font-medium px-1 truncate">
            {currentProfile.name}
          </p>
        )}
      </div>

      <div className={cn("overflow-y-auto", isCompact ? "px-2 py-1" : "px-3 py-2")}>
        {/* Reorder toggle — only when expanded */}
        {!isCollapsed && (
          <div className="flex justify-end gap-1 mb-1 px-1">
            {isReordering && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={resetNavOrder}
                title={t('settings.nav_order_reset')}
                data-testid="nav-reorder-reset"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsReordering((prev) => !prev)}
              title={isReordering ? t('dashboard.done') : t('settings.nav_order')}
              data-testid="nav-reorder-toggle"
            >
              {isReordering ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3 w-3" />}
            </Button>
          </div>
        )}
        <nav
          ref={navListRef}
          className="space-y-1"
          onPointerMove={isReordering ? handlePointerMove : undefined}
          onPointerUp={isReordering ? handlePointerUp : undefined}
        >
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            if (isReordering && !isCollapsed) {
              const isDragging = dragIndex === index;
              return (
                <div
                  key={item.path}
                  data-nav-reorder
                  onPointerDown={(e) => handlePointerDown(e, index)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium select-none touch-none",
                    isDragging
                      ? "bg-primary/15 text-foreground shadow-md z-10 relative scale-[1.03]"
                      : "text-muted-foreground cursor-grab transition-all duration-200"
                  )}
                  style={isDragging ? { transform: `translateY(${dragOffsetY}px) scale(1.03)` } : undefined}
                  data-testid={`nav-reorder-${item.path.replace('/', '')}`}
                >
                  <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground/50" />
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate flex-1">{item.label}</span>
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => onMobileClose?.()}
                className={cn(
                  "flex items-center rounded-lg font-medium transition-all duration-200 group relative",
                  isCompact ? "gap-2 px-2 py-1 text-xs" : "gap-3 px-3 py-2.5 text-sm",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  isCollapsed && "justify-center px-2"
                )}
                title={isCollapsed ? item.label : undefined}
                data-testid={`nav-item-${item.path.replace('/', '')}`}
              >
                <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110 flex-shrink-0", isActive && "text-primary-foreground")} />
                {!isCollapsed && (
                  <>
                    <span className="truncate">{item.label}</span>

                    {item.path === '/montage' && isActive && (() => {
                      return (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-auto flex-shrink-0"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (currentProfile) {
                              updateProfileSettings(currentProfile.id, {
                                montageShowToolbar: !profileSettings?.montageShowToolbar,
                              });
                            }
                          }}
                          title={t('montage.toggle_toolbar')}
                          data-testid="sidebar-montage-toolbar-toggle"
                        >
                          {profileSettings?.montageShowToolbar
                            ? <Eye className="h-3.5 w-3.5" />
                            : <EyeOff className="h-3.5 w-3.5" />}
                        </Button>
                      );
                    })()}

                    {item.path === '/notifications' && (() => {
                      const statusLabel =
                        !settings?.enabled ? t('notifications.status.disabled') :
                        settings?.notificationMode === 'direct' ? t('notifications.status.direct_active') :
                        connectionState === 'connected' ? t('notifications.status.connected') :
                        connectionState === 'disconnected' ? t('notifications.status.disconnected') :
                        t('notifications.status.connecting');
                      const dotColor =
                        !settings?.enabled ? "bg-muted-foreground/50" :
                        settings?.notificationMode === 'direct' ? "bg-blue-400" :
                        connectionState === 'connected' ? "bg-green-500" :
                        connectionState === 'disconnected' || connectionState === 'error' ? "bg-red-500" :
                        "bg-orange-500 animate-pulse";
                      return (
                        <div
                          className={cn("h-2 w-2 rounded-full ml-2 flex-shrink-0", dotColor)}
                          title={statusLabel}
                          role="status"
                          aria-live="polite"
                          aria-label={statusLabel}
                          data-testid="notification-status-indicator"
                        />
                      );
                    })()}

                  </>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={cn("mt-auto border-t bg-card/50 backdrop-blur-sm transition-all duration-300", isCollapsed ? "p-2 space-y-3" : isCompact ? "px-2 py-1.5 space-y-0.5" : "px-3 py-2 space-y-1.5")}>
        {!isCollapsed ? (
          <>
            <div className={isCompact ? "space-y-0.5" : "space-y-1"}>
              <span className="text-xs font-medium text-muted-foreground px-1">{t('sidebar.profile')}</span>
              <ProfileSwitcher />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t('settings.theme')}</span>
              <ModeToggle className={isCompact ? "h-7 w-7" : "h-8 w-8"} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t('monitor_detail.insomnia_label')}</span>
              <Button
                onClick={handleInsomniaToggle}
                variant={profileSettings?.insomnia ? "default" : "outline"}
                size="icon"
                className={isCompact ? "h-7 w-7" : "h-8 w-8"}
                title={profileSettings?.insomnia ? t('montage.insomnia_enabled') : t('montage.insomnia_disabled')}
                data-testid="sidebar-insomnia-toggle"
              >
                {profileSettings?.insomnia ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </div>
          </>
        ) : (
          <Button
            onClick={handleInsomniaToggle}
            variant={profileSettings?.insomnia ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            title={profileSettings?.insomnia ? t('montage.insomnia_enabled') : t('montage.insomnia_disabled')}
            data-testid="sidebar-insomnia-toggle-collapsed"
          >
            {profileSettings?.insomnia ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        )}
        <p className={cn("text-[10px] text-muted-foreground/50 pt-1", isCollapsed ? "text-center" : "px-1")}>
          v{getAppVersion()}
        </p>
      </div>
    </div>
  );
}

/**
 * AppLayout Component
 * The main layout wrapper that includes the sidebar and main content area.
 */
export default function AppLayout() {
  const { currentProfile, settings } = useCurrentProfile();
  const updateProfileSettings = useSettingsStore((state) => state.updateProfileSettings);
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => (settings.sidebarWidth ?? 256) <= 80);
  const { t } = useTranslation();

  // Track route changes and save to settings
  useEffect(() => {
    if (!currentProfile?.id) return;

    // Exclude setup/profile routes and notification-opened pages from being saved as lastRoute
    const excludedRoutes = ['/profiles/new', '/setup', '/profiles'];
    const fromNotification = (location.state as Record<string, unknown>)?.fromNotification === true;
    const shouldSave = !excludedRoutes.includes(location.pathname) && !fromNotification;

    if (shouldSave) {
      updateProfileSettings(currentProfile.id, { lastRoute: location.pathname });
      log.app('Storing route', LogLevel.DEBUG, { route: location.pathname });
    }
  }, [location.pathname, currentProfile?.id, updateProfileSettings]);

  // Apply global insomnia setting
  useInsomnia({ enabled: settings.insomnia });


  const expandedWidth = settings.displayMode === 'compact' ? 180 : 256;
  const collapsedWidth = 60;
  const sidebarWidth = isCollapsed ? collapsedWidth : expandedWidth;

  const toggleSidebar = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    if (currentProfile) {
      updateProfileSettings(currentProfile.id, { sidebarWidth: next ? collapsedWidth : expandedWidth });
    }
  };

  // Check for profile after all hooks are called to avoid hooks violation
  // Allow /profiles route without a current profile (for profile selection after cancel)
  // Otherwise redirect to profile selection or new profile setup
  if (!currentProfile) {
    // Don't redirect if already on profiles page
    if (location.pathname === '/profiles') {
      // Allow access to profiles page without a current profile
    } else {
      const profiles = useProfileStore.getState().profiles;
      return <Navigate to={profiles.length > 0 ? "/profiles" : "/profiles/new"} replace />;
    }
  }

  // TOFU certificate trust migration dialog
  const [pendingCert, setPendingCert] = useState<PendingCertTrust | null>(null);

  useEffect(() => {
    return onCertTrustRequest((pending) => {
      setPendingCert(pending);
    });
  }, []);

  const handleCertTrust = useCallback(async () => {
    if (!pendingCert) return;
    const { profileId, certInfo } = pendingCert;
    setPendingCert(null);

    updateProfileSettings(profileId, { trustedCertFingerprint: certInfo.fingerprint });
    const { applySSLTrustSetting } = await import('../../lib/ssl-trust');
    await applySSLTrustSetting(true, certInfo.fingerprint);
    log.app('Certificate trusted via TOFU migration', LogLevel.INFO);
  }, [pendingCert, updateProfileSettings]);

  const handleCertCancel = useCallback(async () => {
    if (!pendingCert) return;
    const { profileId } = pendingCert;
    setPendingCert(null);

    // Disable self-signed certs since user rejected the certificate
    updateProfileSettings(profileId, { allowSelfSignedCerts: false, trustedCertFingerprint: null });
    const { applySSLTrustSetting } = await import('../../lib/ssl-trust');
    await applySSLTrustSetting(false);
    log.app('Certificate rejected, disabling self-signed cert support', LogLevel.INFO);
  }, [pendingCert, updateProfileSettings]);

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex flex-col border-r bg-card/50 backdrop-blur-xl z-20 transition-all duration-300 relative group"
        style={{ width: `${sidebarWidth}px` }}
      >
        <SidebarContent isCollapsed={isCollapsed} />

        {/* Toggle Button */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-10 bg-primary hover:bg-primary/90 rounded-full flex items-center justify-center cursor-pointer shadow-lg z-50 transition-all duration-200 opacity-0 group-hover:opacity-100"
          onClick={toggleSidebar}
          title={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          data-testid="sidebar-toggle"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-primary-foreground" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-primary-foreground" />
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-[calc(3rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] border-b bg-background z-30 flex items-center px-3 justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt={t('app.logo_alt')} className="h-8 w-8 rounded-lg" />
          <span className="font-bold">{t('app.name')}</span>
          <LanguageSwitcher />
        </div>
        <div className="flex items-center gap-1">
          {location.pathname === '/montage' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (currentProfile) {
                  updateProfileSettings(currentProfile.id, {
                    montageShowToolbar: !settings.montageShowToolbar,
                  });
                }
              }}
              title={t('montage.toggle_toolbar')}
              data-testid="montage-toolbar-toggle"
            >
              {settings.montageShowToolbar ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </Button>
          )}
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="mobile-menu-button">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 sm:w-72 flex flex-col pt-[env(safe-area-inset-top)]">
            <SheetTitle className="sr-only">{t('app.navigation_menu')}</SheetTitle>
            <SheetDescription className="sr-only">{t('app.navigation_menu_desc')}</SheetDescription>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent onMobileClose={() => setIsMobileOpen(false)} />
            </div>
          </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative w-full pt-[calc(3rem+env(safe-area-inset-top))] md:pt-0 pb-[env(safe-area-inset-bottom)]">
        {/* Background gradient blob for visual interest */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/5 to-transparent -z-10 pointer-events-none" />

        <Outlet />
      </main>

      {/* Global Background Task Drawer */}
      <BackgroundTaskDrawer />


      {/* TOFU certificate trust migration dialog */}
      <CertTrustDialog
        open={!!pendingCert}
        certInfo={pendingCert?.certInfo ?? null}
        isChanged={false}
        onTrust={handleCertTrust}
        onCancel={handleCertCancel}
      />
    </div>
  );
}

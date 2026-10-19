import { useEffect, useState } from "react";
import {
  MOCK_INCIDENTS,
  MOCK_NEWS,
  MOCK_NOTIFS,
  MOCK_USERS,
} from "../data/mockData";
import { api } from "../services/api";
import { setupFirebaseNotifications } from "../services/firebaseNotifications";
import { isTaoRole, isVillageAdminRole } from "../core/roles";
import {
  ACTIVE_TAB_KEY,
  USE_MOCK_DATA,
  allowedTabsForRole,
  normalizeIncident,
  normalizeNews,
  normalizeNotification,
  normalizeUser,
  restoredTabForRole,
} from "./runtime";
import LandingPage from "../features/public/LandingPage";
import AuthPage from "../features/auth/AuthPage";
import { Sidebar, Topbar } from "../layout/AppShell";
import UserDashboard from "../features/citizen/UserDashboard";
import TaoDashboard from "../features/tao/TaoDashboard";
import VillageOverviewDashboard from "../features/village/VillageOverviewDashboard";
import AdminDashboard from "../features/admin/AdminDashboard";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [restoringSession, setRestoringSession] = useState(() => api.hasSession());
  const [currentView, setCurrentView] = useState(() =>
    new URLSearchParams(window.location.search).has("reset_token")
      ? "auth"
      : "landing",
  ); // landing, auth, dashboard
  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem(ACTIVE_TAB_KEY) || "news",
  ); // Managed globally for sidebar integration
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // App Data State
  const [users, setUsers] = useState(MOCK_USERS);
  const [news, setNews] = useState(MOCK_NEWS);
  const [incidents, setIncidents] = useState(MOCK_INCIDENTS);
  const [notifications, setNotifications] = useState(MOCK_NOTIFS);
  const [villages, setVillages] = useState([]);
  const [apiStatus, setApiStatus] = useState("mock");

  useEffect(() => {
    sessionStorage.setItem(ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    // An authenticated refresh is restored by /me below. Loading the public
    // bootstrap at the same time can finish later and overwrite dashboard data.
    if (api.hasSession()) return undefined;
    let isMounted = true;

    api
      .getBootstrapData()
      .then((data) => {
        if (!isMounted) return;
        setUsers((data.users || []).map(normalizeUser));
        setNews((data.news || []).map(normalizeNews));
        setIncidents((data.incidents || []).map(normalizeIncident));
        setNotifications((data.notifications || []).map(normalizeNotification));
        setVillages(data.villages || []);
        setApiStatus("connected");
      })
      .catch(() => {
        if (isMounted) setApiStatus(USE_MOCK_DATA ? "mock" : "offline");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let unsubscribe = null;

    setupFirebaseNotifications(currentUser, (message) => {
      setNotifications((prev) => [message, ...prev]);
    })
      .then((cleanup) => {
        unsubscribe = cleanup;
      })
      .catch(() => {
        unsubscribe = null;
      });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || currentView !== "dashboard") return;
    const params = new URLSearchParams(window.location.search);
    const notificationType = params.get("notification_type");
    if (!notificationType) return;

    setActiveTab(
      getNotificationTargetTab(currentUser.role, {
        type: notificationType,
        data: {
          incident_id: params.get("incident_id"),
          user_id: params.get("user_id"),
          project_id: params.get("project_id"),
        },
      }),
    );
    params.delete("notification_type");
    params.delete("notification_id");
    params.delete("incident_id");
    params.delete("user_id");
    params.delete("project_id");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [currentUser, currentView]);

  useEffect(() => {
    if (!currentUser || !api.hasSession()) return undefined;
    let active = true;
    const refreshNotifications = () => {
      api.getNotifications()
        .then((data) => {
          if (active) setNotifications((data.notifications || []).map(normalizeNotification));
        })
        .catch(() => {});
    };
    refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!api.hasSession()) {
      setRestoringSession(false);
      return undefined;
    }
    let isMounted = true;

    api.getMe()
      .then((account) => {
        if (!isMounted) return;
        const user = normalizeUser(account.user || account);
        setCurrentUser(user);
        setActiveTab(restoredTabForRole(user.role));
        setCurrentView("dashboard");
        setRestoringSession(false);

        // A dashboard-data error must not log the account out. The identity
        // has already been verified successfully by /me.
        api.getDashboardData()
          .then((dashboard) => {
            if (!isMounted) return;
            setUsers((dashboard.users || []).map(normalizeUser));
            setNews((dashboard.news || []).map(normalizeNews));
            setIncidents((dashboard.incidents || []).map(normalizeIncident));
            setNotifications(
              (dashboard.notifications || []).map(normalizeNotification),
            );
            setVillages(dashboard.villages || []);
            setApiStatus("connected");
          })
          .catch(() => setApiStatus("offline"));
      })
      .catch(() => {
        api.clearSession();
        if (!isMounted) return;
        setCurrentUser(null);
        setCurrentView("landing");
        setRestoringSession(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Login Handler
  const handleLogin = async (phone, password) => {
    let user = null;

    try {
      const data = await api.login(phone, password);
      user = normalizeUser(data.user);
      setCurrentUser(user);
      setActiveTab(
        isTaoRole(user.role)
          ? "tao_overview"
          : isVillageAdminRole(user.role)
            ? "stats"
            : "news",
      );
      setCurrentView("dashboard");
      setApiStatus("connected");
      api
        .getDashboardData()
        .then((dashboard) => {
          setUsers((dashboard.users || []).map(normalizeUser));
          setNews((dashboard.news || []).map(normalizeNews));
          setIncidents((dashboard.incidents || []).map(normalizeIncident));
          setNotifications(
            (dashboard.notifications || []).map(normalizeNotification),
          );
          setVillages(dashboard.villages || []);
        })
        .catch(() => setApiStatus("offline"));
    } catch (error) {
      if (error?.status === 403) {
        const statusText =
          error?.data?.account_status === "suspended"
            ? "บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลหมู่บ้าน"
            : "บัญชียังไม่สามารถใช้งานได้";
        alert(statusText);
        return;
      }
      if (!USE_MOCK_DATA) {
        alert(error?.message || "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }
      user = users.find((u) => u.phone === phone && u.password === password);
    }

    if (user) {
      setCurrentUser(user);
      setActiveTab(
        isTaoRole(user.role)
          ? "tao_overview"
          : isVillageAdminRole(user.role)
            ? "stats"
            : "news",
      );
      setCurrentView("dashboard");
    } else {
      alert("เบอร์โทรศัพท์/ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง");
    }
  };

  // Register Handler
  const handleRegister = async (newUser) => {
    if (users.find((u) => u.phone === newUser.phone)) {
      alert("เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว");
      return false;
    }

    try {
      const data = await api.register(newUser);
      setUsers((prev) => [...prev, normalizeUser(data.user)]);
      setApiStatus("connected");
      return true;
    } catch (error) {
      if (!USE_MOCK_DATA) {
        const validationMessages = Object.values(
          error?.data?.errors || {},
        ).flat();
        alert(
          validationMessages.length
            ? validationMessages.join("\n")
            : error?.message ||
                "สมัครสมาชิกไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง",
        );
        return false;
      }
    }

    const user = {
      ...newUser,
      id: Date.now().toString(),
      role: "user",
      accountStatus: "approved",
    };
    setUsers([...users, user]);
    return true;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView("landing");
    api.logout().catch(() => null);
  };

  // Render Logic
  if (restoringSession)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-slate-600">
        <div className="rounded-2xl border bg-white px-7 py-5 font-bold shadow-sm">
          กำลังเปิดหน้าระบบของคุณ...
        </div>
      </div>
    );
  if (currentView === "landing")
    return <LandingPage onNavigate={setCurrentView} news={news} />;
  if (["auth", "register"].includes(currentView))
    return (
      <AuthPage
        villages={villages}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onBack={() => setCurrentView("landing")}
        initialMode={currentView === "register" ? "register" : "login"}
      />
    );

  return (
    <div
      className="app-shell flex h-dvh min-w-0 overflow-hidden font-sans"
      data-role={currentUser?.role || "guest"}
    >
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar
        currentUser={currentUser}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className="flex min-w-0 flex-1 flex-col h-dvh overflow-hidden">
        <Topbar
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          onLogout={handleLogout}
          notifications={notifications}
          setNotifications={setNotifications}
          setActiveTab={setActiveTab}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        <main className="app-main flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-7">
          {isTaoRole(currentUser?.role) ? (
            <TaoDashboard
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              currentUser={currentUser}
              incidents={incidents}
              setIncidents={setIncidents}
              users={users}
              villages={villages}
              news={news}
              setNews={setNews}
            />
          ) : isVillageAdminRole(currentUser?.role) ? (
            <AdminDashboard
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              news={news}
              setNews={setNews}
              incidents={incidents}
              setIncidents={setIncidents}
              setNotifications={setNotifications}
              users={users}
              setUsers={setUsers}
              villages={villages}
              currentUser={currentUser}
              villageMode
            />
          ) : (
            <UserDashboard
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isSidebarOpen={isSidebarOpen}
              currentUser={currentUser}
              news={news}
              incidents={incidents}
              setIncidents={setIncidents}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ==========================================
// 1. LANDING PAGE
// ==========================================

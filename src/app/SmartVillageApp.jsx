import React, { useEffect, useRef, useState } from "react";
import {
  CircleMarker,
  LayersControl,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Home,
  FileText,
  AlertTriangle,
  PieChart,
  Users,
  Settings,
  LogOut,
  MapPin,
  Camera,
  CheckCircle,
  Clock,
  Search,
  Plus,
  Trash2,
  Menu,
  X,
  Calendar,
  Bell,
  Facebook,
  Phone,
  MessageCircle,
  ChevronRight,
  Upload,
  Map,
  Info,
  Edit,
  Image,
  Eye,
  EyeOff,
  Video,
} from "lucide-react";
import {
  MOCK_INCIDENTS,
  MOCK_NEWS,
  MOCK_NOTIFS,
  MOCK_USERS,
} from "../data/mockData";
import { api, API_BASE_URL } from "../services/api";
import { setupFirebaseNotifications } from "../services/firebaseNotifications";
import CitizenFeedback from "../features/citizen/CitizenFeedback";
import AdminReports from "../features/reports/AdminReports";
import DateRangePicker from "../shared/DateRangePicker";
import StatusBadge from "../shared/StatusBadge";
import {
  formatThaiDateTime,
  getPriorityMeta,
  getStatusLabel,
  projectStatusLabels,
} from "../core/incidentPresentation";

import { APP_NAME, CATEGORIES, VILLAGE_NAME } from "../config/app";
import { isCitizenRole, isTaoRole, isVillageAdminRole } from "../core/roles";
import { taoMenu } from "../features/tao/menu";
import { villageMenu } from "../features/village/menu";
import { citizenMenu } from "../features/citizen/menu";
import {
  clamp,
  formatHours,
  getCredibilityMeta,
  getFormattedDate,
  getHeatLevel,
  getHoursDiff,
  getSentimentMeta,
  getSentimentScore,
  latLngToPercent,
  percentToLatLng,
} from "../utils/village";

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === "true";
const APP_LOGO_URL = "/app-logo-matong.png";

function AppLogo({ className = "" }) {
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-full ${className}`}
      aria-hidden="true"
    >
      <img
        src={APP_LOGO_URL}
        alt=""
        className="h-full w-full object-contain"
      />
    </span>
  );
}

const normalizeUser = (user) => ({
  ...user,
  accountStatus: user.accountStatus ?? user.account_status,
  villageId: user.villageId ?? user.village_id,
  villageName: user.villageName ?? user.village?.name,
  villageMoo: user.villageMoo ?? user.village?.moo,
});
const normalizeMediaUrl = (value) => {
  if (!value || /^(data:|blob:)/i.test(value)) return value;
  try {
    // Older uploads could contain two absolute URLs joined together, for
    // example https://api.examplehttps://api.example/storage/file.jpg.
    // Keep the second (real storage) URL so existing images work again.
    const duplicatedAbsoluteUrl = String(value).match(/^https?:\/\/[^/]+?(https?:\/\/.+)$/i);
    const cleanValue = duplicatedAbsoluteUrl?.[1] || value;
    const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
    const mediaUrl = new URL(cleanValue, `${apiOrigin}/`);
    if (window.location.protocol === "https:" && mediaUrl.protocol === "http:") {
      mediaUrl.protocol = "https:";
    }
    if (mediaUrl.pathname.startsWith("/storage/")) {
      const mediaPath = mediaUrl.pathname.slice("/storage/".length);
      return `${apiOrigin}/api/media/${mediaPath}`;
    }
    return mediaUrl.href;
  } catch {
    return value;
  }
};
const normalizeNews = (item) => ({
  ...item,
  image: normalizeMediaUrl(item.image),
  villageId: item.villageId ?? item.village_id,
  date: item.date ?? item.published_at ?? item.created_at,
  displaySection:
    item.displaySection ??
    item.display_section ??
    (item.video_url ? "video" : "news"),
});
const normalizeIncident = (item) => ({
  ...item,
  image: normalizeMediaUrl(item.image),
  userId: item.userId ?? item.user_id,
  userName: item.userName ?? item.user?.name,
  userPhone: item.userPhone ?? item.user?.phone,
  resolvedImage: normalizeMediaUrl(item.resolvedImage ?? item.resolved_image),
  firstResponseAt: item.firstResponseAt ?? item.first_response_at,
  resolvedAt: item.resolvedAt ?? item.resolved_at,
  assignedTo: item.assignedTo ?? item.assigned_to,
  assignedToName: item.assignedToName ?? item.assignee?.name,
  assignedAt: item.assignedAt ?? item.assigned_at,
  department: item.department ?? null,
  dueAt: item.dueAt ?? item.due_at,
  resolutionSummary: item.resolutionSummary ?? item.resolution_summary,
  citizenConfirmedAt: item.citizenConfirmedAt ?? item.citizen_confirmed_at,
  reopenedAt: item.reopenedAt ?? item.reopened_at,
  referenceNo: item.referenceNo ?? item.reference_no,
  villageId: item.villageId ?? item.village_id,
  villageName:
    item.villageName ?? item.village?.name ?? item.user?.village?.name,
  villageMoo: item.villageMoo ?? item.village?.moo ?? item.user?.village?.moo,
  requiresTao: item.requiresTao ?? item.requires_tao,
  forwardedToTaoAt: item.forwardedToTaoAt ?? item.forwarded_to_tao_at,
  budgetRequest: item.budgetRequest ?? item.budget_request,
  feedback: item.feedback ?? null,
  supporterCount: Number(item.supporterCount ?? item.supporters_count ?? 0),
  supportedByMe: Boolean(item.supportedByMe ?? item.supported_by_me),
  isOwn: Boolean(item.isOwn ?? item.is_own),
  submittedForReviewAt:
    item.submittedForReviewAt ?? item.submitted_for_review_at,
  verifiedAt: item.verifiedAt ?? item.verified_at,
  updates: (item.updates ?? []).map((update) => ({
    ...update,
    image: normalizeMediaUrl(update.image),
  })),
  histories: item.histories ?? [],
  date: item.date ?? item.created_at,
  lat: item.lat == null ? null : Number(item.lat),
  lng: item.lng == null ? null : Number(item.lng),
});
const notificationStatusLabels = {
  pending: "รับเรื่องแล้ว",
  assigned: "รับเรื่องแล้ว",
  in_progress: "กำลังดำเนินการ",
  waiting_review: "ดำเนินการเสร็จ รอตรวจรับ",
  revision_requested: "กำลังแก้ไขเพิ่มเติม",
  resolved: "แก้ไขเสร็จแล้ว",
  cancelled: "ยุติเรื่องแล้ว",
};
const normalizeNotification = (item) => {
  let title = item.title;
  let desc = item.desc ?? item.description;

  // Convert legacy generic notifications such as "ถนนเสีย: resolved"
  // so stored notifications also read naturally without changing the database.
  if (
    item.type === "incident_status" &&
    item.title === "สถานะเรื่องแจ้งเหตุเปลี่ยนแปลง"
  ) {
    const legacyMatch = String(desc || "").match(
      /^(.*):\s*(pending|assigned|in_progress|waiting_review|revision_requested|resolved|cancelled)$/,
    );
    if (legacyMatch) {
      title = notificationStatusLabels[legacyMatch[2]] || item.title;
      desc = legacyMatch[1];
    }
  }

  return {
    ...item,
    title,
    desc,
    isRead: item.isRead ?? Boolean(item.read_at),
    time: item.time ?? item.created_at,
  };
};

const getNotificationTargetTab = (role, notification = {}) => {
  const type = notification.type || notification.data?.type || "";

  if (isTaoRole(role)) {
    if (["budget", "project", "project_status"].includes(type))
      return "tao_budget";
    if (type.includes("incident") || ["assignment", "revision", "review"].includes(type))
      return "tao_forwarded";
    return "tao_overview";
  }

  if (isVillageAdminRole(role)) {
    if (type === "user_registration") return "users";
    if (["budget", "project", "project_status"].includes(type)) return "budgets";
    if (type === "news") return "news";
    if (type.includes("incident") || ["assignment", "revision", "review"].includes(type))
      return "incidents";
    return "stats";
  }

  if (type === "news") return "news";
  if (type.includes("incident") || ["assignment", "revision", "review"].includes(type))
    return "history";
  return "news";
};

const ACTIVE_TAB_KEY = "smart_village_active_tab";
const defaultTabForRole = (role) =>
  isTaoRole(role) ? "tao_overview" : isVillageAdminRole(role) ? "stats" : "news";
const allowedTabsForRole = (role) => {
  if (isTaoRole(role))
    return ["tao_overview", "tao_forwarded", "tao_villages", "tao_reports", "tao_content"];
  if (isVillageAdminRole(role))
    return ["stats", "incidents", "news", "users", "reports"];
  return ["news", "village_incidents", "report", "history"];
};
const restoredTabForRole = (role) => {
  const saved = sessionStorage.getItem(ACTIVE_TAB_KEY);
  return allowedTabsForRole(role).includes(saved) ? saved : defaultTabForRole(role);
};

// --- MAIN APP COMPONENT ---
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
  const [budgetSettings, setBudgetSettings] = useState({
    unit_costs: {},
    reserve_percent: 10,
  });
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
            setBudgetSettings(
              dashboard.budgetSettings || { unit_costs: {}, reserve_percent: 10 },
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
          setBudgetSettings(
            dashboard.budgetSettings || { unit_costs: {}, reserve_percent: 10 },
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
              budgetSettings={budgetSettings}
              setBudgetSettings={setBudgetSettings}
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
              budgetSettings={budgetSettings}
              setBudgetSettings={setBudgetSettings}
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
function LandingPage({ onNavigate, news }) {
  const centralNews = (news || []).filter((item) => item.village_id == null);
  const publicSlides = centralNews
    .filter((item) => item.displaySection === "hero" && item.image)
    .slice(0, 8);
  const activityNews = (news || [])
    .filter((item) => item.village_id == null && item.displaySection === "news")
    .slice(0, 6);
  const [slideIndex, setSlideIndex] = useState(0);
  const [activityIndex, setActivityIndex] = useState(0);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [publicSearch, setPublicSearch] = useState("");
  const [publicMenuOpen, setPublicMenuOpen] = useState(false);
  const [publicHeaderVisible, setPublicHeaderVisible] = useState(true);
  const lastPublicScrollY = useRef(0);
  const activityCarouselRef = useRef(null);
  const videoCarouselRef = useRef(null);
  useEffect(() => {
    if (publicSlides.length < 2) return undefined;
    const timer = window.setInterval(
      () => setSlideIndex((index) => (index + 1) % publicSlides.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, [publicSlides.length]);
  useEffect(() => {
    if (slideIndex >= publicSlides.length) setSlideIndex(0);
  }, [publicSlides.length, slideIndex]);
  useEffect(() => {
    lastPublicScrollY.current = window.scrollY;
    const handleScroll = () => {
      const currentY = window.scrollY;
      const difference = currentY - lastPublicScrollY.current;
      if (currentY <= 12 || difference < -7) setPublicHeaderVisible(true);
      if (difference > 7 && currentY > 80 && !publicMenuOpen) {
        setPublicHeaderVisible(false);
      }
      lastPublicScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [publicMenuOpen]);
  const goToPublicSection = (sectionId) => {
    setPublicMenuOpen(false);
    setPublicHeaderVisible(true);
    window.setTimeout(
      () => document.querySelector(sectionId)?.scrollIntoView({ behavior: "smooth" }),
      0,
    );
  };
  const currentSlide = publicSlides[slideIndex];
  const visibleActivityNews = activityNews.filter(
    (item) =>
      !publicSearch.trim() ||
      `${item.title} ${item.content}`
        .toLowerCase()
        .includes(publicSearch.trim().toLowerCase()),
  );
  useEffect(() => {
    if (activityIndex >= visibleActivityNews.length) setActivityIndex(0);
  }, [activityIndex, visibleActivityNews.length]);
  const goToActivity = (index) => {
    setActivityIndex(index);
    const carousel = activityCarouselRef.current;
    if (carousel) {
      carousel.scrollTo({ left: carousel.clientWidth * index, behavior: "smooth" });
    }
  };
  const promoItems = centralNews
    .filter((item) => item.displaySection === "video" && item.video_url)
    .slice(0, 8)
    .map((item) => {
      const value = item.video_url || "";
      const youtube = value.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/,
      );
      return {
        ...item,
        playableUrl: youtube
          ? `https://www.youtube.com/embed/${youtube[1]}`
          : value,
      };
    });
  const scrollVideoCarousel = (direction) => {
    const carousel = videoCarouselRef.current;
    if (!carousel) return;
    carousel.scrollBy({
      left: direction * Math.max(carousel.clientWidth * 0.85, 280),
      behavior: "smooth",
    });
  };
  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 font-sans text-slate-900 scroll-smooth">
      <header className={`public-header fixed inset-x-0 top-0 z-[1100] border-b border-slate-200 bg-white/95 shadow-md backdrop-blur-xl transition-transform duration-300 ${publicHeaderVisible || publicMenuOpen ? "translate-y-0" : "-translate-y-full"}`}>
        <div className="relative mx-auto flex h-16 w-full items-center gap-2 px-3 sm:h-[72px] sm:gap-3 sm:px-6 lg:h-20 lg:px-10 xl:px-16">
          <button type="button" onClick={() => goToPublicSection("#home")} className="flex min-w-0 flex-1 items-center gap-2.5 pr-[10.5rem] text-left sm:gap-3 sm:pr-[13rem] lg:gap-4 lg:pr-[17rem]">
            <AppLogo className="h-11 w-11 shadow-sm sm:h-12 sm:w-12 lg:h-14 lg:w-14" />
            <div className="min-w-0">
              <div className="line-clamp-2 text-[13px] font-black leading-[1.15] text-slate-900 min-[390px]:text-sm sm:text-base lg:text-2xl">
                {APP_NAME}
              </div>
              <div className="mt-0.5 hidden truncate text-[11px] font-bold text-slate-500 sm:block lg:mt-1 lg:text-sm">
                {VILLAGE_NAME}
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("auth")}
            className="absolute right-[3.75rem] flex h-10 w-[6.25rem] items-center justify-center whitespace-nowrap rounded-full bg-blue-600 px-2 text-xs font-black text-white shadow-sm hover:bg-blue-700 sm:right-[4.5rem] sm:h-11 sm:w-32 sm:text-sm lg:right-[6.5rem] lg:h-12 lg:w-36 lg:text-base xl:right-[9rem]"
          >
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            onClick={() => {
              setPublicMenuOpen((value) => !value);
              setPublicHeaderVisible(true);
            }}
            aria-label={publicMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
            aria-expanded={publicMenuOpen}
            className="absolute right-2.5 flex h-10 w-10 items-center justify-center rounded-xl text-slate-800 hover:bg-slate-100 sm:right-3 sm:h-11 sm:w-11 lg:right-10 lg:h-12 lg:w-12 xl:right-16"
          >
            {publicMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          {publicMenuOpen && (
            <div className="absolute right-3 top-[calc(100%+0.5rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl sm:right-6 lg:right-12 lg:w-[30rem] lg:p-3 xl:right-20">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  goToPublicSection("#activities");
                }}
                className="relative mb-2 overflow-hidden rounded-xl border bg-slate-50"
              >
                <input
                  value={publicSearch}
                  onChange={(event) => setPublicSearch(event.target.value)}
                  className="w-full bg-transparent py-3 pl-3 pr-14 text-sm outline-none lg:py-4 lg:pl-4 lg:text-lg"
                  placeholder="ค้นหาข่าวหรือกิจกรรม"
                />
                <button type="submit" aria-label="ค้นหา" className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-blue-700 hover:bg-blue-50">
                  <Search className="h-5 w-5 lg:h-7 lg:w-7" />
                </button>
              </form>
              {[
                ["หน้าหลัก", "#home"],
                ["ข่าวกิจกรรม", "#activities"],
                ["ติดต่อเรา", "#contact"],
              ].map(([label, section]) => (
                <button key={section} type="button" onClick={() => goToPublicSection(section)} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 lg:px-5 lg:py-4 lg:text-lg">
                  {label}<ChevronRight className="h-5 w-5 lg:h-6 lg:w-6" />
                </button>
              ))}
              <button type="button" onClick={() => onNavigate("register")} className="mt-1 w-full rounded-xl border border-blue-200 px-4 py-3 text-left font-bold text-blue-700 hover:bg-blue-50 lg:px-5 lg:py-4 lg:text-lg">
                สมัครสมาชิก
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="h-16 sm:h-[72px] lg:h-20" aria-hidden="true" />

      <section id="home" className="public-hero bg-white">
        <div
          className="relative mx-auto w-full overflow-hidden bg-white"
          style={{ aspectRatio: "2 / 1", height: "auto", minHeight: 0 }}
        >
          {currentSlide ? (
            <img
              key={currentSlide.id}
              src={currentSlide.image}
              alt={currentSlide.title}
              className="absolute inset-0 block h-full w-full bg-white object-contain object-center animate-fadeIn"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center center",
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-white">
              <div>
                <Bell className="mx-auto h-12 w-12 text-blue-300 lg:h-18 lg:w-18" />
                <h1 className="mt-4 text-2xl font-black sm:text-4xl lg:mt-6 lg:text-5xl">
                  ข่าวประชาสัมพันธ์ อบต.มะต้อง
                </h1>
                <p className="mt-2 text-slate-300 lg:mt-4 lg:text-xl">
                  ยังไม่มีข่าวประชาสัมพันธ์ในขณะนี้
                </p>
              </div>
            </div>
          )}
          {publicSlides.length > 1 && (
            <>
              <button
                aria-label="ภาพก่อนหน้า"
                onClick={() =>
                  setSlideIndex(
                    (index) =>
                      (index - 1 + publicSlides.length) % publicSlides.length,
                  )
                }
                className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur hover:bg-black/75"
              >
                <ChevronRight className="rotate-180" />
              </button>
              <button
                aria-label="ภาพถัดไป"
                onClick={() =>
                  setSlideIndex((index) => (index + 1) % publicSlides.length)
                }
                className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur hover:bg-black/75"
              >
                <ChevronRight />
              </button>
              <div className="absolute bottom-4 right-5 z-10 flex gap-2 sm:bottom-7 sm:right-8">
                {publicSlides.map((item, index) => (
                  <button
                    key={item.id}
                    aria-label={`เลือกภาพ ${index + 1}`}
                    onClick={() => setSlideIndex(index)}
                    className={`h-2.5 rounded-full transition-all ${index === slideIndex ? "w-8 bg-white" : "w-2.5 bg-white/50"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {activityNews.length > 0 && (
        <section id="activities" className="border-y bg-white py-14 lg:py-16">
          <div className="mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-20">
            <div className="mb-10 flex items-center gap-4 text-cyan-500 lg:mb-12">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white shadow-sm lg:h-16 lg:w-16">
                <FileText className="h-7 w-7 lg:h-8 lg:w-8" />
              </span>
              <h2 className="shrink-0 text-2xl font-bold lg:text-4xl">
                ข่าวกิจกรรม
              </h2>
              <span className="h-1 flex-1 rounded-full bg-cyan-500" aria-hidden="true" />
            </div>
            <div
              ref={activityCarouselRef}
              onScroll={(event) => {
                if (window.innerWidth >= 768) return;
                const carousel = event.currentTarget;
                if (!carousel.clientWidth) return;
                setActivityIndex(
                  Math.min(
                    visibleActivityNews.length - 1,
                    Math.max(0, Math.round(carousel.scrollLeft / carousel.clientWidth)),
                  ),
                );
              }}
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-2 md:gap-6 md:overflow-visible lg:grid-cols-4"
            >
              {visibleActivityNews.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedSlide(item)}
                  className="group w-full shrink-0 snap-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg md:w-auto md:min-w-0"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-slate-200">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Bell className="h-10 w-10 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-h-[12rem] flex-col p-4 lg:min-h-[13rem] lg:p-5">
                    <h3 className="line-clamp-2 text-lg font-black leading-snug text-slate-950 group-hover:text-cyan-600 lg:text-xl">
                      {item.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500 lg:text-base">
                      {item.content || "คลิกเพื่ออ่านรายละเอียดข่าวและกิจกรรม"}
                    </p>
                    <span className="mt-2 text-sm font-bold text-cyan-600 transition group-hover:text-cyan-700">
                      อ่านเพิ่มเติม
                    </span>
                    <div className="mt-auto border-t border-slate-100 pt-3 text-sm text-slate-500">
                      {formatThaiDateTime(item.date)} น.
                    </div>
                  </div>
                </button>
              ))}
              {!visibleActivityNews.length && (
                <div className="py-12 text-center text-slate-500 md:col-span-2 lg:col-span-4">
                  ไม่พบข่าวที่ค้นหา
                </div>
              )}
            </div>
            {visibleActivityNews.length > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2 md:hidden">
                {visibleActivityNews.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`ดูกิจกรรม ${index + 1}`}
                    onClick={() => goToActivity(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      activityIndex === index
                        ? "w-8 bg-blue-600"
                        : "w-2.5 bg-slate-300"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
      {activityNews.length === 0 && (
        <section id="activities" className="border-y bg-white py-16">
          <div className="mx-auto w-full px-4 text-center sm:px-6 lg:px-12 xl:px-20">
            <h2 className="text-3xl font-black lg:text-4xl">
              ข่าวสารและกิจกรรม
            </h2>
            <div className="mt-8 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-slate-500 lg:mt-8 lg:min-h-[300px] lg:py-20">
              <Image className="mx-auto h-12 w-12 text-slate-300 lg:h-16 lg:w-16" />
              <div className="mt-3 font-bold lg:mt-5 lg:text-xl">ยังไม่มีภาพกิจกรรมที่เผยแพร่</div>
              <div className="mt-1 text-sm"></div>
            </div>
          </div>
        </section>
      )}

      <section className="border-y border-red-100 bg-red-50/60 py-12 lg:py-16">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="mb-8 flex items-center gap-4 text-red-600 lg:mb-10">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm lg:h-16 lg:w-16">
              <Video className="h-7 w-7 fill-current lg:h-8 lg:w-8" />
            </span>
            <h2 className="shrink-0 text-2xl font-bold text-slate-800 lg:text-4xl">
              วิดีโอประชาสัมพันธ์
            </h2>
            <span className="h-1 flex-1 rounded-full bg-red-600" aria-hidden="true" />
          </div>

          {promoItems.length ? (
            <div className="relative">
              <div
                ref={videoCarouselRef}
                className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-6"
              >
                {promoItems.map((item) => (
                  <article
                    key={item.id}
                    className="w-[86%] shrink-0 snap-start sm:w-[48%] lg:w-[calc((100%_-_3rem)/3)]"
                  >
                    <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-md">
                      {item.playableUrl.includes("youtube.com/embed") ? (
                        <iframe
                          src={item.playableUrl}
                          title={item.title || "วิดีโอประชาสัมพันธ์"}
                          className="h-full w-full"
                          style={{ width: "100%", height: "100%" }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video
                          src={item.playableUrl}
                          poster={item.image || undefined}
                          controls
                          className="h-full w-full bg-black object-contain"
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      )}
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-center text-lg font-bold text-slate-800 lg:text-xl">
                      {item.title || "วิดีโอประชาสัมพันธ์"}
                    </h3>
                  </article>
                ))}
              </div>

              {promoItems.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => scrollVideoCarousel(-1)}
                    aria-label="เลื่อนวิดีโอไปทางซ้าย"
                    className="absolute left-1 top-[40%] z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/75 text-white shadow-lg backdrop-blur hover:bg-slate-950 lg:-left-6 lg:h-14 lg:w-14"
                  >
                    <ChevronRight className="h-7 w-7 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollVideoCarousel(1)}
                    aria-label="เลื่อนวิดีโอไปทางขวา"
                    className="absolute right-1 top-[40%] z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/75 text-white shadow-lg backdrop-blur hover:bg-slate-950 lg:-right-6 lg:h-14 lg:w-14"
                  >
                    <ChevronRight className="h-7 w-7" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-red-200 bg-white py-16 text-center text-slate-500">
              <Video className="mx-auto h-12 w-12 text-red-300" />
              <div className="mt-4 text-xl font-black text-slate-700">ยังไม่มีวิดีโอ</div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-slate-50 py-14">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="mb-6">
            <div className="text-sm font-black text-blue-600">
              แผนที่พื้นที่ให้บริการ
            </div>
            <h2 className="mt-1 text-3xl font-black lg:text-5xl">
              ตำบลมะต้อง อำเภอพรหมพิราม
            </h2>
            <p className="mt-2 text-slate-500 lg:text-xl">แสดงที่ตั้งและพื้นที่ให้บริการขององค์การบริหารส่วนตำบลมะต้อง</p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="h-[360px] sm:h-[460px]">
              <MapContainer
                center={[17.07948, 100.1799]}
                zoom={13}
                scrollWheelZoom={false}
                className="h-full w-full"
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <CircleMarker
                  center={[17.07948, 100.1799]}
                  radius={12}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 4,
                    fillColor: "#2563eb",
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <div className="font-sans">
                      <b>ตำบลมะต้อง</b>
                      <br />
                      อำเภอพรหมพิราม จังหวัดพิษณุโลก
                    </div>
                  </Popup>
                </CircleMarker>
              </MapContainer>
            </div>
            <div className="flex flex-col gap-3 border-t p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-black text-slate-900">
                  องค์การบริหารส่วนตำบลมะต้อง
                </div>
                <div className="text-sm text-slate-500">
                  หมู่ที่ 3 ตำบลมะต้อง อำเภอพรหมพิราม จังหวัดพิษณุโลก
                </div>
              </div>
              <a
                href="https://www.google.com/maps/search/?api=1&query=%E0%B8%AD%E0%B8%87%E0%B8%84%E0%B9%8C%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%9A%E0%B8%A3%E0%B8%B4%E0%B8%AB%E0%B8%B2%E0%B8%A3%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%95%E0%B8%B3%E0%B8%9A%E0%B8%A5%E0%B8%A1%E0%B8%B0%E0%B8%95%E0%B9%89%E0%B8%AD%E0%B8%87"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
              >
                <MapPin className="h-4 w-4" />
                เปิดเส้นทางใน Google Maps
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="bg-gray-900 py-16 text-white lg:py-20">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <div className="mb-6 flex items-center gap-3 text-2xl font-bold lg:text-3xl">
                <AppLogo className="h-11 w-11 lg:h-16 lg:w-16" />
                {APP_NAME}
              </div>
              <p className="max-w-xs text-gray-400 lg:max-w-lg lg:text-lg lg:leading-8">
                ชุมชนน่าอยู่ ปลอดภัย สังคมแห่งการแบ่งปัน ร่วมสร้าง{VILLAGE_NAME}
                ให้ดียิ่งขึ้นไปพร้อมกัน
              </p>
            </div>
            <div>
              <h4 className="mb-6 text-lg font-bold lg:text-2xl">
                ข้อมูลติดต่อ
              </h4>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-400 lg:text-lg">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800">
                    <Phone className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 lg:text-base">
                      เบอร์โทรศัพท์
                    </p>
                    <p className="font-semibold text-white">
                      055-009-758
                    </p>
                  </div>
                </li>
                <li className="flex items-center gap-3 text-gray-400 lg:text-lg">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800">
                    <Facebook className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 lg:text-base">Facebook Page</p>
                    <p className="font-semibold text-white">
                      อบต. มะต้อง
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-gray-800 pt-8 text-center text-sm text-gray-500 lg:text-base">
            © {new Date().getFullYear()} {APP_NAME}
          </div>
        </div>
      </footer>
      {selectedSlide && (
        <NewsModal
          news={selectedSlide}
          onClose={() => setSelectedSlide(null)}
          onPrevious={
            visibleActivityNews.length > 1
              ? () => {
                  const index = visibleActivityNews.findIndex(
                    (item) => item.id === selectedSlide.id,
                  );
                  setSelectedSlide(
                    visibleActivityNews[
                      (index - 1 + visibleActivityNews.length) %
                        visibleActivityNews.length
                    ],
                  );
                }
              : undefined
          }
          onNext={
            visibleActivityNews.length > 1
              ? () => {
                  const index = visibleActivityNews.findIndex(
                    (item) => item.id === selectedSlide.id,
                  );
                  setSelectedSlide(
                    visibleActivityNews[(index + 1) % visibleActivityNews.length],
                  );
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

// ==========================================
// 2. AUTH PAGE (Login / Signup)
// ==========================================
function PasswordInput({ label, className = "", ...props }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <label className="block text-sm font-bold text-slate-700 lg:text-base">
      {label}
      <div className="relative">
        <input
          {...props}
          type={isVisible ? "text" : "password"}
          className={`${className} pr-14`}
        />
        <button
          type="button"
          onClick={() => setIsVisible((visible) => !visible)}
          className="absolute inset-y-1.5 right-1.5 z-10 flex w-10 items-center justify-center rounded-lg bg-transparent text-blue-600 transition hover:bg-blue-100/60 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label={isVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          aria-pressed={isVisible}
          title={isVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        >
          {isVisible ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>
    </label>
  );
}

function AuthPage({ villages, onLogin, onRegister, onBack, initialMode = "login" }) {
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get("reset_token") || "";
  const [mode, setMode] = useState(resetToken ? "reset" : initialMode);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [reg, setReg] = useState({
    name: "",
    phone: "",
    email: "",
    villageId: "",
    password: "",
  });
  const [email, setEmail] = useState(params.get("email") || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryCooldown, setRecoveryCooldown] = useState(0);
  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 lg:mt-1.5 lg:px-4 lg:py-3 lg:text-base";
  const switchMode = (next) => {
    setMode(next);
    setMessage("");
    setError("");
  };
  const submitForgot = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await api.forgotPassword(email);
      setRecoveryCooldown(60);
      setMessage(
        "หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ให้แล้ว กรุณาตรวจกล่องจดหมายและโฟลเดอร์สแปม",
      );
    } catch (err) {
      setError(
        err?.status === 429
          ? "ขอหลายครั้งเกินไป กรุณารอ 1 นาทีแล้วลองใหม่"
          : err?.message || "ส่งอีเมลไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (recoveryCooldown <= 0) return undefined;
    const timer = window.setTimeout(
      () => setRecoveryCooldown((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [recoveryCooldown]);
  const submitReset = async (event) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmation)
      return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    setLoading(true);
    try {
      await api.resetPassword({
        token: resetToken,
        email,
        password: newPassword,
        password_confirmation: confirmation,
      });
      window.history.replaceState({}, "", window.location.pathname);
      setMode("login");
      setMessage(
        "ตั้งรหัสผ่านใหม่สำเร็จแล้ว เข้าสู่ระบบด้วยเบอร์โทรศัพท์และรหัสผ่านใหม่ได้เลย",
      );
    } catch (err) {
      setError(err?.message || "ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่");
    } finally {
      setLoading(false);
    }
  };
  const submitRegister = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const registered = await onRegister(reg);
      if (!registered) return;

      setLoginPhone(reg.phone);
      setLoginPass("");
      setReg({
        name: "",
        phone: "",
        email: "",
        villageId: "",
        password: "",
      });
      setMode("login");
      setMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };
  const pageTitle =
    mode === "register"
      ? "สมัครสมาชิกประชาชน"
      : mode === "forgot"
        ? "กู้คืนรหัสผ่าน"
        : mode === "reset"
          ? "ตั้งรหัสผ่านใหม่"
          : "เข้าสู่ระบบ";
  return (
    <div className="min-h-dvh bg-slate-100 p-3 sm:p-6 lg:p-6">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between lg:px-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-blue-700 lg:text-base"
        >
          <ChevronRight className="h-5 w-5 rotate-180" />
          กลับหน้าแรก
        </button>
        <div className="hidden text-sm text-slate-500 sm:block lg:text-base">
          องค์การบริหารส่วนตำบลมะต้อง
        </div>
      </div>
      <section
        className="mx-auto mt-3 grid min-h-[calc(100dvh-7rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-xl ring-1 ring-slate-200 lg:min-h-[680px] lg:w-[calc(100vw-4rem)] lg:max-w-[1280px] lg:grid-cols-2"
      >
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-950 p-10 text-white lg:flex lg:items-start lg:justify-start xl:p-12">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="relative flex w-full max-w-md items-center gap-6">
            <AppLogo className="h-24 w-24 shrink-0 shadow-lg xl:h-28 xl:w-28" />
            <div className="min-w-0">
              <div className="text-base font-bold leading-relaxed text-cyan-200 xl:text-lg">
                {APP_NAME}
              </div>
              <h1 className="mt-2 text-3xl font-black leading-tight xl:text-4xl">
                องค์การบริหารส่วน
                <br />
                ตำบลมะต้อง
              </h1>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center overflow-y-auto p-5 sm:p-9 lg:p-8 xl:p-10">
          <div
            className={`w-full ${mode === "register" ? "max-w-2xl" : "max-w-md"}`}
          >
            <div className="mb-7">
              <AppLogo className="mb-4 h-12 w-12 lg:hidden" />
              <p className="text-sm font-bold leading-6 text-blue-600 lg:text-base">
                {APP_NAME}
              </p>
              <h2 className="mt-1 text-3xl font-black text-slate-900 lg:text-4xl">
                {pageTitle}
              </h2>
              {mode !== "login" && (
                <p className="mt-2 text-sm leading-6 text-slate-500 lg:mt-3 lg:text-base lg:leading-7">
                  {mode === "register"
                    ? "กรอกข้อมูลจริงเพื่อสร้างบัญชีและเข้าสู่ระบบได้ทันที"
                    : "ดำเนินการตามขั้นตอนด้านล่าง"}
                </p>
              )}
            </div>
            {!["forgot", "reset"].includes(mode) && (
              <div className="mb-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1 lg:mt-6 lg:p-1.5">
                <button
                  onClick={() => switchMode("login")}
                  className={`rounded-lg px-4 py-2.5 text-sm font-bold transition lg:py-3 lg:text-lg ${mode === "login" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  เข้าสู่ระบบ
                </button>
                <button
                  onClick={() => switchMode("register")}
                  className={`rounded-lg px-4 py-2.5 text-sm font-bold transition lg:py-3 lg:text-lg ${mode === "register" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  สมัครสมาชิก
                </button>
              </div>
            )}
            {message && (
              <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm leading-6 text-green-800 lg:text-base">
                {message}
              </div>
            )}
            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700 lg:text-base">
                {error}
              </div>
            )}
            {mode === "login" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onLogin(loginPhone, loginPass);
                }}
                className="space-y-4"
              >
                <label className="block text-sm font-bold text-slate-700 lg:text-base">
                  เบอร์โทรศัพท์ / Username
                  <input
                    required
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    className={inputClass}
                    placeholder="08xxxxxxxx หรือ username"
                  />
                </label>
                <PasswordInput
                  label="รหัสผ่าน"
                  required
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-sm font-bold text-blue-600 hover:underline lg:text-base"
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </div>
                <button className="w-full rounded-xl bg-blue-600 py-3.5 text-lg font-bold text-white shadow-lg shadow-blue-200 lg:py-3.5 lg:text-lg">
                  เข้าสู่ระบบ
                </button>
              </form>
            )}
            {mode === "register" && (
              <form onSubmit={submitRegister} className="space-y-4">
                <label className="block text-sm font-bold text-slate-700 lg:text-base">
                  ชื่อ - นามสกุล
                  <input
                    required
                    value={reg.name}
                    onChange={(e) => setReg({ ...reg, name: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700 lg:text-base">
                  หมู่บ้าน
                  <select
                    required
                    value={reg.villageId}
                    onChange={(e) =>
                      setReg({ ...reg, villageId: Number(e.target.value) })
                    }
                    className={inputClass}
                  >
                    <option value="">เลือกหมู่บ้านที่อาศัยอยู่</option>
                    {(villages || []).map((village) => (
                      <option key={village.id} value={village.id}>
                        หมู่ {village.moo} {village.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-bold text-slate-700 lg:text-base">
                    เบอร์โทรศัพท์
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      required
                      minLength={10}
                      maxLength={10}
                      pattern="[0-9]{10}"
                      title="กรุณากรอกเบอร์โทรศัพท์เป็นตัวเลขให้ครบ 10 หลัก"
                      value={reg.phone}
                      onChange={(e) =>
                        setReg({
                          ...reg,
                          phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                        })
                      }
                      className={inputClass}
                      placeholder="08xxxxxxxx"
                    />
                  </label>
                </div>
                <label className="block text-sm font-bold text-slate-700 lg:text-base">
                  อีเมล
                  <input
                    type="email"
                    required
                    value={reg.email}
                    onChange={(e) => setReg({ ...reg, email: e.target.value })}
                    className={inputClass}
                    placeholder="name@example.com"
                  />
                </label>
                <PasswordInput
                  label="ตั้งรหัสผ่าน"
                  required
                  minLength="8"
                  value={reg.password}
                  onChange={(e) =>
                    setReg({ ...reg, password: e.target.value })
                  }
                  className={inputClass}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
                <button
                  disabled={loading}
                  className="w-full rounded-xl bg-green-600 py-3.5 text-lg font-bold text-white shadow-lg shadow-green-200 disabled:cursor-not-allowed disabled:opacity-60 lg:py-3.5 lg:text-lg"
                >
                  {loading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิกประชาชน"}
                </button>
              </form>
            )}
            {mode === "forgot" && (
              <form onSubmit={submitForgot} className="space-y-5">
                <div className="text-center">
                  <h2 className="text-2xl font-black">ลืมรหัสผ่าน</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500 lg:text-base lg:leading-7">
                    กรอกอีเมลกู้คืน รีเซ็ตรหัสผ่านด้วยอีเมลที่ใช้งาน
                  </p>
                </div>
                <label className="block text-sm font-bold text-slate-700 lg:text-base">
                  อีเมล
                  <input
                    autoFocus
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="name@example.com"
                  />
                </label>
                <button
                  disabled={loading || recoveryCooldown > 0}
                  className="w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "กำลังส่ง..."
                    : recoveryCooldown > 0
                      ? `ขอใหม่ได้ใน ${recoveryCooldown} วินาที`
                      : "ขอรีเซ็ตรหัสผ่าน"}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="w-full text-sm font-bold text-blue-600 lg:text-base"
                >
                  กลับหน้าเข้าสู่ระบบ
                </button>
              </form>
            )}
            {mode === "reset" && (
              <form onSubmit={submitReset} className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-3 text-center text-sm text-slate-500 lg:text-base">
                  {email}
                </div>
                <PasswordInput
                  label="รหัสผ่านใหม่"
                  autoFocus
                  required
                  minLength="8"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                />
                <PasswordInput
                  label="ยืนยันรหัสผ่านใหม่"
                  required
                  minLength="8"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className={inputClass}
                />
                <button
                  disabled={loading}
                  className="w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white disabled:opacity-50 lg:text-lg"
                >
                  {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
                </button>
              </form>
            )}
            <div className="mt-7 border-t pt-5 text-center text-xs leading-5 text-slate-400 lg:text-sm lg:leading-6">
              หากพบปัญหาการใช้งาน กรุณาติดต่อ อบต.มะต้อง
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Sidebar({
  currentUser,
  onLogout,
  activeTab,
  setActiveTab,
  isOpen,
  setIsOpen,
}) {
  const menuIcons = {
    analytics: <PieChart />,
    incident: <AlertTriangle />,
    document: <FileText />,
    home: <Home />,
    image: <Image />,
    notification: <Bell />,
    users: <Users />,
    camera: <Camera />,
    clock: <Clock />,
  };

  const menuToUse = isTaoRole(currentUser?.role)
    ? taoMenu
    : isVillageAdminRole(currentUser?.role)
      ? villageMenu
      : citizenMenu;

  return (
    <aside
      className={`app-sidebar fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(18rem,86vw)] shrink-0 flex-col overflow-hidden text-white shadow-2xl transform transition-transform duration-300 ease-in-out lg:relative lg:w-72 lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex min-h-20 shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex min-w-0 items-center">
          <AppLogo className="mr-2.5 h-10 w-10" />
          <div className="min-w-0">
            <div className="line-clamp-2 text-sm font-bold leading-5">
              {APP_NAME}
            </div>
            <div className="truncate text-xs text-slate-400">{VILLAGE_NAME}</div>
          </div>
        </div>
        <button
          className="lg:hidden text-gray-400 hover:text-white"
          onClick={() => setIsOpen(false)}
          aria-label="ปิดเมนู"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="mx-4 shrink-0 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
        <div className="text-sm text-gray-400 mb-1">ยินดีต้อนรับ,</div>
        <div className="font-bold text-blue-400 truncate text-lg">
          {currentUser?.name}
        </div>
        <div className="text-sm text-gray-500 mt-1">
          {isTaoRole(currentUser?.role)
            ? "เจ้าหน้าที่ อบต.มะต้อง"
            : isVillageAdminRole(currentUser?.role)
              ? `แอดมินหมู่ ${currentUser?.villageMoo || "-"}`
              : `ประชาชน · หมู่ ${currentUser?.villageMoo || "-"}`}
        </div>
      </div>
      <div className="hide-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-6">
        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {isTaoRole(currentUser?.role)
            ? "เมนู อบต."
            : isVillageAdminRole(currentUser?.role)
              ? "เมนูแอดมินหมู่บ้าน"
              : "เมนูประชาชน"}
        </div>
        {menuToUse.map((item) => (
          <NavItem
            key={item.id}
            icon={menuIcons[item.icon]}
            label={item.label}
            active={activeTab === item.id}
            onClick={() => setActiveTab(item.id)}
          />
        ))}
      </div>
      <div className="shrink-0 border-t border-gray-800 p-4">
        <button
          onClick={onLogout}
          className="flex items-center w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition font-bold"
        >
          <LogOut className="w-5 h-5 mr-3" /> ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center px-4 py-3.5 rounded-xl cursor-pointer transition text-left ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
    >
      <span className="w-5 h-5 mr-3">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

function Topbar({
  currentUser,
  setCurrentUser,
  onLogout,
  notifications,
  setNotifications,
  setActiveTab,
  toggleSidebar,
}) {
  const [showNotif, setShowNotif] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [accountMode, setAccountMode] = useState("email");
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [accountError, setAccountError] = useState("");
  const [emailForm, setEmailForm] = useState({
    email: currentUser?.email || "",
    currentPassword: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    password: "",
    confirmation: "",
  });
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const canManageOwnAccount = isCitizenRole(currentUser?.role);
  const ProfileControl = canManageOwnAccount ? "button" : "div";

  const markAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
  };

  const openNotification = (notification) => {
    setNotifications((items) =>
      items.map((item) =>
        item.id === notification.id ? { ...item, isRead: true } : item,
      ),
    );
    if (notification.id && !String(notification.id).startsWith("firebase-")) {
      api.markNotificationRead(notification.id).catch(() => null);
    }
    setActiveTab(getNotificationTargetTab(currentUser?.role, notification));
    setShowNotif(false);
  };

  const openAccount = () => {
    setEmailForm({ email: currentUser?.email || "", currentPassword: "" });
    setPasswordForm({ currentPassword: "", password: "", confirmation: "" });
    setAccountMessage("");
    setAccountError("");
    setShowAccount(true);
  };
  const saveRecoveryEmail = async (event) => {
    event.preventDefault();
    setAccountSaving(true);
    setAccountMessage("");
    setAccountError("");
    try {
      const data = await api.updateRecoveryEmail(
        emailForm.email,
        emailForm.currentPassword,
      );
      setCurrentUser(normalizeUser(data.user));
      setEmailForm((form) => ({ ...form, currentPassword: "" }));
      setAccountMessage("บันทึกอีเมลกู้คืนเรียบร้อยแล้ว");
    } catch (error) {
      setAccountError(error?.message || "บันทึกอีเมลไม่สำเร็จ");
    } finally {
      setAccountSaving(false);
    }
  };
  const savePassword = async (event) => {
    event.preventDefault();
    setAccountError("");
    setAccountMessage("");
    if (passwordForm.password !== passwordForm.confirmation)
      return setAccountError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
    setAccountSaving(true);
    try {
      await api.changePassword(
        passwordForm.currentPassword,
        passwordForm.password,
        passwordForm.confirmation,
      );
      setAccountMessage("เปลี่ยนรหัสผ่านสำเร็จ กำลังออกจากระบบ...");
      window.setTimeout(() => onLogout(), 900);
    } catch (error) {
      setAccountError(error?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      setAccountSaving(false);
    }
  };

  return (
    <header className="app-topbar sticky top-0 z-30 flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur-xl sm:min-h-20 sm:px-5 lg:px-7">
      <div className="flex min-w-0 items-center">
        <button
          onClick={toggleSidebar}
          className="shrink-0 p-2 mr-1 sm:mr-2 rounded-lg text-gray-600 hover:bg-gray-100 lg:hidden"
          aria-label="เปิดเมนู"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex min-w-0 items-center lg:hidden">
          <AppLogo className="mr-1.5 hidden h-7 w-7 min-[380px]:inline-flex sm:mr-2 sm:h-8 sm:w-8" />
          <span className="truncate text-sm font-bold text-gray-800 min-[380px]:text-base sm:text-lg">
            {APP_NAME}
          </span>
        </div>
        <div className="hidden min-w-0 items-center gap-3 lg:flex">
          <AppLogo className="h-11 w-11" />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold tracking-tight text-gray-800">
              {APP_NAME}
            </h2>
            <div className="truncate text-xs font-medium text-slate-500">
              {isTaoRole(currentUser?.role)
                ? `เจ้าหน้าที่ ${VILLAGE_NAME}`
                : isVillageAdminRole(currentUser?.role)
                  ? `แอดมินหมู่ ${currentUser?.villageMoo || "-"} ${currentUser?.villageName || ""}`
                  : `ประชาชน ${VILLAGE_NAME}`}
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3 md:gap-5">
        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative p-2 rounded-full hover:bg-gray-100 transition cursor-pointer"
          >
            <Bell className="w-6 h-6 text-gray-600 hover:text-blue-600 transition" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Menu */}
          {showNotif && (
            <div className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-fadeIn">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-800">การแจ้งเตือน</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-blue-600 font-medium hover:underline"
                  >
                    อ่านทั้งหมด
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    ไม่มีการแจ้งเตือนใหม่
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      type="button"
                      key={notif.id}
                      onClick={() => openNotification(notif)}
                      className={`block w-full p-4 border-b border-gray-50 text-left hover:bg-gray-50 transition cursor-pointer ${notif.isRead ? "opacity-60" : "bg-blue-50/30"}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4
                          className={`text-sm ${notif.isRead ? "font-medium text-gray-700" : "font-bold text-blue-800"}`}
                        >
                          {notif.title}
                        </h4>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {notif.desc}
                      </p>
                      <span className="text-[10px] text-gray-400 mt-2 block">
                        {notif.time}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <ProfileControl
          {...(canManageOwnAccount
            ? { type: "button", onClick: openAccount, title: "ตั้งค่าบัญชี" }
            : {})}
          className={`flex items-center gap-2 sm:gap-3 border-l pl-2 sm:pl-4 md:pl-5 text-left ${canManageOwnAccount ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-base sm:text-lg shadow-md">
            {currentUser?.name.charAt(0)}
          </div>
          <div className="hidden sm:block text-sm">
            <div className="font-bold text-gray-800">{currentUser?.name}</div>
            <div className="text-gray-500">
              {isTaoRole(currentUser?.role)
                ? "เจ้าหน้าที่ อบต."
                : isVillageAdminRole(currentUser?.role)
                  ? "แอดมินหมู่บ้าน"
                  : "ประชาชน"}
            </div>
          </div>
        </ProfileControl>
      </div>
      {canManageOwnAccount && showAccount && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"
          onMouseDown={() => !accountSaving && setShowAccount(false)}
        >
          <section
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                  <Settings className="h-6 w-6 text-blue-600" /> ตั้งค่าบัญชี
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {currentUser?.name} · เข้าสู่ระบบด้วย {currentUser?.phone}
                </p>
              </div>
              <button
                onClick={() => setShowAccount(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => {
                  setAccountMode("email");
                  setAccountError("");
                  setAccountMessage("");
                }}
                className={`rounded-lg px-3 py-2.5 text-sm font-bold ${accountMode === "email" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
              >
                อีเมลกู้คืน
              </button>
              <button
                onClick={() => {
                  setAccountMode("password");
                  setAccountError("");
                  setAccountMessage("");
                }}
                className={`rounded-lg px-3 py-2.5 text-sm font-bold ${accountMode === "password" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
              >
                เปลี่ยนรหัสผ่าน
              </button>
            </div>
            {accountMessage && (
              <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {accountMessage}
              </div>
            )}
            {accountError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {accountError}
              </div>
            )}
            {accountMode === "email" ? (
              <form onSubmit={saveRecoveryEmail} className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">
                  อีเมลกู้คืน
                  <input
                    type="email"
                    required
                    value={emailForm.email}
                    onChange={(event) =>
                      setEmailForm({ ...emailForm, email: event.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="name@example.com"
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  รหัสผ่านปัจจุบัน
                  <input
                    type="password"
                    required
                    value={emailForm.currentPassword}
                    onChange={(event) =>
                      setEmailForm({
                        ...emailForm,
                        currentPassword: event.target.value,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <button
                  disabled={accountSaving}
                  className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white disabled:opacity-50"
                >
                  {accountSaving ? "กำลังบันทึก..." : "บันทึกอีเมลกู้คืน"}
                </button>
              </form>
            ) : (
              <form onSubmit={savePassword} className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">
                  รหัสผ่านปัจจุบัน
                  <input
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        currentPassword: event.target.value,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  รหัสผ่านใหม่
                  <input
                    type="password"
                    required
                    minLength="8"
                    value={passwordForm.password}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        password: event.target.value,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  ยืนยันรหัสผ่านใหม่
                  <input
                    type="password"
                    required
                    minLength="8"
                    value={passwordForm.confirmation}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirmation: event.target.value,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  หลังเปลี่ยนรหัส ระบบจะออกจากระบบทุกอุปกรณ์เพื่อความปลอดภัย
                </div>
                <button
                  disabled={accountSaving}
                  className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white disabled:opacity-50"
                >
                  {accountSaving ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </header>
  );
}

// ==========================================
// 3. USER DASHBOARD
// ==========================================
function UserDashboard({
  activeTab,
  setActiveTab,
  isSidebarOpen,
  currentUser,
  news,
  incidents,
  setIncidents,
}) {
  // Modals Data
  const [selectedNews, setSelectedNews] = useState(null);
  const [selectedIncidentImage, setSelectedIncidentImage] = useState(null);

  // Report Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [desc, setDesc] = useState("");
  const [location, setLocation] = useState("");
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [showImageSource, setShowImageSource] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [historyStatus, setHistoryStatus] = useState("all");
  const [villageIncidentStatus, setVillageIncidentStatus] = useState("active");
  const [villageIncidentSearch, setVillageIncidentSearch] = useState("");
  const [supportingIncidentId, setSupportingIncidentId] = useState(null);
  const [supportConfirmationId, setSupportConfirmationId] = useState(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const reportSubmitLock = useRef(false);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("รูปภาพต้องมีขนาดไม่เกิน 10MB");
      event.target.value = "";
      return;
    }
    if (image) URL.revokeObjectURL(image);
    setImageFile(file);
    setImage(URL.createObjectURL(file));
    setShowImageSource(false);
    event.target.value = "";
  };

  const submitReport = async (e) => {
    e.preventDefault();
    if (reportSubmitLock.current) return;
    if (!title || !desc || !location || !selectedPoint)
      return alert("กรุณากรอกข้อมูลและปักหมุดตำแหน่งให้ครบถ้วน");

    reportSubmitLock.current = true;
    setReportSubmitting(true);

    const incidentPayload = {
      id: "i" + Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      title,
      category,
      description: desc,
      location,
      lat: selectedPoint.lat,
      lng: selectedPoint.lng,
      image: image || null,
      status: "pending",
      date: new Date().toISOString(),
      firstResponseAt: null,
      resolvedAt: null,
      resolvedImage: null,
    };

    let newIncident = incidentPayload;

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("category", category);
      formData.append("description", desc);
      formData.append("location", location);
      formData.append("lat", selectedPoint.lat);
      formData.append("lng", selectedPoint.lng);
      if (imageFile) formData.append("image", imageFile);
      const data = await api.createIncident(formData);
      newIncident = normalizeIncident(data.incident);
    } catch (error) {
      if (!USE_MOCK_DATA) {
        alert(error?.message || "บันทึกการแจ้งเหตุไม่สำเร็จ");
        reportSubmitLock.current = false;
        setReportSubmitting(false);
        return;
      }
      newIncident = incidentPayload;
    }

    setIncidents((items) => [
      newIncident,
      ...items.filter((item) => String(item.id) !== String(newIncident.id)),
    ]);
    alert(`แจ้งเหตุสำเร็จ ระบบได้ส่งเรื่องให้ผู้ดูแล${VILLAGE_NAME}แล้ว`);

    // Reset form & go to history
    if (image) URL.revokeObjectURL(image);
    setTitle("");
    setCategory(CATEGORIES[0]);
    setDesc("");
    setLocation("");
    setImage(null);
    setImageFile(null);
    setSelectedPoint(null);
    setActiveTab("history");
    reportSubmitLock.current = false;
    setReportSubmitting(false);
  };

  const handleDeleteIncident = async (id) => {
    if (
      window.confirm(
        "คุณต้องการยกเลิกการแจ้งเหตุนี้ใช่หรือไม่? (ลบได้เฉพาะรายการที่ยังไม่ดำเนินการ)",
      )
    ) {
      try {
        await api.deleteIncident(id);
      } catch (error) {
        if (!USE_MOCK_DATA) {
          alert(error?.message || "ยกเลิกรายการไม่สำเร็จ");
          return;
        }
      }
      setIncidents(incidents.filter((i) => i.id !== id));
    }
  };

  const supportVillageIncident = async (incident) => {
    if (incident.supportedByMe || incident.userId === currentUser.id) return;
    setSupportingIncidentId(incident.id);
    try {
      const result = await api.supportIncident(incident.id);
      setIncidents((items) =>
        items.map((item) =>
          String(item.id) === String(incident.id)
            ? {
                ...item,
                supporterCount: Number(
                  result?.supporter_count ?? item.supporterCount + 1,
                ),
                supportedByMe: true,
              }
            : item,
        ),
      );
      setSupportConfirmationId(incident.id);
    } catch (error) {
      if (!USE_MOCK_DATA) {
        alert(error?.message || "ติดตามเหตุนี้ไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      setIncidents((items) =>
        items.map((item) =>
          String(item.id) === String(incident.id)
            ? {
                ...item,
                supporterCount: Number(item.supporterCount || 0) + 1,
                supportedByMe: true,
              }
            : item,
        ),
      );
      setSupportConfirmationId(incident.id);
    } finally {
      setSupportingIncidentId(null);
    }
  };

  const rawMyIncidents = incidents.filter((i) => i.userId === currentUser.id);
  const incidentStatusRank = {
    cancelled: 0,
    pending: 1,
    in_progress: 2,
    waiting_review: 3,
    revision_requested: 3,
    resolved: 4,
  };
  const duplicateWindowMs = 2 * 60 * 60 * 1000;
  const myIncidents = rawMyIncidents
    .reduce((visible, incident) => {
      const signature = [
        incident.title,
        incident.category,
        incident.description,
        incident.location,
      ].map((value) => String(value || "").trim().toLocaleLowerCase("th-TH")).join("|");
      const incidentTime = new Date(incident.date).getTime();
      const duplicateIndex = visible.findIndex((existing) => {
        if (existing._signature !== signature) return false;
        const existingTime = new Date(existing.date).getTime();
        return Number.isFinite(incidentTime) && Number.isFinite(existingTime)
          && Math.abs(incidentTime - existingTime) <= duplicateWindowMs;
      });

      if (duplicateIndex === -1) {
        visible.push({ ...incident, _signature: signature });
        return visible;
      }

      const existing = visible[duplicateIndex];
      const existingRank = incidentStatusRank[existing.status] ?? 0;
      const incidentRank = incidentStatusRank[incident.status] ?? 0;
      if (incidentRank > existingRank || (incidentRank === existingRank && incidentTime > new Date(existing.date).getTime())) {
        visible[duplicateIndex] = { ...incident, _signature: signature };
      }
      return visible;
    }, [])
    .map(({ _signature, ...incident }) => incident)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const historyFilters = [
    { id: "all", label: "ทั้งหมด", count: myIncidents.length },
    {
      id: "pending",
      label: "รอรับเรื่อง",
      count: myIncidents.filter((incident) => incident.status === "pending").length,
    },
    {
      id: "in_progress",
      label: "กำลังดำเนินการ",
      count: myIncidents.filter((incident) => incident.status === "in_progress").length,
    },
    {
      id: "resolved",
      label: "แก้ไขเสร็จ",
      count: myIncidents.filter((incident) => incident.status === "resolved").length,
    },
  ];
  const filteredMyIncidents = historyStatus === "all"
    ? myIncidents
    : myIncidents.filter((incident) => incident.status === historyStatus);
  const activeIncidentCount = myIncidents.filter(
    (incident) => !["resolved", "rejected", "cancelled"].includes(incident.status),
  ).length;
  const villageNews = news.filter(
    (item) =>
      String(item.villageId || "") === String(currentUser.villageId || ""),
  ).sort((a, b) => new Date(b.date) - new Date(a.date));
  const citizenVillageLabel = currentUser.villageMoo
    ? `หมู่ ${currentUser.villageMoo} ${currentUser.villageName || ""}`
    : "หมู่บ้านของคุณ";
  const villageIncidents = incidents
    .filter(
      (incident) =>
        String(incident.villageId || "") === String(currentUser.villageId || "") &&
        incident.status !== "cancelled",
    )
    .filter((incident) =>
      villageIncidentStatus === "all"
        ? true
        : villageIncidentStatus === "resolved"
          ? incident.status === "resolved"
          : incident.status !== "resolved",
    )
    .filter((incident) => {
      const query = villageIncidentSearch.trim().toLocaleLowerCase("th-TH");
      if (!query) return true;
      return [incident.title, incident.category, incident.location]
        .some((value) => String(value || "").toLocaleLowerCase("th-TH").includes(query));
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="citizen-dashboard mx-auto max-w-4xl space-y-4 pb-24 sm:space-y-6 lg:pb-0">

      {/* VIEW: NEWS */}
      {activeTab === "news" && (
        <div className="space-y-5 animate-fadeIn">
          <section className="rounded-3xl bg-gradient-to-r from-slate-950 to-blue-950 p-5 text-white shadow-lg sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-blue-200">ข่าวที่เกี่ยวข้องกับพื้นที่ของคุณ</p>
                <h2 className="mt-1 text-2xl font-black sm:text-3xl">ข่าวสารและประกาศ</h2>
                <p className="mt-2 text-sm text-slate-300">จาก{citizenVillageLabel} </p>
              </div>
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10"><Bell className="h-7 w-7" /></span>
            </div>
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            {villageNews.map((n) => (
              <article
                key={n.id}
                onClick={() => setSelectedNews(n)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
              >
                <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                  {n.image ? <img src={n.image} alt={n.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-slate-300"><Image className="h-12 w-12" /></div>}
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Calendar className="h-4 w-4" />{formatThaiDateTime(n.date)} น.</div>
                  <h3 className="mt-3 line-clamp-2 text-xl font-black leading-snug text-slate-900 transition group-hover:text-blue-700">{n.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{n.content}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-bold text-blue-700"><span>อ่านรายละเอียด</span><ChevronRight className="h-5 w-5 transition group-hover:translate-x-1" /></div>
                </div>
              </article>
            ))}
            {villageNews.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                <Bell className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <h3 className="font-bold text-slate-700">
                  ยังไม่มีข่าวสารจาก{citizenVillageLabel}
                </h3>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: VILLAGE INCIDENTS */}
      {activeTab === "village_incidents" && (
        <div className="space-y-4 animate-fadeIn sm:space-y-5">
          <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-5 text-white sm:p-7">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:h-12 sm:w-12">
                  <AlertTriangle className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-blue-100 sm:text-sm">{citizenVillageLabel}</p>
                  <h2 className="mt-0.5 text-2xl font-black sm:text-3xl">เหตุในหมู่บ้าน</h2>
                  <p className="mt-2 text-sm leading-6 text-blue-100">
                    ดูก่อนแจ้ง หากเป็นเหตุเดียวกันกด “พบปัญหานี้ด้วย” ได้เลย
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-100 bg-white px-2 py-3 text-center">
              <div>
                <div className="text-xl font-black text-blue-700">
                  {incidents.filter((item) => String(item.villageId || "") === String(currentUser.villageId || "") && !["resolved", "cancelled"].includes(item.status)).length}
                </div>
                <div className="text-xs font-bold text-slate-500">กำลังดำเนินการ</div>
              </div>
              <div>
                <div className="text-xl font-black text-emerald-600">
                  {incidents.filter((item) => String(item.villageId || "") === String(currentUser.villageId || "") && item.status === "resolved").length}
                </div>
                <div className="text-xs font-bold text-slate-500">แก้ไขแล้ว</div>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={villageIncidentSearch}
                onChange={(event) => setVillageIncidentSearch(event.target.value)}
                placeholder="ค้นหาชื่อเหตุ หมวดหมู่ หรือบริเวณ"
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-base outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {[["active", "กำลังแก้"], ["resolved", "แก้แล้ว"], ["all", "ทั้งหมด"]].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVillageIncidentStatus(id)}
                  className={`min-h-10 rounded-lg px-2 text-sm font-bold transition ${villageIncidentStatus === id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {villageIncidents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center shadow-sm">
              <Search className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-lg font-black text-slate-700">ไม่พบเหตุที่ค้นหา</h3>
              <p className="mt-1 text-sm text-slate-500">ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {villageIncidents.map((incident) => {
                const isOwn = incident.userId === currentUser.id || incident.isOwn;
                const affectedCount = 1 + Number(incident.supporterCount || 0);
                return (
                  <article key={incident.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md sm:flex sm:min-h-[300px]">
                    <button
                      type="button"
                      disabled={!incident.image}
                      onClick={() => incident.image && setSelectedIncidentImage({ src: incident.image, title: incident.title })}
                      className="relative block h-48 w-full shrink-0 overflow-hidden bg-slate-100 text-left sm:h-full sm:w-56 lg:w-64"
                    >
                      {incident.image ? (
                        <img src={incident.image} alt={incident.title} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full min-h-36 flex-col items-center justify-center gap-2 text-sm text-slate-400">
                          <Camera className="h-9 w-9" /> ไม่มีรูปประกอบ
                        </span>
                      )}
                      <span className="absolute left-3 top-3"><StatusBadge status={incident.status} /></span>
                    </button>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-black text-blue-600">{incident.category}</div>
                          <h3 className="mt-1 line-clamp-2 text-lg font-black leading-snug text-slate-900 sm:text-xl">{incident.title}</h3>
                        </div>
                        {isOwn && <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">ของคุณ</span>}
                      </div>
                      <p className="mt-2 line-clamp-2 shrink-0 text-sm leading-6 text-slate-500">{incident.description}</p>
                      <div className="mt-3 grid gap-1.5 text-sm text-slate-500 sm:grid-cols-2">
                        <span className="flex min-w-0 items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{incident.location}</span></span>
                        <span className="flex items-center gap-1.5 sm:justify-end"><Clock className="h-4 w-4 shrink-0" />{formatThaiDateTime(incident.date)} น.</span>
                      </div>
                      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:mt-auto sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm font-bold text-slate-600"><Users className="mr-1 inline h-4 w-4" />พบปัญหานี้ {affectedCount} คน</span>
                        <button
                          type="button"
                          disabled={isOwn || incident.supportedByMe || supportingIncidentId === incident.id}
                          onClick={() => supportVillageIncident(incident)}
                          className="min-h-11 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500 sm:w-auto"
                        >
                          {isOwn ? "เรื่องที่คุณแจ้ง" : incident.supportedByMe ? "บันทึกว่าพบเหตุแล้ว" : supportingIncidentId === incident.id ? "กำลังส่งข้อมูล..." : "ฉันพบปัญหานี้ด้วย"}
                        </button>
                      </div>
                      {!isOwn && incident.supportedByMe && (
                        <div className={`mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5 ${String(supportConfirmationId) === String(incident.id) ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                          <span className="font-black">บันทึกข้อมูลแล้ว</span> ระบบรวมคุณไว้กับเรื่องนี้ ส่งจำนวนผู้พบปัญหาให้ผู้ดูแลหมู่บ้าน และจะแจ้งเตือนคุณเมื่อมีการเปลี่ยนสถานะ โดยไม่สร้างเรื่องร้องเรียนซ้ำ
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <button type="button" onClick={() => setActiveTab("report")} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-600 bg-white px-5 py-3 font-black text-blue-700 shadow-sm hover:bg-blue-50">
            <Plus className="h-5 w-5" /> ไม่พบเหตุที่ต้องการ แจ้งเหตุใหม่
          </button>
          <p className="px-3 text-center text-xs leading-5 text-slate-400">ไม่แสดงชื่อหรือเบอร์โทรศัพท์ของผู้แจ้ง</p>
        </div>
      )}

      {/* VIEW: REPORT */}
      {activeTab === "report" && (
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100 p-4 sm:p-6 md:p-8 animate-fadeIn">
          <div className="flex items-center justify-between mb-6 sm:mb-8 border-b border-gray-100 pb-4 sm:pb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                <AlertTriangle className="shrink-0 text-red-500 w-6 sm:w-8 h-6 sm:h-8" />{" "}
                แจ้งเหตุ / ร้องเรียน
              </h2>
              <p className="text-gray-500 mt-2">
                ระบุรายละเอียดปัญหาที่พบ เพื่อให้ผู้ดูแลรับทราบและดำเนินการแก้ไข
              </p>
            </div>
          </div>

          <form onSubmit={submitReport} className="space-y-5 sm:space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    หัวข้อเรื่อง (สั้นๆ) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition text-lg"
                    placeholder="เช่น ไฟถนนดับ, ท่อแตก, มีงูเข้าบ้าน"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    หมวดหมู่ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition text-lg cursor-pointer"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    สถานที่เกิดเหตุ/จุดสังเกต{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition text-lg"
                      placeholder="เช่น หน้าบ้าน 99/10, เสาไฟฟ้าต้นที่ 3 ซอย 2"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    ระบุตำแหน่งใน {VILLAGE_NAME}{" "}
                    แล้วปักหมุดบนแผนที่ด้านขวาเพื่อบันทึกพิกัด GPS
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    รายละเอียดเพิ่มเติม <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition text-lg h-32 resize-none"
                    placeholder="อธิบายลักษณะปัญหาที่พบเจอ..."
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    ปักหมุดตำแหน่งบนแผนที่{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <MapErrorBoundary>
                    <RealVillageMapPicker
                      incidents={incidents}
                      selectedPoint={selectedPoint}
                      onSelectPoint={setSelectedPoint}
                    />
                  </MapErrorBoundary>
                  <div className="mt-3 text-sm text-gray-600">
                    {selectedPoint ? (
                      <span>
                        พิกัดที่เลือก:{" "}
                        <span className="font-bold text-gray-900">
                          {selectedPoint.lat.toFixed(6)},{" "}
                          {selectedPoint.lng.toFixed(6)}
                        </span>
                      </span>
                    ) : (
                      <span>คลิกบนแผนที่เพื่อเลือกตำแหน่งเกิดเหตุจริง</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    แนบรูปภาพประกอบ (ถ้ามี)
                  </label>
                  <button type="button" onClick={() => setShowImageSource(true)} className="group relative mt-1 flex h-40 w-full cursor-pointer justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 pb-6 pt-5 transition hover:bg-blue-50">
                    {image ? (
                      <div className="absolute inset-0 w-full h-full">
                        <img
                          src={image}
                          alt="preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                          <span className="flex items-center gap-2 font-bold text-white">
                            <Camera className="h-5 w-5" /> ถ่ายหรือเลือกรูปใหม่
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-center flex flex-col items-center justify-center h-full">
                        <Camera className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="text-sm text-gray-600">
                          <span className="font-bold text-blue-600">อัปโหลดรูปภาพ</span>{" "}
                          หรือกดเพื่อเปิดกล้อง
                        </div>
                        <p className="text-xs text-gray-500">
                          PNG, JPG ไม่เกิน 10MB
                        </p>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5 sm:flex sm:justify-end sm:pt-6">
              <button
                type="submit"
                disabled={reportSubmitting}
                className="w-full sm:w-auto bg-blue-600 text-white px-6 sm:px-10 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60"
              >
                <CheckCircle className="w-6 h-6" />
                {reportSubmitting ? "กำลังส่ง กรุณารอ..." : "ยืนยันการแจ้งเหตุ"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW: HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              ประวัติการแจ้งเหตุของคุณ
            </h2>
          </div>

          {myIncidents.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:flex" role="tablist" aria-label="กรองประวัติการแจ้งเหตุ">
                {historyFilters.map((filter) => {
                  const active = historyStatus === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setHistoryStatus(filter.id)}
                      className={`flex min-h-12 w-full items-center justify-between gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-bold transition sm:w-auto sm:rounded-full sm:px-4 ${
                        active
                          ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-100"
                          : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600"
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {filter.count}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}

          {myIncidents.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-12 h-12 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                ยังไม่มีประวัติการแจ้งเหตุ
              </h3>
              <p className="text-gray-500">
                คุณยังไม่เคยส่งเรื่องร้องเรียนใดๆ เข้ามาในระบบ
              </p>
              <button
                onClick={() => setActiveTab("report")}
                className="mt-6 text-blue-600 font-bold hover:underline"
              >
                ไปที่หน้าแจ้งเหตุ
              </button>
            </div>
          ) : filteredMyIncidents.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center shadow-sm">
              <FileText className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-bold text-slate-700">ไม่มีรายการในสถานะนี้</p>
              <button
                type="button"
                onClick={() => setHistoryStatus("all")}
                className="mt-3 font-bold text-blue-600"
              >
                ล้างตัวกรองและดูทั้งหมด
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredMyIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col md:flex-row gap-5 hover:shadow-md transition"
                >
                  <div className="md:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <StatusBadge status={inc.status} />
                        <h3 className="mt-3 text-lg font-black text-gray-900">{inc.title}</h3>
                        <p className="mt-1 text-sm font-medium text-blue-600">{inc.category}</p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          เลขที่เรื่อง {inc.referenceNo || `#${inc.id}`}
                        </p>
                      </div>
                      {inc.status === "pending" && (
                        <button onClick={() => handleDeleteIncident(inc.id)} className="shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-50" title="ยกเลิกการแจ้งเหตุ (ลบ)">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-600">{inc.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      inc.image &&
                      setSelectedIncidentImage({
                        src: inc.image,
                        title: `รูปก่อนแก้ไข: ${inc.title}`,
                      })
                    }
                    className="w-full md:w-48 h-32 rounded-xl overflow-hidden shrink-0 relative bg-gray-100 text-left"
                    disabled={!inc.image}
                    title={
                      inc.image
                        ? "กดเพื่อดูรูปก่อนแก้ไขขนาดใหญ่"
                        : "รายการนี้ไม่มีรูปประกอบ"
                    }
                  >
                    {inc.image ? (
                      <img
                        src={inc.image}
                        alt={`รูปก่อนแก้ไข ${inc.title}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
                        <Camera className="w-8 h-8" />
                        ไม่มีรูปก่อนแก้ไข
                      </span>
                    )}
                    <div className="absolute top-2 left-2 hidden md:block">
                      <StatusBadge status={inc.status} />
                    </div>
                    {inc.image && (
                      <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/65 text-white text-xs font-bold rounded-lg">
                        กดดูรูป
                      </span>
                    )}
                  </button>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="hidden justify-between items-start md:flex">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {inc.title}
                        </h3>
                        {inc.status === "pending" && (
                          <button
                            onClick={() => handleDeleteIncident(inc.id)}
                            className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                            title="ยกเลิกการแจ้งเหตุ (ลบ)"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <p className="mb-2 hidden text-sm font-medium text-blue-600 md:block">
                        {inc.category}
                      </p>
                      <p className="mb-2 hidden text-xs font-bold text-slate-400 md:block">
                        เลขที่เรื่อง {inc.referenceNo || `#${inc.id}`}
                      </p>
                      <p className="hidden text-sm text-gray-600 line-clamp-2 md:block">
                        {inc.description}
                      </p>
                    </div>
                    {inc.status === "resolved" && inc.resolvedImage && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedIncidentImage({
                            src: inc.resolvedImage,
                            title: `รูปหลังแก้ไข: ${inc.title}`,
                          })
                        }
                        className="mt-4 inline-flex w-fit items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl font-bold text-sm hover:bg-green-100 transition"
                      >
                        <Camera className="w-4 h-4" /> ดูรูปหลังแก้ไข /
                        ซ่อมเสร็จ
                      </button>
                    )}
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" /> {inc.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" /> แจ้งเมื่อ{" "}
                        {formatThaiDateTime(inc.date)} น.
                      </span>
                      {inc.resolvedAt && (
                        <span className="flex items-center gap-1 text-green-700">
                          <CheckCircle className="w-4 h-4" /> เสร็จเมื่อ{" "}
                          {formatThaiDateTime(inc.resolvedAt)} น.
                        </span>
                      )}
                    </div>
                    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      {(() => {
                        const currentStep = inc.status === "resolved"
                          ? 4
                          : ["in_progress", "waiting_review", "revision_requested"].includes(inc.status)
                            ? 3
                            : inc.status === "assigned" || inc.requiresTao
                              ? 2
                              : 1;
                        const currentMessage = inc.status === "resolved"
                          ? "ดำเนินการเสร็จแล้ว คุณสามารถตรวจสอบผลและประเมินการแก้ไขได้"
                          : inc.status === "waiting_review"
                            ? "เจ้าหน้าที่ดำเนินการแล้ว กำลังรอตรวจรับผล"
                            : inc.status === "revision_requested"
                              ? "ผลการแก้ไขถูกส่งกลับให้เจ้าหน้าที่ดำเนินการเพิ่มเติม"
                              : inc.status === "in_progress"
                                ? `${inc.department || "หน่วยงานที่รับผิดชอบ"}กำลังดำเนินการแก้ไข`
                                : inc.requiresTao
                                  ? "หมู่บ้านตรวจสอบและส่งเรื่องให้ อบต. แล้ว"
                                  : "ระบบรับเรื่องแล้ว กำลังรอผู้ดูแลหมู่บ้านตรวจสอบ";
                        const events = [
                          ...(inc.forwardedToTaoAt ? [{
                            id: `forwarded-${inc.id}`,
                            at: inc.forwardedToTaoAt,
                            title: "หมู่บ้านส่งเรื่องให้ อบต.",
                            note: "หมู่บ้านตรวจสอบข้อมูลและส่งต่อให้ อบต.ดำเนินการแล้ว",
                          }] : []),
                          ...(inc.histories || [])
                            .filter(
                              (item) =>
                                !item.from_status ||
                                item.from_status !== item.to_status,
                            )
                            .map((item) => ({
                              id: `h-${item.id}`,
                              at: item.created_at,
                              title: getStatusLabel(item.to_status),
                              note: item.note === "Incident created" ? "ระบบได้รับเรื่องแจ้งของคุณแล้ว" : item.note,
                            })),
                          ...(inc.updates || [])
                            .filter((item) =>
                              item.type !== "village_verification" &&
                              item.type !== "info_request" &&
                              item.type !== "info_response" &&
                              !String(item.message || "").startsWith("หลักฐานยืนยันจากหมู่บ้าน:"),
                            )
                            .map((item) => ({
                            id: `u-${item.id}`,
                            at: item.created_at,
                            title: item.type === "completion" ? "ส่งผลการดำเนินงานแล้ว" : "เจ้าหน้าที่อัปเดตความคืบหน้า",
                            note: item.message,
                            image: item.image,
                            })),
                        ].sort((a, b) => new Date(b.at) - new Date(a.at));
                        return (
                          <>
                            <div className="border-b border-slate-200 bg-white p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <div className="text-xs font-black uppercase tracking-wide text-blue-600">สถานะล่าสุด</div>
                                  <div className="mt-1 font-black text-slate-900">{currentMessage}</div>
                                </div>
                                <StatusBadge status={inc.status} />
                              </div>
                              <div className="mt-5 grid grid-cols-4">
                                {["รับเรื่อง", "ส่งต่อ", "ดำเนินการ", "เสร็จสิ้น"].map((label, index) => {
                                  const number = index + 1;
                                  const active = number <= currentStep;
                                  return (
                                    <div key={label} className="min-w-0 text-center">
                                      <div className="flex items-center">
                                        <span className={`h-1 flex-1 ${index === 0 ? "bg-transparent" : active ? "bg-blue-600" : "bg-slate-200"}`} />
                                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-white text-xs font-black shadow-sm ${active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>{active && number < currentStep ? "✓" : number}</span>
                                        <span className={`h-1 flex-1 ${index === 3 ? "bg-transparent" : number < currentStep ? "bg-blue-600" : "bg-slate-200"}`} />
                                      </div>
                                      <span className={`mt-2 block truncate px-1 text-[10px] font-black sm:text-xs ${active ? "text-blue-700" : "text-slate-400"}`}>{label}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="p-4">
                              <h4 className="font-black text-slate-900">ประวัติการดำเนินงาน</h4>
                              <div className="mt-3 space-y-2">
                                {events.map((item, index) => (
                                  <div key={item.id} className="grid grid-cols-[2rem_1fr] gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${index === 0 ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700"}`}>
                                      {index === 0 ? <Clock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                                        <span className="text-sm font-black text-slate-900">{item.title}</span>
                                        <span className="text-xs text-slate-500">{formatThaiDateTime(item.at)} น.</span>
                                      </div>
                                      {item.note && <p className="mt-1 text-sm leading-6 text-slate-600">{item.note}</p>}
                                      {item.image && (
                                        <button type="button" onClick={() => setSelectedIncidentImage({ src: item.image, title: item.title })} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                                          <Camera className="h-3.5 w-3.5" /> ดูรูปความคืบหน้า
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {!events.length && <div className="rounded-xl bg-white p-4 text-sm text-slate-500">ยังไม่มีประวัติเพิ่มเติม ระบบกำลังรอผู้ดูแลรับเรื่อง</div>}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </section>
                    {inc.status === "resolved" && !inc.feedback && (
                      <CitizenFeedback
                        incident={inc}
                        onSaved={(feedback, savedIncident) =>
                          setIncidents((items) =>
                            items.map((item) =>
                              item.id === inc.id
                                ? savedIncident
                                  ? normalizeIncident(savedIncident)
                                  : { ...item, feedback }
                                : item,
                            ),
                          )
                        }
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isSidebarOpen && (
      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-2xl border border-gray-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("news")}
          className={`min-h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition ${activeTab === "news" ? "bg-blue-50 text-blue-700" : "text-gray-500"}`}
        >
          <Bell className="h-5 w-5" /> ข่าวสาร
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("village_incidents")}
          className={`min-h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition ${activeTab === "village_incidents" ? "bg-blue-50 text-blue-700" : "text-gray-500"}`}
        >
          <AlertTriangle className="h-5 w-5" /> เหตุในหมู่บ้าน
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("report")}
          className={`min-h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition ${activeTab === "report" ? "bg-blue-600 text-white shadow-md" : "text-blue-700"}`}
        >
          <Camera className="h-6 w-6" /> แจ้งเหตุ
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`relative min-h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition ${activeTab === "history" ? "bg-blue-50 text-blue-700" : "text-gray-500"}`}
        >
          {activeIncidentCount > 0 && (
            <span className="absolute right-[24%] top-1.5 min-w-5 rounded-full bg-red-500 px-1 text-[10px] leading-5 text-white">
              {activeIncidentCount > 99 ? "99+" : activeIncidentCount}
            </span>
          )}
          <Clock className="h-5 w-5" /> ติดตาม
        </button>
      </nav>
      )}

      {/* News Modal */}
      {selectedNews && (
        <NewsModal news={selectedNews} onClose={() => setSelectedNews(null)} />
      )}
      {selectedIncidentImage && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedIncidentImage(null)}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedIncidentImage(null)}
              className="absolute -top-3 -right-3 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
              aria-label="ปิดรูป"
            >
              <X className="w-6 h-6 text-gray-800" />
            </button>
            <img
              src={selectedIncidentImage.src}
              alt={selectedIncidentImage.title}
              className="w-full max-h-[78vh] object-contain bg-black rounded-2xl"
            />
            <div className="mt-3 text-center text-white font-bold text-lg">
              {selectedIncidentImage.title}
            </div>
          </div>
        </div>
      )}
      {showImageSource && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-3 sm:items-center"
          onClick={() => setShowImageSource(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <div className="font-black text-slate-900">แนบรูปภาพ</div>
                <div className="text-xs text-slate-500">เลือกวิธีนำรูปเข้าระบบ</div>
              </div>
              <button type="button" onClick={() => setShowImageSource(false)} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100" aria-label="ปิด">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-blue-600 p-4 text-center font-bold text-white active:bg-blue-700">
                <Camera className="h-7 w-7" />
                ถ่ายรูป
                <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="sr-only" />
              </label>
              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center font-bold text-blue-700 active:bg-blue-100">
                <Image className="h-7 w-7" />
                เลือกจากแกลเลอรี
                <input type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MAP COMPONENTS
// ==========================================
// ศูนย์กลางพื้นที่ให้บริการขององค์การบริหารส่วนตำบลมะต้อง
const VILLAGE_MAP_CENTER = [17.07948, 100.1799];
const VILLAGE_MAP_BOUNDS = [
  [17.02, 100.11],
  [17.16, 100.24],
];

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800">
          <div className="font-bold">ไม่สามารถเปิดแผนที่จริงได้</div>
          <div className="mt-2 text-sm break-all">
            {this.state.error.message}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MapClickHandler({ onSelectPoint }) {
  useMapEvents({
    click(event) {
      onSelectPoint({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });
  return null;
}

function CurrentLocationButton({ onSelectPoint }) {
  const map = useMap();

  const locate = (event) => {
    event.stopPropagation();
    if (!navigator.geolocation) {
      alert("อุปกรณ์นี้ไม่รองรับการค้นหาตำแหน่ง");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = {
          lat: Number(coords.latitude.toFixed(6)),
          lng: Number(coords.longitude.toFixed(6)),
        };
        map.flyTo([point.lat, point.lng], 18);
        onSelectPoint(point);
      },
      () =>
        alert(
          "ไม่สามารถอ่านตำแหน่งได้ กรุณาอนุญาต Location หรือปักหมุดด้วยตนเอง",
        ),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <button
      type="button"
      onClick={locate}
      className="absolute right-3 bottom-6 z-[1000] rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow-lg border border-blue-200 hover:bg-blue-50"
    >
      ใช้ตำแหน่งปัจจุบัน
    </button>
  );
}

function RealVillageMapPicker({ incidents, selectedPoint, onSelectPoint }) {
  return (
    <div className="relative isolate z-0 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 bg-slate-50">
        <div className="font-bold text-gray-900">
          แผนที่ตำแหน่งเหตุใน{VILLAGE_NAME}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          เลื่อนหรือซูมแผนที่ แล้วคลิกจุดเกิดเหตุเพื่อบันทึกพิกัด GPS
        </div>
      </div>
      <MapContainer
        center={VILLAGE_MAP_CENTER}
        zoom={15}
        minZoom={14}
        maxBounds={VILLAGE_MAP_BOUNDS}
        maxBoundsViscosity={1}
        scrollWheelZoom
        className="relative z-0 h-64 w-full cursor-crosshair sm:h-72"
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer name="แผนที่ถนน">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked name="ภาพถ่ายดาวเทียม">
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name="ชื่อถนนและสถานที่">
            <TileLayer
              attribution="Labels &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.Overlay>
        </LayersControl>
        <MapClickHandler onSelectPoint={onSelectPoint} />
        <CurrentLocationButton onSelectPoint={onSelectPoint} />
        {incidents
          .filter((inc) => inc.lat != null && inc.lng != null)
          .map((inc) => (
            <CircleMarker
              key={inc.id}
              center={[inc.lat, inc.lng]}
              radius={5}
              pathOptions={{ color: "#475569", fillOpacity: 0.65 }}
            >
              <Popup>{inc.title}</Popup>
            </CircleMarker>
          ))}
        {selectedPoint && (
          <CircleMarker
            center={[selectedPoint.lat, selectedPoint.lng]}
            radius={9}
            pathOptions={{
              color: "#dc2626",
              fillColor: "#ef4444",
              fillOpacity: 0.9,
            }}
          >
            <Popup>ตำแหน่งเหตุที่เลือก</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}

function VillageMapPicker({ incidents, selectedPoint, onSelectPoint }) {
  const handleMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    onSelectPoint(
      percentToLatLng(clamp(xPercent, 4, 96), clamp(yPercent, 6, 94)),
    );
  };

  return (
    <div className="rounded-3xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 bg-slate-50">
        <div className="font-bold text-gray-900">
          แผนที่ตำแหน่งเหตุใน{VILLAGE_NAME}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          คลิกบนแผนที่เพื่อปักหมุดตำแหน่งเกิดเหตุ และระบบจะเก็บพิกัด GPS
          ให้ทันที
        </div>
      </div>
      <div
        className="relative h-72 cursor-crosshair overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_32%),linear-gradient(135deg,_#eff6ff_0%,_#dbeafe_48%,_#e0f2fe_100%)]"
        onClick={handleMapClick}
      >
        <div className="absolute inset-0 opacity-50">
          <div className="absolute inset-x-0 top-[24%] h-px bg-sky-200" />
          <div className="absolute inset-x-0 top-[54%] h-px bg-sky-200" />
          <div className="absolute inset-y-0 left-[32%] w-px bg-sky-200" />
          <div className="absolute inset-y-0 left-[68%] w-px bg-sky-200" />
          <div className="absolute left-[12%] top-[22%] h-24 w-24 rounded-full bg-blue-200/35 blur-2xl" />
          <div className="absolute right-[10%] bottom-[14%] h-28 w-28 rounded-full bg-cyan-200/40 blur-2xl" />
        </div>

        <div className="absolute left-[18%] top-[18%] rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
          ทางเข้าหมู่บ้าน
        </div>
        <div className="absolute left-[60%] top-[26%] rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
          ซอย 2
        </div>
        <div className="absolute left-[56%] top-[58%] rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
          ซอย 5
        </div>
        <div className="absolute left-[24%] top-[68%] rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
          สวนสาธารณะ
        </div>

        {incidents.map((inc) => {
          const pos = latLngToPercent(inc.lat, inc.lng);
          return (
            <div
              key={inc.id}
              className="absolute -translate-x-1/2 -translate-y-full"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className="h-3 w-3 rounded-full border-2 border-white bg-slate-500 shadow-md opacity-70" />
            </div>
          );
        })}

        {selectedPoint &&
          (() => {
            const pos = latLngToPercent(selectedPoint.lat, selectedPoint.lng);
            return (
              <div
                className="absolute -translate-x-1/2 -translate-y-full"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <div className="relative">
                  <MapPin
                    className="w-8 h-8 text-red-600 drop-shadow-lg"
                    fill="currentColor"
                  />
                  <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-ping" />
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}

function FitIncidentBounds({ incidents }) {
  const map = useMap();
  const coordinateKey = incidents
    .map((item) => `${item.id}:${item.lat},${item.lng}`)
    .join("|");

  useEffect(() => {
    const points = incidents
      .filter(
        (item) =>
          Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)),
      )
      .map((item) => [Number(item.lat), Number(item.lng)]);
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 17);
      return;
    }
    map.fitBounds(points, { padding: [36, 36], maxZoom: 17 });
  }, [coordinateKey, incidents, map]);

  return null;
}

function SpatialAnalyticsMap({ incidents, lockToTao = false }) {
  const validIncidents = incidents.filter(
    (item) =>
      Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)),
  );
  const densityAt = (incident) =>
    validIncidents.filter(
      (item) =>
        Math.abs(Number(item.lat) - Number(incident.lat)) <= 0.001 &&
        Math.abs(Number(item.lng) - Number(incident.lng)) <= 0.001,
    ).length;

  return (
    <div className="relative isolate z-0 h-72 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:h-80">
      <MapContainer
        center={VILLAGE_MAP_CENTER}
        zoom={lockToTao ? 13 : 14}
        maxBounds={lockToTao ? VILLAGE_MAP_BOUNDS : undefined}
        maxBoundsViscosity={lockToTao ? 1 : 0}
        scrollWheelZoom
        className="relative z-0 h-full w-full"
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="แผนที่ถนนจริง">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="ภาพถ่ายดาวเทียม">
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name="ชื่อถนนและสถานที่">
            <TileLayer
              attribution="Labels &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.Overlay>
        </LayersControl>
        {!lockToTao && <FitIncidentBounds incidents={validIncidents} />}
        {validIncidents.map((incident) => {
          const density = densityAt(incident);
          const isClosed = ["resolved", "cancelled"].includes(incident.status);
          const color = isClosed ? "#059669" : density >= 3 ? "#dc2626" : density >= 2 ? "#f97316" : "#2563eb";
          return (
            <React.Fragment key={incident.id}>
              <CircleMarker
                center={[Number(incident.lat), Number(incident.lng)]}
                radius={Math.min(28, 12 + density * 4)}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.16, weight: 1 }}
              />
              <CircleMarker
                center={[Number(incident.lat), Number(incident.lng)]}
                radius={7}
                pathOptions={{ color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 1 }}
              >
                <Popup>
                  <div className="min-w-48 font-sans">
                    <div className="font-bold text-slate-900">{incident.title}</div>
                    <div className="mt-1 text-sm">{incident.location}</div>
                    <div className="mt-1 text-xs text-slate-500">{incident.category} · {getStatusLabel(incident.status)}</div>
                    <div className="mt-2 text-xs font-bold" style={{ color }}>
                      บริเวณใกล้เคียงมี {density} เรื่อง
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          );
        })}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-lg">
        <span className="text-red-600">●</span> เสี่ยงสูง&nbsp;&nbsp;
        <span className="text-orange-500">●</span> พบซ้ำ&nbsp;&nbsp;
        <span className="text-blue-600">●</span> งานเปิด&nbsp;&nbsp;
        <span className="text-emerald-600">●</span> ปิดแล้ว
      </div>
    </div>
  );
}

// 4. STAFF DASHBOARD
// ==========================================
function IncidentLocationPanel({ incident, compact = false }) {
  const lat = Number(incident?.lat);
  const lng = Number(incident?.lng);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(incident?.location || "")}`;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-black text-rose-600">
            <MapPin className="h-4 w-4" /> สถานที่รับแจ้งปัญหา
          </div>
          <div className="mt-1 font-black text-slate-950">{incident?.location || "ไม่ระบุสถานที่"}</div>
          <div className="mt-1 text-sm text-slate-500">
            หมู่ {incident?.villageMoo || "-"} {incident?.villageName || ""}
          </div>
        </div>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-100">
          เปิดนำทาง ↗
        </a>
      </div>
      {hasCoordinates ? (
        <div className={compact ? "h-44" : "h-56"}>
          <MapContainer center={[lat, lng]} zoom={17} scrollWheelZoom={false} className="h-full w-full" attributionControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <CircleMarker center={[lat, lng]} radius={12} pathOptions={{ color: "#ffffff", weight: 4, fillColor: "#ef4444", fillOpacity: 1 }}>
              <Popup>จุดรับแจ้งเหตุ<br />{incident?.location}</Popup>
            </CircleMarker>
          </MapContainer>
        </div>
      ) : (
        <div className="flex min-h-28 items-center justify-center bg-slate-50 p-5 text-center text-sm text-amber-700">
          เรื่องนี้ยังไม่มีพิกัดแผนที่ ควรขอหมุดจากผู้แจ้งก่อนมอบหมายงาน
        </div>
      )}
      {hasCoordinates && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
          พิกัด {lat.toFixed(6)}, {lng.toFixed(6)} · หมุดคือจุดที่ประชาชนระบุตอนแจ้งเหตุ
        </div>
      )}
    </section>
  );
}

function DecisionAnalyticsCenter({
  incidents,
  villages = [],
  scope = "village",
}) {
  const toDateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const [analysisDateFrom, setAnalysisDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 89);
    return toDateKey(date);
  });
  const [analysisDateTo, setAnalysisDateTo] = useState(() => toDateKey(new Date()));
  const [analysisVillage, setAnalysisVillage] = useState("all");
  const isTao = scope === "tao";
  const scopedIncidents = isTao && analysisVillage !== "all"
    ? incidents.filter(
        (item) => String(item.villageId || "") === String(analysisVillage),
      )
    : incidents;
  const rangeStart = analysisDateFrom ? new Date(`${analysisDateFrom}T00:00:00`) : null;
  const rangeEnd = analysisDateTo ? new Date(`${analysisDateTo}T23:59:59.999`) : null;
  const rows = scopedIncidents.filter((item) => {
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) return !rangeStart && !rangeEnd;
    return (!rangeStart || date >= rangeStart) && (!rangeEnd || date <= rangeEnd);
  });
  const rangeDuration = rangeStart && rangeEnd
    ? rangeEnd.getTime() - rangeStart.getTime() + 1
    : null;
  const previousRangeEnd = rangeStart ? new Date(rangeStart.getTime() - 1) : null;
  const previousRangeStart = rangeDuration && previousRangeEnd
    ? new Date(previousRangeEnd.getTime() - rangeDuration + 1)
    : null;
  const previousRows = previousRangeStart && previousRangeEnd
    ? scopedIncidents.filter((item) => {
        const date = new Date(item.date);
        return !Number.isNaN(date.getTime()) && date >= previousRangeStart && date <= previousRangeEnd;
      })
    : [];
  const isOpen = (item) => !["resolved", "cancelled"].includes(item.status);
  const openRows = rows.filter(isOpen);
  const resolvedRows = rows.filter((item) => item.status === "resolved");
  const overdueRows = openRows.filter(
    (item) => item.dueAt && new Date(item.dueAt) < new Date(),
  );
  const median = (values) => {
    const sorted = values
      .filter((value) => value != null && value >= 0)
      .sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const durationMetric = (label, description, startKey, endKey) => {
    const values = rows
      .map((item) => getHoursDiff(item[startKey], item[endKey]))
      .filter((value) => value != null && value >= 0);
    return { label, description, value: median(values), samples: values.length };
  };
  const responseMetrics = [
    durationMetric(
      "หมู่บ้านตรวจสอบและส่งต่อ",
      "ตั้งแต่ประชาชนแจ้ง จนหมู่บ้านส่งให้ อบต.",
      "date",
      "forwardedToTaoAt",
    ),
    durationMetric(
      "อบต. รับเรื่อง",
      "ตั้งแต่หมู่บ้านส่งต่อ จน อบต. เริ่มดำเนินการ",
      "forwardedToTaoAt",
      "firstResponseAt",
    ),
    durationMetric(
      "ดำเนินการจนเสร็จ",
      "ตั้งแต่ อบต. เริ่มดำเนินการ จนปิดเรื่อง",
      "firstResponseAt",
      "resolvedAt",
    ),
  ];
  const measuredResponseMetrics = responseMetrics.filter((item) => item.value != null);
  const slowestStage = measuredResponseMetrics.length
    ? [...measuredResponseMetrics].sort((a, b) => b.value - a.value)[0]
    : null;
  const trendRangeStart = rangeStart || (() => {
    const dates = rows.map((item) => new Date(item.date)).filter((date) => !Number.isNaN(date.getTime()));
    return dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : null;
  })();
  const trendRangeEnd = rangeEnd || (() => {
    const dates = rows.map((item) => new Date(item.date)).filter((date) => !Number.isNaN(date.getTime()));
    return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
  })();
  const trendDays = trendRangeStart && trendRangeEnd
    ? Math.max(1, Math.ceil((trendRangeEnd - trendRangeStart) / (24 * 60 * 60 * 1000)) + 1)
    : 0;
  const trendMode = trendDays <= 14 ? "day" : trendDays <= 120 ? "week" : "month";
  const trendBuckets = new globalThis.Map();
  if (trendRangeStart && trendRangeEnd) {
    if (trendMode === "day") {
      for (let cursor = new Date(trendRangeStart); cursor <= trendRangeEnd; cursor.setDate(cursor.getDate() + 1)) {
        const date = new Date(cursor);
        const key = toDateKey(date);
        trendBuckets.set(key, {
          key,
          label: date.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
          count: 0,
          time: date.getTime(),
        });
      }
    } else if (trendMode === "week") {
      const count = Math.ceil(trendDays / 7);
      Array.from({ length: count }).forEach((_, index) => {
        const date = new Date(trendRangeStart.getTime() + index * 7 * 24 * 60 * 60 * 1000);
        trendBuckets.set(`week-${index}`, {
          key: `week-${index}`,
          label: date.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
          count: 0,
          time: date.getTime(),
        });
      });
    } else {
      const cursor = new Date(trendRangeStart.getFullYear(), trendRangeStart.getMonth(), 1);
      const last = new Date(trendRangeEnd.getFullYear(), trendRangeEnd.getMonth(), 1);
      while (cursor <= last) {
        const date = new Date(cursor);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        trendBuckets.set(key, {
          key,
          label: date.toLocaleDateString("th-TH", { month: "short", year: "2-digit" }),
          count: 0,
          time: date.getTime(),
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
  }
  rows.forEach((item) => {
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) return;
    let key;
    let label;
    if (trendMode === "day") {
      key = toDateKey(date);
      label = date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    } else if (trendMode === "week" && trendRangeStart) {
      const index = Math.floor((date - trendRangeStart) / (7 * 24 * 60 * 60 * 1000));
      const start = new Date(trendRangeStart.getTime() + index * 7 * 24 * 60 * 60 * 1000);
      key = `week-${index}`;
      label = start.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      label = date.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
    }
    const bucket = trendBuckets.get(key) || { key, label, count: 0, time: date.getTime() };
    bucket.count += 1;
    bucket.time = Math.min(bucket.time, date.getTime());
    trendBuckets.set(key, bucket);
  });
  const trendRows = [...trendBuckets.values()].sort((a, b) => a.time - b.time);
  const maxTrend = Math.max(1, ...trendRows.map((item) => item.count));
  const categoryRows = Object.values(
    rows.reduce((result, item) => {
      const label = item.category || "ไม่ระบุประเภท";
      result[label] ||= { label, count: 0, open: 0 };
      result[label].count += 1;
      if (isOpen(item)) result[label].open += 1;
      return result;
    }, {}),
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((row) => ({
      ...row,
      percent: rows.length ? Math.round((row.count / rows.length) * 100) : 0,
    }));
  const locationRows = Object.values(
    rows.reduce((result, item) => {
      const label = item.location?.trim() || "ไม่ระบุสถานที่";
      result[label] ||= { label, count: 0, open: 0 };
      result[label].count += 1;
      if (isOpen(item)) result[label].open += 1;
      return result;
    }, {}),
  )
    .filter((row) => row.count > 1 || row.open > 0)
    .sort((a, b) => b.count - a.count || b.open - a.open)
    .slice(0, 5);
  const villageRows = villages
    .map((village) => {
      const villageIncidents = rows.filter(
        (item) => String(item.villageId || "") === String(village.id),
      );
      return {
        ...village,
        total: villageIncidents.length,
        open: villageIncidents.filter(isOpen).length,
        overdue: villageIncidents.filter(
          (item) => isOpen(item) && item.dueAt && new Date(item.dueAt) < new Date(),
        ).length,
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.overdue - a.overdue || b.open - a.open)
    .slice(0, 5);
  const maxCategory = Math.max(1, ...categoryRows.map((row) => row.count));
  const maxLocation = Math.max(1, ...locationRows.map((row) => row.count));
  const resolutionBase = rows.filter((item) => item.status !== "cancelled").length;
  const resolutionRate = resolutionBase
    ? Math.round((resolvedRows.length / resolutionBase) * 100)
    : 0;
  const topCategory = categoryRows[0];
  const topLocation = locationRows[0];
  const trendPercent = previousRows.length
    ? Math.round(((rows.length - previousRows.length) / previousRows.length) * 100)
    : null;
  const coordinateCount = rows.filter(
    (item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)),
  ).length;
  const locationCompleteness = rows.length
    ? Math.round((coordinateCount / rows.length) * 100)
    : 0;
  const departmentRows = Object.values(
    openRows.reduce((result, item) => {
      const label = item.department || "ยังไม่มอบหมาย";
      result[label] ||= { label, count: 0, overdue: 0 };
      result[label].count += 1;
      if (item.dueAt && new Date(item.dueAt) < new Date()) result[label].overdue += 1;
      return result;
    }, {}),
  ).sort((a, b) => b.overdue - a.overdue || b.count - a.count);
  const statusRows = [
    { label: "รอหมู่บ้านตรวจสอบ", count: rows.filter((item) => item.status === "pending" && !item.requiresTao).length, tone: "bg-amber-500" },
    { label: "ส่งให้ อบต.แล้ว", count: rows.filter((item) => item.requiresTao && item.status === "pending").length, tone: "bg-indigo-500" },
    { label: "กำลังดำเนินการ", count: rows.filter((item) => ["assigned", "in_progress", "waiting_review", "revision_requested"].includes(item.status)).length, tone: "bg-blue-600" },
    { label: "เสร็จสิ้น", count: resolvedRows.length, tone: "bg-emerald-500" },
    { label: "ยุติแล้ว", count: rows.filter((item) => item.status === "cancelled").length, tone: "bg-slate-400" },
  ];
  const findings = [];
  if (overdueRows.length)
    findings.push(`มีเรื่องเกินกำหนด ${overdueRows.length} เรื่อง จากกำหนดวันที่ อบต.บันทึกไว้`);
  if (topCategory)
    findings.push(
      `ประเภทที่พบมากที่สุดคือ “${topCategory.label}” จำนวน ${topCategory.count} เรื่อง`,
    );
  if (topLocation && topLocation.count > 1)
    findings.push(
      `พื้นที่ “${topLocation.label}” มีเหตุซ้ำ ${topLocation.count} ครั้ง`,
    );
  if (!findings.length)
    findings.push("ข้อมูลในช่วงที่เลือกยังไม่พบรูปแบบปัญหาซ้ำหรือเรื่องเกินกำหนด");

  const BarList = ({ data, max, emptyText }) => (
    <div className="mt-4 space-y-3">
      {data.map((row) => (
        <div key={row.label}>
          <div className="mb-1.5 flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-bold text-slate-700" title={row.label}>
              {row.label}
            </span>
            <span className="shrink-0 font-black text-slate-950">
              {row.count} เรื่อง{row.percent != null ? ` · ${row.percent}%` : ""}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${Math.max(7, (row.count / max) * 100)}%` }}
            />
          </div>
          {row.open > 0 && (
            <div className="mt-1 text-xs font-medium text-amber-700">ยังไม่เสร็จ {row.open} เรื่อง</div>
          )}
        </div>
      ))}
      {!data.length && <div className="py-8 text-center text-sm text-slate-400">{emptyText}</div>}
    </div>
  );

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-white px-5 py-5 md:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-black text-blue-600">วิเคราะห์ข้อมูล</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">สถานการณ์เรื่องร้องทุกข์</h2>
            <p className="mt-1 text-sm text-slate-500">สรุปจากข้อมูลที่ประชาชนแจ้งและผลการดำเนินงานของเจ้าหน้าที่</p>
          </div>
          <div className={`grid w-full gap-3 ${isTao ? "sm:w-[34rem] sm:grid-cols-2" : "sm:w-80"}`}>
            {isTao && (
              <label className="text-sm font-bold text-slate-600">
                หมู่บ้าน
                <select
                  value={analysisVillage}
                  onChange={(event) => setAnalysisVillage(event.target.value)}
                  className="mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900"
                >
                  <option value="all">ทุกหมู่บ้าน</option>
                  {villages.map((village) => (
                    <option key={village.id} value={village.id}>
                      หมู่ {village.moo} {village.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <DateRangePicker
              from={analysisDateFrom}
              to={analysisDateTo}
              label="ช่วงข้อมูล"
              labelClassName="text-sm text-slate-600"
              onChange={(nextFrom, nextTo) => {
                setAnalysisDateFrom(nextFrom);
                setAnalysisDateTo(nextTo);
              }}
            />
          </div>
        </div>
      </div>

      <div className="p-5 md:p-7">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 lg:grid-cols-4">
          {[
            ["เรื่องในช่วงนี้", rows.length, "text-slate-950"],
            ["ยังไม่เสร็จ", openRows.length, "text-amber-700"],
            ["เกินกำหนด", overdueRows.length, "text-red-700"],
            ["อัตราแก้สำเร็จ", `${resolutionRate}%`, "text-emerald-700"],
          ].map(([label, value, tone]) => (
            <div key={label} className="bg-white p-4">
              <div className={`text-2xl font-black ${tone}`}>{value}</div>
              <div className="mt-0.5 text-sm font-bold text-slate-500">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-1 rounded-xl bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="font-bold text-slate-700">
            {topCategory ? `ปัญหาหลัก: ${topCategory.label} ${topCategory.count} เรื่อง` : "ยังไม่มีข้อมูลเพียงพอสำหรับสรุป"}
            {topLocation && topLocation.count > 1 ? ` · พบซ้ำมากสุดที่ ${topLocation.label}` : ""}
          </div>
          <div className="shrink-0 font-bold text-slate-500">
            เทียบช่วงก่อนหน้า: {!rangeDuration || trendPercent == null ? "ไม่มีข้อมูล" : `${trendPercent > 0 ? "+" : ""}${trendPercent}%`}
          </div>
        </div>

        <article className="mt-4 rounded-2xl border border-slate-200 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950">แนวโน้มจำนวนเหตุ</h3>
              <p className="mt-1 text-sm text-slate-500">
                {trendMode === "day" ? "แสดงรายวัน" : trendMode === "week" ? "แสดงรายสัปดาห์" : "แสดงรายเดือน"} จากวันที่ประชาชนแจ้งเหตุ
              </p>
            </div>
          </div>
          {trendRows.length ? (
            <div className="mt-3 overflow-x-auto pb-1">
              <div className="flex h-40 min-w-[42rem] items-end gap-2 border-b border-slate-200 px-2">
                {trendRows.map((item) => (
                  <div key={item.key} className="flex h-full min-w-10 flex-1 flex-col items-center justify-end">
                    <div className="mb-1 text-xs font-black text-slate-700">{item.count}</div>
                    <div
                      className={`w-full max-w-12 rounded-t-lg ${item.count ? "bg-cyan-600" : "bg-slate-100"}`}
                      style={{ height: `${item.count ? Math.max(10, (item.count / maxTrend) * 88) : 4}px` }}
                      title={`${item.label}: ${item.count} เรื่อง`}
                    />
                    <div className="mt-2 h-8 text-center text-[10px] font-bold leading-4 text-slate-500">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-slate-50 py-10 text-center text-sm font-bold text-slate-400">
              ยังไม่มีข้อมูลในช่วงวันที่และหมู่บ้านที่เลือก
            </div>
          )}
        </article>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-950">ประเภทปัญหา</h3>
                <p className="mt-1 text-sm text-slate-500">สัดส่วนเรื่องที่ประชาชนแจ้ง</p>
              </div>
            </div>
            <BarList data={categoryRows} max={maxCategory} emptyText="ยังไม่มีข้อมูลประเภทปัญหา" />
          </article>
          <article className="rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-black text-slate-950">ระยะเวลาดำเนินการ</h3>
            <p className="mt-1 text-sm text-slate-500">ค่ากลางของแต่ละขั้นตอนจากเรื่องที่มีข้อมูลครบ</p>
            <div className="mt-4 divide-y divide-slate-100">
              {responseMetrics.map((metric) => (
                <div key={metric.label} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900">{metric.label}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {metric.value == null ? "ยังไม่มีข้อมูลครบขั้นตอน" : `${metric.samples} เรื่องที่มีข้อมูลครบ`}
                    </div>
                  </div>
                  <div className="shrink-0 text-lg font-black text-slate-950">
                    {metric.value == null ? "—" : formatHours(metric.value)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-slate-200 pt-3 text-sm font-bold text-slate-600">
              {slowestStage
                ? `ใช้เวลามากที่สุด: ${slowestStage.label} (${formatHours(slowestStage.value)})`
                : "ยังระบุขั้นตอนที่ใช้เวลามากที่สุดไม่ได้"}
            </div>
          </article>
        </div>

        <article className="mt-4 rounded-2xl border border-slate-200 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950">แผนที่จุดเสี่ยงและเหตุซ้ำ</h3>
              <p className="mt-1 text-sm text-slate-500">วงใหญ่และสีเข้มหมายถึงมีหลายเหตุในบริเวณใกล้กัน</p>
            </div>
            <div className="text-sm font-bold text-slate-600">
              มีพิกัด {coordinateCount} จาก {rows.length} เรื่อง ({locationCompleteness}%)
            </div>
          </div>
          <div className="mt-4">
            {coordinateCount > 0 ? (
              <SpatialAnalyticsMap incidents={rows} lockToTao={isTao} />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50 text-sm font-bold text-slate-400">
                ยังไม่มีพิกัดสำหรับวิเคราะห์บนแผนที่
              </div>
            )}
          </div>
          {topLocation && topLocation.count > 1 && (
            <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-900">
              พื้นที่ที่พบเหตุซ้ำมากที่สุด: {topLocation.label} · {topLocation.count} เรื่อง
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function TaoDashboard({
  activeTab,
  setActiveTab,
  incidents,
  setIncidents,
  villages,
  users,
  budgetSettings,
  setBudgetSettings,
  news,
  setNews,
}) {
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseNote, setCaseNote] = useState("");
  const [caseDepartment, setCaseDepartment] = useState("");
  const [caseDueAt, setCaseDueAt] = useState("");
  const [caseResolvedImage, setCaseResolvedImage] = useState(null);
  const [taoDateFrom, setTaoDateFrom] = useState("");
  const [taoDateTo, setTaoDateTo] = useState("");
  const [taoStatusFilter, setTaoStatusFilter] = useState("active");
  const [taoSearch, setTaoSearch] = useState("");
  const [reviewForm, setReviewForm] = useState({
    approved_amount: "",
    fiscal_year: String(new Date().getFullYear() + 543),
    funding_source: "",
    document_reference: "",
    review_note: "",
  });
  const [projectForm, setProjectForm] = useState({
    project_status: "approved",
    executor: "",
    start_date: "",
    expected_end_date: "",
    progress_percent: 0,
    actual_amount: "",
    project_note: "",
    evidence_url: "",
  });
  const [projectEvidenceFile, setProjectEvidenceFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingPublicNews, setEditingPublicNews] = useState(null);
  const [publicNewsForm, setPublicNewsForm] = useState({
    display_section: "news",
    title: "",
    content: "",
    image: "",
    video_url: "",
  });
  const [publicNewsImageFile, setPublicNewsImageFile] = useState(null);
  const [publicNewsImagePreview, setPublicNewsImagePreview] = useState(null);
  const [savingPublicNews, setSavingPublicNews] = useState(false);
  const publicNewsFormRef = useRef(null);
  useEffect(() => {
    if (!editingPublicNews) return;
    requestAnimationFrame(() => {
      publicNewsFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [editingPublicNews]);
  const currency = (value) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  const forwarded = incidents.filter(
    (item) => item.requiresTao || item.budgetRequest,
  );
  const budgetQueue = forwarded.filter(
    (item) => item.budgetRequest?.status === "submitted",
  );
  const activeForwarded = forwarded.filter(
    (item) => !["resolved", "cancelled"].includes(item.status),
  );
  const newForwarded = forwarded.filter((item) => item.status === "pending");
  const overdueForwarded = activeForwarded.filter(
    (item) => item.dueAt && new Date(item.dueAt) < new Date(),
  );
  const resolvedForwarded = forwarded.filter((item) => item.status === "resolved");
  const approvedTotal = forwarded.reduce(
    (sum, item) => sum + Number(item.budgetRequest?.approved_amount || 0),
    0,
  );
  const actualTotal = forwarded.reduce(
    (sum, item) => sum + Number(item.budgetRequest?.actual_amount || 0),
    0,
  );
  const inTaoDateRange = (item) => {
    const value = item.budgetRequest?.created_at || item.forwardedToTaoAt || item.date;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return !taoDateFrom && !taoDateTo;
    const from = taoDateFrom ? new Date(`${taoDateFrom}T00:00:00`) : null;
    const to = taoDateTo ? new Date(`${taoDateTo}T23:59:59`) : null;
    return (!from || date >= from) && (!to || date <= to);
  };
  const datedIncidents = incidents.filter(inTaoDateRange);
  const villageRows = (villages || []).map((village) => {
    const rows = datedIncidents.filter(
      (item) => String(item.villageId || "") === String(village.id),
    );
    const sent = rows.filter((item) => item.requiresTao || item.budgetRequest);
    return {
      ...village,
      total: rows.length,
      forwarded: sent.length,
      open: sent.filter(
        (item) => !["resolved", "cancelled"].includes(item.status),
      ).length,
      resolved: sent.filter((item) => item.status === "resolved").length,
      overdue: sent.filter(
        (item) => item.dueAt && new Date(item.dueAt) < new Date() && !["resolved", "cancelled"].includes(item.status),
      ).length,
    };
  });
  const openCase = (item) => {
    setSelectedCase(item);
    setCaseNote("");
    setCaseDepartment(item.department || "");
    setCaseDueAt(item.dueAt ? new Date(item.dueAt).toISOString().slice(0, 16) : "");
    setCaseResolvedImage(null);
    setReviewForm({
      approved_amount:
        item.budgetRequest?.status === "approved" ||
        item.budgetRequest?.status === "completed"
          ? item.budgetRequest?.approved_amount || ""
          : "",
      fiscal_year:
        item.budgetRequest?.fiscal_year ||
        String(new Date().getFullYear() + 543),
      funding_source: item.budgetRequest?.funding_source || "",
      document_reference: item.budgetRequest?.document_reference || "",
      review_note: item.budgetRequest?.review_note || "",
    });
    const project = item.budgetRequest || {};
    setProjectForm({
      project_status: project.project_status || "approved",
      executor: project.executor || "",
      start_date: project.start_date?.slice?.(0, 10) || "",
      expected_end_date: project.expected_end_date?.slice?.(0, 10) || "",
      progress_percent: Number(project.progress_percent || 0),
      actual_amount: project.actual_amount || "",
      project_note: project.project_note || "",
      evidence_url: project.evidence_url || "",
    });
    setProjectEvidenceFile(null);
  };
  const updateGeneralCase = async (status, action = null) => {
    if (!selectedCase) return;
    if (status === "in_progress" && !caseDepartment)
      return alert("กรุณาเลือกหน่วยรับผิดชอบก่อนรับเรื่อง");
    if (status === "in_progress" && !caseDueAt)
      return alert("กรุณากำหนดวันดำเนินการให้เสร็จ");
    if (status === "resolved" && !caseResolvedImage && !selectedCase.resolvedImage)
      return alert("กรุณาแนบรูปหลักฐานหลังดำเนินการก่อนปิดเรื่อง");
    if (!caseNote.trim()) {
      return alert("กรุณาระบุผลการดำเนินงานหรือหมายเหตุก่อน");
    }
    setSaving(true);
    try {
      let payload = {
        status,
        note: caseNote.trim(),
        department: caseDepartment || null,
        due_at: caseDueAt || null,
        action,
      };
      if (caseResolvedImage) {
        payload = new FormData();
        payload.append("status", status);
        payload.append("note", caseNote.trim());
        if (action) payload.append("action", action);
        if (caseDepartment) payload.append("department", caseDepartment);
        if (caseDueAt) payload.append("due_at", caseDueAt);
        payload.append("resolvedImage", caseResolvedImage);
      }
      const response = await api.updateIncidentStatus(selectedCase.id, payload);
      const updated = normalizeIncident({ ...selectedCase, ...response });
      setIncidents((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelectedCase(updated);
      setCaseNote("");
      alert(
        action === "request_info"
          ? "ส่งคำขอข้อมูลเพิ่มเติมให้หมู่บ้านแล้ว"
          : status === "in_progress"
          ? "อบต.รับเรื่องและเริ่มดำเนินการแล้ว"
          : status === "resolved"
            ? "ปิดเรื่องเรียบร้อยแล้ว"
            : "ยุติเรื่องแล้ว",
      );
    } catch (error) {
      alert(error?.message || "เปลี่ยนสถานะเรื่องไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const reviewBudget = async (decision) => {
    setSaving(true);
    try {
      const updated = normalizeIncident(
        await api.reviewIncidentBudget(selectedCase.id, {
          decision,
          approved_amount:
            decision === "approve" ? Number(reviewForm.approved_amount) : null,
          fiscal_year: reviewForm.fiscal_year,
          funding_source: reviewForm.funding_source,
          document_reference: reviewForm.document_reference,
          review_note: reviewForm.review_note,
        }),
      );
      setIncidents((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelectedCase(updated);
      alert(decision === "approve" ? "อนุมัติงบประมาณแล้ว" : "ส่งคำขอกลับแล้ว");
    } catch (error) {
      alert(error?.message || "พิจารณางบประมาณไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const saveProjectProgress = async () => {
    setSaving(true);
    try {
      const payload = {
        ...projectForm,
        progress_percent: Number(projectForm.progress_percent),
        actual_amount:
          projectForm.actual_amount === ""
            ? null
            : Number(projectForm.actual_amount),
      };
      let requestPayload = payload;
      if (projectEvidenceFile) {
        requestPayload = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== "") {
            requestPayload.append(key, String(value));
          }
        });
        requestPayload.append("evidence", projectEvidenceFile);
      }
      const updated = normalizeIncident(
        await api.updateProject(selectedCase.id, requestPayload),
      );
      setIncidents((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelectedCase(updated);
      setProjectEvidenceFile(null);
      alert("บันทึกความคืบหน้าโครงการแล้ว");
    } catch (error) {
      alert(error?.message || "บันทึกความคืบหน้าโครงการไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const generalForwarded = forwarded.filter((item) => !item.budgetRequest);
  const baseList = forwarded;
  const list = baseList.filter((item) => {
    const matchesDate = inTaoDateRange(item);
    const matchesStatus =
      taoStatusFilter === "all" ||
      (taoStatusFilter === "active" && !["resolved", "cancelled"].includes(item.status)) ||
      item.status === taoStatusFilter;
    const query = taoSearch.trim().toLowerCase();
    const matchesSearch = !query || [item.referenceNo, item.title, item.location, item.villageName, item.department]
      .some((value) => String(value || "").toLowerCase().includes(query));
    return matchesDate && matchesStatus && matchesSearch;
  });
  const publicNews = (news || []).filter((item) => item.villageId == null);
  const closePublicNewsForm = () => {
    if (publicNewsImagePreview?.startsWith("blob:"))
      URL.revokeObjectURL(publicNewsImagePreview);
    setEditingPublicNews(null);
    setPublicNewsImageFile(null);
    setPublicNewsImagePreview(null);
    setPublicNewsForm({
      display_section: "news",
      title: "",
      content: "",
      image: "",
      video_url: "",
    });
  };
  const startPublicNewsForm = (
    item = {
      display_section: "news",
      title: "",
      content: "",
      image: "",
      video_url: "",
    },
  ) => {
    setEditingPublicNews(item);
    setPublicNewsForm({
      display_section: item.displaySection || item.display_section || "news",
      title: item.title || "",
      content: item.content || "",
      image: item.image || "",
      video_url: item.video_url || "",
    });
    setPublicNewsImageFile(null);
    setPublicNewsImagePreview(item.image || null);
  };
  const choosePublicNewsImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      event.target.value = "";
      return alert("รูปภาพต้องมีขนาดไม่เกิน 10MB");
    }
    if (publicNewsImagePreview?.startsWith("blob:"))
      URL.revokeObjectURL(publicNewsImagePreview);
    setPublicNewsImageFile(file);
    setPublicNewsImagePreview(URL.createObjectURL(file));
  };
  const savePublicNews = async (event) => {
    event.preventDefault();
    if (
      ["hero", "news"].includes(publicNewsForm.display_section) &&
      !publicNewsImageFile &&
      !editingPublicNews?.image
    )
      return alert("กรุณาเลือกรูปภาพสำหรับส่วนนี้");
    setSavingPublicNews(true);
    const payload = new FormData();
    payload.append("display_section", publicNewsForm.display_section);
    payload.append(
      "title",
      publicNewsForm.display_section === "hero"
        ? publicNewsForm.title || "ภาพกิจกรรมสำคัญ อบต.มะต้อง"
        : publicNewsForm.title,
    );
    payload.append("content", publicNewsForm.content || "");
    payload.append("video_url", publicNewsForm.video_url || "");
    if (publicNewsImageFile) payload.append("image", publicNewsImageFile);
    try {
      const data = await api.saveNews(payload, editingPublicNews?.id || null);
      const saved = normalizeNews(data.news);
      setNews((items) =>
        editingPublicNews?.id
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...items],
      );
      closePublicNewsForm();
    } catch (error) {
      alert(error?.message || "บันทึกเนื้อหาหน้าแรกไม่สำเร็จ");
    } finally {
      setSavingPublicNews(false);
    }
  };
  const removePublicNews = async (item) => {
    if (!window.confirm(`ยืนยันการลบ “${item.title}” ออกจากหน้าแรก?`)) return;
    try {
      await api.deleteNews(item.id);
      setNews((items) => items.filter((row) => row.id !== item.id));
    } catch (error) {
      alert(error?.message || "ลบเนื้อหาไม่สำเร็จ");
    }
  };
  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-fadeIn">
      {activeTab === "tao_overview" && (
        <>
          <section className="hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-black text-blue-600">ศูนย์รับเรื่อง อบต.มะต้อง</div>
                <h1 className="mt-1 text-2xl font-black text-slate-950 md:text-3xl">งานที่ต้องจัดการวันนี้</h1>
                <p className="mt-1 text-sm text-slate-500">รับเรื่องจากหมู่บ้าน มอบหมายส่วนงาน ติดตามกำหนด และใช้ข้อมูลวางแผนแก้ปัญหา</p>
              </div>
              <button onClick={() => setActiveTab("tao_forwarded")} className="min-h-12 rounded-xl bg-blue-600 px-5 py-3 font-black text-white shadow-sm hover:bg-blue-700">
                เปิดคิวงาน {newForwarded.length ? `(${newForwarded.length} เรื่องใหม่)` : ""}
              </button>
            </div>
          </section>
          <section className="hidden grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "เรื่องใหม่รอรับ",
                value: newForwarded.length,
                note: "จากหมู่บ้าน",
                tone: "bg-blue-50 text-blue-900",
              },
              {
                label: "กำลังดำเนินการ",
                value: activeForwarded.length,
                note: "ยังไม่ปิดเรื่อง",
                tone: "bg-amber-50 text-amber-900",
              },
              {
                label: "เกินกำหนด",
                value: overdueForwarded.length,
                note: "ต้องเร่งติดตาม",
                tone: "bg-red-50 text-red-900",
              },
              {
                label: "แก้ไขเสร็จแล้ว",
                value: resolvedForwarded.length,
                note: "รอหรือผ่านการยืนยันผล",
                tone: "bg-emerald-50 text-emerald-900",
              },
            ].map((card) => (
              <div
                key={card.label}
                className={`rounded-2xl border p-4 shadow-sm md:p-5 ${card.tone}`}
              >
                <div className="text-sm font-bold">{card.label}</div>
                <div className="mt-2 text-3xl font-black">{card.value}</div>
                <div className="mt-1 text-xs opacity-70">{card.note}</div>
              </div>
            ))}
          </section>
          <DecisionAnalyticsCenter
            incidents={forwarded}
            villages={villages}
            scope="tao"
          />
          <section className="hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-sm font-black text-red-600">คิวเร่งด่วน</div>
                <h2 className="text-xl font-black text-slate-950">เรื่องที่ควรเปิดดูก่อน</h2>
              </div>
              <button onClick={() => setActiveTab("tao_forwarded")} className="text-sm font-black text-blue-600">ดูทั้งหมด →</button>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {[...activeForwarded]
                .sort((a, b) => {
                  const aLate = a.dueAt && new Date(a.dueAt) < new Date() ? 1 : 0;
                  const bLate = b.dueAt && new Date(b.dueAt) < new Date() ? 1 : 0;
                  return bLate - aLate || Number(b.priority || 1) - Number(a.priority || 1) || new Date(a.date) - new Date(b.date);
                })
                .slice(0, 5)
                .map((item) => (
                  <button key={item.id} onClick={() => { openCase(item); setActiveTab("tao_forwarded"); }} className="grid w-full gap-2 py-4 text-left sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="truncate font-black text-slate-950">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-500">หมู่ {item.villageMoo || "-"} · {item.category} · {item.department || "ยังไม่มอบหมาย"}</div>
                    </div>
                    <div className="sm:text-right">
                      <StatusBadge status={item.status} />
                      {item.dueAt && new Date(item.dueAt) < new Date() && <div className="mt-1 text-xs font-black text-red-600">เกินกำหนด</div>}
                    </div>
                  </button>
                ))}
              {!activeForwarded.length && <div className="py-8 text-center text-sm text-slate-400">ไม่มีเรื่องค้างในขณะนี้</div>}
            </div>
          </section>
        </>
      )}
      {activeTab === "tao_analysis" && (
        <DecisionAnalyticsCenter
          incidents={forwarded}
          villages={villages}
          scope="tao"
        />
      )}
      {activeTab === "tao_reports" && (
        <AdminReports incidents={incidents} users={users} />
      )}
      {["tao_forwarded", "tao_budget"].includes(activeTab) && (
        <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4">
            <h3 className="text-2xl font-black">
              จัดการเรื่องร้องทุกข์
            </h3>
            <p className="text-sm text-slate-500">
              รับเรื่องที่หมู่บ้านตรวจสอบแล้ว กำหนดหน่วยรับผิดชอบ อัปเดตผล และปิดเรื่อง
            </p>
          </div>
          <div className="mb-5 space-y-3 rounded-2xl bg-slate-50 p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_22rem]">
              <label className="relative block">
                <Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  value={taoSearch}
                  onChange={(event) => setTaoSearch(event.target.value)}
                  placeholder="ค้นหาเลขที่เรื่อง ชื่อปัญหา สถานที่ หรือหน่วยงาน"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-400"
                />
              </label>
              <DateRangePicker
                from={taoDateFrom}
                to={taoDateTo}
                label=""
                onChange={(nextFrom, nextTo) => {
                  setTaoDateFrom(nextFrom);
                  setTaoDateTo(nextTo);
                }}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                ["active", "งานที่ต้องทำ"],
                ["pending", "รอรับเรื่อง"],
                ["in_progress", "กำลังดำเนินการ"],
                ["resolved", "เสร็จแล้ว"],
                ["cancelled", "ยุติแล้ว"],
                ["all", "ทั้งหมด"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTaoStatusFilter(value)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black ${taoStatusFilter === value ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden grid-cols-[8rem_1.5fr_1fr_1fr_8rem] gap-4 bg-slate-50 px-4 py-3 text-xs font-black text-slate-500 md:grid">
              <div>เลขที่เรื่อง</div>
              <div>ปัญหาและสถานที่</div>
              <div>หมู่บ้าน</div>
              <div>หน่วยรับผิดชอบ</div>
              <div>สถานะ</div>
            </div>
            {list.map((item) => (
              <button
                key={item.id}
                onClick={() => openCase(item)}
                className="grid w-full gap-3 border-t border-slate-100 p-4 text-left first:border-t-0 hover:bg-blue-50/50 md:grid-cols-[8rem_1.5fr_1fr_1fr_8rem] md:items-center md:gap-4"
              >
                <div className="font-mono text-sm font-black text-blue-700">{item.referenceNo || `#${item.id}`}</div>
                <div className="min-w-0">
                  <div className="truncate font-black text-slate-950">{item.title}</div>
                  <div className="mt-1 flex items-center gap-1 truncate text-sm text-slate-500"><MapPin className="h-3.5 w-3.5 shrink-0 text-rose-500" />{item.location}</div>
                </div>
                <div>
                  <div className="font-bold text-slate-800">หมู่ {item.villageMoo || "-"} {item.villageName || ""}</div>
                  <div className="mt-1 text-xs text-slate-400">ส่ง {formatThaiDateTime(item.forwardedToTaoAt || item.date)} น.</div>
                </div>
                <div className="font-bold text-slate-700">
                  {item.department || (["resolved", "cancelled"].includes(item.status) ? "ไม่ได้บันทึก (ข้อมูลเดิม)" : "ยังไม่มอบหมาย")}
                </div>
                <div><StatusBadge status={item.status} /></div>
              </button>
            ))}
            {!list.length && (
              <div className="py-14 text-center text-slate-500">
                ไม่มีรายการในคิวนี้
              </div>
            )}
          </div>
        </section>
      )}
      {activeTab === "tao_villages" && (
        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="p-6">
            <h3 className="text-2xl font-black">ภาพรวม 12 หมู่บ้าน</h3>
            <p className="text-sm text-slate-500">
              เปรียบเทียบเรื่องที่ส่งมายัง อบต. งานค้าง งานเกินกำหนด และผลสำเร็จ
            </p>
            <div className="mt-4 max-w-md rounded-2xl bg-slate-50 p-4">
              <DateRangePicker
                from={taoDateFrom}
                to={taoDateTo}
                onChange={(nextFrom, nextTo) => {
                  setTaoDateFrom(nextFrom);
                  setTaoDateTo(nextTo);
                }}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="bg-slate-50 text-left text-sm text-slate-500">
                  <th className="p-4">หมู่บ้าน</th>
                  <th className="p-4 text-center">เรื่องทั้งหมด</th>
                  <th className="p-4 text-center">ส่งต่อ อบต.</th>
                  <th className="p-4 text-center">ยังเปิด</th>
                  <th className="p-4 text-center">เกินกำหนด</th>
                  <th className="p-4 text-center">แก้แล้ว</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {villageRows.map((row) => (
                  <tr key={row.id}>
                    <td className="p-4 font-bold">
                      หมู่ {row.moo} {row.name}
                    </td>
                    <td className="p-4 text-center">{row.total}</td>
                    <td className="p-4 text-center">{row.forwarded}</td>
                    <td className="p-4 text-center font-bold text-amber-700">
                      {row.open}
                    </td>
                    <td className="p-4 text-center font-bold text-red-700">{row.overdue}</td>
                    <td className="p-4 text-center font-bold text-emerald-700">{row.resolved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {activeTab === "tao_content" && (
        <section className="space-y-5">
          <div className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
            <div>
              <div className="text-sm font-bold text-blue-600">
                เนื้อหาสาธารณะของ อบต.
              </div>
              <h3 className="text-2xl font-black text-slate-900">
                จัดการหน้าแรก 3 ส่วน
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                เลือกส่วนที่จะเพิ่มให้ตรงกับตำแหน่งที่แสดงบนหน้าแรก
              </p>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                [
                  "hero",
                  "1",
                  "ภาพกิจกรรมสำคัญ",
                  "รูปใหญ่เท่านั้น ไม่แสดงข้อความ",
                ],
                ["news", "2", "ข่าวและกิจกรรม", "รูปพร้อมหัวข้อและรายละเอียด"],
                [
                  "video",
                  "3",
                  "วิดีโอแนะนำตำบล",
                  "ลิงก์ YouTube หรือวิดีโอ MP4",
                ],
              ].map(([section, number, title, detail]) => (
                <button
                  key={section}
                  onClick={() =>
                    startPublicNewsForm({
                      display_section: section,
                      title: "",
                      content: "",
                      image: "",
                      video_url: "",
                    })
                  }
                  className="rounded-2xl border-2 border-slate-200 p-4 text-left transition hover:border-blue-500 hover:bg-blue-50"
                >
                  <div className="text-xs font-black text-blue-600">
                    ส่วนที่ {number}
                  </div>
                  <div className="mt-1 font-black text-slate-900">{title}</div>
                  <div className="mt-1 text-xs text-slate-500">{detail}</div>
                </button>
              ))}
            </div>
          </div>
          {editingPublicNews && (
            <form
              ref={publicNewsFormRef}
              onSubmit={savePublicNews}
              className="scroll-mt-5 rounded-3xl border bg-white p-5 shadow-sm md:p-7"
            >
              <div className="mb-5 flex items-center justify-between">
                <h4 className="text-xl font-black">
                  {editingPublicNews.id ? "แก้ไข" : "เพิ่ม"}{" "}
                  {publicNewsForm.display_section === "hero"
                    ? "ภาพกิจกรรมสำคัญ"
                    : publicNewsForm.display_section === "video"
                      ? "วิดีโอแนะนำตำบล"
                      : "ข่าวหรือกิจกรรม"}
                </h4>
                <button
                  type="button"
                  onClick={closePublicNewsForm}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
                <label className="group relative flex min-h-64 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50">
                  {publicNewsImagePreview ? (
                    <>
                      <img
                        src={publicNewsImagePreview}
                        alt="ตัวอย่างภาพหน้าแรก"
                        className="h-full min-h-64 w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 opacity-0 transition group-hover:opacity-100">
                        <span className="rounded-xl bg-white px-4 py-2 text-sm font-bold">
                          <Upload className="mr-2 inline h-4 w-4" />
                          เปลี่ยนรูป
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="p-6 text-center">
                      <Image className="mx-auto h-10 w-10 text-blue-600" />
                      <div className="mt-3 font-bold">
                        {publicNewsForm.display_section === "hero"
                          ? "เลือกรูปกิจกรรมสำคัญขนาดใหญ่"
                          : publicNewsForm.display_section === "video"
                            ? "เลือกรูปปกวิดีโอ (ไม่บังคับ)"
                            : "เลือกรูปข่าวหรือกิจกรรม"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        JPG, PNG หรือ WebP ไม่เกิน 10MB
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={choosePublicNewsImage}
                    className="sr-only"
                  />
                </label>
                <div className="space-y-4">
                  {publicNewsForm.display_section === "hero" && (
                    <div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
                      ส่วนนี้แสดงเฉพาะรูปขนาดใหญ่บนหน้าแรก
                      จึงไม่ต้องกรอกหัวข้อหรือรายละเอียด
                    </div>
                  )}
                  {publicNewsForm.display_section !== "hero" && (
                    <label className="block text-sm font-bold">
                      {publicNewsForm.display_section === "video"
                        ? "ชื่อวิดีโอ"
                        : "หัวข้อข่าวหรือกิจกรรม"}
                      <input
                        required
                        value={publicNewsForm.title}
                        onChange={(e) =>
                          setPublicNewsForm({
                            ...publicNewsForm,
                            title: e.target.value,
                          })
                        }
                        className="mt-1.5 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-500"
                        placeholder="เช่น เชิญร่วมงานประเพณีประจำตำบล"
                      />
                    </label>
                  )}
                  {publicNewsForm.display_section === "news" && (
                    <label className="block text-sm font-bold">
                      รายละเอียด
                      <textarea
                        required
                        value={publicNewsForm.content}
                        onChange={(e) =>
                          setPublicNewsForm({
                            ...publicNewsForm,
                            content: e.target.value,
                          })
                        }
                        className="mt-1.5 h-32 w-full resize-none rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-500"
                        placeholder="รายละเอียด วันที่ เวลา สถานที่ และข้อมูลติดต่อ"
                      />
                    </label>
                  )}
                  {publicNewsForm.display_section === "video" && (
                    <label className="block text-sm font-bold">
                      ลิงก์วิดีโอโปรโมต
                      <input
                        type="url"
                        required
                        value={publicNewsForm.video_url}
                        onChange={(e) =>
                          setPublicNewsForm({
                            ...publicNewsForm,
                            video_url: e.target.value,
                          })
                        }
                        className="mt-1.5 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-500"
                        placeholder="YouTube หรือไฟล์วิดีโอ MP4"
                      />
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        รองรับลิงก์ YouTube และ URL ไฟล์วิดีโอ MP4
                      </span>
                    </label>
                  )}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={closePublicNewsForm}
                      className="rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-700"
                    >
                      ยกเลิก
                    </button>
                    <button
                      disabled={savingPublicNews}
                      className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50"
                    >
                      {savingPublicNews ? "กำลังบันทึก..." : "บันทึกและเผยแพร่"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
          <div className="space-y-6">
            {[
              {
                key: "hero",
                number: "1",
                title: "ภาพกิจกรรมสำคัญ",
                detail: "รูปขนาดใหญ่ที่แสดงในสไลด์ด้านบนของหน้าแรก",
              },
              {
                key: "news",
                number: "2",
                title: "ข่าวและกิจกรรม",
                detail: "การ์ดข่าวพร้อมหัวข้อและรายละเอียด",
              },
              {
                key: "video",
                number: "3",
                title: "วิดีโอแนะนำตำบล",
                detail: "วิดีโอประชาสัมพันธ์ที่แสดงบนหน้าแรก",
              },
            ].map((group) => {
              const groupItems = publicNews.filter(
                (item) => item.displaySection === group.key,
              );
              return (
                <section
                  key={group.key}
                  className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 md:p-5"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black text-blue-600">
                        ส่วนที่ {group.number}
                      </div>
                      <h4 className="text-xl font-black text-slate-900">
                        {group.title}
                      </h4>
                      <p className="text-sm text-slate-500">{group.detail}</p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-600 shadow-sm">
                      {groupItems.length} รายการ
                    </div>
                  </div>
                  {groupItems.length ? (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {groupItems.map((item) => (
                        <article
                          key={item.id}
                          className="overflow-hidden rounded-3xl border bg-white shadow-sm"
                        >
                          <div className="aspect-[16/9] bg-slate-100">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                                ยังไม่มีรูปภาพ
                              </div>
                            )}
                          </div>
                          <div className="p-5">
                            <div className="text-xs font-bold text-blue-600">
                              ส่วนที่ {group.number} · {group.title}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              เผยแพร่ {formatThaiDateTime(item.date)} น.
                            </div>
                            <h5 className="mt-1 line-clamp-2 text-lg font-black">
                              {item.title}
                            </h5>
                            <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                              {item.content}
                            </p>
                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() => startPublicNewsForm(item)}
                                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-50 py-2.5 text-sm font-bold text-blue-700"
                              >
                                <Edit className="h-4 w-4" />
                                แก้ไข
                              </button>
                              <button
                                onClick={() => removePublicNews(item)}
                                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-red-50 py-2.5 text-sm font-bold text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                                ลบ
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        startPublicNewsForm({
                          display_section: group.key,
                          title: "",
                          content: "",
                          image: "",
                          video_url: "",
                        })
                      }
                      className="flex min-h-32 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white text-slate-500 hover:border-blue-400 hover:text-blue-700"
                    >
                      <Image className="mb-2 h-8 w-8 opacity-50" />
                      <span className="font-bold">ยังไม่มีรายการในส่วนนี้</span>
                      <span className="mt-1 text-xs">กดเพื่อเพิ่ม {group.title}</span>
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      )}
      {selectedCase && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
          onMouseDown={() => setSelectedCase(null)}
        >
          <div
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl md:rounded-3xl md:p-7"
          >
            <div className="-mx-4 -mt-4 flex items-center justify-between gap-4 bg-slate-950 p-5 text-white md:-mx-7 md:-mt-7 md:p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black md:text-2xl">จัดการเรื่องร้องทุกข์</h3>
                  <span className="rounded-lg border border-blue-400/40 bg-blue-500/15 px-2.5 py-1 font-mono text-xs font-black text-blue-200">
                    {selectedCase.referenceNo || `#${selectedCase.id}`}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-300">หมู่ {selectedCase.villageMoo} {selectedCase.villageName} · {selectedCase.category}</div>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="h-11 w-11 shrink-0 rounded-xl bg-white/10 hover:bg-white/20"
              >
                <X className="mx-auto text-white" />
              </button>
            </div>
            {(() => {
              const step = selectedCase.status === "resolved" ? 4 : selectedCase.status === "in_progress" ? 3 : selectedCase.department ? 2 : 1;
              return (
                <div className="-mx-4 mb-5 border-b bg-slate-50 px-4 py-4 md:-mx-7 md:px-7">
                  <div className="grid grid-cols-4">
                    {["รับเรื่อง", "มอบหมาย", "ดำเนินการ", "เสร็จสิ้น"].map((label, index) => {
                      const number = index + 1;
                      const active = number <= step;
                      return (
                        <div key={label} className="min-w-0 text-center">
                          <div className="flex items-center">
                            <span className={`h-1 flex-1 rounded-full ${index === 0 ? "bg-transparent" : active ? "bg-blue-600" : "bg-slate-200"}`} />
                            <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-4 border-white text-sm font-black shadow-sm ${active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>{number}</span>
                            <span className={`h-1 flex-1 rounded-full ${index === 3 ? "bg-transparent" : number < step ? "bg-blue-600" : "bg-slate-200"}`} />
                          </div>
                          <span className={`mt-2 block truncate px-1 text-[10px] font-black sm:text-xs ${active ? "text-blue-700" : "text-slate-400"}`}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-xl font-black text-slate-950">{selectedCase.title}</h4>
                <div className="mt-1 text-sm text-slate-500">แจ้งเมื่อ {formatThaiDateTime(selectedCase.date)} น.</div>
              </div>
              <StatusBadge status={selectedCase.status} />
            </div>
            <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h5 className="font-black text-slate-900">รายละเอียดที่ประชาชนแจ้ง</h5>
                <p className="mt-0.5 text-xs text-slate-500">ข้อมูลต้นฉบับสำหรับตรวจสอบก่อนมอบหมายงาน</p>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-[1fr_15rem]">
                <div className="min-w-0 space-y-4">
                  <div>
                    <div className="text-xs font-bold text-slate-500">รายละเอียดปัญหา</div>
                    <p className="mt-1 whitespace-pre-wrap leading-7 text-slate-800">{selectedCase.description || "ผู้แจ้งไม่ได้ระบุรายละเอียดเพิ่มเติม"}</p>
                  </div>
                  <div className="grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
                    <div><span className="block text-xs font-bold text-slate-500">ผู้แจ้ง</span><span className="font-bold text-slate-900">{selectedCase.userName || "ไม่พบชื่อผู้แจ้ง"}</span></div>
                    <div><span className="block text-xs font-bold text-slate-500">เบอร์ติดต่อ</span><span className="font-bold text-slate-900">{selectedCase.userPhone || "ไม่พบเบอร์ติดต่อ"}</span></div>
                    <div><span className="block text-xs font-bold text-slate-500">ผู้พบปัญหารวม</span><span className="font-bold text-slate-900">{1 + Number(selectedCase.supporterCount || 0)} คน</span></div>
                  </div>
                </div>
                {selectedCase.image ? (
                  <a href={selectedCase.image} target="_blank" rel="noreferrer" className="group relative min-h-40 overflow-hidden rounded-xl bg-slate-100">
                    <img src={selectedCase.image} alt={`ภาพประกอบ ${selectedCase.title}`} className="h-full max-h-52 w-full object-cover" />
                    <span className="absolute inset-x-2 bottom-2 rounded-lg bg-slate-950/75 px-3 py-2 text-center text-xs font-bold text-white">กดเพื่อดูภาพเต็ม</span>
                  </a>
                ) : (
                  <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm text-slate-400"><Camera className="h-8 w-8" />ไม่มีภาพประกอบ</div>
                )}
              </div>
            </section>
            {(() => {
              const villageEvidence = (selectedCase.updates || []).filter(
                (item) =>
                  item.type === "village_verification" ||
                  item.type === "info_response" ||
                  String(item.message || "").startsWith("หลักฐานยืนยันจากหมู่บ้าน:"),
              );
              if (!villageEvidence.length) return null;
              return (
                <section className="mt-4 overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/50">
                  <div className="border-b border-blue-100 px-4 py-3">
                    <h5 className="font-black text-blue-950">ผลตรวจสอบจากหมู่บ้าน</h5>
                    <p className="mt-0.5 text-xs text-blue-700">ข้อมูลและรูปจากการตรวจหน้างานสำหรับ อบต.ใช้ประกอบการดำเนินการ</p>
                  </div>
                  <div className="space-y-3 p-4">
                    {villageEvidence.map((item) => (
                      <div key={item.id} className="grid gap-3 rounded-xl bg-white p-4 sm:grid-cols-[1fr_auto]">
                        <div>
                          <div className="text-xs font-bold text-slate-500">
                            {item.type === "info_response" ? "ข้อมูลเพิ่มเติม" : "ผลตรวจสอบหน้างาน"} · {item.user?.name || "ผู้ดูแลหมู่บ้าน"} · {formatThaiDateTime(item.created_at)} น.
                          </div>
                          <p className="mt-1 whitespace-pre-wrap font-bold text-slate-800">
                            {String(item.message || "").replace(/^หลักฐานยืนยันจากหมู่บ้าน:\s*/, "")}
                          </p>
                        </div>
                        {item.image && (
                          <a href={item.image} target="_blank" rel="noreferrer">
                            <img src={item.image} alt="รูปตรวจสอบหน้างานจากหมู่บ้าน" className="h-24 w-32 rounded-lg object-cover" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}
            <div className="mt-4">
              <IncidentLocationPanel incident={selectedCase} compact />
            </div>
            {selectedCase.feedback?.rating && (
              <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h5 className="font-black text-amber-950">ผลประเมินจากประชาชน</h5>
                  <span className="text-sm font-bold text-amber-800">
                    {selectedCase.feedback.rating} / 5 คะแนน
                  </span>
                </div>
                <div className="mt-2 flex gap-1" aria-label={`${selectedCase.feedback.rating} ดาว`}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <span
                      key={value}
                      className={`text-2xl ${value <= Number(selectedCase.feedback.rating) ? "text-amber-500" : "text-slate-300"}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selectedCase.feedback.comment || "ไม่มีความคิดเห็นเพิ่มเติม"}
                </p>
              </section>
            )}
            {false && selectedCase.budgetRequest ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm font-bold text-emerald-800">
                    ข้อเสนอโครงการจากหมู่บ้าน
                  </div>
                  <div className="mt-1 text-xl font-black">
                    {selectedCase.budgetRequest.project_title ||
                      selectedCase.title}
                  </div>
                  <div className="mt-1 text-2xl font-black">
                    {currency(selectedCase.budgetRequest.estimated_amount)}
                  </div>
                  <p className="mt-2 text-sm">
                    {selectedCase.budgetRequest.reason}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-white px-3 py-1">
                      กระทบ {selectedCase.budgetRequest.affected_people || "-"}{" "}
                      คน
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      ความเร่งด่วน:{" "}
                      {{
                        normal: "ปกติ",
                        urgent: "เร่งด่วน",
                        critical: "เร่งด่วนมาก",
                      }[selectedCase.budgetRequest.urgency] || "ปกติ"}
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-bold">
                    วงเงินที่ อบต. อนุมัติ (บาท)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={reviewForm.approved_amount}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          approved_amount: e.target.value,
                        })
                      }
                      placeholder="กรอกยอดที่ อบต. พิจารณาอนุมัติ"
                      className="mt-1 w-full rounded-xl border p-3 font-normal"
                    />
                  </label>
                  <label className="text-sm font-bold">
                    ปีงบประมาณ
                    <input
                      value={reviewForm.fiscal_year}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          fiscal_year: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border p-3 font-normal"
                    />
                  </label>
                  <label className="text-sm font-bold">
                    แหล่งงบประมาณ
                    <input
                      value={reviewForm.funding_source}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          funding_source: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border p-3 font-normal"
                    />
                  </label>
                  <label className="text-sm font-bold">
                    เลขเอกสาร
                    <input
                      value={reviewForm.document_reference}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          document_reference: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border p-3 font-normal"
                    />
                  </label>
                  <label className="text-sm font-bold sm:col-span-2">
                    หมายเหตุ
                    <textarea
                      value={reviewForm.review_note}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          review_note: e.target.value,
                        })
                      }
                      className="mt-1 h-20 w-full rounded-xl border p-3 font-normal"
                    />
                  </label>
                </div>
                {selectedCase.budgetRequest.status === "submitted" && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      disabled={saving}
                      onClick={() => reviewBudget("reject")}
                      className="rounded-xl border border-red-300 py-3 font-bold text-red-700"
                    >
                      ส่งกลับให้หมู่บ้านแก้ไข
                    </button>
                    <button
                      disabled={saving || !reviewForm.approved_amount}
                      onClick={() => reviewBudget("approve")}
                      className="rounded-xl bg-emerald-600 py-3 font-bold text-white"
                    >
                      อนุมัติงบประมาณ
                    </button>
                  </div>
                )}
                {["approved", "completed"].includes(
                  selectedCase.budgetRequest.status,
                ) && (
                  <div className="mt-5 space-y-4 border-t pt-5">
                    <div>
                      <h4 className="text-lg font-black">
                        ติดตามการดำเนินโครงการ
                      </h4>
                      <p className="text-sm text-slate-500">
                        บันทึกเฉพาะข้อมูลสำคัญ ไม่ใช่ระบบจัดซื้อจัดจ้างหรือบัญชี
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-bold">
                        สถานะโครงการ
                        <select
                          value={projectForm.project_status}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              project_status: e.target.value,
                              progress_percent:
                                e.target.value === "completed"
                                  ? 100
                                  : projectForm.progress_percent,
                            })
                          }
                          className="mt-1 w-full rounded-xl border p-3 font-normal"
                        >
                          <option value="approved">อนุมัติแล้ว</option>
                          <option value="planned">เตรียมดำเนินการ</option>
                          <option value="in_progress">กำลังดำเนินการ</option>
                          <option value="waiting_review">รอตรวจรับ</option>
                          <option value="completed">ปิดโครงการ</option>
                        </select>
                      </label>
                      <label className="text-sm font-bold">
                        ผู้ดำเนินการ/ผู้รับจ้าง
                        <input
                          value={projectForm.executor}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              executor: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-xl border p-3 font-normal"
                        />
                      </label>
                      <label className="text-sm font-bold">
                        วันที่เริ่ม
                        <input
                          type="date"
                          value={projectForm.start_date}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              start_date: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-xl border p-3 font-normal"
                        />
                      </label>
                      <label className="text-sm font-bold">
                        กำหนดเสร็จ
                        <input
                          type="date"
                          value={projectForm.expected_end_date}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              expected_end_date: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-xl border p-3 font-normal"
                        />
                      </label>
                      <label className="text-sm font-bold">
                        ความคืบหน้า ({projectForm.progress_percent}%)
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={projectForm.progress_percent}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              progress_percent: e.target.value,
                            })
                          }
                          className="mt-3 w-full"
                        />
                      </label>
                      <label className="text-sm font-bold">
                        ค่าใช้จ่ายจริง (บาท)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={projectForm.actual_amount}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              actual_amount: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-xl border p-3 font-normal"
                        />
                        {projectForm.actual_amount !== "" && (
                          <span className={`mt-2 block rounded-lg px-3 py-2 text-xs font-bold ${Number(projectForm.actual_amount) <= Number(selectedCase.budgetRequest.approved_amount || 0) ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                            {Number(projectForm.actual_amount) <= Number(selectedCase.budgetRequest.approved_amount || 0)
                              ? `เงินคงเหลือต้องคืน ${currency(Number(selectedCase.budgetRequest.approved_amount || 0) - Number(projectForm.actual_amount || 0))}`
                              : `ใช้เกินวงเงิน ${currency(Number(projectForm.actual_amount || 0) - Number(selectedCase.budgetRequest.approved_amount || 0))} — ต้องขออนุมัติเพิ่มก่อน`}
                          </span>
                        )}
                      </label>
                      <label className="text-sm font-bold sm:col-span-2">
                        บันทึกความคืบหน้า
                        <textarea
                          value={projectForm.project_note}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              project_note: e.target.value,
                            })
                          }
                          className="mt-1 h-20 w-full rounded-xl border p-3 font-normal"
                        />
                      </label>
                      <label className="text-sm font-bold sm:col-span-2">
                        แนบรูปหรือ PDF หลักฐาน (ไม่เกิน 10MB)
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={(e) =>
                            setProjectEvidenceFile(e.target.files?.[0] || null)
                          }
                          className="mt-1 w-full rounded-xl border p-3 font-normal"
                        />
                        {projectEvidenceFile && (
                          <span className="mt-1 block text-xs font-normal text-blue-700">
                            เลือกแล้ว: {projectEvidenceFile.name}
                          </span>
                        )}
                      </label>
                      <label className="text-sm font-bold sm:col-span-2">
                        หรือลิงก์เอกสารภายนอก (ถ้ามี)
                        <input
                          type="url"
                          value={projectForm.evidence_url}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              evidence_url: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-xl border p-3 font-normal"
                          placeholder="https://..."
                        />
                        {projectForm.evidence_url && (
                          <a
                            href={projectForm.evidence_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-sm font-bold text-blue-700 underline"
                          >
                            เปิดดูหลักฐานปัจจุบัน
                          </a>
                        )}
                      </label>
                    </div>
                    <button
                      disabled={saving}
                      onClick={saveProjectProgress}
                      className="w-full rounded-xl bg-blue-700 py-3 font-bold text-white disabled:opacity-50"
                    >
                      บันทึกความคืบหน้าโครงการ
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {!["resolved", "cancelled"].includes(selectedCase.status) && (
                  <div className="rounded-2xl border border-slate-200 p-5">
                    <div className="mb-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 font-black text-white">
                        {selectedCase.status === "pending" ? "1" : "2"}
                      </span>
                      <div>
                        <div className="font-black text-slate-950">
                          {selectedCase.status === "pending" ? "รับเรื่องและมอบหมายหน่วยงาน" : "บันทึกผลการดำเนินงาน"}
                        </div>
                        <div className="mt-0.5 text-sm text-slate-500">
                          {selectedCase.status === "pending"
                            ? "เลือกผู้รับผิดชอบและกำหนดเสร็จก่อนเริ่มงาน"
                            : "เมื่อดำเนินการเสร็จ ให้บันทึกผลและแนบรูปก่อนปิดเรื่อง"}
                        </div>
                      </div>
                    </div>
                    <div className="mb-4 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-bold">
                        หน่วยรับผิดชอบ
                        <select value={caseDepartment} onChange={(event) => setCaseDepartment(event.target.value)} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal">
                          <option value="">เลือกหน่วยรับผิดชอบ</option>
                          <option value="สำนักปลัด">สำนักปลัด</option>
                          <option value="กองช่าง">กองช่าง</option>
                          <option value="งานสาธารณสุข">งานสาธารณสุข</option>
                          <option value="งานป้องกันและบรรเทาสาธารณภัย">งานป้องกันและบรรเทาสาธารณภัย</option>
                          <option value="หน่วยงานภายนอก">หน่วยงานภายนอก</option>
                        </select>
                      </label>
                      <label className="text-sm font-bold">
                        กำหนดดำเนินการให้เสร็จ
                        <input type="datetime-local" value={caseDueAt} onChange={(event) => setCaseDueAt(event.target.value)} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal" />
                      </label>
                    </div>
                    <label className="text-sm font-bold">
                      {selectedCase.status === "pending" ? "รายละเอียดการมอบหมาย / แจ้งผู้เกี่ยวข้อง" : "ผลการดำเนินงานที่จะแจ้งประชาชน"}
                      <textarea
                        value={caseNote}
                        onChange={(event) => setCaseNote(event.target.value)}
                        className="mt-2 h-24 w-full resize-none rounded-xl border p-3 font-normal outline-none focus:border-blue-500"
                        placeholder={selectedCase.status === "pending" ? "เช่น มอบหมายกองช่างตรวจสอบและซ่อมภายในวันที่กำหนด" : "เช่น ซ่อมพื้นผิวถนนบริเวณดังกล่าวเรียบร้อยแล้ว"}
                      />
                    </label>
                    {selectedCase.status !== "pending" && (
                      <label className="mt-3 block text-sm font-bold">
                        รูปหลักฐานหลังดำเนินการ (จำเป็นก่อนปิดเรื่อง)
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) => setCaseResolvedImage(event.target.files?.[0] || null)}
                          className="mt-2 w-full rounded-xl border bg-white p-3 font-normal"
                        />
                      </label>
                    )}
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {selectedCase.status === "pending" ? (
                        <button
                          disabled={saving}
                          onClick={() => updateGeneralCase("in_progress")}
                          className="min-h-12 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50 sm:col-span-2"
                        >
                          ยืนยันรับเรื่อง
                        </button>
                      ) : (
                        <button
                          disabled={saving}
                          onClick={() => updateGeneralCase("resolved")}
                          className="min-h-12 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50 sm:col-span-2"
                        >
                          ยืนยันดำเนินการเสร็จ
                        </button>
                      )}
                      {selectedCase.status === "pending" && (
                        <button
                          disabled={saving || !caseNote.trim()}
                          onClick={() => updateGeneralCase("pending", "request_info")}
                          className="rounded-xl border border-amber-300 px-4 py-3 font-bold text-amber-800 disabled:opacity-40 sm:col-span-2"
                        >
                          ขอข้อมูลเพิ่มเติม
                        </button>
                      )}
                      <button
                        disabled={saving}
                        onClick={() => updateGeneralCase("cancelled")}
                        className="rounded-xl border border-red-300 px-4 py-3 font-bold text-red-700 disabled:opacity-50 sm:col-span-2"
                      >
                        ยุติเรื่อง
                      </button>
                    </div>
                  </div>
                )}
                {["resolved", "cancelled"].includes(selectedCase.status) && (
                  <div className="rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-700">
                    เรื่องนี้สิ้นสุดแล้ว: {getStatusLabel(selectedCase.status)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VillageOverviewDashboard({
  incidents,
  users,
  currentUser,
  setActiveTab,
}) {
  const pending = incidents.filter(
    (item) => item.status === "pending" && !item.requiresTao,
  );
  const forwarded = incidents.filter(
    (item) => item.requiresTao && !["resolved", "cancelled"].includes(item.status),
  );
  const overdue = forwarded.filter(
    (item) => item.dueAt && new Date(item.dueAt) < new Date(),
  );
  const resolved = incidents.filter((item) => item.status === "resolved");
  const suspendedResidents = users.filter(
    (item) => item.role === "user" && item.accountStatus === "suspended",
  ).length;
  const urgent = [...incidents]
    .filter((item) => item.status === "pending" && !item.requiresTao)
    .sort(
      (a, b) =>
        Number(b.priority || 1) - Number(a.priority || 1) ||
        new Date(a.date || 0) - new Date(b.date || 0),
    )
    .slice(0, 5);
  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-fadeIn">
      <section className="hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-black text-blue-600">
              หมู่ {currentUser?.villageMoo || "-"} {currentUser?.villageName || ""}
            </div>
            <h1 className="mt-1 text-2xl font-black text-slate-950 md:text-3xl">งานที่ต้องจัดการวันนี้</h1>
            <p className="mt-1 text-sm text-slate-500">ตรวจข้อมูลจากประชาชน ยืนยันพื้นที่ และส่งเรื่องให้ อบต. พร้อมดูแนวโน้มปัญหาของหมู่บ้าน</p>
          </div>
          <button onClick={() => setActiveTab("incidents")} className="min-h-12 rounded-xl bg-blue-600 px-5 py-3 font-black text-white shadow-sm hover:bg-blue-700">
            เปิดคิวงาน {pending.length ? `(${pending.length} เรื่องใหม่)` : ""}
          </button>
        </div>
      </section>
      <section className="hidden grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["รอตรวจสอบ", pending.length, "text-blue-700 bg-blue-50"],
          ["ส่งให้ อบต.แล้ว", forwarded.length, "text-amber-700 bg-amber-50"],
          ["เกินกำหนด", overdue.length, "text-red-700 bg-red-50"],
          ["เสร็จแล้ว", resolved.length, "text-emerald-700 bg-emerald-50"],
        ].map(([label, value, tone]) => (
          <div
            key={label}
            className={`rounded-2xl border p-4 shadow-sm ${tone}`}
          >
            <div className="text-3xl font-black">{value}</div>
            <div className="mt-1 text-sm font-bold">{label}</div>
          </div>
        ))}
      </section>
      <section className="hidden gap-3 md:grid-cols-2">
        <button
          onClick={() => setActiveTab("incidents")}
          className="rounded-2xl border bg-white p-5 text-left shadow-sm hover:border-blue-400"
        >
          <div className="text-sm font-bold text-blue-600">งานร้องทุกข์</div>
          <div className="mt-1 text-xl font-black">
            ตรวจข้อมูลและส่งเรื่องให้ อบต.
          </div>
          <div className="mt-2 text-sm text-slate-500">
            มี {pending.length} เรื่องรอตรวจสอบ
          </div>
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className="rounded-2xl border bg-white p-5 text-left shadow-sm hover:border-violet-400"
        >
          <div className="text-sm font-bold text-violet-600">บัญชีประชาชน</div>
          <div className="mt-1 text-xl font-black">ดูแลสมาชิกในหมู่บ้าน</div>
          <div className="mt-2 text-sm text-slate-500">
            {suspendedResidents} บัญชีถูกระงับ
          </div>
        </button>
      </section>
      <DecisionAnalyticsCenter
        incidents={incidents}
        scope="village"
      />
      <section className="hidden rounded-3xl border bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black">งานที่ควรตรวจสอบก่อน</h3>
            <p className="text-sm text-slate-500">
              เรียงจากความเร่งด่วนและวันที่แจ้ง
            </p>
          </div>
          <button
            onClick={() => setActiveTab("incidents")}
            className="text-sm font-bold text-blue-600"
          >
            ดูทั้งหมด →
          </button>
        </div>
        <div className="divide-y">
          {urgent.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab("incidents")}
              className="grid w-full gap-2 py-4 text-left sm:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="font-black">{item.title}</div>
                <div className="text-sm text-slate-500">
                  {item.location} · {item.category}
                </div>
              </div>
              <div className="sm:text-right">
                <StatusBadge status={item.status} />
                <div className="mt-1 text-xs text-slate-400">
                  {formatThaiDateTime(item.date)} น.
                </div>
              </div>
            </button>
          ))}
          {!urgent.length && (
            <div className="py-10 text-center text-slate-500">
              ไม่มีงานค้างในขณะนี้
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function VillageBudgetWorkspace({ incidents, setIncidents }) {
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    project_title: "",
    reason: "",
    affected_people: "",
    urgency: "normal",
    estimated_amount: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    actual_amount: "",
    document_reference: "",
  });
  const [expenseEvidence, setExpenseEvidence] = useState(null);
  const [saving, setSaving] = useState(false);
  const selected = incidents.find((item) => item.id === selectedId) || null;
  const candidates = incidents.filter((item) => {
    const incidentClosed = ["resolved", "cancelled"].includes(item.status);
    const requestStatus = item.budgetRequest?.status;
    const hasSubmittedHistory = requestStatus && requestStatus !== "draft";

    // Closed work without a real submission must not remain in the request queue.
    // A submitted request is kept as an auditable history even after work closes.
    return !incidentClosed || hasSubmittedHistory;
  });
  const visible = candidates.filter((item) => {
    const status = item.budgetRequest?.status || "not_requested";
    return filter === "all" || status === filter;
  });
  const statusLabel = (status) =>
    ({
      not_requested: "ยังไม่ยื่นคำขอ",
      draft: "ฉบับร่าง",
      submitted: "รอ อบต. พิจารณา",
      approved: "อนุมัติแล้ว",
      rejected: "ส่งกลับให้แก้ไข",
      completed: "บันทึกผลแล้ว",
    })[status || "not_requested"] || status;
  const statusTone = (status) =>
    ({
      submitted: "bg-amber-100 text-amber-800",
      approved: "bg-emerald-100 text-emerald-800",
      rejected: "bg-red-100 text-red-800",
      completed: "bg-blue-100 text-blue-800",
    })[status] || "bg-slate-100 text-slate-700";
  const selectIncident = (item) => {
    setSelectedId(item.id);
    setForm({
      project_title: item.budgetRequest?.project_title || item.title || "",
      reason: item.budgetRequest?.reason || "",
      affected_people: item.budgetRequest?.affected_people || "",
      urgency: item.budgetRequest?.urgency || "normal",
      estimated_amount: item.budgetRequest?.estimated_amount || "",
    });
    setExpenseForm({
      actual_amount: item.budgetRequest?.actual_amount ?? "",
      document_reference: item.budgetRequest?.document_reference || "",
    });
    setExpenseEvidence(null);
  };
  const submitBudget = async (event) => {
    event.preventDefault();
    if (
      !form.project_title.trim() ||
      !form.reason.trim() ||
      Number(form.affected_people) <= 0 ||
      Number(form.estimated_amount) <= 0
    )
      return alert("กรอกชื่อโครงการ เหตุผล ผู้ได้รับผลกระทบ และงบประมาณให้ครบ");
    setSaving(true);
    try {
      const updated = normalizeIncident(
        await api.saveIncidentBudget(selected.id, {
          project_title: form.project_title.trim(),
          reason: form.reason.trim(),
          affected_people: Number(form.affected_people),
          urgency: form.urgency,
          estimated_amount: Number(form.estimated_amount),
          items: [],
          submit: true,
        }),
      );
      setIncidents((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelectedId(updated.id);
      alert("ส่งข้อเสนอโครงการให้ อบต.พิจารณาแล้ว");
    } catch (error) {
      alert(error?.message || "ส่งคำของบประมาณไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const saveActualExpense = async (event) => {
    event.preventDefault();
    const actual = Number(expenseForm.actual_amount);
    const approved = Number(selected?.budgetRequest?.approved_amount || 0);
    if (expenseForm.actual_amount === "" || actual < 0)
      return alert("กรุณาระบุยอดใช้จริง");
    if (actual > approved)
      return alert("ยอดใช้จริงเกินวงเงินอนุมัติ กรุณาติดต่อ อบต.");
    if (!expenseEvidence && !expenseForm.document_reference.trim() && !selected?.budgetRequest?.evidence_url)
      return alert("กรุณาแนบหลักฐานหรือระบุเลขที่เอกสาร");

    const payload = new FormData();
    payload.append("actual_amount", String(actual));
    if (expenseForm.document_reference.trim())
      payload.append("document_reference", expenseForm.document_reference.trim());
    if (expenseEvidence) payload.append("evidence", expenseEvidence);

    setSaving(true);
    try {
      const updated = normalizeIncident(
        await api.recordBudgetActual(selected.id, payload),
      );
      setIncidents((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelectedId(updated.id);
      setExpenseEvidence(null);
      setExpenseForm({
        actual_amount: updated.budgetRequest?.actual_amount ?? "",
        document_reference: updated.budgetRequest?.document_reference || "",
      });
      alert("บันทึกยอดใช้จริงและหลักฐานแล้ว");
    } catch (error) {
      alert(error?.message || "บันทึกค่าใช้จ่ายจริงไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (selected) {
    const request = selected.budgetRequest;
    const editable = !["submitted", "approved", "completed"].includes(
      request?.status,
    );
    return (
      <div className="mx-auto max-w-5xl space-y-5 animate-fadeIn">
        <button
          onClick={() => setSelectedId(null)}
          className="rounded-xl border bg-white px-4 py-2.5 font-bold text-slate-700"
        >
          ← กลับไปรายการโครงการ
        </button>
        <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-bold text-blue-600">
                ข้อเสนอโครงการจากเรื่อง{" "}
                {selected.referenceNo || `#${selected.id}`}
              </div>
              <h2 className="mt-1 text-2xl font-black">
                {request?.project_title || selected.title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {selected.location} · {selected.category}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${statusTone(request?.status)}`}
            >
              {statusLabel(request?.status)}
            </span>
          </div>

          {editable ? (
            <form onSubmit={submitBudget} className="mt-6 space-y-4">
              {request?.status === "rejected" && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
                  <div className="font-black">อบต. ส่งกลับให้แก้ไข</div>
                  <div className="mt-1 text-sm">
                    {request.review_note ||
                      "กรุณาตรวจสอบและแก้ไขรายละเอียดคำขอ"}
                  </div>
                </div>
              )}
              <label className="block text-sm font-bold text-slate-700">
                ชื่อโครงการ
                <input
                  value={form.project_title}
                  onChange={(event) =>
                    setForm({ ...form, project_title: event.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border p-3 font-normal"
                  placeholder="เช่น โครงการซ่อมแซมถนนบริเวณหน้าเซเว่น"
                />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                เหตุผล ความจำเป็น และขอบเขตงาน
                <textarea
                  value={form.reason}
                  onChange={(event) =>
                    setForm({ ...form, reason: event.target.value })
                  }
                  className="mt-1.5 h-32 w-full rounded-xl border p-3 font-normal"
                  placeholder="อธิบายว่าเหตุใดหมู่บ้านดำเนินการเองไม่ได้ และจะนำงบไปใช้อะไร"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-bold text-slate-700">
                  ผู้ได้รับผลกระทบโดยประมาณ (คน)
                  <input
                    type="number"
                    min="1"
                    value={form.affected_people}
                    onChange={(event) =>
                      setForm({ ...form, affected_people: event.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border p-3 font-normal"
                  />
                </label>
                <label className="text-sm font-bold text-slate-700">
                  ความเร่งด่วน
                  <select
                    value={form.urgency}
                    onChange={(event) =>
                      setForm({ ...form, urgency: event.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border p-3 font-normal"
                  >
                    <option value="normal">ปกติ</option>
                    <option value="urgent">เร่งด่วน</option>
                    <option value="critical">เร่งด่วนมาก</option>
                  </select>
                </label>
                <label className="text-sm font-bold text-slate-700">
                  งบประมาณที่เสนอ (บาท)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.estimated_amount}
                    onChange={(event) =>
                      setForm({ ...form, estimated_amount: event.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border p-3 font-normal"
                    placeholder="เช่น 5000"
                  />
                </label>
              </div>
              <button
                disabled={saving}
                className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50 sm:w-auto"
              >
                {saving ? "กำลังส่ง..." : "ส่งข้อเสนอโครงการให้ อบต."}
              </button>
            </form>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-bold text-slate-500">
                    เหตุผลและขอบเขตงาน
                  </div>
                  <div className="mt-1 whitespace-pre-wrap font-medium">
                    {request.reason}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500">
                    งบประมาณที่หมู่บ้านเสนอ
                  </div>
                  <div className="mt-1 text-2xl font-black text-emerald-700">
                    {Number(request.estimated_amount || 0).toLocaleString(
                      "th-TH",
                    )}{" "}
                    บาท
                  </div>
                </div>
              </div>
              {request.status === "submitted" ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 font-bold text-amber-800">
                  ส่งคำขอแล้ว กำลังรอ อบต. พิจารณา
                </div>
              ) : (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <h3 className="font-black text-blue-950">
                    ผลการพิจารณาจาก อบต.
                  </h3>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">วงเงินอนุมัติ</dt>
                      <dd className="font-black">
                        {Number(request.approved_amount || 0).toLocaleString(
                          "th-TH",
                        )}{" "}
                        บาท
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">ปีงบประมาณ</dt>
                      <dd className="font-bold">
                        {request.fiscal_year || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">แหล่งงบประมาณ</dt>
                      <dd className="font-bold">
                        {request.funding_source || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">เลขที่เอกสาร</dt>
                      <dd className="font-bold">
                        {request.document_reference || "-"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-slate-500">หมายเหตุ</dt>
                      <dd className="font-bold">
                        {request.review_note || "-"}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {request.status === "approved" && request.project_status !== "waiting_review" && (
                <form onSubmit={saveActualExpense} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
                  <h3 className="font-black text-emerald-950">
                    บันทึกค่าใช้จ่ายจริงของหมู่บ้าน
                  </h3>
                  <p className="mt-1 text-sm text-emerald-800">
                    กรอกยอดที่จ่ายจริงและแนบใบเสร็จหรือหลักฐาน ระบบจะคำนวณเงินคงเหลือจากวงเงินอนุมัติ
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-bold text-slate-700">
                      ยอดใช้จริง (บาท)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={expenseForm.actual_amount}
                        onChange={(event) => setExpenseForm({ ...expenseForm, actual_amount: event.target.value })}
                        className="mt-1.5 w-full rounded-xl border border-emerald-200 bg-white p-3 font-normal outline-none focus:border-emerald-500"
                        placeholder="เช่น 2500"
                      />
                    </label>
                    <label className="text-sm font-bold text-slate-700">
                      เลขที่ใบเสร็จ/เอกสาร (ถ้ามี)
                      <input
                        value={expenseForm.document_reference}
                        onChange={(event) => setExpenseForm({ ...expenseForm, document_reference: event.target.value })}
                        className="mt-1.5 w-full rounded-xl border border-emerald-200 bg-white p-3 font-normal outline-none focus:border-emerald-500"
                        placeholder="เช่น INV-2569-001"
                      />
                    </label>
                    <label className="text-sm font-bold text-slate-700 sm:col-span-2">
                      แนบใบเสร็จหรือหลักฐาน (รูปภาพ/PDF ไม่เกิน 10MB)
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(event) => setExpenseEvidence(event.target.files?.[0] || null)}
                        className="mt-1.5 w-full rounded-xl border border-emerald-200 bg-white p-3 font-normal"
                      />
                    </label>
                  </div>
                  {expenseForm.actual_amount !== "" && (
                    <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${Number(expenseForm.actual_amount) <= Number(request.approved_amount || 0) ? "bg-white text-emerald-800" : "bg-red-100 text-red-700"}`}>
                      {Number(expenseForm.actual_amount) <= Number(request.approved_amount || 0)
                        ? `เงินคงเหลือ ${Math.max(0, Number(request.approved_amount || 0) - Number(expenseForm.actual_amount || 0)).toLocaleString("th-TH")} บาท`
                        : `เกินวงเงินอนุมัติ ${(Number(expenseForm.actual_amount) - Number(request.approved_amount || 0)).toLocaleString("th-TH")} บาท`}
                    </div>
                  )}
                  <div className="mt-4 flex flex-col gap-3 border-t border-emerald-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      {request.evidence_url ? (
                        <button type="button" onClick={() => setSelectedEvidence(normalizeMediaUrl(request.evidence_url))} className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
                          <FileText className="mr-2 h-4 w-4" /> ดูหลักฐานที่บันทึกไว้
                        </button>
                      ) : (
                        <span className="text-sm text-emerald-800">ยังไม่มีหลักฐานที่บันทึก</span>
                      )}
                    </div>
                    <button
                      disabled={saving}
                      className="min-h-12 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50 sm:w-auto"
                    >
                      {saving ? "กำลังส่ง..." : "ส่งยอดให้ อบต. ตรวจสอบ"}
                    </button>
                  </div>
                </form>
              )}
              {request.status === "approved" && request.project_status === "waiting_review" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                  <div className="font-black">ส่งยอดแล้ว กำลังรอ อบต. ตรวจสอบ</div>
                  <div className="mt-1 text-sm">
                    ยอดใช้จริง {Number(request.actual_amount || 0).toLocaleString("th-TH")} บาท · เงินคงเหลือ {Math.max(0, Number(request.approved_amount || 0) - Number(request.actual_amount || 0)).toLocaleString("th-TH")} บาท
                  </div>
                  {request.evidence_url && (
                    <button type="button" onClick={() => setSelectedEvidence(normalizeMediaUrl(request.evidence_url))} className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-blue-700">
                      <FileText className="mr-2 h-4 w-4" /> ดูหลักฐานที่ส่งแล้ว
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
        {selectedEvidence && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
            onMouseDown={() => setSelectedEvidence(null)}
          >
            <div
              className="relative flex h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex min-h-16 items-center justify-between border-b bg-white px-4 sm:px-5">
                <h3 className="font-black text-slate-900">หลักฐานค่าใช้จ่าย</h3>
                <button
                  type="button"
                  onClick={() => setSelectedEvidence(null)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-700 hover:bg-slate-200"
                >
                  <X className="h-5 w-5" /> ปิด
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
                {/\.pdf(?:\?|$)/i.test(selectedEvidence) ? (
                  <iframe src={selectedEvidence} title="หลักฐานค่าใช้จ่าย PDF" className="h-full min-h-[70dvh] w-full rounded-xl bg-white" />
                ) : (
                  <img src={selectedEvidence} alt="หลักฐานค่าใช้จ่าย" className="mx-auto max-h-full max-w-full rounded-xl object-contain shadow" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const requestedCount = candidates.filter(
    (item) => item.budgetRequest && item.budgetRequest.status !== "draft",
  ).length;
  const waitingCount = candidates.filter(
    (item) => item.budgetRequest?.status === "submitted",
  ).length;
  const approvedCount = candidates.filter((item) =>
    ["approved", "completed"].includes(item.budgetRequest?.status),
  ).length;
  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-fadeIn">
      <section className="rounded-3xl bg-gradient-to-br from-emerald-950 to-slate-950 p-6 text-white shadow-xl md:p-8">
        <div className="text-sm font-bold text-emerald-200">
          ข้อเสนอโครงการของหมู่บ้าน
        </div>
        <h2 className="mt-1 text-3xl font-black">
          เสนอปัญหาเป็นโครงการให้ อบต.
        </h2>
        <p className="mt-2 text-slate-300">
          ใช้เฉพาะเรื่องที่หมู่บ้านแก้เองไม่ได้และจำเป็นต้องจัดทำโครงการพร้อมงบประมาณ
        </p>
      </section>
      <section className="grid grid-cols-3 gap-3">
        {[
          ["เรื่องที่ยื่นได้/มีประวัติ", candidates.length],
          ["ส่งคำขอแล้ว", requestedCount],
          ["อนุมัติแล้ว", approvedCount],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border bg-white p-4 shadow-sm"
          >
            <div className="text-2xl font-black">{value}</div>
            <div className="text-xs text-slate-500 sm:text-sm">{label}</div>
          </div>
        ))}
      </section>
      <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
        <div className="flex gap-2 overflow-x-auto pb-4">
          {[
            ["all", "ทั้งหมด"],
            ["not_requested", "ยังไม่ยื่น"],
            ["submitted", `รอพิจารณา ${waitingCount}`],
            ["approved", "อนุมัติแล้ว"],
            ["rejected", "ต้องแก้ไข"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold ${filter === id ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((item) => (
            <button
              key={item.id}
              onClick={() => selectIncident(item)}
              className="rounded-2xl border p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-blue-600">
                    {item.referenceNo || `#${item.id}`}
                  </div>
                  <div className="mt-1 font-black">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {item.location}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(item.budgetRequest?.status)}`}
                >
                  {statusLabel(item.budgetRequest?.status)}
                </span>
              </div>
            </button>
          ))}
          {!visible.length && (
            <div className="py-12 text-center text-slate-500 md:col-span-2">
              ไม่มีรายการในสถานะนี้
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function AdminDashboard({
  activeTab,
  setActiveTab,
  news,
  setNews,
  incidents,
  setIncidents,
  setNotifications,
  users,
  setUsers,
  budgetSettings,
  setBudgetSettings,
  villages,
  currentUser,
  villageMode = false,
}) {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [incidentSearch, setIncidentSearch] = useState("");
  const [incidentCategory, setIncidentCategory] = useState("all");
  const [incidentStatus, setIncidentStatus] = useState("all");
  const [incidentDateFrom, setIncidentDateFrom] = useState("");
  const [incidentDateTo, setIncidentDateTo] = useState("");
  const [incidentPage, setIncidentPage] = useState(1);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({
    name: "",
    phone: "",
    email: "",
    village_id: "",
    password: "",
    passwordConfirmation: "",
  });
  const [staffSaving, setStaffSaving] = useState(false);
  const [passwordPerson, setPasswordPerson] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmation: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);

  // News Form State
  const [editingNews, setEditingNews] = useState(null); // null = list view, object = form view
  const [newsForm, setNewsForm] = useState({
    title: "",
    content: "",
    image: "",
    date: "",
  });
  const [newsImageFile, setNewsImageFile] = useState(null);
  const [newsImagePreview, setNewsImagePreview] = useState(null);

  // Mobile Tabs
  const adminTabs = [
    { id: "stats", label: "สถิติ", icon: <PieChart className="w-4 h-4" /> },
    {
      id: "analytics",
      label: "วิเคราะห์",
      icon: <PieChart className="w-4 h-4" />,
    },
    {
      id: "incidents",
      label: "แจ้งเหตุ",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    { id: "budgets", label: "ของบ", icon: <FileText className="w-4 h-4" /> },
    { id: "news", label: "ข่าวสาร", icon: <Bell className="w-4 h-4" /> },
    { id: "users", label: "ผู้ใช้งาน", icon: <Users className="w-4 h-4" /> },
    { id: "reports", label: "รายงาน", icon: <FileText className="w-4 h-4" /> },
  ];

  // --- Stats Logic ---
  const total = incidents.length;
  const pending = incidents.filter((i) => i.status === "pending").length;
  const inProgress = incidents.filter((i) =>
    [
      "assigned",
      "in_progress",
      "waiting_review",
      "revision_requested",
    ].includes(i.status),
  ).length;
  const resolved = incidents.filter((i) => i.status === "resolved").length;
  const cancelled = incidents.filter((i) => i.status === "cancelled").length;
  const incidentPageSize = 10;
  const filteredAdminIncidents = [...incidents]
    .filter((incident) => {
      const query = incidentSearch.trim().toLowerCase();
      const created = incident.date ? new Date(incident.date) : null;
      const from = incidentDateFrom
        ? new Date(`${incidentDateFrom}T00:00:00`)
        : null;
      const to = incidentDateTo ? new Date(`${incidentDateTo}T23:59:59`) : null;
      const matchesSearch =
        !query ||
        [
          incident.title,
          incident.userName,
          incident.location,
          incident.id,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query),
        );
      return (
        matchesSearch &&
        (incidentCategory === "all" ||
          incident.category === incidentCategory) &&
        (incidentStatus === "all" || incident.status === incidentStatus) &&
        (!from || (created && created >= from)) &&
        (!to || (created && created <= to))
      );
    })
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const incidentTotalPages = Math.max(
    1,
    Math.ceil(filteredAdminIncidents.length / incidentPageSize),
  );
  const safeIncidentPage = Math.min(incidentPage, incidentTotalPages);
  const pagedAdminIncidents = filteredAdminIncidents.slice(
    (safeIncidentPage - 1) * incidentPageSize,
    safeIncidentPage * incidentPageSize,
  );
  const resetIncidentFilters = () => {
    setIncidentSearch("");
    setIncidentCategory("all");
    setIncidentStatus("all");
    setIncidentDateFrom("");
    setIncidentDateTo("");
    setIncidentPage(1);
  };

  const pPending = total === 0 ? 0 : (pending / total) * 100;
  const pInProgress = total === 0 ? 0 : (inProgress / total) * 100;
  const pResolved = total === 0 ? 0 : (resolved / total) * 100;
  const pCancelled = total === 0 ? 0 : (cancelled / total) * 100;
  const now = Date.now();
  const closedStatuses = ["resolved", "cancelled"];
  const openIncidents = incidents.filter(
    (i) => !closedStatuses.includes(i.status),
  );
  const unresolvedCount = openIncidents.length;
  const validHoursDiff = (start, end) => {
    const value = getHoursDiff(start, end);
    return value != null && Number.isFinite(value) ? value : null;
  };
  const ageHours = (incident) =>
    validHoursDiff(incident.date, new Date(now).toISOString());
  const median = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  const spatialAnalytics = Object.values(
    incidents.reduce((acc, inc) => {
      const key = inc.location;
      if (!acc[key]) {
        acc[key] = {
          location: inc.location,
          lat: inc.lat,
          lng: inc.lng,
          count: 0,
          pending: 0,
          active: 0,
          resolved: 0,
          cancelled: 0,
        };
      }
      acc[key].count += 1;
      if (inc.status === "pending") acc[key].pending += 1;
      else if (inc.status === "resolved") acc[key].resolved += 1;
      else if (inc.status === "cancelled") acc[key].cancelled += 1;
      else acc[key].active += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);

  const issueBreakdown = Object.values(
    incidents.reduce((acc, inc) => {
      if (!acc[inc.category]) {
        acc[inc.category] = { category: inc.category, count: 0 };
      }
      acc[inc.category].count += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);

  const firstResponseHours = incidents
    .map((inc) => validHoursDiff(inc.date, inc.firstResponseAt))
    .filter((hours) => hours != null);

  const resolveHours = incidents
    .filter((inc) => inc.status === "resolved")
    .map((inc) => validHoursDiff(inc.date, inc.resolvedAt))
    .filter((hours) => hours != null);

  const medianFirstResponse = median(firstResponseHours);
  const medianResolveTime = median(resolveHours);
  const responseSlaPopulation = incidents.filter(
    (inc) =>
      inc.firstResponseAt || (ageHours(inc) != null && ageHours(inc) > 1),
  );
  const resolveSlaPopulation = incidents.filter(
    (inc) =>
      inc.status === "resolved" ||
      (!closedStatuses.includes(inc.status) &&
        ageHours(inc) != null &&
        ageHours(inc) > 24),
  );
  const responseWithinTarget = responseSlaPopulation.filter(
    (inc) =>
      inc.firstResponseAt && validHoursDiff(inc.date, inc.firstResponseAt) <= 1,
  ).length;
  const resolveWithinTarget = resolveSlaPopulation.filter(
    (inc) =>
      inc.status === "resolved" &&
      validHoursDiff(inc.date, inc.resolvedAt) <= 24,
  ).length;
  const responseCompliance = responseSlaPopulation.length
    ? Math.round((responseWithinTarget / responseSlaPopulation.length) * 100)
    : null;
  const resolveCompliance = resolveSlaPopulation.length
    ? Math.round((resolveWithinTarget / resolveSlaPopulation.length) * 100)
    : null;
  const overdueResponseCount = openIncidents.filter(
    (inc) => !inc.firstResponseAt && ageHours(inc) > 1,
  ).length;
  const overdueResolveCount = openIncidents.filter(
    (inc) => ageHours(inc) > 24,
  ).length;

  const oldestOpenIncident = [...incidents]
    .filter((inc) => !closedStatuses.includes(inc.status))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  const recurrenceSignals = Object.values(
    incidents.reduce((acc, inc) => {
      const key = `${inc.location}-${inc.category}`;
      if (!acc[key]) {
        acc[key] = {
          id: key,
          location: inc.location,
          category: inc.category,
          count: 0,
          riskScore: 0,
        };
      }
      const statusWeight =
        inc.status === "cancelled" ? 0 : inc.status === "resolved" ? 1 : 2;
      acc[key].count += 1;
      acc[key].riskScore += statusWeight;
      return acc;
    }, {}),
  ).sort((a, b) => b.riskScore - a.riskScore);

  const reportQualityScoring = Object.values(
    incidents.reduce((acc, inc) => {
      if (!acc[inc.userId]) {
        acc[inc.userId] = {
          userId: inc.userId,
          userName: inc.userName,
          totalReports: 0,
          withImage: 0,
          detailedReports: 0,
          withLocation: 0,
        };
      }

      acc[inc.userId].totalReports += 1;
      if (inc.image) acc[inc.userId].withImage += 1;
      if ((inc.description || "").length >= 30)
        acc[inc.userId].detailedReports += 1;
      if (
        inc.location &&
        Number.isFinite(Number(inc.lat)) &&
        Number.isFinite(Number(inc.lng))
      )
        acc[inc.userId].withLocation += 1;
      return acc;
    }, {}),
  )
    .map((user) => {
      const imageRatio = user.withImage / user.totalReports;
      const detailRatio = user.detailedReports / user.totalReports;
      const locationRatio = user.withLocation / user.totalReports;
      const score = Math.round(
        imageRatio * 35 + detailRatio * 35 + locationRatio * 30,
      );
      return { ...user, score, meta: getCredibilityMeta(score) };
    })
    .sort((a, b) => b.score - a.score);

  const keywordUrgencyAnalytics = openIncidents
    .map((inc) => {
      const score = getSentimentScore(inc.description);
      return {
        ...inc,
        sentimentScore: score,
        sentimentMeta: getSentimentMeta(score),
      };
    })
    .sort((a, b) => b.sentimentScore - a.sentimentScore);

  const topHotspot = spatialAnalytics[0];
  const topPrediction = recurrenceSignals[0];
  const topEmotionalCase = keywordUrgencyAnalytics[0];
  const topIssueCategory = issueBreakdown[0];
  const budgetRecommendations = issueBreakdown.map((item) => ({
    ...item,
    percent: Math.round((item.count / Math.max(total, 1)) * 100),
    owner: item.category.includes("ไฟ")
      ? "ทีมไฟฟ้า"
      : item.category.includes("น้ำ")
        ? "ทีมประปา"
        : item.category.includes("ความสะอาด")
          ? "ทีมสิ่งแวดล้อม"
          : "ทีมช่างชุมชน",
  }));
  const priorityQueue = openIncidents
    .map((inc) => {
      const hotspotWeight =
        spatialAnalytics.find((area) => area.location === inc.location)
          ?.count || 1;
      const urgency = getSentimentScore(inc.description);
      const ageWeight = Math.min(Math.floor((ageHours(inc) || 0) / 12), 10);
      const statusWeight =
        inc.status === "pending"
          ? 3
          : inc.status === "revision_requested"
            ? 2.5
            : 2;
      const priorityScore = Math.round(
        Number(inc.priority || 1) * 20 +
          statusWeight * 10 +
          hotspotWeight * 5 +
          urgency * 4 +
          ageWeight,
      );
      const lane =
        priorityScore >= 90
          ? "Critical"
          : priorityScore >= 75
            ? "High"
            : "Normal";
      return { ...inc, priorityScore, lane };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3);
  const predictivePlan = recurrenceSignals.slice(0, 3).map((item) => ({
    ...item,
    riskLevel:
      item.riskScore >= 7 ? "สูง" : item.riskScore >= 4 ? "กลาง" : "ต่ำ",
  }));

  // CSS for Mock Pie Chart
  const pieStyle = {
    background: `conic-gradient(
      #EAB308 0% ${pPending}%, 
      #3B82F6 ${pPending}% ${pPending + pInProgress}%, 
      #22C55E ${pPending + pInProgress}% ${pPending + pInProgress + pResolved}%,
      #94A3B8 ${pPending + pInProgress + pResolved}% ${pPending + pInProgress + pResolved + pCancelled}%
    )`,
  };

  // --- Incident Handlers ---
  const updateIncidentStatus = async (
    id,
    newStatus,
    resolvedImageFile = null,
    resolvedImagePreview = null,
  ) => {
    const previousIncidents = incidents;
    const optimisticTime = new Date().toISOString();
    setIncidents((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: newStatus,
              firstResponseAt:
                item.firstResponseAt ||
                (newStatus !== "pending" ? optimisticTime : null),
              resolvedAt: newStatus === "resolved" ? optimisticTime : null,
              resolvedImage: resolvedImagePreview || item.resolvedImage,
            }
          : item,
      ),
    );
    setSelectedIncident(null);
    let savedIncident = null;
    try {
      let payload = { status: newStatus };
      if (resolvedImageFile) {
        payload = new FormData();
        payload.append("status", newStatus);
        payload.append("resolvedImage", resolvedImageFile);
      }
      const data = await api.updateIncidentStatus(id, payload);
      savedIncident = normalizeIncident(data);
    } catch (error) {
      if (!USE_MOCK_DATA) {
        setIncidents(previousIncidents);
        alert(error?.message || "อัปเดตสถานะไม่สำเร็จ");
        return;
      }
    }

    const updated = incidents.map((inc) => {
      if (inc.id === id) {
        // Send Notification
        let statusText =
          newStatus === "in_progress" ? "กำลังดำเนินการ" : "แก้ไขเรียบร้อยแล้ว";
        setNotifications((prev) => [
          {
            id: "n" + Date.now(),
            title: `อัปเดตงาน: ${inc.title}`,
            desc: `สถานะเปลี่ยนเป็น: ${statusText}`,
            isRead: false,
            time: "เพิ่งกระทำ",
          },
          ...prev,
        ]);

        return {
          ...inc,
          status: newStatus,
          firstResponseAt:
            inc.firstResponseAt ||
            (newStatus !== "pending" ? new Date().toISOString() : null),
          resolvedAt:
            newStatus === "resolved" ? new Date().toISOString() : null,
          resolvedImage:
            savedIncident?.resolvedImage ||
            resolvedImagePreview ||
            inc.resolvedImage,
        };
      }
      return inc;
    });
    setIncidents(
      savedIncident
        ? previousIncidents.map((item) =>
            item.id === id ? savedIncident : item,
          )
        : updated,
    );
    setSelectedIncident(null);
  };

  const deleteIncident = async (id, reason) => {
    const cleanReason = reason?.trim();
    if (!cleanReason) return alert("กรุณาระบุเหตุผลที่ยุติเรื่อง");

    try {
      const data = await api.updateIncidentStatus(id, {
        status: "cancelled",
        note: `ยุติเรื่อง: ${cleanReason}`,
      });
      const cancelledIncident = normalizeIncident(data);
      setIncidents((items) =>
        items.map((item) => item.id === id ? cancelledIncident : item),
      );
    } catch (error) {
      if (!USE_MOCK_DATA) {
        alert(error?.message || "ยุติรายการไม่สำเร็จ");
        return;
      }
      setIncidents((items) => items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "cancelled",
              histories: [
                ...(item.histories || []),
                {
                  id: `cancel-${Date.now()}`,
                  created_at: new Date().toISOString(),
                  from_status: item.status,
                  to_status: "cancelled",
                  note: `ยุติเรื่อง: ${cleanReason}`,
                },
              ],
            }
          : item,
      ));
    }
    setSelectedIncident(null);
    alert("ยุติเรื่องและแจ้งเหตุผลให้ผู้ใช้แล้ว");
  };

  // --- News Handlers ---
  const saveNews = async (e) => {
    e.preventDefault();
    const payload = new FormData();
    payload.append("title", newsForm.title);
    payload.append("content", newsForm.content);
    if (newsImageFile) payload.append("image", newsImageFile);
    let savedNews = {
      ...editingNews,
      ...newsForm,
      image: newsImagePreview || newsForm.image,
      date: new Date().toISOString(),
    };
    try {
      const data = await api.saveNews(payload, editingNews.id || null);
      savedNews = normalizeNews(data.news);
    } catch (error) {
      if (!USE_MOCK_DATA) {
        alert(error?.message || "บันทึกข่าวไม่สำเร็จ");
        return;
      }
    }
    if (editingNews.id)
      setNews(
        news.map((item) => (item.id === editingNews.id ? savedNews : item)),
      );
    else setNews([savedNews, ...news]);
    if (newsImagePreview?.startsWith("blob:"))
      URL.revokeObjectURL(newsImagePreview);
    setNewsImageFile(null);
    setNewsImagePreview(null);
    setEditingNews(null);
  };

  const handleNewsImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      event.target.value = "";
      return alert("รูปข่าวต้องมีขนาดไม่เกิน 10MB");
    }
    if (newsImagePreview?.startsWith("blob:"))
      URL.revokeObjectURL(newsImagePreview);
    setNewsImageFile(file);
    setNewsImagePreview(URL.createObjectURL(file));
  };

  const deleteNews = async (id) => {
    if (window.confirm("ยืนยันการลบข่าวสารนี้?")) {
      try {
        await api.deleteNews(id);
      } catch (error) {
        if (!USE_MOCK_DATA) {
          alert(error?.message || "ลบข่าวไม่สำเร็จ");
          return;
        }
      }
      setNews(news.filter((n) => n.id !== id));
    }
  };

  const startEditNews = (n = { title: "", content: "", image: "" }) => {
    setEditingNews(n);
    setNewsForm({ title: n.title, content: n.content, image: n.image });
    setNewsImageFile(null);
    setNewsImagePreview(n.image || null);
  };

  // --- User Handlers ---
  const updateUserAccountStatus = async (id, accountStatus) => {
    const labels = {
      approved: "อนุมัติ",
      rejected: "ปฏิเสธ",
      suspended: "ระงับ",
      pending: "รอตรวจสอบ",
    };
    if (!window.confirm(`ยืนยันการ${labels[accountStatus]}บัญชีนี้?`)) return;
    const previousUsers = users;
    setUsers((items) =>
      items.map((user) => (user.id === id ? { ...user, accountStatus } : user)),
    );
    try {
      const data = await api.updateUserStatus(id, accountStatus);
      const updated = normalizeUser(data.user);
      setUsers(users.map((user) => (user.id === id ? updated : user)));
    } catch (error) {
      setUsers(previousUsers);
      alert(error?.message || "อัปเดตสถานะบัญชีไม่สำเร็จ");
    }
  };

  const openPasswordForm = (person) => {
    setPasswordPerson(person);
    setPasswordForm({ password: "", confirmation: "" });
  };

  const resetUserPassword = async (event) => {
    if (event && typeof event === "object" && "id" in event) {
      openPasswordForm(event);
      return;
    }
    event.preventDefault();
    if (!passwordPerson) return;
    if (passwordForm.password.length < 8)
      return alert("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    if (passwordForm.password !== passwordForm.confirmation)
      return alert("รหัสผ่านทั้งสองครั้งไม่ตรงกัน");
    setPasswordSaving(true);
    try {
      await api.resetUserPassword(passwordPerson.id, passwordForm.password);
      setPasswordPerson(null);
      alert(
        "ตั้งรหัสผ่านใหม่สำเร็จ กรุณาแจ้งรหัสผ่านใหม่ให้เจ้าของบัญชีโดยตรง",
      );
    } catch (error) {
      alert(error?.message || "ไม่สามารถตั้งรหัสผ่านใหม่ได้");
    } finally {
      setPasswordSaving(false);
    }
  };

  const createStaffAccount = async (event) => {
    if (event?.type === "click" && !staffFormOpen) {
      setStaffFormOpen(true);
      return;
    }
    event.preventDefault();
    if (!staffForm.name.trim() || !staffForm.phone.trim())
      return alert("กรอกชื่อและบัญชีเข้าสู่ระบบให้ครบ");
    if (staffForm.password.length < 8)
      return alert("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    if (staffForm.password !== staffForm.passwordConfirmation)
      return alert("รหัสผ่านทั้งสองครั้งไม่ตรงกัน");
    setStaffSaving(true);
    try {
      if (!staffForm.village_id) return alert("กรุณาเลือกหมู่บ้านที่รับผิดชอบ");
      const data = await api.createStaff({
        name: staffForm.name.trim(),
        phone: staffForm.phone.trim(),
        email: staffForm.email.trim(),
        village_id: Number(staffForm.village_id),
        password: staffForm.password,
      });
      setUsers((prev) => [normalizeUser(data.user), ...prev]);
      setStaffFormOpen(false);
      setStaffForm({
        name: "",
        phone: "",
        email: "",
        village_id: "",
        password: "",
        passwordConfirmation: "",
      });
      alert("สร้างบัญชีผู้ประสานงานหมู่บ้านแล้ว");
    } catch (error) {
      alert(error?.message || "สร้างบัญชีผู้ประสานงานไม่สำเร็จ");
    } finally {
      setStaffSaving(false);
    }
  };

  const assignIncident = async (id, staffId, priority, note, department, dueAt) => {
    try {
      const updated = normalizeIncident(
        await api.assignIncident(
          id,
          Number(staffId),
          Number(priority),
          note || null,
          department || null,
          dueAt || null,
        ),
      );
      setIncidents((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      );
      setSelectedIncident(null);
      alert(`มอบหมายงานให้ ${updated.assignedToName || "เจ้าหน้าที่"} แล้ว`);
    } catch (error) {
      alert(error?.message || "มอบหมายงานไม่สำเร็จ");
    }
  };

  const reviewIncident = async (id, decision, note) => {
    try {
      const updated = normalizeIncident(
        await api.reviewIncident(id, decision, note || null),
      );
      setIncidents((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      );
      setSelectedIncident(null);
      alert(
        decision === "approve"
          ? "ตรวจรับและปิดงานแล้ว"
          : "ส่งงานกลับให้เจ้าหน้าที่แก้ไขแล้ว",
      );
    } catch (error) {
      alert(error?.message || "ตรวจรับงานไม่สำเร็จ");
    }
  };

  const residentUsers = users.filter((user) => user.role === "user");
  const visiblePeople = residentUsers.filter((user) =>
    `${user.name} ${user.phone}`
      .toLowerCase()
      .includes(peopleSearch.trim().toLowerCase()),
  );

  return (
    <div className="dashboard-surface max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* Mobile Tabs */}
      <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200 mb-4 sm:mb-6 lg:hidden overflow-x-auto hide-scrollbar">
        {adminTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-xl flex flex-col items-center justify-center gap-1 transition ${activeTab === tab.id ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-100"}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* VIEW: STATS */}
      {activeTab === "stats" && (
        <VillageOverviewDashboard
          incidents={incidents}
          users={users}
          currentUser={currentUser}
          setActiveTab={setActiveTab}
        />
      )}
      {false && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                ภาพรวมระบบ (Dashboard)
              </h2>
              <p className="text-gray-500">
                สรุปข้อมูลการแจ้งเหตุ สถานะงาน และตัวชี้วัดการปฏิบัติงานภายใน
                {VILLAGE_NAME}
              </p>
            </div>
            <div className="flex items-center gap-3 bg-blue-50 text-blue-800 px-5 py-3 rounded-2xl font-bold border border-blue-100">
              <Calendar className="w-5 h-5 text-blue-600" />
              {getFormattedDate()}
            </div>
          </div>

          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            <StatCard
              title="แจ้งเหตุทั้งหมด"
              count={total}
              color="bg-gray-100 text-gray-600 border-gray-200"
              icon={<FileText />}
            />
            <StatCard
              title="รอรับเรื่อง"
              count={pending}
              color="bg-yellow-100 text-yellow-700 border-yellow-200"
              icon={<Clock />}
            />
            <StatCard
              title="กำลังดำเนินการ"
              count={inProgress}
              color="bg-blue-100 text-blue-700 border-blue-200"
              icon={<AlertTriangle />}
            />
            <StatCard
              title="แก้ไขเสร็จสิ้น"
              count={resolved}
              color="bg-green-100 text-green-700 border-green-200"
              icon={<CheckCircle />}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
              <h3 className="text-lg font-bold text-gray-800 mb-6 w-full text-left">
                สัดส่วนสถานะการแจ้งเหตุ
              </h3>
              {total > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-10">
                  <div
                    className="w-48 h-48 rounded-full shadow-inner border-4 border-white relative"
                    style={pieStyle}
                  >
                    <div className="absolute inset-0 m-auto w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-sm">
                      <span className="text-2xl font-black text-gray-800">
                        {total}
                      </span>
                      <span className="text-xs text-gray-500 font-bold">
                        รายการ
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-yellow-500"></span>{" "}
                      <span className="text-gray-600">
                        รอรับเรื่อง ({pending})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-500"></span>{" "}
                      <span className="text-gray-600">
                        กำลังดำเนินการ ({inProgress})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-green-500"></span>{" "}
                      <span className="text-gray-600">
                        แก้ไขเสร็จสิ้น ({resolved})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-400"></span>{" "}
                      <span className="text-gray-600">
                        ยกเลิก ({cancelled})
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">ยังไม่มีข้อมูล</p>
              )}
            </div>

            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                แจ้งเหตุรอดำเนินการล่าสุด
              </h3>
              <div className="space-y-3">
                {incidents
                  .filter((i) => i.status === "pending")
                  .slice(0, 3)
                  .map((inc) => (
                    <div
                      key={inc.id}
                      onClick={() => setSelectedIncident(inc)}
                      className="p-3 border border-gray-100 rounded-xl flex justify-between items-center hover:bg-gray-50 cursor-pointer transition"
                    >
                      <div className="truncate pr-4">
                        <div className="font-bold text-gray-800 truncate">
                          {inc.title}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {inc.location}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                    </div>
                  ))}
                {pending === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    ไม่มีรายการรอรับเรื่อง
                  </p>
                )}
              </div>
              {pending > 0 && (
                <button
                  onClick={() => setActiveTab("incidents")}
                  className="w-full mt-4 text-center text-sm font-bold text-blue-600 py-2 hover:bg-blue-50 rounded-lg transition"
                >
                  ดูทั้งหมด
                </button>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">
                  ศูนย์วิเคราะห์ข้อมูลและจัดลำดับงาน
                </h3>
                <p className="text-slate-300 mt-1 max-w-3xl text-sm">
                  ประมวลผลข้อมูลร้องเรียนเพื่อแสดงจุดเสี่ยง เวลาตอบสนอง
                  แนวโน้มความเสียหาย และคิวงานสำคัญแบบรวมศูนย์
                </p>
              </div>
              <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/10">
                <div className="text-xs text-slate-300">
                  เคสที่ยังต้องติดตาม
                </div>
                <div className="text-2xl font-black">{unresolvedCount}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">จุดเสี่ยงสูงสุด</div>
              <div className="text-lg font-black text-gray-900 mt-1">
                {topHotspot?.location || "-"}
              </div>
              <div className="text-xs text-red-600 mt-1">
                เกิดซ้ำ {topHotspot?.count || 0} เคส
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">หมวดที่พบมากสุด</div>
              <div className="text-lg font-black text-gray-900 mt-1">
                {topIssueCategory?.category || "-"}
              </div>
              <div className="text-xs text-indigo-600 mt-1">
                {budgetRecommendations[0]?.percent || 0}% ของทั้งหมด
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">เคสมีคำเร่งด่วนสูงสุด</div>
              <div className="text-lg font-black text-gray-900 mt-1 line-clamp-1">
                {topEmotionalCase?.title || "-"}
              </div>
              <div className="text-xs text-pink-600 mt-1">
                {topEmotionalCase?.sentimentMeta.label || "-"}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">เป้าหมายเชิงรุก</div>
              <div className="text-lg font-black text-gray-900 mt-1 line-clamp-1">
                {topPrediction?.location || "-"}
              </div>
              <div className="text-xs text-amber-600 mt-1">
                คะแนนสัญญาณ {topPrediction?.riskScore || 0}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Spatial Analytics
                  </h3>
                  <p className="text-sm text-gray-500">
                    Heat Map จากพิกัด GPS เพื่อดูจุดเสี่ยงซ้ำซากใน{" "}
                    {VILLAGE_NAME}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-red-50 text-red-600 border border-red-100">
                  <MapPin className="w-6 h-6" />
                </div>
              </div>
              <div className="mb-4">
                <SpatialAnalyticsMap incidents={incidents} />
              </div>
              <div className="space-y-3">
                {spatialAnalytics.map((area) => {
                  const heat = getHeatLevel(area.count);
                  const width = `${Math.max((area.count / Math.max(topHotspot?.count || 1, 1)) * 100, 22)}%`;
                  return (
                    <div
                      key={area.location}
                      className={`rounded-2xl border p-4 ${heat.bg}`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <div className="font-bold text-gray-900">
                            {area.location}
                          </div>
                          <div className="text-xs text-gray-500">
                            พิกัด {area.lat?.toFixed(3)}, {area.lng?.toFixed(3)}
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold bg-white border ${heat.text}`}
                        >
                          {heat.label}
                        </span>
                      </div>
                      <div className="h-3 bg-white/80 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${heat.color}`}
                          style={{ width }}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
                        <span>รวม {area.count} เคส</span>
                        <span>รอรับเรื่อง {area.pending}</span>
                        <span>กำลังดำเนินการ {area.active}</span>
                        <span>แก้ไขแล้ว {area.resolved}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {topHotspot && (
                <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
                  จุดที่ควรจับตาที่สุดตอนนี้คือ{" "}
                  <span className="font-bold">{topHotspot.location}</span>{" "}
                  เพราะมีการแจ้งสะสมสูงสุด
                  เหมาะกับการวางแผนซ่อมเชิงรุกแทนการซ่อมรายครั้ง
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">
                    ตำแหน่งที่เฝ้าระวัง
                  </div>
                  <div className="text-lg font-black text-gray-900 mt-1">
                    {topHotspot?.location || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">จำนวนพิกัดสะสม</div>
                  <div className="text-lg font-black text-gray-900 mt-1">
                    {topHotspot?.count || 0} เคส
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Response Time
                  </h3>
                  <p className="text-sm text-gray-500">
                    ตัวชี้วัด KPI การรับเรื่องและการปิดงาน
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                  <Clock className="w-6 h-6" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <div className="text-sm text-blue-700 font-semibold">
                    มัธยฐานเวลารับเรื่อง
                  </div>
                  <div className="text-2xl font-black text-blue-900 mt-2">
                    {formatHours(medianFirstResponse)}
                  </div>
                  <div className="mt-1 text-xs text-blue-700">
                    จาก {firstResponseHours.length} เคสที่มีเวลา
                  </div>
                </div>
                <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                  <div className="text-sm text-green-700 font-semibold">
                    มัธยฐานเวลาปิดงาน
                  </div>
                  <div className="text-2xl font-black text-green-900 mt-2">
                    {formatHours(medianResolveTime)}
                  </div>
                  <div className="mt-1 text-xs text-green-700">
                    จาก {resolveHours.length} เคสที่ปิดแล้ว
                  </div>
                </div>
                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                  <div className="text-sm text-orange-700 font-semibold">
                    งานค้างนานสุด
                  </div>
                  <div className="text-lg font-black text-orange-900 mt-2">
                    {oldestOpenIncident ? oldestOpenIncident.title : "-"}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                {oldestOpenIncident ? (
                  <>
                    เคส{" "}
                    <span className="font-bold">
                      {oldestOpenIncident.title}
                    </span>{" "}
                    ที่{" "}
                    <span className="font-bold">
                      {oldestOpenIncident.location}
                    </span>
                    คือคอขวดสำคัญของ backlog ตอนนี้
                    ถ้ารับเรื่องได้ไวแต่ปิดงานช้า
                    ควรตรวจสต็อกอุปกรณ์และการจัดทีมภาคสนามเพิ่ม
                  </>
                ) : (
                  "ยังไม่มีงานค้างในระบบ"
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-gray-100 p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">SLA รับเรื่อง</div>
                  <div className="text-base font-black text-gray-900 mt-1">
                    {responseCompliance == null
                      ? "ข้อมูลไม่พอ"
                      : responseCompliance >= 80
                        ? "ปกติ"
                        : "ต้องติดตาม"}
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    {responseCompliance == null
                      ? "-"
                      : `${responseCompliance}%`}{" "}
                    ภายใน 1 ชม. • เกินกำหนด {overdueResponseCount}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-100 p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">SLA ปิดงาน</div>
                  <div className="text-base font-black text-gray-900 mt-1">
                    {resolveCompliance == null
                      ? "ข้อมูลไม่พอ"
                      : resolveCompliance >= 80
                        ? "ปกติ"
                        : "เสี่ยงล่าช้า"}
                  </div>
                  <div className="text-xs text-green-700 mt-1">
                    {resolveCompliance == null ? "-" : `${resolveCompliance}%`}{" "}
                    ภายใน 24 ชม. • เกินกำหนด {overdueResolveCount}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-100 p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Backlog เปิดค้าง</div>
                  <div className="text-base font-black text-gray-900 mt-1">
                    {unresolvedCount} งาน
                  </div>
                  <div className="text-xs text-orange-700 mt-1">
                    เก่าสุด:{" "}
                    {oldestOpenIncident
                      ? new Date(oldestOpenIncident.date).toLocaleDateString(
                          "th-TH",
                        )
                      : "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Issue Breakdown
                  </h3>
                  <p className="text-sm text-gray-500">
                    สัดส่วนประเภทปัญหาเพื่อใช้วางงบประมาณ
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <PieChart className="w-6 h-6" />
                </div>
              </div>
              <div className="space-y-3">
                {issueBreakdown.map((item) => {
                  const width = `${(item.count / Math.max(total, 1)) * 100}%`;
                  return (
                    <div key={item.category}>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-semibold text-gray-800">
                          {item.category}
                        </span>
                        <span className="text-gray-500">{item.count} เคส</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
                          style={{ width }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {issueBreakdown[0] && (
                <div className="mt-4 p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-sm text-indigo-900">
                  หมวดที่พบมากที่สุดคือ{" "}
                  <span className="font-bold">
                    {issueBreakdown[0].category}
                  </span>
                  ควรได้รับงบและแผนงานเชิงป้องกันมากเป็นพิเศษในรอบถัดไป
                </div>
              )}
              <div className="mt-3 overflow-hidden rounded-2xl border border-gray-100">
                <div className="grid grid-cols-[1.4fr_.6fr_.6fr_.9fr_.9fr] bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500">
                  <div>หมวดงาน</div>
                  <div>จำนวน</div>
                  <div>สัดส่วน</div>
                  <div>สัดส่วนจัดลำดับ</div>
                  <div>หน่วยงาน</div>
                </div>
                {budgetRecommendations.map((item) => (
                  <div
                    key={item.category}
                    className="grid grid-cols-[1.4fr_.6fr_.6fr_.9fr_.9fr] px-4 py-2.5 text-sm border-t border-gray-100"
                  >
                    <div className="font-medium text-gray-800">
                      {item.category}
                    </div>
                    <div className="text-gray-600">{item.count}</div>
                    <div className="text-indigo-700 font-semibold">
                      {item.percent}%
                    </div>
                    <div className="text-gray-700">{item.percent}%</div>
                    <div className="text-gray-600">{item.owner}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    สัญญาณเหตุเกิดซ้ำ
                  </h3>
                  <p className="text-sm text-gray-500">
                    จัดอันดับจากจำนวนเหตุและงานที่ยังเปิด ไม่ใช่การพยากรณ์อนาคต
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
              <div className="space-y-2.5">
                {predictivePlan.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-amber-100 bg-amber-50 p-4"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="font-bold text-gray-900">
                          {item.location}
                        </div>
                        <div className="text-sm text-amber-800">
                          {item.category}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-amber-700">
                          คะแนนสัญญาณ
                        </div>
                        <div className="text-2xl font-black text-amber-900">
                          {item.riskScore}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-white/70 px-3 py-2 text-gray-700">
                        เกิดซ้ำ {item.count} ครั้ง
                      </div>
                      <div className="rounded-xl bg-white/70 px-3 py-2 text-gray-700">
                        ความเสี่ยง {item.riskLevel}
                      </div>
                      <div className="rounded-xl bg-white/70 px-3 py-2 text-gray-700">
                        ใช้ประกอบการวางแผนตรวจพื้นที่
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {topPrediction && (
                <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
                  ข้อเสนอเชิงรุก: วางแผน preventive maintenance ที่{" "}
                  <span className="font-bold">{topPrediction.location}</span>
                  ในหมวด{" "}
                  <span className="font-bold">
                    {topPrediction.category}
                  </span>{" "}
                  ก่อนจุดอื่น
                </div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-gray-100 p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">จุดเสี่ยงอันดับ 1</div>
                  <div className="text-base font-black text-gray-900 mt-1">
                    {topPrediction?.location || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-100 p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">หมวดงาน</div>
                  <div className="text-base font-black text-gray-900 mt-1">
                    {topPrediction?.category || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-100 p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">คะแนนสัญญาณ</div>
                  <div className="text-base font-black text-gray-900 mt-1">
                    {topPrediction?.riskScore || 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    คุณภาพข้อมูลการแจ้งเหตุ
                  </h3>
                  <p className="text-sm text-gray-500">
                    วัดความครบถ้วนของรูป รายละเอียด และพิกัด
                    ไม่ตัดสินความน่าเชื่อถือของบุคคล
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Search className="w-6 h-6" />
                </div>
              </div>
              <div className="space-y-2.5">
                {reportQualityScoring.map((user) => (
                  <div
                    key={user.userId}
                    className={`rounded-2xl border p-4 ${user.meta.bg}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-gray-900">
                          {user.userName}
                        </div>
                        <div className="text-xs text-gray-500">
                          แจ้งทั้งหมด {user.totalReports} เคส
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-bold bg-white border ${user.meta.text}`}
                      >
                        {user.meta.label}
                      </div>
                    </div>
                    <div className="mt-3 h-3 bg-white/90 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500"
                        style={{ width: `${user.score}%` }}
                      />
                    </div>
                    <div className="mt-2 text-sm text-gray-700">
                      คะแนน {user.score}/100
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm text-gray-700">
                คะแนนนี้ใช้ตรวจว่าข้อมูลพร้อมให้เจ้าหน้าที่ทำงานหรือไม่เท่านั้น
                ไม่ควรใช้ปฏิเสธเรื่องร้องเรียนหรือลดสิทธิ์ของผู้แจ้ง
              </div>
              <div className="mt-3 space-y-2">
                {reportQualityScoring.slice(0, 3).map((user) => (
                  <div
                    key={user.userId}
                    className="grid grid-cols-[1.3fr_.8fr_.8fr] items-center rounded-2xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm"
                  >
                    <div className="font-medium text-gray-800">
                      {user.userName}
                    </div>
                    <div className="text-gray-600">
                      รายงาน {user.totalReports} เคส • {user.meta.label}
                    </div>
                    <div className="text-right font-bold text-emerald-700">
                      {user.score}/100
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    คำบ่งชี้ความเร่งด่วน
                  </h3>
                  <p className="text-sm text-gray-500">
                    ค้นหาคำสำคัญภาษาไทยเพื่อช่วยคัดกรอง
                    ต้องให้ผู้ดูแลยืนยันก่อนจัดลำดับ
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-pink-50 text-pink-600 border border-pink-100">
                  <MessageCircle className="w-6 h-6" />
                </div>
              </div>
              <div className="space-y-2.5">
                {keywordUrgencyAnalytics.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 ${item.sentimentMeta.bg}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-gray-900">
                          {item.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {item.location}
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold bg-white border ${item.sentimentMeta.text}`}
                      >
                        {item.sentimentMeta.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-3 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
              {topEmotionalCase && (
                <div className="mt-4 p-3 rounded-2xl bg-pink-50 border border-pink-100 text-sm text-pink-900">
                  เคสที่มีความตึงเครียดสูงสุดตอนนี้คือ{" "}
                  <span className="font-bold">{topEmotionalCase.title}</span>
                  ระบบจึงสามารถช่วยให้เจ้าหน้าที่จัดลำดับตอบสนองเคสที่กระทบความรู้สึกประชาชนก่อน
                </div>
              )}
              <div className="mt-3 space-y-2">
                {keywordUrgencyAnalytics.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800 line-clamp-1">
                        {item.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.location}
                      </div>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <div className="text-xs font-bold text-gray-500">
                        S{item.sentimentScore}
                      </div>
                      <div
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold border ${item.sentimentMeta.bg} ${item.sentimentMeta.text}`}
                      >
                        {item.sentimentMeta.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 xl:col-span-2">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Priority Queue และแผนปฏิบัติการ
                  </h3>
                  <p className="text-sm text-gray-500">
                    คิวแนะนำจากระดับที่ผู้ดูแลกำหนด อายุงาน สถานะ จุดเกิดซ้ำ
                    และคำเร่งด่วน โดยไม่นำคะแนนบุคคลมาใช้
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 text-slate-700 border border-slate-100">
                  <Bell className="w-6 h-6" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <div className="text-xs text-amber-700">
                    Maintenance Focus
                  </div>
                  <div className="font-bold text-gray-900 mt-1">
                    {topPrediction?.location || "-"}
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    {topPrediction?.category || "-"} • Score{" "}
                    {topPrediction?.riskScore || 0}
                  </div>
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                  <div className="text-xs text-indigo-700">Category Focus</div>
                  <div className="font-bold text-gray-900 mt-1">
                    {topIssueCategory?.category || "-"}
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    {budgetRecommendations[0]?.percent || 0}% ของรายการทั้งหมด
                  </div>
                </div>
                <div className="rounded-2xl border border-pink-100 bg-pink-50 p-4">
                  <div className="text-xs text-pink-700">Urgency Focus</div>
                  <div className="font-bold text-gray-900 mt-1 line-clamp-1">
                    {priorityQueue[0]?.title || "-"}
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    Priority {priorityQueue[0]?.priorityScore || 0}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                {priorityQueue.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-gray-200 p-4 bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-gray-900 line-clamp-1">
                        {item.title}
                      </div>
                      <span className="text-xs font-bold text-slate-600">
                        P{item.priorityScore}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {item.location} • {item.category}
                    </div>
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                      {item.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="rounded-full bg-white px-2.5 py-1 font-bold text-gray-600 border border-gray-200">
                        {item.lane}
                      </span>
                      <span className="text-gray-500">สถานะ {item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: REPORTS */}
      {activeTab === "reports" && (
        <AdminReports incidents={incidents} users={users} />
      )}

      {/* VIEW: VILLAGE BUDGET REQUESTS */}
      {activeTab === "budgets" && (
        <VillageBudgetWorkspace
          incidents={incidents}
          setIncidents={setIncidents}
        />
      )}

      {/* VIEW: INCIDENTS */}
      {activeTab === "incidents" && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 animate-fadeIn">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">
              จัดการรายการแจ้งเหตุ
            </h2>
          </div>
          <section className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="text-xs font-bold text-slate-600 xl:col-span-2">
                ค้นหารายการ
                <input
                  value={incidentSearch}
                  onChange={(event) => {
                    setIncidentSearch(event.target.value);
                    setIncidentPage(1);
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="ชื่อเรื่อง ผู้แจ้ง สถานที่ หรือเลขงาน"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                หมวดหมู่
                <select
                  value={incidentCategory}
                  onChange={(event) => {
                    setIncidentCategory(event.target.value);
                    setIncidentPage(1);
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="all">ทุกหมวดหมู่</option>
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">
                สถานะ
                <select
                  value={incidentStatus}
                  onChange={(event) => {
                    setIncidentStatus(event.target.value);
                    setIncidentPage(1);
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="all">ทุกสถานะ</option>
                  {[
                    "pending",
                    "assigned",
                    "in_progress",
                    "waiting_review",
                    "revision_requested",
                    "resolved",
                    "cancelled",
                  ].map((status) => (
                    <option key={status} value={status}>
                      {getStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <DateRangePicker
                from={incidentDateFrom}
                to={incidentDateTo}
                label="วันที่ / ช่วงวันที่"
                labelClassName="text-xs text-slate-600"
                onChange={(nextFrom, nextTo) => {
                  setIncidentDateFrom(nextFrom);
                  setIncidentDateTo(nextTo);
                  setIncidentPage(1);
                }}
              />
            </div>
            <div className="mt-4 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-slate-500">
                พบ{" "}
                <b className="text-slate-900">
                  {filteredAdminIncidents.length}
                </b>{" "}
                จาก {incidents.length} รายการ · แสดงล่าสุดก่อน
              </span>
              <button
                onClick={resetIncidentFilters}
                className="self-start font-bold text-blue-600 hover:underline sm:self-auto"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            </div>
          </section>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                  <th className="p-4 rounded-tl-xl font-semibold">รายการ</th>
                  <th className="p-4 font-semibold">ผู้แจ้ง</th>
                  <th className="p-4 font-semibold">สถานที่</th>
                  <th className="p-4 font-semibold">สถานะ</th>
                  <th className="p-4 rounded-tr-xl font-semibold text-center">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedAdminIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-gray-50 transition">
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{inc.title}</div>
                      <div className="text-xs text-blue-600 mt-1">
                        {inc.category}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        แจ้งเมื่อ {formatThaiDateTime(inc.date)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-gray-800">{inc.userName}</div>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {inc.location}
                      </div>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={inc.status} />
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedIncident(inc)}
                        className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-100 hover:text-blue-600 transition shadow-sm"
                      >
                        ดูรายละเอียด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!pagedAdminIncidents.length && (
              <div className="py-14 text-center text-slate-400">
                <Search className="mx-auto mb-3 h-10 w-10 opacity-40" />
                <div className="font-bold">ไม่พบรายการตามตัวกรอง</div>
                <button
                  onClick={resetIncidentFilters}
                  className="mt-2 text-sm font-bold text-blue-600 hover:underline"
                >
                  ล้างตัวกรอง
                </button>
              </div>
            )}
          </div>
          {filteredAdminIncidents.length > incidentPageSize && (
            <div className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-500">
                หน้า {safeIncidentPage} จาก {incidentTotalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={safeIncidentPage === 1}
                  onClick={() =>
                    setIncidentPage((page) => Math.max(1, page - 1))
                  }
                  className="rounded-xl border px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40"
                >
                  ก่อนหน้า
                </button>
                <button
                  disabled={safeIncidentPage === incidentTotalPages}
                  onClick={() =>
                    setIncidentPage((page) =>
                      Math.min(incidentTotalPages, page + 1),
                    )
                  }
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: NEWS MANAGEMENT */}
      {activeTab === "news" && (
        <div className="space-y-6 animate-fadeIn">
          {editingNews ? (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                {editingNews.id ? "แก้ไขข่าวสาร" : "สร้างประกาศข่าวใหม่"}
              </h2>
              <form onSubmit={saveNews} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    หัวข้อประกาศ
                  </label>
                  <input
                    type="text"
                    required
                    value={newsForm.title}
                    onChange={(e) =>
                      setNewsForm({ ...newsForm, title: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    รายละเอียดเนื้อหา
                  </label>
                  <textarea
                    required
                    value={newsForm.content}
                    onChange={(e) =>
                      setNewsForm({ ...newsForm, content: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-blue-500 outline-none h-32 resize-none"
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    รูปภาพประกอบข่าว
                  </label>
                  <label className="group relative flex min-h-48 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-blue-400 hover:bg-blue-50/40">
                    {newsImagePreview ? (
                      <>
                        <img
                          src={newsImagePreview}
                          alt="ตัวอย่างรูปข่าว"
                          className="h-56 w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 opacity-0 transition group-hover:opacity-100">
                          <span className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-800">
                            <Upload className="mr-2 inline h-4 w-4" />
                            เปลี่ยนรูปภาพ
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="p-6 text-center">
                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
                          <Camera className="h-7 w-7 text-blue-600" />
                        </div>
                        <div className="font-bold text-slate-700">
                          คลิกเพื่อเลือกรูปจากเครื่อง
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          รองรับ JPG, PNG, WebP ขนาดไม่เกิน 10MB
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleNewsImageChange}
                      className="sr-only"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingNews(null)}
                    className="px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                  >
                    บันทึกข่าวสาร
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div><h2 className="text-2xl font-black text-slate-900">จัดการข่าวสารและประกาศ</h2><p className="mt-1 text-sm text-slate-500">ข่าวที่เผยแพร่ให้ประชาชนในหมู่บ้านเห็น</p></div>
                <button
                  onClick={() => startEditNews()}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" /> สร้างข่าวใหม่
                </button>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {news.map((n) => (
                  <div
                    key={n.id}
                    className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-blue-200 hover:shadow-md md:flex-col"
                  >
                    <div className="h-36 w-36 shrink-0 overflow-hidden bg-slate-100 md:aspect-[16/9] md:h-auto md:w-full">
                      {n.image ? <img src={n.image} alt={n.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><Image className="h-10 w-10" /></div>}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-between p-4 md:p-5">
                      <div>
                        <span className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                          <Calendar className="h-3.5 w-3.5" /> เผยแพร่ {formatThaiDateTime(n.date)} น.
                        </span>
                        <h3 className="line-clamp-2 text-lg font-black text-slate-900 md:text-xl">
                          {n.title}
                        </h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                          {n.content}
                        </p>
                      </div>
                      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                        <button
                          onClick={() => startEditNews(n)}
                          className="flex items-center gap-1 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                        >
                          <Edit className="w-4 h-4" /> แก้ไข
                        </button>
                        <button
                          onClick={() => deleteNews(n.id)}
                          className="flex items-center gap-1 text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" /> ลบ
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* VIEW: PEOPLE MANAGEMENT */}
      {activeTab === "users" && (
        <div className="space-y-6 animate-fadeIn">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 md:p-8 text-white shadow-xl">
            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-5">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-200">
                  <Users className="h-4 w-4" /> ระบบแอดมินหมู่บ้าน
                </div>
                <h2 className="text-3xl font-black">
                  จัดการประชาชน หมู่ {currentUser?.villageMoo || "-"}
                </h2>
                <p className="mt-2 text-slate-300">
                  ดูรายชื่อและระงับบัญชีประชาชนใน{" "}
                  {currentUser?.villageName || "หมู่บ้านของคุณ"}
                </p>
              </div>
              {!villageMode && (
                <button
                  onClick={createStaffAccount}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-950/30 hover:bg-blue-500"
                >
                  <Plus className="h-5 w-5" /> เพิ่มผู้ประสานงาน
                </button>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3 md:gap-4">
            {[
              {
                label: "ลูกบ้านทั้งหมด",
                value: residentUsers.length,
                tone: "bg-blue-100 text-blue-700",
                icon: <Home />,
              },
              {
                label: "บัญชีถูกระงับ",
                value: residentUsers.filter(
                  (u) => u.accountStatus === "suspended",
                ).length,
                tone: "bg-red-100 text-red-700",
                icon: <Clock />,
              },
              {
                label: "บัญชีใช้งาน",
                value: users.filter((u) => u.accountStatus === "approved")
                  .length,
                tone: "bg-green-100 text-green-700",
                icon: <CheckCircle />,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5 shadow-sm"
              >
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}
                >
                  {React.cloneElement(item.icon, { className: "h-5 w-5" })}
                </div>
                <div className="text-2xl md:text-3xl font-black text-slate-900">
                  {item.value}
                </div>
                <div className="text-xs md:text-sm font-medium text-slate-500">
                  {item.label}
                </div>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 md:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="font-black text-slate-900">
                    รายชื่อประชาชนในหมู่บ้าน
                  </div>
                  <div className="text-sm text-slate-500">
                    ทั้งหมด {residentUsers.length} บัญชี
                  </div>
                </div>
                <div className="relative w-full lg:w-80">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={peopleSearch}
                    onChange={(e) => setPeopleSearch(e.target.value)}
                    placeholder="ค้นหาชื่อหรือเบอร์โทร"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            <div className="hidden border-b border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
              หากสมาชิกลืมรหัสผ่าน
              ให้ค้นหาบัญชีแล้วกดชื่อบัญชีเพื่อเลือกตั้งรหัสผ่านใหม่
              <div className="mt-2 flex flex-wrap gap-2">
                {visiblePeople.map((person) => (
                  <button
                    key={`password-${person.id}`}
                    onClick={() => resetUserPassword(person)}
                    className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                  >
                    ตั้งรหัสใหม่: {person.name}
                  </button>
                ))}
              </div>
            </div>

            {true ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <th className="p-4 md:p-5">ลูกบ้าน</th>
                      <th className="p-4">ข้อมูลติดต่อ</th>
                      <th className="p-4">สถานะ</th>
                      <th className="p-4 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visiblePeople.map((person) => (
                      <tr
                        key={person.id}
                        className="transition hover:bg-blue-50/30"
                      >
                        <td className="p-4 md:p-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 font-black text-blue-700">
                              {person.name?.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">
                                {person.name}
                              </div>
                              <div className="text-xs text-slate-400">
                                สมาชิก #{person.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-medium text-slate-700">
                            {person.phone}
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${person.accountStatus === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                          >
                            {
                              {
                                approved: "ใช้งานได้",
                                pending: "ใช้งานได้",
                                rejected: "ใช้งานได้",
                                suspended: "ระงับ",
                              }[person.accountStatus]
                            }
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            {person.accountStatus !== "suspended" ? (
                              <button
                                onClick={() =>
                                  updateUserAccountStatus(
                                    person.id,
                                    "suspended",
                                  )
                                }
                                className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"
                              >
                                ระงับบัญชี
                              </button>
                            ) : (
                              <button
                                onClick={() => updateUserAccountStatus(person.id, "approved")}
                                className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100"
                              >
                                เปิดใช้งานอีกครั้ง
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visiblePeople.length === 0 && (
                  <div className="py-12 text-center text-slate-400">
                    ไม่พบข้อมูลลูกบ้าน
                  </div>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 md:p-6">
                {visiblePeople.map((person) => {
                  const assignedCount = incidents.filter(
                    (item) =>
                      item.assignedTo === person.id &&
                      item.status !== "resolved",
                  ).length;
                  return (
                    <div
                      key={person.id}
                      className="rounded-2xl border border-slate-200 p-5 transition hover:border-indigo-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-lg font-black text-indigo-700">
                          {person.name?.charAt(0)}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${person.accountStatus === "approved" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}
                        >
                          {person.accountStatus === "approved"
                            ? "พร้อมปฏิบัติงาน"
                            : "ระงับใช้งาน"}
                        </span>
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-slate-900">
                        {person.name}
                      </h3>
                      <p className="text-sm text-slate-500">
                        บัญชี: {person.phone}
                      </p>
                      <div className="my-4 rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">
                          งานที่กำลังรับผิดชอบ
                        </div>
                        <div className="mt-1 text-2xl font-black text-slate-900">
                          {assignedCount}{" "}
                          <span className="text-xs font-medium text-slate-500">
                            งาน
                          </span>
                        </div>
                      </div>
                      {person.accountStatus === "approved" ? (
                        <button
                          onClick={() =>
                            updateUserAccountStatus(person.id, "suspended")
                          }
                          className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50"
                        >
                          ระงับบัญชี
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            updateUserAccountStatus(person.id, "approved")
                          }
                          className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700"
                        >
                          เปิดใช้งานบัญชี
                        </button>
                      )}
                    </div>
                  );
                })}
                {visiblePeople.length === 0 && (
                  <div className="md:col-span-2 xl:col-span-3 py-12 text-center text-slate-400">
                    ยังไม่มีข้อมูลเจ้าหน้าที่
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {!villageMode && staffFormOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={() => !staffSaving && setStaffFormOpen(false)}
        >
          <form
            onSubmit={createStaffAccount}
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl md:p-8"
          >
            <label className="mb-4 block text-sm font-bold text-slate-700">
              อีเมลกู้คืน
              <input
                type="email"
                required
                value={staffForm.email}
                onChange={(event) =>
                  setStaffForm({ ...staffForm, email: event.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="name@example.com"
              />
            </label>
            <label className="mb-4 block text-sm font-bold text-slate-700">
              หมู่บ้านที่รับผิดชอบ
              <select
                required
                value={staffForm.village_id}
                onChange={(event) =>
                  setStaffForm({ ...staffForm, village_id: event.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">เลือกหมู่บ้าน</option>
                {(villages || []).map((village) => (
                  <option key={village.id} value={village.id}>
                    หมู่ {village.moo} {village.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900">
                  เพิ่มบัญชีผู้ประสานงานหมู่บ้าน
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  ใช้รับเรื่อง ตรวจสอบพื้นที่ บันทึกหลักฐาน
                  และส่งคำของบประมาณให้ อบต.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStaffFormOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-700">
                ชื่อผู้ประสานงานหมู่บ้าน
                <input
                  autoFocus
                  required
                  value={staffForm.name}
                  onChange={(event) =>
                    setStaffForm({ ...staffForm, name: event.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="เช่น นายสมชาย ใจดี"
                />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                เบอร์โทรศัพท์ / Username
                <input
                  required
                  value={staffForm.phone}
                  onChange={(event) =>
                    setStaffForm({ ...staffForm, phone: event.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="08xxxxxxxx"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-slate-700">
                  รหัสผ่านเริ่มต้น
                  <input
                    type="password"
                    required
                    minLength="8"
                    value={staffForm.password}
                    onChange={(event) =>
                      setStaffForm({
                        ...staffForm,
                        password: event.target.value,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="อย่างน้อย 8 ตัว"
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  ยืนยันรหัสผ่าน
                  <input
                    type="password"
                    required
                    minLength="8"
                    value={staffForm.passwordConfirmation}
                    onChange={(event) =>
                      setStaffForm({
                        ...staffForm,
                        passwordConfirmation: event.target.value,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="กรอกซ้ำอีกครั้ง"
                  />
                </label>
              </div>
            </div>
            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                disabled={staffSaving}
                onClick={() => setStaffFormOpen(false)}
                className="rounded-xl border px-5 py-3 font-bold text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={staffSaving}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {staffSaving ? "กำลังสร้าง..." : "สร้างบัญชีผู้ประสานงาน"}
              </button>
            </div>
          </form>
        </div>
      )}

      {false && passwordPerson && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={() => !passwordSaving && setPasswordPerson(null)}
        >
          <form
            onSubmit={resetUserPassword}
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl md:p-8"
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900">
                  ตั้งรหัสผ่านใหม่
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  บัญชี: {passwordPerson.name} ({passwordPerson.phone})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPasswordPerson(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              เครื่องมือนี้สำหรับ Admin หลังตรวจสอบตัวตนของสมาชิกแล้ว
              ไม่ใช่ปุ่มลืมรหัสผ่านสำหรับผู้ใช้ทั่วไป
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-700">
                รหัสผ่านใหม่
                <input
                  autoFocus
                  type="password"
                  required
                  minLength="8"
                  value={passwordForm.password}
                  onChange={(event) =>
                    setPasswordForm({
                      ...passwordForm,
                      password: event.target.value,
                    })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                ยืนยันรหัสผ่านใหม่
                <input
                  type="password"
                  required
                  minLength="8"
                  value={passwordForm.confirmation}
                  onChange={(event) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmation: event.target.value,
                    })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="กรอกซ้ำอีกครั้ง"
                />
              </label>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              เมื่อบันทึก ระบบจะนำบัญชีนี้ออกจากระบบในอุปกรณ์เดิมทั้งหมด
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={passwordSaving}
                onClick={() => setPasswordPerson(null)}
                className="rounded-xl border px-5 py-3 font-bold text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={passwordSaving}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {passwordSaving ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Incident Detail Modal for Admin */}
      {selectedIncident && (
        <AdminIncidentModal
          inc={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onUpdate={updateIncidentStatus}
          onDelete={(reason) => deleteIncident(selectedIncident.id, reason)}
          staff={users.filter(
            (user) =>
              isVillageAdminRole(user.role) &&
              user.accountStatus === "approved" &&
              String(user.villageId || "") ===
                String(selectedIncident.villageId || ""),
          )}
          onAssign={assignIncident}
          onReview={reviewIncident}
          villageMode={villageMode}
          onIncidentReplace={(updated) => {
            const normalized = normalizeIncident(updated);
            setIncidents((items) =>
              items.map((item) =>
                item.id === normalized.id ? normalized : item,
              ),
            );
            setSelectedIncident(normalized);
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// MODALS & UTILS
// ==========================================
function AdminIncidentModal({
  inc,
  onClose,
  onUpdate,
  onDelete,
  staff,
  onAssign,
  onReview,
  onIncidentReplace,
  villageMode = false,
}) {
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState(inc.status);
  const [resImage, setResImage] = useState(null);
  const [resImageFile, setResImageFile] = useState(null);
  const [assignedStaffId, setAssignedStaffId] = useState(
    inc.assignedTo || staff?.[0]?.id || "",
  );
  const [priority, setPriority] = useState(inc.priority || 1);
  const [department, setDepartment] = useState(inc.department || "");
  const [dueAt, setDueAt] = useState(
    inc.dueAt ? new Date(inc.dueAt).toISOString().slice(0, 16) : "",
  );
  const [workflowNote, setWorkflowNote] = useState("");
  const [inspectionImage, setInspectionImage] = useState(null);
  const [forwardingToTao, setForwardingToTao] = useState(false);
  const [forwardNote, setForwardNote] = useState("");
  const [infoResponse, setInfoResponse] = useState("");
  const [infoResponseImage, setInfoResponseImage] = useState(null);
  const [sendingInfoResponse, setSendingInfoResponse] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const latestInfoRequest = [...(inc.updates || [])]
    .filter((item) => item.type === "info_request")
    .sort((a, b) => Number(b.id) - Number(a.id))[0];
  const latestInfoResponse = [...(inc.updates || [])]
    .filter((item) => item.type === "info_response")
    .sort((a, b) => Number(b.id) - Number(a.id))[0];
  const needsInformationResponse =
    latestInfoRequest &&
    (!latestInfoResponse || Number(latestInfoResponse.id) < Number(latestInfoRequest.id));

  const handleResImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert("รูปภาพต้องมีขนาดไม่เกิน 10MB");
        e.target.value = "";
        return;
      }
      if (resImage) URL.revokeObjectURL(resImage);
      setResImageFile(file);
      setResImage(URL.createObjectURL(file));
    }
  };

  const handleSave = () => {
    if (newStatus === "resolved" && !resImage && !inc.resolvedImage) {
      if (
        !window.confirm(
          "คุณยังไม่ได้แนบรูปภาพผลการแก้ไข ต้องการดำเนินการต่อโดยไม่มีรูปภาพใช่หรือไม่?",
        )
      )
        return;
    }
    onUpdate(inc.id, newStatus, resImageFile, resImage);
    setEditingStatus(false);
  };

  const forwardVerifiedIncident = async () => {
    if (!forwardNote.trim())
      return alert("กรุณาระบุผลตรวจสอบเบื้องต้นก่อนส่งให้ อบต.");
    setForwardingToTao(true);
    try {
      const evidence = new FormData();
      evidence.append("_method", "PATCH");
      evidence.append("note", forwardNote.trim());
      if (inspectionImage) evidence.append("inspection_image", inspectionImage);
      const updated = await api.forwardIncidentToTao(inc.id, evidence);
      onIncidentReplace(updated);
      setForwardNote("");
      setInspectionImage(null);
      alert("ยืนยันและส่งเรื่องให้ อบต.แล้ว");
    } catch (error) {
      alert(error?.message || "ส่งเรื่องให้ อบต.ไม่สำเร็จ");
    } finally {
      setForwardingToTao(false);
    }
  };

  const sendAdditionalInformation = async () => {
    if (!infoResponse.trim() && !infoResponseImage)
      return alert("กรุณาระบุข้อมูลเพิ่มเติมหรือแนบรูป");
    setSendingInfoResponse(true);
    try {
      const payload = new FormData();
      payload.append("action", "info_response");
      if (infoResponse.trim()) payload.append("message", infoResponse.trim());
      if (infoResponseImage) payload.append("image", infoResponseImage);
      const result = await api.addIncidentProgress(inc.id, payload);
      onIncidentReplace(result.incident);
      setInfoResponse("");
      setInfoResponseImage(null);
      alert("ส่งข้อมูลเพิ่มเติมให้ อบต.แล้ว");
    } catch (error) {
      alert(error?.message || "ส่งข้อมูลเพิ่มเติมไม่สำเร็จ");
    } finally {
      setSendingInfoResponse(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl md:rounded-3xl w-full max-w-4xl max-h-[92dvh] overflow-y-auto shadow-2xl animate-fadeIn relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"
        >
          <X className="w-6 h-6 text-gray-600" />
        </button>

        <div className="p-5 md:p-8">
          <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <StatusBadge status={inc.status} size="lg" />
                <span className="text-sm font-bold text-gray-400">
                  {inc.referenceNo || `#${inc.id}`} ·{" "}
                  {new Date(inc.date).toLocaleString("th-TH")}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">{inc.title}</h2>
              <div className="text-blue-600 font-bold mt-1 flex items-center gap-1">
                <Info className="w-4 h-4" /> {inc.category}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <img
                src={inc.image}
                alt="incident"
                className="w-full h-48 object-cover rounded-2xl shadow-sm border border-gray-200"
              />
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-sm text-gray-500 mb-1 font-semibold">
                  ผู้แจ้งเรื่อง
                </p>
                <p className="font-bold text-gray-900">{inc.userName}</p>
                <p className="text-sm text-gray-600">
                  หมู่ {inc.villageMoo || "-"} {inc.villageName || ""}
                </p>
              </div>
              {inc.requiresTao && inc.dueAt && (
                <div className={`p-4 rounded-2xl border ${new Date(inc.dueAt) < new Date() && !["resolved", "cancelled"].includes(inc.status) ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                  <p className="text-sm font-semibold">กำหนดดำเนินการให้เสร็จ</p>
                  <p className="font-bold">{formatThaiDateTime(inc.dueAt)} น.</p>
                  {inc.department && <p className="mt-1 text-sm">หน่วยรับผิดชอบ: {inc.department}</p>}
                </div>
              )}
            </div>
          </div>

          <div className="mb-8">
            <IncidentLocationPanel incident={inc} />
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              รายละเอียดเพิ่มเติม
            </h3>
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-gray-700 leading-relaxed whitespace-pre-wrap">
              {inc.description}
            </div>
          </div>

          {villageMode && inc.feedback?.rating && (
            <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-black text-amber-950">ผลประเมินจากประชาชน</h3>
                <span className="text-sm font-bold text-amber-800">
                  {inc.feedback.rating} / 5 คะแนน
                </span>
              </div>
              <div className="mt-2 flex gap-1" aria-label={`${inc.feedback.rating} ดาว`}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <span
                    key={value}
                    className={`text-2xl ${value <= Number(inc.feedback.rating) ? "text-amber-500" : "text-slate-300"}`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {inc.feedback.comment || "ไม่มีความคิดเห็นเพิ่มเติม"}
              </p>
            </section>
          )}

          {villageMode && !inc.requiresTao && !["resolved", "cancelled"].includes(inc.status) && (
            <div className="mb-8 rounded-2xl border-2 border-blue-200 bg-blue-50 p-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 font-black text-white">1</span>
                <div>
                  <h3 className="font-black text-blue-950">ตรวจสอบแล้วส่งให้ อบต.</h3>
                  <p className="text-sm text-blue-800">หน้าที่ของหมู่บ้านจบที่การยืนยันข้อมูลและประสานพื้นที่</p>
                </div>
              </div>
              <p className="mt-1 text-sm text-blue-800">
                ระบุว่าพบเหตุจริงหรือไม่ จุดเกิดเหตุถูกต้องหรือไม่ และข้อมูลสำคัญที่ อบต.ควรรู้
              </p>
              <textarea
                value={forwardNote}
                onChange={(event) => setForwardNote(event.target.value)}
                className="mt-3 h-24 w-full rounded-xl border border-blue-200 bg-white p-3"
                placeholder="เช่น ตรวจสอบแล้วพบเหตุจริง บริเวณหน้าศาลาหมู่บ้าน"
              />
              <label className="mt-3 block text-sm font-bold text-blue-950">
                รูปยืนยันจากพื้นที่ (ถ้ามี)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setInspectionImage(event.target.files?.[0] || null)}
                  className="mt-2 w-full rounded-xl border border-blue-200 bg-white p-3 font-normal"
                />
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={forwardingToTao || !forwardNote.trim()}
                  onClick={forwardVerifiedIncident}
                  className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {forwardingToTao
                    ? "กำลังส่ง..."
                    : "ยืนยันและส่งต่อ อบต."}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelForm(true)}
                  className="rounded-xl border border-red-300 bg-white px-5 py-3 font-bold text-red-600 hover:bg-red-50"
                >
                  ยุติเรื่อง
                </button>
              </div>

              {showCancelForm && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
                  <h3 className="font-black text-red-900">ยุติเรื่องหลังตรวจสอบ</h3>
                  <p className="mt-1 text-sm text-red-700">
                    เรื่องนี้จะไม่ถูกส่งให้ อบต. และผู้แจ้งจะเห็นเหตุผลในสถานะของรายการ
                  </p>
                  <textarea
                    autoFocus
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    className="mt-3 h-24 w-full rounded-xl border border-red-200 bg-white p-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    placeholder="ระบุผลตรวจสอบ เช่น ไม่พบเหตุตามที่แจ้ง, ข้อมูลไม่จริง, แจ้งซ้ำ หรืออยู่นอกพื้นที่"
                    maxLength={500}
                  />
                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCancelForm(false);
                        setCancelReason("");
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-600"
                    >
                      กลับไปตรวจสอบ
                    </button>
                    <button
                      type="button"
                      disabled={!cancelReason.trim()}
                      onClick={() => onDelete(cancelReason)}
                      className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ยืนยันยุติเรื่องและแจ้งผู้ใช้
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {villageMode && inc.requiresTao && (
            needsInformationResponse ? (
              <section className="mb-8 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
                <h3 className="font-black text-amber-950">อบต.ขอข้อมูลเพิ่มเติม</h3>
                <p className="mt-2 rounded-xl bg-white p-3 font-bold text-slate-800">
                  {latestInfoRequest.message || "กรุณาติดต่อ อบต.เพื่อสอบถามรายละเอียด"}
                </p>
                <label className="mt-4 block text-sm font-bold text-slate-800">
                  ข้อมูลที่ต้องการส่งกลับ
                  <textarea
                    value={infoResponse}
                    onChange={(event) => setInfoResponse(event.target.value)}
                    className="mt-2 h-24 w-full rounded-xl border border-amber-200 bg-white p-3 font-normal outline-none focus:border-amber-500"
                    placeholder="ระบุข้อมูลเพิ่มเติมตามที่ อบต.ร้องขอ"
                  />
                </label>
                <label className="mt-3 block text-sm font-bold text-slate-800">
                  รูปประกอบ (ถ้ามี)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setInfoResponseImage(event.target.files?.[0] || null)}
                    className="mt-2 w-full rounded-xl border border-amber-200 bg-white p-3 font-normal"
                  />
                </label>
                <button
                  type="button"
                  disabled={sendingInfoResponse || (!infoResponse.trim() && !infoResponseImage)}
                  onClick={sendAdditionalInformation}
                  className="mt-4 w-full rounded-xl bg-amber-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  {sendingInfoResponse ? "กำลังส่ง..." : "ส่งข้อมูลเพิ่มเติม"}
                </button>
              </section>
            ) : (
              <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">
                ส่งเรื่องให้ อบต.แล้ว หมู่บ้านสามารถติดตามสถานะและช่วยประสานข้อมูลในพื้นที่ได้
              </div>
            )
          )}

          {!villageMode && (
            <div className="mb-8 p-5 rounded-2xl border border-indigo-200 bg-indigo-50/60">
              <h3 className="font-bold text-indigo-900 mb-3">
                ผู้รับผิดชอบงาน
              </h3>
              {inc.assignedToName && (
                <p className="mb-3 text-sm">
                  มอบหมายให้: <b>{inc.assignedToName}</b>
                  {inc.assignedAt
                    ? ` เมื่อ ${formatThaiDateTime(inc.assignedAt)} น.`
                    : ""}
                </p>
              )}
              {!["resolved", "cancelled", "waiting_review"].includes(
                inc.status,
              ) && (
                <div className="grid sm:grid-cols-[1fr_130px] gap-3">
                  <select
                    value={assignedStaffId}
                    onChange={(e) => setAssignedStaffId(e.target.value)}
                    className="px-3 py-3 border rounded-xl bg-white"
                  >
                    <option value="">เลือกผู้ประสานงานหมู่บ้าน</option>
                    {(staff || []).map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} ({person.phone})
                      </option>
                    ))}
                  </select>
                  <input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="หน่วยรับผิดชอบ เช่น กองช่าง"
                    className="px-3 py-3 border rounded-xl bg-white"
                  />
                  <input
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="px-3 py-3 border rounded-xl bg-white"
                    aria-label="กำหนดเสร็จ"
                  />
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="px-3 py-3 border rounded-xl bg-white"
                  >
                    <option value="1">ปกติ</option>
                    <option value="2">สำคัญ</option>
                    <option value="3">เร่งด่วน</option>
                    <option value="4">ฉุกเฉิน</option>
                  </select>
                  <input
                    value={workflowNote}
                    onChange={(e) => setWorkflowNote(e.target.value)}
                    placeholder="หมายเหตุการมอบหมาย (ถ้ามี)"
                    className="sm:col-span-2 px-3 py-3 border rounded-xl"
                  />
                  <button
                    type="button"
                    disabled={!assignedStaffId}
                    onClick={() =>
                      onAssign(inc.id, assignedStaffId, priority, workflowNote, department, dueAt)
                    }
                    className="sm:col-span-2 py-3 bg-indigo-600 text-white font-bold rounded-xl disabled:opacity-40"
                  >
                    {inc.assignedTo ? "เปลี่ยนผู้รับผิดชอบ" : "มอบหมายงาน"}
                  </button>
                </div>
              )}
              {(staff || []).length === 0 && !inc.assignedTo && (
                <p className="text-sm text-amber-700 mt-2">
                  ยังไม่มีผู้ประสานงานของหมู่บ้านนี้
                  กรุณาสร้างบัญชีและกำหนดหมู่บ้านก่อน
                </p>
              )}
            </div>
          )}

          {!villageMode && inc.status === "waiting_review" && (
            <div className="mb-8 p-5 rounded-2xl border-2 border-amber-300 bg-amber-50">
              <h3 className="text-lg font-bold text-amber-900">
                งานนี้รอผู้ดูแลตรวจรับ
              </h3>
              {inc.resolvedImage && (
                <img
                  src={inc.resolvedImage}
                  alt="รูปหลังดำเนินงาน"
                  className="w-full max-h-80 object-contain bg-white rounded-xl mt-4"
                />
              )}
              <textarea
                value={workflowNote}
                onChange={(e) => setWorkflowNote(e.target.value)}
                placeholder="หมายเหตุการตรวจรับ (ต้องกรอกหากส่งกลับแก้ไข)"
                className="w-full h-24 p-3 border rounded-xl mt-4"
              />
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => onReview(inc.id, "revision", workflowNote)}
                  className="py-3 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200"
                >
                  ส่งกลับให้แก้ไข
                </button>
                <button
                  type="button"
                  onClick={() => onReview(inc.id, "approve", workflowNote)}
                  className="py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700"
                >
                  ตรวจรับและปิดงาน
                </button>
              </div>
            </div>
          )}

          {(inc.updates || []).length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-3">บันทึกการปฏิบัติงาน</h3>
              <div className="space-y-3">
                {inc.updates.map((update) => (
                  <div key={update.id} className="p-4 border rounded-xl">
                    <div className="flex justify-between text-sm">
                      <b>{update.user?.name || "เจ้าหน้าที่"}</b>
                      <span className="text-gray-500">
                        {formatThaiDateTime(update.created_at)} น.
                      </span>
                    </div>
                    {update.message && <p className="mt-2">{update.message}</p>}
                    {update.image && (
                      <img
                        src={update.image}
                        alt="หลักฐานการทำงาน"
                        className="mt-3 max-h-56 rounded-xl object-contain bg-gray-100"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {inc.status === "resolved" &&
            (inc.resolvedImage || resImage) &&
            !editingStatus && (
              <div className="mb-8 p-6 bg-green-50 rounded-2xl border border-green-200">
                <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> ผลการแก้ไข
                </h3>
                <img
                  src={resImage || inc.resolvedImage}
                  alt="resolved"
                  className="w-full h-64 object-cover rounded-xl shadow-sm"
                />
              </div>
            )}

          {!villageMode && !["assigned", "waiting_review", "revision_requested"].includes(
            inc.status,
          ) && (
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              {editingStatus ? (
                <div className="flex-1 w-full space-y-4">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="pending">รอรับเรื่อง</option>
                    <option value="in_progress">กำลังดำเนินการ</option>
                    <option value="resolved">แก้ไขเสร็จสิ้น</option>
                  </select>

                  {newStatus === "resolved" && (
                    <div className="animate-fadeIn">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        แนบรูปภาพหลังแก้ไข (ถ้ามี)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleResImageChange}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      {resImage && (
                        <img
                          src={resImage}
                          className="mt-3 h-20 rounded-lg object-cover"
                          alt="preview"
                        />
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 w-full pt-2">
                    <button
                      onClick={() => setEditingStatus(false)}
                      className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700"
                    >
                      บันทึกสถานะ
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-gray-500 font-semibold mb-1">
                      สถานะปัจจุบัน
                    </p>
                    <StatusBadge status={inc.status} size="lg" />
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => setShowCancelForm(true)}
                      className="flex-1 sm:flex-none px-6 py-3 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition"
                    >
                      ยุติเรื่องนี้
                    </button>
                    <button
                      onClick={() => setEditingStatus(true)}
                      className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-md shadow-blue-200"
                    >
                      อัปเดตงาน
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {showCancelForm && !villageMode && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
              <h3 className="font-black text-red-900">ระบุเหตุผลที่ยุติเรื่อง</h3>
              <p className="mt-1 text-sm text-red-700">
                ผู้แจ้งจะเห็นเหตุผลนี้ในสถานะและ Timeline ของรายการ
              </p>
              <textarea
                autoFocus
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                className="mt-3 h-24 w-full rounded-xl border border-red-200 bg-white p-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                placeholder="เช่น ตรวจสอบแล้วเป็นข้อมูลเท็จ, แจ้งซ้ำ, อยู่นอกพื้นที่รับผิดชอบ"
                maxLength={500}
              />
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelForm(false);
                    setCancelReason("");
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-600"
                >
                  กลับ
                </button>
                <button
                  type="button"
                  disabled={!cancelReason.trim()}
                  onClick={() => onDelete(cancelReason)}
                  className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ยืนยันยุติเรื่อง
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewsModal({ news, onClose, onPrevious, onNext }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fadeIn relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100/80 backdrop-blur rounded-full hover:bg-gray-200 transition z-10"
        >
          <X className="w-6 h-6 text-gray-800" />
        </button>

        <img
          src={news.image}
          alt="news"
          className="max-h-[65vh] w-full rounded-t-3xl bg-slate-100 object-contain"
        />

        {onPrevious && (
          <button
            type="button"
            onClick={onPrevious}
            aria-label="ข่าวก่อนหน้า"
            className="absolute left-3 top-1/3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-slate-950/70 text-white shadow-lg backdrop-blur transition hover:bg-slate-950 sm:left-5 sm:h-14 sm:w-14"
          >
            <ChevronRight className="h-7 w-7 rotate-180" />
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="ข่าวถัดไป"
            className="absolute right-3 top-1/3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-slate-950/70 text-white shadow-lg backdrop-blur transition hover:bg-slate-950 sm:right-5 sm:h-14 sm:w-14"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}

        <div className="p-8">
          <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold mb-4 border border-blue-100">
            ประกาศเมื่อ: {formatThaiDateTime(news.date)} น.
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            {news.title}
          </h2>
          <div className="text-gray-700 leading-loose text-lg whitespace-pre-wrap">
            {news.content}
          </div>

          <div className="mt-10 pt-6 border-t border-gray-100 flex justify-center">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, count, color, icon }) {
  return (
    <div
      className={`p-6 md:p-8 rounded-3xl border bg-white shadow-sm flex items-center justify-between ${color}`}
    >
      <div>
        <p
          className={`text-sm md:text-base font-bold uppercase tracking-wider mb-2 ${color.split(" ")[1]}`}
        >
          {title}
        </p>
        <p className="text-5xl font-black text-gray-900">{count}</p>
      </div>
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white ${color.split(" ")[0].replace("100", "500")} shadow-lg`}
      >
        {React.cloneElement(icon, { className: "w-8 h-8" })}
      </div>
    </div>
  );
}

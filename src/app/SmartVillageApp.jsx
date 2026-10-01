import React, { useEffect, useState } from "react";
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
  Download,
  Filter,
  Image,
} from "lucide-react";
import {
  MOCK_INCIDENTS,
  MOCK_NEWS,
  MOCK_NOTIFS,
  MOCK_USERS,
} from "../data/mockData";
import { api } from "../services/api";
import { setupFirebaseNotifications } from "../services/firebaseNotifications";

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
const normalizeUser = (user) => ({
  ...user,
  houseNo: user.houseNo ?? user.house_no,
  accountStatus: user.accountStatus ?? user.account_status,
  villageId: user.villageId ?? user.village_id,
  villageName: user.villageName ?? user.village?.name,
  villageMoo: user.villageMoo ?? user.village?.moo,
});
const normalizeNews = (item) => ({
  ...item,
  date: item.date ?? item.published_at ?? item.created_at,
  displaySection:
    item.displaySection ??
    item.display_section ??
    (item.video_url ? "video" : "news"),
});
const normalizeIncident = (item) => ({
  ...item,
  userId: item.userId ?? item.user_id,
  userName: item.userName ?? item.user?.name,
  houseNo: item.houseNo ?? item.user?.house_no,
  resolvedImage: item.resolvedImage ?? item.resolved_image,
  firstResponseAt: item.firstResponseAt ?? item.first_response_at,
  resolvedAt: item.resolvedAt ?? item.resolved_at,
  assignedTo: item.assignedTo ?? item.assigned_to,
  assignedToName: item.assignedToName ?? item.assignee?.name,
  assignedAt: item.assignedAt ?? item.assigned_at,
  referenceNo: item.referenceNo ?? item.reference_no,
  villageId: item.villageId ?? item.village_id,
  villageName:
    item.villageName ?? item.village?.name ?? item.user?.village?.name,
  villageMoo: item.villageMoo ?? item.village?.moo ?? item.user?.village?.moo,
  requiresTao: item.requiresTao ?? item.requires_tao,
  forwardedToTaoAt: item.forwardedToTaoAt ?? item.forwarded_to_tao_at,
  budgetRequest: item.budgetRequest ?? item.budget_request,
  feedback: item.feedback ?? null,
  submittedForReviewAt:
    item.submittedForReviewAt ?? item.submitted_for_review_at,
  verifiedAt: item.verifiedAt ?? item.verified_at,
  updates: item.updates ?? [],
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
const projectStatusLabels = {
  proposed: "เสนอให้ อบต.พิจารณา",
  approved: "อนุมัติโครงการแล้ว",
  planned: "เตรียมดำเนินการ",
  in_progress: "กำลังดำเนินโครงการ",
  waiting_review: "โครงการรอตรวจรับ",
  completed: "ปิดโครงการแล้ว",
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

const formatThaiDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const getStatusLabel = (status) =>
  ({
    pending: "รอตรวจสอบ",
    assigned: "มอบหมายแล้ว",
    in_progress: "กำลังดำเนินการ",
    waiting_review: "รอตรวจรับ",
    revision_requested: "ส่งกลับแก้ไข",
    resolved: "เสร็จสิ้น",
    cancelled: "ยกเลิก",
  })[status] || status;

const getPriorityMeta = (priority = 1) =>
  ({
    1: { label: "ปกติ", color: "bg-slate-100 text-slate-700 border-slate-200" },
    2: { label: "สำคัญ", color: "bg-blue-100 text-blue-700 border-blue-200" },
    3: {
      label: "เร่งด่วน",
      color: "bg-orange-100 text-orange-700 border-orange-200",
    },
    4: { label: "ฉุกเฉิน", color: "bg-red-100 text-red-700 border-red-200" },
  })[Number(priority)] || {
    label: "ปกติ",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  };

// --- MAIN APP COMPONENT ---
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState(() =>
    new URLSearchParams(window.location.search).has("reset_token")
      ? "auth"
      : "landing",
  ); // landing, auth, dashboard
  const [activeTab, setActiveTab] = useState("news"); // Managed globally for sidebar integration
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
    if (!api.hasSession()) return undefined;
    let isMounted = true;

    Promise.all([api.getMe(), api.getDashboardData()])
      .then(([account, dashboard]) => {
        if (!isMounted) return;
        const user = normalizeUser(account.user || account);
        setCurrentUser(user);
        setActiveTab(
          isTaoRole(user.role)
            ? "tao_overview"
            : isVillageAdminRole(user.role)
              ? "stats"
              : "news",
        );
        setCurrentView("dashboard");
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
      .catch(() => api.clearSession());

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
          error?.data?.account_status === "pending"
            ? "บัญชีนี้มีอยู่ในฐานข้อมูลแล้ว และกำลังรอแอดมินหมู่บ้านอนุมัติ ไม่ต้องสมัครใหม่"
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
      accountStatus: "pending",
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
  if (currentView === "landing")
    return <LandingPage onNavigate={setCurrentView} news={news} />;
  if (currentView === "auth")
    return (
      <AuthPage
        villages={villages}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onBack={() => setCurrentView("landing")}
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
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [publicSearch, setPublicSearch] = useState("");
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
  const currentSlide = publicSlides[slideIndex];
  const visibleActivityNews = activityNews.filter(
    (item) =>
      !publicSearch.trim() ||
      `${item.title} ${item.content}`
        .toLowerCase()
        .includes(publicSearch.trim().toLowerCase()),
  );
  const promoItem = centralNews.find(
    (item) => item.displaySection === "video" && item.video_url,
  );
  const promoVideoUrl = (() => {
    const value = promoItem?.video_url || "";
    const youtube = value.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/,
    );
    return youtube ? `https://www.youtube.com/embed/${youtube[1]}` : value;
  })();
  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 font-sans text-slate-900 scroll-smooth">
      <header className="public-header bg-[#3195e8] text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[320px_1fr_auto] lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-white/30 bg-white/15 shadow-lg">
              <Home className="h-11 w-11" />
            </div>
            <div>
              <div className="text-sm font-bold text-blue-100">
                องค์การบริหารส่วนตำบล
              </div>
              <div className="text-4xl font-black leading-none">มะต้อง</div>
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              document
                .querySelector("#activities")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="hidden overflow-hidden rounded-xl bg-white shadow-sm md:flex"
          >
            <input
              value={publicSearch}
              onChange={(e) => setPublicSearch(e.target.value)}
              className="min-w-0 flex-1 px-5 py-4 text-sm text-slate-700 outline-none"
              placeholder="ค้นหาข่าว กิจกรรม หรือประกาศของ อบต.มะต้อง"
            />
            <button className="flex w-16 items-center justify-center bg-cyan-400 text-white hover:bg-cyan-500">
              <Search className="h-7 w-7" />
            </button>
          </form>
          <div className="flex items-center gap-2 lg:justify-end">
            <button
              onClick={() => onNavigate("auth")}
              className="rounded-lg border border-white/60 px-4 py-2 text-sm font-bold hover:bg-white/10"
            >
              เข้าสู่ระบบ
            </button>
            <button
              onClick={() => onNavigate("auth")}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow"
            >
              สมัครสมาชิก
            </button>
          </div>
        </div>
      </header>
      <nav className="public-nav sticky top-0 z-50 border-b bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 py-2 sm:justify-center sm:gap-3">
          <a
            href="#home"
            className="whitespace-nowrap rounded-lg px-5 py-3 text-base font-bold text-blue-700 hover:bg-blue-50"
          >
            หน้าหลัก
          </a>
          <a
            href="#activities"
            className="whitespace-nowrap rounded-lg px-5 py-3 text-base font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-700"
          >
            ข่าวกิจกรรม
          </a>
          <a
            href="#contact"
            className="whitespace-nowrap rounded-lg px-5 py-3 text-base font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-700"
          >
            ติดต่อเรา
          </a>
        </div>
      </nav>

      <section id="home" className="public-hero bg-blue-950">
        <div className="relative mx-auto h-[360px] max-w-[1600px] overflow-hidden bg-gradient-to-br from-blue-900 to-slate-950 sm:h-[500px] lg:h-[610px]">
          {currentSlide ? (
            <>
              <img
                key={currentSlide.id}
                src={currentSlide.image}
                alt={currentSlide.title}
                className="h-full w-full object-cover animate-fadeIn"
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-white">
              <div>
                <Bell className="mx-auto h-12 w-12 text-blue-300" />
                <h1 className="mt-4 text-2xl font-black sm:text-4xl">
                  ข่าวประชาสัมพันธ์ อบต.มะต้อง
                </h1>
                <p className="mt-2 text-slate-300">
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
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65"
              >
                <ChevronRight className="rotate-180" />
              </button>
              <button
                aria-label="ภาพถัดไป"
                onClick={() =>
                  setSlideIndex((index) => (index + 1) % publicSlides.length)
                }
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65"
              >
                <ChevronRight />
              </button>
              <div className="absolute bottom-4 right-5 flex gap-2 sm:bottom-7 sm:right-8">
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
        <section id="activities" className="border-y bg-white py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-10 text-center text-3xl font-black">
              ภาพกิจกรรมและข่าวประชาสัมพันธ์
            </h2>
            <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
              {visibleActivityNews.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedSlide(item)}
                  className="group text-left"
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-slate-200 shadow-sm">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Bell className="h-10 w-10 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="mt-4 text-sm font-bold text-slate-500">
                    ข่าวประชาสัมพันธ์
                  </div>
                  <h3 className="mt-1 line-clamp-2 text-lg font-black leading-snug group-hover:text-blue-700">
                    {item.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                    {item.content}
                  </p>
                </button>
              ))}
              {!visibleActivityNews.length && (
                <div className="py-12 text-center text-slate-500 md:col-span-2 lg:col-span-3">
                  ไม่พบข่าวที่ค้นหา
                </div>
              )}
            </div>
          </div>
        </section>
      )}
      {activityNews.length === 0 && (
        <section id="activities" className="border-y bg-white py-16">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black">
              ภาพกิจกรรมและข่าวประชาสัมพันธ์
            </h2>
            <div className="mt-8 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-slate-500">
              <Image className="mx-auto h-12 w-12 text-slate-300" />
              <div className="mt-3 font-bold">ยังไม่มีภาพกิจกรรมที่เผยแพร่</div>
              <div className="mt-1 text-sm"></div>
            </div>
          </div>
        </section>
      )}

      <section className="bg-[#0868c9] py-14 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-7 text-3xl font-black">
            สื่อประชาสัมพันธ์ตำบลมะต้อง
          </h2>
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-blue-950 shadow-2xl">
            <div className="aspect-video">
              {promoItem && promoVideoUrl ? (
                promoVideoUrl.includes("youtube.com/embed") ? (
                  <iframe
                    src={promoVideoUrl}
                    title={promoItem?.title || "วิดีโอแนะนำตำบลมะต้อง"}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={promoVideoUrl}
                    poster={promoItem?.image || undefined}
                    controls
                    className="h-full w-full bg-black object-contain"
                  />
                )
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-center text-blue-200">
                  <div>
                    <Upload className="mx-auto h-12 w-12 opacity-70" />
                    <div className="mt-4 text-xl font-black text-white">
                      ยังไม่มีวิดีโอ
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <div className="text-sm font-black text-blue-600">
              แผนที่พื้นที่ให้บริการ
            </div>
            <h2 className="mt-1 text-3xl font-black">
              ตำบลมะต้อง อำเภอพรหมพิราม
            </h2>
            <p className="mt-2 text-slate-500">แสดงที่ตั้งและพื้นที่ให้บริการขององค์การบริหารส่วนตำบลมะต้อง</p>
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

      <footer id="contact" className="bg-gray-900 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="mb-6 flex items-center gap-2 text-2xl font-bold">
                <Home className="h-8 w-8 text-blue-500" />
                {APP_NAME}
              </div>
              <p className="max-w-xs text-gray-400">
                ชุมชนน่าอยู่ ปลอดภัย สังคมแห่งการแบ่งปัน ร่วมสร้าง{VILLAGE_NAME}
                ให้ดียิ่งขึ้นไปพร้อมกัน
              </p>
            </div>
            <div>
              <h4 className="mb-6 text-lg font-bold">
                ติดต่อผู้ดูแลหมู่บ้าน / นิติบุคคล
              </h4>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-400">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800">
                    <Phone className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">
                      เบอร์โทรศัพท์ฉุกเฉิน
                    </p>
                    <p className="font-semibold text-white">
                      089-999-9999 (ผู้ใหญ่บ้าน)
                    </p>
                  </div>
                </li>
                <li className="flex items-center gap-3 text-gray-400">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800">
                    <Facebook className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Facebook Page</p>
                    <p className="font-semibold text-white">
                      {VILLAGE_NAME} Official
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} {APP_NAME}
          </div>
        </div>
      </footer>
      {selectedSlide && (
        <NewsModal
          news={selectedSlide}
          onClose={() => setSelectedSlide(null)}
        />
      )}
    </div>
  );
}

// ==========================================
// 2. AUTH PAGE (Login / Signup)
// ==========================================
function AuthPage({ villages, onLogin, onRegister, onBack }) {
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get("reset_token") || "";
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [reg, setReg] = useState({
    name: "",
    phone: "",
    email: "",
    houseNo: "",
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
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100";
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
        houseNo: "",
        villageId: "",
        password: "",
      });
      setMode("login");
      setMessage(
        "บันทึกข้อมูลสมาชิกลงฐานข้อมูลแล้ว ไม่ต้องสมัครซ้ำ ขณะนี้บัญชีกำลังรอแอดมินหมู่บ้านอนุมัติ หลังอนุมัติให้เข้าสู่ระบบด้วยเบอร์โทรศัพท์นี้",
      );
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
    <div className="min-h-dvh bg-slate-100 p-3 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-blue-700"
        >
          <ChevronRight className="h-5 w-5 rotate-180" />
          กลับหน้าแรก
        </button>
        <div className="hidden text-sm text-slate-500 sm:block">
          องค์การบริหารส่วนตำบลมะต้อง
        </div>
      </div>
      <section
        className={`mx-auto mt-3 grid min-h-[calc(100dvh-7rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-xl ring-1 ring-slate-200 ${mode === "register" ? "lg:grid-cols-[.8fr_1.2fr]" : "lg:grid-cols-2"}`}
      >
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Home className="h-8 w-8" />
            </div>
            <div className="mt-7 text-sm font-bold text-cyan-200">
              ศูนย์บริการประชาชนออนไลน์
            </div>
            <h1 className="mt-2 text-4xl font-black leading-tight">
              องค์การบริหารส่วน
              <br />
              ตำบลมะต้อง
            </h1>
            <p className="mt-5 max-w-md leading-7 text-blue-100">
              แจ้งเหตุร้องทุกข์ ติดตามการดำเนินงาน และรับข่าวสารจากหมู่บ้านและ
              อบต. ได้ในระบบเดียว
            </p>
          </div>
          <div className="relative space-y-3 text-sm text-blue-100">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-cyan-300" />
              บัญชีประชาชนแยกตามหมู่บ้าน
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-cyan-300" />
              ติดตามสถานะและหลักฐานการแก้ไข
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-cyan-300" />
              ข้อมูลส่วนตัวได้รับการดูแลตามสิทธิ์ผู้ใช้
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center overflow-y-auto p-5 sm:p-9 lg:p-12">
          <div
            className={`w-full ${mode === "register" ? "max-w-2xl" : "max-w-md"}`}
          >
            <div className="mb-7">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 lg:hidden">
                <Home className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-blue-600">
                ระบบบริการประชาชน อบต.มะต้อง
              </p>
              <h2 className="mt-1 text-3xl font-black text-slate-900">
                {pageTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {mode === "register"
                  ? "กรอกข้อมูลจริงเพื่อให้ผู้ดูแลหมู่บ้านตรวจสอบและอนุมัติบัญชี"
                  : mode === "login"
                    ? "ใช้เบอร์โทรศัพท์หรือบัญชีเจ้าหน้าที่เพื่อเข้าสู่ระบบ"
                    : "ดำเนินการตามขั้นตอนด้านล่าง"}
              </p>
            </div>
            {!["forgot", "reset"].includes(mode) && (
              <div className="mb-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button
                  onClick={() => switchMode("login")}
                  className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${mode === "login" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  เข้าสู่ระบบ
                </button>
                <button
                  onClick={() => switchMode("register")}
                  className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${mode === "register" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  สมัครสมาชิก
                </button>
              </div>
            )}
            {message && (
              <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm leading-6 text-green-800">
                {message}
              </div>
            )}
            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
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
                <label className="block text-sm font-bold text-slate-700">
                  เบอร์โทรศัพท์ / Username
                  <input
                    required
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    className={inputClass}
                    placeholder="08xxxxxxxx หรือ username"
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  รหัสผ่าน
                  <input
                    type="password"
                    required
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    className={inputClass}
                    placeholder="••••••••"
                  />
                </label>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-sm font-bold text-blue-600 hover:underline"
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </div>
                <button className="w-full rounded-xl bg-blue-600 py-3.5 text-lg font-bold text-white shadow-lg shadow-blue-200">
                  เข้าสู่ระบบ
                </button>
              </form>
            )}
            {mode === "register" && (
              <form onSubmit={submitRegister} className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">
                  ชื่อ - นามสกุล
                  <input
                    required
                    value={reg.name}
                    onChange={(e) => setReg({ ...reg, name: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700">
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
                  <label className="block text-sm font-bold text-slate-700">
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
                  <label className="block text-sm font-bold text-slate-700">
                    บ้านเลขที่
                    <input
                      required
                      value={reg.houseNo}
                      onChange={(e) =>
                        setReg({ ...reg, houseNo: e.target.value })
                      }
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className="block text-sm font-bold text-slate-700">
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
                <label className="block text-sm font-bold text-slate-700">
                  ตั้งรหัสผ่าน
                  <input
                    type="password"
                    required
                    minLength="8"
                    value={reg.password}
                    onChange={(e) =>
                      setReg({ ...reg, password: e.target.value })
                    }
                    className={inputClass}
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                  />
                </label>
                <button
                  disabled={loading}
                  className="w-full rounded-xl bg-green-600 py-3.5 text-lg font-bold text-white shadow-lg shadow-green-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิกประชาชน"}
                </button>
              </form>
            )}
            {mode === "forgot" && (
              <form onSubmit={submitForgot} className="space-y-5">
                <div className="text-center">
                  <h2 className="text-2xl font-black">ลืมรหัสผ่าน</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    กรอกอีเมลกู้คืน ระบบจะส่งลิงก์ให้โดยไม่ต้องรอแอดมิน
                  </p>
                </div>
                <label className="block text-sm font-bold text-slate-700">
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
                      : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="w-full text-sm font-bold text-blue-600"
                >
                  กลับหน้าเข้าสู่ระบบ
                </button>
              </form>
            )}
            {mode === "reset" && (
              <form onSubmit={submitReset} className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-3 text-center text-sm text-slate-500">
                  {email}
                </div>
                <label className="block text-sm font-bold text-slate-700">
                  รหัสผ่านใหม่
                  <input
                    autoFocus
                    type="password"
                    required
                    minLength="8"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  ยืนยันรหัสผ่านใหม่
                  <input
                    type="password"
                    required
                    minLength="8"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <button
                  disabled={loading}
                  className="w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white disabled:opacity-50"
                >
                  {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
                </button>
              </form>
            )}
            <div className="mt-7 border-t pt-5 text-center text-xs leading-5 text-slate-400">
              หากพบปัญหาการใช้งาน กรุณาติดต่อผู้ดูแลหมู่บ้านของท่าน
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function AuthPageLegacy({ onLogin, onRegister, onBack }) {
  const [isLogin, setIsLogin] = useState(true);

  // Login State
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  // Register State
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regHouseNo, setRegHouseNo] = useState("");
  const [regPass, setRegPass] = useState("");

  const submitLogin = (e) => {
    e.preventDefault();
    onLogin(loginPhone, loginPass);
  };

  const submitRegister = (e) => {
    e.preventDefault();
    if (!regName || !regPhone || !regHouseNo || !regPass)
      return alert("กรอกข้อมูลให้ครบถ้วน");
    onRegister({
      name: regName,
      phone: regPhone,
      houseNo: regHouseNo,
      password: regPass,
    });
  };

  return (
    <div className="min-h-dvh bg-gray-100 flex items-center justify-center px-3 py-16 sm:p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-96 bg-blue-600 rounded-b-[40%] shadow-xl"></div>

      <button
        onClick={onBack}
        className="absolute top-3 left-3 sm:top-6 sm:left-6 text-white flex items-center gap-2 hover:opacity-80 transition z-10 text-sm sm:text-base font-medium bg-black/20 px-3 sm:px-4 py-2 rounded-full backdrop-blur-sm"
      >
        <ChevronRight className="w-5 h-5 rotate-180" /> กลับหน้าแรก
      </button>

      <div className="bg-white w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 relative">
        <div className="flex">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-4 text-center font-bold text-lg transition ${isLogin ? "bg-white text-blue-600 border-b-2 border-blue-600" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
          >
            เข้าสู่ระบบ
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-4 text-center font-bold text-lg transition ${!isLogin ? "bg-white text-blue-600 border-b-2 border-blue-600" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
          >
            สมัครสมาชิก
          </button>
        </div>

        <div className="p-5 sm:p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
              <Home className="w-8 h-8" />
            </div>
          </div>

          {isLogin ? (
            <form onSubmit={submitLogin} className="space-y-5 animate-fadeIn">
              {/* ลบกรอบแสดงรหัสแอดมินออกตามคำขอ */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  เบอร์โทรศัพท์ / Username
                </label>
                <input
                  type="text"
                  required
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-gray-50 focus:bg-white"
                  placeholder="08xxxxxxxx หรือ username"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  รหัสผ่าน
                </label>
                <input
                  type="password"
                  required
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-gray-50 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotHelp((value) => !value)}
                  aria-expanded={showForgotHelp}
                  className="text-sm font-bold text-blue-600 hover:underline"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>
              {showForgotHelp && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left text-sm text-blue-950">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black">ขอตั้งรหัสผ่านใหม่</div>
                      <p className="mt-1 leading-6 text-blue-800">
                        กรุณาติดต่อผู้ดูแลหมู่บ้าน แจ้งชื่อ เบอร์โทรศัพท์
                        และบ้านเลขที่เพื่อยืนยันตัวตน
                        จากนั้นผู้ดูแลจะตั้งรหัสผ่านชั่วคราวให้
                      </p>
                      <div className="mt-2 font-bold">
                        โทร: 089-999-9999 (ผู้ใหญ่บ้าน)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowForgotHelp(false)}
                      aria-label="ปิดคำแนะนำ"
                      className="shrink-0 rounded-lg p-1 text-blue-600 hover:bg-blue-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 mt-4"
              >
                เข้าสู่ระบบ
              </button>
            </form>
          ) : (
            <form
              onSubmit={submitRegister}
              className="space-y-4 animate-fadeIn"
            >
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  ชื่อ - นามสกุล
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white"
                  placeholder="สมชาย ใจดี"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white"
                    placeholder="08xxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    บ้านเลขที่
                  </label>
                  <input
                    type="text"
                    required
                    value={regHouseNo}
                    onChange={(e) => setRegHouseNo(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white"
                    placeholder="99/99"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  ตั้งรหัสผ่าน
                </label>
                <input
                  type="password"
                  required
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white"
                  placeholder="ตั้งรหัสผ่านสำหรับเข้าสู่ระบบ"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-green-700 transition shadow-lg shadow-green-200 mt-4"
              >
                สมัครสมาชิกลูกบ้าน
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// SHARED LAYOUT COMPONENTS
// ==========================================
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
      <div className="h-20 flex items-center justify-between px-6 border-b border-white/10">
        <div className="flex items-center">
          <Home className="w-6 h-6 text-blue-500 mr-2" />
          <span className="font-bold text-lg tracking-wide">
            {VILLAGE_NAME}
          </span>
        </div>
        <button
          className="lg:hidden text-gray-400 hover:text-white"
          onClick={() => setIsOpen(false)}
          aria-label="ปิดเมนู"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="mx-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
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
      <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
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
      <div className="p-4 border-t border-gray-800">
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
          <Home className="hidden min-[380px]:block w-5 sm:w-6 h-5 sm:h-6 shrink-0 text-blue-600 mr-1.5 sm:mr-2" />
          <span className="truncate font-bold text-sm min-[380px]:text-base sm:text-lg text-gray-800">
            {VILLAGE_NAME}
          </span>
        </div>
        <div className="hidden lg:block min-w-0">
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
            {isTaoRole(currentUser?.role)
              ? `ศูนย์ปฏิบัติการ ${VILLAGE_NAME}`
              : isVillageAdminRole(currentUser?.role)
                ? `ระบบแอดมินหมู่ ${currentUser?.villageMoo || "-"} ${currentUser?.villageName || ""}`
                : `ระบบบริการประชาชน ${VILLAGE_NAME}`}
          </h2>
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
                    <div
                      key={notif.id}
                      className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer ${notif.isRead ? "opacity-60" : "bg-blue-50/30"}`}
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
                    </div>
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
function CitizenFeedback({ incident, onSaved }) {
  const [rating, setRating] = useState(incident.feedback?.rating || 0);
  const [comment, setComment] = useState(incident.feedback?.comment || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!rating) return alert("กรุณาเลือกคะแนน 1–5 ดาว");
    setSaving(true);
    try {
      const data = await api.saveIncidentFeedback(incident.id, {
        rating,
        comment: comment.trim() || null,
      });
      onSaved(data.feedback);
      alert("ขอบคุณสำหรับการประเมินผล");
    } catch (error) {
      alert(error?.message || "บันทึกการประเมินไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="font-bold text-amber-950">ประเมินผลหลังแก้ไข</div>
      <div className="mt-2 flex gap-1" aria-label="คะแนนความพึงพอใจ">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className={`text-2xl ${value <= rating ? "text-amber-500" : "text-slate-300"}`}
            aria-label={`${value} ดาว`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        className="mt-2 h-16 w-full resize-none rounded-lg border bg-white p-2 text-sm"
        placeholder="ความคิดเห็นเพิ่มเติม (ไม่บังคับ)"
      />
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {saving
          ? "กำลังบันทึก..."
          : incident.feedback
            ? "แก้ไขการประเมิน"
            : "ส่งการประเมิน"}
      </button>
    </div>
  );
}

function UserDashboard({
  activeTab,
  setActiveTab,
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
  const [selectedPoint, setSelectedPoint] = useState(null);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert("รูปภาพต้องมีขนาดไม่เกิน 10MB");
        e.target.value = "";
        return;
      }
      if (image) URL.revokeObjectURL(image);
      setImageFile(file);
      setImage(URL.createObjectURL(file));
    }
  };

  const submitReport = async (e) => {
    e.preventDefault();
    if (!title || !desc || !location || !selectedPoint)
      return alert("กรุณากรอกข้อมูลและปักหมุดตำแหน่งให้ครบถ้วน");

    const incidentPayload = {
      id: "i" + Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      houseNo: currentUser.houseNo,
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
        return;
      }
      newIncident = incidentPayload;
    }

    setIncidents([newIncident, ...incidents]);
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

  const myIncidents = incidents.filter((i) => i.userId === currentUser.id);
  const activeIncidentCount = myIncidents.filter(
    (incident) => !["resolved", "rejected", "cancelled"].includes(incident.status),
  ).length;
  const resolvedIncidentCount = myIncidents.filter(
    (incident) => incident.status === "resolved",
  ).length;
  const villageNews = news.filter(
    (item) =>
      String(item.villageId || "") === String(currentUser.villageId || ""),
  );
  const citizenVillageLabel = currentUser.villageMoo
    ? `หมู่ ${currentUser.villageMoo} ${currentUser.villageName || ""}`
    : "หมู่บ้านของคุณ";

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-24 lg:pb-0">

      {/* VIEW: NEWS */}
      {activeTab === "news" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              ข่าวสารจาก{citizenVillageLabel}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className="min-h-20 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left active:scale-[0.98] transition"
            >
              <span className="block text-2xl font-black text-amber-700">{activeIncidentCount}</span>
              <span className="text-xs font-bold text-amber-800">กำลังดำเนินการ</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className="min-h-20 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left active:scale-[0.98] transition"
            >
              <span className="block text-2xl font-black text-emerald-700">{resolvedIncidentCount}</span>
              <span className="text-xs font-bold text-emerald-800">แก้ไขเสร็จแล้ว</span>
            </button>
          </div>
          <div className="grid gap-6">
            {villageNews.map((n) => (
              <div
                key={n.id}
                onClick={() => setSelectedNews(n)}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col sm:flex-row hover:shadow-xl hover:border-blue-200 cursor-pointer transition-all group relative"
              >
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-full opacity-0 group-hover:opacity-100 transition shadow-sm">
                  <ChevronRight className="w-5 h-5 text-blue-600" />
                </div>
                <div className="sm:w-1/3 h-56 sm:h-auto overflow-hidden">
                  <img
                    src={n.image}
                    alt="news"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                </div>
                <div className="p-6 sm:w-2/3 flex flex-col justify-center">
                  <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold mb-3 w-max border border-blue-100">
                    ประกาศเมื่อ: {n.date}
                  </span>
                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-700 transition">
                    {n.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed line-clamp-2">
                    {n.content}
                  </p>
                  <p className="text-sm text-blue-500 font-semibold mt-4">
                    คลิกเพื่ออ่านรายละเอียดทั้งหมด...
                  </p>
                </div>
              </div>
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
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:bg-gray-50 transition cursor-pointer relative overflow-hidden group h-40">
                    {image ? (
                      <div className="absolute inset-0 w-full h-full">
                        <img
                          src={image}
                          alt="preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <span className="text-white font-bold flex items-center gap-2">
                            <Upload className="w-5 h-5" /> เปลี่ยนรูปภาพ
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-center flex flex-col items-center justify-center h-full">
                        <Camera className="mx-auto h-12 w-12 text-gray-400 group-hover:text-blue-500 transition" />
                        <div className="text-sm text-gray-600">
                          <span className="text-blue-600 font-bold">
                            อัปโหลดรูปภาพ
                          </span>{" "}
                          หรือลากไฟล์มาวาง
                        </div>
                        <p className="text-xs text-gray-500">
                          PNG, JPG ไม่เกิน 10MB
                        </p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-[76px] z-20 -mx-4 border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pt-6 sm:pb-0 sm:flex sm:justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto bg-blue-600 text-white px-6 sm:px-10 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-6 h-6" /> ยืนยันการแจ้งเหตุ
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
          ) : (
            <div className="grid gap-4">
              {myIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col md:flex-row gap-5 hover:shadow-md transition"
                >
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
                    <div className="absolute top-2 left-2">
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
                      <div className="flex justify-between items-start">
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
                      <p className="text-sm text-blue-600 font-medium mb-2">
                        {inc.category}
                      </p>
                      <p className="text-gray-600 text-sm line-clamp-2">
                        {inc.description}
                      </p>
                      {inc.budgetRequest && (
                        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                          <div className="text-xs font-bold text-indigo-600">
                            เรื่องนี้ถูกเสนอเป็นโครงการ
                          </div>
                          <div className="mt-1 font-black text-indigo-950">
                            {inc.budgetRequest.project_title || inc.title}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-white px-3 py-1 font-bold text-indigo-800">
                              {projectStatusLabels[
                                inc.budgetRequest.project_status
                              ] ||
                                (inc.budgetRequest.status === "submitted"
                                  ? "รอ อบต.พิจารณา"
                                  : "อยู่ระหว่างพิจารณา")}
                            </span>
                            {[
                              "planned",
                              "in_progress",
                              "waiting_review",
                              "completed",
                            ].includes(inc.budgetRequest.project_status) && (
                              <span className="font-bold text-slate-600">
                                ความคืบหน้า{" "}
                                {inc.budgetRequest.progress_percent || 0}%
                              </span>
                            )}
                            {inc.budgetRequest.expected_end_date && (
                              <span className="text-slate-500">
                                กำหนดเสร็จ{" "}
                                {new Date(
                                  inc.budgetRequest.expected_end_date,
                                ).toLocaleDateString("th-TH")}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
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
                    {inc.status === "resolved" && (
                      <CitizenFeedback
                        incident={inc}
                        onSaved={(feedback) =>
                          setIncidents((items) =>
                            items.map((item) =>
                              item.id === inc.id ? { ...item, feedback } : item,
                            ),
                          )
                        }
                      />
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
                    {((inc.histories || []).length > 0 ||
                      (inc.updates || []).length > 0) && (
                      <details className="mt-4 border-t pt-3">
                        <summary className="cursor-pointer text-sm font-bold text-blue-600">
                          ดู Timeline การดำเนินงาน
                        </summary>
                        <div className="mt-3 space-y-3 border-l-2 border-blue-200 pl-4">
                          {[
                            ...(inc.histories || []).map((item) => ({
                              id: `h-${item.id}`,
                              at: item.created_at,
                              title: getStatusLabel(item.to_status),
                              note: item.note,
                            })),
                            ...(inc.updates || []).map((item) => ({
                              id: `u-${item.id}`,
                              at: item.created_at,
                              title:
                                item.type === "completion"
                                  ? "เจ้าหน้าที่ส่งงานให้ตรวจ"
                                  : "อัปเดตจากเจ้าหน้าที่",
                              note: item.message,
                              image: item.image,
                            })),
                          ]
                            .sort((a, b) => new Date(a.at) - new Date(b.at))
                            .map((item) => (
                              <div key={item.id} className="relative">
                                <span className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                                <div className="font-bold text-sm">
                                  {item.title}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatThaiDateTime(item.at)} น.
                                </div>
                                {item.note && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {item.note}
                                  </p>
                                )}
                                {item.image && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedIncidentImage({
                                        src: item.image,
                                        title: item.title,
                                      })
                                    }
                                    className="text-sm text-blue-600 font-bold mt-1"
                                  >
                                    ดูรูปประกอบ
                                  </button>
                                )}
                              </div>
                            ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-3 rounded-2xl border border-gray-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("news")}
          className={`min-h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition ${activeTab === "news" ? "bg-blue-50 text-blue-700" : "text-gray-500"}`}
        >
          <Bell className="h-5 w-5" /> ข่าวสาร
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
    </div>
  );
}

// ==========================================
// MAP COMPONENTS
// ==========================================
// บ้านไผ่ถ้ำ หมู่ 5 ตำบลมะต้อง อำเภอพรหมพิราม จังหวัดพิษณุโลก
const VILLAGE_MAP_CENTER = [17.1161397, 100.1908249];
const VILLAGE_MAP_BOUNDS = [
  [17.0911397, 100.1658249],
  [17.1411397, 100.2158249],
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
    <div className="rounded-3xl border border-gray-200 overflow-hidden bg-white shadow-sm">
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
        className="h-64 sm:h-72 w-full cursor-crosshair"
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

function SpatialAnalyticsMap({ incidents }) {
  return (
    <div className="relative h-80 rounded-3xl overflow-hidden border border-gray-200 bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.18),_transparent_24%),linear-gradient(135deg,_#fff7ed_0%,_#fee2e2_44%,_#eff6ff_100%)]">
      <div className="absolute inset-0 opacity-50">
        <div className="absolute inset-x-0 top-[24%] h-px bg-white/70" />
        <div className="absolute inset-x-0 top-[54%] h-px bg-white/70" />
        <div className="absolute inset-y-0 left-[32%] w-px bg-white/70" />
        <div className="absolute inset-y-0 left-[68%] w-px bg-white/70" />
      </div>
      <div className="absolute left-4 top-4 rounded-2xl bg-white/85 px-4 py-3 shadow-sm border border-white/80">
        <div className="text-sm font-bold text-gray-900">
          Heat Map จำลองของ{VILLAGE_NAME}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          ใช้พิกัดจากจุดร้องเรียนเพื่อแสดงพื้นที่หนาแน่นของปัญหา
        </div>
      </div>
      {incidents.map((inc) => {
        const pos = latLngToPercent(inc.lat, inc.lng);
        const heat = getHeatLevel(
          incidents.filter((other) => other.location === inc.location).length,
        );
        return (
          <div key={inc.id}>
            <div
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl opacity-45 ${heat.color}`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: 72,
                height: 72,
              }}
            />
            <div
              className="absolute -translate-x-1/2 -translate-y-full"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <MapPin
                className="w-7 h-7 text-red-600 drop-shadow-md"
                fill="currentColor"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 4. STAFF DASHBOARD
// ==========================================
function StaffDashboard({
  activeTab,
  currentUser,
  incidents,
  setIncidents,
  users,
  setUsers,
}) {
  const [selectedTask, setSelectedTask] = useState(null);
  const [progressMessage, setProgressMessage] = useState("");
  const [progressImage, setProgressImage] = useState(null);
  const [completionMessage, setCompletionMessage] = useState("");
  const [completionImage, setCompletionImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [caseNote, setCaseNote] = useState("");
  const [taskFilter, setTaskFilter] = useState("active");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskPage, setTaskPage] = useState(1);
  const [budgetDraft, setBudgetDraft] = useState({
    reason: "",
    estimated_amount: "",
  });

  const updateResidentStatus = async (resident, accountStatus) => {
    try {
      const data = await api.updateUserStatus(resident.id, accountStatus);
      setUsers((items) =>
        items.map((item) =>
          item.id === resident.id ? normalizeUser(data.user) : item,
        ),
      );
    } catch (error) {
      alert(error?.message || "อัปเดตบัญชีไม่สำเร็จ");
    }
  };

  const replaceIncident = (raw) => {
    const updated = normalizeIncident(raw);
    setIncidents((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    setSelectedTask(updated);
    return updated;
  };

  const startTask = async () => {
    setSaving(true);
    try {
      replaceIncident(await api.startIncident(selectedTask.id));
    } catch (error) {
      alert(error?.message || "เริ่มงานไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const addProgress = async (event) => {
    event.preventDefault();
    if (!progressMessage.trim() && !progressImage)
      return alert("กรุณาใส่ข้อความหรือแนบรูปความคืบหน้า");
    const payload = new FormData();
    if (progressMessage.trim())
      payload.append("message", progressMessage.trim());
    if (progressImage) payload.append("image", progressImage);
    setSaving(true);
    try {
      const data = await api.addIncidentProgress(selectedTask.id, payload);
      replaceIncident(data.incident);
      setProgressMessage("");
      setProgressImage(null);
      alert("บันทึกความคืบหน้าแล้ว");
    } catch (error) {
      alert(error?.message || "บันทึกความคืบหน้าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const submitWork = async (event) => {
    event.preventDefault();
    if (!completionImage) return alert("กรุณาแนบรูปหลังดำเนินงานเพื่อส่งตรวจ");
    const payload = new FormData();
    payload.append("resolvedImage", completionImage);
    if (completionMessage.trim())
      payload.append("message", completionMessage.trim());
    setSaving(true);
    try {
      replaceIncident(await api.submitIncidentWork(selectedTask.id, payload));
      setCompletionMessage("");
      setCompletionImage(null);
      alert("ส่งงานให้ผู้ดูแลตรวจรับแล้ว");
    } catch (error) {
      alert(error?.message || "ส่งงานไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const submitBudgetRequest = async (event) => {
    event.preventDefault();
    if (!budgetDraft.reason.trim() || !Number(budgetDraft.estimated_amount))
      return alert("กรอกเหตุผลและวงเงินประมาณการให้ครบ");
    setSaving(true);
    try {
      replaceIncident(
        await api.saveIncidentBudget(selectedTask.id, {
          reason: budgetDraft.reason.trim(),
          estimated_amount: Number(budgetDraft.estimated_amount),
          items: [],
          submit: true,
        }),
      );
      alert("ส่งคำของบประมาณให้ อบต.แล้ว");
    } catch (error) {
      alert(error?.message || "ส่งคำของบประมาณไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const forwardToTao = async () => {
    const note = window.prompt(
      "ระบุเหตุผลที่ส่งต่อให้ อบต. (ไม่ใช่คำของบประมาณ)",
    );
    if (note === null) return;
    setSaving(true);
    try {
      replaceIncident(
        await api.forwardIncidentToTao(selectedTask.id, note.trim() || null),
      );
      alert("ส่งเรื่องให้ อบต.แล้ว");
    } catch (error) {
      alert(error?.message || "ส่งต่อเรื่องไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const statusOrder = {
    revision_requested: 0,
    pending: 1,
    assigned: 2,
    in_progress: 3,
    waiting_review: 4,
    resolved: 5,
  };
  const tasks = [...incidents].sort((a, b) => {
    const statusDifference =
      (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (statusDifference) return statusDifference;
    const priorityDifference =
      Number(b.priority || 1) - Number(a.priority || 1);
    return (
      priorityDifference ||
      new Date(a.assignedAt || a.date || 0) -
        new Date(b.assignedAt || b.date || 0)
    );
  });
  const activeCount = tasks.filter((task) =>
    ["pending", "assigned", "in_progress", "revision_requested"].includes(
      task.status,
    ),
  ).length;
  const reviewCount = tasks.filter(
    (task) => task.status === "waiting_review",
  ).length;
  const resolvedCount = tasks.filter(
    (task) => task.status === "resolved",
  ).length;
  const overdueTaskCount = tasks.filter(
    (task) =>
      ["assigned", "in_progress", "revision_requested"].includes(task.status) &&
      getHoursDiff(task.assignedAt || task.date, new Date().toISOString()) > 24,
  ).length;
  const staffCompletionRate = tasks.length
    ? Math.round((resolvedCount / tasks.length) * 100)
    : 0;
  const nextTask = tasks.find((task) =>
    ["revision_requested", "assigned", "in_progress"].includes(task.status),
  );
  const workLanes = [
    {
      label: "เรื่องใหม่",
      status: "pending",
      items: tasks.filter((task) => task.status === "pending").slice(0, 3),
      tone: "border-blue-200 bg-blue-50",
    },
    {
      label: "กำลังทำ",
      status: "in_progress",
      items: tasks.filter((task) => task.status === "in_progress").slice(0, 3),
      tone: "border-amber-200 bg-amber-50",
    },
    {
      label: "ต้องแก้ไข",
      status: "revision_requested",
      items: tasks
        .filter((task) => task.status === "revision_requested")
        .slice(0, 3),
      tone: "border-red-200 bg-red-50",
    },
  ];
  const filteredTasks = tasks.filter((task) => {
    const matchesFilter =
      taskFilter === "all" ||
      (taskFilter === "active" &&
        ["pending", "assigned", "in_progress", "revision_requested"].includes(
          task.status,
        )) ||
      (taskFilter === "review" && task.status === "waiting_review") ||
      (taskFilter === "resolved" && task.status === "resolved");
    const query = taskSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [task.id, task.title, task.category, task.location].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      );
    return matchesFilter && matchesSearch;
  });
  const taskPageSize = 6;
  const taskTotalPages = Math.max(
    1,
    Math.ceil(filteredTasks.length / taskPageSize),
  );
  const safeTaskPage = Math.min(taskPage, taskTotalPages);
  const pagedTasks = filteredTasks.slice(
    (safeTaskPage - 1) * taskPageSize,
    safeTaskPage * taskPageSize,
  );

  if (activeTab === "village_users") {
    return (
      <div className="mx-auto max-w-6xl space-y-5 animate-fadeIn">
        <section className="rounded-3xl bg-gradient-to-r from-slate-950 to-teal-900 p-6 text-white">
          <div className="text-sm font-bold text-teal-200">
            หมู่ {currentUser?.villageMoo || "-"}{" "}
            {currentUser?.villageName || ""}
          </div>
          <h2 className="mt-1 text-3xl font-black">ประชาชนในหมู่บ้าน</h2>
          <p className="mt-2 text-slate-300">
            เห็นและอนุมัติเฉพาะบัญชีประชาชนที่เลือกหมู่บ้านนี้เท่านั้น
          </p>
        </section>
        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="bg-slate-50 text-sm text-slate-500">
                  <th className="p-4">ชื่อ</th>
                  <th className="p-4">บัญชี</th>
                  <th className="p-4">บ้านเลขที่</th>
                  <th className="p-4">สถานะ</th>
                  <th className="p-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(users || [])
                  .filter((user) => user.role === "user")
                  .map((resident) => (
                    <tr key={resident.id}>
                      <td className="p-4 font-bold">{resident.name}</td>
                      <td className="p-4">{resident.phone}</td>
                      <td className="p-4">{resident.houseNo}</td>
                      <td className="p-4">
                        {{
                          approved: "อนุมัติแล้ว",
                          pending: "รออนุมัติ",
                          rejected: "ไม่อนุมัติ",
                          suspended: "ระงับ",
                        }[resident.accountStatus] || resident.accountStatus}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          {resident.accountStatus !== "approved" && (
                            <button
                              onClick={() =>
                                updateResidentStatus(resident, "approved")
                              }
                              className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-800"
                            >
                              อนุมัติ
                            </button>
                          )}
                          {resident.accountStatus === "approved" && (
                            <button
                              onClick={() =>
                                updateResidentStatus(resident, "suspended")
                              }
                              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700"
                            >
                              ระงับ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!(users || []).some((user) => user.role === "user") && (
              <div className="p-12 text-center text-slate-500">
                ยังไม่มีบัญชีประชาชนในหมู่บ้านนี้
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (selectedTask) {
    return (
      <div className="max-w-4xl mx-auto space-y-5 animate-fadeIn">
        <button
          onClick={() => setSelectedTask(null)}
          className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 font-bold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
        >
          ← กลับไปรายการงาน
        </button>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b pb-5">
            <div>
              <div className="text-sm text-gray-500">
                ใบงาน #{selectedTask.id}
              </div>
              <h2 className="text-2xl font-bold">{selectedTask.title}</h2>
              <p className="text-blue-600">{selectedTask.category}</p>
            </div>
            <StatusBadge status={selectedTask.status} size="lg" />
          </div>
          <div className="my-5 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-xs font-bold text-slate-500">
            <div
              className={
                ["assigned", "revision_requested"].includes(selectedTask.status)
                  ? "rounded-xl bg-blue-600 px-2 py-3 text-white"
                  : "px-2 py-3"
              }
            >
              1 รับงาน
            </div>
            <div
              className={
                selectedTask.status === "in_progress"
                  ? "rounded-xl bg-blue-600 px-2 py-3 text-white"
                  : "px-2 py-3"
              }
            >
              2 ดำเนินงาน
            </div>
            <div
              className={
                ["waiting_review", "resolved"].includes(selectedTask.status)
                  ? "rounded-xl bg-emerald-600 px-2 py-3 text-white"
                  : "px-2 py-3"
              }
            >
              3 ส่งตรวจ
            </div>
          </div>
          <div className="grid gap-3 py-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-sm font-bold text-gray-500">รายละเอียด</div>
              <p className="mt-1 text-gray-800">{selectedTask.description}</p>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-500">สถานที่</div>
              <p className="mt-1 text-gray-800 flex gap-1">
                <MapPin className="w-5 h-5" />
                {selectedTask.location}
              </p>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-500">
                ผู้แจ้ง / บ้านเลขที่
              </div>
              <p className="mt-1 text-gray-800">
                {selectedTask.userName || "-"} · {selectedTask.houseNo || "-"}
              </p>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-500">
                กรอบเวลาดำเนินงาน
              </div>
              <p
                className={`mt-1 font-bold ${getHoursDiff(selectedTask.assignedAt || selectedTask.date, new Date().toISOString()) > 24 && !["resolved", "cancelled", "waiting_review"].includes(selectedTask.status) ? "text-red-700" : "text-emerald-700"}`}
              >
                {["resolved", "cancelled", "waiting_review"].includes(
                  selectedTask.status,
                )
                  ? "ดำเนินการแล้ว"
                  : getHoursDiff(
                        selectedTask.assignedAt || selectedTask.date,
                        new Date().toISOString(),
                      ) > 24
                    ? "เกิน 24 ชม. — เร่งติดตาม"
                    : "ยังอยู่ใน 24 ชม."}
              </p>
            </div>
          </div>
          {selectedTask.image && (
            <img
              src={selectedTask.image}
              alt="รูปแจ้งเหตุ"
              className="w-full max-h-80 object-contain bg-gray-100 rounded-2xl mb-5"
            />
          )}
          {["pending", "assigned", "revision_requested"].includes(
            selectedTask.status,
          ) && (
            <button
              disabled={saving}
              onClick={startTask}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {selectedTask.status === "revision_requested"
                ? "เริ่มแก้ไขงานตามคำแนะนำ"
                : "รับเรื่องและเริ่มดำเนินการ"}
            </button>
          )}
          {!["resolved", "cancelled"].includes(selectedTask.status) && (
            <form
              onSubmit={submitBudgetRequest}
              className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-emerald-950">
                    ส่งต่อ อบต. / ขอรับการสนับสนุนงบประมาณ
                  </h3>
                  <p className="text-sm text-emerald-800">
                    ส่งต่อทั่วไปได้โดยไม่ต้องของบ
                    หรือกรอกรายละเอียดเมื่อจำเป็นต้องใช้งบประมาณ
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-800">
                  {selectedTask.requiresTao
                    ? "ส่งต่อแล้ว"
                    : selectedTask.budgetRequest?.status || "ยังไม่ส่งต่อ"}
                </span>
              </div>
              <button
                type="button"
                disabled={saving || selectedTask.requiresTao}
                onClick={forwardToTao}
                className="mt-3 w-full rounded-xl border border-emerald-300 bg-white px-5 py-3 font-bold text-emerald-800 disabled:opacity-40"
              >
                ส่งเรื่องให้ อบต.โดยไม่ของบประมาณ
              </button>
              <div className="my-4 flex items-center gap-3 text-xs font-bold text-emerald-800">
                <span className="h-px flex-1 bg-emerald-200" />
                หรือยื่นคำของบประมาณ
                <span className="h-px flex-1 bg-emerald-200" />
              </div>
              <textarea
                value={budgetDraft.reason}
                onChange={(e) =>
                  setBudgetDraft({ ...budgetDraft, reason: e.target.value })
                }
                className="mt-3 h-20 w-full rounded-xl border bg-white p-3"
                placeholder="เหตุผล ความจำเป็น และขอบเขตงาน"
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  type="number"
                  min="0"
                  value={budgetDraft.estimated_amount}
                  onChange={(e) =>
                    setBudgetDraft({
                      ...budgetDraft,
                      estimated_amount: e.target.value,
                    })
                  }
                  className="min-w-0 flex-1 rounded-xl border bg-white p-3"
                  placeholder="วงเงินประมาณการ (บาท)"
                />
                <button
                  disabled={
                    saving || selectedTask.budgetRequest?.status === "approved"
                  }
                  className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-40"
                >
                  ยื่นคำของบให้ อบต.
                </button>
              </div>
            </form>
          )}
          {selectedTask.status === "in_progress" && (
            <div className="grid md:grid-cols-2 gap-5 mt-5">
              <form
                onSubmit={addProgress}
                className="p-5 rounded-2xl border bg-blue-50/50 space-y-3"
              >
                <h3 className="font-bold text-lg">อัปเดตความคืบหน้า</h3>
                <textarea
                  value={progressMessage}
                  onChange={(e) => setProgressMessage(e.target.value)}
                  placeholder="เช่น ถึงพื้นที่แล้ว กำลังเตรียมวัสดุ"
                  className="w-full h-24 p-3 border rounded-xl"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setProgressImage(e.target.files?.[0] || null)
                  }
                  className="w-full text-sm"
                />
                <button
                  disabled={saving}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  บันทึกความคืบหน้า
                </button>
              </form>
              <form
                onSubmit={submitWork}
                className="p-5 rounded-2xl border border-green-200 bg-green-50/50 space-y-3"
              >
                <h3 className="font-bold text-lg text-green-800">
                  ส่งงานให้ผู้ดูแลตรวจรับ
                </h3>
                <textarea
                  value={completionMessage}
                  onChange={(e) => setCompletionMessage(e.target.value)}
                  placeholder="สรุปสิ่งที่ดำเนินการ"
                  className="w-full h-24 p-3 border rounded-xl"
                />
                <label className="block text-sm font-bold">
                  รูปหลังดำเนินงาน *
                </label>
                <input
                  required
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setCompletionImage(e.target.files?.[0] || null)
                  }
                  className="w-full text-sm"
                />
                <button
                  disabled={saving}
                  className="w-full py-3 bg-green-600 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  ส่งงานให้ตรวจ
                </button>
              </form>
            </div>
          )}
          <div className="mt-6 border-t pt-5">
            <h3 className="font-bold text-lg mb-3">บันทึกหน้างาน</h3>
            {(selectedTask.updates || []).length === 0 ? (
              <p className="text-gray-500">ยังไม่มีบันทึกความคืบหน้า</p>
            ) : (
              <div className="space-y-3">
                {selectedTask.updates.map((update) => (
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
                        alt="รูปความคืบหน้า"
                        className="mt-3 max-h-56 rounded-xl object-contain bg-gray-100"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-surface max-w-7xl mx-auto space-y-5 sm:space-y-6 animate-fadeIn">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-5 md:p-7 text-white shadow-xl">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-200">
              <Settings className="h-4 w-4" /> ศูนย์ประสานงานหมู่บ้าน
            </div>
            <h2 className="text-3xl font-black tracking-tight">
              เรื่องร้องทุกข์ในหมู่บ้าน
            </h2>
            <p className="mt-2 max-w-2xl text-sm md:text-base text-slate-300">
              รับเรื่อง ตรวจสอบพื้นที่ บันทึกหลักฐาน แก้ไขเรื่องทั่วไป
              หรือส่งต่อ อบต.เพื่อพิจารณางบประมาณ
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 backdrop-blur">
            <div className="text-xs text-slate-300">งานที่ต้องดำเนินการ</div>
            <div className="mt-1 text-3xl font-black">
              {activeCount}
              <span className="ml-2 text-sm font-medium text-slate-300">
                งาน
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          {
            label: "ต้องดำเนินการ",
            value: activeCount,
            icon: <AlertTriangle />,
            tone: "text-blue-700 bg-blue-100",
          },
          {
            label: "เกิน 24 ชั่วโมง",
            value: overdueTaskCount,
            icon: <Clock />,
            tone: overdueTaskCount
              ? "text-red-700 bg-red-100"
              : "text-emerald-700 bg-emerald-100",
          },
          {
            label: "รอตรวจรับ",
            value: reviewCount,
            icon: <Clock />,
            tone: "text-amber-700 bg-amber-100",
          },
          {
            label: "อัตราปิดงาน",
            value: `${staffCompletionRate}%`,
            icon: <CheckCircle />,
            tone: "text-green-700 bg-green-100",
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

      {nextTask && (
        <section
          className={`flex flex-col gap-4 rounded-2xl border p-4 shadow-sm md:flex-row md:items-center md:justify-between ${nextTask.status === "revision_requested" ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"}`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${nextTask.status === "revision_requested" ? "bg-red-600 text-white" : "bg-blue-600 text-white"}`}
            >
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                งานที่ระบบแนะนำให้ทำก่อน
              </div>
              <h3 className="truncate text-lg font-black text-slate-900">
                {nextTask.title}
              </h3>
              <p className="truncate text-sm text-slate-600">
                {nextTask.location} · {getPriorityMeta(nextTask.priority).label}
                {nextTask.status === "revision_requested"
                  ? " · ผู้ดูแลส่งกลับแก้ไข"
                  : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedTask(nextTask)}
            className="shrink-0 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            เปิดใบงานนี้
          </button>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4">
          <h3 className="text-xl font-black text-slate-900">แผนงานวันนี้</h3>
          <p className="text-sm text-slate-500">
            แยกตามขั้นตอนเพื่อเห็นคอขวดและไม่พลาดงานที่ถูกส่งกลับ
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {workLanes.map((lane) => (
            <div
              key={lane.status}
              className={`rounded-2xl border p-3 ${lane.tone}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-black text-slate-900">{lane.label}</h4>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                  {tasks.filter((task) => task.status === lane.status).length}{" "}
                  งาน
                </span>
              </div>
              <div className="space-y-2">
                {lane.items.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="w-full rounded-xl bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-1 font-bold text-slate-900">
                        {task.title}
                      </span>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${getPriorityMeta(task.priority).color}`}
                      >
                        {getPriorityMeta(task.priority).label}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {task.location}
                    </div>
                  </button>
                ))}
                {!lane.items.length && (
                  <div className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500">
                    ไม่มีงานในขั้นตอนนี้
                  </div>
                )}
              </div>
              {tasks.filter((task) => task.status === lane.status).length >
                3 && (
                <button
                  onClick={() => {
                    setTaskFilter("active");
                    setTaskPage(1);
                  }}
                  className="mt-2 w-full py-2 text-xs font-bold text-slate-600"
                >
                  ดูทั้งหมด
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-4 md:p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-900">รายการใบงาน</h3>
              <p className="text-sm text-slate-500">
                เรียงงานเร่งด่วนและงานที่ต้องแก้ไขขึ้นก่อน
              </p>
            </div>
            <label className="relative block w-full lg:w-80">
              <span className="sr-only">ค้นหาใบงาน</span>
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <input
                value={taskSearch}
                onChange={(e) => {
                  setTaskSearch(e.target.value);
                  setTaskPage(1);
                }}
                placeholder="ค้นหาชื่องาน สถานที่ หรือเลขที่"
                className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { id: "active", label: "ต้องทำ", count: activeCount },
              { id: "review", label: "รอตรวจ", count: reviewCount },
              { id: "resolved", label: "เสร็จแล้ว", count: resolvedCount },
              { id: "all", label: "ทั้งหมด", count: tasks.length },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  setTaskFilter(filter.id);
                  setTaskPage(1);
                }}
                className={`shrink-0 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${taskFilter === filter.id ? "bg-teal-700 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {filter.label}{" "}
                <span className="ml-1 opacity-75">{filter.count}</span>
              </button>
            ))}
          </div>
        </div>
        {filteredTasks.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 py-14 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <CheckCircle className="h-7 w-7 text-slate-400" />
            </div>
            <div className="font-bold text-slate-700">ไม่พบใบงาน</div>
            <p className="text-sm text-slate-400">
              ลองเปลี่ยนตัวกรองหรือคำค้นหา
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {pagedTasks.map((task) => {
              const priorityMeta = getPriorityMeta(task.priority);
              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
                >
                  <div className="flex min-h-40">
                    <div className="relative w-28 md:w-36 shrink-0 bg-slate-100">
                      {task.image ? (
                        <img
                          src={task.image}
                          alt="รูปเหตุ"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Camera className="h-8 w-8 text-slate-300" />
                        </div>
                      )}
                      <span className="absolute left-2 top-2 rounded-lg bg-slate-950/75 px-2 py-1 text-[10px] font-bold text-white">
                        #{task.id}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${priorityMeta.color}`}
                        >
                          {priorityMeta.label}
                        </span>
                        <StatusBadge status={task.status} />
                      </div>
                      <h4 className="mt-3 truncate text-lg font-bold text-slate-900">
                        {task.title}
                      </h4>
                      <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                        {task.category}
                      </p>
                      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                        <div className="min-w-0 text-xs text-slate-500">
                          <div className="flex items-center gap-1 truncate">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {task.location}
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatThaiDateTime(
                              task.assignedAt || task.date,
                            )}{" "}
                            น.
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-blue-600">
                          เปิดใบงาน <ChevronRight className="inline h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {taskTotalPages > 1 && (
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-sm text-slate-500">
              หน้า {safeTaskPage} จาก {taskTotalPages} · พบ{" "}
              {filteredTasks.length} งาน
            </span>
            <div className="flex gap-2">
              <button
                disabled={safeTaskPage === 1}
                onClick={() => setTaskPage((page) => Math.max(1, page - 1))}
                className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40"
              >
                ก่อนหน้า
              </button>
              <button
                disabled={safeTaskPage === taskTotalPages}
                onClick={() =>
                  setTaskPage((page) => Math.min(taskTotalPages, page + 1))
                }
                className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function AdminReports({ incidents }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [exporting, setExporting] = useState(null);

  const filtered = incidents.filter((item) => {
    const created = item.date ? new Date(item.date) : null;
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    return (
      (!from || (created && created >= from)) &&
      (!to || (created && created <= to)) &&
      (statusFilter === "all" || item.status === statusFilter) &&
      (categoryFilter === "all" || item.category === categoryFilter)
    );
  });
  const pendingCount = filtered.filter(
    (item) => item.status === "pending",
  ).length;
  const activeCount = filtered.filter((item) =>
    [
      "assigned",
      "in_progress",
      "revision_requested",
      "waiting_review",
    ].includes(item.status),
  ).length;
  const resolvedCount = filtered.filter(
    (item) => item.status === "resolved",
  ).length;
  const avgResolveHours = (() => {
    const values = filtered
      .map((item) => getHoursDiff(item.date, item.resolvedAt))
      .filter((value) => value != null);
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  })();
  const generatedAt = formatThaiDateTime(new Date().toISOString());
  const fileDate = new Date().toISOString().slice(0, 10);
  const projects = filtered.filter((item) => item.budgetRequest);

  const downloadBlob = (content, type, fileName) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character],
    );

  const exportExcel = async () => {
    if (!filtered.length) return alert("ไม่มีข้อมูลตามตัวกรองสำหรับออกรายงาน");
    setExporting("excel");
    try {
      const headers = [
        "เลขที่งาน",
        "วันที่แจ้ง",
        "หัวข้อ",
        "หมวดหมู่",
        "ผู้แจ้ง",
        "บ้านเลขที่",
        "สถานที่",
        "สถานะ",
        "ความสำคัญ",
        "วันที่เสร็จ",
        "ระยะเวลา (ชม.)",
      ];
      const rows = filtered.map((item) => [
        String(item.id),
        formatThaiDateTime(item.date),
        item.title || "",
        item.category || "",
        item.userName || "",
        item.houseNo || "",
        item.location || "",
        getStatusLabel(item.status),
        getPriorityMeta(item.priority).label,
        item.resolvedAt ? formatThaiDateTime(item.resolvedAt) : "-",
        getHoursDiff(item.date, item.resolvedAt) == null
          ? ""
          : getHoursDiff(item.date, item.resolvedAt).toFixed(1),
      ]);
      const csvCell = (value) => {
        const text = String(value ?? "");
        const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
        return `"${safeText.replace(/"/g, '""')}"`;
      };
      const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
      downloadBlob(
        csv,
        "text/csv;charset=utf-8",
        `smart-village-report-${fileDate}.csv`,
      );
    } catch (error) {
      console.error(error);
      alert("สร้างไฟล์ Excel ไม่สำเร็จ");
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (!filtered.length) return alert("ไม่มีข้อมูลตามตัวกรองสำหรับออกรายงาน");
    setExporting("pdf");
    try {
      const reportWindow = window.open("", "_blank");
      if (!reportWindow) throw new Error("Popup was blocked");
      reportWindow.opener = null;
      const rows = filtered
        .map(
          (item) =>
            `<tr><td>#${escapeHtml(item.id)}</td><td>${escapeHtml(formatThaiDateTime(item.date))}</td><td><b>${escapeHtml(item.title)}</b><br><small>${escapeHtml(item.location)}</small></td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(getStatusLabel(item.status))}</td><td>${escapeHtml(getPriorityMeta(item.priority).label)}</td><td>${escapeHtml(item.resolvedAt ? formatThaiDateTime(item.resolvedAt) : "-")}</td></tr>`,
        )
        .join("");
      reportWindow.document.write(
        `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานการแจ้งเหตุ ${escapeHtml(fileDate)}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Tahoma,"Noto Sans Thai",sans-serif;color:#0f172a;margin:0}header{display:flex;justify-content:space-between;border-bottom:3px solid #1e3a8a;padding-bottom:12px;margin-bottom:14px}h1{font-size:24px;margin:0;color:#172554}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.card{border:1px solid #cbd5e1;border-radius:8px;padding:10px}.card b{font-size:22px;display:block}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#172554;color:white}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top}tr:nth-child(even){background:#f8fafc}.actions{margin:12px 0;padding:12px;background:#eff6ff;border-radius:8px}.actions button{background:#1d4ed8;color:white;border:0;border-radius:8px;padding:10px 16px;font-weight:bold}@media print{.actions{display:none}}</style></head><body><div class="actions"><b>วิธีบันทึก:</b> กดปุ่มด้านล่าง แล้วเลือกเครื่องพิมพ์ “Save as PDF” หรือ “Microsoft Print to PDF”<br><button onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button></div><header><div><h1>รายงานสรุปการแจ้งเหตุ</h1><b>${escapeHtml(VILLAGE_NAME)}</b></div><div>จัดทำเมื่อ ${escapeHtml(generatedAt)} น.<br>ทั้งหมด ${filtered.length} รายการ</div></header><div class="summary"><div class="card"><b>${filtered.length}</b>ทั้งหมด</div><div class="card"><b>${pendingCount}</b>รอตรวจสอบ</div><div class="card"><b>${activeCount}</b>กำลังดำเนินการ</div><div class="card"><b>${resolvedCount}</b>เสร็จสิ้น</div></div><p><b>ระยะเวลาแก้ไขเฉลี่ย:</b> ${escapeHtml(avgResolveHours == null ? "ยังไม่มีข้อมูล" : formatHours(avgResolveHours))}</p><table><thead><tr><th>เลขที่</th><th>วันที่แจ้ง</th><th>เรื่อง / สถานที่</th><th>หมวดหมู่</th><th>สถานะ</th><th>ความสำคัญ</th><th>วันที่เสร็จ</th></tr></thead><tbody>${rows}</tbody></table></body></html>`,
      );
      reportWindow.document.close();
    } catch (error) {
      console.error(error);
      alert("สร้างไฟล์ PDF ไม่สำเร็จ");
    } finally {
      setExporting(null);
    }
  };
  const exportProjects = () => {
    if (!projects.length) return alert("ยังไม่มีข้อมูลโครงการตามตัวกรอง");
    const headers = [
      "เลขที่เรื่อง",
      "ชื่อโครงการ",
      "หมู่บ้าน",
      "สถานะโครงการ",
      "งบเสนอ",
      "งบอนุมัติ",
      "ใช้จริง",
      "ความคืบหน้า",
      "กำหนดเสร็จ",
    ];
    const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = projects.map((item) => [
      item.referenceNo || item.id,
      item.budgetRequest.project_title || item.title,
      `หมู่ ${item.villageMoo || "-"} ${item.villageName || ""}`,
      projectStatusLabels[item.budgetRequest.project_status] ||
        item.budgetRequest.status,
      item.budgetRequest.estimated_amount || 0,
      item.budgetRequest.approved_amount || 0,
      item.budgetRequest.actual_amount || 0,
      `${item.budgetRequest.progress_percent || 0}%`,
      item.budgetRequest.expected_end_date || "-",
    ]);
    downloadBlob(
      `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`,
      "text/csv;charset=utf-8",
      `smart-village-projects-${fileDate}.csv`,
    );
  };
  const exportProjectsPdf = () => {
    if (!projects.length) return alert("ยังไม่มีข้อมูลโครงการตามตัวกรอง");
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return alert("กรุณาอนุญาต Popup เพื่อสร้างรายงาน PDF");
    reportWindow.opener = null;
    const rows = projects.map((item) => {
      const project = item.budgetRequest;
      return `<tr><td>${escapeHtml(item.referenceNo || item.id)}</td><td><b>${escapeHtml(project.project_title || item.title)}</b><br><small>หมู่ ${escapeHtml(item.villageMoo || "-")} ${escapeHtml(item.villageName || "")}</small></td><td>${escapeHtml(projectStatusLabels[project.project_status] || project.status)}</td><td>${escapeHtml(Number(project.approved_amount || 0).toLocaleString("th-TH"))}</td><td>${escapeHtml(Number(project.actual_amount || 0).toLocaleString("th-TH"))}</td><td>${escapeHtml(`${project.progress_percent || 0}%`)}</td><td>${escapeHtml(project.expected_end_date || "-")}</td></tr>`;
    }).join("");
    reportWindow.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานโครงการ ${escapeHtml(fileDate)}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Tahoma,sans-serif;color:#0f172a}h1{color:#172554;margin-bottom:4px}.actions{padding:12px;background:#eff6ff;border-radius:8px;margin-bottom:15px}.actions button{background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:bold}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#172554;color:#fff}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left;vertical-align:top}@media print{.actions{display:none}}</style></head><body><div class="actions"><button onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button></div><h1>รายงานโครงการและงบประมาณ</h1><p>${escapeHtml(VILLAGE_NAME)} · จัดทำเมื่อ ${escapeHtml(generatedAt)} น. · ${projects.length} โครงการ</p><table><thead><tr><th>เลขอ้างอิง</th><th>โครงการ / หมู่บ้าน</th><th>สถานะ</th><th>อนุมัติ</th><th>ใช้จริง</th><th>คืบหน้า</th><th>กำหนดเสร็จ</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    reportWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5 sm:p-6 md:p-8 text-white shadow-xl">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-200">
              <FileText className="h-4 w-4" /> ศูนย์รายงานข้อมูล
            </div>
            <h2 className="text-2xl sm:text-3xl font-black">
              รายงานข้อมูล
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-300">
              กรองข้อมูลและดาวน์โหลดรายงานการแจ้งเหตุหรือโครงการ
            </p>
          </div>
          <div className="grid w-full gap-2 min-[420px]:grid-cols-2 md:w-[520px]">
            <button
              disabled={!!exporting}
              onClick={exportPdf}
              className="order-1 w-full whitespace-nowrap rounded-xl bg-red-600 px-4 py-3 text-sm sm:text-base font-bold hover:bg-red-500 disabled:opacity-50"
            >
              <Download className="mr-2 inline h-5 w-5" />
              {exporting === "pdf" ? "กำลังสร้าง..." : "PDF การแจ้งเหตุ"}
            </button>
            <button
              disabled={!!exporting}
              onClick={exportProjects}
              className="order-4 w-full whitespace-nowrap rounded-xl bg-green-700 px-4 py-3 text-sm sm:text-base font-bold hover:bg-green-600 disabled:opacity-50"
            >
              <Download className="mr-2 inline h-5 w-5" />
              Excel โครงการ
            </button>
            <button
              disabled={!!exporting}
              onClick={exportProjectsPdf}
              className="order-3 w-full whitespace-nowrap rounded-xl bg-violet-700 px-4 py-3 text-sm sm:text-base font-bold hover:bg-violet-600 disabled:opacity-50"
            >
              <Download className="mr-2 inline h-5 w-5" />
              PDF โครงการ
            </button>
            <button
              disabled={!!exporting}
              onClick={exportExcel}
              className="order-2 w-full whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-3 text-sm sm:text-base font-bold hover:bg-emerald-500 disabled:opacity-50"
            >
              <Download className="mr-2 inline h-5 w-5" />
              {exporting === "excel" ? "กำลังสร้าง..." : "Excel การแจ้งเหตุ"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 md:p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 font-bold text-slate-800">
          <Filter className="h-5 w-5 text-blue-600" /> ตัวกรองรายงาน
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-xs font-bold text-slate-500">
            ตั้งแต่วันที่
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2.5 text-sm text-slate-700"
            />
          </label>
          <label className="text-xs font-bold text-slate-500">
            ถึงวันที่
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2.5 text-sm text-slate-700"
            />
          </label>
          <label className="text-xs font-bold text-slate-500">
            สถานะ
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2.5 text-sm text-slate-700"
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
              ].map((value) => (
                <option key={value} value={value}>
                  {getStatusLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-500">
            หมวดหมู่
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2.5 text-sm text-slate-700"
            >
              <option value="all">ทุกหมวดหมู่</option>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex justify-between text-sm">
          <span className="text-slate-500">
            พบข้อมูล <b className="text-slate-900">{filtered.length}</b> รายการ
          </span>
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setStatusFilter("all");
              setCategoryFilter("all");
            }}
            className="font-bold text-blue-600 hover:underline"
          >
            ล้างตัวกรอง
          </button>
        </div>
      </section>

      <div className="bg-white p-5 md:p-7 text-slate-900">
        <div className="mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b-2 border-blue-900 pb-4">
          <div>
            <div className="text-xl sm:text-2xl font-black text-blue-950">
              รายงานสรุปการแจ้งเหตุ
            </div>
            <div className="font-bold text-slate-600">{VILLAGE_NAME}</div>
          </div>
          <div className="sm:text-right text-xs text-slate-500">
            <div>จัดทำเมื่อ {generatedAt} น.</div>
            <div>ข้อมูลตามตัวกรอง {filtered.length} รายการ</div>
          </div>
        </div>
        <div className="mb-5 grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "ทั้งหมด",
              value: filtered.length,
              color: "text-slate-900",
            },
            {
              label: "รอตรวจสอบ",
              value: pendingCount,
              color: "text-amber-700",
            },
            {
              label: "กำลังดำเนินการ",
              value: activeCount,
              color: "text-blue-700",
            },
            {
              label: "เสร็จสิ้น",
              value: resolvedCount,
              color: "text-green-700",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border bg-slate-50 p-3">
              <div className={`text-2xl font-black ${item.color}`}>
                {item.value}
              </div>
              <div className="text-xs text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>
        <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm">
          <b>ระยะเวลาแก้ไขเฉลี่ย:</b>{" "}
          {avgResolveHours == null
            ? "ยังไม่มีข้อมูล"
            : formatHours(avgResolveHours)}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-blue-950 text-white">
                <th className="border p-2">เลขที่</th>
                <th className="border p-2">วันที่แจ้ง</th>
                <th className="border p-2 text-left">เรื่อง / สถานที่</th>
                <th className="border p-2">หมวดหมู่</th>
                <th className="border p-2">สถานะ</th>
                <th className="border p-2">ความสำคัญ</th>
                <th className="border p-2">วันที่เสร็จ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => (
                <tr
                  key={item.id}
                  className={index % 2 ? "bg-slate-50" : "bg-white"}
                >
                  <td className="border p-2 text-center">#{item.id}</td>
                  <td className="border p-2 text-center">
                    {formatThaiDateTime(item.date)}
                  </td>
                  <td className="border p-2">
                    <b>{item.title}</b>
                    <div className="text-slate-500">{item.location}</div>
                  </td>
                  <td className="border p-2">{item.category}</td>
                  <td className="border p-2 text-center">
                    {getStatusLabel(item.status)}
                  </td>
                  <td className="border p-2 text-center">
                    {getPriorityMeta(item.priority).label}
                  </td>
                  <td className="border p-2 text-center">
                    {item.resolvedAt
                      ? formatThaiDateTime(item.resolvedAt)
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="border p-10 text-center text-slate-400">
              ไม่มีข้อมูลตามตัวกรอง
            </div>
          )}
        </div>
        {projects.length > 0 && (
          <div className="mt-7 border-t pt-5">
            <h3 className="mb-3 text-lg font-black text-indigo-950">
              สรุปโครงการและงบประมาณ
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-xs">
                <thead>
                  <tr className="bg-indigo-950 text-white">
                    <th className="border p-2 text-left">โครงการ</th>
                    <th className="border p-2">สถานะ</th>
                    <th className="border p-2">งบเสนอ</th>
                    <th className="border p-2">งบอนุมัติ</th>
                    <th className="border p-2">ใช้จริง</th>
                    <th className="border p-2">ความคืบหน้า</th>
                    <th className="border p-2">กำหนดเสร็จ</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((item) => (
                    <tr key={item.id}>
                      <td className="border p-2">
                        <b>{item.budgetRequest.project_title || item.title}</b>
                        <div className="text-slate-500">
                          {item.referenceNo || `#${item.id}`}
                        </div>
                      </td>
                      <td className="border p-2 text-center">
                        {projectStatusLabels[
                          item.budgetRequest.project_status
                        ] || item.budgetRequest.status}
                      </td>
                      <td className="border p-2 text-right">
                        {Number(
                          item.budgetRequest.estimated_amount || 0,
                        ).toLocaleString("th-TH")}
                      </td>
                      <td className="border p-2 text-right">
                        {Number(
                          item.budgetRequest.approved_amount || 0,
                        ).toLocaleString("th-TH")}
                      </td>
                      <td className="border p-2 text-right">
                        {Number(
                          item.budgetRequest.actual_amount || 0,
                        ).toLocaleString("th-TH")}
                      </td>
                      <td className="border p-2 text-center">
                        {item.budgetRequest.progress_percent || 0}%
                      </td>
                      <td className="border p-2 text-center">
                        {item.budgetRequest.expected_end_date
                          ? new Date(
                              item.budgetRequest.expected_end_date,
                            ).toLocaleDateString("th-TH")
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="mt-5 border-t pt-3 text-center text-[10px] text-slate-400">
          ระบบจัดการ{VILLAGE_NAME} - รายงานสร้างจากข้อมูลในระบบ
        </div>
      </div>
    </div>
  );
}

// 5. ADMIN DASHBOARD
// ==========================================
function SimpleAnalyticsDashboard({
  incidents,
  scope = "village",
  scopeLabel = "หมู่บ้าน",
  villages = [],
}) {
  const isTao = scope === "tao";
  const [villageFilter, setVillageFilter] = useState("all");
  const analyzedIncidents =
    isTao && villageFilter !== "all"
      ? incidents.filter(
          (item) => String(item.villageId || "") === String(villageFilter),
        )
      : incidents;
  const selectedVillage = villages.find(
    (village) => String(village.id) === String(villageFilter),
  );
  const total = analyzedIncidents.length;
  const open = analyzedIncidents.filter(
    (item) => !["resolved", "cancelled"].includes(item.status),
  ).length;
  const resolved = analyzedIncidents.filter(
    (item) => item.status === "resolved",
  ).length;
  const overdue = analyzedIncidents.filter(
    (item) =>
      !["resolved", "cancelled"].includes(item.status) &&
      getHoursDiff(item.date, new Date().toISOString()) > 24,
  ).length;
  const categoryRows = Object.values(
    analyzedIncidents.reduce((rows, item) => {
      const key = item.category || "ไม่ระบุหมวดหมู่";
      rows[key] = rows[key] || { label: key, count: 0 };
      rows[key].count += 1;
      return rows;
    }, {}),
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const locationRows = Object.values(
    analyzedIncidents.reduce((rows, item) => {
      const key = item.location || "ไม่ระบุสถานที่";
      rows[key] = rows[key] || { label: key, count: 0, open: 0 };
      rows[key].count += 1;
      if (!["resolved", "cancelled"].includes(item.status)) rows[key].open += 1;
      return rows;
    }, {}),
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const statusRows = [
    [
      "รอตรวจสอบ",
      analyzedIncidents.filter((item) => item.status === "pending").length,
      "bg-blue-500",
    ],
    [
      "กำลังดำเนินการ",
      analyzedIncidents.filter((item) =>
        ["assigned", "in_progress", "revision_requested"].includes(item.status),
      ).length,
      "bg-amber-500",
    ],
    [
      "รอตรวจรับ",
      analyzedIncidents.filter((item) => item.status === "waiting_review")
        .length,
      "bg-violet-500",
    ],
    ["เสร็จแล้ว", resolved, "bg-emerald-500"],
  ];
  const monthRows = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - offset));
    const year = date.getFullYear();
    const month = date.getMonth();
    return {
      key: `${year}-${month}`,
      label: date.toLocaleDateString("th-TH", { month: "short" }),
      count: analyzedIncidents.filter((item) => {
        const created = new Date(item.date);
        return created.getFullYear() === year && created.getMonth() === month;
      }).length,
    };
  });
  const villageRows = (villages || [])
    .map((village) => {
      const rows = incidents.filter(
        (item) => String(item.villageId || "") === String(village.id),
      );
      return {
        ...village,
        total: rows.length,
        open: rows.filter(
          (item) => !["resolved", "cancelled"].includes(item.status),
        ).length,
        resolved: rows.filter((item) => item.status === "resolved").length,
      };
    })
    .sort((a, b) => b.open - a.open || b.total - a.total);
  const maxCategory = Math.max(1, ...categoryRows.map((row) => row.count));
  const maxMonth = Math.max(1, ...monthRows.map((row) => row.count));
  const topCategory = categoryRows[0];
  const topLocation = locationRows[0];
  const budgetRequests = analyzedIncidents.filter((item) => item.budgetRequest);
  const submittedBudgetCount = budgetRequests.filter(
    (item) => item.budgetRequest?.status === "submitted",
  ).length;
  const proposedBudget = budgetRequests.reduce(
    (sum, item) => sum + Number(item.budgetRequest?.estimated_amount || 0),
    0,
  );
  const approvedBudget = budgetRequests.reduce(
    (sum, item) => sum + Number(item.budgetRequest?.approved_amount || 0),
    0,
  );
  const actualBudget = budgetRequests.reduce(
    (sum, item) => sum + Number(item.budgetRequest?.actual_amount || 0),
    0,
  );
  const activeProjects = budgetRequests.filter((item) =>
    ["planned", "in_progress", "waiting_review"].includes(
      item.budgetRequest?.project_status,
    ),
  ).length;
  const completedProjects = budgetRequests.filter(
    (item) => item.budgetRequest?.project_status === "completed",
  ).length;
  const beforeAfterProjects = budgetRequests
    .filter((item) => item.budgetRequest?.project_status === "completed" && item.budgetRequest?.start_date)
    .map((project) => {
      const start = new Date(project.budgetRequest.start_date);
      const completed = new Date(project.budgetRequest.updated_at || project.resolvedAt || project.budgetRequest.expected_end_date);
      const day = 86400000;
      const related = analyzedIncidents.filter((item) => item.id !== project.id && String(item.villageId || "") === String(project.villageId || "") && item.category === project.category);
      return {
        project,
        before: related.filter((item) => { const date = new Date(item.date); return date >= new Date(start.getTime() - 90 * day) && date < start; }).length,
        after: Number.isNaN(completed.getTime()) ? null : related.filter((item) => { const date = new Date(item.date); return date > completed && date <= new Date(completed.getTime() + 90 * day); }).length,
      };
    });
  const delayedProjects = budgetRequests.filter((item) => {
    const due = item.budgetRequest?.expected_end_date;
    return (
      due &&
      item.budgetRequest?.project_status !== "completed" &&
      new Date(due) < new Date()
    );
  }).length;
  const averageOf = (values) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  const avgFirstResponseHours = averageOf(
    analyzedIncidents
      .map((item) => getHoursDiff(item.date, item.firstResponseAt))
      .filter((value) => value != null && value >= 0),
  );
  const avgResolutionHours = averageOf(
    analyzedIncidents
      .map((item) => getHoursDiff(item.date, item.resolvedAt))
      .filter((value) => value != null && value >= 0),
  );
  const feedbackRows = analyzedIncidents.filter(
    (item) => item.feedback?.rating,
  );
  const avgRating = averageOf(
    feedbackRows.map((item) => Number(item.feedback.rating)),
  );
  const formatMoney = (value) =>
    `${Number(value || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท`;

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-fadeIn">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-bold text-blue-200">
              ข้อมูลจริงจากเรื่องร้องทุกข์และคำของบประมาณ
            </div>
            <h2 className="mt-1 text-3xl font-black">
              {isTao ? "วิเคราะห์ข้อมูล" : "วิเคราะห์ปัญหาหมู่บ้าน"}
            </h2>
            <p className="mt-2 text-slate-300">
              {isTao && selectedVillage
                ? `หมู่ ${selectedVillage.moo} ${selectedVillage.name}`
                : scopeLabel}{" "}
              · ใช้ดูปัญหาซ้ำ พื้นที่เสี่ยง งานค้าง และงบประมาณ
            </p>
          </div>
          {isTao && (
            <label className="text-sm font-bold text-blue-100">
              <select
                value={villageFilter}
                onChange={(event) => setVillageFilter(event.target.value)}
                className="mt-1.5 w-full min-w-64 rounded-xl border border-white/20 bg-white px-4 py-3 text-slate-900 outline-none md:w-auto"
              >
                <option value="all">รวมทุกหมู่บ้าน</option>
                {villages.map((village) => (
                  <option key={village.id} value={village.id}>
                    หมู่ {village.moo} {village.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["เรื่องทั้งหมด", total, "text-slate-900"],
          ["ยังไม่เสร็จ", open, "text-amber-700"],
          ["เกิน 24 ชั่วโมง", overdue, "text-red-700"],
          ["แก้ไขเสร็จแล้ว", resolved, "text-emerald-700"],
        ].map(([label, value, tone]) => (
          <div
            key={label}
            className="rounded-2xl border bg-white p-4 shadow-sm"
          >
            <div className={`text-3xl font-black ${tone}`}>{value}</div>
            <div className="mt-1 text-sm text-slate-500">{label}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-bold text-slate-500">
            เวลาเฉลี่ยก่อนเริ่มแก้ไข
          </div>
          <div className="mt-1 text-2xl font-black text-blue-700">
            {avgFirstResponseHours == null
              ? "ยังไม่มีข้อมูล"
              : formatHours(avgFirstResponseHours)}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-bold text-slate-500">
            เวลาเฉลี่ยจนเสร็จ
          </div>
          <div className="mt-1 text-2xl font-black text-emerald-700">
            {avgResolutionHours == null
              ? "ยังไม่มีข้อมูล"
              : formatHours(avgResolutionHours)}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-bold text-slate-500">
            ความพึงพอใจประชาชน
          </div>
          <div className="mt-1 text-2xl font-black text-amber-600">
            {avgRating == null
              ? "ยังไม่มีคะแนน"
              : `${avgRating.toFixed(1)} / 5`}
          </div>
          <div className="text-xs text-slate-400">
            จาก {feedbackRows.length} การประเมิน
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4">
          <h3 className="text-xl font-black">วิเคราะห์งบประมาณ</h3>
          <p className="text-sm text-slate-500">
            ตัวเลขมาจากคำขอของหมู่บ้านและผลพิจารณาของ อบต.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            [
              "คำของบทั้งหมด",
              `${budgetRequests.length} เรื่อง`,
              "text-slate-900",
            ],
            ["รอพิจารณา", `${submittedBudgetCount} เรื่อง`, "text-amber-700"],
            ["ยอดที่เสนอ", formatMoney(proposedBudget), "text-blue-700"],
            ["ยอดอนุมัติ", formatMoney(approvedBudget), "text-emerald-700"],
            ["ยอดใช้จริง", formatMoney(actualBudget), "text-violet-700"],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-4">
              <div className={`text-xl font-black ${tone}`}>{value}</div>
              <div className="mt-1 text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
        {approvedBudget > 0 && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            ใช้งบแล้ว <b>{formatMoney(actualBudget)}</b> จากยอดอนุมัติ{" "}
            <b>{formatMoney(approvedBudget)}</b> · คงเหลือ{" "}
            <b>{formatMoney(Math.max(0, approvedBudget - actualBudget))}</b>
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-3">
            <b className="text-blue-700">{activeProjects}</b>
            <span className="ml-2 text-sm text-slate-600">
              โครงการกำลังดำเนินการ
            </span>
          </div>
          <div className="rounded-xl border p-3">
            <b className="text-emerald-700">{completedProjects}</b>
            <span className="ml-2 text-sm text-slate-600">โครงการปิดแล้ว</span>
          </div>
          <div className="rounded-xl border p-3">
            <b className="text-red-700">{delayedProjects}</b>
            <span className="ml-2 text-sm text-slate-600">
              โครงการเกินกำหนด
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
        <h3 className="text-xl font-black">ผลก่อน–หลังทำโครงการ</h3>
        <p className="mb-4 text-sm text-slate-500">
          เปรียบเทียบปัญหาหมวดเดียวกันในหมู่บ้าน ช่วง 90 วันก่อนเริ่มและ 90 วันหลังปิดโครงการ
        </p>
        <div className="space-y-3">
          {beforeAfterProjects.map(({ project, before, after }) => (
            <div key={project.id} className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div>
                <div className="font-black">{project.budgetRequest.project_title || project.title}</div>
                <div className="text-xs text-slate-500">หมู่ {project.villageMoo || "-"} · {project.category}</div>
              </div>
              <div className="rounded-xl bg-amber-50 px-4 py-2 text-center"><b className="block text-xl text-amber-700">{before}</b><span className="text-xs">ก่อนทำ</span></div>
              <div className="rounded-xl bg-emerald-50 px-4 py-2 text-center"><b className="block text-xl text-emerald-700">{after ?? "-"}</b><span className="text-xs">หลังทำ</span></div>
            </div>
          ))}
          {!beforeAfterProjects.length && (
            <div className="rounded-2xl bg-slate-50 py-8 text-center text-slate-500">จะแสดงเมื่อมีโครงการที่ปิดแล้วและมีวันเริ่มโครงการ</div>
          )}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
          <h3 className="text-xl font-black">ปัญหาที่พบบ่อย</h3>
          <p className="mb-5 text-sm text-slate-500">
            ช่วยกำหนดลำดับการแก้ไขและแผนป้องกัน
          </p>
          <div className="space-y-4">
            {categoryRows.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span className="font-bold">{row.label}</span>
                  <span>{row.count} เรื่อง</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${(row.count / maxCategory) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {!categoryRows.length && (
              <div className="py-10 text-center text-slate-500">
                ยังไม่มีข้อมูลสำหรับวิเคราะห์
              </div>
            )}
          </div>
        </div>
        <div className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
          <h3 className="text-xl font-black">สถานะการดำเนินงาน</h3>
          <p className="mb-5 text-sm text-slate-500">
            เห็นจำนวนงานในแต่ละขั้นตอนอย่างตรงไปตรงมา
          </p>
          <div className="space-y-3">
            {statusRows.map(([label, count, color]) => (
              <div
                key={label}
                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-slate-50 p-4"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${color}`} />
                  <span className="font-bold">{label}</span>
                </div>
                <span className="text-xl font-black">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
          <h3 className="text-xl font-black">แนวโน้มเรื่องแจ้ง 6 เดือน</h3>
          <p className="mb-5 text-sm text-slate-500">
            ใช้ดูว่าปัญหามีแนวโน้มเพิ่มขึ้นหรือลดลง
          </p>
          <div className="flex h-52 items-end gap-3">
            {monthRows.map((row) => (
              <div
                key={row.key}
                className="flex h-full flex-1 flex-col justify-end text-center"
              >
                <div className="mb-1 text-sm font-black">{row.count}</div>
                <div
                  className="mx-auto w-full max-w-14 rounded-t-xl bg-indigo-500"
                  style={{
                    height: `${Math.max(6, (row.count / maxMonth) * 150)}px`,
                  }}
                />
                <div className="mt-2 text-xs text-slate-500">{row.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
          <h3 className="text-xl font-black">พื้นที่ที่พบปัญหาบ่อย</h3>
          <p className="mb-4 text-sm text-slate-500">เรียงจากจำนวนเรื่องสะสม</p>
          <div className="divide-y">
            {locationRows.map((row, index) => (
              <div key={row.label} className="flex items-center gap-3 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 font-black text-red-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{row.label}</div>
                  <div className="text-xs text-slate-500">
                    ยังไม่เสร็จ {row.open} เรื่อง
                  </div>
                </div>
                <span className="font-black">{row.count}</span>
              </div>
            ))}
            {!locationRows.length && (
              <div className="py-10 text-center text-slate-500">
                ยังไม่มีข้อมูลสถานที่
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 md:p-6">
        <h3 className="text-xl font-black text-blue-950">
          สรุปสำหรับนำไปตัดสินใจ
        </h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4">
            <div className="text-xs font-bold text-blue-600">ปัญหาหลัก</div>
            <div className="mt-1 font-black">
              {topCategory
                ? `${topCategory.label} (${topCategory.count} เรื่อง)`
                : "ยังไม่มีข้อมูล"}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <div className="text-xs font-bold text-red-600">
              พื้นที่ควรติดตาม
            </div>
            <div className="mt-1 font-black">
              {topLocation
                ? `${topLocation.label} (${topLocation.count} เรื่อง)`
                : "ยังไม่มีข้อมูล"}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <div className="text-xs font-bold text-amber-600">
              งานที่ต้องเร่ง
            </div>
            <div className="mt-1 font-black">
              {overdue
                ? `${overdue} เรื่องเกิน 24 ชั่วโมง`
                : "ไม่มีงานเกินกำหนด"}
            </div>
          </div>
        </div>
      </section>

      {isTao && (
        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="p-5 md:p-6">
            <h3 className="text-xl font-black">เปรียบเทียบ 12 หมู่บ้าน</h3>
            <p className="text-sm text-slate-500">
              หมู่บ้านที่มีงานค้างมากจะแสดงก่อน
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="bg-slate-50 text-left text-sm text-slate-500">
                  <th className="p-4">หมู่บ้าน</th>
                  <th className="p-4 text-center">ทั้งหมด</th>
                  <th className="p-4 text-center">ยังไม่เสร็จ</th>
                  <th className="p-4 text-center">เสร็จแล้ว</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {villageRows.map((row) => (
                  <tr key={row.id}>
                    <td className="p-4 font-bold">
                      หมู่ {row.moo} {row.name}
                    </td>
                    <td className="p-4 text-center">{row.total}</td>
                    <td className="p-4 text-center font-bold text-amber-700">
                      {row.open}
                    </td>
                    <td className="p-4 text-center font-bold text-emerald-700">
                      {row.resolved}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function AdminAnalytics({
  incidents,
  users,
  budgetSettings,
  onBudgetSettingsChange,
  onOpenIncident,
  onOpenIncidents,
  canEditBudget = false,
  scope = "village",
  scopeLabel = "หมู่บ้าน",
}) {
  const isTaoScope = scope === "tao";
  const defaultUnitCost = (category) =>
    category.includes("ถนน") || category.includes("ท่อ")
      ? 15000
      : category.includes("ไฟ")
        ? 4500
        : category.includes("น้ำ")
          ? 8000
          : category.includes("ขยะ") || category.includes("ความสะอาด")
            ? 1800
            : category.includes("ปลอดภัย")
              ? 3500
              : 3000;
  const [unitCosts, setUnitCosts] = useState(budgetSettings?.unit_costs || {});
  const [reservePercent, setReservePercent] = useState(
    Number(budgetSettings?.reserve_percent ?? 10),
  );
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState("");
  useEffect(() => {
    setUnitCosts(budgetSettings?.unit_costs || {});
    setReservePercent(Number(budgetSettings?.reserve_percent ?? 10));
  }, [budgetSettings]);
  const saveBudgetSettings = async () => {
    setBudgetSaving(true);
    setBudgetMessage("");
    try {
      const completeCosts = Object.fromEntries(
        CATEGORIES.map((category) => [
          category,
          Number(unitCosts[category] ?? defaultUnitCost(category)),
        ]),
      );
      const saved = await api.saveBudgetSettings(completeCosts, reservePercent);
      onBudgetSettingsChange(saved);
      setBudgetMessage("บันทึกค่ากลางแล้ว ทุกเครื่องจะใช้ตัวเลขชุดนี้");
    } catch (error) {
      setBudgetMessage(error?.message || "บันทึกค่ากลางไม่สำเร็จ");
    } finally {
      setBudgetSaving(false);
    }
  };
  const closedStatuses = ["resolved", "cancelled"];
  const openItems = incidents.filter(
    (item) => !closedStatuses.includes(item.status),
  );
  const pending = incidents.filter((item) => item.status === "pending").length;
  const resolved = incidents.filter(
    (item) => item.status === "resolved",
  ).length;
  const now = new Date();
  const hoursSince = (value) =>
    value ? Math.max(0, (now - new Date(value)) / 3600000) : null;
  const median = (values) => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const responseTimes = incidents
    .map((item) => getHoursDiff(item.date, item.firstResponseAt))
    .filter(Number.isFinite);
  const resolveTimes = incidents
    .filter((item) => item.status === "resolved")
    .map((item) => getHoursDiff(item.date, item.resolvedAt))
    .filter(Number.isFinite);
  const responsePopulation = incidents.filter(
    (item) => item.firstResponseAt || hoursSince(item.date) > 1,
  );
  const resolvePopulation = incidents.filter(
    (item) =>
      item.status === "resolved" ||
      (!closedStatuses.includes(item.status) && hoursSince(item.date) > 24),
  );
  const responsePass = responsePopulation.filter(
    (item) =>
      item.firstResponseAt &&
      getHoursDiff(item.date, item.firstResponseAt) <= 1,
  ).length;
  const resolvePass = resolvePopulation.filter(
    (item) =>
      item.status === "resolved" &&
      getHoursDiff(item.date, item.resolvedAt) <= 24,
  ).length;
  const responseSla = responsePopulation.length
    ? Math.round((responsePass / responsePopulation.length) * 100)
    : null;
  const resolveSla = resolvePopulation.length
    ? Math.round((resolvePass / resolvePopulation.length) * 100)
    : null;
  const overdue = openItems.filter((item) => hoursSince(item.date) > 24).length;
  const allCategories = Object.values(
    incidents.reduce((result, item) => {
      const key = item.category || "ไม่ระบุ";
      result[key] ??= { name: key, count: 0, open: 0, resolved: 0 };
      result[key].count += 1;
      if (!closedStatuses.includes(item.status)) result[key].open += 1;
      if (item.status === "resolved") result[key].resolved += 1;
      return result;
    }, {}),
  ).sort((a, b) => b.count - a.count);
  const categories = allCategories.slice(0, 5);
  const locations = Object.values(
    incidents.reduce((result, item) => {
      const key = item.location || "ไม่ระบุ";
      result[key] ??= { name: key, count: 0, open: 0 };
      result[key].count += 1;
      if (!closedStatuses.includes(item.status)) result[key].open += 1;
      return result;
    }, {}),
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const priorityItems = openItems
    .map((item) => ({ ...item, age: hoursSince(item.date) || 0 }))
    .sort(
      (a, b) =>
        Number(b.priority || 1) - Number(a.priority || 1) || b.age - a.age,
    )
    .slice(0, 5);
  const completionRate = incidents.length
    ? Math.round((resolved / incidents.length) * 100)
    : 0;
  const currency = (value) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }).format(value || 0);
  const plannedWorkCost = allCategories.reduce(
    (sum, item) =>
      sum +
      item.open * Number(unitCosts[item.name] ?? defaultUnitCost(item.name)),
    0,
  );
  const reserveAmount = Math.round(
    (plannedWorkCost * Math.max(0, Math.min(50, reservePercent))) / 100,
  );
  const requestedBudget = plannedWorkCost + reserveAmount;
  const submittedBudgets = incidents.filter((item) =>
    ["submitted", "approved", "completed"].includes(item.budgetRequest?.status),
  );
  const submittedBudgetTotal = submittedBudgets.reduce(
    (sum, item) => sum + Number(item.budgetRequest?.estimated_amount || 0),
    0,
  );
  const approvedBudgetTotal = incidents.reduce(
    (sum, item) => sum + Number(item.budgetRequest?.approved_amount || 0),
    0,
  );
  const actualBudgetTotal = incidents.reduce(
    (sum, item) => sum + Number(item.budgetRequest?.actual_amount || 0),
    0,
  );
  const waitingBudgetCount = incidents.filter(
    (item) => item.budgetRequest?.status === "submitted",
  ).length;
  const villagePerformance = Object.values(
    incidents.reduce((result, item) => {
      const key = String(item.villageId || "unknown");
      result[key] ??= {
        key,
        moo: item.villageMoo,
        name: item.villageName || "ยังไม่ระบุหมู่บ้าน",
        total: 0,
        open: 0,
        resolved: 0,
        budget: 0,
      };
      result[key].total += 1;
      if (closedStatuses.includes(item.status))
        result[key].resolved += item.status === "resolved" ? 1 : 0;
      else result[key].open += 1;
      result[key].budget += Number(item.budgetRequest?.approved_amount || 0);
      return result;
    }, {}),
  ).sort((a, b) => b.open - a.open || b.total - a.total);
  const staffPerformance = (users || [])
    .filter((user) => isVillageAdminRole(user.role))
    .map((person) => {
      const assignedItems = incidents.filter(
        (item) =>
          String(item.villageId || "") === String(person.villageId || ""),
      );
      const open = assignedItems.filter(
        (item) => !closedStatuses.includes(item.status),
      ).length;
      const done = assignedItems.filter(
        (item) => item.status === "resolved",
      ).length;
      return { ...person, open, done, total: assignedItems.length };
    })
    .sort((a, b) => b.open - a.open || b.done - a.done)
    .slice(0, 12);
  const monthKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const newestDate =
    incidents
      .map((item) => new Date(item.date))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b - a)[0] || now;
  const monthlyTrend = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(
      newestDate.getFullYear(),
      newestDate.getMonth() - 5 + offset,
      1,
    );
    const key = monthKey(date);
    const rows = incidents.filter((item) => {
      const itemDate = new Date(item.date);
      return !Number.isNaN(itemDate.getTime()) && monthKey(itemDate) === key;
    });
    return {
      key,
      label: date.toLocaleDateString("th-TH", {
        month: "short",
        year: "2-digit",
      }),
      total: rows.length,
      resolved: rows.filter((item) => item.status === "resolved").length,
    };
  });
  const maxMonthTotal = Math.max(1, ...monthlyTrend.map((item) => item.total));
  const recentMonths = monthlyTrend.slice(-3);
  const forecastCases = Math.round(
    recentMonths.reduce((sum, item) => sum + item.total, 0) /
      Math.max(1, recentMonths.filter((item) => item.total > 0).length),
  );
  const weightedUnitCost = incidents.length
    ? allCategories.reduce(
        (sum, item) =>
          sum +
          item.count *
            Number(unitCosts[item.name] ?? defaultUnitCost(item.name)),
        0,
      ) / incidents.length
    : 0;
  const forecastBudget = Math.round(forecastCases * weightedUnitCost);
  const budgetScenarios = [
    {
      label: "ต่ำ",
      cases: Math.max(0, Math.round(forecastCases * 0.8)),
      tone: "bg-emerald-50 text-emerald-800",
    },
    { label: "ฐาน", cases: forecastCases, tone: "bg-blue-50 text-blue-800" },
    {
      label: "สูง",
      cases: Math.round(forecastCases * 1.25),
      tone: "bg-amber-50 text-amber-900",
    },
  ].map((item) => ({
    ...item,
    budget: Math.round(
      item.cases * weightedUnitCost * (1 + reservePercent / 100),
    ),
  }));
  const urgentOpen = openItems.filter(
    (item) => Number(item.priority || 1) >= 3,
  ).length;
  const revisionOpen = openItems.filter(
    (item) => item.status === "revision_requested",
  ).length;
  const operationalRiskScore = Math.min(
    100,
    Math.round(
      (overdue / openItems.length || 0) * 45 +
        (urgentOpen / openItems.length || 0) * 35 +
        (revisionOpen / openItems.length || 0) * 20,
    ),
  );
  const riskLevel =
    operationalRiskScore >= 60
      ? "สูง"
      : operationalRiskScore >= 30
        ? "ปานกลาง"
        : "ต่ำ";
  const completeRecords = incidents.filter(
    (item) =>
      item.image &&
      item.location &&
      Number.isFinite(Number(item.lat)) &&
      Number.isFinite(Number(item.lng)),
  ).length;
  const dataQuality = incidents.length
    ? Math.round((completeRecords / incidents.length) * 100)
    : 0;
  const topRecurring = Object.values(
    incidents.reduce((result, item) => {
      const key = `${item.category || "ไม่ระบุ"}|${item.location || "ไม่ระบุ"}`;
      result[key] ??= {
        category: item.category || "ไม่ระบุ",
        location: item.location || "ไม่ระบุ",
        count: 0,
        open: 0,
      };
      result[key].count += 1;
      if (!closedStatuses.includes(item.status)) result[key].open += 1;
      return result;
    }, {}),
  ).sort((a, b) => b.count - a.count || b.open - a.open)[0];
  const decisionRecommendations = [
    overdue > 0 &&
      `เร่งติดตาม ${overdue} งานที่เกิน 24 ชั่วโมง โดยเริ่มจากงานความสำคัญสูง`,
    urgentOpen > 0 &&
      `กันทรัพยากรสำหรับงานสำคัญ/เร่งด่วน ${urgentOpen} งานก่อนรับงานใหม่`,
    topRecurring?.count >= 2 &&
      `ตรวจเชิงป้องกันบริเวณ ${topRecurring.location} เพราะพบ ${topRecurring.category} ซ้ำ ${topRecurring.count} ครั้ง`,
    dataQuality < 80 &&
      `ปรับคุณภาพข้อมูลแจ้งเหตุ: เคสที่มีรูปและพิกัดครบอยู่ที่ ${dataQuality}%`,
    isTaoScope &&
      staffPerformance.some((person) => person.open >= 5) &&
      "กระจายงานใหม่จากเจ้าหน้าที่ที่มีงานค้างตั้งแต่ 5 งานขึ้นไป",
  ]
    .filter(Boolean)
    .slice(0, 4);
  const slaTone = (value) =>
    value == null
      ? "text-slate-500"
      : value >= 80
        ? "text-emerald-700"
        : "text-amber-700";
  return (
    <div className="space-y-5 animate-fadeIn">
      <section className="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-slate-950 to-blue-950 p-5 text-white shadow-lg md:flex-row md:items-center md:justify-between md:p-7">
        <div>
          <div className="text-sm font-bold text-blue-200">
            {isTaoScope
              ? "ภาพรวมการดำเนินงานทั้ง 12 หมู่บ้าน"
              : `ข้อมูลเฉพาะ${scopeLabel}`}
          </div>
          <h2 className="mt-1 text-2xl font-black md:text-3xl">
            {isTaoScope
              ? "ศูนย์วิเคราะห์ข้อมูล อบต.มะต้อง"
              : "ศูนย์วิเคราะห์ข้อมูลหมู่บ้าน"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">
            {isTaoScope
              ? "เปรียบเทียบเรื่องร้องทุกข์ SLA งบประมาณ และผลการดำเนินงานรายหมู่บ้าน"
              : "ติดตามปัญหาซ้ำ SLA งานค้าง และประมาณการทรัพยากรภายในหมู่บ้าน"}
          </p>
        </div>
        <button
          onClick={onOpenIncidents}
          className="rounded-xl bg-white px-5 py-3 font-bold text-blue-900 shadow-sm hover:bg-blue-50"
        >
          จัดการรายการแจ้งเหตุ
        </button>
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "งานเปิดอยู่",
            value: openItems.length,
            note: `รอรับเรื่อง ${pending}`,
            tone: "text-blue-700 bg-blue-50",
          },
          {
            label: "เกิน 24 ชั่วโมง",
            value: overdue,
            note: "ควรติดตามก่อน",
            tone: overdue
              ? "text-red-700 bg-red-50"
              : "text-emerald-700 bg-emerald-50",
          },
          {
            label: "ปิดงานแล้ว",
            value: resolved,
            note: `${completionRate}% ของทั้งหมด`,
            tone: "text-emerald-700 bg-emerald-50",
          },
          {
            label: "เหตุทั้งหมด",
            value: incidents.length,
            note: "ฐานข้อมูลปัจจุบัน",
            tone: "text-slate-700 bg-slate-100",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div
              className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${card.tone}`}
            >
              {card.label}
            </div>
            <div className="mt-3 text-3xl font-black text-slate-950">
              {card.value}
            </div>
            <div className="mt-1 text-sm text-slate-500">{card.note}</div>
          </div>
        ))}
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "คำของบรอพิจารณา",
            value: `${waitingBudgetCount} เรื่อง`,
            note: currency(submittedBudgetTotal),
            tone: "border-amber-200 bg-amber-50 text-amber-900",
          },
          {
            label: "วงเงินอนุมัติ",
            value: currency(approvedBudgetTotal),
            note: "จากคำขอที่ผ่านการพิจารณา",
            tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
          },
          {
            label: "ยอดใช้จริง",
            value: currency(actualBudgetTotal),
            note: "บันทึกจากงานที่ดำเนินการแล้ว",
            tone: "border-blue-200 bg-blue-50 text-blue-900",
          },
          {
            label: "คงเหลือจากวงเงิน",
            value: currency(
              Math.max(0, approvedBudgetTotal - actualBudgetTotal),
            ),
            note: "วงเงินอนุมัติหักยอดใช้จริง",
            tone: "border-slate-200 bg-slate-50 text-slate-900",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-4 ${card.tone}`}
          >
            <div className="text-xs font-bold">{card.label}</div>
            <div className="mt-2 text-xl font-black md:text-2xl">
              {card.value}
            </div>
            <div className="mt-1 text-xs opacity-75">{card.note}</div>
          </div>
        ))}
      </section>
      {isTaoScope && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-4">
            <h3 className="text-xl font-black text-slate-900">
              เปรียบเทียบสถานการณ์รายหมู่บ้าน
            </h3>
            <p className="text-sm text-slate-500">
              ใช้จัดลำดับพื้นที่ที่มีงานค้างและดูวงเงินที่ได้รับอนุมัติ
              ไม่ใช้ตัดสิทธิ์หมู่บ้าน
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th className="pb-3">หมู่บ้าน</th>
                  <th className="pb-3 text-center">เรื่องทั้งหมด</th>
                  <th className="pb-3 text-center">งานเปิด</th>
                  <th className="pb-3 text-center">ปิดแล้ว</th>
                  <th className="pb-3 text-right">วงเงินอนุมัติ</th>
                </tr>
              </thead>
              <tbody>
                {villagePerformance.map((row) => (
                  <tr key={row.key} className="border-b border-slate-100">
                    <td className="py-3 font-bold text-slate-800">
                      {row.moo ? `หมู่ ${row.moo} ` : ""}
                      {row.name}
                    </td>
                    <td className="py-3 text-center">{row.total}</td>
                    <td
                      className={`py-3 text-center font-bold ${row.open ? "text-amber-700" : "text-emerald-700"}`}
                    >
                      {row.open}
                    </td>
                    <td className="py-3 text-center text-emerald-700">
                      {row.resolved}
                    </td>
                    <td className="py-3 text-right font-bold">
                      {currency(row.budget)}
                    </td>
                  </tr>
                ))}
                {!villagePerformance.length && (
                  <tr>
                    <td
                      colSpan="5"
                      className="py-10 text-center text-slate-500"
                    >
                      ยังไม่มีข้อมูลเรื่องร้องทุกข์
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-900">
                งานที่ควรจัดการก่อน
              </h3>
              <p className="text-sm text-slate-500">
                เรียงจากความสำคัญที่กำหนดและอายุงาน
              </p>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
              {openItems.length} งานเปิด
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {priorityItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => onOpenIncident(item)}
                className="grid w-full grid-cols-[2rem_1fr_auto] items-center gap-3 py-3 text-left hover:bg-slate-50"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black ${index < 2 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-slate-900">
                    {item.title}
                  </span>
                  <span className="block truncate text-sm text-slate-500">
                    {item.location} · {getStatusLabel(item.status)}
                  </span>
                </span>
                <span className="text-right text-xs text-slate-500">
                  เปิดมา
                  <br />
                  <b className="text-slate-800">{formatHours(item.age)}</b>
                </span>
              </button>
            ))}
            {!priorityItems.length && (
              <div className="py-10 text-center text-slate-500">
                ไม่มีงานเปิดค้าง
              </div>
            )}
          </div>
          {openItems.length > 5 && (
            <button
              onClick={onOpenIncidents}
              className="mt-3 w-full rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              ดูงานเปิดทั้งหมด {openItems.length} รายการ
            </button>
          )}
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <h3 className="text-xl font-black text-slate-900">
            ประสิทธิภาพการบริการ
          </h3>
          <p className="mb-5 text-sm text-slate-500">
            SLA รับเรื่อง 1 ชั่วโมง · ปิดงาน 24 ชั่วโมง
          </p>
          <div className="space-y-5">
            {[
              {
                label: "รับเรื่องตามเวลา",
                value: responseSla,
                detail: `มัธยฐาน ${formatHours(median(responseTimes))}`,
                color: "bg-blue-600",
              },
              {
                label: "ปิดงานตามเวลา",
                value: resolveSla,
                detail: `มัธยฐาน ${formatHours(median(resolveTimes))}`,
                color: "bg-emerald-600",
              },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="font-bold text-slate-800">{row.label}</div>
                    <div className="text-sm text-slate-500">{row.detail}</div>
                  </div>
                  <div className={`text-2xl font-black ${slaTone(row.value)}`}>
                    {row.value == null ? "-" : `${row.value}%`}
                  </div>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${row.color}`}
                    style={{ width: `${row.value || 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <b>จุดที่ต้องติดตาม:</b>{" "}
            {overdue
              ? `มี ${overdue} งานเปิดเกิน 24 ชั่วโมง`
              : "ไม่มีงานเปิดที่เกิน 24 ชั่วโมง"}
          </div>
        </section>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <h3 className="text-xl font-black text-slate-900">
            หมวดปัญหาที่พบบ่อย
          </h3>
          <p className="mb-5 text-sm text-slate-500">
            ใช้ประกอบการจัดทีมและวางแผนทรัพยากร
          </p>
          <div className="space-y-4">
            {categories.map((item) => {
              const percent = incidents.length
                ? Math.round((item.count / incidents.length) * 100)
                : 0;
              return (
                <div key={item.name}>
                  <div className="mb-1.5 flex justify-between gap-3 text-sm">
                    <span className="truncate font-bold text-slate-700">
                      {item.name}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {item.count} เคส · {percent}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!categories.length && (
              <div className="py-8 text-center text-slate-500">
                ยังไม่มีข้อมูล
              </div>
            )}
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <h3 className="text-xl font-black text-slate-900">
            จุดที่มีการแจ้งซ้ำสูงสุด
          </h3>
          <p className="mb-4 text-sm text-slate-500">
            แสดงเฉพาะ 3 จุดแรก เพื่อไม่ให้หน้ายาวเกินไป
          </p>
          <div className="space-y-3">
            {locations.map((item, index) => (
              <div
                key={item.name}
                className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 font-black text-blue-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-slate-900">
                    {item.name}
                  </div>
                  <div className="text-sm text-slate-500">
                    ยังเปิด {item.open} งาน
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900">
                    {item.count}
                  </div>
                  <div className="text-xs text-slate-500">เคสทั้งหมด</div>
                </div>
              </div>
            ))}
            {!locations.length && (
              <div className="py-8 text-center text-slate-500">
                ยังไม่มีข้อมูล
              </div>
            )}
          </div>
        </section>
      </div>
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 bg-gradient-to-r from-blue-950 to-indigo-900 p-5 text-white md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-200">
              Budget planning
            </div>
            <h3 className="mt-1 text-2xl font-black">
              ประมาณการงบงานที่ยังเปิดอยู่
            </h3>
            <p className="mt-1 text-sm text-blue-100">
              คำนวณจากจำนวนเคสเปิด × ต้นทุนเฉลี่ยต่อเคส
              ปรับสมมติฐานให้ตรงราคาจริงได้
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-3 text-right">
            <div className="text-xs text-blue-100">
              งบที่ควรเตรียมรวมเงินสำรอง
            </div>
            <div className="text-3xl font-black">
              {currency(requestedBudget)}
            </div>
          </div>
        </div>
        <div className="grid gap-6 p-4 md:p-6 xl:grid-cols-[1.35fr_.65fr]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th className="pb-3 font-bold">หมวดงาน</th>
                  <th className="pb-3 text-center font-bold">งานเปิด</th>
                  <th className="pb-3 text-right font-bold">
                    ต้นทุน/เคส (บาท)
                  </th>
                  <th className="pb-3 text-right font-bold">ประมาณการ</th>
                </tr>
              </thead>
              <tbody>
                {allCategories.map((item) => {
                  const cost = Number(
                    unitCosts[item.name] ?? defaultUnitCost(item.name),
                  );
                  return (
                    <tr key={item.name} className="border-b border-slate-100">
                      <td className="max-w-[240px] py-3 font-bold text-slate-800">
                        {item.name}
                      </td>
                      <td className="py-3 text-center">{item.open}</td>
                      <td className="py-3 text-right">
                        <input
                          aria-label={`ต้นทุนต่อเคส ${item.name}`}
                          type="number"
                          min="0"
                          step="100"
                          value={cost}
                          onChange={(event) =>
                            setUnitCosts((current) => ({
                              ...current,
                              [item.name]: Math.max(
                                0,
                                Number(event.target.value) || 0,
                              ),
                            }))
                          }
                          className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </td>
                      <td className="py-3 text-right font-black text-slate-900">
                        {currency(item.open * cost)}
                      </td>
                    </tr>
                  );
                })}
                {!allCategories.length && (
                  <tr>
                    <td
                      colSpan="4"
                      className="py-10 text-center text-slate-500"
                    >
                      ยังไม่มีข้อมูลสำหรับประมาณการ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">ค่าใช้จ่ายงานเปิด</div>
              <div className="mt-1 text-2xl font-black text-slate-900">
                {currency(plannedWorkCost)}
              </div>
            </div>
            <label className="block rounded-2xl border border-slate-200 p-4">
              <span className="flex items-center justify-between text-sm font-bold text-slate-700">
                <span>เงินสำรองความเสี่ยง</span>
                <span>{reservePercent}%</span>
              </span>
              <input
                disabled={!canEditBudget}
                type="range"
                min="0"
                max="50"
                step="1"
                value={reservePercent}
                onChange={(event) =>
                  setReservePercent(Number(event.target.value))
                }
                className="mt-3 w-full accent-blue-600 disabled:opacity-50"
              />
              <span className="mt-2 block text-right text-sm font-bold text-blue-700">
                + {currency(reserveAmount)}
              </span>
            </label>
            {canEditBudget && (
              <button
                onClick={saveBudgetSettings}
                disabled={budgetSaving}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {budgetSaving
                  ? "กำลังบันทึก..."
                  : "บันทึกเป็นค่ากลางทุกเครื่อง"}
              </button>
            )}
            {budgetMessage && (
              <div className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-800">
                {budgetMessage}
              </div>
            )}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
              <b>ข้อควรรู้:</b> ตัวเลขนี้เป็นประมาณการเพื่อวางแผน
              ไม่ใช่ยอดเบิกจ่ายจริง ค่าแรง วัสดุ
              และราคาผู้รับเหมาควรอัปเดตก่อนอนุมัติงบ
            </div>
          </div>
        </div>
      </section>
      <div className={`grid gap-5 ${isTaoScope ? "lg:grid-cols-2" : ""}`}>
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <h3 className="text-xl font-black text-slate-900">แนวโน้ม 6 เดือน</h3>
          <p className="mb-5 text-sm text-slate-500">
            จำนวนเรื่องที่แจ้งและปิดงาน แสดงย้อนหลังจากเดือนล่าสุดที่มีข้อมูล
          </p>
          <div className="space-y-3">
            {monthlyTrend.map((item) => (
              <div
                key={item.key}
                className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3"
              >
                <span className="text-sm font-bold text-slate-600">
                  {item.label}
                </span>
                <div className="h-8 overflow-hidden rounded-lg bg-slate-100">
                  <div
                    className="flex h-full items-center justify-end rounded-lg bg-blue-600 pr-2 text-xs font-bold text-white"
                    style={{
                      width: `${Math.max(item.total ? 18 : 0, (item.total / maxMonthTotal) * 100)}%`,
                    }}
                  >
                    {item.total || ""}
                  </div>
                </div>
                <span className="w-20 text-right text-xs text-slate-500">
                  ปิด {item.resolved}
                </span>
              </div>
            ))}
          </div>
        </section>
        {isTaoScope && (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <h3 className="text-xl font-black text-slate-900">
              ภาระงานเจ้าหน้าที่
            </h3>
            <p className="mb-4 text-sm text-slate-500">
              ใช้กระจายงาน ไม่ใช่คะแนนประเมินบุคลากร
            </p>
            <div className="space-y-3">
              {staffPerformance.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-black text-indigo-700">
                    {person.name?.charAt(0) || "ส"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-slate-900">
                      {person.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      รับทั้งหมด {person.total} · ปิดแล้ว {person.done}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${person.open >= 5 ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}
                  >
                    ค้าง {person.open}
                  </span>
                </div>
              ))}
              {!staffPerformance.length && (
                <div className="py-10 text-center text-slate-500">
                  ยังไม่มีข้อมูลเจ้าหน้าที่
                </div>
              )}
            </div>
          </section>
        )}
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-5">
          <h3 className="text-xl font-black text-slate-900">
            วิเคราะห์ล่วงหน้าเพื่อการตัดสินใจ
          </h3>
          <p className="text-sm text-slate-500">
            คาดการณ์จากค่าเฉลี่ย 3 เดือนล่าสุดและโครงสร้างต้นทุนปัจจุบัน
            ไม่ใช่การรับรองยอดที่จะเกิดขึ้นจริง
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-indigo-950 p-5 text-white">
            <div className="text-sm text-indigo-200">คาดการณ์เคสเดือนถัดไป</div>
            <div className="mt-2 text-4xl font-black">
              {forecastCases}
              <span className="ml-2 text-base font-medium">เคส</span>
            </div>
            <div className="mt-2 text-xs text-indigo-200">
              ค่าเฉลี่ยจำนวนแจ้งเหตุของ 3 เดือนล่าสุดที่มีข้อมูล
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900 p-5 text-white">
            <div className="text-sm text-slate-300">งบฐานเดือนถัดไป</div>
            <div className="mt-2 text-3xl font-black">
              {currency(forecastBudget)}
            </div>
            <div className="mt-2 text-xs text-slate-300">
              จำนวนเคสคาดการณ์ × ต้นทุนถ่วงน้ำหนักตามหมวด
            </div>
          </div>
          <div
            className={`rounded-2xl p-5 ${riskLevel === "สูง" ? "bg-red-50 text-red-900" : riskLevel === "ปานกลาง" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}
          >
            <div className="text-sm font-bold">
              ความเสี่ยงงานค้าง: {riskLevel}
            </div>
            <div className="mt-2 text-4xl font-black">
              {operationalRiskScore}
              <span className="text-base">/100</span>
            </div>
            <div className="mt-2 text-xs">
              ถ่วงน้ำหนักงานเกินเวลา 45% งานเร่งด่วน 35% และงานส่งกลับ 20%
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
          <div>
            <h4 className="font-black text-slate-900">สถานการณ์งบประมาณ</h4>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {budgetScenarios.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl p-3 ${item.tone}`}
                >
                  <div className="text-xs font-bold">กรณี{item.label}</div>
                  <div className="mt-1 text-lg font-black">
                    {currency(item.budget)}
                  </div>
                  <div className="text-xs opacity-75">{item.cases} เคส</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-slate-500">
              กรณีต่ำ = 80% · ฐาน = 100% · สูง = 125% ของจำนวนเคสคาดการณ์
              และรวมเงินสำรอง {reservePercent}%
            </div>
          </div>
          <div>
            <h4 className="font-black text-slate-900">ข้อเสนอแนะจากข้อมูล</h4>
            <div className="mt-3 space-y-2">
              {decisionRecommendations.map((text, index) => (
                <div
                  key={text}
                  className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <span>{text}</span>
                </div>
              ))}
              {!decisionRecommendations.length && (
                <div className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                  ยังไม่พบสัญญาณที่ต้องเร่งดำเนินการจากข้อมูลปัจจุบัน
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
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
  const approvedTotal = forwarded.reduce(
    (sum, item) => sum + Number(item.budgetRequest?.approved_amount || 0),
    0,
  );
  const actualTotal = forwarded.reduce(
    (sum, item) => sum + Number(item.budgetRequest?.actual_amount || 0),
    0,
  );
  const villageRows = (villages || []).map((village) => {
    const rows = incidents.filter(
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
      budget: sent.reduce(
        (sum, item) => sum + Number(item.budgetRequest?.approved_amount || 0),
        0,
      ),
    };
  });
  const openCase = (item) => {
    setSelectedCase(item);
    setCaseNote("");
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
  const updateGeneralCase = async (status) => {
    if (!selectedCase || selectedCase.budgetRequest) return;
    if (!caseNote.trim()) {
      return alert("กรุณาระบุผลการดำเนินงานหรือหมายเหตุก่อน");
    }
    setSaving(true);
    try {
      const response = await api.updateIncidentStatus(selectedCase.id, {
        status,
        note: caseNote.trim(),
      });
      const updated = normalizeIncident({ ...selectedCase, ...response });
      setIncidents((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelectedCase(updated);
      setCaseNote("");
      alert(
        status === "in_progress"
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
  const list = activeTab === "tao_budget" ? budgetQueue : generalForwarded;
  const publicNews = (news || []).filter((item) => item.village_id == null);
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
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-950 p-6 text-white shadow-xl md:p-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative">
          <div className="text-sm font-bold text-cyan-200">
            ศูนย์ประสานงานระดับตำบล
          </div>
          <h2 className="mt-1 text-3xl font-black">
            ระบบปฏิบัติการ อบต.มะต้อง
          </h2>
          <p className="mt-2 max-w-3xl text-slate-300">
            รับเฉพาะเรื่องที่แอดมินหมู่บ้านส่งต่อ พิจารณาการสนับสนุนงบประมาณ
            และติดตามผลข้ามหมู่บ้าน
          </p>
        </div>
      </section>
      {activeTab === "tao_overview" && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "เรื่องส่งต่อทั้งหมด",
                value: forwarded.length,
                note: "จาก 12 หมู่บ้าน",
                tone: "bg-blue-50 text-blue-900",
              },
              {
                label: "กำลังดำเนินการ",
                value: activeForwarded.length,
                note: "ยังไม่ปิดเรื่อง",
                tone: "bg-amber-50 text-amber-900",
              },
              {
                label: "คำของบรอพิจารณา",
                value: budgetQueue.length,
                note: "ต้องตัดสินใจ",
                tone: "bg-red-50 text-red-900",
              },
              {
                label: "วงเงินอนุมัติ",
                value: currency(approvedTotal),
                note: `ใช้จริง ${currency(actualTotal)}`,
                tone: "bg-emerald-50 text-emerald-900",
              },
            ].map((card) => (
              <div
                key={card.label}
                className={`rounded-2xl border p-5 ${card.tone}`}
              >
                <div className="text-sm font-bold">{card.label}</div>
                <div className="mt-2 text-3xl font-black">{card.value}</div>
                <div className="mt-1 text-xs opacity-70">{card.note}</div>
              </div>
            ))}
          </section>
          <section className="grid gap-5 lg:grid-cols-2">
            <button
              onClick={() => setActiveTab("tao_forwarded")}
              className="rounded-3xl border bg-white p-6 text-left shadow-sm hover:border-blue-300"
            >
              <div className="text-sm font-bold text-blue-600">
                กล่องงาน อบต.
              </div>
              <div className="mt-2 text-2xl font-black">
                ตรวจเรื่องที่หมู่บ้านส่งต่อ
              </div>
              <p className="mt-2 text-slate-500">
                ตรวจเหตุผล หลักฐาน หมู่บ้านต้นทาง และติดตามสถานะการแก้ไข
              </p>
            </button>
            <button
              onClick={() => setActiveTab("tao_budget")}
              className="rounded-3xl border bg-white p-6 text-left shadow-sm hover:border-emerald-300"
            >
              <div className="text-sm font-bold text-emerald-600">
                งานงบประมาณ
              </div>
              <div className="mt-2 text-2xl font-black">
                พิจารณาคำของบ {budgetQueue.length} รายการ
              </div>
              <p className="mt-2 text-slate-500">
                ระบุวงเงิน ปีงบประมาณ แหล่งเงิน และเลขเอกสารอ้างอิง
              </p>
            </button>
          </section>
        </>
      )}
      {activeTab === "tao_analysis" && (
        <SimpleAnalyticsDashboard
          incidents={incidents}
          villages={villages}
          scope="tao"
          scopeLabel="ทั้ง 12 หมู่บ้าน"
        />
      )}
      {activeTab === "tao_reports" && (
        <AdminReports incidents={incidents} users={users} />
      )}
      {["tao_forwarded", "tao_budget"].includes(activeTab) && (
        <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4">
            <h3 className="text-2xl font-black">
              {activeTab === "tao_budget"
                ? "ข้อเสนอโครงการรอพิจารณา"
                : "เรื่องที่ อบต.รับดำเนินการ"}
            </h3>
            <p className="text-sm text-slate-500">
              {activeTab === "tao_budget"
                ? "แสดงข้อเสนอโครงการที่หมู่บ้านส่งมาให้ อบต.พิจารณาแผนและงบประมาณ"
                : "หมู่บ้านส่งเรื่องที่แก้เองไม่ได้มาให้ อบต.รับดำเนินการ อัปเดตผล และปิดเรื่อง"}
            </p>
          </div>
          <div className="grid gap-3">
            {list.map((item) => (
              <button
                key={item.id}
                onClick={() => openCase(item)}
                className="grid gap-3 rounded-2xl border p-4 text-left hover:border-blue-300 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="text-xs font-bold text-blue-600">
                    หมู่ {item.villageMoo || "-"} {item.villageName || ""} ·{" "}
                    {item.referenceNo || `#${item.id}`}
                  </div>
                  <div className="mt-1 text-lg font-black">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {item.location} · {getStatusLabel(item.status)}
                  </div>
                </div>
                <div className="md:text-right">
                  <div className="font-black text-emerald-700">
                    {item.budgetRequest
                      ? currency(item.budgetRequest.estimated_amount)
                      : "ไม่ของบ"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {item.budgetRequest?.status || "ส่งต่อทั่วไป"}
                  </div>
                </div>
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
              ใช้ติดตามจำนวนเรื่องที่ส่งต่อมายัง อบต. และวงเงินอนุมัติ
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="bg-slate-50 text-left text-sm text-slate-500">
                  <th className="p-4">หมู่บ้าน</th>
                  <th className="p-4 text-center">เรื่องทั้งหมด</th>
                  <th className="p-4 text-center">ส่งต่อ อบต.</th>
                  <th className="p-4 text-center">ยังเปิด</th>
                  <th className="p-4 text-right">วงเงินอนุมัติ</th>
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
                    <td className="p-4 text-right font-bold">
                      {currency(row.budget)}
                    </td>
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
              onSubmit={savePublicNews}
              className="rounded-3xl border bg-white p-5 shadow-sm md:p-7"
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
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {publicNews.map((item) => (
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
                    {item.displaySection === "hero"
                      ? "ส่วนที่ 1 · ภาพกิจกรรมสำคัญ"
                      : item.displaySection === "video"
                        ? "ส่วนที่ 3 · วิดีโอแนะนำตำบล"
                        : "ส่วนที่ 2 · ข่าวและกิจกรรม"}
                  </div>
                  <h4 className="mt-1 line-clamp-2 text-lg font-black">
                    {item.title}
                  </h4>
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
            {!publicNews.length && !editingPublicNews && (
              <div className="rounded-3xl border border-dashed bg-white p-12 text-center text-slate-500 md:col-span-2 xl:col-span-3">
                <Image className="mx-auto mb-3 h-10 w-10 opacity-40" />
                <div className="font-bold">
                  ยังไม่มีข่าวหรือภาพประชาสัมพันธ์จาก อบต.
                </div>
                <div className="mt-1 text-sm">
                  กด “เพิ่มข่าวหรือกิจกรรม” เพื่อสร้างสไลด์แรก
                </div>
              </div>
            )}
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
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-blue-600">
                  หมู่ {selectedCase.villageMoo} {selectedCase.villageName}
                </div>
                <h3 className="text-2xl font-black">{selectedCase.title}</h3>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="h-10 w-10 rounded-full bg-slate-100"
              >
                <X className="mx-auto" />
              </button>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p>{selectedCase.description}</p>
              <div className="mt-2 text-sm text-slate-500">
                {selectedCase.location}
              </div>
            </div>
            {selectedCase.budgetRequest ? (
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
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
                  <b>เรื่องที่หมู่บ้านขอให้ อบต.ช่วยดำเนินการ</b>
                  <p className="mt-1 text-sm">
                    เรื่องนี้ไม่ใช่คำของบประมาณ อบต.ต้องรับเรื่อง
                    บันทึกผลการดำเนินงาน และปิดเรื่องเมื่อแก้ไขเสร็จ
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-white px-3 py-1">
                      สถานะปัจจุบัน: {getStatusLabel(selectedCase.status)}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      เลขที่ {selectedCase.referenceNo || `#${selectedCase.id}`}
                    </span>
                  </div>
                </div>
                {!["resolved", "cancelled"].includes(selectedCase.status) && (
                  <div className="rounded-2xl border p-4">
                    <label className="text-sm font-bold">
                      ผลการดำเนินงาน / หมายเหตุถึงหมู่บ้านและผู้แจ้ง
                      <textarea
                        value={caseNote}
                        onChange={(event) => setCaseNote(event.target.value)}
                        className="mt-2 h-24 w-full resize-none rounded-xl border p-3 font-normal outline-none focus:border-blue-500"
                        placeholder="เช่น อบต.รับประสานกองช่างแล้ว หรือดำเนินการซ่อมเสร็จแล้ว"
                      />
                    </label>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {selectedCase.status !== "in_progress" && (
                        <button
                          disabled={saving}
                          onClick={() => updateGeneralCase("in_progress")}
                          className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                        >
                          รับเรื่องและเริ่มดำเนินการ
                        </button>
                      )}
                      <button
                        disabled={saving}
                        onClick={() => updateGeneralCase("resolved")}
                        className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                      >
                        บันทึกผลและปิดเรื่อง
                      </button>
                      <button
                        disabled={saving}
                        onClick={() => updateGeneralCase("cancelled")}
                        className="rounded-xl border border-red-300 px-4 py-3 font-bold text-red-700 disabled:opacity-50 sm:col-span-2"
                      >
                        ยุติเรื่อง (กรณีดำเนินการไม่ได้)
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
  const pending = incidents.filter((item) => item.status === "pending");
  const active = incidents.filter((item) =>
    ["assigned", "in_progress", "revision_requested"].includes(item.status),
  );
  const waitingReview = incidents.filter(
    (item) => item.status === "waiting_review",
  );
  const resolved = incidents.filter((item) => item.status === "resolved");
  const pendingResidents = users.filter(
    (item) => item.role === "user" && item.accountStatus === "pending",
  ).length;
  const waitingBudgets = incidents.filter(
    (item) => item.budgetRequest?.status === "submitted",
  ).length;
  const urgent = [...incidents]
    .filter((item) => !["resolved", "cancelled"].includes(item.status))
    .sort(
      (a, b) =>
        Number(b.priority || 1) - Number(a.priority || 1) ||
        new Date(a.date || 0) - new Date(b.date || 0),
    )
    .slice(0, 5);
  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-fadeIn">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 to-blue-950 p-6 text-white shadow-xl md:p-8">
        <div className="text-sm font-bold text-blue-200">
          หมู่ {currentUser?.villageMoo || "-"} {currentUser?.villageName || ""}
        </div>
        <h2 className="mt-1 text-3xl font-black">ภาพรวมงานหมู่บ้าน</h2>
        <p className="mt-2 text-slate-300">
          แสดงเฉพาะงานที่ต้องจัดการจริง ไม่รวมการคาดการณ์หรือตัวเลขจำลอง
        </p>
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["เรื่องใหม่", pending.length, "text-blue-700 bg-blue-50"],
          ["กำลังดำเนินการ", active.length, "text-amber-700 bg-amber-50"],
          ["รอตรวจรับ", waitingReview.length, "text-purple-700 bg-purple-50"],
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
      <section className="grid gap-3 md:grid-cols-3">
        <button
          onClick={() => setActiveTab("incidents")}
          className="rounded-2xl border bg-white p-5 text-left shadow-sm hover:border-blue-400"
        >
          <div className="text-sm font-bold text-blue-600">งานร้องทุกข์</div>
          <div className="mt-1 text-xl font-black">
            เปิดรายการและอัปเดตสถานะ
          </div>
          <div className="mt-2 text-sm text-slate-500">
            มี {pending.length + active.length + waitingReview.length}{" "}
            เรื่องที่ยังไม่ปิด
          </div>
        </button>
        <button
          onClick={() => setActiveTab("budgets")}
          className="rounded-2xl border bg-white p-5 text-left shadow-sm hover:border-emerald-400"
        >
          <div className="text-sm font-bold text-emerald-600">งานงบประมาณ</div>
          <div className="mt-1 text-xl font-black">สร้างและติดตามคำของบ</div>
          <div className="mt-2 text-sm text-slate-500">
            {waitingBudgets} คำขอกำลังรอ อบต.
          </div>
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className="rounded-2xl border bg-white p-5 text-left shadow-sm hover:border-violet-400"
        >
          <div className="text-sm font-bold text-violet-600">บัญชีประชาชน</div>
          <div className="mt-1 text-xl font-black">ตรวจสอบสมาชิกใหม่</div>
          <div className="mt-2 text-sm text-slate-500">
            {pendingResidents} บัญชีรออนุมัติ
          </div>
        </button>
      </section>
      <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
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
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    project_title: "",
    reason: "",
    affected_people: "",
    urgency: "normal",
    estimated_amount: "",
  });
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
            </div>
          )}
        </section>
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
          incident.houseNo,
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
          houseNo: inc.houseNo,
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

  const deleteIncident = async (id) => {
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบการแจ้งเหตุนี้?")) {
      try {
        await api.deleteIncident(id);
      } catch (error) {
        if (!USE_MOCK_DATA) {
          alert(error?.message || "ลบรายการไม่สำเร็จ");
          return;
        }
      }
      setIncidents(incidents.filter((i) => i.id !== id));
      setSelectedIncident(null);
    }
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

  const assignIncident = async (id, staffId, priority, note) => {
    try {
      const updated = normalizeIncident(
        await api.assignIncident(
          id,
          Number(staffId),
          Number(priority),
          note || null,
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
    `${user.name} ${user.phone} ${user.houseNo || ""}`
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
      {activeTab === "analytics" && (
        <SimpleAnalyticsDashboard
          incidents={incidents}
          scope="village"
          scopeLabel={`หมู่ ${currentUser?.villageMoo || "-"} ${currentUser?.villageName || ""}`}
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
                          บ้านเลขที่ {user.houseNo} • แจ้งทั้งหมด{" "}
                          {user.totalReports} เคส
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
                  placeholder="ชื่อเรื่อง ผู้แจ้ง บ้านเลขที่ สถานที่ หรือเลขงาน"
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
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold text-slate-600">
                  ตั้งแต่
                  <input
                    type="date"
                    value={incidentDateFrom}
                    max={incidentDateTo || undefined}
                    onChange={(event) => {
                      setIncidentDateFrom(event.target.value);
                      setIncidentPage(1);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-sm"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  ถึงวันที่
                  <input
                    type="date"
                    value={incidentDateTo}
                    min={incidentDateFrom || undefined}
                    onChange={(event) => {
                      setIncidentDateTo(event.target.value);
                      setIncidentPage(1);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-sm"
                  />
                </label>
              </div>
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
                  <th className="p-4 font-semibold">ผู้แจ้ง / บ้านเลขที่</th>
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
                      <div className="text-xs text-gray-500">
                        บ้าน: {inc.houseNo}
                      </div>
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
              <div className="flex justify-between items-center mb-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-800">
                  จัดการประกาศข่าวสาร
                </h2>
                <button
                  onClick={() => startEditNews()}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" /> สร้างข่าวใหม่
                </button>
              </div>
              <div className="grid gap-6">
                {news.map((n) => (
                  <div
                    key={n.id}
                    className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col sm:flex-row hover:shadow-md transition-all"
                  >
                    <div className="sm:w-1/4 h-48 sm:h-auto overflow-hidden">
                      <img
                        src={n.image}
                        alt="news"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-6 sm:w-3/4 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold text-gray-400 mb-2 block">
                          {n.date}
                        </span>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {n.title}
                        </h3>
                        <p className="text-gray-600 line-clamp-2">
                          {n.content}
                        </p>
                      </div>
                      <div className="mt-4 flex gap-3">
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
                  อนุมัติและดูแลเฉพาะบัญชีประชาชนใน{" "}
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
                label: "รออนุมัติ",
                value: residentUsers.filter(
                  (u) => u.accountStatus === "pending",
                ).length,
                tone: "bg-amber-100 text-amber-700",
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
                    placeholder="ค้นหาชื่อ เบอร์โทร หรือบ้านเลขที่"
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
                          <div className="text-xs text-slate-500">
                            บ้านเลขที่ {person.houseNo}
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${person.accountStatus === "approved" ? "bg-green-100 text-green-700" : person.accountStatus === "pending" ? "bg-amber-100 text-amber-700" : person.accountStatus === "rejected" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-700"}`}
                          >
                            {
                              {
                                approved: "ใช้งานได้",
                                pending: "รออนุมัติ",
                                rejected: "ไม่อนุมัติ",
                                suspended: "ระงับ",
                              }[person.accountStatus]
                            }
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            {person.accountStatus !== "approved" && (
                              <button
                                onClick={() =>
                                  updateUserAccountStatus(person.id, "approved")
                                }
                                className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100"
                              >
                                อนุมัติ
                              </button>
                            )}
                            {person.accountStatus === "pending" && (
                              <button
                                onClick={() =>
                                  updateUserAccountStatus(person.id, "rejected")
                                }
                                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                              >
                                ปฏิเสธ
                              </button>
                            )}
                            {person.accountStatus === "approved" && (
                              <button
                                onClick={() =>
                                  updateUserAccountStatus(
                                    person.id,
                                    "suspended",
                                  )
                                }
                                className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"
                              >
                                ระงับ
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
          onDelete={() => deleteIncident(selectedIncident.id)}
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
  const [workflowNote, setWorkflowNote] = useState("");
  const [inspectionNote, setInspectionNote] = useState("");
  const [inspectionImage, setInspectionImage] = useState(null);
  const [inspectionSaving, setInspectionSaving] = useState(false);

  const saveInspection = async () => {
    if (!inspectionNote.trim() && !inspectionImage)
      return alert("กรุณากรอกผลตรวจพื้นที่หรือแนบรูปอย่างน้อยหนึ่งอย่าง");
    const payload = new FormData();
    if (inspectionNote.trim())
      payload.append("message", `ผลตรวจพื้นที่: ${inspectionNote.trim()}`);
    if (inspectionImage) payload.append("image", inspectionImage);
    setInspectionSaving(true);
    try {
      const data = await api.addIncidentProgress(inc.id, payload);
      onIncidentReplace(data.incident);
      setInspectionNote("");
      setInspectionImage(null);
      alert("บันทึกผลตรวจพื้นที่แล้ว");
    } catch (error) {
      alert(error?.message || "บันทึกผลตรวจพื้นที่ไม่สำเร็จ");
    } finally {
      setInspectionSaving(false);
    }
  };

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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fadeIn relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"
        >
          <X className="w-6 h-6 text-gray-600" />
        </button>

        <div className="p-8">
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
                  หมู่ {inc.villageMoo || "-"} {inc.villageName || ""} ·
                  บ้านเลขที่ {inc.houseNo}
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <p className="text-sm text-blue-600 mb-1 font-semibold flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> สถานที่ / จุดสังเกต
                </p>
                <p className="font-bold text-gray-900">{inc.location}</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              รายละเอียดเพิ่มเติม
            </h3>
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-gray-700 leading-relaxed whitespace-pre-wrap">
              {inc.description}
            </div>
          </div>

          {villageMode &&
            ["in_progress", "revision_requested"].includes(inc.status) && (
              <div className="mb-8 rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
                <h3 className="font-black text-cyan-950">
                  บันทึกผลตรวจพื้นที่
                </h3>
                <p className="mt-1 text-sm text-cyan-800">
                  ใช้บันทึกสิ่งที่พบจากการลงพื้นที่และรูปหลักฐานเพิ่มเติม
                </p>
                <textarea
                  value={inspectionNote}
                  onChange={(event) => setInspectionNote(event.target.value)}
                  className="mt-3 h-24 w-full rounded-xl border bg-white p-3"
                  placeholder="เช่น ตรวจพบผิวถนนแตกร้าวยาวประมาณ 15 เมตร ต้องใช้วัสดุและเครื่องจักรเพิ่มเติม"
                />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setInspectionImage(event.target.files?.[0] || null)
                  }
                  className="mt-3 w-full rounded-xl border bg-white p-3 text-sm"
                />
                <button
                  type="button"
                  disabled={inspectionSaving}
                  onClick={saveInspection}
                  className="mt-3 rounded-xl bg-cyan-700 px-5 py-3 font-bold text-white disabled:opacity-50"
                >
                  {inspectionSaving ? "กำลังบันทึก..." : "บันทึกผลตรวจพื้นที่"}
                </button>
              </div>
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
                      onAssign(inc.id, assignedStaffId, priority, workflowNote)
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

          {!["assigned", "waiting_review", "revision_requested"].includes(
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
                      onClick={onDelete}
                      className="flex-1 sm:flex-none px-6 py-3 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition"
                    >
                      ลบเหตุนี้
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
        </div>
      </div>
    </div>
  );
}

function NewsModal({ news, onClose }) {
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
          className="w-full h-64 md:h-80 object-cover rounded-t-3xl"
        />

        <div className="p-8">
          <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold mb-4 border border-blue-100">
            ประกาศเมื่อ: {news.date}
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

function StatusBadge({ status, size = "sm" }) {
  const isLg = size === "lg";
  const classes = isLg ? "px-4 py-2 text-sm" : "px-3 py-1 text-xs";

  if (status === "pending")
    return (
      <span
        className={`bg-yellow-100 text-yellow-800 font-bold rounded-full border border-yellow-300 shadow-sm inline-flex items-center gap-1 ${classes}`}
      >
        <span className="w-2 h-2 rounded-full bg-yellow-500"></span> รอรับเรื่อง
      </span>
    );
  if (status === "assigned")
    return (
      <span
        className={`bg-indigo-100 text-indigo-800 font-bold rounded-full border border-indigo-300 shadow-sm inline-flex items-center gap-1 ${classes}`}
      >
        <span className="w-2 h-2 rounded-full bg-indigo-500"></span> มอบหมายแล้ว
      </span>
    );
  if (status === "in_progress")
    return (
      <span
        className={`bg-blue-100 text-blue-800 font-bold rounded-full border border-blue-300 shadow-sm inline-flex items-center gap-1 ${classes}`}
      >
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>{" "}
        กำลังดำเนินการ
      </span>
    );
  if (status === "waiting_review")
    return (
      <span
        className={`bg-amber-100 text-amber-800 font-bold rounded-full border border-amber-300 shadow-sm inline-flex items-center gap-1 ${classes}`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-500"></span> รอตรวจรับ
      </span>
    );
  if (status === "revision_requested")
    return (
      <span
        className={`bg-red-100 text-red-800 font-bold rounded-full border border-red-300 shadow-sm inline-flex items-center gap-1 ${classes}`}
      >
        <span className="w-2 h-2 rounded-full bg-red-500"></span> ส่งกลับแก้ไข
      </span>
    );
  if (status === "resolved")
    return (
      <span
        className={`bg-green-100 text-green-800 font-bold rounded-full border border-green-300 shadow-sm inline-flex items-center gap-1 ${classes}`}
      >
        <span className="w-2 h-2 rounded-full bg-green-500"></span> แก้ไขแล้ว
      </span>
    );
  return null;
}

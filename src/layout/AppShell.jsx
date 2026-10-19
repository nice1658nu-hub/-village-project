import React, { useEffect, useRef, useState } from "react";
import {
  Home, FileText, AlertTriangle, PieChart, Users, Settings, LogOut,
  MapPin, Camera, CheckCircle, Clock, Search, Plus, Trash2, Menu, X,
  Calendar, Bell, Facebook, Phone, MessageCircle, ChevronRight, Upload,
  Map, Info, Edit, Image, Eye, EyeOff, Video,
} from "lucide-react";

import { api } from "../services/api";
import { APP_NAME, CATEGORIES, VILLAGE_NAME } from "../config/app";
import { formatThaiDateTime, getPriorityMeta, getStatusLabel } from "../core/incidentPresentation";
import { isCitizenRole, isTaoRole, isVillageAdminRole } from "../core/roles";
import { clamp, formatHours, getHoursDiff, latLngToPercent, percentToLatLng } from "../utils/village";
import StatusBadge from "../shared/StatusBadge";
import DateRangePicker from "../shared/DateRangePicker";
import CitizenFeedback from "../features/citizen/CitizenFeedback";
import AdminReports from "../features/reports/AdminReports";
import { AppLogo, USE_MOCK_DATA, getNotificationTargetTab, normalizeIncident, normalizeNews, normalizeUser } from "../app/runtime";

import { taoMenu } from "../features/tao/menu";
import { villageMenu } from "../features/village/menu";
import { citizenMenu } from "../features/citizen/menu";
export function Sidebar({
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

export function Topbar({
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

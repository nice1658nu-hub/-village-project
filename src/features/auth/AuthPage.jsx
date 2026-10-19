import React, { useEffect, useRef, useState } from "react";
import {
  Home, FileText, AlertTriangle, PieChart, Users, Settings, LogOut,
  MapPin, Camera, CheckCircle, Clock, Search, Plus, Trash2, Menu, X,
  Calendar, Bell, Facebook, Phone, MessageCircle, ChevronRight, Upload,
  Map, Info, Edit, Image, Eye, EyeOff, Video,
} from "lucide-react";

import { api } from "../../services/api";
import { APP_NAME, CATEGORIES, VILLAGE_NAME } from "../../config/app";
import { formatThaiDateTime, getPriorityMeta, getStatusLabel } from "../../core/incidentPresentation";
import { isCitizenRole, isTaoRole, isVillageAdminRole } from "../../core/roles";
import { clamp, formatHours, getHoursDiff, latLngToPercent, percentToLatLng } from "../../utils/village";
import StatusBadge from "../../shared/StatusBadge";
import DateRangePicker from "../../shared/DateRangePicker";
import CitizenFeedback from "../citizen/CitizenFeedback";
import AdminReports from "../reports/AdminReports";
import { AppLogo, USE_MOCK_DATA, getNotificationTargetTab, normalizeIncident, normalizeNews, normalizeUser } from "../../app/runtime";
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

export default function AuthPage({ villages, onLogin, onRegister, onBack, initialMode = "login" }) {
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

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

import { MapErrorBoundary, RealVillageMapPicker } from "../maps/IncidentMaps";
import NewsModal from "../../shared/NewsModal";
export default function UserDashboard({
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

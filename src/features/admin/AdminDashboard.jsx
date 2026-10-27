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

import AdminIncidentModal from "./AdminIncidentModal";
import VillageOverviewDashboard from "../village/VillageOverviewDashboard";
export default function AdminDashboard({
  activeTab,
  setActiveTab,
  news,
  setNews,
  incidents,
  setIncidents,
  setNotifications,
  users,
  setUsers,
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
      id: "incidents",
      label: "แจ้งเหตุ",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
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
      const data = villageMode
        ? await api.cancelVillageIncident(id, cleanReason)
        : await api.updateIncidentStatus(id, {
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
      {/* VIEW: REPORTS */}
      {activeTab === "reports" && (
        <AdminReports incidents={incidents} users={users} />
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
                  และส่งเรื่องที่ตรวจสอบแล้วให้ อบต.
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

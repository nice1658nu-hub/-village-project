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

import DecisionAnalyticsCenter from "../analytics/DecisionAnalyticsCenter";
import { IncidentLocationPanel } from "../maps/IncidentMaps";
export default function TaoDashboard({
  activeTab,
  setActiveTab,
  incidents,
  setIncidents,
  villages,
  users,
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
  const forwarded = incidents.filter(
    (item) => item.requiresTao,
  );
  const activeForwarded = forwarded.filter(
    (item) => !["resolved", "cancelled"].includes(item.status),
  );
  const newForwarded = forwarded.filter((item) => item.status === "pending");
  const overdueForwarded = activeForwarded.filter(
    (item) => item.dueAt && new Date(item.dueAt) < new Date(),
  );
  const resolvedForwarded = forwarded.filter((item) => item.status === "resolved");
  const inTaoDateRange = (item) => {
    const value = item.forwardedToTaoAt || item.date;
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
    const sent = rows.filter((item) => item.requiresTao);
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
      {activeTab === "tao_forwarded" && (
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
            {(              <div className="mt-5 space-y-4">
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

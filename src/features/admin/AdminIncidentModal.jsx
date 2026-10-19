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

import { IncidentLocationPanel } from "../maps/IncidentMaps";
export default function AdminIncidentModal({
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

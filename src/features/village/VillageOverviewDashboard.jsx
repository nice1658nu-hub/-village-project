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
export default function VillageOverviewDashboard({
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

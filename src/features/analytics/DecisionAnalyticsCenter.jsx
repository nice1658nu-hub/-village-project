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

import { SpatialAnalyticsMap } from "../maps/IncidentMaps";
export default function DecisionAnalyticsCenter({
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

import React, { useEffect, useState } from "react";
import writeExcelFile from "write-excel-file/browser";
import { Download, FileText, Filter } from "lucide-react";
import { CATEGORIES, VILLAGE_NAME } from "../../config/app";
import {
  formatThaiDateTime,
  getPriorityMeta,
  getStatusLabel,
} from "../../core/incidentPresentation";
import DateRangePicker from "../../shared/DateRangePicker";
import { formatHours, getHoursDiff } from "../../utils/village";

export default function AdminReports({ incidents }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(25);
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
  const reportTotalPages = Math.max(1, Math.ceil(filtered.length / reportPageSize));
  const safeReportPage = Math.min(reportPage, reportTotalPages);
  const visibleReportRows = filtered.slice(
    (safeReportPage - 1) * reportPageSize,
    safeReportPage * reportPageSize,
  );

  useEffect(() => {
    setReportPage(1);
  }, [dateFrom, dateTo, statusFilter, categoryFilter, reportPageSize]);

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
      const border = { borderColor: "#CBD5E1", borderStyle: "thin" };
      const titleCell = {
        value: "รายงานสรุปการแจ้งเหตุ",
        columnSpan: 7,
        fontSize: 18,
        fontWeight: "bold",
        textColor: "#172554",
        height: 30,
      };
      const subtitleCell = {
        value: `${VILLAGE_NAME} · จัดทำเมื่อ ${generatedAt} น.`,
        columnSpan: 7,
        fontWeight: "bold",
        textColor: "#475569",
        height: 24,
      };
      const summaryCell = (label, value, color) => ({
        value: `${value}\n${label}`,
        fontWeight: "bold",
        fontSize: 12,
        textColor: color,
        backgroundColor: "#F8FAFC",
        align: "center",
        alignVertical: "center",
        wrap: true,
        height: 42,
        ...border,
      });
      const headerCell = (value) => ({
        value,
        fontWeight: "bold",
        textColor: "#FFFFFF",
        backgroundColor: "#172554",
        align: "center",
        alignVertical: "center",
        height: 28,
        ...border,
      });
      const bodyCell = (value, options = {}) => ({
        value,
        alignVertical: "center",
        wrap: true,
        height: 34,
        ...border,
        ...options,
      });
      const sheetData = [
        [titleCell, null, null, null, null, null, null],
        [subtitleCell, null, null, null, null, null, null],
        [
          summaryCell("ทั้งหมด", filtered.length, "#0F172A"),
          summaryCell("รอตรวจสอบ", pendingCount, "#C2410C"),
          summaryCell("กำลังดำเนินการ", activeCount, "#1D4ED8"),
          summaryCell("เสร็จสิ้น", resolvedCount, "#15803D"),
          { value: "", columnSpan: 3 }, null, null,
        ],
        [{
          value: `ระยะเวลาแก้ไขเฉลี่ย: ${avgResolveHours == null ? "ยังไม่มีข้อมูล" : formatHours(avgResolveHours)}`,
          columnSpan: 7,
          fontWeight: "bold",
          backgroundColor: "#EFF6FF",
          textColor: "#172554",
          height: 26,
        }, null, null, null, null, null, null],
        ["เลขที่", "วันที่แจ้ง", "เรื่อง / สถานที่", "หมวดหมู่", "สถานะ", "ความสำคัญ", "วันที่เสร็จ"].map(headerCell),
        ...filtered.map((item, index) => {
          const fill = index % 2 ? "#F8FAFC" : "#FFFFFF";
          const createdAt = item.date ? new Date(item.date) : null;
          const resolvedAt = item.resolvedAt ? new Date(item.resolvedAt) : null;
          const createdAtIsValid = createdAt && !Number.isNaN(createdAt.getTime());
          const resolvedAtIsValid = resolvedAt && !Number.isNaN(resolvedAt.getTime());
          return [
            bodyCell(`#${item.id}`, { align: "center", backgroundColor: fill }),
            bodyCell(createdAtIsValid ? createdAt : "-", {
              type: createdAtIsValid ? Date : String,
              ...(createdAtIsValid ? { format: "dd/mm/yyyy hh:mm" } : {}),
              align: "center",
              backgroundColor: fill,
            }),
            bodyCell(`${item.title || "-"}\n${item.location || "-"}`, {
              fontWeight: "bold",
              backgroundColor: fill,
            }),
            bodyCell(item.category || "-", { backgroundColor: fill }),
            bodyCell(getStatusLabel(item.status), { align: "center", backgroundColor: fill }),
            bodyCell(getPriorityMeta(item.priority).label, { align: "center", backgroundColor: fill }),
            bodyCell(resolvedAtIsValid ? resolvedAt : "-", {
              type: resolvedAtIsValid ? Date : String,
              ...(resolvedAtIsValid ? { format: "dd/mm/yyyy hh:mm" } : {}),
              align: "center",
              backgroundColor: fill,
            }),
          ];
        }),
      ];
      await writeExcelFile(sheetData, {
        sheet: "รายงานการแจ้งเหตุ",
        columns: [
          { width: 12 },
          { width: 22 },
          { width: 34 },
          { width: 28 },
          { width: 20 },
          { width: 16 },
          { width: 22 },
        ],
        stickyRowsCount: 5,
        orientation: "landscape",
        showGridLines: false,
      }, {
        fontFamily: "Tahoma",
        fontSize: 11,
      }).toFile(`smart-village-report-${fileDate}.xlsx`);
    } catch (error) {
      console.error(error);
      alert("สร้างไฟล์ Excel ไม่สำเร็จ");
    } finally {
      setExporting(null);
    }
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
              กรองข้อมูลและดาวน์โหลดรายงานการแจ้งเหตุเป็นไฟล์ Excel
            </p>
          </div>
          <div className="w-full md:w-auto">
            <button
              disabled={!!exporting}
              onClick={exportExcel}
              className="w-full whitespace-nowrap rounded-xl bg-emerald-600 px-6 py-3 text-sm sm:text-base font-bold hover:bg-emerald-500 disabled:opacity-50"
            >
              <Download className="mr-2 inline h-5 w-5" />
              {exporting === "excel" ? "กำลังสร้าง..." : "ดาวน์โหลด Excel"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 md:p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 font-bold text-slate-800">
          <Filter className="h-5 w-5 text-blue-600" /> ตัวกรองรายงาน
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            labelClassName="text-xs text-slate-500"
            onChange={(nextFrom, nextTo) => {
              setDateFrom(nextFrom);
              setDateTo(nextTo);
            }}
          />
          <label className="text-xs font-bold text-slate-500">
            สถานะ
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-700"
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
              className="mt-1 h-12 w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-700"
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
              {visibleReportRows.map((item, index) => (
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
        {filtered.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span>
                แสดง <b className="text-slate-900">{(safeReportPage - 1) * reportPageSize + 1}-{Math.min(safeReportPage * reportPageSize, filtered.length)}</b> จาก <b className="text-slate-900">{filtered.length}</b> รายการ
              </span>
              <label className="flex items-center gap-2">
                ต่อหน้า
                <select
                  value={reportPageSize}
                  onChange={(event) => setReportPageSize(Number(event.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-bold text-slate-800"
                >
                  {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <button
                type="button"
                disabled={safeReportPage === 1}
                onClick={() => setReportPage((page) => Math.max(1, page - 1))}
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ก่อนหน้า
              </button>
              <span className="min-w-24 text-center text-sm font-bold text-slate-700">หน้า {safeReportPage} / {reportTotalPages}</span>
              <button
                type="button"
                disabled={safeReportPage === reportTotalPages}
                onClick={() => setReportPage((page) => Math.min(reportTotalPages, page + 1))}
                className="min-h-10 rounded-lg bg-blue-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                ถัดไป
              </button>
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

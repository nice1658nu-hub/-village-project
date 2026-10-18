import { useState } from "react";
import { Calendar } from "lucide-react";

export default function DateRangePicker({
  from,
  to,
  onChange,
  label = "วันที่ / ช่วงวันที่",
  labelClassName = "text-sm text-inherit",
}) {
  const [open, setOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const initialDate = from ? new Date(`${from}T12:00:00`) : new Date();
  const [viewMonth, setViewMonth] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const toKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const fromDate = from ? new Date(`${from}T00:00:00`) : null;
  const toDate = to ? new Date(`${to}T23:59:59`) : null;
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate();
  const firstDay = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth(),
    1,
  ).getDay();

  const selectDay = (day) => {
    const selected = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth(),
      day,
    );
    const key = toKey(selected);
    if (!selectingEnd || !from) {
      onChange(key, key);
      setSelectingEnd(true);
      return;
    }
    if (selected < fromDate) onChange(key, from);
    else onChange(from, key);
    setSelectingEnd(false);
  };

  const displayDate = (value) =>
    value
      ? new Date(`${value}T12:00:00`).toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";

  return (
    <div className="relative w-full">
      <label className={`mb-1 block font-bold ${labelClassName}`}>{label}</label>
      <button
        type="button"
        onClick={() => {
          setSelectingEnd(false);
          setOpen((value) => !value);
        }}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-left text-sm font-bold text-slate-800 shadow-sm"
      >
        <span className={from ? "text-slate-900" : "text-slate-400"}>
          {from
            ? to && to !== from
              ? `${displayDate(from)} – ${displayDate(to)}`
              : displayDate(from)
            : "เลือกวันที่หรือช่วงวันที่"}
        </span>
        <Calendar className="h-5 w-5 shrink-0 text-slate-500" />
      </button>
      {open && (
        <div className="absolute right-0 z-[90] mt-2 w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl">‹</button>
            <div className="font-black">{viewMonth.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</div>
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl">›</button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400">
            {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => <div key={day} className="py-2">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: firstDay }).map((_, index) => <span key={`blank-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
              const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
              const key = toKey(date);
              const selected = key === from || key === to;
              const inRange = fromDate && toDate && date >= fromDate && date <= toDate;
              return (
                <button key={day} type="button" onClick={() => selectDay(day)} className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${selected ? "bg-blue-600 text-white" : inRange ? "bg-blue-100 text-blue-800" : "hover:bg-slate-100"}`}>
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <button type="button" onClick={() => { onChange("", ""); setSelectingEnd(false); }} className="rounded-lg px-3 py-2 text-sm font-bold text-red-600">ล้างวันที่</button>
            <button type="button" onClick={() => { setSelectingEnd(false); setOpen(false); }} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white">ตกลง</button>
          </div>
        </div>
      )}
    </div>
  );
}

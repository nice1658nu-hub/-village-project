export default function StatusBadge({ status, size = "sm" }) {
  const classes = size === "lg" ? "px-4 py-2 text-sm" : "px-3 py-1 text-xs";
  const styles = {
    pending: ["bg-yellow-100 text-yellow-800 border-yellow-300", "bg-yellow-500", "รอรับเรื่อง"],
    assigned: ["bg-indigo-100 text-indigo-800 border-indigo-300", "bg-indigo-500", "มอบหมายแล้ว"],
    in_progress: ["bg-blue-100 text-blue-800 border-blue-300", "bg-blue-500 animate-pulse", "กำลังดำเนินการ"],
    waiting_review: ["bg-amber-100 text-amber-800 border-amber-300", "bg-amber-500", "รอตรวจรับ"],
    revision_requested: ["bg-red-100 text-red-800 border-red-300", "bg-red-500", "ส่งกลับแก้ไข"],
    resolved: ["bg-green-100 text-green-800 border-green-300", "bg-green-500", "แก้ไขแล้ว"],
    cancelled: ["bg-slate-100 text-slate-700 border-slate-300", "bg-slate-500", "ยุติแล้ว"],
  };
  const style = styles[status];
  if (!style) return null;
  return (
    <span className={`${style[0]} ${classes} inline-flex items-center gap-1 rounded-full border font-bold shadow-sm`}>
      <span className={`h-2 w-2 rounded-full ${style[1]}`} /> {style[2]}
    </span>
  );
}

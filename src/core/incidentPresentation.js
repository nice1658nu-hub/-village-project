export const projectStatusLabels = {
  proposed: "เสนอให้ อบต.พิจารณา",
  approved: "อนุมัติโครงการแล้ว",
  planned: "เตรียมดำเนินการ",
  in_progress: "กำลังดำเนินโครงการ",
  waiting_review: "โครงการรอตรวจรับ",
  completed: "ปิดโครงการแล้ว",
};

export const formatThaiDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export const getStatusLabel = (status) =>
  ({
    pending: "รอตรวจสอบ",
    assigned: "มอบหมายแล้ว",
    in_progress: "กำลังดำเนินการ",
    waiting_review: "รอตรวจรับ",
    revision_requested: "ส่งกลับแก้ไข",
    resolved: "เสร็จสิ้น",
    cancelled: "ยกเลิก",
  })[status] || status;

export const getPriorityMeta = (priority = 1) =>
  ({
    1: { label: "ปกติ", color: "bg-slate-100 text-slate-700 border-slate-200" },
    2: { label: "สำคัญ", color: "bg-blue-100 text-blue-700 border-blue-200" },
    3: {
      label: "เร่งด่วน",
      color: "bg-orange-100 text-orange-700 border-orange-200",
    },
    4: { label: "ฉุกเฉิน", color: "bg-red-100 text-red-700 border-red-200" },
  })[Number(priority)] || {
    label: "ปกติ",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  };

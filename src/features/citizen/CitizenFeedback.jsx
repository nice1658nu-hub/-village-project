import { useState } from "react";
import { api } from "../../services/api";

export default function CitizenFeedback({ incident, onSaved }) {
  const [rating, setRating] = useState(incident.feedback?.rating || 0);
  const [comment, setComment] = useState(incident.feedback?.comment || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!rating) return alert("กรุณาเลือกคะแนน 1–5 ดาว");
    setSaving(true);
    try {
      const data = await api.saveIncidentFeedback(incident.id, {
        decision: "confirm",
        rating,
        comment: comment.trim() || null,
      });
      onSaved(data.feedback, data.incident);
      alert("บันทึกการประเมินแล้ว");
    } catch (error) {
      alert(error?.message || "บันทึกการประเมินไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="font-bold text-amber-950">ประเมินผลหลังแก้ไข</div>
      <div className="mt-3 flex gap-1" aria-label="คะแนนความพึงพอใจ">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" onClick={() => setRating(value)} className={`text-2xl ${value <= rating ? "text-amber-500" : "text-slate-300"}`} aria-label={`${value} ดาว`}>
            ★
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={(event) => setComment(event.target.value)} className="mt-2 h-16 w-full resize-none rounded-lg border bg-white p-2 text-sm" placeholder="ความคิดเห็นเพิ่มเติม (ไม่บังคับ)" />
      <button type="button" disabled={saving} onClick={save} className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        {saving ? "กำลังบันทึก..." : "ส่งการประเมิน"}
      </button>
    </div>
  );
}

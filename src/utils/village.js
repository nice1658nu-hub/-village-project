import { MAP_BOUNDS } from '../config/app';

export const getFormattedDate = () => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return new Date().toLocaleDateString('th-TH', options);
};

export const getHoursDiff = (start, end) => {
  if (!start || !end) return null;
  return Math.max(0, (new Date(end) - new Date(start)) / (1000 * 60 * 60));
};

export const formatHours = (hours) => {
  if (hours == null || Number.isNaN(hours)) return '-';
  if (hours < 1) return `${Math.round(hours * 60)} นาที`;
  if (hours < 24) return `${hours.toFixed(1)} ชม.`;
  return `${(hours / 24).toFixed(1)} วัน`;
};

export const getHeatLevel = (count) => {
  if (count >= 3) return { label: 'รุนแรง', color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200' };
  if (count === 2) return { label: 'เฝ้าระวัง', color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' };
  return { label: 'ปกติ', color: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' };
};

export const getSentimentScore = (text = '') => {
  const normalized = text.toLowerCase();
  const criticalKeywords = ['ด่วน', 'อันตราย', 'เร่งด่วน', 'เสี่ยง', 'กังวล', 'เดือดร้อน'];
  const mediumKeywords = ['รบกวน', 'มืดมาก', 'ลำบาก', 'ซ้ำ', 'กะพริบ', 'หย่อน'];

  let score = 1;
  criticalKeywords.forEach(keyword => {
    if (normalized.includes(keyword)) score += 2;
  });
  mediumKeywords.forEach(keyword => {
    if (normalized.includes(keyword)) score += 1;
  });

  return Math.min(score, 5);
};

export const getSentimentMeta = (score) => {
  if (score >= 5) return { label: 'วิกฤต', text: 'text-red-700', bg: 'bg-red-50 border-red-200' };
  if (score >= 3) return { label: 'ตึงเครียด', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' };
  return { label: 'ทั่วไป', text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
};

export const getCredibilityMeta = (score) => {
  if (score >= 85) return { label: 'สูง', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 70) return { label: 'ปานกลาง', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  return { label: 'ต้องตรวจสอบเพิ่ม', text: 'text-red-700', bg: 'bg-red-50 border-red-200' };
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const latLngToPercent = (lat, lng) => {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * 100;
  const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100;
  return {
    x: clamp(x, 4, 96),
    y: clamp(y, 6, 94),
  };
};

export const percentToLatLng = (xPercent, yPercent) => {
  const lng = MAP_BOUNDS.minLng + ((xPercent / 100) * (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng));
  const lat = MAP_BOUNDS.maxLat - ((yPercent / 100) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat));
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
};

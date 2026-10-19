import React, { useEffect, useRef, useState } from "react";
import {
  Home, FileText, AlertTriangle, PieChart, Users, Settings, LogOut,
  MapPin, Camera, CheckCircle, Clock, Search, Plus, Trash2, Menu, X,
  Calendar, Bell, Facebook, Phone, MessageCircle, ChevronRight, Upload,
  Map, Info, Edit, Image, Eye, EyeOff, Video,
} from "lucide-react";

import { API_BASE_URL } from "../services/api";
import { isCitizenRole, isTaoRole, isVillageAdminRole } from "../core/roles";

export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === "true";
export const APP_LOGO_URL = "/app-logo-matong.png";

export function AppLogo({ className = "" }) {
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-full ${className}`}
      aria-hidden="true"
    >
      <img
        src={APP_LOGO_URL}
        alt=""
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export const normalizeUser = (user) => ({
  ...user,
  accountStatus: user.accountStatus ?? user.account_status,
  villageId: user.villageId ?? user.village_id,
  villageName: user.villageName ?? user.village?.name,
  villageMoo: user.villageMoo ?? user.village?.moo,
});
export const normalizeMediaUrl = (value) => {
  if (!value || /^(data:|blob:)/i.test(value)) return value;
  try {
    // Older uploads could contain two absolute URLs joined together, for
    // example https://api.examplehttps://api.example/storage/file.jpg.
    // Keep the second (real storage) URL so existing images work again.
    const duplicatedAbsoluteUrl = String(value).match(/^https?:\/\/[^/]+?(https?:\/\/.+)$/i);
    const cleanValue = duplicatedAbsoluteUrl?.[1] || value;
    const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
    const mediaUrl = new URL(cleanValue, `${apiOrigin}/`);
    if (window.location.protocol === "https:" && mediaUrl.protocol === "http:") {
      mediaUrl.protocol = "https:";
    }
    if (mediaUrl.pathname.startsWith("/storage/")) {
      const mediaPath = mediaUrl.pathname.slice("/storage/".length);
      return `${apiOrigin}/api/media/${mediaPath}`;
    }
    return mediaUrl.href;
  } catch {
    return value;
  }
};
export const normalizeNews = (item) => ({
  ...item,
  image: normalizeMediaUrl(item.image),
  villageId: item.villageId ?? item.village_id,
  date: item.date ?? item.published_at ?? item.created_at,
  displaySection:
    item.displaySection ??
    item.display_section ??
    (item.video_url ? "video" : "news"),
});
export const normalizeIncident = (item) => ({
  ...item,
  image: normalizeMediaUrl(item.image),
  userId: item.userId ?? item.user_id,
  userName: item.userName ?? item.user?.name,
  userPhone: item.userPhone ?? item.user?.phone,
  resolvedImage: normalizeMediaUrl(item.resolvedImage ?? item.resolved_image),
  firstResponseAt: item.firstResponseAt ?? item.first_response_at,
  resolvedAt: item.resolvedAt ?? item.resolved_at,
  assignedTo: item.assignedTo ?? item.assigned_to,
  assignedToName: item.assignedToName ?? item.assignee?.name,
  assignedAt: item.assignedAt ?? item.assigned_at,
  department: item.department ?? null,
  dueAt: item.dueAt ?? item.due_at,
  resolutionSummary: item.resolutionSummary ?? item.resolution_summary,
  citizenConfirmedAt: item.citizenConfirmedAt ?? item.citizen_confirmed_at,
  reopenedAt: item.reopenedAt ?? item.reopened_at,
  referenceNo: item.referenceNo ?? item.reference_no,
  villageId: item.villageId ?? item.village_id,
  villageName:
    item.villageName ?? item.village?.name ?? item.user?.village?.name,
  villageMoo: item.villageMoo ?? item.village?.moo ?? item.user?.village?.moo,
  requiresTao: item.requiresTao ?? item.requires_tao,
  forwardedToTaoAt: item.forwardedToTaoAt ?? item.forwarded_to_tao_at,
  feedback: item.feedback ?? null,
  supporterCount: Number(item.supporterCount ?? item.supporters_count ?? 0),
  supportedByMe: Boolean(item.supportedByMe ?? item.supported_by_me),
  isOwn: Boolean(item.isOwn ?? item.is_own),
  submittedForReviewAt:
    item.submittedForReviewAt ?? item.submitted_for_review_at,
  verifiedAt: item.verifiedAt ?? item.verified_at,
  updates: (item.updates ?? []).map((update) => ({
    ...update,
    image: normalizeMediaUrl(update.image),
  })),
  histories: item.histories ?? [],
  date: item.date ?? item.created_at,
  lat: item.lat == null ? null : Number(item.lat),
  lng: item.lng == null ? null : Number(item.lng),
});
export const notificationStatusLabels = {
  pending: "รับเรื่องแล้ว",
  assigned: "รับเรื่องแล้ว",
  in_progress: "กำลังดำเนินการ",
  waiting_review: "ดำเนินการเสร็จ รอตรวจรับ",
  revision_requested: "กำลังแก้ไขเพิ่มเติม",
  resolved: "แก้ไขเสร็จแล้ว",
  cancelled: "ยุติเรื่องแล้ว",
};
export const normalizeNotification = (item) => {
  let title = item.title;
  let desc = item.desc ?? item.description;

  // Convert legacy generic notifications such as "ถนนเสีย: resolved"
  // so stored notifications also read naturally without changing the database.
  if (
    item.type === "incident_status" &&
    item.title === "สถานะเรื่องแจ้งเหตุเปลี่ยนแปลง"
  ) {
    const legacyMatch = String(desc || "").match(
      /^(.*):\s*(pending|assigned|in_progress|waiting_review|revision_requested|resolved|cancelled)$/,
    );
    if (legacyMatch) {
      title = notificationStatusLabels[legacyMatch[2]] || item.title;
      desc = legacyMatch[1];
    }
  }

  return {
    ...item,
    title,
    desc,
    isRead: item.isRead ?? Boolean(item.read_at),
    time: item.time ?? item.created_at,
  };
};

export const getNotificationTargetTab = (role, notification = {}) => {
  const type = notification.type || notification.data?.type || "";

  if (isTaoRole(role)) {
    if (type.includes("incident") || ["assignment", "revision", "review"].includes(type))
      return "tao_forwarded";
    return "tao_overview";
  }

  if (isVillageAdminRole(role)) {
    if (type === "user_registration") return "users";
    if (type === "news") return "news";
    if (type.includes("incident") || ["assignment", "revision", "review"].includes(type))
      return "incidents";
    return "stats";
  }

  if (type === "news") return "news";
  if (type.includes("incident") || ["assignment", "revision", "review"].includes(type))
    return "history";
  return "news";
};

export const ACTIVE_TAB_KEY = "smart_village_active_tab";
export const defaultTabForRole = (role) =>
  isTaoRole(role) ? "tao_overview" : isVillageAdminRole(role) ? "stats" : "news";
export const allowedTabsForRole = (role) => {
  if (isTaoRole(role))
    return ["tao_overview", "tao_forwarded", "tao_villages", "tao_reports", "tao_content"];
  if (isVillageAdminRole(role))
    return ["stats", "incidents", "news", "users", "reports"];
  return ["news", "village_incidents", "report", "history"];
};
export const restoredTabForRole = (role) => {
  const saved = sessionStorage.getItem(ACTIVE_TAB_KEY);
  return allowedTabsForRole(role).includes(saved) ? saved : defaultTabForRole(role);
};

// --- MAIN APP COMPONENT ---

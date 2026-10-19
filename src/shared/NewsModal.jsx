import React, { useEffect, useRef, useState } from "react";
import {
  Home, FileText, AlertTriangle, PieChart, Users, Settings, LogOut,
  MapPin, Camera, CheckCircle, Clock, Search, Plus, Trash2, Menu, X,
  Calendar, Bell, Facebook, Phone, MessageCircle, ChevronRight, Upload,
  Map, Info, Edit, Image, Eye, EyeOff, Video,
} from "lucide-react";

import { formatThaiDateTime } from "../core/incidentPresentation";
export default function NewsModal({ news, onClose, onPrevious, onNext }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fadeIn relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100/80 backdrop-blur rounded-full hover:bg-gray-200 transition z-10"
        >
          <X className="w-6 h-6 text-gray-800" />
        </button>

        <img
          src={news.image}
          alt="news"
          className="max-h-[65vh] w-full rounded-t-3xl bg-slate-100 object-contain"
        />

        {onPrevious && (
          <button
            type="button"
            onClick={onPrevious}
            aria-label="ข่าวก่อนหน้า"
            className="absolute left-3 top-1/3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-slate-950/70 text-white shadow-lg backdrop-blur transition hover:bg-slate-950 sm:left-5 sm:h-14 sm:w-14"
          >
            <ChevronRight className="h-7 w-7 rotate-180" />
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="ข่าวถัดไป"
            className="absolute right-3 top-1/3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-slate-950/70 text-white shadow-lg backdrop-blur transition hover:bg-slate-950 sm:right-5 sm:h-14 sm:w-14"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}

        <div className="p-8">
          <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold mb-4 border border-blue-100">
            ประกาศเมื่อ: {formatThaiDateTime(news.date)} น.
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            {news.title}
          </h2>
          <div className="text-gray-700 leading-loose text-lg whitespace-pre-wrap">
            {news.content}
          </div>

          <div className="mt-10 pt-6 border-t border-gray-100 flex justify-center">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

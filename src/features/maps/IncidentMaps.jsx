import React, { useState } from "react";
import { CircleMarker, LayersControl, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import { api } from "../../services/api";
import { VILLAGE_NAME } from "../../config/app";
import { getStatusLabel } from "../../core/incidentPresentation";
import { clamp, latLngToPercent, percentToLatLng } from "../../utils/village";
const VILLAGE_MAP_CENTER = [17.07948, 100.1799];
const VILLAGE_MAP_BOUNDS = [
  [17.02, 100.11],
  [17.16, 100.24],
];

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800">
          <div className="font-bold">ไม่สามารถเปิดแผนที่จริงได้</div>
          <div className="mt-2 text-sm break-all">
            {this.state.error.message}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MapClickHandler({ onSelectPoint }) {
  useMapEvents({
    click(event) {
      onSelectPoint({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });
  return null;
}

function CurrentLocationButton({ onSelectPoint }) {
  const map = useMap();

  const locate = (event) => {
    event.stopPropagation();
    if (!navigator.geolocation) {
      alert("อุปกรณ์นี้ไม่รองรับการค้นหาตำแหน่ง");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = {
          lat: Number(coords.latitude.toFixed(6)),
          lng: Number(coords.longitude.toFixed(6)),
        };
        map.flyTo([point.lat, point.lng], 18);
        onSelectPoint(point);
      },
      () =>
        alert(
          "ไม่สามารถอ่านตำแหน่งได้ กรุณาอนุญาต Location หรือปักหมุดด้วยตนเอง",
        ),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <button
      type="button"
      onClick={locate}
      className="absolute right-3 bottom-6 z-[1000] rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow-lg border border-blue-200 hover:bg-blue-50"
    >
      ใช้ตำแหน่งปัจจุบัน
    </button>
  );
}

function RealVillageMapPicker({ incidents, selectedPoint, onSelectPoint }) {
  return (
    <div className="relative isolate z-0 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 bg-slate-50">
        <div className="font-bold text-gray-900">
          แผนที่ตำแหน่งเหตุใน{VILLAGE_NAME}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          เลื่อนหรือซูมแผนที่ แล้วคลิกจุดเกิดเหตุเพื่อบันทึกพิกัด GPS
        </div>
      </div>
      <MapContainer
        center={VILLAGE_MAP_CENTER}
        zoom={15}
        minZoom={14}
        maxBounds={VILLAGE_MAP_BOUNDS}
        maxBoundsViscosity={1}
        scrollWheelZoom
        className="relative z-0 h-64 w-full cursor-crosshair sm:h-72"
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer name="แผนที่ถนน">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked name="ภาพถ่ายดาวเทียม">
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name="ชื่อถนนและสถานที่">
            <TileLayer
              attribution="Labels &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.Overlay>
        </LayersControl>
        <MapClickHandler onSelectPoint={onSelectPoint} />
        <CurrentLocationButton onSelectPoint={onSelectPoint} />
        {incidents
          .filter((inc) => inc.lat != null && inc.lng != null)
          .map((inc) => (
            <CircleMarker
              key={inc.id}
              center={[inc.lat, inc.lng]}
              radius={5}
              pathOptions={{ color: "#475569", fillOpacity: 0.65 }}
            >
              <Popup>{inc.title}</Popup>
            </CircleMarker>
          ))}
        {selectedPoint && (
          <CircleMarker
            center={[selectedPoint.lat, selectedPoint.lng]}
            radius={9}
            pathOptions={{
              color: "#dc2626",
              fillColor: "#ef4444",
              fillOpacity: 0.9,
            }}
          >
            <Popup>ตำแหน่งเหตุที่เลือก</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}

export function VillageMapPicker({ incidents, selectedPoint, onSelectPoint }) {
  const handleMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    onSelectPoint(
      percentToLatLng(clamp(xPercent, 4, 96), clamp(yPercent, 6, 94)),
    );
  };

  return (
    <div className="rounded-3xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 bg-slate-50">
        <div className="font-bold text-gray-900">
          แผนที่ตำแหน่งเหตุใน{VILLAGE_NAME}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          คลิกบนแผนที่เพื่อปักหมุดตำแหน่งเกิดเหตุ และระบบจะเก็บพิกัด GPS
          ให้ทันที
        </div>
      </div>
      <div
        className="relative h-72 cursor-crosshair overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_32%),linear-gradient(135deg,_#eff6ff_0%,_#dbeafe_48%,_#e0f2fe_100%)]"
        onClick={handleMapClick}
      >
        <div className="absolute inset-0 opacity-50">
          <div className="absolute inset-x-0 top-[24%] h-px bg-sky-200" />
          <div className="absolute inset-x-0 top-[54%] h-px bg-sky-200" />
          <div className="absolute inset-y-0 left-[32%] w-px bg-sky-200" />
          <div className="absolute inset-y-0 left-[68%] w-px bg-sky-200" />
          <div className="absolute left-[12%] top-[22%] h-24 w-24 rounded-full bg-blue-200/35 blur-2xl" />
          <div className="absolute right-[10%] bottom-[14%] h-28 w-28 rounded-full bg-cyan-200/40 blur-2xl" />
        </div>

        <div className="absolute left-[18%] top-[18%] rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
          ทางเข้าหมู่บ้าน
        </div>
        <div className="absolute left-[60%] top-[26%] rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
          ซอย 2
        </div>
        <div className="absolute left-[56%] top-[58%] rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
          ซอย 5
        </div>
        <div className="absolute left-[24%] top-[68%] rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
          สวนสาธารณะ
        </div>

        {incidents.map((inc) => {
          const pos = latLngToPercent(inc.lat, inc.lng);
          return (
            <div
              key={inc.id}
              className="absolute -translate-x-1/2 -translate-y-full"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className="h-3 w-3 rounded-full border-2 border-white bg-slate-500 shadow-md opacity-70" />
            </div>
          );
        })}

        {selectedPoint &&
          (() => {
            const pos = latLngToPercent(selectedPoint.lat, selectedPoint.lng);
            return (
              <div
                className="absolute -translate-x-1/2 -translate-y-full"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <div className="relative">
                  <MapPin
                    className="w-8 h-8 text-red-600 drop-shadow-lg"
                    fill="currentColor"
                  />
                  <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-ping" />
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}

function FitIncidentBounds({ incidents }) {
  const map = useMap();
  const coordinateKey = incidents
    .map((item) => `${item.id}:${item.lat},${item.lng}`)
    .join("|");

  useEffect(() => {
    const points = incidents
      .filter(
        (item) =>
          Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)),
      )
      .map((item) => [Number(item.lat), Number(item.lng)]);
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 17);
      return;
    }
    map.fitBounds(points, { padding: [36, 36], maxZoom: 17 });
  }, [coordinateKey, incidents, map]);

  return null;
}

export function SpatialAnalyticsMap({ incidents, lockToTao = false }) {
  const validIncidents = incidents.filter(
    (item) =>
      Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)),
  );
  const densityAt = (incident) =>
    validIncidents.filter(
      (item) =>
        Math.abs(Number(item.lat) - Number(incident.lat)) <= 0.001 &&
        Math.abs(Number(item.lng) - Number(incident.lng)) <= 0.001,
    ).length;

  return (
    <div className="relative isolate z-0 h-72 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:h-80">
      <MapContainer
        center={VILLAGE_MAP_CENTER}
        zoom={lockToTao ? 13 : 14}
        maxBounds={lockToTao ? VILLAGE_MAP_BOUNDS : undefined}
        maxBoundsViscosity={lockToTao ? 1 : 0}
        scrollWheelZoom
        className="relative z-0 h-full w-full"
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="แผนที่ถนนจริง">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="ภาพถ่ายดาวเทียม">
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name="ชื่อถนนและสถานที่">
            <TileLayer
              attribution="Labels &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.Overlay>
        </LayersControl>
        {!lockToTao && <FitIncidentBounds incidents={validIncidents} />}
        {validIncidents.map((incident) => {
          const density = densityAt(incident);
          const isClosed = ["resolved", "cancelled"].includes(incident.status);
          const color = isClosed ? "#059669" : density >= 3 ? "#dc2626" : density >= 2 ? "#f97316" : "#2563eb";
          return (
            <React.Fragment key={incident.id}>
              <CircleMarker
                center={[Number(incident.lat), Number(incident.lng)]}
                radius={Math.min(28, 12 + density * 4)}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.16, weight: 1 }}
              />
              <CircleMarker
                center={[Number(incident.lat), Number(incident.lng)]}
                radius={7}
                pathOptions={{ color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 1 }}
              >
                <Popup>
                  <div className="min-w-48 font-sans">
                    <div className="font-bold text-slate-900">{incident.title}</div>
                    <div className="mt-1 text-sm">{incident.location}</div>
                    <div className="mt-1 text-xs text-slate-500">{incident.category} · {getStatusLabel(incident.status)}</div>
                    <div className="mt-2 text-xs font-bold" style={{ color }}>
                      บริเวณใกล้เคียงมี {density} เรื่อง
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          );
        })}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-lg">
        <span className="text-red-600">●</span> เสี่ยงสูง&nbsp;&nbsp;
        <span className="text-orange-500">●</span> พบซ้ำ&nbsp;&nbsp;
        <span className="text-blue-600">●</span> งานเปิด&nbsp;&nbsp;
        <span className="text-emerald-600">●</span> ปิดแล้ว
      </div>
    </div>
  );
}

// 4. STAFF DASHBOARD
// ==========================================
export function IncidentLocationPanel({ incident, compact = false }) {
  const lat = Number(incident?.lat);
  const lng = Number(incident?.lng);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(incident?.location || "")}`;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-black text-rose-600">
            <MapPin className="h-4 w-4" /> สถานที่รับแจ้งปัญหา
          </div>
          <div className="mt-1 font-black text-slate-950">{incident?.location || "ไม่ระบุสถานที่"}</div>
          <div className="mt-1 text-sm text-slate-500">
            หมู่ {incident?.villageMoo || "-"} {incident?.villageName || ""}
          </div>
        </div>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-100">
          เปิดนำทาง ↗
        </a>
      </div>
      {hasCoordinates ? (
        <div className={compact ? "h-44" : "h-56"}>
          <MapContainer center={[lat, lng]} zoom={17} scrollWheelZoom={false} className="h-full w-full" attributionControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <CircleMarker center={[lat, lng]} radius={12} pathOptions={{ color: "#ffffff", weight: 4, fillColor: "#ef4444", fillOpacity: 1 }}>
              <Popup>จุดรับแจ้งเหตุ<br />{incident?.location}</Popup>
            </CircleMarker>
          </MapContainer>
        </div>
      ) : (
        <div className="flex min-h-28 items-center justify-center bg-slate-50 p-5 text-center text-sm text-amber-700">
          เรื่องนี้ยังไม่มีพิกัดแผนที่ ควรขอหมุดจากผู้แจ้งก่อนมอบหมายงาน
        </div>
      )}
      {hasCoordinates && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
          พิกัด {lat.toFixed(6)}, {lng.toFixed(6)} · หมุดคือจุดที่ประชาชนระบุตอนแจ้งเหตุ
        </div>
      )}
    </section>
  );
}

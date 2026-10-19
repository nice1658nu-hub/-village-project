import React, { useEffect, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
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
import NewsModal from "../../shared/NewsModal";
export default function LandingPage({ onNavigate, news }) {
  const centralNews = (news || []).filter((item) => item.village_id == null);
  const publicSlides = centralNews
    .filter((item) => item.displaySection === "hero" && item.image)
    .slice(0, 8);
  const activityNews = (news || [])
    .filter((item) => item.village_id == null && item.displaySection === "news")
    .slice(0, 6);
  const [slideIndex, setSlideIndex] = useState(0);
  const [activityIndex, setActivityIndex] = useState(0);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [publicSearch, setPublicSearch] = useState("");
  const [publicMenuOpen, setPublicMenuOpen] = useState(false);
  const [publicHeaderVisible, setPublicHeaderVisible] = useState(true);
  const lastPublicScrollY = useRef(0);
  const activityCarouselRef = useRef(null);
  const videoCarouselRef = useRef(null);
  useEffect(() => {
    if (publicSlides.length < 2) return undefined;
    const timer = window.setInterval(
      () => setSlideIndex((index) => (index + 1) % publicSlides.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, [publicSlides.length]);
  useEffect(() => {
    if (slideIndex >= publicSlides.length) setSlideIndex(0);
  }, [publicSlides.length, slideIndex]);
  useEffect(() => {
    lastPublicScrollY.current = window.scrollY;
    const handleScroll = () => {
      const currentY = window.scrollY;
      const difference = currentY - lastPublicScrollY.current;
      if (currentY <= 12 || difference < -7) setPublicHeaderVisible(true);
      if (difference > 7 && currentY > 80 && !publicMenuOpen) {
        setPublicHeaderVisible(false);
      }
      lastPublicScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [publicMenuOpen]);
  const goToPublicSection = (sectionId) => {
    setPublicMenuOpen(false);
    setPublicHeaderVisible(true);
    window.setTimeout(
      () => document.querySelector(sectionId)?.scrollIntoView({ behavior: "smooth" }),
      0,
    );
  };
  const currentSlide = publicSlides[slideIndex];
  const visibleActivityNews = activityNews.filter(
    (item) =>
      !publicSearch.trim() ||
      `${item.title} ${item.content}`
        .toLowerCase()
        .includes(publicSearch.trim().toLowerCase()),
  );
  useEffect(() => {
    if (activityIndex >= visibleActivityNews.length) setActivityIndex(0);
  }, [activityIndex, visibleActivityNews.length]);
  const goToActivity = (index) => {
    setActivityIndex(index);
    const carousel = activityCarouselRef.current;
    if (carousel) {
      carousel.scrollTo({ left: carousel.clientWidth * index, behavior: "smooth" });
    }
  };
  const promoItems = centralNews
    .filter((item) => item.displaySection === "video" && item.video_url)
    .slice(0, 8)
    .map((item) => {
      const value = item.video_url || "";
      const youtube = value.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/,
      );
      return {
        ...item,
        playableUrl: youtube
          ? `https://www.youtube.com/embed/${youtube[1]}`
          : value,
      };
    });
  const scrollVideoCarousel = (direction) => {
    const carousel = videoCarouselRef.current;
    if (!carousel) return;
    carousel.scrollBy({
      left: direction * Math.max(carousel.clientWidth * 0.85, 280),
      behavior: "smooth",
    });
  };
  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 font-sans text-slate-900 scroll-smooth">
      <header className={`public-header fixed inset-x-0 top-0 z-[1100] border-b border-slate-200 bg-white/95 shadow-md backdrop-blur-xl transition-transform duration-300 ${publicHeaderVisible || publicMenuOpen ? "translate-y-0" : "-translate-y-full"}`}>
        <div className="relative mx-auto flex h-16 w-full items-center gap-2 px-3 sm:h-[72px] sm:gap-3 sm:px-6 lg:h-20 lg:px-10 xl:px-16">
          <button type="button" onClick={() => goToPublicSection("#home")} className="flex min-w-0 flex-1 items-center gap-2.5 pr-[10.5rem] text-left sm:gap-3 sm:pr-[13rem] lg:gap-4 lg:pr-[17rem]">
            <AppLogo className="h-11 w-11 shadow-sm sm:h-12 sm:w-12 lg:h-14 lg:w-14" />
            <div className="min-w-0">
              <div className="line-clamp-2 text-[13px] font-black leading-[1.15] text-slate-900 min-[390px]:text-sm sm:text-base lg:text-2xl">
                {APP_NAME}
              </div>
              <div className="mt-0.5 hidden truncate text-[11px] font-bold text-slate-500 sm:block lg:mt-1 lg:text-sm">
                {VILLAGE_NAME}
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("auth")}
            className="absolute right-[3.75rem] flex h-10 w-[6.25rem] items-center justify-center whitespace-nowrap rounded-full bg-blue-600 px-2 text-xs font-black text-white shadow-sm hover:bg-blue-700 sm:right-[4.5rem] sm:h-11 sm:w-32 sm:text-sm lg:right-[6.5rem] lg:h-12 lg:w-36 lg:text-base xl:right-[9rem]"
          >
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            onClick={() => {
              setPublicMenuOpen((value) => !value);
              setPublicHeaderVisible(true);
            }}
            aria-label={publicMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
            aria-expanded={publicMenuOpen}
            className="absolute right-2.5 flex h-10 w-10 items-center justify-center rounded-xl text-slate-800 hover:bg-slate-100 sm:right-3 sm:h-11 sm:w-11 lg:right-10 lg:h-12 lg:w-12 xl:right-16"
          >
            {publicMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          {publicMenuOpen && (
            <div className="absolute right-3 top-[calc(100%+0.5rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl sm:right-6 lg:right-12 lg:w-[30rem] lg:p-3 xl:right-20">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  goToPublicSection("#activities");
                }}
                className="relative mb-2 overflow-hidden rounded-xl border bg-slate-50"
              >
                <input
                  value={publicSearch}
                  onChange={(event) => setPublicSearch(event.target.value)}
                  className="w-full bg-transparent py-3 pl-3 pr-14 text-sm outline-none lg:py-4 lg:pl-4 lg:text-lg"
                  placeholder="ค้นหาข่าวหรือกิจกรรม"
                />
                <button type="submit" aria-label="ค้นหา" className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-blue-700 hover:bg-blue-50">
                  <Search className="h-5 w-5 lg:h-7 lg:w-7" />
                </button>
              </form>
              {[
                ["หน้าหลัก", "#home"],
                ["ข่าวกิจกรรม", "#activities"],
                ["ติดต่อเรา", "#contact"],
              ].map(([label, section]) => (
                <button key={section} type="button" onClick={() => goToPublicSection(section)} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 lg:px-5 lg:py-4 lg:text-lg">
                  {label}<ChevronRight className="h-5 w-5 lg:h-6 lg:w-6" />
                </button>
              ))}
              <button type="button" onClick={() => onNavigate("register")} className="mt-1 w-full rounded-xl border border-blue-200 px-4 py-3 text-left font-bold text-blue-700 hover:bg-blue-50 lg:px-5 lg:py-4 lg:text-lg">
                สมัครสมาชิก
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="h-16 sm:h-[72px] lg:h-20" aria-hidden="true" />

      <section id="home" className="public-hero bg-white">
        <div
          className="relative mx-auto w-full overflow-hidden bg-white"
          style={{ aspectRatio: "2 / 1", height: "auto", minHeight: 0 }}
        >
          {currentSlide ? (
            <img
              key={currentSlide.id}
              src={currentSlide.image}
              alt={currentSlide.title}
              className="absolute inset-0 block h-full w-full bg-white object-contain object-center animate-fadeIn"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center center",
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-white">
              <div>
                <Bell className="mx-auto h-12 w-12 text-blue-300 lg:h-18 lg:w-18" />
                <h1 className="mt-4 text-2xl font-black sm:text-4xl lg:mt-6 lg:text-5xl">
                  ข่าวประชาสัมพันธ์ อบต.มะต้อง
                </h1>
                <p className="mt-2 text-slate-300 lg:mt-4 lg:text-xl">
                  ยังไม่มีข่าวประชาสัมพันธ์ในขณะนี้
                </p>
              </div>
            </div>
          )}
          {publicSlides.length > 1 && (
            <>
              <button
                aria-label="ภาพก่อนหน้า"
                onClick={() =>
                  setSlideIndex(
                    (index) =>
                      (index - 1 + publicSlides.length) % publicSlides.length,
                  )
                }
                className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur hover:bg-black/75"
              >
                <ChevronRight className="rotate-180" />
              </button>
              <button
                aria-label="ภาพถัดไป"
                onClick={() =>
                  setSlideIndex((index) => (index + 1) % publicSlides.length)
                }
                className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur hover:bg-black/75"
              >
                <ChevronRight />
              </button>
              <div className="absolute bottom-4 right-5 z-10 flex gap-2 sm:bottom-7 sm:right-8">
                {publicSlides.map((item, index) => (
                  <button
                    key={item.id}
                    aria-label={`เลือกภาพ ${index + 1}`}
                    onClick={() => setSlideIndex(index)}
                    className={`h-2.5 rounded-full transition-all ${index === slideIndex ? "w-8 bg-white" : "w-2.5 bg-white/50"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {activityNews.length > 0 && (
        <section id="activities" className="border-y bg-white py-14 lg:py-16">
          <div className="mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-20">
            <div className="mb-10 flex items-center gap-4 text-cyan-500 lg:mb-12">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white shadow-sm lg:h-16 lg:w-16">
                <FileText className="h-7 w-7 lg:h-8 lg:w-8" />
              </span>
              <h2 className="shrink-0 text-2xl font-bold lg:text-4xl">
                ข่าวกิจกรรม
              </h2>
              <span className="h-1 flex-1 rounded-full bg-cyan-500" aria-hidden="true" />
            </div>
            <div
              ref={activityCarouselRef}
              onScroll={(event) => {
                if (window.innerWidth >= 768) return;
                const carousel = event.currentTarget;
                if (!carousel.clientWidth) return;
                setActivityIndex(
                  Math.min(
                    visibleActivityNews.length - 1,
                    Math.max(0, Math.round(carousel.scrollLeft / carousel.clientWidth)),
                  ),
                );
              }}
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-2 md:gap-6 md:overflow-visible lg:grid-cols-4"
            >
              {visibleActivityNews.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedSlide(item)}
                  className="group w-full shrink-0 snap-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg md:w-auto md:min-w-0"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-slate-200">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Bell className="h-10 w-10 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-h-[12rem] flex-col p-4 lg:min-h-[13rem] lg:p-5">
                    <h3 className="line-clamp-2 text-lg font-black leading-snug text-slate-950 group-hover:text-cyan-600 lg:text-xl">
                      {item.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500 lg:text-base">
                      {item.content || "คลิกเพื่ออ่านรายละเอียดข่าวและกิจกรรม"}
                    </p>
                    <span className="mt-2 text-sm font-bold text-cyan-600 transition group-hover:text-cyan-700">
                      อ่านเพิ่มเติม
                    </span>
                    <div className="mt-auto border-t border-slate-100 pt-3 text-sm text-slate-500">
                      {formatThaiDateTime(item.date)} น.
                    </div>
                  </div>
                </button>
              ))}
              {!visibleActivityNews.length && (
                <div className="py-12 text-center text-slate-500 md:col-span-2 lg:col-span-4">
                  ไม่พบข่าวที่ค้นหา
                </div>
              )}
            </div>
            {visibleActivityNews.length > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2 md:hidden">
                {visibleActivityNews.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`ดูกิจกรรม ${index + 1}`}
                    onClick={() => goToActivity(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      activityIndex === index
                        ? "w-8 bg-blue-600"
                        : "w-2.5 bg-slate-300"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
      {activityNews.length === 0 && (
        <section id="activities" className="border-y bg-white py-16">
          <div className="mx-auto w-full px-4 text-center sm:px-6 lg:px-12 xl:px-20">
            <h2 className="text-3xl font-black lg:text-4xl">
              ข่าวสารและกิจกรรม
            </h2>
            <div className="mt-8 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-slate-500 lg:mt-8 lg:min-h-[300px] lg:py-20">
              <Image className="mx-auto h-12 w-12 text-slate-300 lg:h-16 lg:w-16" />
              <div className="mt-3 font-bold lg:mt-5 lg:text-xl">ยังไม่มีภาพกิจกรรมที่เผยแพร่</div>
              <div className="mt-1 text-sm"></div>
            </div>
          </div>
        </section>
      )}

      <section className="border-y border-red-100 bg-red-50/60 py-12 lg:py-16">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="mb-8 flex items-center gap-4 text-red-600 lg:mb-10">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm lg:h-16 lg:w-16">
              <Video className="h-7 w-7 fill-current lg:h-8 lg:w-8" />
            </span>
            <h2 className="shrink-0 text-2xl font-bold text-slate-800 lg:text-4xl">
              วิดีโอประชาสัมพันธ์
            </h2>
            <span className="h-1 flex-1 rounded-full bg-red-600" aria-hidden="true" />
          </div>

          {promoItems.length ? (
            <div className="relative">
              <div
                ref={videoCarouselRef}
                className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-6"
              >
                {promoItems.map((item) => (
                  <article
                    key={item.id}
                    className="w-[86%] shrink-0 snap-start sm:w-[48%] lg:w-[calc((100%_-_3rem)/3)]"
                  >
                    <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-md">
                      {item.playableUrl.includes("youtube.com/embed") ? (
                        <iframe
                          src={item.playableUrl}
                          title={item.title || "วิดีโอประชาสัมพันธ์"}
                          className="h-full w-full"
                          style={{ width: "100%", height: "100%" }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video
                          src={item.playableUrl}
                          poster={item.image || undefined}
                          controls
                          className="h-full w-full bg-black object-contain"
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      )}
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-center text-lg font-bold text-slate-800 lg:text-xl">
                      {item.title || "วิดีโอประชาสัมพันธ์"}
                    </h3>
                  </article>
                ))}
              </div>

              {promoItems.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => scrollVideoCarousel(-1)}
                    aria-label="เลื่อนวิดีโอไปทางซ้าย"
                    className="absolute left-1 top-[40%] z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/75 text-white shadow-lg backdrop-blur hover:bg-slate-950 lg:-left-6 lg:h-14 lg:w-14"
                  >
                    <ChevronRight className="h-7 w-7 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollVideoCarousel(1)}
                    aria-label="เลื่อนวิดีโอไปทางขวา"
                    className="absolute right-1 top-[40%] z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/75 text-white shadow-lg backdrop-blur hover:bg-slate-950 lg:-right-6 lg:h-14 lg:w-14"
                  >
                    <ChevronRight className="h-7 w-7" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-red-200 bg-white py-16 text-center text-slate-500">
              <Video className="mx-auto h-12 w-12 text-red-300" />
              <div className="mt-4 text-xl font-black text-slate-700">ยังไม่มีวิดีโอ</div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-slate-50 py-14">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="mb-6">
            <div className="text-sm font-black text-blue-600">
              แผนที่พื้นที่ให้บริการ
            </div>
            <h2 className="mt-1 text-3xl font-black lg:text-5xl">
              ตำบลมะต้อง อำเภอพรหมพิราม
            </h2>
            <p className="mt-2 text-slate-500 lg:text-xl">แสดงที่ตั้งและพื้นที่ให้บริการขององค์การบริหารส่วนตำบลมะต้อง</p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="h-[360px] sm:h-[460px]">
              <MapContainer
                center={[17.07948, 100.1799]}
                zoom={13}
                scrollWheelZoom={false}
                className="h-full w-full"
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <CircleMarker
                  center={[17.07948, 100.1799]}
                  radius={12}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 4,
                    fillColor: "#2563eb",
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <div className="font-sans">
                      <b>ตำบลมะต้อง</b>
                      <br />
                      อำเภอพรหมพิราม จังหวัดพิษณุโลก
                    </div>
                  </Popup>
                </CircleMarker>
              </MapContainer>
            </div>
            <div className="flex flex-col gap-3 border-t p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-black text-slate-900">
                  องค์การบริหารส่วนตำบลมะต้อง
                </div>
                <div className="text-sm text-slate-500">
                  หมู่ที่ 3 ตำบลมะต้อง อำเภอพรหมพิราม จังหวัดพิษณุโลก
                </div>
              </div>
              <a
                href="https://www.google.com/maps/search/?api=1&query=%E0%B8%AD%E0%B8%87%E0%B8%84%E0%B9%8C%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%9A%E0%B8%A3%E0%B8%B4%E0%B8%AB%E0%B8%B2%E0%B8%A3%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%95%E0%B8%B3%E0%B8%9A%E0%B8%A5%E0%B8%A1%E0%B8%B0%E0%B8%95%E0%B9%89%E0%B8%AD%E0%B8%87"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
              >
                <MapPin className="h-4 w-4" />
                เปิดเส้นทางใน Google Maps
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="bg-gray-900 py-16 text-white lg:py-20">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <div className="mb-6 flex items-center gap-3 text-2xl font-bold lg:text-3xl">
                <AppLogo className="h-11 w-11 lg:h-16 lg:w-16" />
                {APP_NAME}
              </div>
              <p className="max-w-xs text-gray-400 lg:max-w-lg lg:text-lg lg:leading-8">
                ชุมชนน่าอยู่ ปลอดภัย สังคมแห่งการแบ่งปัน ร่วมสร้าง{VILLAGE_NAME}
                ให้ดียิ่งขึ้นไปพร้อมกัน
              </p>
            </div>
            <div>
              <h4 className="mb-6 text-lg font-bold lg:text-2xl">
                ข้อมูลติดต่อ
              </h4>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-400 lg:text-lg">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800">
                    <Phone className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 lg:text-base">
                      เบอร์โทรศัพท์
                    </p>
                    <p className="font-semibold text-white">
                      055-009-758
                    </p>
                  </div>
                </li>
                <li className="flex items-center gap-3 text-gray-400 lg:text-lg">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800">
                    <Facebook className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 lg:text-base">Facebook Page</p>
                    <p className="font-semibold text-white">
                      อบต. มะต้อง
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-gray-800 pt-8 text-center text-sm text-gray-500 lg:text-base">
            © {new Date().getFullYear()} {APP_NAME}
          </div>
        </div>
      </footer>
      {selectedSlide && (
        <NewsModal
          news={selectedSlide}
          onClose={() => setSelectedSlide(null)}
          onPrevious={
            visibleActivityNews.length > 1
              ? () => {
                  const index = visibleActivityNews.findIndex(
                    (item) => item.id === selectedSlide.id,
                  );
                  setSelectedSlide(
                    visibleActivityNews[
                      (index - 1 + visibleActivityNews.length) %
                        visibleActivityNews.length
                    ],
                  );
                }
              : undefined
          }
          onNext={
            visibleActivityNews.length > 1
              ? () => {
                  const index = visibleActivityNews.findIndex(
                    (item) => item.id === selectedSlide.id,
                  );
                  setSelectedSlide(
                    visibleActivityNews[(index + 1) % visibleActivityNews.length],
                  );
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

// ==========================================
// 2. AUTH PAGE (Login / Signup)
// ==========================================

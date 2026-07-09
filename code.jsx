import React, { useEffect, useState } from 'react';
import { 
  Home, FileText, AlertTriangle, PieChart, Users, Settings, LogOut, 
  MapPin, Camera, CheckCircle, Clock, XCircle, Search, Plus, Trash2, 
  Menu, X, Calendar, Bell, Facebook, Phone, MessageCircle, ChevronRight, Upload, Map,
  Info, Edit
} from 'lucide-react';
import { MOCK_INCIDENTS, MOCK_NEWS, MOCK_NOTIFS, MOCK_USERS } from './src/data/mockData';
import { api } from './src/services/api';
import { setupFirebaseNotifications } from './src/services/firebaseNotifications';

const CATEGORIES = ['สาธารณูปโภค (ถนน/ท่อ)', 'ไฟฟ้า/แสงสว่าง', 'น้ำประปา', 'ความสะอาด/ขยะ', 'ความปลอดภัย/เสียงรบกวน', 'อื่นๆ'];
const VILLAGE_NAME = 'หมู่บ้านไผ่ถ้ำ';
const APP_NAME = `SmartVillage ${VILLAGE_NAME}`;
const MAP_BOUNDS = {
  minLat: 16.8195,
  maxLat: 16.8235,
  minLng: 100.2595,
  maxLng: 100.2635,
};

// --- UTILS ---
const getFormattedDate = () => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return new Date().toLocaleDateString('th-TH', options);
};

const getHoursDiff = (start, end) => {
  if (!start || !end) return null;
  return Math.max(0, (new Date(end) - new Date(start)) / (1000 * 60 * 60));
};

const formatHours = (hours) => {
  if (hours == null || Number.isNaN(hours)) return '-';
  if (hours < 1) return `${Math.round(hours * 60)} นาที`;
  if (hours < 24) return `${hours.toFixed(1)} ชม.`;
  return `${(hours / 24).toFixed(1)} วัน`;
};

const getHeatLevel = (count) => {
  if (count >= 3) return { label: 'รุนแรง', color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200' };
  if (count === 2) return { label: 'เฝ้าระวัง', color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' };
  return { label: 'ปกติ', color: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' };
};

const getSentimentScore = (text = '') => {
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

const getSentimentMeta = (score) => {
  if (score >= 5) return { label: 'วิกฤต', text: 'text-red-700', bg: 'bg-red-50 border-red-200' };
  if (score >= 3) return { label: 'ตึงเครียด', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' };
  return { label: 'ทั่วไป', text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
};

const getCredibilityMeta = (score) => {
  if (score >= 85) return { label: 'สูง', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 70) return { label: 'ปานกลาง', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  return { label: 'ต้องตรวจสอบเพิ่ม', text: 'text-red-700', bg: 'bg-red-50 border-red-200' };
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const latLngToPercent = (lat, lng) => {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * 100;
  const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100;
  return {
    x: clamp(x, 4, 96),
    y: clamp(y, 6, 94),
  };
};

const percentToLatLng = (xPercent, yPercent) => {
  const lng = MAP_BOUNDS.minLng + ((xPercent / 100) * (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng));
  const lat = MAP_BOUNDS.maxLat - ((yPercent / 100) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat));
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('landing'); // landing, auth, dashboard
  const [activeTab, setActiveTab] = useState('news'); // Managed globally for sidebar integration
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // App Data State
  const [users, setUsers] = useState(MOCK_USERS);
  const [news, setNews] = useState(MOCK_NEWS);
  const [incidents, setIncidents] = useState(MOCK_INCIDENTS);
  const [notifications, setNotifications] = useState(MOCK_NOTIFS);
  const [apiStatus, setApiStatus] = useState('mock');

  useEffect(() => {
    let isMounted = true;

    api.getBootstrapData()
      .then((data) => {
        if (!isMounted) return;
        setUsers(data.users || MOCK_USERS);
        setNews(data.news || MOCK_NEWS);
        setIncidents(data.incidents || MOCK_INCIDENTS);
        setNotifications(data.notifications || MOCK_NOTIFS);
        setApiStatus('connected');
      })
      .catch(() => {
        if (isMounted) setApiStatus('mock');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let unsubscribe = null;

    setupFirebaseNotifications(currentUser, (message) => {
      setNotifications((prev) => [message, ...prev]);
    })
      .then((cleanup) => {
        unsubscribe = cleanup;
      })
      .catch(() => {
        unsubscribe = null;
      });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [currentUser]);
  
  // Login Handler
  const handleLogin = async (phone, password) => {
    let user = null;

    try {
      const data = await api.login(phone, password);
      user = data.user;
      setApiStatus('connected');
    } catch {
      user = users.find(u => u.phone === phone && u.password === password);
    }

    if (user) {
      setCurrentUser(user);
      setActiveTab(user.role === 'admin' ? 'stats' : 'news');
      setCurrentView('dashboard');
    } else {
      alert('เบอร์โทรศัพท์/ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  // Register Handler
  const handleRegister = async (newUser) => {
    if (users.find(u => u.phone === newUser.phone)) {
      alert('เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว');
      return;
    }

    let user = null;

    try {
      const data = await api.register(newUser);
      user = data.user;
      setApiStatus('connected');
    } catch {
      user = { ...newUser, id: Date.now().toString(), role: 'user' };
    }

    setUsers([...users, user]);
    setCurrentUser(user);
    setActiveTab('news');
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('landing');
  };

  // Render Logic
  if (currentView === 'landing') return <LandingPage onNavigate={setCurrentView} news={news} />;
  if (currentView === 'auth') return <AuthPage onLogin={handleLogin} onRegister={handleRegister} onBack={() => setCurrentView('landing')} />;
  
  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <Sidebar 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        activeTab={activeTab} 
        setActiveTab={(tab) => { setActiveTab(tab); setIsSidebarOpen(false); }}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Topbar 
          currentUser={currentUser} 
          notifications={notifications} 
          setNotifications={setNotifications} 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {currentUser?.role === 'admin' ? (
            <AdminDashboard 
              activeTab={activeTab} 
              setActiveTab={setActiveTab}
              news={news} setNews={setNews} 
              incidents={incidents} setIncidents={setIncidents} 
              setNotifications={setNotifications}
              users={users} setUsers={setUsers}
            />
          ) : (
            <UserDashboard 
              activeTab={activeTab} 
              setActiveTab={setActiveTab}
              currentUser={currentUser} 
              news={news} 
              incidents={incidents} setIncidents={setIncidents} 
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ==========================================
// 1. LANDING PAGE
// ==========================================
function LandingPage({ onNavigate, news }) {
  return (
    <div className="min-h-screen bg-white font-sans scroll-smooth">
      {/* Navbar */}
      <nav className="fixed w-full bg-white/90 backdrop-blur-md z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2 text-2xl font-bold text-blue-600">
              <Home className="w-8 h-8" /> {APP_NAME}
            </div>
            <div className="flex gap-4">
              <button onClick={() => onNavigate('auth')} className="text-gray-600 hover:text-blue-600 font-medium px-4 py-2 hidden sm:block">เข้าสู่ระบบ</button>
              <button onClick={() => onNavigate('auth')} className="bg-blue-600 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                สมัครสมาชิก
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute top-24 -left-24 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6 leading-tight">
            ยกระดับคุณภาพชีวิต<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">เพื่อ{VILLAGE_NAME}ที่น่าอยู่ของเรา</span>
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            แพลตฟอร์มแจ้งเหตุ ร้องทุกข์ และติดตามข่าวสารสำหรับลูกบ้านใน{VILLAGE_NAME} ใช้งานง่าย รวดเร็ว และแก้ไขปัญหาได้อย่างตรงจุดโดยผู้ดูแลชุมชน
          </p>
          <button onClick={() => onNavigate('auth')} className="bg-blue-600 text-white text-lg px-8 py-4 rounded-full font-bold hover:bg-blue-700 transition shadow-xl shadow-blue-200 flex items-center gap-2 mx-auto">
            เข้าสู่ระบบลูกบ้าน <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="p-8 rounded-3xl bg-blue-50 border border-blue-100 text-center hover:shadow-lg transition">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">แจ้งเหตุง่ายดาย</h3>
              <p className="text-gray-600">ถ่ายรูป ปักหมุด และแจ้งปัญหาต่างๆ ในหมู่บ้านได้ทันทีผ่านมือถือ</p>
            </div>
            <div className="p-8 rounded-3xl bg-indigo-50 border border-indigo-100 text-center hover:shadow-lg transition">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">ติดตามสถานะแบบ Real-time</h3>
              <p className="text-gray-600">รู้ทันทีว่าปัญหาของคุณอยู่ในขั้นตอนไหน และได้รับการแก้ไขหรือยัง</p>
            </div>
            <div className="p-8 rounded-3xl bg-purple-50 border border-purple-100 text-center hover:shadow-lg transition">
              <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white">
                <Bell className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">ไม่พลาดทุกข่าวสาร</h3>
              <p className="text-gray-600">รับการแจ้งเตือนประกาศสำคัญและกิจกรรมจากนิติบุคคล/ผู้ใหญ่บ้าน</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Contacts */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            <div>
              <div className="flex items-center gap-2 text-2xl font-bold text-white mb-6">
                <Home className="w-8 h-8 text-blue-500" /> {APP_NAME}
              </div>
              <p className="text-gray-400 max-w-xs">
                ชุมชนน่าอยู่ ปลอดภัย สังคมแห่งการแบ่งปัน ร่วมสร้าง{VILLAGE_NAME}ให้ดียิ่งขึ้นไปพร้อมกัน
              </p>
            </div>
            <div>
              <h4 className="text-lg font-bold mb-6 text-white">ติดต่อผู้ดูแลหมู่บ้าน / นิติบุคคล</h4>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-400">
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"><Phone className="w-5 h-5 text-green-400" /></div>
                  <div>
                    <p className="text-sm text-gray-500">เบอร์โทรศัพท์ฉุกเฉิน</p>
                    <p className="font-semibold text-white">089-999-9999 (ผู้ใหญ่บ้าน)</p>
                  </div>
                </li>
                <li className="flex items-center gap-3 text-gray-400">
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"><Facebook className="w-5 h-5 text-blue-400" /></div>
                  <div>
                    <p className="text-sm text-gray-500">Facebook Page</p>
                    <p className="font-semibold text-white">{VILLAGE_NAME} Official</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

// ==========================================
// 2. AUTH PAGE (Login / Signup)
// ==========================================
function AuthPage({ onLogin, onRegister, onBack }) {
  const [isLogin, setIsLogin] = useState(true);
  
  // Login State
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Register State
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regHouseNo, setRegHouseNo] = useState('');
  const [regPass, setRegPass] = useState('');

  const submitLogin = (e) => {
    e.preventDefault();
    onLogin(loginPhone, loginPass);
  };

  const submitRegister = (e) => {
    e.preventDefault();
    if(!regName || !regPhone || !regHouseNo || !regPass) return alert('กรอกข้อมูลให้ครบถ้วน');
    onRegister({ name: regName, phone: regPhone, houseNo: regHouseNo, password: regPass });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-96 bg-blue-600 rounded-b-[40%] shadow-xl"></div>
      
      <button onClick={onBack} className="absolute top-6 left-6 text-white flex items-center gap-2 hover:opacity-80 transition z-10 font-medium bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm">
        <ChevronRight className="w-5 h-5 rotate-180" /> กลับหน้าแรก
      </button>

      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden z-10 relative mt-10">
        <div className="flex">
          <button onClick={() => setIsLogin(true)} className={`flex-1 py-4 text-center font-bold text-lg transition ${isLogin ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
            เข้าสู่ระบบ
          </button>
          <button onClick={() => setIsLogin(false)} className={`flex-1 py-4 text-center font-bold text-lg transition ${!isLogin ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
            สมัครสมาชิก
          </button>
        </div>

        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
              <Home className="w-8 h-8" />
            </div>
          </div>

          {isLogin ? (
            <form onSubmit={submitLogin} className="space-y-5 animate-fadeIn">
              {/* ลบกรอบแสดงรหัสแอดมินออกตามคำขอ */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">เบอร์โทรศัพท์ / Username</label>
                <input type="text" required value={loginPhone} onChange={e=>setLoginPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-gray-50 focus:bg-white" placeholder="08xxxxxxxx หรือ username" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">รหัสผ่าน</label>
                <input type="password" required value={loginPass} onChange={e=>setLoginPass(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-gray-50 focus:bg-white" placeholder="••••••••" />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 mt-4">
                เข้าสู่ระบบ
              </button>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ชื่อ - นามสกุล</label>
                <input type="text" required value={regName} onChange={e=>setRegName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white" placeholder="สมชาย ใจดี" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">เบอร์โทรศัพท์</label>
                  <input type="tel" required value={regPhone} onChange={e=>setRegPhone(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white" placeholder="08xxxxxxxx" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">บ้านเลขที่</label>
                  <input type="text" required value={regHouseNo} onChange={e=>setRegHouseNo(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white" placeholder="99/99" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ตั้งรหัสผ่าน</label>
                <input type="password" required value={regPass} onChange={e=>setRegPass(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white" placeholder="ตั้งรหัสผ่านสำหรับเข้าสู่ระบบ" />
              </div>
              <button type="submit" className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-green-700 transition shadow-lg shadow-green-200 mt-4">
                สมัครสมาชิกลูกบ้าน
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// SHARED LAYOUT COMPONENTS
// ==========================================
function Sidebar({ currentUser, onLogout, activeTab, setActiveTab, isOpen, setIsOpen }) {
  const adminMenu = [
    { id: 'stats', icon: <PieChart/>, label: 'Dashboard (สถิติ)' },
    { id: 'incidents', icon: <AlertTriangle/>, label: 'จัดการแจ้งเหตุ' },
    { id: 'news', icon: <Bell/>, label: 'จัดการข่าวสาร' },
    { id: 'users', icon: <Users/>, label: 'จัดการลูกบ้าน' },
  ];

  const userMenu = [
    { id: 'news', icon: <FileText/>, label: 'ข่าวสาร (หน้าหลัก)' },
    { id: 'report', icon: <Camera/>, label: 'แจ้งเหตุ / ร้องเรียน' },
    { id: 'history', icon: <Clock/>, label: 'ติดตามสถานะ' },
  ];

  const menuToUse = currentUser?.role === 'admin' ? adminMenu : userMenu;

  return (
    <div className={`fixed inset-y-0 left-0 w-64 bg-gray-900 text-white flex flex-col shadow-xl z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="h-20 flex items-center justify-between px-6 border-b border-gray-800 bg-gray-950">
        <div className="flex items-center">
          <Home className="w-6 h-6 text-blue-500 mr-2" />
          <span className="font-bold text-lg tracking-wide">{VILLAGE_NAME}</span>
        </div>
        <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsOpen(false)}>
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="p-6 border-b border-gray-800 bg-gray-800/50">
        <div className="text-sm text-gray-400 mb-1">ยินดีต้อนรับ,</div>
        <div className="font-bold text-blue-400 truncate text-lg">{currentUser?.name}</div>
        <div className="text-sm text-gray-500 mt-1">
           {currentUser?.role === 'admin' ? 'ผู้ดูแลระบบ' : `บ้านเลขที่ ${currentUser?.houseNo}`}
        </div>
      </div>
      <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {currentUser?.role === 'admin' ? 'เมนูผู้ดูแลระบบ' : 'เมนูลูกบ้าน'}
        </div>
        {menuToUse.map(item => (
          <NavItem 
            key={item.id} 
            icon={item.icon} 
            label={item.label} 
            active={activeTab === item.id} 
            onClick={() => setActiveTab(item.id)}
          />
        ))}
      </div>
      <div className="p-4 border-t border-gray-800">
        <button onClick={onLogout} className="flex items-center w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition font-bold">
          <LogOut className="w-5 h-5 mr-3" /> ออกจากระบบ
        </button>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center px-4 py-3 rounded-xl cursor-pointer transition ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
    >
      <span className="w-5 h-5 mr-3">{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function Topbar({ currentUser, notifications, setNotifications, toggleSidebar }) {
  const [showNotif, setShowNotif] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({...n, isRead: true})));
  };

  return (
    <div className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 z-10 shadow-sm relative">
      <div className="flex items-center">
        <button onClick={toggleSidebar} className="p-2 mr-2 rounded-lg text-gray-600 hover:bg-gray-100 md:hidden">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center md:hidden">
          <Home className="w-6 h-6 text-blue-600 mr-2" />
          <span className="font-bold text-lg text-gray-800">{VILLAGE_NAME}</span>
        </div>
        <div className="hidden md:block">
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
            {currentUser?.role === 'admin' ? `ระบบจัดการ${VILLAGE_NAME} (Admin)` : `ระบบบริการลูกบ้าน ${VILLAGE_NAME}`}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {/* Notifications Dropdown */}
        <div className="relative">
          <button onClick={() => setShowNotif(!showNotif)} className="relative p-2 rounded-full hover:bg-gray-100 transition cursor-pointer">
            <Bell className="w-6 h-6 text-gray-600 hover:text-blue-600 transition" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>
          
          {/* Notification Menu */}
          {showNotif && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-fadeIn">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                 <h3 className="font-bold text-gray-800">การแจ้งเตือน</h3>
                 {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-blue-600 font-medium hover:underline">อ่านทั้งหมด</button>}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">ไม่มีการแจ้งเตือนใหม่</div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer ${notif.isRead ? 'opacity-60' : 'bg-blue-50/30'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <h4 className={`text-sm ${notif.isRead ? 'font-medium text-gray-700' : 'font-bold text-blue-800'}`}>{notif.title}</h4>
                        {!notif.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></span>}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{notif.desc}</p>
                      <span className="text-[10px] text-gray-400 mt-2 block">{notif.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-l pl-5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
            {currentUser?.name.charAt(0)}
          </div>
          <div className="hidden sm:block text-sm">
             <div className="font-bold text-gray-800">{currentUser?.name}</div>
             <div className="text-gray-500">{currentUser?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ลูกบ้าน'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. USER DASHBOARD
// ==========================================
function UserDashboard({ activeTab, setActiveTab, currentUser, news, incidents, setIncidents }) {
  // Modals Data
  const [selectedNews, setSelectedNews] = useState(null);

  // Report Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [desc, setDesc] = useState('');
  const [location, setLocation] = useState('');
  const [image, setImage] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImage(URL.createObjectURL(e.target.files[0]));
    }
  };

  const submitReport = async (e) => {
    e.preventDefault();
    if(!title || !desc || !location || !selectedPoint) return alert('กรุณากรอกข้อมูลและปักหมุดตำแหน่งให้ครบถ้วน');
    
    const incidentPayload = {
      id: 'i' + Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      houseNo: currentUser.houseNo,
      title, category, description: desc, location,
      lat: selectedPoint.lat,
      lng: selectedPoint.lng,
      image: image || 'https://images.unsplash.com/photo-1541888086925-0c1bb6789c26?auto=format&fit=crop&q=80&w=400', // fallback image
      status: 'pending',
      date: new Date().toISOString(),
      firstResponseAt: null,
      resolvedAt: null,
      resolvedImage: null
    };

    let newIncident = incidentPayload;

    try {
      const data = await api.createIncident(incidentPayload);
      newIncident = data.incident || incidentPayload;
    } catch {
      newIncident = incidentPayload;
    }
    
    setIncidents([newIncident, ...incidents]);
    alert(`แจ้งเหตุสำเร็จ ระบบได้ส่งเรื่องให้ผู้ดูแล${VILLAGE_NAME}แล้ว`);
    
    // Reset form & go to history
    setTitle(''); setCategory(CATEGORIES[0]); setDesc(''); setLocation(''); setImage(null); setSelectedPoint(null);
    setActiveTab('history');
  };

  const handleDeleteIncident = async (id) => {
    if(window.confirm('คุณต้องการยกเลิกการแจ้งเหตุนี้ใช่หรือไม่? (ลบได้เฉพาะรายการที่ยังไม่ดำเนินการ)')) {
      try {
        await api.deleteIncident(id);
      } catch {
        // Keep local fallback working while Laravel backend is not running.
      }
      setIncidents(incidents.filter(i => i.id !== id));
    }
  };

  const myIncidents = incidents.filter(i => i.userId === currentUser.id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Mobile & Desktop Tabs */}
      <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200 mb-6 md:hidden">
        <button onClick={()=>setActiveTab('news')} className={`flex-1 py-3 text-sm md:text-base font-bold rounded-xl flex items-center justify-center gap-2 transition ${activeTab==='news'?'bg-blue-600 text-white shadow-md':'text-gray-500 hover:bg-gray-100'}`}><Bell className="w-5 h-5"/> ข่าวสาร</button>
        <button onClick={()=>setActiveTab('report')} className={`flex-1 py-3 text-sm md:text-base font-bold rounded-xl flex items-center justify-center gap-2 transition ${activeTab==='report'?'bg-blue-600 text-white shadow-md':'text-gray-500 hover:bg-gray-100'}`}><Camera className="w-5 h-5"/> แจ้งเหตุ</button>
        <button onClick={()=>setActiveTab('history')} className={`flex-1 py-3 text-sm md:text-base font-bold rounded-xl flex items-center justify-center gap-2 transition ${activeTab==='history'?'bg-blue-600 text-white shadow-md':'text-gray-500 hover:bg-gray-100'}`}><Clock className="w-5 h-5"/> ติดตามงาน</button>
      </div>

      {/* VIEW: NEWS */}
      {activeTab === 'news' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
             <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">ประกาศจาก{VILLAGE_NAME}</h2>
          </div>
          <div className="grid gap-6">
            {news.map(n => (
              <div key={n.id} onClick={() => setSelectedNews(n)} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col sm:flex-row hover:shadow-xl hover:border-blue-200 cursor-pointer transition-all group relative">
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-full opacity-0 group-hover:opacity-100 transition shadow-sm">
                  <ChevronRight className="w-5 h-5 text-blue-600" />
                </div>
                <div className="sm:w-1/3 h-56 sm:h-auto overflow-hidden">
                  <img src={n.image} alt="news" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                </div>
                <div className="p-6 sm:w-2/3 flex flex-col justify-center">
                  <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold mb-3 w-max border border-blue-100">ประกาศเมื่อ: {n.date}</span>
                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-700 transition">{n.title}</h3>
                  <p className="text-gray-600 leading-relaxed line-clamp-2">{n.content}</p>
                  <p className="text-sm text-blue-500 font-semibold mt-4">คลิกเพื่ออ่านรายละเอียดทั้งหมด...</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW: REPORT */}
      {activeTab === 'report' && (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 md:p-8 animate-fadeIn">
          <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><AlertTriangle className="text-red-500 w-8 h-8" /> แจ้งเหตุ / ร้องเรียน</h2>
              <p className="text-gray-500 mt-2">ระบุรายละเอียดปัญหาที่พบ เพื่อให้ผู้ดูแลรับทราบและดำเนินการแก้ไข</p>
            </div>
          </div>
          
          <form onSubmit={submitReport} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">หัวข้อเรื่อง (สั้นๆ) <span className="text-red-500">*</span></label>
                  <input type="text" required value={title} onChange={e=>setTitle(e.target.value)} className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition text-lg" placeholder="เช่น ไฟถนนดับ, ท่อแตก, มีงูเข้าบ้าน" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">หมวดหมู่ <span className="text-red-500">*</span></label>
                  <select value={category} onChange={e=>setCategory(e.target.value)} className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition text-lg cursor-pointer">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">สถานที่เกิดเหตุ/จุดสังเกต <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    <input type="text" required value={location} onChange={e=>setLocation(e.target.value)} className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition text-lg" placeholder="เช่น หน้าบ้าน 99/10, เสาไฟฟ้าต้นที่ 3 ซอย 2" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">ระบุตำแหน่งใน {VILLAGE_NAME} แล้วปักหมุดบนแผนที่ด้านขวาเพื่อบันทึกพิกัด GPS</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">รายละเอียดเพิ่มเติม <span className="text-red-500">*</span></label>
                  <textarea required value={desc} onChange={e=>setDesc(e.target.value)} className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition text-lg h-32 resize-none" placeholder="อธิบายลักษณะปัญหาที่พบเจอ..."></textarea>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">ปักหมุดตำแหน่งบนแผนที่ <span className="text-red-500">*</span></label>
                  <VillageMapPicker
                    incidents={incidents}
                    selectedPoint={selectedPoint}
                    onSelectPoint={setSelectedPoint}
                  />
                  <div className="mt-3 text-sm text-gray-600">
                    {selectedPoint ? (
                      <span>
                        พิกัดที่เลือก: <span className="font-bold text-gray-900">{selectedPoint.lat.toFixed(6)}, {selectedPoint.lng.toFixed(6)}</span>
                      </span>
                    ) : (
                      <span>คลิกบนแผนที่เพื่อเลือกตำแหน่งเกิดเหตุจริง</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">แนบรูปภาพประกอบ (ถ้ามี)</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:bg-gray-50 transition cursor-pointer relative overflow-hidden group h-40">
                    {image ? (
                      <div className="absolute inset-0 w-full h-full">
                         <img src={image} alt="preview" className="w-full h-full object-cover" />
                         <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                            <span className="text-white font-bold flex items-center gap-2"><Upload className="w-5 h-5"/> เปลี่ยนรูปภาพ</span>
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-center flex flex-col items-center justify-center h-full">
                        <Camera className="mx-auto h-12 w-12 text-gray-400 group-hover:text-blue-500 transition" />
                        <div className="text-sm text-gray-600">
                          <span className="text-blue-600 font-bold">อัปโหลดรูปภาพ</span> หรือลากไฟล์มาวาง
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG ไม่เกิน 10MB</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-end">
              <button type="submit" className="bg-blue-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center gap-2">
                <CheckCircle className="w-6 h-6" /> ยืนยันการแจ้งเหตุ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW: HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">ประวัติการแจ้งเหตุของคุณ</h2>
          </div>
          
          {myIncidents.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-12 h-12 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">ยังไม่มีประวัติการแจ้งเหตุ</h3>
              <p className="text-gray-500">คุณยังไม่เคยส่งเรื่องร้องเรียนใดๆ เข้ามาในระบบ</p>
              <button onClick={()=>setActiveTab('report')} className="mt-6 text-blue-600 font-bold hover:underline">ไปที่หน้าแจ้งเหตุ</button>
            </div>
          ) : (
            <div className="grid gap-4">
              {myIncidents.map(inc => (
                <div key={inc.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col md:flex-row gap-5 hover:shadow-md transition">
                  <div className="w-full md:w-48 h-32 rounded-xl overflow-hidden shrink-0 relative">
                    <img src={inc.image} alt={inc.title} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2"><StatusBadge status={inc.status} /></div>
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{inc.title}</h3>
                        {inc.status === 'pending' && (
                          <button onClick={() => handleDeleteIncident(inc.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition" title="ยกเลิกการแจ้งเหตุ (ลบ)">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-blue-600 font-medium mb-2">{inc.category}</p>
                      <p className="text-gray-600 text-sm line-clamp-2">{inc.description}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {inc.location}</span>
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {new Date(inc.date).toLocaleDateString('th-TH', {day:'numeric', month:'short', year:'numeric'})}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* News Modal */}
      {selectedNews && <NewsModal news={selectedNews} onClose={() => setSelectedNews(null)} />}
    </div>
  );
}

// ==========================================
// MAP COMPONENTS
// ==========================================
function VillageMapPicker({ incidents, selectedPoint, onSelectPoint }) {
  const handleMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    onSelectPoint(percentToLatLng(clamp(xPercent, 4, 96), clamp(yPercent, 6, 94)));
  };

  return (
    <div className="rounded-3xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 bg-slate-50">
        <div className="font-bold text-gray-900">แผนที่ตำแหน่งเหตุใน{VILLAGE_NAME}</div>
        <div className="text-xs text-gray-500 mt-1">คลิกบนแผนที่เพื่อปักหมุดตำแหน่งเกิดเหตุ และระบบจะเก็บพิกัด GPS ให้ทันที</div>
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

        <div className="absolute left-[18%] top-[18%] rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">ทางเข้าหมู่บ้าน</div>
        <div className="absolute left-[60%] top-[26%] rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">ซอย 2</div>
        <div className="absolute left-[56%] top-[58%] rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">ซอย 5</div>
        <div className="absolute left-[24%] top-[68%] rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">สวนสาธารณะ</div>

        {incidents.map(inc => {
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

        {selectedPoint && (() => {
          const pos = latLngToPercent(selectedPoint.lat, selectedPoint.lng);
          return (
            <div
              className="absolute -translate-x-1/2 -translate-y-full"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className="relative">
                <MapPin className="w-8 h-8 text-red-600 drop-shadow-lg" fill="currentColor" />
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-ping" />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function SpatialAnalyticsMap({ incidents }) {
  return (
    <div className="relative h-80 rounded-3xl overflow-hidden border border-gray-200 bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.18),_transparent_24%),linear-gradient(135deg,_#fff7ed_0%,_#fee2e2_44%,_#eff6ff_100%)]">
      <div className="absolute inset-0 opacity-50">
        <div className="absolute inset-x-0 top-[24%] h-px bg-white/70" />
        <div className="absolute inset-x-0 top-[54%] h-px bg-white/70" />
        <div className="absolute inset-y-0 left-[32%] w-px bg-white/70" />
        <div className="absolute inset-y-0 left-[68%] w-px bg-white/70" />
      </div>
      <div className="absolute left-4 top-4 rounded-2xl bg-white/85 px-4 py-3 shadow-sm border border-white/80">
        <div className="text-sm font-bold text-gray-900">Heat Map จำลองของ{VILLAGE_NAME}</div>
        <div className="text-xs text-gray-500 mt-1">ใช้พิกัดจากจุดร้องเรียนเพื่อแสดงพื้นที่หนาแน่นของปัญหา</div>
      </div>
      {incidents.map(inc => {
        const pos = latLngToPercent(inc.lat, inc.lng);
        const heat = getHeatLevel(
          incidents.filter(other => other.location === inc.location).length
        );
        return (
          <div key={inc.id}>
            <div
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl opacity-45 ${heat.color}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: 72, height: 72 }}
            />
            <div
              className="absolute -translate-x-1/2 -translate-y-full"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <MapPin className="w-7 h-7 text-red-600 drop-shadow-md" fill="currentColor" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 4. ADMIN DASHBOARD
// ==========================================
function AdminDashboard({ activeTab, setActiveTab, news, setNews, incidents, setIncidents, setNotifications, users, setUsers }) {
  const [selectedIncident, setSelectedIncident] = useState(null);
  
  // News Form State
  const [editingNews, setEditingNews] = useState(null); // null = list view, object = form view
  const [newsForm, setNewsForm] = useState({ title: '', content: '', image: '', date: '' });

  // Mobile Tabs
  const adminTabs = [
    { id: 'stats', label: 'สถิติ', icon: <PieChart className="w-4 h-4"/> },
    { id: 'incidents', label: 'แจ้งเหตุ', icon: <AlertTriangle className="w-4 h-4"/> },
    { id: 'news', label: 'ข่าวสาร', icon: <Bell className="w-4 h-4"/> },
    { id: 'users', label: 'ลูกบ้าน', icon: <Users className="w-4 h-4"/> },
  ];

  // --- Stats Logic ---
  const total = incidents.length;
  const pending = incidents.filter(i => i.status === 'pending').length;
  const inProgress = incidents.filter(i => i.status === 'in_progress').length;
  const resolved = incidents.filter(i => i.status === 'resolved').length;

  const pPending = total === 0 ? 0 : (pending / total) * 100;
  const pInProgress = total === 0 ? 0 : (inProgress / total) * 100;
  const pResolved = total === 0 ? 0 : (resolved / total) * 100;
  const unresolvedCount = incidents.filter(i => i.status !== 'resolved').length;

  const spatialAnalytics = Object.values(incidents.reduce((acc, inc) => {
    const key = inc.location;
    if (!acc[key]) {
      acc[key] = {
        location: inc.location,
        lat: inc.lat,
        lng: inc.lng,
        count: 0,
        pending: 0,
        inProgress: 0,
        resolved: 0,
      };
    }
    acc[key].count += 1;
    acc[key][inc.status === 'in_progress' ? 'inProgress' : inc.status] += 1;
    return acc;
  }, {})).sort((a, b) => b.count - a.count);

  const issueBreakdown = Object.values(incidents.reduce((acc, inc) => {
    if (!acc[inc.category]) {
      acc[inc.category] = { category: inc.category, count: 0 };
    }
    acc[inc.category].count += 1;
    return acc;
  }, {})).sort((a, b) => b.count - a.count);

  const firstResponseHours = incidents
    .map(inc => getHoursDiff(inc.date, inc.firstResponseAt))
    .filter(hours => hours != null);

  const resolveHours = incidents
    .map(inc => getHoursDiff(inc.date, inc.resolvedAt))
    .filter(hours => hours != null);

  const avgFirstResponse = firstResponseHours.length
    ? firstResponseHours.reduce((sum, hours) => sum + hours, 0) / firstResponseHours.length
    : null;
  const avgResolveTime = resolveHours.length
    ? resolveHours.reduce((sum, hours) => sum + hours, 0) / resolveHours.length
    : null;
  const firstResponseWithinTarget = firstResponseHours.filter(hours => hours <= 1).length;
  const resolveWithinTarget = resolveHours.filter(hours => hours <= 24).length;
  const responseCompliance = firstResponseHours.length ? Math.round((firstResponseWithinTarget / firstResponseHours.length) * 100) : 0;
  const resolveCompliance = resolveHours.length ? Math.round((resolveWithinTarget / resolveHours.length) * 100) : 0;

  const oldestOpenIncident = [...incidents]
    .filter(inc => inc.status !== 'resolved')
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  const predictiveMaintenance = Object.values(incidents.reduce((acc, inc) => {
    const key = `${inc.location}-${inc.category}`;
    if (!acc[key]) {
      acc[key] = {
        id: key,
        location: inc.location,
        category: inc.category,
        count: 0,
        riskScore: 0,
      };
    }
    const statusWeight = inc.status === 'resolved' ? 1 : inc.status === 'in_progress' ? 2 : 3;
    acc[key].count += 1;
    acc[key].riskScore += statusWeight;
    return acc;
  }, {})).sort((a, b) => b.riskScore - a.riskScore);

  const credibilityScoring = Object.values(incidents.reduce((acc, inc) => {
    if (!acc[inc.userId]) {
      acc[inc.userId] = {
        userId: inc.userId,
        userName: inc.userName,
        houseNo: inc.houseNo,
        totalReports: 0,
        withImage: 0,
        detailedReports: 0,
        resolvedReports: 0,
      };
    }

    acc[inc.userId].totalReports += 1;
    if (inc.image) acc[inc.userId].withImage += 1;
    if ((inc.description || '').length >= 30) acc[inc.userId].detailedReports += 1;
    if (inc.status === 'resolved') acc[inc.userId].resolvedReports += 1;
    return acc;
  }, {})).map(user => {
    const imageRatio = user.withImage / user.totalReports;
    const detailRatio = user.detailedReports / user.totalReports;
    const resolvedRatio = user.resolvedReports / user.totalReports;
    const score = Math.round(Math.min(98, 55 + (imageRatio * 15) + (detailRatio * 15) + (resolvedRatio * 15)));
    return { ...user, score, meta: getCredibilityMeta(score) };
  }).sort((a, b) => b.score - a.score);

  const sentimentAnalytics = incidents
    .map(inc => {
      const score = getSentimentScore(inc.description);
      return {
        ...inc,
        sentimentScore: score,
        sentimentMeta: getSentimentMeta(score),
      };
    })
    .sort((a, b) => b.sentimentScore - a.sentimentScore);

  const topHotspot = spatialAnalytics[0];
  const topPrediction = predictiveMaintenance[0];
  const topEmotionalCase = sentimentAnalytics[0];
  const topIssueCategory = issueBreakdown[0];
  const annualBudgetBase = 120000;
  const budgetRecommendations = issueBreakdown.map(item => ({
    ...item,
    percent: Math.round((item.count / Math.max(total, 1)) * 100),
    suggestedBudget: Math.round((item.count / Math.max(total, 1)) * annualBudgetBase),
    owner: item.category.includes('ไฟ') ? 'ทีมไฟฟ้า' : item.category.includes('น้ำ') ? 'ทีมประปา' : item.category.includes('ความสะอาด') ? 'ทีมสิ่งแวดล้อม' : 'ทีมช่างชุมชน',
  }));
  const priorityQueue = incidents
    .map(inc => {
      const hotspotWeight = spatialAnalytics.find(area => area.location === inc.location)?.count || 1;
      const urgency = getSentimentScore(inc.description);
      const credibility = credibilityScoring.find(user => user.userId === inc.userId)?.score || 70;
      const statusWeight = inc.status === 'pending' ? 3 : inc.status === 'in_progress' ? 2 : 1;
      const priorityScore = (statusWeight * 20) + (hotspotWeight * 10) + (urgency * 8) + Math.round(credibility / 10);
      const lane = priorityScore >= 90 ? 'Critical' : priorityScore >= 75 ? 'High' : 'Normal';
      return { ...inc, priorityScore, lane };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3);
  const predictivePlan = predictiveMaintenance.slice(0, 3).map((item, index) => ({
    ...item,
    riskLevel: item.riskScore >= 7 ? 'สูง' : item.riskScore >= 4 ? 'กลาง' : 'ต่ำ',
    nextInspection: `${index + 3} วัน`,
  }));

  // CSS for Mock Pie Chart
  const pieStyle = {
    background: `conic-gradient(
      #EAB308 0% ${pPending}%, 
      #3B82F6 ${pPending}% ${pPending + pInProgress}%, 
      #22C55E ${pPending + pInProgress}% 100%
    )`
  };

  // --- Incident Handlers ---
  const updateIncidentStatus = async (id, newStatus, resolvedImage = null) => {
    try {
      await api.updateIncidentStatus(id, { status: newStatus, resolvedImage });
    } catch {
      // Local state remains available for classroom demo before Laravel is running.
    }

    const updated = incidents.map(inc => {
      if (inc.id === id) {
        // Send Notification
        let statusText = newStatus === 'in_progress' ? 'กำลังดำเนินการ' : 'แก้ไขเรียบร้อยแล้ว';
        setNotifications(prev => [{
          id: 'n' + Date.now(),
          title: `อัปเดตงาน: ${inc.title}`,
          desc: `สถานะเปลี่ยนเป็น: ${statusText}`,
          isRead: false,
          time: 'เพิ่งกระทำ'
        }, ...prev]);

        return {
          ...inc,
          status: newStatus,
          firstResponseAt: inc.firstResponseAt || (newStatus !== 'pending' ? new Date().toISOString() : null),
          resolvedAt: newStatus === 'resolved' ? new Date().toISOString() : null,
          resolvedImage: resolvedImage || inc.resolvedImage
        };
      }
      return inc;
    });
    setIncidents(updated);
    setSelectedIncident(null);
  };

  const deleteIncident = async (id) => {
    if(window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบการแจ้งเหตุนี้?')) {
      try {
        await api.deleteIncident(id);
      } catch {
        // Keep local fallback working while Laravel backend is not running.
      }
      setIncidents(incidents.filter(i => i.id !== id));
      setSelectedIncident(null);
    }
  };

  // --- News Handlers ---
  const saveNews = async (e) => {
    e.preventDefault();
    if(editingNews.id) {
      // Edit
      const updatedNews = { ...editingNews, ...newsForm };
      try {
        await api.saveNews(updatedNews, editingNews.id);
      } catch {
        // Keep local fallback working while Laravel backend is not running.
      }
      setNews(news.map(n => n.id === editingNews.id ? updatedNews : n));
    } else {
      // Add
      const newN = {
        id: 'n' + Date.now(), 
        ...newsForm, 
        image: newsForm.image || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&q=80&w=400',
        date: new Date().toISOString().split('T')[0] 
      };
      let savedNews = newN;
      try {
        const data = await api.saveNews(newN);
        savedNews = data.news || newN;
      } catch {
        savedNews = newN;
      }
      setNews([savedNews, ...news]);
    }
    setEditingNews(null);
  };

  const deleteNews = async (id) => {
    if(window.confirm('ยืนยันการลบข่าวสารนี้?')) {
      try {
        await api.deleteNews(id);
      } catch {
        // Keep local fallback working while Laravel backend is not running.
      }
      setNews(news.filter(n => n.id !== id));
    }
  };

  const startEditNews = (n = { title: '', content: '', image: '' }) => {
    setEditingNews(n);
    setNewsForm({ title: n.title, content: n.content, image: n.image });
  };

  // --- User Handlers ---
  const deleteUser = async (id) => {
    if(window.confirm('แน่ใจหรือไม่ที่จะลบลูกบ้านท่านนี้ออกจากระบบ?')) {
      try {
        await api.deleteUser(id);
      } catch {
        // Keep local fallback working while Laravel backend is not running.
      }
      setUsers(users.filter(u => u.id !== id));
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
       {/* Mobile Tabs */}
       <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200 mb-6 md:hidden overflow-x-auto hide-scrollbar">
        {adminTabs.map(tab => (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-xl flex flex-col items-center justify-center gap-1 transition ${activeTab===tab.id?'bg-blue-600 text-white shadow-md':'text-gray-500 hover:bg-gray-100'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* VIEW: STATS */}
      {activeTab === 'stats' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">ภาพรวมระบบ (Dashboard)</h2>
              <p className="text-gray-500">สรุปข้อมูลการแจ้งเหตุ สถานะงาน และตัวชี้วัดการปฏิบัติงานภายใน{VILLAGE_NAME}</p>
            </div>
            <div className="flex items-center gap-3 bg-blue-50 text-blue-800 px-5 py-3 rounded-2xl font-bold border border-blue-100">
              <Calendar className="w-5 h-5 text-blue-600" />
              {getFormattedDate()}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <StatCard title="แจ้งเหตุทั้งหมด" count={total} color="bg-gray-100 text-gray-600 border-gray-200" icon={<FileText/>} />
            <StatCard title="รอรับเรื่อง" count={pending} color="bg-yellow-100 text-yellow-700 border-yellow-200" icon={<Clock/>} />
            <StatCard title="กำลังดำเนินการ" count={inProgress} color="bg-blue-100 text-blue-700 border-blue-200" icon={<AlertTriangle/>} />
            <StatCard title="แก้ไขเสร็จสิ้น" count={resolved} color="bg-green-100 text-green-700 border-green-200" icon={<CheckCircle/>} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
              <h3 className="text-lg font-bold text-gray-800 mb-6 w-full text-left">สัดส่วนสถานะการแจ้งเหตุ</h3>
              {total > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-10">
                  <div className="w-48 h-48 rounded-full shadow-inner border-4 border-white relative" style={pieStyle}>
                    <div className="absolute inset-0 m-auto w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-sm">
                      <span className="text-2xl font-black text-gray-800">{total}</span>
                      <span className="text-xs text-gray-500 font-bold">รายการ</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-yellow-500"></span> <span className="text-gray-600">รอรับเรื่อง ({pending})</span></div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-blue-500"></span> <span className="text-gray-600">กำลังดำเนินการ ({inProgress})</span></div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-green-500"></span> <span className="text-gray-600">แก้ไขเสร็จสิ้น ({resolved})</span></div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">ยังไม่มีข้อมูล</p>
              )}
            </div>
            
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4">แจ้งเหตุรอดำเนินการล่าสุด</h3>
              <div className="space-y-3">
                {incidents.filter(i => i.status === 'pending').slice(0, 3).map(inc => (
                  <div key={inc.id} onClick={() => setSelectedIncident(inc)} className="p-3 border border-gray-100 rounded-xl flex justify-between items-center hover:bg-gray-50 cursor-pointer transition">
                    <div className="truncate pr-4">
                      <div className="font-bold text-gray-800 truncate">{inc.title}</div>
                      <div className="text-xs text-gray-500 truncate">{inc.location}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                  </div>
                ))}
                {pending === 0 && <p className="text-gray-500 text-center py-4">ไม่มีรายการรอรับเรื่อง</p>}
              </div>
              {pending > 0 && (
                <button onClick={() => setActiveTab('incidents')} className="w-full mt-4 text-center text-sm font-bold text-blue-600 py-2 hover:bg-blue-50 rounded-lg transition">
                  ดูทั้งหมด
                </button>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">ศูนย์วิเคราะห์ข้อมูลและจัดลำดับงาน</h3>
                <p className="text-slate-300 mt-1 max-w-3xl text-sm">
                  ประมวลผลข้อมูลร้องเรียนเพื่อแสดงจุดเสี่ยง เวลาตอบสนอง แนวโน้มความเสียหาย และคิวงานสำคัญแบบรวมศูนย์
                </p>
              </div>
              <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/10">
                <div className="text-xs text-slate-300">เคสที่ยังต้องติดตาม</div>
                <div className="text-2xl font-black">{unresolvedCount}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">จุดเสี่ยงสูงสุด</div>
              <div className="text-lg font-black text-gray-900 mt-1">{topHotspot?.location || '-'}</div>
              <div className="text-xs text-red-600 mt-1">เกิดซ้ำ {topHotspot?.count || 0} เคส</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">หมวดใช้งบมากสุด</div>
              <div className="text-lg font-black text-gray-900 mt-1">{topIssueCategory?.category || '-'}</div>
              <div className="text-xs text-indigo-600 mt-1">{budgetRecommendations[0]?.percent || 0}% ของทั้งหมด</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">เคสอารมณ์สูงสุด</div>
              <div className="text-lg font-black text-gray-900 mt-1 line-clamp-1">{topEmotionalCase?.title || '-'}</div>
              <div className="text-xs text-pink-600 mt-1">{topEmotionalCase?.sentimentMeta.label || '-'}</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">เป้าหมายเชิงรุก</div>
              <div className="text-lg font-black text-gray-900 mt-1 line-clamp-1">{topPrediction?.location || '-'}</div>
              <div className="text-xs text-amber-600 mt-1">Risk Score {topPrediction?.riskScore || 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Spatial Analytics</h3>
                  <p className="text-sm text-gray-500">Heat Map จากพิกัด GPS เพื่อดูจุดเสี่ยงซ้ำซากใน {VILLAGE_NAME}</p>
                </div>
                <div className="p-3 rounded-2xl bg-red-50 text-red-600 border border-red-100">
                  <MapPin className="w-6 h-6" />
                </div>
              </div>
              <div className="mb-4">
                <SpatialAnalyticsMap incidents={incidents} />
              </div>
              <div className="space-y-3">
                {spatialAnalytics.map(area => {
                  const heat = getHeatLevel(area.count);
                  const width = `${Math.max((area.count / Math.max(topHotspot?.count || 1, 1)) * 100, 22)}%`;
                  return (
                    <div key={area.location} className={`rounded-2xl border p-4 ${heat.bg}`}>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <div className="font-bold text-gray-900">{area.location}</div>
                          <div className="text-xs text-gray-500">พิกัด {area.lat?.toFixed(3)}, {area.lng?.toFixed(3)}</div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold bg-white border ${heat.text}`}>
                          {heat.label}
                        </span>
                      </div>
                      <div className="h-3 bg-white/80 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${heat.color}`} style={{ width }} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
                        <span>รวม {area.count} เคส</span>
                        <span>รอรับเรื่อง {area.pending}</span>
                        <span>กำลังดำเนินการ {area.inProgress}</span>
                        <span>แก้ไขแล้ว {area.resolved}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {topHotspot && (
                <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
                  จุดที่ควรจับตาที่สุดตอนนี้คือ <span className="font-bold">{topHotspot.location}</span> เพราะมีการแจ้งสะสมสูงสุด
                  เหมาะกับการวางแผนซ่อมเชิงรุกแทนการซ่อมรายครั้ง
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">ตำแหน่งที่เฝ้าระวัง</div>
                  <div className="text-lg font-black text-gray-900 mt-1">{topHotspot?.location || '-'}</div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">จำนวนพิกัดสะสม</div>
                  <div className="text-lg font-black text-gray-900 mt-1">{topHotspot?.count || 0} เคส</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Response Time</h3>
                  <p className="text-sm text-gray-500">ตัวชี้วัด KPI การรับเรื่องและการปิดงาน</p>
                </div>
                <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                  <Clock className="w-6 h-6" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <div className="text-sm text-blue-700 font-semibold">รับเรื่องเฉลี่ย</div>
                  <div className="text-2xl font-black text-blue-900 mt-2">{formatHours(avgFirstResponse)}</div>
                </div>
                <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                  <div className="text-sm text-green-700 font-semibold">ปิดงานเฉลี่ย</div>
                  <div className="text-2xl font-black text-green-900 mt-2">{formatHours(avgResolveTime)}</div>
                </div>
                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                  <div className="text-sm text-orange-700 font-semibold">งานค้างนานสุด</div>
                  <div className="text-lg font-black text-orange-900 mt-2">
                    {oldestOpenIncident ? oldestOpenIncident.title : '-'}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                {oldestOpenIncident ? (
                  <>
                    เคส <span className="font-bold">{oldestOpenIncident.title}</span> ที่ <span className="font-bold">{oldestOpenIncident.location}</span>
                    คือคอขวดสำคัญของ backlog ตอนนี้ ถ้ารับเรื่องได้ไวแต่ปิดงานช้า ควรตรวจสต็อกอุปกรณ์และการจัดทีมภาคสนามเพิ่ม
                  </>
                ) : (
                  'ยังไม่มีงานค้างในระบบ'
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-gray-100 p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">SLA รับเรื่อง</div>
                  <div className="text-base font-black text-gray-900 mt-1">{avgFirstResponse != null && avgFirstResponse <= 1 ? 'ปกติ' : 'ต้องติดตาม'}</div>
                  <div className="text-xs text-blue-700 mt-1">{responseCompliance}% ภายใน 1 ชั่วโมง</div>
                </div>
                <div className="rounded-2xl border border-gray-100 p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">SLA ปิดงาน</div>
                  <div className="text-base font-black text-gray-900 mt-1">{avgResolveTime != null && avgResolveTime <= 24 ? 'ปกติ' : 'เสี่ยงล่าช้า'}</div>
                  <div className="text-xs text-green-700 mt-1">{resolveCompliance}% ภายใน 24 ชั่วโมง</div>
                </div>
                <div className="rounded-2xl border border-gray-100 p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Backlog เปิดค้าง</div>
                  <div className="text-base font-black text-gray-900 mt-1">{unresolvedCount} งาน</div>
                  <div className="text-xs text-orange-700 mt-1">เก่าสุด: {oldestOpenIncident ? new Date(oldestOpenIncident.date).toLocaleDateString('th-TH') : '-'}</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Issue Breakdown</h3>
                  <p className="text-sm text-gray-500">สัดส่วนประเภทปัญหาเพื่อใช้วางงบประมาณ</p>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <PieChart className="w-6 h-6" />
                </div>
              </div>
              <div className="space-y-3">
                {issueBreakdown.map(item => {
                  const width = `${(item.count / Math.max(total, 1)) * 100}%`;
                  return (
                    <div key={item.category}>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-semibold text-gray-800">{item.category}</span>
                        <span className="text-gray-500">{item.count} เคส</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500" style={{ width }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {issueBreakdown[0] && (
                <div className="mt-4 p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-sm text-indigo-900">
                  หมวดที่พบมากที่สุดคือ <span className="font-bold">{issueBreakdown[0].category}</span>
                  ควรได้รับงบและแผนงานเชิงป้องกันมากเป็นพิเศษในรอบถัดไป
                </div>
              )}
              <div className="mt-3 overflow-hidden rounded-2xl border border-gray-100">
                <div className="grid grid-cols-[1.4fr_.6fr_.6fr_.9fr_.9fr] bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500">
                  <div>หมวดงาน</div>
                  <div>จำนวน</div>
                  <div>สัดส่วน</div>
                  <div>งบแนะนำ</div>
                  <div>หน่วยงาน</div>
                </div>
                {budgetRecommendations.map(item => (
                  <div key={item.category} className="grid grid-cols-[1.4fr_.6fr_.6fr_.9fr_.9fr] px-4 py-2.5 text-sm border-t border-gray-100">
                    <div className="font-medium text-gray-800">{item.category}</div>
                    <div className="text-gray-600">{item.count}</div>
                    <div className="text-indigo-700 font-semibold">{item.percent}%</div>
                    <div className="text-gray-700">{item.suggestedBudget.toLocaleString()} บ.</div>
                    <div className="text-gray-600">{item.owner}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Predictive Maintenance</h3>
                  <p className="text-sm text-gray-500">คาดการณ์จุดเสี่ยงจากสถิติการเกิดเหตุซ้ำ</p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
              <div className="space-y-2.5">
                {predictivePlan.map(item => (
                  <div key={item.id} className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="font-bold text-gray-900">{item.location}</div>
                        <div className="text-sm text-amber-800">{item.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-amber-700">Risk Score</div>
                        <div className="text-2xl font-black text-amber-900">{item.riskScore}</div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-white/70 px-3 py-2 text-gray-700">เกิดซ้ำ {item.count} ครั้ง</div>
                      <div className="rounded-xl bg-white/70 px-3 py-2 text-gray-700">ความเสี่ยง {item.riskLevel}</div>
                      <div className="rounded-xl bg-white/70 px-3 py-2 text-gray-700">ตรวจรอบถัดไป {item.nextInspection}</div>
                    </div>
                  </div>
                ))}
              </div>
              {topPrediction && (
                <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
                  ข้อเสนอเชิงรุก: วางแผน preventive maintenance ที่ <span className="font-bold">{topPrediction.location}</span>
                  ในหมวด <span className="font-bold">{topPrediction.category}</span> ก่อนจุดอื่น
                </div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-gray-100 p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">จุดเสี่ยงอันดับ 1</div>
                  <div className="text-base font-black text-gray-900 mt-1">{topPrediction?.location || '-'}</div>
                </div>
                <div className="rounded-2xl border border-gray-100 p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">หมวดงาน</div>
                  <div className="text-base font-black text-gray-900 mt-1">{topPrediction?.category || '-'}</div>
                </div>
                <div className="rounded-2xl border border-gray-100 p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Risk Score</div>
                  <div className="text-base font-black text-gray-900 mt-1">{topPrediction?.riskScore || 0}</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Credibility Scoring</h3>
                  <p className="text-sm text-gray-500">ต้นแบบคะแนนความน่าเชื่อถือของผู้แจ้ง</p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Search className="w-6 h-6" />
                </div>
              </div>
              <div className="space-y-2.5">
                {credibilityScoring.map(user => (
                  <div key={user.userId} className={`rounded-2xl border p-4 ${user.meta.bg}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-gray-900">{user.userName}</div>
                        <div className="text-xs text-gray-500">บ้านเลขที่ {user.houseNo} • แจ้งทั้งหมด {user.totalReports} เคส</div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold bg-white border ${user.meta.text}`}>
                        {user.meta.label}
                      </div>
                    </div>
                    <div className="mt-3 h-3 bg-white/90 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${user.score}%` }} />
                    </div>
                    <div className="mt-2 text-sm text-gray-700">คะแนน {user.score}/100</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm text-gray-700">
                เวอร์ชันต้นแบบนี้ให้คะแนนจากความครบถ้วนของข้อมูล รูปภาพ และประวัติการปิดงาน
                หากเก็บข้อมูลแจ้งเท็จในอนาคต ระบบสามารถหักคะแนนและลด priority ได้อัตโนมัติ
              </div>
              <div className="mt-3 space-y-2">
                {credibilityScoring.slice(0, 3).map(user => (
                  <div key={user.userId} className="grid grid-cols-[1.3fr_.8fr_.8fr] items-center rounded-2xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm">
                    <div className="font-medium text-gray-800">{user.userName}</div>
                    <div className="text-gray-600">รายงาน {user.totalReports} เคส • {user.meta.label}</div>
                    <div className="text-right font-bold text-emerald-700">{user.score}/100</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Sentiment Analysis</h3>
                  <p className="text-sm text-gray-500">วิเคราะห์ระดับความเร่งด่วนจากข้อความของผู้แจ้ง</p>
                </div>
                <div className="p-3 rounded-2xl bg-pink-50 text-pink-600 border border-pink-100">
                  <MessageCircle className="w-6 h-6" />
                </div>
              </div>
              <div className="space-y-2.5">
                {sentimentAnalytics.slice(0, 4).map(item => (
                  <div key={item.id} className={`rounded-2xl border p-4 ${item.sentimentMeta.bg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-gray-900">{item.title}</div>
                        <div className="text-xs text-gray-500 mt-1">{item.location}</div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold bg-white border ${item.sentimentMeta.text}`}>
                        {item.sentimentMeta.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-3 line-clamp-2">{item.description}</p>
                  </div>
                ))}
              </div>
              {topEmotionalCase && (
                <div className="mt-4 p-3 rounded-2xl bg-pink-50 border border-pink-100 text-sm text-pink-900">
                  เคสที่มีความตึงเครียดสูงสุดตอนนี้คือ <span className="font-bold">{topEmotionalCase.title}</span>
                  ระบบจึงสามารถช่วยให้เจ้าหน้าที่จัดลำดับตอบสนองเคสที่กระทบความรู้สึกประชาชนก่อน
                </div>
              )}
              <div className="mt-3 space-y-2">
                {sentimentAnalytics.slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800 line-clamp-1">{item.title}</div>
                      <div className="text-xs text-gray-500">{item.location}</div>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <div className="text-xs font-bold text-gray-500">S{item.sentimentScore}</div>
                      <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold border ${item.sentimentMeta.bg} ${item.sentimentMeta.text}`}>
                        {item.sentimentMeta.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 xl:col-span-2">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Priority Queue และแผนปฏิบัติการ</h3>
                  <p className="text-sm text-gray-500">จัดลำดับคิวงานจากสถานะ จุดเสี่ยง ระดับอารมณ์ และความน่าเชื่อถือของข้อมูล</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 text-slate-700 border border-slate-100">
                  <Bell className="w-6 h-6" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <div className="text-xs text-amber-700">Maintenance Focus</div>
                  <div className="font-bold text-gray-900 mt-1">{topPrediction?.location || '-'}</div>
                  <div className="text-sm text-gray-700 mt-1">{topPrediction?.category || '-'} • Score {topPrediction?.riskScore || 0}</div>
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                  <div className="text-xs text-indigo-700">Budget Focus</div>
                  <div className="font-bold text-gray-900 mt-1">{topIssueCategory?.category || '-'}</div>
                  <div className="text-sm text-gray-700 mt-1">{budgetRecommendations[0]?.percent || 0}% ของรายการทั้งหมด</div>
                </div>
                <div className="rounded-2xl border border-pink-100 bg-pink-50 p-4">
                  <div className="text-xs text-pink-700">Urgency Focus</div>
                  <div className="font-bold text-gray-900 mt-1 line-clamp-1">{priorityQueue[0]?.title || '-'}</div>
                  <div className="text-sm text-gray-700 mt-1">Priority {priorityQueue[0]?.priorityScore || 0}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                {priorityQueue.map(item => (
                  <div key={item.id} className="rounded-2xl border border-gray-200 p-4 bg-gray-50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-gray-900 line-clamp-1">{item.title}</div>
                      <span className="text-xs font-bold text-slate-600">P{item.priorityScore}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{item.location} • {item.category}</div>
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">{item.description}</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="rounded-full bg-white px-2.5 py-1 font-bold text-gray-600 border border-gray-200">{item.lane}</span>
                      <span className="text-gray-500">สถานะ {item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: INCIDENTS */}
      {activeTab === 'incidents' && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 animate-fadeIn">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">จัดการรายการแจ้งเหตุ</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                  <th className="p-4 rounded-tl-xl font-semibold">รายการ</th>
                  <th className="p-4 font-semibold">ผู้แจ้ง / บ้านเลขที่</th>
                  <th className="p-4 font-semibold">สถานที่</th>
                  <th className="p-4 font-semibold">สถานะ</th>
                  <th className="p-4 rounded-tr-xl font-semibold text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {incidents.map(inc => (
                  <tr key={inc.id} className="hover:bg-gray-50 transition">
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{inc.title}</div>
                      <div className="text-xs text-blue-600 mt-1">{inc.category}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-gray-800">{inc.userName}</div>
                      <div className="text-xs text-gray-500">บ้าน: {inc.houseNo}</div>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {inc.location}</div>
                    </td>
                    <td className="p-4"><StatusBadge status={inc.status} /></td>
                    <td className="p-4 text-center">
                      <button onClick={() => setSelectedIncident(inc)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-100 hover:text-blue-600 transition shadow-sm">
                        ดูรายละเอียด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: NEWS MANAGEMENT */}
      {activeTab === 'news' && (
        <div className="space-y-6 animate-fadeIn">
          {editingNews ? (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">{editingNews.id ? 'แก้ไขข่าวสาร' : 'สร้างประกาศข่าวใหม่'}</h2>
              <form onSubmit={saveNews} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">หัวข้อประกาศ</label>
                  <input type="text" required value={newsForm.title} onChange={e=>setNewsForm({...newsForm, title: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">รายละเอียดเนื้อหา</label>
                  <textarea required value={newsForm.content} onChange={e=>setNewsForm({...newsForm, content: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-blue-500 outline-none h-32 resize-none"></textarea>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">URL รูปภาพประกอบ (จำลองระบบอัปโหลด)</label>
                  <input type="text" value={newsForm.image} onChange={e=>setNewsForm({...newsForm, image: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-blue-500 outline-none" placeholder="https://..." />
                  {newsForm.image && <img src={newsForm.image} alt="preview" className="mt-4 h-32 rounded-xl object-cover" />}
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={()=>setEditingNews(null)} className="px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200">ยกเลิก</button>
                  <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md">บันทึกข่าวสาร</button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                 <h2 className="text-2xl font-bold text-gray-800">จัดการประกาศข่าวสาร</h2>
                 <button onClick={() => startEditNews()} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2">
                    <Plus className="w-5 h-5" /> สร้างข่าวใหม่
                 </button>
              </div>
              <div className="grid gap-6">
                {news.map(n => (
                  <div key={n.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col sm:flex-row hover:shadow-md transition-all">
                    <div className="sm:w-1/4 h-48 sm:h-auto overflow-hidden">
                      <img src={n.image} alt="news" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-6 sm:w-3/4 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold text-gray-400 mb-2 block">{n.date}</span>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{n.title}</h3>
                        <p className="text-gray-600 line-clamp-2">{n.content}</p>
                      </div>
                      <div className="mt-4 flex gap-3">
                        <button onClick={() => startEditNews(n)} className="flex items-center gap-1 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"><Edit className="w-4 h-4"/> แก้ไข</button>
                        <button onClick={() => deleteNews(n.id)} className="flex items-center gap-1 text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100"><Trash2 className="w-4 h-4"/> ลบ</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* VIEW: USERS MANAGEMENT (NEW) */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 animate-fadeIn">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">จัดการข้อมูลลูกบ้าน</h2>
            <span className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-full text-sm">รวม {users.filter(u=>u.role==='user').length} บัญชี</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                  <th className="p-4 rounded-tl-xl font-semibold">ชื่อ - นามสกุล</th>
                  <th className="p-4 font-semibold">เบอร์โทรศัพท์</th>
                  <th className="p-4 font-semibold">บ้านเลขที่</th>
                  <th className="p-4 rounded-tr-xl font-semibold text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.filter(u => u.role === 'user').map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-bold text-gray-900">{u.name}</td>
                    <td className="p-4 text-gray-600">{u.phone}</td>
                    <td className="p-4 text-gray-600">{u.houseNo}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => deleteUser(u.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition" title="ลบบัญชีลูกบ้าน">
                        <Trash2 className="w-5 h-5 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Incident Detail Modal for Admin */}
      {selectedIncident && (
        <AdminIncidentModal 
          inc={selectedIncident} 
          onClose={() => setSelectedIncident(null)} 
          onUpdate={updateIncidentStatus}
          onDelete={() => deleteIncident(selectedIncident.id)}
        />
      )}
    </div>
  );
}

// ==========================================
// MODALS & UTILS
// ==========================================
function AdminIncidentModal({ inc, onClose, onUpdate, onDelete }) {
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState(inc.status);
  const [resImage, setResImage] = useState(null);

  const handleResImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setResImage(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleSave = () => {
    if(newStatus === 'resolved' && !resImage && !inc.resolvedImage) {
      if(!window.confirm('คุณยังไม่ได้แนบรูปภาพผลการแก้ไข ต้องการดำเนินการต่อโดยไม่มีรูปภาพใช่หรือไม่?')) return;
    }
    onUpdate(inc.id, newStatus, resImage);
    setEditingStatus(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fadeIn relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"><X className="w-6 h-6 text-gray-600" /></button>
        
        <div className="p-8">
          <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <StatusBadge status={inc.status} size="lg" />
                <span className="text-sm font-bold text-gray-400">{new Date(inc.date).toLocaleString('th-TH')}</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">{inc.title}</h2>
              <div className="text-blue-600 font-bold mt-1 flex items-center gap-1"><Info className="w-4 h-4"/> {inc.category}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <img src={inc.image} alt="incident" className="w-full h-48 object-cover rounded-2xl shadow-sm border border-gray-200" />
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-sm text-gray-500 mb-1 font-semibold">ผู้แจ้งเรื่อง</p>
                <p className="font-bold text-gray-900">{inc.userName}</p>
                <p className="text-sm text-gray-600">บ้านเลขที่: {inc.houseNo}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <p className="text-sm text-blue-600 mb-1 font-semibold flex items-center gap-1"><MapPin className="w-4 h-4"/> สถานที่ / จุดสังเกต</p>
                <p className="font-bold text-gray-900">{inc.location}</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-800 mb-2">รายละเอียดเพิ่มเติม</h3>
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-gray-700 leading-relaxed whitespace-pre-wrap">
              {inc.description}
            </div>
          </div>

          {inc.status === 'resolved' && (inc.resolvedImage || resImage) && !editingStatus && (
            <div className="mb-8 p-6 bg-green-50 rounded-2xl border border-green-200">
               <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5"/> ผลการแก้ไข</h3>
               <img src={resImage || inc.resolvedImage} alt="resolved" className="w-full h-64 object-cover rounded-xl shadow-sm" />
            </div>
          )}

          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            {editingStatus ? (
              <div className="flex-1 w-full space-y-4">
                <select value={newStatus} onChange={e=>setNewStatus(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="pending">รอรับเรื่อง</option>
                  <option value="in_progress">กำลังดำเนินการ</option>
                  <option value="resolved">แก้ไขเสร็จสิ้น</option>
                </select>
                
                {newStatus === 'resolved' && (
                  <div className="animate-fadeIn">
                     <label className="block text-sm font-bold text-gray-700 mb-2">แนบรูปภาพหลังแก้ไข (ถ้ามี)</label>
                     <input type="file" accept="image/*" onChange={handleResImageChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                     {resImage && <img src={resImage} className="mt-3 h-20 rounded-lg object-cover" alt="preview"/>}
                  </div>
                )}
                
                <div className="flex gap-2 w-full pt-2">
                  <button onClick={() => setEditingStatus(false)} className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50">ยกเลิก</button>
                  <button onClick={handleSave} className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">บันทึกสถานะ</button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm text-gray-500 font-semibold mb-1">สถานะปัจจุบัน</p>
                  <StatusBadge status={inc.status} size="lg" />
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button onClick={onDelete} className="flex-1 sm:flex-none px-6 py-3 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition">
                    ลบเหตุนี้
                  </button>
                  <button onClick={() => setEditingStatus(true)} className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-md shadow-blue-200">
                    อัปเดตงาน
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function NewsModal({ news, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fadeIn relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100/80 backdrop-blur rounded-full hover:bg-gray-200 transition z-10"><X className="w-6 h-6 text-gray-800" /></button>
        
        <img src={news.image} alt="news" className="w-full h-64 md:h-80 object-cover rounded-t-3xl" />
        
        <div className="p-8">
          <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold mb-4 border border-blue-100">ประกาศเมื่อ: {news.date}</span>
          <h2 className="text-3xl font-bold text-gray-900 mb-6">{news.title}</h2>
          <div className="text-gray-700 leading-loose text-lg whitespace-pre-wrap">
            {news.content}
          </div>
          
          <div className="mt-10 pt-6 border-t border-gray-100 flex justify-center">
            <button onClick={onClose} className="px-8 py-3 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition">
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, count, color, icon }) {
  return (
    <div className={`p-6 md:p-8 rounded-3xl border bg-white shadow-sm flex items-center justify-between ${color}`}>
      <div>
        <p className={`text-sm md:text-base font-bold uppercase tracking-wider mb-2 ${color.split(' ')[1]}`}>{title}</p>
        <p className="text-5xl font-black text-gray-900">{count}</p>
      </div>
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white ${color.split(' ')[0].replace('100', '500')} shadow-lg`}>
        {React.cloneElement(icon, { className: "w-8 h-8" })}
      </div>
    </div>
  );
}

function StatusBadge({ status, size="sm" }) {
  const isLg = size === 'lg';
  const classes = isLg ? 'px-4 py-2 text-sm' : 'px-3 py-1 text-xs';
  
  if(status === 'pending') return <span className={`bg-yellow-100 text-yellow-800 font-bold rounded-full border border-yellow-300 shadow-sm inline-flex items-center gap-1 ${classes}`}><span className="w-2 h-2 rounded-full bg-yellow-500"></span> รอรับเรื่อง</span>;
  if(status === 'in_progress') return <span className={`bg-blue-100 text-blue-800 font-bold rounded-full border border-blue-300 shadow-sm inline-flex items-center gap-1 ${classes}`}><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> กำลังดำเนินการ</span>;
  if(status === 'resolved') return <span className={`bg-green-100 text-green-800 font-bold rounded-full border border-green-300 shadow-sm inline-flex items-center gap-1 ${classes}`}><span className="w-2 h-2 rounded-full bg-green-500"></span> แก้ไขแล้ว</span>;
  return null;
}

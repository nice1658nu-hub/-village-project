import React, { useState, useEffect } from 'react';
import { 
  Home, FileText, AlertTriangle, PieChart, Users, Settings, LogOut, 
  MapPin, Camera, CheckCircle, Clock, XCircle, Search, Plus, Trash2, 
  Menu, X, Calendar, Bell, Facebook, Phone, MessageCircle, ChevronRight, Upload, Map,
  Info, Edit
} from 'lucide-react';

// --- MOCK DATA ---
const MOCK_USERS = [
  { id: '1', name: 'ผู้ใหญ่บ้าน (Admin)', phone: 'admin', houseNo: '-', role: 'admin', password: 'admin1234' },
  { id: '2', name: 'สมชาย ใจดี', phone: '0811111111', houseNo: '99/10', role: 'user', password: '123' },
  { id: '3', name: 'สมหญิง รักสงบ', phone: '0822222222', houseNo: '99/11', role: 'user', password: '123' },
];

const MOCK_NEWS = [
  { id: 'n1', title: 'ประกาศฉีดวัคซีนพิษสุนัขบ้าประจำปี', content: 'ขอเชิญลูกบ้านนำสัตว์เลี้ยงมาฉีดวัคซีน ณ ศาลาประชาคม ในวันที่ 15 ส.ค. นี้ ตั้งแต่เวลา 09.00 - 15.00 น. กรุณานำสมุดประจำตัวสัตว์เลี้ยงมาด้วย', image: 'https://images.unsplash.com/photo-1541364983171-a8ba01e95cfc?auto=format&fit=crop&q=80&w=400&h=300', date: '2026-03-10' },
  { id: 'n2', title: 'แจ้งตัดไฟชั่วคราวซอย 3', content: 'การไฟฟ้าจะทำการปรับปรุงสายไฟบริเวณซอย 3 วันเสาร์นี้ เวลา 09:00 - 12:00 น. ขออภัยในความไม่สะดวกครับ', image: 'https://images.unsplash.com/photo-1520256860188-f5e27a6fdf94?auto=format&fit=crop&q=80&w=400&h=300', date: '2026-03-11' },
];

const MOCK_INCIDENTS = [
  { id: 'i1', userId: '2', userName: 'สมชาย ใจดี', houseNo: '99/10', title: 'ไฟถนนดับ', category: 'ไฟฟ้า/แสงสว่าง', description: 'ไฟหน้าปากซอย 2 ดับมา 3 วันแล้วครับ มืดมากอันตราย', location: 'ปากซอย 2', lat: 16.82, lng: 100.26, image: 'https://images.unsplash.com/photo-1519998246738-9cb5fb0d6cb2?auto=format&fit=crop&q=80&w=400', status: 'pending', date: '2026-03-12T08:00:00', resolvedImage: null },
  { id: 'i2', userId: '2', userName: 'สมชาย ใจดี', houseNo: '99/10', title: 'ท่อประปาแตก', category: 'น้ำประปา', description: 'น้ำเจิ่งนองเต็มถนนซอย 5 รบกวนมาดูด่วนครับ', location: 'กลางซอย 5', lat: 16.821, lng: 100.262, image: 'https://images.unsplash.com/photo-1584061556956-613866299d0e?auto=format&fit=crop&q=80&w=400', status: 'in_progress', date: '2026-03-11T14:30:00', resolvedImage: null },
  { id: 'i3', userId: '2', userName: 'สมชาย ใจดี', houseNo: '99/10', title: 'กิ่งไม้หักขวางทาง', category: 'อื่นๆ', description: 'พายุเมื่อคืนทำให้กิ่งไม้ใหญ่ร่วงมาขวางถนนหน้าสวนสาธารณะ', location: 'หน้าสวนสาธารณะ', lat: 16.822, lng: 100.261, image: 'https://images.unsplash.com/photo-1574955684496-d877f88da207?auto=format&fit=crop&q=80&w=400', status: 'resolved', date: '2026-03-09T09:15:00', resolvedImage: 'https://images.unsplash.com/photo-1506450687799-d4da77395460?auto=format&fit=crop&q=80&w=400' },
];

const MOCK_NOTIFS = [
  { id: 'not1', title: 'แจ้งเตือนข่าวสารใหม่', desc: 'ประกาศฉีดวัคซีนพิษสุนัขบ้าประจำปี', isRead: false, time: '2 ชม. ที่แล้ว' },
  { id: 'not2', title: 'อัปเดตสถานะงาน', desc: 'เรื่อง "กิ่งไม้หักขวางทาง" ได้รับการแก้ไขแล้ว', isRead: true, time: '1 วันที่แล้ว' }
];

const CATEGORIES = ['สาธารณูปโภค (ถนน/ท่อ)', 'ไฟฟ้า/แสงสว่าง', 'น้ำประปา', 'ความสะอาด/ขยะ', 'ความปลอดภัย/เสียงรบกวน', 'อื่นๆ'];

// --- UTILS ---
const getFormattedDate = () => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return new Date().toLocaleDateString('th-TH', options);
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
  
  // Login Handler
  const handleLogin = (phone, password) => {
    const user = users.find(u => u.phone === phone && u.password === password);
    if (user) {
      setCurrentUser(user);
      setActiveTab(user.role === 'admin' ? 'stats' : 'news');
      setCurrentView('dashboard');
    } else {
      alert('เบอร์โทรศัพท์/ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  // Register Handler
  const handleRegister = (newUser) => {
    if (users.find(u => u.phone === newUser.phone)) {
      alert('เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว');
      return;
    }
    const user = { ...newUser, id: Date.now().toString(), role: 'user' };
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
              <Home className="w-8 h-8" /> SmartVillage
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
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">เพื่อหมู่บ้านที่น่าอยู่ของเรา</span>
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            แพลตฟอร์มแจ้งเหตุ ร้องทุกข์ และติดตามข่าวสารสำหรับลูกบ้าน ใช้งานง่าย รวดเร็ว และแก้ไขปัญหาได้อย่างตรงจุดโดยผู้ดูแลหมู่บ้าน
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
                <Home className="w-8 h-8 text-blue-500" /> SmartVillage
              </div>
              <p className="text-gray-400 max-w-xs">
                ชุมชนน่าอยู่ ปลอดภัย สังคมแห่งการแบ่งปัน ร่วมสร้างหมู่บ้านของเราให้ดียิ่งขึ้นไปพร้อมกัน
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
                    <p className="font-semibold text-white">หมู่บ้านแสนสุข Official</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} SmartVillage System. All rights reserved.
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
          <span className="font-bold text-lg tracking-wide">SmartVillage</span>
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
          <span className="font-bold text-lg text-gray-800">SmartVillage</span>
        </div>
        <div className="hidden md:block">
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
            {currentUser?.role === 'admin' ? 'ระบบจัดการหมู่บ้าน (Admin)' : 'ระบบบริการลูกบ้าน'}
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

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImage(URL.createObjectURL(e.target.files[0]));
    }
  };

  const submitReport = (e) => {
    e.preventDefault();
    if(!title || !desc || !location) return alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    
    const newIncident = {
      id: 'i' + Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      houseNo: currentUser.houseNo,
      title, category, description: desc, location,
      image: image || 'https://images.unsplash.com/photo-1541888086925-0c1bb6789c26?auto=format&fit=crop&q=80&w=400', // fallback image
      status: 'pending',
      date: new Date().toISOString(),
      resolvedImage: null
    };
    
    setIncidents([newIncident, ...incidents]);
    alert('แจ้งเหตุสำเร็จ ระบบได้ส่งเรื่องให้ผู้ดูแลหมู่บ้านแล้ว');
    
    // Reset form & go to history
    setTitle(''); setCategory(CATEGORIES[0]); setDesc(''); setLocation(''); setImage(null);
    setActiveTab('history');
  };

  const handleDeleteIncident = (id) => {
    if(window.confirm('คุณต้องการยกเลิกการแจ้งเหตุนี้ใช่หรือไม่? (ลบได้เฉพาะรายการที่ยังไม่ดำเนินการ)')) {
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
             <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">ประกาศจากหมู่บ้าน</h2>
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
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">รายละเอียดเพิ่มเติม <span className="text-red-500">*</span></label>
                  <textarea required value={desc} onChange={e=>setDesc(e.target.value)} className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition text-lg h-32 resize-none" placeholder="อธิบายลักษณะปัญหาที่พบเจอ..."></textarea>
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

  // CSS for Mock Pie Chart
  const pieStyle = {
    background: `conic-gradient(
      #EAB308 0% ${pPending}%, 
      #3B82F6 ${pPending}% ${pPending + pInProgress}%, 
      #22C55E ${pPending + pInProgress}% 100%
    )`
  };

  // --- Incident Handlers ---
  const updateIncidentStatus = (id, newStatus, resolvedImage = null) => {
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

        return { ...inc, status: newStatus, resolvedImage: resolvedImage || inc.resolvedImage };
      }
      return inc;
    });
    setIncidents(updated);
    setSelectedIncident(null);
  };

  const deleteIncident = (id) => {
    if(window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบการแจ้งเหตุนี้?')) {
      setIncidents(incidents.filter(i => i.id !== id));
      setSelectedIncident(null);
    }
  };

  // --- News Handlers ---
  const saveNews = (e) => {
    e.preventDefault();
    if(editingNews.id) {
      // Edit
      setNews(news.map(n => n.id === editingNews.id ? { ...editingNews, ...newsForm } : n));
    } else {
      // Add
      const newN = { 
        id: 'n' + Date.now(), 
        ...newsForm, 
        image: newsForm.image || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&q=80&w=400',
        date: new Date().toISOString().split('T')[0] 
      };
      setNews([newN, ...news]);
    }
    setEditingNews(null);
  };

  const deleteNews = (id) => {
    if(window.confirm('ยืนยันการลบข่าวสารนี้?')) {
      setNews(news.filter(n => n.id !== id));
    }
  };

  const startEditNews = (n = { title: '', content: '', image: '' }) => {
    setEditingNews(n);
    setNewsForm({ title: n.title, content: n.content, image: n.image });
  };

  // --- User Handlers ---
  const deleteUser = (id) => {
    if(window.confirm('แน่ใจหรือไม่ที่จะลบลูกบ้านท่านนี้ออกจากระบบ?')) {
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
              <p className="text-gray-500">สรุปข้อมูลการแจ้งเหตุและสถิติต่างๆ ภายในหมู่บ้าน</p>
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
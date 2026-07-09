export const MOCK_USERS = [
  { id: '1', name: 'ผู้ใหญ่บ้าน (Admin)', phone: 'admin', houseNo: '-', role: 'admin', password: 'admin1234' },
  { id: '2', name: 'สมชาย ใจดี', phone: '0811111111', houseNo: '99/10', role: 'user', password: '123' },
  { id: '3', name: 'สมหญิง รักสงบ', phone: '0822222222', houseNo: '99/11', role: 'user', password: '123' },
];

export const MOCK_NEWS = [
  { id: 'n1', title: 'ประกาศฉีดวัคซีนพิษสุนัขบ้าประจำปี', content: 'ขอเชิญลูกบ้านนำสัตว์เลี้ยงมาฉีดวัคซีน ณ ศาลาประชาคม ในวันที่ 15 ส.ค. นี้ ตั้งแต่เวลา 09.00 - 15.00 น. กรุณานำสมุดประจำตัวสัตว์เลี้ยงมาด้วย', image: 'https://images.unsplash.com/photo-1541364983171-a8ba01e95cfc?auto=format&fit=crop&q=80&w=400&h=300', date: '2026-03-10' },
  { id: 'n2', title: 'แจ้งตัดไฟชั่วคราวซอย 3', content: 'การไฟฟ้าจะทำการปรับปรุงสายไฟบริเวณซอย 3 วันเสาร์นี้ เวลา 09:00 - 12:00 น. ขออภัยในความไม่สะดวกครับ', image: 'https://images.unsplash.com/photo-1520256860188-f5e27a6fdf94?auto=format&fit=crop&q=80&w=400&h=300', date: '2026-03-11' },
];

export const MOCK_INCIDENTS = [
  { id: 'i1', userId: '2', userName: 'สมชาย ใจดี', houseNo: '99/10', title: 'ไฟถนนดับ', category: 'ไฟฟ้า/แสงสว่าง', description: 'ไฟหน้าปากซอย 2 ดับมา 3 วันแล้วครับ มืดมากอันตราย', location: 'ปากซอย 2', lat: 16.82, lng: 100.26, image: 'https://images.unsplash.com/photo-1519998246738-9cb5fb0d6cb2?auto=format&fit=crop&q=80&w=400', status: 'pending', date: '2026-03-12T08:00:00', firstResponseAt: null, resolvedAt: null, resolvedImage: null },
  { id: 'i2', userId: '2', userName: 'สมชาย ใจดี', houseNo: '99/10', title: 'ท่อประปาแตก', category: 'น้ำประปา', description: 'น้ำเจิ่งนองเต็มถนนซอย 5 รบกวนมาดูด่วนครับ', location: 'กลางซอย 5', lat: 16.821, lng: 100.262, image: 'https://images.unsplash.com/photo-1584061556956-613866299d0e?auto=format&fit=crop&q=80&w=400', status: 'in_progress', date: '2026-03-11T14:30:00', firstResponseAt: '2026-03-11T15:10:00', resolvedAt: null, resolvedImage: null },
  { id: 'i3', userId: '2', userName: 'สมชาย ใจดี', houseNo: '99/10', title: 'กิ่งไม้หักขวางทาง', category: 'อื่นๆ', description: 'พายุเมื่อคืนทำให้กิ่งไม้ใหญ่ร่วงมาขวางถนนหน้าสวนสาธารณะ', location: 'หน้าสวนสาธารณะ', lat: 16.822, lng: 100.261, image: 'https://images.unsplash.com/photo-1574955684496-d877f88da207?auto=format&fit=crop&q=80&w=400', status: 'resolved', date: '2026-03-09T09:15:00', firstResponseAt: '2026-03-09T10:00:00', resolvedAt: '2026-03-09T16:30:00', resolvedImage: 'https://images.unsplash.com/photo-1506450687799-d4da77395460?auto=format&fit=crop&q=80&w=400' },
  { id: 'i4', userId: '3', userName: 'สมหญิง รักสงบ', houseNo: '99/11', title: 'น้ำรั่วซ้ำบริเวณซอย 5', category: 'น้ำประปา', description: 'ท่อหน้าบ้านแตกซ้ำอีกครั้ง น้ำไหลแรงมาก เดินผ่านลำบากและเริ่มกระทบการเข้าออกบ้าน', location: 'กลางซอย 5', lat: 16.8212, lng: 100.2624, image: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&q=80&w=400', status: 'pending', date: '2026-03-13T07:40:00', firstResponseAt: null, resolvedAt: null, resolvedImage: null },
  { id: 'i5', userId: '3', userName: 'สมหญิง รักสงบ', houseNo: '99/11', title: 'ไฟกะพริบหน้าปากซอย 2', category: 'ไฟฟ้า/แสงสว่าง', description: 'ไฟถนนปากซอย 2 กะพริบทั้งคืน ทำให้ไม่ปลอดภัยและคนในซอยกังวลมาก', location: 'ปากซอย 2', lat: 16.8204, lng: 100.2603, image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&q=80&w=400', status: 'resolved', date: '2026-03-08T19:20:00', firstResponseAt: '2026-03-08T19:35:00', resolvedAt: '2026-03-09T08:50:00', resolvedImage: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&q=80&w=400' },
  { id: 'i6', userId: '2', userName: 'สมชาย ใจดี', houseNo: '99/10', title: 'สายไฟหย่อนต่ำ', category: 'ไฟฟ้า/แสงสว่าง', description: 'สายไฟบริเวณปากซอย 2 หย่อนต่ำมาก เสี่ยงอันตราย อยากให้มาตรวจด่วน', location: 'ปากซอย 2', lat: 16.8202, lng: 100.2601, image: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&q=80&w=400', status: 'in_progress', date: '2026-03-14T09:00:00', firstResponseAt: '2026-03-14T09:25:00', resolvedAt: null, resolvedImage: null },
];

export const MOCK_NOTIFS = [
  { id: 'not1', title: 'แจ้งเตือนข่าวสารใหม่', desc: 'ประกาศฉีดวัคซีนพิษสุนัขบ้าประจำปี', isRead: false, time: '2 ชม. ที่แล้ว' },
  { id: 'not2', title: 'อัปเดตสถานะงาน', desc: 'เรื่อง "กิ่งไม้หักขวางทาง" ได้รับการแก้ไขแล้ว', isRead: true, time: '1 วันที่แล้ว' },
];

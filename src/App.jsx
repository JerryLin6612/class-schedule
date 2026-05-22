import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  writeBatch
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, 
  Eye, 
  Edit3, 
  Plus, 
  Trash2, 
  Users, 
  LayoutGrid, 
  UserPlus, 
  X, 
  AlertTriangle, 
  RefreshCw, 
  ChevronDown,
  Wand2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Unlock
} from 'lucide-react';

const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || '{}');
const appId = import.meta.env.VITE_APP_ID || 'shift-manager-pro-v4';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_PASSWORD = '1234'; 

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'];

const SHIFT_TYPES = {
  'OFF': { label: '休假', start: '', end: '', hours: 0, group: 'rest', color: 'bg-rose-50 text-rose-600 border-rose-100 shadow-sm' },
  'PREOFF': { label: '預休', start: '', end: '', hours: 0, group: 'rest', color: 'bg-pink-50 text-pink-500 border-pink-100 shadow-sm' },
  '71': { label: '07:00–13:00', start: '07:00', end: '13:00', hours: 6, group: 'morning', color: 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm' },
  '73': { label: '07:00–15:00', start: '07:00', end: '15:00', hours: 8, group: 'morning', color: 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-sm' },
  '712': { label: '07:00–12:30', start: '07:00', end: '12:30', hours: 5.5, group: 'morning', color: 'bg-violet-50 text-violet-600 border-violet-100 shadow-sm' },
  'D': { label: '08:00–16:00', start: '08:00', end: '16:00', hours: 8, group: 'morning', color: 'bg-sky-50 text-sky-600 border-sky-100 shadow-sm' },
  '75': { label: '07:00–17:00', start: '07:00', end: '17:00', hours: 10, group: 'mid', color: 'bg-blue-50 text-blue-600 border-blue-100 shadow-sm' },
  '105': { label: '10:00–17:00', start: '10:00', end: '17:00', hours: 7, group: 'mid', color: 'bg-cyan-50 text-cyan-600 border-cyan-100 shadow-sm' },
  '119': { label: '11:30–21:30', start: '11:30', end: '21:30', hours: 10, group: 'evening', color: 'bg-amber-50 text-amber-600 border-amber-100 shadow-sm' },
  '210': { label: '14:30–22:30', start: '14:30', end: '22:30', hours: 8, group: 'evening', color: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' },
  'OTHER': { label: '其他', start: '', end: '', hours: 0, group: 'other', color: 'bg-slate-50 text-slate-600 border-slate-100 shadow-sm' },
};

const INITIAL_EMPLOYEES = ["唐美鳳", "李采樺", "吳麗綸", "梁佳榆", "陳沛涵", "林素真", "陳楨梅", "廖芳羽", "吳楷淳", "廖千琪"];
const SENIOR_STAFF = ["唐美鳳", "李采樺", "吳麗綸"];

const App = () => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); 
  const [viewMode, setViewMode] = useState('team'); 
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState({});
  const [editState, setEditState] = useState(null); 
  const [isEmpManageOpen, setIsEmpManageOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [hasCleanedUp, setHasCleanedUp] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // 💡 確保只有這裡有一段 monthlyTotalHours
  const monthlyTotalHours = useMemo(() => {
    if (viewMode !== 'individual' || !selectedEmployee) return 0;
    const yr = currentDate.getFullYear();
    const mo = currentDate.getMonth();
    const daysCount = getDaysInMonth(yr, mo);
    let total = 0;
    for (let d = 1; d <= daysCount; d++) {
      const shift = shifts[`${selectedEmployee}_${yr}-${mo + 1}-${d}`];
      if (shift?.code && SHIFT_TYPES[shift.code]) {
        total += SHIFT_TYPES[shift.code].hours;
      }
    }
    return total;
  }, [viewMode, selectedEmployee, shifts, currentDate]);

  const years = useMemo(() => {
    const cy = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => cy - 2 + i);
  }, []);

  const months = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

  const showToast = useCallback((txt) => {
    setMessage(txt);
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const handleUnlock = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowAuthModal(false);
      setPasswordInput('');
      showToast('✅ 編輯模式已解鎖');
    } else {
      showToast('❌ 密碼錯誤');
      setPasswordInput('');
    }
  };

  const handleExportExcel = () => {
    const yr = currentDate.getFullYear();
    const mo = currentDate.getMonth();
    const daysCount = getDaysInMonth(yr, mo);
    let csvContent = '\uFEFF'; 
    let headers = ['員工姓名'];
    for (let d = 1; d <= daysCount; d++) headers.push(`${mo + 1}/${d}`);
    headers.push('當月總時數');
    csvContent += headers.join(',') + '\n';

    employees.forEach(emp => {
      let row = [emp.name];
      let totalH = 0;
      for (let d = 1; d <= daysCount; d++) {
        const sd = shifts[`${emp.id}_${yr}-${mo + 1}-${d}`];
        const code = sd?.code || '';
        row.push(code);
        if (code && SHIFT_TYPES[code]) totalH += SHIFT_TYPES[code].hours;
      }
      row.push(totalH);
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${yr}年${mo + 1}月_班表總表.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📊 班表已成功匯出');
  };

  const handleAddEmployee = async () => {
    if (!newEmpName.trim()) return;
    try {
      const empRef = collection(db, 'artifacts', appId, 'public', 'data', 'employees');
      await addDoc(empRef, { name: newEmpName.trim(), order: employees.length, createdAt: new Date().toISOString() });
      setNewEmpName('');
      showToast(`已新增員工: ${newEmpName}`);
    } catch (err) { showToast("新增失敗"); }
  };

  const handleDeleteEmployee = (id, name) => {
    setConfirmDialog({
      title: "刪除員工",
      message: `確定要刪除員工「${name}」嗎？\n這將不會刪除其過去的排班記錄，但會從名單中永久移除。`,
      isWarning: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'employees', id));
          showToast(`已移除員工: ${name}`);
        } catch (err) { showToast("移除失敗"); }
      }
    });
  };

  const handleSaveShift = async (day, empId, code) => {
    if (!user || !code) return;
    const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${day}`;
    const docId = `${empId}_${dateKey}`;
    const info = SHIFT_TYPES[code];
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'shifts', docId), {
        employeeId: empId, date: dateKey, code: code,
        startTime: info.start, endTime: info.end,
        totalHours: info.hours, updatedAt: new Date().toISOString()
      });
      showToast(`儲存成功`);
      setEditState(null);
    } catch (err) { showToast("儲存失敗"); }
  };

  const handleDeleteShift = async (day, empId) => {
    if (!user) return;
    const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${day}`;
    const docId = `${empId}_${dateKey}`;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'shifts', docId), { code: null, totalHours: 0 }); 
      showToast("排班已取消");
      setEditState(null);
    } catch (err) { showToast("清除失敗"); }
  };

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const empRef = collection(db, 'artifacts', appId, 'public', 'data', 'employees');
    return onSnapshot(empRef, async (snapshot) => {
      let list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      if (list.length === 0) {
        for (let i = 0; i < INITIAL_EMPLOYEES.length; i++) {
          await addDoc(empRef, { name: INITIAL_EMPLOYEES[i], order: i, createdAt: new Date().toISOString() });
        }
      } else {
        const sorted = list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
        setEmployees(sorted);
        if (sorted.length > 0 && !selectedEmployee) setSelectedEmployee(sorted[0].id);
      }
    });
  }, [user, selectedEmployee]);

  useEffect(() => {
    if (!user) return;
    const shiftsRef = collection(db, 'artifacts', appId, 'public', 'data', 'shifts');
    return onSnapshot(shiftsRef, (snapshot) => {
      const data = {};
      snapshot.forEach(doc => data[doc.id] = doc.data());
      setShifts(data);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!isAdmin || !shifts || Object.keys(shifts).length === 0 || hasCleanedUp) return;
    const cleanup = async () => {
      const limitDate = new Date();
      limitDate.setFullYear(limitDate.getFullYear() - 2);
      limitDate.setDate(1);
      const toDelete = [];
      Object.entries(shifts).forEach(([id, d]) => {
        if (d.date) {
          const [y, m, day] = d.date.split('-').map(Number);
          if (new Date(y, m - 1, day) < limitDate) toDelete.push(id);
        }
      });
      for (const id of toDelete) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'shifts', id));
      setHasCleanedUp(true);
    };
    cleanup();
  }, [isAdmin, shifts, hasCleanedUp]);

  const triggerAutoSchedule = () => {
    if (!employees || employees.length === 0) { showToast("目前無員工資料"); return; }
    const yr = currentDate.getFullYear();
    const mo = currentDate.getMonth();
    const daysCount = getDaysInMonth(yr, mo);
    let mwfCount = 0; let ttsCount = 0; let sunCount = 0;
    for (let d = 1; d <= daysCount; d++) {
      const wd = new Date(yr, mo, d).getDay();
      if (wd === 0) sunCount++; else if (wd === 1 || wd === 3 || wd === 5) mwfCount++; else ttsCount++;
    }
    const shiftsNeeded = (mwfCount * 9) + (ttsCount * 8);
    const maxShiftsAvailable = employees.length * (daysCount - sunCount - 4);
    let isWarning = false;
    let dialogMessage = `即將執行一鍵自動排班：\n1. 鎖定已設定的預休\n2. 週日自動排休\n3. 符合四例四休\n4. 嚴守 11 小時休息\n5. 平均分攤早中晚班\n\n`;
    if (maxShiftsAvailable < shiftsNeeded) {
      isWarning = true;
      dialogMessage += `⚠️ 【人力透支警告】相差了 ${shiftsNeeded - maxShiftsAvailable} 班！確定仍要排班嗎？`;
    } else {
      dialogMessage += `✅ 人力檢測通過！確定開始執行嗎？`;
    }
    setConfirmDialog({
      title: "執行自動排班",
      message: dialogMessage,
      isWarning: isWarning,
      onConfirm: () => { executeAutoSchedule(); }
    });
  };

  const executeAutoSchedule = async () => {
    setIsGenerating(true);
    try {
      const yr = currentDate.getFullYear(), mo = currentDate.getMonth();
      const daysCount = getDaysInMonth(yr, mo);
      const batch = writeBatch(db);
      const localStats = {}; const localShifts = {}; 
      employees.forEach(e => { localStats[e.id] = { morning: 0, mid: 0, evening: 0, hours: 0, extraOffs: 0 }; });

      const MWF_POOL = ['71', '73', '73', '75', '75', '75', '119', '210', '210'];
      const TTS_POOL = ['71', '71', '75', '75', '75', '75', '105', '105'];

      for (let d = 1; d <= daysCount; d++) {
        const dateStr = `${yr}-${mo + 1}-${d}`;
        const dayOfWeek = new Date(yr, mo, d).getDay();
        const isSun = dayOfWeek === 0;
        const isMWF = dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5;
        const isTTS = dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 6;

        let unassignedPool = isMWF ? [...MWF_POOL] : (isTTS ? [...TTS_POOL] : []);
        let availableEmps = [];

        employees.forEach(emp => {
          const shiftKey = `${emp.id}_${dateStr}`;
          const existing = shifts[shiftKey];
          if (isSun) {
            if (!existing?.code || existing.code === 'OFF') {
              batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'shifts', shiftKey), { employeeId: emp.id, date: dateStr, code: 'OFF', totalHours: 0, updatedAt: new Date().toISOString() });
              localShifts[`${emp.id}_${d}`] = 'OFF';
            }
          } else if (existing?.code && existing.code !== 'OFF' && existing.code !== 'PREOFF') {
            const idx = unassignedPool.indexOf(existing.code);
            if (idx > -1) unassignedPool.splice(idx, 1);
            const g = SHIFT_TYPES[existing.code]?.group;
            if (g) { localStats[emp.id][g]++; }
            localStats[emp.id].hours += (SHIFT_TYPES[existing.code]?.hours || 0);
            localShifts[`${emp.id}_${d}`] = existing.code;
          } else if (existing?.code === 'PREOFF' || existing?.code === 'OFF') {
            localShifts[`${emp.id}_${d}`] = existing.code; localStats[emp.id].extraOffs++;
          } else { availableEmps.push(emp); }
        });

        if (isSun) continue;

        const assign = (emp, code) => {
          const info = SHIFT_TYPES[code];
          const shiftKey = `${emp.id}_${dateStr}`;
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'shifts', shiftKey), { employeeId: emp.id, date: dateStr, code, totalHours: info.hours, updatedAt: new Date().toISOString() });
          localStats[emp.id].hours += info.hours;
          if (info.group) localStats[emp.id][info.group]++;
          if (code === 'OFF' || code === 'PREOFF') localStats[emp.id].extraOffs++;
          localShifts[`${emp.id}_${d}`] = code;
          const idx = availableEmps.findIndex(e => e.id === emp.id);
          if (idx > -1) availableEmps.splice(idx, 1);
        };

        const canTakeEarly = (empId, dayIdx) => {
          const yestCode = localShifts[`${empId}_${dayIdx-1}`] || shifts[`${empId}_${yr}-${mo + 1}-${dayIdx-1}`]?.code;
          return yestCode !== '119' && yestCode !== '210';
        };

        let remainingNonSundays = 0;
        for (let x = d; x <= daysCount; x++) { if (new Date(yr, mo, x).getDay() !== 0) remainingNonSundays++; }

        const empsToForceOff = [];
        availableEmps = availableEmps.filter(emp => {
            const neededOffs = 4 - localStats[emp.id].extraOffs;
            if (neededOffs > 0 && remainingNonSundays <= neededOffs) { empsToForceOff.push(emp); return false; }
            return true;
        });
        empsToForceOff.forEach(emp => { assign(emp, 'OFF'); });

        while (unassignedPool.length > availableEmps.length) {
            const dropOrder = ['75', '73', '210', '105', '71', '119'];
            let dropped = false;
            for (let code of dropOrder) {
                const idx = unassignedPool.indexOf(code);
                if (idx > -1) { unassignedPool.splice(idx, 1); dropped = true; break; }
            }
            if (!dropped) unassignedPool.pop(); 
        }

        let eveningCodes = unassignedPool.filter(c => SHIFT_TYPES[c].group === 'evening');
        let morningCodes = unassignedPool.filter(c => SHIFT_TYPES[c].group === 'morning');
        let midCodes = unassignedPool.filter(c => SHIFT_TYPES[c].group === 'mid');
        let eSeniorAssigned = false, mSeniorAssigned = false;

        eveningCodes.forEach(code => {
            availableEmps.sort((a, b) => {
                if (!eSeniorAssigned) { const aSr = SENIOR_STAFF.includes(a.name), bSr = SENIOR_STAFF.includes(b.name); if (aSr && !bSr) return -1; if (!aSr && bSr) return 1; }
                if (localStats[a.id].extraOffs !== localStats[b.id].extraOffs) return localStats[b.id].extraOffs - localStats[a.id].extraOffs;
                if (localStats[a.id].evening !== localStats[b.id].evening) return localStats[a.id].evening - localStats[b.id].evening;
                return localStats[a.id].hours - localStats[b.id].hours;
            });
            const target = availableEmps[0];
            if (target) { if (SENIOR_STAFF.includes(target.name)) eSeniorAssigned = true; assign(target, code); }
        });

        morningCodes.forEach(code => {
            let eligible = availableEmps.filter(e => canTakeEarly(e.id, d));
            if (eligible.length === 0) eligible = availableEmps; 
            eligible.sort((a, b) => {
                if (!mSeniorAssigned) { const aSr = SENIOR_STAFF.includes(a.name), bSr = SENIOR_STAFF.includes(b.name); if (aSr && !bSr) return -1; if (!aSr && bSr) return 1; }
                if (localStats[a.id].extraOffs !== localStats[b.id].extraOffs) return localStats[b.id].extraOffs - localStats[a.id].extraOffs;
                if (localStats[a.id].morning !== localStats[b.id].morning) return localStats[a.id].morning - localStats[b.id].morning;
                return localStats[a.id].hours - localStats[b.id].hours;
            });
            const target = eligible[0];
            if (target) { if (SENIOR_STAFF.includes(target.name)) mSeniorAssigned = true; assign(target, code); }
        });

        midCodes.forEach(code => {
            availableEmps.sort((a, b) => {
                if (localStats[a.id].extraOffs !== localStats[b.id].extraOffs) return localStats[b.id].extraOffs - localStats[a.id].extraOffs;
                if (localStats[a.id].mid !== localStats[b.id].mid) return localStats[a.id].mid - localStats[b.id].mid;
                return localStats[a.id].hours - localStats[b.id].hours;
            });
            const target = availableEmps[0]; if (target) assign(target, code);
        });
        [...availableEmps].forEach(emp => { assign(emp, 'OFF'); });
      }
      await batch.commit(); showToast("自動排班執行完畢！");
    } catch (e) { console.error(e); showToast("排班發生錯誤"); } finally { setIsGenerating(false); }
  };

  const CustomSelect = ({ label, value, onChange, options }) => (
    <div className="relative group text-left">
      <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10">{label}</label>
      <div className="relative">
        <select value={value} onChange={onChange} className="w-full appearance-none bg-white border border-slate-100 rounded-2xl p-4 pr-10 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-50 transition-all cursor-pointer shadow-sm">
          {options.map(o => <option key={o.value} value={o.value}>{String(o.label)}</option>)}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300"><ChevronDown className="w-4 h-4" /></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-10 selection:bg-indigo-100">
      
      {message && <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[400] bg-white border px-8 py-4 rounded-full shadow-2xl flex items-center gap-3"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div><span className="font-bold text-sm">{message}</span></div>}
      
      {confirmDialog && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`bg-white rounded-[2rem] shadow-2xl max-w-md w-full p-8 text-left animate-in zoom-in-95 ${confirmDialog.isWarning ? 'border-2 border-rose-400' : 'border border-white'}`}>
            <h3 className={`text-2xl font-black mb-4 ${confirmDialog.isWarning ? 'text-rose-600 flex items-center gap-2' : 'text-slate-800'}`}>{confirmDialog.isWarning && <AlertTriangle className="w-6 h-6" />}{confirmDialog.title}</h3>
            <p className="text-slate-500 font-bold mb-8 whitespace-pre-line leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-4 rounded-2xl font-black text-slate-400 bg-slate-100 hover:bg-slate-200 transition-all">取消</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className={`flex-1 py-4 rounded-2xl font-black text-white shadow-lg transition-all active:scale-95 ${confirmDialog.isWarning ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}>確認執行</button>
            </div>
          </div>
        </div>
      )}
      
      {showAuthModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-8 text-center animate-in zoom-in-95 border border-white">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600"><Lock className="w-8 h-8" /></div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">編輯者驗證</h3>
            <p className="text-slate-500 font-bold mb-6 text-xs">為保護排班資料，請輸入管理員密碼解鎖</p>
            <input type="password" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center text-xl tracking-widest font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all mb-6" placeholder="••••" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUnlock()} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => {setShowAuthModal(false); setPasswordInput('');}} className="flex-1 py-3.5 rounded-2xl font-black text-slate-400 bg-slate-100 hover:bg-slate-200 transition-all">返回</button>
              <button onClick={handleUnlock} className="flex-1 py-3.5 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95">解鎖</button>
            </div>
          </div>
        </div>
      )}

      {editState && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full p-6 text-left relative">
            <button onClick={() => setEditState(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            <h3 className="text-xl font-black text-slate-800 mb-6">設定班別 - {editState.day}日</h3>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {Object.entries(SHIFT_TYPES).map(([code, info]) => (
                <button key={code} onClick={() => handleSaveShift(editState.day, editState.empId, code)} className={`p-3 rounded-2xl border font-bold text-sm transition-all hover:scale-105 active:scale-95 flex flex-col items-center justify-center ${info.color}`}>
                  <div className="text-lg mb-1">{code}</div>
                  <div className="text-[10px] opacity-80">{info.label}</div>
                </button>
              ))}
            </div>
            <button onClick={() => handleDeleteShift(editState.day, editState.empId)} className="w-full py-3 rounded-xl border border-rose-100 text-rose-500 font-bold flex items-center justify-center gap-2 hover:bg-rose-50 transition-all"><Trash2 className="w-4 h-4"/> 清除此班表</button>
          </div>
        </div>
      )}

      {isEmpManageOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full p-8 relative">
            <button onClick={() => setIsEmpManageOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2"><Users className="w-6 h-6"/> 管理團隊</h3>
            <div className="flex gap-2 mb-6">
              <input type="text" value={newEmpName} onChange={e => setNewEmpName(e.target.value)} placeholder="輸入新員工姓名" className="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100" onKeyDown={e => e.key === 'Enter' && handleAddEmployee()} />
              <button onClick={handleAddEmployee} className="px-4 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-all">新增</button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-2">
              {employees.map(emp => (
                <div key={emp.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-700">{emp.name}</span>
                  <button onClick={() => handleDeleteEmployee(emp.id, emp.name)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <header className="max-w-7xl mx-auto mb-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="relative p-5 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-[2.5rem] shadow-xl text-white"><CalendarIcon className="w-8 h-8" /></div>
          <div className="text-left">
            <h1 className="text-4xl font-black text-slate-800 tracking-tightest">雲端班表系統</h1>
            <div className="flex items-center gap-3 mt-1.5">
               <p className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-[0.2em]"><Sparkles className="w-3 h-3 text-indigo-400" /> Smart Algorithm V4.0</p>
               {isAdmin ? <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md text-[10px] font-black flex items-center gap-1"><Unlock className="w-3 h-3"/> 已解鎖</span> : <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-md text-[10px] font-black flex items-center gap-1"><Lock className="w-3 h-3"/> 唯讀模式</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 bg-white/60 backdrop-blur-md p-2 rounded-[2rem] border shadow-sm">
          <div className="flex bg-slate-100/80 p-1 rounded-[1.5rem]">
            {[{ id: 'individual', icon: LayoutGrid, label: '個人' }, { id: 'team', icon: Users, label: '團隊' }].map(m => (
              <button key={m.id} onClick={() => setViewMode(m.id)} className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[11px] font-black transition-all ${viewMode === m.id ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><m.icon className="w-3.5 h-3.5" /> {m.label}</button>
            ))}
          </div>
          <div className="flex bg-white p-1 rounded-[1.5rem] border shadow-sm">
            <button onClick={() => setIsAdmin(false)} className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[11px] font-black transition-all ${!isAdmin ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:text-slate-600'}`}><Eye className="w-3.5 h-3.5" /> 檢視</button>
            <button onClick={() => { if(!isAdmin) setShowAuthModal(true); }} className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[11px] font-black transition-all ${isAdmin ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:text-slate-600'}`}><Edit3 className="w-3.5 h-3.5" /> 編輯</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-10">
        <aside className="lg:col-span-1 space-y-8 text-left">
          <section className="bg-white p-8 rounded-[3rem] shadow-sm border flex flex-col gap-6">
            <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] px-1 text-left">條件設定</h3>
            <div className="space-y-6">
              {viewMode === 'individual' && <CustomSelect label="選取對象" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} options={employees.map(e => ({value: e.id, label: e.name}))} />}
              <div className="grid grid-cols-2 gap-4">
                <CustomSelect label="年度" value={currentDate.getFullYear()} onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth(), 1))} options={years.map(y => ({value: y, label: `${y}年`}))} />
                <CustomSelect label="月份" value={currentDate.getMonth()} onChange={(e) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value), 1))} options={months.map((m, i) => ({value: i, label: m}))} />
              </div>
            </div>
            {isAdmin && <button onClick={() => setIsEmpManageOpen(true)} className="w-full py-5 rounded-[2rem] border-2 border-dashed text-slate-400 font-bold text-[11px] flex items-center justify-center gap-3 hover:bg-slate-50 transition-all uppercase tracking-widest"><UserPlus className="w-4 h-4" /> 管理團隊</button>}
          </section>
          <section className={`${viewMode==='individual'?'bg-indigo-600':'bg-slate-900'} p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group text-left`}>
            <div className="relative z-10">
              <h3 className="text-[10px] font-black opacity-50 uppercase tracking-[0.3em] mb-8">{viewMode==='individual'?'Monthly Total':'Team Size'}</h3>
              <div className="flex items-baseline gap-2"><span className="text-7xl font-black tabular-nums">{viewMode==='individual' ? monthlyTotalHours : employees.length}</span><span className="opacity-50 font-black text-xl">{viewMode==='individual'?'H':'人'}</span></div>
              <div className="mt-8 h-1.5 w-full bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white rounded-full transition-all duration-1000" style={{width: `${viewMode==='individual' ? Math.min(monthlyTotalHours/1.6, 100) : 100}%`}}></div></div>
              <p className="text-[11px] font-bold opacity-60 mt-4">{viewMode==='individual' ? (employees.find(e=>e.id===selectedEmployee)?.name || '未選取') : '系統依據指定順序排列'}</p>
            </div>
          </section>
        </aside>
        <section className="lg:col-span-3">
          <div className="bg-white rounded-[3rem] shadow-sm border overflow-hidden relative min-h-[600px]">
            <div className="p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/50 backdrop-blur-sm border-b border-slate-50">
              <div className="flex items-center gap-6">
                <div className="flex gap-2">
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-3.5 hover:bg-slate-50 rounded-2xl border shadow-sm transition-all active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-3.5 hover:bg-slate-50 rounded-2xl border shadow-sm transition-all active:scale-90"><ChevronRight className="w-5 h-5" /></button>
                </div>
                <h2 className="text-4xl font-black text-slate-800 tracking-tighter">{currentDate.getFullYear()}年 {months[currentDate.getMonth()]}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {viewMode === 'team' && <button onClick={handleExportExcel} className="px-5 py-4 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-2xl font-black shadow-sm transition-all active:scale-95 flex items-center gap-2"><Download className="w-5 h-5" /><span className="hidden sm:inline">匯出 Excel</span></button>}
                {isAdmin && viewMode === 'team' && <button onClick={triggerAutoSchedule} disabled={isGenerating} className="px-6 py-4 bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50">{isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}{isGenerating ? '正在排班...' : '自動排班'}</button>}
              </div>
            </div>
            <div className="p-10">
              {loading ? <div className="h-[500px] flex items-center justify-center flex-col gap-4"><RefreshCw className="w-12 h-12 text-indigo-100 animate-spin" /><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-left">資料同步中...</span></div> : (
                viewMode === 'individual' ? (
                  <>
                    <div className="grid grid-cols-7 gap-6 mb-8 px-2">{['週日', '週一', '週二', '週三', '週四', '週五', '週六'].map((d, idx) => <div key={d} className={`text-center text-[12px] font-bold uppercase tracking-[0.2em] ${idx === 0 ? 'text-rose-400': idx === 6 ? 'text-indigo-400':'text-slate-300'}`}>{d}</div>)}</div>
                    <div className="grid grid-cols-7 gap-4">
                      {(() => {
                        const yr = currentDate.getFullYear(), mo = currentDate.getMonth();
                        const ds = getDaysInMonth(yr, mo), fst = getFirstDayOfMonth(yr, mo);
                        const cells = [];
                        for (let i = 0; i < fst; i++) cells.push(<div key={`e-${i}`} className="h-28 md:h-32 bg-slate-50/20 rounded-2xl"></div>);
                        for (let d = 1; d <= ds; d++) {
                          const sd = shifts[`${selectedEmployee}_${yr}-${mo+1}-${d}`]; const has = sd?.code && SHIFT_TYPES[sd.code]; const dow = new Date(yr, mo, d).getDay(); const isSun = dow === 0;
                          cells.push(
                            <div key={d} onClick={() => isAdmin && selectedEmployee && setEditState({ day: d, empId: selectedEmployee })} className={`h-28 md:h-32 p-3 rounded-2xl border transition-all ${isAdmin ? 'cursor-pointer hover:border-indigo-200 shadow-sm' : ''} flex flex-col justify-between ${has ? SHIFT_TYPES[sd.code].color : isSun ? 'bg-rose-50/20 border-rose-100/50' : 'bg-white border-slate-100'}`}>
                              <div className="flex justify-between items-start z-10"><div className={`flex flex-col items-start ${has ? 'text-current' : isSun ? 'text-rose-400' : 'text-slate-400'}`}><span className="text-[14px] font-black leading-none">{d}</span><span className="text-[10px] font-bold opacity-60 mt-1">週{WEEKDAYS_ZH[dow]}</span></div>{has && <div className="text-[10px] bg-white/40 px-2 py-0.5 rounded-full font-black backdrop-blur-sm">{SHIFT_TYPES[sd.code].hours}h</div>}</div>
                              <div className="mt-auto z-10">{has ? <div className="text-left"><div className="text-xl font-black tracking-tighter leading-tight">{String(sd.code)}</div><div className="text-[10px] font-medium opacity-70 truncate">{SHIFT_TYPES[sd.code].label}</div></div> : (isAdmin && selectedEmployee && <Plus className="w-4 h-4 text-slate-200 group-hover:text-indigo-400 ml-auto" />)}</div>
                            </div>
                          );
                        }
                        return cells;
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-white/50 shadow-sm scrollbar-hide">
                    <table className="w-full min-w-[1000px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="sticky left-0 z-20 bg-slate-50 p-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest min-w-[120px]">員工姓名</th>
                          {Array.from({ length: getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth()) }, (_, i) => i + 1).map(d => {
                            const dow = new Date(currentDate.getFullYear(), currentDate.getMonth(), d).getDay(); const isSun = dow === 0; const isSpecial = (dow === 2 || dow === 4 || dow === 6);
                            return <th key={d} title={isSpecial ? "本日無夜班" : ""} className={`p-2 py-3 text-center border-l border-slate-100/50 min-w-[46px] ${isSun ? 'text-rose-500 bg-rose-50/50' : isSpecial ? 'text-indigo-500 bg-indigo-50/20' : 'text-slate-500'}`}><div className="text-[13px] font-black">{d}</div><div className="text-[10px] font-bold opacity-70 mt-0.5">週{WEEKDAYS_ZH[dow]}</div></th>
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map(emp => (
                          <tr key={emp.id} className="group border-t border-slate-50 hover:bg-slate-50/30 transition-colors">
                            <td className="sticky left-0 z-10 bg-white p-4 font-semibold text-slate-700 flex items-center gap-2 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.02)] group-hover:text-indigo-600">{String(emp.name)}{SENIOR_STAFF.includes(emp.name) && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm"></span>}</td>
                            {Array.from({ length: getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth()) }, (_, i) => i + 1).map(d => {
                              const sd = shifts[`${emp.id}_${currentDate.getFullYear()}-${currentDate.getMonth()+1}-${d}`]; const has = sd?.code && SHIFT_TYPES[sd.code];
                              return <td key={d} onClick={() => isAdmin && setEditState({ day: d, empId: emp.id })} className={`p-1 text-center border-l border-slate-50/50 h-14 ${isAdmin ? 'cursor-pointer hover:bg-slate-100' : ''} ${has ? SHIFT_TYPES[sd.code].color : ''}`}>{has ? <div className="flex flex-col items-center leading-none"><span className="text-[13px] font-black tracking-tighter mb-0.5">{String(sd.code)}</span><span className="text-[9px] font-medium opacity-60">{SHIFT_TYPES[sd.code].hours}h</span></div> : <span className="text-slate-100 group-hover:text-slate-300 text-xs">{isAdmin ? '＋' : ''}</span>}</td>
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;

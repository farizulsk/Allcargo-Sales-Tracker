import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  LayoutDashboard, Store, Plus, Search, LogOut, 
  TrendingUp, Target, Calendar, AlertCircle, 
  X, Send, ArrowUpRight, ArrowDownRight, Settings, 
  Truck, Moon, Sun, Trash2, Edit3, Info, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut 
} from 'firebase/auth';
import { 
  collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc, 
  orderBy 
} from 'firebase/firestore';
import { auth, db, handleFirestoreError } from './firebase';
import { Franchise, DashboardStats, OperationType } from './types';
import { cn, formatCurrency, calculateAchievementRate } from './lib/utils';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FranchiseCard } from './components/FranchiseCard';

// --- Components ---

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden", className)} {...props}>
    {children}
  </div>
);

const StatCard = ({ title, value, subValue, icon: Icon, colorClass, trend }: any) => (
  <Card className="p-6">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
        {trend && (
          <div className={cn("flex items-center mt-2 text-xs font-medium", trend > 0 ? "text-green-600" : "text-red-600")}>
            {trend > 0 ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowDownRight size={14} className="mr-1" />}
            {Math.abs(trend)}% vs last month
          </div>
        )}
      </div>
      <div className={cn("p-3 rounded-xl", colorClass)}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </Card>
);

const ProgressBar = ({ progress, color }: { progress: number; color: string }) => (
  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(progress, 100)}%` }}
      transition={{ duration: 1, ease: "easeOut" }}
      className={cn("h-full rounded-full", color)}
    />
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'franchises' | 'settings'>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isEditTargetsOpen, setIsEditTargetsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState<Franchise | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    target: '',
    achievement: '',
    yesterdaySale: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'franchises'),
      where('ownerUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Franchise[];
      setFranchises(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'franchises');
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const stats: DashboardStats = React.useMemo(() => {
    const totalTarget = franchises.reduce((acc, f) => acc + f.target, 0);
    const totalAchievement = franchises.reduce((acc, f) => acc + f.achievement, 0);
    const totalYesterdaySale = franchises.reduce((acc, f) => acc + f.yesterdaySale, 0);
    const achievementRate = calculateAchievementRate(totalAchievement, totalTarget);
    const remainingTarget = Math.max(0, totalTarget - totalAchievement);

    return {
      totalTarget,
      totalAchievement,
      totalYesterdaySale,
      achievementRate,
      remainingTarget
    };
  }, [franchises]);

  const filteredFranchises = franchises
    .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload = {
      name: formData.name,
      target: Number(formData.target),
      achievement: Number(formData.achievement),
      yesterdaySale: Number(formData.yesterdaySale),
      ownerUid: user.uid,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingFranchise) {
        await updateDoc(doc(db, 'franchises', editingFranchise.id), payload);
      } else {
        await addDoc(collection(db, 'franchises'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingFranchise(null);
      setFormData({ name: '', target: '', achievement: '', yesterdaySale: '' });
    } catch (error) {
      handleFirestoreError(error, editingFranchise ? OperationType.UPDATE : OperationType.CREATE, 'franchises');
    }
  };

  const handleUpdateAmount = async (id: string, amount: number) => {
    const franchise = franchises.find(f => f.id === id);
    if (!franchise) return;

    const numAmount = Number(amount);
    if (isNaN(numAmount)) return;

    try {
      await updateDoc(doc(db, 'franchises', id), {
        achievement: franchise.achievement + numAmount,
        yesterdaySale: numAmount, // Latest entry only
        lastAddedAmount: numAmount,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'franchises');
    }
  };

  const handleUndoAmount = async (id: string) => {
    const franchise = franchises.find(f => f.id === id);
    if (!franchise || !franchise.lastAddedAmount) return;

    try {
      await updateDoc(doc(db, 'franchises', id), {
        achievement: Math.max(0, franchise.achievement - franchise.lastAddedAmount),
        lastAddedAmount: 0,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'franchises');
    }
  };

  const handleWhatsApp = (f: Franchise) => {
    const rate = calculateAchievementRate(f.achievement, f.target);
    const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const message = `🚛 *Allcargo Sales Report*\n\n🔹 *OU: ${f.name}*\n📅 Date: ${date}\n\n• Target: *${formatCurrency(f.target)}*\n• Achieved: ${formatCurrency(f.achievement)} (${rate.toFixed(1)}%)\n• Yesterday: ${formatCurrency(f.yesterdaySale)}\n• Remaining: ${formatCurrency(Math.max(0, f.target - f.achievement))}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleResetData = async () => {
    try {
      const promises = franchises.map(f => 
        updateDoc(doc(db, 'franchises', f.id), {
          achievement: 0,
          yesterdaySale: 0,
          lastAddedAmount: 0,
          updatedAt: new Date().toISOString()
        })
      );
      await Promise.all(promises);
      setIsResetModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'franchises');
    }
  };

  const handleUpdateTarget = async (id: string, newTarget: number) => {
    try {
      await updateDoc(doc(db, 'franchises', id), {
        target: newTarget,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'franchises');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-200">
            <Truck size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Allcargo Sales</h1>
          <p className="text-gray-500 mb-10 text-lg">Track your franchises, monitor performance, and hit your targets with ease.</p>
          <button
            onClick={handleLogin}
            className="w-full py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-sm active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 pb-24 lg:pb-0 lg:pl-64">
        {/* Sidebar (Desktop) */}
        <aside className={cn(
          "hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-100 p-6 z-30 transition-colors",
          isDarkMode && "bg-gray-900 border-gray-800"
        )}>
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Truck size={24} className="text-white" />
            </div>
            <span className={cn("text-xl font-black text-gray-900", isDarkMode && "text-white")}>Allcargo Sales</span>
          </div>

          <nav className="space-y-2 flex-1">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all",
                activeTab === 'dashboard' ? "bg-blue-50 text-blue-600" : isDarkMode ? "text-gray-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <LayoutDashboard size={20} />
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('franchises')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all",
                activeTab === 'franchises' ? "bg-blue-50 text-blue-600" : isDarkMode ? "text-gray-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <Store size={20} />
              Franchises
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all",
                activeTab === 'settings' ? "bg-blue-50 text-blue-600" : isDarkMode ? "text-gray-400 hover:bg-gray-800" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <Settings size={20} />
              Settings
            </button>
          </nav>

          <div className="pt-6 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-4 px-2">
              <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="User" />
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-gray-900 truncate">{user.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Header (Mobile) */}
        <header className={cn(
          "lg:hidden bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-20 transition-colors",
          isDarkMode && "bg-gray-900 border-gray-800"
        )}>
          <div className="flex items-center gap-2">
            <Truck size={24} className="text-blue-600" />
            <span className={cn("text-lg font-black text-gray-900", isDarkMode && "text-white")}>Allcargo Sales</span>
          </div>
          <button onClick={handleLogout} className="text-gray-400">
            <LogOut size={20} />
          </button>
        </header>

        {/* Main Content */}
        <main className={cn("p-6 max-w-7xl mx-auto transition-colors min-h-screen", isDarkMode && "bg-gray-950")}>
          {activeTab === 'dashboard' ? (
            <div className="space-y-8">
              <header>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dashboard</h1>
                <p className="text-gray-500">Welcome back, {user.displayName?.split(' ')[0]}!</p>
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Total Target" 
                  value={formatCurrency(stats.totalTarget)} 
                  icon={Target} 
                  colorClass="bg-blue-600" 
                />
                <StatCard 
                  title="Achievement" 
                  value={formatCurrency(stats.totalAchievement)} 
                  subValue={`${stats.achievementRate.toFixed(1)}% of target`}
                  icon={TrendingUp} 
                  colorClass="bg-green-600" 
                />
                <StatCard 
                  title="Yesterday Sale" 
                  value={formatCurrency(stats.totalYesterdaySale)} 
                  icon={Calendar} 
                  colorClass="bg-orange-600" 
                />
                <StatCard 
                  title="Remaining" 
                  value={formatCurrency(stats.remainingTarget)} 
                  icon={AlertCircle} 
                  colorClass="bg-purple-600" 
                />
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Performance by Franchise</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={franchises.slice(0, 5)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                        <Tooltip 
                          cursor={{ fill: '#f9fafb' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="achievement" radius={[6, 6, 0, 0]}>
                          {franchises.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={calculateAchievementRate(entry.achievement, entry.target) >= 80 ? '#16a34a' : '#dc2626'} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Overall Progress</h3>
                  <div className="flex flex-col items-center justify-center h-[300px]">
                    <div className="relative w-48 h-48">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="96"
                          cy="96"
                          r="88"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="transparent"
                          className="text-gray-100"
                        />
                        <motion.circle
                          cx="96"
                          cy="96"
                          r="88"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="transparent"
                          strokeDasharray={552.9}
                          initial={{ strokeDashoffset: 552.9 }}
                          animate={{ strokeDashoffset: 552.9 - (552.9 * Math.min(stats.achievementRate, 100)) / 100 }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className="text-blue-600"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-black text-gray-900">{stats.achievementRate.toFixed(0)}%</span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Achieved</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Low Performers */}
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Low Performing Areas</h3>
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full uppercase">Action Required</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {franchises
                    .filter(f => calculateAchievementRate(f.achievement, f.target) < 50)
                    .map(f => (
                      <Card key={f.id} className="p-4 border-l-4 border-l-red-500">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-gray-900">{f.name}</h4>
                          <span className="text-xs font-bold text-red-600">
                            {calculateAchievementRate(f.achievement, f.target).toFixed(1)}%
                          </span>
                        </div>
                        <ProgressBar 
                          progress={calculateAchievementRate(f.achievement, f.target)} 
                          color="bg-red-500" 
                        />
                      </Card>
                    ))}
                  {franchises.filter(f => calculateAchievementRate(f.achievement, f.target) < 50).length === 0 && (
                    <p className="text-gray-400 text-sm italic">All areas are performing well!</p>
                  )}
                </div>
              </section>
            </div>
          ) : activeTab === 'franchises' ? (
            <div className="space-y-8 pb-32">
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-black text-gray-900 tracking-tight">Franchises</h1>
                  <p className="text-gray-500">Manage your sales units and targets.</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingFranchise(null);
                    setFormData({ name: '', target: '', achievement: '', yesterdaySale: '' });
                    setIsModalOpen(true);
                  }}
                  className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
                >
                  <Plus size={20} />
                  Add Franchise
                </button>
              </header>

              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type="text"
                    placeholder="Search franchises..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Franchise List - Modern Mobile Layout */}
              <div className="max-w-md mx-auto">
                <AnimatePresence mode="popLayout">
                  {filteredFranchises.map((f) => (
                    <FranchiseCard 
                      key={f.id}
                      franchise={f}
                      onUpdate={handleUpdateAmount}
                      onUndo={handleUndoAmount}
                      onWhatsApp={handleWhatsApp}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {filteredFranchises.length === 0 && (
                <div className="text-center py-20">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Store size={32} className="text-gray-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">No franchises found</h3>
                  <p className="text-gray-500">Try adjusting your search or add a new franchise.</p>
                </div>
              )}

              {/* Floating Action Button */}
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                  const report = franchises.map(f => {
                    const rate = calculateAchievementRate(f.achievement, f.target);
                    return `🔹 *OU: ${f.name}*\n• Achieved: ${formatCurrency(f.achievement)} (${rate.toFixed(1)}%)\n• Yesterday: ${formatCurrency(f.yesterdaySale)}`;
                  }).join('\n\n');
                  const message = `🚛 *Allcargo Daily Sales Summary*\n📅 Date: ${date}\n\n${report}\n\n━━━━━━━━━━━━━━━\n📊 *Total Achievement: ${stats.achievementRate.toFixed(1)}%*`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                }}
                className="fixed bottom-24 right-6 lg:bottom-10 lg:right-10 bg-green-600 text-white px-6 py-4 rounded-full font-black flex items-center gap-3 shadow-2xl shadow-green-200 z-40"
              >
                <Send size={20} />
                Send All Report
              </motion.button>
            </div>
          ) : (
            <div className="space-y-8 pb-32">
              <header>
                <h1 className={cn("text-3xl font-black text-gray-900 tracking-tight", isDarkMode && "text-white")}>Settings</h1>
                <p className="text-gray-500">Customize your app experience.</p>
              </header>

              <div className="space-y-4 max-w-2xl">
                {/* Dark Mode Toggle */}
                <Card className={cn("p-4 flex items-center justify-between", isDarkMode && "bg-gray-900 border-gray-800")}>
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 p-3 rounded-2xl text-blue-600">
                      {isDarkMode ? <Moon size={24} /> : <Sun size={24} />}
                    </div>
                    <div>
                      <h4 className={cn("font-bold text-gray-900", isDarkMode && "text-white")}>Dark Mode</h4>
                      <p className="text-xs text-gray-400">Switch between light and dark themes</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-colors",
                      isDarkMode ? "bg-blue-600" : "bg-gray-200"
                    )}
                  >
                    <motion.div 
                      animate={{ x: isDarkMode ? 24 : 4 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </Card>

                {/* Edit Targets */}
                <Card 
                  onClick={() => setIsEditTargetsOpen(true)}
                  className={cn("p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors", isDarkMode && "bg-gray-900 border-gray-800 hover:bg-gray-800")}
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-orange-100 p-3 rounded-2xl text-orange-600">
                      <Edit3 size={24} />
                    </div>
                    <div>
                      <h4 className={cn("font-bold text-gray-900", isDarkMode && "text-white")}>Edit Targets</h4>
                      <p className="text-xs text-gray-400">Update franchise monthly targets</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-gray-400" />
                </Card>

                {/* Reset Data */}
                <Card 
                  onClick={() => setIsResetModalOpen(true)}
                  className={cn("p-4 flex items-center justify-between cursor-pointer hover:bg-red-50 transition-colors group", isDarkMode && "bg-gray-900 border-gray-800 hover:bg-red-900/20")}
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-red-100 p-3 rounded-2xl text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                      <Trash2 size={24} />
                    </div>
                    <div>
                      <h4 className={cn("font-bold text-gray-900", isDarkMode && "text-white")}>Reset All Data</h4>
                      <p className="text-xs text-gray-400">Clear all achievements and sales</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-gray-400" />
                </Card>

                {/* App Version */}
                <Card className={cn("p-4 flex items-center justify-between", isDarkMode && "bg-gray-900 border-gray-800")}>
                  <div className="flex items-center gap-4">
                    <div className="bg-gray-100 p-3 rounded-2xl text-gray-600">
                      <Info size={24} />
                    </div>
                    <div>
                      <h4 className={cn("font-bold text-gray-900", isDarkMode && "text-white")}>App Version</h4>
                      <p className="text-xs text-gray-400">Current build information</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-400">v2.1.0 (Production)</span>
                </Card>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Nav (Mobile) */}
        <nav className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-around items-center z-30 transition-colors",
          isDarkMode && "bg-gray-900 border-gray-800"
        )}>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn("flex flex-col items-center gap-1", activeTab === 'dashboard' ? "text-blue-600" : "text-gray-400")}
          >
            <LayoutDashboard size={24} />
            <span className="text-[10px] font-bold uppercase">Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveTab('franchises')}
            className={cn("flex flex-col items-center gap-1", activeTab === 'franchises' ? "text-blue-600" : "text-gray-400")}
          >
            <Store size={24} />
            <span className="text-[10px] font-bold uppercase">Franchises</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn("flex flex-col items-center gap-1", activeTab === 'settings' ? "text-blue-600" : "text-gray-400")}
          >
            <Settings size={24} />
            <span className="text-[10px] font-bold uppercase">Settings</span>
          </button>
        </nav>

        {/* Modals */}
        <AnimatePresence>
          {isResetModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsResetModalOpen(false)}
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center"
              >
                <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Reset All Data?</h3>
                <p className="text-gray-500 mb-6">This will set all achievements and yesterday's sales to zero. This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsResetModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleResetData}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                  >
                    Reset Now
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {isEditTargetsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsEditTargetsOpen(false)}
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900">Edit Targets</h3>
                  <button onClick={() => setIsEditTargetsOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                  {franchises.map(f => (
                    <div key={f.id} className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-2xl">
                      <span className="font-bold text-gray-900 truncate flex-1">{f.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">₹</span>
                        <input 
                          type="number"
                          defaultValue={f.target}
                          onBlur={(e) => handleUpdateTarget(f.id, Number(e.target.value))}
                          className="w-24 px-2 py-1 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-gray-50 border-t border-gray-100">
                  <button 
                    onClick={() => setIsEditTargetsOpen(false)}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900">
                    {editingFranchise ? 'Edit Franchise' : 'New Franchise'}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Franchise Name</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      placeholder="e.g. Downtown Branch"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Target (₹)</label>
                      <input 
                        required
                        type="number"
                        value={formData.target}
                        onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Achievement (₹)</label>
                      <input 
                        required
                        type="number"
                        value={formData.achievement}
                        onChange={(e) => setFormData({ ...formData, achievement: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Yesterday's Sale (₹)</label>
                    <input 
                      required
                      type="number"
                      value={formData.yesterdaySale}
                      onChange={(e) => setFormData({ ...formData, yesterdaySale: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      placeholder="0"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold mt-4 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
                  >
                    {editingFranchise ? 'Save Changes' : 'Create Franchise'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

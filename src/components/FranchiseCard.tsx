import React, { useState } from 'react';
import { 
  MessageCircle, RotateCcw, RotateCw, Plus, AlertCircle, CheckCircle2, 
  TrendingUp, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Franchise } from '../types';
import { cn, formatCurrency, calculateAchievementRate } from '../lib/utils';

interface FranchiseCardProps {
  franchise: Franchise;
  onUpdate: (id: string, amount: number) => Promise<void>;
  onUndo: (id: string) => Promise<void>;
  onWhatsApp: (franchise: Franchise) => void;
}

export const FranchiseCard: React.FC<FranchiseCardProps> = ({ 
  franchise, 
  onUpdate, 
  onUndo, 
  onWhatsApp 
}) => {
  const [addAmount, setAddAmount] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const rate = calculateAchievementRate(franchise.achievement, franchise.target);
  const remaining = Math.max(0, franchise.target - franchise.achievement);
  const isAtRisk = rate < 50;
  const isGood = rate >= 80;

  const handleAdd = async () => {
    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    setIsUpdating(true);
    try {
      await onUpdate(franchise.id, amount);
      setAddAmount('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } finally {
      setIsUpdating(false);
    }
  };

  const initials = franchise.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 mb-4 relative overflow-hidden"
    >
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-green-600/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-white"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
            >
              <Check size={48} strokeWidth={3} />
            </motion.div>
            <p className="font-black mt-2 uppercase tracking-widest text-sm">Updated Successfully</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Row */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm tracking-tighter">
            {initials}
          </div>
          <h3 className="text-lg font-bold text-gray-900 tracking-tight">{franchise.name}</h3>
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
          isAtRisk ? "bg-red-50 text-red-600" : isGood ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"
        )}>
          {isAtRisk ? (
            <><AlertCircle size={12} /> At Risk</>
          ) : isGood ? (
            <><CheckCircle2 size={12} /> Good</>
          ) : (
            <><TrendingUp size={12} /> On Track</>
          )}
        </div>
      </div>

      {/* Second Row - Stats Grid */}
      <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-6">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Target</p>
          <p className="text-sm font-black text-gray-900">{formatCurrency(franchise.target)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Achieved</p>
          <p className="text-sm font-black text-gray-900">{formatCurrency(franchise.achievement)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Yesterday</p>
          <p className="text-sm font-black text-gray-900">{formatCurrency(franchise.yesterdaySale)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Remaining</p>
          <p className="text-sm font-black text-red-600">{formatCurrency(remaining)}</p>
        </div>
      </div>

      {/* Third Row - Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs font-bold text-gray-400">Monthly Progress</span>
          <span className={cn(
            "text-sm font-black",
            isAtRisk ? "text-red-600" : isGood ? "text-green-600" : "text-orange-600"
          )}>
            {rate.toFixed(1)}%
          </span>
        </div>
        <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(rate, 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              isAtRisk ? "bg-red-500" : isGood ? "bg-green-500" : "bg-orange-500"
            )}
          />
        </div>
      </div>

      {/* Fourth Row - Actions */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
          <input
            type="number"
            inputMode="numeric"
            value={addAmount}
            onChange={(e) => setAddAmount(e.target.value)}
            placeholder="Enter amount"
            className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all"
          />
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleAdd}
          disabled={isUpdating || !addAmount || parseFloat(addAmount) <= 0}
          className="bg-green-600 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg shadow-green-100 disabled:opacity-50 disabled:bg-gray-400 disabled:shadow-none transition-all"
        >
          <Plus size={18} />
          Add
        </motion.button>
      </div>

      {/* Bottom Row - Utility */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-50">
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onUndo(franchise.id)}
            className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:text-gray-900 transition-colors"
          >
            <RotateCcw size={18} />
          </motion.button>
          <button
            disabled
            className="p-3 bg-gray-50 text-gray-200 rounded-xl cursor-not-allowed"
          >
            <RotateCw size={18} />
          </button>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onWhatsApp(franchise)}
          className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors"
        >
          <MessageCircle size={18} />
        </motion.button>
      </div>
    </motion.div>
  );
};

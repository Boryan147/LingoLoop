import React, { useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StudyStats, VocabularyItem } from '../types';
import { Flame, Brain, Layers, ArrowUpRight, Download, Upload, Zap, Eye } from 'lucide-react';
import { exportBackup, importBackup } from '../services/storage';
import { calculateAverageRetention } from '../services/srs';

interface DashboardProps {
  stats: StudyStats;
  onReviewStart: () => void;
  items: VocabularyItem[];
  userId?: string;
  onUpdate: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, onReviewStart, items, userId, onUpdate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateChartData = () => {
    if (items.length === 0) {
      return [
        { day: 'Today', 'Standard Decay': 100, 'Your Retention': 100 },
        { day: 'Day 1', 'Standard Decay': 58, 'Your Retention': 100 },
        { day: 'Day 2', 'Standard Decay': 44, 'Your Retention': 100 },
        { day: 'Day 3', 'Standard Decay': 36, 'Your Retention': 100 },
        { day: 'Day 4', 'Standard Decay': 33, 'Your Retention': 100 },
        { day: 'Day 5', 'Standard Decay': 28, 'Your Retention': 100 },
        { day: 'Day 7', 'Standard Decay': 21, 'Your Retention': 100 },
      ];
    }

    const days = [0, 1, 2, 3, 4, 5, 7];
    return days.map(d => {
      const standard = Math.round(Math.exp(-d / 1.5) * 100);
      const personal = Math.round(calculateAverageRetention(items, d) * 100);
      return {
        day: d === 0 ? 'Today' : `Day ${d}`,
        'Standard Decay': standard,
        'Your Retention': personal,
      };
    });
  };

  const chartData = generateChartData();

  const handleExport = () => {
    const data = exportBackup(items);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lingoloop_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (await importBackup(content, userId)) {
        alert('History restored successfully!');
        onUpdate();
      } else {
        alert('Invalid backup file. Please ensure you uploaded a valid LingoLoop JSON file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activePercent = stats.totalItems > 0 ? Math.round((stats.activeItems / stats.totalItems) * 100) : 0;
  const passivePercent = stats.totalItems > 0 ? Math.round((stats.passiveItems / stats.totalItems) * 100) : 0;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full h-full overflow-y-auto">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">LingoLoop</h1>
          <p className="text-slate-500 mt-1">Let's keep that forgetting curve flat.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Backup</span>
          </button>
          <button
            onClick={handleImportClick}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Restore</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 rounded-xl">
              <Layers className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded-full text-slate-600">Total</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-slate-800">{stats.totalItems}</h3>
            <p className="text-sm text-slate-500 font-medium">Expressions Saved</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-red-50 rounded-xl">
              <Brain className="w-6 h-6 text-red-500" />
            </div>
            {stats.itemsDue > 0 && (
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-bold text-slate-800">{stats.itemsDue}</h3>
            <p className="text-sm text-slate-500 font-medium">Due for Review</p>
          </div>
          {stats.itemsDue > 0 && (
            <button
              onClick={onReviewStart}
              className="mt-4 text-xs font-bold text-indigo-600 flex items-center gap-1 hover:gap-2 transition-all relative z-10"
            >
              Start Session <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <Flame className="w-6 h-6 text-green-500" />
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-full">Retention</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-slate-800">{stats.retentionRate}%</h3>
            <p className="text-sm text-slate-500 font-medium">Estimated Retention</p>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20 md:pb-0">
        {/* Forgetting curve chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" /> Ebbinghaus Forgetting Curve
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPersonal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorStandard" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.05} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area
                  type="monotone"
                  dataKey="Standard Decay"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="url(#colorStandard)"
                />
                <Area
                  type="monotone"
                  dataKey="Your Retention"
                  stroke="#6366f1"
                  strokeWidth={3}
                  fill="url(#colorPersonal)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500 mt-4 text-center">
            Solid line shows <strong>Your Projected Retention</strong> over the next 7 days based on reviews. Dotted line shows standard decay without reviews.
          </p>
        </div>

        {/* Vocabulary breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-6">Vocabulary Breakdown</h2>
            
            <div className="space-y-6">
              {/* Active Card */}
              <div className="flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase">Active</span>
                    <span className="text-sm font-semibold text-slate-800">For Daily Speech & Thought</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-2xl font-bold text-emerald-700">{stats.activeItems}</span>
                  <span className="text-xs text-emerald-600 font-medium">{activePercent}%</span>
                </div>
              </div>

              {/* Passive Card */}
              <div className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase">Passive</span>
                    <span className="text-sm font-semibold text-slate-800">For Book & Movie Recognition</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-2xl font-bold text-blue-700">{stats.passiveItems}</span>
                  <span className="text-xs text-blue-600 font-medium">{passivePercent}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">"Less is More" Tip</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Focus on growing your <strong>Active</strong> vocabulary for fluid thoughts. Keep advanced literary terms as <strong>Passive</strong> to read and listen without friction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
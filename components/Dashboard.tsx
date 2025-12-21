import React, { useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { StudyStats } from '../types';
import { Flame, Brain, Layers, ArrowUpRight, Camera, Download, Upload, FileJson } from 'lucide-react';
import { exportBackup, importBackup } from '../services/storage';

interface DashboardProps {
  stats: StudyStats;
  onReviewStart: () => void;
}

// Mock data for the forgetting curve visualization
const forgettingCurveData = [
  { time: '0m', retention: 100 },
  { time: '20m', retention: 58 },
  { time: '1h', retention: 44 },
  { time: '9h', retention: 36 },
  { time: '1d', retention: 33 },
  { time: '2d', retention: 28 },
  { time: '6d', retention: 25 },
  { time: '31d', retention: 21 },
];

const Dashboard: React.FC<DashboardProps> = ({ stats, onReviewStart, items, userId, onUpdate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full h-full overflow-y-auto">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome back!</h1>
          <p className="text-slate-500 mt-2">Let's keep that forgetting curve flat.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Backup Data</span>
            <span className="sm:hidden">Backup</span>
          </button>
          <button
            onClick={handleImportClick}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Restore Data</span>
            <span className="sm:hidden">Restore</span>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 rounded-xl">
              <Layers className="w-6 h-6 text-red-500" />
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded-full text-slate-600">Total</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-slate-800">{stats.totalItems}</h3>
            <p className="text-sm text-slate-500 font-medium">Expressions Learned</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-indigo-50 rounded-xl">
              <Brain className="w-6 h-6 text-indigo-600" />
            </div>
            {stats.itemsDue > 0 && (
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
            )}
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-bold text-slate-800">{stats.itemsDue}</h3>
            <p className="text-sm text-slate-500 font-medium">Items Due for Review</p>
          </div>
          {stats.itemsDue > 0 && (
            <button
              onClick={onReviewStart}
              className="mt-4 text-xs font-bold text-indigo-600 flex items-center gap-1 hover:gap-2 transition-all"
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
            <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-full">Active</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-slate-800">{stats.retentionRate}%</h3>
            <p className="text-sm text-slate-500 font-medium">Estimated Retention</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-lg text-white flex flex-col justify-center items-center text-center">
          <h3 className="text-lg font-semibold mb-2">Daily Goal</h3>
          <div className="w-full bg-slate-700 h-2 rounded-full mb-2 overflow-hidden">
            <div className="bg-blue-400 h-full w-3/4 rounded-full" />
          </div>
          <p className="text-sm text-slate-400">15/20 mins studied</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20 md:pb-0">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" /> Ebbinghaus Forgetting Curve
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forgettingCurveData}>
                <defs>
                  <linearGradient id="colorRetention" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} unit="%" />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area
                  type="monotone"
                  dataKey="retention"
                  stroke="#6366f1"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRetention)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400 mt-4 text-center">Typical retention without spaced repetition.</p>
        </div>

        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex flex-col justify-center items-center text-center">
          <div className="max-w-xs">
            <h3 className="text-xl font-bold text-indigo-900 mb-2">Think in English</h3>
            <p className="text-indigo-700 mb-6 text-sm">Upload a photo of your surroundings. AI will generate a narrative to help you describe your reality in English.</p>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-indigo-100 transform rotate-2 hover:rotate-0 transition-transform duration-300">
              <div className="w-full h-32 bg-slate-200 rounded-lg mb-3 flex items-center justify-center">
                <Camera className="text-slate-400 w-8 h-8" />
              </div>
              <div className="h-2 w-3/4 bg-slate-100 rounded mb-2"></div>
              <div className="h-2 w-1/2 bg-slate-100 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
import React, { useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StudyStats, VocabularyItem, DailyLog } from '../types';
import { Flame, Brain, Layers, ArrowRight, Download, Upload, Zap, Eye, Check, Snowflake, CalendarCheck } from 'lucide-react';
import { exportBackup, importBackup } from '../services/storage';
import { calculateAverageRetention } from '../services/srs';
import { RoundKind, computeStreak, findLog, getMissionStatus, shiftDayKey, toDayKey, BONUS_ROUND_SIZE } from '../services/mission';

interface DashboardProps {
  stats: StudyStats;
  onReviewStart: (mode?: RoundKind) => void;
  items: VocabularyItem[];
  dailyLogs: DailyLog[];
  userId?: string;
  onUpdate: () => void;
}

const CALENDAR_WEEKS = 8;
const WEEKDAY_LABELS = ['M', '', 'W', '', 'F', '', ''];

const formatDay = (dayKey: string) => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

type CalendarCell = { day: string; status: 'met' | 'partial' | 'frozen' | 'none' | 'future'; reviews: number };

// GitHub-style grid of the last few weeks: one column per week, Monday at the top
const buildCalendar = (logs: DailyLog[], frozenDays: Set<string>, today: string): CalendarCell[][] => {
  const byDay = new Map(logs.map(l => [l.day, l]));
  const [y, m, d] = today.split('-').map(Number);
  const daysSinceMonday = (new Date(y, m - 1, d).getDay() + 6) % 7;
  const start = shiftDayKey(today, -daysSinceMonday - (CALENDAR_WEEKS - 1) * 7);

  return Array.from({ length: CALENDAR_WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const day = shiftDayKey(start, week * 7 + weekday);
      const log = byDay.get(day);
      const reviews = log ? log.active_reviewed + log.passive_reviewed : 0;
      let status: CalendarCell['status'] = 'none';
      if (day > today) status = 'future';
      else if (log?.goal_met) status = 'met';
      else if (frozenDays.has(day)) status = 'frozen';
      else if (reviews > 0) status = 'partial';
      return { day, status, reviews };
    })
  );
};

const CELL_STYLES: Record<CalendarCell['status'], string> = {
  met: 'bg-emerald-500',
  partial: 'bg-emerald-200',
  frozen: 'bg-sky-300',
  none: 'bg-slate-100',
  future: 'bg-transparent',
};

const CELL_LABELS: Record<CalendarCell['status'], string> = {
  met: 'Mission done',
  partial: 'Some reviews',
  frozen: 'Free miss used',
  none: 'No reviews',
  future: '',
};

const ProgressRing: React.FC<{ value: number; max: number; complete: boolean }> = ({ value, max, complete }) => {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const fraction = max > 0 ? Math.min(1, value / max) : 1;

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#eef2ff" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={complete ? '#10b981' : '#6366f1'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {complete ? (
          <Check className="w-9 h-9 text-emerald-500" strokeWidth={3} />
        ) : (
          <span className="text-xl font-bold text-slate-800">
            {value}<span className="text-sm text-slate-400">/{max}</span>
          </span>
        )}
      </div>
    </div>
  );
};

const MissionRow: React.FC<{ icon: React.ReactNode; label: string; done: number; target: number; barColor: string }> = ({ icon, label, done, target, barColor }) => (
  <div>
    <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-1.5">
      <span className="flex items-center gap-1.5">{icon} {label}</span>
      <span className="text-slate-400">{target > 0 ? `${done} / ${target}` : 'Nothing due'}</span>
    </div>
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
        style={{ width: `${target > 0 ? (done / target) * 100 : 100}%` }}
      />
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ stats, onReviewStart, items, dailyLogs, userId, onUpdate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = toDayKey();
  const mission = getMissionStatus(items, findLog(dailyLogs, today));
  const streak = computeStreak(dailyLogs, today);
  const calendar = buildCalendar(dailyLogs, streak.frozenDays, today);
  const weekStart = shiftDayKey(today, -6);
  const reviewedThisWeek = dailyLogs
    .filter(l => l.day >= weekStart)
    .reduce((sum, l) => sum + l.active_reviewed + l.passive_reviewed, 0);
  // Rough pace: ~35s per active card, ~3 min for the story
  const estimatedMinutes = Math.max(1, Math.round(mission.activeTarget * 0.6 + (mission.passiveTarget > 0 ? 3 : 0)));
  const hasWords = stats.totalItems > 0;

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
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
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

      {/* Today's mission & streak */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-3 flex flex-col">
          <div className="flex items-center gap-5">
            <ProgressRing value={mission.done} max={mission.target} complete={hasWords && mission.isComplete} />
            <div className="min-w-0">
              <span className="text-xs font-semibold px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full">Today's mission</span>
              <h2 className="text-xl font-bold text-slate-800 mt-2">
                {!hasWords
                  ? 'Capture a few words to begin'
                  : mission.isComplete
                    ? (mission.target === 0 ? 'All caught up' : 'Done for today')
                    : mission.done === 0
                      ? `${mission.target} words · about ${estimatedMinutes} min`
                      : `${mission.target - mission.done} words to go`}
              </h2>
              <p className="text-sm text-slate-500">
                {!hasWords
                  ? 'Your daily mission appears once you have saved vocabulary.'
                  : mission.isComplete
                    ? 'Anything more is a bonus. See you tomorrow.'
                    : 'Small and done beats big and skipped.'}
              </p>
            </div>
          </div>

          {hasWords && (
            <div className="space-y-3 mt-6">
              <MissionRow
                icon={<Zap className="w-3.5 h-3.5 text-emerald-500 fill-current" />}
                label="Active recall cards"
                done={mission.activeDone}
                target={mission.activeTarget}
                barColor="bg-emerald-500"
              />
              <MissionRow
                icon={<Eye className="w-3.5 h-3.5 text-blue-500" />}
                label="Passive words in 1 story"
                done={mission.passiveDone}
                target={mission.passiveTarget}
                barColor="bg-blue-500"
              />
            </div>
          )}

          <div className="mt-auto pt-6">
            {hasWords && !mission.isComplete && (
              <button
                onClick={() => onReviewStart('MISSION')}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                {mission.done === 0 ? 'Start mission' : 'Continue mission'} <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {hasWords && mission.isComplete && (mission.dueActive > 0 || mission.duePassive > 0) && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Optional bonus</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onReviewStart('BONUS_ACTIVE')}
                    disabled={mission.dueActive === 0}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-500 fill-current" /> +{BONUS_ROUND_SIZE} active cards
                  </button>
                  <button
                    onClick={() => onReviewStart('BONUS_PASSIVE')}
                    disabled={mission.duePassive === 0}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-blue-400 hover:bg-blue-50 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-500" /> +1 story
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-50 rounded-xl">
                <Flame className={`w-6 h-6 ${streak.current > 0 ? 'text-orange-500 fill-current' : 'text-slate-300'}`} />
              </div>
              <div>
                <h3 className="text-3xl font-bold text-slate-800 leading-none">{streak.current}</h3>
                <p className="text-sm text-slate-500 font-medium whitespace-nowrap">day streak</p>
              </div>
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-1 rounded-full flex items-center gap-1 whitespace-nowrap ${streak.freeMissReadyOn ? 'bg-slate-100 text-slate-500' : 'bg-sky-50 text-sky-700'}`}
              title="Missing one day per week won't break your streak"
            >
              <Snowflake className="w-3 h-3" />
              {streak.freeMissReadyOn ? `Free miss back ${formatDay(streak.freeMissReadyOn)}` : 'Free miss ready'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            {streak.todayMet
              ? "Today's done. Your streak is safe."
              : streak.current > 0
                ? "Finish today's mission to keep it going."
                : "Finish today's mission to start a streak."}
          </p>

          <div className="mt-5 flex gap-1">
            <div className="flex flex-col gap-1 mr-1">
              {WEEKDAY_LABELS.map((label, i) => (
                <div key={i} className="h-4 text-[9px] leading-4 font-semibold text-slate-400">{label}</div>
              ))}
            </div>
            {calendar.map((week, w) => (
              <div key={w} className="flex flex-col gap-1">
                {week.map(cell => (
                  <div
                    key={cell.day}
                    title={cell.status === 'future' ? undefined : `${formatDay(cell.day)} · ${CELL_LABELS[cell.status]}${cell.reviews > 0 ? ` (${cell.reviews} reviews)` : ''}`}
                    className={`w-4 h-4 rounded-[4px] ${CELL_STYLES[cell.status]} ${cell.day === today ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[10px] font-medium text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Mission done</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-200" /> Some reviews</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-300" /> Free miss</span>
          </div>
        </div>
      </div>

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

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-50 rounded-xl">
              <CalendarCheck className="w-6 h-6 text-orange-500" />
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-orange-50 text-orange-700 rounded-full">Last 7 days</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-slate-800">{reviewedThisWeek}</h3>
            <p className="text-sm text-slate-500 font-medium">Words Reviewed</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <Brain className="w-6 h-6 text-green-500" />
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
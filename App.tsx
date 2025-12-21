import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import ExpressionManager from './components/ExpressionManager';
import VisualContext from './components/VisualContext';
import ReviewSession from './components/ReviewSession';
import Auth from './components/Auth';
import { Page, VocabularyItem, StudyStats } from './types';
import * as storage from './services/storage';
import { supabase } from './services/supabase';
import { LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.DASHBOARD);
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [stats, setStats] = useState<StudyStats>({ totalItems: 0, itemsDue: 0, retentionRate: 100, streak: 0 });
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and subscribe to auth changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        handlePostLogin(session.user.id);
      } else {
        refreshData();
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        handlePostLogin(session.user.id);
      } else {
        setItems([]);
        setStats({ totalItems: 0, itemsDue: 0, retentionRate: 100, streak: 0 });
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handlePostLogin = async (userId: string) => {
    setLoading(true);
    await storage.syncLocalStorageToSupabase(userId);
    await refreshData(userId);
    setLoading(false);
  };

  const refreshData = async (userId?: string) => {
    const currentUserId = userId || session?.user?.id;
    const storedItems = await storage.getItems(currentUserId);
    const currentStats = storage.getStats(storedItems);
    setItems(storedItems);
    setStats(currentStats);
  };

  const handleNavigate = (page: Page) => {
    refreshData();
    setCurrentPage(page);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth onSession={setSession} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case Page.DASHBOARD:
        return (
          <Dashboard
            stats={stats}
            onReviewStart={() => handleNavigate(Page.REVIEW)}
            items={items}
            userId={session?.user?.id}
            onUpdate={() => refreshData()}
          />
        );
      case Page.EXPRESSIONS:
        return (
          <ExpressionManager
            items={items}
            onUpdate={() => refreshData()}
            userId={session.user.id}
          />
        );
      case Page.VISUAL_CONTEXT:
        return <VisualContext onVocabularyAdded={() => refreshData()} userId={session.user.id} />;
      case Page.REVIEW:
        return <ReviewSession onComplete={() => handleNavigate(Page.DASHBOARD)} userId={session.user.id} />;
      default:
        return <Dashboard stats={stats} onReviewStart={() => handleNavigate(Page.REVIEW)} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Navigation - Sidebar on desktop, Bottom bar on mobile */}
      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-hidden relative pb-16 md:pb-0">
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={handleLogout}
            className="p-2 bg-white rounded-full shadow-md text-slate-500 hover:text-red-600 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import ExpressionManager from './components/ExpressionManager';
import VisualContext from './components/VisualContext';
import ReviewSession from './components/ReviewSession';
import { Page, VocabularyItem, StudyStats } from './types';
import * as storage from './services/storage';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.DASHBOARD);
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [stats, setStats] = useState<StudyStats>({ totalItems: 0, itemsDue: 0, retentionRate: 100, streak: 0 });

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    const storedItems = storage.getItems();
    const currentStats = storage.getStats();
    setItems(storedItems);
    setStats(currentStats);
  };

  const handleNavigate = (page: Page) => {
    refreshData(); // Ensure data is fresh when navigating
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case Page.DASHBOARD:
        return (
          <Dashboard 
            stats={stats} 
            onReviewStart={() => handleNavigate(Page.REVIEW)} 
          />
        );
      case Page.EXPRESSIONS:
        return (
          <ExpressionManager 
            items={items} 
            onUpdate={refreshData} 
          />
        );
      case Page.VISUAL_CONTEXT:
        return <VisualContext onVocabularyAdded={refreshData} />;
      case Page.REVIEW:
        return <ReviewSession onComplete={() => handleNavigate(Page.DASHBOARD)} />;
      default:
        return <Dashboard stats={stats} onReviewStart={() => handleNavigate(Page.REVIEW)} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />
      <main className="flex-1 h-full overflow-hidden relative">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
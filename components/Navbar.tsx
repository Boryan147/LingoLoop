import React from 'react';
import { Page } from '../types';
import { LayoutDashboard, BookOpen, Camera, BrainCircuit } from 'lucide-react';

interface NavbarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const navItems = [
    { page: Page.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { page: Page.EXPRESSIONS, label: 'Expressions', icon: BookOpen },
    { page: Page.VISUAL_CONTEXT, label: 'Think Visual', icon: Camera },
    { page: Page.REVIEW, label: 'Review', icon: BrainCircuit },
  ];

  return (
    <nav className="bg-white border-r border-slate-200 w-20 flex-shrink-0 flex flex-col items-center py-6 h-full z-10 shadow-sm">
      <div className="mb-8 p-2 bg-indigo-600 rounded-xl">
        <BrainCircuit className="w-8 h-8 text-white" />
      </div>
      
      <div className="flex flex-col gap-6 w-full">
        {navItems.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`flex flex-col items-center justify-center p-3 w-full transition-all duration-200 relative
                ${isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}
              `}
            >
              <item.icon className={`w-6 h-6 mb-1 ${isActive ? 'stroke-[2.5px]' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 rounded-l-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navbar;
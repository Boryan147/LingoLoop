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
    <nav className="
      bg-white border-slate-200 z-50 flex-shrink-0 shadow-lg md:shadow-sm
      fixed bottom-0 left-0 w-full border-t flex-row h-16 justify-around items-center px-2
      md:relative md:w-20 md:flex-col md:h-full md:border-r md:border-t-0 md:py-6 md:justify-start
    ">
      {/* Logo - Hidden on mobile, visible on desktop */}
      <div className="hidden md:flex mb-8 p-2 bg-indigo-600 rounded-xl">
        <BrainCircuit className="w-8 h-8 text-white" />
      </div>
      
      <div className="flex md:flex-col gap-1 md:gap-6 w-full justify-around md:justify-start">
        {navItems.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`
                flex flex-col items-center justify-center p-2 transition-all duration-200 relative group rounded-lg
                md:w-full md:p-3
                ${isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}
              `}
            >
              <item.icon className={`w-6 h-6 mb-1 ${isActive ? 'stroke-[2.5px]' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
              
              {/* Desktop Active Indicator */}
              {isActive && (
                <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 rounded-l-full" />
              )}
              
              {/* Mobile Active Indicator */}
              {isActive && (
                 <div className="md:hidden absolute top-0 w-8 h-1 bg-indigo-600 rounded-b-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navbar;
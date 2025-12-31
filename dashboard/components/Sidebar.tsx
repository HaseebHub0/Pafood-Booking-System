import React from 'react';
import { User, MenuItem, View } from '../types';

interface SidebarProps {
    user: User | null;
    menuItems: MenuItem[];
    currentView: View;
    onNavigate: (view: View) => void;
    onLogout: () => void;
    isOpen?: boolean;
    onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, menuItems, currentView, onNavigate, onLogout, isOpen = false, onClose }) => {
    if (!user) return null;

    return (
        <>
            {/* Mobile Overlay Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-72 flex-col border-r border-slate-100 glass-panel bg-white/95 backdrop-blur-lg lg:hidden transform transition-transform duration-300 ease-in-out ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                <div className="flex h-full flex-col p-4">
                    {/* Mobile Close Button */}
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                            <div className="bg-white rounded-full p-1.5 shadow-sm ring-1 ring-slate-100">
                                <span className="material-symbols-outlined text-primary text-2xl">soup_kitchen</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-lg font-black text-primary leading-none">PAK ASIAN</span>
                                <span className="text-[10px] font-bold text-secondary tracking-widest uppercase">Foods</span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-100 text-slate-600"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* User Profile */}
                    <div className="flex items-center gap-3 px-2 mb-6">
                        <div 
                            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 ring-2 ring-primary/20 relative shadow-sm"
                            style={{ backgroundImage: `url("${user.avatarUrl}")` }}
                        >
                            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white border-2 border-white">
                                {user.role === 'Admin' ? (
                                    <span className="material-symbols-outlined text-[12px] text-yellow-500">verified</span>
                                ) : (
                                    <span className="material-symbols-outlined text-[12px] text-secondary">shield_person</span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                            <h1 className="text-sm font-bold leading-tight text-slate-900 truncate">{user.name}</h1>
                            <p className="text-slate-500 text-xs font-medium truncate uppercase tracking-wider">{user.role}</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex flex-col gap-2 flex-1 overflow-y-auto">
                        {menuItems.map((item) => (
                            <button
                                key={item.label}
                                onClick={() => {
                                    onNavigate(item.view);
                                    onClose?.();
                                }}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 w-full text-left group ${
                                    item.view === currentView
                                        ? "bg-red-50 text-primary border border-red-100 shadow-sm"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                                }`}
                            >
                                <span className={`material-symbols-outlined text-xl transition-transform ${item.view === currentView ? 'scale-110' : 'group-hover:scale-110'}`}>{item.icon}</span>
                                <p className="text-sm font-medium">{item.label}</p>
                            </button>
                        ))}
                    </nav>

                    {/* Logout */}
                    <button 
                        onClick={() => {
                            onLogout();
                            onClose?.();
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-100 border border-transparent transition-all w-full text-left mt-4"
                    >
                        <span className="material-symbols-outlined text-xl">logout</span>
                        <p className="text-sm font-medium">Log Out</p>
                    </button>
                </div>
            </aside>

            {/* Desktop Sidebar */}
        <aside className="hidden w-72 flex-col border-r border-slate-100 glass-panel lg:flex m-4 rounded-3xl overflow-hidden bg-white/60">
            <div className="flex h-full flex-col p-6">
                
                {/* Brand Logo */}
                <div className="flex justify-center mb-8 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="bg-white rounded-full p-1.5 shadow-sm ring-1 ring-slate-100">
                           <img 
                                src="https://lh3.googleusercontent.com/drive-viewer/AKGpihbm8XwQyK0cGeN65YlD18H9j5aF6p5mC2n6lqE8q1j0s0s=s1600" 
                                alt="Pak Asian" 
                                className="h-10 object-contain"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement!.innerHTML = '<span class="material-symbols-outlined text-primary text-3xl">soup_kitchen</span>';
                                }}
                           />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-black text-primary leading-none tracking-tight">PAK ASIAN</span>
                            <span className="text-xs font-bold text-secondary tracking-widest uppercase">Foods</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-8 flex-1 justify-between">
                    <div className="flex flex-col gap-6">
                        {/* User Profile */}
                        <div className="flex items-center gap-4 px-2">
                            <div 
                                className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 ring-2 ring-primary/20 relative shadow-sm"
                                style={{ backgroundImage: `url("${user.avatarUrl}")` }}
                            >
                                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white border-2 border-white">
                                    {user.role === 'Admin' ? (
                                        <span className="material-symbols-outlined text-[12px] text-yellow-500">verified</span>
                                    ) : (
                                        <span className="material-symbols-outlined text-[12px] text-secondary">shield_person</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <h1 className="text-base font-bold leading-tight text-slate-900 truncate">{user.name}</h1>
                                <p className="text-slate-500 text-xs font-medium truncate uppercase tracking-wider">{user.role}</p>
                            </div>
                        </div>

                        {/* Navigation */}
                        <nav className="flex flex-col gap-2">
                            {menuItems.map((item) => (
                                <button
                                    key={item.label}
                                    onClick={() => onNavigate(item.view)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 w-full text-left group ${
                                        item.view === currentView
                                            ? "bg-red-50 text-primary border border-red-100 shadow-sm"
                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                                    }`}
                                >
                                    <span className={`material-symbols-outlined text-xl transition-transform ${item.view === currentView ? 'scale-110' : 'group-hover:scale-110'}`}>{item.icon}</span>
                                    <p className="text-sm font-medium">{item.label}</p>
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Logout */}
                    <button 
                        onClick={onLogout}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-100 border border-transparent transition-all w-full text-left"
                    >
                        <span className="material-symbols-outlined text-xl">logout</span>
                        <p className="text-sm font-medium">Log Out</p>
                    </button>
                </div>
            </div>
        </aside>
        </>
    );
};

export default Sidebar;
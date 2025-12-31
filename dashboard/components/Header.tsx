import React, { useState, useEffect, useRef } from 'react';
import { User, View } from '../types';
import Notifications from './Notifications';

interface HeaderProps {
    user: User | null;
    onNavigate?: (view: View, id?: string) => void;
    onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onNavigate, onMenuClick }) => {
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const notificationsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadUnreadCount = async () => {
            if (!user) return;
            
            try {
                const { dataService } = await import('../dataService');
                const notifications = await dataService.getNotifications(user);
                setUnreadCount(notifications.filter(n => !n.read).length);
            } catch (err) {
                console.error('Error loading notification count:', err);
            }
        };

        loadUnreadCount();
        // Refresh count every 30 seconds
        const interval = setInterval(loadUnreadCount, 30000);
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };

        if (showNotifications) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showNotifications]);

    return (
        <header className="flex h-16 md:h-20 items-center justify-between gap-2 md:gap-4 mx-2 md:mx-4 mt-2 md:mt-4 rounded-xl md:rounded-2xl glass-panel px-3 md:px-6 py-3 md:py-4 sticky top-2 md:top-4 z-20">
            {/* Mobile Menu Trigger */}
            <button 
                onClick={onMenuClick}
                className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-white/10 rounded-full transition-colors"
            >
                <span className="material-symbols-outlined">menu</span>
            </button>

            {/* Spacer to maintain layout balance if needed, or just justify-between handles it */}
            <div className="flex-1"></div>

            {/* Actions & Role Badge */}
            <div className="flex items-center gap-2 md:gap-3">
                {user && (
                    <div className={`hidden xs:flex items-center gap-1 md:gap-2 rounded-full border px-2 md:px-4 py-1 md:py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider backdrop-blur-sm ${
                        user.role === 'Admin' 
                            ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500 shadow-[0_0_15px_-3px_rgba(234,179,8,0.2)]" 
                            : "border-blue-500/30 bg-blue-500/10 text-blue-500 shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)]"
                    }`}>
                        <span className="hidden sm:inline">{user.role}</span>
                        <span className="sm:hidden">{user.role === 'Admin' ? 'ADM' : 'KPO'}</span>
                        {user.region && <span className="hidden md:inline text-slate-400 dark:text-slate-500 mx-1">|</span>}
                        {user.region && <span className="hidden md:inline">{user.region}</span>}
                    </div>
                )}

                <div className="relative" ref={notificationsRef}>
                    <button 
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative rounded-full p-1.5 md:p-2 text-slate-600 dark:text-slate-300 hover:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px] md:text-[24px]">notifications</span>
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 md:top-1.5 md:right-1.5 h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-slate-800 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span>
                        )}
                </button>
                    
                    {showNotifications && (
                        <Notifications 
                            user={user}
                            onClose={() => setShowNotifications(false)}
                            onNavigate={onNavigate}
                        />
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
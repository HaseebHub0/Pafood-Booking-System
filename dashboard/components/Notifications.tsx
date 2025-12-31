import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { dataService } from '../dataService';
import { formatRelativeTime } from '../utils/dateUtils';

interface Notification {
    id: string;
    type: 'pending_approval' | 'unauthorized_discount' | 'approval_delay' | 'policy_violation' | 'stock_return' | 'critical_task';
    title: string;
    message: string;
    timestamp: any;
    link?: string;
    severity?: 'high' | 'medium' | 'low';
    read?: boolean;
}

interface NotificationsProps {
    user: User | null;
    onClose: () => void;
    onNavigate?: (view: string, id?: string) => void;
}

const Notifications: React.FC<NotificationsProps> = ({ user, onClose, onNavigate }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const loadNotifications = async () => {
            if (!user) return;
            
            try {
                setIsLoading(true);
                const notifs = await dataService.getNotifications(user);
                setNotifications(notifs);
                setUnreadCount(notifs.filter(n => !n.read).length);
            } catch (err: any) {
                console.error('Error loading notifications:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadNotifications();
    }, [user]);

    const handleNotificationClick = (notification: Notification) => {
        if (notification.link && onNavigate) {
            const [view, id] = notification.link.split(':');
            onNavigate(view as any, id);
            onClose();
        }
    };

    const markAsRead = async (notificationId: string) => {
        try {
            await dataService.markNotificationAsRead(notificationId);
            setNotifications(prev => prev.map(n => 
                n.id === notificationId ? { ...n, read: true } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await dataService.markAllNotificationsAsRead(user?.id || '');
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    const getNotificationIcon = (type: string) => {
        const icons: Record<string, string> = {
            pending_approval: 'hourglass_top',
            unauthorized_discount: 'gavel',
            approval_delay: 'schedule',
            policy_violation: 'warning',
            stock_return: 'inventory_2',
            critical_task: 'priority_high'
        };
        return icons[type] || 'notifications';
    };

    const getNotificationColor = (type: string, severity?: string) => {
        if (severity === 'high') return 'bg-red-50 text-red-600 border-red-200';
        if (severity === 'medium') return 'bg-orange-50 text-orange-600 border-orange-200';
        if (type === 'pending_approval') return 'bg-blue-50 text-blue-600 border-blue-200';
        if (type === 'unauthorized_discount') return 'bg-red-50 text-red-600 border-red-200';
        return 'bg-slate-50 text-slate-600 border-slate-200';
    };

    return (
        <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-xl md:rounded-2xl shadow-2xl border border-slate-200 z-50 max-h-[calc(100vh-8rem)] md:max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">notifications</span>
                    <h3 className="font-bold text-slate-900">Notifications</h3>
                    {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="text-xs font-bold text-primary hover:text-red-700"
                        >
                            Mark all read
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-slate-200 text-slate-400"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
                {isLoading ? (
                    <div className="p-8 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-20">notifications_off</span>
                        <p className="text-sm">No notifications</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                onClick={() => {
                                    handleNotificationClick(notification);
                                    if (!notification.read) {
                                        markAsRead(notification.id);
                                    }
                                }}
                                className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${
                                    !notification.read ? 'bg-blue-50/30' : ''
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-lg ${getNotificationColor(notification.type, notification.severity)}`}>
                                        <span className="material-symbols-outlined text-[20px]">
                                            {getNotificationIcon(notification.type)}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="font-bold text-sm text-slate-900">{notification.title}</p>
                                            {!notification.read && (
                                                <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1"></span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-600 mt-1">{notification.message}</p>
                                        <p className="text-[10px] text-slate-400 mt-2">
                                            {notification.timestamp ? formatRelativeTime(notification.timestamp) : 'Just now'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
                <div className="p-3 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={() => {
                            if (onNavigate) {
                                onNavigate(user?.role === 'Admin' ? 'ADMIN_REPORTS' : 'KPO_BOOKINGS');
                                onClose();
                            }
                        }}
                        className="w-full text-xs font-bold text-primary hover:text-red-700 text-center"
                    >
                        View All
                    </button>
                </div>
            )}
        </div>
    );
};

export default Notifications;


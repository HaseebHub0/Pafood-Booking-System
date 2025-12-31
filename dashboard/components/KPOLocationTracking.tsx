import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { db, collections } from '../firebase';
import { onSnapshot, query, where, Timestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import BookerLocationMap from './BookerLocationMap';

interface KPOLocationTrackingProps {
    user: User;
}

interface BookerLocation {
    id: string;
    bookerId: string;
    bookerName: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
    lastUpdated: string;
    isOnline: boolean;
    regionId: string;
    branch?: string;
}

const KPOLocationTracking: React.FC<KPOLocationTrackingProps> = ({ user }) => {
    const [bookerLocations, setBookerLocations] = useState<BookerLocation[]>([]);
    const [selectedBookerId, setSelectedBookerId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user.branch) {
            setError('No branch assigned');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        // Build query to filter by branch and region
        const constraints = [];
        
        if (user.branch) {
            constraints.push(where('branch', '==', user.branch));
        }
        
        if (user.regionId) {
            constraints.push(where('regionId', '==', user.regionId));
        }

        // Subscribe to real-time updates
        const q = constraints.length > 0 
            ? query(collections.bookerLocations, ...constraints)
            : collections.bookerLocations;

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                try {
                    const locations: BookerLocation[] = [];
                    const now = Date.now();

                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        
                        // Convert Firestore Timestamp to ISO string if needed
                        let lastUpdated = data.lastUpdated;
                        if (lastUpdated && lastUpdated.toDate) {
                            lastUpdated = lastUpdated.toDate().toISOString();
                        } else if (lastUpdated && typeof lastUpdated === 'string') {
                            lastUpdated = lastUpdated;
                        } else {
                            lastUpdated = new Date().toISOString();
                        }

                        // Check if booker is online (updated within last 2 minutes)
                        const lastUpdatedTime = new Date(lastUpdated).getTime();
                        const timeSinceUpdate = (now - lastUpdatedTime) / 1000 / 60; // minutes
                        const isOnline = timeSinceUpdate <= 2 && data.isOnline !== false;

                        locations.push({
                            id: doc.id,
                            bookerId: data.bookerId || doc.id,
                            bookerName: data.bookerName || 'Unknown Booker',
                            latitude: data.latitude || 0,
                            longitude: data.longitude || 0,
                            accuracy: data.accuracy,
                            heading: data.heading,
                            speed: data.speed,
                            lastUpdated,
                            isOnline,
                            regionId: data.regionId || '',
                            branch: data.branch,
                        });
                    });

                    // Filter to only online bookers for display
                    const onlineLocations = locations.filter(loc => loc.isOnline);
                    setBookerLocations(onlineLocations);
                    setIsLoading(false);
                } catch (err: any) {
                    console.error('Error processing location data:', err);
                    setError(err.message || 'Failed to load location data');
                    setIsLoading(false);
                }
            },
            (err) => {
                console.error('Error subscribing to location updates:', err);
                setError(err.message || 'Failed to subscribe to location updates');
                setIsLoading(false);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [user.branch, user.regionId]);

    const selectedBooker = selectedBookerId 
        ? bookerLocations.find(loc => loc.bookerId === selectedBookerId)
        : null;

    if (isLoading) {
        return (
            <div className="space-y-3 md:space-y-4">
                <div className="flex flex-col gap-0.5">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">Live Location Tracking</h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Track booker locations in real-time for {user.branch}.</p>
                </div>
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-3 md:space-y-4">
                <div className="flex flex-col gap-0.5">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">Live Location Tracking</h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Track booker locations in real-time for {user.branch}.</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3 border border-red-200">
                    <p className="text-xs text-red-800 font-medium break-words">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3 md:space-y-4">
            <div className="flex flex-col gap-0.5">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">Live Location Tracking</h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Track booker locations in real-time for {user.branch}.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 h-[600px]">
                {/* Bookers List */}
                <div className="lg:col-span-1 glass-panel bg-white/80 rounded-lg overflow-hidden flex flex-col border border-slate-200">
                    <div className="p-2.5 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-semibold text-slate-700 text-xs">Online Bookers ({bookerLocations.length})</h3>
                        <p className="text-[10px] text-slate-400">Select a booker to view details</p>
                    </div>
                    <div className="overflow-y-auto flex-1 p-1.5 space-y-1.5">
                        {bookerLocations.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <span className="material-symbols-outlined text-3xl mb-2 opacity-20">location_off</span>
                                <p className="text-xs">No bookers online</p>
                            </div>
                        ) : (
                            bookerLocations.map(location => {
                                const lastUpdated = new Date(location.lastUpdated);
                                const timeAgo = Math.floor((Date.now() - lastUpdated.getTime()) / 1000 / 60);
                                
                                return (
                                    <div
                                        key={location.bookerId}
                                        onClick={() => setSelectedBookerId(selectedBookerId === location.bookerId ? null : location.bookerId)}
                                        className={`p-2 rounded-md border cursor-pointer transition-all ${
                                            selectedBookerId === location.bookerId
                                                ? 'bg-red-50 border-primary ring-1 ring-primary shadow-sm'
                                                : 'bg-white border-slate-200 hover:border-red-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <p className={`font-semibold text-xs ${selectedBookerId === location.bookerId ? 'text-primary' : 'text-slate-900'} truncate`}>
                                                {location.bookerName}
                                            </p>
                                            <span className="material-symbols-outlined text-green-500 text-sm">location_on</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500">
                                            {timeAgo < 1 ? 'Just now' : `${timeAgo} min ago`}
                                        </p>
                                        {location.accuracy && (
                                            <p className="text-[9px] text-slate-400 mt-0.5">
                                                Accuracy: {Math.round(location.accuracy)}m
                                            </p>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Map View */}
                <div className="lg:col-span-2 glass-panel bg-white rounded-lg p-0 flex flex-col border border-slate-200 overflow-hidden">
                    {bookerLocations.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/30">
                            <span className="material-symbols-outlined text-3xl mb-1.5 opacity-20">map</span>
                            <p className="text-xs">No bookers online</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Bookers will appear here when they are active</p>
                        </div>
                    ) : (
                        <>
                            {selectedBooker && (
                                <div className="p-3 border-b border-slate-100 bg-white">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-sm font-bold text-slate-900 truncate">{selectedBooker.bookerName}</h3>
                                            <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                                                Last updated: {new Date(selectedBooker.lastUpdated).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[9px] font-semibold">
                                                Online
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex-1 min-h-0">
                                <BookerLocationMap 
                                    locations={bookerLocations}
                                    selectedBookerId={selectedBookerId}
                                    onMarkerClick={setSelectedBookerId}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default KPOLocationTracking;

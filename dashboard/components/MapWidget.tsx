import React, { useState, useEffect } from 'react';

// Mock coordinates for major cities roughly mapped to the container aspect ratio
const LOCATIONS = [
    { name: 'Lahore', top: '35%', left: '68%', activity: 'High', color: 'bg-primary' },
    { name: 'Karachi', top: '75%', left: '25%', activity: 'Very High', color: 'bg-blue-500' },
    { name: 'Islamabad', top: '22%', left: '62%', activity: 'Medium', color: 'bg-green-500' },
    { name: 'Multan', top: '48%', left: '55%', activity: 'Medium', color: 'bg-orange-500' },
    { name: 'Peshawar', top: '18%', left: '55%', activity: 'Low', color: 'bg-yellow-500' },
    { name: 'Quetta', top: '55%', left: '15%', activity: 'Low', color: 'bg-purple-500' },
];

const RECENT_EVENTS = [
    { type: 'order', text: 'New Order #8821 in Lahore', time: 'Just now' },
    { type: 'delivery', text: 'Delivery completed in Karachi', time: '2m ago' },
    { type: 'staff', text: 'Salesman checked-in Islamabad', time: '5m ago' },
    { type: 'order', text: 'Large bulk order in Multan', time: '12m ago' },
];

const MapWidget: React.FC = () => {
    const [activeMarker, setActiveMarker] = useState<number | null>(null);
    
    // Simulate random activity pulses
    useEffect(() => {
        const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * LOCATIONS.length);
            setActiveMarker(randomIndex);
            setTimeout(() => setActiveMarker(null), 2000);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="rounded-xl bg-slate-900 overflow-hidden relative h-[400px] w-full group border border-slate-800 shadow-xl">
            {/* Map Background - using a dark stylized map image of Pakistan */}
            <div 
                className="absolute inset-0 bg-cover bg-center opacity-40 grayscale contrast-125 transition-transform duration-[20s] ease-linear group-hover:scale-105" 
                style={{ 
                    backgroundImage: `url("https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Pakistan_location_map.svg/856px-Pakistan_location_map.svg.png")`, 
                    backgroundSize: 'contain', 
                    backgroundRepeat: 'no-repeat', 
                    backgroundPosition: 'center' 
                }}
            ></div>
            
            {/* Radial Gradient Overlay for depth and focus */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-slate-900/95 pointer-events-none"></div>

            {/* Header Overlay */}
            <div className="absolute top-0 left-0 p-6 z-20 w-full flex justify-between items-start bg-gradient-to-b from-slate-900/80 to-transparent">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                        <h3 className="text-lg font-bold text-white tracking-wide">LIVE OPERATIONS</h3>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">Monitoring 6 Regions • 42 Active Routes</p>
                </div>
                <button className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-2 rounded-lg text-white transition-colors">
                     <span className="material-symbols-outlined text-sm">fullscreen</span>
                </button>
            </div>

            {/* Map Markers */}
            {LOCATIONS.map((loc, idx) => (
                <div 
                    key={loc.name}
                    className="absolute group/marker cursor-pointer"
                    style={{ top: loc.top, left: loc.left }}
                >
                    {/* Ripple Effect when active */}
                    {activeMarker === idx && (
                        <>
                            <div className={`absolute -inset-4 rounded-full ${loc.color} opacity-20 animate-ping`}></div>
                            <div className={`absolute -inset-8 rounded-full ${loc.color} opacity-10 animate-pulse`}></div>
                        </>
                    )}
                    
                    {/* The Dot */}
                    <div className={`relative h-3 w-3 rounded-full border-2 border-slate-900 shadow-[0_0_10px_currentColor] transition-all duration-300 ${activeMarker === idx ? `${loc.color} scale-125` : 'bg-slate-400 hover:bg-white'}`}></div>

                    {/* Tooltip */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur-sm text-white text-[10px] py-1.5 px-3 rounded-lg opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-700 z-30 shadow-xl transform translate-y-1 group-hover/marker:translate-y-0 duration-200">
                        <p className="font-bold text-xs mb-0.5">{loc.name}</p>
                        <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${loc.color}`}></span>
                            <span className="text-slate-300">{loc.activity} Activity</span>
                        </div>
                    </div>
                </div>
            ))}

            {/* Live Feed Overlay (Bottom Left) */}
            <div className="absolute bottom-6 left-6 z-20 w-64 hidden sm:block">
                <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-4 overflow-hidden shadow-2xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[12px] animate-pulse text-green-500">rss_feed</span>
                        Recent Signals
                    </p>
                    <div className="space-y-3 relative">
                        {/* Fade out bottom effect */}
                        <div className="absolute -bottom-2 left-0 right-0 h-6 bg-gradient-to-t from-slate-900 to-transparent z-10 pointer-events-none"></div>
                        
                        {RECENT_EVENTS.map((evt, i) => (
                            <div key={i} className="flex items-start gap-3 animate-in slide-in-from-left-2 fade-in duration-500" style={{ animationDelay: `${i * 150}ms` }}>
                                <div className={`mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0 shadow-[0_0_5px_currentColor] ${
                                    evt.type === 'order' ? 'bg-green-500 text-green-500' : 
                                    evt.type === 'delivery' ? 'bg-blue-500 text-blue-500' : 'bg-yellow-500 text-yellow-500'
                                }`}></div>
                                <div>
                                    <p className="text-xs text-slate-200 leading-tight font-medium">{evt.text}</p>
                                    <p className="text-[10px] text-slate-500">{evt.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stats Overlay (Bottom Right) */}
            <div className="absolute bottom-6 right-6 z-20 flex gap-2">
                 <div className="bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700/50 text-center shadow-lg">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Field Staff</p>
                    <p className="text-sm font-bold text-white">124</p>
                 </div>
                 <div className="bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700/50 text-center shadow-lg">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Alerts</p>
                    <p className="text-sm font-bold text-red-500 animate-pulse">3</p>
                 </div>
            </div>
        </div>
    );
};

export default MapWidget;
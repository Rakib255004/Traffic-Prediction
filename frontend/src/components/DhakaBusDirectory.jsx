import React, { useState, useEffect, useMemo } from 'react';
import { ALL_DHAKA_LOCATIONS } from '../utils/journeyPredictor.js';
import OSMTransitMap from './OSMTransitMap.jsx';
import { API_BASE, fetchWithTimeout } from '../api.js';

// Module-level cache so navigating between pages renders instantly
let cachedBuses = null;

export default function DhakaBusDirectory() {
  const [buses, setBuses] = useState(() => cachedBuses || []);
  const [loading, setLoading] = useState(() => !cachedBuses);
  const [error, setError] = useState(null);

  // Search mode: 'route' (Point to Point A -> B) or 'keyword' (Master Catalog)
  const [searchMode, setSearchMode] = useState('route');

  // Route search state
  const [fromLoc, setFromLoc] = useState('Savar');
  const [toLoc, setToLoc] = useState('Mirpur 10');
  const [routeResult, setRouteResult] = useState(null);
  const [routeSearching, setRouteSearching] = useState(false);
  const [activeTransferTab, setActiveTransferTab] = useState(0);

  // Keyword / Catalog search state
  const [keyword, setKeyword] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('ALL'); // ALL, AC, NON_AC, POPULAR
  const [expandedBusId, setExpandedBusId] = useState(null);

  // Load master bus directory on mount
  useEffect(() => {
    async function loadMasterBuses() {
      if (cachedBuses && cachedBuses.length) return;
      try {
        setLoading(true);
        const res = await fetchWithTimeout(`${API_BASE}/buses`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            cachedBuses = json.data || [];
            setBuses(cachedBuses);
          }
        }
      } catch (err) {
        setError('Could not load Dhaka bus directory: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadMasterBuses();
  }, []);

  // Trigger initial route search for Savar -> Mirpur 10 on mount
  useEffect(() => {
    handleSearchRoute();
  }, []);

  const handleSearchRoute = async (e) => {
    if (e) e.preventDefault();
    if (!fromLoc || !toLoc) return;

    setRouteSearching(true);
    setError(null);

    try {
      const res = await fetchWithTimeout(`${API_BASE}/buses?from=${encodeURIComponent(fromLoc)}&to=${encodeURIComponent(toLoc)}`);
      if (res.ok) {
        const json = await res.json();
        setRouteResult(json);
      } else {
        setRouteResult({
          available: false,
          count: 0,
          from: fromLoc,
          to: toLoc,
          buses: [],
          message: `No direct bus is available for this route (${fromLoc} → ${toLoc}).`
        });
      }
    } catch (err) {
      setError('Search failed. Please ensure the backend server is running.');
    } finally {
      setRouteSearching(false);
    }
  };

  const handleSwap = () => {
    setFromLoc(toLoc);
    setToLoc(fromLoc);
  };

  const toggleExpand = (id) => {
    setExpandedBusId(prev => (prev === id ? null : id));
  };

  // Filtered list for catalog search
  const filteredBuses = useMemo(() => {
    return buses.filter(b => {
      // Type/Filter chip
      if (catalogFilter === 'AC' && !(b.type || '').toUpperCase().includes('AC')) return false;
      if (catalogFilter === 'NON_AC' && (b.type || '').toUpperCase().includes('AC')) return false;
      if (catalogFilter === 'POPULAR' && !['R26', 'R01', 'R05', 'R10', 'A-123'].some(c => (b.route_code || '').includes(c))) return false;

      // Keyword query
      if (!keyword.trim()) return true;
      const q = keyword.toLowerCase().trim();
      const nameMatch = (b.name && b.name.toLowerCase().includes(q)) || (b.name_bn && b.name_bn.includes(q));
      const codeMatch = (b.route_code && b.route_code.toLowerCase().includes(q));
      const stopsMatch = (b.stoppages || []).some(s => s.toLowerCase().includes(q));
      const originMatch = (b.origin && b.origin.toLowerCase().includes(q)) || (b.destination && b.destination.toLowerCase().includes(q));
      return nameMatch || codeMatch || stopsMatch || originMatch;
    });
  }, [buses, keyword, catalogFilter]);

  return (
    <div className="space-y-6">
      {/* ── Modern Hero Header ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center font-bold text-2xl shadow-inner shrink-0 mt-0.5">
            🚌
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                Dhaka Public Transit Directory
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                DTCA Authenticated
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                MRT-6 Connected
              </span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-200/80 mt-1 max-w-2xl leading-relaxed">
              Real-time point-to-point bus network, Metro Rail express connections, authentic government fares, and curved road geometries across Greater Dhaka.
            </p>
          </div>
        </div>

        {/* Mode Toggle Switch */}
        <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/10 self-start md:self-auto text-xs font-semibold shrink-0">
          <button
            onClick={() => setSearchMode('route')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              searchMode === 'route'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>🧭</span>
            <span>Route Planner</span>
          </button>
          <button
            onClick={() => setSearchMode('keyword')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              searchMode === 'keyword'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>📋</span>
            <span>All Routes ({buses.length})</span>
          </button>
        </div>
      </div>

      {/* ── MODE 1: Point to Point (A to B) Route Query ─────────────────────── */}
      {searchMode === 'route' && (
        <div className="space-y-6">
          {/* Search Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span>📍 Find Buses & Transit Between Two Locations</span>
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">
                Live Stoppage Matching Engine
              </span>
            </div>

            <form onSubmit={handleSearchRoute} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              {/* Origin */}
              <div className="sm:col-span-5 relative">
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  Start Location (কোথা থেকে)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="dhaka-origin-stops"
                    value={fromLoc}
                    onChange={(e) => setFromLoc(e.target.value)}
                    placeholder="e.g. Savar, Gabtoli, Uttara..."
                    spellCheck="false"
                    autoComplete="off"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold shadow-2xs pr-8"
                  />
                  {fromLoc && (
                    <button
                      type="button"
                      onClick={() => setFromLoc('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100"
                    >
                      ×
                    </button>
                  )}
                </div>
                <datalist id="dhaka-origin-stops">
                  {ALL_DHAKA_LOCATIONS.map(loc => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>

              {/* Swap Button */}
              <div className="sm:col-span-1 flex items-center justify-center pt-5">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="w-9 h-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center justify-center transition-all shadow-2xs cursor-pointer font-bold text-base hover:scale-105 active:scale-95"
                  title="Swap Origin and Destination"
                >
                  ⇄
                </button>
              </div>

              {/* Destination */}
              <div className="sm:col-span-4 relative">
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                  Destination (কোথায় যাবেন)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="dhaka-dest-stops"
                    value={toLoc}
                    onChange={(e) => setToLoc(e.target.value)}
                    placeholder="e.g. Mirpur 10, Farmgate, Motijheel..."
                    spellCheck="false"
                    autoComplete="off"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold shadow-2xs pr-8"
                  />
                  {toLoc && (
                    <button
                      type="button"
                      onClick={() => setToLoc('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100"
                    >
                      ×
                    </button>
                  )}
                </div>
                <datalist id="dhaka-dest-stops">
                  {ALL_DHAKA_LOCATIONS.map(loc => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>

              {/* Search Button */}
              <div className="sm:col-span-2 pt-5">
                <button
                  type="submit"
                  disabled={routeSearching}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-95"
                >
                  {routeSearching ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>Find Buses</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Popular Route Chips */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3.5 border-t border-slate-100 text-xs">
              <span className="text-slate-400 font-medium text-[11px]">Popular Corridors:</span>
              {[
                ['Savar', 'Mirpur 10'],
                ['Mirpur 10', 'Farmgate'],
                ['Uttara', 'Motijheel'],
                ['Badda', 'Ashulia'],
                ['Mohammadpur', 'Abdullahpur'],
                ['Gazipur', 'Sadarghat']
              ].map(([o, d]) => (
                <button
                  key={`${o}-${d}`}
                  type="button"
                  onClick={() => {
                    setFromLoc(o);
                    setToLoc(d);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-slate-600 text-xs font-medium transition-colors cursor-pointer"
                >
                  {o} → {d}
                </button>
              ))}
            </div>
          </div>

          {/* ── Route Results Section ───────────────────────────────────────── */}
          {routeResult && (
            <div className="space-y-5">
              
              {/* ── Metro Rail Shortest Way Card (When Available) ── */}
              {routeResult.metro_available && routeResult.shortest_way && (
                <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50/90 via-orange-50/50 to-white p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-red-600/20 shrink-0">
                        🚇
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white">
                            ⚡ Recommended Shortest Way (মেট্রোরেল)
                          </span>
                          <span className="text-[10px] font-bold text-red-800 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                            Saves ~{routeResult.shortest_way.time_saved_min || 35} mins vs Road Traffic
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1">
                          {routeResult.shortest_way.title} ({routeResult.shortest_way.title_bn || 'মেট্রোরেল'})
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
                          {routeResult.shortest_way.reason || 'Dhaka Metro Rail (MRT-6) provides the fastest, jam-free journey with trains arriving every 5-8 minutes.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white px-3.5 py-2 rounded-xl border border-red-200/80 shadow-2xs self-start sm:self-auto shrink-0 text-xs">
                      <div className="text-center">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Fastest Time</span>
                        <span className="text-sm font-extrabold text-red-600">
                          ~{routeResult.shortest_way.est_time_min}m
                        </span>
                      </div>
                      <div className="w-px h-6 bg-slate-200"></div>
                      <div className="text-center">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Fare</span>
                        <span className="text-sm font-extrabold text-emerald-700">
                          ৳{routeResult.shortest_way.fare_bdt || 45}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Header for Results */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>Direct Buses for</span>
                  <span className="text-indigo-700 font-bold">{routeResult.from}</span>
                  <span className="text-slate-400">➔</span>
                  <span className="text-indigo-700 font-bold">{routeResult.to}</span>
                </h3>
                {routeResult.has_direct_bus && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {routeResult.count} Direct Service{routeResult.count > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Direct Bus Cards Grid */}
              {routeResult.has_direct_bus && routeResult.buses && routeResult.buses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {routeResult.buses.map((bus) => {
                    const isExpanded = expandedBusId === bus.id;
                    const stops = bus.journey_stoppages || [];

                    return (
                      <div
                        key={bus.id}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-base font-bold text-slate-900 leading-tight">
                                {bus.name_bn || bus.name}
                              </h4>
                              {bus.name && bus.name !== bus.name_bn && (
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                  {bus.name}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {bus.route_code && (
                                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {bus.route_code}
                                </span>
                              )}
                              <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                {bus.type || 'Non-AC'}
                              </span>
                            </div>
                          </div>

                          {/* Quick Metrics Bar */}
                          <div className="grid grid-cols-3 gap-2 mt-3.5 text-center text-xs">
                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Fare</span>
                              <span className="text-sm font-bold text-emerald-700 block mt-0.5">
                                ৳{bus.fare_bdt || 25}
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Frequency</span>
                              <span className="text-sm font-bold text-slate-800 block mt-0.5">
                                ~{bus.frequency_min} min
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Trip Stops</span>
                              <span className="text-sm font-bold text-indigo-700 block mt-0.5">
                                {bus.stops_on_journey} Stops
                              </span>
                            </div>
                          </div>

                          {/* Boarding and Dropoff Flow Strip */}
                          <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                              <span className="text-slate-400 text-[11px]">Board:</span>
                              <span className="font-semibold text-slate-800 truncate">{bus.from_stop}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                              <span className="text-slate-400 text-[11px]">Dropoff:</span>
                              <span className="font-semibold text-slate-800 truncate">{bus.to_stop}</span>
                            </div>
                            <div className="text-[10.5px] text-slate-400 pt-1.5 border-t border-slate-200/60">
                              ⏰ Operating Hours: {bus.operating_hours || '06:00 AM - 11:00 PM'}
                            </div>
                          </div>

                          {/* Stoppages Accordion */}
                          {stops.length > 0 && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => toggleExpand(bus.id)}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 focus:outline-none cursor-pointer"
                              >
                                <span>{isExpanded ? 'Hide Stoppages' : `Show Journey Stops (${stops.length})`}</span>
                                <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                              </button>

                              {isExpanded && (
                                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                  <div className="flex flex-wrap items-center gap-1">
                                    {stops.map((s, idx) => (
                                      <React.Fragment key={idx}>
                                        <span className={`px-2 py-0.5 rounded text-[10.5px] font-medium border ${
                                          idx === 0
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                                            : idx === stops.length - 1
                                            ? 'bg-rose-50 text-rose-800 border-rose-300 font-bold'
                                            : 'bg-white text-slate-700 border-slate-200'
                                        }`}>
                                          {s}
                                        </span>
                                        {idx < stops.length - 1 && (
                                          <span className="text-slate-300 text-[9px]">→</span>
                                        )}
                                      </React.Fragment>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {bus.operator && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                            <span>Operator: {bus.operator}</span>
                            <span className="text-emerald-600 font-semibold">Active Daily</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : !routeResult.has_direct_bus && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-slate-800">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">ℹ️</span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        No direct single bus found for {routeResult.from} → {routeResult.to}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Refer to the road transit map below for recommended connecting options, 2-bus transfers, and Metro Rail (MRT-6).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── OpenStreetMap Detailed Transit Map ────────────────────────── */}
              <OSMTransitMap
                busTransit={routeResult}
                fromLocation={fromLoc}
                toLocation={toLoc}
              />
            </div>
          )}
        </div>
      )}

      {/* ── MODE 2: Comprehensive Dhaka Bus Master Catalog ──────────────────── */}
      {searchMode === 'keyword' && (
        <div className="space-y-5">
          {/* Search & Category Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-base">🔍</span>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search bus name (e.g. ইতিহাস, রাজধানী, বৈশাখী, Welcome) or stoppage (Gabtoli, Savar, Farmgate)..."
                spellCheck="false"
                autoComplete="off"
                className="w-full text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1 rounded cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400 font-medium text-[11px]">Filter:</span>
              {[
                { id: 'ALL', label: 'All Services' },
                { id: 'POPULAR', label: 'Popular Corridors' },
                { id: 'AC', label: 'AC Buses' },
                { id: 'NON_AC', label: 'Non-AC Buses' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setCatalogFilter(f.id)}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    catalogFilter === f.id
                      ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-400 font-mono">
                Showing {filteredBuses.length} of {buses.length}
              </span>
            </div>
          </div>

          {/* Bus Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBuses.map((bus) => {
              const isExpanded = expandedBusId === bus.id;
              const stops = bus.stoppages || [];

              return (
                <div
                  key={bus.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-base font-bold text-slate-900">
                          {bus.name_bn || bus.name}
                        </h4>
                        {bus.name && bus.name !== bus.name_bn && (
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {bus.name}
                          </p>
                        )}
                      </div>
                      {bus.route_code && (
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                          {bus.route_code}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-slate-800 mt-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                      {bus.origin} ⇄ {bus.destination}
                    </p>

                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Fare Range</span>
                        <span className="font-bold text-emerald-700">৳{bus.fare_min_bdt || 15} - ৳{bus.fare_max_bdt || 45}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Frequency</span>
                        <span className="font-bold text-slate-800">Every {bus.frequency_min || 8}m</span>
                      </div>
                    </div>

                    {/* Stoppages */}
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(bus.id)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 focus:outline-none cursor-pointer"
                      >
                        <span>{isExpanded ? 'Hide Stoppages' : `View ${stops.length} Stoppages`}</span>
                        <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs max-h-48 overflow-y-auto">
                          <div className="flex flex-wrap gap-1">
                            {stops.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-[10.5px]"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Operating: {bus.first_bus || '06:00 AM'} - {bus.last_bus || '11:00 PM'}</span>
                    <span className="text-slate-600 font-medium">{bus.type || 'Non-AC'}</span>
                  </div>
                </div>
              );
            })}

            {filteredBuses.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                No buses found matching "{keyword}".
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

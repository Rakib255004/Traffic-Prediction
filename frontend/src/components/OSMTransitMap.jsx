import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { NODE_COORDINATES } from '../utils/dhakaRoutesData.js';

// ── Known Intermediate Corridors to Curve Realistically Along Streets ──────────
const DETAILED_CORRIDORS = {
  // Aminbazar -> Mirpur 10 (via Gabtoli, Technical, Mirpur 1, Mirpur 2)
  'aminbazar_mirpur 10': [
    [23.785, 90.330],
    [23.7845, 90.3475], // Gabtoli
    [23.7820, 90.3550], // Technical
    [23.7950, 90.3540], // Mirpur 1
    [23.8045, 90.3620], // Mirpur 2
    [23.8069, 90.3687], // Mirpur 10
  ],
  // Mirpur 10 -> Abdullahpur (via Mirpur 11, 12, Kalshi, ECB Chattor, Airport)
  'mirpur 10_abdullahpur': [
    [23.8069, 90.3687], // Mirpur 10
    [23.8180, 90.3660], // Mirpur 11
    [23.8260, 90.3650], // Mirpur 12
    [23.8241, 90.3780], // Kalshi
    [23.8228, 90.3932], // ECB Chattor
    [23.8510, 90.4075], // Airport
    [23.8759, 90.3970], // Uttara House Building
    [23.8820, 90.3990], // Abdullahpur
  ],
  // Aminbazar -> Gabtoli
  'aminbazar_gabtoli': [
    [23.785, 90.330],
    [23.7845, 90.3475],
  ],
  // Gabtoli -> Abdullahpur (via Technical, Mirpur 1, Sony, ECB, Airport)
  'gabtoli_abdullahpur': [
    [23.7845, 90.3475], // Gabtoli
    [23.7820, 90.3550], // Technical
    [23.7950, 90.3540], // Mirpur 1
    [23.8069, 90.3687], // Mirpur 10
    [23.8241, 90.3780], // Kalshi
    [23.8228, 90.3932], // ECB Chattor
    [23.8510, 90.4075], // Airport
    [23.8820, 90.3990], // Abdullahpur
  ],
  // Badda -> Abdullahpur
  'badda_abdullahpur': [
    [23.7806, 90.4267], // Badda
    [23.7980, 90.4240], // Notun Bazar
    [23.8150, 90.4200], // Kuril
    [23.8350, 90.4150], // Khilkhet
    [23.8510, 90.4075], // Airport
    [23.8759, 90.3970], // Uttara
    [23.8820, 90.3990], // Abdullahpur
  ],
  // Abdullahpur -> Ashulia
  'abdullahpur_ashulia': [
    [23.8820, 90.3990], // Abdullahpur
    [23.8880, 90.3820], // Kamarpara
    [23.8920, 90.3590], // Dhour
    [23.8950, 90.3150], // Ashulia
  ],
  // Badda -> Farmgate
  'badda_farmgate': [
    [23.7806, 90.4267], // Badda
    [23.7630, 90.4230], // Rampura
    [23.7516, 90.3934], // Karwan Bazar
    [23.7570, 90.3888], // Farmgate
  ],
  // Badda -> Mirpur 10
  'badda_mirpur 10': [
    [23.7806, 90.4267], // Badda
    [23.7776, 90.4054], // Mohakhali
    [23.7880, 90.3950], // Jahangir Gate
    [23.8010, 90.3850], // Mirpur 14
    [23.8069, 90.3687], // Mirpur 10
  ],
  // Metro Rail MRT Line 6 (Mirpur 10 -> Uttara North Diabari)
  'metro_mrt6_mirpur_uttara': [
    [23.8069, 90.3687], // Mirpur 10
    [23.8180, 90.3660], // Mirpur 11
    [23.8250, 90.3640], // Pallabi
    [23.8500, 90.3680], // Uttara South
    [23.8650, 90.3700], // Uttara Center
    [23.8780, 90.3720], // Uttara North (Diabari)
  ],
  // Metro Rail MRT Line 6 (Farmgate -> Uttara North Diabari)
  'metro_mrt6_farmgate_uttara': [
    [23.7570, 90.3888], // Farmgate
    [23.7680, 90.3880], // Bijoy Sarani
    [23.7780, 90.3800], // Agargaon
    [23.7910, 90.3730], // Shewrapara
    [23.7980, 90.3710], // Kazipara
    [23.8069, 90.3687], // Mirpur 10
    [23.8180, 90.3660], // Mirpur 11
    [23.8250, 90.3640], // Pallabi
    [23.8780, 90.3720], // Uttara North
  ],
  // Khagan -> Abdullahpur
  'khagan_abdullahpur': [
    [23.8710, 90.3250], // Khagan
    [23.8800, 90.3400], // Birulia
    [23.8920, 90.3590], // Dhour
    [23.8880, 90.3820], // Kamarpara
    [23.8820, 90.3990], // Abdullahpur
  ],
  // Khagan -> Airport
  'khagan_airport': [
    [23.8710, 90.3250], // Khagan
    [23.8800, 90.3400], // Birulia
    [23.8920, 90.3590], // Dhour
    [23.8820, 90.3990], // Abdullahpur
    [23.8510, 90.4075], // Airport
  ]
};

// ── Coordinate Helper ────────────────────────────────────────────────────────
function getStopCoord(name) {
  if (!name) return [23.785, 90.38];
  const low = name.toLowerCase().trim();

  for (const [k, v] of Object.entries(NODE_COORDINATES)) {
    if (k.toLowerCase() === low) return v;
  }
  for (const [k, v] of Object.entries(NODE_COORDINATES)) {
    if (low.includes(k.toLowerCase()) || k.toLowerCase().includes(low)) return v;
  }
  // Fallbacks
  if (low.includes('aminbazar')) return [23.785, 90.33];
  if (low.includes('gabtoli')) return [23.7845, 90.3475];
  if (low.includes('mirpur 10')) return [23.8069, 90.3687];
  if (low.includes('mirpur 1')) return [23.795, 90.354];
  if (low.includes('abdullahpur')) return [23.882, 90.399];
  if (low.includes('airport')) return [23.851, 90.4075];
  if (low.includes('badda')) return [23.7806, 90.4267];
  if (low.includes('ashulia')) return [23.895, 90.315];
  if (low.includes('khagan') || low.includes('daffodil')) return [23.871, 90.325];
  if (low.includes('farmgate')) return [23.757, 90.3888];
  if (low.includes('motijheel')) return [23.733, 90.4172];
  if (low.includes('savar')) return [23.8467, 90.2575];

  return [23.780, 90.390];
}

// ── Street Interpolator between two nodes ─────────────────────────────────────
function getStreetPath(fromName, toName, mode) {
  const fLow = (fromName || '').toLowerCase().trim();
  const tLow = (toName || '').toLowerCase().trim();

  // Check predefined corridors
  for (const [key, pts] of Object.entries(DETAILED_CORRIDORS)) {
    const [kFrom, kTo] = key.split('_');
    if (fLow.includes(kFrom) && tLow.includes(kTo)) return pts;
    if (fLow.includes(kTo) && tLow.includes(kFrom)) return [...pts].reverse();
  }

  // Metro MRT-6 special check
  if (mode === 'metro') {
    if (fLow.includes('mirpur') || tLow.includes('mirpur')) {
      return DETAILED_CORRIDORS['metro_mrt6_mirpur_uttara'];
    }
    return DETAILED_CORRIDORS['metro_mrt6_farmgate_uttara'];
  }

  // Default: Interpolate with a slight street curve
  const p1 = getStopCoord(fromName);
  const p2 = getStopCoord(toName);

  const midLat = (p1[0] + p2[0]) / 2 + (p2[1] - p1[1]) * 0.08;
  const midLng = (p1[1] + p2[1]) / 2 - (p2[0] - p1[0]) * 0.08;

  return [p1, [midLat, midLng], p2];
}

// ── Pill Marker HTML Generator (Matching User's Reference Image) ──────────────
function createPillIcon(text, icon, color = '#2563eb') {
  const html = `
    <div style="
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: #ffffff;
      color: #0f172a;
      border: 1.5px solid rgba(226, 232, 240, 0.95);
      border-radius: 9999px;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.16), 0 2px 4px rgba(0, 0, 0, 0.06);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;
      transform: translate(-50%, -50%);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      user-select: none;
    " class="transit-pill-hover">
      <span style="color: #0f172a; letter-spacing: -0.01em;">${text}</span>
      <span style="font-size: 15px; display: inline-flex; align-items: center; justify-content: center;">${icon}</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -18],
  });
}

// ── Start Pedestrian Pin (Orange Teardrop with Walking Man) ───────────────────
function createStartPinIcon(label = 'Start') {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
      <defs>
        <filter id="pinShadow" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <path d="M19,2 C9.6,2 2,9.6 2,19 C2,31 19,46 19,46 C19,46 36,31 36,19 C36,9.6 28.4,2 19,2 Z"
        fill="#f97316" stroke="#ffffff" stroke-width="2.5" filter="url(#pinShadow)"/>
      <circle cx="19" cy="19" r="10" fill="#ffffff"/>
      <text x="19" y="24" font-size="14" text-anchor="middle" font-weight="bold">🚶</text>
    </svg>
  `;

  return L.divIcon({
    html: `<div title="${label}" style="width:38px;height:48px;">${svg}</div>`,
    className: '',
    iconSize: [38, 48],
    iconAnchor: [19, 46],
    popupAnchor: [0, -48],
  });
}

// ── Destination Pin (Checkered Racing Flag) ──────────────────────────────────
function createFinishFlagIcon(label = 'Destination') {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
      <ellipse cx="14" cy="45" rx="10" ry="3.5" fill="rgba(0,0,0,0.3)"/>
      <line x1="14" y1="6" x2="14" y2="45" stroke="#334155" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="14" cy="6" r="3" fill="#f59e0b"/>
      <!-- Checkered Pattern -->
      <rect x="14" y="8" width="11" height="8" fill="#ffffff" stroke="#1e293b" stroke-width="1"/>
      <rect x="25" y="8" width="11" height="8" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
      <rect x="14" y="16" width="11" height="8" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
      <rect x="25" y="16" width="11" height="8" fill="#ffffff" stroke="#1e293b" stroke-width="1"/>
    </svg>
  `;

  return L.divIcon({
    html: `<div title="${label}" style="width:40px;height:48px;">${svg}</div>`,
    className: '',
    iconSize: [40, 48],
    iconAnchor: [14, 45],
    popupAnchor: [0, -46],
  });
}

// ── Interchange Hub Icon ─────────────────────────────────────────────────────
function createHubIcon(label = 'Interchange Hub') {
  const html = `
    <div style="
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #f59e0b;
      border: 3px solid #ffffff;
      box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 13px;
      font-weight: 800;
      transform: translate(-50%, -50%);
    ">
      🔄
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -14],
  });
}

// ── Master Component: OSM Transit Map (Matching Reference Image) ──────────────
export default function OSMTransitMap({ busTransit, fromLocation, toLocation }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef(null);

  const [activeTab, setActiveTab] = useState(0);

  if (!busTransit && !fromLocation && !toLocation) return null;

  const available = busTransit?.available === true;
  const buses = busTransit?.buses || [];
  const transferRoutes = busTransit?.transfer_routes || [];
  const transfer = busTransit?.transfer_suggestion;

  const activeRoute = transferRoutes[activeTab] || transferRoutes[0] || null;

  // ── Initialize Map on OSM Street Tiles ──────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center over central Dhaka
    const map = L.map(mapContainerRef.current, {
      center: [23.8103, 90.3800],
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Clean OpenStreetMap Street Tiles matching reference screenshot
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    osmLayer.addTo(map);

    layersGroupRef.current = L.featureGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── Render Multi-Modal Segments with Floating Badges & Hover Tooltips ────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // ── Build Segments matching the User's Reference Screenshot ──
    // Visual Order:
    // 1. Walk: Dotted orange line + '10 min walk 🚶'
    // 2. 1st Bus: Solid blue line + '20 min 🚌' (Hover shows authentic buses)
    // 3. Metro / Transit Hub: Solid red line + 'Metro 🚇'
    // 4. 2nd Bus: Solid purple line + '2nd Bus 🚌' (Hover shows connecting buses)
    // 5. Checkered flag at destination!

    let segments = [];

    if (available && buses.length > 0) {
      // Direct Bus Route Case
      const startCoord = getStopCoord(fromLocation);
      const boardingCoord = getStopCoord(buses[0]?.from_stop || fromLocation);
      const destCoord = getStopCoord(toLocation);
      const busPath = getStreetPath(buses[0]?.from_stop || fromLocation, toLocation, 'bus');

      segments = [
        {
          mode: 'walk',
          name: 'Walking Feeder',
          color: '#ea580c',
          isDotted: true,
          pillText: '5 min walk',
          pillIcon: '🚶',
          coords: [startCoord, boardingCoord],
          instructions: `Walk ~250m to ${buses[0]?.from_stop || fromLocation} boarding stand.`,
        },
        {
          mode: 'bus',
          name: 'Direct Bus Service',
          color: '#2563eb',
          isDotted: false,
          pillText: `${buses[0]?.stops_on_journey ? Math.round(buses[0].stops_on_journey * 2.8) : 25} min`,
          pillIcon: '🚌',
          coords: busPath,
          buses: buses,
          fare: buses[0]?.fare_bdt || 25,
          time: 25,
          instructions: `Board ${buses.slice(0, 3).map(b => b.name_bn || b.name).join(' or ')} directly.`,
        }
      ];
    } else if (activeRoute && activeRoute.legs) {
      // Multi-Modal Transfer Case (Matching user's reference diagram)
      const legs = activeRoute.legs;

      // Extract legs
      const leg1 = legs.find(l => l.step_num === 1);
      const legHub = legs.find(l => l.mode === 'transfer');
      const leg2 = legs.find(l => l.step_num === 3 || (l.step_num === 2 && l.mode !== 'transfer'));
      const hasMetroInRoute = legs.some(l => l.mode === 'metro');

      // Origin coord
      const originCoord = getStopCoord(fromLocation);
      const hubName = legHub?.hub_name || leg1?.to || 'Mirpur 10';
      const hubCoord = getStopCoord(hubName);
      const destCoord = getStopCoord(toLocation);

      // 1. Walk Leg: Origin -> First Boarding Point
      const board1Coord = getStopCoord(leg1?.from || fromLocation);
      segments.push({
        mode: 'walk',
        name: 'Walking on Foot',
        color: '#ea580c',
        isDotted: true,
        pillText: '10 min walk',
        pillIcon: '🚶',
        coords: [originCoord, board1Coord],
        instructions: `Walk from ${fromLocation} to the main road boarding point.`,
      });

      // 2. 1st Bus Leg: Boarding Point -> Transfer Hub (Blue Line)
      const bus1Path = getStreetPath(leg1?.from || fromLocation, hubName, leg1?.mode || 'bus');
      segments.push({
        mode: leg1?.mode || 'bus',
        name: leg1?.mode_label || '1st Bus Service',
        color: '#2563eb', // Blue like reference
        isDotted: false,
        pillText: `${leg1?.est_time_min || 20} min`,
        pillIcon: leg1?.mode === 'shared_bus' ? '🚐' : '🚌',
        coords: bus1Path,
        buses: leg1?.buses || [],
        shared: leg1?.shared_transit_services || [],
        fare: leg1?.est_fare_bdt || 30,
        time: leg1?.est_time_min || 20,
        from: leg1?.from || fromLocation,
        to: hubName,
        instructions: leg1?.instructions || 'Board Leg 1 bus towards the interchange hub.',
      });

      // 3. Metro Leg (if Metro is in route) OR Red Segment
      if (hasMetroInRoute) {
        const metroLeg = legs.find(l => l.mode === 'metro');
        const metroPath = getStreetPath(metroLeg?.from || hubName, metroLeg?.to || 'Uttara North', 'metro');
        segments.push({
          mode: 'metro',
          name: 'Dhaka Metro Rail (MRT Line 6)',
          color: '#dc2626', // Red line like reference
          isDotted: false,
          pillText: 'Metro',
          pillIcon: '🚇',
          coords: metroPath,
          isMetro: true,
          fare: metroLeg?.est_fare_bdt || 45,
          time: metroLeg?.est_time_min || 18,
          from: metroLeg?.from || 'Mirpur 10',
          to: metroLeg?.to || 'Uttara North',
          instructions: 'Board the elevated Metro Rail train. 100% traffic-jam free air-conditioned ride.',
        });
      }

      // 4. 2nd Bus / Onward Leg: Hub -> Destination (Purple Line)
      const onwardFrom = hasMetroInRoute ? 'Uttara North' : hubName;
      const onwardMode = leg2?.mode || 'bus';
      const bus2Path = getStreetPath(onwardFrom, toLocation, onwardMode);
      segments.push({
        mode: onwardMode,
        name: leg2?.mode_label || '2nd Bus Service',
        color: '#9333ea', // Purple line like reference
        isDotted: false,
        pillText: onwardMode === 'auto_rickshaw' ? '15 min CNG' : '2nd Bus',
        pillIcon: onwardMode === 'auto_rickshaw' ? '🛺' : '🚌',
        coords: bus2Path,
        buses: leg2?.buses || [],
        local_transports: leg2?.local_transports || [],
        fare: leg2?.est_fare_bdt || 30,
        time: leg2?.est_time_min || 26,
        from: onwardFrom,
        to: toLocation,
        instructions: leg2?.instructions || 'Board 2nd bus directly to destination.',
      });
    }

    // ── Draw Segments, Pills & Tooltips on OSM ────────────────────────────────
    let allPoints = [];

    segments.forEach((seg, sIdx) => {
      if (!seg.coords || seg.coords.length < 2) return;
      allPoints = allPoints.concat(seg.coords);

      // 1. Draw Polyline (Thick clean colored route along streets)
      const poly = L.polyline(seg.coords, {
        color: seg.color,
        weight: seg.isDotted ? 5 : 7,
        opacity: 0.95,
        dashArray: seg.isDotted ? '7, 8' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);

      // 2. Find Midpoint along Polyline for the Floating Pill Badge
      const midIndex = Math.floor(seg.coords.length / 2);
      const midCoord = seg.coords.length === 2
        ? [(seg.coords[0][0] + seg.coords[1][0]) / 2, (seg.coords[0][1] + seg.coords[1][1]) / 2]
        : seg.coords[midIndex];

      // 3. Create Rich Hover Tooltip Content
      let tooltipHtml = '';
      if (seg.mode === 'walk') {
        tooltipHtml = `
          <div style="font-family:'Inter',sans-serif; min-width:180px; padding:2px;">
            <div style="font-weight:800; font-size:12px; color:#ea580c; margin-bottom:3px;">🚶 Pedestrian Footpath</div>
            <div style="font-size:11px; color:#334155;">${seg.instructions}</div>
            <div style="font-size:10px; color:#64748b; margin-top:4px; font-weight:600;">Est. Time: ~10 mins (250m)</div>
          </div>
        `;
      } else if (seg.isMetro) {
        tooltipHtml = `
          <div style="font-family:'Inter',sans-serif; min-width:220px; padding:2px;">
            <div style="font-weight:800; font-size:13px; color:#dc2626; margin-bottom:4px;">🚇 Dhaka Metro Rail (MRT Line 6)</div>
            <div style="font-size:11px; font-weight:700; color:#0f172a;">${seg.from} ➔ ${seg.to}</div>
            <div style="font-size:11px; color:#475569; margin:4px 0;">Elevated Rapid Transit • Bypasses 100% Traffic Jams</div>
            <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; margin-top:6px; border-top:1px solid #f1f5f9; pt-1;">
              <span style="color:#0284c7;">Time: ~${seg.time} min</span>
              <span style="color:#16a34a;">Fare: ৳${seg.fare}</span>
            </div>
          </div>
        `;
      } else {
        // Bus or Feeder Leg -> Show authentic bus names!
        const busList = seg.buses || [];
        tooltipHtml = `
          <div style="font-family:'Inter',sans-serif; min-width:240px; padding:4px;">
            <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-bottom:6px;">
              <span style="font-weight:800; font-size:12px; color:${seg.color}; text-transform:uppercase; letter-spacing:0.5px;">
                ${seg.pillIcon} ${seg.name}
              </span>
              <span style="font-size:11px; font-weight:700; color:#16a34a; background:#f0fdf4; padding:2px 6px; border-radius:6px; border:1px solid #bbf7d0;">
                ৳${seg.fare}
              </span>
            </div>

            <div style="font-size:11px; color:#475569; margin-bottom:6px; font-weight:600;">
              ${seg.from || ''} ➔ ${seg.to || ''} (~${seg.time} mins)
            </div>

            ${busList.length > 0 ? `
              <div style="font-size:11px; font-weight:700; color:#0f172a; margin-bottom:4px;">
                Available Bus Services (Board any):
              </div>
              <div style="display:flex; flex-direction:column; gap:4px; max-height:160px; overflow-y:auto;">
                ${busList.slice(0, 5).map(b => `
                  <div style="display:flex; align-items:center; justify-content:space-between; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:3px 6px;">
                    <div>
                      <span style="font-weight:800; font-size:12px; color:#1e293b;">${b.name_bn || b.name}</span>
                      ${b.name && b.name !== b.name_bn ? `<span style="font-size:10px; color:#64748b; margin-left:4px;">(${b.name})</span>` : ''}
                    </div>
                    ${b.route_code ? `<span style="font-size:9px; background:#e0f2fe; color:#0369a1; font-weight:800; padding:1px 5px; border-radius:4px;">${b.route_code}</span>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : (seg.local_transports ? `
              <div style="font-size:11px; color:#0f172a; font-weight:700;">Local Options:</div>
              <div style="font-size:11px; color:#475569;">${seg.local_transports.join(', ')}</div>
            ` : '')}

            <div style="font-size:10px; color:#64748b; margin-top:6px; border-top:1px dashed #e2e8f0; padding-top:4px; font-style:italic;">
              ${seg.instructions}
            </div>
          </div>
        `;
      }

      // 4. Create Floating Pill Marker at Midpoint
      const pillIcon = createPillIcon(seg.pillText, seg.pillIcon, seg.color);
      const pillMarker = L.marker(midCoord, { icon: pillIcon, zIndexOffset: 800 }).addTo(group);

      // Attach Interactive Hover Popup
      pillMarker.bindPopup(tooltipHtml, {
        closeButton: true,
        className: 'transit-pill-popup',
        maxWidth: 280,
      });

      // Hover trigger
      pillMarker.on('mouseover', function () {
        this.openPopup();
      });

      // Also hover on the polyline opens the popup
      poly.on('mouseover', () => {
        pillMarker.openPopup();
      });
    });

    // ── 5. Add Start Pin (Orange Pedestrian Pin) ──
    const startPos = getStopCoord(fromLocation);
    const startPin = L.marker(startPos, {
      icon: createStartPinIcon(fromLocation),
      zIndexOffset: 1000,
    }).addTo(group);
    startPin.bindPopup(`
      <div style="font-family:'Inter',sans-serif; padding:2px;">
        <span style="font-weight:800; color:#ea580c; font-size:12px;">📍 Journey Origin</span>
        <div style="font-size:13px; font-weight:700; color:#0f172a; margin-top:2px;">${fromLocation}</div>
      </div>
    `);

    // ── 6. Add Destination Finish Checkered Flag ──
    const destPos = getStopCoord(toLocation);
    const destPin = L.marker(destPos, {
      icon: createFinishFlagIcon(toLocation),
      zIndexOffset: 1000,
    }).addTo(group);
    destPin.bindPopup(`
      <div style="font-family:'Inter',sans-serif; padding:2px;">
        <span style="font-weight:800; color:#16a34a; font-size:12px;">🏁 Final Destination</span>
        <div style="font-size:13px; font-weight:700; color:#0f172a; margin-top:2px;">${toLocation}</div>
      </div>
    `);

    // ── 7. Fit Bounds to cover all coordinates smoothly ──
    if (allPoints.length > 0) {
      map.fitBounds(L.latLngBounds(allPoints), {
        padding: [60, 60],
        maxZoom: 14,
        animate: true,
      });
    }
  }, [activeTab, busTransit, fromLocation, toLocation, available, activeRoute]);

  return (
    <div className="mt-6 pt-6 border-t border-slate-200/90">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
              🗺️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                OpenStreetMap Route Suggestion
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bengali">
                  বাস ও ট্রানজিট রুট ম্যাপ
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {fromLocation} ➔ {toLocation}
                <span className="ml-2 font-semibold text-blue-600">
                  • Hover over any pill card (e.g. 20 min 🚌 or Metro 🚇) to view authentic bus names
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Total Time & Fare Badge */}
        <div className="flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Time</span>
            <span className="font-extrabold text-slate-800">
              ~{activeRoute?.total_est_time_min || 35} mins
            </span>
          </div>
          <div className="w-px h-5 bg-slate-200"></div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Fare</span>
            <span className="font-extrabold text-emerald-700">
              ~৳{activeRoute?.total_est_fare_bdt || 30}
            </span>
          </div>
        </div>
      </div>

      {/* ── Route Options Tabs ── */}
      {transferRoutes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {transferRoutes.map((tr, idx) => {
            const isSel = idx === activeTab;
            const isMetro = tr.type === 'metro_multimodal';

            return (
              <button
                key={tr.id || idx}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                  isSel
                    ? isMetro
                      ? 'bg-red-600 text-white border-red-600 shadow-xs font-bold'
                      : 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{isMetro ? '🚇' : '🚌'}</span>
                <span>{tr.title}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  isSel ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  ~{tr.total_est_time_min}m · ৳{tr.total_est_fare_bdt}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── The Leaflet OpenStreetMap Canvas (Matching User's Reference Screenshot) ── */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '490px' }}
          className="z-10"
        />

        {/* Legend Overlay Bar at Bottom */}
        <div className="absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 shadow-md text-xs flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1 border-t-2 border-dashed border-orange-500 inline-block"></span>
            <span className="text-[11px] font-bold text-slate-700">Walk 🚶</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1.5 bg-blue-600 rounded-sm inline-block"></span>
            <span className="text-[11px] font-bold text-slate-700">1st Bus 🚌</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1.5 bg-red-600 rounded-sm inline-block"></span>
            <span className="text-[11px] font-bold text-slate-700">Metro Rail 🚇</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1.5 bg-purple-600 rounded-sm inline-block"></span>
            <span className="text-[11px] font-bold text-slate-700">2nd Bus 🚌</span>
          </div>
          <span className="text-[10px] text-slate-400 italic">
            • Hover over any pill card to view bus names
          </span>
        </div>
      </div>
    </div>
  );
}

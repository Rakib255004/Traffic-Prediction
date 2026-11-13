import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUS_DIR = path.join(__dirname, '..', 'data', 'bus');
const MASTER_JSON = path.join(BUS_DIR, 'dhaka_bus_routes.json');
const STOPS_JSON = path.join(BUS_DIR, 'bus_stops.json');
const ROUTES_DIR = path.join(BUS_DIR, 'routes');

let busRoutesCache = null;
let busStopsCache = null;

// Comprehensive alias dictionary mapping colloquial, Bengali, English, and landmark variations to canonical bus stop terms
const STOP_ALIASES = {
  'savar': ['savar', 'savar bus stand', 'savar bazar', 'radio colony', 'c&b', 'c&b mor', 'সাভার'],
  'savar bus stand': ['savar bus stand', 'savar', 'radio colony', 'সাভার বাস স্ট্যান্ড'],
  'mirpur 10': ['mirpur 10', 'mirpur-10', 'mirpur 10 golchottor', 'mirpur 10 circle', 'মিরপুর ১০', 'মিরপুর 10', '১০ নম্বর'],
  'mirpur 1': ['mirpur 1', 'mirpur-1', 'mirpur 1 circle', 'muktodhara', 'মিরপুর ১', 'মিরপুর 1', '১ নম্বর'],
  'mirpur 2': ['mirpur 2', 'mirpur-2', 'commerce college', 'মিরপুর ২', 'মিরপুর 2'],
  'mirpur 14': ['mirpur 14', 'mirpur-14', 'dental', 'মিরপুর ১৪', 'মিরপুর 14'],
  'mirpur 12': ['mirpur 12', 'mirpur-12', 'kalshi', 'মিরপুর ১২', 'মিরপুর 12'],
  'gabtoli': ['gabtoli', 'gabtoli bus stand', 'gabtoli terminal', 'গাবতলী', 'গাবতলি'],
  'technical': ['technical', 'technical mor', 'bangla college', 'টেকনিক্যাল'],
  'kallyanpur': ['kallyanpur', 'কল্যাণপুর'],
  'shyamoli': ['shyamoli', 'shishu mela', 'suhrawardy hospital', 'শ্যামলী'],
  'agargaon': ['agargaon', 'passport office', 'pangu hospital', 'biman bhaban', 'আগারগাঁও'],
  'bijoy sarani': ['bijoy sarani', 'bijoy shoroni', 'military museum', 'বিজয় সরণি', 'বিজয় স্মরণী'],
  'farmgate': ['farmgate', 'ananda cinema', 'khamarbari', 'tejturi bazar', 'green road', 'ফার্মগেট'],
  'shahbagh': ['shahbagh', 'pg hospital', 'bsmmu', 'dhaka university', 'shahbag', 'শাহবাগ'],
  'motijheel': ['motijheel', 'shapla chattor', 'dainik bangla', 'dilkusha', 'bangladesh bank', 'মতিঝিল'],
  'gulistan': ['gulistan', 'gulisthan', 'golap shah mazar', 'fulbaria', 'zero point', 'গুলিস্তান'],
  'sayedabad': ['sayedabad', 'sayedabad terminal', 'janapath', 'সায়েদাবাদ'],
  'jatrabari': ['jatrabari', 'jatrabari chowrasta', 'যাত্রাবাড়ী'],
  'uttara': ['uttara', 'house building', 'azampur', 'jasimuddin', 'rajlokkhi', 'sector 3', 'sector 7', 'sector 10', 'diabari', 'উত্তরা'],
  'abdullahpur': ['abdullahpur', 'house building', 'abdullahpur bus stand', 'আব্দুল্লাহপুর'],
  'airport': ['airport', 'dhaka airport', 'hazrat shahjalal', 'shahjalal international airport', 'airport golchottor', 'kawla', 'বিমানবন্দর', 'এয়ারপোর্ট'],
  'khagan': ['khagan', 'খাগান', 'daffodil', 'diu', 'birulia', 'birulia bridge', 'khagan bazar', 'ashulia model town'],
  'birulia': ['birulia', 'birulia bridge', 'বিরুলিয়া'],
  'dhour': ['dhour', 'dour', 'ধৌড়', 'ashulia beribadh'],
  'kamarpara': ['kamarpara', 'কামারপাড়া'],
  'mohakhali': ['mohakhali', 'mohakhali flyover', 'wireless mor', 'icddrb', 'amtoli', 'মহাখালী'],
  'banani': ['banani', 'kakoli', 'chairman bari', 'বনানী', 'কাকলী'],
  'gulshan 1': ['gulshan 1', 'gulshan-1', 'gulshan 1 circle', 'গুলশান ১', 'গুলশান 1'],
  'gulshan 2': ['gulshan 2', 'gulshan-2', 'gulshan 2 circle', 'গুলশান ২', 'গুলশান 2'],
  'badda': ['badda', 'badda link road', 'uttar badda', 'madhya badda', 'rampura bridge', 'বাড্ডা'],
  'badda link road': ['badda link road', 'badda', 'বাড্ডা লিংক রোড'],
  'notun bazar': ['notun bazar', 'natun bazar', 'bhatara', 'নতুন বাজার'],
  'kuril': ['kuril', 'kuril bishwa road', 'kuril flyover', 'কুড়িল'],
  'bashundhara': ['bashundhara', 'bashundhara r/a', 'বসুন্ধরা'],
  'rampura': ['rampura', 'rampura bridge', 'রামপুরা'],
  'malibagh': ['malibagh', 'malibagh mor', 'mouchak', 'মালিবাগ', 'মৌচাক'],
  'dhanmondi': ['dhanmondi', 'dhanmondi 27', 'dhanmondi 32', 'shankar', 'zigatola', 'star kabab', 'sobhanbagh', 'ধানমন্ডি'],
  'dhanmondi 27': ['dhanmondi 27', 'dhanmondi', 'shankar', 'ধানমন্ডি ২৭'],
  'dhanmondi 32': ['dhanmondi 32', 'sukrabad', 'ধানমন্ডি ৩২'],
  'science lab': ['science lab', 'science laboratory', 'city college', 'priyangan', 'সায়েন্স ল্যাব'],
  'azimpur': ['azimpur', 'nilkhet', 'eden college', 'palashi', 'আজিমপুর'],
  'chandra': ['chandra', 'chandra mor', 'চন্দ্রা'],
  'baipail': ['baipail', 'zirabo', 'epz', 'বাইপাইল'],
  'nabinagar': ['nabinagar', 'smriti shoudho', 'national monument', 'নবীনগর'],
  'hemayetpur': ['hemayetpur', 'হেমায়েতপুর'],
  'aminbazar': ['aminbazar', 'amin bazar bridge', 'আমিনবাজার'],
  'tongi': ['tongi', 'tongi station road', 'tongi bridge', 'cherag ali', 'টঙ্গী'],
  'gazipur': ['gazipur', 'gazipur chowrasta', 'chourasta', 'board bazar', 'গাজীপুর'],
  'mohammadpur': ['mohammadpur', 'shia mosque', 'town hall', 'japan garden city', 'shekhertek', 'মোহাম্মদপুর'],
  'postogola': ['postogola', 'buriganga bridge', 'পোস্তগোলা'],
  'sadarghat': ['sadarghat', 'victoria park', 'bahadur shah park', 'jagannath university', 'সদরঘাট'],
  'babubazar bridge': ['babubazar bridge', 'babubazar', 'badamtoli', 'mitford', 'nayabazar', 'বাবুবাজার'],
  'ashulia': ['ashulia', 'ashulia bazar', 'beribadh', 'dhour', 'আশুলিয়া'],
  'keraniganj': ['keraniganj', 'ghatarchar', 'kadamtoli', 'কেরানীগঞ্জ'],
  'kanchpur': ['kanchpur', 'kanchpur bridge', 'কাঁচপুর'],
  'purbachal': ['purbachal', '300ft', 'kanchan bridge', 'purbachal expressway', 'পূর্বাচল']
};

export function loadBusData() {
  if (!busRoutesCache && fs.existsSync(MASTER_JSON)) {
    try {
      const raw = fs.readFileSync(MASTER_JSON, 'utf-8');
      const parsed = JSON.parse(raw);
      busRoutesCache = parsed.routes || [];
    } catch (err) {
      console.warn('[BusService] Could not parse dhaka_bus_routes.json:', err.message);
      busRoutesCache = [];
    }
  }
  return busRoutesCache || [];
}

export function loadBusStops() {
  if (!busStopsCache && fs.existsSync(STOPS_JSON)) {
    try {
      const raw = fs.readFileSync(STOPS_JSON, 'utf-8');
      const parsed = JSON.parse(raw);
      busStopsCache = parsed.stops || [];
    } catch (err) {
      console.warn('[BusService] Could not parse bus_stops.json:', err.message);
      busStopsCache = [];
    }
  }
  return busStopsCache || [];
}

/**
 * Normalizes an input location string and finds matching index in the bus stoppages array.
 */
function findStopIndexInRoute(stoppages = [], query = '') {
  if (!query || !stoppages || stoppages.length === 0) return -1;
  const qClean = query.toLowerCase().trim().replace(/[-_]/g, ' ');
  const stopsLower = stoppages.map(s => s.toLowerCase().replace(/[-_]/g, ' '));

  const qNums = qClean.match(/\d+/g) || [];

  // Priority 1: Exact match
  const exactIdx = stopsLower.findIndex(s => s === qClean);
  if (exactIdx !== -1) return exactIdx;

  // Priority 2: Stop equals or contains the exact phrase with number integrity
  const phraseIdx = stopsLower.findIndex(s => {
    if (qNums.length > 0) {
      const sNums = s.match(/\d+/g) || [];
      if (!qNums.every(n => sNums.includes(n))) return false;
    }
    return s.includes(qClean) || qClean.includes(s);
  });
  if (phraseIdx !== -1) return phraseIdx;

  // Priority 3: Check alias dictionary entries
  for (const [key, variants] of Object.entries(STOP_ALIASES)) {
    const queryMatchesKey = qClean === key || variants.some(v => v === qClean || (qClean.includes(v) && (!qNums.length || (v.match(/\d+/g) || []).join() === qNums.join())));
    if (queryMatchesKey) {
      for (let i = 0; i < stopsLower.length; i++) {
        const s = stopsLower[i];
        if (s === key || variants.some(v => v === s || s.includes(v))) {
          if (qNums.length > 0) {
            const sNums = s.match(/\d+/g) || [];
            if (!qNums.every(n => sNums.includes(n))) continue;
          }
          return i;
        }
      }
    }
  }

  // Priority 4: Token-based word overlap
  const qTokens = qClean.split(/\s+/).filter(t => t.length > 1);
  if (qTokens.length > 0) {
    const tokenIdx = stopsLower.findIndex(s => {
      if (qNums.length > 0) {
        const sNums = s.match(/\d+/g) || [];
        if (!qNums.every(n => sNums.includes(n))) return false;
      }
      return qTokens.every(token => s.includes(token));
    });
    if (tokenIdx !== -1) return tokenIdx;
  }

  return -1;
}

/**
 * Checks if a specific bus connects point A and point B directly.
 */
function checkDirectBus(bus, from, to) {
  const stoppages = bus.stoppages || [];
  const fIdx = findStopIndexInRoute(stoppages, from);
  const tIdx = findStopIndexInRoute(stoppages, to);
  if (fIdx !== -1 && tIdx !== -1 && fIdx !== tIdx) {
    const isForward = fIdx < tIdx;
    const startIdx = Math.min(fIdx, tIdx);
    const endIdx = Math.max(fIdx, tIdx);
    const stopsTraversed = isForward
      ? stoppages.slice(startIdx, endIdx + 1)
      : [...stoppages.slice(startIdx, endIdx + 1)].reverse();

    return {
      connected: true,
      from_stop: stoppages[fIdx],
      to_stop: stoppages[tIdx],
      stops: stopsTraversed,
      numStops: stopsTraversed.length
    };
  }
  return { connected: false };
}

/**
 * Generates realistic multi-modal transfer itineraries with authentic bus names,
 * shared bus / leguna services, Metro Rail MRT-6, and local feeders.
 */
export function generateTransferRoutes(from, to, busList = []) {
  const fLow = (from || '').toLowerCase().trim();
  const tLow = (to || '').toLowerCase().trim();
  const itineraries = [];

  // Helper to find all buses between any two named stops
  const getBusesConnecting = (startPoint, endPoint) => {
    const found = [];
    for (const b of busList) {
      const chk = checkDirectBus(b, startPoint, endPoint);
      if (chk.connected) {
        found.push({
          name: b.name,
          name_bn: b.name_bn || b.name,
          route_code: b.route_code,
          from_stop: chk.from_stop,
          to_stop: chk.to_stop,
          fare: b.fare_min_bdt || 20,
          frequency_min: b.frequency_min || 8
        });
      }
    }
    return [...new Map(found.map(item => [item.name, item])).values()];
  };

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO A: KHAGAN (Daffodil / Birulia) -> AIRPORT / UTTARA / CITY
  // ───────────────────────────────────────────────────────────────────────────
  if (fLow.includes('khagan') || fLow.includes('daffodil') || fLow.includes('birulia')) {
    if (tLow.includes('airport') || tLow.includes('বিমানবন্দর') || tLow.includes('uttara') || tLow.includes('উত্তরা')) {
      const airportBuses = getBusesConnecting('Abdullahpur', 'Airport');
      const directAirportBusList = airportBuses.length > 0 ? airportBuses : [
        { name: 'Victor Classic', name_bn: 'ভিক্টর ক্লাসিক', route_code: 'VCT-01' },
        { name: 'Anabil Super', name_bn: 'অনাবিল সুপার', route_code: 'ANB-01' },
        { name: 'Raida Enterprise', name_bn: 'রাইদা এন্টারপ্রাইজ', route_code: 'RDA-01' },
        { name: 'BRTC Airport Shuttle', name_bn: 'বিআরটিসি বিমানবন্দর এক্সপ্রেস', route_code: 'BRTC-01' },
        { name: 'Balaka Paribahan', name_bn: 'বলাকা পরিবহন', route_code: 'BLK-01' }
      ];

      // Route 1: Feeder Shared Auto/Leguna to Abdullahpur -> Direct Highway Bus to Airport
      itineraries.push({
        id: 'khagan-airport-via-abdullahpur',
        type: 'feeder_bus_transfer',
        title: 'Shared Feeder Bus/Leguna to Abdullahpur → Direct Bus to Airport',
        title_bn: 'খাগান থেকে আব্দুল্লাহপুর লেগুনা/অটো → সরাসরি এয়ারপোর্ট বাস',
        tag: 'Most Popular Student & Commuter Route',
        recommended: true,
        total_est_time_min: 42,
        total_est_fare_bdt: 45,
        modes: ['shared_bus', 'bus'],
        summary: 'Take Khagan-Abdullahpur shared Leguna or battery auto-rickshaw to Abdullahpur bus stand, then board Victor Classic, Anabil Super, or Raida Enterprise directly to Airport.',
        legs: [
          {
            step_num: 1,
            mode: 'shared_bus',
            mode_label: 'Feeder Leg 1 (Shared Auto / Leguna)',
            mode_icon: '🚐',
            from: 'Khagan (DIU Smart City Gate / Birulia Road)',
            to: 'Abdullahpur Bus Stand (Uttara)',
            shared_transit_services: [
              { name: 'Khagan-Abdullahpur Shared Leguna / Human Hauler', name_bn: 'খাগান-আব্দুল্লাহপুর লেগুনা' },
              { name: 'DIU Campus Shuttle Bus', name_bn: 'ড্যাফোডিল শাটল বাস' },
              { name: 'Shared Battery Auto-rickshaw (Easy-bike)', name_bn: 'শেয়ার্ড ব্যাটারি অটো-রিকশা' }
            ],
            local_transports: ['Local Shared Leguna (Human Hauler)', 'Battery Easy-bike', 'Shared CNG via Dhour'],
            instructions: 'From Khagan (DIU Gate), board the Khagan-Abdullahpur Shared Leguna, DIU Shuttle, or battery auto-rickshaw via Birulia Road and Ashulia Beribadh/Dhour directly to Abdullahpur.',
            est_time_min: 22,
            est_fare_bdt: 25
          },
          {
            step_num: 2,
            mode: 'transfer',
            mode_label: 'Interchange Hub',
            mode_icon: '🔄',
            hub_name: 'Abdullahpur Bus Stand (Uttara)',
            instructions: 'Get down at Abdullahpur Bus Stand. Walk 1-2 minutes across the footover bridge to the southbound Airport/Gazipur highway bus counter.',
            est_time_min: 4,
            est_fare_bdt: 0
          },
          {
            step_num: 3,
            mode: 'bus',
            mode_label: 'Highway Bus Leg 2 (Direct to Airport)',
            mode_icon: '🚌',
            from: 'Abdullahpur Bus Stand',
            to: 'Hazrat Shahjalal International Airport (Dhaka Airport)',
            buses: directAirportBusList.slice(0, 5),
            instructions: 'Board Victor Classic, Anabil Super, Raida Enterprise, or BRTC Airport Shuttle. The bus runs straight south down Dhaka-Mymensingh Highway directly to Airport Golchottor.',
            est_time_min: 16,
            est_fare_bdt: 20
          }
        ]
      });

      // Route 2: Metro Rail (MRT Line 6) Express via Uttara North (Diabari)
      itineraries.push({
        id: 'khagan-airport-via-metro',
        type: 'metro_multimodal',
        title: 'Khagan → Diabari Metro Rail Feeder → Airport',
        title_bn: 'দিয়াবাড়ী মেট্রোরেল স্টেশন হয়ে এয়ারপোর্ট এক্সপ্রেস',
        tag: 'Fastest During Rush Hours',
        recommended: false,
        total_est_time_min: 36,
        total_est_fare_bdt: 50,
        modes: ['auto_rickshaw', 'bus'],
        summary: 'Take a short auto-rickshaw across Birulia Bridge to Diabari (Uttara North), then catch Raida Enterprise or local shuttle directly to Airport.',
        legs: [
          {
            step_num: 1,
            mode: 'auto_rickshaw',
            mode_label: 'Feeder Leg 1 (Local Auto-Rickshaw)',
            mode_icon: '🛺',
            from: 'Khagan Bazar / DIU Gate',
            to: 'Uttara North Metro Station (Diabari, Sector 18)',
            local_transports: ['Battery Auto-rickshaw (Easy-bike)', 'Shared CNG via Birulia Bridge'],
            instructions: 'Take a battery auto-rickshaw or shared CNG from Khagan across Birulia Bridge directly to Diabari / Uttara North Metro Station entrance.',
            est_time_min: 14,
            est_fare_bdt: 25
          },
          {
            step_num: 2,
            mode: 'transfer',
            mode_label: 'Diabari Transit Point',
            mode_icon: '🔄',
            hub_name: 'Uttara North (Diabari) Bus & Metro Hub',
            instructions: 'Walk 1 minute to the Diabari Sonargaon Janapath bus counter.',
            est_time_min: 2,
            est_fare_bdt: 0
          },
          {
            step_num: 3,
            mode: 'bus',
            mode_label: 'Direct Airport Feeder Bus',
            mode_icon: '🚌',
            from: 'Diabari (Uttara Sector 18)',
            to: 'Dhaka Airport (Kawla / Airport Road)',
            buses: [
              { name: 'Raida Enterprise', name_bn: 'রাইদা এন্টারপ্রাইজ', route_code: 'RDA-01' },
              { name: 'Uttara Feeder Shuttle', name_bn: 'উত্তরা সার্কুলার শাটল' }
            ],
            local_transports: ['Shared Auto to House Building / Airport', 'Shared CNG'],
            instructions: 'Board Raida Enterprise or a shared shuttle from Diabari running through Jashimuddin Road directly to Dhaka Airport.',
            est_time_min: 20,
            est_fare_bdt: 25
          }
        ]
      });

      // Route 3: Via Mirpur 1 (Technical) using Projapoti / Basumati Transport
      itineraries.push({
        id: 'khagan-airport-via-mirpur',
        type: 'two_bus_transfer',
        title: 'Khagan → Mirpur 1 Shared Leguna → Projapoti / Basumati to Airport',
        title_bn: 'মিরপুর ১ হয়ে প্রজাপতি / বসুমতি বাসে এয়ারপোর্ট',
        tag: 'Alternative via Mirpur Corridor',
        recommended: false,
        total_est_time_min: 55,
        total_est_fare_bdt: 60,
        modes: ['shared_bus', 'bus'],
        summary: 'Take Khagan-Mirpur 1 Leguna across Birulia to Mirpur 1 Golchottor, then board Projapoti Paribahan or Basumati Transport to Airport.',
        legs: [
          {
            step_num: 1,
            mode: 'shared_bus',
            mode_label: 'Shared Leguna Leg 1',
            mode_icon: '🚐',
            from: 'Khagan (DIU Gate)',
            to: 'Mirpur 1 Golchottor (Muktodhara)',
            shared_transit_services: [
              { name: 'Khagan-Mirpur 1 Shared Leguna / Human Hauler', name_bn: 'খাগান-মিরপুর ১ লেগুনা' }
            ],
            local_transports: ['Shared Leguna', 'Local Auto via Rainkhola'],
            instructions: 'Take the direct Khagan-Mirpur 1 Human Hauler (Leguna) or auto-rickshaw across Birulia Bridge & Rainkhola to Mirpur 1 circle.',
            est_time_min: 25,
            est_fare_bdt: 30
          },
          {
            step_num: 2,
            mode: 'transfer',
            mode_label: 'Interchange Hub',
            mode_icon: '🔄',
            hub_name: 'Mirpur 1 Golchottor',
            instructions: 'Get down at Mirpur 1. Head to the north-bound Airport/Abdullahpur bus stand near Muktodhara.',
            est_time_min: 3,
            est_fare_bdt: 0
          },
          {
            step_num: 3,
            mode: 'bus',
            mode_label: 'Direct Bus Leg 2 to Airport',
            mode_icon: '🚌',
            from: 'Mirpur 1',
            to: 'Dhaka Airport Golchottor',
            buses: [
              { name: 'Projapoti Paribahan', name_bn: 'প্রজাপতি পরিবহন', route_code: 'PRJ-01' },
              { name: 'Basumati Transport', name_bn: 'বসুমতি ট্রান্সপোর্ট', route_code: 'BSM-01' }
            ],
            instructions: 'Board Projapoti Paribahan or Basumati Transport running via Sony Cinema, Mirpur 10, ECB Chattor, and Kuril directly to Dhaka Airport.',
            est_time_min: 27,
            est_fare_bdt: 30
          }
        ]
      });

      return itineraries;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO B: BADDA <-> ASHULIA
  // ───────────────────────────────────────────────────────────────────────────
  if (
    (fLow.includes('badda') && tLow.includes('ashulia')) ||
    (fLow.includes('ashulia') && tLow.includes('badda'))
  ) {
    const isForward = fLow.includes('badda');

    itineraries.push({
      id: 'transfer-bus-abdullahpur',
      type: 'two_bus_transfer',
      title: isForward ? 'Two-Bus Transfer via Abdullahpur' : 'Two-Bus Transfer via Abdullahpur to Badda',
      title_bn: 'আব্দুল্লাহপুর হয়ে ২-বাস কানেক্টিং রুট',
      tag: 'Most Popular Bus Route',
      recommended: true,
      total_est_time_min: 70,
      total_est_fare_bdt: 65,
      modes: ['bus', 'bus'],
      summary: isForward
        ? 'Take Victor Classic, Anabil Super, or Turag from Badda to Abdullahpur, then switch to Ashulia Classic to Ashulia.'
        : 'Take Ashulia Classic to Abdullahpur, then switch to Victor Classic or Anabil Super to Badda.',
      legs: isForward ? [
        {
          step_num: 1,
          mode: 'bus',
          mode_label: 'Bus Leg 1',
          mode_icon: '🚌',
          from: 'Badda (Badda Link Road / Uttar Badda)',
          to: 'Abdullahpur Bus Stand',
          buses: [
            { name: 'Victor Classic', name_bn: 'ভিক্টর ক্লাসিক', route_code: 'VCT-01' },
            { name: 'Anabil Super', name_bn: 'অনাবিল সুপার', route_code: 'ANB-01' },
            { name: 'Turag Paribahan', name_bn: 'তুরাগ পরিবহন', route_code: 'TRG-01' },
            { name: 'Raida Enterprise', name_bn: 'রাইদা এন্টারপ্রাইজ', route_code: 'RDA-01' }
          ],
          instructions: 'Board Victor Classic, Anabil Super, or Turag Paribahan from Badda Link Road heading towards Gazipur/Abdullahpur via Kuril & Airport.',
          est_time_min: 45,
          est_fare_bdt: 35
        },
        {
          step_num: 2,
          mode: 'transfer',
          mode_label: 'Transit Interchange',
          mode_icon: '🔄',
          hub_name: 'Abdullahpur Bus Stand (Uttara)',
          instructions: 'Get down at Abdullahpur Bus Stand (near footover bridge). Walk 1-2 minutes westward towards the Kamarpara/Ashulia bus counter or local auto stand.',
          est_time_min: 4,
          est_fare_bdt: 0
        },
        {
          step_num: 3,
          mode: 'bus_or_feeder',
          mode_label: 'Bus / Local Feeder Leg 2',
          mode_icon: '🛺',
          from: 'Abdullahpur',
          to: 'Ashulia (Ashulia Bazar / Beribadh)',
          buses: [
            { name: 'Ashulia Classic', name_bn: 'আশুলিয়া ক্লাসিক', route_code: 'ASH-01' }
          ],
          local_transports: ['Local Battery Auto-rickshaw (Easy-bike)', 'Shared CNG', 'Leguna / Human Hauler'],
          instructions: 'Board Ashulia Classic bus or take a shared local auto-rickshaw/CNG from Abdullahpur via Kamarpara & Dhour to Ashulia Bazar.',
          est_time_min: 25,
          est_fare_bdt: 30
        }
      ] : [
        {
          step_num: 1,
          mode: 'bus_or_feeder',
          mode_label: 'Bus / Local Feeder Leg 1',
          mode_icon: '🛺',
          from: 'Ashulia Bazar / Beribadh',
          to: 'Abdullahpur Bus Stand',
          buses: [
            { name: 'Ashulia Classic', name_bn: 'আশুলিয়া ক্লাসিক', route_code: 'ASH-01' }
          ],
          local_transports: ['Local Battery Auto-rickshaw', 'Shared CNG'],
          instructions: 'Take Ashulia Classic bus or shared auto-rickshaw from Ashulia via Dhour & Kamarpara to Abdullahpur.',
          est_time_min: 25,
          est_fare_bdt: 30
        },
        {
          step_num: 2,
          mode: 'transfer',
          mode_label: 'Transit Interchange',
          mode_icon: '🔄',
          hub_name: 'Abdullahpur Bus Stand',
          instructions: 'Cross over to the southern departure counter at Abdullahpur.',
          est_time_min: 4,
          est_fare_bdt: 0
        },
        {
          step_num: 3,
          mode: 'bus',
          mode_label: 'Bus Leg 2',
          mode_icon: '🚌',
          from: 'Abdullahpur',
          to: 'Badda Link Road / Uttar Badda',
          buses: [
            { name: 'Victor Classic', name_bn: 'ভিক্টর ক্লাসিক' },
            { name: 'Anabil Super', name_bn: 'অনাবিল সুপার' },
            { name: 'Turag Paribahan', name_bn: 'তুরাগ পরিবহন' }
          ],
          instructions: 'Board Victor Classic or Anabil Super heading south via Airport & Kuril to Badda.',
          est_time_min: 45,
          est_fare_bdt: 35
        }
      ]
    });

    itineraries.push({
      id: 'transfer-metro-rail',
      type: 'metro_multimodal',
      title: 'Metro Rail (MRT Line 6) + Local Transport Express',
      title_bn: 'মেট্রোরেল (এমআরটি লাইন ৬) + লোকাল অটো-রিকশা ফাস্ট রুট',
      tag: 'Fastest · Bypass Traffic Jams',
      recommended: false,
      total_est_time_min: 52,
      total_est_fare_bdt: 85,
      modes: ['bus', 'metro', 'auto_rickshaw'],
      summary: isForward
        ? 'Take Dewan, Winner, or Torongo to Farmgate, or Alif/Robrob/Akik to Mirpur-10. Ride Metro Rail to Uttara North, then catch a local auto-rickshaw to Ashulia via Dhour.'
        : 'Take auto-rickshaw from Ashulia to Uttara North Metro Station. Ride Metro Rail to Mirpur-10 or Farmgate, then take connecting bus to Badda.',
      legs: isForward ? [
        {
          step_num: 1,
          mode: 'bus_or_feeder',
          mode_label: 'Feeder to Metro Station',
          mode_icon: '🚌',
          from: 'Badda Link Road',
          to: 'Farmgate Metro Station OR Mirpur-10 Metro Station',
          buses: [
            { name: 'Dewan Paribahan', name_bn: 'দেওয়ান পরিবহন', dest: 'Farmgate' },
            { name: 'Winner Transport', name_bn: 'উইনার ট্রান্সপোর্ট', dest: 'Farmgate' },
            { name: 'Taranga Plus', name_bn: 'তরঙ্গ প্লাস', dest: 'Farmgate' },
            { name: 'Alif Paribahan', name_bn: 'আলিফ পরিবহন', dest: 'Mirpur 10' },
            { name: 'Robrob Paribahan', name_bn: 'রবরব পরিবহন', dest: 'Mirpur 10' },
            { name: 'Akik Paribahan', name_bn: 'আকিক পরিবহন', dest: 'Mirpur 1 / Farmgate' }
          ],
          local_transports: ['Rickshaw via Hatirjheel to Karwan Bazar / Farmgate', 'Shared CNG to Mirpur 10'],
          instructions: 'Take Dewan, Winner, or Taranga Plus from Badda Link Road to Farmgate Metro Station, OR take Alif, Robrob, or Akik to Mirpur-10 Metro Station.',
          est_time_min: 22,
          est_fare_bdt: 20
        },
        {
          step_num: 2,
          mode: 'metro',
          mode_label: 'Dhaka Metro Rail (MRT Line 6)',
          mode_icon: '🚇',
          from: 'Farmgate / Mirpur-10 Metro Station',
          to: 'Uttara North Metro Station (Diabari)',
          metro_line: 'MRT Line 6 (High Speed Elevated Rapid Transit)',
          instructions: 'Board the Dhaka Metro Rail train heading north towards Uttara North (Diabari). Enjoy air-conditioned ride and bypass 100% of road congestion.',
          est_time_min: 18,
          est_fare_bdt: 45
        },
        {
          step_num: 3,
          mode: 'auto_rickshaw',
          mode_label: 'Last-Mile Local Transport',
          mode_icon: '🛺',
          from: 'Uttara North Metro Station (Diabari)',
          to: 'Ashulia Bazar / Ashulia Beribadh',
          local_transports: ['Local Battery Auto-rickshaw (Easy-bike)', 'Shared CNG', 'Local Tempo to Dhour'],
          instructions: 'Exit Uttara North station and catch a local battery auto-rickshaw or shared CNG heading to Abdullahpur or Dhour to reach Ashulia directly or board an Ashulia bus.',
          est_time_min: 12,
          est_fare_bdt: 20
        }
      ] : [
        {
          step_num: 1,
          mode: 'auto_rickshaw',
          mode_label: 'Feeder to Metro Station',
          mode_icon: '🛺',
          from: 'Ashulia Bazar',
          to: 'Uttara North Metro Station (Diabari)',
          local_transports: ['Battery Auto-rickshaw to Diabari', 'Shared CNG via Dhour'],
          instructions: 'Take a local auto-rickshaw or CNG from Ashulia through Dhour/Beribadh to Uttara North Metro Station.',
          est_time_min: 15,
          est_fare_bdt: 25
        },
        {
          step_num: 2,
          mode: 'metro',
          mode_label: 'Dhaka Metro Rail (MRT Line 6)',
          mode_icon: '🚇',
          from: 'Uttara North Metro Station',
          to: 'Mirpur-10 OR Farmgate Metro Station',
          metro_line: 'MRT Line 6',
          instructions: 'Ride Metro Rail south to Mirpur-10 (12 min) or Farmgate (18 min).',
          est_time_min: 18,
          est_fare_bdt: 45
        },
        {
          step_num: 3,
          mode: 'bus',
          mode_label: 'Connecting Bus to Badda',
          mode_icon: '🚌',
          from: 'Mirpur-10 / Farmgate',
          to: 'Badda Link Road',
          buses: [
            { name: 'Alif Paribahan', name_bn: 'আলিফ পরিবহন' },
            { name: 'Robrob Paribahan', name_bn: 'রবরব পরিবহন' },
            { name: 'Winner Transport', name_bn: 'উইনার ট্রান্সপোর্ট' }
          ],
          instructions: 'Take Alif or Robrob from Mirpur-10, or Winner/Dewan from Farmgate directly to Badda Link Road.',
          est_time_min: 22,
          est_fare_bdt: 20
        }
      ]
    });

    return itineraries;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GENERAL DYNAMIC MULTI-MODAL TRANSFER PLANNER (Guaranteed Specific Bus Names)
  // ───────────────────────────────────────────────────────────────────────────
  const MAJOR_HUBS = [
    { name: 'Abdullahpur', aliases: ['abdullahpur', 'house building'] },
    { name: 'Mirpur 10', aliases: ['mirpur 10', 'mirpur-10'] },
    { name: 'Farmgate', aliases: ['farmgate'] },
    { name: 'Gabtoli', aliases: ['gabtoli'] },
    { name: 'Mohakhali', aliases: ['mohakhali'] },
    { name: 'Kuril Bishwa Road', aliases: ['kuril', 'kuril bishwa road'] },
    { name: 'Shahbagh', aliases: ['shahbagh'] },
    { name: 'Motijheel', aliases: ['motijheel'] },
    { name: 'Sayedabad', aliases: ['sayedabad'] }
  ];

  for (const hub of MAJOR_HUBS) {
    if (fLow.includes(hub.name.toLowerCase()) || tLow.includes(hub.name.toLowerCase())) continue;

    const leg1Buses = getBusesConnecting(from, hub.name);
    const leg2Buses = getBusesConnecting(hub.name, to);

    if (leg1Buses.length > 0 && leg2Buses.length > 0) {
      const uniqueLeg1 = leg1Buses.slice(0, 4);
      const uniqueLeg2 = leg2Buses.slice(0, 4);

      itineraries.push({
        id: `transfer-hub-${hub.name.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'two_bus_transfer',
        title: `Two-Bus Transfer via ${hub.name}`,
        title_bn: `${hub.name} হয়ে ২-বাস কানেক্টিং রুট`,
        tag: `Connecting via ${hub.name}`,
        recommended: itineraries.length === 0,
        total_est_time_min: 65,
        total_est_fare_bdt: 60,
        modes: ['bus', 'bus'],
        summary: `Take ${uniqueLeg1.map(b => b.name).join(', ')} from ${from} to ${hub.name}, then board ${uniqueLeg2.map(b => b.name).join(', ')} to ${to}.`,
        legs: [
          {
            step_num: 1,
            mode: 'bus',
            mode_label: `Bus Leg 1 (${from} → ${hub.name})`,
            mode_icon: '🚌',
            from: from,
            to: hub.name,
            buses: uniqueLeg1,
            instructions: `Board ${uniqueLeg1.map(b => `${b.name} (${b.name_bn || b.name})`).join(' or ')} from ${from} to ${hub.name}.`,
            est_time_min: 35,
            est_fare_bdt: 30
          },
          {
            step_num: 2,
            mode: 'transfer',
            mode_label: 'Interchange Hub',
            mode_icon: '🔄',
            hub_name: `${hub.name} Bus Stand`,
            instructions: `Alight at ${hub.name} bus stoppage. Cross over or walk 1-2 minutes to the onward counter heading towards ${to}.`,
            est_time_min: 4,
            est_fare_bdt: 0
          },
          {
            step_num: 3,
            mode: 'bus',
            mode_label: `Bus Leg 2 (${hub.name} → ${to})`,
            mode_icon: '🚌',
            from: hub.name,
            to: to,
            buses: uniqueLeg2,
            instructions: `Board ${uniqueLeg2.map(b => `${b.name} (${b.name_bn || b.name})`).join(' or ')} from ${hub.name} directly to ${to}.`,
            est_time_min: 26,
            est_fare_bdt: 30
          }
        ]
      });

      if (hub.name === 'Mirpur 10' && (tLow.includes('abdullahpur') || tLow.includes('uttara') || tLow.includes('airport') || fLow.includes('aminbazar') || fLow.includes('gabtoli'))) {
        itineraries.push({
          id: 'transfer-metro-mrt6',
          type: 'metro_multimodal',
          title: 'Metro Rail (MRT Line 6) + Feeder Express',
          title_bn: 'মেট্রোরেল (এমআরটি লাইন ৬) + ফিডার এক্সপ্রেস',
          tag: 'Fastest · Bypass 100% Traffic',
          recommended: false,
          total_est_time_min: 52,
          total_est_fare_bdt: 85,
          modes: ['bus', 'metro', 'auto_rickshaw'],
          summary: `Take 1st Bus from ${from} to Mirpur 10, ride Dhaka Metro Rail (MRT-6) to Uttara North (Diabari), then take local CNG or auto-rickshaw to ${to}.`,
          legs: [
            {
              step_num: 1,
              mode: 'bus',
              mode_label: `1st Bus (${from} → Mirpur 10)`,
              mode_icon: '🚌',
              from: from,
              to: 'Mirpur 10',
              buses: uniqueLeg1,
              instructions: `Board ${uniqueLeg1.map(b => `${b.name} (${b.name_bn || b.name})`).join(' or ')} from ${from} to Mirpur 10.`,
              est_time_min: 30,
              est_fare_bdt: 30
            },
            {
              step_num: 2,
              mode: 'metro',
              mode_label: 'Dhaka Metro Rail (MRT Line 6)',
              mode_icon: '🚇',
              from: 'Mirpur 10 Metro Station',
              to: 'Uttara North Metro Station (Diabari)',
              instructions: 'Board elevated Metro Rail train north to Uttara North (Diabari). 100% traffic-jam free air-conditioned ride.',
              est_time_min: 12,
              est_fare_bdt: 40
            },
            {
              step_num: 3,
              mode: 'auto_rickshaw',
              mode_label: `Local CNG / Rickshaw to ${to}`,
              mode_icon: '🛺',
              from: 'Uttara North Metro Station (Diabari)',
              to: to,
              local_transports: ['Local CNG Auto-rickshaw', 'Battery Auto-rickshaw (Easy-bike)', 'Cycle-Rickshaw'],
              instructions: `Exit Uttara North station and take a local CNG or auto-rickshaw directly to ${to}.`,
              est_time_min: 10,
              est_fare_bdt: 15
            }
          ]
        });
      }

      if (itineraries.length >= 3) break;
    }
  }

  // If no pure two-bus route matched, construct a real connecting route with authentic feeder and highway buses
  if (itineraries.length === 0) {
    // Pick the most logical hub based on destination or origin
    let bestHub = 'Abdullahpur';
    if (tLow.includes('airport') || tLow.includes('uttara') || tLow.includes('gazipur') || tLow.includes('ashulia') || tLow.includes('tongi') || tLow.includes('diabari') || tLow.includes('daffodil') || tLow.includes('khagan') || tLow.includes('baipail')) {
      bestHub = 'Abdullahpur';
    } else if (tLow.includes('motijheel') || tLow.includes('gulistan') || tLow.includes('sayedabad') || tLow.includes('paltan') || tLow.includes('shahbagh') || tLow.includes('dhaka university')) {
      bestHub = 'Farmgate';
    } else if (tLow.includes('mirpur') || tLow.includes('savar') || tLow.includes('gabtoli') || tLow.includes('aminbazar') || tLow.includes('hemayetpur')) {
      bestHub = 'Mirpur 10';
    } else if (tLow.includes('badda') || tLow.includes('rampura') || tLow.includes('kuril') || tLow.includes('notun bazar')) {
      bestHub = 'Kuril';
    } else {
      bestHub = fLow.includes('uttara') || fLow.includes('airport') ? 'Abdullahpur' : 'Mohakhali';
    }

    const hubDefaultBuses = {
      'Abdullahpur': [
        { name: 'Victor Classic', name_bn: 'ভিক্টর ক্লাসিক', route_code: 'VCT-01' },
        { name: 'Anabil Super', name_bn: 'অনাবিল সুপার', route_code: 'ANB-01' },
        { name: 'Raida Enterprise', name_bn: 'রাইদা এন্টারপ্রাইজ', route_code: 'RDA-01' },
        { name: 'Turag Paribahan', name_bn: 'তুরাগ পরিবহন', route_code: 'TRG-01' }
      ],
      'Farmgate': [
        { name: 'Dewan Paribahan', name_bn: 'দেওয়ান পরিবহন', route_code: 'DWN-01' },
        { name: 'Winner Transport', name_bn: 'উইনার ট্রান্সপোর্ট', route_code: 'WNR-01' },
        { name: 'Taranga Plus', name_bn: 'তরঙ্গ প্লাস', route_code: 'TRG-02' },
        { name: 'Shikor Paribahan', name_bn: 'শিকর পরিবহন', route_code: 'SKR-01' }
      ],
      'Mirpur 10': [
        { name: 'Alif Paribahan', name_bn: 'আলিফ পরিবহন', route_code: 'ALF-01' },
        { name: 'Robrob Paribahan', name_bn: 'রবরব পরিবহন', route_code: 'RBR-01' },
        { name: 'Bihongo Paribahan', name_bn: 'বিহঙ্গ পরিবহন', route_code: 'BHG-01' },
        { name: 'Projapoti Paribahan', name_bn: 'প্রজাপতি পরিবহন', route_code: 'PRJ-01' }
      ],
      'Gabtoli': [
        { name: 'Rajdhani Paribahan', name_bn: 'রাজধানী পরিবহন', route_code: 'RJD-01' },
        { name: 'Itihas Paribahan', name_bn: 'ইতিহাস পরিবহন', route_code: 'ITH-01' },
        { name: 'Baishakhi Paribahan', name_bn: 'বৈশাখী পরিবহন', route_code: 'BSK-01' }
      ],
      'Mohakhali': [
        { name: 'Victor Classic', name_bn: 'ভিক্টর ক্লাসিক', route_code: 'VCT-01' },
        { name: 'Balaka Paribahan', name_bn: 'বলাকা পরিবহন', route_code: 'BLK-01' },
        { name: 'Anabil Super', name_bn: 'অনাবিল সুপার', route_code: 'ANB-01' },
        { name: 'Raida Enterprise', name_bn: 'রাইদা এন্টারপ্রাইজ', route_code: 'RDA-01' }
      ]
    };

    const onwardBuses = getBusesConnecting(bestHub, to);
    const resolvedOnward = onwardBuses.length > 0 ? onwardBuses : (hubDefaultBuses[bestHub] || hubDefaultBuses['Abdullahpur']);

    itineraries.push({
      id: 'transfer-feeder-highway-route',
      type: 'feeder_bus_transfer',
      title: `Shared Feeder to ${bestHub} → Direct Bus to ${to}`,
      title_bn: `${bestHub} ট্রানজিট হাব হয়ে সরাসরি কানেক্টিং বাস`,
      tag: 'Recommended Feeder + Highway Bus',
      recommended: true,
      total_est_time_min: 55,
      total_est_fare_bdt: 55,
      modes: ['shared_bus', 'bus'],
      summary: `Take local shared auto-rickshaw or Leguna from ${from} to ${bestHub}, then board ${resolvedOnward.map(b => b.name).join(', ')} directly to ${to}.`,
      legs: [
        {
          step_num: 1,
          mode: 'shared_bus',
          mode_label: `Feeder Leg 1 (${from} → ${bestHub})`,
          mode_icon: '🚐',
          from: from,
          to: `${bestHub} Bus Stand`,
          shared_transit_services: [
            { name: `${from}-${bestHub} Shared Auto / Leguna`, name_bn: `${from}-${bestHub} শেয়ার্ড লেগুনা ও অটো` }
          ],
          local_transports: ['Local Shared Leguna / Human Hauler', 'Battery Auto-rickshaw (Easy-bike)', 'Shared CNG'],
          instructions: `Take a local shared Leguna, battery auto-rickshaw, or shared CNG from ${from} directly to ${bestHub} Bus Stand.`,
          est_time_min: 25,
          est_fare_bdt: 25
        },
        {
          step_num: 2,
          mode: 'transfer',
          mode_label: 'Interchange Hub',
          mode_icon: '🔄',
          hub_name: `${bestHub} Bus Stand`,
          instructions: `Get down at ${bestHub}. Walk 1-2 minutes to the onward departure counter heading towards ${to}.`,
          est_time_min: 3,
          est_fare_bdt: 0
        },
        {
          step_num: 3,
          mode: 'bus',
          mode_label: `Highway Bus Leg 2 (${bestHub} → ${to})`,
          mode_icon: '🚌',
          from: bestHub,
          to: to,
          buses: resolvedOnward.slice(0, 4),
          instructions: `Board ${resolvedOnward.slice(0, 4).map(b => `${b.name} (${b.name_bn || b.name})`).join(' or ')} from ${bestHub} directly to ${to}.`,
          est_time_min: 27,
          est_fare_bdt: 30
        }
      ]
    });
  }

  return itineraries;
}

export const MRT_LINE_6_STATIONS_DATA = [
  { index: 0, name: 'Uttara North (Diabari)', name_bn: 'উত্তরা উত্তর (দিয়াবাড়ী)', shortName: 'Uttara North', aliases: ['uttara north', 'diabari', 'diyabari', 'uttara sector 18', 'sector 18', 'uttara diabari', 'uttara'], coords: [23.8780, 90.3720] },
  { index: 1, name: 'Uttara Center', name_bn: 'উত্তরা সেন্টার', shortName: 'Uttara Center', aliases: ['uttara center', 'uttara centre', 'uttara sector 17', 'uttara sector 16'], coords: [23.8650, 90.3700] },
  { index: 2, name: 'Uttara South', name_bn: 'উত্তরা দক্ষিণ', shortName: 'Uttara South', aliases: ['uttara south', 'uttara sector 15', 'uttara sector 14', 'uttara 3rd phase'], coords: [23.8500, 90.3680] },
  { index: 3, name: 'Pallabi', name_bn: 'পল্লবী', shortName: 'Pallabi', aliases: ['pallabi', 'mirpur 12', 'mirpur-12', 'purobi', 'mirpur ceramic'], coords: [23.8250, 90.3640] },
  { index: 4, name: 'Mirpur 11', name_bn: 'মিরপুর ১১', shortName: 'Mirpur 11', aliases: ['mirpur 11', 'mirpur-11'], coords: [23.8180, 90.3660] },
  { index: 5, name: 'Mirpur 10', name_bn: 'মিরপুর ১০', shortName: 'Mirpur 10', aliases: ['mirpur 10', 'mirpur-10', 'mirpur 10 golchottor', 'mirpur 10 circle', 'mirpur 1', 'mirpur 2', 'senpara'], coords: [23.8069, 90.3687] },
  { index: 6, name: 'Kazipara', name_bn: 'কাজীপাড়া', shortName: 'Kazipara', aliases: ['kazipara', 'kazi para', 'west kazipara'], coords: [23.7980, 90.3710] },
  { index: 7, name: 'Shewrapara', name_bn: 'শেওড়াপাড়া', shortName: 'Shewrapara', aliases: ['shewrapara', 'sheorapara', 'west shewrapara'], coords: [23.7910, 90.3730] },
  { index: 8, name: 'Agargaon', name_bn: 'আগারগাঁও', shortName: 'Agargaon', aliases: ['agargaon', 'idb', 'parjatan bhaban', 'passport office', 'sher-e-bangla nagar'], coords: [23.7780, 90.3800] },
  { index: 9, name: 'Bijoy Sarani', name_bn: 'বিজয় সরণি', shortName: 'Bijoy Sarani', aliases: ['bijoy sarani', 'bijoy shoroni', 'military museum', 'rangs bhaban', 'jahangir gate'], coords: [23.7680, 90.3880] },
  { index: 10, name: 'Farmgate', name_bn: 'ফার্মগেট', shortName: 'Farmgate', aliases: ['farmgate', 'farm gate', 'khamarbari', 'ananda cinema', 'green road', 'tejgaon'], coords: [23.7570, 90.3888] },
  { index: 11, name: 'Karwan Bazar', name_bn: 'কারওয়ান বাজার', shortName: 'Karwan Bazar', aliases: ['karwan bazar', 'kawran bazar', 'panthapath', 'bashundhara city', 'banglamotor'], coords: [23.7516, 90.3934] },
  { index: 12, name: 'Shahbagh', name_bn: 'শাহবাগ', shortName: 'Shahbagh', aliases: ['shahbagh', 'shahbag', 'bsmmu', 'pg hospital', 'national museum', 'kataban', 'science lab'], coords: [23.7383, 90.3957] },
  { index: 13, name: 'Dhaka University', name_bn: 'ঢাকা বিশ্ববিদ্যালয়', shortName: 'Dhaka University', aliases: ['dhaka university', 'du', 'tsc', 'curzon hall', 'doel chattar', 'nilkhet'], coords: [23.7320, 90.3960] },
  { index: 14, name: 'Bangladesh Secretariat', name_bn: 'বাংলাদেশ সচিবালয়', shortName: 'Secretariat', aliases: ['secretariat', 'bangladesh secretariat', 'press club', 'high court', 'paltan', 'purana paltan'], coords: [23.7290, 90.4080] },
  { index: 15, name: 'Motijheel', name_bn: 'মতিঝিল', shortName: 'Motijheel', aliases: ['motijheel', 'motijheel c/a', 'dilkusha', 'shapla chattar', 'baitul mukarram', 'gulistan', 'gulisthan'], coords: [23.7330, 90.4172] }
];

export function checkMetroDirectRoute(from, to) {
  if (!from || !to) return null;
  const fLow = from.toLowerCase().trim();
  const tLow = to.toLowerCase().trim();

  let startSt = null;
  let endSt = null;

  for (const st of MRT_LINE_6_STATIONS_DATA) {
    if (!startSt && (st.aliases.some(a => fLow === a || fLow.includes(a) || a.includes(fLow)))) {
      startSt = st;
    }
    if (!endSt && (st.aliases.some(a => tLow === a || tLow.includes(a) || a.includes(tLow)))) {
      endSt = st;
    }
  }

  // Common area matches
  if (!startSt) {
    if (fLow.includes('mirpur 10') || fLow.includes('mirpur 1') || fLow.includes('mirpur 2')) startSt = MRT_LINE_6_STATIONS_DATA[5];
    else if (fLow.includes('mirpur 11')) startSt = MRT_LINE_6_STATIONS_DATA[4];
    else if (fLow.includes('mirpur 12') || fLow.includes('pallabi')) startSt = MRT_LINE_6_STATIONS_DATA[3];
    else if (fLow.includes('uttara') || fLow.includes('diabari')) startSt = MRT_LINE_6_STATIONS_DATA[0];
    else if (fLow.includes('farmgate')) startSt = MRT_LINE_6_STATIONS_DATA[10];
    else if (fLow.includes('motijheel') || fLow.includes('gulistan') || fLow.includes('dilkusha')) startSt = MRT_LINE_6_STATIONS_DATA[15];
  }

  if (!endSt) {
    if (tLow.includes('motijheel') || tLow.includes('gulistan') || tLow.includes('dilkusha')) endSt = MRT_LINE_6_STATIONS_DATA[15];
    else if (tLow.includes('mirpur 10') || tLow.includes('mirpur 1') || tLow.includes('mirpur 2')) endSt = MRT_LINE_6_STATIONS_DATA[5];
    else if (tLow.includes('mirpur 11')) endSt = MRT_LINE_6_STATIONS_DATA[4];
    else if (tLow.includes('mirpur 12') || tLow.includes('pallabi')) endSt = MRT_LINE_6_STATIONS_DATA[3];
    else if (tLow.includes('uttara') || tLow.includes('diabari')) endSt = MRT_LINE_6_STATIONS_DATA[0];
    else if (tLow.includes('farmgate')) endSt = MRT_LINE_6_STATIONS_DATA[10];
  }

  if (startSt && endSt && startSt.index !== endSt.index) {
    const isForward = startSt.index < endSt.index;
    const minI = Math.min(startSt.index, endSt.index);
    const maxI = Math.max(startSt.index, endSt.index);
    const stationHops = maxI - minI;
    const stationsTraversed = isForward
      ? MRT_LINE_6_STATIONS_DATA.slice(minI, maxI + 1)
      : [...MRT_LINE_6_STATIONS_DATA.slice(minI, maxI + 1)].reverse();

    const travelTimeMin = Math.max(6, Math.round(stationHops * 2.3 + 2));
    const fareBdt = Math.min(100, Math.max(20, 20 + Math.round((stationHops - 1) * 3)));
    const busTimeMin = Math.round(travelTimeMin * 2.6 + 10);

    return {
      id: 'metro-mrt-6-direct',
      type: 'metro_multimodal',
      is_metro_direct: true,
      is_shortest_way: true,
      title: 'Dhaka Metro Rail (MRT Line 6)',
      title_bn: 'ঢাকা মেট্রোরেল (এমআরটি লাইন ৬)',
      tag: '⚡ Shortest & Fastest Route · 100% Jam-Free',
      recommended: true,
      total_est_time_min: travelTimeMin,
      total_est_fare_bdt: fareBdt,
      time_saved_min: Math.max(15, busTimeMin - travelTimeMin),
      road_bus_time_min: busTimeMin,
      frequency_min: 5,
      from_station: startSt.shortName,
      to_station: endSt.shortName,
      modes: ['walk', 'metro'],
      summary: `Take Dhaka Metro Rail (MRT-6) directly from ${startSt.shortName} to ${endSt.shortName}. Travel time is only ~${travelTimeMin} minutes (saves ${busTimeMin - travelTimeMin} mins over road buses in traffic)! 100% traffic-jam free air-conditioned ride.`,
      stations_count: stationsTraversed.length,
      station_names: stationsTraversed.map(s => s.shortName),
      legs: [
        {
          step_num: 1,
          mode: 'walk',
          mode_label: 'Walk to Station',
          mode_icon: '🚶',
          from: from,
          to: `${startSt.shortName} Metro Station`,
          instructions: `Walk ~2-4 minutes from ${from} to ${startSt.shortName} Metro Station concourse.`,
          est_time_min: 3,
          est_fare_bdt: 0
        },
        {
          step_num: 2,
          mode: 'metro',
          mode_label: 'Dhaka Metro Rail (MRT Line 6)',
          mode_icon: '🚇',
          from: `${startSt.shortName} Metro Station`,
          to: `${endSt.shortName} Metro Station`,
          metro_line: 'MRT Line 6 (Elevated High-Speed Electric Train)',
          stations: stationsTraversed.map(s => s.name),
          instructions: `Board the elevated Metro Rail train heading to ${endSt.shortName}. Rapid, smooth air-conditioned transit with trains every 5-8 minutes.`,
          est_time_min: travelTimeMin,
          est_fare_bdt: fareBdt
        }
      ]
    };
  }
  return null;
}

/**
 * Finds all authentic direct buses and Metro Rail options between two points in Greater Dhaka.
 * Always detects and highlights the shortest way path.
 */
export function findBusesBetween(from, to) {
  if (!from || !to) {
    return {
      available: false,
      count: 0,
      buses: [],
      transfer_routes: [],
      message: 'Please provide both origin and destination points.'
    };
  }

  const list = loadBusData();
  const directMatches = [];

  for (const b of list) {
    const stoppages = b.stoppages || [];
    const fIdx = findStopIndexInRoute(stoppages, from);
    const tIdx = findStopIndexInRoute(stoppages, to);

    if (fIdx !== -1 && tIdx !== -1 && fIdx !== tIdx) {
      const isForward = fIdx < tIdx;
      const startIdx = Math.min(fIdx, tIdx);
      const endIdx = Math.max(fIdx, tIdx);

      const stopsTraversed = isForward
        ? stoppages.slice(startIdx, endIdx + 1)
        : [...stoppages.slice(startIdx, endIdx + 1)].reverse();

      const numStops = stopsTraversed.length;
      const estFare = Math.min(b.fare_max_bdt || 45, Math.max(b.fare_min_bdt || 15, Math.round(15 + (numStops - 1) * 3.5)));

      let priorityScore = 100;
      const origLower = (b.origin || '').toLowerCase();
      const destLower = (b.destination || '').toLowerCase();
      const fromLower = from.toLowerCase();
      const toLower = to.toLowerCase();

      if (origLower.includes(fromLower) || destLower.includes(fromLower)) priorityScore += 30;
      if (origLower.includes(toLower) || destLower.includes(toLower)) priorityScore += 30;
      if (b.id === 'rajdhani_paribahan' || b.id === 'itihas_paribahan') priorityScore += 25;

      directMatches.push({
        id: b.id,
        name: b.name,
        name_bn: b.name_bn || b.name,
        route_code: b.route_code,
        type: b.type || 'Semi-Seating',
        origin: b.origin,
        destination: b.destination,
        from_stop: stoppages[fIdx],
        to_stop: stoppages[tIdx],
        direction: isForward ? 'Forward' : 'Return',
        total_route_stops: stoppages.length,
        stops_on_journey: numStops,
        journey_stoppages: stopsTraversed,
        fare_bdt: estFare,
        fare_range_bdt: `${b.fare_min_bdt || 15} - ${b.fare_max_bdt || 45}`,
        frequency_min: b.frequency_min || 7,
        operating_hours: `${b.first_bus || '06:00 AM'} - ${b.last_bus || '10:30 PM'}`,
        operator: b.operator || 'Dhaka Road Transport Operator',
        corridors_covered: b.corridors_covered || [],
        priorityScore
      });
    }
  }

  directMatches.sort((a, b) => b.priorityScore - a.priorityScore || a.stops_on_journey - b.stops_on_journey);

  // Check if Dhaka Metro Rail (MRT Line 6) is available
  const metroDirect = checkMetroDirectRoute(from, to);

  // Build direct road bus itinerary for map comparison
  let directBusItinerary = null;
  if (directMatches.length > 0) {
    const topBus = directMatches[0];
    const busTime = topBus.stops_on_journey ? Math.round(topBus.stops_on_journey * 3.6 + 12) : 55;
    directBusItinerary = {
      id: 'direct-road-bus',
      type: 'direct_bus',
      title: `Direct Road Bus (${directMatches.slice(0, 3).map(b => b.name).join(', ')})`,
      title_bn: `সরাসরি বাস (${directMatches.slice(0, 2).map(b => b.name_bn || b.name).join(', ')})`,
      tag: 'Regular Road Bus Service',
      recommended: !metroDirect,
      total_est_time_min: busTime,
      total_est_fare_bdt: topBus.fare_bdt || 35,
      modes: ['walk', 'bus'],
      summary: `Board ${directMatches.slice(0, 3).map(b => b.name).join(' or ')} directly from ${from} to ${to}. Est. travel time ~${busTime} mins.`,
      buses: directMatches,
      legs: [
        {
          step_num: 1,
          mode: 'walk',
          mode_label: 'Walk to Bus Stoppage',
          mode_icon: '🚶',
          from: from,
          to: `${directMatches[0]?.from_stop || from} Bus Stop`,
          instructions: `Walk 2-3 mins to ${directMatches[0]?.from_stop || from} bus counter.`,
          est_time_min: 3,
          est_fare_bdt: 0
        },
        {
          step_num: 2,
          mode: 'bus',
          mode_label: `Direct Bus (${from} → ${to})`,
          mode_icon: '🚌',
          from: from,
          to: to,
          buses: directMatches,
          instructions: `Board ${directMatches.slice(0, 4).map(b => `${b.name} (${b.name_bn || b.name})`).join(' or ')} directly to ${to}.`,
          est_time_min: busTime,
          est_fare_bdt: topBus.fare_bdt || 35
        }
      ]
    };
  }

  // ── Scenario A: Direct Metro Available (Shortest Way Path) ──
  if (metroDirect) {
    const itineraries = [metroDirect];
    if (directBusItinerary) {
      itineraries.push(directBusItinerary);
    }

    return {
      available: true,
      has_direct_bus: directMatches.length > 0,
      metro_available: true,
      metro_suggestion: metroDirect,
      shortest_way: {
        mode: 'metro',
        title: metroDirect.title,
        title_bn: metroDirect.title_bn,
        est_time_min: metroDirect.total_est_time_min,
        fare_bdt: metroDirect.total_est_fare_bdt,
        time_saved_min: metroDirect.time_saved_min,
        reason: 'Dhaka Metro Rail (MRT-6) is the shortest and fastest way path. Bypasses 100% traffic congestion.'
      },
      count: directMatches.length,
      from,
      to,
      buses: directMatches,
      transfer_routes: itineraries,
      message: `⚡ Shortest Way: Dhaka Metro Rail (MRT Line 6) is available! Travel in ~${metroDirect.total_est_time_min} mins (saves ${metroDirect.time_saved_min} mins vs road buses).`
    };
  }

  // ── Scenario B: Direct Buses Found (No Direct Metro) ──
  if (directMatches.length > 0) {
    const transferRoutes = generateTransferRoutes(from, to, list);
    const combinedItineraries = [directBusItinerary];

    // If an alternative multimodal metro transfer exists, append it
    const metroTransfer = transferRoutes.find(r => r.type === 'metro_multimodal');
    if (metroTransfer) {
      combinedItineraries.push(metroTransfer);
    }

    const shortestRoute = (metroTransfer && metroTransfer.total_est_time_min < directBusItinerary.total_est_time_min)
      ? { mode: 'metro', title: metroTransfer.title, est_time_min: metroTransfer.total_est_time_min, fare_bdt: metroTransfer.total_est_fare_bdt, reason: 'Metro transfer is faster than direct bus in traffic.' }
      : { mode: 'bus', title: directBusItinerary.title, est_time_min: directBusItinerary.total_est_time_min, fare_bdt: directBusItinerary.total_est_fare_bdt, reason: 'Direct bus provides single-ride connection.' };

    return {
      available: true,
      has_direct_bus: true,
      metro_available: Boolean(metroTransfer),
      shortest_way: shortestRoute,
      count: directMatches.length,
      from,
      to,
      buses: directMatches,
      transfer_routes: combinedItineraries,
      message: `Found ${directMatches.length} authentic direct bus service${directMatches.length > 1 ? 's' : ''} connecting ${from} and ${to}.`
    };
  }

  // ── Scenario C: No Direct Bus -> Multi-modal Connecting Route ──
  const transferRoutes = generateTransferRoutes(from, to, list);
  const primaryTransfer = transferRoutes[0] || null;

  let shortestWay = null;
  if (transferRoutes.length > 0) {
    const sorted = [...transferRoutes].sort((a, b) => a.total_est_time_min - b.total_est_time_min);
    shortestWay = {
      mode: sorted[0].type === 'metro_multimodal' ? 'metro' : 'bus',
      title: sorted[0].title,
      est_time_min: sorted[0].total_est_time_min,
      fare_bdt: sorted[0].total_est_fare_bdt,
      reason: 'Shortest connecting transit route.'
    };
  }

  let hubSuggestion = 'Abdullahpur, Gabtoli Terminal, or Farmgate';
  const fLow = from.toLowerCase();

  if (fLow.includes('khagan') || fLow.includes('birulia') || fLow.includes('diu')) {
    hubSuggestion = 'Abdullahpur (via Birulia/Dhour Shared Leguna) or Diabari Metro (MRT-6)';
  } else if (fLow.includes('badda')) {
    hubSuggestion = 'Abdullahpur (via Victor Classic) or Farmgate/Mirpur-10 (via Metro Rail)';
  } else if (fLow.includes('savar') || fLow.includes('chandra') || fLow.includes('ashulia')) {
    hubSuggestion = 'Gabtoli Terminal, Mirpur 10, or Uttara North';
  } else if (fLow.includes('uttara') || fLow.includes('gazipur') || fLow.includes('tongi')) {
    hubSuggestion = 'Airport, Mohakhali, or Diabari Metro';
  } else if (fLow.includes('sayedabad') || fLow.includes('jatrabari') || fLow.includes('motijheel')) {
    hubSuggestion = 'Gulistan, Motijheel Metro, or Farmgate';
  }

  return {
    available: false,
    has_direct_bus: false,
    metro_available: transferRoutes.some(r => r.type === 'metro_multimodal'),
    shortest_way: shortestWay,
    count: 0,
    from,
    to,
    buses: [],
    transfer_routes: transferRoutes,
    message: `No direct bus is available for this route (${from} → ${to}).`,
    transfer_suggestion: {
      interchange_hub: hubSuggestion,
      guidance: primaryTransfer
        ? primaryTransfer.summary
        : `Take a direct feeder bus or local transit to ${hubSuggestion}, then interchange to a connecting service heading towards ${to}.`
    }
  };
}

export function getAllBuses(query = {}) {
  const list = loadBusData();
  const { search, corridor, from, to } = query;

  if (from && to) {
    const res = findBusesBetween(from, to);
    return res.buses;
  }

  return list.filter(b => {
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = b.name.toLowerCase().includes(q) || (b.name_bn && b.name_bn.includes(q));
      const matchCode = (b.route_code || '').toLowerCase().includes(q);
      const matchEndpoints = b.origin.toLowerCase().includes(q) || b.destination.toLowerCase().includes(q);
      const matchStoppage = (b.stoppages || []).some(s => s.toLowerCase().includes(q));
      if (!matchName && !matchCode && !matchEndpoints && !matchStoppage) return false;
    }

    if (corridor && corridor.trim()) {
      const cUpper = corridor.toUpperCase().trim();
      const hasCorridor = (b.corridors_covered || []).includes(cUpper);
      if (!hasCorridor) return false;
    }

    return true;
  });
}

export function getBusById(id) {
  const list = loadBusData();
  const found = list.find(b => b.id.toLowerCase() === id.toLowerCase() || (b.route_code || '').toLowerCase() === id.toLowerCase());
  if (found) return found;

  const indPath = path.join(ROUTES_DIR, `${id}.json`);
  if (fs.existsSync(indPath)) {
    try {
      return JSON.parse(fs.readFileSync(indPath, 'utf-8'));
    } catch (_) {}
  }
  return null;
}

export function getBusStops() {
  return loadBusStops();
}

# 🚦 TrafficPulse — Dhaka Traffic Prediction & Congestion Bypass System

<div align="center">

[![Live Web Application](https://img.shields.io/badge/Live_Demo-Firebase_Hosting-0284c7?style=for-the-badge&logo=firebase&logoColor=white)](https://trafficpulse-dhaka.web.app)
[![API Server Status](https://img.shields.io/badge/API_Server-Render_Cloud-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://traffic-prediction-q1yl.onrender.com)
[![React 19](https://img.shields.io/badge/React_19-Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Leaflet](https://img.shields.io/badge/Maps-Leaflet_OSM-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)

An AI-powered intelligent transportation system and real-time traffic prediction platform designed specifically for Greater Dhaka. Combines **47,490+ authentic observations**, Google Maps Routes API v2, OpenWeatherMap telemetry, and OpenStreetMap road network geometries.

[**Explore Live Application »**](https://trafficpulse-dhaka.web.app) · [Report Bug](https://github.com/maRia-1506A/Traffic-Prediction/issues) · [Request Feature](https://github.com/maRia-1506A/Traffic-Prediction/issues)

</div>

---

## 🌐 Live Deployments

| Component | Platform | URL | Description |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | **Google Firebase Hosting** | **[trafficpulse-dhaka.web.app](https://trafficpulse-dhaka.web.app)** | Production React 19 SPA served via global CDN edge |
| **Mirror Domain** | **Google Firebase Hosting** | **[trafficpulse-dhaka.firebaseapp.com](https://trafficpulse-dhaka.firebaseapp.com)** | Secondary HTTPS domain |
| **Backend API Server** | **Render Cloud Container** | **[traffic-prediction-q1yl.onrender.com](https://traffic-prediction-q1yl.onrender.com)** | Node.js Express REST API, geometry cache & data analytics |

---

## 🌟 Key Capabilities & Features

### 1. 🎯 Journey Route Predictor & Congestion Forecast
* **Predictive Delay Modeling:** Select origin and destination across 128+ Dhaka junctions, specify commute time and date, and get instantaneous travel time, delay estimates, and congestion classification (`Normal`, `Moderate`, `Heavy`, `Severe`).
* **Bypass Advisor:** Recommends alternate flyovers and perimeter bypasses when major arterials (e.g., Mirpur Road, Airport Road, Kazi Nazrul Islam Ave) suffer from peak gridlock.
* **Multimodal Integration:** Recommends Dhaka Metro MRT Line 6 elevated train segments, local buses, CNG, and rickshaw transitions.

### 2. 🗺️ Interactive Explore Map (Curved OSM Telemetry)
* **Real-time Road Flows:** Displays all 50 official Dhaka corridors with authentic OpenStreetMap curved geometries.
* **Bottleneck Radar Rings:** Dynamic pulsing radar indicators identifying severe slowdown zones.
* **Velocity Triage Filters:** Filter corridors by flow velocity (`Fast Flow >25 km/h`, `Congested <22 km/h`, `Severe Jams <14 km/h`).
* **Interactive Measure Tool:** Click any two points on the map to calculate exact road-snapped travel distance, time, and routing.

### 3. 📊 Traffic Insights & Historical Analytics Dashboard
* **47,490+ Recorded Observations:** Ingests and analyzes real-world historical traffic data spanning August to November 2026.
* **24-Hour Diurnal Congestion Curve:** Visualizes hourly traffic intensity across Greater Dhaka.
* **Peak Rush Triage:** Ranks top congestion hours by volume, severity, and delay percentage.
* **Zero-Latency In-Memory Caching:** Fast, cached navigation between tabs with background live auto-sync.

### 4. 🚌 Authentic Dhaka Bus Route Directory (DTCA Verified)
* **Real-Time Stoppage Matching:** Find direct buses between any two stops across Greater Dhaka (e.g. *Savar → Mirpur 10*, *Gazipur → Sadarghat*).
* **Bus Network Explorer:** Complete database of 41+ authentic Dhaka bus operators (*Itihas*, *Bihanga*, *D-Link*, *Al-Makka*, etc.) with detailed stoppage sequences, fares, and operating schedules.

---

## 📁 Repository Structure

```
Traffic-Prediction/
├── frontend/                          # 🌐 React 19 + Vite Frontend Application
│   ├── src/
│   │   ├── components/                # UI Views & Interactive Map Components
│   │   │   ├── TrafficJourneyPredictor.jsx # Primary Day/Time route predictor
│   │   │   ├── ExploreMap.jsx         # Full interactive Dhaka OSM map with radar rings
│   │   │   ├── TrafficInsights.jsx    # Analytics dashboard (47,494 records)
│   │   │   ├── DhakaBusDirectory.jsx  # DTCA verified bus route finder
│   │   │   ├── JourneyRouteMap.jsx    # Leaflet topological journey viewer
│   │   │   ├── OSMTransitMap.jsx      # Road-snapping transit diagram
│   │   │   └── AboutPage.jsx          # Project documentation & team info
│   │   ├── utils/                     # Client-side BFS routing & fallback predictors
│   │   ├── api.js                     # Resilient API client with timeout protection
│   │   ├── App.jsx                    # Root view with navigation
│   │   └── main.jsx                   # Vite entry point
│   ├── vite.config.js                 # Vite + Tailwind CSS configuration
│   └── package.json                   # Frontend dependencies
│
├── server/                            # 🚀 Node.js Express API Backend
│   ├── index.js                       # Express server, route controllers & CORS
│   ├── trafficService.js              # A* road graph, corridor resolver & Bayesian analytics
│   ├── busService.js                  # 41+ Dhaka bus routes & transfer search engine
│   ├── routesConfig.js                # Coordinates for 128 Dhaka nodes & 50 official routes
│   └── osmRouter.js                   # OpenStreetMap graph topology extractor
│
├── data/                              # 📊 Datasets & Topologies
│   ├── traffic_data.csv               # 47,494+ authentic Dhaka traffic observations
│   ├── traffic_prediction_routes.csv  # 50 Official Monitored Dhaka Corridors (R01–R50)
│   ├── dhaka_roads.geojson            # OpenStreetMap Dhaka road topologies
│   └── bus/                           # Bus stoppage data & route definitions
│
├── data_collection/                   # 🐍 Python Automation & Scraper Pipeline
│   ├── collect_data.py                # Automated traffic poller (Google / Waze / OpenWeather)
│   ├── fetch_roads.py                 # Overpass OSM road topology extractor
│   ├── route_advisor.py               # CLI Route advisor
│   └── requirements.txt               # Python package dependencies
│
├── firebase.json                      # Firebase Hosting deployment configuration
├── .firebaserc                        # Firebase project binding
├── render.yaml                        # Render cloud deployment blueprint
├── .gitignore                         # Secret protection & build exclusions
└── package.json                       # Unified workspace runner scripts
```

---

## ⚡ Local Development Setup

### 1. Prerequisites
* **Node.js** v18+ installed
* **Python** 3.10+ (optional, only for the automated data collection pipeline)
* **Git**

### 2. Clone Repository
```bash
git clone https://github.com/maRia-1506A/Traffic-Prediction.git
cd Traffic-Prediction
```

### 3. Install Dependencies
```bash
# Install root & backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 4. Configure Environment Variables
Create a `.env` file in the project root:
```env
# Google Maps Routes API v2 (supports multi-key rotation separated by comma)
GOOGLE_MAPS_API_KEYS=YOUR_GOOGLE_MAPS_KEY_1,YOUR_GOOGLE_MAPS_KEY_2
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_KEY_1

# OpenWeatherMap API Key
OPENWEATHERMAP_API_KEY=YOUR_OPENWEATHER_KEY
```

### 5. Run the Full System
```bash
# Starts both Backend (Port 5000) and Frontend (Port 3000) concurrently
npm run dev:all
```
Open **`http://localhost:3000`** in your browser.

---

## 🚀 How Deployment Works

### Deploying Frontend to Firebase Hosting:
```bash
npm run build
firebase deploy --only hosting
```

### Deploying Backend to Render:
Render is configured with Continuous Deployment (CD). Simply push updates to the `main` branch:
```bash
git add .
git commit -m "update server"
git push origin main
```
Render automatically builds and spins up the updated container!

---

## 👥 Authors

Developed as an intelligent transportation system and predictive analytics project for Greater Dhaka:

| Author | GitHub |
| :--- | :--- |
| **Zannatul Farzana Maria** | [@maRia-1506A](https://github.com/maRia-1506A) |
| **K. M. Fathum Mubin** | [@mubin25s](https://github.com/mubin25s) |
| **Rakib Rohan** | [@Rakib255004](https://github.com/Rakib255004) |

---

## 📄 License
Copyright (c) 2026 Zannatul Farzana Maria, K. M. Fathum Mubin and Rakib Rohan. All rights reserved. Developed for academic and educational evaluation. See [LICENSE](LICENSE) for terms.

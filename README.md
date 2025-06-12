# 🌌 Multi-DB Satellite Insights

An advanced satellite tracking and visualization platform built using a containerized microservices architecture. Designed for real-time monitoring, mission analytics, orbital event tracking, and constellation exploration — all powered by **MongoDB**, **Neo4j**, and **Redis**.

---

## 🚀 Project Overview

**Multi-DB Satellite Insights** is a microservice-based web application developed as part of a Master’s in Computer Science (Advanced Databases) project. It showcases how multiple specialized databases can be integrated to deliver powerful, domain-specific insights for satellite operations and exploration.

---

## 🧩 Tech Stack

### Frontend
- **React.js** (1 container)

### Backend Microservices
| Microservice | Stack                  | Developer   |
|--------------|------------------------|-------------|
| MS1          | Java Spring Boot       | Pramukh     |
| MS2          | Python (FastAPI) / Node.js | Manu    |
| MS3          | Python                 | Sriram      |
| MS4          | Python       | Nik / Arnav |

### Databases (All containerized)
- 🛰️ **MongoDB** – Real-time telemetry & mission data
- 🧠 **Neo4j** – Satellite constellation and component graphs
- ⚡ **Redis** – Caching & pub/sub for alerts and fast filters

---

## 📚 Features (User Stories)

- **US1**: 🌍 Live Interactive Satellite Map  
  → Real-time tracking with hover tooltips showing metadata.

- **US2**: 🕒 Forecast Satellite Positions  
  → Estimated future satellite positions for observation planning.

- **US3**: 🔥 Orbital Congestion Heatmap & Alerts  
  → Visualize congestion zones + get satellite pass notifications (Redis + Open Notify).

- **US4**: 🚀 Mission Classification & Launch Timeline  
  → Filter by mission types and view global launch history and future events.

- **US5**: 🧾 Re-entry & Decay Tracker  
  → Track decaying satellites and monitor space debris risk.

- **US6**: 🕸️ Satellite Constellation Graph Explorer  
  → Explore satellite constellations grouped by type, manufacturer, etc. (Neo4j).

---

## 🐳 Dockerized Services

A `docker-compose.yml` is provided to run the full stack:
- React Frontend
- 4 Backend Microservices
- MongoDB, Redis, Neo4j (each in isolated containers)

### Run the project:
```bash
docker-compose up --build
```

## 📡 Data Sources
CelesTrak
Space-Track.org
Launch Library 2 API
Open Notify API

## 📂 Folder Structure
```bash
multi-db-satellite-insights/
├── frontend/           # React app
├── backend/
│   ├── ms1-java/       # Spring Boot service
│   ├── ms2-python/     # FastAPI or Node service
│   ├── ms3-node/       # Node.js service
│   └── ms4-python/     # Python/Node hybrid
├── docker-compose.yml
└── README.md
```

## 🧠 Learning Objectives
Demonstrate use of multiple specialized databases
Real-time and historical data processing
Graph data modeling with Neo4j
Caching & pub-sub with Redis
Container orchestration using Docker

## 👨‍💻 Authors
Arnav Kanade

Sriramkumar Raja Natarajan

Nikhil Chavan

Pramukh Prakash

Manu Janardhana

This project was built as a part of the Advanced Databases course in the MSc Computer Science program.


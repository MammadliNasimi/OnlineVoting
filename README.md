# 🗳️ Online Voting System - Blockchain Based

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)

A secure, transparent, verifiable, and anonymous online voting system prototype built with blockchain technology. Designed for university elections, club/representative voting, and small-to-medium scale institutional voting scenarios.

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Installation & Setup](#-installation--setup)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Screenshots](#-screenshots)
- [Future Enhancements](#-future-enhancements)
- [Contributing](#-contributing)
- [License](#-license)

## 🎯 Project Overview

This project is a **working skeleton** implementation of a blockchain-based voting system that provides:

✅ **Authenticated Voters** - Secure user registration and login  
✅ **Anonymous Voting** - Privacy-preserving vote casting  
✅ **Immutable Records** - Every vote is recorded on blockchain  
✅ **Duplicate Prevention** - Each user can vote only once per election  
✅ **Public Verification** - Anyone can verify vote integrity  
✅ **End-to-End Flow** - Complete UI → Backend → Blockchain → Database flow

### Use Cases

- 🎓 University elections
- 🏢 Corporate voting
- 👥 Club/organization representative selection
- 📊 Small-to-medium scale democratic processes

## ✨ Features

### Core Functionality

- **User Authentication**
  - JWT-based secure login/registration
  - Role-based access control (Admin/Voter)
  - Password hashing with bcrypt

- **Voting System**
  - Real-time candidate list updates
  - Vote submission with validation
  - Duplicate vote prevention
  - Session management

- **Admin Dashboard**
  - Add/remove candidates
  - Set voting periods (start/end time)
  - View real-time results
  - Clear voting data

- **Results & Analytics**
  - Bar chart visualization
  - Pie chart representation
  - Vote history tracking
  - Feedback system

- **Modern UI/UX**
  - Gradient design with animations
  - Glass-morphism effects
  - Responsive mobile design
  - Smooth transitions and hover effects
  - Multi-language support (TR/EN)

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  • Modern UI with gradient design                           │
│  • Chart.js for data visualization                          │
│  • Axios for API communication                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Node.js/Express)                  │
│  • RESTful API architecture                                 │
│  • JWT authentication                                       │
│  • Session management                                       │
│  • Blockchain communication layer                           │
└────────┬────────────────────────────────┬───────────────────┘
         │                                │
         ▼                                ▼
┌────────────────────┐         ┌──────────────────────────────┐
│  PostgreSQL DB     │         │  Blockchain Layer (Ethereum) │
│  • Users           │         │  • Smart Contracts (Solidity)│
│  • Elections       │         │  • Testnet (Sepolia/Ganache) │
│  • Vote Status     │         │  • Immutable vote records    │
└────────────────────┘         └──────────────────────────────┘
```

## 🛠️ Technology Stack

### Frontend
- **React.js** 18.x - UI framework
- **Chart.js** - Data visualization
- **Axios** - HTTP client
- **Day.js** - Date handling
- **Modern CSS** - Gradient & animations

### Backend
- **Node.js** 18.x - Runtime environment
- **Express.js** - Web framework
- **bcrypt.js** - Password hashing
- **CORS** - Cross-origin resource sharing

### Blockchain (Future Integration)
- **Ethereum Testnet** - Sepolia/Hardhat/Ganache
- **Solidity** - Smart contracts
- **Web3.js/Ethers.js** - Blockchain interaction

### Database
- **PostgreSQL** - Relational database (Future)
- **In-Memory Storage** - Current demo mode
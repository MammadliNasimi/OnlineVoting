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

## 📁 Project Structure

```
OnlineVoting/
│
├── client/                      # Frontend React application
│   ├── public/
│   │   └── index.html          # HTML template
│   ├── src/
│   │   ├── App.js              # Main application component
│   │   ├── App.css             # Modern gradient styles
│   │   ├── index.js            # Entry point
│   │   └── index.css           # Global styles with animations
│   └── package.json            # Frontend dependencies
│
├── routes/
│   └── votes.js                # Vote-related routes
│
├── server.js                   # Backend Express server
├── package.json                # Backend dependencies
├── .gitignore                  # Git ignore rules
└── README.md                   # This file
```

## 🚀 Installation & Setup

### Prerequisites

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** - Package manager
- **Git** - Version control

### Step 1: Clone the Repository

```bash
git clone https://github.com/MammadliNasimi/OnlineVoting.git
cd OnlineVoting
```

### Step 2: Install Backend Dependencies

```bash
npm install
```

### Step 3: Install Frontend Dependencies

```bash
cd client
npm install
cd ..
```

### Step 4: Start the Application

#### Option 1: Run both servers concurrently
```bash
npm run dev-full
```

#### Option 2: Run separately

**Backend (Terminal 1):**
```bash
npm start
# Server runs on http://localhost:5000
```

**Frontend (Terminal 2):**
```bash
cd client
npm start
# App runs on http://localhost:3000
```

## 💻 Usage

### Default Credentials

**Admin Account:**
- Username: `admin`
- Password: `admin123`

### User Flow

1. **Register** - Create a new voter account
2. **Login** - Authenticate with credentials
3. **View Elections** - See active elections and candidates
4. **Cast Vote** - Select a candidate and submit
5. **View Results** - Check real-time voting results with charts

### Admin Flow

1. **Login as Admin**
2. **Add Candidates** - Manage candidate list
3. **Set Voting Period** - Define start/end time
4. **Monitor Results** - View real-time analytics
5. **Clear Data** - Reset voting session

## 📡 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/register
Content-Type: application/json

{
  "name": "username",
  "password": "password"
}
```

#### Login
```http
POST /api/login
Content-Type: application/json

{
  "name": "username",
  "password": "password"
}

Response: { "sessionId": "...", "user": {...} }
```

### Voting Endpoints

#### Get Candidates
```http
GET /api/candidates
```

#### Add Candidate (Admin only)
```http
POST /api/candidates
X-Session-Id: <session-id>
Content-Type: application/json

{
  "name": "Candidate Name"
}
```

#### Cast Vote
```http
POST /api/vote
X-Session-Id: <session-id>
Content-Type: application/json

{
  "candidate": "Candidate Name"
}
```

#### Get Votes
```http
GET /api/votes
```

#### Get Vote History
```http
GET /api/history
X-Session-Id: <session-id>
```

### Admin Endpoints

#### Set Voting Period
```http
POST /api/voting-period
X-Session-Id: <admin-session-id>
Content-Type: application/json

{
  "start": "2026-01-01T00:00:00",
  "end": "2026-12-31T23:59:59"
}
```

#### Get Voting Period
```http
GET /api/voting-period
```

#### Clear Votes
```http
POST /api/clear
X-Session-Id: <admin-session-id>
```

## 📸 Screenshots

### Login Page
Modern gradient design with glass-morphism effects

### Voting Dashboard
Real-time candidate selection with animated buttons

### Results Page
Bar and pie chart visualization of voting results

### Admin Panel
Candidate management and voting period configuration

## 🔮 Future Enhancements

### Planned Features

- [ ] **Blockchain Integration**
  - Deploy Solidity smart contracts
  - Integrate Web3.js/Ethers.js
  - Connect to Ethereum testnet
  - Transaction hash tracking

- [ ] **Database Setup**
  - PostgreSQL schema implementation
  - Migration scripts
  - User/election/vote tables
  - Audit logging

- [ ] **Security Enhancements**
  - Two-factor authentication (2FA)
  - Rate limiting
  - CAPTCHA integration
  - Advanced encryption

- [ ] **Advanced Features**
  - Email notifications
  - SMS verification
  - QR code vote verification
  - Vote delegation
  - Ranked-choice voting
  - zkSNARKs for privacy

- [ ] **DevOps**
  - Docker containerization
  - CI/CD pipeline
  - Cloud deployment (AWS/Azure)
  - Load balancing

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Nasimi Mammadli**

- GitHub: [@MammadliNasimi](https://github.com/MammadliNasimi)
- Repository: [OnlineVoting](https://github.com/MammadliNasimi/OnlineVoting)

## 🙏 Acknowledgments

- React.js community for excellent documentation
- Chart.js for visualization library
- Node.js and Express.js teams
- Ethereum blockchain technology

---

**Note:** This is a working skeleton/prototype implementation suitable for academic projects, demonstrations, and as a foundation for production systems. For production use, implement additional security measures, database integration, and blockchain connectivity.

⭐ **If you find this project useful, please give it a star!**
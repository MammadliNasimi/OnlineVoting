# Online Voting System

A basic online voting system skeleton with React frontend, Node.js backend, and MongoDB database.

## Prerequisites

- Node.js (version 14 or higher) - Download from https://nodejs.org/
- MongoDB - Download from https://www.mongodb.com/try/download/community

## System Architecture

- **Frontend**: React application in `client/` folder
- **Backend**: Node.js with Express in root
- **Database**: MongoDB with Mongoose ODM

## Setup

1. Install Node.js from https://nodejs.org/
2. Install MongoDB from https://www.mongodb.com/try/download/community
3. Start MongoDB service (usually `mongod` command or MongoDB Compass)
4. Clone or download this repository
5. Copy `.env.example` to `.env` and update values if needed
6. Install dependencies: `npm install`
7. Install client dependencies: `cd client && npm install`
8. Run the application: `npm run dev-full`

This will start the backend on port 5000 and frontend on port 3000.

## Project Structure

- `server.js`: Main server file
- `models/`: Database models
- `routes/`: API routes
- `client/`: React frontend
  - `src/App.js`: Main app component
  - `public/`: Static files

## Features

- Basic voting interface
- API to submit and retrieve votes
- Database connection with sample schema

The application demonstrates end-to-end flow from UI to backend to database.
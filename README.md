# Online Voting System

A basic online voting system skeleton with React frontend, Node.js backend, and MongoDB database.

## System Architecture

- **Frontend**: React application in `client/` folder
- **Backend**: Node.js with Express in root
- **Database**: MongoDB with Mongoose ODM

## Setup

1. Ensure MongoDB is installed and running on localhost:27017
2. Install dependencies: `npm install`
3. Install client dependencies: `cd client && npm install`
4. Run the application: `npm run dev-full`

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
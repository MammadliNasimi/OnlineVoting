# Database

PostgreSQL database schema and migration files for the voting system.

## Files

- **schema.sql** - Complete database schema with all tables
- **seed.sql** - Sample data for testing (future)
- **migrations/** - Database migration files (future)

## Database Structure

### Tables

#### users
- Stores user accounts (voters and admins)
- Password is bcrypt hashed
- Role-based access control

#### elections
- Voting periods/events
- Start and end dates
- Created by admin users

#### candidates
- Election candidates
- Linked to specific elections
- Can have description and photo

#### vote_status
- Tracks which users have voted in which elections
- Prevents duplicate voting
- Stores blockchain transaction hash

#### votes
- Anonymous vote records
- Linked to elections and candidates
- Includes vote hash for anonymity
- Stores blockchain transaction hash

## Setup Instructions

### 1. Install PostgreSQL

**Windows:**
```bash
# Download from: https://www.postgresql.org/download/windows/
# Or use Chocolatey:
choco install postgresql
```

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
```

### 2. Create Database

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE voting_system;

# Exit psql
\q
```

### 3. Run Schema

```bash
# Execute schema file
psql -U postgres -d voting_system -f database/schema.sql
```

### 4. Verify Installation

```bash
# Connect to database
psql -U postgres -d voting_system

# List tables
\dt

# View users table
SELECT * FROM users;

# Exit
\q
```

## Configuration

Update `.env` file with your database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=voting_system
DB_USER=postgres
DB_PASSWORD=your_password
```

## Database Diagram

```
users (id, name, password, role)
    |
    └─── elections (id, title, start_date, end_date, created_by)
              |
              ├─── candidates (id, election_id, name)
              |
              └─── vote_status (id, user_id, election_id, has_voted, transaction_hash)
                        |
                        └─── votes (id, election_id, candidate_id, transaction_hash)
```

## Indexes

Performance indexes created for:
- User lookups by name
- Active elections
- Election date ranges
- Vote status queries
- Vote counting queries

## Security

- ✅ Passwords stored as bcrypt hashes
- ✅ Foreign key constraints
- ✅ Unique constraints on username
- ✅ Cascade deletes for data integrity
- ✅ Indexes for query performance

## Migrations

For production, use migration tools:

```bash
# Install migrate tool
npm install -g db-migrate db-migrate-pg

# Create migration
db-migrate create add-users-table

# Run migrations
db-migrate up
```

## Backup & Restore

### Backup
```bash
pg_dump -U postgres voting_system > backup.sql
```

### Restore
```bash
psql -U postgres -d voting_system < backup.sql
```

## Useful Queries

### Get election results
```sql
SELECT 
    c.name AS candidate_name,
    COUNT(v.id) AS vote_count
FROM candidates c
LEFT JOIN votes v ON c.id = v.candidate_id
WHERE c.election_id = 1
GROUP BY c.id, c.name
ORDER BY vote_count DESC;
```

### Get voter turnout
```sql
SELECT 
    e.title,
    COUNT(DISTINCT vs.user_id) AS voters,
    (SELECT COUNT(*) FROM users WHERE role = 'user') AS total_users,
    ROUND(COUNT(DISTINCT vs.user_id)::numeric / 
          (SELECT COUNT(*) FROM users WHERE role = 'user') * 100, 2) AS turnout_percentage
FROM elections e
LEFT JOIN vote_status vs ON e.id = vs.election_id AND vs.has_voted = true
WHERE e.id = 1
GROUP BY e.id, e.title;
```

### Check if user has voted
```sql
SELECT has_voted 
FROM vote_status 
WHERE user_id = 1 AND election_id = 1;
```

## Status

⚠️ **NOT YET IMPLEMENTED** - Currently using in-memory storage.

To activate database:
1. Install PostgreSQL
2. Run schema.sql
3. Update .env file
4. Uncomment database code in models/
5. Update server.js to use database models

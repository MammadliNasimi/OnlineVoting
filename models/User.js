/**
 * User Model (PostgreSQL)
 * Database schema for user authentication and management
 * 
 * TODO: Implement PostgreSQL connection and queries
 * This is a skeleton implementation for future database integration
 */

class User {
  constructor(id, name, password, role, createdAt) {
    this.id = id;
    this.name = name;
    this.password = password; // hashed with bcrypt
    this.role = role; // 'admin' or 'user'
    this.createdAt = createdAt;
  }

  /**
   * Create a new user in the database
   * @param {Object} userData - User information
   * @returns {Promise<User>}
   */
  static async create(userData) {
    // TODO: Implement PostgreSQL INSERT query
    // Example: INSERT INTO users (name, password, role) VALUES ($1, $2, $3)
    throw new Error('Database not implemented yet - using in-memory storage');
  }

  /**
   * Find user by username
   * @param {string} name - Username
   * @returns {Promise<User|null>}
   */
  static async findByName(name) {
    // TODO: Implement PostgreSQL SELECT query
    // Example: SELECT * FROM users WHERE name = $1
    throw new Error('Database not implemented yet - using in-memory storage');
  }

  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {Promise<User|null>}
   */
  static async findById(id) {
    // TODO: Implement PostgreSQL SELECT query
    throw new Error('Database not implemented yet - using in-memory storage');
  }

  /**
   * Get all users
   * @returns {Promise<User[]>}
   */
  static async findAll() {
    // TODO: Implement PostgreSQL SELECT query
    throw new Error('Database not implemented yet - using in-memory storage');
  }

  /**
   * Update user information
   * @param {number} id - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<User>}
   */
  static async update(id, updates) {
    // TODO: Implement PostgreSQL UPDATE query
    throw new Error('Database not implemented yet - using in-memory storage');
  }

  /**
   * Delete user
   * @param {number} id - User ID
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    // TODO: Implement PostgreSQL DELETE query
    throw new Error('Database not implemented yet - using in-memory storage');
  }
}

module.exports = User;

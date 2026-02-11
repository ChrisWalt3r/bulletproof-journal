// No-op database initialization
// SQLite has been replaced with cloud backend + AsyncStorage for local features

export const initializeDatabase = async () => {
  console.log('Database initialization skipped (using cloud backend + AsyncStorage)');
  return true;
};

export default initializeDatabase;

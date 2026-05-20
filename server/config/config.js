module.exports = {
  secretKey: process.env.JWT_SECRET || 'sdfklsdfslfnlj3j5bj35bj4b4',
  localDB: process.env.MONGO_URI || 'mongodb://localhost/realestatedb',
};
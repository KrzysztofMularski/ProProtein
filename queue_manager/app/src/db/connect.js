const mongoose = require('mongoose')
const connectionString = process.env.MONGODB_CONNECTION_STRING

const connectDB = () => mongoose.connect(connectionString)

module.exports = connectDB
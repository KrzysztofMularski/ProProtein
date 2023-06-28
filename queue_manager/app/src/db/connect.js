const mongoose = require('mongoose');
const connectionString = process.env.MONGODB_CONNECTION_STRING;

const connectDB = async () => {
    try {
        return mongoose.connect(connectionString);
    } catch (err) {
        console.log(err);
    }
}

module.exports = connectDB;

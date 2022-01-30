const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        min: [2, 'Username length cannot be less than 2 characters'],
        max: [40, 'Username length cannot be more than 40 characters']
    },
    email: {
        type: String,
        required: true,
        min: [2, 'Email length cannot be less than 2 characters'],
        max: [100, 'Email length cannot be more than 100 characters']
    },
    hashedPassword: {
        type: String,
        required: true,
    },
    accountVerified: {
        type: Boolean,
        default: false,
    },
    created: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model('User', userSchema)
const mongoose = require('mongoose')

const logSchema = new mongoose.Schema({

    content: {
        type: String,
        required: true,
    },
    source: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        required: true,
    },
    associatedUserId: {
        type: mongoose.Types.ObjectId,
    }
})

module.exports = mongoose.model('Log', logSchema)
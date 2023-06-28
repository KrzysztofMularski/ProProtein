const mongoose = require('mongoose')

const demoFileSchema = new mongoose.Schema({
    file_id: {
        type: mongoose.Types.ObjectId,
    },
    filename: {
        type: String,
    },
})

module.exports = mongoose.model('DemoFile', demoFileSchema)
const mongoose = require('mongoose')

const queueEntrySchema = new mongoose.Schema({
    project_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    created: {
        type: Date,
        default: Date.now
    }
}, { collection: 'queue_entries' })

module.exports = mongoose.model('QueueEntry', queueEntrySchema)
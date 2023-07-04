const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
    },
    secondName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    associatedUserId: {
        type: mongoose.Types.ObjectId,
    }
}, { collection: 'contact_messages' });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);

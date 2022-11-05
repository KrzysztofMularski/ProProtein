const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    size: {
        type: Number,
        required: true
    },
    length: {
        type: Number,
        required: true,
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    filename: {
        type: String,
        required: true
    },
    contentType: {
        type: String,
        required: true
    },
});

module.exports = mongoose.model('Uploads_templates.Files', fileSchema);
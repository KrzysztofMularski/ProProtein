const mongoose = require('mongoose')

const templateFileSchema = new mongoose.Schema({
    template_type: {
        type: String,
        required: true,
    },
    file_id: {
        type: mongoose.Types.ObjectId,
    },
    content: {
        type: String,
    }
})

module.exports = mongoose.model('TemplateFile', templateFileSchema)
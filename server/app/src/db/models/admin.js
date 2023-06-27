const mongoose = require('mongoose')

const superAdminSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Types.ObjectId,
        required: true,
    }
})

module.exports = mongoose.model('SuperAdmin', superAdminSchema)
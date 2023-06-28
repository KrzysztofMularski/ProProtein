const mongoose = require('mongoose')
const Log = require('./db/models/log')

const pushLog = async (content, source, associatedUserId = '') => {

    const newLog = new Log({
        content,
        source,
        timestamp: Date.now(),
    });

    if (associatedUserId) {
        newLog.associatedUserId = mongoose.Types.ObjectId(associatedUserId);
    }

    await newLog.save();
}

module.exports = pushLog
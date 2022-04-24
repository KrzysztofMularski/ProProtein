const mongoose = require('mongoose')
const Project = require('../db/models/project')
const User = require('../db/models/user')

const getAdminPage = (req, res) => {
    res.render('general/_admin');
}

const getMakeMeAdmin = async (req, res) => {
    try {
        const newAdminId = req.user._id;
        const user = await User.findById(newAdminId);
        user.isAdmin = true;
        await user.save();
        req.flash('success', 'You are an admin now !');
    } catch (err) {
        console.log(err);
    }
}

module.exports = {
    getAdminPage,
    getMakeMeAdmin,
}
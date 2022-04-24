const mongoose = require('mongoose')
const Project = require('../db/models/project')
const User = require('../db/models/user')

const getAdminPage = async (req, res) => {
    try {
        const messages = req.flash()
        const errors = messages.error
        const successes = messages.success
        const reqQuery = {
            route: '/'
        }

        const users = await User.find();
        res.render('general/_admin', { users, selected: '', logged: true, errors, successes, reqQuery });
    } catch (err) {
        console.log(err);
    }
}

const getMakeMeAdmin = async (req, res) => {
    try {
        const newAdminId = req.user._id;
        const user = await User.findById(newAdminId);
        user.isAdmin = true;
        await user.save();
        req.flash('success', 'You are an admin now !');
        res.redirect('/');
    } catch (err) {
        console.log(err);
    }
}

module.exports = {
    getAdminPage,
    getMakeMeAdmin,
}
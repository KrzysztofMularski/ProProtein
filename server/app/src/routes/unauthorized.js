const User = require('../db/models/user')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const { sendAuthMail, sendPasswordReset } = require('../mailing')

const getLoginPage = (req, res) => {
    const messages = req.flash()
    const errors = messages.error
    const successes = messages.success
    res.render('auth/_login', { logged: false, selected: 'Sign In', errors, successes })
}

const postLogin = passport => 
    passport.authenticate('local', {
        successRedirect: '/projects',
        failureRedirect: '/login',
        failureFlash: true,
        successFlash: true
    }
)

const getRegisterPage = (req, res) => {
    const messages = req.flash()
    const errors = messages.error
    const successes = messages.success
    const credentials = req.session.credentials || { username: '', email: '' }
    delete req.session.credentials
    res.render('auth/_register', { logged: false, credentials, selected: 'Sign Up', errors, successes })
}

const postRegister = async (req, res) => {
    try {
        if (req.body.password !== req.body.password_confirmation) {
            req.flash('error', 'Confirmation password is different')
            req.session.credentials = {
                username: req.body.username,
                email: req.body.email
            }
            return res.redirect('/register')
        }
        if (await User.exists({ email: req.body.email })) {
            req.flash('error', 'User with that email already exists')
            req.session.credentials = {
                username: req.body.username,
                email: req.body.email
            }
            return res.redirect('/register')
        }
        const hashedPass = await bcrypt.hash(req.body.password, 10)
        const newUser = new User({
            username: req.body.username,
            email: req.body.email,
            hashedPassword: hashedPass
        })
        await newUser.save()
        // sendAuthMail(req.body.username, req.body.email)
        // req.flash('success', 'New account successfully created. Check your mailbox to verify it')
        req.flash('success', 'New account successfully created.')
        res.redirect('/login')
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const getConfirmationMailPage = async (req, res) => {
    try {
        jwt.verify(req.params.token, process.env.ACCESS_TOKEN_SECRET, async (err, user) => {
            if (err)
                return res.sendStatus(403)
            await User.updateOne({ email: user.email }, { $set: { accountVerified: true }})
            req.flash('success', 'Account successfully verified')
            return res.redirect('/login')
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(501).send(err)
    }
}

const getForgotPasswordPage = (req, res) => {
    const messages = req.flash()
    const errors = messages.error
    const successes = messages.success
    const credentials = req.session.credentials || { email: '' }
    delete req.session.credentials
    res.render('auth/_forgot_password', { logged: false, credentials, selected: '', errors, successes })
}

const postForgotPassword = async (req, res) => {
    try {
        if (!await User.exists({ email: req.body.email })) {
            req.flash('error', 'There is no user with such email address')
            req.session.credentials = {
                email: req.body.email
            }
            return res.redirect('/forgot_password')
        }
        const user = await User.findOne({ email: req.body.email }, 'username email')
        sendPasswordReset(user.username, user.email)
        req.flash('success', 'Mail with password reset link was send')
        return res.redirect('/login')
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const getPasswordResetPage = (req, res) => {
    const messages = req.flash()
    const errors = messages.error
    const successes = messages.success
    res.render('auth/_password_reset', { token: req.params.token, logged: false, errorMessage: '', selected: '', errors, successes })
}

const postPasswordReset = async (req, res) => {
    try {
        jwt.verify(req.body.token, process.env.PASS_RESET_TOKEN_SECRET, async (err, user) => {
            if (err) {
                return res.sendStatus(403)
            }
            if (req.body.password !== req.body.password_confirmation) {
                req.flash('error', 'Confirmation password is different')
                return res.redirect(`/password_reset/${req.body.token}`)
            }
            const hashedPass = await bcrypt.hash(req.body.password, 10)
            await User.updateOne({ email: user.email }, { $set: { hashedPassword: hashedPass }})
            req.flash('success', 'Password successfully reset')
            return res.redirect('/login')
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

module.exports = {
    getLoginPage,
    postLogin,
    getRegisterPage,
    postRegister,

    getConfirmationMailPage,
    
    getForgotPasswordPage,
    postForgotPassword,
    getPasswordResetPage,
    postPasswordReset
}
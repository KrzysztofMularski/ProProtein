const User = require('../db/models/user')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pushLog = require('../logging')

const { sendAuthMail, sendPasswordReset } = require('../mailing')

const getLoginPage = (req, res) => {
    const messages = req.flash()
    const errors = messages.error
    const successes = messages.success
    res.render('auth/_login', { logged: false, selected: 'Sign In', errors, successes })
}

const postLogin = passport => 
    passport.authenticate('local', {
        successRedirect: '/projects?rowscount=5&page=1',
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
        const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
        if (!emailRegex.test(req.body.email)) {
            req.flash('error', `Email (${req.body.email}) is incorrect`);
            return res.redirect(`/register`);
        }
        if (await User.exists({ email: req.body.email })) {
            req.flash('error', 'User with that email already exists')
            req.session.credentials = {
                username: req.body.username,
                email: req.body.email
            }
            return res.redirect('/register')
        }
        if (req.body.password.length < 6) {
            req.flash('error', 'Password is too short (min 6 characters)');
            return res.redirect('/register')
        }

        const hashedPass = await bcrypt.hash(req.body.password, 10)
        const newUser = new User({
            username: req.body.username,
            email: req.body.email,
            hashedPassword: hashedPass
        })

        const error = await newUser.validateSync();

        if (error) {
            Object.entries(error.errors).forEach(([ label, { message } ]) => {
                req.flash('error', `Wrong ${ label }: ${ message }`)
            });
            return res.redirect(`/register`);
        } else {
            await newUser.save()
            sendAuthMail(req.body.username, req.body.email)
            req.flash('success', 'New account successfully created. Check your mailbox to verify it')
            // req.flash('success', 'New account successfully created.')
            res.redirect('/login')
        }

    } catch (err) {
        // console.log(err)
        await pushLog(err, 'postRegister');
        req.flash('error', 'Error while creating new account');
        res.redirect('/register')
    }
}

const getConfirmationMailPage = async (req, res) => {
    try {
        jwt.verify(req.params.token, process.env.ACCESS_TOKEN_SECRET, async (err, user) => {
            if (err) {
                req.flash('error', 'Error while verifying token');
                return res.redirect('/')
            }
            await User.updateOne({ email: user.email }, { $set: { accountVerified: true }})
            req.flash('success', 'Account successfully verified')
            return res.redirect('/login')
        })
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getConfirmationMailPage');
        req.flash('error', 'Error');
        return res.redirect('/')
    }
}

const getForgotPasswordPage = async (req, res) => {
    try {
        const messages = req.flash()
        const errors = messages.error
        const successes = messages.success
        const credentials = req.session.credentials || { email: '' }
        delete req.session.credentials
        res.render('auth/_forgot_password', { logged: false, credentials, selected: '', errors, successes })
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getForgotPasswordPage');
        req.flash('error', 'Error');
        return res.redirect('/')
    }
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
        // console.log(err)
        await pushLog(err, 'postForgotPassword');
        req.flash('error', 'Error');
        return res.redirect('/')
    }
}

const getPasswordResetPage = async (req, res) => {
    try {
        const messages = req.flash()
        const errors = messages.error
        const successes = messages.success
        res.render('auth/_password_reset', { token: req.params.token, logged: false, errorMessage: '', selected: '', errors, successes })
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getPasswordResetPage');
        req.flash('error', 'Error');
        return res.redirect('/')
    }
}

const postPasswordReset = async (req, res) => {
    try {
        jwt.verify(req.body.token, process.env.PASS_RESET_TOKEN_SECRET, async (err, user) => {
            if (err) {
                req.flash('error', 'Error while verifying token');
                return res.redirect('/')
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
        // console.log(err)
        await pushLog(err, 'postPasswordReset');
        req.flash('error', 'Error while reseting password');
        return res.redirect('/')
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
const LocalStrategy = require('passport-local').Strategy
const User = require('./db/models/user')
const bcrypt = require('bcryptjs')

const initialize = (passport) => {
    const authenticateUser = async (email, password, done) => {
        try {
            const user = await User.findOne({ email })
            if (user === null)
                return done(null, false, { message: 'There is no user with that email address' })
            if (user.accountVerified === false)
                return done(null, false, { message: 'Please confirm your account to login' })
            if (await bcrypt.compare(password, user.hashedPassword))
                return done(null, user, { message: 'You are successfully logged in' })
            else
                return done(null, false, { message: 'Entered password is incorrect' })
        } catch (err) {
            console.log(err)
            return done(err)
        }
    }
    passport.use(new LocalStrategy({usernameField: 'email'}, authenticateUser))
    passport.serializeUser((user, done) => {
        done(null, user._id)
    })
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id)
            return done(null, user)
        } catch (err) {
            console.log(err)
            return done(err)
        }
    })
}

module.exports = initialize
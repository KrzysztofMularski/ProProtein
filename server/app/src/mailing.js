require('dotenv').config()

const nodemailer = require('nodemailer')
const jwt = require('jsonwebtoken')
const ejs = require('ejs')
const serverAddress = process.env.SERVER_ADDRESS
const path = '/home/app/src/views/components/mailing'
// const path = './src/views/components/mailing';

const transporter = nodemailer.createTransport({
    host: process.env.MAILER_HOST,
    port: process.env.PORT,
    auth: {
        user: process.env.MAILER_USER,
        pass: process.env.MAILER_PASSWORD
    }
})

function sendAuthMail(username, email) {
    try {
        jwt.sign(
            { email: email },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: process.env.ACCESS_TOKEN_EXP },
            (err, emailToken) => {
                if (err)
                    throw err
                const url = `${serverAddress}/account_confirmation/${emailToken}`
                
                ejs.renderFile(`${path}/_account_confirmation.ejs`, {url, username}, (err, str) => {
                    if (err)
                        console.log(err)
                    else {
                        transporter.sendMail({
                            from: `"ProProtein" <${process.env.MAILER_SENDER_ADDRESS}>`,
                            to: email,
                            subject: 'Account Confirmation',
                            html: str
                        })
                        .then()
                        .catch(e => console.log(e))
                    }
                })
            }
        )
        
    } catch (e) {
        console.log(e)
    }
}

function sendPasswordReset(username, email) {
    try {
        jwt.sign(
            { email: email },
            process.env.PASS_RESET_TOKEN_SECRET,
            { expiresIn: process.env.PASS_RESET_TOKEN_EXP },
            (err, passToken) => {
                if (err)
                    throw err
                const url = `${serverAddress}/password_reset/${passToken}`

                ejs.renderFile(`${path}/_reset_password.ejs`, {url, username}, (err, str) => {
                    if (err)
                        console.log(err)
                    else {
                        transporter.sendMail({
                            from: `"ProProtein" <${process.env.MAILER_SENDER_ADDRESS}>`,
                            to: email,
                            subject: 'Reseting Password',
                            html: str
                        })
                        .then()
                        .catch(e => console.log(e))
                    }
                })
            }
        )
    } catch (e) {
        console.log(e)
    }
}

function sendNotificationSimFinished(username, email, project_id, sim_status) {
    try {
        jwt.sign(
            { email: email },
            process.env.PASS_RESET_TOKEN_SECRET,
            { expiresIn: process.env.PASS_RESET_TOKEN_EXP },
            (err, passToken) => {
                if (err)
                    throw err
                const url = serverAddress
                const url_project = `${serverAddress}/project?id=${project_id}`

                if (sim_status === 'ok') {
                    ejs.renderFile(`${path}/_notification_finished.ejs`, {url, url_project, username}, (err, str) => {
                        if (err)
                            console.log(err)
                        else {
                            transporter.sendMail({
                                from: `"ProProtein" <${process.env.MAILER_SENDER_ADDRESS}>`,
                                to: email,
                                subject: 'Your simulation processing is Finished!',
                                html: str
                            })
                            .then()
                            .catch(e => console.log(e))
                        }
                    })
                } else if (sim_status === 'error') {
                    ejs.renderFile(`${path}/_notification_error.ejs`, {url, url_project, username}, (err, str) => {
                        if (err)
                            console.log(err)
                        else {
                            transporter.sendMail({
                                from: `"ProProtein" <${process.env.MAILER_SENDER_ADDRESS}>`,
                                to: email,
                                subject: 'Your simulation processing is Finished!',
                                html: str
                            })
                            .then()
                            .catch(e => console.log(e))
                        }
                    })
                }
                
            }
        )
    } catch (e) {
        console.log(e)
    }
}

module.exports = { sendAuthMail, sendPasswordReset, sendNotificationSimFinished }

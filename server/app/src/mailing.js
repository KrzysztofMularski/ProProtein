require('dotenv').config();

const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const path = require('path');
const pushLog = require('./logging');
// todo: check every mailing function in production
const path_to_template = './src/views/components/mailing';
let serverAddress = '';
if (process.env.MODE === 'development') {
    serverAddress = "https://proprotein.cs.put.poznan.pl";
} else {
    serverAddress = process.env.SERVER_ADDRESS;
}

const transporter = nodemailer.createTransport({
    host: process.env.MAILER_HOST,
    port: process.env.MAILER_PORT,
    auth: {
        user: process.env.MAILER_USER,
        pass: process.env.MAILER_PASSWORD
    }
});

transporter.verify(function (error, success) {
    console.log("mail transporter init..");
    if (error) {
        console.log("transporter error:", error);
    } else {
        console.log("transporter success:", success);
    }
});

const sendMail = async (template_filename, template_params, email_address, email_subject) => {
    try {
        ejs.renderFile(path.join(path_to_template, template_filename), template_params, (err, str) => {
            if (err) {
                throw err;
            }
            transporter.sendMail({
                from: `"ProProtein" <${process.env.MAILER_SENDER_ADDRESS}>`,
                to: email_address,
                subject: email_subject,
                html: str
            })
        });
    } catch (err) {
        // console.log(err);
        await pushLog(err, `sendMail, template_filename: ${JSON.stringify(template_filename)}, template_params: ${JSON.stringify(template_params)}, ${email_address} : ${email_subject}`);
    }
}

const sendAuthMail = (username, email) => {
    try {
        jwt.sign(
            { email },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: process.env.ACCESS_TOKEN_EXP },
            (err, emailToken) => {
                if (err)
                    throw err
                const url = `${serverAddress}/account_confirmation/${emailToken}`
                
                sendMail('_account_confirmation.ejs', {url, username}, email, 'Account Confirmation');
            }
        )
    } catch (e) {
        console.log(e)
    }
}

const sendPasswordReset = (username, email) => {
    try {
        jwt.sign(
            { email },
            process.env.PASS_RESET_TOKEN_SECRET,
            { expiresIn: process.env.PASS_RESET_TOKEN_EXP },
            (err, passToken) => {
                if (err)
                    throw err
                const url = `${serverAddress}/password_reset/${passToken}`

                sendMail('_reset_password.ejs', {url, username}, email, 'Password reset');
            }
        )
    } catch (e) {
        console.log(e)
    }
}

const sendNotificationSimFinished = (username, email, project_id, sim_status) => {
    const url = serverAddress
    const url_project_details = `${serverAddress}/project?id=${project_id}`
    const url_project_results = `${serverAddress}/project/results?id=${project_id}`

    if (sim_status === 'ok') {
        sendMail('_notification_finished.ejs', {url, url_project: url_project_results, username}, email, 'Your simulation finished successfully!');
    } else if (sim_status === 'error') {
        sendMail('_notification_error.ejs', {url, url_project: url_project_details, username}, email, 'Your simulation finished with errors!');
    }
}

const sendGuestProjectIsWaiting = (email, project_id) => {
    const url = serverAddress;
    const url_project_details = `${serverAddress}/guest_simulation/${project_id}`;
    const url_project_results = `${serverAddress}/guest_simulation/results/${project_id}`;

    sendMail('_guest_simulation.ejs', {url, url_project_details, url_project_results}, email, 'Your guest simulation details');
}

const sendNotificationGuestSimFinished = (email, project_id, sim_status) => {
    const url = serverAddress;
    const url_project_details = `${serverAddress}/guest_simulation/${project_id}`;
    const url_project_results = `${serverAddress}/guest_simulation/results/${project_id}`;

    if (sim_status === 'ok') {
        sendMail('_notification_finished.ejs', {url, url_project: url_project_results, username: null}, email, 'Your guest simulation finished successfully!');
    } else if (sim_status === 'error') {
        sendMail('_notification_error.ejs', {url, url_project: url_project_details, username: null}, email, 'Your guest simulation finished with errors!');
    }
}

const sendContactMessageConfirmation = contactMessageObj => {
    sendMail('_contact_message_confirmation_to_user.ejs', {serverAddress, ...contactMessageObj}, contactMessageObj.email, 'Message received');
}

module.exports = {
    sendAuthMail,
    sendPasswordReset,
    sendNotificationSimFinished,
    sendGuestProjectIsWaiting,
    sendNotificationGuestSimFinished,
    sendContactMessageConfirmation
}

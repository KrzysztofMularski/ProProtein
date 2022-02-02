require('dotenv').config()

const express = require('express')
const router = express.Router()
const passport = require('passport')
const flash = require('express-flash')
const session = require('cookie-session')
const initializePassport = require('./passport_config')
const methodOverride = require('method-override')

const auth = require('./routes/authorized')
const unauth = require('./routes/unauthorized')
const free = require('./routes/free_access')
const midd = require('./routes/middleware')
const debug = require('./routes/debug')

router.use(express.json())
router.use(express.urlencoded({ extended: false }))
router.use(flash())
router.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
router.use(passport.initialize())
router.use(passport.session())
router.use(methodOverride('_method'))

initializePassport(passport)

// free access
router.all('/', free.getHomePage)
router.get('/home', (req, res) => res.redirect('/'))
router.get('/download/templates/:template', free.getDownloadTemplate, midd.downloadTemplateFile)

// unathorized access
router.get('/login', midd.checkNotAuthenticated, unauth.getLoginPage)
router.post('/login', midd.checkNotAuthenticated, unauth.postLogin(passport))
router.get('/register', midd.checkNotAuthenticated, unauth.getRegisterPage)
router.post('/register', midd.checkNotAuthenticated, unauth.postRegister)

router.get('/account_confirmation/:token', midd.checkNotAuthenticated, unauth.getConfirmationMailPage)

router.get('/forgot_password', midd.checkNotAuthenticated, unauth.getForgotPasswordPage)
router.post('/forgot_password', midd.checkNotAuthenticated, unauth.postForgotPassword)
router.get('/password_reset/:token', midd.checkNotAuthenticated, unauth.getPasswordResetPage)
router.post('/password_reset', midd.checkNotAuthenticated, unauth.postPasswordReset)

// authorized access
router.get('/projects', midd.checkAuthenticated, auth.getProjectsPage)
router.get('/waiting', midd.checkAuthenticated, auth.getWaitingPage)
router.get('/history', midd.checkAuthenticated, auth.getHistoryPage)
router.get('/profile', midd.checkAuthenticated, auth.getProfilePage)
router.post('/edit_profile', midd.checkAuthenticated, auth.postEditProfile)

router.delete('/logout', midd.checkAuthenticated, auth.logout)

router.post('/new_project', midd.checkAuthenticated, auth.postNewProject)
router.get('/project', midd.checkAuthenticated, auth.getProject)
router.post('/edit_description', midd.checkAuthenticated, auth.postEditDescription)
router.delete('/delete_project', midd.checkAuthenticated, midd.deleteAllFiles, auth.deleteProject)

router.post('/upload/:file_type', midd.checkAuthenticated, /*midd.checkIfNotFinished,*/ midd.upload.single('input_data'), auth.postUploadStructure, midd.deleteFile)
router.post('/select_demo', midd.checkAuthenticated, auth.postSelectDemo, midd.deleteFile)

router.get('/download/file/:project_id/:file_type', midd.checkAuthenticated, auth.getDownloadFile, midd.downloadFile)
router.get('/molstar', midd.checkAuthenticated, auth.getMolstar)

// save simulation parameters
router.post('/save_parameters', midd.checkAuthenticated, midd.upload.fields([
    { name: 'energy_min', maxCount: 1 },
    { name: 'MD_simulation', maxCount: 1 }
]), auth.postSaveParameters, midd.deleteFiles)

// submit simulation
router.post('/submit_simulation', midd.checkAuthenticated, auth.postSubmitSimulation)

// notify user about simulation // requests only from queue manager (should be)
router.post('/nofify_user', auth.postNotifyUser)

// debug - only for uploading/deleting files, normally should not be visible
router.get('/debug', debug.getDebugPage)
router.post('/debug/upload', midd.upload.single('file'), debug.postUploadDebug, midd.deleteFile)
router.post('/debug/delete', debug.postDeleteDebug, midd.deleteFile)
router.post('/debug/upload_demo', midd.upload.single('file'), debug.postUploadDemoDebug)
router.post('/debug/delete_demo', debug.postDeleteDemoDebug, midd.deleteFile)
router.post('/debug/upload_template', midd.upload_templates.single('file'), debug.postUploadTemplateDebug)
router.post('/debug/delete_template', debug.postDeleteTemplateDebug, midd.deleteTemplateFile)

module.exports = router
require('dotenv').config()

const express = require('express')
const router = express.Router()
const passport = require('passport')
const flash = require('express-flash')
const session = require('cookie-session')
const initializePassport = require('./passport_config')
const methodOverride = require('method-override')
// const mongo_express = require('mongo-express/lib/middleware')
// const mongo_express_config = require('./mongo_express_config')

const admin = require('./routes/admin')
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

router.post('/delete_account', midd.checkAuthenticated, auth.deleteAccount)

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
router.get('/debug', midd.checkAuthenticated, midd.checkIsAdmin, debug.getDebugPage)
router.post('/debug/upload', midd.checkAuthenticated, midd.checkIsAdmin, midd.upload.single('file'), debug.postUploadDebug, midd.deleteFile)
router.post('/debug/delete', midd.checkAuthenticated, midd.checkIsAdmin, debug.postDeleteDebug, midd.deleteFile)
router.post('/debug/upload_demo', midd.checkAuthenticated, midd.checkIsAdmin, midd.upload.single('file'), debug.postUploadDemoDebug)
router.post('/debug/delete_demo', midd.checkAuthenticated, midd.checkIsAdmin, debug.postDeleteDemoDebug, midd.deleteFile)
router.post('/debug/upload_template', midd.checkAuthenticated, midd.checkIsAdmin, midd.upload_templates.single('file'), debug.postUploadTemplateDebug)
router.post('/debug/delete_template', midd.checkAuthenticated, midd.checkIsAdmin, debug.postDeleteTemplateDebug, midd.deleteTemplateFile)

// router.get('/debug/add200users', debug.add200users);
// router.get('/debug/reset_password', debug.postResetPassword);

router.get('/admin', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminPage);

router.get('/admin/users', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminUsersPage);
router.get('/admin/users/:user_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminUserDetailsPage);
router.post('/admin/users/edit/:user_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.postAdminUserEdit);
router.delete('/admin/users/delete/:user_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.deleteAdminUserAccount);

router.get('/admin/projects', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminProjectsPage);
router.get('/admin/projects/:project_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminProjectDetailsPage);
router.post('/admin/projects/edit/:project_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.postAdminProjectEdit);
router.post('/admin/projects/edit_files/:project_id', midd.checkAuthenticated, midd.checkIsAdmin, midd.upload.fields([
    { name: 'structure_file', maxCount: 1 },
    { name: 'energy_min_file', maxCount: 1 },
    { name: 'MD_simulation_file', maxCount: 1 },
    { name: 'trajectory_file', maxCount: 1 },
    { name: 'residues_indexes_file', maxCount: 1 }]), admin.postAdminProjectEditFiles, midd.adminDeleteProjectFiles);
router.post('/admin/projects/edit_parameters/:project_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.postAdminProjectEditParameters);
router.delete('/admin/projects/delete/:project_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.deleteAdminProject, midd.adminDeleteProjectFiles);

router.get('/admin/files', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminFilesPage);
router.delete('/admin/files/delete/:file_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.deleteAdminFile, midd.adminDeleteFile);
router.post('/admin/files/upload', midd.checkAuthenticated, midd.checkIsAdmin, midd.upload.single('file'), admin.postAdminFileUpload);

router.get('/admin/files/demos', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminFilesDemosPage);
router.delete('/admin/files/demos/delete/:file_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.deleteAdminDemoFile, midd.adminDeleteFile);
router.post('/admin/files/demos/upload', midd.checkAuthenticated, midd.checkIsAdmin, midd.upload.single('file'), admin.postAdminDemoUpload);

router.get('/admin/files/templates', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminFilesTemplatesPage);
router.delete('/admin/files/templates/delete/:file_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.deleteAdminTemplateFile, midd.adminDeleteFile);
router.post('/admin/files/templates/upload', midd.checkAuthenticated, midd.checkIsAdmin, midd.upload_templates.single('file'), admin.postAdminTemplateUpload);
router.post('/admin/files/templates/edit', midd.checkAuthenticated, midd.checkIsAdmin, admin.postAdminTemplateEdit);

router.get('/admin/download/:file_id', midd.checkAuthenticated, midd.checkIsAdmin, midd.adminDownload);

router.get('/admin/logs', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminLogsPage);
router.delete('/admin/logs/delete/:log_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.deleteAdminLog);

// router.use('/mongo_express', mongo_express(mongo_express_config));

// router.get('/admin/mongo-express', midd.checkAuthenticated, midd.checkIsAdmin, mongo_express(mongo_express_config));

// router.get('/make_me_admin', admin.getMakeMeAdmin)

// router.get('/admin/')

module.exports = router
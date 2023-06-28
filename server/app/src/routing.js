require('dotenv').config()

const express = require('express')
const router = express.Router()
const passport = require('passport')
const flash = require('express-flash')
const session = require('cookie-session')
const initializePassport = require('./passport_config')
const methodOverride = require('method-override')

const admin = require('./routes/admin')
const auth = require('./routes/authorized')
const unauth = require('./routes/unauthorized')
const free = require('./routes/free_access')
const midd = require('./routes/middleware')

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
router.get('/home', (_, res) => res.redirect('/'))
router.get('/download/example/:example', free.getDownloadDemo, midd.downloadFile)
router.get('/queue/:project_id', free.getQueue);
router.get('/queue', free.getQueueGeneral);
router.get('/help', free.getHelpPage);

// guest access
router.get('/guest_simulation', midd.checkNotAuthenticated, free.getGuestSimulationPage);
router.post('/guest_simulation', midd.checkNotAuthenticated, midd.upload.single('input_data'), midd.validateFileGuest, free.postGuestSimulation);
router.get('/guest_simulation/:project_id', midd.checkNotAuthenticated, free.getGuestProject);
router.get('/guest_simulation/results/:project_id', midd.checkNotAuthenticated, free.getGuestProjectResults);
router.get('/guest/download/file/:project_id/:file_type', midd.checkNotAuthenticated, free.getGuestDownloadFile, midd.downloadFile);
router.get('/guest_molstar', midd.checkNotAuthenticated, free.getMolstarGuest);
router.get('/guest_molstar_requested', midd.checkNotAuthenticated, free.getMolstarGuestRequested);
router.post('/guest_email', midd.checkNotAuthenticated, free.postGuestEmail);

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
router.get('/project/results', midd.checkAuthenticated, auth.getProjectResults);
router.post('/edit_description', midd.checkAuthenticated, auth.postEditDescription)
router.delete('/delete_project', midd.checkAuthenticated, auth.deleteProject)

router.post('/upload/:file_type', midd.checkAuthenticated, midd.upload.single('input_data'), midd.validateFile, auth.postUploadStructure);
router.post('/select_example', midd.checkAuthenticated, auth.postSelectDemo)

router.get('/download/file/:project_id/:file_type', midd.checkAuthenticated, auth.getDownloadFile, midd.downloadFile)
router.get('/molstar', midd.checkAuthenticated, auth.getMolstar)

// save simulation parameters
router.post('/save_parameters', midd.checkAuthenticated, auth.postSaveParameters)

// notify user about simulation // requests only from queue manager (should be)
router.post('/nofify_user', auth.postNotifyUser)

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
    { name: 'trajectory_file', maxCount: 1 },
    { name: 'energy_potential_file', maxCount: 1 },
    { name: 'energy_temperature_file', maxCount: 1 },
    { name: 'energy_pressure_file', maxCount: 1 },
    { name: 'energy_density_file', maxCount: 1 },
    { name: 'md_xtc_file', maxCount: 1 },
    { name: 'md_edr_file', maxCount: 1 },
    { name: 'md_tpr_file', maxCount: 1 },
    { name: 'residues_indexes_file', maxCount: 1 },
    { name: 'simulation_logs_file', maxCount: 1 },
]), admin.postAdminProjectEditFiles, midd.adminDeleteProjectFiles);
router.post('/admin/projects/edit_parameters/:project_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.postAdminProjectEditParameters);
router.delete('/admin/projects/delete/:project_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.deleteAdminProject, midd.adminDeleteProjectFiles);

router.get('/admin/files', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminFilesPage);
router.delete('/admin/files/delete/:file_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.deleteAdminFile, midd.adminDeleteFile);
router.post('/admin/files/upload', midd.checkAuthenticated, midd.checkIsAdmin, midd.upload.single('file'), admin.postAdminFileUpload);

router.get('/admin/files/demos', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminFilesDemosPage);
router.delete('/admin/files/demos/delete/:file_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.deleteAdminDemoFile, midd.adminDeleteFile);
router.post('/admin/files/demos/upload', midd.checkAuthenticated, midd.checkIsAdmin, midd.upload.single('file'), admin.postAdminDemoUpload);

router.get('/admin/download/:file_id', midd.checkAuthenticated, midd.checkIsAdmin, midd.adminDownload);

router.get('/admin/logs', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminLogsPage);
router.delete('/admin/logs/delete/:log_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.deleteAdminLog);

router.get('/admin/queue', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminQueuePage);
router.delete('/admin/queue/delete/:queue_entry_id', midd.checkAuthenticated, midd.checkIsAdmin, admin.deleteAdminQueueEntry);

// router.get('/admin/make_super_admin', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminMakeSuperAdmin);
// router.get('/admin/all_super_admins', midd.checkAuthenticated, midd.checkIsAdmin, admin.getAdminConsoleLogSuperAdmin);

// router.get('/make_me_admin', admin.getMakeMeAdmin)

// router.get('/admin/')

module.exports = router

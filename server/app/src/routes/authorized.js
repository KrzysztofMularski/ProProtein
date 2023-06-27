const mongoose = require('mongoose')
const Project = require('../db/models/project')
const User = require('../db/models/user')
const DemoFile = require('../db/models/demoFile')
const QueueEntry = require('../db/models/queueEntry')
const moment = require('moment')
const serverAddress = process.env.SERVER_ADDRESS
const { sendNotificationSimFinished, sendNotificationGuestSimFinished } = require('../mailing')
const bcrypt = require('bcryptjs')
const pushLog = require('../logging')
const path = require('path');
const { gfsDeleteProjectWithFiles, gfsDeleteFile } = require('../gfs')

const setPagination = (query, route) => {

    let rowsPerPage = query.rowscount
    let currentPage = query.page

    let errorFlag = false

    if (rowsPerPage === undefined) {
        rowsPerPage = 5
        errorFlag = true
    }

    if (currentPage === undefined) {
        currentPage = 1
        errorFlag = true
    }

    if (errorFlag)
        return { rowsPerPage, currentPage, redirectRoute: `/${route}?rowscount=${rowsPerPage}&page=${currentPage}` }
    
    return { rowsPerPage, currentPage, redirectRoute: null }
}

const getPagination = (rowsPerPage, currentPage, route, contentLength) => {
    
    currentPage = parseInt(currentPage)

    let pagesCount = Math.ceil(contentLength / rowsPerPage)
    if (pagesCount === 0)
        pagesCount = 1

    if (currentPage < 1) {
        currentPage = 0
        return { pg: null, errorRoute: `/${route}?rowscount=${rowsPerPage}&page=1` }
    } else if (currentPage > pagesCount) {
        currentPage = pagesCount
        return { pg: null, errorRoute: `/${route}?rowscount=${rowsPerPage}&page=${currentPage}` }
    }

    const paginationArrows = {
        left: currentPage - 1 <= 0,
        right: currentPage + 1 > pagesCount
    }

    const maxRowIndex = currentPage * rowsPerPage - 1
    const minRowIndex = maxRowIndex - rowsPerPage + 1

    const pg = {
        rowsPerPage,
        currentPage,
        pagesCount,
        paginationArrows,
        maxRowIndex,
        minRowIndex
    }

    return { pg, errorRoute: null }
}

const short = description => {
    if (description.length > 12)
        return description.substring(0, 12) + '...'
    return description
}

const pullProjects = async (route, req, res) => {

    try {
        let status = route.substring(0,1).toUpperCase() + route.substring(1)
        const { rowsPerPage, currentPage, redirectRoute } = setPagination(req.query, route)

        if (redirectRoute !== null) {
            return res.redirect(redirectRoute)
        }

        let dbQuery = {
            owner_id: req.user._id,
        }

        if (route === 'waiting') {
            dbQuery = {
                owner_id: req.user._id,
                status: 'Waiting'
            }
        }

        if (route === 'history') {
            dbQuery = {
                owner_id: req.user._id,
                status: 'Finished'
            }
        }

        let projects = await Project.find(dbQuery, 'name created status description _id').sort({created: 'desc'});

        projects = projects.map(project => ({
            name: project.name,
            creationDate: moment(project.created).format('YYYY-MM-DD'),
            status: project.status,
            description: short(project.description),
            id: project._id.toString(),
            description_full: project.description
        }))

        const { pg, errorRoute } = getPagination(rowsPerPage, currentPage, route, projects.length)

        if (errorRoute !== null) {
            return res.redirect(errorRoute)
        }
    
        const table = {
            headers: [
                'Name',
                'Created',
                'Status',
                // 'Description',
            ],
            content: projects.filter((_, id) => id >= pg.minRowIndex && id <= pg.maxRowIndex),
            columnsCount: 4,
            rowsCount: pg.rowsPerPage
        }
        
        const reqQuery = {
            rowscount: rowsPerPage,
            page: currentPage,
            route: route
        }

        const messages = req.flash()
        const errors = messages.error
        const successes = messages.success

        res.render(`general/_${route}`, { logged: true, selected: status, table, pg, reqQuery, errors, successes })

    } catch (err) {
        // console.log(err)
        await pushLog(err, 'pullProjects', req.user._id);
        req.flash('error', 'Error');
        return res.redirect('/')
    }
}

const getProjectsPage = (req, res) => {

    return pullProjects('projects', req, res)
}

const getWaitingPage = (req, res) => {

    return pullProjects('waiting', req, res)
}

const getHistoryPage = (req, res) => {

    return pullProjects('history', req, res)
}

const getProfilePage = async (req, res) => {
    try {
        const messages = req.flash()
        const errors = messages.error
        const successes = messages.success
        const user = req.user
        const projects = await Project.find({ owner_id: user._id.toString() })
        const projects_info = {
            initial_number: projects.filter(project => project.status === 'Initial').length,
            waiting_number: projects.filter(project => project.status === 'Waiting').length,
            processing_number: projects.filter(project => project.status === 'Processing').length,
            finished_number: projects.filter(project => project.status === 'Finished').length,
            error_number: projects.filter(project => project.status === 'Error').length,
        }

        const date = user.created

        const day = date.getDate().toString().padStart(2, '0')
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const year = date.getFullYear().toString()

        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')

        const user_created = `${day}.${month}.${year} ${hours}:${minutes}`

        res.render('general/_profile', { logged: true, selected: 'Profile', user, user_created, projects_info, errors, successes })
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getProfilePage', req.user._id);
        req.flash('error', 'Error');
        return res.redirect('/')
    }
}

const postEditProfile = async (req, res) => {
    try {

        const userId = req.body.user_id;
        const username = req.body.username;
        const email = req.body.email;
        const changing_password = req.body.changing_password;
        const password = req.body.password;
        const password2 = req.body.password2;
        const user = await User.findById(userId)

        if (
            (username.length >= 2 && username.length <= 40) &&
            (email.length >= 2 && email.length <= 100) &&
            (
                !changing_password ||
                (changing_password && password === password2)
            )
        ) {
            user.username = username
            user.email = email
            if (changing_password)
                user.hashedPassword = await bcrypt.hash(password, 10)
            await user.save()
            req.flash('success', 'Successfully saved new profile')
        } else 
            req.flash('error', 'Failed while editing profile')
        res.redirect('/profile')
        
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'postEditProfile', req.body.user_id);
        req.flash('error', 'Failed while editing profile')
        return res.redirect('/')
    }
}

const deleteAccount = async (req, res) => {
    try {
        const user = req.user
        const projects = await Project.find({ owner_id: user._id.toString() })
        if (projects.length === 0) {
            await user.delete();
            req.flash('success', 'Successfully deleted an account');
            return logout(req, res);
        } else {
            req.flash('error', 'Cannot delete this account because it contains some projects');
            return res.redirect('/profile');
        }
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'deleteAccount', req.user._id);
        req.flash('error', 'Cannot delete account')
        return res.redirect('/')
    }
}

const logout = async (req, res) => {
    try {
        req.flash('success', 'Successfully signed out')
        req.logOut()
        res.redirect('/')
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'logout', req.user._id);
        req.flash('error', 'Cannot sign out')
        return res.redirect('/')
    }
}

const postNewProject = async (req, res) => {
    try {
        let route = req.body.route
        if (route === 'projects')
            route += '?rowscount=5&page=1';
        const buttonAction = req.body.new_project_button
        if (!req.body.project_name) {
            req.flash('error', 'To create new project You need to provide project name')
            return res.redirect(`/${route}`)
        }
        const newProject = new Project({
            owner_id: req.user._id,
            name: req.body.project_name,
            status: 'Initial',
            description: req.body.project_description,
        })
        await newProject.save()
        req.flash('success', 'New project is created')
        if (buttonAction === 'create')
            return res.redirect(`/${route}`)
        else
            return res.redirect(`/project?id=${newProject._id.toString()}`)
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'postNewProject', req.user._id);
        req.flash('error', 'Cannot create new project');
        return res.redirect('/')
    }
}

const getProject = async (req, res) => {
    try {
        const demos = await DemoFile.find();
        const projectId = req.query.id;
        if (!mongoose.isValidObjectId(projectId)) {
            req.flash('error', 'There is no project with such id')
            return res.redirect('/projects?rowscount=5&page=1');
        }
        const project = await Project.findOne({ _id: projectId, owner_id: req.user._id });
        if (!project) {
            req.flash('error', 'There is no project with such id');
            return res.redirect('/home');
        }
        const routeBack = '/projects?rowscount=5&page=1';

        const messages = req.flash();
        const errors = messages.error;
        const successes = messages.success;

        const params = {
            logged: true,
            selected: 'Projects',
            project,
            routeBack,
            demos,
            errors,
            successes,
            isGuest: false,
            projectUrl: path.join(serverAddress, `project?id=${projectId}`),
            resultsUrl: path.join(serverAddress, `project/results?id=${projectId}`),
        };

        if (project.status === 'Initial') {
            return res.render('general/_project_details', params);
        }

        if (project.status === "Processing" || project.status === "Waiting") {
            let curEntry = await QueueEntry
                .findOne({ project_id: project._id })
                .populate({ path: "project_id", model: Project });

            if (!curEntry || !curEntry.project_id) {
                req.flash('error', 'This project is not requested to queue, but has status Waiting or Processing. Contact administrator to resolve this issue');
                return res.redirect('/');
            }
            let curProjectPos = await QueueEntry.find({ "created": { "$lte": curEntry.created }}).count() - await Project.find({ "status": "Processing" }).count();

            if (curProjectPos < 0) {
                curProjectPos = 0;
            }
            const params_ro = {
                ...params,
                queuePosition: curProjectPos,
            }

            return res.render('general/_project_details_read_only', params_ro);
        }
        // finished or error projects
        const params_ro = {
            ...params,
            queuePosition: -1,
        }
        return res.render('general/_project_details_read_only', params_ro);
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getProject', req.user._id);
        req.flash('error', 'Error while getting project details');
        return res.redirect('/')
    }
}

const getProjectResults = async (req, res) => {
    try {
        const projectId = req.query.id;
        if (!mongoose.isValidObjectId(projectId)) {
            req.flash('error', 'There is no project with such id')
            return res.redirect('/projects?rowscount=5&page=1');
        }
        const project = await Project.findOne({ _id: projectId, owner_id: req.user._id });

        if (!project) {
            req.flash('error', 'There is no project with such id')
            return res.redirect('/home')
        }
        if (project.status !== "Finished") {
            req.flash('error', 'The results are not available');
            return res.redirect('/');
        }
        const messages = req.flash();
        const errors = messages.error;
        const successes = messages.success;
        const routeBack = `/project?id=${projectId}`;
        const params = {
            logged: true,
            selected: 'Projects',
            project,
            routeBack,
            errors,
            successes,
            isGuest: false,
            downloadUrl: '/download/file',
        };
        return res.render('general/_project_results', params);
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getProjectResults', req.user._id);
        req.flash('error', 'Error while getting project results');
        return res.redirect('/')
    }
}

const postEditDescription = async (req, res) => {
    try {
        const projectId = req.body.project_id
        const projectDescription = req.body.project_description
        const project = await Project.findById(projectId)

        if (project.owner_id.toString() !== req.user._id.toString()) {
            req.flash('error', "Project's description remains unmodified")
            return res.redirect(`/project?id=${projectId}`)
        }

        project.description = projectDescription

        const error = await project.validateSync();

        if (error) {
            Object.entries(error.errors).forEach(([ label, { message } ]) => {
                req.flash('error', `Wrong ${ label }: ${ message }`)
            });
            return res.redirect(`/project?id=${projectId}`)
        } else {
            await project.save();
            req.flash('success', "Project's description modified correctly")
            return res.redirect(`/project?id=${projectId}`)
        }
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'postEditDescription', req.user._id);
        req.flash('error', 'Cannot change project description');
        return res.redirect('/')
    }
}

const deleteProject = async (req, res) => {
    try {
        // body:
        // - project_name: 'hello',
        // - project_id: '649999f4e81510d56bb55b0a',
        // - route: 'projects'

        const projectId = req.body.project_id
        if (!mongoose.isValidObjectId(projectId)) {
            req.flash('error', 'Invalid project id');
            return res.redirect('/');
        }
        const project = await Project.findById(projectId);
        if (!project) {
            req.flash('error', 'Cannot find project with such id');
            return res.redirect('/');
        }
        if (!project.owner_id) {
            // don't have owner, it is guest project
            req.flash('error', 'Cannot find project with such id');
            return res.redirect('/');
        }
        if (project.name !== req.body.project_name || project.owner_id?.toString() !== req.user._id.toString()) {
            req.flash('error', 'Project cannot be deleted')
            return res.redirect('back');
        }
        if (project.status === 'Processing') {
            req.flash('error', 'Project cannot be deleted, because it is currently being processed');
            return res.redirect('back');
        }
        await QueueEntry.deleteOne({ project_id: project._id });
        await gfsDeleteProjectWithFiles(projectId);
        req.flash('success', 'Project deleted correctly');
        res.redirect('back');
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'deleteProject', req.user._id);
        req.flash('error', 'Cannot delete project');
        return res.redirect('/')
    }
}

const postUploadStructure = async (req, res) => {
    try {
        const projectId = req.body.project_id
        if (!mongoose.isValidObjectId(projectId)) {
            req.flash('error', 'Invalid project id');
            return res.redirect('/');
        }
        const project = await Project.findById(projectId);
        if (!project) {
            req.flash('error', 'There is no project with such id');
            return res.redirect('/home');
        }
        if (project.owner_id?.toString() !== req.user._id.toString()) {
            return res.redirect('/');
        }
        if (req.fileNotCorrect) {
            req.flash('error', req.errorMsg);
            await gfsDeleteFile(req.file.id);
            return res.redirect(`/project?id=${projectId}`);
        }
        const fileType = req.params.file_type;
        if (fileType !== 'structure') {
            await gfsDeleteFile(req.file.id);
            req.flash('error', 'Cannot upload nothing else than a structure file');
            return res.redirect(`/project?id=${projectId}`);
        }

        if (!req.file) {
            req.flash('error', 'No file choosen')
            return res.redirect(`/project?id=${projectId}`)
        }
        if (project.status !== 'Initial') {
            await gfsDeleteFile(req.file.id);
            req.flash('error', 'Cannot upload file when project status is not "Initial"');
            return res.redirect('/');
        }
        let fileToDelete = {
            exists: false
        }

        if (project.input.files[fileType]._doc.hasOwnProperty('filename') && !project.input.files[fileType]._doc.is_demo) {
            // deleting previous file
            fileToDelete.exists = true
            fileToDelete.id = project.input.files[fileType]._doc.file_id
        }
        
        project.input.files[fileType] = {
            file_id: req.file.id,
            filename: req.file.originalname,
            is_demo: false
        }

        await project.save();
        if (fileToDelete.exists) {
            await gfsDeleteFile(fileToDelete.id);
        }
        return res.redirect(`/project?id=${project._id}`)
        
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'postUploadStructure', req.user._id);
        req.flash('error', 'Cannot upload structure');
        return res.redirect('/')
    }
}

const postSelectDemo = async (req, res) => {
    try {
        const demoId = req.body.demo_id

        if (!mongoose.isValidObjectId(demoId)) {
            req.flash('error', 'Invalid example id');
            return res.redirect('/');
        }
        const projectId = req.body.project_id
        if (!mongoose.isValidObjectId(projectId)) {
            req.flash('error', 'Invalid project id');
            return res.redirect('/');
        }
        const project = await Project.findById(projectId);
        if (!project) {
            req.flash('error', 'There is no project with such id');
            return res.redirect('/home');
        }
        if (project.owner_id?.toString() !== req.user._id.toString()) {
            return res.redirect('/');
        }

        const demo = await DemoFile.findById(demoId)
        if (!demo) {
            req.flash('error', 'There is no example with such id');
            return res.redirect('/');
        }

        if (project.status !== 'Initial')
            return res.redirect('/')
        let fileToDelete = {
            exists: false
        }
        
        if (project.input.files?.structure?._doc?.hasOwnProperty('filename') && !project.input.files?.structure?._doc?.is_demo) {
            // deleting previous file
            fileToDelete.exists = true
            fileToDelete.id = project.input.files.structure._doc.file_id
        }

        project.input.files.structure = {
            file_id: demo.file_id,
            filename: demo.filename,
            is_demo: true
        }

        await project.save();

        if (fileToDelete.exists) {
            await gfsDeleteFile(fileToDelete.id);
        }
        return res.redirect(`/project?id=${project._id}`);
        
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'postSelectDemo', req.user._id);
        req.flash('error', 'Cannot select example');
        return res.redirect('/')
    }
}

const getDownloadFile = async (req, res, next) => {
    try {
        const projectId = req.params.project_id
        const fileType = req.params.file_type
        if (!mongoose.Types.ObjectId.isValid(projectId))
            return res.redirect('/');
        const project = await Project.findById(projectId);
        if (!project) {
            return res.redirect('/');
        }
        if (project.owner_id?.toString() !== req.user._id.toString()) {
            req.flash('error', 'Cannot find file');
            return res.redirect('/');
        }

        const inputFiles = ['structure'];
        const outputFiles = [
            'trajectory',
            'energy_potential', 
            'energy_temperature', 
            'energy_pressure', 
            'energy_density', 
            'md_xtc', 
            'md_edr', 
            'md_tpr', 
            'residues_indexes', 
            // 'simulation_logs', 
        ];
        if (!inputFiles.includes(fileType) && !outputFiles.includes(fileType)) {
            req.flash('error', 'Cannot find file');
            return res.redirect('/')
        }

        const _put = inputFiles.includes(fileType) ? 'input' : 'output'
        const fileToDownload = {
            exists: false
        }

        if (project[_put].files[fileType]._doc.hasOwnProperty('filename')) {
            fileToDownload.exists = true
            fileToDownload.id = project[_put].files[fileType]._doc.file_id
            fileToDownload.filename = project[_put].files[fileType]._doc.filename
        }

        if (fileToDownload.exists) {
            req.fileToDownloadId = fileToDownload.id
            res.attachment(fileToDownload.filename);
            return next();
        }
        req.flash('error', 'Cannot find file');
        return res.redirect('/');

    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getDownloadFile', req.user._id);
        req.flash('error', 'Error while downloading file');
        return res.redirect('/')
    }
}

const getMolstar = async (req, res) => {
    try {
        const fileType = req.query.filetype
        const projectId = req.query.project
        const project = await Project.findById(projectId)
        if (project.owner_id.toString() !== req.user._id.toString())
            return res.redirect('/')
        if (fileType !== 'structure' && fileType !== 'trajectory')
            return res.redirect('/')
        const _put = fileType === 'structure' ? 'input' : 'output'
        const fileToDisplay = {
            exists: false
        }
        if (project[_put].files[fileType]._doc.hasOwnProperty('filename')) {
            fileToDisplay.exists = true
            fileToDisplay.id = project[_put].files[fileType]._doc.file_id
            fileToDisplay.filename = project[_put].files[fileType]._doc.filename
        }
        if (!fileToDisplay.exists)
            return res.redirect('/')
        const structureUrl = `download/file/${projectId}/${fileType}`

        const params = {
            serverAddress,
            projectId,
            structureUrl,
            fileType,
            filename: fileToDisplay.filename,
            backRoute: `/project?id=${projectId}`,
        };
        res.render(`general/_molstar`, params);

    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getMolstar', req.user._id);
        req.flash('error', 'Failed to open Molstar');
        return res.redirect('/')
    }
}

const postSaveParameters = async (req, res) => {
    try {
        const projectId = req.body.project_id;
        const project = await Project.findById(projectId);
        if (!project) {
            return res.redirect('/');
        }
        if (project.status !== 'Initial') {
            return res.redirect('/');
        }
        if (project.owner_id.toString() !== req.user._id.toString()) {
            return res.redirect('/');
        }
        let ff_number = parseInt(req.body.force_field);
        if (ff_number >= 16) {
            return res.redirect('/');
        }
        let wm_number = parseInt(req.body.water_model);
        if ((ff_number <= 8 && wm_number >= 8) ||
            (ff_number >= 9 && ff_number <= 14 && wm_number >= 4) ||
            (ff_number === 15 && wm_number >= 9)) {
            return res.redirect('/');
        }
        project.input.extra = req.body;
        const error = await project.validateSync();
        if (error) {
            Object.entries(error.errors).forEach(([ label, { message } ]) => {
                req.flash('error', `Wrong ${ label }: ${ message }`)
            });
            return res.redirect(`/project?id=${projectId}`)
        } else {
            await project.save();
            if (req.body.request_simulation) {
                return submitSimulation(req, res);
            } else {
                req.flash('success', 'Project saved')
                return res.redirect(`/project?id=${projectId}`)
            }
        }
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'postSaveParameters', req.user._id);
        req.flash('error', 'Error while saving project parameters');
        return res.redirect('/')
    }
}

const submitSimulation = async (req, res) => {
    try {
        const projectId = req.body.project_id
        const project = await Project.findById(projectId)
        if (!project.input.files.structure.filename) {
            req.flash('error', 'Cannot request simulation with no structure file. You can find example structures here under "Molecular Structure" -> "Change file.." -> "Example" -> "Select"')
            return res.redirect(`/project?id=${projectId}`)
        }
        const now = Date.now();
        project.waiting_since = now;
        project.status = 'Waiting';
        
        // parameters validation

        let force_field = parseInt(project.input.extra.force_field);
        let water_model = parseInt(project.input.extra.water_model);
        let simulation_length = parseInt(project.input.extra.simulation_length);
        let saving_step = parseInt(project.input.extra.saving_step);
        let spheres_allocation_frame = parseInt(project.input.extra.spheres_allocation_frame);
        let rmsd_threshold = parseInt(project.input.extra.spheres_allocation_frame);

        if ((force_field <= 0 || force_field >= 16) ||
            (water_model <= 0 || water_model >= 9) ||
            (force_field <= 8 && water_model >= 8) ||
            (force_field >= 9 && force_field <= 14 && water_model >= 4) ||
            (force_field === 15 && water_model >= 9) ||
            (simulation_length < 0 || simulation_length > 15) ||
            (saving_step !== 2500 && saving_step !== 1250) ||
            (spheres_allocation_frame < 0) ||
            (rmsd_threshold < 0 || rmsd_threshold > 100) 
        ) {
            req.flash('error', 'Project parameters are wrong');
            return res.redirect(`/project?id=${projectId}`);
        }
        const error = await project.validateSync();

        if (error) {
            Object.entries(error.errors).forEach(([ label, { message } ]) => {
                req.flash('error', `Wrong ${ label }: ${ message }`)
            });
            return res.redirect(`/project?id=${projectId}`)
        }
        await project.save();
        
        const queueEntry = new QueueEntry({
            project_id: projectId,
            created: now,
        });

        await queueEntry.save();

        req.flash('success', 'Simulation requested successfully')
        return res.redirect(`/project?id=${projectId}`)
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'submitSimulation', req.user._id);
        req.flash('error', 'Error while submitting simulation');
        return res.redirect('/')
    }
}

const postNotifyUser = async (req, res) => {
    try {
        const projectId = req.body.project_id;
        const simulationStatus = req.body.sim_status;
        const project = await Project.findById(projectId);

        if (project.owner_id) {
            const user = await User.findById(project.owner_id)
            sendNotificationSimFinished(user.username, user.email, projectId, simulationStatus);
        } else if (project.guest_email) {
            sendNotificationGuestSimFinished(project.guest_email, projectId, simulationStatus);
        }

        return res.sendStatus(200);
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'postNotifyUser');
        res.sendStatus(500)
    }
}

module.exports = {
    getProjectsPage,
    getWaitingPage,
    getHistoryPage,
    getProfilePage,
    postEditProfile,
    deleteAccount,

    logout,
    postNewProject,
    getProject,
    getProjectResults,
    postEditDescription,
    deleteProject,
    postUploadStructure,
    postSelectDemo,

    getDownloadFile,
    getMolstar,

    postSaveParameters,

    postNotifyUser,
}

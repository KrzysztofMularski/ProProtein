const mongoose = require('mongoose')
const Project = require('../db/models/project')
const User = require('../db/models/user')
const DemoFile = require('../db/models/demoFile')
const TemplateFile = require('../db/models/templateFile')
const moment = require('moment')
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))
const serverAddress = process.env.SERVER_ADDRESS
const queueManagerUrl = process.env.QUEUE_MANAGER_ADDRESS
const { sendNotificationSimFinished } = require('../mailing')
const bcrypt = require('bcryptjs')

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

        let projects = await Project.find(dbQuery, 'name created status description _id')

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
                'Description',
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
        console.log(err)
        res.sendStatus(500)
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
        console.log(err)
    }
}

const postEditProfile = async (req, res) => {
    try {
        const userId = req.body.user_id
        const user = await User.findById(userId)

        if (
            (req.body.username.length >= 2 && req.body.username.length <= 40) &&
            (req.body.email.length >= 2 && req.body.email.length <= 100) &&
            (
                !req.body.changing_password ||
                (req.body.changing_password && req.body.password === req.body.password2)
            )
        ) {
            user.username = req.body.username
            user.email = req.body.email
            if (req.body.changing_password)
                user.hashedPassword = await bcrypt.hash(req.body.password, 10)
            await user.save()
            req.flash('success', 'Successfully saved new profile')
        } else 
            req.flash('error', 'Failed while editing profile')
        res.redirect('/profile')
        
    } catch (err) {
        console.log(err)
        req.flash('error', 'Failed while editing profile')
        res.sendStatus(500)
    }
}

const logout = (req, res) => {
    try {
        req.flash('success', 'Successfully signed out')
        req.logOut()
    } catch (err) {
        req.flash('error', 'Cannot sign out')
        console.log(err)
        res.sendStatus(500)
    }
    res.redirect('/')
}

const postNewProject = async (req, res) => {
    try {
        const route = req.body.route
        const buttonAction = req.body.new_project_button
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
        console.log(err)
        res.sendStatus(500)
    }
}

const getProject = async (req, res) => {
    try {
        const demos = await DemoFile.find()
        const templateFiles = await TemplateFile.find()
        const projectId = req.query.id
        if (!mongoose.isValidObjectId(projectId)) {
            req.flash('error', 'There is no project with such id')
            return res.redirect('/projects')
        }
        const project = await Project.findOne({ _id: projectId, owner_id: req.user._id })
        if (project) {
            const routeBack = '/projects?rowscount=5&page=1'

            const messages = req.flash()
            const errors = messages.error
            const successes = messages.success

            res.render('general/_project_details', {
                logged: true,
                selected: 'Projects',
                project,
                routeBack,
                demos,
                pdb2gmx_params: templateFiles.find(file => file.template_type === 'pdb2gmx_params').content,
                traj_params: templateFiles.find(file => file.template_type === 'traj_params').content,
                genion_params: templateFiles.find(file => file.template_type === 'genion_params').content,
                spheres_allocation_frame: '1',
                rmsd_threshold: '10',
                errors,
                successes
            })
        }
        else {
            req.flash('error', 'There is no project with such id')
            res.redirect('/home')
        }
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const postEditDescription = async (req, res) => {
    try {
        const projectId = req.body.project_id
        const projectDescription = req.body.project_description
        const project = await Project.findById(projectId)
        const rowscount = req.query.rowscount
        const page = req.query.page
        const route = req.body.route
        if (project.owner_id.toString() === req.user._id.toString()) {
            project.description = projectDescription
            await project.save()
            req.flash('success', "Project's description modified correctly")
        } else
            req.flash('error', "Project's description remains unmodified")
        res.redirect(`/${route}?rowscount=${rowscount}&page=${page}`)
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const deleteProject = async (req, res) => {
    try {
        const projectId = req.body.project_id
        const project = await Project.findById(projectId)
        const rowscount = req.query.rowscount
        const page = req.query.page
        const route = req.body.route
        if (project.status === 'Waiting')
            req.flash('error', 'Project cannot be deleted, beacuse of "Waiting" status')
        else if (project.status === 'Processing')
            req.flash('error', 'Project cannot be deleted, beacuse of "Processing" status')
        else if (project.name !== req.body.project_name && project.owner_id.toString() === req.user._id.toString()) {
            req.flash('error', 'Project cannot be deleted')
        } else {
            await Project.deleteOne({ _id: projectId })
            req.flash('success', 'Project deleted correctly')
        }
        res.redirect(`/${route}?rowscount=${rowscount}&page=${page}`)
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const postUploadStructure = async (req, res, next) => {
    try {
        const fileType = req.params.file_type
        const projectId = req.body.project_id
        const project = await Project.findById(projectId)
        if (project.owner_id.toString() !== req.user._id.toString())
            return res.redirect('/')
        if (project.status !== 'Initial')
            return res.redirect('/')
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

        await project.save()
        res.redirect(`/project?id=${project._id}`)
        if (fileToDelete.exists) {
            req.fileToDeleteId = fileToDelete.id
            next()
        }
        
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const postSelectDemo = async (req, res, next) => {
    try {
        const demoId = req.body.demo_id

        const projectId = req.body.project_id
        const project = await Project.findById(projectId)

        const demo = await DemoFile.findById(demoId)

        if (project.owner_id.toString() !== req.user._id.toString())
            return res.redirect('/')
        if (project.status !== 'Initial')
            return res.redirect('/')
        let fileToDelete = {
            exists: false
        }
        
        if (project.input.files.structure._doc.hasOwnProperty('filename') && !project.input.files.structure._doc.is_demo) {
            // deleting previous file
            fileToDelete.exists = true
            fileToDelete.id = project.input.files.structure._doc.file_id
        }

        project.input.files.structure = {
            file_id: demo.file_id,
            filename: demo.filename,
            is_demo: true
        }

        await project.save()

        res.redirect(`/project?id=${project._id}`)
        if (fileToDelete.exists) {
            req.fileToDeleteId = fileToDelete.id
            next()
        }
        
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const getDownloadFile = async (req, res, next) => {
    try {
        const projectId = req.params.project_id
        const fileType = req.params.file_type
        if (!mongoose.Types.ObjectId.isValid(projectId))
            return res.redirect('/')
        const inputFiles = ['structure', 'energy_min', 'MD_simulation']
        const outputFiles = ['trajectory', 'residues_indexes']
        if (!inputFiles.includes(fileType) && !outputFiles.includes(fileType))
            return res.redirect('/')

        const project = await Project.findById(projectId)
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
            next()
        }

    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const getMolstar = async (req, res, next) => {
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

        res.render(`general/_molstar`, { serverAddress, projectId, structureUrl, fileType, filename: fileToDisplay.filename })

    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const postSaveParameters = async (req, res, next) => {
    try {
        const projectId = req.body.project_id
        const project = await Project.findById(projectId)
        if (project.status !== 'Initial')
            return res.redirect('/')

        if (project.parameters_default === true && req.body.sim_parameters === 'default') {
            return res.redirect(`/project?id=${project._id}`)
        } else if (project.parameters_default === true && req.body.sim_parameters === 'advanced') {
            if (req.files.energy_min) {
                let file_energy_min = req.files.energy_min[0]
                if (file_energy_min.id) {
                    project.input.files.energy_min = {
                        file_id: file_energy_min.id,
                        filename: file_energy_min.filename
                    }
                }
            }
            
            if (req.files.MD_simulation) {
                let file_MD_simulation = req.files.MD_simulation[0]
                if (file_MD_simulation) {
                    project.input.files.MD_simulation = {
                        file_id: file_MD_simulation.id,
                        filename: file_MD_simulation.filename
                    }
                }
            }
            
            const gmx2pdb1 = parseInt(req.body.gmx2pdb1)
            let gmx2pdb2 = -1
            if (gmx2pdb1 >= 1 && gmx2pdb1 <= 8)
                gmx2pdb2 = req.body.gmx2pdb2_v1
            else if (gmx2pdb1 >= 9 && gmx2pdb1 <= 14)
                gmx2pdb2 = req.body.gmx2pdb2_v2
            else if (gmx2pdb1 === 15)
                gmx2pdb2 = req.body.gmxwpdb2_v3
            project.input.extra.pdb2gmx_params = `${req.body.gmx2pdb1},${gmx2pdb2}`
            project.input.extra.traj_params = req.body.group_for_output
            project.input.extra.genion_params = req.body.continuous_group_of_solvent_molecules
            project.input.extra.spheres_allocation_frame = req.body.spheres_allocation_frame
            project.input.extra.rmsd_threshold = req.body.rmsd_threshold
            project.parameters_default = false
            await project.save()
            return res.redirect(`/project?id=${project._id}`)
        } else if (project.parameters_default === false && req.body.sim_parameters === 'default') {
            const filesIdsToDelete = []
            if (project.input.files.energy_min.file_id) {
                filesIdsToDelete.push(project.input.files.energy_min.file_id)
                project.input.files.energy_min = {}
            }
            if (project.input.files.MD_simulation.file_id) {
                filesIdsToDelete.push(project.input.files.MD_simulation.file_id)
                project.input.files.MD_simulation = {}
            }
            project.input.extra.pdb2gmx_params = ''
            project.input.extra.traj_params = ''
            project.input.extra.genion_params = ''
            project.input.extra.spheres_allocation_frame = ''
            project.input.extra.rmsd_threshold = ''
            project.parameters_default = true
            await project.save()
            res.redirect(`/project?id=${project._id}`)
            req.filesIdsToDelete = filesIdsToDelete
            next()
        } else if (project.parameters_default === false && req.body.sim_parameters === 'advanced') {
            const filesIdsToDelete = []

            if (req.body.using_old_energy_min === 'false' && project.input.files.energy_min.file_id) {
                filesIdsToDelete.push(project.input.files.energy_min.file_id)
                let file_energy_min = req.files.energy_min[0]
                project.input.files.energy_min = {}
                if (file_energy_min.id) {
                    project.input.files.energy_min = {
                        file_id: file_energy_min.id,
                        filename: file_energy_min.filename
                    }
                }
            }
            
            if (req.body.using_old_MD_simulation === 'false' && project.input.files.MD_simulation.file_id) {
                filesIdsToDelete.push(project.input.files.MD_simulation.file_id)
                let file_MD_simulation = req.files.MD_simulation[0]
                project.input.files.MD_simulation = {}
                if (file_MD_simulation) {
                    project.input.files.MD_simulation = {
                        file_id: file_MD_simulation.id,
                        filename: file_MD_simulation.filename
                    }
                }
            }
            
            const gmx2pdb1 = parseInt(req.body.gmx2pdb1)
            let gmx2pdb2
            if (gmx2pdb1 >= 1 && gmx2pdb1 <= 8)
                gmx2pdb2 = req.body.gmx2pdb2_v1
            else if (gmx2pdb1 >= 9 && gmx2pdb1 <= 14)
                gmx2pdb2 = req.body.gmx2pdb2_v2
            else if (gmx2pdb1 === 15)
                gmx2pdb2 = req.body.gmxwpdb2_v3
            project.input.extra.pdb2gmx_params = `${req.body.gmx2pdb1},${gmx2pdb2}`
            project.input.extra.traj_params = req.body.group_for_output
            project.input.extra.genion_params = req.body.continuous_group_of_solvent_molecules
            project.input.extra.spheres_allocation_frame = req.body.spheres_allocation_frame
            project.input.extra.rmsd_threshold = req.body.rmsd_threshold
            await project.save()
            res.redirect(`/project?id=${project._id}`)
            req.filesIdsToDelete = filesIdsToDelete
            next()
        }
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const postSubmitSimulation = async (req, res) => {
    try {
        const projectId = req.body.project_id
        const project = await Project.findById(projectId)
        if (project.status !== 'Initial')
            return res.redirect('/')
        if (!project.input.files.structure.filename) {
            req.flash('error', 'Cannot request simulation with no structure file. You can find demo structures here under "Molecular Structure" -> "Change file.." -> "Select Demo" -> "Select"')
            return res.redirect(`/project?id=${projectId}`)
        }
        project.waiting_since = new Date()
        project.status = 'Waiting'
        await project.save()
        await fetch(queueManagerUrl, {
            method: 'POST',
            body: JSON.stringify({
                project_id: projectId
            }),
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            }
        })
        res.redirect('/projects')
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const postNotifyUser = async (req, res) => {
    try {
        const projectId = req.body.project_id
        const simulationStatus = req.body.sim_status
        const project = await Project.findById(projectId)
        const user = await User.findById(project.owner_id)
        sendNotificationSimFinished(user.username, user.email, projectId, simulationStatus)
        res.sendStatus(200)
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

module.exports = {
    getProjectsPage,
    getWaitingPage,
    getHistoryPage,
    getProfilePage,
    postEditProfile,

    logout,
    postNewProject,
    getProject,
    postEditDescription,
    deleteProject,
    postUploadStructure,
    postSelectDemo,

    getDownloadFile,
    getMolstar,

    postSaveParameters,
    postSubmitSimulation,

    postNotifyUser,
}
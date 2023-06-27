// const TemplateFile = require('../db/models/templateFile')
const DemoFile = require('../db/models/demoFile')
const Project = require('../db/models/project')
const QueueEntry = require('../db/models/queueEntry')
const pushLog = require('../logging')
const mongoose = require('mongoose')
const serverAddress = process.env.SERVER_ADDRESS;
const moment = require('moment');
const path = require('path');
const { sendGuestProjectIsWaiting } = require('../mailing');
const { gfsDeleteFile } = require('../gfs')

const getHomePage = (req, res) => {
    const messages = req.flash()
    const errors = messages.error
    const successes = messages.success
    res.render('general/_home', { logged: req.isAuthenticated(), selected: 'Home', errors, successes })
}

// const getDownloadTemplate = async (req, res, next) => {
//     try {
//         const templateType = req.params.template
//         const template = await TemplateFile.findOne({ template_type: templateType })
//         req.fileToDownloadId = template.file_id
//         res.attachment(templateType + '.mdp');
//         next()
//     } catch (err) {
//         // console.log(err)
//         await pushLog(err, 'getDownloadTemplate');
//         req.flash('error', 'Error while downloading template');
//         return res.redirect('/')
//     }
// }

const getDownloadDemo = async (req, res, next) => {
    try {
        const demoFilename = req.params.example;
        const demo = await DemoFile.findOne({ filename: demoFilename });
        if (!demo) {
            req.flash('error', `Example file: '${demoFilename}' does not exist`);
            return res.redirect('/');
        }
        req.fileToDownloadId = demo.file_id;
        res.attachment(demoFilename);
        next()
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getDownloadDemo');
        req.flash('error', 'Error while downloading example');
        return res.redirect('/')
    }
}

const getGuestSimulationPage = async (req, res) => {
    try {
        const messages = req.flash();
        const projectName = 'New project';
        const demos = (await DemoFile.find()).map(demo => ({
            _id: demo.file_id,
            filename: demo.filename
        }));
        const params = {
            logged: false,
            selected: '',
            projectName,
            demos,
            successes: messages.success,
            errors: messages.error,
        };

        res.render('general/_project_details_guest', params);
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getGuestSimulationPage');
        req.flash('error', 'Error while loading a page');
        return res.redirect('/')
    }
}

const postGuestSimulation = async (req, res) => {
    try {
        const is_demo = req.body.is_demo_radio === "demo";
        let newProjectId = null;
        const now = Date.now();
        if (is_demo) {
            const demo = await DemoFile.findOne({ filename: req.body.demo_filename });
            if (!demo) {
                req.flash('error', `Cannot find example with name: ${req.body.demo_filename}`);
                return res.redirect('/guest_simulation');
            }

            const newProject = new Project({
                name: 'Guest Project',
                status: 'Waiting',
                created: now,
                waiting_since: now,
                input: {
                    files: {
                        structure: { 
                            file_id: demo.file_id,
                            filename: demo.filename,
                            is_demo: true,
                        }
                    }
                }
            });
            await newProject.save();
            newProjectId = newProject._id;

        } else {
            if (!req.file) {
                return res.redirect('/guest_simulation');
            }
            if (req.fileNotCorrect) {
                req.flash('error', req.errorMsg);
                await gfsDeleteFile(req.file.id);
                return res.redirect('/guest_simulation');
            }
            const newProject = new Project({
                name: 'Guest Project',
                status: 'Waiting',
                created: now,
                waiting_since: now,
                input: {
                    files: {
                        structure: {
                            file_id: req.file.id,
                            filename: req.file.originalname,
                            is_demo: false,
                        }
                    }
                }
            });
            await newProject.save();
            newProjectId = newProject._id;
        }

        if (is_demo && req.file) {
            await gfsDeleteFile(req.file.id);
        }

        const queueEntry = new QueueEntry({
            project_id: newProjectId 
        });

        await queueEntry.save();
        req.flash('success', 'Simulation requested successfully');
        res.redirect(`/guest_simulation/${newProjectId.toString()}`);

    } catch (err) {
        // console.log(err)
        await pushLog(err, 'postGuestSimulation');
        req.flash('error', 'Error while posting guest simulation');
        return res.redirect('/')
    }
}

const getGuestProject = async (req, res) => {
    try {
        const messages = req.flash();

        const project_id = req.params.project_id;
        if (!mongoose.isValidObjectId(project_id)) {
            req.flash('error', 'Invalid project id');
            return res.redirect('/');
        }
        const project = await Project.findById(project_id);
        if (!project) {
            req.flash('error', 'There is no project with such id');
            return res.redirect('/home');
        }
        if (project.owner_id) {
            // have owner, cannot be guest project
            req.flash('error', 'There is no project with such id');
            return res.redirect('/home');
        }
        const params = {
            logged: false,
            selected: '',
            project,
            routeBack: '/',
            successes: messages.success,
            errors: messages.error,
            isGuest: true,
            projectUrl: path.join(serverAddress, 'guest_simulation', project_id),
            resultsUrl: path.join(serverAddress, 'guest_simulation/results', project_id),
        };
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
        const params_ro = {
            ...params,
            queuePosition: -1,
        }

        res.render('general/_project_details_read_only', params_ro);
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getGuestProject');
        req.flash('error', 'Error while getting guest project details');
        return res.redirect('/')
    }
}

const getGuestProjectResults = async (req, res) => {
    try {
        const projectId = req.params.project_id;
        if (!mongoose.isValidObjectId(projectId)) {
            req.flash('error', 'There is no project with such id')
            return res.redirect('/');
        }
        const project = await Project.findOne({ _id: projectId });

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
        const routeBack = `/guest_simulation/${projectId}`;
        const params = {
            logged: true,
            selected: 'Projects',
            project,
            routeBack,
            errors,
            successes,
            isGuest: true,
            downloadUrl: '/guest/download/file',
        };
        return res.render('general/_project_results', params);
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getGuestProjectResults');
        req.flash('error', 'Error while getting guest project results');
        return res.redirect('/')
    }
}

const getGuestDownloadFile = async (req, res, next) => {
    try {
        const projectId = req.params.project_id
        const fileType = req.params.file_type
        if (!mongoose.Types.ObjectId.isValid(projectId))
            return res.redirect('/')
        const project = await Project.findById(projectId);
        if (!project) {
            return res.redirect('/');
        }
        if (project.owner_id) {
            // project have an owner, cannot be guest project
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
        await pushLog(err, 'getGuestDownloadFile');
        req.flash('error', 'Error while downloading guest file');
        return res.redirect('/');
    }
}

const getMolstarGuest = async (req, res) => {
    try {
        const demoFilename = req.query.example_filename;
        const demo = await DemoFile.findOne({filename: demoFilename});

        if (!demo) {
            req.flash('error', 'Invalid example file name');
            return res.redirect('/guest_simulation');
        }

        const fileType = 'demo';
        const structureUrl = `download/example/${demoFilename}`;
        const params = {
            serverAddress,
            projectId: null,
            structureUrl,
            fileType,
            filename: demoFilename,
            backRoute: '/guest_simulation',
        };
        res.render(`general/_molstar`, params);

    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getMolstarGuest');
        req.flash('error', 'Failed to open Molstar');
        return res.redirect('/');
    }
}

const getMolstarGuestRequested = async (req, res) => {
    try {
        const fileType = req.query.filetype
        const projectId = req.query.project
        const project = await Project.findById(projectId)
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
        const structureUrl = `guest/download/file/${projectId}/${fileType}`

        const params = {
            serverAddress,
            projectId,
            structureUrl,
            fileType,
            filename: fileToDisplay.filename,
            backRoute: `/guest_simulation/${projectId}`,
        };
        res.render(`general/_molstar`, params);

    } catch (err) {
        // console.log(err)
        await pushLog(err, 'getMolstarGuestRequested');
        req.flash('error', 'Failed to open Molstar');
        return res.redirect('/')
    }
}

const postGuestEmail = async (req, res) => {
    try {
        const projectId = req.body.project_id;
        const email = req.body.email;

        if (!mongoose.isValidObjectId(projectId)) {
            req.flash('error', 'Invalid project id');
            return res.redirect('/');
        }
        const project = await Project.findById(projectId);
        if (!project) {
            req.flash('error', 'There is no project with such id');
            return res.redirect('/home');
        }
        if (project.status !== 'Waiting' && project.status !== 'Processing') {
            req.flash('error', `Project status must be "Waiting" or "Processing", not: "${project.status}"`);
            return res.redirect('back');
        }
        project.guest_email = email;
        await project.save();

        sendGuestProjectIsWaiting(email, projectId);

        req.flash('success', 'Email address successfully saved. Check your mailbox, we just sent you information regarding this simulation.');
        return res.redirect(`/guest_simulation/${projectId}`);
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'postGuestEmail', req.user?._id);
        req.flash('error', 'Failed to save your email for guest simulation');
        return res.redirect('/');
    }
}

const getQueue = async (req, res) => {
    try {
        const project_id = req.params.project_id;
        if (!project_id) {
            return res.redirect('/');
        }
        if (!mongoose.isValidObjectId(project_id)) {
            req.flash('error', 'Invalid project id');
            return res.redirect('/');
        }
        const project = await Project.findById(project_id);
        if (!project) {
            req.flash('error', 'There is no project with such id');
            return res.redirect('/');
        }

        let curEntry = await QueueEntry
            .findOne({ project_id: project._id })
            .populate({ path: "project_id", model: Project });

        if (!curEntry || !curEntry.project_id) {
            req.flash('error', 'This project is not requested to queue');
            return res.redirect('/');
        }

        const listLen = 10;

        let entries = await QueueEntry
            .find()
            .sort({created: 1})
            .limit(listLen)
            .populate({ path: "project_id", model: Project });

        const processingProjectsNumber = await Project.find({ "status": "Processing" }).count();
        const curProjectPos = await QueueEntry.find({ "created": { "$lte": curEntry.created }}).count() - processingProjectsNumber;

        entries = entries.map((entry, id) => { 
            let e_id = entry.project_id?._id?.toString();
            if (e_id) {
                return ({
                    id: id+1-processingProjectsNumber,
                    job_id: `${e_id.substring(0, 4)}...${e_id.substring(e_id.length-4)}`,
                    is_current: e_id === project._id.toString(),
                    status: entry.project_id.status,
                    waiting_since: moment(entry.project_id.waiting_since).format('lll'),
                    processing_since: entry.project_id.processing_since && moment(entry.project_id.processing_since).format('lll'),
                })
            } else {
                let e_id_new = new mongoose.Types.ObjectId().toString();
                return ({
                    id: id+1-processingProjectsNumber,
                    job_id: `${e_id_new.substring(0, 4)}...${e_id_new.substring(e_id_new.length-4)}`,
                    is_current: false,
                    status: 'Waiting',
                    waiting_since: moment(entry.created).format('lll'),
                    processing_since: null,
                })
            }
        });

        const entriesLen = await QueueEntry.count();

        let e_id = curEntry.project_id?._id?.toString();
        curEntry = {
            job_id: `${e_id.substring(0, 4)}...${e_id.substring(e_id.length-4)}`,
            is_current: true,
            status: curEntry.project_id.status,
            waiting_since: moment(curEntry.project_id.waiting_since).format('lll'),
            processing_since: curEntry.project_id.processing_since && moment(curEntry.project_id.processing_since).format('lll'),
        }

        let leftAfterCurrent = curProjectPos >= listLen - processingProjectsNumber ? entriesLen - curProjectPos - processingProjectsNumber : entriesLen - listLen;
        if (leftAfterCurrent < 0) {
            leftAfterCurrent = 0;
        }
        const messages = req.flash();
        const params = {
            logged: !!req.user,
            selected: '',
            entries,
            entriesLen,
            curEntry,
            curProjectPos,
            leftAfterCurrent,
            listLen,
            processingProjectsNumber,
            isCurProjectFar: curProjectPos > listLen - processingProjectsNumber,
            projectId: project._id.toString(),
            isGuestProject: !project.owner_id,
            successes: messages.success,
            errors: messages.error,
        }
        res.render('general/_queue', params); 
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'getQueue', req.user?._id);
        req.flash('error', 'Failed to load a queue');
        return res.redirect('/');
    }
}

const getQueueGeneral = async (req, res) => {
    try {

        const listLen = 10;

        let entries = await QueueEntry
            .find()
            .sort({created: 1})
            .limit(listLen)
            .populate({ path: "project_id", model: Project });

        const processingProjectsNumber = await Project.find({ "status": "Processing" }).count();

        entries = entries.map((entry, id) => { 
            let e_id = entry.project_id?._id?.toString();
            if (e_id) {
                return ({
                    id: id+1-processingProjectsNumber,
                    job_id: `${e_id.substring(0, 4)}...${e_id.substring(e_id.length-4)}`,
                    status: entry.project_id.status,
                    waiting_since: moment(entry.project_id.waiting_since).format('lll'),
                    processing_since: entry.project_id.processing_since && moment(entry.project_id.processing_since).format('lll'),
                })
            } else {
                let e_id_new = new mongoose.Types.ObjectId().toString();
                return ({
                    id: id+1-processingProjectsNumber,
                    job_id: `${e_id_new.substring(0, 4)}...${e_id_new.substring(e_id_new.length-4)}`,
                    status: 'Waiting',
                    waiting_since: moment(entry.created).format('lll'),
                    processing_since: null,
                })
            }
        });

        const entriesLen = await QueueEntry.count();
        let leftAfterAll = entriesLen - listLen;
        if (leftAfterAll < 0) {
            leftAfterAll = 0;
        }

        const messages = req.flash();
        const params = {
            logged: !!req.user,
            selected: '',
            entries,
            entriesLen,
            listLen,
            leftAfterAll,
            processingProjectsNumber,
            successes: messages.success,
            errors: messages.error,
        }
        res.render('general/_queue_general', params); 
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'getQueueGeneral', req.user?._id);
        req.flash('error', 'Failed to load a queue');
        return res.redirect('/');
    }
}

const getHelpPage = async (req, res) => {
    const messages = req.flash()
    const errors = messages.error
    const successes = messages.success
    res.render('general/_help', { logged: req.isAuthenticated(), selected: 'Help', errors, successes })
}

module.exports = {
    getHomePage,
    // getDownloadTemplate,
    getGuestSimulationPage,
    postGuestSimulation,
    getGuestProject,
    getGuestProjectResults,
    getGuestDownloadFile,
    getMolstarGuest,
    getMolstarGuestRequested,
    postGuestEmail,
    getDownloadDemo,
    getQueue,
    getQueueGeneral,
    getHelpPage,
}

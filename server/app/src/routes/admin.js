const mongoose = require('mongoose')
const Project = require('../db/models/project')
const User = require('../db/models/user')
const FileRaw = require('../db/models/fileRaw')
const FileTemplateRaw = require('../db/models/fileTemplateRaw')
const DemoFile = require('../db/models/demoFile')
const TemplateFile = require('../db/models/templateFile')
const moment = require('moment')
const bcrypt = require('bcryptjs')
const Log = require('../db/models/log')
const SuperAdmin = require('../db/models/admin')
const pushLog = require('../logging')

const getAdminPage = async (req, res) => {
    try {
        const messages = req.flash();
        const params = {
            selected: 'dashboard',
            errors: messages.error,
            successes: messages.success,
            usersCount: await User.count(),
            projectsCount: await Project.count(),
            filesCount: await FileRaw.count() + await FileTemplateRaw.count(),
            logsCount: await Log.count(),
        }

        res.render('general/admin/admin', params);
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'getAdminPage');
        req.flash('error', 'Error');
        return res.redirect('/');
    }
}

const getAdminUsersPage = async (req, res) => {
    try {
        const messages = req.flash();
        let users = await User.find();
        let projects = await Project.find();
        const projectStatuses = {
            Initial: 0,
            Waiting: 1,
            Processing: 2,
            Finished: 3,
            Error: 4,
        };

        const usersProjects = {};

        projects.forEach(project => {
            if (usersProjects[project.owner_id] === undefined)
                usersProjects[project.owner_id.toString()] = [0, 0, 0, 0, 0];
            usersProjects[project.owner_id.toString()][projectStatuses[project.status]]++;
        })
        
        const headersInfo = [
            ['ID', 'string', 4],
            ['Email', 'string', 4],
            ['Username', 'string', 4],
            ['Account Verified', 'bool', 1],
            ['Is Admin', 'bool', 1],
            ['Created At', 'string', 4],
            ['Projects [I-W-P-F-E]', 'string', 4],
        ];

        const tableHeaders = headersInfo.map(e => e[0]);
        const tableHeadersTypes = headersInfo.map(e => e[1]);
        const tableColumnSizes = headersInfo.map(e => e[2]);

        const tables = [{
            detailsRoute: '/admin/users',
            downloadRoute: '',
            tableHeaders,
            tableHeadersTypes,
            tableColumnSizes,
            showDetailsButton: true,
            showDownloadButton: false,
            tableContent: users.map(user => [
                user._id,
                user.email,
                user.username,
                user.accountVerified,
                user.isAdmin,
                moment(user.created).format('ll'),
                usersProjects[user._id.toString()] ? usersProjects[user._id.toString()].join('-') : '0-0-0-0-0',
            ])
        }];

        const params = {
            selected: 'users',
            errors: messages.error,
            successes: messages.success,
            tables,
            renderingAllTablesAtOnce: true
        };

        res.render('general/admin/users', params);
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'getAdminUsersPage');
        req.flash('error', 'Error');
        return res.redirect('/admin');
    }
}

const getAdminUserDetailsPage = async (req, res) => {
    try {
        const messages = req.flash();
        const user_id = req.params.user_id;
        if (!mongoose.Types.ObjectId.isValid(user_id)) {
            req.flash('error', `No user found with such ID: ${user_id}`);
            return res.redirect('/admin/users');
        }
        const user = await User.findById(user_id);
        if (!user) {
            req.flash('error', `No user found with such ID: ${user_id}`);
            return res.redirect('/admin/users');
        }

        const projects = await Project.find({ owner_id: user_id });

        const headersInfo = [
            ['ID', 'string', 4],
            ['Name', 'string', 4],
            ['Status', 'status', 4],
            ['Created At', 'string', 4],
        ];

        const statusColors = {
            'Initial': 'green',
            'Waiting': 'blue',
            'Processing': 'purple',
            'Finished': 'gray',
            'Error': 'red',
        };

        const tableHeaders = headersInfo.map(e => e[0]);
        const tableHeadersTypes = headersInfo.map(e => e[1]);
        const tableColumnSizes = headersInfo.map(e => e[2]);

        const tables = [{
            tableName: 'Projects',
            detailsRoute: '/admin/projects',
            downloadRoute: '',
            tableHeaders,
            tableHeadersTypes,
            tableColumnSizes,
            statusColors,
            showDetailsButton: true,
            showDownloadButton: false,
            tableContent: projects.map(project => [
                project._id,
                project.name,
                project.status,
                moment(project.created).format('ll'),
            ])
        }]

        user.createdStr = moment(user.created).format('ll');
        user.dateInput = moment(user.created).format('YYYY-MM-DD');

        const params = {
            selected: 'users',
            errors: messages.error,
            successes: messages.success,
            user,
            tables,
            renderingAllTablesAtOnce: true
        }

        res.render('general/admin/userDetails', params);

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'getAdminUserDetailsPage', req.params.user_id);
        req.flash('error', 'Error');
        return res.redirect('/admin/users');
    }
}

const postAdminUserEdit = async (req, res) => {
    try {
        const user_id = req.params.user_id;
        if (!mongoose.Types.ObjectId.isValid(user_id)) {
            req.flash('error', `No user found with such ID: ${user_id}`);
            return res.redirect('/admin/users');
        }
        const user = await User.findById(user_id);
        if (!user) {
            req.flash('error', `No user found with such ID: ${user_id}`);
            return res.redirect('/admin/users');
        }

        if (user.email !== req.body.email) {
            const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
            if (!emailRegex.test(req.body.email)) {
                req.flash('error', `Email (${req.body.email}) don't match reg ex`);
                return res.redirect(`/admin/users/${user_id}`);
            }
            if (await User.exists({ email: req.body.email })) {
                req.flash('error', `Email is already taken`);
                return res.redirect(`/admin/users/${user_id}`);
            }
            user.email = req.body.email;
        }

        if (user.username !== req.body.username) {
            user.username = req.body.username;
        }

        if (req.body.accountVerified) {
            if (!user.accountVerified) {
                user.accountVerified = true
            }
        } else {
            if (user.accountVerified) {
                user.accountVerified = false
            }
        }

        const isSuperAdmin = await SuperAdmin.exists({ user_id: user._id.toString() });
        if (!isSuperAdmin) {
            if (req.body.isAdmin) {
                if (!user.isAdmin) {
                    user.isAdmin = true
                }
            } else {
                if (user.isAdmin) {
                    user.isAdmin = false
                }
            }
        } else {
            await pushLog('Attempt to change isAdmin on super admin', 'postAdminUserEdit', req.user._id.toString());
            req.flash('error', 'Cannot remove this admin.');
        }

        if (user.created !== req.body.created) {
            user.created = req.body.created;
        }

        if (req.body.changingPassword) {
            if (req.body.password.length < 6) {
                req.flash('error', 'Password is too short (min 6 characters)');
                return res.redirect(`/admin/users/${user_id}`);
            }
            user.hashedPassword = await bcrypt.hash(req.body.password, 10);
        }

        const error = await user.validateSync();

        if (error) {
            Object.entries(error.errors).forEach(([ label, { message } ]) => {
                req.flash('error', `Wrong ${ label }: ${ message }`)
            });
            return res.redirect(`/admin/users/${user_id}`);
        } else {
            await user.save();
            req.flash('success', `User profile successfully updated`);
            return res.redirect(`/admin/users/${user_id}`);
        }

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'postAdminUserEdit', req.params.user_id);
        req.flash('error', 'Error');
        return res.redirect('/admin/users');
    }
}

const deleteAdminUserAccount = async (req, res) => {
    try {
        const user_id = req.params.user_id;
        if (!mongoose.Types.ObjectId.isValid(user_id)) {
            req.flash('error', `No user found with such ID: ${user_id}`);
            return res.redirect('/admin/users');
        }
        const user = await User.findById(user_id);
        if (!user) {
            req.flash('error', `No user found with such ID: ${user_id}`);
            return res.redirect('/admin/users');
        }
        const superAdmins = (await SuperAdmin.find({ user_id })).map(sa => sa.user_id.toString());
        if (superAdmins.includes(user_id)) {
            req.flash('error', 'You cannot delete this account');
            await pushLog('Attempt to delete super admin', 'deleteAdminUserAccount', req.user._id);
            return res.redirect(`/admin/users/${user_id}`);
        }
        const projects = await Project.find({ owner_id: user._id.toString() });
        if (projects.length === 0) {
            await user.delete();
            req.flash('success', 'Successfully deleted an account');
            return res.redirect('/admin/users');
        } else {
            req.flash('error', 'Cannot delete this account because it contains some projects');
            return res.redirect(`/admin/users/${user_id}`);
        }
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'deleteAdminUserAccount', req.params.user_id);
        req.flash('error', 'Error while deleting user account');
        return res.redirect('/admin/users')
    }
}

const getAdminProjectsPage = async (req, res) => {
    try {
        const messages = req.flash();

        let projects = await Project.find();

        const headersInfo = [
            ['ID', 'string', 4],
            ['Owner ID', 'link_0', 4],
            ['Name', 'string', 4],
            ['Status', 'status', 4],
            ['Created At', 'string', 4],
        ];

        const statusColors = {
            'Initial': 'green',
            'Waiting': 'blue',
            'Processing': 'purple',
            'Finished': 'gray',
            'Error': 'red',
        };

        const links = [
            '/admin/users',
        ];

        const tableHeaders = headersInfo.map(e => e[0]);
        const tableHeadersTypes = headersInfo.map(e => e[1]);
        const tableColumnSizes = headersInfo.map(e => e[2]);

        const tables = [{
            detailsRoute: '/admin/projects',
            downloadRoute: '',
            tableHeaders,
            tableHeadersTypes,
            tableColumnSizes,
            links,
            statusColors,
            showDetailsButton: true,
            showDownloadButton: false,
            tableContent: projects.map(project => [
                project._id,
                project.owner_id,
                project.name,
                project.status,
                moment(project.created).format('ll'),
            ])
        }]

        const params = {
            selected: 'projects',
            errors: messages.error,
            successes: messages.success,
            tables,
            renderingAllTablesAtOnce: true
        }
        res.render('general/admin/projects', params);
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'getAdminProjectsPage');
        req.flash('error', 'Error');
        return res.redirect('/admin');
    }
}

const getAdminProjectDetailsPage = async (req, res) => {
    try {
        const messages = req.flash();
        const project_id = req.params.project_id;
        if (!mongoose.Types.ObjectId.isValid(project_id)) {
            req.flash('error', `No project found with such ID: ${project_id}`);
            return res.redirect('/admin/projects');
        }
        const project = await Project.findById(project_id);
        if (!project) {
            req.flash('error', `No project found with such ID: ${project_id}`);
            return res.redirect('/admin/projects');
        }

        req.params.owner_id = project.owner_id;

        let headersInfo = [
            ['ID', 'string', 4],
            ['File Type', 'string', 4],
            ['Filename', 'string', 4],
            ['Is Specified', 'bool', 4],
            ['Is Demo', 'bool', 4],
        ];

        let tableHeaders = headersInfo.map(e => e[0]);
        let tableHeadersTypes = headersInfo.map(e => e[1]);
        let tableColumnSizes = headersInfo.map(e => e[2]);

        const inputFileTypes = [
            'structure',
            'energy_min',
            'MD_simulation',
        ];

        const tables = [];

        tables.push({
            tableName: 'Input files',
            detailsRoute: '',
            downloadRoute: '/admin/download',
            tableHeaders,
            tableHeadersTypes,
            tableColumnSizes,
            showDetailsButton: false,
            showDownloadButton: true,
            tableContent: inputFileTypes.map(inputFileType => [
                project.input.files[inputFileType].file_id,
                inputFileType,
                project.input.files[inputFileType].filename,
                !!project.input.files[inputFileType].file_id,
                project.input.files[inputFileType].is_demo,
            ])
        });

        headersInfo = [
            ['Parameter Type', 'string', 4],
            ['Value', 'string', 2],
            ['Is Specified', 'bool', 2],
        ];

        tableHeaders = headersInfo.map(e => e[0]);
        tableHeadersTypes = headersInfo.map(e => e[1]);
        tableColumnSizes = headersInfo.map(e => e[2]);

        const parameterTypes = [
            'pdb2gmx_params',
            'traj_params',
            'genion_params',
            'spheres_allocation_frame',
            'rmsd_threshold',
        ]

        tables.push({
            tableName: 'Input parameters',
            detailsRoute: '',
            downloadRoute: '',
            tableHeaders,
            tableHeadersTypes,
            tableColumnSizes,
            showDetailsButton: false,
            showDownloadButton: false,
            tableLength: 0.6,
            tableContent: parameterTypes.map(parameterType => [
                parameterType,
                project.input.extra[parameterType],
                !!project.input.extra[parameterType]
            ]),
        });

        headersInfo = [
            ['ID', 'string', 4],
            ['File Type', 'string', 4],
            ['Filename', 'string', 4],
            ['Is Specified', 'bool', 2],
        ];

        tableHeaders = headersInfo.map(e => e[0]);
        tableHeadersTypes = headersInfo.map(e => e[1]);
        tableColumnSizes = headersInfo.map(e => e[2]);

        const outputFileTypes = [
            'trajectory',
            'residues_indexes',
        ]

        tables.push({
            tableName: 'Output files',
            detailsRoute: '',
            downloadRoute: '/admin/download',
            tableHeaders,
            tableHeadersTypes,
            tableColumnSizes,
            showDetailsButton: false,
            showDownloadButton: true,
            tableLength: 0.6,
            tableContent: outputFileTypes.map(outputFileType => [
                project.output.files[outputFileType].file_id,
                outputFileType,
                project.output.files[outputFileType].filename,
                !!project.output.files[outputFileType].file_id,
            ])
        });

        const statusColors = {
            'Initial': 'green',
            'Waiting': 'blue',
            'Processing': 'purple',
            'Finished': 'gray',
            'Error': 'red',
        };

        project.statusColor = statusColors[project.status];
        

        project.dateInput = project.created ? moment(project.created).format('YYYY-MM-DD') : '';
        project.dateInputWaitingSince = project.waiting_since ? moment(project.waiting_since).format('YYYY-MM-DD') : '';
        project.dateInputProcessingSince = project.processing_since ? moment(project.processing_since).format('YYYY-MM-DD') : '';
        project.dateInputFinishedSince = project.finished_since ? moment(project.finished_since).format('YYYY-MM-DD') : '';

        project.dateInputTime = project.created ? moment(project.created).format('hh:mm:ss') : '';
        project.dateInputWaitingSinceTime = project.waiting_since ? moment(project.waiting_since).format('hh:mm:ss') : '';
        project.dateInputProcessingSinceTime = project.processing_since ? moment(project.processing_since).format('hh:mm:ss') : '';
        project.dateInputFinishedSinceTime = project.finished_since ? moment(project.finished_since).format('hh:mm:ss') : '';

        project.createdStr = project.created ? moment(project.created).format('lll') : '';
        project.waiting_since_str = project.waiting_since ? moment(project.waiting_since).format('lll') : '';
        project.processing_since_str = project.processing_since ? moment(project.processing_since).format('lll') : '';
        project.finished_since_str = project.finished_since ? moment(project.finished_since).format('lll') : '';
        
        const demos = (await DemoFile.find()).map(demo => ({
            file_id: demo.file_id,
            filename: demo.filename
        }));

        const file_types_groups = [
            inputFileTypes,
            outputFileTypes,
        ];

        const params = {
            selected: 'projects',
            errors: messages.error,
            successes: messages.success,
            project,
            tables,
            demos,
            parameterTypes,
            file_types_groups,
            renderingAllTablesAtOnce: true
        };

        res.render('general/admin/projectDetails', params);

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'getAdminProjectDetailsPage', req.params.owner_id);
        req.flash('error', 'Error');
        return res.redirect('/admin/projects');
    }
}

const postAdminProjectEdit = async (req, res) => {
    try {
        const project_id = req.params.project_id;
        if (!mongoose.Types.ObjectId.isValid(project_id)) {
            req.flash('error', `No project found with such ID: ${project_id}`);
            return res.redirect(`/admin/projects`);
        }

        let project = await Project.findById(project_id);
        if (!project) {
            req.flash('error', `No project found with such ID: ${project_id}`);
            return res.redirect(`/admin/projects`);
        }

        const body = req.body;
        
        if (body.owner_id) {
            if (!mongoose.Types.ObjectId.isValid(body.owner_id)) {
                req.flash('error', `No user found with such ID: ${body.owner_id}`);
                return res.redirect(`/admin/projects/${project_id}`);
            }
            if (!await User.exists({ _id: body.owner_id })) {
                req.flash('error', `No user found with such ID: ${body.owner_id}`);
                return res.redirect(`/admin/projects/${project_id}`);
            }
            project.owner_id = mongoose.Types.ObjectId(body.owner_id);
        }

        project.name = body.name;
        project.status = body.status;
        project.description = body.description;

        const dates = [
            ['created', 'created_time'],
            ['waiting_since', 'waiting_since_time'],
            ['processing_since', 'processing_since_time'],
            ['finished_since', 'finished_since_time'],
        ];
        dates.forEach(([date, time]) => {
            if (body[date]) {
                let dateStr = body[date];
                if (body[time]) {
                    dateStr += 'T' + body[time]
                }
                project[date] = dateStr;
            } else {
                project[date] = undefined;
            }
        });        
        
        const error = await project.validateSync();

        if (error) {
            Object.entries(error.errors).forEach(([ label, { message } ]) => {
                req.flash('error', `Wrong ${ label }: ${ message }`)
            });
            return res.redirect(`/admin/projects/${project_id}`);
        } else {
            await project.save();
            req.flash('success', `Project details successfully updated`);
            return res.redirect(`/admin/projects/${project_id}`);
        }

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'postAdminProjectEdit');
        req.flash('error', 'Error');
        return res.redirect(`/admin/projects/${req.params.project_id}`);
    }
}

const postAdminProjectEditFiles = async (req, res, next) => {
    try {
        const project_id = req.params.project_id;
        if (!mongoose.Types.ObjectId.isValid(project_id)) {
            req.flash('error', `No project found with such ID: ${project_id}`);
            return res.redirect(`/admin/projects`);
        }

        let project = await Project.findById(project_id);
        if (!project) {
            req.flash('error', `No project found with such ID: ${project_id}`);
            return res.redirect(`/admin/projects`);
        }

        const body = req.body;

        const demos = await DemoFile.find();
        const demosIDs = demos.map(demo => demo.file_id.toString());
        const templates = (await TemplateFile.find()).filter(template => template.file_id);;
        const templatesIDs = templates.map(template => template.file_id.toString());
        const dtIDs = [...demosIDs, ...templatesIDs];

        const files_to_delete = [];

        const file_types_map = {
            'structure': 'input',
            'energy_min': 'input',
            'MD_simulation': 'input',
            'trajectory': 'output',
            'residues_indexes': 'output'
        }

        Object.entries(file_types_map).forEach(async ([file_type, _put]) => {
            if (body[file_type] && body[`${file_type}_option`]) {
                const option = body[`${file_type}_option`];
                if (option === 'delete' || option === 'demo' || (option === 'file' && req.files[`${file_type}_file`].length === 1)) {
                    const current_file_id = project[_put].files[file_type]?.file_id?.toString();
                    if (current_file_id) {
                        if (!dtIDs.includes(current_file_id)) {
                            files_to_delete.push(current_file_id);
                        }
                        project[_put].files[file_type] = {};
                    }
                    if (option === 'demo') {
                        if (file_type !== 'structure') {
                            req.flash('error', 'Error');
                            await pushLog('Using demos for non structure files', 'postAdminProjectEditFiles', req.user._id);
                            return res.redirect(`/admin/projects/${project_id}`);
                        }
                        const demo_id = body.structure_select;
                        if (demosIDs.includes(demo_id)) {
                            const demo = demos.find(demo => demo.file_id.toString() === demo_id);
                            project.input.files.structure = {
                                file_id: mongoose.Types.ObjectId(demo_id),
                                filename: demo.filename,
                                is_demo: true,
                            };
                        }
                    } else if (option === 'file') {
                        const file = req.files[`${file_type}_file`][0];
                        project[_put].files[file_type] = {
                            file_id: file.id,
                            filename: file.filename,
                        };
                        if (file_type === 'structure') {
                            project.input.files.structure.is_demo = false;
                        }
                    }
                } else if (option === 'unlink') {
                    project[_put].files[file_type] = {};
                }
            }
        });

        const error = await project.validateSync();

        if (error) {
            Object.entries(error.errors).forEach(([ label, { message } ]) => {
                req.flash('error', `Wrong ${ label }: ${ message }`)
            });
            return res.redirect(`/admin/projects/${project_id}`);
        } else {
            await project.save();
            req.params.files_to_delete = files_to_delete;
            req.params.only_updating_files = true;
            return next();
        }

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'postAdminProjectEditFiles', req.user._id);
        req.flash('error', 'Error');
        return res.redirect(`/admin/projects/${req.params.project_id}`);
    }
}

const postAdminProjectEditParameters = async (req, res) => {
    try {
        const project_id = req.params.project_id;

        if (!mongoose.Types.ObjectId.isValid(project_id)) {
            req.flash('error', `No project found with such ID: ${project_id}`);
            return res.redirect(`/admin/projects`);
        }

        let project = await Project.findById(project_id);
        if (!project) {
            req.flash('error', `No project found with such ID: ${project_id}`);
            return res.redirect(`/admin/projects`);
        }

        Object.entries(req.body).forEach(([key, value]) => {
            project.input.extra[key] = value;
        })

        const error = await project.validateSync();

        if (error) {
            Object.entries(error.errors).forEach(([ label, { message } ]) => {
                req.flash('error', `Wrong ${ label }: ${ message }`)
            });
            return res.redirect(`/admin/projects/${project_id}`);
        } else {
            await project.save();
            req.flash('success', `Project details successfully updated`);
            return res.redirect(`/admin/projects/${project_id}`);
        }

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'postAdminProjectEditParameters', req.user._id);
        req.flash('error', 'Error');
        return res.redirect(`/admin/projects/${req.params.project_id}`)
    }
}

const deleteAdminProject = async (req, res, next) => {
    try {

        const project_id = req.params.project_id;

        if (!mongoose.Types.ObjectId.isValid(project_id)) {
            req.flash('error', `No project found with such ID: ${project_id}`);
            return res.redirect(`/admin/projects`);
        }

        const project = await Project.findById(project_id);

        if (!project) {
            req.flash('error', `No project found with such ID: ${project_id}`);
            return res.redirect(`/admin/projects`);
        }

        const demos = await DemoFile.find();
        const demosIDs = demos.map(demo => demo.file_id.toString());
        const templates = (await TemplateFile.find()).filter(template => template.file_id);;
        const templatesIDs = templates.map(template => template.file_id.toString());
        
        let fileIds = [
            project.input.files.structure?.file_id?.toString(),
            project.input.files.energy_min?.file_id?.toString(),
            project.input.files.MD_simulation?.file_id?.toString(),
            project.output.files.trajectory?.file_id?.toString(),
            project.output.files.residues_indexes?.file_id?.toString()
        ];

        fileIds = fileIds.filter(fileId => fileId !== undefined && ![...demosIDs, ...templatesIDs].includes(fileId));

        await project.remove();

        if (fileIds.length > 0) {
            req.params.files_to_delete = fileIds;
            return next();
        }

        req.flash('success', 'Successfully deleted a project');
        return res.redirect(`/admin/projects`);

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'deleteAdminProject');
        req.flash('error', 'Error');
        return res.redirect(`/admin/projects`);
    }
}

const getAdminFilesPage = async (req, res) => {
    try {
        const messages = req.flash();

        const demos = await DemoFile.find();
        const demosIDs = demos.map(demo => demo.file_id.toString());
        let templates = await TemplateFile.find();
        templates = templates.filter(template => template.file_id);
        const templatesIDs = templates.map(template => template.file_id.toString());
        let files = await FileRaw.find();
        files = files.filter(file => !demosIDs.includes(file._id.toString()));        

        const projects = await Project.find();

        let projectsFilesMap = projects.map(project => {

            let fileIds = [
                project.input.files.structure?.file_id?.toString(),
                project.input.files.energy_min?.file_id?.toString(),
                project.input.files.MD_simulation?.file_id?.toString(),
                project.output.files.trajectory?.file_id?.toString(),
                project.output.files.residues_indexes?.file_id?.toString()
            ];
            fileIds = fileIds.filter(fileId => fileId !== undefined && ![...demosIDs, ...templatesIDs].includes(fileId));

            return [
                project._id.toString(),
                fileIds
            ]
        });

        projectsFilesMap = projectsFilesMap.filter(arr => arr[1].length);

        const filesProjectsMap = {};

        projectsFilesMap.forEach(e => e[1].forEach(ee => filesProjectsMap[ee] = e[0] ));
        
        const headersInfo = [
            ['ID', 'string', 4],
            ['Filename', 'string', 4],
            ['Length', 'string', 3],
            ['Upload Time', 'string', 3],
            ['Content Type', 'string', 4],
            ['Project ID', 'link_0', 2],
        ];

        const links = [
            '/admin/projects',
        ];

        const tableHeaders = headersInfo.map(e => e[0]);
        const tableHeadersTypes = headersInfo.map(e => e[1]);
        const tableColumnSizes = headersInfo.map(e => e[2]);

        const tables = [{
            downloadRoute: '/admin/download',
            deleteRoute: '/admin/files/delete',
            afterDeleteRoute: '/admin/files',
            showDetailsButton: false,
            showDownloadButton: true,
            showDeleteButton: true,
            tableHeaders,
            tableHeadersTypes,
            tableColumnSizes,
            links,
            tableContent: files.map(file => {
                let projectId = filesProjectsMap[file._id.toString()];
                if (!projectId)
                    projectId = 'no owner'
                return [
                    file._id,
                    file.filename,
                    file.length,
                    moment(file.uploadDate).format('ll'),
                    file.contentType,
                    projectId
                ]
            })
        }]

        const params = {
            selected: 'files',
            selectedTab: '',
            errors: messages.error,
            successes: messages.success,
            tables,
            renderingAllTablesAtOnce: true
        }
        res.render('general/admin/files', params);

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'getAdminFilesPage');
        req.flash('error', 'Error');
        return res.redirect('/admin');
    }
}

const deleteAdminFile = async (req, res, next) => {
    try {
        const file_id = req.params.file_id;
        if (!mongoose.Types.ObjectId.isValid(file_id)) {
            req.flash('error', `No file found with such ID: ${file_id}`);
            return res.redirect('/admin/files');
        }
        const file = await FileRaw.findById(file_id);

        if (!file) {
            req.flash('error', `No file found with such ID: ${file_id}`);
            return res.redirect('/admin/files');
        }

        const isDemo = await DemoFile.exists({ file_id });

        if (isDemo) {
            req.flash('error', `Cannot delete demo file`);
            return res.redirect('/admin/files');
        }

        // checking if file is beeing used
        const projects = await Project.find();

        let projectsFilesMap = projects.map(project => {

            let fileIds = [
                project.input.files.structure?.file_id?.toString(),
                project.input.files.energy_min?.file_id?.toString(),
                project.input.files.MD_simulation?.file_id?.toString(),
                project.output.files.trajectory?.file_id?.toString(),
                project.output.files.residues_indexes?.file_id?.toString()
            ];
            fileIds = fileIds.filter(fileId => fileId !== undefined);

            return [
                project._id.toString(),
                fileIds
            ]
        });

        projectsFilesMap = projectsFilesMap.filter(arr => arr[1].length);

        const usedFilesIds = projectsFilesMap.map(e => e[1]).flat();
        
        if (!usedFilesIds.includes(file_id)) {
            // can delete file because no one owns it
            req.params.file_bucket = 'files';
            return next();
        } else {
            req.flash('error', 'A file in use cannot be deleted');
            return res.redirect('/admin/files');
        }

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'deleteAdminFile');
        req.flash('error', 'Error');
        return res.redirect('/admin/files');
    }
}

const postAdminFileUpload = async (req, res) => {
    try {
        // const file_id = mongoose.Types.ObjectId(req.file.id);

        // function doing nothing, left for future improvements
        
        return res.redirect('/admin/files');
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'postAdminFileUpload');
        req.flash('error', 'Error');
        return res.redirect('/admin/files');
    }
}

const getAdminFilesDemosPage = async (req, res) => {
    try {
        const messages = req.flash();

        const demos = await DemoFile.find();
        const demosIDs = demos.map(demo => demo.file_id.toString());
        const files = await FileRaw.find({ _id: demosIDs })

        const headersInfo = [
            ['ID', 'string', 4],
            ['Filename', 'string', 4],
            ['Length', 'string', 3],
            ['Upload Time', 'string', 3],
            ['Content Type', 'string', 4],
        ];

        const tableHeaders = headersInfo.map(e => e[0]);
        const tableHeadersTypes = headersInfo.map(e => e[1]);
        const tableColumnSizes = headersInfo.map(e => e[2]);

        const tables = [{
            downloadRoute: '/admin/download',
            deleteRoute: '/admin/files/demos/delete',
            afterDeleteRoute: '/admin/files/demos',
            showDetailsButton: false,
            showDownloadButton: true,
            showDeleteButton: true,
            tableHeaders,
            tableHeadersTypes,
            tableColumnSizes,
            tableContent: files.map(file => [
                file._id,
                file.filename,
                file.length,
                moment(file.uploadDate).format('ll'),
                file.contentType,
            ])
        }]

        const params = {
            selected: 'files',
            selectedTab: 'demos',
            errors: messages.error,
            successes: messages.success,
            tables,
            renderingAllTablesAtOnce: true
        };

        res.render('general/admin/files', params);

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'getAdminFilesDemosPage');
        req.flash('error', 'Error');
        return res.redirect('/admin/files');
    }
}

const deleteAdminDemoFile = async (req, res, next) => {
    try {
        const file_id = req.params.file_id;
        if (!mongoose.Types.ObjectId.isValid(file_id)) {
            req.flash('error', `No file found with such ID: ${file_id}`);
            return res.redirect('/admin/files/demos');
        }

        const demo = await DemoFile.findOne({ file_id });

        if (!demo) {
            req.flash('error', `No file found with such ID: ${file_id}`);
            return res.redirect('/admin/files/demos');
        }

        const file = await FileRaw.findById(file_id);
        if (!file) {
            req.flash('error', `No file found with such ID: ${file_id}`);
            await pushLog(err, 'deleteAdminDemoFile', req.user._id);
            return res.redirect('/admin/files/demos');
        }

        // checking if file is beeing used
        const projects = await Project.find();

        let projectsFilesMap = projects.map(project => {

            let fileIds = [
                project.input.files.structure?.file_id?.toString(),
                project.input.files.energy_min?.file_id?.toString(),
                project.input.files.MD_simulation?.file_id?.toString(),
                project.output.files.trajectory?.file_id?.toString(),
                project.output.files.residues_indexes?.file_id?.toString()
            ];
            fileIds = fileIds.filter(fileId => fileId !== undefined);

            return [
                project._id.toString(),
                fileIds
            ]
        });

        projectsFilesMap = projectsFilesMap.filter(arr => arr[1].length);

        const usedFilesIds = projectsFilesMap.map(e => e[1]).flat();

        if (!usedFilesIds.includes(file_id)) {
            // can delete file because no one using it
            req.params.file_bucket = 'files';
            await demo.remove();
            return next();
        } else {
            req.flash('error', 'A demo file in use cannot be deleted');
            return res.redirect('/admin/files/demos');
        }
        
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'deleteAdminDemoFile');
        req.flash('error', 'Error');
        return res.redirect('/admin/files/demos');
    }
}

const postAdminDemoUpload = async (req, res) => {
    try {
        let newDemo = new DemoFile({
            file_id: mongoose.Types.ObjectId(req.file.id),
            filename: req.file.originalname,
        });

        await newDemo.save();
        req.flash('success', 'Successfully uploaded new demo file');
        return res.redirect('/admin/files/demos');

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'postAdminDemoUpload');
        req.flash('error', 'Error');
        return res.redirect('/admin/files/demos');
    }
}

const getAdminFilesTemplatesPage = async (req, res) => {
    try {
        const messages = req.flash();

        const templates = await TemplateFile.find();

        const onlyFiles = templates.filter(template => template.file_id);

        const templatesFilesIDs = onlyFiles.map(template => template.file_id.toString());
        const templateFiles = await FileTemplateRaw.find({ _id: templatesFilesIDs });
        const templateFilesTypesMap = {};
        onlyFiles.forEach(entry => {
            templateFilesTypesMap[entry.file_id.toString()] = entry.template_type;
        });

        const parameter_types = [
            'pdb2gmx_params',
            'traj_params',
            'genion_params',
        ];

        const templateValues = templates.filter(template => {
            return parameter_types.includes(template.template_type);
        });

        // Two tables on page
        const tables = [];

        // Template Files Table
        let headersInfo = [
            ['ID', 'string', 4],
            ['Template Type', 'string', 4],
            ['Filename', 'string', 4],
            ['Length', 'string', 3],
            ['Upload Time', 'string', 3],
            ['Content Type', 'string', 4],
        ];

        let tableHeaders = headersInfo.map(e => e[0]);
        let tableHeadersTypes = headersInfo.map(e => e[1]);
        let tableColumnSizes = headersInfo.map(e => e[2]);

        tables.push({
            tableName: 'Template Files',
            tableHeaders,
            tableHeadersTypes,
            tableColumnSizes,
            showDetailsButton: false,
            showDownloadButton: true,
            showDeleteButton: true,
            detailsRoute: '',
            downloadRoute: '/admin/download',
            deleteRoute: '/admin/files/templates/delete',
            afterDeleteRoute: '/admin/files/templates',
            tableContent: templateFiles.map(file => [
                file._id,
                templateFilesTypesMap[file._id.toString()],
                file.filename,
                file.length,
                moment(file.uploadDate).format('ll'),
                file.contentType,
            ])
        });

        // Template Values Table
        headersInfo = [
            ['ID', 'string', 4],
            ['Template Type', 'string', 4],
            ['Content', 'string', 2],
        ];

        tableHeaders = headersInfo.map(e => e[0]);
        tableHeadersTypes = headersInfo.map(e => e[1]);
        tableColumnSizes = headersInfo.map(e => e[2]);
        
        tables.push({
            tableName: 'Template Values',
            tableHeaders,
            tableHeadersTypes,
            tableColumnSizes,
            showDetailsButton: false,
            showDownloadButton: false,
            detailsRoute: '',
            downloadRoute: '',
            tableLength: 0.5,
            tableContent: templateValues.map(entry => [
                entry._id,
                entry.template_type,
                entry.content,
            ])
        });

        const templateParamsMap = templateValues.map(val => [val.template_type, val.content]);

        const params = {
            selected: 'files',
            selectedTab: 'templates',
            errors: messages.error,
            successes: messages.success,
            tables,
            templateParamsMap,
            renderingAllTablesAtOnce: true
        };

        res.render('general/admin/files', params);

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'getAdminFilesTemplatesPage');
        req.flash('error', 'Error');
        return res.redirect('/admin/files');
    }
}

const deleteAdminTemplateFile = async (req, res, next) => {
    try {
        const file_id = req.params.file_id;
        if (!mongoose.Types.ObjectId.isValid(file_id)) {
            req.flash('error', `No file found with such ID: ${file_id}`);
            return res.redirect('/admin/files/templates');
        }

        const template = await TemplateFile.findOne({ file_id });

        if (!template) {
            req.flash('error', `No file found with such ID: ${file_id}`);
            return res.redirect('/admin/files/templates');
        }

        const file = await FileTemplateRaw.findById(file_id);
        if (!file) {
            req.flash('error', `No file found with such ID: ${file_id}`);
            await pushLog(err, 'deleteAdminTemplateFile', req.user._id);
            return res.redirect('/admin/files/templates');
        }

        req.params.file_bucket = 'template_files';
        await template.remove();
        return next();

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'deleteAdminTemplateFile');
        req.flash('error', 'Error');
        return res.redirect('/admin/files/templates');
    }
}

const postAdminTemplateUpload = async (req, res) => {
    try {
        const template_type = req.body.template_type;

        let newTemplate = new TemplateFile({
            file_id: mongoose.Types.ObjectId(req.file.id),
            template_type
        })

        await newTemplate.save();
        req.flash('success', 'Successfully uploaded new template file');
        return res.redirect('/admin/files/templates');

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'postAdminTemplateUpload');
        req.flash('error', 'Error');
        return res.redirect('/admin/files/templates');
    }
}

const postAdminTemplateEdit = async (req, res) => {
    try {
        Object.entries(req.body).forEach(async ([key, value]) => {
            const param = await TemplateFile.findOne({ template_type: key });
            param.content = value;
            await param.save();
        });
        req.flash('success', 'Successfully changed template parameters');
        return res.redirect('/admin/files/templates');
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'postAdminTemplateEdit');
        req.flash('error', 'Error');
        return res.redirect('/admin/files/templates');
    }
}

const getAdminLogsPage = async (req, res) => {
    try {
        const messages = req.flash();
        const logs = await Log.find().sort({ timestamp: 'desc' });
        
        const headersInfo = [
            ['ID', 'string', 2],
            ['Content', 'string', 10],
            ['Source Function', 'string', 4],
            ['Associated User ID', 'link_0', 3],
            ['Timestamp', 'string', 4],
        ];

        const links = [
            '/admin/users'
        ];

        const tableHeaders = headersInfo.map(e => e[0]);
        const tableHeadersTypes = headersInfo.map(e => e[1]);
        const tableColumnSizes = headersInfo.map(e => e[2]);

        const tables = [{
            detailsRoute: '',
            downloadRoute: '',
            deleteRoute: '/admin/logs/delete',
            tableHeaders,
            tableHeadersTypes,
            tableColumnSizes,
            showDetailsButton: false,
            showDownloadButton: false,
            showDeleteButton: true,
            links,
            tableContent: logs.map(log => [
                log._id,
                log.content,
                log.source,
                log.associatedUserId,
                moment(log.timestamp).format('lll'),
            ])
        }];

        const params = {
            selected: 'logs',
            errors: messages.error,
            successes: messages.success,
            tables,
            renderingAllTablesAtOnce: true,
        }

        res.render('general/admin/logs', params);

    } catch (err) {
        // console.log(err);
        await pushLog(err, 'getAdminLogsPage');
        req.flash('error', 'Error');
        return res.redirect('/admin');
    }
}

const deleteAdminLog = async (req, res) => {
    try {
        const log_id = req.params.log_id;
        if (!mongoose.Types.ObjectId.isValid(log_id)) {
            req.flash('error', `No log found with such ID: ${log_id}`);
            return res.redirect('/admin/logs');
        }
        const log = await Log.findById(log_id);
        if (!log) {
            req.flash('error', `No log found with such ID: ${log_id}`);
            return res.redirect('/admin/logs');
        }
        await log.remove();
        req.flash('success', 'Log successfully deleted');
        res.redirect('/admin/logs');
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'deleteAdminLog');
        req.flash('error', 'Error');
        return res.redirect('/admin/logs');
    }
}

const getAdminMakeSuperAdmin = async (req, res) => {
    try {
        const user_id = req.user._id;
        const newSuperAdmin = new SuperAdmin({
            user_id,
        });
        await newSuperAdmin.save();
        res.redirect('/');
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'getAdminMakeSuperAdmin');
        req.flash('error', 'Error');
        return res.redirect('/admin');
    }
}

const getAdminConsoleLogSuperAdmin = async (req, res) => {
    try {
        const superAdmins = await SuperAdmin.find();
        console.log(superAdmins);
        res.redirect('/');
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'getAdminConsoleLogSuperAdmin');
        req.flash('error', 'Error');
        return res.redirect('/admin');
    }
}


// const getMakeMeAdmin = async (req, res) => {
//     try {
//         const newAdminId = req.user._id;
//         const user = await User.findById(newAdminId);
//         user.isAdmin = true;
//         await user.save();
//         req.flash('success', 'You are an admin now !');
//         res.redirect('/');
//     } catch (err) {
//         // console.log(err);
//         await pushLog(err, 'getMakeMeAdmin', req.user._id);
//         req.flash('error', 'Error');
//         res.redirect('/admin');
//     }
// }

module.exports = {
    getAdminPage,

    getAdminUsersPage,
    getAdminUserDetailsPage,
    postAdminUserEdit,
    deleteAdminUserAccount,

    getAdminProjectsPage,
    getAdminProjectDetailsPage,
    postAdminProjectEdit,
    postAdminProjectEditFiles,
    postAdminProjectEditParameters,
    deleteAdminProject,

    getAdminFilesPage,
    deleteAdminFile,
    postAdminFileUpload,

    getAdminFilesDemosPage,
    deleteAdminDemoFile,
    postAdminDemoUpload,
    
    getAdminFilesTemplatesPage,
    deleteAdminTemplateFile,
    postAdminTemplateUpload,
    postAdminTemplateEdit,

    getAdminLogsPage,
    deleteAdminLog,

    getAdminMakeSuperAdmin,
    getAdminConsoleLogSuperAdmin,
    // getMakeMeAdmin,
}
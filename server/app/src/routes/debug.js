const Project = require('../db/models/project')
const User = require('../db/models/user')
const TemplateFile = require('../db/models/templateFile')
const DemoFile = require('../db/models/demoFile')

const mongoose = require('mongoose')

const getDebugPage = async (req, res) => {
    try {
        let projects = await Project.find()
        projects = projects.map(project => ({
            _id: project._id,
            name: project.name,
        }))
        let demos = await DemoFile.find()
        res.render('debug/projects_page', { projects, demos })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const postUploadDebug = async (req, res, next) => {
    try {
        const projectId = req.body.id
        const fileType = req.body.file_type
        const project = await Project.findById(projectId)

        let fileToDelete = {
            exists: false
        }

        const inputFiles = ['structure', 'energy_min', 'MD_simulation']
        // const outputFiles = ['trajectory', 'residues_indexes']

        const _put = inputFiles.includes(fileType) ? 'input' : 'output'

        if (project[_put].files[fileType]._doc.hasOwnProperty('filename')) {
            // deleting previous file
            fileToDelete.exists = true
            fileToDelete.id = project[_put].files[fileType]._doc.file_id
        }
        
        project[_put].files[fileType] = {
            file_id: req.file.id,
            filename: req.file.originalname
        }

        await project.save()

        res.redirect('/debug')

        if (fileToDelete.exists) {
            req.fileToDeleteId = fileToDelete.id
            next()
        }

    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const postDeleteDebug = async (req, res, next) => {
    try {
        const projectId = req.body.id
        const fileType = req.body.file_type
        const project = await Project.findById(projectId)

        let fileToDelete = {
            exists: false
        }

        const inputFiles = ['structure', 'energy_min', 'MD_simulation']

        const _put = inputFiles.includes(fileType) ? 'input' : 'output'

        if (project[_put].files[fileType]._doc.hasOwnProperty('filename')) {
            fileToDelete.exists = true
            fileToDelete.id = project[_put].files[fileType]._doc.file_id
        }

        project[_put].files[fileType] = {}

        await project.save()

        res.redirect('/debug')

        if (fileToDelete.exists) {
            req.fileToDeleteId = fileToDelete.id
            next()
        }
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const postUploadDemoDebug = async (req, res) => {
    try {
        let newDemo = new DemoFile({
            file_id: mongoose.Types.ObjectId(req.file.id),
            filename: req.file.originalname
        })

        await newDemo.save()

        res.redirect('/debug')

    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const postDeleteDemoDebug = async (req, res) => {
    try {
        const demoToDelete = await DemoFile.findById( req.body.id )

        await demoToDelete.delete()

        res.redirect('/debug')

    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const postUploadTemplateDebug = async (req, res) => {
    try {
        
        const fileType = req.body.file_type
                
        let newTemplate
        if (['energy_min', 'MD_simulation'].includes(fileType)) {
            newTemplate = new TemplateFile({
                template_type: fileType,
                file_id: mongoose.Types.ObjectId(req.file.id)
            })
        }
        else {
            newTemplate = new TemplateFile({
                template_type: fileType,
                content: req.body.content
            })
        }
        
        await newTemplate.save()

        res.redirect('/debug')

    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const postDeleteTemplateDebug = async (req, res, next) => {
    try {
        const fileType = req.body.file_type

        let fileToDelete = {
            exists: false
        }

        const templateToDelete = await TemplateFile.findOne({ template_type: fileType })

        if (['energy_min', 'MD_simulation'].includes(fileType)) {
            fileToDelete.exists = true,
            fileToDelete.id = templateToDelete.file_id
        }
        
        await templateToDelete.delete()

        res.redirect('/debug')

        if (fileToDelete.exists) {
            req.fileToDeleteId = fileToDelete.id
            next()
        }
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const add200users = async (req, res) => {
    try {
        const username = 'test#';
        const email = 'test@test#';
        const password = 'password#';

        for (let i=0; i<200; i++) {
            const hashedPass = await bcrypt.hash(password + i, 10)
            const newUser = new User({
                username: username + i,
                email: email + i,
                hashedPassword: hashedPass
            })
            await newUser.save()
        }

        console.log('200 users created');
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
}

module.exports = {
    getDebugPage,
    postUploadDebug,
    postDeleteDebug,
    postUploadDemoDebug,
    postDeleteDemoDebug,
    postUploadTemplateDebug,
    postDeleteTemplateDebug,

    add200users,
}
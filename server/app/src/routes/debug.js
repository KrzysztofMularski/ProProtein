const Project = require('../db/models/project')
const User = require('../db/models/user')
const TemplateFile = require('../db/models/templateFile')
const DemoFile = require('../db/models/demoFile')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const pushLog = require('../logging')

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
        // console.log(err)
        await pushLog(err, 'getDebugPage');
        req.flash('error', 'Error');
        return res.redirect('/')
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
        // console.log(err)
        await pushLog(err, 'postUploadDebug');
        req.flash('error', 'Error while uploading');
        return res.redirect('/debug')
    }
}

const postDeleteDebug = async (req, res, next) => {
    try {
        const projectId = req.body.id
        const fileType = req.body.file_type
        const project = await Project.findById(projectId)

        const demos = await DemoFile.find();
        const demosIDs = demos.map(demo => demo.file_id.toString());

        let fileToDelete = {
            exists: false
        }

        const inputFiles = ['structure', 'energy_min', 'MD_simulation']

        const _put = inputFiles.includes(fileType) ? 'input' : 'output'
        if (fileType === 'structure' && project.input.files.structure._doc.is_demo) {
            fileToDelete.exists = false // we don't wanna delete demos
        } else if (project[_put].files[fileType]._doc.hasOwnProperty('filename')) {
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
        // console.log(err)
        await pushLog(err, 'postDeleteDebug');
        req.flash('error', 'Error while deleting');
        return res.redirect('/debug')
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
        // console.log(err)
        await pushLog(err, 'postUploadDemoDebug');
        req.flash('error', 'Error while uploading demo file');
        return res.redirect('/debug')
    }
}

const postDeleteDemoDebug = async (req, res) => {
    try {
        const demoToDelete = await DemoFile.findById( req.body.id )

        await demoToDelete.delete()

        res.redirect('/debug')

    } catch (err) {
        // console.log(err)
        await pushLog(err, 'postDeleteDemoDebug');
        req.flash('error', 'Error while deleting demo file');
        return res.redirect('/debug')
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
        // console.log(err)
        await pushLog(err, 'postUploadTemplateDebug');
        req.flash('error', 'Error while uploading template');
        return res.redirect('/debug')
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
        // console.log(err)
        await pushLog(err, 'postDeleteTemplateDebug');
        req.flash('error', 'Error while deleting template');
        return res.redirect('/debug')
    }
}

// const add200users = async (req, res) => {
//     try {
//         const username = 'test#';
//         const email = 'test@test#';
//         const password = 'password#';

//         for (let i=0; i<200; i++) {
//             const hashedPass = await bcrypt.hash(password + i, 10)
//             const newUser = new User({
//                 username: username + i,
//                 email: email + i,
//                 hashedPassword: hashedPass
//             })
//             await newUser.save()
//         }

//         console.log('200 users created');
//     } catch (err) {
//         // console.log(err);
//         await pushLog(err, 'add200users');
//         req.flash('error', 'Error while creating 200 users');
//         return res.redirect('/debug')
//     }
// }

// const postResetPassword = async (req, res) => {
//     try {

//         const userId = mongoose.Types.ObjectId('61f5a8f1cb125d13ddd9d6cf');
//         const username = 'kmularski';
//         const email = 'k.mularski98@gmail.com'
//         const changing_password = true;
//         const password = '123123';
//         const password2 = '123123';
//         const user = await User.findById(userId)

//         if (
//             (username.length >= 2 && username.length <= 40) &&
//             (email.length >= 2 && email.length <= 100) &&
//             (
//                 !changing_password ||
//                 (changing_password && password === password2)
//             )
//         ) {
//             user.username = username
//             user.email = email
//             if (changing_password)
//                 user.hashedPassword = await bcrypt.hash(password, 10)
//             await user.save()
//             req.flash('success', 'Successfully saved new profile')
//         } else 
//             req.flash('error', 'Failed while editing profile')
//         res.redirect('/profile')
        
//     } catch (err) {
//         // console.log(err)
//         await pushLog(err, 'postResetPassword');
//         req.flash('error', 'Failed while editing profile')
//         return res.redirect('/debug')
//     }
// }

module.exports = {
    getDebugPage,
    postUploadDebug,
    postDeleteDebug,
    postUploadDemoDebug,
    postDeleteDemoDebug,
    postUploadTemplateDebug,
    postDeleteTemplateDebug,

    // add200users,
    // postResetPassword,
}
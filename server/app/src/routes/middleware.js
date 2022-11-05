const mongoose = require('mongoose')
const multer = require('multer')
const { GridFsStorage } = require('multer-gridfs-storage')
const connectionString = process.env.MONGODB_CONNECTION_STRING
const Project = require('../db/models/project')
const TemplateFile = require('../db/models/templateFile')
const TemplateRaw = require('../db/models/fileTemplateRaw')
const FileRaw = require('../db/models/fileRaw')
const pushLog = require('../logging')

let gfs
let gfs_templates

mongoose.connection.once('open', () => {
    gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
    })
    gfs_templates = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads_templates'
    })
})

const storage = new GridFsStorage({
    url: connectionString,
    file: (req, file) => {
        return {
            filename: file.originalname,
            bucketName: 'uploads'
        }
    }
})

const storage_templates = new GridFsStorage({
    url: connectionString,
    file: (req, file) => {
        return {
            filename: file.originalname,
            bucketName: 'uploads_templates'
        }
    }
})

const upload = multer({ storage })
const upload_templates = multer({ storage: storage_templates })

const deleteFile = (req, res) => {
    const fileId = req.fileToDeleteId
    gfs.delete(fileId)
}

const deleteFiles = (req, res) => {
    const fileIds = req.filesIdsToDelete
    fileIds.forEach(fileId => gfs.delete(fileId))
}

const deleteTemplateFile = (req, res) => {
    const fileId = req.fileToDeleteId
    gfs_templates.delete(fileId)
}

const deleteAllFiles = async (req, res, next) => {
    try {
        const projectId = req.body.project_id
        const project = await Project.findById(projectId)
        const filesToDelete = [];

        const inputFileTypes = ['structure', 'energy_min', 'MD_simulation'];
        const outputFileTypes = ['trajectory', 'residues_indexes'];

        inputFileTypes.forEach(file_type => {
            if (project.input.files[file_type]._doc.hasOwnProperty('file_id') && !project.input.files[file_type]._doc.is_demo) {
                filesToDelete.push(project.input.files[file_type]._doc.file_id);
            }
        })

        outputFileTypes.forEach(file_type => {
            if (project.output.files[file_type]._doc.hasOwnProperty('file_id'))
                filesToDelete.push(project.output.files[file_type]._doc.file_id)
        })

        filesToDelete.forEach(fileId => gfs.delete(fileId))
        next()
    } catch (err) {
        // console.log(err)
        await pushLog(err, 'deleteAllFiles', req.user._id);
        req.flash('error', 'Error while deleting all files');
        return res.redirect('/')
    }
}

const downloadFile = (req, res) => {
    const fileId = req.fileToDownloadId
    gfs.openDownloadStream(fileId).pipe(res);
}

const downloadTemplateFile = (req, res) => {
    const fileId = req.fileToDownloadId
    gfs_templates.openDownloadStream(fileId).pipe(res);
}

const adminDownload = async (req, res) => {
    try {
        const fileId = req.params.file_id;
        if (!mongoose.Types.ObjectId.isValid(fileId)) {
            req.flash('error', `No file found with such ID: ${fileId}`);
            return res.redirect('/admin/files');
        }
        
        const template = await TemplateRaw.findById(fileId);
        if (template) {
            res.attachment(template.filename);
            gfs_templates.openDownloadStream(template._id).pipe(res);
        } else {
            const file = await FileRaw.findById(fileId);
            if (!file) {
                req.flash('error', `No file found with such ID: ${fileId}`);
                return res.redirect('/admin/files');
            }
            res.attachment(file.filename);
            gfs.openDownloadStream(file._id).pipe(res);
        }
        
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'adminDownload', req.user._id);
        req.flash('error', 'Error while submitting simulation');
        return res.redirect('/admin')
    }
}

const adminDeleteFile = async (req, res) => {
    try {
        const file_id = mongoose.Types.ObjectId(req.params.file_id);
        if (req.params.file_bucket === 'files') {
            gfs.delete(file_id);
        } else if (req.params.file_bucket === 'template_files') {
            gfs_templates.delete(file_id);
        }
        req.flash('success', 'Successfully deleted a file');
        return res.redirect(req.body.route_back);
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'adminDeleteFile', req.user._id);
        req.flash('error', 'Error while deleting file');
        return res.redirect(req.body.route_back)
    }
}

const adminDeleteProjectFiles = async (req, res) => {
    try {
        req.params.files_to_delete.forEach(file_id => gfs.delete(mongoose.Types.ObjectId(file_id)));
        if (req.params.only_updating_files) {
            req.flash('success', `Project files successfully updated`);
            return res.redirect(`/admin/projects/${req.params.project_id}`)
        } else {
            req.flash('success', 'Successfully deleted a project and associated files');
            return res.redirect('/admin/projects');
        }
    } catch (err) {
        // console.log(err);
        await pushLog(err, 'adminDeleteProjectFiles', req.user._id);
        req.flash('error', 'Error while deleting project files');
        return res.redirect('/admin/projects')
    }
}

// const deleteFile = (req, res) => {
//     const fileId = req.fileToDeleteId
//     gfs.delete(fileId)
// }

// const deleteTemplateFile = (req, res) => {
//     const fileId = req.fileToDeleteId
//     gfs_templates.delete(fileId)
// }

const checkAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next()
    }
    res.redirect('/')
}

const checkNotAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return res.redirect('/')
    }
    next()
}

const checkIsAdmin = (req, res, next) => {
    if (req.user.isAdmin === 'false' || req.user.isAdmin === false) {
        return res.redirect('/')
    }
    next();
}

// const checkIfNotFinished = async (req, res, next) => {
//     try {
//         const projectId = req.body.project_id
//         const project = await Project.findById(projectId)
//         if (project.owner_id.toString() !== req.user._id.toString())
//             return res.redirect('/')
//         if (project.status !== 'Initial')
//             return res.redirect('/')
//         next()
//     } catch (err) {
//         console.log(err)
//         return res.redirect('/')
//     }
// }

module.exports = {
    upload,
    upload_templates,
    deleteFile,
    deleteFiles,
    deleteTemplateFile,
    deleteAllFiles,
    downloadFile,
    downloadTemplateFile,

    adminDownload,
    adminDeleteFile,
    adminDeleteProjectFiles,

    checkAuthenticated,
    checkNotAuthenticated,
    checkIsAdmin,
    
    // checkIfNotFinished,
}
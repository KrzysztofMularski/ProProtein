const mongoose = require('mongoose')
const multer = require('multer')
const { GridFsStorage } = require('multer-gridfs-storage')
const connectionString = process.env.MONGODB_CONNECTION_STRING
const Project = require('../db/models/project')

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
        const filesToDelete = []

        const inputFileTypes = ['structure', 'energy_min', 'MD_simulation']
        const outputFileTypes = ['trajectory', 'residues_indexes']

        inputFileTypes.forEach(file_type => {
            if (project.input.files[file_type]._doc.hasOwnProperty('file_id') && !project.input.files[file_type]._doc.is_demo === 'true')
                filesToDelete.push(project.input.files[file_type]._doc.file_id)
        })

        outputFileTypes.forEach(file_type => {
            if (project.output.files[file_type]._doc.hasOwnProperty('file_id'))
                filesToDelete.push(project.output.files[file_type]._doc.file_id)
        })

        filesToDelete.forEach(fileId => gfs.delete(fileId))

        next()
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
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
    if (!req.user.isAdmin) {
        return res.redirect('/')
    }
    next();
}

const checkIfNotFinished = async (req, res, next) => {
    try {
        const projectId = req.body.project_id
        const project = await Project.findById(projectId)
        if (project.owner_id.toString() !== req.user._id.toString())
            return res.redirect('/')
        if (project.status !== 'Initial')
            return res.redirect('/')
        next()
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

module.exports = {
    upload,
    upload_templates,
    deleteFile,
    deleteFiles,
    deleteTemplateFile,
    deleteAllFiles,
    downloadFile,
    downloadTemplateFile,
    checkAuthenticated,
    checkNotAuthenticated,
    checkIsAdmin,
    checkIfNotFinished,
}
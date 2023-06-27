const mongoose = require('mongoose')
const multer = require('multer')
const { GridFsStorage } = require('multer-gridfs-storage')
const connectionString = process.env.MONGODB_CONNECTION_STRING
const Project = require('../db/models/project')
// const TemplateRaw = require('../db/models/fileTemplateRaw')
const FileRaw = require('../db/models/fileRaw')
const pushLog = require('../logging')
const { spawn } = require('child_process');

let gfs

mongoose.connection.once('open', () => {
    gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
    })
})

const storage = new GridFsStorage({
    url: connectionString,
    file: (_, file) => {
        return {
            filename: file.originalname,
            bucketName: 'uploads'
        }
    }
})

const upload = multer({ storage })

const deleteFile = async (req, _) => {
    const fileId = req.fileToDeleteId
    await gfs.delete(fileId)
}

const deleteFiles = async (req, _) => {
    const fileIds = req.filesIdsToDelete;
    for (const fileId of fileIds) {
        await gfs.delete(fileId);
    }
}

// const deleteAllFiles = async (req, res) => {
//     try {
//         const projectId = req.body.project_id
//         const project = await Project.findById(projectId)
//         const filesToDelete = [];
//
//         const inputFileTypes = ['structure'];
//
//         const outputFileTypes = [
//             'trajectory',
//             'energy_potential', 
//             'energy_temperature', 
//             'energy_pressure', 
//             'energy_density', 
//             'md_xtc', 
//             'md_edr', 
//             'md_tpr', 
//             'residues_indexes', 
//             'simulation_logs', 
//         ];
//
//         inputFileTypes.forEach(file_type => {
//             if (project.input.files[file_type]._doc.hasOwnProperty('file_id') && !project.input.files[file_type]._doc.is_demo) {
//                 filesToDelete.push(project.input.files[file_type]._doc.file_id);
//             }
//         })
//
//         outputFileTypes.forEach(file_type => {
//             if (project.output.files[file_type]._doc.hasOwnProperty('file_id'))
//                 filesToDelete.push(project.output.files[file_type]._doc.file_id)
//         })
//
//         filesToDelete.forEach(fileId => gfs.delete(fileId))
//         next()
//     } catch (err) {
//         // console.log(err)
//         await pushLog(err, 'deleteAllFiles', req.user._id);
//         req.flash('error', 'Error while deleting all files');
//         return res.redirect('/')
//     }
// }

const downloadFile = (req, res) => {
    const fileId = req.fileToDownloadId
    gfs.openDownloadStream(fileId).pipe(res);
}

const adminDownload = async (req, res) => {
    try {
        const fileId = req.params.file_id;
        console.log(fileId);
        if (!mongoose.Types.ObjectId.isValid(fileId)) {
            req.flash('error', `No file found with such ID: ${fileId}`);
            return res.redirect('/admin/files');
        }
        
        const file = await FileRaw.findById(fileId);
        if (!file) {
            req.flash('error', `No file found with such ID: ${fileId}`);
            return res.redirect('/admin/files');
        }
        res.attachment(file.filename);
        gfs.openDownloadStream(file._id).pipe(res);
        
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
        gfs.delete(file_id);
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

const checkAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next()
    }
    req.flash('error', 'To perform this action, You need to be logged in.');
    res.redirect('/')
}

const checkNotAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        req.flash('error', 'To perform this action, You need to be logged out.');
        return res.redirect('/');
    }
    next();
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

const validateFileGuest = async (req, res, next) => {
    try {
        if (!req.file) {
            return next();
        }
        const {is_ok, error_msg} = await fileCorrect(req.file.id, true);
        if (!is_ok) {
            req.fileNotCorrect = true;
            req.errorMsg = error_msg;
        }
        return next();
    } catch (err) {
        console.log(err);
        req.flash('error', 'Error while validating uploaded file');
        return res.redirect('/');
    }
}

const validateFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return next();
        }
        const {is_ok, error_msg} = await fileCorrect(req.file.id, false);
        if (!is_ok) {
            req.fileNotCorrect = true;
            req.errorMsg = error_msg;
        }
        return next();
    } catch (err) {
        console.log(err);
        req.flash('error', 'Error while validating uploaded file');
        return res.redirect('/');
    }
}

const fileCorrect = (fileId, isGuest) => {
    return new Promise((resolve, _) => {
        const awkCommand = '{if (a[$5]<$6 && $1 == "ATOM"){a[$5];a[$5]=$6;}}END{for(i in a){s+=a[i];}print s}';
        const awkArgs = ['-F', ' ', awkCommand];
        const awkProcess = spawn('awk', awkArgs);
        const readStream = gfs.openDownloadStream(fileId);
        readStream.pipe(awkProcess.stdin);
        let output = '';
        awkProcess.stdout.on('data', (data) => {
            output += data;
        });
        awkProcess.on('close', (_) => {
            const num = parseInt(output);
            if (isGuest && num > 120) {
                return resolve({is_ok: false, error_msg: `For guest simulation, number of amino acids cannot be greater than 120, got: ${num}`});
            }
            if (!isGuest && num > 250) {
                return resolve({is_ok: false, error_msg: `For regular simulation, number of amino acids cannot be greater than 250, got: ${num}`});
            }
            return resolve({is_ok: true});
        });
    });
}

module.exports = {
    upload,
    deleteFile,
    deleteFiles,
    // deleteAllFiles,
    downloadFile,

    adminDownload,
    adminDeleteFile,
    adminDeleteProjectFiles,

    checkAuthenticated,
    checkNotAuthenticated,
    checkIsAdmin,
    
    validateFileGuest,
    validateFile,
}

const mongoose = require('mongoose')
const Project = require('./db/models/project')
const FileRaw = require('./db/models/fileRaw')
const pushLog = require('./logging')

let gfs;

mongoose.connection.once('open', () => {
    gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
    })
})

// gfs.delete should never throw because gfs should always be initialized
// calling gfs from functions starts after successfully connecting to db via connectDB in app.js

// deletes file by given id
// if doesn't exist - do nothing
const gfsDeleteFile = async fileId => {
    try {
        fileId = mongoose.Types.ObjectId(fileId);
        if (await FileRaw.exists({_id: fileId})) {
            await gfs.delete(fileId);
        }
    } catch (err) {
        console.error(`Error deleting file with id ${fileId}: ${err}`);
        await pushLog(err, 'gfsDeleteFile');
    }
}

// deletes files by given array of ids
// if some of the files don't exist - do nothing for them
const gfsDeleteFiles = async fileIds => {
    try {
        for (let fileId of fileIds) {
            fileId = mongoose.Types.ObjectId(fileId);
            if (await FileRaw.exists({_id: fileId})) {
                await gfs.delete(fileId);
            }
        }
    } catch (err) {
        console.error(`Error deleting files: ${err}`);
        await pushLog(err, 'gfsDeleteFiles');
    }
}

// deletes the project and its associated files
// if project doesn't exist - do nothing
// if some of the files don't exist - do nothing for them
const gfsDeleteProjectWithFiles = async (projectId) => {
    try {
        if (!mongoose.isValidObjectId(projectId)) {
            return;
        }
        const project = await Project.findOne({ _id: projectId });
        if (!project) {
            return;
        }
        const filenames = [
            'trajectory',
            'energy_potential',
            'energy_temperature',
            'energy_pressure',
            'energy_density',
            'md_xtc',
            'md_edr',
            'md_tpr',
            'residues_indexes',
            'simulation_logs',
        ];
        if (project.input.files.structure?.file_id && !project.input.files.structure?.is_demo) {
            await gfsDeleteFile(project.input.files.structure.file_id);
        }
        for (const filename of filenames) {
            if (project.output.files[filename]?.file_id) {
                await gfsDeleteFile(project.output.files[filename].file_id);
            }
        }
        await Project.deleteOne({ _id: projectId });

    } catch (err) {
        console.error(`Error deleting project: ${err}`);
        await pushLog(err, 'gfsDeleteProjectWithFiles');
    }
}

module.exports = {
    gfsDeleteFile,
    gfsDeleteFiles,
    gfsDeleteProjectWithFiles,
}

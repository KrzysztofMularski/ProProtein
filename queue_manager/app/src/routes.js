const Project = require('./db/models/project')
const mongoose = require('mongoose')
const fs = require('fs')
const fsProm = require('fs/promises')
const path = require('path')

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

let addToQueue
let deleteFromQueue
let handleSimulation
let gridFSBucket

const setGridFSBucket = fsbucket => {
    gridFSBucket = fsbucket
}

const appDir = process.env.APP_DIR
const volume = process.env.SIMULATIONS_VOLUME

const serverUrl = process.env.SERVER_URL

const getAll = (req, res) => {
    res.send('Hello')
}

const postNotifyNew = async (req, res) => {
    try {
        const projectId = req.body.project_id
        const project = await Project.findById(projectId)

        const newEntry = {
            _id: project._id,
            waiting_since: project.waiting_since,
            input: project.input,
        }

        res.sendStatus(200)
        
        await addToQueue(newEntry)
        return handleSimulation('new')
        
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
}

const postNotifyFinished = async (req, res) => {
    try {
        const projectId = req.body.project_id
        const dirName = req.body.dir_name
        const status = req.body.status
        const project = await Project.findById(projectId)

        if (status === 'error') {
            project.status = 'Error'
        } else if (status === 'ok') {
            project.finished_since = new Date()
            project.status = 'Finished'

            const arr = ['trajectory.pdb', 'residues_indexes.txt']
            // uploading necessary output files to database
            arr.forEach(async filename => {
                const newId = new mongoose.Types.ObjectId()
                const fileType = filename.split('.')[0]
                const readStream = await fs.createReadStream(path.join(appDir, volume, dirName, filename))
                const writeStream = await gridFSBucket.openUploadStreamWithId(newId, filename)
                await readStream.pipe(writeStream)
                project.output.files[fileType] = {
                    file_id: newId,
                    filename
                }
            })
        }

        await fsProm.rm(path.join(appDir, volume, dirName), { recursive: true, force: true })

        await project.save()

        // sending notification to user
        await fetch(serverUrl, {
            method: 'POST',
            body: JSON.stringify({
                project_id: project._id.toString(),
                sim_status: status
            }),
            headers: {
                'Content-type': 'application/json; charset=UTF-8'
            }
        })

        res.sendStatus(200)

        await deleteFromQueue(projectId)

        return handleSimulation('finished')

    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }

}

const setHandlers = (
        addHandler,
        deleteHandler,
        newHandler,
    ) => {
    addToQueue = addHandler
    deleteFromQueue = deleteHandler
    handleSimulation = newHandler
}

module.exports = {
    getAll,
    postNotifyNew,
    postNotifyFinished,
    setHandlers,
    setGridFSBucket
}
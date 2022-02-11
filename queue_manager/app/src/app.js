const express = require('express')
const app = express()
const port = 5000
const { routing, setHandlersToRouting, setGridFSBucketToRouting } = require('./routing')
const mongoose = require('mongoose')
const connectDB = require('./db/connect')
const Project = require('./db/models/project')
const Mutex = require('async-mutex').Mutex
const mutex = new Mutex()
const { handleSimulation, setGridFSBucketsToManager, setHandlersToManager } = require('./manager')
const cors = require('cors')

app.use('/', routing)
app.use(cors())

let queue = []

const addToQueue = async newEntry => {
    try {
        await mutex.runExclusive(async () => {
            let index = queue.findIndex(element => {
                element.waiting_since.getTime() > newEntry.waiting_since.getTime()
            })
            if (index === -1)
                index = queue.length
            queue.splice(index, 0, newEntry)
        })

    } catch (err) {
        console.log(err)
    }
}

const deleteFromQueue = async projectId => {
    try {
        await mutex.runExclusive(async () => {
            let index = queue.findIndex(element => element._id.toString() === projectId.toString())
            if (index != -1)
                queue.splice(index, 1)
        })
    } catch (err) {
        console.log(err)
    }
}

const getQueueLength = () => {
    return queue.length
}

const getFirstEntry = () => {
    if (queue.length)
        return queue[0]
    return null
}

const updateProject = async projectId => {
    try {
        const project = await Project.findById(projectId)
        project.status = 'Processing'
        project.processing_since = new Date()
        project.save()
    } catch (err) {
        console.log(err)
    }
}

mongoose.connection.once('open', () => {
    const gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
    })
    const gridFSBucket_templates = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads_templates'
    })
    setGridFSBucketsToManager(gridFSBucket, gridFSBucket_templates)
    setGridFSBucketToRouting(gridFSBucket)
})

const start = async () => {
    try {
        await connectDB()
        const projects_processing = await Project.find({ status: 'Processing' }).sort({ waiting_since: 'asc' })
        let projects = await Project.find({ status: 'Waiting' }).sort({ waiting_since: 'asc' })
        projects = [...projects_processing, ...projects]
        queue = projects.map(project => ({
            _id: project._id,
            waiting_since: project.waiting_since,
            input: project.input,
        }))

        projects_processing.forEach(async project => {
            project.status = 'Waiting'
            project.processing_since = ''
            await project.save()
        })

        setHandlersToRouting(addToQueue, deleteFromQueue, handleSimulation)
        setHandlersToManager(getQueueLength, getFirstEntry, updateProject)
        handleSimulation('start')

        app.listen(port, () => {
            console.log(`Server listening at http://localhost:${port}/`)
        })
    } catch (err) {
        console.log(err)
    }
}

start()


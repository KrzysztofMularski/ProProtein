require('dotenv').config()

const express = require('express')
const router = express.Router()

const routes = require('./routes')

const setHandlers = (addHandler, deleteHandler, newHandler) => {
    routes.setHandlers(addHandler, deleteHandler, newHandler)
}

const setGridFSBucket = fsbucket => {
    routes.setGridFSBucket(fsbucket)
}

router.use(express.json())
router.use(express.urlencoded({ extended: false }))

router.all('/', routes.getAll)

router.post('/notify/new', routes.postNotifyNew)
router.post('/notify/finished', routes.postNotifyFinished)

module.exports = {
    routing: router,
    setHandlersToRouting: setHandlers,
    setGridFSBucketToRouting: setGridFSBucket
}
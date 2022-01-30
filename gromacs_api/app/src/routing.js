require('dotenv').config()

const express = require('express')
const router = express.Router()

const routes = require('./routes')

router.use(express.json())
router.use(express.urlencoded({ extended: false }))

router.all('/', routes.getAll)

router.post('/default', routes.postDefault)


module.exports = router
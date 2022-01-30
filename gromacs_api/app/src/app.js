const express = require('express')
const app = express()
const port = 4000
const routing = require('./routing')

app.use('/', routing)

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}/`)
})

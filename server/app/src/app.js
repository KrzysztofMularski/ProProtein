const express = require('express')
const app = express()
const port = 80
const routing = require('./routing')
const path = require('path')
const bodyParser = require('body-parser')
const connectDB = require('./db/connect')
const cors = require('cors')

app.use('/', routing)
app.use(cors())
app.use(bodyParser.json())
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, '../public')))
app.use('/css', express.static('public/css'))
app.use('/icons', express.static('public/icons'))

const start = async () => {
    try {
        await connectDB()
        app.listen(port, () => {
            console.log(`Server listening at http://localhost:${port}/`)
        })
    } catch (err) {
        console.log(err)
    }
}

start()


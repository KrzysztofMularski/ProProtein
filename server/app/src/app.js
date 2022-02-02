const express = require('express')
const app = express()
const port = 3000
const routing = require('./routing')
const path = require('path')
const bodyParser = require('body-parser')
const connectDB = require('./db/connect')
const cors = require('cors')

const fs = require('fs')
const http = require('http')
const https = require('https')

const options = {
    key: fs.readFileSync(path.join(__dirname, '../letsencrypt/live/proprotein.cs.put.poznan.pl/privkey.pem'), 'utf-8'),
    cert: fs.readFileSync(path.join(__dirname, '../letsencrypt/live/proprotein.cs.put.poznan.pl/fullchain.pem'), 'utf-8')
};

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
        if (process.env.NODE_ENV === 'production') {
            require('dotenv').config();
            const fs = require('fs')
            const https = require('https')
            options = {
                key: fs.readFileSync(path.join(__dirname, process.env.PRIVKEY_PATH), 'utf-8'),
                cert: fs.readFileSync(path.join(__dirname, process.env.FULLCHAIN_PATH), 'utf-8')
            };
            https.createServer(options, app).listen(port, () => {
                console.log(`Server listening on port ${port}/`)
            })
        } else {
            app.listen(port, () => {
                console.log(`Server listening at http://localhost:${port}/`)
            })
        }
    } catch (err) {
        console.log(err)
    }
}

start()


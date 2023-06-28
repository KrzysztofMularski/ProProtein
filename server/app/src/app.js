require('dotenv').config();
const express = require('express')
const app = express()
const routing = require('./routing')
const path = require('path')
const bodyParser = require('body-parser')
const connectDB = require('./db/connect')
const Project = require('./db/models/project');
const FileRaw = require('./db/models/fileRaw');
const cors = require('cors')
const fs = require('fs')
const https = require('https')
const { ToadScheduler, SimpleIntervalJob, AsyncTask } = require('toad-scheduler');
const mongoose = require('mongoose')
const pushLog = require('./logging');
const port = process.env.PORT;

const { gfsDeleteFile, gfsDeleteFiles, gfsDeleteProjectWithFiles} = require('./gfs');

const MAX_FINISHED_PROJECT_LIFESPAN_IN_DAYS = parseInt(process.env.MAX_FINISHED_PROJECT_LIFESPAN_IN_DAYS);

app.use('/', routing)
app.use(cors())
app.use(bodyParser.json())
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, '../public')))
app.use('/css', express.static('public/css'))
app.use('/icons', express.static('public/icons'))
app.all('*', (_, res) => res.redirect('/'));

const projectsWatcher = async () => {
    try {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() - MAX_FINISHED_PROJECT_LIFESPAN_IN_DAYS);

        const oldProjects = await Project.find({
            status: { $in: ['Finished', 'Error'] },
            finished_since: { $lt: expirationDate }
        });

        // deleting all old projects
        for (const project of oldProjects) {
            await gfsDeleteProjectWithFiles(project._id.toString());
        }

    } catch (err) {
        console.log(err);
        await pushLog(err, 's:projectsWatcher');
    }
}

const start = async () => {
    try {
        await connectDB();
        const scheduler = new ToadScheduler();
        
        const task = new AsyncTask(
            'projects watcher',
            projectsWatcher,
            (err) => { console.log(err); }
        );
        const job = new SimpleIntervalJob({ days: 1, runImmediately: true }, task, { preventOverrun: true });
        scheduler.addSimpleIntervalJob(job);

        if (process.env.NODE_ENV === 'production') {
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

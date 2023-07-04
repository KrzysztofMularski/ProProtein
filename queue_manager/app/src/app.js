require('dotenv').config();
const express = require('express');
const app = express();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
const fsProm = require('fs/promises');
const { mkdirp } = require('mkdirp');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const connectDB = require('./db/connect');
const Project = require('./db/models/project');
const pushLog = require('./logging');
const QueueEntry = require('./db/models/queueEntry');

const { ToadScheduler, SimpleIntervalJob, AsyncTask } = require('toad-scheduler');

const port = process.env.PORT;
const queueIntervalInSeconds = process.env.QUEUE_INTERVAL_IN_SECONDS;
const appDir = process.env.APP_DIR;
const volume = process.env.SIMULATIONS_VOLUME;
const gromacsApiUrl = process.env.GROMACS_API_ADDRESS;
const gromacsApiKillUrl = process.env.GROMACS_API_KILL_ADDRESS;
const serverUrl = process.env.SERVER_URL;
const structureFilename = process.env.STRUCTURE_FILENAME;
const LIMIT_SIMULATION_TIME_IN_DAYS = parseInt(process.env.LIMIT_SIMULATION_TIME_IN_DAYS);

const cors = require('cors');

let gridFSBucket = null;

const downloadStructure = async (currentEntry, dir) => {
    return new Promise((resolve, reject) => {
        const structureId = currentEntry.project_id.input.files.structure.file_id;
        const downloadStream = gridFSBucket.openDownloadStream(structureId);

        if (structureId === undefined) {
            return reject('Project has no structure provided');
        }

        const writeStream = fs.createWriteStream(path.join(appDir, volume, dir, structureFilename));

        downloadStream.on('error', err => reject(err));
        writeStream.on('error', err => reject(err));
        writeStream.on('finish', resolve);
        
        downloadStream.pipe(writeStream);
    });
}

const handleSimulation = async () => {
    try {
        const firstEntry = await QueueEntry
            .findOne()
            .sort({ created: 1 })
            .populate({ path: "project_id", model: Project });

        if (!firstEntry) {
            return;
        }
        const firstProject = await Project.findById(firstEntry.project_id._id);

        if (firstProject.status === 'Waiting') {
            // updating project info

            firstProject.status = 'Processing';
            firstProject.processing_since = Date.now();
            await firstProject.save();

            // defining simulation structure in file system

            const dir = crypto.randomBytes(20).toString('hex');
            await mkdirp(path.join(appDir, volume, dir));
            await downloadStructure(firstEntry, dir);

            // creating request to gromacs_api

            await fetch(gromacsApiUrl, {
                method: 'POST',
                body: JSON.stringify({
                    dir_name: dir,
                    project_id: firstProject._id.toString(),
                    simulation_parameters: firstProject.input.extra,
                }),
                headers: {
                    'Content-type': 'application/json; charset=UTF-8'
                }
            })

            return;

        } else if (firstProject.status === 'Processing') {
            return;
        } else if (firstProject.status === 'Finished' || firstProject.status === 'Error') {
            await QueueEntry.deleteOne({ _id: firstEntry._id });
            return handleSimulation();
        }

    } catch (err) {
        console.log(err);
        await pushLog(err, 'qm:handleSimulation');
    }
}

const queueWatcher = async () => {
    try {
        const firstEntry = await QueueEntry
            .findOne()
            .sort({ created: 1 })
            .populate({ path: "project_id", model: Project });

        if (!firstEntry) {
            return;
        }
        const firstProject = await Project.findById(firstEntry.project_id?._id || firstEntry.project_id);

        if (Date.now() - firstProject.processing_since > LIMIT_SIMULATION_TIME_IN_DAYS * 24 * 60 * 60 * 1000) {
            // checking simulation time, if exceeds x, then remove this simulation from queue and kill gromacs process
            firstProject.status = 'Error';
            firstProject.errorMsg = `Simulation is taking too long to process (more than ${LIMIT_SIMULATION_TIME_IN_DAYS} days). Simulation is being removed from queue`;
            await firstProject.save();

            await fetch(gromacsApiKillUrl, {
                method: 'DELETE',
                headers: {
                    'Content-type': 'application/json; charset=UTF-8'
                }
            })
        }

    } catch (err) {
        console.log(err);
        await pushLog(err, 'qm:queueWatcher');
    }
}

const getAll = (_, res) => {
    res.send('Hello');
}

const postNotifyFinished = async (req, res) => {
    try {
        res.sendStatus(200);
        /*
         * body = {
         *   project_id,
         *   dir_name,
         *   status
         * }
        */
        const projectId = req.body.project_id;
        const dirName = req.body.dir_name;
        let status = req.body.status;
        const project = await Project.findById(projectId);
        const exitCode = req.body.exit_code;

        project.finished_since = new Date();

        const filenames = fs.readdirSync(path.join(appDir, volume, dirName));
        
        let output = '===============\nQueue server\n===============\n';
        output += `\n exit code: ${exitCode}`;
        output += `\n projectId: ${projectId}`;
        output += `\n dir name: ${dirName}`;
        output += `\n status: ${status}`;
        output += `\n generated files: ${filenames}`;

        fs.appendFileSync(path.join(appDir, volume, dirName, 'simulation_logs.txt'), output);

        const output_filenames = [
            'trajectory.pdb',
            'energy_potential.png',
            'energy_temperature.png',
            'energy_pressure.png',
            'energy_density.png',
            'md_xtc.xtc',
            'md_edr.edr',
            'md_tpr.tpr',
            'residues_indexes.txt',
            'simulation_logs.txt',
        ];

        if (!output_filenames.every(filename => filenames.includes(filename)) || status === 'error') {
            project.status = 'Error';
            status = 'error';
            const filename = 'simulation_logs.txt';
            const newId = new mongoose.Types.ObjectId();
            const fileType = filename.split('.')[0];
            const readStream = fs.createReadStream(path.join(appDir, volume, dirName, filename));
            const writeStream = await gridFSBucket.openUploadStreamWithId(newId, filename);
            await readStream.pipe(writeStream);
            project.output.files[fileType] = {
                file_id: newId,
                filename,
            }
        } else if (status === 'ok') {
            // uploading necessary output files to database
            project.status = 'Finished';

            for (const filename of output_filenames) {
                const newId = new mongoose.Types.ObjectId();
                const fileType = filename.split('.')[0];
                const readStream = fs.createReadStream(path.join(appDir, volume, dirName, filename));
                const writeStream = await gridFSBucket.openUploadStreamWithId(newId, filename);
                await readStream.pipe(writeStream);
                project.output.files[fileType] = {
                    file_id: newId,
                    filename,
                }
            }
        }

        await fsProm.rm(path.join(appDir, volume, dirName), { recursive: true, force: true });
        await project.save();

        // sending notification to server
        await fetch(serverUrl, {
            method: 'POST',
            body: JSON.stringify({
                project_id: project._id.toString(),
                sim_status: status,
            }),
            headers: {
                'Content-type': 'application/json; charset=UTF-8'
            }
        });

        return;

    } catch (err) {
        console.log(err);
        await pushLog(err, 'qm:postNotifyFinished');
    }
}

const start = async () => {
    try {
        app.use(cors());
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));

        app.all('/', getAll);
        app.post('/notify_finished', postNotifyFinished);
        
        await connectDB();

        gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'uploads'
        });

        await Project.updateMany({status: 'Processing'}, {'$set': {status: 'Waiting'}, '$unset': {processing_since: 1}}); 

	// todo: should clear all queue entries and for all 'Waiting' projects, create queue entries
        // should also clear out simulation_dir directory
        const scheduler = new ToadScheduler();

        // handle simulation
        const task = new AsyncTask(
            'simulation task',
            handleSimulation,
            (err) => { console.log(err); }
        );
        const job = new SimpleIntervalJob({ seconds: queueIntervalInSeconds, runImmediately: true }, task, { preventOverrun: true });
        scheduler.addSimpleIntervalJob(job);

        // checking simulation execution time
        const task2 = new AsyncTask(
            'queue watcher',
            queueWatcher,
            (err) => { console.log(err); }
        );
        const job2 = new SimpleIntervalJob({ hours: 1, runImmediately: true }, task2, { preventOverrun: true });
        scheduler.addSimpleIntervalJob(job2);

        app.listen(port, () => {
            console.log(`Server listening on port ${port}`);
        })
    } catch (err) {
        console.log(err);
    }
}

start()


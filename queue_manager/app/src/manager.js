const fs = require('fs')
const fsProm = fs.promises
const path = require('path')
const crypto = require('crypto')
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))
const appDir = process.env.APP_DIR
const volume = 'simulation_dirs'
const gromacsApiUrl = process.env.GROMACS_API_ADDRESS
const Mutex = require('async-mutex').Mutex
const mutex_sim = new Mutex()
const TemplateFile = require('./db/models/templateFile')

let isRunning = false

let gridFSBucket
let gridFSBucket_templates

const setGridFSBucketsToManager = (fsbucket, fsbucket_templates) => {
    gridFSBucket = fsbucket
    gridFSBucket_templates = fsbucket_templates
}

let defaultFiles = []

let getQueueLength
let getFirstEntry
let updateProject

const downloadFile = (currentEntry, dir, fileType, fileExt) => {
    let fileId = currentEntry.input.files[fileType].file_id
    let downloadStream = gridFSBucket.openDownloadStream(fileId)

    if (fileId === undefined) {
        // using template file
        fileId = defaultFiles.find(defaultFile => defaultFile.template_type === fileType).file_id
        downloadStream = gridFSBucket_templates.openDownloadStream(fileId)
    }

    const writeStream = fs.createWriteStream(path.join(appDir, volume, dir, fileType + fileExt))
    downloadStream.pipe(writeStream)
}

const makeFileFromString = (currentEntry, dir, strType, fileExt) => {
    let paramStr = currentEntry.input.extra[strType]
    if (!paramStr.length || paramStr === null || paramStr === undefined || paramStr === '-1') {
        paramStr = defaultFiles.find(defaultFile => defaultFile.template_type === strType).content
    }
    if (strType === 'pdb2gmx_params') {
        const template = defaultFiles.find(defaultFile => defaultFile.template_type === 'pdb2gmx_params').content

        const templateArrStr = template.split(',')
        const templateArrInt = templateArrStr.map(v => parseInt(v))
        const paramArrStr = paramStr.split(',')
        const paramArrInt = paramArrStr.map(v => parseInt(v))

        if (paramStr === '-1,-1')
            paramStr = template
        else if (paramArrInt[0] === -1)
            paramStr = `${templateArrStr[0]},${paramArrStr[1]}`
        else if (paramArrInt[0] > -1 && paramArrInt[1] === -1) {
            if (paramArrInt[0] >= 1 && paramArrInt[0] <= 8)
                paramStr = `${paramArrStr[0]},7`
            else if (paramArrInt[0] >= 9 && paramArrInt[0] <= 14)
                paramStr = `${paramArrStr[0]},3`
            else if (paramArrInt[0] === 15)
                paramStr = `${paramArrStr[0]},8`
        }

        // '-1,-1' -> '15,7' from template
        // '-1,6' -> '15,6' without checking
        // '12,-1 -> '12,x' x - to find
        // '12,4' -> '12,4' without checking
        
    }
    paramStr = paramStr.split(',').join('\n')
    fs.writeFileSync(path.join(appDir, volume, dir, strType + fileExt), paramStr);
}

const handleSimulation = async status => {
    try {
        if (status === 'finished' || status === 'start')
            isRunning = false
        if (isRunning === true)
            return
        await mutex_sim.runExclusive(async () => {
            // simulation_status === 'stopped'
            const currentEntry = getFirstEntry()
            if (currentEntry !== null) {
                isRunning = true
                defaultFiles = await TemplateFile.find()
                updateProject(currentEntry._id)
                const dir = crypto.randomBytes(20).toString('hex')
                await fsProm.mkdir(path.join(appDir, volume, dir))
                
                // extracting input files from database
                downloadFile(currentEntry, dir, 'structure', '.pdb')
                downloadFile(currentEntry, dir, 'energy_min', '.mdp')
                downloadFile(currentEntry, dir, 'MD_simulation', '.mdp')
                makeFileFromString(currentEntry, dir, 'pdb2gmx_params', '.txt')
                makeFileFromString(currentEntry, dir, 'traj_params', '.txt')
                makeFileFromString(currentEntry, dir, 'genion_params', '.txt')
                
                // creating request to Gromacs API
                await fetch(gromacsApiUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        dir_name: dir,
                        project_id: currentEntry._id.toString(),
                        additional_parameters: {
                            spheres_allocation_frame: currentEntry.input.extra.spheres_allocation_frame ? currentEntry.input.extra.spheres_allocation_frame : 1,
                            rmsd_threshold: currentEntry.input.extra.rmsd_threshold ? currentEntry.input.extra.rmsd_threshold : 10
                        }
                    }),
                    headers: {
                        'Content-type': 'application/json; charset=UTF-8'
                    }
                })
            } else {
                isRunning = false
            }
        })
    } catch (err) {
        console.log(err)
    }
}

const setHandlersToManager = (
        getQueueLengthHandler,
        getFirstEntryHandler,
        updateProjectHandler,
    ) => {
    getQueueLength = getQueueLengthHandler
    getFirstEntry = getFirstEntryHandler
    updateProject = updateProjectHandler
}

module.exports = {
    handleSimulation,
    setGridFSBucketsToManager,
    setHandlersToManager
}

const { exec } = require('child_process')
const path = require('path')
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

const appDir = process.env.APP_DIR
const volume = 'simulation_dirs'
const queueManagerUrl = process.env.QUEUE_MANAGER_ADDRESS

const getAll = (req, res) => {
    res.send('Hello')
}

const postDefault = async (req, res) => {

    res.sendStatus(200)

    const inputs = {
        structure: 'structure.pdb',
        energy_min: 'energy_min.mdp',
        MD_simulation: 'MD_simulation.mdp',
        pdb2gmx_params: 'pdb2gmx_params.txt',
        traj_params: 'traj_params.txt',
        genion_params: 'genion_params.txt',
    }

    const output = {
        trajectory: 'trajectory.pdb',
        residues_indexes: 'residues_indexes.txt'
    }

    const body = req.body

    const spheres_allocation_frame = req.body.additional_parameters.spheres_allocation_frame
    const rmsd_threshold = req.body.additional_parameters.rmsd_threshold    

    const cmdsGromacs = {
        cd: `cd ${path.join(appDir, volume, body.dir_name)}`,
        pdb2gmx: `gmx pdb2gmx -f ${inputs.structure} -o conf.pdb < ${inputs.pdb2gmx_params}`,
        editconf: `gmx editconf -f conf.pdb -o box.pdb -d 0.7 `,
        solvate: `gmx solvate -cp box.pdb -cs spc216 -o water.pdb -p topol.top`,
        grompp: `gmx grompp -f ${inputs.energy_min} -c water.pdb -p topol.top -o em.tpr -maxwarn 2`,
        mdrun: `gmx mdrun -v -s em.tpr -c em.pdb`,
        genion: `gmx genion -s em.tpr -o ions.pdb -np 4 -p topol.top < ${inputs.genion_params}`,
        grompp2: `gmx grompp -f ${inputs.energy_min} -c ions.pdb -p topol.top -o em.tpr -maxwarn 2`,
        mdrun2: `gmx mdrun -v -s em.tpr -c em.pdb `,
        grompp3: `gmx grompp -f ${inputs.MD_simulation} -c em.pdb -p topol.top -o md.tpr -maxwarn 2`,
        mdrun3: `gmx mdrun -v -s md.tpr -c md.pdb -nice 0`,
        trjconv: `gmx trjconv -s md.tpr -f traj_comp.xtc -o ${output.trajectory} -dt 1. < ${inputs.traj_params}`
    }

    const rmsdCalculations = {
        calculateRMSD: `rmsd ${output.trajectory} ${output.residues_indexes} ${spheres_allocation_frame} ${rmsd_threshold}`
    }

    const logger = {
        logRMSD: `echo 'Calculating rmsd:\nrmsd ${output.trajectory} ${output.residues_indexes} ${spheres_allocation_frame} ${rmsd_threshold}'`,
        logFinish: `echo 'Finished'`
    }

    const commandsDefault = [
        cmdsGromacs.cd,
        cmdsGromacs.pdb2gmx,
        cmdsGromacs.editconf,
        cmdsGromacs.solvate,
        cmdsGromacs.grompp,
        cmdsGromacs.mdrun,
        cmdsGromacs.genion,
        cmdsGromacs.grompp2,
        cmdsGromacs.mdrun2,
        cmdsGromacs.grompp3,
        cmdsGromacs.mdrun3,
        cmdsGromacs.trjconv,
        logger.logRMSD,
        rmsdCalculations.calculateRMSD,
        logger.logFinish
    ]

    try {

        const cmd = exec(commandsDefault.join(' && '))

        cmd.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });
        
        cmd.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });
        
        cmd.on('close', async (code) => {
            try {
                await fetch(queueManagerUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        ...body,
                        status: 'ok'
                    }),
                    headers: {
                        "Content-type": "application/json; charset=UTF-8"
                    }
                })
                
                console.log(`child process exited with code ${code}`);
            } catch (err) {
                console.log(err)
            }
        });

    } catch (err) {
        console.log(err)
        try {
            await fetch(queueManagerUrl, {
                method: 'POST',
                body: JSON.stringify({
                    ...body,
                    status: 'error'
                }),
                headers: {
                    "Content-type": "application/json; charset=UTF-8"
                },
            })
            
            console.log(`child process exited with code ${code}`);
        } catch (err) {
            console.log(err)
        }
    }

}

module.exports = {
    getAll,
    postDefault,
}
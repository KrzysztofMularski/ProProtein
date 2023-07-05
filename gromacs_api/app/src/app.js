require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const express = require('express');
const app = express();
// todo: port from env
const port = 4000;

const appDir = process.env.APP_DIR;
const volume = process.env.SIMULATIONS_VOLUME;
const queueManagerUrl = process.env.QUEUE_MANAGER_ADDRESS;
const gpuEnable = process.env.GPU_ENABLE === 'true';

let current_process = null;

const getAll = (_, res) => {
    res.send('Hello');
}

// todo: calling this function in admin panel
const killCurrentProcess = (_, res) => {
    try {
        if (current_process) {
            if (current_process.kill('SIGKILL')) {
                return res.sendStatus(200);
            }
        }
        res.sendStatus(504);
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
}

const postDefault = async (req, res) => {
    try { 
        res.sendStatus(200);

        const inputDirectory = path.join(appDir, volume, req.body.dir_name);
        const simulationTemplatesDirectory = path.join(appDir, 'src/simulation_templates');

        // input = {
        //     structure: 'structure.pdb',
        //     ions: 'ions.mdp',
        //     md: 'md.mdp',
        //     minim: 'minim.mdp',
        //     npt: 'npt.mdp',
        //     nvt: 'nvt.mdp',
        // };

        const params = req.body.simulation_parameters;

        // params: {
        //     force_field,
        //     water_model,
        //     simulation_length,
        //     saving_step,
        //     spheres_allocation_frame,
        //     rmsd_threshold,
        // }

        const md_mdp_params = {
            nsteps: parseInt(params.simulation_length)*500000,
            nstenergy: params.saving_step,
            nstlog: params.saving_step,
            'nstxout-compressed': params.saving_step,
        };

        const awkScript = `'
BEGIN {
    param["nsteps"] = "${md_mdp_params.nsteps}";
    param["nstenergy"] = "${md_mdp_params.nstenergy}";
    param["nstlog"] = "${md_mdp_params.nstlog}";
    param["nstxout-compressed"] = "${md_mdp_params['nstxout-compressed']}";
}

{
    if ($1 in param) {
        $3 = param[$1];
        print $1 OFS $2 OFS $3;
    } else {
        print;
    }
}
'`;

        const output = {
            trajectory: 'trajectory.pdb',
            energy_potential: 'energy_potential.png',
            energy_temperature: 'energy_temperature.png',
            energy_pressure: 'energy_pressure.png',
            energy_density: 'energy_density.png',
            md_xtc: 'md_xtc.xtc',
            md_edr: 'md_edr.edr',
            md_tpr: 'md_tpr.tpr',
            residues_indexes: 'residues_indexes.txt',
        };

        const renamingMap = {
            'potential.png': 'energy_potential.png',
            'temperature.png': 'energy_temperature.png',
            'pressure.png': 'energy_pressure.png',
            'density.png': 'energy_density.png',
            'md_0_1.xtc': 'md_xtc.xtc',
            'md_0_1.edr': 'md_edr.edr',
            'md_0_1.tpr': 'md_tpr.tpr',
        };

        const cmdsGromacs = {
            grep: `grep -v HOH structure.pdb > structure_clean.pdb`,
            pdb2gmx: `echo "${params.force_field}\n${params.water_model}\n" | gmx pdb2gmx -f structure_clean.pdb -o structure_processed.gro`,
            editconf: `gmx editconf -f structure_processed.gro -o structure_newbox.gro -c -d 1.0 -bt dodecahedron`,
            solvate: `gmx solvate -cp structure_newbox.gro -cs spc216.gro -o structure_solv.gro -p topol.top`,
            grompp1: `gmx grompp -f ions.mdp -c structure_solv.gro -p topol.top -o ions.tpr`,
            genion: `echo 13 | gmx genion -s ions.tpr -o structure_solv_ions.gro -p topol.top -pname NA -nname CL -neutral`,
            grompp2: `gmx grompp -f minim.mdp -c structure_solv_ions.gro -p topol.top -o em.tpr`,
            mdrun1: `gmx mdrun -v -deffnm em`,
            energy1: `echo "10 0" | gmx energy -f em.edr -o potential.xvg`,
            grompp3: `gmx grompp -f nvt.mdp -c em.gro -r em.gro -p topol.top -o nvt.tpr`,
            mdrun2: `gmx mdrun -deffnm nvt`,
            energy2: `echo "16 0" | gmx energy -f nvt.edr -o temperature.xvg`,
            grompp4: `gmx grompp -f npt.mdp -c nvt.gro -r nvt.gro -t nvt.cpt -p topol.top -o npt.tpr`,
            mdrun3: `gmx mdrun -deffnm npt`,
            energy3: `echo "18 0" | gmx energy -f npt.edr -o pressure.xvg`,
            energy4: `echo "24 0" | gmx energy -f npt.edr -o density.xvg`,
            grompp5: `gmx grompp -f md.mdp -c npt.gro -t npt.cpt -p topol.top -o md_0_1.tpr`,
            mdrun4: `gmx mdrun -deffnm md_0_1`,
            mdrun4_gpu: `gmx mdrun -nb gpu -pin on -deffnm md_0_1`,
            trjconv: `echo "1\n0\n" | gmx trjconv -s md_0_1.tpr -f md_0_1.xtc -o trajectory.pdb -pbc mol -center`,
        };

        const other = {
            gpuEnable: `export GMX_ENABLE_DIRECT_GPU_COMM=1`,
            copyTemplates: `cp ${simulationTemplatesDirectory}/* ${inputDirectory}`,
            cd: `cd ${inputDirectory}`,
            changingMdParameters: `awk ${awkScript} < './md_template.mdp' > './md.mdp'`,
            convertToPng: `python3 converter.py`,
            logRMSD: `echo 'Calculating rmsd:\nrmsd ${output.trajectory} ${output.residues_indexes} ${params.spheres_allocation_frame} ${params.rmsd_threshold}'`,
            calculateRMSD: `rmsd ${output.trajectory} ${output.residues_indexes} ${params.spheres_allocation_frame} ${params.rmsd_threshold}`,
            renameFiles: Object.entries(renamingMap).map(([oldName, newName]) => `mv ${oldName} ${newName}`).join(' && '),
            logStart: 'echo Start: && date',
            logTimestamp: 'echo Timestamp: && date',
            logFinish: 'echo Finished: && date',
        }

        const commandsDefault = [
            other.logStart,
            other.copyTemplates,
            other.cd,
            other.changingMdParameters,
            cmdsGromacs.grep,
            other.logTimestamp,
            cmdsGromacs.pdb2gmx,
            other.logTimestamp,
            cmdsGromacs.editconf,
            other.logTimestamp,
            cmdsGromacs.solvate,
            other.logTimestamp,
            cmdsGromacs.grompp1,
            other.logTimestamp,
            cmdsGromacs.genion,
            other.logTimestamp,
            cmdsGromacs.grompp2,
            other.logTimestamp,
            cmdsGromacs.mdrun1,
            other.logTimestamp,
            cmdsGromacs.energy1,
            other.logTimestamp,
            cmdsGromacs.grompp3,
            other.logTimestamp,
            cmdsGromacs.mdrun2,
            other.logTimestamp,
            cmdsGromacs.energy2,
            other.logTimestamp,
            cmdsGromacs.grompp4,
            other.logTimestamp,
            cmdsGromacs.mdrun3,
            other.logTimestamp,
            cmdsGromacs.energy3,
            other.logTimestamp,
            cmdsGromacs.energy4,
            other.logTimestamp,
            cmdsGromacs.grompp5,
            other.logTimestamp,
            cmdsGromacs[gpuEnable ? 'mdrun4_gpu' : 'mdrun4'],
            other.logTimestamp,
            cmdsGromacs.trjconv,
            other.logTimestamp,
            other.convertToPng,
            other.logTimestamp,
            other.logRMSD,
            other.calculateRMSD,
            other.logTimestamp,
            other.renameFiles,
            other.logFinish,
        ];

        // const tester = {
        //     removeFiles: `rm -rf ./all_output`,
        //     log: `echo 'Tester:\n  input: ${JSON.stringify(input)},\n  params: ${JSON.stringify(params)},\n  output: ${JSON.stringify(output)}\n'`,
        //     copyTestFiles: `cp -r ./all_files ./all_output`,
        //     cd2: `cd ./all_output`,
        // }

        // const commandsTesting = [
        //     cmdsGromacs.cd,
        //     tester.removeFiles,
        //     tester.log,
        //     tester.copyTestFiles,
        //     tester.cd2,
        //     images.convertToPng,
        //     logger.logRMSD,
        //     rmsdCalculations.calculateRMSD,
        //     logger.logFinish
        // ];


        let command = commandsDefault.join(' && ');
        if (gpuEnable) {
            command = other.gpuEnable + ' && ' + command;
        }
        const cmd = exec(command);
        current_process = cmd;

        let outputString = '';

        cmd.stdout.on('data', (data) => {
            // console.log(`stdout: ${data}`);
            outputString += `\nstdout: ${data}`;
        });
        
        cmd.stderr.on('data', (data) => {
            // console.error(`stderr: ${data}`);
            outputString += `\nstderr: ${data}`;
        });
        
        cmd.on('close', async (code) => {
            try {
                current_process = null;
                const is_ok = code === 0;
                
                fs.writeFileSync(path.join(inputDirectory, 'simulation_logs.txt'), outputString);

                await fetch(queueManagerUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        dir_name: req.body.dir_name,
                        project_id: req.body.project_id,
                        status: is_ok ? 'ok' : 'error',
                        exit_code: code,
                    }),
                    headers: {
                        "Content-type": "application/json; charset=UTF-8"
                    }
                })
                
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
                    dir_name: req.body.dir_name,
                    project_id: req.body.project_id,
                    status: 'error',
                }),
                headers: {
                    "Content-type": "application/json; charset=UTF-8"
                },
            })
            
        } catch (err) {
            console.log(err)
        }
    }

}

const start = async () => {

    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    app.all('/', getAll);
    app.all('/kill', killCurrentProcess);
    app.post('/default', postDefault);

    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}

start();


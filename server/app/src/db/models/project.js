const mongoose = require('mongoose')

const fileHelperSchema = new mongoose.Schema({
    file_id: mongoose.Schema.Types.ObjectId,
    filename: String
}, { _id : false })

const structureFileHelperSchema = new mongoose.Schema({
    file_id: mongoose.Schema.Types.ObjectId,
    filename: String,
    is_demo: Boolean
}, { _id : false })

const projectSchema = new mongoose.Schema({
    owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    name: {
        type: String,
        required: true,
        minLength: [2, 'Project name length cannot be less than 2 characters'],
        maxLength: [100, 'Project name length cannot be more than 100 characters']
    },
    status: {
        type: String,
        enum: ['Initial', 'Waiting', 'Processing', 'Finished', 'Error']
    },
    description: {
        type: String,
        maxLength: [400, 'Project description length cannot be more than 400 characters']
    },
    created: {
        type: Date,
        default: Date.now
    },
    waiting_since: {
        type: Date,
    },
    processing_since: {
        type: Date,
    },
    finished_since: {
        type: Date
    },
    parameters_default: {
        type: Boolean,
        default: true
    },
    input: {
        files: {
            structure: {
                type: structureFileHelperSchema,
                default: {}
            },
            energy_min: {
                type: fileHelperSchema,
                default: {}
            },
            MD_simulation: {
                type: fileHelperSchema,
                default: {}
            },
        },
        extra: {
            pdb2gmx_params: {
                type: String,
                default: ''
            },
            traj_params: {
                type: String,
                default: ''
            },
            genion_params: {
                type: String,
                default: ''
            },
            spheres_allocation_frame: {
                type: String,
                default: ''
            },
            rmsd_threshold: {
                type: String,
                default: ''
            }
        }
    },
    output: {
        files: {
            trajectory: {
                type: fileHelperSchema,
                default: {}
            },
            residues_indexes: {
                type: fileHelperSchema,
                default: {}
            },
        }
    }
})

module.exports = mongoose.model('Project', projectSchema)
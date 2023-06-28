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
        required: false,
    },
    guest_email: {
        type: String,
        required: false,
    },
    name: {
        type: String,
        required: true,
        minLength: [1, 'Project name cannot be empty'],
        maxLength: [100, 'Project name length cannot be more than 100 characters']
    },
    status: {
        type: String,
        enum: ['Initial', 'Waiting', 'Processing', 'Finished', 'Error']
    },
    error_msg: {
        type: String,
        required: false,
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
    input: {
        files: {
            structure: {
                type: structureFileHelperSchema,
                default: {}
            },
        },
        extra: {
            force_field: {
                type: String,
                default: '15'
            },
            water_model: {
                type: String,
                default: '7'
            },
            simulation_length: {
                type: String,
                default: '10'
            },
            saving_step: {
                type: String,
                default: '2500'
            },
            spheres_allocation_frame: {
                type: String,
                default: '1'
            },
            rmsd_threshold: {
                type: String,
                default: '10'
            }
        }
    },
    output: {
        files: {
            trajectory: {
                type: fileHelperSchema,
                default: {}
            },
            energy_potential: {
                type: fileHelperSchema,
                default: {}
            },
            energy_temperature: {
                type: fileHelperSchema,
                default: {}
            },
            energy_pressure: {
                type: fileHelperSchema,
                default: {}
            },
            energy_density: {
                type: fileHelperSchema,
                default: {}
            },
            md_xtc: {
                type: fileHelperSchema,
                default: {}
            },
            md_edr: {
                type: fileHelperSchema,
                default: {}
            },
            md_tpr: {
                type: fileHelperSchema,
                default: {}
            },
            residues_indexes: {
                type: fileHelperSchema,
                default: {}
            },
            simulation_logs: {
                type: fileHelperSchema,
                default: {}
            },
        }
    }
})

module.exports = mongoose.model('Project', projectSchema)

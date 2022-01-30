const TemplateFile = require('../db/models/templateFile')

const getHomePage = (req, res) => {
    const messages = req.flash()
    const errors = messages.error
    const successes = messages.success
    res.render('general/_home', { logged: req.isAuthenticated(), selected: 'Home', errors, successes })
}

const getDownloadTemplate = async (req, res, next) => {
    try {
        const templateType = req.params.template
        const template = await TemplateFile.findOne({ template_type: templateType })
        req.fileToDownloadId = template.file_id
        res.attachment(templateType + '.mdp');
        next()
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
    
}

module.exports = {
    getHomePage,
    getDownloadTemplate
}
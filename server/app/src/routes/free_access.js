const TemplateFile = require('../db/models/templateFile')
const pushLog = require('../logging')

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
        // console.log(err)
        await pushLog(err, 'getDownloadTemplate');
        req.flash('error', 'Error while downloading template');
        return res.redirect('/')
    }
    
}

module.exports = {
    getHomePage,
    getDownloadTemplate
}
var UserModel = require('../models/userModel');

async function checkUsername(req, res, next){
    try{
        var existingUser = await UserModel.findOne({username: req.body.username});
    } catch (error) {
        console.error('Error checking username:', error);
        return res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }

    if(existingUser) {
    return res.status(409).json({
        message: 'Username already taken',
        username: existingUser.username
        });
    }

    next();
}

module.exports = checkUsername;
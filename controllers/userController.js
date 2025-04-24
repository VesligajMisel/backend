var UserModel = require('../models/userModel.js');
var bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JWTCheck = require('../middleware/JWTCheck.js');
const { trusted } = require('mongoose');

/**
 * userController.js
 *
 * @description :: Server-side logic for managing users.
 */
module.exports = {

    /**
     * userController.list()
     */
    list: async function (req, res) {
        try{
            var users = await UserModel.find().populate('cosmetics').populate('friends').populate('banner').populate('border');
            return res.status(200).json(users);
        } catch (err){
            return res.status(500).json({
                message: "Error getting users",
                error: err
            })
        }
    },

    /**
     * userController.show()
     */
    show: async function (req, res) {
        var id = req.params.id;

        if(!id){
            return res.status(400).json({
                message: 'Please provide a user id'
            });
        }

        try{
            var user = await UserModel.findOne({ _id: id }).populate('cosmetics').populate('friends').populate('banner').populate('border');

            if (!user) {
                return res.status(404).json({
                        message: 'No such user'
                });
            }

            return res.json(user);
        } catch (err){
            return res.status(500).json({
                message: 'Error when getting user.',
                error: err
            });
        } 
    }, 

    getTopBalance: async function (req, res) {
        var count = req.params.count || 10;

        console.log(count);

        try {
            var users = await UserModel.find().sort({balance: -1}).limit(count).populate('cosmetics').populate('friends').populate('banner').populate('border');

            return res.status(200).json(users);

        } catch (err) {
            return res.status(500).json({
                message: 'Error getting users.',
                error: err
            });
        }
    },

    /**
     * userController.create()
     */
    create: async function (req, res) {
        try {
            if (!req.body.password || !req.body.username || !req.body.mail) {
                return res.status(400).json({
                    message: 'Please provide a username, password and mail',
                });
            }


            // Hash the password
            var password_hash = await bcrypt.hash(req.body.password, 10);

            // Create the user
            var user = new UserModel({
                username: req.body.username,
                password: password_hash,
                picture_path: req.body.picture_path || "default", 
                mail: req.body.mail,
                joined: Date.now(),
                admin: req.body.admin || false,
                balance: req.body.balance || 0,
                border: req.body.border || null,
                banner: req.body.banner || null,
                cosmetics: req.body.cosmetics || [],
                friends: req.body.friends || []
            });

            // Create JWT token

            const jwt_token = jwt.sign({ user_id: user._id }, process.env.JWT_KEY, { expiresIn: '1h' });

            // Save the user
            await user.save();  // Use await instead of a callback

            // Send success response with the token
            return res.status(201).json({
                message: "Created user successfuly",
                token: jwt_token
            });

        } catch (err) {
            // Handle any errors
            return res.status(500).json({
                message: 'Error when creating user',
                error: err
            });
        }
    },


    login: function (req, res) {

        if (!req.body.username || !req.body.password) {
            return res.status(400).json({
                message: 'Please provide a username and password'
            });
        }

        try{
            UserModel.authenticate(req.body.username, req.body.password, function (err, user) {
                if (err || !user) {
                    return res.status(403).json({
                        message: 'Wrong username or password'
                    });
                }
                const jwt_token = jwt.sign({ user_id: user._id }, process.env.JWT_KEY, { expiresIn: '1h' });

                res.json({ token: jwt_token, user: user });
            });
        } catch (err) {
            return res.status(500).json({
                message: 'Error when logging in',
                error: err
            });
        };

    },

    logout: async function (req, res) {
        if (!req.user) {
            return res.status(401).json({
                message: 'Not logged in',
                error: err
            });
        }

        const token = req.headers['authorization'].split(' ')[1];
        JWTCheck.tokenBlacklist.add(token);

        return res.status(200).json({
            message: 'Logged out user',
            user_id: req.user
        });
    },

    addFriend: async function (req, res) {
        const user_id = req.user.user_id;             
        const friend_id = req.params.id;       ž

        if(!friend_id){
            return res.status(400).json({
                message: 'Please provide a friend id'
            });
        }

        if(user_id == friend_id){
            return res.status(400).json({
                message: 'You cannot add yourself as a friend'
            });
        }

        try {
            UserModel.findByIdAndUpdate(
            user_id,
            { $addToSet: { friends: friend_id } },       
            { new: true }                          
            ).then(updatedUser => {
            res.json(updatedUser);
            }).catch(err => {
            res.status(500).json({ error: 'Error adding friend', details: err });
            });
        }catch (err) {
            return res.status(500).json({
                message: 'Error adding friend',
                error: err
            });
        }
    },

    removeFriend: async function (req, res) {
        const user_id = req.user.user_id;             
        const friend_id = req.params.id;      
        
        if(!friend_id){
            return res.status(400).json({
                message: 'Please provide a friend id'
            });
        }

        if(user_id == friend_id){
            return res.status(400).json({
                message: 'You cannot remove yourself as a friend'
            });
        }
        
        try {
            UserModel.findByIdAndUpdate(
            user_id,
            { $pull: { friends: friend_id } },       
            { new: true }                          
            ).then(updatedUser => {
            res.json(updatedUser);
            }).catch(err => {
            res.status(500).json({ error: 'Error adding friend', details: err });
            });
        }
        catch (err) {
            return res.status(500).json({
                message: 'Error removing friend',
                error: err
            });
        }
    },

    addBalance: async function (req, res) {

        if(!req.body.amount){
            return res.status(400).json({
                message: 'Please provide an amount'
            });
        }


        try {
            if(isNaN(req.body.amount) || req.body.amount <= 0){
                return res.status(400).json({
                    message: 'Added balance must be positive'
                })
            }

            var user = await UserModel.findByIdAndUpdate(req.user.user_id, {$inc: {balance: req.body.amount}}, {new: true})

            return res.status(200).json({
                message: 'Success adding balance',
                balance: user.balance
            });
        } catch(err){
            return res.status(500).json({
                message: 'Error adding balance',
                err: err
            });
        }
    },
     
    removeBalance: async function (req, res) {

        if(!req.body.amount){
            return res.status(400).json({
                message: 'Please provide an amount'
            });
        }

        try {

            var user = await UserModel.findById(req.user.user_id);

            if(!user){
                return res.status(404).json({
                    message: 'User not found'
                })
            }

            if(isNaN(req.body.amount) || req.body.amount <= 0){
                return res.status(400).json({
                    message: 'Removed balance must be positive'
                })
            }

            user.balance -= req.body.amount;

            if(user.balance < 0){
                return res.status(400).json({
                    message: 'New balance must be positive',
                });
            } else {
                await user.save();
                
                return res.status(200).json({
                    message: 'Success removing balance',
                    balance: user.balance
                });
            }
        } catch(err){
            return res.status(500).json({
                message: 'Error removing balance',
                err: err
            });
        }
    },

    getBalance: async function (req, res) {
        try {
            var user = await UserModel.findById(req.user.user_id);


            if(!user){
                return res.status(404).json({
                    message: 'User not found'
                });
            }

            return res.status(200).json({
                balance: user.balance
            })

        } catch (err) {
            return res.status(500).json({
                message: 'Error getting balance',
                err: err
            })
        }
    },

    buyItem: async function (req, res) {

    },


    /**
     * userController.update()
     */
    update: async function (req, res) {
        var id = req.params.id;

        if (!id) {
            return res.status(400).json({
                message: 'Please provide a user id'
            });
        }

        try {
            // Find the user by ID
            const user = await UserModel.findOne({ _id: id });

            if (!user) {
                return res.status(404).json({
                    message: 'No such user'
                });
            }

            // Update user fields with new data, if provided
            user.username = req.body.username ?? user.username;
            user.password = req.body.password ?? user.password;
            user.picture_path = req.file.filename ?? user.picture_path;
            user.mail = req.body.mail ?? user.mail;
            user.date = req.body.date ?? user.date;
            user.admin = req.body.admin ?? user.admin;
            user.balance = req.body.balance ?? user.balance;
            user.banner = req.body.banner ?? user.banner;
            user.border = req.body.border ?? user.border;
            user.cosmetics = req.body.cosmetics ?? user.cosmetics;
            user.friends = req.body.friends ?? user.friends;

            // Save the updated user
            await user.save();

            // Respond with the updated user
            return res.json(user);

        } catch (err) {
            return res.status(500).json({
                message: 'Error when updating user.',
                error: err
            });
        }
    },

    resetPassword: async function (req, res){

        if (!req.body.old_password || !req.body.new_password) {
            return res.status(400).json({
                message: 'Please provide a old and new password'
            });
        }

        try {
            var user = await UserModel.findById(req.user.user_id);

            if (!user) {
                return res.status(404).json({
                    message: 'No such user'
                });
            }

            const isMatch = await bcrypt.compare(req.body.old_password, user.password);

            if(!isMatch){
                return res.status(403).json({
                    message: "Mismatched passwords."
                });
            } else {
                user.password = await bcrypt.hash(req.body.new_password, 10);

                await user.save()

                return res.status(200).json({
                    message: 'Success updating password'
                })
            }

        } catch (err) {
            return res.status(500).json({
                message: 'Error when changing password'
            })
        }
    },
    

    /**
     * userController.remove()
     */
    remove: async function (req, res) {

        if (!req.params.id) {
            return res.status(400).json({
                message: 'Please provide a user id'
            });
        }
    

        try{
            var id = req.params.id;

            await UserModel.findByIdAndDelete(id);

            return res.status(200).json({
                message: 'Success deleting user'
            });
        } catch (err){
            return res.status(500).json({
                message: 'Error deleting user'
            })
        }

    }
};

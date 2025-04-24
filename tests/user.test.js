const request = require('supertest');
const app = require('../app');
const UserModel = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

jest.mock('../models/userModel');
jest.mock('../middleware/JWTCheck.js', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { user_id: '1234567890abcdef12345678' };
        next();
    },
    tokenBlacklist: {
        add: jest.fn()
    }
}));

jest.spyOn(jwt, 'sign').mockReturnValue('mocktoken');
jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedpass');

UserModel.find = jest.fn();
UserModel.findById = jest.fn();
UserModel.findOne = jest.fn();
UserModel.findByIdAndDelete = jest.fn();
UserModel.findByIdAndUpdate = jest.fn();
UserModel.prototype.save = jest.fn();
UserModel.authenticate = jest.fn();

const mockUser = {
    _id: '1234567890abcdef12345678',
    username: 'testuser',
    password: 'hashedpass',
    mail: 'test@example.com',
    balance: 100,
    profile_picture: '/test.png',
    friends: []
};

describe('User API Endpoints', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /', () => {
        it('should return all users', async () => {
            UserModel.find.mockReturnValue({
                populate: () => ({
                    populate: () => ({
                        populate: () => ({
                            populate: () => [mockUser]
                        })
                    })
                })
            });

            const res = await request(app).get('/user');
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual([mockUser]);
        });
    });

    describe('GET /balance', () => {
        it('should return user balance', async () => {
            UserModel.findById.mockResolvedValue(mockUser);
            const res = await request(app).get('/user/balance');
            expect(res.statusCode).toBe(200);
        });
    });

    describe('GET /get_top_balance/:count', () => {
        it('should return users with top balances', async () => {
            UserModel.find.mockReturnValue({
                sort: () => ({
                    limit: () => ({
                        populate: () => ({
                            populate: () => ({
                                populate: () => ({
                                    populate: () => [mockUser]
                                })
                            })
                        })
                    })
                })
            });

            const res = await request(app).get('/user/get_top_balance/5');
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual([mockUser]);
        });
    });

    describe('GET /:id', () => {
        it('should return user by ID', async () => {
            UserModel.findOne.mockReturnValue({
                populate: () => ({
                    populate: () => ({
                        populate: () => ({
                            populate: () => mockUser
                        })
                    })
                })
            });

            const res = await request(app).get(`/user/${mockUser._id}`);
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual(mockUser);
        });
    });

    describe('POST /register', () => {
        it('should register a new user', async () => {
            UserModel.findOne.mockResolvedValue(null);
            UserModel.prototype.save.mockResolvedValue(mockUser);
            const res = await request(app)
                .post('/user/register')
                .field('username', 'testuser')
                .field('password', 'password')
                .field('mail', 'test@example.com');
            expect(res.statusCode).toBe(201);
        });
    });

    describe('POST /login', () => {
        it('should login a user and return a token', async () => {
            jest.setTimeout(10000);
            UserModel.authenticate.mockImplementation((username, password, cb) => {
                cb(null, mockUser);
            });
            const res = await request(app)
                .post('/user/login')
                .send({ username: 'testuser', password: 'password' });
            expect(res.statusCode).toBe(200);
            expect(res.body.token).toBe('mocktoken');
        });
    });

    describe('POST /logout', () => {
        it('should logout the user', async () => {
            const res = await request(app).post('/user/logout').set('Authorization', 'Bearer mocktoken');
            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Logged out user');
        });
    });

    describe('POST /add_friend/:id', () => {
        it('should add a friend', async () => {
            const updatedUser = { ...mockUser, friends: ['another_user_id'] };
            UserModel.findByIdAndUpdate.mockResolvedValue(updatedUser);
            const res = await request(app).post('/user/add_friend/another_user_id');
            expect(res.statusCode).toBe(200);
            expect(res.body.friends).toContain('another_user_id');
        });
    });

    describe('POST /remove_friend/:id', () => {
        it('should remove a friend', async () => {
            const updatedUser = { ...mockUser, friends: [] };
            UserModel.findByIdAndUpdate.mockResolvedValue(updatedUser);
            const res = await request(app).post('/user/remove_friend/another_user_id');
            expect(res.statusCode).toBe(200);
            expect(res.body.friends).not.toContain('another_user_id');
        });
    });

    describe('POST /add_balance', () => {
        it('should add balance to the user', async () => {
            const updatedUser = { ...mockUser, balance: 150 };
            UserModel.findByIdAndUpdate.mockResolvedValue(updatedUser);
            const res = await request(app).post('/user/add_balance').send({ amount: 50 });
            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Success adding balance');
        });
    });

    describe('PUT /reset_password', () => {
        it('should reset password successfully', async () => {
            const userWithSave = {
                ...mockUser,
                save: jest.fn().mockResolvedValue(mockUser)
            };
            UserModel.findById.mockResolvedValue(userWithSave);
            bcrypt.compare.mockResolvedValue(true);
            bcrypt.hash.mockResolvedValue('new_hashed_password');

            const res = await request(app)
                .put('/user/reset_password')
                .send({ old_password: 'oldpass', new_password: 'newpass' });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Success updating password');
        });

        it('should return 403 if old password is incorrect', async () => {
            const userWithSave = { ...mockUser, save: jest.fn() };
            UserModel.findById.mockResolvedValue(userWithSave);
            bcrypt.compare.mockResolvedValue(false);

            const res = await request(app)
                .put('/user/reset_password')
                .send({ old_password: 'wrong', new_password: 'newpass' });

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toBe('Mismatched passwords.');
        });

        it('should return 404 if user is not found', async () => {
            UserModel.findById.mockResolvedValue(null);

            const res = await request(app)
                .put('/user/reset_password')
                .send({ old_password: 'any', new_password: 'newpass' });

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('No such user');
        });
    });

    describe('POST /remove_balance', () => {
        it('should remove balance successfully', async () => {
            const updatedUser = {
                ...mockUser,
                balance: 100,
                save: jest.fn().mockResolvedValue({ ...mockUser, balance: 50 })
            };
            UserModel.findById.mockResolvedValue(updatedUser);

            const res = await request(app)
                .post('/user/remove_balance')
                .send({ amount: 50 });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Success removing balance');
            expect(res.body.balance).toBe(50);
        });

        it('should return 400 if amount is invalid', async () => {
            const res = await request(app)
                .post('/user/remove_balance')
                .send({ amount: -10 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Removed balance must be positive');
        });

        it('should return 404 if user not found', async () => {
            UserModel.findById.mockResolvedValue(null);

            const res = await request(app)
                .post('/user/remove_balance')
                .send({ amount: 50 });

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('User not found');
        });

        it('should return 400 if resulting balance is negative', async () => {
            const updatedUser = {
                ...mockUser,
                balance: 30,
                save: jest.fn()
            };
            UserModel.findById.mockResolvedValue(updatedUser);

            const res = await request(app)
                .post('/user/remove_balance')
                .send({ amount: 50 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('New balance must be positive');
        });
    });
});

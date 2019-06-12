const { version } = require('../../package.json');
const { Router } = require('express');
const User = require('../database/mongooseModels/User');
const {forceAuthorized, hasPermissions} = require('../middleware/Authenticate');
const authRoutes = require('./auth');
const userRoutes = require('./user');
const profileRoutes = require('./profile');
const operatorRoutes = require('./operator');
const resourceRoutes = require('./resources');
const swapRoutes = require('./swap');
const seedRoutes = require('./seed');

module.exports = ({ config, db }) => {
	let api = Router();
	// mount the facets resource
	// api.use('/facets', facets({ config, db }));
	api.use('/auth', authRoutes);
	api.use('/user', forceAuthorized, userRoutes);
	api.use('/swap', swapRoutes);
	api.use('/profile', profileRoutes);
  	api.use('/operator', hasPermissions(User.PERMISSION_OPERATOR), operatorRoutes);
	api.use('/resource', resourceRoutes);
	api.use('/seed', hasPermissions(User.PERMISSION_ADMIN), seedRoutes);
	// perhaps expose some API metadata at the root
	api.get('/', (req, res) => {
		res.json({ version });
	});

	return api;
}

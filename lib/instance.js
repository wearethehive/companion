var system;
var debug   = require('debug')('lib/instance');
var shortid = require('shortid');
var fs      = require('fs');

function instance(system) {
	var self = this;

	self.system = system;
	self.active = {};
	self.modules = {};
	self.status = {};
	self.store = {
		module: [],
		db: {
		}
	};

	system.on('instance_save', function(){
		system.emit('db_set', 'instance', self.store.db);
		system.emit('db_save');
	});

	// levels: null = unknown, 0 = ok, 1 = warning, 2 = error
	system.on('instance_status_update', function(instance, level, msg) {
		self.status[instance] = [level,msg];
		system.emit('instance_status', self.status);
	});

	system.on('instance_init', function() {

		debug('instance_init', self.store.db);

		var path = require('app-root-path') + '/lib/module';
		var module_folders = fs.readdirSync(path);

		for (var i = 0; i < module_folders.length; ++i) {
			var folder = module_folders[i];

			try {
				var mod = require(path + '/' + folder + '/' + folder + '.js');

				self.store.module.push(mod.module_info);
				self.modules[folder] = mod;

				debug("Module " + folder + " loaded. Version " + mod.module_info.version);
				system.emit('log', 'module('+folder+')', 'info', 'Loaded module version '+mod.module_info.version);

			} catch (e) {

				debug("Error loading module " + folder, e);
				system.emit('log', 'module('+folder+')', 'error', 'Error loading module: '+ e);

			}
		}

		for (var id in self.store.db) {
			(function (id) {
				var config = self.store.db[id];

				if (self.modules[config.instance_type] !== undefined) {
					var mod = self.modules[config.instance_type];
					self.active[id] = new mod(self.system, id, config);

					if (typeof self.active[id].upgradeConfig == 'function') {
						self.active[id].upgradeConfig();
					}

					if (typeof self.active[id]._init == 'function') {
						debug("Running _init of " + id);
						self.active[id]._init();
					}
				}

				else {
					debug("Configured instance " + config.instance_type + " could not be loaded, unknown module");
					system.emit('log', 'instance('+config.instance_type+')', 'error', "Configured instance " + config.instance_type + " could not be loaded, unknown module");
				}

			})(id);
		}

	});

	system.emit('db_get', 'instance', function(res) {
		if (res === undefined) {
			self.store.db = {};
		}
		else {
			self.store.db = res;
		}
		system.emit('instance_init');
	})

	system.emit('io_get', function(io) {
		self.io = io;

		system.on('instance_status', function(obj) {
			io.emit('instance_status', obj);
		});

		io.on('connect', function(client) {
			self.connect(client);
		});
	});

	system.on('action_run', function(action) {

		if (self.active[action.instance] !== undefined) {
			self.active[action.instance].action(action);
		}
		else {
			debug("trying to run action on a deleted instance.", action)
		}

	});

	return self;
}

instance.prototype.connect = function (client) {
	var self = this;

	client.on('instance_get', function() {
		client.emit('instance', self.store);
	});

	client.on('instance_edit', function(id) {
		var res = self.active[id].config_fields();

		res.unshift({
			type: 'textinput',
			id: 'label',
			label: 'Label',
			width: 12
		});

		client.emit(
			'instance_edit:result',
			id,
			self.store,
			res,
			self.store.db[id]
		);

		self.system.emit('instance_save');

	});

	client.on('instance_config_set', function(id, key, val) {
		self.store.db[id][key] = val;
		self.system.emit('instance_save');
		console.log('hallo config for faen',id,key,val);
		self.io.emit('instance_db_update', self.store.db);
	});

	client.on('instance_status_get', function() {
		client.emit('instance_status', self.status);
	});

	client.on('instance_delete', function(id) {
		self.system.emit('instance_delete', id);
		self.system.emit('log', 'instance('+id+')', 'debug', 'instance deleted');
		self.active[id].destroy();
		delete self.active[id];
		delete self.status[id];
		delete self.store.db[id];
		self.system.emit('instance_save');
	});

	client.on('instance_add', function(module) {
		var mod = self.modules[module];
		var id = shortid.generate();
		self.store.db[id] = {};

		self.system.emit('log', 'instance('+id+')', 'debug', 'instance add ' + module);

		try {
			self.active[id] = new mod(self.system, id, self.store.db[id]);

			if (self.active[id]._versionscripts !== undefined && self.active[id]._versionscripts.length > 0) {
				// New instances do not need to be upgraded
				self.store.db[id]._configIdx = self.active[id]._versionscripts.length - 1;
			}

			if (typeof self.active[id]._init == 'function') {
				self.active[id]._init();
			}
		} catch(e) {
			self.system.emit('log', 'instance('+id+')', 'error', 'instance add failed');
			debug("INSTANCE ADD EXCEPTION:", e);
		}

		self.store.db[id].instance_type = module;
		self.store.db[id].label = module;
		self.io.emit('instance_add:result', id, self.store.db);
		debug('instance_add', id);
		self.system.emit('instance_save');
		self.system.emit('actions_update')
	});

};

exports = module.exports = function (system) {
	return new instance(system);
};

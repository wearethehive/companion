var net = require('net');
var instance_skel = require('../../instance_skel');
var debug;
var log;

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	return self;
}

instance.prototype.init = function() {
	var self = this;

	debug = self.debug;
	log = self.log;

	self.status(1, 'Connecting');

	self.socket = new net.Socket();
	self.socket.setKeepAlive(true);
	self.socket.setNoDelay(true);

	self.socket.on('error', (err) => {
		debug("Network error", err);
		self.log('error',"Network error: " + err.message);
		self.status(2,err.message); // error!
	});

};

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Production Computer IP',
			width: 6
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;
	self.socket.end();
	debug("destory", self.id);;
};

instance.prototype.actions = function(system) {
	var self = this;
	self.system.emit('instance_actions', self.id, {
		'run': {
			label: 'Run',
			options: [{
				type: 'textinput',
				label: 'timeline (optional)',
				id: 'timeline',
				default: ''
			}]},
		'halt': {
			 label: 'Pause',
			 options: [{
				 type: 'textinput',
				 label: 'timeline (optional)',
				 id: 'timeline',
				 default: ''
			}]},
		'kill': {
			label: 'Kill',
			options: [{
				type: 'textinput',
				label: 'Aux timeline',
				id: 'timeline',
				default: ''
			}]},
		'gototime': {
			label: 'Jump to time',
			options: [{
				type: 'textinput',
				label: 'time position',
				id: 'time',
				default: '"00:00:00.000"'
			},{
				type: 'textinput',
				label: 'timeline (optional)',
				id: 'timeline',
				default: ''
			}]},
		'gotocue': {
			label: 'Jump to cue',
			options: [{
				type: 'textinput',
				label: 'Cue name',
				id: 'cuename',
				default: ''
			},{
				type: 'textinput',
				label: 'timeline (optional)',
				id: 'timeline',
				default: ''
			}]},
		'online': { label: 'Go online',
			options: [{
				type: 'textinput',
				label: 'go online',
				id: 'online',
				default: 'true'
			}]},
		'standby': { label: 'Enter Standby',
			options: [{
				type: 'textinput',
				label: 'Enter Standby',
				id: 'standby',
				default: 'true'
			}]},
		'setinput': {
			label: 'Set Input',
				options: [{
				type: 'textinput',
				label: 'Input Name',
				id: 'inputname',
				default: ''
			},{
				type: 'textinput',
				label: 'Value',
				id: 'inputvalue',
				default: '1.0'
			},{
				type: 'textinput',
				label: 'Fadetime (ms)',
				id: 'inputfade',
				default: '0'
			}]}

	});
}

instance.prototype.action = function(action) {
	var self = this;
	debug('run watchout action:', action);
	var cmd;

	switch (action.action) {
		case 'run':
			if (action.options.timeline != '')
				cmd = 'run "' + action.options.timeline + '"\r\n'
			else
				cmd = 'run\r\n'
			break;

		case 'halt':
			if (action.options.timeline != '')
				cmd = 'halt "' + action.options.timeline + '"\r\n'
			else
				cmd = 'halt\r\n'
			break;

		case 'kill':
			if (action.options.timeline != '')
				cmd = 'kill "' + action.options.timeline + '"\r\n'
			else {
				debug('Error: Kill command for Watchout production triggered without timeline name');
				self.log('error', 'Error: Kill command for Watchout production triggered without timeline name');
			}
			break;

		case 'gototime':
			if (action.options.time != '') {
				cmd = 'gotoTime ' + action.options.time;
				if (action.options.timeline != '') cmd += ' "'+ action.options.timeline + '"';
				cmd += '\r\n';
			} else {
				debug('Error: Gototime command for Watchout production triggered without entering time');
				self.log('error', 'Error: Gototime command for Watchout production triggered without entering time');
			}
			break;

		case 'gotocue':
			if (action.options.cuename != '') {
				cmd = 'gotoControlCue "' + action.options.cuename +'" false';
				if (action.options.timeline != '') cmd += ' "'+ action.options.timeline +'"';
				cmd += '\r\n';
			} else {
				debug('Error: GotoControlCue command for Watchout production triggered without entering cue');
				self.log('error', 'Error: GotoControlCue command for Watchout production triggered without entering cue');
			}
			break;

		case 'online':
			if (action.options.online != 'false' && action.options.online != 'FALSE' && action.options.online != '0' )
				cmd = 'online true\r\n'
			else
				cmd = 'online false\r\n'
			break;

		case 'standby':
			if (action.options.standby != 'false' && action.options.standby != 'FALSE' && action.options.standby != '0' )
				cmd = 'standBy true\r\n'
			else
				cmd = 'standBy false\r\n'
			break;

		case 'setinput':
			if (action.options.inputname != '' && action.options.inputvalue != '') {
				cmd = 'setInput "' + action.options.inputname +'" '+ parseFloat(action.options.inputvalue);
				if (action.options.inputfade != '') cmd += ' '+ parseInt(action.options.inputfade);
				cmd += '\r\n';
			} else {
				debug('Error: setInput command for Watchout production triggered without entering input name or input value');
				self.log('error', 'Error: setInput command for Watchout production triggered without entering input name or input value');
			}
			break;

	}

	if (cmd !== undefined) {

		debug('sending tcp',cmd,"to",self.config.host);

		if ( !self.socket.readable ) {
			self.socket.connect(3040, self.config.host, function() {
				self.log('info', 'Client connected')
				self.status(0);
			});
		}

		self.socket.write(cmd);

	}
};

instance.module_info = {
	label: 'Dataton Watchout Production',
	id: 'watchout_production',
	version: '0.0.1'
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;

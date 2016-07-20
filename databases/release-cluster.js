const Cluster = require('cluster');
const Os = require('os');

function master() {

	console.log('==================== CLUSTER =======================');
	console.log('PID          : ' + process.pid);
	console.log('Node.js      : ' + process.version);
	console.log('Forks        : {0} threads');
	console.log('====================================================');

	for (var i = 0; i < {0}; i++) {
		var fork = Cluster.fork();
		fork.send({ type: 'id', id: i });
	}
}

function fork() {
	require('total.js');

	F.on('message', function(message) {
		if (message.type === 'id')
			framework.id = message.id;
	});

	F.http('release');
}

Cluster.isMaster ? master() : fork();
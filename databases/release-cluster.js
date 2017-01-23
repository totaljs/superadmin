const Cluster = require('cluster');
const Os = require('os');

function master() {

	console.log('==================== CLUSTER =======================');
	console.log('PID          : ' + process.pid);
	console.log('Node.js      : ' + process.version);
	console.log('Forks        : {0} threads');
	console.log('====================================================');

	for (var i = 0; i < {0}; i++)
		Cluster.fork().send({ type: 'id', id: i });

	process.title = 'total: cluster';
}

function fork() {
	require('total.js');

	F.on('message', function(message) {
		if (message.type === 'id')
			framework.id = message.id;
	});

	F.http('release', { ip: '0.0.0.0' });
}

Cluster.isMaster ? master() : fork();
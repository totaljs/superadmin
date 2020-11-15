WAIT(function() {
	return CodeMirror.defineSimpleMode;
}, function() {
	CodeMirror.defineSimpleMode('totaljs-tags', {
		start: [
			{ regex: /@{/,     push: 'totaljs', token: 'variable-T' },
			{ regex: /{\{/,    push: 'tangular', token: 'variable-A' },
			{ regex: /@\(/,    push: 'localization', token: 'variable-L' }
		],

		tangular: [
			{ regex: /\}\}/, pop: true, token: 'variable-A' },
			{ regex: /./, token: 'variable-A' }
		],

		totaljs: [
			{ regex: /\}/, pop: true, token: 'variable-T' },
			{ regex: /./, token: 'variable-T' }
		],

		localization: [
			{ regex: /\)/, pop: true, token: 'variable-L' },
			{ regex: /./, token: 'variable-L' }
		]
	});

	CodeMirror.defineMode('totaljs', function(config, parserConfig) {
		var totaljs = CodeMirror.getMode(config, 'totaljs-tags');
		if (!parserConfig || !parserConfig.base) return totaljs;
		return CodeMirror.multiplexingMode(CodeMirror.getMode(config, parserConfig.base), { open: /(@\{|\{\{|@\()/, close: /(\}\}|\}|\))/, mode: totaljs, parseDelimiters: true });
	});

	CodeMirror.defineMIME('text/totaljs', 'totaljs');
});

CodeMirror.defineMode('totaljsresources', function() {

	var REG_KEY = /^[a-z0-9_\-.#]+/i;
	return {

		startState: function() {
			return { type: 0, keyword: 0 };
		},

		token: function(stream, state) {

			var m;

			if (stream.sol()) {

				var line = stream.string;
				if (line.substring(0, 2) === '//') {
					stream.skipToEnd();
					return 'comment';
				}

				state.type = 0;
			}

			m = stream.match(REG_KEY, true);
			if (m)
				return 'tag';

			if (!stream.string) {
				stream.next();
				return '';
			}

			var count = 0;

			while (true) {

				count++;
				if (count > 5000)
					break;

				var c = stream.peek();
				if (c === ':') {
					stream.skipToEnd();
					return 'def';
				}

				if (c === '(') {
					if (stream.skipTo(')')) {
						stream.eat(')');
						return 'variable-L';
					}
				}

			}

			stream.next();
			return '';
		}
	};
});
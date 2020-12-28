COMPONENT('exec', function(self, config) {
	self.readonly();
	self.blind();
	self.make = function() {

		var scope = null;

		var scopepath = function(el, val) {
			if (!scope)
				scope = el.scope();
			return val == null ? scope : scope ? scope.makepath ? scope.makepath(val) : val.replace(/\?/g, el.scope().path) : val;
		};

		var fn = function(plus) {
			return function(e) {

				var el = $(this);
				var attr = el.attrd('exec' + plus);
				var path = el.attrd('path' + plus);
				var href = el.attrd('href' + plus);
				var def = el.attrd('def' + plus);
				var reset = el.attrd('reset' + plus);

				scope = null;

				var prevent = el.attrd('prevent' + plus);

				if (prevent === 'true' || prevent === '1') {
					e.preventDefault();
					e.stopPropagation();
				}

				if (attr) {
					if (attr.indexOf('?') !== -1) {
						var tmp = scopepath(el);
						if (tmp) {
							M.scope(tmp.path);
							attr = tmp.makepath ? tmp.makepath(attr) : attr.replace(/\?/g, tmp.path);
						}
					}
					EXEC(attr, el, e);
				}

				href && NAV.redirect(href);

				if (def) {
					if (def.indexOf('?') !== -1)
						def = scopepath(el, def);
					DEFAULT(def);
				}

				if (reset) {
					if (reset.indexOf('?') !== -1)
						reset = scopepath(el, reset);
					RESET(reset);
				}

				if (path) {
					var val = el.attrd('value');
					if (val) {
						if (path.indexOf('?') !== -1)
							path = scopepath(el, path);
						var v = GET(path);
						SET(path, new Function('value', 'return ' + val)(v), true);
					}
				}
			};
		};

		self.event('dblclick', config.selector2 || '.exec2', fn('2'));
		self.event('click', config.selector || '.exec', fn(''));
	};
});

COMPONENT('loading', function(self, config, cls) {

	var delay;
	var prev;

	self.readonly();
	self.singleton();
	self.nocompile();

	self.make = function() {
		self.aclass(cls + ' ' + cls + '-' + (config.style || 1));
		self.append('<div><div class="' + cls + '-text hellip"></div></div>');
	};

	self.show = function(text) {
		clearTimeout(delay);

		if (prev !== text) {
			prev = text;
			self.find('.' + cls + '-text').html(text || '');
		}

		self.rclass('hidden');
		return self;
	};

	self.hide = function(timeout) {
		clearTimeout(delay);
		delay = setTimeout(function() {
			self.aclass('hidden');
		}, timeout || 1);
		return self;
	};

});

COMPONENT('websocket', 'reconnect:3000;encoder:true', function(self, config) {

	var ws, url;
	var queue = [];
	var sending = false;

	self.online = false;
	self.readonly();
	self.nocompile && self.nocompile();

	self.make = function() {
		url = (config.url || '').env(true);
		if (!url.match(/^(ws|wss):\/\//))
			url = (location.protocol.length === 6 ? 'wss' : 'ws') + '://' + location.host + (url.substring(0, 1) !== '/' ? '/' : '') + url;
		setTimeout(self.connect, 500);
		self.destroy = self.close;

		$(W).on('offline', function() {
			self.close();
		});

		$(W).on('online', function() {
			setTimeout(self.connect, config.reconnect);
		});

	};

	self.send = function(obj) {
		var data = JSON.stringify(obj);
		if (config.encoder)
			queue.push(encodeURIComponent(data));
		else
			queue.push(data);
		self.process();
		return self;
	};

	self.process = function(callback) {

		if (!ws || !ws.send || sending || !queue.length || ws.readyState !== 1) {
			callback && callback();
			return;
		}

		sending = true;
		var async = queue.splice(0, 3);

		async.wait(function(item, next) {
			if (ws) {
				ws.send(item);
				setTimeout(next, 5);
			} else {
				queue.unshift(item);
				next();
			}
		}, function() {
			callback && callback();
			sending = false;
			queue.length && self.process();
		});
	};

	self.close = function(isClosed) {
		if (!ws)
			return self;
		self.online = false;
		ws.onopen = ws.onclose = ws.onmessage = null;
		!isClosed && ws.close();
		ws = null;
		self.isonline(false);
		return self;
	};

	self.isonline = function(is) {
		if (config.online)
			self.EXEC(config.online, is);
		else
			EMIT('online', is);
	};

	function onClose(e) {

		if (e.code === 4001) {
			location.href = location.href + '';
			return;
		}

		e.reason && WARN('WebSocket:', config.encoder ? decodeURIComponent(e.reason) : e.reason);
		self.close(true);
		setTimeout(self.connect, config.reconnect);
	}

	function onMessage(e) {

		var data;

		try {
			data = PARSE(config.encoder ? decodeURIComponent(e.data) : e.data);
		} catch (e) {
			return;
		}

		if (config.message)
			self.EXEC(config.message, data);
		else
			EMIT('message', data);
	}

	function onOpen() {
		self.online = true;
		self.process(function() {
			self.isonline(true);
		});
	}

	self.connect = function() {
		ws && self.close();
		setTimeout2(self.ID, function() {
			ws = new WebSocket(url.env(true));
			ws.onopen = onOpen;
			ws.onclose = onClose;
			ws.onmessage = onMessage;
		}, 100);
		return self;
	};
});

COMPONENT('console', function(self, config, cls) {

	var cls2 = '.' + cls;
	var etabs, source ,elogs, current;
	var ready = false;

	self.singleton();
	self.readonly();

	self.make = function() {

		self.aclass(cls + ' hidden');
		self.append('<div class="{0}-body"><div class="{0}-tabs"><span class="{0}-close"><i class="fa fa-times"></i></span><div></div></div><div class="{0}-output"></div></div>'.format(cls));

		etabs = self.find(cls2 + '-tabs > div');
		elogs = self.find(cls2 + '-output');

		self.event('click', cls2 + '-tab', function() {
			var el = $(this);
			var id = el.attrd('id');
			self.show(id);
		});

		self.event('click', cls2 + '-close', function() {
			self.set(false);
		});

		$(W).on('resize', self.resize);
		self.resize();
	};

	self.resize = function() {
		elogs.css('width', WW + 30);
	};

	self.render_tabs = function() {

		if (!source)
			return;

		var keys = Object.keys(source);
		var builder = [];

		for (var i = 0; i < keys.length; i++) {
			var item = source[keys[i]];

			if (!current)
				current = keys[i];

			var icon = item.icon.indexOf(' ') === -1 ? ('fa ' + item.icon) : item.icon;
			builder.push(('<span title="{1}" data-id="{2}" class="' + cls + '-tab{3}"><i class="{0}"></i>{1}</span>').format(icon + (item.name ? '' : '" style="margin-right:0'), item.name, keys[i], current === keys[i] ? (' ' + cls + '-selected') : ''));
		}

		etabs.html(builder.join(''));
		current && self.render_logs(source[current]);
	};

	self.render_logs = function(obj) {

		if (!obj) {
			elogs.empty();
			return;
		}

		var builder = [];
		var arr = obj.items || EMPTYARRAY;

		for (var i = 0; i < arr.length; i++) {
			var item = arr[i];
			var type = item.type || 'info';
			var icon = type === 'error' ? 'bug' : type === 'warning' ? type : type === 'success' ? 'check-circle' : 'info-circle';
			builder.push('<div class="{0}-message {0}-{2}"><i class="fa fa-{3}"></i>{1}</div>'.format(cls, Thelpers.encode(item.body), type, icon));
		}

		elogs.html(builder.join(''));
		elogs[0].scrollTop = 0;
	};

	self.show = function(id) {

		if (current === id || !ready)
			return;

		etabs.find(cls2 + '-selected').rclass(cls + '-selected');
		etabs.find(cls2 + '-tab[data-id="{0}"]'.format(id)).aclass(cls + '-selected');
		current = id;
		self.render_logs(source[id]);
	};

	self.rebind = function(path, value) {

		if (!ready)
			return;

		source = value;
		if (path === config.datasource)
			self.render_tabs();
		else if (path.substring(config.datasource.length + 1).substring(0, current.length) === current)
			self.render_logs(source[current]);
	};

	self.configure = function(key, value) {
		if (key === 'datasource')
			self.datasource(value, self.rebind);
	};

	self.setter = function(value) {

		if (value && !ready) {
			ready = true;
			self.rebind(config.datasource, GET(config.datasource));
		}

		if (value) {
			self.rclass('hidden');
			self.aclass(cls + '-visible', 100);
		} else {
			self.rclass('hidden', 100);
			self.rclass(cls + '-visible');
		}
	};
});

COMPONENT('mainprogress', function(self, config, cls) {

	var old = null;

	self.singleton();
	self.readonly();
	self.nocompile();

	self.make = function() {
		var temp = config.position === 'bottom' ? ' ' + cls + '-bottom' : '';
		self.aclass(cls + temp + ' hidden');
	};

	self.setter = function(value) {
		!value && (value = 0);

		if (old === value)
			return;

		if (value > 100)
			value = 100;
		else if (value < 0)
			value = 0;

		old = value >> 0;

		self.element.stop().animate({ width: old + '%' }, 80).show();
		self.tclass('hidden', old === 0 || old === 100);
	};
});

COMPONENT('shortcuts', function(self) {

	var items = [];
	var length = 0;
	var keys = {};
	var keys_session = {};
	var issession = false;

	self.singleton();
	self.readonly();
	self.blind();
	self.nocompile && self.nocompile();

	var cb = function(o, e) {
		o.callback(e, o.owner);
	};

	self.make = function() {

		$(W).on('keydown', function(e) {

			var f = e.key || '';
			var c = e.keyCode;

			if (f.length > 1 && f.charAt(0) === 'F')
				c = 0;
			else
				f = '-';

			// ctrl,alt,shift,meta,fkey,code
			var key = (e.ctrlKey ? 1 : 0) + '' + (e.altKey ? 1 : 0) + '' + (e.shiftKey ? 1 : 0) + '' + (e.metaKey ? 1 : 0) + f + c;

			if (issession) {
				if (!keys_session[key])
					return;
			} else {
				if (!keys[key])
					return;
			}

			if (length && !e.isPropagationStopped()) {
				for (var i = 0; i < length; i++) {
					var o = items[i];
					if (o.fn(e)) {
						if (o.prevent) {
							e.preventDefault();
							e.stopPropagation();
						}
						setTimeout(cb, 100, o, e);
						return;
					}
				}
			}
		});

		ON('component + knockknock', self.refresh);
	};

	self.refreshforce = function() {

		var arr = document.querySelectorAll('.shortcut');
		var index = 0;

		while (true) {
			var item = items[index++];
			if (item == null)
				break;
			if (item.owner) {
				index--;
				items.splice(index, 1);
			}
		}

		for (var i = 0; i < arr.length; i++) {
			var shortcut = arr[i].getAttribute('data-shortcut');
			shortcut && self.register(shortcut, self.execshortcut, true, arr[i]);
		}
	};

	self.session = function(callback) {
		issession = true;
		keys_session = {};
		callback(self.register);
	};

	self.end = function() {
		issession = false;
	};

	self.execshortcut = function(e, owner) {
		$(owner).trigger('click');
	};

	self.refresh = function() {
		setTimeout2(self.ID, self.refreshforce, 500);
	};

	self.exec = function(shortcut) {
		var item = items.findItem('shortcut', shortcut.toLowerCase().replace(/\s/g, ''));
		item && item.callback(EMPTYOBJECT, item.owner);
	};

	self.register = function(shortcut, callback, prevent, owner) {

		var currentkeys = issession ? keys_session : keys;

		shortcut.split(',').trim().forEach(function(shortcut) {

			var builder = [];
			var alias = [];
			var cachekey = [0, 0, 0, 0, '-', 0]; // ctrl,alt,shift,meta,fkey,code

			shortcut.split('+').trim().forEach(function(item) {
				var lower = item.toLowerCase();
				alias.push(lower);

				switch (lower) {
					case 'ctrl':
						cachekey[0] = 1;
						break;
					case 'alt':
						cachekey[1] = 1;
						break;
					case 'shift':
						cachekey[2] = 1;
						break;
					case 'win':
					case 'meta':
					case 'cmd':
						cachekey[3] = 1;
						break;
				}

				switch (lower) {
					case 'ctrl':
					case 'alt':
					case 'shift':
						builder.push('e.{0}Key'.format(lower));
						return;
					case 'win':
					case 'meta':
					case 'cmd':
						builder.push('e.metaKey');
						return;
					case 'ins':
						builder.push('e.keyCode===45');
						cachekey[5] = 45;
						return;
					case 'space':
						builder.push('e.keyCode===32');
						cachekey[5] = 32;
						return;
					case 'tab':
						builder.push('e.keyCode===9');
						cachekey[5] = 9;
						return;
					case 'esc':
						builder.push('e.keyCode===27');
						cachekey[5] = 27;
						return;
					case 'enter':
						builder.push('e.keyCode===13');
						cachekey[5] = 13;
						return;
					case 'backspace':
						builder.push('e.keyCode===8');
						cachekey[5] = 8;
						break;
					case 'del':
					case 'delete':
						builder.push('e.keyCode===46');
						cachekey[5] = 46;
						return;
					case 'save':
						builder.push('(e.metaKey&&e.keyCode===115)');
						cachekey[5] = -1;
						return;
					case 'remove':
						builder.push('((e.metaKey&&e.keyCode===8)||e.keyCode===46)');
						cachekey[5] = -1;
						return;
					case 'up':
						builder.push('e.keyCode===38');
						cachekey[5] = 38;
						return;
					case 'down':
						builder.push('e.keyCode===40');
						cachekey[5] = 40;
						return;
					case 'right':
						builder.push('e.keyCode===39');
						cachekey[5] = 39;
						return;
					case 'left':
						builder.push('e.keyCode===37');
						cachekey[5] = 37;
						return;
					case 'f1':
					case 'f2':
					case 'f3':
					case 'f4':
					case 'f5':
					case 'f6':
					case 'f7':
					case 'f8':
					case 'f9':
					case 'f10':
					case 'f11':
					case 'f12':
						var a = item.toUpperCase();
						builder.push('e.key===\'{0}\''.format(a));
						cachekey[4] = a;
						return;
					case 'capslock':
						builder.push('e.which===20');
						cachekey[5] = 20;
						return;
				}

				var num = item.parseInt();
				if (num) {
					builder.push('e.which===' + num);
					cachekey[5] = num;
				} else {
					num = item.toUpperCase().charCodeAt(0);
					cachekey[5] = num;
					builder.push('e.keyCode==={0}'.format(num));
				}
			});

			items.push({ shortcut: alias.join('+'), fn: new Function('e', 'return ' + builder.join('&&')), callback: callback, prevent: prevent, owner: owner });
			length = items.length;

			var k;

			// Remove
			if (cachekey[5] === -1) {
				cachekey[5] = 8;
				k = cachekey.join('');
				currentkeys[k] = 1;
				cachekey[5] = 46;
			}

			k = cachekey.join('');
			currentkeys[k] = 1;
		});

		if (!owner)
			self.refresh();

		return self;
	};
});

COMPONENT('layout2', 'scrollbar:1;parent:window;autoresize:1;margin:0', function(self, config, cls) {

	var top;
	var bottom;
	var left;
	var right;
	var main;
	var cachesize;
	var init = false;

	self.init = function() {
		var obj;
		if (W.OP)
			obj = W.OP;
		else
			obj = $(W);
		obj.on('resize', function() {
			for (var i = 0; i < M.components.length; i++) {
				var com = M.components[i];
				if (com.name === 'layout2' && com.dom.offsetParent && com.$ready && !com.$removed && com.config.autoresize)
					com.resize();
			}
		});
	};

	self.parse_number = function(value, total) {
		var tmp = value.parseInt();
		return value.indexOf('%') === -1 ? tmp : ((total / 100) * tmp);
	};

	self.parse_size = function(el) {
		var size = (el.attrd('size') || '').split(',').trim();
		var obj = { lg: size[0] || '0' };
		obj.md = size[1] == null ? obj.lg : size[1];
		obj.sm = size[2] == null ? obj.md : size[2];
		obj.xs = size[3] == null ? obj.sm : size[3];

		var keys = Object.keys(obj);
		var reg = /px|%/;
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			var val = obj[key];
			if (!reg.test(val))
				obj[key] += 'px';
		}

		return obj;
	};

	self.parse_item = function(el) {
		var scrollbar = el.attrd('scrollbar');
		var type = el.attrd('type');
		var item = {};
		item.el = el;
		item.size = type ? self.parse_size(el) : null;
		item.type = type || 'main';
		item.css = {};
		item.scrollbar = scrollbar ? scrollbar.parseConfig() : null;

		if (item.scrollbar) {

			var screl;

			if (item.scrollbar.selector) {
				screl = el.find(item.scrollbar.selector);
			} else {
				var dom = el[0];
				var div = document.createElement('DIV');
				while (dom.children.length)
					div.appendChild(dom.children[0]);
				dom.appendChild(div);
				$(div).aclass(cls + '-scrollbar');
				screl = $(div);
			}

			var opt = { visibleY: item.scrollbar.visible || item.scrollbar.visibleY, orientation: 'y' };
			item.scrollbarcontainer = screl;
			item.scrollbar.instance = SCROLLBAR(screl, opt);
			item.scrollbar.resize = function(h) {
				var t = this;
				item.scrollbarcontainer.css('height', h - (t.margin || 0));
				item.scrollbar.instance.resize();
			};
		}

		el.aclass(cls + '-section ' + cls + '-' + type.replace('2', ''));
		return item;
	};

	self.parse_cache = function(tmp) {
		return (tmp.left || 0) + 'x' + (tmp.top || 0) + 'x' + (tmp.width || 0) + 'x' + (tmp.height || 0) + 'x';
	};

	self.make = function() {
		self.find('> *').each(function() {
			var el = $(this);
			var type = el.attrd('type');
			switch (type) {
				case 'top':
				case 'top2':
					top = self.parse_item(el);
					break;
				case 'bottom':
				case 'bottom2':
					bottom = self.parse_item(el);
					break;
				case 'right':
					right = self.parse_item(el);
					break;
				case 'left':
					left = self.parse_item(el);
					break;
				default:
					main = self.parse_item(el);
					break;
			}
		});

		self.resize();
	};

	self.resize = function() {
		setTimeout2(self.ID, self.resize2, 50);
	};

	self.show = function(type) {
		switch (type) {
			case 'left':
				left && left.el.css('width', WW).rclass('hidden');
				right && right.el.aclass('hidden');
				break;
			case 'right':
				left && left.el.aclass('hidden');
				right && right.el.css({ left: 0, width: WW }).rclass('hidden');
				break;
			case 'main':
				right && right.el.aclass('hidden');
				left && left.el.aclass('hidden');
				break;
		}
		self.resize2();
	};

	self.resize2 = function() {

		var parent = self.parent(config.parent);
		var d = WIDTH();
		var w = parent.width();
		var h = parent.height();
		var tmp = d + '_' + w + 'x' + h;

		if (cachesize === tmp)
			return;

		var m = config['margin' + d] || config.margin || 0;

		h -= m;

		cachesize = tmp;
		main.w = w;
		main.h = h;

		var sizetop = top ? self.parse_number(top.size[d], h) : 0;
		var sizebottom = bottom ? self.parse_number(bottom.size[d], h) : 0;
		var sizeleft = left ? self.parse_number(left.size[d], w) : 0;
		var sizeright = right ? self.parse_number(right.size[d], w) : 0;

		if (top) {

			if (top.type === 'top2') {
				top.css.left = sizeleft;
				top.css.width = w - sizeright - sizeleft;
			} else {
				top.css.left = 0;
				top.css.width = w;
			}

			top.css.top = 0;
			top.css.height = sizetop;
			tmp = self.parse_cache(top.css);
			if (tmp !== top.sizecache) {
				top.sizecache = tmp;
				top.el.tclass('hidden', !sizetop);
				if (!sizetop)
					delete top.css.height;
				top.el.css(top.css);
				top.scrollbar && top.scrollbar.resize(sizetop);
			}
		}

		if (bottom) {

			if (bottom.type === 'bottom2') {
				bottom.css.left = sizeleft;
				bottom.css.width = w - sizeright - sizeleft;
			} else {
				bottom.css.left = 0;
				bottom.css.width = w;
			}

			bottom.css.top = h - sizebottom;
			bottom.css.height = sizebottom;
			tmp = self.parse_cache(bottom.css);
			if (tmp !== bottom.sizecache) {
				bottom.el.tclass('hidden', !sizebottom);
				if (!sizebottom)
					delete bottom.css.height;
				bottom.sizecache = tmp;
				bottom.el.css(bottom.css);
				bottom.scrollbar && bottom.scrollbar.resize(sizebottom);
			}
		}

		if (left) {

			if (top && top.type === 'top')
				left.css.top = sizetop;
			else
				left.css.top = 0;

			if (bottom && bottom.type === 'bottom')
				left.css.height = h - sizebottom;
			else
				left.css.height = h;

			if (top && top.type === 'top')
				left.css.height -= sizetop;

			left.css.left = 0;
			left.css.width = sizeleft;
			tmp = self.parse_cache(left.css);
			if (tmp !== left.sizecache) {
				left.el.tclass('hidden', !sizeleft);
				if (!sizeleft)
					delete left.css.width;
				left.sizecache = tmp;
				left.el.css(left.css);
				left.scrollbar && left.scrollbar.resize(left.css.height);
			}
		}

		if (right) {

			if (top && top.type === 'top')
				right.css.top = sizetop;
			else
				right.css.top = 0;

			if (bottom && bottom.type === 'bottom')
				right.css.height = h - sizebottom;
			else
				right.css.height = h;

			if (top && top.type === 'top')
				right.css.height -= sizetop;

			right.css.left = w - sizeright;
			right.css.width = sizeright;
			tmp = self.parse_cache(right.css);
			if (tmp !== right.sizecache) {
				right.el.tclass('hidden', !sizeright);
				if (!sizeright)
					delete right.css.width;
				right.sizecache = tmp;
				right.el.css(right.css);
				right.scrollbar && right.scrollbar.resize(right.css.height);
			}
		}

		if (main) {
			main.css.top = sizetop;
			main.css.left = sizeleft;
			main.css.width = w - sizeleft - sizeright;
			main.css.height = h - sizetop - sizebottom;

			tmp = self.parse_cache(main.css);
			if (tmp !== main.sizecache) {
				main.sizecache = tmp;
				main.el.css(main.css);
				main.scrollbar && main.scrollbar.resize(main.css.height);
			}
		}

		if (!init) {
			self.rclass('invisible hidden');
			init = true;
		}

		self.element.SETTER('*/resize');
	};

	self.resizescrollbars = function() {
		top && top.scrollbar && top.scrollbar.instance.resize();
		bottom && bottom.scrollbar && bottom.scrollbar.instance.resize();
		left && left.scrollbar && left.scrollbar.instance.resize();
		right && right.scrollbar && right.scrollbar.instance.resize();
		main && main.scrollbar && main.scrollbar.instance.resize();
	};

	self.resizescrollbar = function(type) {
		if (type === 'top')
			top && top.scrollbar && top.scrollbar.instance.resize();
		else if (type === 'bottom')
			bottom && bottom.scrollbar && bottom.scrollbar.instance.resize();
		else if (type === 'left')
			left && left.scrollbar && left.scrollbar.instance.resize();
		else if (type === 'right')
			right && right.scrollbar && right.scrollbar.instance.resize();
		else if (type === 'main')
			main && main.scrollbar && main.scrollbar.instance.resize();
	};

	self.scrolltop = function(type) {
		if (type === 'top')
			top && top.scrollbar && top.scrollbar.instance.scrollTop(0);
		else if (type === 'bottom')
			bottom && bottom.scrollbar && bottom.scrollbar.instance.scrollTop(0);
		else if (type === 'left')
			left && left.scrollbar && left.scrollbar.instance.scrollTop(0);
		else if (type === 'right')
			right && right.scrollbar && right.scrollbar.instance.scrollTop(0);
		else if (type === 'main')
			main && main.scrollbar && main.scrollbar.instance.scrollTop(0);
	};

});

COMPONENT('selected', 'class:selected;selector:a;attr:if', function(self, config) {

	self.readonly();

	self.configure = function(key, value) {
		switch (key) {
			case 'datasource':
				self.datasource(value, function() {
					setTimeout(self.refresh, 50);
				});
				break;
		}
	};

	self.setter = function(value) {
		var cls = config.class;
		self.find(config.selector).each(function() {
			var el = $(this);
			if (el.attrd(config.attr) === value)
				el.aclass(cls);
			else
				el.hclass(cls) && el.rclass(cls);
		});
	};
});


COMPONENT('livestats', 'width:500;height:100;axislines:20;max:0', function(self, config, cls) {

	var cls2 = '.' + cls;
	var cache = {};
	var colors = {};
	var peak = {};
	var paths;

	self.readonly();

	function diagonal(x1, y1, x2, y2) {
		return 'M' + x1 + ',' + y1 + 'C' + (x1 && x2 ? ((x1 + x2 ) / 2) : 0) + ',' + y1 + ' ' + (x1 && x2 ? ((x1 + x2) / 2) : 0) + ',' + y2 + ' ' + x2 + ',' + y2;
	}

	self.color = function(value) {
		var hash = HASH(value, true);
		var color = '#';
		for (var i = 0; i < 3; i++) {
			var value = (hash >> (i * 8)) & 0xFF;
			color += ('00' + value.toString(16)).substr(-2);
		}
		return color;
	};

	self.configure = function(key, value) {
		switch (key) {
			case 'colors':
				var tmp = value.split(',').trim();
				for (var i = 0; i < tmp.length; i++) {
					var kv = tmp[i].split('=').trim();
					colors[kv[0]] = kv[1];
				}
				break;
		}
	};

	self.make = function() {
		self.aclass(cls);
		self.append('<svg viewbox="0 0 {1} {2}"><g class="{0}-axis"></g><g class="{0}-paths"></g></svg>'.format(cls, config.width, config.height));
		paths = self.find(cls2 + '-paths');

		var axis = self.find(cls2 + '-axis');
		var axisw = (config.width / config.axislines) >> 0;

		for (var i = 1; i < config.axislines; i++)
			axis.asvg('<line x1="{0}" y1="0" x2="{0}" y2="{1}" />'.format(axisw * i, config.height));
	};

	self.render = function(path, points, max, index) {

		var h = config.height - 12;
		var builder = [];
		var bar = Math.ceil(config.width / (config.axislines / 2));
		var pp = [];

		pp.push({ x: -20, y: h });

		for (var i = 0; i < 10; i++) {
			var val = points[i] || 0;
			var p = val && max ? Math.round((val / max) * 100) : 0;
			var y = (p ? (h - ((h / 100) * p)) : h) + (index * 2);
			pp.push({ x: (i * bar) + 2, y: y + 12 });
		}

		pp.push({ x: config.width + config.axislines, y: pp.last().y });

		for (var i = 0; i < (pp.length - 1); i++) {
			var d = diagonal(pp[i].x, pp[i].y, pp[i + 1].x, pp[i + 1].y);
			builder.push(d);
		}

		path.attr('d', builder.join(' '));
	};

	self.setter = function(value) {

		if (!value)
			return;

		var keys = Object.keys(value);
		var max = config.max;
		var bars = (config.axislines / 2) >> 0;

		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			var val = value[keys[i]];

			if (!cache[key]) {
				peak[key] = [];

				for (var j = 0; j < bars; j++)
					peak[key].push(0);

				paths.asvg('<path stroke="{0}" data-id="{1}" />'.format(colors[key] || self.color(key), key));
				cache[key] = paths.find('[data-id="{0}"]'.format(key));
			}

			peak[key].shift();
			peak[key].push(val || 0);
		}

		// Finds max
		if (!max) {
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i];
				for (var j = 0; j < peak[key].length; j++) {
					var val = peak[key][j];
					if (max < val)
						max = val;
				}
			}
		}

		// Renders data
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			self.render(cache[key], peak[key], max, i);
		}

	};
});

COMPONENT('gauge', 'decimals:1;format:{0}%;text:1;colors:30 #8CC152,40 #EDBC5A,30 #DB3737;stroke:25', function(self, config, cls) {

	var cls2 = '.' + cls;
	var svg;

	function Donut(cx, cy, radius, data) {

		function arcradius(cx, cy, radius, degrees) {
			var radians = (degrees - 90) * Math.PI / 180.0;
			return { x: cx + (radius * Math.cos(radians)), y: cy + (radius * Math.sin(radians)) };
		}

		var decimals = 4;
		var total = 0;
		var arr = [];
		var beg = -90;
		var end = 0;
		var count = 0;

		for (var i = 0; i < data.length; i++)
			total += data[i].value;

		for (var i = 0; i < data.length; i++) {
			var item = data[i];
			var tmp = {};

			var p = (((item.value + 1) / total) * 100).floor(2);

			count += p;

			if (i === length - 1 && count < 100)
				p = p + (100 - count);

			end = beg + ((180 / 100) * p);
			tmp.index = i;
			tmp.value = item.value;
			tmp.data = item;

			var b = arcradius(cx, cy, radius, end);
			var e = arcradius(cx, cy, radius, beg);
			var la = 0;

			tmp.d = ['M', b.x.floor(decimals), b.y.floor(decimals), 'A', radius, radius, 0, la, 0, e.x.floor(decimals), e.y.floor(decimals)].join(' ');
			arr.push(tmp);
			beg = end;
		}

		return arr;
	}

	self.redraw = function() {
		svg.empty();

		var colors = config.colors.split(',');
		var color = [];
		var data = [];
		var stroke = [];
		var centerX = 150;
		var centerY = 150;
		var radius = 120;

		for (var i = 0; i < colors.length; i++) {
			var c = colors[i].trim().split(' ');
			data.push({ value: +c[0] });
			color.push(c[1]);
			stroke.push(c[2] ? +c[2] : config.stroke);
		}

		var arr = Donut(centerX, centerY, radius, data);
		for (var i = 0; i < arr.length; i++) {
			var item = arr[i];
			svg.asvg('<g><path d="{0}" stroke="{1}" fill="none" stroke-width="{2}" /></g>'.format(item.d, color[i], stroke[i]));
		}
		config.text && svg.asvg('<g><text x="150" y="105" font-size="30" text-anchor="middle"></text></g><g transform="translate(0,-10)" class="{0}-pointer"><path d="M150 20 L145 145 L155 145 Z" class="{0}-value" transform="rotate(0,150,150)" /><circle cx="150" cy="150" r="10"></circle></g>'.format(cls));
	};

	self.make = function() {
		self.aclass(cls);
		self.append('<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 300 150"></svg>');
		svg = self.find('svg');
		self.redraw();
	};

	self.setter = function(value) {

		if (value > 100)
			value = 100;
		else if (!value)
			value = 0;

		var max = 180;
		var deg = ((max / 100) * value) - (max / 2);

		self.find(cls2 + '-value').stop().animate({ diff: deg }, { step: function(val) {
			this.setAttribute('transform', 'rotate(' + val + ',150,150)');
		}, duration: 300 });

		config.text && (self.find('text')[0].textContent = config.format.format(value.format(config.decimals)));
	};

});

COMPONENT('part', 'hide:1;loading:1', function(self, config, cls) {

	var init = false;
	var clid = null;
	var downloading = false;
	var isresizing = false;

	self.releasemode && self.releasemode('true');
	self.readonly();

	self.make = function() {
		self.aclass(cls);
	};

	self.resize = function() {
		if (config.absolute) {
			var pos = self.element.position();
			var obj = {};
			obj.width = WW - pos.left;
			obj.height = WH - pos.top;
			self.css(obj);
		}
	};

	self.destroy = function() {
		isresizing && $(W).off('resize', self.resize);
	};

	self.setter = function(value) {

		if (config.if !== value) {

			if (!self.hclass('hidden')) {
				config.hidden && EXEC(self.makepath(config.hidden));
				config.hide && self.aclass('hidden');
				self.release(true);
			}

			if (config.cleaner && init && !clid)
				clid = setTimeout(self.clean, config.cleaner * 60000);

			return;
		}

		if (config.absolute && !isresizing) {
			$(W).on('resize', self.resize);
			isresizing = true;
		}

		config.hide && self.rclass('hidden');

		if (self.dom.hasChildNodes()) {

			if (clid) {
				clearTimeout(clid);
				clid = null;
			}

			self.release(false);
			config.reload && EXEC(self.makepath(config.reload));
			config.default && DEFAULT(self.makepath(config.default), true);
			isresizing && setTimeout(self.resize, 50);
			setTimeout(self.emitresize, 200);

		} else {

			if (downloading)
				return;

			config.loading && SETTER('loading', 'show');
			downloading = true;
			setTimeout(function() {

				var preparator = config.path == null ? null : function(content) {
					return content.replace(/~PATH~/g, config.path);
				};

				if (preparator == null && config.replace)
					preparator = GET(self.makepath(config.replace));

				self.import(config.url, function() {
					downloading = false;

					if (!init) {
						config.init && EXEC(self.makepath(config.init));
						init = true;
					}

					self.release(false);
					config.reload && EXEC(self.makepath(config.reload), true);
					config.default && DEFAULT(self.makepath(config.default), true);
					config.loading && SETTER('loading', 'hide', 500);
					EMIT('parts.' + config.if, self.element, self);
					self.hclass('invisible') && self.rclass('invisible', 500);
					isresizing && setTimeout(self.resize, 50);
					setTimeout(self.emitresize, 200);

				}, true, preparator);

			}, 200);
		}
	};

	self.emitresize = function() {
		self.element.SETTER('*', 'resize');
	};

	self.configure = function(key, value) {
		switch (key) {
			case 'if':
				config.if = value + '';
				break;
			case 'absolute':
				var is = !!value;
				self.tclass(cls + '-absolute', is);
				break;
		}
	};

	self.clean = function() {
		if (self.hclass('hidden')) {
			config.clean && EXEC(self.makepath(config.clean));
			setTimeout(function() {
				self.empty();
				init = false;
				clid = null;
				setTimeout(FREE, 1000);
			}, 1000);
		}
	};
});

COMPONENT('importer', function(self, config) {

	var init = false;
	var clid = null;
	var pending = false;
	var content = '';

	self.readonly();

	self.make = function() {
		var scr = self.find('script');
		content = scr.length ? scr.html() : '';
	};

	self.reload = function(recompile) {
		config.reload && EXEC(config.reload);
		recompile && COMPILE();
		setTimeout(function() {
			pending = false;
			init = true;
		}, 1000);
	};

	self.setter = function(value) {

		if (pending)
			return;

		if (config.if !== value) {
			if (config.cleaner && init && !clid)
				clid = setTimeout(self.clean, config.cleaner * 60000);
			return;
		}

		pending = true;

		if (clid) {
			clearTimeout(clid);
			clid = null;
		}

		if (init) {
			self.reload();
			return;
		}

		if (content) {
			self.html(content);
			setTimeout(self.reload, 50, true);
		} else
			self.import(config.url, self.reload);
	};

	self.clean = function() {
		config.clean && EXEC(config.clean);
		setTimeout(function() {
			self.empty();
			init = false;
			clid = null;
		}, 1000);
	};
});

COMPONENT('viewbox', 'margin:0;scroll:true;delay:100;scrollbar:0;visibleY:1;height:100;invisible:1', function(self, config, cls) {

	var eld, elb;
	var scrollbar;
	var cls2 = '.' + cls;
	var init = false;
	var cache;

	self.readonly();

	self.init = function() {

		var resize = function() {
			for (var i = 0; i < M.components.length; i++) {
				var com = M.components[i];
				if (com.name === 'viewbox' && com.dom.offsetParent && com.$ready && !com.$removed)
					com.resizeforce();
			}
		};

		ON('resize2', function() {
			setTimeout2('viewboxresize', resize, 200);
		});
	};

	self.destroy = function() {
		scrollbar && scrollbar.destroy();
	};

	self.configure = function(key, value, init) {
		switch (key) {
			case 'disabled':
				eld.tclass('hidden', !value);
				break;
			case 'minheight':
			case 'margin':
			case 'marginxs':
			case 'marginsm':
			case 'marginmd':
			case 'marginlg':
				!init && self.resize();
				break;
			case 'selector': // backward compatibility
				config.parent = value;
				self.resize();
				break;
		}
	};

	self.scrollbottom = function(val) {
		if (val == null)
			return elb[0].scrollTop;
		elb[0].scrollTop = (elb[0].scrollHeight - self.dom.clientHeight) - (val || 0);
		return elb[0].scrollTop;
	};

	self.scrolltop = function(val) {
		if (val == null)
			return elb[0].scrollTop;
		elb[0].scrollTop = (val || 0);
		return elb[0].scrollTop;
	};

	self.make = function() {
		config.invisible && self.aclass('invisible');
		config.scroll && MAIN.version > 17 && self.element.wrapInner('<div class="' + cls + '-body"></div>');
		self.element.prepend('<div class="' + cls + '-disabled hidden"></div>');
		eld = self.find('> .{0}-disabled'.format(cls)).eq(0);
		elb = self.find('> .{0}-body'.format(cls)).eq(0);
		self.aclass('{0} {0}-hidden'.format(cls));
		if (config.scroll) {
			if (config.scrollbar) {
				if (MAIN.version > 17) {
					scrollbar = W.SCROLLBAR(self.find(cls2 + '-body'), { visibleY: config.visibleY, visibleX: config.visibleX, orientation: config.visibleX ? null : 'y', parent: self.element });
					self.scrolltop = scrollbar.scrollTop;
					self.scrollbottom = scrollbar.scrollBottom;
				} else
					self.aclass(cls + '-scroll');
			} else {
				self.aclass(cls + '-scroll');
				self.find(cls2 + '-body').aclass('noscrollbar');
			}
		}
		self.resize();
	};

	self.released = function(is) {
		!is && self.resize();
	};

	var css = {};

	self.resize = function(scrollto) {
		setTimeout2(self.ID, self.resizeforce, 200, null, scrollto);
	};

	self.resizeforce = function(scrollto) {

		var el = self.parent(config.parent);
		var h = el.height();
		var w = el.width();
		var width = WIDTH();
		var mywidth = self.element.width();

		var key = width + 'x' + mywidth + 'x' + w + 'x' + h;
		if (cache === key) {
			scrollbar && scrollbar.resize();
			if (scrollto) {
				if (scrollto ==='bottom')
					self.scrollbottom(0);
				else
					self.scrolltop(0);
			}
			return;
		}

		cache = key;

		var margin = config.margin;
		var responsivemargin = config['margin' + width];

		if (responsivemargin != null)
			margin = responsivemargin;

		if (margin === 'auto')
			margin = self.element.offset().top;

		if (h === 0 || w === 0) {
			self.$waiting && clearTimeout(self.$waiting);
			self.$waiting = setTimeout(self.resize, 234);
			return;
		}

		h = ((h / 100) * config.height) - margin;

		if (config.minheight && h < config.minheight)
			h = config.minheight;

		css.height = h;
		css.width = mywidth;
		eld.css(css);

		css.width = null;
		self.css(css);
		elb.length && elb.css(css);
		self.element.SETTER('*', 'resize');
		var c = cls + '-hidden';
		self.hclass(c) && self.rclass(c, 100);
		scrollbar && scrollbar.resize();

		if (scrollto) {
			if (scrollto ==='bottom')
				self.scrollbottom(0);
			else
				self.scrolltop(0);
		}

		if (!init) {
			self.rclass('invisible', 250);
			init = true;
		}
	};

	self.resizescrollbar = function() {
		scrollbar && scrollbar.resize();
	};

	self.setter = function() {
		setTimeout(self.resize, config.delay, config.scrollto || config.scrolltop);
	};
});

COMPONENT('search', 'class:hidden;delay:50;attribute:data-search;splitwords:1;delaydatasource:100', function(self, config, cls) {

	self.readonly();

	self.make = function() {
		config.datasource && self.datasource(config.datasource, function() {
			setTimeout(function() {
				self.refresh();
			}, config.delaydatasource);
		});
	};

	self.search = function() {

		var value = self.get();
		var elements = self.find(config.selector);
		var length = elements.length;

		if (!value) {
			elements.rclass(config.class);
			self.rclass2(cls + '-');
			config.exec && self.SEEX(config.exec, { hidden: 0, count: length, total: length, search: '', is: false });
			return;
		}

		var search = value.toSearch();
		var count = 0;
		var hidden = 0;

		if (config.splitwords)
			search = search.split(' ');

		self.aclass(cls + '-used');

		for (var i = 0; i < length; i++) {

			var el = elements.eq(i);
			var val = (el.attr(config.attribute) || '').toSearch();
			var is = false;

			if (search instanceof Array) {
				for (var j = 0; j < search.length; j++) {
					if (val.indexOf(search[j]) === -1) {
						is = true;
						break;
					}
				}
			} else
				is = val.indexOf(search) === -1;

			el.tclass(config.class, is);

			if (is)
				hidden++;
			else
				count++;
		}

		self.tclass(cls + '-empty', !count);
		config.exec && self.SEEX(config.exec, { total: length, hidden: hidden, count: count, search: search, is: true });
	};

	self.setter = function(value) {
		if (!config.selector || !config.attribute || value == null)
			return;
		setTimeout2('search' + self.ID, self.search, config.delay);
	};
});

COMPONENT('searchinput', 'searchicon:fa fa-search;cancelicon:fa fa-times;align:left', function(self, config, cls) {

	var input;
	var icon;
	var prev;

	self.novalidate();

	self.make = function() {

		self.aclass(cls + ' ' + cls + '-' + config.align);
		self.html('<span><i class="{0}"></i></span><div><input type="text" autocomplete="new-password" maxlength="100" placeholder="{1}" data-jc-bind /></div>'.format(config.searchicon, config.placeholder));
		input = self.find('input')[0];
		icon = self.find('i');

		self.event('click', 'span', function() {
			prev && self.set('');
		});

		if (config.autofocus && !isMOBILE) {
			setTimeout(function() {
				input.focus();
			}, config.autofocus == true ? 500 : config.autofocus);
		}

	};

	self.focus = function() {
		input && input.focus();
	};

	self.check = function() {
		var is = !!input.value.trim();
		if (is !== prev) {
			icon.rclass().aclass(is ? config.cancelicon : config.searchicon);
			prev = is;
			self.tclass(cls + '-is', is);
		}
	};

	self.setter = function(value) {
		input.value = value || '';
		self.check();
	};

});

COMPONENT('menu', function(self, config, cls) {

	self.singleton();
	self.readonly();
	self.nocompile && self.nocompile();

	var cls2 = '.' + cls;

	var is = false;
	var issubmenu = false;
	var isopen = false;
	var events = {};
	var ul, children, prevsub, parentclass;

	self.make = function() {
		self.aclass(cls + ' hidden');
		self.append('<div class="{0}-items"><ul></ul></div><div class="{0}-submenu hidden"><ul></ul></div>'.format(cls));
		ul = self.find(cls2 + '-items').find('ul');
		children = self.find(cls2 + '-submenu');

		self.event('click', 'li', function(e) {

			clearTimeout2(self.ID);

			var el = $(this);
			if (!el.hclass(cls + '-divider') && !el.hclass(cls + '-disabled')) {
				self.opt.scope && M.scope(self.opt.scope);
				var index = el.attrd('index').split('-');
				if (index.length > 1) {
					// submenu
					self.opt.callback(self.opt.items[+index[0]].children[+index[1]]);
					self.hide();
				} else if (!issubmenu) {
					self.opt.callback(self.opt.items[+index[0]]);
					self.hide();
				}
			}

			e.preventDefault();
			e.stopPropagation();
		});

		events.hide = function() {
			is && self.hide();
		};

		self.event('scroll', events.hide);
		self.on('reflow', events.hide);
		self.on('scroll', events.hide);
		self.on('resize', events.hide);

		events.click = function(e) {
			if (is && !isopen && (!self.target || (self.target !== e.target && !self.target.contains(e.target))))
				setTimeout2(self.ID, self.hide, isMOBILE ? 700 : 300);
		};

		events.hidechildren = function() {
			if ($(this.parentNode.parentNode).hclass(cls + '-items')) {
				if (prevsub && prevsub[0] !== this) {
					prevsub.rclass(cls + '-selected');
					prevsub = null;
					children.aclass('hidden');
					issubmenu = false;
				}
			}
		};

		events.children = function() {

			if (prevsub && prevsub[0] !== this) {
				prevsub.rclass(cls + '-selected');
				prevsub = null;
			}

			issubmenu = true;
			isopen = true;

			setTimeout(function() {
				isopen = false;
			}, 500);

			var el = prevsub = $(this);
			var index = +el.attrd('index');
			var item = self.opt.items[index];

			el.aclass(cls + '-selected');

			var html = self.makehtml(item.children, index);
			children.find('ul').html(html);
			children.rclass('hidden');

			var css = {};
			var offset = el.position();

			css.left = ul.width() - 5;
			css.top = offset.top - 5;

			var offsetX = offset.left;

			offset = self.element.offset();

			var w = children.width();
			var left = offset.left + css.left + w;
			if (left > WW + 30)
				css.left = (offsetX - w) + 5;

			children.css(css);
		};
	};

	self.bindevents = function() {
		events.is = true;
		$(document).on('touchstart mouseenter mousedown', cls2 + '-children', events.children).on('touchstart mousedown', events.click);
		$(window).on('scroll', events.hide);
		self.element.on('mouseenter', 'li', events.hidechildren);
	};

	self.unbindevents = function() {
		events.is = false;
		$(document).off('touchstart mouseenter mousedown', cls2 + '-children', events.children).off('touchstart mousedown', events.click);
		$(window).off('scroll', events.hide);
		self.element.off('mouseenter', 'li', events.hidechildren);
	};

	self.showxy = function(x, y, items, callback) {
		var opt = {};
		opt.x = x;
		opt.y = y;
		opt.items = items;
		opt.callback = callback;
		self.show(opt);
	};

	self.makehtml = function(items, index) {
		var builder = [];
		var tmp;

		for (var i = 0; i < items.length; i++) {
			var item = items[i];

			if (typeof(item) === 'string') {
				// caption or divider
				if (item === '-')
					tmp = '<hr />';
				else
					tmp = '<span>{0}</span>'.format(item);
				builder.push('<li class="{0}-divider">{1}</li>'.format(cls, tmp));
				continue;
			}

			var cn = item.classname || '';
			var icon = '';

			if (item.icon)
				icon = '<i class="{0}"></i>'.format(item.icon.charAt(0) === '!' ? item.icon.substring(1) : item.icon.indexOf('fa-') === -1 ? ('fa fa-' + item.icon) : item.icon);
			else
				cn = (cn ? (cn + ' ') : '') + cls + '-nofa';

			tmp = '';

			if (index == null && item.children && item.children.length) {
				cn += (cn ? ' ' : '') + cls + '-children';
				tmp += '<i class="fa fa-play pull-right"></i>';
			}

			if (item.selected)
				cn += (cn ? ' ' : '') + cls + '-selected';

			if (item.disabled)
				cn += (cn ? ' ' : '') + cls + '-disabled';

			tmp += '<div class="{0}-name">{1}{2}{3}</div>'.format(cls, icon, item.name, item.shortcut ? '<b>{0}</b>'.format(item.shortcut) : '');

			if (item.note)
				tmp += '<div class="ui-menu-note">{0}</div>'.format(item.note);

			builder.push('<li class="{0}" data-index="{2}">{1}</li>'.format(cn, tmp, (index != null ? (index + '-') : '') + i));
		}

		return builder.join('');
	};

	self.show = function(opt) {

		if (typeof(opt) === 'string') {
			// old version
			opt = { align: opt };
			opt.element = arguments[1];
			opt.items = arguments[2];
			opt.callback = arguments[3];
			opt.offsetX = arguments[4];
			opt.offsetY = arguments[5];
		}

		var tmp = opt.element ? opt.element instanceof jQuery ? opt.element[0] : opt.element.element ? opt.element.dom : opt.element : null;

		if (is && tmp && self.target === tmp) {
			self.hide();
			return;
		}

		var tmp;

		self.target = tmp;
		self.opt = opt;
		opt.scope = M.scope();

		if (parentclass && opt.classname !== parentclass) {
			self.rclass(parentclass);
			parentclass = null;
		}

		if (opt.large)
			self.aclass('ui-large');
		else
			self.rclass('ui-large');

		isopen = false;
		issubmenu = false;
		prevsub = null;

		var css = {};
		children.aclass('hidden');
		children.find('ul').empty();
		clearTimeout2(self.ID);

		ul.html(self.makehtml(opt.items));

		if (!parentclass && opt.classname) {
			self.aclass(opt.classname);
			parentclass = opt.classname;
		}

		if (is) {
			css.left = 0;
			css.top = 0;
			self.element.css(css);
		} else {
			self.rclass('hidden');
			self.aclass(cls + '-visible', 100);
			is = true;
			if (!events.is)
				self.bindevents();
		}

		var target = $(opt.element);
		var w = self.width();
		var offset = target.offset();

		if (opt.element) {
			switch (opt.align) {
				case 'center':
					css.left = Math.ceil((offset.left - w / 2) + (target.innerWidth() / 2));
					break;
				case 'right':
					css.left = (offset.left - w) + target.innerWidth();
					break;
				default:
					css.left = offset.left;
					break;
			}

			css.top = opt.position === 'bottom' ? (offset.top - self.element.height() - 10) : (offset.top + target.innerHeight() + 10);

		} else {
			css.left = opt.x;
			css.top = opt.y;
		}

		if (opt.offsetX)
			css.left += opt.offsetX;

		if (opt.offsetY)
			css.top += opt.offsetY;

		var mw = w;
		var mh = self.height();

		if (css.left < 0)
			css.left = 10;
		else if ((mw + css.left) > WW)
			css.left = (WW - mw) - 10;

		if (css.top < 0)
			css.top = 10;
		else if ((mh + css.top) > WH)
			css.top = (WH - mh) - 10;

		self.element.css(css);
	};

	self.hide = function() {
		events.is && self.unbindevents();
		is = false;
		self.opt && self.opt.hide && self.opt.hide();
		self.target = null;
		self.opt = null;
		self.aclass('hidden');
		self.rclass(cls + '-visible');
	};

});

COMPONENT('validation', 'delay:100;flags:visible', function(self, config, cls) {

	var path, elements = null;
	var def = 'button[name="submit"]';
	var flags = null;
	var tracked = false;
	var reset = 0;
	var old, track;

	self.readonly();

	self.make = function() {
		elements = self.find(config.selector || def);
		path = self.path.replace(/\.\*$/, '');
	};

	self.configure = function(key, value, init) {
		switch (key) {
			case 'selector':
				if (!init)
					elements = self.find(value || def);
				break;
			case 'flags':
				if (value) {
					flags = value.split(',');
					for (var i = 0; i < flags.length; i++)
						flags[i] = '@' + flags[i];
				} else
					flags = null;
				break;
			case 'track':
				track = value.split(',').trim();
				break;
		}
	};

	var settracked = function() {
		tracked = 0;
	};

	self.setter = function(value, path, type) {

		var is = path === self.path || path.length < self.path.length;

		if (reset !== is) {
			reset = is;
			self.tclass(cls + '-modified', !reset);
		}

		if ((type === 1 || type === 2) && track && track.length) {
			for (var i = 0; i < track.length; i++) {
				if (path.indexOf(track[i]) !== -1) {
					tracked = 1;
					return;
				}
			}
			if (tracked === 1) {
				tracked = 2;
				setTimeout(settracked, config.delay * 3);
			}
		}
	};

	var check = function() {
		var disabled = tracked ? !VALID(path, flags) : DISABLED(path, flags);
		if (!disabled && config.if)
			disabled = !EVALUATE(self.path, config.if);
		if (disabled !== old) {
			elements.prop('disabled', disabled);
			self.tclass(cls + '-ok', !disabled);
			self.tclass(cls + '-no', disabled);
			old = disabled;
		}
	};

	self.state = function(type, what) {
		if (type === 3 || what === 3)
			tracked = 0;
		setTimeout2(self.ID, check, config.delay);
	};

});

COMPONENT('form', 'zindex:12;scrollbar:1', function(self, config, cls) {

	var cls2 = '.' + cls;
	var container;
	var csspos = {};

	if (!W.$$form) {

		W.$$form_level = W.$$form_level || 1;
		W.$$form = true;

		$(document).on('click', cls2 + '-button-close', function() {
			SET($(this).attrd('path'), '');
		});

		var resize = function() {
			setTimeout2('form', function() {
				for (var i = 0; i < M.components.length; i++) {
					var com = M.components[i];
					if (com.name === 'form' && !HIDDEN(com.dom) && com.$ready && !com.$removed)
						com.resize();
				}
			}, 200);
		};

		if (W.OP)
			W.OP.on('resize', resize);
		else
			$(W).on('resize', resize);

		$(document).on('click', cls2 + '-container', function(e) {

			var el = $(e.target);
			if (e.target === this || el.hclass(cls + '-container-padding')) {
				var com = $(this).component();
				if (com && com.config.closeoutside) {
					com.set('');
					return;
				}
			}

			if (!(el.hclass(cls + '-container-padding') || el.hclass(cls + '-container')))
				return;

			var form = $(this).find(cls2);
			var c = cls + '-animate-click';
			form.aclass(c);

			setTimeout(function() {
				form.rclass(c);
			}, 300);
		});
	}

	self.readonly();
	self.submit = function() {
		if (config.submit)
			self.EXEC(config.submit, self.hide, self.element);
		else
			self.hide();
	};

	self.cancel = function() {
		config.cancel && self.EXEC(config.cancel, self.hide);
		self.hide();
	};

	self.hide = function() {
		if (config.independent)
			self.hideforce();
		self.esc(false);
		self.set('');
	};

	self.icon = function(value) {
		var el = this.rclass2('fa');
		value.icon && el.aclass(value.icon.indexOf(' ') === -1 ? ('fa fa-' + value.icon) : value.icon);
		el.tclass('hidden', !value.icon);
	};

	self.resize = function() {

		if (self.scrollbar) {
			container.css('height', WH);
			self.scrollbar.resize();
		}

		if (!config.center || self.hclass('hidden'))
			return;

		var ui = self.find(cls2);
		var fh = ui.innerHeight();
		var wh = WH;
		var r = (wh / 2) - (fh / 2);
		csspos.marginTop = (r > 30 ? (r - 15) : 20) + 'px';
		ui.css(csspos);
	};

	self.make = function() {

		$(document.body).append('<div id="{0}" class="hidden {4}-container invisible"><div class="{4}-scrollbar"><div class="{4}-container-padding"><div class="{4}" style="max-width:{1}px"><div data-bind="@config__text span:value.title__change .{4}-icon:@icon" class="{4}-title"><button name="cancel" class="{4}-button-close{3}" data-path="{2}"><i class="fa fa-times"></i></button><i class="{4}-icon"></i><span></span></div></div></div></div>'.format(self.ID, config.width || 800, self.path, config.closebutton == false ? ' hidden' : '', cls));

		var scr = self.find('> script');
		self.template = scr.length ? scr.html().trim() : '';
		if (scr.length)
			scr.remove();

		var el = $('#' + self.ID);
		var body = el.find(cls2)[0];
		container = el.find(cls2 + '-scrollbar');

		if (config.scrollbar) {
			el.css('overflow', 'hidden');
			self.scrollbar = SCROLLBAR(el.find(cls2 + '-scrollbar'), { visibleY: 1, orientation: 'y' });
		}

		while (self.dom.children.length)
			body.appendChild(self.dom.children[0]);

		self.rclass('hidden invisible');
		self.replace(el, true);

		self.event('scroll', function() {
			EMIT('scroll', self.name);
			EMIT('reflow', self.name);
		});

		self.event('click', 'button[name]', function() {
			var t = this;
			switch (t.name) {
				case 'submit':
					self.submit(self.hide);
					break;
				case 'cancel':
					!t.disabled && self[t.name](self.hide);
					break;
			}
		});

		config.enter && self.event('keydown', 'input', function(e) {
			e.which === 13 && !self.find('button[name="submit"]')[0].disabled && setTimeout(self.submit, 800);
		});
	};

	self.configure = function(key, value, init, prev) {
		if (init)
			return;
		switch (key) {
			case 'width':
				value !== prev && self.find(cls2).css('max-width', value + 'px');
				break;
			case 'closebutton':
				self.find(cls2 + '-button-close').tclass('hidden', value !== true);
				break;
		}
	};

	self.esc = function(bind) {
		if (bind) {
			if (!self.$esc) {
				self.$esc = true;
				$(W).on('keydown', self.esc_keydown);
			}
		} else {
			if (self.$esc) {
				self.$esc = false;
				$(W).off('keydown', self.esc_keydown);
			}
		}
	};

	self.esc_keydown = function(e) {
		if (e.which === 27 && !e.isPropagationStopped()) {
			var val = self.get();
			if (!val || config.if === val) {
				e.preventDefault();
				e.stopPropagation();
				self.hide();
			}
		}
	};

	self.hideforce = function() {
		if (!self.hclass('hidden')) {
			self.aclass('hidden');
			self.release(true);
			self.find(cls2).rclass(cls + '-animate');
			W.$$form_level--;
		}
	};

	var allowscrollbars = function() {
		$('html').tclass(cls + '-noscroll', !!$(cls2 + '-container').not('.hidden').length);
	};

	self.setter = function(value) {

		setTimeout2(self.name + '-noscroll', allowscrollbars, 50);

		var isHidden = value !== config.if;

		if (self.hclass('hidden') === isHidden) {
			if (!isHidden) {
				config.reload && self.EXEC(config.reload, self);
				config.default && DEFAULT(self.makepath(config.default), true);
			}
			return;
		}

		setTimeout2(cls, function() {
			EMIT('reflow', self.name);
		}, 10);

		if (isHidden) {
			if (!config.independent)
				self.hideforce();
			return;
		}

		if (self.template) {
			var is = self.template.COMPILABLE();
			self.find(cls2).append(self.template);
			self.template = null;
			is && COMPILE();
		}

		if (W.$$form_level < 1)
			W.$$form_level = 1;

		W.$$form_level++;

		self.css('z-index', W.$$form_level * config.zindex);
		self.element.scrollTop(0);
		self.rclass('hidden');

		self.resize();
		self.release(false);

		config.reload && self.EXEC(config.reload, self);
		config.default && DEFAULT(self.makepath(config.default), true);

		if (!isMOBILE && config.autofocus) {
			setTimeout(function() {
				self.find(typeof(config.autofocus) === 'string' ? config.autofocus : 'input[type="text"],select,textarea').eq(0).focus();
			}, 1000);
		}

		setTimeout(function() {
			self.rclass('invisible');
			self.element.scrollTop(0);
			self.find(cls2).aclass(cls + '-animate');
		}, 300);

		// Fixes a problem with freezing of scrolling in Chrome
		setTimeout2(self.ID, function() {
			self.css('z-index', (W.$$form_level * config.zindex) + 1);
		}, 500);

		config.closeesc && self.esc(true);
	};
});

COMPONENT('input', 'maxlength:200;dirkey:name;dirvalue:id;increment:1;autovalue:name;direxclude:false;forcevalidation:1;searchalign:1;after:\\:', function(self, config, cls) {

	var cls2 = '.' + cls;
	var input, placeholder, dirsource, binded, customvalidator, mask, rawvalue, isdirvisible = false, nobindcamouflage = false, focused = false;

	self.nocompile();
	self.bindvisible(20);

	self.init = function() {
		Thelpers.ui_input_icon = function(val) {
			return val.charAt(0) === '!' || val.indexOf(' ') !== -1 ? ('<span class="ui-input-icon-custom"><i class="' + (val.charAt(0) === '!' ? val.substring(1) : val) + '"></i></span>') : ('<i class="fa fa-' + val + '"></i>');
		};
		W.ui_input_template = Tangular.compile(('{{ if label }}<div class="{0}-label">{{ if icon }}<i class="{{ icon }}"></i>{{ fi }}{{ label | raw }}{{ after | raw }}</div>{{ fi }}<div class="{0}-control{{ if licon }} {0}-licon{{ fi }}{{ if ricon || (type === \'number\' && increment) }} {0}-ricon{{ fi }}">{{ if ricon || (type === \'number\' && increment) }}<div class="{0}-icon-right{{ if type === \'number\' && increment && !ricon }} {0}-increment{{ else if riconclick || type === \'date\' || type === \'time\' || (type === \'search\' && searchalign === 1) || type === \'password\' }} {0}-click{{ fi }}">{{ if type === \'number\' && !ricon }}<i class="fa fa-caret-up"></i><i class="fa fa-caret-down"></i>{{ else }}{{ ricon | ui_input_icon }}{{ fi }}</div>{{ fi }}{{ if licon }}<div class="{0}-icon-left{{ if liconclick || (type === \'search\' && searchalign !== 1) }} {0}-click{{ fi }}">{{ licon | ui_input_icon }}</div>{{ fi }}<div class="{0}-input{{ if align === 1 || align === \'center\' }} center{{ else if align === 2 || align === \'right\' }} right{{ fi }}">{{ if placeholder && !innerlabel }}<div class="{0}-placeholder">{{ placeholder }}</div>{{ fi }}{{ if dirsource || type === \'icon\' || type === \'emoji\' || type === \'color\' }}<div class="{0}-value" tabindex="0"></div>{{ else }}<input type="{{ if type === \'password\' }}password{{ else }}text{{ fi }}"{{ if autofill }} autocomplete="on" name="{{ PATH }}"{{ else }} name="input' + Date.now() + '" autocomplete="new-password"{{ fi }} data-jc-bind=""{{ if maxlength > 0}} maxlength="{{ maxlength }}"{{ fi }}{{ if autofocus }} autofocus{{ fi }} />{{ fi }}</div></div>{{ if error }}<div class="{0}-error hidden"><i class="fa fa-warning"></i> {{ error }}</div>{{ fi }}').format(cls));
	};

	self.make = function() {

		if (!config.label)
			config.label = self.html();

		if (isMOBILE && config.autofocus)
			config.autofocus = false;

		config.PATH = self.path.replace(/\./g, '_');

		self.aclass(cls + ' invisible');
		self.rclass('invisible', 100);
		self.redraw();

		self.event('input change', function() {
			if (nobindcamouflage)
				nobindcamouflage = false;
			else
				self.check();
		});

		self.event('focus', 'input,' + cls2 + '-value', function() {

			if (config.disabled)
				return $(this).blur();

			focused = true;
			self.camouflage(false);
			self.aclass(cls + '-focused');
			config.autocomplete && EXEC(self.makepath(config.autocomplete), self, input.parent());
			if (config.autosource) {
				var opt = {};
				opt.element = self.element;
				opt.search = GET(self.makepath(config.autosource));
				opt.callback = function(value) {
					var val = typeof(value) === 'string' ? value : value[config.autovalue];
					if (config.autoexec) {
						EXEC(self.makepath(config.autoexec), value, function(val) {
							self.set(val, 2);
							self.change();
							self.bindvalue();
						});
					} else {
						self.set(val, 2);
						self.change();
						self.bindvalue();
					}
				};
				SETTER('autocomplete', 'show', opt);
			} else if (config.mask) {
				setTimeout(function(input) {
					input.selectionStart = input.selectionEnd = 0;
				}, 50, this);
			} else if (config.dirsource && (config.autofocus != false && config.autofocus != 0)) {
				if (!isdirvisible)
					self.find(cls2 + '-control').trigger('click');
			}
		});

		self.event('paste', 'input', function(e) {
			if (config.mask) {
				var val = (e.originalEvent.clipboardData || window.clipboardData).getData('text');
				self.set(val.replace(/\s|\t/g, ''));
				e.preventDefault();
			}
		});

		self.event('keydown', 'input', function(e) {

			var t = this;
			var code = e.which;

			if (t.readOnly || config.disabled) {
				// TAB
				if (e.keyCode !== 9) {
					if (config.dirsource) {
						self.find(cls2 + '-control').trigger('click');
						return;
					}
					e.preventDefault();
					e.stopPropagation();
				}
				return;
			}

			if (!config.disabled && config.dirsource && (code === 13 || code > 30)) {
				self.find(cls2 + '-control').trigger('click');
				return;
			}

			if (config.mask) {

				if (e.metaKey) {
					if (code === 8 || code === 127) {
						e.preventDefault();
						e.stopPropagation();
					}
					return;
				}

				if (code === 32) {
					e.preventDefault();
					e.stopPropagation();
					return;
				}

				var beg = e.target.selectionStart;
				var end = e.target.selectionEnd;
				var val = t.value;
				var c;

				if (code === 8 || code === 127) {

					if (beg === end) {
						c = config.mask.substring(beg - 1, beg);
						t.value = val.substring(0, beg - 1) + c + val.substring(beg);
						self.curpos(beg - 1);
					} else {
						for (var i = beg; i <= end; i++) {
							c = config.mask.substring(i - 1, i);
							val = val.substring(0, i - 1) + c + val.substring(i);
						}
						t.value = val;
						self.curpos(beg);
					}

					e.preventDefault();
					return;
				}

				if (code > 40) {

					var cur = String.fromCharCode(code);

					if (mask && mask[beg]) {
						if (!mask[beg].test(cur)) {
							e.preventDefault();
							return;
						}
					}

					c = config.mask.charCodeAt(beg);
					if (c !== 95) {
						beg++;
						while (true) {
							c = config.mask.charCodeAt(beg);
							if (c === 95 || isNaN(c))
								break;
							else
								beg++;
						}
					}

					if (c === 95) {

						val = val.substring(0, beg) + cur + val.substring(beg + 1);
						t.value = val;
						beg++;

						while (beg < config.mask.length) {
							c = config.mask.charCodeAt(beg);
							if (c === 95)
								break;
							else
								beg++;
						}

						self.curpos(beg);
					} else
						self.curpos(beg + 1);

					e.preventDefault();
					e.stopPropagation();
				}
			}

		});

		self.event('blur', 'input', function() {
			focused = false;
			self.camouflage(true);
			self.rclass(cls + '-focused');
		});

		self.event('click', cls2 + '-control', function() {

			if (config.disabled || isdirvisible)
				return;

			if (config.type === 'icon') {
				opt = {};
				opt.element = self.element;
				opt.value = self.get();
				opt.empty = true;
				opt.callback = function(val) {
					self.change(true);
					self.set(val);
					self.check();
					rawvalue.focus();
				};
				SETTER('faicons', 'show', opt);
				return;
			} else if (config.type === 'color') {
				opt = {};
				opt.element = self.element;
				opt.value = self.get();
				opt.empty = true;
				opt.callback = function(al) {
					self.change(true);
					self.set(al);
					self.check();
					rawvalue.focus();
				};
				SETTER('colorpicker', 'show', opt);
				return;
			} else if (config.type === 'emoji') {
				opt = {};
				opt.element = self.element;
				opt.value = self.get();
				opt.empty = true;
				opt.callback = function(al) {
					self.change(true);
					self.set(al);
					self.check();
					rawvalue.focus();
				};
				SETTER('emoji', 'show', opt);
				return;
			}

			if (!config.dirsource)
				return;

			isdirvisible = true;
			setTimeout(function() {
				isdirvisible = false;
			}, 500);

			var opt = {};
			opt.element = self.find(cls2 + '-control');
			opt.items = dirsource || GET(self.makepath(config.dirsource));
			opt.offsetY = -1 + (config.diroffsety || 0);
			opt.offsetX = 0 + (config.diroffsetx || 0);
			opt.placeholder = config.dirplaceholder;
			opt.render = config.dirrender ? GET(self.makepath(config.dirrender)) : null;
			opt.custom = !!config.dircustom;
			opt.offsetWidth = 2;
			opt.minwidth = config.dirminwidth || 200;
			opt.maxwidth = config.dirmaxwidth;
			opt.key = config.dirkey || config.key;
			opt.empty = config.dirempty;

			if (config.dirraw)
				opt.raw = true;

			if (config.dirsearch != null)
				opt.search = config.dirsearch;

			var val = self.get();
			opt.selected = val;

			if (dirsource && config.direxclude == false) {
				for (var i = 0; i < dirsource.length; i++) {
					var item = dirsource[i];
					if (item)
						item.selected = typeof(item) === 'object' && item[config.dirvalue] === val;
				}
			} else if (config.direxclude) {
				opt.exclude = function(item) {
					return item ? item[config.dirvalue] === val : false;
				};
			}

			opt.callback = function(item, el, custom) {

				// empty
				if (item == null) {
					rawvalue.html('');
					self.set(null, 2);
					self.change();
					self.check();
					return;
				}

				var val = custom || typeof(item) === 'string' ? item : item[config.dirvalue || config.value];
				if (custom && typeof(config.dircustom) === 'string') {
					var fn = GET(config.dircustom);
					fn(val, function(val) {
						self.set(val, 2);
						self.change();
						self.bindvalue();
					});
				} else if (custom) {
					if (val) {
						self.set(val, 2);
						self.change();
						if (dirsource)
							self.bindvalue();
						else
							input.val(val);
					}
				} else {
					self.set(val, 2);
					self.change();
					if (dirsource)
						self.bindvalue();
					else
						input.val(val);
				}

				rawvalue.focus();
			};

			SETTER('directory', 'show', opt);
		});

		self.event('click', cls2 + '-placeholder,' + cls2 + '-label', function(e) {
			if (!config.disabled) {
				if (config.dirsource) {
					e.preventDefault();
					e.stopPropagation();
					self.find(cls2 + '-control').trigger('click');
				} else if (!config.camouflage || $(e.target).hclass(cls + '-placeholder')) {
					if (input.length)
						input.focus();
					else
						rawvalue.focus();
				}
			}
		});

		self.event('click', cls2 + '-icon-left,' + cls2 + '-icon-right', function(e) {

			if (config.disabled)
				return;

			var el = $(this);
			var left = el.hclass(cls + '-icon-left');
			var opt;

			if (config.dirsource && left && config.liconclick) {
				e.preventDefault();
				e.stopPropagation();
			}

			if (!left && !config.riconclick) {
				if (config.type === 'date') {
					opt = {};
					opt.element = self.element;
					opt.value = self.get();
					opt.callback = function(val) {
						self.change(true);
						self.set(val);
						input.focus();
					};
					SETTER('datepicker', 'show', opt);
				} else if (config.type === 'time') {
					opt = {};
					opt.element = self.element;
					opt.value = self.get();
					opt.callback = function(val) {
						self.change(true);
						self.set(val);
						input.focus();
					};
					SETTER('timepicker', 'show', opt);
				} else if (config.type === 'search')
					self.set('');
				else if (config.type === 'password')
					self.password();
				else if (config.type === 'number') {
					var tmp = $(e.target);
					if (tmp.attr('class').indexOf('fa-') !== -1) {
						var n = tmp.hclass('fa-caret-up') ? 1 : -1;
						self.change(true);
						var val = self.preparevalue((self.get() || 0) + (config.increment * n));
						self.set(val, 2);
					}
				}
				return;
			}

			if (left && config.liconclick)
				EXEC(self.makepath(config.liconclick), self, el);
			else if (config.riconclick)
				EXEC(self.makepath(config.riconclick), self, el);
			else if (left && config.type === 'search')
				self.set('');

		});
	};

	self.camouflage = function(is) {
		if (config.camouflage) {
			if (is) {
				var t = input[0];
				var arr = t.value.split('');
				for (var i = 0; i < arr.length; i++)
					arr[i] = typeof(config.camouflage) === 'string' ? config.camouflage : '*';
				nobindcamouflage = true;
				t.value = arr.join('');
			} else {
				nobindcamouflage = true;
				var val = self.get();
				input[0].value = val == null ? '' : val;
			}
			self.tclass(cls + '-camouflaged', is);
		}
	};

	self.curpos = function(pos) {
		var el = input[0];
		if (el.createTextRange) {
			var range = el.createTextRange();
			range.move('character', pos);
			range.select();
		} else if (el.selectionStart) {
			el.focus();
			el.setSelectionRange(pos, pos);
		}
	};

	self.validate = function(value) {

		if ((!config.required || config.disabled) && !self.forcedvalidation())
			return true;

		if (config.dirsource)
			return !!value;

		if (customvalidator)
			return customvalidator(value);

		if (self.type === 'date')
			return value instanceof Date && !isNaN(value.getTime());

		if (value == null)
			value = '';
		else
			value = value.toString();

		if (config.mask && typeof(value) === 'string' && value.indexOf('_') !== -1)
			return false;

		if (config.minlength && value.length < config.minlength)
			return false;

		switch (self.type) {
			case 'email':
				return value.isEmail();
			case 'phone':
				return value.isPhone();
			case 'url':
				return value.isURL();
			case 'zip':
				return (/^\d{5}(?:[-\s]\d{4})?$/).test(value);
			case 'currency':
			case 'number':
				value = value.parseFloat();
				if ((config.minvalue != null && value < config.minvalue) || (config.maxvalue != null && value > config.maxvalue))
					return false;
				return config.minvalue == null ? value > 0 : true;
		}

		return value.length > 0;
	};

	self.offset = function() {
		var offset = self.element.offset();
		var control = self.find(cls2 + '-control');
		var width = control.width() + 2;
		return { left: offset.left, top: control.offset().top + control.height(), width: width };
	};

	self.password = function(show) {
		var visible = show == null ? input.attr('type') === 'text' : show;
		input.attr('type', visible ? 'password' : 'text');
		self.find(cls2 + '-icon-right').find('i').tclass(config.ricon, visible).tclass('fa-eye-slash', !visible);
	};

	self.preparevalue = function(value) {

		if (self.type === 'number' && (config.minvalue != null || config.maxvalue != null)) {
			var tmp = typeof(value) === 'string' ? +value.replace(',', '.') : value;
			if (config.minvalue > tmp)
				value = config.minvalue;
			if (config.maxvalue < tmp)
				value = config.maxvalue;
		}

		return value;
	};

	self.getterin = self.getter;
	self.getter = function(value, realtime, nobind) {

		if (nobindcamouflage)
			return;

		if (config.mask && config.masktidy) {
			var val = [];
			for (var i = 0; i < value.length; i++) {
				if (config.mask.charAt(i) === '_')
					val.push(value.charAt(i));
			}
			value = val.join('');
		}

		self.getterin(self.preparevalue(value), realtime, nobind);
	};

	self.setterin = self.setter;

	self.setter = function(value, path, type) {

		if (config.mask) {
			if (value) {
				if (config.masktidy) {
					var index = 0;
					var val = [];
					for (var i = 0; i < config.mask.length; i++) {
						var c = config.mask.charAt(i);
						val.push(c === '_' ? (value.charAt(index++) || '_') : c);
					}
					value = val.join('');
				}

				// check values
				if (mask) {
					var arr = [];
					for (var i = 0; i < mask.length; i++) {
						var c = value.charAt(i);
						if (mask[i] && mask[i].test(c))
							arr.push(c);
						else
							arr.push(config.mask.charAt(i));
					}
					value = arr.join('');
				}
			} else
				value = config.mask;
		}

		self.setterin(value, path, type);
		self.bindvalue();

		config.camouflage && !focused && setTimeout(self.camouflage, type === 1 ? 1000 : 1, true);

		if (config.type === 'password')
			self.password(true);
	};

	self.check = function() {

		var is = input.length ? !!input[0].value : !!self.get();

		if (binded === is)
			return;

		binded = is;
		placeholder && placeholder.tclass('hidden', is);
		self.tclass(cls + '-binded', is);

		if (config.type === 'search')
			self.find(cls2 + '-icon-' + (config.searchalign === 1 ? 'right' : 'left')).find('i').tclass(config.searchalign === 1 ? config.ricon : config.licon, !is).tclass('fa-times', is);
	};

	self.bindvalue = function() {

		var value = self.get();

		if (dirsource) {

			var item;

			for (var i = 0; i < dirsource.length; i++) {
				item = dirsource[i];
				if (typeof(item) === 'string') {
					if (item === value)
						break;
					item = null;
				} else if (item[config.dirvalue || config.value] === value) {
					item = item[config.dirkey || config.key];
					break;
				} else
					item = null;
			}

			if (value && item == null && config.dircustom)
				item = value;

			if (config.dirraw)
				rawvalue.html(item || '');
			else
				rawvalue.text(item || '');

		} else if (config.dirsource)
			if (config.dirraw)
				rawvalue.html(value || '');
			else
				rawvalue.text(value || '');
		else {
			switch (config.type) {
				case 'color':
					rawvalue.css('background-color', value || '');
					break;
				case 'icon':
					rawvalue.html('<i class="{0}"></i>'.format(value || ''));
					break;
				case 'emoji':
					rawvalue.html(value);
					break;
			}
		}

		self.check();
	};

	self.redraw = function() {

		if (!config.ricon) {
			if (config.dirsource)
				config.ricon = 'angle-down';
			else if (config.type === 'date') {
				config.ricon = 'calendar';
				if (!config.align && !config.innerlabel)
					config.align = 1;
			} else if (config.type === 'icon' || config.type === 'color' || config.type === 'emoji') {
				config.ricon = 'angle-down';
				if (!config.align && !config.innerlabel)
					config.align = 1;
			} else if (config.type === 'time') {
				config.ricon = 'clock-o';
				if (!config.align && !config.innerlabel)
					config.align = 1;
			} else if (config.type === 'search')
				if (config.searchalign === 1)
					config.ricon = 'search';
				else
					config.licon = 'search';
			else if (config.type === 'password')
				config.ricon = 'eye';
			else if (config.type === 'number') {
				if (!config.align && !config.innerlabel)
					config.align = 1;
			}
		}

		self.tclass(cls + '-masked', !!config.mask);
		self.rclass2(cls + '-type-');

		if (config.type)
			self.aclass(cls + '-type-' + config.type);

		self.html(W.ui_input_template(config));
		input = self.find('input');
		rawvalue = self.find(cls2 + '-value');
		placeholder = self.find(cls2 + '-placeholder');
	};

	self.configure = function(key, value) {
		switch (key) {
			case 'icon':
				if (value && value.indexOf(' ') === -1)
					config.icon = 'fa fa-' + value;
				break;
			case 'dirsource':
				if (config.dirajax || value.indexOf('/') !== -1) {
					dirsource = null;
					self.bindvalue();
				} else {
					if (value.indexOf(',') !== -1) {
						dirsource = self.parsesource(value);
						self.bindvalue();
					} else {
						self.datasource(value, function(path, value) {
							dirsource = value;
							self.bindvalue();
						});
					}
				}
				self.tclass(cls + '-dropdown', !!value);
				input.prop('readonly', !!config.disabled || !!config.dirsource);
				break;
			case 'disabled':
				self.tclass('ui-disabled', !!value);
				input.prop('readonly', !!value || !!config.dirsource);
				self.reset();
				break;
			case 'required':
				self.tclass(cls + '-required', !!value);
				self.reset();
				break;
			case 'type':
				self.type = value;
				break;
			case 'validate':
				customvalidator = value ? (/\(|=|>|<|\+|-|\)/).test(value) ? FN('value=>' + value) : (function(path) { path = self.makepath(path); return function(value) { return GET(path)(value); }; })(value) : null;
				break;
			case 'innerlabel':
				self.tclass(cls + '-inner', !!value);
				break;
			case 'monospace':
				self.tclass(cls + '-monospace', !!value);
				break;
			case 'maskregexp':
				if (value) {
					mask = value.toLowerCase().split(',');
					for (var i = 0; i < mask.length; i++) {
						var m = mask[i];
						if (!m || m === 'null')
							mask[i] = '';
						else
							mask[i] = new RegExp(m);
					}
				} else
					mask = null;
				break;
			case 'mask':
				config.mask = value.replace(/#/g, '_');
				break;
		}
	};

	self.formatter(function(path, value) {
		if (value) {
			switch (config.type) {
				case 'lower':
					return (value + '').toLowerCase();
				case 'upper':
					return (value + '').toUpperCase();
				case 'phone':
					return (value + '').replace(/\s/g, '');
				case 'email':
					return (value + '').toLowerCase();
				case 'date':
					return value.format(config.format || 'yyyy-MM-dd');
				case 'time':
					return value.format(config.format || 'HH:mm');
				case 'number':
					return config.format ? value.format(config.format) : value;
			}
		}

		return value;
	});

	self.parser(function(path, value) {
		if (value) {
			var tmp;
			switch (config.type) {
				case 'date':
					tmp = self.get();
					if (tmp)
						tmp = tmp.format('HH:mm');
					else
						tmp = '';
					return value + (tmp ? (' ' + tmp) : '');
				case 'lower':
				case 'email':
					value = value.toLowerCase();
					break;
				case 'upper':
					value = value.toUpperCase();
					break;
				case 'phone':
					value = value.replace(/\s/g, '');
					break;
				case 'time':
					tmp = value.split(':');
					var dt = self.get();
					if (dt == null)
						dt = new Date();
					dt.setHours(+(tmp[0] || '0'));
					dt.setMinutes(+(tmp[1] || '0'));
					dt.setSeconds(+(tmp[2] || '0'));
					value = dt;
					break;
			}
		}
		return value ? config.spaces === false ? value.replace(/\s/g, '') : value : value;
	});

	self.state = function(type) {
		if (type) {
			var invalid = config.required ? self.isInvalid() : self.forcedvalidation() ? self.isInvalid() : false;
			if (invalid === self.$oldstate)
				return;
			self.$oldstate = invalid;
			self.tclass(cls + '-invalid', invalid);
			config.error && self.find(cls2 + '-error').tclass('hidden', !invalid);
		}
	};

	self.forcedvalidation = function() {

		if (!config.forcevalidation)
			return false;

		if (self.type === 'number')
			return false;

		var val = self.get();
		return (self.type === 'phone' || self.type === 'email') && (val != null && (typeof(val) === 'string' && val.length !== 0));
	};

});

COMPONENT('checkbox', function(self, config, cls) {

	self.nocompile && self.nocompile();

	self.validate = function(value) {
		return (config.disabled || !config.required) ? true : (value === true || value === 'true' || value === 'on');
	};

	self.configure = function(key, value, init) {
		if (!init) {
			switch (key) {
				case 'label':
					self.find('span').html(value);
					break;
				case 'required':
					self.find('span').tclass(cls + '-label-required', value);
					break;
				case 'disabled':
					self.tclass('ui-disabled', value);
					break;
				case 'checkicon':
					self.find('i').rclass2('fa-').aclass('fa-' + value);
					break;
			}
		}
	};

	self.make = function() {
		self.aclass(cls);
		self.html('<div><i class="fa fa-{2}"></i></div><span{1}>{0}</span>'.format(config.label || self.html(), config.required ? (' class="' + cls + '-label-required"') : '', config.checkicon || 'check'));
		config.disabled && self.aclass('ui-disabled');
		self.event('click', function() {
			if (!config.disabled) {
				self.dirty(false);
				self.getter(!self.get());
			}
		});
	};

	self.setter = function(value) {
		var is = config.reverse ? !value : !!value;
		self.tclass(cls + '-checked', is);
	};
});

COMPONENT('directory', 'minwidth:200', function(self, config, cls) {

	var cls2 = '.' + cls;
	var container, timeout, icon, plus, skipreset = false, skipclear = false, ready = false, input = null, issearch = false;
	var is = false, selectedindex = 0, resultscount = 0;
	var templateE = '{{ name | encode | ui_directory_helper }}';
	var templateR = '{{ name | raw }}';
	var template = '<li data-index="{{ $.index }}" data-search="{{ $.search }}" {{ if selected }} class="current selected{{ if classname }} {{ classname }}{{ fi }}"{{ else if classname }} class="{{ classname }}"{{ fi }}>{0}</li>';
	var templateraw = template.format(templateR);
	var regstrip = /(&nbsp;|<([^>]+)>)/ig;
	var parentclass;

	template = template.format(templateE);

	Thelpers.ui_directory_helper = function(val) {
		var t = this;
		return t.template ? (typeof(t.template) === 'string' ? t.template.indexOf('{{') === -1 ? t.template : Tangular.render(t.template, this) : t.render(this, val)) : self.opt.render ? self.opt.render(this, val) : val;
	};

	self.template = Tangular.compile(template);
	self.templateraw = Tangular.compile(templateraw);

	self.readonly();
	self.singleton();
	self.nocompile && self.nocompile();

	self.configure = function(key, value, init) {
		if (init)
			return;
		switch (key) {
			case 'placeholder':
				self.find('input').prop('placeholder', value);
				break;
		}
	};

	self.make = function() {

		self.aclass(cls + ' hidden');
		self.append('<div class="{1}-search"><span class="{1}-add hidden"><i class="fa fa-plus"></i></span><span class="{1}-button"><i class="fa fa-search"></i></span><div><input type="text" placeholder="{0}" class="{1}-search-input" name="dir{2}" autocomplete="new-password" /></div></div><div class="{1}-container"><ul></ul></div>'.format(config.placeholder, cls, Date.now()));
		container = self.find('ul');
		input = self.find('input');
		icon = self.find(cls2 + '-button').find('.fa');
		plus = self.find(cls2 + '-add');

		self.event('mouseenter mouseleave', 'li', function() {
			if (ready && !issearch) {
				container.find('li.current').rclass('current');
				$(this).aclass('current');
				var arr = container.find('li:visible');
				for (var i = 0; i < arr.length; i++) {
					if ($(arr[i]).hclass('current')) {
						selectedindex = i;
						break;
					}
				}
			}
		});

		self.event('focus', 'input', function() {
			if (self.opt.search === false)
				$(this).blur();
		});

		self.event('click', cls2 + '-button', function(e) {
			skipclear = false;
			input.val('');
			self.search();
			e.stopPropagation();
			e.preventDefault();
		});

		self.event('click', cls2 + '-add', function() {
			if (self.opt.custom && self.opt.callback) {
				self.opt.scope && M.scope(self.opt.scope);
				self.opt.callback(input.val(), self.opt.element, true);
				self.hide();
			}
		});

		self.event('click', 'li', function(e) {
			if (self.opt.callback) {
				self.opt.scope && M.scope(self.opt.scope);
				self.opt.callback(self.opt.items[+this.getAttribute('data-index')], self.opt.element);
			}
			is = true;
			self.hide(0);
			e.preventDefault();
			e.stopPropagation();
		});

		var e_click = function(e) {
			var node = e.target;
			var count = 0;

			if (is) {
				while (true) {
					var c = node.getAttribute('class') || '';
					if (c.indexOf(cls + '-search-input') !== -1)
						return;
					node = node.parentNode;
					if (!node || !node.tagName || node.tagName === 'BODY' || count > 3)
						break;
					count++;
				}
			} else {
				is = true;
				while (true) {
					var c = node.getAttribute('class') || '';
					if (c.indexOf(cls) !== -1) {
						is = false;
						break;
					}
					node = node.parentNode;
					if (!node || !node.tagName || node.tagName === 'BODY' || count > 4)
						break;
					count++;
				}
			}

			is && self.hide(0);
		};

		var e_resize = function() {
			is && self.hide(0);
		};

		self.bindedevents = false;

		self.bindevents = function() {
			if (!self.bindedevents) {
				$(document).on('click', e_click);
				$(W).on('resize', e_resize);
				self.bindedevents = true;
			}
		};

		self.unbindevents = function() {
			if (self.bindedevents) {
				self.bindedevents = false;
				$(document).off('click', e_click);
				$(W).off('resize', e_resize);
			}
		};

		self.event('keydown', 'input', function(e) {
			var o = false;
			switch (e.which) {
				case 8:
					skipclear = false;
					break;
				case 27:
					o = true;
					self.hide();
					break;
				case 13:
					o = true;
					var sel = self.find('li.current');
					if (self.opt.callback) {
						self.opt.scope && M.scope(self.opt.scope);
						if (sel.length)
							self.opt.callback(self.opt.items[+sel.attrd('index')], self.opt.element);
						else if (self.opt.custom)
							self.opt.callback(this.value, self.opt.element, true);
					}
					self.hide();
					break;
				case 38: // up
					o = true;
					selectedindex--;
					if (selectedindex < 0)
						selectedindex = 0;
					self.move();
					break;
				case 40: // down
					o = true;
					selectedindex++;
					if (selectedindex >= resultscount)
						selectedindex = resultscount;
					self.move();
					break;
			}

			if (o) {
				e.preventDefault();
				e.stopPropagation();
			}

		});

		self.event('input', 'input', function() {
			issearch = true;
			setTimeout2(self.ID, self.search, 100, null, this.value);
		});

		var fn = function() {
			is && self.hide(1);
		};

		self.on('reflow', fn);
		self.on('scroll', fn);
		self.on('resize', fn);
		$(W).on('scroll', fn);
	};

	self.move = function() {

		var counter = 0;
		var scroller = container.parent();
		var li = container.find('li');
		var hli = (li.eq(0).innerHeight() || 30) + 1;
		var was = false;
		var last = -1;
		var lastselected = 0;
		var plus = (hli * 2);

		for (var i = 0; i < li.length; i++) {

			var el = $(li[i]);

			if (el.hclass('hidden')) {
				el.rclass('current');
				continue;
			}

			var is = selectedindex === counter;
			el.tclass('current', is);

			if (is) {
				was = true;
				var t = (hli * (counter || 1));
				// var p = (t / sh) * 100;
				scroller[0].scrollTop = t - plus;
			}

			counter++;
			last = i;
			lastselected++;
		}

		if (!was && last >= 0) {
			selectedindex = lastselected;
			li.eq(last).aclass('current');
		}
	};

	var nosearch = function() {
		issearch = false;
	};

	self.nosearch = function() {
		setTimeout2(self.ID + 'nosearch', nosearch, 500);
	};

	self.search = function(value) {

		if (!self.opt)
			return;

		icon.tclass('fa-times', !!value).tclass('fa-search', !value);
		self.opt.custom && plus.tclass('hidden', !value);

		if (!value && !self.opt.ajax) {
			if (!skipclear)
				container.find('li').rclass('hidden');
			if (!skipreset)
				selectedindex = 0;
			resultscount = self.opt.items ? self.opt.items.length : 0;
			self.move();
			self.nosearch();
			return;
		}

		resultscount = 0;
		selectedindex = 0;

		if (self.opt.ajax) {
			var val = value || '';
			if (self.ajaxold !== val) {
				self.ajaxold = val;
				setTimeout2(self.ID, function(val) {
					self.opt && self.opt.ajax(val, function(items) {
						var builder = [];
						var indexer = {};
						var item;
						var key = (self.opt.search == true ? self.opt.key : (self.opt.search || self.opt.key)) || 'name';

						for (var i = 0; i < items.length; i++) {
							item = items[i];
							if (self.opt.exclude && self.opt.exclude(item))
								continue;
							indexer.index = i;
							indexer.search = item[key] ? item[key].replace(regstrip, '') : '';
							resultscount++;
							builder.push(self.opt.ta(item, indexer));
						}

						if (self.opt.empty) {
							item = {};
							var tmp = self.opt.raw ? '<b>{0}</b>'.format(self.opt.empty) : self.opt.empty;
							item[self.opt.key || 'name'] = tmp;
							if (!self.opt.raw)
								item.template = '<b>{0}</b>'.format(self.opt.empty);
							indexer.index = -1;
							builder.unshift(self.opt.ta(item, indexer));
						}

						skipclear = true;
						self.opt.items = items;
						container.html(builder);
						self.move();
						self.nosearch();
					});
				}, 300, null, val);
			}
		} else if (value) {
			value = value.toSearch();
			var arr = container.find('li');
			for (var i = 0; i < arr.length; i++) {
				var el = $(arr[i]);
				var val = el.attrd('search').toSearch();
				var is = val.indexOf(value) === -1;
				el.tclass('hidden', is);
				if (!is)
					resultscount++;
			}
			skipclear = true;
			self.move();
			self.nosearch();
		}
	};

	self.show = function(opt) {

		// opt.element
		// opt.items
		// opt.callback(value, el)
		// opt.offsetX     --> offsetX
		// opt.offsetY     --> offsetY
		// opt.offsetWidth --> plusWidth
		// opt.placeholder
		// opt.render
		// opt.custom
		// opt.minwidth
		// opt.maxwidth
		// opt.key
		// opt.exclude    --> function(item) must return Boolean
		// opt.search
		// opt.selected   --> only for String Array "opt.items"
		// opt.classname

		var el = opt.element instanceof jQuery ? opt.element[0] : opt.element;

		if (opt.items == null)
			opt.items = EMPTYARRAY;

		self.tclass(cls + '-default', !opt.render);

		if (parentclass) {
			self.rclass(parentclass);
			parentclass = null;
		}

		if (opt.classname) {
			self.aclass(opt.classname);
			parentclass = opt.classname;
		}

		if (!opt.minwidth)
			opt.minwidth = 200;

		if (is) {
			clearTimeout(timeout);
			if (self.target === el) {
				self.hide(1);
				return;
			}
		}

		self.initializing = true;
		self.target = el;
		opt.ajax = null;
		self.ajaxold = null;

		var element = $(opt.element);
		var callback = opt.callback;
		var items = opt.items;
		var type = typeof(items);
		var item;

		if (type === 'string') {
			items = GET(items);
			type = typeof(items);
		}

		if (type === 'function' && callback) {
			type = '';
			opt.ajax = items;
			items = null;
		}

		if (!items && !opt.ajax) {
			self.hide(0);
			return;
		}

		setTimeout(self.bindevents, 500);
		self.tclass(cls + '-search-hidden', opt.search === false);

		self.opt = opt;
		opt.class && self.aclass(opt.class);

		input.val('');

		var builder = [];
		var selected = null;

		opt.ta = opt.key ? Tangular.compile((opt.raw ? templateraw : template).replace(/\{\{\sname/g, '{{ ' + opt.key)) : opt.raw ? self.templateraw : self.template;

		if (!opt.ajax) {
			var indexer = {};
			var key = (opt.search == true ? opt.key : (opt.search || opt.key)) || 'name';
			for (var i = 0; i < items.length; i++) {

				item = items[i];

				if (typeof(item) === 'string')
					item = { name: item, id: item, selected: item === opt.selected };

				if (opt.exclude && opt.exclude(item))
					continue;

				if (item.selected || opt.selected === item) {
					selected = i;
					skipreset = true;
					item.selected = true;
				} else
					item.selected = false;

				indexer.index = i;
				indexer.search = item[key] ? item[key].replace(regstrip, '') : '';
				builder.push(opt.ta(item, indexer));
			}

			if (opt.empty) {
				item = {};
				var tmp = opt.raw ? '<b>{0}</b>'.format(opt.empty) : opt.empty;
				item[opt.key || 'name'] = tmp;
				if (!opt.raw)
					item.template = '<b>{0}</b>'.format(opt.empty);
				indexer.index = -1;
				builder.unshift(opt.ta(item, indexer));
			}
		}

		self.target = element[0];

		var w = element.width();
		var offset = element.offset();
		var width = w + (opt.offsetWidth || 0);

		if (opt.minwidth && width < opt.minwidth)
			width = opt.minwidth;
		else if (opt.maxwidth && width > opt.maxwidth)
			width = opt.maxwidth;

		ready = false;

		opt.ajaxold = null;
		plus.aclass('hidden');
		self.find('input').prop('placeholder', opt.placeholder || config.placeholder);
		var scroller = self.find(cls2 + '-container').css('width', width + 30);
		container.html(builder);

		var options = { left: 0, top: 0, width: width };

		switch (opt.align) {
			case 'center':
				options.left = Math.ceil((offset.left - width / 2) + (width / 2));
				break;
			case 'right':
				options.left = (offset.left - width) + w;
				break;
			default:
				options.left = offset.left;
				break;
		}

		options.top = opt.position === 'bottom' ? ((offset.top - self.height()) + element.height()) : offset.top;
		options.scope = M.scope ? M.scope() : '';

		if (opt.offsetX)
			options.left += opt.offsetX;

		if (opt.offsetY)
			options.top += opt.offsetY;

		self.css(options);

		!isMOBILE && setTimeout(function() {
			ready = true;
			if (opt.search !== false)
				input.focus();
		}, 200);

		setTimeout(function() {
			self.initializing = false;
			is = true;
			if (selected == null)
				scroller[0].scrollTop = 0;
			else {
				var h = container.find('li:first-child').innerHeight() + 1;
				var y = (container.find('li.selected').index() * h) - (h * 2);
				scroller[0].scrollTop = y < 0 ? 0 : y;
			}
		}, 100);

		if (is) {
			self.search();
			return;
		}

		selectedindex = selected || 0;
		resultscount = items ? items.length : 0;
		skipclear = true;

		self.search();
		self.rclass('hidden');

		setTimeout(function() {
			if (self.opt && self.target && self.target.offsetParent)
				self.aclass(cls + '-visible');
			else
				self.hide(1);
		}, 100);

		skipreset = false;
	};

	self.hide = function(sleep) {
		if (!is || self.initializing)
			return;
		clearTimeout(timeout);
		timeout = setTimeout(function() {
			self.unbindevents();
			self.rclass(cls + '-visible').aclass('hidden');
			if (self.opt) {
				self.opt.close && self.opt.close();
				self.opt.class && self.rclass(self.opt.class);
				self.opt = null;
			}
			is = false;
		}, sleep ? sleep : 100);
	};
});

COMPONENT('largeform', 'zindex:12;padding:30;scrollbar:1;scrolltop:1;style:1', function(self, config, cls) {

	var cls2 = '.' + cls;
	var csspos = {};
	var nav = false;
	var init = false;

	if (!W.$$largeform) {

		W.$$largeform_level = W.$$largeform_level || 1;
		W.$$largeform = true;

		$(document).on('click', cls2 + '-button-close', function() {
			SET($(this).attrd('path'), '');
		});

		var resize = function() {
			setTimeout2(self.name, function() {
				for (var i = 0; i < M.components.length; i++) {
					var com = M.components[i];
					if (com.name === 'largeform' && !HIDDEN(com.dom) && com.$ready && !com.$removed)
						com.resize();
				}
			}, 200);
		};

		if (W.OP)
			W.OP.on('resize', resize);
		else
			$(W).on('resize', resize);

		$(document).on('click', cls2 + '-container', function(e) {

			if (e.target === this) {
				var com = $(this).component();
				if (com && com.config.closeoutside) {
					com.set('');
					return;
				}
			}

			var el = $(e.target);
			if (el.hclass(cls + '-container') && !el.hclass(cls + '-style-2')) {
				var form = el.find(cls2);
				var c = cls + '-animate-click';
				form.aclass(c);
				setTimeout(function() {
					form.rclass(c);
				}, 300);
			}
		});
	}

	self.readonly();
	self.submit = function() {
		if (config.submit)
			self.EXEC(config.submit, self.hide, self.element);
		else
			self.hide();
	};

	self.cancel = function() {
		config.cancel && self.EXEC(config.cancel, self.hide);
		self.hide();
	};

	self.hide = function() {
		if (config.independent)
			self.hideforce();
		self.esc(false);
		self.set('');
	};

	self.icon = function(value) {
		var el = this.rclass2('fa');
		value.icon && el.aclass(value.icon.indexOf(' ') === -1 ? ('fa fa-' + value.icon) : value.icon);
	};

	self.resize = function() {

		if (self.hclass('hidden'))
			return;

		var padding = isMOBILE ? 0 : config.padding;
		var ui = self.find(cls2);

		csspos.height = WH - (config.style == 1 ? (padding * 2) : padding);
		csspos.top = padding;
		ui.css(csspos);

		var el = self.find(cls2 + '-title');
		var th = el.height();
		csspos = { height: csspos.height - th, width: ui.width() };

		if (nav)
			csspos.height -= nav.height();

		self.find(cls2 + '-body').css(csspos);
		self.scrollbar && self.scrollbar.resize();
		self.element.SETTER('*', 'resize');
	};

	self.make = function() {

		$(document.body).append('<div id="{0}" class="hidden {4}-container invisible"><div class="{4}" style="max-width:{1}px"><div data-bind="@config__text span:value.title__change .{4}-icon:@icon" class="{4}-title"><button name="cancel" class="{4}-button-close{3}" data-path="{2}"><i class="fa fa-times"></i></button><i class="{4}-icon"></i><span></span></div><div class="{4}-body"></div></div>'.format(self.ID, config.width || 800, self.path, config.closebutton == false ? ' hidden' : '', cls));

		var scr = self.find('> script');
		self.template = scr.length ? scr.html().trim() : '';
		scr.length && scr.remove();

		var el = $('#' + self.ID);
		var body = el.find(cls2 + '-body')[0];

		while (self.dom.children.length) {
			var child = self.dom.children[0];
			if (child.tagName === 'NAV') {
				nav = $(child);
				body.parentNode.appendChild(child);
			} else
				body.appendChild(child);
		}

		self.rclass('hidden invisible');
		self.replace(el, true);

		if (config.scrollbar)
			self.scrollbar = SCROLLBAR(self.find(cls2 + '-body'), { visibleY: config.visibleY, orientation: 'y' });

		if (config.style === 2)
			self.aclass(cls + '-style-2');

		self.event('scroll', function() {
			EMIT('scroll', self.name);
			EMIT('reflow', self.name);
		});

		self.event('click', 'button[name]', function() {
			var t = this;
			switch (t.name) {
				case 'submit':
					self.submit(self.hide);
					break;
				case 'cancel':
					!t.disabled && self[t.name](self.hide);
					break;
			}
		});

		config.enter && self.event('keydown', 'input', function(e) {
			e.which === 13 && !self.find('button[name="submit"]')[0].disabled && setTimeout(self.submit, 800);
		});
	};

	self.configure = function(key, value, init, prev) {
		if (!init) {
			switch (key) {
				case 'width':
					value !== prev && self.find(cls2).css('max-width', value + 'px');
					break;
				case 'closebutton':
					self.find(cls2 + '-button-close').tclass('hidden', value !== true);
					break;
			}
		}
	};

	self.esc = function(bind) {
		if (bind) {
			if (!self.$esc) {
				self.$esc = true;
				$(W).on('keydown', self.esc_keydown);
			}
		} else {
			if (self.$esc) {
				self.$esc = false;
				$(W).off('keydown', self.esc_keydown);
			}
		}
	};

	self.esc_keydown = function(e) {
		if (e.which === 27 && !e.isPropagationStopped()) {
			var val = self.get();
			if (!val || config.if === val) {
				e.preventDefault();
				e.stopPropagation();
				self.hide();
			}
		}
	};

	self.hideforce = function() {
		if (!self.hclass('hidden')) {
			self.aclass('hidden');
			self.release(true);
			self.find(cls2).rclass(cls + '-animate');
			W.$$largeform_level--;
		}
	};

	var allowscrollbars = function() {
		$('html').tclass(cls + '-noscroll', !!$(cls2 + '-container').not('.hidden').length);
	};

	self.setter = function(value) {

		setTimeout2(self.name + '-noscroll', allowscrollbars, 50);

		var isHidden = value !== config.if;

		if (self.hclass('hidden') === isHidden) {
			if (!isHidden) {
				config.reload && self.EXEC(config.reload, self);
				config.default && DEFAULT(self.makepath(config.default), true);
				config.scrolltop && self.scrollbar && self.scrollbar.scrollTop(0);
			}
			return;
		}

		setTimeout2(cls, function() {
			EMIT('reflow', self.name);
		}, 10);

		if (isHidden) {
			if (!config.independent)
				self.hideforce();
			return;
		}

		if (self.template) {
			var is = self.template.COMPILABLE();
			self.find(cls2).append(self.template);
			self.template = null;
			is && COMPILE();
		}

		if (W.$$largeform_level < 1)
			W.$$largeform_level = 1;

		W.$$largeform_level++;

		self.css('z-index', W.$$largeform_level * config.zindex);
		self.rclass('hidden');

		self.release(false);
		config.scrolltop && self.scrollbar && self.scrollbar.scrollTop(0);

		config.reload && self.EXEC(config.reload, self);
		config.default && DEFAULT(self.makepath(config.default), true);

		if (!isMOBILE && config.autofocus) {
			setTimeout(function() {
				self.find(typeof(config.autofocus) === 'string' ? config.autofocus : 'input[type="text"],select,textarea').eq(0).focus();
			}, 1000);
		}

		self.resize();

		setTimeout(function() {
			self.rclass('invisible');
			self.find(cls2).aclass(cls + '-animate');
			if (!init && isMOBILE) {
				$('body').aclass('hidden');
				setTimeout(function() {
					$('body').rclass('hidden');
				}, 50);
			}
			init = true;
		}, 300);

		// Fixes a problem with freezing of scrolling in Chrome
		setTimeout2(self.ID, function() {
			self.css('z-index', (W.$$largeform_level * config.zindex) + 1);
		}, 500);

		config.closeesc && self.esc(true);
	};
});

COMPONENT('message', 'button:OK', function(self, config, cls) {

	var cls2 = '.' + cls;
	var is;
	var events = {};

	self.readonly();
	self.singleton();
	self.nocompile && self.nocompile();

	self.make = function() {

		var pls = (config.style === 2 ? (' ' + cls + '2') : '');
		self.aclass(cls + ' hidden' + pls);
		self.event('click', 'button', self.hide);
	};

	events.keyup = function(e) {
		if (e.which === 27)
			self.hide();
	};

	events.bind = function() {
		if (!events.is) {
			$(W).on('keyup', events.keyup);
			events.is = false;
		}
	};

	events.unbind = function() {
		if (events.is) {
			events.is = false;
			$(W).off('keyup', events.keyup);
		}
	};

	self.warning = function(message, icon, fn) {
		if (typeof(icon) === 'function') {
			fn = icon;
			icon = undefined;
		}
		self.callback = fn;
		self.content(cls + '-warning', message, icon || 'warning');
	};

	self.info = function(message, icon, fn) {
		if (typeof(icon) === 'function') {
			fn = icon;
			icon = undefined;
		}
		self.callback = fn;
		self.content(cls + '-info', message, icon || 'info-circle');
	};

	self.success = function(message, icon, fn) {

		if (typeof(icon) === 'function') {
			fn = icon;
			icon = undefined;
		}

		self.callback = fn;
		self.content(cls + '-success', message, icon || 'check-circle');
	};

	self.response = function(message, callback, response) {

		var fn;

		if (typeof(message) === 'function') {
			response = callback;
			fn = message;
			message = null;
		} else if (typeof(callback) === 'function')
			fn = callback;
		else {
			response = callback;
			fn = null;
		}

		if (response instanceof Array) {
			var builder = [];
			for (var i = 0; i < response.length; i++) {
				var err = response[i].error;
				err && builder.push(err);
			}
			self.warning(builder.join('<br />'));
			SETTER('!loading/hide');
		} else if (typeof(response) === 'string') {
			self.warning(response);
			SETTER('!loading/hide');
		} else {

			if (message) {
				if (message.length < 40 && message.charAt(0) === '?')
					SET(message, response);
				else
					self.success(message);
			}

			if (typeof(fn) === 'string')
				SET(fn, response);
			else if (fn)
				fn(response);
		}
	};

	self.hide = function() {
		events.unbind();
		self.callback && self.callback();
		self.aclass('hidden');
	};

	self.content = function(classname, text, icon) {

		if (icon.indexOf(' ') === -1)
			icon = 'fa fa-' + icon;

		!is && self.html('<div><div class="{0}-icon"><i class="{1}"></i></div><div class="{0}-body"><div class="{0}-text"></div><hr /><button>{2}</button></div></div>'.format(cls, icon, config.button));

		self.rclass2(cls + '-').aclass(classname);
		self.find(cls2 + '-body').rclass().aclass(cls + '-body');

		if (is)
			self.find(cls2 + '-icon').find('.fa').rclass2('fa').aclass(icon);

		self.find(cls2 + '-text').html(text);
		self.rclass('hidden');
		is = true;
		events.bind();
		setTimeout(function() {
			self.aclass(cls + '-visible');
			setTimeout(function() {
				self.find(cls2 + '-icon').aclass(cls + '-icon-animate');
			}, 300);
		}, 100);
	};
});

COMPONENT('approve', 'cancel:Cancel', function(self, config, cls) {

	var cls2 = '.' + cls;
	var events = {};
	var buttons;
	var oldcancel;

	self.readonly();
	self.singleton();
	self.nocompile && self.nocompile();

	self.make = function() {

		self.aclass(cls + ' hidden');
		self.html('<div><div class="{0}-body"><span class="{0}-close"><i class="fa fa-times"></i></span><div class="{0}-content"></div><div class="{0}-buttons"><button data-index="0"></button><button data-index="1"></button></div></div></div>'.format(cls));

		buttons = self.find(cls2 + '-buttons').find('button');

		self.event('click', 'button', function() {
			self.hide(+$(this).attrd('index'));
		});

		self.event('click', cls2 + '-close', function() {
			self.callback = null;
			self.hide(-1);
		});

		self.event('click', function(e) {
			var t = e.target.tagName;
			if (t !== 'DIV')
				return;
			var el = self.find(cls2 + '-body');
			el.aclass(cls + '-click');
			setTimeout(function() {
				el.rclass(cls + '-click');
			}, 300);
		});
	};

	events.keydown = function(e) {
		var index = e.which === 13 ? 0 : e.which === 27 ? 1 : null;
		if (index != null) {
			self.find('button[data-index="{0}"]'.format(index)).trigger('click');
			e.preventDefault();
			e.stopPropagation();
			events.unbind();
		}
	};

	events.bind = function() {
		$(W).on('keydown', events.keydown);
	};

	events.unbind = function() {
		$(W).off('keydown', events.keydown);
	};

	self.show = function(message, a, b, fn) {

		if (typeof(b) === 'function') {
			fn = b;
			b = config.cancel;
		}

		if (M.scope)
			self.currscope = M.scope();

		self.callback = fn;

		var icon = a.match(/"[a-z0-9-\s]+"/);
		if (icon) {

			var tmp = icon + '';
			if (tmp.indexOf(' ') == -1)
				tmp = 'fa fa-' + tmp;

			a = a.replace(icon, '').trim();
			icon = '<i class="{0}"></i>'.format(tmp.replace(/"/g, ''));
		} else
			icon = '';

		var color = a.match(/#[0-9a-f]+/i);
		if (color)
			a = a.replace(color, '').trim();

		buttons.eq(0).css('background-color', color || '').html(icon + a);

		if (oldcancel !== b) {
			oldcancel = b;
			buttons.eq(1).html(b);
		}

		self.find(cls2 + '-content').html(message.replace(/\n/g, '<br />'));
		$('html').aclass(cls + '-noscroll');
		self.rclass('hidden');
		events.bind();
		self.aclass(cls + '-visible', 5);
	};

	self.hide = function(index) {

		if (!index) {
			self.currscope && M.scope(self.currscope);
			self.callback && self.callback(index);
		}

		self.rclass(cls + '-visible');
		events.unbind();
		setTimeout2(self.id, function() {
			$('html').rclass(cls + '-noscroll');
			self.aclass('hidden');
		}, 1000);
	};
});


COMPONENT('radiobuttonexpert', function(self, config, cls) {

	var cls2 = '.' + cls;
	var template;
	var recompile = false;
	var selected;
	var reg = /\$(index|path)/g;

	self.nocompile();

	self.configure = function(key, value, init) {
		if (init)
			return;
		switch (key) {
			case 'disabled':
				self.tclass('ui-disabled', value);
				break;
			case 'required':
				self.find(cls2 + '-label').tclass(cls + '-label-required', value);
				break;
			case 'type':
				self.type = config.type;
				break;
			case 'label':
				self.find(cls2 + '-label').html(value);
				break;
			case 'datasource':
				if (value.indexOf(',') === -1)
					self.datasource(value, self.bind);
				else
					self.bind('', self.parsesource(value));
				break;
		}
	};

	self.make = function() {

		var element = self.find('script');
		if (!element.length)
			return;

		var html = element.html();
		element.remove();
		html = html.replace('>', ' data-value="{{ {0} }}" data-disabled="{{ {1} }}">'.format(config.value || 'id', config.disabledkey || 'disabled'));
		template = Tangular.compile(html);
		recompile = html.COMPILABLE();

		config.label && self.html('<div class="' + cls + '-label{1}">{0}</div>'.format(config.label, config.required ? (' ' + cls + '-label-required') : ''));
		config.datasource && self.reconfigure('datasource:' + config.datasource);
		config.type && (self.type = config.type);
		config.disabled && self.aclass('ui-disabled');

		self.event('click', '[data-value]', function() {
			var el = $(this);
			if (config.disabled || +el.attrd('disabled'))
				return;
			var value = self.parser(el.attrd('value'));
			self.set(value);
			self.change(true);
		});
	};

	self.validate = function(value) {
		return (config.disabled || !config.required) ? true : !!value;
	};

	self.setter = function(value) {

		selected && selected.rclass('selected');

		if (value == null)
			return;

		var el = self.find('[data-value="' + value + '"]');
		if (el) {
			el.aclass('selected');
			selected = el;
		}
	};

	self.bind = function(path, arr) {

		if (!arr)
			arr = EMPTYARRAY;

		var builder = [];
		var disabledkey = config.disabledkey || 'disabled';

		for (var i = 0; i < arr.length; i++) {
			var item = arr[i];
			item[disabledkey] = +item[disabledkey] || 0;
			builder.push(template(item).replace(reg, function(text) {
				return text.substring(0, 2) === '$i' ? i.toString() : self.path + '[' + i + ']';
			}));
		}

		var render = builder.join('');
		self.find(cls2 + '-container').remove();
		self.append('<div class="{0}-container{1}">{2}</div>'.format(cls, config.class ? ' ' + config.class : '', render));
		self.refresh();
		recompile && self.compile();
	};

});


COMPONENT('textboxlist', 'maxlength:100;required:false;error:You reach the maximum limit;movable:false', function (self, config, cls) {

	var container, content;
	var empty = {};
	var skip = false;
	var cempty = cls + '-empty';
	var crequired = 'required';
	var helper = null;
	var cls2 = '.' + cls;

	self.setter = null;
	self.getter = null;
	self.nocompile && self.nocompile();

	self.template = Tangular.compile(('<div class="{0}-item"><div>'  + (config.movable ? '<i class="fa fa-angle-up {0}-up"></i><i class="fa fa-angle-down {0}-down"></i>' : '') + '<i class="fa fa-times {0}-remove"></i></div><div><input type="text" name="input' + Date.now() + '" autocomplete="new-password" maxlength="{{ max }}" placeholder="{{ placeholder }}"{{ if disabled}} disabled="disabled"{{ fi }} value="{{ value }}" /></div></div>').format(cls));

	self.configure = function (key, value, init, prev) {

		if (init)
			return;

		var redraw = false;
		switch (key) {
			case 'disabled':
				self.tclass(crequired, value);
				self.find('input').prop('disabled', true);
				empty.disabled = value;
				self.reset();
				break;
			case 'maxlength':
				empty.max = value;
				self.find('input').prop(key, value);
				break;
			case 'placeholder':
				empty.placeholder = value;
				self.find('input').prop(key, value);
				break;
			case 'label':
				redraw = true;
				break;
			case 'icon':
				if (value && prev)
					self.find('i').rclass().aclass(value);
				else
					redraw = true;
				break;
		}

		if (redraw) {
			skip = false;
			self.redraw();
			self.refresh();
		}
	};

	self.redraw = function () {

		var icon = '';
		var html = config.label || content;

		if (config.icon)
			icon = '<i class="{0}"></i>'.format(config.icon.indexOf(' ') === -1 ? ('fa fa-' + config.icon) : config.icon);

		empty.value = '';
		self.tclass(cls + '-movable', !!config.movable);
		self.html((html ? ('<div class="' + cls + '-label{2}">{1}{0}:</div>').format(html, icon, config.required ? (' ' + cls + '-required') : '') : '') + ('<div class="' + cls + '-items"></div>' + self.template(empty).replace('-item"', '-item ' + cls + '-base"')));
		container = self.find(cls2 + '-items');
	};

	self.make = function () {

		empty.max = config.max;
		empty.placeholder = config.placeholder;
		empty.value = '';
		empty.disabled = config.disabled;

		if (config.disabled)
			self.aclass('ui-disabled');

		content = self.html();
		self.aclass(cls);
		self.redraw();

		self.move = function(offset, el) {

			var arr = self.get();
			var index = el.index();
			var tmp;

			if (offset === 1) {
				if (arr[index] == null || arr[index + 1] == null)
					return;
			} else {
				if (arr[index] == null || arr[index - 1] == null)
					return;
			}

			tmp = arr[index];
			arr[index] = arr[index + offset];
			arr[index + offset] = tmp;
			var items = self.find(cls2 + '-item');
			items.eq(index).find('input').val(arr[index]);
			items.eq(index + offset).find('input').val(arr[index + offset]);
		};

		self.event('click', cls2 + '-up', function () {
			self.move(-1, $(this).closest(cls2 + '-item'));
		});

		self.event('click', cls2 + '-down', function () {
			self.move(1, $(this).closest(cls2 + '-item'));
		});

		self.event('click', cls2 + '-remove', function () {

			if (config.disabled)
				return;

			var el = $(this);
			var parent = el.closest(cls2 + '-item');
			var value = parent.find('input').val();
			var arr = self.get();

			helper != null && helper.remove();
			helper = null;

			parent.remove();

			var index = arr.indexOf(value);
			if (index === -1)
				return;

			arr.splice(index, 1);

			self.tclass(cempty, !arr.length);
			self.tclass(crequired, config.required && !arr.length);

			skip = true;
			SET(self.path, arr, 2);
			self.change(true);
		});

		self.event('change keypress blur', 'input', function (e) {

			if ((e.type === 'keypress' && e.which !== 13) || config.disabled)
				return;

			var el = $(this);

			var value = this.value.trim();
			if (!value)
				return;

			var arr = [];
			var base = el.closest(cls2 + '-base');
			var len = base.length > 0;

			if (len && e.type === 'change')
				return;

			var raw = self.get();

			if (config.limit && len && raw.length >= config.limit) {
				if (!helper) {
					base.after(('<div class="' + cls + '-helper"><i class="fa fa-warning" aria-hidden="true"></i> {0}</div>').format(config.error));
					helper = container.closest(cls2).find(cls2 + '-helper');
				}
				return;
			}

			if (len) {

				if (!raw || raw.indexOf(value) === -1)
					self.push(value);

				this.value = '';
				self.change(true);
				return;
			}

			skip = true;

			container.find('input').each(function () {
				var temp = this.value.trim();
				switch (config.type) {
					case 'number':
						temp = temp.parseInt();
						break;
					case 'date':
						temp = temp.parseDate();
						break;
				}

				if (arr.indexOf(temp) === -1)
					arr.push(temp);
				else
					skip = false;
			});

			self.set(arr, 2);
			self.change(true);
		});
	};

	self.setter = function (value) {

		if (skip) {
			skip = false;
			return;
		}

		if (!value || !value.length) {
			self.aclass(cempty);
			config.required && self.aclass(crequired);
			container.empty();
			return;
		}

		self.rclass(cempty);
		self.rclass(crequired);
		var builder = [];

		for (var i = 0; i < value.length; i++) {
			empty.value = value[i];
			builder.push(self.template(empty));
		}

		container.empty().append(builder.join(''));
	};

	self.validate = function(value, init) {

		if (init)
			return true;

		var valid = !config.required;
		var items = container.children();

		if (!value || !value.length)
			return valid;

		for (var i = 0; i < value.length; i++) {
			var item = value[i];
			!item && (item = '');
			switch (config.type) {
				case 'email':
					valid = item.isEmail();
					break;
				case 'url':
					valid = item.isURL();
					break;
				case 'currency':
				case 'number':
					valid = item > 0;
					break;
				case 'date':
					valid = item instanceof Date && !isNaN(item.getTime());
					break;
				default:
					valid = item.length > 0;
					break;
			}
			items.eq(i).tclass(cls + '-item-invalid', !valid);
		}

		return valid;
	};

});


COMPONENT('notifybar', 'timeout:5000', function(self, config, cls) {

	self.singleton();
	self.readonly();
	self.nocompile && self.nocompile();
	self.history = [];

	var cls2 = '.' + cls;
	var body, buttons, prevtype, timeout, currentindex = 0;

	self.make = function() {
		self.aclass(cls + ' hidden');
		self.append('<div class="{0}-controls"><button name="prev" disabled><i class="fa fa-angle-left"></i></button><button name="next" disabled><i class="fa fa-angle-right"></i></button></div><div class="{0}-body">OK</div>'.format(cls));
		self.event('click', cls2 + '-body', self.hide);
		self.event('click', 'button', function() {
			self[this.name]();
		});
		body = self.find(cls2 + '-body');
		buttons = self.find('button');
	};

	self.hide = function() {
		self.aclass('hidden');
	};

	self.next = function() {
		currentindex++;
		self.draw(config.timeout * 2);
	};

	self.prev = function() {
		currentindex--;
		self.draw(config.timeout * 2);
	};

	self.show = function() {
		currentindex = self.history.length - 1;
		if (currentindex >= 0) {
			self.draw(config.timeout);
			self.check();
		}
	};

	self.draw = function(delay) {

		prevtype && self.rclass(cls + '-' + prevtype);
		var msg = self.history[currentindex];

		if (msg.body.indexOf('fa-') === -1)
			msg.body = '<i class="fa fa-' + (msg.type === 1 ? 'check-circle' : msg.type === 2 ? 'warning' : 'info-circle') + '"></i>' + msg.body;

		body.html(msg.body);
		buttons[0].disabled = !self.history.length || currentindex === 0;
		buttons[1].disabled = !self.history.length || currentindex >= (self.history.length - 1);
		prevtype = msg.type;
		self.aclass(cls + '-' + prevtype);
		self.rclass('hidden');

		timeout && clearTimeout(timeout);
		timeout = setTimeout(self.hide, delay);
	};

	self.success = function(body) {
		currentindex = self.history.push({ type: 1, body: body }) - 1;
		self.draw(config.timeout);
		self.check();
	};

	self.warning = function(body) {
		currentindex = self.history.push({ type: 2, body: body }) - 1;
		self.draw(config.timeout);
		self.check();
	};

	self.response = function(message, callback, response) {

		var fn;

		if (typeof(message) === 'function') {
			response = callback;
			fn = message;
			message = null;
		} else if (typeof(callback) === 'function')
			fn = callback;
		else {
			response = callback;
			fn = null;
		}

		if (response instanceof Array) {
			var builder = [];
			for (var i = 0; i < response.length; i++) {
				var err = response[i].error;
				err && builder.push(err);
			}
			self.warning(builder.join('<br />'));
		} else if (typeof(response) === 'string')
			self.warning(response);
		else {

			if (message) {
				if (message.length < 40 && message.charAt(0) === '?')
					SET(message, response);
				else
					self.success(message);
			}

			if (typeof(fn) === 'string')
				SET(fn, response);
			else if (fn)
				fn(response);
		}
	};

	self.info = function(body) {
		currentindex = self.history.push({ type: 3, body: body }) - 1;
		self.draw(config.timeout);
		self.check();
	};

	self.check = function() {
		if (self.history.length > 20)
			self.history.unshift();
	};

});

COMPONENT('codemirror', 'linenumbers:true;required:false;trim:false;tabs:true', function(self, config, cls) {

	var editor, container;
	var cls2 = '.' + cls;

	self.getter = null;
	self.bindvisible();
	self.nocompile();

	self.reload = function() {
		editor.refresh();
		editor.display.scrollbars.update(true);
	};

	self.validate = function(value) {
		return (config.disabled || !config.required ? true : value && value.length > 0) === true;
	};

	self.insert = function(value) {
		editor.replaceSelection(value);
		self.change(true);
	};

	self.configure = function(key, value, init) {
		if (init)
			return;

		switch (key) {
			case 'disabled':
				self.tclass('ui-disabled', value);
				editor.readOnly = value;
				editor.refresh();
				break;
			case 'required':
				self.find(cls2 + '-label').tclass(cls + '-label-required', value);
				self.state(1, 1);
				break;
			case 'icon':
				self.find('i').rclass().aclass(value.indexOf(' ') === -1 ? ('fa fa-' + value) : value);
				break;
		}

	};

	self.make = function() {

		var findmatch = function() {

			if (config.mode === 'todo') {
				self.todo_done();
				return;
			}

			var sel = editor.getSelections()[0];
			var cur = editor.getCursor();
			var count = editor.lineCount();
			var before = editor.getLine(cur.line).substring(cur.ch, cur.ch + sel.length) === sel;
			var beg = cur.ch + (before ? sel.length : 0);
			for (var i = cur.line; i < count; i++) {
				var ch = editor.getLine(i).indexOf(sel, beg);
				if (ch !== -1) {
					editor.doc.addSelection({ line: i, ch: ch }, { line: i, ch: ch + sel.length });
					break;
				}
				beg = 0;
			}
		};

		var content = config.label || self.html();
		self.html(((content ? '<div class="{0}-label' + (config.required ? ' {0}-label-required' : '') + '">' + (config.icon ? '<i class="fa fa-' + config.icon + '"></i> ' : '') + content + ':</div>' : '') + '<div class="{0}"></div>').format(cls));
		container = self.find(cls2);

		var options = {};
		options.lineNumbers = config.linenumbers;
		options.mode = config.type || 'htmlmixed';
		options.indentUnit = 4;
		options.scrollbarStyle = 'simple';
		options.scrollPastEnd = true;
		options.extraKeys = { 'Cmd-D': findmatch, 'Ctrl-D': findmatch };

		if (config.tabs)
			options.indentWithTabs = true;

		if (config.type === 'markdown') {
			options.styleActiveLine = true;
			options.lineWrapping = true;
			options.matchBrackets = true;
		}

		options.showTrailingSpace = false;

		editor = CodeMirror(container[0], options);
		self.editor = editor;

		editor.on('keydown', function(editor, e) {

			if (e.shiftKey && e.ctrlKey && (e.keyCode === 40 || e.keyCode === 38)) {
				var tmp = editor.getCursor();
				editor.doc.addSelection({ line: tmp.line + (e.keyCode === 40 ? 1 : -1), ch: tmp.ch });
				e.stopPropagation();
				e.preventDefault();
			}

			if (e.keyCode === 13) {
				var tmp = editor.getCursor();
				var line = editor.lineInfo(tmp.line);
				if ((/^\t+$/).test(line.text))
					editor.replaceRange('', { line: tmp.line, ch: 0 }, { line: tmp.line, ch: line.text.length });
				return;
			}

			if (e.keyCode === 27)
				e.stopPropagation();

		});

		if (config.height !== 'auto') {
			var is = typeof(config.height) === 'number';
			editor.setSize('100%', is ? (config.height + 'px') : (config.height || '200px'));
			!is && self.css('height', config.height);
		}

		if (config.disabled) {
			self.aclass('ui-disabled');
			editor.readOnly = true;
			editor.refresh();
		}

		var can = {};
		can['+input'] = can['+delete'] = can.undo = can.redo = can.paste = can.cut = can.clear = true;

		editor.on('change', function(a, b) {

			if (config.disabled || !can[b.origin])
				return;

			setTimeout2(self.id, function() {
				var val = editor.getValue();

				if (config.trim) {
					var lines = val.split('\n');
					for (var i = 0, length = lines.length; i < length; i++)
						lines[i] = lines[i].replace(/\s+$/, '');
					val = lines.join('\n').trim();
				}

				self.getter2 && self.getter2(val);
				self.change(true);
				self.rewrite(val, 2);
				config.required && self.validate2();
			}, 200);

		});
	};

	self.setter = function(value, path, type) {

		editor.setValue(value || '');
		editor.refresh();

		setTimeout(function() {
			editor.refresh();
			editor.scrollTo(0, 0);
			type && editor.setCursor(0);
		}, 200);

		setTimeout(function() {
			editor.refresh();
		}, 1000);

		setTimeout(function() {
			editor.refresh();
		}, 2000);
	};

	self.state = function(type) {
		if (!type)
			return;
		var invalid = config.required ? self.isInvalid() : false;
		if (invalid === self.$oldstate)
			return;
		self.$oldstate = invalid;
		container.tclass(cls + '-invalid', invalid);
	};
}, ['//cdnjs.cloudflare.com/ajax/libs/codemirror/5.45.0/codemirror.min.css', '//cdnjs.cloudflare.com/ajax/libs/codemirror/5.45.0/codemirror.min.js', '//cdnjs.cloudflare.com/ajax/libs/codemirror/5.45.0/mode/javascript/javascript.min.js', '//cdnjs.cloudflare.com/ajax/libs/codemirror/5.45.0/mode/htmlmixed/htmlmixed.min.js', '//cdnjs.cloudflare.com/ajax/libs/codemirror/5.45.0/mode/xml/xml.min.js', '//cdnjs.cloudflare.com/ajax/libs/codemirror/5.45.0/mode/css/css.min.js', '//cdnjs.cloudflare.com/ajax/libs/codemirror/5.45.0/mode/markdown/markdown.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.45.0/addon/mode/overlay.min.js', function(next) {

	CodeMirror.defineMode('totaljs', function(config) {
		var htmlbase = CodeMirror.getMode(config, 'text/html');
		var totaljsinner = CodeMirror.getMode(config, 'totaljs:inner');
		return CodeMirror.overlayMode(htmlbase, totaljsinner);
	});

	CodeMirror.defineMode('totaljs:inner', function() {
		return {
			token: function(stream) {

				if (stream.match(/@{.*?}/, true))
					return 'variable-T';

				if (stream.match(/@\(.*?\)/, true))
					return 'variable-L';

				if (stream.match(/\{\{.*?\}\}/, true))
					return 'variable-A';

				if (stream.match(/data-scope=/, true))
					return 'variable-S';

				if (stream.match(/data-released=/, true))
					return 'variable-R';

				if (stream.match(/data-bind=/, true))
					return 'variable-B';

				if (stream.match(/data-jc=|data-{2,4}=|data-bind=/, true))
					return 'variable-J';

				if (stream.match(/data-import|(data-jc-(url|scope|import|cache|path|config|id|type|init|class))=/, true))
					return 'variable-E';

				stream.next();
				return null;
			}
		};
	});

	CodeMirror.defineMode('totaljsresources', function() {
		var REG_KEY = /^[a-z0-9_/>\-.#]+/i;
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

	CodeMirror.defineMode('totaljsbundle', function() {
		var REG_ADD = /^\+/;
		var REG_REM = /^-/;
		var REG_FILENAME = /[a-z-0-9_-]+\.bundle/;
		return {
			token: function(stream) {

				var m;

				if (stream.sol()) {
					var line = stream.string;
					if (line.substring(0, 2) === '//') {
						stream.skipToEnd();
						return 'comment';
					}
				}

				m = stream.match(REG_FILENAME, true);
				if (m) {
					stream.skipToEnd();
					return 'variable-B';
				}

				m = stream.match(REG_ADD, true);
				if (m) {
					stream.skipToEnd();
					return 'variable-J';
				}

				m = stream.match(REG_REM, true);
				if (m) {
					stream.skipToEnd();
					return 'variable-S';
				}

				stream.next();
				return '';
			}
		};
	});

	(function(mod) {
		mod(CodeMirror);
	})(function(CodeMirror) {

		function Bar(cls, orientation, scroll) {
			var self = this;
			self.orientation = orientation;
			self.scroll = scroll;
			self.screen = self.total = self.size = 1;
			self.pos = 0;

			self.node = document.createElement('div');
			self.node.className = cls + '-' + orientation;
			self.inner = self.node.appendChild(document.createElement('div'));

			CodeMirror.on(self.inner, 'mousedown', function(e) {

				if (e.which != 1)
					return;

				CodeMirror.e_preventDefault(e);
				var axis = self.orientation == 'horizontal' ? 'pageX' : 'pageY';
				var start = e[axis], startpos = self.pos;

				function done() {
					CodeMirror.off(document, 'mousemove', move);
					CodeMirror.off(document, 'mouseup', done);
				}

				function move(e) {
					if (e.which != 1)
						return done();
					self.moveTo(startpos + (e[axis] - start) * (self.total / self.size));
				}

				CodeMirror.on(document, 'mousemove', move);
				CodeMirror.on(document, 'mouseup', done);
			});

			CodeMirror.on(self.node, 'click', function(e) {
				CodeMirror.e_preventDefault(e);
				var innerBox = self.inner.getBoundingClientRect(), where;
				if (self.orientation == 'horizontal')
					where = e.clientX < innerBox.left ? -1 : e.clientX > innerBox.right ? 1 : 0;
				else
					where = e.clientY < innerBox.top ? -1 : e.clientY > innerBox.bottom ? 1 : 0;
				self.moveTo(self.pos + where * self.screen);
			});

			function onWheel(e) {
				var moved = CodeMirror.wheelEventPixels(e)[self.orientation == 'horizontal' ? 'x' : 'y'];
				var oldPos = self.pos;
				self.moveTo(self.pos + moved);
				if (self.pos != oldPos) CodeMirror.e_preventDefault(e);
			}
			CodeMirror.on(self.node, 'mousewheel', onWheel);
			CodeMirror.on(self.node, 'DOMMouseScroll', onWheel);
		}

		Bar.prototype.setPos = function(pos, force) {
			var t = this;
			if (pos < 0)
				pos = 0;
			if (pos > t.total - t.screen)
				pos = t.total - t.screen;
			if (!force && pos == t.pos)
				return false;
			t.pos = pos;
			t.inner.style[t.orientation == 'horizontal' ? 'left' : 'top'] = (pos * (t.size / t.total)) + 'px';
			return true;
		};

		Bar.prototype.moveTo = function(pos) {
			var t = this;
			t.setPos(pos) && t.scroll(pos, t.orientation);
		};

		var minButtonSize = 10;

		Bar.prototype.update = function(scrollSize, clientSize, barSize) {
			var t = this;
			var sizeChanged = t.screen != clientSize || t.total != scrollSize || t.size != barSize;

			if (sizeChanged) {
				t.screen = clientSize;
				t.total = scrollSize;
				t.size = barSize;
			}

			var buttonSize = t.screen * (t.size / t.total);
			if (buttonSize < minButtonSize) {
				t.size -= minButtonSize - buttonSize;
				buttonSize = minButtonSize;
			}

			t.inner.style[t.orientation == 'horizontal' ? 'width' : 'height'] = buttonSize + 'px';
			t.setPos(t.pos, sizeChanged);
		};

		function SimpleScrollbars(cls, place, scroll) {
			var t = this;
			t.addClass = cls;
			t.horiz = new Bar(cls, 'horizontal', scroll);
			place(t.horiz.node);
			t.vert = new Bar(cls, 'vertical', scroll);
			place(t.vert.node);
			t.width = null;
		}

		SimpleScrollbars.prototype.update = function(measure) {
			var t = this;
			if (t.width == null) {
				var style = window.getComputedStyle ? window.getComputedStyle(t.horiz.node) : t.horiz.node.currentStyle;
				if (style)
					t.width = parseInt(style.height);
			}

			var width = t.width || 0;
			var needsH = measure.scrollWidth > measure.clientWidth + 1;
			var needsV = measure.scrollHeight > measure.clientHeight + 1;

			t.vert.node.style.display = needsV ? 'block' : 'none';
			t.horiz.node.style.display = needsH ? 'block' : 'none';

			if (needsV) {
				t.vert.update(measure.scrollHeight, measure.clientHeight, measure.viewHeight - (needsH ? width : 0));
				t.vert.node.style.bottom = needsH ? width + 'px' : '0';
			}

			if (needsH) {
				t.horiz.update(measure.scrollWidth, measure.clientWidth, measure.viewWidth - (needsV ? width : 0) - measure.barLeft);
				t.horiz.node.style.right = needsV ? width + 'px' : '0';
				t.horiz.node.style.left = measure.barLeft + 'px';
			}

			return {right: needsV ? width : 0, bottom: needsH ? width : 0};
		};

		SimpleScrollbars.prototype.setScrollTop = function(pos) {
			this.vert.setPos(pos);
		};

		SimpleScrollbars.prototype.setScrollLeft = function(pos) {
			this.horiz.setPos(pos);
		};

		SimpleScrollbars.prototype.clear = function() {
			var parent = this.horiz.node.parentNode;
			parent.removeChild(this.horiz.node);
			parent.removeChild(this.vert.node);
		};

		CodeMirror.scrollbarModel.simple = function(place, scroll) {
			return new SimpleScrollbars('CodeMirror-simplescroll', place, scroll);
		};
		CodeMirror.scrollbarModel.overlay = function(place, scroll) {
			return new SimpleScrollbars('CodeMirror-overlayscroll', place, scroll);
		};
	});

	(function(mod) {
		mod(CodeMirror);
	})(function(CodeMirror) {
		CodeMirror.defineOption('showTrailingSpace', false, function(cm, val, prev) {
			if (prev == CodeMirror.Init)
				prev = false;
			if (prev && !val)
				cm.removeOverlay('trailingspace');
			else if (!prev && val) {
				cm.addOverlay({ token: function(stream) {
					for (var l = stream.string.length, i = l; i; --i) {
						if (stream.string.charCodeAt(i - 1) !== 32)
							break;
					}
					if (i > stream.pos) {
						stream.pos = i;
						return null;
					}
					stream.pos = l;
					return 'trailingspace';
				}, name: 'trailingspace' });
			}
		});
	});

	(function(mod) {
		mod(CodeMirror);
	})(function(CodeMirror) {

		CodeMirror.defineOption('scrollPastEnd', false, function(cm, val, old) {
			if (old && old != CodeMirror.Init) {
				cm.off('change', onChange);
				cm.off('refresh', updateBottomMargin);
				cm.display.lineSpace.parentNode.style.paddingBottom = '';
				cm.state.scrollPastEndPadding = null;
			}
			if (val) {
				cm.on('change', onChange);
				cm.on('refresh', updateBottomMargin);
				updateBottomMargin(cm);
			}
		});

		function onChange(cm, change) {
			if (CodeMirror.changeEnd(change).line == cm.lastLine())
				updateBottomMargin(cm);
		}

		function updateBottomMargin(cm) {
			var padding = '';

			if (cm.lineCount() > 1) {
				var totalH = cm.display.scroller.clientHeight - 30;
				var lastLineH = cm.getLineHandle(cm.lastLine()).height;
				padding = (totalH - lastLineH) + 'px';
			}

			if (cm.state.scrollPastEndPadding != padding) {
				cm.state.scrollPastEndPadding = padding;
				cm.display.lineSpace.parentNode.style.paddingBottom = padding;
				cm.off('refresh', updateBottomMargin);
				cm.setSize();
				cm.on('refresh', updateBottomMargin);
			}

		}
	});

	next();
}]);

COMPONENT('tree', 'autoreset:false;checkednested:true;reselect:false;iconoptions:fa fa-ellipsis-h', function(self, config, cls) {

	var cls2 = '.' + cls;
	var cache = null;
	var counter = 0;
	var expanded = {};
	var selindex = -1;
	var ddfile = null;
	var ddtarget = null;
	var dragged = null;

	self.readonly();
	self.nocompile && self.nocompile();

	self.make = function() {

		self.aclass(cls);
		self.template = Tangular.compile(('<div' + (config.dragdrop ? ' draggable="true"' : '') + ' class="{0}-item{{ if children }} {0}-expand{{ fi }}" title="{{ name }}" data-index="{{ $pointer }}">' + (config.checked ? '<div class="{0}-checkbox"><i class="fa fa-check"></i></div><div class="{0}-label">' : '') + '<i class="far {{ if children }}{0}-folder{{ else }}{{ icon | def(\'fa-file-o\') }}{{ fi }}"></i>' + (config.options ? ('<span class="{0}-options"><i class="' + config.iconoptions + '"></i></span>') : '') + '<div class="{0}-item-name{{ if classname }} {{ classname }}{{ fi }}">{{ if html }}{{ html | raw }}{{ else }}{{ name }}{{ fi }}</div></div>' + (config.checked ? '</div>' : '')).format(cls));

		self.event('click', cls2 + '-checkbox', function(e) {
			e.stopPropagation();
			var el = $(this);
			var c = cls + '-checkbox-checked';
			el.tclass(c);
			config.checkednested && el.closest(cls2 + '-node').find(cls2 + '-checkbox').tclass(c, el.hclass(c));
			SEEX(self.makepath(config.checked), self.checked(), self);
		});

		self.event('click', cls2 + '-item', function() {
			var el = $(this);
			var index = +el.attrd('index');
			self.select(index);
		});

		self.event('click', cls2 + '-options', function(e) {
			e.preventDefault();
			e.stopPropagation();
			var el = $(this);
			var index = +el.closest(cls2 + '-item').attrd('index');
			config.options && EXEC(self.makepath(config.options), cache[index], el);
		});

		self.event('focusout', 'input', function() {
			var input = $(this);
			var el = input.parent();
			el.html(el[0].$def);
			el[0].$def = null;
		});

		var dragdrop = (config.upload || config.dragdrop);

		dragdrop && self.event('dragenter dragover dragexit drop dragleave dragstart', function (e) {

			if (e.type === 'dragstart') {
				var el = $(e.target);
				if (!el.hclass(cls + '-item'))
					el = el.closest(cls2 + '-item');
				if (el && el.length) {
					e.originalEvent.dataTransfer.setData('text', '1');
					dragged = el;
					return;
				}
				dragged = null;
			}

			e.stopPropagation();
			e.preventDefault();

			switch (e.type) {
				case 'drop':
					break;
				case 'dragenter':
				case 'dragover':
					if (e.target !== ddtarget || (ddtarget && e.target !== ddtarget.parentNode)) {
						ddtarget = e.target;
						ddfile && ddfile.rclass(cls + '-ddhere');
						ddfile = $(ddtarget);
						if (!ddfile.hclass(cls + '-item'))
							ddfile = ddfile.closest(cls2 + '-item');
						ddfile.aclass(cls + '-ddhere');
					}
					return;

				default:
					setTimeout2(self.id, function() {
						ddfile && ddfile.rclass(cls + '-ddhere');
						ddfile = null;
						ddtarget = null;
					}, 100);
					return;
			}

			var index = -1;

			if (e.originalEvent.dataTransfer.files.length) {
				if (ddfile)
					index = +ddfile.attrd('index');
				config.upload && EXEC(self.makepath(config.upload), cache[index], e.originalEvent.dataTransfer.files);
			} else {
				var tmp = $(e.target);
				if (!tmp.hclass(cls + '-item'))
					tmp = tmp.closest(cls2 + '-item');
				tmp.length && config.dragdrop && EXEC(self.makepath(config.dragdrop), cache[+dragged.attrd('index')], cache[+tmp.attrd('index')], dragged, tmp);
				dragged = null;
			}

			ddfile && ddfile.rclass(cls + '-ddhere');
			ddfile = null;
		});

		self.event('keydown', 'input', function(e) {
			if (e.which === 13 || e.which === 27) {
				var input = $(this);
				var el = input.parent();
				if (e.which === 27) {
					// cancel
					el.html(el[0].$def);
					el[0].$def = null;
				} else {
					var val = input.val().replace(/[^a-z0-9.\-_]/gi, '');
					var index = +input.closest(cls2 + '-item').attrd('index');
					var item = cache[index];
					var newname = item.path.substring(0, item.path.length - item.name.length) + val;
					EXEC(self.makepath(config.rename), cache[index], newname, function(is) {
						el.html(is ? val : el[0].$def);
						if (is) {
							item.path = newname;
							item.name = val;
							self.select(index);
						}
					});
				}
			}
		});
	};

	self.select = function(index, noeval, reinit) {
		var el = self.find('[data-index="{0}"]'.format(index));
		var c = '-selected';
		if (el.hclass(cls + '-expand')) {

			var parent = el.parent();

			if (config.selectexpand) {
				self.find(cls2 + c).rclass(cls + c);
				el.aclass(cls + c);
			}

			if (!reinit)
				parent.tclass(cls + '-show');

			var is = parent.hclass(cls + '-show');
			var item = cache[index];

			if (config.pk)
				expanded[item[config.pk]] = 1;
			else
				expanded[index] = 1;

			!noeval && config.exec && SEEX(self.makepath(config.exec), item, true, is);
			selindex = index;
		} else {
			!el.hclass(cls + c) && self.find(cls2 + c).rclass(cls + c);
			el.aclass(cls + c);
			!noeval && config.exec && SEEX(self.makepath(config.exec), cache[index], false);
			selindex = index;
		}
	};

	self.checked = function() {
		var items = [];
		self.find(cls2 + '-checkbox-checked').each(function() {
			var item = cache[+$(this).parent().attrd('index')];
			item && items.push(item);
		});
		return items;
	};

	self.rename = function(index) {
		var div = self.find('[data-index="{0}"] .ui-tree-item-name'.format(index));
		if (div[0].$def)
			return;
		div[0].$def = div.html();
		div.html('<input type="text" value="{0}" />'.format(div[0].$def));
		div.find('input').focus();
	};

	self.select2 = function(index) {
		self.expand(index);
		self.select(index, true);
	};

	self.unselect = function() {
		var cls = config.selected;
		self.find('.' + cls).rclass(cls);
	};

	self.clear = function() {
		expanded = {};
		selindex = -1;
	};

	self.expand = function(index) {
		if (index == null) {
			self.find(cls2 + '-expand').each(function() {
				$(this).parent().aclass(cls + '-show');
			});
		} else {
			self.find('[data-index="{0}"]'.format(index)).each(function() {
				var el = $(this);
				if (el.hclass(cls + '-expand')) {
					// group
					el.parent().aclass(cls + '-show');
				} else {
					// item
					while (true) {
						el = el.closest(cls2 + '-children').prev();
						if (!el.hclass(cls + '-expand'))
							break;
						el.parent().aclass(cls + '-show');
					}
				}
			});
		}
	};

	self.collapse = function(index) {
		if (index == null) {
			self.find(cls2 + '-expand').each(function() {
				$(this).parent().rclass(cls + '-show');
			});
		} else {
			self.find('[data-index="{0}"]'.format(index)).each(function() {
				var el = $(this);
				if (el.hclass(cls + '-expand')) {
					el.parent().rclass(cls + '-show');
				} else {
					while (true) {
						el = el.closest(cls2 + '-children').prev();
						if (!el.hclass(cls + '-expand'))
							break;
						el.parent().rclass(cls + '-show');
						var parent = el.parent().aclass(cls + '-show');
						var tmp = +parent.find('> .item').attrd('index');
						var item = cache[tmp];
						var key = config.pk ? item[config.pk] : counter;
						expanded[key] = 1;
						item.isopen = true;
					}
				}
			});
		}
	};

	self.renderchildren = function(builder, item, level, selected) {
		builder.push('<div class="{0}-children {0}-children{1}" data-level="{1}">'.format(cls, level));
		item.children.forEach(function(item) {
			counter++;
			item.$pointer = counter;
			cache[counter] = item;
			var key = config.pk ? item[config.pk] : counter;

			if (key === selected)
				selindex = counter;

			builder.push('<div class="{0}-node{1}">'.format(cls, expanded[key] && item.children ? ' ui-tree-show' : ''));
			builder.push(self.template(item));
			item.children && self.renderchildren(builder, item, level + 1, selected);
			builder.push('</div>');
		});
		builder.push('</div>');
	};

	self.reset = function() {
		var cls = config.selected;
		self.find('.' + cls).rclass(cls);
	};

	self.first = function() {
		cache.first && self.select(cache.first.$pointer);
	};

	self.setter = function(value) {

		config.autoreset && self.clear();
		var builder = [];
		var selected = selindex === -1 ? -1 : config.pk ? cache[selindex][config.pk] : cache[selindex];

		selindex = -1;
		counter = 0;
		cache = {};

		var isexpand = false;

		value && value.forEach(function(item) {
			counter++;
			item.$pointer = counter;
			cache[counter] = item;
			var key = config.pk ? item[config.pk] : counter;
			if (key === selected)
				selindex = counter;
			builder.push('<div class="{0}-node{1}">'.format(cls, expanded[key] && item.children ? ' ui-tree-show' : '') + self.template(item));

			if (expanded[key])
				isexpand = true;

			if (item.children)
				self.renderchildren(builder, item, 1, selected);
			else if (!cache.first)
				cache.first = item;
			builder.push('</div>');
		});

		self.html(builder.join(''));

		if (selindex !== -1) {
			// Disables auto-select when is refreshed
			self.select(selindex, !config.reselect, true);
		} else
			config.first !== false && cache.first && setTimeout(self.first, 100);

		if (!isexpand && config.expanded)
			self.expand();

		config.checked && EXEC(self.makepath(config.checked), EMPTYARRAY, self);
	};
});

COMPONENT('window', 'zindex:12;scrollbar:1', function(self, config, cls) {

	var cls2 = '.' + cls;

	if (!W.$$window) {

		W.$$window_level = W.$$window_level || 1;
		W.$$window = true;

		var resize = function() {
			for (var i = 0; i < M.components.length; i++) {
				var com = M.components[i];
				if (com.name === 'window' && com.$ready && !com.$removed && !com.hclass('hidden'))
					com.resize();
			}
		};

		if (W.OP)
			W.OP.on('resize', resize);
		else
			$(W).on('resize', resize);
	}

	self.readonly();

	self.hide = function() {
		if (config.independent)
			self.hideforce();
		self.esc(false);
		self.set('');
	};

	self.resize = function() {
		var el = self.find(cls2 + '-body');
		el.height(WH - self.find(cls2 + '-header').height());
		self.scrollbar && self.scrollbar.resize();
	};

	self.make = function() {

		var scr = self.find('> script');
		self.template = scr.length ? scr.html() : '';

		$(document.body).append('<div id="{0}" class="hidden {3}-container"><div class="{3}"><div data-bind="@config__change .{3}-icon:@icon__text span:value.title" class="{3}-title"><button name="cancel" class="{3}-button-close{2}" data-path="{1}"><i class="fa fa-times"></i></button><i class="{3}-icon"></i><span></span></div><div class="{3}-header"></div><div class="{3}-body"></div></div>'.format(self.ID, self.path, config.closebutton == false ? ' hidden' : '', cls));
		var el = $('#' + self.ID);
		var body = el.find(cls2 + '-body');
		body[0].appendChild(self.dom);

		if (config.scrollbar && W.SCROLLBAR) {
			self.scrollbar = SCROLLBAR(body, { visibleY: !!config.scrollbarY });
			self.scrollleft = self.scrollbar.scrollLeft;
			self.scrolltop = self.scrollbar.scrollTop;
			self.scrollright = self.scrollbar.scrollRight;
			self.scrollbottom = self.scrollbar.scrollBottom;
		} else
			body.aclass(cls + '-scroll');

		self.rclass('hidden');
		self.replace(el);
		self.event('click', 'button[name]', function() {
			switch (this.name) {
				case 'cancel':
					self.hide();
					break;
			}
		});
	};

	self.icon = function(value) {
		var el = this.rclass2('fa');
		value.icon && el.aclass((value.icon.indexOf(' ') === -1 ? 'fa fa-' : '') + value.icon);
	};

	self.configure = function(key, value, init) {
		if (!init) {
			switch (key) {
				case 'closebutton':
					self.find(cls2 + '-button-close').tclass(value !== true);
					break;
			}
		}
	};

	self.esc = function(bind) {
		if (bind) {
			if (!self.$esc) {
				self.$esc = true;
				$(W).on('keydown', self.esc_keydown);
			}
		} else {
			if (self.$esc) {
				self.$esc = false;
				$(W).off('keydown', self.esc_keydown);
			}
		}
	};

	self.esc_keydown = function(e) {
		if (e.which === 27 && !e.isPropagationStopped()) {
			var val = self.get();
			if (!val || config.if === val) {
				e.preventDefault();
				e.stopPropagation();
				self.hide();
			}
		}
	};

	self.hideforce = function() {
		if (!self.hclass('hidden')) {
			self.aclass('hidden');
			self.release(true);
			self.find(cls2).rclass(cls + '-animate');
			W.$$window_level--;
		}
	};

	var allowscrollbars = function() {
		$('html').tclass(cls + '-noscroll', !!$(cls2 + '-container').not('.hidden').length);
	};

	self.setter = function(value) {

		setTimeout2(self.name + '-noscroll', allowscrollbars, 50);

		var isHidden = value !== config.if;

		if (self.hclass('hidden') === isHidden)
			return;

		setTimeout2('windowreflow', function() {
			EMIT('reflow', self.name);
		}, 10);

		if (isHidden) {
			if (!config.independent)
				self.hideforce();
			return;
		}

		if (self.template) {
			var is = self.template.COMPILABLE();
			self.find('div[data-jc-replaced]').html(self.template);
			self.template = null;
			is && COMPILE();
		}

		if (W.$$window_level < 1)
			W.$$window_level = 1;

		W.$$window_level++;

		var body = self.find(cls2 + '-body');

		self.css('z-index', W.$$window_level * config.zindex);
		body[0].scrollTop = 0;
		self.rclass('hidden');
		self.release(false);
		self.resize();

		config.reload && self.EXEC(config.reload, self);
		config.default && DEFAULT(self.makepath(config.default), true);

		if (!isMOBILE && config.autofocus) {
			var el = self.find(config.autofocus ? 'input[type="text"],input[type="password"],select,textarea' : config.autofocus);
			el.length && setTimeout(function() {
				el[0].focus();
			}, 1500);
		}

		setTimeout(function() {
			body[0].scrollTop = 0;
			self.find(cls2 ).aclass(cls + '-animate');
		}, 300);

		// Fixes a problem with freezing of scrolling in Chrome
		setTimeout2(self.id, function() {
			self.css('z-index', (W.$$window_level * config.zindex) + 1);
		}, 500);

		config.closeesc && self.esc(true);
	};
});

COMPONENT('floatinginput', 'minwidth:200', function(self, config, cls) {

	var cls2 = '.' + cls;
	var timeout, icon, plus, input, summary;
	var is = false;
	var plusvisible = false;

	self.readonly();
	self.singleton();
	self.nocompile && self.nocompile();

	self.configure = function(key, value, init) {
		if (init)
			return;
		switch (key) {
			case 'placeholder':
				self.find('input').prop('placeholder', value);
				break;
		}
	};

	self.make = function() {

		self.aclass(cls + ' hidden');
		self.append('<div class="{1}-summary hidden"></div><div class="{1}-input"><span class="{1}-add hidden"><i class="fa fa-plus"></i></span><span class="{1}-button"><i class="fa fa-search"></i></span><div><input type="text" placeholder="{0}" class="{1}-search-input" name="dir{2}" autocomplete="dir{2}" /></div></div'.format(config.placeholder, cls, Date.now()));

		input = self.find('input');
		icon = self.find(cls2 + '-button').find('i');
		plus = self.find(cls2 + '-add');
		summary = self.find(cls2 + '-summary');

		self.event('click', cls2 + '-button', function(e) {
			input.val('');
			self.search();
			e.stopPropagation();
			e.preventDefault();
		});

		self.event('click', cls2 + '-add', function() {
			if (self.opt.callback) {
				self.opt.scope && M.scope(self.opt.scope);
				self.opt.callback(input.val(), self.opt.element, true);
				self.hide();
			}
		});

		self.event('keydown', 'input', function(e) {
			switch (e.which) {
				case 27:
					self.hide();
					break;
				case 13:
					if (self.opt.callback) {
						self.opt.scope && M.scope(self.opt.scope);
						self.opt.callback(this.value, self.opt.element);
					}
					self.hide();
					break;
			}
		});

		var e_click = function(e) {
			var node = e.target;
			var count = 0;

			if (is) {
				while (true) {
					var c = node.getAttribute('class') || '';
					if (c.indexOf(cls + '-input') !== -1)
						return;
					node = node.parentNode;
					if (!node || !node.tagName || node.tagName === 'BODY' || count > 3)
						break;
					count++;
				}
			} else {
				is = true;
				while (true) {
					var c = node.getAttribute('class') || '';
					if (c.indexOf(cls) !== -1) {
						is = false;
						break;
					}
					node = node.parentNode;
					if (!node || !node.tagName || node.tagName === 'BODY' || count > 4)
						break;
					count++;
				}
			}

			is && self.hide(0);
		};

		var e_resize = function() {
			is && self.hide(0);
		};

		self.bindedevents = false;

		self.bindevents = function() {
			if (!self.bindedevents) {
				$(document).on('click', e_click);
				$(W).on('resize', e_resize);
				self.bindedevents = true;
			}
		};

		self.unbindevents = function() {
			if (self.bindedevents) {
				self.bindedevents = false;
				$(document).off('click', e_click);
				$(W).off('resize', e_resize);
			}
		};

		self.event('input', 'input', function() {
			var is = !!this.value;
			if (plusvisible !== is) {
				plusvisible = is;
				plus.tclass('hidden', !this.value);
			}
		});

		var fn = function() {
			is && self.hide(1);
		};

		self.on('reflow', fn);
		self.on('scroll', fn);
		self.on('resize', fn);
		$(W).on('scroll', fn);
	};

	self.show = function(opt) {

		// opt.element
		// opt.callback(value, el)
		// opt.offsetX     --> offsetX
		// opt.offsetY     --> offsetY
		// opt.offsetWidth --> plusWidth
		// opt.placeholder
		// opt.render
		// opt.minwidth
		// opt.maxwidth
		// opt.icon;
		// opt.maxlength = 30;

		var el = opt.element instanceof jQuery ? opt.element[0] : opt.element;

		self.tclass(cls + '-default', !opt.render);

		if (!opt.minwidth)
			opt.minwidth = 200;

		if (is) {
			clearTimeout(timeout);
			if (self.target === el) {
				self.hide(1);
				return;
			}
		}

		self.initializing = true;
		self.target = el;
		plusvisible = false;

		var element = $(opt.element);

		setTimeout(self.bindevents, 500);

		self.opt = opt;
		opt.class && self.aclass(opt.class);

		input.val(opt.value || '');
		input.prop('maxlength', opt.maxlength || 50);

		self.target = element[0];

		var w = element.width();
		var offset = element.offset();
		var width = w + (opt.offsetWidth || 0);

		if (opt.minwidth && width < opt.minwidth)
			width = opt.minwidth;
		else if (opt.maxwidth && width > opt.maxwidth)
			width = opt.maxwidth;

		var ico = '';

		if (opt.icon) {
			if (opt.icon.indexOf(' ') === -1)
				ico = 'fa fa-' + opt.icon;
			else
				ico = opt.icon;
		} else
			ico = 'fa fa-pencil-alt';

		icon.rclass2('fa').aclass(ico).rclass('hidden');

		if (opt.value) {
			plusvisible = true;
			plus.rclass('hidden');
		} else
			plus.aclass('hidden');

		self.find('input').prop('placeholder', opt.placeholder || config.placeholder);
		var options = { left: 0, top: 0, width: width };

		summary.tclass('hidden', !opt.summary).html(opt.summary || '');

		switch (opt.align) {
			case 'center':
				options.left = Math.ceil((offset.left - width / 2) + (width / 2));
				break;
			case 'right':
				options.left = (offset.left - width) + w;
				break;
			default:
				options.left = offset.left;
				break;
		}

		options.top = opt.position === 'bottom' ? ((offset.top - self.height()) + element.height()) : offset.top;
		options.scope = M.scope ? M.scope() : '';

		if (opt.offsetX)
			options.left += opt.offsetX;

		if (opt.offsetY)
			options.top += opt.offsetY;

		self.css(options);

		!isMOBILE && setTimeout(function() {
			input.focus();
		}, 200);

		self.tclass(cls + '-monospace', !!opt.monospace);
		self.rclass('hidden');

		setTimeout(function() {
			self.initializing = false;
			is = true;
			if (self.opt && self.target && self.target.offsetParent)
				self.aclass(cls + '-visible');
			else
				self.hide(1);
		}, 100);
	};

	self.hide = function(sleep) {
		if (!is || self.initializing)
			return;
		clearTimeout(timeout);
		timeout = setTimeout(function() {
			self.unbindevents();
			self.rclass(cls + '-visible').aclass('hidden');
			if (self.opt) {
				self.opt.close && self.opt.close();
				self.opt.class && self.rclass(self.opt.class);
				self.opt = null;
			}
			is = false;
		}, sleep ? sleep : 100);
	};
});

COMPONENT('properties2', 'datetimeformat:yyyy-MM-dd HH:mm;dateformat:yyyy-MM-dd;timeformat:HH:mm;modalalign:center;style:1;validation:1', function(self, config, cls) {

	var cls2 = '.' + cls;
	var container;
	var types = {};
	var skip = false;
	var values, funcs;

	self.nocompile();
	self.bindvisible();

	self.validate = function(value) {

		if (config.validation && value && value.length) {
			for (var i = 0; i < value.length; i++) {
				if (value[i].invalid)
					return false;
			}
		}

		return true;
	};

	self.make = function() {

		self.aclass(cls + (config.style === 2 ? (' ' + cls + '-2') : ''));

		if (!$('#propertie2supload').length)
			$(document.body).append('<input type="file" id="properties2upload" />');

		self.append('<div><div class="{0}-container"></div></div>'.format(cls));
		container = self.find(cls2 + '-container');

		var keys = Object.keys(types);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			types[key].init && types[key].init();
		}
	};

	self.finditem = function(el) {
		var index = +$(el).closest(cls2 + '-item').attrd('index');
		return index >= 0 ? self.get()[index] : null;
	};

	self.findel = function(el) {
		return $(el).closest(cls2 + '-item');
	};

	self.modifyval = function(item) {
		values[item.name] = item.value;
		var items = self.get();
		for (var i = 0; i < items.length; i++) {
			var item = items[i];
			if (!item.show)
				continue;
			var is = funcs[item.name + '_show'](values);
			self.find(cls2 + '-item[data-index="{0}"]'.format(i)).tclass('hidden', !is);
		}
	};

	self.register = function(name, init, render) {
		types[name] = {};
		types[name].init = init;
		types[name].render = render;
		init(self);
	};

	types.string = {};
	types.string.init = function() {

		self.event('click', cls2 + '-tstring', function() {
			var el = $(this);
			if (!el.hclass('ui-disabled'))
				el.find('input').focus();
		});

		self.event('change', '.pstring', function() {
			var t = this;
			var item = self.finditem(t);
			var val = t.value.trim();

			switch (item.transform) {
				case 'uppercase':
					val = val.toUpperCase();
					t.value = val;
					break;
				case 'lowercase':
					val = val.toLowerCase();
					t.value = val;
					break;
				case 'capitalize':
					var tmp = val.split(' ');
					for (var i = 0; i < tmp.length; i++)
						tmp[i] = tmp[i].substring(0, 1).toUpperCase() + tmp[i].substring(1);
					t.value = tmp.join(' ');
					break;
				case 'slug':
					val = val.slug();
					break;
			}

			var isvalid = item.required ? !!val : true;
			if (isvalid) {

				// Is RegExp?
				if (typeof(item.validate) === 'object') {
					isvalid = item.validate.test(val);
				} else {
					switch (item.validate) {
						case 'email':
							isvalid = val.isEmail();
							break;
						case 'phone':
							isvalid = val.isPhone();
							break;
						case 'url':
							isvalid = val.isURL();
							break;
					}
				}
			}

			var el = self.findel(t);

			if (isvalid) {
				item.value = val;
				item.changed = item.prev !== val;
				el.tclass(cls + '-changed', item.changed);
				config.change && self.EXEC(config.change, item);
				self.modifyval(item);
			}

			self.change(true);
			item.invalid = !isvalid;
			el.tclass(cls + '-invalid', item.invalid);
			t.$processed = true;
			item.required && self.validate2();
		});
	};

	types.string.render = function(item, next) {
		next('<div class="{0}-string"><input type="text" maxlength="{1}" placeholder="{2}" value="{3}" class="pstring"{4} /></div>'.format(cls, item.maxlength, item.placeholder || '', Thelpers.encode(item.value), item.disabled ? ' disabled' : ''));
	};

	types.password = {};
	types.password.init = function() {

		self.event('click', cls2 + '-tpassword', function() {
			var el = $(this);
			if (!el.hclass('ui-disabled'))
				el.find('input').focus();
		});

		self.event('focus', '.ppassword', function() {
			$(this).attr('type', 'text');
		});
		self.event('blur', '.ppassword', function() {
			$(this).attr('type', 'password');
		});
		self.event('change', '.ppassword', function() {
			var t = this;
			var item = self.finditem(t);
			var val = t.value.trim();

			var isvalid = item.required ? !!val : true;
			if (isvalid) {
				// Is RegExp?
				if (typeof(item.validate) === 'object')
					isvalid = item.validate.test(val);
			}

			var el = self.findel(t);

			if (isvalid) {
				item.value = val;
				item.changed = item.prev !== val;
				el.tclass(cls + '-changed', item.changed);
				config.change && self.EXEC(config.change, item);
				self.modifyval(item);
			}

			item.invalid = !isvalid;
			el.tclass(cls + '-invalid', item.invalid);
			t.$processed = true;
			self.change(true);
			item.required && self.validate2();
		});
	};
	types.password.render = function(item, next) {
		next('<div class="{0}-string"><input type="password" maxlength="{1}" placeholder="{2}" value="{3}" class="ppassword"{4} /></div>'.format(cls, item.maxlength, item.placeholder || '', Thelpers.encode(item.value), item.disabled ? ' disabled' : ''));
	};

	types.number = {};
	types.number.init = function() {

		self.event('click', cls2 + '-tnumber', function() {
			var el = $(this);
			if (!el.hclass('ui-disabled'))
				el.find('input').focus();
		});

		self.event('blur change', '.pnumber', function() {
			var t = this;

			if (t.$processed)
				return;

			var item = self.finditem(t);
			var val = t.value.trim();

			if (!val && item.value == null)
				return;

			var el = self.findel(t);
			var isvalid = true;

			val = val.parseFloat();

			if (item.min != null && val < item.min)
				isvalid = false;
			else if (item.max != null && val > item.max)
				isvalid = false;

			item.invalid = !isvalid;

			if (isvalid) {
				t.value =val + '';
				item.value = val;
				item.changed = item.prev !== val;
				el.tclass(cls + '-changed', item.changed);
				config.change && self.EXEC(config.change, item);
				self.modifyval(item);
			}

			el.tclass(cls + '-invalid', item.invalid);
			t.$processed = true;
			self.change(true);
			item.required && self.validate2();
		});

		self.event('keydown', '.pnumber', function(e) {
			var t = this;

			t.$processed = false;

			if (e.which === 38 || e.which === 40) {
				var num = t.value.parseFloat();
				var item = self.finditem(t);
				if (e.which === 38)
					num += item.inc || 1;
				else if (e.which === 40)
					num -= item.inc || 1;
				t.value = num;
				e.preventDefault();
			}

		});
	};
	types.number.render = function(item, next) {
		next('<div class="{0}-number"><input type="text" maxlength="{1}" placeholder="{2}" value="{3}" class="pnumber"{4} /></div>'.format(cls, 20, item.placeholder || '', Thelpers.encode((item.value == null ? '' : item.value) + ''), item.disabled ? ' disabled' : ''));
	};

	types.date = {};
	types.date.init = function() {

		self.event('click', cls2 + '-tdate', function() {
			var el = $(this);
			if (!el.hclass('ui-disabled'))
				el.find('input').focus();
		});

		self.event('blur change', '.pdate', function(e) {

			var t = this;

			if (e.type === 'change')
				SETTER('!datepicker', 'hide');

			if (t.$processed)
				return;

			var item = self.finditem(t);
			var val = t.value.parseDate(config.dateformat);
			item.value = val;
			item.changed = !item.prev || item.prev.format(config.dateformat) !== val.format(config.dateformat);
			self.findel(t).tclass(cls + '-changed', item.changed);
			config.change && self.EXEC(config.change, item, function(val) {
				t.value = val;
			});
			self.modifyval(item);
			self.change(true);
			item.required && self.validate2();
			t.$processed = true;
		});

		self.event('keydown', '.pdate', function(e) {
			var t = this;
			t.$processed = false;
			if ((e.which === 38 || e.which === 40) && t.value) {
				var val = t.value.parseDate(config.dateformat);
				var item = self.finditem(t);
				val = val.add((e.which === 40 ? '-' : '') + (item.inc || '1 day'));
				t.value = val.format(config.dateformat);
				e.preventDefault();
			}
		});

		self.event('click', '.pdate', function() {
			var t = this;
			var el = $(t);
			var opt = {};
			var item = self.finditem(t);
			opt.element = el.closest(cls2 + '-date').find('input');
			opt.value = item.value;
			opt.callback = function(value) {
				t.$processed = false;
				t.value = value.format(config.dateformat);
				el.trigger('change');
			};
			SETTER('datepicker', 'show', opt);
		});
	};
	types.date.render = function(item, next) {
		next('<div class="{0}-date"><i class="fa fa-calendar pdate"></i><div><input type="text" maxlength="{1}" placeholder="{2}" value="{3}" class="pdate" /></div></div>'.format(cls, config.dateformat.length, item.placeholder || '', item.value ? item.value.format(config.dateformat) : ''));
	};

	types.bool = {};
	types.bool.init = function() {

		if (config.style === 2) {
			self.event('click', cls2 + '-tbool', function(e) {
				e.stopPropagation();
				e.preventDefault();
				$(this).find(cls2 + '-booltoggle').trigger('click');
			});
		}

		self.event('click', cls2 + '-booltoggle', function(e) {

			e.preventDefault();
			e.stopPropagation();

			var t = this;
			var el = $(t);
			var item = self.finditem(t);

			if (item.disabled)
				return;

			el.tclass('checked');
			item.value = el.hclass('checked');
			item.changed = item.prev !== item.value;
			self.findel(t).tclass(cls + '-changed', item.changed);
			config.change && self.EXEC(config.change, item);
			self.modifyval(item);
			self.change(true);
			item.required && self.validate2();
		});
	};
	types.bool.render = function(item, next) {
		next('<div class="{0}-bool"><span class="{0}-booltoggle{1}"><i></i></span></div>'.format(cls, item.value ? ' checked' : ''));
	};

	types.exec = {};
	types.exec.init = function() {
		self.event('click', cls2 + '-' + (config.style === 2 ? 't' : '') + 'exec', function() {
			var t = this;
			var el = $(t);
			var item = self.finditem(t);
			if (!item.disabled && item.exec)
				self.EXEC(item.exec, item, el);
		});
	};
	types.exec.render = function(item, next) {
		next('<div class="{0}-exec">{1}<i class="fa fa-angle-right"></i></div>'.format(cls, item.value ? Thelpers.encode(item.value) : ''));
	};

	types.text = {};
	types.text.render = function(item, next) {
		next('<div class="{0}-text">{1}</div>'.format(cls, item.value ? Thelpers.encode(item.value) : ''));
	};

	types.list = {};
	types.list.init = function() {

		if (config.style === 2) {
			self.event('click', cls2 + '-tlist', function(e) {
				e.stopPropagation();
				e.preventDefault();
				$(this).find(cls2 + '-list').trigger('click');
			});
		}

		self.event('click', cls2 + '-list', function(e) {

			e.preventDefault();
			e.stopPropagation();

			var t = this;
			var item = self.finditem(t);

			if (item.disabled)
				return;

			var opt = {};
			opt.offsetY = -5;
			opt.element = $(t);
			opt.items = typeof(item.items) === 'string' ? item.items.indexOf('/') === -1 ? GET(item.items) : item.items : item.items;
			opt.custom = item.dircustom;
			opt.minwidth = 80;
			if (item.dirsearch)
				opt.placeholder = item.dirsearch;
			else if (item.dirsearch == false)
				opt.search = false;
			opt.callback = function(value) {

				if (typeof(value) === 'string') {
					opt.element.find('span').text(value);
					item.value = value;
				} else {
					opt.element.find('span').html(value[item.dirkey || 'name']);
					item.value = value[item.dirvalue || 'id'];
				}

				if (item.dircustom && item.dirappend !== false) {
					if (!opt.items)
						opt.items = [];
					if (opt.items.indexOf(item.value) === -1)
						opt.items.push(item.value);
				}

				item.changed = item.prev !== item.value;
				self.findel(t).tclass(cls + '-changed', item.changed);
				config.change && self.EXEC(config.change, item, function(val) {
					opt.element.find('span').text(val);
				});
				self.modifyval(item);
				self.change(true);
				item.required && self.validate2();
			};
			SETTER('directory', 'show', opt);
		});
	};

	types.list.render = function(item, next) {
		var template = '<div class="{0}-list">' + (config.style === 2 ? '' : '<i class="fa fa-chevron-down"></i>')  + '<span>{1}</span></div>';
		if (item.detail) {
			AJAX('GET ' + item.detail.format(encodeURIComponent(item.value)), function(response) {
				next(template.format(cls, response[item.dirkey || 'name'] || item.placeholder || DEF.empty));
			});
		} else {
			var arr = typeof(item.items) === 'string' ? GET(item.items) : item.items;
			var m = (arr || EMPTYARRAY).findValue(item.dirvalue || 'id', item.value, item.dirkey || 'name', item.placeholder || DEF.empty);
			next(template.format(cls, m));
		}
	};

	types.menu = {};
	types.menu.init = function() {

		if (config.style === 2) {
			self.event('click', cls2 + '-tmenu', function(e) {
				e.stopPropagation();
				e.preventDefault();
				$(this).find(cls2 + '-menu').trigger('click');
			});
		}

		self.event('click', cls2 + '-menu', function() {
			var t = this;
			var item = self.finditem(t);

			if (item.disabled)
				return;

			var opt = {};
			if (config.style === 2)
				opt.align = 'right';
			opt.offsetY = -5;
			opt.element = $(t);
			opt.items = typeof(item.items) === 'string' ? item.items.indexOf('/') === -1 ? GET(item.items) : item.items : item.items;
			opt.callback = function(value) {

				if (typeof(value) === 'string') {
					opt.element.find('span').text(value);
					item.value = value;
				} else {
					opt.element.find('span').html(value[item.dirkey || 'name']);
					item.value = value[item.dirvalue || 'id'];
				}

				if (item.dircustom && item.dirappend !== false) {
					if (!opt.items)
						opt.items = [];
					if (opt.items.indexOf(item.value) === -1)
						opt.items.push(item.value);
				}

				item.changed = item.prev !== item.value;
				self.findel(t).tclass(cls + '-changed', item.changed);
				config.change && self.EXEC(config.change, item, function(val) {
					opt.element.find('span').text(val);
				});
				self.modifyval(item);
				self.change(true);
				item.required && self.validate2();
			};
			SETTER('menu', 'show', opt);
		});
	};

	types.menu.render = function(item, next) {
		var template = '<div class="{0}-menu">' + (config.style === 2 ? '' : '<i class="fa fa-chevron-down"></i>') + '<span>{1}</span></div>';
		if (item.detail) {
			AJAX('GET ' + item.detail.format(encodeURIComponent(item.value)), function(response) {
				next(template.format(cls, response[item.dirkey || 'name'] || item.placeholder || DEF.empty));
			});
		} else {
			var arr = typeof(item.items) === 'string' ? GET(item.items) : item.items;
			var m = (arr || EMPTYARRAY).findValue(item.dirvalue || 'id', item.value, item.dirkey || 'name', item.placeholder || DEF.empty);
			next(template.format(cls, m));
		}
	};

	types.color = {};
	types.color.init = function() {

		if (config.style === 2) {
			self.event('click', cls2 + '-tcolor', function(e) {
				e.stopPropagation();
				e.preventDefault();
				$(this).find(cls2 + '-colortoggle').trigger('click');
			});
		}

		self.event('click', cls2 + '-colortoggle', function(e) {

			e.preventDefault();
			e.stopPropagation();

			var t = this;
			var item = self.finditem(t);

			if (item.disabled)
				return;

			var opt = {};
			// opt.offsetY = -5;
			// opt.offsetX = 6;
			opt.align = config.modalalign;
			opt.element = $(t);
			opt.callback = function(value) {
				opt.element.find('b').css('background-color', value);
				item.value = value;
				item.changed = item.prev !== item.value;
				self.findel(t).tclass(cls + '-changed', item.changed);
				config.change && self.EXEC(config.change, item, function(val) {
					opt.element.find('b').css('background-color', val);
				});
				self.modifyval(item);
				self.change(true);
				item.required && self.validate2();
			};
			SETTER('colorpicker', 'show', opt);
		});
	};
	types.color.render = function(item, next) {
		next('<div class="{0}-color"><span class="{0}-colortoggle"><b{1}>&nbsp;</b></span></div>'.format(cls, item.value ? (' style="background-color:' + item.value + '"') : ''));
	};

	types.fontawesome = {};
	types.fontawesome.init = function() {

		if (config.style === 2) {
			self.event('click', cls2 + '-tfontawesome', function(e) {
				e.stopPropagation();
				e.preventDefault();
				$(this).find(cls2 + '-fontawesometoggle').trigger('click');
			});
		}

		self.event('click', cls2 + '-fontawesometoggle', function(e) {

			e.preventDefault();
			e.stopPropagation();

			var t = this;
			var item = self.finditem(t);

			if (item.disabled)
				return;

			var opt = {};
			opt.align = config.modalalign;
			opt.element = $(t);
			opt.callback = function(value) {
				opt.element.find('i').rclass().aclass(value);
				item.value = value;
				item.changed = item.prev !== item.value;
				self.findel(t).tclass(cls + '-changed', item.changed);
				config.change && self.EXEC(config.change, item, function(val) {
					opt.element.find('i').rclass().aclass(val);
				});
				self.modifyval(item);
				self.change(true);
				item.required && self.validate2();
			};
			SETTER('faicons', 'show', opt);
		});
	};
	types.fontawesome.render = function(item, next) {
		next('<div class="{0}-fontawesome"><span class="{0}-fontawesometoggle"><i class="{1}"></i></span></div>'.format(cls, item.value || ''));
	};

	types.emoji = {};
	types.emoji.init = function() {

		if (config.style === 2) {
			self.event('click', cls2 + '-temoji', function(e) {
				e.stopPropagation();
				e.preventDefault();
				$(this).find(cls2 + '-emojitoggle').trigger('click');
			});
		}

		self.event('click', cls2 + '-emojitoggle', function(e) {

			e.preventDefault();
			e.stopPropagation();

			var t = this;
			var item = self.finditem(t);

			if (item.disabled)
				return;

			var opt = {};
			opt.align = config.modalalign;
			opt.element = $(t);
			opt.callback = function(value) {
				opt.element.html(value);
				item.value = value;
				item.changed = item.prev !== item.value;
				self.findel(t).tclass(cls + '-changed', item.changed);
				config.change && self.EXEC(config.change, item, function(val) {
					opt.element.html(val);
				});
				self.modifyval(item);
				self.change(true);
				item.required && self.validate2();
			};
			SETTER('emoji', 'show', opt);
		});
	};
	types.emoji.render = function(item, next) {
		next('<div class="{0}-emoji"><span class="{0}-emojitoggle">{1}</span></div>'.format(cls, item.value || DEF.empty));
	};

	types.file = {};
	types.file.init = function() {

		if (config.style === 2) {
			self.event('click', cls2 + '-tfile', function(e) {
				e.stopPropagation();
				e.preventDefault();
				$(this).find(cls2 + '-file').trigger('click');
			});
		}

		self.event('click', cls2 + '-file', function(e) {

			e.preventDefault();
			e.stopPropagation();

			// Loads file
			var t = this;
			var item = self.finditem(t);

			if (item.disabled)
				return;

			var file = $('#propertiesupload');

			if (item.accept)
				file.attr('accept', item.accept);
			else
				file.removeAttr('accept');

			file.off('change').on('change', function() {
				var file = this;
				var data = new FormData();
				data.append('file', file.files[0]);
				SETTER('loading', 'show');
				UPLOAD(item.url, data, function(response) {
					item.value = response;
					item.changed = item.prev !== item.value;
					self.findel(t).tclass(cls + '-changed', item.changed);
					config.change && self.EXEC(config.change, item, function(val) {
						self.findel(cls2 + '-filename').text(val);
					});
					SETTER('loading', 'hide', 1000);
					file.value = '';
					self.modifyval(item);
					self.change(true);
					item.required && self.validate2();
				});
			}).trigger('click');
		});
	};

	types.file.render = function(item, next) {
		next('<div class="{0}-file"><i class="far fa-folder"></i><span class="{0}-filename">{1}</span></div>'.format(cls, item.filename || item.value || DEF.empty));
	};

	self.render = function(item, index) {

		var type = types[item.type === 'boolean' ? 'bool' : item.type];
		var c = cls;

		if (item.show) {
			if (!funcs[item.name + '_show'](values))
				c = 'hidden ' + c;
		}

		var meta = { label: item.label, type: item.type };

		if (item.icon) {
			var tmp = item.icon;
			var color;
			tmp = tmp.replace(/#[a-f0-9]+/gi, function(text) {
				color = text;
				return '';
			}).trim();
			if (tmp.indexOf(' ') === -1)
				tmp = 'fa fa-' + tmp;
			meta.icon = Tangular.render('<i class="{{ icon }}"{{ if color }} style="{{ type }}color:{{ color }}"{{ fi }}></i>', { icon: tmp, color: color, type: config.style === 2 ? 'background-' : '' });
		} else
			meta.icon = '';

		var el = $(('<div class="{2}-item{3} {2}-t{type}' + (item.required ? ' {2}-required' : '') + (item.icon ? ' {2}-isicon' : '') + (item.note ? ' {2}-isnote' : '') + '" data-index="{1}">' + (config.style === 2 ? '{{ icon }}<div>' : '') + '<div class="{0}-key">' + (config.style === 2 ? '' : '{{ icon }}') + '{{ label }}</div>' + (config.style === 2 ? '<div class="{0}-value">&nbsp;</div><div class="{0}-note">{1}</div>'.format(cls, Thelpers.encode(item.note)) : '<div class="{0}-value">&nbsp;</div>') + '</div>' + (config.style === 2 ? '</div>' : '')).format(cls, index, c, item.required ? (' ' + cls + '-required') : '').arg(meta));

		type.render(item, function(html) {

			if (item.note && config.style !== 2)
				html += '<div class="{0}-note">{1}</div>'.format(cls, item.note);

			el.find(cls2 + '-value').html(html);
			item.disabled && el.aclass('ui-disabled');

		}, el);

		return el;
	};

	self.setter = function(value) {

		if (skip) {
			skip = false;
			return;
		}

		if (!value)
			value = EMPTYARRAY;

		container.empty();

		var groups = {};

		values = {};
		funcs = {};

		for (var i = 0; i < value.length; i++) {
			var item = value[i];
			var g = item.group || 'Default';

			item.invalid = false;

			if (!groups[g])
				groups[g] = { html: [] };

			switch (item.type) {
				case 'fontawesome':
				case 'string':
					item.prev = item.value || '';
					break;
				case 'date':
					item.prev = item.value ? item.value.format(config.dateformat) : null;
					break;
				// case 'number':
				// case 'bool':
				// case 'boolean':
				// case 'list':
				default:
					item.prev = item.value;
					break;
			}

			if (item.show)
				funcs[item.name + '_show'] = typeof(item.show) === 'string' ? FN(item.show) : item.show;

			values[item.name] = item.value;

			if (item.required)
				item.invalid = !item.value;

			groups[g].html.push(self.render(item, i));
		}

		var keys = Object.keys(groups);
		for (var i = 0; i < keys.length; i++) {

			var key = keys[i];
			var group = groups[key];
			var hash = 'g' + HASH(key, true);
			var el = $('<div class="{0}-group" data-id="{2}"><label>{1}</label><section></section></div>'.format(cls, key, hash));
			var section = el.find('section');

			for (var j = 0; j < group.html.length; j++)
				section.append(group.html[j]);

			container.append(el);
		}

		self.validate2();
	};

});

COMPONENT('notificationspanel', 'top:0;visibleY:1;title:Notifications;autoremove:1', function(self, config, cls) {

	var cls2 = '.' + cls;
	var container, scrollbar, elclear, items;

	self.nocompile();
	self.singleton();

	self.make = function() {
		var scr = self.find('script');
		self.aclass(cls + ' hidden');
		self.template = Tangular.compile('<div class="{0}-item" data-index="{{ index }}">{1}</div>'.format(cls, scr.html().trim()));
		self.html('<div class="{0}-header"><span class="{0}-close"><i class="fa fa-caret-square-down"></i></span><i class="fa fa-trash-o {0}-clear"></i><span>{1}</span></div><div class="{0}-container"><div class="{0}-items"></div></div>'.format(cls, config.title));
		scrollbar = SCROLLBAR(self.find(cls2 + '-container'), { visibleY: config.visibleY, parent: self.element });
		container = self.find('.ui-scrollbar-body');
		self.scrolltop = scrollbar.scrollTop;
		self.scrollbottom = scrollbar.scrollBottom;
		elclear = self.find(cls2 + '-clear');
		elclear.on('click', self.clear);
		self.event('click', cls2 + '-item', function() {
			var el = $(this);
			config.click && self.EXEC(config.click, items[+el.attrd('index')], el);
			if (config.autoremove) {
				el.remove();
				elclear.tclass('hidden', !container.find(cls2 + '-item').length);
			}
		});

		self.event('click', cls2 + '-close', function() {
			self.set(!self.get());
		});

		$(W).on('resize', self.resize);
		self.resize();
	};

	self.resizeforce = function() {
		var css = {};
		css.height = WH;
		css.top = config.top;
		self.css(css);
		delete css.top;
		var content = self.find(cls2 + '-container');
		css.height = css.height - content.offset().top;
		content.css(css);
		scrollbar.resize();
	};

	self.resize = function() {
		setTimeout2(self.ID, self.resizeforce, 300);
	};

	self.render = function(value) {

		if (!value)
			value = EMPTYARRAY;

		items = value;
		var builder = [];
		for (var i = 0; i < value.length; i++) {
			var item = value[i];
			item.index = i;
			builder.push(self.template(item));
		}

		container.html(builder.join(''));
		elclear.tclass('hidden', !builder.length);
		builder.length && self.resize();
	};

	self.clear = function() {
		container.empty();
		elclear.aclass('hidden');
		config.clear && self.EXEC(config.clear);
	};

	self.setter = function(value) {
		if (value) {
			self.EXEC(config.exec, function(value) {
				self.rclass('hidden');
				self.render(value);
			});
		} else
			self.aclass('hidden');
	};

});

COMPONENT('rules', 'dirsearch:Search', function(self, config, cls) {

	var skip = false;
	var cls2 = '.' + cls;
	var items;

	self.readonly();
	self.renders = {};

	self.renders.number = function(item) {
		return '<div class="{0}-number"><input type="text"{1} value="{2}" /></div>'.format(cls, item.enabled ? '' : ' disabled', Thelpers.encode(item.value));
	};

	self.renders.string = function(item) {
		if (item.items) {
			var m = item.items.findItem('id', item.value);
			return '<div class="{0}-string"><div class="{0}-list">{2}</div></div>'.format(cls, item.enabled ? '' : ' disabled', m ? m.name : '');
		} else
			return '<div class="{0}-string"><input type="text"{1} value="{2}" /></div>'.format(cls, item.enabled ? '' : ' disabled', Thelpers.encode(item.value));
	};

	self.renders.boolean = function(item) {
		return '<div class="{0}-boolean"><span class="{0}-checkbox{1}"><i></i></span></div>'.format(cls, item.value ? ' checked' : '');
	};

	self.renders.item = function(item) {

		var type = item.type.toLowerCase();
		var html = self.renders[type](item);
		var comparer = ['<', '<=', '==', '!=', '>=', '>'];

		for (var i = 0; i < comparer.length; i++) {
			var m = comparer[i];
			var disabled = type !== 'number' && i !== 2 && i !== 3;
			var selected = item.comparer === m;
			comparer[i] = '<button data-disabled="{3}" class="{4}" name="{0}"{1}>{2}</button>'.format(m, disabled || !item.enabled ? ' disabled' : '', m === '!=' ? '<>' : m === '==' ? '=' : m.replace('>=', '=>'), disabled, selected ? 'selected' : '');
		}

		return ('<div class="{0}-item' + (item.enabled ? '' : ' disabled') + '" data-name="' + item.name + '"><div class="{0}-value">' + html + '</div><div class="{0}-comparer">' + comparer.join('') + '</div><div class="{0}-key"><div class="{0}-enabled"><span class="{0}-checkbox' + (item.enabled ? ' checked' : '') + '"><i></i></span></div><div class="{0}-label">' + item.label + (item.note ? ('<div class="help">' + item.note + '</div>') : '') + '</div></div></div>').format(cls);
	};

	self.forcechange = function() {
		skip = true;
		self.change(true);
		self.update();
	};

	self.make = function() {
		self.aclass(cls);

		self.event('click', cls2 + '-enabled', function() {
			var el = $(this);
			var is = el.find('span').tclass('checked').hclass('checked');
			el = el.closest(cls2 + '-item');
			el.tclass('disabled', !is);
			el.find('button').prop('disabled', function() {
				return this.getAttribute('data-disabled') === 'true' ? true : !is;
			});
			el.find('input').prop('disabled', !is);
			items.findItem('name', el.attrd('name')).enabled = is;
			self.forcechange();
		});

		self.event('click', cls2 + '-boolean', function() {
			var el = $(this);
			var is = el.find('span').tclass('checked').hclass('checked');
			var id = el.closest(cls2 + '-item').attrd('name');
			items.findItem('name', id).value = is;
			self.forcechange();
		});

		self.event('click', 'button', function() {
			var el = $(this);
			el.parent().find('.selected').rclass('selected');
			el.aclass('selected');
			var id = el.closest(cls2 + '-item').attrd('name');
			items.findItem('name', id).comparer = el.prop('name');
			self.forcechange();
		});

		self.event('change', 'input', function() {
			var el = $(this);
			var id = el.closest(cls2 + '-item').attrd('name');
			var item = items.findItem('name', id);
			if (item.type === 'number')
				item.value = el.val().parseFloat();
			else
				item.value = el.val();
			self.forcechange();
		});

		self.event('click', cls2 + '-list', function() {
			var el = $(this);
			var opt = {};
			var item = items.findItem('name', el.closest(cls2 + '-item').attrd('name'));
			opt.element = el;
			opt.align = 'right';
			opt.items = item.items;
			opt.placeholder = config.dirsearch;
			opt.callback = function(sel) {
				el.text(sel.name);
				self.forcechange();
			};
			SETTER('directory/show', opt);
		});

	};

	self.setter = function(value) {

		if (skip) {
			skip = false;
			return;
		}

		if (!value)
			value = [];

		items = value;
		var builder = [];
		for (var i = 0; i < value.length; i++)
			builder.push(self.renders.item(value[i]));

		self.html(builder.join(''));
	};

});

COMPONENT('tabmenu', 'class:selected;selector:li', function(self, config) {
	var old, oldtab;

	self.readonly();
	self.nocompile && self.nocompile();
	self.bindvisible();

	self.make = function() {
		self.event('click', config.selector, function() {
			if (!config.disabled) {
				var el = $(this);
				if (!el.hclass(config.class)) {
					var val = el.attrd('value');
					if (config.exec)
						EXEC(self.makepath(config.exec), val);
					else
						self.set(val);
				}
			}
		});
		var scr = self.find('script');
		if (scr.length) {
			self.template = Tangular.compile(scr.html());
			scr.remove();
		}
	};

	self.configure = function(key, value) {
		switch (key) {
			case 'disabled':
				self.tclass('ui-disabled', !!value);
				break;
			case 'datasource':
				self.datasource(value, function(path, value) {
					if (value instanceof Array) {
						var builder = [];
						for (var i = 0; i < value.length; i++)
							builder.push(self.template(value[i]));
						old = null;
						self.html(builder.join(''));
						self.refresh();
					}
				}, true);
				break;
		}
	};

	self.setter = function(value) {
		if (old === value)
			return;
		oldtab && oldtab.rclass(config.class);
		oldtab = self.find(config.selector + '[data-value="' + value + '"]').aclass(config.class);
		old = value;
	};
});

COMPONENT('empty', 'icon:fa fa-database;parent:parent;margin:0', function(self, config, cls) {

	var visible = false;
	var special = false;
	var table;

	self.readonly();

	self.make = function() {

		self.aclass(cls);

		var scr = self.find('> scri' + 'pt,> template');
		var text = scr.length ? scr.html() : self.html();
		var html = '<div class="{0}-table hidden"><div class="{0}-cell"><i class="{1}"></i><div>{2}</div></div></div>'.format(cls, config.icon, text);

		if (scr.length) {
			special = true;
			scr.remove();
			self.element.prepend(html);
		} else
			self.html(html);

		table = self.find('> .' + cls + '-table');

		self.on('resize2 + resize', function() {
			if (!visible)
				self.resize();
		});

		self.rclass('hidden');
	};

	self.resize = function() {
		setTimeout2(self.ID, self.resizeforce, 300);
	};

	self.resizeforce = function() {
		var parent = self.parent(config.parent);
		var wh = parent.height() - 10;

		if (config.topoffset)
			wh -= self.element.offset().top;

		if (config.topposition)
			wh -= self.element.position().top;

		table.css('height', wh < 100 ? 'auto' : wh - config.margin);
	};

	self.setter = function(value) {

		visible = false;

		if (value instanceof Array)
			visible = !!value.length;
		else if (value)
			visible = value.items && !!value.items.length;

		table.tclass('hidden', visible);

		if (!visible)
			self.resizeforce();

		if (special) {
			for (var i = 1; i < self.dom.children.length; i++)
				$(self.dom.children[i]).tclass('hidden', !visible);
		}

	};

});

COMPONENT('intro', function(self, config, cls) {

	var cls2 = '.' + cls;
	var container = 'intro' + GUID(4);
	var content, figures, buttons, button = null;
	var index = 0;
	var visible = false;

	self.readonly();

	self.make = function() {
		$(document.body).append('<div id="{0}" class="hidden {1}"><div class="{1}-body"></div></div>'.format(container, cls));
		content = self.element;
		container = $('#' + container);
		content.rclass('hidden');
		var body = container.find(cls2 + '-body');
		body[0].appendChild(self.element[0]);
		self.replace(container);
		content.aclass('ui-intro-figures');
		figures = content.find('figure');
		var items = [];

		figures.each(function(index) {
			items.push('<i class="fa fa-circle {0}-button" data-index="{1}"></i>'.format(cls, index));
		});

		body.append('<div class="{0}-pagination"><button name="next"></button>{1}</div>'.format(cls, items.join('')));
		buttons = self.find(cls2 + '-button');
		button = self.find(cls2 + '-pagination').find('button');

		self.event('click', 'button[name="next"]', function() {
			index++;
			if (index >= figures.length) {
				self.set('');
				config.exec && EXEC(config.exec);
				config.remove && self.remove();
			} else {
				self.move(index);
				config.page && EXEC(config.page, index);
			}
		});

		self.event('click', 'button[name="close"]', function() {
			self.set('');
			config.exec && EXEC(config.exec, true);
			config.remove && self.remove();
		});

		self.event('click', cls2 + '-button', function() {
			self.move(+this.getAttribute('data-index'));
		});
	};

	self.move = function(indexer) {
		figures.filter('.visible').rclass('visible');
		buttons.filter('.selected').rclass('selected');
		figures.eq(indexer).aclass('visible');
		buttons.eq(indexer).aclass('selected');
		button.html(indexer < buttons.length - 1 ? ((config.next || 'Next') + '<i class="fa fa-chevron-right"></i>') : (config.close || 'Done'));
		index = indexer;
		return self;
	};

	self.setter = function(value) {
		var is = value == config.if;
		if (is === visible)
			return;
		index = 0;
		self.move(0);
		visible = is;
		self.tclass('hidden', !is);
		setTimeout(function() {
			self.find(cls2 + '-body').tclass(cls + '-body-visible', is);
		}, 100);
	};
});

COMPONENT('windows', 'menuicon:fa fa-navicon;reoffsetresize:0', function(self, config, cls) {

	var cls2 = '.' + cls;
	var cache = {};
	var services = [];
	var events = {};
	var drag = {};
	var prevfocused;
	var serviceid;
	var data = [];
	var lastWW = WW;
	var lastWH = WH;

	self.make = function() {
		self.aclass(cls);
		self.event('click', cls2 + '-control', function() {
			var el = $(this);
			var name = el.attrd('name');
			var item = cache[el.closest(cls2 + '-item').attrd('id')];
			switch (name) {
				case 'close':
					item.setcommand('close');
					break;
				case 'minimize':
					item.setcommand('toggleminimize');
					break;
				case 'maximize':
					item.setcommand('togglemaximize');
					break;
				case 'menu':
					item.meta.menu && item.meta.menu.call(item, el);
					break;
				default:
					item.setcommand(name);
					break;
			}
		});

		self.event('mousedown touchstart', cls2 + '-item', function() {
			if (prevfocused) {
				if (prevfocused[0] == this)
					return;
				prevfocused.rclass(cls + '-focused');
			}
			prevfocused = $(this).aclass(cls + '-focused');
		});

		self.event('mousedown touchstart', cls2 + '-title,' + cls2 + '-resize', events.down);
		self.on('resize2', self.resize2);
		serviceid = setInterval(events.service, 5000);
	};

	self.finditem = function(id) {
		return cache[id];
	};

	self.send = function(type, body) {
		for (var i = 0; i < data.length; i++)
			data[i].meta.data(type, body, data[i].element);
	};

	self.destroy = function() {
		clearInterval(serviceid);
	};

	self.resize2 = function() {
		setTimeout2(self.ID, self.resize, 200);
	};

	self.recompile = function() {
		setTimeout2(self.ID + 'compile', COMPILE, 50);
	};

	self.resizeforce = function() {

		self.element.find(cls2 + '-maximized').each(function() {
			cache[$(this).attrd('id')].setcommand('maximize');
		});

		if (config.reoffsetresize) {
			var diffWW = lastWW - WW;
			var diffWH = lastWH - WH;

			var keys = Object.keys(cache);
			for (var i = 0; i < keys.length; i++) {
				var win = cache[keys[i]];
				win.setoffset(win.x - diffWW, win.y - diffWH);
			}

			lastWW = WW;
			lastWH = WH;
		}
	};

	self.resize = function() {
		setTimeout2(self.ID + 'resize', self.resizeforce, 300);
	};

	events.service = function() {
		for (var i = 0; i < services.length; i++) {
			var tmp = services[i];
			if (tmp.$service)
				tmp.$service++;
			else
				tmp.$service = 1;
			tmp.meta.service && tmp.meta.service.call(tmp, tmp.$service, tmp.element);
		}
	};

	events.down = function(e) {

		var E = e;

		if (e.type === 'touchstart') {
			drag.touch = true;
			e = e.touches[0];
		} else
			drag.touch = false;

		if (e.target.nodeName === 'I')
			return;

		var el = $(this);
		var parent = el.closest(cls2 + '-item');

		if (parent.hclass(cls + '-maximized'))
			return;

		drag.resize = el.hclass(cls + '-resize');
		drag.is = false;

		E.preventDefault();

		var myoffset = self.element.position();
		var pos;

		if (drag.resize) {
			var c = el.attr('class');
			drag.el = el.closest(cls2 + '-item');
			drag.dir = c.match(/-(tl|tr|bl|br)/)[0].substring(1);
			pos = drag.el.position();
			var m = self.element.offset();
			drag.body = drag.el.find(cls2 + '-body');
			drag.plus = m;
			drag.x = pos.left;
			drag.y = pos.top;
			drag.width = drag.el.width();
			drag.height = drag.body.height();
		} else {
			drag.el = el.closest(cls2 + '-item');
			pos = drag.el.position();
			drag.x = e.pageX - pos.left;
			drag.y = e.pageY - pos.top;
		}

		drag.el.aclass(cls + '-block');
		drag.offX = myoffset.left;
		drag.offY = myoffset.top;
		drag.item = cache[drag.el.attrd('id')];

		if (drag.item.meta.actions) {
			if (drag.resize) {
				if (drag.item.meta.actions.resize == false)
					return;
				drag.resize = drag.item.meta.actions.resize;
			} else {
				if (drag.item.meta.actions.move == false)
					return;
			}
		}

		drag.el.aclass(cls + '-dragged');
		$(W).on('mousemove touchmove', events.move).on('mouseup touchend', events.up);
	};

	events.move = function(e) {

		var evt = e;
		if (drag.touch)
			evt = e.touches[0];

		var obj = {};
		drag.is = true;

		if (drag.resize) {

			var x = evt.pageX - drag.offX - drag.plus.left;
			var y = evt.pageY - drag.offY - drag.plus.top;
			var off = drag.item.meta.offset;
			var w;
			var h;

			switch (drag.dir) {

				case 'tl':
					obj.left = x;
					obj.top = y;
					w = drag.width - (x - drag.x);
					h = drag.height - (y - drag.y);

					if ((off.minwidth && w < off.minwidth) || (off.minheight && h < off.minheight) || (off.maxwidth && w > off.maxwidth) || (off.maxheight && h > off.maxheight))
						break;

					if (drag.resize === true || drag.resize === 'width') {
						obj.width = w;
						drag.el.css(obj);
					}

					if (drag.resize === true || drag.resize === 'height') {
						obj.height = h;
						delete obj.width;
						delete obj.top;
						drag.body.css(obj);
					}
					break;

				case 'tr':
					w = x - drag.x;
					h = drag.height - (y - drag.y);

					if ((off.minwidth && w < off.minwidth) || (off.minheight && h < off.minheight) || (off.maxwidth && w > off.maxwidth) || (off.maxheight && h > off.maxheight))
						break;

					if (drag.resize === true || drag.resize === 'width') {
						obj.width = w;
						obj.top = y;
						drag.el.css(obj);
					}

					if (drag.resize === true || drag.resize === 'height') {
						obj.height = h;
						delete obj.width;
						delete obj.top;
						drag.body.css(obj);
					}

					break;

				case 'bl':

					w = drag.width - (x - drag.x);
					h = y - drag.y - 30;

					if ((off.minwidth && w < off.minwidth) || (off.minheight && h < off.minheight) || (off.maxwidth && w > off.maxwidth) || (off.maxheight && h > off.maxheight))
						break;

					if (drag.resize === true || drag.resize === 'width') {
						obj.left = x;
						obj.width = w;
						drag.el.css(obj);
						delete obj.width;
					}

					if (drag.resize === true || drag.resize === 'height') {
						obj.height = h;
						drag.body.css(obj);
					}

					break;

				case 'br':
					w = x - drag.x;
					h = y - drag.y - 30;

					if ((off.minwidth && w < off.minwidth) || (off.minheight && h < off.minheight) || (off.maxwidth && w > off.maxwidth) || (off.maxheight && h > off.maxheight))
						break;

					if (drag.resize === true || drag.resize === 'width') {
						obj.width = w;
						drag.el.css(obj);
						delete obj.width;
					}

					if (drag.resize === true || drag.resize === 'height') {
						obj.height = h;
						drag.body.css(obj);
					}

					break;
			}

			drag.item.ert && clearTimeout(drag.item.ert);
			drag.item.ert = setTimeout(drag.item.emitresize, 100);

		} else {
			obj.left = evt.pageX - drag.x - drag.offX;
			obj.top = evt.pageY - drag.y - drag.offY;

			if (obj.top < 0)
				obj.top = 0;

			drag.el.css(obj);
		}

		if (!drag.touch)
			e.preventDefault();
	};

	events.up = function() {

		drag.el.rclass(cls + '-dragged').rclass(cls + '-block');
		$(W).off('mousemove touchmove', events.move).off('mouseup touchend', events.up);

		if (!drag.is)
			return;

		var item = drag.item;
		var meta = item.meta;
		var pos = drag.el.position();

		drag.is = false;
		drag.x = meta.offset.x = item.x = pos.left;
		drag.y = meta.offset.y = item.y = pos.top;

		if (drag.resize) {
			item.width = meta.offset.width = drag.el.width();
			item.height = meta.offset.height = drag.body.height();
			meta.resize && meta.resize.call(item, item.width, item.height, drag.body, item.x, item.y);
			self.element.SETTER('*', 'resize');
		}

		meta.move && meta.move.call(item, item.x, item.y, drag.body);
		self.wsave(item);
		self.change(true);
	};

	var wsavecallback = function(item) {
		var key = 'win_' + item.meta.cachekey;
		var obj = {};
		obj.x = item.x;
		obj.y = item.y;
		obj.width = item.width;
		obj.height = item.height;
		obj.ww = WW;
		obj.wh = WH;
		obj.hidden = item.meta.hidden;
		PREF.set(key, obj, '1 month');
	};

	self.wsave = function(obj) {
		if (obj.meta.actions && obj.meta.actions.autosave)
			setTimeout2(self.ID + '_win_' + obj.meta.cachekey, wsavecallback, 500, null, obj);
	};

	self.wadd = function(item) {

		var hidden = '';
		var ishidden = false;

		if (!item.cachekey)
			item.cachekey = item.id;

		if (item.cachekey)
			item.cachekey += '' + item.offset.width + 'x' + item.offset.height;

		if (item.actions && item.actions.autosave) {
			pos = PREF['win_' + item.cachekey];
			if (pos) {

				var mx = 0;
				var my = 0;

				var keys = Object.keys(cache);
				var plus = 0;

				for (var i = 0; i < keys.length; i++) {
					if (cache[keys[i]].meta.cachekey === item.cachekey)
						plus += 50;
				}

				if (config.reoffsetresize && pos.ww != null && pos.wh != null) {
					mx = pos.ww - WW;
					my = pos.wh - WH;
				}

				item.offset.x = (pos.x - mx) + plus;
				item.offset.y = (pos.y - my) + plus;
				item.offset.width = pos.width;
				item.offset.height = pos.height;

				if (pos.hidden && (item.hidden == null || item.hidden)) {
					ishidden = true;
					item.hidden = true;
				}
			}
		}

		if (!ishidden)
			ishidden = item.hidden;

		hidden = ishidden ? ' hidden' : '';

		var el = $('<div class="{0}-item{2}" data-id="{id}" style="left:{x}px;top:{y}px;width:{width}px"><span class="{0}-resize {0}-resize-tl"></span><span class="{0}-resize {0}-resize-tr"></span><span class="{0}-resize {0}-resize-bl"></span><span class="{0}-resize {0}-resize-br"></span><div class="{0}-title"><i class="fa fa-times {0}-control" data-name="close"></i><i class="far fa-window-maximize {0}-control" data-name="maximize"></i><i class="far fa-window-minimize {0}-control" data-name="minimize"></i><i class="{1} {0}-control {0}-lastbutton" data-name="menu"></i><span>{{ title }}</span></div><div class="{0}-body" style="height:{height}px"></div></div>'.format(cls, config.menuicon, hidden).arg(item.offset).arg(item));
		var body = el.find(cls2 + '-body');
		var pos;

		body.append(item.html);

		if (typeof(item.html) === 'string' && item.html.COMPILABLE())
			self.recompile();

		if (item.actions) {
			if (item.actions.resize == false)
				el.aclass(cls + '-noresize');
			if (item.actions.move == false)
				el.aclass(cls + '-nomove');

			var noclose = item.actions.close == false;
			if (item.actions.hide)
				noclose = false;

			if (noclose)
				el.aclass(cls + '-noclose');
			if (item.actions.maximize == false)
				el.aclass(cls + '-nomaximize');
			if (item.actions.minimize == false)
				el.aclass(cls + '-nominimize');
			if (!item.actions.menu)
				el.aclass(cls + '-nomenu');
		}

		var obj = cache[item.id] = {};
		obj.main = self;
		obj.meta = item;
		obj.element = body;
		obj.container = el;
		obj.x = item.offset.x;
		obj.y = item.offset.y;
		obj.width = item.offset.width;
		obj.height = item.offset.height;

		if (item.buttons) {
			var builder = [];
			for (var i = 0; i < item.buttons.length; i++) {
				var btn = item.buttons[i];
				var icon = btn.icon.indexOf(' ') === -1 ? ('fa fa-' + btn.icon) : btn.icon;
				builder.push('<i class="fa fa-{1} {0}-control" data-name="{2}"></i>'.format(cls, icon, btn.name));
			}
			builder.length && el.find(cls2 + '-lastbutton').before(builder.join(''));
		}

		item.make && item.make.call(cache[item.id], body);

		obj.emitresize = function() {
			obj.ert = null;
			obj.element.SETTER('*', 'resize');
		};

		obj.setsize = function(w, h) {
			var t = this;
			var obj = {};

			if (w) {
				obj.width = t.width = t.meta.offset.width = w;
				t.element.parent().css('width', w);
			}

			if (h) {
				t.element.css('height', h);
				t.height = t.meta.offset.height = h;
			}

			t.ert && clearTimeout(t.ert);
			t.ert = setTimeout(t.emitresize, 100);
			self.wsave(t);
		};

		obj.setcommand = function(type) {

			var el = obj.element.parent();
			var c;

			switch (type) {

				case 'toggle':
					obj.setcommand(obj.meta.hidden ? 'show' : 'hide');
					break;

				case 'show':
					if (obj.meta.hidden) {
						obj.meta.hidden = false;
						obj.element.parent().rclass('hidden');
						self.wsave(obj);
						self.resize2();
					}
					break;

				case 'close':
				case 'hide':

					if (type === 'hide' && obj.meta.hidden)
						return;

					if (obj.meta.close) {
						obj.meta.close(function() {
							self.wrem(obj.meta);
							self.resize2();
						});
					} else {
						self.wrem(obj.meta);
						self.resize2();
					}
					break;

				case 'maximize':
					c = cls + '-maximized';

					if (!el.hclass(c)) {
						obj.prevwidth = obj.width;
						obj.prevheight = obj.height;
						obj.prevx = obj.x;
						obj.prevy = obj.y;
						el.aclass(c);
						obj.setcommand('resetminimize');
					}

					var ww = self.element.width() || WW;
					var wh = self.element.height() || WH;
					obj.setoffset(0, 0);
					obj.setsize(ww, wh - obj.element.position().top);
					break;

				case 'resetmaximize':
					c = cls + '-maximized';
					if (el.hclass(c)) {
						obj.setoffset(obj.prevx, obj.prevy);
						obj.setsize(obj.prevwidth, obj.prevheight);
						el.rclass(c);
					}
					break;

				case 'togglemaximize':
					c = cls + '-maximized';
					obj.setcommand(el.hclass(c) ? 'resetmaximize' : 'maximize');
					break;

				case 'minimize':
					c = cls + '-minimized';
					if (!el.hclass(c))
						el.aclass(c);
					break;

				case 'resetminimize':
					c = cls + '-minimized';
					el.hclass(c) && el.rclass(c);
					break;

				case 'toggleminimize':
					c = cls + '-minimized';
					obj.setcommand(el.hclass(c) ? 'resetminimize' : 'minimize');
					break;

				case 'resize':
					obj.setsize(obj.width, obj.height);
					break;

				case 'move':
					obj.setoffset(obj.x, obj.y);
					break;

				case 'focus':
					obj.setcommand('resetminimize');
					prevfocused && prevfocused.rclass(cls + '-focused');
					prevfocused = obj.element.parent().aclass(cls + '-focused');
					break;
				default:
					if (obj.meta.buttons) {
						var btn = obj.meta.buttons.findItem('name', type);
						if (btn && btn.exec)
							btn.exec.call(obj, obj);
					}
					break;
			}
		};

		obj.setoffset = function(x, y) {
			var t = this;
			var obj = {};

			if (x != null)
				obj.left = t.x = t.meta.offset.x = x;

			if (y != null)
				obj.top = t.y = t.meta.offset.y = y;

			t.element.parent().css(obj);
			self.wsave(t);
		};

		obj.meta.service && services.push(obj);
		obj.meta.data && data.push(obj);

		self.append(el);

		setTimeout(function(obj) {
			obj.setcommand('focus');
		}, 100, obj);
		return obj;
	};

	self.wrem = function(item) {
		var obj = cache[item.id];
		if (obj) {
			var main = obj.element.closest(cls2 + '-item');

			if (obj.meta.actions.hide) {
				obj.meta.hidden = true;
				main.aclass('hidden');
				self.wsave(obj);
			} else {
				obj.meta.destroy && obj.meta.destroy.call(obj);
				main.off('*');
				main.find('*').off('*');
				main.remove();
				delete cache[item.id];

				var index = services.indexOf(obj);
				if (index !== -1)
					services.splice(index, 1);

				index = data.indexOf(obj);
				if (index !== -1)
					data.splice(index, 1);

				var arr = self.get();
				arr.splice(arr.findIndex('id', item.id), 1);
				self.update();
			}
		}
	};

	self.setter = function(value) {

		if (!value)
			value = EMPTYARRAY;

		var updated = {};

		for (var i = 0; i < value.length; i++) {
			var item = value[i];
			if (!cache[item.id])
				cache[item.id] = self.wadd(item);
			updated[item.id] = 1;
		}

		// Remove older windows
		var keys = Object.keys(cache);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (!updated[key])
				self.wrem(cache[key].meta);
		}
	};

	self.toggle = function(id) {
		var item = cache[id];
		item && item.setcommand('toggle');
	};

	self.show = function(id) {
		var item = cache[id];
		item && item.setcommand('show');
	};

	self.focus = function(id) {
		var item = cache[id];
		item && item.setcommand('focus');
	};

	self.hide = function(id) {
		var item = cache[id];
		item && item.setcommand('hide');
	};

});

COMPONENT('rawinput', 'type:text', function(self, config, cls) {

	var customvalidator;
	var input;

	self.validate = function(value) {

		if ((!config.required || config.disabled) && !self.forcedvalidation())
			return true;

		if (customvalidator)
			return customvalidator(value);

		if (self.type === 'date')
			return value instanceof Date && !isNaN(value.getTime());

		if (value == null)
			value = '';
		else
			value = value.toString();

		if (config.minlength && value.length < config.minlength)
			return false;

		switch (self.type) {
			case 'email':
				return value.isEmail();
			case 'phone':
				return value.isPhone();
			case 'url':
				return value.isURL();
			case 'zip':
				return (/^\d{5}(?:[-\s]\d{4})?$/).test(value);
			case 'currency':
			case 'number':
				value = value.parseFloat();
				if ((config.minvalue != null && value < config.minvalue) || (config.maxvalue != null && value > config.maxvalue))
					return false;
				return config.minvalue == null ? value > 0 : true;
		}

		return value.length > 0;
	};

	self.formatter(function(path, value) {
		if (value) {
			switch (config.type) {
				case 'lower':
					return (value + '').toLowerCase();
				case 'upper':
					return (value + '').toUpperCase();
				case 'phone':
					return (value + '').replace(/\s/g, '');
				case 'email':
					return (value + '').toLowerCase();
				case 'date':
					return value.format(config.format || 'yyyy-MM-dd');
				case 'time':
					return value.format(config.format || 'HH:mm');
				case 'number':
					return config.format ? value.format(config.format) : value;
			}
		}

		return value;
	});

	self.parser(function(path, value) {
		if (value) {
			var tmp;
			switch (config.type) {
				case 'date':
					tmp = self.get();
					if (tmp)
						tmp = tmp.format('HH:mm');
					else
						tmp = '';
					return value + (tmp ? (' ' + tmp) : '');
				case 'lower':
				case 'email':
					value = value.toLowerCase();
					break;
				case 'upper':
					value = value.toUpperCase();
					break;
				case 'phone':
					value = value.replace(/\s/g, '');
					break;
				case 'time':
					tmp = value.split(':');
					var dt = self.get();
					if (dt == null)
						dt = new Date();
					dt.setHours(+(tmp[0] || '0'));
					dt.setMinutes(+(tmp[1] || '0'));
					dt.setSeconds(+(tmp[2] || '0'));
					value = dt;
					break;
			}
		}
		return value ? config.spaces === false ? value.replace(/\s/g, '') : value : value;
	});

	self.make = function() {
		self.aclass(cls);
		var attr = [];
		config.type && attr.attr('type', config.type === 'password' ? 'password' : 'text');
		config.maxlength && attr.attr('maxlength', config.maxlength);
		config.placeholder && attr.attr('placeholder', config.placeholder);
		config.autofocus && attr.push('autofocus');

		if (config.autofill) {
			attr.attr('autocomplete', 'on');
			attr.attr('name', self.path);
		} else {
			attr.attr('name', Date.now() + '');
			attr.attr('autocomplete', 'new-password');
		}

		self.append('<input data-jc-bind="" {0} />'.format(attr.join(' ')));

		var $input = self.find('input');
		input = $input[0];

		config.enter && $input.on('keydown', function(e) {
			if (e.which === 13)
				self.SEEX(config.enter, input.value, self);
		});

		$input.on('focus', function() {

			var el = $(this);

			if (config.disabled) {
				el.blur();
				return;
			}

			self.aclass(cls + '-focused');
			config.autocomplete && self.EXEC(config.autocomplete, self, el.parent());

			if (config.autosource) {
				var opt = {};
				opt.element = self.element;
				opt.search = GET(self.makepath(config.autosource));
				opt.callback = function(value) {
					var val = typeof(value) === 'string' ? value : value[config.autovalue];
					if (config.autoexec) {
						self.EXEC(config.autoexec, value, function(val) {
							self.set(val, 2);
							self.change();
							self.bindvalue();
						});
					} else {
						self.set(val, 2);
						self.change();
						self.bindvalue();
					}
				};
				SETTER('autocomplete/show', opt);
			}
		}).on('blur', function() {
			self.rclass(cls + '-focused');
		});

	};

	self.configure = function(key, value) {
		switch (key) {
			case 'disabled':
				self.tclass('ui-disabled', !!value);
				input.prop('readonly', !!value);
				self.reset();
				break;
			case 'readonly':
				input.prop('readonly', !!value);
				self.reset();
				break;
			case 'required':
				self.tclass(cls + '-required', !!value);
				self.reset();
				break;
			case 'type':
				self.type = value;
				break;
			case 'validate':
				customvalidator = value ? (/\(|=|>|<|\+|-|\)/).test(value) ? FN('value=>' + value) : (function(path) { path = self.makepath(path); return function(value) { return GET(path)(value); }; })(value) : null;
				break;
			case 'monospace':
				self.tclass(cls + '-monospace', !!value);
				break;
		}
	};

	self.preparevalue = function(value) {

		if (self.type === 'number' && (config.minvalue != null || config.maxvalue != null)) {
			var tmp = typeof(value) === 'string' ? +value.replace(',', '.') : value;
			if (config.minvalue > tmp)
				value = config.minvalue;
			if (config.maxvalue < tmp)
				value = config.maxvalue;
		}

		return value;
	};

	self.getterin = self.getter;
	self.getter = function(value, realtime, nobind) {
		self.getterin(self.preparevalue(value), realtime, nobind);
	};

	self.setter = function(value) {
		input.value = value == null ? '' : (value + '');
	};

	self.state = function(type) {
		if (type) {
			var invalid = config.required ? self.isInvalid() : self.forcedvalidation() ? self.isInvalid() : false;
			if (invalid === self.$oldstate)
				return;
			self.$oldstate = invalid;
			self.tclass(cls + '-invalid', invalid);
		}
	};

	self.forcedvalidation = function() {

		if (!config.forcevalidation)
			return false;

		if (self.type === 'number')
			return false;

		var val = self.get();
		return (self.type === 'phone' || self.type === 'email') && (val != null && (typeof(val) === 'string' && val.length !== 0));
	};

});

COMPONENT('raweditable', 'formatting:false', function(self, config, cls) {

	var customvalidator;
	var skip = false;
	var filled = false;
	var focused = false;

	self.validate = function(value) {

		if ((!config.required || config.disabled) && !self.forcedvalidation())
			return true;

		if (customvalidator)
			return customvalidator(value);

		if (self.type === 'date')
			return value instanceof Date && !isNaN(value.getTime());

		if (value == null)
			value = '';
		else
			value = value.toString();

		if (config.minlength && value.length < config.minlength)
			return false;

		switch (self.type) {
			case 'email':
				return value.isEmail();
			case 'phone':
				return value.isPhone();
			case 'url':
				return value.isURL();
			case 'zip':
				return (/^\d{5}(?:[-\s]\d{4})?$/).test(value);
			case 'currency':
			case 'number':
				value = value.parseFloat();
				if ((config.minvalue != null && value < config.minvalue) || (config.maxvalue != null && value > config.maxvalue))
					return false;
				return config.minvalue == null ? value > 0 : true;
		}

		return value.length > 0;
	};

	self.formatter(function(path, value) {
		if (value) {
			switch (config.type) {
				case 'lower':
					return (value + '').toLowerCase();
				case 'upper':
					return (value + '').toUpperCase();
				case 'phone':
					return (value + '').replace(/\s/g, '');
				case 'email':
					return (value + '').toLowerCase();
				case 'date':
					return value.format(config.format || 'yyyy-MM-dd');
				case 'time':
					return value.format(config.format || 'HH:mm');
				case 'number':
					return config.format ? value.format(config.format) : value;
			}
		}

		return value;
	});

	self.readvalue = function() {
		return config.formatting ? self.dom.innerHTML : self.dom.innerHTML.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
	};

	self.onchange = function() {
		self.set(self.readvalue(), 1);
		self.change(true);
	};

	self.parser(function(path, value) {
		if (value) {
			var tmp;
			switch (config.type) {
				case 'date':
					tmp = self.get();
					if (tmp)
						tmp = tmp.format('HH:mm');
					else
						tmp = '';
					return value + (tmp ? (' ' + tmp) : '');
				case 'lower':
				case 'email':
					value = value.toLowerCase();
					break;
				case 'upper':
					value = value.toUpperCase();
					break;
				case 'phone':
					value = value.replace(/\s/g, '');
					break;
				case 'time':
					tmp = value.split(':');
					var dt = self.get();
					if (dt == null)
						dt = new Date();
					dt.setHours(+(tmp[0] || '0'));
					dt.setMinutes(+(tmp[1] || '0'));
					dt.setSeconds(+(tmp[2] || '0'));
					value = dt;
					break;
			}
		}
		return value ? config.spaces === false ? value.replace(/\s/g, '') : value : value;
	});

	var isplaceholder = false;

	self.placeholder = function(show) {
		if (config.placeholder) {
			if (show) {
				if (filled) {
					if (isplaceholder) {
						isplaceholder = false;
						self.rclass(cls + '-placeholder');
					}
				} else {
					if (!isplaceholder) {
						self.aclass(cls + '-placeholder');
						self.html(config.placeholder);
						isplaceholder = true;
					}
				}
			} else {
				if (isplaceholder) {
					isplaceholder = false;
					self.rclass(cls + '-placeholder');
					self.html('');
				}
			}
		}
	};

	self.make = function() {

		self.aclass(cls);
		self.attr('contenteditable', true);

		var $input = self.element;
		var blacklist = { b: 1, i: 1, u: 1 };
		var is = false;

		$input.on('keydown', function(e) {

			// rebind
			skip = true;
			self.getter(self.readvalue(), true);

			if (config.maxlength && e.which > 16 && !e.metaKey && self.element.text().length >= config.maxlength) {
				e.preventDefault();
				return;
			}

			if (!config.formatting && e.metaKey && blacklist[e.key])
				e.preventDefault();

			if (e.which === 13) {
				self.onchange();
				config.enter && self.SEEX(config.enter, self.get(), self);
				$input.blur();
				e.preventDefault();
				return;
			}

			is = true;

		}).on('focus', function() {

			var el = $(this);

			self.placeholder(false);

			if (config.disabled) {
				el.blur();
				return;
			}

			focused = true;
			self.aclass(cls + '-focused');
			config.autocomplete && self.EXEC(config.autocomplete, self, el.parent());

			if (config.autosource) {
				var opt = {};
				opt.element = self.element;
				opt.search = GET(self.makepath(config.autosource));
				opt.callback = function(value) {
					var val = typeof(value) === 'string' ? value : value[config.autovalue];
					if (config.autoexec) {
						self.EXEC(config.autoexec, value, function(val) {
							self.set(val, 2);
							self.change();
							self.bindvalue();
						});
					} else {
						self.set(val, 2);
						self.change();
						self.bindvalue();
					}
				};
				SETTER('autocomplete/show', opt);
			}
		}).on('blur', function() {
			focused = false;

			if (is) {
				skip = false;
				self.onchange();
			} else
				setTimeout(self.placeholder, 10, true);

			self.rclass(cls + '-focused');
		}).on('paste', function(e) {
			e.preventDefault();
			e.stopPropagation();
			var text = (e.originalEvent.clipboardData.getData(self.attrd('clipboard') || 'text/plain') || '').replace(/\n|\r/g, '').trim();
			text && document.execCommand('insertText', false, text);
		});

	};

	self.configure = function(key, value) {
		switch (key) {
			case 'disabled':
				self.tclass('ui-disabled', !!value);
				self.element.prop('contenteditable', !!value);
				self.reset();
				break;
			case 'readonly':
				self.element.prop('contenteditable', !!value);
				self.reset();
				break;
			case 'required':
				self.tclass(cls + '-required', !!value);
				self.reset();
				break;
			case 'type':
				self.type = value;
				break;
			case 'validate':
				customvalidator = value ? (/\(|=|>|<|\+|-|\)/).test(value) ? FN('value=>' + value) : (function(path) { path = self.makepath(path); return function(value) { return GET(path)(value); }; })(value) : null;
				break;
			case 'monospace':
				self.tclass(cls + '-monospace', !!value);
				break;
		}
	};

	self.preparevalue = function(value) {

		if (self.type === 'number' && (config.minvalue != null || config.maxvalue != null)) {
			var tmp = typeof(value) === 'string' ? +value.replace(',', '.') : value;
			if (config.minvalue > tmp)
				value = config.minvalue;
			if (config.maxvalue < tmp)
				value = config.maxvalue;
		}

		return value;
	};

	self.getterin = self.getter;
	self.getter = function(value, realtime, nobind) {
		filled = !!value;
		self.getterin(self.preparevalue(value), realtime, nobind);
	};

	self.setter = function(value) {

		if (skip) {
			skip = false;
			return;
		}

		if (value == null)
			value = '';

		value = value + '';
		filled = !!value;

		self.html(config.formatting ? value : value.replace(/\s/g, '&nbsp;'));

		if (!focused)
			self.placeholder(true);
	};

	self.state = function(type) {
		if (type) {
			var invalid = config.required ? self.isInvalid() : self.forcedvalidation() ? self.isInvalid() : false;
			if (invalid === self.$oldstate)
				return;
			self.$oldstate = invalid;
			self.tclass(cls + '-invalid', invalid);
		}
	};

	self.forcedvalidation = function() {

		if (!config.forcevalidation)
			return false;

		if (self.type === 'number')
			return false;

		var val = self.get();
		return (self.type === 'phone' || self.type === 'email') && (val != null && (typeof(val) === 'string' && val.length !== 0));
	};

});

COMPONENT('ready', 'delay:800', function(self, config) {

	self.readonly();
	self.blind();

	self.make = function() {
		config.rclass && self.rclass(config.rclass, config.delay);
		config.aclass && self.aclass(config.aclass, config.delay);

		config.focus && setTimeout(function() {
			self.find(config.focus).focus();
		}, config.delay + 1);
	};

});
var common = {};

// Current page
common.page = '';

// Current form
common.form = '';

$(document).ready(function() {
	jR.clientside('.jrouting');
	FIND('loading', FN('() => this.hide(500)'));
	$(window).on('resize', resizer);
	resizer();
});

function isError(arguments) {
	return false;
}

// Because of login form
if (window.su) {
	jR.route('/', function() {
		SET('common.page', 'applications');
	});
}

jR.on('location', function(url) {
	var nav = $('header nav');
	nav.find('.selected').removeClass('selected');
	nav.find('a[href="' + url + '"]').addClass('selected');
	$('header nav').removeClass('mainmenu-visible');
});

function resizer() {
	var h = $(window).height();
	var el = $('.scroller');
	if (el.length)
		el.height($(window).height() - el.offset().top);
	el = $('#body');
	if (!el.length)
		return;
	var t = el.offset().top + 100;
	el.css('min-height', h - t);
}

function success() {
	var el = $('#success');
	el.fadeIn(300).delay(2000).fadeOut(300);
	FIND('loading').hide(500);
}

function can(name) {
	if (su.roles.length === 0)
		return true;
	return su.roles.indexOf(name) !== -1;
}

Tangular.register('default', function(value, def) {
	if (value === undefined || value === null || value === '')
		return def;
	return value;
});

jQuery.easing.easeOutBounce = function(e, f, a, h, g) {
	if ((f /= g) < (1 / 2.75)) {
		return h * (7.5625 * f * f) + a
	} else {
		if (f < (2 / 2.75)) {
			return h * (7.5625 * (f -= (1.5 / 2.75)) * f + 0.75) + a
		} else {
			if (f < (2.5 / 2.75)) {
				return h * (7.5625 * (f -= (2.25 / 2.75)) * f + 0.9375) + a
			} else {
				return h * (7.5625 * (f -= (2.625 / 2.75)) * f + 0.984375) + a
			}
		}
	}
};

function getSelectionStartNode(context){
	if (!context.getSelection)
		return;
	var node = context.getSelection().anchorNode;
	var startNode = (node.nodeName == "#text" ? node.parentNode : node);
	return startNode;
}

function mainmenu() {
	$('header nav').toggleClass('mainmenu-visible');
}
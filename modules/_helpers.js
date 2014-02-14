server;

var helpers = function() {

	var _helpers = {};
	var _keys = [];

	var register = function(helperId, helper) {
		_helpers[helperId] = helper;
		_keys = Object.keys(_helpers);
	};

	var emit = function(eventName) {
		for(var i = 0, length = _keys.length; i < length; i++) {
			var helper = _helpers[_keys[i]];
			if(helper.isCatchable.apply(helper, arguments)) {
				helper.emit.apply(helper, arguments);
				return true;
			}
		}
		return false;
	};

	return {
		register: register,
		emit: emit
	};

}();


exports = server.helpers = helpers;
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var UI = function () {
    function UI(filesElement, canvas, opener, renderer, levelSelector) {
        var _this = this;

        _classCallCheck(this, UI);

        this.filesElement = filesElement;
        this.canvas = canvas;

        this.opener = opener;
        opener.addEventListener('click', function (event) {
            _this.open();
        });

        this.renderer = renderer;
        renderer.addEventListener('click', function (event) {
            _this.render();
        });

        this.levelSelector = levelSelector;
        this.kdl2r = null;
    }

    _createClass(UI, [{
        key: 'open',
        value: function open() {
            this.kdl2r = new KDL2Renderer(this.filesElement.files);
            this.kdl2r.open();
        }
    }, {
        key: 'render',
        value: function render() {
            this.kdl2r.render(this.canvas, this.levelSelector.value);
        }
    }]);

    return UI;
}();

function $$$(el) {
    return document.getElementById(el);
}
var ui = new (Function.prototype.bind.apply(UI, [null].concat(_toConsumableArray(['kirbyLevelFile', 'viewer', 'executeBtn', 'renderBtn', 'levelSelector'].map($$$)))))();
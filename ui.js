'use strict';

class UI {
    constructor(filesElement, canvas, opener, renderer, levelSelector) {
        this.filesElement = filesElement;
        this.canvas = canvas;

        this.opener = opener;
        opener.addEventListener('click', (event) => {
            this.open();
        });

        this.renderer = renderer;
        renderer.addEventListener('click', (event) => {
            this.render();
        });

        this.levelSelector = levelSelector;
        this.kdl2r = null;
    }

    open() {
        this.kdl2r = new KDL2Renderer(this.filesElement.files);
        this.kdl2r.open();
    }

    render() {
        this.kdl2r.render(this.canvas, this.levelSelector.value);
    }
}

function $$$(el) { return document.getElementById(el); }
var ui = new UI(...['kirbyLevelFile','viewer','executeBtn','renderBtn','levelSelector'].map($$$));

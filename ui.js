'use strict';

const GameTypes = {
    KDL: 'kdl',
    KDL2: 'kdl2',
};

class UI {
    constructor(gameType, filesElement, canvas, opener, renderer, levelSelector) {
        this.filesElement = filesElement;
        this.canvas = canvas;
        this.gameType = gameType;

        this.opener = opener;
        opener.addEventListener('click', (event) => {
            this.open();
        });

        this.renderer = renderer;
        renderer.addEventListener('click', (event) => {
            this.render();
        });

        this.levelSelector = levelSelector;
        this.levelRenderer = null;
    }

    open() {
        if (this.gameType == GameTypes.KDL) {
            this.levelRenderer = new KDLRenderer(this.filesElement.files);
        } else if (this.gameType == GameTypes.KDL2) {
            this.levelRenderer = new KDL2Renderer(this.filesElement.files);
        }

        this.levelRenderer.open();
    }

    render() {
        this.levelRenderer.render(this.canvas, this.levelSelector.value);
    }
}

function $$$(el) { return document.getElementById(el); }
var kdlUI = new UI(GameTypes.KDL, ...['kdlFile','kdlViewer','kdlExecuteBtn','kdlRenderBtn','kdlLevelSelector'].map($$$));
var kdl2UI = new UI(GameTypes.KDL2, ...['kdl2File','kdl2Viewer','kdl2ExecuteBtn','kdl2RenderBtn','kdl2LevelSelector'].map($$$));

'use strict';

/* Produces level renders from Kirby's Dreamland 2's ROM. */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var KDL2Renderer = function () {

    /* Takes a list of files. */

    function KDL2Renderer(fileList) {
        _classCallCheck(this, KDL2Renderer);

        this.fileList = fileList;
    }

    /* Open and load all levels in the ROM */


    _createClass(KDL2Renderer, [{
        key: 'open',
        value: function open() {
            if (this.fileList.length <= 0) {
                throw 'fileList must have at least 1 file';
            }

            var _this = this;

            for (var index = 0; index < this.fileList.length; index += 1) {
                var file = this.fileList[index];
                var reader = new FileReader();
                reader.onloadend = function () {
                    _this.levels = _this.parseROM(this.result);
                    //_this.toCanvas();
                };
                reader.onerror = this.errorHandler;
                reader.onabort = this.errorHandler;

                reader.readAsArrayBuffer(file);
            }
        }
    }, {
        key: 'errorHandler',
        value: function errorHandler(error) {
            console.log(error);
            throw 'An unrecoverable error has occurred';
        }
    }, {
        key: 'byteSwap',
        value: function byteSwap(lsb, msb) {
            return (0 | msb) << 8 | lsb;
        }

        /*
         * The game procedurally generates data that is used in its compression algorithm.
         * Here I've translated what the game does into JavaScript.
         */

    }, {
        key: 'generateProceduralData',
        value: function generateProceduralData() {
            var list = [];
            var a = 0x07;
            var carryBit = 0;
            var index = 0;

            while (a != 0) {
                for (var b = 0; b < 8; b += 1) {

                    // rrc l
                    carryBit = index & 0x01;
                    index = carryBit << 7 | index >> 1;

                    // rla
                    a = a << 1 | carryBit;
                    carryBit = a >> 8 & 0x01;
                    a = a & 0xFF;
                }

                list.push(a);
                index += 1;
                a += 1;
                if (a > 0xFF) {
                    a = 0;
                }
            }

            return list;
        }

        /*
         * This is the decompression algorithm used in KDL2. It's simple - the guys at HAL Laboratory basically
         * took every kind of run-length encoding type you can think of, and used it here, with the exception
         * of using their procedural data as a way of filling in some data.
         */

    }, {
        key: 'decompress',
        value: function decompress(data, address) {
            var index = address;
            var endOfFileByte = 0xFF;
            var decompressedData = [];
            var proceduralData = this.generateProceduralData();

            /* Temporary variables */
            var byte1 = 0;
            var byte2 = 0;
            var startIndex = 0;

            var currentByte = data.getUint8(index);
            index += 1;

            while (currentByte != endOfFileByte) {
                var typePart = currentByte & 0xE0;
                var numberPart = currentByte & 0x1F;

                /* The number doesn't fit into a nibble, so the next
                   byte is the number. */
                var expansionByte = currentByte & 0xE0;
                if (expansionByte === 0xE0) {
                    typePart = currentByte << 3 & 0xE0;
                    numberPart = data.getUint8(index);
                    index += 1;
                }

                switch (typePart) {

                    case 0x20:
                        for (var count = 0; count < numberPart + 1; count += 1) {
                            decompressedData.push(data.getUint8(index));
                        }
                        index += 1;
                        break;

                    case 0x40:
                        byte1 = data.getUint8(index + 0);
                        byte2 = data.getUint8(index + 1);

                        for (var _count = 0; _count < numberPart + 1; _count += 1) {
                            decompressedData.push(byte1);
                            decompressedData.push(byte2);
                        }
                        index += 2;
                        break;

                    case 0x60:
                        byte1 = data.getUint8(index);

                        for (var _count2 = 0; _count2 < numberPart + 1; _count2 += 1) {
                            decompressedData.push(byte1);
                            byte1 += 1;
                        }
                        index += 1;
                        break;

                    case 0x80:
                        startIndex = this.byteSwap(data.getUint8(index + 1), data.getUint8(index + 0));

                        for (var _count3 = 0; _count3 < numberPart + 1; _count3 += 1) {
                            var copyByte = decompressedData[startIndex];
                            decompressedData.push(copyByte);
                            startIndex += 1;
                        }
                        index += 2;

                        break;

                    case 0xA0:
                        startIndex = this.byteSwap(data.getUint8(index + 1), data.getUint8(index + 0));

                        for (var _count4 = 0; _count4 < numberPart + 1; _count4 += 1) {
                            /* The data at decompressData[i] acts as an index for the proceduralData. */
                            var proceduralIndex = decompressedData[startIndex];
                            var theByte = proceduralData[proceduralIndex];
                            decompressedData.push(theByte);
                            startIndex += 1;
                        }

                        index += 2;
                        break;

                    case 0xC0:
                        startIndex = this.byteSwap(data.getUint8(index + 1), data.getUint8(index + 0));

                        for (var _count5 = 0; _count5 < numberPart + 1; _count5 += 1) {
                            var _copyByte = decompressedData[startIndex];
                            decompressedData.push(_copyByte);
                            startIndex -= 1;
                        }
                        index += 2;
                        break;

                    default:
                        for (var _count6 = 0; _count6 < numberPart + 1; _count6 += 1) {
                            decompressedData.push(data.getUint8(index));
                            index += 1;
                        }
                        break;
                }

                currentByte = data.getUint8(index);
                index += 1;
            }

            return decompressedData;
        }
    }, {
        key: 'parseROM',
        value: function parseROM(arrayBuffer) {
            var data = new DataView(arrayBuffer);
            var levelTableBank = 8;
            var levelTableAddress = 0x511F;
            var index = calculateAddress(levelTableAddress, levelTableBank);
            var totalLevels = 177;
            var levels = [];

            index += 1;

            for (var counter = 0; counter < totalLevels; counter += 1) {
                var lsb = data.getUint8(index);
                index += 1;
                var msb = data.getUint8(index);
                index += 1;
                var bank = data.getUint8(index);
                index += 1;

                var address = this.byteSwap(lsb, msb);

                var level = {
                    address: address,
                    bank: bank
                };

                levels.push(level);

                this.parseLevel(data, level);
            }

            return levels;
        }
    }, {
        key: 'parseLevel',
        value: function parseLevel(data, level) {
            var index = calculateAddress(level.address, level.bank);

            level.verticalSlices = data.getUint8(index);
            index += 1;
            level.horizontalSlices = data.getUint8(index);
            index += 1;

            level.geometry = {
                left: data.getUint8(index + 0),
                top: data.getUint8(index + 1),
                right: data.getUint8(index + 2),
                bottom: data.getUint8(index + 3)
            };

            index += 4;

            level.assets = {
                address: this.byteSwap(data.getUint8(index + 0), data.getUint8(index + 1)),
                bank: data.getUint8(index + 2)
            };

            index += 3;

            this.parseAssets(data, level.assets);

            //Skip level objects - feel free to submit a PR!
            index += 3;

            //Skip level door table
            index += 3;

            //Skip unknown byte
            index += 1;

            level.blocks = {
                data: this.decompress(data, index)
            };
        }
    }, {
        key: 'parseAssets',
        value: function parseAssets(data, assets) {
            var _pixels, _pixels2, _pixels3;

            var index = calculateAddress(assets.address, assets.bank);

            assets.tiles = {
                address: this.byteSwap(data.getUint8(index + 0), data.getUint8(index + 1)),
                bank: data.getUint8(index + 2)
            };
            index += 3;

            var tiles = assets.tiles;

            var address = calculateAddress(tiles.address, tiles.bank);

            /*
             * The game makes full use of Game Boy's VRAM "features", which includes mode switching and
             * address wrapping. I try to avoid anything fancy by preparing our graphics in a "standard"
             * VRAM space (just an array), and rendering from that. Works for the most part.
             *
             * This byte determines where to start writing in Game Boy's VRAM, but...[0]
             */
            var vramStart = 0x9630 - (data.getUint8(address) << 4) & 0xFFFF;

            // If vramStart is less than 0x8800, then we're using 8000 mode
            if (vramStart < 0x8800) {
                tiles.vram = 0x8000;
            } else {
                tiles.vram = 0x8800;
            }
            address += 1;

            var pixels = this.decompress(data, address);

            /* We modify the data so it simulates what KDL2 assumes when using a Game Boy's VRAM. */

            // 0: First we pad the start of the data, taking our VRAM start address and subtracting with the total size of VRAM
            var prePadding = vramStart - tiles.vram;
            var amountToFill = new Array(prePadding).fill(0);

            // Prepend it to the tile data we already have
            pixels = amountToFill.concat(pixels);

            // Calculate and append the rest of our fake VRAM (why +0x1800, when it should be 0x800? Because for some reason, the math doesn't work out. Figure it out :)
            var postPadding = tiles.vram + 0x1800 - pixels.length;
            pixels = pixels.concat(new Array(postPadding).fill(0));

            /* There are 3 tiles that act as "fill" at the end very end of VRAM. */
            (_pixels = pixels).splice.apply(_pixels, [(0x7d + 0x80) * 16, 16].concat([0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00]));
            (_pixels2 = pixels).splice.apply(_pixels2, [(0x7e + 0x80) * 16, 16].concat([0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF]));
            (_pixels3 = pixels).splice.apply(_pixels3, [(0x7f + 0x80) * 16, 16].concat([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));

            tiles.data = pixels;

            tiles.chunkSize = data.getUint8(index);
            index += 1;
            tiles.translation = this.decompress(data, index);
            tiles.layer = [];

            /*
             * KDL2 loads tile references into lists for easy accessiblity during run-time. We'll do the same.
             * layer1 is top left, layer2 is top right, layer3 is bottom left, layer4 is bottom right.
             * KDL2 stores its tile references into these 4 huge chunks, so that's why we're doing this, rather thanh referencing and reading them one after the other.
             */
            var previousCounters = 0;
            for (var current = 0; current < 4; current += 1) {
                tiles.layer[current] = [];

                var counter = 0;
                for (; counter < tiles.chunkSize; counter += 1) {
                    tiles.layer[current].push(tiles.translation[counter + previousCounters]);
                }
                previousCounters += counter;
            }
        }

        /* Takes a canvas context and level index */

    }, {
        key: 'render',
        value: function render(canvas, index) {
            if (this.levels === undefined) {
                throw 'No levels are loaded.';
            }

            if (this.levels.length <= 0) {
                throw 'No levels are loaded.';
            }

            if (index >= this.levels.length) {
                throw 'Level does not exist';
            }

            var level = this.levels[index];
            var renderer = new GameBoyTilePlotter(canvas);

            /* Clear the canvas */
            renderer.clear();

            function getTiles(data, layer, number) {
                var tileNumber = level.assets.tiles.layer[layer][number];
                var index = 0;

                if (tileNumber > 0x7F) {
                    tileNumber = tileNumber % 0x80;
                } else {
                    tileNumber += 0x80;
                }

                tileNumber *= 16;
                return data.slice(tileNumber, tileNumber + 16);
            }

            var data = level.assets.tiles.data;

            var x = 0;
            var oldX = x;
            var y = 0;
            var oldY = y;
            var verticalSlice = 0;
            var horizontalSlice = 0;

            var tiles = level.blocks.data.map(function (aByte) {

                /* Place the tiles in a 2x2 square */
                renderer.plot(getTiles(data, 0, aByte), x, y);
                x += 1;
                renderer.plot(getTiles(data, 1, aByte), x, y);
                x -= 1;
                y += 1;
                renderer.plot(getTiles(data, 2, aByte), x, y);
                x += 1;
                renderer.plot(getTiles(data, 3, aByte), x, y);

                /* Put ourselves at the next position */
                y -= 1;
                x += 1;

                // Logic to piece together the bigger pieces
                /* The length of one chunk is 16, 2x2 tiles. */
                if (x % (16 * 2) === 0) {
                    y += 2;
                    x = oldX;
                }

                if (x % (16 * 2) === 0 && y % (16 * 2) === 0) {
                    y = oldY;
                    x += 16 * 2;
                    oldX = x;
                    verticalSlice += 1;
                }

                if (verticalSlice >= level.verticalSlices) {
                    y += 16 * 2;
                    oldY = y;

                    x = 0;
                    oldX = x;

                    verticalSlice = 0;
                    horizontalSlice += 1;
                }
            });
        }
    }]);

    return KDL2Renderer;
}();

/* A simple address helper to translate an address & bank to an absolute address. */


function calculateAddress(address, bank) {
    return 0x4000 * bank + (address & 0x3FFF);
}

/* A class to handle rendering */

var GameBoyTilePlotter = function () {
    function GameBoyTilePlotter(canvas) {
        var _this2 = this;

        _classCallCheck(this, GameBoyTilePlotter);

        this.canvas = canvas;
        this.context = canvas.getContext('2d');

        this.lumin = 256;
        this.colors = [this.image(), this.image(), this.image(), this.image()];
        this.colors.forEach(function (color) {
            var d = color.data;
            d[0] = _this2.lumin;
            d[1] = _this2.lumin;
            d[2] = _this2.lumin;
            d[3] = 255;

            _this2.lumin -= 0x100 / 4;
        });
    }

    _createClass(GameBoyTilePlotter, [{
        key: 'image',
        value: function image() {
            return this.context.createImageData(1, 1);
        }
    }, {
        key: 'clear',
        value: function clear() {
            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }, {
        key: 'put',
        value: function put(pixel, x, y) {
            var color = this.colors[pixel];
            this.context.putImageData(color, x, y);
        }

        /* Tile x and tile y, not pixel positions! */

    }, {
        key: 'plot',
        value: function plot(tiles, x, y) {

            x *= 8;
            y *= 8;

            var oldX = x;
            var oldY = y;

            for (var index = 0; index < tiles.length; index += 2) {

                /* Get the two bytes we're going to merge */
                var byte1 = tiles[index + 0];
                var byte2 = tiles[index + 1];

                x = oldX;

                /* OR them together, to get eight 2-bit pixels */
                for (var bit = 7; bit >= 0; bit -= 1) {
                    var bit1 = byte1 >> bit & 0x1;
                    var bit2 = byte2 >> bit & 0x1;

                    var pixel = (0 | bit1) << 1 | bit2;
                    this.put(pixel, x, y);
                    x += 1;
                }

                y += 1;

                if (y % 8 === 0) {
                    oldY = y;
                    y += 8;
                }
            }
        }
    }]);

    return GameBoyTilePlotter;
}();
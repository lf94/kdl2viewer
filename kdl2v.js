'use strict';

class KDL2Factory {

    /* Takes a list of files. */
    constructor(fileList) {
        this.fileList = fileList;
    }

    open() {
        if (this.fileList.length <= 0) {
            throw 'fileList must have at least 1 file';
        }

        let _this = this;

        for (let index = 0; index < this.fileList.length; index += 1) {
            let file         = this.fileList[index];
            let reader       = new FileReader();
            reader.onloadend = function () {
                _this.levels = _this.parseROM(this.result);
                //_this.toCanvas();
            };
            reader.onerror   = this.errorHandler;
            reader.onabort   = this.errorHandler;

            reader.readAsArrayBuffer(file);
        }
    }

    errorHandler(error) {
        console.log(error);
        throw 'An unrecoverable error has occurred';
    }

    calculateAddress(address, bank) {
        return (0x4000 * bank) + (address & 0x3FFF);
    }

    byteSwap(lsb, msb) {
        return (((0 | msb) << 8) | lsb);
    }

    /* I simulate the game does, along with Game Boy's CPU effects */
    generateProceduralData() {
        let list     = [];
        let a        = 0x07;
        let carryBit = 0;
        let index    = 0;

        while (a != 0) {
            for (let b = 0x8; b >= 0; b -= 1) {

                // rrc l
                carryBit = (index >> 8) & 0x01;
                index    = (index >> 1);

                // rla
                a        = (a << 1) | carryBit;
                carryBit = (a >> 8) & 0x1;
            }

            list.push(a);
            a += 1;
            if (a > 0xFF) {
                a = 0;
            }
        }

        return list;
    }

    decompress(data, address) {
        let index            = address;
        let endOfFileByte    = 0xFF;
        let decompressedData = [];
        let proceduralData   = this.generateProceduralData();

        /* Temporary variables */
        let byte1      = 0;
        let byte2      = 0;
        let startIndex = 0;

        let currentByte = data.getUint8(index);
        index += 1;
        while (currentByte != endOfFileByte) {
            let typeNibble   = currentByte & 0xE0;
            let numberNibble = currentByte & 0x1F;

            /* The number doesn't fit into a nibble, so the next
               byte is the number. */
            let expansionByte = currentByte & 0xE0;
            if (expansionByte === 0xE0) {
                typeNibble   = currentByte << 3;
                numberNibble = data.getUint8(index);
                index += 1;
            }

            switch(typeNibble) {

            case 0x20:
                for (let count = 0; count < (numberNibble + 1); count += 1) {
                    decompressedData.push(data.getUint8(index));
                }
                index += 1;
                break;

            case 0x40:
                byte1 = data.getUint8(index + 0);
                byte2 = data.getUint8(index + 1);

                for (let count = 0; count < (numberNibble + 1); count += 1) {
                    decompressedData.push(byte1);
                    decompressedData.push(byte2);
                }
                index += 2;
                break;

            case 0x60:
                byte1 = data.getUint8(index);

                for (let count = 0; count < (numberNibble + 1); count += 1) {
                    decompressedData.push(byte1);
                    byte1 += 1;
                }
                index += 1;
                break;

            case 0x80:
                startIndex = this.byteSwap(data.getUint8(index + 1), data.getUint8(index + 0));

                for (let count = 0; count < (numberNibble + 1); count += 1) {
                    let copyByte = decompressedData[startIndex];
                    decompressedData.push(copyByte);
                    startIndex += 1;
                }
                index += 2;

                break;

            case 0xA0:
                startIndex = this.byteSwap(data.getUint8(index + 1), data.getUint8(index + 0));
                for (let count = 0; count < (numberNibble + 1); count += 1) {
                    /* The data at decompressData[i] acts as an index for thet proceduralData. */
                    let proceduralIndex = decompressedData[startIndex];
                    let theByte = proceduralData[proceduralIndex];
                    decompressedData.push(theByte);
                    startIndex += 1;
                }
                break;

            case 0xC0:
                startIndex = this.byteSwap(data.getUint8(index + 1), data.getUint8(index + 0));

                for (let count = 0; count < (numberNibble + 1); count += 1) {
                    let copyByte = decompressedData[startIndex];
                    decompressedData.push(copyByte);
                    startIndex -= 1;
                }
                index += 2;
                break;

            default:
                for (let count = 0; count < (numberNibble + 1); count += 1) {
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

    parseROM(arrayBuffer) {
        let data              = new DataView(arrayBuffer);
        let levelTableBank    = 8;
        let levelTableAddress = 0x511F;
        let index             = this.calculateAddress(levelTableAddress, levelTableBank);
        let totalLevels       = 177;
        let levels            = [];

        index += 1;
        for (let counter = 0; counter < totalLevels; counter += 1) {
            let lsb  = data.getUint8(index);
            index += 1;
            let msb  = data.getUint8(index);
            index += 1;
            let bank = data.getUint8(index);
            index += 1;

            let address = this.byteSwap(lsb, msb);

            let level = {
                address,
                bank
            };

            levels.push(level);

            this.parseLevel(data, level);
        }

        return levels;
    }

    parseLevel(data, level) {
        let index = this.calculateAddress(level.address, level.bank);

        level.verticalSlices = data.getUint8(index);
        index += 1;
        level.horizontalSlices = data.getUint8(index);
        index += 1;

        level.geometry = {
            left :  data.getUint8(index + 0),
            top  :  data.getUint8(index + 1),
            right:  data.getUint8(index + 2),
            bottom: data.getUint8(index + 3)
        };

        index += 4;

        level.assets = {
            address: this.byteSwap(data.getUint8(index + 0), data.getUint8(index + 1)),
            bank   : data.getUint8(index + 2)
        };

        index += 3;

        this.parseAssets(data, level.assets);

        //Skip level objects
        index += 3

        //Skip level door table
        index += 3;

        //Skip unknown byte
        index += 1;

        level.blocks = {
            data: this.decompress(data, index)
        };

    }

    parseAssets(data, assets) {
        let index = this.calculateAddress(assets.address, assets.bank);

        assets.tiles = {
            address: this.byteSwap(data.getUint8(index + 0), data.getUint8(index + 1)),
            bank   : data.getUint8(index + 2)
        };
        index += 3;

        // Add 1 to the address because the first byte is something else
        let address = this.calculateAddress(assets.tiles.address, assets.tiles.bank) + 1;
        assets.tiles.data = this.decompress(data, address);

        let chunkSize = data.getUint8(index);
        index += 1;
        assets.tiles.translation = this.decompress(data, index);
        assets.tiles.layer = [];

        let previousCounters = 0;
        for (let current = 0; current < 4; current += 1) {
            assets.tiles.layer[current] = [];

            let counter = 0;
            for (; counter < chunkSize; counter += 1) {
                assets.tiles.layer[current].push(assets.tiles.translation[counter + previousCounters]);
            }
            previousCounters += counter;
        }
    }


    toCanvas() {
    }

    /* Takes a canvas context and level index */
    assemble(context, index) {
        if (this.levels === undefined) {
            throw 'No levels are loaded.';
        }

        if (this.levels.length <= 0) {
            throw 'No levels are loaded.';
        }

        if (index >= this.levels.length) {
            throw 'Level does not exist';
        }

        let level = this.levels[index];

        /* Clear the canvas */
        context.clearRect(0, 0, canvas.width, canvas.height);

        /* Draw the level borders */
        context.rect(0, 0, level.verticalSlices*16*16, level.horizontalSlices*16*16);
        context.stroke();

        let x = 0;
        let oldX = x;
        let y = 0;
        let start = 0;
        let tiles = level.blocks.data.map((aByte) => {
            let data = level.assets.tiles.data;

            start = level.assets.tiles.layer[0][aByte];
            tilePut(context, data.slice(start, start+8), x, y);
            x += 1;
            start = level.assets.tiles.layer[1][aByte];
            tilePut(context, data.slice(start, start+8), x, y);
            x -= 1;
            y += 1;
            start = level.assets.tiles.layer[2][aByte];
            tilePut(context, data.slice(start, start+8), x, y);
            x += 1;
            start = level.assets.tiles.layer[3][aByte];
            tilePut(context, data.slice(start, start+8), x, y);
            /* Put ourselves at the next position */
            y -= 1;
            x += 1;

            /* The length of one chunk is 16 2x2 tiles. */
            if (x % (16*2) === 0) {
                y += 2;
                x = oldX;
            }

            if (y % (16*2) == 0 && x % (16*2) == 0) {
                y = 0;
                x += (16*2);
                oldX = x;
            }
        });

    }

}

/* Tile x and tile y, not pixel positions! */
function tilePut(context, tiles, x, y) {
    function image() { return context.createImageData(1,1); }
    function put(pixel, x, y) {
        let color = colors[pixel];
        context.putImageData(color, x, y);
    }

    var colors = [image(), image(), image(), image()];
    var lumin = 256;

    colors.forEach((color) => {
        var d = color.data;
        d[0]   = lumin;
        d[1]   = lumin;
        d[2]   = lumin;
        d[3]   = 255;

        lumin -= (0x100 / 4);
    });

    x *= 8;
    y *= 8;

    let oldX = x;
    let oldY = y;
    for (let index = 0; index < tiles.length; index += 2) {
        let byte1 = tiles[index + 0];
        let byte2 = tiles[index + 1];

        x = oldX;

        for (let bit = 7; bit > 0; bit -= 1) {
            let bit1 = (byte1 >> bit) & 0x1;
            let bit2 = (byte2 >> bit) & 0x1;

            let pixel = (((0 | bit1) << 1) | bit2);
            put(pixel, x, y);
            x += 1;
        }

        y += 1;
    }
}

function execute() {
    let levelFilesInput = document.getElementById('kirbyLevelFile').files;
    window.kdl2Factory = new KDL2Factory(levelFilesInput);
    kdl2Factory.open();

}

